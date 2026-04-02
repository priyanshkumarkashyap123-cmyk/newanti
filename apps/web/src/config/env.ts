/**
 * ============================================================================
 * ENVIRONMENT CONFIGURATION — Production-Grade
 * ============================================================================
 *
 * Centralized environment variable management with:
 *   - Type-safe accessors with compile-time guarantees
 *   - Runtime validation with actionable error messages
 *   - Frozen config objects (immutable after initialization)
 *   - Performance-optimized (no re-reads from import.meta.env)
 *
 * @version 3.0.0
 */

import { validatePricingConfigReadiness } from './pricing';

// ============================================
// CORE ACCESSORS
// ============================================

/**
 * Validates and returns environment variable with fallback.
 * Logs warnings in dev mode for missing required variables.
 */
function getEnv(key: string, fallback: string = ""): string {
  const value = import.meta.env[key];
  if (value === undefined && !fallback && import.meta.env.DEV) {
    console.warn(
      `⚠️ Environment variable ${key} is not set. Using fallback: "${fallback}"`,
    );
  }
  return (value ?? fallback) as string;
}

/**
 * Get boolean environment variable (accepts "true", "1", "yes")
 */
function getBoolEnv(key: string, fallback: boolean = false): boolean {
  const value = import.meta.env[key];
  if (value === undefined) return fallback;
  return value === "true" || value === "1" || value === "yes";
}

/**
 * Get numeric environment variable with bounds checking
 */
function getNumEnv(key: string, fallback: number, min?: number, max?: number): number {
  const value = import.meta.env[key];
  if (value === undefined) return fallback;
  const num = parseInt(value, 10);
  if (isNaN(num)) return fallback;
  if (min !== undefined && num < min) return min;
  if (max !== undefined && num > max) return max;
  return num;
}

/**
 * Normalize and validate Sentry DSN format.
 * Returns undefined for empty/invalid values so monitoring can fail safe.
 */
