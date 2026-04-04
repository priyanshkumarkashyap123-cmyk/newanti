/**
 * requireFeature.ts - Feature-Gating Middleware
 *
 * Express middleware factory that enforces subscription tier feature access.
 * Looks up the user's tier from the DB and checks TIER_CONFIG[tier].features[feature].
 * Returns HTTP 403 with FEATURE_NOT_IN_TIER error code if the feature is not available.
 */

import type { RequestHandler, Response, NextFunction } from 'express';
import { FeatureFlags, TIER_CONFIG } from '../config/tierConfig.js';
import { User, getEffectiveTier } from '../models/index.js';
import type { AuthenticatedRequest } from './authMiddleware.js';

export function requireFeature(feature: keyof FeatureFlags): RequestHandler {
  return async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    const clerkId = req.auth?.userId;

    if (!clerkId) {
      res.status(401).json({
        error: {
          code: 'UNAUTHORIZED',
          message: 'Authentication required.',
        },
      });
      return;
    }

    try {
      const user = await User.findOne({ clerkId }).select('tier email').lean();

      if (!user) {
        res.status(401).json({
          error: {
            code: 'UNAUTHORIZED',
            message: 'User not found.',
          },
        });
        return;
      }

      const effectiveTier = getEffectiveTier(user.email, user.tier);
      const hasFeature = TIER_CONFIG[effectiveTier].features[feature];

      if (!hasFeature) {
        res.status(403).json({
          error: {
            code: 'FEATURE_NOT_IN_TIER',
            message: `Feature ${feature} is not available on your current plan.`,
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
