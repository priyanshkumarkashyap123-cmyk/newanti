/**
 * AdaptiveLearningService.ts - User Preference Learning
 * 
 * Learns from user behavior to personalize AI responses:
 * - Tracks design preferences (section sizes, materials)
 * - Monitors commonly used templates
 * - Adapts suggestions based on past choices
 * - Remembers corrections and applies them
 */

// ============================================
// TYPES
// ============================================

export interface UserPreference {
    category: 'section' | 'material' | 'template' | 'code' | 'workflow';
    key: string;
    value: any;
    frequency: number;
    lastUsed: Date;
    confidence: number; // 0-1
}

export interface LearningEvent {
    id: string;
    type: 'selection' | 'correction' | 'override' | 'approval' | 'rejection';
    context: string;
    aiSuggestion?: any;
    userChoice: any;
    timestamp: Date;
}

export interface UserProfile {
    userId: string;
    preferences: Map<string, UserPreference>;
    learningEvents: LearningEvent[];
    designStyle: 'conservative' | 'optimized' | 'balanced';
    preferredCodes: string[];
    commonSections: string[];
}

// ============================================
// ADAPTIVE LEARNING SERVICE
// ============================================

class AdaptiveLearningServiceClass {
    private profiles: Map<string, UserProfile> = new Map();
    private currentUserId: string = 'default';
    private readonly DECAY_RATE = 0.95; // Preference decay over time

    constructor() {
        this.loadFromStorage();
    }

    /**
     * Set current user context
     */
    setUser(userId: string): void {
        this.currentUserId = userId;
        if (!this.profiles.has(userId)) {
            this.profiles.set(userId, this.createNewProfile(userId));
        }
    }

    /**
     * Record a learning event (user made a choice)
     */
    recordEvent(event: Omit<LearningEvent, 'id' | 'timestamp'>): void {
        const profile = this.getCurrentProfile();
        const fullEvent: LearningEvent = {
            ...event,
            id: this.generateId(),
            timestamp: new Date()
        };

        profile.learningEvents.push(fullEvent);

        // Update preferences based on event
        this.updatePreferencesFromEvent(fullEvent);

        // Trim old events (keep last 1000)
        if (profile.learningEvents.length > 1000) {
            profile.learningEvents = profile.learningEvents.slice(-1000);
        }

        this.saveToStorage();
    }

    /**
     * Record section preference
     */
    recordSectionChoice(sectionId: string, context: string = 'general'): void {
        this.updatePreference('section', sectionId, context);
        this.recordEvent({
            type: 'selection',
            context: `section_${context}`,
            userChoice: sectionId
        });
    }

    /**
     * Record material preference
     */
    recordMaterialChoice(material: string, context: string = 'general'): void {
        this.updatePreference('material', material, context);
        this.recordEvent({
            type: 'selection',
            context: `material_${context}`,
            userChoice: material
        });
    }

    /**
     * Record AI correction (user changed AI suggestion)
     */
    recordCorrection(aiSuggestion: any, userCorrection: any, context: string): void {
        this.recordEvent({
            type: 'correction',
            context,
            aiSuggestion,
            userChoice: userCorrection
        });

        // Learn from the correction
        const profile = this.getCurrentProfile();
        // Decrease frequency of AI suggestion
        // Increase frequency of user correction
        console.log(`[AdaptiveLearning] Recorded correction: ${context}`);
    }

    /**
     * Get personalized suggestions for sections
     */
    getSuggestedSections(context: string = 'beam', limit: number = 5): string[] {
        const profile = this.getCurrentProfile();
        const sectionPrefs: UserPreference[] = [];

        profile.preferences.forEach((pref, key) => {
            if (pref.category === 'section') {
                sectionPrefs.push(pref);
            }
        });

        // Sort by score (frequency * confidence * recency decay)
        sectionPrefs.sort((a, b) => {
            const scoreA = this.calculateScore(a);
            const scoreB = this.calculateScore(b);
            return scoreB - scoreA;
        });

        return sectionPrefs.slice(0, limit).map(p => p.key);
    }

    /**
     * Get user's preferred design style
     */
    getDesignStyle(): 'conservative' | 'optimized' | 'balanced' {
        return this.getCurrentProfile().designStyle;
    }

    /**
     * Predict user's likely choice given options
     */
    predictChoice<T>(options: T[], context: string, keyExtractor: (item: T) => string): T | null {
        if (options.length === 0) return null;

        const profile = this.getCurrentProfile();
        let bestOption = options[0];
        let bestScore = 0;

        for (const option of options) {
            const key = keyExtractor(option);
            const pref = profile.preferences.get(`${context}_${key}`);
            if (pref) {
                const score = this.calculateScore(pref);
                if (score > bestScore) {
                    bestScore = score;
                    bestOption = option;
                }
            }
        }

        return bestOption;
    }

