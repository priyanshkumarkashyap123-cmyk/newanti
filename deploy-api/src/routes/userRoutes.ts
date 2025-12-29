/**
 * User Activity API Routes
 * 
 * Endpoints for user activity tracking and tier management
 */

import { Router, Request, Response } from 'express';
import { requireAuth, getAuth } from '@clerk/express';
import { UserActivityService, TIER_LIMITS } from '../services/UserActivityService.js';
import { User, Subscription } from '../models.js';

const router = Router();

// ============================================
// GET /user/profile - Get user profile with activity
// ============================================

router.get('/profile', requireAuth(), async (req: Request, res: Response) => {
    try {
        const { userId } = getAuth(req);
        if (!userId) {
            return res.status(401).json({ success: false, error: 'Unauthorized' });
        }

        const summary = await UserActivityService.getActivitySummary(userId);
        if (!summary) {
            return res.status(404).json({ success: false, error: 'User not found' });
        }

        return res.json({ success: true, data: summary });
    } catch (error) {
        console.error('[UserRoutes] /profile error:', error);
        return res.status(500).json({ success: false, error: 'Server error' });
    }
});

// ============================================
// POST /user/login - Record login
// ============================================

router.post('/login', requireAuth(), async (req: Request, res: Response) => {
    try {
        const { userId } = getAuth(req);
        const { email } = req.body;

        if (!userId) {
            return res.status(401).json({ success: false, error: 'Unauthorized' });
        }

        // Create user if doesn't exist, or update login
        let user = await UserActivityService.getOrCreateUser(userId, email || 'unknown@beamlab.com');
        user = await UserActivityService.recordLogin(userId);

        return res.json({
            success: true,
            data: {
                tier: user?.tier || 'free',
                lastLogin: user?.lastLogin
            }
        });
    } catch (error) {
        console.error('[UserRoutes] /login error:', error);
        return res.status(500).json({ success: false, error: 'Server error' });
    }
});

// ============================================
// GET /user/limits - Get tier limits
// ============================================

router.get('/limits', requireAuth(), async (req: Request, res: Response) => {
    try {
        const { userId } = getAuth(req);
        if (!userId) {
            return res.status(401).json({ success: false, error: 'Unauthorized' });
        }

        const user = await User.findOne({ clerkId: userId });
        const tier = user?.tier || 'free';
        const limits = TIER_LIMITS[tier];

        return res.json({
            success: true,
            data: {
                tier,
                limits
            }
        });
    } catch (error) {
        console.error('[UserRoutes] /limits error:', error);
        return res.status(500).json({ success: false, error: 'Server error' });
    }
});

// ============================================
// GET /user/subscription - Get complete subscription status
// ============================================

router.get('/subscription', requireAuth(), async (req: Request, res: Response) => {
    try {
        const { userId } = getAuth(req);
        if (!userId) {
            return res.status(401).json({ success: false, error: 'Unauthorized' });
        }

        const user = await User.findOne({ clerkId: userId });
        const tier = user?.tier || 'free';
        const limits = TIER_LIMITS[tier];

        // Get subscription details if exists
        let subscriptionData = null;
        if (user?.subscription) {
            const subscription = await Subscription.findById(user.subscription);
            if (subscription) {
                subscriptionData = {
                    status: subscription.status,
                    currentPeriodEnd: subscription.currentPeriodEnd,
                    cancelAtPeriodEnd: subscription.cancelAtPeriodEnd
                };
            }
        }

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

        return res.json({
            success: true,
            data: {
                tier,
                isLoading: false,
                expiresAt: subscriptionData?.currentPeriodEnd || null,
                subscription: subscriptionData,
                features,
                limits
            }
        });
    } catch (error) {
        console.error('[UserRoutes] /subscription error:', error);
        return res.status(500).json({ success: false, error: 'Server error' });
    }
});

// ============================================
// POST /user/check-analysis - Check if user can run analysis
// ============================================

router.post('/check-analysis', requireAuth(), async (req: Request, res: Response) => {
    try {
        const { userId } = getAuth(req);
        if (!userId) {
            return res.status(401).json({ success: false, error: 'Unauthorized' });
        }

        const result = await UserActivityService.canRunAnalysis(userId);
        return res.json({ success: true, data: result });
    } catch (error) {
        console.error('[UserRoutes] /check-analysis error:', error);
        return res.status(500).json({ success: false, error: 'Server error' });
    }
});

// ============================================
// POST /user/record-analysis - Record an analysis run
// ============================================

router.post('/record-analysis', requireAuth(), async (req: Request, res: Response) => {
    try {
        const { userId } = getAuth(req);
        const { nodeCount, memberCount } = req.body;

        if (!userId) {
            return res.status(401).json({ success: false, error: 'Unauthorized' });
        }

        // Record the analysis
        await UserActivityService.recordAnalysis(userId, { nodeCount, memberCount });

        return res.json({ success: true });
    } catch (error) {
        console.error('[UserRoutes] /record-analysis error:', error);
        return res.status(500).json({ success: false, error: 'Server error' });
    }
});

// ============================================
// POST /user/check-model-limits - Check node/member limits
// ============================================

router.post('/check-model-limits', requireAuth(), async (req: Request, res: Response) => {
    try {
        const { userId } = getAuth(req);
        const { nodeCount, memberCount } = req.body;

        if (!userId) {
            return res.status(401).json({ success: false, error: 'Unauthorized' });
        }

        const result = await UserActivityService.checkModelLimits(
            userId,
            nodeCount || 0,
            memberCount || 0
        );

        return res.json({ success: true, data: result });
    } catch (error) {
        console.error('[UserRoutes] /check-model-limits error:', error);
        return res.status(500).json({ success: false, error: 'Server error' });
    }
});

// ============================================
// POST /user/record-export - Record PDF export
// ============================================

router.post('/record-export', requireAuth(), async (req: Request, res: Response) => {
    try {
        const { userId } = getAuth(req);
        if (!userId) {
            return res.status(401).json({ success: false, error: 'Unauthorized' });
        }

        await UserActivityService.recordExport(userId);
        return res.json({ success: true });
    } catch (error) {
        console.error('[UserRoutes] /record-export error:', error);
        return res.status(500).json({ success: false, error: 'Server error' });
    }
});

// ============================================
// GET /user/activity - Get recent activity log
// ============================================

router.get('/activity', requireAuth(), async (req: Request, res: Response) => {
    try {
        const { userId } = getAuth(req);
        if (!userId) {
            return res.status(401).json({ success: false, error: 'Unauthorized' });
        }

        const user = await User.findOne({ clerkId: userId });
        if (!user) {
            return res.status(404).json({ success: false, error: 'User not found' });
        }

        return res.json({
            success: true,
            data: {
                recentActivity: user.activityLog.slice(-20).reverse(),
                totalAnalysisRuns: user.totalAnalysisRuns,
                totalExports: user.totalExports,
                lastLogin: user.lastLogin
            }
        });
    } catch (error) {
        console.error('[UserRoutes] /activity error:', error);
        return res.status(500).json({ success: false, error: 'Server error' });
    }
});

export default router;
