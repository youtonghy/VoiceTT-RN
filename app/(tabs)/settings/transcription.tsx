import { ModelProvider } from '@lobehub/icons-rn';
import { useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Alert,
  KeyboardAvoidingView,
  Linking,
  Platform,
  ScrollView,
  View,
} from 'react-native';
import { Button, Spinner, Text } from 'heroui-native';

import { AppIcon, AppScreen, FormInput, type AppIconName } from '@/components/native/app-shell';
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
import {
  DEFAULT_GEMINI_TRANSCRIPTION_MODEL,
  DEFAULT_GLM_TRANSCRIPTION_MODEL,
  DEFAULT_OPENAI_TRANSCRIPTION_MODEL,
  DEFAULT_QWEN_TRANSCRIPTION_MODEL,
} from '@/services/transcription';
import type { EngineCredentials, TranscriptionEngine } from '@/types/settings';

import { useSettingsForm } from './shared';

type TranscriptionProviderConfig = SettingsModelProviderItem<TranscriptionEngine> & {
  docsUrl?: string;
  helpLabel?: string;
  modelLabel?: string;
  modelValue?: string;
  modelFallback?: string;
  modelKey?: keyof EngineCredentials;
  promptLabel?: string;
  promptValue?: string;
  promptPlaceholder?: string;
  promptHint?: string;
  onPromptChange?: (value: string) => void;
  onPromptBlur?: () => void;
};

const OPENAI_STT_DOCS_URL = 'https://platform.openai.com/docs/guides/speech-to-text';
const GEMINI_STT_DOCS_URL = 'https://ai.google.dev/gemini-api/docs/audio#javascript';

const FALLBACK_ICON_MAP: Record<TranscriptionEngine, AppIconName> = {
  openai: 'robot',
  gemini: 'gem',
  qwen3: 'server',
  soniox: 'wave-square',
  doubao: 'key',
  glm: 'cloud-arrow-up',
};

