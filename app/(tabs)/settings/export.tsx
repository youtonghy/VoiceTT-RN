/**
 * Screen name: Export settings
 * File path: app/(tabs)/settings/export.tsx
 * Description: Configure export format, content scope, and timestamp output.
 */

import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { AppCard, AppScreen, SettingSwitch } from '@/components/native/app-shell';
import { useSettings } from '@/contexts/settings-context';
import type { ExportFormat } from '@/types/settings';

import {
  OptionPill,
} from '@/components/settings/settings-form';

const exportFormats: ExportFormat[] = ['markdown', 'pdf'];

export default function ExportSettingsScreen() {
  const { t } = useTranslation();
  const { settings, updateSettings } = useSettings();
  const translationUnavailable = settings.translationEngine === 'none';

  useEffect(() => {
    if (translationUnavailable && settings.exportIncludeTranslation) {
      updateSettings({ exportIncludeTranslation: false });
    }
  }, [settings.exportIncludeTranslation, translationUnavailable, updateSettings]);

  return (
    <AppScreen>
      <AppCard icon="file-export" title={t('settings.export.labels.format')}>
        <View className="flex-row flex-wrap gap-2">
          {exportFormats.map((format) => (
            <OptionPill
              key={format}
              label={t(`settings.export.formats.${format}`)}
              active={settings.exportFormat === format}
              onPress={() => updateSettings({ exportFormat: format })}
            />
          ))}
        </View>
      </AppCard>

      <AppCard icon="file-lines" title={t('settings.export.labels.content')}>
        <SettingSwitch
          title={t('settings.export.labels.include_transcript')}
          value={settings.exportIncludeTranscript}
          onChange={(next) => updateSettings({ exportIncludeTranscript: next })}
        />
        <SettingSwitch
          title={t('settings.export.labels.include_translation')}
          subtitle={
            translationUnavailable
              ? t('settings.export.hints.translation_unavailable')
              : t('settings.export.hints.translation_on_demand')
          }
          value={settings.exportIncludeTranslation}
          onChange={(next) => updateSettings({ exportIncludeTranslation: next })}
          isDisabled={translationUnavailable}
        />
      </AppCard>

      <AppCard icon="clock-rotate-left" title={t('settings.export.labels.timestamp')}>
        <SettingSwitch
          title={t('settings.export.labels.include_time')}
          value={settings.exportIncludeTime}
          onChange={(next) => updateSettings({ exportIncludeTime: next })}
        />
      </AppCard>
    </AppScreen>
  );
}
