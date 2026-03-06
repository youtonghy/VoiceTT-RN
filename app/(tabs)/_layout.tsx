/**
 * Screen: tabs layout
 * Path: app/(tabs)/_layout.tsx
 * Purpose: configure bottom tabs for phones and side navigation for tablets.
 */

import { Stack, Tabs } from 'expo-router';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { HapticTab } from '@/components/haptic-tab';
import { SideTabRail } from '@/components/side-tab-rail';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors } from '@/constants/theme';
import { useSettings } from '@/contexts/settings-context';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useIsTablet } from '@/hooks/use-is-tablet';

export default function TabLayout() {
  const colorScheme = useColorScheme();
  const { t } = useTranslation();
  const isTablet = useIsTablet();
  const { settings } = useSettings();
  const hiddenTabItemStyle = { display: 'none' } as const;

  const tabs = {
    transcription: t('navigation.tabs.transcription'),
    qa: t('navigation.tabs.qa'),
    reading: t('navigation.tabs.reading'),
    settings: t('navigation.tabs.settings'),
  };

  if (isTablet) {
    return (
      <View style={styles.tabletRoot}>
        <SideTabRail showQaTab={settings.showQaTab} showReadingTab={settings.showReadingTab} />
        <View style={styles.tabletContent}>
          <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="transcription" />
            <Stack.Screen name="conversation-qa" />
            <Stack.Screen name="text-to-speech" />
            <Stack.Screen name="settings" />
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
        name="transcription"
        options={{
          title: tabs.transcription,
          tabBarIcon: ({ color }) => <IconSymbol size={28} name="waveform" color={color} />,
        }}
      />
      <Tabs.Screen
        name="conversation-qa"
        options={{
          title: tabs.qa,
          tabBarIcon: ({ color }) => <IconSymbol size={28} name="bubble.left.and.bubble.right.fill" color={color} />,
          tabBarItemStyle: settings.showQaTab ? undefined : hiddenTabItemStyle,
        }}
      />
      <Tabs.Screen
        name="text-to-speech"
        options={{
          title: tabs.reading,
          tabBarIcon: ({ color }) => <IconSymbol size={28} name="speaker.wave.2.fill" color={color} />,
          tabBarItemStyle: settings.showReadingTab ? undefined : hiddenTabItemStyle,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: tabs.settings,
          tabBarIcon: ({ color }) => <IconSymbol size={28} name="gearshape.fill" color={color} />,
        }}
      />
      {/* Legacy alias routes must stay hidden or Expo Router will auto-inject them into the tab bar. */}
      <Tabs.Screen name="index" options={{ href: null }} />
      <Tabs.Screen name="qa" options={{ href: null }} />
      <Tabs.Screen name="reading" options={{ href: null }} />
      <Tabs.Screen name="explore" options={{ href: null }} />
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
