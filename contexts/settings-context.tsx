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
  DEFAULT_TRANSLATION_PROMPT_PREFIX,
  EngineCredentials,
  RecordingPreset,
  defaultSettings,
} from '@/types/settings';
import {
  secureGetCredentials,
  secureSetCredentials,
  secureClearAll,
} from '@/services/secure-storage';

const SETTINGS_STORAGE_KEY = '@agents/app-settings';
const VALID_TRANSCRIPTION_ENGINES = new Set<AppSettings['transcriptionEngine']>([
  'openai',
  'gemini',
  'qwen3',
  'soniox',
  'doubao',
  'glm',
]);

const RECORDING_SETTING_LIMITS = {
  activationThreshold: { min: 0.0001, max: 1 },
  activationDurationSec: { min: 0, max: 10 },
  silenceDurationSec: { min: 0.1, max: 30 },
  preRollDurationSec: { min: 0, max: 10 },
  maxSegmentDurationSec: { min: 5, max: 1800 },
  translationTimeoutSec: { min: 1, max: 120 },
} as const;

function clampNumber(value: unknown, fallback: number, min: number, max: number) {
  const numeric = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(numeric)) {
    return fallback;
  }
  return Math.min(max, Math.max(min, numeric));
}

function normalizeMaxSegmentDuration(value: unknown, fallback: number) {
  const numeric = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(numeric)) {
    return fallback;
  }
  if (numeric === 0) {
    return 0;
  }
  return Math.min(
    RECORDING_SETTING_LIMITS.maxSegmentDurationSec.max,
    Math.max(RECORDING_SETTING_LIMITS.maxSegmentDurationSec.min, numeric)
  );
}

function normalizeRecordingPreset(preset: RecordingPreset): RecordingPreset {
  return {
    ...preset,
    activationThreshold: clampNumber(
      preset.activationThreshold,
      defaultSettings.activationThreshold,
      RECORDING_SETTING_LIMITS.activationThreshold.min,
      RECORDING_SETTING_LIMITS.activationThreshold.max
    ),
    activationDurationSec: clampNumber(
      preset.activationDurationSec,
      defaultSettings.activationDurationSec,
      RECORDING_SETTING_LIMITS.activationDurationSec.min,
      RECORDING_SETTING_LIMITS.activationDurationSec.max
    ),
    silenceDurationSec: clampNumber(
      preset.silenceDurationSec,
      defaultSettings.silenceDurationSec,
      RECORDING_SETTING_LIMITS.silenceDurationSec.min,
      RECORDING_SETTING_LIMITS.silenceDurationSec.max
    ),
    preRollDurationSec: clampNumber(
      preset.preRollDurationSec,
      defaultSettings.preRollDurationSec,
      RECORDING_SETTING_LIMITS.preRollDurationSec.min,
      RECORDING_SETTING_LIMITS.preRollDurationSec.max
    ),
    maxSegmentDurationSec: normalizeMaxSegmentDuration(
      preset.maxSegmentDurationSec,
      defaultSettings.maxSegmentDurationSec
    ),
  };
}

function normalizeRuntimeSettings(settings: AppSettings): AppSettings {
  const recordingPresets = Array.isArray(settings.recordingPresets)
    ? settings.recordingPresets.map(normalizeRecordingPreset)
    : [];
  const activeRecordingPresetId =
    typeof settings.activeRecordingPresetId === 'string' &&
    recordingPresets.some((preset) => preset.id === settings.activeRecordingPresetId)
      ? settings.activeRecordingPresetId
      : null;

  return {
    ...settings,
    activationThreshold: clampNumber(
      settings.activationThreshold,
      defaultSettings.activationThreshold,
      RECORDING_SETTING_LIMITS.activationThreshold.min,
      RECORDING_SETTING_LIMITS.activationThreshold.max
    ),
    activationDurationSec: clampNumber(
      settings.activationDurationSec,
      defaultSettings.activationDurationSec,
      RECORDING_SETTING_LIMITS.activationDurationSec.min,
      RECORDING_SETTING_LIMITS.activationDurationSec.max
    ),
    silenceDurationSec: clampNumber(
      settings.silenceDurationSec,
      defaultSettings.silenceDurationSec,
      RECORDING_SETTING_LIMITS.silenceDurationSec.min,
      RECORDING_SETTING_LIMITS.silenceDurationSec.max
    ),
    preRollDurationSec: clampNumber(
      settings.preRollDurationSec,
      defaultSettings.preRollDurationSec,
      RECORDING_SETTING_LIMITS.preRollDurationSec.min,
      RECORDING_SETTING_LIMITS.preRollDurationSec.max
    ),
    maxSegmentDurationSec: normalizeMaxSegmentDuration(
      settings.maxSegmentDurationSec,
      defaultSettings.maxSegmentDurationSec
    ),
    translationTimeoutSec: clampNumber(
      settings.translationTimeoutSec,
      defaultSettings.translationTimeoutSec,
      RECORDING_SETTING_LIMITS.translationTimeoutSec.min,
      RECORDING_SETTING_LIMITS.translationTimeoutSec.max
    ),
    desktopAudioInputId:
      typeof settings.desktopAudioInputId === 'string' && settings.desktopAudioInputId.trim()
        ? settings.desktopAudioInputId
        : null,
    recordingPresets,
    activeRecordingPresetId,
  };
}

