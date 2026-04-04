/**
 * Interop Routes - Proxies to Python backend for file import/export & reports
 *
 * CANONICAL OWNER: Python (STAAD parser, DXF parser, ReportLab PDF gen)
 * This file is a THIN PROXY. No file parsing runs in Node.js.
 * Previous version spawned Python subprocesses - now uses HTTP.
 */

import { Router, Request, Response, type IRouter } from "express";
import { pythonProxy } from "../../services/serviceProxy.js";
import { requireAuth } from "../../middleware/authMiddleware.js";
import { asyncHandler, HttpError } from "../../utils/asyncHandler.js";
import { logger } from "../../utils/logger.js";
import { assertProxyObjectPayload } from "../../utils/proxyContracts.js";

const router: IRouter = Router();

function getRequestId(req: Request, res: Response): string | undefined {
    const rid = res.locals.requestId || req.get("x-request-id");
    return typeof rid === "string" && rid.length > 0 ? rid : undefined;
}

// All interop routes require authentication
router.use(requireAuth());

// ============================================
// Helper: Forward to Python and handle response
// ============================================

async function forwardToPython(
    pythonPath: string,
    body: unknown,
    req: Request,
    res: Response,
    label: string,
    timeoutMs = 30_000,
): Promise<void> {
    try {
        const requestId = getRequestId(req, res);
        const result = await pythonProxy("POST", pythonPath, body, undefined, timeoutMs, requestId);
        if (result.success) {
            const guard = assertProxyObjectPayload(result.data, `Interop/${label}`);
            if (!guard.ok) {
                logger.error({ reason: guard.reason, requestId }, `[Interop/${label}] Invalid upstream payload`);
                res.status(502).json({
                    success: false,
                    error: "Invalid interop payload from upstream service",
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
        logger.error({ err: error }, `[Interop/${label}] Error`);
        res.status(500).json({
            error: `${label} failed`,
        });
    }
}

// ============================================
// POST /staad/import - Parse STAAD.Pro file
// ============================================

router.post("/staad/import", asyncHandler(async (req: Request, res: Response) => {
    const { content } = req.body;
    if (!content) {
        throw new HttpError(400, "Missing file content");
    }
    await forwardToPython("/interop/staad/import", { content }, req, res, "STAAD Import");
}));

// ============================================
// POST /staad/export - Export to STAAD.Pro format
// ============================================

router.post("/staad/export", asyncHandler(async (req: Request, res: Response) => {
    const { model } = req.body;
    if (!model) {
        throw new HttpError(400, "Missing model data");
    }
    await forwardToPython("/interop/staad/export", { model }, req, res, "STAAD Export");
}));

// ============================================
// POST /dxf/import - Parse DXF file
// ============================================

router.post("/dxf/import", asyncHandler(async (req: Request, res: Response) => {
    const { content } = req.body;
    if (!content) {
        throw new HttpError(400, "Missing file content");
    }
    await forwardToPython("/interop/dxf/import", { content }, req, res, "DXF Import");
}));

// ============================================
// POST /report/generate - Generate analysis/design report
// ============================================

router.post("/report/generate", asyncHandler(async (req: Request, res: Response) => {
    const { model, results, options } = req.body;
    if (!model || !options) {
        throw new HttpError(400, "Missing model or options");
    }
    await forwardToPython(
        "/reports/generate",
        { model, results, options },
        req,
        res,
        "Report Gen",
        60_000, // Reports can take longer
    );
}));

// ============================================
// POST /validate - Validate model structure (local - no external call)
// ============================================

router.post("/validate", asyncHandler(async (req: Request, res: Response) => {
    const { model } = req.body;
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!model.nodes || !Array.isArray(model.nodes)) {
        errors.push("Missing or invalid nodes array");
    } else {
        const nodeIds = new Set<string>();
        for (const node of model.nodes) {
            if (!node.id) errors.push("Node missing ID");
            if (nodeIds.has(node.id)) errors.push(`Duplicate node ID: ${node.id}`);
            nodeIds.add(node.id);
            if (node.x === undefined || node.y === undefined) {
                errors.push(`Node ${node.id} missing coordinates`);
            }
        }
    }

    if (!model.members || !Array.isArray(model.members)) {
        errors.push("Missing or invalid members array");
    } else {
        const nodeIds = new Set(model.nodes?.map((n: { id: string }) => n.id) || []);
        for (const member of model.members) {
            if (!member.id) errors.push("Member missing ID");
            if (!nodeIds.has(member.startNodeId)) {
                errors.push(`Member ${member.id} references unknown start node: ${member.startNodeId}`);
            }
            if (!nodeIds.has(member.endNodeId)) {
                errors.push(`Member ${member.id} references unknown end node: ${member.endNodeId}`);
            }
            if (member.startNodeId === member.endNodeId) {
                errors.push(`Member ${member.id} has same start and end node`);
            }
        }
    }

    if (model.supports && Array.isArray(model.supports)) {
        const nodeIds = new Set(model.nodes?.map((n: { id: string }) => n.id) || []);
        for (const support of model.supports) {
            if (!nodeIds.has(support.nodeId)) {
                warnings.push(`Support references unknown node: ${support.nodeId}`);
            }
        }
    }

    return res.json({ valid: errors.length === 0, errors, warnings });
}));

// ============================================
// GET /formats - Supported file formats (static)
// ============================================

router.get("/formats", (_req: Request, res: Response) => {
    res.json({
        import: [
            { id: "json", name: "JSON Model", extension: ".json", description: "BeamLab native format" },
            { id: "std", name: "STAAD.Pro", extension: ".std", description: "STAAD.Pro input file" },
            { id: "dxf", name: "AutoCAD DXF", extension: ".dxf", description: "DXF geometry (LINE entities)" },
        ],
        export: [
            { id: "json", name: "JSON Model", extension: ".json", description: "BeamLab native format" },
            { id: "std", name: "STAAD.Pro", extension: ".std", description: "STAAD.Pro input file" },
            { id: "csv", name: "CSV", extension: ".csv", description: "Comma-separated values" },
            { id: "pdf", name: "PDF Report", extension: ".pdf", description: "Analysis report" },
        ],
    });
});

export default router;
