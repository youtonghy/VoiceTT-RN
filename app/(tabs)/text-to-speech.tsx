import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from '@react-navigation/native';
import { createAudioPlayer } from 'expo-audio';
import * as Clipboard from 'expo-clipboard';
import {
    EncodingType,
    documentDirectory,
    getInfoAsync,
    makeDirectoryAsync,
    writeAsStringAsync,
} from 'expo-file-system/legacy';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
    Alert,
    KeyboardAvoidingView,
    Platform,
    Pressable,
    ScrollView,
    StyleSheet,
    View,
} from 'react-native';
import { Button, Card, Input, Spinner, Text, TextField } from 'heroui-native';
import { EmptyState as HeroEmptyState } from 'heroui-native-pro';

import { ContextMenu, type ContextMenuAction, type ContextMenuAnchor } from '@/components/context-menu';
import { AppCard, AppIcon, AppScreen } from '@/components/native/app-shell';
import { useSettings } from '@/contexts/settings-context';
import { synthesizeSpeech } from '@/services/tts';
import type { TranscriptionMessage } from '@/types/transcription';
import type { TextToSpeechFormat, TtsMessage } from '@/types/tts';

const HISTORY_STORAGE_KEY = '@agents/history-conversations';
const HISTORY_STORAGE_VERSION = 2;
const DEFAULT_AUDIO_FORMAT: TextToSpeechFormat = 'mp3';
const BASE64_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

type AssistantMessageStatus = 'pending' | 'succeeded' | 'failed';

type AssistantMessage = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt: number;
  status: AssistantMessageStatus;
  error?: string;
};

type HistoryConversation = {
  id: string;
  title: string;
  transcript: string;
  translation?: string;
  summary?: string;
  createdAt: number;
  messages: TranscriptionMessage[];
  assistantMessages: AssistantMessage[];
  ttsMessages: TtsMessage[];
};

type StoredHistoryPayload = {
  version?: number;
  conversations?: unknown;
  activeConversationId?: string | null;
  nextIdCounter?: number;
};

type ContextMenuState = {
  title?: string;
  actions: ContextMenuAction[];
  anchor?: ContextMenuAnchor;
};

function createAssistantMessageId(role: 'user' | 'assistant'): string {
  return `${role}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function createTtsMessageId(): string {
  return `tts-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let result = '';
  let index = 0;

  for (; index + 2 < bytes.length; index += 3) {
    result += BASE64_ALPHABET[bytes[index] >> 2];
    result += BASE64_ALPHABET[((bytes[index] & 0x03) << 4) | (bytes[index + 1] >> 4)];
    result += BASE64_ALPHABET[((bytes[index + 1] & 0x0f) << 2) | (bytes[index + 2] >> 6)];
    result += BASE64_ALPHABET[bytes[index + 2] & 0x3f];
  }

  if (index < bytes.length) {
    const byte1 = bytes[index];
    result += BASE64_ALPHABET[byte1 >> 2];
    if (index + 1 < bytes.length) {
      const byte2 = bytes[index + 1];
      result += BASE64_ALPHABET[((byte1 & 0x03) << 4) | (byte2 >> 4)];
      result += BASE64_ALPHABET[(byte2 & 0x0f) << 2];
      result += '=';
    } else {
      result += BASE64_ALPHABET[(byte1 & 0x03) << 4];
      result += '==';
    }
  }

  return result;
}

function sanitizeAssistantMessages(raw: unknown): AssistantMessage[] {
  if (!Array.isArray(raw)) {
    return [];
  }
  const sanitized: AssistantMessage[] = [];
  raw.forEach((item) => {
    if (!item || typeof item !== 'object') {
      return;
    }
    const candidate = item as Partial<AssistantMessage>;
    if (candidate.role !== 'user' && candidate.role !== 'assistant') {
      return;
    }
    const textContent = typeof candidate.content === 'string' ? candidate.content.trim() : '';
    if (!textContent) {
      return;
    }
    const status: AssistantMessageStatus =
      candidate.status === 'failed' || candidate.status === 'pending'
        ? candidate.status
        : 'succeeded';

    sanitized.push({
      id:
        typeof candidate.id === 'string' && candidate.id.trim()
          ? candidate.id
          : createAssistantMessageId(candidate.role),
      role: candidate.role,
      content: textContent,
      createdAt:
        typeof candidate.createdAt === 'number' && Number.isFinite(candidate.createdAt)
          ? candidate.createdAt
          : Date.now(),
      status,
      error:
        typeof candidate.error === 'string' && candidate.error.trim()
          ? candidate.error.trim()
          : undefined,
    });
  });
  return sanitized;
}

