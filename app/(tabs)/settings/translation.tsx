import { ModelProvider } from '@lobehub/icons-rn';
import { useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  View,
} from 'react-native';
import { Button, Spinner, Text } from 'heroui-native';

import {
  AppCard,
  AppIcon,
  AppScreen,
  FormInput,
  SettingSwitch,
  type AppIconName,
} from '@/components/native/app-shell';
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
  DEFAULT_GEMINI_TRANSLATION_MODEL,
  DEFAULT_OPENAI_TRANSLATION_MODEL,
} from '@/services/transcription';
import {
  COMMON_TRANSLATION_TARGET_LANGUAGES,
  DEFAULT_OPENAI_TRANSLATION_TEMPERATURE,
  type EngineCredentials,
  type TranslationEngine,
} from '@/types/settings';

import {
  formatNumberInput,
  useSettingsForm,
} from '@/components/settings/settings-form';

type TranslationProviderConfig = SettingsModelProviderItem<TranslationEngine> & {
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

const FALLBACK_ICON_MAP: Record<TranslationEngine, AppIconName> = {
  openai: 'robot',
  gemini: 'gem',
  none: 'circle-half-stroke',
};

export default function TranslationSettingsScreen() {
  const { t } = useTranslation();
  const { settings, updateSettings, updateCredentials } = useSettings();
  const { formState, setFormState } = useSettingsForm(settings);
  const selectedTargetLanguageLabel = t(`settings.translation.languages.${settings.translationTargetLanguage}`, {
    defaultValue: settings.translationTargetLanguage,
  });
  const appendedInstruction = t('settings.translation.labels.appended_instruction', {
    language: selectedTargetLanguageLabel,
  });

  const { catalogs, ensureModelsFetched, refreshModels } = useSettingsModelCatalogs({
    openaiApiKey: formState.openaiApiKey,
    openaiBaseUrl: formState.openaiBaseUrl,
    geminiApiKey: formState.geminiApiKey,
    qwenApiKey: formState.qwenApiKey,
    glmApiKey: formState.glmApiKey,
  });

  const providers = useMemo<TranslationProviderConfig[]>(
    () => [
      {
        id: 'openai',
        title: t('settings.translation.engines.openai'),
        providerIcon: ModelProvider.OpenAI,
        fallbackIcon: FALLBACK_ICON_MAP.openai,
        modelProvider: 'openai',
        remoteModelProvider: 'openai',
        isDisabled: !settings.enableTranslation,
        modelLabel: t('settings.translation.labels.openai_model'),
        modelValue: formState.openaiTranslationModel,
        modelFallback: DEFAULT_OPENAI_TRANSLATION_MODEL,
        modelKey: 'openaiTranslationModel',
        promptLabel: t('settings.translation.labels.prompt'),
        promptValue: formState.openaiTranslationPrompt,
        promptPlaceholder: t('settings.translation.labels.prompt_placeholder'),
        promptHint: t('settings.translation.labels.prompt_hint'),
        onPromptChange: (text) =>
          setFormState((prev) => ({ ...prev, openaiTranslationPrompt: text })),
        onPromptBlur: () =>
          updateSettings({
            openaiTranslationPrompt: formState.openaiTranslationPrompt.trim(),
          }),
      },
      {
        id: 'gemini',
        title: t('settings.translation.engines.gemini'),
        providerIcon: ModelProvider.Gemini,
        fallbackIcon: FALLBACK_ICON_MAP.gemini,
        modelProvider: 'gemini',
        remoteModelProvider: 'gemini',
        isDisabled: !settings.enableTranslation,
        modelLabel: t('settings.translation.labels.gemini_model'),
        modelValue: formState.geminiTranslationModel,
        modelFallback: DEFAULT_GEMINI_TRANSLATION_MODEL,
        modelKey: 'geminiTranslationModel',
        promptLabel: t('settings.translation.labels.prompt'),
        promptValue: formState.geminiTranslationPrompt,
        promptPlaceholder: t('settings.translation.labels.prompt_placeholder'),
        promptHint: t('settings.translation.labels.prompt_hint'),
        onPromptChange: (text) =>
          setFormState((prev) => ({ ...prev, geminiTranslationPrompt: text })),
        onPromptBlur: () =>
          updateSettings({
            geminiTranslationPrompt: formState.geminiTranslationPrompt.trim(),
          }),
      },
      {
        id: 'none',
        title: t('settings.translation.engines.none'),
        fallbackIcon: FALLBACK_ICON_MAP.none,
        isDisabled: !settings.enableTranslation,
      },
    ],
    [
      formState.geminiTranslationModel,
      formState.geminiTranslationPrompt,
      formState.openaiTranslationModel,
      formState.openaiTranslationPrompt,
      setFormState,
      settings.enableTranslation,
      t,
      updateSettings,
    ]
  );

  const activeProvider =
    providers.find((provider) => provider.id === settings.translationEngine) ?? providers[0];
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
  const isModelDisabled = !settings.enableTranslation || settings.translationEngine === 'none';

  useEffect(() => {
    if (!settings.enableTranslation) {
      return;
    }
    void ensureModelsFetched(activeProvider.remoteModelProvider);
  }, [activeProvider.remoteModelProvider, ensureModelsFetched, settings.enableTranslation]);

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

  const handleSelectEngine = (engine: TranslationEngine) => {
    updateSettings({ translationEngine: engine });
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
    <AppScreen contentBottomInset={0} contentTopInset={0} edges={['left', 'right']} scroll={false}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        className="min-h-0 flex-1">
        <ScrollView
          className="min-h-0 flex-1"
          contentContainerClassName="gap-4 pb-6"
          contentInsetAdjustmentBehavior="never"
          keyboardDismissMode="on-drag"
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}>
          <AppCard icon="language" title={t('settings.translation.labels.target_language')}>
            <SettingSwitch
              title={t('settings.translation.labels.enable_translation')}
              subtitle={selectedTargetLanguageLabel}
              value={settings.enableTranslation}
              onChange={(next) => updateSettings({ enableTranslation: next })}
            />

            <SettingsModelSelectField
              label={t('settings.translation.labels.target_language')}
              value={settings.translationTargetLanguage}
              options={COMMON_TRANSLATION_TARGET_LANGUAGES.map((language) => ({
                label: t(language.i18nKey),
                value: language.code,
              }))}
              placeholder={selectedTargetLanguageLabel}
              onChange={(value) => updateSettings({ translationTargetLanguage: value })}
              disabled={!settings.enableTranslation || settings.translationEngine === 'none'}
            />
          </AppCard>

          <SettingsModelProviderStrip
            providers={providers}
            activeId={settings.translationEngine}
            onSelect={handleSelectEngine}
            disabled={!settings.enableTranslation}
          />

          <SettingsModelDetailCard
            title={activeProvider.title}
            description={description}
            providerIcon={activeProvider.providerIcon}
            fallbackIcon={activeProvider.fallbackIcon}
            statusText={
              activeProvider.modelProvider ? resolveModelCatalogStatusText(t, activeCatalog) : undefined
            }
            disabled={isModelDisabled}
            action={
              activeProvider.remoteModelProvider ? (
                <Button
                  accessibilityLabel={t('settings.credentials.models.refresh')}
                  isDisabled={isModelDisabled || activeCatalog?.status === 'loading'}
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
              ) : null
            }>
            {activeProvider.modelLabel && activeProvider.modelValue && activeProvider.modelFallback ? (
              <SettingsModelSelectField
                label={activeProvider.modelLabel}
                value={activeProvider.modelValue}
                options={modelOptions}
                placeholder={activeProvider.modelFallback}
                onChange={handleSelectModel}
                disabled={isModelDisabled}
              />
            ) : (
              <Text type="body-sm" color="muted">
                {settings.enableTranslation
                  ? t('settings.credentials.models.credentials_only')
                  : t('settings.translation.engines.none')}
              </Text>
            )}

            {settings.translationEngine === 'openai' ? (
              <FormInput
                label={t('settings.translation.labels.temperature')}
                value={formState.openaiTranslationTemperature}
                onChangeText={(text) =>
                  setFormState((prev) => ({
                    ...prev,
                    openaiTranslationTemperature: formatNumberInput(text),
                  }))
                }
                onBlur={() =>
                  updateSettings({
                    openaiTranslationTemperature: resolveTemperature(
                      formState.openaiTranslationTemperature,
                      DEFAULT_OPENAI_TRANSLATION_TEMPERATURE
                    ),
                  })
                }
                editable={!isModelDisabled}
                keyboardType="decimal-pad"
                placeholder={`${DEFAULT_OPENAI_TRANSLATION_TEMPERATURE}`}
                isDisabled={isModelDisabled}
              />
            ) : null}

            {activeProvider.promptLabel && activeProvider.promptValue !== undefined ? (
              <View className="gap-4">
                <FormInput
                  label={activeProvider.promptLabel}
                  value={activeProvider.promptValue}
                  onChangeText={activeProvider.onPromptChange ?? (() => undefined)}
                  onBlur={activeProvider.onPromptBlur}
                  editable={!isModelDisabled}
                  placeholder={activeProvider.promptPlaceholder}
                  description={activeProvider.promptHint}
                  multiline
                  inputClassName="min-h-32"
                  isDisabled={isModelDisabled}
                />
                <FormInput
                  label={t('settings.translation.labels.appended_instruction_label')}
                  value={appendedInstruction}
                  onChangeText={() => undefined}
                  editable={false}
                  multiline
                  scrollEnabled={false}
                  inputClassName="min-h-20 opacity-75"
                />
              </View>
            ) : null}
          </SettingsModelDetailCard>
        </ScrollView>
      </KeyboardAvoidingView>
    </AppScreen>
  );
}
