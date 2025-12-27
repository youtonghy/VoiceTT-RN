/**
 * 页面名称：录音设置 (Recording Settings)
 * 文件路径：app/(tabs)/explore/recording.tsx
 * 功能描述：配置录音参数，包括采样率、声道、比特率、静音检测以及录音预设。
 */

import {
    getRecordingPermissionsAsync,
    requestRecordingPermissionsAsync,
    setAudioModeAsync,
    useAudioRecorder,
    type RecordingOptions,
} from 'expo-audio';
import { deleteAsync } from 'expo-file-system/legacy';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
    Alert,
    KeyboardAvoidingView,
    Platform,
    ScrollView,
    StyleSheet,
    TextInput,
    View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { useSettings } from '@/contexts/settings-context';
import { useColorScheme } from '@/hooks/use-color-scheme';
import type { AppSettings, RecordingPreset } from '@/types/settings';

import {
    CARD_SUBTLE_DARK,
    CARD_SUBTLE_LIGHT,
    CARD_TEXT_DARK,
    CARD_TEXT_LIGHT,
    NumericSettingKey,
    OptionPill,
    SettingsCard,
    formatNumberInput,
    settingsStyles,
    useSettingsForm,
} from './shared';

// --- 常量与配置 ---
const METERING_RECORDING_OPTIONS: RecordingOptions = {
  isMeteringEnabled: true,
  extension: '.m4a',
  sampleRate: 44100,
  numberOfChannels: 1,
  bitRate: 128000,
  android: {
    outputFormat: 'mpeg4',
    audioEncoder: 'aac',
    audioSource: 'voice_recognition',
  },
  ios: {
    audioQuality: 96,
    outputFormat: 'aac',
  },
  web: {
    mimeType: 'audio/webm',
    bitsPerSecond: 128000,
  },
};

const WEB_METERING_INTERVAL_MS = 120;
const WEB_METERING_MIN_DB = -160;

