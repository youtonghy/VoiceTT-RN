import { useMemo } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
<<<<<<< HEAD
import { useTranslation } from 'react-i18next';
import { Card, Text, useTheme } from 'react-native-paper';
=======

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useColorScheme } from '@/hooks/use-color-scheme';
>>>>>>> parent of e9751a1 (Add i18n support and localize UI text)

import { settingsStyles } from './shared';

const entryConfigs = [
  {
    route: '/explore/recording' as const,
    title: '录音检测',
    subtitle: '灵敏度与静音判定',
  },
  {
    route: '/explore/transcription' as const,
    title: '转写设置',
    subtitle: '引擎与源语言',
  },
  {
    route: '/explore/translation' as const,
    title: '翻译设置',
    subtitle: '译文开关与管线',
  },
  {
    route: '/explore/summary' as const,
    title: '总结设置',
    subtitle: '标题引擎与提示词',
  },
  {
    route: '/explore/credentials' as const,
    title: '凭据',
    subtitle: '管理模型密钥',
  },
];

export default function SettingsIndexScreen() {
  const router = useRouter();
<<<<<<< HEAD
  const { t } = useTranslation();
  const theme = useTheme();

  const safeAreaStyle = useMemo(
    () => [settingsStyles.safeArea, { backgroundColor: theme.colors.background }],
    [theme.colors.background]
  );
=======
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const safeAreaStyle = [
    settingsStyles.safeArea,
    isDark ? settingsStyles.safeAreaDark : settingsStyles.safeAreaLight,
  ];
>>>>>>> parent of e9751a1 (Add i18n support and localize UI text)

  const entryItems = useMemo(() => entryConfigs, []);

  return (
    <SafeAreaView style={safeAreaStyle} edges={['top', 'left', 'right']}>
      <View style={styles.container}>
<<<<<<< HEAD
        <View style={settingsStyles.pageHeader}>
          <Text variant="headlineSmall">{t('settings.page_title')}</Text>
=======
        <View style={styles.header}>
          <ThemedText
            type="title"
            style={settingsStyles.pageTitle}
            lightColor="#0f172a"
            darkColor="#e2e8f0">
            设置
          </ThemedText>
>>>>>>> parent of e9751a1 (Add i18n support and localize UI text)
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
