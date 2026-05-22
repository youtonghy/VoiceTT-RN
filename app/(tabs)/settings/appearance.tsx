import { useTranslation } from 'react-i18next';

import { AppCard, AppScreen, SegmentControl, SettingSwitch } from '@/components/native/app-shell';
import { useSettings } from '@/contexts/settings-context';
import { resolveDeviceLanguage } from '@/i18n';
import type { AppLanguageMode, ThemeMode } from '@/types/settings';

const themeModes: ThemeMode[] = ['automatic', 'light', 'dark'];
const languageModes: AppLanguageMode[] = ['system', 'en', 'zh-Hans', 'zh-Hant', 'ja', 'ko', 'es'];

export default function AppearanceSettingsScreen() {
  const { t, i18n } = useTranslation();
  const { settings, updateSettings } = useSettings();

  const languageLabels: Record<AppLanguageMode, string> = {
    system: t('settings.appearance.languages.system'),
    en: t('settings.appearance.languages.en'),
    'zh-Hans': t('settings.appearance.languages.zh-Hans'),
    'zh-Hant': t('settings.appearance.languages.zh-Hant'),
    ja: t('settings.appearance.languages.ja'),
    ko: t('settings.appearance.languages.ko'),
    es: t('settings.appearance.languages.es'),
  };

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
    <AppScreen
      title={t('settings.sections.appearance.title')}
      subtitle={t('settings.sections.appearance.subtitle')}
      edges={['left', 'right']}
      contentTopInset={0}
      scrollContentInsetAdjustmentBehavior="never">
      <AppCard title={t('settings.appearance.labels.mode')} icon="circle-half-stroke">
        <SegmentControl
          value={settings.themeMode}
          onChange={(mode) => updateSettings({ themeMode: mode })}
          options={themeModes.map((mode) => ({
            value: mode,
            label: t(`settings.appearance.modes.${mode}`),
            icon:
              mode === 'dark'
                ? 'moon'
                : mode === 'light'
                  ? 'sun'
                  : 'mobile-screen',
          }))}
        />
      </AppCard>

      <AppCard title={t('settings.appearance.labels.language')} icon="language">
        <SegmentControl
          value={settings.languageMode}
          onChange={applyLanguageMode}
          options={languageModes.map((mode) => ({
            value: mode,
            label: languageLabels[mode],
          }))}
        />
      </AppCard>

      <AppCard title={t('settings.appearance.labels.tabs')} icon="layer-group">
        <SettingSwitch
          title={t('navigation.tabs.qa')}
          value={settings.showQaTab}
          onChange={(next) => updateSettings({ showQaTab: next })}
        />
        <SettingSwitch
          title={t('navigation.tabs.reading')}
          value={settings.showReadingTab}
          onChange={(next) => updateSettings({ showReadingTab: next })}
        />
      </AppCard>
    </AppScreen>
  );
}
