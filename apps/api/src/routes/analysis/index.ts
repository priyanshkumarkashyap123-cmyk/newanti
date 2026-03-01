/**
 * Analysis Routes - Proxies to Rust API for all structural analysis
 *
 * CANONICAL OWNER: Rust API (fastest solver - 50-100x vs Node)
 * This file is a THIN PROXY. No solver code runs in Node.js.
 *
 * Jobs are persisted to MongoDB so they survive server restarts.
 * Completed/failed jobs auto-expire after 24 hours via TTL index.
 */

import express, { Router, Request, Response } from "express";
import { v4 as uuidv4 } from "uuid";
import { rustProxy } from "../../services/serviceProxy.js";
import { validateBody, analyzeRequestSchema } from "../../middleware/validation.js";
import { AnalysisJob } from "../../models.js";
import { getAuth } from "../../middleware/authMiddleware.js";

const router: Router = express.Router();

// ============================================
// TYPES
// ============================================

interface AnalyzeRequest {
    nodes: Array<{
        id: string;
        x: number;
        y: number;
        z: number;
        restraints?: {
            fx?: boolean; fy?: boolean; fz?: boolean;
            mx?: boolean; my?: boolean; mz?: boolean;
        };
    }>;
    members: Array<{
        id: string;
        startNodeId: string;
        endNodeId: string;
        E?: number;
        A?: number;
        I?: number;
    }>;
    loads: Array<{
        nodeId: string;
        fx?: number; fy?: number; fz?: number;
        mx?: number; my?: number; mz?: number;
    }>;
    dofPerNode?: number;
    options?: {
        method?: "spsolve" | "cg" | "gmres";
    };
}

// ============================================
// ERROR PARSING — extract structured diagnosis from Rust errors
// ============================================

interface AnalysisErrorDetail {
    type: string;
    message: string;
    elementIds?: string[];
}

function parseAnalysisError(error: string, model: AnalyzeRequest): {
    errorCode: string;
    details: AnalysisErrorDetail[];
} {
    const details: AnalysisErrorDetail[] = [];
    let errorCode = "ANALYSIS_UNKNOWN";

    const lowerError = error.toLowerCase();

    if (lowerError.includes("singular") || lowerError.includes("ill-conditioned")) {
        errorCode = "SINGULAR_MATRIX";

        // Check for insufficient supports
        const supportedNodes = model.nodes.filter(
            (n) => n.restraints && (n.restraints.fx || n.restraints.fy || n.restraints.fz)
        );
        if (supportedNodes.length < 2) {
            details.push({
                type: "insufficient_supports",
                message: `Only ${supportedNodes.length} node(s) have boundary conditions. A stable structure typically needs at least 2 supported nodes.`,
                elementIds: supportedNodes.map((n) => n.id),
            });
        }

        // Check for disconnected members
        const nodeConnections = new Map<string, number>();
        for (const m of model.members) {
            nodeConnections.set(m.startNodeId, (nodeConnections.get(m.startNodeId) || 0) + 1);
            nodeConnections.set(m.endNodeId, (nodeConnections.get(m.endNodeId) || 0) + 1);
        }
        const isolatedNodes = model.nodes.filter(
            (n) => !nodeConnections.has(n.id) || nodeConnections.get(n.id) === 0
        );
        if (isolatedNodes.length > 0) {
            details.push({
                type: "disconnected_nodes",
                message: `${isolatedNodes.length} node(s) are not connected to any member.`,
                elementIds: isolatedNodes.map((n) => n.id),
            });
        }

        // Check for zero-length members
        const zeroLengthMembers = model.members.filter((m) => {
            const start = model.nodes.find((n) => n.id === m.startNodeId);
            const end = model.nodes.find((n) => n.id === m.endNodeId);
            if (!start || !end) return false;
            const dx = end.x - start.x;
            const dy = end.y - start.y;
            const dz = end.z - start.z;
            return Math.sqrt(dx * dx + dy * dy + dz * dz) < 1e-6;
        });
        if (zeroLengthMembers.length > 0) {
            details.push({
                type: "zero_length_members",
                message: `${zeroLengthMembers.length} member(s) have zero or near-zero length.`,
                elementIds: zeroLengthMembers.map((m) => m.id),
            });
        }
    } else if (lowerError.includes("timeout") || lowerError.includes("timed out")) {
        errorCode = "ANALYSIS_TIMEOUT";
        details.push({
            type: "timeout",
            message: "The analysis took too long and was cancelled. Try reducing model size or simplifying the geometry.",
        });
    } else if (lowerError.includes("memory") || lowerError.includes("allocation")) {
        errorCode = "OUT_OF_MEMORY";
        details.push({
            type: "memory",
            message: `Model with ${model.nodes.length} nodes and ${model.members.length} members exceeded memory limits. Try reducing model complexity.`,
        });
    }

    if (details.length === 0) {
        details.push({
            type: "unknown",
            message: error,
        });
    }

    return { errorCode, details };
}

