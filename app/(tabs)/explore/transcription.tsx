import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { useSettings } from '@/contexts/settings-context';
import { useColorScheme } from '@/hooks/use-color-scheme';
import type { TranscriptionEngine } from '@/types/settings';

import { OptionPill, settingsStyles, useSettingsForm } from './shared';

const transcriptionEngines: TranscriptionEngine[] = ['openai', 'qwen3', 'soniox'];

export default function TranscriptionSettingsScreen() {
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
          <View style={styles.section}>
            <ThemedText style={groupLabelStyle} lightColor="#1f2937" darkColor="#e2e8f0">
              转写引擎
            </ThemedText>
            <View style={settingsStyles.optionsRow}>
              {transcriptionEngines.map((engine) => (
                <OptionPill
                  key={engine}
                  label={engine.toUpperCase()}
                  active={settings.transcriptionEngine === engine}
                  onPress={() => updateSettings({ transcriptionEngine: engine })}
                />
              ))}
            </View>

            <View style={settingsStyles.fieldRow}>
              <ThemedText style={labelStyle} lightColor="#1f2937" darkColor="#e2e8f0">
                源语言
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
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  section: {
    gap: 16,
  },
});
