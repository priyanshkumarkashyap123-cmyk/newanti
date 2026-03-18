import express, {
  type Request,
  type Response,
  type RequestHandler,
} from "express";
import cors from "cors";
import compression from "compression";
import cookieParser from "cookie-parser";
import { createServer } from "http";
import { clerkMiddleware } from "@clerk/express";
// Validate environment FIRST — crashes in production if critical vars are missing
import { env } from "./config/env.js";
import { SocketServer } from "./SocketServer.js";
import analysisRouter from "./routes/analysis/index.js";
import designRouter from "./routes/design/index.js";
import advancedRouter from "./routes/advanced/index.js";
import interopRouter from "./routes/interop/index.js";
import templateRouter from "./routes/templates/index.js";
import jobsRouter from "./routes/jobs/index.js";
import publicLandingRoutes from "./routes/publicLandingRoutes.js";
import authRouter from "./routes/authRoutes.js";
import userRoutes from "./routes/userRoutes.js";
import projectRoutes from "./routes/projectRoutes.js";
import collaborationRoutes from "./routes/collaborationRoutes.js";
import subscriptionRoutes from "./routes/subscriptionRoutes.js";
import { startQuotaResetCron } from "./jobs/quotaResetCron.js";
import consentRoutes from "./routes/consentRoutes.js";
import auditRoutes from "./routes/audit/index.js";
import analyticsRouter from "./routes/analytics/index.js";
import aiSessionRoutes from "./routes/aiSessionRoutes.js";
import aiRoutes from "./routes/ai/index.js";
import feedbackRoutes from "./routes/feedback/index.js";
import sessionRoutes from "./routes/sessionRoutes.js";
import usageRoutes from "./routes/usageRoutes.js";
import { billingRouter } from "./phonepe.js";
import gpuJobsRouter from "./routes/gpujobs/index.js";
import swaggerUi from "swagger-ui-express";
import { connectDB } from "./models.js";
import {
  authMiddleware as inHouseAuthMiddleware,
  isUsingClerk,
  requireAuth,
} from "./middleware/authMiddleware.js";
import {
  securityHeaders,
  generalRateLimit,
  analysisRateLimit,
  crudRateLimit,
  billingRateLimit,
  authRateLimit,
  requestIdMiddleware,
  requestLoggerWithId,
  secureErrorHandler,
  costWeightedRateLimit,
} from "./middleware/security.js";
import {
  analysisBackpressure,
  advancedBackpressure,
  designBackpressure,
  aiBackpressure,
} from "./middleware/backpressure.js";
import {
  csrfCookieMiddleware,
  csrfValidationMiddleware,
} from "./middleware/csrfProtection.js";
import { checkLockout } from "./middleware/accountLockout.js";
import { attachResponseHelpers } from "./middleware/response.js";
import { logger } from "./utils/logger.js";
import * as Sentry from "@sentry/node";

// Initialize Sentry (profiling is optional — may not be available in bundled builds)
if (process.env.SENTRY_DSN) {
  const integrations: any[] = [];
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    integrations,
    // Performance Monitoring (20% sample to control costs)
    tracesSampleRate: 0.2,
    // Set sampling rate for profiling - this is relative to tracesSampleRate
    profilesSampleRate: 0.1,
  });
}

const app = express();
const PORT = process.env["PORT"] ?? 3001;
console.log("[STARTUP] BeamLab API starting on port", PORT);

const openApiSpec = {
  openapi: "3.0.3",
  info: {
    title: "BeamLab Ultimate Node API",
    version: process.env.npm_package_version || "2.1.0",
    description:
      "Authentication, project, billing, and collaboration APIs for BeamLab Ultimate.",
  },
  servers: [
    { url: "/api", description: "Legacy API base path" },
    { url: "/api/v1", description: "Versioned API base path" },
  ],
  paths: {
    "/health": {
      get: {
        summary: "Service health check",
        responses: {
          "200": { description: "Service healthy" },
          "503": { description: "Service degraded" },
        },
      },
    },
    "/auth/signup": {
      post: {
        summary: "Register a new user account",
        responses: {
          "201": { description: "User created" },
          "400": { description: "Validation failed" },
          "409": { description: "Email already exists" },
        },
      },
    },
    "/auth/signin": {
      post: {
        summary: "Authenticate user and return tokens",
        responses: {
          "200": { description: "Signed in" },
          "401": { description: "Invalid credentials" },
        },
      },
    },
    "/project": {
      get: {
        summary: "List projects for current user",
        responses: {
          "200": { description: "Project list" },
          "401": { description: "Unauthorized" },
        },
      },
    },
    "/billing/create-order": {
      post: {
        summary: "Create payment order",
        responses: {
          "200": {
            description: "Order created with orderId, amount, currency, keyId",
          },
          "429": { description: "Rate limited" },
          "503": { description: "Payment service unavailable" },
        },
      },
    },
  },
} as const;

