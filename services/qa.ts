import { AppSettings, DEFAULT_GEMINI_QA_MODEL, DEFAULT_OPENAI_QA_MODEL, DEFAULT_QA_PROMPT } from '@/types/settings';
import { DEFAULT_OPENAI_BASE_URL } from '@/services/transcription';

export interface TranscriptQaItem {
  question: string;
  answer: string;
}

export interface ExtractTranscriptQuestionsOptions {
  transcript: string;
  settings: AppSettings;
  signal?: AbortSignal;
}

const DEFAULT_QA_RESPONSE_TEMPERATURE = 0.25;
const MAX_QA_OUTPUT_TOKENS = 512;

function resolveOpenAIBaseUrl(settings: AppSettings): string {
  const baseUrl = settings.credentials.openaiBaseUrl || DEFAULT_OPENAI_BASE_URL;
  return baseUrl.replace(/\/$/, '');
}

function sanitizeQaItems(raw: unknown): TranscriptQaItem[] {
  if (!raw || typeof raw !== 'object') {
    return [];
  }
  const container = raw as { items?: unknown };
  if (!Array.isArray(container.items)) {
    return [];
  }
  const items: TranscriptQaItem[] = [];
  container.items.forEach((entry) => {
    if (!entry || typeof entry !== 'object') {
      return;
    }
    const candidate = entry as Partial<TranscriptQaItem> & { question?: unknown; answer?: unknown };
    const question = typeof candidate.question === 'string' ? candidate.question.trim() : '';
    const answer = typeof candidate.answer === 'string' ? candidate.answer.trim() : '';
    if (question && answer) {
      items.push({ question, answer });
    }
  });
  return items;
}

function parseQaResponseText(text: string): TranscriptQaItem[] {
  if (!text) {
    return [];
  }
  const trimmed = text.trim();
  try {
    const parsed = JSON.parse(trimmed);
    return sanitizeQaItems(parsed);
  } catch (error) {
    if (__DEV__) {
      console.warn('[qa] Failed to parse JSON response, attempting fallback', error);
    }
  }
  // Fallback: attempt to extract simple question/answer pairs split by newline
  const fallbackItems: TranscriptQaItem[] = [];
  const lines = trimmed.split(/\n+/).map((line) => line.trim()).filter(Boolean);
  lines.forEach((line) => {
    const match = line.match(/^(?:[-*]\s*)?(?:Q[:：]\s*)?(.+?)(?:\s*[—-]|\s*A[:：])\s*(.+)$/i);
    if (match) {
      const question = match[1].trim();
      const answer = match[2].trim();
      if (question && answer) {
        fallbackItems.push({ question, answer });
      }
    }
  });
  return fallbackItems;
}

function collectOpenAIText(data: any): string {
  if (!data) {
    return '';
  }
  if (typeof data.output_text === 'string') {
    return data.output_text;
  }
  if (Array.isArray(data.output_text)) {
    return data.output_text.join('\n');
  }
  if (Array.isArray(data.output)) {
    return data.output
      .map((item: any) => {
        if (!item) {
          return '';
        }
        if (typeof item.content === 'string') {
          return item.content;
        }
        if (Array.isArray(item.content)) {
          return item.content
            .map((content: any) => {
              if (typeof content === 'string') {
                return content;
              }
              if (content && typeof content.text === 'string') {
                return content.text;
              }
              return '';
            })
            .filter(Boolean)
            .join('\n');
        }
        if (typeof item.text === 'string') {
          return item.text;
        }
        return '';
      })
      .filter(Boolean)
      .join('\n');
  }
  if (Array.isArray(data.choices)) {
    return data.choices
      .map((choice: any) => {
        const message = choice?.message;
        if (typeof message?.content === 'string') {
          return message.content;
        }
        if (Array.isArray(message?.content)) {
          return message.content
            .map((inner: any) => (typeof inner?.text === 'string' ? inner.text : ''))
            .filter(Boolean)
            .join('\n');
        }
        const text = choice?.text;
        return typeof text === 'string' ? text : '';
      })
      .filter(Boolean)
      .join('\n');
  }
  return '';
}

