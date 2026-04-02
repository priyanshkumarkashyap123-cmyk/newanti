/**
 * ============================================================================
 * AI Rate Limiting Middleware
 * ============================================================================
 * 
 * Server-side rate limiting for all AI endpoints.
 * 
 * Features:
 * - Per-IP sliding window rate limiting
 * - Per-endpoint configurable limits
 * - Cost-weighted limiting (expensive endpoints use more tokens)
 * - Graceful degradation headers (X-RateLimit-*)
 * - Optional API key-based per-user limits
 * 
 * @version 1.0.0
 */

import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger.js';

// ============================================================================
// CONFIGURATION
// ============================================================================

interface RateLimitConfig {
  /** Requests per window */
  maxRequests: number;
  /** Window size in milliseconds */
  windowMs: number;
  /** Cost multiplier (expensive endpoints count for more) */
  costWeight: number;
  /** Custom message on limit */
  message?: string;
}

/** Default limits per endpoint category */
const ENDPOINT_LIMITS: Record<string, RateLimitConfig> = {
  '/generate': { maxRequests: 10, windowMs: 60_000, costWeight: 3, message: 'Structure generation rate limit exceeded' },
  '/chat': { maxRequests: 30, windowMs: 60_000, costWeight: 1 },
  '/validate': { maxRequests: 60, windowMs: 60_000, costWeight: 0.5 },
  '/code-check': { maxRequests: 20, windowMs: 60_000, costWeight: 2 },
  '/accuracy': { maxRequests: 30, windowMs: 60_000, costWeight: 0.5 },
  '/diagnose': { maxRequests: 15, windowMs: 60_000, costWeight: 2 },
  '/auto-fix': { maxRequests: 10, windowMs: 60_000, costWeight: 3 },
  '/modify': { maxRequests: 15, windowMs: 60_000, costWeight: 2 },
  '/sketch': { maxRequests: 5, windowMs: 60_000, costWeight: 5 },
  default: { maxRequests: 30, windowMs: 60_000, costWeight: 1 },
};

/** Global limits (across all AI endpoints) */
const GLOBAL_LIMIT: RateLimitConfig = {
  maxRequests: 100,
  windowMs: 60_000,
  costWeight: 1,
  message: 'Global AI rate limit exceeded. Please wait before making more requests.',
};

// ============================================================================
// IN-MEMORY STORE
// ============================================================================

interface RequestRecord {
  timestamp: number;
  cost: number;
}

class RateLimitStore {
  private windows: Map<string, RequestRecord[]> = new Map();
  private cleanupInterval: ReturnType<typeof setInterval>;

  constructor() {
    // Cleanup stale entries every 5 minutes
    this.cleanupInterval = setInterval(() => this.cleanup(), 5 * 60_000);
  }

  /**
   * Record a request and check if within limits
   */
  check(key: string, config: RateLimitConfig): { allowed: boolean; remaining: number; resetAt: number } {
    const now = Date.now();
    const windowStart = now - config.windowMs;

    // Get or create window
    let records = this.windows.get(key) || [];

    // Remove expired entries
    records = records.filter(r => r.timestamp > windowStart);

    // Calculate weighted usage
    const totalCost = records.reduce((sum, r) => sum + r.cost, 0);
    const remaining = Math.max(0, config.maxRequests - totalCost);
    const oldestInWindow = records.length > 0 ? records[0].timestamp : now;
    const resetAt = oldestInWindow + config.windowMs;

    if (totalCost >= config.maxRequests) {
      this.windows.set(key, records);
      return { allowed: false, remaining: 0, resetAt };
    }

    // Record this request
    records.push({ timestamp: now, cost: config.costWeight });
    this.windows.set(key, records);

    return { allowed: true, remaining: Math.max(0, remaining - config.costWeight), resetAt };
  }

  private cleanup() {
    const now = Date.now();
    const maxWindow = Math.max(...Object.values(ENDPOINT_LIMITS).map(c => c.windowMs), GLOBAL_LIMIT.windowMs);

    for (const [key, records] of this.windows.entries()) {
      const active = records.filter(r => r.timestamp > now - maxWindow);
      if (active.length === 0) {
        this.windows.delete(key);
      } else {
        this.windows.set(key, active);
      }
    }
  }

