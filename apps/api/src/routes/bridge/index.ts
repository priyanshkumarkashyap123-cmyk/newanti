/**
 * Bridge Routes — Proxies to Rust (templates) and Python (AI/validation/PINN)
 *
 * CANONICAL OWNERS:
 *   - Rust: Templates (beam, truss, frame, portal)
 *   - Python: AI generation, validation, PINN training/inference
 *
 * This file is a THIN PROXY. No bridge logic runs in Node.js.
 */

import express, { Router, Request, Response } from "express";
import { rustProxy, pythonProxy } from "../../services/serviceProxy.js";
import { requireAuth } from "../../middleware/authMiddleware.js";
import { asyncHandler, HttpError } from "../../utils/asyncHandler.js";
import { logger } from "../../utils/logger.js";
import { assertProxyObjectPayload } from "../../utils/proxyContracts.js";

const router: Router = express.Router();

function getRequestId(req: Request, res: Response): string | undefined {
    const rid = res.locals.requestId || req.get("x-request-id");
    return typeof rid === "string" && rid.length > 0 ? rid : undefined;
}

// All bridge routes require authentication
router.use(requireAuth());

// ============================================
// Helpers
// ============================================

async function forwardToRust(
    path: string,
    query: Record<string, string>,
    req: Request,
    res: Response,
    label: string,
    timeoutMs = 30_000,
): Promise<void> {
    try {
        const requestId = getRequestId(req, res);
        const result = await rustProxy("GET", path, undefined, query, timeoutMs, requestId);
        if (result.success) {
            const guard = assertProxyObjectPayload(result.data, `Bridge/${label}`);
            if (!guard.ok) {
                logger.error({ reason: guard.reason, requestId }, `[Bridge/${label}] Invalid upstream payload`);
                res.status(502).json({
                    success: false,
                    error: "Invalid bridge payload from upstream service",
                    code: "UPSTREAM_CONTRACT_ERROR",
                    requestId,
                });
                return;
            }
            res.json(result.data);
        } else {
            logger.error({ err: result.error }, `[Bridge/${label}] Rust API error`);
            res.status(result.status || 500).json({ success: false, error: result.error || `${label} failed`, service: "rust" });
        }
    } catch (error) {
        logger.error({ err: error }, `[Bridge/${label}] Error`);
        res.status(500).json({ success: false, error: `${label} failed` });
    }
}

async function forwardToPython(
    path: string,
    method: "GET" | "POST",
    body: unknown,
    req: Request,
    res: Response,
    label: string,
    timeoutMs = 60_000,
): Promise<void> {
    try {
        const requestId = getRequestId(req, res);
        const result = await pythonProxy(method, path, body, undefined, timeoutMs, requestId);
        if (result.success) {
            // AI endpoints may return arbitrary shapes; skip strict guard, but ensure object payload
            const guard = assertProxyObjectPayload(result.data, `Bridge/${label}`);
            if (!guard.ok) {
                logger.error({ reason: guard.reason, requestId }, `[Bridge/${label}] Invalid upstream payload`);
                res.status(502).json({
                    success: false,
                    error: "Invalid bridge payload from upstream service",
                    code: "UPSTREAM_CONTRACT_ERROR",
                    requestId,
                });
                return;
            }
            res.json(result.data);
        } else {
            logger.error({ err: result.error }, `[Bridge/${label}] Python API error`);
            res.status(result.status || 500).json({ success: false, error: result.error || `${label} failed`, service: "python" });
        }
    } catch (error) {
        logger.error({ err: error }, `[Bridge/${label}] Error`);
        res.status(500).json({ success: false, error: `${label} failed` });
    }
}

// ============================================
// Routes
// ============================================

// GET /bridge/templates/:type
router.get("/templates/:type", asyncHandler(async (req: Request, res: Response) => {
    const type = req.params["type"];
    if (!type) throw new HttpError(400, "Missing template type");

    const query: Record<string, string> = {};
    for (const [k, v] of Object.entries(req.query)) {
        if (typeof v === "string") query[k] = v;
    }

    await forwardToRust(`/api/templates/${encodeURIComponent(type)}`, query, req, res, "Template");
}));

// POST /bridge/generate
router.post("/generate", asyncHandler(async (req: Request, res: Response) => {
    const { prompt } = req.body || {};
    if (!prompt || typeof prompt !== "string") {
        throw new HttpError(400, "Missing prompt");
    }
    await forwardToPython("/generate/ai", "POST", { prompt }, req, res, "Generate");
}));

// POST /bridge/validate
router.post("/validate", asyncHandler(async (req: Request, res: Response) => {
    const model = req.body;
    if (!model) throw new HttpError(400, "Missing model");
    await forwardToPython("/validate", "POST", model, req, res, "Validate");
}));

// POST /bridge/pinn/train
router.post("/pinn/train", asyncHandler(async (req: Request, res: Response) => {
    await forwardToPython("/pinn/train", "POST", req.body, req, res, "PINNTrain", 120_000);
}));

// GET /bridge/pinn/status/:jobId
router.get("/pinn/status/:jobId", asyncHandler(async (req: Request, res: Response) => {
    const jobId = req.params["jobId"];
    if (!jobId) throw new HttpError(400, "Missing jobId");
    await forwardToPython(`/pinn/status/${encodeURIComponent(jobId)}`, "GET", undefined, req, res, "PINNStatus");
}));

// POST /bridge/pinn/predict
router.post("/pinn/predict", asyncHandler(async (req: Request, res: Response) => {
    await forwardToPython("/pinn/predict", "POST", req.body, req, res, "PINNPredict");
}));

export default router;