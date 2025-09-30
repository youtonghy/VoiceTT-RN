/**
 * API rate limiting service to prevent abuse and ensure fair usage
 * Implements a token bucket algorithm for rate limiting
 */

export interface RateLimitConfig {
  maxRequests: number; // Maximum number of requests allowed
  windowMs: number; // Time window in milliseconds
  keyPrefix?: string; // Optional prefix for the rate limit key
}

interface RateLimitBucket {
  tokens: number;
  lastRefill: number;
  queue: {
    resolve: () => void;
    reject: (error: Error) => void;
    timestamp: number;
  }[];
}

const buckets = new Map<string, RateLimitBucket>();

// Default rate limit configurations for different API services
export const DEFAULT_RATE_LIMITS = {
  // OpenAI API limits (conservative defaults)
  openai: {
    maxRequests: 50,
    windowMs: 60000, // 50 requests per minute
  },
  // Gemini API limits (conservative defaults)
  gemini: {
    maxRequests: 30,
    windowMs: 60000, // 30 requests per minute
  },
  // Transcription services (more generous for real-time use)
  transcription: {
    maxRequests: 100,
    windowMs: 60000, // 100 requests per minute
  },
  // Q&A services (moderate limits)
  qa: {
    maxRequests: 20,
    windowMs: 60000, // 20 requests per minute
  },
  // Translation services (moderate limits)
  translation: {
    maxRequests: 30,
    windowMs: 60000, // 30 requests per minute
  },
} as const;

/**
 * Gets or creates a rate limit bucket for a given key
 */
function getBucket(key: string, config: RateLimitConfig): RateLimitBucket {
  const fullKey = config.keyPrefix ? `${config.keyPrefix}:${key}` : key;

  let bucket = buckets.get(fullKey);

  if (!bucket) {
    bucket = {
      tokens: config.maxRequests,
      lastRefill: Date.now(),
      queue: [],
    };
    buckets.set(fullKey, bucket);
  }

  return bucket;
}

/**
 * Refills tokens in the bucket based on elapsed time
 */
function refillBucket(bucket: RateLimitBucket, config: RateLimitConfig): void {
  const now = Date.now();
  const elapsed = now - bucket.lastRefill;

  if (elapsed >= config.windowMs) {
    // Full refill if window has passed
    bucket.tokens = config.maxRequests;
    bucket.lastRefill = now;
  } else {
    // Partial refill based on elapsed time
    const refillRate = config.maxRequests / config.windowMs;
    const tokensToAdd = Math.floor(elapsed * refillRate);

    if (tokensToAdd > 0) {
      bucket.tokens = Math.min(config.maxRequests, bucket.tokens + tokensToAdd);
      bucket.lastRefill = now;
    }
  }
}

/**
 * Processes the queue of waiting requests
 */
function processQueue(bucket: RateLimitBucket, config: RateLimitConfig): void {
  while (bucket.queue.length > 0 && bucket.tokens > 0) {
    const request = bucket.queue.shift();
    if (request) {
      bucket.tokens--;
      request.resolve();
    }
  }

  // Clean up expired queued requests (older than 30 seconds)
  const now = Date.now();
  while (bucket.queue.length > 0 && now - bucket.queue[0].timestamp > 30000) {
    const expired = bucket.queue.shift();
    if (expired) {
      expired.reject(new Error('Rate limit request timeout'));
    }
  }
}

/**
 * Acquires a token for making an API request
 * Returns immediately if a token is available, otherwise waits in queue
 */
export async function acquireToken(key: string, config: RateLimitConfig): Promise<void> {
  const bucket = getBucket(key, config);

  refillBucket(bucket, config);

  if (bucket.tokens > 0) {
    bucket.tokens--;
    return Promise.resolve();
  }

  // No tokens available, add to queue
  return new Promise((resolve, reject) => {
    bucket.queue.push({
      resolve,
      reject,
      timestamp: Date.now(),
    });

    // Set up a timeout to periodically try to process the queue
    const checkInterval = setInterval(() => {
      refillBucket(bucket, config);
      processQueue(bucket, config);

      // Clear interval if this request was processed or queue is empty
      if (!bucket.queue.find(r => r.resolve === resolve)) {
        clearInterval(checkInterval);
      }
    }, 100); // Check every 100ms
  });
}

/**
 * Checks if a request would be rate limited without consuming a token
 */
export function checkRateLimit(key: string, config: RateLimitConfig): {
  allowed: boolean;
  tokensRemaining: number;
  resetTime: number;
} {
  const bucket = getBucket(key, config);

  refillBucket(bucket, config);

  return {
    allowed: bucket.tokens > 0,
    tokensRemaining: bucket.tokens,
    resetTime: bucket.lastRefill + config.windowMs,
  };
}

/**
 * Resets rate limit for a specific key (useful for testing or admin override)
 */
export function resetRateLimit(key: string, config: RateLimitConfig): void {
  const fullKey = config.keyPrefix ? `${config.keyPrefix}:${key}` : key;
  buckets.delete(fullKey);
}

/**
 * Clears all rate limit buckets (useful for testing or global reset)
 */
export function clearAllRateLimits(): void {
  buckets.clear();
}

/**
 * Gets current rate limit status for debugging
 */
export function getRateLimitStatus(key: string, config: RateLimitConfig): {
  tokens: number;
  queueLength: number;
  lastRefill: number;
  nextRefill: number;
} {
  const bucket = getBucket(key, config);
  refillBucket(bucket, config);

  return {
    tokens: bucket.tokens,
    queueLength: bucket.queue.length,
    lastRefill: bucket.lastRefill,
    nextRefill: bucket.lastRefill + config.windowMs,
  };
}

/**
 * Higher-level API for rate limiting with automatic key generation
 */
export class RateLimiter {
  constructor(
    private readonly service: string,
    private readonly config: RateLimitConfig
  ) {}

  async acquire(userId?: string): Promise<void> {
    const key = userId ? `${this.service}:${userId}` : this.service;
    return acquireToken(key, this.config);
  }

  check(userId?: string): ReturnType<typeof checkRateLimit> {
    const key = userId ? `${this.service}:${userId}` : this.service;
    return checkRateLimit(key, this.config);
  }

  reset(userId?: string): void {
    const key = userId ? `${this.service}:${userId}` : this.service;
    resetRateLimit(key, this.config);
  }

  getStatus(userId?: string): ReturnType<typeof getRateLimitStatus> {
    const key = userId ? `${this.service}:${userId}` : this.service;
    return getRateLimitStatus(key, this.config);
  }
}
