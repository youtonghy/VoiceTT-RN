import { Platform } from 'react-native';
import { EncodingType, getInfoAsync, readAsStringAsync } from 'expo-file-system/legacy';

import {
  AppSettings,
  DEFAULT_CONVERSATION_SUMMARY_PROMPT,
  DEFAULT_GEMINI_CONVERSATION_MODEL,
  DEFAULT_GEMINI_TITLE_MODEL,
  DEFAULT_OPENAI_CONVERSATION_MODEL,
  DEFAULT_OPENAI_TITLE_MODEL,
  DEFAULT_TITLE_SUMMARY_PROMPT,
} from '@/types/settings';
import { SegmentedTranscriptionResult, TranslationResult } from '@/types/transcription';

export const DEFAULT_OPENAI_BASE_URL = 'https://api.openai.com';
export const DEFAULT_OPENAI_TRANSCRIPTION_MODEL = 'gpt-4o-transcribe';
export const DEFAULT_OPENAI_TRANSLATION_MODEL = 'gpt-4o-mini';
export const DEFAULT_GEMINI_TRANSCRIPTION_MODEL = 'gemini-2.5-flash';
export const DEFAULT_GEMINI_TRANSLATION_MODEL = 'gemini-2.5-flash';
export const DEFAULT_QWEN_TRANSCRIPTION_MODEL = 'qwen3-asr-flash';
export const DEFAULT_SONIOX_TRANSCRIPTION_MODEL = 'stt-async-preview';
export const DEFAULT_DOUBAO_TRANSCRIPTION_MODEL = 'auc-file';
export const DEFAULT_GLM_TRANSCRIPTION_MODEL = 'glm-asr-2512';
export const DEFAULT_TITLE_RESPONSE_MAX_TOKENS = 96;
export const DEFAULT_TITLE_RESPONSE_TEMPERATURE = 0.4;
export const DEFAULT_CONVERSATION_RESPONSE_MAX_TOKENS = 512;
export const DEFAULT_CONVERSATION_RESPONSE_TEMPERATURE = 0.35;
const MAX_TITLE_INPUT_CHARS = 6000;
const MAX_CONVERSATION_INPUT_CHARS = 20000;
const MAX_ASSISTANT_CONTEXT_CHARS = 12000;
const MAX_ASSISTANT_SUMMARY_CHARS = 2000;
const MAX_ASSISTANT_TRANSLATION_CHARS = 9000;
const MAX_ASSISTANT_TRANSCRIPT_CHARS = 9000;
const MAX_ASSISTANT_HISTORY_MESSAGES = 8;
const DEFAULT_ASSISTANT_RESPONSE_MAX_TOKENS = 768;
const DEFAULT_ASSISTANT_RESPONSE_TEMPERATURE = 0.6;
const DASHSCOPE_MULTIMODAL_ENDPOINT =
  'https://dashscope.aliyuncs.com/api/v1/services/aigc/multimodal-generation/generation';
const SONIOX_API_BASE_URL = 'https://api.soniox.com';
const SONIOX_POLL_INTERVAL_MS = 1000;
const DOUBAO_SUBMIT_URL = 'https://openspeech.bytedance.com/api/v1/auc/submit';
const DOUBAO_QUERY_URL = 'https://openspeech.bytedance.com/api/v1/auc/query';
const DOUBAO_POLL_INTERVAL_MS = 2000;
const DOUBAO_MAX_POLL_ATTEMPTS = 90;
const GLM_TRANSCRIPTION_URL = 'https://open.bigmodel.cn/api/paas/v4/audio/transcriptions';

function resolveOpenAIBaseUrl(settings: AppSettings) {
  return (settings.credentials.openaiBaseUrl || DEFAULT_OPENAI_BASE_URL).replace(/\/$/, '');
}

export function resolveTranscriptionModel(settings: AppSettings): string {
  switch (settings.transcriptionEngine) {
    case 'openai':
      return (
        settings.credentials.openaiTranscriptionModel?.trim() || DEFAULT_OPENAI_TRANSCRIPTION_MODEL
      );
    case 'gemini':
      return (
        settings.credentials.geminiTranscriptionModel?.trim() || DEFAULT_GEMINI_TRANSCRIPTION_MODEL
      );
    case 'qwen3':
      return settings.credentials.qwenTranscriptionModel?.trim() || DEFAULT_QWEN_TRANSCRIPTION_MODEL;
    case 'soniox':
      return DEFAULT_SONIOX_TRANSCRIPTION_MODEL;
    case 'doubao':
      return DEFAULT_DOUBAO_TRANSCRIPTION_MODEL;
    case 'glm':
      return settings.credentials.glmTranscriptionModel?.trim() || DEFAULT_GLM_TRANSCRIPTION_MODEL;
    default:
      return DEFAULT_OPENAI_TRANSCRIPTION_MODEL;
  }
}

export function resolveTranslationModel(settings: AppSettings): string {
  switch (settings.translationEngine) {
    case 'openai':
      return (
        settings.credentials.openaiTranslationModel?.trim() || DEFAULT_OPENAI_TRANSLATION_MODEL
      );
    case 'gemini':
      return settings.credentials.geminiTranslationModel?.trim() || DEFAULT_GEMINI_TRANSLATION_MODEL;
    default:
      return DEFAULT_OPENAI_TRANSLATION_MODEL;
  }
}

function collectGeminiText(data: any): string {
  if (!data) {
    return '';
  }
  const candidates = data?.candidates;
  if (Array.isArray(candidates)) {
    for (const candidate of candidates) {
      const parts = candidate?.content?.parts ?? candidate?.parts;
      if (Array.isArray(parts)) {
        const combined = parts
          .map((part: any) => (typeof part?.text === 'string' ? part.text : ''))
          .filter(Boolean)
          .join('\n');
        if (combined.trim()) {
          return combined.trim();
        }
      }
      if (typeof candidate?.text === 'string' && candidate.text.trim()) {
        return candidate.text.trim();
      }
    }
  }
  if (typeof data?.text === 'string' && data.text.trim()) {
    return data.text.trim();
  }
  if (typeof data?.output_text === 'string' && data.output_text.trim()) {
    return data.output_text.trim();
  }
  return '';
}

export interface TranscriptionSegmentPayload {
  fileUri: string;
  startOffsetMs: number;
  endOffsetMs: number;
  durationMs: number;
  messageId: number;
}

function ensureFileExists(uri: string) {
  if (!uri) {
    throw new Error('Recording file URI missing');
  }
}

function inferMimeType(uri: string): string {
  const lower = uri.toLowerCase();
  if (lower.endsWith('.wav')) return 'audio/wav';
  if (lower.endsWith('.m4a')) return 'audio/mp4';
  if (lower.endsWith('.mp3')) return 'audio/mpeg';
  if (lower.endsWith('.ogg')) return 'audio/ogg';
  return 'audio/wav';
}

