/**
 * GPU Jobs Routes
 *
 * High-cost structural analyses that benefit from GPU acceleration
 * (P-Delta, nonlinear FEM, buckling eigenvalue, dynamic modal) are
 * dispatched here.  The route layer is thin: it validates the request,
 * delegates to vmOrchestrator, and lets the service decide whether to
 * send the work to the Azure VM fleet or to the Python backend fallback.
 *
 * Endpoint summary:
 *   POST   /api/v1/gpu-jobs            submit a GPU job
 *   GET    /api/v1/gpu-jobs/queue      GPU fleet queue stats
 *   GET    /api/v1/gpu-jobs/:id        poll job status / retrieve result
 *   DELETE /api/v1/gpu-jobs/:id        cancel a job
 */

import express, { Router, Request, Response } from "express";
import { createHash } from "crypto";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { logger } from "../../utils/logger.js";
import { getAuth } from "../../middleware/authMiddleware.js";
import { GpuJobIdempotency } from "../../models/gpuJobIdempotency.js";
import {
  submitGpuJob,
  getGpuJobStatus,
  cancelGpuJob,
  checkVmHealth,
  isVmOrchestratorConfigured,
  getCircuitStats,
  type VmJobPayload,
} from "../../services/vmOrchestrator.js";
import {
  recordGpuJobDispatchSource,
  recordGpuJobSubmission,
  recordGpuJobTerminalStatus,
} from "../../services/gpuAutoscaleTelemetry.js";

const router: Router = express.Router();

// ============================================
// Helpers
// ============================================

function getRequestId(req: Request, res: Response): string {
  const rid = res.locals.requestId || req.get("x-request-id");
  return typeof rid === "string" && rid.length > 0 ? rid : "unknown";
}

/** Allowlist of recognised solver names to prevent injection into downstream workers */
const ALLOWED_SOLVERS = new Set([
  "fem3d",
  "pdelta",
  "modal",
  "buckling",
  "nonlinear",
  "cable",
  "response_spectrum",
  "time_history",
  "pushover",
]);

function computeRequestHash(payload: VmJobPayload): string {
  return createHash("sha256")
    .update(JSON.stringify({
      solver: payload.solver,
      input: payload.input,
      priority: payload.priority ?? "normal",
    }))
    .digest("hex");
}

function parseIdempotencyKey(req: Request, body: Partial<VmJobPayload>): string | undefined {
  const headerValue = req.get("x-idempotency-key");
  if (typeof headerValue === "string" && headerValue.trim().length > 0) {
    return headerValue.trim();
  }

  if (typeof body.idempotencyKey === "string" && body.idempotencyKey.trim().length > 0) {
    return body.idempotencyKey.trim();
  }

  return undefined;
}

// ============================================
// POST /gpu-jobs  — Submit a GPU job
// ============================================