export default function TranscriptionSettingsScreen() {
  const { t } = useTranslation();
  const { settings, updateSettings, updateCredentials } = useSettings();
  const { formState, setFormState } = useSettingsForm(settings);

  const { catalogs, ensureModelsFetched, refreshModels } = useSettingsModelCatalogs({
    openaiApiKey: formState.openaiApiKey,
    openaiBaseUrl: formState.openaiBaseUrl,
    geminiApiKey: formState.geminiApiKey,
    qwenApiKey: formState.qwenApiKey,
    glmApiKey: formState.glmApiKey,
  });

  const providers = useMemo<TranscriptionProviderConfig[]>(
    () => [
      {
        id: 'openai',
        title: t('settings.transcription.engines.openai'),
        providerIcon: ModelProvider.OpenAI,
        fallbackIcon: FALLBACK_ICON_MAP.openai,
        modelProvider: 'openai',
        remoteModelProvider: 'openai',
        docsUrl: OPENAI_STT_DOCS_URL,
        helpLabel: t('settings.transcription.help_label_openai'),
        modelLabel: t('settings.transcription.labels.openai_model'),
        modelValue: formState.openaiTranscriptionModel,
        modelFallback: DEFAULT_OPENAI_TRANSCRIPTION_MODEL,
        modelKey: 'openaiTranscriptionModel',
        promptLabel: t('settings.transcription.labels.prompt'),
        promptValue: formState.openaiTranscriptionPrompt,
        promptPlaceholder: t('settings.transcription.labels.prompt_placeholder'),
        promptHint: t('settings.transcription.labels.prompt_hint'),
        onPromptChange: (text) =>
          setFormState((prev) => ({ ...prev, openaiTranscriptionPrompt: text })),
        onPromptBlur: () =>
          updateSettings({
            openaiTranscriptionPrompt: formState.openaiTranscriptionPrompt.trim(),
          }),
      },
      {
        id: 'gemini',
        title: t('settings.transcription.engines.gemini'),
        providerIcon: ModelProvider.Gemini,
        fallbackIcon: FALLBACK_ICON_MAP.gemini,
        modelProvider: 'gemini',
        remoteModelProvider: 'gemini',
        docsUrl: GEMINI_STT_DOCS_URL,
        helpLabel: t('settings.transcription.help_label_gemini'),
        modelLabel: t('settings.transcription.labels.gemini_model'),
        modelValue: formState.geminiTranscriptionModel,
        modelFallback: DEFAULT_GEMINI_TRANSCRIPTION_MODEL,
        modelKey: 'geminiTranscriptionModel',
        promptLabel: t('settings.transcription.labels.prompt'),
        promptValue: formState.geminiTranscriptionPrompt,
        promptPlaceholder: t('settings.transcription.labels.prompt_placeholder'),
        promptHint: t('settings.transcription.labels.prompt_hint'),
        onPromptChange: (text) =>
          setFormState((prev) => ({ ...prev, geminiTranscriptionPrompt: text })),
        onPromptBlur: () =>
          updateSettings({
            geminiTranscriptionPrompt: formState.geminiTranscriptionPrompt.trim(),
          }),
      },
      {
        id: 'qwen3',
        title: t('settings.transcription.engines.qwen3'),
        providerIcon: ModelProvider.Qwen,
        fallbackIcon: FALLBACK_ICON_MAP.qwen3,
        modelProvider: 'qwen',
        modelLabel: t('settings.credentials.labels.transcription_model'),
        modelValue: formState.qwenTranscriptionModel,
        modelFallback: DEFAULT_QWEN_TRANSCRIPTION_MODEL,
        modelKey: 'qwenTranscriptionModel',
      },
      {
        id: 'soniox',
        title: t('settings.transcription.engines.soniox'),
        fallbackIcon: FALLBACK_ICON_MAP.soniox,
      },
      {
        id: 'doubao',
        title: t('settings.transcription.engines.doubao'),
        providerIcon: ModelProvider.Doubao,
        fallbackIcon: FALLBACK_ICON_MAP.doubao,
      },
      {
        id: 'glm',
        title: t('settings.transcription.engines.glm'),
        providerIcon: ModelProvider.ZhiPu,
        fallbackIcon: FALLBACK_ICON_MAP.glm,
        modelProvider: 'glm',
        modelLabel: t('settings.credentials.labels.transcription_model'),
        modelValue: formState.glmTranscriptionModel,
        modelFallback: DEFAULT_GLM_TRANSCRIPTION_MODEL,
        modelKey: 'glmTranscriptionModel',
      },
    ],
    [
      formState.geminiTranscriptionModel,
      formState.geminiTranscriptionPrompt,
      formState.glmTranscriptionModel,
      formState.openaiTranscriptionModel,
      formState.openaiTranscriptionPrompt,
      formState.qwenTranscriptionModel,
      setFormState,
      t,
      updateSettings,
    ]
  );

  const activeProvider =
    providers.find((provider) => provider.id === settings.transcriptionEngine) ?? providers[0];
  const activeCatalog = activeProvider.modelProvider
    ? catalogs[activeProvider.modelProvider]
    : undefined;
  const modelOptions =
    activeProvider.modelLabel && activeProvider.modelProvider
      ? getModelSelectOptions(catalogs, activeProvider.modelProvider, [
          activeProvider.modelValue,
          activeProvider.modelFallback,
        ])
      : [];

  useEffect(() => {
    void ensureModelsFetched(activeProvider.remoteModelProvider);
  }, [activeProvider.remoteModelProvider, ensureModelsFetched]);

  const handleOpenDocs = (provider: TranscriptionProviderConfig) => {
    if (!provider.docsUrl) {
      return;
    }
    Linking.openURL(provider.docsUrl).catch((error) => {
      console.warn('[settings] Failed to open link', provider.docsUrl, error);
      Alert.alert(t('settings.transcription.help_error_title'), t('settings.transcription.help_error_body'));
    });
  };

  const handleSelectEngine = (engine: TranscriptionEngine) => {
    updateSettings({ transcriptionEngine: engine });
  };

  const handleSelectModel = (value: string) => {
    if (!activeProvider.modelKey || !activeProvider.modelFallback) {
      return;
    }
    const nextValue = value.trim() || activeProvider.modelFallback;
    setFormState((prev) => ({ ...prev, [activeProvider.modelKey!]: nextValue }));
    updateCredentials({ [activeProvider.modelKey]: nextValue } as Partial<EngineCredentials>);
  };

  const description = activeProvider.modelProvider
    ? activeProvider.remoteModelProvider
      ? t('settings.credentials.models.catalog_hint')
      : t('settings.credentials.models.local_hint')
    : t('settings.credentials.models.credentials_only');

  return (
    <AppScreen scroll={false}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        className="min-h-0 flex-1">
        <ScrollView
          className="min-h-0 flex-1"
          contentContainerClassName="gap-4 pb-6"
          contentInsetAdjustmentBehavior="always"
          keyboardDismissMode="on-drag"
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}>
          <SettingsModelProviderStrip
            providers={providers}
            activeId={settings.transcriptionEngine}
            onSelect={handleSelectEngine}
          />

          <SettingsModelDetailCard
            title={activeProvider.title}
            description={description}
            providerIcon={activeProvider.providerIcon}
            fallbackIcon={activeProvider.fallbackIcon}
            statusText={
              activeProvider.modelProvider ? resolveModelCatalogStatusText(t, activeCatalog) : undefined
            }
            action={
              activeProvider.remoteModelProvider || activeProvider.docsUrl ? (
                <View className="flex-row gap-2">
                  {activeProvider.remoteModelProvider ? (
                    <Button
                      accessibilityLabel={t('settings.credentials.models.refresh')}
                      isDisabled={activeCatalog?.status === 'loading'}
                      isIconOnly
                      onPress={() => refreshModels(activeProvider.remoteModelProvider!)}
                      size="sm"
                      variant="tertiary">
                      {activeCatalog?.status === 'loading' ? (
                        <Spinner size="sm" />
                      ) : (
                        <AppIcon name="cloud-arrow-up" size={15} className="text-foreground" />
                      )}
                    </Button>
                  ) : null}
                  {activeProvider.docsUrl ? (
                    <Button
                      accessibilityLabel={activeProvider.helpLabel}
                      isIconOnly
                      onPress={() => handleOpenDocs(activeProvider)}
                      size="sm"
                      variant="tertiary">
                      <AppIcon name="circle-question" size={15} className="text-foreground" />
                    </Button>
                  ) : null}
                </View>
              ) : null
            }>
            {activeProvider.modelLabel && activeProvider.modelValue && activeProvider.modelFallback ? (
              <SettingsModelSelectField
                label={activeProvider.modelLabel}
                value={activeProvider.modelValue}
                options={modelOptions}
                placeholder={activeProvider.modelFallback}
                onChange={handleSelectModel}
              />
            ) : (
              <Text type="body-sm" color="muted">
                {t('settings.credentials.models.credentials_only')}
              </Text>
            )}

            {activeProvider.promptLabel && activeProvider.promptValue !== undefined ? (
              <FormInput
                label={activeProvider.promptLabel}
                value={activeProvider.promptValue}
                onChangeText={activeProvider.onPromptChange ?? (() => undefined)}
                onBlur={activeProvider.onPromptBlur}
                placeholder={activeProvider.promptPlaceholder}
                description={activeProvider.promptHint}
                multiline
                inputClassName="min-h-32"
              />
            ) : null}
          </SettingsModelDetailCard>
        </ScrollView>
      </KeyboardAvoidingView>
    </AppScreen>
  );
}
