import {
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
import {
  DEFAULT_GEMINI_QA_MODEL,
  DEFAULT_OPENAI_QA_MODEL,
  DEFAULT_QA_QUESTION_PROMPT,
  DEFAULT_QA_ANSWER_PROMPT,
  type QaEngine,
} from '@/types/settings';

import { OptionPill, settingsStyles, useSettingsForm } from './shared';

const qaEngines: QaEngine[] = ['openai', 'gemini'];

export default function QaSettingsScreen() {
  const { t } = useTranslation();
  const { settings, updateSettings, updateCredentials } = useSettings();
  const { formState, setFormState } = useSettingsForm(settings);
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const insets = useSafeAreaInsets();

  const baseInputStyle = [settingsStyles.input, isDark ? settingsStyles.inputDark : null];
  const multilineInputStyle = [
    settingsStyles.input,
    styles.promptInput,
    isDark ? settingsStyles.inputDark : null,
    isDark ? styles.promptInputDark : null,
  ];
  const groupLabelStyle = [settingsStyles.groupLabel, isDark && settingsStyles.groupLabelDark];
  const safeAreaStyle = [
    settingsStyles.safeArea,
    isDark ? settingsStyles.safeAreaDark : settingsStyles.safeAreaLight,
  ];
  const placeholderTextColor = isDark ? '#94a3b8' : '#64748b';

  return (
    <SafeAreaView style={safeAreaStyle} edges={['top', 'left', 'right']}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={settingsStyles.flex}>
        <ScrollView
          contentContainerStyle={[
            settingsStyles.scrollContent,
            { paddingBottom: 32 + insets.bottom },
          ]}
          contentInsetAdjustmentBehavior="always"
          keyboardDismissMode="on-drag"
          keyboardShouldPersistTaps="handled">
          <View style={styles.section}>
            <ThemedText type="subtitle" lightColor="#0f172a" darkColor="#e2e8f0">
              {t('settings.qa.engine.title')}
            </ThemedText>
            <View style={settingsStyles.optionsRow}>
              {qaEngines.map((engine) => (
                <OptionPill
                  key={engine}
                  label={t('settings.qa.engine.engines.' + engine)}
                  active={settings.qaEngine === engine}
                  onPress={() => updateSettings({ qaEngine: engine })}
                />
              ))}
            </View>
          </View>

          <View style={styles.section}>
            <ThemedText style={groupLabelStyle} lightColor="#1f2937" darkColor="#e2e8f0">
              {t('settings.qa.openai_label')}
            </ThemedText>
            <TextInput
              value={formState.openaiQaModel}
              onChangeText={(text) => setFormState((prev) => ({ ...prev, openaiQaModel: text }))}
              onBlur={() =>
                updateCredentials({
                  openaiQaModel: formState.openaiQaModel.trim() || DEFAULT_OPENAI_QA_MODEL,
                })
              }
              autoCapitalize="none"
              autoCorrect={false}
              style={baseInputStyle}
              placeholder={DEFAULT_OPENAI_QA_MODEL}
              placeholderTextColor={placeholderTextColor}
            />
          </View>

          <View style={styles.section}>
            <ThemedText style={groupLabelStyle} lightColor="#1f2937" darkColor="#e2e8f0">
              {t('settings.qa.gemini_label')}
            </ThemedText>
            <TextInput
              value={formState.geminiQaModel}
              onChangeText={(text) => setFormState((prev) => ({ ...prev, geminiQaModel: text }))}
              onBlur={() =>
                updateCredentials({
                  geminiQaModel: formState.geminiQaModel.trim() || DEFAULT_GEMINI_QA_MODEL,
                })
              }
              autoCapitalize="none"
              autoCorrect={false}
              style={baseInputStyle}
              placeholder={DEFAULT_GEMINI_QA_MODEL}
              placeholderTextColor={placeholderTextColor}
            />
          </View>

          <View style={styles.section}>
            <ThemedText style={groupLabelStyle} lightColor="#1f2937" darkColor="#e2e8f0">
              {t('settings.qa.question_prompt_label')}
            </ThemedText>
            <TextInput
              value={formState.qaQuestionPrompt}
              onChangeText={(text) =>
                setFormState((prev) => ({ ...prev, qaQuestionPrompt: text }))
              }
              onBlur={() =>
                updateSettings({
                  qaQuestionPrompt:
                    formState.qaQuestionPrompt.trim() || DEFAULT_QA_QUESTION_PROMPT,
                })
              }
              style={multilineInputStyle}
              placeholder={DEFAULT_QA_QUESTION_PROMPT}
              placeholderTextColor={placeholderTextColor}
              multiline
              textAlignVertical="top"
            />
          </View>

          <View style={styles.section}>
            <ThemedText style={groupLabelStyle} lightColor="#1f2937" darkColor="#e2e8f0">
              {t('settings.qa.answer_prompt_label')}
            </ThemedText>
            <TextInput
              value={formState.qaAnswerPrompt}
              onChangeText={(text) => setFormState((prev) => ({ ...prev, qaAnswerPrompt: text }))}
              onBlur={() =>
                updateSettings({
                  qaAnswerPrompt:
                    formState.qaAnswerPrompt.trim() || DEFAULT_QA_ANSWER_PROMPT,
                })
              }
              style={multilineInputStyle}
              placeholder={DEFAULT_QA_ANSWER_PROMPT}
              placeholderTextColor={placeholderTextColor}
              multiline
              textAlignVertical="top"
            />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  section: {
    gap: 12,
  },
  promptInput: {
    minHeight: 140,
    textAlignVertical: 'top',
    paddingTop: 12,
    paddingBottom: 12,
  },
  promptInputDark: {
    color: '#e2e8f0',
  },
});

