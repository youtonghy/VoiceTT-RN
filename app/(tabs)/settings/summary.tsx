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
  DEFAULT_ASSISTANT_PROMPT,
  DEFAULT_CONVERSATION_SUMMARY_PROMPT,
  DEFAULT_GEMINI_ASSISTANT_MODEL,
  DEFAULT_GEMINI_CONVERSATION_MODEL,
  DEFAULT_GEMINI_TITLE_MODEL,
  DEFAULT_OPENAI_ASSISTANT_MODEL,
  DEFAULT_OPENAI_ASSISTANT_TEMPERATURE,
  DEFAULT_OPENAI_CONVERSATION_MODEL,
  DEFAULT_OPENAI_CONVERSATION_TEMPERATURE,
  DEFAULT_OPENAI_TITLE_MODEL,
  DEFAULT_OPENAI_TITLE_TEMPERATURE,
  DEFAULT_TITLE_SUMMARY_PROMPT,
  type EngineCredentials,
} from '@/types/settings';

import {
  formatNumberInput,
  useSettingsForm,
} from '@/components/settings/settings-form';

type SummaryModelEngine = 'openai' | 'gemini';
type ModelCatalogControls = ReturnType<typeof useSettingsModelCatalogs>;

type SummaryProviderConfig = SettingsModelProviderItem<SummaryModelEngine> & {
  modelLabel: string;
  modelValue: string;
  modelFallback: string;
  modelKey: keyof EngineCredentials;
  temperatureLabel?: string;
  temperatureValue?: string;
  temperatureFallback?: number;
  onTemperatureChange?: (value: string) => void;
  onTemperatureBlur?: () => void;
};

const FALLBACK_ICON_MAP: Record<SummaryModelEngine, AppIconName> = {
  openai: 'robot',
  gemini: 'gem',
};

