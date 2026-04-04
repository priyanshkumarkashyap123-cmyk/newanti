/**
 * AuditTrailService.ts
 * 
 * Professional audit trail system for AI decisions
 * 
 * Features:
 * - Log all AI decisions with timestamps
 * - Track model state changes
 * - Store calculation assumptions
 * - Generate PE-signable audit reports
 * - Version control for AI decisions
 */

// ============================================
// TYPES

import { logger } from '../lib/logging/logger';
// ============================================

export interface AuditEntry {
    id: string;
    timestamp: Date;
    category: AuditCategory;
    type: AuditCategory; // Alias for category (used by AuditTrailViewer)
    action: string;
    description: string;
    details?: string; // Used by AuditTrailViewer
    user?: string;
    aiGenerated: boolean;
    confidence?: number; // AI confidence score (0-1)
    metadata: Record<string, unknown>;
    previousState?: unknown;
    newState?: unknown;
    modelSnapshot?: ModelSnapshot;
    calculationDetails?: CalculationDetails;
}

export type AuditCategory =
    | 'model_creation'
    | 'model_modification'
    | 'analysis_request'
    | 'analysis_result'
    | 'design_check'
    | 'optimization'
    | 'ai_recommendation'
    | 'user_override'
    | 'export'
    | 'session'
    | 'validation';

export interface ModelSnapshot {
    nodes: number;
    members: number;
    loads: number;
    supports: number;
    timestamp: Date;
    hash?: string;
}

export interface CalculationDetails {
    method: string;
    inputs: Record<string, number | string>;
    formula?: string;
    result: number | Record<string, number>;
    unit: string;
    codeReference?: string;
    assumptions: string[];
}

export interface AuditReport {
    projectName: string;
    generatedAt: Date;
    generatedBy: string;
    version: string;
    entries: AuditEntry[];
    summary: AuditSummary;
    modelVersions: ModelVersion[];
    signatureBlock: SignatureBlock;
}

export interface AuditSummary {
    totalEntries: number;
    aiGeneratedCount: number;
    userOverrideCount: number;
    analysisCount: number;
    designCheckCount: number;
    timeRange: { start: Date; end: Date };
}

export interface ModelVersion {
    version: number;
    timestamp: Date;
    description: string;
    snapshot: ModelSnapshot;
    changeType: 'created' | 'modified' | 'analyzed' | 'optimized';
}

export interface SignatureBlock {
    preparedBy: string;
    date: Date;
    professionalLicense?: string;
    signature?: string; // Base64 encoded signature image
    approved: boolean;
}

// ============================================
// AUDIT TRAIL SERVICE
// ============================================

export class AuditTrailService {
    private entries: AuditEntry[] = [];
    private modelVersions: ModelVersion[] = [];
    private currentVersion: number = 0;
    private projectName: string = 'Untitled Project';
    private sessionId: string;
    private readonly STORAGE_KEY = 'beamlab-audit-trail';
    private readonly MAX_ENTRIES = 1000;

    constructor() {
        this.sessionId = this.generateId('session');
        this.loadFromStorage();
        this.logSession('start');
    }

    // ============================================
    // LOGGING METHODS
    // ============================================

    /**
     * Log a general audit entry
     */
    log(
        category: AuditCategory,
        action: string,
        description: string,
        options: {
            aiGenerated?: boolean;
            metadata?: Record<string, unknown>;
            previousState?: unknown;
            newState?: unknown;
            calculationDetails?: CalculationDetails;
            confidence?: number;
        } = {}
    ): AuditEntry {
        const entry: AuditEntry = {
            id: this.generateId('audit'),
            timestamp: new Date(),
            category,
            type: category, // Alias for compatibility with AuditTrailViewer
            action,
            description,
            details: description, // Alias for compatibility with AuditTrailViewer
            aiGenerated: options.aiGenerated ?? false,
            confidence: options.confidence,
            metadata: options.metadata ?? {},
            previousState: options.previousState,
            newState: options.newState,
            calculationDetails: options.calculationDetails,
            modelSnapshot: this.getCurrentModelSnapshot()
        };

        this.entries.push(entry);
        this.trimEntries();
        this.saveToStorage();

        logger.info(`[Audit] ${category}: ${action} - ${description}`);

        return entry;
    }

    /**
     * Log AI-generated recommendation
     */
    logAIRecommendation(
        action: string,
        recommendation: string,
        confidence: number,
        reasoning?: string
    ): AuditEntry {
        return this.log('ai_recommendation', action, recommendation, {
            aiGenerated: true,
            metadata: {
                confidence,
                reasoning,
                model: 'Gemini 1.5 Flash'
            }
        });
    }

