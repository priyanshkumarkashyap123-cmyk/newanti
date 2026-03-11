import type { NextFunction, Request, RequestHandler, Response } from "express";
import logger from "../utils/logger.js";

function envInt(name: string, fallback: number): number {
  const value = process.env[name];
  if (!value) return fallback;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

type PendingEntry = {
  req: Request;
  res: Response;
  next: NextFunction;
  enqueuedAt: number;
  timeout: NodeJS.Timeout;
};

type GateState = {
  inFlight: number;
  pending: PendingEntry[];
};

function createBackpressureGate(
  gateName: string,
  maxInFlight: number,
  maxQueue: number,
  queueTimeoutMs: number,
): RequestHandler {
  const state: GateState = {
    inFlight: 0,
    pending: [],
  };

  const release = () => {
    state.inFlight = Math.max(0, state.inFlight - 1);
    drain();
  };

  const attachReleaseOnResponse = (res: Response) => {
    let released = false;
    const releaseOnce = () => {
      if (released) return;
      released = true;
      release();
    };
    res.once("finish", releaseOnce);
    res.once("close", releaseOnce);
  };

  const dispatch = (entry: PendingEntry) => {
    clearTimeout(entry.timeout);
    state.inFlight += 1;

    const waitMs = Date.now() - entry.enqueuedAt;
    entry.res.setHeader("X-Backpressure-Gate", gateName);
    entry.res.setHeader("X-Backpressure-Queue-Wait-Ms", String(waitMs));
    entry.res.setHeader("X-Backpressure-In-Flight", String(state.inFlight));

    attachReleaseOnResponse(entry.res);
    entry.next();
  };

  const drain = () => {
    while (state.inFlight < maxInFlight && state.pending.length > 0) {
      const nextEntry = state.pending.shift();
      if (!nextEntry) break;

      // If client disconnected while waiting, skip it.
      if (nextEntry.req.destroyed || nextEntry.res.writableEnded) {
        continue;
      }
      dispatch(nextEntry);
    }
  };

  return (req, res, next) => {
    if (maxInFlight <= 0) {
      return res.status(503).json({
        success: false,
        error: `Backpressure gate ${gateName} is disabled by configuration`,
        code: "BACKPRESSURE_DISABLED",
      });
    }

    // Fast path: immediate slot available
    if (state.inFlight < maxInFlight) {
      const entry: PendingEntry = {
        req,
        res,
        next,
        enqueuedAt: Date.now(),
        timeout: setTimeout(() => {
          // no-op: timeout cleared when dispatched immediately
        }, queueTimeoutMs),
      };
      return dispatch(entry);
    }

    // Queue full => reject quickly
    if (state.pending.length >= maxQueue) {
      logger.warn(
        {
          gate: gateName,
          inFlight: state.inFlight,
          queued: state.pending.length,
          method: req.method,
          path: req.originalUrl,
        },
        "Backpressure rejection: queue full",
      );

      return res.status(503).json({
        success: false,
        error: "Analysis system is currently saturated. Please retry shortly.",
        code: "BACKPRESSURE_QUEUE_FULL",
        retryAfterMs: 2000,
        queueDepth: state.pending.length,
        inFlight: state.inFlight,
      });
    }

    const enqueuedAt = Date.now();
    const timeout = setTimeout(() => {
      const idx = state.pending.findIndex((p) => p.req === req);
      if (idx >= 0) {
        state.pending.splice(idx, 1);
      }
      if (!res.headersSent) {
        res.status(503).json({
          success: false,
          error: "Analysis queue wait exceeded timeout. Please retry.",
          code: "BACKPRESSURE_QUEUE_TIMEOUT",
          retryAfterMs: 1500,
        });
      }
    }, queueTimeoutMs);

    // If client disconnects while queued, remove from queue.
    req.once("close", () => {
      const idx = state.pending.findIndex((p) => p.req === req);
      if (idx >= 0) {
        const entry = state.pending[idx];
        clearTimeout(entry.timeout);
        state.pending.splice(idx, 1);
      }
    });

    state.pending.push({ req, res, next, enqueuedAt, timeout });

    res.setHeader("X-Backpressure-Gate", gateName);
    res.setHeader("X-Backpressure-Queued", "true");
    res.setHeader("X-Backpressure-Queue-Depth", String(state.pending.length));
  };
}

const ANALYSIS_MAX_IN_FLIGHT = envInt("ANALYSIS_MAX_IN_FLIGHT", 20);
const ANALYSIS_MAX_QUEUE = envInt("ANALYSIS_MAX_QUEUE", 150);
const ANALYSIS_QUEUE_TIMEOUT_MS = envInt("ANALYSIS_QUEUE_TIMEOUT_MS", 45_000);

const ADVANCED_MAX_IN_FLIGHT = envInt("ADVANCED_MAX_IN_FLIGHT", 10);
const ADVANCED_MAX_QUEUE = envInt("ADVANCED_MAX_QUEUE", 80);
const ADVANCED_QUEUE_TIMEOUT_MS = envInt("ADVANCED_QUEUE_TIMEOUT_MS", 60_000);

// Design lane: lighter compute than advanced, heavier than CRUD
const DESIGN_MAX_IN_FLIGHT = envInt("DESIGN_MAX_IN_FLIGHT", 15);
const DESIGN_MAX_QUEUE = envInt("DESIGN_MAX_QUEUE", 100);
const DESIGN_QUEUE_TIMEOUT_MS = envInt("DESIGN_QUEUE_TIMEOUT_MS", 45_000);

// AI lane: strictly isolated — GPU/LLM calls are unpredictable in duration
const AI_MAX_IN_FLIGHT = envInt("AI_MAX_IN_FLIGHT", 5);
const AI_MAX_QUEUE = envInt("AI_MAX_QUEUE", 50);
const AI_QUEUE_TIMEOUT_MS = envInt("AI_QUEUE_TIMEOUT_MS", 30_000);

export const analysisBackpressure: RequestHandler = createBackpressureGate(
  "analysis",
  ANALYSIS_MAX_IN_FLIGHT,
  ANALYSIS_MAX_QUEUE,
  ANALYSIS_QUEUE_TIMEOUT_MS,
);

export const advancedBackpressure: RequestHandler = createBackpressureGate(
  "advanced",
  ADVANCED_MAX_IN_FLIGHT,
  ADVANCED_MAX_QUEUE,
  ADVANCED_QUEUE_TIMEOUT_MS,
);

export const designBackpressure: RequestHandler = createBackpressureGate(
  "design",
  DESIGN_MAX_IN_FLIGHT,
  DESIGN_MAX_QUEUE,
  DESIGN_QUEUE_TIMEOUT_MS,
);

export const aiBackpressure: RequestHandler = createBackpressureGate(
  "ai",
  AI_MAX_IN_FLIGHT,
  AI_MAX_QUEUE,
  AI_QUEUE_TIMEOUT_MS,
);
