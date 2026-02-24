/**
 * ============================================================================
 * TOKEN BUCKET RATE LIMITER
 * ============================================================================
 * 
 * Industry-standard rate limiting for API requests:
 * - Token bucket algorithm
 * - Sliding window tracking
 * - Per-endpoint limits
 * - Request queuing
 * - Backpressure handling
 * 
 * Industry Parity: Stripe, Cloudflare, AWS SDK
 * ============================================================================
 */

// ============================================================================
// TYPES
// ============================================================================

export interface RateLimitConfig {
    /** Maximum tokens in bucket */
    maxTokens: number;
    /** Tokens added per interval */
    refillRate: number;
    /** Refill interval in milliseconds */
    refillInterval: number;
    /** Optional: per-endpoint overrides */
    endpointLimits?: Record<string, { maxTokens: number; refillRate: number }>;
}

export interface RateLimitState {
    tokens: number;
    lastRefill: number;
    queue: Array<{
        resolve: () => void;
        reject: (error: Error) => void;
        timestamp: number;
    }>;
}

export interface RateLimitInfo {
    remaining: number;
    limit: number;
    resetAt: number;
    retryAfter?: number;
}

// ============================================================================
// TOKEN BUCKET RATE LIMITER
// ============================================================================

export class TokenBucketRateLimiter {
    private config: RateLimitConfig;
    private buckets: Map<string, RateLimitState> = new Map();
    private refillTimers: Map<string, ReturnType<typeof setTimeout>> = new Map();

    constructor(config: Partial<RateLimitConfig> = {}) {
        this.config = {
            maxTokens: config.maxTokens ?? 100,
            refillRate: config.refillRate ?? 10,
            refillInterval: config.refillInterval ?? 1000,
            endpointLimits: config.endpointLimits ?? {},
        };
    }

    /**
     * Get or create bucket for an endpoint
     */
    private getBucket(endpoint: string): RateLimitState {
        if (!this.buckets.has(endpoint)) {
            const limits = this.getEndpointLimits(endpoint);
            this.buckets.set(endpoint, {
                tokens: limits.maxTokens,
                lastRefill: Date.now(),
                queue: [],
            });
            this.startRefillTimer(endpoint);
        }
        return this.buckets.get(endpoint)!;
    }

    /**
     * Get limits for specific endpoint
     */
    private getEndpointLimits(endpoint: string): { maxTokens: number; refillRate: number } {
        // Check for exact match
        if (this.config.endpointLimits?.[endpoint]) {
            return this.config.endpointLimits[endpoint];
        }

        // Check for pattern match (e.g., "/api/analyze/*")
        for (const [pattern, limits] of Object.entries(this.config.endpointLimits ?? {})) {
            if (pattern.endsWith('*') && endpoint.startsWith(pattern.slice(0, -1))) {
                return limits;
            }
        }

        return { maxTokens: this.config.maxTokens, refillRate: this.config.refillRate };
    }

    /**
     * Start refill timer for bucket
     */
    private startRefillTimer(endpoint: string): void {
        if (this.refillTimers.has(endpoint)) return;

        const timer = setInterval(() => {
            this.refillBucket(endpoint);
        }, this.config.refillInterval);

        this.refillTimers.set(endpoint, timer);
    }

    /**
     * Refill tokens in bucket
     */
    private refillBucket(endpoint: string): void {
        const bucket = this.buckets.get(endpoint);
        if (!bucket) return;

        const limits = this.getEndpointLimits(endpoint);
        bucket.tokens = Math.min(bucket.tokens + limits.refillRate, limits.maxTokens);
        bucket.lastRefill = Date.now();

        // Process queued requests
        this.processQueue(endpoint);
    }

    /**
     * Process queued requests when tokens become available
     */
    private processQueue(endpoint: string): void {
        const bucket = this.buckets.get(endpoint);
        if (!bucket || bucket.queue.length === 0) return;

        while (bucket.tokens > 0 && bucket.queue.length > 0) {
            const request = bucket.queue.shift();
            if (request) {
                // Check if request hasn't timed out (30s max queue time)
                if (Date.now() - request.timestamp < 30000) {
                    bucket.tokens--;
                    request.resolve();
                } else {
                    request.reject(new RateLimitError('Request timed out in queue', 0));
                }
            }
        }
    }

