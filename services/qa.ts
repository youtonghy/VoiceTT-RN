import { AppSettings, DEFAULT_GEMINI_QA_MODEL, DEFAULT_OPENAI_QA_MODEL, DEFAULT_QA_PROMPT } from '@/types/settings';
import { DEFAULT_OPENAI_BASE_URL } from '@/services/transcription';
import { TranscriptQaItem } from '@/types/transcription';

export interface ExtractTranscriptQuestionsOptions {
  transcript: string;
  settings: AppSettings;
  signal?: AbortSignal;
  contextTranscript?: string;
}

const DEFAULT_QA_RESPONSE_TEMPERATURE = 0.1;
const MAX_QA_OUTPUT_TOKENS = 512;
const MAX_QUESTION_EXTRACTION_TOKENS = 256;
const MAX_ANSWER_TOKENS = 384;

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
            answer: 'No answer available', // Default answer when only question is extracted
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

async function extractQuestionsWithOpenAI(transcript: string, settings: AppSettings, signal?: AbortSignal): Promise<string[]> {
  const apiKey = settings.credentials.openaiApiKey?.trim();
  if (!apiKey) {
    throw new Error('Missing OpenAI API key for Q&A extraction');
  }
  const model = settings.credentials.openaiQaModel?.trim() || DEFAULT_OPENAI_QA_MODEL;
  const prompt = 'You are a real-time call assistant. Given a recent transcript segment, extract up to three clear questions implied or asked. Respond in JSON with a `questions` array containing the question texts. Use the same language as the transcript. If there is no question, return an empty array. IMPORTANT: Only return the question text itself without any additional commentary or context.';
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
    max_tokens: MAX_QUESTION_EXTRACTION_TOKENS,
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
    throw new Error('OpenAI question extraction failed: ' + (errorText || response.statusText));
  }

  const data = await response.json();
  const text = collectOpenAIText(data).trim();

  if (__DEV__) {
    console.log('[qa] OpenAI question extraction response:', data);
    console.log('[qa] Extracted question text:', text);
  }

  // Parse questions from response
  try {
    const parsed = JSON.parse(text);
    if (Array.isArray(parsed.questions)) {
      return parsed.questions.filter((q: unknown) => typeof q === 'string' && q.trim().length > 0);
    }
  } catch (error) {
    if (__DEV__) {
      console.warn('[qa] Failed to parse questions JSON, attempting fallback', error);
    }
  }

  // Fallback: extract questions ending with ?
  const questionRegex = /[^.!?]*\?/g;
  const questions = text.match(questionRegex) || [];
  return questions.map(q => q.trim()).filter(q => q.length > 5);
}

async function answerQuestionWithOpenAI(question: string, transcript: string, settings: AppSettings, signal?: AbortSignal): Promise<string> {
  const apiKey = settings.credentials.openaiApiKey?.trim();
  if (!apiKey) {
    throw new Error('Missing OpenAI API key for Q&A extraction');
  }
  const model = settings.credentials.openaiQaModel?.trim() || DEFAULT_OPENAI_QA_MODEL;
  const prompt = 'You are a helpful assistant. Answer the question concisely and factually. Use the provided transcript context when relevant, but prioritize answering the question directly even if the answer is not explicitly in the transcript. Provide a clear, helpful answer. You can use Markdown formatting to structure your response with headings, lists, code blocks, and emphasis where appropriate.';
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
        content: `Transcript context:\n${transcript.trim()}\n\nQuestion: ${question}`,
      },
    ],
    temperature: DEFAULT_QA_RESPONSE_TEMPERATURE,
    max_tokens: MAX_ANSWER_TOKENS,
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
    throw new Error('OpenAI question answering failed: ' + (errorText || response.statusText));
  }

  const data = await response.json();
  const answer = collectOpenAIText(data).trim();

  if (__DEV__) {
    console.log('[qa] OpenAI answer response:', data);
    console.log('[qa] Generated answer:', answer);
  }

  return answer || 'No answer available';
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

