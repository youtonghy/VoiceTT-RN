/**
 * 页面名称：翻译设置 (Translation Settings)
 * 文件路径：app/(tabs)/explore/translation.tsx
 * 功能描述：配置实时翻译引擎、目标语言、模型以及自定义翻译提示词。
 */

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
    KeyboardAvoidingView,
    Modal,
    Platform,
    Pressable,
    ScrollView,
    StyleSheet,
    Switch,
    TextInput,
    View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { useSettings } from '@/contexts/settings-context';
import { useColorScheme } from '@/hooks/use-color-scheme';
import {
    DEFAULT_GEMINI_TRANSLATION_MODEL,
    DEFAULT_OPENAI_TRANSLATION_MODEL,
} from '@/services/transcription';
import { COMMON_TRANSLATION_TARGET_LANGUAGES, type TranslationEngine } from '@/types/settings';

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
const translationEngines: TranslationEngine[] = ['openai', 'gemini', 'none'];

// --- 主组件 ---
export default function TranslationSettingsScreen() {
  const { t } = useTranslation();
  const { settings, updateSettings, updateCredentials } = useSettings();
  const { formState, setFormState } = useSettingsForm(settings);
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const insets = useSafeAreaInsets();
  const [languageModalVisible, setLanguageModalVisible] = useState(false);

  // --- 样式配置 ---
  const groupLabelStyle = [settingsStyles.groupLabel, isDark && settingsStyles.groupLabelDark];
  const baseInputStyle = [settingsStyles.input, isDark ? settingsStyles.inputDark : null];
  const multilineInputStyle = [
    settingsStyles.input,
    styles.promptInput,
    isDark ? settingsStyles.inputDark : null,
    isDark ? styles.promptInputDark : null,
  ];
  const safeAreaStyle = [
    settingsStyles.safeArea,
    isDark ? settingsStyles.safeAreaDark : settingsStyles.safeAreaLight,
  ];
  const placeholderTextColor = isDark ? '#94a3b8' : '#64748b';
  const selectedTargetLanguageLabel = t(`settings.translation.languages.${settings.translationTargetLanguage}`, {
    defaultValue: settings.translationTargetLanguage,
  });
  const appendedInstruction = t('settings.translation.labels.appended_instruction', {
    language: selectedTargetLanguageLabel,
  });

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
            <View style={settingsStyles.rowBetween}>
              <ThemedText
                type="subtitle"
                lightColor={CARD_TEXT_LIGHT}
                darkColor={CARD_TEXT_DARK}>
                {t('settings.translation.labels.enable_translation')}
              </ThemedText>
              <Switch
                value={settings.enableTranslation}
                onValueChange={(next) => updateSettings({ enableTranslation: next })}
              />
            </View>

            <ThemedText
              style={groupLabelStyle}
              lightColor={CARD_SUBTLE_LIGHT}
              darkColor={CARD_SUBTLE_DARK}>
              {t('settings.translation.labels.engine')}
            </ThemedText>
            <View style={settingsStyles.optionsRow}>
              {translationEngines.map((engine) => (
                <OptionPill
                  key={engine}
                  label={t(`settings.translation.engines.${engine}`)}
                  active={settings.translationEngine === engine}
                  onPress={() => updateSettings({ translationEngine: engine })}
                  disabled={!settings.enableTranslation}
                />
              ))}
            </View>

            <ThemedText
              style={groupLabelStyle}
              lightColor={CARD_SUBTLE_LIGHT}
              darkColor={CARD_SUBTLE_DARK}>
              {t('settings.translation.labels.target_language')}
            </ThemedText>
            <Pressable
              onPress={() => setLanguageModalVisible(true)}
              disabled={!settings.enableTranslation || settings.translationEngine === 'none'}
              style={({ pressed }) => [
                styles.selectPressable,
                pressed && !(!settings.enableTranslation || settings.translationEngine === 'none') && styles.selectPressed,
              ]}>
              <View
                style={[
                  styles.selectBox,
                  isDark ? styles.selectBoxDark : styles.selectBoxLight,
                  (!settings.enableTranslation || settings.translationEngine === 'none') &&
                    styles.selectBoxDisabled,
                ]}>
                <ThemedText
                  lightColor={CARD_TEXT_LIGHT}
                  darkColor={CARD_TEXT_DARK}
                  style={styles.selectText}>
                  {selectedTargetLanguageLabel}
                </ThemedText>
                <ThemedText
                  lightColor={CARD_SUBTLE_LIGHT}
                  darkColor={CARD_SUBTLE_DARK}
                  style={styles.selectChevron}>
                  ▾
                </ThemedText>
              </View>
            </Pressable>
          </SettingsCard>

          {settings.translationEngine === 'openai' ? (
            <SettingsCard variant="openai">
              <ThemedText type="subtitle" lightColor={CARD_TEXT_LIGHT} darkColor={CARD_TEXT_DARK}>
                {t('settings.translation.engines.openai')}
              </ThemedText>
              <View style={styles.fieldStack}>
                <View style={styles.fieldGroup}>
                  <ThemedText
                    style={[groupLabelStyle, styles.cardLabel]}
                    lightColor={CARD_SUBTLE_LIGHT}
                    darkColor={CARD_SUBTLE_DARK}>
                    {t('settings.translation.labels.openai_model')}
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
                    autoCorrect={false}
                    style={baseInputStyle}
                    placeholder={DEFAULT_OPENAI_TRANSLATION_MODEL}
                    placeholderTextColor={placeholderTextColor}
                  />
                </View>

                <View style={styles.fieldGroup}>
                  <ThemedText
                    style={[groupLabelStyle, styles.cardLabel]}
                    lightColor={CARD_TEXT_LIGHT}
                    darkColor={CARD_TEXT_DARK}>
                    {t('settings.translation.labels.prompt')}
                  </ThemedText>
                  <TextInput
                    value={formState.openaiTranslationPrompt}
                    onChangeText={(text) =>
                      setFormState((prev) => ({ ...prev, openaiTranslationPrompt: text }))
                    }
                    onBlur={() =>
                      updateSettings({
                        openaiTranslationPrompt: formState.openaiTranslationPrompt.trim(),
                      })
                    }
                    style={multilineInputStyle}
                    placeholder={t('settings.translation.labels.prompt_placeholder')}
                    placeholderTextColor={placeholderTextColor}
                    multiline
                    textAlignVertical="top"
                  />
                  <ThemedText
                    style={styles.promptHint}
                    lightColor={CARD_SUBTLE_LIGHT}
                    darkColor={CARD_SUBTLE_DARK}>
                    {t('settings.translation.labels.prompt_hint')}
                  </ThemedText>
                  <TextInput
                    value={appendedInstruction}
                    editable={false}
                    multiline
                    scrollEnabled={false}
                    style={[
                      settingsStyles.input,
                      styles.readOnlyInput,
                      isDark ? settingsStyles.inputDark : null,
                      isDark ? styles.readOnlyInputDark : null,
                    ]}
                  />
                </View>
              </View>
            </SettingsCard>
          ) : null}

          {settings.translationEngine === 'gemini' ? (
            <SettingsCard variant="gemini">
              <ThemedText type="subtitle" lightColor={CARD_TEXT_LIGHT} darkColor={CARD_TEXT_DARK}>
                {t('settings.translation.engines.gemini')}
              </ThemedText>
              <View style={styles.fieldStack}>
                <View style={styles.fieldGroup}>
                  <ThemedText
                    style={[groupLabelStyle, styles.cardLabel]}
                    lightColor={CARD_SUBTLE_LIGHT}
                    darkColor={CARD_SUBTLE_DARK}>
                    {t('settings.translation.labels.gemini_model')}
                  </ThemedText>
                  <TextInput
                    value={formState.geminiTranslationModel}
                    onChangeText={(text) =>
                      setFormState((prev) => ({ ...prev, geminiTranslationModel: text }))
                    }
                    onBlur={() =>
                      updateCredentials({
                        geminiTranslationModel:
                          formState.geminiTranslationModel.trim() ||
                          DEFAULT_GEMINI_TRANSLATION_MODEL,
                      })
                    }
                    autoCapitalize="none"
                    autoCorrect={false}
                    style={baseInputStyle}
                    placeholder={DEFAULT_GEMINI_TRANSLATION_MODEL}
                    placeholderTextColor={placeholderTextColor}
                  />
                </View>

                <View style={styles.fieldGroup}>
                  <ThemedText
                    style={[groupLabelStyle, styles.cardLabel]}
                    lightColor={CARD_TEXT_LIGHT}
                    darkColor={CARD_TEXT_DARK}>
                    {t('settings.translation.labels.prompt')}
                  </ThemedText>
                  <TextInput
                    value={formState.geminiTranslationPrompt}
                    onChangeText={(text) =>
                      setFormState((prev) => ({ ...prev, geminiTranslationPrompt: text }))
                    }
                    onBlur={() =>
                      updateSettings({
                        geminiTranslationPrompt: formState.geminiTranslationPrompt.trim(),
                      })
                    }
                    style={multilineInputStyle}
                    placeholder={t('settings.translation.labels.prompt_placeholder')}
                    placeholderTextColor={placeholderTextColor}
                    multiline
                    textAlignVertical="top"
                  />
                  <ThemedText
                    style={styles.promptHint}
                    lightColor={CARD_SUBTLE_LIGHT}
                    darkColor={CARD_SUBTLE_DARK}>
                    {t('settings.translation.labels.prompt_hint')}
                  </ThemedText>
                  <TextInput
                    value={appendedInstruction}
                    editable={false}
                    multiline
                    scrollEnabled={false}
                    style={[
                      settingsStyles.input,
                      styles.readOnlyInput,
                      isDark ? settingsStyles.inputDark : null,
                      isDark ? styles.readOnlyInputDark : null,
                    ]}
                  />
                </View>
              </View>
            </SettingsCard>
          ) : null}
        </ScrollView>
      </KeyboardAvoidingView>

      <Modal
        visible={languageModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setLanguageModalVisible(false)}>
        <Pressable style={styles.modalOverlay} onPress={() => setLanguageModalVisible(false)}>
          <Pressable
            style={[styles.modalSheet, isDark ? styles.modalSheetDark : styles.modalSheetLight]}
            onPress={() => {}}>
            <ThemedText type="subtitle" lightColor={CARD_TEXT_LIGHT} darkColor={CARD_TEXT_DARK}>
              {t('settings.translation.labels.select_language')}
            </ThemedText>
            <ScrollView style={styles.modalList} keyboardShouldPersistTaps="handled">
              {COMMON_TRANSLATION_TARGET_LANGUAGES.map((language) => {
                const active = settings.translationTargetLanguage === language.code;
                return (
                  <Pressable
                    key={language.code}
                    onPress={() => {
                      updateSettings({ translationTargetLanguage: language.code });
                      setLanguageModalVisible(false);
                    }}
                    style={({ pressed }) => [
                      styles.modalItem,
                      pressed && styles.modalItemPressed,
                      active && styles.modalItemActive,
                    ]}>
                    <ThemedText
                      lightColor={CARD_TEXT_LIGHT}
                      darkColor={CARD_TEXT_DARK}
                      style={styles.modalItemLabel}>
                      {t(language.i18nKey)}
                    </ThemedText>
                    {active ? (
                      <ThemedText
                        lightColor={CARD_SUBTLE_LIGHT}
                        darkColor={CARD_SUBTLE_DARK}
                        style={styles.modalItemCheck}>
                        ✓
                      </ThemedText>
                    ) : null}
                  </Pressable>
                );
              })}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
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
  selectPressable: {
    borderRadius: 12,
  },
  selectPressed: {
    opacity: 0.85,
  },
  selectBox: {
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  selectBoxLight: {
    borderColor: 'rgba(148, 163, 184, 0.4)',
    backgroundColor: '#fff',
  },
  selectBoxDark: {
    borderColor: 'rgba(148, 163, 184, 0.35)',
    backgroundColor: '#111c36',
  },
  selectBoxDisabled: {
    opacity: 0.55,
  },
  selectText: {
    fontSize: 15,
  },
  selectChevron: {
    fontSize: 14,
    marginLeft: 12,
  },
  readOnlyInput: {
    opacity: 0.75,
  },
  readOnlyInputDark: {
    opacity: 0.85,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    paddingHorizontal: 20,
    justifyContent: 'center',
  },
  modalSheet: {
    borderRadius: 16,
    padding: 16,
    maxHeight: '70%',
  },
  modalSheetLight: {
    backgroundColor: '#ffffff',
  },
  modalSheetDark: {
    backgroundColor: '#0b1224',
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.25)',
  },
  modalList: {
    marginTop: 12,
  },
  modalItem: {
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  modalItemPressed: {
    opacity: 0.85,
  },
  modalItemActive: {
    backgroundColor: 'rgba(59, 130, 246, 0.12)',
  },
  modalItemLabel: {
    fontSize: 15,
  },
  modalItemCheck: {
    fontSize: 14,
  },
});