function sanitizeTtsMessages(raw: unknown): TtsMessage[] {
  if (!Array.isArray(raw)) {
    return [];
  }
  const sanitized: TtsMessage[] = [];
  raw.forEach((item) => {
    if (!item || typeof item !== 'object') {
      return;
    }
    const candidate = item as Partial<TtsMessage>;
    const content = typeof candidate.content === 'string' ? candidate.content.trim() : '';
    if (!content) {
      return;
    }
    const status = candidate.status === 'failed' || candidate.status === 'pending'
      ? candidate.status
      : 'ready';
    sanitized.push({
      id:
        typeof candidate.id === 'string' && candidate.id.trim()
          ? candidate.id
          : createTtsMessageId(),
      content,
      createdAt:
        typeof candidate.createdAt === 'number' && Number.isFinite(candidate.createdAt)
          ? candidate.createdAt
          : Date.now(),
      status,
      error:
        typeof candidate.error === 'string' && candidate.error.trim()
          ? candidate.error.trim()
          : undefined,
      audioUri:
        typeof candidate.audioUri === 'string' && candidate.audioUri.trim()
          ? candidate.audioUri.trim()
          : undefined,
      audioFormat:
        typeof candidate.audioFormat === 'string' && candidate.audioFormat.trim()
          ? candidate.audioFormat.trim() as TextToSpeechFormat
          : undefined,
      audioMimeType:
        typeof candidate.audioMimeType === 'string' && candidate.audioMimeType.trim()
          ? candidate.audioMimeType.trim()
          : undefined,
      voice:
        typeof candidate.voice === 'string' && candidate.voice.trim()
          ? candidate.voice.trim()
          : undefined,
      model:
        typeof candidate.model === 'string' && candidate.model.trim()
          ? candidate.model.trim()
          : undefined,
    });
  });
  return sanitized;
}

function sanitizeHistoryConversations(raw: unknown): HistoryConversation[] {
  if (!Array.isArray(raw)) {
    return [];
  }
  const sanitized: HistoryConversation[] = [];
  raw.forEach((item) => {
    if (!item || typeof item !== 'object') {
      return;
    }
    const candidate = item as Partial<HistoryConversation>;
    if (typeof candidate.id !== 'string' || typeof candidate.title !== 'string') {
      return;
    }
    sanitized.push({
      id: candidate.id,
      title: candidate.title,
      transcript: typeof candidate.transcript === 'string' ? candidate.transcript : '',
      translation:
        typeof candidate.translation === 'string' ? candidate.translation : undefined,
      summary: typeof candidate.summary === 'string' ? candidate.summary : undefined,
      createdAt:
        typeof candidate.createdAt === 'number' && Number.isFinite(candidate.createdAt)
          ? candidate.createdAt
          : Date.now(),
      messages: Array.isArray(candidate.messages)
        ? candidate.messages
            .filter((message): message is TranscriptionMessage => !!message && typeof message === 'object')
            .map((message) => ({ ...message }))
        : [],
      assistantMessages: sanitizeAssistantMessages(candidate.assistantMessages),
      ttsMessages: sanitizeTtsMessages(candidate.ttsMessages),
    });
  });
  return sanitized;
}

function deriveNextHistoryId(conversations: HistoryConversation[], fallback: number = 1): number {
  let next = Math.max(fallback, 1);
  conversations.forEach((item) => {
    if (typeof item.id !== 'string') {
      return;
    }
    const match = item.id.match(/(\d+)$/);
    if (!match) {
      return;
    }
    const numeric = Number.parseInt(match[1], 10);
    if (!Number.isNaN(numeric)) {
      next = Math.max(next, numeric + 1);
    }
  });
  return next;
}

