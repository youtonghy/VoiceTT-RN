import { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useColorScheme } from '@/hooks/use-color-scheme';

import { settingsStyles } from './shared';

interface SettingsEntry {
  route: `/explore/${string}`;
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

  const entryItems: SettingsEntry[] = useMemo(
    () => [
      {
        route: '/explore/recording',
        title: t('settings.sections.recording.title'),
        subtitle: t('settings.sections.recording.subtitle'),
      },
      {
        route: '/explore/transcription',
        title: t('settings.sections.transcription.title'),
        subtitle: t('settings.sections.transcription.subtitle'),
      },
      {
        route: '/explore/translation',
        title: t('settings.sections.translation.title'),
        subtitle: t('settings.sections.translation.subtitle'),
      },
      {
        route: '/explore/summary',
        title: t('settings.sections.summary.title'),
        subtitle: t('settings.sections.summary.subtitle'),
      },
      {
        route: '/explore/credentials',
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