    /**
     * Log model creation
     */
    logModelCreation(
        description: string,
        structureType: string,
        parameters: Record<string, unknown>,
        aiGenerated: boolean = false
    ): AuditEntry {
        const entry = this.log('model_creation', 'create_structure', description, {
            aiGenerated,
            metadata: { structureType, parameters }
        });

        this.incrementModelVersion('created', description);
        return entry;
    }

    /**
     * Log model modification
     */
    logModelModification(
        action: string,
        description: string,
        previousState: unknown,
        newState: unknown,
        aiGenerated: boolean = false
    ): AuditEntry {
        const entry = this.log('model_modification', action, description, {
            aiGenerated,
            previousState,
            newState
        });

        this.incrementModelVersion('modified', description);
        return entry;
    }

    /**
     * Log analysis request and result
     */
    logAnalysis(
        analysisType: string,
        parameters: Record<string, unknown>,
        results: Record<string, unknown>,
        executionTimeMs: number
    ): AuditEntry {
        return this.log('analysis_result', analysisType, `Analysis completed in ${executionTimeMs}ms`, {
            aiGenerated: false,
            metadata: {
                analysisType,
                parameters,
                results,
                executionTimeMs
            }
        });
    }

    /**
     * Log design check with calculations
     */
    logDesignCheck(
        checkName: string,
        clause: string,
        calculation: CalculationDetails,
        result: 'pass' | 'fail' | 'warning'
    ): AuditEntry {
        return this.log('design_check', checkName, `${clause}: ${result.toUpperCase()}`, {
            aiGenerated: false,
            metadata: { clause, result },
            calculationDetails: calculation
        });
    }

    /**
     * Log user override of AI recommendation
     */
    logUserOverride(
        originalRecommendation: string,
        userDecision: string,
        reason?: string
    ): AuditEntry {
        return this.log('user_override', 'override_ai', `User overrode: ${originalRecommendation}`, {
            aiGenerated: false,
            metadata: {
                originalRecommendation,
                userDecision,
                reason
            }
        });
    }

    /**
     * Log session events
     */
    logSession(event: 'start' | 'end' | 'save' | 'load'): AuditEntry {
        return this.log('session', event, `Session ${event}`, {
            metadata: { sessionId: this.sessionId }
        });
    }

    // ============================================
    // MODEL VERSION TRACKING
    // ============================================

    /**
     * Increment model version
     */
    private incrementModelVersion(
        changeType: ModelVersion['changeType'],
        description: string
    ): void {
        this.currentVersion++;
        this.modelVersions.push({
            version: this.currentVersion,
            timestamp: new Date(),
            description,
            changeType,
            snapshot: this.getCurrentModelSnapshot()
        });
    }

    /**
     * Get current model snapshot (placeholder - should connect to model store)
     */
    private getCurrentModelSnapshot(): ModelSnapshot {
        // In production, this would read from the model store
        return {
            nodes: 0,
            members: 0,
            loads: 0,
            supports: 0,
            timestamp: new Date()
        };
    }

    /**
     * Set model snapshot data (called by model store)
     */
    updateModelSnapshot(snapshot: Omit<ModelSnapshot, 'timestamp' | 'hash'>): void {
        // This would be called when model changes
    }

    // ============================================
    // REPORT GENERATION
    // ============================================

    /**
     * Generate PE-signable audit report
     */
    generateReport(preparedBy: string, license?: string): AuditReport {
        const entries = this.getEntries();
        const timestamps = entries.map(e => e.timestamp);

        const summary: AuditSummary = {
            totalEntries: entries.length,
            aiGeneratedCount: entries.filter(e => e.aiGenerated).length,
            userOverrideCount: entries.filter(e => e.category === 'user_override').length,
            analysisCount: entries.filter(e => e.category === 'analysis_result').length,
            designCheckCount: entries.filter(e => e.category === 'design_check').length,
            timeRange: {
                start: timestamps.length > 0 ? new Date(Math.min(...timestamps.map(t => t.getTime()))) : new Date(),
                end: timestamps.length > 0 ? new Date(Math.max(...timestamps.map(t => t.getTime()))) : new Date()
            }
        };

        return {
            projectName: this.projectName,
            generatedAt: new Date(),
            generatedBy: preparedBy,
            version: '1.0.0',
            entries,
            summary,
            modelVersions: [...this.modelVersions],
            signatureBlock: {
                preparedBy,
                date: new Date(),
                professionalLicense: license,
                approved: false
            }
        };
    }

