export type TranscriptionEngine = 'openai' | 'qwen3' | 'soniox';

export type TranslationEngine = 'openai' | 'gemini' | 'none';

export interface EngineCredentials {
  openaiApiKey?: string;
  openaiBaseUrl?: string;
  openaiTranscriptionModel?: string;
  openaiTranslationModel?: string;
  geminiApiKey?: string;
  geminiTranslationModel?: string;
  sonioxApiKey?: string;
  qwenApiKey?: string;
  qwenTranscriptionModel?: string;
}

export interface TranscriptionSettings {
  activationThreshold: number; // RMS threshold (0-1)
  activationDurationSec: number; // seconds above threshold to start
  silenceDurationSec: number; // seconds below threshold to end
  preRollDurationSec: number; // seconds to keep before activation
  maxSegmentDurationSec: number;
  transcriptionEngine: TranscriptionEngine;
  transcriptionLanguage: string; // e.g., 'auto'
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
  transcriptionLanguage: 'auto',
  translationEngine: 'openai',
  translationTargetLanguage: 'en',
  translationTimeoutSec: 20,
  enableTranslation: true,
  enableAutoStart: false,
  credentials: {
    openaiBaseUrl: 'https://api.openai.com',
    openaiTranscriptionModel: 'gpt-4o-transcribe',
    openaiTranslationModel: 'gpt-4o-mini',
    geminiTranslationModel: 'gemini-2.5-flash',
    qwenTranscriptionModel: 'Qwen3-ASR',
  },
};
