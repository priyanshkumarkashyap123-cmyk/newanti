/**
 * Usage Monitoring API Routes
 *
 * Endpoints for:
 * - User usage dashboards (analysis results, reports, activity)
 * - Admin monitoring (system stats, usage logs, top users)
 * - Analysis result CRUD
 * - Report tracking
 */

import { Router, Request, Response } from 'express';
import { requireAuth, getAuth } from '../middleware/authMiddleware.js';
import { UsageMonitoringService } from '../services/UsageMonitoringService.js';
import { isMasterUser, User } from '../models/index.js';
import { asyncHandler, HttpError } from '../utils/asyncHandler.js';

const router: Router = Router();

// ============================================
// USER-FACING: Usage summary
// ============================================

/**
 * GET /usage/summary - Get your own usage summary
 */
router.get('/summary', requireAuth(), asyncHandler(async (req: Request, res: Response) => {
    const { userId } = getAuth(req);
    if (!userId) throw new HttpError(401, 'Unauthorized');

    const summary = await UsageMonitoringService.getUserUsageSummary(userId);
    if (!summary) throw new HttpError(404, 'User not found');

    return res.ok(summary);
}));

// ============================================
// ANALYSIS RESULTS
// ============================================

/**
 * GET /usage/analysis-results - Get user's analysis results
 */
router.get('/analysis-results', requireAuth(), asyncHandler(async (req: Request, res: Response) => {
    const { userId } = getAuth(req);
    if (!userId) throw new HttpError(401, 'Unauthorized');

    const filters = {
        projectId: req.query.projectId as string | undefined,
        analysisType: req.query.analysisType as string | undefined,
        status: req.query.status as string | undefined,
        limit: parseInt(req.query.limit as string) || 50,
        skip: parseInt(req.query.skip as string) || 0
    };

    const { results, total } = await UsageMonitoringService.getAnalysisResults(userId, filters);
    return res.ok({ results, total, limit: filters.limit, skip: filters.skip });
}));

/**
 * POST /usage/analysis-results - Save an analysis result
 */
router.post('/analysis-results', requireAuth(), asyncHandler(async (req: Request, res: Response) => {
    const { userId } = getAuth(req);
    if (!userId) throw new HttpError(401, 'Unauthorized');

    const {
        projectId, analysisType, analysisName, status,
        inputSummary, resultData, resultSummary,
        computeTimeMs, solverUsed, deviceId, tags, notes
    } = req.body;

    if (!projectId || !analysisType || !analysisName) {
        throw new HttpError(400, 'projectId, analysisType, and analysisName are required');
    }

    const result = await UsageMonitoringService.saveAnalysisResult({
        clerkId: userId,
        projectId,
        analysisType,
        analysisName,
        status: status || 'completed',
        inputSummary: inputSummary || { nodeCount: 0, memberCount: 0 },
        resultData,
        resultSummary,
        computeTimeMs,
        solverUsed,
        deviceId,
        tags,
        notes
    });

    if (!result) throw new HttpError(500, 'Failed to save analysis result');
    return res.status(201).json({ success: true, data: result });
}));

// ============================================
// REPORT TRACKING
// ============================================

/**
 * GET /usage/reports - Get user's report history
 */
router.get('/reports', requireAuth(), asyncHandler(async (req: Request, res: Response) => {
    const { userId } = getAuth(req);
    if (!userId) throw new HttpError(401, 'Unauthorized');

    const filters = {
        projectId: req.query.projectId as string | undefined,
        reportType: req.query.reportType as string | undefined,
        format: req.query.format as string | undefined,
        limit: parseInt(req.query.limit as string) || 50,
        skip: parseInt(req.query.skip as string) || 0
    };

    const { reports, total } = await UsageMonitoringService.getReports(userId, filters);
    return res.ok({ reports, total, limit: filters.limit, skip: filters.skip });
}));

/**
 * POST /usage/reports - Track a report generation
 */
