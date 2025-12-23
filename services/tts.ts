import { DEFAULT_OPENAI_BASE_URL } from '@/services/transcription';
import { validateApiKey, validateModelName } from '@/services/input-validation';
import {
  AppSettings,
  DEFAULT_GEMINI_TTS_MODEL,
  DEFAULT_GEMINI_TTS_VOICE,
  DEFAULT_OPENAI_TTS_MODEL,
  DEFAULT_OPENAI_TTS_VOICE,
  GEMINI_TTS_VOICES,
  OPENAI_TTS_VOICES,
} from '@/types/settings';
import type { TextToSpeechFormat } from '@/types/tts';

export interface TextToSpeechOptions {
  text: string;
  settings: AppSettings;
  voice?: string;
  model?: string;
  prompt?: string;
  format?: TextToSpeechFormat;
  speed?: number;
  signal?: AbortSignal;
}

export interface TextToSpeechResult {
  audio: ArrayBuffer;
  format: TextToSpeechFormat;
  mimeType: string;
  model: string;
  voice: string;
}

const DEFAULT_TTS_FORMAT: TextToSpeechFormat = 'mp3';
const MAX_TTS_INPUT_CHARS = 4000;
const MIN_TTS_INPUT_CHARS = 1;
const MIN_TTS_SPEED = 0.25;
const MAX_TTS_SPEED = 4;
const GEMINI_TTS_SAMPLE_RATE = 24000;
const GEMINI_TTS_CHANNELS = 1;
const GEMINI_TTS_BITS_PER_SAMPLE = 16;
const BASE64_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
const BASE64_LOOKUP = (() => {
  const table = new Uint8Array(256);
  table.fill(255);
  for (let i = 0; i < BASE64_ALPHABET.length; i += 1) {
    table[BASE64_ALPHABET.charCodeAt(i)] = i;
  }
  table['='.charCodeAt(0)] = 0;
  return table;
})();

function resolveOpenAIBaseUrl(settings: AppSettings): string {
  const baseUrl = settings.credentials.openaiBaseUrl || DEFAULT_OPENAI_BASE_URL;
  return baseUrl.replace(/\/$/, '');
}

function resolveMimeType(format: TextToSpeechFormat): string {
  switch (format) {
    case 'wav':
      return 'audio/wav';
    case 'aac':
      return 'audio/aac';
    case 'flac':
      return 'audio/flac';
    case 'opus':
      return 'audio/opus';
    case 'mp3':
    default:
      return 'audio/mpeg';
  }
}

function sanitizeText(input: string): string {
  return input.replace(/[\x00-\x08\x0B-\x0C\x0E-\x1F\x7F]/g, '');
}

function validateTextToSpeechInput(text: unknown): string {
  if (typeof text !== 'string') {
    throw new Error('TTS input must be a string');
  }
  const trimmed = sanitizeText(text).trim();
  if (trimmed.length < MIN_TTS_INPUT_CHARS) {
    throw new Error('TTS input cannot be empty');
  }
  if (trimmed.length > MAX_TTS_INPUT_CHARS) {
    throw new Error(`TTS input exceeds maximum length of ${MAX_TTS_INPUT_CHARS} characters`);
  }
  return trimmed;
}

function normalizeOpenAIVoice(voice?: string): string {
  const resolved = voice?.trim();
  if (resolved && OPENAI_TTS_VOICES.includes(resolved)) {
    return resolved;
  }
  return DEFAULT_OPENAI_TTS_VOICE;
}

function normalizeGeminiVoice(voice?: string): string {
  const resolved = voice?.trim();
  if (resolved && GEMINI_TTS_VOICES.includes(resolved)) {
    return resolved;
  }
  return DEFAULT_GEMINI_TTS_VOICE;
}

function normalizeSpeed(speed?: number): number | undefined {
  if (speed === undefined) {
    return undefined;
  }
  if (typeof speed !== 'number' || !Number.isFinite(speed)) {
    throw new Error('TTS speed must be a number');
  }
  if (speed < MIN_TTS_SPEED || speed > MAX_TTS_SPEED) {
    throw new Error(`TTS speed must be between ${MIN_TTS_SPEED} and ${MAX_TTS_SPEED}`);
  }
  return speed;
}

export async function synthesizeSpeech(options: TextToSpeechOptions): Promise<TextToSpeechResult> {
  if (options.settings.ttsEngine === 'gemini') {
    return synthesizeSpeechWithGemini(options);
  }
  return synthesizeSpeechWithOpenAI(options);
}

