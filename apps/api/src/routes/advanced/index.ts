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

const router: Router = express.Router();

// ============================================
// Helper: Forward to Rust API and handle response
// ============================================

async function forwardToRust(
    rustPath: string,
    body: unknown,
    res: Response,
    label: string,
    timeoutMs = 120_000,
): Promise<void> {
    try {
        const result = await rustProxy("POST", rustPath, body, undefined, timeoutMs);
        if (result.success) {
            res.json({ success: true, ...result.data as object });
        } else {
            console.error(`[Advanced/${label}] Rust API error:`, result.error);
            res.status(result.status || 500).json({
                success: false,
                error: result.error || `${label} failed`,
                service: "rust-api",
            });
        }
    } catch (error) {
        console.error(`[Advanced/${label}] Error:`, error);
        res.status(500).json({
            success: false,
            error: `${label} failed`,
        });
    }
}

// ============================================
// POST /advanced/pdelta - P-Delta (Geometric Nonlinear) Analysis
// ============================================

router.post("/pdelta", validateBody(pDeltaSchema), async (req: Request, res: Response) => {
    await forwardToRust("/api/advanced/pdelta", req.body, res, "PDelta");
});

// ============================================
// POST /advanced/modal - Modal (Eigenvalue) Analysis
// ============================================

router.post("/modal", validateBody(modalSchema), async (req: Request, res: Response) => {
    await forwardToRust("/api/advanced/modal", req.body, res, "Modal");
});

// ============================================
// POST /advanced/spectrum - Response Spectrum Analysis
// ============================================

router.post("/spectrum", validateBody(spectrumSchema), async (req: Request, res: Response) => {
    await forwardToRust("/api/advanced/spectrum", req.body, res, "Spectrum", 180_000);
});

// ============================================
// POST /advanced/buckling - Linear Buckling Analysis
// ============================================

router.post("/buckling", validateBody(bucklingSchema), async (req: Request, res: Response) => {
    await forwardToRust("/api/advanced/buckling", req.body, res, "Buckling");
});

// ============================================
// POST /advanced/cable - Cable/Tension-Only Member Analysis
// ============================================

router.post("/cable", validateBody(cableSchema), async (req: Request, res: Response) => {
    await forwardToRust("/api/advanced/cable", req.body, res, "Cable");
});

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
