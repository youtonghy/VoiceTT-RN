import type { PropsWithChildren } from 'react';
import { StyleProp, ViewStyle } from 'react-native';
import { Surface, useTheme } from 'react-native-paper';

import { useColorScheme } from '@/hooks/use-color-scheme';

export type ThemedViewProps = PropsWithChildren<{
  style?: StyleProp<ViewStyle>;
  lightColor?: string;
  darkColor?: string;
  mode?: 'elevated' | 'flat' | 'outlined';
  elevation?: number;
}>;

export function ThemedView({
  children,
  style,
  lightColor,
  darkColor,
  mode = 'flat',
  elevation,
}: ThemedViewProps) {
  const theme = useTheme();
  const scheme = useColorScheme() ?? 'light';
  const backgroundColor = (scheme === 'dark' ? darkColor : lightColor) ?? theme.colors.background;
  const resolvedElevation = elevation ?? (mode === 'flat' ? 0 : 1);

  return (
    <Surface
      mode={mode}
      elevation={resolvedElevation}
      style={[{ backgroundColor }, style]}>
      {children}
    </Surface>
  );
}
