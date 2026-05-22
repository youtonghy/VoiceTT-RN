import AsyncStorage from "@react-native-async-storage/async-storage";
import { createAudioPlayer } from "expo-audio";
import * as Clipboard from "expo-clipboard";
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import { Fragment, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useTranslation } from 'react-i18next';
import {
    Alert,
    Modal,
    Platform,
    Pressable,
    ScrollView,
    Share,
    StyleSheet,
    TextInput,
    useWindowDimensions,
    View,
} from "react-native";

import { ContextMenu, type ContextMenuAction, type ContextMenuAnchor } from "@/components/context-menu";
import { MarkdownText } from "@/components/markdown-text";
import VoiceInputButton from "@/components/voice-input-button";
import {
    AppIcon,
    type AppIconName,
    AppScreen,
    FormInput,
} from "@/components/native/app-shell";
import {
    getModelSelectOptions,
    SettingsModelSelect,
    useSettingsModelCatalogs,
} from "@/components/settings/model-picker";
import { useSettings } from "@/contexts/settings-context";
import { useTranscription } from "@/contexts/transcription-context";
import { useIsTablet } from "@/hooks/use-is-tablet";
import {
    DEFAULT_OPENAI_BASE_URL,
    generateAssistantReply,
    generateConversationSummary,
    generateConversationTitle,
    translateText,
    type AssistantConversationTurn,
} from "@/services/transcription";
import { synthesizeSpeech } from "@/services/tts";
import {
    DEFAULT_GEMINI_ASSISTANT_MODEL,
    DEFAULT_OPENAI_ASSISTANT_MODEL,
    type EngineCredentials,
} from "@/types/settings";
import { TranscriptionMessage, TranscriptQaItem } from "@/types/transcription";
import type { TtsMessage } from "@/types/tts";
import { Button, Card, Input, SearchField, Select, Surface, Text, useThemeColor } from "heroui-native";
import { Segment } from "heroui-native-pro/segment";

const MESSAGE_TTS_FORMAT = "mp3";
const BASE64_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

type AssistantMessageStatus = "pending" | "succeeded" | "failed";

type AssistantMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: number;
  status: AssistantMessageStatus;
  error?: string;
};

type ContextMenuState = {
  title?: string;
  actions: ContextMenuAction[];
  anchor?: ContextMenuAnchor;
};

type HistoryConversation = {
  id: string;
  title: string;
  transcript: string;
  translation?: string;
  summary?: string;
  summaryHidden: boolean;
  createdAt: number;
  messages: TranscriptionMessage[];
  assistantMessages: AssistantMessage[];
  ttsMessages: TtsMessage[];
};

function createHistorySeed(): HistoryConversation[] {
  return [];
}


const HISTORY_SEED = createHistorySeed();

const HISTORY_STORAGE_KEY = "@agents/history-conversations";
const HISTORY_STORAGE_VERSION = 2;

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let result = "";
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
      result += "=";
    } else {
      result += BASE64_ALPHABET[(byte1 & 0x03) << 4];
      result += "==";
    }
  }

  return result;
}

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
    const status: AssistantMessageStatus =
      candidate.status === "failed" || candidate.status === "pending"
        ? candidate.status
        : "succeeded";

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
      status,
      error:
        typeof candidate.error === "string" && candidate.error.trim()
          ? candidate.error.trim()
          : undefined,
    });
  });
  return sanitized;
}

function areQaItemsEqual(left?: TranscriptQaItem[], right?: TranscriptQaItem[]): boolean {
  if (left === right) {
    return true;
  }
  if (!left || !right) {
    return !left && !right;
  }
  if (left.length !== right.length) {
    return false;
  }
  for (let index = 0; index < left.length; index += 1) {
    if (left[index].question !== right[index].question || left[index].answer !== right[index].answer) {
      return false;
    }
  }
  return true;
}

