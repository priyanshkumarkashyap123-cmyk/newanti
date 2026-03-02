/**
 * useStructuralSolver - React Hook for Structural Analysis Worker
 * 
 * Provides interface to the enhanced structural solver worker
 * with progress tracking and zero-copy data transfer.
 */

import { useRef, useCallback, useState, useEffect } from 'react';

// ============================================
// TYPES (re-export from worker)
// ============================================

export interface NodeData {
    id: string;
    x: number;
    y: number;
    z: number;
    restraints?: {
        fx: boolean;
        fy: boolean;
        fz: boolean;
        mx: boolean;
        my: boolean;
        mz: boolean;
    };
}

export interface MemberData {
    id: string;
    startNodeId: string;
    endNodeId: string;
    E: number;
    A: number;
    I: number;
    Iy?: number;
    Iz?: number;
    J?: number;
    G?: number;
    type?: 'frame' | 'truss' | 'spring';
    releases?: {
        fxStart?: boolean; fyStart?: boolean; fzStart?: boolean;
        mxStart?: boolean; myStart?: boolean; mzStart?: boolean;
        fxEnd?: boolean; fyEnd?: boolean; fzEnd?: boolean;
        mxEnd?: boolean; myEnd?: boolean; mzEnd?: boolean;
    };
}

export interface LoadData {
    nodeId: string;
    fx?: number;
    fy?: number;
    fz?: number;
    mx?: number;
    my?: number;
    mz?: number;
}

export interface ModelData {
    nodes: NodeData[];
    members: MemberData[];
    loads: LoadData[];
    dofPerNode: 2 | 3 | 6;
    options?: {
        tolerance?: number;
        maxIterations?: number;
    };
}

export interface ProgressInfo {
    stage: 'assembling' | 'applying_bc' | 'solving' | 'extracting';
    percent: number;
    message: string;
}

export interface AnalysisResult {
    success: boolean;
    displacements?: Float64Array;
    reactions?: Float64Array;
    memberForces?: Float64Array;
    stats: {
        assemblyTimeMs: number;
        solveTimeMs: number;
        totalTimeMs: number;
        iterations?: number;
        residual?: number;
        nnz?: number;
        sparsity?: number;
    };
    error?: string;
}

// ============================================
// HOOK
// ============================================

export function useStructuralSolver() {
    const workerRef = useRef<Worker | null>(null);
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [progress, setProgress] = useState<ProgressInfo | null>(null);

    /**
     * Initialize worker (lazy)
     */
    const getWorker = useCallback((): Worker => {
        if (!workerRef.current) {
            try {
                // Use Vite's worker import syntax
                workerRef.current = new Worker(
                    new URL('../workers/StructuralSolverWorker.ts', import.meta.url),
                    { type: 'module', name: 'structural-solver' }
                );
            } catch (e) {
                console.error('[useStructuralSolver] Failed to create worker:', e);
                throw new Error('Web Worker initialization failed');
            }
        }
        return workerRef.current;
    }, []);

    /**
     * Run structural analysis
     */
    const analyze = useCallback(async (
        model: ModelData,
        onProgress?: (progress: ProgressInfo) => void
    ): Promise<AnalysisResult> => {
        const worker = getWorker();

        setIsAnalyzing(true);
        setProgress(null);

        return new Promise((resolve, reject) => {
            const handleMessage = (event: MessageEvent) => {
                const data = event.data;

                if (data.type === 'progress') {
                    const progressInfo: ProgressInfo = {
                        stage: data.stage,
                        percent: data.percent,
                        message: data.message
                    };
                    setProgress(progressInfo);
                    onProgress?.(progressInfo);
                } else if (data.type === 'result') {
                    worker.removeEventListener('message', handleMessage);
                    worker.removeEventListener('error', handleError);
                    setIsAnalyzing(false);
                    setProgress(null);
                    resolve(data as AnalysisResult);
                }
            };

            const handleError = (error: ErrorEvent) => {
                worker.removeEventListener('message', handleMessage);
                worker.removeEventListener('error', handleError);
                setIsAnalyzing(false);
                setProgress(null);
                reject(new Error(error.message));
            };

            worker.addEventListener('message', handleMessage);
            worker.addEventListener('error', handleError);

            // Send model data to worker
            worker.postMessage({
                type: 'analyze',
                requestId: `analysis-${Date.now()}`,
                model
            });
        });
    }, [getWorker]);

    /**
     * Terminate worker
     */
    const terminate = useCallback(() => {
        if (workerRef.current) {
            workerRef.current.terminate();
            workerRef.current = null;
        }
        setIsAnalyzing(false);
        setProgress(null);
    }, []);

    // Automatically terminate worker on unmount
    useEffect(() => {
        return () => {
            workerRef.current?.terminate();
            workerRef.current = null;
        };
    }, []);

    /**
     * Convert model store format to solver format
     */
    const prepareModel = useCallback((
        nodes: Array<{ id: string; x: number; y: number; z: number; restraints?: any }>,
        members: Array<{ id: string; startNodeId: string; endNodeId: string; E?: number; A?: number; I?: number; Iy?: number; Iz?: number; J?: number; G?: number; releases?: any }>,
        loads: Array<{ nodeId: string; fx?: number; fy?: number; fz?: number }>,
        dofPerNode: 2 | 3 | 6 = 6
    ): ModelData => {
        return {
            nodes: nodes.map(n => ({
                id: n.id,
                x: n.x,
                y: n.y,
                z: n.z,
                restraints: n.restraints
            })),
            members: members.map(m => ({
                id: m.id,
                startNodeId: m.startNodeId,
                endNodeId: m.endNodeId,
                E: m.E ?? 200e9,    // Default: Steel
                A: m.A ?? 0.01,     // Default: 100 cm²
                I: m.I ?? 1e-4,     // Default: 10000 cm⁴
                Iy: m.Iy ?? m.I ?? 1e-4,
                Iz: m.Iz ?? m.I ?? 1e-4,
                J: m.J ?? (m.I ?? 1e-4) * 2,
                G: m.G ?? (m.E ?? 200e9) / 2.6,
                releases: m.releases
            })),
            loads: loads.map(l => ({
                nodeId: l.nodeId,
                fx: l.fx,
                fy: l.fy,
                fz: l.fz
            })),
            dofPerNode
        };
    }, []);

    /**
     * Get progress stage label
     */
    const getStageLabel = useCallback((stage: ProgressInfo['stage']): string => {
        const labels: Record<ProgressInfo['stage'], string> = {
            assembling: 'Assembling Stiffness Matrix',
            applying_bc: 'Applying Boundary Conditions',
            solving: 'Solving System',
            extracting: 'Extracting Results'
        };
        return labels[stage];
    }, []);

    return {
        analyze,
        prepareModel,
        terminate,
        isAnalyzing,
        progress,
        getStageLabel
    };
}

export default useStructuralSolver;
