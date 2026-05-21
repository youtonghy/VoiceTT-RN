import Constants from 'expo-constants';
import { useRouter, type Href } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, Image, Linking, Pressable, View } from 'react-native';
import { Card, Text } from 'heroui-native';

import { AppCard, AppIcon, AppScreen, type AppIconName } from '@/components/native/app-shell';
import { useIsTablet } from '@/hooks/use-is-tablet';
import { getProStatus } from '@/services/pro';

type RouteHref = Extract<Href, string>;

interface SettingsEntry {
  route: RouteHref;
  title: string;
  subtitle: string;
  icon: AppIconName;
}

const WEBSITE_URL = 'https://vtt.tokisantike.net/';
const REPOSITORY_URL = 'https://github.com/youtonghy/VoiceTT';
const aboutIconSource = require('../../../assets/images/icon.png');

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

  const entryItems: SettingsEntry[] = useMemo(
    () => [
      {
        route: '/settings/recording' as RouteHref,
        title: t('settings.sections.recording.title'),
        subtitle: t('settings.sections.recording.subtitle'),
        icon: 'microphone',
      },
      {
        route: '/settings/keyboard' as RouteHref,
        title: t('settings.sections.keyboard.title'),
        subtitle: t('settings.sections.keyboard.subtitle'),
        icon: 'keyboard',
      },
      {
        route: '/settings/transcription' as RouteHref,
        title: t('settings.sections.transcription.title'),
        subtitle: t('settings.sections.transcription.subtitle'),
        icon: 'wave-square',
      },
      {
        route: '/settings/translation' as RouteHref,
        title: t('settings.sections.translation.title'),
        subtitle: t('settings.sections.translation.subtitle'),
        icon: 'language',
      },
      {
        route: '/settings/export' as RouteHref,
        title: t('settings.sections.export.title'),
        subtitle: t('settings.sections.export.subtitle'),
        icon: 'file-export',
      },
      {
        route: '/settings/tts' as RouteHref,
        title: t('settings.sections.tts.title'),
        subtitle: t('settings.sections.tts.subtitle'),
        icon: 'volume-high',
      },
      {
        route: '/settings/summary' as RouteHref,
        title: t('settings.sections.summary.title'),
        subtitle: t('settings.sections.summary.subtitle'),
        icon: 'file-lines',
      },
      {
        route: '/settings/qa' as RouteHref,
        title: t('settings.sections.qa.title'),
        subtitle: t('settings.sections.qa.subtitle'),
        icon: 'circle-question',
      },
      {
        route: '/settings/appearance' as RouteHref,
        title: t('settings.sections.appearance.title'),
        subtitle: t('settings.sections.appearance.subtitle'),
        icon: 'palette',
      },
      {
        route: '/settings/credentials' as RouteHref,
        title: t('settings.sections.credentials.title'),
        subtitle: t('settings.sections.credentials.subtitle'),
        icon: 'lock',
      },
    ],
    [t]
  );

  if (isTablet) {
    return null;
  }

  return (
    <AppScreen title={t('settings.page_title')}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('settings.pro.title')}
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
      </Pressable>

      <View className="gap-3">
        {entryItems.map((entry) => (
          <Pressable
            key={entry.route}
            accessibilityRole="button"
            accessibilityLabel={entry.title}
            onPress={() => router.push(entry.route)}>
            <Card className="border border-border">
              <Card.Body className="flex-row items-center gap-3">
                <View className="size-10 items-center justify-center rounded-lg bg-surface-secondary">
                  <AppIcon name={entry.icon} size={20} className="text-accent" />
                </View>
                <View className="flex-1 gap-1">
                  <Text weight="semibold">{entry.title}</Text>
                  <Text type="body-sm" color="muted">
                    {entry.subtitle}
                  </Text>
                </View>
                <AppIcon name="chevron-right" size={18} className="text-muted" />
              </Card.Body>
            </Card>
          </Pressable>
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
            <Pressable
              accessibilityRole="link"
              accessibilityLabel={t('settings.about.links.website')}
              onPress={() => openExternalLink(WEBSITE_URL)}
              className="size-12 items-center justify-center rounded-xl bg-surface-secondary">
              <AppIcon name="globe" size={20} className="text-accent" />
            </Pressable>
            <Pressable
              accessibilityRole="link"
              accessibilityLabel={t('settings.about.links.repository')}
              onPress={() => openExternalLink(REPOSITORY_URL)}
              className="size-12 items-center justify-center rounded-xl bg-surface-secondary">
              <AppIcon name="github" size={22} className="text-accent" />
            </Pressable>
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
