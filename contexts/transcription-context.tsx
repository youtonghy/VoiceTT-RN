import {
  useAudioRecorder,
  useAudioRecorderState,
  RecordingOptions,
  setAudioModeAsync,
  requestRecordingPermissionsAsync,
  getRecordingPermissionsAsync,
  type AudioRecorder,
} from 'expo-audio';
import { deleteAsync } from 'expo-file-system/legacy';
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Alert, Platform } from 'react-native';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';

import { useSettings } from '@/contexts/settings-context';
import {
  resolveTranscriptionModel,
  transcribeSegment,
  translateText,
  type TranscriptionSegmentPayload,
} from '@/services/transcription';
import { AppSettings } from '@/types/settings';
import {
  TranscriptionMessage,
  SegmentMetadata,
  TranscriptQaItem,
} from '@/types/transcription';

interface InternalSegmentState {
  candidateStartMs: number | null;
  confirmedStartMs: number | null;
  belowThresholdStartMs: number | null;
  messageId: number | null;
  isActive: boolean;
}

const initialSegmentState: InternalSegmentState = {
  candidateStartMs: null,
  confirmedStartMs: null,
  belowThresholdStartMs: null,
  messageId: null,
  isActive: false,
};

interface UpdateMessageQaPayload {
  items: TranscriptQaItem[];
  processedLength: number;
  transcriptHash: string;
  settingsSignature: string;
}

interface SessionToggleOptions {
  qaAutoEnabled?: boolean;
}

interface TranscriptionContextValue {
  messages: TranscriptionMessage[];
  isSessionActive: boolean;
  toggleSession: (options?: SessionToggleOptions) => Promise<void>;
  stopSession: () => Promise<void>;
  isRecording: boolean;
  error: string | null;
  clearError: () => void;
  replaceMessages: (nextMessages: TranscriptionMessage[]) => void;
  updateMessageQa: (messageId: number, payload: UpdateMessageQaPayload) => void;
}

const TranscriptionContext = createContext<TranscriptionContextValue | undefined>(undefined);

const isElectronDesktop =
  Platform.OS === 'web' &&
  typeof window !== 'undefined' &&
  Boolean((window as { electron?: unknown }).electron);

type DesktopRecorderWithMediaRecorder = AudioRecorder & {
  mediaRecorder?: MediaRecorder | null;
};

let preferredDesktopAudioInputId: string | null = null;
let desktopAudioOverrideInstalled = false;
let originalGetUserMedia:
  | ((constraints: MediaStreamConstraints) => Promise<MediaStream>)
  | null = null;
let desktopMeteringStream: MediaStream | null = null;
let desktopMeteringContext: AudioContext | null = null;
let desktopMeteringAnalyser: AnalyserNode | null = null;
let desktopMeteringData: Uint8Array | null = null;

function updatePreferredDesktopAudioInputId(value: string | null) {
  preferredDesktopAudioInputId = value;
}

function applyPreferredAudioInput(
  constraints: MediaStreamConstraints,
  preferredId: string | null,
) {
  if (!preferredId || !constraints || typeof constraints !== 'object') {
    return { nextConstraints: constraints, shouldFallback: false };
  }
  if (!Object.prototype.hasOwnProperty.call(constraints, 'audio')) {
    return { nextConstraints: constraints, shouldFallback: false };
  }
  const audioConstraint = constraints.audio;
  if (!audioConstraint) {
    return { nextConstraints: constraints, shouldFallback: false };
  }
  if (typeof audioConstraint === 'boolean') {
    if (!audioConstraint) {
      return { nextConstraints: constraints, shouldFallback: false };
    }
    return {
      nextConstraints: {
        ...constraints,
        audio: { deviceId: { exact: preferredId } },
      },
      shouldFallback: true,
    };
  }
  if (typeof audioConstraint === 'object') {
    if ('deviceId' in audioConstraint) {
      return { nextConstraints: constraints, shouldFallback: false };
    }
    return {
      nextConstraints: {
        ...constraints,
        audio: {
          ...(audioConstraint as MediaTrackConstraints),
          deviceId: { exact: preferredId },
        },
      },
      shouldFallback: true,
    };
  }
  return { nextConstraints: constraints, shouldFallback: false };
}

function stopDesktopMetering() {
  if (desktopMeteringContext) {
    desktopMeteringContext.close().catch(() => undefined);
  }
  desktopMeteringStream = null;
  desktopMeteringContext = null;
  desktopMeteringAnalyser = null;
  desktopMeteringData = null;
}

function attachDesktopMeteringStream(stream: MediaStream) {
  if (!isElectronDesktop || !stream) {
    return;
  }
  if (desktopMeteringStream === stream && desktopMeteringAnalyser) {
    return;
  }
  stopDesktopMetering();

  const AudioContextConstructor =
    (window as typeof window & { webkitAudioContext?: typeof AudioContext }).AudioContext ||
    (window as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioContextConstructor) {
    return;
  }

  const context = new AudioContextConstructor();
  if (context.state === 'suspended') {
    context.resume().catch(() => undefined);
  }
  const analyser = context.createAnalyser();
  analyser.fftSize = 2048;
  const source = context.createMediaStreamSource(stream);
  source.connect(analyser);

  desktopMeteringStream = stream;
  desktopMeteringContext = context;
  desktopMeteringAnalyser = analyser;
  desktopMeteringData = new Uint8Array(analyser.fftSize);

  stream.getTracks().forEach((track) => {
    track.addEventListener('ended', () => {
      if (desktopMeteringStream === stream) {
        stopDesktopMetering();
      }
    });
  });
  console.log('[desktop-input] Desktop metering attached');
}

