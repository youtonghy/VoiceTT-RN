import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import 'react-native-reanimated';

import { I18nextProvider } from 'react-i18next';

import { SettingsProvider } from '@/contexts/settings-context';
import { TranscriptionProvider } from '@/contexts/transcription-context';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { I18nSettingsSync } from '@/components/i18n-settings-sync';
import i18n from '@/i18n';

export const unstable_settings = {
  anchor: '(tabs)',
};

function RootLayoutNav() {
  const colorScheme = useColorScheme();

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <Stack>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="modal" options={{ presentation: 'modal', title: 'Modal' }} />
      </Stack>
      <StatusBar style={colorScheme === 'dark' ? 'light' : 'dark'} />
    </ThemeProvider>
  );
}

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