function inferFileName(uri: string): string {
  if (!uri) {
    return 'segment.wav';
  }
  const parts = uri.split(/[\/]/);
  const candidate = parts[parts.length - 1];
  if (!candidate) {
    return 'segment.wav';
  }
  return candidate;
}

function inferQwenAudioFormat(uri: string): string {
  const lower = uri.toLowerCase();
  if (lower.endsWith('.mp3')) return 'mp3';
  if (lower.endsWith('.m4a') || lower.endsWith('.mp4')) return 'mp4';
  if (lower.endsWith('.ogg')) return 'ogg';
  if (lower.endsWith('.webm')) return 'webm';
  if (lower.endsWith('.wav')) return 'wav';
  return 'wav';
}

function inferDoubaoAudioFormat(uri: string): string {
  const lower = uri.toLowerCase();
  if (lower.endsWith('.ogg')) return 'ogg';
  if (lower.endsWith('.mp3')) return 'mp3';
  if (lower.endsWith('.mp4') || lower.endsWith('.m4a')) return 'mp4';
  if (lower.endsWith('.wav')) return 'wav';
  return 'wav';
}

function createDataUri(mimeType: string, base64: string): string {
  return `data:${mimeType};base64,${base64}`;
}

function resolveQwenLanguage(settings: AppSettings): string | undefined {
  const language = settings.transcriptionLanguage?.trim();
  if (!language || language.toLowerCase() === 'auto') {
    return undefined;
  }
  if (/^[a-z]{2,4}$/i.test(language)) {
    return language;
  }
  return undefined;
}

interface QwenExtractionResult {
  text?: string;
  language?: string;
}

function extractTextFromQwenContent(content: any): QwenExtractionResult {
  if (!content) {
    return {};
  }
  if (typeof content === 'string' && content.trim()) {
    return { text: content.trim() };
  }
  if (Array.isArray(content)) {
    for (const item of content) {
      if (item && typeof item === 'object') {
        if (typeof item.text === 'string' && item.text.trim()) {
          const language =
            typeof item.language === 'string'
              ? item.language
              : typeof item.attributes?.language === 'string'
              ? item.attributes.language
              : undefined;
          return { text: item.text.trim(), language };
        }
        if (typeof item.content === 'string' && item.content.trim()) {
          return { text: item.content.trim() };
        }
      }
    }
  }
  return {};
}

function extractTextFromQwenResponse(data: any): QwenExtractionResult {
  const fallback: QwenExtractionResult = {};
  if (!data) {
    return fallback;
  }

  const tryMessage = (message: any): QwenExtractionResult => {
    if (!message) {
      return fallback;
    }
    const fromContent = extractTextFromQwenContent(message.content);
    if (fromContent.text) {
      if (!fromContent.language) {
        const detected =
          typeof message.detected_language === 'string'
            ? message.detected_language
            : typeof message.language === 'string'
            ? message.language
            : undefined;
        if (detected) {
          fromContent.language = detected;
        }
      }
      return fromContent;
    }
    if (typeof message.text === 'string' && message.text.trim()) {
      return {
        text: message.text.trim(),
        language:
          typeof message.language === 'string' ? message.language : undefined,
      };
    }
    return fallback;
  };

  const output = data.output;
  if (output) {
    const choices = Array.isArray(output.choices) ? output.choices : [];
    for (const choice of choices) {
      const parsed = tryMessage(choice?.message);
      if (parsed.text) {
        return parsed;
      }
      const fromContent = extractTextFromQwenContent(choice?.content);
      if (fromContent.text) {
        return fromContent;
      }
    }
    if (typeof output.text === 'string' && output.text.trim()) {
      return { text: output.text.trim() };
    }
  }

  const choices = Array.isArray(data.choices) ? data.choices : [];
  for (const choice of choices) {
    const parsed = tryMessage(choice?.message);
    if (parsed.text) {
      return parsed;
    }
    if (typeof choice.text === 'string' && choice.text.trim()) {
      return { text: choice.text.trim() };
    }
  }

  if (data.message) {
    const parsed = tryMessage(data.message);
    if (parsed.text) {
      return parsed;
    }
  }

  if (typeof data.output_text === 'string' && data.output_text.trim()) {
    return { text: data.output_text.trim() };
  }
  if (typeof data.text === 'string' && data.text.trim()) {
    return { text: data.text.trim() };
  }
  if (typeof data.result === 'string' && data.result.trim()) {
    return { text: data.result.trim() };
  }
  if (typeof data === 'string' && data.trim()) {
    return { text: data.trim() };
  }

  return fallback;
}

async function transcribeWithOpenAI(
  payload: TranscriptionSegmentPayload,
  settings: AppSettings,
  signal?: AbortSignal
): Promise<SegmentedTranscriptionResult> {
  const apiKey = settings.credentials.openaiApiKey;
  if (!apiKey) {
    throw new Error('Missing OpenAI API key');
  }
  ensureFileExists(payload.fileUri);
  const info = await getInfoAsync(payload.fileUri);
  if (!info.exists) {
    throw new Error('Recording file not found on disk');
  }

  const url = resolveOpenAIBaseUrl(settings) + '/v1/audio/transcriptions';

  const formData = new FormData();
  formData.append('file', {
    // @ts-ignore FormData typing does not include uri on web
    uri: payload.fileUri,
    name: inferFileName(payload.fileUri),
    type: inferMimeType(payload.fileUri),
  } as any);
  formData.append('model', resolveTranscriptionModel(settings));
  formData.append('response_format', 'text');
  if (settings.transcriptionLanguage && settings.transcriptionLanguage !== 'auto') {
    formData.append('language', settings.transcriptionLanguage);
  }

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: 'Bearer ' + apiKey,
      ...(Platform.OS === 'web' ? {} : { Accept: 'application/json' }),
    },
    body: formData as any,
    signal,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error('OpenAI transcription failed: ' + (errorText || response.statusText));
  }

  const text = await response.text();
  return {
    text: text.trim(),
    language: settings.transcriptionLanguage !== 'auto' ? settings.transcriptionLanguage : undefined,
  };
}