function isDataUri(uri?: string): boolean {
  return !!uri && uri.startsWith('data:');
}

async function persistAudioBuffer(
  buffer: ArrayBuffer,
  conversationId: string,
  messageId: string,
  format: TextToSpeechFormat,
  mimeType: string
): Promise<string> {
  const base64 = arrayBufferToBase64(buffer);
  if (!documentDirectory) {
    return `data:${mimeType};base64,${base64}`;
  }
  try {
    const safeConversationId = conversationId.replace(/[^a-zA-Z0-9_-]/g, '');
    const safeMessageId = messageId.replace(/[^a-zA-Z0-9_-]/g, '');
    const directory = `${documentDirectory}tts/${safeConversationId}`;
    await makeDirectoryAsync(directory, { intermediates: true });
    const fileUri = `${directory}/${safeMessageId}.${format}`;
    await writeAsStringAsync(fileUri, base64, { encoding: EncodingType.Base64 });
    return fileUri;
  } catch (error) {
    console.warn('[reading] Failed to cache audio on disk, using data URI fallback', error);
    return `data:${mimeType};base64,${base64}`;
  }
}

async function resolveCachedAudioUri(uri?: string): Promise<string | null> {
  if (!uri) {
    return null;
  }
  if (isDataUri(uri)) {
    return uri;
  }
  const info = await getInfoAsync(uri);
  return info.exists ? uri : null;
}

