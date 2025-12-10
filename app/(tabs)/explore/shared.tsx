import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import {
  DEFAULT_GEMINI_TRANSLATION_MODEL,
  DEFAULT_OPENAI_BASE_URL,
  DEFAULT_OPENAI_TRANSCRIPTION_MODEL,
  DEFAULT_OPENAI_TRANSLATION_MODEL,
  DEFAULT_GLM_TRANSCRIPTION_MODEL,
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
import { useColorScheme } from '@/hooks/use-color-scheme';

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
  qaPrompt: string;
  openaiApiKey: string;
  openaiBaseUrl: string;
  openaiTranscriptionModel: string;
  openaiTranslationModel: string;
  openaiTitleModel: string;
  openaiConversationModel: string;
  openaiQaModel: string;
  geminiApiKey: string;
  geminiTranslationModel: string;
  geminiTitleModel: string;
  geminiConversationModel: string;
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
  titleSummaryPrompt: settings.titleSummaryPrompt,
  conversationSummaryPrompt:
    settings.conversationSummaryPrompt || DEFAULT_CONVERSATION_SUMMARY_PROMPT,
  qaPrompt: settings.qaPrompt,
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
  openaiQaModel: settings.credentials.openaiQaModel ?? settings.credentials.openaiConversationModel ?? DEFAULT_OPENAI_CONVERSATION_MODEL,
  geminiApiKey: settings.credentials.geminiApiKey ?? '',
  geminiTranslationModel:
    settings.credentials.geminiTranslationModel ?? DEFAULT_GEMINI_TRANSLATION_MODEL,
  geminiTitleModel:
    settings.credentials.geminiTitleModel ?? DEFAULT_GEMINI_TITLE_MODEL,
  geminiConversationModel:
    settings.credentials.geminiConversationModel ?? DEFAULT_GEMINI_CONVERSATION_MODEL,
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

export const CARD_TEXT_COLOR = '#f8fafc';
export const CARD_SUBTLE_TEXT_COLOR = '#e2e8f0';

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
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const gradientColors = SETTINGS_CARD_GRADIENTS[variant] ?? SETTINGS_CARD_GRADIENTS.interaction;

  return (
    <LinearGradient
      colors={gradientColors}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[cardStyles.surface, cardStyles.shadow, style]}>
      <ThemedView
        lightColor="transparent"
        darkColor="transparent"
        style={[cardStyles.content, isDark ? cardStyles.contentDark : cardStyles.contentLight, contentStyle]}>
        {children}
      </ThemedView>
    </LinearGradient>
  );
}

const cardStyles = StyleSheet.create({
  surface: {
    borderRadius: 28,
    padding: 2,
    overflow: 'hidden',
  },
  shadow: {
    shadowColor: '#0f172a',
    shadowOpacity: 0.22,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 12 },
    elevation: 8,
  },
  content: {
    borderRadius: 26,
    padding: 20,
    gap: 16,
  },
  contentLight: {
    backgroundColor: 'rgba(15, 23, 42, 0.08)',
  },
  contentDark: {
    backgroundColor: 'rgba(2, 6, 23, 0.65)',
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.25)',
  },
});

// Default export required for route
export default function SharedScreen() {
  return null;
}
