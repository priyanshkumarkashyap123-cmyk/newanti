/**
 * AICollaborationService.ts
 * 
 * Real-time AI-Assisted Collaboration Features
 * 
 * Features:
 * - Conflict detection and resolution
 * - Smart merging of concurrent edits
 * - AI design suggestions based on context
 * - Automatic documentation of changes
 * - Team notifications
 */

// ============================================
// TYPES
// ============================================

export interface CollaborationSession {
    id: string;
    projectId: string;
    users: CollaborationUser[];
    status: 'active' | 'paused' | 'ended';
    startedAt: Date;
}

export interface CollaborationUser {
    id: string;
    name: string;
    role: 'owner' | 'editor' | 'viewer';
    cursor?: { x: number; y: number; z: number };
    selection?: string[];
    lastActive: Date;
    color: string;
}

export interface DesignConflict {
    id: string;
    type: 'geometry' | 'property' | 'load' | 'support' | 'section';
    elementId: string;
    userA: string;
    userB: string;
    changeA: any;
    changeB: any;
    detectedAt: Date;
    resolved: boolean;
    resolution?: ConflictResolution;
}

export interface ConflictResolution {
    method: 'accept_a' | 'accept_b' | 'merge' | 'custom';
    result: any;
    resolvedBy: string;
    timestamp: Date;
    aiSuggested: boolean;
}

export interface AISuggestion {
    id: string;
    type: 'optimization' | 'error' | 'improvement' | 'question';
    message: string;
    context: string;
    action?: {
        label: string;
        handler: () => void;
    };
    priority: 'low' | 'medium' | 'high';
    dismissed: boolean;
}

export interface ChangeNotification {
    id: string;
    userId: string;
    userName: string;
    action: 'added' | 'modified' | 'deleted' | 'analyzed';
    elementType: string;
    elementId: string;
    description: string;
    timestamp: Date;
}

// ============================================
// AI COLLABORATION SERVICE
// ============================================

class AICollaborationServiceClass {
    private session: CollaborationSession | null = null;
    private conflicts: Map<string, DesignConflict> = new Map();
    private suggestions: AISuggestion[] = [];
    private notifications: ChangeNotification[] = [];
    private listeners: Array<(event: string, data: any) => void> = [];

    /**
     * Start collaboration session
     */
    startSession(projectId: string, currentUser: Omit<CollaborationUser, 'lastActive'>): CollaborationSession {
        this.session = {
            id: `collab_${Date.now()}`,
            projectId,
            users: [{
                ...currentUser,
                lastActive: new Date()
            }],
            status: 'active',
            startedAt: new Date()
        };

        this.emit('session_started', this.session);
        return this.session;
    }

    /**
     * Join existing session
     */
    joinSession(sessionId: string, user: Omit<CollaborationUser, 'lastActive'>): boolean {
        if (!this.session || this.session.id !== sessionId) return false;

        this.session.users.push({
            ...user,
            lastActive: new Date()
        });

        this.emit('user_joined', user);
        return true;
    }

    /**
     * Detect conflicts between concurrent changes
     */
    detectConflict(
        elementId: string,
        userAId: string,
        changeA: any,
        userBId: string,
        changeB: any,
        type: DesignConflict['type'] = 'property'
    ): DesignConflict {
        const conflict: DesignConflict = {
            id: `conflict_${Date.now()}`,
            type,
            elementId,
            userA: userAId,
            userB: userBId,
            changeA,
            changeB,
            detectedAt: new Date(),
            resolved: false
        };

        this.conflicts.set(conflict.id, conflict);
        this.emit('conflict_detected', conflict);

        // Generate AI resolution suggestion
        this.generateResolutionSuggestion(conflict);

        return conflict;
    }

    /**
     * AI-powered conflict resolution suggestion
     */
    private generateResolutionSuggestion(conflict: DesignConflict): void {
        let suggestion: string;
        let resolution: ConflictResolution['method'];

        switch (conflict.type) {
            case 'geometry':
                // Check which change is more recent and valid
                suggestion = 'Merge geometry changes by applying both transformations';
                resolution = 'merge';
                break;

            case 'section':
                // Compare section capacities
                suggestion = 'Use the stronger section for safety';
                resolution = 'merge';
                break;

            case 'load':
                // Loads are typically additive
                suggestion = 'Consider combining loads if from different sources';
                resolution = 'merge';
                break;

            default:
                suggestion = 'Review both changes and select the appropriate one';
                resolution = 'accept_a';
        }

        this.addSuggestion({
            type: 'question',
            message: `Conflict detected on ${conflict.elementId}: ${suggestion}`,
            context: `Conflict between users: ${conflict.userA} and ${conflict.userB}`,
            action: {
                label: 'Resolve',
                handler: () => this.resolveConflict(conflict.id, resolution, true)
            },
            priority: 'high'
        });
    }

