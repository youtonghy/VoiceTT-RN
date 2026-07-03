import {
  DEFAULT_GEMINI_TRANSCRIPTION_MODEL,
  DEFAULT_GEMINI_TRANSLATION_MODEL,
  DEFAULT_GLM_TRANSCRIPTION_MODEL,
  DEFAULT_OPENAI_BASE_URL,
  DEFAULT_OPENAI_REALTIME_TRANSCRIPTION_MODEL,
  DEFAULT_OPENAI_TRANSCRIPTION_MODEL,
  DEFAULT_OPENAI_TRANSLATION_MODEL,
  DEFAULT_QWEN_TRANSCRIPTION_MODEL,
} from '@/services/transcription';
import {
  DEFAULT_GEMINI_ASSISTANT_MODEL,
  DEFAULT_GEMINI_CONVERSATION_MODEL,
  DEFAULT_GEMINI_TITLE_MODEL,
  DEFAULT_GEMINI_TTS_MODEL,
  DEFAULT_OPENAI_ASSISTANT_MODEL,
  DEFAULT_OPENAI_CONVERSATION_MODEL,
  DEFAULT_OPENAI_TITLE_MODEL,
  DEFAULT_OPENAI_TTS_MODEL,
} from '@/types/settings';

export type ModelCatalogProvider = 'openai' | 'gemini' | 'qwen' | 'glm';
export type RemoteModelCatalogProvider = 'openai' | 'gemini';

export type ModelOption = {
  label: string;
  value: string;
};

export type FetchProviderModelsOptions = {
  provider: RemoteModelCatalogProvider;
  apiKey?: string;
  baseUrl?: string;
  signal?: AbortSignal;
};

type OpenAIListModelsResponse = {
  data?: { id?: unknown }[];
  models?: { id?: unknown; name?: unknown }[];
};

export const DEFAULT_OPENAI_MODEL_OPTIONS = uniqueModelOptions([
  DEFAULT_OPENAI_TRANSCRIPTION_MODEL,
  DEFAULT_OPENAI_REALTIME_TRANSCRIPTION_MODEL,
  DEFAULT_OPENAI_TRANSLATION_MODEL,
  DEFAULT_OPENAI_TTS_MODEL,
  DEFAULT_OPENAI_TITLE_MODEL,
  DEFAULT_OPENAI_CONVERSATION_MODEL,
  DEFAULT_OPENAI_ASSISTANT_MODEL,
  'gpt-4.1',
  'gpt-4.1-mini',
  'gpt-4o',
  'gpt-4o-mini',
]);

export const DEFAULT_GEMINI_MODEL_OPTIONS = uniqueModelOptions([
  DEFAULT_GEMINI_TRANSCRIPTION_MODEL,
  DEFAULT_GEMINI_TRANSLATION_MODEL,
  DEFAULT_GEMINI_TTS_MODEL,
  DEFAULT_GEMINI_TITLE_MODEL,
  DEFAULT_GEMINI_CONVERSATION_MODEL,
  DEFAULT_GEMINI_ASSISTANT_MODEL,
  'gemini-3-flash-preview',
  'gemini-2.5-pro',
  'gemini-2.5-flash-lite',
]);

export const DEFAULT_QWEN_MODEL_OPTIONS = uniqueModelOptions([
  DEFAULT_QWEN_TRANSCRIPTION_MODEL,
  'qwen3-asr-flash-realtime',
  'qwen-audio-asr',
]);

export const DEFAULT_GLM_MODEL_OPTIONS = uniqueModelOptions([
  DEFAULT_GLM_TRANSCRIPTION_MODEL,
  'glm-asr',
]);

export function getFallbackModelOptions(provider: ModelCatalogProvider): ModelOption[] {
  switch (provider) {
    case 'openai':
      return DEFAULT_OPENAI_MODEL_OPTIONS;
    case 'gemini':
      return DEFAULT_GEMINI_MODEL_OPTIONS;
    case 'qwen':
      return DEFAULT_QWEN_MODEL_OPTIONS;
    case 'glm':
      return DEFAULT_GLM_MODEL_OPTIONS;
    default:
      return [];
  }
}

export function mergeModelOptions(...groups: (ModelOption[] | string[] | undefined)[]) {
  const values: string[] = [];
  for (const group of groups) {
    if (!group) {
      continue;
    }
    for (const item of group) {
      const value = typeof item === 'string' ? item : item.value;
      if (value?.trim()) {
        values.push(value.trim());
      }
    }
  }
  return uniqueModelOptions(values);
}

export async function fetchProviderModels({
  provider,
  apiKey,
  baseUrl,
  signal,
}: FetchProviderModelsOptions): Promise<ModelOption[]> {
  const token = apiKey?.trim();
  if (!token) {
    throw new Error('missing_api_key');
  }

  const url =
    provider === 'gemini'
      ? 'https://generativelanguage.googleapis.com/v1beta/openai/models'
      : resolveOpenAICompatibleModelsUrl(baseUrl || DEFAULT_OPENAI_BASE_URL);

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json',
    },
    signal,
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(body || response.statusText || 'model_fetch_failed');
  }

  const data = (await response.json()) as OpenAIListModelsResponse;
  const ids = [
    ...(Array.isArray(data.data) ? data.data.map((item) => item.id) : []),
    ...(Array.isArray(data.models)
      ? data.models.map((item) => (typeof item.id === 'string' ? item.id : item.name))
      : []),
  ]
    .filter((id): id is string => typeof id === 'string' && id.trim().length > 0)
    .map((id) => id.replace(/^models\//, '').trim());

  return uniqueModelOptions(ids);
}

export function resolveOpenAICompatibleModelsUrl(input: string): string {
  const trimmed = input.trim().replace(/\/+$/, '') || DEFAULT_OPENAI_BASE_URL;
  if (/\/models$/i.test(trimmed)) {
    return trimmed;
  }
  if (/\/v\d+(?:beta)?$/i.test(trimmed)) {
    return `${trimmed}/models`;
  }
  return `${trimmed}/v1/models`;
}

function uniqueModelOptions(values: string[]) {
  const seen = new Set<string>();
  return values
    .map((value) => value.trim())
    .filter(Boolean)
    .filter((value) => {
      const key = value.toLowerCase();
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    })
    .sort((a, b) => a.localeCompare(b))
    .map((value) => ({ label: value, value }));
}
