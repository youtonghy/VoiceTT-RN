
import { KeyboardAvoidingView, Platform, ScrollView, Switch, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { ThemedText } from '@/components/themed-text';
import { useSettings } from '@/contexts/settings-context';
import { useColorScheme } from '@/hooks/use-color-scheme';
import type { TranslationEngine } from '@/types/settings';

import {
  CARD_SUBTLE_TEXT_COLOR,
  CARD_TEXT_COLOR,
  OptionPill,
  SettingsCard,
  settingsStyles,
} from './shared';

const translationEngines: TranslationEngine[] = ['openai', 'gemini', 'none'];

export default function TranslationSettingsScreen() {
  const { t } = useTranslation();
  const { settings, updateSettings } = useSettings();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const insets = useSafeAreaInsets();

  const groupLabelStyle = [settingsStyles.groupLabel, isDark && settingsStyles.groupLabelDark];
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
            <View style={settingsStyles.rowBetween}>
              <ThemedText
                type="subtitle"
                lightColor={CARD_TEXT_COLOR}
                darkColor={CARD_TEXT_COLOR}>
                {t('settings.translation.labels.enable_translation')}
              </ThemedText>
              <Switch
                value={settings.enableTranslation}
                onValueChange={(next) => updateSettings({ enableTranslation: next })}
              />
            </View>

            <ThemedText
              style={groupLabelStyle}
              lightColor={CARD_SUBTLE_TEXT_COLOR}
              darkColor={CARD_SUBTLE_TEXT_COLOR}>
              {t('settings.translation.labels.engine')}
            </ThemedText>
            <View style={settingsStyles.optionsRow}>
              {translationEngines.map((engine) => (
                <OptionPill
                  key={engine}
                  label={t(`settings.translation.engines.${engine}`)}
                  active={settings.translationEngine === engine}
                  onPress={() => updateSettings({ translationEngine: engine })}
                  disabled={!settings.enableTranslation}
                />
              ))}
            </View>
          </SettingsCard>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

