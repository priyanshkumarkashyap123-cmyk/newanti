/**
 * UserActivityService - Track and manage user activity for BeamLab Ultimate
 * 
 * Features:
 * - Track logins
 * - Count analysis runs (with daily limits for free tier)
 * - Log project saves, exports
 * - Get user activity history
 */

import { User, IUser, isMasterUser } from '../models.js';
import mongoose from 'mongoose';

// Helper to check if DB is connected
const isConnected = () => mongoose.connection.readyState === 1;

// ============================================
// TIER LIMITS
// ============================================

export const TIER_LIMITS = {
    free: {
        maxNodes: 10,
        maxMembers: 15,
        maxProjects: 1,
        maxAnalysisPerDay: 3,
        canSaveProjects: false,
        canExportCleanPDF: false,
        hasDesignCodes: false,
        templates: ['SIMPLY_SUPPORTED_BEAM', 'CANTILEVER_BEAM', 'PORTAL_FRAME', 'PRATT_TRUSS_12M', 'G_PLUS_1_FRAME']
    },
    pro: {
        maxNodes: Infinity,
        maxMembers: Infinity,
        maxProjects: 10,
        maxAnalysisPerDay: Infinity,
        canSaveProjects: true,
        canExportCleanPDF: true,
        hasDesignCodes: true,
        templates: ['ALL']  // Special value meaning all templates
    },
    enterprise: {
        maxNodes: Infinity,
        maxMembers: Infinity,
        maxProjects: Infinity,
        maxAnalysisPerDay: Infinity,
        canSaveProjects: true,
        canExportCleanPDF: true,
        hasDesignCodes: true,
        templates: ['ALL']
    }
};

// ============================================
// ACTIVITY SERVICE
// ============================================

export class UserActivityService {
    /**
     * Record user login
     */
    static async recordLogin(clerkId: string): Promise<IUser | null> {
        if (!isConnected()) return null;
        try {
            const user = await User.findOneAndUpdate(
                { clerkId },
                {
                    $set: { lastLogin: new Date() },
                    $push: {
                        activityLog: {
                            $each: [{ action: 'login', timestamp: new Date() }],
                            $slice: -100  // Keep last 100 activities
                        }
                    }
                },
                { new: true }
            );
            return user;
        } catch (error) {
            console.error('[UserActivityService] recordLogin error:', error);
            return null;
        }
    }

    /**
     * Check if user can run analysis (based on daily limit for free tier)
     */
    static async canRunAnalysis(clerkId: string): Promise<{ allowed: boolean; reason?: string; remaining?: number }> {
        if (!isConnected()) return { allowed: true }; // Fail open if DB down
        try {
            const user = await User.findOne({ clerkId });
            if (!user) {
                return { allowed: false, reason: 'User not found' };
            }

            // Master users bypass all limits
            if (isMasterUser(user.email)) {
                return { allowed: true, remaining: Infinity };
            }

            const limits = TIER_LIMITS[user.tier];

            // Pro/Enterprise: unlimited
            if (limits.maxAnalysisPerDay === Infinity) {
                return { allowed: true };
            }

            // Check if last analysis was today
            const today = new Date();
            today.setHours(0, 0, 0, 0);

            if (user.lastAnalysisDate && user.lastAnalysisDate >= today) {
                // Same day - check count
                if (user.dailyAnalysisCount >= limits.maxAnalysisPerDay) {
                    return {
                        allowed: false,
                        reason: `Daily limit reached (${limits.maxAnalysisPerDay}/day). Upgrade to Pro for unlimited analyses.`,
                        remaining: 0
                    };
                }
                return { allowed: true, remaining: limits.maxAnalysisPerDay - user.dailyAnalysisCount };
            }

            // New day - reset count
            return { allowed: true, remaining: limits.maxAnalysisPerDay };
        } catch (error) {
            console.error('[UserActivityService] canRunAnalysis error:', error);
            return { allowed: false, reason: 'Error checking limits' };
        }
    }

    /**
     * Record analysis run
     */
    static async recordAnalysis(clerkId: string, metadata?: Record<string, unknown>): Promise<IUser | null> {
        if (!isConnected()) return null;
        try {
            const today = new Date();
            today.setHours(0, 0, 0, 0);

            const user = await User.findOne({ clerkId });
            if (!user) return null;

            // Reset daily count if new day
            const isNewDay = !user.lastAnalysisDate || user.lastAnalysisDate < today;
            const newDailyCount = isNewDay ? 1 : user.dailyAnalysisCount + 1;

            return await User.findOneAndUpdate(
                { clerkId },
                {
                    $set: {
                        lastAnalysisDate: new Date(),
                        dailyAnalysisCount: newDailyCount
                    },
                    $inc: { totalAnalysisRuns: 1 },
                    $push: {
                        activityLog: {
                            $each: [{ action: 'analysis_run', timestamp: new Date(), metadata }],
                            $slice: -100
                        }
                    }
                },
                { new: true }
            );
        } catch (error) {
            console.error('[UserActivityService] recordAnalysis error:', error);
            return null;
        }
    }

