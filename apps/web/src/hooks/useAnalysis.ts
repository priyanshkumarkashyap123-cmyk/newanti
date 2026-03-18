/**
 * useAnalysis - Unified analysis hook with WASM → Rust → Python routing
 *
 * Routing logic:
 *   nodeCount < 500 && type === 'static' && wasmRunner → WASM
 *   rustApi.isAvailable()                              → Rust
 *   else                                               → Python job queue (with toast)
 */

import { useState, useCallback } from 'react';
import { rustApi } from '../api/rustApi';
import type { AnalysisModel } from '../api/rustApi';

// ============================================
// TYPES
// ============================================

export interface ModeShape {
    nodeId: string;
    dx: number;
    dy: number;
    dz: number;
}

export interface BucklingResult {
    loadFactors: number[];
    modeShapes: ModeShape[][];
}

export interface LoadCombination {
    id: string;
    name: string;
    factors: Record<string, number>;
    envelopeForces: unknown[];
}

export interface RCBeamResult {
    momentCapacity: number;
    shearCapacity: number;
    mainReinforcement: number;
    stirrupSpacing: number;
    utilizationRatio: number;
    status: 'PASS' | 'FAIL' | 'WARNING';
}

export interface UnifiedAnalysisResult {
    displacements: Map<string, { dx: number; dy: number; dz: number }>;
    reactions: Map<string, { fx: number; fy: number; fz: number; mx: number; my: number; mz: number }>;
    memberForces: Map<string, { axial: number; shearY: number; shearZ: number; momentY: number; momentZ: number }>;
    modalResults?: {
        modes: ModeShape[];
        frequencies: number[];
        participationFactors: number[];
    };
    bucklingResult?: BucklingResult;
    loadCombos?: LoadCombination[];
    rcBeamResults?: Map<string, RCBeamResult>;
    backend: 'wasm' | 'rust' | 'python';
    computeTimeMs: number;
}

export interface AnalysisProgressStep {
    step: string;
    percent: number;
    timestamp: number;
}

export type AnalysisType = 'static' | 'modal' | 'buckling' | 'nonlinear' | 'time_history' | 'response_spectrum';

// ============================================
// NORMALIZERS
// ============================================

function normalizeRCBeamResult(raw: Record<string, unknown>): RCBeamResult {
    return {
        momentCapacity: (raw.moment_capacity as number) ?? 0,
        shearCapacity: (raw.shear_capacity as number) ?? 0,
        mainReinforcement: (raw.main_reinforcement as number) ?? 0,
        stirrupSpacing: (raw.stirrup_spacing as number) ?? 0,
        utilizationRatio: (raw.utilization_ratio as number) ?? 0,
        status: (raw.status as RCBeamResult['status']) ?? 'PASS',
    };
}

function normalizeRustResult(raw: unknown): UnifiedAnalysisResult {
    const r = raw as Record<string, unknown>;
    const displacements = new Map<string, { dx: number; dy: number; dz: number }>();
    const reactions = new Map<string, { fx: number; fy: number; fz: number; mx: number; my: number; mz: number }>();
    const memberForces = new Map<string, { axial: number; shearY: number; shearZ: number; momentY: number; momentZ: number }>();

    if (r.displacements && typeof r.displacements === 'object') {
        Object.entries(r.displacements as Record<string, unknown>).forEach(([id, d]) => {
            const disp = d as Record<string, number>;
            displacements.set(id, { dx: disp.dx ?? 0, dy: disp.dy ?? 0, dz: disp.dz ?? 0 });
        });
    }
    if (r.reactions && typeof r.reactions === 'object') {
        Object.entries(r.reactions as Record<string, unknown>).forEach(([id, rx]) => {
            const react = rx as Record<string, number>;
            reactions.set(id, { fx: react.fx ?? 0, fy: react.fy ?? 0, fz: react.fz ?? 0, mx: react.mx ?? 0, my: react.my ?? 0, mz: react.mz ?? 0 });
        });
    }
    if (r.member_forces && typeof r.member_forces === 'object') {
        Object.entries(r.member_forces as Record<string, unknown>).forEach(([id, f]) => {
            const force = f as Record<string, number>;
            memberForces.set(id, {
                axial: force.axial ?? force.N ?? 0,
                shearY: force.shear_y ?? force.Vy ?? 0,
                shearZ: force.shear_z ?? force.Vz ?? 0,
                momentY: force.moment_y ?? force.My ?? 0,
                momentZ: force.moment_z ?? force.Mz ?? 0,
            });
        });
    }

    return { displacements, reactions, memberForces, backend: 'rust', computeTimeMs: (r.time_ms as number) ?? 0 };
}

