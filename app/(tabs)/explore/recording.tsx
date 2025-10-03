
import { useMemo } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { ThemedText } from '@/components/themed-text';
import { useSettings } from '@/contexts/settings-context';
import { useColorScheme } from '@/hooks/use-color-scheme';
import type { AppSettings } from '@/types/settings';

import {
  CARD_SUBTLE_TEXT_COLOR,
  NumericSettingKey,
  SettingsCard,
  formatNumberInput,
  settingsStyles,
  useSettingsForm,
} from './shared';

export default function RecordingSettingsScreen() {
  const { t } = useTranslation();
  const { settings, updateSettings } = useSettings();
  const { formState, setFormState } = useSettingsForm(settings);
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const insets = useSafeAreaInsets();

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

  const handleNumericCommit = (key: NumericSettingKey, value: string) => {
    const parsed = parseFloat(value);
    if (!Number.isNaN(parsed)) {
      updateSettings({ [key]: parsed } as Partial<AppSettings>);
    }
  };

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

