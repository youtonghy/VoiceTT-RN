import { ProviderIcon, ModelProvider } from '@lobehub/icons-rn';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  type ViewStyle,
  useWindowDimensions,
  View,
} from 'react-native';
import { Button, Card, Select, Separator, Spinner, Text } from 'heroui-native';

import { AppIcon, AppScreen, FormInput, type AppIconName } from '@/components/native/app-shell';
import { useSettings } from '@/contexts/settings-context';
import {
  DEFAULT_GLM_TRANSCRIPTION_MODEL,
  DEFAULT_OPENAI_BASE_URL,
  DEFAULT_QWEN_TRANSCRIPTION_MODEL,
} from '@/services/transcription';
import {
  fetchProviderModels,
  getFallbackModelOptions,
  mergeModelOptions,
  type ModelCatalogProvider,
  type ModelOption,
  type RemoteModelCatalogProvider,
} from '@/services/model-catalog';
import type { EngineCredentials } from '@/types/settings';

import { useSettingsForm, type SettingsCardVariant } from './shared';

type CredentialProviderId = 'openai' | 'gemini' | 'soniox' | 'qwen' | 'glm' | 'doubao';

type EditableCredentialKey =
  | 'openaiApiKey'
  | 'openaiBaseUrl'
  | 'geminiApiKey'
  | 'sonioxApiKey'
  | 'qwenApiKey'
  | 'glmApiKey'
  | 'doubaoAppId'
  | 'doubaoToken'
  | 'doubaoCluster';

type ModelCredentialKey =
  | 'openaiTranscriptionModel'
  | 'openaiTranslationModel'
  | 'openaiTtsModel'
  | 'openaiTitleModel'
  | 'openaiConversationModel'
  | 'openaiAssistantModel'
  | 'openaiQaModel'
  | 'geminiTranscriptionModel'
  | 'geminiTranslationModel'
  | 'geminiTtsModel'
  | 'geminiTitleModel'
  | 'geminiConversationModel'
  | 'geminiAssistantModel'
  | 'geminiQaModel'
  | 'qwenTranscriptionModel'
  | 'glmTranscriptionModel';

type CredentialProvider = {
  id: CredentialProviderId;
  title: string;
  providerIcon?: string;
  fallbackIcon?: AppIconName;
  variant: SettingsCardVariant;
  fields: CredentialField[];
  modelProvider?: ModelCatalogProvider;
  remoteModelProvider?: RemoteModelCatalogProvider;
  models: ModelField[];
};

type CredentialField = {
  id: EditableCredentialKey;
  label: string;
  value: string;
  placeholder: string;
  secureTextEntry?: boolean;
  normalize?: (text: string) => string | undefined;
};

type ModelField = {
  id: ModelCredentialKey;
  label: string;
  value: string;
  fallback: string;
};

type ModelCatalogState = {
  options: ModelOption[];
  status: 'idle' | 'loading' | 'ready' | 'error' | 'missing-key';
  error?: string;
};

const PROVIDER_ICON_MAP: Partial<Record<CredentialProviderId, string>> = {
  openai: ModelProvider.OpenAI,
  gemini: ModelProvider.Gemini,
  qwen: ModelProvider.Qwen,
  glm: ModelProvider.ZhiPu,
  doubao: ModelProvider.Doubao,
};

const PROVIDER_FALLBACK_ICON_MAP: Record<CredentialProviderId, AppIconName> = {
  openai: 'robot',
  gemini: 'gem',
  soniox: 'wave-square',
  qwen: 'server',
  glm: 'cloud-arrow-up',
  doubao: 'key',
};

const MODEL_SELECT_VISIBLE_ITEMS = 7;
const MODEL_SELECT_MAX_HEIGHT = 420;
const MODEL_SELECT_MIN_HEIGHT = 240;
const MODEL_SELECT_HEADER_SPACE = 52;
const MODEL_SELECT_MIN_LIST_HEIGHT = 164;

const toSelectOption = (value: string): ModelOption | undefined => {
  const trimmed = value.trim();
  return trimmed ? { label: trimmed, value: trimmed } : undefined;
};

const normalizeSecret = (text: string) => text.trim() || undefined;
const normalizeOpenAIBaseUrl = (text: string) => text.trim().replace(/\/+$/, '') || DEFAULT_OPENAI_BASE_URL;

