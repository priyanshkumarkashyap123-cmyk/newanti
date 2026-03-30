/**
 * UsageMonitoringService - Comprehensive usage monitoring for BeamLab Ultimate
 *
 * Provides:
 * - Centralized usage logging (every significant user action)
 * - Admin dashboards (usage stats, active users, top consumers)
 * - Per-user usage summaries (for billing and limits)
 * - Analysis result persistence
 * - Report generation tracking
 */

import mongoose from 'mongoose';
import {
    User, UsageLog, UsageCounter, AnalysisResult, ReportGeneration,
    IAnalysisResult, IReportGeneration, IUsageLog,
    isMasterUser
} from '../models.js';
import { logger } from '../utils/logger.js';

const isConnected = () => mongoose.connection.readyState === 1;

// ============================================
// USAGE LOGGING
// ============================================

export class UsageMonitoringService {

    /**
     * Log any user action. This is the central, fire-and-forget logger.
     * Call from routes/services — never let it block the main response.
     */
    static async log(params: {
        clerkId: string;
        email?: string;
        action: string;
        category: 'auth' | 'analysis' | 'project' | 'export' | 'report' | 'ai' | 'billing' | 'admin' | 'system';
        details?: Record<string, unknown>;
        resourceType?: string;
        resourceId?: string;
        durationMs?: number;
        computeCreditsUsed?: number;
        success?: boolean;
        errorMessage?: string;
        ipAddress?: string;
        userAgent?: string;
        deviceId?: string;
    }): Promise<void> {
        if (!isConnected()) return;

        try {
            const user = await User.findOne({ clerkId: params.clerkId }).select('_id email').lean();
            await UsageLog.create({
                userId: user?._id ?? undefined,
                clerkId: params.clerkId,
                email: params.email || user?.email || 'unknown',
                action: params.action,
                category: params.category,
                details: params.details,
                resourceType: params.resourceType,
                resourceId: params.resourceId,
                durationMs: params.durationMs,
                computeCreditsUsed: params.computeCreditsUsed,
                success: params.success ?? true,
                errorMessage: params.errorMessage,
                ipAddress: params.ipAddress,
                userAgent: params.userAgent,
                deviceId: params.deviceId
            });
        } catch (error) {
            // Non-critical — never throw
            logger.error({ err: error }, '[UsageMonitoringService] log error');
        }
    }

    // ============================================
    // USAGE COUNTERS (PER-DAY AGGREGATES)
    // ============================================

    /** Increment daily usage counters (idempotent-ish, small race tolerable). */
    static async bumpCounter(params: {
        clerkId: string;
        email?: string;
        date?: string; // YYYY-MM-DD UTC; default: today UTC
        projectsCreated?: number;
        analysesRun?: number;
        exports?: number;
        computeUnitsUsed?: number;
        storageBytesUsed?: number;
        deviceId?: string;
    }): Promise<void> {
        if (!isConnected()) return;

        const todayUtc = new Date();
        const isoDate = params.date || todayUtc.toISOString().slice(0, 10); // YYYY-MM-DD

        const inc: Record<string, number> = {};
        if (params.projectsCreated) inc.projectsCreated = params.projectsCreated;
        if (params.analysesRun) inc.analysesRun = params.analysesRun;
        if (params.exports) inc.exports = params.exports;
        if (params.computeUnitsUsed) inc.computeUnitsUsed = params.computeUnitsUsed;
        if (params.storageBytesUsed) inc.storageBytesUsed = params.storageBytesUsed;

        // Distinct devices tracking (bounded array to avoid growth)
        const deviceId = params.deviceId;
        const addToSet = deviceId ? { devicesSeen: deviceId } : {};
        const setOnInsert: Record<string, unknown> = {
            email: params.email || null,
            distinctDevices: 0,
        };

        try {
            const result = await UsageCounter.findOneAndUpdate(
                { clerkId: params.clerkId, date: isoDate },
                {
                    $setOnInsert: setOnInsert,
                    ...(Object.keys(inc).length ? { $inc: inc } : {}),
                    ...(deviceId ? { $addToSet: addToSet } : {}),
                },
                { upsert: true, new: true }
            ).lean();

            if (result && deviceId) {
                const seen = Array.isArray(result.devicesSeen) ? result.devicesSeen : [];
                const distinct = new Set(seen).size;
                if (distinct !== result.distinctDevices) {
                    await UsageCounter.updateOne(
                        { _id: result._id },
                        { $set: { distinctDevices: distinct } }
                    );
                }
            }
        } catch (error) {
            logger.error({ err: error }, '[UsageMonitoringService] bumpCounter error');
        }
    }

