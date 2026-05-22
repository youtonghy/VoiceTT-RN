import { useColorScheme as useSystemColorScheme } from 'react-native';
import { useContext } from 'react';
import { SettingsContext } from '@/contexts/settings-context';

export type AppColorScheme = 'light' | 'dark';

function normalizeColorScheme(colorScheme: ReturnType<typeof useSystemColorScheme>): AppColorScheme {
  return colorScheme === 'dark' ? 'dark' : 'light';
}

export function useColorScheme(): AppColorScheme {
  const system = useSystemColorScheme();
  const context = useContext(SettingsContext);
  
  // If used outside of SettingsProvider, fallback to system
  if (!context) {
    return normalizeColorScheme(system);
  }

  const { settings } = context;
  if (settings.themeMode === 'automatic') {
    return normalizeColorScheme(system);
  }
  return settings.themeMode;
}
