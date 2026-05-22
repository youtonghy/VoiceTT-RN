import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { usePathname, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { PressableFeedback, Text, useThemeColor } from 'heroui-native';

import { AppIcon, type AppIconName } from '@/components/native/app-shell';

type RailItem = {
  key: 'transcription' | 'qa' | 'reading' | 'settings';
  href: '/transcription' | '/conversation-qa' | '/text-to-speech' | '/settings';
  label: string;
  icon: AppIconName;
  isActive: (pathname: string) => boolean;
};

export function SideTabRail({
  showQaTab = true,
  showReadingTab = true,
}: {
  showQaTab?: boolean;
  showReadingTab?: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const { t } = useTranslation();
  const [backgroundColor, accentColor, mutedColor, activeBackgroundColor, borderColor] = useThemeColor([
    'background',
    'accent',
    'muted',
    'surface-secondary',
    'border',
  ]);
  const items = useMemo<RailItem[]>(() => {
    const next: RailItem[] = [
      {
        key: 'transcription',
        href: '/transcription',
        label: t('navigation.tabs.transcription'),
        icon: 'wave-square',
        isActive: (path) => path === '/transcription' || path === '/' || path === '',
      },
      {
        key: 'qa',
        href: '/conversation-qa',
        label: t('navigation.tabs.qa'),
        icon: 'comments',
        isActive: (path) => path === '/conversation-qa' || path.startsWith('/conversation-qa/'),
      },
      {
        key: 'reading',
        href: '/text-to-speech',
        label: t('navigation.tabs.reading'),
        icon: 'volume-high',
        isActive: (path) => path === '/text-to-speech' || path.startsWith('/text-to-speech/'),
      },
      {
        key: 'settings',
        href: '/settings',
        label: t('navigation.tabs.settings'),
        icon: 'gear',
        isActive: (path) => path === '/settings' || path.startsWith('/settings/'),
      },
    ];

    return next.filter((item) => {
      if (item.key === 'qa') {
        return showQaTab;
      }
      if (item.key === 'reading') {
        return showReadingTab;
      }
      return true;
    });
  }, [showQaTab, showReadingTab, t]);

  return (
    <SafeAreaView style={[styles.rail, { backgroundColor, borderRightColor: borderColor }]} edges={['top', 'left', 'bottom']}>
      <View style={styles.items}>
        {items.map((item) => {
          const active = item.isActive(pathname);
          const iconColor = active ? accentColor : mutedColor;
          return (
            <PressableFeedback
              key={item.key}
              accessibilityRole="button"
              accessibilityLabel={item.label}
              onPress={() => router.replace(item.href)}
              style={[
                styles.itemPressable,
                active && { backgroundColor: activeBackgroundColor, borderColor: accentColor },
              ]}>
              <View style={styles.itemIconRow}>
                <AppIcon name={item.icon} size={20} color={iconColor} solid />
              </View>
              <Text
                type="body-xs"
                weight="bold"
                align="center"
                style={[styles.itemLabel, { color: iconColor }]}
                numberOfLines={1}>
                {item.label}
              </Text>
            </PressableFeedback>
          );
        })}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  rail: {
    width: 96,
    flexShrink: 0,
    borderRightWidth: StyleSheet.hairlineWidth,
  },
  items: {
    flex: 1,
    paddingTop: 12,
    gap: 10,
    alignItems: 'center',
  },
  itemPressable: {
    width: 78,
    paddingVertical: 10,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'transparent',
    alignItems: 'center',
    gap: 6,
  },
  itemIconRow: {
    width: 34,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemLabel: {
    fontSize: 11,
    fontWeight: '700',
    textAlign: 'center',
  },
});
