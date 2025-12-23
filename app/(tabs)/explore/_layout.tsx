import { Stack } from 'expo-router';
import { useTranslation } from 'react-i18next';
import React from 'react';
import { StyleSheet, View } from 'react-native';

import { SettingsSidebar } from '@/components/settings/settings-sidebar';
import { useIsTablet } from '@/hooks/use-is-tablet';

export default function SettingsLayout() {
  const { t } = useTranslation();
  const isTablet = useIsTablet();

  const titles = {
    recording: t('settings.sections.recording.title'),
    voiceInput: t('settings.sections.voice_input.title'),
    transcription: t('settings.sections.transcription.title'),
    translation: t('settings.sections.translation.title'),
    tts: t('settings.sections.tts.title'),
    summary: t('settings.sections.summary.title'),
    qa: t('settings.sections.qa.title'),
    credentials: t('settings.sections.credentials.title'),
    appearance: t('settings.sections.appearance.title'),
  };

  const stack = (
    <Stack screenOptions={{ headerShadowVisible: false }}>
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="recording" options={{ title: titles.recording }} />
      <Stack.Screen name="voice-input" options={{ title: titles.voiceInput }} />
      <Stack.Screen name="transcription" options={{ title: titles.transcription }} />
      <Stack.Screen name="translation" options={{ title: titles.translation }} />
      <Stack.Screen name="tts" options={{ title: titles.tts }} />
      <Stack.Screen name="summary" options={{ title: titles.summary }} />
      <Stack.Screen name="qa" options={{ title: titles.qa }} />
      <Stack.Screen name="credentials" options={{ title: titles.credentials }} />
      <Stack.Screen name="appearance" options={{ title: titles.appearance }} />
    </Stack>
  );

  if (!isTablet) {
    return stack;
  }

  return (
    <View style={styles.splitRoot}>
      <SettingsSidebar />
      <View style={styles.splitDetail}>{stack}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  splitRoot: {
    flex: 1,
    flexDirection: 'row',
  },
  splitDetail: {
    flex: 1,
  },
});
