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

const CSRF_COOKIE = "csrf_token";
const CSRF_HEADER = "x-csrf-token";
const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

const ALLOWED_ORIGINS = [
  "https://beamlabultimate.tech",
  "https://www.beamlabultimate.tech",
  "https://brave-mushroom-0eae8ec00.4.azurestaticapps.net",
  "http://localhost:5173",
  "http://localhost:3000",
];

/**
 * Issue a CSRF cookie on every response so the client always has a token to echo back.
 */
export function csrfCookieMiddleware(
  _req: Request,
  res: Response,
  next: NextFunction,
): void {
  // Generate a fresh token for every response (rotate on each page load)
  const token = randomUUID();

  res.cookie(CSRF_COOKIE, token, {
    httpOnly: false, // Client JS must read it to send in the header
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: 60 * 60 * 1000, // 1 hour
  });

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
  if (
    req.path === "/health" ||
    req.path.includes("/webhook") ||
    req.path.includes("/razorpay")
  ) {
    return next();
  }

  // --- Origin / Referer validation ---
  const origin = req.get("origin");
  const referer = req.get("referer");

  if (origin) {
    if (!ALLOWED_ORIGINS.includes(origin)) {
      console.warn(`[CSRF] Blocked request from disallowed origin: ${origin}`);
      res.status(403).json({
        success: false,
        error: "Forbidden — invalid origin",
      });
      return;
    }
  } else if (referer) {
    try {
      const refOrigin = new URL(referer).origin;
      if (!ALLOWED_ORIGINS.includes(refOrigin)) {
        console.warn(
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

  // In dev, be lenient when cookies aren't available (http, not https)
  if (process.env.NODE_ENV !== "production") {
    return next();
  }

  if (!cookieToken || !headerToken || cookieToken !== headerToken) {
    console.warn(
      `[CSRF] Token mismatch — cookie: ${!!cookieToken}, header: ${!!headerToken}`,
    );
    res.status(403).json({
      success: false,
      error: "CSRF validation failed",
    });
    return;
  }

  next();
}
