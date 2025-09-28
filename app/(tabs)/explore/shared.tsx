import { useEffect, useState } from 'react';
import { Pressable, StyleSheet } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import {
  DEFAULT_GEMINI_TRANSLATION_MODEL,
  DEFAULT_OPENAI_BASE_URL,
  DEFAULT_OPENAI_TRANSCRIPTION_MODEL,
  DEFAULT_OPENAI_TRANSLATION_MODEL,
  DEFAULT_QWEN_TRANSCRIPTION_MODEL,
} from '@/services/transcription';
import { AppSettings, DEFAULT_GEMINI_TITLE_MODEL, DEFAULT_OPENAI_TITLE_MODEL } from '@/types/settings';

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
  openaiApiKey: string;
  openaiBaseUrl: string;
  openaiTranscriptionModel: string;
  openaiTranslationModel: string;
  openaiTitleModel: string;
  geminiApiKey: string;
  geminiTranslationModel: string;
  geminiTitleModel: string;
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
  openaiApiKey: settings.credentials.openaiApiKey ?? '',
  openaiBaseUrl: settings.credentials.openaiBaseUrl ?? DEFAULT_OPENAI_BASE_URL,
  openaiTranscriptionModel:
    settings.credentials.openaiTranscriptionModel ?? DEFAULT_OPENAI_TRANSCRIPTION_MODEL,
  openaiTranslationModel:
    settings.credentials.openaiTranslationModel ?? DEFAULT_OPENAI_TRANSLATION_MODEL,
  openaiTitleModel:
    settings.credentials.openaiTitleModel ?? DEFAULT_OPENAI_TITLE_MODEL,
  geminiApiKey: settings.credentials.geminiApiKey ?? '',
  geminiTranslationModel:
    settings.credentials.geminiTranslationModel ?? DEFAULT_GEMINI_TRANSLATION_MODEL,
  geminiTitleModel:
    settings.credentials.geminiTitleModel ?? DEFAULT_GEMINI_TITLE_MODEL,
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
  return (
    <Pressable
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [settingsStyles.optionPressable, pressed && !disabled && settingsStyles.optionPressed]}>
      <ThemedView
        lightColor={active ? '#0ea5e9' : 'rgba(148, 163, 184, 0.16)'}
        darkColor={active ? '#0284c7' : 'rgba(148, 163, 184, 0.18)'}
        style={[
          settingsStyles.optionPill,
          active && settingsStyles.optionPillActive,
          disabled && settingsStyles.optionPillDisabled,
        ]}>
        <ThemedText style={settingsStyles.optionPillText} lightColor="#fff" darkColor="#fff">
          {label}
        </ThemedText>
      </ThemedView>
    </Pressable>
  );
}

export const settingsStyles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  safeAreaLight: {
    backgroundColor: '#f1f5f9',
  },
  safeAreaDark: {
    backgroundColor: '#020617',
  },
  flex: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    gap: 24,
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
  optionPressable: {
    borderRadius: 999,
  },
  optionPressed: {
    opacity: 0.8,
  },
  optionPill: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 999,
  },
  optionPillActive: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.18,
    shadowRadius: 10,
    elevation: 4,
  },
  optionPillDisabled: {
    opacity: 0.4,
  },
  optionPillText: {
    fontSize: 14,
    fontWeight: '600',
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