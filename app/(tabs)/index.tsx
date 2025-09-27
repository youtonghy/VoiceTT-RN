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
import { useTranscription } from "@/contexts/transcription-context";
import { TranscriptionMessage } from "@/types/transcription";

const AnimatedLinearGradient = Animated.createAnimatedComponent(LinearGradient);

type HistoryConversation = {
  id: string;
  title: string;
  transcript: string;
  translation?: string;
  createdAt: number;
};

function createTimestamp(daysAgo: number, hour: number, minute: number) {
  const date = new Date();
  date.setHours(hour, minute, 0, 0);
  date.setDate(date.getDate() - daysAgo);
  return date.getTime();
}

function createHistorySeed(): HistoryConversation[] {
  const items: HistoryConversation[] = [
    {
      id: "conv-1",
      title: "空对话",
      transcript: "当前暂无具体内容，等待下一次录音。",
      translation: "No transcript yet. Waiting for the next recording.",
      createdAt: createTimestamp(0, 12, 41),
    },
    {
      id: "conv-2",
      title: "讨论参考方案",
      transcript: "我们梳理了接口稳定性方案，并确认交付节点。",
      translation: "Reviewed interface stability proposal and confirmed delivery timeline.",
      createdAt: createTimestamp(1, 15, 1),
    },
    {
      id: "conv-3",
      title: "内存泄漏定位",
      transcript: "复盘了客户端日志，初步判断是后台保活策略触发。",
      translation: "Client logs hint the keep-alive strategy causes the leak.",
      createdAt: createTimestamp(3, 0, 18),
    },
    {
      id: "conv-4",
      title: "关于香菜供应",
      transcript: "整理供应链清单，标注需要额外确认的供应商。",
      translation: "Captured supplier list and flagged vendors needing follow-up.",
      createdAt: createTimestamp(4, 23, 17),
    },
    {
      id: "conv-5",
      title: "迭代回顾",
      transcript: "总结了本周亮点与风险，并准备同步给全员。",
      translation: "Summarised highlights and risks to share across the team.",
      createdAt: createTimestamp(2, 10, 26),
    },
  ];
  return items.sort((a, b) => b.createdAt - a.createdAt);
}

