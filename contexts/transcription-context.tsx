import {
  Audio,
  InterruptionModeAndroid,
  InterruptionModeIOS,
  type RecordingStatus,
} from 'expo-av';
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

import { useSettings } from '@/contexts/settings-context';
import { transcribeSegment, translateText, type TranscriptionSegmentPayload } from '@/services/transcription';
import { AppSettings } from '@/types/settings';
import {
  TranscriptionMessage,
  SegmentMetadata,
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

interface TranscriptionContextValue {
  messages: TranscriptionMessage[];
  isSessionActive: boolean;
  toggleSession: () => Promise<void>;
  stopSession: () => Promise<void>;
  isRecording: boolean;
  error: string | null;
  clearError: () => void;
}

const TranscriptionContext = createContext<TranscriptionContextValue | undefined>(undefined);

function meteringToRms(value: number | undefined): number {
  if (typeof value !== 'number') {
    return 0;
  }
  if (value <= -160) {
    return 0;
  }
  return Math.pow(10, value / 20);
}

function buildRecordingOptions(): Audio.RecordingOptions {
  return {
    isMeteringEnabled: true,
    android: {
      extension: '.m4a',
      outputFormat: Audio.AndroidOutputFormat.MPEG_4,
      audioEncoder: Audio.AndroidAudioEncoder.AAC,
      sampleRate: 44100,
      numberOfChannels: 1,
      bitRate: 128000,
    },
    ios: {
      extension: '.m4a',
      audioQuality: Audio.IOSAudioQuality.HIGH,
      sampleRate: 44100,
      numberOfChannels: 1,
      bitRate: 128000,
      outputFormat: Audio.IOSOutputFormat.MPEG4AAC,
    },
    web: {
      mimeType: 'audio/webm',
      bitsPerSecond: 128000,
    },
  } as Audio.RecordingOptions;
}

function useLatestRef<T>(value: T) {
  const ref = useRef(value);
  useEffect(() => {
    ref.current = value;
  }, [value]);
  return ref;
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

function createInitialMessage(messageId: number): TranscriptionMessage {
  const timestamp = Date.now();
  return {
    id: messageId,
    title: '消息 #' + messageId,
    status: 'pending',
    translationStatus: 'idle',
    createdAt: timestamp,
    updatedAt: timestamp,
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
  const { settings } = useSettings();
  const settingsRef = useLatestRef(settings);

  const [messages, setMessages] = useState<TranscriptionMessage[]>([]);
  const messagesRef = useLatestRef(messages);

  const [isSessionActive, setIsSessionActive] = useState(false);
  const sessionActiveRef = useLatestRef(isSessionActive);

  const [isRecording, setIsRecording] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const recordingRef = useRef<Audio.Recording | null>(null);
  const segmentStateRef = useRef<InternalSegmentState>({ ...initialSegmentState });
  const nextMessageIdRef = useRef(1);
  const translationQueueRef = useRef<number[]>([]);
  const translationBusyRef = useRef(false);
  const lastStatusRef = useRef<RecordingStatus | null>(null);

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

  const updateMessage = useCallback((messageId: number, updater: (msg: TranscriptionMessage) => TranscriptionMessage) => {
    setMessagesAndRef((prev) => prev.map((msg) => (msg.id === messageId ? updater(msg) : msg)));
  }, [setMessagesAndRef]);

  const enqueueTranslation = useCallback((messageId: number) => {
    translationQueueRef.current.push(messageId);
  }, []);

  const processTranslationQueue = useCallback(async () => {
    if (translationBusyRef.current) {
      return;
    }
    translationBusyRef.current = true;
    try {
      while (translationQueueRef.current.length > 0) {
        const messageId = translationQueueRef.current.shift();
        if (typeof messageId !== 'number') {
          continue;
        }
        const currentMessages = messagesRef.current;
        const target = currentMessages.find((item) => item.id === messageId);
        if (!target) {
          continue;
        }
        if (!target.transcript) {
          continue;
        }
        const currentSettings = settingsRef.current;
        if (!currentSettings.enableTranslation || currentSettings.translationEngine === 'none') {
          continue;
        }
        updateMessage(messageId, (msg) => ({
          ...msg,
          translationStatus: 'pending',
          updatedAt: Date.now(),
        }));
        const abortController = new AbortController();
        try {
          const translatePromise = translateText(target.transcript, currentSettings, abortController.signal);
          const result = await withTimeout(
            translatePromise,
            currentSettings.translationTimeoutSec * 1000,
            () => abortController.abort()
          );
          updateMessage(messageId, (msg) => ({
            ...msg,
            translation: result.text,
            translationStatus: 'completed',
            updatedAt: Date.now(),
          }));
        } catch (translateError: any) {
          updateMessage(messageId, (msg) => ({
            ...msg,
            translationStatus: 'failed',
            translationError: translateError?.message || 'Translation failed',
            updatedAt: Date.now(),
          }));
        }
      }
    } finally {
      translationBusyRef.current = false;
    }
  }, [messagesRef, settingsRef, updateMessage]);

  useEffect(() => {
    if (!translationBusyRef.current && translationQueueRef.current.length > 0) {
      processTranslationQueue();
    }
  }, [messages, processTranslationQueue]);

  const cleanupRecordingFile = useCallback(async (fileUri: string | null | undefined) => {
    if (fileUri) {
      try {
        await deleteAsync(fileUri, { idempotent: true });
      } catch (cleanupError) {
        console.warn('[transcription] Failed to clean recording file', cleanupError);
      }
    }
  }, []);

  const startNewRecording = useCallback(async () => {
    const recording = new Audio.Recording();
    try {
      await recording.prepareToRecordAsync(buildRecordingOptions());
      recording.setProgressUpdateInterval(100);
      recording.setOnRecordingStatusUpdate((status) => {
        lastStatusRef.current = status;
        handleStatusUpdate(status);
      });
      await recording.startAsync();
      recordingRef.current = recording;
      setIsRecording(true);
    } catch (startError) {
      recordingRef.current = null;
      setIsRecording(false);
      console.error('[transcription] Failed to start recording', startError);
      setError('无法启动录音: ' + (startError as Error).message);
    }
  }, []);

  const stopAndResetRecording = useCallback(async () => {
    const recording = recordingRef.current;
    if (!recording) {
      return;
    }
    recordingRef.current = null;
    try {
      recording.setOnRecordingStatusUpdate(undefined);
      await recording.stopAndUnloadAsync();
    } catch (stopError) {
      console.warn('[transcription] Failed to stop recording', stopError);
    } finally {
      setIsRecording(false);
    }
  }, []);

  const startSession = useCallback(async () => {
    if (sessionActiveRef.current) {
      return;
    }
    try {
      const permission = await Audio.requestPermissionsAsync();
      if (!permission.granted) {
        Alert.alert('需要麦克风权限', '请在系统设置中授予麦克风权限以继续录音');
        setError('麦克风权限未授权');
        return;
      }
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        interruptionModeIOS: InterruptionModeIOS.DoNotMix,
        playsInSilentModeIOS: true,
        staysActiveInBackground: false,
        interruptionModeAndroid: InterruptionModeAndroid.DoNotMix,
        shouldDuckAndroid: false,
      });
      resetSegmentState();
      setIsSessionActive(true);
      startNewRecording();
    } catch (startError) {
      console.error('[transcription] Failed to start session', startError);
      setError('启动录音失败: ' + (startError as Error).message);
      setIsSessionActive(false);
    }
  }, [resetSegmentState, sessionActiveRef, startNewRecording]);

  const stopSession = useCallback(async () => {
    if (!sessionActiveRef.current) {
      return;
    }
    setIsSessionActive(false);
    await stopAndResetRecording();
    resetSegmentState();
  }, [resetSegmentState, sessionActiveRef, stopAndResetRecording]);

  const toggleSession = useCallback(async () => {
    if (sessionActiveRef.current) {
      await stopSession();
    } else {
      await startSession();
    }
  }, [sessionActiveRef, startSession, stopSession]);

  const finalizeSegment = useCallback(async (status: RecordingStatus | null) => {
    const recording = recordingRef.current;
    if (!recording) {
      return;
    }
    const snapshot = { ...segmentStateRef.current };
    if (snapshot.messageId == null) {
      return;
    }
    segmentStateRef.current = { ...initialSegmentState };
    const currentMessageId = snapshot.messageId;
    const startOffsetMs = snapshot.confirmedStartMs ?? 0;
    const durationMs = status?.durationMillis ?? lastStatusRef.current?.durationMillis ?? 0;
    const payload: TranscriptionSegmentPayload = {
      fileUri: '',
      startOffsetMs,
      endOffsetMs: durationMs,
      durationMs,
      messageId: currentMessageId,
    };
    try {
      recording.setOnRecordingStatusUpdate(undefined);
      await recording.stopAndUnloadAsync();
      const fileUri = recording.getURI();
      if (!fileUri) {
        throw new Error('录音结果为空');
      }
      payload.fileUri = fileUri;
      recordingRef.current = null;
      setIsRecording(false);
      const segmentMetadata: SegmentMetadata = {
        fileUri,
        startOffsetMs,
        endOffsetMs: durationMs,
        durationMs,
        createdAt: Date.now(),
        engine: settingsRef.current.transcriptionEngine,
        model: settingsRef.current.transcriptionModel,
      };
      updateMessage(currentMessageId, (msg) => ({
        ...msg,
        status: 'transcribing',
        segment: segmentMetadata,
        updatedAt: Date.now(),
      }));

      const abortController = new AbortController();
      transcribeSegment(payload, settingsRef.current, abortController.signal)
        .then((result) => {
          updateMessage(currentMessageId, (msg) => ({
            ...msg,
            status: 'completed',
            transcript: result.text,
            language: result.language || msg.language,
            updatedAt: Date.now(),
          }));
          if (settingsRef.current.enableTranslation && settingsRef.current.translationEngine !== 'none') {
            enqueueTranslation(currentMessageId);
            processTranslationQueue();
          }
        })
        .catch((transcribeError) => {
          updateMessage(currentMessageId, (msg) => ({
            ...msg,
            status: 'failed',
            error: (transcribeError as Error).message,
            updatedAt: Date.now(),
          }));
        })
        .finally(() => {
          cleanupRecordingFile(payload.fileUri);
        });
    } catch (segmentError) {
      updateMessage(currentMessageId, (msg) => ({
        ...msg,
        status: 'failed',
        error: (segmentError as Error).message,
        updatedAt: Date.now(),
      }));
      cleanupRecordingFile(payload.fileUri);
    } finally {
      resetSegmentState();
      if (sessionActiveRef.current) {
        startNewRecording();
      }
    }
  }, [cleanupRecordingFile, enqueueTranslation, processTranslationQueue, resetSegmentState, settingsRef, startNewRecording, updateMessage]);

  const handleStatusUpdate = useCallback((status: RecordingStatus) => {
    if (!status.canRecord) {
      return;
    }
    const currentSettings = settingsRef.current;
    const segment = segmentStateRef.current;
    const durationMs = status.durationMillis ?? 0;
    const rms = meteringToRms(status.metering as number | undefined);
    const threshold = currentSettings.activationThreshold;

    if (!segment.isActive) {
      if (rms >= threshold) {
        if (segment.candidateStartMs == null) {
          segment.candidateStartMs = durationMs;
        }
        const elapsedAbove = durationMs - (segment.candidateStartMs ?? durationMs);
        if (elapsedAbove >= currentSettings.activationDurationSec * 1000) {
          segment.isActive = true;
          const messageId = nextMessageIdRef.current++;
          segment.messageId = messageId;
          applySettingsToSegment(segment, currentSettings, durationMs);
          const newMessage = createInitialMessage(messageId);
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
      if (rms < threshold) {
        if (segment.belowThresholdStartMs == null) {
          segment.belowThresholdStartMs = durationMs;
        }
        const silenceElapsed = durationMs - (segment.belowThresholdStartMs ?? durationMs);
        if (silenceElapsed >= currentSettings.silenceDurationSec * 1000) {
          finalizeSegment(status);
        }
      } else {
        segment.belowThresholdStartMs = null;
      }
      if (currentSettings.maxSegmentDurationSec > 0) {
        const startMs = segment.confirmedStartMs ?? 0;
        const segmentElapsed = durationMs - startMs;
        if (segmentElapsed >= currentSettings.maxSegmentDurationSec * 1000) {
          finalizeSegment(status);
        }
      }
    }
  }, [finalizeSegment, setMessagesAndRef, settingsRef]);

  useEffect(() => {
    return () => {
      stopAndResetRecording();
    };
  }, [stopAndResetRecording]);

  const value = useMemo<TranscriptionContextValue>(() => ({
    messages,
    isSessionActive,
    toggleSession,
    stopSession,
    isRecording,
    error,
    clearError: () => setError(null),
  }), [messages, isSessionActive, toggleSession, stopSession, isRecording, error]);

  return <TranscriptionContext.Provider value={value}>{children}</TranscriptionContext.Provider>;
}

export function useTranscription() {
  const context = useContext(TranscriptionContext);
  if (!context) {
    throw new Error('useTranscription must be used within TranscriptionProvider');
  }
  return context;
}
