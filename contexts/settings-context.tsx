import AsyncStorage from '@react-native-async-storage/async-storage';
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';

import {
  AppSettings,
  EngineCredentials,
  defaultSettings,
} from '@/types/settings';

const SETTINGS_STORAGE_KEY = '@agents/app-settings';

interface SettingsContextValue {
  settings: AppSettings;
  loaded: boolean;
  updateSettings: (partial: Partial<Omit<AppSettings, 'credentials'>>) => void;
  updateCredentials: (partial: Partial<EngineCredentials>) => void;
  resetSettings: () => void;
}

const SettingsContext = createContext<SettingsContextValue | undefined>(undefined);

async function loadPersistedSettings(): Promise<AppSettings | null> {
  try {
    const value = await AsyncStorage.getItem(SETTINGS_STORAGE_KEY);
    if (!value) {
      return null;
    }
    const parsed = JSON.parse(value) as AppSettings;
    if (!parsed || typeof parsed !== 'object') {
      return null;
    }
    const parsedCredentials = parsed.credentials ?? {};
    const merged: AppSettings = {
      ...defaultSettings,
      ...parsed,
      credentials: {
        ...defaultSettings.credentials,
        ...parsedCredentials,
      },
    };
    if (parsed.conversationSummaryEngine === undefined) {
      merged.conversationSummaryEngine = parsed.titleSummaryEngine ?? defaultSettings.titleSummaryEngine;
    }
    if (parsedCredentials.openaiConversationModel === undefined && merged.credentials.openaiTitleModel) {
      merged.credentials.openaiConversationModel = merged.credentials.openaiTitleModel;
    }
    if (parsedCredentials.geminiConversationModel === undefined && merged.credentials.geminiTitleModel) {
      merged.credentials.geminiConversationModel = merged.credentials.geminiTitleModel;
    }
    if (parsed.qaEngine === undefined) {
      merged.qaEngine = defaultSettings.qaEngine;
    }
    if (!parsed.qaPrompt) {
      merged.qaPrompt = defaultSettings.qaPrompt;
    }
    if (parsedCredentials.openaiQaModel === undefined && merged.credentials.openaiConversationModel) {
      merged.credentials.openaiQaModel = merged.credentials.openaiConversationModel;
    }
    if (parsedCredentials.geminiQaModel === undefined && merged.credentials.geminiConversationModel) {
      merged.credentials.geminiQaModel = merged.credentials.geminiConversationModel;
    }
    return merged;
  } catch (error) {
    console.warn('[settings] Failed to restore persisted settings', error);
    return null;
  }
}

async function persistSettings(settings: AppSettings) {
  try {
    await AsyncStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
  } catch (error) {
    console.warn('[settings] Failed to persist settings', error);
  }
}

export function SettingsProvider({ children }: React.PropsWithChildren) {
  const [settings, setSettings] = useState<AppSettings>(defaultSettings);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let isMounted = true;
    loadPersistedSettings().then((stored) => {
      if (isMounted && stored) {
        setSettings(stored);
      }
      if (isMounted) {
        setLoaded(true);
      }
    });
    return () => {
      isMounted = false;
    };
  }, []);

  const runUpdate = useCallback(
    (updater: (prev: AppSettings) => AppSettings) => {
      setSettings((prev) => {
        const next = updater(prev);
        persistSettings(next);
        return next;
      });
    },
    []
  );

  const updateSettings = useCallback<SettingsContextValue['updateSettings']>(
    (partial) => {
      runUpdate((prev) => ({
        ...prev,
        ...partial,
        credentials: { ...prev.credentials },
      }));
    },
    [runUpdate]
  );

  const updateCredentials = useCallback<SettingsContextValue['updateCredentials']>(
    (partial) => {
      runUpdate((prev) => ({
        ...prev,
        credentials: {
          ...prev.credentials,
          ...partial,
        },
      }));
    },
    [runUpdate]
  );

  const resetSettings = useCallback(() => {
    runUpdate(() => defaultSettings);
  }, [runUpdate]);

  const value = useMemo<SettingsContextValue>(
    () => ({ settings, loaded, updateSettings, updateCredentials, resetSettings }),
    [loaded, resetSettings, settings, updateCredentials, updateSettings]
  );

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export function useSettings() {
  const context = useContext(SettingsContext);
  if (!context) {
    throw new Error('useSettings must be used within SettingsProvider');
  }
  return context;
}
