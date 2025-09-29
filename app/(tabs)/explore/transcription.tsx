import { useMemo } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { Surface, Text, TextInput as PaperTextInput, useTheme } from 'react-native-paper';

import { useSettings } from '@/contexts/settings-context';
import type { TranscriptionEngine } from '@/types/settings';

import { OptionPill, settingsStyles, useSettingsForm } from './shared';

const transcriptionEngines: TranscriptionEngine[] = ['openai', 'qwen3', 'soniox'];

export default function TranscriptionSettingsScreen() {
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
            <View>
              <Text variant="labelLarge" style={styles.sectionLabel}>
                {t('settings.transcription.labels.engine')}
              </Text>
              <View style={settingsStyles.optionsRow}>
                {transcriptionEngines.map((engine) => (
                  <OptionPill
                    key={engine}
                    label={t(`settings.transcription.engines.${engine}`)}
                    active={settings.transcriptionEngine === engine}
                    onPress={() => updateSettings({ transcriptionEngine: engine })}
                  />
                ))}
              </View>
            </View>

            <View style={styles.fieldGroup}>
              <Text variant="labelLarge">{t('settings.transcription.labels.source_language')}</Text>
              <PaperTextInput
                value={formState.transcriptionLanguage}
                onChangeText={(text) =>
                  setFormState((prev) => ({ ...prev, transcriptionLanguage: text }))
                }
                onBlur={() =>
                  updateSettings({ transcriptionLanguage: formState.transcriptionLanguage.trim() })
                }
                autoCapitalize="none"
                autoCorrect={false}
                mode="outlined"
                placeholder="auto"
                style={styles.textInput}
              />
            </View>
          </Surface>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  sectionLabel: {
    marginBottom: 8,
  },
  fieldGroup: {
    gap: 8,
  },
  textInput: {
    marginTop: 4,
  },
});
