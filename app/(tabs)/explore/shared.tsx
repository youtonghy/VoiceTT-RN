import { useEffect, useState } from 'react';
import { StyleSheet } from 'react-native';
import { Chip, useTheme } from 'react-native-paper';

import {
  DEFAULT_GEMINI_TRANSLATION_MODEL,
  DEFAULT_OPENAI_BASE_URL,
  DEFAULT_OPENAI_TRANSCRIPTION_MODEL,
  DEFAULT_OPENAI_TRANSLATION_MODEL,
  DEFAULT_QWEN_TRANSCRIPTION_MODEL,
} from '@/services/transcription';
import {
  AppSettings,
  DEFAULT_CONVERSATION_SUMMARY_PROMPT,
  DEFAULT_GEMINI_CONVERSATION_MODEL,
  DEFAULT_GEMINI_TITLE_MODEL,
  DEFAULT_OPENAI_CONVERSATION_MODEL,
  DEFAULT_OPENAI_TITLE_MODEL,
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
  titleSummaryPrompt: string;
  conversationSummaryPrompt: string;
  openaiApiKey: string;
  openaiBaseUrl: string;
  openaiTranscriptionModel: string;
  openaiTranslationModel: string;
  openaiTitleModel: string;
  openaiConversationModel: string;
  geminiApiKey: string;
  geminiTranslationModel: string;
  geminiTitleModel: string;
  geminiConversationModel: string;
  sonioxApiKey: string;
  qwenApiKey: string;
  qwenTranscriptionModel: string;
}

export const initialFormState = (settings: AppSettings): FormState => ({
  activationThreshold: String(settings.activationThreshold),
  activationDurationSec: String(settings.activationDurationSec),
  silenceDurationSec: String(settings.silenceDurationSec),
  preRollDurationSec: String(settings.preRollDurationSec),
  maxSegmentDurationSec: String(settings.maxSegmentDurationSec),
  transcriptionLanguage: settings.transcriptionLanguage,
  titleSummaryPrompt: settings.titleSummaryPrompt,
  conversationSummaryPrompt:
    settings.conversationSummaryPrompt || DEFAULT_CONVERSATION_SUMMARY_PROMPT,
  openaiApiKey: settings.credentials.openaiApiKey ?? '',
  openaiBaseUrl: settings.credentials.openaiBaseUrl ?? DEFAULT_OPENAI_BASE_URL,
  openaiTranscriptionModel:
    settings.credentials.openaiTranscriptionModel ?? DEFAULT_OPENAI_TRANSCRIPTION_MODEL,
  openaiTranslationModel:
    settings.credentials.openaiTranslationModel ?? DEFAULT_OPENAI_TRANSLATION_MODEL,
  openaiTitleModel:
    settings.credentials.openaiTitleModel ?? DEFAULT_OPENAI_TITLE_MODEL,
  openaiConversationModel:
    settings.credentials.openaiConversationModel ?? DEFAULT_OPENAI_CONVERSATION_MODEL,
  geminiApiKey: settings.credentials.geminiApiKey ?? '',
  geminiTranslationModel:
    settings.credentials.geminiTranslationModel ?? DEFAULT_GEMINI_TRANSLATION_MODEL,
  geminiTitleModel:
    settings.credentials.geminiTitleModel ?? DEFAULT_GEMINI_TITLE_MODEL,
  geminiConversationModel:
    settings.credentials.geminiConversationModel ?? DEFAULT_GEMINI_CONVERSATION_MODEL,
  sonioxApiKey: settings.credentials.sonioxApiKey ?? '',
  qwenApiKey: settings.credentials.qwenApiKey ?? '',
  qwenTranscriptionModel:
    settings.credentials.qwenTranscriptionModel ?? DEFAULT_QWEN_TRANSCRIPTION_MODEL,
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
  const theme = useTheme();
  const containerColor = active
    ? theme.colors.secondaryContainer
    : theme.colors.surfaceVariant;
  const textColor = active ? theme.colors.onSecondaryContainer : theme.colors.onSurfaceVariant;

  return (
    <Chip
      mode="flat"
      selected={active}
      showSelectedCheck
      disabled={disabled}
      onPress={onPress}
      style={[styles.optionChip, { backgroundColor: containerColor }]}
      textStyle={[styles.optionChipLabel, { color: textColor }]}
      accessibilityRole="button"
      accessibilityState={{ selected: active, disabled }}
    >
      {label}
    </Chip>
  );
}

export const settingsStyles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  flex: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 24,
    gap: 24,
  },
  optionsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    rowGap: 12,
    columnGap: 12,
  },
  rowBetween: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    columnGap: 16,
  },
  pageHeader: {
    gap: 8,
    marginBottom: 12,
  },
  sectionCard: {
    borderRadius: 20,
    padding: 20,
    gap: 16,
  },
});

const styles = StyleSheet.create({
  optionChip: {
    borderRadius: 999,
  },
  optionChipLabel: {
    fontWeight: '600',
  },
});
