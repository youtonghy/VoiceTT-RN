import Feather from '@expo/vector-icons/Feather';
import {
  getRecordingPermissionsAsync,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  useAudioRecorder,
} from 'expo-audio';
import { deleteAsync } from 'expo-file-system/legacy';
import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  Alert,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { Button, Spinner, useThemeColor } from 'heroui-native';

import { useSettings } from '@/contexts/settings-context';
import { transcribeSegment, type TranscriptionSegmentPayload } from '@/services/transcription';
import { VOICE_INPUT_RECORDING_OPTIONS } from '@/constants/voice-input';

type VoiceInputButtonProps = {
  onInsert: (text: string) => void;
  style?: StyleProp<ViewStyle>;
};

type ButtonStatus = 'idle' | 'recording' | 'processing';

export default function VoiceInputButton({ onInsert, style }: VoiceInputButtonProps) {
  const { t } = useTranslation();
  const { settings } = useSettings();
  const recorder = useAudioRecorder(VOICE_INPUT_RECORDING_OPTIONS);
  const [accentSoftForeground, dangerForeground] = useThemeColor([
    'accent-soft-foreground',
    'danger-foreground',
  ]);
  const [status, setStatus] = useState<ButtonStatus>('idle');
  const messageCounterRef = useRef(1);

  const engineLabel = useMemo(
    () => t(`settings.transcription.engines.${settings.transcriptionEngine}`),
    [settings.transcriptionEngine, t]
  );

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
      Alert.alert(
        t('transcription.status.failed'),
        t('transcription.errors.unable_to_start', {
          message: (modeError as Error)?.message ?? 'unknown',
        })
      );
      return false;
    }
  }, [t]);

  const cleanupFile = useCallback(async (uri: string | null | undefined) => {
    if (!uri) {
      return;
    }
    try {
      await deleteAsync(uri, { idempotent: true });
    } catch (error) {
      if (__DEV__) {
        console.warn('[voice-input] Failed to delete recording file', error);
      }
    }
  }, []);

  const startRecording = useCallback(async () => {
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
      Alert.alert(
        t('transcription.status.failed'),
        t('transcription.errors.start_failed', {
          message: (startError as Error)?.message ?? 'unknown',
        })
      );
    }
  }, [ensurePermissionAndMode, recorder, t]);

  const stopAndTranscribe = useCallback(async () => {
    setStatus('processing');
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

      const result = await transcribeSegment(payload, settings);
      const transcript = result.text?.trim();

      if (!transcript) {
        throw new Error(t('transcription.errors.no_content'));
      }

      onInsert(transcript);
    } catch (error) {
      Alert.alert(
        t('transcription.status.failed'),
        (error as Error)?.message ?? t('transcription.status.failed')
      );
    } finally {
      const currentUri = recorder.uri;
      await cleanupFile(currentUri);
      setStatus('idle');
    }
  }, [cleanupFile, onInsert, recorder, settings, t]);

  const handlePress = useCallback(() => {
    if (status === 'processing') {
      return;
    }
    if (status === 'recording') {
      void stopAndTranscribe();
    } else {
      void startRecording();
    }
  }, [startRecording, status, stopAndTranscribe]);

  const accessibilityLabel = useMemo(() => {
    const base =
      status === 'recording'
        ? t('transcription.accessibility.stop_recording')
        : t('transcription.accessibility.start_recording');
    return `${base} (${engineLabel})`;
  }, [engineLabel, status, t]);

  const iconName = status === 'recording' ? 'square' : 'mic';

  return (
    <Button
      accessibilityLabel={accessibilityLabel}
      isDisabled={status === 'processing'}
      isIconOnly
      onPress={handlePress}
      size="lg"
      style={style}
      variant={status === 'recording' ? 'danger' : 'secondary'}>
      {status === 'processing' ? (
        <Spinner size="sm" />
      ) : (
        <Feather
          name={iconName}
          size={17}
          color={status === 'recording' ? dangerForeground : accentSoftForeground}
        />
      )}
    </Button>
  );
}