function readDesktopMeteringDb(): number | undefined {
  if (!desktopMeteringAnalyser || !desktopMeteringData) {
    return undefined;
  }
  desktopMeteringAnalyser.getByteTimeDomainData(desktopMeteringData);
  let sum = 0;
  for (let index = 0; index < desktopMeteringData.length; index += 1) {
    const normalized = (desktopMeteringData[index] - 128) / 128;
    sum += normalized * normalized;
  }
  const rms = Math.sqrt(sum / desktopMeteringData.length);
  return rms > 0 ? 20 * Math.log10(rms) : -160;
}

function installDesktopAudioInputOverride() {
  if (desktopAudioOverrideInstalled || !isElectronDesktop) {
    return;
  }
  if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
    return;
  }

  const mediaDevices = navigator.mediaDevices;
  originalGetUserMedia = mediaDevices.getUserMedia.bind(mediaDevices);
  mediaDevices.getUserMedia = (constraints) => {
    if (!originalGetUserMedia) {
      return Promise.reject(new Error('getUserMedia unavailable'));
    }
    const normalizedConstraints = (constraints ?? {}) as MediaStreamConstraints;
    const { nextConstraints, shouldFallback } = applyPreferredAudioInput(
      normalizedConstraints,
      preferredDesktopAudioInputId,
    );
    if (preferredDesktopAudioInputId) {
      console.log('[desktop-input] getUserMedia override active', {
        deviceId: preferredDesktopAudioInputId,
        shouldFallback,
      });
    }
    const attempt = originalGetUserMedia(nextConstraints).then((stream) => {
      attachDesktopMeteringStream(stream);
      return stream;
    });
    if (!shouldFallback) {
      return attempt;
    }
    return attempt.catch((error) =>
      originalGetUserMedia!(normalizedConstraints)
        .then((stream) => {
          attachDesktopMeteringStream(stream);
          return stream;
        })
        .catch(() => Promise.reject(error))
    );
  };
  console.log('[desktop-input] Installed getUserMedia override');
  desktopAudioOverrideInstalled = true;
}

function getDesktopMediaRecorder(recorder: AudioRecorder): MediaRecorder | null {
  if (!isElectronDesktop || typeof MediaRecorder === 'undefined') {
    return null;
  }
  const candidate = (recorder as DesktopRecorderWithMediaRecorder).mediaRecorder;
  if (!candidate || typeof candidate.requestData !== 'function') {
    return null;
  }
  return candidate;
}

function resolveDesktopRecordingStream(recorder: AudioRecorder): MediaStream | null {
  const mediaRecorder = getDesktopMediaRecorder(recorder);
  if (mediaRecorder?.stream) {
    return mediaRecorder.stream;
  }
  if (desktopMeteringStream) {
    return desktopMeteringStream;
  }
  return null;
}

function buildDesktopMediaRecorderOptions(): MediaRecorderOptions {
  const recordingOptions = buildRecordingOptions();
  const webOptions = recordingOptions.web;
  const options: MediaRecorderOptions = {};
  const mimeType = webOptions?.mimeType;
  if (mimeType && typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(mimeType)) {
    options.mimeType = mimeType;
  }
  const bitsPerSecond = webOptions?.bitsPerSecond ?? recordingOptions.bitRate;
  if (bitsPerSecond) {
    options.bitsPerSecond = bitsPerSecond;
  }
  return options;
}

function createDesktopSegmentRecorder(stream: MediaStream): MediaRecorder | null {
  if (!isElectronDesktop || typeof MediaRecorder === 'undefined') {
    return null;
  }
  const options = buildDesktopMediaRecorderOptions();
  try {
    return new MediaRecorder(stream, options);
  } catch (error) {
    try {
      return new MediaRecorder(stream);
    } catch (fallbackError) {
      console.warn('[transcription] Failed to create desktop segment recorder', fallbackError);
      return null;
    }
  }
}

async function stopDesktopSegmentRecorder(recorder: MediaRecorder | null): Promise<Blob | null> {
  if (!recorder || recorder.state === 'inactive') {
    return null;
  }
  return new Promise<Blob>((resolve, reject) => {
    let settled = false;
    const chunks: Blob[] = [];
    const cleanup = () => {
      recorder.removeEventListener('dataavailable', handleData);
      recorder.removeEventListener('error', handleError);
      recorder.removeEventListener('stop', handleStop);
    };
    const handleData = (event: BlobEvent) => {
      if (event.data && event.data.size > 0) {
        chunks.push(event.data);
      }
    };
    const handleError = (event: Event) => {
      if (settled) {
        return;
      }
      settled = true;
      cleanup();
      reject(new Error(`MediaRecorder error: ${event.type}`));
    };
    const handleStop = () => {
      if (settled) {
        return;
      }
      settled = true;
      cleanup();
      if (!chunks.length) {
        resolve(new Blob());
        return;
      }
      const type = chunks[0]?.type || recorder.mimeType;
      resolve(new Blob(chunks, type ? { type } : undefined));
    };
    recorder.addEventListener('dataavailable', handleData);
    recorder.addEventListener('error', handleError);
    recorder.addEventListener('stop', handleStop);
    try {
      recorder.stop();
    } catch (error) {
      settled = true;
      cleanup();
      reject(error);
    }
  });
}

