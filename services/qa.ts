import { AppSettings, DEFAULT_GEMINI_QA_MODEL, DEFAULT_OPENAI_QA_MODEL, DEFAULT_QA_PROMPT } from '@/types/settings';
import { DEFAULT_OPENAI_BASE_URL } from '@/services/transcription';
import { TranscriptQaItem } from '@/types/transcription';
import {
  validateTranscript,
  validatePrompt,
  validateApiKey,
  validateModelName,
  validateQuestion,
} from '@/services/input-validation';
import { RateLimiter, DEFAULT_RATE_LIMITS } from '@/services/rate-limiter';
import { createSafeError, ErrorCategory } from '@/services/error-handler';

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

// Create rate limiters for Q&A services
const openaiQaRateLimiter = new RateLimiter('openai-qa', DEFAULT_RATE_LIMITS.qa);
const geminiQaRateLimiter = new RateLimiter('gemini-qa', DEFAULT_RATE_LIMITS.qa);

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

  // First attempt: parse as JSON
  try {
    const parsed = JSON.parse(trimmed);
    const items = sanitizeQaItems(parsed);
    if (items.length > 0) {
      return items;
    }
  } catch {
    // Continue to fallback parsers
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
    } catch {
      // Continue to fallback parsers
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
  } catch {
    // Continue to fallback parsers
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
  // Rate limiting
  await openaiQaRateLimiter.acquire();

  // Validate API key
  const apiKeyValidation = validateApiKey(settings.credentials.openaiApiKey);
  if (!apiKeyValidation.valid) {
    throw new Error(`OpenAI API key validation failed: ${apiKeyValidation.error}`);
  }
  const apiKey = apiKeyValidation.sanitized!;

  // Validate model name
  const modelInput = settings.credentials.openaiQaModel?.trim() || DEFAULT_OPENAI_QA_MODEL;
  const modelValidation = validateModelName(modelInput);
  if (!modelValidation.valid) {
    throw new Error(`OpenAI model validation failed: ${modelValidation.error}`);
  }
  const model = modelValidation.sanitized!;

  // Validate transcript
  const transcriptValidation = validateTranscript(transcript);
  if (!transcriptValidation.valid) {
    throw new Error(`Transcript validation failed: ${transcriptValidation.error}`);
  }
  const validatedTranscript = transcriptValidation.sanitized!;

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
        content: `Transcript segment:\n${validatedTranscript}`,
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
    const safeError = createSafeError(
      new Error('OpenAI question extraction failed: ' + (errorText || response.statusText)),
      ErrorCategory.NETWORK
    );
    throw new Error(safeError.userMessage);
  }

  const data = await response.json();
  const text = collectOpenAIText(data).trim();

  // Parse questions from response
  try {
    const parsed = JSON.parse(text);
    if (Array.isArray(parsed.questions)) {
      return parsed.questions.filter((q: unknown) => typeof q === 'string' && q.trim().length > 0);
    }
  } catch {
    // Fallback to regex extraction
  }

  // Fallback: extract questions ending with ?
  const questionRegex = /[^.!?]*\?/g;
  const questions = text.match(questionRegex) || [];
  return questions.map(q => q.trim()).filter(q => q.length > 5);
}

async function answerQuestionWithOpenAI(question: string, transcript: string, settings: AppSettings, signal?: AbortSignal): Promise<string> {
  // Rate limiting
  await openaiQaRateLimiter.acquire();

  // Validate API key
  const apiKeyValidation = validateApiKey(settings.credentials.openaiApiKey);
  if (!apiKeyValidation.valid) {
    throw new Error(`OpenAI API key validation failed: ${apiKeyValidation.error}`);
  }
  const apiKey = apiKeyValidation.sanitized!;

  // Validate model name
  const modelInput = settings.credentials.openaiQaModel?.trim() || DEFAULT_OPENAI_QA_MODEL;
  const modelValidation = validateModelName(modelInput);
  if (!modelValidation.valid) {
    throw new Error(`OpenAI model validation failed: ${modelValidation.error}`);
  }
  const model = modelValidation.sanitized!;

  // Validate question
  const questionValidation = validateQuestion(question);
  if (!questionValidation.valid) {
    throw new Error(`Question validation failed: ${questionValidation.error}`);
  }
  const validatedQuestion = questionValidation.sanitized!;

  // Validate transcript
  const transcriptValidation = validateTranscript(transcript);
  if (!transcriptValidation.valid) {
    throw new Error(`Transcript validation failed: ${transcriptValidation.error}`);
  }
  const validatedTranscript = transcriptValidation.sanitized!;

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
        content: `Transcript context:\n${validatedTranscript}\n\nQuestion: ${validatedQuestion}`,
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
    const safeError = createSafeError(
      new Error('OpenAI question answering failed: ' + (errorText || response.statusText)),
      ErrorCategory.NETWORK
    );
    throw new Error(safeError.userMessage);
  }

  const data = await response.json();
  const answer = collectOpenAIText(data).trim();

  return answer || 'No answer available';
}

