import { useMemo } from 'react';
import FontAwesome6 from '@expo/vector-icons/FontAwesome6';
import { Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { usePathname, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { ThemedText } from '@/components/themed-text';

type RailIconName = 'comments' | 'gear' | 'volume-high' | 'wave-square';

type RailItem = {
  key: 'transcription' | 'qa' | 'reading' | 'settings';
  href: '/transcription' | '/conversation-qa' | '/text-to-speech' | '/settings';
  label: string;
  icon: RailIconName;
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
  const colorScheme = useColorScheme();
  const { t } = useTranslation();

  const palette = Colors[colorScheme ?? 'light'];
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
    <SafeAreaView style={[styles.rail, { backgroundColor: palette.background }]} edges={['top', 'left', 'bottom']}>
      <View style={styles.items}>
        {items.map((item) => {
          const active = item.isActive(pathname);
          const iconColor = active ? palette.tint : palette.tabIconDefault;
          return (
            <Pressable
              key={item.key}
              accessibilityRole="button"
              accessibilityLabel={item.label}
              onPress={() => router.replace(item.href)}
              style={({ pressed }) => [
                styles.itemPressable,
                active && styles.itemActive,
                pressed && styles.itemPressed,
              ]}>
              <View style={styles.itemIconRow}>
                <FontAwesome6 name={item.icon} size={20} color={iconColor} solid />
              </View>
              <ThemedText
                style={[styles.itemLabel, { color: iconColor }]}
                numberOfLines={1}>
                {item.label}
              </ThemedText>
            </Pressable>
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
    borderRightColor: 'rgba(148, 163, 184, 0.25)',
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
    alignItems: 'center',
    gap: 6,
  },
  itemActive: {
    backgroundColor: 'rgba(37, 99, 235, 0.10)',
  },
  itemPressed: {
    opacity: 0.85,
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
