/**
 * LearningPipelineService.ts
 * 
 * Continuous Learning Pipeline for AI Improvement
 * 
 * Features:
 * - Aggregates user corrections from FeedbackService
 * - Prepares training datasets
 * - Tracks model performance over time
 * - A/B testing support
 */

import { feedbackService, FeedbackEntry } from '../FeedbackService';

// ============================================
// TYPES
// ============================================

export interface TrainingExample {
    id: string;
    feature: string;
    input: string;
    originalOutput: any;
    correctedOutput: any;
    timestamp: Date;
    quality: 'high' | 'medium' | 'low';
}

export interface TrainingDataset {
    version: string;
    createdAt: Date;
    feature: string;
    examples: TrainingExample[];
    stats: {
        total: number;
        highQuality: number;
        validated: number;
    };
}

export interface ModelPerformance {
    feature: string;
    period: string;
    metrics: {
        averageRating: number;
        correctionRate: number;
        acceptanceRate: number;
        errorRate: number;
    };
    trend: 'improving' | 'stable' | 'declining';
}

export interface ABTestConfig {
    id: string;
    name: string;
    feature: string;
    variants: Array<{
        id: string;
        name: string;
        weight: number;
        config: Record<string, any>;
    }>;
    startDate: Date;
    endDate?: Date;
    status: 'active' | 'completed' | 'paused';
}

export interface ABTestResult {
    testId: string;
    variantId: string;
    sampleSize: number;
    averageRating: number;
    conversionRate: number;
    confidence: number;
}

// ============================================
// LEARNING PIPELINE SERVICE
// ============================================

class LearningPipelineServiceClass {
    private abTests: Map<string, ABTestConfig> = new Map();
    private abResults: Map<string, ABTestResult[]> = new Map();

    /**
     * Generate training dataset from corrections
     */
    generateTrainingDataset(feature?: string): TrainingDataset {
        const stats = feedbackService.getStats();
        const exported = feedbackService.exportTrainingData();

        const examples: TrainingExample[] = exported.entries
            .filter(e => !feature || e.featureType === feature)
            .map((e, idx) => ({
                id: `ex_${idx}`,
                feature: e.featureType,
                input: e.input,
                originalOutput: e.originalOutput,
                correctedOutput: e.correctedOutput,
                timestamp: new Date(),
                quality: this.assessQuality(e)
            }));

        return {
            version: '1.0',
            createdAt: new Date(),
            feature: feature || 'all',
            examples,
            stats: {
                total: examples.length,
                highQuality: examples.filter(e => e.quality === 'high').length,
                validated: examples.filter(e => e.quality !== 'low').length
            }
        };
    }

    /**
     * Assess quality of a training example
     */
    private assessQuality(example: { input: string; correctedOutput: any }): 'high' | 'medium' | 'low' {
        // High quality: substantial correction with clear input
        if (example.input.length > 20 && example.correctedOutput) {
            const correctionStr = JSON.stringify(example.correctedOutput);
            if (correctionStr.length > 50) return 'high';
            return 'medium';
        }
        return 'low';
    }

    /**
     * Get performance metrics for a feature
     */
    getPerformance(feature: string, days: number = 30): ModelPerformance {
        const entries = feedbackService.getEntriesForFeature(feature as FeedbackEntry['feature']);
        const cutoff = new Date();
        cutoff.setDate(cutoff.getDate() - days);

        const recent = entries.filter(e => new Date(e.timestamp) >= cutoff);

        const ratings = recent.filter(e => e.rating);
        const corrections = recent.filter(e => e.type === 'correction');
        const errors = recent.filter(e => e.type === 'error_report');

        const avgRating = ratings.length > 0
            ? ratings.reduce((sum, e) => sum + (e.rating || 0), 0) / ratings.length
            : 0;

        const correctionRate = recent.length > 0
            ? corrections.length / recent.length
            : 0;

        const errorRate = recent.length > 0
            ? errors.length / recent.length
            : 0;

        // Determine trend based on rating changes
        let trend: 'improving' | 'stable' | 'declining' = 'stable';
        if (ratings.length >= 10) {
            const firstHalf = ratings.slice(0, Math.floor(ratings.length / 2));
            const secondHalf = ratings.slice(Math.floor(ratings.length / 2));

            const firstAvg = firstHalf.reduce((s, e) => s + (e.rating || 0), 0) / firstHalf.length;
            const secondAvg = secondHalf.reduce((s, e) => s + (e.rating || 0), 0) / secondHalf.length;

            if (secondAvg > firstAvg + 0.3) trend = 'improving';
            else if (secondAvg < firstAvg - 0.3) trend = 'declining';
        }

        return {
            feature,
            period: `${days} days`,
            metrics: {
                averageRating: avgRating,
                correctionRate,
                acceptanceRate: 1 - correctionRate - errorRate,
                errorRate
            },
            trend
        };
    }

