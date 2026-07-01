import { useEffect, useState } from 'react';

import { Button } from 'heroui-native';
import {
    DEFAULT_GEMINI_TRANSCRIPTION_MODEL,
    DEFAULT_GEMINI_TRANSLATION_MODEL,
    DEFAULT_GLM_TRANSCRIPTION_MODEL,
    DEFAULT_OPENAI_BASE_URL,
    DEFAULT_OPENAI_REALTIME_DELAY,
    DEFAULT_OPENAI_REALTIME_TRANSCRIPTION_MODEL,
    DEFAULT_OPENAI_TRANSCRIPTION_MODEL,
    DEFAULT_OPENAI_TRANSLATION_MODEL,
    DEFAULT_QWEN_TRANSCRIPTION_MODEL,
} from '@/services/transcription';
import {
    AppSettings,
    DEFAULT_ASSISTANT_PROMPT,
    DEFAULT_CONVERSATION_SUMMARY_PROMPT,
    DEFAULT_GEMINI_ASSISTANT_MODEL,
    DEFAULT_GEMINI_CONVERSATION_MODEL,
    DEFAULT_GEMINI_TITLE_MODEL,
    DEFAULT_GEMINI_TTS_MODEL,
    DEFAULT_OPENAI_ASSISTANT_MODEL,
    DEFAULT_OPENAI_CONVERSATION_MODEL,
    DEFAULT_OPENAI_TITLE_MODEL,
    DEFAULT_OPENAI_TTS_MODEL,
    DEFAULT_OPENAI_TTS_VOICE,
    DEFAULT_OPENAI_ASSISTANT_TEMPERATURE,
    DEFAULT_OPENAI_CONVERSATION_TEMPERATURE,
    DEFAULT_OPENAI_QA_TEMPERATURE,
    DEFAULT_OPENAI_TITLE_TEMPERATURE,
    DEFAULT_OPENAI_TRANSLATION_TEMPERATURE,
    DEFAULT_TRANSLATION_PROMPT_PREFIX,
} from '@/types/settings';

export type NumericSettingKey =
  | 'activationThreshold'
  | 'activationDurationSec'
  | 'silenceDurationSec'
  | 'preRollDurationSec'
  | 'maxSegmentDurationSec';

export interface FormState {
  activationThreshold: string;
  activationDurationSec: string;
  silenceDurationSec: string;
  preRollDurationSec: string;
  maxSegmentDurationSec: string;
  transcriptionLanguage: string;
  openaiTranscriptionPrompt: string;
  geminiTranscriptionPrompt: string;
  openaiTranslationPrompt: string;
  geminiTranslationPrompt: string;
  titleSummaryPrompt: string;
  conversationSummaryPrompt: string;
  openaiTitleTemperature: string;
  openaiConversationTemperature: string;
  openaiAssistantTemperature: string;
  openaiQaTemperature: string;
  openaiTranslationTemperature: string;
  assistantPrompt: string;
  qaPrompt: string;
  ttsPrompt: string;
  ttsVoice: string;
  openaiApiKey: string;
  openaiBaseUrl: string;
  openaiTranscriptionModel: string;
  openaiRealtimeTranscriptionModel: string;
  openaiRealtimeDelay: string;
  openaiTranslationModel: string;
  openaiTtsModel: string;
  openaiTitleModel: string;
  openaiConversationModel: string;
  openaiAssistantModel: string;
  openaiQaModel: string;
  geminiApiKey: string;
  geminiTranscriptionModel: string;
  geminiTranslationModel: string;
  geminiTtsModel: string;
  geminiTitleModel: string;
  geminiConversationModel: string;
  geminiAssistantModel: string;
  geminiQaModel: string;
  sonioxApiKey: string;
  qwenApiKey: string;
  qwenTranscriptionModel: string;
  glmApiKey: string;
  glmTranscriptionModel: string;
  doubaoAppId: string;
  doubaoToken: string;
  doubaoCluster: string;
}

