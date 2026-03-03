/**
 * User Activity API Routes
 * 
 * Endpoints for user activity tracking and tier management
 */

import { Router, Request, Response } from 'express';
import { requireAuth, getAuth } from '../middleware/authMiddleware.js';
import { authRateLimit } from '../middleware/security.js';
import { UserActivityService, TIER_LIMITS } from '../services/UserActivityService.js';
import { User, Subscription, getEffectiveTier, UserModel, isMasterUser } from '../models.js';
import { validateBody, userLoginSchema, recordAnalysisSchema, checkModelLimitsSchema, recordExportSchema, adminUpgradeSchema } from '../middleware/validation.js';
import { asyncHandler, HttpError } from '../utils/asyncHandler.js';
import { logger } from '../utils/logger.js';

// Check which auth mode is active
const USE_CLERK = process.env['USE_CLERK'] === 'true';

const router: Router = Router();

// ============================================
// GET /user/profile - Get user profile with activity
// ============================================

router.get('/profile', requireAuth(), asyncHandler(async (req: Request, res: Response) => {
    const { userId } = getAuth(req);
    if (!userId) {
        throw new HttpError(401, 'Unauthorized');
    }

    const summary = await UserActivityService.getActivitySummary(userId);
    if (!summary) {
        throw new HttpError(404, 'User not found');
    }

    return res.ok(summary);
}));

// ============================================
// POST /user/login - Record login
// ============================================

router.post('/login', requireAuth(), validateBody(userLoginSchema), asyncHandler(async (req: Request, res: Response) => {
    const { userId } = getAuth(req);
    const { email } = req.body;

    if (!userId) {
        throw new HttpError(401, 'Unauthorized');
    }

    // Create user if doesn't exist, or update login
    let user = await UserActivityService.getOrCreateUser(userId, email || 'unknown@beamlab.com');
    user = await UserActivityService.recordLogin(userId);

    return res.ok({
        tier: user?.tier || 'free',
        lastLogin: user?.lastLogin
    });
}));

// ============================================
// GET /user/limits - Get tier limits
// ============================================

router.get('/limits', requireAuth(), asyncHandler(async (req: Request, res: Response) => {
    const { userId, email: authEmail } = getAuth(req);
    if (!userId) {
        throw new HttpError(401, 'Unauthorized');
    }

    let userEmail: string = '';
    let dbTier: 'free' | 'pro' | 'enterprise' = 'free';

    if (USE_CLERK) {
        const user = await User.findOne({ clerkId: userId }).lean();
        userEmail = user?.email || '';
        dbTier = user?.tier || 'free';
    } else {
        const user = await UserModel.findById(userId).lean();
        userEmail = user?.email || authEmail || '';
        dbTier = user?.subscriptionTier || 'free';
    }

    const tier = getEffectiveTier(userEmail, dbTier);
    const limits = TIER_LIMITS[tier];

    return res.ok({ tier, limits });
}));

// ============================================
// GET /user/subscription - Get complete subscription status
// ============================================

router.get('/subscription', requireAuth(), asyncHandler(async (req: Request, res: Response) => {
    const { userId, email: authEmail } = getAuth(req);
    if (!userId) {
        // Return free tier for unauthenticated users instead of 401
        return res.ok({
            tier: 'free',
            isLoading: false,
            expiresAt: null,
            subscription: null,
            features: {
                maxProjects: 3,
                pdfExport: false,
                aiAssistant: false,
                advancedDesignCodes: false,
                teamMembers: 1,
                prioritySupport: false,
                apiAccess: false
            },
            limits: TIER_LIMITS['free']
        });
    }

    let userEmail: string = authEmail || '';
    let dbTier: 'free' | 'pro' | 'enterprise' = 'free';
    let subscriptionData = null;

    try {
        if (USE_CLERK) {
            // Clerk auth: lookup by clerkId
            const user = await User.findOne({ clerkId: userId }).lean();
            if (user) {
                userEmail = user.email || userEmail;
                dbTier = user.tier || 'free';

                // Get subscription details if exists
                if (user.subscription) {
                    const subscription = await Subscription.findById(user.subscription).lean();
                    if (subscription) {
                        subscriptionData = {
                            status: subscription.status,
                            currentPeriodEnd: subscription.currentPeriodEnd,
                            cancelAtPeriodEnd: subscription.cancelAtPeriodEnd
                        };
                    }
                }
            }
        } else {
            // In-house auth: lookup by _id
            const user = await UserModel.findById(userId).lean();
            if (user) {
                userEmail = user.email || authEmail || '';
                dbTier = user.subscriptionTier || 'free';
            }
        }
    } catch (dbError) {
        logger.warn({ err: dbError }, '[Subscription] Database lookup failed, using defaults');
        // Continue with defaults
    }

    // Use getEffectiveTier to check for master user elevation
    const tier = getEffectiveTier(userEmail, dbTier);
    logger.info(`[Subscription] userId=${userId}, dbTier=${dbTier}, effectiveTier=${tier}`);

    const limits = TIER_LIMITS[tier];

    // Feature access based on tier
    const features = {
        maxProjects: tier === 'free' ? 3 : -1,
        pdfExport: tier !== 'free',
        aiAssistant: tier !== 'free',
        advancedDesignCodes: tier !== 'free',
        teamMembers: tier === 'free' ? 1 : tier === 'pro' ? 5 : -1,
        prioritySupport: tier !== 'free',
        apiAccess: tier === 'enterprise'
    };

    return res.ok({
        tier,
        isLoading: false,
        expiresAt: subscriptionData?.currentPeriodEnd || null,
        subscription: subscriptionData,
        features,
        limits
    });
}));