async function transcribeWithGemini(
  payload: TranscriptionSegmentPayload,
  settings: AppSettings,
  signal?: AbortSignal
): Promise<SegmentedTranscriptionResult> {
  const apiKey = settings.credentials.geminiApiKey?.trim();
  if (!apiKey) {
    throw new Error('Missing Gemini API key');
  }

  ensureFileExists(payload.fileUri);
  const info = await getInfoAsync(payload.fileUri);
  if (!info.exists) {
    throw new Error('Recording file not found on disk');
  }

  const base64Audio = await readAsStringAsync(payload.fileUri, {
    encoding: EncodingType.Base64,
  });

  if (!base64Audio) {
    throw new Error('Failed to read audio file for Gemini transcription');
  }

  const model = resolveTranscriptionModel(settings);
  const audioMime = inferMimeType(payload.fileUri);
  // Note: Gemini API requires key as URL parameter - avoid logging the full URL
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  const languageHint =
    settings.transcriptionLanguage && settings.transcriptionLanguage !== 'auto'
      ? settings.transcriptionLanguage
      : undefined;

  const instructionParts = [
    'Transcribe the provided audio accurately.',
    'Return only the transcript text without timestamps or speaker labels.',
  ];
  if (languageHint) {
    instructionParts.push(`The spoken language is: ${languageHint}.`);
  }
  const instruction = instructionParts.join(' ');

  const payloadJson = {
    contents: [
      {
        role: 'user',
        parts: [
          { text: instruction },
          {
            inlineData: {
              mimeType: audioMime,
              data: base64Audio,
            },
          },
        ],
      },
    ],
    generationConfig: {
      temperature: 0,
      maxOutputTokens: 2048,
      topP: 0.9,
      topK: 40,
    },
  };

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payloadJson),
    signal,
  });

  if (!response.ok) {
    const errorText = await response.text();
    const safeError = errorText.replace(new RegExp(apiKey, 'g'), '[REDACTED]');
    throw new Error('Gemini transcription failed: ' + (safeError || response.statusText));
  }

  const data = await response.json();
  const text = collectGeminiText(data);
  if (!text) {
    throw new Error('Gemini transcription returned empty result');
  }

  return {
    text,
    language: languageHint,
  };
}

async function transcribeWithGlm(
  payload: TranscriptionSegmentPayload,
  settings: AppSettings,
  signal?: AbortSignal
): Promise<SegmentedTranscriptionResult> {
  const apiKey = settings.credentials.glmApiKey?.trim();
  if (!apiKey) {
    throw new Error('Missing GLM API key');
  }
  ensureFileExists(payload.fileUri);
  const info = await getInfoAsync(payload.fileUri);
  if (!info.exists) {
    throw new Error('Recording file not found on disk');
  }

  const formData = new FormData();
  formData.append('file', {
    // @ts-ignore FormData typing does not include uri on web
    uri: payload.fileUri,
    name: inferFileName(payload.fileUri),
    type: inferMimeType(payload.fileUri),
  } as any);
  formData.append('model', resolveTranscriptionModel(settings));
  formData.append('stream', 'false');
  formData.append('request_id', `segment-${payload.messageId}-${Date.now()}`);

  const response = await fetch(GLM_TRANSCRIPTION_URL, {
    method: 'POST',
    headers: {
      Authorization: 'Bearer ' + apiKey,
      ...(Platform.OS === 'web' ? {} : { Accept: 'application/json' }),
    },
    body: formData as any,
    signal,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error('GLM transcription failed: ' + (errorText || response.statusText));
  }

  let data: any;
  try {
    data = await response.json();
  } catch (error) {
    throw new Error('GLM transcription failed: Invalid JSON response');
  }

  const text = typeof data?.text === 'string' ? data.text.trim() : '';
  if (!text) {
    throw new Error('GLM transcription returned empty result');
  }

  const language =
    settings.transcriptionLanguage && settings.transcriptionLanguage !== 'auto'
      ? settings.transcriptionLanguage
      : undefined;

  return {
    text,
    language,
  };
}

async function transcribeWithQwen(
  payload: TranscriptionSegmentPayload,
  settings: AppSettings,
  signal?: AbortSignal
): Promise<SegmentedTranscriptionResult> {
  const apiKey = settings.credentials.qwenApiKey?.trim();
  if (!apiKey) {
    throw new Error('Missing Qwen API key');
  }
  ensureFileExists(payload.fileUri);
  const info = await getInfoAsync(payload.fileUri);
  if (!info.exists) {
    throw new Error('Recording file not found on disk');
  }

  const base64Audio = await readAsStringAsync(payload.fileUri, {
    encoding: EncodingType.Base64,
  });

  if (!base64Audio) {
    throw new Error('Failed to read audio file for Qwen transcription');
  }

  const language = resolveQwenLanguage(settings);
  const asrOptions: Record<string, unknown> = {
    enable_lid: !language,
    enable_itn: false,
  };
  if (language) {
    asrOptions.language = language;
  }

  const audioMime = inferMimeType(payload.fileUri);
  const audioFormat = inferQwenAudioFormat(payload.fileUri);
  const audioDataUri = createDataUri(audioMime, base64Audio);

  const messages = [
    {
      role: 'system',
      content: [{ text: '' }],
    },
    {
      role: 'user',
      content: [
        {
          audio: audioDataUri,
          input_audio: {
            format: audioFormat,
            data: base64Audio,
          },
        },
      ],
    },
  ];

  const requestBody: Record<string, any> = {
    model: resolveTranscriptionModel(settings),
    input: { messages },
    parameters: {
      asr_options: asrOptions,
      result_format: 'message',
    },
  };

  const response = await fetch(DASHSCOPE_MULTIMODAL_ENDPOINT, {
    method: 'POST',
    headers: {
      Authorization: 'Bearer ' + apiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(requestBody),
    signal,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error('Qwen transcription failed: ' + (errorText || response.statusText));
  }

  let data: any;
  try {
    data = await response.json();
  } catch (error) {
    throw new Error('Qwen transcription failed: Invalid JSON response');
  }

  const { text: rawText, language: detectedLanguage } = extractTextFromQwenResponse(data);
  const resolvedText = rawText?.trim();
  if (!resolvedText) {
    throw new Error('Qwen transcription returned empty result');
  }

  return {
    text: resolvedText,
    language: language || detectedLanguage || undefined,
  };
}

function resolveAbortError(signal?: AbortSignal): Error {
  if (!signal) {
    return new Error('Operation aborted');
  }
  const reason = (signal as any)?.reason;
  if (reason instanceof Error) {
    return reason;
  }
  if (typeof reason === 'string' && reason) {
    return new Error(reason);
  }
  return new Error('Operation aborted');
}

function throwIfAborted(signal?: AbortSignal) {
  if (signal?.aborted) {
    throw resolveAbortError(signal);
  }
}

async function sleep(ms: number, signal?: AbortSignal) {
  if (ms <= 0) {
    throwIfAborted(signal);
    return;
  }
  await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    const onAbort = () => {
      clearTimeout(timer);
      signal?.removeEventListener('abort', onAbort);
      reject(resolveAbortError(signal));
    };
    if (signal) {
      if (signal.aborted) {
        clearTimeout(timer);
        reject(resolveAbortError(signal));
        return;
      }
      signal.addEventListener('abort', onAbort);
    }
  });
}

async function sonioxRequest(
  apiKey: string,
  path: string,
  options: RequestInit = {},
  signal?: AbortSignal
): Promise<Response> {
  throwIfAborted(signal);
  const headers: Record<string, string> = {
    Authorization: 'Bearer ' + apiKey,
  };
  if (options.headers) {
    const extra = options.headers as Record<string, string>;
    for (const key of Object.keys(extra)) {
      const value = extra[key];
      if (typeof value === 'string') {
        headers[key] = value;
      }
    }
  }

  const response = await fetch(SONIOX_API_BASE_URL + path, {
    ...options,
    headers,
    signal,
  });

  if (!response.ok) {
    let errorText: string | undefined;
    try {
      errorText = await response.text();
    } catch (error) {
      errorText = undefined;
    }
    throw new Error('Soniox request failed: ' + (errorText || response.statusText));
  }

  return response;
}

async function sonioxJsonRequest(
  apiKey: string,
  path: string,
  options: RequestInit = {},
  signal?: AbortSignal
) {
  const response = await sonioxRequest(apiKey, path, options, signal);
  const contentType = response.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    return response.json();
  }
  const text = await response.text();
  if (!text) {
    return {};
  }
  try {
    return JSON.parse(text);
  } catch (error) {
    return { raw: text };
  }
}

