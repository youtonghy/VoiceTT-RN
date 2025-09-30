/**
 * Generic error handling service to prevent information leakage
 * Provides safe error messages for production while preserving details for debugging
 */

export enum ErrorCategory {
  NETWORK = 'NETWORK_ERROR',
  AUTHENTICATION = 'AUTHENTICATION_ERROR',
  VALIDATION = 'VALIDATION_ERROR',
  RATE_LIMIT = 'RATE_LIMIT_ERROR',
  PROCESSING = 'PROCESSING_ERROR',
  STORAGE = 'STORAGE_ERROR',
  PERMISSION = 'PERMISSION_ERROR',
  UNKNOWN = 'UNKNOWN_ERROR',
}

export interface SafeError {
  category: ErrorCategory;
  message: string;
  userMessage: string;
  timestamp: number;
  errorId: string;
}

/**
 * Generic error messages for production (user-facing)
 */
const GENERIC_MESSAGES: Record<ErrorCategory, string> = {
  [ErrorCategory.NETWORK]: 'Network connection failed. Please check your internet connection and try again.',
  [ErrorCategory.AUTHENTICATION]: 'Authentication failed. Please check your API credentials in settings.',
  [ErrorCategory.VALIDATION]: 'Invalid input data. Please check your input and try again.',
  [ErrorCategory.RATE_LIMIT]: 'Rate limit exceeded. Please wait a moment before trying again.',
  [ErrorCategory.PROCESSING]: 'An error occurred while processing your request. Please try again.',
  [ErrorCategory.STORAGE]: 'Storage operation failed. Please ensure you have enough space and permissions.',
  [ErrorCategory.PERMISSION]: 'Permission denied. Please check app permissions in your device settings.',
  [ErrorCategory.UNKNOWN]: 'An unexpected error occurred. Please try again or contact support if the issue persists.',
};

/**
 * Patterns to detect error categories from error messages
 */
const ERROR_PATTERNS: {
  category: ErrorCategory;
  patterns: RegExp[];
}[] = [
  {
    category: ErrorCategory.NETWORK,
    patterns: [
      /network/i,
      /fetch/i,
      /connection/i,
      /timeout/i,
      /ECONNREFUSED/i,
      /ETIMEDOUT/i,
    ],
  },
  {
    category: ErrorCategory.AUTHENTICATION,
    patterns: [
      /unauthorized/i,
      /401/,
      /403/,
      /api key/i,
      /invalid.*key/i,
      /authentication/i,
      /credentials/i,
    ],
  },
  {
    category: ErrorCategory.VALIDATION,
    patterns: [
      /validation/i,
      /invalid.*input/i,
      /exceeds.*length/i,
      /must be.*string/i,
      /cannot be empty/i,
    ],
  },
  {
    category: ErrorCategory.RATE_LIMIT,
    patterns: [
      /rate limit/i,
      /too many requests/i,
      /429/,
      /quota exceeded/i,
    ],
  },
  {
    category: ErrorCategory.STORAGE,
    patterns: [
      /storage/i,
      /SecureStore/i,
      /AsyncStorage/i,
      /ENOSPC/i,
      /disk.*full/i,
    ],
  },
  {
    category: ErrorCategory.PERMISSION,
    patterns: [
      /permission/i,
      /EACCES/i,
      /access denied/i,
    ],
  },
];

/**
 * Categorizes an error based on its message and properties
 */
function categorizeError(error: unknown): ErrorCategory {
  const errorMessage = error instanceof Error ? error.message : String(error);

  for (const { category, patterns } of ERROR_PATTERNS) {
    if (patterns.some((pattern) => pattern.test(errorMessage))) {
      return category;
    }
  }

  return ErrorCategory.UNKNOWN;
}

/**
 * Generates a unique error ID for tracking
 */
function generateErrorId(): string {
  return `ERR-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Sanitizes error message by removing sensitive information
 */
function sanitizeErrorMessage(message: string): string {
  let sanitized = message;

  // Remove API keys (various formats)
  sanitized = sanitized.replace(/\b[A-Za-z0-9_-]{20,}\b/g, '[REDACTED]');

  // Remove URLs with API keys
  sanitized = sanitized.replace(/https?:\/\/[^\s]+\?key=[^\s&]+/gi, 'https://[REDACTED]');

  // Remove Bearer tokens
  sanitized = sanitized.replace(/Bearer\s+[A-Za-z0-9_-]+/gi, 'Bearer [REDACTED]');

  // Remove file paths that might contain sensitive info
  sanitized = sanitized.replace(/\/[^\s]+\/[^\s]+/g, '[PATH]');

  // Remove email addresses
  sanitized = sanitized.replace(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, '[EMAIL]');

  return sanitized;
}

/**
 * Creates a safe error object from any error
 */
export function createSafeError(error: unknown, customCategory?: ErrorCategory): SafeError {
  const category = customCategory || categorizeError(error);
  const originalMessage = error instanceof Error ? error.message : String(error);
  const sanitizedMessage = sanitizeErrorMessage(originalMessage);

  const safeError: SafeError = {
    category,
    message: sanitizedMessage,
    userMessage: GENERIC_MESSAGES[category],
    timestamp: Date.now(),
    errorId: generateErrorId(),
  };

  // Log detailed error in development
  if (__DEV__) {
    console.error('[SafeError]', {
      errorId: safeError.errorId,
      category: safeError.category,
      originalMessage,
      sanitizedMessage,
      userMessage: safeError.userMessage,
      stack: error instanceof Error ? error.stack : undefined,
    });
  }

  return safeError;
}

/**
 * Wraps an async function with safe error handling
 */
export function withSafeErrorHandling<T extends unknown[], R>(
  fn: (...args: T) => Promise<R>,
  errorCategory?: ErrorCategory
): (...args: T) => Promise<R> {
  return async (...args: T): Promise<R> => {
    try {
      return await fn(...args);
    } catch (error) {
      const safeError = createSafeError(error, errorCategory);
      throw new Error(safeError.userMessage);
    }
  };
}

/**
 * Creates a user-friendly error message from any error
 */
export function getUserErrorMessage(error: unknown): string {
  const safeError = createSafeError(error);
  return safeError.userMessage;
}

/**
 * Checks if an error is safe to display to users
 */
export function isErrorSafeToDisplay(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }

  const message = error.message.toLowerCase();

  // Check if message contains sensitive patterns
  const sensitivePatterns = [
    /\b[A-Za-z0-9_-]{32,}\b/, // Long tokens/keys
    /password/i,
    /secret/i,
    /token/i,
    /key=/i,
    /@/,
    /\/home\//,
    /\/users\//,
    /c:\\/i,
  ];

  return !sensitivePatterns.some((pattern) => pattern.test(message));
}
