/**
 * SequentialLearningService.ts
 * 
 * AI Sequential Learning System
 * 
 * Features:
 * - User interaction tracking
 * - Personalized learning from each user
 * - Skill progression modeling
 * - Adaptive recommendations
 * - Knowledge retention
 * - Cross-user pattern learning
 */

// ============================================
// TYPES
// ============================================

export interface UserProfile {
    userId: string;
    expertise: ExpertiseLevel;
    preferredDomain: CivilDomain[];
    learningStyle: 'detailed' | 'concise' | 'visual';
    interactionHistory: UserInteraction[];
    skillLevels: Map<string, number>;  // Skill -> level (0-100)
    corrections: UserCorrection[];
    lastActive: Date;
    createdAt: Date;
}

export type ExpertiseLevel = 'student' | 'graduate' | 'professional' | 'expert';

export type CivilDomain =
    | 'structural'
    | 'geotechnical'
    | 'transportation'
    | 'hydraulics'
    | 'environmental'
    | 'construction';

export interface UserInteraction {
    id: string;
    timestamp: Date;
    type: 'query' | 'calculation' | 'design' | 'analysis' | 'correction';
    domain: CivilDomain;
    topic: string;
    input: unknown;
    output?: unknown;
    feedback?: number;        // 1-5 rating
    duration: number;         // seconds
    successful: boolean;
}

export interface UserCorrection {
    id: string;
    timestamp: Date;
    domain: CivilDomain;
    originalOutput: unknown;
    correctedOutput: unknown;
    context: string;
    reason?: string;
    applied: boolean;
}

export interface LearningPattern {
    pattern: string;
    frequency: number;
    domains: CivilDomain[];
    avgSuccessRate: number;
    examples: string[];
}

export interface AdaptiveRecommendation {
    type: 'topic' | 'resource' | 'practice' | 'review';
    title: string;
    description: string;
    domain: CivilDomain;
    difficulty: number;       // 1-5
    reason: string;
    confidence: number;
}

export interface SkillProgression {
    skill: string;
    currentLevel: number;
    previousLevel: number;
    change: number;
    trend: 'improving' | 'stable' | 'declining';
    nextMilestone: number;
    estimatedTimeToMilestone: number; // days
}

// ============================================
// SEQUENTIAL LEARNING SERVICE
// ============================================

class SequentialLearningServiceClass {
    private users: Map<string, UserProfile> = new Map();
    private globalPatterns: LearningPattern[] = [];
    private domainKnowledge: Map<CivilDomain, string[]> = new Map();

    constructor() {
        this.initializeDomainKnowledge();
    }

    /**
     * Initialize domain knowledge base
     */
    private initializeDomainKnowledge(): void {
        this.domainKnowledge.set('structural', [
            'beam_design', 'column_design', 'slab_design', 'foundation_design',
            'connection_design', 'load_combinations', 'seismic_analysis',
            'wind_analysis', 'steel_design', 'concrete_design'
        ]);

        this.domainKnowledge.set('geotechnical', [
            'soil_classification', 'bearing_capacity', 'settlement_analysis',
            'slope_stability', 'earth_pressure', 'pile_design', 'liquefaction',
            'soil_investigation', 'ground_improvement'
        ]);

        this.domainKnowledge.set('transportation', [
            'geometric_design', 'pavement_design', 'traffic_analysis',
            'intersection_design', 'sight_distance', 'horizontal_curves',
            'vertical_curves', 'superelevation', 'level_of_service'
        ]);

        this.domainKnowledge.set('hydraulics', [
            'open_channel_flow', 'pipe_flow', 'culvert_design',
            'storm_drainage', 'flood_routing', 'pump_systems',
            'manning_equation', 'hydraulic_jump', 'water_distribution'
        ]);

        this.domainKnowledge.set('environmental', [
            'water_treatment', 'wastewater_treatment', 'air_quality',
            'solid_waste', 'noise_pollution', 'eia', 'sludge_management',
            'leachate_treatment', 'water_quality'
        ]);

        this.domainKnowledge.set('construction', [
            'scheduling', 'cpm_pert', 'cost_estimation', 'earned_value',
            'risk_management', 'resource_leveling', 'quality_control',
            'safety_management', 'contract_management'
        ]);
    }

    /**
     * Get or create user profile
     */
    getOrCreateUser(userId: string): UserProfile {
        if (!this.users.has(userId)) {
            const profile: UserProfile = {
                userId,
                expertise: 'student',
                preferredDomain: [],
                learningStyle: 'detailed',
                interactionHistory: [],
                skillLevels: new Map(),
                corrections: [],
                lastActive: new Date(),
                createdAt: new Date()
            };
            this.users.set(userId, profile);
        }
        return this.users.get(userId)!;
    }

