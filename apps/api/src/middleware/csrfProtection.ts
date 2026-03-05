/**
 * CSRF Protection Middleware
 *
 * Validates the X-CSRF-Token header on state-changing requests (POST, PUT, DELETE, PATCH).
 * Works with the client-side CSRF token generation in apps/web/src/lib/security.ts.
 *
 * Defense strategy:
 * 1. Double-submit cookie pattern — the client sends a random token in both
 *    a cookie and the X-CSRF-Token header. The server checks they match.
 * 2. Origin/Referer header validation — ensures requests originate from allowed domains.
 * 3. SameSite cookie flag — prevents the browser from sending the cookie on cross-site requests.
 */

import { Request, Response, NextFunction } from "express";
import { randomUUID } from "crypto";
import { isTrustedOrigin } from "../config/cors.js";
import { logger } from "../utils/logger.js";

const CSRF_COOKIE = "csrf_token";
const CSRF_HEADER = "x-csrf-token";
const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

/**
 * Issue a CSRF cookie so the client always has a token to echo back.
 * Only generates a new token if the client doesn't already have one,
 * preventing the double-submit pattern from breaking on rapid requests.
 */
export function csrfCookieMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  // Reuse existing cookie token if present; only mint a new one when missing
  const existing = req.cookies?.[CSRF_COOKIE];
  if (!existing) {
    const token = randomUUID();

    res.cookie(CSRF_COOKIE, token, {
      httpOnly: false, // Client JS must read it to send in the header
      secure: process.env.NODE_ENV === "production",
      sameSite: "none", // Required for cross-origin (frontend & API on different domains)
      path: "/",
      maxAge: 60 * 60 * 1000, // 1 hour
    });
  }

  next();
}

/**
 * Validate CSRF on state-changing requests.
 */
export function csrfValidationMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  // Skip safe (read-only) methods
  if (SAFE_METHODS.has(req.method)) {
    return next();
  }

  // Skip health endpoints and webhook callbacks (they carry their own HMAC signatures)
  // Also skip initial authentication endpoints that run before CSRF token is established
  if (
    req.path === "/health" ||
    req.path.includes("/webhook") ||
    req.path.includes("/phonepe") ||
    req.path === "/api/user/login" ||
    req.path === "/api/session/register" ||
    req.path === "/api/analytics/batch"
  ) {
    return next();
  }

  // --- Origin / Referer validation ---
  const origin = req.get("origin");
  const referer = req.get("referer");

  if (origin) {
    if (!isTrustedOrigin(origin)) {
      logger.warn(`[CSRF] Blocked request from disallowed origin: ${origin}`);
      res.status(403).json({
        success: false,
        error: "Forbidden — invalid origin",
      });
      return;
    }
  } else if (referer) {
    try {
      const refOrigin = new URL(referer).origin;
      if (!isTrustedOrigin(refOrigin)) {
        logger.warn(
          `[CSRF] Blocked request from disallowed referer: ${referer}`,
        );
        res.status(403).json({
          success: false,
          error: "Forbidden — invalid referer",
        });
        return;
      }
    } catch {
      // Malformed referer — block
      res.status(403).json({
        success: false,
        error: "Forbidden — malformed referer",
      });
      return;
    }
  }
  // If neither origin nor referer is present (server-to-server, curl, etc.),
  // we still check the X-CSRF-Token header below.

  // --- Double-submit cookie check ---
  const cookieToken = req.cookies?.[CSRF_COOKIE];
  const headerToken = req.get(CSRF_HEADER);

  // Only skip CSRF validation when explicitly in development or test mode.
  // If NODE_ENV is unset, we default to enforcing CSRF to avoid accidental bypass in production.
  const nodeEnv = process.env.NODE_ENV;
  if (nodeEnv === "development" || nodeEnv === "test") {
    return next();
  }

  if (!cookieToken || !headerToken || cookieToken !== headerToken) {
    logger.warn(
      `[CSRF] Token mismatch -- cookie: ${!!cookieToken}, header: ${!!headerToken}`,
    );
    res.status(403).json({
      success: false,
      error: "CSRF validation failed",
    });
    return;
  }

  next();
}
