/**
 * 页面名称：摘要设置 (Summary Settings)
 * 文件路径：app/(tabs)/settings/summary.tsx
 * 功能描述：配置标题总结、对话总结与智能对话的引擎、模型以及提示词。
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
    DEFAULT_ASSISTANT_PROMPT,
    DEFAULT_GEMINI_ASSISTANT_MODEL,
    DEFAULT_CONVERSATION_SUMMARY_PROMPT,
    DEFAULT_GEMINI_CONVERSATION_MODEL,
    DEFAULT_GEMINI_TITLE_MODEL,
    DEFAULT_OPENAI_ASSISTANT_MODEL,
    DEFAULT_OPENAI_ASSISTANT_TEMPERATURE,
    DEFAULT_OPENAI_CONVERSATION_MODEL,
    DEFAULT_OPENAI_CONVERSATION_TEMPERATURE,
    DEFAULT_OPENAI_TITLE_MODEL,
    DEFAULT_OPENAI_TITLE_TEMPERATURE,
    DEFAULT_TITLE_SUMMARY_PROMPT,
    type AssistantEngine,
    type ConversationSummaryEngine,
    type TitleSummaryEngine,
} from '@/types/settings';

import {
    CARD_SUBTLE_DARK,
    CARD_SUBTLE_LIGHT,
    CARD_TEXT_DARK,
    CARD_TEXT_LIGHT,
    OptionPill,
    SettingsCard,
    formatNumberInput,
    settingsStyles,
    useSettingsForm,
} from './shared';

// --- 常量定义 ---
const titleSummaryEngines: TitleSummaryEngine[] = ['openai', 'gemini'];
const conversationSummaryEngines: ConversationSummaryEngine[] = ['openai', 'gemini'];
const assistantEngines: AssistantEngine[] = ['openai', 'gemini'];

// --- 主组件 ---
export default function SummarySettingsScreen() {
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
  const resolveTemperature = (value: string, fallback: number) => {
    const trimmed = value.trim();
    if (!trimmed) {
      return fallback;
    }
    const parsed = Number(trimmed);
    if (!Number.isFinite(parsed) || parsed < 0 || parsed > 2) {
      return fallback;
    }
    return parsed;
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
            <ThemedText
              type="subtitle"
              lightColor={CARD_TEXT_LIGHT}
              darkColor={CARD_TEXT_DARK}>
              {t('settings.summary.title_engine.title')}
            </ThemedText>
            <View style={settingsStyles.optionsRow}>
              {titleSummaryEngines.map((engine) => (
                <OptionPill
                  key={engine}
                  label={t(`settings.summary.title_engine.engines.${engine}`)}
                  active={settings.titleSummaryEngine === engine}
                  onPress={() => updateSettings({ titleSummaryEngine: engine })}
                />
              ))}
            </View>
          </SettingsCard>

          {settings.titleSummaryEngine === 'openai' ? (
            <SettingsCard variant="openai">
              <ThemedText
                style={[groupLabelStyle, styles.cardLabel]}
                lightColor={CARD_SUBTLE_LIGHT}
                darkColor={CARD_SUBTLE_DARK}>
                {t('settings.summary.title_engine.openai_label')}
              </ThemedText>
              <TextInput
                value={formState.openaiTitleModel}
                onChangeText={(text) =>
                  setFormState((prev) => ({ ...prev, openaiTitleModel: text }))
                }
                onBlur={() =>
                  updateCredentials({
                    openaiTitleModel:
                      formState.openaiTitleModel.trim() || DEFAULT_OPENAI_TITLE_MODEL,
                  })
                }
                autoCapitalize="none"
                autoCorrect={false}
                style={baseInputStyle}
                placeholder={DEFAULT_OPENAI_TITLE_MODEL}
                placeholderTextColor={placeholderTextColor}
              />
              <ThemedText
                style={[groupLabelStyle, styles.cardLabel]}
                lightColor={CARD_SUBTLE_LIGHT}
                darkColor={CARD_SUBTLE_DARK}>
                {t('settings.summary.title_engine.temperature_label')}
              </ThemedText>
              <TextInput
                value={formState.openaiTitleTemperature}
                onChangeText={(text) =>
                  setFormState((prev) => ({
                    ...prev,
                    openaiTitleTemperature: formatNumberInput(text),
                  }))
                }
                onBlur={() =>
                  updateSettings({
                    openaiTitleTemperature: resolveTemperature(
                      formState.openaiTitleTemperature,
                      DEFAULT_OPENAI_TITLE_TEMPERATURE
                    ),
                  })
                }
                keyboardType="decimal-pad"
                style={baseInputStyle}
                placeholder={`${DEFAULT_OPENAI_TITLE_TEMPERATURE}`}
                placeholderTextColor={placeholderTextColor}
              />
              <ThemedText
                style={[groupLabelStyle, styles.cardLabel]}
                lightColor={CARD_TEXT_LIGHT}
                darkColor={CARD_TEXT_DARK}>
                {t('settings.summary.title_engine.prompt_label')}
              </ThemedText>
              <TextInput
                value={formState.titleSummaryPrompt}
                onChangeText={(text) =>
                  setFormState((prev) => ({ ...prev, titleSummaryPrompt: text }))
                }
                onBlur={() =>
                  updateSettings({
                    titleSummaryPrompt:
                      formState.titleSummaryPrompt.trim() || DEFAULT_TITLE_SUMMARY_PROMPT,
                  })
                }
                style={multilineInputStyle}
                placeholder={DEFAULT_TITLE_SUMMARY_PROMPT}
                placeholderTextColor={placeholderTextColor}
                multiline
                textAlignVertical="top"
              />
            </SettingsCard>
          ) : (
            <SettingsCard variant="gemini">
              <ThemedText
                style={[groupLabelStyle, styles.cardLabel]}
                lightColor={CARD_SUBTLE_LIGHT}
                darkColor={CARD_SUBTLE_DARK}>
                {t('settings.summary.title_engine.gemini_label')}
              </ThemedText>
              <TextInput
                value={formState.geminiTitleModel}
                onChangeText={(text) =>
                  setFormState((prev) => ({ ...prev, geminiTitleModel: text }))
                }
                onBlur={() =>
                  updateCredentials({
                    geminiTitleModel:
                      formState.geminiTitleModel.trim() || DEFAULT_GEMINI_TITLE_MODEL,
                  })
                }
                autoCapitalize="none"
                autoCorrect={false}
                style={baseInputStyle}
                placeholder={DEFAULT_GEMINI_TITLE_MODEL}
                placeholderTextColor={placeholderTextColor}
              />
              <ThemedText
                style={[groupLabelStyle, styles.cardLabel]}
                lightColor={CARD_TEXT_LIGHT}
                darkColor={CARD_TEXT_DARK}>
                {t('settings.summary.title_engine.prompt_label')}
              </ThemedText>
              <TextInput
                value={formState.titleSummaryPrompt}
                onChangeText={(text) =>
                  setFormState((prev) => ({ ...prev, titleSummaryPrompt: text }))
                }
                onBlur={() =>
                  updateSettings({
                    titleSummaryPrompt:
                      formState.titleSummaryPrompt.trim() || DEFAULT_TITLE_SUMMARY_PROMPT,
                  })
                }
                style={multilineInputStyle}
                placeholder={DEFAULT_TITLE_SUMMARY_PROMPT}
                placeholderTextColor={placeholderTextColor}
                multiline
                textAlignVertical="top"
              />
            </SettingsCard>
          )}

          <SettingsCard variant="interaction">
            <ThemedText
              type="subtitle"
              lightColor={CARD_TEXT_LIGHT}
              darkColor={CARD_TEXT_DARK}>
              {t('settings.summary.conversation_engine.title')}
            </ThemedText>
            <View style={settingsStyles.optionsRow}>
              {conversationSummaryEngines.map((engine) => (
                <OptionPill
                  key={engine}
                  label={t(`settings.summary.conversation_engine.engines.${engine}`)}
                  active={settings.conversationSummaryEngine === engine}
                  onPress={() => updateSettings({ conversationSummaryEngine: engine })}
                />
              ))}
            </View>
          </SettingsCard>

          {settings.conversationSummaryEngine === 'openai' ? (
            <SettingsCard variant="openai">
              <ThemedText
                style={[groupLabelStyle, styles.cardLabel]}
                lightColor={CARD_SUBTLE_LIGHT}
                darkColor={CARD_SUBTLE_DARK}>
                {t('settings.summary.conversation_engine.openai_label')}
              </ThemedText>
              <TextInput
                value={formState.openaiConversationModel}
                onChangeText={(text) =>
                  setFormState((prev) => ({ ...prev, openaiConversationModel: text }))
                }
                onBlur={() =>
                  updateCredentials({
                    openaiConversationModel:
                      formState.openaiConversationModel.trim() ||
                      DEFAULT_OPENAI_CONVERSATION_MODEL,
                  })
                }
                autoCapitalize="none"
                autoCorrect={false}
                style={baseInputStyle}
                placeholder={DEFAULT_OPENAI_CONVERSATION_MODEL}
                placeholderTextColor={placeholderTextColor}
              />
              <ThemedText
                style={[groupLabelStyle, styles.cardLabel]}
                lightColor={CARD_SUBTLE_LIGHT}
                darkColor={CARD_SUBTLE_DARK}>
                {t('settings.summary.conversation_engine.temperature_label')}
              </ThemedText>
              <TextInput
                value={formState.openaiConversationTemperature}
                onChangeText={(text) =>
                  setFormState((prev) => ({
                    ...prev,
                    openaiConversationTemperature: formatNumberInput(text),
                  }))
                }
                onBlur={() =>
                  updateSettings({
                    openaiConversationTemperature: resolveTemperature(
                      formState.openaiConversationTemperature,
                      DEFAULT_OPENAI_CONVERSATION_TEMPERATURE
                    ),
                  })
                }
                keyboardType="decimal-pad"
                style={baseInputStyle}
                placeholder={`${DEFAULT_OPENAI_CONVERSATION_TEMPERATURE}`}
                placeholderTextColor={placeholderTextColor}
              />
              <ThemedText
                style={[groupLabelStyle, styles.cardLabel]}
                lightColor={CARD_TEXT_LIGHT}
                darkColor={CARD_TEXT_DARK}>
                {t('settings.summary.conversation_engine.prompt_label')}
              </ThemedText>
              <TextInput
                value={formState.conversationSummaryPrompt}
                onChangeText={(text) =>
                  setFormState((prev) => ({ ...prev, conversationSummaryPrompt: text }))
                }
                onBlur={() =>
                  updateSettings({
                    conversationSummaryPrompt:
                      formState.conversationSummaryPrompt.trim() ||
                      DEFAULT_CONVERSATION_SUMMARY_PROMPT,
                  })
                }
                style={multilineInputStyle}
                placeholder={DEFAULT_CONVERSATION_SUMMARY_PROMPT}
                placeholderTextColor={placeholderTextColor}
                multiline
                textAlignVertical="top"
              />
            </SettingsCard>
          ) : (
            <SettingsCard variant="gemini">
              <ThemedText
                style={[groupLabelStyle, styles.cardLabel]}
                lightColor={CARD_SUBTLE_LIGHT}
                darkColor={CARD_SUBTLE_DARK}>
                {t('settings.summary.conversation_engine.gemini_label')}
              </ThemedText>
              <TextInput
                value={formState.geminiConversationModel}
                onChangeText={(text) =>
                  setFormState((prev) => ({ ...prev, geminiConversationModel: text }))
                }
                onBlur={() =>
                  updateCredentials({
                    geminiConversationModel:
                      formState.geminiConversationModel.trim() ||
                      DEFAULT_GEMINI_CONVERSATION_MODEL,
                  })
                }
                autoCapitalize="none"
                autoCorrect={false}
                style={baseInputStyle}
                placeholder={DEFAULT_GEMINI_CONVERSATION_MODEL}
                placeholderTextColor={placeholderTextColor}
              />
              <ThemedText
                style={[groupLabelStyle, styles.cardLabel]}
                lightColor={CARD_TEXT_LIGHT}
                darkColor={CARD_TEXT_DARK}>
                {t('settings.summary.conversation_engine.prompt_label')}
              </ThemedText>
              <TextInput
                value={formState.conversationSummaryPrompt}
                onChangeText={(text) =>
                  setFormState((prev) => ({ ...prev, conversationSummaryPrompt: text }))
                }
                onBlur={() =>
                  updateSettings({
                    conversationSummaryPrompt:
                      formState.conversationSummaryPrompt.trim() ||
                      DEFAULT_CONVERSATION_SUMMARY_PROMPT,
                  })
                }
                style={multilineInputStyle}
                placeholder={DEFAULT_CONVERSATION_SUMMARY_PROMPT}
                placeholderTextColor={placeholderTextColor}
                multiline
                textAlignVertical="top"
              />
            </SettingsCard>
          )}

          <SettingsCard variant="interaction">
            <ThemedText
              type="subtitle"
              lightColor={CARD_TEXT_LIGHT}
              darkColor={CARD_TEXT_DARK}>
              {t('settings.summary.assistant_engine.title')}
            </ThemedText>
            <View style={settingsStyles.optionsRow}>
              {assistantEngines.map((engine) => (
                <OptionPill
                  key={engine}
                  label={t(`settings.summary.assistant_engine.engines.${engine}`)}
                  active={settings.assistantEngine === engine}
                  onPress={() => updateSettings({ assistantEngine: engine })}
                />
              ))}
            </View>
          </SettingsCard>

          {settings.assistantEngine === 'openai' ? (
            <SettingsCard variant="openai">
              <ThemedText
                style={[groupLabelStyle, styles.cardLabel]}
                lightColor={CARD_SUBTLE_LIGHT}
                darkColor={CARD_SUBTLE_DARK}>
                {t('settings.summary.assistant_engine.openai_label')}
              </ThemedText>
              <TextInput
                value={formState.openaiAssistantModel}
                onChangeText={(text) =>
                  setFormState((prev) => ({ ...prev, openaiAssistantModel: text }))
                }
                onBlur={() =>
                  updateCredentials({
                    openaiAssistantModel:
                      formState.openaiAssistantModel.trim() || DEFAULT_OPENAI_ASSISTANT_MODEL,
                  })
                }
                autoCapitalize="none"
                autoCorrect={false}
                style={baseInputStyle}
                placeholder={DEFAULT_OPENAI_ASSISTANT_MODEL}
                placeholderTextColor={placeholderTextColor}
              />
              <ThemedText
                style={[groupLabelStyle, styles.cardLabel]}
                lightColor={CARD_SUBTLE_LIGHT}
                darkColor={CARD_SUBTLE_DARK}>
                {t('settings.summary.assistant_engine.temperature_label')}
              </ThemedText>
              <TextInput
                value={formState.openaiAssistantTemperature}
                onChangeText={(text) =>
                  setFormState((prev) => ({
                    ...prev,
                    openaiAssistantTemperature: formatNumberInput(text),
                  }))
                }
                onBlur={() =>
                  updateSettings({
                    openaiAssistantTemperature: resolveTemperature(
                      formState.openaiAssistantTemperature,
                      DEFAULT_OPENAI_ASSISTANT_TEMPERATURE
                    ),
                  })
                }
                keyboardType="decimal-pad"
                style={baseInputStyle}
                placeholder={`${DEFAULT_OPENAI_ASSISTANT_TEMPERATURE}`}
                placeholderTextColor={placeholderTextColor}
              />
              <ThemedText
                style={[groupLabelStyle, styles.cardLabel]}
                lightColor={CARD_TEXT_LIGHT}
                darkColor={CARD_TEXT_DARK}>
                {t('settings.summary.assistant_engine.prompt_label')}
              </ThemedText>
              <TextInput
                value={formState.assistantPrompt}
                onChangeText={(text) => setFormState((prev) => ({ ...prev, assistantPrompt: text }))}
                onBlur={() =>
                  updateSettings({
                    assistantPrompt: formState.assistantPrompt.trim() || DEFAULT_ASSISTANT_PROMPT,
                  })
                }
                style={multilineInputStyle}
                placeholder={DEFAULT_ASSISTANT_PROMPT}
                placeholderTextColor={placeholderTextColor}
                multiline
                textAlignVertical="top"
              />
            </SettingsCard>
          ) : (
            <SettingsCard variant="gemini">
              <ThemedText
                style={[groupLabelStyle, styles.cardLabel]}
                lightColor={CARD_SUBTLE_LIGHT}
                darkColor={CARD_SUBTLE_DARK}>
                {t('settings.summary.assistant_engine.gemini_label')}
              </ThemedText>
              <TextInput
                value={formState.geminiAssistantModel}
                onChangeText={(text) =>
                  setFormState((prev) => ({ ...prev, geminiAssistantModel: text }))
                }
                onBlur={() =>
                  updateCredentials({
                    geminiAssistantModel:
                      formState.geminiAssistantModel.trim() || DEFAULT_GEMINI_ASSISTANT_MODEL,
                  })
                }
                autoCapitalize="none"
                autoCorrect={false}
                style={baseInputStyle}
                placeholder={DEFAULT_GEMINI_ASSISTANT_MODEL}
                placeholderTextColor={placeholderTextColor}
              />
              <ThemedText
                style={[groupLabelStyle, styles.cardLabel]}
                lightColor={CARD_TEXT_LIGHT}
                darkColor={CARD_TEXT_DARK}>
                {t('settings.summary.assistant_engine.prompt_label')}
              </ThemedText>
              <TextInput
                value={formState.assistantPrompt}
                onChangeText={(text) => setFormState((prev) => ({ ...prev, assistantPrompt: text }))}
                onBlur={() =>
                  updateSettings({
                    assistantPrompt: formState.assistantPrompt.trim() || DEFAULT_ASSISTANT_PROMPT,
                  })
                }
                style={multilineInputStyle}
                placeholder={DEFAULT_ASSISTANT_PROMPT}
                placeholderTextColor={placeholderTextColor}
                multiline
                textAlignVertical="top"
              />
            </SettingsCard>
          )}
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
    paddingTop: 12,
    paddingBottom: 12,
  },
  promptInputDark: {
    color: '#e2e8f0',
  },
});
