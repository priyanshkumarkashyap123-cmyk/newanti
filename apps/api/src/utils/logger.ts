/**
 * Structured Logger
 *
 * Production-grade structured JSON logging via pino.
 * - JSON output in production (machine-parseable for log aggregators)
 * - Pretty-printed in development
 * - Includes request context (requestId, method, url)
 * - Child loggers per request for automatic context propagation
 */

import pino from "pino";

const isProduction = process.env["NODE_ENV"] === "production";

export const logger = pino({
  level: process.env["LOG_LEVEL"] || (isProduction ? "info" : "debug"),
  // Production-safe JSON logging only; avoid transport resolution issues in bundled builds.
  formatters: {
    level: (label: string) => ({ level: label }),
  },
  timestamp: pino.stdTimeFunctions.isoTime,
  // Redact sensitive fields from logs
  redact: {
    paths: [
      "req.headers.authorization",
      "req.headers.cookie",
      "req.body.password",
      "req.body.token",
      "req.body.secret",
    ],
    censor: "[REDACTED]",
  },
});

/**
 * Create a child logger with request context.
 * Use in middleware to attach per-request context.
 */
export function createRequestLogger(requestId: string, method: string, url: string) {
  return logger.child({ requestId, method, url });
}

export default logger;
