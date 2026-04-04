/**
 * Rate Limiter
 * 
 * Industry Standard: Client-side rate limiting with token bucket algorithm
 * 
 * Prevents API abuse and provides graceful degradation under heavy load
 */

// ============================================================================
// Types
// ============================================================================

export interface RateLimiterConfig {
  /** Maximum tokens in bucket */
  maxTokens: number;
  /** Tokens added per refill interval */
  refillRate: number;
  /** Refill interval in milliseconds */
  refillInterval: number;
  /** Key for this rate limiter (for storage) */
  key?: string;
}

export interface RateLimitResult {
  allowed: boolean;
  remainingTokens: number;
  retryAfterMs?: number;
  waitingInQueue?: boolean;
}

export interface RateLimiterState {
  tokens: number;
  lastRefill: number;
}

// ============================================================================
// Token Bucket Rate Limiter
// ============================================================================

/**
 * Token bucket rate limiter implementation
 * 
 * - Tokens are consumed on each request
 * - Tokens refill over time
 * - Requests blocked when bucket is empty
 */
export class TokenBucketRateLimiter {
  private maxTokens: number;
  private refillRate: number;
  private refillInterval: number;
  private tokens: number;
  private lastRefill: number;
  private key?: string;
  private queue: Array<{ resolve: () => void; reject: (err: Error) => void }> = [];
  private processing = false;

  constructor(config: RateLimiterConfig) {
    this.maxTokens = config.maxTokens;
    this.refillRate = config.refillRate;
    this.refillInterval = config.refillInterval;
    this.key = config.key;
    this.tokens = config.maxTokens;
    this.lastRefill = Date.now();

    // Load state from storage if available
    this.loadState();

    // Start refill timer
    this.startRefillTimer();
  }

  /**
   * Attempt to consume a token
   */
  tryConsume(tokens: number = 1): RateLimitResult {
    this.refill();

    if (this.tokens >= tokens) {
      this.tokens -= tokens;
      this.saveState();
      return {
        allowed: true,
        remainingTokens: this.tokens,
      };
    }

    // Calculate when tokens will be available
    const tokensNeeded = tokens - this.tokens;
    const refillsNeeded = Math.ceil(tokensNeeded / this.refillRate);
    const retryAfterMs = refillsNeeded * this.refillInterval;

    return {
      allowed: false,
      remainingTokens: this.tokens,
      retryAfterMs,
    };
  }

  /**
   * Wait in queue for a token
   */
  async waitForToken(tokens: number = 1, timeoutMs: number = 30000): Promise<RateLimitResult> {
    const result = this.tryConsume(tokens);
    
    if (result.allowed) {
      return result;
    }

    // Wait in queue
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Rate limit queue timeout'));
      }, timeoutMs);

      this.queue.push({
        resolve: () => {
          clearTimeout(timeout);
          const consumeResult = this.tryConsume(tokens);
          resolve({
            ...consumeResult,
            waitingInQueue: true,
          });
        },
        reject: (err) => {
          clearTimeout(timeout);
          reject(err);
        },
      });

      this.processQueue();
    });
  }

  /**
   * Get current state
   */
  getState(): RateLimiterState {
    this.refill();
    return {
      tokens: this.tokens,
      lastRefill: this.lastRefill,
    };
  }

  /**
   * Reset the rate limiter
   */
  reset(): void {
    this.tokens = this.maxTokens;
    this.lastRefill = Date.now();
    this.saveState();
  }

  // Private methods

  private refill(): void {
    const now = Date.now();
    const timePassed = now - this.lastRefill;
    const refills = Math.floor(timePassed / this.refillInterval);

    if (refills > 0) {
      this.tokens = Math.min(this.maxTokens, this.tokens + refills * this.refillRate);
      this.lastRefill = now;
    }
  }

  private startRefillTimer(): void {
    setInterval(() => {
      this.refill();
      this.processQueue();
    }, this.refillInterval);
  }

  private processQueue(): void {
    if (this.processing || this.queue.length === 0) {
      return;
    }

    this.processing = true;

    while (this.queue.length > 0 && this.tokens > 0) {
      const next = this.queue.shift();
      if (next) {
        next.resolve();
      }
    }

    this.processing = false;
  }

  private loadState(): void {
    if (typeof window === 'undefined' || !this.key) return;

    try {
      const stored = localStorage.getItem(`rate_limit_${this.key}`);
      if (stored) {
        const state = JSON.parse(stored) as RateLimiterState;
        this.tokens = state.tokens;
        this.lastRefill = state.lastRefill;
        this.refill(); // Apply any refills since last save
      }
    } catch {
      // Ignore errors
    }
  }

  private saveState(): void {
    if (typeof window === 'undefined' || !this.key) return;

    try {
      localStorage.setItem(
        `rate_limit_${this.key}`,
        JSON.stringify({ tokens: this.tokens, lastRefill: this.lastRefill })
      );
    } catch {
      // Ignore errors
    }
  }
}

// ============================================================================
// Sliding Window Rate Limiter
// ============================================================================

export interface SlidingWindowConfig {
  /** Maximum requests in window */
  maxRequests: number;
  /** Window size in milliseconds */
  windowMs: number;
  /** Key for storage */
  key?: string;
}

/**
 * Sliding window rate limiter
 * 
 * Tracks requests over a sliding time window
 */
export class SlidingWindowRateLimiter {
  private maxRequests: number;
  private windowMs: number;
  private key?: string;
  private requests: number[] = [];

