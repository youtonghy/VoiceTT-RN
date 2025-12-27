/**
 * 页面名称：外观设置 (Appearance Settings)
 * 文件路径：app/(tabs)/explore/appearance.tsx
 * 功能描述：允许用户配置应用程序的主题模式（自动、浅色、深色）和语言设置。
 */

import { useTranslation } from 'react-i18next';
import { KeyboardAvoidingView, Platform, ScrollView, Switch, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { useSettings } from '@/contexts/settings-context';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { resolveDeviceLanguage } from '@/i18n';
import type { AppLanguageMode, ThemeMode } from '@/types/settings';

import {
    CARD_TEXT_DARK,
    CARD_TEXT_LIGHT,
    OptionPill,
    SettingsCard,
    settingsStyles,
} from './shared';

// --- 常量定义 ---
const themeModes: ThemeMode[] = ['automatic', 'light', 'dark'];
const languageModes: AppLanguageMode[] = ['system', 'en', 'zh-Hans', 'zh-Hant', 'ja', 'ko', 'es'];

// --- 主组件 ---
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
  const languageLabels: Record<AppLanguageMode, string> = {
    system: t('settings.appearance.languages.system'),
    en: 'English',
    'zh-Hans': '简体中文',
    'zh-Hant': '繁體中文',
    ja: '日本語',
    ko: '한국어',
    es: 'Español',
  };

  // --- 处理函数 ---
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
      {/* 键盘避让视图 */}
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
                  label={languageLabels[mode]}
                  active={settings.languageMode === mode}
                  onPress={() => applyLanguageMode(mode)}
                />
              ))}
            </View>
          </SettingsCard>

          <SettingsCard variant="interaction">
            <ThemedText
              style={groupLabelStyle}
              lightColor={CARD_TEXT_LIGHT}
              darkColor={CARD_TEXT_DARK}>
              {t('settings.appearance.labels.tabs')}
            </ThemedText>
            <View style={settingsStyles.rowBetween}>
              <ThemedText type="subtitle" lightColor={CARD_TEXT_LIGHT} darkColor={CARD_TEXT_DARK}>
                {t('navigation.tabs.qa')}
              </ThemedText>
              <Switch
                value={settings.showQaTab}
                onValueChange={(next) => updateSettings({ showQaTab: next })}
              />
            </View>
            <View style={settingsStyles.rowBetween}>
              <ThemedText type="subtitle" lightColor={CARD_TEXT_LIGHT} darkColor={CARD_TEXT_DARK}>
                {t('navigation.tabs.reading')}
              </ThemedText>
              <Switch
                value={settings.showReadingTab}
                onValueChange={(next) => updateSettings({ showReadingTab: next })}
              />
            </View>
          </SettingsCard>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
