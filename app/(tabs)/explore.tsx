import { useEffect, useMemo, useState } from 'react';
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

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useSettings } from '@/contexts/settings-context';
import { AppSettings, TranslationEngine, TranscriptionEngine } from '@/types/settings';

type NumericSettingKey =
  | 'activationThreshold'
  | 'activationDurationSec'
  | 'silenceDurationSec'
  | 'preRollDurationSec'
  | 'maxSegmentDurationSec'
  | 'translationTimeoutSec';

interface FormState {
  activationThreshold: string;
  activationDurationSec: string;
  silenceDurationSec: string;
  preRollDurationSec: string;
  maxSegmentDurationSec: string;
  transcriptionModel: string;
  transcriptionLanguage: string;
  translationModel: string;
  translationTargetLanguage: string;
  translationTimeoutSec: string;
  openaiApiKey: string;
  openaiBaseUrl: string;
}

const initialFormState = (settings: AppSettings): FormState => ({
  activationThreshold: String(settings.activationThreshold),
  activationDurationSec: String(settings.activationDurationSec),
  silenceDurationSec: String(settings.silenceDurationSec),
  preRollDurationSec: String(settings.preRollDurationSec),
  maxSegmentDurationSec: String(settings.maxSegmentDurationSec),
  transcriptionModel: settings.transcriptionModel,
  transcriptionLanguage: settings.transcriptionLanguage,
  translationModel: settings.translationModel,
  translationTargetLanguage: settings.translationTargetLanguage,
  translationTimeoutSec: String(settings.translationTimeoutSec),
  openaiApiKey: settings.credentials.openaiApiKey ?? '',
  openaiBaseUrl: settings.credentials.openaiBaseUrl ?? '',
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

export default function SettingsScreen() {
  const { settings, updateSettings, updateCredentials } = useSettings();
  const { formState, setFormState } = useSettingsForm(settings);

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
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.flex}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.section}>
          <ThemedText type="subtitle" style={styles.sectionTitle}>
            录音检测
          </ThemedText>
          <View style={styles.fieldRow}>
            <ThemedText style={styles.fieldLabel}>激活阈值</ThemedText>
            <TextInput
              value={formState.activationThreshold}
              onChangeText={(text) =>
                setFormState((prev) => ({ ...prev, activationThreshold: formatNumberInput(text) }))
              }
              onBlur={() => handleNumericCommit('activationThreshold', formState.activationThreshold)}
              keyboardType="decimal-pad"
              style={styles.input}
            />
          </View>
          <View style={styles.fieldRow}>
            <ThemedText style={styles.fieldLabel}>激活持续(秒)</ThemedText>
            <TextInput
              value={formState.activationDurationSec}
              onChangeText={(text) =>
                setFormState((prev) => ({ ...prev, activationDurationSec: formatNumberInput(text) }))
              }
              onBlur={() => handleNumericCommit('activationDurationSec', formState.activationDurationSec)}
              keyboardType="decimal-pad"
              style={styles.input}
            />
          </View>
          <View style={styles.fieldRow}>
            <ThemedText style={styles.fieldLabel}>静音判定(秒)</ThemedText>
            <TextInput
              value={formState.silenceDurationSec}
              onChangeText={(text) =>
                setFormState((prev) => ({ ...prev, silenceDurationSec: formatNumberInput(text) }))
              }
              onBlur={() => handleNumericCommit('silenceDurationSec', formState.silenceDurationSec)}
              keyboardType="decimal-pad"
              style={styles.input}
            />
          </View>
          <View style={styles.fieldRow}>
            <ThemedText style={styles.fieldLabel}>前滚时长(秒)</ThemedText>
            <TextInput
              value={formState.preRollDurationSec}
              onChangeText={(text) =>
                setFormState((prev) => ({ ...prev, preRollDurationSec: formatNumberInput(text) }))
              }
              onBlur={() => handleNumericCommit('preRollDurationSec', formState.preRollDurationSec)}
              keyboardType="decimal-pad"
              style={styles.input}
            />
          </View>
          <View style={styles.fieldRow}>
            <ThemedText style={styles.fieldLabel}>最大片段(秒)</ThemedText>
            <TextInput
              value={formState.maxSegmentDurationSec}
              onChangeText={(text) =>
                setFormState((prev) => ({ ...prev, maxSegmentDurationSec: formatNumberInput(text) }))
              }
              onBlur={() => handleNumericCommit('maxSegmentDurationSec', formState.maxSegmentDurationSec)}
              keyboardType="decimal-pad"
              style={styles.input}
            />
          </View>
        </View>

        <View style={styles.section}>
          <ThemedText type="subtitle" style={styles.sectionTitle}>
            转写设置
          </ThemedText>
          <ThemedText style={styles.groupLabel}>转写引擎</ThemedText>
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
            <ThemedText style={styles.fieldLabel}>模型名称</ThemedText>
            <TextInput
              value={formState.transcriptionModel}
              onChangeText={(text) => setFormState((prev) => ({ ...prev, transcriptionModel: text }))}
              onBlur={() => handleTextCommit('transcriptionModel', formState.transcriptionModel.trim())}
              autoCapitalize="none"
              style={styles.input}
            />
          </View>
          <View style={styles.fieldRow}>
            <ThemedText style={styles.fieldLabel}>源语言</ThemedText>
            <TextInput
              value={formState.transcriptionLanguage}
              onChangeText={(text) => setFormState((prev) => ({ ...prev, transcriptionLanguage: text }))}
              onBlur={() => handleTextCommit('transcriptionLanguage', formState.transcriptionLanguage.trim())}
              autoCapitalize="none"
              style={styles.input}
            />
          </View>
        </View>

        <View style={styles.section}>
          <View style={styles.rowBetween}>
            <ThemedText type="subtitle" style={styles.sectionTitle}>
              翻译设置
            </ThemedText>
            <Switch
              value={settings.enableTranslation}
              onValueChange={(next) => updateSettings({ enableTranslation: next })}
            />
          </View>
          <ThemedText style={styles.groupLabel}>翻译引擎</ThemedText>
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
          <View style={styles.fieldRow}>
            <ThemedText style={styles.fieldLabel}>目标语言</ThemedText>
            <TextInput
              value={formState.translationTargetLanguage}
              onChangeText={(text) =>
                setFormState((prev) => ({ ...prev, translationTargetLanguage: text }))
              }
              onBlur={() =>
                handleTextCommit('translationTargetLanguage', formState.translationTargetLanguage.trim())
              }
              autoCapitalize="none"
              style={styles.input}
              editable={settings.enableTranslation}
            />
          </View>
          <View style={styles.fieldRow}>
            <ThemedText style={styles.fieldLabel}>翻译模型</ThemedText>
            <TextInput
              value={formState.translationModel}
              onChangeText={(text) => setFormState((prev) => ({ ...prev, translationModel: text }))}
              onBlur={() => handleTextCommit('translationModel', formState.translationModel.trim())}
              autoCapitalize="none"
              style={styles.input}
              editable={settings.enableTranslation}
            />
          </View>
          <View style={styles.fieldRow}>
            <ThemedText style={styles.fieldLabel}>超时(秒)</ThemedText>
            <TextInput
              value={formState.translationTimeoutSec}
              onChangeText={(text) =>
                setFormState((prev) => ({ ...prev, translationTimeoutSec: formatNumberInput(text) }))
              }
              onBlur={() => handleNumericCommit('translationTimeoutSec', formState.translationTimeoutSec)}
              keyboardType="decimal-pad"
              style={styles.input}
              editable={settings.enableTranslation}
            />
          </View>
        </View>

        <View style={styles.section}>
          <ThemedText type="subtitle" style={styles.sectionTitle}>
            凭据
          </ThemedText>
          <View style={styles.fieldRow}>
            <ThemedText style={styles.fieldLabel}>OpenAI Base URL</ThemedText>
            <TextInput
              value={formState.openaiBaseUrl}
              onChangeText={(text) => setFormState((prev) => ({ ...prev, openaiBaseUrl: text }))}
              onBlur={() => updateCredentials({ openaiBaseUrl: formState.openaiBaseUrl.trim() || undefined })}
              autoCapitalize="none"
              style={styles.input}
              placeholder="https://api.openai.com"
            />
          </View>
          <View style={styles.fieldRow}>
            <ThemedText style={styles.fieldLabel}>OpenAI API Key</ThemedText>
            <TextInput
              value={formState.openaiApiKey}
              onChangeText={(text) => setFormState((prev) => ({ ...prev, openaiApiKey: text }))}
              onBlur={() => updateCredentials({ openaiApiKey: formState.openaiApiKey.trim() || undefined })}
              autoCapitalize="none"
              secureTextEntry
              style={styles.input}
              placeholder="sk-..."
            />
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
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
    backgroundColor: 'rgba(148, 163, 184, 0.12)',
    gap: 14,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
  },
  fieldRow: {
    gap: 6,
  },
  fieldLabel: {
    fontSize: 14,
    opacity: 0.7,
  },
  input: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.4)',
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
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
  rowBetween: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
});
