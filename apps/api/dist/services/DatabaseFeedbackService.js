import { PrismaClient, FeedbackType } from "../types/prisma-stub.js";
class DatabaseFeedbackService {
  prisma;
  constructor(prisma) {
    this.prisma = prisma || new PrismaClient();
  }
  /**
   * Log a correction
   */
  async logCorrection(data) {
    return this.prisma.feedback.create({
      data: {
        projectId: data.projectId,
        userId: data.userId,
        sessionId: data.sessionId,
        type: FeedbackType.CORRECTION,
        feature: data.feature,
        originalInput: data.originalInput,
        originalOutput: data.originalOutput || {},
        correctedOutput: data.correctedOutput
      }
    });
  }
  /**
   * Log a rating
   */
  async logRating(data) {
    return this.prisma.feedback.create({
      data: {
        projectId: data.projectId,
        userId: data.userId,
        sessionId: data.sessionId,
        type: FeedbackType.RATING,
        feature: data.feature,
        originalInput: data.originalInput,
        originalOutput: data.originalOutput || {},
        rating: data.rating,
        comment: data.comment
      }
    });
  }
  /**
   * Log a suggestion
   */
  async logSuggestion(sessionId, feature, suggestion) {
    return this.prisma.feedback.create({
      data: {
        sessionId,
        type: FeedbackType.SUGGESTION,
        feature,
        originalInput: "",
        comment: suggestion
      }
    });
  }
  /**
   * Log an error report
   */
  async logError(sessionId, feature, originalInput, error) {
    return this.prisma.feedback.create({
      data: {
        sessionId,
        type: FeedbackType.ERROR_REPORT,
        feature,
        originalInput,
        originalOutput: { error }
      }
    });
  }
  /**
   * Get feedback statistics
   */
  async getStats(projectId) {
    const where = projectId ? { projectId } : {};
    const [total, corrections, ratings, byType, byFeature, unprocessed] = await Promise.all([
      this.prisma.feedback.count({ where }),
      this.prisma.feedback.count({ where: { ...where, type: FeedbackType.CORRECTION } }),
      this.prisma.feedback.findMany({
        where: { ...where, rating: { not: null } },
        select: { rating: true }
      }),
      this.prisma.feedback.groupBy({
        by: ["type"],
        where,
        _count: true
      }),
      this.prisma.feedback.groupBy({
        by: ["feature"],
        where,
        _count: true
      }),
      this.prisma.feedback.count({ where: { ...where, processed: false } })
    ]);
    const avgRating = ratings.length > 0 ? ratings.reduce((sum, r) => sum + (r.rating || 0), 0) / ratings.length : 0;
    const typeMap = {};
    byType.forEach(({ type, _count }) => {
      if (type) typeMap[type] = _count;
    });
    const featureMap = {};
    byFeature.forEach(({ feature, _count }) => {
      if (feature) featureMap[feature] = _count;
    });
    return {
      total,
      corrections,
      averageRating: avgRating,
      byType: typeMap,
      byFeature: featureMap,
      unprocessed
    };
  }
  /**
   * Get recent feedback
   */
  async getRecent(limit = 50, projectId) {
    return this.prisma.feedback.findMany({
      where: projectId ? { projectId } : {},
      orderBy: { createdAt: "desc" },
      take: limit
    });
  }
  /**
   * Export corrections for training
   */
  async exportForTraining() {
    const corrections = await this.prisma.feedback.findMany({
      where: {
        type: FeedbackType.CORRECTION,
        correctedOutput: { not: null },
        processed: false
      },
      orderBy: { createdAt: "desc" }
    });
    return {
      version: "1.0",
      exportedAt: /* @__PURE__ */ new Date(),
      entries: corrections.map((c) => ({
        input: c.originalInput,
        originalOutput: c.originalOutput,
        correctedOutput: c.correctedOutput,
        feature: c.feature || "",
        rating: c.rating ?? void 0
      }))
    };
  }
  /**
   * Mark entries as processed
   */
  async markProcessed(ids) {
    const result = await this.prisma.feedback.updateMany({
      where: { id: { in: ids } },
      data: { processed: true }
    });
    return result.count;
  }
  /**
   * Mark entries as used for training
   */
  async markUsedForTraining(ids) {
    const result = await this.prisma.feedback.updateMany({
      where: { id: { in: ids } },
      data: {
        usedForTraining: true,
        exportedAt: /* @__PURE__ */ new Date()
      }
    });
    return result.count;
  }
  /**
   * Get improvement metrics over time
   */
  async getImprovementMetrics(feature, days = 30) {
    const cutoff = /* @__PURE__ */ new Date();
    cutoff.setDate(cutoff.getDate() - days);
    const entries = await this.prisma.feedback.findMany({
      where: {
        feature,
        createdAt: { gte: cutoff }
      },
      orderBy: { createdAt: "asc" }
    });
    const byDay = {};
    for (const entry of entries) {
      if (entry.rating) {
        const day = entry.createdAt.toISOString().split("T")[0];
        if (!byDay[day]) byDay[day] = [];
        byDay[day].push(entry.rating);
      }
    }
    const ratingsOverTime = Object.entries(byDay).map(([date, ratings]) => ({
      date,
      avgRating: ratings.reduce((a, b) => a + b, 0) / ratings.length
    }));
    const corrections = entries.filter((e) => e.type === FeedbackType.CORRECTION).length;
    const correctionRate = entries.length > 0 ? corrections / entries.length : 0;
    return { ratingsOverTime, correctionRate };
  }
}
let dbFeedbackInstance = null;
function getDbFeedbackService(prisma) {
  if (!dbFeedbackInstance) {
    dbFeedbackInstance = new DatabaseFeedbackService(prisma);
  }
  return dbFeedbackInstance;
}
var DatabaseFeedbackService_default = DatabaseFeedbackService;
export {
  DatabaseFeedbackService,
  DatabaseFeedbackService_default as default,
  getDbFeedbackService
};
//# sourceMappingURL=DatabaseFeedbackService.js.map
