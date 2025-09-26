export type TranscriptionEngine = 'openai' | 'qwen3' | 'soniox';

export type TranslationEngine = 'openai' | 'gemini' | 'none';

export interface EngineCredentials {
  openaiApiKey?: string;
  openaiBaseUrl?: string;
  sonioxApiKey?: string;
  qwenAppId?: string;
  qwenApiKey?: string;
  geminiApiKey?: string;
}

export interface TranscriptionSettings {
  activationThreshold: number; // RMS threshold (0-1)
  activationDurationSec: number; // seconds above threshold to start
  silenceDurationSec: number; // seconds below threshold to end
  preRollDurationSec: number; // seconds to keep before activation
  maxSegmentDurationSec: number;
  transcriptionEngine: TranscriptionEngine;
  transcriptionModel: string;
  transcriptionLanguage: string; // e.g., 'auto'
  translationModel: string;
  translationEngine: TranslationEngine;
  translationTargetLanguage: string;
  translationTimeoutSec: number;
  enableTranslation: boolean;
  enableAutoStart: boolean;
}

export interface AppSettings extends TranscriptionSettings {
  credentials: EngineCredentials;
}

export const defaultSettings: AppSettings = {
  activationThreshold: 0.01,
  activationDurationSec: 0.6,
  silenceDurationSec: 1.0,
  preRollDurationSec: 1.0,
  maxSegmentDurationSec: 300,
  transcriptionEngine: 'openai',
  transcriptionModel: 'gpt-4o-transcribe',
  transcriptionLanguage: 'auto',
  translationModel: 'gpt-4o-mini-translate',
  translationEngine: 'openai',
  translationTargetLanguage: 'en',
  translationTimeoutSec: 20,
  enableTranslation: true,
  enableAutoStart: false,
  credentials: {},
};
