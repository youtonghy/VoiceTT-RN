import { ModelProvider } from '@lobehub/icons-rn';
import { useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { Button, Spinner } from 'heroui-native';

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
  DEFAULT_GEMINI_QA_MODEL,
  DEFAULT_OPENAI_QA_MODEL,
  DEFAULT_OPENAI_QA_TEMPERATURE,
  DEFAULT_QA_PROMPT,
  type EngineCredentials,
  type QaEngine,
} from '@/types/settings';

import {
  formatNumberInput,
  useSettingsForm,
} from '@/components/settings/settings-form';

type QaProviderConfig = SettingsModelProviderItem<QaEngine> & {
  modelLabel: string;
  modelValue: string;
  modelFallback: string;
  modelKey: keyof EngineCredentials;
};

const FALLBACK_ICON_MAP: Record<QaEngine, AppIconName> = {
  openai: 'robot',
  gemini: 'gem',
};

export default function QaSettingsScreen() {
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

  const providers = useMemo<QaProviderConfig[]>(
    () => [
      {
        id: 'openai',
        title: t('settings.qa.engine.engines.openai'),
        providerIcon: ModelProvider.OpenAI,
        fallbackIcon: FALLBACK_ICON_MAP.openai,
        modelProvider: 'openai',
        remoteModelProvider: 'openai',
        modelLabel: t('settings.qa.openai_label'),
        modelValue: formState.openaiQaModel,
        modelFallback: DEFAULT_OPENAI_QA_MODEL,
        modelKey: 'openaiQaModel',
      },
      {
        id: 'gemini',
        title: t('settings.qa.engine.engines.gemini'),
        providerIcon: ModelProvider.Gemini,
        fallbackIcon: FALLBACK_ICON_MAP.gemini,
        modelProvider: 'gemini',
        remoteModelProvider: 'gemini',
        modelLabel: t('settings.qa.gemini_label'),
        modelValue: formState.geminiQaModel,
        modelFallback: DEFAULT_GEMINI_QA_MODEL,
        modelKey: 'geminiQaModel',
      },
    ],
    [formState.geminiQaModel, formState.openaiQaModel, t]
  );

  const activeProvider =
    providers.find((provider) => provider.id === settings.qaEngine) ?? providers[0];
  const activeCatalog = catalogs[activeProvider.modelProvider!];
  const modelOptions = getModelSelectOptions(catalogs, activeProvider.modelProvider, [
    activeProvider.modelValue,
    activeProvider.modelFallback,
  ]);

  useEffect(() => {
    void ensureModelsFetched(activeProvider.remoteModelProvider);
  }, [activeProvider.remoteModelProvider, ensureModelsFetched]);

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

  const handleSelectModel = (value: string) => {
    const nextValue = value.trim() || activeProvider.modelFallback;
    setFormState((prev) => ({ ...prev, [activeProvider.modelKey]: nextValue }));
    updateCredentials({ [activeProvider.modelKey]: nextValue } as Partial<EngineCredentials>);
  };

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
          <SettingsModelProviderStrip
            providers={providers}
            activeId={settings.qaEngine}
            onSelect={(engine) => updateSettings({ qaEngine: engine })}
          />

          <SettingsModelDetailCard
            title={activeProvider.title}
            description={t('settings.credentials.models.catalog_hint')}
            providerIcon={activeProvider.providerIcon}
            fallbackIcon={activeProvider.fallbackIcon}
            statusText={resolveModelCatalogStatusText(t, activeCatalog)}
            action={
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
            }>
            <SettingsModelSelectField
              label={activeProvider.modelLabel}
              value={activeProvider.modelValue}
              options={modelOptions}
              placeholder={activeProvider.modelFallback}
              onChange={handleSelectModel}
            />

            {settings.qaEngine === 'openai' ? (
              <FormInput
                label={t('settings.qa.temperature_label')}
                value={formState.openaiQaTemperature}
                onChangeText={(text) =>
                  setFormState((prev) => ({
                    ...prev,
                    openaiQaTemperature: formatNumberInput(text),
                  }))
                }
                onBlur={() =>
                  updateSettings({
                    openaiQaTemperature: resolveTemperature(
                      formState.openaiQaTemperature,
                      DEFAULT_OPENAI_QA_TEMPERATURE
                    ),
                  })
                }
                keyboardType="decimal-pad"
                placeholder={`${DEFAULT_OPENAI_QA_TEMPERATURE}`}
              />
            ) : null}

            <FormInput
              label={t('settings.qa.prompt_label')}
              value={formState.qaPrompt}
              onChangeText={(text) => setFormState((prev) => ({ ...prev, qaPrompt: text }))}
              onBlur={() =>
                updateSettings({
                  qaPrompt: formState.qaPrompt.trim() || DEFAULT_QA_PROMPT,
                })
              }
              placeholder={DEFAULT_QA_PROMPT}
              multiline
              inputClassName="min-h-36"
            />
          </SettingsModelDetailCard>
        </ScrollView>
      </KeyboardAvoidingView>
    </AppScreen>
  );
}
