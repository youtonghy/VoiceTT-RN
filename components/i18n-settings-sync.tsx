import { useEffect } from 'react';

import i18n, { resolveDeviceLanguage, type SupportedLanguage } from '@/i18n';
import { useSettings } from '@/contexts/settings-context';
import type { AppLanguageMode } from '@/types/settings';

function resolveTargetLanguage(mode: AppLanguageMode): SupportedLanguage {
  return mode === 'system' ? resolveDeviceLanguage() : mode;
}

export function I18nSettingsSync() {
  const { settings, loaded } = useSettings();

  useEffect(() => {
    if (!loaded) {
      return;
    }
    const target = resolveTargetLanguage(settings.languageMode);
    if (i18n.language !== target) {
      i18n.changeLanguage(target).catch((error) => {
        if (__DEV__) {
          console.warn('[i18n] Failed to apply language setting', error);
        }
      });
    }
  }, [loaded, settings.languageMode]);

  return null;
}

export default I18nSettingsSync;

