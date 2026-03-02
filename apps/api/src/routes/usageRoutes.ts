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
import { isMasterUser, User } from '../models.js';

const router: Router = Router();

// ============================================
// USER-FACING: Usage summary
// ============================================

/**
 * GET /usage/summary - Get your own usage summary
 */
router.get('/summary', requireAuth(), async (req: Request, res: Response) => {
    try {
        const { userId } = getAuth(req);
        if (!userId) return res.fail('UNAUTHORIZED', 'Unauthorized', 401);

        const summary = await UsageMonitoringService.getUserUsageSummary(userId);
        if (!summary) return res.fail('NOT_FOUND', 'User not found', 404);

        return res.ok(summary);
    } catch (error) {
        console.error('[UsageRoutes] /summary error:', error);
        return res.fail('INTERNAL_ERROR', 'Server error');
    }
});

// ============================================
// ANALYSIS RESULTS
// ============================================

/**
 * GET /usage/analysis-results - Get user's analysis results
 */
router.get('/analysis-results', requireAuth(), async (req: Request, res: Response) => {
    try {
        const { userId } = getAuth(req);
        if (!userId) return res.fail('UNAUTHORIZED', 'Unauthorized', 401);

        const filters = {
            projectId: req.query.projectId as string | undefined,
            analysisType: req.query.analysisType as string | undefined,
            status: req.query.status as string | undefined,
            limit: parseInt(req.query.limit as string) || 50,
            skip: parseInt(req.query.skip as string) || 0
        };

        const { results, total } = await UsageMonitoringService.getAnalysisResults(userId, filters);
        return res.ok({ results, total, limit: filters.limit, skip: filters.skip });
    } catch (error) {
        console.error('[UsageRoutes] /analysis-results error:', error);
        return res.fail('INTERNAL_ERROR', 'Server error');
    }
});

/**
 * POST /usage/analysis-results - Save an analysis result
 */
