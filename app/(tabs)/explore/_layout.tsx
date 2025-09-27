import { Stack } from 'expo-router';

export default function SettingsLayout() {
  return (
    <Stack screenOptions={{ headerShadowVisible: false }}>
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="recording" options={{ title: '录音检测' }} />
      <Stack.Screen name="transcription" options={{ title: '转写设置' }} />
      <Stack.Screen name="translation" options={{ title: '翻译设置' }} />
      <Stack.Screen name="credentials" options={{ title: '凭据' }} />
    </Stack>
  );
}
