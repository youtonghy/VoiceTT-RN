
import { KeyboardAvoidingView, Platform, ScrollView, TextInput, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { ThemedText } from '@/components/themed-text';
import { useSettings } from '@/contexts/settings-context';
import { useColorScheme } from '@/hooks/use-color-scheme';
import type { TranscriptionEngine } from '@/types/settings';

import {
  CARD_SUBTLE_TEXT_COLOR,
  CARD_TEXT_COLOR,
  OptionPill,
  SettingsCard,
  settingsStyles,
  useSettingsForm,
} from './shared';

const transcriptionEngines: TranscriptionEngine[] = ['openai', 'qwen3', 'soniox', 'doubao'];

export default function TranscriptionSettingsScreen() {
  const { t } = useTranslation();
  const { settings, updateSettings } = useSettings();
  const { formState, setFormState } = useSettingsForm(settings);
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const insets = useSafeAreaInsets();

  const inputStyle = [settingsStyles.input, isDark && settingsStyles.inputDark];
  const labelStyle = [settingsStyles.fieldLabel, isDark && settingsStyles.fieldLabelDark];
  const groupLabelStyle = [settingsStyles.groupLabel, isDark && settingsStyles.groupLabelDark];
  const placeholderTextColor = isDark ? '#94a3b8' : '#64748b';
  const safeAreaStyle = [
    settingsStyles.safeArea,
    isDark ? settingsStyles.safeAreaDark : settingsStyles.safeAreaLight,
  ];

  return (
    <SafeAreaView style={safeAreaStyle} edges={['top', 'left', 'right']}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={settingsStyles.flex}>
        <ScrollView
          contentContainerStyle={[
            settingsStyles.scrollContent,
            { paddingBottom: 32 + insets.bottom },
          ]}
          contentInsetAdjustmentBehavior="always"
          keyboardDismissMode="on-drag"
          keyboardShouldPersistTaps="handled">
          <SettingsCard variant="interaction">
            <ThemedText
              style={groupLabelStyle}
              lightColor={CARD_TEXT_COLOR}
              darkColor={CARD_TEXT_COLOR}>
              {t('settings.transcription.labels.engine')}
            </ThemedText>
            <View style={settingsStyles.optionsRow}>
              {transcriptionEngines.map((engine) => (
                <OptionPill
                  key={engine}
                  label={t(`settings.transcription.engines.${engine}`)}
                  active={settings.transcriptionEngine === engine}
                  onPress={() => updateSettings({ transcriptionEngine: engine })}
                />
              ))}
            </View>

            <View style={settingsStyles.fieldRow}>
              <ThemedText
                style={labelStyle}
                lightColor={CARD_SUBTLE_TEXT_COLOR}
                darkColor={CARD_SUBTLE_TEXT_COLOR}>
                {t('settings.transcription.labels.source_language')}
              </ThemedText>
              <TextInput
                value={formState.transcriptionLanguage}
                onChangeText={(text) =>
                  setFormState((prev) => ({ ...prev, transcriptionLanguage: text }))
                }
                onBlur={() =>
                  updateSettings({ transcriptionLanguage: formState.transcriptionLanguage.trim() })
                }
                autoCapitalize="none"
                style={inputStyle}
                placeholder="auto"
                placeholderTextColor={placeholderTextColor}
              />
            </View>
          </SettingsCard>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
