<<<<<<< HEAD
import { useMemo } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { Surface, Switch, Text, useTheme } from 'react-native-paper';
=======
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Switch, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
>>>>>>> parent of e9751a1 (Add i18n support and localize UI text)

import { useSettings } from '@/contexts/settings-context';
import type { TranslationEngine } from '@/types/settings';

import { OptionPill, settingsStyles } from './shared';

const translationEngines: TranslationEngine[] = ['openai', 'gemini', 'none'];

export default function TranslationSettingsScreen() {
  const { settings, updateSettings } = useSettings();
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  const safeAreaStyle = useMemo(
    () => [settingsStyles.safeArea, { backgroundColor: theme.colors.background }],
    [theme.colors.background]
  );

  const scrollContentStyle = useMemo(
    () => [settingsStyles.scrollContent, { paddingBottom: 32 + insets.bottom }],
    [insets.bottom]
  );

  const sectionCardStyle = useMemo(
    () => [settingsStyles.sectionCard, { backgroundColor: theme.colors.surface }],
    [theme.colors.surface]
  );

  return (
    <SafeAreaView style={safeAreaStyle} edges={['top', 'left', 'right']}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={settingsStyles.flex}
      >
        <ScrollView
          contentContainerStyle={scrollContentStyle}
          contentInsetAdjustmentBehavior="always"
          keyboardDismissMode="on-drag"
          keyboardShouldPersistTaps="handled"
        >
          <Surface style={sectionCardStyle} mode="flat" elevation={1}>
            <View style={settingsStyles.rowBetween}>
<<<<<<< HEAD
              <Text variant="titleMedium">{t('settings.translation.labels.enable_translation')}</Text>
=======
              <ThemedText type="subtitle" lightColor="#0f172a" darkColor="#e2e8f0">
                启用翻译
              </ThemedText>
>>>>>>> parent of e9751a1 (Add i18n support and localize UI text)
              <Switch
                value={settings.enableTranslation}
                onValueChange={(next) => updateSettings({ enableTranslation: next })}
              />
            </View>

<<<<<<< HEAD
            <View>
              <Text variant="labelLarge" style={styles.sectionLabel}>
                {t('settings.translation.labels.engine')}
              </Text>
              <View style={settingsStyles.optionsRow}>
                {translationEngines.map((engine) => (
                  <OptionPill
                    key={engine}
                    label={t(`settings.translation.engines.${engine}`)}
                    active={settings.translationEngine === engine}
                    onPress={() => updateSettings({ translationEngine: engine })}
                    disabled={!settings.enableTranslation}
                  />
                ))}
              </View>
=======
            <ThemedText style={groupLabelStyle} lightColor="#1f2937" darkColor="#e2e8f0">
              翻译引擎
            </ThemedText>
            <View style={settingsStyles.optionsRow}>
              {translationEngines.map((engine) => (
                <OptionPill
                  key={engine}
                  label={engine.toUpperCase()}
                  active={settings.translationEngine === engine}
                  onPress={() => updateSettings({ translationEngine: engine })}
                  disabled={!settings.enableTranslation}
                />
              ))}
>>>>>>> parent of e9751a1 (Add i18n support and localize UI text)
            </View>
          </Surface>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  sectionLabel: {
    marginBottom: 8,
  },
});
