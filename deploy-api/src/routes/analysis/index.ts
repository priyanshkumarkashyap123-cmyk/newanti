/**
 * Analysis Routes - Server-Side Structural Solver API
 * 
 * Spawns Python solver process for large models (>2000 nodes).
 * Uses scipy.sparse for high-performance sparse matrix operations.
 */

import express, { Router, Request, Response } from 'express';
import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs/promises';
import { fileURLToPath } from 'url';
import { v4 as uuidv4 } from 'uuid';
import { analyzeStructure } from '../../solver.js';

const router: Router = express.Router();

// Support __dirname in ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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
            fx?: boolean;
            fy?: boolean;
            fz?: boolean;
            mx?: boolean;
            my?: boolean;
            mz?: boolean;
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
        fx?: number;
        fy?: number;
        fz?: number;
        mx?: number;
        my?: number;
        mz?: number;
    }>;
    dofPerNode?: number;
    options?: {
        method?: 'spsolve' | 'cg' | 'gmres';
    };
}

interface JobStatus {
    id: string;
    status: 'pending' | 'running' | 'completed' | 'failed';
    progress?: number;
    result?: any;
    error?: string;
    createdAt: Date;
    completedAt?: Date;
}

// In-memory job store (use Redis in production)
const jobs = new Map<string, JobStatus>();

// ============================================
// ROUTES
// ============================================

/**
 * Core handler shared between / and /solve endpoints
 */
async function handleAnalysisRequest(req: Request, res: Response): Promise<void> {
    const model = req.body as AnalyzeRequest;

    if (!model.nodes || !model.members) {
        res.status(400).json({
            success: false,
            error: 'Missing nodes or members in request body'
        });
        return;
    }

    const nodeCount = model.nodes.length;
    console.log(`[Analysis] Received model with ${nodeCount} nodes, ${model.members.length} members`);

    // For very large models, use async job
    if (nodeCount > 5000) {
        const jobId = uuidv4();
        jobs.set(jobId, {
            id: jobId,
            status: 'pending',
            createdAt: new Date()
        });

        // Start async job
        runAnalysisAsync(jobId, model);

        res.status(202).json({
            success: true,
            jobId,
            message: 'Analysis job queued',
            pollUrl: `/api/analyze/job/${jobId}`
        });
        return;
    }

    // Synchronous analysis for smaller models
    try {
        const result = await runSolver(model);
        res.json(result);
    } catch (error) {
        console.error('[Analysis] Solver error:', error);
        res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : 'Solver failed'
        });
    }
}

/**
 * POST /analyze
 * Run structural analysis (synchronous for small models)
 */
router.post('/', handleAnalysisRequest);

// Compatibility alias for older clients calling /analysis/solve
router.post('/solve', handleAnalysisRequest);

/**
 * GET /analyze/job/:jobId
 * Poll for job status
 */
router.get('/job/:jobId', (req: Request, res: Response) => {
    const { jobId } = req.params;

    if (!jobId) {
        res.status(400).json({ success: false, error: 'Missing jobId' });
        return;
    }

    const job = jobs.get(jobId);

    if (!job) {
        res.status(404).json({
            success: false,
            error: 'Job not found'
        });
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
            completedAt: job.completedAt
        }
    });
});

/**
 * POST /analyze/validate
 * Validate model without running analysis
 */
router.post('/validate', (req: Request, res: Response) => {
    const model = req.body as AnalyzeRequest;
    const errors: string[] = [];

    // Validate nodes
    if (!model.nodes || model.nodes.length === 0) {
        errors.push('No nodes provided');
    }

    // Validate members
    if (!model.members || model.members.length === 0) {
        errors.push('No members provided');
    }

    // Check member node references
    const nodeIds = new Set(model.nodes?.map(n => n.id) || []);
    for (const member of model.members || []) {
        if (!nodeIds.has(member.startNodeId)) {
            errors.push(`Member ${member.id} references unknown start node: ${member.startNodeId}`);
        }
        if (!nodeIds.has(member.endNodeId)) {
            errors.push(`Member ${member.id} references unknown end node: ${member.endNodeId}`);
        }
    }

    // Check load node references
    for (const load of model.loads || []) {
        if (!nodeIds.has(load.nodeId)) {
            errors.push(`Load references unknown node: ${load.nodeId}`);
        }
    }

    // Check for at least one restraint
    const hasRestraints = model.nodes?.some(n => n.restraints &&
        (n.restraints.fx || n.restraints.fy || n.restraints.fz));
    if (!hasRestraints) {
        errors.push('Model has no boundary conditions (restraints)');
    }

    res.json({
        valid: errors.length === 0,
        errors,
        stats: {
            nodes: model.nodes?.length || 0,
            members: model.members?.length || 0,
            loads: model.loads?.length || 0
        }
    });
});

