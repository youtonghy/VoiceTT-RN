export interface SettingsPromoCard {
  id: string;
  href: string;
  gradient: string[];
  glowColor: string;
  sheenColor: string;
}

export const proVersionPromoCard: SettingsPromoCard = {
  id: 'pro-version',
  href: 'https://vtt.tokisantike.net/pro.html',
  gradient: ['#052e16', '#047857', '#22c55e', '#bbf7d0'],
  glowColor: 'rgba(74, 222, 128, 0.35)',
  sheenColor: 'rgba(16, 185, 129, 0.5)',
};

export type TranscriptionEngine = 'openai' | 'gemini' | 'qwen3' | 'soniox' | 'doubao' | 'glm';

export type TranslationEngine = 'openai' | 'gemini' | 'none';
export type VoiceInputEngine = TranscriptionEngine;
export type TtsEngine = 'openai' | 'gemini';

export type TitleSummaryEngine = 'openai' | 'gemini';
export type ConversationSummaryEngine = 'openai' | 'gemini';
export type QaEngine = 'openai' | 'gemini';

export type ThemeMode = 'automatic' | 'light' | 'dark';

export type AppLanguageMode = 'system' | 'en' | 'zh-Hans';

export interface EngineCredentials {
  openaiApiKey?: string;
  openaiBaseUrl?: string;
  openaiTranscriptionModel?: string;
  openaiTranslationModel?: string;
  openaiTtsModel?: string;
  openaiTitleModel?: string;
  openaiConversationModel?: string;
  openaiQaModel?: string;
  geminiApiKey?: string;
  geminiTranscriptionModel?: string;
  geminiTranslationModel?: string;
  geminiTtsModel?: string;
  geminiTitleModel?: string;
  geminiConversationModel?: string;
  geminiQaModel?: string;
  sonioxApiKey?: string;
  qwenApiKey?: string;
  qwenTranscriptionModel?: string;
  glmApiKey?: string;
  glmTranscriptionModel?: string;
  doubaoAppId?: string;
  doubaoToken?: string;
  doubaoCluster?: string;
}

export interface TranscriptionSettings {
  activationThreshold: number; // RMS threshold (0-1)
  activationDurationSec: number; // seconds above threshold to start
  silenceDurationSec: number; // seconds below threshold to end
  preRollDurationSec: number; // seconds to keep before activation
  maxSegmentDurationSec: number;
  transcriptionEngine: TranscriptionEngine;
  transcriptionLanguage: string; // e.g., 'auto'
  openaiTranscriptionPrompt: string;
  geminiTranscriptionPrompt: string;
  translationEngine: TranslationEngine;
  openaiTranslationPrompt: string;
  geminiTranslationPrompt: string;
  translationTargetLanguage: string;
  translationTimeoutSec: number;
  enableTranslation: boolean;
  enableAutoStart: boolean;
}

export interface RecordingPreset {
  id: string;
  name: string;
  activationThreshold: number;
  activationDurationSec: number;
  silenceDurationSec: number;
  preRollDurationSec: number;
  maxSegmentDurationSec: number;
}

export const DEFAULT_OPENAI_TITLE_MODEL = 'gpt-4o';
export const DEFAULT_OPENAI_TTS_MODEL = 'gpt-4o-mini-tts';
export const DEFAULT_OPENAI_TTS_VOICE = 'alloy';
export const OPENAI_TTS_VOICES = [
  'alloy',
  'ash',
  'ballad',
  'coral',
  'echo',
  'fable',
  'nova',
  'onyx',
  'sage',
  'shimmer',
  'verse',
  'marin',
  'cedar',
] as const;
export const DEFAULT_GEMINI_TTS_MODEL = 'gemini-2.5-flash-preview-tts';
export const DEFAULT_GEMINI_TTS_VOICE = 'Kore';
export const GEMINI_TTS_VOICES = [
  'Zephyr',
  'Puck',
  'Charon',
  'Kore',
  'Fenrir',
  'Leda',
  'Orus',
  'Aoede',
  'Callirrhoe',
  'Autonoe',
  'Enceladus',
  'Iapetus',
  'Umbriel',
  'Algieba',
  'Despina',
  'Erinome',
  'Algenib',
  'Rasalgethi',
  'Laomedeia',
  'Achernar',
  'Alnilam',
  'Schedar',
  'Gacrux',
  'Pulcherrima',
  'Achird',
  'Zubenelgenubi',
  'Vindemiatrix',
  'Sadachbia',
  'Sadaltager',
  'Sulafat',
] as const;
export const DEFAULT_GEMINI_TITLE_MODEL = 'gemini-2.5-flash';
export const DEFAULT_TRANSLATION_PROMPT_PREFIX = 'You are a translation engine.';
export const COMMON_TRANSLATION_TARGET_LANGUAGES = [
  { code: 'en', englishName: 'English', i18nKey: 'settings.translation.languages.en' },
  {
    code: 'zh-Hans',
    englishName: 'Chinese (Simplified)',
    i18nKey: 'settings.translation.languages.zh-Hans',
  },
  {
    code: 'zh-Hant',
    englishName: 'Chinese (Traditional)',
    i18nKey: 'settings.translation.languages.zh-Hant',
  },
  { code: 'ja', englishName: 'Japanese', i18nKey: 'settings.translation.languages.ja' },
  { code: 'ko', englishName: 'Korean', i18nKey: 'settings.translation.languages.ko' },
  { code: 'es', englishName: 'Spanish', i18nKey: 'settings.translation.languages.es' },
  { code: 'fr', englishName: 'French', i18nKey: 'settings.translation.languages.fr' },
  { code: 'de', englishName: 'German', i18nKey: 'settings.translation.languages.de' },
  { code: 'pt', englishName: 'Portuguese', i18nKey: 'settings.translation.languages.pt' },
  { code: 'ru', englishName: 'Russian', i18nKey: 'settings.translation.languages.ru' },
  { code: 'ar', englishName: 'Arabic', i18nKey: 'settings.translation.languages.ar' },
  { code: 'hi', englishName: 'Hindi', i18nKey: 'settings.translation.languages.hi' },
] as const;

