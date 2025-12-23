
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
  DEFAULT_OPENAI_BASE_URL,
  DEFAULT_GLM_TRANSCRIPTION_MODEL,
  DEFAULT_QWEN_TRANSCRIPTION_MODEL,
} from '@/services/transcription';

import {
  CARD_SUBTLE_DARK,
  CARD_SUBTLE_LIGHT,
  CARD_TEXT_DARK,
  CARD_TEXT_LIGHT,
  SettingsCard,
  settingsStyles,
  useSettingsForm,
} from './shared';

export default function CredentialSettingsScreen() {
  const { t } = useTranslation();
  const { settings, updateCredentials } = useSettings();
  const { formState, setFormState } = useSettingsForm(settings);
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const insets = useSafeAreaInsets();

  const inputStyle = [settingsStyles.input, isDark && settingsStyles.inputDark];
  const credentialLabelStyle = [
    settingsStyles.cardLabel,
    isDark && settingsStyles.cardLabelDark,
    styles.cardLabel,
  ];
  const sectionTitleStyle = [styles.cardTitle];
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
          <SettingsCard variant="openai">
            <ThemedText style={sectionTitleStyle} lightColor={CARD_TEXT_LIGHT} darkColor={CARD_TEXT_DARK}>
              {t('settings.credentials.sections.openai.title')}
            </ThemedText>
            <View style={styles.fieldGroup}>
              <ThemedText
                style={credentialLabelStyle}
                lightColor={CARD_SUBTLE_LIGHT}
                darkColor={CARD_SUBTLE_DARK}>
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
              <ThemedText
                style={credentialLabelStyle}
                lightColor={CARD_SUBTLE_LIGHT}
                darkColor={CARD_SUBTLE_DARK}>
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
          </SettingsCard>

          <SettingsCard variant="gemini">
            <ThemedText style={sectionTitleStyle} lightColor={CARD_TEXT_LIGHT} darkColor={CARD_TEXT_DARK}>
              {t('settings.credentials.sections.gemini.title')}
            </ThemedText>
            <View style={styles.fieldGroup}>
              <ThemedText
                style={credentialLabelStyle}
                lightColor={CARD_SUBTLE_LIGHT}
                darkColor={CARD_SUBTLE_DARK}>
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
          </SettingsCard>

          <SettingsCard variant="soniox">
            <ThemedText style={sectionTitleStyle} lightColor={CARD_TEXT_LIGHT} darkColor={CARD_TEXT_DARK}>
              {t('settings.credentials.sections.soniox.title')}
            </ThemedText>
            <View style={styles.fieldGroup}>
              <ThemedText
                style={credentialLabelStyle}
                lightColor={CARD_SUBTLE_LIGHT}
                darkColor={CARD_SUBTLE_DARK}>
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
          </SettingsCard>

          <SettingsCard variant="qwen">
            <ThemedText style={sectionTitleStyle} lightColor={CARD_TEXT_LIGHT} darkColor={CARD_TEXT_DARK}>
              {t('settings.credentials.sections.qwen.title')}
            </ThemedText>
            <View style={styles.fieldGroup}>
              <ThemedText
                style={credentialLabelStyle}
                lightColor={CARD_SUBTLE_LIGHT}
                darkColor={CARD_SUBTLE_DARK}>
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
              <ThemedText
                style={credentialLabelStyle}
                lightColor={CARD_SUBTLE_LIGHT}
                darkColor={CARD_SUBTLE_DARK}>
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
          </SettingsCard>

          <SettingsCard variant="glm">
            <ThemedText style={sectionTitleStyle} lightColor={CARD_TEXT_LIGHT} darkColor={CARD_TEXT_DARK}>
              {t('settings.credentials.sections.glm.title')}
            </ThemedText>
            <View style={styles.fieldGroup}>
              <ThemedText
                style={credentialLabelStyle}
                lightColor={CARD_SUBTLE_LIGHT}
                darkColor={CARD_SUBTLE_DARK}>
                {t('settings.credentials.labels.api_key')}
              </ThemedText>
              <TextInput
                value={formState.glmApiKey}
                onChangeText={(text) => setFormState((prev) => ({ ...prev, glmApiKey: text }))}
                onBlur={() =>
                  updateCredentials({ glmApiKey: formState.glmApiKey.trim() || undefined })
                }
                autoCapitalize="none"
                secureTextEntry
                style={inputStyle}
                placeholder="token"
                placeholderTextColor={placeholderTextColor}
              />
            </View>
            <View style={styles.fieldGroup}>
              <ThemedText
                style={credentialLabelStyle}
                lightColor={CARD_SUBTLE_LIGHT}
                darkColor={CARD_SUBTLE_DARK}>
                {t('settings.credentials.labels.transcription_model')}
              </ThemedText>
              <TextInput
                value={formState.glmTranscriptionModel}
                onChangeText={(text) =>
                  setFormState((prev) => ({ ...prev, glmTranscriptionModel: text }))
                }
                onBlur={() =>
                  updateCredentials({
                    glmTranscriptionModel:
                      formState.glmTranscriptionModel.trim() || DEFAULT_GLM_TRANSCRIPTION_MODEL,
                  })
                }
                autoCapitalize="none"
                style={inputStyle}
                placeholder={DEFAULT_GLM_TRANSCRIPTION_MODEL}
                placeholderTextColor={placeholderTextColor}
              />
            </View>
          </SettingsCard>

          <SettingsCard variant="interaction">
            <ThemedText style={sectionTitleStyle} lightColor={CARD_TEXT_LIGHT} darkColor={CARD_TEXT_DARK}>
              {t('settings.credentials.sections.doubao.title')}
            </ThemedText>
            <View style={styles.fieldGroup}>
              <ThemedText
                style={credentialLabelStyle}
                lightColor={CARD_SUBTLE_LIGHT}
                darkColor={CARD_SUBTLE_DARK}>
                {t('settings.credentials.labels.doubao_app_id')}
              </ThemedText>
              <TextInput
                value={formState.doubaoAppId}
                onChangeText={(text) => setFormState((prev) => ({ ...prev, doubaoAppId: text }))}
                onBlur={() =>
                  updateCredentials({ doubaoAppId: formState.doubaoAppId.trim() || undefined })
                }
                autoCapitalize="none"
                style={inputStyle}
                placeholder="appid"
                placeholderTextColor={placeholderTextColor}
              />
            </View>
            <View style={styles.fieldGroup}>
              <ThemedText
                style={credentialLabelStyle}
                lightColor={CARD_SUBTLE_LIGHT}
                darkColor={CARD_SUBTLE_DARK}>
                {t('settings.credentials.labels.doubao_token')}
              </ThemedText>
              <TextInput
                value={formState.doubaoToken}
                onChangeText={(text) => setFormState((prev) => ({ ...prev, doubaoToken: text }))}
                onBlur={() =>
                  updateCredentials({ doubaoToken: formState.doubaoToken.trim() || undefined })
                }
                autoCapitalize="none"
                secureTextEntry
                style={inputStyle}
                placeholder="token"
                placeholderTextColor={placeholderTextColor}
              />
            </View>
            <View style={styles.fieldGroup}>
              <ThemedText
                style={credentialLabelStyle}
                lightColor={CARD_SUBTLE_LIGHT}
                darkColor={CARD_SUBTLE_DARK}>
                {t('settings.credentials.labels.doubao_cluster')}
              </ThemedText>
              <TextInput
                value={formState.doubaoCluster}
                onChangeText={(text) => setFormState((prev) => ({ ...prev, doubaoCluster: text }))}
                onBlur={() =>
                  updateCredentials({ doubaoCluster: formState.doubaoCluster.trim() || undefined })
                }
                autoCapitalize="none"
                style={inputStyle}
                placeholder="cluster id"
                placeholderTextColor={placeholderTextColor}
              />
            </View>
          </SettingsCard>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
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