    /**
     * Generate report as markdown
     */
    generateReportMarkdown(preparedBy: string, license?: string): string {
        const report = this.generateReport(preparedBy, license);

        let md = `# Structural Analysis Audit Report\n\n`;
        md += `**Project:** ${report.projectName}\n`;
        md += `**Generated:** ${report.generatedAt.toISOString()}\n`;
        md += `**Prepared By:** ${preparedBy}\n`;
        if (license) md += `**License:** ${license}\n`;
        md += `\n---\n\n`;

        // Summary
        md += `## Summary\n\n`;
        md += `| Metric | Value |\n`;
        md += `|--------|-------|\n`;
        md += `| Total Audit Entries | ${report.summary.totalEntries} |\n`;
        md += `| AI-Generated Actions | ${report.summary.aiGeneratedCount} |\n`;
        md += `| User Overrides | ${report.summary.userOverrideCount} |\n`;
        md += `| Analysis Runs | ${report.summary.analysisCount} |\n`;
        md += `| Design Checks | ${report.summary.designCheckCount} |\n`;
        md += `\n`;

        // Model Versions
        if (report.modelVersions.length > 0) {
            md += `## Model Version History\n\n`;
            md += `| Version | Timestamp | Type | Description |\n`;
            md += `|---------|-----------|------|-------------|\n`;
            for (const v of report.modelVersions) {
                md += `| v${v.version} | ${v.timestamp.toISOString()} | ${v.changeType} | ${v.description} |\n`;
            }
            md += `\n`;
        }

        // Design Checks
        const designChecks = report.entries.filter(e => e.category === 'design_check');
        if (designChecks.length > 0) {
            md += `## Design Checks\n\n`;
            for (const check of designChecks) {
                const result = check.metadata?.result || 'unknown';
                const emoji = result === 'pass' ? '✅' : result === 'fail' ? '❌' : '⚠️';
                md += `### ${emoji} ${check.action}\n\n`;
                md += `**${check.description}**\n\n`;

                if (check.calculationDetails) {
                    const calc = check.calculationDetails;
                    md += `- **Method:** ${calc.method}\n`;
                    if (calc.formula) md += `- **Formula:** \`${calc.formula}\`\n`;
                    if (calc.codeReference) md += `- **Code Reference:** ${calc.codeReference}\n`;
                    md += `- **Result:** ${typeof calc.result === 'number' ? calc.result.toFixed(2) : JSON.stringify(calc.result)} ${calc.unit}\n`;
                    if (calc.assumptions.length > 0) {
                        md += `- **Assumptions:**\n`;
                        calc.assumptions.forEach(a => md += `  - ${a}\n`);
                    }
                    md += `\n`;
                }
            }
        }

        // AI Recommendations
        const aiRecs = report.entries.filter(e => e.category === 'ai_recommendation');
        if (aiRecs.length > 0) {
            md += `## AI Recommendations\n\n`;
            md += `> [!NOTE]\n`;
            md += `> The following recommendations were generated by AI and should be reviewed by a qualified engineer.\n\n`;

            for (const rec of aiRecs) {
                md += `### ${rec.action}\n`;
                md += `- **Recommendation:** ${rec.description}\n`;
                md += `- **Confidence:** ${(Number(rec.metadata?.confidence) * 100 || 0).toFixed(0)}%\n`;
                if (rec.metadata?.reasoning) {
                    md += `- **Reasoning:** ${rec.metadata.reasoning}\n`;
                }
                md += `\n`;
            }
        }

        // Signature Block
        md += `## Certification\n\n`;
        md += `This report has been prepared using BeamLab structural analysis software.\n\n`;
        md += `| Field | Value |\n`;
        md += `|-------|-------|\n`;
        md += `| Prepared By | ${preparedBy} |\n`;
        md += `| Date | ${new Date().toLocaleDateString()} |\n`;
        if (license) md += `| License No. | ${license} |\n`;
        md += `\n`;
        md += `**Signature:** ________________________\n\n`;

        return md;
    }

    // ============================================
    // QUERY METHODS
    // ============================================

    /**
     * Get all entries
     */
    getEntries(filter?: {
        category?: AuditCategory;
        aiGenerated?: boolean;
        startDate?: Date;
        endDate?: Date;
    }): AuditEntry[] {
        let filtered = [...this.entries];

        if (filter?.category) {
            filtered = filtered.filter(e => e.category === filter.category);
        }
        if (filter?.aiGenerated !== undefined) {
            filtered = filtered.filter(e => e.aiGenerated === filter.aiGenerated);
        }
        if (filter?.startDate) {
            filtered = filtered.filter(e => e.timestamp >= filter.startDate!);
        }
        if (filter?.endDate) {
            filtered = filtered.filter(e => e.timestamp <= filter.endDate!);
        }

        return filtered;
    }

