import type { RecordingOptions } from 'expo-audio';

export const VOICE_INPUT_RECORDING_OPTIONS: RecordingOptions = {
  isMeteringEnabled: false,
  extension: '.m4a',
  sampleRate: 44100,
  numberOfChannels: 1,
  bitRate: 128000,
  android: {
    outputFormat: 'mpeg4',
    audioEncoder: 'aac',
    audioSource: 'voice_recognition',
  },
  ios: {
    audioQuality: 96,
    outputFormat: 'aac',
  },
  web: {
    mimeType: 'audio/webm',
    bitsPerSecond: 128000,
  },
};