    // ============================================
    // ANALYSIS RESULT PERSISTENCE
    // ============================================

    /**
     * Save a completed analysis result permanently.
     * Unlike AnalysisJob (ephemeral, 24h TTL), this is permanent.
     */
    static async saveAnalysisResult(params: {
        clerkId: string;
        projectId: string;
        analysisType: IAnalysisResult['analysisType'];
        analysisName: string;
        status: 'completed' | 'failed';
        inputSummary: {
            nodeCount: number;
            memberCount: number;
            loadCases?: number;
            supports?: number;
        };
        resultData?: Record<string, unknown>;
        resultSummary?: string;
        computeTimeMs?: number;
        solverUsed?: 'wasm' | 'rust_api' | 'python';
        deviceId?: string;
        tags?: string[];
        notes?: string;
    }): Promise<IAnalysisResult | null> {
        if (!isConnected()) return null;

        try {
            const user = await User.findOne({ clerkId: params.clerkId }).lean();
            if (!user) return null;

            const result = await AnalysisResult.create({
                userId: user._id,
                clerkId: params.clerkId,
                projectId: new mongoose.Types.ObjectId(params.projectId),
                analysisType: params.analysisType,
                analysisName: params.analysisName,
                status: params.status,
                inputSummary: {
                    nodeCount: params.inputSummary.nodeCount,
                    memberCount: params.inputSummary.memberCount,
                    loadCases: params.inputSummary.loadCases ?? 0,
                    supports: params.inputSummary.supports ?? 0
                },
                resultData: params.resultData ?? {},
                resultSummary: params.resultSummary ?? '',
                computeTimeMs: params.computeTimeMs ?? 0,
                solverUsed: params.solverUsed ?? 'wasm',
                deviceId: params.deviceId,
                tags: params.tags ?? [],
                notes: params.notes
            });

            // Update user stats
            await User.findByIdAndUpdate(user._id, {
                $inc: { totalAnalysisRuns: 1 }
            });

            // Log usage
            await this.log({
                clerkId: params.clerkId,
                action: params.status === 'completed' ? 'analysis_completed' : 'analysis_failed',
                category: 'analysis',
                resourceType: 'analysis_result',
                resourceId: result._id?.toString(),
                durationMs: params.computeTimeMs,
                details: {
                    analysisType: params.analysisType,
                    nodeCount: params.inputSummary.nodeCount,
                    memberCount: params.inputSummary.memberCount,
                    solverUsed: params.solverUsed
                },
                deviceId: params.deviceId
            });

            return result;
        } catch (error) {
            logger.error({ err: error }, '[UsageMonitoringService] saveAnalysisResult error');
            return null;
        }
    }

    /**
     * Get analysis results for a user, optionally filtered.
     */
    static async getAnalysisResults(clerkId: string, filters?: {
        projectId?: string;
        analysisType?: string;
        status?: string;
        limit?: number;
        skip?: number;
    }): Promise<{ results: IAnalysisResult[]; total: number }> {
        if (!isConnected()) return { results: [], total: 0 };

        try {
            const query: Record<string, unknown> = { clerkId };
            if (filters?.projectId) query.projectId = new mongoose.Types.ObjectId(filters.projectId);
            if (filters?.analysisType) query.analysisType = filters.analysisType;
            if (filters?.status) query.status = filters.status;

            const limit = filters?.limit ?? 50;
            const skip = filters?.skip ?? 0;

            const [results, total] = await Promise.all([
                AnalysisResult.find(query)
                    .sort({ createdAt: -1 })
                    .skip(skip)
                    .limit(limit)
                    .populate('projectId', 'name')
                    .lean(),
                AnalysisResult.countDocuments(query)
            ]);

            return { results: results as IAnalysisResult[], total };
        } catch (error) {
            logger.error({ err: error }, '[UsageMonitoringService] getAnalysisResults error');
            return { results: [], total: 0 };
        }
    }

