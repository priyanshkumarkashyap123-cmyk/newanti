/**
 * Advanced Analysis Routes - Proxies to Rust API
 *
 * CANONICAL OWNER: Rust API (P-Delta, Modal, Buckling, Spectrum, Cable)
 * This file is a THIN PROXY. No advanced analysis runs in Node.js.
 * Previous version spawned Python subprocesses - now uses HTTP.
 */

import express, { Router, Request, Response } from "express";
import { rustProxy } from "../../services/serviceProxy.js";
import {
    validateBody,
    pDeltaSchema,
    modalSchema,
    bucklingSchema,
    spectrumSchema,
    cableSchema,
} from "../../middleware/validation.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { logger } from "../../utils/logger.js";
import { assertProxyObjectPayload } from "../../utils/proxyContracts.js";

const router: Router = express.Router();

function getRequestId(req: Request, res: Response): string | undefined {
    const rid = res.locals.requestId || req.get("x-request-id");
    return typeof rid === "string" && rid.length > 0 ? rid : undefined;
}

// ============================================
// Helper: Forward to Rust API and handle response
// ============================================

async function forwardToRust(
    rustPath: string,
    body: unknown,
    req: Request,
    res: Response,
    label: string,
    timeoutMs = 120_000,
): Promise<void> {
    try {
        const requestId = getRequestId(req, res);
        const result = await rustProxy("POST", rustPath, body, undefined, timeoutMs, requestId);
        if (result.success) {
            const guard = assertProxyObjectPayload(result.data, `Advanced/${label}`);
            if (!guard.ok) {
                logger.error({ reason: guard.reason, requestId }, `[Advanced/${label}] Invalid upstream payload`);
                res.status(502).json({
                    success: false,
                    error: "Invalid advanced analysis payload from upstream service",
                    code: "UPSTREAM_CONTRACT_ERROR",
                    requestId,
                });
                return;
            }

            res.json({ success: true, ...result.data as object });
        } else {
            logger.error({ err: result.error }, `[Advanced/${label}] Rust API error`);
            res.status(result.status || 500).json({
                success: false,
                error: result.error || `${label} failed`,
                service: "rust-api",
            });
        }
    } catch (error) {
        logger.error({ err: error }, `[Advanced/${label}] Error`);
        res.status(500).json({
            success: false,
            error: `${label} failed`,
        });
    }
}

// ============================================
// POST /advanced/pdelta - P-Delta (Geometric Nonlinear) Analysis
// ============================================

router.post("/pdelta", validateBody(pDeltaSchema), asyncHandler(async (req: Request, res: Response) => {
    await forwardToRust("/api/advanced/pdelta", req.body, req, res, "PDelta");
}));

// ============================================
// POST /advanced/modal - Modal (Eigenvalue) Analysis
// ============================================

router.post("/modal", validateBody(modalSchema), asyncHandler(async (req: Request, res: Response) => {
    await forwardToRust("/api/advanced/modal", req.body, req, res, "Modal");
}));

// ============================================
// POST /advanced/spectrum - Response Spectrum Analysis
// ============================================

router.post("/spectrum", validateBody(spectrumSchema), asyncHandler(async (req: Request, res: Response) => {
    await forwardToRust("/api/advanced/spectrum", req.body, req, res, "Spectrum", 180_000);
}));

// ============================================
// POST /advanced/buckling - Linear Buckling Analysis
// ============================================

router.post("/buckling", validateBody(bucklingSchema), asyncHandler(async (req: Request, res: Response) => {
    await forwardToRust("/api/advanced/buckling", req.body, req, res, "Buckling");
}));

// ============================================
// POST /advanced/cable - Cable/Tension-Only Member Analysis
// ============================================

router.post("/cable", validateBody(cableSchema), asyncHandler(async (req: Request, res: Response) => {
    await forwardToRust("/api/advanced/cable", req.body, req, res, "Cable");
}));

// ============================================
// GET /advanced/capabilities - Available Capabilities (static)
// ============================================

router.get("/capabilities", (_req: Request, res: Response) => {
    res.json({
        success: true,
        capabilities: [
            {
                id: "pdelta",
                name: "P-Delta Analysis",
                description: "Geometric nonlinear analysis accounting for secondary moments from axial loads",
                endpoint: "/api/advanced/pdelta",
                engine: "rust-api",
            },
            {
                id: "modal",
                name: "Modal Analysis",
                description: "Eigenvalue extraction for natural frequencies and mode shapes",
                endpoint: "/api/advanced/modal",
                engine: "rust-api",
            },
            {
                id: "spectrum",
                name: "Response Spectrum Analysis",
                description: "Seismic analysis using IS 1893 or custom response spectra",
                endpoint: "/api/advanced/spectrum",
                engine: "rust-api",
            },
            {
                id: "buckling",
                name: "Buckling Analysis",
                description: "Linear stability analysis for critical load factors",
                endpoint: "/api/advanced/buckling",
                engine: "rust-api",
            },
            {
                id: "cable",
                name: "Cable Analysis",
                description: "Catenary cable analysis with sag and equivalent modulus",
                endpoint: "/api/advanced/cable",
                engine: "rust-api",
            },
        ],
    });
});

export default router;
