import {
  useAudioRecorder,
  setAudioModeAsync,
  requestRecordingPermissionsAsync,
  getRecordingPermissionsAsync,
  type AudioRecorder,
  type RecorderState,
} from 'expo-audio';
import { toByteArray } from 'base64-js';
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
import { Platform } from 'react-native';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';

import { Alert } from '@/components/app-alert';
import { METERING_RECORDING_OPTIONS } from '@/constants/recording-options';
import { useSettings } from '@/contexts/settings-context';
import {
  resolveEffectiveTranscriptionMode,
  resolveTranscriptionModel,
  transcribeSegment,
  translateText,
  translateTextStream,
  type TranscriptionSegmentPayload,
} from '@/services/transcription';
import { RealtimeTranscriptionSession, resolveRealtimeTranscriptionModel } from '@/services/realtime';
import { createPcmCapture, type PcmCapture } from '@/services/realtime-audio';
import { AppSettings, AudioCaptureMode } from '@/types/settings';
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

export type SessionState = 'idle' | 'starting' | 'recording' | 'stopping' | 'failed';

interface StopSessionOptions {
  discardCurrentSegment?: boolean;
  cancelPendingTasks?: boolean;
  failureMessage?: string;
}

interface PendingTask {
  token: string;
  sessionId: string;
  messageId: number;
  transcriptionController: AbortController | null;
  translationController: AbortController | null;
}

interface TranscriptionContextValue {
  messages: TranscriptionMessage[];
  isSessionActive: boolean;
  toggleSession: (options?: SessionToggleOptions) => Promise<void>;
  stopSession: (options?: StopSessionOptions) => Promise<void>;
  isRecording: boolean;
  sessionState: SessionState;
  error: string | null;
  clearError: () => void;
  replaceMessages: (nextMessages: TranscriptionMessage[]) => void;
  updateMessageQa: (messageId: number, payload: UpdateMessageQaPayload) => void;
  retrySegment: (messageId: number) => Promise<void>;
}

const TranscriptionContext = createContext<TranscriptionContextValue | undefined>(undefined);

const isElectronDesktop =
  Platform.OS === 'web' &&
  typeof window !== 'undefined' &&
  Boolean((window as { electron?: unknown }).electron);
const isWebRuntime = Platform.OS === 'web' && typeof window !== 'undefined';

const VERBOSE_TRANSCRIPTION_LOGS = false;
const METERING_UNAVAILABLE_ACTIVATION_MS = 3000;
const METERING_UNAVAILABLE_MAX_SEGMENT_MS = 30000;

function logTranscriptionDebug(...args: unknown[]) {
  if (__DEV__ && VERBOSE_TRANSCRIPTION_LOGS) {
    console.log(...args);
  }
}

type DesktopRecorderWithMediaRecorder = AudioRecorder & {
  mediaRecorder?: MediaRecorder | null;
};

type DesktopCaptureFallbackReason =
  | 'permission_denied'
  | 'no_display_source'
  | 'no_audio_track'
  | 'unavailable'
  | 'unknown';

class DesktopCaptureError extends Error {
  reason: DesktopCaptureFallbackReason;

  constructor(reason: DesktopCaptureFallbackReason, message: string, cause?: unknown) {
    super(message);
    this.name = 'DesktopCaptureError';
    this.reason = reason;
    if (cause !== undefined) {
      (this as { cause?: unknown }).cause = cause;
    }
  }
}

let preferredDesktopAudioInputId: string | null = null;
let preferredCaptureMode: AudioCaptureMode = 'microphone';
let desktopAudioOverrideInstalled = false;
let originalGetUserMedia:
  | ((constraints: MediaStreamConstraints) => Promise<MediaStream>)
  | null = null;
let desktopMeteringStream: MediaStream | null = null;
let desktopMeteringContext: AudioContext | null = null;
let desktopMeteringAnalyser: AnalyserNode | null = null;
let desktopMeteringData: Uint8Array<ArrayBuffer> | null = null;
let desktopSystemAudioStream: MediaStream | null = null;
let desktopSystemAudioStreamRequest: Promise<MediaStream> | null = null;

function updatePreferredDesktopAudioInputId(value: string | null) {
  preferredDesktopAudioInputId = value;
}

function updatePreferredCaptureMode(value: AudioCaptureMode) {
  preferredCaptureMode = value === 'system' ? 'system' : 'microphone';
  if (preferredCaptureMode !== 'system') {
    clearDesktopSystemAudioStream();
  }
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error ?? 'unknown');
}

function getErrorName(error: unknown) {
  return error instanceof Error ? error.name : typeof error;
}

function classifyDesktopCaptureError(error: unknown): DesktopCaptureFallbackReason {
  if (error instanceof DesktopCaptureError) {
    return error.reason;
  }
  const message = getErrorMessage(error).toLowerCase();
  const name = getErrorName(error).toLowerCase();
  if (
    name.includes('notallowed') ||
    name.includes('permission') ||
    message.includes('permission denied') ||
    message.includes('permission') ||
    message.includes('denied') ||
    message.includes('not allowed')
  ) {
    return 'permission_denied';
  }
  if (message.includes('no screen') || message.includes('no display') || message.includes('display source')) {
    return 'no_display_source';
  }
  if (message.includes('audio track')) {
    return 'no_audio_track';
  }
  if (message.includes('not available') || message.includes('unavailable')) {
    return 'unavailable';
  }
  return 'unknown';
}

function notifyDesktopCaptureFailed(error: unknown) {
  if (typeof window === 'undefined') {
    return;
  }
  const message = getErrorMessage(error);
  const reason = classifyDesktopCaptureError(error);
  window.dispatchEvent(
    new CustomEvent('voicett-desktop-capture-failed', {
      detail: { message, reason },
    })
  );
}

function formatDesktopCaptureFailureMessage(
  t: TFunction<'common'>,
  error: unknown,
  reasonOverride?: unknown,
) {
  const fallbackReason =
    typeof reasonOverride === 'string' ? reasonOverride : classifyDesktopCaptureError(error);
  const reasonKey = [
    'permission_denied',
    'no_display_source',
    'no_audio_track',
    'unavailable',
    'unknown',
  ].includes(fallbackReason)
    ? fallbackReason
    : 'unknown';
  return t('transcription.errors.system_capture_failed', {
    message: `${t(`transcription.errors.system_capture_reasons.${reasonKey}`)} (${getErrorMessage(error)})`,
  });
}

function isLiveAudioStream(stream: MediaStream | null): stream is MediaStream {
  return Boolean(stream?.getAudioTracks().some((track) => track.readyState === 'live'));
}

function clearDesktopSystemAudioStream(options: { stop?: boolean } = {}) {
  const shouldStop = options.stop !== false;
  const stream = desktopSystemAudioStream;
  desktopSystemAudioStream = null;
  desktopSystemAudioStreamRequest = null;
  if (desktopMeteringStream === stream) {
    stopDesktopMetering();
  }
  if (shouldStop) {
    stream?.getTracks().forEach((track) => track.stop());
  }
}

async function acquireDesktopSystemAudioStream(): Promise<MediaStream> {
  if (!navigator.mediaDevices?.getDisplayMedia) {
    throw new DesktopCaptureError(
      'unavailable',
      'System audio capture is not available in this desktop runtime.'
    );
  }
  let stream: MediaStream;
  try {
    stream = await navigator.mediaDevices.getDisplayMedia({
      video: true,
      audio: {
        autoGainControl: false,
        echoCancellation: false,
        noiseSuppression: false,
      },
    });
  } catch (error) {
    throw new DesktopCaptureError(classifyDesktopCaptureError(error), getErrorMessage(error), error);
  }
  stream.getVideoTracks().forEach((track) => track.stop());
  const [audioTrack] = stream.getAudioTracks();
  if (!audioTrack) {
    stream.getTracks().forEach((track) => track.stop());
    throw new DesktopCaptureError(
      'no_audio_track',
      'System audio capture did not return an audio track.'
    );
  }
  const audioStream = new MediaStream([audioTrack]);
  audioTrack.addEventListener('ended', () => {
    if (desktopSystemAudioStream === audioStream) {
      clearDesktopSystemAudioStream({ stop: false });
    }
  });
  desktopSystemAudioStream = audioStream;
  return audioStream;
}

