/**
 * UserActivityService - Track and manage user activity for BeamLab Ultimate
 *
 * Features:
 * - Track logins
 * - Count analysis runs (with daily limits for free tier)
 * - Log project saves, exports
 * - Get user activity history
 */
import { IUser } from '../models.js';
export declare const TIER_LIMITS: {
    free: {
        maxNodes: number;
        maxMembers: number;
        maxProjects: number;
        maxAnalysisPerDay: number;
        canSaveProjects: boolean;
        canExportCleanPDF: boolean;
        hasDesignCodes: boolean;
        templates: string[];
    };
    pro: {
        maxNodes: number;
        maxMembers: number;
        maxProjects: number;
        maxAnalysisPerDay: number;
        canSaveProjects: boolean;
        canExportCleanPDF: boolean;
        hasDesignCodes: boolean;
        templates: string[];
    };
    enterprise: {
        maxNodes: number;
        maxMembers: number;
        maxProjects: number;
        maxAnalysisPerDay: number;
        canSaveProjects: boolean;
        canExportCleanPDF: boolean;
        hasDesignCodes: boolean;
        templates: string[];
    };
};
export declare class UserActivityService {
    /**
     * Record user login
     */
    static recordLogin(clerkId: string): Promise<IUser | null>;
    /**
     * Check if user can run analysis (based on daily limit for free tier)
     */
    static canRunAnalysis(clerkId: string): Promise<{
        allowed: boolean;
        reason?: string;
        remaining?: number;
    }>;
    /**
     * Record analysis run
     */
    static recordAnalysis(clerkId: string, metadata?: Record<string, unknown>): Promise<IUser | null>;
    /**
     * Record PDF export
     */
    static recordExport(clerkId: string): Promise<IUser | null>;
    /**
     * Get user activity summary
     */
    static getActivitySummary(clerkId: string): Promise<{
        tier: string;
        limits: typeof TIER_LIMITS.free;
        stats: {
            lastLogin: Date | null;
            totalAnalysisRuns: number;
            totalExports: number;
            dailyAnalysisRemaining: number;
            projectCount: number;
        };
        recentActivity: Array<{
            action: string;
            timestamp: Date;
        }>;
    } | null>;
    /**
     * Check tier limits for model size
     */
    static checkModelLimits(clerkId: string, nodeCount: number, memberCount: number): Promise<{
        allowed: boolean;
        reason?: string;
    }>;
    /**
     * Create or get user
     */
    static getOrCreateUser(clerkId: string, email: string): Promise<IUser | null>;
}
export default UserActivityService;
//# sourceMappingURL=UserActivityService.d.ts.map