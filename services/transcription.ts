import { Platform } from 'react-native';
import { getInfoAsync } from 'expo-file-system/legacy';

import { AppSettings } from '@/types/settings';
import { SegmentedTranscriptionResult, TranslationResult } from '@/types/transcription';

const DEFAULT_OPENAI_BASE_URL = 'https://api.openai.com';

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

  const baseUrl = (settings.credentials.openaiBaseUrl || DEFAULT_OPENAI_BASE_URL).replace(/\/$/, '');
  const url = baseUrl + '/v1/audio/transcriptions';

  const formData = new FormData();
  formData.append('file', {
    // @ts-ignore FormData typing does not include uri on web
    uri: payload.fileUri,
    name: inferFileName(payload.fileUri),
    type: inferMimeType(payload.fileUri),
  } as any);
  formData.append('model', settings.transcriptionModel);
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
  const baseUrl = (settings.credentials.openaiBaseUrl || DEFAULT_OPENAI_BASE_URL).replace(/\/$/, '');
  const url = baseUrl + '/v1/responses';

  const prompt =
    'You are a translation engine. Translate the user input into ' +
    targetLanguage +
    '. Respond with translation only.';

  const payload = {
    model: settings.translationModel,
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
