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
  DEFAULT_CONVERSATION_SUMMARY_PROMPT,
  DEFAULT_GEMINI_CONVERSATION_MODEL,
  DEFAULT_GEMINI_TITLE_MODEL,
  DEFAULT_OPENAI_CONVERSATION_MODEL,
  DEFAULT_OPENAI_TITLE_MODEL,
  DEFAULT_TITLE_SUMMARY_PROMPT,
  type ConversationSummaryEngine,
  type TitleSummaryEngine,
} from '@/types/settings';

import {
  OptionPill,
  settingsStyles,
  useSettingsForm,
} from './shared';

const titleSummaryEngines: TitleSummaryEngine[] = ['openai', 'gemini'];
const conversationSummaryEngines: ConversationSummaryEngine[] = ['openai', 'gemini'];

export default function SummarySettingsScreen() {
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
              标题总结引擎
            </ThemedText>
            <View style={settingsStyles.optionsRow}>
              {titleSummaryEngines.map((engine) => (
                <OptionPill
                  key={engine}
                  label={engine.toUpperCase()}
                  active={settings.titleSummaryEngine === engine}
                  onPress={() => updateSettings({ titleSummaryEngine: engine })}
                />
              ))}
            </View>
          </View>

          <View style={styles.section}>
            <ThemedText style={groupLabelStyle} lightColor="#1f2937" darkColor="#e2e8f0">
              OpenAI 标题模型
            </ThemedText>
            <TextInput
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
              style={baseInputStyle}
              placeholder={DEFAULT_OPENAI_TITLE_MODEL}
              placeholderTextColor={placeholderTextColor}
            />
          </View>

          <View style={styles.section}>
            <ThemedText style={groupLabelStyle} lightColor="#1f2937" darkColor="#e2e8f0">
              Gemini 标题模型
            </ThemedText>
            <TextInput
              value={formState.geminiTitleModel}
              onChangeText={(text) => setFormState((prev) => ({ ...prev, geminiTitleModel: text }))}
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
          </View>

          <View style={styles.section}>
            <ThemedText style={groupLabelStyle} lightColor="#1f2937" darkColor="#e2e8f0">
              提示词
            </ThemedText>
            <TextInput
              value={formState.titleSummaryPrompt}
              onChangeText={(text) => setFormState((prev) => ({ ...prev, titleSummaryPrompt: text }))}
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
          </View>

          <View style={styles.section}>
            <ThemedText type="subtitle" lightColor="#0f172a" darkColor="#e2e8f0">
              对话总结引擎
            </ThemedText>
            <View style={settingsStyles.optionsRow}>
              {conversationSummaryEngines.map((engine) => (
                <OptionPill
                  key={engine}
                  label={engine.toUpperCase()}
                  active={settings.conversationSummaryEngine === engine}
                  onPress={() => updateSettings({ conversationSummaryEngine: engine })}
                />
              ))}
            </View>
          </View>

          <View style={styles.section}>
            <ThemedText style={groupLabelStyle} lightColor="#1f2937" darkColor="#e2e8f0">
              OpenAI 对话总结模型
            </ThemedText>
            <TextInput
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
              style={baseInputStyle}
              placeholder={DEFAULT_OPENAI_CONVERSATION_MODEL}
              placeholderTextColor={placeholderTextColor}
            />
          </View>

          <View style={styles.section}>
            <ThemedText style={groupLabelStyle} lightColor="#1f2937" darkColor="#e2e8f0">
              Gemini 对话总结模型
            </ThemedText>
            <TextInput
              value={formState.geminiConversationModel}
              onChangeText={(text) =>
                setFormState((prev) => ({ ...prev, geminiConversationModel: text }))
              }
              onBlur={() =>
                updateCredentials({
                  geminiConversationModel:
                    formState.geminiConversationModel.trim() || DEFAULT_GEMINI_CONVERSATION_MODEL,
                })
              }
              autoCapitalize="none"
              autoCorrect={false}
              style={baseInputStyle}
              placeholder={DEFAULT_GEMINI_CONVERSATION_MODEL}
              placeholderTextColor={placeholderTextColor}
            />
          </View>

          <View style={styles.section}>
            <ThemedText style={groupLabelStyle} lightColor="#1f2937" darkColor="#e2e8f0">
              对话总结提示词
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
    paddingTop: 12,
    paddingBottom: 12,
  },
  promptInputDark: {
    color: '#e2e8f0',
  },
});
