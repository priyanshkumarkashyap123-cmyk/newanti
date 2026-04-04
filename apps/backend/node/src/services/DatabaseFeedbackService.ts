/**
 * DatabaseFeedbackService.ts
 * 
 * Production feedback service with database persistence
 * Replaces localStorage FeedbackService for production use
 */

import { PrismaClient, FeedbackType, FeedbackEntry } from '../types/prisma-stub.js';

// Type alias for compatibility
type Feedback = FeedbackEntry;

// ============================================
// TYPES
// ============================================

export interface CreateFeedback {
    projectId?: string;
    userId?: string;
    sessionId: string;
    type: FeedbackType;
    feature: string;
    originalInput: string;
    originalOutput?: Record<string, unknown>;
    correctedOutput?: Record<string, unknown>;
    rating?: number;
    comment?: string;
}

export interface FeedbackStats {
    total: number;
    corrections: number;
    averageRating: number;
    byFeature: Record<string, number>;
    byType: Record<string, number>;
    unprocessed: number;
}

export interface TrainingExport {
    version: string;
    exportedAt: Date;
    entries: Array<{
        input: string;
        originalOutput: Record<string, unknown>;
        correctedOutput: Record<string, unknown>;
        feature: string;
        rating?: number;
    }>;
}

// ============================================
// DATABASE FEEDBACK SERVICE
// ============================================

export class DatabaseFeedbackService {
    private prisma: PrismaClient;

    constructor(prisma?: PrismaClient) {
        this.prisma = prisma || new PrismaClient();
    }

    /**
     * Log a correction
     */
    async logCorrection(
        data: Omit<CreateFeedback, 'type'> & { correctedOutput: Record<string, unknown> }
    ): Promise<Feedback> {
        return this.prisma.feedback.create({
            data: {
                projectId: data.projectId,
                userId: data.userId,
                sessionId: data.sessionId,
                type: FeedbackType.CORRECTION,
                feature: data.feature,
                originalInput: data.originalInput,
                originalOutput: data.originalOutput || {},
                correctedOutput: data.correctedOutput
            }
        });
    }

    /**
     * Log a rating
     */
    async logRating(
        data: Omit<CreateFeedback, 'type'> & { rating: number }
    ): Promise<Feedback> {
        return this.prisma.feedback.create({
            data: {
                projectId: data.projectId,
                userId: data.userId,
                sessionId: data.sessionId,
                type: FeedbackType.RATING,
                feature: data.feature,
                originalInput: data.originalInput,
                originalOutput: data.originalOutput || {},
                rating: data.rating,
                comment: data.comment
            }
        });
    }

    /**
     * Log a suggestion
     */
    async logSuggestion(
        sessionId: string,
        feature: string,
        suggestion: string
    ): Promise<Feedback> {
        return this.prisma.feedback.create({
            data: {
                sessionId,
                type: FeedbackType.SUGGESTION,
                feature,
                originalInput: '',
                comment: suggestion
            }
        });
    }

    /**
     * Log an error report
     */
    async logError(
        sessionId: string,
        feature: string,
        originalInput: string,
        error: string
    ): Promise<Feedback> {
        return this.prisma.feedback.create({
            data: {
                sessionId,
                type: FeedbackType.ERROR_REPORT,
                feature,
                originalInput,
                originalOutput: { error }
            }
        });
    }

