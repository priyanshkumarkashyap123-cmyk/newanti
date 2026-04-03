import { env } from "./env.js";
import { createHmac } from "crypto";
import { randomUUID } from "crypto";

export const INTERNAL_SERVICE_HEADER = "X-Internal-Service";
export const INTERNAL_CALLER_HEADER = "X-Internal-Caller";
export const FORWARDED_BY_HEADER = "X-Forwarded-By";
export const INTERNAL_TIMESTAMP_HEADER = "X-Internal-Timestamp";
export const INTERNAL_SIGNATURE_HEADER = "X-Internal-Signature";
export const INTERNAL_NONCE_HEADER = "X-Internal-Nonce";
export const INTERNAL_CALLER_NAME = "beamlab-node-gateway";

export function isPlaceholderSecret(secret: string): boolean {
  return /your_|replace|changeme|example|placeholder/i.test(secret);
}

export function isValidInternalServiceSecret(secret: string | undefined | null): boolean {
  const normalized = secret?.trim() ?? "";
  return normalized.length >= 16 && !isPlaceholderSecret(normalized);
}

function buildInternalSignature(secret: string, caller: string, timestampSec: number, nonce: string, requestId?: string): string {
  const message = `${caller}:${timestampSec}:${nonce}:${requestId ?? ""}`;
  return createHmac("sha256", secret).update(message).digest("hex");
}

export function getInternalServiceHeaders(requestId?: string): Record<string, string> {
  const effectiveRequestId = requestId?.trim() || randomUUID();

  const headers: Record<string, string> = {
    [FORWARDED_BY_HEADER]: INTERNAL_CALLER_NAME,
    [INTERNAL_CALLER_HEADER]: INTERNAL_CALLER_NAME,
    "X-Request-ID": effectiveRequestId,
  };

  if (isValidInternalServiceSecret(env.INTERNAL_SERVICE_SECRET)) {
    const timestampSec = Math.floor(Date.now() / 1000);
    const nonce = randomUUID();
    headers[INTERNAL_TIMESTAMP_HEADER] = String(timestampSec);
    headers[INTERNAL_NONCE_HEADER] = nonce;
    headers[INTERNAL_SIGNATURE_HEADER] = buildInternalSignature(
      env.INTERNAL_SERVICE_SECRET.trim(),
      INTERNAL_CALLER_NAME,
      timestampSec,
      nonce,
      effectiveRequestId,
    );

    if (env.NODE_ENV !== "production") {
      // Transitional compatibility for local and mixed-version environments.
      headers[INTERNAL_SERVICE_HEADER] = env.INTERNAL_SERVICE_SECRET.trim();
    }
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
