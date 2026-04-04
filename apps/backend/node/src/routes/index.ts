import express, { type Router, type Request, type Response, type NextFunction, type RequestHandler } from "express";
// swaggerUi is injected via deps; clerkMiddleware not used here.
// import swaggerUi from "swagger-ui-express";
import { clerkMiddleware } from "@clerk/express";

import publicLandingRoutes from "./publicLandingRoutes.js";
import analysisRouter from "./analysis/index.js";
import designRouter from "./design/index.js";
import advancedRouter from "./advanced/index.js";
import interopRouter from "./interop/index.js";
import reportTemplateRouter from "./reportTemplates/index.js";
import templateRouter from "./templates/index.js";
import jobsRouter from "./jobs/index.js";
import gpuJobsRouter from "./gpujobs/index.js";
import authRouter from "./authRoutes.js";
import userRoutes from "./userRoutes.js";
import projectRoutes from "./projectRoutes.js";
import collaborationRoutes from "./collaborationRoutes.js";
import subscriptionRoutes from "./subscriptionRoutes.js";
import consentRoutes from "./consentRoutes.js";
import auditRoutes from "./audit/index.js";
import analyticsRouter from "./analytics/index.js";
import aiSessionRoutes from "./aiSessionRoutes.js";
import aiRoutes from "./ai/index.js";
import bridgeRoutes from "./bridge/index.js";
import feedbackRoutes from "./feedback/index.js";
import sessionRoutes from "./sessionRoutes.js";
import usageRoutes from "./usageRoutes.js";
import optimizeRouter from "./optimize/index.js";
import { billingRouter } from "../phonepe.js";
import { razorpayRouter } from "../razorpay.js";
import adminGpuStatusRouter from "./admin/gpuStatus.js";

import { env } from "../config/env.js";
import {
  requireAuth,
  isUsingClerk,
  authMiddleware as inHouseAuthMiddleware,
  handleAuthError,
} from "../middleware/authMiddleware.js";
// Security middlewares are wired in app.ts; keep types local.
// import {
//   requestIdMiddleware,
//   requestLoggerWithId,
//   generalRateLimit,
//   securityHeaders,
// } from "../middleware/security.js";
// import { attachResponseHelpers } from "../middleware/response.js";
// import { xssSanitize } from "../middleware/xssSanitize.js";
// import { csrfCookieMiddleware, csrfValidationMiddleware } from "../middleware/csrfProtection.js";
import { logger } from "../utils/logger.js";
// import cors from "cors";
import type swaggerUiExpress from "swagger-ui-express";
import type { openApiSpec as OpenApiSpecType } from "../openapi/spec.js";

// Typings for config injection
export type RoutesDeps = {
  analysisRateLimit: RequestHandler;
  crudRateLimit: RequestHandler;
  billingRateLimit: RequestHandler;
  authRateLimit: RequestHandler;
  analysisBackpressure: RequestHandler;
  advancedBackpressure: RequestHandler;
  designBackpressure: RequestHandler;
  aiBackpressure: RequestHandler;
  costWeightedRateLimit: (weight: number) => RequestHandler;
  swaggerUi: typeof swaggerUiExpress;
  openApiSpec: typeof OpenApiSpecType;
  env: typeof env;
  gpuAutoscaleMetricsRouter?: Router;
  getProjectUsers?: (projectId: string) => Array<{ id: string; name: string; color: string }>;
};

