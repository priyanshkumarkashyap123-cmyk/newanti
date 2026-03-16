/**
 * quotaRateLimiter.ts - Quota-based Rate Limiter Middleware
 *
 * Middleware factories for enforcing per-user daily quotas on free-tier users.
 * Pro and Enterprise users bypass all quota checks immediately.
 *
 * Requirements: 3.2, 3.3, 3.7, 4.3
 */

import type { Response, NextFunction, RequestHandler } from 'express';
import { TIER_CONFIG } from '../config/tierConfig.js';
import { User, getEffectiveTier } from '../models.js';
import { QuotaService } from '../services/quotaService.js';
import type { AuthenticatedRequest } from './authMiddleware.js';

/**
 * Middleware factory for project creation quota enforcement.
 * Free-tier users are limited to TIER_CONFIG.free.maxProjectsPerDay per day.
 * Pro/Enterprise users bypass immediately.
 */
export function projectCreationRateLimiter(): RequestHandler {
  return async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    const clerkId = req.auth?.userId;

    if (!clerkId) {
      res.status(401).json({
        error: { code: 'UNAUTHORIZED', message: 'Authentication required.' },
      });
      return;
    }

    try {
      const user = await User.findOne({ clerkId }).select('tier email').lean();

      if (!user) {
        res.status(401).json({
          error: { code: 'UNAUTHORIZED', message: 'User not found.' },
        });
        return;
      }

      const effectiveTier = getEffectiveTier(user.email, user.tier);

      // Pro/Enterprise bypass
      if (effectiveTier !== 'free') {
        next();
        return;
      }

      const quota = await QuotaService.get(clerkId, (user as { _id?: unknown })._id?.toString() ?? clerkId);
      const limit = TIER_CONFIG.free.maxProjectsPerDay;

      if (quota.projectsCreated >= limit) {
        res.status(429).json({
          error: {
            code: 'PROJECT_QUOTA_EXCEEDED',
            message: `You have reached your limit of ${limit} projects for today.`,
          },
        });
        return;
      }

      next();
    } catch (err) {
      next(err);
    }
  };
}

/**
 * Middleware factory for analysis (compute unit) quota enforcement.
 * Free-tier users are limited to TIER_CONFIG.free.maxComputeUnitsPerDay per day.
 * Pro/Enterprise users bypass immediately.
 *
 * @param getNodeCount - Function to extract node count from the request
 * @param getMemberCount - Function to extract member count from the request
 */
export function analysisRateLimiter(
  getNodeCount: (req: AuthenticatedRequest) => number,
  getMemberCount: (req: AuthenticatedRequest) => number,
): RequestHandler {
  return async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    const clerkId = req.auth?.userId;

    if (!clerkId) {
      res.status(401).json({
        error: { code: 'UNAUTHORIZED', message: 'Authentication required.' },
      });
      return;
    }

    try {
      const user = await User.findOne({ clerkId }).select('tier email').lean();

      if (!user) {
        res.status(401).json({
          error: { code: 'UNAUTHORIZED', message: 'User not found.' },
        });
        return;
      }

      const effectiveTier = getEffectiveTier(user.email, user.tier);

      // Pro/Enterprise bypass
      if (effectiveTier !== 'free') {
        next();
        return;
      }

      const nodeCount = getNodeCount(req);
      const memberCount = getMemberCount(req);
      const weight = QuotaService.computeWeight(nodeCount, memberCount);

      const quota = await QuotaService.get(clerkId, (user as { _id?: unknown })._id?.toString() ?? clerkId);
      const limit = TIER_CONFIG.free.maxComputeUnitsPerDay;
      const remaining = Math.max(0, limit - quota.computeUnitsUsed);

      if (quota.computeUnitsUsed + weight > limit) {
        res.status(429).json({
          error: {
            code: 'COMPUTE_QUOTA_EXCEEDED',
            message: `You have exhausted your ${limit} analyses for today.`,
            details: {
              jobWeight: weight,
              remaining,
            },
          },
        });
        return;
      }

      next();
    } catch (err) {
      next(err);
    }
  };
}
