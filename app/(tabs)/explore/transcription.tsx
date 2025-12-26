/**
 * 页面名称：转录设置 (Transcription Settings)
 * 文件路径：app/(tabs)/explore/transcription.tsx
 * 功能描述：配置语音转文字 (STT) 引擎、模型、语言以及自定义提示词。
 */

import Ionicons from '@expo/vector-icons/Ionicons';
import { useTranslation } from 'react-i18next';
import {
    Alert,
    KeyboardAvoidingView,
    Linking,
    Platform,
    Pressable,
    ScrollView,
    StyleSheet,
    TextInput,
    View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { useSettings } from '@/contexts/settings-context';
import { useColorScheme } from '@/hooks/use-color-scheme';
import {
    DEFAULT_GEMINI_TRANSCRIPTION_MODEL,
    DEFAULT_OPENAI_TRANSCRIPTION_MODEL,
} from '@/services/transcription';
import type { TranscriptionEngine } from '@/types/settings';

import {
    CARD_SUBTLE_DARK,
    CARD_SUBTLE_LIGHT,
    CARD_TEXT_DARK,
    CARD_TEXT_LIGHT,
    OptionPill,
    SettingsCard,
    settingsStyles,
    useSettingsForm,
} from './shared';

// --- 常量定义 ---
const transcriptionEngines: TranscriptionEngine[] = ['openai', 'gemini', 'qwen3', 'soniox', 'doubao', 'glm'];
const OPENAI_STT_DOCS_URL = 'https://platform.openai.com/docs/guides/speech-to-text';
const GEMINI_STT_DOCS_URL = 'https://ai.google.dev/gemini-api/docs/audio#javascript';

// --- 主组件 ---
export default function TranscriptionSettingsScreen() {
  const { t } = useTranslation();
  const { settings, updateSettings, updateCredentials } = useSettings();
  const { formState, setFormState } = useSettingsForm(settings);
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const insets = useSafeAreaInsets();

  // --- 样式配置 ---
  const baseInputStyle = [settingsStyles.input, isDark ? settingsStyles.inputDark : null];
  const multilineInputStyle = [
    settingsStyles.input,
    styles.promptInput,
    isDark ? settingsStyles.inputDark : null,
    isDark ? styles.promptInputDark : null,
  ];
  const groupLabelStyle = [settingsStyles.groupLabel, isDark && settingsStyles.groupLabelDark];
  const placeholderTextColor = isDark ? '#94a3b8' : '#64748b';
  const safeAreaStyle = [
    settingsStyles.safeArea,
    isDark ? settingsStyles.safeAreaDark : settingsStyles.safeAreaLight,
  ];
  const helpIconColor = isDark ? '#e2e8f0' : '#0f172a';
  const isGeminiEngine = settings.transcriptionEngine === 'gemini';
  const helpLabel = isGeminiEngine
    ? t('settings.transcription.help_label_gemini')
    : t('settings.transcription.help_label_openai');

  const handleOpenDocs = () => {
    const url = isGeminiEngine ? GEMINI_STT_DOCS_URL : OPENAI_STT_DOCS_URL;
    Linking.openURL(url).catch((error) => {
      console.warn('[settings] Failed to open link', url, error);
      Alert.alert(t('settings.transcription.help_error_title'), t('settings.transcription.help_error_body'));
    });
  };

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
          <SettingsCard variant="interaction">
            <View style={styles.headerRow}>
              <ThemedText
                type="subtitle"
                lightColor={CARD_TEXT_LIGHT}
                darkColor={CARD_TEXT_DARK}>
                {t('settings.transcription.labels.engine')}
              </ThemedText>
              <Pressable
                accessibilityRole="link"
                accessibilityLabel={helpLabel}
                onPress={handleOpenDocs}
                style={({ pressed }) => [styles.helpButton, pressed && styles.helpButtonPressed]}>
                <Ionicons name="help-circle-outline" size={20} color={helpIconColor} />
              </Pressable>
            </View>
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
          </SettingsCard>

          {settings.transcriptionEngine === 'openai' ? (
            <SettingsCard variant="openai">
              <ThemedText type="subtitle" lightColor={CARD_TEXT_LIGHT} darkColor={CARD_TEXT_DARK}>
                {t('settings.transcription.engines.openai')}
              </ThemedText>
              <View style={styles.fieldStack}>
                <View style={styles.fieldGroup}>
                  <ThemedText
                    style={[groupLabelStyle, styles.cardLabel]}
                    lightColor={CARD_SUBTLE_LIGHT}
                    darkColor={CARD_SUBTLE_DARK}>
                    {t('settings.transcription.labels.openai_model')}
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
                    autoCorrect={false}
                    style={baseInputStyle}
                    placeholder={DEFAULT_OPENAI_TRANSCRIPTION_MODEL}
                    placeholderTextColor={placeholderTextColor}
                  />
                </View>

                <View style={styles.fieldGroup}>
                  <ThemedText
                    style={[groupLabelStyle, styles.cardLabel]}
                    lightColor={CARD_TEXT_LIGHT}
                    darkColor={CARD_TEXT_DARK}>
                    {t('settings.transcription.labels.prompt')}
                  </ThemedText>
                  <TextInput
                    value={formState.openaiTranscriptionPrompt}
                    onChangeText={(text) =>
                      setFormState((prev) => ({ ...prev, openaiTranscriptionPrompt: text }))
                    }
                    onBlur={() =>
                      updateSettings({
                        openaiTranscriptionPrompt: formState.openaiTranscriptionPrompt.trim(),
                      })
                    }
                    style={multilineInputStyle}
                    placeholder={t('settings.transcription.labels.prompt_placeholder')}
                    placeholderTextColor={placeholderTextColor}
                    multiline
                    textAlignVertical="top"
                  />
                  <ThemedText
                    style={styles.promptHint}
                    lightColor={CARD_SUBTLE_LIGHT}
                    darkColor={CARD_SUBTLE_DARK}>
                    {t('settings.transcription.labels.prompt_hint')}
                  </ThemedText>
                </View>
              </View>
            </SettingsCard>
          ) : null}

          {settings.transcriptionEngine === 'gemini' ? (
            <SettingsCard variant="gemini">
              <ThemedText type="subtitle" lightColor={CARD_TEXT_LIGHT} darkColor={CARD_TEXT_DARK}>
                {t('settings.transcription.engines.gemini')}
              </ThemedText>
              <View style={styles.fieldStack}>
                <View style={styles.fieldGroup}>
                  <ThemedText
                    style={[groupLabelStyle, styles.cardLabel]}
                    lightColor={CARD_SUBTLE_LIGHT}
                    darkColor={CARD_SUBTLE_DARK}>
                    {t('settings.transcription.labels.gemini_model')}
                  </ThemedText>
                  <TextInput
                    value={formState.geminiTranscriptionModel}
                    onChangeText={(text) =>
                      setFormState((prev) => ({ ...prev, geminiTranscriptionModel: text }))
                    }
                    onBlur={() =>
                      updateCredentials({
                        geminiTranscriptionModel:
                          formState.geminiTranscriptionModel.trim() ||
                          DEFAULT_GEMINI_TRANSCRIPTION_MODEL,
                      })
                    }
                    autoCapitalize="none"
                    autoCorrect={false}
                    style={baseInputStyle}
                    placeholder={DEFAULT_GEMINI_TRANSCRIPTION_MODEL}
                    placeholderTextColor={placeholderTextColor}
                  />
                </View>

                <View style={styles.fieldGroup}>
                  <ThemedText
                    style={[groupLabelStyle, styles.cardLabel]}
                    lightColor={CARD_TEXT_LIGHT}
                    darkColor={CARD_TEXT_DARK}>
                    {t('settings.transcription.labels.prompt')}
                  </ThemedText>
                  <TextInput
                    value={formState.geminiTranscriptionPrompt}
                    onChangeText={(text) =>
                      setFormState((prev) => ({ ...prev, geminiTranscriptionPrompt: text }))
                    }
                    onBlur={() =>
                      updateSettings({
                        geminiTranscriptionPrompt: formState.geminiTranscriptionPrompt.trim(),
                      })
                    }
                    style={multilineInputStyle}
                    placeholder={t('settings.transcription.labels.prompt_placeholder')}
                    placeholderTextColor={placeholderTextColor}
                    multiline
                    textAlignVertical="top"
                  />
                  <ThemedText
                    style={styles.promptHint}
                    lightColor={CARD_SUBTLE_LIGHT}
                    darkColor={CARD_SUBTLE_DARK}>
                    {t('settings.transcription.labels.prompt_hint')}
                  </ThemedText>
                </View>
              </View>
            </SettingsCard>
          ) : null}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  cardLabel: {
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 0.4,
  },
  promptInput: {
    minHeight: 120,
    paddingTop: 12,
    paddingBottom: 12,
  },
  promptInputDark: {
    color: '#e2e8f0',
  },
  promptHint: {
    fontSize: 12,
    lineHeight: 18,
  },
  fieldStack: {
    gap: 16,
  },
  fieldGroup: {
    gap: 6,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  helpButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  helpButtonPressed: {
    opacity: 0.8,
  },
});