async function uploadSonioxFile(
  apiKey: string,
  fileUri: string,
  signal?: AbortSignal
): Promise<string> {
  const formData = new FormData();
  formData.append('file', {
    // @ts-ignore React Native FormData type
    uri: fileUri,
    name: inferFileName(fileUri),
    type: inferMimeType(fileUri),
  } as any);

  const data = await sonioxJsonRequest(
    apiKey,
    '/v1/files',
    {
      method: 'POST',
      body: formData as any,
    },
    signal
  );

  const fileId = typeof data?.id === 'string' ? data.id : undefined;
  if (!fileId) {
    throw new Error('Soniox upload failed: missing file id');
  }
  return fileId;
}

async function createSonioxTranscription(
  apiKey: string,
  config: Record<string, any>,
  signal?: AbortSignal
): Promise<string> {
  const data = await sonioxJsonRequest(
    apiKey,
    '/v1/transcriptions',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(config),
    },
    signal
  );

  const transcriptionId = typeof data?.id === 'string' ? data.id : undefined;
  if (!transcriptionId) {
    throw new Error('Soniox transcription creation failed: missing id');
  }
  return transcriptionId;
}

async function waitForSonioxTranscription(
  apiKey: string,
  transcriptionId: string,
  signal?: AbortSignal
): Promise<void> {
  while (true) {
    throwIfAborted(signal);
    const statusData = await sonioxJsonRequest(
      apiKey,
      `/v1/transcriptions/${transcriptionId}`,
      { method: 'GET' },
      signal
    );
    const status = typeof statusData?.status === 'string' ? statusData.status : '';
    if (status === 'completed') {
      return;
    }
    if (status === 'error') {
      const message =
        typeof statusData?.error_message === 'string' && statusData.error_message
          ? statusData.error_message
          : 'Unknown Soniox transcription error';
      throw new Error(message);
    }
    await sleep(SONIOX_POLL_INTERVAL_MS, signal).catch((error) => {
      throw error;
    });
  }
}

async function fetchSonioxTranscript(
  apiKey: string,
  transcriptionId: string,
  signal?: AbortSignal
) {
  return sonioxJsonRequest(
    apiKey,
    `/v1/transcriptions/${transcriptionId}/transcript`,
    { method: 'GET' },
    signal
  );
}

async function deleteSonioxResource(
  apiKey: string,
  path: string
) {
  try {
    await sonioxRequest(
      apiKey,
      path,
      {
        method: 'DELETE',
      }
    );
  } catch (error) {
    // Swallow cleanup errors to avoid masking primary failures.
  }
}

interface SonioxTranscriptExtraction {
  text?: string;
  language?: string;
}

function extractTextFromSonioxTranscript(data: any): SonioxTranscriptExtraction {
  if (!data) {
    return {};
  }

  if (typeof data.text === 'string' && data.text.trim()) {
    return {
      text: data.text.trim(),
      language: typeof data.language === 'string' ? data.language : undefined,
    };
  }

  const tokens: any[] = Array.isArray(data.tokens) ? data.tokens : [];
  if (tokens.length > 0) {
    let detectedLanguage: string | undefined;
    const parts: string[] = [];
    for (const token of tokens) {
      const text = typeof token?.text === 'string' ? token.text : '';
      if (text) {
        parts.push(text);
      }
      if (!detectedLanguage) {
        const language = token?.language;
        if (typeof language === 'number') {
          detectedLanguage = String(language);
        } else if (typeof language === 'string' && language.trim()) {
          detectedLanguage = language.trim();
        }
      }
    }
    const joined = parts.join('');
    if (joined.trim()) {
      return {
        text: joined.trim(),
        language: detectedLanguage,
      };
    }
  }

  if (Array.isArray(data.paragraphs)) {
    const paragraphs = data.paragraphs
      .map((item: any) => (typeof item?.text === 'string' ? item.text.trim() : ''))
      .filter(Boolean);
    if (paragraphs.length) {
      return {
        text: paragraphs.join('\n'),
        language: typeof data.language === 'string' ? data.language : undefined,
      };
    }
  }

  if (typeof data.transcript === 'string' && data.transcript.trim()) {
    return {
      text: data.transcript.trim(),
      language: typeof data.language === 'string' ? data.language : undefined,
    };
  }

  if (typeof data === 'string' && data.trim()) {
    return { text: data.trim() };
  }

  return {};
}

async function transcribeWithSoniox(
  payload: TranscriptionSegmentPayload,
  settings: AppSettings,
  signal?: AbortSignal
): Promise<SegmentedTranscriptionResult> {
  const apiKey = settings.credentials.sonioxApiKey?.trim();
  if (!apiKey) {
    throw new Error('Missing Soniox API key');
  }

  ensureFileExists(payload.fileUri);
  const info = await getInfoAsync(payload.fileUri);
  if (!info.exists) {
    throw new Error('Recording file not found on disk');
  }

  let fileId: string | undefined;
  let transcriptionId: string | undefined;

  try {
    fileId = await uploadSonioxFile(apiKey, payload.fileUri, signal);

    const config: Record<string, any> = {
      model: resolveTranscriptionModel(settings) || DEFAULT_SONIOX_TRANSCRIPTION_MODEL,
      file_id: fileId,
      enable_language_identification: true,
    };

    if (settings.transcriptionLanguage && settings.transcriptionLanguage !== 'auto') {
      config.language_hints = [settings.transcriptionLanguage];
    }

    config.client_reference_id = `segment-${payload.messageId}-${Date.now()}`;

    transcriptionId = await createSonioxTranscription(apiKey, config, signal);
    await waitForSonioxTranscription(apiKey, transcriptionId, signal);
    const transcript = await fetchSonioxTranscript(apiKey, transcriptionId, signal);

    const extracted = extractTextFromSonioxTranscript(transcript);
    if (!extracted.text) {
      throw new Error('Soniox transcription returned empty result');
    }

    const resolvedLanguage =
      settings.transcriptionLanguage && settings.transcriptionLanguage !== 'auto'
        ? settings.transcriptionLanguage
        : extracted.language;

    return {
      text: extracted.text,
      language: resolvedLanguage || undefined,
    };
  } finally {
    if (transcriptionId) {
      await deleteSonioxResource(apiKey, `/v1/transcriptions/${transcriptionId}`);
    }
    if (fileId) {
      await deleteSonioxResource(apiKey, `/v1/files/${fileId}`);
    }
  }
}

