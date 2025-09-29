import { useMemo } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
<<<<<<< HEAD
import { useTranslation } from 'react-i18next';
import { Surface, TextInput as PaperTextInput, useTheme } from 'react-native-paper';
=======
>>>>>>> parent of e9751a1 (Add i18n support and localize UI text)

import { useSettings } from '@/contexts/settings-context';
import type { AppSettings } from '@/types/settings';

import {
  NumericSettingKey,
  formatNumberInput,
  settingsStyles,
  useSettingsForm,
} from './shared';

export default function RecordingSettingsScreen() {
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

<<<<<<< HEAD
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

=======
>>>>>>> parent of e9751a1 (Add i18n support and localize UI text)
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
<<<<<<< HEAD
          keyboardShouldPersistTaps="handled"
        >
          <Surface style={sectionCardStyle} mode="flat" elevation={1}>
            {renderNumericField(
              'settings.recording.labels.activation_threshold',
              formState.activationThreshold,
              (text) => setFormState((prev) => ({ ...prev, activationThreshold: text })),
              'activationThreshold'
            )}
=======
          keyboardShouldPersistTaps="handled">
          <View style={styles.section}>
            <View style={settingsStyles.fieldRow}>
              <ThemedText style={labelStyle} lightColor="#1f2937" darkColor="#e2e8f0">
                激活阈值
              </ThemedText>
              <TextInput
                value={formState.activationThreshold}
                onChangeText={(text) =>
                  setFormState((prev) => ({ ...prev, activationThreshold: formatNumberInput(text) }))
                }
                onBlur={() => handleNumericCommit('activationThreshold', formState.activationThreshold)}
                keyboardType="decimal-pad"
                style={inputStyle}
                placeholderTextColor={placeholderTextColor}
              />
            </View>
>>>>>>> parent of e9751a1 (Add i18n support and localize UI text)

            <View style={settingsStyles.fieldRow}>
              <ThemedText style={labelStyle} lightColor="#1f2937" darkColor="#e2e8f0">
                激活持续(秒)
              </ThemedText>
              <TextInput
                value={formState.activationDurationSec}
                onChangeText={(text) =>
                  setFormState((prev) => ({ ...prev, activationDurationSec: formatNumberInput(text) }))
                }
                onBlur={() =>
                  handleNumericCommit('activationDurationSec', formState.activationDurationSec)
                }
                keyboardType="decimal-pad"
                style={inputStyle}
                placeholderTextColor={placeholderTextColor}
              />
            </View>

            <View style={settingsStyles.fieldRow}>
              <ThemedText style={labelStyle} lightColor="#1f2937" darkColor="#e2e8f0">
                静音判定(秒)
              </ThemedText>
              <TextInput
                value={formState.silenceDurationSec}
                onChangeText={(text) =>
                  setFormState((prev) => ({ ...prev, silenceDurationSec: formatNumberInput(text) }))
                }
                onBlur={() => handleNumericCommit('silenceDurationSec', formState.silenceDurationSec)}
                keyboardType="decimal-pad"
                style={inputStyle}
                placeholderTextColor={placeholderTextColor}
              />
            </View>

            <View style={settingsStyles.fieldRow}>
              <ThemedText style={labelStyle} lightColor="#1f2937" darkColor="#e2e8f0">
                前滚时长(秒)
              </ThemedText>
              <TextInput
                value={formState.preRollDurationSec}
                onChangeText={(text) =>
                  setFormState((prev) => ({ ...prev, preRollDurationSec: formatNumberInput(text) }))
                }
                onBlur={() => handleNumericCommit('preRollDurationSec', formState.preRollDurationSec)}
                keyboardType="decimal-pad"
                style={inputStyle}
                placeholderTextColor={placeholderTextColor}
              />
            </View>

<<<<<<< HEAD
            {renderNumericField(
              'settings.recording.labels.max_segment',
              formState.maxSegmentDurationSec,
              (text) => setFormState((prev) => ({ ...prev, maxSegmentDurationSec: text })),
              'maxSegmentDurationSec'
            )}
          </Surface>
=======
            <View style={settingsStyles.fieldRow}>
              <ThemedText style={labelStyle} lightColor="#1f2937" darkColor="#e2e8f0">
                最大片段(秒)
              </ThemedText>
              <TextInput
                value={formState.maxSegmentDurationSec}
                onChangeText={(text) =>
                  setFormState((prev) => ({ ...prev, maxSegmentDurationSec: formatNumberInput(text) }))
                }
                onBlur={() =>
                  handleNumericCommit('maxSegmentDurationSec', formState.maxSegmentDurationSec)
                }
                keyboardType="decimal-pad"
                style={inputStyle}
                placeholderTextColor={placeholderTextColor}
              />
            </View>
          </View>
>>>>>>> parent of e9751a1 (Add i18n support and localize UI text)
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
