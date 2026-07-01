export interface PcmCapture {
  stop: () => void;
  ready?: Promise<void>;
}

export function isNativeRealtimeAvailable(): boolean {
  return false;
}

export function createPcmCapture(
  _stream: MediaStream | null,
  _onChunk: (pcm16Base64: string) => void
): PcmCapture {
  throw new Error('Realtime audio capture is unavailable for this platform build.');
}
