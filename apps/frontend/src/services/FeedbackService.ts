/**
 * FeedbackService.ts
 * 
 * User Feedback Collection & Learning System
 * 
 * Enables continuous improvement of AI predictions through:
 * - Correction logging
 * - Feedback aggregation
 * - Training data export
 * - A/B testing support
 */

// ============================================
// TYPES
// ============================================

import { logger } from '../lib/logging/logger';

export interface FeedbackEntry {
    id: string;
    timestamp: Date;
    type: 'correction' | 'rating' | 'suggestion' | 'error_report';

    // Context
    feature: 'model_generation' | 'analysis' | 'design_check' | 'connection' | 'optimization';
    sessionId: string;
    userId?: string;

    // AI's original output
    originalInput: string;
    originalOutput: Record<string, unknown>;

    // User's correction/feedback
    correctedOutput?: Record<string, unknown>;
    rating?: 1 | 2 | 3 | 4 | 5;
    comment?: string;

    // Metadata
    metadata?: {
        modelContext?: Record<string, unknown>;
        aiConfidence?: number;
        processingTime?: number;
        [key: string]: unknown;
    };

    // For ML pipeline
    processed: boolean;
    usedForTraining: boolean;
}

export interface FeedbackStats {
    totalFeedback: number;
    corrections: number;
    averageRating: number;
    byFeature: Record<string, number>;
    byType: Record<string, number>;
    improvementRate: number; // Percentage of corrections leading to better outputs
}

export interface TrainingDataExport {
    version: string;
    exportDate: Date;
    entries: Array<{
        input: string;
        originalOutput: Record<string, unknown>;
        correctedOutput: Record<string, unknown> | undefined;
        featureType: string;
    }>;
}

// ============================================
// FEEDBACK SERVICE CLASS
// ============================================

class FeedbackServiceClass {
    private entries: FeedbackEntry[] = [];
    private storage: Storage | null = null;
    private readonly STORAGE_KEY = 'beamlab_feedback';
    private readonly MAX_ENTRIES = 1000;
    private sessionId: string;

    constructor() {
        this.sessionId = this.generateSessionId();
        this.initStorage();
    }

