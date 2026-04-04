/**
 * Job Queue Routes - Proxies to Python backend for job queue management
 *
 * CANONICAL OWNER: Python backend (real Celery/asyncio worker pool)
 * This file is a THIN PROXY. No job processing runs in Node.js.
 */

import express, { Router, Request, Response } from "express";
import { pythonProxy } from "../../services/serviceProxy.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { logger } from "../../utils/logger.js";
import { assertProxyObjectPayload } from "../../utils/proxyContracts.js";

const router: Router = express.Router();

function getRequestId(req: Request, res: Response): string | undefined {
  const rid = res.locals.requestId || req.get("x-request-id");
  return typeof rid === "string" && rid.length > 0 ? rid : undefined;
}

// ============================================
// Helper: Forward to Python
// ============================================

async function forwardToPython(
  method: "GET" | "POST" | "DELETE",
  pythonPath: string,
  body: unknown | undefined,
  req: Request,
  res: Response,
  label: string,
  timeoutMs = 30_000,
): Promise<void> {
  try {
    const requestId = getRequestId(req, res);
    const result = await pythonProxy(
      method,
      pythonPath,
      body,
      undefined,
      timeoutMs,
      requestId,
    );
    if (result.success) {
      const guard = assertProxyObjectPayload(result.data, `Jobs/${label}`);
      if (!guard.ok) {
        logger.error({ reason: guard.reason, requestId }, `[Jobs/${label}] Invalid upstream payload`);
        res.status(502).json({
          success: false,
          error: "Invalid jobs payload from upstream service",
          code: "UPSTREAM_CONTRACT_ERROR",
          requestId,
        });
        return;
      }

      res.json(result.data);
    } else {
      res.status(result.status || 500).json({
        success: false,
        error: result.error || `${label} failed`,
        service: "python",
      });
    }
  } catch (error) {
    logger.error({ err: error }, `[Jobs/${label}] Error`);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : `${label} failed`,
    });
  }
}

// ============================================
// POST /jobs - Submit a new job (alias for /jobs/submit)
// ============================================

router.post("/", asyncHandler(async (req: Request, res: Response) => {
  await forwardToPython("POST", "/api/jobs/submit", req.body, req, res, "Submit");
}));

router.post("/submit", asyncHandler(async (req: Request, res: Response) => {
  await forwardToPython("POST", "/api/jobs/submit", req.body, req, res, "Submit");
}));

// ============================================
// GET /jobs/queue/status - Queue statistics
// ============================================

router.get("/queue/status", asyncHandler(async (req: Request, res: Response) => {
  await forwardToPython(
    "GET",
    "/api/jobs/queue/status",
    undefined,
    req,
    res,
    "QueueStatus",
  );
}));

// ============================================
// GET /jobs/:id - Get job status
// ============================================

router.get("/:id", asyncHandler(async (req: Request, res: Response) => {
  const jobId = req.params["id"] ?? "";
  await forwardToPython("GET", `/api/jobs/${jobId}`, undefined, req, res, "Status");
}));

// ============================================
// DELETE /jobs/:id - Cancel a job
// ============================================

router.delete("/:id", asyncHandler(async (req: Request, res: Response) => {
  const jobId = req.params["id"] ?? "";
  await forwardToPython(
    "DELETE",
    `/api/jobs/${jobId}`,
    undefined,
    req,
    res,
    "Cancel",
  );
}));

export default router;