function writeAscii(view: DataView, offset: number, value: string) {
  for (let i = 0; i < value.length; i += 1) {
    view.setUint8(offset + i, value.charCodeAt(i));
  }
}

function encodeWavFromAudioBuffer(buffer: AudioBuffer): ArrayBuffer {
  const sampleRate = buffer.sampleRate;
  const length = buffer.length;
  const channelCount = buffer.numberOfChannels;
  const pcm = new Int16Array(length);
  const channels: Float32Array[] = [];
  for (let channel = 0; channel < channelCount; channel += 1) {
    channels.push(buffer.getChannelData(channel));
  }
  for (let index = 0; index < length; index += 1) {
    let mixed = 0;
    for (let channel = 0; channel < channelCount; channel += 1) {
      mixed += channels[channel][index] ?? 0;
    }
    mixed /= channelCount;
    const clamped = Math.max(-1, Math.min(1, mixed));
    pcm[index] = clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff;
  }

  const blockAlign = 2;
  const byteRate = sampleRate * blockAlign;
  const bufferLength = 44 + pcm.length * 2;
  const wavBuffer = new ArrayBuffer(bufferLength);
  const view = new DataView(wavBuffer);
  writeAscii(view, 0, 'RIFF');
  view.setUint32(4, 36 + pcm.length * 2, true);
  writeAscii(view, 8, 'WAVE');
  writeAscii(view, 12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, 16, true);
  writeAscii(view, 36, 'data');
  view.setUint32(40, pcm.length * 2, true);
  new Uint8Array(wavBuffer, 44).set(new Uint8Array(pcm.buffer));
  return wavBuffer;
}

async function normalizeDesktopRecordingUri(fileUri: string): Promise<string | null> {
  if (!isElectronDesktop || typeof fetch !== 'function') {
    return null;
  }
  if (!fileUri.startsWith('blob:')) {
    return null;
  }
  const response = await fetch(fileUri);
  if (!response.ok) {
    return null;
  }
  const blob = await response.blob();
  const mimeType = blob.type.toLowerCase();
  console.log('[transcription] Segment blob', { mimeType, size: blob.size });
  if (!mimeType.includes('webm') && !mimeType.includes('ogg') && !mimeType.includes('mp4')) {
    return null;
  }
  const arrayBuffer = await blob.arrayBuffer();
  const AudioContextConstructor =
    (window as typeof window & { webkitAudioContext?: typeof AudioContext }).AudioContext ||
    (window as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioContextConstructor) {
    return null;
  }
  const context = new AudioContextConstructor();
  if (context.state === 'suspended') {
    await context.resume();
  }
  try {
    const audioBuffer = await context.decodeAudioData(arrayBuffer);
    const wavBuffer = encodeWavFromAudioBuffer(audioBuffer);
    const wavBlob = new Blob([wavBuffer], { type: 'audio/wav' });
    const wavUri = URL.createObjectURL(wavBlob);
    console.log('[transcription] Converted segment to WAV', { size: wavBlob.size });
    return wavUri;
  } finally {
    await context.close().catch(() => undefined);
  }
}

interface RecordingStatus {
  isRecording: boolean;
  durationMillis: number;
  metering?: number;
  isDoneRecording: boolean;
}

function meteringToRms(value: number | undefined): number {
  if (typeof value !== 'number') {
    return 0;
  }
  if (value <= -160) {
    return 0;
  }
  return Math.pow(10, value / 20);
}

function buildRecordingOptions(): RecordingOptions {
  return {
    isMeteringEnabled: true,
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
      audioQuality: 96, // HIGH
      outputFormat: 'aac',
    },
    web: {
      mimeType: 'audio/webm',
      bitsPerSecond: 128000,
    },
  };
}

function useLatestRef<T>(value: T) {
  const ref = useRef(value);
  useEffect(() => {
    ref.current = value;
  }, [value]);
  return ref;
}

function areQaItemsEqual(left?: TranscriptQaItem[], right?: TranscriptQaItem[]): boolean {
  if (left === right) {
    return true;
  }
  if (!left || !right) {
    return !left && !right;
  }
  if (left.length !== right.length) {
    return false;
  }
  for (let index = 0; index < left.length; index += 1) {
    if (left[index].question !== right[index].question || left[index].answer !== right[index].answer) {
      return false;
    }
  }
  return true;
}

function withTimeout<T>(promise: Promise<T>, ms: number, onTimeout: () => void): Promise<T> {
  if (!ms || ms <= 0) {
    return promise;
  }
  let timeoutHandle: any;
  const timeoutPromise = new Promise<T>((_, reject) => {
    timeoutHandle = setTimeout(() => {
      onTimeout();
      reject(new Error('timeout'));
    }, ms);
  });
  return Promise.race([promise, timeoutPromise]).finally(() => {
    clearTimeout(timeoutHandle);
  });
}

