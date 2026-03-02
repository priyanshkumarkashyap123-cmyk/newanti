/**
 * Audit API Routes
 * 
 * POST /api/audit - Log audit entry
 * GET /api/audit/:projectId - Get project audit entries
 * POST /api/audit/sign - Sign entries with PE credentials
 * GET /api/audit/:projectId/report - Generate PE-signable report
 */

import { Router, Request, Response, type IRouter } from 'express';
import { getDbAuditService } from '../../services/DatabaseAuditService.js';
import { AuditType } from '../../types/prisma-stub.js';
import { requireAuth, getAuth } from '../../middleware/authMiddleware.js';
import { asyncHandler, HttpError } from '../../utils/asyncHandler.js';

const router: IRouter = Router();
const auditService = getDbAuditService();

// All audit routes require authentication
router.use(requireAuth());

/**
 * POST /api/audit
 * Log a new audit entry
 */
router.post('/', asyncHandler(async (req: Request, res: Response) => {
    const {
        projectId,
        sessionId,
        type,
        action,
        details,
        aiGenerated,
        confidence,
        modelUsed,
        metadata
    } = req.body;

    if (!projectId || !sessionId || !type || !action || !details) {
        throw new HttpError(400, 'Missing required fields: projectId, sessionId, type, action, details');
    }

    const entry = await auditService.log({
        projectId,
        sessionId,
        type: type as AuditType,
        action,
        details,
        aiGenerated,
        confidence,
        modelUsed,
        metadata
    });

    return res.ok({
        id: entry.id,
        timestamp: entry.timestamp
    });
}));

/**
 * GET /api/audit/:projectId
 * Get audit entries for a project
 */
router.get('/:projectId', asyncHandler(async (req: Request, res: Response) => {
    const { projectId } = req.params;
    const { type, limit, offset, startDate, endDate } = req.query;

    const entries = await auditService.getProjectEntries(projectId, {
        type: type as AuditType,
        limit: limit ? parseInt(limit as string) : undefined,
        offset: offset ? parseInt(offset as string) : undefined,
        startDate: startDate ? new Date(startDate as string) : undefined,
        endDate: endDate ? new Date(endDate as string) : undefined
    });

    return res.ok({
        entries,
        count: entries.length
    });
}));

/**
 * GET /api/audit/:projectId/stats
 * Get audit statistics for a project
 */
router.get('/:projectId/stats', asyncHandler(async (req: Request, res: Response) => {
    const { projectId } = req.params;
    const stats = await auditService.getStats(projectId);

    return res.ok({ stats });
}));

/**
 * POST /api/audit/sign
 * Sign audit entries with PE credentials
 */
router.post('/sign', asyncHandler(async (req: Request, res: Response) => {
    const { entryIds, engineerName, licenseNumber } = req.body;

    if (!entryIds || !engineerName || !licenseNumber) {
        throw new HttpError(400, 'Missing required fields: entryIds, engineerName, licenseNumber');
    }

    const count = await auditService.signEntries(entryIds, {
        engineerName,
        licenseNumber,
        signedAt: new Date()
    });

    return res.ok({ signedCount: count });
}));

/**
 * GET /api/audit/:projectId/report
 * Generate PE-signable report
 */
router.get('/:projectId/report', asyncHandler(async (req: Request, res: Response) => {
    const { projectId } = req.params;
    const { engineer, license } = req.query;

    if (!engineer || !license) {
        throw new HttpError(400, 'Missing query parameters: engineer, license');
    }

    const report = await auditService.generateReport(
        projectId,
        engineer as string,
        license as string
    );

    return res.ok({
        report,
        format: 'markdown'
    });
}));

/**
 * GET /api/audit/:projectId/export
 * Export entries for compliance
 */
router.get('/:projectId/export', asyncHandler(async (req: Request, res: Response) => {
    const { projectId } = req.params;
    const format = (req.query.format as 'json' | 'csv') || 'json';

    const data = await auditService.exportForCompliance(projectId, format);

    if (format === 'csv') {
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename=audit_${projectId}.csv`);
    } else {
        res.setHeader('Content-Type', 'application/json');
    }

    return res.send(data);
}));

export default router;
