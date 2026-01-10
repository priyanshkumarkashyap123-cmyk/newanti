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


export interface PlateData {
    id: string;
    nodeIds: string[];
    thickness: number;
    E?: number;
    nu?: number;
}

export interface ModelData {
    nodes: NodeData[];
    members: MemberData[];
    plates?: PlateData[];
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
    memberForces?: Record<string, { axial: number; shear?: number; momentStart?: number; momentEnd?: number }>;
    plateResults?: Record<string, { stress: number }>; // Placeholder
    stats?: {
        totalDof?: number;
        nnz?: number;
        sparsity?: number;
        assemblyTimeMs: number;
        solveTimeMs: number;
        totalTimeMs: number;
        method?: string;
        usedCloud?: boolean;
        fallbackFromLocal?: boolean;  // True if cloud was used after local solver failed
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
    LOCAL_THRESHOLD: 3000,    // Use local WASM solver for models up to 3000 nodes
    LARGE_MODEL_THRESHOLD: 5000, // Use Python sparse solver for 5k+ nodes
    // Python backend for high-performance large model analysis
    PYTHON_API_URL: import.meta.env.VITE_PYTHON_API_URL || 'https://beamlab-backend-python.azurewebsites.net',
    // Node.js API for auth/payments
    API_BASE_URL: import.meta.env.VITE_API_URL || 'https://beamlab-backend-node.azurewebsites.net',
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
            // Try local solver first
            const localResult = await this.analyzeLocal(model, onProgress);
            
            // If local solver failed with memory/size error, fallback to cloud
            if (!localResult.success && localResult.error) {
                const errorLower = localResult.error.toLowerCase();
                const shouldFallback = 
                    errorLower.includes('memory') ||
                    errorLower.includes('too large') ||
                    errorLower.includes('exceeds') ||
                    errorLower.includes('error 5') ||
                    errorLower.includes('crashed') ||
                    errorLower.includes('oom');
                
                if (shouldFallback && token) {
                    console.warn('[Analysis] Local solver failed, falling back to cloud:', localResult.error);
                    onProgress?.('uploading', 15, 'Local solver failed. Switching to cloud solver...');
                    
                    try {
                        const cloudResult = await this.analyzeCloud(model, onProgress, token);
                        if (cloudResult.success && cloudResult.stats) {
                            cloudResult.stats.fallbackFromLocal = true;
                        }
                        return cloudResult;
                    } catch (cloudError) {
                        // Both solvers failed - return original local error
                        console.error('[Analysis] Cloud fallback also failed:', cloudError);
                        return {
                            success: false,
                            error: `Local solver: ${localResult.error}\nCloud solver: ${cloudError instanceof Error ? cloudError.message : String(cloudError)}`
                        };
                    }
                }
            }
            
            return localResult;
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
                        const dofPerNode = model.dofPerNode ?? 3;

                        // Displacements
                        const displacements: Record<string, number[]> = {};
                        const dispArray = data.displacements as Float64Array;
                        model.nodes.forEach((node, i) => {
                            const start = i * dofPerNode;
                            displacements[node.id] = Array.from(
                                dispArray.slice(start, start + dofPerNode)
                            );
                        });

                        // Reactions (if available)
                        let reactions: Record<string, number[]> | undefined;
                        if (data.reactions) {
                            reactions = {};
                            const reacArray = data.reactions as Float64Array;
                            model.nodes.forEach((node, i) => {
                                const start = i * dofPerNode;
                                reactions![node.id] = Array.from(
                                    reacArray.slice(start, start + dofPerNode)
                                );
                            });
                        }

                        // Member forces (if available)
                        let memberForces: Record<string, { axial: number; shear?: number; momentStart?: number; momentEnd?: number }> | undefined;
                        if (data.memberForces && Array.isArray(data.memberForces)) {
                            memberForces = {};
                            for (const mf of data.memberForces as any[]) {
                                memberForces[mf.id] = {
                                    axial: mf.start?.axial ?? 0,
                                    shear: mf.start?.shear,
                                    momentStart: mf.start?.moment,
                                    momentEnd: mf.end?.moment
                                };
                            }
                        }

                        resolve({
                            success: true,
                            displacements,
                            reactions,
                            memberForces,
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


            // Convert member loads to nodal loads if present
            const sendToWorker = async () => {
                let allLoads = [...model.loads];

                // Check if model has memberLoads property
                const modelWithMemberLoads = model as any;
                if (modelWithMemberLoads.memberLoads && modelWithMemberLoads.memberLoads.length > 0) {
                    console.log(`[Analysis] Converting ${modelWithMemberLoads.memberLoads.length} member loads to nodal loads...`);

                    try {
                        // Import conversion utility
                        const { convertMemberLoadsToNodal, mergeNodalLoads } = await import('../utils/loadConversion');

                        const equivalentLoads = convertMemberLoadsToNodal(
                            modelWithMemberLoads.memberLoads,
                            model.members,
                            model.nodes
                        );

                        // Merge with existing nodal loads
                        allLoads = mergeNodalLoads([...allLoads, ...equivalentLoads]);

                        console.log(`[Analysis] Total nodal loads after conversion: ${allLoads.length}`);
                    } catch (err) {
                        console.error('[Analysis] Load conversion failed:', err);
                        // Continue with original loads
                    }
                }

                // Send to worker
                this.worker!.postMessage({
                    type: 'analyze',
                    requestId: `local-${Date.now()}`,
                    model: {
                        nodes: model.nodes,
                        members: model.members,
                        loads: allLoads,
                        dofPerNode: model.dofPerNode ?? 3,
                        settings: model.settings
                    }
                });
            };

            sendToWorker();
        });
    }

