import { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useColorScheme } from '@/hooks/use-color-scheme';

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
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const safeAreaStyle = [
    settingsStyles.safeArea,
    isDark ? settingsStyles.safeAreaDark : settingsStyles.safeAreaLight,
  ];

  const entryItems = useMemo(() => entryConfigs, []);

  return (
    <SafeAreaView style={safeAreaStyle} edges={['top', 'left', 'right']}>
      <View style={styles.container}>
        <View style={styles.header}>
          <ThemedText
            type="title"
            style={settingsStyles.pageTitle}
            lightColor="#0f172a"
            darkColor="#e2e8f0">
            设置
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
