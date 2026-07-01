export interface PcmCapture {
  stop: () => void;
}

export function createPcmCapture(): PcmCapture {
  throw new Error('Realtime audio capture is not supported on native in Phase 1');
}
