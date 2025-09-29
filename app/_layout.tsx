import { Stack } from 'expo-router';
import 'react-native-reanimated';

import { SettingsProvider } from '@/contexts/settings-context';
import { TranscriptionProvider } from '@/contexts/transcription-context';
<<<<<<< HEAD
import i18n from '@/i18n';
import { AppThemeProvider } from '@/theme/app-theme-provider';
=======
import { useColorScheme } from '@/hooks/use-color-scheme';
>>>>>>> parent of e9751a1 (Add i18n support and localize UI text)

export const unstable_settings = {
  anchor: '(tabs)',
};

export default function RootLayout() {
  return (
<<<<<<< HEAD
    <I18nextProvider i18n={i18n}>
      <SettingsProvider>
        <TranscriptionProvider>
          <AppThemeProvider>
            <Stack>
              <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
              <Stack.Screen name="modal" options={{ presentation: 'modal', title: 'Modal' }} />
            </Stack>
          </AppThemeProvider>
        </TranscriptionProvider>
      </SettingsProvider>
    </I18nextProvider>
=======
    <SettingsProvider>
      <TranscriptionProvider>
        <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
          <Stack>
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
            <Stack.Screen name="modal" options={{ presentation: 'modal', title: 'Modal' }} />
          </Stack>
          <StatusBar style="auto" />
        </ThemeProvider>
      </TranscriptionProvider>
    </SettingsProvider>
>>>>>>> parent of e9751a1 (Add i18n support and localize UI text)
  );
}