export default function SummarySettingsScreen() {
  const { t } = useTranslation();
  const { settings, updateSettings, updateCredentials } = useSettings();
  const { formState, setFormState } = useSettingsForm(settings);

  const modelCatalogs = useSettingsModelCatalogs({
    openaiApiKey: formState.openaiApiKey,
    openaiBaseUrl: formState.openaiBaseUrl,
    geminiApiKey: formState.geminiApiKey,
    qwenApiKey: formState.qwenApiKey,
    glmApiKey: formState.glmApiKey,
  });

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

  const titleProviders = useMemo<SummaryProviderConfig[]>(
    () => [
      {
        id: 'openai',
        title: t('settings.summary.title_engine.engines.openai'),
        providerIcon: ModelProvider.OpenAI,
        fallbackIcon: FALLBACK_ICON_MAP.openai,
        modelProvider: 'openai',
        remoteModelProvider: 'openai',
        modelLabel: t('settings.summary.title_engine.openai_label'),
        modelValue: formState.openaiTitleModel,
        modelFallback: DEFAULT_OPENAI_TITLE_MODEL,
        modelKey: 'openaiTitleModel',
        temperatureLabel: t('settings.summary.title_engine.temperature_label'),
        temperatureValue: formState.openaiTitleTemperature,
        temperatureFallback: DEFAULT_OPENAI_TITLE_TEMPERATURE,
        onTemperatureChange: (text) =>
          setFormState((prev) => ({
            ...prev,
            openaiTitleTemperature: formatNumberInput(text),
          })),
        onTemperatureBlur: () =>
          updateSettings({
            openaiTitleTemperature: resolveTemperature(
              formState.openaiTitleTemperature,
              DEFAULT_OPENAI_TITLE_TEMPERATURE
            ),
          }),
      },
      {
        id: 'gemini',
        title: t('settings.summary.title_engine.engines.gemini'),
        providerIcon: ModelProvider.Gemini,
        fallbackIcon: FALLBACK_ICON_MAP.gemini,
        modelProvider: 'gemini',
        remoteModelProvider: 'gemini',
        modelLabel: t('settings.summary.title_engine.gemini_label'),
        modelValue: formState.geminiTitleModel,
        modelFallback: DEFAULT_GEMINI_TITLE_MODEL,
        modelKey: 'geminiTitleModel',
      },
    ],
    [
      formState.geminiTitleModel,
      formState.openaiTitleModel,
      formState.openaiTitleTemperature,
      setFormState,
      t,
      updateSettings,
    ]
  );

  const conversationProviders = useMemo<SummaryProviderConfig[]>(
    () => [
      {
        id: 'openai',
        title: t('settings.summary.conversation_engine.engines.openai'),
        providerIcon: ModelProvider.OpenAI,
        fallbackIcon: FALLBACK_ICON_MAP.openai,
        modelProvider: 'openai',
        remoteModelProvider: 'openai',
        modelLabel: t('settings.summary.conversation_engine.openai_label'),
        modelValue: formState.openaiConversationModel,
        modelFallback: DEFAULT_OPENAI_CONVERSATION_MODEL,
        modelKey: 'openaiConversationModel',
        temperatureLabel: t('settings.summary.conversation_engine.temperature_label'),
        temperatureValue: formState.openaiConversationTemperature,
        temperatureFallback: DEFAULT_OPENAI_CONVERSATION_TEMPERATURE,
        onTemperatureChange: (text) =>
          setFormState((prev) => ({
            ...prev,
            openaiConversationTemperature: formatNumberInput(text),
          })),
        onTemperatureBlur: () =>
          updateSettings({
            openaiConversationTemperature: resolveTemperature(
              formState.openaiConversationTemperature,
              DEFAULT_OPENAI_CONVERSATION_TEMPERATURE
            ),
          }),
      },
      {
        id: 'gemini',
        title: t('settings.summary.conversation_engine.engines.gemini'),
        providerIcon: ModelProvider.Gemini,
        fallbackIcon: FALLBACK_ICON_MAP.gemini,
        modelProvider: 'gemini',
        remoteModelProvider: 'gemini',
        modelLabel: t('settings.summary.conversation_engine.gemini_label'),
        modelValue: formState.geminiConversationModel,
        modelFallback: DEFAULT_GEMINI_CONVERSATION_MODEL,
        modelKey: 'geminiConversationModel',
      },
    ],
    [
      formState.geminiConversationModel,
      formState.openaiConversationModel,
      formState.openaiConversationTemperature,
      setFormState,
      t,
      updateSettings,
    ]
  );

  const assistantProviders = useMemo<SummaryProviderConfig[]>(
    () => [
      {
        id: 'openai',
        title: t('settings.summary.assistant_engine.engines.openai'),
        providerIcon: ModelProvider.OpenAI,
        fallbackIcon: FALLBACK_ICON_MAP.openai,
        modelProvider: 'openai',
        remoteModelProvider: 'openai',
        modelLabel: t('settings.summary.assistant_engine.openai_label'),
        modelValue: formState.openaiAssistantModel,
        modelFallback: DEFAULT_OPENAI_ASSISTANT_MODEL,
        modelKey: 'openaiAssistantModel',
        temperatureLabel: t('settings.summary.assistant_engine.temperature_label'),
        temperatureValue: formState.openaiAssistantTemperature,
        temperatureFallback: DEFAULT_OPENAI_ASSISTANT_TEMPERATURE,
        onTemperatureChange: (text) =>
          setFormState((prev) => ({
            ...prev,
            openaiAssistantTemperature: formatNumberInput(text),
          })),
        onTemperatureBlur: () =>
          updateSettings({
            openaiAssistantTemperature: resolveTemperature(
              formState.openaiAssistantTemperature,
              DEFAULT_OPENAI_ASSISTANT_TEMPERATURE
            ),
          }),
      },
      {
        id: 'gemini',
        title: t('settings.summary.assistant_engine.engines.gemini'),
        providerIcon: ModelProvider.Gemini,
        fallbackIcon: FALLBACK_ICON_MAP.gemini,
        modelProvider: 'gemini',
        remoteModelProvider: 'gemini',
        modelLabel: t('settings.summary.assistant_engine.gemini_label'),
        modelValue: formState.geminiAssistantModel,
        modelFallback: DEFAULT_GEMINI_ASSISTANT_MODEL,
        modelKey: 'geminiAssistantModel',
      },
    ],
    [
      formState.geminiAssistantModel,
      formState.openaiAssistantModel,
      formState.openaiAssistantTemperature,
      setFormState,
      t,
      updateSettings,
    ]
  );

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
          <SummaryModelSection
            title={t('settings.summary.title_engine.title')}
            activeEngine={settings.titleSummaryEngine}
            providers={titleProviders}
            promptLabel={t('settings.summary.title_engine.prompt_label')}
            promptValue={formState.titleSummaryPrompt}
            promptFallback={DEFAULT_TITLE_SUMMARY_PROMPT}
            onPromptChange={(text) =>
              setFormState((prev) => ({ ...prev, titleSummaryPrompt: text }))
            }
            onPromptBlur={() =>
              updateSettings({
                titleSummaryPrompt:
                  formState.titleSummaryPrompt.trim() || DEFAULT_TITLE_SUMMARY_PROMPT,
              })
            }
            onSelectEngine={(engine) => updateSettings({ titleSummaryEngine: engine })}
            modelCatalogs={modelCatalogs}
            updateCredentials={updateCredentials}
            setFormModelValue={(key, value) =>
              setFormState((prev) => ({ ...prev, [key]: value }))
            }
          />

          <SummaryModelSection
            title={t('settings.summary.conversation_engine.title')}
            activeEngine={settings.conversationSummaryEngine}
            providers={conversationProviders}
            promptLabel={t('settings.summary.conversation_engine.prompt_label')}
            promptValue={formState.conversationSummaryPrompt}
            promptFallback={DEFAULT_CONVERSATION_SUMMARY_PROMPT}
            onPromptChange={(text) =>
              setFormState((prev) => ({ ...prev, conversationSummaryPrompt: text }))
            }
            onPromptBlur={() =>
              updateSettings({
                conversationSummaryPrompt:
                  formState.conversationSummaryPrompt.trim() ||
                  DEFAULT_CONVERSATION_SUMMARY_PROMPT,
              })
            }
            onSelectEngine={(engine) => updateSettings({ conversationSummaryEngine: engine })}
            modelCatalogs={modelCatalogs}
            updateCredentials={updateCredentials}
            setFormModelValue={(key, value) =>
              setFormState((prev) => ({ ...prev, [key]: value }))
            }
          />

          <SummaryModelSection
            title={t('settings.summary.assistant_engine.title')}
            activeEngine={settings.assistantEngine}
            providers={assistantProviders}
            promptLabel={t('settings.summary.assistant_engine.prompt_label')}
            promptValue={formState.assistantPrompt}
            promptFallback={DEFAULT_ASSISTANT_PROMPT}
            onPromptChange={(text) =>
              setFormState((prev) => ({ ...prev, assistantPrompt: text }))
            }
            onPromptBlur={() =>
              updateSettings({
                assistantPrompt: formState.assistantPrompt.trim() || DEFAULT_ASSISTANT_PROMPT,
              })
            }
            onSelectEngine={(engine) => updateSettings({ assistantEngine: engine })}
            modelCatalogs={modelCatalogs}
            updateCredentials={updateCredentials}
            setFormModelValue={(key, value) =>
              setFormState((prev) => ({ ...prev, [key]: value }))
            }
          />
        </ScrollView>
      </KeyboardAvoidingView>
    </AppScreen>
  );
}

