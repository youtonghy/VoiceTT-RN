import {
  useAudioRecorder,
  useAudioRecorderState,
  RecordingOptions,
  setAudioModeAsync,
  requestRecordingPermissionsAsync,
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
import { Alert } from 'react-native';
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
    android: {
      extension: '.m4a',
      outputFormat: 'mpeg4',
      audioEncoder: 'aac',
      sampleRate: 44100,
      numberOfChannels: 1,
      bitRate: 128000,
      audioSource: 'voice_recognition',
    },
    ios: {
      extension: '.m4a',
      audioQuality: 96, // HIGH
      sampleRate: 44100,
      numberOfChannels: 1,
      bitRate: 128000,
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

  const segmentStateRef = useRef<InternalSegmentState>({ ...initialSegmentState });
  const nextMessageIdRef = useRef(1);
  const statusIntervalRef = useRef<NodeJS.Timeout | null>(null);
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
    const startOffsetMs = snapshot.confirmedStartMs ?? 0;
    const durationMs = status?.durationMillis ?? recorder.currentTime * 1000;
    const payload: TranscriptionSegmentPayload = {
      fileUri: '',
      startOffsetMs,
      endOffsetMs: durationMs,
      durationMs,
      messageId: currentMessageId,
    };
    try {
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
      payload.fileUri = fileUri;

      if (sessionActiveRef.current) {
        startNewRecording().catch((restartError) => {
          console.error('[transcription] Failed to restart recording', restartError);
        });
      }

      const segmentMetadata: SegmentMetadata = {
        fileUri,
        startOffsetMs,
        endOffsetMs: durationMs,
        durationMs,
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
        updateMessage(currentMessageId, (msg) => ({
          ...msg,
          status: 'failed',
          error: (transcribeError as Error).message,
          updatedAt: Date.now(),
        }));
        return;
      }

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
    }
  }, [cleanupRecordingFile, recorder, resetSegmentState, sessionActiveRef, settingsRef, t, updateMessage]);

  // Update the ref when finalizeSegment changes
  useEffect(() => {
    finalizeSegmentRef.current = finalizeSegment;
  }, [finalizeSegment]);

  const startNewRecording = useCallback(async () => {
    try {
      await recorder.prepareToRecordAsync();
      recorder.record();

      // Poll recording status periodically for metering and duration
      if (statusIntervalRef.current) {
        clearInterval(statusIntervalRef.current);
      }
      statusIntervalRef.current = setInterval(() => {
        const recorderStatus = recorder.getStatus();
        const status: RecordingStatus = {
          isRecording: recorderStatus.isRecording,
          durationMillis: recorderStatus.durationMillis,
          metering: recorderStatus.metering,
          isDoneRecording: false,
        };
        handleStatusUpdateRef.current?.(status);
      }, 100);
    } catch (startError) {
      console.error('[transcription] Failed to start recording', startError);
      setError(t('transcription.errors.unable_to_start', { message: (startError as Error).message }));
    }
  }, [recorder, t]);

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
    if (sessionActiveRef.current) {
      return;
    }
    try {
      const permission = await requestRecordingPermissionsAsync();
      if (!permission.granted) {
        Alert.alert(t('alerts.microphone_permission.title'), t('alerts.microphone_permission.message'));
        setError(t('transcription.errors.permission_denied'));
        return;
      }
      await setAudioModeAsync({
        allowsRecording: true,
        playsInSilentMode: true,
        shouldPlayInBackground: true,
        interruptionModeAndroid: 'duckOthers',
      });
      resetSegmentState();
      setQaAutoMode(options?.qaAutoEnabled ?? false);
      setIsSessionActive(true);
      await startNewRecording();
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
    await stopAndResetRecording();
    resetSegmentState();
  }, [resetSegmentState, sessionActiveRef, stopAndResetRecording]);

  const toggleSession = useCallback(async (options?: SessionToggleOptions) => {
    if (sessionActiveRef.current) {
      await stopSession();
    } else {
      await startSession(options);
    }
  }, [sessionActiveRef, startSession, stopSession]);

  const handleStatusUpdate = useCallback((status: RecordingStatus) => {
    const durationMs = status.durationMillis ?? 0;
    if (!status.isRecording && !status.isDoneRecording && durationMs <= 0) {
      return;
    }
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

    if (!segment.isActive) {
      if (shouldForceActivation || rms >= threshold) {
        if (segment.candidateStartMs == null) {
          segment.candidateStartMs = durationMs;
        }
        const elapsedAbove = durationMs - (segment.candidateStartMs ?? durationMs);
        if (elapsedAbove >= activationDurationMs) {
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
      stopAndResetRecording();
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
