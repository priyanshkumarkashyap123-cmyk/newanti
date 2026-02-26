/**
 * ReinforcementLearningService.ts - Continuous AI Improvement
 * 
 * Implements reward-based learning for AI decisions:
 * - Tracks success/failure of AI recommendations
 * - Adjusts confidence scores based on outcomes
 * - Automatically improves prompts based on feedback
 * - Maintains performance baselines
 */

import { selfImprovement } from './SelfImprovementEngine';

// ============================================
// TYPES
// ============================================

export interface Experience {
    id: string;
    state: any;           // Input state
    action: string;       // AI decision/recommendation
    reward: number;       // -1 to 1 (negative = bad, positive = good)
    nextState?: any;      // Resulting state
    timestamp: Date;
}

export interface Policy {
    feature: string;
    actionWeights: Map<string, number>;  // action -> weight
    explorationRate: number;             // Epsilon for exploration
    learningRate: number;                // Alpha
}

export interface PerformanceBaseline {
    feature: string;
    avgReward: number;
    stdDev: number;
    sampleCount: number;
    lastUpdated: Date;
}

export interface LearningMetrics {
    totalExperiences: number;
    positiveRewards: number;
    negativeRewards: number;
    avgReward: number;
    improvementTrend: 'improving' | 'stable' | 'declining';
    topActions: { action: string; avgReward: number; count: number }[];
}

// ============================================
// REINFORCEMENT LEARNING SERVICE
// ============================================

class ReinforcementLearningServiceClass {
    private experiences: Map<string, Experience[]> = new Map();
    private policies: Map<string, Policy> = new Map();
    private baselines: Map<string, PerformanceBaseline> = new Map();

    private readonly MAX_EXPERIENCES = 10000;
    private readonly DEFAULT_LEARNING_RATE = 0.1;
    private readonly DEFAULT_EXPLORATION = 0.1;

    constructor() {
        this.loadFromStorage();
        // Initialize default policies for key features
        this.initializePolicy('section_recommendation');
        this.initializePolicy('load_estimation');
        this.initializePolicy('design_check');
        this.initializePolicy('voice_command');
        this.initializePolicy('generative_design');
    }

    /**
     * Record an experience (state, action, reward)
     */
    recordExperience(feature: string, experience: Omit<Experience, 'id' | 'timestamp'>): void {
        const fullExperience: Experience = {
            ...experience,
            id: this.generateId(),
            timestamp: new Date()
        };

        if (!this.experiences.has(feature)) {
            this.experiences.set(feature, []);
        }

        const featureExperiences = this.experiences.get(feature)!;
        featureExperiences.push(fullExperience);

        // Trim old experiences
        if (featureExperiences.length > this.MAX_EXPERIENCES) {
            featureExperiences.splice(0, featureExperiences.length - this.MAX_EXPERIENCES);
        }

        // Update policy based on experience
        this.updatePolicy(feature, fullExperience);

        // Update baseline
        this.updateBaseline(feature);

        this.saveToStorage();
    }

    /**
     * Record positive feedback (user approved)
     */
    recordSuccess(feature: string, action: string, state: any): void {
        this.recordExperience(feature, { state, action, reward: 1.0 });
    }

    /**
     * Record negative feedback (user corrected)
     */
    recordFailure(feature: string, action: string, state: any, correction?: string): void {
        this.recordExperience(feature, {
            state,
            action,
            reward: -0.5,
            nextState: { correction }
        });
    }

    /**
     * Record neutral outcome (user made no change)
     */
    recordNeutral(feature: string, action: string, state: any): void {
        this.recordExperience(feature, { state, action, reward: 0.2 });
    }

    /**
     * Get recommended action based on learned policy
     */
    getRecommendedAction(feature: string, availableActions: string[]): { action: string; confidence: number } {
        const policy = this.policies.get(feature);

        if (!policy || Math.random() < policy.explorationRate) {
            // Exploration: random action
            return {
                action: availableActions[Math.floor(Math.random() * availableActions.length)],
                confidence: 0.5
            };
        }

        // Exploitation: best known action
        let bestAction = availableActions[0];
        let bestWeight = -Infinity;

        for (const action of availableActions) {
            const weight = policy.actionWeights.get(action) || 0;
            if (weight > bestWeight) {
                bestWeight = weight;
                bestAction = action;
            }
        }

        // Calculate confidence from weight
        const totalWeight = Array.from(policy.actionWeights.values())
            .reduce((sum, w) => sum + Math.abs(w), 0);
        const confidence = totalWeight > 0 ? Math.abs(bestWeight) / totalWeight : 0.5;

        return { action: bestAction, confidence: Math.min(0.95, 0.5 + confidence * 0.45) };
    }

    /**
     * Get learning metrics for a feature
     */
    getMetrics(feature: string): LearningMetrics {
        const experiences = this.experiences.get(feature) || [];

        const positiveRewards = experiences.filter(e => e.reward > 0).length;
        const negativeRewards = experiences.filter(e => e.reward < 0).length;
        const avgReward = experiences.length > 0
            ? experiences.reduce((sum, e) => sum + e.reward, 0) / experiences.length
            : 0;

        // Calculate improvement trend
        const recent = experiences.slice(-100);
        const older = experiences.slice(-200, -100);
        const recentAvg = recent.length > 0
            ? recent.reduce((sum, e) => sum + e.reward, 0) / recent.length
            : 0;
        const olderAvg = older.length > 0
            ? older.reduce((sum, e) => sum + e.reward, 0) / older.length
            : 0;

        let improvementTrend: LearningMetrics['improvementTrend'] = 'stable';
        if (recentAvg > olderAvg + 0.1) improvementTrend = 'improving';
        else if (recentAvg < olderAvg - 0.1) improvementTrend = 'declining';

        // Get top actions
        const actionStats = new Map<string, { totalReward: number; count: number }>();
        for (const exp of experiences) {
            const stat = actionStats.get(exp.action) || { totalReward: 0, count: 0 };
            stat.totalReward += exp.reward;
            stat.count++;
            actionStats.set(exp.action, stat);
        }

        const topActions = Array.from(actionStats.entries())
            .map(([action, stat]) => ({
                action,
                avgReward: stat.totalReward / stat.count,
                count: stat.count
            }))
            .sort((a, b) => b.avgReward - a.avgReward)
            .slice(0, 5);

        return {
            totalExperiences: experiences.length,
            positiveRewards,
            negativeRewards,
            avgReward,
            improvementTrend,
            topActions
        };
    }

