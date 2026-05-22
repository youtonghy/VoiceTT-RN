import { ModelProvider } from '@lobehub/icons-rn';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button, Spinner, Switch, Text } from 'heroui-native';

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
  SettingsCard,
  formatNumberInput,
  settingsStyles,
  useSettingsForm,
} from './shared';

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
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const insets = useSafeAreaInsets();
  const [languageModalVisible, setLanguageModalVisible] = useState(false);
  const safeAreaStyle = [
    settingsStyles.safeArea,
    isDark ? settingsStyles.safeAreaDark : settingsStyles.safeAreaLight,
  ];
  const baseInputStyle = [settingsStyles.input, isDark ? settingsStyles.inputDark : null];
  const multilineInputStyle = [
    settingsStyles.input,
    styles.promptInput,
    isDark ? settingsStyles.inputDark : null,
    isDark ? styles.promptInputDark : null,
  ];
  const placeholderTextColor = isDark ? '#94a3b8' : '#64748b';
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
          <SettingsCard>
            <View className="flex-row items-center justify-between gap-4">
              <View className="min-w-0 flex-1 gap-1">
                <Text type="body-sm" weight="semibold">
                  {t('settings.translation.labels.enable_translation')}
                </Text>
                <Text type="body-xs" color="muted">
                  {selectedTargetLanguageLabel}
                </Text>
              </View>
              <Switch
                isSelected={settings.enableTranslation}
                onSelectedChange={(next) => updateSettings({ enableTranslation: next })}
              />
            </View>

            <Pressable
              accessibilityRole="button"
              accessibilityState={{
                disabled: !settings.enableTranslation || settings.translationEngine === 'none',
              }}
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
                <Text type="body-sm" weight="semibold">
                  {t('settings.translation.labels.target_language')}
                </Text>
                <View className="min-w-0 flex-1 flex-row items-center justify-end gap-2">
                  <Text type="body-sm" color="muted" numberOfLines={1}>
                    {selectedTargetLanguageLabel}
                  </Text>
                  <AppIcon name="chevron-right" size={13} className="text-muted" />
                </View>
              </View>
            </Pressable>
          </SettingsCard>

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
              <View style={styles.fieldGroup}>
                <Text type="body-sm" weight="semibold">
                  {t('settings.translation.labels.temperature')}
                </Text>
                <TextInput
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
                  style={baseInputStyle}
                  placeholder={`${DEFAULT_OPENAI_TRANSLATION_TEMPERATURE}`}
                  placeholderTextColor={placeholderTextColor}
                />
              </View>
            ) : null}

            {activeProvider.promptLabel && activeProvider.promptValue !== undefined ? (
              <View style={styles.fieldGroup}>
                <Text type="body-sm" weight="semibold">
                  {activeProvider.promptLabel}
                </Text>
                <TextInput
                  value={activeProvider.promptValue}
                  onChangeText={activeProvider.onPromptChange}
                  onBlur={activeProvider.onPromptBlur}
                  editable={!isModelDisabled}
                  style={multilineInputStyle}
                  placeholder={activeProvider.promptPlaceholder}
                  placeholderTextColor={placeholderTextColor}
                  multiline
                  textAlignVertical="top"
                />
                {activeProvider.promptHint ? (
                  <Text type="body-xs" color="muted">
                    {activeProvider.promptHint}
                  </Text>
                ) : null}
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
            ) : null}
          </SettingsModelDetailCard>
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
            <Text.Heading type="h3">
              {t('settings.translation.labels.select_language')}
            </Text.Heading>
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
                    <Text type="body-sm" weight={active ? 'semibold' : undefined}>
                      {t(language.i18nKey)}
                    </Text>
                    {active ? <AppIcon name="toggle-on" size={16} className="text-accent" /> : null}
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
  promptInput: {
    minHeight: 120,
    paddingTop: 12,
    paddingBottom: 12,
  },
  promptInputDark: {
    color: '#e2e8f0',
  },
  fieldGroup: {
    gap: 8,
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
    gap: 12,
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
});