    /**
     * Run analysis on cloud server using Python sparse solver
     */
    private async analyzeCloud(
        model: ModelData,
        onProgress?: ProgressCallback,
        token?: string | null
    ): Promise<AnalysisResult> {
        this.abortController = new AbortController();
        const signal = this.abortController.signal;

        try {
            onProgress?.('uploading', 10, 'Uploading to High-Performance Solver...');

            const headers: Record<string, string> = { 'Content-Type': 'application/json' };
            if (token) {
                headers['Authorization'] = `Bearer ${token}`;
            }

            // POST to Python backend large-frame sparse solver
            const response = await fetch(`${CONFIG.PYTHON_API_URL}/analyze/large-frame`, {
                method: 'POST',
                headers,
                body: JSON.stringify({
                    nodes: model.nodes.map(n => ({
                        id: n.id,
                        x: n.x,
                        y: n.y,
                        z: n.z,
                        support: n.restraints?.fx && n.restraints?.fy && n.restraints?.fz
                            ? (n.restraints?.mx && n.restraints?.my && n.restraints?.mz ? 'fixed' : 'pinned')
                            : n.restraints?.fy ? 'roller' : 'none'
                    })),
                    members: model.members.map(m => ({
                        id: m.id,
                        startNodeId: m.startNodeId,
                        endNodeId: m.endNodeId,
                        E: m.E,
                        A: m.A,
                        Iy: m.I,
                        Iz: m.I
                    })),
                    node_loads: model.loads.map(l => ({
                        nodeId: l.nodeId,
                        fx: l.fx || 0,
                        fy: l.fy || 0,
                        fz: l.fz || 0
                    })),
                    method: 'auto'
                }),
                signal
            });

            if (!response.ok) {
                const error = await response.json();
                return { success: false, error: error.detail || error.error || 'Server error' };
            }

            const data = await response.json();

            if (!data.success) {
                return { success: false, error: data.error || 'Analysis failed' };
            }

            onProgress?.('complete', 100, 'Analysis complete!');

            // Convert displacements format
            const displacements: Record<string, number[]> = {};
            for (const [nodeId, disp] of Object.entries(data.displacements || {})) {
                const d = disp as { dx: number; dy: number; dz: number; rx: number; ry: number; rz: number };
                displacements[nodeId] = [d.dx, d.dy, d.dz, d.rx, d.ry, d.rz];
            }

            return {
                success: true,
                displacements,
                stats: {
                    assemblyTimeMs: 0,
                    solveTimeMs: data.stats?.solve_time_ms || 0,
                    totalTimeMs: data.stats?.total_time_ms || 0,
                    method: data.stats?.method,
                    usedCloud: true
                }
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
     * Poll for async job results with exponential backoff and timeout
     */
    private async pollForResults(
        jobId: string,
        onProgress?: ProgressCallback,
        signal?: AbortSignal,
        token?: string | null
    ): Promise<AnalysisResult> {
        const startTime = Date.now();
        let pollCount = 0;
        let pollInterval = CONFIG.POLL_INTERVAL;
        const maxPollInterval = 5000; // Max 5 seconds between polls

        while (Date.now() - startTime < CONFIG.MAX_POLL_TIME) {
            if (signal?.aborted) {
                return { success: false, error: 'Analysis cancelled' };
            }

            try {
                const headers: Record<string, string> = {};
                if (token) {
                    headers['Authorization'] = `Bearer ${token}`;
                }

                // Create abort controller for fetch with 10s timeout
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 10000);

                try {
                    const response = await fetch(
                        `${CONFIG.API_BASE_URL}/api/analyze/job/${jobId}`,
                        {
                            signal: controller.signal,
                            headers,
                            cache: 'no-store'
                        }
                    );

                    clearTimeout(timeoutId);

                    if (!response.ok) {
                        // Log but don't crash on temporary errors
                        if (response.status >= 500) {
                            console.warn(`Server error fetching job status: ${response.status}`);
                        } else if (response.status === 404) {
                            return { success: false, error: 'Job not found' };
                        }
                        throw new Error(`HTTP ${response.status}`);
                    }

                    const data = await response.json();
                    const job = data.job;

                    if (!job) {
                        throw new Error('Invalid job response');
                    }

                    if (job.status === 'completed') {
                        onProgress?.('complete', 100, 'Analysis complete!');
                        return {
                            ...job.result,
                            stats: { ...job.result?.stats, usedCloud: true }
                        };
                    }

                    if (job.status === 'failed') {
                        return { success: false, error: job.error || 'Analysis failed' };
                    }

                    // Update progress - ensure valid range
                    const progress = Math.min(99, Math.max(10, job.progress || 30));
                    onProgress?.('solving', progress, `Processing... ${job.status}`);

                    // Reset poll interval on success
                    pollInterval = CONFIG.POLL_INTERVAL;
                    pollCount = 0;
                } catch (fetchError) {
                    clearTimeout(timeoutId);

                    if (fetchError instanceof TypeError && fetchError.message.includes('Failed to fetch')) {
                        console.warn('Network error, will retry...');
                    } else if (fetchError instanceof DOMException && fetchError.name === 'AbortError') {
                        console.warn('Fetch timeout, retrying...');
                    } else {
                        console.error('Poll fetch error:', fetchError);
                    }
                    // Continue polling on network errors
                }
            } catch (error) {
                console.error('Poll error:', error);
                // Don't throw - continue polling
            }

            // Exponential backoff with max
            pollCount++;
            pollInterval = Math.min(maxPollInterval, CONFIG.POLL_INTERVAL * Math.pow(1.5, Math.min(pollCount, 3)));

            // Wait before next poll
            await new Promise(resolve => setTimeout(resolve, pollInterval));
        }

        return { success: false, error: 'Analysis timed out after 5 minutes' };
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
     * Run non-linear analysis (P-Delta, Geometric Non-linearity)
     */
    async runNonLinearAnalysis(
        model: ModelData,
        settings: { type: 'p_delta' | 'geometric' | 'material'; iterations?: number; tolerance?: number },
        token?: string | null
    ): Promise<AnalysisResult> {
        // Non-linear always runs on cloud due to complexity
        try {
            const headers: Record<string, string> = { 'Content-Type': 'application/json' };
            if (token) {
                headers['Authorization'] = `Bearer ${token}`;
            }

            // Route to Rust backend P-Delta solver (20x faster than Python)
            const API_URL = import.meta.env.VITE_API_URL || 'https://beamlab-backend-node.azurewebsites.net';
            const response = await fetch(`${API_URL}/api/advanced/pdelta`, {
                method: 'POST',
                headers,
                body: JSON.stringify({
                    input: model,
                    max_iterations: settings?.iterations || 10,
                    tolerance: settings?.tolerance || 1e-6
                })
            });

            if (!response.ok) {
                const error = await response.json();
                return { success: false, error: error.detail || 'Non-linear analysis failed' };
            }

            return await response.json();
        } catch (error) {
            console.error('Non-linear analysis error:', error);
            return { success: false, error: error instanceof Error ? error.message : 'Network error' };
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