// ============================================
// POST /user/check-analysis - Check if user can run analysis
// ============================================

router.post('/check-analysis', requireAuth(), asyncHandler(async (req: Request, res: Response) => {
    const { userId } = getAuth(req);
    if (!userId) {
        throw new HttpError(401, 'Unauthorized');
    }

    const result = await UserActivityService.canRunAnalysis(userId);
    return res.ok(result);
}));

// ============================================
// POST /user/record-analysis - Record an analysis run
// ============================================

router.post('/record-analysis', requireAuth(), validateBody(recordAnalysisSchema), asyncHandler(async (req: Request, res: Response) => {
    const { userId } = getAuth(req);
    const { nodeCount, memberCount } = req.body;

    if (!userId) {
        throw new HttpError(401, 'Unauthorized');
    }

    // Record the analysis
    await UserActivityService.recordAnalysis(userId, { nodeCount, memberCount });

    return res.ok({ recorded: true });
}));

// ============================================
// POST /user/check-model-limits - Check node/member limits
// ============================================

router.post('/check-model-limits', requireAuth(), validateBody(checkModelLimitsSchema), asyncHandler(async (req: Request, res: Response) => {
    const { userId } = getAuth(req);
    const { nodeCount, memberCount } = req.body;

    if (!userId) {
        throw new HttpError(401, 'Unauthorized');
    }

    const result = await UserActivityService.checkModelLimits(
        userId,
        nodeCount || 0,
        memberCount || 0
    );

    return res.ok(result);
}));

// ============================================
// POST /user/record-export - Record PDF export
// ============================================

router.post('/record-export', requireAuth(), validateBody(recordExportSchema), asyncHandler(async (req: Request, res: Response) => {
    const { userId } = getAuth(req);
    if (!userId) {
        throw new HttpError(401, 'Unauthorized');
    }

    await UserActivityService.recordExport(userId);
    return res.ok({ recorded: true });
}));

// ============================================
// GET /user/activity - Get recent activity log
// ============================================

router.get('/activity', requireAuth(), asyncHandler(async (req: Request, res: Response) => {
    const { userId } = getAuth(req);
    if (!userId) {
        throw new HttpError(401, 'Unauthorized');
    }

    if (USE_CLERK) {
        const user = await User.findOne({ clerkId: userId }).lean();
        if (!user) {
            throw new HttpError(404, 'User not found');
        }

        return res.ok({
            recentActivity: user.activityLog.slice(-20).reverse(),
            totalAnalysisRuns: user.totalAnalysisRuns,
            totalExports: user.totalExports,
            lastLogin: user.lastLogin
        });
    } else {
        const user = await UserModel.findById(userId).lean();
        if (!user) {
            throw new HttpError(404, 'User not found');
        }

        return res.ok({
            recentActivity: [],
            totalAnalysisRuns: 0,
            totalExports: 0,
            lastLogin: user.lastLoginAt
        });
    }
}));

// ============================================
// PUT /user/admin/upgrade - Admin endpoint to upgrade user tier
// ============================================

router.put('/admin/upgrade', authRateLimit, requireAuth(), validateBody(adminUpgradeSchema), asyncHandler(async (req: Request, res: Response) => {
    const { userId: adminUserId } = getAuth(req);
    if (!adminUserId) {
        throw new HttpError(401, 'Unauthorized');
    }

    // Fetch admin email from database to check master user status
    const { isMasterUser } = await import('../models.js');

    // Check Clerk user first, then in-house user
    const clerkAdminUser = await User.findOne({ clerkId: adminUserId }).lean();
    const inHouseAdminUser = await UserModel.findById(adminUserId).lean();
    const adminEmail = clerkAdminUser?.email || inHouseAdminUser?.email || null;

    if (!isMasterUser(adminEmail)) {
        throw new HttpError(403, 'Admin access required');
    }

    const { email, tier } = req.body;
    if (!email || !tier) {
        throw new HttpError(400, 'Email and tier are required');
    }

    if (!['free', 'pro', 'enterprise'].includes(tier)) {
        throw new HttpError(400, 'Invalid tier. Must be free, pro, or enterprise');
    }

    // Try Clerk user first
    let updated = false;
    const clerkUser = await User.findOne({ email: email.toLowerCase() }).lean();
    if (clerkUser) {
        await User.updateOne({ _id: clerkUser._id }, { $set: { tier } });
        updated = true;
        logger.info(`[Admin] Updated Clerk user to tier: ${tier}`);
    }

    // Try in-house user
    const inHouseUser = await UserModel.findOne({ email: email.toLowerCase() }).lean();
    if (inHouseUser) {
        await UserModel.updateOne({ _id: inHouseUser._id }, { $set: { subscriptionTier: tier } });
        updated = true;
        logger.info(`[Admin] Updated in-house user to tier: ${tier}`);
    }

    if (!updated) {
        throw new HttpError(404, 'User not found');
    }

    return res.ok({ email, tier, message: `User ${email} upgraded to ${tier}` });
}));

export default router;
