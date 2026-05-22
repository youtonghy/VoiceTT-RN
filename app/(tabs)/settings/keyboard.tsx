import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, Linking, View } from 'react-native';
import { Text } from 'heroui-native';

import { ActionCard, AppCard, AppIcon, AppScreen, type AppIconName } from '@/components/native/app-shell';

const WEBSITE_URL = 'https://vtt.tokisantike.net/zh-CN/keyboard';
const REPOSITORY_URL = 'https://github.com/youtonghy/VTT-keyboard';

type LinkEntry = {
  key: 'website' | 'repository';
  url: string;
  icon: AppIconName;
};

const LINK_ENTRIES: LinkEntry[] = [
  { key: 'website', url: WEBSITE_URL, icon: 'globe' },
  { key: 'repository', url: REPOSITORY_URL, icon: 'github' },
];

const FEATURE_ENTRIES: { key: 'global_input' | 'multi_engine' | 'ai_cards'; icon: AppIconName }[] = [
  { key: 'global_input', icon: 'microphone' },
  { key: 'multi_engine', icon: 'layer-group' },
  { key: 'ai_cards', icon: 'wand-magic-sparkles' },
];

export default function KeyboardRecommendationScreen() {
  const { t } = useTranslation();

  const openExternalLink = useCallback(
    (url: string) => {
      Linking.openURL(url).catch((error) => {
        console.warn('[keyboard-promo] Failed to open link', url, error);
        Alert.alert(
          t('settings.keyboard.open_link_error_title'),
          t('settings.keyboard.open_link_error_body')
        );
      });
    },
    [t]
  );

  return (
    <AppScreen title={t('settings.keyboard.title')} subtitle={t('settings.keyboard.subtitle')}>
      <AppCard
        className="border-success/30 bg-success/10"
        icon="shield-halved"
        title={t('settings.keyboard.free_badge')}
        subtitle={t('settings.keyboard.free_description')}
      />

      <AppCard icon="keyboard" title={t('settings.keyboard.overview_title')}>
        <Text type="body-sm" color="muted">
          {t('settings.keyboard.overview_body')}
        </Text>
      </AppCard>

      <AppCard icon="wand-magic-sparkles" title={t('settings.keyboard.features_title')}>
        <View className="gap-3">
          {FEATURE_ENTRIES.map((feature) => (
            <View key={feature.key} className="flex-row items-start gap-3 rounded-xl bg-surface-secondary p-3">
              <View className="size-9 items-center justify-center rounded-lg bg-surface">
                <AppIcon name={feature.icon} size={16} className="text-accent" />
              </View>
              <View className="min-w-0 flex-1 gap-1">
                <Text weight="semibold">
                  {t(`settings.keyboard.features.${feature.key}.title`)}
                </Text>
                <Text type="body-sm" color="muted">
                  {t(`settings.keyboard.features.${feature.key}.body`)}
                </Text>
              </View>
            </View>
          ))}
        </View>
      </AppCard>

      <AppCard icon="globe" title={t('settings.keyboard.links_title')}>
        <View className="gap-2">
          {LINK_ENTRIES.map((entry) => (
            <ActionCard
              key={entry.key}
              accessibilityRole="link"
              icon={entry.icon}
              title={t(`settings.keyboard.links.${entry.key}.label`)}
              subtitle={entry.url}
              onPress={() => openExternalLink(entry.url)}
              className="bg-surface-secondary"
            />
          ))}
        </View>
      </AppCard>
    </AppScreen>
  );
}
