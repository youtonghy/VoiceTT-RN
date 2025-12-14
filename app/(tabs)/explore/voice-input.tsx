import { KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { ThemedText } from '@/components/themed-text';
import { useSettings } from '@/contexts/settings-context';
import { useColorScheme } from '@/hooks/use-color-scheme';
import type { TranscriptionEngine } from '@/types/settings';

import {
  CARD_TEXT_LIGHT, CARD_TEXT_DARK,
  OptionPill,
  SettingsCard,
  settingsStyles,
} from './shared';

const voiceInputEngines: TranscriptionEngine[] = ['openai', 'gemini', 'qwen3', 'soniox', 'doubao', 'glm'];

export default function VoiceInputSettingsScreen() {
  const { t } = useTranslation();
  const { settings, updateSettings } = useSettings();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const insets = useSafeAreaInsets();

  const safeAreaStyle = [
    settingsStyles.safeArea,
    isDark ? settingsStyles.safeAreaDark : settingsStyles.safeAreaLight,
  ];
  const groupLabelStyle = [settingsStyles.groupLabel, isDark && settingsStyles.groupLabelDark];

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
              lightColor={CARD_TEXT_LIGHT}
              darkColor={CARD_TEXT_DARK}>
              {t('settings.voice_input.labels.engine')}
            </ThemedText>
            <View style={settingsStyles.optionsRow}>
              {voiceInputEngines.map((engine) => (
                <OptionPill
                  key={engine}
                  label={t(`settings.voice_input.engines.${engine}`)}
                  active={settings.voiceInputEngine === engine}
                  onPress={() => updateSettings({ voiceInputEngine: engine })}
                />
              ))}
            </View>
          </SettingsCard>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
