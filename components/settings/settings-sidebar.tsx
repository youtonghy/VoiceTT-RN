import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { usePathname, useRouter, type Href } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Card, Text } from 'heroui-native';

import { AppIcon, type AppIconName } from '@/components/native/app-shell';
import { getProStatus } from '@/services/pro';

type RouteHref = Extract<Href, string>;

type SettingsEntry = {
  route: RouteHref;
  title: string;
  subtitle: string;
  icon: AppIconName;
};

export function SettingsSidebar() {
  const router = useRouter();
  const pathname = usePathname();
  const { t } = useTranslation();
  const { width } = useWindowDimensions();
  const [isPro, setIsPro] = useState(false);

  const sidebarWidth = Math.min(320, Math.max(248, Math.round(width * 0.28)));
  const isProRoute = pathname === '/settings/pro' || pathname.startsWith('/settings/pro/');

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
  }, [pathname]);

  const entries: SettingsEntry[] = useMemo(
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

  return (
    <SafeAreaView
      className="flex-shrink-0 border-r border-border bg-background"
      style={{ width: sidebarWidth }}
      edges={['top', 'left', 'bottom']}>
      <View className="px-4 pb-3 pt-4">
        <Text.Heading type="h2">{t('settings.page_title')}</Text.Heading>
      </View>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerClassName="gap-2 px-3 pb-6">
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('settings.pro.title')}
          onPress={() => router.replace('/settings/pro' as RouteHref)}>
          <Card className={`border ${isProRoute ? 'border-accent' : 'border-border'} ${isPro ? 'bg-warning/15' : 'bg-success/15'}`}>
            <Card.Body className="gap-2">
              <Text weight="bold">{t('settings.pro.title')}</Text>
              <Text type="body-xs" color="muted">
                {t('settings.pro.description')}
              </Text>
              {!isPro ? (
                <View className="self-start rounded-lg bg-success/10 px-2 py-1">
                  <Text type="body-xs" weight="bold" className="text-success">
                    {t('settings.pro.cta')}
                  </Text>
                </View>
              ) : null}
            </Card.Body>
          </Card>
        </Pressable>
        {entries.map((entry) => {
          const active = pathname === entry.route || pathname.startsWith(`${entry.route}/`);
          return (
            <Pressable
              key={entry.route}
              accessibilityRole="button"
              accessibilityLabel={entry.title}
              onPress={() => router.replace(entry.route)}>
              <Card className={`border ${active ? 'border-accent bg-surface' : 'border-transparent bg-surface-secondary'}`}>
                <Card.Body className="flex-row items-center gap-3 p-3">
                  <AppIcon name={entry.icon} size={18} className={active ? 'text-accent' : 'text-muted'} />
                  <View className="flex-1 gap-1">
                    <Text type="body-sm" weight="semibold">
                      {entry.title}
                    </Text>
                    <Text type="body-xs" color="muted" numberOfLines={2}>
                      {entry.subtitle}
                    </Text>
                  </View>
                </Card.Body>
              </Card>
            </Pressable>
          );
        })}
      </ScrollView>
    </SafeAreaView>
  );
}