const createPresetId = () => `preset-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
type PresetNumericValues = Omit<RecordingPreset, 'id' | 'name'>;
type DesktopAudioInputOption = {
  id: string;
  label: string;
};

export default function RecordingSettingsScreen() {
  const { t } = useTranslation();
  const { settings, updateSettings } = useSettings();
  const { formState, setFormState } = useSettingsForm(settings);
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const insets = useSafeAreaInsets();
  const [presetName, setPresetName] = useState('');
  const recorder = useAudioRecorder(METERING_RECORDING_OPTIONS);
  const [isMonitoring, setIsMonitoring] = useState(false);
  const [meteringDb, setMeteringDb] = useState<number | null>(null);
  const statusIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const isDesktopApp =
    Platform.OS === 'web' &&
    typeof window !== 'undefined' &&
    Boolean((window as { electron?: unknown }).electron);
  const [desktopInputs, setDesktopInputs] = useState<DesktopAudioInputOption[]>([]);
  const [desktopInputError, setDesktopInputError] = useState<string | null>(null);
  const [isTestingInput, setIsTestingInput] = useState(false);
  const [hasInputSignal, setHasInputSignal] = useState(false);
  const inputTestRef = useRef<{
    stream: MediaStream | null;
    context: AudioContext | null;
    analyser: AnalyserNode | null;
    intervalId: NodeJS.Timeout | null;
  }>({
    stream: null,
    context: null,
    analyser: null,
    intervalId: null,
  });
  const webMeteringRef = useRef<{
    stream: MediaStream | null;
    context: AudioContext | null;
    analyser: AnalyserNode | null;
    intervalId: NodeJS.Timeout | null;
  }>({
    stream: null,
    context: null,
    analyser: null,
    intervalId: null,
  });

  const inputStyle = [settingsStyles.input, isDark && settingsStyles.inputDark];
  const labelStyle = [settingsStyles.fieldLabel, isDark && settingsStyles.fieldLabelDark];
  const placeholderTextColor = isDark ? '#94a3b8' : '#64748b';
  const safeAreaStyle = [
    settingsStyles.safeArea,
    isDark ? settingsStyles.safeAreaDark : settingsStyles.safeAreaLight,
  ];
  const scrollContentStyle = useMemo(
    () => [settingsStyles.scrollContent, { paddingBottom: 32 + insets.bottom }],
    [insets.bottom]
  );
  const monitoringButtonLabel = useMemo(
    () =>
      isMonitoring
        ? t('settings.recording.metering.action_stop')
        : t('settings.recording.metering.action_start'),
    [isMonitoring, t]
  );
  const thresholdDb = useMemo(() => {
    const value = settings.activationThreshold;
    if (!Number.isFinite(value) || value <= 0) {
      return null;
    }
    return Math.round(20 * Math.log10(value) * 10) / 10;
  }, [settings.activationThreshold]);
  const meteringLabel = useMemo(() => {
    if (!isMonitoring || meteringDb == null) {
      return t('settings.recording.metering.idle');
    }
    return `${meteringDb.toFixed(1)} dB`;
  }, [isMonitoring, meteringDb, t]);
  const thresholdLabel = useMemo(() => {
    if (thresholdDb == null) {
      return t('settings.recording.metering.not_available');
    }
    return `${thresholdDb.toFixed(1)} dB`;
  }, [thresholdDb, t]);
  const recognitionStatus = useMemo(() => {
    if (!isMonitoring) {
      return t('settings.recording.metering.status_off');
    }
    if (meteringDb == null) {
      return t('settings.recording.metering.status_no_signal');
    }
    if (thresholdDb == null) {
      return t('settings.recording.metering.status_unknown');
    }
    return meteringDb >= thresholdDb
      ? t('settings.recording.metering.status_above_threshold')
      : t('settings.recording.metering.status_below_threshold');
  }, [isMonitoring, meteringDb, thresholdDb, t]);
  const snapshotItems = useMemo(() => ([
    {
      key: 'meteringDb',
      label: t('settings.recording.metering.current_db'),
      value: meteringLabel,
    },
    {
      key: 'activationThresholdDb',
      label: t('settings.recording.metering.threshold_db'),
      value: thresholdLabel,
    },
    {
      key: 'recognitionStatus',
      label: t('settings.recording.metering.status_label'),
      value: recognitionStatus,
    },
  ]), [
    meteringLabel,
    thresholdLabel,
    recognitionStatus,
    t,
  ]);
  const selectedDesktopInputId = settings.desktopAudioInputId;
  const inputTestStatusLabel = useMemo(() => {
    if (!isTestingInput) {
      return t('settings.recording.input.status_idle');
    }
    return hasInputSignal
      ? t('settings.recording.input.status_signal')
      : t('settings.recording.input.status_listening');
  }, [hasInputSignal, isTestingInput, t]);

  const clearStatusInterval = useCallback(() => {
    if (statusIntervalRef.current) {
      clearInterval(statusIntervalRef.current);
      statusIntervalRef.current = null;
    }
  }, []);

  const cleanupRecordingFile = useCallback(async (uri?: string | null) => {
    if (!uri) {
      return;
    }
    try {
      if (Platform.OS === 'web' && uri.startsWith('blob:')) {
        URL.revokeObjectURL(uri);
        return;
      }
      await deleteAsync(uri, { idempotent: true });
    } catch (error) {
      if (__DEV__) {
        console.warn('[recording-settings] Failed to delete metering file', error);
      }
    }
  }, []);

  const stopMonitoringSilently = useCallback(async () => {
    clearStatusInterval();
    if (webMeteringRef.current.intervalId) {
      clearInterval(webMeteringRef.current.intervalId);
      webMeteringRef.current.intervalId = null;
    }
    if (webMeteringRef.current.stream) {
      webMeteringRef.current.stream.getTracks().forEach((track) => track.stop());
      webMeteringRef.current.stream = null;
    }
    if (webMeteringRef.current.context) {
      try {
        await webMeteringRef.current.context.close();
      } catch (error) {
        if (__DEV__) {
          console.warn('[recording-settings] Failed to close web metering context', error);
        }
      }
      webMeteringRef.current.context = null;
    }
    webMeteringRef.current.analyser = null;
    if (recorder.isRecording) {
      try {
        await recorder.stop();
      } catch (error) {
        if (__DEV__) {
          console.warn('[recording-settings] Failed to stop metering recorder', error);
        }
      }
    }
    const currentUri = recorder.uri;
    await cleanupRecordingFile(currentUri);
  }, [cleanupRecordingFile, clearStatusInterval, recorder]);

  useEffect(() => () => {
    void stopMonitoringSilently();
  }, [stopMonitoringSilently]);

  const refreshDesktopInputs = useCallback(
    async (requestPermission: boolean) => {
      if (!isDesktopApp || typeof navigator === 'undefined' || !navigator.mediaDevices?.enumerateDevices) {
        return;
      }
      console.log('[desktop-input] Refresh requested', { requestPermission });
      setDesktopInputError(null);
      try {
        if (requestPermission) {
          let permission = await getRecordingPermissionsAsync();
          if (!permission.granted) {
            permission = await requestRecordingPermissionsAsync();
            if (!permission.granted) {
              console.log('[desktop-input] Permission denied while refreshing devices');
              Alert.alert(
                t('alerts.microphone_permission.title'),
                t('alerts.microphone_permission.message')
              );
              return;
            }
          }
        }
        const devices = await navigator.mediaDevices.enumerateDevices();
        const audioInputs = devices
          .filter((device) => device.kind === 'audioinput')
          .filter((device) => device.deviceId !== 'default')
          .map((device, index) => ({
            id: device.deviceId,
            label:
              device.label?.trim() ||
              t('settings.recording.input.unknown_device', { index: index + 1 }),
          }));
        setDesktopInputs(audioInputs);
        console.log('[desktop-input] Devices refreshed', {
          count: audioInputs.length,
          selectedDeviceId: selectedDesktopInputId,
        });
      } catch (error) {
        if (__DEV__) {
          console.warn('[recording-settings] Failed to enumerate audio inputs', error);
        }
        console.log('[desktop-input] Refresh failed', {
          message: (error as Error)?.message ?? 'unknown',
        });
        setDesktopInputError(t('settings.recording.input.load_failed'));
      }
    },
    [isDesktopApp, selectedDesktopInputId, t]
  );

  useEffect(() => {
    if (!isDesktopApp || typeof navigator === 'undefined' || !navigator.mediaDevices) {
      return;
    }
    void refreshDesktopInputs(false);
    const handleDeviceChange = () => {
      console.log('[desktop-input] Device change detected');
      void refreshDesktopInputs(false);
    };
    navigator.mediaDevices.addEventListener?.('devicechange', handleDeviceChange);
    return () => {
      navigator.mediaDevices.removeEventListener?.('devicechange', handleDeviceChange);
    };
  }, [isDesktopApp, refreshDesktopInputs]);

  const stopInputTest = useCallback(async () => {
    if (inputTestRef.current.intervalId) {
      clearInterval(inputTestRef.current.intervalId);
      inputTestRef.current.intervalId = null;
    }
    if (inputTestRef.current.stream) {
      inputTestRef.current.stream.getTracks().forEach((track) => track.stop());
      inputTestRef.current.stream = null;
    }
    if (inputTestRef.current.context) {
      try {
        await inputTestRef.current.context.close();
      } catch (error) {
        if (__DEV__) {
          console.warn('[recording-settings] Failed to close input test context', error);
        }
      }
      inputTestRef.current.context = null;
    }
    inputTestRef.current.analyser = null;
    setIsTestingInput(false);
    setHasInputSignal(false);
    console.log('[desktop-input] Test stopped');
  }, []);

  useEffect(() => () => {
    void stopInputTest();
  }, [stopInputTest]);

  const startInputTest = useCallback(
    async (overrideDeviceId?: string | null) => {
      if (!isDesktopApp) {
        return;
      }
      await stopInputTest();
      setDesktopInputError(null);
      if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
        setDesktopInputError(t('settings.recording.input.test_failed'));
        return;
      }

      try {
        let permission = await getRecordingPermissionsAsync();
        if (!permission.granted) {
          permission = await requestRecordingPermissionsAsync();
          if (!permission.granted) {
            console.log('[desktop-input] Permission denied while starting test');
            Alert.alert(
              t('alerts.microphone_permission.title'),
              t('alerts.microphone_permission.message')
            );
            return;
          }
        }

        const AudioContextConstructor =
          (window as typeof window & { webkitAudioContext?: typeof AudioContext }).AudioContext ||
          (window as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (!AudioContextConstructor) {
          setDesktopInputError(t('settings.recording.input.test_failed'));
          return;
        }

        const activeDeviceId = overrideDeviceId ?? selectedDesktopInputId;
        console.log('[desktop-input] Test starting', { deviceId: activeDeviceId ?? 'default' });
        const constraints: MediaStreamConstraints = activeDeviceId
          ? { audio: { deviceId: { exact: activeDeviceId } }, video: false }
          : { audio: true, video: false };
        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        const context = new AudioContextConstructor();
        if (context.state === 'suspended') {
          await context.resume();
        }
        const analyser = context.createAnalyser();
        analyser.fftSize = 2048;
        const source = context.createMediaStreamSource(stream);
        source.connect(analyser);

        const data = new Uint8Array(analyser.fftSize);
        const threshold = 0.02;

        inputTestRef.current.stream = stream;
        inputTestRef.current.context = context;
        inputTestRef.current.analyser = analyser;
        inputTestRef.current.intervalId = setInterval(() => {
          analyser.getByteTimeDomainData(data);
          let sum = 0;
          for (let index = 0; index < data.length; index += 1) {
            const normalized = (data[index] - 128) / 128;
            sum += normalized * normalized;
          }
          const rms = Math.sqrt(sum / data.length);
          const nextHasSignal = rms >= threshold;
          setHasInputSignal((prev) => (prev === nextHasSignal ? prev : nextHasSignal));
        }, 120);

        setIsTestingInput(true);
        setHasInputSignal(false);
        void refreshDesktopInputs(false);
      } catch (error) {
        if (__DEV__) {
          console.warn('[recording-settings] Failed to start input test', error);
        }
        console.log('[desktop-input] Test failed', {
          message: (error as Error)?.message ?? 'unknown',
        });
        setDesktopInputError(t('settings.recording.input.test_failed'));
        await stopInputTest();
      }
    },
    [
      isDesktopApp,
      refreshDesktopInputs,
      selectedDesktopInputId,
      stopInputTest,
      t,
    ]
  );

  const startWebMetering = useCallback(async () => {
    if (!isDesktopApp) {
      return;
    }
    if (webMeteringRef.current.intervalId) {
      clearInterval(webMeteringRef.current.intervalId);
      webMeteringRef.current.intervalId = null;
    }
    if (webMeteringRef.current.stream) {
      webMeteringRef.current.stream.getTracks().forEach((track) => track.stop());
      webMeteringRef.current.stream = null;
    }
    if (webMeteringRef.current.context) {
      try {
        await webMeteringRef.current.context.close();
      } catch (error) {
        if (__DEV__) {
          console.warn('[recording-settings] Failed to close web metering context', error);
        }
      }
      webMeteringRef.current.context = null;
    }
    webMeteringRef.current.analyser = null;

    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      throw new Error('mediaDevices unavailable');
    }

    const AudioContextConstructor =
      (window as typeof window & { webkitAudioContext?: typeof AudioContext }).AudioContext ||
      (window as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextConstructor) {
      throw new Error('AudioContext unavailable');
    }

    const constraints: MediaStreamConstraints = selectedDesktopInputId
      ? { audio: { deviceId: { exact: selectedDesktopInputId } }, video: false }
      : { audio: true, video: false };
    const stream = await navigator.mediaDevices.getUserMedia(constraints);
    const context = new AudioContextConstructor();
    if (context.state === 'suspended') {
      await context.resume();
    }
    const analyser = context.createAnalyser();
    analyser.fftSize = 2048;
    analyser.smoothingTimeConstant = 0.85;
    const source = context.createMediaStreamSource(stream);
    source.connect(analyser);

    const data = new Uint8Array(analyser.fftSize);

    webMeteringRef.current.stream = stream;
    webMeteringRef.current.context = context;
    webMeteringRef.current.analyser = analyser;
    webMeteringRef.current.intervalId = setInterval(() => {
      analyser.getByteTimeDomainData(data);
      let sum = 0;
      for (let index = 0; index < data.length; index += 1) {
        const normalized = (data[index] - 128) / 128;
        sum += normalized * normalized;
      }
      const rms = Math.sqrt(sum / data.length);
      const dbValue = rms > 0 ? 20 * Math.log10(rms) : WEB_METERING_MIN_DB;
      const clamped = Math.max(WEB_METERING_MIN_DB, dbValue);
      const rounded = Math.round(clamped * 10) / 10;
      setMeteringDb((prev) => (prev === rounded ? prev : rounded));
    }, WEB_METERING_INTERVAL_MS);
  }, [isDesktopApp, selectedDesktopInputId]);

  const handleToggleInputTest = useCallback(() => {
    if (isTestingInput) {
      console.log('[desktop-input] Test toggle: stop');
      void stopInputTest();
    } else {
      console.log('[desktop-input] Test toggle: start');
      void startInputTest();
    }
  }, [isTestingInput, startInputTest, stopInputTest]);

  const startMonitoring = useCallback(async () => {
    try {
      setMeteringDb(null);
      if (isDesktopApp) {
        if (webMeteringRef.current.intervalId) {
          return;
        }
        await startWebMetering();
        setIsMonitoring(true);
        return;
      }

      if (recorder.isRecording) {
        return;
      }

      let permission = await getRecordingPermissionsAsync();
      if (!permission.granted) {
        permission = await requestRecordingPermissionsAsync();
        if (!permission.granted) {
          Alert.alert(
            t('alerts.microphone_permission.title'),
            t('alerts.microphone_permission.message')
          );
          return;
        }
      }

      await setAudioModeAsync({
        allowsRecording: true,
        playsInSilentMode: true,
        shouldPlayInBackground: false,
        interruptionModeAndroid: 'duckOthers',
      });

      await recorder.prepareToRecordAsync();
      recorder.record();
      setIsMonitoring(true);

      clearStatusInterval();
      statusIntervalRef.current = setInterval(() => {
        const status = recorder.getStatus();
        const normalized =
          typeof status.metering === 'number' && Number.isFinite(status.metering)
            ? status.metering
            : null;
        const rounded =
          typeof normalized === 'number' ? Math.round(normalized * 10) / 10 : null;
        setMeteringDb((prev) => (prev === rounded ? prev : rounded));
      }, 100);
    } catch (error) {
      Alert.alert(
        t('transcription.status.failed'),
        t('transcription.errors.unable_to_start', {
          message: (error as Error)?.message ?? 'unknown',
        })
      );
      setIsMonitoring(false);
      setMeteringDb(null);
    }
  }, [clearStatusInterval, isDesktopApp, recorder, startWebMetering, t]);

  const stopMonitoring = useCallback(async () => {
    clearStatusInterval();
    if (webMeteringRef.current.intervalId) {
      clearInterval(webMeteringRef.current.intervalId);
      webMeteringRef.current.intervalId = null;
    }
    if (webMeteringRef.current.stream) {
      webMeteringRef.current.stream.getTracks().forEach((track) => track.stop());
      webMeteringRef.current.stream = null;
    }
    if (webMeteringRef.current.context) {
      try {
        await webMeteringRef.current.context.close();
      } catch (error) {
        if (__DEV__) {
          console.warn('[recording-settings] Failed to close web metering context', error);
        }
      }
      webMeteringRef.current.context = null;
    }
    webMeteringRef.current.analyser = null;
    if (recorder.isRecording) {
      try {
        await recorder.stop();
      } catch (error) {
        if (__DEV__) {
          console.warn('[recording-settings] Failed to stop metering recorder', error);
        }
      }
    }
    const currentUri = recorder.uri;
    await cleanupRecordingFile(currentUri);
    setIsMonitoring(false);
    setMeteringDb(null);
  }, [cleanupRecordingFile, clearStatusInterval, recorder]);

  const handleSelectDesktopInput = useCallback(
    (deviceId: string | null) => {
      console.log('[desktop-input] Device selected', { deviceId: deviceId ?? 'default' });
      updateSettings({ desktopAudioInputId: deviceId });
      if (isTestingInput) {
        void startInputTest(deviceId);
      }
      if (isMonitoring && isDesktopApp) {
        void stopMonitoring().then(() => startMonitoring());
      }
    },
    [isDesktopApp, isMonitoring, startInputTest, startMonitoring, stopMonitoring, updateSettings]
  );

  const handleToggleMonitoring = useCallback(() => {
    if (isMonitoring) {
      void stopMonitoring();
    } else {
      void startMonitoring();
    }
  }, [isMonitoring, startMonitoring, stopMonitoring]);

  const numericFormValues = useMemo<PresetNumericValues | null>(() => {
    const activationThreshold = parseFloat(formState.activationThreshold);
    const activationDurationSec = parseFloat(formState.activationDurationSec);
    const silenceDurationSec = parseFloat(formState.silenceDurationSec);
    const preRollDurationSec = parseFloat(formState.preRollDurationSec);
    const maxSegmentDurationSec = parseFloat(formState.maxSegmentDurationSec);
    const values: PresetNumericValues = {
      activationThreshold,
      activationDurationSec,
      silenceDurationSec,
      preRollDurationSec,
      maxSegmentDurationSec,
    };
    if (Object.values(values).some((value) => Number.isNaN(value))) {
      return null;
    }
    return values;
  }, [
    formState.activationThreshold,
    formState.activationDurationSec,
    formState.silenceDurationSec,
    formState.preRollDurationSec,
    formState.maxSegmentDurationSec,
  ]);

  const canSavePreset = Boolean(numericFormValues);

  const handleNumericCommit = (key: NumericSettingKey, value: string) => {
    const parsed = parseFloat(value);
    if (!Number.isNaN(parsed)) {
      updateSettings({ [key]: parsed, activeRecordingPresetId: null } as Partial<AppSettings>);
    }
  };

  const handleSavePreset = useCallback(() => {
    const values = numericFormValues;
    if (!values) {
      Alert.alert(
        t('settings.recording.presets.invalid_title'),
        t('settings.recording.presets.invalid_message')
      );
      return;
    }
    const trimmedName = presetName.trim();
    const fallbackName = t('settings.recording.presets.default_name', {
      index: settings.recordingPresets.length + 1,
    });
    const name = trimmedName.length > 0 ? trimmedName : fallbackName;
    const newPreset: RecordingPreset = {
      id: createPresetId(),
      name,
      ...values,
    };
    updateSettings({
      recordingPresets: [...settings.recordingPresets, newPreset],
      activeRecordingPresetId: newPreset.id,
      activationThreshold: newPreset.activationThreshold,
      activationDurationSec: newPreset.activationDurationSec,
      silenceDurationSec: newPreset.silenceDurationSec,
      preRollDurationSec: newPreset.preRollDurationSec,
      maxSegmentDurationSec: newPreset.maxSegmentDurationSec,
    });
    setPresetName('');
  }, [
    numericFormValues,
    presetName,
    settings.recordingPresets,
    t,
    updateSettings,
  ]);

  const handleApplyPreset = useCallback(
    (preset: RecordingPreset) => {
      updateSettings({
        activationThreshold: preset.activationThreshold,
        activationDurationSec: preset.activationDurationSec,
        silenceDurationSec: preset.silenceDurationSec,
        preRollDurationSec: preset.preRollDurationSec,
        maxSegmentDurationSec: preset.maxSegmentDurationSec,
        activeRecordingPresetId: preset.id,
      });
      setFormState((prev) => ({
        ...prev,
        activationThreshold: String(preset.activationThreshold),
        activationDurationSec: String(preset.activationDurationSec),
        silenceDurationSec: String(preset.silenceDurationSec),
        preRollDurationSec: String(preset.preRollDurationSec),
        maxSegmentDurationSec: String(preset.maxSegmentDurationSec),
      }));
    },
    [setFormState, updateSettings]
  );

  const handleDeletePreset = useCallback(
    (presetId: string) => {
      const nextPresets = settings.recordingPresets.filter((item) => item.id !== presetId);
      const nextActive =
        settings.activeRecordingPresetId === presetId ? null : settings.activeRecordingPresetId;
      updateSettings({
        recordingPresets: nextPresets,
        activeRecordingPresetId: nextActive,
      });
    },
    [settings.activeRecordingPresetId, settings.recordingPresets, updateSettings]
  );

  const confirmDeletePreset = useCallback(
    (preset: RecordingPreset) => {
      Alert.alert(
        t('settings.recording.presets.delete_title'),
        t('settings.recording.presets.delete_message', { name: preset.name }),
        [
          {
            text: t('settings.recording.presets.cancel'),
            style: 'cancel',
          },
          {
            text: t('settings.recording.presets.delete_button'),
            style: 'destructive',
            onPress: () => handleDeletePreset(preset.id),
          },
        ]
      );
    },
    [handleDeletePreset, t]
  );

  const renderNumericField = (
    labelKey: string,
    value: string,
    onChange: (text: string) => void,
    onCommitKey: NumericSettingKey,
  ) => (
    <View style={settingsStyles.fieldRow}>
      <ThemedText
        style={labelStyle}
        lightColor={CARD_SUBTLE_LIGHT}
        darkColor={CARD_SUBTLE_DARK}>
        {t(labelKey)}
      </ThemedText>
      <TextInput
        value={value}
        onChangeText={(text) => onChange(formatNumberInput(text))}
        onBlur={() => handleNumericCommit(onCommitKey, value)}
        keyboardType="decimal-pad"
        style={inputStyle}
        placeholderTextColor={placeholderTextColor}
      />
    </View>
  );

  return (
    <SafeAreaView style={safeAreaStyle} edges={['top', 'left', 'right']}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={settingsStyles.flex}>
        <ScrollView
          contentContainerStyle={scrollContentStyle}
          contentInsetAdjustmentBehavior="always"
          keyboardDismissMode="on-drag"
          keyboardShouldPersistTaps="handled">
          {isDesktopApp ? (
            <SettingsCard variant="system">
              <View style={recordingStyles.inputHeader}>
                <ThemedText
                  type="subtitle"
                  lightColor={CARD_TEXT_LIGHT}
                  darkColor={CARD_TEXT_DARK}>
                  {t('settings.recording.input.title')}
                </ThemedText>
                <OptionPill
                  label={t('settings.recording.input.refresh')}
                  active={false}
                  onPress={() => refreshDesktopInputs(true)}
                />
              </View>
              <ThemedText
                style={recordingStyles.inputDescription}
                lightColor={CARD_SUBTLE_LIGHT}
                darkColor={CARD_SUBTLE_DARK}>
                {t('settings.recording.input.description')}
              </ThemedText>
              <View style={settingsStyles.optionsRow}>
                <OptionPill
                  label={t('settings.recording.input.default')}
                  active={!selectedDesktopInputId}
                  onPress={() => handleSelectDesktopInput(null)}
                />
                {desktopInputs.map((device) => (
                  <OptionPill
                    key={device.id}
                    label={device.label}
                    active={selectedDesktopInputId === device.id}
                    onPress={() => handleSelectDesktopInput(device.id)}
                  />
                ))}
              </View>
              {desktopInputs.length === 0 ? (
                <ThemedText
                  style={recordingStyles.inputEmpty}
                  lightColor={CARD_SUBTLE_LIGHT}
                  darkColor={CARD_SUBTLE_DARK}>
                  {t('settings.recording.input.empty')}
                </ThemedText>
              ) : null}
              <View style={recordingStyles.inputTestRow}>
                <View style={recordingStyles.inputStatus}>
                  <View
                    style={[
                      recordingStyles.inputStatusDot,
                      isTestingInput
                        ? hasInputSignal
                          ? recordingStyles.inputStatusDotActive
                          : recordingStyles.inputStatusDotListening
                        : recordingStyles.inputStatusDotIdle,
                    ]}
                  />
                  <ThemedText
                    style={recordingStyles.inputStatusLabel}
                    lightColor={CARD_SUBTLE_LIGHT}
                    darkColor={CARD_SUBTLE_DARK}>
                    {inputTestStatusLabel}
                  </ThemedText>
                </View>
                <OptionPill
                  label={
                    isTestingInput
                      ? t('settings.recording.input.test_stop')
                      : t('settings.recording.input.test_start')
                  }
                  active={isTestingInput}
                  onPress={handleToggleInputTest}
                />
              </View>
              {desktopInputError ? (
                <ThemedText
                  style={recordingStyles.inputError}
                  lightColor={CARD_SUBTLE_LIGHT}
                  darkColor={CARD_SUBTLE_DARK}>
                  {desktopInputError}
                </ThemedText>
              ) : null}
            </SettingsCard>
          ) : null}
          <SettingsCard variant="system">
            <View style={settingsStyles.rowBetween}>
              <ThemedText
                type="subtitle"
                lightColor={CARD_TEXT_LIGHT}
                darkColor={CARD_TEXT_DARK}>
                {t('settings.recording.metering.title')}
              </ThemedText>
              <OptionPill
                label={monitoringButtonLabel}
                active={isMonitoring}
                onPress={handleToggleMonitoring}
              />
            </View>
            <View style={recordingStyles.presetMetaRow}>
              {snapshotItems.map((item) => (
                <View key={item.key} style={recordingStyles.presetMetaItem}>
                  <ThemedText
                    style={recordingStyles.presetMetaLabel}
                    lightColor={CARD_SUBTLE_LIGHT}
                    darkColor={CARD_SUBTLE_DARK}>
                    {item.label}
                  </ThemedText>
                  <ThemedText
                    style={recordingStyles.presetMetaValue}
                    lightColor={CARD_TEXT_LIGHT}
                    darkColor={CARD_TEXT_DARK}>
                    {item.value}
                  </ThemedText>
                </View>
              ))}
            </View>
          </SettingsCard>
          <SettingsCard variant="interaction">
            <View style={recordingStyles.presetCardHeader}>
              <ThemedText
                type="subtitle"
                lightColor={CARD_TEXT_LIGHT}
                darkColor={CARD_TEXT_DARK}>
                {t('settings.recording.presets.save_title')}
              </ThemedText>
            </View>
            <ThemedText
              style={recordingStyles.saveCardDescription}
              lightColor={CARD_SUBTLE_LIGHT}
              darkColor={CARD_SUBTLE_DARK}>
              {t('settings.recording.presets.save_description')}
            </ThemedText>
            <TextInput
              value={presetName}
              onChangeText={setPresetName}
              placeholder={t('settings.recording.presets.name_placeholder')}
              style={inputStyle}
              placeholderTextColor={placeholderTextColor}
            />
            <View style={settingsStyles.optionsRow}>
              <OptionPill
                label={t('settings.recording.presets.save_button')}
                active={canSavePreset}
                onPress={handleSavePreset}
                disabled={!canSavePreset}
              />
            </View>
          </SettingsCard>

          {settings.recordingPresets.length === 0 ? (
            <SettingsCard variant="system">
              <ThemedText
                style={recordingStyles.emptyStateText}
                lightColor={CARD_SUBTLE_LIGHT}
                darkColor={CARD_SUBTLE_DARK}>
                {t('settings.recording.presets.empty')}
              </ThemedText>
            </SettingsCard>
          ) : (
            settings.recordingPresets.map((preset) => {
              const isActive = settings.activeRecordingPresetId === preset.id;
              const presetVariant = isActive ? 'interaction' : 'system';
              return (
                <SettingsCard key={preset.id} variant={presetVariant}>
                  <View style={recordingStyles.presetCardHeader}>
                    <ThemedText
                      type="subtitle"
                      lightColor={CARD_TEXT_LIGHT}
                      darkColor={CARD_TEXT_DARK}>
                      {preset.name}
                    </ThemedText>
                    {isActive ? (
                      <View style={recordingStyles.activeBadge}>
                        <ThemedText
                          style={recordingStyles.activeBadgeText}
                          lightColor="#0f172a"
                          darkColor="#0f172a">
                          {t('settings.recording.presets.active_badge')}
                        </ThemedText>
                      </View>
                    ) : null}
                  </View>
                  <View style={recordingStyles.presetMetaRow}>
                    {[
                      {
                        key: 'activationThreshold',
                        label: t('settings.recording.labels.activation_threshold'),
                        value: preset.activationThreshold,
                      },
                      {
                        key: 'activationDurationSec',
                        label: t('settings.recording.labels.activation_duration'),
                        value: preset.activationDurationSec,
                      },
                      {
                        key: 'silenceDurationSec',
                        label: t('settings.recording.labels.silence_duration'),
                        value: preset.silenceDurationSec,
                      },
                      {
                        key: 'preRollDurationSec',
                        label: t('settings.recording.labels.pre_roll'),
                        value: preset.preRollDurationSec,
                      },
                      {
                        key: 'maxSegmentDurationSec',
                        label: t('settings.recording.labels.max_segment'),
                        value: preset.maxSegmentDurationSec,
                      },
                    ].map((item) => (
                      <View key={item.key} style={recordingStyles.presetMetaItem}>
                        <ThemedText
                          style={recordingStyles.presetMetaLabel}
                          lightColor={CARD_SUBTLE_LIGHT}
                          darkColor={CARD_SUBTLE_DARK}>
                          {item.label}
                        </ThemedText>
                        <ThemedText
                          style={recordingStyles.presetMetaValue}
                          lightColor={CARD_TEXT_LIGHT}
                          darkColor={CARD_TEXT_DARK}>
                          {item.value}
                        </ThemedText>
                      </View>
                    ))}
                  </View>
                  <View style={settingsStyles.optionsRow}>
                    <OptionPill
                      label={t('settings.recording.presets.apply_button')}
                      active={isActive}
                      onPress={() => handleApplyPreset(preset)}
                    />
                    <OptionPill
                      label={t('settings.recording.presets.delete_button')}
                      active={false}
                      onPress={() => confirmDeletePreset(preset)}
                    />
                  </View>
                </SettingsCard>
              );
            })
          )}

          <SettingsCard variant="system">
            {renderNumericField(
              'settings.recording.labels.activation_threshold',
              formState.activationThreshold,
              (text) => setFormState((prev) => ({ ...prev, activationThreshold: text })),
              'activationThreshold'
            )}

            {renderNumericField(
              'settings.recording.labels.activation_duration',
              formState.activationDurationSec,
              (text) => setFormState((prev) => ({ ...prev, activationDurationSec: text })),
              'activationDurationSec'
            )}

            {renderNumericField(
              'settings.recording.labels.silence_duration',
              formState.silenceDurationSec,
              (text) => setFormState((prev) => ({ ...prev, silenceDurationSec: text })),
              'silenceDurationSec'
            )}

            {renderNumericField(
              'settings.recording.labels.pre_roll',
              formState.preRollDurationSec,
              (text) => setFormState((prev) => ({ ...prev, preRollDurationSec: text })),
              'preRollDurationSec'
            )}

            {renderNumericField(
              'settings.recording.labels.max_segment',
              formState.maxSegmentDurationSec,
              (text) => setFormState((prev) => ({ ...prev, maxSegmentDurationSec: text })),
              'maxSegmentDurationSec'
            )}
          </SettingsCard>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const recordingStyles = StyleSheet.create({
  presetCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  saveCardDescription: {
    fontSize: 14,
    lineHeight: 20,
  },
  emptyStateText: {
    textAlign: 'center',
  },
  activeBadge: {
    backgroundColor: 'rgba(250, 204, 21, 0.92)',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 999,
  },
  activeBadgeText: {
    fontSize: 12,
    fontWeight: '700',
  },
  presetMetaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  presetMetaItem: {
    gap: 4,
    minWidth: '44%',
  },
  presetMetaLabel: {
    fontSize: 13,
    lineHeight: 18,
  },
  presetMetaValue: {
    fontSize: 16,
    fontWeight: '600',
    lineHeight: 22,
  },
  inputHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  inputDescription: {
    fontSize: 14,
    lineHeight: 20,
  },
  inputEmpty: {
    fontSize: 13,
  },
  inputTestRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  inputStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  inputStatusDot: {
    width: 10,
    height: 10,
    borderRadius: 999,
  },
  inputStatusDotIdle: {
    backgroundColor: 'rgba(148, 163, 184, 0.7)',
  },
  inputStatusDotListening: {
    backgroundColor: 'rgba(250, 204, 21, 0.85)',
  },
  inputStatusDotActive: {
    backgroundColor: 'rgba(34, 197, 94, 0.9)',
  },
  inputStatusLabel: {
    fontSize: 13,
    lineHeight: 18,
  },
  inputError: {
    fontSize: 13,
  },
});
