import express, {
  type Request,
  type Response,
  type RequestHandler,
} from "express";
import cors from "cors";
import { createServer } from "http";
import { clerkMiddleware } from "@clerk/express";
// Validate environment FIRST — crashes in production if critical vars are missing
import { env } from "./config/env.js";
import { SocketServer } from "./SocketServer.js";
import analysisRouter from "./routes/analysis/index.js";
import designRouter from "./routes/design/index.js";
import advancedRouter from "./routes/advanced/index.js";
import interopRouter from "./routes/interop/index.js";
import authRouter from "./routes/authRoutes.js";
import userRoutes from "./routes/userRoutes.js";
import projectRoutes from "./routes/projectRoutes.js";
import consentRoutes from "./routes/consentRoutes.js";
import auditRoutes from "./routes/audit/index.js";
import aiSessionRoutes from "./routes/aiSessionRoutes.js";
import { razorpayRouter } from "./razorpay.js";
import swaggerUi from "swagger-ui-express";
import { connectDB } from "./models.js";
import {
  authMiddleware as inHouseAuthMiddleware,
  isUsingClerk,
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
} from "./middleware/security.js";
import { attachResponseHelpers } from "./middleware/response.js";
import * as Sentry from "@sentry/node";
import { nodeProfilingIntegration } from "@sentry/profiling-node";

// Initialize Sentry
if (process.env.SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    integrations: [nodeProfilingIntegration()],
    // Performance Monitoring (20% sample to control costs)
    tracesSampleRate: 0.2,
    // Set sampling rate for profiling - this is relative to tracesSampleRate
    profilesSampleRate: 1.0,
  });
}

const app = express();
const PORT = process.env["PORT"] ?? 3001;

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
          "200": { description: "Order created" },
          "429": { description: "Rate limited" },
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
// SECURITY MIDDLEWARE
// ============================================

// HTTP security headers (helmet)
app.use(securityHeaders);

// Request ID + structured request logging
app.use(requestIdMiddleware);
app.use(requestLoggerWithId);

// Attach res.ok() / res.fail() unified envelope helpers
app.use(attachResponseHelpers);

// General rate limiting
app.use(generalRateLimit);

// ============================================
// CORS & PARSING
// ============================================