    // ============================================
    // REPORT TRACKING
    // ============================================

    /**
     * Track a report generation event.
     */
    static async trackReportGeneration(params: {
        clerkId: string;
        projectId?: string;
        analysisResultId?: string;
        reportType: IReportGeneration['reportType'];
        format: IReportGeneration['format'];
        reportName: string;
        fileSizeBytes?: number;
        generationTimeMs?: number;
        pageCount?: number;
        templateUsed?: string;
        parameters?: Record<string, unknown>;
        status?: 'generating' | 'completed' | 'failed';
        errorMessage?: string;
    }): Promise<IReportGeneration | null> {
        if (!isConnected()) return null;

        try {
            const user = await User.findOne({ clerkId: params.clerkId }).lean();
            if (!user) return null;

            const report = await ReportGeneration.create({
                userId: user._id,
                clerkId: params.clerkId,
                projectId: params.projectId ? new mongoose.Types.ObjectId(params.projectId) : undefined,
                analysisResultId: params.analysisResultId ? new mongoose.Types.ObjectId(params.analysisResultId) : undefined,
                reportType: params.reportType,
                format: params.format,
                reportName: params.reportName,
                fileSizeBytes: params.fileSizeBytes ?? 0,
                generationTimeMs: params.generationTimeMs ?? 0,
                pageCount: params.pageCount,
                templateUsed: params.templateUsed,
                parameters: params.parameters ?? {},
                status: params.status ?? 'completed',
                errorMessage: params.errorMessage
            });

            // Update user stats
            await User.findByIdAndUpdate(user._id, {
                $inc: { totalReportsGenerated: 1, totalExports: 1 }
            });

            // Log usage
            await this.log({
                clerkId: params.clerkId,
                action: params.status === 'failed' ? 'report_failed' : 'report_generated',
                category: 'report',
                resourceType: 'report',
                resourceId: report._id?.toString(),
                durationMs: params.generationTimeMs,
                details: {
                    reportType: params.reportType,
                    format: params.format,
                    fileSizeBytes: params.fileSizeBytes,
                    pageCount: params.pageCount,
                    projectId: params.projectId,
                    analysisResultId: params.analysisResultId,
                },
                success: params.status !== 'failed',
                errorMessage: params.errorMessage,
            });

            // Increment daily counters for exports (treat report generation as export)
            await this.bumpCounter({
                clerkId: params.clerkId,
                exports: 1,
            });

            return report;
        } catch (error) {
            logger.error({ err: error }, '[UsageMonitoringService] trackReportGeneration error');
            return null;
        }
    }

    /**
     * Record a report download (increment counter).
     */
    static async recordReportDownload(reportId: string): Promise<boolean> {
        if (!isConnected()) return false;

        try {
            await ReportGeneration.findByIdAndUpdate(reportId, {
                $inc: { downloadCount: 1 },
                $set: { lastDownloadAt: new Date() }
            });
            return true;
        } catch (error) {
            logger.error({ err: error }, '[UsageMonitoringService] recordReportDownload error');
            return false;
        }
    }

    /**
     * Get reports for a user, optionally filtered.
     */
    static async getReports(clerkId: string, filters?: {
        projectId?: string;
        reportType?: string;
        format?: string;
        limit?: number;
        skip?: number;
    }): Promise<{ reports: IReportGeneration[]; total: number }> {
        if (!isConnected()) return { reports: [], total: 0 };

        try {
            const query: Record<string, unknown> = { clerkId };
            if (filters?.projectId) query.projectId = new mongoose.Types.ObjectId(filters.projectId);
            if (filters?.reportType) query.reportType = filters.reportType;
            if (filters?.format) query.format = filters.format;

            const limit = filters?.limit ?? 50;
            const skip = filters?.skip ?? 0;

            const [reports, total] = await Promise.all([
                ReportGeneration.find(query)
                    .sort({ createdAt: -1 })
                    .skip(skip)
                    .limit(limit)
                    .populate('projectId', 'name')
                    .lean(),
                ReportGeneration.countDocuments(query)
            ]);

            return { reports: reports as IReportGeneration[], total };
        } catch (error) {
            logger.error({ err: error }, '[UsageMonitoringService] getReports error');
            return { reports: [], total: 0 };
        }
    }

