/**
 * User Activity API Routes
 * 
 * Endpoints for user activity tracking and tier management
 */

import { Router, Request, Response } from 'express';
import { requireAuth, getAuth } from '../middleware/authMiddleware.js';
import { UserActivityService, TIER_LIMITS } from '../services/UserActivityService.js';
import { User, Subscription, getEffectiveTier, UserModel, isMasterUser } from '../models.js';
import { validateBody, userLoginSchema, recordAnalysisSchema, checkModelLimitsSchema, recordExportSchema, adminUpgradeSchema } from '../middleware/validation.js';

// Check which auth mode is active
const USE_CLERK = process.env['USE_CLERK'] === 'true';

const router: Router = Router();

// ============================================
// GET /user/profile - Get user profile with activity
// ============================================

router.get('/profile', requireAuth(), async (req: Request, res: Response) => {
    try {
        const { userId } = getAuth(req);
        if (!userId) {
            return res.fail('UNAUTHORIZED', 'Unauthorized', 401);
        }

        const summary = await UserActivityService.getActivitySummary(userId);
        if (!summary) {
            return res.fail('NOT_FOUND', 'User not found', 404);
        }

        return res.ok(summary);
    } catch (error) {
        console.error('[UserRoutes] /profile error:', error);
        return res.fail('INTERNAL_ERROR', 'Server error');
    }
});

// ============================================
// POST /user/login - Record login
// ============================================

router.post('/login', requireAuth(), validateBody(userLoginSchema), async (req: Request, res: Response) => {
    try {
        const { userId } = getAuth(req);
        const { email } = req.body;

        if (!userId) {
            return res.fail('UNAUTHORIZED', 'Unauthorized', 401);
        }

        // Create user if doesn't exist, or update login
        let user = await UserActivityService.getOrCreateUser(userId, email || 'unknown@beamlab.com');
        user = await UserActivityService.recordLogin(userId);

        return res.ok({
            tier: user?.tier || 'free',
            lastLogin: user?.lastLogin
        });
    } catch (error) {
        console.error('[UserRoutes] /login error:', error);
        return res.fail('INTERNAL_ERROR', 'Server error');
    }
});

// ============================================
// GET /user/limits - Get tier limits
// ============================================

router.get('/limits', requireAuth(), async (req: Request, res: Response) => {
    try {
        const { userId, email: authEmail } = getAuth(req);
        if (!userId) {
            return res.fail('UNAUTHORIZED', 'Unauthorized', 401);
        }

        let userEmail: string = '';
        let dbTier: 'free' | 'pro' | 'enterprise' = 'free';

        if (USE_CLERK) {
            const user = await User.findOne({ clerkId: userId });
            userEmail = user?.email || '';
            dbTier = user?.tier || 'free';
        } else {
            const user = await UserModel.findById(userId);
            userEmail = user?.email || authEmail || '';
            dbTier = user?.subscriptionTier || 'free';
        }

        const tier = getEffectiveTier(userEmail, dbTier);
        const limits = TIER_LIMITS[tier];

        return res.ok({ tier, limits });
    } catch (error) {
        console.error('[UserRoutes] /limits error:', error);
        return res.fail('INTERNAL_ERROR', 'Server error');
    }
});

// ============================================
// GET /user/subscription - Get complete subscription status
// ============================================

router.get('/subscription', requireAuth(), async (req: Request, res: Response) => {
    try {
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
                const user = await User.findOne({ clerkId: userId });
                if (user) {
                    userEmail = user.email || userEmail;
                    dbTier = user.tier || 'free';

                    // Get subscription details if exists
                    if (user.subscription) {
                        const subscription = await Subscription.findById(user.subscription);
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
                const user = await UserModel.findById(userId);
                if (user) {
                    userEmail = user.email || authEmail || '';
                    dbTier = user.subscriptionTier || 'free';
                }
            }
        } catch (dbError) {
            console.warn('[Subscription] Database lookup failed, using defaults:', dbError);
            // Continue with defaults
        }

        // Use getEffectiveTier to check for master user elevation
        const tier = getEffectiveTier(userEmail, dbTier);
        console.log(`[Subscription] userId=${userId}, dbTier=${dbTier}, effectiveTier=${tier}`);

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
    } catch (error) {
        console.error('[UserRoutes] /subscription error:', error);
        return res.fail('INTERNAL_ERROR', 'Server error');
    }
});

// ============================================
// POST /user/check-analysis - Check if user can run analysis
// ============================================

router.post('/check-analysis', requireAuth(), async (req: Request, res: Response) => {
    try {
        const { userId } = getAuth(req);
        if (!userId) {
            return res.fail('UNAUTHORIZED', 'Unauthorized', 401);
        }

        const result = await UserActivityService.canRunAnalysis(userId);
        return res.ok(result);
    } catch (error) {
        console.error('[UserRoutes] /check-analysis error:', error);
        return res.fail('INTERNAL_ERROR', 'Server error');
    }
});

// ============================================
// POST /user/record-analysis - Record an analysis run
// ============================================

