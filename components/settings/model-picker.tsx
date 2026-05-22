import { ProviderIcon } from '@lobehub/icons-rn';
import { Fragment, useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Platform,
  ScrollView,
  useWindowDimensions,
  View,
  type ViewStyle,
} from 'react-native';
import { Card, PressableFeedback, Select, Separator, Text } from 'heroui-native';

import { AppIcon, type AppIconName } from '@/components/native/app-shell';
import {
  fetchProviderModels,
  getFallbackModelOptions,
  mergeModelOptions,
  type ModelCatalogProvider,
  type ModelOption,
  type RemoteModelCatalogProvider,
} from '@/services/model-catalog';

export type SettingsModelCatalogState = {
  options: ModelOption[];
  status: 'idle' | 'loading' | 'ready' | 'error' | 'missing-key';
  error?: string;
};

export type SettingsModelProviderItem<T extends string> = {
  id: T;
  title: string;
  providerIcon?: string;
  fallbackIcon?: AppIconName;
  modelProvider?: ModelCatalogProvider;
  remoteModelProvider?: RemoteModelCatalogProvider;
  isDisabled?: boolean;
};

type ModelCatalogCredentials = {
  openaiApiKey: string;
  openaiBaseUrl: string;
  geminiApiKey: string;
  qwenApiKey: string;
  glmApiKey: string;
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

export function useSettingsModelCatalogs({
  openaiApiKey,
  openaiBaseUrl,
  geminiApiKey,
  qwenApiKey,
  glmApiKey,
}: ModelCatalogCredentials) {
  const [catalogs, setCatalogs] = useState<Record<ModelCatalogProvider, SettingsModelCatalogState>>(() => ({
    openai: { options: getFallbackModelOptions('openai'), status: 'idle' },
    gemini: { options: getFallbackModelOptions('gemini'), status: 'idle' },
    qwen: { options: getFallbackModelOptions('qwen'), status: 'idle' },
    glm: { options: getFallbackModelOptions('glm'), status: 'idle' },
  }));
  const fetchedProvidersRef = useRef<Set<ModelCatalogProvider>>(new Set());

  useEffect(() => {
    fetchedProvidersRef.current.clear();
  }, [geminiApiKey, glmApiKey, openaiApiKey, openaiBaseUrl, qwenApiKey]);

  const refreshModels = useCallback(async (provider: ModelCatalogProvider, markFetched = true) => {
    const apiKey =
      provider === 'openai'
        ? openaiApiKey
        : provider === 'gemini'
          ? geminiApiKey
          : provider === 'qwen'
            ? qwenApiKey
            : glmApiKey;

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
        baseUrl: provider === 'openai' ? openaiBaseUrl : undefined,
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
  }, [geminiApiKey, glmApiKey, openaiApiKey, openaiBaseUrl, qwenApiKey]);

  const ensureModelsFetched = useCallback(
    async (provider?: RemoteModelCatalogProvider) => {
      if (!provider || fetchedProvidersRef.current.has(provider)) {
        return;
      }
      await refreshModels(provider);
    },
    [refreshModels]
  );

  return { catalogs, ensureModelsFetched, refreshModels } as const;
}

export function SettingsModelProviderStrip<T extends string>({
  providers,
  activeId,
  onSelect,
  disabled,
}: {
  providers: SettingsModelProviderItem<T>[];
  activeId: T;
  onSelect: (id: T) => void;
  disabled?: boolean;
}) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      className="-mx-4 max-h-28 flex-grow-0"
      contentContainerClassName="gap-3 px-4 pb-1">
      {providers.map((provider) => {
        const selected = provider.id === activeId;
        const isDisabled = disabled || provider.isDisabled;
        return (
          <SettingsModelProviderCard
            key={provider.id}
            provider={provider}
            selected={selected}
            disabled={isDisabled}
            onPress={() => onSelect(provider.id)}
          />
        );
      })}
    </ScrollView>
  );
}

export function SettingsModelDetailCard({
  title,
  description,
  providerIcon,
  fallbackIcon,
  statusText,
  action,
  children,
  disabled,
}: {
  title: string;
  description?: string;
  providerIcon?: string;
  fallbackIcon?: AppIconName;
  statusText?: string;
  action?: ReactNode;
  children?: ReactNode;
  disabled?: boolean;
}) {
  return (
    <Card className={['gap-4 border border-border', disabled ? 'opacity-60' : ''].join(' ')}>
      <Card.Header className="flex-row items-start justify-between gap-3">
        <View className="min-w-0 flex-1 flex-row items-start gap-3">
          <SettingsModelProviderMark
            providerIcon={providerIcon}
            fallbackIcon={fallbackIcon}
            selected
            size={42}
            iconSize={24}
          />
          <View className="min-w-0 flex-1 gap-1">
            <Card.Title>{title}</Card.Title>
            {description ? <Card.Description>{description}</Card.Description> : null}
          </View>
        </View>
        {action}
      </Card.Header>
      {statusText ? (
        <View className="px-4">
          <Text type="body-xs" color="muted">
            {statusText}
          </Text>
        </View>
      ) : null}
      {children ? <Card.Body className="gap-5">{children}</Card.Body> : null}
    </Card>
  );
}