    // ============================================
    // USER USAGE SUMMARY (for dashboards)
    // ============================================

    /**
     * Get comprehensive usage summary for a single user.
     * Used for admin monitoring and user-facing "My Usage" panels.
     */
    static async getUserUsageSummary(clerkId: string): Promise<{
        user: {
            email: string;
            tier: string;
            createdAt: Date;
            lastLogin: Date;
            lastActiveAt: Date;
            totalLoginCount: number;
        };
        analysis: {
            totalRuns: number;
            dailyRemaining: number;
            recentResults: IAnalysisResult[];
            byType: Record<string, number>;
        };
        reports: {
            totalGenerated: number;
            totalDownloads: number;
            recentReports: IReportGeneration[];
        };
        projects: {
            totalCreated: number;
            activeCount: number;
        };
        storage: {
            usedBytes: number;
        };
        sessions: {
            activeDeviceCount: number;
            totalSessionsEver: number;
        };
    } | null> {
        if (!isConnected()) return null;

        try {
            const user = await User.findOne({ clerkId }).lean();
            if (!user) return null;

            const effectiveTier = isMasterUser(user.email) ? 'enterprise' : user.tier;

            // Parallel queries for efficiency
            const [
                recentResults,
                analysisByType,
                recentReports,
                totalReportDownloads,
                activeSessionCount,
                totalSessions
            ] = await Promise.all([
                AnalysisResult.find({ clerkId })
                    .sort({ createdAt: -1 })
                    .limit(10)
                    .populate('projectId', 'name')
                    .lean(),
                AnalysisResult.aggregate([
                    { $match: { clerkId } },
                    { $group: { _id: '$analysisType', count: { $sum: 1 } } }
                ]),
                ReportGeneration.find({ clerkId })
                    .sort({ createdAt: -1 })
                    .limit(10)
                    .lean(),
                ReportGeneration.aggregate([
                    { $match: { clerkId } },
                    { $group: { _id: null, total: { $sum: '$downloadCount' } } }
                ]),
                DeviceSessionModel_countActive(clerkId),
                DeviceSessionModel_countTotal(clerkId)
            ]);

            const byType: Record<string, number> = {};
            for (const agg of analysisByType) {
                byType[agg._id] = agg.count;
            }

            // Daily analysis remaining
            const { TIER_LIMITS } = await import('./UserActivityService.js');
            const limits = TIER_LIMITS[effectiveTier];
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const isNewDay = !user.lastAnalysisDate || user.lastAnalysisDate < today;
            const dailyRemaining = limits.maxAnalysisPerDay === Infinity
                ? Infinity
                : isNewDay ? limits.maxAnalysisPerDay : Math.max(0, limits.maxAnalysisPerDay - user.dailyAnalysisCount);

            return {
                user: {
                    email: user.email,
                    tier: effectiveTier,
                    createdAt: user.createdAt,
                    lastLogin: user.lastLogin,
                    lastActiveAt: user.lastActiveAt,
                    totalLoginCount: user.totalLoginCount ?? 0
                },
                analysis: {
                    totalRuns: user.totalAnalysisRuns,
                    dailyRemaining,
                    recentResults: recentResults as IAnalysisResult[],
                    byType
                },
                reports: {
                    totalGenerated: user.totalReportsGenerated ?? 0,
                    totalDownloads: totalReportDownloads[0]?.total ?? 0,
                    recentReports: recentReports as IReportGeneration[]
                },
                projects: {
                    totalCreated: user.totalProjectsCreated ?? 0,
                    activeCount: user.projects?.length ?? 0
                },
                storage: {
                    usedBytes: user.storageUsedBytes ?? 0
                },
                sessions: {
                    activeDeviceCount: activeSessionCount,
                    totalSessionsEver: totalSessions
                }
            };
        } catch (error) {
            logger.error({ err: error }, '[UsageMonitoringService] getUserUsageSummary error');
            return null;
        }
    }

    // ============================================
    // ADMIN: AGGREGATE ANALYTICS
    // ============================================

