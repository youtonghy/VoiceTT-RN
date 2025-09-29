import { StyleSheet } from 'react-native';
import { Text as PaperText, useTheme } from 'react-native-paper';

import { useColorScheme } from '@/hooks/use-color-scheme';

const TYPE_TO_VARIANT = {
  default: 'bodyMedium',
  defaultSemiBold: 'bodyLarge',
  subtitle: 'titleMedium',
  title: 'headlineSmall',
  link: 'labelLarge',
} as const;

export type ThemedTextProps = React.ComponentProps<typeof PaperText> & {
  lightColor?: string;
  darkColor?: string;
  type?: keyof typeof TYPE_TO_VARIANT;
};

export function ThemedText({
  style,
  lightColor,
  darkColor,
  type = 'default',
  variant,
  ...rest
}: ThemedTextProps) {
  const theme = useTheme();
  const scheme = useColorScheme() ?? 'light';
  const fallbackColor = theme.colors.onSurface;
  const resolvedColor = (scheme === 'dark' ? darkColor : lightColor) ?? fallbackColor;
  const resolvedVariant = variant ?? TYPE_TO_VARIANT[type] ?? 'bodyMedium';

  return (
    <PaperText
      variant={resolvedVariant}
      style={[
        type === 'link' ? styles.link : undefined,
        { color: resolvedColor },
        style,
      ]}
      {...rest}
    />
  );
}

const styles = StyleSheet.create({
  link: {
    textDecorationLine: 'underline',
  },
});