    /**
     * Get statistics for the audit trail (used by AuditTrailViewer)
     */
    getStats(): {
        total: number;
        aiGenerated: number;
        userOverrides: number;
        byCategory: Record<string, number>;
    } {
        const entries = this.entries;
        const byCategory: Record<string, number> = {};
        
        for (const entry of entries) {
            const cat = entry.category || entry.type || 'unknown';
            byCategory[cat] = (byCategory[cat] || 0) + 1;
        }

        return {
            total: entries.length,
            aiGenerated: entries.filter(e => e.aiGenerated).length,
            userOverrides: entries.filter(e => e.category === 'user_override').length,
            byCategory
        };
    }

    /**
     * Get entries by session
     */
    getSessionEntries(): AuditEntry[] {
        // Get entries from current session
        const sessionStart = this.entries.find(
            e => e.category === 'session' &&
                e.action === 'start' &&
                e.metadata?.sessionId === this.sessionId
        );

        if (!sessionStart) return this.entries;

        return this.entries.filter(e => e.timestamp >= sessionStart.timestamp);
    }

    /**
     * Get model versions
     */
    getModelVersions(): ModelVersion[] {
        return [...this.modelVersions];
    }

    /**
     * Get latest model version
     */
    getCurrentModelVersion(): number {
        return this.currentVersion;
    }

    // ============================================
    // STORAGE METHODS
    // ============================================

    /**
     * Save to localStorage
     */
    private saveToStorage(): void {
        try {
            const data = {
                entries: this.entries.slice(-this.MAX_ENTRIES),
                modelVersions: this.modelVersions,
                currentVersion: this.currentVersion,
                projectName: this.projectName
            };
            localStorage.setItem(this.STORAGE_KEY, JSON.stringify(data));
        } catch (e) {
            logger.warn('Could not save audit trail', { error: e instanceof Error ? e.message : String(e) });
        }
    }

    /**
     * Load from localStorage
     */
    private loadFromStorage(): void {
        try {
            const data = localStorage.getItem(this.STORAGE_KEY);
            if (data) {
                const parsed = JSON.parse(data);
                this.entries = (parsed.entries || []).map((e: Record<string, unknown>) => ({
                    ...e,
                    timestamp: new Date(e.timestamp as string)
                }));
                this.modelVersions = (parsed.modelVersions || []).map((v: Record<string, unknown>) => ({
                    ...v,
                    timestamp: new Date(v.timestamp as string),
                    snapshot: {
                        ...(v.snapshot as Record<string, unknown>),
                        timestamp: new Date((v.snapshot as Record<string, unknown>).timestamp as string)
                    }
                }));
                this.currentVersion = parsed.currentVersion || 0;
                this.projectName = parsed.projectName || 'Untitled Project';
            }
        } catch (e) {
            logger.warn('Could not load audit trail', { error: e instanceof Error ? e.message : String(e) });
        }
    }

    /**
     * Trim entries to max size
     */
    private trimEntries(): void {
        if (this.entries.length > this.MAX_ENTRIES) {
            this.entries = this.entries.slice(-this.MAX_ENTRIES);
        }
    }

    /**
     * Clear all audit data
     */
    clear(): void {
        this.entries = [];
        this.modelVersions = [];
        this.currentVersion = 0;
        localStorage.removeItem(this.STORAGE_KEY);
        logger.info('[Audit] Audit trail cleared');
    }

    /**
     * Set project name
     */
    setProjectName(name: string): void {
        this.projectName = name;
        this.saveToStorage();
    }

    // ============================================
    // UTILITY METHODS
    // ============================================

    /**
     * Generate unique ID
     */
    private generateId(prefix: string): string {
        return `${prefix}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    }

    /**
     * Export entries as JSON
     */
    exportJSON(): string {
        return JSON.stringify({
            entries: this.entries,
            modelVersions: this.modelVersions,
            projectName: this.projectName,
            exportedAt: new Date().toISOString()
        }, null, 2);
    }

    /**
     * Import entries from JSON
     */
    importJSON(json: string): void {
        try {
            const data = JSON.parse(json);
            this.entries = data.entries || [];
            this.modelVersions = data.modelVersions || [];
            this.projectName = data.projectName || 'Imported Project';
            this.currentVersion = this.modelVersions.length;
            this.saveToStorage();
        } catch (e) {
            logger.error('Failed to import audit trail', { error: e instanceof Error ? e.message : String(e) });
            throw new Error('Invalid audit trail JSON');
        }
    }
}

// Export singleton instance
export const auditTrail = new AuditTrailService();
export default AuditTrailService;