export default function CredentialSettingsScreen() {
  const { t } = useTranslation();
  const { settings, updateCredentials } = useSettings();
  const { formState, setFormState } = useSettingsForm(settings);
  const [activeProviderId, setActiveProviderId] = useState<CredentialProviderId>('openai');
  const [catalogs, setCatalogs] = useState<Record<ModelCatalogProvider, ModelCatalogState>>(() => ({
    openai: { options: getFallbackModelOptions('openai'), status: 'idle' },
    gemini: { options: getFallbackModelOptions('gemini'), status: 'idle' },
    qwen: { options: getFallbackModelOptions('qwen'), status: 'idle' },
    glm: { options: getFallbackModelOptions('glm'), status: 'idle' },
  }));
  const fetchedProvidersRef = useRef<Set<ModelCatalogProvider>>(new Set());

  const providers = useMemo<CredentialProvider[]>(
    () => [
      {
        id: 'openai',
        title: t('settings.credentials.sections.openai.title'),
        providerIcon: PROVIDER_ICON_MAP.openai,
        fallbackIcon: PROVIDER_FALLBACK_ICON_MAP.openai,
        variant: 'openai',
        modelProvider: 'openai',
        remoteModelProvider: 'openai',
        fields: [
          {
            id: 'openaiBaseUrl',
            label: t('settings.credentials.labels.base_url'),
            value: formState.openaiBaseUrl,
            placeholder: DEFAULT_OPENAI_BASE_URL,
            normalize: normalizeOpenAIBaseUrl,
          },
          {
            id: 'openaiApiKey',
            label: t('settings.credentials.labels.api_key'),
            value: formState.openaiApiKey,
            placeholder: 'sk-...',
            secureTextEntry: true,
            normalize: normalizeSecret,
          },
        ],
        models: [
          {
            id: 'openaiTranscriptionModel',
            label: t('settings.credentials.labels.transcription_model'),
            value: formState.openaiTranscriptionModel,
            fallback: settings.credentials.openaiTranscriptionModel || '',
          },
          {
            id: 'openaiTranslationModel',
            label: t('settings.credentials.labels.translation_model'),
            value: formState.openaiTranslationModel,
            fallback: settings.credentials.openaiTranslationModel || '',
          },
          {
            id: 'openaiTtsModel',
            label: t('settings.credentials.labels.tts_model'),
            value: formState.openaiTtsModel,
            fallback: settings.credentials.openaiTtsModel || '',
          },
          {
            id: 'openaiTitleModel',
            label: t('settings.credentials.labels.title_model'),
            value: formState.openaiTitleModel,
            fallback: settings.credentials.openaiTitleModel || '',
          },
          {
            id: 'openaiConversationModel',
            label: t('settings.credentials.labels.conversation_model'),
            value: formState.openaiConversationModel,
            fallback: settings.credentials.openaiConversationModel || '',
          },
          {
            id: 'openaiAssistantModel',
            label: t('settings.credentials.labels.assistant_model'),
            value: formState.openaiAssistantModel,
            fallback: settings.credentials.openaiAssistantModel || '',
          },
          {
            id: 'openaiQaModel',
            label: t('settings.credentials.labels.qa_model'),
            value: formState.openaiQaModel,
            fallback: settings.credentials.openaiQaModel || '',
          },
        ],
      },
      {
        id: 'gemini',
        title: t('settings.credentials.sections.gemini.title'),
        providerIcon: PROVIDER_ICON_MAP.gemini,
        fallbackIcon: PROVIDER_FALLBACK_ICON_MAP.gemini,
        variant: 'gemini',
        modelProvider: 'gemini',
        remoteModelProvider: 'gemini',
        fields: [
          {
            id: 'geminiApiKey',
            label: t('settings.credentials.labels.api_key'),
            value: formState.geminiApiKey,
            placeholder: 'AIza...',
            secureTextEntry: true,
            normalize: normalizeSecret,
          },
        ],
        models: [
          {
            id: 'geminiTranscriptionModel',
            label: t('settings.credentials.labels.transcription_model'),
            value: formState.geminiTranscriptionModel,
            fallback: settings.credentials.geminiTranscriptionModel || '',
          },
          {
            id: 'geminiTranslationModel',
            label: t('settings.credentials.labels.translation_model'),
            value: formState.geminiTranslationModel,
            fallback: settings.credentials.geminiTranslationModel || '',
          },
          {
            id: 'geminiTtsModel',
            label: t('settings.credentials.labels.tts_model'),
            value: formState.geminiTtsModel,
            fallback: settings.credentials.geminiTtsModel || '',
          },
          {
            id: 'geminiTitleModel',
            label: t('settings.credentials.labels.title_model'),
            value: formState.geminiTitleModel,
            fallback: settings.credentials.geminiTitleModel || '',
          },
          {
            id: 'geminiConversationModel',
            label: t('settings.credentials.labels.conversation_model'),
            value: formState.geminiConversationModel,
            fallback: settings.credentials.geminiConversationModel || '',
          },
          {
            id: 'geminiAssistantModel',
            label: t('settings.credentials.labels.assistant_model'),
            value: formState.geminiAssistantModel,
            fallback: settings.credentials.geminiAssistantModel || '',
          },
          {
            id: 'geminiQaModel',
            label: t('settings.credentials.labels.qa_model'),
            value: formState.geminiQaModel,
            fallback: settings.credentials.geminiQaModel || '',
          },
        ],
      },
      {
        id: 'soniox',
        title: t('settings.credentials.sections.soniox.title'),
        fallbackIcon: PROVIDER_FALLBACK_ICON_MAP.soniox,
        variant: 'soniox',
        fields: [
          {
            id: 'sonioxApiKey',
            label: t('settings.credentials.labels.api_key'),
            value: formState.sonioxApiKey,
            placeholder: 'soniox_...',
            secureTextEntry: true,
            normalize: normalizeSecret,
          },
        ],
        models: [],
      },
      {
        id: 'qwen',
        title: t('settings.credentials.sections.qwen.title'),
        providerIcon: PROVIDER_ICON_MAP.qwen,
        fallbackIcon: PROVIDER_FALLBACK_ICON_MAP.qwen,
        variant: 'qwen',
        modelProvider: 'qwen',
        fields: [
          {
            id: 'qwenApiKey',
            label: t('settings.credentials.labels.api_key'),
            value: formState.qwenApiKey,
            placeholder: 'sk-...',
            secureTextEntry: true,
            normalize: normalizeSecret,
          },
        ],
        models: [
          {
            id: 'qwenTranscriptionModel',
            label: t('settings.credentials.labels.transcription_model'),
            value: formState.qwenTranscriptionModel,
            fallback: DEFAULT_QWEN_TRANSCRIPTION_MODEL,
          },
        ],
      },
      {
        id: 'glm',
        title: t('settings.credentials.sections.glm.title'),
        providerIcon: PROVIDER_ICON_MAP.glm,
        fallbackIcon: PROVIDER_FALLBACK_ICON_MAP.glm,
        variant: 'glm',
        modelProvider: 'glm',
        fields: [
          {
            id: 'glmApiKey',
            label: t('settings.credentials.labels.api_key'),
            value: formState.glmApiKey,
            placeholder: 'token',
            secureTextEntry: true,
            normalize: normalizeSecret,
          },
        ],
        models: [
          {
            id: 'glmTranscriptionModel',
            label: t('settings.credentials.labels.transcription_model'),
            value: formState.glmTranscriptionModel,
            fallback: DEFAULT_GLM_TRANSCRIPTION_MODEL,
          },
        ],
      },
      {
        id: 'doubao',
        title: t('settings.credentials.sections.doubao.title'),
        providerIcon: PROVIDER_ICON_MAP.doubao,
        fallbackIcon: PROVIDER_FALLBACK_ICON_MAP.doubao,
        variant: 'interaction',
        fields: [
          {
            id: 'doubaoAppId',
            label: t('settings.credentials.labels.doubao_app_id'),
            value: formState.doubaoAppId,
            placeholder: 'appid',
            normalize: normalizeSecret,
          },
          {
            id: 'doubaoToken',
            label: t('settings.credentials.labels.doubao_token'),
            value: formState.doubaoToken,
            placeholder: 'token',
            secureTextEntry: true,
            normalize: normalizeSecret,
          },
          {
            id: 'doubaoCluster',
            label: t('settings.credentials.labels.doubao_cluster'),
            value: formState.doubaoCluster,
            placeholder: 'cluster id',
            normalize: normalizeSecret,
          },
        ],
        models: [],
      },
    ],
    [formState, settings.credentials, t]
  );

  const activeProvider = providers.find((provider) => provider.id === activeProviderId) ?? providers[0];
  const activeCatalog = activeProvider.modelProvider
    ? catalogs[activeProvider.modelProvider]
    : undefined;

  const getModelOptions = (field: ModelField, provider?: ModelCatalogProvider) =>
    mergeModelOptions(
      provider ? catalogs[provider].options : undefined,
      provider ? getFallbackModelOptions(provider) : undefined,
      [field.value, field.fallback]
    );

  const persistField = (field: CredentialField) => {
    const nextValue = field.normalize ? field.normalize(field.value) : normalizeSecret(field.value);
    updateCredentials({ [field.id]: nextValue } as Partial<EngineCredentials>);
    if (typeof nextValue === 'string' && nextValue !== field.value) {
      setFormState((prev) => ({ ...prev, [field.id]: nextValue }));
    }
  };

  const updateFormField = (id: EditableCredentialKey, value: string) => {
    setFormState((prev) => ({ ...prev, [id]: value }));
  };

  const updateModel = (field: ModelField, value: string) => {
    const nextValue = value.trim() || field.fallback;
    setFormState((prev) => ({ ...prev, [field.id]: nextValue }));
    updateCredentials({ [field.id]: nextValue } as Partial<EngineCredentials>);
  };

  const refreshModels = useCallback(async (provider: ModelCatalogProvider, markFetched = true) => {
    const apiKey =
      provider === 'openai'
        ? formState.openaiApiKey
        : provider === 'gemini'
          ? formState.geminiApiKey
          : provider === 'qwen'
            ? formState.qwenApiKey
            : formState.glmApiKey;

    if (!apiKey.trim()) {
      setCatalogs((prev) => ({
        ...prev,
        [provider]: {
          options: getFallbackModelOptions(provider),
          status: 'missing-key',
        },
      }));
      return;
    }

    if (provider !== 'openai' && provider !== 'gemini') {
      setCatalogs((prev) => ({
        ...prev,
        [provider]: {
          options: getFallbackModelOptions(provider),
          status: 'ready',
        },
      }));
      return;
    }

    setCatalogs((prev) => ({
      ...prev,
      [provider]: {
        ...prev[provider],
        status: 'loading',
        error: undefined,
      },
    }));

    try {
      const options = await fetchProviderModels({
        provider,
        apiKey,
        baseUrl: provider === 'openai' ? formState.openaiBaseUrl : undefined,
      });
      setCatalogs((prev) => ({
        ...prev,
        [provider]: {
          options: mergeModelOptions(options, getFallbackModelOptions(provider)),
          status: 'ready',
        },
      }));
      if (markFetched) {
        fetchedProvidersRef.current.add(provider);
      }
    } catch (error) {
      setCatalogs((prev) => ({
        ...prev,
        [provider]: {
          options: prev[provider].options.length
            ? prev[provider].options
            : getFallbackModelOptions(provider),
          status: 'error',
          error: error instanceof Error ? error.message : String(error),
        },
      }));
    }
  }, [
    formState.geminiApiKey,
    formState.glmApiKey,
    formState.openaiApiKey,
    formState.openaiBaseUrl,
    formState.qwenApiKey,
  ]);

  useEffect(() => {
    const provider = activeProvider.remoteModelProvider;
    if (!provider || fetchedProvidersRef.current.has(provider)) {
      return;
    }
    refreshModels(provider).catch(() => undefined);
  }, [activeProvider.remoteModelProvider, refreshModels]);

  return (
    <AppScreen scroll={false}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        className="min-h-0 flex-1">
        <View className="min-h-0 flex-1 gap-4">
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            className="-mx-4 max-h-28 flex-grow-0"
            contentContainerClassName="gap-3 px-4 pb-1">
            {providers.map((provider) => {
              const selected = provider.id === activeProvider.id;
              return (
                <ProviderCard
                  key={provider.id}
                  provider={provider}
                  selected={selected}
                  onPress={() => setActiveProviderId(provider.id)}
                />
              );
            })}
          </ScrollView>

          <ScrollView
            showsVerticalScrollIndicator={false}
            keyboardDismissMode="on-drag"
            keyboardShouldPersistTaps="handled"
            className="min-h-0 flex-1"
            contentContainerClassName="gap-4 pb-6">
            <Card className="gap-4 border border-border">
              <Card.Header className="flex-row items-start justify-between gap-3">
                <View className="min-w-0 flex-1 flex-row items-start gap-3">
                  <ProviderMark
                    providerIcon={activeProvider.providerIcon}
                    fallbackIcon={activeProvider.fallbackIcon}
                    selected
                    size={42}
                    iconSize={24}
                  />
                  <View className="min-w-0 flex-1 gap-1">
                    <Card.Title>{activeProvider.title}</Card.Title>
                    <Card.Description>
                      {activeProvider.modelProvider
                        ? activeProvider.remoteModelProvider
                          ? t('settings.credentials.models.catalog_hint')
                          : t('settings.credentials.models.local_hint')
                        : t('settings.credentials.models.credentials_only')}
                    </Card.Description>
                  </View>
                </View>
                {activeProvider.remoteModelProvider ? (
                  <Button
                    isDisabled={activeCatalog?.status === 'loading'}
                    isIconOnly
                    onPress={() => refreshModels(activeProvider.remoteModelProvider!)}
                    size="sm"
                    variant="tertiary"
                    accessibilityLabel={t('settings.credentials.models.refresh')}>
                    {activeCatalog?.status === 'loading' ? (
                      <Spinner size="sm" />
                    ) : (
                      <AppIcon name="cloud-arrow-up" size={15} className="text-foreground" />
                    )}
                  </Button>
                ) : null}
              </Card.Header>

              <Card.Body className="gap-5">
                {activeProvider.fields.length ? (
                  <View className="gap-4">
                    {activeProvider.fields.map((field) => (
                      <FormInput
                        key={field.id}
                        label={field.label}
                        value={field.value}
                        onChangeText={(text) => updateFormField(field.id, text)}
                        onBlur={() => persistField(field)}
                        placeholder={field.placeholder}
                        secureTextEntry={field.secureTextEntry}
                      />
                    ))}
                  </View>
                ) : null}

                {activeProvider.models.length ? (
                  <View className="gap-3">
                    <View className="flex-row items-center justify-between gap-3">
                      <Text type="body-sm" weight="semibold">
                        {t('settings.credentials.models.title')}
                      </Text>
                      <Text type="body-xs" color="muted">
                        {resolveCatalogStatusText(t, activeCatalog)}
                      </Text>
                    </View>
                    {activeProvider.models.map((field) => (
                      <ModelSelectField
                        key={field.id}
                        label={field.label}
                        options={getModelOptions(field, activeProvider.modelProvider)}
                        value={field.value}
                        placeholder={field.fallback || t('settings.credentials.models.placeholder')}
                        onChange={(value) => updateModel(field, value)}
                      />
                    ))}
                  </View>
                ) : null}

                {activeCatalog?.status === 'error' ? (
                  <Text type="body-xs" color="muted" numberOfLines={2}>
                    {t('settings.credentials.models.fetch_failed')}
                  </Text>
                ) : null}
              </Card.Body>
            </Card>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </AppScreen>
  );
}

