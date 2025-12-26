/**
 * 页面名称：根布局 (Root Layout)
 * 文件路径：app/_layout.tsx
 * 功能描述：应用程序的根入口，负责配置全局 Provider（国际化、设置、转录上下文）以及根级导航栈。
 */

import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import 'react-native-reanimated';

import { I18nextProvider } from 'react-i18next';

import { I18nSettingsSync } from '@/components/i18n-settings-sync';
import { SettingsProvider } from '@/contexts/settings-context';
import { TranscriptionProvider } from '@/contexts/transcription-context';
import { useColorScheme } from '@/hooks/use-color-scheme';
import i18n from '@/i18n';

// 导航设置
export const unstable_settings = {
  anchor: '(tabs)',
};

// 根导航组件
function RootLayoutNav() {
  const colorScheme = useColorScheme();

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      {/* 根级堆栈导航 */}
      <Stack>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="modal" options={{ presentation: 'modal', title: 'Modal' }} />
      </Stack>
      <StatusBar style={colorScheme === 'dark' ? 'light' : 'dark'} />
    </ThemeProvider>
  );
}

// 根布局导出
export default function RootLayout() {
  return (
    <I18nextProvider i18n={i18n}>
      <SettingsProvider>
        <I18nSettingsSync />
        <TranscriptionProvider>
          <RootLayoutNav />
        </TranscriptionProvider>
      </SettingsProvider>
    </I18nextProvider>
  );
}
