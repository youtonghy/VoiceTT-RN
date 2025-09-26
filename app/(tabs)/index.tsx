import { LinearGradient } from 'expo-linear-gradient';
import {
  Animated,
  Easing,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { useCallback, useEffect, useRef, useState } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useThemeColor } from '@/hooks/use-theme-color';

const AnimatedLinearGradient = Animated.createAnimatedComponent(LinearGradient);

function RecordingToggle() {
  const [recording, setRecording] = useState(false);
  const shimmerProgress = useRef(new Animated.Value(0)).current;
  const shimmerLoop = useRef<Animated.CompositeAnimation | null>(null);

  useEffect(() => {
    return () => {
      shimmerLoop.current?.stop();
    };
  }, []);

  useEffect(() => {
    if (recording) {
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
  }, [recording, shimmerProgress]);

  const shimmerTranslate = shimmerProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [-120, 120],
  });

  const colors = recording ? ['#F87171', '#EF4444'] : ['#34D399', '#22C55E'];

  return (
    <Pressable
      accessibilityLabel={recording ? '停止录音' : '开始录音'}
      onPress={() => setRecording((prev) => !prev)}
      style={styles.recordButtonWrapper}>
      <LinearGradient colors={colors} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.recordButton}>
        <View style={styles.recordButtonContent}>
          <ThemedText style={styles.recordButtonLabel} lightColor="#fff" darkColor="#fff">
            {recording ? '停止录音' : '开始录音'}
          </ThemedText>
        </View>
        {recording ? (
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
  const [messages, setMessages] = useState<string[]>([]);
  const appendMessage = useCallback((message: string) => {
    setMessages((prev) => [...prev, message]);
  }, []);

  useEffect(() => {
    // Integrate your backend or message bus subscription here and call appendMessage as new text arrives.
    return () => {
      // Clean up subscription when the component unmounts.
    };
  }, [appendMessage]);

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
                  : messages.map((item, index) => (
                      <ThemedText key={`${index}-${item}`} style={styles.dialogueLine}>
                        {item}
                      </ThemedText>
                    ))}
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
});
