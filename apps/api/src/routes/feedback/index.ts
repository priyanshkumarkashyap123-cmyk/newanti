/**
 * Feedback API Route
 * 
 * POST /api/feedback - Submit user feedback for AI improvement
 * GET /api/feedback/stats - Get feedback statistics (admin)
 * POST /api/feedback/export - Export training data (admin)
 */

import { Router, Request, Response, type IRouter } from 'express';

const router: IRouter = Router();

// In-memory storage (production: use database)
interface FeedbackEntry {
    id: string;
    timestamp: Date;
    type: 'correction' | 'rating' | 'suggestion' | 'error_report';
    feature: string;
    sessionId: string;
    userId?: string;
    originalInput: string;
    originalOutput: any;
    correctedOutput?: any;
    rating?: number;
    comment?: string;
    processed: boolean;
}

const feedbackStore: FeedbackEntry[] = [];

/**
 * POST /api/feedback
 * Submit user feedback
 */
router.post('/', async (req: Request, res: Response) => {
    try {
        const { type, feature, originalInput, originalOutput, correctedOutput, rating, comment, sessionId } = req.body;

        if (!type || !feature || !sessionId) {
            return res.status(400).json({
                success: false,
                error: 'Missing required fields: type, feature, sessionId'
            });
        }

        const entry: FeedbackEntry = {
            id: `fb_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            timestamp: new Date(),
            type,
            feature,
            sessionId,
            userId: ((req as Record<string, unknown>).auth as Record<string, unknown> | undefined)?.userId as string | undefined,
            originalInput: originalInput || '',
            originalOutput,
            correctedOutput,
            rating,
            comment,
            processed: false
        };

        feedbackStore.push(entry);

        // Keep only last 10,000 entries
        if (feedbackStore.length > 10000) {
            feedbackStore.shift();
        }

        console.log(`[Feedback] ${type} received for ${feature}`);

        return res.json({
            success: true,
            id: entry.id
        });

    } catch (error) {
        console.error('[Feedback] Error:', error);
        return res.status(500).json({
            success: false,
            error: 'Failed to submit feedback'
        });
    }
});

/**
 * GET /api/feedback/stats
 * Get feedback statistics
 */
router.get('/stats', async (_req: Request, res: Response) => {
    const corrections = feedbackStore.filter(e => e.type === 'correction');
    const ratings = feedbackStore.filter(e => e.type === 'rating' && e.rating);

    const avgRating = ratings.length > 0
        ? ratings.reduce((sum, e) => sum + (e.rating || 0), 0) / ratings.length
        : 0;

    const byFeature: Record<string, number> = {};
    const byType: Record<string, number> = {};

    for (const entry of feedbackStore) {
        byFeature[entry.feature] = (byFeature[entry.feature] || 0) + 1;
        byType[entry.type] = (byType[entry.type] || 0) + 1;
    }

    return res.json({
        success: true,
        stats: {
            total: feedbackStore.length,
            corrections: corrections.length,
            averageRating: avgRating,
            byFeature,
            byType,
            pendingProcessing: feedbackStore.filter(e => !e.processed).length
        }
    });
});

/**
 * POST /api/feedback/export
 * Export corrections as training data
 */
router.post('/export', async (_req: Request, res: Response) => {
    const corrections = feedbackStore.filter(
        e => e.type === 'correction' && e.correctedOutput && !e.processed
    );

    const trainingData = {
        version: '1.0',
        exportDate: new Date().toISOString(),
        count: corrections.length,
        entries: corrections.map(e => ({
            input: e.originalInput,
            originalOutput: e.originalOutput,
            correctedOutput: e.correctedOutput,
            feature: e.feature,
            timestamp: e.timestamp
        }))
    };

    // Mark as processed
    corrections.forEach(c => {
        c.processed = true;
    });

    console.log(`[Feedback] Exported ${corrections.length} corrections for training`);

    return res.json({
        success: true,
        data: trainingData
    });
});

/**
 * GET /api/feedback/recent
 * Get recent feedback entries
 */
router.get('/recent', async (req: Request, res: Response) => {
    const limit = Math.min(parseInt(req.query['limit'] as string) || 50, 100);
    const recent = feedbackStore.slice(-limit).reverse();

    return res.json({
        success: true,
        entries: recent.map(e => ({
            id: e.id,
            type: e.type,
            feature: e.feature,
            rating: e.rating,
            timestamp: e.timestamp,
            hasCorrection: !!e.correctedOutput
        }))
    });
});

export default router;
