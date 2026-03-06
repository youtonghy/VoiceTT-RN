import Ionicons from '@expo/vector-icons/Ionicons';
import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, Linking, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useColorScheme } from '@/hooks/use-color-scheme';

import {
  CARD_SUBTLE_DARK,
  CARD_SUBTLE_LIGHT,
  CARD_TEXT_DARK,
  CARD_TEXT_LIGHT,
  SettingsCard,
  settingsStyles,
} from './shared';

const WEBSITE_URL = 'https://vtt.tokisantike.net/zh-CN/keyboard';
const REPOSITORY_URL = 'https://github.com/youtonghy/VTT-keyboard';

type LinkEntry = {
  key: 'website' | 'repository';
  url: string;
  icon: keyof typeof Ionicons.glyphMap;
};

const LINK_ENTRIES: LinkEntry[] = [
  { key: 'website', url: WEBSITE_URL, icon: 'globe-outline' },
  { key: 'repository', url: REPOSITORY_URL, icon: 'logo-github' },
];

const FEATURE_KEYS = ['global_input', 'multi_engine', 'ai_cards'] as const;

export default function KeyboardRecommendationScreen() {
  const { t } = useTranslation();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const insets = useSafeAreaInsets();

  const safeAreaStyle = [
    settingsStyles.safeArea,
    isDark ? settingsStyles.safeAreaDark : settingsStyles.safeAreaLight,
  ];

  const openExternalLink = useCallback(
    (url: string) => {
      Linking.openURL(url).catch((error) => {
        console.warn('[keyboard-promo] Failed to open link', url, error);
        Alert.alert(
          t('settings.keyboard.open_link_error_title'),
          t('settings.keyboard.open_link_error_body')
        );
      });
    },
    [t]
  );

  return (
    <SafeAreaView style={safeAreaStyle} edges={['top', 'left', 'right']}>
      <ScrollView
        contentContainerStyle={[
          settingsStyles.scrollContent,
          { paddingBottom: 32 + insets.bottom },
        ]}
        contentInsetAdjustmentBehavior="always"
        keyboardDismissMode="on-drag"
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}>
        <View style={settingsStyles.pageHeader}>
          <ThemedText
            type="title"
            style={settingsStyles.pageTitle}
            lightColor="#0f172a"
            darkColor="#e2e8f0">
            {t('settings.keyboard.title')}
          </ThemedText>
          <ThemedText
            style={styles.subtitle}
            lightColor={CARD_SUBTLE_LIGHT}
            darkColor={CARD_SUBTLE_DARK}>
            {t('settings.keyboard.subtitle')}
          </ThemedText>
        </View>

        <SettingsCard variant="system" style={styles.freeCard}>
          <View style={styles.freeCardRow}>
            <Ionicons name="shield-checkmark-outline" size={22} color={isDark ? '#86efac' : '#166534'} />
            <ThemedText
              type="subtitle"
              lightColor={CARD_TEXT_LIGHT}
              darkColor={CARD_TEXT_DARK}>
              {t('settings.keyboard.free_badge')}
            </ThemedText>
          </View>
          <ThemedText
            style={styles.freeDescription}
            lightColor={CARD_SUBTLE_LIGHT}
            darkColor={CARD_SUBTLE_DARK}>
            {t('settings.keyboard.free_description')}
          </ThemedText>
        </SettingsCard>

        <SettingsCard variant="interaction">
          <ThemedText type="subtitle" lightColor={CARD_TEXT_LIGHT} darkColor={CARD_TEXT_DARK}>
            {t('settings.keyboard.overview_title')}
          </ThemedText>
          <ThemedText
            style={styles.bodyText}
            lightColor={CARD_SUBTLE_LIGHT}
            darkColor={CARD_SUBTLE_DARK}>
            {t('settings.keyboard.overview_body')}
          </ThemedText>
        </SettingsCard>

        <SettingsCard variant="prompt">
          <ThemedText type="subtitle" lightColor={CARD_TEXT_LIGHT} darkColor={CARD_TEXT_DARK}>
            {t('settings.keyboard.features_title')}
          </ThemedText>
          <View style={styles.featureList}>
            {FEATURE_KEYS.map((featureKey) => (
              <View key={featureKey} style={styles.featureItem}>
                <View style={styles.featureIconWrap}>
                  <Ionicons
                    name={
                      featureKey === 'global_input'
                        ? 'mic-outline'
                        : featureKey === 'multi_engine'
                          ? 'layers-outline'
                          : 'sparkles-outline'
                    }
                    size={18}
                    color={isDark ? '#c4b5fd' : '#4c1d95'}
                  />
                </View>
                <View style={styles.featureTextWrap}>
                  <ThemedText
                    style={styles.featureTitle}
                    lightColor={CARD_TEXT_LIGHT}
                    darkColor={CARD_TEXT_DARK}>
                    {t(`settings.keyboard.features.${featureKey}.title`)}
                  </ThemedText>
                  <ThemedText
                    style={styles.featureBody}
                    lightColor={CARD_SUBTLE_LIGHT}
                    darkColor={CARD_SUBTLE_DARK}>
                    {t(`settings.keyboard.features.${featureKey}.body`)}
                  </ThemedText>
                </View>
              </View>
            ))}
          </View>
        </SettingsCard>

        <SettingsCard variant="openai">
          <ThemedText type="subtitle" lightColor={CARD_TEXT_LIGHT} darkColor={CARD_TEXT_DARK}>
            {t('settings.keyboard.links_title')}
          </ThemedText>
          <View style={styles.linksWrap}>
            {LINK_ENTRIES.map((entry) => (
              <Pressable
                key={entry.key}
                accessibilityRole="link"
                accessibilityLabel={t(`settings.keyboard.links.${entry.key}.label`)}
                onPress={() => openExternalLink(entry.url)}
                style={({ pressed }) => [styles.linkPressable, pressed && styles.linkPressed]}>
                <ThemedView
                  lightColor="rgba(255, 255, 255, 0.72)"
                  darkColor="rgba(15, 23, 42, 0.56)"
                  style={styles.linkCard}>
                  <View style={styles.linkIconWrap}>
                    <Ionicons name={entry.icon} size={18} color="#2563eb" />
                  </View>
                  <View style={styles.linkTextWrap}>
                    <ThemedText
                      style={styles.linkTitle}
                      lightColor={CARD_TEXT_LIGHT}
                      darkColor={CARD_TEXT_DARK}>
                      {t(`settings.keyboard.links.${entry.key}.label`)}
                    </ThemedText>
                    <ThemedText
                      style={styles.linkUrl}
                      lightColor={CARD_SUBTLE_LIGHT}
                      darkColor={CARD_SUBTLE_DARK}>
                      {entry.url}
                    </ThemedText>
                  </View>
                  <Ionicons name="open-outline" size={18} color={isDark ? '#93c5fd' : '#1d4ed8'} />
                </ThemedView>
              </Pressable>
            ))}
          </View>
        </SettingsCard>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  subtitle: {
    fontSize: 14,
    lineHeight: 21,
    maxWidth: 720,
  },
  freeCard: {
    borderColor: 'rgba(34, 197, 94, 0.28)',
  },
  freeCardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  freeDescription: {
    fontSize: 14,
    lineHeight: 20,
  },
  bodyText: {
    fontSize: 14,
    lineHeight: 22,
  },
  featureList: {
    gap: 12,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  featureIconWrap: {
    marginTop: 2,
    width: 28,
    height: 28,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(99, 102, 241, 0.12)',
  },
  featureTextWrap: {
    flex: 1,
    gap: 4,
  },
  featureTitle: {
    fontSize: 15,
    fontWeight: '700',
  },
  featureBody: {
    fontSize: 13,
    lineHeight: 20,
  },
  linksWrap: {
    gap: 10,
  },
  linkPressable: {
    borderRadius: 16,
  },
  linkPressed: {
    opacity: 0.85,
  },
  linkCard: {
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(148, 163, 184, 0.25)',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  linkIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(59, 130, 246, 0.14)',
  },
  linkTextWrap: {
    flex: 1,
    gap: 2,
  },
  linkTitle: {
    fontSize: 14,
    fontWeight: '700',
  },
  linkUrl: {
    fontSize: 12,
    lineHeight: 18,
  },
});
