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

const router: IRouter = Router();
const auditService = getDbAuditService();

// All audit routes require authentication
router.use(requireAuth());

/**
 * POST /api/audit
 * Log a new audit entry
 */
router.post('/', async (req: Request, res: Response) => {
    try {
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
            return res.fail('VALIDATION_ERROR', 'Missing required fields: projectId, sessionId, type, action, details', 400);
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

    } catch (error) {
        console.error('[Audit API] Error logging entry:', error);
        return res.fail('INTERNAL_ERROR', 'Failed to log audit entry');
    }
});

/**
 * GET /api/audit/:projectId
 * Get audit entries for a project
 */
router.get('/:projectId', async (req: Request, res: Response) => {
    try {
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

    } catch (error) {
        console.error('[Audit API] Error fetching entries:', error);
        return res.fail('INTERNAL_ERROR', 'Failed to fetch entries');
    }
});

/**
 * GET /api/audit/:projectId/stats
 * Get audit statistics for a project
 */
router.get('/:projectId/stats', async (req: Request, res: Response) => {
    try {
        const { projectId } = req.params;
        const stats = await auditService.getStats(projectId);

        return res.ok({ stats });

    } catch (error) {
        console.error('[Audit API] Error fetching stats:', error);
        return res.fail('INTERNAL_ERROR', 'Failed to fetch stats');
    }
});

/**
 * POST /api/audit/sign
 * Sign audit entries with PE credentials
 */
router.post('/sign', async (req: Request, res: Response) => {
    try {
        const { entryIds, engineerName, licenseNumber } = req.body;

        if (!entryIds || !engineerName || !licenseNumber) {
            return res.fail('VALIDATION_ERROR', 'Missing required fields: entryIds, engineerName, licenseNumber', 400);
        }

        const count = await auditService.signEntries(entryIds, {
            engineerName,
            licenseNumber,
            signedAt: new Date()
        });

        return res.ok({ signedCount: count });

    } catch (error) {
        console.error('[Audit API] Error signing entries:', error);
        return res.fail('INTERNAL_ERROR', 'Failed to sign entries');
    }
});

/**
 * GET /api/audit/:projectId/report
 * Generate PE-signable report
 */
router.get('/:projectId/report', async (req: Request, res: Response) => {
    try {
        const { projectId } = req.params;
        const { engineer, license } = req.query;

        if (!engineer || !license) {
            return res.fail('VALIDATION_ERROR', 'Missing query parameters: engineer, license', 400);
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

    } catch (error) {
        console.error('[Audit API] Error generating report:', error);
        return res.fail('INTERNAL_ERROR', 'Failed to generate report');
    }
});

/**
 * GET /api/audit/:projectId/export
 * Export entries for compliance
 */
router.get('/:projectId/export', async (req: Request, res: Response) => {
    try {
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

    } catch (error) {
        console.error('[Audit API] Error exporting:', error);
        return res.fail('INTERNAL_ERROR', 'Failed to export');
    }
});

export default router;