    /**
     * Get learning insights
     */
    getInsights(): {
        totalEvents: number;
        correctionRate: number;
        topPreferences: UserPreference[];
        designStyle: string;
    } {
        const profile = this.getCurrentProfile();
        const corrections = profile.learningEvents.filter(e => e.type === 'correction');
        const correctionRate = profile.learningEvents.length > 0
            ? corrections.length / profile.learningEvents.length
            : 0;

        // Get top preferences
        const allPrefs = Array.from(profile.preferences.values());
        allPrefs.sort((a, b) => this.calculateScore(b) - this.calculateScore(a));

        return {
            totalEvents: profile.learningEvents.length,
            correctionRate,
            topPreferences: allPrefs.slice(0, 10),
            designStyle: profile.designStyle
        };
    }

    /**
     * Reset learning for current user
     */
    resetLearning(): void {
        this.profiles.set(this.currentUserId, this.createNewProfile(this.currentUserId));
        this.saveToStorage();
    }

    // ============================================
    // PRIVATE METHODS
    // ============================================

    private getCurrentProfile(): UserProfile {
        let profile = this.profiles.get(this.currentUserId);
        if (!profile) {
            profile = this.createNewProfile(this.currentUserId);
            this.profiles.set(this.currentUserId, profile);
        }
        return profile;
    }

    private createNewProfile(userId: string): UserProfile {
        return {
            userId,
            preferences: new Map(),
            learningEvents: [],
            designStyle: 'balanced',
            preferredCodes: ['IS_800', 'IS_456'],
            commonSections: []
        };
    }

    private updatePreference(category: UserPreference['category'], key: string, context: string): void {
        const profile = this.getCurrentProfile();
        const prefKey = `${category}_${key}`;
        const existing = profile.preferences.get(prefKey);

        if (existing) {
            existing.frequency++;
            existing.lastUsed = new Date();
            existing.confidence = Math.min(1, existing.confidence + 0.05);
        } else {
            profile.preferences.set(prefKey, {
                category,
                key,
                value: key,
                frequency: 1,
                lastUsed: new Date(),
                confidence: 0.5
            });
        }
    }

    private updatePreferencesFromEvent(event: LearningEvent): void {
        // Extract preference updates from the event
        if (event.type === 'selection') {
            // Selection increases preference
        } else if (event.type === 'correction') {
            // Correction decreases AI suggestion preference, increases user choice
            const profile = this.getCurrentProfile();

            // Decrease AI suggestion
            if (event.aiSuggestion) {
                profile.preferences.forEach((pref, key) => {
                    if (pref.value === event.aiSuggestion) {
                        pref.confidence *= 0.8; // Reduce confidence
                    }
                });
            }
        }
    }

    private calculateScore(pref: UserPreference): number {
        const daysSinceUse = (Date.now() - pref.lastUsed.getTime()) / (1000 * 60 * 60 * 24);
        const recencyScore = Math.pow(this.DECAY_RATE, daysSinceUse);
        return pref.frequency * pref.confidence * recencyScore;
    }

    private generateId(): string {
        return `evt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    private loadFromStorage(): void {
        try {
            const data = localStorage.getItem('ai_architect_adaptive_learning');
            if (data) {
                const parsed = JSON.parse(data);
                parsed.profiles?.forEach((p: any) => {
                    p.preferences = new Map(Object.entries(p.preferences || {}));
                    p.learningEvents = p.learningEvents?.map((e: any) => ({
                        ...e,
                        timestamp: new Date(e.timestamp)
                    })) || [];
                    this.profiles.set(p.userId, p);
                });
            }
        } catch (e) {
            console.warn('[AdaptiveLearning] Failed to load from storage');
        }
    }

    private saveToStorage(): void {
        try {
            const data = {
                profiles: Array.from(this.profiles.values()).map(p => ({
                    ...p,
                    preferences: Object.fromEntries(p.preferences)
                }))
            };
            localStorage.setItem('ai_architect_adaptive_learning', JSON.stringify(data));
        } catch (e) {
            console.warn('[AdaptiveLearning] Failed to save to storage');
        }
    }
}

// ============================================
// SINGLETON
// ============================================

export const adaptiveLearning = new AdaptiveLearningServiceClass();
export default AdaptiveLearningServiceClass;
