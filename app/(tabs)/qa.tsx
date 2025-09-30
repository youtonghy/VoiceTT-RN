import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { RecordingToggle } from '@/components/recording-toggle';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MarkdownText } from '@/components/markdown-text';
import { useSettings } from '@/contexts/settings-context';
import { useTranscription } from '@/contexts/transcription-context';
import { useThemeColor } from '@/hooks/use-theme-color';
import { extractTranscriptQuestions } from '@/services/qa';
import { TranscriptionMessage, TranscriptQaItem } from '@/types/transcription';
import type { AppSettings } from '@/types/settings';

type QaStatus = 'idle' | 'loading' | 'ready' | 'failed';

interface MessageQaState {
  transcript: string;
  processedLength: number;
  status: QaStatus;
  items: TranscriptQaItem[];
  error?: string;
  updatedAt: number;
}

function resolveMessageTitle(message: TranscriptionMessage, fallback: string): string {
  const trimmed = typeof message.title === 'string' ? message.title.trim() : '';
  return trimmed || fallback;
}

function hashString(value: string): string {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    const char = value.charCodeAt(index);
    hash = (hash << 5) - hash + char;
    hash |= 0;
  }
  return hash.toString(16);
}

function createSettingsSignature(settings: AppSettings): string {
  const prompt = (settings.qaPrompt || '').trim();
  const openaiModel = settings.credentials.openaiQaModel?.trim() || '';
  const geminiModel = settings.credentials.geminiQaModel?.trim() || '';
  const baseUrl = settings.credentials.openaiBaseUrl?.trim() || '';
  return hashString(
    [settings.qaEngine || '', prompt, openaiModel, geminiModel, baseUrl].join('|')
  );
}

type CachedQaEntry = {
  transcript: string;
  items: TranscriptQaItem[];
  processedLength: number;
  updatedAt: number;
};

function buildQaCacheKey(message: TranscriptionMessage, signature: string): string {
  return `${signature}:${message.createdAt}:${message.id}`;
}

function mergeQaItems(existing: TranscriptQaItem[], incoming: TranscriptQaItem[]): TranscriptQaItem[] {
  if (incoming.length === 0) {
    return existing;
  }
  if (existing.length === 0) {
    return incoming;
  }

  const merged = existing.slice();
  const indexByKey = new Map<string, number>();

  merged.forEach((item, index) => {
    const key = item.question.trim().toLowerCase();
    if (key) {
      indexByKey.set(key, index);
    }
  });

  incoming.forEach((item) => {
    const key = item.question.trim().toLowerCase();
    if (key && indexByKey.has(key)) {
      merged[indexByKey.get(key)!] = item;
    } else {
      if (key) {
        indexByKey.set(key, merged.length);
      }
      merged.push(item);
    }
  });

  return merged;
}

