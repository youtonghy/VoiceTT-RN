import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { usePathname, useRouter, type Href } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { settingsStyles } from '@/app/(tabs)/settings/shared';
import { getProStatus } from '@/services/pro';

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
  const [isPro, setIsPro] = useState(false);

  const sidebarWidth = Math.min(320, Math.max(240, Math.round(width * 0.28)));
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
      },
      {
        route: '/settings/keyboard' as RouteHref,
        title: t('settings.sections.keyboard.title'),
        subtitle: t('settings.sections.keyboard.subtitle'),
      },
      {
        route: '/settings/transcription' as RouteHref,
        title: t('settings.sections.transcription.title'),
        subtitle: t('settings.sections.transcription.subtitle'),
      },
      {
        route: '/settings/translation' as RouteHref,
        title: t('settings.sections.translation.title'),
        subtitle: t('settings.sections.translation.subtitle'),
      },
      {
        route: '/settings/export' as RouteHref,
        title: t('settings.sections.export.title'),
        subtitle: t('settings.sections.export.subtitle'),
      },
      {
        route: '/settings/tts' as RouteHref,
        title: t('settings.sections.tts.title'),
        subtitle: t('settings.sections.tts.subtitle'),
      },
      {
        route: '/settings/summary' as RouteHref,
        title: t('settings.sections.summary.title'),
        subtitle: t('settings.sections.summary.subtitle'),
      },
      {
        route: '/settings/qa' as RouteHref,
        title: t('settings.sections.qa.title'),
        subtitle: t('settings.sections.qa.subtitle'),
      },
      {
        route: '/settings/appearance' as RouteHref,
        title: t('settings.sections.appearance.title'),
        subtitle: t('settings.sections.appearance.subtitle'),
      },
      {
        route: '/settings/credentials' as RouteHref,
        title: t('settings.sections.credentials.title'),
        subtitle: t('settings.sections.credentials.subtitle'),
      },
    ],
    [t]
  );

  const proCardTheme = isPro
    ? {
        background: isDark ? '#5c4512' : '#fef3c7',
        border: isDark ? 'rgba(245, 158, 11, 0.4)' : 'rgba(202, 138, 4, 0.45)',
        shadow: isDark ? 'rgba(245, 158, 11, 0.35)' : 'rgba(217, 119, 6, 0.3)',
      }
    : {
        background: isDark ? '#064e3b' : '#dcfce7',
        border: isDark ? 'rgba(16, 185, 129, 0.4)' : 'rgba(34, 197, 94, 0.35)',
        shadow: isDark ? 'rgba(16, 185, 129, 0.35)' : 'rgba(34, 197, 94, 0.3)',
      };
  const proCtaTheme = {
    background: isDark ? 'rgba(16, 185, 129, 0.2)' : 'rgba(22, 163, 74, 0.12)',
    border: isDark ? 'rgba(16, 185, 129, 0.45)' : 'rgba(22, 163, 74, 0.35)',
  };

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
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('settings.pro.title')}
          onPress={() => router.replace('/settings/pro' as RouteHref)}
          style={({ pressed }) => [
            styles.proCardPressable,
            { shadowColor: proCardTheme.shadow },
            pressed && styles.proCardPressed,
          ]}>
          <ThemedView
            style={[
              styles.proCard,
              { backgroundColor: proCardTheme.background, borderColor: proCardTheme.border },
              isProRoute && styles.proCardActive,
            ]}>
            <View style={styles.proCardContent}>
              <ThemedText
                type="title"
                style={styles.proCardTitle}
                lightColor="#0f172a"
                darkColor="#e2e8f0">
                {t('settings.pro.title')}
              </ThemedText>
              <ThemedText
                style={styles.proCardSubtitle}
                lightColor="#475569"
                darkColor="#cbd5e1">
                {t('settings.pro.description')}
              </ThemedText>
              {!isPro ? (
                <View
                  style={[
                    styles.proCardCta,
                    { backgroundColor: proCtaTheme.background, borderColor: proCtaTheme.border },
                  ]}>
                  <ThemedText
                    style={styles.proCardCtaText}
                    lightColor="#166534"
                    darkColor="#bbf7d0">
                    {t('settings.pro.cta')}
                  </ThemedText>
                </View>
              ) : null}
            </View>
          </ThemedView>
        </Pressable>
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
  proCardPressable: {
    borderRadius: 20,
    shadowColor: 'rgba(15, 23, 42, 0.08)',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.9,
    shadowRadius: 18,
    elevation: 4,
  },
  proCardPressed: {
    opacity: 0.94,
    transform: [{ translateY: 1 }],
  },
  proCard: {
    borderRadius: 20,
    padding: 16,
    borderWidth: StyleSheet.hairlineWidth,
  },
  proCardActive: {
    borderColor: 'rgba(37, 99, 235, 0.45)',
  },
  proCardContent: {
    gap: 10,
  },
  proCardTitle: {
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  proCardSubtitle: {
    fontSize: 12,
    lineHeight: 16,
  },
  proCardCta: {
    marginTop: 4,
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
  },
  proCardCtaText: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
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
