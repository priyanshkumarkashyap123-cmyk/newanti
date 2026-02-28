/**
 * DatabaseAuditService.ts
 * 
 * Production audit trail service with database persistence
 * Replaces in-memory AuditTrailService for production use
 */

import { PrismaClient, AuditType, AuditEntry } from '../types/prisma-stub.js';

// ============================================
// TYPES
// ============================================

export interface CreateAuditEntry {
    projectId: string;
    sessionId: string;
    type: AuditType;
    action: string;
    details: string;
    aiGenerated?: boolean;
    confidence?: number;
    modelUsed?: string;
    metadata?: Record<string, any>;
}

export interface AuditStats {
    totalEntries: number;
    byType: Record<string, number>;
    aiDecisions: number;
    recentActivity: AuditEntry[];
}

export interface PESignatureData {
    engineerName: string;
    licenseNumber: string;
    signedAt: Date;
    signatureHash?: string;
}

// ============================================
// DATABASE AUDIT SERVICE
// ============================================

export class DatabaseAuditService {
    private prisma: PrismaClient;

    constructor(prisma?: PrismaClient) {
        this.prisma = prisma || new PrismaClient();
    }

    /**
     * Log an audit entry to database
     */
    async log(entry: CreateAuditEntry): Promise<AuditEntry> {
        return this.prisma.auditEntry.create({
            data: {
                projectId: entry.projectId,
                sessionId: entry.sessionId,
                type: entry.type,
                action: entry.action,
                details: entry.details,
                aiGenerated: entry.aiGenerated || false,
                confidence: entry.confidence,
                modelUsed: entry.modelUsed,
                metadata: entry.metadata || {}
            }
        });
    }

    /**
     * Get audit entries for a project
     */
    async getProjectEntries(
        projectId: string,
        options?: {
            type?: AuditType;
            limit?: number;
            offset?: number;
            startDate?: Date;
            endDate?: Date;
        }
    ): Promise<AuditEntry[]> {
        return this.prisma.auditEntry.findMany({
            where: {
                projectId,
                type: options?.type,
                timestamp: {
                    gte: options?.startDate,
                    lte: options?.endDate
                }
            },
            orderBy: { timestamp: 'desc' },
            take: options?.limit || 100,
            skip: options?.offset || 0
        });
    }

    /**
     * Get audit entries for a session
     */
    async getSessionEntries(sessionId: string): Promise<AuditEntry[]> {
        return this.prisma.auditEntry.findMany({
            where: { sessionId },
            orderBy: { timestamp: 'asc' }
        });
    }

    /**
     * Get statistics for a project
     */
    async getStats(projectId: string): Promise<AuditStats> {
        const [total, aiCount, byType, recent] = await Promise.all([
            this.prisma.auditEntry.count({ where: { projectId } }),
            this.prisma.auditEntry.count({ where: { projectId, aiGenerated: true } }),
            this.prisma.auditEntry.groupBy({
                by: ['type'],
                where: { projectId },
                _count: true
            }),
            this.prisma.auditEntry.findMany({
                where: { projectId },
                orderBy: { timestamp: 'desc' },
                take: 10
            })
        ]);

        const typeMap: Record<string, number> = {};
        byType.forEach(({ type, _count }: { type?: string; _count: number }) => {
            if (type) typeMap[type] = _count;
        });

        return {
            totalEntries: total,
            byType: typeMap,
            aiDecisions: aiCount,
            recentActivity: recent
        };
    }

    /**
     * Sign entries with PE credentials
     */
    async signEntries(
        entryIds: string[],
        signature: PESignatureData
    ): Promise<number> {
        const result = await this.prisma.auditEntry.updateMany({
            where: { id: { in: entryIds } },
            data: {
                signedBy: signature.engineerName,
                licenseNo: signature.licenseNumber,
                signedAt: signature.signedAt,
                ...(signature.signatureHash ? { signatureHash: signature.signatureHash } : {})
            }
        });
        return result.count;
    }

    /**
     * Generate PE-signable report
     */
    async generateReport(
        projectId: string,
        engineer: string,
        license: string
    ): Promise<string> {
        const entries = await this.getProjectEntries(projectId);
        const stats = await this.getStats(projectId);

        let report = `# Structural Calculation Report\n\n`;
        report += `**Project ID:** ${projectId}\n`;
        report += `**Generated:** ${new Date().toISOString()}\n`;
        report += `**Prepared By:** ${engineer}\n`;
        report += `**License No:** ${license}\n\n`;
        report += `---\n\n`;

        report += `## Summary\n\n`;
        report += `- Total Operations: ${stats.totalEntries}\n`;
        report += `- AI-Assisted Decisions: ${stats.aiDecisions}\n\n`;

        report += `## Design Checks\n\n`;
        const checks = entries.filter(e => e.type === 'DESIGN_CHECK');
        for (const check of checks) {
            report += `### ${check.action}\n`;
            report += `- Time: ${check.timestamp}\n`;
            report += `- Details: ${check.details}\n`;
            if (check.confidence) {
                report += `- AI Confidence: ${(check.confidence * 100).toFixed(1)}%\n`;
            }
            report += `\n`;
        }

        report += `## Analysis Operations\n\n`;
        const analyses = entries.filter(e => e.type === 'ANALYSIS');
        for (const analysis of analyses) {
            report += `- ${analysis.action}: ${analysis.details}\n`;
        }

        report += `\n---\n\n`;
        report += `## Certification\n\n`;
        report += `I hereby certify that this report accurately represents the structural calculations performed.\n\n`;
        report += `**Engineer:** ${engineer}\n`;
        report += `**License:** ${license}\n`;
        report += `**Date:** ${new Date().toLocaleDateString()}\n`;

        return report;
    }

    /**
     * Export entries for compliance
     */
    async exportForCompliance(
        projectId: string,
        format: 'json' | 'csv' = 'json'
    ): Promise<string> {
        const entries = await this.getProjectEntries(projectId, { limit: 10000 });

        if (format === 'csv') {
            const headers = ['id', 'timestamp', 'type', 'action', 'details', 'aiGenerated', 'signedBy'];
            const rows = entries.map(e => [
                e.id,
                e.timestamp.toISOString(),
                e.type,
                `"${e.action}"`,
                `"${e.details}"`,
                e.aiGenerated,
                e.signedBy || ''
            ].join(','));
            return [headers.join(','), ...rows].join('\n');
        }

        return JSON.stringify(entries, null, 2);
    }
}

// ============================================
// SINGLETON
// ============================================

let dbAuditInstance: DatabaseAuditService | null = null;

export function getDbAuditService(prisma?: PrismaClient): DatabaseAuditService {
    if (!dbAuditInstance) {
        dbAuditInstance = new DatabaseAuditService(prisma);
    }
    return dbAuditInstance;
}

export default DatabaseAuditService;
