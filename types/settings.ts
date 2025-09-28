export type TranscriptionEngine = 'openai' | 'qwen3' | 'soniox';

export type TranslationEngine = 'openai' | 'gemini' | 'none';

export type TitleSummaryEngine = 'openai' | 'gemini';

export interface EngineCredentials {
  openaiApiKey?: string;
  openaiBaseUrl?: string;
  openaiTranscriptionModel?: string;
  openaiTranslationModel?: string;
  openaiTitleModel?: string;
  geminiApiKey?: string;
  geminiTranslationModel?: string;
  geminiTitleModel?: string;
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

export const DEFAULT_OPENAI_TITLE_MODEL = 'gpt-4o';
export const DEFAULT_GEMINI_TITLE_MODEL = 'gemini-2.5-flash';
export const DEFAULT_TITLE_SUMMARY_PROMPT =
  'You are an assistant who writes short, descriptive conversation titles in the same language as the provided transcript. Respond with a concise noun phrase under twelve words. Never disclose sensitive or personal data.';

export interface AppSettings extends TranscriptionSettings {
  titleSummaryEngine: TitleSummaryEngine;
  titleSummaryPrompt: string;
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
  titleSummaryEngine: 'openai',
  titleSummaryPrompt: DEFAULT_TITLE_SUMMARY_PROMPT,
  credentials: {
    openaiBaseUrl: 'https://api.openai.com',
    openaiTranscriptionModel: 'gpt-4o-transcribe',
    openaiTranslationModel: 'gpt-4o-mini',
    openaiTitleModel: DEFAULT_OPENAI_TITLE_MODEL,
    geminiTranslationModel: 'gemini-2.5-flash',
    geminiTitleModel: DEFAULT_GEMINI_TITLE_MODEL,
    qwenTranscriptionModel: 'Qwen3-ASR',
  },
};