    /**
     * Record PDF export
     */
    static async recordExport(clerkId: string): Promise<IUser | null> {
        if (!isConnected()) return null;
        try {
            return await User.findOneAndUpdate(
                { clerkId },
                {
                    $inc: { totalExports: 1 },
                    $push: {
                        activityLog: {
                            $each: [{ action: 'export_pdf', timestamp: new Date() }],
                            $slice: -100
                        }
                    }
                },
                { new: true }
            );
        } catch (error) {
            console.error('[UserActivityService] recordExport error:', error);
            return null;
        }
    }

    /**
     * Get user activity summary
     */
    static async getActivitySummary(clerkId: string): Promise<{
        tier: string;
        limits: typeof TIER_LIMITS.free;
        stats: {
            lastLogin: Date | null;
            totalAnalysisRuns: number;
            totalExports: number;
            dailyAnalysisRemaining: number;
            projectCount: number;
        };
        recentActivity: Array<{ action: string; timestamp: Date }>;
    } | null> {
        if (!isConnected()) return null;
        try {
            const user = await User.findOne({ clerkId }).populate('projects');
            if (!user) return null;

            // Use enterprise limits for master users
            const effectiveTier = isMasterUser(user.email) ? 'enterprise' : user.tier;
            const limits = TIER_LIMITS[effectiveTier];
            const today = new Date();
            today.setHours(0, 0, 0, 0);

            // Calculate remaining daily analyses
            const isNewDay = !user.lastAnalysisDate || user.lastAnalysisDate < today;
            const dailyAnalysisRemaining = limits.maxAnalysisPerDay === Infinity
                ? Infinity
                : isNewDay
                    ? limits.maxAnalysisPerDay
                    : Math.max(0, limits.maxAnalysisPerDay - user.dailyAnalysisCount);

            return {
                tier: user.tier,
                limits,
                stats: {
                    lastLogin: user.lastLogin,
                    totalAnalysisRuns: user.totalAnalysisRuns,
                    totalExports: user.totalExports,
                    dailyAnalysisRemaining,
                    projectCount: user.projects?.length ?? 0
                },
                recentActivity: user.activityLog.slice(-10).reverse()
            };
        } catch (error) {
            console.error('[UserActivityService] getActivitySummary error:', error);
            return null;
        }
    }

    /**
     * Check tier limits for model size
     */
    static async checkModelLimits(clerkId: string, nodeCount: number, memberCount: number): Promise<{
        allowed: boolean;
        reason?: string;
    }> {
        if (!isConnected()) return { allowed: true }; // Fail open
        try {
            const user = await User.findOne({ clerkId });
            if (!user) {
                return { allowed: true }; // Allow if no user (demo mode)
            }

            // Master users bypass all limits
            if (isMasterUser(user.email)) {
                return { allowed: true };
            }

            const limits = TIER_LIMITS[user.tier];

            if (nodeCount > limits.maxNodes) {
                return {
                    allowed: false,
                    reason: `Node limit exceeded (${nodeCount}/${limits.maxNodes}). Upgrade to Pro for unlimited nodes.`
                };
            }

            if (memberCount > limits.maxMembers) {
                return {
                    allowed: false,
                    reason: `Member limit exceeded (${memberCount}/${limits.maxMembers}). Upgrade to Pro for unlimited members.`
                };
            }

            return { allowed: true };
        } catch (error) {
            console.error('[UserActivityService] checkModelLimits error:', error);
            return { allowed: true };
        }
    }

    /**
     * Create or get user
     */
    static async getOrCreateUser(clerkId: string, email: string): Promise<IUser | null> {
        if (!isConnected()) return null;
        try {
            let user = await User.findOne({ clerkId });
            const isMaster = isMasterUser(email);

            if (!user) {
                // Create new user - master users get enterprise tier
                user = await User.create({
                    clerkId,
                    email,
                    tier: isMaster ? 'enterprise' : 'free',
                    lastLogin: new Date()
                });
                console.log(`[UserActivityService] Created new user: ${email}${isMaster ? ' (MASTER USER)' : ''}`);
            } else if (isMaster && user.tier !== 'enterprise') {
                // Upgrade existing master user to enterprise if not already
                user.tier = 'enterprise';
                await user.save();
                console.log(`[UserActivityService] Upgraded master user to enterprise: ${email}`);
            }

            return user;
        } catch (error) {
            console.error('[UserActivityService] getOrCreateUser error:', error);
            return null;
        }
    }
}

export default UserActivityService;
