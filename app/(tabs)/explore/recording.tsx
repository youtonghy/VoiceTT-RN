
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
import { useTranslation } from 'react-i18next';
import {
  getRecordingPermissionsAsync,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  useAudioRecorder,
  type RecordingOptions,
} from 'expo-audio';
import { deleteAsync } from 'expo-file-system/legacy';

import { ThemedText } from '@/components/themed-text';
import { useSettings } from '@/contexts/settings-context';
import { useColorScheme } from '@/hooks/use-color-scheme';
import type { AppSettings, RecordingPreset } from '@/types/settings';

import {
  CARD_SUBTLE_LIGHT, CARD_SUBTLE_DARK,
  CARD_TEXT_LIGHT, CARD_TEXT_DARK,
  NumericSettingKey,
  OptionPill,
  SettingsCard,
  formatNumberInput,
  settingsStyles,
  useSettingsForm,
} from './shared';

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

const createPresetId = () => `preset-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
type PresetNumericValues = Omit<RecordingPreset, 'id' | 'name'>;

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
      await deleteAsync(uri, { idempotent: true });
    } catch (error) {
      if (__DEV__) {
        console.warn('[recording-settings] Failed to delete metering file', error);
      }
    }
  }, []);

  const stopMonitoringSilently = useCallback(async () => {
    clearStatusInterval();
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

  const startMonitoring = useCallback(async () => {
    if (recorder.isRecording) {
      return;
    }
    try {
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
      setMeteringDb(null);

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
  }, [clearStatusInterval, recorder, t]);

  const stopMonitoring = useCallback(async () => {
    clearStatusInterval();
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
});
