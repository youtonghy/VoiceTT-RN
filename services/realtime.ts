import { Platform } from 'react-native';

import {
  AppSettings,
  DEFAULT_OPENAI_REALTIME_DELAY,
  DEFAULT_OPENAI_REALTIME_TRANSCRIPTION_MODEL,
  OPENAI_REALTIME_DELAY_OPTIONS,
  type OpenAIRealtimeDelay,
} from '@/types/settings';

const DEFAULT_OPENAI_BASE_URL = 'https://api.openai.com';

export function isRealtimeSupported(): boolean {
  if (typeof WebSocket === 'undefined') {
    return false;
  }
  if (Platform.OS !== 'web') {
    return true;
  }
  return typeof navigator !== 'undefined' && Boolean(navigator.mediaDevices?.getUserMedia);
}

export function resolveRealtimeTranscriptionModel(settings: AppSettings): string {
  return (
    settings.credentials.openaiRealtimeTranscriptionModel?.trim() ||
    DEFAULT_OPENAI_REALTIME_TRANSCRIPTION_MODEL
  );
}

export function resolveRealtimeDelay(settings: AppSettings): OpenAIRealtimeDelay {
  const candidate = settings.credentials.openaiRealtimeDelay;
  return candidate && OPENAI_REALTIME_DELAY_OPTIONS.includes(candidate)
    ? candidate
    : DEFAULT_OPENAI_REALTIME_DELAY;
}

export function resolveRealtimeWsUrl(settings: AppSettings): string {
  const baseUrl = (settings.credentials.openaiBaseUrl?.trim() || DEFAULT_OPENAI_BASE_URL)
    .replace(/\/+$/, '')
    .replace(/^https:\/\//, 'wss://')
    .replace(/^http:\/\//, 'ws://');
  const versionedBaseUrl = /\/v(?:1|1beta)$/.test(baseUrl) ? baseUrl : `${baseUrl}/v1`;
  return `${versionedBaseUrl}/realtime?intent=transcription`;
}

export interface RealtimeCallbacks {
  onDelta(itemId: string, text: string): void;
  onCompleted(itemId: string, transcript: string): void;
  onError(error: Error): void;
  onOpen(): void;
  onClose(): void;
}

type PendingSend = Record<string, unknown>;

export class RealtimeTranscriptionSession {
  private ws: WebSocket | null = null;
  private isOpen = false;
  private isClosed = false;
  private pendingSends: PendingSend[] = [];
  private transcripts = new Map<string, string>();

  constructor(
    private readonly settings: AppSettings,
    private readonly callbacks: RealtimeCallbacks
  ) {}

  connect(): Promise<void> {
    const apiKey = this.settings.credentials.openaiApiKey?.trim();
    if (!apiKey) {
      return Promise.reject(new Error('Missing OpenAI API key'));
    }
    if (!isRealtimeSupported()) {
      return Promise.reject(new Error('Realtime transcription is not supported on this platform'));
    }

    return new Promise((resolve, reject) => {
      let settled = false;
      const ws = new WebSocket(resolveRealtimeWsUrl(this.settings), [
        'realtime',
        'openai-insecure-api-key.' + apiKey,
      ]);
      this.ws = ws;

      ws.onopen = () => {
        this.isOpen = true;
        this.callbacks.onOpen();
        this.sendSessionUpdate();
        while (this.pendingSends.length) {
          const payload = this.pendingSends.shift();
          if (payload) {
            this.send(payload);
          }
        }
        if (!settled) {
          settled = true;
          resolve();
        }
      };

      ws.onerror = () => {
        const error = new Error('Realtime transcription connection failed');
        this.callbacks.onError(error);
        if (!settled) {
          settled = true;
          reject(error);
        }
      };

      ws.onclose = () => {
        this.isOpen = false;
        this.callbacks.onClose();
      };

      ws.onmessage = (event) => {
        this.handleMessage(event.data);
      };
    });
  }

  appendAudio(pcm16Base64: string): void {
    if (!pcm16Base64 || this.isClosed) {
      return;
    }
    this.sendOrQueue({
      type: 'input_audio_buffer.append',
      audio: pcm16Base64,
    });
  }

  commit(): void {
    if (this.isClosed) {
      return;
    }
    this.sendOrQueue({ type: 'input_audio_buffer.commit' });
  }

  close(): void {
    this.isClosed = true;
    this.pendingSends = [];
    this.transcripts.clear();
    if (!this.ws) {
      return;
    }
    const ws = this.ws;
    ws.onopen = null;
    ws.onerror = null;
    ws.onclose = null;
    ws.onmessage = null;
    try {
      if (ws.readyState === WebSocket.OPEN) {
        this.send({ type: 'session.close' });
      }
    } catch (error) {
      // Best-effort close; socket close below is the authoritative teardown.
    }
    ws.close();
    this.ws = null;
    this.isOpen = false;
  }

  private sendSessionUpdate() {
    const transcription: Record<string, unknown> = {
      model: resolveRealtimeTranscriptionModel(this.settings),
      delay: resolveRealtimeDelay(this.settings),
    };
    if (this.settings.transcriptionLanguage && this.settings.transcriptionLanguage !== 'auto') {
      transcription.language = this.settings.transcriptionLanguage;
    }
    this.send({
      type: 'session.update',
      session: {
        type: 'transcription',
        audio: {
          input: {
            format: {
              type: 'audio/pcm',
              rate: 24000,
            },
            transcription,
            turn_detection: null,
          },
        },
      },
    });
  }

  private sendOrQueue(payload: PendingSend) {
    if (this.isOpen) {
      this.send(payload);
      return;
    }
    this.pendingSends.push(payload);
  }

  private send(payload: PendingSend) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      return;
    }
    this.ws.send(JSON.stringify(payload));
  }

  private handleMessage(raw: unknown) {
    let event: any;
    try {
      event = typeof raw === 'string' ? JSON.parse(raw) : JSON.parse(String(raw));
    } catch (error) {
      return;
    }
    const type = typeof event?.type === 'string' ? event.type : '';
    if (type === 'error') {
      const message =
        event?.error?.message || event?.message || 'Realtime transcription failed';
      this.callbacks.onError(new Error(message));
      return;
    }
    if (type === 'conversation.item.input_audio_transcription.delta') {
      const itemId = this.resolveItemId(event);
      const delta = typeof event.delta === 'string' ? event.delta : '';
      if (!itemId || !delta) {
        return;
      }
      const accumulated = (this.transcripts.get(itemId) ?? '') + delta;
      this.transcripts.set(itemId, accumulated);
      this.callbacks.onDelta(itemId, delta);
      return;
    }
    if (type === 'conversation.item.input_audio_transcription.completed') {
      const itemId = this.resolveItemId(event);
      if (!itemId) {
        return;
      }
      const transcript =
        typeof event.transcript === 'string' && event.transcript.trim()
          ? event.transcript
          : this.transcripts.get(itemId) ?? '';
      this.transcripts.set(itemId, transcript);
      this.callbacks.onCompleted(itemId, transcript);
    }
  }

  private resolveItemId(event: any): string | null {
    const value = event?.item_id ?? event?.item?.id ?? event?.itemId;
    return typeof value === 'string' && value ? value : null;
  }
}
