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
import { requireAuth, getAuth } from "../../middleware/authMiddleware.js";
import { asyncHandler, HttpError } from "../../utils/asyncHandler.js";
import { logger } from "../../utils/logger.js";
import { cacheKey, getCachedResult, setCachedResult } from "../../utils/resultCache.js";
import { assertAnalysisPayload } from "../../utils/proxyContracts.js";
import { QuotaService } from "../../services/quotaService.js";
import { User } from "../../models.js";
import { analysisRateLimiter } from "../../middleware/quotaRateLimiter.js";

const router: Router = express.Router();

function getRequestId(req: Request, res: Response): string | undefined {
    const rid = res.locals.requestId || req.get("x-request-id");
    return typeof rid === "string" && rid.length > 0 ? rid : undefined;
}

// SECURITY: All analysis routes require authentication
router.use(requireAuth());

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
// MODEL SIZE LIMIT MIDDLEWARE (per-tier)
// ============================================

const MODEL_SIZE_LIMITS: Record<string, number> = {
    free: 100,
    pro: 2000,
    enterprise: 10000,
};

async function enforceModelSizeLimit(req: Request, res: Response, next: () => void): Promise<void> {
    const model = req.body as AnalyzeRequest;
    const nodeCount = model.nodes?.length || 0;

    if (nodeCount === 0) { next(); return; }

    try {
        const { userId } = getAuth(req);
        if (!userId) { next(); return; }

        const user = await User.findOne({ clerkId: userId }).select('tier email').lean();
        const tier = user?.tier || 'free';
        const limit = MODEL_SIZE_LIMITS[tier] ?? MODEL_SIZE_LIMITS.free;

        if (nodeCount > limit) {
            res.status(400).json({
                success: false,
                error: 'MODEL_TOO_LARGE',
                message: `Model has ${nodeCount} nodes, but your ${tier} plan allows up to ${limit} nodes. Upgrade to increase the limit.`,
                nodeCount,
                limit,
                tier,
            });
            return;
        }
    } catch {
        // Non-fatal: allow request through if tier check fails
    }

    next();
}

// ============================================
// CORE HANDLER - Proxies to Rust API
// ============================================

async function handleAnalysisRequest(req: Request, res: Response): Promise<void> {
    const model = req.body as AnalyzeRequest;
    const nodeCount = model.nodes?.length || 0;
    const memberCount = model.members?.length || 0;

    logger.info(`[Analysis] -> Rust API | ${nodeCount} nodes, ${memberCount} members`);

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
                analysisModel: model,
                nodeCount,
                memberCount,
            } as any);
        } catch {
            throw new HttpError(500, "Failed to create analysis job");
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

    // Synchronous analysis - check cache before proxying to Rust API
    const key = cacheKey(model);
    const cached = getCachedResult(key);
    if (cached !== undefined) {
        logger.info(`[Analysis] cache HIT | ${nodeCount} nodes, ${memberCount} members`);
        res.setHeader("X-Analysis-Cache", "HIT");
        res.json(cached);
        return;
    }

    const requestId = getRequestId(req, res);
    const result = await rustProxy("POST", "/api/analyze", model, undefined, 120_000, requestId);
    if (result.success) {
        const guard = assertAnalysisPayload(result.data, "Analysis");
        if (!guard.ok) {
            logger.error({ reason: guard.reason, requestId }, "[Analysis] Invalid upstream payload");
            res.status(502).json({
                success: false,
                error: "Invalid analysis payload from upstream service",
                code: "UPSTREAM_CONTRACT_ERROR",
                requestId,
            });
            return;
        }

        // Deduct compute units from quota on successful analysis
        try {
            const auth = getAuth(req);
            if (auth.userId) {
                const user = await User.findOne({ clerkId: auth.userId }).select('_id').lean();
                if (user) {
                    const weight = QuotaService.computeWeight(nodeCount, memberCount);
                    await QuotaService.deductComputeUnits(auth.userId, weight);
                }
            }
        } catch (quotaErr) {
            // Non-fatal: log but don't fail the response
            logger.warn({ err: quotaErr }, "[Analysis] Failed to deduct quota after successful analysis");
        }

        setCachedResult(key, result.data);
        res.setHeader("X-Analysis-Cache", "MISS");
        res.json(result.data);
    } else {
        const errorMsg = result.error || "Analysis failed";
        const { errorCode, details } = parseAnalysisError(errorMsg, model);
        res.status(result.status || 500).json({
            success: false,
            error: errorMsg,
            errorCode,
            errorDetails: details,
            service: "rust-api",
        });
    }
}

async function forwardAnalysisToRust(
    rustPath: string,
    body: unknown,
    req: Request,
    res: Response,
    label: string,
    timeoutMs = 120_000,
): Promise<void> {
    const requestId = getRequestId(req, res);
    const result = await rustProxy("POST", rustPath, body, undefined, timeoutMs, requestId);
    if (result.success) {
        const guard = assertAnalysisPayload(result.data, `Analysis/${label}`);
        if (!guard.ok) {
            logger.error({ reason: guard.reason, requestId }, `[Analysis/${label}] Invalid upstream payload`);
            res.status(502).json({
                success: false,
                error: "Invalid analysis payload from upstream service",
                code: "UPSTREAM_CONTRACT_ERROR",
                requestId,
            });
            return;
        }

        res.json(result.data);
        return;
    }

    logger.error({ err: result.error }, `[Analysis/${label}] Rust API error`);
    res.status(result.status || 500).json({
        success: false,
        error: result.error || `${label} failed`,
        service: "rust-api",
    });
}

