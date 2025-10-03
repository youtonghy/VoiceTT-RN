
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
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

const VENDOR_GRADIENTS = {
  openai: ['#22d3ee', '#6366f1', '#a855f7'],
  gemini: ['#34d399', '#22d3ee', '#2563eb'],
  soniox: ['#f97316', '#fb7185', '#ec4899'],
  qwen: ['#a855f7', '#6366f1', '#14b8a6'],
} as const;

export default function CredentialSettingsScreen() {
  const { t } = useTranslation();
  const { settings, updateCredentials } = useSettings();
  const { formState, setFormState } = useSettingsForm(settings);
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const insets = useSafeAreaInsets();

  const inputStyle = [settingsStyles.input, isDark && settingsStyles.inputDark];
  const credentialLabelStyle = [settingsStyles.cardLabel, isDark && settingsStyles.cardLabelDark, styles.cardLabel];
  const sectionTitleStyle = [settingsStyles.sectionTitle, styles.cardTitle];
  const cardSurfaceStyle = [styles.cardContent, isDark ? styles.cardContentDark : styles.cardContentLight];
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
            <LinearGradient
              colors={VENDOR_GRADIENTS.openai}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={[styles.cardSurface, styles.cardShadow]}>
              <View style={cardSurfaceStyle}>
                <ThemedText style={sectionTitleStyle} lightColor="#f8fafc" darkColor="#f8fafc">
                  {t('settings.credentials.sections.openai.title')}
                </ThemedText>
                <View style={styles.fieldGroup}>
                  <ThemedText style={credentialLabelStyle} lightColor="#f8fafc" darkColor="#e2e8f0">
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
                  <ThemedText style={credentialLabelStyle} lightColor="#f8fafc" darkColor="#e2e8f0">
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
                  <ThemedText style={credentialLabelStyle} lightColor="#f8fafc" darkColor="#e2e8f0">
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
                          formState.openaiTranscriptionModel.trim() ||
                          DEFAULT_OPENAI_TRANSCRIPTION_MODEL,
                      })
                    }
                    autoCapitalize="none"
                    style={inputStyle}
                    placeholder={DEFAULT_OPENAI_TRANSCRIPTION_MODEL}
                    placeholderTextColor={placeholderTextColor}
                  />
                </View>
                <View style={styles.fieldGroup}>
                  <ThemedText style={credentialLabelStyle} lightColor="#f8fafc" darkColor="#e2e8f0">
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
                          formState.openaiTranslationModel.trim() ||
                          DEFAULT_OPENAI_TRANSLATION_MODEL,
                      })
                    }
                    autoCapitalize="none"
                    style={inputStyle}
                    placeholder={DEFAULT_OPENAI_TRANSLATION_MODEL}
                    placeholderTextColor={placeholderTextColor}
                  />
                </View>
              </View>
            </LinearGradient>
          </View>

          <View style={styles.section}>
            <LinearGradient
              colors={VENDOR_GRADIENTS.gemini}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={[styles.cardSurface, styles.cardShadow]}>
              <View style={cardSurfaceStyle}>
                <ThemedText style={sectionTitleStyle} lightColor="#f8fafc" darkColor="#f8fafc">
                  {t('settings.credentials.sections.gemini.title')}
                </ThemedText>
                <View style={styles.fieldGroup}>
                  <ThemedText style={credentialLabelStyle} lightColor="#f8fafc" darkColor="#e2e8f0">
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
                  <ThemedText style={credentialLabelStyle} lightColor="#f8fafc" darkColor="#e2e8f0">
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
            </LinearGradient>
          </View>

          <View style={styles.section}>
            <LinearGradient
              colors={VENDOR_GRADIENTS.soniox}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={[styles.cardSurface, styles.cardShadow]}>
              <View style={cardSurfaceStyle}>
                <ThemedText style={sectionTitleStyle} lightColor="#f8fafc" darkColor="#f8fafc">
                  {t('settings.credentials.sections.soniox.title')}
                </ThemedText>
                <View style={styles.fieldGroup}>
                  <ThemedText style={credentialLabelStyle} lightColor="#f8fafc" darkColor="#e2e8f0">
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
            </LinearGradient>
          </View>

          <View style={styles.section}>
            <LinearGradient
              colors={VENDOR_GRADIENTS.qwen}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={[styles.cardSurface, styles.cardShadow]}>
              <View style={cardSurfaceStyle}>
                <ThemedText style={sectionTitleStyle} lightColor="#f8fafc" darkColor="#f8fafc">
                  {t('settings.credentials.sections.qwen.title')}
                </ThemedText>
                <View style={styles.fieldGroup}>
                  <ThemedText style={credentialLabelStyle} lightColor="#f8fafc" darkColor="#e2e8f0">
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
                  <ThemedText style={credentialLabelStyle} lightColor="#f8fafc" darkColor="#e2e8f0">
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
            </LinearGradient>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  section: {
    borderRadius: 28,
  },
  cardSurface: {
    borderRadius: 28,
    padding: 2,
    overflow: 'hidden',
  },
  cardShadow: {
    shadowColor: '#0f172a',
    shadowOpacity: 0.22,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 12 },
    elevation: 8,
  },
  cardContent: {
    borderRadius: 26,
    padding: 20,
    gap: 16,
  },
  cardContentLight: {
    backgroundColor: 'rgba(15, 23, 42, 0.08)',
  },
  cardContentDark: {
    backgroundColor: 'rgba(2, 6, 23, 0.65)',
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.25)',
  },
  cardTitle: {
    fontSize: 22,
    fontWeight: '800',
  },
  cardLabel: {
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  fieldGroup: {
    gap: 6,
  },
});
