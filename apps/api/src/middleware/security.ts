/**
 * Security Middleware
 *
 * HTTP security headers, rate limiting, and request logging
 */

import { Request, Response, NextFunction, RequestHandler } from "express";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import { randomUUID } from "crypto";

// ============================================
// HTTP SECURITY HEADERS (Helmet)
// ============================================

export const securityHeaders = helmet({
  // Content Security Policy
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: [
        "'self'",
        "'unsafe-inline'",
        "'unsafe-eval'",
        "https://js.clerk.dev",
        "https://challenges.cloudflare.com",
      ],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      imgSrc: ["'self'", "data:", "blob:", "https:"],
      connectSrc: [
        "'self'",
        "https://*.clerk.dev",
        "https://api.razorpay.com",
        "wss:",
        "ws:",
      ],
      frameSrc: ["https://*.clerk.dev", "https://api.razorpay.com"],
      objectSrc: ["'none'"],
      upgradeInsecureRequests: [],
    },
  },
  // Prevent clickjacking
  frameguard: { action: "deny" },
  // Prevent MIME type sniffing
  noSniff: true,
  // Force HTTPS (disable in development)
  hsts:
    process.env["NODE_ENV"] === "production"
      ? {
          maxAge: 31536000, // 1 year
          includeSubDomains: true,
          preload: true,
        }
      : false,
  // XSS filter
  xssFilter: true,
  // Hide X-Powered-By header
  hidePoweredBy: true,
  // Prevent IE from executing downloads
  ieNoOpen: true,
  // DNS prefetch control
  dnsPrefetchControl: { allow: false },
});

// ============================================
// RATE LIMITING
// ============================================

// General API rate limit: 100 requests per minute
export const generalRateLimit: RequestHandler = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 100,
  message: {
    success: false,
    error: "Too many requests, please try again later.",
    retryAfter: 60,
  },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => req.path === "/health",
}) as unknown as RequestHandler;

// Analysis API rate limit: 10 requests per minute
export const analysisRateLimit: RequestHandler = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  message: {
    success: false,
    error:
      "Analysis rate limit exceeded. Please wait before running more analyses.",
    retryAfter: 60,
  },
  standardHeaders: true,
  legacyHeaders: false,
}) as unknown as RequestHandler;

// Billing API rate limit: 5 requests per minute (prevent abuse)
export const billingRateLimit: RequestHandler = rateLimit({
  windowMs: 60 * 1000,
  max: 5,
  message: {
    success: false,
    error: "Billing rate limit exceeded. Please try again later.",
    retryAfter: 60,
  },
  standardHeaders: true,
  legacyHeaders: false,
}) as unknown as RequestHandler;

// CRUD/API data endpoints rate limit: 30 requests per minute
export const crudRateLimit: RequestHandler = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  message: {
    success: false,
    error: "Request rate limit exceeded for data endpoints. Please slow down.",
    retryAfter: 60,
  },
  standardHeaders: true,
  legacyHeaders: false,
}) as unknown as RequestHandler;

// Auth endpoints rate limit: 5 requests per minute (prevent brute force)
export const authRateLimit: RequestHandler = rateLimit({
  windowMs: 60 * 1000,
  max: 5,
  message: {
    success: false,
    error: "Too many auth attempts. Please try again later.",
    retryAfter: 60,
  },
  standardHeaders: true,
  legacyHeaders: false,
}) as unknown as RequestHandler;

// AI API rate limit: 20 requests per minute (prevent abuse)
export const aiRateLimit: RequestHandler = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  message: {
    success: false,
    error: "AI rate limit exceeded. Please wait before sending more requests.",
    retryAfter: 60,
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    // Rate limit per user if authenticated, otherwise by IP
    const userId = (req as any).auth?.userId || req.ip;
    return `ai:${userId}`;
  },
}) as unknown as RequestHandler;

// ============================================
// REQUEST LOGGING
// ============================================

export const requestLogger = (
  req: Request,
  _res: Response,
  next: NextFunction,
) => {
  const timestamp = new Date().toISOString();
  const method = req.method;
  const url = req.originalUrl;
  const ip = req.ip || req.connection.remoteAddress || "unknown";
  const userAgent = req.get("user-agent") || "unknown";

  // Log request (in production, send to logging service)
  console.log(
    `[${timestamp}] ${method} ${url} - IP: ${ip} - UA: ${userAgent.slice(0, 50)}`,
  );

  next();
};

// ============================================
// REQUEST ID TRACEABILITY
// ============================================

export const requestIdMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  const existingRequestId = req.get("x-request-id");
  const requestId =
    existingRequestId && existingRequestId.trim().length > 0
      ? existingRequestId
      : randomUUID();

  res.setHeader("x-request-id", requestId);
  res.locals.requestId = requestId;
  next();
};

export const requestLoggerWithId = (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  const timestamp = new Date().toISOString();
  const method = req.method;
  const url = req.originalUrl;
  const ip = req.ip || req.socket.remoteAddress || "unknown";
  const userAgent = req.get("user-agent") || "unknown";
  const requestId = String(res.locals.requestId || "unknown");

  console.log(
    `[${timestamp}] [${requestId}] ${method} ${url} - IP: ${ip} - UA: ${userAgent.slice(0, 50)}`,
  );

  next();
};

// ============================================
// ERROR HANDLER (Hide stack traces in production)
// ============================================

export const secureErrorHandler = (
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction,
) => {
  console.error("[ERROR]", err.message);

  // Don't expose internal errors to client
  const isDev = process.env["NODE_ENV"] !== "production";
  const requestId = String(res.locals.requestId || "unknown");

  res.status(500).json({
    success: false,
    requestId,
    error: isDev ? err.message : "Internal server error",
    ...(isDev && { stack: err.stack }),
  });
};

// ============================================
// EXPORTS (individual exports already above - default export removed for type compatibility)
// ============================================
