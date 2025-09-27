import { KeyboardAvoidingView, Platform, ScrollView, Switch, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useSettings } from '@/contexts/settings-context';
import { useColorScheme } from '@/hooks/use-color-scheme';
import type { TranslationEngine } from '@/types/settings';

import { OptionPill, settingsStyles } from './shared';

const translationEngines: TranslationEngine[] = ['openai', 'gemini', 'none'];

export default function TranslationSettingsScreen() {
  const { settings, updateSettings } = useSettings();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const insets = useSafeAreaInsets();

  const groupLabelStyle = [settingsStyles.groupLabel, isDark && settingsStyles.groupLabelDark];
  const sectionTitleStyle = [settingsStyles.sectionTitle, isDark && settingsStyles.sectionTitleDark];
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
          <ThemedView
            style={settingsStyles.section}
            lightColor="rgba(148, 163, 184, 0.12)"
            darkColor="rgba(15, 23, 42, 0.7)">
            <View style={settingsStyles.rowBetween}>
              <ThemedText
                type="subtitle"
                style={sectionTitleStyle}
                lightColor="#0f172a"
                darkColor="#e2e8f0">
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
            <View style={settingsStyles.optionsRow}>
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
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