// Allowed origins for CORS
const configuredOrigins = (process.env["CORS_ALLOWED_ORIGINS"] || "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

const ALLOWED_ORIGINS = Array.from(
  new Set([
    process.env["FRONTEND_URL"] || "http://localhost:5173",
    "https://beamlabultimate.tech",
    "https://www.beamlabultimate.tech",
    "https://brave-mushroom-0eae8ec00.4.azurestaticapps.net",
    "http://localhost:5173",
    "http://localhost:3000",
  ]),
).concat(configuredOrigins);

app.use(
  cors({
    origin: (origin, callback) => {
      // In production, require origin header. In dev, allow server-to-server.
      if (!origin) {
        if (process.env.NODE_ENV === "production") {
          return callback(new Error("Origin header required"));
        }
        return callback(null, true);
      }
      // Check if origin is in allowed list
      if (ALLOWED_ORIGINS.includes(origin)) {
        return callback(null, true);
      }
      // Log blocked origins for debugging
      console.warn(`CORS blocked origin: ${origin}`);
      return callback(new Error("Not allowed by CORS"));
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-Request-ID", "Cache-Control", "sentry-trace", "baggage"],
    exposedHeaders: ["X-Request-ID"],
    optionsSuccessStatus: 204,
  }),
);
app.use(express.json({ limit: "10mb" })); // Limit payload size

// Initialize authentication middleware based on provider
// USE_CLERK=true -> Clerk, otherwise -> in-house JWT
if (isUsingClerk()) {
  console.log("🔐 Using Clerk authentication");
  app.use(clerkMiddleware() as unknown as RequestHandler);
} else {
  console.log("🔐 Using in-house JWT authentication");
  app.use(inHouseAuthMiddleware);
}

// ============================================
// IN-HOUSE AUTH ROUTES (always available)
// ============================================

// Auth routes (signup, signin, signout, etc.)
if (!isUsingClerk()) {
  app.use("/api/auth", authRateLimit, authRouter);
  app.use("/api/v1/auth", authRateLimit, authRouter);
}

// Root health check
app.get("/", (_req: Request, res: Response) => {
  res.send("BeamLab Ultimate API Running");
});

// OpenAPI docs
app.use("/api/docs", swaggerUi.serve, swaggerUi.setup(openApiSpec));
app.use("/api/v1/docs", swaggerUi.serve, swaggerUi.setup(openApiSpec));

// Health check (public)
app.get("/health", async (_req: Request, res: Response) => {
  let dbStatus = "unknown";
  try {
    const mongoose = await import("mongoose");
    dbStatus =
      mongoose.default.connection.readyState === 1
        ? "connected"
        : "disconnected";
  } catch {
    dbStatus = "error";
  }

  // Circuit breaker stats
  let circuitBreakers: Record<string, unknown> = {};
  try {
    const { getAllCircuitStats } = await import("./utils/circuitBreaker.js");
    circuitBreakers = getAllCircuitStats();
  } catch {
    /* not critical */
  }

  const status = dbStatus === "connected" ? "ok" : "degraded";

  res.ok(
    {
      status,
      service: "BeamLab Ultimate API",
      version: process.env.npm_package_version || "1.0.0",
      uptime: Math.floor(process.uptime()),
      websocket: true,
      authProvider: isUsingClerk() ? "clerk" : "inhouse",
      dependencies: {
        mongodb: dbStatus,
      },
      circuitBreakers,
      timestamp: new Date().toISOString(),
    },
    status === "ok" ? 200 : 503,
  );
});

// ============================================
// API v1 ROUTES (versioned for forward compatibility)
// All routes are available at both /api/... (legacy) and /api/v1/... (versioned)
// ============================================

// Structural Analysis API (rate limited: 10/min)
app.use("/api/v1/analyze", analysisRateLimit, analysisRouter);
app.use("/api/analyze", analysisRateLimit, analysisRouter);
app.use("/api/v1/analysis", analysisRateLimit, analysisRouter);
app.use("/api/analysis", analysisRateLimit, analysisRouter);

// Structural Design API (rate limited: 10/min)
app.use("/api/v1/design", analysisRateLimit, designRouter);
app.use("/api/design", analysisRateLimit, designRouter);

// Advanced Analysis API (P-Delta, Modal, Buckling)
app.use("/api/v1/advanced", analysisRateLimit, advancedRouter);
app.use("/api/advanced", analysisRateLimit, advancedRouter);

// Interoperability API (STAAD, DXF import/export)
app.use("/api/v1/interop", analysisRateLimit, interopRouter);
app.use("/api/interop", analysisRateLimit, interopRouter);

// User Activity API (protected)
app.use("/api/v1/user", crudRateLimit, userRoutes);
app.use("/api/user", crudRateLimit, userRoutes);

// Razorpay Billing API (rate limited: 5/min)
app.use("/api/v1/billing", billingRateLimit, razorpayRouter);
app.use("/api/billing", billingRateLimit, razorpayRouter);

// ============================================
// PROTECTED ROUTES (require authentication)
// ============================================

// Get current user projects
// Project API handled by projectRoutes
// app.get('/api/project', ... ) removed

// Project API
app.use("/api/v1/project", crudRateLimit, projectRoutes);
app.use("/api/project", crudRateLimit, projectRoutes);

// Legal Consent API
app.use("/api/v1/consent", crudRateLimit, consentRoutes);
app.use("/api/consent", crudRateLimit, consentRoutes);

// Audit API
app.use("/api/v1/audit", crudRateLimit, auditRoutes);
app.use("/api/audit", crudRateLimit, auditRoutes);

// AI Session API (cloud sync for AI architect history)
app.use("/api/v1/ai-sessions", crudRateLimit, aiSessionRoutes);
app.use("/api/ai-sessions", crudRateLimit, aiSessionRoutes);

// Get users in a project (for multiplayer)
app.get("/api/project/:id/users", (req: Request, res: Response) => {
  const projectId = req.params["id"] ?? "";
  const users = socketServer.getProjectUsers(projectId);
  res.ok({
    projectId,
    users: users.map((u) => ({ id: u.id, name: u.name, color: u.color })),
  });
});

// Error handler (must be last middleware — BEFORE listen)
app.use(secureErrorHandler);

// Start server immediately to satisfy startup probes
httpServer.listen(PORT, () => {
  console.log(`🚀 BeamLab Ultimate API running on http://localhost:${PORT}`);
  console.log(`🔌 WebSocket server ready for real-time collaboration`);
  console.log(`🔒 Security middleware active: helmet, rate limiting, logging`);

  // Connect to MongoDB in background
  connectDB()
    .then(() => {
      console.log("✅ MongoDB connected successfully");
    })
    .catch((err) => {
      console.error("❌ Failed to connect to MongoDB:", err);
    });
});

// ===========================================================================
// GRACEFUL SHUTDOWN
// Ensures in-flight requests complete, DB connections close, and the process
// exits cleanly — required for zero-downtime deploys (K8s, Azure App Service).
// ===========================================================================
const SHUTDOWN_TIMEOUT_MS = 15_000;

function gracefulShutdown(signal: string) {
  console.log(`\n⚠️  Received ${signal}. Starting graceful shutdown...`);

  // 1. Stop accepting new connections
  httpServer.close(() => {
    console.log("✅ HTTP server closed — no new connections.");
  });

  // 2. Close WebSocket connections
  socketServer.close();
  console.log("✅ WebSocket server closed.");

  // 3. Close MongoDB connection
  import("mongoose")
    .then((mongoose) => {
      mongoose.default.connection.close(false).then(() => {
        console.log("✅ MongoDB connection closed.");
        process.exit(0);
      });
    })
    .catch(() => {
      process.exit(0);
    });

  // 4. Force kill if graceful shutdown takes too long
  setTimeout(() => {
    console.error("❌ Graceful shutdown timed out. Forcing exit.");
    process.exit(1);
  }, SHUTDOWN_TIMEOUT_MS);
}

process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
process.on("SIGINT", () => gracefulShutdown("SIGINT"));
