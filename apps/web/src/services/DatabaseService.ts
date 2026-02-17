/**
 * DatabaseService.ts - Persistent Storage for Audit & Feedback
 * 
 * Provides database persistence via Python backend:
 * - Audit trail storage
 * - Feedback persistence
 * - User preferences
 * - Learning data export
 */

import { API_CONFIG } from '../config/env';

const API_BASE = API_CONFIG.pythonUrl;

// ============================================
// TYPES
// ============================================

export interface AuditRecord {
    id?: string;
    projectId: string;
    category: string;
    action: string;
    description: string;
    aiGenerated: boolean;
    metadata: Record<string, any>;
    timestamp: string;
}

export interface FeedbackRecord {
    id?: string;
    feature: string;
    rating: number;
    correction?: string;
    context: Record<string, any>;
    timestamp: string;
}

export interface LearningData {
    id?: string;
    feature: string;
    input: any;
    output: any;
    reward: number;
    timestamp: string;
}

// ============================================
// DATABASE SERVICE
// ============================================

class DatabaseServiceClass {
    async initialize(): Promise<void> {
        // Placeholder for future DB bootstrapping; keeps interface stable for ServiceRegistry
        return Promise.resolve();
    }

    /**
     * Save audit record to database
     */
    async saveAudit(record: AuditRecord): Promise<string | null> {
        try {
            const response = await fetch(`${API_BASE}/db/audit`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(record)
            });
            if (response.ok) {
                const result = await response.json();
                return result.id;
            }
            return null;
        } catch (e) {
            console.error('[DB] Failed to save audit:', e);
            // Fallback to localStorage
            this.saveToLocalStorage('audit', record);
            return null;
        }
    }

    /**
     * Get audit records for project
     */
    async getAuditTrail(projectId: string, limit: number = 100): Promise<AuditRecord[]> {
        try {
            const response = await fetch(`${API_BASE}/db/audit/${projectId}?limit=${limit}`);
            if (response.ok) {
                return await response.json();
            }
            return this.getFromLocalStorage('audit', projectId);
        } catch (e) {
            return this.getFromLocalStorage('audit', projectId);
        }
    }

    /**
     * Save feedback to database
     */
    async saveFeedback(record: FeedbackRecord): Promise<string | null> {
        try {
            const response = await fetch(`${API_BASE}/db/feedback`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(record)
            });
            if (response.ok) {
                const result = await response.json();
                return result.id;
            }
            return null;
        } catch (e) {
            console.error('[DB] Failed to save feedback:', e);
            this.saveToLocalStorage('feedback', record);
            return null;
        }
    }

    /**
     * Get feedback summary
     */
    async getFeedbackSummary(feature: string): Promise<{
        avgRating: number;
        totalCount: number;
        corrections: number;
    }> {
        try {
            const response = await fetch(`${API_BASE}/db/feedback/summary/${feature}`);
            if (response.ok) {
                return await response.json();
            }
        } catch (e) {
            // Fallback
        }
        return { avgRating: 0, totalCount: 0, corrections: 0 };
    }

    /**
     * Save learning data for ML training
     */
    async saveLearningData(data: LearningData): Promise<void> {
        try {
            await fetch(`${API_BASE}/db/learning`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
        } catch (e) {
            this.saveToLocalStorage('learning', data);
        }
    }

    /**
     * Export learning data for training
     */
    async exportLearningData(feature: string): Promise<LearningData[]> {
        try {
            const response = await fetch(`${API_BASE}/db/learning/export/${feature}`);
            if (response.ok) {
                return await response.json();
            }
        } catch (e) {
            console.error('[DB] Failed to export learning data');
        }
        return [];
    }

    /**
     * Sync localStorage to database (for offline data)
     */
    async syncLocalData(): Promise<number> {
        let synced = 0;

        // Sync audit
        const auditData = localStorage.getItem('db_audit_queue');
        if (auditData) {
            const records = JSON.parse(auditData) as AuditRecord[];
            for (const record of records) {
                if (await this.saveAudit(record)) synced++;
            }
            localStorage.removeItem('db_audit_queue');
        }

        // Sync feedback
        const feedbackData = localStorage.getItem('db_feedback_queue');
        if (feedbackData) {
            const records = JSON.parse(feedbackData) as FeedbackRecord[];
            for (const record of records) {
                if (await this.saveFeedback(record)) synced++;
            }
            localStorage.removeItem('db_feedback_queue');
        }

        return synced;
    }

    // ============================================
    // LOCAL STORAGE FALLBACK
    // ============================================

    private saveToLocalStorage(type: string, record: any): void {
        const key = `db_${type}_queue`;
        const existing = localStorage.getItem(key);
        const records = existing ? JSON.parse(existing) : [];
        records.push(record);
        localStorage.setItem(key, JSON.stringify(records.slice(-500)));
    }

    private getFromLocalStorage(type: string, projectId: string): any[] {
        const key = `db_${type}_queue`;
        const existing = localStorage.getItem(key);
        if (!existing) return [];
        const records = JSON.parse(existing);
        return records.filter((r: any) => r.projectId === projectId);
    }
}

// ============================================
// SINGLETON
// ============================================

export const database = new DatabaseServiceClass();
export default DatabaseServiceClass;
