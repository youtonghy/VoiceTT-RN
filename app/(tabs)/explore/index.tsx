import { useMemo } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Card, Text, useTheme } from 'react-native-paper';

import { settingsStyles } from './shared';

interface SettingsEntry {
  route: `/explore/${string}`;
  title: string;
  subtitle: string;
}

export default function SettingsIndexScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const theme = useTheme();

  const safeAreaStyle = useMemo(
    () => [settingsStyles.safeArea, { backgroundColor: theme.colors.background }],
    [theme.colors.background]
  );

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
        <View style={settingsStyles.pageHeader}>
          <Text variant="headlineSmall">{t('settings.page_title')}</Text>
        </View>
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.entryList}
          style={styles.entryScroll}
        >
          {entryItems.map((entry) => (
            <Card
              key={entry.route}
              mode="elevated"
              onPress={() => router.push(entry.route)}
              style={styles.entryCard}
              accessible
              accessibilityRole="button"
              accessibilityLabel={entry.title}
            >
              <Card.Content style={styles.cardContent}>
                <Text variant="titleMedium">{entry.title}</Text>
                <Text variant="bodyMedium" style={styles.entrySubtitle}>
                  {entry.subtitle}
                </Text>
              </Card.Content>
            </Card>
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
  entryScroll: {
    flex: 1,
  },
  entryList: {
    paddingHorizontal: 20,
    paddingBottom: 24,
    gap: 16,
  },
  entryCard: {
    borderRadius: 20,
  },
  cardContent: {
    gap: 8,
  },
  entrySubtitle: {
    opacity: 0.78,
  },
});
