import express, { type Express, type Router } from "express";
import cookieParser from "cookie-parser";
import compression from "compression";
import cors from "cors";
import swaggerUi from "swagger-ui-express";
import * as Sentry from "@sentry/node";
import type { NodeOptions } from "@sentry/node";
import type { Request, Response } from "express";

import { env } from "./config/env.js";
import { isTrustedOrigin } from "./config/cors.js";
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
  csrfCookieMiddleware,
  csrfValidationMiddleware,
} from "./middleware/csrfProtection.js";
import { attachResponseHelpers } from "./middleware/response.js";
import { xssSanitize } from "./middleware/xssSanitize.js";
import {
  analysisBackpressure,
  advancedBackpressure,
  designBackpressure,
  aiBackpressure,
} from "./middleware/backpressure.js";
import databaseOwnershipGuard from "./middleware/databaseOwnershipGuard.js";
import { getRoutes } from "./routes/index.js";
import { openApiSpec } from "./openapi/spec.js";
import { logger } from "./utils/logger.js";

type CreateAppDeps = {
  gpuAutoscaleMetricsRouter?: Router;
  getProjectUsers?: (projectId: string) => Array<{ id: string; name: string; color: string }>;
};

type CreateAppResult = {
  app: Express;
  setDbReady: (ready: boolean) => void;
};

export function createApp(deps: CreateAppDeps = {}): CreateAppResult {
  // Initialize Sentry early
  if (process.env.SENTRY_DSN) {
    const integrations: NodeOptions["integrations"] = [];
    Sentry.init({
      dsn: process.env.SENTRY_DSN,
      integrations,
      tracesSampleRate: 0.2,
      profilesSampleRate: 0.1,
    });
  }

  const app = express();
  app.set("trust proxy", 1);

  // CORS
  const corsOptions: cors.CorsOptions = {
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);
      if (isTrustedOrigin(origin)) return callback(null, true);
      logger.warn(`CORS blocked origin: ${origin}`);
      return callback(null, false);
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
    allowedHeaders: [
      "Content-Type",
      "Authorization",
      "X-Request-ID",
      "x-idempotency-key",
      "X-CSRF-Token",
      "X-Razorpay-Signature",
      "x-razorpay-signature",
      "X-Razorpay-Event-Id",
      "x-razorpay-event-id",
      "Cache-Control",
      "sentry-trace",
      "baggage",
      "x-device-id",
    ],
    exposedHeaders: ["X-Request-ID"],
    optionsSuccessStatus: 204,
  };
  app.options("*", cors(corsOptions) as express.RequestHandler);
  app.use(cors(corsOptions));

  // Security + basics
  app.use(securityHeaders);
  app.use(compression({ level: 6, threshold: 1024 }));
  app.use(requestIdMiddleware);
  app.use(requestLoggerWithId);
  app.use(attachResponseHelpers);

  // JSON parsing (with raw body for webhooks)
  app.use(express.json({
    limit: "5mb",
    verify: (req, _res, buf) => {
      if (req.url?.includes('/webhook')) {
        (req as typeof req & { rawBody?: Buffer }).rawBody = buf;
      }
    },
  }));
  app.use(cookieParser());
  app.use(xssSanitize);
  app.use(csrfCookieMiddleware);
  app.use(csrfValidationMiddleware);

  // Rate limiting
  app.use(generalRateLimit);

  // Database write authorization (Item 5: Data Layer Governance)
  // Validates that only authorized services can write to protected collections.
  // See: ITEM5_MONGODB_OWNERSHIP_MATRIX.md
  app.use(databaseOwnershipGuard);

  // Deprecation headers for unversioned routes
  app.use((req: Request, res: Response, next) => {
    const path = req.path;
    const isLegacyApiRoute = path.startsWith("/api/") && !path.startsWith("/api/v1/");
    if (isLegacyApiRoute) {
      const replacementPath = path.replace(/^\/api\//, "/api/v1/");
      res.setHeader("Deprecation", "true");
      res.setHeader("Sunset", "Tue, 30 Jun 2026 23:59:59 GMT");
      res.setHeader(
        "Link",
        "</docs/deployment/API_DEPRECATION_SCHEDULE.md>; rel=\"deprecation\"; type=\"text/markdown\""
      );
      res.setHeader("X-API-Replacement", replacementPath);
    }
    next();
  });

  // Public health/docs and route mounting
  const routes = getRoutes({
    analysisRateLimit,
    crudRateLimit,
    billingRateLimit,
    authRateLimit,
    analysisBackpressure,
    advancedBackpressure,
    designBackpressure,
    aiBackpressure,
    costWeightedRateLimit,
    swaggerUi,
    openApiSpec,
    env,
    gpuAutoscaleMetricsRouter: deps.gpuAutoscaleMetricsRouter,
    getProjectUsers: deps.getProjectUsers,
  });

  app.use(routes.publicRouter);
  app.use(routes.apiRouter);

  // Error handler
  app.use(secureErrorHandler);

  return { app, setDbReady: routes.setDbReady };
}
