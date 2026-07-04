export interface PcmCapture {
  stop: () => void;
  ready?: Promise<void>;
}

const SAMPLE_RATE = 24000;
const CHUNK_SAMPLES = 1200;

export function isNativeRealtimeAvailable(): boolean {
  return false;
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  const chunkSize = 0x8000;
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    const chunk = bytes.subarray(offset, offset + chunkSize);
    binary += String.fromCharCode(...chunk);
  }
  return btoa(binary);
}

function floatToPcm16Base64(input: Float32Array): string {
  const pcm = new Int16Array(input.length);
  for (let index = 0; index < input.length; index += 1) {
    const clamped = Math.max(-1, Math.min(1, input[index] ?? 0));
    pcm[index] = clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff;
  }
  return arrayBufferToBase64(pcm.buffer);
}

function createWorkletUrl() {
  const source = `
    class PcmCaptureProcessor extends AudioWorkletProcessor {
      constructor() {
        super();
        this.pending = [];
        this.pendingLength = 0;
        this.chunkSamples = ${CHUNK_SAMPLES};
      }
      process(inputs) {
        const input = inputs[0];
        const channel = input && input[0];
        if (!channel || !channel.length) {
          return true;
        }
        this.pending.push(new Float32Array(channel));
        this.pendingLength += channel.length;
        while (this.pendingLength >= this.chunkSamples) {
          const chunk = new Float32Array(this.chunkSamples);
          let writeOffset = 0;
          while (writeOffset < this.chunkSamples && this.pending.length) {
            const head = this.pending[0];
            const remaining = this.chunkSamples - writeOffset;
            const take = Math.min(remaining, head.length);
            chunk.set(head.subarray(0, take), writeOffset);
            writeOffset += take;
            if (take === head.length) {
              this.pending.shift();
            } else {
              this.pending[0] = head.subarray(take);
            }
            this.pendingLength -= take;
          }
          this.port.postMessage(chunk);
        }
        return true;
      }
    }
    registerProcessor('pcm-capture-processor', PcmCaptureProcessor);
  `;
  return URL.createObjectURL(new Blob([source], { type: 'application/javascript' }));
}

export function createPcmCapture(
  stream: MediaStream | null,
  onChunk: (pcm16Base64: string) => void,
  onError?: (error: Error) => void
): PcmCapture {
  if (!stream) {
    throw new Error('MediaStream is required for web realtime audio capture');
  }
  const AudioContextConstructor =
    (window as typeof window & { webkitAudioContext?: typeof AudioContext }).AudioContext ||
    (window as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioContextConstructor) {
    throw new Error('Web Audio is unavailable in this environment');
  }

  const context = new AudioContextConstructor({ sampleRate: SAMPLE_RATE });
  const source = context.createMediaStreamSource(stream);
  const silentGain = context.createGain();
  silentGain.gain.value = 0;
  silentGain.connect(context.destination);

  let stopped = false;
  let workletUrl: string | null = null;
  let processor: AudioWorkletNode | ScriptProcessorNode | null = null;

  const stop = () => {
    if (stopped) {
      return;
    }
    stopped = true;
    try {
      processor?.disconnect();
      source.disconnect();
      silentGain.disconnect();
    } catch (error) {
      // Disconnect is best effort; context close below releases native resources.
    }
    if (workletUrl) {
      URL.revokeObjectURL(workletUrl);
      workletUrl = null;
    }
    context.close().catch(() => undefined);
  };

  const startFallback = () => {
    const scriptNode = context.createScriptProcessor(2048, 1, 1);
    let pending = new Float32Array(0);
    scriptNode.onaudioprocess = (event) => {
      if (stopped) {
        return;
      }
      const input = event.inputBuffer.getChannelData(0);
      const next = new Float32Array(pending.length + input.length);
      next.set(pending, 0);
      next.set(input, pending.length);
      let offset = 0;
      while (next.length - offset >= CHUNK_SAMPLES) {
        onChunk(floatToPcm16Base64(next.subarray(offset, offset + CHUNK_SAMPLES)));
        offset += CHUNK_SAMPLES;
      }
      pending = next.subarray(offset);
    };
    source.connect(scriptNode);
    scriptNode.connect(silentGain);
    processor = scriptNode;
  };

  let ready: Promise<void> | undefined;

  if (context.audioWorklet && typeof AudioWorkletNode !== 'undefined') {
    workletUrl = createWorkletUrl();
    ready = context.audioWorklet
      .addModule(workletUrl)
      .then(() => {
        if (stopped) {
          return;
        }
        const workletNode = new AudioWorkletNode(context, 'pcm-capture-processor');
        workletNode.port.onmessage = (event) => {
          if (!stopped && event.data instanceof Float32Array) {
            onChunk(floatToPcm16Base64(event.data));
          }
        };
        source.connect(workletNode);
        workletNode.connect(silentGain);
        processor = workletNode;
      })
      .catch((error) => {
        onError?.(error instanceof Error ? error : new Error(String(error)));
        if (!stopped) {
          startFallback();
        }
      });
  } else {
    startFallback();
    ready = Promise.resolve();
  }

  if (context.state === 'suspended') {
    context.resume().catch(() => undefined);
  }

  return { stop, ready };
}
