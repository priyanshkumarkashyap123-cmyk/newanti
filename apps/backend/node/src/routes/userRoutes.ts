/**
 * User Activity API Routes
 * 
 * Endpoints for user activity tracking and tier management
 */

import { Router, Request, Response } from 'express';
import { requireAuth, getAuth, isUsingClerk } from '../middleware/authMiddleware.js';
import { authRateLimit } from '../middleware/security.js';
import { UserActivityService, TIER_LIMITS } from '../services/UserActivityService.js';
import { User, Subscription, getEffectiveTier, UserModel, isMasterUser } from '../models/index.js';
import { validateBody, userLoginSchema, recordAnalysisSchema, checkModelLimitsSchema, recordExportSchema, adminUpgradeSchema } from '../middleware/validation.js';
import { asyncHandler, HttpError } from '../utils/asyncHandler.js';
import { logger } from '../utils/logger.js';
import { QuotaService } from '../services/quotaService.js';
import { TIER_CONFIG } from '../config/tierConfig.js';
import { TierChangeLog } from '../models/index.js';
import { logTierChange } from '../utils/tierChangeLog.js';

// Check which auth mode is active
const USE_CLERK = isUsingClerk();
const LOCAL_AUTH_BYPASS = process.env.LOCAL_AUTH_BYPASS === 'true' || process.env.NODE_ENV !== 'production';

function toLegacyFeatures(tier: 'free' | 'pro' | 'enterprise') {
    const cfg = TIER_CONFIG[tier];
    return {
        maxProjects: Number.isFinite(cfg.maxProjectsPerDay) ? cfg.maxProjectsPerDay : -1,
        pdfExport: cfg.features.pdfExport,
        aiAssistant: cfg.features.aiAssistant,
        advancedDesignCodes: cfg.features.advancedDesignCodes,
        teamMembers: tier === 'enterprise' ? -1 : tier === 'pro' ? 3 : 1,
        prioritySupport: tier !== 'free',
        apiAccess: cfg.features.apiAccess,
    };
}

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
    if (LOCAL_AUTH_BYPASS) {
        const tier = 'enterprise' as const;
        return res.ok({
            tier,
            isLoading: false,
            expiresAt: null,
            subscription: null,
            features: toLegacyFeatures(tier),
            limits: TIER_LIMITS[tier]
        });
    }

    const { userId, email: authEmail } = getAuth(req);
    if (!userId) {
        const tier = 'free' as const;
        return res.ok({
            tier,
            isLoading: false,
            expiresAt: null,
            subscription: null,
            features: toLegacyFeatures(tier),
            limits: TIER_LIMITS[tier]
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
    const features = toLegacyFeatures(tier);

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
    const { isMasterUser } = await import('../models/index.js');

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
    let previousTier = 'free';
    let targetUserId = null;
    const clerkUser = await User.findOne({ email: email.toLowerCase() }).lean();
    if (clerkUser) {
        previousTier = clerkUser.tier || 'free';
        targetUserId = clerkUser._id;
        await User.updateOne({ _id: clerkUser._id }, { $set: { tier } });
        updated = true;
        logger.info(`[Admin] Updated Clerk user to tier: ${tier}`);
    }

    // Try in-house user
    const inHouseUser = await UserModel.findOne({ email: email.toLowerCase() }).lean();
    if (inHouseUser) {
        if (!targetUserId) previousTier = inHouseUser.subscriptionTier || 'free';
        await UserModel.updateOne({ _id: inHouseUser._id }, { $set: { subscriptionTier: tier } });
        updated = true;
        logger.info(`[Admin] Updated in-house user to tier: ${tier}`);
    }

    if (!updated) {
        throw new HttpError(404, 'User not found');
    }

    // Log tier change for audit trail
    if (targetUserId) {
        await logTierChange(targetUserId, previousTier, tier, 'admin');
    }

    return res.ok({ email, tier, message: `User ${email} upgraded to ${tier}` });
}));

// ============================================
// GET /user/admin/users/:id/tier-history - Get tier change history for a user
// ============================================

router.get('/admin/users/:id/tier-history', requireAuth(), asyncHandler(async (req: Request, res: Response) => {
    const { userId: adminUserId } = getAuth(req);
    if (!adminUserId) throw new HttpError(401, 'Unauthorized');

    // Check admin access
    const adminUser = await User.findOne({ clerkId: adminUserId }).lean();
    const adminEmail = adminUser?.email || null;
    if (!isMasterUser(adminEmail)) {
        throw new HttpError(403, 'Admin access required');
    }

    const targetUserId = req.params.id;
    const history = await TierChangeLog.find({ userId: targetUserId })
        .sort({ timestamp: -1 })
        .limit(100)
        .lean();

    return res.ok({ userId: targetUserId, history });
}));

// ============================================
// GET /user/quota - Get current user's quota status
// ============================================

router.get('/quota', requireAuth(), asyncHandler(async (req: Request, res: Response) => {
    const { userId } = getAuth(req);
    if (!userId) throw new HttpError(401, 'Unauthorized');

    // Look up user to get MongoDB _id and tier
    const user = await User.findOne({ clerkId: userId }).select('_id tier email').lean();
    if (!user) throw new HttpError(404, 'User not found');

    const effectiveTier = getEffectiveTier(user.email, user.tier);
    const tierCfg = TIER_CONFIG[effectiveTier];

    // Get today's quota record
    const quota = await QuotaService.get(userId, user._id.toString());

    const projectsRemaining = tierCfg.maxProjectsPerDay === Infinity
        ? null
        : Math.max(0, tierCfg.maxProjectsPerDay - quota.projectsCreated);

    const computeUnitsRemaining = tierCfg.maxComputeUnitsPerDay === Infinity
        ? null
        : Math.max(0, tierCfg.maxComputeUnitsPerDay - quota.computeUnitsUsed);

    // localComputeAvailable is set by the client via a header or query param
    // The client sends X-WebGPU-Available: true/false header
    const localComputeAvailable = req.headers['x-webgpu-available'] === 'true';

    return res.ok({
        tier: effectiveTier,
        projectsRemaining,
        computeUnitsRemaining,
        projectsCreated: quota.projectsCreated,
        computeUnitsUsed: quota.computeUnitsUsed,
        localComputeAvailable,
    });
}));

export default router;
