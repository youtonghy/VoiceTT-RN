import { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { usePathname, useRouter, type Href } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { settingsStyles } from '@/app/(tabs)/explore/shared';

type RouteHref = Extract<Href, string>;

type SettingsEntry = {
  route: RouteHref;
  title: string;
  subtitle: string;
};

export function SettingsSidebar() {
  const router = useRouter();
  const pathname = usePathname();
  const { t } = useTranslation();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const { width } = useWindowDimensions();

  const sidebarWidth = Math.min(320, Math.max(240, Math.round(width * 0.28)));

  const entries: SettingsEntry[] = useMemo(
    () => [
      {
        route: '/explore/recording' as RouteHref,
        title: t('settings.sections.recording.title'),
        subtitle: t('settings.sections.recording.subtitle'),
      },
      {
        route: '/explore/voice-input' as RouteHref,
        title: t('settings.sections.voice_input.title'),
        subtitle: t('settings.sections.voice_input.subtitle'),
      },
      {
        route: '/explore/transcription' as RouteHref,
        title: t('settings.sections.transcription.title'),
        subtitle: t('settings.sections.transcription.subtitle'),
      },
      {
        route: '/explore/translation' as RouteHref,
        title: t('settings.sections.translation.title'),
        subtitle: t('settings.sections.translation.subtitle'),
      },
      {
        route: '/explore/tts' as RouteHref,
        title: t('settings.sections.tts.title'),
        subtitle: t('settings.sections.tts.subtitle'),
      },
      {
        route: '/explore/summary' as RouteHref,
        title: t('settings.sections.summary.title'),
        subtitle: t('settings.sections.summary.subtitle'),
      },
      {
        route: '/explore/qa' as RouteHref,
        title: t('settings.sections.qa.title'),
        subtitle: t('settings.sections.qa.subtitle'),
      },
      {
        route: '/explore/appearance' as RouteHref,
        title: t('settings.sections.appearance.title'),
        subtitle: t('settings.sections.appearance.subtitle'),
      },
      {
        route: '/explore/credentials' as RouteHref,
        title: t('settings.sections.credentials.title'),
        subtitle: t('settings.sections.credentials.subtitle'),
      },
    ],
    [t]
  );

  return (
    <SafeAreaView
      style={[
        styles.safeArea,
        { width: sidebarWidth },
        isDark ? settingsStyles.safeAreaDark : settingsStyles.safeAreaLight,
      ]}
      edges={['top', 'left', 'bottom']}>
      <View style={styles.header}>
        <ThemedText
          type="title"
          style={styles.headerTitle}
          lightColor="#0f172a"
          darkColor="#e2e8f0">
          {t('settings.page_title')}
        </ThemedText>
      </View>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.list}>
        {entries.map((entry) => {
          const active = pathname === entry.route || pathname.startsWith(`${entry.route}/`);
          return (
            <Pressable
              key={entry.route}
              accessibilityRole="button"
              accessibilityLabel={entry.title}
              onPress={() => router.replace(entry.route)}
              style={({ pressed }) => [
                styles.entryPressable,
                pressed && styles.entryPressed,
              ]}>
              <ThemedView
                lightColor={active ? 'rgba(37, 99, 235, 0.12)' : 'rgba(148, 163, 184, 0.12)'}
                darkColor={active ? 'rgba(37, 99, 235, 0.25)' : 'rgba(15, 23, 42, 0.7)'}
                style={[styles.entryCard, active && styles.entryCardActive]}>
                <ThemedText
                  type="title"
                  style={styles.entryTitle}
                  lightColor="#0f172a"
                  darkColor="#e2e8f0">
                  {entry.title}
                </ThemedText>
                <ThemedText
                  style={styles.entrySubtitle}
                  lightColor="#475569"
                  darkColor="#94a3b8">
                  {entry.subtitle}
                </ThemedText>
              </ThemedView>
            </Pressable>
          );
        })}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flexShrink: 0,
    borderRightWidth: StyleSheet.hairlineWidth,
    borderRightColor: 'rgba(148, 163, 184, 0.25)',
  },
  header: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '800',
  },
  list: {
    paddingHorizontal: 12,
    paddingBottom: 24,
    gap: 10,
  },
  entryPressable: {
    borderRadius: 18,
  },
  entryPressed: {
    opacity: 0.85,
  },
  entryCard: {
    padding: 14,
    borderRadius: 18,
    gap: 4,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(148, 163, 184, 0.25)',
  },
  entryCardActive: {
    borderColor: 'rgba(37, 99, 235, 0.45)',
  },
  entryTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  entrySubtitle: {
    fontSize: 12,
    lineHeight: 16,
  },
});