function isConversationEmpty(conversation: HistoryConversation): boolean {
  const hasTranscript = conversation.transcript.trim().length > 0;
  const hasTranslation =
    typeof conversation.translation === "string" && conversation.translation.trim().length > 0;
  const hasSummary =
    typeof conversation.summary === "string" && conversation.summary.trim().length > 0;
  const hasMessages = conversation.messages.length > 0;
  const hasAssistantMessages = conversation.assistantMessages.length > 0;
  const hasTtsMessages = conversation.ttsMessages.length > 0;
  return !(
    hasTranscript ||
    hasTranslation ||
    hasSummary ||
    hasMessages ||
    hasAssistantMessages ||
    hasTtsMessages
  );
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
      summaryHidden: candidate.summaryHidden === true,
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
      ttsMessages: Array.isArray(candidate.ttsMessages)
        ? candidate.ttsMessages
            .filter((message): message is TtsMessage => !!message && typeof message === "object")
            .map((message) => ({ ...message }))
        : [],
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

export default function TranscriptionScreen() {
  const { t, i18n } = useTranslation();

  const { width } = useWindowDimensions();
  const isTablet = useIsTablet();
  const [dangerForeground] = useThemeColor(['danger-foreground']);
  const { settings, updateCredentials } = useSettings();
  const {
    messages,
    error,
    clearError,
    isSessionActive,
    toggleSession,
    stopSession,
    replaceMessages,
    sessionState,
  } = useTranscription();
  const isDesktopApp =
    Platform.OS === "web" &&
    typeof window !== "undefined" &&
    Boolean((window as { electron?: unknown }).electron);
  const scrollRef = useRef<ScrollView | null>(null);
  const historyScrollRef = useRef<ScrollView | null>(null);
  const assistantScrollRef = useRef<ScrollView | null>(null);
  const transcriptionScrollOffsetRef = useRef(0);
  const historyLongPressRef = useRef<string | null>(null);
  const assistantInputRef = useRef<TextInput | null>(null);
  const ttsPlayerRef = useRef<ReturnType<typeof createAudioPlayer> | null>(null);

  const [historyItems, setHistoryItems] = useState<HistoryConversation[]>(() => [...HISTORY_SEED]);
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [assistantDraft, setAssistantDraft] = useState("");
  const [assistantSending, setAssistantSending] = useState(false);
  const [activeCarouselIndex, setActiveCarouselIndex] = useState(0);
  const [tabletDetail, setTabletDetail] = useState<"live" | "assistant">("live");
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const [renameDialog, setRenameDialog] = useState<{ conversationId: string } | null>(null);
  const [renameDraft, setRenameDraft] = useState("");
  const historyIdCounter = useRef(Math.max(HISTORY_SEED.length + 1, 1));
  const assistantAbortRef = useRef<AbortController | null>(null);
  const manualTitleAbortRef = useRef<AbortController | null>(null);
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
  const previousSessionStateRef = useRef(sessionState);
  const suppressSessionStopEffectsRef = useRef(false);
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
    return () => {
      ttsPlayerRef.current?.pause();
      ttsPlayerRef.current?.remove();
      ttsPlayerRef.current = null;
    };
  }, []);


  useEffect(() => {
    if (error) {
      Alert.alert(t('alerts.recording.title'), error, [{ text: t('common.actions.ok'), onPress: clearError }]);
    }
  }, [clearError, error, t]);

  const scrollToLatestTranscript = useCallback((animated: boolean) => {
    const scroll = () => {
      scrollRef.current?.scrollToEnd({ animated });
    };
    if (typeof requestAnimationFrame === "function") {
      requestAnimationFrame(scroll);
    } else {
      setTimeout(scroll, 0);
    }
  }, []);

  useEffect(() => {
    if (messages.length > 0) {
      scrollToLatestTranscript(true);
    }
  }, [messages, scrollToLatestTranscript]);

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
    if (targetConversation.summaryHidden) {
      autoSummaryPendingRef.current = null;
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
      manualTitleAbortRef.current?.abort();
    };
  }, []);

  useEffect(() => {
    const previousState = previousSessionStateRef.current;
    previousSessionStateRef.current = sessionState;
    if (previousState === 'stopping' && sessionState === 'idle' && activeConversationIdRef.current) {
      if (suppressSessionStopEffectsRef.current) {
        suppressSessionStopEffectsRef.current = false;
        return;
      }
      autoTitlePendingRef.current = { conversationId: activeConversationIdRef.current };
      setAutoTitleTrigger((prev) => prev + 1);
      autoSummaryPendingRef.current = { conversationId: activeConversationIdRef.current };
      setAutoSummaryTrigger((prev) => prev + 1);
    }
  }, [sessionState]);

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
            stored.translation !== incoming.translation ||
            stored.qaAutoEnabled !== incoming.qaAutoEnabled ||
            stored.qaUpdatedAt !== incoming.qaUpdatedAt ||
            stored.qaProcessedLength !== incoming.qaProcessedLength ||
            stored.qaTranscriptHash !== incoming.qaTranscriptHash ||
            stored.qaSettingsSignature !== incoming.qaSettingsSignature ||
            !areQaItemsEqual(stored.qaItems, incoming.qaItems)
          ) {
            hasDifference = true;
            break;
          }
        }
      }
      if (!hasDifference) {
        return prev;
      }

      const clonedMessages = currentMessages.map((msg) => ({
        ...msg,
        qaItems: msg.qaItems ? msg.qaItems.map((item) => ({ ...item })) : undefined,
      }));
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
        updatedConversation.summaryHidden = false;
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
          suppressSessionStopEffectsRef.current = true;
          await stopSession({ discardCurrentSegment: true, cancelPendingTasks: true });
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
        summaryHidden: false,
        createdAt: now,
        messages: [],
        assistantMessages: [],
        ttsMessages: [],
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
    const scrollToTranscription = () => {
      setActiveCarouselIndex(0);
    };
    if (conversationId === activeConversationId) {
      scrollToTranscription();
      return;
    }
    try {
          suppressSessionStopEffectsRef.current = true;
          await stopSession({ discardCurrentSegment: true, cancelPendingTasks: true });
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

  const handleVoiceInputInsert = useCallback(
    (transcript: string) => {
      const trimmed = transcript.trim();
      if (!trimmed) {
        return;
      }
      setAssistantDraft((prev) => {
        if (!prev) {
          return trimmed;
        }
        const needsSpace = !/\s$/.test(prev);
        return needsSpace ? `${prev} ${trimmed}` : `${prev}${trimmed}`;
      });
      assistantInputRef.current?.focus();
    },
    [assistantInputRef]
  );

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
      prev.map((item) => {
        if (item.id !== conversationId) {
          return item;
        }
        const nextAssistantMessages: AssistantMessage[] = [
          ...item.assistantMessages,
          userMessage,
        ];
        return {
          ...item,
          assistantMessages: nextAssistantMessages,
        };
      })
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
          const updatedMessages: AssistantMessage[] = item.assistantMessages.map((msg) =>
            msg.id === messageId ? { ...msg, status: 'succeeded' } : msg
          );
          const nextAssistantMessages: AssistantMessage[] = [
            ...updatedMessages,
            assistantMessage,
          ];
          return {
            ...item,
            assistantMessages: nextAssistantMessages,
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
            const filteredMessages: AssistantMessage[] = item.assistantMessages.filter(
              (msg) => msg.id !== messageId
            );
            return {
              ...item,
              assistantMessages: filteredMessages,
            };
          }
          const updatedMessages: AssistantMessage[] = item.assistantMessages.map((msg) =>
            msg.id === messageId
              ? { ...msg, status: "failed", error: displayMessage }
              : msg
          );
          return {
            ...item,
            assistantMessages: updatedMessages,
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

  const playTtsAudio = useCallback(
    async (audioUri: string) => {
      try {
        ttsPlayerRef.current?.pause();
        ttsPlayerRef.current?.remove();
        const player = createAudioPlayer({ uri: audioUri });
        ttsPlayerRef.current = player;
        player.play();
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        Alert.alert(t('reading.errors.playback_failed', { message }));
      }
    },
    [t]
  );

  const handleSpeakText = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed) {
        return;
      }
      try {
        const result = await synthesizeSpeech({
          text: trimmed,
          settings,
          format: MESSAGE_TTS_FORMAT,
          voice: settings.ttsVoice?.trim() || undefined,
          prompt: settings.ttsPrompt?.trim() || undefined,
        });
        const base64 = arrayBufferToBase64(result.audio);
        const audioUri = `data:${result.mimeType};base64,${base64}`;
        await playTtsAudio(audioUri);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        Alert.alert(t('reading.errors.synthesis_failed', { message }));
      }
    },
    [playTtsAudio, settings, t]
  );

  const handleMessageLongPress = useCallback(
    (message: TranscriptionMessage, anchor?: ContextMenuAnchor) => {
      const transcript =
        typeof message.transcript === "string" ? message.transcript.trim() : "";
      const translation =
        typeof message.translation === "string" ? message.translation.trim() : "";
      const actions: ContextMenuAction[] = [];

      if (transcript) {
        actions.push({
          label: t("transcription.actions.copy_transcript"),
          onPress: () => {
            void Clipboard.setStringAsync(transcript);
          },
        });
        actions.push({
          label: t("transcription.actions.read_transcript"),
          onPress: () => {
            void handleSpeakText(transcript);
          },
        });
      }

      if (settings.enableTranslation && translation) {
        actions.push({
          label: t("transcription.actions.copy_translation"),
          onPress: () => {
            void Clipboard.setStringAsync(translation);
          },
        });
        actions.push({
          label: t("transcription.actions.read_translation"),
          onPress: () => {
            void handleSpeakText(translation);
          },
        });
      }

      if (actions.length === 0) {
        return;
      }

      actions.push({
        label: t("common.actions.cancel"),
        variant: "cancel",
      });

      setContextMenu({
        title: t("transcription.actions.title"),
        actions,
        anchor,
      });
      if (isDesktopApp) {
        const currentOffset = transcriptionScrollOffsetRef.current;
        const restoreScroll = () => {
          scrollRef.current?.scrollTo({ y: currentOffset, animated: false });
        };
        if (typeof requestAnimationFrame === "function") {
          requestAnimationFrame(restoreScroll);
        } else {
          setTimeout(restoreScroll, 0);
        }
      }
    },
    [handleSpeakText, isDesktopApp, settings.enableTranslation, t]
  );

  const handleDismissContextMenu = useCallback(() => {
    setContextMenu(null);
    historyLongPressRef.current = null;
  }, []);

  const openRenameDialog = useCallback((conversation: HistoryConversation) => {
    setRenameDraft(conversation.title);
    setRenameDialog({ conversationId: conversation.id });
  }, []);

  const handleRenameCancel = useCallback(() => {
    setRenameDialog(null);
    setRenameDraft("");
  }, []);

  const handleRenameSave = useCallback(() => {
    if (!renameDialog) {
      return;
    }
    const trimmed = renameDraft.trim();
    if (!trimmed) {
      return;
    }
    setHistoryItems((prev) =>
      prev.map((item) =>
        item.id === renameDialog.conversationId ? { ...item, title: trimmed } : item
      )
    );
    setRenameDialog(null);
    setRenameDraft("");
  }, [renameDialog, renameDraft, setHistoryItems]);

  const handleHistoryGenerateTitle = useCallback(
    async (conversationId: string) => {
      const conversation = historyItems.find((item) => item.id === conversationId);
      if (!conversation) {
        return;
      }
      const transcriptSegments = conversation.messages
        .map((msg) => msg.transcript?.trim())
        .filter((segment): segment is string => !!segment && segment.length > 0);
      const transcriptText = transcriptSegments.join('\n').trim();
      if (!transcriptText) {
        return;
      }
      const translationSegments = conversation.messages
        .map((msg) => msg.translation?.trim())
        .filter((segment): segment is string => !!segment && segment.length > 0);
      const translationText = (translationSegments.length > 0
        ? translationSegments.join('\n').trim()
        : conversation.translation?.trim()) || undefined;

      manualTitleAbortRef.current?.abort();
      const controller = new AbortController();
      manualTitleAbortRef.current = controller;
      try {
        const generatedTitle = await generateConversationTitle(
          transcriptText,
          translationText,
          settings,
          controller.signal
        );
        const cleanTitle = generatedTitle.trim();
        if (!cleanTitle) {
          return;
        }
        setHistoryItems((prev) =>
          prev.map((item) =>
            item.id === conversationId ? { ...item, title: cleanTitle } : item
          )
        );
      } catch (err) {
        if (err instanceof Error && err.name === 'AbortError') {
          return;
        }
        const message = err instanceof Error ? err.message : String(err);
        console.warn('[transcription] Failed to generate conversation title', err);
        Alert.alert(t('alerts.conversation_title.failure'), message);
      } finally {
        if (manualTitleAbortRef.current === controller) {
          manualTitleAbortRef.current = null;
        }
      }
    },
    [historyItems, settings, t]
  );

  const handleHistoryGenerateSummary = useCallback(
    async (conversationId: string) => {
      const conversation = historyItems.find((item) => item.id === conversationId);
      if (!conversation) {
        return;
      }
      const transcriptSegments = conversation.messages
        .map((msg) => msg.transcript?.trim())
        .filter((segment): segment is string => !!segment && segment.length > 0);
      const transcriptText = transcriptSegments.join('\n').trim();
      if (!transcriptText) {
        Alert.alert(t('alerts.summary.failure'), t('assistant.placeholders.summary'));
        return;
      }
      const translationSegments = conversation.messages
        .map((msg) => msg.translation?.trim())
        .filter((segment): segment is string => !!segment && segment.length > 0);
      const translationText = (translationSegments.length > 0
        ? translationSegments.join('\n').trim()
        : conversation.translation?.trim()) || undefined;

      if (autoSummaryAbortRef.current) {
        autoSummaryAbortRef.current.abort();
        autoSummaryAbortRef.current = null;
      }
      const controller = new AbortController();
      autoSummaryAbortRef.current = controller;
      try {
        const generatedSummary = await generateConversationSummary(
          transcriptText,
          translationText,
          settings,
          controller.signal
        );
        const cleanSummary = generatedSummary.trim();
        if (!cleanSummary) {
          return;
        }
        setHistoryItems((prev) =>
          prev.map((item) =>
            item.id === conversationId
              ? { ...item, summary: cleanSummary, summaryHidden: false }
              : item
          )
        );
      } catch (err) {
        if (err instanceof Error && err.name === 'AbortError') {
          return;
        }
        const message = err instanceof Error ? err.message : String(err);
        console.warn('[transcription] Failed to regenerate conversation summary', err);
        Alert.alert(t('alerts.summary.failure'), message);
      } finally {
        if (autoSummaryAbortRef.current === controller) {
          autoSummaryAbortRef.current = null;
        }
      }
    },
    [historyItems, settings, t]
  );

  const handleAssistantSummaryHide = useCallback(
    (conversation: HistoryConversation) => {
      if (autoSummaryAbortRef.current) {
        autoSummaryAbortRef.current.abort();
        autoSummaryAbortRef.current = null;
      }
      if (autoSummaryPendingRef.current?.conversationId === conversation.id) {
        autoSummaryPendingRef.current = null;
      }
      setHistoryItems((prev) =>
        prev.map((item) =>
          item.id === conversation.id ? { ...item, summaryHidden: true } : item
        )
      );
    },
    [setHistoryItems]
  );

  const handleDeleteConversation = useCallback(
    (conversation: HistoryConversation) => {
      const confirmDelete = async () => {
        if (conversation.id === activeConversationId) {
          try {
          suppressSessionStopEffectsRef.current = true;
          await stopSession({ discardCurrentSegment: true, cancelPendingTasks: true });
          } catch (sessionError) {
            console.warn(
              "[transcription] stopSession failed before deleting conversation",
              sessionError
            );
          }
        }
        setHistoryItems((prev) => prev.filter((item) => item.id !== conversation.id));
      };

      void confirmDelete();
    },
    [activeConversationId, setHistoryItems, stopSession]
  );

  const handleAssistantSummaryMenu = useCallback(
    (conversation: HistoryConversation, anchor?: ContextMenuAnchor) => {
      setContextMenu({
        title: t('assistant.actions.summary_title'),
        actions: [
          {
            label: t('assistant.actions.summary_regenerate'),
            onPress: () => {
              void handleHistoryGenerateSummary(conversation.id);
            },
          },
          {
            label: t('assistant.actions.summary_hide'),
            onPress: () => {
              handleAssistantSummaryHide(conversation);
            },
          },
          {
            label: t('common.actions.cancel'),
            variant: 'cancel',
          },
        ],
        anchor,
      });
    },
    [handleAssistantSummaryHide, handleHistoryGenerateSummary, t]
  );

  const assistantMessages = activeConversation?.assistantMessages ?? [];
  const canSaveRename = renameDraft.trim().length > 0;

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
  const assistantSummaryHidden = activeConversation?.summaryHidden ?? false;
  const assistantSummary = assistantSummaryHidden
    ? ''
    : (activeConversation?.summary?.trim() ?? '');
  const assistantSummaryPlaceholder = assistantSummaryHidden
    ? t('assistant.placeholders.summary_hidden')
    : t('assistant.placeholders.summary');
  const assistantEngine = settings.assistantEngine ?? 'openai';
  const assistantModelProvider = assistantEngine === 'gemini' ? 'gemini' : 'openai';
  const assistantModelLabel =
    assistantModelProvider === 'gemini'
      ? t('settings.summary.assistant_engine.gemini_label')
      : t('settings.summary.assistant_engine.openai_label');
  const activeAssistantModel =
    assistantModelProvider === 'gemini'
      ? settings.credentials.geminiAssistantModel?.trim() ||
        settings.credentials.geminiConversationModel?.trim() ||
        DEFAULT_GEMINI_ASSISTANT_MODEL
      : settings.credentials.openaiAssistantModel?.trim() ||
        settings.credentials.openaiConversationModel?.trim() ||
        DEFAULT_OPENAI_ASSISTANT_MODEL;
  const assistantModelFallback =
    assistantModelProvider === 'gemini'
      ? DEFAULT_GEMINI_ASSISTANT_MODEL
      : DEFAULT_OPENAI_ASSISTANT_MODEL;
  const assistantModelCredentialKey: keyof EngineCredentials =
    assistantModelProvider === 'gemini' ? 'geminiAssistantModel' : 'openaiAssistantModel';
  const {
    catalogs: assistantModelCatalogs,
    ensureModelsFetched: ensureAssistantModelsFetched,
  } = useSettingsModelCatalogs({
    openaiApiKey: settings.credentials.openaiApiKey ?? '',
    openaiBaseUrl: settings.credentials.openaiBaseUrl ?? DEFAULT_OPENAI_BASE_URL,
    geminiApiKey: settings.credentials.geminiApiKey ?? '',
    qwenApiKey: settings.credentials.qwenApiKey ?? '',
    glmApiKey: settings.credentials.glmApiKey ?? '',
  });
  const assistantModelOptions = getModelSelectOptions(
    assistantModelCatalogs,
    assistantModelProvider,
    [activeAssistantModel, assistantModelFallback],
    assistantModelCredentialKey
  );
  useEffect(() => {
    void ensureAssistantModelsFetched(assistantModelProvider);
  }, [assistantModelProvider, ensureAssistantModelsFetched]);
  const handleAssistantModelChange = useCallback(
    (next: string) => {
      const nextValue = next.trim() || assistantModelFallback;
      updateCredentials({ [assistantModelCredentialKey]: nextValue } as Partial<EngineCredentials>);
    },
    [assistantModelCredentialKey, assistantModelFallback, updateCredentials]
  );

  const tabletHistoryWidth = useMemo(() => {
    if (!isTablet) {
      return 0;
    }
    return Math.min(420, Math.max(280, Math.round(width * 0.32)));
  }, [isTablet, width]);

  useEffect(() => {
    if (!isTablet) {
      setTabletDetail("live");
    }
  }, [isTablet]);

  const handleShareConversation = useCallback(async (conversation: HistoryConversation) => {
    const includeTranscript = settings.exportIncludeTranscript;
    const includeTranslation = settings.exportIncludeTranslation;
    const includeTime = settings.exportIncludeTime;
    const exportFormat = settings.exportFormat;

    if (!includeTranscript && !includeTranslation) {
      Alert.alert(t('transcription.export.empty_title'), t('transcription.export.empty_body'));
      return;
    }

    const exportableMessages = conversation.messages.filter((item) => {
      const transcript = item.transcript?.trim();
      const translation = item.translation?.trim();
      if (includeTranscript && transcript) {
        return true;
      }
      if (includeTranslation && (translation || transcript)) {
        return true;
      }
      return false;
    });

    if (exportableMessages.length === 0) {
      Alert.alert(t('transcription.export.empty_title'), t('transcription.export.empty_body'));
      return;
    }

    const headerLines = [
      `# ${conversation.title || t('transcription.export.share_title')}`,
      '',
      t('transcription.export.generated_at', { time: formatRecordTime(Date.now(), i18n.language) }),
      '',
    ];
    const contentLines: string[] = [];
    let hasContent = false;

    const translateOnDemand = async (text: string) => {
      if (settings.translationEngine === 'none') {
        return '';
      }
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), settings.translationTimeoutSec * 1000);
      try {
        const result = await translateText(
          text,
          { ...settings, enableTranslation: true },
          controller.signal
        );
        return result.text?.trim() ?? '';
      } finally {
        clearTimeout(timeoutId);
      }
    };

    try {
      for (const message of exportableMessages) {
        const transcriptText = includeTranscript ? message.transcript?.trim() ?? '' : '';
        let translationText = includeTranslation ? message.translation?.trim() ?? '' : '';
        if (!translationText && includeTranslation && message.transcript?.trim()) {
          translationText = await translateOnDemand(message.transcript.trim());
        }
        if (!transcriptText && !translationText) {
          continue;
        }
        if (includeTime) {
          contentLines.push(`[${formatExportTimestamp(message.createdAt)}]`);
        }
        if (transcriptText) {
          contentLines.push(transcriptText);
        }
        if (translationText) {
          contentLines.push(translationText);
        }
        contentLines.push('');
        hasContent = true;
      }

      if (!hasContent) {
        Alert.alert(t('transcription.export.empty_title'), t('transcription.export.empty_body'));
        return;
      }

      const exportText = [...headerLines, ...contentLines].join('\n');
      if (exportFormat === 'markdown') {
        await Share.share({
          message: exportText,
          title: conversation.title || t('transcription.export.share_title'),
        });
        return;
      }

      const html = buildExportHtml(exportText);
      if (Platform.OS === 'web') {
        await Print.printAsync({ html });
        return;
      }
      const { uri } = await Print.printToFileAsync({ html });
      const canShare = await Sharing.isAvailableAsync();
      if (canShare) {
        await Sharing.shareAsync(uri, {
          mimeType: 'application/pdf',
          UTI: 'com.adobe.pdf',
        });
      } else {
        await Share.share({
          url: uri,
          title: conversation.title || t('transcription.export.share_title'),
          message: exportText,
        });
      }
    } catch (shareError) {
      console.warn('[transcription] Failed to export conversation', shareError);
      Alert.alert(t('transcription.export.error_title'), t('transcription.export.error_body'));
    }
  }, [
    settings,
    t,
    i18n.language,
  ]);

  const handleCopyConversation = useCallback(
    (conversation: HistoryConversation) => {
      const lines: string[] = [];
      conversation.messages.forEach((message) => {
        const transcript = message.transcript?.trim();
        const translation = message.translation?.trim();
        if (!transcript && !translation) {
          return;
        }
        lines.push(`[${formatExportTimestamp(message.createdAt)}]`);
        if (transcript) {
          lines.push(transcript);
        }
        if (translation) {
          lines.push(translation);
        }
        lines.push('');
      });

      const text = lines.join('\n').trim();
      if (!text) {
        Alert.alert(t('transcription.export.empty_title'), t('transcription.export.empty_body'));
        return;
      }

      void Clipboard.setStringAsync(text);
    },
    [t]
  );

  const handleHistoryLongPress = useCallback(
    (conversation: HistoryConversation, anchor?: ContextMenuAnchor) => {
      historyLongPressRef.current = conversation.id;
      setContextMenu({
        title: t('transcription.history.actions.title'),
        actions: [
          {
            label: t('transcription.history.actions.share'),
            onPress: () => {
              void handleShareConversation(conversation);
            },
          },
          {
            label: t('transcription.history.actions.copy'),
            onPress: () => {
              handleCopyConversation(conversation);
            },
          },
          {
            label: t('transcription.history.actions.rename'),
            onPress: () => {
              openRenameDialog(conversation);
            },
          },
          {
            label: t('transcription.history.actions.generate_title'),
            onPress: () => {
              void handleHistoryGenerateTitle(conversation.id);
            },
          },
          {
            label: t('transcription.history.actions.delete'),
            variant: 'destructive',
            onPress: () => {
              handleDeleteConversation(conversation);
            },
          },
          {
            label: t('common.actions.cancel'),
            variant: 'cancel',
          },
        ],
        anchor,
      });
    },
    [
      handleCopyConversation,
      handleDeleteConversation,
      handleHistoryGenerateTitle,
      handleShareConversation,
      openRenameDialog,
      t,
    ]
  );

  const activeMobilePane = activeCarouselIndex === 0 ? 'live' : activeCarouselIndex === 2 ? 'assistant' : 'history';
  const activeConversationTitle = activeConversation?.title ?? t('transcription.history.new_conversation', { id: historyIdCounter.current });
  const isSessionBusy = sessionState === 'starting' || sessionState === 'stopping';
  const recordLabel = isSessionActive
    ? t('transcription.accessibility.stop_recording')
    : t('transcription.accessibility.start_recording');
  const showAssistantComposer = isTablet ? tabletDetail === "assistant" : activeMobilePane === 'assistant';
  const historyCountLabel = String(historyItems.length);

  const assistantBubbleMaxWidth = useMemo(
    () => Math.max(220, Math.round(width * (isTablet ? 0.42 : 0.76))),
    [isTablet, width]
  );

  const handleToggleRecording = useCallback(() => {
    void toggleSession();
  }, [toggleSession]);

  const DetailSegment = (
    <NativeSegment
      value={tabletDetail}
      onValueChange={(next) => {
        if (next === 'live' || next === 'assistant') {
          setTabletDetail(next);
        }
      }}
      options={[
        { value: 'live', label: t('transcription.sections.live_content'), icon: 'wave-square' },
        { value: 'assistant', label: t('assistant.section.title'), icon: 'robot' },
      ]}
    />
  );

  const MobileModeSegment = (
    <NativeSegment
      value={activeMobilePane}
      onValueChange={(next) => {
        if (next !== 'live' && next !== 'history' && next !== 'assistant') {
          return;
        }
        setActiveCarouselIndex(next === 'live' ? 0 : next === 'assistant' ? 2 : 1);
      }}
      options={[
        { value: 'live', label: t('transcription.sections.live_content'), icon: 'wave-square' },
        { value: 'history', label: t('transcription.sections.history_title'), icon: 'clock-rotate-left' },
        { value: 'assistant', label: t('assistant.section.title'), icon: 'robot' },
      ]}
    />
  );

  const LivePane = ({ showTabs = false }: { showTabs?: boolean }) => (
    <View className="min-h-0 flex-1 gap-3" style={styles.paneRoot}>
      {showTabs ? DetailSegment : null}
      <Surface variant="default" className="min-h-0 flex-1 rounded-3xl border border-border p-0" style={styles.paneSurface}>
        <View className="flex-row items-center justify-between gap-3 border-b border-border px-4 py-3">
          <View className="min-w-0 flex-1" style={styles.shrinkable}>
            <Text type="body-sm" weight="bold" numberOfLines={1}>
              {t('transcription.sections.live_content')}
            </Text>
          </View>
          <Button
            accessibilityLabel={recordLabel}
            isDisabled={isSessionBusy}
            isIconOnly
            onPress={handleToggleRecording}
            size="md"
            variant={isSessionActive ? 'danger' : 'secondary'}>
            <AppIcon
              name="radio"
              size={17}
              color={isSessionActive ? dangerForeground : undefined}
              className={isSessionActive ? undefined : 'text-accent'}
              solid
            />
          </Button>
        </View>
        <ScrollView
          ref={scrollRef}
          className="flex-1"
          contentContainerStyle={messages.length === 0 ? styles.emptyDialogue : styles.dialogueContent}
          onContentSizeChange={() => {
            if (messages.length > 0) {
              scrollToLatestTranscript(true);
            }
          }}
          onScroll={(event) => {
            transcriptionScrollOffsetRef.current = event.nativeEvent.contentOffset.y;
          }}
          scrollEventThrottle={16}
          showsVerticalScrollIndicator={false}
          nestedScrollEnabled>
          {messages.length === 0 ? (
            <StudioEmptyState
              icon="microphone"
              title={t('transcription.history.placeholder_empty')}
              subtitle={t('transcription.controls.start')}
            />
          ) : (
            messages.map((item) => (
              <MessageBubble key={item.id} message={item} onOpenMenu={handleMessageLongPress} />
            ))
          )}
        </ScrollView>
      </Surface>
    </View>
  );

  const HistoryPane = () => (
    <View className="min-h-0 flex-1 gap-3" style={styles.paneRoot}>
      <Surface variant="default" className="min-h-0 flex-1 rounded-3xl border border-border p-0" style={styles.paneSurface}>
        <View className="gap-3 border-b border-border px-4 py-3">
          <View className="flex-row items-center justify-between gap-3">
            <View className="min-w-0 flex-1" style={styles.shrinkable}>
              <Text type="body-sm" weight="bold" numberOfLines={1}>
                {t('transcription.sections.history_title')}
              </Text>
              <Text type="body-xs" color="muted" numberOfLines={1}>
                {activeConversationTitle}
              </Text>
            </View>
            <Text type="body-xs" color="muted" weight="bold">
              {historyCountLabel}
            </Text>
          </View>
          <SearchField value={searchTerm} onChange={handleSearchChange}>
            <SearchField.Group>
              <SearchField.SearchIcon />
              <SearchField.Input
                placeholder={t('transcription.history.search_placeholder')}
                autoCorrect={false}
              />
              <SearchField.ClearButton />
            </SearchField.Group>
          </SearchField>
        </View>
        <ScrollView
          ref={historyScrollRef}
          className="flex-1"
          contentContainerStyle={
            historyGroups.length === 0 ? styles.historyEmptyContainer : styles.historyScrollContent
          }
          showsVerticalScrollIndicator={false}
          nestedScrollEnabled
          keyboardShouldPersistTaps="handled">
          {historyGroups.length === 0 ? (
            <StudioEmptyState
              icon="magnifying-glass"
              title={t('transcription.history.placeholder_search_empty')}
            />
          ) : (
            historyGroups.map((group) => (
              <View key={group.key} style={styles.historyGroup}>
                <Text type="body-xs" color="muted" weight="semibold">
                  {group.label}
                </Text>
                {group.items.map((item) => {
                  const isActive = item.id === activeConversationId;
                  return (
                    <Pressable
                      key={item.id}
                      onPress={() => {
                        if (historyLongPressRef.current === item.id) {
                          historyLongPressRef.current = null;
                          return;
                        }
                        void handleSelectConversation(item.id);
                      }}
                      onLongPress={
                        isDesktopApp
                          ? undefined
                          : () => handleHistoryLongPress(item)
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
                          handleHistoryLongPress(item, {
                            x: typeof pageX === "number" ? pageX : clientX ?? 0,
                            y: typeof pageY === "number" ? pageY : clientY ?? 0,
                          });
                        }
                      }}
                      delayLongPress={isDesktopApp ? undefined : 250}
                      accessibilityRole="button"
                      accessibilityLabel={t('transcription.history.accessibility.view_conversation', { title: item.title })}
                      className={[
                        'rounded-2xl border px-3 py-3',
                        isActive ? 'border-accent bg-surface' : 'border-transparent bg-surface-secondary',
                      ].join(' ')}>
                      <View className="flex-row items-start gap-3">
                        <View className={['mt-0.5 size-9 items-center justify-center rounded-2xl', isActive ? 'bg-accent' : 'bg-background'].join(' ')}>
                          <AppIcon
                            name="box-archive"
                            size={16}
                            className={isActive ? 'text-accent-foreground' : 'text-muted'}
                            solid
                          />
                        </View>
                        <View className="min-w-0 flex-1 gap-1" style={styles.shrinkable}>
                          <Text weight="semibold" numberOfLines={1}>
                            {item.title}
                          </Text>
                          <Text type="body-xs" color="muted">
                            {formatRecordTime(item.createdAt, i18n.language)}
                          </Text>
                          {item.transcript.trim() ? (
                            <Text numberOfLines={2} type="body-sm" color="muted">
                              {item.transcript}
                            </Text>
                          ) : null}
                        </View>
                      </View>
                    </Pressable>
                  );
                })}
              </View>
            ))
          )}
        </ScrollView>
        <View className="border-t border-border p-3">
          <Button
            accessibilityLabel={t('transcription.history.accessibility.add')}
            onPress={() => {
              void handleAddConversation();
            }}
            size="lg"
            variant="primary">
            <AppIcon name="comments" size={18} className="text-accent-foreground" />
            <Button.Label numberOfLines={1}>
              {t('transcription.history.new_conversation', { id: historyIdCounter.current })}
            </Button.Label>
          </Button>
        </View>
      </Surface>
    </View>
  );

  const AssistantPane = ({ showTabs = false }: { showTabs?: boolean }) => (
    <View className="min-h-0 flex-1 gap-3" style={styles.paneRoot}>
      {showTabs ? DetailSegment : null}
      <Surface variant="default" className="min-h-0 flex-1 rounded-3xl border border-border p-0" style={styles.paneSurface}>
        <View className="flex-row items-center justify-between gap-3 border-b border-border px-4 py-3">
          <View className="min-w-0 flex-1" style={styles.shrinkable}>
            <Text type="body-sm" weight="bold" numberOfLines={1}>
              {t('assistant.section.title')}
            </Text>
            <Text type="body-xs" color="muted" numberOfLines={1}>
              {activeConversationTitle}
            </Text>
          </View>
          <SettingsModelSelect
            label={assistantModelLabel}
            value={activeAssistantModel}
            options={assistantModelOptions}
            placeholder={assistantModelFallback}
            onChange={handleAssistantModelChange}>
            <Select.Trigger variant="unstyled" asChild>
              <Button
                accessibilityLabel={t('assistant.accessibility.switch_model')}
                isIconOnly
                size="md"
                variant="secondary">
                <AppIcon name="robot" size={17} className="text-accent" solid />
              </Button>
            </Select.Trigger>
          </SettingsModelSelect>
        </View>
        <ScrollView
          ref={assistantScrollRef}
          className="flex-1"
          contentContainerStyle={styles.assistantConversationContent}
          showsVerticalScrollIndicator={false}>
          <Pressable
            onLongPress={
              isDesktopApp || !activeConversation
                ? undefined
                : () => handleAssistantSummaryMenu(activeConversation)
            }
            onPointerDown={(event) => {
              if (!isDesktopApp || !activeConversation) {
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
                handleAssistantSummaryMenu(activeConversation, {
                  x: typeof pageX === "number" ? pageX : clientX ?? 0,
                  y: typeof pageY === "number" ? pageY : clientY ?? 0,
                });
              }
            }}
            delayLongPress={isDesktopApp ? undefined : 250}>
            <View className="gap-2 rounded-2xl bg-surface-secondary p-3">
              <View className="flex-row items-center gap-2">
                <AppIcon name="wand-magic-sparkles" size={15} className="text-accent" solid />
                <Text type="body-xs" color="muted" weight="semibold">
                  {t('assistant.section.summary_title')}
                </Text>
              </View>
              <MarkdownText style={styles.assistantSummaryText}>
                {assistantSummary || assistantSummaryPlaceholder}
              </MarkdownText>
            </View>
          </Pressable>
          {assistantMessages.length === 0 ? (
            <StudioEmptyState
              icon="comments"
              title={t('assistant.placeholders.no_messages')}
              subtitle={assistantSummaryPlaceholder}
            />
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
                  className={`flex-row ${isUser ? 'justify-end' : 'justify-start'}`}>
                  <View
                    style={{ maxWidth: assistantBubbleMaxWidth }}
                    className={[
                      'gap-2 rounded-2xl px-4 py-3',
                      isUser ? 'bg-accent' : 'bg-surface-secondary',
                    ].join(' ')}>
                    {isUser ? (
                      <Text className="text-accent-foreground">
                        {message.content}
                      </Text>
                    ) : (
                      <MarkdownText style={styles.assistantMessageText}>
                        {message.content}
                      </MarkdownText>
                    )}
                    {statusText ? (
                      <Text
                        type="body-xs"
                        className={message.status === 'failed' ? 'text-danger' : isUser ? 'text-accent-foreground' : 'text-muted'}>
                        {statusText}
                      </Text>
                    ) : null}
                  </View>
                </View>
              );
            })
          )}
        </ScrollView>
        {showAssistantComposer ? (
          <View className="flex-row items-center gap-2 border-t border-border p-3">
            <VoiceInputButton style={styles.assistantActionButton} onInsert={handleVoiceInputInsert} />
            <Input
              ref={assistantInputRef}
              className="min-h-11 flex-1"
              value={assistantDraft}
              onChangeText={handleAssistantChange}
              autoCorrect={false}
              autoCapitalize="none"
              returnKeyType="done"
              placeholder={t('assistant.placeholders.input')}
              onSubmitEditing={() => {
                if (assistantCanSend) {
                  handleAssistantSend();
                }
              }}
              variant="secondary"
            />
            <Button
              accessibilityLabel={t('assistant.accessibility.send_input')}
              isDisabled={!assistantCanSend || assistantSending}
              isIconOnly
              onPress={handleAssistantSend}
              size="lg"
              style={styles.assistantActionButton}
              variant="primary">
              <AppIcon name="paper-plane" size={17} className="text-accent-foreground" solid />
            </Button>
          </View>
        ) : null}
      </Surface>
    </View>
  );

  const MobileContent = (
    <View className="min-h-0 flex-1 gap-3" style={styles.screenRoot}>
      {MobileModeSegment}
      <View className="min-h-0 flex-1" style={styles.mobilePaneFrame}>
        {activeMobilePane === 'live' ? <LivePane /> : null}
        {activeMobilePane === 'history' ? <HistoryPane /> : null}
        {activeMobilePane === 'assistant' ? <AssistantPane /> : null}
      </View>
    </View>
  );

  const TabletContent = (
    <View className="min-h-0 flex-1 gap-4" style={styles.screenRoot}>
      <View className="min-h-0 flex-1 flex-row gap-4" style={styles.tabletContentRow}>
        <View
          style={[styles.tabletHistoryFrame, { width: tabletHistoryWidth }]}
          className="min-h-0 flex-shrink-0">
          <HistoryPane />
        </View>
        <View className="min-h-0 flex-1 gap-3" style={styles.paneRoot}>
          {tabletDetail === "assistant" ? <AssistantPane showTabs /> : <LivePane showTabs />}
        </View>
      </View>
    </View>
  );

  return (
    <AppScreen
      contentBottomInset={0}
      scroll={false}>
      {isTablet ? TabletContent : MobileContent}
      <ContextMenu
        visible={Boolean(contextMenu)}
        title={contextMenu?.title}
        actions={contextMenu?.actions ?? []}
        anchor={contextMenu?.anchor}
        onRequestClose={handleDismissContextMenu}
      />
      {renameDialog ? (
        <Modal
          transparent
          animationType="fade"
          visible
          onRequestClose={handleRenameCancel}
        >
          <Pressable style={styles.renameBackdrop} onPress={handleRenameCancel}>
            <Pressable style={styles.renameCardPressable} onPress={() => {}}>
              <Card className="w-[88%] max-w-[420px] border border-border">
                <Card.Body className="gap-4">
                  <Text.Heading type="h3">{t('transcription.history.rename.title')}</Text.Heading>
                  <FormInput
                    label={t('transcription.history.rename.placeholder')}
                    value={renameDraft}
                    onChangeText={setRenameDraft}
                    placeholder={t('transcription.history.rename.placeholder')}
                    onBlur={undefined}
                  />
                  <View className="flex-row justify-end gap-2">
                    <Button variant="tertiary" onPress={handleRenameCancel}>
                      <Button.Label>{t('common.actions.cancel')}</Button.Label>
                    </Button>
                    <Button isDisabled={!canSaveRename} onPress={handleRenameSave}>
                      <Button.Label>{t('transcription.history.rename.save')}</Button.Label>
                    </Button>
                  </View>
                </Card.Body>
              </Card>
            </Pressable>
          </Pressable>
        </Modal>
      ) : null}
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  screenRoot: {
    flex: 1,
    minHeight: 0,
    minWidth: 0,
  },
  mobilePaneFrame: {
    flex: 1,
    minHeight: 0,
    minWidth: 0,
  },
  paneRoot: {
    flex: 1,
    minHeight: 0,
    minWidth: 0,
  },
  paneSurface: {
    flex: 1,
    minHeight: 0,
    minWidth: 0,
    overflow: 'hidden',
  },
  shrinkable: {
    flexShrink: 1,
    minWidth: 0,
  },
  tabletContentRow: {
    flex: 1,
    flexDirection: 'row',
    minHeight: 0,
    minWidth: 0,
  },
  tabletHistoryFrame: {
    flexShrink: 0,
    minHeight: 0,
    minWidth: 0,
    borderRadius: 18,
  },
  assistantSummaryText: {
    fontSize: 16,
    lineHeight: 24,
  },
  assistantConversationContent: {
    flexGrow: 1,
    justifyContent: "flex-start",
    gap: 12,
    padding: 12,
  },
  assistantMessageText: {
    fontSize: 15,
    lineHeight: 22,
  },
  assistantActionButton: {
    width: 44,
    height: 44,
    flexShrink: 0,
  },
  dialogueContent: {
    gap: 12,
    flexGrow: 1,
    justifyContent: "flex-start",
    padding: 12,
  },
  emptyDialogue: {
    flexGrow: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 16,
  },
  messageBubble: {
    borderRadius: 18,
    padding: 16,
    gap: 8,
  },
  messageBody: {
    fontSize: 16,
    lineHeight: 24,
  },
  translationSection: {
    gap: 8,
  },
  translationDivider: {
    borderTopWidth: 1,
    borderStyle: "dashed",
    borderColor: "rgba(148, 163, 184, 0.35)",
  },
  translationText: {
    fontSize: 15,
    lineHeight: 22,
  },
  historyScrollContent: {
    padding: 12,
    gap: 12,
  },
  historyEmptyContainer: {
    flexGrow: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 16,
  },
  historyGroup: {
    gap: 12,
  },
  renameBackdrop: {
    flex: 1,
    justifyContent: "center",
    backgroundColor: "rgba(15, 23, 42, 0.4)",
    padding: 20,
  },
  renameCardPressable: {
    borderRadius: 20,
  },
});


