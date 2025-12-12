import React from 'react';
import { StyleSheet, View } from 'react-native';
import MarkdownDisplay from 'react-native-markdown-display';
import { useThemeColor } from '@/hooks/use-theme-color';

export interface MarkdownTextProps {
  children: string;
  style?: any;
  lightColor?: string;
  darkColor?: string;
  /**
   * Hard guardrail against rendering extremely large Markdown strings.
   * This mitigates accidental or malicious resource exhaustion in Markdown parsing.
   */
  maxChars?: number;
}

export function MarkdownText({
  children,
  style,
  lightColor,
  darkColor,
  maxChars = 200000,
}: MarkdownTextProps) {
  const textColor = useThemeColor(
    { light: lightColor || '#0f172a', dark: darkColor || '#e2e8f0' },
    'text'
  );

  const safeMarkdown =
    typeof children === 'string' && children.length > maxChars
      ? children.slice(0, maxChars) + '\n\n...\n'
      : children;

  const markdownStyles = {
    body: {
      color: textColor,
    },
    paragraph: {
      marginTop: 0,
      marginBottom: 8,
    },
    heading1: {
      fontSize: 20,
      fontWeight: '700' as const,
      marginTop: 16,
      marginBottom: 8,
      color: textColor,
    },
    heading2: {
      fontSize: 18,
      fontWeight: '600' as const,
      marginTop: 14,
      marginBottom: 6,
      color: textColor,
    },
    heading3: {
      fontSize: 16,
      fontWeight: '600' as const,
      marginTop: 12,
      marginBottom: 6,
      color: textColor,
    },
    list_item: {
      marginBottom: 4,
    },
    bullet_list: {
      marginBottom: 8,
    },
    ordered_list: {
      marginBottom: 8,
    },
    code_inline: {
      backgroundColor: 'rgba(148, 163, 184, 0.12)',
      color: textColor,
      paddingHorizontal: 4,
      paddingVertical: 2,
      borderRadius: 4,
      fontFamily: 'monospace',
    },
    code_block: {
      backgroundColor: 'rgba(148, 163, 184, 0.12)',
      color: textColor,
      padding: 12,
      borderRadius: 8,
      marginVertical: 8,
      fontFamily: 'monospace',
    },
    blockquote: {
      backgroundColor: 'rgba(148, 163, 184, 0.08)',
      borderLeftWidth: 4,
      borderLeftColor: 'rgba(148, 163, 184, 0.4)',
      paddingLeft: 12,
      marginVertical: 8,
      paddingVertical: 4,
    },
    strong: {
      fontWeight: '700' as const,
    },
    em: {
      fontStyle: 'italic' as const,
    },
    link: {
      color: '#2563eb',
      textDecorationLine: 'underline' as const,
    },
    hr: {
      backgroundColor: 'rgba(148, 163, 184, 0.3)',
      height: 1,
      marginVertical: 16,
    },
    table: {
      borderWidth: 1,
      borderColor: 'rgba(148, 163, 184, 0.3)',
      borderRadius: 8,
      marginVertical: 8,
    },
    thead: {
      backgroundColor: 'rgba(148, 163, 184, 0.1)',
    },
    th: {
      padding: 8,
      fontWeight: '600' as const,
      borderRightWidth: 1,
      borderRightColor: 'rgba(148, 163, 184, 0.3)',
    },
    tr: {
      borderBottomWidth: 1,
      borderBottomColor: 'rgba(148, 163, 184, 0.3)',
    },
    td: {
      padding: 8,
      borderRightWidth: 1,
      borderRightColor: 'rgba(148, 163, 184, 0.3)',
    },
  };

  return (
    <View style={[styles.container, style]}>
      <MarkdownDisplay style={markdownStyles}>
        {safeMarkdown}
      </MarkdownDisplay>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