function createInitialMessage(messageId: number, qaAutoEnabled: boolean, t: TFunction<'common'>): TranscriptionMessage {
  const timestamp = Date.now();
  return {
    id: messageId,
    title: t('transcription.messages.default_title', { id: messageId }),
    status: 'pending',
    translationStatus: 'idle',
    createdAt: timestamp,
    updatedAt: timestamp,
    qaAutoEnabled,
  };
}

function computeNextMessageId(messages: TranscriptionMessage[]): number {
  if (messages.length === 0) {
    return 1;
  }
  return messages.reduce((maxId, item) => (item.id > maxId ? item.id : maxId), 0) + 1;
}

function applySettingsToSegment(segment: InternalSegmentState, settings: AppSettings, durationMs: number) {
  const preRoll = Math.max(0, settings.preRollDurationSec) * 1000;
  if (segment.candidateStartMs != null) {
    const startWithPreRoll = Math.max(0, segment.candidateStartMs - preRoll);
    segment.confirmedStartMs = startWithPreRoll;
  } else {
    segment.confirmedStartMs = 0;
  }
  if (settings.maxSegmentDurationSec > 0) {
    const maxDurationMs = settings.maxSegmentDurationSec * 1000;
    if (durationMs - (segment.confirmedStartMs ?? 0) > maxDurationMs) {
      segment.belowThresholdStartMs = durationMs;
    }
  }
}

