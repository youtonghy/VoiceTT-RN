import Ionicons from '@expo/vector-icons/Ionicons';
import {
  getRecordingPermissionsAsync,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  useAudioRecorder,
  type RecordingOptions,
} from 'expo-audio';
import { deleteAsync } from 'expo-file-system/legacy';
import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  StyleSheet,
  View,
} from 'react-native';
import { useTranslation } from 'react-i18next';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useSettings } from '@/contexts/settings-context';
import { transcribeSegment, type TranscriptionSegmentPayload } from '@/services/transcription';
import { useColorScheme } from '@/hooks/use-color-scheme';

const recordingOptions: RecordingOptions = {
  isMeteringEnabled: false,
  android: {
    extension: '.m4a',
    outputFormat: 'mpeg4',
    audioEncoder: 'aac',
    sampleRate: 44100,
    numberOfChannels: 1,
    bitRate: 128000,
    audioSource: 'voice_recognition',
  },
  ios: {
    extension: '.m4a',
    audioQuality: 96,
    sampleRate: 44100,
    numberOfChannels: 1,
    bitRate: 128000,
    outputFormat: 'aac',
  },
  web: {
    mimeType: 'audio/webm',
    bitsPerSecond: 128000,
  },
};

type VoiceInputToolbarProps = {
  onInsert: (text: string) => void;
};

type ToolbarStatus = 'idle' | 'recording' | 'processing';