async function extractWithOpenAI({ transcript, settings, signal }: ExtractTranscriptQuestionsOptions): Promise<TranscriptQaItem[]> {
  // Rate limiting
  await openaiQaRateLimiter.acquire();

  // Validate API key
  const apiKeyValidation = validateApiKey(settings.credentials.openaiApiKey);
  if (!apiKeyValidation.valid) {
    throw new Error(`OpenAI API key validation failed: ${apiKeyValidation.error}`);
  }
  const apiKey = apiKeyValidation.sanitized!;

  // Validate model name
  const modelInput = settings.credentials.openaiQaModel?.trim() || DEFAULT_OPENAI_QA_MODEL;
  const modelValidation = validateModelName(modelInput);
  if (!modelValidation.valid) {
    throw new Error(`OpenAI model validation failed: ${modelValidation.error}`);
  }
  const model = modelValidation.sanitized!;

  // Validate transcript
  const transcriptValidation = validateTranscript(transcript);
  if (!transcriptValidation.valid) {
    throw new Error(`Transcript validation failed: ${transcriptValidation.error}`);
  }
  const validatedTranscript = transcriptValidation.sanitized!;

  // Validate prompt
  const promptInput = (settings.qaPrompt || '').trim() || DEFAULT_QA_PROMPT;
  const promptValidation = validatePrompt(promptInput);
  if (!promptValidation.valid) {
    throw new Error(`Prompt validation failed: ${promptValidation.error}`);
  }
  const prompt = promptValidation.sanitized!;

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
        content: `Transcript segment:\n${validatedTranscript}`,
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
    const safeError = createSafeError(
      new Error('OpenAI Q&A extraction failed: ' + (errorText || response.statusText)),
      ErrorCategory.NETWORK
    );
    throw new Error(safeError.userMessage);
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

async function extractQuestionsWithGemini(transcript: string, settings: AppSettings, signal?: AbortSignal): Promise<string[]> {
  // Rate limiting
  await geminiQaRateLimiter.acquire();

  // Validate API key
  const apiKeyValidation = validateApiKey(settings.credentials.geminiApiKey);
  if (!apiKeyValidation.valid) {
    throw new Error(`Gemini API key validation failed: ${apiKeyValidation.error}`);
  }
  const apiKey = apiKeyValidation.sanitized!;

  // Validate model name
  const modelInput = settings.credentials.geminiQaModel?.trim() || DEFAULT_GEMINI_QA_MODEL;
  const modelValidation = validateModelName(modelInput);
  if (!modelValidation.valid) {
    throw new Error(`Gemini model validation failed: ${modelValidation.error}`);
  }
  const model = modelValidation.sanitized!;

  // Validate transcript
  const transcriptValidation = validateTranscript(transcript);
  if (!transcriptValidation.valid) {
    throw new Error(`Transcript validation failed: ${transcriptValidation.error}`);
  }
  const validatedTranscript = transcriptValidation.sanitized!;

  const prompt = 'You are a real-time call assistant. Given a recent transcript segment, extract up to three clear questions implied or asked. Respond in JSON with a `questions` array containing the question texts. Use the same language as the transcript. If there is no question, return an empty array. IMPORTANT: Only return the question text itself without any additional commentary or context.';
  // Note: Gemini API requires key as URL parameter - avoid logging the full URL
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
  const payload = {
    contents: [
      {
        role: 'user',
        parts: [
          {
            text: `${prompt}\n\nTranscript segment:\n${validatedTranscript}`,
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
    const safeError = createSafeError(
      new Error('Gemini question extraction failed: ' + (errorText || response.statusText)),
      ErrorCategory.NETWORK
    );
    throw new Error(safeError.userMessage);
  }

  const data = await response.json();
  const text = collectGeminiText(data).trim();

  // Parse questions from response
  try {
    const parsed = JSON.parse(text);
    if (Array.isArray(parsed.questions)) {
      return parsed.questions.filter((q: unknown) => typeof q === 'string' && q.trim().length > 0);
    }
  } catch {
    // Fallback to regex extraction
  }

  // Fallback: extract questions ending with ?
  const questionRegex = /[^.!?]*\?/g;
  const questions = text.match(questionRegex) || [];
  return questions.map(q => q.trim()).filter(q => q.length > 5);
}

async function answerQuestionWithGemini(question: string, transcript: string, settings: AppSettings, signal?: AbortSignal): Promise<string> {
  // Rate limiting
  await geminiQaRateLimiter.acquire();

  // Validate API key
  const apiKeyValidation = validateApiKey(settings.credentials.geminiApiKey);
  if (!apiKeyValidation.valid) {
    throw new Error(`Gemini API key validation failed: ${apiKeyValidation.error}`);
  }
  const apiKey = apiKeyValidation.sanitized!;

  // Validate model name
  const modelInput = settings.credentials.geminiQaModel?.trim() || DEFAULT_GEMINI_QA_MODEL;
  const modelValidation = validateModelName(modelInput);
  if (!modelValidation.valid) {
    throw new Error(`Gemini model validation failed: ${modelValidation.error}`);
  }
  const model = modelValidation.sanitized!;

  // Validate question
  const questionValidation = validateQuestion(question);
  if (!questionValidation.valid) {
    throw new Error(`Question validation failed: ${questionValidation.error}`);
  }
  const validatedQuestion = questionValidation.sanitized!;

  // Validate transcript
  const transcriptValidation = validateTranscript(transcript);
  if (!transcriptValidation.valid) {
    throw new Error(`Transcript validation failed: ${transcriptValidation.error}`);
  }
  const validatedTranscript = transcriptValidation.sanitized!;

  const prompt = 'You are a helpful assistant. Answer the question concisely and factually. Use the provided transcript context when relevant, but prioritize answering the question directly even if the answer is not explicitly in the transcript. Provide a clear, helpful answer. You can use Markdown formatting to structure your response with headings, lists, code blocks, and emphasis where appropriate.';
  // Note: Gemini API requires key as URL parameter - avoid logging the full URL
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
  const payload = {
    contents: [
      {
        role: 'user',
        parts: [
          {
            text: `${prompt}\n\nTranscript context:\n${validatedTranscript}\n\nQuestion: ${validatedQuestion}`,
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
    const safeError = createSafeError(
      new Error('Gemini question answering failed: ' + (errorText || response.statusText)),
      ErrorCategory.NETWORK
    );
    throw new Error(safeError.userMessage);
  }

  const data = await response.json();
  const answer = collectGeminiText(data).trim();

  return answer || 'No answer available';
}

async function extractWithGemini({ transcript, settings, signal }: ExtractTranscriptQuestionsOptions): Promise<TranscriptQaItem[]> {
  // Rate limiting
  await geminiQaRateLimiter.acquire();

  // Validate API key
  const apiKeyValidation = validateApiKey(settings.credentials.geminiApiKey);
  if (!apiKeyValidation.valid) {
    throw new Error(`Gemini API key validation failed: ${apiKeyValidation.error}`);
  }
  const apiKey = apiKeyValidation.sanitized!;

  // Validate model name
  const modelInput = settings.credentials.geminiQaModel?.trim() || DEFAULT_GEMINI_QA_MODEL;
  const modelValidation = validateModelName(modelInput);
  if (!modelValidation.valid) {
    throw new Error(`Gemini model validation failed: ${modelValidation.error}`);
  }
  const model = modelValidation.sanitized!;

  // Validate transcript
  const transcriptValidation = validateTranscript(transcript);
  if (!transcriptValidation.valid) {
    throw new Error(`Transcript validation failed: ${transcriptValidation.error}`);
  }
  const validatedTranscript = transcriptValidation.sanitized!;

  // Validate prompt
  const promptInput = (settings.qaPrompt || '').trim() || DEFAULT_QA_PROMPT;
  const promptValidation = validatePrompt(promptInput);
  if (!promptValidation.valid) {
    throw new Error(`Prompt validation failed: ${promptValidation.error}`);
  }
  const prompt = promptValidation.sanitized!;

  // Note: Gemini API requires key as URL parameter - avoid logging the full URL
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
  const payload = {
    contents: [
      {
        role: 'user',
        parts: [
          {
            text: `${prompt}\n\nTranscript segment:\n${validatedTranscript}`,
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
    const safeError = createSafeError(
      new Error('Gemini Q&A extraction failed: ' + (errorText || response.statusText)),
      ErrorCategory.NETWORK
    );
    throw new Error(safeError.userMessage);
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
  } catch {
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
    } catch {
      // If answering fails, still include the question with a default answer
      items.push({ question, answer: 'No answer available' });
    }
  }

  return items;
}