export function getRoutes(deps: RoutesDeps): { publicRouter: Router; apiRouter: Router; setDbReady: (ready: boolean) => void } {
  const {
    analysisRateLimit,
    crudRateLimit,
    billingRateLimit,
    // authRateLimit,
    analysisBackpressure,
    advancedBackpressure,
    designBackpressure,
    aiBackpressure,
    costWeightedRateLimit,
    swaggerUi,
    openApiSpec,
    gpuAutoscaleMetricsRouter,
    getProjectUsers,
  } = deps;

  const publicRouter = express.Router();
  const apiRouter = express.Router();
  const legacyApiRoutesFlag = (process.env["ENABLE_LEGACY_API_ROUTES"] ?? "true")
    .trim()
    .toLowerCase();
  const legacyApiRoutesEnabled = legacyApiRoutesFlag !== "false";
  const frontendUrl = env.FRONTEND_URL;
  const packageVersion = env.npm_package_version ?? "unknown";

  const mountApi = (path: string, ...handlers: Array<RequestHandler | Router>) => {
    apiRouter.use(`/api/v1/${path}`, ...handlers);
    if (legacyApiRoutesEnabled) {
      apiRouter.use(`/api/${path}`, ...handlers);
    }
  };

  const mountApiGet = (path: string, ...handlers: RequestHandler[]) => {
    apiRouter.get(`/api/v1/${path}`, ...handlers);
    if (legacyApiRoutesEnabled) {
      apiRouter.get(`/api/${path}`, ...handlers);
    }
  };

  // Guard against ESM/CJS interop edge cases where a router can arrive as
  // a module namespace object ({ default: router }) instead of the router fn.
  const optimizeRouterCandidate = ((optimizeRouter as any)?.default ?? optimizeRouter) as any;
  const optimizeRouterHandler: Router | RequestHandler =
    typeof optimizeRouterCandidate === "function" || typeof optimizeRouterCandidate?.use === "function"
      ? optimizeRouterCandidate
      : express.Router();
  if (optimizeRouterHandler !== optimizeRouterCandidate) {
    logger.error("optimizeRouter import was not a valid Express router; mounted fallback empty router");
  }

  if (!legacyApiRoutesEnabled) {
    const legacyRouteGuard: RequestHandler = (req: Request, res: Response, next: NextFunction) => {
      // Mounted at /api, so v1 requests appear as /v1/* at this point.
      if (req.path === "/v1" || req.path.startsWith("/v1/")) {
        next();
        return;
      }

      res.status(410).json({
        success: false,
        error: "Legacy /api routes are disabled. Use /api/v1/* endpoints.",
      });
    };
    apiRouter.use("/api", legacyRouteGuard);
  }

  // Root + health
  publicRouter.get("/", (_req: Request, res: Response) => {
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

  publicRouter.get("/health", async (_req: Request, res: Response) => {
    res.status(200).json({
      status: "ok",
      version: packageVersion,
      uptime: process.uptime(),
    });
  });

  publicRouter.get("/api/health/ready", (_req, res) => {
    res.status(200).json({ status: "ready", version: packageVersion });
  });

  publicRouter.get("/api/health/dependencies", async (_req, res) => {
    try {
      const mongoose = await import("mongoose");
      const readyState = mongoose.default.connection.readyState;
      const mongoHealthy = readyState === 1;
      const { checkBackendHealth } = await import("../services/serviceProxy.js");
      const backendHealth = await checkBackendHealth();
      res.status(200).json({
        database: mongoHealthy ? "connected" : "disconnected",
        rust_service: backendHealth.rust.healthy ? "ok" : "error",
        python_service: backendHealth.python.healthy ? "ok" : "error",
      });
    } catch (e) {
      res.status(503).json({ error: "dependency check failed", details: String(e) });
    }
  });

  publicRouter.get("/health/dependencies", async (_req, res) => {
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
      const { checkBackendHealth, getServiceCircuitStats, getCircuitStatus } = await import("../services/serviceProxy.js");
      const backendHealth = await checkBackendHealth();
      rust = backendHealth.rust;
      python = backendHealth.python;
      circuitBreakers = getServiceCircuitStats();
      (circuitBreakers as Record<string, unknown>)["rust"] = getCircuitStatus("rust");
      (circuitBreakers as Record<string, unknown>)["python"] = getCircuitStatus("python");
    } catch {
      // keep defaults
    }

    try {
      const { checkVmHealth, isVmOrchestratorConfigured, getCircuitStats } = await import("../services/vmOrchestrator.js");
      const vmHealth = await checkVmHealth();
      const vmCircuit = getCircuitStats();
      gpuFleet = {
        ...vmHealth,
        configured: isVmOrchestratorConfigured(),
      };
      (circuitBreakers as Record<string, unknown>)["gpuFleet"] = { open: vmCircuit.isOpen, failures: vmCircuit.failures };
    } catch {
      // ignore
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

  publicRouter.get("/health/ready", async (_req, res) => {
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
      const { checkBackendHealth } = await import("../services/serviceProxy.js");
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

  publicRouter.get("/api/health", (_req, res) => {
    res.redirect("/health");
  });

  // Docs guard
  const swaggerGuard: RequestHandler = async (req, res, next) => {
    if (process.env.NODE_ENV === "production") {
      const authHeader = req.get("authorization");
      if (!authHeader || !authHeader.startsWith("Bearer ")) {
        res.status(401).json({ success: false, error: "Authentication required to view API docs" });
        return;
      }
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
        res.status(401).json({ success: false, error: "Invalid or expired authentication token" });
        return;
      }
    }
    next();
  };

  publicRouter.use("/api/docs", swaggerGuard, swaggerUi.serve, swaggerUi.setup(openApiSpec));
  publicRouter.use("/api/v1/docs", swaggerGuard, swaggerUi.serve, swaggerUi.setup(openApiSpec));

  if (gpuAutoscaleMetricsRouter) {
    publicRouter.use("/api/v1/metrics", gpuAutoscaleMetricsRouter);
    publicRouter.use("/api/metrics", gpuAutoscaleMetricsRouter);
  }

  publicRouter.use("/api/public", publicLandingRoutes);
  publicRouter.use("/api/v1/public", publicLandingRoutes);

  // Admin diagnostics toggle
  const adminStatusEnabled = (process.env["ADMIN_STATUS_ENABLED"] ?? "false") === "true";
  if (adminStatusEnabled) {
    logger.info("Admin diagnostics endpoint enabled: registering /api/admin routes");
    mountApi("admin", adminGpuStatusRouter);
  } else {
    logger.info("Admin diagnostics endpoint disabled (ADMIN_STATUS_ENABLED=false)");
  }

  // DB readiness gate
  let dbReady = env.NODE_ENV !== "production";
  const requireDbReady: RequestHandler = (req, res, next) => {
    if (req.path.startsWith("/metrics/") || req.path.startsWith("/api/metrics/")) {
      next();
      return;
    }
    if (dbReady) {
      next();
      return;
    }
    res.status(503).json({
      success: false,
      error: "Service starting up — database is connecting. Please retry in a few seconds.",
      retryAfterMs: 2000,
    });
  };
  const setDbReady = (ready: boolean) => {
    dbReady = ready;
  };

  const dbGuardPaths = [
    "project",
    "user",
    "consent",
    "audit",
    "ai-sessions",
    "feedback",
    "auth",
    "billing",
    "payments",
    "session",
    "usage",
    "subscription",
    "projects",
  ];

  dbGuardPaths.forEach((p) => {
    mountApi(p, requireDbReady);
  });

  // Auth routing (Clerk or in-house)
  if (isUsingClerk()) {
    const clerkAuthMiddleware = clerkMiddleware();
    if (typeof clerkAuthMiddleware !== "function") {
      throw new Error("Clerk middleware failed to initialize");
    }
    mountApi(
      "auth",
      requireDbReady,
      clerkAuthMiddleware as unknown as RequestHandler,
      authRouter,
    );
  } else {
    mountApi("auth", requireDbReady, inHouseAuthMiddleware, authRouter);
    apiRouter.use(handleAuthError);
  }

  const authRequired = requireAuth();

  mountApi("analyze", authRequired, analysisRateLimit, costWeightedRateLimit(5), analysisBackpressure, analysisRouter);
  mountApi("analysis", authRequired, analysisRateLimit, costWeightedRateLimit(5), analysisBackpressure, analysisRouter);

  mountApi("design", authRequired, analysisRateLimit, costWeightedRateLimit(3), designBackpressure, designRouter);
  mountApi("advanced", authRequired, analysisRateLimit, costWeightedRateLimit(10), advancedBackpressure, advancedRouter);
  mountApi("interop", authRequired, analysisRateLimit, interopRouter);

  mountApi("templates", authRequired, analysisRateLimit, templateRouter);
  mountApi("reports", authRequired, crudRateLimit, reportTemplateRouter);
  mountApi("jobs", authRequired, analysisRateLimit, jobsRouter);
  mountApi("gpu-jobs", authRequired, analysisRateLimit, costWeightedRateLimit(15), gpuJobsRouter);

  mountApi("user", userRoutes);
  mountApi("session", sessionRoutes);
  mountApi("usage", usageRoutes);

  mountApi("billing", billingRateLimit, costWeightedRateLimit(2), billingRouter);
  mountApi("payments/razorpay", billingRateLimit, costWeightedRateLimit(2), razorpayRouter);
  mountApi("billing/razorpay", billingRateLimit, costWeightedRateLimit(2), razorpayRouter);

  mountApi("project", requireDbReady, projectRoutes);
  mountApi("subscription", subscriptionRoutes);
  mountApi("consent", consentRoutes);
  mountApi("audit", auditRoutes);
  mountApi("ai-sessions", aiSessionRoutes);

  mountApi("ai", authRequired, analysisRateLimit, costWeightedRateLimit(8), aiBackpressure, aiRoutes);
  mountApi("bridge", authRequired, analysisRateLimit, bridgeRoutes);
  mountApi("feedback", feedbackRoutes);
  mountApi("analytics", crudRateLimit, analyticsRouter);
  mountApi("collaboration", collaborationRoutes);
  mountApi("optimize", authRequired, analysisRateLimit, optimizeRouterHandler);

  mountApiGet(
    "project/:id/users",
    crudRateLimit,
    requireAuth(),
    (req: Request, res: Response) => {
      const projectId = req.params["id"] ?? "";
      const users = getProjectUsers ? getProjectUsers(projectId) : [];
      res.ok({ projectId, users });
    },
  );

  return { publicRouter, apiRouter, setDbReady };
}