export function getValidatedSentryDsn(rawInput: string | undefined = import.meta.env.VITE_SENTRY_DSN): string | undefined {
  const raw = rawInput;
  if (!raw) return undefined;

  const cleaned = String(raw).trim().replace(/^['"]|['"]$/g, "");
  if (!cleaned) return undefined;

  // Common copy/paste artifact from redacted values in logs/docs.
  if (cleaned.includes("…")) {
    if (import.meta.env.DEV) {
      console.warn("⚠️ VITE_SENTRY_DSN appears redacted/truncated; disabling Sentry initialization.");
    }
    return undefined;
  }

  try {
    const parsed = new URL(cleaned);
    const isHttp = parsed.protocol === "https:" || parsed.protocol === "http:";
    const hasPublicKey = Boolean(parsed.username);
    const hasProjectId = /\/\d+$/.test(parsed.pathname);
    const isSentryHost = parsed.hostname.includes("sentry.io");

    if (isHttp && hasPublicKey && hasProjectId && isSentryHost) {
      return cleaned;
    }
  } catch {
    // Ignore and fall through to warning.
  }

  if (import.meta.env.DEV) {
    console.warn("⚠️ VITE_SENTRY_DSN is invalid; disabling Sentry initialization.");
  }
  return undefined;
}

// ============================================
// AUTHENTICATION
// ============================================
export const AUTH_CONFIG = {
  clerkPublishableKey: getEnv("VITE_CLERK_PUBLISHABLE_KEY"),
  isClerkEnabled: Boolean(import.meta.env.VITE_CLERK_PUBLISHABLE_KEY),
} as const;

// ============================================
// API ENDPOINTS
// ============================================
export const API_CONFIG = {
  // Main backend (Node.js/Express)
  baseUrl: getEnv(
    "VITE_API_URL",
    import.meta.env.PROD
      ? "https://beamlab-backend-node-prod.azurewebsites.net"
      : "http://localhost:3001",
  ),

  // Python API (FastAPI)
  pythonUrl: getEnv(
    "VITE_PYTHON_API_URL",
    import.meta.env.PROD
      ? "https://beamlab-backend-python-prod.azurewebsites.net"
      : "http://localhost:8081",
  ),

  // Rust API (High-performance analysis)
  rustUrl: getEnv(
    "VITE_RUST_API_URL",
    import.meta.env.PROD
      ? "https://beamlab-rust-api-prod.azurewebsites.net"
      : "http://localhost:3002",
  ),

  timeout: getNumEnv("VITE_API_TIMEOUT", 30000),

  // WebSocket URL (derived from Python URL for analysis progress)
  wsUrl: getEnv(
    "VITE_WEBSOCKET_URL",
    (() => {
      const pythonUrl = getEnv(
        "VITE_PYTHON_API_URL",
        import.meta.env.PROD
          ? "https://beamlab-backend-python-prod.azurewebsites.net"
          : "http://localhost:8081",
      );
      return (
        pythonUrl.replace("http://", "ws://").replace("https://", "wss://") +
        "/ws"
      );
    })(),
  ),
} as const;

// ============================================
// MONITORING
// ============================================
const VALIDATED_SENTRY_DSN = getValidatedSentryDsn();

export const MONITORING_CONFIG = {
  sentryDsn: VALIDATED_SENTRY_DSN,
  isSentryEnabled: Boolean(VALIDATED_SENTRY_DSN),
  debug: getBoolEnv("VITE_DEBUG", false),
} as const;

// ============================================
// AI / GEMINI
// ============================================
export const AI_CONFIG = {
  /**
   * Gemini API key — ONLY available in development mode.
   * In production, all AI calls are proxied through the backend to keep the key server-side.
   */
  geminiApiKey: import.meta.env.DEV ? getEnv("VITE_GEMINI_API_KEY") : "",
  /** Gemini model to use */
  geminiModel: getEnv("VITE_GEMINI_MODEL", "gemini-2.0-flash"),
  /** Prefer Gemini over local engine when available */
  preferGemini: getBoolEnv("VITE_PREFER_GEMINI", true),
  /** Gemini timeout in ms before falling back to local */
  geminiTimeout: getNumEnv("VITE_GEMINI_TIMEOUT", 10000),
} as const;

// ============================================
// FEATURE FLAGS
// ============================================
export const FEATURES = {
  webgpu: getBoolEnv("VITE_ENABLE_WEBGPU", true),
  collaboration: getBoolEnv("VITE_ENABLE_COLLABORATION", false),
  ai: getBoolEnv("VITE_ENABLE_AI_FEATURES", true),
  sourceMaps: getBoolEnv("VITE_SOURCE_MAPS", import.meta.env.DEV),
} as const;

// Billing bypass is intentionally disabled in production builds.
const BILLING_BYPASS = getBoolEnv("VITE_TEMP_UNLOCK_ALL", false) && !import.meta.env.PROD;

const RAW_PHONEPE_ENV = getEnv("VITE_PHONEPE_ENV", "UAT").toUpperCase();
const NORMALIZED_PHONEPE_ENV = RAW_PHONEPE_ENV === "PRODUCTION" ? "PRODUCTION" : "UAT";
const RAW_PAYMENT_GATEWAY = getEnv("VITE_PAYMENT_GATEWAY", "razorpay").toLowerCase();
const HAS_PHONEPE_MERCHANT = Boolean(import.meta.env.VITE_PHONEPE_MERCHANT_ID);
const HAS_RAZORPAY_KEY = Boolean(import.meta.env.VITE_RAZORPAY_KEY_ID);

function resolveActiveGateway(): "razorpay" | "phonepe" | "both" {
  if (RAW_PAYMENT_GATEWAY !== "razorpay" && import.meta.env.DEV) {
    console.warn('⚠️ PhonePe is disabled in this rollout. Forcing VITE_PAYMENT_GATEWAY to "razorpay".');
  }
  return "razorpay";
}

const RESOLVED_PAYMENT_GATEWAY = resolveActiveGateway();

// ============================================
// PAYMENT
// ============================================
export const PAYMENT_CONFIG = {
  /** PhonePe merchant ID (configured via VITE_PHONEPE_MERCHANT_ID) */
  phonePeMerchantId: getEnv("VITE_PHONEPE_MERCHANT_ID"),
  /** PhonePe environment: UAT (sandbox) or PRODUCTION */
  phonePeEnv: NORMALIZED_PHONEPE_ENV,
  
  /** Razorpay live key ID */
  razorpayKeyId: getEnv("VITE_RAZORPAY_KEY_ID"),

  /** Active payment gateway */
  activeGateway: RESOLVED_PAYMENT_GATEWAY,
  /** Temporary bypass for non-production environments only */
  billingBypass: BILLING_BYPASS,
  /** Force subscription checkout path for testing (hides free/demo experience) */
  forcePaymentTestMode: getBoolEnv("VITE_FORCE_PAYMENT_TEST_MODE", false),
  isPhonePeEnabled: false,
  isRazorpayEnabled: (RESOLVED_PAYMENT_GATEWAY === "razorpay" || RESOLVED_PAYMENT_GATEWAY === "both") && !BILLING_BYPASS,
  isPaymentEnabled: HAS_RAZORPAY_KEY && !BILLING_BYPASS,
} as const;

// ============================================
// PERFORMANCE
// ============================================
export const PERFORMANCE_CONFIG = {
  maxWorkers: getNumEnv("VITE_MAX_WORKERS", typeof navigator !== "undefined" ? navigator.hardwareConcurrency || 4 : 4, 1, 16),
  enablePreload: !import.meta.env.DEV, // Disable preload in dev for faster HMR
  /** Maximum analysis computation time before timeout (ms) */
  analysisTimeout: getNumEnv("VITE_ANALYSIS_TIMEOUT", 120_000, 10_000, 600_000),
  /** Enable performance monitoring */
  enablePerfMonitoring: getBoolEnv("VITE_ENABLE_PERF_MONITORING", import.meta.env.PROD),
} as const;

// ============================================
// APPLICATION
// ============================================
export const APP_ENV = {
  mode: import.meta.env.MODE,
  isDev: import.meta.env.DEV,
  isProd: import.meta.env.PROD,
  baseUrl: import.meta.env.BASE_URL,
} as const;

// ============================================
// VALIDATION
// ============================================
/**
 * Validates critical environment variables on app startup.
 * Separates warnings (non-fatal) from errors (fatal in production).
 * @throws Error if critical variables are missing in production
 */
export function validateEnvironment(): { valid: boolean; warnings: string[]; errors: string[] } {
  const warnings: string[] = [];
  const errors: string[] = [];

  // Critical checks for production
  if (APP_ENV.isProd) {
    if (!AUTH_CONFIG.clerkPublishableKey) {
      warnings.push(
        "VITE_CLERK_PUBLISHABLE_KEY is not configured. Authentication features will not work.",
      );
      console.warn(
        "[Auth] ⚠️ VITE_CLERK_PUBLISHABLE_KEY is not configured.",
      );
    }

    if (!API_CONFIG.baseUrl.startsWith("https://")) {
      errors.push(
        `VITE_API_URL must use HTTPS in production. Current: ${API_CONFIG.baseUrl}`,
      );
    }

    if (API_CONFIG.baseUrl.includes("localhost")) {
      errors.push(
        `VITE_API_URL points to localhost in production. Current: ${API_CONFIG.baseUrl}`,
      );
    }

    if (API_CONFIG.pythonUrl.includes("localhost")) {
      errors.push(
        `VITE_PYTHON_API_URL points to localhost in production. Current: ${API_CONFIG.pythonUrl}`,
      );
    }

    if (API_CONFIG.rustUrl.includes("localhost")) {
      errors.push(
        `VITE_RUST_API_URL points to localhost in production. Current: ${API_CONFIG.rustUrl}`,
      );
    }

    if (!MONITORING_CONFIG.sentryDsn) {
      warnings.push("VITE_SENTRY_DSN is missing, invalid, or redacted — error monitoring is disabled in production.");
    }
  }

  // Environment-agnostic checks
  if (API_CONFIG.timeout < 5000) {
    warnings.push(`API timeout is very low (${API_CONFIG.timeout}ms). This may cause premature failures.`);
  }

  // Payment gateway readiness checks (Razorpay-only rollout)
  if (!PAYMENT_CONFIG.razorpayKeyId && !PAYMENT_CONFIG.billingBypass) {
    warnings.push('Razorpay key is missing (VITE_RAZORPAY_KEY_ID). Checkout will be disabled.');
  }

  // Pricing/checkout mapping readiness checks
  const pricingReadiness = validatePricingConfigReadiness();
  if (!pricingReadiness.valid) {
    errors.push(...pricingReadiness.errors.map((e) => `[pricing] ${e}`));
  }
  if (pricingReadiness.warnings.length > 0) {
    warnings.push(...pricingReadiness.warnings.map((w) => `[pricing] ${w}`));
  }

  if (errors.length > 0) {
    const msg = `❌ Environment Configuration Errors:\n${errors.map((e) => `  - ${e}`).join("\n")}`;
    if (APP_ENV.isProd) {
      throw new Error(msg);
    }
    console.error(msg);
  }

  if (warnings.length > 0) {
    console.warn(`⚠️ Environment Warnings:\n${warnings.map((w) => `  - ${w}`).join("\n")}`);
  }

  // Log configuration in development
  if (APP_ENV.isDev && MONITORING_CONFIG.debug) {
    console.log("🔧 Environment Configuration:", {
      mode: APP_ENV.mode,
      Shahidapi: API_CONFIG.baseUrl,
      pythonApi: API_CONFIG.pythonUrl,
      features: FEATURES,
      payment: PAYMENT_CONFIG.isPaymentEnabled ? "enabled" : "disabled",
    });
  }

  return { valid: errors.length === 0, warnings, errors };
}

// Export everything as default for convenient access
export default {
  auth: AUTH_CONFIG,
  api: API_CONFIG,
  ai: AI_CONFIG,
  monitoring: MONITORING_CONFIG,
  features: FEATURES,
  payment: PAYMENT_CONFIG,
  performance: PERFORMANCE_CONFIG,
  app: APP_ENV,
  validate: validateEnvironment,
} as const;