    /**
     * Get feedback statistics
     */
    async getStats(projectId?: string): Promise<FeedbackStats> {
        const where = projectId ? { projectId } : {};

        const [total, corrections, ratings, byType, byFeature, unprocessed] = await Promise.all([
            this.prisma.feedback.count({ where }),
            this.prisma.feedback.count({ where: { ...where, type: FeedbackType.CORRECTION } }),
            this.prisma.feedback.findMany({
                where: { ...where, rating: { not: null } },
                select: { rating: true }
            }),
            this.prisma.feedback.groupBy({
                by: ['type'],
                where,
                _count: true
            }),
            this.prisma.feedback.groupBy({
                by: ['feature'],
                where,
                _count: true
            }),
            this.prisma.feedback.count({ where: { ...where, processed: false } })
        ]);

        const avgRating = ratings.length > 0
            ? ratings.reduce((sum: number, r: { rating?: number | null }) => sum + (r.rating || 0), 0) / ratings.length
            : 0;

        const typeMap: Record<string, number> = {};
        byType.forEach(({ type, _count }: { type?: string; _count: number }) => {
            if (type) typeMap[type] = _count;
        });

        const featureMap: Record<string, number> = {};
        byFeature.forEach(({ feature, _count }: { feature?: string; _count: number }) => {
            if (feature) featureMap[feature] = _count;
        });

        return {
            total,
            corrections,
            averageRating: avgRating,
            byType: typeMap,
            byFeature: featureMap,
            unprocessed
        };
    }

    /**
     * Get recent feedback
     */
    async getRecent(limit: number = 50, projectId?: string): Promise<Feedback[]> {
        return this.prisma.feedback.findMany({
            where: projectId ? { projectId } : {},
            orderBy: { createdAt: 'desc' },
            take: limit
        });
    }

    /**
     * Export corrections for training
     */
    async exportForTraining(): Promise<TrainingExport> {
        const corrections = await this.prisma.feedback.findMany({
            where: {
                type: FeedbackType.CORRECTION,
                correctedOutput: { not: null },
                processed: false
            },
            orderBy: { createdAt: 'desc' }
        });

        return {
            version: '1.0',
            exportedAt: new Date(),
            entries: corrections.map(c => ({
                input: c.originalInput,
                originalOutput: (c.originalOutput ?? {}) as Record<string, unknown>,
                correctedOutput: (c.correctedOutput ?? {}) as Record<string, unknown>,
                feature: c.feature || '',
                rating: c.rating ?? undefined
            }))
        };
    }

    /**
     * Mark entries as processed
     */
    async markProcessed(ids: string[]): Promise<number> {
        const result = await this.prisma.feedback.updateMany({
            where: { id: { in: ids } },
            data: { processed: true }
        });
        return result.count;
    }

    /**
     * Mark entries as used for training
     */
    async markUsedForTraining(ids: string[]): Promise<number> {
        const result = await this.prisma.feedback.updateMany({
            where: { id: { in: ids } },
            data: {
                usedForTraining: true,
                exportedAt: new Date()
            }
        });
        return result.count;
    }

    /**
     * Get improvement metrics over time
     */
    async getImprovementMetrics(
        feature: string,
        days: number = 30
    ): Promise<{
        ratingsOverTime: Array<{ date: string; avgRating: number }>;
        correctionRate: number;
    }> {
        const cutoff = new Date();
        cutoff.setDate(cutoff.getDate() - days);

        const entries = await this.prisma.feedback.findMany({
            where: {
                feature,
                createdAt: { gte: cutoff }
            },
            orderBy: { createdAt: 'asc' }
        });

        // Group by day
        const byDay: Record<string, number[]> = {};
        for (const entry of entries) {
            if (entry.rating) {
                const day = entry.createdAt.toISOString().split('T')[0];
                if (!byDay[day]) byDay[day] = [];
                byDay[day].push(entry.rating);
            }
        }

        const ratingsOverTime = Object.entries(byDay).map(([date, ratings]) => ({
            date,
            avgRating: ratings.reduce((a, b) => a + b, 0) / ratings.length
        }));

        const corrections = entries.filter(e => e.type === FeedbackType.CORRECTION).length;
        const correctionRate = entries.length > 0 ? corrections / entries.length : 0;

        return { ratingsOverTime, correctionRate };
    }
}

// ============================================
// SINGLETON
// ============================================

let dbFeedbackInstance: DatabaseFeedbackService | null = null;

export function getDbFeedbackService(prisma?: PrismaClient): DatabaseFeedbackService {
    if (!dbFeedbackInstance) {
        dbFeedbackInstance = new DatabaseFeedbackService(prisma);
    }
    return dbFeedbackInstance;
}

export default DatabaseFeedbackService;
