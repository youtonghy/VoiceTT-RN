import { useMemo, useCallback } from 'react';
import { Pressable, ScrollView, StyleSheet, View, Alert, Linking, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, type Href } from 'expo-router';
import { useTranslation } from 'react-i18next';
import Constants from 'expo-constants';
import Ionicons from '@expo/vector-icons/Ionicons';

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

const WEBSITE_URL = 'https://vtt.tokisantike.net/';
const REPOSITORY_URL = 'https://github.com/youtonghy/VoiceTT';

const aboutIconSource = require('../../../assets/images/icon.png');

export default function SettingsIndexScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const safeAreaStyle = [
    settingsStyles.safeArea,
    isDark ? settingsStyles.safeAreaDark : settingsStyles.safeAreaLight,
  ];

  const openExternalLink = useCallback((url: string) => {
    Linking.openURL(url).catch((error) => {
      console.warn('[settings] Failed to open link', url, error);
      Alert.alert('Unable to open link', 'Please try again later.');
    });
  }, []);

  const handleOpenProCard = useCallback(() => {
    openExternalLink(proVersionPromoCard.href);
  }, [openExternalLink]);

  const handleOpenWebsite = useCallback(() => {
    openExternalLink(WEBSITE_URL);
  }, [openExternalLink]);

  const handleOpenRepository = useCallback(() => {
    openExternalLink(REPOSITORY_URL);
  }, [openExternalLink]);

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

  const aboutLinks = useMemo(
    () => [
      {
        key: 'website',
        label: t('settings.about.links.website'),
        url: WEBSITE_URL,
        onPress: handleOpenWebsite,
        icon: 'globe-outline' as const,
      },
      {
        key: 'repository',
        label: t('settings.about.links.repository'),
        url: REPOSITORY_URL,
        onPress: handleOpenRepository,
        icon: 'logo-github' as const,
      },
    ],
    [handleOpenRepository, handleOpenWebsite, t]
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
            <ThemedView
              lightColor="#ffffff"
              darkColor="rgba(15, 23, 42, 0.92)"
              style={styles.proCard}>
              <View style={styles.proCardContent}>
                <ThemedText
                  type="title"
                  style={styles.proCardTitle}
                  lightColor="#0f172a"
                  darkColor="#e2e8f0">
                  {proVersionPromoCard.title}
                </ThemedText>
                <ThemedText
                  style={styles.proCardSubtitle}
                  lightColor="#475569"
                  darkColor="#cbd5e1">
                  {proVersionPromoCard.description}
                </ThemedText>
                <View style={styles.proCardCta}>
                  <ThemedText
                    style={styles.proCardCtaText}
                    lightColor="#2563eb"
                    darkColor="#93c5fd">
                    {proVersionPromoCard.ctaLabel}
                  </ThemedText>
                </View>
              </View>
            </ThemedView>
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
          <ThemedView
            lightColor="rgba(148, 163, 184, 0.12)"
            darkColor="rgba(15, 23, 42, 0.7)"
            style={styles.aboutCard}>
            <Image
              source={aboutIconSource}
              style={styles.aboutIcon}
              accessibilityLabel={t('settings.about.icon_accessibility')}
            />
            <ThemedText
              type="title"
              style={styles.aboutTitle}
              lightColor="#0f172a"
              darkColor="#e2e8f0">
              {t('settings.about.title')}
            </ThemedText>
            <View style={styles.aboutMeta}>
              {aboutMeta.map((meta) => (
                <ThemedText
                  key={meta}
                  style={styles.aboutMetaText}
                  lightColor="rgba(15, 23, 42, 0.65)"
                  darkColor="rgba(226, 232, 240, 0.7)">
                  {meta}
                </ThemedText>
              ))}
            </View>
            <View style={styles.aboutLinks}>
              {aboutLinks.map((link) => (
                <Pressable
                  key={link.key}
                  accessibilityRole="link"
                  accessibilityLabel={link.label}
                  onPress={link.onPress}
                  style={({ pressed }) => [styles.aboutLinkPressable, pressed && styles.aboutLinkPressed]}>
                  <ThemedView
                    lightColor="rgba(248, 250, 252, 0.65)"
                    darkColor="rgba(15, 23, 42, 0.6)"
                    style={styles.aboutLinkCard}>
                    <Ionicons name={link.icon} size={22} color="#2563eb" />
                  </ThemedView>
                </Pressable>
              ))}
            </View>
            <View style={styles.aboutFooter}>
              <ThemedText
                style={styles.aboutFooterText}
                lightColor="rgba(15, 23, 42, 0.55)"
                darkColor="rgba(226, 232, 240, 0.65)">
                {t('settings.about.footer.copyright')}
              </ThemedText>
              <ThemedText
                style={styles.aboutFooterText}
                lightColor="rgba(15, 23, 42, 0.55)"
                darkColor="rgba(226, 232, 240, 0.65)">
                {t('settings.about.footer.powered')}
              </ThemedText>
              <ThemedText
                style={styles.aboutFooterText}
                lightColor="rgba(15, 23, 42, 0.55)"
                darkColor="rgba(226, 232, 240, 0.65)">
                {t('settings.about.footer.location')}
              </ThemedText>
            </View>
          </ThemedView>
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  proCardPressable: {
    borderRadius: 28,
    shadowColor: 'rgba(15, 23, 42, 0.08)',
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.9,
    shadowRadius: 24,
    elevation: 6,
  },
  proCardPressed: {
    opacity: 0.94,
    transform: [{ translateY: 1 }],
  },
  proCard: {
    borderRadius: 28,
    padding: 24,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(148, 163, 184, 0.25)',
  },
  proCardContent: {
    gap: 14,
  },
  proCardTitle: {
    fontSize: 26,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  proCardSubtitle: {
    fontSize: 15,
    lineHeight: 22,
    maxWidth: 320,
  },
  proCardCta: {
    marginTop: 8,
    alignSelf: 'flex-start',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 14,
    backgroundColor: 'rgba(37, 99, 235, 0.08)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(37, 99, 235, 0.2)',
  },
  proCardCtaText: {
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.8,
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
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(148, 163, 184, 0.25)',
    shadowColor: 'rgba(15, 23, 42, 0.06)',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 1,
    shadowRadius: 18,
    elevation: 4,
  },
  entryTitle: {
    fontSize: 22,
    fontWeight: '700',
  },
  entrySubtitle: {
    fontSize: 14,
    lineHeight: 20,
  },
  aboutCard: {
    width: '100%',
    padding: 24,
    borderRadius: 24,
    alignItems: 'center',
    gap: 20,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(148, 163, 184, 0.25)',
    shadowColor: 'rgba(15, 23, 42, 0.06)',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 1,
    shadowRadius: 16,
    elevation: 4,
  },
  aboutIcon: {
    width: 72,
    height: 72,
    borderRadius: 20,
  },
  aboutTitle: {
    fontSize: 24,
    fontWeight: '700',
  },
  aboutLinks: {
    width: '100%',
    gap: 12,
    flexDirection: 'row',
    justifyContent: 'center',
  },
  aboutMeta: {
    gap: 2,
    alignItems: 'center',
  },
  aboutMetaText: {
    fontSize: 13,
  },
  aboutLinkPressable: {
    borderRadius: 18,
  },
  aboutLinkPressed: {
    opacity: 0.85,
  },
  aboutLinkCard: {
    width: 54,
    height: 54,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(148, 163, 184, 0.25)',
    shadowColor: 'rgba(15, 23, 42, 0.04)',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 1,
    shadowRadius: 12,
    elevation: 2,
  },
  aboutFooter: {
    alignItems: 'center',
    gap: 2,
  },
  aboutFooterText: {
    fontSize: 12,
    lineHeight: 18,
    textAlign: 'center',
  },
});
