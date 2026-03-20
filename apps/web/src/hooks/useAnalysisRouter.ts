/**
 * useAnalysisRouter — WebGPU detection + analysis dispatch
 *
 * Routing logic:
 *   nodeCount < 500 && analysisType === 'static'  → WASM (local, no quota)
 *   nodeCount >= 500 && Rust_API available         → Rust_API
 *   nodeCount >= 500 && Rust_API unavailable       → Python_API (toast shown)
 *   WebGPU/WASM error                              → serverFallbackAvailable: true
 *   Python_API timeout (> 2 min)                   → retryAvailable: true
 *
 * AnalysisResult is normalized identically across all backends:
 *   displacements, reactions, memberForces, backend, computeTimeMs always present.
 *
 * Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 8.1, 8.3, 8.4, 8.5, 8.6, 8.7, 8.8, 9.1
 */

import { useState, useEffect, useCallback } from 'react';

export type ComputeMode = 'local' | 'server';
export type AnalysisBackend = 'wasm' | 'webgpu' | 'rust' | 'python' | 'server';

export interface AnalysisModel {
    nodes: Array<{ id: string; x: number; y: number; z: number }>;
    members: Array<{ id: string; startNodeId: string; endNodeId: string }>;
    loads: Array<unknown>;
    analysisType?: 'static' | 'dynamic' | 'modal' | 'buckling' | 'response_spectrum' | 'pushover' | 'time_history';
    [key: string]: unknown;
}

export interface AnalysisResult {
    computeMode: ComputeMode;
    computeUnitsCharged: number;
    /** Always present — empty array when not applicable */
    displacements: unknown[];
    /** Always present — empty array when not applicable */
    reactions: unknown[];
    /** Always present — empty array when not applicable */
    memberForces: unknown[];
    /** Which backend processed the request */
    backend: AnalysisBackend;
    /** Wall-clock time in milliseconds */
    computeTimeMs: number;
    error?: string;
    serverFallbackAvailable?: boolean;
    retryAvailable?: boolean;
    memoryWarning?: boolean;
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
    return Math.ceil((nodeCount * 6 * memberCount * 6 * 8) / (1024 * 1024)) + 10;
}

/** Normalize any raw backend response into the canonical AnalysisResult shape */
function normalizeResult(
    raw: Record<string, unknown>,
    overrides: Partial<AnalysisResult>
): AnalysisResult {
    return {
        computeMode: (raw.computeMode as ComputeMode) ?? overrides.computeMode ?? 'server',
        computeUnitsCharged: (raw.computeUnitsCharged as number) ?? overrides.computeUnitsCharged ?? 0,
        displacements: (raw.displacements as unknown[]) ?? [],
        reactions: (raw.reactions as unknown[]) ?? [],
        memberForces: (raw.memberForces as unknown[]) ?? [],
        backend: (raw.backend as AnalysisBackend) ?? overrides.backend ?? 'server',
        computeTimeMs: (raw.computeTimeMs as number) ?? 0,
        ...raw,
        ...overrides,
    };
}

/** Check whether Rust_API is reachable */
async function isRustApiAvailable(): Promise<boolean> {
    try {
        const res = await fetch('/api/rust/health', { method: 'GET' });
        return res.ok;
    } catch {
        return false;
    }
}