// Respect reverse proxy headers in hosted environments (Azure, Nginx, etc.)
app.set("trust proxy", 1);

// Create HTTP server for socket.io
const httpServer = createServer(app);

// Initialize Socket.IO server
const socketServer = new SocketServer(httpServer);

// ============================================
// CORS — MUST be the absolute first middleware so that
// every response (including errors) carries CORS headers.
// ============================================

import { getAllowedOrigins, isTrustedOrigin } from "./config/cors.js";

const ALLOWED_ORIGINS = getAllowedOrigins();
const ALLOWED_ORIGIN_SET = new Set(ALLOWED_ORIGINS);

const corsOptions: cors.CorsOptions = {
  origin: (origin, callback) => {
    // Allow requests without Origin header (health checks, monitoring, server-to-server, etc.)
    if (!origin) {
      return callback(null, true);
    }
    // Check if origin is in allowed list
    if (isTrustedOrigin(origin)) {
      return callback(null, true);
    }
    // Log blocked origins for debugging but still send CORS headers
    // (returning false = no Access-Control-Allow-Origin, but won't throw into error handler)
    logger.warn(`CORS blocked origin: ${origin}`);
    return callback(null, false);
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
  allowedHeaders: [
    "Content-Type",
    "Authorization",
    "X-Request-ID",
    "X-CSRF-Token",
    "Cache-Control",
    "sentry-trace",
    "baggage",
    "x-device-id",
  ],
  exposedHeaders: ["X-Request-ID"],
  optionsSuccessStatus: 204,
};

// Preflight + all requests — BEFORE everything else
// Express 5 requires named wildcard parameter instead of bare "*"
app.options("/{*path}", cors(corsOptions) as express.RequestHandler);
app.use(cors(corsOptions));

// ============================================
// SECURITY MIDDLEWARE
// ============================================

// HTTP security headers (helmet)
app.use(securityHeaders);

// Compress responses (gzip/br) — after security headers, before routes
app.use(compression({ level: 6, threshold: 1024 }));

// Request ID + structured request logging
app.use(requestIdMiddleware);
app.use(requestLoggerWithId);

// Attach res.ok() / res.fail() unified envelope helpers
app.use(attachResponseHelpers);

// Save raw body buffer for webhook signature verification (PhonePe, Stripe, etc.)
// The `verify` callback runs BEFORE json parsing, giving us the original bytes.
app.use(express.json({
  limit: "5mb",
  verify: (req, _res, buf) => {
    // Only save raw body for webhook routes to avoid unnecessary memory usage
    if (req.url?.includes('/webhook')) {
      (req as typeof req & { rawBody?: Buffer }).rawBody = buf;
    }
  },
}));
app.use(cookieParser()); // Parse cookies for CSRF double-submit pattern

// XSS sanitization — strip dangerous HTML/JS from all incoming strings
import { xssSanitize } from "./middleware/xssSanitize.js";
app.use(xssSanitize);

// CSRF protection (issues cookie + validates on state-changing requests)
app.use(csrfCookieMiddleware);
app.use(csrfValidationMiddleware);

// General rate limiting (after CORS so rate-limited responses still have CORS headers)
app.use(generalRateLimit);

// ============================================
// PUBLIC ENDPOINTS (before auth middleware so they always work)
// ============================================

// Root health check
app.get("/", (_req: Request, res: Response) => {
  const frontendUrl = process.env["FRONTEND_URL"] || "http://localhost:5173";
  res.status(200).json({
    status: "ok",
    service: "BeamLab Ultimate API",
    message:
      "You are on the API server. Open the frontend URL below to see website/UI changes.",
    frontendUrl,
    usefulLinks: {
      health: "/health",
      apiDocs: "/api/docs",
      versionedApiDocs: "/api/v1/docs",
    },
  });
});

// Health check (public — must be before auth middleware)
// CRITICAL: Returns 503 if dependencies (MongoDB) are not healthy.
// Azure health probe uses this to decide whether to restart the container.
app.get("/health", async (_req: Request, res: Response) => {
  let dbStatus = "unknown";
  let isHealthy = false;
  
  try {
    const mongoose = await import("mongoose");
    const readyState = mongoose.default.connection.readyState;
    // 0 = disconnected, 1 = connected, 2 = connecting, 3 = disconnecting
    dbStatus = 
      readyState === 1
        ? "connected"
        : readyState === 0
        ? "disconnected"
        : "transitioning";
    isHealthy = readyState === 1;
  } catch (err) {
    dbStatus = "error";
    isHealthy = false;
  }

  // Return 503 if not healthy so Azure health probe triggers restart
  const statusCode = isHealthy ? 200 : 503;
  const status = isHealthy ? "healthy" : "degraded";

  res.status(statusCode).json({
    status,
    service: "BeamLab Ultimate API",
    timestamp: new Date().toISOString(),
    dependencies: { mongodb: dbStatus },
  });
});

app.get("/health/dependencies", async (_req: Request, res: Response) => {
  let mongo = { healthy: false, status: "unknown" as "connected" | "disconnected" | "error" | "unknown" };
  let rust = { healthy: false, latencyMs: 0 };
  let python = { healthy: false, latencyMs: 0 };
  let circuitBreakers: Record<string, unknown> = {};

  try {
    const mongoose = await import("mongoose");
    const readyState = mongoose.default.connection.readyState;
    mongo = {
      healthy: readyState === 1,
      status: readyState === 1 ? "connected" : "disconnected",
    };
  } catch {
    mongo = { healthy: false, status: "error" };
  }

  let gpuFleet = { healthy: false, activeWorkers: 0, queueDepth: 0, latencyMs: 0, configured: false };

  try {
    const { checkBackendHealth, getServiceCircuitStats } = await import("./services/serviceProxy.js");
    const backendHealth = await checkBackendHealth();
    rust = backendHealth.rust;
    python = backendHealth.python;
    circuitBreakers = getServiceCircuitStats();
  } catch {
    // keep defaults if service proxy health checks are unavailable
  }

  try {
    const { checkVmHealth, isVmOrchestratorConfigured, getCircuitStats } = await import("./services/vmOrchestrator.js");
    const vmHealth = await checkVmHealth();
    const vmCircuit = getCircuitStats();
    gpuFleet = {
      ...vmHealth,
      configured: isVmOrchestratorConfigured(),
    };
    (circuitBreakers as Record<string, unknown>)["gpuFleet"] = { open: vmCircuit.isOpen, failures: vmCircuit.failures };
  } catch {
    // GPU fleet health is non-critical — keep defaults
  }

  const allHealthy = mongo.healthy && rust.healthy && python.healthy;
  const status = allHealthy ? "ok" : "degraded";

  res.status(allHealthy ? 200 : 503).json({
    status,
    service: "BeamLab Ultimate API",
    timestamp: new Date().toISOString(),
    dependencies: {
      mongodb: mongo,
      rustApi: rust,
      pythonApi: python,
      gpuFleet,
    },
    circuitBreakers,
  });
});

app.get("/health/ready", async (_req: Request, res: Response) => {
  let mongoHealthy = false;
  let rustHealthy = false;
  let pythonHealthy = false;

  try {
    const mongoose = await import("mongoose");
    mongoHealthy = mongoose.default.connection.readyState === 1;
  } catch {
    mongoHealthy = false;
  }

  try {
    const { checkBackendHealth } = await import("./services/serviceProxy.js");
    const backendHealth = await checkBackendHealth();
    rustHealthy = backendHealth.rust.healthy;
    pythonHealthy = backendHealth.python.healthy;
  } catch {
    rustHealthy = false;
    pythonHealthy = false;
  }

  const ready = mongoHealthy && rustHealthy && pythonHealthy;
  res.status(ready ? 200 : 503).json({
    ready,
    service: "BeamLab Ultimate API",
    timestamp: new Date().toISOString(),
    details: {
      mongodb: mongoHealthy,
      rustApi: rustHealthy,
      pythonApi: pythonHealthy,
    },
  });
});

app.get("/api/health", (_req: Request, res: Response) => {
  res.redirect("/health");
});

// Public marketing data endpoints (no auth required)
app.use("/api/public", publicLandingRoutes);
app.use("/api/v1/public", publicLandingRoutes);

// Initialize authentication middleware based on provider
// USE_CLERK=true -> Clerk, otherwise -> in-house JWT
if (isUsingClerk()) {
  logger.info("Using Clerk authentication");
  app.use(clerkMiddleware() as unknown as RequestHandler);
} else {
  logger.info("Using in-house JWT authentication");
  app.use(inHouseAuthMiddleware);
}

// ============================================
// IN-HOUSE AUTH ROUTES (always available)
// ============================================

// Auth routes (signup, signin, signout, etc.) — with lockout protection
if (!isUsingClerk()) {
  app.use("/api/auth", authRateLimit, checkLockout, authRouter);
  app.use("/api/v1/auth", authRateLimit, checkLockout, authRouter);
}

// OpenAPI docs — restrict access in production (require auth header or dev mode)
const swaggerGuard: RequestHandler = async (req, res, next) => {
  if (process.env.NODE_ENV === "production") {
    const authHeader = req.get("authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      res.status(401).json({
        success: false,
        error: "Authentication required to view API docs",
      });
      return;
    }
    // Validate the token is a real Clerk token
    try {
      const { verifyToken } = await import("@clerk/express");
      await verifyToken(authHeader.split(" ")[1], {
        authorizedParties: [
          "https://beamlabultimate.tech",
          "https://www.beamlabultimate.tech",
          "http://localhost:5173",
        ],
      });
    } catch {
      res.status(401).json({
        success: false,
        error: "Invalid or expired authentication token",
      });
      return;
    }
  }
  next();
};
app.use(
  "/api/docs",
  swaggerGuard,
  swaggerUi.serve,
  swaggerUi.setup(openApiSpec),
);
app.use(
  "/api/v1/docs",
  swaggerGuard,
  swaggerUi.serve,
  swaggerUi.setup(openApiSpec),
);

