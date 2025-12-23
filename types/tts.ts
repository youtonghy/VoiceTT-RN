export type TextToSpeechFormat = 'mp3' | 'wav' | 'aac' | 'flac' | 'opus';

export type TtsMessageStatus = 'pending' | 'ready' | 'failed';

export interface TtsMessage {
  id: string;
  content: string;
  createdAt: number;
  status: TtsMessageStatus;
  error?: string;
  audioUri?: string;
  audioFormat?: TextToSpeechFormat;
  audioMimeType?: string;
  voice?: string;
  model?: string;
}