function base64ToUint8Array(base64: string): Uint8Array {
  const sanitized = base64.replace(/[\r\n\s]/g, '');
  if (sanitized.length % 4 !== 0) {
    throw new Error('Invalid base64 audio payload');
  }
  const padding = sanitized.endsWith('==') ? 2 : sanitized.endsWith('=') ? 1 : 0;
  const outputLength = (sanitized.length * 3) / 4 - padding;
  const output = new Uint8Array(outputLength);
  let outputIndex = 0;
  for (let i = 0; i < sanitized.length; i += 4) {
    const enc1 = BASE64_LOOKUP[sanitized.charCodeAt(i)];
    const enc2 = BASE64_LOOKUP[sanitized.charCodeAt(i + 1)];
    const enc3 = BASE64_LOOKUP[sanitized.charCodeAt(i + 2)];
    const enc4 = BASE64_LOOKUP[sanitized.charCodeAt(i + 3)];
    if (enc1 === 255 || enc2 === 255 || enc3 === 255 || enc4 === 255) {
      throw new Error('Invalid base64 audio payload');
    }
    const triplet = (enc1 << 18) | (enc2 << 12) | (enc3 << 6) | enc4;
    if (outputIndex < outputLength) {
      output[outputIndex] = (triplet >> 16) & 0xff;
      outputIndex += 1;
    }
    if (outputIndex < outputLength) {
      output[outputIndex] = (triplet >> 8) & 0xff;
      outputIndex += 1;
    }
    if (outputIndex < outputLength) {
      output[outputIndex] = triplet & 0xff;
      outputIndex += 1;
    }
  }
  return output;
}

function writeAscii(view: DataView, offset: number, value: string) {
  for (let i = 0; i < value.length; i += 1) {
    view.setUint8(offset + i, value.charCodeAt(i));
  }
}

function wrapPcmAsWav(
  pcm: Uint8Array,
  sampleRate: number,
  channels: number,
  bitsPerSample: number
): ArrayBuffer {
  const blockAlign = (channels * bitsPerSample) / 8;
  const byteRate = sampleRate * blockAlign;
  const buffer = new ArrayBuffer(44 + pcm.length);
  const view = new DataView(buffer);
  writeAscii(view, 0, 'RIFF');
  view.setUint32(4, 36 + pcm.length, true);
  writeAscii(view, 8, 'WAVE');
  writeAscii(view, 12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, channels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitsPerSample, true);
  writeAscii(view, 36, 'data');
  view.setUint32(40, pcm.length, true);
  new Uint8Array(buffer, 44).set(pcm);
  return buffer;
}

function parsePcmSampleRate(mimeType?: string): number | undefined {
  if (!mimeType) {
    return undefined;
  }
  const match = mimeType.match(/rate=(\d+)/i);
  if (!match) {
    return undefined;
  }
  const parsed = Number.parseInt(match[1], 10);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function resolveFormatFromMime(mimeType: string): TextToSpeechFormat | null {
  if (mimeType.includes('audio/wav') || mimeType.includes('audio/x-wav') || mimeType.includes('audio/wave')) {
    return 'wav';
  }
  if (mimeType.includes('audio/mpeg') || mimeType.includes('audio/mp3')) {
    return 'mp3';
  }
  if (mimeType.includes('audio/aac')) {
    return 'aac';
  }
  if (mimeType.includes('audio/flac')) {
    return 'flac';
  }
  if (mimeType.includes('audio/opus')) {
    return 'opus';
  }
  return null;
}

function normalizeMimeType(raw?: string): string | undefined {
  if (!raw) {
    return undefined;
  }
  return raw.trim().toLowerCase();
}

function extractGeminiAudioPayload(data: any): { base64: string; mimeType?: string } {
  const candidates = data?.candidates;
  if (Array.isArray(candidates)) {
    for (const candidate of candidates) {
      const parts = candidate?.content?.parts ?? candidate?.parts;
      if (Array.isArray(parts)) {
        for (const part of parts) {
          const inlineData = part?.inlineData ?? part?.inline_data;
          const payload = inlineData?.data ?? inlineData?.inlineData?.data;
          if (typeof payload === 'string' && payload.trim()) {
            const mimeType = inlineData?.mimeType ?? inlineData?.mime_type;
            return { base64: payload.trim(), mimeType: typeof mimeType === 'string' ? mimeType : undefined };
          }
        }
      }
    }
  }
  const parts = data?.content?.parts ?? data?.parts;
  if (Array.isArray(parts)) {
    for (const part of parts) {
      const inlineData = part?.inlineData ?? part?.inline_data;
      const payload = inlineData?.data ?? inlineData?.inlineData?.data;
      if (typeof payload === 'string' && payload.trim()) {
        const mimeType = inlineData?.mimeType ?? inlineData?.mime_type;
        return { base64: payload.trim(), mimeType: typeof mimeType === 'string' ? mimeType : undefined };
      }
    }
  }
  if (typeof data?.inlineData?.data === 'string') {
    return { base64: data.inlineData.data.trim(), mimeType: data.inlineData.mimeType };
  }
  throw new Error('Gemini TTS returned no audio payload');
}

function normalizeBuffer(bytes: Uint8Array): ArrayBuffer {
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
}

async function synthesizeSpeechWithOpenAI(
  options: TextToSpeechOptions
): Promise<TextToSpeechResult> {
  const apiKeyValidation = validateApiKey(options.settings.credentials.openaiApiKey);
  if (!apiKeyValidation.valid) {
    throw new Error(`OpenAI API key validation failed: ${apiKeyValidation.error}`);
  }
  const apiKey = apiKeyValidation.sanitized!;

  const modelInput =
    options.model?.trim() ||
    options.settings.credentials.openaiTtsModel?.trim() ||
    DEFAULT_OPENAI_TTS_MODEL;
  const modelValidation = validateModelName(modelInput);
  if (!modelValidation.valid) {
    throw new Error(`OpenAI model validation failed: ${modelValidation.error}`);
  }
  const model = modelValidation.sanitized!;

  const text = validateTextToSpeechInput(options.text);
  const voice = normalizeOpenAIVoice(options.voice);
  const instructions = typeof options.prompt === 'string' ? options.prompt.trim() : '';
  const format = options.format ?? DEFAULT_TTS_FORMAT;
  const speed = normalizeSpeed(options.speed);

  const payload: Record<string, unknown> = {
    model,
    input: text,
    voice,
    response_format: format,
  };
  if (instructions) {
    payload.instructions = instructions;
  }
  if (speed !== undefined) {
    payload.speed = speed;
  }

  const url = `${resolveOpenAIBaseUrl(options.settings)}/v1/audio/speech`;
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
    signal: options.signal,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error('OpenAI TTS failed: ' + (errorText || response.statusText));
  }

  const audio = await response.arrayBuffer();
  const mimeType = response.headers.get('content-type') || resolveMimeType(format);
  return {
    audio,
    format,
    mimeType,
    model,
    voice,
  };
}