  constructor(config: SlidingWindowConfig) {
    this.maxRequests = config.maxRequests;
    this.windowMs = config.windowMs;
    this.key = config.key;
    this.loadState();
  }

  /**
   * Check if request is allowed
   */
  tryConsume(): RateLimitResult {
    this.clearOldRequests();

    if (this.requests.length < this.maxRequests) {
      this.requests.push(Date.now());
      this.saveState();
      return {
        allowed: true,
        remainingTokens: this.maxRequests - this.requests.length,
      };
    }

    // Calculate when next request will be allowed
    const oldestRequest = this.requests[0];
    const retryAfterMs = oldestRequest + this.windowMs - Date.now();

    return {
      allowed: false,
      remainingTokens: 0,
      retryAfterMs: Math.max(0, retryAfterMs),
    };
  }

  /**
   * Get current request count
   */
  getRequestCount(): number {
    this.clearOldRequests();
    return this.requests.length;
  }

  /**
   * Reset the limiter
   */
  reset(): void {
    this.requests = [];
    this.saveState();
  }

  private clearOldRequests(): void {
    const cutoff = Date.now() - this.windowMs;
    this.requests = this.requests.filter((t) => t > cutoff);
  }

  private loadState(): void {
    if (typeof window === 'undefined' || !this.key) return;

    try {
      const stored = localStorage.getItem(`sliding_rate_limit_${this.key}`);
      if (stored) {
        this.requests = JSON.parse(stored);
        this.clearOldRequests();
      }
    } catch {
      // Ignore
    }
  }

  private saveState(): void {
    if (typeof window === 'undefined' || !this.key) return;

    try {
      localStorage.setItem(`sliding_rate_limit_${this.key}`, JSON.stringify(this.requests));
    } catch {
      // Ignore
    }
  }
}

// ============================================================================
// Pre-configured Rate Limiters
// ============================================================================

/**
 * API rate limiter
 * 
 * 100 requests per minute with burst of 10
 */
export const apiRateLimiter = new TokenBucketRateLimiter({
  maxTokens: 100,
  refillRate: 10,
  refillInterval: 6000, // 10 tokens every 6 seconds = 100/min
  key: 'api',
});

/**
 * Auth rate limiter
 * 
 * 5 attempts per minute (stricter for security)
 */
export const authRateLimiter = new SlidingWindowRateLimiter({
  maxRequests: 5,
  windowMs: 60000,
  key: 'auth',
});

/**
 * Search rate limiter
 * 
 * 30 searches per minute
 */
export const searchRateLimiter = new TokenBucketRateLimiter({
  maxTokens: 30,
  refillRate: 5,
  refillInterval: 10000,
  key: 'search',
});

/**
 * Export rate limiter
 * 
 * 10 exports per hour (resource intensive)
 */
export const exportRateLimiter = new SlidingWindowRateLimiter({
  maxRequests: 10,
  windowMs: 3600000,
  key: 'export',
});

// ============================================================================
// Rate Limit Wrapper
// ============================================================================

/**
 * Wrap an async function with rate limiting
 */
export function withRateLimit<T extends (...args: unknown[]) => Promise<unknown>>(
  fn: T,
  rateLimiter: TokenBucketRateLimiter | SlidingWindowRateLimiter,
  options: {
    onRateLimited?: (result: RateLimitResult) => void;
    waitForToken?: boolean;
    throwOnLimit?: boolean;
  } = {}
): T {
  const { onRateLimited, waitForToken = false, throwOnLimit = true } = options;

  return (async (...args: Parameters<T>) => {
    let result: RateLimitResult;

    if (waitForToken && rateLimiter instanceof TokenBucketRateLimiter) {
      result = await rateLimiter.waitForToken();
    } else {
      result = rateLimiter.tryConsume();
    }

    if (!result.allowed) {
      onRateLimited?.(result);

      if (throwOnLimit) {
        const error = new Error('Rate limit exceeded');
        (error as Error & { retryAfterMs: number }).retryAfterMs = result.retryAfterMs ?? 0;
        throw error;
      }

      return undefined;
    }

    return fn(...args);
  }) as T;
}

// ============================================================================
// React Hook
// ============================================================================

import { useState, useCallback } from 'react';

export interface UseRateLimitOptions {
  onRateLimited?: (result: RateLimitResult) => void;
}

export function useRateLimit(
  rateLimiter: TokenBucketRateLimiter | SlidingWindowRateLimiter,
  options: UseRateLimitOptions = {}
) {
  const [isLimited, setIsLimited] = useState(false);
  const [retryAfter, setRetryAfter] = useState<number | undefined>();

  const checkLimit = useCallback(() => {
    const result = rateLimiter.tryConsume();

    if (!result.allowed) {
      setIsLimited(true);
      setRetryAfter(result.retryAfterMs);
      options.onRateLimited?.(result);

      // Auto-reset after retry time
      if (result.retryAfterMs) {
        setTimeout(() => {
          setIsLimited(false);
          setRetryAfter(undefined);
        }, result.retryAfterMs);
      }

      return false;
    }

    setIsLimited(false);
    setRetryAfter(undefined);
    return true;
  }, [rateLimiter, options]);

  const reset = useCallback(() => {
    rateLimiter.reset();
    setIsLimited(false);
    setRetryAfter(undefined);
  }, [rateLimiter]);

  return {
    isLimited,
    retryAfter,
    checkLimit,
    reset,
    remainingTokens: rateLimiter instanceof TokenBucketRateLimiter
      ? rateLimiter.getState().tokens
      : undefined,
  };
}
