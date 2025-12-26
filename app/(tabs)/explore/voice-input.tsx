/**
 * 页面名称：语音输入设置 (Voice Input Settings)
 * 文件路径：app/(tabs)/explore/voice-input.tsx
 * 功能描述：配置用于语音输入的 STT 引擎。
 */

import { useTranslation } from 'react-i18next';
import { KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { useSettings } from '@/contexts/settings-context';
import { useColorScheme } from '@/hooks/use-color-scheme';
import type { TranscriptionEngine } from '@/types/settings';

import {
    CARD_TEXT_DARK,
    CARD_TEXT_LIGHT,
    OptionPill,
    SettingsCard,
    settingsStyles,
} from './shared';

// --- 常量定义 ---
const voiceInputEngines: TranscriptionEngine[] = ['openai', 'gemini', 'qwen3', 'soniox', 'doubao', 'glm'];

// --- 主组件 ---
export default function VoiceInputSettingsScreen() {
  const { t } = useTranslation();
  const { settings, updateSettings } = useSettings();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const insets = useSafeAreaInsets();

  // --- 样式配置 ---
  const safeAreaStyle = [
    settingsStyles.safeArea,
    isDark ? settingsStyles.safeAreaDark : settingsStyles.safeAreaLight,
  ];
  const groupLabelStyle = [settingsStyles.groupLabel, isDark && settingsStyles.groupLabelDark];

  return (
    <SafeAreaView style={safeAreaStyle} edges={['top', 'left', 'right']}>
      {/* 键盘避让视图 */}
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
