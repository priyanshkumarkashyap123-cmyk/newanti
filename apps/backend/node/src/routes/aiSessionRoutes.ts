/**
 * AI Session Routes
 * CRUD endpoints for syncing AI architect sessions to the cloud.
 * Allows users to persist their AI chat/generate/modify history.
 */

import express, { Request, Response, Router } from "express";
import { requireAuth, getAuth, isUsingClerk } from "../middleware/authMiddleware.js";
import { AISession, User, UserModel } from "../models/index.js";
import mongoose from "mongoose";
import { validateBody, createAiSessionSchema, updateAiSessionSchema } from "../middleware/validation.js";
import { asyncHandler, HttpError } from "../utils/asyncHandler.js";

const router: Router = express.Router();
const authRequired = requireAuth();

const MAX_BULK_SYNC = 50;
const MAX_MESSAGES_PER_SESSION = 400;
const MAX_MESSAGE_CONTENT_CHARS = 12000;
const MAX_SESSION_NAME_CHARS = 200;
const MAX_SNAPSHOT_BYTES = 512 * 1024;

type ResolvedUser = { _id: mongoose.Types.ObjectId };

function truncateText(value: string, limit: number): string {
  return value.length <= limit ? value : value.slice(0, limit);
}

function safeJsonSize(value: unknown): number {
  try {
    return Buffer.byteLength(JSON.stringify(value), 'utf8');
  } catch {
    return Number.MAX_SAFE_INTEGER;
  }
}

async function resolveUser(userId: string): Promise<ResolvedUser | null> {
  if (isUsingClerk()) {
    const user = await User.findOne({ clerkId: userId }).select('_id').lean();
    return user?._id ? ({ _id: user._id as mongoose.Types.ObjectId }) : null;
  }

  if (!mongoose.Types.ObjectId.isValid(userId)) {
    return null;
  }

  const user = await UserModel.findById(userId).select('_id').lean();
  return user?._id ? ({ _id: user._id as mongoose.Types.ObjectId }) : null;
}

function normalizeType(type: unknown): 'generate' | 'modify' | 'chat' {
  const candidate = typeof type === 'string' ? type : 'chat';
  if (candidate === 'generate' || candidate === 'modify' || candidate === 'chat') {
    return candidate;
  }
  return 'chat';
}

function sanitizeMessages(messages: unknown): Array<{ role: 'user' | 'assistant'; content: string; timestamp: Date; metadata?: Record<string, unknown> }> {
  if (!Array.isArray(messages)) return [];

  const output: Array<{ role: 'user' | 'assistant'; content: string; timestamp: Date; metadata?: Record<string, unknown> }> = [];

  for (const m of messages.slice(0, MAX_MESSAGES_PER_SESSION)) {
    if (!m || typeof m !== 'object') continue;

    const rawRole = (m as Record<string, unknown>).role;
    const role = rawRole === 'assistant' ? 'assistant' : 'user';
    const rawContent = typeof (m as Record<string, unknown>).content === 'string'
      ? (m as Record<string, unknown>).content as string
      : '';
    const content = truncateText(rawContent.trim(), MAX_MESSAGE_CONTENT_CHARS);
    if (!content) continue;

    const timestampRaw = (m as Record<string, unknown>).timestamp;
    const timestampDate = typeof timestampRaw === 'string' && !Number.isNaN(Date.parse(timestampRaw))
      ? new Date(timestampRaw)
      : new Date();

    const metadataRaw = (m as Record<string, unknown>).metadata;
    const metadata = metadataRaw && typeof metadataRaw === 'object'
      ? metadataRaw as Record<string, unknown>
      : undefined;

    output.push({ role, content, timestamp: timestampDate, metadata });
  }

  return output;
}

function sanitizeProjectSnapshot(snapshot: unknown): Record<string, unknown> | undefined {
  if (snapshot === undefined || snapshot === null) return undefined;
  if (typeof snapshot !== 'object' || Array.isArray(snapshot)) {
    throw new HttpError(400, 'projectSnapshot must be an object');
  }

  const bytes = safeJsonSize(snapshot);
  if (bytes > MAX_SNAPSHOT_BYTES) {
    throw new HttpError(413, `projectSnapshot exceeds size limit (${MAX_SNAPSHOT_BYTES} bytes)`);
  }

  return snapshot as Record<string, unknown>;
}

// ============================================
// GET / - List all AI sessions for current user
// ============================================
router.get("/", authRequired, asyncHandler(async (req: Request, res: Response) => {
  const { userId } = getAuth(req);
  if (!userId) {
    throw new HttpError(401, 'Unauthorized');
  }

  const user = await resolveUser(userId);
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
      .limit(pageSize)
      .lean(),
    AISession.countDocuments(query),
  ]);

  return res.ok({ sessions, total, page, pageSize, totalPages: Math.max(1, Math.ceil(total / pageSize)) });
}));

// ============================================
// GET /:id - Get a specific AI session
// ============================================
router.get("/:id", authRequired, asyncHandler(async (req: Request, res: Response) => {
  const { userId } = getAuth(req);
  if (!userId) {
    throw new HttpError(401, 'Unauthorized');
  }

  const sessionId = req.params.id;
  if (!mongoose.Types.ObjectId.isValid(sessionId)) {
    throw new HttpError(400, 'Invalid session ID');
  }

  const user = await resolveUser(userId);
  if (!user) {
    throw new HttpError(404, 'User not found');
  }

  const session = await AISession.findOne({
    _id: sessionId,
    owner: user._id,
  }).lean();

  if (!session) {
    throw new HttpError(404, 'Session not found');
  }

  return res.ok({ session });
}));

