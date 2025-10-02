import { useMemo, useCallback } from 'react';
import { Pressable, ScrollView, StyleSheet, View, Alert, Linking } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, type Href } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { LinearGradient } from 'expo-linear-gradient';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { proVersionPromoCard } from '@/types/settings';

import { settingsStyles } from './shared';

type RouteHref = Extract<Href, string>;

interface SettingsEntry {
  route: RouteHref;
  title: string;
  subtitle: string;
}

export default function SettingsIndexScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const safeAreaStyle = [
    settingsStyles.safeArea,
    isDark ? settingsStyles.safeAreaDark : settingsStyles.safeAreaLight,
  ];

  const handleOpenProCard = useCallback(() => {
    Linking.openURL(proVersionPromoCard.href).catch((error) => {
      console.warn('[settings] Failed to open Pro version URL', error);
      Alert.alert('Unable to open link', 'Please try again later.');
    });
  }, []);

  const entryItems: SettingsEntry[] = useMemo(
    () => [
      {
        route: '/explore/recording' as RouteHref,
        title: t('settings.sections.recording.title'),
        subtitle: t('settings.sections.recording.subtitle'),
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
        route: '/explore/credentials' as RouteHref,
        title: t('settings.sections.credentials.title'),
        subtitle: t('settings.sections.credentials.subtitle'),
      },
    ],
    [t]
  );

  return (
    <SafeAreaView style={safeAreaStyle} edges={['top', 'left', 'right']}>
      <View style={styles.container}>
        <View style={styles.header}>
          <ThemedText
            type="title"
            style={settingsStyles.pageTitle}
            lightColor="#0f172a"
            darkColor="#e2e8f0">
            {t('settings.page_title')}
          </ThemedText>
        </View>
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.entryList}
          style={styles.entryScroll}>
          <Pressable
            accessibilityRole="link"
            accessibilityLabel={proVersionPromoCard.title}
            onPress={handleOpenProCard}
            style={({ pressed }) => [styles.proCardPressable, pressed && styles.proCardPressed]}>
            <LinearGradient
              colors={proVersionPromoCard.gradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.proCardGradient}>
              <View style={styles.proCardGlowPrimary} pointerEvents="none" />
              <View style={styles.proCardGlowSecondary} pointerEvents="none" />
              <View style={styles.proCardContent}>
                <ThemedText
                  type="title"
                  style={styles.proCardTitle}
                  lightColor="#f8fafc"
                  darkColor="#f8fafc">
                  {proVersionPromoCard.title}
                </ThemedText>
                <ThemedText
                  style={styles.proCardSubtitle}
                  lightColor="#ecfdf5"
                  darkColor="#dcfce7">
                  {proVersionPromoCard.description}
                </ThemedText>
                <View style={styles.proCardCta}>
                  <ThemedText
                    style={styles.proCardCtaText}
                    lightColor="#ffffff"
                    darkColor="#ffffff">
                    {proVersionPromoCard.ctaLabel}
                  </ThemedText>
                </View>
              </View>
            </LinearGradient>
          </Pressable>
          {entryItems.map((entry) => (
            <Pressable
              key={entry.route}
              accessibilityRole="button"
              accessibilityLabel={entry.title}
              onPress={() => router.push(entry.route)}
              style={({ pressed }) => [styles.entryPressable, pressed && styles.entryPressed]}>
              <ThemedView
                lightColor="rgba(148, 163, 184, 0.12)"
                darkColor="rgba(15, 23, 42, 0.7)"
                style={styles.entryCard}>
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
          ))}
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  proCardPressable: {
    borderRadius: 28,
    shadowColor: '#16a34a',
    shadowOffset: { width: 0, height: 18 },
    shadowOpacity: 0.35,
    shadowRadius: 28,
    elevation: 12,
  },
  proCardPressed: {
    opacity: 0.92,
  },
  proCardGradient: {
    borderRadius: 28,
    padding: 24,
    overflow: 'hidden',
  },
  proCardGlowPrimary: {
    position: 'absolute',
    top: -60,
    right: -46,
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: proVersionPromoCard.glowColor,
    opacity: 0.95,
  },
  proCardGlowSecondary: {
    position: 'absolute',
    bottom: -72,
    left: -58,
    width: 240,
    height: 240,
    borderRadius: 120,
    backgroundColor: proVersionPromoCard.sheenColor,
    opacity: 0.8,
  },
  proCardContent: {
    gap: 14,
  },
  proCardTitle: {
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: 0.6,
  },
  proCardSubtitle: {
    fontSize: 15,
    lineHeight: 22,
    maxWidth: 320,
  },
  proCardCta: {
    marginTop: 6,
    alignSelf: 'flex-start',
    paddingHorizontal: 18,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: 'rgba(15, 23, 42, 0.32)',
    borderWidth: 1,
    borderColor: 'rgba(248, 250, 252, 0.45)',
    shadowColor: '#03160b',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 14,
  },
  proCardCtaText: {
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  container: {
    flex: 1,
    paddingTop: 16,
    gap: 20,
  },
  header: {
    paddingHorizontal: 20,
  },
  entryScroll: {
    flex: 1,
  },
  entryList: {
    paddingHorizontal: 20,
    paddingBottom: 24,
    gap: 16,
  },
  entryPressable: {
    borderRadius: 24,
    width: '100%',
  },
  entryPressed: {
    opacity: 0.85,
  },
  entryCard: {
    width: '100%',
    padding: 20,
    borderRadius: 24,
    gap: 10,
  },
  entryTitle: {
    fontSize: 22,
    fontWeight: '700',
  },
  entrySubtitle: {
    fontSize: 14,
    lineHeight: 20,
  },
});
