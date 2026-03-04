var AuditType = /* @__PURE__ */ ((AuditType2) => {
  AuditType2["MODEL_CREATION"] = "MODEL_CREATION";
  AuditType2["ANALYSIS"] = "ANALYSIS";
  AuditType2["DESIGN_CHECK"] = "DESIGN_CHECK";
  AuditType2["OPTIMIZATION"] = "OPTIMIZATION";
  AuditType2["AI_RECOMMENDATION"] = "AI_RECOMMENDATION";
  AuditType2["USER_OVERRIDE"] = "USER_OVERRIDE";
  AuditType2["EXPORT"] = "EXPORT";
  AuditType2["VALIDATION"] = "VALIDATION";
  AuditType2["CONNECTION_DESIGN"] = "CONNECTION_DESIGN";
  AuditType2["DESIGN_DECISION"] = "DESIGN_DECISION";
  AuditType2["ANALYSIS_RUN"] = "ANALYSIS_RUN";
  AuditType2["MATERIAL_SELECTION"] = "MATERIAL_SELECTION";
  AuditType2["CODE_CHECK"] = "CODE_CHECK";
  AuditType2["IMPORT"] = "IMPORT";
  AuditType2["PROJECT_CREATE"] = "PROJECT_CREATE";
  AuditType2["PROJECT_UPDATE"] = "PROJECT_UPDATE";
  AuditType2["ERROR"] = "ERROR";
  return AuditType2;
})(AuditType || {});
var FeedbackType = /* @__PURE__ */ ((FeedbackType2) => {
  FeedbackType2["BUG"] = "BUG";
  FeedbackType2["FEATURE"] = "FEATURE";
  FeedbackType2["IMPROVEMENT"] = "IMPROVEMENT";
  FeedbackType2["GENERAL"] = "GENERAL";
  FeedbackType2["CORRECTION"] = "CORRECTION";
  FeedbackType2["RATING"] = "RATING";
  FeedbackType2["SUGGESTION"] = "SUGGESTION";
  FeedbackType2["ERROR_REPORT"] = "ERROR_REPORT";
  return FeedbackType2;
})(FeedbackType || {});
var FeedbackStatus = /* @__PURE__ */ ((FeedbackStatus2) => {
  FeedbackStatus2["NEW"] = "NEW";
  FeedbackStatus2["ACKNOWLEDGED"] = "ACKNOWLEDGED";
  FeedbackStatus2["IN_PROGRESS"] = "IN_PROGRESS";
  FeedbackStatus2["RESOLVED"] = "RESOLVED";
  FeedbackStatus2["WONT_FIX"] = "WONT_FIX";
  return FeedbackStatus2;
})(FeedbackStatus || {});
class PrismaClient {
  auditEntry;
  feedbackEntry;
  feedback;
  // Alias for feedbackEntry
  auditStore = [];
  feedbackStore = [];
  constructor() {
    this.auditEntry = this.createDelegate(this.auditStore);
    this.feedbackEntry = this.createDelegate(this.feedbackStore);
    this.feedback = this.feedbackEntry;
  }
  createDelegate(store) {
    return {
      findMany: async (options) => {
        let results = [...store];
        if (options?.where) {
          results = results.filter((item) => {
            return Object.entries(options.where).every(([key, value]) => {
              if (value === void 0) return true;
              return item[key] === value;
            });
          });
        }
        if (options?.orderBy) {
          const [field, order] = Object.entries(options.orderBy)[0];
          results.sort((a, b) => {
            const aVal = a[field];
            const bVal = b[field];
            if (aVal === bVal) return 0;
            const comparison = aVal < bVal ? -1 : 1;
            return order === "desc" ? -comparison : comparison;
          });
        }
        if (options?.skip) results = results.slice(options.skip);
        if (options?.take) results = results.slice(0, options.take);
        return results;
      },
      findUnique: async (options) => {
        return store.find((item) => item.id === options.where.id) || null;
      },
      create: async (options) => {
        const id = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
        const entry = { ...options.data, id };
        store.push(entry);
        return entry;
      },
      update: async (options) => {
        const index = store.findIndex((item) => item.id === options.where.id);
        if (index === -1) throw new Error("Record not found");
        store[index] = { ...store[index], ...options.data };
        return store[index];
      },
      delete: async (options) => {
        const index = store.findIndex((item) => item.id === options.where.id);
        if (index === -1) throw new Error("Record not found");
        const [deleted] = store.splice(index, 1);
        return deleted;
      },
      updateMany: async (options) => {
        let count = 0;
        store.forEach((item, index) => {
          const matches = Object.entries(options.where).every(([key, value]) => {
            if (value === void 0) return true;
            if (typeof value === "object" && value !== null && "in" in value) {
              return value.in.includes(item[key]);
            }
            return item[key] === value;
          });
          if (matches) {
            store[index] = { ...store[index], ...options.data };
            count++;
          }
        });
        return { count };
      },
      count: async (options) => {
        if (!options?.where) return store.length;
        return store.filter((item) => {
          return Object.entries(options.where).every(([key, value]) => {
            if (value === void 0) return true;
            return item[key] === value;
          });
        }).length;
      },
      groupBy: async (options) => {
        const groups = /* @__PURE__ */ new Map();
        const field = options.by[0];
        store.forEach((item) => {
          const key = String(item[field]);
          groups.set(key, (groups.get(key) || 0) + 1);
        });
        return Array.from(groups.entries()).map(([key, count]) => ({
          [field]: key,
          _count: count
        }));
      },
      aggregate: async () => {
        return { _avg: { rating: 0 }, _count: store.length };
      }
    };
  }
  async $connect() {
    console.log("[PrismaStub] Connected (in-memory mode)");
  }
  async $disconnect() {
    console.log("[PrismaStub] Disconnected");
  }
}
var prisma_stub_default = PrismaClient;
export {
  AuditType,
  FeedbackStatus,
  FeedbackType,
  PrismaClient,
  prisma_stub_default as default
};
//# sourceMappingURL=prisma-stub.js.map