// ============================================
// POST / - Create or sync an AI session
// ============================================
router.post("/", authRequired, validateBody(createAiSessionSchema), asyncHandler(async (req: Request, res: Response) => {
  const { userId } = getAuth(req);
  if (!userId) {
    throw new HttpError(401, 'Unauthorized');
  }

  const user = await resolveUser(userId);
  if (!user) {
    throw new HttpError(404, 'User profile not found. Please log in again.');
  }

  const { name, type, messages, projectSnapshot } = req.body as {
    name?: string;
    type?: string;
    messages?: unknown;
    projectSnapshot?: unknown;
  };

  if (!name || !type) {
    throw new HttpError(400, 'Session name and type are required');
  }

  const safeName = truncateText(name.trim(), MAX_SESSION_NAME_CHARS);
  if (!safeName) {
    throw new HttpError(400, 'Session name cannot be empty');
  }

  const safeType = normalizeType(type);
  const safeMessages = sanitizeMessages(messages);
  const safeSnapshot = sanitizeProjectSnapshot(projectSnapshot);

  const session = new AISession({
    name: safeName,
    type: safeType,
    messages: safeMessages,
    owner: user._id,
    projectSnapshot: safeSnapshot,
    isArchived: false,
  });
  await session.save();

  return res.ok({ session }, 201);
}));

// ============================================
// POST /sync - Bulk sync sessions from client
// ============================================
router.post("/sync", authRequired, asyncHandler(async (req: Request, res: Response) => {
  const { userId } = getAuth(req);
  if (!userId) {
    throw new HttpError(401, 'Unauthorized');
  }

  const user = await resolveUser(userId);
  if (!user) {
    throw new HttpError(404, 'User not found');
  }

  const { sessions } = req.body;
  if (!Array.isArray(sessions)) {
    throw new HttpError(400, 'sessions must be an array');
  }

  // Limit bulk sync to 50 sessions at a time
  const toSync = sessions.slice(0, MAX_BULK_SYNC);
  const results: Array<{ clientId: string; cloudId: string }> = [];

  for (const clientSession of toSync) {
    const { clientId, name, type, messages, projectSnapshot } = clientSession as {
      clientId?: string;
      name?: string;
      type?: string;
      messages?: unknown;
      projectSnapshot?: unknown;
    };

    if (!name || !type) continue;

    const safeName = truncateText(name.trim(), MAX_SESSION_NAME_CHARS);
    if (!safeName) continue;

    const safeType = normalizeType(type);
    const safeMessages = sanitizeMessages(messages);
    const safeSnapshot = sanitizeProjectSnapshot(projectSnapshot);

    const session = new AISession({
      name: safeName,
      type: safeType,
      messages: safeMessages,
      owner: user._id,
      projectSnapshot: safeSnapshot,
      isArchived: false,
    });
    await session.save();

    results.push({
      clientId: clientId || String(session._id),
      cloudId: String(session._id),
    });
  }

  return res.ok({ synced: results.length, results });
}));

// ============================================
// PUT /:id - Update an AI session
// ============================================
router.put("/:id", authRequired, validateBody(updateAiSessionSchema), asyncHandler(async (req: Request, res: Response) => {
  const { userId } = getAuth(req);
  if (!userId) {
    throw new HttpError(401, 'Unauthorized');
  }

  const sessionId = req.params.id;
  if (!mongoose.Types.ObjectId.isValid(sessionId)) {
    throw new HttpError(400, 'Invalid session ID');
  }

  const user = await resolveUser(userId);
  if (!user) {
    throw new HttpError(404, 'User not found');
  }

  const session = await AISession.findOne({
    _id: sessionId,
    owner: user._id,
  });

  if (!session) {
    throw new HttpError(404, 'Session not found');
  }

  // Update allowed fields
  const { name, messages, projectSnapshot, isArchived } = req.body as {
    name?: string;
    messages?: unknown;
    projectSnapshot?: unknown;
    isArchived?: boolean;
  };

  if (name !== undefined) {
    const safeName = truncateText(String(name).trim(), MAX_SESSION_NAME_CHARS);
    if (!safeName) throw new HttpError(400, 'Session name cannot be empty');
    session.name = safeName;
  }
  if (messages !== undefined) session.messages = sanitizeMessages(messages);
  if (projectSnapshot !== undefined) session.projectSnapshot = sanitizeProjectSnapshot(projectSnapshot);
  if (isArchived !== undefined) session.isArchived = isArchived;

  await session.save();

  return res.ok({ session });
}));

// ============================================
// DELETE /:id - Delete an AI session
// ============================================
router.delete("/:id", authRequired, asyncHandler(async (req: Request, res: Response) => {
  const { userId } = getAuth(req);
  if (!userId) {
    throw new HttpError(401, 'Unauthorized');
  }

  const sessionId = req.params.id;
  if (!mongoose.Types.ObjectId.isValid(sessionId)) {
    throw new HttpError(400, 'Invalid session ID');
  }

  const user = await resolveUser(userId);
  if (!user) {
    throw new HttpError(404, 'User not found');
  }

  const result = await AISession.deleteOne({
    _id: sessionId,
    owner: user._id,
  });

  if (result.deletedCount === 0) {
    throw new HttpError(404, 'Session not found');
  }

  return res.ok({ message: "Session deleted" });
}));

export default router;