// ============================================
// API v1 ROUTES (versioned for forward compatibility)
// All routes are available at both /api/... (legacy) and /api/v1/... (versioned)
// ============================================

// DB readiness guard — reject requests to DB-dependent endpoints before MongoDB is connected
let dbReady = false;
const requireDbReady: RequestHandler = (_req, res, next) => {
  if (dbReady) return next();
  res.status(503).json({
    success: false,
    error: "Service starting up — database is connecting. Please retry in a few seconds.",
    retryAfterMs: 2000,
  });
};

// Apply DB readiness check to all API routes that hit the database
app.use("/api/v1", requireDbReady);
app.use("/api/project", requireDbReady);
app.use("/api/user", requireDbReady);
app.use("/api/consent", requireDbReady);
app.use("/api/audit", requireDbReady);
app.use("/api/ai-sessions", requireDbReady);
app.use("/api/feedback", requireDbReady);
app.use("/api/auth", requireDbReady);
app.use("/api/billing", requireDbReady);
app.use("/api/session", requireDbReady);
app.use("/api/usage", requireDbReady);

// Collaboration routes (nested under projects)
app.use("/api/v1/projects", requireDbReady);
app.use("/api/projects", requireDbReady);

const authRequired = requireAuth();

// Structural Analysis API (rate limited: 10/min, auth required)
app.use("/api/v1/analyze", authRequired, analysisRateLimit, costWeightedRateLimit(5), analysisBackpressure, analysisRouter);
app.use("/api/analyze", authRequired, analysisRateLimit, costWeightedRateLimit(5), analysisBackpressure, analysisRouter);
app.use("/api/v1/analysis", authRequired, analysisRateLimit, costWeightedRateLimit(5), analysisBackpressure, analysisRouter);
app.use("/api/analysis", authRequired, analysisRateLimit, costWeightedRateLimit(5), analysisBackpressure, analysisRouter);

