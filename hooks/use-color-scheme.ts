import { useColorScheme as useSystemColorScheme } from 'react-native';
import { useContext } from 'react';
import { SettingsContext } from '@/contexts/settings-context';

export function useColorScheme() {
  const system = useSystemColorScheme();
  const context = useContext(SettingsContext);
  
  // If used outside of SettingsProvider, fallback to system
  if (!context) {
    return system;
  }

  const { settings } = context;
  if (settings.themeMode === 'automatic') {
    return system;
  }
  return settings.themeMode;
}