async function extractWithOpenAI({ transcript, settings, signal }: ExtractTranscriptQuestionsOptions): Promise<TranscriptQaItem[]> {
  const apiKey = settings.credentials.openaiApiKey?.trim();
  if (!apiKey) {
    throw new Error('Missing OpenAI API key for Q&A extraction');
  }
  const model = settings.credentials.openaiQaModel?.trim() || DEFAULT_OPENAI_QA_MODEL;
  const prompt = (settings.qaPrompt || '').trim() || DEFAULT_QA_PROMPT;
  const url = `${resolveOpenAIBaseUrl(settings)}/v1/responses`;
  const payload = {
    model,
    input: [
      {
        role: 'system',
        content: [{ type: 'input_text', text: prompt }],
      },
      {
        role: 'user',
        content: [
          {
            type: 'input_text',
            text: `Transcript segment:\n${transcript.trim()}`,
          },
        ],
      },
    ],
    temperature: DEFAULT_QA_RESPONSE_TEMPERATURE,
    max_output_tokens: MAX_QA_OUTPUT_TOKENS,
    response_format: {
      type: 'json_schema',
      json_schema: {
        name: 'transcript_questions',
        schema: {
          type: 'object',
          additionalProperties: false,
          properties: {
            items: {
              type: 'array',
              items: {
                type: 'object',
                additionalProperties: false,
                required: ['question', 'answer'],
                properties: {
                  question: { type: 'string' },
                  answer: { type: 'string' },
                },
              },
            },
          },
          required: ['items'],
        },
      },
    },
  };

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
    signal,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error('OpenAI Q&A extraction failed: ' + (errorText || response.statusText));
  }

  const data = await response.json();
  const text = collectOpenAIText(data).trim();
  return parseQaResponseText(text);
}

function collectGeminiText(data: any): string {
  if (!data) {
    return '';
  }
  const candidates = data.candidates;
  if (Array.isArray(candidates)) {
    for (const candidate of candidates) {
      const content = candidate?.content;
      if (Array.isArray(content?.parts)) {
        const combined = content.parts
          .map((part: any) => (typeof part?.text === 'string' ? part.text : ''))
          .filter(Boolean)
          .join('\n');
        if (combined) {
          return combined;
        }
      }
      const text = candidate?.text;
      if (typeof text === 'string' && text.trim()) {
        return text.trim();
      }
    }
  }
  if (typeof data.output_text === 'string') {
    return data.output_text;
  }
  return '';
}

async function extractWithGemini({ transcript, settings, signal }: ExtractTranscriptQuestionsOptions): Promise<TranscriptQaItem[]> {
  const apiKey = settings.credentials.geminiApiKey?.trim();
  if (!apiKey) {
    throw new Error('Missing Gemini API key for Q&A extraction');
  }
  const model = settings.credentials.geminiQaModel?.trim() || DEFAULT_GEMINI_QA_MODEL;
  const prompt = (settings.qaPrompt || '').trim() || DEFAULT_QA_PROMPT;
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
  const payload = {
    contents: [
      {
        role: 'user',
        parts: [
          {
            text: `${prompt}\n\nTranscript segment:\n${transcript.trim()}`,
          },
        ],
      },
    ],
    generationConfig: {
      temperature: DEFAULT_QA_RESPONSE_TEMPERATURE,
      maxOutputTokens: MAX_QA_OUTPUT_TOKENS,
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
    throw new Error('Gemini Q&A extraction failed: ' + (errorText || response.statusText));
  }

  const data = await response.json();
  const text = collectGeminiText(data).trim();
  return parseQaResponseText(text);
}

export async function extractTranscriptQuestions(options: ExtractTranscriptQuestionsOptions): Promise<TranscriptQaItem[]> {
  const transcript = options.transcript.trim();
  if (!transcript) {
    return [];
  }
  if (options.settings.qaEngine === 'gemini') {
    return extractWithGemini(options);
  }
  return extractWithOpenAI(options);
}