export default function QaScreen() {
  const { t } = useTranslation();
  const { settings } = useSettings();
  const { messages, updateMessageQa } = useTranscription();
  const backgroundColor = useThemeColor({}, 'background');
  const cardLight = '#f8fafc';
  const cardDark = '#0f172a';
  const indicatorColor = useThemeColor({ light: '#0f172a', dark: '#e2e8f0' }, 'text');

  const [qaState, setQaState] = useState<Record<number, MessageQaState>>({});
  const qaStateRef = useRef<Record<number, MessageQaState>>({});
  const qaCacheRef = useRef<Map<string, CachedQaEntry>>(new Map());
  const controllersRef = useRef<Map<number, AbortController>>(new Map());
  const scrollRef = useRef<ScrollView | null>(null);

  useEffect(() => {
    qaStateRef.current = qaState;
  }, [qaState]);

  const settingsSignature = useMemo(() => createSettingsSignature(settings), [settings]);

  const qaEntries = useMemo(() => {
    return messages
      .filter((message) => message.status === 'completed' && typeof message.transcript === 'string' && message.transcript.trim())
      .map((message) => ({
        message,
        state: qaState[message.id],
      }))
      .sort((a, b) => a.message.createdAt - b.message.createdAt);
  }, [messages, qaState]);

  const anyLoading = useMemo(
    () => qaEntries.some((entry) => entry.state && entry.state.status === 'loading'),
    [qaEntries]
  );

  useEffect(() => {
    if (qaEntries.length > 0) {
      scrollRef.current?.scrollToEnd({ animated: true });
    }
  }, [qaEntries]);

  useEffect(() => {
    const controllers = controllersRef.current;
    return () => {
      controllers.forEach((controller) => controller.abort());
      controllers.clear();
    };
  }, []);

  useEffect(() => {
    controllersRef.current.forEach((controller) => controller.abort());
    controllersRef.current.clear();
    qaCacheRef.current.clear();
    setQaState({});
  }, [
    settings.qaEngine,
    settings.qaPrompt,
    settings.credentials.openaiQaModel,
    settings.credentials.geminiQaModel,
    settings.credentials.openaiApiKey,
    settings.credentials.geminiApiKey,
    settings.credentials.openaiBaseUrl,
    settingsSignature,
  ]);

  useEffect(() => {
    const activeIds = new Set<number>();
    const cache = qaCacheRef.current;

    messages.forEach((message) => {
      if (message.status !== 'completed') {
        return;
      }

      const rawTranscript = typeof message.transcript === 'string' ? message.transcript : '';
      const transcript = rawTranscript.trim();
      if (!transcript) {
        return;
      }

      const transcriptHash = hashString(transcript);
      const persistedItems = Array.isArray(message.qaItems) ? message.qaItems : [];
      const persistedProcessedLengthRaw = message.qaProcessedLength;
      const persistedProcessedLength =
        typeof persistedProcessedLengthRaw === 'number' && Number.isFinite(persistedProcessedLengthRaw)
          ? Math.min(persistedProcessedLengthRaw, transcript.length)
          : transcript.length;
      const hasPersistedQa =
        persistedItems.length > 0 &&
        message.qaSettingsSignature === settingsSignature &&
        message.qaTranscriptHash === transcriptHash;

      activeIds.add(message.id);
      const previous = qaStateRef.current[message.id];

      const persistQaResult = (items: TranscriptQaItem[], processedLength: number) => {
        const normalizedLength = Math.max(0, Math.min(processedLength, transcript.length));
        updateMessageQa(message.id, {
          items,
          processedLength: normalizedLength,
          transcriptHash,
          settingsSignature,
        });
      };

      if (previous && previous.transcript === transcript && (previous.status === 'loading' || previous.status === 'ready')) {
        return;
      }

      const cacheKey = buildQaCacheKey(message, settingsSignature);
      const cached = cache.get(cacheKey);
      const cachedTranscript = cached?.transcript ?? '';
      const previousTranscript =
        previous?.transcript ?? (cachedTranscript || (hasPersistedQa ? transcript : ''));
      const previousItems =
        previous?.items ?? cached?.items ?? (hasPersistedQa ? persistedItems : []);
      const previousProcessedLength =
        previous?.processedLength ??
        cached?.processedLength ??
        (hasPersistedQa ? persistedProcessedLength : previousTranscript ? previousTranscript.length : 0);

      if (!previous && !cached && hasPersistedQa) {
        const processedLength = persistedProcessedLength;
        setQaState((prevState) => ({
          ...prevState,
          [message.id]: {
            transcript,
            processedLength,
            status: 'ready',
            items: persistedItems,
            error: undefined,
            updatedAt: Date.now(),
          },
        }));
        cache.set(cacheKey, {
          transcript,
          items: persistedItems.map((item) => ({ ...item })),
          processedLength,
          updatedAt: Date.now(),
        });
        persistQaResult(persistedItems, processedLength);
        return;
      }

      if (!previous && cached && cachedTranscript === transcript) {
        const processedLength = cached.processedLength ?? transcript.length;
        setQaState((prevState) => ({
          ...prevState,
          [message.id]: {
            transcript,
            processedLength,
            status: 'ready',
            items: cached.items,
            error: undefined,
            updatedAt: Date.now(),
          },
        }));
        cache.set(cacheKey, {
          transcript,
          items: cached.items.map((item) => ({ ...item })),
          processedLength,
          updatedAt: Date.now(),
        });
        persistQaResult(cached.items, processedLength);
        return;
      }

      const canAppend =
        previousTranscript.length > 0 &&
        transcript.length > previousTranscript.length &&
        transcript.startsWith(previousTranscript);

      const segmentTranscript = canAppend ? transcript.slice(previousTranscript.length).trim() : transcript;

      if (canAppend && !segmentTranscript) {
        const nextState: MessageQaState = {
          transcript,
          processedLength: transcript.length,
          status: previous?.status ?? 'ready',
          items: previousItems,
          error: previous?.error,
          updatedAt: Date.now(),
        };
        setQaState((prevState) => ({
          ...prevState,
          [message.id]: nextState,
        }));
        cache.set(cacheKey, {
          transcript,
          items: previousItems.map((item) => ({ ...item })),
          processedLength: transcript.length,
          updatedAt: Date.now(),
        });
        persistQaResult(previousItems, transcript.length);
        return;
      }

      const controller = new AbortController();
      const existingController = controllersRef.current.get(message.id);
      if (existingController) {
        existingController.abort();
      }
      controllersRef.current.set(message.id, controller);

      setQaState((prevState) => ({
        ...prevState,
        [message.id]: {
          transcript,
          processedLength: canAppend ? previousProcessedLength : 0,
          status: 'loading',
          items: previousItems,
          error: undefined,
          updatedAt: Date.now(),
        },
      }));

      extractTranscriptQuestions({
        transcript: segmentTranscript,
        contextTranscript: transcript,
        settings,
        signal: controller.signal,
      })
        .then((incomingItems) => {
          if (controller.signal.aborted) {
            return;
          }
          const mergedItems = canAppend ? mergeQaItems(previousItems, incomingItems) : incomingItems;
          const processedLength = transcript.length;
          setQaState((prevState) => ({
            ...prevState,
            [message.id]: {
              transcript,
              processedLength,
              status: 'ready',
              items: mergedItems,
              error: undefined,
              updatedAt: Date.now(),
            },
          }));
          cache.set(cacheKey, {
            transcript,
            items: mergedItems.map((item) => ({ ...item })),
            processedLength,
            updatedAt: Date.now(),
          });
          persistQaResult(mergedItems, processedLength);
        })
        .catch((error) => {
          if (controller.signal.aborted) {
            return;
          }
          const messageText =
            error && typeof error === 'object' && 'message' in error && typeof (error as { message?: unknown }).message === 'string'
              ? String((error as { message: string }).message)
              : String(error ?? '');
          setQaState((prevState) => ({
            ...prevState,
            [message.id]: {
              transcript,
              processedLength: canAppend ? previousProcessedLength : 0,
              status: 'failed',
              items: previousItems,
              error: messageText,
              updatedAt: Date.now(),
            },
          }));
        })
        .finally(() => {
          const current = controllersRef.current.get(message.id);
          if (current === controller) {
            controllersRef.current.delete(message.id);
          }
        });
    });

    setQaState((prev) => {
      let changed = false;
      const next: Record<number, MessageQaState> = {};
      Object.keys(prev).forEach((key) => {
        const id = Number(key);
        if (activeIds.has(id)) {
          next[id] = prev[id];
        } else {
          changed = true;
        }
      });
      return changed ? next : prev;
    });

    Array.from(controllersRef.current.entries()).forEach(([id, controller]) => {
      if (!activeIds.has(id)) {
        controller.abort();
        controllersRef.current.delete(id);
      }
    });
  }, [messages, settings, settingsSignature, updateMessageQa]);

  const safeAreaStyle = [styles.safeArea, { backgroundColor }];

  return (
    <SafeAreaView style={safeAreaStyle} edges={['top', 'left', 'right']}>
      <View style={styles.container}>
        <View style={styles.header}>
          <ThemedText type="title" style={styles.headerTitle} lightColor="#0f172a" darkColor="#e2e8f0">
            {t('qa.title')}
          </ThemedText>
          <ThemedText style={styles.headerCaption} lightColor="#475569" darkColor="#94a3b8">
            {t('qa.subtitle')}
          </ThemedText>
        </View>
        <View style={styles.toggleContainer}>
          <RecordingToggle />
        </View>
        {anyLoading ? (
          <View style={styles.statusRow}>
            <ActivityIndicator size="small" color={indicatorColor} style={styles.statusSpinner} />
            <ThemedText style={styles.statusText} lightColor="#1e293b" darkColor="#e2e8f0">
              {t('qa.status.analyzing')}
            </ThemedText>
          </View>
        ) : null}
        <ScrollView
          ref={scrollRef}
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
        >
          {qaEntries.length === 0
            ? (
              <ThemedView lightColor="rgba(148, 163, 184, 0.12)" darkColor="rgba(15, 23, 42, 0.7)" style={styles.emptyCard}>
                <ThemedText style={styles.emptyTitle} lightColor="#0f172a" darkColor="#e2e8f0">
                  {t('qa.empty.title')}
                </ThemedText>
                <ThemedText style={styles.emptyBody} lightColor="#475569" darkColor="#94a3b8">
                  {t('qa.empty.body')}
                </ThemedText>
              </ThemedView>
            )
            : qaEntries.map(({ message, state }) => {
                const hasState = !!state;
                const items = state?.items ?? [];
                const status = state?.status ?? 'idle';
                const segmentTitle = resolveMessageTitle(
                  message,
                  t('qa.entry.default_title', { id: message.id })
                );
                const cardKey = String(message.id);
                return (
                  <ThemedView
                    key={cardKey}
                    lightColor={cardLight}
                    darkColor={cardDark}
                    style={styles.entryCard}>
                    <ThemedText style={styles.entryTitle} lightColor="#0f172a" darkColor="#e2e8f0">
                      {t('qa.entry.label', { title: segmentTitle })}
                    </ThemedText>
                    {!hasState || status === 'loading' ? (
                      <View style={styles.entryRow}>
                        <ActivityIndicator size="small" color={indicatorColor} />
                        <ThemedText style={styles.entryStatus} lightColor="#1e293b" darkColor="#e2e8f0">
                          {t('qa.status.analyzing')}
                        </ThemedText>
                      </View>
                    ) : null}
                    {hasState && status === 'failed' && state?.error ? (
                      <ThemedText style={styles.entryError} lightColor="#b91c1c" darkColor="#f87171">
                        {t('qa.entry.error', { message: state.error })}
                      </ThemedText>
                    ) : null}
                    {hasState && status === 'ready' && items.length === 0 ? (
                      <ThemedText style={styles.entryPlaceholder} lightColor="#475569" darkColor="#94a3b8">
                        {t('qa.entry.no_questions')}
                      </ThemedText>
                    ) : null}
                    {items.map((item, index) => (
                      <View key={cardKey + '-' + index} style={styles.qaItem}>
                        <View style={styles.qaRow}>
                          <ThemedText style={styles.qaLabel} lightColor="#0284c7" darkColor="#38bdf8">
                            {t('qa.labels.question')}
                          </ThemedText>
                          <ThemedText style={styles.qaContent} lightColor="#0f172a" darkColor="#e2e8f0">
                            {item.question}
                          </ThemedText>
                        </View>
                        <View style={styles.qaRow}>
                          <ThemedText style={styles.qaLabel} lightColor="#16a34a" darkColor="#4ade80">
                            {t('qa.labels.answer')}
                          </ThemedText>
                          <MarkdownText
                            style={styles.qaContent}
                            lightColor="#0f172a"
                            darkColor="#e2e8f0"
                          >
                            {item.answer}
                          </MarkdownText>
                        </View>
                      </View>
                    ))}
                  </ThemedView>
                );
              })}
        </ScrollView>
      </View>
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
    paddingBottom: 24,
    gap: 16,
  },
  header: {
    paddingTop: 12,
    gap: 8,
  },
  headerTitle: {
    fontSize: 26,
    fontWeight: '700',
  },
  headerCaption: {
    fontSize: 14,
    lineHeight: 20,
  },
  toggleContainer: {
    paddingVertical: 12,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  statusSpinner: {
    marginRight: 4,
  },
  statusText: {
    fontSize: 13,
    fontWeight: '500',
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 36,
    gap: 16,
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
  entryCard: {
    borderRadius: 24,
    padding: 20,
    gap: 12,
  },
  entryTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  entryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  entryStatus: {
    fontSize: 14,
    lineHeight: 20,
  },
  entryError: {
    fontSize: 14,
    lineHeight: 20,
  },
  entryPlaceholder: {
    fontSize: 14,
    lineHeight: 20,
  },
  qaItem: {
    gap: 10,
    borderRadius: 18,
    padding: 14,
    backgroundColor: 'rgba(148, 163, 184, 0.12)',
  },
  qaRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  qaLabel: {
    fontSize: 13,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  qaContent: {
    flex: 1,
    fontSize: 15,
    lineHeight: 22,
  },
});

