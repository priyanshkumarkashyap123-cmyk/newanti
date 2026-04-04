/**
 * Async Route Handler Wrapper
 *
 * Wraps Express async route handlers so that any thrown/rejected error
 * is automatically forwarded to Express's centralized error handler
 * via next(error) instead of crashing the process or being silently swallowed.
 *
 * Usage:
 *   router.get('/foo', asyncHandler(async (req, res) => { ... }));
 */

import { Request, Response, NextFunction, RequestHandler } from "express";

type AsyncRequestHandler = (
  req: Request,
  res: Response,
  next: NextFunction,
) => Promise<unknown> | unknown;

/**
 * Wrap an async Express handler so rejected promises call next(error).
 */
export function asyncHandler(fn: AsyncRequestHandler): RequestHandler {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = fn(req, res, next);
      if (result instanceof Promise) {
        result.catch(next);
      }
    } catch (err) {
      next(err);
    }
  };
}

/**
 * Create an error with an HTTP status code attached.
 */
export class HttpError extends Error {
  public readonly statusCode: number;
  public readonly code?: string;

  constructor(statusCode: number, message: string, code?: string) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.name = "HttpError";
  }
}

/**
 * Standardized success response helper.
 * Usage: sendSuccess(res, data) or sendSuccess(res, data, 201)
 */
export function sendSuccess<T>(res: Response, data: T, statusCode = 200): void {
  res.status(statusCode).json({
    success: true,
    data,
  });
}
