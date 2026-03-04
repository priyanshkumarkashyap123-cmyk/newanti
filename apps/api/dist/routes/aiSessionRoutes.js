import express from "express";
import { requireAuth, getAuth } from "../middleware/authMiddleware.js";
import { AISession, User } from "../models.js";
import mongoose from "mongoose";
const router = express.Router();
const authRequired = requireAuth();
router.get("/", authRequired, async (req, res) => {
  try {
    const { userId } = getAuth(req);
    if (!userId) {
      return res.status(401).json({ success: false, error: "Unauthorized" });
    }
    const user = await User.findOne({ clerkId: userId });
    if (!user) {
      return res.json({ success: true, sessions: [], total: 0 });
    }
    const pageRaw = Number(req.query["page"] ?? 1);
    const pageSizeRaw = Number(req.query["pageSize"] ?? 50);
    const page = Number.isFinite(pageRaw) && pageRaw > 0 ? Math.floor(pageRaw) : 1;
    const pageSize = Number.isFinite(pageSizeRaw) ? Math.min(100, Math.max(1, Math.floor(pageSizeRaw))) : 50;
    const typeFilter = req.query["type"];
    const includeArchived = req.query["includeArchived"] === "true";
    const query = { owner: user._id };
    if (typeFilter && ["generate", "modify", "chat"].includes(typeFilter)) {
      query["type"] = typeFilter;
    }
    if (!includeArchived) {
      query["isArchived"] = false;
    }
    const [sessions, total] = await Promise.all([
      AISession.find(query).select("name type messages updatedAt createdAt isArchived").sort({ updatedAt: -1 }).skip((page - 1) * pageSize).limit(pageSize),
      AISession.countDocuments(query)
    ]);
    return res.json({
      success: true,
      sessions,
      total,
      page,
      pageSize,
      totalPages: Math.max(1, Math.ceil(total / pageSize))
    });
  } catch (error) {
    console.error("Error fetching AI sessions:", error);
    return res.status(500).json({ success: false, error: "Internal server error" });
  }
});
router.get("/:id", authRequired, async (req, res) => {
  try {
    const { userId } = getAuth(req);
    if (!userId) {
      return res.status(401).json({ success: false, error: "Unauthorized" });
    }
    const sessionId = req.params.id;
    if (!mongoose.Types.ObjectId.isValid(sessionId)) {
      return res.status(400).json({ success: false, error: "Invalid session ID" });
    }
    const user = await User.findOne({ clerkId: userId });
    if (!user) {
      return res.status(404).json({ success: false, error: "User not found" });
    }
    const session = await AISession.findOne({
      _id: sessionId,
      owner: user._id
    });
    if (!session) {
      return res.status(404).json({ success: false, error: "Session not found" });
    }
    return res.json({ success: true, session });
  } catch (error) {
    console.error("Error fetching AI session:", error);
    return res.status(500).json({ success: false, error: "Internal server error" });
  }
});
router.post("/", authRequired, async (req, res) => {
  try {
    const { userId } = getAuth(req);
    if (!userId) {
      return res.status(401).json({ success: false, error: "Unauthorized" });
    }
    const user = await User.findOne({ clerkId: userId });
    if (!user) {
      return res.status(404).json({
        success: false,
        error: "User profile not found. Please log in again."
      });
    }
    const { name, type, messages, projectSnapshot } = req.body;
    if (!name || !type) {
      return res.status(400).json({ success: false, error: "Session name and type are required" });
    }
    if (!["generate", "modify", "chat"].includes(type)) {
      return res.status(400).json({
        success: false,
        error: "Type must be 'generate', 'modify', or 'chat'"
      });
    }
    const session = await AISession.create({
      name,
      type,
      messages: messages || [],
      owner: user._id,
      projectSnapshot: projectSnapshot || null,
      isArchived: false
    });
    return res.status(201).json({
      success: true,
      session
    });
  } catch (error) {
    console.error("Error creating AI session:", error);
    return res.status(500).json({ success: false, error: "Internal server error" });
  }
});
router.post("/sync", authRequired, async (req, res) => {
  try {
    const { userId } = getAuth(req);
    if (!userId) {
      return res.status(401).json({ success: false, error: "Unauthorized" });
    }
    const user = await User.findOne({ clerkId: userId });
    if (!user) {
      return res.status(404).json({ success: false, error: "User not found" });
    }
    const { sessions } = req.body;
    if (!Array.isArray(sessions)) {
      return res.status(400).json({ success: false, error: "sessions must be an array" });
    }
    const toSync = sessions.slice(0, 50);
    const results = [];
    for (const clientSession of toSync) {
      const { clientId, name, type, messages, projectSnapshot } = clientSession;
      if (!name || !type) continue;
      const session = await AISession.create({
        name,
        type: ["generate", "modify", "chat"].includes(type) ? type : "chat",
        messages: Array.isArray(messages) ? messages : [],
        owner: user._id,
        projectSnapshot: projectSnapshot || null,
        isArchived: false
      });
      results.push({
        clientId: clientId || session._id.toString(),
        cloudId: session._id.toString()
      });
    }
    return res.json({
      success: true,
      synced: results.length,
      results
    });
  } catch (error) {
    console.error("Error syncing AI sessions:", error);
    return res.status(500).json({ success: false, error: "Internal server error" });
  }
});
router.put("/:id", authRequired, async (req, res) => {
  try {
    const { userId } = getAuth(req);
    if (!userId) {
      return res.status(401).json({ success: false, error: "Unauthorized" });
    }
    const sessionId = req.params.id;
    if (!mongoose.Types.ObjectId.isValid(sessionId)) {
      return res.status(400).json({ success: false, error: "Invalid session ID" });
    }
    const user = await User.findOne({ clerkId: userId });
    if (!user) {
      return res.status(404).json({ success: false, error: "User not found" });
    }
    const session = await AISession.findOne({
      _id: sessionId,
      owner: user._id
    });
    if (!session) {
      return res.status(404).json({ success: false, error: "Session not found" });
    }
    const { name, messages, projectSnapshot, isArchived } = req.body;
    if (name !== void 0) session.name = name;
    if (messages !== void 0) session.messages = messages;
    if (projectSnapshot !== void 0) session.projectSnapshot = projectSnapshot;
    if (isArchived !== void 0) session.isArchived = isArchived;
    await session.save();
    return res.json({
      success: true,
      session
    });
  } catch (error) {
    console.error("Error updating AI session:", error);
    return res.status(500).json({ success: false, error: "Internal server error" });
  }
});
router.delete("/:id", authRequired, async (req, res) => {
  try {
    const { userId } = getAuth(req);
    if (!userId) {
      return res.status(401).json({ success: false, error: "Unauthorized" });
    }
    const sessionId = req.params.id;
    if (!mongoose.Types.ObjectId.isValid(sessionId)) {
      return res.status(400).json({ success: false, error: "Invalid session ID" });
    }
    const user = await User.findOne({ clerkId: userId });
    if (!user) {
      return res.status(404).json({ success: false, error: "User not found" });
    }
    const result = await AISession.deleteOne({
      _id: sessionId,
      owner: user._id
    });
    if (result.deletedCount === 0) {
      return res.status(404).json({ success: false, error: "Session not found" });
    }
    return res.json({ success: true, message: "Session deleted" });
  } catch (error) {
    console.error("Error deleting AI session:", error);
    return res.status(500).json({ success: false, error: "Internal server error" });
  }
});
var aiSessionRoutes_default = router;
export {
  aiSessionRoutes_default as default
};
//# sourceMappingURL=aiSessionRoutes.js.map
