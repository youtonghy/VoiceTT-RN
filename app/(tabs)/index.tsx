import { LinearGradient } from 'expo-linear-gradient';
import {
  Animated,
  Easing,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  Alert,
} from 'react-native';
import { useEffect, useMemo, useRef } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useThemeColor } from '@/hooks/use-theme-color';
import { useTranscription } from '@/contexts/transcription-context';
import { TranscriptionMessage } from '@/types/transcription';

const AnimatedLinearGradient = Animated.createAnimatedComponent(LinearGradient);

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

  const colors = isSessionActive ? ['#F87171', '#EF4444'] : ['#34D399', '#22C55E'];

  return (
    <Pressable
      accessibilityLabel={isSessionActive ? '停止录音' : '开始录音'}
      onPress={toggleSession}
      style={styles.recordButtonWrapper}>
      <LinearGradient colors={colors} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.recordButton}>
        <View style={styles.recordButtonContent}>
          <ThemedText style={styles.recordButtonLabel} lightColor="#fff" darkColor="#fff">
            {isSessionActive ? (isRecording ? '录音中...' : '处理片段...') : '开始录音'}
          </ThemedText>
        </View>
        {isSessionActive ? (
          <AnimatedLinearGradient
            colors={[
              'rgba(255,255,255,0)',
              'rgba(255,255,255,0.35)',
              'rgba(255,255,255,0)',
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
  const cardLight = '#f8fafc';
  const cardDark = '#0f172a';
  const backgroundColor = useThemeColor({}, 'background');
  const { messages, error, clearError } = useTranscription();

  useEffect(() => {
    if (error) {
      Alert.alert('录音提示', error, [{ text: '确定', onPress: clearError }]);
    }
  }, [clearError, error]);

  const renderedMessages = useMemo(() => messages.slice().reverse(), [messages]);

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor }]} edges={['top']}>
      <ThemedView style={styles.container}>
        <View style={styles.topBar}>
          <ThemedText type="title" style={styles.topBarTitle}>
            转写
          </ThemedText>
        </View>
        <View style={styles.content}>
          <ThemedView style={styles.card} lightColor={cardLight} darkColor={cardDark}>
            <View style={styles.headerRow}>
              <ThemedText type="subtitle" style={styles.sectionTitle}>
                转写内容
              </ThemedText>
              <RecordingToggle />
            </View>
            <View style={styles.dialogueContainer}>
              <ScrollView
                style={styles.dialogueScroll}
                contentContainerStyle={messages.length === 0 ? styles.emptyDialogue : styles.dialogueContent}
                showsVerticalScrollIndicator={false}>
                {messages.length === 0
                  ? null
                  : renderedMessages.map((item) => <MessageBubble key={item.id} message={item} />)}
              </ScrollView>
            </View>
          </ThemedView>
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
    fontWeight: '700',
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
    paddingBottom: 24,
  },
  card: {
    flex: 1,
    borderRadius: 24,
    padding: 20,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.08,
    shadowRadius: 24,
    elevation: 6,
    gap: 20,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionTitle: {
    fontSize: 24,
    fontWeight: '700',
  },
  recordButtonWrapper: {
    borderRadius: 999,
    overflow: 'hidden',
  },
  recordButton: {
    borderRadius: 999,
    paddingVertical: 12,
    paddingHorizontal: 24,
    minWidth: 140,
    justifyContent: 'center',
  },
  recordButtonContent: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  recordButtonLabel: {
    fontSize: 16,
    fontWeight: '600',
  },
  shimmer: {
    position: 'absolute',
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
    paddingBottom: 4,
  },
  emptyDialogue: {
    paddingBottom: 4,
  },
  dialogueLine: {
    fontSize: 16,
    lineHeight: 24,
  },
  messageBubble: {
    borderRadius: 16,
    padding: 16,
    backgroundColor: 'rgba(148, 163, 184, 0.08)',
    gap: 8,
  },
  messageTitle: {
    fontSize: 15,
    fontWeight: '600',
  },
  messageStatus: {
    fontSize: 13,
    opacity: 0.7,
  },
  messageBody: {
    fontSize: 16,
    lineHeight: 24,
  },
  translationBox: {
    marginTop: 8,
    padding: 12,
    borderRadius: 12,
    backgroundColor: 'rgba(34, 197, 94, 0.12)',
    gap: 4,
  },
  translationLabel: {
    fontSize: 13,
    fontWeight: '600',
  },
  translationBody: {
    fontSize: 15,
    lineHeight: 22,
  },
  translationError: {
    marginTop: 6,
    fontSize: 13,
    color: '#f87171',
  },
});

function MessageBubble({ message }: { message: TranscriptionMessage }) {
  const statusLabel = useMemo(() => {
    switch (message.status) {
      case 'pending':
        return '等待触发';
      case 'transcribing':
        return '转写中';
      case 'failed':
        return '转写失败';
      default:
        return '完成';
    }
  }, [message.status]);

  return (
    <ThemedView style={styles.messageBubble}>
      <ThemedText style={styles.messageTitle}>{message.title}</ThemedText>
      <ThemedText style={styles.messageStatus}>{statusLabel}</ThemedText>
      <ThemedText style={styles.messageBody}>
        {message.transcript && message.transcript.length > 0
          ? message.transcript
          : message.status === 'failed'
          ? message.error || '未能获取文字内容'
          : '等待转写结果...'}
      </ThemedText>
      {message.translationStatus !== 'completed' || !message.translation ? null : (
        <ThemedView style={styles.translationBox}>
          <ThemedText style={styles.translationLabel}>翻译</ThemedText>
          <ThemedText style={styles.translationBody}>{message.translation}</ThemedText>
        </ThemedView>
      )}
      {message.translationStatus === 'failed' ? (
        <ThemedText style={styles.translationError}>
          {message.translationError || '翻译失败'}
        </ThemedText>
      ) : null}
    </ThemedView>
  );
}