async function extractQuestionsWithGemini(transcript: string, settings: AppSettings, signal?: AbortSignal): Promise<string[]> {
  const apiKey = settings.credentials.geminiApiKey?.trim();
  if (!apiKey) {
    throw new Error('Missing Gemini API key for Q&A extraction');
  }
  const model = settings.credentials.geminiQaModel?.trim() || DEFAULT_GEMINI_QA_MODEL;
  const prompt = 'You are a real-time call assistant. Given a recent transcript segment, extract up to three clear questions implied or asked. Respond in JSON with a `questions` array containing the question texts. Use the same language as the transcript. If there is no question, return an empty array. IMPORTANT: Only return the question text itself without any additional commentary or context.';
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
      maxOutputTokens: MAX_QUESTION_EXTRACTION_TOKENS,
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
    throw new Error('Gemini question extraction failed: ' + (errorText || response.statusText));
  }

  const data = await response.json();
  const text = collectGeminiText(data).trim();

  // Parse questions from response
  try {
    const parsed = JSON.parse(text);
    if (Array.isArray(parsed.questions)) {
      return parsed.questions.filter((q: unknown) => typeof q === 'string' && q.trim().length > 0);
    }
  } catch (error) {
    if (__DEV__) {
      console.warn('[qa] Failed to parse questions JSON, attempting fallback', error);
    }
  }

  // Fallback: extract questions ending with ?
  const questionRegex = /[^.!?]*\?/g;
  const questions = text.match(questionRegex) || [];
  return questions.map(q => q.trim()).filter(q => q.length > 5);
}

async function answerQuestionWithGemini(question: string, transcript: string, settings: AppSettings, signal?: AbortSignal): Promise<string> {
  const apiKey = settings.credentials.geminiApiKey?.trim();
  if (!apiKey) {
    throw new Error('Missing Gemini API key for Q&A extraction');
  }
  const model = settings.credentials.geminiQaModel?.trim() || DEFAULT_GEMINI_QA_MODEL;
  const prompt = 'You are a helpful assistant. Answer the question concisely and factually. Use the provided transcript context when relevant, but prioritize answering the question directly even if the answer is not explicitly in the transcript. Provide a clear, helpful answer. You can use Markdown formatting to structure your response with headings, lists, code blocks, and emphasis where appropriate.';
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
  const payload = {
    contents: [
      {
        role: 'user',
        parts: [
          {
            text: `${prompt}\n\nTranscript context:\n${transcript.trim()}\n\nQuestion: ${question}`,
          },
        ],
      },
    ],
    generationConfig: {
      temperature: DEFAULT_QA_RESPONSE_TEMPERATURE,
      maxOutputTokens: MAX_ANSWER_TOKENS,
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
    throw new Error('Gemini question answering failed: ' + (errorText || response.statusText));
  }

  const data = await response.json();
  const answer = collectGeminiText(data).trim();

  return answer || 'No answer available';
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
  const contextTranscript = (options.contextTranscript ?? options.transcript).trim();
  if (!transcript) {
    return [];
  }

  const answerContext = contextTranscript || transcript;

  // First extract questions
  let questions: string[] = [];
  try {
    if (options.settings.qaEngine === 'gemini') {
      questions = await extractQuestionsWithGemini(transcript, options.settings, options.signal);
    } else {
      questions = await extractQuestionsWithOpenAI(transcript, options.settings, options.signal);
    }
  } catch (error) {
    if (__DEV__) {
      console.warn('[qa] Failed to extract questions, using fallback', error);
    }
    // Fallback: extract questions ending with ?
    const questionRegex = /[^.!?]*\?/g;
    questions = transcript.match(questionRegex) || [];
    questions = questions.map(q => q.trim()).filter(q => q.length > 5);
  }

  if (questions.length === 0) {
    return [];
  }

  // Then answer each question in separate conversations
  const items: TranscriptQaItem[] = [];

  for (const question of questions.slice(0, 3)) { // Limit to 3 questions
    try {
      let answer: string;
      if (options.settings.qaEngine === 'gemini') {
        answer = await answerQuestionWithGemini(question, answerContext, options.settings, options.signal);
      } else {
        answer = await answerQuestionWithOpenAI(question, answerContext, options.settings, options.signal);
      }

      items.push({ question, answer });
    } catch (error) {
      if (__DEV__) {
        console.warn('[qa] Failed to answer question:', question, error);
      }
      // If answering fails, still include the question with a default answer
      items.push({ question, answer: 'No answer available' });
    }
  }

  return items;
}