export function TranscriptionProvider({ children }: React.PropsWithChildren) {
  const { t } = useTranslation();
  const { settings } = useSettings();
  const settingsRef = useLatestRef(settings);

  useEffect(() => {
    if (!isElectronDesktop) {
      return;
    }
    installDesktopAudioInputOverride();
    updatePreferredDesktopAudioInputId(settings.desktopAudioInputId ?? null);
    console.log('[desktop-input] Preferred device updated', {
      deviceId: settings.desktopAudioInputId ?? 'default',
    });
  }, [settings.desktopAudioInputId]);

  const [messages, setMessages] = useState<TranscriptionMessage[]>([]);
  const messagesRef = useLatestRef(messages);

  const [isSessionActive, setIsSessionActive] = useState(false);
  const sessionActiveRef = useLatestRef(isSessionActive);

  const [qaAutoMode, setQaAutoMode] = useState(false);
  const qaAutoModeRef = useLatestRef(qaAutoMode);

  const [error, setError] = useState<string | null>(null);
  const recorder = useAudioRecorder(buildRecordingOptions());
  const recorderState = useAudioRecorderState(recorder);
  const isRecording = recorderState.isRecording;

  console.log('[TranscriptionProvider] recorderState:', {
    isRecording: recorderState.isRecording,
    durationMillis: recorderState.durationMillis,
    metering: recorderState.metering,
  });

  const segmentStateRef = useRef<InternalSegmentState>({ ...initialSegmentState });
  const nextMessageIdRef = useRef(1);
  const segmentBaseMsRef = useRef(0);
  const desktopSegmentRecorderRef = useRef<MediaRecorder | null>(null);
  const desktopSegmentStreamRef = useRef<MediaStream | null>(null);
  const statusIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const meteringSourceRef = useRef<'recorder' | 'desktop' | 'none'>('none');
  const finalizeSegmentRef = useRef<((status: RecordingStatus | null) => Promise<void>) | null>(null);
  const handleStatusUpdateRef = useRef<((status: RecordingStatus) => void) | null>(null);
  const meteringStaleSinceRef = useRef<number | null>(null);

  const setMessagesAndRef = useCallback((updater: (prev: TranscriptionMessage[]) => TranscriptionMessage[]) => {
    setMessages((prev) => {
      const next = updater(prev);
      messagesRef.current = next;
      return next;
    });
  }, [messagesRef]);

  const resetSegmentState = useCallback(() => {
    segmentStateRef.current = { ...initialSegmentState };
  }, []);

  const replaceMessages = useCallback((nextMessages: TranscriptionMessage[]) => {
    const current = messagesRef.current;
    let hasDifference = current.length !== nextMessages.length;
    if (!hasDifference) {
      for (let index = 0; index < current.length; index += 1) {
        const existing = current[index];
        const incoming = nextMessages[index];
        if (
          existing.id !== incoming.id ||
          existing.updatedAt !== incoming.updatedAt ||
          existing.status !== incoming.status ||
          existing.transcript !== incoming.transcript ||
          existing.translationStatus !== incoming.translationStatus ||
          existing.translation !== incoming.translation ||
          existing.qaAutoEnabled !== incoming.qaAutoEnabled ||
          existing.qaUpdatedAt !== incoming.qaUpdatedAt ||
          existing.qaProcessedLength !== incoming.qaProcessedLength ||
          existing.qaTranscriptHash !== incoming.qaTranscriptHash ||
          existing.qaSettingsSignature !== incoming.qaSettingsSignature ||
          !areQaItemsEqual(existing.qaItems, incoming.qaItems)
        ) {
          hasDifference = true;
          break;
        }
      }
    }
    if (!hasDifference) {
      return;
    }
    const normalized = nextMessages.map((msg) => ({ ...msg }));
    setMessagesAndRef(() => normalized);
    nextMessageIdRef.current = computeNextMessageId(normalized);
  }, [messagesRef, setMessagesAndRef]);
  const updateMessage = useCallback((messageId: number, updater: (msg: TranscriptionMessage) => TranscriptionMessage) => {
    setMessagesAndRef((prev) => prev.map((msg) => (msg.id === messageId ? updater(msg) : msg)));
  }, [setMessagesAndRef]);

  const updateMessageQa = useCallback((messageId: number, payload: UpdateMessageQaPayload) => {
    const timestamp = Date.now();
    updateMessage(messageId, (msg) => {
      const sameItems = areQaItemsEqual(msg.qaItems, payload.items);
      const sameProcessedLength = (msg.qaProcessedLength ?? 0) === payload.processedLength;
      const sameTranscriptHash = msg.qaTranscriptHash === payload.transcriptHash;
      const sameSignature = msg.qaSettingsSignature === payload.settingsSignature;
      if (sameItems && sameProcessedLength && sameTranscriptHash && sameSignature) {
        return msg;
      }
      const normalizedItems = payload.items.map((item) => ({ ...item }));
      return {
        ...msg,
        qaItems: normalizedItems,
        qaProcessedLength: payload.processedLength,
        qaTranscriptHash: payload.transcriptHash,
        qaSettingsSignature: payload.settingsSignature,
        qaUpdatedAt: timestamp,
        updatedAt: Math.max(msg.updatedAt, timestamp),
      };
    });
  }, [updateMessage]);

  const cleanupRecordingFile = useCallback(async (fileUri: string | null | undefined) => {
    if (fileUri) {
      try {
        if (Platform.OS === 'web' && fileUri.startsWith('blob:')) {
          URL.revokeObjectURL(fileUri);
          return;
        }
        await deleteAsync(fileUri, { idempotent: true });
      } catch (cleanupError) {
        console.warn('[transcription] Failed to clean recording file', cleanupError);
      }
    }
  }, []);

  const finalizeSegment = useCallback(async (status: RecordingStatus | null) => {
    const snapshot = { ...segmentStateRef.current };
    if (snapshot.messageId == null) {
      return;
    }
    resetSegmentState();
    const currentMessageId = snapshot.messageId;
    const absoluteDurationMs =
      status?.durationMillis ?? recorder.getStatus().durationMillis ?? recorder.currentTime * 1000;
    const segmentBaseMs = segmentBaseMsRef.current;
    const endOffsetMs = Math.max(0, absoluteDurationMs - segmentBaseMs);
    const rawStartOffsetMs = (snapshot.confirmedStartMs ?? segmentBaseMs) - segmentBaseMs;
    const startOffsetMs = Math.max(0, Math.min(endOffsetMs, rawStartOffsetMs));
    console.log('[transcription] Finalizing segment', {
      messageId: currentMessageId,
      startOffsetMs,
      durationMs: endOffsetMs,
    });
    const payload: TranscriptionSegmentPayload = {
      fileUri: '',
      startOffsetMs,
      endOffsetMs,
      durationMs: endOffsetMs,
      messageId: currentMessageId,
    };
    let originalFileUri: string | null = null;
    try {
      let normalizedUri: string | null = null;
      let useDesktopSegmenter = isElectronDesktop && desktopSegmentRecorderRef.current !== null;
      if (useDesktopSegmenter) {
        try {
          const segmentRecorder = desktopSegmentRecorderRef.current;
          desktopSegmentRecorderRef.current = null;
          const segmentBlob = await stopDesktopSegmentRecorder(segmentRecorder);
          if (!segmentBlob || segmentBlob.size === 0) {
            throw new Error(t('transcription.errors.empty_recording'));
          }
          const blobUri = URL.createObjectURL(segmentBlob);
          originalFileUri = blobUri;
          normalizedUri = blobUri;
          segmentBaseMsRef.current = absoluteDurationMs;
          if (sessionActiveRef.current) {
            const stream =
              desktopSegmentStreamRef.current ?? resolveDesktopRecordingStream(recorder);
            if (stream) {
              desktopSegmentStreamRef.current = stream;
              const nextRecorder = createDesktopSegmentRecorder(stream);
              if (nextRecorder) {
                try {
                  nextRecorder.start();
                  desktopSegmentRecorderRef.current = nextRecorder;
                  console.log('[transcription] Desktop segment recorder restarted');
                } catch (restartError) {
                  console.warn('[transcription] Failed to restart desktop segment recorder', restartError);
                  desktopSegmentRecorderRef.current = null;
                }
              }
            } else {
              console.warn('[transcription] Desktop recording stream unavailable for restart');
            }
          }
        } catch (segmentError) {
          console.warn('[transcription] Desktop segment capture failed, falling back', segmentError);
          useDesktopSegmenter = false;
          normalizedUri = null;
          originalFileUri = null;
        }
      }

      if (!useDesktopSegmenter) {
        // Stop the current recording
        if (statusIntervalRef.current) {
          clearInterval(statusIntervalRef.current);
          statusIntervalRef.current = null;
        }
        await recorder.stop();
        const fileUri = recorder.uri;
        if (!fileUri) {
          throw new Error(t('transcription.errors.empty_recording'));
        }
        originalFileUri = fileUri;
        normalizedUri = fileUri;
      }

      if (!normalizedUri) {
        throw new Error(t('transcription.errors.empty_recording'));
      }

      try {
        const maybeNormalized = await normalizeDesktopRecordingUri(normalizedUri);
        if (maybeNormalized) {
          normalizedUri = maybeNormalized;
        }
      } catch (normalizeError) {
        console.warn('[transcription] Failed to normalize audio segment', normalizeError);
      }
      payload.fileUri = normalizedUri;

      if (sessionActiveRef.current && !useDesktopSegmenter) {
        startNewRecording().catch((restartError) => {
          console.error('[transcription] Failed to restart recording', restartError);
        });
      }

      const segmentMetadata: SegmentMetadata = {
        fileUri: normalizedUri,
        startOffsetMs,
        endOffsetMs,
        durationMs: endOffsetMs,
        createdAt: Date.now(),
        engine: settingsRef.current.transcriptionEngine,
        model: resolveTranscriptionModel(settingsRef.current),
      };
      updateMessage(currentMessageId, (msg) => ({
        ...msg,
        status: 'transcribing',
        segment: segmentMetadata,
        updatedAt: Date.now(),
      }));

      const abortController = new AbortController();
      let transcription;
      try {
        transcription = await transcribeSegment(payload, settingsRef.current, abortController.signal);
      } catch (transcribeError) {
        console.warn('[transcription] Transcription failed', transcribeError);
        updateMessage(currentMessageId, (msg) => ({
          ...msg,
          status: 'failed',
          error: (transcribeError as Error).message,
          updatedAt: Date.now(),
        }));
        return;
      }
      console.log('[transcription] Transcription completed', {
        messageId: currentMessageId,
        length: transcription.text.length,
        language: transcription.language ?? 'auto',
      });

      const shouldTranslate = settingsRef.current.enableTranslation && settingsRef.current.translationEngine !== 'none';

      updateMessage(currentMessageId, (msg) => ({
        ...msg,
        status: 'completed',
        transcript: transcription.text,
        language: transcription.language || msg.language,
        translationStatus: shouldTranslate ? 'pending' : msg.translationStatus,
        updatedAt: Date.now(),
      }));

      if (shouldTranslate) {
        const translationController = new AbortController();
        try {
          const translationResult = await withTimeout(
            translateText(transcription.text, settingsRef.current, translationController.signal),
            settingsRef.current.translationTimeoutSec * 1000,
            () => translationController.abort()
          );
          const trimmed = translationResult.text?.trim();
          if (trimmed) {
            updateMessage(currentMessageId, (msg) => ({
              ...msg,
              translation: trimmed,
              translationStatus: 'completed',
              updatedAt: Date.now(),
            }));
          } else {
            updateMessage(currentMessageId, (msg) => ({
              ...msg,
              translationStatus: 'failed',
              translationError: t('translation.errors.empty_result'),
              updatedAt: Date.now(),
            }));
          }
        } catch (translateError: any) {
          updateMessage(currentMessageId, (msg) => ({
            ...msg,
            translationStatus: 'failed',
            translationError: translateError?.message || t('translation.status.failed'),
            updatedAt: Date.now(),
          }));
        }
      }
    } catch (segmentError) {
      updateMessage(currentMessageId, (msg) => ({
        ...msg,
        status: 'failed',
        error: (segmentError as Error).message,
        translationStatus: msg.translationStatus === 'pending' ? 'failed' : msg.translationStatus,
        translationError:
          msg.translationStatus === 'pending' ? (segmentError as Error).message : msg.translationError,
        updatedAt: Date.now(),
      }));
    } finally {
      if (payload.fileUri) {
        cleanupRecordingFile(payload.fileUri);
      }
      if (originalFileUri && originalFileUri !== payload.fileUri) {
        cleanupRecordingFile(originalFileUri);
      }
    }
  }, [cleanupRecordingFile, recorder, resetSegmentState, segmentBaseMsRef, sessionActiveRef, settingsRef, t, updateMessage]);

  // Update the ref when finalizeSegment changes
  useEffect(() => {
    finalizeSegmentRef.current = finalizeSegment;
  }, [finalizeSegment]);

  const startNewRecording = useCallback(async () => {
    console.log('[transcription] startNewRecording - preparing to record');
    try {
      await recorder.prepareToRecordAsync();
      console.log('[transcription] recorder prepared, starting record');
      recorder.record();
      console.log('[transcription] record() called');
      segmentBaseMsRef.current = 0;
      if (isElectronDesktop) {
        const stream = resolveDesktopRecordingStream(recorder);
        if (stream) {
          desktopSegmentStreamRef.current = stream;
          if (desktopSegmentRecorderRef.current) {
            stopDesktopSegmentRecorder(desktopSegmentRecorderRef.current).catch((stopError) => {
              console.warn('[transcription] Failed to stop existing desktop segment recorder', stopError);
            });
          }
          const segmentRecorder = createDesktopSegmentRecorder(stream);
          if (segmentRecorder) {
            try {
              segmentRecorder.start();
              desktopSegmentRecorderRef.current = segmentRecorder;
              console.log('[transcription] Desktop segment recorder started');
            } catch (segmentError) {
              console.warn('[transcription] Failed to start desktop segment recorder', segmentError);
              desktopSegmentRecorderRef.current = null;
            }
          } else {
            desktopSegmentRecorderRef.current = null;
          }
        } else {
          console.warn('[transcription] Desktop recording stream unavailable');
        }
      }

      // Poll recording status periodically for metering and duration
      if (statusIntervalRef.current) {
        clearInterval(statusIntervalRef.current);
      }
      statusIntervalRef.current = setInterval(() => {
        const recorderStatus = recorder.getStatus();
        const fallbackMetering = isElectronDesktop ? readDesktopMeteringDb() : undefined;
        const metering =
          typeof recorderStatus.metering === 'number' && Number.isFinite(recorderStatus.metering)
            ? recorderStatus.metering
            : fallbackMetering;
        const nextSource: 'recorder' | 'desktop' | 'none' =
          typeof recorderStatus.metering === 'number'
            ? 'recorder'
            : typeof fallbackMetering === 'number'
            ? 'desktop'
            : 'none';
        if (meteringSourceRef.current !== nextSource) {
          console.log('[transcription] Metering source', { source: nextSource });
          meteringSourceRef.current = nextSource;
        }
        const status: RecordingStatus = {
          isRecording: recorderStatus.isRecording,
          durationMillis: recorderStatus.durationMillis,
          metering,
          isDoneRecording: false,
        };
        handleStatusUpdateRef.current?.(status);
      }, 100);
      console.log('[transcription] status interval started');
    } catch (startError) {
      console.error('[transcription] Failed to start recording', startError);
      setError(t('transcription.errors.unable_to_start', { message: (startError as Error).message }));
    }
  }, [recorder, segmentBaseMsRef, t]);

  const stopAndResetRecording = useCallback(async () => {
    if (statusIntervalRef.current) {
      clearInterval(statusIntervalRef.current);
      statusIntervalRef.current = null;
    }
    if (recorder.isRecording) {
      try {
        await recorder.stop();
      } catch (stopError) {
        console.warn('[transcription] Failed to stop recording', stopError);
      }
    }
  }, [recorder]);

  const startSession = useCallback(async (options?: SessionToggleOptions) => {
    console.log('[transcription] startSession called');
    if (sessionActiveRef.current) {
      console.log('[transcription] session already active, returning');
      return;
    }
    try {
      console.log('[transcription] checking existing permissions');
      let permission = await getRecordingPermissionsAsync();
      console.log('[transcription] existing permission status:', permission);

      if (!permission.granted) {
        console.log('[transcription] requesting recording permissions');
        permission = await requestRecordingPermissionsAsync();
        console.log('[transcription] permission result:', permission);
        if (!permission.granted) {
          console.log('[transcription] permission denied');
          Alert.alert(t('alerts.microphone_permission.title'), t('alerts.microphone_permission.message'));
          setError(t('transcription.errors.permission_denied'));
          return;
        }
      } else {
        console.log('[transcription] permission already granted, skipping request');
      }
      console.log('[transcription] setting audio mode');
      await setAudioModeAsync({
        allowsRecording: true,
        playsInSilentMode: true,
        shouldPlayInBackground: true,
        interruptionModeAndroid: 'duckOthers',
      });
      console.log('[transcription] audio mode set, resetting segment state');
      resetSegmentState();
      setQaAutoMode(options?.qaAutoEnabled ?? false);
      setIsSessionActive(true);
      console.log('[transcription] starting new recording');
      await startNewRecording();
      console.log('[transcription] recording started successfully');
    } catch (startError) {
      console.error('[transcription] Failed to start session', startError);
      setError(t('transcription.errors.start_failed', { message: (startError as Error).message }));
      setQaAutoMode(false);
      setIsSessionActive(false);
    }
  }, [resetSegmentState, sessionActiveRef, startNewRecording, t]);

  const stopSession = useCallback(async () => {
    if (!sessionActiveRef.current) {
      return;
    }

    setIsSessionActive(false);
    setQaAutoMode(false);

    const hasActiveSegment = segmentStateRef.current.isActive && segmentStateRef.current.messageId != null;

    if (statusIntervalRef.current) {
      clearInterval(statusIntervalRef.current);
      statusIntervalRef.current = null;
    }

    if (hasActiveSegment && finalizeSegmentRef.current) {
      sessionActiveRef.current = false;
      try {
        await finalizeSegmentRef.current(null);
      } catch (finalizeError) {
        console.warn('[transcription] Failed to finalize active segment on stop', finalizeError);
      }
    }

    if (!hasActiveSegment && desktopSegmentRecorderRef.current) {
      const segmentRecorder = desktopSegmentRecorderRef.current;
      desktopSegmentRecorderRef.current = null;
      try {
        await stopDesktopSegmentRecorder(segmentRecorder);
      } catch (stopError) {
        console.warn('[transcription] Failed to stop desktop segment recorder', stopError);
      }
    }

    await stopAndResetRecording();
    resetSegmentState();
    segmentBaseMsRef.current = 0;
    desktopSegmentStreamRef.current = null;
  }, [resetSegmentState, segmentBaseMsRef, sessionActiveRef, stopAndResetRecording]);

  const toggleSession = useCallback(async (options?: SessionToggleOptions) => {
    console.log('[transcription] toggleSession called, isActive:', sessionActiveRef.current);
    if (sessionActiveRef.current) {
      await stopSession();
    } else {
      await startSession(options);
    }
  }, [sessionActiveRef, startSession, stopSession]);

  const handleStatusUpdate = useCallback((status: RecordingStatus) => {
    const durationMs = status.durationMillis ?? 0;
    if (!status.isRecording && !status.isDoneRecording && durationMs <= 0) {
      console.log('[transcription] handleStatusUpdate - skipping (not recording and duration=0)');
      return;
    }
    console.log('[transcription] handleStatusUpdate - duration:', durationMs, 'metering:', status.metering);
    const currentSettings = settingsRef.current;
    const segment = segmentStateRef.current;
    const normalizedMetering =
      typeof status.metering === 'number' && Number.isFinite(status.metering)
        ? status.metering
        : undefined;
    const now = Date.now();
    if (normalizedMetering === undefined) {
      meteringStaleSinceRef.current ??= now;
    } else {
      meteringStaleSinceRef.current = null;
    }
    const meteringUnavailableMs =
      meteringStaleSinceRef.current != null ? now - meteringStaleSinceRef.current : 0;
    const threshold = currentSettings.activationThreshold;
    const activationDurationMs = currentSettings.activationDurationSec * 1000;
    const shouldForceActivation = normalizedMetering === undefined && meteringUnavailableMs >= activationDurationMs;
    const rms = shouldForceActivation ? threshold + 0.05 : meteringToRms(normalizedMetering);

    console.log('[transcription] rms:', rms, 'threshold:', threshold, 'segment.isActive:', segment.isActive);

    if (!segment.isActive) {
      if (shouldForceActivation || rms >= threshold) {
        if (segment.candidateStartMs == null) {
          segment.candidateStartMs = durationMs;
          console.log('[transcription] candidate start set at:', durationMs);
        }
        const elapsedAbove = durationMs - (segment.candidateStartMs ?? durationMs);
        console.log('[transcription] elapsed above threshold:', elapsedAbove, 'need:', activationDurationMs);
        if (elapsedAbove >= activationDurationMs) {
          console.log('[transcription] ACTIVATING SEGMENT');
          segment.isActive = true;
          const messageId = nextMessageIdRef.current++;
          segment.messageId = messageId;
          applySettingsToSegment(segment, currentSettings, durationMs);
          const newMessage = createInitialMessage(messageId, qaAutoModeRef.current, t);
          if (currentSettings.enableTranslation && currentSettings.translationEngine !== 'none') {
            newMessage.translationStatus = 'idle';
          } else {
            newMessage.translationStatus = 'completed';
          }
          setMessagesAndRef((prev) => prev.concat(newMessage));
        }
      } else {
        segment.candidateStartMs = null;
      }
    } else {
      const isBelowThreshold = normalizedMetering === undefined ? false : rms < threshold;
      if (isBelowThreshold) {
        if (segment.belowThresholdStartMs == null) {
          segment.belowThresholdStartMs = durationMs;
        }
        const silenceElapsed = durationMs - (segment.belowThresholdStartMs ?? durationMs);
        if (silenceElapsed >= currentSettings.silenceDurationSec * 1000) {
          finalizeSegmentRef.current?.(status);
        }
      } else {
        segment.belowThresholdStartMs = null;
      }
      if (currentSettings.maxSegmentDurationSec > 0) {
        const startMs = segment.confirmedStartMs ?? 0;
        const segmentElapsed = durationMs - startMs;
        if (segmentElapsed >= currentSettings.maxSegmentDurationSec * 1000) {
          finalizeSegmentRef.current?.(status);
        }
      }
    }
  }, [qaAutoModeRef, setMessagesAndRef, settingsRef, t]);

  // Update the ref when handleStatusUpdate changes
  useEffect(() => {
    handleStatusUpdateRef.current = handleStatusUpdate;
  }, [handleStatusUpdate]);

  useEffect(() => {
    return () => {
      if (statusIntervalRef.current) {
        clearInterval(statusIntervalRef.current);
      }
      if (desktopSegmentRecorderRef.current) {
        const segmentRecorder = desktopSegmentRecorderRef.current;
        desktopSegmentRecorderRef.current = null;
        stopDesktopSegmentRecorder(segmentRecorder).catch(() => undefined);
      }
      stopAndResetRecording();
      desktopSegmentStreamRef.current = null;
    };
  }, [stopAndResetRecording]);

  const value = useMemo<TranscriptionContextValue>(() => ({
    messages,
    isSessionActive,
    toggleSession,
    stopSession,
    replaceMessages,
    updateMessageQa,
    isRecording,
    error,
    clearError: () => setError(null),
  }), [messages, isSessionActive, toggleSession, stopSession, replaceMessages, updateMessageQa, isRecording, error]);

  return <TranscriptionContext.Provider value={value}>{children}</TranscriptionContext.Provider>;
}

export function useTranscription() {
  const context = useContext(TranscriptionContext);
  if (!context) {
    throw new Error('useTranscription must be used within TranscriptionProvider');
  }
  return context;
}
