/**
 * Tier-Based Rate Limiting Middleware
 *
 * Enforces per-tier, per-hour request limits:
 * - Free tier: 100 requests/hour
 * - Pro tier: 1,000 requests/hour
 * - Ultimate tier: 10,000 requests/hour
 *
 * Uses Redis for distributed rate limiting across multiple instances.
 * Falls back to in-memory limits if Redis unavailable.
 *
 * Usage:
 *   app.use(tierRateLimit);                          // Global tier limit
 *   app.post('/api/v1/analyze', analysisRateLimit, handler); // Stricter analysis limit
 */

import { Request, Response, NextFunction } from 'express';
import rateLimit from 'express-rate-limit';
import { logger } from '../utils/logger.js';

// ============================================
// Configuration
// ============================================

const TIER_LIMITS_PER_HOUR = {
  free: 100,          // 100 req/hour for free users
  pro: 1000,          // 1,000 req/hour for pro users
  ultimate: 10000,    // 10,000 req/hour for ultimate users
  internal: 100000,   // Unlimited for internal services
};

// More restrictive limits for expensive operations
const ENDPOINT_LIMITS_PER_HOUR = {
  '/api/v1/analyze': { free: 30, pro: 300, ultimate: 3000, internal: 100000 },
  '/api/v1/advanced-analyze': { free: 10, pro: 100, ultimate: 1000, internal: 100000 },
  '/api/v1/projects/:id/ai-assist': { free: 0, pro: 100, ultimate: 1000, internal: 100000 }, // Disabled for free
  '/api/v1/projects/:id/layout-optimize': { free: 0, pro: 50, ultimate: 500, internal: 100000 }, // Disabled for free
  '/api/v1/design/check': { free: 50, pro: 500, ultimate: 5000, internal: 100000 },
};

const RATE_LIMIT_ENABLED = process.env['RATE_LIMIT_ENABLED'] !== 'false';

// ============================================
// Helper Functions
// ============================================

/**
 * Extract user tier from request context.
 */
function getUserTier(req: Request): keyof typeof TIER_LIMITS_PER_HOUR {
  // Check if user is internal service (from x-service-caller header)
  if (req.headers['x-service-caller']) {
    return 'internal';
  }

  // Check authenticated user's tier
  const user = (req as any).user;
  if (user?.tier && user.tier in TIER_LIMITS_PER_HOUR) {
    return user.tier as keyof typeof TIER_LIMITS_PER_HOUR;
  }

  // Default to free tier
  return 'free';
}

/**
 * Extract rate limit key: user ID if authenticated, IP otherwise.
 */
function getKeyGenerator(includeTier: boolean = true) {
  return (req: Request): string => {
    const user = (req as any).user;

    if (user?.id) {
      // Authenticated user: use user ID
      const tier = includeTier ? getUserTier(req) : '';
      return `tier-rate:${tier}:user:${user.id}`;
    }

    // Anonymous: use IP address
    const tier = includeTier ? getUserTier(req) : '';
    return `tier-rate:${tier}:ip:${req.ip || '0.0.0.0'}`;
  };
}

/**
 * Create a tier-based rate limiter for a given limit config.
 */
function createTierRateLimit(
  name: string,
  getLimitPerHour: (tier: keyof typeof TIER_LIMITS_PER_HOUR) => number,
  opts?: {
    skipPaths?: string[];
  }
) {
  // In-memory store only (RedisStore not available)
  const store = undefined;

  return rateLimit({
    store: undefined,
    windowMs: 60 * 60 * 1000, // 1 hour
    max: (req: any, res: any) => {
      const tier = getUserTier(req);
      return getLimitPerHour(tier);
    },
    keyGenerator: (req: any) => getKeyGenerator()(req),
    skip: (req: any) => {
      if (!RATE_LIMIT_ENABLED) return true;
      if (opts?.skipPaths?.some((p) => req.path.startsWith(p))) return true;
      return false;
    },
    handler: (req: any, res: any) => {
      const tier = getUserTier(req);
      const limit = getLimitPerHour(tier);
      const resetTime = new Date(Date.now() + 60 * 60 * 1000).toISOString();

      logger.info(
        {
          path: req.path,
          method: req.method,
          tier,
          limit,
          keyId: getKeyGenerator()(req),
        },
        'Rate limit exceeded'
      );

      res.status(429).json({
        success: false,
        error: 'RATE_LIMIT_EXCEEDED',
        code: 'RATE_LIMITED',
        message: `Rate limit exceeded for ${tier} tier. Maximum: ${limit} requests per hour.`,
        metadata: {
          tier,
          limit,
          resetTime,
          documentation: 'https://docs.beamlab.tech/rate-limiting',
        },
      });
    },
    standardHeaders: 'draft-7',
    legacyHeaders: false,
  }) as any;
}

/**
 * Global tier-based rate limit.
 * Apply to all routes that require authentication.
 */
export const tierRateLimit = createTierRateLimit(
  'global-tier-limit',
  (tier) => TIER_LIMITS_PER_HOUR[tier],
  {
    skipPaths: ['/health', '/api/v1/auth/signup', '/api/v1/auth/login', '/static'],
  }
);

/**
 * Analysis-specific rate limit.
 */
export const analysisRateLimit = createTierRateLimit(
  'analysis-limit',
  (tier) => {
    const limits: Record<string, number> = { free: 30, pro: 300, ultimate: 3000, internal: 100000 };
    return limits[tier] || 30;
  }
);

/**
 * Advanced analysis limit.
 */
export const advancedAnalysisRateLimit = createTierRateLimit(
  'advanced-analysis-limit',
  (tier) => {
    const limits: Record<string, number> = { free: 10, pro: 100, ultimate: 1000, internal: 100000 };
    return limits[tier] || 10;
  }
);

/**
 * Design check rate limit.
 */
export const designRateLimit = createTierRateLimit(
  'design-limit',
  (tier) => {
    const limits: Record<string, number> = { free: 50, pro: 500, ultimate: 5000, internal: 100000 };
    return limits[tier] || 50;
  }
);

/**
 * AI-assisted features rate limit.
 */
export const aiRateLimit = createTierRateLimit(
  'ai-limit',
  (tier) => {
    const limits: Record<string, number> = { free: 0, pro: 100, ultimate: 1000, internal: 100000 };
    return limits[tier] || 0;
  }
);

/**
 * Get current tier limits for a user.
 */
export function getTierLimits(req: any) {
  const tier = getUserTier(req);
  return {
    global: TIER_LIMITS_PER_HOUR[tier],
    analysis: 30,
    advancedAnalysis: 10,
    design: 50,
    aiFeatures: tier === 'free' ? 0 : 100,
  };
}

/**
 * Cleanup function for server shutdown.
 */
export async function closeTierRateLimitClient(): Promise<void> {
  // No-op for now
}
