import { ModelProvider } from '@lobehub/icons-rn';
import { useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Alert,
  KeyboardAvoidingView,
  Linking,
  Platform,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button, Spinner, Text } from 'heroui-native';

import { AppIcon, type AppIconName } from '@/components/native/app-shell';
import {
  getModelSelectOptions,
  resolveModelCatalogStatusText,
  SettingsModelDetailCard,
  SettingsModelProviderStrip,
  SettingsModelSelectField,
  useSettingsModelCatalogs,
  type SettingsModelProviderItem,
} from '@/components/settings/model-picker';
import { useSettings } from '@/contexts/settings-context';
import { useColorScheme } from '@/hooks/use-color-scheme';
import {
  DEFAULT_GEMINI_TTS_MODEL,
  DEFAULT_GEMINI_TTS_VOICE,
  DEFAULT_OPENAI_TTS_MODEL,
  DEFAULT_OPENAI_TTS_VOICE,
  GEMINI_TTS_VOICES,
  OPENAI_TTS_VOICES,
  isGeminiTtsVoice,
  isOpenAiTtsVoice,
  type EngineCredentials,
  type TtsEngine,
} from '@/types/settings';

import {
  settingsStyles,
  useSettingsForm,
} from './shared';

type TtsProviderConfig = SettingsModelProviderItem<TtsEngine> & {
  docsUrl: string;
  helpLabel: string;
  modelLabel: string;
  modelValue: string;
  modelFallback: string;
  modelKey: keyof EngineCredentials;
  voiceLabel: string;
  voiceValue: string;
  voiceFallback: string;
  voiceOptions: { label: string; value: string }[];
  promptLabel: string;
  promptPlaceholder: string;
  promptHint: string;
};

const OPENAI_TTS_DOCS_URL = 'https://platform.openai.com/docs/guides/text-to-speech#custom-voices';
const GEMINI_TTS_DOCS_URL = 'https://ai.google.dev/gemini-api/docs/speech-generation';

const FALLBACK_ICON_MAP: Record<TtsEngine, AppIconName> = {
  openai: 'robot',
  gemini: 'gem',
};