router.post('/analysis-results', requireAuth(), async (req: Request, res: Response) => {
    try {
        const { userId } = getAuth(req);
        if (!userId) return res.fail('UNAUTHORIZED', 'Unauthorized', 401);

        const {
            projectId, analysisType, analysisName, status,
            inputSummary, resultData, resultSummary,
            computeTimeMs, solverUsed, deviceId, tags, notes
        } = req.body;

        if (!projectId || !analysisType || !analysisName) {
            return res.fail('VALIDATION_ERROR', 'projectId, analysisType, and analysisName are required', 400);
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

        if (!result) return res.fail('INTERNAL_ERROR', 'Failed to save analysis result');
        return res.status(201).json({ success: true, data: result });
    } catch (error) {
        console.error('[UsageRoutes] POST /analysis-results error:', error);
        return res.fail('INTERNAL_ERROR', 'Server error');
    }
});

// ============================================
// REPORT TRACKING
// ============================================

/**
 * GET /usage/reports - Get user's report history
 */
router.get('/reports', requireAuth(), async (req: Request, res: Response) => {
    try {
        const { userId } = getAuth(req);
        if (!userId) return res.fail('UNAUTHORIZED', 'Unauthorized', 401);

        const filters = {
            projectId: req.query.projectId as string | undefined,
            reportType: req.query.reportType as string | undefined,
            format: req.query.format as string | undefined,
            limit: parseInt(req.query.limit as string) || 50,
            skip: parseInt(req.query.skip as string) || 0
        };

        const { reports, total } = await UsageMonitoringService.getReports(userId, filters);
        return res.ok({ reports, total, limit: filters.limit, skip: filters.skip });
    } catch (error) {
        console.error('[UsageRoutes] /reports error:', error);
        return res.fail('INTERNAL_ERROR', 'Server error');
    }
});

/**
 * POST /usage/reports - Track a report generation
 */
router.post('/reports', requireAuth(), async (req: Request, res: Response) => {
    try {
        const { userId } = getAuth(req);
        if (!userId) return res.fail('UNAUTHORIZED', 'Unauthorized', 401);

        const {
            projectId, analysisResultId, reportType, format,
            reportName, fileSizeBytes, generationTimeMs,
            pageCount, templateUsed, parameters, status, errorMessage
        } = req.body;

        if (!reportType || !format || !reportName) {
            return res.fail('VALIDATION_ERROR', 'reportType, format, and reportName are required', 400);
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

        if (!report) return res.fail('INTERNAL_ERROR', 'Failed to track report');
        return res.status(201).json({ success: true, data: report });
    } catch (error) {
        console.error('[UsageRoutes] POST /reports error:', error);
        return res.fail('INTERNAL_ERROR', 'Server error');
    }
});

/**
 * POST /usage/reports/:id/download - Record a report download
 */
router.post('/reports/:id/download', requireAuth(), async (req: Request, res: Response) => {
    try {
        const { userId } = getAuth(req);
        if (!userId) return res.fail('UNAUTHORIZED', 'Unauthorized', 401);

        const { id } = req.params;
        const success = await UsageMonitoringService.recordReportDownload(id);
        return res.ok({ recorded: success });
    } catch (error) {
        console.error('[UsageRoutes] POST /reports/:id/download error:', error);
        return res.fail('INTERNAL_ERROR', 'Server error');
    }
});

// ============================================
// ADMIN: System Stats (Master users only)
// ============================================

/**
 * GET /usage/admin/stats - System-wide usage statistics
 */
router.get('/admin/stats', requireAuth(), async (req: Request, res: Response) => {
    try {
        const { userId } = getAuth(req);
        if (!userId) return res.fail('UNAUTHORIZED', 'Unauthorized', 401);

        // Check if user is a master/admin
        const user = await User.findOne({ clerkId: userId });
        if (!user || !isMasterUser(user.email)) {
            return res.fail('FORBIDDEN', 'Admin access required', 403);
        }

        const stats = await UsageMonitoringService.getSystemStats();
        if (!stats) return res.fail('INTERNAL_ERROR', 'Failed to get system stats');

        return res.ok(stats);
    } catch (error) {
        console.error('[UsageRoutes] /admin/stats error:', error);
        return res.fail('INTERNAL_ERROR', 'Server error');
    }
});

/**
 * GET /usage/admin/logs - Usage logs for admin monitoring
 */
router.get('/admin/logs', requireAuth(), async (req: Request, res: Response) => {
    try {
        const { userId } = getAuth(req);
        if (!userId) return res.fail('UNAUTHORIZED', 'Unauthorized', 401);

        // Check if user is a master/admin
        const user = await User.findOne({ clerkId: userId });
        if (!user || !isMasterUser(user.email)) {
            return res.fail('FORBIDDEN', 'Admin access required', 403);
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
    } catch (error) {
        console.error('[UsageRoutes] /admin/logs error:', error);
        return res.fail('INTERNAL_ERROR', 'Server error');
    }
});

/**
 * GET /usage/admin/user/:clerkId - Get specific user's usage (admin)
 */
router.get('/admin/user/:clerkId', requireAuth(), async (req: Request, res: Response) => {
    try {
        const { userId } = getAuth(req);
        if (!userId) return res.fail('UNAUTHORIZED', 'Unauthorized', 401);

        // Check if user is a master/admin
        const user = await User.findOne({ clerkId: userId });
        if (!user || !isMasterUser(user.email)) {
            return res.fail('FORBIDDEN', 'Admin access required', 403);
        }

        const targetClerkId = req.params.clerkId;
        const summary = await UsageMonitoringService.getUserUsageSummary(targetClerkId);
        if (!summary) return res.fail('NOT_FOUND', 'User not found', 404);

        return res.ok(summary);
    } catch (error) {
        console.error('[UsageRoutes] /admin/user/:clerkId error:', error);
        return res.fail('INTERNAL_ERROR', 'Server error');
    }
});

export default router;
