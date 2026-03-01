/**
 * AI Session Routes
 * CRUD endpoints for syncing AI architect sessions to the cloud.
 * Allows users to persist their AI chat/generate/modify history.
 */

import express, { Request, Response, Router } from "express";
import { requireAuth, getAuth } from "../middleware/authMiddleware.js";
import { AISession, User } from "../models.js";
import mongoose from "mongoose";
import { validateBody, createAiSessionSchema, updateAiSessionSchema } from "../middleware/validation.js";

const router: Router = express.Router();
const authRequired = requireAuth();

// ============================================
// GET / - List all AI sessions for current user
// ============================================
router.get("/", authRequired, async (req: Request, res: Response) => {
  try {
    const { userId } = getAuth(req);
    if (!userId) {
      return res.fail('UNAUTHORIZED', 'Unauthorized', 401);
    }

    const user = await User.findOne({ clerkId: userId });
    if (!user) {
      return res.ok({ sessions: [], total: 0 });
    }

    const pageRaw = Number(req.query["page"] ?? 1);
    const pageSizeRaw = Number(req.query["pageSize"] ?? 50);
    const page =
      Number.isFinite(pageRaw) && pageRaw > 0 ? Math.floor(pageRaw) : 1;
    const pageSize = Number.isFinite(pageSizeRaw)
      ? Math.min(100, Math.max(1, Math.floor(pageSizeRaw)))
      : 50;

    const typeFilter = req.query["type"] as string | undefined;
    const includeArchived = req.query["includeArchived"] === "true";

    // Build query
    const query: Record<string, unknown> = { owner: user._id };
    if (typeFilter && ["generate", "modify", "chat"].includes(typeFilter)) {
      query["type"] = typeFilter;
    }
    if (!includeArchived) {
      query["isArchived"] = false;
    }

    const [sessions, total] = await Promise.all([
      AISession.find(query)
        .select("name type messages updatedAt createdAt isArchived")
        .sort({ updatedAt: -1 })
        .skip((page - 1) * pageSize)
        .limit(pageSize),
      AISession.countDocuments(query),
    ]);

    return res.ok({ sessions, total, page, pageSize, totalPages: Math.max(1, Math.ceil(total / pageSize)) });
  } catch (error) {
    console.error("Error fetching AI sessions:", error);
    return res.fail('INTERNAL_ERROR', 'Internal server error');
  }
});

// ============================================
// GET /:id - Get a specific AI session
// ============================================
router.get("/:id", authRequired, async (req: Request, res: Response) => {
  try {
    const { userId } = getAuth(req);
    if (!userId) {
      return res.fail('UNAUTHORIZED', 'Unauthorized', 401);
    }

    const sessionId = req.params.id;
    if (!mongoose.Types.ObjectId.isValid(sessionId)) {
      return res.fail('INVALID_ID', 'Invalid session ID', 400);
    }

    const user = await User.findOne({ clerkId: userId });
    if (!user) {
      return res.fail('NOT_FOUND', 'User not found', 404);
    }

    const session = await AISession.findOne({
      _id: sessionId,
      owner: user._id,
    });

    if (!session) {
      return res.fail('NOT_FOUND', 'Session not found', 404);
    }

    return res.ok({ session });
  } catch (error) {
    console.error("Error fetching AI session:", error);
    return res.fail('INTERNAL_ERROR', 'Internal server error');
  }
});

// ============================================
// POST / - Create or sync an AI session
// ============================================
router.post("/", authRequired, validateBody(createAiSessionSchema), async (req: Request, res: Response) => {
  try {
    const { userId } = getAuth(req);
    if (!userId) {
      return res.fail('UNAUTHORIZED', 'Unauthorized', 401);
    }

    const user = await User.findOne({ clerkId: userId });
    if (!user) {
      return res.fail('NOT_FOUND', 'User profile not found. Please log in again.', 404);
    }

    const { name, type, messages, projectSnapshot } = req.body;

    if (!name || !type) {
      return res.fail('VALIDATION_ERROR', 'Session name and type are required', 400);
    }

    if (!["generate", "modify", "chat"].includes(type)) {
      return res.fail('VALIDATION_ERROR', "Type must be 'generate', 'modify', or 'chat'", 400);
    }

    const session = await AISession.create({
      name,
      type,
      messages: messages || [],
      owner: user._id,
      projectSnapshot: projectSnapshot || null,
      isArchived: false,
    });

    return res.ok({ session }, 201);
  } catch (error) {
    console.error("Error creating AI session:", error);
    return res.fail('INTERNAL_ERROR', 'Internal server error');
  }
});

