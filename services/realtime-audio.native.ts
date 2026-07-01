import { NativeEventEmitter, NativeModules, Platform } from 'react-native';

export interface PcmCapture {
  stop: () => void;
  ready?: Promise<void>;
}

type RealtimeAudioNativeModule = {
  start(): Promise<void>;
  stop(): Promise<void>;
};

const RealtimeAudioModule = NativeModules.RealtimeAudioModule as
  | RealtimeAudioNativeModule
  | undefined;
const emitter = RealtimeAudioModule ? new NativeEventEmitter(RealtimeAudioModule as any) : null;

export function isNativeRealtimeAvailable(): boolean {
  return Platform.OS !== 'web' && Boolean(RealtimeAudioModule && emitter);
}

export function createPcmCapture(
  _stream: MediaStream | null,
  onChunk: (pcm16Base64: string) => void
): PcmCapture {
  if (!RealtimeAudioModule || !emitter) {
    throw new Error('RealtimeAudioModule is not available. Ensure you are using a dev build.');
  }

  const frameSubscription = emitter.addListener(
    'realtimeAudioFrame',
    (event: { chunk?: string }) => {
      if (typeof event?.chunk === 'string' && event.chunk) {
        onChunk(event.chunk);
      }
    }
  );
  const errorSubscription = emitter.addListener(
    'realtimeAudioError',
    (event: { message?: string }) => {
      console.warn('[realtime-audio] Native capture error', event?.message);
    }
  );
  let stopped = false;
  const ready = RealtimeAudioModule.start().catch((error) => {
    frameSubscription.remove();
    errorSubscription.remove();
    throw error;
  });

  return {
    ready,
    stop: () => {
      if (stopped) {
        return;
      }
      stopped = true;
      frameSubscription.remove();
      errorSubscription.remove();
      RealtimeAudioModule.stop().catch(() => undefined);
    },
  };
}
