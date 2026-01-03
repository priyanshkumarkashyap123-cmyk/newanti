import { User, isMasterUser } from "../models.js";
const TIER_LIMITS = {
  free: {
    maxNodes: 10,
    maxMembers: 15,
    maxProjects: 1,
    maxAnalysisPerDay: 3,
    canSaveProjects: false,
    canExportCleanPDF: false,
    hasDesignCodes: false,
    templates: ["SIMPLY_SUPPORTED_BEAM", "CANTILEVER_BEAM", "PORTAL_FRAME", "PRATT_TRUSS_12M", "G_PLUS_1_FRAME"]
  },
  pro: {
    maxNodes: Infinity,
    maxMembers: Infinity,
    maxProjects: 10,
    maxAnalysisPerDay: Infinity,
    canSaveProjects: true,
    canExportCleanPDF: true,
    hasDesignCodes: true,
    templates: ["ALL"]
    // Special value meaning all templates
  },
  enterprise: {
    maxNodes: Infinity,
    maxMembers: Infinity,
    maxProjects: Infinity,
    maxAnalysisPerDay: Infinity,
    canSaveProjects: true,
    canExportCleanPDF: true,
    hasDesignCodes: true,
    templates: ["ALL"]
  }
};
class UserActivityService {
  /**
   * Record user login
   */
  static async recordLogin(clerkId) {
    try {
      const user = await User.findOneAndUpdate(
        { clerkId },
        {
          $set: { lastLogin: /* @__PURE__ */ new Date() },
          $push: {
            activityLog: {
              $each: [{ action: "login", timestamp: /* @__PURE__ */ new Date() }],
              $slice: -100
              // Keep last 100 activities
            }
          }
        },
        { new: true }
      );
      return user;
    } catch (error) {
      console.error("[UserActivityService] recordLogin error:", error);
      return null;
    }
  }
  /**
   * Check if user can run analysis (based on daily limit for free tier)
   */
  static async canRunAnalysis(clerkId) {
    try {
      const user = await User.findOne({ clerkId });
      if (!user) {
        return { allowed: false, reason: "User not found" };
      }
      if (isMasterUser(user.email)) {
        return { allowed: true, remaining: Infinity };
      }
      const limits = TIER_LIMITS[user.tier];
      if (limits.maxAnalysisPerDay === Infinity) {
        return { allowed: true };
      }
      const today = /* @__PURE__ */ new Date();
      today.setHours(0, 0, 0, 0);
      if (user.lastAnalysisDate && user.lastAnalysisDate >= today) {
        if (user.dailyAnalysisCount >= limits.maxAnalysisPerDay) {
          return {
            allowed: false,
            reason: `Daily limit reached (${limits.maxAnalysisPerDay}/day). Upgrade to Pro for unlimited analyses.`,
            remaining: 0
          };
        }
        return { allowed: true, remaining: limits.maxAnalysisPerDay - user.dailyAnalysisCount };
      }
      return { allowed: true, remaining: limits.maxAnalysisPerDay };
    } catch (error) {
      console.error("[UserActivityService] canRunAnalysis error:", error);
      return { allowed: false, reason: "Error checking limits" };
    }
  }
  /**
   * Record analysis run
   */
  static async recordAnalysis(clerkId, metadata) {
    try {
      const today = /* @__PURE__ */ new Date();
      today.setHours(0, 0, 0, 0);
      const user = await User.findOne({ clerkId });
      if (!user) return null;
      const isNewDay = !user.lastAnalysisDate || user.lastAnalysisDate < today;
      const newDailyCount = isNewDay ? 1 : user.dailyAnalysisCount + 1;
      return await User.findOneAndUpdate(
        { clerkId },
        {
          $set: {
            lastAnalysisDate: /* @__PURE__ */ new Date(),
            dailyAnalysisCount: newDailyCount
          },
          $inc: { totalAnalysisRuns: 1 },
          $push: {
            activityLog: {
              $each: [{ action: "analysis_run", timestamp: /* @__PURE__ */ new Date(), metadata }],
              $slice: -100
            }
          }
        },
        { new: true }
      );
    } catch (error) {
      console.error("[UserActivityService] recordAnalysis error:", error);
      return null;
    }
  }
  /**
   * Record PDF export
   */
  static async recordExport(clerkId) {
    try {
      return await User.findOneAndUpdate(
        { clerkId },
        {
          $inc: { totalExports: 1 },
          $push: {
            activityLog: {
              $each: [{ action: "export_pdf", timestamp: /* @__PURE__ */ new Date() }],
              $slice: -100
            }
          }
        },
        { new: true }
      );
    } catch (error) {
      console.error("[UserActivityService] recordExport error:", error);
      return null;
    }
  }
  /**
   * Get user activity summary
   */
  static async getActivitySummary(clerkId) {
    try {
      const user = await User.findOne({ clerkId }).populate("projects");
      if (!user) return null;
      const effectiveTier = isMasterUser(user.email) ? "enterprise" : user.tier;
      const limits = TIER_LIMITS[effectiveTier];
      const today = /* @__PURE__ */ new Date();
      today.setHours(0, 0, 0, 0);
      const isNewDay = !user.lastAnalysisDate || user.lastAnalysisDate < today;
      const dailyAnalysisRemaining = limits.maxAnalysisPerDay === Infinity ? Infinity : isNewDay ? limits.maxAnalysisPerDay : Math.max(0, limits.maxAnalysisPerDay - user.dailyAnalysisCount);
      return {
        tier: user.tier,
        limits,
        stats: {
          lastLogin: user.lastLogin,
          totalAnalysisRuns: user.totalAnalysisRuns,
          totalExports: user.totalExports,
          dailyAnalysisRemaining,
          projectCount: user.projects?.length ?? 0
        },
        recentActivity: user.activityLog.slice(-10).reverse()
      };
    } catch (error) {
      console.error("[UserActivityService] getActivitySummary error:", error);
      return null;
    }
  }
  /**
   * Check tier limits for model size
   */
  static async checkModelLimits(clerkId, nodeCount, memberCount) {
    try {
      const user = await User.findOne({ clerkId });
      if (!user) {
        return { allowed: true };
      }
      if (isMasterUser(user.email)) {
        return { allowed: true };
      }
      const limits = TIER_LIMITS[user.tier];
      if (nodeCount > limits.maxNodes) {
        return {
          allowed: false,
          reason: `Node limit exceeded (${nodeCount}/${limits.maxNodes}). Upgrade to Pro for unlimited nodes.`
        };
      }
      if (memberCount > limits.maxMembers) {
        return {
          allowed: false,
          reason: `Member limit exceeded (${memberCount}/${limits.maxMembers}). Upgrade to Pro for unlimited members.`
        };
      }
      return { allowed: true };
    } catch (error) {
      console.error("[UserActivityService] checkModelLimits error:", error);
      return { allowed: true };
    }
  }
  /**
   * Create or get user
   */
  static async getOrCreateUser(clerkId, email) {
    try {
      let user = await User.findOne({ clerkId });
      const isMaster = isMasterUser(email);
      if (!user) {
        user = await User.create({
          clerkId,
          email,
          tier: isMaster ? "enterprise" : "free",
          lastLogin: /* @__PURE__ */ new Date()
        });
        console.log(`[UserActivityService] Created new user: ${email}${isMaster ? " (MASTER USER)" : ""}`);
      } else if (isMaster && user.tier !== "enterprise") {
        user.tier = "enterprise";
        await user.save();
        console.log(`[UserActivityService] Upgraded master user to enterprise: ${email}`);
      }
      return user;
    } catch (error) {
      console.error("[UserActivityService] getOrCreateUser error:", error);
      return null;
    }
  }
}
var UserActivityService_default = UserActivityService;
export {
  TIER_LIMITS,
  UserActivityService,
  UserActivityService_default as default
};
//# sourceMappingURL=UserActivityService.js.map
