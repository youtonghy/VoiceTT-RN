import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { HeroUINativeProvider, type HeroUINativeConfig } from 'heroui-native';
import 'react-native-reanimated';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { I18nextProvider } from 'react-i18next';

import { I18nSettingsSync } from '@/components/i18n-settings-sync';
import { ProTrustedTimeSync } from '@/components/pro-trusted-time-sync';
import { SettingsProvider } from '@/contexts/settings-context';
import { TranscriptionProvider } from '@/contexts/transcription-context';
import { useColorScheme } from '@/hooks/use-color-scheme';
import i18n from '@/i18n';
import '../global.css';

export const unstable_settings = {
  anchor: '(tabs)',
};

const heroUIConfig: HeroUINativeConfig = {
  textProps: {
    maxFontSizeMultiplier: 1.35,
    minimumFontScale: 0.75,
  },
  devInfo: {
    stylingPrinciples: false,
  },
};

function RootLayoutNav() {
  const colorScheme = useColorScheme();

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <Stack>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      </Stack>
      <StatusBar style={colorScheme === 'dark' ? 'light' : 'dark'} />
    </ThemeProvider>
  );
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <HeroUINativeProvider config={heroUIConfig}>
        <I18nextProvider i18n={i18n}>
          <SettingsProvider>
            <I18nSettingsSync />
            <ProTrustedTimeSync />
            <TranscriptionProvider>
              <RootLayoutNav />
            </TranscriptionProvider>
          </SettingsProvider>
        </I18nextProvider>
      </HeroUINativeProvider>
    </GestureHandlerRootView>
  );
}