router.post('/reports', requireAuth(), asyncHandler(async (req: Request, res: Response) => {
    const { userId } = getAuth(req);
    if (!userId) throw new HttpError(401, 'Unauthorized');

    const {
        projectId, analysisResultId, reportType, format,
        reportName, fileSizeBytes, generationTimeMs,
        pageCount, templateUsed, parameters, status, errorMessage
    } = req.body;

    if (!reportType || !format || !reportName) {
        throw new HttpError(400, 'reportType, format, and reportName are required');
    }

    const report = await UsageMonitoringService.trackReportGeneration({
        clerkId: userId,
        projectId,
        analysisResultId,
        reportType,
        format,
        reportName,
        fileSizeBytes,
        generationTimeMs,
        pageCount,
        templateUsed,
        parameters,
        status,
        errorMessage
    });

    if (!report) throw new HttpError(500, 'Failed to track report');
    return res.status(201).json({ success: true, data: report });
}));

/**
 * POST /usage/reports/:id/download - Record a report download
 */
router.post('/reports/:id/download', requireAuth(), asyncHandler(async (req: Request, res: Response) => {
    const { userId } = getAuth(req);
    if (!userId) throw new HttpError(401, 'Unauthorized');

    const { id } = req.params;
    const success = await UsageMonitoringService.recordReportDownload(id);
    return res.ok({ recorded: success });
}));

// ============================================
// ADMIN: System Stats (Master users only)
// ============================================

/**
 * GET /usage/admin/stats - System-wide usage statistics
 */
router.get('/admin/stats', requireAuth(), asyncHandler(async (req: Request, res: Response) => {
    const { userId } = getAuth(req);
    if (!userId) throw new HttpError(401, 'Unauthorized');

    // Check if user is a master/admin
    const user = await User.findOne({ clerkId: userId }).lean();
    if (!user || !isMasterUser(user.email)) {
        throw new HttpError(403, 'Admin access required');
    }

    const stats = await UsageMonitoringService.getSystemStats();
    if (!stats) throw new HttpError(500, 'Failed to get system stats');

    return res.ok(stats);
}));

/**
 * GET /usage/admin/logs - Usage logs for admin monitoring
 */
router.get('/admin/logs', requireAuth(), asyncHandler(async (req: Request, res: Response) => {
    const { userId } = getAuth(req);
    if (!userId) throw new HttpError(401, 'Unauthorized');

    // Check if user is a master/admin
    const user = await User.findOne({ clerkId: userId }).lean();
    if (!user || !isMasterUser(user.email)) {
        throw new HttpError(403, 'Admin access required');
    }

    const filters = {
        clerkId: req.query.clerkId as string | undefined,
        email: req.query.email as string | undefined,
        category: req.query.category as string | undefined,
        action: req.query.action as string | undefined,
        startDate: req.query.startDate ? new Date(req.query.startDate as string) : undefined,
        endDate: req.query.endDate ? new Date(req.query.endDate as string) : undefined,
        limit: parseInt(req.query.limit as string) || 100,
        skip: parseInt(req.query.skip as string) || 0
    };

    const { logs, total } = await UsageMonitoringService.getUsageLogs(filters);
    return res.ok({ logs, total, limit: filters.limit, skip: filters.skip });
}));

/**
 * GET /usage/admin/user/:clerkId - Get specific user's usage (admin)
 */
router.get('/admin/user/:clerkId', requireAuth(), asyncHandler(async (req: Request, res: Response) => {
    const { userId } = getAuth(req);
    if (!userId) throw new HttpError(401, 'Unauthorized');

    // Check if user is a master/admin
    const user = await User.findOne({ clerkId: userId }).lean();
    if (!user || !isMasterUser(user.email)) {
        throw new HttpError(403, 'Admin access required');
    }

    const targetClerkId = req.params.clerkId;
    const summary = await UsageMonitoringService.getUserUsageSummary(targetClerkId);
    if (!summary) throw new HttpError(404, 'User not found');

    return res.ok(summary);
}));

export default router;
