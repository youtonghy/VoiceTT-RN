import type { ReactNode } from 'react';
import { useEffect, useState } from 'react';
import { StyleSheet, type StyleProp, type ViewStyle } from 'react-native';

import { Button, Card } from 'heroui-native';
import {
    DEFAULT_GEMINI_TRANSCRIPTION_MODEL,
    DEFAULT_GEMINI_TRANSLATION_MODEL,
    DEFAULT_GLM_TRANSCRIPTION_MODEL,
    DEFAULT_OPENAI_BASE_URL,
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

export const settingsStyles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  safeAreaLight: {
    backgroundColor: '#fbfaf7',
  },
  safeAreaDark: {
    backgroundColor: '#1f1a16',
  },
  flex: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingVertical: 16,
    gap: 14,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
  },
  sectionTitleDark: {
    color: '#e2e8f0',
  },
  fieldRow: {
    gap: 6,
  },
  fieldLabel: {
    fontSize: 14,
    opacity: 0.7,
  },
  fieldLabelDark: {
    opacity: 0.9,
  },
  input: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.4)',
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    color: '#0f172a',
    backgroundColor: '#fff',
  },
  inputDark: {
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    borderColor: 'rgba(148, 163, 184, 0.35)',
    color: '#e2e8f0',
  },
  optionsRow: {
    flexDirection: 'row',
    gap: 12,
    flexWrap: 'wrap',
  },
  groupLabel: {
    fontSize: 14,
    opacity: 0.7,
  },
  groupLabelDark: {
    opacity: 0.85,
  },
  rowBetween: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  pageHeader: {
    gap: 6,
    marginBottom: 12,
  },
  pageTitle: {
    fontSize: 32,
    lineHeight: 38,
    fontWeight: '700',
  },
  cardLabel: {
    fontSize: 13,
    opacity: 0.75,
  },
  cardLabelDark: {
    opacity: 0.9,
  },
});

export const SETTINGS_CARD_GRADIENTS = {
  openai: ['#22d3ee', '#6366f1', '#a855f7'],
  gemini: ['#34d399', '#22d3ee', '#2563eb'],
  soniox: ['#f97316', '#fb7185', '#ec4899'],
  qwen: ['#a855f7', '#6366f1', '#14b8a6'],
  glm: ['#0ea5e9', '#22c55e', '#6366f1'],
  interaction: ['#38bdf8', '#6366f1', '#c084fc'],
  prompt: ['#fb7185', '#f97316', '#a855f7'],
  system: ['#fbbf24', '#f97316', '#ef4444'],
} as const;

export type SettingsCardVariant = keyof typeof SETTINGS_CARD_GRADIENTS;

export const CARD_TEXT_LIGHT = '#29231d';
export const CARD_TEXT_DARK = '#f7f2eb';

export const CARD_SUBTLE_LIGHT = '#6f6256';
export const CARD_SUBTLE_DARK = '#c5b8aa';

export function SettingsCard({
  variant = 'interaction',
  children,
  style,
  contentStyle,
}: {
  variant?: SettingsCardVariant;
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  contentStyle?: StyleProp<ViewStyle>;
}) {
  void variant;
  return (
    <Card className="border border-border bg-surface" style={[cardStyles.surface, style]}>
      <Card.Body style={[cardStyles.content, contentStyle]}>
        {children}
      </Card.Body>
    </Card>
  );
}

const cardStyles = StyleSheet.create({
  surface: {
    borderRadius: 16,
    padding: 0,
    overflow: 'hidden',
    shadowColor: 'transparent',
    shadowOpacity: 0,
    shadowRadius: 0,
    shadowOffset: { width: 0, height: 0 },
    elevation: 0,
  },
  content: {
    gap: 14,
    padding: 16,
  },
});

// Default export required for route
export default function SharedScreen() {
  return null;
}