// Structural Design API (rate limited: 10/min, auth required)
app.use("/api/v1/design", authRequired, analysisRateLimit, costWeightedRateLimit(3), designBackpressure, designRouter);
app.use("/api/design", authRequired, analysisRateLimit, costWeightedRateLimit(3), designBackpressure, designRouter);

// Advanced Analysis API (P-Delta, Modal, Buckling — auth required)
app.use("/api/v1/advanced", authRequired, analysisRateLimit, costWeightedRateLimit(10), advancedBackpressure, advancedRouter);
app.use("/api/advanced", authRequired, analysisRateLimit, costWeightedRateLimit(10), advancedBackpressure, advancedRouter);

// Interoperability API (STAAD, DXF import/export — auth required)
app.use("/api/v1/interop", authRequired, analysisRateLimit, interopRouter);
app.use("/api/interop", authRequired, analysisRateLimit, interopRouter);

// Template generation API (auth required)
app.use("/api/v1/templates", authRequired, analysisRateLimit, templateRouter);
app.use("/api/templates", authRequired, analysisRateLimit, templateRouter);

// Job queue API (auth required)
app.use("/api/v1/jobs", authRequired, analysisRateLimit, jobsRouter);
app.use("/api/jobs", authRequired, analysisRateLimit, jobsRouter);

