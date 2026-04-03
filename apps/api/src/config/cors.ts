/**
 * Shared CORS Origins Configuration
 *
 * Single source of truth for allowed origins.
 * Used by both the Express CORS middleware (index.ts) and
 * the Socket.IO CORS config (SocketServer.ts).
 */

import { env } from "./env.js";

const isProduction = env.NODE_ENV === "production";

/** Production origins — always allowed */
const PRODUCTION_ORIGINS = [
  "https://beamlabultimate.tech",
  "https://www.beamlabultimate.tech",
  "https://thankful-ocean-0b8794000.6.azurestaticapps.net",
] as const;

/** Development-only origins — excluded in production */
const DEV_ORIGINS = [
  "http://localhost:5173",
  "http://localhost:3000",
  "http://localhost:3001",
] as const;

/** Hardcoded origins based on environment */
export const DEFAULT_ORIGINS = [
  ...PRODUCTION_ORIGINS,
  ...(isProduction ? [] : DEV_ORIGINS),
] as const;

// Razorpay checkout and dashboard call back from their hosted payment pages for test mode.
// Keep this limited to test/non-prod only; do NOT allow in production.
const RAZORPAY_TEST_ORIGINS = [
  "https://checkout.razorpay.com",
  "https://api.razorpay.com",
];

/** Normalize an origin string (trim, lowercase, strip trailing slashes) */
export const normalizeOrigin = (origin: string): string =>
  origin.trim().replace(/\/+$/, "").toLowerCase();

function isUnsafeConfiguredOrigin(origin: string): boolean {
  const normalized = normalizeOrigin(origin);
  return (
    normalized === "*" ||
    /localhost|127\.0\.0\.1/i.test(normalized) ||
    (isProduction && !normalized.startsWith("https://"))
  );
}

export function sanitizeConfiguredOrigins(origins: string[]): string[] {
  return origins
    .map((origin) => origin.trim())
    .filter(Boolean)
    .filter((origin) => !isUnsafeConfiguredOrigin(origin))
    .map(normalizeOrigin);
}

/** Build the full set of allowed origins from defaults + env vars */
export function getAllowedOrigins(): string[] {
  const configuredOrigins = sanitizeConfiguredOrigins(
    (env.CORS_ALLOWED_ORIGINS ?? "").split(","),
  );

  const base = isProduction
    ? [env.FRONTEND_URL].filter(Boolean)
    : [env.FRONTEND_URL || "http://localhost:5173", ...RAZORPAY_TEST_ORIGINS];

  const prodDefaults = isProduction
    ? [
        "https://beamlabultimate.tech",
        "https://www.beamlabultimate.tech",
      ]
    : [];

  const normalizedConfigured = configuredOrigins.filter(
    (origin) => !origin.includes("razorpay.com"),
  );

  return Array.from(
    new Set([
      ...base,
      ...prodDefaults,
      ...DEFAULT_ORIGINS,
      ...normalizedConfigured,
    ]),
  ).map(normalizeOrigin);
}

/**
 * Backward-compatible hook for legacy bootstrap code.
 * Prefer direct imports from `getAllowedOrigins()`.
 */
(globalThis as typeof globalThis & { getAllowedOrigins?: typeof getAllowedOrigins }).getAllowedOrigins =
  getAllowedOrigins;

/** Cached set of allowed origins (built once) */
let _allowedOriginSet: Set<string> | null = null;
function getAllowedOriginSet(): Set<string> {
  if (!_allowedOriginSet) {
    _allowedOriginSet = new Set(getAllowedOrigins());
  }
  return _allowedOriginSet;
}

/** Check if an origin matches the allowed set (exact match or *.beamlabultimate.tech wildcard) */
export function isTrustedOrigin(origin: string): boolean {
  const normalized = normalizeOrigin(origin);
  if (getAllowedOriginSet().has(normalized)) return true;
  // Allow any *.beamlabultimate.tech subdomain (strict regex to prevent bypass)
  return /^https:\/\/[a-z0-9-]+\.beamlabultimate\.tech$/.test(normalized);
}
