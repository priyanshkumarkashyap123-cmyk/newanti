import { Router } from "express";
import { requireAuth, getAuth } from "../middleware/authMiddleware.js";
import { UserActivityService, TIER_LIMITS } from "../services/UserActivityService.js";
import { User, Subscription, getEffectiveTier, UserModel, isMasterUser } from "../models.js";
const USE_CLERK = process.env["USE_CLERK"] === "true";
const router = Router();
router.get("/profile", requireAuth(), async (req, res) => {
  try {
    const { userId } = getAuth(req);
    if (!userId) {
      return res.status(401).json({ success: false, error: "Unauthorized" });
    }
    const summary = await UserActivityService.getActivitySummary(userId);
    if (!summary) {
      return res.status(404).json({ success: false, error: "User not found" });
    }
    return res.json({ success: true, data: summary });
  } catch (error) {
    console.error("[UserRoutes] /profile error:", error);
    return res.status(500).json({ success: false, error: "Server error" });
  }
});
router.post("/login", requireAuth(), async (req, res) => {
  try {
    const { userId } = getAuth(req);
    const { email } = req.body;
    if (!userId) {
      return res.status(401).json({ success: false, error: "Unauthorized" });
    }
    let user = await UserActivityService.getOrCreateUser(userId, email || "unknown@beamlab.com");
    user = await UserActivityService.recordLogin(userId);
    return res.json({
      success: true,
      data: {
        tier: user?.tier || "free",
        lastLogin: user?.lastLogin
      }
    });
  } catch (error) {
    console.error("[UserRoutes] /login error:", error);
    return res.status(500).json({ success: false, error: "Server error" });
  }
});
router.get("/limits", requireAuth(), async (req, res) => {
  try {
    const { userId, email: authEmail } = getAuth(req);
    if (!userId) {
      return res.status(401).json({ success: false, error: "Unauthorized" });
    }
    let userEmail = "";
    let dbTier = "free";
    if (USE_CLERK) {
      const user = await User.findOne({ clerkId: userId });
      userEmail = user?.email || "";
      dbTier = user?.tier || "free";
    } else {
      const user = await UserModel.findById(userId);
      userEmail = user?.email || authEmail || "";
      dbTier = user?.subscriptionTier || "free";
    }
    const tier = getEffectiveTier(userEmail, dbTier);
    const limits = TIER_LIMITS[tier];
    return res.json({
      success: true,
      data: {
        tier,
        limits
      }
    });
  } catch (error) {
    console.error("[UserRoutes] /limits error:", error);
    return res.status(500).json({ success: false, error: "Server error" });
  }
});
router.get("/subscription", requireAuth(), async (req, res) => {
  try {
    const { userId, email: authEmail } = getAuth(req);
    if (!userId) {
      return res.json({
        success: true,
        data: {
          tier: "free",
          isLoading: false,
          expiresAt: null,
          subscription: null,
          features: {
            maxProjects: 3,
            pdfExport: false,
            aiAssistant: false,
            advancedDesignCodes: false,
            teamMembers: 1,
            prioritySupport: false,
            apiAccess: false
          },
          limits: TIER_LIMITS["free"]
        }
      });
    }
    let userEmail = authEmail || "";
    let dbTier = "free";
    let subscriptionData = null;
    try {
      if (USE_CLERK) {
        const user = await User.findOne({ clerkId: userId });
        if (user) {
          userEmail = user.email || userEmail;
          dbTier = user.tier || "free";
          if (user.subscription) {
            const subscription = await Subscription.findById(user.subscription);
            if (subscription) {
              subscriptionData = {
                status: subscription.status,
                currentPeriodEnd: subscription.currentPeriodEnd,
                cancelAtPeriodEnd: subscription.cancelAtPeriodEnd
              };
            }
          }
        }
      } else {
        const user = await UserModel.findById(userId);
        if (user) {
          userEmail = user.email || authEmail || "";
          dbTier = user.subscriptionTier || "free";
        }
      }
    } catch (dbError) {
      console.warn("[Subscription] Database lookup failed, using defaults:", dbError);
    }
    const tier = getEffectiveTier(userEmail, dbTier);
    console.log(`[Subscription] User: ${userEmail}, DB Tier: ${dbTier}, Effective Tier: ${tier}, Master: ${isMasterUser(userEmail)}`);
    const limits = TIER_LIMITS[tier];
    const features = {
      maxProjects: tier === "free" ? 3 : -1,
      pdfExport: tier !== "free",
      aiAssistant: tier !== "free",
      advancedDesignCodes: tier !== "free",
      teamMembers: tier === "free" ? 1 : tier === "pro" ? 5 : -1,
      prioritySupport: tier !== "free",
      apiAccess: tier === "enterprise"
    };
    return res.json({
      success: true,
      data: {
        tier,
        isLoading: false,
        expiresAt: subscriptionData?.currentPeriodEnd || null,
        subscription: subscriptionData,
        features,
        limits
      }
    });
  } catch (error) {
    console.error("[UserRoutes] /subscription error:", error);
    return res.status(500).json({ success: false, error: "Server error" });
  }
});
router.post("/check-analysis", requireAuth(), async (req, res) => {
  try {
    const { userId } = getAuth(req);
    if (!userId) {
      return res.status(401).json({ success: false, error: "Unauthorized" });
    }
    const result = await UserActivityService.canRunAnalysis(userId);
    return res.json({ success: true, data: result });
  } catch (error) {
    console.error("[UserRoutes] /check-analysis error:", error);
    return res.status(500).json({ success: false, error: "Server error" });
  }
});
router.post("/record-analysis", requireAuth(), async (req, res) => {
  try {
    const { userId } = getAuth(req);
    const { nodeCount, memberCount } = req.body;
    if (!userId) {
      return res.status(401).json({ success: false, error: "Unauthorized" });
    }
    await UserActivityService.recordAnalysis(userId, { nodeCount, memberCount });
    return res.json({ success: true });
  } catch (error) {
    console.error("[UserRoutes] /record-analysis error:", error);
    return res.status(500).json({ success: false, error: "Server error" });
  }
});
router.post("/check-model-limits", requireAuth(), async (req, res) => {
  try {
    const { userId } = getAuth(req);
    const { nodeCount, memberCount } = req.body;
    if (!userId) {
      return res.status(401).json({ success: false, error: "Unauthorized" });
    }
    const result = await UserActivityService.checkModelLimits(
      userId,
      nodeCount || 0,
      memberCount || 0
    );
    return res.json({ success: true, data: result });
  } catch (error) {
    console.error("[UserRoutes] /check-model-limits error:", error);
    return res.status(500).json({ success: false, error: "Server error" });
  }
});
router.post("/record-export", requireAuth(), async (req, res) => {
  try {
    const { userId } = getAuth(req);
    if (!userId) {
      return res.status(401).json({ success: false, error: "Unauthorized" });
    }
    await UserActivityService.recordExport(userId);
    return res.json({ success: true });
  } catch (error) {
    console.error("[UserRoutes] /record-export error:", error);
    return res.status(500).json({ success: false, error: "Server error" });
  }
});
router.get("/activity", requireAuth(), async (req, res) => {
  try {
    const { userId } = getAuth(req);
    if (!userId) {
      return res.status(401).json({ success: false, error: "Unauthorized" });
    }
    if (USE_CLERK) {
      const user = await User.findOne({ clerkId: userId });
      if (!user) {
        return res.status(404).json({ success: false, error: "User not found" });
      }
      return res.json({
        success: true,
        data: {
          recentActivity: user.activityLog.slice(-20).reverse(),
          totalAnalysisRuns: user.totalAnalysisRuns,
          totalExports: user.totalExports,
          lastLogin: user.lastLogin
        }
      });
    } else {
      const user = await UserModel.findById(userId);
      if (!user) {
        return res.status(404).json({ success: false, error: "User not found" });
      }
      return res.json({
        success: true,
        data: {
          recentActivity: [],
          totalAnalysisRuns: 0,
          totalExports: 0,
          lastLogin: user.lastLoginAt
        }
      });
    }
  } catch (error) {
    console.error("[UserRoutes] /activity error:", error);
    return res.status(500).json({ success: false, error: "Server error" });
  }
});
router.put("/admin/upgrade", requireAuth(), async (req, res) => {
  try {
    const { userId: adminUserId } = getAuth(req);
    if (!adminUserId) {
      return res.status(401).json({ success: false, error: "Unauthorized" });
    }
    const { isMasterUser: isMasterUser2 } = await import("../models.js");
    const clerkAdminUser = await User.findOne({ clerkId: adminUserId });
    const inHouseAdminUser = await UserModel.findById(adminUserId);
    const adminEmail = clerkAdminUser?.email || inHouseAdminUser?.email || null;
    if (!isMasterUser2(adminEmail)) {
      return res.status(403).json({ success: false, error: "Admin access required" });
    }
    const { email, tier } = req.body;
    if (!email || !tier) {
      return res.status(400).json({ success: false, error: "Email and tier are required" });
    }
    if (!["free", "pro", "enterprise"].includes(tier)) {
      return res.status(400).json({ success: false, error: "Invalid tier. Must be free, pro, or enterprise" });
    }
    let updated = false;
    const clerkUser = await User.findOne({ email: email.toLowerCase() });
    if (clerkUser) {
      await User.updateOne({ _id: clerkUser._id }, { $set: { tier } });
      updated = true;
      console.log(`[Admin] Updated Clerk user ${email} to tier: ${tier}`);
    }
    const inHouseUser = await UserModel.findOne({ email: email.toLowerCase() });
    if (inHouseUser) {
      await UserModel.updateOne({ _id: inHouseUser._id }, { $set: { subscriptionTier: tier } });
      updated = true;
      console.log(`[Admin] Updated in-house user ${email} to tier: ${tier}`);
    }
    if (!updated) {
      return res.status(404).json({ success: false, error: "User not found" });
    }
    return res.json({
      success: true,
      message: `User ${email} upgraded to ${tier}`
    });
  } catch (error) {
    console.error("[UserRoutes] /admin/upgrade error:", error);
    return res.status(500).json({ success: false, error: "Server error" });
  }
});
var userRoutes_default = router;
export {
  userRoutes_default as default
};
//# sourceMappingURL=userRoutes.js.map
