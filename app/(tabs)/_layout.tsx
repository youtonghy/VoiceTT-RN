/**
 * 页面名称：标签页布局 (Tabs Layout)
 * 文件路径：app/(tabs)/_layout.tsx
 * 功能描述：配置主界面的标签页导航，支持手机端的底部标签栏和平板端的侧边导航栏。
 */

import { Stack, Tabs } from 'expo-router';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { HapticTab } from '@/components/haptic-tab';
import { SideTabRail } from '@/components/side-tab-rail';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useIsTablet } from '@/hooks/use-is-tablet';

export default function TabLayout() {
  const colorScheme = useColorScheme();
  const { t } = useTranslation();
  const isTablet = useIsTablet();

  // 标签页标题国际化
  const tabs = {
    transcription: t('navigation.tabs.transcription'),
    qa: t('navigation.tabs.qa'),
    reading: t('navigation.tabs.reading'),
    settings: t('navigation.tabs.settings'),
  };

  // 平板端布局：侧边栏 + 堆栈导航
  if (isTablet) {
    return (
      <View style={styles.tabletRoot}>
        <SideTabRail />
        <View style={styles.tabletContent}>
          <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="index" />
            <Stack.Screen name="qa" />
            <Stack.Screen name="reading" />
            <Stack.Screen name="explore" />
          </Stack>
        </View>
      </View>
    );
  }

  // 手机端布局：底部标签栏
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: Colors[colorScheme ?? 'light'].tint,
        headerShown: false,
        tabBarButton: HapticTab,
      }}>

      {/* 转录页面标签 */}
      <Tabs.Screen
        name="index"
        options={{
          title: tabs.transcription,
          tabBarIcon: ({ color }) => <IconSymbol size={28} name="waveform" color={color} />,
        }}
      />
      {/* 问答页面标签 */}
      <Tabs.Screen
        name="qa"
        options={{
          title: tabs.qa,
          tabBarIcon: ({ color }) => <IconSymbol size={28} name="bubble.left.and.bubble.right.fill" color={color} />,
        }}
      />
      {/* 阅读/朗读页面标签 */}
      <Tabs.Screen
        name="reading"
        options={{
          title: tabs.reading,
          tabBarIcon: ({ color }) => <IconSymbol size={28} name="speaker.wave.2.fill" color={color} />,
        }}
      />
      {/* 设置/探索页面标签 */}
      <Tabs.Screen
        name="explore"
        options={{
          title: tabs.settings,
          tabBarIcon: ({ color }) => <IconSymbol size={28} name="gearshape.fill" color={color} />,
        }}
      />
    </Tabs>
  );
}

// 样式定义
const styles = StyleSheet.create({
  tabletRoot: {
    flex: 1,
    flexDirection: 'row',
  },
  tabletContent: {
    flex: 1,
  },
});
