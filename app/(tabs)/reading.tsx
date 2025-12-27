/**
 * 页面名称：朗读页面 (Reading Screen)
 * 文件路径：app/(tabs)/reading.tsx
 * 功能描述：提供文本转语音 (TTS) 功能，允许用户输入文本并将其转换为语音播放，同时管理朗读历史。
 */

import Ionicons from '@expo/vector-icons/Ionicons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from '@react-navigation/native';
import { createAudioPlayer } from 'expo-audio';
import {
    EncodingType,
    documentDirectory,
    getInfoAsync,
    makeDirectoryAsync,
    writeAsStringAsync,
} from 'expo-file-system/legacy';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import KeyboardStickyInput from '@/KeyboardStickyInput';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useSettings } from '@/contexts/settings-context';
import { useThemeColor } from '@/hooks/use-theme-color';
import { synthesizeSpeech } from '@/services/tts';
import type { TranscriptionMessage } from '@/types/transcription';
import type { TextToSpeechFormat, TtsMessage } from '@/types/tts';

// --- 常量与类型定义 ---
const HISTORY_STORAGE_KEY = '@agents/history-conversations';
const HISTORY_STORAGE_VERSION = 2;
const DEFAULT_AUDIO_FORMAT: TextToSpeechFormat = 'mp3';
const BASE64_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
const INPUT_BOTTOM_INSET = 24;

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

// --- 辅助函数 ---

/**
 * 创建助手消息 ID
 */
function createAssistantMessageId(role: 'user' | 'assistant'): string {
  return `${role}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * 创建 TTS 消息 ID
 */
function createTtsMessageId(): string {
  return `tts-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * 将 ArrayBuffer 转换为 Base64
 */
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

/**
 * 清洗助手消息数据
 */
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
  const backgroundColor = useThemeColor({}, 'background');
  const cardLight = '#f8fafc';
  const cardDark = '#0f172a';
  const subtitleColor = useThemeColor({ light: '#475569', dark: '#94a3b8' }, 'text');
  const placeholderColor = useThemeColor({ light: 'rgba(148, 163, 184, 0.7)', dark: 'rgba(148, 163, 184, 0.5)' }, 'text');
  const inputTextColor = useThemeColor({ light: '#1f2937', dark: '#f8fafc' }, 'text');
  const inputCardBackground = useThemeColor({ light: '#ffffff', dark: 'rgba(15, 23, 42, 0.92)' }, 'background');
  const inputCardBorder = useThemeColor({ light: 'rgba(148, 163, 184, 0.3)', dark: 'rgba(148, 163, 184, 0.35)' }, 'background');
  const sendButtonBg = useThemeColor({ light: '#2563eb', dark: '#3b82f6' }, 'tint');

  const [historyItems, setHistoryItems] = useState<HistoryConversation[]>([]);
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const scrollRef = useRef<ScrollView | null>(null);
  const nextIdCounterRef = useRef(1);
  const activeConversationIdRef = useRef<string | null>(activeConversationId);
  const playerRef = useRef<ReturnType<typeof createAudioPlayer> | null>(null);
  const pendingIdsRef = useRef<Set<string>>(new Set());

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
    <SafeAreaView style={[styles.safeArea, { backgroundColor }]} edges={['top', 'left', 'right']}>
      <View style={styles.container}>
        <View style={styles.header}>
          <ThemedText type="title" style={styles.headerTitle} lightColor="#0f172a" darkColor="#e2e8f0">
            {t('reading.title')}
          </ThemedText>
          <ThemedText style={styles.headerSubtitle} lightColor={subtitleColor} darkColor={subtitleColor}>
            {t('reading.subtitle')}
          </ThemedText>
        </View>
        <ScrollView
          ref={scrollRef}
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          keyboardDismissMode="on-drag"
          keyboardShouldPersistTaps="handled"
        >
          {ttsMessages.length === 0 ? (
            <ThemedView lightColor="rgba(148, 163, 184, 0.12)" darkColor="rgba(15, 23, 42, 0.7)" style={styles.emptyCard}>
              <ThemedText style={styles.emptyTitle} lightColor="#0f172a" darkColor="#e2e8f0">
                {t('reading.empty.title')}
              </ThemedText>
              <ThemedText style={styles.emptyBody} lightColor={subtitleColor} darkColor={subtitleColor}>
                {t('reading.empty.body')}
              </ThemedText>
            </ThemedView>
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
                  onPress={() => handleReplay(message)}
                  disabled={message.status === 'pending'}
                  style={({ pressed }) => [
                    pressed && message.status !== 'pending' && styles.messagePressed,
                  ]}
                >
                  <ThemedView
                    lightColor={cardLight}
                    darkColor={cardDark}
                    style={styles.messageCard}
                  >
                    <ThemedText style={styles.messageText} lightColor="#0f172a" darkColor="#e2e8f0">
                      {message.content}
                    </ThemedText>
                    {statusText ? (
                      <ThemedText
                        style={[
                          styles.messageMeta,
                          message.status === 'failed' && styles.messageMetaError,
                        ]}
                        lightColor="#64748b"
                        darkColor="#94a3b8"
                      >
                        {statusText}
                      </ThemedText>
                    ) : null}
                  </ThemedView>
                </Pressable>
              );
            })
          )}
        </ScrollView>
      </View>
      <KeyboardStickyInput
        containerStyle={styles.inputContainer}
        inputContainerStyle={[
          styles.inputCard,
          { backgroundColor: inputCardBackground, borderColor: inputCardBorder },
        ]}
        inputStyle={[styles.input, { color: inputTextColor }]}
        value={draft}
        onChangeText={setDraft}
        autoCapitalize="none"
        autoCorrect={false}
        enableDesktopSelection
        placeholder={t('reading.input.placeholder')}
        placeholderTextColor={placeholderColor}
        returnKeyType="send"
        layoutBottomInset={INPUT_BOTTOM_INSET}
        onSubmitEditing={handleSend}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('assistant.accessibility.send_input')}
          onPress={handleSend}
          style={({ pressed }) => [
            styles.sendButton,
            { backgroundColor: sendButtonBg },
            pressed && styles.sendButtonPressed,
          ]}
        >
          <Ionicons name="volume-high" size={18} color="#ffffff" />
        </Pressable>
      </KeyboardStickyInput>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  container: {
    flex: 1,
    paddingHorizontal: 20,
    paddingBottom: 16,
    gap: 16,
  },
  header: {
    paddingTop: 12,
    gap: 6,
  },
  headerTitle: {
    fontSize: 26,
    fontWeight: '700',
  },
  headerSubtitle: {
    fontSize: 14,
    lineHeight: 20,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 120,
    gap: 14,
  },
  emptyCard: {
    borderRadius: 24,
    padding: 24,
    alignItems: 'center',
    gap: 8,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    textAlign: 'center',
  },
  emptyBody: {
    textAlign: 'center',
    fontSize: 14,
    lineHeight: 20,
  },
  messageCard: {
    borderRadius: 20,
    padding: 16,
    gap: 10,
  },
  messagePressed: {
    opacity: 0.85,
  },
  messageText: {
    fontSize: 16,
    lineHeight: 22,
  },
  messageMeta: {
    fontSize: 12,
  },
  messageMetaError: {
    color: '#f87171',
  },
  inputContainer: {
    paddingHorizontal: 12,
  },
  inputCard: {
    borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 14,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
  },
  input: {
    fontSize: 16,
    padding: 0,
  },
  sendButton: {
    marginLeft: 12,
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendButtonPressed: {
    opacity: 0.85,
  },
});