/**
 * POST /analyze - Run structural analysis via Rust API
 */
router.post("/", validateBody(analyzeRequestSchema), asyncHandler(async (req, res, next) => { await enforceModelSizeLimit(req, res, () => handleAnalysisRequest(req, res)); }));
router.post("/solve", validateBody(analyzeRequestSchema), asyncHandler(async (req, res, next) => { await enforceModelSizeLimit(req, res, () => handleAnalysisRequest(req, res)); }));

/**
 * POST /analysis/run - Quota-gated analysis run (returns spec envelope with computeMode/computeUnitsCharged)
 * Requirements: 4.2, 4.3, 9.2
 */
router.post(
    "/run",
    analysisRateLimiter(
        (req) => (req.body as AnalyzeRequest)?.nodes?.length || 0,
        (req) => (req.body as AnalyzeRequest)?.members?.length || 0,
    ),
    validateBody(analyzeRequestSchema),
    asyncHandler(async (req: Request, res: Response) => {
    const model = req.body as AnalyzeRequest;
    const nodeCount = model.nodes?.length || 0;
    const memberCount = model.members?.length || 0;
    const weight = QuotaService.computeWeight(nodeCount, memberCount);

    const requestId = getRequestId(req, res);
    const result = await rustProxy("POST", "/api/analyze", model, undefined, 120_000, requestId);

    if (!result.success) {
        const errorMsg = result.error || "Analysis failed";
        const { errorCode, details } = parseAnalysisError(errorMsg, model);
        res.status(result.status || 500).json({
            success: false,
            error: errorMsg,
            errorCode,
            errorDetails: details,
            service: "rust-api",
        });
        return;
    }

    // Deduct quota on success
    try {
        const auth = getAuth(req);
        if (auth.userId) {
            const user = await User.findOne({ clerkId: auth.userId }).select('_id').lean();
            if (user) {
                await QuotaService.deductComputeUnits(auth.userId, weight);
            }
        }
    } catch (quotaErr) {
        logger.warn({ err: quotaErr }, "[Analysis/run] Failed to deduct quota");
    }

    res.json({
        ...(typeof result.data === 'object' && result.data !== null ? result.data : {}),
        computeMode: 'server',
        computeUnitsCharged: weight,
    });
}));

/**
 * POST /analysis/modal - Matrix-based modal analysis
 */
router.post("/modal", asyncHandler(async (req: Request, res: Response) => {
    await forwardAnalysisToRust("/api/analysis/modal", req.body, req, res, "Modal", 120_000);
}));

/**
 * POST /analysis/time-history - Matrix-based time history analysis
 */
router.post("/time-history", asyncHandler(async (req: Request, res: Response) => {
    await forwardAnalysisToRust("/api/analysis/time-history", req.body, req, res, "TimeHistory", 180_000);
}));

/**
 * POST /analysis/seismic - Matrix-based seismic response analysis
 */
router.post("/seismic", asyncHandler(async (req: Request, res: Response) => {
    await forwardAnalysisToRust("/api/analysis/seismic", req.body, req, res, "Seismic", 120_000);
}));

/**
 * GET /analyze/job/:jobId - Poll for async job status
 */
router.get("/job/:jobId", asyncHandler(async (req: Request, res: Response) => {
    const { jobId } = req.params;
    if (!jobId) {
        throw new HttpError(400, "Missing jobId");
    }

    const job = await AnalysisJob.findOne({ jobId }).lean();
    if (!job) {
        throw new HttpError(404, "Job not found");
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
}));

/**
 * GET /analyze/jobs - List jobs for the current user
 */
router.get("/jobs", asyncHandler(async (req: Request, res: Response) => {
    let userId = "anonymous";
    try {
        const auth = getAuth(req);
        if (auth.userId) userId = auth.userId;
    } catch { /* anonymous fallback */ }

    const jobs = await AnalysisJob.find({ userId })
        .select("jobId status progress nodeCount memberCount error errorCode createdAt completedAt")
        .sort({ createdAt: -1 })
        .limit(50)
        .lean();

    res.json({ success: true, jobs });
}));

/**
 * POST /analysis/preflight - Compute weight preview before running analysis
 * Requirements: 4.4
 */
router.post("/preflight", asyncHandler(async (req: Request, res: Response) => {
    const { nodeCount = 0, memberCount = 0 } = req.body as { nodeCount?: number; memberCount?: number };

    let userId: string | undefined;
    try {
        const auth = getAuth(req);
        userId = auth.userId ?? undefined;
    } catch { /* anonymous */ }

    const weight = QuotaService.computeWeight(nodeCount, memberCount);

    let remaining: number | null = null;
    if (userId) {
        try {
            const user = await User.findOne({ clerkId: userId }).select('_id tier').lean();
            if (user) {
                const { TIER_CONFIG } = await import("../../config/tierConfig.js");
                const tier = (user.tier ?? 'free') as keyof typeof TIER_CONFIG;
                const quota = await QuotaService.get(userId, user._id.toString());
                const max = TIER_CONFIG[tier].maxComputeUnitsPerDay;
                remaining = max === Infinity ? null : Math.max(0, max - quota.computeUnitsUsed);
            }
        } catch { /* non-fatal */ }
    }

    return res.ok({ weight, remaining });
}));

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
        logger.error({ err }, "[Analysis] Failed to update job status");
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
        ).catch((err) => logger.error({ err }, "[Analysis] Failed to save error state"));
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
            logger.info(`[Analysis] Recovered ${stale.modifiedCount} stale running job(s) from previous crash`);
        }
    } catch {
        // MongoDB may not be connected yet — non-fatal
    }
})();

export default router;