function MessageBubble({
  message,
  onOpenMenu,
}: {
  message: TranscriptionMessage;
  onOpenMenu: (message: TranscriptionMessage, anchor?: ContextMenuAnchor) => void;
}) {
  const { t } = useTranslation();
  const isDesktopApp =
    Platform.OS === "web" &&
    typeof window !== "undefined" &&
    Boolean((window as { electron?: unknown }).electron);

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

  return (
    <Pressable
      onLongPress={
        isDesktopApp
          ? undefined
          : () => onOpenMenu(message)
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
          onOpenMenu(message, {
            x: typeof pageX === "number" ? pageX : clientX ?? 0,
            y: typeof pageY === "number" ? pageY : clientY ?? 0,
          });
        }
      }}
      delayLongPress={isDesktopApp ? undefined : 250}
      accessibilityRole="button">
      <Surface variant="secondary" className="gap-2 rounded-2xl p-4" style={styles.messageBubble}>
        {statusLabel ? (
          <Text type="body-xs" color="muted" weight="semibold">
            {statusLabel}
          </Text>
        ) : null}
        <Text style={styles.messageBody}>
          {message.transcript && message.transcript.length > 0 ? message.transcript : fallbackText}
        </Text>
        <TranslationSection message={message} />
      </Surface>
    </Pressable>
  );
}

