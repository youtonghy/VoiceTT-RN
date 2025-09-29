import AsyncStorage from "@react-native-async-storage/async-storage";
import Ionicons from "@expo/vector-icons/Ionicons";
import {
  ScrollView,
  StyleSheet,
  View,
  Alert,
  useWindowDimensions,
} from "react-native";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useTranslation } from 'react-i18next';
import { SafeAreaView } from "react-native-safe-area-context";
import {
  Button,
  IconButton,
  List,
  Searchbar,
  TextInput as PaperTextInput,
  useTheme,
} from 'react-native-paper';

import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { useSettings } from "@/contexts/settings-context";
import { useTranscription } from "@/contexts/transcription-context";
import { TranscriptionMessage } from "@/types/transcription";
import {
  generateConversationTitle,
  generateConversationSummary,
  generateAssistantReply,
  type AssistantConversationTurn,
} from "@/services/transcription";


type AssistantMessageStatus = "pending" | "succeeded" | "failed";

type AssistantMessage = {
  id: string;
  role: "user" | "assistant";
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
};

function createHistorySeed(): HistoryConversation[] {
  return [];
}


const HISTORY_SEED = createHistorySeed();

const HISTORY_STORAGE_KEY = "@agents/history-conversations";
const HISTORY_STORAGE_VERSION = 2;

type StoredHistoryPayload = {
  version?: number;
  conversations?: unknown;
  activeConversationId?: string | null;
  nextIdCounter?: number;
};