export const initialFormState = (settings: AppSettings): FormState => ({
  activationThreshold: String(settings.activationThreshold),
  activationDurationSec: String(settings.activationDurationSec),
  silenceDurationSec: String(settings.silenceDurationSec),
  preRollDurationSec: String(settings.preRollDurationSec),
  maxSegmentDurationSec: String(settings.maxSegmentDurationSec),
  transcriptionLanguage: settings.transcriptionLanguage,
  openaiTranscriptionPrompt: settings.openaiTranscriptionPrompt ?? '',
  geminiTranscriptionPrompt: settings.geminiTranscriptionPrompt ?? '',
  openaiTranslationPrompt: settings.openaiTranslationPrompt?.trim()
    ? settings.openaiTranslationPrompt
    : DEFAULT_TRANSLATION_PROMPT_PREFIX,
  geminiTranslationPrompt: settings.geminiTranslationPrompt?.trim()
    ? settings.geminiTranslationPrompt
    : DEFAULT_TRANSLATION_PROMPT_PREFIX,
  titleSummaryPrompt: settings.titleSummaryPrompt,
  conversationSummaryPrompt:
    settings.conversationSummaryPrompt || DEFAULT_CONVERSATION_SUMMARY_PROMPT,
  openaiTitleTemperature: String(
    settings.openaiTitleTemperature ?? DEFAULT_OPENAI_TITLE_TEMPERATURE
  ),
  openaiConversationTemperature: String(
    settings.openaiConversationTemperature ?? DEFAULT_OPENAI_CONVERSATION_TEMPERATURE
  ),
  openaiAssistantTemperature: String(
    settings.openaiAssistantTemperature ?? DEFAULT_OPENAI_ASSISTANT_TEMPERATURE
  ),
  openaiQaTemperature: String(
    settings.openaiQaTemperature ?? DEFAULT_OPENAI_QA_TEMPERATURE
  ),
  openaiTranslationTemperature: String(
    settings.openaiTranslationTemperature ?? DEFAULT_OPENAI_TRANSLATION_TEMPERATURE
  ),
  assistantPrompt: settings.assistantPrompt || DEFAULT_ASSISTANT_PROMPT,
  qaPrompt: settings.qaPrompt,
  ttsPrompt: settings.ttsPrompt ?? '',
  ttsVoice: settings.ttsVoice ?? DEFAULT_OPENAI_TTS_VOICE,
  openaiApiKey: settings.credentials.openaiApiKey ?? '',
  openaiBaseUrl: settings.credentials.openaiBaseUrl ?? DEFAULT_OPENAI_BASE_URL,
  openaiTranscriptionModel:
    settings.credentials.openaiTranscriptionModel ?? DEFAULT_OPENAI_TRANSCRIPTION_MODEL,
  openaiRealtimeTranscriptionModel:
    settings.credentials.openaiRealtimeTranscriptionModel ??
    DEFAULT_OPENAI_REALTIME_TRANSCRIPTION_MODEL,
  openaiRealtimeDelay:
    settings.credentials.openaiRealtimeDelay ?? DEFAULT_OPENAI_REALTIME_DELAY,
  openaiTranslationModel:
    settings.credentials.openaiTranslationModel ?? DEFAULT_OPENAI_TRANSLATION_MODEL,
  openaiTtsModel: settings.credentials.openaiTtsModel ?? DEFAULT_OPENAI_TTS_MODEL,
  openaiTitleModel:
    settings.credentials.openaiTitleModel ?? DEFAULT_OPENAI_TITLE_MODEL,
  openaiConversationModel:
    settings.credentials.openaiConversationModel ?? DEFAULT_OPENAI_CONVERSATION_MODEL,
  openaiAssistantModel:
    settings.credentials.openaiAssistantModel ??
    settings.credentials.openaiConversationModel ??
    DEFAULT_OPENAI_ASSISTANT_MODEL,
  openaiQaModel: settings.credentials.openaiQaModel ?? settings.credentials.openaiConversationModel ?? DEFAULT_OPENAI_CONVERSATION_MODEL,
  geminiApiKey: settings.credentials.geminiApiKey ?? '',
  geminiTranscriptionModel:
    settings.credentials.geminiTranscriptionModel ?? DEFAULT_GEMINI_TRANSCRIPTION_MODEL,
  geminiTranslationModel:
    settings.credentials.geminiTranslationModel ?? DEFAULT_GEMINI_TRANSLATION_MODEL,
  geminiTtsModel: settings.credentials.geminiTtsModel ?? DEFAULT_GEMINI_TTS_MODEL,
  geminiTitleModel:
    settings.credentials.geminiTitleModel ?? DEFAULT_GEMINI_TITLE_MODEL,
  geminiConversationModel:
    settings.credentials.geminiConversationModel ?? DEFAULT_GEMINI_CONVERSATION_MODEL,
  geminiAssistantModel:
    settings.credentials.geminiAssistantModel ??
    settings.credentials.geminiConversationModel ??
    DEFAULT_GEMINI_ASSISTANT_MODEL,
  geminiQaModel: settings.credentials.geminiQaModel ?? settings.credentials.geminiConversationModel ?? DEFAULT_GEMINI_CONVERSATION_MODEL,
  sonioxApiKey: settings.credentials.sonioxApiKey ?? '',
  qwenApiKey: settings.credentials.qwenApiKey ?? '',
  qwenTranscriptionModel:
    settings.credentials.qwenTranscriptionModel ?? DEFAULT_QWEN_TRANSCRIPTION_MODEL,
  glmApiKey: settings.credentials.glmApiKey ?? '',
  glmTranscriptionModel:
    settings.credentials.glmTranscriptionModel ?? DEFAULT_GLM_TRANSCRIPTION_MODEL,
  doubaoAppId: settings.credentials.doubaoAppId ?? '',
  doubaoToken: settings.credentials.doubaoToken ?? '',
  doubaoCluster: settings.credentials.doubaoCluster ?? '',
});

export function useSettingsForm(settings: AppSettings) {
  const [formState, setFormState] = useState<FormState>(() => initialFormState(settings));

  useEffect(() => {
    setFormState(initialFormState(settings));
  }, [settings]);

  return { formState, setFormState } as const;
}

export function formatNumberInput(value: string) {
  return value.replace(/[^0-9.]/g, '');
}

export function OptionPill({
  label,
  active,
  onPress,
  disabled,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <Button
      isDisabled={disabled}
      onPress={onPress}
      size="sm"
      variant={active ? 'primary' : 'secondary'}>
      <Button.Label numberOfLines={1}>{label}</Button.Label>
    </Button>
  );
}
