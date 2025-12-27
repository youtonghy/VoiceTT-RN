/* eslint-disable import/no-named-as-default-member */
import i18next, { type Resource } from 'i18next';
import { initReactI18next } from 'react-i18next';
import * as Localization from 'expo-localization';

import en from '@/locales/en/common.json';
import zhHans from '@/locales/zh-Hans/common.json';
import zhHant from '@/locales/zh-Hant/common.json';
import ja from '@/locales/ja/common.json';
import ko from '@/locales/ko/common.json';
import es from '@/locales/es/common.json';

export type SupportedLanguage = 'en' | 'zh-Hans' | 'zh-Hant' | 'ja' | 'ko' | 'es';

const resources = {
  en: { common: en },
  'zh-Hans': { common: zhHans },
  'zh-Hant': { common: zhHant },
  ja: { common: ja },
  ko: { common: ko },
  es: { common: es },
} satisfies Resource;

const fallbackLng: SupportedLanguage = 'en';

export const resolveDeviceLanguage = (): SupportedLanguage => {
  try {
    const locales = Localization.getLocales();
    const primary = locales?.[0];
    const languageCode = primary?.languageCode?.toLowerCase();
    if (!languageCode) {
      return fallbackLng;
    }
    if (languageCode === 'zh') {
      const scriptCode = primary?.languageScriptCode?.toLowerCase();
      const regionCode = primary?.regionCode?.toUpperCase();
      if (scriptCode === 'hant' || regionCode === 'TW' || regionCode === 'HK' || regionCode === 'MO') {
        return 'zh-Hant';
      }
      return 'zh-Hans';
    }
    const normalized = languageCode as SupportedLanguage;
    if (normalized === 'en' || normalized === 'ja' || normalized === 'ko' || normalized === 'es') {
      return normalized;
    }
    return fallbackLng;
  } catch (error) {
    if (__DEV__) {
      console.warn('[i18n] Failed to detect locale, using fallback', error);
    }
    return fallbackLng;
  }
};

if (!i18next.isInitialized) {
  i18next
    .use(initReactI18next)
    .init({
      resources,
      lng: resolveDeviceLanguage(),
      fallbackLng,
      ns: ['common'],
      defaultNS: 'common',
      interpolation: { escapeValue: false },
      compatibilityJSON: 'v4',
      returnNull: false,
    })
    .catch((error) => {
      if (__DEV__) {
        console.warn('[i18n] initialization failed', error);
      }
    });

  i18next.on('missingKey', (lngs, namespace, key) => {
    if (__DEV__) {
      console.warn(
        `[i18n] Missing translation for key "${namespace}:${key}" in languages ${lngs?.join(', ')}`
      );
    }
  });
}

export const supportedLanguages: SupportedLanguage[] = [
  'en',
  'zh-Hans',
  'zh-Hant',
  'ja',
  'ko',
  'es',
];

export default i18next;