const HISTORY_SEED = createHistorySeed();

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
  const { messages, error, clearError } = useTranscription();
  const scrollRef = useRef<ScrollView | null>(null);
  const carouselRef = useRef<ScrollView | null>(null);
  const historyScrollRef = useRef<ScrollView | null>(null);

  const [historyItems, setHistoryItems] = useState<HistoryConversation[]>(() => [...HISTORY_SEED]);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedHistoryId, setSelectedHistoryId] = useState<string | null>(() =>
    HISTORY_SEED.length > 0 ? HISTORY_SEED[0].id : null
  );
  const historyIdCounter = useRef(HISTORY_SEED.length + 1);

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
    const groups: Array<{ key: string; label: string; items: HistoryConversation[] }> = [];
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

  useEffect(() => {
    if (filteredHistory.length === 0) {
      if (selectedHistoryId !== null) {
        setSelectedHistoryId(null);
      }
      return;
    }
    const exists = filteredHistory.some((item) => item.id === selectedHistoryId);
    if (!exists) {
      setSelectedHistoryId(filteredHistory[0].id);
    }
  }, [filteredHistory, selectedHistoryId]);

  const selectedConversation = useMemo(
    () => (selectedHistoryId ? historyItems.find((item) => item.id === selectedHistoryId) ?? null : null),
    [historyItems, selectedHistoryId]
  );

  const handleAddConversation = useCallback(() => {
    const idNumber = historyIdCounter.current++;
    const newId = `conv-${idNumber}`;
    const now = Date.now();
    const nextConversation: HistoryConversation = {
      id: newId,
      title: `新对话 ${idNumber}`,
      transcript: "暂无转写内容，开始录音后会自动更新。",
      translation: undefined,
      createdAt: now,
    };
    setHistoryItems((prev) => [nextConversation, ...prev]);
    setSearchTerm("");
    setSelectedHistoryId(newId);
    if (typeof requestAnimationFrame === "function") {
      requestAnimationFrame(() => {
        historyScrollRef.current?.scrollTo({ y: 0, animated: true });
      });
    } else {
      setTimeout(() => {
        historyScrollRef.current?.scrollTo({ y: 0, animated: true });
      }, 0);
    }
  }, []);

  const handleBackToTranscription = useCallback(() => {
    carouselRef.current?.scrollTo({ x: 0, y: 0, animated: true });
  }, []);

  const handleSelectConversation = useCallback((conversationId: string) => {
    setSelectedHistoryId(conversationId);
  }, []);

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
            ref={carouselRef}
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
                      onPress={handleAddConversation}
                      style={styles.historyIconButton}
                      accessibilityLabel="新增对话">
                      <ThemedText style={styles.historyIconLabel} lightColor="#1f2937" darkColor="#e2e8f0">
                        +
                      </ThemedText>
                    </Pressable>
                    <Pressable
                      onPress={handleBackToTranscription}
                      style={styles.historyIconButton}
                      accessibilityLabel="返回当前转写">
                      <ThemedText style={styles.historyIconLabel} lightColor="#1f2937" darkColor="#e2e8f0">
                        ←
                      </ThemedText>
                    </Pressable>
                  </View>
                </View>
                <View style={styles.historySearchContainer}>
                  <TextInput
                    value={searchTerm}
                    onChangeText={handleSearchChange}
                    placeholder="搜索对话转写或翻译"
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
                            const isActive = item.id === selectedHistoryId;
                            return (
                              <Pressable
                                key={item.id}
                                onPress={() => handleSelectConversation(item.id)}
                                style={[styles.historyItem, isActive && styles.historyItemActive]}
                                accessibilityLabel={`查看${item.title}的转写`}>
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
                                <ThemedText
                                  numberOfLines={1}
                                  style={styles.historyItemPreview}
                                  lightColor="#475569"
                                  darkColor="#cbd5f5">
                                  {item.transcript}
                                </ThemedText>
                              </Pressable>
                            );
                          })}
                        </View>
                      ))
                    )}
                  </ScrollView>
                </View>
                {selectedConversation ? (
                  <View style={styles.historyDetail}>
                    <ThemedText style={styles.historyDetailTitle} lightColor="#1f2937" darkColor="#f8fafc">
                      {selectedConversation.title}
                    </ThemedText>
                    <ThemedText style={styles.historyDetailTime} lightColor="#64748b" darkColor="#94a3b8">
                      {formatFullDateTime(selectedConversation.createdAt)}
                    </ThemedText>
                    <ThemedText style={styles.historyDetailContent} lightColor="#1f2937" darkColor="#e2e8f0">
                      {selectedConversation.transcript}
                    </ThemedText>
                    {selectedConversation.translation ? (
                      <View style={styles.historyDetailTranslationBlock}>
                        <ThemedText
                          style={styles.historyDetailTranslationLabel}
                          lightColor="#2563eb"
                          darkColor="#60a5fa">
                          翻译
                        </ThemedText>
                        <ThemedText
                          style={styles.historyDetailTranslation}
                          lightColor="#1f2937"
                          darkColor="#e2e8f0">
                          {selectedConversation.translation}
                        </ThemedText>
                      </View>
                    ) : null}
                  </View>
                ) : (
                  <View style={styles.historyDetailPlaceholder}>
                    <ThemedText
                      style={styles.historyDetailPlaceholderText}
                      lightColor="#94a3b8"
                      darkColor="#94a3b8">
                      选择一条对话查看转写详情。
                    </ThemedText>
                  </View>
                )}
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
    gap: 6,
  },
  historyItemActive: {
    borderWidth: 1.5,
    borderColor: "#3b82f6",
    backgroundColor: "rgba(59, 130, 246, 0.12)",
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
  historyItemPreview: {
    fontSize: 14,
  },
  historyDetail: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "rgba(148, 163, 184, 0.25)",
    padding: 16,
    gap: 12,
    backgroundColor: "rgba(148, 163, 184, 0.08)",
  },
  historyDetailTitle: {
    fontSize: 18,
    fontWeight: "700",
  },
  historyDetailTime: {
    fontSize: 14,
  },
  historyDetailContent: {
    fontSize: 15,
    lineHeight: 22,
  },
  historyDetailTranslationBlock: {
    gap: 8,
  },
  historyDetailTranslationLabel: {
    fontSize: 13,
    fontWeight: "600",
  },
  historyDetailTranslation: {
    fontSize: 14,
    lineHeight: 22,
  },
  historyDetailPlaceholder: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "rgba(148, 163, 184, 0.25)",
    padding: 24,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(148, 163, 184, 0.08)",
  },
  historyDetailPlaceholderText: {
    fontSize: 15,
    textAlign: "center",
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

function formatFullDateTime(timestamp: number) {
  const date = new Date(timestamp);
  const hours = `${date.getHours()}`.padStart(2, "0");
  const minutes = `${date.getMinutes()}`.padStart(2, "0");
  return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日 ${hours}:${minutes}`;
}
