import { Stack } from 'expo-router';
import 'react-native-reanimated';

import { I18nextProvider } from 'react-i18next';

import { SettingsProvider } from '@/contexts/settings-context';
import { TranscriptionProvider } from '@/contexts/transcription-context';
import i18n from '@/i18n';
import { AppThemeProvider } from '@/theme/app-theme-provider';

export const unstable_settings = {
  anchor: '(tabs)',
};

export default function RootLayout() {
  return (
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
  );
}
