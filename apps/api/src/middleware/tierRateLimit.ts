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
import rateLimit, { RateLimitRequestWildcard } from 'express-rate-limit';
import RedisStore from 'rate-limit-redis';
import { createClient } from 'redis';
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

const REDIS_URL = process.env['REDIS_URL'] || 'redis://redis:6379';
const RATE_LIMIT_ENABLED = process.env['RATE_LIMIT_ENABLED'] !== 'false';

// ============================================
// Redis Client Setup
// ============================================

let redisClient: ReturnType<typeof createClient> | null = null;
let redisReady = false;

async function initRedisClient(): Promise<ReturnType<typeof createClient> | null> {
  if (redisClient?.isOpen) {
    return redisClient;
  }

  try {
    const client = createClient({
      url: REDIS_URL,
      socket: {
        reconnectStrategy: (retries) => Math.min(retries * 100, 3000),
        connectTimeout: 5000,
      },
    });

    client.on('error', (err) => {
      logger.warn({ err }, 'Tier rate limit Redis error; falling back to in-memory');
      redisReady = false;
    });

    client.on('connect', () => {
      logger.info('Tier rate limit Redis connected');
      redisReady = true;
    });

    await client.connect();
    redisClient = client;
    redisReady = true;
    return client;
  } catch (err) {
    logger.warn({ err }, 'Failed to init tier rate limit Redis; using in-memory limits');
    return null;
  }
}

// Initialize on module load (non-blocking)
initRedisClient().catch((err) => {
  logger.warn({ err }, 'Failed to initialize Redis client for tier rate limiting');
});

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
  const store = redisReady && redisClient
    ? new RedisStore({
        client: redisClient as any,
        prefix: 'tier-rate:',
        sendUnAcknowledgedMessages: true,
      })
    : undefined;

  return rateLimit({
    store,
    windowMs: 60 * 60 * 1000, // 1 hour
    max: (req, res) => {
      const tier = getUserTier(req);
      return getLimitPerHour(tier);
    },
    keyGenerator: getKeyGenerator(),
    skip: (req) => {
      if (!RATE_LIMIT_ENABLED) return true;
      if (opts?.skipPaths?.some((p) => req.path.startsWith(p))) return true;
      return false;
    },
    handler: (req, res) => {
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
  });
}

// ============================================
// Tier Rate Limiters (Exported)
// ============================================

/**
 * Global tier-based rate limit (all tier limits per hour).
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
 * Analysis-specific rate limit (more restrictive than global).
 * Apply to /analyze and /advanced-analyze endpoints.
 */
export const analysisRateLimit = createTierRateLimit(
  'analysis-limit',
  (tier) => ENDPOINT_LIMITS_PER_HOUR['/api/v1/analyze'][tier]
);

/**
 * Advanced analysis limit (most restrictive).
 * Apply to 3D analysis and premium features.
 */
export const advancedAnalysisRateLimit = createTierRateLimit(
  'advanced-analysis-limit',
  (tier) => ENDPOINT_LIMITS_PER_HOUR['/api/v1/advanced-analyze'][tier]
);

/**
 * Design check rate limit.
 */
export const designRateLimit = createTierRateLimit(
  'design-limit',
  (tier) => ENDPOINT_LIMITS_PER_HOUR['/api/v1/design/check'][tier]
);

/**
 * AI-assisted features rate limit (not available for free tier).
 */
export const aiRateLimit = createTierRateLimit(
  'ai-limit',
  (tier) => {
    const limit = ENDPOINT_LIMITS_PER_HOUR['/api/v1/projects/:id/ai-assist'][tier];
    // Block if limit is 0
    return limit;
  }
);

/**
 * Quick reference: Get current tier limits for a user.
 *
 * Usage:
 *   const limits = getTierLimits(req);
 *   console.log(limits); // { global: 100, analysis: 30 }
 */
export function getTierLimits(req: Request) {
  const tier = getUserTier(req);
  return {
    global: TIER_LIMITS_PER_HOUR[tier],
    analysis: ENDPOINT_LIMITS_PER_HOUR['/api/v1/analyze'][tier],
    advancedAnalysis: ENDPOINT_LIMITS_PER_HOUR['/api/v1/advanced-analyze'][tier],
    design: ENDPOINT_LIMITS_PER_HOUR['/api/v1/design/check'][tier],
    aiFeatures: ENDPOINT_LIMITS_PER_HOUR['/api/v1/projects/:id/ai-assist'][tier],
  };
}

/**
 * Cleanup function for server shutdown.
 */
export async function closeTierRateLimitClient(): Promise<void> {
  if (redisClient?.isOpen) {
    try {
      await redisClient.quit();
      logger.info('Tier rate limit Redis client closed');
    } catch (err) {
      logger.warn({ err }, 'Error closing tier rate limit Redis client');
    }
  }
}
