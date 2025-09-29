export type TranscriptionEngine = 'openai' | 'qwen3' | 'soniox';

export type TranslationEngine = 'openai' | 'gemini' | 'none';

export type TitleSummaryEngine = 'openai' | 'gemini';
export type ConversationSummaryEngine = 'openai' | 'gemini';
export type QaEngine = 'openai' | 'gemini';

export interface EngineCredentials {
  openaiApiKey?: string;
  openaiBaseUrl?: string;
  openaiTranscriptionModel?: string;
  openaiTranslationModel?: string;
  openaiTitleModel?: string;
  openaiConversationModel?: string;
  openaiQaModel?: string;
  geminiApiKey?: string;
  geminiTranslationModel?: string;
  geminiTitleModel?: string;
  geminiConversationModel?: string;
  geminiQaModel?: string;
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
export const DEFAULT_OPENAI_CONVERSATION_MODEL = DEFAULT_OPENAI_TITLE_MODEL;
export const DEFAULT_GEMINI_CONVERSATION_MODEL = DEFAULT_GEMINI_TITLE_MODEL;
export const DEFAULT_CONVERSATION_SUMMARY_PROMPT =
  'You are a helpful assistant who writes detailed conversation summaries in the same language as the transcript. Produce 2-4 sentences that capture the main topics, decisions, and follow-up actions. Avoid fabricating details and never include sensitive personal data.';
export const DEFAULT_OPENAI_QA_MODEL = DEFAULT_OPENAI_CONVERSATION_MODEL;
export const DEFAULT_GEMINI_QA_MODEL = DEFAULT_GEMINI_CONVERSATION_MODEL;
export const DEFAULT_QA_QUESTION_PROMPT =
  "You are a real-time call assistant. Given a recent transcript segment, list up to three distinct questions that were asked or clearly implied. Respond in JSON with an object containing a questions array of strings in the same language as the transcript. If there is no question, return an empty array.";
export const DEFAULT_QA_ANSWER_PROMPT =
  "You are a real-time call assistant. Given a transcript segment and a list of questions, provide concise factual answers using only the transcript content. Respond in JSON with an object containing an items array where each element includes question and answer fields in the same language. If an answer cannot be derived, use an empty string.";
export interface AppSettings extends TranscriptionSettings {
  titleSummaryEngine: TitleSummaryEngine;
  titleSummaryPrompt: string;
  conversationSummaryEngine: ConversationSummaryEngine;
  conversationSummaryPrompt: string;
  qaEngine: QaEngine;
  qaQuestionPrompt: string;
  qaAnswerPrompt: string;
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
  conversationSummaryEngine: 'openai',
  conversationSummaryPrompt: DEFAULT_CONVERSATION_SUMMARY_PROMPT,
  qaEngine: 'openai',
  qaQuestionPrompt: DEFAULT_QA_QUESTION_PROMPT,
  qaAnswerPrompt: DEFAULT_QA_ANSWER_PROMPT,
  credentials: {
    openaiBaseUrl: 'https://api.openai.com',
    openaiTranscriptionModel: 'gpt-4o-transcribe',
    openaiTranslationModel: 'gpt-4o-mini',
    openaiTitleModel: DEFAULT_OPENAI_TITLE_MODEL,
    openaiConversationModel: DEFAULT_OPENAI_CONVERSATION_MODEL,
    openaiQaModel: DEFAULT_OPENAI_QA_MODEL,
    geminiTranslationModel: 'gemini-2.5-flash',
    geminiTitleModel: DEFAULT_GEMINI_TITLE_MODEL,
    geminiConversationModel: DEFAULT_GEMINI_CONVERSATION_MODEL,
    geminiQaModel: DEFAULT_GEMINI_QA_MODEL,
    qwenTranscriptionModel: 'Qwen3-ASR',
  },
};