  /** Get current state for a key (for monitoring) */
  getUsage(key: string, windowMs: number): number {
    const records = this.windows.get(key) || [];
    const windowStart = Date.now() - windowMs;
    return records.filter(r => r.timestamp > windowStart).reduce((sum, r) => sum + r.cost, 0);
  }

  destroy() {
    clearInterval(this.cleanupInterval);
    this.windows.clear();
  }
}

// ============================================================================
// MIDDLEWARE
// ============================================================================

const store = new RateLimitStore();

/**
 * Get identifier for rate limiting (IP or API key)
 */
function getClientId(req: Request): string {
  // Prefer API key if present
  const apiKey = req.headers['x-api-key'] as string;
  if (apiKey) {
    return `key:${apiKey.slice(0, 16)}`;
  }

  // Fall back to IP
  const ip = req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown';
  return `ip:${ip}`;
}

/**
 * Get endpoint category from request path
 */
function getEndpointCategory(path: string): string {
  for (const endpoint of Object.keys(ENDPOINT_LIMITS)) {
    if (endpoint !== 'default' && path.includes(endpoint)) {
      return endpoint;
    }
  }
  return 'default';
}

/**
 * Express middleware for AI rate limiting
 */
export function aiRateLimiter(customConfig?: Partial<Record<string, RateLimitConfig>>) {
  const limits = { ...ENDPOINT_LIMITS, ...customConfig };

  return (req: Request, res: Response, next: NextFunction) => {
    const clientId = getClientId(req);
    const endpointCategory = getEndpointCategory(req.path);
    const config = limits[endpointCategory] || limits.default!;

    // Check per-endpoint limit
    const endpointKey = `${clientId}:${endpointCategory}`;
    const endpointResult = store.check(endpointKey, config);

    // Check global limit
    const globalKey = `${clientId}:global`;
    const globalResult = store.check(globalKey, GLOBAL_LIMIT);

    // Set rate limit headers
    res.setHeader('X-RateLimit-Limit', config.maxRequests.toString());
    res.setHeader('X-RateLimit-Remaining', Math.min(endpointResult.remaining, globalResult.remaining).toString());
    res.setHeader('X-RateLimit-Reset', Math.max(endpointResult.resetAt, globalResult.resetAt).toString());

    // Check if either limit is exceeded
    if (!endpointResult.allowed) {
      logger.warn(`[RateLimit] Endpoint limit hit: ${clientId} on ${endpointCategory}`);
      res.setHeader('Retry-After', Math.ceil((endpointResult.resetAt - Date.now()) / 1000).toString());
      return res.status(429).json({
        success: false,
        error: config.message || `Rate limit exceeded for ${endpointCategory}. Try again later.`,
        retryAfter: Math.ceil((endpointResult.resetAt - Date.now()) / 1000),
      });
    }

    if (!globalResult.allowed) {
      logger.warn(`[RateLimit] Global limit hit: ${clientId}`);
      res.setHeader('Retry-After', Math.ceil((globalResult.resetAt - Date.now()) / 1000).toString());
      return res.status(429).json({
        success: false,
        error: GLOBAL_LIMIT.message,
        retryAfter: Math.ceil((globalResult.resetAt - Date.now()) / 1000),
      });
    }

    next();
  };
}

/**
 * Get usage stats (for monitoring dashboard)
 */
export function getAIRateLimitStats(clientId: string): Record<string, { usage: number; limit: number }> {
  const stats: Record<string, { usage: number; limit: number }> = {};

  for (const [endpoint, config] of Object.entries(ENDPOINT_LIMITS)) {
    const key = `${clientId}:${endpoint}`;
    stats[endpoint] = {
      usage: store.getUsage(key, config.windowMs),
      limit: config.maxRequests,
    };
  }

  stats.global = {
    usage: store.getUsage(`${clientId}:global`, GLOBAL_LIMIT.windowMs),
    limit: GLOBAL_LIMIT.maxRequests,
  };

  return stats;
}

export default aiRateLimiter;