function normalizePythonResult(raw: unknown): UnifiedAnalysisResult {
    const r = raw as Record<string, unknown>;
    const displacements = new Map<string, { dx: number; dy: number; dz: number }>();
    const reactions = new Map<string, { fx: number; fy: number; fz: number; mx: number; my: number; mz: number }>();
    const memberForces = new Map<string, { axial: number; shearY: number; shearZ: number; momentY: number; momentZ: number }>();

    if (r.displacements && typeof r.displacements === 'object') {
        Object.entries(r.displacements as Record<string, unknown>).forEach(([id, d]) => {
            const disp = d as Record<string, number>;
            displacements.set(id, { dx: disp.dx ?? disp.x ?? 0, dy: disp.dy ?? disp.y ?? 0, dz: disp.dz ?? disp.z ?? 0 });
        });
    }
    if (r.reactions && typeof r.reactions === 'object') {
        Object.entries(r.reactions as Record<string, unknown>).forEach(([id, rx]) => {
            const react = rx as Record<string, number>;
            reactions.set(id, { fx: react.fx ?? react.Fx ?? 0, fy: react.fy ?? react.Fy ?? 0, fz: react.fz ?? react.Fz ?? 0, mx: react.mx ?? 0, my: react.my ?? 0, mz: react.mz ?? 0 });
        });
    }
    if (r.member_forces && typeof r.member_forces === 'object') {
        Object.entries(r.member_forces as Record<string, unknown>).forEach(([id, f]) => {
            const force = f as Record<string, number>;
            memberForces.set(id, {
                axial: force.axial ?? force.N ?? 0,
                shearY: force.shear_y ?? force.Vy ?? 0,
                shearZ: force.shear_z ?? force.Vz ?? 0,
                momentY: force.moment_y ?? force.My ?? 0,
                momentZ: force.moment_z ?? force.Mz ?? 0,
            });
        });
    }

    // Modal results
    let modalResults: UnifiedAnalysisResult['modalResults'];
    if (r.modal_results) {
        const modal = r.modal_results as Record<string, unknown>;
        modalResults = {
            modes: (modal.mode_shapes as ModeShape[]) ?? [],
            frequencies: (modal.frequencies as number[]) ?? [],
            participationFactors: (modal.participation_factors as number[]) ?? [],
        };
    }

    // Buckling result
    let bucklingResult: BucklingResult | undefined;
    if (r.buckling_factors) {
        bucklingResult = {
            loadFactors: (r.buckling_factors as number[]) ?? [],
            modeShapes: (r.mode_shapes as ModeShape[][]) ?? [],
        };
    }

    // Load combinations
    let loadCombos: LoadCombination[] | undefined;
    if (r.load_combinations) {
        loadCombos = (r.load_combinations as LoadCombination[]) ?? [];
    }

    // RC beam results — normalize snake_case → camelCase
    let rcBeamResults: Map<string, RCBeamResult> | undefined;
    if (r.rc_design && typeof r.rc_design === 'object') {
        rcBeamResults = new Map();
        Object.entries(r.rc_design as Record<string, unknown>).forEach(([memberId, raw]) => {
            rcBeamResults!.set(memberId, normalizeRCBeamResult(raw as Record<string, unknown>));
        });
    }

    return { displacements, reactions, memberForces, modalResults, bucklingResult, loadCombos, rcBeamResults, backend: 'python', computeTimeMs: (r.compute_time_ms as number) ?? 0 };
}

// ============================================
// ROUTING
// ============================================

export async function routeAnalysis(
    model: AnalysisModel,
    analysisType: AnalysisType,
    wasmRunner?: () => Promise<unknown>,
    onProgress?: (step: AnalysisProgressStep) => void,
): Promise<UnifiedAnalysisResult> {
    const nodeCount = (model as unknown as { nodes?: unknown[] }).nodes?.length ?? 0;

    // WASM path: small static models
    if (nodeCount < 500 && analysisType === 'static' && wasmRunner) {
        onProgress?.({ step: 'Running WASM solver...', percent: 10, timestamp: Date.now() });
        const raw = await wasmRunner();
        onProgress?.({ step: 'Complete', percent: 100, timestamp: Date.now() });
        const result = normalizeRustResult(raw);
        result.backend = 'wasm'; // Override backend to correctly reflect WASM execution
        return result;
    }

    // Rust path
    const rustAvailable = await rustApi.isAvailable();
    if (rustAvailable) {
        onProgress?.({ step: 'Connecting to Rust solver...', percent: 10, timestamp: Date.now() });
        const { result, timeMs } = await rustApi.smartAnalyze(model, analysisType as Parameters<typeof rustApi.smartAnalyze>[1]);
        onProgress?.({ step: 'Complete', percent: 100, timestamp: Date.now() });
        const normalized = normalizeRustResult(result);
        normalized.computeTimeMs = timeMs;
        return normalized;
    }

    // Python fallback
    onProgress?.({ step: 'Using cloud solver...', percent: 5, timestamp: Date.now() });
    // Dynamic import to avoid circular deps
    const mod = await import('../components/ui/ToastSystem').catch(() => ({ toast: null }));
    (mod as any)?.toast?.info?.('Using cloud solver');

    const { result, timeMs } = await rustApi.smartAnalyze(model, analysisType as Parameters<typeof rustApi.smartAnalyze>[1]);
    onProgress?.({ step: 'Complete', percent: 100, timestamp: Date.now() });
    const normalized = normalizePythonResult(result);
    normalized.computeTimeMs = timeMs;
    return normalized;
}

// ============================================
// HOOK
// ============================================

interface UseAnalysisOptions {
    wasmRunner?: () => Promise<unknown>;
}

export function useAnalysis(options?: UseAnalysisOptions) {
    const [result, setResult] = useState<UnifiedAnalysisResult | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [progress, setProgress] = useState<AnalysisProgressStep[]>([]);
    const [error, setError] = useState<string | null>(null);
    const [backend, setBackend] = useState<UnifiedAnalysisResult['backend'] | null>(null);

    const analyze = useCallback(async (model: AnalysisModel, analysisType: AnalysisType = 'static') => {
        setIsLoading(true);
        setError(null);
        setProgress([]);

        try {
            const res = await routeAnalysis(
                model,
                analysisType,
                options?.wasmRunner,
                (step) => setProgress((prev) => [...prev, step]),
            );
            setResult(res);
            setBackend(res.backend);
            return res;
        } catch (err) {
            const msg = err instanceof Error ? err.message : 'Analysis failed';
            setError(msg);
            return null;
        } finally {
            setIsLoading(false);
        }
    }, [options?.wasmRunner]);

    return { result, isLoading, progress, error, backend, analyze };
}

export default useAnalysis;
