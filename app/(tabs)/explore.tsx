import { ReactNode, useEffect, useMemo, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useSettings } from '@/contexts/settings-context';
import { useColorScheme } from '@/hooks/use-color-scheme';
import {
  DEFAULT_GEMINI_TRANSLATION_MODEL,
  DEFAULT_OPENAI_BASE_URL,
  DEFAULT_OPENAI_TRANSCRIPTION_MODEL,
  DEFAULT_OPENAI_TRANSLATION_MODEL,
  DEFAULT_QWEN_TRANSCRIPTION_MODEL,
} from '@/services/transcription';
import { AppSettings, TranslationEngine, TranscriptionEngine } from '@/types/settings';

type NumericSettingKey =
  | 'activationThreshold'
  | 'activationDurationSec'
  | 'silenceDurationSec'
  | 'preRollDurationSec'
  | 'maxSegmentDurationSec';

interface FormState {
  activationThreshold: string;
  activationDurationSec: string;
  silenceDurationSec: string;
  preRollDurationSec: string;
  maxSegmentDurationSec: string;
  transcriptionLanguage: string;
  openaiApiKey: string;
  openaiBaseUrl: string;
  openaiTranscriptionModel: string;
  openaiTranslationModel: string;
  geminiApiKey: string;
  geminiTranslationModel: string;
  sonioxApiKey: string;
  qwenApiKey: string;
  qwenTranscriptionModel: string;
}

const initialFormState = (settings: AppSettings): FormState => ({
  activationThreshold: String(settings.activationThreshold),
  activationDurationSec: String(settings.activationDurationSec),
  silenceDurationSec: String(settings.silenceDurationSec),
  preRollDurationSec: String(settings.preRollDurationSec),
  maxSegmentDurationSec: String(settings.maxSegmentDurationSec),
  transcriptionLanguage: settings.transcriptionLanguage,
  openaiApiKey: settings.credentials.openaiApiKey ?? '',
  openaiBaseUrl: settings.credentials.openaiBaseUrl ?? DEFAULT_OPENAI_BASE_URL,
  openaiTranscriptionModel:
    settings.credentials.openaiTranscriptionModel ?? DEFAULT_OPENAI_TRANSCRIPTION_MODEL,
  openaiTranslationModel:
    settings.credentials.openaiTranslationModel ?? DEFAULT_OPENAI_TRANSLATION_MODEL,
  geminiApiKey: settings.credentials.geminiApiKey ?? '',
  geminiTranslationModel:
    settings.credentials.geminiTranslationModel ?? DEFAULT_GEMINI_TRANSLATION_MODEL,
  sonioxApiKey: settings.credentials.sonioxApiKey ?? '',
  qwenApiKey: settings.credentials.qwenApiKey ?? '',
  qwenTranscriptionModel:
    settings.credentials.qwenTranscriptionModel ?? DEFAULT_QWEN_TRANSCRIPTION_MODEL,
});

function useSettingsForm(settings: AppSettings) {
  const [formState, setFormState] = useState<FormState>(() => initialFormState(settings));

  useEffect(() => {
    setFormState(initialFormState(settings));
  }, [settings]);

  return { formState, setFormState } as const;
}

function formatNumberInput(value: string) {
  return value.replace(/[^0-9.]/g, '');
}

function OptionPill({ label, active, onPress, disabled }: { label: string; active: boolean; onPress: () => void; disabled?: boolean }) {
  return (
    <Pressable disabled={disabled} onPress={onPress} style={({ pressed }) => [styles.optionPressable, pressed && !disabled && styles.optionPressed]}>
      <ThemedView
        lightColor={active ? '#0ea5e9' : 'rgba(148, 163, 184, 0.16)'}
        darkColor={active ? '#0284c7' : 'rgba(148, 163, 184, 0.18)'}
        style={[styles.optionPill, active && styles.optionPillActive, disabled && styles.optionPillDisabled]}>
        <ThemedText style={styles.optionPillText} lightColor="#fff" darkColor="#fff">
          {label}
        </ThemedText>
      </ThemedView>
    </Pressable>
  );
}

function CredentialCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <ThemedView
      lightColor="rgba(148, 163, 184, 0.16)"
      darkColor="rgba(30, 41, 59, 0.7)"
      style={styles.credentialCard}>
      <ThemedText
        type="defaultSemiBold"
        style={styles.credentialTitle}
        lightColor="#0f172a"
        darkColor="#e2e8f0">
        {title}
      </ThemedText>
      <View style={styles.cardContent}>{children}</View>
    </ThemedView>
  );
}

export default function SettingsScreen() {
  const { settings, updateSettings, updateCredentials } = useSettings();
  const { formState, setFormState } = useSettingsForm(settings);
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const insets = useSafeAreaInsets();
  const inputStyle = [styles.input, isDark && styles.inputDark];
  const labelStyle = [styles.fieldLabel, isDark && styles.fieldLabelDark];
  const groupLabelStyle = [styles.groupLabel, isDark && styles.groupLabelDark];
  const sectionTitleStyle = [styles.sectionTitle, isDark && styles.sectionTitleDark];
  const credentialLabelStyle = [styles.cardLabel, isDark && styles.cardLabelDark];
  const placeholderTextColor = isDark ? '#94a3b8' : '#64748b';
  const safeAreaStyle = [styles.safeArea, isDark ? styles.safeAreaDark : styles.safeAreaLight];
  const scrollContentStyle = useMemo(
    () => [styles.scrollContent, { paddingBottom: 32 + insets.bottom }],
    [insets.bottom]
  );

  const handleNumericCommit = (key: NumericSettingKey, value: string) => {
    const parsed = parseFloat(value);
    if (!Number.isNaN(parsed)) {
      updateSettings({ [key]: parsed } as Partial<AppSettings>);
    }
  };

  const handleTextCommit = (key: keyof AppSettings, value: string) => {
    updateSettings({ [key]: value } as Partial<AppSettings>);
  };

  const transcriptionEngines = useMemo<TranscriptionEngine[]>(() => ['openai', 'qwen3', 'soniox'], []);
  const translationEngines = useMemo<TranslationEngine[]>(() => ['openai', 'gemini', 'none'], []);

  return (
    <SafeAreaView style={safeAreaStyle} edges={['top', 'left', 'right']}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.flex}>
        <ScrollView
          contentContainerStyle={scrollContentStyle}
          contentInsetAdjustmentBehavior="always"
          keyboardDismissMode="on-drag"
          keyboardShouldPersistTaps="handled">
          <View style={styles.pageHeader}>
            <ThemedText type="title" style={styles.pageTitle} lightColor="#0f172a" darkColor="#e2e8f0">
              设置
            </ThemedText>
            <ThemedText style={styles.pageSubtitle} lightColor="#4b5563" darkColor="#94a3b8">
              管理转写、翻译与凭据
            </ThemedText>
          </View>
          <ThemedView
            style={styles.section}
            lightColor="rgba(148, 163, 184, 0.12)"
            darkColor="rgba(15, 23, 42, 0.7)">
            <ThemedText type="subtitle" style={sectionTitleStyle} lightColor="#0f172a" darkColor="#e2e8f0">
              录音检测
            </ThemedText>
            <View style={styles.fieldRow}>
              <ThemedText style={labelStyle} lightColor="#1f2937" darkColor="#e2e8f0">
                激活阈值
              </ThemedText>
              <TextInput
                value={formState.activationThreshold}
                onChangeText={(text) =>
                  setFormState((prev) => ({ ...prev, activationThreshold: formatNumberInput(text) }))
                }
                onBlur={() => handleNumericCommit('activationThreshold', formState.activationThreshold)}
                keyboardType="decimal-pad"
                style={inputStyle}
                placeholderTextColor={placeholderTextColor}
              />
            </View>
            <View style={styles.fieldRow}>
              <ThemedText style={labelStyle} lightColor="#1f2937" darkColor="#e2e8f0">
                激活持续(秒)
              </ThemedText>
              <TextInput
                value={formState.activationDurationSec}
                onChangeText={(text) =>
                  setFormState((prev) => ({ ...prev, activationDurationSec: formatNumberInput(text) }))
                }
                onBlur={() => handleNumericCommit('activationDurationSec', formState.activationDurationSec)}
                keyboardType="decimal-pad"
                style={inputStyle}
                placeholderTextColor={placeholderTextColor}
              />
            </View>
            <View style={styles.fieldRow}>
              <ThemedText style={labelStyle} lightColor="#1f2937" darkColor="#e2e8f0">
                静音判定(秒)
              </ThemedText>
              <TextInput
                value={formState.silenceDurationSec}
                onChangeText={(text) =>
                  setFormState((prev) => ({ ...prev, silenceDurationSec: formatNumberInput(text) }))
                }
                onBlur={() => handleNumericCommit('silenceDurationSec', formState.silenceDurationSec)}
                keyboardType="decimal-pad"
                style={inputStyle}
                placeholderTextColor={placeholderTextColor}
              />
            </View>
            <View style={styles.fieldRow}>
              <ThemedText style={labelStyle} lightColor="#1f2937" darkColor="#e2e8f0">
                前滚时长(秒)
              </ThemedText>
              <TextInput
                value={formState.preRollDurationSec}
                onChangeText={(text) =>
                  setFormState((prev) => ({ ...prev, preRollDurationSec: formatNumberInput(text) }))
                }
                onBlur={() => handleNumericCommit('preRollDurationSec', formState.preRollDurationSec)}
                keyboardType="decimal-pad"
                style={inputStyle}
                placeholderTextColor={placeholderTextColor}
              />
            </View>
            <View style={styles.fieldRow}>
              <ThemedText style={labelStyle} lightColor="#1f2937" darkColor="#e2e8f0">
                最大片段(秒)
              </ThemedText>
              <TextInput
                value={formState.maxSegmentDurationSec}
                onChangeText={(text) =>
                  setFormState((prev) => ({ ...prev, maxSegmentDurationSec: formatNumberInput(text) }))
                }
                onBlur={() => handleNumericCommit('maxSegmentDurationSec', formState.maxSegmentDurationSec)}
                keyboardType="decimal-pad"
                style={inputStyle}
                placeholderTextColor={placeholderTextColor}
              />
            </View>
          </ThemedView>

          <ThemedView
            style={styles.section}
            lightColor="rgba(148, 163, 184, 0.12)"
            darkColor="rgba(15, 23, 42, 0.7)">
            <ThemedText type="subtitle" style={sectionTitleStyle} lightColor="#0f172a" darkColor="#e2e8f0">
              转写设置
            </ThemedText>
            <ThemedText style={groupLabelStyle} lightColor="#1f2937" darkColor="#e2e8f0">
              转写引擎
            </ThemedText>
            <View style={styles.optionsRow}>
              {transcriptionEngines.map((engine) => (
                <OptionPill
                  key={engine}
                  label={engine.toUpperCase()}
                  active={settings.transcriptionEngine === engine}
                  onPress={() => updateSettings({ transcriptionEngine: engine })}
                />
              ))}
            </View>
            <View style={styles.fieldRow}>
              <ThemedText style={labelStyle} lightColor="#1f2937" darkColor="#e2e8f0">
                源语言
              </ThemedText>
              <TextInput
                value={formState.transcriptionLanguage}
                onChangeText={(text) => setFormState((prev) => ({ ...prev, transcriptionLanguage: text }))}
                onBlur={() => handleTextCommit('transcriptionLanguage', formState.transcriptionLanguage.trim())}
                autoCapitalize="none"
                style={inputStyle}
                placeholder="auto"
                placeholderTextColor={placeholderTextColor}
              />
            </View>
          </ThemedView>

        <ThemedView
          style={styles.section}
          lightColor="rgba(148, 163, 184, 0.12)"
          darkColor="rgba(15, 23, 42, 0.7)">
          <View style={styles.rowBetween}>
            <ThemedText type="subtitle" style={sectionTitleStyle} lightColor="#0f172a" darkColor="#e2e8f0">
              翻译设置
            </ThemedText>
            <Switch
              value={settings.enableTranslation}
              onValueChange={(next) => updateSettings({ enableTranslation: next })}
            />
          </View>
          <ThemedText style={groupLabelStyle} lightColor="#1f2937" darkColor="#e2e8f0">
            翻译引擎
          </ThemedText>
          <View style={styles.optionsRow}>
            {translationEngines.map((engine) => (
              <OptionPill
                key={engine}
                label={engine.toUpperCase()}
                active={settings.translationEngine === engine}
                onPress={() => updateSettings({ translationEngine: engine })}
                disabled={!settings.enableTranslation}
              />
            ))}
          </View>
        </ThemedView>

        <ThemedView
          style={styles.section}
          lightColor="rgba(148, 163, 184, 0.12)"
          darkColor="rgba(15, 23, 42, 0.7)">
          <ThemedText type="subtitle" style={sectionTitleStyle} lightColor="#0f172a" darkColor="#e2e8f0">
            凭据
          </ThemedText>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.credentialScrollContent}>
            <CredentialCard title="OpenAI">
              <View style={styles.cardField}>
                <ThemedText style={credentialLabelStyle} lightColor="#1f2937" darkColor="#e2e8f0">
                  Base URL
                </ThemedText>
                <TextInput
                  value={formState.openaiBaseUrl}
                  onChangeText={(text) => setFormState((prev) => ({ ...prev, openaiBaseUrl: text }))}
                  onBlur={() =>
                    updateCredentials({
                      openaiBaseUrl: formState.openaiBaseUrl.trim() || DEFAULT_OPENAI_BASE_URL,
                    })
                  }
                  autoCapitalize="none"
                  style={inputStyle}
                  placeholder={DEFAULT_OPENAI_BASE_URL}
                  placeholderTextColor={placeholderTextColor}
                />
              </View>
              <View style={styles.cardField}>
                <ThemedText style={credentialLabelStyle} lightColor="#1f2937" darkColor="#e2e8f0">
                  API Key
                </ThemedText>
                <TextInput
                  value={formState.openaiApiKey}
                  onChangeText={(text) => setFormState((prev) => ({ ...prev, openaiApiKey: text }))}
                  onBlur={() =>
                    updateCredentials({
                      openaiApiKey: formState.openaiApiKey.trim() || undefined,
                    })
                  }
                  autoCapitalize="none"
                  secureTextEntry
                  style={inputStyle}
                  placeholder="sk-..."
                  placeholderTextColor={placeholderTextColor}
                />
              </View>
              <View style={styles.cardField}>
                <ThemedText style={credentialLabelStyle} lightColor="#1f2937" darkColor="#e2e8f0">
                  转写模型
                </ThemedText>
                <TextInput
                  value={formState.openaiTranscriptionModel}
                  onChangeText={(text) =>
                    setFormState((prev) => ({ ...prev, openaiTranscriptionModel: text }))
                  }
                  onBlur={() =>
                    updateCredentials({
                      openaiTranscriptionModel:
                        formState.openaiTranscriptionModel.trim() || DEFAULT_OPENAI_TRANSCRIPTION_MODEL,
                    })
                  }
                  autoCapitalize="none"
                  style={inputStyle}
                  placeholder={DEFAULT_OPENAI_TRANSCRIPTION_MODEL}
                  placeholderTextColor={placeholderTextColor}
                />
              </View>
              <View style={styles.cardField}>
                <ThemedText style={credentialLabelStyle} lightColor="#1f2937" darkColor="#e2e8f0">
                  翻译模型
                </ThemedText>
                <TextInput
                  value={formState.openaiTranslationModel}
                  onChangeText={(text) =>
                    setFormState((prev) => ({ ...prev, openaiTranslationModel: text }))
                  }
                  onBlur={() =>
                    updateCredentials({
                      openaiTranslationModel:
                        formState.openaiTranslationModel.trim() || DEFAULT_OPENAI_TRANSLATION_MODEL,
                    })
                  }
                  autoCapitalize="none"
                  style={inputStyle}
                  placeholder={DEFAULT_OPENAI_TRANSLATION_MODEL}
                  placeholderTextColor={placeholderTextColor}
                />
              </View>
            </CredentialCard>

            <CredentialCard title="Gemini">
              <View style={styles.cardField}>
                <ThemedText style={credentialLabelStyle} lightColor="#1f2937" darkColor="#e2e8f0">
                  API Key
                </ThemedText>
                <TextInput
                  value={formState.geminiApiKey}
                  onChangeText={(text) => setFormState((prev) => ({ ...prev, geminiApiKey: text }))}
                  onBlur={() =>
                    updateCredentials({ geminiApiKey: formState.geminiApiKey.trim() || undefined })
                  }
                  autoCapitalize="none"
                  secureTextEntry
                  style={inputStyle}
                  placeholder="AIza..."
                  placeholderTextColor={placeholderTextColor}
                />
              </View>
              <View style={styles.cardField}>
                <ThemedText style={credentialLabelStyle} lightColor="#1f2937" darkColor="#e2e8f0">
                  翻译模型
                </ThemedText>
                <TextInput
                  value={formState.geminiTranslationModel}
                  onChangeText={(text) =>
                    setFormState((prev) => ({ ...prev, geminiTranslationModel: text }))
                  }
                  onBlur={() =>
                    updateCredentials({
                      geminiTranslationModel:
                        formState.geminiTranslationModel.trim() || DEFAULT_GEMINI_TRANSLATION_MODEL,
                    })
                  }
                  autoCapitalize="none"
                  style={inputStyle}
                  placeholder={DEFAULT_GEMINI_TRANSLATION_MODEL}
                  placeholderTextColor={placeholderTextColor}
                />
              </View>
            </CredentialCard>

            <CredentialCard title="Soniox">
              <View style={styles.cardField}>
                <ThemedText style={credentialLabelStyle} lightColor="#1f2937" darkColor="#e2e8f0">
                  API Key
                </ThemedText>
                <TextInput
                  value={formState.sonioxApiKey}
                  onChangeText={(text) => setFormState((prev) => ({ ...prev, sonioxApiKey: text }))}
                  onBlur={() =>
                    updateCredentials({ sonioxApiKey: formState.sonioxApiKey.trim() || undefined })
                  }
                  autoCapitalize="none"
                  secureTextEntry
                  style={inputStyle}
                  placeholder="soniox_..."
                  placeholderTextColor={placeholderTextColor}
                />
              </View>
            </CredentialCard>

            <CredentialCard title="Qwen3">
              <View style={styles.cardField}>
                <ThemedText style={credentialLabelStyle} lightColor="#1f2937" darkColor="#e2e8f0">
                  API Key
                </ThemedText>
                <TextInput
                  value={formState.qwenApiKey}
                  onChangeText={(text) => setFormState((prev) => ({ ...prev, qwenApiKey: text }))}
                  onBlur={() =>
                    updateCredentials({ qwenApiKey: formState.qwenApiKey.trim() || undefined })
                  }
                  autoCapitalize="none"
                  secureTextEntry
                  style={inputStyle}
                  placeholder="sk-..."
                  placeholderTextColor={placeholderTextColor}
                />
              </View>
              <View style={styles.cardField}>
                <ThemedText style={credentialLabelStyle} lightColor="#1f2937" darkColor="#e2e8f0">
                  转写模型
                </ThemedText>
                <TextInput
                  value={formState.qwenTranscriptionModel}
                  onChangeText={(text) =>
                    setFormState((prev) => ({ ...prev, qwenTranscriptionModel: text }))
                  }
                  onBlur={() =>
                    updateCredentials({
                      qwenTranscriptionModel:
                        formState.qwenTranscriptionModel.trim() || DEFAULT_QWEN_TRANSCRIPTION_MODEL,
                    })
                  }
                  autoCapitalize="none"
                  style={inputStyle}
                  placeholder={DEFAULT_QWEN_TRANSCRIPTION_MODEL}
                  placeholderTextColor={placeholderTextColor}
                />
              </View>
            </CredentialCard>
          </ScrollView>
        </ThemedView>
      </ScrollView>
    </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
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
  section: {
    borderRadius: 20,
    padding: 18,
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
  credentialScrollContent: {
    paddingVertical: 6,
    gap: 16,
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
  pageSubtitle: {
    fontSize: 14,
  },
  credentialCard: {
    width: 260,
    padding: 16,
    borderRadius: 18,
    gap: 12,
  },
  credentialTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  cardContent: {
    gap: 12,
  },
  cardField: {
    gap: 6,
  },
  cardLabel: {
    fontSize: 13,
    opacity: 0.75,
  },
  cardLabelDark: {
    opacity: 0.9,
  },
});
