import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { usePathname, useRouter, type Href } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Card, Text } from 'heroui-native';
import { Badge } from 'heroui-native-pro';

import { AppIcon } from '@/components/native/app-shell';
import { buildSettingsMenuGroups, type SettingsMenuEntry } from '@/components/settings/settings-menu';
import { getProStatus } from '@/services/pro';

type RouteHref = Extract<Href, string>;

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

  const menuGroups = useMemo(() => buildSettingsMenuGroups(t), [t]);
  const priorityLabel = t('settings.badges.core');

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
        {menuGroups.map((group) => (
          <View key={group.key} className="gap-2">
            <View className="gap-1 px-1 pt-2">
              <Text type="body-xs" weight="bold" className="uppercase text-muted">
                {group.title}
              </Text>
            </View>
            {group.entries.map((entry) => (
              <SidebarEntry
                key={entry.route}
                entry={entry}
                isActive={pathname === entry.route || pathname.startsWith(`${entry.route}/`)}
                priorityLabel={priorityLabel}
                onPress={() => router.replace(entry.route)}
              />
            ))}
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

function SidebarEntry({
  entry,
  isActive,
  priorityLabel,
  onPress,
}: {
  entry: SettingsMenuEntry;
  isActive: boolean;
  priorityLabel: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={entry.title}
      onPress={onPress}>
      <Card
        className={`border ${
          isActive
            ? 'border-accent bg-surface'
            : entry.isPriority
              ? 'border-accent/20 bg-accent/5'
              : 'border-transparent bg-surface-secondary'
        }`}>
        <Card.Body className="flex-row items-center gap-3 p-3">
          <View
            className={`size-9 items-center justify-center rounded-lg ${
              isActive ? 'bg-accent' : entry.isPriority ? 'bg-accent/15' : 'bg-surface'
            }`}>
            <AppIcon
              name={entry.icon}
              size={17}
              className={isActive ? 'text-accent-foreground' : entry.isPriority ? 'text-accent' : 'text-muted'}
            />
          </View>
          <View className="min-w-0 flex-1 gap-1">
            <View className="flex-row items-center gap-2">
              <Text type="body-sm" weight="semibold" numberOfLines={1}>
                {entry.title}
              </Text>
              {entry.isPriority ? (
                <Badge color="accent" size="sm" variant="soft">
                  <Badge.Label>{priorityLabel}</Badge.Label>
                </Badge>
              ) : null}
            </View>
            <Text type="body-xs" color="muted" numberOfLines={2}>
              {entry.subtitle}
            </Text>
          </View>
        </Card.Body>
      </Card>
    </Pressable>
  );
}
