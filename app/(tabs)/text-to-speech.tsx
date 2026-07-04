import { useFocusEffect } from '@react-navigation/native';
import { createAudioPlayer } from 'expo-audio';
import * as Clipboard from 'expo-clipboard';
import {
    EncodingType,
    deleteAsync,
    documentDirectory,
    getInfoAsync,
    makeDirectoryAsync,
    readDirectoryAsync,
    writeAsStringAsync,
} from 'expo-file-system/legacy';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
    KeyboardAvoidingView,
    Platform,
    Pressable,
    ScrollView,
    StyleSheet,
    View,
} from 'react-native';
import { Button, Card, Input, Spinner, Text, TextField } from 'heroui-native';

import { Alert } from '@/components/app-alert';
import { ContextMenu, type ContextMenuAction, type ContextMenuAnchor } from '@/components/context-menu';
import { AppCard, AppIcon, AppScreen, EmptyState } from '@/components/native/app-shell';
import { useSettings } from '@/contexts/settings-context';
import {
  addHistoryNode,
  createEmptyHistoryTree,
  getHistoryConversation,
  updateHistoryNode,
  type HistoryConversation,
  type HistoryTreeState,
} from '@/services/history-tree';
import { loadHistoryStorage, persistHistoryStorage } from '@/services/history-storage';
import { synthesizeSpeech } from '@/services/tts';
import type { TextToSpeechFormat, TtsMessage } from '@/types/tts';

const DEFAULT_AUDIO_FORMAT: TextToSpeechFormat = 'mp3';
const BASE64_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

type ContextMenuState = {
  title?: string;
  actions: ContextMenuAction[];
  anchor?: ContextMenuAnchor;
};

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

async function deleteCachedAudio(uri?: string): Promise<void> {
  if (!uri || isDataUri(uri) || !documentDirectory || !uri.startsWith(`${documentDirectory}tts/`)) {
    return;
  }
  await deleteAsync(uri, { idempotent: true }).catch((error) => {
    console.warn('[reading] Failed to delete cached audio', error);
  });
}

async function cleanupOrphanTtsAudio(activeUris: Set<string>): Promise<void> {
  if (!documentDirectory) {
    return;
  }
  const root = `${documentDirectory}tts`;
  const info = await getInfoAsync(root);
  if (!info.exists) {
    return;
  }
  const conversationDirs = await readDirectoryAsync(root);
  await Promise.all(
    conversationDirs.map(async (entry) => {
      const directory = `${root}/${entry}`;
      const directoryInfo = await getInfoAsync(directory);
      if (!directoryInfo.exists || !directoryInfo.isDirectory) {
        return;
      }
      const files = await readDirectoryAsync(directory);
      await Promise.all(
        files.map(async (file) => {
          const uri = `${directory}/${file}`;
          if (!activeUris.has(uri)) {
            await deleteCachedAudio(uri);
          }
        })
      );
    })
  );
}