    /**
     * Get system-wide usage statistics for admin dashboards.
     */
    static async getSystemStats(): Promise<{
        totalUsers: number;
        activeUsersToday: number;
        activeUsersWeek: number;
        usersByTier: Record<string, number>;
        totalAnalysesToday: number;
        totalReportsToday: number;
        topUsers: Array<{ email: string; tier: string; analysisRuns: number }>;
    } | null> {
        if (!isConnected()) return null;

        try {
            const today = new Date();
            today.setHours(0, 0, 0, 0);

            const weekAgo = new Date();
            weekAgo.setDate(weekAgo.getDate() - 7);
            weekAgo.setHours(0, 0, 0, 0);

            const [
                totalUsers,
                activeUsersToday,
                activeUsersWeek,
                tierAgg,
                analysesToday,
                reportsToday,
                topUsers
            ] = await Promise.all([
                User.countDocuments(),
                User.countDocuments({ lastActiveAt: { $gte: today } }),
                User.countDocuments({ lastActiveAt: { $gte: weekAgo } }),
                User.aggregate([
                    { $group: { _id: '$tier', count: { $sum: 1 } } }
                ]),
                UsageLog.countDocuments({ category: 'analysis', createdAt: { $gte: today } }),
                UsageLog.countDocuments({ category: 'report', createdAt: { $gte: today } }),
                User.find()
                    .sort({ totalAnalysisRuns: -1 })
                    .limit(20)
                    .select('email tier totalAnalysisRuns')
                    .lean()
            ]);

            const usersByTier: Record<string, number> = {};
            for (const t of tierAgg) {
                usersByTier[t._id] = t.count;
            }

            return {
                totalUsers,
                activeUsersToday,
                activeUsersWeek,
                usersByTier,
                totalAnalysesToday: analysesToday,
                totalReportsToday: reportsToday,
                topUsers: topUsers.map(u => ({
                    email: u.email,
                    tier: u.tier,
                    analysisRuns: u.totalAnalysisRuns
                }))
            };
        } catch (error) {
            logger.error({ err: error }, '[UsageMonitoringService] getSystemStats error');
            return null;
        }
    }

    /**
     * Get usage logs for admin monitoring, with filters.
     */
    static async getUsageLogs(filters?: {
        clerkId?: string;
        email?: string;
        category?: string;
        action?: string;
        startDate?: Date;
        endDate?: Date;
        limit?: number;
        skip?: number;
    }): Promise<{ logs: Array<Record<string, unknown> | IUsageLog>; total: number }> {
        if (!isConnected()) return { logs: [], total: 0 };

        try {
            const query: Record<string, unknown> = {};
            if (filters?.clerkId) query.clerkId = filters.clerkId;
            if (filters?.email) query.email = { $regex: filters.email.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' };
            if (filters?.category) query.category = filters.category;
            if (filters?.action) query.action = { $regex: filters.action.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' };
            if (filters?.startDate || filters?.endDate) {
                query.createdAt = {};
                if (filters?.startDate) (query.createdAt as Record<string, unknown>).$gte = filters.startDate;
                if (filters?.endDate) (query.createdAt as Record<string, unknown>).$lte = filters.endDate;
            }

            const limit = filters?.limit ?? 100;
            const skip = filters?.skip ?? 0;

            const [logs, total] = await Promise.all([
                UsageLog.find(query)
                    .sort({ createdAt: -1 })
                    .skip(skip)
                    .limit(limit)
                    .lean(),
                UsageLog.countDocuments(query)
            ]);

            return { logs, total };
        } catch (error) {
            logger.error({ err: error }, '[UsageMonitoringService] getUsageLogs error');
            return { logs: [], total: 0 };
        }
    }
}

// ============================================
// HELPER FUNCTIONS (avoid circular imports)
// ============================================

async function DeviceSessionModel_countActive(clerkId: string): Promise<number> {
    const { DeviceSession } = await import('../models.js');
    return DeviceSession.countDocuments({ clerkId, isActive: true });
}

async function DeviceSessionModel_countTotal(clerkId: string): Promise<number> {
    const { DeviceSession } = await import('../models.js');
    return DeviceSession.countDocuments({ clerkId });
}

export default UsageMonitoringService;
