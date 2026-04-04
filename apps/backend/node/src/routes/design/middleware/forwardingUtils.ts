/**
 * Design Routes - Common utilities and forwarding logic
 * Shared by all design code backends (steel, concrete, geotech)
 */

import { Request, Response } from "express";
import { pythonProxy, rustProxy } from "../../../services/serviceProxy.js";
import { logger } from "../../../utils/logger.js";
import { assertDesignPayload } from "../../../utils/proxyContracts.js";

export type BackendService = "rust" | "python";

type ProxyEnvelope = {
  success: boolean;
  status: number;
  data?: unknown;
  error?: string;
  service: string;
  latencyMs: number;
};

type DesignRouteError = Error & {
  status?: number;
  code?: string;
};

/**
 * Configuration for design backend selection
 */
export const DESIGN_PRIMARY_ENGINE = (
  process.env["DESIGN_PRIMARY_ENGINE"] || "rust"
).toLowerCase() as BackendService;

const DEFAULT_TIMEOUT_FALLBACK_MS = 30_000;

function parsePositiveInt(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  if (Number.isFinite(parsed) && parsed > 0) {
    return parsed;
  }
  return fallback;
}

export const DESIGN_DEFAULT_TIMEOUT_MS = parsePositiveInt(
  process.env["DESIGN_TIMEOUT_MS"],
  DEFAULT_TIMEOUT_FALLBACK_MS,
);

/**
 * Extract request ID from request or response context
 */
export function getRequestId(req: Request, res: Response): string | undefined {
  const rid = res.locals.requestId || req.get("x-request-id");
  return typeof rid === "string" && rid.length > 0 ? rid : undefined;
}

/**
 * Call backend service (Rust or Python) with timeout and logging
 */
export async function callBackend(
  service: BackendService,
  path: string,
  body: unknown,
  timeoutMs: number,
  requestId?: string,
): Promise<ProxyEnvelope> {
  logger.debug(
    { service, path, timeoutMs, requestId },
    "Calling design backend"
  );

  try {
    if (service === "rust") {
      return rustProxy("POST", path, body, undefined, timeoutMs, requestId);
    }
    return pythonProxy("POST", path, body, undefined, timeoutMs, requestId);
  } catch (err) {
    logger.error(
      { err, service, path, timeoutMs },
      `Design backend ${service} call failed`
    );
    throw err;
  }
}

/**
 * Forward design request to appropriate backend with fallback
 * Tries Rust first (if enabled), falls back to Python if Rust fails
 */
export async function forwardDesignRequest(options: {
  req: Request;
  res: Response;
  rustPath?: string;
  pythonPath?: string;
  body: unknown;
  label: string;
  timeoutMs?: number;
}): Promise<{ success: true; engine: BackendService; result: unknown }> {
  const {
    req,
    res,
    rustPath,
    pythonPath,
    body,
    label,
    timeoutMs = DESIGN_DEFAULT_TIMEOUT_MS,
  } = options;
  const requestId = getRequestId(req, res);

  const preferRust = DESIGN_PRIMARY_ENGINE !== "python";
  const order: Array<{ service: BackendService; path: string }> = preferRust
    ? [
        ...(rustPath ? [{ service: "rust" as const, path: rustPath }] : []),
        ...(pythonPath ? [{ service: "python" as const, path: pythonPath }] : []),
      ]
    : [
        ...(pythonPath ? [{ service: "python" as const, path: pythonPath }] : []),
        ...(rustPath ? [{ service: "rust" as const, path: rustPath }] : []),
      ];

  let lastError: DesignRouteError | undefined;

  for (const { service, path } of order) {
    try {
      logger.debug(
        { service, path, requestId },
        `[${label}] Attempting ${service} backend`
      );
      const result = await callBackend(service, path, body, timeoutMs, requestId);

      if (!result.success) {
        const err = new Error(
          result.error || `${label} failed via ${service}`
        ) as DesignRouteError;
        err.status = result.status || 502;
        err.code = "UPSTREAM_ERROR";
        lastError = err;
        throw err;
      }

      const guard = assertDesignPayload(result.data, label);
      if (!guard.ok) {
        const err = new Error(
          "Invalid design payload from upstream service"
        ) as DesignRouteError;
        err.status = 502;
        err.code = "UPSTREAM_CONTRACT_ERROR";
        lastError = err;
        throw err;
      }

      logger.info(
        { service, path, requestId },
        `[${label}] ✅ ${service} backend succeeded`
      );
      return {
        success: true,
        engine: service,
        result: result.data,
      };
    } catch (err) {
      const typedErr = err as DesignRouteError;
      if (typedErr?.code === "UPSTREAM_CONTRACT_ERROR") {
        throw typedErr;
      }

      logger.warn(
        { err, service, path, requestId },
        `[${label}] ${service} backend failed, trying next...`
      );
      lastError = typedErr;
      // Continue to next backend in order
    }
  }

  if (lastError) {
    throw lastError;
  }

  const err = new Error(
    `[${label}] All design backends failed. Check logs for details.`
  ) as DesignRouteError;
  err.status = 502;
  err.code = "UPSTREAM_ERROR";
  throw err;
}

function sendSuccess(res: Response, payload: unknown, status = 200): void {
  if (typeof res.ok === "function") {
    res.ok(payload, status);
    return;
  }
  res.status(status).json(payload);
}

function sendFailure(
  res: Response,
  message: string,
  status = 500,
  extras?: Record<string, unknown>
): void {
  if (typeof res.fail === "function") {
    const code = (extras && typeof extras.code === "string") ? extras.code : "UPSTREAM_ERROR";
    res.fail(code, message, status);
    return;
  }
  res.status(status).json({
    success: false,
    error: message,
    code: (extras && extras.code) || "UPSTREAM_ERROR",
    ...(extras || {}),
  });
}

/**
 * Create a design route handler with validation, forwarding, and error handling
 */
export function createDesignRouteHandler(options: {
  rustPath?: string;
  pythonPath?: string;
  label: string;
  validateFn?: (body: unknown) => void;
  timeoutMs?: number;
}) {
  return async (req: Request, res: Response) => {
    try {
      const { rustPath, pythonPath, label, validateFn, timeoutMs } = options;

      // Optional validation
      if (validateFn) {
        validateFn(req.body);
      }

      // Forward to backend
      const result = await forwardDesignRequest({
        req,
        res,
        rustPath,
        pythonPath,
        body: req.body,
        label,
        timeoutMs: timeoutMs ?? DESIGN_DEFAULT_TIMEOUT_MS,
      });

      sendSuccess(res, result);
    } catch (err) {
      logger.error({ err, label: options.label }, "Design route error");
      const typedErr = err as DesignRouteError;
      const message = err instanceof Error ? err.message : "Design route error";
      const status = typedErr.status || 500;
      const extras = typedErr.code ? { code: typedErr.code } : undefined;
      sendFailure(res, message, status, extras);
    }
  };
}
