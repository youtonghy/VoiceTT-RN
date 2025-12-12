import { KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { ThemedText } from '@/components/themed-text';
import { useSettings } from '@/contexts/settings-context';
import { useColorScheme } from '@/hooks/use-color-scheme';
import type { AppLanguageMode, ThemeMode } from '@/types/settings';
import { resolveDeviceLanguage } from '@/i18n';

import {
  CARD_TEXT_LIGHT,
  CARD_TEXT_DARK,
  OptionPill,
  SettingsCard,
  settingsStyles,
} from './shared';

const themeModes: ThemeMode[] = ['automatic', 'light', 'dark'];
const languageModes: AppLanguageMode[] = ['system', 'en', 'zh-Hans'];

export default function AppearanceSettingsScreen() {
  const { t, i18n } = useTranslation();
  const { settings, updateSettings } = useSettings();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const insets = useSafeAreaInsets();

  const safeAreaStyle = [
    settingsStyles.safeArea,
    isDark ? settingsStyles.safeAreaDark : settingsStyles.safeAreaLight,
  ];
  const groupLabelStyle = [settingsStyles.groupLabel, isDark && settingsStyles.groupLabelDark];

  const applyLanguageMode = (mode: AppLanguageMode) => {
    updateSettings({ languageMode: mode });
    const target = mode === 'system' ? resolveDeviceLanguage() : mode;
    i18n.changeLanguage(target).catch((error) => {
      if (__DEV__) {
        console.warn('[appearance] Failed to change language', error);
      }
    });
  };

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
            <ThemedText
              style={groupLabelStyle}
              lightColor={CARD_TEXT_LIGHT}
              darkColor={CARD_TEXT_DARK}>
              {t('settings.appearance.labels.mode')}
            </ThemedText>
            <View style={settingsStyles.optionsRow}>
              {themeModes.map((mode) => (
                <OptionPill
                  key={mode}
                  label={t(`settings.appearance.modes.${mode}`)}
                  active={settings.themeMode === mode}
                  onPress={() => updateSettings({ themeMode: mode })}
                />
              ))}
            </View>
          </SettingsCard>

          <SettingsCard variant="interaction">
            <ThemedText
              style={groupLabelStyle}
              lightColor={CARD_TEXT_LIGHT}
              darkColor={CARD_TEXT_DARK}>
              {t('settings.appearance.labels.language')}
            </ThemedText>
            <View style={settingsStyles.optionsRow}>
              {languageModes.map((mode) => (
                <OptionPill
                  key={mode}
                  label={t(`settings.appearance.languages.${mode}`)}
                  active={settings.languageMode === mode}
                  onPress={() => applyLanguageMode(mode)}
                />
              ))}
            </View>
          </SettingsCard>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