    /**
     * Check if performance has degraded and trigger retraining
     */
    async checkAndRetrain(feature: string): Promise<boolean> {
        const baseline = this.baselines.get(feature);
        const metrics = this.getMetrics(feature);

        if (!baseline || metrics.totalExperiences < 50) {
            return false;
        }

        // Check if performance is significantly below baseline
        const degraded = metrics.avgReward < baseline.avgReward - baseline.stdDev;

        if (degraded) {
            console.log(`[RL] Performance degradation detected for ${feature}`);
            // Trigger self-improvement
            await selfImprovement.runMonitoringCycle();
            return true;
        }

        return false;
    }

    /**
     * Get global learning report
     */
    getGlobalReport(): {
        features: { name: string; metrics: LearningMetrics }[];
        overallTrend: string;
        totalExperiences: number;
        recommendations: string[];
    } {
        const features = Array.from(this.experiences.keys()).map(name => ({
            name,
            metrics: this.getMetrics(name)
        }));

        const totalExperiences = features.reduce((sum, f) => sum + f.metrics.totalExperiences, 0);
        const avgTrends: number[] = features.map(f => {
            if (f.metrics.improvementTrend === 'improving') return 1;
            if (f.metrics.improvementTrend === 'declining') return -1;
            return 0;
        });
        const avgTrend = avgTrends.reduce((a, b) => a + b, 0) / avgTrends.length;

        let overallTrend = 'stable';
        if (avgTrend > 0.3) overallTrend = 'improving';
        else if (avgTrend < -0.3) overallTrend = 'declining';

        const recommendations: string[] = [];
        for (const f of features) {
            if (f.metrics.improvementTrend === 'declining') {
                recommendations.push(`Review ${f.name} - performance declining`);
            }
            if (f.metrics.negativeRewards > f.metrics.positiveRewards) {
                recommendations.push(`Improve ${f.name} - more failures than successes`);
            }
        }

        return {
            features,
            overallTrend,
            totalExperiences,
            recommendations
        };
    }

    // ============================================
    // PRIVATE METHODS
    // ============================================

    private initializePolicy(feature: string): void {
        if (!this.policies.has(feature)) {
            this.policies.set(feature, {
                feature,
                actionWeights: new Map(),
                explorationRate: this.DEFAULT_EXPLORATION,
                learningRate: this.DEFAULT_LEARNING_RATE
            });
        }
    }

    private updatePolicy(feature: string, experience: Experience): void {
        const policy = this.policies.get(feature);
        if (!policy) return;

        // Q-learning style update
        const currentWeight = policy.actionWeights.get(experience.action) || 0;
        const newWeight = currentWeight + policy.learningRate * (experience.reward - currentWeight);
        policy.actionWeights.set(experience.action, newWeight);

        // Decay exploration rate over time
        policy.explorationRate = Math.max(0.01, policy.explorationRate * 0.999);
    }

    private updateBaseline(feature: string): void {
        const experiences = this.experiences.get(feature) || [];
        if (experiences.length < 20) return;

        const rewards = experiences.map(e => e.reward);
        const avgReward = rewards.reduce((a, b) => a + b, 0) / rewards.length;
        const variance = rewards.reduce((sum, r) => sum + (r - avgReward) ** 2, 0) / rewards.length;
        const stdDev = Math.sqrt(variance);

        this.baselines.set(feature, {
            feature,
            avgReward,
            stdDev,
            sampleCount: experiences.length,
            lastUpdated: new Date()
        });
    }

    private generateId(): string {
        return `exp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    private loadFromStorage(): void {
        try {
            const data = localStorage.getItem('ai_architect_rl');
            if (data) {
                const parsed = JSON.parse(data);
                // Restore experiences
                Object.entries(parsed.experiences || {}).forEach(([feature, exps]: [string, any]) => {
                    this.experiences.set(feature, exps.map((e: any) => ({
                        ...e,
                        timestamp: new Date(e.timestamp)
                    })));
                });
                // Restore policies
                Object.entries(parsed.policies || {}).forEach(([feature, policy]: [string, any]) => {
                    this.policies.set(feature, {
                        ...policy,
                        actionWeights: new Map(Object.entries(policy.actionWeights || {}))
                    });
                });
            }
        } catch (e) {
            console.warn('[RL] Failed to load from storage');
        }
    }

    private saveToStorage(): void {
        try {
            const data = {
                experiences: Object.fromEntries(this.experiences),
                policies: Object.fromEntries(
                    Array.from(this.policies.entries()).map(([k, v]) => [
                        k,
                        { ...v, actionWeights: Object.fromEntries(v.actionWeights) }
                    ])
                )
            };
            localStorage.setItem('ai_architect_rl', JSON.stringify(data));
        } catch (e) {
            console.warn('[RL] Failed to save to storage');
        }
    }
}

// ============================================
// SINGLETON
// ============================================

export const reinforcementLearning = new ReinforcementLearningServiceClass();
export default ReinforcementLearningServiceClass;