async function transcribeWithDoubao(
  payload: TranscriptionSegmentPayload,
  settings: AppSettings,
  signal?: AbortSignal
): Promise<SegmentedTranscriptionResult> {
  const appId = settings.credentials.doubaoAppId?.trim();
  const token = settings.credentials.doubaoToken?.trim();
  const cluster = settings.credentials.doubaoCluster?.trim();
  if (!appId || !token || !cluster) {
    throw new Error('Missing Doubao credentials (appid, token, or cluster)');
  }
  ensureFileExists(payload.fileUri);
  const info = await getInfoAsync(payload.fileUri);
  if (!info.exists) {
    throw new Error('Recording file not found on disk');
  }

  const base64Audio = await readAsStringAsync(payload.fileUri, { encoding: EncodingType.Base64 });
  if (!base64Audio) {
    throw new Error('Failed to read audio file for Doubao transcription');
  }
  const audioUrl = createDataUri(inferMimeType(payload.fileUri), base64Audio);

  const additions: Record<string, string> = {
    use_itn: 'True',
    use_punc: 'True',
  };
  if (settings.transcriptionLanguage && settings.transcriptionLanguage !== 'auto') {
    additions.language = settings.transcriptionLanguage;
  }

  const submitPayload = {
    app: {
      appid: appId,
      token,
      cluster,
    },
    user: {
      uid: 'voice-tt-client',
    },
    audio: {
      format: inferDoubaoAudioFormat(payload.fileUri),
      url: audioUrl,
    },
    additions,
  };

  const headers = {
    'Content-Type': 'application/json',
    Authorization: 'Bearer; ' + token,
  };

  const submitResponse = await fetch(DOUBAO_SUBMIT_URL, {
    method: 'POST',
    headers,
    body: JSON.stringify(submitPayload),
    signal,
  });

  if (!submitResponse.ok) {
    const errorText = await submitResponse.text();
    throw new Error('Doubao transcription submit failed: ' + (errorText || submitResponse.statusText));
  }

  let submitData: any;
  try {
    submitData = await submitResponse.json();
  } catch (error) {
    throw new Error('Doubao transcription submit failed: Invalid JSON response');
  }
  const submitResp = submitData?.resp || {};
  const submitCode = Number(submitResp.code ?? submitResp.Code);
  const taskId = typeof submitResp.id === 'string' ? submitResp.id : '';
  if (submitCode !== 1000 || !taskId) {
    const message = submitResp.message || submitResp.Message || 'Unknown submit error';
    throw new Error(`Doubao transcription submit failed: ${submitCode || 'n/a'} ${message}`);
  }

  let attempts = 0;
  while (attempts < DOUBAO_MAX_POLL_ATTEMPTS) {
    throwIfAborted(signal);
    if (attempts > 0) {
      await sleep(DOUBAO_POLL_INTERVAL_MS, signal);
    }
    attempts += 1;
    const queryPayload = {
      appid: appId,
      token,
      cluster,
      id: taskId,
    };
    const queryResponse = await fetch(DOUBAO_QUERY_URL, {
      method: 'POST',
      headers,
      body: JSON.stringify(queryPayload),
      signal,
    });
    if (!queryResponse.ok) {
      const errorText = await queryResponse.text();
      throw new Error('Doubao transcription query failed: ' + (errorText || queryResponse.statusText));
    }
    let queryData: any;
    try {
      queryData = await queryResponse.json();
    } catch (error) {
      continue;
    }
    const resp = queryData?.resp || {};
    const code = Number(resp.code ?? resp.Code);
    if (code === 1000) {
      let text = typeof resp.text === 'string' ? resp.text.trim() : '';
      if (!text && Array.isArray(resp.utterances)) {
        text = resp.utterances
          .map((item: any) => (typeof item?.text === 'string' ? item.text.trim() : ''))
          .filter(Boolean)
          .join(' ');
      }
      if (!text) {
        throw new Error('Doubao transcription returned empty result');
      }
      return {
        text,
        language: additions.language || undefined,
      };
    }
    if (code >= 2000 && code < 3000) {
      // task still pending
      continue;
    }
    const message = resp.message || resp.Message || 'Unknown Doubao transcription error';
    throw new Error(`Doubao transcription failed: ${code || 'n/a'} ${message}`);
  }

  throw new Error('Doubao transcription timed out waiting for result');
}

async function translateWithOpenAI(
  text: string,
  targetLanguage: string,
  settings: AppSettings,
  signal?: AbortSignal
): Promise<TranslationResult> {
  const apiKey = settings.credentials.openaiApiKey;
  if (!apiKey) {
    throw new Error('Missing OpenAI API key for translation');
  }
  const url = resolveOpenAIBaseUrl(settings) + '/v1/responses';

  const prompt =
    'You are a translation engine. Translate the user input into ' +
    targetLanguage +
    '. Respond with translation only.';

  const payload = {
    model: resolveTranslationModel(settings),
    instructions: prompt,
    input: [
      {
        role: 'user',
        content: [
          {
            type: 'input_text',
            text,
          },
        ],
      },
    ],
    temperature: 0,
    max_output_tokens: 1024,
    modalities: ['text'],
    response_format: {
      type: 'text',
    },
  };

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: 'Bearer ' + apiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
    signal,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error('OpenAI translation failed: ' + (errorText || response.statusText));
  }

  const data = await response.json();
  const outputBlocks = data?.output ?? data?.choices ?? [];
  let translated = '';
  if (Array.isArray(outputBlocks)) {
    for (const block of outputBlocks) {
      if (block?.content && Array.isArray(block.content)) {
        for (const item of block.content) {
          if (item?.type === 'output_text' && typeof item.text === 'string') {
            translated += item.text;
          }
          if (item?.type === 'text' && typeof item.text === 'string') {
            translated += item.text;
          }
        }
      }
      if (typeof block?.text === 'string') {
        translated += block.text;
      }
    }
  }
  if (!translated && typeof data?.output_text === 'string') {
    translated = data.output_text;
  }
  if (!translated && Array.isArray(data?.choices)) {
    translated = data.choices
      .map((choice: any) => {
        if (typeof choice?.text === 'string') {
          return choice.text;
        }
        if (Array.isArray(choice?.message?.content)) {
          return choice.message.content
            .map((item: any) => (typeof item?.text === 'string' ? item.text : ''))
            .join('');
        }
        if (typeof choice?.message?.content === 'string') {
          return choice.message.content;
        }
        return '';
      })
      .join('');
  }
  if (!translated && typeof data?.content === 'string') {
    translated = data.content;
  }

  return {
    text: translated.trim(),
  };
}

