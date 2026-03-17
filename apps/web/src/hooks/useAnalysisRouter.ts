/**
 * useAnalysisRouter — WebGPU detection + analysis dispatch
 *
 * - Detects WebGPU availability once on mount, caches result
 * - Routes analysis to local WebGPU or server based on computeMode
 * - Memory preflight check for local mode
 * Requirements: 8.1, 8.3, 8.4, 8.5, 8.6, 8.7, 8.8, 8.9, 9.1
 */

import { useState, useEffect, useCallback } from 'react';

export type ComputeMode = 'local' | 'server';

export interface AnalysisModel {
    nodes: Array<{ id: string; x: number; y: number; z: number }>;
    members: Array<{ id: string; startNodeId: string; endNodeId: string }>;
    loads: Array<unknown>;
    [key: string]: unknown;
}

export interface AnalysisResult {
    computeMode: ComputeMode;
    computeUnitsCharged: number;
    displacements?: unknown;
    reactions?: unknown;
    error?: string;
    [key: string]: unknown;
}

export interface MemoryPreflightResult {
    fits: boolean;
    estimatedMb: number;
    availableMb: number | null;
    warning?: string;
}

// Module-level cache so detection runs only once per page load
let cachedWebGpuAvailable: boolean | null = null;
let cachedGpuAdapter: GPUAdapter | null = null;

async function detectWebGpu(): Promise<{ available: boolean; adapter: GPUAdapter | null }> {
    if (cachedWebGpuAvailable !== null) {
        return { available: cachedWebGpuAvailable, adapter: cachedGpuAdapter };
    }
    try {
        if (!navigator.gpu) {
            cachedWebGpuAvailable = false;
            return { available: false, adapter: null };
        }
        const adapter = await navigator.gpu.requestAdapter();
        cachedWebGpuAvailable = adapter !== null;
        cachedGpuAdapter = adapter;
        return { available: cachedWebGpuAvailable, adapter };
    } catch {
        cachedWebGpuAvailable = false;
        return { available: false, adapter: null };
    }
}

/** Estimate GPU memory footprint in MB for a given model */
function estimateModelMemoryMb(model: AnalysisModel): number {
    const nodeCount = model.nodes?.length ?? 0;
    const memberCount = model.members?.length ?? 0;
    // Rough estimate: 6 DOF per node × 8 bytes × stiffness matrix overhead
    return Math.ceil((nodeCount * 6 * memberCount * 6 * 8) / (1024 * 1024)) + 10;
}

export interface UseAnalysisRouterReturn {
    webGpuAvailable: boolean;
    isDetecting: boolean;
    runAnalysis: (model: AnalysisModel, mode?: ComputeMode) => Promise<AnalysisResult>;
    checkMemoryPreflight: (model: AnalysisModel) => Promise<MemoryPreflightResult>;
}

export function useAnalysisRouter(): UseAnalysisRouterReturn {
    const [webGpuAvailable, setWebGpuAvailable] = useState<boolean>(cachedWebGpuAvailable ?? false);
    const [isDetecting, setIsDetecting] = useState<boolean>(cachedWebGpuAvailable === null);

    useEffect(() => {
        if (cachedWebGpuAvailable !== null) return;
        setIsDetecting(true);
        detectWebGpu().then(({ available }) => {
            setWebGpuAvailable(available);
            setIsDetecting(false);
        });
    }, []);

    const checkMemoryPreflight = useCallback(async (model: AnalysisModel): Promise<MemoryPreflightResult> => {
        const estimatedMb = estimateModelMemoryMb(model);
        let availableMb: number | null = null;

        if (cachedGpuAdapter) {
            try {
                const info = await (cachedGpuAdapter as any).requestAdapterInfo?.();
                // WebGPU doesn't expose memory directly; use a conservative heuristic
                availableMb = info?.memoryHeaps?.[0]?.size
                    ? Math.floor(info.memoryHeaps[0].size / (1024 * 1024))
                    : null;
            } catch { /* not available */ }
        }

        const fits = availableMb === null || estimatedMb <= availableMb;
        return {
            fits,
            estimatedMb,
            availableMb,
            warning: fits ? undefined : `Model requires ~${estimatedMb}MB but GPU has ~${availableMb}MB available`,
        };
    }, []);

    const runAnalysis = useCallback(async (
        model: AnalysisModel,
        mode: ComputeMode = webGpuAvailable ? 'local' : 'server'
    ): Promise<AnalysisResult> => {
        if (mode === 'local') {
            if (!webGpuAvailable) {
                // Fallback to server if WebGPU not available
                return runAnalysis(model, 'server');
            }

            // Memory preflight
            const preflight = await checkMemoryPreflight(model);
            if (!preflight.fits) {
                return {
                    computeMode: 'local',
                    computeUnitsCharged: 0,
                    error: preflight.warning,
                    memoryWarning: true,
                };
            }

            // Local WebGPU execution — delegate to WebGPU runtime
            try {
                const { runLocalAnalysis } = await import('../utils/webgpuRuntime.js');
                const result = await runLocalAnalysis(model);
                return {
                    ...result,
                    computeMode: 'local',
                    computeUnitsCharged: 0,
                };
            } catch (err) {
                const errorMsg = err instanceof Error ? err.message : 'WebGPU runtime error';
                return {
                    computeMode: 'local',
                    computeUnitsCharged: 0,
                    error: errorMsg,
                    serverFallbackAvailable: true,
                };
            }
        }

        // Server mode: preflight → confirm → run
        const preflightRes = await fetch('/api/analysis/preflight', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                nodeCount: model.nodes?.length ?? 0,
                memberCount: model.members?.length ?? 0,
            }),
        });

        if (!preflightRes.ok) {
            return { computeMode: 'server', computeUnitsCharged: 0, error: 'Preflight failed' };
        }

        const runRes = await fetch('/api/analysis/run', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(model),
        });

        if (!runRes.ok) {
            const errBody = await runRes.json().catch(() => ({}));
            return {
                computeMode: 'server',
                computeUnitsCharged: 0,
                error: errBody.error ?? `HTTP ${runRes.status}`,
            };
        }

        const data = await runRes.json();
        return {
            ...data,
            computeMode: 'server',
            computeUnitsCharged: data.computeUnitsCharged ?? 1,
        };
    }, [webGpuAvailable, checkMemoryPreflight]);

    return { webGpuAvailable, isDetecting, runAnalysis, checkMemoryPreflight };
}
