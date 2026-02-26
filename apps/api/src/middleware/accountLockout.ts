/**
 * Account Lockout Middleware
 *
 * Tracks failed authentication attempts per IP and per email.
 * After exceeding the threshold, the account is temporarily locked.
 *
 * This is a defense-in-depth measure on top of rate limiting.
 * Rate limiting caps requests per minute; lockout caps cumulative failures.
 */

import { Request, Response, NextFunction } from "express";

interface LockoutEntry {
  failures: number;
  lockedUntil: number | null;
  lastAttempt: number;
}

const MAX_FAILURES = 10; // Lock after 10 consecutive failures
const LOCKOUT_DURATION_MS = 15 * 60 * 1000; // 15 minutes
const DECAY_WINDOW_MS = 60 * 60 * 1000; // Reset counter after 1 hour of no failures

// In-memory store (sufficient for single-instance; use Redis for multi-instance)
const lockoutStore = new Map<string, LockoutEntry>();

// Periodic cleanup (every 5 minutes)
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of lockoutStore.entries()) {
    // Remove entries that have expired lockout AND no recent failures
    if (
      (!entry.lockedUntil || entry.lockedUntil < now) &&
      now - entry.lastAttempt > DECAY_WINDOW_MS
    ) {
      lockoutStore.delete(key);
    }
  }
}, 5 * 60 * 1000);

/**
 * Extract lockout key from the request.
 * Uses IP + email (from body) for login attempts, IP-only for others.
 */
function getLockoutKey(req: Request): string {
  const ip = req.ip || req.socket.remoteAddress || "unknown";
  const email =
    typeof req.body?.email === "string" ? req.body.email.toLowerCase() : "";
  return email ? `${ip}:${email}` : `ip:${ip}`;
}

/**
 * Middleware to check if the account/IP is currently locked out.
 * Apply this BEFORE auth routes.
 */
export function checkLockout(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const key = getLockoutKey(req);
  const entry = lockoutStore.get(key);

  if (!entry) {
    return next();
  }

  // Check if still locked
  if (entry.lockedUntil && entry.lockedUntil > Date.now()) {
    const retryAfterSec = Math.ceil(
      (entry.lockedUntil - Date.now()) / 1000,
    );
    console.warn(
      `[LOCKOUT] Blocked attempt from ${key} — locked for ${retryAfterSec}s more`,
    );

    res.status(429).json({
      success: false,
      error:
        "Account temporarily locked due to too many failed attempts. Please try again later.",
      retryAfter: retryAfterSec,
    });
    return;
  }

  // Check if failures decayed
  if (Date.now() - entry.lastAttempt > DECAY_WINDOW_MS) {
    lockoutStore.delete(key);
  }

  next();
}

/**
 * Record a failed authentication attempt. Call this from your auth route
 * when credentials are invalid.
 */
export function recordAuthFailure(req: Request): void {
  const key = getLockoutKey(req);
  const entry = lockoutStore.get(key) || {
    failures: 0,
    lockedUntil: null,
    lastAttempt: Date.now(),
  };

  entry.failures += 1;
  entry.lastAttempt = Date.now();

  if (entry.failures >= MAX_FAILURES) {
    entry.lockedUntil = Date.now() + LOCKOUT_DURATION_MS;
    console.warn(
      `[LOCKOUT] Account locked: ${key} after ${entry.failures} failures (${LOCKOUT_DURATION_MS / 60000} min)`,
    );
  }

  lockoutStore.set(key, entry);
}

/**
 * Reset failure counter after a successful authentication.
 */
export function resetAuthFailures(req: Request): void {
  const key = getLockoutKey(req);
  lockoutStore.delete(key);
}