interface SettingsContextValue {
  settings: AppSettings;
  loaded: boolean;
  updateSettings: (partial: Partial<Omit<AppSettings, 'credentials'>>) => void;
  updateCredentials: (partial: Partial<EngineCredentials>) => void;
  resetSettings: () => void;
}

export const SettingsContext = createContext<SettingsContextValue | undefined>(undefined);

async function loadPersistedSettings(): Promise<AppSettings | null> {
  try {
    // Load non-sensitive settings from AsyncStorage
    const value = await AsyncStorage.getItem(SETTINGS_STORAGE_KEY);
    if (!value) {
      return null;
    }
    const parsed = JSON.parse(value) as AppSettings;
    if (!parsed || typeof parsed !== 'object') {
      return null;
    }
    const parsedSettings = parsed as AppSettings & { voiceInputEngine?: unknown };
    if ('voiceInputEngine' in parsedSettings) {
      delete parsedSettings.voiceInputEngine;
    }

    // Load sensitive credentials from secure storage
    const secureCredentials = await secureGetCredentials();
    const parsedCredentials = secureCredentials ?? parsed.credentials ?? {};

    const merged: AppSettings = {
      ...defaultSettings,
      ...parsedSettings,
      credentials: {
        ...defaultSettings.credentials,
        ...parsedCredentials,
      },
    };
    const normalizeTemperature = (value: unknown, fallback: number) => {
      if (value === '' || value === null || value === undefined) {
        return fallback;
      }
      const candidate = typeof value === 'number' ? value : Number(value);
      if (!Number.isFinite(candidate) || candidate < 0 || candidate > 2) {
        return fallback;
      }
      return candidate;
    };
    const legacyPrompt = (parsed as { transcriptionPrompt?: unknown }).transcriptionPrompt;
    if (typeof legacyPrompt === 'string' && legacyPrompt.trim()) {
      if (!merged.openaiTranscriptionPrompt?.trim()) {
        merged.openaiTranscriptionPrompt = legacyPrompt;
      }
      if (!merged.geminiTranscriptionPrompt?.trim()) {
        merged.geminiTranscriptionPrompt = legacyPrompt;
      }
    }
    if (!merged.openaiTranslationPrompt?.trim()) {
      merged.openaiTranslationPrompt = DEFAULT_TRANSLATION_PROMPT_PREFIX;
    }
    if (!merged.geminiTranslationPrompt?.trim()) {
      merged.geminiTranslationPrompt = DEFAULT_TRANSLATION_PROMPT_PREFIX;
    }
    if (!VALID_TRANSCRIPTION_ENGINES.has(merged.transcriptionEngine)) {
      merged.transcriptionEngine = defaultSettings.transcriptionEngine;
    }
    merged.openaiTitleTemperature = normalizeTemperature(
      merged.openaiTitleTemperature,
      defaultSettings.openaiTitleTemperature
    );
    merged.openaiConversationTemperature = normalizeTemperature(
      merged.openaiConversationTemperature,
      defaultSettings.openaiConversationTemperature
    );
    merged.openaiAssistantTemperature = normalizeTemperature(
      merged.openaiAssistantTemperature,
      defaultSettings.openaiAssistantTemperature
    );
    merged.openaiQaTemperature = normalizeTemperature(
      merged.openaiQaTemperature,
      defaultSettings.openaiQaTemperature
    );
    merged.openaiTranslationTemperature = normalizeTemperature(
      merged.openaiTranslationTemperature,
      defaultSettings.openaiTranslationTemperature
    );
    if (parsed.conversationSummaryEngine === undefined) {
      merged.conversationSummaryEngine = parsed.titleSummaryEngine ?? defaultSettings.titleSummaryEngine;
    }
    if (parsedCredentials.openaiConversationModel === undefined && merged.credentials.openaiTitleModel) {
      merged.credentials.openaiConversationModel = merged.credentials.openaiTitleModel;
    }
    if (parsedCredentials.geminiConversationModel === undefined && merged.credentials.geminiTitleModel) {
      merged.credentials.geminiConversationModel = merged.credentials.geminiTitleModel;
    }
    if (parsed.assistantEngine === undefined) {
      merged.assistantEngine = merged.conversationSummaryEngine ?? defaultSettings.assistantEngine;
    }
    if (!merged.assistantPrompt?.trim()) {
      merged.assistantPrompt = defaultSettings.assistantPrompt;
    }
    if (parsedCredentials.openaiAssistantModel === undefined && merged.credentials.openaiConversationModel) {
      merged.credentials.openaiAssistantModel = merged.credentials.openaiConversationModel;
    }
    if (parsedCredentials.geminiAssistantModel === undefined && merged.credentials.geminiConversationModel) {
      merged.credentials.geminiAssistantModel = merged.credentials.geminiConversationModel;
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
    if (!Array.isArray(parsed.recordingPresets)) {
      merged.recordingPresets = [];
    } else {
      merged.recordingPresets = parsed.recordingPresets
        .map((preset) => {
          if (!preset || typeof preset !== 'object') {
            return null;
          }
          const candidate = preset as Partial<RecordingPreset>;
          if (typeof candidate.id !== 'string' || typeof candidate.name !== 'string') {
            return null;
          }
          const normalize = <T extends number>(value: unknown, fallback: T): T => {
            const numeric = Number(value);
            return Number.isFinite(numeric) ? (numeric as T) : fallback;
          };
          return {
            id: candidate.id,
            name: candidate.name,
            activationThreshold: normalize(
              candidate.activationThreshold,
              defaultSettings.activationThreshold
            ),
            activationDurationSec: normalize(
              candidate.activationDurationSec,
              defaultSettings.activationDurationSec
            ),
            silenceDurationSec: normalize(
              candidate.silenceDurationSec,
              defaultSettings.silenceDurationSec
            ),
            preRollDurationSec: normalize(
              candidate.preRollDurationSec,
              defaultSettings.preRollDurationSec
            ),
            maxSegmentDurationSec: normalize(
              candidate.maxSegmentDurationSec,
              defaultSettings.maxSegmentDurationSec
            ),
          } satisfies RecordingPreset;
        })
        .filter(Boolean) as RecordingPreset[];
    }
    if (typeof merged.activeRecordingPresetId !== 'string') {
      merged.activeRecordingPresetId = null;
    } else if (!merged.recordingPresets.some((preset) => preset.id === merged.activeRecordingPresetId)) {
      merged.activeRecordingPresetId = null;
    }
    if (typeof merged.desktopAudioInputId !== 'string' || !merged.desktopAudioInputId.trim()) {
      merged.desktopAudioInputId = null;
    }
    if (typeof merged.showQaTab !== 'boolean') {
      merged.showQaTab = defaultSettings.showQaTab;
    }
    if (typeof merged.showReadingTab !== 'boolean') {
      merged.showReadingTab = defaultSettings.showReadingTab;
    }
    return normalizeRuntimeSettings(merged);
  } catch (error) {
    console.warn('[settings] Failed to restore persisted settings', error);
    return null;
  }
}

async function persistSettings(settings: AppSettings) {
  try {
    // Separate sensitive credentials from other settings
    const { credentials, ...nonSensitiveSettings } = settings;

    // Store non-sensitive settings in AsyncStorage
    const settingsToStore = {
      ...nonSensitiveSettings,
      credentials: {}, // Don't store credentials in AsyncStorage
    };
    await AsyncStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settingsToStore));

    // Store sensitive credentials in secure storage
    await secureSetCredentials(credentials);
  } catch (error) {
    if (__DEV__) {
      console.warn('[settings] Failed to persist settings', error);
    }
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
        const next = normalizeRuntimeSettings(updater(prev));
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
    // Clear secure storage when resetting
    secureClearAll().catch((error) => {
      if (__DEV__) {
        console.warn('[settings] Failed to clear secure storage', error);
      }
    });
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
