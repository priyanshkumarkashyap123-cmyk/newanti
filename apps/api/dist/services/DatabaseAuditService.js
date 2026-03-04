import { PrismaClient } from "../types/prisma-stub.js";
class DatabaseAuditService {
  prisma;
  constructor(prisma) {
    this.prisma = prisma || new PrismaClient();
  }
  /**
   * Log an audit entry to database
   */
  async log(entry) {
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
  async getProjectEntries(projectId, options) {
    return this.prisma.auditEntry.findMany({
      where: {
        projectId,
        type: options?.type,
        timestamp: {
          gte: options?.startDate,
          lte: options?.endDate
        }
      },
      orderBy: { timestamp: "desc" },
      take: options?.limit || 100,
      skip: options?.offset || 0
    });
  }
  /**
   * Get audit entries for a session
   */
  async getSessionEntries(sessionId) {
    return this.prisma.auditEntry.findMany({
      where: { sessionId },
      orderBy: { timestamp: "asc" }
    });
  }
  /**
   * Get statistics for a project
   */
  async getStats(projectId) {
    const [total, aiCount, byType, recent] = await Promise.all([
      this.prisma.auditEntry.count({ where: { projectId } }),
      this.prisma.auditEntry.count({ where: { projectId, aiGenerated: true } }),
      this.prisma.auditEntry.groupBy({
        by: ["type"],
        where: { projectId },
        _count: true
      }),
      this.prisma.auditEntry.findMany({
        where: { projectId },
        orderBy: { timestamp: "desc" },
        take: 10
      })
    ]);
    const typeMap = {};
    byType.forEach(({ type, _count }) => {
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
  async signEntries(entryIds, signature) {
    const result = await this.prisma.auditEntry.updateMany({
      where: { id: { in: entryIds } },
      data: {
        signedBy: signature.engineerName,
        licenseNo: signature.licenseNumber,
        signedAt: signature.signedAt,
        ...signature.signatureHash ? { signatureHash: signature.signatureHash } : {}
      }
    });
    return result.count;
  }
  /**
   * Generate PE-signable report
   */
  async generateReport(projectId, engineer, license) {
    const entries = await this.getProjectEntries(projectId);
    const stats = await this.getStats(projectId);
    let report = `# Structural Calculation Report

`;
    report += `**Project ID:** ${projectId}
`;
    report += `**Generated:** ${(/* @__PURE__ */ new Date()).toISOString()}
`;
    report += `**Prepared By:** ${engineer}
`;
    report += `**License No:** ${license}

`;
    report += `---

`;
    report += `## Summary

`;
    report += `- Total Operations: ${stats.totalEntries}
`;
    report += `- AI-Assisted Decisions: ${stats.aiDecisions}

`;
    report += `## Design Checks

`;
    const checks = entries.filter((e) => e.type === "DESIGN_CHECK");
    for (const check of checks) {
      report += `### ${check.action}
`;
      report += `- Time: ${check.timestamp}
`;
      report += `- Details: ${check.details}
`;
      if (check.confidence) {
        report += `- AI Confidence: ${(check.confidence * 100).toFixed(1)}%
`;
      }
      report += `
`;
    }
    report += `## Analysis Operations

`;
    const analyses = entries.filter((e) => e.type === "ANALYSIS");
    for (const analysis of analyses) {
      report += `- ${analysis.action}: ${analysis.details}
`;
    }
    report += `
---

`;
    report += `## Certification

`;
    report += `I hereby certify that this report accurately represents the structural calculations performed.

`;
    report += `**Engineer:** ${engineer}
`;
    report += `**License:** ${license}
`;
    report += `**Date:** ${(/* @__PURE__ */ new Date()).toLocaleDateString()}
`;
    return report;
  }
  /**
   * Export entries for compliance
   */
  async exportForCompliance(projectId, format = "json") {
    const entries = await this.getProjectEntries(projectId, { limit: 1e4 });
    if (format === "csv") {
      const headers = ["id", "timestamp", "type", "action", "details", "aiGenerated", "signedBy"];
      const rows = entries.map((e) => [
        e.id,
        e.timestamp.toISOString(),
        e.type,
        `"${e.action}"`,
        `"${e.details}"`,
        e.aiGenerated,
        e.signedBy || ""
      ].join(","));
      return [headers.join(","), ...rows].join("\n");
    }
    return JSON.stringify(entries, null, 2);
  }
}
let dbAuditInstance = null;
function getDbAuditService(prisma) {
  if (!dbAuditInstance) {
    dbAuditInstance = new DatabaseAuditService(prisma);
  }
  return dbAuditInstance;
}
var DatabaseAuditService_default = DatabaseAuditService;
export {
  DatabaseAuditService,
  DatabaseAuditService_default as default,
  getDbAuditService
};
//# sourceMappingURL=DatabaseAuditService.js.map