const PYTHON_TIMEOUT_MS = 2 * 60 * 1000; // 2 minutes

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
        mode?: ComputeMode
    ): Promise<AnalysisResult> => {
        const nodeCount = model.nodes?.length ?? 0;
        const analysisType = model.analysisType ?? 'static';

        // ── Determine effective mode ──────────────────────────────────────────
        // If caller didn't specify, auto-select based on node count + analysis type
        const effectiveMode: ComputeMode = mode ?? (
            nodeCount < 500 && analysisType === 'static' ? 'local' : 'server'
        );

        // ── LOCAL / WASM path ─────────────────────────────────────────────────
        if (effectiveMode === 'local') {
            // Small static models → WASM (no WebGPU required)
            if (nodeCount < 500 && analysisType === 'static') {
                const t0 = Date.now();
                try {
                    const { runWasmAnalysis } = await import('../utils/wasmSolver.js');
                    const raw = await runWasmAnalysis(model) as Record<string, unknown>;
                    return normalizeResult(raw, {
                        computeMode: 'local',
                        computeUnitsCharged: 0,
                        backend: 'wasm',
                        computeTimeMs: Date.now() - t0,
                    });
                } catch (err) {
                    // WASM failure → fall through to Rust_API
                    console.warn('[useAnalysisRouter] WASM failure, falling through to Rust_API:', err);
                    return runAnalysis(model, 'server');
                }
            }

            // WebGPU path for non-static or larger local requests
            if (!webGpuAvailable) {
                return runAnalysis(model, 'server');
            }

            const preflight = await checkMemoryPreflight(model);
            if (!preflight.fits) {
                return normalizeResult({}, {
                    computeMode: 'local',
                    computeUnitsCharged: 0,
                    backend: 'webgpu',
                    computeTimeMs: 0,
                    error: preflight.warning,
                    memoryWarning: true,
                });
            }

            const t0 = Date.now();
            try {
                const { runLocalAnalysis } = await import('../utils/webgpuRuntime.js');
                const raw = await runLocalAnalysis(model) as Record<string, unknown>;
                return normalizeResult(raw, {
                    computeMode: 'local',
                    computeUnitsCharged: 0,
                    backend: 'webgpu',
                    computeTimeMs: Date.now() - t0,
                });
            } catch (err) {
                const errorMsg = err instanceof Error ? err.message : 'WebGPU runtime error';
                return normalizeResult({}, {
                    computeMode: 'local',
                    computeUnitsCharged: 0,
                    backend: 'webgpu',
                    computeTimeMs: Date.now() - t0,
                    error: errorMsg,
                    serverFallbackAvailable: true,
                });
            }
        }

        // ── SERVER path ───────────────────────────────────────────────────────
        // nodeCount >= 500 → Rust_API preferred; Rust unavailable → Python_API

        // Preflight quota check
        const preflightRes = await fetch('/api/analysis/preflight', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                nodeCount,
                memberCount: model.members?.length ?? 0,
            }),
        });

        if (!preflightRes.ok) {
            return normalizeResult({}, {
                computeMode: 'server',
                computeUnitsCharged: 0,
                backend: 'server',
                computeTimeMs: 0,
                error: 'Preflight failed',
            });
        }

        // Determine backend: Rust_API for large models, Python_API as fallback
        const rustAvailable = nodeCount >= 500 ? await isRustApiAvailable() : false;
        const backendPath = rustAvailable ? '/api/analysis/run' : '/api/analysis/run/python';
        const expectedBackend: AnalysisBackend = rustAvailable ? 'rust' : 'python';

        if (!rustAvailable && nodeCount >= 500) {
            // Non-blocking toast notification via custom DOM event (fire-and-forget)
            try {
                window.dispatchEvent(new CustomEvent('beamlab:toast', {
                    detail: { message: 'Rust solver unavailable — using Python backend', type: 'info' },
                }));
            } catch { /* not available in test env */ }
        }

        const t0 = Date.now();

        // Python_API timeout guard
        const controller = new AbortController();
        const timeoutId = expectedBackend === 'python'
            ? setTimeout(() => controller.abort(), PYTHON_TIMEOUT_MS)
            : undefined;

        try {
            const runRes = await fetch(backendPath, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(model),
                signal: expectedBackend === 'python' ? controller.signal : undefined,
            });

            if (timeoutId) clearTimeout(timeoutId);

            if (!runRes.ok) {
                const errBody = await runRes.json().catch(() => ({})) as Record<string, unknown>;
                return normalizeResult({}, {
                    computeMode: 'server',
                    computeUnitsCharged: 0,
                    backend: expectedBackend,
                    computeTimeMs: Date.now() - t0,
                    error: (errBody.error as string) ?? `HTTP ${runRes.status}`,
                });
            }

            const data = await runRes.json() as Record<string, unknown>;
            return normalizeResult(data, {
                computeMode: 'server',
                computeUnitsCharged: (data.computeUnitsCharged as number) ?? 1,
                backend: (data.backend as AnalysisBackend) ?? expectedBackend,
                computeTimeMs: Date.now() - t0,
            });
        } catch (err) {
            if (timeoutId) clearTimeout(timeoutId);
            const isTimeout = err instanceof Error && err.name === 'AbortError';
            return normalizeResult({}, {
                computeMode: 'server',
                computeUnitsCharged: 0,
                backend: expectedBackend,
                computeTimeMs: Date.now() - t0,
                error: isTimeout
                    ? 'Analysis timed out after 2 minutes'
                    : (err instanceof Error ? err.message : 'Analysis failed'),
                retryAvailable: true,
            });
        }
    }, [webGpuAvailable, checkMemoryPreflight]);

    return { webGpuAvailable, isDetecting, runAnalysis, checkMemoryPreflight };
}