function createAssistantMessageId(role: "user" | "assistant"): string {
  return `${role}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function sanitizeAssistantMessages(raw: unknown): AssistantMessage[] {
  if (!Array.isArray(raw)) {
    return [];
  }
  const sanitized: AssistantMessage[] = [];
  raw.forEach((item) => {
    if (!item || typeof item !== "object") {
      return;
    }
    const candidate = item as Partial<AssistantMessage>;
    if (candidate.role !== "user" && candidate.role !== "assistant") {
      return;
    }
    const textContent = typeof candidate.content === "string" ? candidate.content.trim() : "";
    if (!textContent) {
      return;
    }
    sanitized.push({
      id:
        typeof candidate.id === "string" && candidate.id.trim()
          ? candidate.id
          : createAssistantMessageId(candidate.role),
      role: candidate.role,
      content: textContent,
      createdAt:
        typeof candidate.createdAt === "number" && Number.isFinite(candidate.createdAt)
          ? candidate.createdAt
          : Date.now(),
      status:
        candidate.status === "failed" || candidate.status === "pending"
          ? candidate.status
          : "succeeded",
      error:
        typeof candidate.error === "string" && candidate.error.trim()
          ? candidate.error.trim()
          : undefined,
    });
  });
  return sanitized;
}

function isConversationEmpty(conversation: HistoryConversation): boolean {
  const hasTranscript = conversation.transcript.trim().length > 0;
  const hasTranslation =
    typeof conversation.translation === "string" && conversation.translation.trim().length > 0;
  const hasSummary =
    typeof conversation.summary === "string" && conversation.summary.trim().length > 0;
  const hasMessages = conversation.messages.length > 0;
  const hasAssistantMessages = conversation.assistantMessages.length > 0;
  return !(hasTranscript || hasTranslation || hasSummary || hasMessages || hasAssistantMessages);
}

function sanitizeHistoryConversations(raw: unknown): HistoryConversation[] {
  if (!Array.isArray(raw)) {
    return [];
  }
  const sanitized: HistoryConversation[] = [];
  raw.forEach((item) => {
    if (!item || typeof item !== "object") {
      return;
    }
    const candidate = item as Partial<HistoryConversation>;
    if (typeof candidate.id !== "string" || typeof candidate.title !== "string") {
      return;
    }
    sanitized.push({
      id: candidate.id,
      title: candidate.title,
      transcript: typeof candidate.transcript === "string" ? candidate.transcript : "",
      translation:
        typeof candidate.translation === "string" ? candidate.translation : undefined,
      summary: typeof candidate.summary === "string" ? candidate.summary : undefined,
      createdAt:
        typeof candidate.createdAt === "number" && Number.isFinite(candidate.createdAt)
          ? candidate.createdAt
          : Date.now(),
      messages: Array.isArray(candidate.messages)
        ? candidate.messages
            .filter(
              (message): message is TranscriptionMessage =>
                !!message && typeof message === "object"
            )
            .map((message) => ({ ...message }))
        : [],
      assistantMessages: sanitizeAssistantMessages(candidate.assistantMessages),
    });
  });
  return sanitized;
}

function deriveNextHistoryId(
  conversations: HistoryConversation[],
  fallback: number = 1
): number {
  let next = Math.max(fallback, 1);
  conversations.forEach((item) => {
    if (typeof item.id !== "string") {
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


function RecordingToggle() {
  const { isSessionActive, toggleSession, isRecording } = useTranscription();
  const { t } = useTranslation();
  const theme = useTheme();

  const accessibilityLabel = isSessionActive
    ? t('transcription.accessibility.stop_recording')
    : t('transcription.accessibility.start_recording');

  const label = isSessionActive
    ? isRecording
      ? t('transcription.status.recording')
      : t('transcription.status.processing')
    : t('transcription.controls.start');

  const iconName = !isSessionActive ? 'mic' : isRecording ? 'stop' : 'time';
  const buttonColor = isSessionActive ? theme.colors.error : theme.colors.primary;
  const textColor = isSessionActive ? theme.colors.onError : theme.colors.onPrimary;

  return (
    <Button
      accessibilityLabel={accessibilityLabel}
      mode="contained"
      icon={({ size, color }) => <Ionicons name={iconName as never} size={size} color={color} />}
      onPress={toggleSession}
      buttonColor={buttonColor}
      textColor={textColor}
      contentStyle={styles.recordButtonContent}
      style={styles.recordButton}
      uppercase={false}
      loading={isSessionActive && !isRecording}>
      {label}
    </Button>
  );
}


export default function TranscriptionScreen() {
  const { t, i18n } = useTranslation();
  const theme = useTheme();
  const backgroundColor = theme.colors.background;
  const cardSurface = theme.colors.surfaceContainerHigh;
  const historyItemSurface = theme.colors.surfaceVariant;
  const subtleOnSurface = theme.colors.onSurfaceVariant;
  const assistantAssistantBubbleColor = theme.colors.secondaryContainer;
  const assistantMetaColor = theme.colors.onSurfaceVariant;
  const assistantUserBubbleColor = theme.colors.primary;
  const assistantUserTextColor = theme.colors.onPrimary;
  const { width } = useWindowDimensions();
  const { settings } = useSettings();
  const { messages, error, clearError, stopSession, replaceMessages, isSessionActive } = useTranscription();
  const carouselRef = useRef<ScrollView | null>(null);
  const scrollRef = useRef<ScrollView | null>(null);
  const historyScrollRef = useRef<ScrollView | null>(null);
  const assistantScrollRef = useRef<ScrollView | null>(null);

  const [historyItems, setHistoryItems] = useState<HistoryConversation[]>(() => [...HISTORY_SEED]);
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [assistantDraft, setAssistantDraft] = useState("");
  const [assistantSending, setAssistantSending] = useState(false);
  const historyIdCounter = useRef(Math.max(HISTORY_SEED.length + 1, 1));
  const assistantAbortRef = useRef<AbortController | null>(null);
  const initialCarouselPositionedRef = useRef(false);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(() =>
    HISTORY_SEED.length > 0 ? HISTORY_SEED[0].id : null
  );
  const activeConversationIdRef = useRef<string | null>(activeConversationId);
  const lastLoadedConversationIdRef = useRef<string | null>(null);
  const bootstrappedHistoryRef = useRef(false);
  const [autoTitleTrigger, setAutoTitleTrigger] = useState(0);
  const [autoSummaryTrigger, setAutoSummaryTrigger] = useState(0);
  const autoTitlePendingRef = useRef<{ conversationId: string } | null>(null);
  const autoSummaryPendingRef = useRef<{ conversationId: string } | null>(null);
  const previousSessionActiveRef = useRef(isSessionActive);
  const autoTitleAbortRef = useRef<AbortController | null>(null);
  const autoSummaryAbortRef = useRef<AbortController | null>(null);
  useEffect(() => {
    let isMounted = true;

    const restoreHistory = async () => {
      try {
        const raw = await AsyncStorage.getItem(HISTORY_STORAGE_KEY);
        if (!isMounted || !raw) {
          return;
        }

        let parsed: unknown;
        try {
          parsed = JSON.parse(raw) as unknown;
        } catch (parseError) {
          console.warn("[transcription] Failed to parse stored history conversations", parseError);
          return;
        }

        if (Array.isArray(parsed)) {
          const conversations = sanitizeHistoryConversations(parsed);
          historyIdCounter.current = deriveNextHistoryId(conversations, historyIdCounter.current);
          setHistoryItems(conversations);
          if (conversations.length > 0) {
            setActiveConversationId((prev) =>
              prev && conversations.some((item) => item.id === prev) ? prev : conversations[0].id
            );
          }
          return;
        }

        if (parsed && typeof parsed === "object") {
          const payload = parsed as StoredHistoryPayload;
          const conversations = sanitizeHistoryConversations(payload.conversations ?? []);
          const computedNext = deriveNextHistoryId(conversations, historyIdCounter.current);
          const nextId =
            typeof payload.nextIdCounter === "number" && payload.nextIdCounter > 0
              ? Math.max(payload.nextIdCounter, computedNext)
              : computedNext;
          historyIdCounter.current = nextId;
          setHistoryItems(conversations);
          if (conversations.length > 0) {
            const storedActive = payload.activeConversationId;
            if (storedActive && conversations.some((item) => item.id === storedActive)) {
              setActiveConversationId(storedActive);
            } else {
              setActiveConversationId((prev) =>
                prev && conversations.some((item) => item.id === prev) ? prev : conversations[0].id
              );
            }
          }
        }
      } catch (loadError) {
        console.warn("[transcription] Failed to restore history conversations", loadError);
      } finally {
        if (isMounted) {
          setHistoryLoaded(true);
        }
      }
    };

    restoreHistory();

    return () => {
      isMounted = false;
    };
  }, []);


  useEffect(() => {
    if (error) {
      Alert.alert(t('alerts.recording.title'), error, [{ text: t('common.actions.ok'), onPress: clearError }]);
    }
  }, [clearError, error, t]);

  useEffect(() => {
    if (messages.length > 0) {
      scrollRef.current?.scrollToEnd({ animated: true });
    }
  }, [messages]);

  useEffect(() => {
    const pending = autoTitlePendingRef.current;
    if (!pending) {
      return;
    }
    const targetConversation = historyItems.find((item) => item.id === pending.conversationId);
    if (!targetConversation) {
      return;
    }
    const hasProcessing = targetConversation.messages.some(
      (msg) => msg.status === 'pending' || msg.status === 'transcribing'
    );
    if (hasProcessing) {
      return;
    }
    const transcriptSegments = targetConversation.messages
      .map((msg) => msg.transcript?.trim())
      .filter((segment): segment is string => !!segment && segment.length > 0);
    const transcriptText = transcriptSegments.join('\n').trim();
    if (!transcriptText) {
      autoTitlePendingRef.current = null;
      return;
    }
    const translationSegments = targetConversation.messages
      .map((msg) => msg.translation?.trim())
      .filter((segment): segment is string => !!segment && segment.length > 0);
    const translationText = (translationSegments.length > 0
      ? translationSegments.join('\n').trim()
      : targetConversation.translation?.trim()) || undefined;
    if (autoTitleAbortRef.current) {
      return;
    }
    autoTitlePendingRef.current = null;
    const controller = new AbortController();
    autoTitleAbortRef.current = controller;
    generateConversationTitle(
      transcriptText,
      translationText,
      settings,
      controller.signal
    )
      .then((generatedTitle) => {
        const cleanTitle = generatedTitle.trim();
        if (!cleanTitle) {
          return;
        }
        if (targetConversation.title === cleanTitle) {
          return;
        }
        setHistoryItems((prev) =>
          prev.map((item) =>
            item.id === targetConversation.id ? { ...item, title: cleanTitle } : item
          )
        );
      })
      .catch((err) => {
        if (err instanceof Error && err.name === 'AbortError') {
          return;
        }
        const message = err instanceof Error ? err.message : String(err);
        console.warn('[transcription] Failed to auto-generate conversation title', err);
        Alert.alert(t('alerts.conversation_title.failure'), message);
      })
      .finally(() => {
        autoTitleAbortRef.current = null;
        if (autoTitlePendingRef.current) {
          setAutoTitleTrigger((prev) => prev + 1);
        }
      });
  }, [historyItems, settings, autoTitleTrigger, t]);



  useEffect(() => {
    const pending = autoSummaryPendingRef.current;
    if (!pending) {
      return;
    }
    const targetConversation = historyItems.find((item) => item.id === pending.conversationId);
    if (!targetConversation) {
      return;
    }
    const hasProcessing = targetConversation.messages.some(
      (msg) => msg.status === 'pending' || msg.status === 'transcribing'
    );
    if (hasProcessing) {
      return;
    }
    const transcriptSegments = targetConversation.messages
      .map((msg) => msg.transcript?.trim())
      .filter((segment): segment is string => !!segment && segment.length > 0);
    const transcriptText = transcriptSegments.join('\n').trim();
    if (!transcriptText) {
      autoSummaryPendingRef.current = null;
      return;
    }
    const translationSegments = targetConversation.messages
      .map((msg) => msg.translation?.trim())
      .filter((segment): segment is string => !!segment && segment.length > 0);
    const translationText = (translationSegments.length > 0
      ? translationSegments.join('\n').trim()
      : targetConversation.translation?.trim()) || undefined;
    if (autoSummaryAbortRef.current) {
      return;
    }
    autoSummaryPendingRef.current = null;
    const controller = new AbortController();
    autoSummaryAbortRef.current = controller;
    generateConversationSummary(
      transcriptText,
      translationText,
      settings,
      controller.signal
    )
      .then((generatedSummary) => {
        const cleanSummary = generatedSummary.trim();
        if (!cleanSummary) {
          return;
        }
        setHistoryItems((prev) =>
          prev.map((item) =>
            item.id === targetConversation.id ? { ...item, summary: cleanSummary } : item
          )
        );
      })
      .catch((err) => {
        if (err instanceof Error && err.name === 'AbortError') {
          return;
        }
        const message = err instanceof Error ? err.message : String(err);
        console.warn('[transcription] Failed to auto-generate conversation summary', err);
        Alert.alert(t('alerts.summary.failure'), message);
      })
      .finally(() => {
        autoSummaryAbortRef.current = null;
        if (autoSummaryPendingRef.current) {
          setAutoSummaryTrigger((prev) => prev + 1);
        }
      });
  }, [historyItems, settings, autoSummaryTrigger, t]);



  useEffect(() => {
    if (historyItems.length === 0) {
      if (activeConversationId !== null) {
        setActiveConversationId(null);
      }
      return;
    }
    if (!activeConversationId || !historyItems.some((item) => item.id === activeConversationId)) {
      setActiveConversationId(historyItems[0].id);
    }
  }, [activeConversationId, historyItems]);

  useEffect(() => {
    activeConversationIdRef.current = activeConversationId;
  }, [activeConversationId]);
  useEffect(() => {
    return () => {
      autoTitleAbortRef.current?.abort();
      autoSummaryAbortRef.current?.abort();
      assistantAbortRef.current?.abort();
    };
  }, []);

  useEffect(() => {
    const wasActive = previousSessionActiveRef.current;
    previousSessionActiveRef.current = isSessionActive;
    if (wasActive && !isSessionActive && activeConversationIdRef.current) {
      autoTitlePendingRef.current = { conversationId: activeConversationIdRef.current };
      setAutoTitleTrigger((prev) => prev + 1);
      autoSummaryPendingRef.current = { conversationId: activeConversationIdRef.current };
      setAutoSummaryTrigger((prev) => prev + 1);
    }
  }, [isSessionActive]);

  useEffect(() => {
    const currentActiveId = activeConversationIdRef.current;
    if (!currentActiveId) {
      return;
    }
    setHistoryItems((prev) => {
      const index = prev.findIndex((item) => item.id === currentActiveId);
      if (index === -1) {
        return prev;
      }

      const existing = prev[index];
      const currentMessages = messages;
      let hasDifference = existing.messages.length !== currentMessages.length;
      if (!hasDifference) {
        for (let i = 0; i < existing.messages.length; i += 1) {
          const stored = existing.messages[i];
          const incoming = currentMessages[i];
          if (
            stored.id !== incoming.id ||
            stored.updatedAt !== incoming.updatedAt ||
            stored.status !== incoming.status ||
            stored.transcript !== incoming.transcript ||
            stored.translationStatus !== incoming.translationStatus ||
            stored.translation !== incoming.translation
          ) {
            hasDifference = true;
            break;
          }
        }
      }
      if (!hasDifference) {
        return prev;
      }

      const clonedMessages = currentMessages.map((msg) => ({ ...msg }));
      const transcriptSegments = clonedMessages
        .map((msg) => msg.transcript?.trim())
        .filter((segment): segment is string => !!segment && segment.length > 0);
      const translationSegments = clonedMessages
        .map((msg) => msg.translation?.trim())
        .filter((segment): segment is string => !!segment && segment.length > 0);
      const latestMessage = clonedMessages.length > 0 ? clonedMessages[clonedMessages.length - 1] : null;

      const updatedConversation: HistoryConversation = {
        ...existing,
        messages: clonedMessages,
        transcript: transcriptSegments.join(" "),
        translation: translationSegments.length > 0 ? translationSegments.join(" ") : undefined,
        createdAt: latestMessage ? (latestMessage.updatedAt ?? latestMessage.createdAt) : existing.createdAt,
      };

      if (clonedMessages.length === 0) {
        updatedConversation.transcript = "";
        updatedConversation.translation = undefined;
        updatedConversation.summary = undefined;
      }

      const next = [...prev];
      next[index] = updatedConversation;
      return next;
    });
  }, [messages]);

  const filteredHistory = useMemo(() => {
    const keyword = searchTerm.trim().toLowerCase();
    if (!keyword) {
      return historyItems;
    }
    return historyItems.filter((item) => {
      const haystack = `${item.title} ${item.transcript} ${item.translation ?? ""} ${item.summary ?? ""}`.toLowerCase();
      return haystack.includes(keyword);
    });
  }, [historyItems, searchTerm]);

  const historyGroups = useMemo(() => {
    const sorted = [...filteredHistory].sort((a, b) => b.createdAt - a.createdAt);
    const groups: { key: string; label: string; items: HistoryConversation[] }[] = [];
    let currentGroup: { key: string; label: string; items: HistoryConversation[] } | null = null;

    sorted.forEach((item) => {
      const groupKey = buildDateKey(item.createdAt);
      if (!currentGroup || currentGroup.key !== groupKey) {
        currentGroup = {
          key: groupKey,
          label: formatDateLabel(item.createdAt, i18n.language),
          items: [],
        };
        groups.push(currentGroup);
      }
      currentGroup.items.push(item);
    });

    return groups;
  }, [filteredHistory, i18n.language]);

  const activeConversation = useMemo(
    () =>
      activeConversationId
        ? historyItems.find((item) => item.id === activeConversationId) ?? null
        : null,
    [activeConversationId, historyItems]
  );

  useEffect(() => {
    if (!activeConversation) {
      replaceMessages([]);
      lastLoadedConversationIdRef.current = null;
      return;
    }

    if (lastLoadedConversationIdRef.current === activeConversation.id) {
      return;
    }

    replaceMessages(activeConversation.messages);
    lastLoadedConversationIdRef.current = activeConversation.id;
  }, [activeConversation, replaceMessages]);

  const createConversation = useCallback(
    async ({
      skipStopSession = false,
      suppressScroll = false,
    }: { skipStopSession?: boolean; suppressScroll?: boolean } = {}) => {
      if (!skipStopSession) {
        try {
          await stopSession();
        } catch (sessionError) {
          console.warn(
            "[transcription] stopSession failed before adding conversation",
            sessionError
          );
        }
      }

      const latestConversation = historyItems.length > 0 ? historyItems[0] : null;
      if (latestConversation && isConversationEmpty(latestConversation)) {
        setActiveConversationId(latestConversation.id);
        setSearchTerm("");
        replaceMessages([]);

        if (!suppressScroll) {
          const scrollToTop = () => {
            historyScrollRef.current?.scrollTo({ y: 0, animated: true });
          };
          if (typeof requestAnimationFrame === "function") {
            requestAnimationFrame(scrollToTop);
          } else {
            setTimeout(scrollToTop, 0);
          }
        }

        return latestConversation.id;
      }

      const idNumber = historyIdCounter.current++;
      const newId = `conv-${idNumber}`;
      const now = Date.now();
      const nextConversation: HistoryConversation = {
        id: newId,
        title: t('transcription.history.new_conversation', { id: idNumber }),
        transcript: "",
        translation: undefined,
        summary: undefined,
        createdAt: now,
        messages: [],
        assistantMessages: [],
      };

      setHistoryItems((prev) => [nextConversation, ...prev]);
      setActiveConversationId(newId);
      setSearchTerm("");
      replaceMessages([]);

      if (!suppressScroll) {
        const scrollToTop = () => {
          historyScrollRef.current?.scrollTo({ y: 0, animated: true });
        };
        if (typeof requestAnimationFrame === "function") {
          requestAnimationFrame(scrollToTop);
        } else {
          setTimeout(scrollToTop, 0);
        }
      }

      return newId;
    },
    [historyItems, historyScrollRef, replaceMessages, setActiveConversationId, setHistoryItems, setSearchTerm, stopSession, t]
  );

  const handleAddConversation = useCallback(async () => {
    await createConversation();
  }, [createConversation]);


  useEffect(() => {
    if (!historyLoaded || bootstrappedHistoryRef.current) {
      return;
    }
    bootstrappedHistoryRef.current = true;
    void createConversation({ skipStopSession: true, suppressScroll: true });
  }, [createConversation, historyLoaded]);


  const handleSelectConversation = useCallback(async (conversationId: string) => {
    if (!historyItems.some((item) => item.id === conversationId)) {
      return;
    }
    const targetCarousel = carouselRef.current;
    const scrollToTranscription = () => {
      targetCarousel?.scrollTo({ x: 0, animated: true });
      initialCarouselPositionedRef.current = true;
    };
    if (conversationId === activeConversationId) {
      scrollToTranscription();
      return;
    }
    try {
      await stopSession();
    } catch (sessionError) {
      console.warn("[transcription] stopSession failed before switching conversation", sessionError);
    }
    setActiveConversationId(conversationId);
    scrollToTranscription();
  }, [activeConversationId, historyItems, stopSession]);

  useEffect(() => {
    if (!historyLoaded) {
      return;
    }

    const payload: StoredHistoryPayload = {
      version: HISTORY_STORAGE_VERSION,
      conversations: historyItems,
      activeConversationId,
      nextIdCounter: historyIdCounter.current,
    };

    AsyncStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(payload)).catch(
      (persistError) => {
        console.warn("[transcription] Failed to persist history conversations", persistError);
      }
    );
  }, [activeConversationId, historyItems, historyLoaded]);


  const handleSearchChange = useCallback((text: string) => {
    setSearchTerm(text);
  }, []);

  const handleAssistantChange = useCallback((text: string) => {
    setAssistantDraft(text);
  }, []);

  const handleAssistantSend = useCallback(async () => {
    if (assistantSending) {
      return;
    }
    const trimmed = assistantDraft.trim();
    if (!trimmed) {
      return;
    }
    const conversation = activeConversation;
    if (!conversation) {
      return;
    }

    const conversationId = conversation.id;
    const messageId = createAssistantMessageId('user');
    const userMessage: AssistantMessage = {
      id: messageId,
      role: 'user',
      content: trimmed,
      createdAt: Date.now(),
      status: 'pending',
    };

    setAssistantDraft('');
    setAssistantSending(true);
    setHistoryItems((prev) =>
      prev.map((item) =>
        item.id === conversationId
          ? { ...item, assistantMessages: [...item.assistantMessages, userMessage] }
          : item
      )
    );

    assistantAbortRef.current?.abort();
    const controller = new AbortController();
    assistantAbortRef.current = controller;

    const historyPayload: AssistantConversationTurn[] = conversation.assistantMessages.map((msg) => ({
      role: msg.role,
      content: msg.content,
    }));

    try {
      const reply = await generateAssistantReply({
        transcript: conversation.transcript,
        translation: conversation.translation,
        summary: conversation.summary,
        history: historyPayload,
        userMessage: trimmed,
        settings,
        signal: controller.signal,
      });

      const assistantMessage: AssistantMessage = {
        id: createAssistantMessageId('assistant'),
        role: 'assistant',
        content: reply,
        createdAt: Date.now(),
        status: 'succeeded',
      };

      setHistoryItems((prev) =>
        prev.map((item) => {
          if (item.id !== conversationId) {
            return item;
          }
          const updated = item.assistantMessages.map((msg) =>
            msg.id === messageId ? { ...msg, status: 'succeeded' } : msg
          );
          return {
            ...item,
            assistantMessages: [...updated, assistantMessage],
          };
        })
      );
    } catch (err) {
      const isAbort = err instanceof Error && err.name === 'AbortError';
      const rawMessage = err instanceof Error ? err.message : String(err);
      const displayMessage = rawMessage || t('assistant.errors.send_failed');

      setHistoryItems((prev) =>
        prev.map((item) => {
          if (item.id !== conversationId) {
            return item;
          }
          if (isAbort) {
            return {
              ...item,
              assistantMessages: item.assistantMessages.filter((msg) => msg.id !== messageId),
            };
          }
          return {
            ...item,
            assistantMessages: item.assistantMessages.map((msg) =>
              msg.id === messageId ? { ...msg, status: 'failed', error: displayMessage } : msg
            ),
          };
        })
      );

      if (!isAbort) {
        Alert.alert(t('alerts.assistant.failure'), displayMessage);
      }
    } finally {
      assistantAbortRef.current = null;
      setAssistantSending(false);
    }
  }, [assistantDraft, assistantSending, activeConversation, settings, setHistoryItems, t]);

  const assistantMessages = activeConversation?.assistantMessages ?? [];

  useEffect(() => {
    if (assistantMessages.length === 0) {
      return;
    }
    const scrollToBottom = () => {
      assistantScrollRef.current?.scrollToEnd({ animated: true });
    };
    if (typeof requestAnimationFrame === 'function') {
      requestAnimationFrame(scrollToBottom);
    } else {
      setTimeout(scrollToBottom, 0);
    }
  }, [assistantMessages.length]);
  const assistantHasInput = assistantDraft.trim().length > 0;
  const assistantCanSend = assistantHasInput && !assistantSending;
  const assistantSummary = activeConversation?.summary?.trim() ?? '';
  const assistantSummaryPlaceholder = t('assistant.placeholders.summary');

  const pageWidth = width;


  useEffect(() => {
    if (initialCarouselPositionedRef.current) {
      return;
    }
    if (pageWidth <= 0) {
      return;
    }
    const target = carouselRef.current;
    if (!target) {
      return;
    }
    const scrollToHistory = () => {
      target.scrollTo({ x: pageWidth, animated: false });
      initialCarouselPositionedRef.current = true;
    };
    if (typeof requestAnimationFrame === "function") {
      requestAnimationFrame(scrollToHistory);
    } else {
      setTimeout(scrollToHistory, 0);
    }
  }, [pageWidth]);

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor }]} edges={["top"]}>
      <ThemedView style={styles.container}>
        <View style={styles.topBar}>
          <ThemedText type="title" style={styles.topBarTitle}>
            {t('transcription.sections.live_title')}
          </ThemedText>
        </View>
        <View style={styles.content}>
          <ScrollView
            ref={carouselRef}
            horizontal
            pagingEnabled
            bounces={false}
            showsHorizontalScrollIndicator={false}
            style={styles.carousel}
            contentContainerStyle={styles.carouselContent}>
            <View style={[styles.cardPage, { width: pageWidth }]}>
              <ThemedView style={styles.card} lightColor={cardSurface} darkColor={cardSurface} mode="elevated" elevation={2}>
                <View style={styles.headerRow}>
                  <ThemedText type="subtitle" style={styles.sectionTitle}>
                    {t('transcription.sections.live_content')}
                  </ThemedText>
                  <RecordingToggle />
                </View>
                <View style={styles.dialogueContainer}>
                  <ScrollView
                    ref={scrollRef}
                    style={styles.dialogueScroll}
                    contentContainerStyle={messages.length === 0 ? styles.emptyDialogue : styles.dialogueContent}
                    showsVerticalScrollIndicator={false}
                    nestedScrollEnabled>
                    {messages.length === 0 ? (
                      <ThemedText style={styles.emptyMessage}>
                        {t('transcription.history.placeholder_empty')}
                      </ThemedText>
                    ) : (
                      messages.map((item) => <MessageBubble key={item.id} message={item} />)
                    )}
                  </ScrollView>
                </View>
              </ThemedView>
            </View>
            <View style={[styles.cardPage, { width: pageWidth }]}>
              <ThemedView style={[styles.card, styles.historyCard]} lightColor={cardSurface} darkColor={cardSurface} mode="elevated" elevation={2}>
                <View style={styles.historyHeader}>
                  <ThemedText type="subtitle" style={styles.sectionTitle}>
                    {t('transcription.sections.history_title')}
                  </ThemedText>
                  <View style={styles.historyActions}>
                    <IconButton
                      icon="plus"
                      mode="contained-tonal"
                      accessibilityLabel={t('transcription.history.accessibility.add')}
                      onPress={() => {
                        void handleAddConversation();
                      }}
                    />
                  </View>
                </View>
                <View style={styles.historySearchContainer}>
                  <Searchbar
                    value={searchTerm}
                    onChangeText={handleSearchChange}
                    placeholder={t('transcription.history.search_placeholder')}
                    autoCorrect={false}
                    style={styles.historySearchBar}
                    clearIcon="close"
                    icon="magnify"
                  />
                </View>
                <View style={styles.historyListContainer}>
                  <ScrollView
                    ref={historyScrollRef}
                    style={styles.historyScroll}
                    contentContainerStyle={
                      historyGroups.length === 0 ? styles.historyEmptyContainer : styles.historyScrollContent
                    }
                    showsVerticalScrollIndicator={false}
                    nestedScrollEnabled
                    keyboardShouldPersistTaps="handled">
                    {historyGroups.length === 0 ? (
                      <ThemedText style={styles.historyEmptyText}>
                        {t('transcription.history.placeholder_search_empty')}
                      </ThemedText>
                    ) : (
                      historyGroups.map((group) => (
                        <View key={group.key} style={styles.historyGroup}>
                          <View style={styles.historyDateRow}>
                            <View style={[styles.historyDateLine, { backgroundColor: subtleOnSurface }]} />
                            <ThemedText style={[styles.historyDateLabel, { color: subtleOnSurface }]}>{group.label}</ThemedText>
                            <View style={[styles.historyDateLine, { backgroundColor: subtleOnSurface }]} />
                          </View>
                          {group.items.map((item) => {
                            const isActive = item.id === activeConversationId;
                            return (
                              <List.Item
                                key={item.id}
                                title={item.title}
                                description={formatRecordTime(item.createdAt, i18n.language)}
                                onPress={() => {
                                  void handleSelectConversation(item.id);
                                }}
                                accessibilityLabel={t('transcription.history.accessibility.view_conversation', { title: item.title })}
                                style={[
                                  styles.historyItem,
                                  {
                                    backgroundColor: historyItemSurface,
                                    borderColor: isActive ? theme.colors.primary : 'transparent',
                                  },
                                  isActive && styles.historyItemActive,
                                ]}
                                titleNumberOfLines={1}
                                descriptionNumberOfLines={1}
                                descriptionStyle={[styles.historyItemTime, { color: subtleOnSurface }]}
                                titleStyle={styles.historyItemTitle}
                              />
                            );
                          })}
                        </View>
                      ))
                    )}
                  </ScrollView>
                </View>
              </ThemedView>
            </View>
            <View style={[styles.cardPage, { width: pageWidth }]}>
              <ThemedView style={styles.card} lightColor={cardSurface} darkColor={cardSurface} mode="elevated" elevation={2}>
                <ThemedText type="subtitle" style={styles.sectionTitle}>
                  {t('assistant.section.title')}
                </ThemedText>
                <View style={styles.assistantConversation}>
                  <ScrollView
                    ref={assistantScrollRef}
                    style={styles.assistantConversationScroll}
                    contentContainerStyle={styles.assistantConversationContent}
                    showsVerticalScrollIndicator={false}>
                    <ThemedView
                      style={styles.assistantSummaryCard}
                      mode="elevated"
                      elevation={1}
                      lightColor={theme.colors.secondaryContainer}
                      darkColor={theme.colors.secondaryContainer}>
                      <ThemedText
                        style={[styles.assistantSummaryLabel, { color: theme.colors.onSecondaryContainer }]}>
                        {t('assistant.section.summary_title')}
                      </ThemedText>
                      <ThemedText
                        style={[styles.assistantSummaryText, { color: theme.colors.onSecondaryContainer }]}>
                        {assistantSummary || assistantSummaryPlaceholder}
                      </ThemedText>
                    </ThemedView>
                    {assistantMessages.length === 0 ? (
                      <ThemedText
                        style={styles.assistantEmptyText}
                       
                       >
                        {t('assistant.placeholders.no_messages')}
                      </ThemedText>
                    ) : (
                      assistantMessages.map((message) => {
                        const isUser = message.role === 'user';
                        const statusText =
                          message.status === 'pending'
                            ? t('assistant.status.waiting_reply')
                            : message.status === 'failed'
                            ? message.error?.trim() || t('assistant.errors.send_failed')
                            : null;
                        return (
                          <View
                            key={message.id}
                            style={[
                              styles.assistantMessageRow,
                              isUser
                                ? styles.assistantMessageRowUser
                                : styles.assistantMessageRowAssistant,
                            ]}>
                            <View
                              style={[
                                styles.assistantMessageBubble,
                                {
                                  backgroundColor: isUser
                                    ? assistantUserBubbleColor
                                    : assistantAssistantBubbleColor,
                                },
                              ]}>
                              <ThemedText
                                style={[
                                  styles.assistantMessageText,
                                  isUser && { color: assistantUserTextColor },
                                ]}>
                                {message.content}
                              </ThemedText>
                              {statusText ? (
                                <ThemedText
                                  style={[
                                    styles.assistantMessageStatus,
                                    { color: assistantMetaColor },
                                    message.status === 'failed' && { color: theme.colors.error },
                                  ]}>
                                  {statusText}
                                </ThemedText>
                              ) : null}
                            </View>
                          </View>
                        );
                      })
                    )}
                  </ScrollView>
                </View>
                <View style={styles.assistantComposer}>
                  <PaperTextInput
                    value={assistantDraft}
                    onChangeText={handleAssistantChange}
                    mode="outlined"
                    style={styles.assistantInput}
                    autoCorrect={false}
                    autoCapitalize="none"
                    returnKeyType="done"
                    multiline
                  />
                  <IconButton
                    icon="send"
                    mode="contained"
                    disabled={!assistantCanSend}
                    loading={assistantSending}
                    onPress={handleAssistantSend}
                    accessibilityLabel={t('assistant.accessibility.send_input')}
                  />
                </View>
              </ThemedView>
            </View>
          </ScrollView>
        </View>
      </ThemedView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  container: {
    flex: 1,
  },
  topBar: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 16,
  },
  topBarTitle: {
    fontSize: 28,
    fontWeight: "700",
  },
  content: {
    flex: 1,
  },
  carousel: {
    flex: 1,
  },
  carouselContent: {
    flexGrow: 1,
  },
  cardPage: {
    height: "100%",
    justifyContent: "center",
  },
  card: {
    flex: 1,
    borderRadius: 24,
    padding: 20,
    marginHorizontal: 20,
    marginBottom: 24,
    gap: 20,
  },
  assistantSummaryCard: {
    borderRadius: 20,
    padding: 20,
    marginBottom: 12,
    gap: 12,
    overflow: "hidden",
  },
  assistantSummaryLabel: {
    fontSize: 14,
    opacity: 0.9,
  },
  assistantSummaryText: {
    fontSize: 16,
    lineHeight: 24,
  },
  assistantConversation: {
    flex: 1,
  },
  assistantConversationScroll: {
    flex: 1,
    paddingHorizontal: 4,
  },
  assistantConversationContent: {
    flexGrow: 1,
    justifyContent: "flex-start",
    paddingVertical: 0,
    paddingBottom: 16,
  },
  assistantEmptyText: {
    textAlign: "center",
    fontSize: 15,
    lineHeight: 22,
    marginTop: 8,
  },
  assistantMessageRow: {
    width: "100%",
    flexDirection: "row",
    marginBottom: 12,
  },
  assistantMessageRowAssistant: {
    justifyContent: "flex-start",
  },
  assistantMessageRowUser: {
    justifyContent: "flex-end",
  },
  assistantMessageBubble: {
    maxWidth: "84%",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 16,
  },
  assistantMessageText: {
    fontSize: 15,
    lineHeight: 22,
  },
  assistantMessageStatus: {
    marginTop: 6,
    fontSize: 12,
  },
  assistantComposer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  assistantInput: {
    flex: 1,
    fontSize: 16,
  },
  historyCard: {
    gap: 16,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  sectionTitle: {
    fontSize: 24,
    fontWeight: "700",
  },
  recordButton: {
    borderRadius: 999,
    paddingVertical: 12,
    paddingHorizontal: 24,
    minWidth: 140,
    justifyContent: "center",
  },
  recordButtonContent: {
    alignItems: "center",
    justifyContent: "center",
  },
  recordButtonLabel: {
    fontSize: 16,
    fontWeight: "600",
  },
  dialogueContainer: {
    flex: 1,
  },
  dialogueScroll: {
    flex: 1,
  },
  dialogueContent: {
    gap: 12,
    flexGrow: 1,
    justifyContent: "flex-end",
    paddingBottom: 12,
  },
  emptyDialogue: {
    flexGrow: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingBottom: 12,
  },
  emptyMessage: {
    fontSize: 15,
    textAlign: "center",
  },
  messageBubble: {
    borderRadius: 16,
    padding: 16,
    gap: 8,
  },
  messageStatus: {
    fontSize: 13,
    opacity: 0.7,
  },
  messageBody: {
    fontSize: 16,
    lineHeight: 24,
  },
  translationSection: {
    marginTop: 8,
    gap: 8,
  },
  translationDivider: {
    borderTopWidth: 1,
    borderStyle: "dashed",
  },
  translationText: {
    fontSize: 15,
    lineHeight: 22,
  },
  translationPending: {
    fontSize: 14,
  },
  translationError: {
    fontSize: 14,
  },
  historyHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  historyActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  historySearchContainer: {
    width: "100%",
  },
  historySearchBar: {
    marginBottom: 12,
  },
  historyListContainer: {
    flex: 1,
  },
  historyScroll: {
    flex: 1,
  },
  historyScrollContent: {
    paddingVertical: 8,
    gap: 12,
  },
  historyEmptyContainer: {
    flexGrow: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 24,
  },
  historyEmptyText: {
    fontSize: 15,
  },
  historyGroup: {
    gap: 12,
  },
  historyDateRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  historyDateLine: {
    flex: 1,
    height: 1,
  },
  historyDateLabel: {
    fontSize: 14,
    fontWeight: "600",
  },
  historyItem: {
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    gap: 6,
  },
  historyItemActive: {
    borderWidth: 1.5,
  },
  historyItemHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  historyItemTitle: {
    flex: 1,
    fontSize: 16,
    fontWeight: "600",
  },
  historyItemTime: {
    fontSize: 14,
  },
});


function MessageBubble({ message }: { message: TranscriptionMessage }) {
  const { t } = useTranslation();
  const theme = useTheme();

  const statusLabel = (() => {
    switch (message.status) {
      case 'pending':
        return t('transcription.status.pending_trigger');
      case 'transcribing':
        return t('transcription.status.transcribing');
      case 'failed':
        return t('transcription.status.failed');
      default:
        return null;
    }
  })();

  const fallbackText =
    message.status === 'failed'
      ? message.error || t('transcription.errors.no_content')
      : t('transcription.status.waiting_result');

  const messageSurface = theme.colors.surfaceVariant;
  const statusColor = theme.colors.onSurfaceVariant;

  return (
    <ThemedView style={[styles.messageBubble, { backgroundColor: messageSurface }]}>
      {statusLabel ? (
        <ThemedText style={[styles.messageStatus, { color: statusColor }]}>{statusLabel}</ThemedText>
      ) : null}
      <ThemedText style={styles.messageBody}>
        {message.transcript && message.transcript.length > 0 ? message.transcript : fallbackText}
      </ThemedText>
      <TranslationSection message={message} />
    </ThemedView>
  );
}


function TranslationSection({ message }: { message: TranscriptionMessage }) {
  const { t } = useTranslation();
  const theme = useTheme();

  let content: ReactNode | null = null;
  if (message.translationStatus === 'pending') {
    content = (
      <ThemedText
        style={[styles.translationPending, { color: theme.colors.onSurfaceVariant }]}
      >
        {t('translation.status.in_progress')}
      </ThemedText>
    );
  } else if (message.translationStatus === 'failed') {
    content = (
      <ThemedText
        style={[styles.translationError, { color: theme.colors.error }]}
      >
        {message.translationError || t('translation.status.failed')}
      </ThemedText>
    );
  } else if (message.translationStatus === 'completed' && message.translation) {
    content = (
      <ThemedText
        style={[styles.translationText, { color: theme.colors.onSurfaceVariant }]}
      >
        {message.translation}
      </ThemedText>
    );
  }

  if (!content) {
    return null;
  }

  return (
    <View style={styles.translationSection}>
      <View style={[styles.translationDivider, { borderColor: theme.colors.outlineVariant }]} />
      {content}
    </View>
  );
}


function buildDateKey(timestamp: number) {
  const date = new Date(timestamp);
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

function formatDateLabel(timestamp: number, language: string) {
  try {
    return new Intl.DateTimeFormat(language, {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    }).format(new Date(timestamp));
  } catch (error) {
    if (__DEV__) {
      console.warn('[transcription] Failed to format history date label', error);
    }
    const date = new Date(timestamp);
    return `${date.getFullYear()}/${date.getMonth() + 1}/${date.getDate()}`;
  }
}

function formatRecordTime(timestamp: number, language: string) {
  try {
    return new Intl.DateTimeFormat(language, {
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(new Date(timestamp));
  } catch (error) {
    if (__DEV__) {
      console.warn('[transcription] Failed to format history time label', error);
    }
    const date = new Date(timestamp);
    const month = `${date.getMonth() + 1}`.padStart(2, '0');
    const day = `${date.getDate()}`.padStart(2, '0');
    const hours = `${date.getHours()}`.padStart(2, '0');
    const minutes = `${date.getMinutes()}`.padStart(2, '0');
    return `${month}/${day} ${hours}:${minutes}`;
  }
}