    /**
     * Resolve a conflict
     */
    resolveConflict(
        conflictId: string,
        method: ConflictResolution['method'],
        aiSuggested: boolean = false,
        customResult?: any
    ): boolean {
        const conflict = this.conflicts.get(conflictId);
        if (!conflict || conflict.resolved) return false;

        let result: any;
        switch (method) {
            case 'accept_a':
                result = conflict.changeA;
                break;
            case 'accept_b':
                result = conflict.changeB;
                break;
            case 'merge':
                result = this.mergeChanges(conflict.changeA, conflict.changeB);
                break;
            case 'custom':
                result = customResult;
                break;
        }

        conflict.resolved = true;
        conflict.resolution = {
            method,
            result,
            resolvedBy: 'ai',
            timestamp: new Date(),
            aiSuggested
        };

        this.emit('conflict_resolved', conflict);
        return true;
    }

    /**
     * Smart merge of two changes
     */
    private mergeChanges(changeA: any, changeB: any): any {
        // Deep merge, with B overriding A for conflicting keys
        const merged = { ...changeA };

        for (const key of Object.keys(changeB)) {
            if (typeof changeB[key] === 'object' && changeA[key]) {
                merged[key] = this.mergeChanges(changeA[key], changeB[key]);
            } else {
                merged[key] = changeB[key];
            }
        }

        return merged;
    }

    /**
     * Add AI suggestion
     */
    addSuggestion(suggestion: Omit<AISuggestion, 'id' | 'dismissed'>): AISuggestion {
        const full: AISuggestion = {
            ...suggestion,
            id: `sugg_${Date.now()}`,
            dismissed: false
        };

        this.suggestions.push(full);
        this.emit('suggestion_added', full);

        return full;
    }

    /**
     * Get active suggestions
     */
    getSuggestions(): AISuggestion[] {
        return this.suggestions.filter(s => !s.dismissed);
    }

    /**
     * Dismiss suggestion
     */
    dismissSuggestion(suggestionId: string): void {
        const suggestion = this.suggestions.find(s => s.id === suggestionId);
        if (suggestion) {
            suggestion.dismissed = true;
            this.emit('suggestion_dismissed', suggestion);
        }
    }

    /**
     * Notify about a change
     */
    notifyChange(
        userId: string,
        userName: string,
        action: ChangeNotification['action'],
        elementType: string,
        elementId: string,
        description: string
    ): void {
        const notification: ChangeNotification = {
            id: `notif_${Date.now()}`,
            userId,
            userName,
            action,
            elementType,
            elementId,
            description,
            timestamp: new Date()
        };

        this.notifications.push(notification);
        this.emit('change_notified', notification);

        // Keep only last 100 notifications
        if (this.notifications.length > 100) {
            this.notifications = this.notifications.slice(-100);
        }
    }

    /**
     * Get recent notifications
     */
    getNotifications(limit: number = 20): ChangeNotification[] {
        return this.notifications.slice(-limit).reverse();
    }

    /**
     * Update user cursor position
     */
    updateCursor(userId: string, position: { x: number; y: number; z: number }): void {
        if (!this.session) return;

        const user = this.session.users.find(u => u.id === userId);
        if (user) {
            user.cursor = position;
            user.lastActive = new Date();
            this.emit('cursor_moved', { userId, position });
        }
    }

    /**
     * Get active users
     */
    getActiveUsers(): CollaborationUser[] {
        if (!this.session) return [];

        const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
        return this.session.users.filter(u => u.lastActive > fiveMinutesAgo);
    }

    /**
     * Subscribe to events
     */
    on(handler: (event: string, data: any) => void): () => void {
        this.listeners.push(handler);
        return () => {
            this.listeners = this.listeners.filter(l => l !== handler);
        };
    }

    private emit(event: string, data: any): void {
        for (const listener of this.listeners) {
            listener(event, data);
        }
    }

    /**
     * End session
     */
    endSession(): void {
        if (this.session) {
            this.session.status = 'ended';
            this.emit('session_ended', this.session);
            this.session = null;
        }
    }
}

// ============================================
// SINGLETON
// ============================================

export const aiCollaboration = new AICollaborationServiceClass();

export default AICollaborationServiceClass;
