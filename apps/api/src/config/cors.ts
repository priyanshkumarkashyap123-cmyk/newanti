/**
 * Shared CORS Origins Configuration
 *
 * Single source of truth for allowed origins.
 * Used by both the Express CORS middleware (index.ts) and
 * the Socket.IO CORS config (SocketServer.ts).
 */

import { env } from "./env.js";

/** Hardcoded origins that are always allowed */
export const DEFAULT_ORIGINS = [
  "http://localhost:5173",
  "http://localhost:3000",
  "https://beamlabultimate.tech",
  "https://www.beamlabultimate.tech",
  "https://brave-mushroom-0eae8ec00.4.azurestaticapps.net",
] as const;

/** Normalize an origin string (trim, lowercase, strip trailing slashes) */
export const normalizeOrigin = (origin: string): string =>
  origin.trim().replace(/\/+$/, "").toLowerCase();

/** Build the full set of allowed origins from defaults + env vars */
export function getAllowedOrigins(): string[] {
  const configuredOrigins = (env.CORS_ALLOWED_ORIGINS ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  return Array.from(
    new Set([
      env.FRONTEND_URL || "http://localhost:5173",
      ...DEFAULT_ORIGINS,
      ...configuredOrigins,
    ]),
  ).map(normalizeOrigin);
}

/** Check if an origin matches the allowed set (exact match or *.beamlabultimate.tech wildcard) */
export function isTrustedOrigin(origin: string): boolean {
  const normalized = normalizeOrigin(origin);
  const allowedSet = new Set(getAllowedOrigins());
  if (allowedSet.has(normalized)) return true;
  // Allow any *.beamlabultimate.tech subdomain
  return normalized.endsWith(".beamlabultimate.tech");
}
