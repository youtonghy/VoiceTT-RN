
import { useCallback, useMemo, useState } from 'react';
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

import { ThemedText } from '@/components/themed-text';
import { useSettings } from '@/contexts/settings-context';
import { useColorScheme } from '@/hooks/use-color-scheme';
import type { AppSettings, RecordingPreset } from '@/types/settings';

import {
  CARD_SUBTLE_TEXT_COLOR,
  CARD_TEXT_COLOR,
  NumericSettingKey,
  OptionPill,
  SettingsCard,
  formatNumberInput,
  settingsStyles,
  useSettingsForm,
} from './shared';

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
        lightColor={CARD_SUBTLE_TEXT_COLOR}
        darkColor={CARD_SUBTLE_TEXT_COLOR}>
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
          <SettingsCard variant="interaction">
            <View style={recordingStyles.presetCardHeader}>
              <ThemedText
                type="subtitle"
                lightColor={CARD_TEXT_COLOR}
                darkColor={CARD_TEXT_COLOR}>
                {t('settings.recording.presets.save_title')}
              </ThemedText>
            </View>
            <ThemedText
              style={recordingStyles.saveCardDescription}
              lightColor={CARD_SUBTLE_TEXT_COLOR}
              darkColor={CARD_SUBTLE_TEXT_COLOR}>
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
                lightColor={CARD_SUBTLE_TEXT_COLOR}
                darkColor={CARD_SUBTLE_TEXT_COLOR}>
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
                      lightColor={CARD_TEXT_COLOR}
                      darkColor={CARD_TEXT_COLOR}>
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
                          lightColor={CARD_SUBTLE_TEXT_COLOR}
                          darkColor={CARD_SUBTLE_TEXT_COLOR}>
                          {item.label}
                        </ThemedText>
                        <ThemedText
                          style={recordingStyles.presetMetaValue}
                          lightColor={CARD_TEXT_COLOR}
                          darkColor={CARD_TEXT_COLOR}>
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