async function translateWithGemini(
  text: string,
  targetLanguage: string,
  settings: AppSettings,
  signal?: AbortSignal
): Promise<TranslationResult> {
  const apiKey = settings.credentials.geminiApiKey?.trim();
  if (!apiKey) {
    throw new Error('Missing Gemini API key for translation');
  }

  const model = resolveTranslationModel(settings);
  // Note: Gemini API requires key as URL parameter - avoid logging the full URL
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  const prompt =
    'You are a translation engine. Translate the user input into ' +
    targetLanguage +
    '. Respond with translation only.';

  const payloadJson = {
    contents: [
      {
        role: 'user',
        parts: [
          {
            text: `${prompt}\n\n${text}`,
          },
        ],
      },
    ],
    generationConfig: {
      temperature: 0,
      maxOutputTokens: 1024,
      topP: 0.9,
      topK: 40,
    },
  };

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payloadJson),
    signal,
  });

  if (!response.ok) {
    const errorText = await response.text();
    const safeError = errorText.replace(new RegExp(apiKey, 'g'), '[REDACTED]');
    throw new Error('Gemini translation failed: ' + (safeError || response.statusText));
  }

  const data = await response.json();
  const translated = collectGeminiText(data).trim();
  if (!translated) {
    throw new Error('Gemini translation returned empty response');
  }

  return { text: translated };
}

export async function transcribeSegment(
  payload: TranscriptionSegmentPayload,
  settings: AppSettings,
  signal?: AbortSignal
): Promise<SegmentedTranscriptionResult> {
  switch (settings.transcriptionEngine) {
    case 'openai':
      return transcribeWithOpenAI(payload, settings, signal);
    case 'gemini':
      return transcribeWithGemini(payload, settings, signal);
    case 'qwen3':
      return transcribeWithQwen(payload, settings, signal);
    case 'soniox':
      return transcribeWithSoniox(payload, settings, signal);
    case 'doubao':
      return transcribeWithDoubao(payload, settings, signal);
    case 'glm':
      return transcribeWithGlm(payload, settings, signal);
    default:
      throw new Error('Transcription engine ' + settings.transcriptionEngine + ' not implemented yet');
  }
}

export async function translateText(
  text: string,
  settings: AppSettings,
  signal?: AbortSignal
): Promise<TranslationResult> {
  if (!settings.enableTranslation) {
    return { text };
  }
  switch (settings.translationEngine) {
    case 'openai':
      return translateWithOpenAI(text, settings.translationTargetLanguage, settings, signal);
    case 'gemini':
      return translateWithGemini(text, settings.translationTargetLanguage, settings, signal);
    case 'none':
      return { text };
    default:
      throw new Error('Translation engine ' + settings.translationEngine + ' not implemented yet');
  }
}
function collectOpenAIText(data: any): string {
  const outputBlocks = data?.output ?? data?.choices ?? [];
  let collected = '';
  if (Array.isArray(outputBlocks)) {
    for (const block of outputBlocks) {
      if (Array.isArray(block?.content)) {
        for (const item of block.content) {
          if (item?.type === 'output_text' && typeof item.text === 'string') {
            collected += item.text;
          } else if (typeof item?.text === 'string') {
            collected += item.text;
          }
        }
      }
      if (typeof block?.text === 'string') {
        collected += block.text;
      }
    }
  }
  if (!collected && typeof data?.output_text === 'string') {
    collected = data.output_text;
  }
  if (!collected && Array.isArray(data?.choices)) {
    collected = data.choices
      .map((choice: any) => {
        if (typeof choice?.text === 'string') {
          return choice.text;
        }
        if (Array.isArray(choice?.message?.content)) {
          return choice.message.content
            .map((item: any) => (typeof item?.text === 'string' ? item.text : ''))
            .join('');
        }
        if (typeof choice?.message?.content === 'string') {
          return choice.message.content;
        }
        return '';
      })
      .join('');
  }
  if (!collected && Array.isArray(data?.candidates)) {
    for (const candidate of data.candidates) {
      const parts = candidate?.content?.parts ?? candidate?.parts;
      if (Array.isArray(parts)) {
        const combined = parts
          .map((part: any) => (typeof part?.text === 'string' ? part.text : ''))
          .join('');
        if (combined.trim()) {
          collected = combined.trim();
          break;
        }
      }
      if (typeof candidate?.text === 'string' && candidate.text.trim()) {
        collected = candidate.text.trim();
        break;
      }
    }
  }
  if (!collected && typeof data?.content === 'string') {
    collected = data.content;
  }
  return collected;
}