function ProviderCard({
  provider,
  selected,
  onPress,
}: {
  provider: CredentialProvider;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={provider.title}
      accessibilityState={{ selected }}
      onPress={onPress}
      className={[
        'min-w-32 rounded-2xl border p-3',
        selected ? 'border-accent bg-accent/10' : 'border-border bg-surface',
      ].join(' ')}>
      <View className="gap-3">
        <ProviderMark
          providerIcon={provider.providerIcon}
          fallbackIcon={provider.fallbackIcon}
          selected={selected}
          size={40}
          iconSize={23}
        />
        <Text
          type="body-sm"
          weight="bold"
          numberOfLines={1}
          className={selected ? 'text-accent' : 'text-foreground'}>
          {provider.title}
        </Text>
      </View>
    </Pressable>
  );
}

function ProviderMark({
  providerIcon,
  fallbackIcon,
  selected,
  size,
  iconSize,
}: {
  providerIcon?: string;
  fallbackIcon?: AppIconName;
  selected: boolean;
  size: number;
  iconSize: number;
}) {
  return (
    <View
      className={[
        'items-center justify-center rounded-xl',
        selected ? 'bg-accent/15' : 'bg-surface-secondary',
      ].join(' ')}
      style={{ height: size, width: size }}>
      {providerIcon ? (
        <ProviderIcon provider={providerIcon} size={iconSize} type="avatar" />
      ) : fallbackIcon ? (
        <AppIcon
          name={fallbackIcon}
          size={iconSize - 5}
          className={selected ? 'text-accent' : 'text-muted'}
        />
      ) : null}
    </View>
  );
}