function TranslationSection({ message }: { message: TranscriptionMessage }) {
  const { t } = useTranslation();

  let content: ReactNode | null = null;
  if (message.translationStatus === 'pending') {
    content = (
      <Text type="body-sm" color="muted">
        {t('translation.status.in_progress')}
      </Text>
    );
  } else if (message.translationStatus === 'failed') {
    content = (
      <Text type="body-sm" className="text-danger">
        {message.translationError || t('translation.status.failed')}
      </Text>
    );
  } else if (message.translationStatus === 'completed' && message.translation) {
    content = <Text style={styles.translationText}>{message.translation}</Text>;
  }

  if (!content) {
    return null;
  }

  return (
    <View style={styles.translationSection}>
      <View style={styles.translationDivider} />
      {content}
    </View>
  );
}

function NativeSegment<T extends string>({
  value,
  options,
  onValueChange,
}: {
  value: T;
  options: { value: T; label: string; icon?: AppIconName; disabled?: boolean }[];
  onValueChange: (next: T) => void;
}) {
  return (
    <Segment value={value} onValueChange={(next) => onValueChange(next as T)} size="sm">
      <Segment.Group className="rounded-2xl bg-surface-secondary p-1">
        <Segment.Indicator />
        {options.map((option, index) => (
          <Fragment key={option.value}>
            {index > 0 ? (
              <Segment.Separator betweenValues={[options[index - 1].value, option.value]} />
            ) : null}
            <Segment.Item
              accessibilityLabel={option.label}
              className="min-w-0 flex-1 flex-row items-center justify-center gap-1.5 px-2"
              isDisabled={option.disabled}
              value={option.value}>
              {option.icon ? (
                <AppIcon name={option.icon} size={16} className="text-muted" />
              ) : null}
              <Segment.Label numberOfLines={1}>{option.label}</Segment.Label>
            </Segment.Item>
          </Fragment>
        ))}
      </Segment.Group>
    </Segment>
  );
}

