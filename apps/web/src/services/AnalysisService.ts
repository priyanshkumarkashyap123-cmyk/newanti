/**
 * AnalysisService - Smart Solver Routing
 * 
 * Automatically routes analysis to local worker or cloud server
 * based on model complexity (node count).
 * 
 * - nodeCount < 2000: Local SolverWorker
 * - nodeCount >= 2000: Cloud API
 */

// ============================================
// TYPES
// ============================================

export interface ModelData {
    nodes: NodeData[];
    members: MemberData[];
    loads: LoadData[];
    dofPerNode?: 2 | 3 | 6;
    settings?: {
        selfWeight: boolean; // Auto-apply self weight
    };
}

export interface NodeData {
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
}

export interface MemberData {
    id: string;
    startNodeId: string;
    endNodeId: string;
    E?: number;
    A?: number;
    I?: number;
}

export interface LoadData {
    nodeId: string;
    fx?: number;
    fy?: number;
    fz?: number;
}

export interface AnalysisResult {
    success: boolean;
    displacements?: Record<string, number[]>;
    reactions?: Record<string, number[]>;
    memberForces?: Record<string, { axial: number }>;
    stats?: {
        totalDof?: number;
        nnz?: number;
        sparsity?: number;
        assemblyTimeMs: number;
        solveTimeMs: number;
        totalTimeMs: number;
        method?: string;
        usedCloud?: boolean;
    };
    error?: string;
}

export type AnalysisStage = 'validating' | 'uploading' | 'queued' | 'assembling' | 'solving' | 'downloading' | 'complete';

export interface ProgressCallback {
    (stage: AnalysisStage, percent: number, message: string): void;
}

// ============================================
// CONFIGURATION
// ============================================

const CONFIG = {
    LOCAL_THRESHOLD: 2000,  // Use local solver below this node count
    // Use Rust API for high-performance analysis (50-100x faster than Node.js)
    RUST_API_URL: import.meta.env.VITE_RUST_API_URL || 'http://localhost:3002',
    // Fallback to Node.js API for auth/payments
    API_BASE_URL: import.meta.env.VITE_API_URL || 'http://localhost:3001',
    POLL_INTERVAL: 1000,    // Poll interval for async jobs (ms)
    MAX_POLL_TIME: 300000   // Maximum poll time (5 minutes)
};

// ============================================
// ANALYSIS SERVICE
// ============================================

class AnalysisService {
    private worker: Worker | null = null;
    private abortController: AbortController | null = null;

    /**
     * Run structural analysis
     * Automatically selects local or cloud solver based on model size
     */
    async analyze(
        model: ModelData,
        onProgress?: ProgressCallback,
        token?: string | null
    ): Promise<AnalysisResult> {
        const nodeCount = model.nodes.length;

        onProgress?.('validating', 5, 'Validating model...');

        // Validate model first
        const validation = await this.validateModel(model, token);
        if (!validation.valid) {
            return {
                success: false,
                error: `Validation failed: ${validation.errors.join(', ')}`
            };
        }

        // Route based on node count
        if (nodeCount < CONFIG.LOCAL_THRESHOLD) {
            return this.analyzeLocal(model, onProgress);
        } else {
            return this.analyzeCloud(model, onProgress, token);
        }
    }

    /**
     * Run analysis locally using Web Worker
     */
    private async analyzeLocal(
        model: ModelData,
        onProgress?: ProgressCallback
    ): Promise<AnalysisResult> {
        onProgress?.('assembling', 10, 'Starting local solver...');

        return new Promise((resolve, reject) => {
            // Create worker if not exists
            if (!this.worker) {
                this.worker = new Worker(
                    new URL('../workers/StructuralSolverWorker.ts', import.meta.url),
                    { type: 'module' }
                );
            }

            const handleMessage = (event: MessageEvent) => {
                const data = event.data;

                if (data.type === 'progress') {
                    const stage = data.stage as AnalysisStage;
                    onProgress?.(stage, data.percent, data.message);
                } else if (data.type === 'result') {
                    this.worker?.removeEventListener('message', handleMessage);

                    if (data.success) {
                        // Convert Float64Array to regular arrays for displacements
                        const displacements: Record<string, number[]> = {};
                        const dispArray = data.displacements as Float64Array;
                        const dofPerNode = model.dofPerNode || 6;

                        model.nodes.forEach((node, i) => {
                            const start = i * dofPerNode;
                            displacements[node.id] = Array.from(
                                dispArray.slice(start, start + dofPerNode)
                            );
                        });

                        resolve({
                            success: true,
                            displacements,
                            stats: {
                                ...data.stats,
                                usedCloud: false
                            }
                        });
                    } else {
                        resolve({
                            success: false,
                            error: data.error
                        });
                    }
                }
            };

            this.worker.addEventListener('message', handleMessage);
            this.worker.addEventListener('error', (error) => {
                reject(new Error(error.message));
            });

            // Send to worker
            this.worker.postMessage({
                type: 'analyze',
                requestId: `local-${Date.now()}`,
                model: {
                    nodes: model.nodes,
                    members: model.members,
                    loads: model.loads,
                    dofPerNode: model.dofPerNode || 6,
                    settings: model.settings
                }
            });
        });
    }

