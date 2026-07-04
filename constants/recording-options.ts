import {
  AudioQuality,
  IOSOutputFormat,
  type RecordingOptions,
} from 'expo-audio';

type BuildRecordingOptionsParams = {
  isMeteringEnabled: boolean;
};

export function buildVoiceRecordingOptions({
  isMeteringEnabled,
}: BuildRecordingOptionsParams): RecordingOptions {
  return {
    isMeteringEnabled,
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
      audioQuality: AudioQuality.HIGH,
      outputFormat: IOSOutputFormat.MPEG4AAC,
    },
    web: {
      mimeType: 'audio/webm',
      bitsPerSecond: 128000,
    },
  };
}

export const VOICE_INPUT_RECORDING_OPTIONS = buildVoiceRecordingOptions({
  isMeteringEnabled: false,
});

export const METERING_RECORDING_OPTIONS = buildVoiceRecordingOptions({
  isMeteringEnabled: true,
});
