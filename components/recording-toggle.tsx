import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useRef } from 'react';
import Ionicons from '@expo/vector-icons/Ionicons';
import {
  Animated,
  Easing,
  Pressable,
  StyleSheet,
  View,
  type ColorValue,
} from 'react-native';
import { useTranslation } from 'react-i18next';

import { ThemedText } from '@/components/themed-text';
import { useTranscription } from '@/contexts/transcription-context';

const AnimatedLinearGradient = Animated.createAnimatedComponent(LinearGradient);

type RecordingToggleProps = {
  qaAutoEnabled?: boolean;
  variant?: 'icon' | 'full';
};

export function RecordingToggle({ qaAutoEnabled = false, variant = 'icon' }: RecordingToggleProps = {}) {
  const { isSessionActive, toggleSession, isRecording } = useTranscription();
  const { t } = useTranslation();
  const shimmerProgress = useRef(new Animated.Value(0)).current;
  const shimmerLoop = useRef<Animated.CompositeAnimation | null>(null);

  console.log('[RecordingToggle] Render - isSessionActive:', isSessionActive, 'variant:', variant);

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
    outputRange: [-120, 300], // Increased range for full width
  });

  const colors: readonly [ColorValue, ColorValue] = isSessionActive
    ? ['#F87171', '#EF4444']
    : ['#34D399', '#22C55E'];
  const shimmerColors: readonly [ColorValue, ColorValue, ColorValue] = [
    'rgba(255,255,255,0)',
    'rgba(255,255,255,0.35)',
    'rgba(255,255,255,0)',
  ];

  const accessibilityLabel = isSessionActive
    ? t('transcription.accessibility.stop_recording')
    : t('transcription.accessibility.start_recording');

  const label = isSessionActive
    ? isRecording
      ? t('transcription.status.recording')
      : t('transcription.status.processing')
    : t('transcription.controls.start');

  const isFull = variant === 'full';

  return (
    <Pressable
      accessibilityLabel={accessibilityLabel}
      onPress={() => {
        console.log('[RecordingToggle] Button pressed');
        void toggleSession({ qaAutoEnabled });
      }}
      style={[styles.recordButtonWrapper, isFull && styles.recordButtonWrapperFull]}>
      <LinearGradient
        colors={colors}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.recordButton, isFull && styles.recordButtonFull]}>
        <View style={[styles.recordButtonContent, isFull && styles.recordButtonContentFull]}>
          <Ionicons
            name={isSessionActive ? "stop" : "mic"}
            size={24}
            color="#fff"
          />
          {isFull ? (
            <ThemedText style={styles.recordButtonLabel} lightColor="#fff" darkColor="#fff">
              {label}
            </ThemedText>
          ) : null}
        </View>
        {isSessionActive ? (
          <AnimatedLinearGradient
            colors={shimmerColors}
            start={{ x: 0, y: 0.5 }}
            end={{ x: 1, y: 0.5 }}
            style={[
              styles.recordButtonShimmer,
              isFull ? styles.recordButtonShimmerFull : styles.recordButtonShimmerIcon,
              { transform: [{ translateX: shimmerTranslate }] }
            ]}
          />
        ) : null}
      </LinearGradient>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  recordButtonWrapper: {
    borderRadius: 30,
    overflow: 'hidden',
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.16,
    shadowRadius: 12,
  },
  recordButtonWrapperFull: {
    width: '100%',
  },
  recordButton: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  recordButtonFull: {
    width: '100%',
    height: 56,
    flexDirection: 'row',
    paddingHorizontal: 24,
  },
  recordButtonContent: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  recordButtonContentFull: {
    flexDirection: 'row',
    gap: 12,
  },
  recordButtonLabel: {
    fontSize: 18,
    fontWeight: '600',
  },
  recordButtonShimmer: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    opacity: 0.85,
  },
  recordButtonShimmerIcon: {
    width: 60,
  },
  recordButtonShimmerFull: {
    width: '100%',
  },
});
