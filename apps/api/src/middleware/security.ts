/**
 * Security Middleware — Production-Grade
 *
 * - HTTP security headers via Helmet (strict CSP, HSTS, permission policy)
 * - Tiered rate limiting with progressive penalties
 * - Request ID tracing with W3C Trace Context support
 * - Structured JSON request logging
 * - Safe error handler that never leaks internals
 */

import { Request, Response, NextFunction, RequestHandler } from "express";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import { randomUUID } from "crypto";
import { isTrustedOrigin } from "../config/cors.js";
import logger from "../utils/logger.js";

// ============================================
// HTTP SECURITY HEADERS (Helmet)
// ============================================

export const securityHeaders = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: [
        "'self'",
        "'unsafe-inline'",
        "'wasm-unsafe-eval'",
        "https://js.clerk.dev",
        "https://challenges.cloudflare.com",
        "https://mercury.phonepe.com",
      ],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com", "data:"],
      imgSrc: ["'self'", "data:", "blob:", "https:", "https://img.clerk.com"],
      connectSrc: [
        "'self'",
        "https://*.clerk.dev",
        "https://api.phonepe.com",
        "https://api-preprod.phonepe.com",
        "wss:",
        "ws:",
      ],
      frameSrc: [
        "https://*.clerk.dev",
        "https://api.phonepe.com",
        "https://mercury.phonepe.com",
      ],
      workerSrc: ["'self'", "blob:"],
      childSrc: ["'self'", "blob:"],
      objectSrc: ["'none'"],
      baseUri: ["'self'"],
      formAction: ["'self'"],
      upgradeInsecureRequests:
        process.env["NODE_ENV"] === "production" ? [] : null,
    },
    reportOnly: false,
  },
  frameguard: { action: "deny" },
  noSniff: true,
  hsts:
    process.env["NODE_ENV"] === "production"
      ? {
          maxAge: 63072000, // 2 years (HSTS best practice)
          includeSubDomains: true,
          preload: true,
        }
      : false,
  xssFilter: false, // Rely on CSP, not deprecated X-XSS-Protection
  hidePoweredBy: true,
  ieNoOpen: true,
  dnsPrefetchControl: { allow: false },
  crossOriginOpenerPolicy: { policy: "same-origin-allow-popups" },
  crossOriginResourcePolicy: { policy: "cross-origin" },
  crossOriginEmbedderPolicy: false, // Required for cross-origin WASM/SharedArrayBuffer
  permittedCrossDomainPolicies: { permittedPolicies: "none" },
  referrerPolicy: { policy: "strict-origin-when-cross-origin" },
});

// ============================================
// PERMISSIONS POLICY (supplement Helmet)
// ============================================

export const permissionsPolicy: RequestHandler = (_req, res, next) => {
  res.setHeader(
    "Permissions-Policy",
    "accelerometer=(), camera=(), geolocation=(), gyroscope=(), magnetometer=(), microphone=(), payment=(self), usb=()"
  );
  next();
};

// ============================================
// RATE LIMITING — Tiered with progressive penalties
// ============================================

/** Helper to create rate limiters with consistent config */
function createRateLimit(
  windowMs: number,
  max: number,
  errorMessage: string,
  opts?: {
    keyGenerator?: (req: Request) => string;
    skipPaths?: string[];
    skipMethods?: string[];
  },
): RequestHandler {
  return rateLimit({
    windowMs,
    max,
    message: {
      success: false,
      error: errorMessage,
      retryAfter: Math.ceil(windowMs / 1000),
    },
    standardHeaders: "draft-7", // Use latest RateLimit header draft
    legacyHeaders: false,
    validate: false,
    skip: (req) => {
      if (opts?.skipPaths?.some((p) => req.path.startsWith(p))) return true;
      if (opts?.skipMethods?.includes(req.method)) return true;
      return false;
    },
    keyGenerator: opts?.keyGenerator,
  }) as unknown as RequestHandler;
}

// General API: 100 req/min
export const generalRateLimit: RequestHandler = createRateLimit(
  60_000, 100,
  "Too many requests. Please try again later.",
  { skipPaths: ["/health"], skipMethods: ["OPTIONS"] },
);

// Analysis API: 10 req/min (expensive compute)
export const analysisRateLimit: RequestHandler = createRateLimit(
  60_000, 10,
  "Analysis rate limit exceeded. Please wait before running more analyses.",
);