    /**
     * Acquire a token for the given endpoint
     * @returns Promise that resolves when token is acquired
     */
    async acquire(endpoint: string = 'default'): Promise<void> {
        const bucket = this.getBucket(endpoint);

        // If tokens available, consume immediately
        if (bucket.tokens > 0) {
            bucket.tokens--;
            return;
        }

        // Queue the request
        return new Promise<void>((resolve, reject) => {
            bucket.queue.push({
                resolve,
                reject,
                timestamp: Date.now(),
            });
        });
    }

    /**
     * Try to acquire token without waiting
     * @returns true if token acquired, false otherwise
     */
    tryAcquire(endpoint: string = 'default'): boolean {
        const bucket = this.getBucket(endpoint);
        if (bucket.tokens > 0) {
            bucket.tokens--;
            return true;
        }
        return false;
    }

    /**
     * Get current rate limit info
     */
    getInfo(endpoint: string = 'default'): RateLimitInfo {
        const bucket = this.getBucket(endpoint);
        const limits = this.getEndpointLimits(endpoint);

        const timeSinceRefill = Date.now() - bucket.lastRefill;
        const tokensUntilFull = limits.maxTokens - bucket.tokens;
        const intervalsNeeded = Math.ceil(tokensUntilFull / limits.refillRate);
        const resetAt = bucket.lastRefill + (intervalsNeeded * this.config.refillInterval);

        return {
            remaining: bucket.tokens,
            limit: limits.maxTokens,
            resetAt,
            retryAfter: bucket.tokens === 0 ? this.config.refillInterval - timeSinceRefill : undefined,
        };
    }

    /**
     * Reset bucket to full
     */
    reset(endpoint: string = 'default'): void {
        const bucket = this.buckets.get(endpoint);
        if (bucket) {
            const limits = this.getEndpointLimits(endpoint);
            bucket.tokens = limits.maxTokens;
            bucket.lastRefill = Date.now();
        }
    }

    /**
     * Clear all buckets and timers
     */
    destroy(): void {
        for (const timer of this.refillTimers.values()) {
            clearInterval(timer);
        }
        this.refillTimers.clear();
        this.buckets.clear();
    }
}

// ============================================================================
// SLIDING WINDOW RATE LIMITER
// ============================================================================

export class SlidingWindowRateLimiter {
    private windowMs: number;
    private maxRequests: number;
    private requests: Map<string, number[]> = new Map();

    constructor(windowMs: number = 60000, maxRequests: number = 100) {
        this.windowMs = windowMs;
        this.maxRequests = maxRequests;
    }

    /**
     * Check if request is allowed and record it
     */
    async acquire(key: string = 'default'): Promise<void> {
        const now = Date.now();
        const windowStart = now - this.windowMs;

        // Get or create request log
        let requestLog = this.requests.get(key) ?? [];
        
        // Remove old requests outside window
        requestLog = requestLog.filter(timestamp => timestamp > windowStart);
        
        // Check limit
        if (requestLog.length >= this.maxRequests) {
            const oldestInWindow = requestLog[0];
            const retryAfter = oldestInWindow + this.windowMs - now;
            throw new RateLimitError(
                `Rate limit exceeded. Try again in ${Math.ceil(retryAfter / 1000)}s`,
                retryAfter
            );
        }

        // Record request
        requestLog.push(now);
        this.requests.set(key, requestLog);
    }

    /**
     * Get current rate limit info
     */
    getInfo(key: string = 'default'): RateLimitInfo {
        const now = Date.now();
        const windowStart = now - this.windowMs;
        const requestLog = (this.requests.get(key) ?? []).filter(t => t > windowStart);

        return {
            remaining: Math.max(0, this.maxRequests - requestLog.length),
            limit: this.maxRequests,
            resetAt: requestLog.length > 0 ? requestLog[0] + this.windowMs : now + this.windowMs,
        };
    }

    /**
     * Reset counter for key
     */
    reset(key: string = 'default'): void {
        this.requests.delete(key);
    }

    /**
     * Clear all counters
     */
    destroy(): void {
        this.requests.clear();
    }
}

