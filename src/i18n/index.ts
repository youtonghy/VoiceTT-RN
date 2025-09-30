/* eslint-disable import/no-named-as-default-member */
import i18next, { type Resource } from 'i18next';
import { initReactI18next } from 'react-i18next';
import * as Localization from 'expo-localization';

import en from '@/locales/en/common.json';
import zhHans from '@/locales/zh-Hans/common.json';

export type SupportedLanguage = 'en' | 'zh-Hans';

const resources = {
  en: { common: en },
  'zh-Hans': { common: zhHans },
} satisfies Resource;

const fallbackLng: SupportedLanguage = 'en';

const resolveLanguage = (): SupportedLanguage => {
  try {
    const locales = Localization.getLocales();
    const primary = locales?.[0]?.languageTag ?? fallbackLng;
    if (primary?.toLowerCase().startsWith('zh')) {
      return 'zh-Hans';
    }
    return 'en';
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
      lng: resolveLanguage(),
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

export const supportedLanguages: SupportedLanguage[] = ['en', 'zh-Hans'];

export default i18next;