async function getDesktopSystemAudioStream(): Promise<MediaStream> {
  if (isLiveAudioStream(desktopSystemAudioStream)) {
    return desktopSystemAudioStream;
  }
  clearDesktopSystemAudioStream({ stop: false });
  desktopSystemAudioStreamRequest ??= acquireDesktopSystemAudioStream().finally(() => {
    desktopSystemAudioStreamRequest = null;
  });
  return desktopSystemAudioStreamRequest;
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
  desktopMeteringData = new Uint8Array(new ArrayBuffer(analyser.fftSize));

  stream.getTracks().forEach((track) => {
    track.addEventListener('ended', () => {
      if (desktopMeteringStream === stream) {
        stopDesktopMetering();
      }
    });
  });
  logTranscriptionDebug('[desktop-input] Desktop metering attached');
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
    const wantsAudio =
      normalizedConstraints.audio !== false &&
      Object.prototype.hasOwnProperty.call(normalizedConstraints, 'audio');
    if (preferredCaptureMode === 'system' && wantsAudio) {
      logTranscriptionDebug('[desktop-input] getDisplayMedia loopback override active');
      return getDesktopSystemAudioStream()
        .then((stream) => {
          attachDesktopMeteringStream(stream);
          return stream;
        })
        .catch((error) => {
          console.warn('[desktop-input] System audio getDisplayMedia failed', {
            reason: classifyDesktopCaptureError(error),
            name: getErrorName(error),
            message: getErrorMessage(error),
          });
          notifyDesktopCaptureFailed(error);
          return Promise.reject(error);
        });
    }
    const { nextConstraints, shouldFallback } = applyPreferredAudioInput(
      normalizedConstraints,
      preferredDesktopAudioInputId,
    );
    if (preferredDesktopAudioInputId) {
      logTranscriptionDebug('[desktop-input] getUserMedia override active', {
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
  logTranscriptionDebug('[desktop-input] Installed getUserMedia override');
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
  const recordingOptions = METERING_RECORDING_OPTIONS;
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

function encodeWavFromAudioBuffer(
  buffer: AudioBuffer,
  range?: { startMs?: number; endMs?: number },
): ArrayBuffer {
  const sampleRate = buffer.sampleRate;
  const sourceLength = buffer.length;
  const startMs = Math.max(0, range?.startMs ?? 0);
  const startFrame = Math.max(
    0,
    Math.min(sourceLength, Math.floor((startMs / 1000) * sampleRate))
  );
  const requestedEndFrame =
    typeof range?.endMs === 'number' && Number.isFinite(range.endMs)
      ? Math.ceil((Math.max(startMs, range.endMs) / 1000) * sampleRate)
      : sourceLength;
  const endFrame = Math.max(startFrame, Math.min(sourceLength, requestedEndFrame));
  const length = Math.max(0, endFrame - startFrame);
  const channelCount = buffer.numberOfChannels;
  const pcm = new Int16Array(length);
  const channels: Float32Array[] = [];
  for (let channel = 0; channel < channelCount; channel += 1) {
    channels.push(buffer.getChannelData(channel));
  }
  for (let index = 0; index < length; index += 1) {
    let mixed = 0;
    for (let channel = 0; channel < channelCount; channel += 1) {
      mixed += channels[channel][startFrame + index] ?? 0;
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

async function normalizeDesktopRecordingUri(
  fileUri: string,
  range?: { startOffsetMs?: number; endOffsetMs?: number },
): Promise<string | null> {
  if (!isWebRuntime || typeof fetch !== 'function') {
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
  logTranscriptionDebug('[transcription] Segment blob', { mimeType, size: blob.size });
  const shouldCrop =
    (range?.startOffsetMs ?? 0) > 0 ||
    (typeof range?.endOffsetMs === 'number' && Number.isFinite(range.endOffsetMs));
  const shouldNormalize =
    shouldCrop || mimeType.includes('webm') || mimeType.includes('ogg') || mimeType.includes('mp4');
  if (!shouldNormalize) {
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
    const wavBuffer = encodeWavFromAudioBuffer(audioBuffer, {
      startMs: range?.startOffsetMs,
      endMs: range?.endOffsetMs,
    });
    const wavBlob = new Blob([wavBuffer], { type: 'audio/wav' });
    const wavUri = URL.createObjectURL(wavBlob);
    logTranscriptionDebug('[transcription] Converted segment to WAV', { size: wavBlob.size });
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
  canRecord?: boolean;
  mediaServicesDidReset?: boolean;
}

function getRecorderStatusSafe(
  recorder: AudioRecorder,
  options: { warn?: boolean } = {},
): RecorderState | null {
  try {
    return recorder.getStatus();
  } catch (error) {
    if (options.warn !== false) {
      console.warn('[transcription] Recorder status unavailable', error);
    }
    return null;
  }
}

function getRecorderCurrentTimeMillisSafe(
  recorder: AudioRecorder,
  options: { warn?: boolean } = {},
): number | null {
  try {
    const currentTime = recorder.currentTime;
    if (typeof currentTime !== 'number' || !Number.isFinite(currentTime)) {
      return null;
    }
    return Math.max(0, currentTime * 1000);
  } catch (error) {
    if (options.warn !== false) {
      console.warn('[transcription] Recorder current time unavailable', error);
    }
    return null;
  }
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

function pcm16Base64ToMeteringDb(pcm16Base64: string): number | undefined {
  try {
    const bytes = toByteArray(pcm16Base64);
    if (bytes.length < 2) {
      return undefined;
    }
    const sampleCount = Math.floor(bytes.length / 2);
    let sum = 0;
    for (let index = 0; index < sampleCount; index += 1) {
      const byteOffset = index * 2;
      const raw = bytes[byteOffset] | (bytes[byteOffset + 1] << 8);
      const signed = raw & 0x8000 ? raw - 0x10000 : raw;
      const normalized = signed / 0x8000;
      sum += normalized * normalized;
    }
    const rms = Math.sqrt(sum / sampleCount);
    return rms > 0 ? 20 * Math.log10(rms) : -160;
  } catch (error) {
    return undefined;
  }
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

function createRecordingStatusFromRecorderStatus(
  recorderStatus: RecorderState,
  metering?: number,
): RecordingStatus {
  return {
    isRecording: recorderStatus.isRecording,
    durationMillis: recorderStatus.durationMillis,
    metering,
    isDoneRecording: false,
    canRecord: recorderStatus.canRecord,
    mediaServicesDidReset: recorderStatus.mediaServicesDidReset,
  };
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
    updatePreferredCaptureMode(settings.audioCaptureMode);
    logTranscriptionDebug('[desktop-input] Preferred device updated', {
      deviceId: settings.desktopAudioInputId ?? 'default',
      captureMode: settings.audioCaptureMode,
    });
  }, [settings.audioCaptureMode, settings.desktopAudioInputId]);

  useEffect(() => {
    if (!isElectronDesktop || typeof window === 'undefined') {
      return;
    }
    const handleCaptureFailed = (event: Event) => {
      const detail = (event as CustomEvent<{
        message?: unknown;
        reason?: unknown;
      }>).detail;
      const technicalMessage = typeof detail?.message === 'string' ? detail.message : 'unknown';
      setError(formatDesktopCaptureFailureMessage(t, new Error(technicalMessage), detail?.reason));
    };
    window.addEventListener('voicett-desktop-capture-failed', handleCaptureFailed);
    return () => {
      window.removeEventListener('voicett-desktop-capture-failed', handleCaptureFailed);
    };
  }, [t]);

  const [messages, setMessages] = useState<TranscriptionMessage[]>([]);
  const messagesRef = useLatestRef(messages);

  const [sessionState, setSessionState] = useState<SessionState>('idle');
  const sessionStateRef = useLatestRef(sessionState);
  const isSessionActive =
    sessionState === 'starting' || sessionState === 'recording' || sessionState === 'stopping';

  const [qaAutoMode, setQaAutoMode] = useState(false);
  const qaAutoModeRef = useLatestRef(qaAutoMode);

  const [error, setError] = useState<string | null>(null);
  const recorder = useAudioRecorder(METERING_RECORDING_OPTIONS);
  const isRecording = isSessionActive;

  const segmentStateRef = useRef<InternalSegmentState>({ ...initialSegmentState });
  const nextMessageIdRef = useRef(Math.max(Date.now(), 1));
  const nextSessionIdRef = useRef(1);
  const sessionIdRef = useRef<string | null>(null);
  const pendingTaskRegistryRef = useRef<Map<string, PendingTask>>(new Map());
  const segmentBaseMsRef = useRef(0);
  const desktopSegmentRecorderRef = useRef<MediaRecorder | null>(null);
  const desktopSegmentStreamRef = useRef<MediaStream | null>(null);
  const realtimeModeRef = useRef(false);
  const realtimeSessionRef = useRef<RealtimeTranscriptionSession | null>(null);
  const realtimeCaptureRef = useRef<PcmCapture | null>(null);
  const stopSessionRef = useRef<((options?: StopSessionOptions) => Promise<void>) | null>(null);
  const realtimeStreamRef = useRef<MediaStream | null>(null);
  const realtimeMeteringContextRef = useRef<AudioContext | null>(null);
  const realtimeMeteringAnalyserRef = useRef<AnalyserNode | null>(null);
  const realtimeMeteringDataRef = useRef<Uint8Array<ArrayBuffer> | null>(null);
  const realtimeNativeMeteringRef = useRef<number | undefined>(undefined);
  const realtimeStartedAtRef = useRef<number | null>(null);
  const realtimeItemMessageIdsRef = useRef<Map<string, number>>(new Map());
  const statusIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const meteringSourceRef = useRef<'recorder' | 'desktop' | 'none'>('none');
  const finalizeSegmentRef = useRef<((status: RecordingStatus | null, options?: { sessionId?: string }) => Promise<string | null>) | null>(null);
  const handleStatusUpdateRef = useRef<((status: RecordingStatus) => void) | null>(null);
  const meteringStaleSinceRef = useRef<number | null>(null);
  const lastRecorderStatusRef = useRef<RecorderState | null>(null);
  const recordingStartedAtRef = useRef<number | null>(null);
  const statusPollFailureCountRef = useRef(0);

  const setMessagesAndRef = useCallback((updater: (prev: TranscriptionMessage[]) => TranscriptionMessage[]) => {
    setMessages((prev) => {
      const next = updater(prev);
      messagesRef.current = next;
      return next;
    });
  }, [messagesRef]);

  const resetSegmentState = useCallback(() => {
    segmentStateRef.current = { ...initialSegmentState };
    meteringStaleSinceRef.current = null;
  }, []);

  const createSessionId = useCallback(() => 'session-' + nextSessionIdRef.current++, []);

  const allocateMessageId = useCallback(() => {
    const candidate = Math.max(Date.now(), nextMessageIdRef.current + 1);
    nextMessageIdRef.current = candidate;
    return candidate;
  }, []);

  const isTaskCurrent = useCallback((taskToken: string) => {
    return pendingTaskRegistryRef.current.has(taskToken);
  }, []);

  const cancelPendingTasks = useCallback((options?: {
    sessionId?: string;
    excludeTaskToken?: string | null;
    markMessagesFailed?: boolean;
    failureMessage?: string;
  }) => {
    const registry = pendingTaskRegistryRef.current;
    if (!registry.size) {
      return;
    }
    const failureMessage = options?.failureMessage || t('transcription.status.failed');
    const tokensToCancel: string[] = [];
    registry.forEach((task, token) => {
      if (options?.excludeTaskToken && token === options.excludeTaskToken) {
        return;
      }
      if (options?.sessionId && task.sessionId !== options.sessionId) {
        return;
      }
      tokensToCancel.push(token);
    });
    if (!tokensToCancel.length) {
      return;
    }
    if (options?.markMessagesFailed) {
      const affectedMessageIds = new Set(
        tokensToCancel
          .map((token) => registry.get(token)?.messageId)
          .filter((value): value is number => typeof value === 'number')
      );
      if (affectedMessageIds.size > 0) {
        setMessagesAndRef((prev) =>
          prev.map((msg) => {
            if (!affectedMessageIds.has(msg.id)) {
              return msg;
            }
            const nextMessage: TranscriptionMessage = {
              ...msg,
              updatedAt: Date.now(),
            };
            if (msg.status === 'pending' || msg.status === 'transcribing') {
              nextMessage.status = 'failed';
              nextMessage.error = failureMessage;
            }
            if (msg.translationStatus === 'pending') {
              nextMessage.translationStatus = 'failed';
              nextMessage.translationError = failureMessage;
            }
            return nextMessage;
          })
        );
      }
    }
    tokensToCancel.forEach((token) => {
      const task = registry.get(token);
      if (!task) {
        return;
      }
      task.transcriptionController?.abort();
      task.translationController?.abort();
      registry.delete(token);
    });
  }, [setMessagesAndRef, t]);

  const waitForPendingTasks = useCallback(async (sessionId: string, timeoutMs = 30000) => {
    const startedAt = Date.now();
    while (Date.now() - startedAt < timeoutMs) {
      const hasPending = Array.from(pendingTaskRegistryRef.current.values()).some(
        (task) => task.sessionId === sessionId
      );
      if (!hasPending) {
        return true;
      }
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    return false;
  }, []);

  const replaceMessages = useCallback((nextMessages: TranscriptionMessage[]) => {
    cancelPendingTasks();
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
    const highestSeen = normalized.reduce(
      (maxId, item) => (item.id > maxId ? item.id : maxId),
      nextMessageIdRef.current
    );
    nextMessageIdRef.current = Math.max(nextMessageIdRef.current, highestSeen);
    setMessagesAndRef(() => normalized);
  }, [cancelPendingTasks, messagesRef, setMessagesAndRef]);

  const updateMessage = useCallback((messageId: number, updater: (msg: TranscriptionMessage) => TranscriptionMessage) => {
    let didUpdate = false;
    setMessagesAndRef((prev) =>
      prev.map((msg) => {
        if (msg.id !== messageId) {
          return msg;
        }
        didUpdate = true;
        return updater(msg);
      })
    );
    return didUpdate;
  }, [setMessagesAndRef]);

  const resolveRealtimeMessageId = useCallback((itemId: string) => {
    const existing = realtimeItemMessageIdsRef.current.get(itemId);
    if (existing != null) {
      return existing;
    }
    const messageId = allocateMessageId();
    realtimeItemMessageIdsRef.current.set(itemId, messageId);
    const newMessage = createInitialMessage(messageId, qaAutoModeRef.current, t);
    newMessage.status = 'transcribing';
    if (settingsRef.current.enableTranslation && settingsRef.current.translationEngine !== 'none') {
      newMessage.translationStatus = 'idle';
    } else {
      newMessage.translationStatus = 'completed';
    }
    newMessage.segment = {
      fileUri: '',
      startOffsetMs: 0,
      endOffsetMs: 0,
      durationMs: 0,
      createdAt: Date.now(),
      engine: settingsRef.current.transcriptionEngine,
      model: resolveRealtimeTranscriptionModel(settingsRef.current),
    };
    setMessagesAndRef((prev) => prev.concat(newMessage));
    return messageId;
  }, [allocateMessageId, qaAutoModeRef, setMessagesAndRef, settingsRef, t]);

  const handleRealtimeDelta = useCallback((itemId: string, text: string) => {
    const messageId = resolveRealtimeMessageId(itemId);
    updateMessage(messageId, (msg) => ({
      ...msg,
      status: 'transcribing',
      transcript: (msg.transcript ?? '') + text,
      updatedAt: Date.now(),
    }));
  }, [resolveRealtimeMessageId, updateMessage]);

  const handleRealtimeCompleted = useCallback((itemId: string, transcript: string) => {
    const messageId = resolveRealtimeMessageId(itemId);
    const taskSessionId = sessionIdRef.current ?? 'orphan';
    const taskToken = taskSessionId + ':realtime:' + messageId;
    const normalizedTranscript = transcript.trim();
    const shouldTranslate =
      settingsRef.current.enableTranslation &&
      settingsRef.current.translationEngine !== 'none' &&
      normalizedTranscript.length > 0;

    updateMessage(messageId, (msg) => ({
      ...msg,
      status: normalizedTranscript ? 'completed' : 'failed',
      transcript: normalizedTranscript || msg.transcript,
      error: normalizedTranscript ? msg.error : t('transcription.errors.empty_recording'),
      translationStatus: shouldTranslate ? 'pending' : msg.translationStatus,
      updatedAt: Date.now(),
    }));

    if (!shouldTranslate) {
      return;
    }

    const translationController = new AbortController();
    pendingTaskRegistryRef.current.set(taskToken, {
      token: taskToken,
      sessionId: taskSessionId,
      messageId,
      transcriptionController: null,
      translationController,
    });

    translateTextStream(normalizedTranscript, settingsRef.current, {
      signal: translationController.signal,
      onDelta: (delta) => {
        if (!isTaskCurrent(taskToken)) {
          return;
        }
        updateMessage(messageId, (msg) => ({
          ...msg,
          translation: (msg.translation ?? '') + delta,
          translationStatus: 'pending',
          updatedAt: Date.now(),
        }));
      },
    })
      .then((result) => {
        if (!isTaskCurrent(taskToken)) {
          return;
        }
        const translated = result.text.trim();
        updateMessage(messageId, (msg) => ({
          ...msg,
          translation: translated || msg.translation,
          translationStatus: translated ? 'completed' : 'failed',
          translationError: translated ? undefined : t('translation.errors.empty_result'),
          updatedAt: Date.now(),
        }));
      })
      .catch((translateError: any) => {
        if (isTaskCurrent(taskToken)) {
          updateMessage(messageId, (msg) => ({
            ...msg,
            translationStatus: 'failed',
            translationError: translateError?.message || t('translation.status.failed'),
            updatedAt: Date.now(),
          }));
        }
      })
      .finally(() => {
        if (isTaskCurrent(taskToken)) {
          pendingTaskRegistryRef.current.delete(taskToken);
        }
      });
  }, [isTaskCurrent, resolveRealtimeMessageId, settingsRef, t, updateMessage]);

  const stopRealtimeResources = useCallback((options: { stopStream?: boolean } = {}) => {
    realtimeCaptureRef.current?.stop();
    realtimeCaptureRef.current = null;
    realtimeSessionRef.current?.close();
    realtimeSessionRef.current = null;
    if (options.stopStream !== false) {
      realtimeStreamRef.current?.getTracks().forEach((track) => track.stop());
      if (realtimeStreamRef.current === desktopSystemAudioStream) {
        clearDesktopSystemAudioStream({ stop: false });
      }
    }
    realtimeStreamRef.current = null;
    if (realtimeMeteringContextRef.current) {
      realtimeMeteringContextRef.current.close().catch(() => undefined);
    }
    realtimeMeteringContextRef.current = null;
    realtimeMeteringAnalyserRef.current = null;
    realtimeMeteringDataRef.current = null;
    realtimeNativeMeteringRef.current = undefined;
    realtimeStartedAtRef.current = null;
    realtimeItemMessageIdsRef.current.clear();
    realtimeModeRef.current = false;
  }, []);

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

  const retrySegment = useCallback(async (messageId: number) => {
    const message = messagesRef.current.find((item) => item.id === messageId);
    const segment = message?.segment;
    if (!message || !segment?.fileUri) {
      setError(t('transcription.errors.empty_recording'));
      return;
    }

    const taskToken = `retry:${messageId}:${Date.now()}`;
    const transcriptionController = new AbortController();
    pendingTaskRegistryRef.current.set(taskToken, {
      token: taskToken,
      sessionId: 'retry',
      messageId,
      transcriptionController,
      translationController: null,
    });

    updateMessage(messageId, (msg) => ({
      ...msg,
      status: 'transcribing',
      error: undefined,
      translationStatus:
        settingsRef.current.enableTranslation && settingsRef.current.translationEngine !== 'none'
          ? 'pending'
          : msg.translationStatus,
      translationError: undefined,
      updatedAt: Date.now(),
    }));

    const payload: TranscriptionSegmentPayload = {
      fileUri: segment.fileUri,
      startOffsetMs: segment.startOffsetMs,
      endOffsetMs: segment.endOffsetMs,
      durationMs: segment.durationMs,
      messageId,
    };

    try {
      const transcription = await transcribeSegment(
        payload,
        settingsRef.current,
        transcriptionController.signal
      );
      if (!isTaskCurrent(taskToken)) {
        return;
      }
      const activeTask = pendingTaskRegistryRef.current.get(taskToken);
      if (activeTask) {
        activeTask.transcriptionController = null;
      }

      const shouldTranslate =
        settingsRef.current.enableTranslation && settingsRef.current.translationEngine !== 'none';
      updateMessage(messageId, (msg) => ({
        ...msg,
        status: 'completed',
        transcript: transcription.text,
        language: transcription.language || msg.language,
        translationStatus: shouldTranslate ? 'pending' : msg.translationStatus,
        updatedAt: Date.now(),
      }));

      if (shouldTranslate && isTaskCurrent(taskToken)) {
        const translationController = new AbortController();
        const pendingTask = pendingTaskRegistryRef.current.get(taskToken);
        if (pendingTask) {
          pendingTask.translationController = translationController;
        }
        try {
          const translationResult = await withTimeout(
            translateText(transcription.text, settingsRef.current, translationController.signal),
            settingsRef.current.translationTimeoutSec * 1000,
            () => translationController.abort()
          );
          if (!isTaskCurrent(taskToken)) {
            return;
          }
          const trimmed = translationResult.text?.trim();
          updateMessage(messageId, (msg) => ({
            ...msg,
            translation: trimmed || msg.translation,
            translationStatus: trimmed ? 'completed' : 'failed',
            translationError: trimmed ? undefined : t('translation.errors.empty_result'),
            updatedAt: Date.now(),
          }));
        } catch (translateError: any) {
          if (isTaskCurrent(taskToken)) {
            updateMessage(messageId, (msg) => ({
              ...msg,
              translationStatus: 'failed',
              translationError: translateError?.message || t('translation.status.failed'),
              updatedAt: Date.now(),
            }));
          }
        }
      }
    } catch (retryError) {
      if (isTaskCurrent(taskToken)) {
        updateMessage(messageId, (msg) => ({
          ...msg,
          status: 'failed',
          error: retryError instanceof Error ? retryError.message : String(retryError),
          translationStatus: msg.translationStatus === 'pending' ? 'failed' : msg.translationStatus,
          translationError:
            msg.translationStatus === 'pending'
              ? retryError instanceof Error
                ? retryError.message
                : String(retryError)
              : msg.translationError,
          updatedAt: Date.now(),
        }));
      }
    } finally {
      if (isTaskCurrent(taskToken)) {
        pendingTaskRegistryRef.current.delete(taskToken);
      }
      cleanupRecordingFile(segment.fileUri);
    }
  }, [cleanupRecordingFile, isTaskCurrent, messagesRef, settingsRef, t, updateMessage]);

  const getBestKnownDurationMs = useCallback(() => {
    const durations: number[] = [];
    const statusDuration = lastRecorderStatusRef.current?.durationMillis;
    if (typeof statusDuration === 'number' && Number.isFinite(statusDuration)) {
      durations.push(statusDuration);
    }
    const currentTimeDuration = getRecorderCurrentTimeMillisSafe(recorder, { warn: false });
    if (currentTimeDuration != null) {
      durations.push(currentTimeDuration);
    }
    const startedAt = recordingStartedAtRef.current;
    if (startedAt != null) {
      durations.push(Date.now() - startedAt);
    }
    return Math.max(0, ...durations);
  }, [recorder]);

  const buildFallbackRecordingStatus = useCallback((): RecordingStatus => {
    const lastStatus = lastRecorderStatusRef.current;
    const fallbackMetering = isElectronDesktop ? readDesktopMeteringDb() : undefined;
    const metering =
      typeof lastStatus?.metering === 'number' && Number.isFinite(lastStatus.metering)
        ? lastStatus.metering
        : fallbackMetering;
    return {
      isRecording: true,
      durationMillis: getBestKnownDurationMs(),
      metering,
      isDoneRecording: false,
      canRecord: lastStatus?.canRecord ?? true,
      mediaServicesDidReset: lastStatus?.mediaServicesDidReset ?? false,
    };
  }, [getBestKnownDurationMs]);

  const readRealtimeMeteringDb = useCallback((): number | undefined => {
    const analyser = realtimeMeteringAnalyserRef.current;
    const data = realtimeMeteringDataRef.current;
    if (!analyser || !data) {
      return realtimeNativeMeteringRef.current;
    }
    analyser.getByteTimeDomainData(data);
    let sum = 0;
    for (let index = 0; index < data.length; index += 1) {
      const normalized = (data[index] - 128) / 128;
      sum += normalized * normalized;
    }
    const rms = Math.sqrt(sum / data.length);
    return rms > 0 ? 20 * Math.log10(rms) : -160;
  }, []);

  const attachRealtimeMeteringStream = useCallback((stream: MediaStream) => {
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
    realtimeMeteringContextRef.current = context;
    realtimeMeteringAnalyserRef.current = analyser;
    realtimeMeteringDataRef.current = new Uint8Array(new ArrayBuffer(analyser.fftSize));
  }, []);

  const startRealtimeStatusPolling = useCallback(() => {
    if (statusIntervalRef.current) {
      clearInterval(statusIntervalRef.current);
    }
    statusIntervalRef.current = setInterval(() => {
      if (!realtimeModeRef.current || sessionStateRef.current !== 'recording') {
        return;
      }
      const startedAt = realtimeStartedAtRef.current ?? Date.now();
      handleStatusUpdateRef.current?.({
        isRecording: true,
        durationMillis: Math.max(0, Date.now() - startedAt),
        metering: readRealtimeMeteringDb(),
        isDoneRecording: false,
        canRecord: true,
        mediaServicesDidReset: false,
      });
    }, 100);
  }, [readRealtimeMeteringDb, sessionStateRef]);

  const requestRealtimeMediaStream = useCallback(async (): Promise<MediaStream> => {
    if (isElectronDesktop && settingsRef.current.audioCaptureMode === 'system') {
      const stream = await getDesktopSystemAudioStream();
      attachDesktopMeteringStream(stream);
      return stream;
    }
    if (!navigator.mediaDevices?.getUserMedia) {
      throw new Error('getUserMedia unavailable');
    }
    return navigator.mediaDevices.getUserMedia({ audio: true });
  }, [settingsRef]);

  const startNewRecording = useCallback(async () => {
    logTranscriptionDebug('[transcription] startNewRecording - preparing to record');
    const useDesktopSystemRecording =
      isElectronDesktop && settingsRef.current.audioCaptureMode === 'system';
    if (useDesktopSystemRecording) {
      const stream = await getDesktopSystemAudioStream();
      attachDesktopMeteringStream(stream);
      desktopSegmentStreamRef.current = stream;
      if (desktopSegmentRecorderRef.current) {
        stopDesktopSegmentRecorder(desktopSegmentRecorderRef.current).catch((stopError) => {
          console.warn('[transcription] Failed to stop existing desktop segment recorder', stopError);
        });
      }
      const segmentRecorder = createDesktopSegmentRecorder(stream);
      if (!segmentRecorder) {
        throw new DesktopCaptureError(
          'unavailable',
          'Desktop system audio segment recorder is unavailable.'
        );
      }
      segmentRecorder.start();
      desktopSegmentRecorderRef.current = segmentRecorder;
      segmentBaseMsRef.current = 0;
      recordingStartedAtRef.current = Date.now();
      lastRecorderStatusRef.current = null;
      statusPollFailureCountRef.current = 0;
      meteringSourceRef.current = 'desktop';
      if (statusIntervalRef.current) {
        clearInterval(statusIntervalRef.current);
      }
      statusIntervalRef.current = setInterval(() => {
        if (sessionStateRef.current !== 'starting' && sessionStateRef.current !== 'recording') {
          if (statusIntervalRef.current) {
            clearInterval(statusIntervalRef.current);
            statusIntervalRef.current = null;
          }
          recordingStartedAtRef.current = null;
          return;
        }
        handleStatusUpdateRef.current?.(buildFallbackRecordingStatus());
      }, 100);
      logTranscriptionDebug('[transcription] Desktop system segment recorder started');
      return;
    }
    await recorder.prepareToRecordAsync();
    logTranscriptionDebug('[transcription] recorder prepared, starting record');
    recorder.record();
    logTranscriptionDebug('[transcription] record() called');
    segmentBaseMsRef.current = 0;
    recordingStartedAtRef.current = Date.now();
    lastRecorderStatusRef.current = null;
    statusPollFailureCountRef.current = 0;
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
          segmentRecorder.start();
          desktopSegmentRecorderRef.current = segmentRecorder;
          logTranscriptionDebug('[transcription] Desktop segment recorder started');
        } else {
          desktopSegmentRecorderRef.current = null;
        }
      } else {
        console.warn('[transcription] Desktop recording stream unavailable');
      }
    }

    if (statusIntervalRef.current) {
      clearInterval(statusIntervalRef.current);
    }
    statusIntervalRef.current = setInterval(() => {
      const recorderStatus = getRecorderStatusSafe(recorder, {
        warn: statusPollFailureCountRef.current === 0,
      });
      if (!recorderStatus) {
        statusPollFailureCountRef.current += 1;
        if (sessionStateRef.current === 'starting' || sessionStateRef.current === 'recording') {
          if (statusPollFailureCountRef.current === 1 || statusPollFailureCountRef.current % 20 === 0) {
            console.warn('[transcription] Recorder status unavailable during active session, using fallback status', {
              failures: statusPollFailureCountRef.current,
            });
          }
          handleStatusUpdateRef.current?.(buildFallbackRecordingStatus());
          return;
        }
        if (statusIntervalRef.current) {
          clearInterval(statusIntervalRef.current);
          statusIntervalRef.current = null;
        }
        recordingStartedAtRef.current = null;
        return;
      }
      statusPollFailureCountRef.current = 0;
      lastRecorderStatusRef.current = recorderStatus;
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
        logTranscriptionDebug('[transcription] Metering source', { source: nextSource });
        meteringSourceRef.current = nextSource;
      }
      const status = createRecordingStatusFromRecorderStatus(
        {
          ...recorderStatus,
          durationMillis: Math.max(recorderStatus.durationMillis ?? 0, getBestKnownDurationMs()),
        },
        metering
      );
      handleStatusUpdateRef.current?.(status);
    }, 100);
    logTranscriptionDebug('[transcription] status interval started');
  }, [buildFallbackRecordingStatus, getBestKnownDurationMs, recorder, sessionStateRef, settingsRef]);

  const stopAndResetRecording = useCallback(async () => {
    if (statusIntervalRef.current) {
      clearInterval(statusIntervalRef.current);
      statusIntervalRef.current = null;
    }
    const recorderStatus = getRecorderStatusSafe(recorder);
    if (!recorderStatus) {
      recordingStartedAtRef.current = null;
      statusPollFailureCountRef.current = 0;
      return;
    }
    lastRecorderStatusRef.current = recorderStatus;
    if (recorderStatus.isRecording) {
      try {
        await recorder.stop();
      } catch (stopError) {
        console.warn('[transcription] Failed to stop recording', stopError);
      }
    }
    recordingStartedAtRef.current = null;
    statusPollFailureCountRef.current = 0;
  }, [recorder]);

  const finalizeSegment = useCallback(async (status: RecordingStatus | null, options?: { sessionId?: string }) => {
    const snapshot = { ...segmentStateRef.current };
    if (snapshot.messageId == null) {
      return null;
    }
    resetSegmentState();
    const currentMessageId = snapshot.messageId;
    const taskSessionId = options?.sessionId ?? sessionIdRef.current;
    const recorderStatus = status ? null : getRecorderStatusSafe(recorder);
    if (recorderStatus) {
      lastRecorderStatusRef.current = recorderStatus;
    }
    const absoluteDurationMs =
      status?.durationMillis ?? recorderStatus?.durationMillis ?? getBestKnownDurationMs();
    const segmentBaseMs = segmentBaseMsRef.current;
    const endOffsetMs = Math.max(0, absoluteDurationMs - segmentBaseMs);
    const rawStartOffsetMs = (snapshot.confirmedStartMs ?? segmentBaseMs) - segmentBaseMs;
    const startOffsetMs = Math.max(0, Math.min(endOffsetMs, rawStartOffsetMs));
    const segmentDurationMs = Math.max(0, endOffsetMs - startOffsetMs);
    logTranscriptionDebug('[transcription] Finalizing segment', {
      messageId: currentMessageId,
      startOffsetMs,
      durationMs: segmentDurationMs,
      sessionId: taskSessionId ?? 'none',
    });
    const payload: TranscriptionSegmentPayload = {
      fileUri: '',
      startOffsetMs,
      endOffsetMs,
      durationMs: segmentDurationMs,
      messageId: currentMessageId,
    };
    let originalFileUri: string | null = null;
    let taskToken: string | null = null;
    try {
      const segmentMetadata: SegmentMetadata = {
        fileUri: '',
        startOffsetMs,
        endOffsetMs,
        durationMs: segmentDurationMs,
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
      let normalizedUri: string | null = null;
      const isDesktopSystemCaptureMode =
        isElectronDesktop && settingsRef.current.audioCaptureMode === 'system';
      let useDesktopSegmenter = isElectronDesktop && desktopSegmentRecorderRef.current !== null;
      if (isDesktopSystemCaptureMode && !useDesktopSegmenter) {
        throw new DesktopCaptureError(
          'unavailable',
          'Desktop system audio segment recorder is unavailable.'
        );
      }
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
          if (sessionStateRef.current === 'recording' && taskSessionId && sessionIdRef.current === taskSessionId) {
            const stream =
              desktopSegmentStreamRef.current ?? resolveDesktopRecordingStream(recorder);
            if (stream) {
              desktopSegmentStreamRef.current = stream;
              const nextRecorder = createDesktopSegmentRecorder(stream);
              if (nextRecorder) {
                nextRecorder.start();
                desktopSegmentRecorderRef.current = nextRecorder;
                logTranscriptionDebug('[transcription] Desktop segment recorder restarted');
              }
            } else {
              console.warn('[transcription] Desktop recording stream unavailable for restart');
            }
          }
        } catch (segmentError) {
          console.warn('[transcription] Desktop segment capture failed', segmentError);
          if (isDesktopSystemCaptureMode) {
            throw segmentError;
          }
          useDesktopSegmenter = false;
          normalizedUri = null;
          originalFileUri = null;
        }
      }

      if (!useDesktopSegmenter) {
        if (statusIntervalRef.current) {
          clearInterval(statusIntervalRef.current);
          statusIntervalRef.current = null;
        }
        try {
          await recorder.stop();
        } catch (stopError) {
          console.warn('[transcription] Failed to stop segment recorder', stopError);
        }
        let fileUri: string | null = null;
        try {
          fileUri = recorder.uri;
        } catch (uriError) {
          console.warn('[transcription] Failed to read segment recorder URI', uriError);
        }
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
        const maybeNormalized = await normalizeDesktopRecordingUri(normalizedUri, {
          startOffsetMs,
          endOffsetMs,
        });
        if (maybeNormalized) {
          normalizedUri = maybeNormalized;
        }
      } catch (normalizeError) {
        console.warn('[transcription] Failed to normalize audio segment', normalizeError);
      }
      payload.fileUri = normalizedUri;
      segmentMetadata.fileUri = normalizedUri;

      if (sessionStateRef.current === 'recording' && taskSessionId && sessionIdRef.current === taskSessionId && !useDesktopSegmenter) {
        try {
          await startNewRecording();
        } catch (restartError) {
          console.error('[transcription] Failed to restart recording', restartError);
          sessionIdRef.current = null;
          setQaAutoMode(false);
          setSessionState('failed');
          setError(
            t('transcription.errors.unable_to_start', {
              message: (restartError as Error).message,
            })
          );
        }
      }

      const didUpdateSegment = updateMessage(currentMessageId, (msg) => ({
        ...msg,
        status: 'transcribing',
        segment: segmentMetadata,
        updatedAt: Date.now(),
      }));
      if (!didUpdateSegment) {
        return null;
      }

      taskToken = (taskSessionId ?? 'orphan') + ':' + currentMessageId;
      pendingTaskRegistryRef.current.set(taskToken, {
        token: taskToken,
        sessionId: taskSessionId ?? 'orphan',
        messageId: currentMessageId,
        transcriptionController: new AbortController(),
        translationController: null,
      });
      const task = pendingTaskRegistryRef.current.get(taskToken);
      if (!task) {
        return null;
      }

      let transcription;
      try {
        transcription = await transcribeSegment(payload, settingsRef.current, task.transcriptionController?.signal);
      } catch (transcribeError) {
        console.warn('[transcription] Transcription failed', transcribeError);
        if (taskToken && isTaskCurrent(taskToken)) {
          updateMessage(currentMessageId, (msg) => ({
            ...msg,
            status: 'failed',
            error: (transcribeError as Error).message,
            updatedAt: Date.now(),
          }));
        }
        return taskToken;
      }
      if (!taskToken || !isTaskCurrent(taskToken)) {
        return taskToken;
      }
      const activeTask = pendingTaskRegistryRef.current.get(taskToken);
      if (activeTask) {
        activeTask.transcriptionController = null;
      }
      logTranscriptionDebug('[transcription] Transcription completed', {
        messageId: currentMessageId,
        length: transcription.text.length,
        language: transcription.language ?? 'auto',
      });

      const shouldTranslate =
        settingsRef.current.enableTranslation && settingsRef.current.translationEngine !== 'none';

      const didMarkCompleted = updateMessage(currentMessageId, (msg) => ({
        ...msg,
        status: 'completed',
        transcript: transcription.text,
        language: transcription.language || msg.language,
        translationStatus: shouldTranslate ? 'pending' : msg.translationStatus,
        updatedAt: Date.now(),
      }));
      if (!didMarkCompleted) {
        return taskToken;
      }

      if (shouldTranslate && taskToken && isTaskCurrent(taskToken)) {
        const translationController = new AbortController();
        const pendingTask = pendingTaskRegistryRef.current.get(taskToken);
        if (pendingTask) {
          pendingTask.translationController = translationController;
        }
        try {
          const translationResult = await withTimeout(
            translateText(transcription.text, settingsRef.current, translationController.signal),
            settingsRef.current.translationTimeoutSec * 1000,
            () => translationController.abort()
          );
          if (!isTaskCurrent(taskToken)) {
            return taskToken;
          }
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
          if (isTaskCurrent(taskToken)) {
            updateMessage(currentMessageId, (msg) => ({
              ...msg,
              translationStatus: 'failed',
              translationError: translateError?.message || t('translation.status.failed'),
              updatedAt: Date.now(),
            }));
          }
        }
      }
      return taskToken;
    } catch (segmentError) {
      if (taskToken && !isTaskCurrent(taskToken)) {
        return taskToken;
      }
      if (isElectronDesktop && settingsRef.current.audioCaptureMode === 'system') {
        sessionIdRef.current = null;
        setQaAutoMode(false);
        setSessionState('failed');
        setError(formatDesktopCaptureFailureMessage(t, segmentError));
        clearDesktopSystemAudioStream();
      }
      updateMessage(currentMessageId, (msg) => ({
        ...msg,
        status: 'failed',
        error: (segmentError as Error).message,
        translationStatus: msg.translationStatus === 'pending' ? 'failed' : msg.translationStatus,
        translationError:
          msg.translationStatus === 'pending' ? (segmentError as Error).message : msg.translationError,
        updatedAt: Date.now(),
      }));
      return taskToken;
    } finally {
      if (taskToken && isTaskCurrent(taskToken)) {
        pendingTaskRegistryRef.current.delete(taskToken);
      }
      const shouldCleanupAudio = !taskToken || isTaskCurrent(taskToken);
      if (shouldCleanupAudio && payload.fileUri) {
        cleanupRecordingFile(payload.fileUri);
      }
      if (shouldCleanupAudio && originalFileUri && originalFileUri !== payload.fileUri) {
        cleanupRecordingFile(originalFileUri);
      }
    }
  }, [cleanupRecordingFile, getBestKnownDurationMs, isTaskCurrent, recorder, resetSegmentState, settingsRef, startNewRecording, t, updateMessage]);

  useEffect(() => {
    finalizeSegmentRef.current = finalizeSegment;
  }, [finalizeSegment]);

  const startSession = useCallback(async (options?: SessionToggleOptions) => {
    logTranscriptionDebug('[transcription] startSession called');
    if (sessionStateRef.current === 'starting' || sessionStateRef.current === 'recording' || sessionStateRef.current === 'stopping') {
      logTranscriptionDebug('[transcription] session already active, returning');
      return;
    }
    const nextSessionId = createSessionId();
    sessionIdRef.current = nextSessionId;
    resetSegmentState();
    setError(null);
    setQaAutoMode(options?.qaAutoEnabled ?? false);
    setSessionState('starting');
    try {
      const effectiveMode = resolveEffectiveTranscriptionMode(settingsRef.current);
      if (effectiveMode === 'realtime') {
        try {
          const stream = Platform.OS === 'web' ? await requestRealtimeMediaStream() : null;
          realtimeModeRef.current = true;
          realtimeStreamRef.current = stream;
          realtimeStartedAtRef.current = Date.now();
          if (stream) {
            attachRealtimeMeteringStream(stream);
          }
          const realtimeSession = new RealtimeTranscriptionSession(settingsRef.current, {
            onDelta: handleRealtimeDelta,
            onCompleted: handleRealtimeCompleted,
            onError: (sessionError) => {
              console.warn('[transcription] Realtime session error', sessionError);
              setError(sessionError.message);
            },
            onOpen: () => undefined,
            onClose: () => undefined,
          });
          realtimeSessionRef.current = realtimeSession;
          await realtimeSession.connect();
          realtimeCaptureRef.current = createPcmCapture(
            stream,
            (chunk) => {
              if (Platform.OS !== 'web') {
                realtimeNativeMeteringRef.current = pcm16Base64ToMeteringDb(chunk);
              }
              realtimeSessionRef.current?.appendAudio(chunk);
            },
            (captureError) => {
              void stopSessionRef.current?.({
                discardCurrentSegment: true,
                cancelPendingTasks: true,
                failureMessage: captureError.message,
              });
            }
          );
          await realtimeCaptureRef.current.ready;
          if (sessionIdRef.current !== nextSessionId) {
            stopRealtimeResources();
            return;
          }
          setSessionState('recording');
          startRealtimeStatusPolling();
          logTranscriptionDebug('[transcription] realtime recording started successfully');
          return;
        } catch (realtimeStartError) {
          console.warn('[transcription] Realtime startup failed; falling back to upload mode', realtimeStartError);
          const isDesktopSystemCaptureMode =
            isElectronDesktop && settingsRef.current.audioCaptureMode === 'system';
          const canReuseSystemStream =
            isDesktopSystemCaptureMode && isLiveAudioStream(desktopSystemAudioStream);
          stopRealtimeResources({ stopStream: !canReuseSystemStream });
          if (sessionIdRef.current !== nextSessionId) {
            return;
          }
          if (isDesktopSystemCaptureMode && !canReuseSystemStream) {
            notifyDesktopCaptureFailed(realtimeStartError);
            throw realtimeStartError;
          }
          const message =
            realtimeStartError instanceof Error
              ? realtimeStartError.message
              : String(realtimeStartError);
          setError(t('transcription.errors.realtime_upload_fallback', { message }));
        }
      }

      const shouldRequestMicrophonePermission =
        !isElectronDesktop || settingsRef.current.audioCaptureMode !== 'system';
      if (shouldRequestMicrophonePermission) {
        let permission = await getRecordingPermissionsAsync();
        if (!permission.granted) {
          permission = await requestRecordingPermissionsAsync();
          if (!permission.granted) {
            Alert.alert(t('alerts.microphone_permission.title'), t('alerts.microphone_permission.message'));
            throw new Error(t('transcription.errors.permission_denied'));
          }
        }
      }
      await setAudioModeAsync({
        allowsRecording: true,
        playsInSilentMode: true,
        shouldPlayInBackground: true,
        interruptionModeAndroid: 'duckOthers',
      });
      await startNewRecording();
      if (sessionIdRef.current !== nextSessionId) {
        await stopAndResetRecording();
        return;
      }
      setSessionState('recording');
      logTranscriptionDebug('[transcription] recording started successfully');
      } catch (startError) {
        console.error('[transcription] Failed to start session', startError);
        if (sessionIdRef.current === nextSessionId) {
          sessionIdRef.current = null;
        }
        setQaAutoMode(false);
        stopRealtimeResources();
        if (desktopSegmentRecorderRef.current) {
          const segmentRecorder = desktopSegmentRecorderRef.current;
          desktopSegmentRecorderRef.current = null;
          await stopDesktopSegmentRecorder(segmentRecorder).catch((stopError) => {
            console.warn('[transcription] Failed to stop desktop segment recorder after start failure', stopError);
          });
        }
        await stopAndResetRecording();
        resetSegmentState();
        desktopSegmentStreamRef.current = null;
        clearDesktopSystemAudioStream();
        setSessionState('failed');
        setError(
          isElectronDesktop &&
            settingsRef.current.audioCaptureMode === 'system' &&
            startError instanceof DesktopCaptureError
            ? formatDesktopCaptureFailureMessage(t, startError)
            : startError instanceof Error && startError.message === t('transcription.errors.permission_denied')
            ? startError.message
            : t('transcription.errors.start_failed', { message: (startError as Error).message })
        );
      }
  }, [
    attachRealtimeMeteringStream,
    createSessionId,
    handleRealtimeCompleted,
    handleRealtimeDelta,
    requestRealtimeMediaStream,
    resetSegmentState,
    sessionStateRef,
    settingsRef,
    startNewRecording,
    startRealtimeStatusPolling,
    stopAndResetRecording,
    stopRealtimeResources,
    t,
  ]);

  const stopSession = useCallback(async (options?: StopSessionOptions) => {
    const currentSessionId = sessionIdRef.current;
    const currentState = sessionStateRef.current;
    const shouldHandle =
      currentSessionId != null || currentState === 'starting' || currentState === 'recording' || currentState === 'stopping';
    if (!shouldHandle) {
      return;
    }

    const failureMessage = options?.failureMessage || t('transcription.status.failed');
    const shouldCancelPendingTasks = options?.cancelPendingTasks !== false;
    const shouldDiscardCurrentSegment = options?.discardCurrentSegment === true;
    const activeMessageId = segmentStateRef.current.messageId;
    const hasActiveSegment = segmentStateRef.current.isActive && activeMessageId != null;
    const wasRealtimeMode = realtimeModeRef.current;

    setQaAutoMode(false);
    sessionIdRef.current = null;
    if (currentState !== 'failed') {
      setSessionState('stopping');
    }

    if (statusIntervalRef.current) {
      clearInterval(statusIntervalRef.current);
      statusIntervalRef.current = null;
    }

    if (shouldDiscardCurrentSegment && activeMessageId != null) {
      updateMessage(activeMessageId, (msg) => ({
        ...msg,
        status: 'failed',
        error: failureMessage,
        updatedAt: Date.now(),
      }));
    }

    if (currentSessionId && shouldCancelPendingTasks) {
      cancelPendingTasks({
        sessionId: currentSessionId,
        markMessagesFailed: true,
        failureMessage,
      });
    }

    if (wasRealtimeMode) {
      if (!shouldDiscardCurrentSegment && segmentStateRef.current.isActive) {
        realtimeSessionRef.current?.commit();
        // Best-effort grace period for the Realtime API to flush the final committed item.
        await new Promise((resolve) => setTimeout(resolve, 2000));
      }
      stopRealtimeResources();
      if (currentSessionId && shouldCancelPendingTasks) {
        cancelPendingTasks({
          sessionId: currentSessionId,
          markMessagesFailed: false,
          failureMessage,
        });
      }
      resetSegmentState();
      if (options?.failureMessage) {
        setSessionState('failed');
        setError(options.failureMessage);
        return;
      }
      setSessionState('idle');
      return;
    }

    if (!shouldDiscardCurrentSegment && hasActiveSegment && finalizeSegmentRef.current) {
      try {
        await finalizeSegmentRef.current(null, { sessionId: currentSessionId ?? undefined });
      } catch (finalizeError) {
        console.warn('[transcription] Failed to finalize active segment on stop', finalizeError);
      }
    }

    if ((shouldDiscardCurrentSegment || !hasActiveSegment) && desktopSegmentRecorderRef.current) {
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
    clearDesktopSystemAudioStream();

    if (currentSessionId && !shouldCancelPendingTasks) {
      const drained = await waitForPendingTasks(currentSessionId);
      if (!drained) {
        cancelPendingTasks({
          sessionId: currentSessionId,
          markMessagesFailed: true,
          failureMessage,
        });
      }
    }

    if (options?.failureMessage) {
      setSessionState('failed');
      setError(options.failureMessage);
      return;
    }
    setSessionState('idle');
  }, [cancelPendingTasks, resetSegmentState, sessionStateRef, stopAndResetRecording, stopRealtimeResources, t, updateMessage, waitForPendingTasks]);

  useEffect(() => {
    stopSessionRef.current = stopSession;
  }, [stopSession]);

  const toggleSession = useCallback(async (options?: SessionToggleOptions) => {
    logTranscriptionDebug('[transcription] toggleSession called, state:', sessionStateRef.current);
    if (sessionStateRef.current === 'starting' || sessionStateRef.current === 'stopping') {
      return;
    }
    if (sessionStateRef.current === 'recording') {
      await stopSession({ cancelPendingTasks: false });
    } else {
      await startSession(options);
    }
  }, [sessionStateRef, startSession, stopSession]);
  const handleStatusUpdate = useCallback((status: RecordingStatus) => {
    if (sessionStateRef.current !== 'recording') {
      return;
    }
    if (status.mediaServicesDidReset) {
      void stopSession({
        discardCurrentSegment: true,
        cancelPendingTasks: true,
        failureMessage: t('transcription.errors.start_failed', { message: 'mediaServicesDidReset' }),
      });
      return;
    }
    const durationMs = status.durationMillis ?? 0;
    if (!status.isRecording && !status.isDoneRecording && durationMs <= 0) {
      logTranscriptionDebug('[transcription] handleStatusUpdate - skipping (not recording and duration=0)');
      return;
    }
    logTranscriptionDebug('[transcription] handleStatusUpdate - duration:', durationMs, 'metering:', status.metering);
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
    const shouldForceActivation =
      normalizedMetering === undefined &&
      meteringUnavailableMs >= Math.max(activationDurationMs, METERING_UNAVAILABLE_ACTIVATION_MS);
    const rms = shouldForceActivation ? threshold + 0.05 : meteringToRms(normalizedMetering);

    logTranscriptionDebug('[transcription] rms:', rms, 'threshold:', threshold, 'segment.isActive:', segment.isActive);

    if (!segment.isActive) {
      if (shouldForceActivation || rms >= threshold) {
        if (segment.candidateStartMs == null) {
          segment.candidateStartMs = durationMs;
          logTranscriptionDebug('[transcription] candidate start set at:', durationMs);
        }
        const elapsedAbove = durationMs - (segment.candidateStartMs ?? durationMs);
        logTranscriptionDebug('[transcription] elapsed above threshold:', elapsedAbove, 'need:', activationDurationMs);
        if (elapsedAbove >= activationDurationMs) {
          logTranscriptionDebug('[transcription] ACTIVATING SEGMENT');
          segment.isActive = true;
          if (realtimeModeRef.current) {
            segment.messageId = null;
            applySettingsToSegment(segment, currentSettings, durationMs);
            return;
          }
          const messageId = allocateMessageId();
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
      return;
    }

    const isBelowThreshold = normalizedMetering === undefined ? false : rms < threshold;
    if (isBelowThreshold) {
      if (segment.belowThresholdStartMs == null) {
        segment.belowThresholdStartMs = durationMs;
      }
      const silenceElapsed = durationMs - (segment.belowThresholdStartMs ?? durationMs);
      if (silenceElapsed >= currentSettings.silenceDurationSec * 1000) {
        if (realtimeModeRef.current) {
          realtimeSessionRef.current?.commit();
          resetSegmentState();
        } else {
          void finalizeSegmentRef.current?.(status);
        }
      }
    } else {
      segment.belowThresholdStartMs = null;
    }

    const startMs = segment.confirmedStartMs ?? 0;
    const segmentElapsed = durationMs - startMs;
    const configuredMaxSegmentMs =
      currentSettings.maxSegmentDurationSec > 0
        ? currentSettings.maxSegmentDurationSec * 1000
        : Number.POSITIVE_INFINITY;
    const effectiveMaxSegmentMs =
      normalizedMetering === undefined
        ? Math.min(configuredMaxSegmentMs, METERING_UNAVAILABLE_MAX_SEGMENT_MS)
        : configuredMaxSegmentMs;
    if (Number.isFinite(effectiveMaxSegmentMs) && segmentElapsed >= effectiveMaxSegmentMs) {
      if (realtimeModeRef.current) {
        realtimeSessionRef.current?.commit();
        resetSegmentState();
      } else {
        void finalizeSegmentRef.current?.(status);
      }
    }
  }, [allocateMessageId, qaAutoModeRef, resetSegmentState, sessionStateRef, setMessagesAndRef, settingsRef, stopSession, t]);

  useEffect(() => {
    handleStatusUpdateRef.current = handleStatusUpdate;
  }, [handleStatusUpdate]);

  useEffect(() => {
    return () => {
      cancelPendingTasks({ markMessagesFailed: false });
      if (statusIntervalRef.current) {
        clearInterval(statusIntervalRef.current);
      }
      if (desktopSegmentRecorderRef.current) {
        const segmentRecorder = desktopSegmentRecorderRef.current;
        desktopSegmentRecorderRef.current = null;
        stopDesktopSegmentRecorder(segmentRecorder).catch(() => undefined);
      }
      stopRealtimeResources();
      stopDesktopMetering();
      stopAndResetRecording();
      desktopSegmentStreamRef.current = null;
      clearDesktopSystemAudioStream();
    };
  }, [cancelPendingTasks, stopAndResetRecording, stopRealtimeResources]);

  const value = useMemo<TranscriptionContextValue>(() => ({
    messages,
    isSessionActive,
    toggleSession,
    stopSession,
    replaceMessages,
    updateMessageQa,
    retrySegment,
    isRecording,
    sessionState,
    error,
    clearError: () => {
      setError(null);
      if (sessionStateRef.current === 'failed') {
        setSessionState('idle');
      }
    },
  }), [messages, isSessionActive, toggleSession, stopSession, replaceMessages, updateMessageQa, retrySegment, isRecording, sessionState, error, sessionStateRef]);
  return <TranscriptionContext.Provider value={value}>{children}</TranscriptionContext.Provider>;
}

export function useTranscription() {
  const context = useContext(TranscriptionContext);
  if (!context) {
    throw new Error('useTranscription must be used within TranscriptionProvider');
  }
  return context;
}
