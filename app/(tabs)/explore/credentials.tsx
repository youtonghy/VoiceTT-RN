<<<<<<< HEAD
import { useMemo } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { Surface, Text, TextInput as PaperTextInput, useTheme } from 'react-native-paper';
=======
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
>>>>>>> parent of e9751a1 (Add i18n support and localize UI text)

import { useSettings } from '@/contexts/settings-context';
import {
  DEFAULT_GEMINI_TRANSLATION_MODEL,
  DEFAULT_OPENAI_BASE_URL,
  DEFAULT_OPENAI_TRANSCRIPTION_MODEL,
  DEFAULT_OPENAI_TRANSLATION_MODEL,
  DEFAULT_QWEN_TRANSCRIPTION_MODEL,
} from '@/services/transcription';
import {
  DEFAULT_GEMINI_CONVERSATION_MODEL,
  DEFAULT_GEMINI_TITLE_MODEL,
  DEFAULT_OPENAI_CONVERSATION_MODEL,
  DEFAULT_OPENAI_TITLE_MODEL,
} from '@/types/settings';

import { settingsStyles, useSettingsForm } from './shared';

export default function CredentialSettingsScreen() {
  const { settings, updateCredentials } = useSettings();
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
<<<<<<< HEAD
          keyboardShouldPersistTaps="handled"
        >
          <Surface style={sectionCardStyle} mode="flat" elevation={1}>
            <Text variant="titleMedium">{t('settings.credentials.sections.openai.title')}</Text>

            <View style={styles.fieldGroup}>
              <Text variant="labelLarge">{t('settings.credentials.labels.base_url')}</Text>
              <PaperTextInput
=======
          keyboardShouldPersistTaps="handled">
          <View style={styles.section}>
            <ThemedText style={sectionTitleStyle} lightColor="#0f172a" darkColor="#e2e8f0">
              OpenAI
            </ThemedText>
            <View style={styles.fieldGroup}>
              <ThemedText style={credentialLabelStyle} lightColor="#1f2937" darkColor="#e2e8f0">
                Base URL
              </ThemedText>
              <TextInput
>>>>>>> parent of e9751a1 (Add i18n support and localize UI text)
                value={formState.openaiBaseUrl}
                onChangeText={(text) => setFormState((prev) => ({ ...prev, openaiBaseUrl: text }))}
                onBlur={() =>
                  updateCredentials({
                    openaiBaseUrl: formState.openaiBaseUrl.trim() || DEFAULT_OPENAI_BASE_URL,
                  })
                }
                autoCapitalize="none"
                autoCorrect={false}
                mode="outlined"
                placeholder={DEFAULT_OPENAI_BASE_URL}
              />
            </View>

            <View style={styles.fieldGroup}>
<<<<<<< HEAD
              <Text variant="labelLarge">{t('settings.credentials.labels.api_key')}</Text>
              <PaperTextInput
=======
              <ThemedText style={credentialLabelStyle} lightColor="#1f2937" darkColor="#e2e8f0">
                API Key
              </ThemedText>
              <TextInput
>>>>>>> parent of e9751a1 (Add i18n support and localize UI text)
                value={formState.openaiApiKey}
                onChangeText={(text) => setFormState((prev) => ({ ...prev, openaiApiKey: text }))}
                onBlur={() =>
                  updateCredentials({ openaiApiKey: formState.openaiApiKey.trim() || undefined })
                }
                autoCapitalize="none"
                mode="outlined"
                secureTextEntry
                placeholder="sk-..."
              />
            </View>

            <View style={styles.fieldGroup}>
<<<<<<< HEAD
              <Text variant="labelLarge">{t('settings.credentials.labels.transcription_model')}</Text>
              <PaperTextInput
=======
              <ThemedText style={credentialLabelStyle} lightColor="#1f2937" darkColor="#e2e8f0">
                转写模型
              </ThemedText>
              <TextInput
>>>>>>> parent of e9751a1 (Add i18n support and localize UI text)
                value={formState.openaiTranscriptionModel}
                onChangeText={(text) =>
                  setFormState((prev) => ({ ...prev, openaiTranscriptionModel: text }))
                }
                onBlur={() =>
                  updateCredentials({
                    openaiTranscriptionModel:
                      formState.openaiTranscriptionModel.trim() || DEFAULT_OPENAI_TRANSCRIPTION_MODEL,
                  })
                }
                autoCapitalize="none"
                autoCorrect={false}
                mode="outlined"
                placeholder={DEFAULT_OPENAI_TRANSCRIPTION_MODEL}
              />
            </View>

            <View style={styles.fieldGroup}>
<<<<<<< HEAD
              <Text variant="labelLarge">{t('settings.credentials.labels.translation_model')}</Text>
              <PaperTextInput
=======
              <ThemedText style={credentialLabelStyle} lightColor="#1f2937" darkColor="#e2e8f0">
                翻译模型
              </ThemedText>
              <TextInput
>>>>>>> parent of e9751a1 (Add i18n support and localize UI text)
                value={formState.openaiTranslationModel}
                onChangeText={(text) =>
                  setFormState((prev) => ({ ...prev, openaiTranslationModel: text }))
                }
                onBlur={() =>
                  updateCredentials({
                    openaiTranslationModel:
                      formState.openaiTranslationModel.trim() || DEFAULT_OPENAI_TRANSLATION_MODEL,
                  })
                }
                autoCapitalize="none"
                autoCorrect={false}
                mode="outlined"
                placeholder={DEFAULT_OPENAI_TRANSLATION_MODEL}
              />
            </View>

<<<<<<< HEAD
            <View style={styles.fieldGroup}>
              <Text variant="labelLarge">{t('settings.credentials.labels.title_model')}</Text>
              <PaperTextInput
                value={formState.openaiTitleModel}
                onChangeText={(text) => setFormState((prev) => ({ ...prev, openaiTitleModel: text }))}
                onBlur={() =>
                  updateCredentials({
                    openaiTitleModel:
                      formState.openaiTitleModel.trim() || DEFAULT_OPENAI_TITLE_MODEL,
                  })
                }
                autoCapitalize="none"
                autoCorrect={false}
                mode="outlined"
                placeholder={DEFAULT_OPENAI_TITLE_MODEL}
              />
            </View>

            <View style={styles.fieldGroup}>
              <Text variant="labelLarge">{t('settings.credentials.labels.conversation_model')}</Text>
              <PaperTextInput
                value={formState.openaiConversationModel}
                onChangeText={(text) =>
                  setFormState((prev) => ({ ...prev, openaiConversationModel: text }))
                }
                onBlur={() =>
                  updateCredentials({
                    openaiConversationModel:
                      formState.openaiConversationModel.trim() || DEFAULT_OPENAI_CONVERSATION_MODEL,
                  })
                }
                autoCapitalize="none"
                autoCorrect={false}
                mode="outlined"
                placeholder={DEFAULT_OPENAI_CONVERSATION_MODEL}
              />
            </View>
          </Surface>

          <Surface style={sectionCardStyle} mode="flat" elevation={1}>
            <Text variant="titleMedium">{t('settings.credentials.sections.gemini.title')}</Text>

            <View style={styles.fieldGroup}>
              <Text variant="labelLarge">{t('settings.credentials.labels.api_key')}</Text>
              <PaperTextInput
=======
          <View style={styles.section}>
            <ThemedText style={sectionTitleStyle} lightColor="#0f172a" darkColor="#e2e8f0">
              Gemini
            </ThemedText>
            <View style={styles.fieldGroup}>
              <ThemedText style={credentialLabelStyle} lightColor="#1f2937" darkColor="#e2e8f0">
                API Key
              </ThemedText>
              <TextInput
>>>>>>> parent of e9751a1 (Add i18n support and localize UI text)
                value={formState.geminiApiKey}
                onChangeText={(text) => setFormState((prev) => ({ ...prev, geminiApiKey: text }))}
                onBlur={() =>
                  updateCredentials({ geminiApiKey: formState.geminiApiKey.trim() || undefined })
                }
                autoCapitalize="none"
                mode="outlined"
                secureTextEntry
                placeholder="AIza..."
              />
            </View>

            <View style={styles.fieldGroup}>
<<<<<<< HEAD
              <Text variant="labelLarge">{t('settings.credentials.labels.translation_model')}</Text>
              <PaperTextInput
=======
              <ThemedText style={credentialLabelStyle} lightColor="#1f2937" darkColor="#e2e8f0">
                翻译模型
              </ThemedText>
              <TextInput
>>>>>>> parent of e9751a1 (Add i18n support and localize UI text)
                value={formState.geminiTranslationModel}
                onChangeText={(text) =>
                  setFormState((prev) => ({ ...prev, geminiTranslationModel: text }))
                }
                onBlur={() =>
                  updateCredentials({
                    geminiTranslationModel:
                      formState.geminiTranslationModel.trim() || DEFAULT_GEMINI_TRANSLATION_MODEL,
                  })
                }
                autoCapitalize="none"
                autoCorrect={false}
                mode="outlined"
                placeholder={DEFAULT_GEMINI_TRANSLATION_MODEL}
              />
            </View>

<<<<<<< HEAD
            <View style={styles.fieldGroup}>
              <Text variant="labelLarge">{t('settings.credentials.labels.title_model')}</Text>
              <PaperTextInput
                value={formState.geminiTitleModel}
                onChangeText={(text) => setFormState((prev) => ({ ...prev, geminiTitleModel: text }))}
                onBlur={() =>
                  updateCredentials({
                    geminiTitleModel: formState.geminiTitleModel.trim() || DEFAULT_GEMINI_TITLE_MODEL,
                  })
                }
                autoCapitalize="none"
                autoCorrect={false}
                mode="outlined"
                placeholder={DEFAULT_GEMINI_TITLE_MODEL}
              />
            </View>

            <View style={styles.fieldGroup}>
              <Text variant="labelLarge">{t('settings.credentials.labels.conversation_model')}</Text>
              <PaperTextInput
                value={formState.geminiConversationModel}
                onChangeText={(text) => setFormState((prev) => ({ ...prev, geminiConversationModel: text }))}
                onBlur={() =>
                  updateCredentials({
                    geminiConversationModel:
                      formState.geminiConversationModel.trim() || DEFAULT_GEMINI_CONVERSATION_MODEL,
                  })
                }
                autoCapitalize="none"
                autoCorrect={false}
                mode="outlined"
                placeholder={DEFAULT_GEMINI_CONVERSATION_MODEL}
              />
            </View>
          </Surface>

          <Surface style={sectionCardStyle} mode="flat" elevation={1}>
            <Text variant="titleMedium">{t('settings.credentials.sections.soniox.title')}</Text>

            <View style={styles.fieldGroup}>
              <Text variant="labelLarge">{t('settings.credentials.labels.api_key')}</Text>
              <PaperTextInput
=======
          <View style={styles.section}>
            <ThemedText style={sectionTitleStyle} lightColor="#0f172a" darkColor="#e2e8f0">
              Soniox
            </ThemedText>
            <View style={styles.fieldGroup}>
              <ThemedText style={credentialLabelStyle} lightColor="#1f2937" darkColor="#e2e8f0">
                API Key
              </ThemedText>
              <TextInput
>>>>>>> parent of e9751a1 (Add i18n support and localize UI text)
                value={formState.sonioxApiKey}
                onChangeText={(text) => setFormState((prev) => ({ ...prev, sonioxApiKey: text }))}
                onBlur={() =>
                  updateCredentials({ sonioxApiKey: formState.sonioxApiKey.trim() || undefined })
                }
                autoCapitalize="none"
                mode="outlined"
                secureTextEntry
                placeholder="soniox_..."
              />
            </View>
          </Surface>

          <Surface style={sectionCardStyle} mode="flat" elevation={1}>
            <Text variant="titleMedium">{t('settings.credentials.sections.qwen.title')}</Text>

<<<<<<< HEAD
            <View style={styles.fieldGroup}>
              <Text variant="labelLarge">{t('settings.credentials.labels.api_key')}</Text>
              <PaperTextInput
=======
          <View style={styles.section}>
            <ThemedText style={sectionTitleStyle} lightColor="#0f172a" darkColor="#e2e8f0">
              Qwen3
            </ThemedText>
            <View style={styles.fieldGroup}>
              <ThemedText style={credentialLabelStyle} lightColor="#1f2937" darkColor="#e2e8f0">
                API Key
              </ThemedText>
              <TextInput
>>>>>>> parent of e9751a1 (Add i18n support and localize UI text)
                value={formState.qwenApiKey}
                onChangeText={(text) => setFormState((prev) => ({ ...prev, qwenApiKey: text }))}
                onBlur={() =>
                  updateCredentials({ qwenApiKey: formState.qwenApiKey.trim() || undefined })
                }
                autoCapitalize="none"
                mode="outlined"
                secureTextEntry
                placeholder="sk-..."
              />
            </View>

            <View style={styles.fieldGroup}>
<<<<<<< HEAD
              <Text variant="labelLarge">{t('settings.credentials.labels.transcription_model')}</Text>
              <PaperTextInput
=======
              <ThemedText style={credentialLabelStyle} lightColor="#1f2937" darkColor="#e2e8f0">
                转写模型
              </ThemedText>
              <TextInput
>>>>>>> parent of e9751a1 (Add i18n support and localize UI text)
                value={formState.qwenTranscriptionModel}
                onChangeText={(text) =>
                  setFormState((prev) => ({ ...prev, qwenTranscriptionModel: text }))
                }
                onBlur={() =>
                  updateCredentials({
                    qwenTranscriptionModel:
                      formState.qwenTranscriptionModel.trim() || DEFAULT_QWEN_TRANSCRIPTION_MODEL,
                  })
                }
                autoCapitalize="none"
                autoCorrect={false}
                mode="outlined"
                placeholder={DEFAULT_QWEN_TRANSCRIPTION_MODEL}
              />
            </View>
          </Surface>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  fieldGroup: {
    gap: 8,
  },
});