    /**
     * Run analysis on cloud server
     */
    private async analyzeCloud(
        model: ModelData,
        onProgress?: ProgressCallback,
        token?: string | null
    ): Promise<AnalysisResult> {
        this.abortController = new AbortController();
        const signal = this.abortController.signal;

        try {
            onProgress?.('uploading', 10, 'Uploading to Cloud Engine...');

            const headers: Record<string, string> = { 'Content-Type': 'application/json' };
            if (token) {
                headers['Authorization'] = `Bearer ${token}`;
            }

            // POST model to Rust API for high-performance analysis
            const response = await fetch(`${CONFIG.RUST_API_URL}/api/analyze`, {
                method: 'POST',
                headers,
                body: JSON.stringify(model),
                signal
            });

            if (!response.ok) {
                const error = await response.json();
                return { success: false, error: error.error || 'Server error' };
            }

            const data = await response.json();

            // Check if async job was created
            if (data.jobId) {
                onProgress?.('queued', 20, 'Job queued, waiting for results...');
                return this.pollForResults(data.jobId, onProgress, signal, token);
            }

            // Synchronous result
            onProgress?.('complete', 100, 'Analysis complete!');
            return {
                ...data,
                stats: { ...data.stats, usedCloud: true }
            };

        } catch (error) {
            if (error instanceof Error && error.name === 'AbortError') {
                return { success: false, error: 'Analysis cancelled' };
            }
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Network error'
            };
        }
    }

    /**
     * Poll for async job results
     */
    private async pollForResults(
        jobId: string,
        onProgress?: ProgressCallback,
        signal?: AbortSignal,
        token?: string | null
    ): Promise<AnalysisResult> {
        const startTime = Date.now();

        while (Date.now() - startTime < CONFIG.MAX_POLL_TIME) {
            if (signal?.aborted) {
                return { success: false, error: 'Analysis cancelled' };
            }

            try {
                const headers: Record<string, string> = {};
                if (token) {
                    headers['Authorization'] = `Bearer ${token}`;
                }

                const response = await fetch(
                    `${CONFIG.API_BASE_URL}/api/analyze/job/${jobId}`,
                    {
                        signal,
                        headers
                    }
                );

                if (!response.ok) {
                    throw new Error('Failed to fetch job status');
                }

                const data = await response.json();
                const job = data.job;

                if (job.status === 'completed') {
                    onProgress?.('complete', 100, 'Analysis complete!');
                    return {
                        ...job.result,
                        stats: { ...job.result?.stats, usedCloud: true }
                    };
                }

                if (job.status === 'failed') {
                    return { success: false, error: job.error };
                }

                // Update progress
                const progress = job.progress || 30;
                onProgress?.('solving', progress, `Processing... ${job.status}`);

            } catch (error) {
                console.error('Poll error:', error);
            }

            // Wait before next poll
            await new Promise(resolve => setTimeout(resolve, CONFIG.POLL_INTERVAL));
        }

        return { success: false, error: 'Analysis timed out' };
    }

    /**
     * Validate model with server
     */
    async validateModel(model: ModelData, token?: string | null): Promise<{ valid: boolean; errors: string[] }> {
        try {
            const headers: Record<string, string> = { 'Content-Type': 'application/json' };
            if (token) {
                headers['Authorization'] = `Bearer ${token}`;
            }

            const response = await fetch(`${CONFIG.API_BASE_URL}/api/analyze/validate`, {
                method: 'POST',
                headers,
                body: JSON.stringify(model)
            });

            if (response.ok) {
                return await response.json();
            }

            // Fallback to local validation
            return this.validateModelLocal(model);
        } catch {
            // Fallback to local validation if server unavailable
            return this.validateModelLocal(model);
        }
    }

    /**
     * Local model validation
     */
    private validateModelLocal(model: ModelData): { valid: boolean; errors: string[] } {
        const errors: string[] = [];

        if (!model.nodes?.length) {
            errors.push('No nodes in model');
        }

        if (!model.members?.length) {
            errors.push('No members in model');
        }

        const nodeIds = new Set(model.nodes?.map(n => n.id));
        for (const member of model.members || []) {
            if (!nodeIds.has(member.startNodeId)) {
                errors.push(`Invalid start node: ${member.startNodeId}`);
                break;
            }
            if (!nodeIds.has(member.endNodeId)) {
                errors.push(`Invalid end node: ${member.endNodeId}`);
                break;
            }
        }

        const hasRestraints = model.nodes?.some(n =>
            n.restraints && (n.restraints.fx || n.restraints.fy || n.restraints.fz)
        );
        if (!hasRestraints) {
            errors.push('No boundary conditions defined');
        }

        return { valid: errors.length === 0, errors };
    }

    /**
     * Cancel ongoing analysis
     */
    cancel(): void {
        this.abortController?.abort();
        this.abortController = null;
    }

    /**
     * Terminate worker
     */
    dispose(): void {
        this.cancel();
        this.worker?.terminate();
        this.worker = null;
    }

    /**
     * Get recommended solver based on model
     */
    getRecommendedSolver(nodeCount: number): 'local' | 'cloud' {
        return nodeCount < CONFIG.LOCAL_THRESHOLD ? 'local' : 'cloud';
    }
}

// Export singleton
export const analysisService = new AnalysisService();
export default AnalysisService;