export function VoiceInputToolbar({ onInsert }: VoiceInputToolbarProps) {
  const { t } = useTranslation();
  const { settings } = useSettings();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const recorder = useAudioRecorder(recordingOptions);
  const [status, setStatus] = useState<ToolbarStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const messageCounterRef = useRef(1);

  const engineLabel = useMemo(() => {
    return t(`settings.voice_input.engines.${settings.voiceInputEngine}`);
  }, [settings.voiceInputEngine, t]);

  const indicatorColor = isDark ? '#38bdf8' : '#0ea5e9';

  const ensurePermissionAndMode = useCallback(async () => {
    try {
      let permission = await getRecordingPermissionsAsync();
      if (!permission.granted) {
        permission = await requestRecordingPermissionsAsync();
        if (!permission.granted) {
          Alert.alert(
            t('alerts.microphone_permission.title'),
            t('alerts.microphone_permission.message')
          );
          setError(t('transcription.errors.permission_denied'));
          return false;
        }
      }

      await setAudioModeAsync({
        allowsRecording: true,
        playsInSilentMode: true,
        shouldPlayInBackground: false,
        interruptionModeAndroid: 'duckOthers',
      });
      return true;
    } catch (modeError) {
      setError(
        t('transcription.errors.unable_to_start', {
          message: (modeError as Error)?.message ?? 'unknown',
        })
      );
      return false;
    }
  }, [t]);

  const cleanupFile = useCallback(async (uri: string | null | undefined) => {
    if (uri) {
      try {
        await deleteAsync(uri, { idempotent: true });
      } catch (cleanupError) {
        if (__DEV__) {
          console.warn('[voice-input] Failed to delete recording file', cleanupError);
        }
      }
    }
  }, []);

  const startRecording = useCallback(async () => {
    setError(null);
    const ready = await ensurePermissionAndMode();
    if (!ready) {
      return;
    }
    try {
      await recorder.prepareToRecordAsync();
      recorder.record();
      setStatus('recording');
    } catch (startError) {
      setStatus('idle');
      setError(
        t('transcription.errors.start_failed', {
          message: (startError as Error)?.message ?? 'unknown',
        })
      );
    }
  }, [ensurePermissionAndMode, recorder, t]);

  const stopAndTranscribe = useCallback(async () => {
    setStatus('processing');
    setError(null);
    try {
      await recorder.stop();
      const fileUri = recorder.uri;
      if (!fileUri) {
        throw new Error(t('transcription.errors.empty_recording'));
      }

      const statusInfo = recorder.getStatus();
      const durationMs = statusInfo.durationMillis ?? 0;

      const payload: TranscriptionSegmentPayload = {
        fileUri,
        startOffsetMs: 0,
        endOffsetMs: durationMs,
        durationMs,
        messageId: messageCounterRef.current++,
      };

      const voiceSettings = {
        ...settings,
        transcriptionEngine: settings.voiceInputEngine,
      };

      const result = await transcribeSegment(payload, voiceSettings);
      const transcript = result.text?.trim();

      if (!transcript) {
        throw new Error(t('transcription.errors.no_content'));
      }

      onInsert(transcript);
    } catch (processError) {
      setError((processError as Error)?.message ?? t('transcription.status.failed'));
    } finally {
      const currentUri = recorder.uri;
      await cleanupFile(currentUri);
      try {
        await recorder.reset();
      } catch (resetError) {
        if (__DEV__) {
          console.warn('[voice-input] Failed to reset recorder', resetError);
        }
      }
      setStatus('idle');
    }
  }, [cleanupFile, onInsert, recorder, settings, t]);

  const handleToggle = useCallback(() => {
    if (status === 'processing') {
      return;
    }
    if (status === 'recording') {
      void stopAndTranscribe();
    } else {
      void startRecording();
    }
  }, [startRecording, status, stopAndTranscribe]);

  const buttonLabel =
    status === 'recording'
      ? t('transcription.accessibility.stop_recording')
      : status === 'processing'
        ? t('transcription.status.transcribing')
        : t('transcription.accessibility.start_recording');

  const buttonIcon =
    status === 'recording'
      ? 'stop-circle'
      : status === 'processing'
        ? 'refresh'
        : 'mic-circle';

  return (
    <ThemedView
      style={styles.container}
      lightColor="rgba(15, 23, 42, 0.05)"
      darkColor="rgba(148, 163, 184, 0.14)">
      <View style={styles.metaRow}>
        <ThemedText
          style={styles.metaText}
          lightColor="#0f172a"
          darkColor="#e2e8f0">
          {t('settings.voice_input.labels.engine')}: {engineLabel}
        </ThemedText>
        {status === 'processing' ? (
          <ActivityIndicator size="small" color={indicatorColor} />
        ) : status === 'recording' ? (
          <ThemedText style={styles.statusText} lightColor="#ef4444" darkColor="#f87171">
            {t('transcription.status.recording')}
          </ThemedText>
        ) : null}
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={buttonLabel}
        onPress={handleToggle}
        disabled={status === 'processing'}
        style={({ pressed }) => [
          styles.controlButton,
          status === 'recording'
            ? styles.controlButtonRecording
            : styles.controlButtonIdle,
          pressed && styles.controlButtonPressed,
          status === 'processing' && styles.controlButtonDisabled,
        ]}>
        <Ionicons
          name={buttonIcon as any}
          size={22}
          color="#ffffff"
          style={styles.controlIcon}
        />
        <ThemedText style={styles.controlLabel} lightColor="#ffffff" darkColor="#ffffff">
          {buttonLabel}
        </ThemedText>
      </Pressable>
      {error ? (
        <ThemedText
          style={styles.errorText}
          lightColor="#b91c1c"
          darkColor="#fca5a5"
        >
          {error}
        </ThemedText>
      ) : null}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 18,
    padding: 12,
    gap: 12,
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  metaText: {
    fontSize: 13,
    fontWeight: '500',
  },
  statusText: {
    fontSize: 13,
    fontWeight: '600',
  },
  controlButton: {
    borderRadius: 999,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 20,
  },
  controlButtonIdle: {
    backgroundColor: '#2563eb',
  },
  controlButtonRecording: {
    backgroundColor: '#dc2626',
  },
  controlButtonPressed: {
    opacity: 0.9,
  },
  controlButtonDisabled: {
    opacity: 0.6,
  },
  controlIcon: {
    marginRight: 8,
  },
  controlLabel: {
    fontSize: 16,
    fontWeight: '600',
  },
  errorText: {
    fontSize: 12,
    lineHeight: 16,
  },
});

export default VoiceInputToolbar;
