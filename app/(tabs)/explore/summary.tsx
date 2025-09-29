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
            <Text variant="titleMedium">{t('settings.summary.title_engine.title')}</Text>
=======
          keyboardShouldPersistTaps="handled">
          <View style={styles.section}>
            <ThemedText type="subtitle" lightColor="#0f172a" darkColor="#e2e8f0">
              标题总结引擎
            </ThemedText>
>>>>>>> parent of e9751a1 (Add i18n support and localize UI text)
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

<<<<<<< HEAD
            <View style={styles.fieldGroup}>
              <Text variant="labelLarge">{t('settings.summary.title_engine.openai_label')}</Text>
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
              <Text variant="labelLarge">{t('settings.summary.title_engine.gemini_label')}</Text>
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
              <Text variant="labelLarge">{t('settings.summary.title_engine.prompt_label')}</Text>
              <PaperTextInput
                value={formState.titleSummaryPrompt}
                onChangeText={(text) => setFormState((prev) => ({ ...prev, titleSummaryPrompt: text }))}
                onBlur={() =>
                  updateSettings({
                    titleSummaryPrompt:
                      formState.titleSummaryPrompt.trim() || DEFAULT_TITLE_SUMMARY_PROMPT,
                  })
                }
                mode="outlined"
                placeholder={DEFAULT_TITLE_SUMMARY_PROMPT}
                multiline
                numberOfLines={5}
                style={styles.promptInput}
              />
            </View>
          </Surface>

          <Surface style={sectionCardStyle} mode="flat" elevation={1}>
            <Text variant="titleMedium">{t('settings.summary.conversation_engine.title')}</Text>
=======
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
>>>>>>> parent of e9751a1 (Add i18n support and localize UI text)
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

<<<<<<< HEAD
            <View style={styles.fieldGroup}>
              <Text variant="labelLarge">{t('settings.summary.conversation_engine.openai_label')}</Text>
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

            <View style={styles.fieldGroup}>
              <Text variant="labelLarge">{t('settings.summary.conversation_engine.gemini_label')}</Text>
              <PaperTextInput
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
                mode="outlined"
                placeholder={DEFAULT_GEMINI_CONVERSATION_MODEL}
              />
            </View>

            <View style={styles.fieldGroup}>
              <Text variant="labelLarge">{t('settings.summary.conversation_engine.prompt_label')}</Text>
              <PaperTextInput
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
                mode="outlined"
                placeholder={DEFAULT_CONVERSATION_SUMMARY_PROMPT}
                multiline
                numberOfLines={5}
                style={styles.promptInput}
              />
            </View>
          </Surface>
=======
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
>>>>>>> parent of e9751a1 (Add i18n support and localize UI text)
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  fieldGroup: {
    gap: 8,
  },
  promptInput: {
    minHeight: 120,
  },
});