async function synthesizeSpeechWithGemini(
  options: TextToSpeechOptions
): Promise<TextToSpeechResult> {
  const apiKeyValidation = validateApiKey(options.settings.credentials.geminiApiKey);
  if (!apiKeyValidation.valid) {
    throw new Error(`Gemini API key validation failed: ${apiKeyValidation.error}`);
  }
  const apiKey = apiKeyValidation.sanitized!;

  const modelInput =
    options.model?.trim() ||
    options.settings.credentials.geminiTtsModel?.trim() ||
    DEFAULT_GEMINI_TTS_MODEL;
  const modelValidation = validateModelName(modelInput);
  if (!modelValidation.valid) {
    throw new Error(`Gemini model validation failed: ${modelValidation.error}`);
  }
  const model = modelValidation.sanitized!;

  const text = validateTextToSpeechInput(options.text);
  const voice = normalizeGeminiVoice(options.voice);
  const prompt = typeof options.prompt === 'string' ? options.prompt.trim() : '';

  const payload: Record<string, unknown> = {
    model,
    contents: [
      {
        role: 'user',
        parts: [{ text }],
      },
    ],
    generationConfig: {
      responseModalities: ['AUDIO'],
      speechConfig: {
        voiceConfig: {
          prebuiltVoiceConfig: {
            voiceName: voice,
          },
        },
      },
    },
  };
  if (prompt) {
    payload.systemInstruction = { parts: [{ text: prompt }] };
  }

  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
    signal: options.signal,
  });

  if (!response.ok) {
    const errorText = await response.text();
    const safeError = errorText.replace(new RegExp(apiKey, 'g'), '[REDACTED]');
    throw new Error('Gemini TTS failed: ' + (safeError || response.statusText));
  }

  const data = await response.json();
  const { base64, mimeType: rawMimeType } = extractGeminiAudioPayload(data);
  const mimeType = normalizeMimeType(rawMimeType);
  const audioBytes = base64ToUint8Array(base64);
  if (mimeType && mimeType.includes('audio/pcm')) {
    const sampleRate = parsePcmSampleRate(mimeType) ?? GEMINI_TTS_SAMPLE_RATE;
    const wavBuffer = wrapPcmAsWav(audioBytes, sampleRate, GEMINI_TTS_CHANNELS, GEMINI_TTS_BITS_PER_SAMPLE);
    return {
      audio: wavBuffer,
      format: 'wav',
      mimeType: 'audio/wav',
      model,
      voice,
    };
  }

  if (mimeType) {
    const resolvedFormat = resolveFormatFromMime(mimeType);
    if (resolvedFormat) {
      return {
        audio: normalizeBuffer(audioBytes),
        format: resolvedFormat,
        mimeType,
        model,
        voice,
      };
    }
  }

  const wavBuffer = wrapPcmAsWav(
    audioBytes,
    GEMINI_TTS_SAMPLE_RATE,
    GEMINI_TTS_CHANNELS,
    GEMINI_TTS_BITS_PER_SAMPLE
  );
  return {
    audio: wavBuffer,
    format: 'wav',
    mimeType: 'audio/wav',
    model,
    voice,
  };
}