// GPU-accelerated job queue (auth required; high cost-weight)
app.use("/api/v1/gpu-jobs", authRequired, analysisRateLimit, costWeightedRateLimit(15), gpuJobsRouter);
app.use("/api/gpu-jobs", authRequired, analysisRateLimit, costWeightedRateLimit(15), gpuJobsRouter);

// User Activity API (protected)
app.use("/api/v1/user", crudRateLimit, userRoutes);
app.use("/api/user", crudRateLimit, userRoutes);

// Device Session API (session management, analysis lock — auth required)
app.use("/api/v1/session", crudRateLimit, sessionRoutes);
app.use("/api/session", crudRateLimit, sessionRoutes);

// Usage Monitoring API (analysis results, reports, admin stats — auth required)
app.use("/api/v1/usage", crudRateLimit, usageRoutes);
app.use("/api/usage", crudRateLimit, usageRoutes);

// PhonePe Billing API (rate limited: 5/min)
app.use("/api/v1/billing", billingRateLimit, costWeightedRateLimit(2), billingRouter);
app.use("/api/billing", billingRateLimit, costWeightedRateLimit(2), billingRouter);

// Razorpay Billing API (rate limited: 5/min)

// ============================================
// PROTECTED ROUTES (require authentication)
// ============================================

// Get current user projects
// Project API handled by projectRoutes
// app.get('/api/project', ... ) removed

// Project API
app.use("/api/v1/project", crudRateLimit, projectRoutes);
app.use("/api/project", crudRateLimit, projectRoutes);

// Collaboration API (nested under projects)
app.use("/api/v1/projects/:id/collaborators", crudRateLimit, collaborationRoutes);
app.use("/api/projects/:id/collaborators", crudRateLimit, collaborationRoutes);

// Subscription API
app.use("/api/v1/subscription", crudRateLimit, subscriptionRoutes);
app.use("/api/subscription", crudRateLimit, subscriptionRoutes);

// Legal Consent API
app.use("/api/v1/consent", crudRateLimit, consentRoutes);
app.use("/api/consent", crudRateLimit, consentRoutes);

// Audit API
app.use("/api/v1/audit", crudRateLimit, auditRoutes);
app.use("/api/audit", crudRateLimit, auditRoutes);

// AI Session API (cloud sync for AI architect history)
app.use("/api/v1/ai-sessions", crudRateLimit, aiSessionRoutes);
app.use("/api/ai-sessions", crudRateLimit, aiSessionRoutes);

// AI Model Generation API (architect, vision — auth required)
app.use("/api/v1/ai", authRequired, analysisRateLimit, costWeightedRateLimit(8), aiBackpressure, aiRoutes);
app.use("/api/ai", authRequired, analysisRateLimit, costWeightedRateLimit(8), aiBackpressure, aiRoutes);

// Feedback API (user feedback for AI improvement — auth required)
app.use("/api/v1/feedback", authRequired, crudRateLimit, feedbackRoutes);
app.use("/api/feedback", authRequired, crudRateLimit, feedbackRoutes);

// Analytics API (product event tracking — rate limited to prevent abuse)
app.use("/api/v1/analytics", crudRateLimit, analyticsRouter);
app.use("/api/analytics", crudRateLimit, analyticsRouter);

