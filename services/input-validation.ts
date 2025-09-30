/**
 * Input validation utilities to prevent injection attacks and enforce limits
 */

// Maximum lengths for various inputs
export const MAX_TRANSCRIPT_LENGTH = 100000; // ~100KB of text
export const MAX_PROMPT_LENGTH = 10000;
export const MAX_QUESTION_LENGTH = 1000;
export const MAX_CONTEXT_LENGTH = 50000;
export const MAX_API_KEY_LENGTH = 500;
export const MAX_MODEL_NAME_LENGTH = 100;
export const MAX_URL_LENGTH = 2000;

// Minimum lengths for validation
export const MIN_QUESTION_LENGTH = 3;
export const MIN_TRANSCRIPT_LENGTH = 1;

export interface ValidationResult {
  valid: boolean;
  error?: string;
  sanitized?: string;
}

/**
 * Validates and sanitizes transcript text
 */
export function validateTranscript(transcript: unknown): ValidationResult {
  if (typeof transcript !== 'string') {
    return { valid: false, error: 'Transcript must be a string' };
  }

  const trimmed = transcript.trim();

  if (trimmed.length < MIN_TRANSCRIPT_LENGTH) {
    return { valid: false, error: 'Transcript cannot be empty' };
  }

  if (trimmed.length > MAX_TRANSCRIPT_LENGTH) {
    return {
      valid: false,
      error: `Transcript exceeds maximum length of ${MAX_TRANSCRIPT_LENGTH} characters`
    };
  }

  // Remove control characters except newlines and tabs
  const sanitized = trimmed.replace(/[\x00-\x08\x0B-\x0C\x0E-\x1F\x7F]/g, '');

  return { valid: true, sanitized };
}

/**
 * Validates and sanitizes prompt text
 */
export function validatePrompt(prompt: unknown): ValidationResult {
  if (typeof prompt !== 'string') {
    return { valid: false, error: 'Prompt must be a string' };
  }

  const trimmed = prompt.trim();

  if (trimmed.length > MAX_PROMPT_LENGTH) {
    return {
      valid: false,
      error: `Prompt exceeds maximum length of ${MAX_PROMPT_LENGTH} characters`
    };
  }

  // Remove control characters except newlines and tabs
  const sanitized = trimmed.replace(/[\x00-\x08\x0B-\x0C\x0E-\x1F\x7F]/g, '');

  return { valid: true, sanitized };
}

/**
 * Validates and sanitizes question text
 */
export function validateQuestion(question: unknown): ValidationResult {
  if (typeof question !== 'string') {
    return { valid: false, error: 'Question must be a string' };
  }

  const trimmed = question.trim();

  if (trimmed.length < MIN_QUESTION_LENGTH) {
    return {
      valid: false,
      error: `Question must be at least ${MIN_QUESTION_LENGTH} characters`
    };
  }

  if (trimmed.length > MAX_QUESTION_LENGTH) {
    return {
      valid: false,
      error: `Question exceeds maximum length of ${MAX_QUESTION_LENGTH} characters`
    };
  }

  // Remove control characters
  const sanitized = trimmed.replace(/[\x00-\x08\x0B-\x0C\x0E-\x1F\x7F]/g, '');

  return { valid: true, sanitized };
}

/**
 * Validates API key format (basic validation)
 */
export function validateApiKey(apiKey: unknown): ValidationResult {
  if (typeof apiKey !== 'string') {
    return { valid: false, error: 'API key must be a string' };
  }

  const trimmed = apiKey.trim();

  if (trimmed.length === 0) {
    return { valid: false, error: 'API key cannot be empty' };
  }

  if (trimmed.length > MAX_API_KEY_LENGTH) {
    return {
      valid: false,
      error: `API key exceeds maximum length of ${MAX_API_KEY_LENGTH} characters`
    };
  }

  // API keys should only contain alphanumeric characters, hyphens, and underscores
  if (!/^[a-zA-Z0-9_-]+$/.test(trimmed)) {
    return {
      valid: false,
      error: 'API key contains invalid characters'
    };
  }

  return { valid: true, sanitized: trimmed };
}

/**
 * Validates model name format
 */
export function validateModelName(modelName: unknown): ValidationResult {
  if (typeof modelName !== 'string') {
    return { valid: false, error: 'Model name must be a string' };
  }

  const trimmed = modelName.trim();

  if (trimmed.length === 0) {
    return { valid: false, error: 'Model name cannot be empty' };
  }

  if (trimmed.length > MAX_MODEL_NAME_LENGTH) {
    return {
      valid: false,
      error: `Model name exceeds maximum length of ${MAX_MODEL_NAME_LENGTH} characters`
    };
  }

  // Model names should contain alphanumeric, hyphens, underscores, dots, and colons
  if (!/^[a-zA-Z0-9._:-]+$/.test(trimmed)) {
    return {
      valid: false,
      error: 'Model name contains invalid characters'
    };
  }

  return { valid: true, sanitized: trimmed };
}

/**
 * Validates URL format
 */
export function validateUrl(url: unknown): ValidationResult {
  if (typeof url !== 'string') {
    return { valid: false, error: 'URL must be a string' };
  }

  const trimmed = url.trim();

  if (trimmed.length === 0) {
    return { valid: false, error: 'URL cannot be empty' };
  }

  if (trimmed.length > MAX_URL_LENGTH) {
    return {
      valid: false,
      error: `URL exceeds maximum length of ${MAX_URL_LENGTH} characters`
    };
  }

  try {
    const parsedUrl = new URL(trimmed);

    // Only allow https (or http for localhost/development)
    if (parsedUrl.protocol !== 'https:' && parsedUrl.protocol !== 'http:') {
      return {
        valid: false,
        error: 'URL must use HTTP or HTTPS protocol'
      };
    }

    // Disallow localhost URLs in production
    if (!__DEV__ && (parsedUrl.hostname === 'localhost' || parsedUrl.hostname === '127.0.0.1')) {
      return {
        valid: false,
        error: 'Localhost URLs are not allowed in production'
      };
    }

    return { valid: true, sanitized: trimmed };
  } catch {
    return { valid: false, error: 'Invalid URL format' };
  }
}

/**
 * Validates numeric values within a range
 */
export function validateNumber(
  value: unknown,
  min: number,
  max: number,
  fieldName: string = 'Value'
): ValidationResult {
  if (typeof value !== 'number' || isNaN(value)) {
    return { valid: false, error: `${fieldName} must be a valid number` };
  }

  if (value < min || value > max) {
    return {
      valid: false,
      error: `${fieldName} must be between ${min} and ${max}`
    };
  }

  return { valid: true };
}

/**
 * Validates temperature parameter for LLM APIs
 */
export function validateTemperature(temperature: unknown): ValidationResult {
  return validateNumber(temperature, 0, 2, 'Temperature');
}

/**
 * Validates max tokens parameter for LLM APIs
 */
export function validateMaxTokens(maxTokens: unknown): ValidationResult {
  return validateNumber(maxTokens, 1, 100000, 'Max tokens');
}
