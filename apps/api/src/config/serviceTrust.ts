import { env } from "./env.js";

export const INTERNAL_SERVICE_HEADER = "X-Internal-Service";
export const INTERNAL_CALLER_HEADER = "X-Internal-Caller";
export const FORWARDED_BY_HEADER = "X-Forwarded-By";
export const INTERNAL_CALLER_NAME = "beamlab-node-gateway";

export function isPlaceholderSecret(secret: string): boolean {
  return /your_|replace|changeme|example|placeholder/i.test(secret);
}

export function isValidInternalServiceSecret(secret: string | undefined | null): boolean {
  const normalized = secret?.trim() ?? "";
  return normalized.length >= 16 && !isPlaceholderSecret(normalized);
}

export function getInternalServiceHeaders(requestId?: string): Record<string, string> {
  const headers: Record<string, string> = {
    [FORWARDED_BY_HEADER]: INTERNAL_CALLER_NAME,
    [INTERNAL_CALLER_HEADER]: INTERNAL_CALLER_NAME,
  };

  if (requestId) {
    headers["X-Request-ID"] = requestId;
  }

  if (isValidInternalServiceSecret(env.INTERNAL_SERVICE_SECRET)) {
    headers[INTERNAL_SERVICE_HEADER] = env.INTERNAL_SERVICE_SECRET.trim();
  }

  return headers;
}

export function assertServiceTrustConfigured(): { ok: true } | { ok: false; reason: string } {
  if (env.NODE_ENV !== "production") {
    return { ok: true };
  }

  if (!isValidInternalServiceSecret(env.INTERNAL_SERVICE_SECRET)) {
    return {
      ok: false,
      reason:
        "INTERNAL_SERVICE_SECRET is missing, too short, or still using a placeholder value",
    };
  }

  return { ok: true };
}
