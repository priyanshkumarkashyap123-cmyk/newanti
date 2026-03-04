import express from "express";
import { requireAuth } from "../../middleware/authMiddleware.js";
import { generalRateLimit } from "../../middleware/security.js";
const router = express.Router();
const analyticsRateLimit = generalRateLimit;
const BUFFER_SIZE = 2e3;
const eventBuffer = [];
function pushEvent(event) {
  eventBuffer.push(event);
  if (eventBuffer.length > BUFFER_SIZE) eventBuffer.shift();
}
async function persistToMongo(event) {
  try {
    const mongoose = await import("mongoose");
    if (mongoose.default.connection.readyState !== 1) return false;
    const db = mongoose.default.connection.db;
    if (!db) return false;
    await db.collection("analytics_events").insertOne({
      ...event,
      _createdAt: /* @__PURE__ */ new Date()
    });
    return true;
  } catch {
    return false;
  }
}
router.post("/track", requireAuth(), analyticsRateLimit, async (req, res) => {
  const event = req.body;
  if (!event?.name || !event?.sessionId) {
    res.status(400).json({ success: false, error: "Missing name or sessionId" });
    return;
  }
  pushEvent(event);
  const persisted = await persistToMongo(event);
  res.status(202).json({ success: true, persisted });
});
router.post("/batch", requireAuth(), analyticsRateLimit, async (req, res) => {
  const events = req.body?.events;
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
router.get("/recent", requireAuth(), async (_req, res) => {
  res.json({
    success: true,
    count: eventBuffer.length,
    events: eventBuffer.slice(-100)
  });
});
router.get("/stats", requireAuth(), async (_req, res) => {
  const counts = {};
  for (const e of eventBuffer) {
    counts[e.name] = (counts[e.name] || 0) + 1;
  }
  const sessions = new Set(eventBuffer.map((e) => e.sessionId));
  res.json({
    success: true,
    totalEvents: eventBuffer.length,
    uniqueSessions: sessions.size,
    eventCounts: counts
  });
});
var analytics_default = router;
export {
  analytics_default as default
};
//# sourceMappingURL=index.js.map
