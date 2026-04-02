/**
 * Subscription Routes
 * GET  /api/subscription         — return current tier + feature flags
 * POST /api/subscription/upgrade — upgrade user tier
 */

import { Router, Request, Response } from 'express';
import { requireAuth, getAuth } from '../middleware/authMiddleware.js';
import { asyncHandler, HttpError } from '../utils/asyncHandler.js';
import { User } from '../models/index.js';
import { TIER_CONFIG } from '../config/tierConfig.js';
import { validateBody, subscriptionUpgradeSchema } from '../middleware/validation.js';

const router: Router = Router();

// GET /api/subscription
router.get('/', requireAuth(), asyncHandler(async (req: Request, res: Response) => {
    const { userId } = getAuth(req);
    if (!userId) throw new HttpError(401, 'Unauthorized');

    const user = await User.findOne({ clerkId: userId }).select('tier').lean();
    if (!user) throw new HttpError(404, 'User not found');

    const tier = user.tier ?? 'free';
    const features = TIER_CONFIG[tier as keyof typeof TIER_CONFIG];

    return res.ok({ tier, features });
}));

// POST /api/subscription/upgrade
router.post('/upgrade', requireAuth(), validateBody(subscriptionUpgradeSchema), asyncHandler(async (req: Request, res: Response) => {
    const { userId } = getAuth(req);
    if (!userId) throw new HttpError(401, 'Unauthorized');

    const { tier } = req.body as { tier?: string };
    if (!tier || !['free', 'pro', 'enterprise'].includes(tier)) {
        throw new HttpError(400, 'Invalid tier. Must be free, pro, or enterprise');
    }

    const user = await User.findOneAndUpdate(
        { clerkId: userId },
        { $set: { tier } },
        { new: true, select: 'tier' }
    ).lean();

    if (!user) throw new HttpError(404, 'User not found');

    const features = TIER_CONFIG[tier as keyof typeof TIER_CONFIG];
    return res.ok({ tier, features });
}));

export default router;
