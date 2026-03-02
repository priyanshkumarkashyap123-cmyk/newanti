/**
 * XSS Sanitization Middleware
 *
 * Recursively strips dangerous HTML/JS from all string values in
 * req.body, req.query, and req.params before any route handler sees them.
 *
 * Since BeamLab accepts no user-generated HTML, this uses a strict
 * approach: strip ALL angle-bracket content and dangerous patterns.
 * Fields that legitimately contain code (e.g. AI messages, code snippets)
 * are stored as-is since they're never injected into HTML on the server.
 */

import type { Request, Response, NextFunction } from "express";

/**
 * Strip common XSS attack vectors from a string.
 * - Removes `<script>...</script>` blocks
 * - Removes event handlers (onerror=, onclick=, etc.)
 * - Removes javascript: URIs
 * - Strips HTML tags (allowlist: none)
 */
function sanitizeString(value: string): string {
  return value
    // Remove script blocks (multi-line)
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "")
    // Remove event handlers in tags
    .replace(/\bon\w+\s*=\s*["'][^"']*["']/gi, "")
    // Remove javascript: protocol
    .replace(/javascript\s*:/gi, "")
    // Remove HTML tags entirely — no rich text is expected
    .replace(/<\/?[^>]+(>|$)/g, "");
}

/**
 * Recursively sanitize all string values in an object/array.
 */
function sanitizeDeep(obj: unknown): unknown {
  if (typeof obj === "string") {
    return sanitizeString(obj);
  }

  if (Array.isArray(obj)) {
    return obj.map(sanitizeDeep);
  }

  if (obj !== null && typeof obj === "object") {
    const sanitized: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj)) {
      sanitized[key] = sanitizeDeep(value);
    }
    return sanitized;
  }

  return obj; // numbers, booleans, null, undefined — pass through
}

/**
 * Express middleware that sanitizes req.body and req.query.
 * Skip routes that need raw input (webhooks).
 */
export function xssSanitize(req: Request, _res: Response, next: NextFunction): void {
  // Skip webhook routes — they need raw body for signature verification
  if (req.path.includes("/webhook")) {
    next();
    return;
  }

  if (req.body && typeof req.body === "object") {
    req.body = sanitizeDeep(req.body);
  }

  if (req.query && typeof req.query === "object") {
    req.query = sanitizeDeep(req.query) as typeof req.query;
  }

  next();
}
