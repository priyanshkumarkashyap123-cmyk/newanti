/**
 * Interop Routes - Proxies to Python backend for file import/export & reports
 *
 * CANONICAL OWNER: Python (STAAD parser, DXF parser, ReportLab PDF gen)
 * This file is a THIN PROXY. No file parsing runs in Node.js.
 * Previous version spawned Python subprocesses - now uses HTTP.
 */

import { Router, Request, Response, type IRouter } from "express";
import { pythonProxy } from "../../services/serviceProxy.js";

const router: IRouter = Router();

// ============================================
// Helper: Forward to Python and handle response
// ============================================

async function forwardToPython(
    pythonPath: string,
    body: unknown,
    res: Response,
    label: string,
    timeoutMs = 30_000,
): Promise<void> {
    try {
        const result = await pythonProxy("POST", pythonPath, body, undefined, timeoutMs);
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
        console.error(`[Interop/${label}] Error:`, error);
        res.status(500).json({
            error: error instanceof Error ? error.message : `${label} failed`,
        });
    }
}

// ============================================
// POST /staad/import - Parse STAAD.Pro file
// ============================================

router.post("/staad/import", async (req: Request, res: Response) => {
    const { content } = req.body;
    if (!content) {
        return res.status(400).json({ error: "Missing file content" });
    }
    await forwardToPython("/interop/staad/import", { content }, res, "STAAD Import");
});

// ============================================
// POST /staad/export - Export to STAAD.Pro format
// ============================================

router.post("/staad/export", async (req: Request, res: Response) => {
    const { model } = req.body;
    if (!model) {
        return res.status(400).json({ error: "Missing model data" });
    }
    await forwardToPython("/interop/staad/export", { model }, res, "STAAD Export");
});

// ============================================
// POST /dxf/import - Parse DXF file
// ============================================

router.post("/dxf/import", async (req: Request, res: Response) => {
    const { content } = req.body;
    if (!content) {
        return res.status(400).json({ error: "Missing file content" });
    }
    await forwardToPython("/interop/dxf/import", { content }, res, "DXF Import");
});

// ============================================
// POST /report/generate - Generate analysis/design report
// ============================================

router.post("/report/generate", async (req: Request, res: Response) => {
    const { model, results, options } = req.body;
    if (!model || !options) {
        return res.status(400).json({ error: "Missing model or options" });
    }
    await forwardToPython(
        "/reports/generate",
        { model, results, options },
        res,
        "Report Gen",
        60_000, // Reports can take longer
    );
});

// ============================================
// POST /validate - Validate model structure (local - no external call)
// ============================================

router.post("/validate", async (req: Request, res: Response) => {
    try {
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
    } catch (error) {
        console.error("Validation error:", error);
        return res.status(500).json({
            error: error instanceof Error ? error.message : "Validation failed",
        });
    }
});

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