// ============================================
// CORE HANDLER - Proxies to Rust API
// ============================================

async function handleAnalysisRequest(req: Request, res: Response): Promise<void> {
    const model = req.body as AnalyzeRequest;
    const nodeCount = model.nodes?.length || 0;
    const memberCount = model.members?.length || 0;

    console.log(`[Analysis] -> Rust API | ${nodeCount} nodes, ${memberCount} members`);

    // For very large models, use async job
    if (nodeCount > 5000) {
        let userId = "anonymous";
        try {
            const auth = getAuth(req);
            if (auth.userId) userId = auth.userId;
        } catch { /* anonymous fallback */ }

        const jobId = uuidv4();

        try {
            await AnalysisJob.create({
                jobId,
                userId,
                status: "pending",
                model,
                nodeCount,
                memberCount,
            });
        } catch (dbErr) {
            console.error("[Analysis] Failed to persist job:", dbErr);
            res.status(500).json({
                success: false,
                error: "Failed to create analysis job",
            });
            return;
        }

        runAnalysisAsync(jobId, model);

        res.status(202).json({
            success: true,
            jobId,
            message: "Analysis job queued",
            pollUrl: `/api/analyze/job/${jobId}`,
        });
        return;
    }

    // Synchronous analysis - proxy to Rust API
    const result = await rustProxy("POST", "/api/analyze", model, undefined, 120_000);
    if (result.success) {
        res.json(result.data);
    } else {
        const errorMsg = result.error || "Analysis failed";
        const { errorCode, details } = parseAnalysisError(errorMsg, model);
        console.error("[Analysis] Rust API error:", errorMsg, "| Code:", errorCode);
        res.status(result.status || 500).json({
            success: false,
            error: errorMsg,
            errorCode,
            errorDetails: details,
            service: "rust-api",
        });
    }
}

/**
 * POST /analyze - Run structural analysis via Rust API
 */
router.post("/", validateBody(analyzeRequestSchema), handleAnalysisRequest);
router.post("/solve", validateBody(analyzeRequestSchema), handleAnalysisRequest);

/**
 * GET /analyze/job/:jobId - Poll for async job status
 */
router.get("/job/:jobId", async (req: Request, res: Response) => {
    const { jobId } = req.params;
    if (!jobId) {
        res.status(400).json({ success: false, error: "Missing jobId" });
        return;
    }

    try {
        const job = await AnalysisJob.findOne({ jobId }).lean();
        if (!job) {
            res.status(404).json({ success: false, error: "Job not found" });
            return;
        }
        res.json({
            success: true,
            job: {
                id: job.jobId,
                status: job.status,
                progress: job.progress,
                result: job.result,
                error: job.error,
                errorCode: job.errorCode,
                errorDetails: job.errorDetails,
                nodeCount: job.nodeCount,
                memberCount: job.memberCount,
                createdAt: job.createdAt,
                completedAt: job.completedAt,
            },
        });
    } catch (err) {
        console.error("[Analysis] Job lookup error:", err);
        res.status(500).json({ success: false, error: "Failed to retrieve job status" });
    }
});

/**
 * GET /analyze/jobs - List jobs for the current user
 */
