import helmet from "helmet";
import rateLimit from "express-rate-limit";
const securityHeaders = helmet({
  // Content Security Policy
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'", "https://js.clerk.dev", "https://challenges.cloudflare.com"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      imgSrc: ["'self'", "data:", "blob:", "https:"],
      connectSrc: ["'self'", "https://*.clerk.dev", "https://api.razorpay.com", "wss:", "ws:"],
      frameSrc: ["https://*.clerk.dev", "https://api.razorpay.com"],
      objectSrc: ["'none'"],
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
  // XSS filter
  xssFilter: true,
  // Hide X-Powered-By header
  hidePoweredBy: true,
  // Prevent IE from executing downloads
  ieNoOpen: true,
  // DNS prefetch control
  dnsPrefetchControl: { allow: false }
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
  skip: (req) => req.path === "/health"
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
const requestLogger = (req, _res, next) => {
  const timestamp = (/* @__PURE__ */ new Date()).toISOString();
  const method = req.method;
  const url = req.originalUrl;
  const ip = req.ip || req.connection.remoteAddress || "unknown";
  const userAgent = req.get("user-agent") || "unknown";
  console.log(`[${timestamp}] ${method} ${url} - IP: ${ip} - UA: ${userAgent.slice(0, 50)}`);
  next();
};
const secureErrorHandler = (err, _req, res, _next) => {
  console.error("[ERROR]", err.message);
  const isDev = process.env["NODE_ENV"] !== "production";
  res.status(500).json({
    success: false,
    error: isDev ? err.message : "Internal server error",
    ...isDev && { stack: err.stack }
  });
};
var security_default = {
  securityHeaders,
  generalRateLimit,
  analysisRateLimit,
  billingRateLimit,
  authRateLimit,
  requestLogger,
  secureErrorHandler
};
export {
  analysisRateLimit,
  authRateLimit,
  billingRateLimit,
  security_default as default,
  generalRateLimit,
  requestLogger,
  secureErrorHandler,
  securityHeaders
};
//# sourceMappingURL=security.js.map