function SummaryModelSection({
  title,
  activeEngine,
  providers,
  promptLabel,
  promptValue,
  promptFallback,
  onPromptChange,
  onPromptBlur,
  onSelectEngine,
  modelCatalogs,
  updateCredentials,
  setFormModelValue,
}: {
  title: string;
  activeEngine: SummaryModelEngine;
  providers: SummaryProviderConfig[];
  promptLabel: string;
  promptValue: string;
  promptFallback: string;
  onPromptChange: (value: string) => void;
  onPromptBlur: () => void;
  onSelectEngine: (engine: SummaryModelEngine) => void;
  modelCatalogs: ModelCatalogControls;
  updateCredentials: (partial: Partial<EngineCredentials>) => void;
  setFormModelValue: (key: keyof EngineCredentials, value: string) => void;
}) {
  const { t } = useTranslation();
  const { catalogs, ensureModelsFetched, refreshModels } = modelCatalogs;
  const activeProvider = providers.find((provider) => provider.id === activeEngine) ?? providers[0];
  const activeCatalog = catalogs[activeProvider.modelProvider!];
  const modelOptions = getModelSelectOptions(
    catalogs,
    activeProvider.modelProvider,
    [activeProvider.modelValue, activeProvider.modelFallback]
  );

  useEffect(() => {
    void ensureModelsFetched(activeProvider.remoteModelProvider);
  }, [activeProvider.remoteModelProvider, ensureModelsFetched]);

  const handleSelectModel = (value: string) => {
    const nextValue = value.trim() || activeProvider.modelFallback;
    setFormModelValue(activeProvider.modelKey, nextValue);
    updateCredentials({ [activeProvider.modelKey]: nextValue } as Partial<EngineCredentials>);
  };

  return (
    <View className="gap-3">
      <Text.Heading type="h3">{title}</Text.Heading>
      <SettingsModelProviderStrip
        providers={providers}
        activeId={activeEngine}
        onSelect={onSelectEngine}
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

        {activeProvider.temperatureLabel &&
        activeProvider.temperatureValue !== undefined &&
        activeProvider.temperatureFallback !== undefined ? (
          <FormInput
            label={activeProvider.temperatureLabel}
            value={activeProvider.temperatureValue}
            onChangeText={activeProvider.onTemperatureChange ?? (() => undefined)}
            onBlur={activeProvider.onTemperatureBlur}
            keyboardType="decimal-pad"
            placeholder={`${activeProvider.temperatureFallback}`}
          />
        ) : null}

        <FormInput
          label={promptLabel}
          value={promptValue}
          onChangeText={onPromptChange}
          onBlur={onPromptBlur}
          placeholder={promptFallback}
          multiline
          inputClassName="min-h-36"
        />
      </SettingsModelDetailCard>
    </View>
  );
}
