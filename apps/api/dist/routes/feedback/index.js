import { Router } from "express";
import { requireAuth } from "../../middleware/authMiddleware.js";
const router = Router();
router.use(requireAuth());
const feedbackStore = [];
router.post("/", async (req, res) => {
  try {
    const { type, feature, originalInput, originalOutput, correctedOutput, rating, comment, sessionId } = req.body;
    if (!type || !feature || !sessionId) {
      return res.status(400).json({
        success: false,
        error: "Missing required fields: type, feature, sessionId"
      });
    }
    const entry = {
      id: `fb_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: /* @__PURE__ */ new Date(),
      type,
      feature,
      sessionId,
      userId: req.auth?.userId,
      originalInput: originalInput || "",
      originalOutput,
      correctedOutput,
      rating,
      comment,
      processed: false
    };
    feedbackStore.push(entry);
    if (feedbackStore.length > 1e4) {
      feedbackStore.shift();
    }
    console.log(`[Feedback] ${type} received for ${feature}`);
    return res.json({
      success: true,
      id: entry.id
    });
  } catch (error) {
    console.error("[Feedback] Error:", error);
    return res.status(500).json({
      success: false,
      error: "Failed to submit feedback"
    });
  }
});
router.get("/stats", async (_req, res) => {
  const corrections = feedbackStore.filter((e) => e.type === "correction");
  const ratings = feedbackStore.filter((e) => e.type === "rating" && e.rating);
  const avgRating = ratings.length > 0 ? ratings.reduce((sum, e) => sum + (e.rating || 0), 0) / ratings.length : 0;
  const byFeature = {};
  const byType = {};
  for (const entry of feedbackStore) {
    byFeature[entry.feature] = (byFeature[entry.feature] || 0) + 1;
    byType[entry.type] = (byType[entry.type] || 0) + 1;
  }
  return res.json({
    success: true,
    stats: {
      total: feedbackStore.length,
      corrections: corrections.length,
      averageRating: avgRating,
      byFeature,
      byType,
      pendingProcessing: feedbackStore.filter((e) => !e.processed).length
    }
  });
});
router.post("/export", async (_req, res) => {
  const corrections = feedbackStore.filter(
    (e) => e.type === "correction" && e.correctedOutput && !e.processed
  );
  const trainingData = {
    version: "1.0",
    exportDate: (/* @__PURE__ */ new Date()).toISOString(),
    count: corrections.length,
    entries: corrections.map((e) => ({
      input: e.originalInput,
      originalOutput: e.originalOutput,
      correctedOutput: e.correctedOutput,
      feature: e.feature,
      timestamp: e.timestamp
    }))
  };
  corrections.forEach((c) => {
    c.processed = true;
  });
  console.log(`[Feedback] Exported ${corrections.length} corrections for training`);
  return res.json({
    success: true,
    data: trainingData
  });
});
router.get("/recent", async (req, res) => {
  const limit = Math.min(parseInt(req.query["limit"]) || 50, 100);
  const recent = feedbackStore.slice(-limit).reverse();
  return res.json({
    success: true,
    entries: recent.map((e) => ({
      id: e.id,
      type: e.type,
      feature: e.feature,
      rating: e.rating,
      timestamp: e.timestamp,
      hasCorrection: !!e.correctedOutput
    }))
  });
});
var feedback_default = router;
export {
  feedback_default as default
};
//# sourceMappingURL=index.js.map
