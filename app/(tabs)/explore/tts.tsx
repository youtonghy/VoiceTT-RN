import { useMemo, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
  Pressable,
  Alert,
  Linking,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import Ionicons from '@expo/vector-icons/Ionicons';

import { ThemedText } from '@/components/themed-text';
import { useSettings } from '@/contexts/settings-context';
import { useColorScheme } from '@/hooks/use-color-scheme';
import {
  DEFAULT_GEMINI_TTS_MODEL,
  DEFAULT_GEMINI_TTS_VOICE,
  DEFAULT_OPENAI_TTS_MODEL,
  DEFAULT_OPENAI_TTS_VOICE,
  GEMINI_TTS_VOICES,
  OPENAI_TTS_VOICES,
  type TtsEngine,
} from '@/types/settings';

import {
  CARD_SUBTLE_LIGHT,
  CARD_SUBTLE_DARK,
  CARD_TEXT_LIGHT,
  CARD_TEXT_DARK,
  OptionPill,
  SettingsCard,
  settingsStyles,
  useSettingsForm,
} from './shared';

const OPENAI_TTS_DOCS_URL = 'https://platform.openai.com/docs/guides/text-to-speech#custom-voices';
const GEMINI_TTS_DOCS_URL = 'https://ai.google.dev/gemini-api/docs/speech-generation';
const ttsEngines: TtsEngine[] = ['openai', 'gemini'];

export default function TtsSettingsScreen() {
  const { t } = useTranslation();
  const { settings, updateSettings, updateCredentials } = useSettings();
  const { formState, setFormState } = useSettingsForm(settings);
  const [isOpenAiVoiceMenuOpen, setIsOpenAiVoiceMenuOpen] = useState(false);
  const [isGeminiVoiceMenuOpen, setIsGeminiVoiceMenuOpen] = useState(false);
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
  const helpIconColor = isDark ? '#e2e8f0' : '#0f172a';
  const isGeminiEngine = settings.ttsEngine === 'gemini';
  const helpLabel = isGeminiEngine
    ? t('settings.tts.help_label_gemini')
    : t('settings.tts.help_label_openai');
  const openAiVoiceValue = useMemo(() => {
    const trimmed = formState.ttsVoice.trim();
    return OPENAI_TTS_VOICES.includes(trimmed) ? trimmed : DEFAULT_OPENAI_TTS_VOICE;
  }, [formState.ttsVoice]);
  const geminiVoiceValue = useMemo(() => {
    const trimmed = formState.ttsVoice.trim();
    return GEMINI_TTS_VOICES.includes(trimmed) ? trimmed : DEFAULT_GEMINI_TTS_VOICE;
  }, [formState.ttsVoice]);

  const handleSelectEngine = (engine: TtsEngine) => {
    if (engine === settings.ttsEngine) {
      return;
    }
    const currentVoice = settings.ttsVoice?.trim() || '';
    const isGeminiVoice = GEMINI_TTS_VOICES.includes(currentVoice);
    const isOpenAiVoice = OPENAI_TTS_VOICES.includes(currentVoice);
    if (engine === 'gemini') {
      updateSettings({
        ttsEngine: engine,
        ttsVoice: isGeminiVoice ? currentVoice : DEFAULT_GEMINI_TTS_VOICE,
      });
      setIsOpenAiVoiceMenuOpen(false);
      return;
    }
    updateSettings({
      ttsEngine: engine,
      ttsVoice: isOpenAiVoice ? currentVoice : DEFAULT_OPENAI_TTS_VOICE,
    });
    setIsGeminiVoiceMenuOpen(false);
  };

  const handleOpenDocs = () => {
    const url = isGeminiEngine ? GEMINI_TTS_DOCS_URL : OPENAI_TTS_DOCS_URL;
    Linking.openURL(url).catch((error) => {
      console.warn('[settings] Failed to open link', url, error);
      Alert.alert(t('settings.tts.help_error_title'), t('settings.tts.help_error_body'));
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
              <ThemedText type="subtitle" lightColor={CARD_TEXT_LIGHT} darkColor={CARD_TEXT_DARK}>
                {t('settings.tts.engine.title')}
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
              {ttsEngines.map((engine) => (
                <OptionPill
                  key={engine}
                  label={t(`settings.tts.engine.engines.${engine}`)}
                  active={settings.ttsEngine === engine}
                  onPress={() => handleSelectEngine(engine)}
                />
              ))}
            </View>
          </SettingsCard>

          {settings.ttsEngine === 'openai' ? (
            <SettingsCard variant="openai">
              <ThemedText type="subtitle" lightColor={CARD_TEXT_LIGHT} darkColor={CARD_TEXT_DARK}>
                {t('settings.tts.engine.engines.openai')}
              </ThemedText>
              <View style={styles.fieldStack}>
                <View style={styles.fieldGroup}>
                  <ThemedText
                    style={[groupLabelStyle, styles.cardLabel]}
                    lightColor={CARD_SUBTLE_LIGHT}
                    darkColor={CARD_SUBTLE_DARK}>
                    {t('settings.tts.openai.model_label')}
                  </ThemedText>
                  <TextInput
                    value={formState.openaiTtsModel}
                    onChangeText={(text) =>
                      setFormState((prev) => ({ ...prev, openaiTtsModel: text }))
                    }
                    onBlur={() =>
                      updateCredentials({
                        openaiTtsModel:
                          formState.openaiTtsModel.trim() || DEFAULT_OPENAI_TTS_MODEL,
                      })
                    }
                    autoCapitalize="none"
                    autoCorrect={false}
                    style={baseInputStyle}
                    placeholder={DEFAULT_OPENAI_TTS_MODEL}
                    placeholderTextColor={placeholderTextColor}
                  />
                </View>

                <View style={styles.fieldGroup}>
                  <ThemedText
                    style={[groupLabelStyle, styles.cardLabel]}
                    lightColor={CARD_SUBTLE_LIGHT}
                    darkColor={CARD_SUBTLE_DARK}>
                    {t('settings.tts.openai.voice_label')}
                  </ThemedText>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={t('settings.tts.openai.voice_label')}
                    onPress={() => setIsOpenAiVoiceMenuOpen((prev) => !prev)}
                    style={({ pressed }) => [
                      baseInputStyle,
                      styles.voiceSelect,
                      pressed && styles.voiceSelectPressed,
                    ]}>
                    <ThemedText lightColor={CARD_TEXT_LIGHT} darkColor={CARD_TEXT_DARK}>
                      {openAiVoiceValue || DEFAULT_OPENAI_TTS_VOICE}
                    </ThemedText>
                    <Ionicons
                      name={isOpenAiVoiceMenuOpen ? 'chevron-up' : 'chevron-down'}
                      size={18}
                      color={helpIconColor}
                    />
                  </Pressable>
                  {isOpenAiVoiceMenuOpen ? (
                    <View
                      style={[
                        styles.voiceMenu,
                        isDark ? styles.voiceMenuDark : null,
                      ]}>
                      <ScrollView
                        nestedScrollEnabled
                        style={styles.voiceMenuScroll}
                        contentContainerStyle={styles.voiceMenuContent}>
                        {OPENAI_TTS_VOICES.map((voice) => {
                          const isActive = voice === openAiVoiceValue;
                          return (
                            <Pressable
                              key={voice}
                              onPress={() => {
                                updateSettings({ ttsVoice: voice });
                                setIsOpenAiVoiceMenuOpen(false);
                              }}
                              style={({ pressed }) => [
                                styles.voiceMenuItem,
                                isActive && styles.voiceMenuItemActive,
                                pressed && styles.voiceMenuItemPressed,
                              ]}>
                              <ThemedText
                                lightColor={isActive ? '#ffffff' : CARD_TEXT_LIGHT}
                                darkColor={isActive ? '#ffffff' : CARD_TEXT_DARK}>
                                {voice}
                              </ThemedText>
                            </Pressable>
                          );
                        })}
                      </ScrollView>
                    </View>
                  ) : null}
                </View>

                <View style={styles.fieldGroup}>
                  <ThemedText
                    style={[groupLabelStyle, styles.cardLabel]}
                    lightColor={CARD_TEXT_LIGHT}
                    darkColor={CARD_TEXT_DARK}>
                    {t('settings.tts.openai.prompt_label')}
                  </ThemedText>
                  <TextInput
                    value={formState.ttsPrompt}
                    onChangeText={(text) => setFormState((prev) => ({ ...prev, ttsPrompt: text }))}
                    onBlur={() =>
                      updateSettings({
                        ttsPrompt: formState.ttsPrompt.trim(),
                      })
                    }
                    style={multilineInputStyle}
                    placeholder={t('settings.tts.openai.prompt_placeholder')}
                    placeholderTextColor={placeholderTextColor}
                    multiline
                    textAlignVertical="top"
                  />
                  <ThemedText
                    style={styles.promptHint}
                    lightColor={CARD_SUBTLE_LIGHT}
                    darkColor={CARD_SUBTLE_DARK}>
                    {t('settings.tts.openai.prompt_hint')}
                  </ThemedText>
                </View>
              </View>
            </SettingsCard>
          ) : null}

          {settings.ttsEngine === 'gemini' ? (
            <SettingsCard variant="gemini">
              <ThemedText type="subtitle" lightColor={CARD_TEXT_LIGHT} darkColor={CARD_TEXT_DARK}>
                {t('settings.tts.engine.engines.gemini')}
              </ThemedText>
              <View style={styles.fieldStack}>
                <View style={styles.fieldGroup}>
                  <ThemedText
                    style={[groupLabelStyle, styles.cardLabel]}
                    lightColor={CARD_SUBTLE_LIGHT}
                    darkColor={CARD_SUBTLE_DARK}>
                    {t('settings.tts.gemini.model_label')}
                  </ThemedText>
                  <TextInput
                    value={formState.geminiTtsModel}
                    onChangeText={(text) => setFormState((prev) => ({ ...prev, geminiTtsModel: text }))}
                    onBlur={() =>
                      updateCredentials({
                        geminiTtsModel: formState.geminiTtsModel.trim() || DEFAULT_GEMINI_TTS_MODEL,
                      })
                    }
                    autoCapitalize="none"
                    autoCorrect={false}
                    style={baseInputStyle}
                    placeholder={DEFAULT_GEMINI_TTS_MODEL}
                    placeholderTextColor={placeholderTextColor}
                  />
                </View>

                <View style={styles.fieldGroup}>
                  <ThemedText
                    style={[groupLabelStyle, styles.cardLabel]}
                    lightColor={CARD_SUBTLE_LIGHT}
                    darkColor={CARD_SUBTLE_DARK}>
                    {t('settings.tts.gemini.voice_label')}
                  </ThemedText>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={t('settings.tts.gemini.voice_label')}
                    onPress={() => setIsGeminiVoiceMenuOpen((prev) => !prev)}
                    style={({ pressed }) => [
                      baseInputStyle,
                      styles.voiceSelect,
                      pressed && styles.voiceSelectPressed,
                    ]}>
                    <ThemedText lightColor={CARD_TEXT_LIGHT} darkColor={CARD_TEXT_DARK}>
                      {geminiVoiceValue || DEFAULT_GEMINI_TTS_VOICE}
                    </ThemedText>
                    <Ionicons
                      name={isGeminiVoiceMenuOpen ? 'chevron-up' : 'chevron-down'}
                      size={18}
                      color={helpIconColor}
                    />
                  </Pressable>
                  {isGeminiVoiceMenuOpen ? (
                    <View
                      style={[
                        styles.voiceMenu,
                        isDark ? styles.voiceMenuDark : null,
                      ]}>
                      <ScrollView
                        nestedScrollEnabled
                        style={styles.voiceMenuScroll}
                        contentContainerStyle={styles.voiceMenuContent}>
                        {GEMINI_TTS_VOICES.map((voice) => {
                          const isActive = voice === geminiVoiceValue;
                          return (
                            <Pressable
                              key={voice}
                              onPress={() => {
                                updateSettings({ ttsVoice: voice });
                                setIsGeminiVoiceMenuOpen(false);
                              }}
                              style={({ pressed }) => [
                                styles.voiceMenuItem,
                                isActive && styles.voiceMenuItemActive,
                                pressed && styles.voiceMenuItemPressed,
                              ]}>
                              <ThemedText
                                lightColor={isActive ? '#ffffff' : CARD_TEXT_LIGHT}
                                darkColor={isActive ? '#ffffff' : CARD_TEXT_DARK}>
                                {voice}
                              </ThemedText>
                            </Pressable>
                          );
                        })}
                      </ScrollView>
                    </View>
                  ) : null}
                </View>

                <View style={styles.fieldGroup}>
                  <ThemedText
                    style={[groupLabelStyle, styles.cardLabel]}
                    lightColor={CARD_TEXT_LIGHT}
                    darkColor={CARD_TEXT_DARK}>
                    {t('settings.tts.gemini.prompt_label')}
                  </ThemedText>
                  <TextInput
                    value={formState.ttsPrompt}
                    onChangeText={(text) => setFormState((prev) => ({ ...prev, ttsPrompt: text }))}
                    onBlur={() =>
                      updateSettings({
                        ttsPrompt: formState.ttsPrompt.trim(),
                      })
                    }
                    style={multilineInputStyle}
                    placeholder={t('settings.tts.gemini.prompt_placeholder')}
                    placeholderTextColor={placeholderTextColor}
                    multiline
                    textAlignVertical="top"
                  />
                  <ThemedText
                    style={styles.promptHint}
                    lightColor={CARD_SUBTLE_LIGHT}
                    darkColor={CARD_SUBTLE_DARK}>
                    {t('settings.tts.gemini.prompt_hint')}
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
  voiceSelect: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  voiceSelectPressed: {
    opacity: 0.9,
  },
  voiceMenu: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.4)',
    backgroundColor: '#ffffff',
    maxHeight: 220,
    overflow: 'hidden',
  },
  voiceMenuDark: {
    borderColor: 'rgba(148, 163, 184, 0.35)',
    backgroundColor: 'rgba(15, 23, 42, 0.92)',
  },
  voiceMenuScroll: {
    maxHeight: 220,
  },
  voiceMenuContent: {
    paddingVertical: 6,
  },
  voiceMenuItem: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    marginHorizontal: 6,
  },
  voiceMenuItemActive: {
    backgroundColor: '#2563eb',
  },
  voiceMenuItemPressed: {
    opacity: 0.85,
  },
});