// ============================================
// PYTHON SOLVER
// ============================================

async function resolveSolverPath(): Promise<string> {
    const candidates = [
        path.join(__dirname, '../../solver/solver.py'),
        path.join(process.cwd(), 'solver/solver.py')
    ];

    for (const candidate of candidates) {
        try {
            await fs.access(candidate);
            return candidate;
        } catch {
            // continue searching
        }
    }

    throw new Error(`solver.py not found. Searched: ${candidates.join(', ')}`);
}

async function runPythonSolver(model: AnalyzeRequest): Promise<any> {
    const solverPath = await resolveSolverPath();

    return new Promise((resolve, reject) => {
        // Spawn Python process
        const python = spawn('python3', [solverPath, '--stdin'], {
            stdio: ['pipe', 'pipe', 'pipe']
        });

        let stdout = '';
        let stderr = '';

        python.stdout.on('data', (data) => {
            stdout += data.toString();
        });

        python.stderr.on('data', (data) => {
            stderr += data.toString();
        });

        python.on('close', (code) => {
            if (code !== 0) {
                reject(new Error(`Solver exited with code ${code}: ${stderr}`));
                return;
            }

            try {
                const result = JSON.parse(stdout);
                resolve(result);
            } catch (e) {
                reject(new Error(`Failed to parse solver output: ${stdout}`));
            }
        });

        python.on('error', (error) => {
            reject(new Error(`Failed to start solver: ${error.message}`));
        });

        // Send input
        python.stdin.write(JSON.stringify(model));
        python.stdin.end();
    });
}

/**
 * Node.js fallback solver (uses existing TypeScript implementation)
 * Keeps API responsive when Python or SciPy is unavailable.
 */
async function runNodeSolver(model: AnalyzeRequest): Promise<any> {
    const normalizedNodes = (model.nodes || []).map(node => ({
        id: node.id,
        x: node.x,
        y: node.y,
        z: node.z,
        restraints: {
            fx: node.restraints?.fx ?? false,
            fy: node.restraints?.fy ?? false,
            fz: node.restraints?.fz ?? false,
            mx: node.restraints?.mx ?? false,
            my: node.restraints?.my ?? false,
            mz: node.restraints?.mz ?? false
        }
    }));

    const normalizedMembers = (model.members || []).map((member, idx) => ({
        id: member.id || `member_${idx}`,
        startNodeId: member.startNodeId,
        endNodeId: member.endNodeId,
        sectionId: 'default',
        E: member.E ?? 200e6,
        A: member.A ?? 0.01,
        I: member.I ?? 1e-4
    }));

    const normalizedLoads = (model.loads || []).map((load, idx) => ({
        id: `load_${idx}_${load.nodeId}`,
        nodeId: load.nodeId,
        fx: load.fx ?? 0,
        fy: load.fy ?? 0,
        fz: load.fz ?? 0,
        mx: load.mx ?? 0,
        my: load.my ?? 0,
        mz: load.mz ?? 0
    }));

    return analyzeStructure({
        nodes: normalizedNodes,
        members: normalizedMembers,
        loads: normalizedLoads
    });
}

/**
 * Prefer Python solver for performance; gracefully fall back to TS solver.
 */
async function runSolver(model: AnalyzeRequest): Promise<any> {
    try {
        return await runPythonSolver(model);
    } catch (error) {
        console.warn('[Analysis] Python solver unavailable, falling back to Node solver:', error);
        return runNodeSolver(model);
    }
}

async function runAnalysisAsync(jobId: string, model: AnalyzeRequest): Promise<void> {
    const job = jobs.get(jobId);
    if (!job) return;

    job.status = 'running';
    job.progress = 0;

    try {
        const result = await runSolver(model);
        job.status = 'completed';
        job.progress = 100;
        job.result = result;
        job.completedAt = new Date();
    } catch (error) {
        job.status = 'failed';
        job.error = error instanceof Error ? error.message : 'Unknown error';
        job.completedAt = new Date();
    }

    // Clean up old jobs after 1 hour
    setTimeout(() => {
        jobs.delete(jobId);
    }, 60 * 60 * 1000);
}

export default router;