router.get("/jobs", async (req: Request, res: Response) => {
    let userId = "anonymous";
    try {
        const auth = getAuth(req);
        if (auth.userId) userId = auth.userId;
    } catch { /* anonymous fallback */ }

    try {
        const jobs = await AnalysisJob.find({ userId })
            .select("jobId status progress nodeCount memberCount error errorCode createdAt completedAt")
            .sort({ createdAt: -1 })
            .limit(50)
            .lean();

        res.json({ success: true, jobs });
    } catch (err) {
        console.error("[Analysis] Jobs list error:", err);
        res.status(500).json({ success: false, error: "Failed to list jobs" });
    }
});

/**
 * POST /analyze/validate - Validate model without running analysis (local)
 */
router.post("/validate", (req: Request, res: Response) => {
    const model = req.body as AnalyzeRequest;
    const errors: string[] = [];

    if (!model.nodes || model.nodes.length === 0) errors.push("No nodes provided");
    if (!model.members || model.members.length === 0) errors.push("No members provided");

    const nodeIds = new Set(model.nodes?.map(n => n.id) || []);
    for (const member of model.members || []) {
        if (!nodeIds.has(member.startNodeId))
            errors.push(`Member ${member.id} references unknown start node: ${member.startNodeId}`);
        if (!nodeIds.has(member.endNodeId))
            errors.push(`Member ${member.id} references unknown end node: ${member.endNodeId}`);
    }
    for (const load of model.loads || []) {
        if (!nodeIds.has(load.nodeId))
            errors.push(`Load references unknown node: ${load.nodeId}`);
    }

    const hasRestraints = model.nodes?.some(
        n => n.restraints && (n.restraints.fx || n.restraints.fy || n.restraints.fz)
    );
    if (!hasRestraints) errors.push("Model has no boundary conditions (restraints)");

    res.json({
        valid: errors.length === 0,
        errors,
        stats: {
            nodes: model.nodes?.length || 0,
            members: model.members?.length || 0,
            loads: model.loads?.length || 0,
        },
    });
});

// ============================================
// ASYNC JOB RUNNER - Proxies to Rust API, persists to MongoDB
// ============================================

async function runAnalysisAsync(jobId: string, model: AnalyzeRequest): Promise<void> {
    try {
        await AnalysisJob.updateOne({ jobId }, { $set: { status: "running", progress: 0 } });
    } catch (err) {
        console.error("[Analysis] Failed to update job status:", err);
        return;
    }

    try {
        const result = await rustProxy("POST", "/api/analyze", model, undefined, 300_000);
        if (result.success) {
            await AnalysisJob.updateOne(
                { jobId },
                {
                    $set: {
                        status: "completed",
                        progress: 100,
                        result: result.data,
                        completedAt: new Date(),
                    },
                },
            );
        } else {
            const errorMsg = result.error || "Rust API analysis failed";
            const { errorCode, details } = parseAnalysisError(errorMsg, model);
            await AnalysisJob.updateOne(
                { jobId },
                {
                    $set: {
                        status: "failed",
                        error: errorMsg,
                        errorCode,
                        errorDetails: details,
                        completedAt: new Date(),
                    },
                },
            );
        }
    } catch (error) {
        const errorMsg = error instanceof Error ? error.message : "Unknown error";
        const { errorCode, details } = parseAnalysisError(errorMsg, model);
        await AnalysisJob.updateOne(
            { jobId },
            {
                $set: {
                    status: "failed",
                    error: errorMsg,
                    errorCode,
                    errorDetails: details,
                    completedAt: new Date(),
                },
            },
        ).catch((err) => console.error("[Analysis] Failed to save error state:", err));
    }
}

// ============================================
// STARTUP — Recover stale "running" jobs from previous crashes
// ============================================

(async () => {
    try {
        const stale = await AnalysisJob.updateMany(
            { status: "running" },
            { $set: { status: "failed", error: "Server restarted during analysis", errorCode: "SERVER_RESTART", completedAt: new Date() } },
        );
        if (stale.modifiedCount > 0) {
            console.log(`[Analysis] Recovered ${stale.modifiedCount} stale running job(s) from previous crash`);
        }
    } catch {
        // MongoDB may not be connected yet — non-fatal
    }
})();

export default router;