export default function TtsSettingsScreen() {
  const { t } = useTranslation();
  const { settings, updateSettings, updateCredentials } = useSettings();
  const { formState, setFormState } = useSettingsForm(settings);
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const insets = useSafeAreaInsets();
  const safeAreaStyle = [
    settingsStyles.safeArea,
    isDark ? settingsStyles.safeAreaDark : settingsStyles.safeAreaLight,
  ];
  const multilineInputStyle = [
    settingsStyles.input,
    styles.promptInput,
    isDark ? settingsStyles.inputDark : null,
    isDark ? styles.promptInputDark : null,
  ];
  const placeholderTextColor = isDark ? '#94a3b8' : '#64748b';

  const { catalogs, ensureModelsFetched, refreshModels } = useSettingsModelCatalogs({
    openaiApiKey: formState.openaiApiKey,
    openaiBaseUrl: formState.openaiBaseUrl,
    geminiApiKey: formState.geminiApiKey,
    qwenApiKey: formState.qwenApiKey,
    glmApiKey: formState.glmApiKey,
  });

  const openAiVoiceValue = useMemo(() => {
    const trimmed = formState.ttsVoice.trim();
    return isOpenAiTtsVoice(trimmed) ? trimmed : DEFAULT_OPENAI_TTS_VOICE;
  }, [formState.ttsVoice]);
  const geminiVoiceValue = useMemo(() => {
    const trimmed = formState.ttsVoice.trim();
    return isGeminiTtsVoice(trimmed) ? trimmed : DEFAULT_GEMINI_TTS_VOICE;
  }, [formState.ttsVoice]);

  const providers = useMemo<TtsProviderConfig[]>(
    () => [
      {
        id: 'openai',
        title: t('settings.tts.engine.engines.openai'),
        providerIcon: ModelProvider.OpenAI,
        fallbackIcon: FALLBACK_ICON_MAP.openai,
        modelProvider: 'openai',
        remoteModelProvider: 'openai',
        docsUrl: OPENAI_TTS_DOCS_URL,
        helpLabel: t('settings.tts.help_label_openai'),
        modelLabel: t('settings.tts.openai.model_label'),
        modelValue: formState.openaiTtsModel,
        modelFallback: DEFAULT_OPENAI_TTS_MODEL,
        modelKey: 'openaiTtsModel',
        voiceLabel: t('settings.tts.openai.voice_label'),
        voiceValue: openAiVoiceValue,
        voiceFallback: DEFAULT_OPENAI_TTS_VOICE,
        voiceOptions: OPENAI_TTS_VOICES.map((voice) => ({ label: voice, value: voice })),
        promptLabel: t('settings.tts.openai.prompt_label'),
        promptPlaceholder: t('settings.tts.openai.prompt_placeholder'),
        promptHint: t('settings.tts.openai.prompt_hint'),
      },
      {
        id: 'gemini',
        title: t('settings.tts.engine.engines.gemini'),
        providerIcon: ModelProvider.Gemini,
        fallbackIcon: FALLBACK_ICON_MAP.gemini,
        modelProvider: 'gemini',
        remoteModelProvider: 'gemini',
        docsUrl: GEMINI_TTS_DOCS_URL,
        helpLabel: t('settings.tts.help_label_gemini'),
        modelLabel: t('settings.tts.gemini.model_label'),
        modelValue: formState.geminiTtsModel,
        modelFallback: DEFAULT_GEMINI_TTS_MODEL,
        modelKey: 'geminiTtsModel',
        voiceLabel: t('settings.tts.gemini.voice_label'),
        voiceValue: geminiVoiceValue,
        voiceFallback: DEFAULT_GEMINI_TTS_VOICE,
        voiceOptions: GEMINI_TTS_VOICES.map((voice) => ({ label: voice, value: voice })),
        promptLabel: t('settings.tts.gemini.prompt_label'),
        promptPlaceholder: t('settings.tts.gemini.prompt_placeholder'),
        promptHint: t('settings.tts.gemini.prompt_hint'),
      },
    ],
    [
      formState.geminiTtsModel,
      formState.openaiTtsModel,
      geminiVoiceValue,
      openAiVoiceValue,
      t,
    ]
  );

  const activeProvider =
    providers.find((provider) => provider.id === settings.ttsEngine) ?? providers[0];
  const activeCatalog = catalogs[activeProvider.modelProvider!];
  const modelOptions = getModelSelectOptions(catalogs, activeProvider.modelProvider, [
    activeProvider.modelValue,
    activeProvider.modelFallback,
  ]);

  useEffect(() => {
    void ensureModelsFetched(activeProvider.remoteModelProvider);
  }, [activeProvider.remoteModelProvider, ensureModelsFetched]);

  const handleSelectEngine = (engine: TtsEngine) => {
    if (engine === settings.ttsEngine) {
      return;
    }
    const currentVoice = settings.ttsVoice?.trim() || '';
    const isGeminiVoice = isGeminiTtsVoice(currentVoice);
    const isOpenAiVoice = isOpenAiTtsVoice(currentVoice);
    const nextVoice =
      engine === 'gemini'
        ? isGeminiVoice ? currentVoice : DEFAULT_GEMINI_TTS_VOICE
        : isOpenAiVoice ? currentVoice : DEFAULT_OPENAI_TTS_VOICE;
    setFormState((prev) => ({ ...prev, ttsVoice: nextVoice }));
    updateSettings({ ttsEngine: engine, ttsVoice: nextVoice });
  };

  const handleSelectModel = (value: string) => {
    const nextValue = value.trim() || activeProvider.modelFallback;
    setFormState((prev) => ({ ...prev, [activeProvider.modelKey]: nextValue }));
    updateCredentials({ [activeProvider.modelKey]: nextValue } as Partial<EngineCredentials>);
  };

  const handleSelectVoice = (value: string) => {
    const nextValue = value.trim() || activeProvider.voiceFallback;
    setFormState((prev) => ({ ...prev, ttsVoice: nextValue }));
    updateSettings({ ttsVoice: nextValue });
  };

  const handleOpenDocs = () => {
    Linking.openURL(activeProvider.docsUrl).catch((error) => {
      console.warn('[settings] Failed to open link', activeProvider.docsUrl, error);
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
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}>
          <SettingsModelProviderStrip
            providers={providers}
            activeId={settings.ttsEngine}
            onSelect={handleSelectEngine}
          />

          <SettingsModelDetailCard
            title={activeProvider.title}
            description={t('settings.credentials.models.catalog_hint')}
            providerIcon={activeProvider.providerIcon}
            fallbackIcon={activeProvider.fallbackIcon}
            statusText={resolveModelCatalogStatusText(t, activeCatalog)}
            action={
              <View className="flex-row gap-2">
                <Button
                  accessibilityLabel={t('settings.credentials.models.refresh')}
                  isDisabled={activeCatalog.status === 'loading'}
                  isIconOnly
                  onPress={() => refreshModels(activeProvider.remoteModelProvider!)}
                  size="sm"
                  variant="tertiary">
                  {activeCatalog.status === 'loading' ? (
                    <Spinner size="sm" />
                  ) : (
                    <AppIcon name="cloud-arrow-up" size={15} className="text-foreground" />
                  )}
                </Button>
                <Button
                  accessibilityLabel={activeProvider.helpLabel}
                  isIconOnly
                  onPress={handleOpenDocs}
                  size="sm"
                  variant="tertiary">
                  <AppIcon name="circle-question" size={15} className="text-foreground" />
                </Button>
              </View>
            }>
            <SettingsModelSelectField
              label={activeProvider.modelLabel}
              value={activeProvider.modelValue}
              options={modelOptions}
              placeholder={activeProvider.modelFallback}
              onChange={handleSelectModel}
            />

            <SettingsModelSelectField
              label={activeProvider.voiceLabel}
              value={activeProvider.voiceValue}
              options={activeProvider.voiceOptions}
              placeholder={activeProvider.voiceFallback}
              onChange={handleSelectVoice}
            />

            <View style={styles.fieldGroup}>
              <Text type="body-sm" weight="semibold">
                {activeProvider.promptLabel}
              </Text>
              <TextInput
                value={formState.ttsPrompt}
                onChangeText={(text) => setFormState((prev) => ({ ...prev, ttsPrompt: text }))}
                onBlur={() =>
                  updateSettings({
                    ttsPrompt: formState.ttsPrompt.trim(),
                  })
                }
                style={multilineInputStyle}
                placeholder={activeProvider.promptPlaceholder}
                placeholderTextColor={placeholderTextColor}
                multiline
                textAlignVertical="top"
              />
              <Text type="body-xs" color="muted">
                {activeProvider.promptHint}
              </Text>
            </View>
          </SettingsModelDetailCard>
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
    paddingTop: 12,
    paddingBottom: 12,
  },
  promptInputDark: {
    color: '#e2e8f0',
  },
});