export default function ReadingScreen() {
  const { t } = useTranslation();
  const { settings } = useSettings();
  const isDesktopApp =
    Platform.OS === 'web' &&
    typeof window !== 'undefined' &&
    Boolean((window as { electron?: unknown }).electron);

  const [historyTree, setHistoryTree] = useState<HistoryTreeState>(() => createEmptyHistoryTree());
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const [historyLoadFailed, setHistoryLoadFailed] = useState(false);
  const [historyReadOnly, setHistoryReadOnly] = useState(false);
  const didCleanupAudioRef = useRef(false);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const scrollRef = useRef<ScrollView | null>(null);
  const nextIdCounterRef = useRef(1);
  const nextFolderIdCounterRef = useRef(1);
  const activeFolderIdRef = useRef<string | null>(null);
  const activeConversationIdRef = useRef<string | null>(activeConversationId);
  const playerRef = useRef<ReturnType<typeof createAudioPlayer> | null>(null);
  const pendingIdsRef = useRef<Set<string>>(new Set());
  const messageLongPressRef = useRef<string | null>(null);

  useEffect(() => {
    activeConversationIdRef.current = activeConversationId;
  }, [activeConversationId]);

  const loadHistory = useCallback(async () => {
    try {
      const restored = await loadHistoryStorage();
      setHistoryLoadFailed(restored.loadFailed);
      setHistoryReadOnly(restored.readOnly);
      setHistoryTree(restored.tree);
      nextIdCounterRef.current = restored.nextIdCounter;
      nextFolderIdCounterRef.current = restored.nextFolderIdCounter;
      activeFolderIdRef.current = restored.activeFolderId;
      if (restored.activeConversationId) {
        setActiveConversationId(restored.activeConversationId);
      } else {
        const firstConversation = Object.values(restored.tree.nodes)
          .filter((node): node is HistoryConversation => node.kind === 'conversation')
          .sort((a, b) => b.createdAt - a.createdAt)[0];
        setActiveConversationId(firstConversation?.id ?? null);
      }
    } catch (error) {
      console.warn('[reading] Failed to restore history conversations', error);
      setHistoryLoadFailed(true);
      setHistoryReadOnly(true);
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
    if (!historyLoaded || historyLoadFailed || historyReadOnly) {
      return;
    }
    persistHistoryStorage({
      tree: historyTree,
      activeConversationId,
      activeFolderId: activeFolderIdRef.current,
      nextIdCounter: nextIdCounterRef.current,
      nextFolderIdCounter: nextFolderIdCounterRef.current,
    }).catch((error) => {
      console.warn('[reading] Failed to persist history conversations', error);
    });
  }, [activeConversationId, historyLoadFailed, historyReadOnly, historyTree, historyLoaded]);

  useEffect(() => {
    return () => {
      playerRef.current?.pause();
      playerRef.current?.remove();
      playerRef.current = null;
    };
  }, []);

  const historyItems = useMemo(
    () =>
      Object.values(historyTree.nodes)
        .filter((node): node is HistoryConversation => node.kind === 'conversation')
        .sort((a, b) => b.createdAt - a.createdAt),
    [historyTree]
  );

  useEffect(() => {
    if (historyLoaded) {
      scrollRef.current?.scrollToEnd({ animated: true });
    }
  }, [historyLoaded, historyItems, activeConversationId]);

  const activeConversation = useMemo(
    () =>
      activeConversationId
        ? getHistoryConversation(historyTree, activeConversationId)
        : null,
    [activeConversationId, historyTree]
  );

  const ttsMessages = useMemo(() => {
    if (!activeConversation) {
      return [];
    }
    return [...activeConversation.ttsMessages].sort((a, b) => a.createdAt - b.createdAt);
  }, [activeConversation]);

  useEffect(() => {
    if (!historyLoaded || didCleanupAudioRef.current) {
      return;
    }
    didCleanupAudioRef.current = true;
    const activeUris = new Set<string>();
    Object.values(historyTree.nodes).forEach((node) => {
      if (node.kind !== 'conversation') {
        return;
      }
      node.ttsMessages.forEach((message) => {
        if (message.audioUri && !isDataUri(message.audioUri)) {
          activeUris.add(message.audioUri);
        }
      });
    });
    cleanupOrphanTtsAudio(activeUris).catch((error) => {
      console.warn('[reading] Failed to clean orphan TTS audio', error);
    });
  }, [historyLoaded, historyTree]);

  const ensureActiveConversation = useCallback(() => {
    if (historyLoadFailed || historyReadOnly) {
      return null;
    }
    if (activeConversationIdRef.current) {
      return activeConversationIdRef.current;
    }
    const idNumber = nextIdCounterRef.current++;
    const newId = `conv-${idNumber}`;
    const now = Date.now();
    const nextConversation: HistoryConversation = {
      kind: 'conversation',
      id: newId,
      title: t('transcription.history.new_conversation', { id: idNumber }),
      transcript: '',
      translation: undefined,
      summary: undefined,
      summaryHidden: false,
      parentId: null,
      createdAt: now,
      messages: [],
      assistantMessages: [],
      ttsMessages: [],
    };
    setHistoryTree((prev) => addHistoryNode(prev, nextConversation));
    setActiveConversationId(newId);
    return newId;
  }, [historyLoadFailed, historyReadOnly, t]);

  const updateTtsMessage = useCallback(
    (conversationId: string, messageId: string, updater: (message: TtsMessage) => TtsMessage) => {
      setHistoryTree((prev) => {
        const item = getHistoryConversation(prev, conversationId);
        if (!item) {
          return prev;
        }
        const index = item.ttsMessages.findIndex((msg) => msg.id === messageId);
        if (index === -1) {
          return prev;
        }
        const nextMessages = item.ttsMessages.slice();
        nextMessages[index] = updater(nextMessages[index]);
        return updateHistoryNode(prev, { ...item, ttsMessages: nextMessages });
      });
    },
    []
  );

  const removeTtsMessage = useCallback((conversationId: string, messageId: string) => {
    pendingIdsRef.current.delete(messageId);
    let audioUriToDelete: string | undefined;
    setHistoryTree((prev) => {
      const item = getHistoryConversation(prev, conversationId);
      if (!item) {
        return prev;
      }
      audioUriToDelete = item.ttsMessages.find((msg) => msg.id === messageId)?.audioUri;
      return updateHistoryNode(prev, {
        ...item,
        ttsMessages: item.ttsMessages.filter((msg) => msg.id !== messageId),
      });
    });
    void deleteCachedAudio(audioUriToDelete);
  }, []);

  const appendTtsMessage = useCallback((conversationId: string, message: TtsMessage) => {
    setHistoryTree((prev) => {
      const item = getHistoryConversation(prev, conversationId);
      if (!item) {
        return prev;
      }
      return updateHistoryNode(prev, {
        ...item,
        ttsMessages: [...item.ttsMessages, message],
      });
    });
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
    if (!conversationId) {
      return;
    }
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
    <AppScreen
      title={t('reading.title')}
      subtitle={t('reading.subtitle')}
      contentBottomInset={0}
      scroll={false}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        className="min-h-0 flex-1">
        <View className="min-h-0 flex-1 gap-4">
          {historyLoadFailed || historyReadOnly ? (
            <View className="rounded-lg border border-danger/30 bg-danger/10 px-3 py-2">
              <Text className="text-sm text-danger">
                {historyReadOnly
                  ? t('history_storage.read_only')
                  : t('history_storage.load_failed')}
              </Text>
            </View>
          ) : null}
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
                isDisabled={!draft.trim() || historyLoadFailed || historyReadOnly}
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
            <View className="flex-1 rounded-3xl border border-dashed border-border bg-surface">
              <EmptyState
                icon="volume-high"
                title={t('reading.empty.title')}
                subtitle={t('reading.empty.body')}
              />
            </View>
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
