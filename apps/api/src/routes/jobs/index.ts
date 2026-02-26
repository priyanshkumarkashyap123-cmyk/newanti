/**
 * Job Queue Routes - Proxies to Python backend for job queue management
 *
 * CANONICAL OWNER: Python backend (real Celery/asyncio worker pool)
 * This file is a THIN PROXY. No job processing runs in Node.js.
 */

import express, { Router, Request, Response } from "express";
import { pythonProxy } from "../../services/serviceProxy.js";

const router: Router = express.Router();

// ============================================
// Helper: Forward to Python
// ============================================

async function forwardToPython(
  method: "GET" | "POST" | "DELETE",
  pythonPath: string,
  body: unknown | undefined,
  res: Response,
  label: string,
  timeoutMs = 30_000,
): Promise<void> {
  try {
    const result = await pythonProxy(
      method,
      pythonPath,
      body,
      undefined,
      timeoutMs,
    );
    if (result.success) {
      res.json(result.data);
    } else {
      res.status(result.status || 500).json({
        success: false,
        error: result.error || `${label} failed`,
        service: "python",
      });
    }
  } catch (error) {
    console.error(`[Jobs/${label}] Error:`, error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : `${label} failed`,
    });
  }
}

// ============================================
// POST /jobs - Submit a new job (alias for /jobs/submit)
// ============================================

router.post("/", async (req: Request, res: Response) => {
  await forwardToPython("POST", "/api/jobs/submit", req.body, res, "Submit");
});

router.post("/submit", async (req: Request, res: Response) => {
  await forwardToPython("POST", "/api/jobs/submit", req.body, res, "Submit");
});

// ============================================
// GET /jobs/queue/status - Queue statistics
// ============================================

router.get("/queue/status", async (_req: Request, res: Response) => {
  await forwardToPython(
    "GET",
    "/api/jobs/queue/status",
    undefined,
    res,
    "QueueStatus",
  );
});

// ============================================
// GET /jobs/:id - Get job status
// ============================================

router.get("/:id", async (req: Request, res: Response) => {
  const jobId = req.params["id"] ?? "";
  await forwardToPython("GET", `/api/jobs/${jobId}`, undefined, res, "Status");
});

// ============================================
// DELETE /jobs/:id - Cancel a job
// ============================================

router.delete("/:id", async (req: Request, res: Response) => {
  const jobId = req.params["id"] ?? "";
  await forwardToPython(
    "DELETE",
    `/api/jobs/${jobId}`,
    undefined,
    res,
    "Cancel",
  );
});

export default router;