    private generateSessionId(): string {
        return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    private initStorage(): void {
        if (typeof window !== 'undefined' && window.localStorage) {
            this.storage = window.localStorage;
            this.loadFromStorage();
        }
    }

    private loadFromStorage(): void {
        if (!this.storage) return;
        try {
            const data = this.storage.getItem(this.STORAGE_KEY);
            if (data) {
                this.entries = JSON.parse(data).map((e: Record<string, unknown>) => ({
                    ...e,
                    timestamp: new Date(e.timestamp as string)
                }));
            }
        } catch (e) {
            logger.warn('[FeedbackService] Failed to load from storage', { error: e instanceof Error ? e.message : String(e) });
        }
    }

    private saveToStorage(): void {
        if (!this.storage) return;
        try {
            // Keep only recent entries
            const toSave = this.entries.slice(-this.MAX_ENTRIES);
            this.storage.setItem(this.STORAGE_KEY, JSON.stringify(toSave));
        } catch (e) {
            logger.warn('[FeedbackService] Failed to save to storage', { error: e instanceof Error ? e.message : String(e) });
        }
    }

    private generateId(): string {
        return `fb_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    // ==========================================
    // PUBLIC API
    // ==========================================

    /**
     * Log a user correction to AI output
     */
    logCorrection(
        feature: FeedbackEntry['feature'],
        originalInput: string,
        originalOutput: Record<string, unknown>,
        correctedOutput: Record<string, unknown>,
        metadata?: FeedbackEntry['metadata']
    ): string {
        const entry: FeedbackEntry = {
            id: this.generateId(),
            timestamp: new Date(),
            type: 'correction',
            feature,
            sessionId: this.sessionId,
            originalInput,
            originalOutput,
            correctedOutput,
            metadata,
            processed: false,
            usedForTraining: false
        };

        this.entries.push(entry);
        this.saveToStorage();

        logger.info(`[FeedbackService] Correction logged for ${feature}`);
        return entry.id;
    }

    /**
     * Log a user rating
     */
    logRating(
        feature: FeedbackEntry['feature'],
        originalInput: string,
        originalOutput: Record<string, unknown>,
        rating: 1 | 2 | 3 | 4 | 5,
        comment?: string
    ): string {
        const entry: FeedbackEntry = {
            id: this.generateId(),
            timestamp: new Date(),
            type: 'rating',
            feature,
            sessionId: this.sessionId,
            originalInput,
            originalOutput,
            rating,
            comment,
            processed: false,
            usedForTraining: false
        };

        this.entries.push(entry);
        this.saveToStorage();

        logger.info(`[FeedbackService] Rating ${rating}/5 logged for ${feature}`);
        return entry.id;
    }

    /**
     * Log a user suggestion
     */
    logSuggestion(
        feature: FeedbackEntry['feature'],
        suggestion: string,
        context?: Record<string, unknown>
    ): string {
        const entry: FeedbackEntry = {
            id: this.generateId(),
            timestamp: new Date(),
            type: 'suggestion',
            feature,
            sessionId: this.sessionId,
            originalInput: '',
            originalOutput: {} as Record<string, unknown>,
            comment: suggestion,
            metadata: { context },
            processed: false,
            usedForTraining: false
        };

        this.entries.push(entry);
        this.saveToStorage();

        return entry.id;
    }

    /**
     * Log an error report
     */
    logError(
        feature: FeedbackEntry['feature'],
        originalInput: string,
        error: unknown,
        userDescription?: string
    ): string {
        const entry: FeedbackEntry = {
            id: this.generateId(),
            timestamp: new Date(),
            type: 'error_report',
            feature,
            sessionId: this.sessionId,
            originalInput,
            originalOutput: { error: error instanceof Error ? error.message : String(error) },
            comment: userDescription,
            processed: false,
            usedForTraining: false
        };

        this.entries.push(entry);
        this.saveToStorage();

        logger.info(`[FeedbackService] Error reported for ${feature}`);
        return entry.id;
    }

    /**
     * Get feedback statistics
     */
    getStats(): FeedbackStats {
        const corrections = this.entries.filter(e => e.type === 'correction');
        const ratings = this.entries.filter(e => e.type === 'rating' && e.rating);

        const avgRating = ratings.length > 0
            ? ratings.reduce((sum, e) => sum + (e.rating || 0), 0) / ratings.length
            : 0;

        const byFeature: Record<string, number> = {};
        const byType: Record<string, number> = {};

        for (const entry of this.entries) {
            byFeature[entry.feature] = (byFeature[entry.feature] || 0) + 1;
            byType[entry.type] = (byType[entry.type] || 0) + 1;
        }

        return {
            totalFeedback: this.entries.length,
            corrections: corrections.length,
            averageRating: avgRating,
            byFeature,
            byType,
            improvementRate: 0 // Would require comparing model performance
        };
    }

    /**
     * Get entries for a specific feature
     */
    getEntriesForFeature(feature: FeedbackEntry['feature']): FeedbackEntry[] {
        return this.entries.filter(e => e.feature === feature);
    }

    /**
     * Get recent feedback entries
     */
    getRecent(count: number = 50): FeedbackEntry[] {
        return this.entries.slice(-count).reverse();
    }

    /**
     * Export corrections as training data
     */
    exportTrainingData(): TrainingDataExport {
        const corrections = this.entries.filter(
            e => e.type === 'correction' && e.correctedOutput
        );

        return {
            version: '1.0',
            exportDate: new Date(),
            entries: corrections.map(e => ({
                input: e.originalInput,
                originalOutput: e.originalOutput,
                correctedOutput: e.correctedOutput,
                featureType: e.feature
            }))
        };
    }

    /**
     * Export as JSON for backend upload
     */
    exportAsJSON(): string {
        const data = this.exportTrainingData();
        return JSON.stringify(data, null, 2);
    }

    /**
     * Mark entries as used for training
     */
    markAsUsedForTraining(entryIds: string[]): void {
        for (const entry of this.entries) {
            if (entryIds.includes(entry.id)) {
                entry.usedForTraining = true;
                entry.processed = true;
            }
        }
        this.saveToStorage();
    }

    /**
     * Clear all feedback (for privacy)
     */
    clearAll(): void {
        this.entries = [];
        if (this.storage) {
            this.storage.removeItem(this.STORAGE_KEY);
        }
    }

    /**
     * Get counts for UI badge
     */
    getCounts(): { pending: number; total: number } {
        const pending = this.entries.filter(e => !e.processed).length;
        return { pending, total: this.entries.length };
    }
}

// ============================================
// FEEDBACK UI HELPERS
// ============================================

/**
 * Quick rating component data
 */
export interface QuickRatingProps {
    feature: FeedbackEntry['feature'];
    input: string;
    output: Record<string, unknown>;
    onRated?: (rating: number) => void;
}

/**
 * Correction dialog data
 */
export interface CorrectionDialogData {
    feature: FeedbackEntry['feature'];
    input: string;
    output: Record<string, unknown>;
    correctedFields: Record<string, unknown>;
}

// ============================================
// SINGLETON INSTANCE
// ============================================

export const feedbackService = new FeedbackServiceClass();

// ============================================
// REACT HOOK (if React is available)
// ============================================

/**
 * Hook for feedback in components
 * Usage: const { logCorrection, logRating, stats } = useFeedback();
 */
export function useFeedback() {
    return {
        logCorrection: feedbackService.logCorrection.bind(feedbackService),
        logRating: feedbackService.logRating.bind(feedbackService),
        logSuggestion: feedbackService.logSuggestion.bind(feedbackService),
        logError: feedbackService.logError.bind(feedbackService),
        getStats: feedbackService.getStats.bind(feedbackService),
        getRecent: feedbackService.getRecent.bind(feedbackService),
        exportTrainingData: feedbackService.exportTrainingData.bind(feedbackService)
    };
}

export default feedbackService;
