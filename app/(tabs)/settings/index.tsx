import Constants from 'expo-constants';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, Image, Linking, View } from 'react-native';
import { Button, PressableFeedback, Text } from 'heroui-native';

import { ActionCard, AppCard, AppIcon, AppScreen } from '@/components/native/app-shell';
import { buildSettingsMenuGroups, type RouteHref, type SettingsMenuEntry } from '@/components/settings/settings-menu';
import { useIsTablet } from '@/hooks/use-is-tablet';
import { getProStatus } from '@/services/pro';

const WEBSITE_URL = 'https://vtt.tokisantike.net/';
const REPOSITORY_URL = 'https://github.com/youtonghy/VoiceTT';
const aboutIconSource = require('../../../assets/images/icon.png');

function SettingsEntryCard({
  entry,
  priorityLabel,
  onPress,
}: {
  entry: SettingsMenuEntry;
  priorityLabel: string;
  onPress: () => void;
}) {
  return (
    <ActionCard
      title={entry.title}
      subtitle={entry.subtitle}
      icon={entry.icon}
      onPress={onPress}
      className={entry.isPriority ? 'border-accent/40 bg-accent/5' : ''}
      badge={
        entry.isPriority ? (
          <View className="rounded-full bg-accent/10 px-2 py-0.5">
            <Text type="body-xs" weight="bold" className="text-accent">
              {priorityLabel}
            </Text>
          </View>
        ) : null
      }
    />
  );
}

export default function SettingsIndexScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const isTablet = useIsTablet();
  const [isPro, setIsPro] = useState(false);

  useEffect(() => {
    if (isTablet) {
      router.replace('/settings/recording');
    }
  }, [isTablet, router]);

  const openExternalLink = useCallback((url: string) => {
    Linking.openURL(url).catch((error) => {
      console.warn('[settings] Failed to open link', url, error);
      Alert.alert('Unable to open link', 'Please try again later.');
    });
  }, []);

  useEffect(() => {
    let isActive = true;
    getProStatus()
      .then((status) => {
        if (isActive) {
          setIsPro(status.isActive);
        }
      })
      .catch((error) => {
        console.error('[settings] Failed to load pro status', error);
      });
    return () => {
      isActive = false;
    };
  }, []);

  const appVersion = Constants.expoConfig?.version ?? Constants.nativeAppVersion ?? 'dev';
  const buildVersion =
    Constants.nativeBuildVersion ??
    Constants.expoConfig?.ios?.buildNumber ??
    (Constants.expoConfig?.android?.versionCode
      ? String(Constants.expoConfig?.android?.versionCode)
      : undefined);

  const aboutMeta = useMemo(() => {
    const versionText = t('settings.about.meta.version', { version: appVersion });
    const buildText = buildVersion ? t('settings.about.meta.build', { build: buildVersion }) : null;
    return [versionText, buildText].filter(Boolean) as string[];
  }, [appVersion, buildVersion, t]);

  const menuGroups = useMemo(() => buildSettingsMenuGroups(t), [t]);
  const priorityLabel = t('settings.badges.core');

  if (isTablet) {
    return null;
  }

  return (
    <AppScreen title={t('settings.page_title')}>
      <PressableFeedback
        accessibilityRole="button"
        accessibilityLabel={t('settings.pro.title')}
        className="rounded-2xl"
        onPress={() => router.push('/settings/pro' as RouteHref)}>
        <AppCard
          className={isPro ? 'bg-warning/15' : 'bg-success/15'}
          icon={isPro ? 'shield-halved' : 'wand-magic-sparkles'}
          title={t('settings.pro.title')}
          subtitle={t('settings.pro.description')}>
          {!isPro ? (
            <View className="self-start rounded-lg border border-success/40 bg-success/10 px-3 py-2">
              <Text type="body-xs" weight="bold" className="text-success">
                {t('settings.pro.cta')}
              </Text>
            </View>
          ) : null}
        </AppCard>
      </PressableFeedback>

      <View className="gap-5">
        {menuGroups.map((group) => (
          <View key={group.key} className="gap-3">
            <View className="gap-1 px-1">
              <Text type="body-sm" weight="bold" className="uppercase text-muted">
                {group.title}
              </Text>
              <Text type="body-xs" color="muted">
                {group.subtitle}
              </Text>
            </View>
            <View className="gap-2">
              {group.entries.map((entry) => (
                <SettingsEntryCard
                  key={entry.route}
                  entry={entry}
                  priorityLabel={priorityLabel}
                  onPress={() => router.push(entry.route)}
                />
              ))}
            </View>
          </View>
        ))}
      </View>

      <AppCard title={t('settings.about.title')}>
        <View className="items-center gap-3">
          <Image
            source={aboutIconSource}
            className="size-16 rounded-2xl"
            accessibilityLabel={t('settings.about.icon_accessibility')}
          />
          <View className="items-center gap-1">
            {aboutMeta.map((meta) => (
              <Text key={meta} type="body-sm" color="muted">
                {meta}
              </Text>
            ))}
          </View>
          <View className="flex-row gap-3">
            <Button
              accessibilityRole="link"
              accessibilityLabel={t('settings.about.links.website')}
              isIconOnly
              onPress={() => openExternalLink(WEBSITE_URL)}
              size="lg"
              variant="secondary">
              <AppIcon name="globe" size={20} className="text-accent" />
            </Button>
            <Button
              accessibilityRole="link"
              accessibilityLabel={t('settings.about.links.repository')}
              isIconOnly
              onPress={() => openExternalLink(REPOSITORY_URL)}
              size="lg"
              variant="secondary">
              <AppIcon name="github" size={22} className="text-accent" />
            </Button>
          </View>
          <View className="items-center gap-1">
            <Text type="body-xs" color="muted" align="center">
              {t('settings.about.footer.copyright')}
            </Text>
            <Text type="body-xs" color="muted" align="center">
              {t('settings.about.footer.powered')}
            </Text>
            <Text type="body-xs" color="muted" align="center">
              {t('settings.about.footer.location')}
            </Text>
          </View>
        </View>
      </AppCard>
    </AppScreen>
  );
}
