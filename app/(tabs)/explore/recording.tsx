import { useMemo } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { useSettings } from '@/contexts/settings-context';
import { useColorScheme } from '@/hooks/use-color-scheme';
import type { AppSettings } from '@/types/settings';

import {
  NumericSettingKey,
  formatNumberInput,
  settingsStyles,
  useSettingsForm,
} from './shared';

export default function RecordingSettingsScreen() {
  const { settings, updateSettings } = useSettings();
  const { formState, setFormState } = useSettingsForm(settings);
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const insets = useSafeAreaInsets();

  const inputStyle = [settingsStyles.input, isDark && settingsStyles.inputDark];
  const labelStyle = [settingsStyles.fieldLabel, isDark && settingsStyles.fieldLabelDark];
  const placeholderTextColor = isDark ? '#94a3b8' : '#64748b';
  const safeAreaStyle = [
    settingsStyles.safeArea,
    isDark ? settingsStyles.safeAreaDark : settingsStyles.safeAreaLight,
  ];
  const scrollContentStyle = useMemo(
    () => [settingsStyles.scrollContent, { paddingBottom: 32 + insets.bottom }],
    [insets.bottom]
  );

  const handleNumericCommit = (key: NumericSettingKey, value: string) => {
    const parsed = parseFloat(value);
    if (!Number.isNaN(parsed)) {
      updateSettings({ [key]: parsed } as Partial<AppSettings>);
    }
  };

  return (
    <SafeAreaView style={safeAreaStyle} edges={['top', 'left', 'right']}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={settingsStyles.flex}>
        <ScrollView
          contentContainerStyle={scrollContentStyle}
          contentInsetAdjustmentBehavior="always"
          keyboardDismissMode="on-drag"
          keyboardShouldPersistTaps="handled">
          <View style={styles.section}>
            <View style={settingsStyles.fieldRow}>
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

            <View style={settingsStyles.fieldRow}>
              <ThemedText style={labelStyle} lightColor="#1f2937" darkColor="#e2e8f0">
                激活持续(秒)
              </ThemedText>
              <TextInput
                value={formState.activationDurationSec}
                onChangeText={(text) =>
                  setFormState((prev) => ({ ...prev, activationDurationSec: formatNumberInput(text) }))
                }
                onBlur={() =>
                  handleNumericCommit('activationDurationSec', formState.activationDurationSec)
                }
                keyboardType="decimal-pad"
                style={inputStyle}
                placeholderTextColor={placeholderTextColor}
              />
            </View>

            <View style={settingsStyles.fieldRow}>
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

            <View style={settingsStyles.fieldRow}>
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

            <View style={settingsStyles.fieldRow}>
              <ThemedText style={labelStyle} lightColor="#1f2937" darkColor="#e2e8f0">
                最大片段(秒)
              </ThemedText>
              <TextInput
                value={formState.maxSegmentDurationSec}
                onChangeText={(text) =>
                  setFormState((prev) => ({ ...prev, maxSegmentDurationSec: formatNumberInput(text) }))
                }
                onBlur={() =>
                  handleNumericCommit('maxSegmentDurationSec', formState.maxSegmentDurationSec)
                }
                keyboardType="decimal-pad"
                style={inputStyle}
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
