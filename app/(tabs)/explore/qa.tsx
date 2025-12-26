/**
 * 页面名称：问答设置 (QA Settings)
 * 文件路径：app/(tabs)/explore/qa.tsx
 * 功能描述：配置问答引擎（OpenAI, Gemini）、模型选择以及自定义提示词 (Prompt)。
 */

import { useTranslation } from 'react-i18next';
import {
    KeyboardAvoidingView,
    Platform,
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
    DEFAULT_GEMINI_QA_MODEL,
    DEFAULT_OPENAI_QA_MODEL,
    DEFAULT_QA_PROMPT,
    type QaEngine,
} from '@/types/settings';

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
const qaEngines: QaEngine[] = ['openai', 'gemini'];

// --- 主组件 ---
export default function QaSettingsScreen() {
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
          <SettingsCard variant="interaction">
            <ThemedText
              type="subtitle"
              lightColor={CARD_TEXT_LIGHT}
              darkColor={CARD_TEXT_DARK}>
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
          </SettingsCard>

          <SettingsCard variant="openai">
            <ThemedText
              style={[groupLabelStyle, styles.cardLabel]}
              lightColor={CARD_SUBTLE_LIGHT}
              darkColor={CARD_SUBTLE_DARK}>
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
          </SettingsCard>

          <SettingsCard variant="gemini">
            <ThemedText
              style={[groupLabelStyle, styles.cardLabel]}
              lightColor={CARD_SUBTLE_LIGHT}
              darkColor={CARD_SUBTLE_DARK}>
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
          </SettingsCard>

          <SettingsCard variant="prompt">
            <ThemedText
              style={[groupLabelStyle, styles.cardLabel]}
              lightColor={CARD_TEXT_LIGHT}
              darkColor={CARD_TEXT_DARK}>
              {t('settings.qa.prompt_label')}
            </ThemedText>
            <TextInput
              value={formState.qaPrompt}
              onChangeText={(text) => setFormState((prev) => ({ ...prev, qaPrompt: text }))}
              onBlur={() =>
                updateSettings({
                  qaPrompt: formState.qaPrompt.trim() || DEFAULT_QA_PROMPT,
                })
              }
              style={multilineInputStyle}
              placeholder={DEFAULT_QA_PROMPT}
              placeholderTextColor={placeholderTextColor}
              multiline
              textAlignVertical="top"
            />
          </SettingsCard>
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
    minHeight: 140,
    textAlignVertical: 'top',
    paddingTop: 12,
    paddingBottom: 12,
  },
  promptInputDark: {
    color: '#e2e8f0',
  },
});
