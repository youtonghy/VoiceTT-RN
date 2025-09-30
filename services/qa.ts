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

const DEFAULT_QA_RESPONSE_TEMPERATURE = 0.1;
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
    if (__DEV__) {
      console.log('[qa] parseQaResponseText: empty text input');
    }
    return [];
  }
  const trimmed = text.trim();

  if (__DEV__) {
    console.log('[qa] parseQaResponseText: processing text:', trimmed);
  }

  // First attempt: parse as JSON
  try {
    const parsed = JSON.parse(trimmed);
    const items = sanitizeQaItems(parsed);
    if (items.length > 0) {
      if (__DEV__) {
        console.log('[qa] Successfully parsed JSON, found items:', items);
      }
      return items;
    }
  } catch (error) {
    if (__DEV__) {
      console.warn('[qa] Failed to parse JSON response, attempting fallback', error);
    }
  }

  // Second attempt: look for JSON-like structure within the text
  const jsonMatch = trimmed.match(/\{[\s\S]*?\}/);
  if (jsonMatch) {
    try {
      const jsonText = jsonMatch[0];
      const parsed = JSON.parse(jsonText);
      const items = sanitizeQaItems(parsed);
      if (items.length > 0) {
        return items;
      }
    } catch (error) {
      if (__DEV__) {
        console.warn('[qa] Failed to parse embedded JSON, continuing with fallback', error);
      }
    }
  }

  // Additional attempt: try to extract JSON from content field if it exists
  try {
    const contentMatch = trimmed.match(/"content"\s*:\s*"([^"]+)"/);
    if (contentMatch && contentMatch[1]) {
      const contentText = contentMatch[1].replace(/\\"/g, '"');
      const parsed = JSON.parse(contentText);
      const items = sanitizeQaItems(parsed);
      if (items.length > 0) {
        return items;
      }
    }
  } catch (error) {
    if (__DEV__) {
      console.warn('[qa] Failed to parse content field JSON', error);
    }
  }

  // Third attempt: extract structured Q&A pairs
  const fallbackItems: TranscriptQaItem[] = [];

  // Try to find question-answer pairs in various formats
  const qaPatterns = [
    // JSON-like format without proper structure
    /"question"\s*[:：]\s*"([^"]+)"\s*[,，]?\s*"answer"\s*[:：]\s*"([^"]+)"/g,
    // JSON-like format with single quotes
    /'question'\s*[:：]\s*'([^']+)'\s*[,，]?\s*'answer'\s*[:：]\s*'([^']+)'/g,
    // JSON-like format without quotes
    /question\s*[:：]\s*([^,\n]+?)\s*[,，]?\s*answer\s*[:：]\s*([^,\n]+?)(?=\s*[,，\n]|$)/gi,
    // Markdown-style Q&A
    /(?:Q|问题|Question)[:：]?\s*(.+?)\s*(?:A|答案|Answer)[:：]?\s*(.+?)(?=\n|$)/gi,
    // Numbered Q&A
    /(?:\d+\.\s*)?(.+?)\?\s*(.+?)(?=\n|$)/gi,
  ];

  for (const pattern of qaPatterns) {
    const matches = [...trimmed.matchAll(pattern)];
    for (const match of matches) {
      const question = match[1]?.trim();
      const answer = match[2]?.trim();
      if (question && answer && !question.includes('{') && !answer.includes('{')) {
        fallbackItems.push({ question, answer });
      }
    }
    if (fallbackItems.length > 0) break;
  }

  // Fourth fallback: if no structured Q&A found, extract sentences ending with ? as questions
  if (fallbackItems.length === 0) {
    const questionRegex = /[^.!?]*\?/g;
    const questions = trimmed.match(questionRegex);
    if (questions && questions.length > 0) {
      questions.forEach((question) => {
        const cleanQuestion = question.trim();
        if (cleanQuestion && cleanQuestion.length > 5) { // Ensure it's a meaningful question
          fallbackItems.push({
            question: cleanQuestion,
            answer: '无问题'  // Default answer when only question is extracted
          });
        }
      });
    }
  }

  if (__DEV__) {
    console.log('[qa] Final parsed items:', fallbackItems);
  }

  return fallbackItems;
}

function collectOpenAIText(data: any): string {
  if (!data) {
    return '';
  }

  // Handle standard chat completions response format
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

  // Handle legacy responses format
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

  return '';
}

async function extractWithOpenAI({ transcript, settings, signal }: ExtractTranscriptQuestionsOptions): Promise<TranscriptQaItem[]> {
  const apiKey = settings.credentials.openaiApiKey?.trim();
  if (!apiKey) {
    throw new Error('Missing OpenAI API key for Q&A extraction');
  }
  const model = settings.credentials.openaiQaModel?.trim() || DEFAULT_OPENAI_QA_MODEL;
  const prompt = (settings.qaPrompt || '').trim() || DEFAULT_QA_PROMPT;
  const url = `${resolveOpenAIBaseUrl(settings)}/v1/chat/completions`;
  const payload = {
    model,
    messages: [
      {
        role: 'system',
        content: prompt,
      },
      {
        role: 'user',
        content: `Transcript segment:\n${transcript.trim()}`,
      },
    ],
    temperature: DEFAULT_QA_RESPONSE_TEMPERATURE,
    max_tokens: MAX_QA_OUTPUT_TOKENS,
    response_format: {
      type: 'json_object',
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

  if (__DEV__) {
    console.log('[qa] OpenAI response data:', data);
    console.log('[qa] Extracted text:', text);
  }

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
      topP: 0.9,
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
