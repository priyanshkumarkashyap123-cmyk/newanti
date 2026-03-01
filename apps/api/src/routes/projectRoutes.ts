import express, { Request, Response, Router } from "express";
import { requireAuth, getAuth } from "../middleware/authMiddleware.js";
import { Project, User, IUser } from "../models.js";
import mongoose from "mongoose";
import { validateBody, createProjectSchema, updateProjectSchema } from "../middleware/validation.js";

const router: Router = express.Router();

// Middleware to require authentication
const authRequired = requireAuth();

// Sub-function to get or create Mongo User from Clerk ID
async function getMongoUser(clerkId: string, email?: string): Promise<IUser> {
  let user = await User.findOne({ clerkId });
  if (!user && email) {
    // Create user if not exists (JIT provisioning)
    user = await User.create({
      clerkId,
      email,
      tier: "free",
    });
  }
  if (!user) {
    throw new Error("User not found");
  }
  return user;
}

// GET / - List all projects for current user
router.get("/", authRequired, async (req: Request, res: Response) => {
  try {
    const { userId } = getAuth(req);
    const pageRaw = Number(req.query["page"] ?? 1);
    const pageSizeRaw = Number(req.query["pageSize"] ?? 20);
    const page =
      Number.isFinite(pageRaw) && pageRaw > 0 ? Math.floor(pageRaw) : 1;
    const pageSize = Number.isFinite(pageSizeRaw)
      ? Math.min(100, Math.max(1, Math.floor(pageSizeRaw)))
      : 20;

    if (!userId) {
      return res.fail('UNAUTHORIZED', 'Unauthorized', 401);
    }

    // Find user by Clerk ID
    const user = await User.findOne({ clerkId: userId });
    if (!user) {
      return res.ok({ projects: [], total: 0, page, pageSize });
    }

    // Find projects owned by or shared with this user
    const [projects, total] = await Promise.all([
      Project.find({ $or: [{ owner: user._id }, { collaborators: user._id }] })
        .select("name description thumbnail updatedAt createdAt isPublic")
        .sort({ updatedAt: -1 })
        .skip((page - 1) * pageSize)
        .limit(pageSize),
      Project.countDocuments({ $or: [{ owner: user._id }, { collaborators: user._id }] }),
    ]);

    return res.ok({ projects, total, page, pageSize, totalPages: Math.max(1, Math.ceil(total / pageSize)) });
  } catch (error) {
    console.error("Error fetching projects:", error);
    return res.fail('INTERNAL_ERROR', 'Internal server error');
  }
});

// GET /:id - Get specific project
router.get("/:id", authRequired, async (req: Request, res: Response) => {
  try {
    const { userId } = getAuth(req);
    const projectId = req.params.id;

    if (!mongoose.Types.ObjectId.isValid(projectId)) {
      return res.fail('INVALID_ID', 'Invalid project ID', 400);
    }

    const user = await User.findOne({ clerkId: userId });
    if (!user) {
      return res.fail('NOT_FOUND', 'User not found', 404);
    }

    const project = await Project.findOne({
      _id: projectId,
      $or: [{ owner: user._id }, { collaborators: user._id }],
    });

    if (!project) {
      return res.fail('NOT_FOUND', 'Project not found', 404);
    }

    return res.ok({ project });
  } catch (error) {
    console.error("Error fetching project:", error);
    return res.fail('INTERNAL_ERROR', 'Internal server error');
  }
});

// POST / - Create new project
router.post("/", authRequired, validateBody(createProjectSchema), async (req: Request, res: Response) => {
  try {
    const { userId } = getAuth(req);
    // Note: Clerk sometimes provides details in session claims, but we might rely on the DB
    // For JIT creation we assume the user already exists or we need email.
    // For now, fail if user not found in DB (should be created via webhook or login)

    const { name, description, data, thumbnail } = req.body;

    if (!name) {
      return res.fail('VALIDATION_ERROR', 'Project name is required', 400);
    }

    const user = await User.findOne({ clerkId: userId });
    if (!user) {
      return res.fail('NOT_FOUND', 'User profile not found. Please log in again.', 404);
    }

    const project = await Project.create({
      name,
      description,
      thumbnail,
      data: data || {},
      owner: user._id,
      isPublic: false,
    });

    // Add to user's project list
    await User.findByIdAndUpdate(user._id, {
      $push: { projects: project._id },
    });

    return res.ok({ project }, 201);
  } catch (error) {
    console.error("Error creating project:", error);
    return res.fail('INTERNAL_ERROR', 'Internal server error');
  }
});

// PUT /:id - Update project
router.put("/:id", authRequired, validateBody(updateProjectSchema), async (req: Request, res: Response) => {
  try {
    const { userId } = getAuth(req);
    const projectId = req.params.id;
    const { name, description, data, thumbnail } = req.body;

    if (!mongoose.Types.ObjectId.isValid(projectId)) {
      return res.fail('INVALID_ID', 'Invalid project ID', 400);
    }

    const user = await User.findOne({ clerkId: userId });
    if (!user) {
      return res.fail('NOT_FOUND', 'User not found', 404);
    }

    // Find and update
    const project = await Project.findOneAndUpdate(
      { _id: projectId, owner: user._id },
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
      return res.fail('NOT_FOUND', 'Project not found', 404);
    }

    return res.ok({ project });
  } catch (error) {
    console.error("Error updating project:", error);
    return res.fail('INTERNAL_ERROR', 'Internal server error');
  }
});

// DELETE /:id - Delete project
router.delete("/:id", authRequired, async (req: Request, res: Response) => {
  try {
    const { userId } = getAuth(req);
    const projectId = req.params.id;

    if (!mongoose.Types.ObjectId.isValid(projectId)) {
      return res.fail('INVALID_ID', 'Invalid project ID', 400);
    }

    const user = await User.findOne({ clerkId: userId });
    if (!user) {
      return res.fail('NOT_FOUND', 'User not found', 404);
    }

    const project = await Project.findOneAndDelete({
      _id: projectId,
      owner: user._id,
    });

    if (!project) {
      return res.fail('NOT_FOUND', 'Project not found', 404);
    }

    // Remove from user's list
    await User.findByIdAndUpdate(user._id, {
      $pull: { projects: project._id },
    });

    return res.ok({ id: projectId });
  } catch (error) {
    console.error("Error deleting project:", error);
    return res.fail('INTERNAL_ERROR', 'Internal server error');
  }
});

export default router;