// ============================================
// POST /sync - Bulk sync sessions from client
// ============================================
router.post("/sync", authRequired, async (req: Request, res: Response) => {
  try {
    const { userId } = getAuth(req);
    if (!userId) {
      return res.fail('UNAUTHORIZED', 'Unauthorized', 401);
    }

    const user = await User.findOne({ clerkId: userId });
    if (!user) {
      return res.fail('NOT_FOUND', 'User not found', 404);
    }

    const { sessions } = req.body;
    if (!Array.isArray(sessions)) {
      return res.fail('VALIDATION_ERROR', 'sessions must be an array', 400);
    }

    // Limit bulk sync to 50 sessions at a time
    const toSync = sessions.slice(0, 50);
    const results: Array<{ clientId: string; cloudId: string }> = [];

    for (const clientSession of toSync) {
      const { clientId, name, type, messages, projectSnapshot } = clientSession;

      if (!name || !type) continue;

      const session = await AISession.create({
        name,
        type: ["generate", "modify", "chat"].includes(type) ? type : "chat",
        messages: Array.isArray(messages) ? messages : [],
        owner: user._id,
        projectSnapshot: projectSnapshot || null,
        isArchived: false,
      });

      results.push({
        clientId: clientId || session._id.toString(),
        cloudId: session._id.toString(),
      });
    }

    return res.ok({ synced: results.length, results });
  } catch (error) {
    console.error("Error syncing AI sessions:", error);
    return res.fail('INTERNAL_ERROR', 'Internal server error');
  }
});

// ============================================
// PUT /:id - Update an AI session
// ============================================
router.put("/:id", authRequired, validateBody(updateAiSessionSchema), async (req: Request, res: Response) => {
  try {
    const { userId } = getAuth(req);
    if (!userId) {
      return res.fail('UNAUTHORIZED', 'Unauthorized', 401);
    }

    const sessionId = req.params.id;
    if (!mongoose.Types.ObjectId.isValid(sessionId)) {
      return res.fail('INVALID_ID', 'Invalid session ID', 400);
    }

    const user = await User.findOne({ clerkId: userId });
    if (!user) {
      return res.fail('NOT_FOUND', 'User not found', 404);
    }

    const session = await AISession.findOne({
      _id: sessionId,
      owner: user._id,
    });

    if (!session) {
      return res.fail('NOT_FOUND', 'Session not found', 404);
    }

    // Update allowed fields
    const { name, messages, projectSnapshot, isArchived } = req.body;

    if (name !== undefined) session.name = name;
    if (messages !== undefined) session.messages = messages;
    if (projectSnapshot !== undefined) session.projectSnapshot = projectSnapshot;
    if (isArchived !== undefined) session.isArchived = isArchived;

    await session.save();

    return res.ok({ session });
  } catch (error) {
    console.error("Error updating AI session:", error);
    return res.fail('INTERNAL_ERROR', 'Internal server error');
  }
});

// ============================================
// DELETE /:id - Delete an AI session
// ============================================
router.delete("/:id", authRequired, async (req: Request, res: Response) => {
  try {
    const { userId } = getAuth(req);
    if (!userId) {
      return res.fail('UNAUTHORIZED', 'Unauthorized', 401);
    }

    const sessionId = req.params.id;
    if (!mongoose.Types.ObjectId.isValid(sessionId)) {
      return res.fail('INVALID_ID', 'Invalid session ID', 400);
    }

    const user = await User.findOne({ clerkId: userId });
    if (!user) {
      return res.fail('NOT_FOUND', 'User not found', 404);
    }

    const result = await AISession.deleteOne({
      _id: sessionId,
      owner: user._id,
    });

    if (result.deletedCount === 0) {
      return res.fail('NOT_FOUND', 'Session not found', 404);
    }

    return res.ok({ message: "Session deleted" });
  } catch (error) {
    console.error("Error deleting AI session:", error);
    return res.fail('INTERNAL_ERROR', 'Internal server error');
  }
});

export default router;