function cleanupTitleCandidate(raw: string): string {
  if (!raw) {
    return '';
  }
  const firstLine = raw.split(/[\r\n]+/)[0] ?? raw;
  const trimmed = firstLine.trim();
  const withoutQuotes = trimmed.replace(/^["'“”‘’]+/, '').replace(/["'“”‘’]+$/, '').trim();
  if (withoutQuotes.length > 80) {
    return withoutQuotes.slice(0, 80).trim();
  }
  return withoutQuotes;
}

function buildTitleInput(transcript: string, translation?: string): string {
  const parts: string[] = [];
  const transcriptText = transcript.trim();
  if (transcriptText) {
    parts.push('Transcript:\n' + transcriptText);
  }
  const translationText = translation?.trim();
  if (translationText) {
    parts.push('Translation:\n' + translationText);
  }
  const combined = parts.join('\n\n').trim();
  if (combined.length > MAX_TITLE_INPUT_CHARS) {
    return combined.slice(0, MAX_TITLE_INPUT_CHARS);
  }
  return combined;
}

function buildConversationSummaryInput(transcript: string, translation?: string): string {
  const parts: string[] = [];
  const transcriptText = transcript.trim();
  if (transcriptText) {
    parts.push('Transcript\\n' + transcriptText);
  }
  const translationText = translation?.trim();
  if (translationText) {
    parts.push('Translation\\n' + translationText);
  }
  const combined = parts.join('\\n\\n').trim();
  if (combined.length > MAX_CONVERSATION_INPUT_CHARS) {
    return combined.slice(0, MAX_CONVERSATION_INPUT_CHARS);
  }
  return combined;
}

async function generateTitleWithOpenAI(
  input: string,
  prompt: string,
  settings: AppSettings,
  signal?: AbortSignal
): Promise<string> {
  const apiKey = settings.credentials.openaiApiKey?.trim();
  if (!apiKey) {
    throw new Error('Missing OpenAI API key for title summarization');
  }
  const url = resolveOpenAIBaseUrl(settings) + '/v1/responses';
  const model = settings.credentials.openaiTitleModel?.trim() || DEFAULT_OPENAI_TITLE_MODEL;
  const payload = {
    model,
    instructions: prompt,
    input: [
      {
        role: 'user',
        content: [
          {
            type: 'input_text',
            text: input,
          },
        ],
      },
    ],
    temperature: DEFAULT_TITLE_RESPONSE_TEMPERATURE,
    max_output_tokens: DEFAULT_TITLE_RESPONSE_MAX_TOKENS,
    modalities: ['text'],
    response_format: {
      type: 'text',
    },
  };

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: 'Bearer ' + apiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
    signal,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error('OpenAI title generation failed: ' + (errorText || response.statusText));
  }

  const data = await response.json();
  const collected = collectOpenAIText(data).trim();
  if (!collected) {
    throw new Error('OpenAI title generation returned empty response');
  }
  return collected;
}

async function generateTitleWithGemini(
  input: string,
  prompt: string,
  settings: AppSettings,
  signal?: AbortSignal
): Promise<string> {
  const apiKey = settings.credentials.geminiApiKey?.trim();
  if (!apiKey) {
    throw new Error('Missing Gemini API key for title summarization');
  }
  const model = settings.credentials.geminiTitleModel?.trim() || DEFAULT_GEMINI_TITLE_MODEL;
  // Note: Gemini API requires key as URL parameter - avoid logging the full URL
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
  const payload = {
    contents: [
      {
        role: 'user',
        parts: [{ text: input }],
      },
    ],
    systemInstruction: {
      role: 'system',
      parts: [{ text: prompt }],
    },
    generationConfig: {
      temperature: DEFAULT_TITLE_RESPONSE_TEMPERATURE,
      maxOutputTokens: DEFAULT_TITLE_RESPONSE_MAX_TOKENS,
      topP: 0.95,
      topK: 40,
    },
  };

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
    signal,
  });

  if (!response.ok) {
    const errorText = await response.text();
    // Sanitize error to not expose API key
    const safeError = errorText.replace(new RegExp(apiKey, 'g'), '[REDACTED]');
    throw new Error('Gemini title generation failed: ' + (safeError || response.statusText));
  }

  const data = await response.json();
  let text = '';
  if (Array.isArray(data?.candidates)) {
    for (const candidate of data.candidates) {
      const parts = candidate?.content?.parts ?? candidate?.parts;
      if (Array.isArray(parts)) {
        const combined = parts
          .map((part: any) => (typeof part?.text === 'string' ? part.text : ''))
          .join('');
        if (combined.trim()) {
          text = combined.trim();
          break;
        }
      }
      if (typeof candidate?.text === 'string' && candidate.text.trim()) {
        text = candidate.text.trim();
        break;
      }
    }
  }
  if (!text && typeof data?.text === 'string') {
    text = data.text.trim();
  }
  if (!text) {
    throw new Error('Gemini title generation returned empty response');
  }
  return text;
}

export async function generateConversationTitle(
  transcript: string,
  translation: string | undefined,
  settings: AppSettings,
  signal?: AbortSignal
): Promise<string> {
  const input = buildTitleInput(transcript, translation);
  if (!input) {
    throw new Error('Conversation transcript is empty');
  }
  const prompt = (settings.titleSummaryPrompt || '').trim() || DEFAULT_TITLE_SUMMARY_PROMPT;
  const raw = settings.titleSummaryEngine === 'gemini'
    ? await generateTitleWithGemini(input, prompt, settings, signal)
    : await generateTitleWithOpenAI(input, prompt, settings, signal);
  const cleaned = cleanupTitleCandidate(raw);
  if (!cleaned) {
    throw new Error('Title summarization response was empty');
  }
  return cleaned;
}

async function generateConversationSummaryWithOpenAI(
  input: string,
  prompt: string,
  settings: AppSettings,
  signal?: AbortSignal
): Promise<string> {
  const apiKey = settings.credentials.openaiApiKey?.trim();
  if (!apiKey) {
    throw new Error('Missing OpenAI API key for conversation summarization');
  }
  const url = resolveOpenAIBaseUrl(settings) + '/v1/responses';
  const model =
    settings.credentials.openaiConversationModel?.trim() || DEFAULT_OPENAI_CONVERSATION_MODEL;
  const payload = {
    model,
    instructions: prompt,
    input: [
      {
        role: 'user',
        content: [
          {
            type: 'input_text',
            text: input,
          },
        ],
      },
    ],
    temperature: DEFAULT_CONVERSATION_RESPONSE_TEMPERATURE,
    max_output_tokens: DEFAULT_CONVERSATION_RESPONSE_MAX_TOKENS,
    modalities: ['text'],
    response_format: {
      type: 'text',
    },
  };

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: 'Bearer ' + apiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
    signal,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error('OpenAI conversation summarization failed: ' + (errorText || response.statusText));
  }

  const data = await response.json();
  const collected = collectOpenAIText(data).trim();
  if (!collected) {
    throw new Error('OpenAI conversation summarization returned empty response');
  }
  return collected;
}

async function generateConversationSummaryWithGemini(
  input: string,
  prompt: string,
  settings: AppSettings,
  signal?: AbortSignal
): Promise<string> {
  const apiKey = settings.credentials.geminiApiKey?.trim();
  if (!apiKey) {
    throw new Error('Missing Gemini API key for conversation summarization');
  }
  const model =
    settings.credentials.geminiConversationModel?.trim() || DEFAULT_GEMINI_CONVERSATION_MODEL;
  // Note: Gemini API requires key as URL parameter - avoid logging the full URL
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
  const payload = {
    contents: [
      {
        role: 'user',
        parts: [{ text: input }],
      },
    ],
    systemInstruction: {
      role: 'system',
      parts: [{ text: prompt }],
    },
    generationConfig: {
      temperature: DEFAULT_CONVERSATION_RESPONSE_TEMPERATURE,
      maxOutputTokens: DEFAULT_CONVERSATION_RESPONSE_MAX_TOKENS,
      topP: 0.95,
      topK: 40,
    },
  };

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
    signal,
  });

  if (!response.ok) {
    const errorText = await response.text();
    // Sanitize error to not expose API key
    const safeError = errorText.replace(new RegExp(apiKey, 'g'), '[REDACTED]');
    throw new Error('Gemini conversation summarization failed: ' + (safeError || response.statusText));
  }

  const data = await response.json();
  const text = collectGeminiText(data).trim();
  if (!text) {
    throw new Error('Gemini conversation summarization returned empty response');
  }
  return text;
}

export async function generateConversationSummary(
  transcript: string,
  translation: string | undefined,
  settings: AppSettings,
  signal?: AbortSignal
): Promise<string> {
  const input = buildConversationSummaryInput(transcript, translation);
  if (!input) {
    throw new Error('Conversation transcript is empty');
  }
  const prompt =
    (settings.conversationSummaryPrompt || '').trim() || DEFAULT_CONVERSATION_SUMMARY_PROMPT;
  const raw =
    settings.conversationSummaryEngine === 'gemini'
      ? await generateConversationSummaryWithGemini(input, prompt, settings, signal)
      : await generateConversationSummaryWithOpenAI(input, prompt, settings, signal);
  const cleaned = raw.trim();
  if (!cleaned) {
    throw new Error('Conversation summarization response was empty');
  }
  return cleaned;
}