export type TranslationTargetLanguageCode =
  (typeof COMMON_TRANSLATION_TARGET_LANGUAGES)[number]['code'];

export function resolveTranslationTargetLanguageEnglishName(code: string): string {
  const match = COMMON_TRANSLATION_TARGET_LANGUAGES.find((item) => item.code === code);
  return match?.englishName ?? code;
}
export const DEFAULT_TITLE_SUMMARY_PROMPT =
  'You are an assistant who writes short, descriptive conversation titles in the same language as the provided transcript. Respond with a concise noun phrase under twelve words. Never disclose sensitive or personal data.';
export const DEFAULT_OPENAI_CONVERSATION_MODEL = DEFAULT_OPENAI_TITLE_MODEL;
export const DEFAULT_GEMINI_CONVERSATION_MODEL = DEFAULT_GEMINI_TITLE_MODEL;
export const DEFAULT_CONVERSATION_SUMMARY_PROMPT =
  'You are a helpful assistant who writes detailed conversation summaries in the same language as the transcript. Produce 2-4 sentences that capture the main topics, decisions, and follow-up actions. Avoid fabricating details and never include sensitive personal data.';
export const DEFAULT_OPENAI_QA_MODEL = DEFAULT_OPENAI_CONVERSATION_MODEL;
export const DEFAULT_GEMINI_QA_MODEL = DEFAULT_GEMINI_CONVERSATION_MODEL;
export const DEFAULT_QA_PROMPT =
  'You are a helpful real-time call assistant. Given a transcript segment, extract up to three clear questions that are asked or implied. For each question, provide a comprehensive and accurate answer. You should reference the transcript context when it contains relevant information, but you are not limited to the context - use your knowledge to provide the most helpful and complete answer possible. Respond in JSON format with an `items` array containing objects with `question` and `answer` fields. Use the same language as the transcript. If there are no questions, return an empty array. IMPORTANT: Extract only the question text itself without additional commentary.';

export interface AppSettings extends TranscriptionSettings {
  voiceInputEngine: VoiceInputEngine;
  ttsEngine: TtsEngine;
  ttsPrompt: string;
  ttsVoice: string;
  titleSummaryEngine: TitleSummaryEngine;
  titleSummaryPrompt: string;
  conversationSummaryEngine: ConversationSummaryEngine;
  conversationSummaryPrompt: string;
  qaEngine: QaEngine;
  qaPrompt: string;
  themeMode: ThemeMode;
  languageMode: AppLanguageMode;
  credentials: EngineCredentials;
  recordingPresets: RecordingPreset[];
  activeRecordingPresetId: string | null;
}

export const defaultSettings: AppSettings = {
  activationThreshold: 0.01,
  activationDurationSec: 0.6,
  silenceDurationSec: 1.0,
  preRollDurationSec: 1.0,
  maxSegmentDurationSec: 300,
  transcriptionEngine: 'openai',
  voiceInputEngine: 'openai',
  ttsEngine: 'openai',
  ttsPrompt: '',
  ttsVoice: DEFAULT_OPENAI_TTS_VOICE,
  transcriptionLanguage: 'auto',
  openaiTranscriptionPrompt: '',
  geminiTranscriptionPrompt: '',
  translationEngine: 'openai',
  openaiTranslationPrompt: DEFAULT_TRANSLATION_PROMPT_PREFIX,
  geminiTranslationPrompt: DEFAULT_TRANSLATION_PROMPT_PREFIX,
  translationTargetLanguage: 'en',
  translationTimeoutSec: 20,
  enableTranslation: true,
  enableAutoStart: false,
  titleSummaryEngine: 'openai',
  titleSummaryPrompt: DEFAULT_TITLE_SUMMARY_PROMPT,
  conversationSummaryEngine: 'openai',
  conversationSummaryPrompt: DEFAULT_CONVERSATION_SUMMARY_PROMPT,
  qaEngine: 'openai',
  qaPrompt: DEFAULT_QA_PROMPT,
  themeMode: 'automatic',
  languageMode: 'system',
  credentials: {
    openaiBaseUrl: 'https://api.openai.com',
    openaiTranscriptionModel: 'gpt-4o-transcribe',
    openaiTranslationModel: 'gpt-4o-mini',
    openaiTtsModel: DEFAULT_OPENAI_TTS_MODEL,
    openaiTitleModel: DEFAULT_OPENAI_TITLE_MODEL,
    openaiConversationModel: DEFAULT_OPENAI_CONVERSATION_MODEL,
    openaiQaModel: DEFAULT_OPENAI_QA_MODEL,
    geminiTranscriptionModel: DEFAULT_GEMINI_TITLE_MODEL,
    geminiTranslationModel: 'gemini-2.5-flash',
    geminiTtsModel: DEFAULT_GEMINI_TTS_MODEL,
    geminiTitleModel: DEFAULT_GEMINI_TITLE_MODEL,
    geminiConversationModel: DEFAULT_GEMINI_CONVERSATION_MODEL,
    geminiQaModel: DEFAULT_GEMINI_QA_MODEL,
    qwenTranscriptionModel: 'Qwen3-ASR',
    glmApiKey: '',
    glmTranscriptionModel: 'glm-asr-2512',
    doubaoAppId: '',
    doubaoToken: '',
    doubaoCluster: '',
  },
  recordingPresets: [],
  activeRecordingPresetId: null,
};
