import AsyncStorage from "@react-native-async-storage/async-storage";
import { LinearGradient } from "expo-linear-gradient";
import {
  Animated,
  Easing,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  Alert,
  TextInput,
  useWindowDimensions,
} from "react-native";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { SafeAreaView } from "react-native-safe-area-context";

import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { useThemeColor } from "@/hooks/use-theme-color";
import { useSettings } from "@/contexts/settings-context";
import { useTranscription } from "@/contexts/transcription-context";
import { TranscriptionMessage } from "@/types/transcription";
import { generateConversationTitle } from "@/services/transcription";

const AnimatedLinearGradient = Animated.createAnimatedComponent(LinearGradient);

type HistoryConversation = {
  id: string;
  title: string;
  transcript: string;
  translation?: string;
  createdAt: number;
  messages: TranscriptionMessage[];
};

function createHistorySeed(): HistoryConversation[] {
  return [];
}


const HISTORY_SEED = createHistorySeed();

const HISTORY_STORAGE_KEY = "@agents/history-conversations";
const HISTORY_STORAGE_VERSION = 1;

type StoredHistoryPayload = {
  version?: number;
  conversations?: unknown;
  activeConversationId?: string | null;
  nextIdCounter?: number;
};

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
  const shimmerProgress = useRef(new Animated.Value(0)).current;
  const shimmerLoop = useRef<Animated.CompositeAnimation | null>(null);

  useEffect(() => {
    return () => {
      shimmerLoop.current?.stop();
    };
  }, []);

  useEffect(() => {
    if (isSessionActive) {
      shimmerProgress.setValue(0);
      shimmerLoop.current?.stop();
      shimmerLoop.current = Animated.loop(
        Animated.timing(shimmerProgress, {
          toValue: 1,
          duration: 1500,
          easing: Easing.linear,
          useNativeDriver: true,
        })
      );
      shimmerLoop.current.start();
    } else {
      shimmerLoop.current?.stop();
      shimmerProgress.stopAnimation();
      shimmerProgress.setValue(0);
    }
  }, [isSessionActive, shimmerProgress]);

  const shimmerTranslate = shimmerProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [-120, 120],
  });

  const colors = isSessionActive ? ["#F87171", "#EF4444"] : ["#34D399", "#22C55E"];

  return (
    <Pressable
      accessibilityLabel={isSessionActive ? "停止录音" : "开始录音"}
      onPress={toggleSession}
      style={styles.recordButtonWrapper}>
      <LinearGradient colors={colors} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.recordButton}>
        <View style={styles.recordButtonContent}>
          <ThemedText style={styles.recordButtonLabel} lightColor="#fff" darkColor="#fff">
            {isSessionActive ? (isRecording ? "录音中..." : "处理片段...") : "开始录音"}
          </ThemedText>
        </View>
        {isSessionActive ? (
          <AnimatedLinearGradient
            colors={[
              "rgba(255,255,255,0)",
              "rgba(255,255,255,0.35)",
              "rgba(255,255,255,0)",
            ]}
            start={{ x: 0, y: 0.5 }}
            end={{ x: 1, y: 0.5 }}
            style={[styles.shimmer, { transform: [{ translateX: shimmerTranslate }] }]} />
        ) : null}
      </LinearGradient>
    </Pressable>
  );
}