export function SettingsModelSelectField({
  label,
  value,
  options,
  placeholder,
  onChange,
  disabled,
}: {
  label: string;
  value: string;
  options: ModelOption[];
  placeholder: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}) {
  return (
    <View className="gap-2">
      <Text type="body-sm" weight="semibold">
        {label}
      </Text>
      <SettingsModelSelect
        isDisabled={disabled}
        label={label}
        value={value}
        options={options}
        placeholder={placeholder}
        onChange={onChange}>
        <Select.Trigger className="bg-default">
          <Select.Value placeholder={placeholder} numberOfLines={1} />
          <Select.TriggerIndicator />
        </Select.Trigger>
      </SettingsModelSelect>
    </View>
  );
}

export function SettingsModelSelect({
  label,
  value,
  options,
  placeholder,
  onChange,
  isDisabled,
  children,
}: {
  label: string;
  value: string;
  options: ModelOption[];
  placeholder: string;
  onChange: (value: string) => void;
  isDisabled?: boolean;
  children: ReactNode;
}) {
  const currentOption = options.find((option) => option.value === value) ?? toSelectOption(value);
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
          <Fragment key={option.value}>
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
          </Fragment>
        ))}
      </ScrollView>
    </>
  );

  return (
    <Select
      isDisabled={isDisabled}
      presentation={isPopoverPresentation ? 'popover' : 'dialog'}
      value={currentOption}
      onValueChange={(option) => option?.value && onChange(option.value)}>
      {children}
      <Select.Portal>
        <Select.Overlay />
        {isPopoverPresentation ? (
          <Select.Content presentation="popover" width="trigger" style={contentStyle}>
            {listContent}
          </Select.Content>
        ) : (
          <Select.Content presentation="dialog" isSwipeable={false} style={contentStyle}>
            {listContent}
          </Select.Content>
        )}
      </Select.Portal>
    </Select>
  );
}

export function resolveModelCatalogStatusText(
  t: ReturnType<typeof useTranslation>['t'],
  catalog?: SettingsModelCatalogState
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

function SettingsModelProviderCard<T extends string>({
  provider,
  selected,
  disabled,
  onPress,
}: {
  provider: SettingsModelProviderItem<T>;
  selected: boolean;
  disabled?: boolean;
  onPress: () => void;
}) {
  return (
    <PressableFeedback
      accessibilityRole="button"
      accessibilityLabel={provider.title}
      accessibilityState={{ selected, disabled }}
      isDisabled={disabled}
      onPress={onPress}
      className={[
        'min-w-32 rounded-2xl border p-3',
        selected ? 'border-accent bg-accent/10' : 'border-border bg-surface',
        disabled ? 'opacity-50' : '',
      ].join(' ')}>
      <View className="gap-3">
        <SettingsModelProviderMark
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
    </PressableFeedback>
  );
}

export function SettingsModelProviderMark({
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

export function getModelSelectOptions(
  catalogs: Record<ModelCatalogProvider, SettingsModelCatalogState>,
  provider: ModelCatalogProvider | undefined,
  values: (string | undefined)[],
  sortSource?: string
) {
  const selectedValues = values.filter((value): value is string => Boolean(value?.trim()));
  const options = mergeModelOptions(
    provider ? catalogs[provider].options : undefined,
    provider ? getFallbackModelOptions(provider) : undefined,
    selectedValues
  );
  return sortModelOptions(options, getModelSelectSortKeywords(sortSource), selectedValues);
}

export function getModelSelectSortKeywords(source?: string) {
  const normalized = source?.toLowerCase() ?? '';
  if (!normalized) {
    return [];
  }

  if (normalized.includes('transcription')) {
    return ['transcribe', 'asr', 'stt', 'whisper', 'speech-to-text'];
  }

  if (normalized.includes('translation')) {
    return ['translate', 'translation'];
  }

  if (normalized.includes('tts')) {
    return ['tts', 'text-to-speech', 'voice'];
  }

  if (normalized.includes('title')) {
    return ['summary', 'summar', 'title'];
  }

  if (normalized.includes('conversation')) {
    return ['conversation', 'chat'];
  }

  if (normalized.includes('assistant')) {
    return ['assistant', 'chat'];
  }

  if (normalized.includes('qa')) {
    return ['qa', 'question', 'chat'];
  }

  return [];
}

function sortModelOptions(options: ModelOption[], keywords: string[], selectedValues: string[]) {
  if (!keywords.length) {
    return options;
  }

  const selectedIndex = new Map(selectedValues.map((value, index) => [value.toLowerCase(), index]));

  return [...options].sort((left, right) => {
    const leftScore = scoreModelOption(left.value, keywords);
    const rightScore = scoreModelOption(right.value, keywords);
    if (leftScore !== rightScore) {
      return rightScore - leftScore;
    }

    const leftSelectedIndex = selectedIndex.get(left.value.toLowerCase());
    const rightSelectedIndex = selectedIndex.get(right.value.toLowerCase());
    if (leftSelectedIndex !== undefined || rightSelectedIndex !== undefined) {
      if (leftSelectedIndex === undefined) {
        return 1;
      }
      if (rightSelectedIndex === undefined) {
        return -1;
      }
      return leftSelectedIndex - rightSelectedIndex;
    }

    return left.label.localeCompare(right.label);
  });
}

function scoreModelOption(value: string, keywords: string[]) {
  const lowerValue = value.toLowerCase();
  let score = 0;

  keywords.forEach((keyword, index) => {
    const lowerKeyword = keyword.toLowerCase().trim();
    if (!lowerKeyword) {
      return;
    }
    const position = lowerValue.indexOf(lowerKeyword);
    if (position >= 0) {
      score = Math.max(score, 1000 - index * 50 - position);
    }
  });

  return score;
}
