/**
 * Unified response envelope middleware + helpers.
 *
 * Every API response from BeamLab Ultimate follows this contract:
 *
 * Success:
 *   { success: true,  data: T,    requestId: string, ts: string }
 *
 * Error (4xx / 5xx):
 *   { success: false, error: { code: string, message: string },
 *     requestId: string, ts: string }
 *
 * The `res.ok()` / `res.fail()` helpers are added to the Response
 * object via the `attachResponseHelpers` middleware so every handler
 * can use a consistent one-liner instead of constructing raw objects.
 */

import type { Request, Response, NextFunction } from 'express';

// ──────────────────────────────────────────
// Envelope types (shared with frontend via generated types)
// ──────────────────────────────────────────

export interface ApiSuccess<T = unknown> {
  success: true;
  data: T;
  requestId: string;
  ts: string;
}

export interface ApiError {
  success: false;
  error: {
    code: string;
    message: string;
  };
  requestId: string;
  ts: string;
}

export type ApiEnvelope<T = unknown> = ApiSuccess<T> | ApiError;

// ──────────────────────────────────────────
// Augment Express Response with helpers
// ──────────────────────────────────────────

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Response {
      /** Send a 2xx success envelope. Status defaults to 200. */
      ok<T>(data: T, status?: number): void;
      /** Send a 4xx/5xx error envelope. */
      fail(code: string, message: string, status?: number): void;
    }
  }
}

// ──────────────────────────────────────────
// Middleware
// ──────────────────────────────────────────

export function attachResponseHelpers(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const requestId =
    (res.locals['requestId'] as string | undefined) ??
    req.get('x-request-id') ??
    'unknown';

  res.ok = function <T>(data: T, status = 200): void {
    const envelope: ApiSuccess<T> = {
      success: true,
      data,
      requestId,
      ts: new Date().toISOString(),
    };
    this.status(status).json(envelope);
  };

  res.fail = function (
    code: string,
    message: string,
    status = 500
  ): void {
    const envelope: ApiError = {
      success: false,
      error: { code, message },
      requestId,
      ts: new Date().toISOString(),
    };
    this.status(status).json(envelope);
  };

  next();
}