    /**
     * Record user interaction
     */
    recordInteraction(
        userId: string,
        interaction: Omit<UserInteraction, 'id' | 'timestamp'>
    ): void {
        const user = this.getOrCreateUser(userId);

        const fullInteraction: UserInteraction = {
            ...interaction,
            id: `int_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            timestamp: new Date()
        };

        user.interactionHistory.push(fullInteraction);
        user.lastActive = new Date();

        // Update skill level
        this.updateSkillLevel(user, interaction.topic, interaction.successful);

        // Learn from this interaction
        this.learnFromInteraction(user, fullInteraction);

        // Update global patterns
        this.updateGlobalPatterns(fullInteraction);

        // Trim history if too long
        if (user.interactionHistory.length > 1000) {
            user.interactionHistory = user.interactionHistory.slice(-500);
        }
    }

    /**
     * Record user correction
     */
    recordCorrection(
        userId: string,
        correction: Omit<UserCorrection, 'id' | 'timestamp' | 'applied'>
    ): void {
        const user = this.getOrCreateUser(userId);

        user.corrections.push({
            ...correction,
            id: `cor_${Date.now()}`,
            timestamp: new Date(),
            applied: false
        });

        // This is valuable learning signal - boost weight
        this.learnFromCorrection(user, correction);
    }

    /**
     * Update skill level based on interaction
     */
    private updateSkillLevel(
        user: UserProfile,
        topic: string,
        successful: boolean
    ): void {
        const currentLevel = user.skillLevels.get(topic) || 0;

        // Exponential moving average with learning rate
        const learningRate = 0.1;
        const successScore = successful ? 1 : 0;
        const newLevel = currentLevel + learningRate * (successScore * 100 - currentLevel);

        user.skillLevels.set(topic, Math.min(100, Math.max(0, newLevel)));
    }

    /**
     * Learn from user interaction
     */
    private learnFromInteraction(user: UserProfile, interaction: UserInteraction): void {
        // Update preferred domains
        if (!user.preferredDomain.includes(interaction.domain)) {
            const domainCounts = new Map<CivilDomain, number>();
            for (const int of user.interactionHistory) {
                domainCounts.set(int.domain, (domainCounts.get(int.domain) || 0) + 1);
            }

            // Top 3 domains
            const sorted = Array.from(domainCounts.entries())
                .sort((a, b) => b[1] - a[1])
                .slice(0, 3);

            user.preferredDomain = sorted.map(([domain]) => domain);
        }

        // Infer expertise level from success rate and complexity
        const recentInteractions = user.interactionHistory.slice(-50);
        const successRate = recentInteractions.filter(i => i.successful).length / recentInteractions.length;
        const avgDuration = recentInteractions.reduce((sum, i) => sum + i.duration, 0) / recentInteractions.length;

        if (successRate > 0.9 && avgDuration < 60) {
            user.expertise = 'expert';
        } else if (successRate > 0.8) {
            user.expertise = 'professional';
        } else if (successRate > 0.6) {
            user.expertise = 'graduate';
        }

        // Infer learning style from feedback patterns
        const feedbacks = recentInteractions.filter(i => i.feedback);
        const detailedPreferred = feedbacks.filter(i =>
            i.duration > 120 && i.feedback && i.feedback >= 4
        ).length;
        const concisePreferred = feedbacks.filter(i =>
            i.duration < 60 && i.feedback && i.feedback >= 4
        ).length;

        if (detailedPreferred > concisePreferred) {
            user.learningStyle = 'detailed';
        } else if (concisePreferred > detailedPreferred) {
            user.learningStyle = 'concise';
        }
    }

    /**
     * Learn from user correction
     */
    private learnFromCorrection(
        user: UserProfile,
        correction: Omit<UserCorrection, 'id' | 'timestamp' | 'applied'>
    ): void {
        // Find similar past interactions and mark them
        const similarInteractions = user.interactionHistory.filter(i =>
            i.domain === correction.domain &&
            JSON.stringify(i.output) === JSON.stringify(correction.originalOutput)
        );

        // Add to global learning if pattern is consistent
        if (similarInteractions.length > 1) {
            this.globalPatterns.push({
                pattern: `${correction.domain}:correction`,
                frequency: similarInteractions.length,
                domains: [correction.domain],
                avgSuccessRate: 0,
                examples: [correction.context]
            });
        }
    }

    /**
     * Update global patterns from all users
     */
    private updateGlobalPatterns(interaction: UserInteraction): void {
        // Find or create pattern
        const patternKey = `${interaction.domain}:${interaction.topic}`;
        let pattern = this.globalPatterns.find(p => p.pattern === patternKey);

        if (!pattern) {
            pattern = {
                pattern: patternKey,
                frequency: 0,
                domains: [interaction.domain],
                avgSuccessRate: 0,
                examples: []
            };
            this.globalPatterns.push(pattern);
        }

        pattern.frequency++;
        pattern.avgSuccessRate = (pattern.avgSuccessRate * (pattern.frequency - 1) +
            (interaction.successful ? 1 : 0)) / pattern.frequency;
    }

    /**
     * Get adaptive recommendations for user
     */
    getRecommendations(userId: string, count: number = 5): AdaptiveRecommendation[] {
        const user = this.getOrCreateUser(userId);
        const recommendations: AdaptiveRecommendation[] = [];

        // 1. Review struggling topics
        const strugglingTopics = Array.from(user.skillLevels.entries())
            .filter(([_, level]) => level < 50)
            .sort((a, b) => a[1] - b[1]);

        for (const [topic, level] of strugglingTopics.slice(0, 2)) {
            const domain = this.findDomainForTopic(topic);
            if (domain) {
                recommendations.push({
                    type: 'review',
                    title: `Review: ${this.formatTopic(topic)}`,
                    description: `Your skill level in ${this.formatTopic(topic)} is ${level.toFixed(0)}%. Review recommended.`,
                    domain,
                    difficulty: 3,
                    reason: 'Based on recent performance',
                    confidence: 0.9
                });
            }
        }

        // 2. Advance in strong areas
        const strongTopics = Array.from(user.skillLevels.entries())
            .filter(([_, level]) => level > 70)
            .sort((a, b) => b[1] - a[1]);

        for (const [topic, level] of strongTopics.slice(0, 2)) {
            const domain = this.findDomainForTopic(topic);
            if (domain) {
                const nextTopic = this.getAdvancedTopic(domain, topic);
                if (nextTopic) {
                    recommendations.push({
                        type: 'topic',
                        title: `Advanced: ${this.formatTopic(nextTopic)}`,
                        description: `You've mastered ${this.formatTopic(topic)}. Ready for ${this.formatTopic(nextTopic)}.`,
                        domain,
                        difficulty: 4,
                        reason: 'Natural progression',
                        confidence: 0.85
                    });
                }
            }
        }

        // 3. Fill knowledge gaps
        for (const domain of user.preferredDomain) {
            const domainTopics = this.domainKnowledge.get(domain) || [];
            const unexplored = domainTopics.filter(t => !user.skillLevels.has(t));

            if (unexplored.length > 0) {
                recommendations.push({
                    type: 'topic',
                    title: `Explore: ${this.formatTopic(unexplored[0])}`,
                    description: `Complete your ${domain} knowledge with ${this.formatTopic(unexplored[0])}.`,
                    domain,
                    difficulty: 3,
                    reason: 'Knowledge gap in preferred domain',
                    confidence: 0.75
                });
            }
        }

        // 4. Cross-domain recommendations based on global patterns
        const popularPatterns = this.globalPatterns
            .filter(p => p.avgSuccessRate > 0.8 && p.frequency > 10)
            .filter(p => !user.preferredDomain.includes(p.domains[0]))
            .slice(0, 2);

        for (const pattern of popularPatterns) {
            const [domain, topic] = pattern.pattern.split(':');
            recommendations.push({
                type: 'topic',
                title: `Popular: ${this.formatTopic(topic)}`,
                description: `${Math.round(pattern.avgSuccessRate * 100)}% success rate among professionals.`,
                domain: domain as CivilDomain,
                difficulty: 3,
                reason: 'High success rate globally',
                confidence: 0.7
            });
        }

        return recommendations.slice(0, count);
    }

    /**
     * Get skill progression for user
     */
    getSkillProgression(userId: string): SkillProgression[] {
        const user = this.getOrCreateUser(userId);
        const progressions: SkillProgression[] = [];

        for (const [skill, currentLevel] of user.skillLevels) {
            // Calculate trend from recent interactions
            const recentForSkill = user.interactionHistory
                .filter(i => i.topic === skill)
                .slice(-20);

            const firstHalf = recentForSkill.slice(0, 10);
            const secondHalf = recentForSkill.slice(-10);

            const firstRate = firstHalf.filter(i => i.successful).length / (firstHalf.length || 1);
            const secondRate = secondHalf.filter(i => i.successful).length / (secondHalf.length || 1);

            let trend: 'improving' | 'stable' | 'declining';
            if (secondRate - firstRate > 0.1) trend = 'improving';
            else if (firstRate - secondRate > 0.1) trend = 'declining';
            else trend = 'stable';

            // Next milestone (25, 50, 75, 100)
            const milestones = [25, 50, 75, 100];
            const nextMilestone = milestones.find(m => m > currentLevel) || 100;

            // Estimate time to milestone
            const progressRate = (secondRate - firstRate) * 10; // Level gain per 10 interactions
            const levelsToGo = nextMilestone - currentLevel;
            const estimatedDays = progressRate > 0
                ? levelsToGo / progressRate / 2
                : Infinity;

            progressions.push({
                skill,
                currentLevel,
                previousLevel: currentLevel - (secondRate - firstRate) * 10,
                change: (secondRate - firstRate) * 10,
                trend,
                nextMilestone,
                estimatedTimeToMilestone: Math.round(estimatedDays)
            });
        }

        return progressions.sort((a, b) => b.change - a.change);
    }

    /**
     * Get personalized response based on user
     */
    personalizeResponse(userId: string, baseResponse: unknown): unknown {
        const user = this.getOrCreateUser(userId);

        // Adjust verbosity based on learning style
        if (user.learningStyle === 'concise') {
            return this.condenseResponse(baseResponse);
        } else if (user.learningStyle === 'detailed') {
            return this.expandResponse(baseResponse, user.expertise);
        }

        return baseResponse;
    }

    private condenseResponse(response: unknown): unknown {
        // Return key points only
        if (typeof response === 'object' && response !== null && 'explanation' in response) {
            const resp = response as Record<string, unknown>;
            const explanation = resp.explanation;
            if (typeof explanation === 'string') {
                return {
                    ...resp,
                    explanation: explanation.split('. ').slice(0, 2).join('. ') + '.'
                };
            }
        }
        return response;
    }

    private expandResponse(response: unknown, expertise: ExpertiseLevel): unknown {
        // Add more context based on expertise
        if (typeof response === 'object' && response !== null) {
            const additions: Record<string, string> = {};

            if (expertise === 'student') {
                additions.tips = 'Remember to check units and verify assumptions.';
            } else if (expertise === 'professional') {
                additions.codeReference = 'Refer to relevant design code for verification.';
            }

            return { ...(response as Record<string, unknown>), ...additions };
        }
        return response;
    }

    /**
     * Find domain for topic
     */
    private findDomainForTopic(topic: string): CivilDomain | null {
        for (const [domain, topics] of this.domainKnowledge) {
            if (topics.includes(topic)) {
                return domain;
            }
        }
        return null;
    }

    /**
     * Get advanced topic in progression
     */
    private getAdvancedTopic(domain: CivilDomain, currentTopic: string): string | null {
        const topics = this.domainKnowledge.get(domain) || [];
        const currentIndex = topics.indexOf(currentTopic);
        if (currentIndex >= 0 && currentIndex < topics.length - 1) {
            return topics[currentIndex + 1];
        }
        return null;
    }

    /**
     * Format topic for display
     */
    private formatTopic(topic: string): string {
        return topic.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
    }

    /**
     * Export user data
     */
    exportUserData(userId: string): UserProfile | null {
        return this.users.get(userId) || null;
    }

    /**
     * Import user data
     */
    importUserData(profile: UserProfile): void {
        this.users.set(profile.userId, profile);
    }

    /**
     * Get statistics
     */
    getStats(): {
        totalUsers: number;
        totalInteractions: number;
        topDomains: { domain: CivilDomain; count: number }[];
        avgSkillLevel: number;
    } {
        let totalInteractions = 0;
        let totalSkill = 0;
        let skillCount = 0;
        const domainCounts = new Map<CivilDomain, number>();

        for (const user of this.users.values()) {
            totalInteractions += user.interactionHistory.length;

            for (const int of user.interactionHistory) {
                domainCounts.set(int.domain, (domainCounts.get(int.domain) || 0) + 1);
            }

            for (const level of user.skillLevels.values()) {
                totalSkill += level;
                skillCount++;
            }
        }

        const topDomains = Array.from(domainCounts.entries())
            .map(([domain, count]) => ({ domain, count }))
            .sort((a, b) => b.count - a.count);

        return {
            totalUsers: this.users.size,
            totalInteractions,
            topDomains,
            avgSkillLevel: skillCount > 0 ? totalSkill / skillCount : 0
        };
    }
}

// ============================================
// SINGLETON
// ============================================

export const sequentialLearning = new SequentialLearningServiceClass();

export default SequentialLearningServiceClass;
