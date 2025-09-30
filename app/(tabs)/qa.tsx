import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { RecordingToggle } from '@/components/recording-toggle';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useSettings } from '@/contexts/settings-context';
import { useTranscription } from '@/contexts/transcription-context';
import { useThemeColor } from '@/hooks/use-theme-color';
import { extractTranscriptQuestions, TranscriptQaItem } from '@/services/qa';
import { TranscriptionMessage } from '@/types/transcription';

type QaStatus = 'idle' | 'loading' | 'ready' | 'failed';

interface MessageQaState {
  transcript: string;
  status: QaStatus;
  items: TranscriptQaItem[];
  error?: string;
  updatedAt: number;
}

function resolveMessageTitle(message: TranscriptionMessage, fallback: string): string {
  const trimmed = typeof message.title === 'string' ? message.title.trim() : '';
  return trimmed || fallback;
}

export default function QaScreen() {
  const { t } = useTranslation();
  const { settings } = useSettings();
  const { messages } = useTranscription();
  const backgroundColor = useThemeColor({}, 'background');
  const cardLight = '#f8fafc';
  const cardDark = '#0f172a';
  const indicatorColor = useThemeColor({ light: '#0f172a', dark: '#e2e8f0' }, 'text');

  const [qaState, setQaState] = useState<Record<number, MessageQaState>>({});
  const qaStateRef = useRef<Record<number, MessageQaState>>({});
  const controllersRef = useRef<Map<number, AbortController>>(new Map());

  useEffect(() => {
    qaStateRef.current = qaState;
  }, [qaState]);

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
    setQaState({});
  }, [
    settings.qaEngine,
    settings.qaQuestionPrompt,
    settings.qaAnswerPrompt,
    settings.credentials.openaiQaModel,
    settings.credentials.geminiQaModel,
    settings.credentials.openaiApiKey,
    settings.credentials.geminiApiKey,
    settings.credentials.openaiBaseUrl,
  ]);

  useEffect(() => {
    const activeIds = new Set<number>();

    messages.forEach((message) => {
      if (message.status !== 'completed') {
        return;
      }
      const transcript = typeof message.transcript === 'string' ? message.transcript.trim() : '';
      if (!transcript) {
        return;
      }
      activeIds.add(message.id);
      const previous = qaStateRef.current[message.id];
      if (previous && previous.transcript === transcript && (previous.status === 'loading' || previous.status === 'ready')) {
        return;
      }
      const controller = new AbortController();
      const previousItems = previous?.items ?? [];
      const existingController = controllersRef.current.get(message.id);
      if (existingController) {
        existingController.abort();
      }
      controllersRef.current.set(message.id, controller);
      setQaState((prev) => ({
        ...prev,
        [message.id]: {
          transcript,
          status: 'loading',
          items: previousItems,
          error: undefined,
          updatedAt: Date.now(),
        },
      }));
      extractTranscriptQuestions({ transcript, settings, signal: controller.signal })
        .then((items) => {
          if (controller.signal.aborted) {
            return;
          }
          setQaState((prev) => ({
            ...prev,
            [message.id]: {
              transcript,
              status: 'ready',
              items,
              error: undefined,
              updatedAt: Date.now(),
            },
          }));
        })
        .catch((error) => {
          if (controller.signal.aborted) {
            return;
          }
          const messageText =
            error && typeof error === 'object' && 'message' in error && typeof (error as { message?: unknown }).message === 'string'
              ? String((error as { message: string }).message)
              : String(error ?? '');
          setQaState((prev) => ({
            ...prev,
            [message.id]: {
              transcript,
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
  }, [messages, settings]);

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
        <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
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
                          <ThemedText style={styles.qaContent} lightColor="#0f172a" darkColor="#e2e8f0">
                            {item.answer}
                          </ThemedText>
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



