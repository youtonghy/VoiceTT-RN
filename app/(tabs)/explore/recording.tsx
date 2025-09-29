import { useMemo } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { Surface, TextInput as PaperTextInput, useTheme } from 'react-native-paper';

import { useSettings } from '@/contexts/settings-context';
import type { AppSettings } from '@/types/settings';

import {
  NumericSettingKey,
  formatNumberInput,
  settingsStyles,
  useSettingsForm,
} from './shared';

export default function RecordingSettingsScreen() {
  const { t } = useTranslation();
  const { settings, updateSettings } = useSettings();
  const { formState, setFormState } = useSettingsForm(settings);
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  const safeAreaStyle = useMemo(
    () => [settingsStyles.safeArea, { backgroundColor: theme.colors.background }],
    [theme.colors.background]
  );

  const scrollContentStyle = useMemo(
    () => [settingsStyles.scrollContent, { paddingBottom: 32 + insets.bottom }],
    [insets.bottom]
  );

  const sectionCardStyle = useMemo(
    () => [settingsStyles.sectionCard, { backgroundColor: theme.colors.surface }],
    [theme.colors.surface]
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
    <PaperTextInput
      label={t(labelKey)}
      value={value}
      onChangeText={(text) => onChange(formatNumberInput(text))}
      onBlur={() => handleNumericCommit(onCommitKey, value)}
      keyboardType="decimal-pad"
      mode="outlined"
      style={styles.field}
      returnKeyType="done"
    />
  );

  return (
    <SafeAreaView style={safeAreaStyle} edges={['top', 'left', 'right']}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={settingsStyles.flex}
      >
        <ScrollView
          contentContainerStyle={scrollContentStyle}
          contentInsetAdjustmentBehavior="always"
          keyboardDismissMode="on-drag"
          keyboardShouldPersistTaps="handled"
        >
          <Surface style={sectionCardStyle} mode="flat" elevation={1}>
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
          </Surface>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  field: {
    marginBottom: 8,
  },
});
