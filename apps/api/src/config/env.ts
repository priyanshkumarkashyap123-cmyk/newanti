/**
 * Environment Configuration & Validation
 *
 * Centralised env-var validation that runs ONCE at import time.
 * In production, missing critical variables crash the process immediately
 * instead of failing silently at runtime when a user hits a broken endpoint.
 *
 * Usage:
 *   import { env } from './config/env.js';
 *   console.log(env.PORT);            // typed, validated
 *   console.log(env.MONGODB_URI);     // guaranteed non-empty in prod
 */

import { z } from "zod";
import { logger } from "../utils/logger.js";

// ============================================
// SCHEMA
// ============================================

const envSchema = z.object({
  // Server
  NODE_ENV: z
    .enum(["development", "production", "test"])
    .default("development"),
  PORT: z.coerce.number().int().positive().default(3001),

  // Database
  MONGODB_URI: z
    .string()
    .min(1, "MONGODB_URI is required")
    .default("mongodb://localhost:27017/beamlab"),

  // Auth — JWT secrets are validated separately in authRoutes.ts (crash on missing)
  USE_CLERK: z.string().optional(),
  CLERK_SECRET_KEY: z.string().optional(),
  CLERK_PUBLISHABLE_KEY: z.string().optional(),
  // In-house JWT / session secrets (optional when using Clerk)
  JWT_SECRET: z.string().optional(),
  JWT_REFRESH_SECRET: z.string().optional(),
  SESSION_SECRET: z.string().optional(),

  // CORS
  CORS_ALLOWED_ORIGINS: z.string().optional().default(""),
  FRONTEND_URL: z.string().url().optional().default("http://localhost:5173"),

  // Service-to-service trust
  INTERNAL_SERVICE_SECRET: z.string().optional().default(""),

  // Payments — PhonePe
  PHONEPE_MERCHANT_ID: z.string().optional(),
  PHONEPE_SALT_KEY: z.string().optional(),
  PHONEPE_SALT_INDEX: z.string().optional().default("1"),
  PHONEPE_ENV: z.enum(["UAT", "PRODUCTION"]).optional().default("UAT"),

  // Payments — Razorpay (Live)
  RAZORPAY_KEY_ID: z.string().optional(),
  RAZORPAY_KEY_SECRET: z.string().optional(),
  RAZORPAY_WEBHOOK_SECRET: z.string().optional(),

  // AI
  GEMINI_API_KEY: z.string().optional(),

  // Observability
  SENTRY_DSN: z.string().url().optional(),

  // Inter-service
  PYTHON_API_URL: z.string().url().optional().default("http://localhost:8000"),
  RUST_API_URL: z.string().url().optional().default("http://localhost:8080"),

  // Package metadata (injected by some CI runners)
  npm_package_version: z.string().optional(),

  // Redis — distributed rate limiting & caching
  REDIS_URL: z.string().optional().default("redis://redis:6379"),
  RATE_LIMIT_DISTRIBUTED: z
    .string()
    .optional()
    .transform((v) => v === "true")
    .default("false"),

  // Backpressure lanes
  ANALYSIS_MAX_IN_FLIGHT: z.coerce.number().int().positive().optional().default(5),
  ANALYSIS_MAX_QUEUE: z.coerce.number().int().positive().optional().default(150),
  ANALYSIS_QUEUE_TIMEOUT_MS: z.coerce.number().int().positive().optional().default(45000),
  ADVANCED_MAX_IN_FLIGHT: z.coerce.number().int().positive().optional().default(5),
  ADVANCED_MAX_QUEUE: z.coerce.number().int().positive().optional().default(80),
  ADVANCED_QUEUE_TIMEOUT_MS: z.coerce.number().int().positive().optional().default(60000),
  DESIGN_MAX_IN_FLIGHT: z.coerce.number().int().positive().optional().default(5),
  DESIGN_MAX_QUEUE: z.coerce.number().int().positive().optional().default(100),
  DESIGN_QUEUE_TIMEOUT_MS: z.coerce.number().int().positive().optional().default(45000),
  AI_MAX_IN_FLIGHT: z.coerce.number().int().positive().optional().default(5),
  AI_MAX_QUEUE: z.coerce.number().int().positive().optional().default(50),
  AI_QUEUE_TIMEOUT_MS: z.coerce.number().int().positive().optional().default(30000),

  // Analysis result cache
  ANALYSIS_CACHE_MAX_ENTRIES: z.coerce.number().int().positive().optional().default(500),
  ANALYSIS_CACHE_TTL_MS: z.coerce.number().int().positive().optional().default(600000),

  // Cost-weighted rate limiting
  RATE_LIMIT_COST_BUDGET: z.coerce.number().int().positive().optional().default(200),

  // Azure VM GPU Orchestrator (optional — falls back to Python when absent)
  AZURE_VM_ORCHESTRATOR_URL: z.string().url().optional(),
  AZURE_VM_ORCHESTRATOR_API_KEY: z.string().optional(),
  AZURE_VM_HTTP_TIMEOUT_MS: z.coerce.number().int().positive().optional().default(30_000),
  AZURE_VM_CIRCUIT_THRESHOLD: z.coerce.number().int().positive().optional().default(5),
  AZURE_VM_CIRCUIT_RESET_MS: z.coerce.number().int().positive().optional().default(60_000),
  AZURE_VM_SUBMIT_MAX_RETRIES: z.coerce.number().int().positive().optional().default(3),

  // Optional on-demand VM wake-up (used before GPU job submission)
  AZURE_VM_AUTOSTART_ENABLED: z
    .string()
    .optional()
    .transform((v) => v === "true")
    .default("false"),
  AZURE_VM_SUBSCRIPTION_ID: z.string().optional(),
  AZURE_VM_RESOURCE_GROUP: z.string().optional(),
  AZURE_VM_NAME: z.string().optional(),
  AZURE_TENANT_ID: z.string().optional(),
  AZURE_CLIENT_ID: z.string().optional(),
  AZURE_CLIENT_SECRET: z.string().optional(),
  // Optimization backend selector (rust or python)
  OPTIMIZATION_BACKEND: z.string().optional().default("python"),
});