export default function TranscriptionScreen() {
  const cardLight = "#f8fafc";
  const cardDark = "#0f172a";
  const backgroundColor = useThemeColor({}, "background");
  const searchInputColor = useThemeColor({ light: "#1f2937", dark: "#f8fafc" }, "text");
  const { width } = useWindowDimensions();
  const { settings } = useSettings();
  const { messages, error, clearError, stopSession, replaceMessages, isSessionActive } = useTranscription();
  const scrollRef = useRef<ScrollView | null>(null);
  const historyScrollRef = useRef<ScrollView | null>(null);

  const [historyItems, setHistoryItems] = useState<HistoryConversation[]>(() => [...HISTORY_SEED]);
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const historyIdCounter = useRef(Math.max(HISTORY_SEED.length + 1, 1));
  const [activeConversationId, setActiveConversationId] = useState<string | null>(() =>
    HISTORY_SEED.length > 0 ? HISTORY_SEED[0].id : null
  );
  const activeConversationIdRef = useRef<string | null>(activeConversationId);
  const lastLoadedConversationIdRef = useRef<string | null>(null);
  const bootstrappedHistoryRef = useRef(false);
  const [autoTitleTrigger, setAutoTitleTrigger] = useState(0);
  const autoTitlePendingRef = useRef<{ conversationId: string } | null>(null);
  const previousSessionActiveRef = useRef(isSessionActive);
  const autoTitleAbortRef = useRef<AbortController | null>(null);
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
      Alert.alert("录音提示", error, [{ text: "确定", onPress: clearError }]);
    }
  }, [clearError, error]);

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
        Alert.alert('??????', message);
      })
      .finally(() => {
        autoTitleAbortRef.current = null;
        if (autoTitlePendingRef.current) {
          setAutoTitleTrigger((prev) => prev + 1);
        }
      });
  }, [historyItems, settings, autoTitleTrigger]);



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
    };
  }, []);

  useEffect(() => {
    const wasActive = previousSessionActiveRef.current;
    previousSessionActiveRef.current = isSessionActive;
    if (wasActive && !isSessionActive && activeConversationIdRef.current) {
      autoTitlePendingRef.current = { conversationId: activeConversationIdRef.current };
      setAutoTitleTrigger((prev) => prev + 1);
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
      const haystack = `${item.title} ${item.transcript} ${item.translation ?? ""}`.toLowerCase();
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
          label: formatDateLabel(item.createdAt),
          items: [],
        };
        groups.push(currentGroup);
      }
      currentGroup.items.push(item);
    });

    return groups;
  }, [filteredHistory]);

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

      const idNumber = historyIdCounter.current++;
      const newId = `conv-${idNumber}`;
      const now = Date.now();
      const nextConversation: HistoryConversation = {
        id: newId,
        title: `新对话 ${idNumber}`,
        transcript: "",
        translation: undefined,
        createdAt: now,
        messages: [],
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
    [historyScrollRef, replaceMessages, setActiveConversationId, setHistoryItems, setSearchTerm, stopSession]
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
    if (conversationId === activeConversationId) {
      return;
    }
    if (!historyItems.some((item) => item.id === conversationId)) {
      return;
    }
    try {
      await stopSession();
    } catch (sessionError) {
      console.warn("[transcription] stopSession failed before switching conversation", sessionError);
    }
    setActiveConversationId(conversationId);
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

  const pageWidth = width;

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor }]} edges={["top"]}>
      <ThemedView style={styles.container}>
        <View style={styles.topBar}>
          <ThemedText type="title" style={styles.topBarTitle}>
            转写
          </ThemedText>
        </View>
        <View style={styles.content}>
          <ScrollView
            horizontal
            pagingEnabled
            bounces={false}
            showsHorizontalScrollIndicator={false}
            style={styles.carousel}
            contentContainerStyle={styles.carouselContent}>
            <View style={[styles.cardPage, { width: pageWidth }]}>
              <ThemedView style={styles.card} lightColor={cardLight} darkColor={cardDark}>
                <View style={styles.headerRow}>
                  <ThemedText type="subtitle" style={styles.sectionTitle}>
                    转写内容
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
                      <ThemedText style={styles.emptyMessage} lightColor="#94a3b8" darkColor="#94a3b8">
                        还没有转写内容，开始录音吧。
                      </ThemedText>
                    ) : (
                      messages.map((item) => <MessageBubble key={item.id} message={item} />)
                    )}
                  </ScrollView>
                </View>
              </ThemedView>
            </View>
            <View style={[styles.cardPage, { width: pageWidth }]}>
              <ThemedView style={[styles.card, styles.historyCard]} lightColor={cardLight} darkColor={cardDark}>
                <View style={styles.historyHeader}>
                  <ThemedText type="subtitle" style={styles.sectionTitle}>
                    历史对话
                  </ThemedText>
                  <View style={styles.historyActions}>
                    <Pressable
                      onPress={() => {
                        void handleAddConversation();
                      }}
                      style={styles.historyIconButton}
                      accessibilityLabel="新增对话">
                      <ThemedText style={styles.historyIconLabel} lightColor="#1f2937" darkColor="#e2e8f0">
                        +
                      </ThemedText>
                    </Pressable>
                  </View>
                </View>
                <View style={styles.historySearchContainer}>
                  <TextInput
                    value={searchTerm}
                    onChangeText={handleSearchChange}
                    placeholder="搜索对话转写或翻译内容"
                    placeholderTextColor="rgba(148,163,184,0.7)"
                    style={[styles.historySearchInput, { color: searchInputColor }]}
                    autoCorrect={false}
                    returnKeyType="search"
                    clearButtonMode="while-editing"
                    selectionColor="#2563eb"
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
                      <ThemedText style={styles.historyEmptyText} lightColor="#94a3b8" darkColor="#94a3b8">
                        暂无匹配的历史记录。
                      </ThemedText>
                    ) : (
                      historyGroups.map((group) => (
                        <View key={group.key} style={styles.historyGroup}>
                          <View style={styles.historyDateRow}>
                            <View style={styles.historyDateLine} />
                            <ThemedText style={styles.historyDateLabel} lightColor="#1f2937" darkColor="#e2e8f0">
                              {group.label}
                            </ThemedText>
                            <View style={styles.historyDateLine} />
                          </View>
                          {group.items.map((item) => {
                            const isActive = item.id === activeConversationId;
                            return (
                              <Pressable
                                key={item.id}
                                onPress={() => {
                                  void handleSelectConversation(item.id);
                                }}
                                accessibilityRole="button"
                                accessibilityLabel={`查看对话 ${item.title}`}
                                style={({ pressed }) => [
                                  styles.historyItem,
                                  isActive && styles.historyItemActive,
                                  pressed && styles.historyItemPressed,
                                ]}>
                                <View style={styles.historyItemHeader}>
                                  <ThemedText
                                    numberOfLines={1}
                                    style={styles.historyItemTitle}
                                    lightColor="#1f2937"
                                    darkColor="#f1f5f9">
                                    {item.title}
                                  </ThemedText>
                                  <ThemedText
                                    style={styles.historyItemTime}
                                    lightColor="#64748b"
                                    darkColor="#94a3b8">
                                    {formatRecordTime(item.createdAt)}
                                  </ThemedText>
                                </View>
                              </Pressable>
                            );
                          })}
                        </View>
                      ))
                    )}
                  </ScrollView>
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
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.08,
    shadowRadius: 24,
    elevation: 6,
    gap: 20,
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
  recordButtonWrapper: {
    borderRadius: 999,
    overflow: "hidden",
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
  shimmer: {
    position: "absolute",
    top: 0,
    bottom: 0,
    width: 120,
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
    backgroundColor: "rgba(148, 163, 184, 0.08)",
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
    borderColor: "rgba(148, 163, 184, 0.35)",
  },
  translationText: {
    fontSize: 15,
    lineHeight: 22,
  },
  translationPending: {
    fontSize: 14,
    color: "#64748b",
  },
  translationError: {
    fontSize: 14,
    color: "#f87171",
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
  historyIconButton: {
    width: 40,
    height: 40,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(148, 163, 184, 0.18)",
  },
  historyIconLabel: {
    fontSize: 20,
    fontWeight: "700",
  },
  historySearchContainer: {
    width: "100%",
  },
  historySearchInput: {
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: "rgba(148, 163, 184, 0.12)",
    fontSize: 15,
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
    backgroundColor: "rgba(148, 163, 184, 0.25)",
  },
  historyDateLabel: {
    fontSize: 14,
    fontWeight: "600",
  },
  historyItem: {
    borderRadius: 16,
    padding: 16,
    backgroundColor: "rgba(148, 163, 184, 0.12)",
    borderWidth: 1,
    borderColor: "transparent",
    gap: 6,
  },
  historyItemActive: {
    borderWidth: 1.5,
    borderColor: "#2563eb",
    backgroundColor: "rgba(37, 99, 235, 0.12)",
  },
  historyItemPressed: {
    opacity: 0.9,
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
  const statusLabel = (() => {
    switch (message.status) {
      case "pending":
        return "等待触发";
      case "transcribing":
        return "转写中";
      case "failed":
        return "转写失败";
      default:
        return null;
    }
  })();

  return (
    <ThemedView style={styles.messageBubble}>
      {statusLabel ? <ThemedText style={styles.messageStatus}>{statusLabel}</ThemedText> : null}
      <ThemedText style={styles.messageBody}>
        {message.transcript && message.transcript.length > 0
          ? message.transcript
          : message.status === "failed"
          ? message.error || "未能获取文字内容"
          : "等待转写结果..."}
      </ThemedText>
      {renderTranslationSection(message)}
    </ThemedView>
  );
}

function renderTranslationSection(message: TranscriptionMessage) {
  let content = null;
  if (message.translationStatus === "pending") {
    content = <ThemedText style={styles.translationPending}>翻译中...</ThemedText>;
  } else if (message.translationStatus === "failed") {
    content = (
      <ThemedText style={styles.translationError}>
        {message.translationError || "翻译失败"}
      </ThemedText>
    );
  } else if (message.translationStatus === "completed" && message.translation) {
    content = <ThemedText style={styles.translationText}>{message.translation}</ThemedText>;
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

function buildDateKey(timestamp: number) {
  const date = new Date(timestamp);
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

function formatDateLabel(timestamp: number) {
  const date = new Date(timestamp);
  return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日`;
}

function formatRecordTime(timestamp: number) {
  const date = new Date(timestamp);
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const hours = `${date.getHours()}`.padStart(2, "0");
  const minutes = `${date.getMinutes()}`.padStart(2, "0");
  return `${month}/${day} ${hours}:${minutes}`;
}