    /**
     * Get performance summary for all features
     */
    getAllPerformance(days: number = 30): ModelPerformance[] {
        const features: FeedbackEntry['feature'][] = [
            'model_generation',
            'analysis',
            'design_check',
            'connection',
            'optimization'
        ];

        return features.map(f => this.getPerformance(f, days));
    }

    /**
     * Create A/B test
     */
    createABTest(config: Omit<ABTestConfig, 'status'>): string {
        const test: ABTestConfig = {
            ...config,
            status: 'active'
        };
        this.abTests.set(config.id, test);
        console.log(`[LearningPipeline] A/B test created: ${config.name}`);
        return config.id;
    }

    /**
     * Get variant for A/B test
     */
    getVariant(testId: string, userId?: string): string | null {
        const test = this.abTests.get(testId);
        if (!test || test.status !== 'active') return null;

        // Weighted random selection (or consistent based on userId)
        const totalWeight = test.variants.reduce((sum, v) => sum + v.weight, 0);
        let random = userId
            ? this.hashToNumber(userId) * totalWeight
            : Math.random() * totalWeight;

        for (const variant of test.variants) {
            random -= variant.weight;
            if (random <= 0) return variant.id;
        }

        return test.variants[0]?.id || null;
    }

    private hashToNumber(str: string): number {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            hash = ((hash << 5) - hash) + str.charCodeAt(i);
            hash = hash & hash;
        }
        return Math.abs(hash) / 2147483647;
    }

    /**
     * Log A/B test result
     */
    logABResult(testId: string, variantId: string, rating: number): void {
        const results = this.abResults.get(testId) || [];
        const existing = results.find(r => r.variantId === variantId);

        if (existing) {
            existing.sampleSize++;
            existing.averageRating = (existing.averageRating * (existing.sampleSize - 1) + rating) / existing.sampleSize;
        } else {
            results.push({
                testId,
                variantId,
                sampleSize: 1,
                averageRating: rating,
                conversionRate: 0,
                confidence: 0
            });
        }

        this.abResults.set(testId, results);
    }

    /**
     * Get A/B test results
     */
    getABResults(testId: string): ABTestResult[] {
        return this.abResults.get(testId) || [];
    }

    /**
     * Export all training data for model fine-tuning
     */
    exportForFineTuning(): {
        datasets: TrainingDataset[];
        performance: ModelPerformance[];
        exportDate: Date;
    } {
        const features: FeedbackEntry['feature'][] = [
            'model_generation',
            'analysis',
            'design_check',
            'connection',
            'optimization'
        ];

        return {
            datasets: features.map(f => this.generateTrainingDataset(f)),
            performance: this.getAllPerformance(),
            exportDate: new Date()
        };
    }

    /**
     * Generate improvement recommendations
     */
    getImprovementRecommendations(): Array<{
        feature: string;
        priority: 'high' | 'medium' | 'low';
        recommendation: string;
        dataAvailable: number;
    }> {
        const performance = this.getAllPerformance();
        const recommendations: Array<{
            feature: string;
            priority: 'high' | 'medium' | 'low';
            recommendation: string;
            dataAvailable: number;
        }> = [];

        for (const perf of performance) {
            const dataset = this.generateTrainingDataset(perf.feature);

            if (perf.metrics.correctionRate > 0.3) {
                recommendations.push({
                    feature: perf.feature,
                    priority: 'high',
                    recommendation: `High correction rate (${(perf.metrics.correctionRate * 100).toFixed(0)}%). Review common correction patterns and update prompts.`,
                    dataAvailable: dataset.examples.length
                });
            } else if (perf.metrics.averageRating < 3.5 && perf.metrics.averageRating > 0) {
                recommendations.push({
                    feature: perf.feature,
                    priority: 'medium',
                    recommendation: `Below-average rating (${perf.metrics.averageRating.toFixed(1)}/5). Consider fine-tuning with ${dataset.stats.highQuality} high-quality examples.`,
                    dataAvailable: dataset.examples.length
                });
            } else if (perf.trend === 'declining') {
                recommendations.push({
                    feature: perf.feature,
                    priority: 'medium',
                    recommendation: 'Performance declining. Monitor closely and investigate recent changes.',
                    dataAvailable: dataset.examples.length
                });
            }
        }

        return recommendations.sort((a, b) => {
            const priority = { high: 0, medium: 1, low: 2 };
            return priority[a.priority] - priority[b.priority];
        });
    }
}

// ============================================
// SINGLETON
// ============================================

export const learningPipeline = new LearningPipelineServiceClass();

export default learningPipeline;