// ============================================
// VALIDATE
// ============================================

const result = envSchema.safeParse(process.env);

if (!result.success) {
  const formatted = result.error.issues
    .map((i) => `  • ${i.path.join(".")}: ${i.message}`)
    .join("\n");

  const isProduction = process.env.NODE_ENV === "production";

  if (isProduction) {
    logger.error(
      `FATAL: Environment validation failed in PRODUCTION:\n${formatted}`,
    );
    process.exit(1);
  } else {
    logger.warn(
      `Environment validation warnings (non-fatal in dev):\n${formatted}`,
    );
  }
}

/**
 * Typed, validated environment variables.
 * Access via `env.PORT`, `env.MONGODB_URI`, etc.
 */
// In dev mode, re-parse with safe defaults so the process never crashes.
// Use safeParse again to avoid throwing if user-provided values are still invalid.
function buildDevFallback(): z.infer<typeof envSchema> {
  const devOverrides: Record<string, string> = {
    NODE_ENV: process.env.NODE_ENV || "development",
    PORT: process.env.PORT || "3001",
    MONGODB_URI:
      process.env.MONGODB_URI || "mongodb://localhost:27017/beamlab",
    FRONTEND_URL: process.env.FRONTEND_URL || "http://localhost:5173",
    PYTHON_API_URL: process.env.PYTHON_API_URL || "http://localhost:8000",
    RUST_API_URL: process.env.RUST_API_URL || "http://localhost:8080",
  };
  const retry = envSchema.safeParse({ ...process.env, ...devOverrides });
  if (retry.success) return retry.data;
  // Final fallback — return hardcoded safe defaults so the server always boots
  return envSchema.parse(devOverrides);
}

export const env = result.success ? result.data : buildDevFallback();

// ============================================
// PRODUCTION LOCALHOST GUARD
// ============================================
if (env.NODE_ENV === "production") {
  const localhostFields = (
    ["FRONTEND_URL", "PYTHON_API_URL", "RUST_API_URL", "MONGODB_URI"] as const
  ).filter((k) => /localhost|127\.0\.0\.1/i.test(env[k]));

  if (localhostFields.length > 0) {
    logger.error(
      `FATAL: localhost URLs detected in PRODUCTION for: ${localhostFields.join(", ")}. ` +
        "Set the correct production URLs via environment variables.",
    );
    process.exit(1);
  }

  if (!env.SENTRY_DSN) {
    logger.warn(
      "Sentry DSN is not configured — error monitoring is disabled in production.",
    );
  }

  const configuredCorsOrigins = (env.CORS_ALLOWED_ORIGINS ?? "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);

  const hasUnsafeCorsOrigin = configuredCorsOrigins.some(
    (origin) =>
      origin === "*" ||
      /localhost|127\.0\.0\.1/i.test(origin) ||
      /^http:\/\//i.test(origin),
  );

  if (hasUnsafeCorsOrigin) {
    logger.error(
      "FATAL: unsafe CORS_ALLOWED_ORIGINS detected in PRODUCTION. Remove wildcard, localhost, and non-HTTPS origins.",
    );
    process.exit(1);
  }

  const internalServiceSecret = env.INTERNAL_SERVICE_SECRET?.trim() ?? "";
  const looksPlaceholder = /your_|replace|changeme|example|placeholder/i.test(
    internalServiceSecret,
  );

  if (internalServiceSecret.length < 16 || looksPlaceholder) {
    logger.error(
      "FATAL: INTERNAL_SERVICE_SECRET must be configured in PRODUCTION with a non-placeholder value of at least 16 characters.",
    );
    process.exit(1);
  }
}

export type Env = z.infer<typeof envSchema>;
