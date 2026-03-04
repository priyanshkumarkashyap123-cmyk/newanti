import express from "express";
import { requireAuth, getAuth } from "../middleware/authMiddleware.js";
import { Project, User } from "../models.js";
import mongoose from "mongoose";
const router = express.Router();
const authRequired = requireAuth();
async function getMongoUser(clerkId, email) {
  let user = await User.findOne({ clerkId });
  if (!user && email) {
    user = await User.create({
      clerkId,
      email,
      tier: "free"
    });
  }
  if (!user) {
    throw new Error("User not found");
  }
  return user;
}
router.get("/", authRequired, async (req, res) => {
  try {
    const { userId } = getAuth(req);
    const pageRaw = Number(req.query["page"] ?? 1);
    const pageSizeRaw = Number(req.query["pageSize"] ?? 20);
    const page = Number.isFinite(pageRaw) && pageRaw > 0 ? Math.floor(pageRaw) : 1;
    const pageSize = Number.isFinite(pageSizeRaw) ? Math.min(100, Math.max(1, Math.floor(pageSizeRaw))) : 20;
    if (!userId) {
      return res.status(401).json({ success: false, error: "Unauthorized" });
    }
    const user = await User.findOne({ clerkId: userId });
    if (!user) {
      return res.json({
        success: true,
        projects: [],
        total: 0,
        page,
        pageSize
      });
    }
    const [projects, total] = await Promise.all([
      Project.find({ owner: user._id }).select("name description thumbnail updatedAt createdAt isPublic").sort({ updatedAt: -1 }).skip((page - 1) * pageSize).limit(pageSize),
      Project.countDocuments({ owner: user._id })
    ]);
    return res.json({
      success: true,
      projects,
      total,
      page,
      pageSize,
      totalPages: Math.max(1, Math.ceil(total / pageSize))
    });
  } catch (error) {
    console.error("Error fetching projects:", error);
    return res.status(500).json({ success: false, error: "Internal server error" });
  }
});
router.get("/:id", authRequired, async (req, res) => {
  try {
    const { userId } = getAuth(req);
    const projectId = req.params.id;
    if (!mongoose.Types.ObjectId.isValid(projectId)) {
      return res.status(400).json({ success: false, error: "Invalid project ID" });
    }
    const user = await User.findOne({ clerkId: userId });
    if (!user) {
      return res.status(404).json({ success: false, error: "User not found" });
    }
    const project = await Project.findOne({
      _id: projectId,
      owner: user._id
    });
    if (!project) {
      return res.status(404).json({ success: false, error: "Project not found" });
    }
    return res.json({
      success: true,
      project
    });
  } catch (error) {
    console.error("Error fetching project:", error);
    return res.status(500).json({ success: false, error: "Internal server error" });
  }
});
router.post("/", authRequired, async (req, res) => {
  try {
    const { userId } = getAuth(req);
    const { name, description, data, thumbnail } = req.body;
    if (!name) {
      return res.status(400).json({ success: false, error: "Project name is required" });
    }
    const user = await User.findOne({ clerkId: userId });
    if (!user) {
      return res.status(404).json({
        success: false,
        error: "User profile not found. Please log in again."
      });
    }
    const project = await Project.create({
      name,
      description,
      thumbnail,
      data: data || {},
      owner: user._id,
      isPublic: false
    });
    await User.findByIdAndUpdate(user._id, {
      $push: { projects: project._id },
      $inc: { totalAnalysisRuns: 1 }
    });
    return res.json({
      success: true,
      project
    });
  } catch (error) {
    console.error("Error creating project:", error);
    return res.status(500).json({ success: false, error: "Internal server error" });
  }
});
router.put("/:id", authRequired, async (req, res) => {
  try {
    const { userId } = getAuth(req);
    const projectId = req.params.id;
    const { name, description, data, thumbnail } = req.body;
    if (!mongoose.Types.ObjectId.isValid(projectId)) {
      return res.status(400).json({ success: false, error: "Invalid project ID" });
    }
    const user = await User.findOne({ clerkId: userId });
    if (!user) {
      return res.status(404).json({ success: false, error: "User not found" });
    }
    const project = await Project.findOneAndUpdate(
      { _id: projectId, owner: user._id },
      {
        $set: {
          ...name && { name },
          ...description && { description },
          ...data && { data },
          ...thumbnail && { thumbnail },
          updatedAt: /* @__PURE__ */ new Date()
        }
      },
      { new: true }
    );
    if (!project) {
      return res.status(404).json({ success: false, error: "Project not found" });
    }
    return res.json({
      success: true,
      project
    });
  } catch (error) {
    console.error("Error updating project:", error);
    return res.status(500).json({ success: false, error: "Internal server error" });
  }
});
router.delete("/:id", authRequired, async (req, res) => {
  try {
    const { userId } = getAuth(req);
    const projectId = req.params.id;
    if (!mongoose.Types.ObjectId.isValid(projectId)) {
      return res.status(400).json({ success: false, error: "Invalid project ID" });
    }
    const user = await User.findOne({ clerkId: userId });
    if (!user) {
      return res.status(404).json({ success: false, error: "User not found" });
    }
    const project = await Project.findOneAndDelete({
      _id: projectId,
      owner: user._id
    });
    if (!project) {
      return res.status(404).json({ success: false, error: "Project not found" });
    }
    await User.findByIdAndUpdate(user._id, {
      $pull: { projects: project._id }
    });
    return res.json({
      success: true,
      id: projectId
    });
  } catch (error) {
    console.error("Error deleting project:", error);
    return res.status(500).json({ success: false, error: "Internal server error" });
  }
});
var projectRoutes_default = router;
export {
  projectRoutes_default as default
};
//# sourceMappingURL=projectRoutes.js.map
