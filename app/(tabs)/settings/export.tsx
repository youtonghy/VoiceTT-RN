/**
 * Screen name: Export settings
 * File path: app/(tabs)/settings/export.tsx
 * Description: Configure export format, content scope, and timestamp output.
 */

import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { KeyboardAvoidingView, Platform, ScrollView, Switch, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { useSettings } from '@/contexts/settings-context';
import { useColorScheme } from '@/hooks/use-color-scheme';
import type { ExportFormat } from '@/types/settings';

import {
  CARD_SUBTLE_DARK,
  CARD_SUBTLE_LIGHT,
  CARD_TEXT_DARK,
  CARD_TEXT_LIGHT,
  OptionPill,
  SettingsCard,
  settingsStyles,
} from './shared';

const exportFormats: ExportFormat[] = ['markdown', 'pdf'];

export default function ExportSettingsScreen() {
  const { t } = useTranslation();
  const { settings, updateSettings } = useSettings();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const insets = useSafeAreaInsets();
  const safeAreaStyle = [
    settingsStyles.safeArea,
    isDark ? settingsStyles.safeAreaDark : settingsStyles.safeAreaLight,
  ];
  const groupLabelStyle = [settingsStyles.groupLabel, isDark && settingsStyles.groupLabelDark];
  const translationUnavailable = settings.translationEngine === 'none';

  useEffect(() => {
    if (translationUnavailable && settings.exportIncludeTranslation) {
      updateSettings({ exportIncludeTranslation: false });
    }
  }, [settings.exportIncludeTranslation, translationUnavailable, updateSettings]);

  return (
    <SafeAreaView style={safeAreaStyle} edges={['top', 'left', 'right']}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={settingsStyles.flex}>
        <ScrollView
          contentContainerStyle={[
            settingsStyles.scrollContent,
            { paddingBottom: 32 + insets.bottom },
          ]}
          contentInsetAdjustmentBehavior="always"
          keyboardDismissMode="on-drag"
          keyboardShouldPersistTaps="handled">
          <SettingsCard variant="interaction">
            <ThemedText style={groupLabelStyle} lightColor={CARD_TEXT_LIGHT} darkColor={CARD_TEXT_DARK}>
              {t('settings.export.labels.format')}
            </ThemedText>
            <View style={settingsStyles.optionsRow}>
              {exportFormats.map((format) => (
                <OptionPill
                  key={format}
                  label={t(`settings.export.formats.${format}`)}
                  active={settings.exportFormat === format}
                  onPress={() => updateSettings({ exportFormat: format })}
                />
              ))}
            </View>
          </SettingsCard>

          <SettingsCard variant="interaction">
            <ThemedText style={groupLabelStyle} lightColor={CARD_TEXT_LIGHT} darkColor={CARD_TEXT_DARK}>
              {t('settings.export.labels.content')}
            </ThemedText>
            <View style={settingsStyles.rowBetween}>
              <ThemedText type="subtitle" lightColor={CARD_TEXT_LIGHT} darkColor={CARD_TEXT_DARK}>
                {t('settings.export.labels.include_transcript')}
              </ThemedText>
              <Switch
                value={settings.exportIncludeTranscript}
                onValueChange={(next) => updateSettings({ exportIncludeTranscript: next })}
              />
            </View>
            <View style={settingsStyles.rowBetween}>
              <ThemedText type="subtitle" lightColor={CARD_TEXT_LIGHT} darkColor={CARD_TEXT_DARK}>
                {t('settings.export.labels.include_translation')}
              </ThemedText>
              <Switch
                value={settings.exportIncludeTranslation}
                onValueChange={(next) => updateSettings({ exportIncludeTranslation: next })}
                disabled={translationUnavailable}
              />
            </View>
            <ThemedText
              style={groupLabelStyle}
              lightColor={CARD_SUBTLE_LIGHT}
              darkColor={CARD_SUBTLE_DARK}>
              {translationUnavailable
                ? t('settings.export.hints.translation_unavailable')
                : t('settings.export.hints.translation_on_demand')}
            </ThemedText>
          </SettingsCard>

          <SettingsCard variant="interaction">
            <ThemedText style={groupLabelStyle} lightColor={CARD_TEXT_LIGHT} darkColor={CARD_TEXT_DARK}>
              {t('settings.export.labels.timestamp')}
            </ThemedText>
            <View style={settingsStyles.rowBetween}>
              <ThemedText type="subtitle" lightColor={CARD_TEXT_LIGHT} darkColor={CARD_TEXT_DARK}>
                {t('settings.export.labels.include_time')}
              </ThemedText>
              <Switch
                value={settings.exportIncludeTime}
                onValueChange={(next) => updateSettings({ exportIncludeTime: next })}
              />
            </View>
          </SettingsCard>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