function StudioEmptyState({
  icon,
  title,
  subtitle,
}: {
  icon: AppIconName;
  title: string;
  subtitle?: string;
}) {
  return (
    <View className="items-center justify-center gap-3 px-6 py-10">
      <View className="size-14 items-center justify-center rounded-3xl bg-surface-secondary">
        <AppIcon name={icon} size={27} className="text-muted" />
      </View>
      <Text weight="semibold" align="center">
        {title}
      </Text>
      {subtitle ? (
        <Text type="body-sm" color="muted" align="center">
          {subtitle}
        </Text>
      ) : null}
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

function formatExportTimestamp(timestamp: number) {
  const date = new Date(timestamp);
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const hours = `${date.getHours()}`.padStart(2, '0');
  const minutes = `${date.getMinutes()}`.padStart(2, '0');
  const seconds = `${date.getSeconds()}`.padStart(2, '0');
  return `${year}-${month}-${day} ${hours}:${minutes};${seconds}`;
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function buildExportHtml(content: string) {
  const escaped = escapeHtml(content);
  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <style>
      body {
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "Noto Sans", sans-serif;
        padding: 24px;
        line-height: 1.6;
        color: #0f172a;
      }
      pre {
        white-space: pre-wrap;
        word-break: break-word;
        font-size: 14px;
        margin: 0;
      }
    </style>
  </head>
  <body>
    <pre>${escaped}</pre>
  </body>
</html>`;
}