export interface AssistantConversationTurn {
  role: 'user' | 'assistant';
  content: string;
}

export interface GenerateAssistantReplyOptions {
  transcript: string;
  translation?: string;
  summary?: string;
  history: AssistantConversationTurn[];
  userMessage: string;
  settings: AppSettings;
  signal?: AbortSignal;
}

interface AssistantReplyParams {
  instructions: string;
  history: AssistantConversationTurn[];
  userMessage: string;
  settings: AppSettings;
  signal?: AbortSignal;
}

function clampTail(text: string, limit: number): string {
  if (!text || limit <= 0) {
    return '';
  }
  if (text.length <= limit) {
    return text;
  }
  return text.slice(text.length - limit);
}

function buildAssistantContext(
  summary: string | undefined,
  transcript: string,
  translation?: string
): string {
  let remaining = MAX_ASSISTANT_CONTEXT_CHARS;
  const segments: string[] = [];
  const trimmedSummary = summary?.trim();
  if (trimmedSummary && remaining > 0) {
    const label = 'Summary:\n';
    const available = Math.max(0, remaining - label.length);
    if (available > 0) {
      const content = clampTail(
        trimmedSummary,
        Math.min(available, MAX_ASSISTANT_SUMMARY_CHARS)
      );
      if (content) {
        segments.push(label + content);
        remaining -= label.length + content.length;
      }
    }
  }

  const trimmedTranslation = translation?.trim();
  if (trimmedTranslation && remaining > 0) {
    const label = 'Translation:\n';
    const available = Math.max(0, remaining - label.length);
    if (available > 0) {
      const content = clampTail(
        trimmedTranslation,
        Math.min(available, MAX_ASSISTANT_TRANSLATION_CHARS)
      );
      if (content) {
        segments.push(label + content);
        remaining -= label.length + content.length;
      }
    }
  }

  const trimmedTranscript = transcript.trim();
  if (trimmedTranscript && remaining > 0) {
    const label = 'Transcript:\n';
    const available = Math.max(0, remaining - label.length);
    if (available > 0) {
      const content = clampTail(
        trimmedTranscript,
        Math.min(available, MAX_ASSISTANT_TRANSCRIPT_CHARS)
      );
      if (content) {
        segments.push(label + content);
        remaining -= label.length + content.length;
      }
    }
  }

  return segments.join('\n\n').trim();
}

async function generateAssistantReplyWithOpenAI({
  instructions,
  history,
  userMessage,
  settings,
  signal,
}: AssistantReplyParams): Promise<string> {
  const apiKey = settings.credentials.openaiApiKey?.trim();
  if (!apiKey) {
    throw new Error('Missing OpenAI API key for conversation assistant');
  }
  const url = resolveOpenAIBaseUrl(settings) + '/v1/responses';
  const model =
    settings.credentials.openaiConversationModel?.trim() || DEFAULT_OPENAI_CONVERSATION_MODEL;
  const payload = {
    model,
    instructions,
    input: [
      ...history.map((message) => ({
        role: message.role,
        content: [
          {
            type: 'input_text',
            text: message.content,
          },
        ],
      })),
      {
        role: 'user',
        content: [
          {
            type: 'input_text',
            text: userMessage,
          },
        ],
      },
    ],
    temperature: DEFAULT_ASSISTANT_RESPONSE_TEMPERATURE,
    max_output_tokens: DEFAULT_ASSISTANT_RESPONSE_MAX_TOKENS,
    modalities: ['text'],
    response_format: { type: 'text' },
  };

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: 'Bearer ' + apiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
    signal,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error('OpenAI conversation assistant failed: ' + (errorText || response.statusText));
  }

  const data = await response.json();
  const text = collectOpenAIText(data).trim();
  if (!text) {
    throw new Error('OpenAI conversation assistant returned empty response');
  }
  return text;
}

async function generateAssistantReplyWithGemini({
  instructions,
  history,
  userMessage,
  settings,
  signal,
}: AssistantReplyParams): Promise<string> {
  const apiKey = settings.credentials.geminiApiKey?.trim();
  if (!apiKey) {
    throw new Error('Missing Gemini API key for conversation assistant');
  }
  const model =
    settings.credentials.geminiConversationModel?.trim() || DEFAULT_GEMINI_CONVERSATION_MODEL;
  // Note: Gemini API requires key as URL parameter - avoid logging the full URL
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
  const contents = history.map((message) => ({
    role: message.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: message.content }],
  }));
  contents.push({ role: 'user', parts: [{ text: userMessage }] });
  const payload = {
    contents,
    systemInstruction: {
      role: 'system',
      parts: [{ text: instructions }],
    },
    generationConfig: {
      temperature: DEFAULT_ASSISTANT_RESPONSE_TEMPERATURE,
      maxOutputTokens: DEFAULT_ASSISTANT_RESPONSE_MAX_TOKENS,
      topP: 0.95,
      topK: 40,
    },
  };

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
    signal,
  });

  if (!response.ok) {
    const errorText = await response.text();
    // Sanitize error to not expose API key
    const safeError = errorText.replace(new RegExp(apiKey, 'g'), '[REDACTED]');
    throw new Error('Gemini conversation assistant failed: ' + (safeError || response.statusText));
  }

  const data = await response.json();
  const text = collectGeminiText(data).trim();
  if (!text) {
    throw new Error('Gemini conversation assistant returned empty response');
  }
  return text;
}

export async function generateAssistantReply({
  transcript,
  translation,
  summary,
  history,
  userMessage,
  settings,
  signal,
}: GenerateAssistantReplyOptions): Promise<string> {
  const trimmedMessage = userMessage.trim();
  if (!trimmedMessage) {
    throw new Error('Assistant prompt is empty');
  }

  const context = buildAssistantContext(summary, transcript, translation);
  const sanitizedHistory = history
    .filter((item) => item && (item.role === 'user' || item.role === 'assistant'))
    .map((item) => ({
      role: item.role,
      content: (item.content ?? '').trim(),
    }))
    .filter((item) => item.content.length > 0)
    .slice(-MAX_ASSISTANT_HISTORY_MESSAGES);

  const instructionsParts = [
    'You are a helpful conversation assistant who answers follow-up questions using the provided meeting context.',
    'Ground responses in the transcript and avoid inventing details. If the answer is unknown, say you do not know.',
    'Respond in the same language as the user whenever possible.',
    'You can use Markdown formatting to structure your responses with headings, lists, code blocks, and emphasis where appropriate.',
  ];
  if (context) {
    instructionsParts.push('Conversation context:\n' + context);
  }
  const instructions = instructionsParts.join('\n\n').trim();

  const params: AssistantReplyParams = {
    instructions,
    history: sanitizedHistory,
    userMessage: trimmedMessage,
    settings,
    signal,
  };

  if (settings.conversationSummaryEngine === 'gemini') {
    return generateAssistantReplyWithGemini(params);
  }
  return generateAssistantReplyWithOpenAI(params);
}