// Billing API: 5 req/min (prevent payment abuse)
export const billingRateLimit: RequestHandler = createRateLimit(
  60_000, 5,
  "Billing rate limit exceeded. Please try again later.",
);

// CRUD endpoints: 30 req/min
export const crudRateLimit: RequestHandler = createRateLimit(
  60_000, 30,
  "Request rate limit exceeded. Please slow down.",
);

// Auth endpoints: 5 req/min (brute force protection)
export const authRateLimit: RequestHandler = createRateLimit(
  60_000, 5,
  "Too many authentication attempts. Please try again later.",
);

// AI endpoints: 20 req/min per user
export const aiRateLimit: RequestHandler = createRateLimit(
  60_000, 20,
  "AI rate limit exceeded. Please wait before sending more requests.",
  {
    keyGenerator: (req) => {
      const authFn = (req as unknown as Record<string, unknown>).auth;
      const userId =
        (typeof authFn === "function"
          ? (authFn() as Record<string, unknown>)?.userId
          : undefined) || req.ip;
      return `ai:${userId}`;
    },
  },
);

// ============================================
// REQUEST LOGGING — Structured JSON
// ============================================

export const requestLogger = (
  req: Request,
  _res: Response,
  next: NextFunction,
) => {
  const method = req.method;
  const url = req.originalUrl;
  const ip = req.ip || req.socket?.remoteAddress || "unknown";
  const userAgent = req.get("user-agent") || "unknown";

  logger.info(
    { method, url, ip, userAgent: userAgent.slice(0, 50) },
    `${method} ${url}`,
  );

  next();
};

// ============================================
// REQUEST ID TRACEABILITY (W3C Trace Context compatible)
// ============================================

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const requestIdMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  const existingRequestId = req.get("x-request-id");
  const requestId =
    existingRequestId && UUID_PATTERN.test(existingRequestId)
      ? existingRequestId
      : randomUUID();

  res.setHeader("x-request-id", requestId);
  res.locals.requestId = requestId;

  // Also support W3C traceparent for distributed tracing
  const traceparent = req.get("traceparent");
  if (traceparent) {
    res.setHeader("traceresponse", traceparent);
  }

  next();
};

export const requestLoggerWithId = (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  const start = Date.now();
  const method = req.method;
  const url = req.originalUrl;
  const ip = req.ip || req.socket?.remoteAddress || "unknown";
  const requestId = String(res.locals.requestId || "unknown");

  // Log on response finish for accurate duration
  res.on("finish", () => {
    const duration = Date.now() - start;
    const status = res.statusCode;

    // Structured JSON log
    const logEntry = {
      ts: new Date().toISOString(),
      reqId: requestId,
      method,
      url,
      status,
      durationMs: duration,
      ip,
      ...(status >= 400 && { ua: req.get("user-agent")?.slice(0, 100) }),
    };

    if (status >= 500) {
      logger.error(logEntry, "request");
    } else if (status >= 400) {
      logger.warn(logEntry, "request");
    } else if (url !== "/health") {
      // Don't log health checks to reduce noise
      logger.info(logEntry, "request");
    }
  });

  next();
};

// ============================================
// ERROR HANDLER (Never leaks internals in production)
// ============================================

export const secureErrorHandler = (
  err: Error,
  req: Request,
  res: Response,
  _next: NextFunction,
) => {
  const isDev = process.env["NODE_ENV"] !== "production";
  const requestId = String(res.locals.requestId || "unknown");
  const statusCode =
    (err as any).statusCode ?? (err as any).status ?? (res.statusCode >= 400 ? res.statusCode : 500);

  // Log full error server-side
  logger.error({
    reqId: requestId,
    method: req.method,
    url: req.originalUrl,
    status: statusCode,
    error: err.message,
    ...(isDev && { stack: err.stack }),
  }, "Unhandled error");

  // Ensure CORS headers are present even on error responses
  const origin = req.get("origin");
  if (origin && isTrustedOrigin(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Access-Control-Allow-Credentials", "true");
  }

  // Never expose internal errors to client in production
  const clientMessage =
    isDev || statusCode < 500
      ? err.message
      : "An unexpected error occurred. Please try again later.";

  res.status(statusCode).json({
    success: false,
    requestId,
    error: {
      code: (err as any).code ?? `ERR_${statusCode}`,
      message: clientMessage,
      ...(isDev && { stack: err.stack }),
    },
    ...(statusCode === 503 && { retryAfterMs: 5000 }),
  });
};