// ============================================================================
// RATE LIMIT ERROR
// ============================================================================

export class RateLimitError extends Error {
    public readonly retryAfter: number;
    public readonly isRateLimit = true;

    constructor(message: string, retryAfter: number) {
        super(message);
        this.name = 'RateLimitError';
        this.retryAfter = retryAfter;
    }
}

// ============================================================================
// RATE LIMITED FETCH WRAPPER
// ============================================================================

export interface RateLimitedFetchOptions {
    rateLimiter: TokenBucketRateLimiter | SlidingWindowRateLimiter;
    onRateLimited?: (info: RateLimitInfo, endpoint: string) => void;
    getEndpointKey?: (url: string, init?: RequestInit) => string;
}

export function createRateLimitedFetch(options: RateLimitedFetchOptions) {
    const { rateLimiter, onRateLimited, getEndpointKey } = options;

    return async function rateLimitedFetch(
        input: RequestInfo | URL,
        init?: RequestInit
    ): Promise<Response> {
        const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
        const endpoint = getEndpointKey?.(url, init) ?? new URL(url, window.location.origin).pathname;

        try {
            // Wait for rate limit token
            await rateLimiter.acquire(endpoint);
        } catch (error) {
            if (error instanceof RateLimitError && onRateLimited) {
                onRateLimited(rateLimiter.getInfo(endpoint), endpoint);
            }
            throw error;
        }

        // Make the actual request
        const response = await fetch(input, init);

        // Handle server-side rate limiting (429)
        if (response.status === 429) {
            const retryAfter = parseInt(response.headers.get('Retry-After') ?? '60', 10) * 1000;
            const error = new RateLimitError(
                'Server rate limit exceeded',
                retryAfter
            );
            if (onRateLimited) {
                onRateLimited({ remaining: 0, limit: 0, resetAt: Date.now() + retryAfter, retryAfter }, endpoint);
            }
            throw error;
        }

        return response;
    };
}

// ============================================================================
// DEFAULT INSTANCE
// ============================================================================

export const defaultRateLimiter = new TokenBucketRateLimiter({
    maxTokens: 100,        // 100 requests max
    refillRate: 10,        // 10 tokens per second
    refillInterval: 1000,  // Refill every second
    endpointLimits: {
        '/api/analyze/*': { maxTokens: 10, refillRate: 2 },    // Heavy computation
        '/api/ai/*': { maxTokens: 20, refillRate: 5 },          // AI endpoints
        '/api/export/*': { maxTokens: 5, refillRate: 1 },       // Export limited
    },
});

// ============================================================================
// REACT HOOKS
// ============================================================================

import { useState, useCallback, useEffect } from 'react';

export function useRateLimiter(
    limiter: TokenBucketRateLimiter | SlidingWindowRateLimiter = defaultRateLimiter,
    endpoint: string = 'default'
) {
    const [info, setInfo] = useState<RateLimitInfo>(() => limiter.getInfo(endpoint));
    const [isLimited, setIsLimited] = useState(false);

    // Update info periodically
    useEffect(() => {
        const interval = setInterval(() => {
            const newInfo = limiter.getInfo(endpoint);
            setInfo(newInfo);
            setIsLimited(newInfo.remaining === 0);
        }, 1000);

        return () => clearInterval(interval);
    }, [limiter, endpoint]);

    const acquire = useCallback(async () => {
        try {
            await limiter.acquire(endpoint);
            return true;
        } catch (error) {
            if (error instanceof RateLimitError) {
                setIsLimited(true);
                return false;
            }
            throw error;
        }
    }, [limiter, endpoint]);

    const tryAcquire = useCallback(() => {
        if (limiter instanceof TokenBucketRateLimiter) {
            return limiter.tryAcquire(endpoint);
        }
        return false;
    }, [limiter, endpoint]);

    return {
        info,
        isLimited,
        acquire,
        tryAcquire,
        reset: () => limiter.reset(endpoint),
    };
}

export default {
    TokenBucketRateLimiter,
    SlidingWindowRateLimiter,
    RateLimitError,
    createRateLimitedFetch,
    defaultRateLimiter,
    useRateLimiter,
};