function ModelSelectField({
  label,
  value,
  options,
  placeholder,
  onChange,
}: {
  label: string;
  value: string;
  options: ModelOption[];
  placeholder: string;
  onChange: (value: string) => void;
}) {
  const currentOption = toSelectOption(value);
  const isPopoverPresentation = Platform.OS === 'web';
  const { height: windowHeight } = useWindowDimensions();
  const safeWindowHeight = windowHeight || 640;
  const contentHeight = Math.min(
    MODEL_SELECT_MAX_HEIGHT,
    Math.max(MODEL_SELECT_MIN_HEIGHT, Math.floor(safeWindowHeight * 0.72))
  );
  const listHeight = Math.max(MODEL_SELECT_MIN_LIST_HEIGHT, contentHeight - MODEL_SELECT_HEADER_SPACE);
  const shouldUseFixedWindow = options.length > MODEL_SELECT_VISIBLE_ITEMS;
  const contentStyle: ViewStyle = shouldUseFixedWindow
    ? { height: contentHeight, overflow: 'hidden' }
    : { maxHeight: contentHeight, overflow: 'hidden' };
  const listStyle = shouldUseFixedWindow ? { height: listHeight } : { maxHeight: listHeight };
  const listContent = (
    <>
      <View className="mb-2 flex-row items-center justify-between gap-3 px-2">
        <Select.ListLabel className="min-w-0 flex-1 px-0 py-0" numberOfLines={1}>
          {label}
        </Select.ListLabel>
        <Text type="body-xs" color="muted">
          {options.length}
        </Text>
      </View>
      <ScrollView
        nestedScrollEnabled
        showsVerticalScrollIndicator={shouldUseFixedWindow}
        keyboardShouldPersistTaps="handled"
        style={listStyle}
        contentContainerClassName="pb-1">
        {options.map((option, index) => (
          <View key={option.value}>
            <Select.Item value={option.value} label={option.label} className="min-h-12">
              {({ isSelected }) => (
                <>
                  <Select.ItemLabel
                    numberOfLines={1}
                    className={isSelected ? 'text-accent' : undefined}
                  />
                  <Select.ItemIndicator />
                </>
              )}
            </Select.Item>
            {index < options.length - 1 ? <Separator /> : null}
          </View>
        ))}
      </ScrollView>
    </>
  );

  return (
    <View className="gap-2">
      <Text type="body-sm" weight="semibold">
        {label}
      </Text>
      <Select
        presentation={isPopoverPresentation ? 'popover' : 'dialog'}
        value={currentOption}
        onValueChange={(option) => option?.value && onChange(option.value)}>
        <Select.Trigger className="bg-default">
          <Select.Value placeholder={placeholder} numberOfLines={1} />
          <Select.TriggerIndicator />
        </Select.Trigger>
        <Select.Portal>
          <Select.Overlay />
          {isPopoverPresentation ? (
            <Select.Content presentation="popover" width="trigger" style={contentStyle}>
              {listContent}
            </Select.Content>
          ) : (
            <Select.Content presentation="dialog" style={contentStyle}>
              {listContent}
            </Select.Content>
          )}
        </Select.Portal>
      </Select>
    </View>
  );
}

function resolveCatalogStatusText(
  t: ReturnType<typeof useTranslation>['t'],
  catalog?: ModelCatalogState
) {
  if (!catalog) {
    return '';
  }
  switch (catalog.status) {
    case 'loading':
      return t('settings.credentials.models.loading');
    case 'ready':
      return t('settings.credentials.models.ready', { count: catalog.options.length });
    case 'missing-key':
      return t('settings.credentials.models.missing_key');
    case 'error':
      return t('settings.credentials.models.using_cached');
    default:
      return t('settings.credentials.models.defaults');
  }
}
