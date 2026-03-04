import helmet from "helmet";
import rateLimit from "express-rate-limit";
import { randomUUID } from "crypto";
const securityHeaders = helmet({
  // Content Security Policy
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: [
        "'self'",
        "'unsafe-inline'",
        "'wasm-unsafe-eval'",
        "https://js.clerk.dev",
        "https://challenges.cloudflare.com"
      ],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      imgSrc: ["'self'", "data:", "blob:", "https:"],
      connectSrc: [
        "'self'",
        "https://*.clerk.dev",
        "https://api.razorpay.com",
        "wss:",
        "ws:"
      ],
      frameSrc: ["https://*.clerk.dev", "https://api.razorpay.com"],
      workerSrc: ["'self'", "blob:"],
      objectSrc: ["'none'"],
      baseUri: ["'self'"],
      formAction: ["'self'"],
      upgradeInsecureRequests: []
    }
  },
  // Prevent clickjacking
  frameguard: { action: "deny" },
  // Prevent MIME type sniffing
  noSniff: true,
  // Force HTTPS (disable in development)
  hsts: process.env["NODE_ENV"] === "production" ? {
    maxAge: 31536e3,
    // 1 year
    includeSubDomains: true,
    preload: true
  } : false,
  // Disable X-XSS-Protection (modern best practice — rely on CSP instead)
  xssFilter: false,
  // Hide X-Powered-By header
  hidePoweredBy: true,
  // Prevent IE from executing downloads
  ieNoOpen: true,
  // DNS prefetch control
  dnsPrefetchControl: { allow: false },
  // Cross-Origin policies
  // API server must allow cross-origin access from the frontend.
  // same-origin-allow-popups: Support Clerk auth popups.
  // cross-origin CORP: API responses must be loadable by the cross-origin frontend.
  crossOriginOpenerPolicy: { policy: "same-origin-allow-popups" },
  crossOriginResourcePolicy: { policy: "cross-origin" },
  // Permissions Policy (restrict browser features)
  permittedCrossDomainPolicies: { permittedPolicies: "none" }
});
const generalRateLimit = rateLimit({
  windowMs: 60 * 1e3,
  // 1 minute
  max: 100,
  message: {
    success: false,
    error: "Too many requests, please try again later.",
    retryAfter: 60
  },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => req.path === "/health" || req.method === "OPTIONS"
});
const analysisRateLimit = rateLimit({
  windowMs: 60 * 1e3,
  max: 10,
  message: {
    success: false,
    error: "Analysis rate limit exceeded. Please wait before running more analyses.",
    retryAfter: 60
  },
  standardHeaders: true,
  legacyHeaders: false
});
const billingRateLimit = rateLimit({
  windowMs: 60 * 1e3,
  max: 5,
  message: {
    success: false,
    error: "Billing rate limit exceeded. Please try again later.",
    retryAfter: 60
  },
  standardHeaders: true,
  legacyHeaders: false
});
const crudRateLimit = rateLimit({
  windowMs: 60 * 1e3,
  max: 30,
  message: {
    success: false,
    error: "Request rate limit exceeded for data endpoints. Please slow down.",
    retryAfter: 60
  },
  standardHeaders: true,
  legacyHeaders: false
});
const authRateLimit = rateLimit({
  windowMs: 60 * 1e3,
  max: 5,
  message: {
    success: false,
    error: "Too many auth attempts. Please try again later.",
    retryAfter: 60
  },
  standardHeaders: true,
  legacyHeaders: false
});
const aiRateLimit = rateLimit({
  windowMs: 60 * 1e3,
  max: 20,
  message: {
    success: false,
    error: "AI rate limit exceeded. Please wait before sending more requests.",
    retryAfter: 60
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    const authFn = req.auth;
    const userId = (typeof authFn === "function" ? authFn()?.userId : void 0) || req.ip;
    return `ai:${userId}`;
  }
});
const requestLogger = (req, _res, next) => {
  const timestamp = (/* @__PURE__ */ new Date()).toISOString();
  const method = req.method;
  const url = req.originalUrl;
  const ip = req.ip || req.socket?.remoteAddress || "unknown";
  const userAgent = req.get("user-agent") || "unknown";
  console.log(
    `[${timestamp}] ${method} ${url} - IP: ${ip} - UA: ${userAgent.slice(0, 50)}`
  );
  next();
};
const requestIdMiddleware = (req, res, next) => {
  const existingRequestId = req.get("x-request-id");
  const requestId = existingRequestId && existingRequestId.trim().length > 0 ? existingRequestId : randomUUID();
  res.setHeader("x-request-id", requestId);
  res.locals.requestId = requestId;
  next();
};
const requestLoggerWithId = (req, res, next) => {
  const timestamp = (/* @__PURE__ */ new Date()).toISOString();
  const method = req.method;
  const url = req.originalUrl;
  const ip = req.ip || req.socket.remoteAddress || "unknown";
  const userAgent = req.get("user-agent") || "unknown";
  const requestId = String(res.locals.requestId || "unknown");
  console.log(
    `[${timestamp}] [${requestId}] ${method} ${url} - IP: ${ip} - UA: ${userAgent.slice(0, 50)}`
  );
  next();
};
const secureErrorHandler = (err, req, res, _next) => {
  console.error("[ERROR]", err.message);
  const origin = req.get("origin");
  if (origin) {
    const normalizeOrigin = (o) => o.trim().replace(/\/+$/, "").toLowerCase();
    const allowed = [
      "https://beamlabultimate.tech",
      "https://www.beamlabultimate.tech",
      "https://brave-mushroom-0eae8ec00.4.azurestaticapps.net",
      "http://localhost:5173",
      "http://localhost:3000"
    ];
    const normalized = normalizeOrigin(origin);
    const isTrusted = allowed.includes(normalized) || /^https:\/\/([a-z0-9-]+\.)*beamlabultimate\.tech$/i.test(normalized);
    if (isTrusted) {
      res.setHeader("Access-Control-Allow-Origin", origin);
      res.setHeader("Access-Control-Allow-Credentials", "true");
    }
  }
  const isDev = process.env["NODE_ENV"] !== "production";
  const requestId = String(res.locals.requestId || "unknown");
  res.status(500).json({
    success: false,
    requestId,
    error: isDev ? err.message : "Internal server error",
    ...isDev && { stack: err.stack }
  });
};
export {
  aiRateLimit,
  analysisRateLimit,
  authRateLimit,
  billingRateLimit,
  crudRateLimit,
  generalRateLimit,
  requestIdMiddleware,
  requestLogger,
  requestLoggerWithId,
  secureErrorHandler,
  securityHeaders
};
//# sourceMappingURL=security.js.map
