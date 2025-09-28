
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
  DEFAULT_GEMINI_TRANSLATION_MODEL,
  DEFAULT_OPENAI_BASE_URL,
  DEFAULT_OPENAI_TRANSCRIPTION_MODEL,
  DEFAULT_OPENAI_TRANSLATION_MODEL,
  DEFAULT_QWEN_TRANSCRIPTION_MODEL,
} from '@/services/transcription';

import { settingsStyles, useSettingsForm } from './shared';

export default function CredentialSettingsScreen() {
  const { t } = useTranslation();
  const { settings, updateCredentials } = useSettings();
  const { formState, setFormState } = useSettingsForm(settings);
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const insets = useSafeAreaInsets();

  const inputStyle = [settingsStyles.input, isDark && settingsStyles.inputDark];
  const credentialLabelStyle = [settingsStyles.cardLabel, isDark && settingsStyles.cardLabelDark];
  const sectionTitleStyle = [settingsStyles.sectionTitle, isDark && settingsStyles.sectionTitleDark];
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
            <ThemedText style={sectionTitleStyle} lightColor="#0f172a" darkColor="#e2e8f0">
              {t('settings.credentials.sections.openai.title')}
            </ThemedText>
            <View style={styles.fieldGroup}>
              <ThemedText style={credentialLabelStyle} lightColor="#1f2937" darkColor="#e2e8f0">
                {t('settings.credentials.labels.base_url')}
              </ThemedText>
              <TextInput
                value={formState.openaiBaseUrl}
                onChangeText={(text) => setFormState((prev) => ({ ...prev, openaiBaseUrl: text }))}
                onBlur={() =>
                  updateCredentials({
                    openaiBaseUrl: formState.openaiBaseUrl.trim() || DEFAULT_OPENAI_BASE_URL,
                  })
                }
                autoCapitalize="none"
                style={inputStyle}
                placeholder={DEFAULT_OPENAI_BASE_URL}
                placeholderTextColor={placeholderTextColor}
              />
            </View>
            <View style={styles.fieldGroup}>
              <ThemedText style={credentialLabelStyle} lightColor="#1f2937" darkColor="#e2e8f0">
                {t('settings.credentials.labels.api_key')}
              </ThemedText>
              <TextInput
                value={formState.openaiApiKey}
                onChangeText={(text) => setFormState((prev) => ({ ...prev, openaiApiKey: text }))}
                onBlur={() =>
                  updateCredentials({ openaiApiKey: formState.openaiApiKey.trim() || undefined })
                }
                autoCapitalize="none"
                secureTextEntry
                style={inputStyle}
                placeholder="sk-..."
                placeholderTextColor={placeholderTextColor}
              />
            </View>
            <View style={styles.fieldGroup}>
              <ThemedText style={credentialLabelStyle} lightColor="#1f2937" darkColor="#e2e8f0">
                {t('settings.credentials.labels.transcription_model')}
              </ThemedText>
              <TextInput
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
                style={inputStyle}
                placeholder={DEFAULT_OPENAI_TRANSCRIPTION_MODEL}
                placeholderTextColor={placeholderTextColor}
              />
            </View>
            <View style={styles.fieldGroup}>
              <ThemedText style={credentialLabelStyle} lightColor="#1f2937" darkColor="#e2e8f0">
                {t('settings.credentials.labels.translation_model')}
              </ThemedText>
              <TextInput
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
                style={inputStyle}
                placeholder={DEFAULT_OPENAI_TRANSLATION_MODEL}
                placeholderTextColor={placeholderTextColor}
              />
            </View>
          </View>

          <View style={styles.section}>
            <ThemedText style={sectionTitleStyle} lightColor="#0f172a" darkColor="#e2e8f0">
              {t('settings.credentials.sections.gemini.title')}
            </ThemedText>
            <View style={styles.fieldGroup}>
              <ThemedText style={credentialLabelStyle} lightColor="#1f2937" darkColor="#e2e8f0">
                {t('settings.credentials.labels.api_key')}
              </ThemedText>
              <TextInput
                value={formState.geminiApiKey}
                onChangeText={(text) => setFormState((prev) => ({ ...prev, geminiApiKey: text }))}
                onBlur={() =>
                  updateCredentials({ geminiApiKey: formState.geminiApiKey.trim() || undefined })
                }
                autoCapitalize="none"
                secureTextEntry
                style={inputStyle}
                placeholder="AIza..."
                placeholderTextColor={placeholderTextColor}
              />
            </View>
            <View style={styles.fieldGroup}>
              <ThemedText style={credentialLabelStyle} lightColor="#1f2937" darkColor="#e2e8f0">
                {t('settings.credentials.labels.translation_model')}
              </ThemedText>
              <TextInput
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
                style={inputStyle}
                placeholder={DEFAULT_GEMINI_TRANSLATION_MODEL}
                placeholderTextColor={placeholderTextColor}
              />
            </View>
          </View>

          <View style={styles.section}>
            <ThemedText style={sectionTitleStyle} lightColor="#0f172a" darkColor="#e2e8f0">
              {t('settings.credentials.sections.soniox.title')}
            </ThemedText>
            <View style={styles.fieldGroup}>
              <ThemedText style={credentialLabelStyle} lightColor="#1f2937" darkColor="#e2e8f0">
                {t('settings.credentials.labels.api_key')}
              </ThemedText>
              <TextInput
                value={formState.sonioxApiKey}
                onChangeText={(text) => setFormState((prev) => ({ ...prev, sonioxApiKey: text }))}
                onBlur={() =>
                  updateCredentials({ sonioxApiKey: formState.sonioxApiKey.trim() || undefined })
                }
                autoCapitalize="none"
                secureTextEntry
                style={inputStyle}
                placeholder="soniox_..."
                placeholderTextColor={placeholderTextColor}
              />
            </View>
          </View>

          <View style={styles.section}>
            <ThemedText style={sectionTitleStyle} lightColor="#0f172a" darkColor="#e2e8f0">
              {t('settings.credentials.sections.qwen.title')}
            </ThemedText>
            <View style={styles.fieldGroup}>
              <ThemedText style={credentialLabelStyle} lightColor="#1f2937" darkColor="#e2e8f0">
                {t('settings.credentials.labels.api_key')}
              </ThemedText>
              <TextInput
                value={formState.qwenApiKey}
                onChangeText={(text) => setFormState((prev) => ({ ...prev, qwenApiKey: text }))}
                onBlur={() =>
                  updateCredentials({ qwenApiKey: formState.qwenApiKey.trim() || undefined })
                }
                autoCapitalize="none"
                secureTextEntry
                style={inputStyle}
                placeholder="sk-..."
                placeholderTextColor={placeholderTextColor}
              />
            </View>
            <View style={styles.fieldGroup}>
              <ThemedText style={credentialLabelStyle} lightColor="#1f2937" darkColor="#e2e8f0">
                {t('settings.credentials.labels.transcription_model')}
              </ThemedText>
              <TextInput
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
                style={inputStyle}
                placeholder={DEFAULT_QWEN_TRANSCRIPTION_MODEL}
                placeholderTextColor={placeholderTextColor}
              />
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  section: {
    gap: 16,
  },
  fieldGroup: {
    gap: 6,
  },
});