router.post('/record-analysis', requireAuth(), validateBody(recordAnalysisSchema), async (req: Request, res: Response) => {
    try {
        const { userId } = getAuth(req);
        const { nodeCount, memberCount } = req.body;

        if (!userId) {
            return res.fail('UNAUTHORIZED', 'Unauthorized', 401);
        }

        // Record the analysis
        await UserActivityService.recordAnalysis(userId, { nodeCount, memberCount });

        return res.ok({ recorded: true });
    } catch (error) {
        console.error('[UserRoutes] /record-analysis error:', error);
        return res.fail('INTERNAL_ERROR', 'Server error');
    }
});

// ============================================
// POST /user/check-model-limits - Check node/member limits
// ============================================

router.post('/check-model-limits', requireAuth(), validateBody(checkModelLimitsSchema), async (req: Request, res: Response) => {
    try {
        const { userId } = getAuth(req);
        const { nodeCount, memberCount } = req.body;

        if (!userId) {
            return res.fail('UNAUTHORIZED', 'Unauthorized', 401);
        }

        const result = await UserActivityService.checkModelLimits(
            userId,
            nodeCount || 0,
            memberCount || 0
        );

        return res.ok(result);
    } catch (error) {
        console.error('[UserRoutes] /check-model-limits error:', error);
        return res.fail('INTERNAL_ERROR', 'Server error');
    }
});

// ============================================
// POST /user/record-export - Record PDF export
// ============================================

router.post('/record-export', requireAuth(), validateBody(recordExportSchema), async (req: Request, res: Response) => {
    try {
        const { userId } = getAuth(req);
        if (!userId) {
            return res.fail('UNAUTHORIZED', 'Unauthorized', 401);
        }

        await UserActivityService.recordExport(userId);
        return res.ok({ recorded: true });
    } catch (error) {
        console.error('[UserRoutes] /record-export error:', error);
        return res.fail('INTERNAL_ERROR', 'Server error');
    }
});

// ============================================
// GET /user/activity - Get recent activity log
// ============================================

router.get('/activity', requireAuth(), async (req: Request, res: Response) => {
    try {
        const { userId } = getAuth(req);
        if (!userId) {
            return res.fail('UNAUTHORIZED', 'Unauthorized', 401);
        }

        if (USE_CLERK) {
            const user = await User.findOne({ clerkId: userId });
            if (!user) {
                return res.fail('NOT_FOUND', 'User not found', 404);
            }

            return res.ok({
                recentActivity: user.activityLog.slice(-20).reverse(),
                totalAnalysisRuns: user.totalAnalysisRuns,
                totalExports: user.totalExports,
                lastLogin: user.lastLogin
            });
        } else {
            const user = await UserModel.findById(userId);
            if (!user) {
                return res.fail('NOT_FOUND', 'User not found', 404);
            }

            return res.ok({
                recentActivity: [],
                totalAnalysisRuns: 0,
                totalExports: 0,
                lastLogin: user.lastLoginAt
            });
        }
    } catch (error) {
        console.error('[UserRoutes] /activity error:', error);
        return res.fail('INTERNAL_ERROR', 'Server error');
    }
});

// ============================================
// PUT /user/admin/upgrade - Admin endpoint to upgrade user tier
// ============================================

router.put('/admin/upgrade', requireAuth(), validateBody(adminUpgradeSchema), async (req: Request, res: Response) => {
    try {
        const { userId: adminUserId } = getAuth(req);
        if (!adminUserId) {
            return res.fail('UNAUTHORIZED', 'Unauthorized', 401);
        }

        // Fetch admin email from database to check master user status
        const { isMasterUser } = await import('../models.js');

        // Check Clerk user first, then in-house user
        const clerkAdminUser = await User.findOne({ clerkId: adminUserId });
        const inHouseAdminUser = await UserModel.findById(adminUserId);
        const adminEmail = clerkAdminUser?.email || inHouseAdminUser?.email || null;

        if (!isMasterUser(adminEmail)) {
            return res.fail('FORBIDDEN', 'Admin access required', 403);
        }

        const { email, tier } = req.body;
        if (!email || !tier) {
            return res.fail('VALIDATION_ERROR', 'Email and tier are required', 400);
        }

        if (!['free', 'pro', 'enterprise'].includes(tier)) {
            return res.fail('VALIDATION_ERROR', 'Invalid tier. Must be free, pro, or enterprise', 400);
        }

        // Try Clerk user first
        let updated = false;
        const clerkUser = await User.findOne({ email: email.toLowerCase() });
        if (clerkUser) {
            await User.updateOne({ _id: clerkUser._id }, { $set: { tier } });
            updated = true;
            console.log(`[Admin] Updated Clerk user ${email} to tier: ${tier}`);
        }

        // Try in-house user
        const inHouseUser = await UserModel.findOne({ email: email.toLowerCase() });
        if (inHouseUser) {
            await UserModel.updateOne({ _id: inHouseUser._id }, { $set: { subscriptionTier: tier } });
            updated = true;
            console.log(`[Admin] Updated in-house user ${email} to tier: ${tier}`);
        }

        if (!updated) {
            return res.fail('NOT_FOUND', 'User not found', 404);
        }

        return res.ok({ email, tier, message: `User ${email} upgraded to ${tier}` });
    } catch (error) {
        console.error('[UserRoutes] /admin/upgrade error:', error);
        return res.fail('INTERNAL_ERROR', 'Server error');
    }
});

export default router;
