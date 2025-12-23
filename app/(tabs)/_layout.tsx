import { Stack, Tabs } from 'expo-router';
import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

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

  const tabs = {
    transcription: t('navigation.tabs.transcription'),
    qa: t('navigation.tabs.qa'),
    reading: t('navigation.tabs.reading'),
    settings: t('navigation.tabs.settings'),
  };

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

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: Colors[colorScheme ?? 'light'].tint,
        headerShown: false,
        tabBarButton: HapticTab,
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: tabs.transcription,
          tabBarIcon: ({ color }) => <IconSymbol size={28} name="waveform" color={color} />,
        }}
      />
      <Tabs.Screen
        name="qa"
        options={{
          title: tabs.qa,
          tabBarIcon: ({ color }) => <IconSymbol size={28} name="bubble.left.and.bubble.right.fill" color={color} />,
        }}
      />
      <Tabs.Screen
        name="reading"
        options={{
          title: tabs.reading,
          tabBarIcon: ({ color }) => <IconSymbol size={28} name="speaker.wave.2.fill" color={color} />,
        }}
      />
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

const styles = StyleSheet.create({
  tabletRoot: {
    flex: 1,
    flexDirection: 'row',
  },
  tabletContent: {
    flex: 1,
  },
});
