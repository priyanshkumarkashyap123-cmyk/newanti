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

// In-memory ring buffer (used as fallback & for /recent endpoint)
const BUFFER_SIZE = 2000;
const eventBuffer: AnalyticsEvent[] = [];

function pushEvent(event: AnalyticsEvent) {
  eventBuffer.push(event);
  if (eventBuffer.length > BUFFER_SIZE) eventBuffer.shift();
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

// ============================================
// POST /api/analytics/track — ingest a single event
// ============================================

router.post("/track", requireAuth(), analyticsRateLimit, async (req: Request, res: Response) => {
  const event = req.body as AnalyticsEvent;

  if (!event?.name || !event?.sessionId) {
    res.fail('VALIDATION_ERROR', 'Missing name or sessionId', 400);
    return;
  }

  // Always keep in ring buffer
  pushEvent(event);

  // Best-effort persist to MongoDB
  const persisted = await persistToMongo(event);

  res.ok({ persisted }, 202);
});

// ============================================
// POST /api/analytics/batch — ingest multiple events
// ============================================

router.post("/batch", requireAuth(), analyticsRateLimit, async (req: Request, res: Response) => {
  const events = req.body?.events as AnalyticsEvent[] | undefined;

  if (!Array.isArray(events) || events.length === 0) {
    res.fail('VALIDATION_ERROR', 'events array required', 400);
    return;
  }

  let persisted = 0;
  for (const event of events.slice(0, 100)) {
    if (!event?.name || !event?.sessionId) continue;
    pushEvent(event);
    if (await persistToMongo(event)) persisted++;
  }

  res.ok({ accepted: events.length, persisted }, 202);
});

// ============================================
// GET /api/analytics/recent — view recent events (auth required)
// ============================================

router.get("/recent", requireAuth(), async (_req: Request, res: Response) => {
  res.ok({
    count: eventBuffer.length,
    events: eventBuffer.slice(-100),
  });
});

// ============================================
// GET /api/analytics/stats — aggregate stats (auth required)
// ============================================

router.get("/stats", requireAuth(), async (_req: Request, res: Response) => {
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
});

export default router;