// Get users in a project (for multiplayer) - requires auth + rate limited
app.get(
  "/api/project/:id/users",
  crudRateLimit,
  requireAuth(),
  (req: Request, res: Response) => {
    const projectId = req.params["id"] ?? "";
    const users = socketServer.getProjectUsers(projectId);
    res.ok({
      projectId,
      users: users.map((u) => ({ id: u.id, name: u.name, color: u.color })),
    });
  },
);

// Error handler (must be last middleware — BEFORE listen)
app.use(secureErrorHandler);

// Start server immediately to satisfy startup probes
console.log("[STARTUP] About to call httpServer.listen()...");
console.log("[STARTUP] Port to listen on:", PORT);
httpServer.listen(PORT, () => {
  console.log("[STARTUP] ✅ Server listening successfully!");
  logger.info(`BeamLab Ultimate API running on http://localhost:${PORT}`);
  logger.info(`WebSocket server ready for real-time collaboration`);
  logger.info(`Security middleware active: helmet, rate limiting, logging`);

  // Connect to MongoDB with retry logic
  const connectWithRetry = (attempt = 1, maxAttempts = 5) => {
    connectDB()
      .then(() => {
        dbReady = true;
        logger.info("MongoDB connected successfully — API routes are now live");
        startQuotaResetCron();
      })
      .catch((err) => {
        logger.error({ err, attempt }, `Failed to connect to MongoDB (attempt ${attempt}/${maxAttempts})`);
        if (attempt < maxAttempts) {
          const delay = Math.min(attempt * 2000, 10000); // Exponential backoff, max 10s
          logger.info(`Retrying MongoDB connection in ${delay}ms...`);
          setTimeout(() => connectWithRetry(attempt + 1, maxAttempts), delay);
        } else {
          logger.error("All MongoDB connection attempts exhausted. Database routes will return 503.");
        }
      });
  };
  connectWithRetry();
});

// ===========================================================================
// GRACEFUL SHUTDOWN WITH CONNECTION DRAINING
// Ensures in-flight requests complete, DB connections close, and the process
// exits cleanly — required for zero-downtime deploys (K8s, Azure App Service).
// ===========================================================================
const SHUTDOWN_TIMEOUT_MS = 15_000;
let isShuttingDown = false;

// Track active connections for draining
const activeConnections = new Set<import("net").Socket>();
httpServer.on("connection", (socket) => {
  activeConnections.add(socket);
  socket.on("close", () => activeConnections.delete(socket));
});

// Middleware: reject new requests during shutdown (return 503)
app.use((_req, res, next) => {
  if (isShuttingDown) {
    res.setHeader("Connection", "close");
    res.status(503).json({ success: false, error: "Server is shutting down" });
    return;
  }
  next();
});

function gracefulShutdown(signal: string) {
  if (isShuttingDown) return; // Prevent double shutdown
  isShuttingDown = true;
  logger.info(`Received ${signal}. Starting graceful shutdown...`);

  // 1. Stop accepting new connections & wait for in-flight requests to drain
  httpServer.close(() => {
    logger.info("HTTP server closed — all in-flight requests drained.");
  });

  // 2. Close WebSocket connections
  socketServer.close();
  logger.info("WebSocket server closed.");

  // 3. Destroy idle keep-alive connections (let active ones finish)
  for (const socket of activeConnections) {
    // If the socket has no pending data, destroy it
    if (!socket.writableLength) {
      socket.destroy();
    } else {
      // Let it finish writing, then close
      socket.end();
    }
  }
  logger.info(`${activeConnections.size} idle connections closed.`);

  // 4. Close MongoDB connection
  import("mongoose")
    .then((mongoose) => {
      mongoose.default.connection.close(false).then(() => {
        logger.info("MongoDB connection closed.");
        process.exit(0);
      });
    })
    .catch(() => {
      process.exit(0);
    });

  // 5. Force kill if graceful shutdown takes too long
  setTimeout(() => {
    logger.error("Graceful shutdown timed out. Forcing exit.");
    process.exit(1);
  }, SHUTDOWN_TIMEOUT_MS);
}

process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
process.on("SIGINT", () => gracefulShutdown("SIGINT"));