router.post(
  "/",
  asyncHandler(async (req: Request, res: Response) => {
    const requestId = getRequestId(req, res);
    const body = req.body as Partial<VmJobPayload>;

    // Input validation — kept minimal: heavy schema validation happens inside the worker
    if (!body.solver || typeof body.solver !== "string") {
      res.status(400).json({
        success: false,
        error: "solver field is required and must be a string",
        code: "VALIDATION_ERROR",
        requestId,
      });
      return;
    }

    if (!ALLOWED_SOLVERS.has(body.solver)) {
      res.status(400).json({
        success: false,
        error: `Unknown solver '${body.solver}'. Allowed: ${[...ALLOWED_SOLVERS].join(", ")}`,
        code: "UNKNOWN_SOLVER",
        requestId,
      });
      return;
    }

    if (!body.input || typeof body.input !== "object" || Array.isArray(body.input)) {
      res.status(400).json({
        success: false,
        error: "input field is required and must be an object",
        code: "VALIDATION_ERROR",
        requestId,
      });
      return;
    }

    const payload: VmJobPayload = {
      solver: body.solver,
      input: body.input,
      idempotencyKey: parseIdempotencyKey(req, body),
      priority:
        body.priority === "low" || body.priority === "high" ? body.priority : "normal",
    };

    const auth = getAuth(req);
    const userId = auth.userId ?? "anonymous";
    const requestHash = computeRequestHash(payload);
    let hasIdempotencyLock = false;

    if (payload.idempotencyKey) {
      const existing = await GpuJobIdempotency.findOne({
        userId,
        idempotencyKey: payload.idempotencyKey,
      }).lean();

      if (existing) {
        if (existing.requestHash !== requestHash) {
          res.status(409).json({
            success: false,
            error: "Idempotency key has already been used with a different payload",
            code: "IDEMPOTENCY_KEY_CONFLICT",
            requestId,
          });
          return;
        }

        if (existing.state === "completed" && existing.responsePayload) {
          res.status(202).json({
            success: true,
            requestId,
            idempotentReplay: true,
            source: existing.source ?? "vm",
            ...(existing.responsePayload ?? {}),
          });
          return;
        }

        res.status(409).json({
          success: false,
          error: "This idempotency key is already being processed. Retry shortly.",
          code: "IDEMPOTENCY_IN_PROGRESS",
          requestId,
        });
        return;
      }

      try {
        await GpuJobIdempotency.create({
          userId,
          idempotencyKey: payload.idempotencyKey,
          requestHash,
          state: "processing",
        });
        hasIdempotencyLock = true;
      } catch (err: unknown) {
        const maybeDuplicate = err as { code?: number };
        if (maybeDuplicate?.code === 11000) {
          const replayDoc = await GpuJobIdempotency.findOne({
            userId,
            idempotencyKey: payload.idempotencyKey,
          }).lean();

          if (replayDoc?.requestHash === requestHash && replayDoc.responsePayload) {
            res.status(202).json({
              success: true,
              requestId,
              idempotentReplay: true,
              source: replayDoc.source ?? "vm",
              ...(replayDoc.responsePayload ?? {}),
            });
            return;
          }
        }

        throw err;
      }
    }

    logger.info(
      { solver: payload.solver, requestId },
      "[GpuJobs] Submitting job",
    );

    recordGpuJobSubmission();
    const result = await submitGpuJob(payload);
    recordGpuJobDispatchSource(result.source);

    if (hasIdempotencyLock && payload.idempotencyKey) {
      await GpuJobIdempotency.updateOne(
        { userId, idempotencyKey: payload.idempotencyKey },
        {
          $set: {
            state: "completed",
            source: result.source,
            responsePayload: (result.data as Record<string, unknown>) ?? {},
          },
        },
      );
    }

    res.status(202).json({
      success: true,
      source: result.source,
      requestId,
      ...((result.data as Record<string, unknown>) ?? {}),
    });
  }),
);

// ============================================
// GET /gpu-jobs/queue  — Queue / fleet stats
// ============================================

router.get(
  "/queue",
  asyncHandler(async (_req: Request, res: Response) => {
    const health = await checkVmHealth();
    const circuitStats = getCircuitStats();

    res.json({
      success: true,
      fleet: {
        configured: isVmOrchestratorConfigured(),
        healthy: health.healthy,
        activeWorkers: health.activeWorkers,
        queueDepth: health.queueDepth,
        latencyMs: health.latencyMs,
      },
      circuitBreaker: {
        open: circuitStats.isOpen,
        failures: circuitStats.failures,
      },
    });
  }),
);

// ============================================
// GET /gpu-jobs/:id  — Poll job status
// ============================================

router.get(
  "/:id",
  asyncHandler(async (req: Request, res: Response) => {
    const requestId = getRequestId(req, res);
    const jobId = req.params["id"] ?? "";

    if (!jobId || jobId.length > 128) {
      res.status(400).json({
        success: false,
        error: "Invalid job ID",
        code: "VALIDATION_ERROR",
        requestId,
      });
      return;
    }

    const result = await getGpuJobStatus(jobId);
    const status = (result.data as { status?: string } | undefined)?.status;
    if (status === "completed" || status === "failed" || status === "cancelled" || status === "timeout") {
      recordGpuJobTerminalStatus(status);
    }

    res.json({
      success: true,
      source: result.source,
      requestId,
      ...((result.data as Record<string, unknown>) ?? {}),
    });
  }),
);

// ============================================
// DELETE /gpu-jobs/:id  — Cancel a job
// ============================================

router.delete(
  "/:id",
  asyncHandler(async (req: Request, res: Response) => {
    const requestId = getRequestId(req, res);
    const jobId = req.params["id"] ?? "";

    if (!jobId || jobId.length > 128) {
      res.status(400).json({
        success: false,
        error: "Invalid job ID",
        code: "VALIDATION_ERROR",
        requestId,
      });
      return;
    }

    const result = await cancelGpuJob(jobId);
    recordGpuJobTerminalStatus("cancelled");

    res.json({
      success: true,
      source: result.source,
      requestId,
      ...((result.data as Record<string, unknown>) ?? {}),
    });
  }),
);

export default router;
