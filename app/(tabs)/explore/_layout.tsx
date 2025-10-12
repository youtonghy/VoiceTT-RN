import { Stack } from 'expo-router';
import { useTranslation } from 'react-i18next';

export default function SettingsLayout() {
  const { t } = useTranslation();

  const titles = {
    recording: t('settings.sections.recording.title'),
    voiceInput: t('settings.sections.voice_input.title'),
    transcription: t('settings.sections.transcription.title'),
    translation: t('settings.sections.translation.title'),
    summary: t('settings.sections.summary.title'),
    qa: t('settings.sections.qa.title'),
    credentials: t('settings.sections.credentials.title'),
  };

  return (
    <Stack screenOptions={{ headerShadowVisible: false }}>
      <Stack.Screen name='index' options={{ headerShown: false }} />
      <Stack.Screen name='recording' options={{ title: titles.recording }} />
      <Stack.Screen name='voice-input' options={{ title: titles.voiceInput }} />
      <Stack.Screen name='transcription' options={{ title: titles.transcription }} />
      <Stack.Screen name='translation' options={{ title: titles.translation }} />
      <Stack.Screen name='summary' options={{ title: titles.summary }} />
      <Stack.Screen name='qa' options={{ title: titles.qa }} />
      <Stack.Screen name='credentials' options={{ title: titles.credentials }} />
    </Stack>
  );
}
