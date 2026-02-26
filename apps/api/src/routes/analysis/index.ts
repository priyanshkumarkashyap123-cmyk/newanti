/**
 * Analysis Routes - Proxies to Rust API for all structural analysis
 *
 * CANONICAL OWNER: Rust API (fastest solver - 50-100x vs Node)
 * This file is a THIN PROXY. No solver code runs in Node.js.
 */

import express, { Router, Request, Response } from "express";
import { v4 as uuidv4 } from "uuid";
import { rustProxy } from "../../services/serviceProxy.js";
import { validateBody, analyzeRequestSchema } from "../../middleware/validation.js";

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

interface JobStatus {
    id: string;
    status: "pending" | "running" | "completed" | "failed";
    progress?: number;
    result?: any;
    error?: string;
    createdAt: Date;
    completedAt?: Date;
}

// In-memory job store (use Redis in production)
const jobs = new Map<string, JobStatus>();

// ============================================
// CORE HANDLER - Proxies to Rust API
// ============================================

async function handleAnalysisRequest(req: Request, res: Response): Promise<void> {
    const model = req.body as AnalyzeRequest;
    const nodeCount = model.nodes?.length || 0;

    console.log(`[Analysis] -> Rust API | ${nodeCount} nodes, ${model.members?.length || 0} members`);

    // For very large models, use async job
    if (nodeCount > 5000) {
        const jobId = uuidv4();
        jobs.set(jobId, { id: jobId, status: "pending", createdAt: new Date() });
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
        console.error("[Analysis] Rust API error:", result.error);
        res.status(result.status || 500).json({
            success: false,
            error: result.error || "Analysis failed",
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
router.get("/job/:jobId", (req: Request, res: Response) => {
    const { jobId } = req.params;
    if (!jobId) {
        res.status(400).json({ success: false, error: "Missing jobId" });
        return;
    }
    const job = jobs.get(jobId);
    if (!job) {
        res.status(404).json({ success: false, error: "Job not found" });
        return;
    }
    res.json({
        success: true,
        job: {
            id: job.id,
            status: job.status,
            progress: job.progress,
            result: job.result,
            error: job.error,
            createdAt: job.createdAt,
            completedAt: job.completedAt,
        },
    });
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
// ASYNC JOB RUNNER - Proxies to Rust API
// ============================================

async function runAnalysisAsync(jobId: string, model: AnalyzeRequest): Promise<void> {
    const job = jobs.get(jobId);
    if (!job) return;

    job.status = "running";
    job.progress = 0;

    try {
        const result = await rustProxy("POST", "/api/analyze", model, undefined, 300_000);
        if (result.success) {
            job.status = "completed";
            job.progress = 100;
            job.result = result.data;
        } else {
            job.status = "failed";
            job.error = result.error || "Rust API analysis failed";
        }
        job.completedAt = new Date();
    } catch (error) {
        job.status = "failed";
        job.error = error instanceof Error ? error.message : "Unknown error";
        job.completedAt = new Date();
    }

    // Clean up after 1 hour
    setTimeout(() => jobs.delete(jobId), 60 * 60 * 1000);
}

export default router;
