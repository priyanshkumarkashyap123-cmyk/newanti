/**
 * Analytics API Routes
 *
 * Ingests product analytics events from the frontend.
 * Stores them in MongoDB for later analysis / export.
 * Falls back to in-memory ring buffer when DB is unavailable.
 */

import express, { Router, type Request, type Response } from "express";
import { requireAuth } from "../../middleware/authMiddleware.js";

const router: Router = express.Router();

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

router.post("/track", async (req: Request, res: Response) => {
  const event = req.body as AnalyticsEvent;

  if (!event?.name || !event?.sessionId) {
    res
      .status(400)
      .json({ success: false, error: "Missing name or sessionId" });
    return;
  }

  // Always keep in ring buffer
  pushEvent(event);

  // Best-effort persist to MongoDB
  const persisted = await persistToMongo(event);

  res.status(202).json({ success: true, persisted });
});

// ============================================
// POST /api/analytics/batch — ingest multiple events
// ============================================

router.post("/batch", async (req: Request, res: Response) => {
  const events = req.body?.events as AnalyticsEvent[] | undefined;

  if (!Array.isArray(events) || events.length === 0) {
    res.status(400).json({ success: false, error: "events array required" });
    return;
  }

  let persisted = 0;
  for (const event of events.slice(0, 100)) {
    if (!event?.name || !event?.sessionId) continue;
    pushEvent(event);
    if (await persistToMongo(event)) persisted++;
  }

  res.status(202).json({ success: true, accepted: events.length, persisted });
});

// ============================================
// GET /api/analytics/recent — view recent events (auth required)
// ============================================

router.get("/recent", requireAuth(), async (_req: Request, res: Response) => {
  res.json({
    success: true,
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

  res.json({
    success: true,
    totalEvents: eventBuffer.length,
    uniqueSessions: sessions.size,
    eventCounts: counts,
  });
});

export default router;
