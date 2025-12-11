import { useMemo, useCallback } from 'react';
import { Pressable, ScrollView, StyleSheet, View, Alert, Linking, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, type Href } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { LinearGradient } from 'expo-linear-gradient';
import Constants from 'expo-constants';

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
      },
      {
        key: 'repository',
        label: t('settings.about.links.repository'),
        url: REPOSITORY_URL,
        onPress: handleOpenRepository,
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
                  accessibilityLabel={`${link.label} ${link.url}`}
                  onPress={link.onPress}
                  style={({ pressed }) => [styles.aboutLinkPressable, pressed && styles.aboutLinkPressed]}>
                  <ThemedView
                    lightColor="rgba(248, 250, 252, 0.65)"
                    darkColor="rgba(15, 23, 42, 0.6)"
                    style={styles.aboutLinkCard}>
                    <ThemedText
                      style={styles.aboutLinkLabel}
                      lightColor="#0f172a"
                      darkColor="#e2e8f0">
                      {link.label}
                    </ThemedText>
                    <ThemedText type="link" style={styles.aboutLinkUrl}>
                      {link.url}
                    </ThemedText>
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
  aboutCard: {
    width: '100%',
    padding: 24,
    borderRadius: 24,
    alignItems: 'center',
    gap: 20,
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
  },
  aboutMeta: {
    gap: 2,
    alignItems: 'center',
  },
  aboutMetaText: {
    fontSize: 13,
  },
  aboutLinkPressable: {
    width: '100%',
    borderRadius: 18,
  },
  aboutLinkPressed: {
    opacity: 0.85,
  },
  aboutLinkCard: {
    width: '100%',
    paddingVertical: 14,
    paddingHorizontal: 18,
    borderRadius: 18,
    gap: 4,
  },
  aboutLinkLabel: {
    fontSize: 14,
    fontWeight: '600',
  },
  aboutLinkUrl: {
    fontSize: 14,
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
