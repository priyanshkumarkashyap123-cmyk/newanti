import express, { Request, Response, Router } from "express";
import { requireAuth, getAuth } from "../middleware/authMiddleware.js";
import { crudRateLimit } from "../middleware/security.js";
import { Project, User, UserModel, IUser, CollaborationInvite } from "../models.js";
import mongoose from "mongoose";
import { validateBody, createProjectSchema, updateProjectSchema } from "../middleware/validation.js";
import { asyncHandler, HttpError } from "../utils/asyncHandler.js";
import { QuotaService } from "../services/quotaService.js";
import { projectCreationRateLimiter } from "../middleware/quotaRateLimiter.js";

const router: Router = express.Router();

// Check which auth mode is active
const USE_CLERK = process.env['USE_CLERK'] === 'true';

// Middleware to require authentication
const authRequired = requireAuth();

// Rate limiting on mutations
router.post("/{*path}", crudRateLimit);
router.put("/{*path}", crudRateLimit);
router.delete("/{*path}", crudRateLimit);

/**
 * Resolve the DB user from auth context.
 * Supports both Clerk and in-house auth modes.
 */
async function resolveUser(userId: string): Promise<IUser | null> {
  if (USE_CLERK) {
    return User.findOne({ clerkId: userId }).lean();
  }
  // In-house auth: userId is the DB _id
  if (mongoose.Types.ObjectId.isValid(userId)) {
    const user = await UserModel.findById(userId).lean();
    return user as unknown as IUser | null;
  }
  return null;
}

// GET / - List all projects for current user
router.get("/", authRequired, asyncHandler(async (req: Request, res: Response) => {
  const { userId } = getAuth(req);
  const pageRaw = Number(req.query["page"] ?? 1);
  const pageSizeRaw = Number(req.query["pageSize"] ?? 20);
  const page =
    Number.isFinite(pageRaw) && pageRaw > 0 ? Math.floor(pageRaw) : 1;
  const pageSize = Number.isFinite(pageSizeRaw)
    ? Math.min(100, Math.max(1, Math.floor(pageSizeRaw)))
    : 20;

  if (!userId) {
    throw new HttpError(401, 'Unauthorized');
  }

  // Find user by auth ID
  const user = await resolveUser(userId!);
  if (!user) {
    return res.ok({ projects: [], total: 0, page, pageSize });
  }

  // Find projects owned by or shared with this user
  const [projects, total] = await Promise.all([
    Project.find({ $or: [{ owner: user._id }, { collaborators: user._id }] })
      .select("name description thumbnail updatedAt createdAt isPublic")
      .sort({ updatedAt: -1 })
      .skip((page - 1) * pageSize)
      .limit(pageSize)
      .lean(),
    Project.countDocuments({ $or: [{ owner: user._id }, { collaborators: user._id }] }),
  ]);

  return res.ok({ projects, total, page, pageSize, totalPages: Math.max(1, Math.ceil(total / pageSize)) });
}));

// GET /:id - Get specific project
router.get("/:id", authRequired, asyncHandler(async (req: Request, res: Response) => {
  const { userId } = getAuth(req);
  const projectId = req.params.id;

  if (!mongoose.Types.ObjectId.isValid(projectId)) {
    throw new HttpError(400, 'Invalid project ID');
  }

  const user = await resolveUser(userId!);
  if (!user) {
    throw new HttpError(404, 'User not found');
  }

  // Check if user is owner or has an accepted collaboration invite
  const [project, collaborationInvite] = await Promise.all([
    Project.findOne({
      _id: projectId,
      $or: [{ owner: user._id }, { collaborators: user._id }],
    }).lean(),
    CollaborationInvite.findOne({
      projectId,
      inviteeId: user._id,
      status: 'accepted',
    }).lean(),
  ]);

  if (!project && !collaborationInvite) {
    throw new HttpError(404, 'Project not found');
  }

  // If only found via collaboration invite, fetch the project directly
  const finalProject = project ?? await Project.findById(projectId).lean();
  if (!finalProject) {
    throw new HttpError(404, 'Project not found');
  }

  return res.ok({ project: finalProject });
}));

// POST / - Create new project
router.post("/", authRequired, projectCreationRateLimiter(), validateBody(createProjectSchema), asyncHandler(async (req: Request, res: Response) => {
  const { userId } = getAuth(req);
  // Note: Clerk sometimes provides details in session claims, but we might rely on the DB
  // For JIT creation we assume the user already exists or we need email.
  // For now, fail if user not found in DB (should be created via webhook or login)

  const { name, description, data, thumbnail } = req.body;

  if (!name) {
    throw new HttpError(400, 'Project name is required');
  }

  const user = await resolveUser(userId!);
  if (!user) {
    throw new HttpError(404, 'User profile not found. Please log in again.');
  }

  const project = await Project.create({
    name,
    description,
    thumbnail,
    data: data || {},
    owner: user._id,
    isPublic: false,
  });

  // Increment quota counter for project creation
  await QuotaService.incrementProjects(userId!);

  // Add to user's project list
  await User.findByIdAndUpdate(user._id, {
    $push: { projects: project._id },
  });

  return res.ok({ project }, 201);
}));

// PUT /:id - Update project
router.put("/:id", authRequired, validateBody(updateProjectSchema), asyncHandler(async (req: Request, res: Response) => {
  const { userId } = getAuth(req);
  const projectId = req.params.id;
  const { name, description, data, thumbnail } = req.body;

  if (!mongoose.Types.ObjectId.isValid(projectId)) {
    throw new HttpError(400, 'Invalid project ID');
  }

  const user = await resolveUser(userId!);
  if (!user) {
    throw new HttpError(404, 'User not found');
  }

  // Check if user is owner or accepted collaborator
  const collaborationInvite = await CollaborationInvite.findOne({
    projectId,
    inviteeId: user._id,
    status: 'accepted',
  }).lean();

  const query = collaborationInvite
    ? { _id: projectId } // collaborator can update any project they have accepted invite for
    : { _id: projectId, owner: user._id }; // owner-only check

  // Find and update
  const project = await Project.findOneAndUpdate(
    query,
    {
      $set: {
        ...(name && { name }),
        ...(description && { description }),
        ...(data && { data }),
        ...(thumbnail && { thumbnail }),
        updatedAt: new Date(),
      },
    },
    { new: true },
  );

  if (!project) {
    throw new HttpError(404, 'Project not found');
  }

  return res.ok({ project });
}));

// DELETE /:id - Delete project
router.delete("/:id", authRequired, asyncHandler(async (req: Request, res: Response) => {
  const { userId } = getAuth(req);
  const projectId = req.params.id;

  if (!mongoose.Types.ObjectId.isValid(projectId)) {
    throw new HttpError(400, 'Invalid project ID');
  }

  const user = await resolveUser(userId!);
  if (!user) {
    throw new HttpError(404, 'User not found');
  }

  const project = await Project.findOneAndDelete({
    _id: projectId,
    owner: user._id,
  });

  if (!project) {
    throw new HttpError(404, 'Project not found');
  }

  // Remove from user's list
  await User.findByIdAndUpdate(user._id, {
    $pull: { projects: project._id },
  });

  return res.ok({ id: projectId });
}));

export default router;
