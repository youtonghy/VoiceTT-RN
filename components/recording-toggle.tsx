import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useRef } from 'react';
import Feather from '@expo/vector-icons/Feather';
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
  compact?: boolean;
  variant?: 'icon' | 'full';
};

export function RecordingToggle({ compact = false, qaAutoEnabled = false, variant = 'icon' }: RecordingToggleProps = {}) {
  const { isSessionActive, toggleSession, sessionState } = useTranscription();
  const { t } = useTranslation();
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

  const label = sessionState === 'recording'
    ? t('transcription.status.recording')
    : sessionState === 'starting' || sessionState === 'stopping'
    ? t('transcription.status.processing')
    : sessionState === 'failed'
    ? t('transcription.status.failed')
    : t('transcription.controls.start');

  const isFull = variant === 'full';
  const isCompactFull = isFull && compact;
  const isBusy = sessionState === 'starting' || sessionState === 'stopping';

  return (
    <Pressable
      accessibilityLabel={accessibilityLabel}
      disabled={isBusy}
      onPress={() => {
        void toggleSession({ qaAutoEnabled });
      }}
      style={[
        styles.recordButtonWrapper,
        isFull && (isCompactFull ? styles.recordButtonWrapperCompactFull : styles.recordButtonWrapperFull),
        isBusy && styles.recordButtonWrapperDisabled,
      ]}>
      <LinearGradient
        colors={colors}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.recordButton, isFull && (isCompactFull ? styles.recordButtonCompactFull : styles.recordButtonFull)]}>
        <View style={[styles.recordButtonContent, isFull && styles.recordButtonContentFull]}>
          <Feather
            name={isSessionActive ? 'square' : 'mic'}
            size={isFull ? 20 : 22}
            color="#fff"
          />
          {isFull ? (
            <ThemedText
              numberOfLines={1}
              ellipsizeMode="tail"
              style={styles.recordButtonLabel}
              lightColor="#fff"
              darkColor="#fff">
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
    borderRadius: 22,
    overflow: 'hidden',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 10,
  },
  recordButtonWrapperFull: {
    width: '100%',
  },
  recordButtonWrapperCompactFull: {
    flexShrink: 0,
    width: 148,
  },
  recordButtonWrapperDisabled: {
    opacity: 0.75,
  },
  recordButton: {
    width: 54,
    height: 54,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  recordButtonFull: {
    width: '100%',
    height: 52,
    flexDirection: 'row',
    paddingHorizontal: 24,
  },
  recordButtonCompactFull: {
    width: 148,
    height: 42,
    flexDirection: 'row',
    paddingHorizontal: 16,
  },
  recordButtonContent: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  recordButtonContentFull: {
    flexDirection: 'row',
    gap: 10,
  },
  recordButtonLabel: {
    flexShrink: 1,
    fontSize: 14,
    fontWeight: '600',
  },
  recordButtonShimmer: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    opacity: 0.85,
  },
  recordButtonShimmerIcon: {
    width: 54,
  },
  recordButtonShimmerFull: {
    width: '100%',
  },
});