export default function ReadingScreen() {
  const { t } = useTranslation();
  const { settings } = useSettings();
  const isDesktopApp =
    Platform.OS === 'web' &&
    typeof window !== 'undefined' &&
    Boolean((window as { electron?: unknown }).electron);

  const [historyItems, setHistoryItems] = useState<HistoryConversation[]>([]);
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const scrollRef = useRef<ScrollView | null>(null);
  const nextIdCounterRef = useRef(1);
  const activeConversationIdRef = useRef<string | null>(activeConversationId);
  const playerRef = useRef<ReturnType<typeof createAudioPlayer> | null>(null);
  const pendingIdsRef = useRef<Set<string>>(new Set());
  const messageLongPressRef = useRef<string | null>(null);

  useEffect(() => {
    activeConversationIdRef.current = activeConversationId;
  }, [activeConversationId]);

  const loadHistory = useCallback(async () => {
    try {
      const raw = await AsyncStorage.getItem(HISTORY_STORAGE_KEY);
      if (!raw) {
        setHistoryItems([]);
        setActiveConversationId(null);
        nextIdCounterRef.current = 1;
        return;
      }
      let parsed: unknown;
      try {
        parsed = JSON.parse(raw) as unknown;
      } catch (parseError) {
        console.warn('[reading] Failed to parse stored history conversations', parseError);
        return;
      }
      if (Array.isArray(parsed)) {
        const conversations = sanitizeHistoryConversations(parsed);
        nextIdCounterRef.current = deriveNextHistoryId(conversations, nextIdCounterRef.current);
        setHistoryItems(conversations);
        setActiveConversationId(conversations[0]?.id ?? null);
        return;
      }
      if (parsed && typeof parsed === 'object') {
        const payload = parsed as StoredHistoryPayload;
        const conversations = sanitizeHistoryConversations(payload.conversations ?? []);
        const computedNext = deriveNextHistoryId(conversations, nextIdCounterRef.current);
        const nextId =
          typeof payload.nextIdCounter === 'number' && payload.nextIdCounter > 0
            ? Math.max(payload.nextIdCounter, computedNext)
            : computedNext;
        nextIdCounterRef.current = nextId;
        setHistoryItems(conversations);
        const storedActive = payload.activeConversationId;
        if (storedActive && conversations.some((item) => item.id === storedActive)) {
          setActiveConversationId(storedActive);
        } else {
          setActiveConversationId(conversations[0]?.id ?? null);
        }
      }
    } finally {
      setHistoryLoaded(true);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadHistory();
      return () => undefined;
    }, [loadHistory])
  );

  useEffect(() => {
    if (!historyLoaded) {
      return;
    }
    const payload = {
      version: HISTORY_STORAGE_VERSION,
      conversations: historyItems,
      activeConversationId,
      nextIdCounter: nextIdCounterRef.current,
    };
    AsyncStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(payload)).catch((error) => {
      console.warn('[reading] Failed to persist history conversations', error);
    });
  }, [activeConversationId, historyItems, historyLoaded]);

  useEffect(() => {
    return () => {
      playerRef.current?.pause();
      playerRef.current?.remove();
      playerRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (historyLoaded) {
      scrollRef.current?.scrollToEnd({ animated: true });
    }
  }, [historyLoaded, historyItems, activeConversationId]);

  const activeConversation = useMemo(
    () =>
      activeConversationId
        ? historyItems.find((item) => item.id === activeConversationId) ?? null
        : null,
    [activeConversationId, historyItems]
  );

  const ttsMessages = useMemo(() => {
    if (!activeConversation) {
      return [];
    }
    return [...activeConversation.ttsMessages].sort((a, b) => a.createdAt - b.createdAt);
  }, [activeConversation]);

  const ensureActiveConversation = useCallback(() => {
    if (activeConversationIdRef.current) {
      return activeConversationIdRef.current;
    }
    const idNumber = nextIdCounterRef.current++;
    const newId = `conv-${idNumber}`;
    const now = Date.now();
    const nextConversation: HistoryConversation = {
      id: newId,
      title: t('transcription.history.new_conversation', { id: idNumber }),
      transcript: '',
      translation: undefined,
      summary: undefined,
      createdAt: now,
      messages: [],
      assistantMessages: [],
      ttsMessages: [],
    };
    setHistoryItems((prev) => [nextConversation, ...prev]);
    setActiveConversationId(newId);
    return newId;
  }, [t]);

  const updateTtsMessage = useCallback(
    (conversationId: string, messageId: string, updater: (message: TtsMessage) => TtsMessage) => {
      setHistoryItems((prev) =>
        prev.map((item) => {
          if (item.id !== conversationId) {
            return item;
          }
          const index = item.ttsMessages.findIndex((msg) => msg.id === messageId);
          if (index === -1) {
            return item;
          }
          const nextMessages = item.ttsMessages.slice();
          nextMessages[index] = updater(nextMessages[index]);
          return { ...item, ttsMessages: nextMessages };
        })
      );
    },
    []
  );

  const removeTtsMessage = useCallback((conversationId: string, messageId: string) => {
    pendingIdsRef.current.delete(messageId);
    setHistoryItems((prev) =>
      prev.map((item) => {
        if (item.id !== conversationId) {
          return item;
        }
        return {
          ...item,
          ttsMessages: item.ttsMessages.filter((msg) => msg.id !== messageId),
        };
      })
    );
  }, []);

  const appendTtsMessage = useCallback((conversationId: string, message: TtsMessage) => {
    setHistoryItems((prev) =>
      prev.map((item) =>
        item.id === conversationId
          ? { ...item, ttsMessages: [...item.ttsMessages, message] }
          : item
      )
    );
  }, []);

  const playAudio = useCallback(
    async (uri: string) => {
      try {
        playerRef.current?.pause();
        playerRef.current?.remove();
        const player = createAudioPlayer({ uri });
        playerRef.current = player;
        player.play();
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        Alert.alert(t('reading.errors.playback_failed', { message }));
      }
    },
    [t]
  );

  const generateAndPlay = useCallback(
    async (conversationId: string, message: TtsMessage) => {
      if (pendingIdsRef.current.has(message.id)) {
        return;
      }
      pendingIdsRef.current.add(message.id);
      updateTtsMessage(conversationId, message.id, (prev) => ({
        ...prev,
        status: 'pending',
        error: undefined,
      }));
      try {
        const result = await synthesizeSpeech({
          text: message.content,
          settings,
          format: DEFAULT_AUDIO_FORMAT,
          voice: settings.ttsVoice?.trim() || undefined,
          prompt: settings.ttsPrompt?.trim() || undefined,
        });
        const audioUri = await persistAudioBuffer(
          result.audio,
          conversationId,
          message.id,
          result.format,
          result.mimeType
        );
        updateTtsMessage(conversationId, message.id, (prev) => ({
          ...prev,
          status: 'ready',
          audioUri,
          audioFormat: result.format,
          audioMimeType: result.mimeType,
          voice: result.voice,
          model: result.model,
          error: undefined,
        }));
        await playAudio(audioUri);
      } catch (error) {
        const messageText = error instanceof Error ? error.message : String(error);
        updateTtsMessage(conversationId, message.id, (prev) => ({
          ...prev,
          status: 'failed',
          error: messageText,
        }));
        Alert.alert(t('reading.errors.synthesis_failed', { message: messageText }));
      } finally {
        pendingIdsRef.current.delete(message.id);
      }
    },
    [playAudio, settings, t, updateTtsMessage]
  );

  const handleReplay = useCallback(
    async (message: TtsMessage) => {
      if (!activeConversation) {
        return;
      }
      const cached = await resolveCachedAudioUri(message.audioUri);
      if (cached) {
        await playAudio(cached);
        return;
      }
      await generateAndPlay(activeConversation.id, message);
    },
    [activeConversation, generateAndPlay, playAudio]
  );

  const handleDismissContextMenu = useCallback(() => {
    setContextMenu(null);
    messageLongPressRef.current = null;
  }, []);

  const handleMessageMenu = useCallback(
    (message: TtsMessage, anchor?: ContextMenuAnchor) => {
      if (!activeConversation) {
        return;
      }
      messageLongPressRef.current = message.id;
      const actions: ContextMenuAction[] = [
        {
          label: t('reading.actions.copy'),
          onPress: () => {
            void Clipboard.setStringAsync(message.content);
          },
        },
        {
          label: t('reading.actions.delete'),
          variant: 'destructive',
          onPress: () => {
            removeTtsMessage(activeConversation.id, message.id);
          },
        },
        {
          label: t('common.actions.cancel'),
          variant: 'cancel',
        },
      ];

      setContextMenu({
        title: t('reading.actions.title'),
        actions,
        anchor,
      });
    },
    [activeConversation, removeTtsMessage, t]
  );

  const handleSend = useCallback(async () => {
    const trimmed = draft.trim();
    if (!trimmed) {
      return;
    }
    const conversationId = ensureActiveConversation();
    const message: TtsMessage = {
      id: createTtsMessageId(),
      content: trimmed,
      createdAt: Date.now(),
      status: 'pending',
    };
    setDraft('');
    appendTtsMessage(conversationId, message);
    await generateAndPlay(conversationId, message);
  }, [appendTtsMessage, draft, ensureActiveConversation, generateAndPlay]);

  return (
    <AppScreen title={t('reading.title')} subtitle={t('reading.subtitle')} scroll={false}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        className="min-h-0 flex-1">
        <View className="min-h-0 flex-1 gap-4">
          <AppCard
            icon="volume-high"
            title={t('reading.input.title')}
            className="flex-shrink-0"
            bodyClassName="gap-4">
            <TextField className="gap-2">
              <Input
                autoCapitalize="none"
                autoCorrect={false}
                className="min-h-28"
                multiline
                onChangeText={setDraft}
                onSubmitEditing={handleSend}
                placeholder={t('reading.input.placeholder')}
                returnKeyType="send"
                textAlignVertical="top"
                value={draft}
                variant="secondary"
              />
            </TextField>
            <View className="flex-row items-center justify-end gap-3">
              <Button
                accessibilityLabel={t('assistant.accessibility.send_input')}
                isDisabled={!draft.trim()}
                onPress={handleSend}
                variant="primary">
                <AppIcon name="volume-high" size={16} className="text-accent-foreground" />
                <Button.Label>{t('navigation.tabs.reading')}</Button.Label>
              </Button>
            </View>
          </AppCard>

        <ScrollView
          ref={scrollRef}
          className="min-h-0 flex-1"
          contentContainerStyle={styles.scrollContent}
          keyboardDismissMode="on-drag"
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {ttsMessages.length === 0 ? (
            <HeroEmptyState className="flex-1 rounded-3xl border border-dashed border-border bg-surface p-6">
              <HeroEmptyState.Header>
                <HeroEmptyState.Media variant="icon">
                  <AppIcon name="volume-high" size={22} className="text-muted" />
                </HeroEmptyState.Media>
                <HeroEmptyState.Title>{t('reading.empty.title')}</HeroEmptyState.Title>
                <HeroEmptyState.Description>{t('reading.empty.body')}</HeroEmptyState.Description>
              </HeroEmptyState.Header>
            </HeroEmptyState>
          ) : (
            ttsMessages.map((message) => {
              const statusText =
                message.status === 'pending'
                ? t('reading.status.generating')
                : message.status === 'failed'
                    ? message.error || t('reading.status.failed')
                    : '';
              return (
                <Pressable
                  key={message.id}
                  onPress={() => {
                    if (messageLongPressRef.current === message.id) {
                      messageLongPressRef.current = null;
                      return;
                    }
                    void handleReplay(message);
                  }}
                  onLongPress={
                    isDesktopApp
                      ? undefined
                      : () => handleMessageMenu(message)
                  }
                  onPointerDown={(event) => {
                    if (!isDesktopApp) {
                      return;
                    }
                    if (event.nativeEvent.button === 2) {
                      event.preventDefault();
                      const { pageX, pageY, clientX, clientY } = event.nativeEvent as {
                        pageX?: number;
                        pageY?: number;
                        clientX?: number;
                        clientY?: number;
                      };
                      handleMessageMenu(message, {
                        x: typeof pageX === 'number' ? pageX : clientX ?? 0,
                        y: typeof pageY === 'number' ? pageY : clientY ?? 0,
                      });
                    }
                  }}
                  delayLongPress={isDesktopApp ? undefined : 250}
                  disabled={message.status === 'pending'}
                  className="rounded-2xl"
                  style={({ pressed }) => [pressed && message.status !== 'pending' && styles.messagePressed]}
                >
                  <Card className="border border-border bg-surface">
                    <Card.Body className="gap-3">
                    <View className="flex-row items-start justify-between gap-3">
                      <View className="min-w-0 flex-1 gap-2">
                        <Text className="leading-6 text-foreground">
                          {message.content}
                        </Text>
                        {message.voice || message.model ? (
                          <Text type="body-xs" color="muted" numberOfLines={1}>
                            {[message.voice, message.model].filter(Boolean).join(' · ')}
                          </Text>
                        ) : null}
                      </View>
                      <View className="size-9 items-center justify-center rounded-xl bg-surface-secondary">
                        {message.status === 'pending' ? (
                          <Spinner size="sm" />
                        ) : (
                          <AppIcon
                            name={message.status === 'failed' ? 'circle-info' : 'volume-high'}
                            size={15}
                            className={message.status === 'failed' ? 'text-danger' : 'text-accent'}
                          />
                        )}
                      </View>
                    </View>
                    {statusText ? (
                      <Text
                        type="body-xs"
                        className={message.status === 'failed' ? 'text-danger' : 'text-muted'}>
                        {statusText}
                      </Text>
                    ) : null}
                    </Card.Body>
                  </Card>
                </Pressable>
              );
            })
          )}
        </ScrollView>
        </View>
      </KeyboardAvoidingView>
      <ContextMenu
        visible={Boolean(contextMenu)}
        title={contextMenu?.title}
        actions={contextMenu?.actions ?? []}
        anchor={contextMenu?.anchor}
        onRequestClose={handleDismissContextMenu}
      />
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    flexGrow: 1,
    gap: 12,
    paddingBottom: 8,
  },
  messagePressed: {
    opacity: 0.85,
  },
});
