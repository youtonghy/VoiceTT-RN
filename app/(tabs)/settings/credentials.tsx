import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  View,
} from 'react-native';
import { AppScreen, FormInput, type AppIconName } from '@/components/native/app-shell';
import {
  SettingsModelDetailCard,
  SettingsModelProviderStrip,
  type SettingsModelProviderItem,
} from '@/components/settings/model-picker';
import { useSettings } from '@/contexts/settings-context';
import { DEFAULT_OPENAI_BASE_URL } from '@/services/transcription';
import type { EngineCredentials } from '@/types/settings';

import { useSettingsForm } from '@/components/settings/settings-form';

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

type CredentialProvider = SettingsModelProviderItem<CredentialProviderId> & {
  fields: CredentialField[];
};

type CredentialField = {
  id: EditableCredentialKey;
  label: string;
  value: string;
  placeholder: string;
  secureTextEntry?: boolean;
  normalize?: (text: string) => string | undefined;
};

const PROVIDER_FALLBACK_ICON_MAP: Record<CredentialProviderId, AppIconName> = {
  openai: 'robot',
  gemini: 'gem',
  soniox: 'wave-square',
  qwen: 'server',
  glm: 'cloud-arrow-up',
  doubao: 'key',
};

const normalizeSecret = (text: string) => text.trim() || undefined;
const normalizeOpenAIBaseUrl = (text: string) => text.trim().replace(/\/+$/, '') || DEFAULT_OPENAI_BASE_URL;

export default function CredentialSettingsScreen() {
  const { t } = useTranslation();
  const { settings, updateCredentials } = useSettings();
  const { formState, setFormState } = useSettingsForm(settings);
  const [activeProviderId, setActiveProviderId] = useState<CredentialProviderId>('openai');

  const providers = useMemo<CredentialProvider[]>(
    () => [
      {
        id: 'openai',
        title: t('settings.credentials.sections.openai.title'),
        fallbackIcon: PROVIDER_FALLBACK_ICON_MAP.openai,
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
      },
      {
        id: 'gemini',
        title: t('settings.credentials.sections.gemini.title'),
        fallbackIcon: PROVIDER_FALLBACK_ICON_MAP.gemini,
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
      },
      {
        id: 'soniox',
        title: t('settings.credentials.sections.soniox.title'),
        fallbackIcon: PROVIDER_FALLBACK_ICON_MAP.soniox,
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
      },
      {
        id: 'qwen',
        title: t('settings.credentials.sections.qwen.title'),
        fallbackIcon: PROVIDER_FALLBACK_ICON_MAP.qwen,
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
      },
      {
        id: 'glm',
        title: t('settings.credentials.sections.glm.title'),
        fallbackIcon: PROVIDER_FALLBACK_ICON_MAP.glm,
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
      },
      {
        id: 'doubao',
        title: t('settings.credentials.sections.doubao.title'),
        fallbackIcon: PROVIDER_FALLBACK_ICON_MAP.doubao,
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
      },
    ],
    [formState, t]
  );

  const activeProvider = providers.find((provider) => provider.id === activeProviderId) ?? providers[0];

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

  return (
    <AppScreen contentBottomInset={0} contentTopInset={0} edges={['left', 'right']} scroll={false}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        className="min-h-0 flex-1">
        <View className="min-h-0 flex-1 gap-4">
          <SettingsModelProviderStrip
            providers={providers}
            activeId={activeProvider.id}
            onSelect={setActiveProviderId}
          />

          <ScrollView
            showsVerticalScrollIndicator={false}
            keyboardDismissMode="on-drag"
            keyboardShouldPersistTaps="handled"
            className="min-h-0 flex-1"
            contentContainerClassName="gap-4 pb-6"
            contentInsetAdjustmentBehavior="never">
            <SettingsModelDetailCard
              title={activeProvider.title}
              description={t('settings.credentials.models.credentials_only')}
              fallbackIcon={activeProvider.fallbackIcon}>
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
            </SettingsModelDetailCard>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </AppScreen>
  );
}
