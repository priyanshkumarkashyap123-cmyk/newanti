/**
 * Analytics API Routes
 *
 * Ingests product analytics events from the frontend.
 * Stores them in MongoDB for later analysis / export.
 * Falls back to in-memory ring buffer when DB is unavailable.
 */

import express, { Router, type Request, type Response } from "express";
import { requireAuth } from "../../middleware/authMiddleware.js";
import { generalRateLimit } from "../../middleware/security.js";
import { asyncHandler, HttpError } from "../../utils/asyncHandler.js";

const router: Router = express.Router();

// Rate-limit the public-facing ingest endpoints to prevent abuse
const analyticsRateLimit = generalRateLimit; // re-use general limit (100/min per IP)

// ============================================
// TYPES
// ============================================

interface AnalyticsEvent {
  name: string;
  properties?: Record<string, unknown>;
  timestamp: string;
  sessionId: string;
  userId?: string;
}

const MAX_EVENT_NAME_CHARS = 80;
const MAX_SESSION_ID_CHARS = 128;
const MAX_USER_ID_CHARS = 128;
const MAX_PROPERTY_KEYS = 100;
const MAX_ARRAY_ITEMS = 100;
const MAX_STRING_VALUE_CHARS = 2000;
const MAX_EVENT_BYTES = 24 * 1024;

// In-memory ring buffer (used as fallback & for /recent endpoint)
const BUFFER_SIZE = 2000;
const eventBuffer: AnalyticsEvent[] = [];

function pushEvent(event: AnalyticsEvent) {
  eventBuffer.push(event);
  if (eventBuffer.length > BUFFER_SIZE) eventBuffer.shift();
}

function truncate(value: string, max: number): string {
  return value.length <= max ? value : value.slice(0, max);
}

function normalizeValue(value: unknown, depth: number = 0): unknown {
  if (depth > 5) return '[max-depth]';
  if (value === null || value === undefined) return null;

  if (typeof value === 'string') return truncate(value, MAX_STRING_VALUE_CHARS);
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value === 'boolean') return value;

  if (Array.isArray(value)) {
    return value.slice(0, MAX_ARRAY_ITEMS).map((item) => normalizeValue(item, depth + 1));
  }

  if (typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>).slice(0, MAX_PROPERTY_KEYS);
    const out: Record<string, unknown> = {};
    for (const [k, v] of entries) {
      out[truncate(String(k), 64)] = normalizeValue(v, depth + 1);
    }
    return out;
  }

  return String(value);
}

function normalizeEvent(input: unknown): AnalyticsEvent | null {
  if (!input || typeof input !== 'object') return null;

  const raw = input as Record<string, unknown>;
  if (typeof raw.name !== 'string' || !raw.name.trim()) return null;
  if (typeof raw.sessionId !== 'string' || !raw.sessionId.trim()) return null;

  const ts = typeof raw.timestamp === 'string' && !Number.isNaN(Date.parse(raw.timestamp))
    ? new Date(raw.timestamp).toISOString()
    : new Date().toISOString();

  const normalized: AnalyticsEvent = {
    name: truncate(raw.name.trim(), MAX_EVENT_NAME_CHARS),
    sessionId: truncate(raw.sessionId.trim(), MAX_SESSION_ID_CHARS),
    timestamp: ts,
  };

  if (typeof raw.userId === 'string' && raw.userId.trim()) {
    normalized.userId = truncate(raw.userId.trim(), MAX_USER_ID_CHARS);
  }

  if (raw.properties && typeof raw.properties === 'object' && !Array.isArray(raw.properties)) {
    normalized.properties = normalizeValue(raw.properties) as Record<string, unknown>;
  }

  const size = Buffer.byteLength(JSON.stringify(normalized), 'utf8');
  if (size > MAX_EVENT_BYTES) {
    return null;
  }

  return normalized;
}

// Helper: try to persist to MongoDB analytics collection
async function persistToMongo(event: AnalyticsEvent): Promise<boolean> {
  try {
    const mongoose = await import("mongoose");
    if (mongoose.default.connection.readyState !== 1) return false;

    const db = mongoose.default.connection.db;
    if (!db) return false;

    await db.collection("analytics_events").insertOne({
      ...event,
      _createdAt: new Date(),
    });
    return true;
  } catch {
    return false;
  }
}

async function persistBatchToMongo(events: AnalyticsEvent[]): Promise<number> {
  try {
    const mongoose = await import("mongoose");
    if (mongoose.default.connection.readyState !== 1) return 0;

    const db = mongoose.default.connection.db;
    if (!db || events.length === 0) return 0;

    const docs = events.map((event) => ({ ...event, _createdAt: new Date() }));
    const result = await db.collection("analytics_events").insertMany(docs, { ordered: false });
    return result.insertedCount ?? 0;
  } catch {
    return 0;
  }
}

// ============================================
// POST /api/analytics/track — ingest a single event
// ============================================

router.post("/track", requireAuth(), analyticsRateLimit, asyncHandler(async (req: Request, res: Response) => {
  const event = normalizeEvent(req.body);
  if (!event) {
    throw new HttpError(400, "Missing name or sessionId");
  }

  // Always keep in ring buffer
  pushEvent(event);

  // Best-effort persist to MongoDB
  const persisted = await persistToMongo(event);

  res.ok({ persisted }, 202);
}));

// ============================================
// POST /api/analytics/batch — ingest multiple events
// ============================================

router.post("/batch", requireAuth(), analyticsRateLimit, asyncHandler(async (req: Request, res: Response) => {
  const events = req.body?.events as unknown[] | undefined;

  if (!Array.isArray(events) || events.length === 0) {
    throw new HttpError(400, "events array required");
  }

  const normalized = events
    .slice(0, 100)
    .map(normalizeEvent)
    .filter((event): event is AnalyticsEvent => Boolean(event));

  if (normalized.length === 0) {
    throw new HttpError(400, "No valid events in batch");
  }

  for (const event of normalized) {
    pushEvent(event);
  }

  const persisted = await persistBatchToMongo(normalized);

  res.ok({ accepted: normalized.length, persisted }, 202);
}));

// ============================================
// GET /api/analytics/recent — view recent events (auth required)
// ============================================

router.get("/recent", requireAuth(), asyncHandler(async (_req: Request, res: Response) => {
  res.ok({
    count: eventBuffer.length,
    events: eventBuffer.slice(-100),
  });
}));

// ============================================
// GET /api/analytics/stats — aggregate stats (auth required)
// ============================================

router.get("/stats", requireAuth(), asyncHandler(async (_req: Request, res: Response) => {
  // Event counts by name
  const counts: Record<string, number> = {};
  for (const e of eventBuffer) {
    counts[e.name] = (counts[e.name] || 0) + 1;
  }

  // Unique sessions
  const sessions = new Set(eventBuffer.map((e) => e.sessionId));

  res.ok({
    totalEvents: eventBuffer.length,
    uniqueSessions: sessions.size,
    eventCounts: counts,
  });
}));

export default router;
