import type { PropsWithChildren } from 'react';
import { useMemo } from 'react';
import { useColorScheme } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import {
  MD3DarkTheme,
  MD3LightTheme,
  PaperProvider,
  type MD3Theme,
} from 'react-native-paper';
import {
  DarkTheme as NavigationDarkTheme,
  DefaultTheme as NavigationLightTheme,
  ThemeProvider as NavigationThemeProvider,
  type Theme as NavigationTheme,
} from '@react-navigation/native';
import { useMaterial3Theme } from '@pchmn/expo-material3-theme';

const FALLBACK_SOURCE_COLOR = '#6750A4';

type ColorSchemeKey = 'light' | 'dark';

type MaterialTheme = ReturnType<typeof useMaterial3Theme>['theme'];

function buildPaperTheme(scheme: ColorSchemeKey, materialTheme: MaterialTheme): MD3Theme {
  const base = scheme === 'dark' ? MD3DarkTheme : MD3LightTheme;
  const palette = materialTheme[scheme].colors;

  return {
    ...base,
    colors: {
      ...base.colors,
      ...palette,
    },
  };
}

function buildNavigationTheme(scheme: ColorSchemeKey, paperTheme: MD3Theme): NavigationTheme {
  const base = scheme === 'dark' ? NavigationDarkTheme : NavigationLightTheme;

  return {
    ...base,
    colors: {
      ...base.colors,
      primary: paperTheme.colors.primary,
      background: paperTheme.colors.background,
      card: paperTheme.colors.surface,
      text: paperTheme.colors.onSurface,
      border: paperTheme.colors.outline,
      notification: paperTheme.colors.error,
    },
  };
}

export function AppThemeProvider({ children }: PropsWithChildren): JSX.Element {
  const systemScheme = (useColorScheme() ?? 'light') as ColorSchemeKey;
  const materialTheme = useMaterial3Theme({ fallbackSourceColor: FALLBACK_SOURCE_COLOR });

  const paperTheme = useMemo(
    () => buildPaperTheme(systemScheme, materialTheme.theme),
    [materialTheme.theme, systemScheme],
  );

  const navigationTheme = useMemo(
    () => buildNavigationTheme(systemScheme, paperTheme),
    [paperTheme, systemScheme],
  );

  return (
    <PaperProvider theme={paperTheme}>
      <NavigationThemeProvider value={navigationTheme}>
        <StatusBar style={systemScheme === 'dark' ? 'light' : 'dark'} backgroundColor={paperTheme.colors.background} />
        {children}
      </NavigationThemeProvider>
    </PaperProvider>
  );
}
