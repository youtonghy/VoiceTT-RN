import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, ScrollView, StyleSheet, View } from 'react-native';
import { Button, Surface, Text } from 'heroui-native';

import { MarkdownText } from '@/components/markdown-text';
import { RecordingToggle } from '@/components/recording-toggle';
import { AppCard, AppIcon, AppScreen } from '@/components/native/app-shell';
import { useSettings } from '@/contexts/settings-context';
import { useTranscription } from '@/contexts/transcription-context';
import { extractTranscriptQuestions } from '@/services/qa';
import type { AppSettings } from '@/types/settings';
import { TranscriptionMessage, TranscriptQaItem } from '@/types/transcription';

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

  const [manualRunVersion, setManualRunVersion] = useState(0);
  const manualTargetsRef = useRef<Set<number>>(new Set());
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

  const handleManualRun = useCallback(() => {
    const targets = new Set<number>();
    messages.forEach((message) => {
      if (message.status !== 'completed') {
        return;
      }
      if (message.qaAutoEnabled === true) {
        return;
      }
      const transcript = typeof message.transcript === 'string' ? message.transcript.trim() : '';
      if (!transcript) {
        return;
      }
      targets.add(message.id);
    });
    manualTargetsRef.current = targets;
    if (targets.size === 0) {
      return;
    }
    setManualRunVersion((prev) => prev + 1);
  }, [messages]);

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
    const manualTargets = manualTargetsRef.current;

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

      const autoQaEnabled = message.qaAutoEnabled === true;
      const shouldManualRun = !autoQaEnabled && manualTargets.has(message.id);
      if (shouldManualRun) {
        manualTargets.delete(message.id);
      }

      if (previous && previous.transcript === transcript) {
        if (!shouldManualRun && previous.status === 'ready') {
          return;
        }
        if (previous.status === 'loading') {
          return;
        }
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

      if (!shouldManualRun && !previous && !cached && hasPersistedQa) {
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

      if (!shouldManualRun && !previous && cached && cachedTranscript === transcript) {
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

      if (!autoQaEnabled && !shouldManualRun) {
        const existingController = controllersRef.current.get(message.id);
        if (existingController) {
          existingController.abort();
          controllersRef.current.delete(message.id);
        }
        const previousStatus = previous?.status;
        const nextStatus: QaStatus = previousItems.length > 0
          ? 'ready'
          : previousStatus === 'failed'
            ? 'failed'
            : 'idle';
        const nextError = nextStatus === 'failed' ? previous?.error : undefined;
        setQaState((prevState) => ({
          ...prevState,
          [message.id]: {
            transcript,
            processedLength: previousProcessedLength,
            status: nextStatus,
            items: previousItems,
            error: nextError,
            updatedAt: Date.now(),
          },
        }));
        return;
      }

      const canAppend = !shouldManualRun &&
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

      const initialProcessedLength = canAppend ? previousProcessedLength : 0;

      setQaState((prevState) => ({
        ...prevState,
        [message.id]: {
          transcript,
          processedLength: initialProcessedLength,
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
          const shouldMerge = canAppend;
          const mergedItems = shouldMerge ? mergeQaItems(previousItems, incomingItems) : incomingItems;
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
              processedLength: initialProcessedLength,
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

    manualTargets.forEach((id) => {
      if (!activeIds.has(id)) {
        manualTargets.delete(id);
      }
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

  }, [manualRunVersion, messages, settings, settingsSignature, updateMessageQa]);

  return (
    <AppScreen title={t('qa.title')} subtitle={t('qa.subtitle')} scroll={false}>
      <View className="min-h-0 flex-1 gap-4">
        <AppCard className="flex-shrink-0" bodyClassName="gap-3">
          <View className="flex-row items-center gap-3">
            <View className="min-w-0 flex-1">
              <RecordingToggle qaAutoEnabled variant="full" />
            </View>
            <Button
              accessibilityLabel={t('qa.manual_button.accessibility')}
              isDisabled={qaEntries.length === 0 || anyLoading}
              onPress={handleManualRun}
              size="lg"
              variant="secondary">
              <AppIcon name="circle-question" size={17} className="text-foreground" />
              <Button.Label numberOfLines={1}>{t('qa.manual_button.label')}</Button.Label>
            </Button>
          </View>
          {anyLoading ? (
            <View className="flex-row items-center gap-2 rounded-xl bg-surface-secondary px-3 py-2">
              <ActivityIndicator size="small" />
              <Text type="body-sm" color="muted" weight="semibold">
              {t('qa.status.analyzing')}
              </Text>
            </View>
          ) : null}
        </AppCard>
        <ScrollView
          ref={scrollRef}
          className="min-h-0 flex-1"
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {qaEntries.length === 0
            ? (
              <View className="flex-1 items-center justify-center gap-3 px-8 py-12">
                <View className="size-14 items-center justify-center rounded-2xl bg-surface-secondary">
                  <AppIcon name="circle-question" size={24} className="text-muted" />
                </View>
                <Text weight="semibold" align="center">
                  {t('qa.empty.title')}
                </Text>
                <Text type="body-sm" color="muted" align="center">
                  {t('qa.empty.body')}
                </Text>
              </View>
            )
            : qaEntries.map(({ message, state }) => {
                const hasState = !!state;
                const items = state?.items ?? [];
                const status = state?.status ?? 'idle';
                const autoQaEnabled = message.qaAutoEnabled === true;
                const segmentTitle = resolveMessageTitle(
                  message,
                  t('qa.entry.default_title', { id: message.id })
                );
                const cardKey = String(message.id);
                return (
                  <Surface
                    key={cardKey}
                    variant="default"
                    className="gap-3 rounded-2xl border border-border p-4">
                    <View className="flex-row items-start justify-between gap-3">
                      <View className="min-w-0 flex-1 gap-1">
                        <Text weight="semibold" numberOfLines={1}>
                          {segmentTitle}
                        </Text>
                      </View>
                      {status === 'loading' ? <ActivityIndicator size="small" /> : null}
                    </View>
                    {!hasState || status === 'loading' ? (
                      <Text type="body-sm" color="muted">
                          {t('qa.status.analyzing')}
                      </Text>
                    ) : null}
                    {hasState && status === 'failed' && state?.error ? (
                      <Text type="body-sm" className="text-danger">
                        {t('qa.entry.error', { message: state.error })}
                      </Text>
                    ) : null}
                    {hasState && status === 'idle' && !autoQaEnabled ? (
                      <Text type="body-sm" color="muted">
                        {t('qa.entry.manual_hint')}
                      </Text>
                    ) : null}
                    {hasState && status === 'ready' && items.length === 0 ? (
                      <Text type="body-sm" color="muted">
                        {t('qa.entry.no_questions')}
                      </Text>
                    ) : null}
                    {items.map((item, index) => (
                      <View key={cardKey + '-' + index} className="gap-3 rounded-xl bg-surface-secondary p-3">
                        <View className="flex-row items-start gap-3">
                          <View className="size-7 items-center justify-center rounded-lg bg-background">
                            <Text type="body-xs" weight="bold" className="text-accent">
                            {t('qa.labels.question')}
                            </Text>
                          </View>
                          <Text style={styles.qaContent}>
                            {item.question}
                          </Text>
                        </View>
                        <View className="flex-row items-start gap-3">
                          <View className="size-7 items-center justify-center rounded-lg bg-background">
                            <Text type="body-xs" weight="bold" className="text-success">
                            {t('qa.labels.answer')}
                            </Text>
                          </View>
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
                  </Surface>
                );
              })}
        </ScrollView>
      </View>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  scroll: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: 36,
    gap: 10,
  },
  qaContent: {
    flex: 1,
    fontSize: 15,
    lineHeight: 22,
  },
});
