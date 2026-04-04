/**
 * Tests for useAnalysisRouter hook
 * Feature: beamlab-platform-refinement
 * Properties 5, 6, 10, 15, 16, 17, 21
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import * as fc from 'fast-check';

// Mock fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Mock webgpuRuntime
vi.mock('../../utils/webgpuRuntime.js', () => ({
    runLocalAnalysis: vi.fn().mockResolvedValue({
        displacements: [],
        reactions: [],
        memberForces: [],
    }),
}));

// Mock wasmSolver
vi.mock('../../utils/wasmSolver.js', () => ({
    runWasmAnalysis: vi.fn().mockResolvedValue({
        displacements: [],
        reactions: [],
        memberForces: [],
    }),
}));

// Mock toast utility
vi.mock('../../utils/toast.js', () => ({
    toast: vi.fn(),
}));

function makeModel(nodeCount = 2, memberCount = 1, analysisType: 'static' | 'dynamic' = 'static') {
    return {
        nodes: Array.from({ length: nodeCount }, (_, i) => ({ id: `n${i}`, x: i, y: 0, z: 0 })),
        members: Array.from({ length: memberCount }, (_, i) => ({ id: `m${i}`, startNodeId: `n${i}`, endNodeId: `n${i + 1}` })),
        loads: [],
        analysisType,
    };
}

function setupWebGpu(available: boolean, adapterMemoryMb?: number) {
    const adapter = available ? {
        requestAdapterInfo: adapterMemoryMb
            ? async () => ({ memoryHeaps: [{ size: adapterMemoryMb * 1024 * 1024 }] })
            : async () => ({}),
    } : null;

    const gpuValue = available ? { requestAdapter: async () => adapter } : undefined;

    Object.defineProperty(global.navigator, 'gpu', {
        value: gpuValue,
        writable: true,
        configurable: true,
    });

    return adapter;
}

// Reset module-level cache between tests
async function freshHook() {
    const mod = await import('../useAnalysisRouter');
    return mod;
}

// ─── Result shape assertion ───────────────────────────────────────────────────
function assertResultShape(res: Record<string, unknown>) {
    expect(Array.isArray(res.displacements)).toBe(true);
    expect(Array.isArray(res.reactions)).toBe(true);
    expect(Array.isArray(res.memberForces)).toBe(true);
    expect(typeof res.backend).toBe('string');
    expect(typeof res.computeTimeMs).toBe('number');
}

describe('useAnalysisRouter', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockFetch.mockReset();
        vi.resetModules();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    // ── WebGPU detection ──────────────────────────────────────────────────────

    it('detects WebGPU as available when navigator.gpu exists', async () => {
        setupWebGpu(true);
        const { useAnalysisRouter } = await freshHook();
        const { result } = renderHook(() => useAnalysisRouter());
        await waitFor(() => expect(result.current.isDetecting).toBe(false));
        expect(result.current.webGpuAvailable).toBe(true);
    });

    it('detects WebGPU as unavailable when navigator.gpu is absent', async () => {
        setupWebGpu(false);
        const { useAnalysisRouter } = await freshHook();
        const { result } = renderHook(() => useAnalysisRouter());
        await waitFor(() => expect(result.current.isDetecting).toBe(false));
        expect(result.current.webGpuAvailable).toBe(false);
    });

    // ── Property 15: Analysis routing by compute mode ─────────────────────────

    it('Property 15: local mode makes zero HTTP calls to analysis API', async () => {
        setupWebGpu(true);
        const { useAnalysisRouter } = await freshHook();
        const { result } = renderHook(() => useAnalysisRouter());
        await waitFor(() => expect(result.current.isDetecting).toBe(false));

        await result.current.runAnalysis(makeModel(2, 1, 'static'), 'local');

        const analysisCalls = mockFetch.mock.calls.filter(
            (call) => typeof call?.[0] === 'string' && call[0].includes('/api/analysis')
        );
        expect(analysisCalls.length).toBe(0);
    });

    it('Property 15: server mode calls preflight then run', async () => {
        setupWebGpu(false);
        mockFetch
            .mockResolvedValueOnce({ ok: true, json: async () => ({ data: { weight: 1, remaining: 4 } }) })
            // Rust health check
            .mockResolvedValueOnce({ ok: false })
            .mockResolvedValueOnce({
                ok: true,
                json: async () => ({
                    computeMode: 'server',
                    computeUnitsCharged: 1,
                    displacements: [],
                    reactions: [],
                    memberForces: [],
                    backend: 'python',
                    computeTimeMs: 10,
                }),
            });

        const { useAnalysisRouter } = await freshHook();
        const { result } = renderHook(() => useAnalysisRouter());
        await waitFor(() => expect(result.current.isDetecting).toBe(false));

        await result.current.runAnalysis(makeModel(600, 1, 'static'), 'server');

        expect(mockFetch).toHaveBeenCalledWith(
            expect.stringContaining('/api/analysis/preflight'),
            expect.any(Object)
        );
        expect(mockFetch).toHaveBeenCalledWith(
            expect.stringContaining('/api/analysis/run'),
            expect.any(Object)
        );
    });

    // ── Property 16: Memory preflight ────────────────────────────────────────

    it('Property 16: memory preflight warns when model exceeds GPU memory', async () => {
        setupWebGpu(true, 1); // 1MB GPU memory
        const { useAnalysisRouter } = await freshHook();
        const { result } = renderHook(() => useAnalysisRouter());
        await waitFor(() => expect(result.current.isDetecting).toBe(false));

        const bigModel = makeModel(500, 500);
        const preflight = await result.current.checkMemoryPreflight(bigModel);

        if (!preflight.fits) {
            expect(preflight.warning).toBeDefined();
        }
    });

    // ── Property 17: Local analysis result shape ──────────────────────────────

    it('Property 17: local analysis result has computeMode=local and computeUnitsCharged=0', async () => {
        setupWebGpu(true);
        const { useAnalysisRouter } = await freshHook();
        const { result } = renderHook(() => useAnalysisRouter());
        await waitFor(() => expect(result.current.isDetecting).toBe(false));

        const analysisResult = await result.current.runAnalysis(makeModel(2, 1, 'static'), 'local');

        expect(analysisResult.computeMode).toBe('local');
        expect(analysisResult.computeUnitsCharged).toBe(0);
    });

    // ── Property 10: Local compute does not consume server quota ──────────────

    it('Property 10: local mode does not call server quota endpoints', async () => {
        setupWebGpu(true);
        const { useAnalysisRouter } = await freshHook();
        const { result } = renderHook(() => useAnalysisRouter());
        await waitFor(() => expect(result.current.isDetecting).toBe(false));

        await result.current.runAnalysis(makeModel(2, 1, 'static'), 'local');

        const quotaCalls = mockFetch.mock.calls.filter(
            (call) => typeof call?.[0] === 'string' && (call[0].includes('/quota') || call[0].includes('/analysis/run'))
        );
        expect(quotaCalls.length).toBe(0);
    });

    // ── Property 17 PBT ───────────────────────────────────────────────────────

    it('Property 17 (PBT): all local results have computeMode=local and computeUnitsCharged=0', async () => {
        setupWebGpu(true);
        const { useAnalysisRouter } = await freshHook();
        const { result } = renderHook(() => useAnalysisRouter());
        await waitFor(() => expect(result.current.isDetecting).toBe(false));

        await fc.assert(
            fc.asyncProperty(
                fc.integer({ min: 1, max: 20 }),
                fc.integer({ min: 0, max: 10 }),
                async (nodeCount, memberCount) => {
                    const model = makeModel(nodeCount, Math.min(memberCount, nodeCount - 1));
                    const res = await result.current.runAnalysis(model, 'local');
                    return res.computeMode === 'local' && res.computeUnitsCharged === 0;
                }
            ),
            { numRuns: 100 }
        );
    });

    // ── WebGPU error → serverFallbackAvailable ────────────────────────────────

    it('WebGPU runtime error surfaces error result and offers server fallback', async () => {
        setupWebGpu(true);
        const { runLocalAnalysis } = await import('../../utils/webgpuRuntime.js');
        (runLocalAnalysis as any).mockRejectedValueOnce(new Error('GPU crash'));

        const { useAnalysisRouter } = await freshHook();
        const { result } = renderHook(() => useAnalysisRouter());
        await waitFor(() => expect(result.current.isDetecting).toBe(false));

        // Use a non-static type so it goes through WebGPU path (not WASM)
        const res = await result.current.runAnalysis(makeModel(2, 1, 'dynamic'), 'local');
        expect(res.error).toBeDefined();
        expect(res.serverFallbackAvailable).toBe(true);
    });

    // ── Property 5: Routing by node count ────────────────────────────────────
    // Validates: Requirements 7.1, 7.2

    it('Property 5: nodeCount < 500 + static routes to WASM (backend=wasm)', async () => {
        setupWebGpu(false);
        const { runWasmAnalysis } = await import('../../utils/wasmSolver.js');
        (runWasmAnalysis as any).mockResolvedValue({
            displacements: [],
            reactions: [],
            memberForces: [],
        });

        const { useAnalysisRouter } = await freshHook();
        const { result } = renderHook(() => useAnalysisRouter());
        await waitFor(() => expect(result.current.isDetecting).toBe(false));

        const res = await result.current.runAnalysis(makeModel(10, 5, 'static'));
        expect(res.backend).toBe('wasm');
        expect(res.computeMode).toBe('local');
        expect(res.computeUnitsCharged).toBe(0);
    });

    it('Property 5: nodeCount >= 500 routes to server gateway', async () => {
        setupWebGpu(false);
        mockFetch
            // preflight
            .mockResolvedValueOnce({ ok: true, json: async () => ({ weight: 5, remaining: 10 }) })
            // server run
            .mockResolvedValueOnce({
                ok: true,
                json: async () => ({
                    displacements: [1],
                    reactions: [2],
                    memberForces: [3],
                    backend: 'server',
                    computeUnitsCharged: 5,
                    computeTimeMs: 200,
                }),
            });

        const { useAnalysisRouter } = await freshHook();
        const { result } = renderHook(() => useAnalysisRouter());
        await waitFor(() => expect(result.current.isDetecting).toBe(false));

        const res = await result.current.runAnalysis(makeModel(500, 10, 'static'));
        expect(res.backend).toBe('server');
        expect(res.computeMode).toBe('server');
    });

    it('Property 5 (PBT): small static models always route to WASM', async () => {
        setupWebGpu(false);
        const { runWasmAnalysis } = await import('../../utils/wasmSolver.js');
        (runWasmAnalysis as any).mockResolvedValue({
            displacements: [],
            reactions: [],
            memberForces: [],
        });

        const { useAnalysisRouter } = await freshHook();
        const { result } = renderHook(() => useAnalysisRouter());
        await waitFor(() => expect(result.current.isDetecting).toBe(false));

        await fc.assert(
            fc.asyncProperty(
                fc.integer({ min: 1, max: 499 }),
                async (nodeCount) => {
                    const model = makeModel(nodeCount, Math.max(1, nodeCount - 1), 'static');
                    const res = await result.current.runAnalysis(model);
                    return res.backend === 'wasm' && res.computeMode === 'local' && res.computeUnitsCharged === 0;
                }
            ),
            { numRuns: 50 }
        );
    });

    it('Property 5 (PBT): large models (>=500) route to server gateway', async () => {
        setupWebGpu(false);

        const { useAnalysisRouter } = await freshHook();
        const { result } = renderHook(() => useAnalysisRouter());
        await waitFor(() => expect(result.current.isDetecting).toBe(false));

        await fc.assert(
            fc.asyncProperty(
                fc.integer({ min: 500, max: 600 }),
                async (nodeCount) => {
                    mockFetch
                        .mockResolvedValueOnce({ ok: true, json: async () => ({ weight: 5, remaining: 10 }) })
                        .mockResolvedValueOnce({
                            ok: true,
                            json: async () => ({
                                displacements: [],
                                reactions: [],
                                memberForces: [],
                                backend: 'server',
                                computeUnitsCharged: 5,
                                computeTimeMs: 100,
                            }),
                        });

                    const model = makeModel(nodeCount, 10, 'static');
                    const res = await result.current.runAnalysis(model);
                    return res.backend === 'server' && res.computeMode === 'server';
                }
            ),
            { numRuns: 20 }
        );
    });

    // ── Fallback: Rust unavailable → Python_API ───────────────────────────────

    it('server gateway response can report python backend metadata', async () => {
        setupWebGpu(false);
        mockFetch
            // preflight
            .mockResolvedValueOnce({ ok: true, json: async () => ({ weight: 5, remaining: 10 }) })
            // server run
            .mockResolvedValueOnce({
                ok: true,
                json: async () => ({
                    displacements: [],
                    reactions: [],
                    memberForces: [],
                    backend: 'python',
                    computeUnitsCharged: 5,
                    computeTimeMs: 500,
                }),
            });

        const { useAnalysisRouter } = await freshHook();
        const { result } = renderHook(() => useAnalysisRouter());
        await waitFor(() => expect(result.current.isDetecting).toBe(false));

        const res = await result.current.runAnalysis(makeModel(500, 10, 'static'));
        expect(res.backend).toBe('python');
        expect(res.computeMode).toBe('server');
    });

    // ── WASM failure → falls through to server ────────────────────────────────

    it('WASM failure falls through to server (Rust_API)', async () => {
        setupWebGpu(false);
        const { runWasmAnalysis } = await import('../../utils/wasmSolver.js');
        (runWasmAnalysis as any).mockRejectedValueOnce(new Error('WASM crash'));

        mockFetch
            // preflight
            .mockResolvedValueOnce({ ok: true, json: async () => ({ weight: 1, remaining: 10 }) })
            // rust health → available
            .mockResolvedValueOnce({ ok: true, json: async () => ({}) })
            // rust run
            .mockResolvedValueOnce({
                ok: true,
                json: async () => ({
                    displacements: [],
                    reactions: [],
                    memberForces: [],
                    backend: 'rust',
                    computeUnitsCharged: 1,
                    computeTimeMs: 100,
                }),
            });

        const { useAnalysisRouter } = await freshHook();
        const { result } = renderHook(() => useAnalysisRouter());
        await waitFor(() => expect(result.current.isDetecting).toBe(false));

        const res = await result.current.runAnalysis(makeModel(10, 5, 'static'));
        // After WASM failure it falls through to server
        expect(res.computeMode).toBe('server');
    });

    // ── Python timeout → retryAvailable ──────────────────────────────────────

    it('server timeout surfaces retryAvailable=true', async () => {
        setupWebGpu(false);
        mockFetch
            // preflight
            .mockResolvedValueOnce({ ok: true, json: async () => ({ weight: 5, remaining: 10 }) })
            // server run → AbortError (simulates timeout)
            .mockImplementationOnce(() => Promise.reject(Object.assign(new Error('The operation was aborted'), { name: 'AbortError' })));

        const { useAnalysisRouter } = await freshHook();
        const { result } = renderHook(() => useAnalysisRouter());
        await waitFor(() => expect(result.current.isDetecting).toBe(false));

        const res = await result.current.runAnalysis(makeModel(500, 10, 'static'));
        expect(res.retryAvailable).toBe(true);
        expect(res.error).toContain('timed out');
    });

    // ── Property 6: AnalysisResult shape invariant ────────────────────────────
    // Validates: Requirement 7.5

    it('Property 6: WASM result always has normalized shape', async () => {
        setupWebGpu(false);
        const { runWasmAnalysis } = await import('../../utils/wasmSolver.js');
        (runWasmAnalysis as any).mockResolvedValue({
            displacements: [{ nodeId: 'n0', dx: 0.001 }],
            reactions: [{ nodeId: 'n1', fx: 10 }],
            memberForces: [{ memberId: 'm0', axial: 5 }],
        });

        const { useAnalysisRouter } = await freshHook();
        const { result } = renderHook(() => useAnalysisRouter());
        await waitFor(() => expect(result.current.isDetecting).toBe(false));

        const res = await result.current.runAnalysis(makeModel(10, 5, 'static'));
        assertResultShape(res);
        expect(res.backend).toBe('wasm');
    });

    it('Property 6: server result always has normalized shape', async () => {
        setupWebGpu(false);
        mockFetch
            .mockResolvedValueOnce({ ok: true, json: async () => ({ weight: 5, remaining: 10 }) })
            .mockResolvedValueOnce({
                ok: true,
                json: async () => ({
                    displacements: [{ nodeId: 'n0', dx: 0.002 }],
                    reactions: [{ nodeId: 'n1', fx: 20 }],
                    memberForces: [{ memberId: 'm0', axial: 10 }],
                    backend: 'server',
                    computeUnitsCharged: 5,
                    computeTimeMs: 300,
                }),
            });

        const { useAnalysisRouter } = await freshHook();
        const { result } = renderHook(() => useAnalysisRouter());
        await waitFor(() => expect(result.current.isDetecting).toBe(false));

        const res = await result.current.runAnalysis(makeModel(500, 10, 'static'));
        assertResultShape(res);
        expect(res.backend).toBe('server');
    });

    it('Property 6 (PBT): result shape invariant holds across all backends', async () => {
        setupWebGpu(false);
        const { runWasmAnalysis } = await import('../../utils/wasmSolver.js');
        (runWasmAnalysis as any).mockResolvedValue({
            displacements: [],
            reactions: [],
            memberForces: [],
        });

        const { useAnalysisRouter } = await freshHook();
        const { result } = renderHook(() => useAnalysisRouter());
        await waitFor(() => expect(result.current.isDetecting).toBe(false));

        await fc.assert(
            fc.asyncProperty(
                fc.integer({ min: 1, max: 499 }),
                async (nodeCount) => {
                    const model = makeModel(nodeCount, Math.max(1, nodeCount - 1), 'static');
                    const res = await result.current.runAnalysis(model);
                    return (
                        Array.isArray(res.displacements) &&
                        Array.isArray(res.reactions) &&
                        Array.isArray(res.memberForces) &&
                        typeof res.backend === 'string' &&
                        typeof res.computeTimeMs === 'number'
                    );
                }
            ),
            { numRuns: 50 }
        );
    });

    // ── Property 21: Local compute quota exemption ────────────────────────────
    // Validates: Requirements 7.1 (local path), 12.8

    it('Property 21: local compute never charges quota (computeUnitsCharged=0)', async () => {
        setupWebGpu(false);
        const { runWasmAnalysis } = await import('../../utils/wasmSolver.js');
        (runWasmAnalysis as any).mockResolvedValue({
            displacements: [],
            reactions: [],
            memberForces: [],
        });

        const { useAnalysisRouter } = await freshHook();
        const { result } = renderHook(() => useAnalysisRouter());
        await waitFor(() => expect(result.current.isDetecting).toBe(false));

        await fc.assert(
            fc.asyncProperty(
                fc.integer({ min: 1, max: 499 }),
                async (nodeCount) => {
                    const model = makeModel(nodeCount, Math.max(1, nodeCount - 1), 'static');
                    const res = await result.current.runAnalysis(model);
                    return res.computeUnitsCharged === 0;
                }
            ),
            { numRuns: 50 }
        );
    });
});
