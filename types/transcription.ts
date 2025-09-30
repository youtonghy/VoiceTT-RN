export type MessageStatus = 'pending' | 'transcribing' | 'completed' | 'failed';
export type TranslationStatus = 'idle' | 'pending' | 'completed' | 'failed';

export interface TranscriptQaItem {
  question: string;
  answer: string;
}

export interface SegmentMetadata {
  fileUri: string;
  startOffsetMs: number;
  endOffsetMs: number;
  durationMs: number;
  createdAt: number;
  engine: string;
  model: string;
}

export interface TranscriptionMessage {
  id: number;
  title: string;
  transcript?: string;
  translation?: string;
  status: MessageStatus;
  translationStatus: TranslationStatus;
  error?: string;
  translationError?: string;
  createdAt: number;
  updatedAt: number;
  qaAutoEnabled?: boolean;
  qaItems?: TranscriptQaItem[];
  qaUpdatedAt?: number;
  qaProcessedLength?: number;
  qaTranscriptHash?: string;
  qaSettingsSignature?: string;
  segment?: SegmentMetadata;
  language?: string;
}

export interface SegmentedTranscriptionResult {
  text: string;
  language?: string;
}

export interface TranslationResult {
  text: string;
  detectedLanguage?: string;
}
