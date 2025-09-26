import { Platform } from 'react-native';
import { EncodingType, getInfoAsync, readAsStringAsync } from 'expo-file-system/legacy';

import { AppSettings } from '@/types/settings';
import { SegmentedTranscriptionResult, TranslationResult } from '@/types/transcription';

export const DEFAULT_OPENAI_BASE_URL = 'https://api.openai.com';
export const DEFAULT_OPENAI_TRANSCRIPTION_MODEL = 'gpt-4o-transcribe';
export const DEFAULT_OPENAI_TRANSLATION_MODEL = 'gpt-4o-mini';
export const DEFAULT_GEMINI_TRANSLATION_MODEL = 'gemini-2.5-flash';
export const DEFAULT_QWEN_TRANSCRIPTION_MODEL = 'qwen3-asr-flash';
const DASHSCOPE_MULTIMODAL_ENDPOINT =
  'https://dashscope.aliyuncs.com/api/v1/services/aigc/multimodal-generation/generation';

function resolveOpenAIBaseUrl(settings: AppSettings) {
  return (settings.credentials.openaiBaseUrl || DEFAULT_OPENAI_BASE_URL).replace(/\/$/, '');
}

export function resolveTranscriptionModel(settings: AppSettings): string {
  switch (settings.transcriptionEngine) {
    case 'openai':
      return (
        settings.credentials.openaiTranscriptionModel?.trim() || DEFAULT_OPENAI_TRANSCRIPTION_MODEL
      );
    case 'qwen3':
      return settings.credentials.qwenTranscriptionModel?.trim() || DEFAULT_QWEN_TRANSCRIPTION_MODEL;
    case 'soniox':
      return 'default';
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

export async function transcribeSegment(
  payload: TranscriptionSegmentPayload,
  settings: AppSettings,
  signal?: AbortSignal
): Promise<SegmentedTranscriptionResult> {
  switch (settings.transcriptionEngine) {
    case 'openai':
      return transcribeWithOpenAI(payload, settings, signal);
    case 'qwen3':
      return transcribeWithQwen(payload, settings, signal);
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
    case 'none':
      return { text };
    default:
      throw new Error('Translation engine ' + settings.translationEngine + ' not implemented yet');
  }
}
