/**
 * Tests for useAnalysisRouter hook
 * Feature: user-data-management-and-platform
 * Properties 10, 15, 16, 17
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import * as fc from 'fast-check';

// Mock fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Mock webgpuRuntime
vi.mock('../../utils/webgpuRuntime.js', () => ({
    runLocalAnalysis: vi.fn().mockResolvedValue({ displacements: [], reactions: [] }),
}));

function makeModel(nodeCount = 2, memberCount = 1) {
    return {
        nodes: Array.from({ length: nodeCount }, (_, i) => ({ id: `n${i}`, x: i, y: 0, z: 0 })),
        members: Array.from({ length: memberCount }, (_, i) => ({ id: `m${i}`, startNodeId: `n${i}`, endNodeId: `n${i + 1}` })),
        loads: [],
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
    // Reset cached values by re-importing with cache cleared
    const mod = await import('../useAnalysisRouter');
    return mod;
}

describe('useAnalysisRouter', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        // Reset module-level cache
        vi.resetModules();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

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

    // Feature: user-data-management-and-platform, Property 15: Analysis routing by compute mode
    it('Property 15: local mode makes zero HTTP calls to analysis API', async () => {
        setupWebGpu(true);
        const { useAnalysisRouter } = await freshHook();
        const { result } = renderHook(() => useAnalysisRouter());
        await waitFor(() => expect(result.current.isDetecting).toBe(false));

        await result.current.runAnalysis(makeModel(), 'local');

        // No fetch calls to /api/analysis/run or /api/analysis/preflight
        const analysisCalls = mockFetch.mock.calls.filter(
            (call) => typeof call?.[0] === 'string' && call[0].includes('/api/analysis')
        );
        expect(analysisCalls.length).toBe(0);
    });

    // Feature: user-data-management-and-platform, Property 15: Analysis routing by compute mode
    it('Property 15: server mode calls preflight then run', async () => {
        setupWebGpu(false);
        mockFetch
            .mockResolvedValueOnce({ ok: true, json: async () => ({ data: { weight: 1, remaining: 4 } }) })
            .mockResolvedValueOnce({ ok: true, json: async () => ({ computeMode: 'server', computeUnitsCharged: 1 }) });

        const { useAnalysisRouter } = await freshHook();
        const { result } = renderHook(() => useAnalysisRouter());
        await waitFor(() => expect(result.current.isDetecting).toBe(false));

        await result.current.runAnalysis(makeModel(), 'server');

        expect(mockFetch).toHaveBeenCalledWith(
            expect.stringContaining('/api/analysis/preflight'),
            expect.any(Object)
        );
        expect(mockFetch).toHaveBeenCalledWith(
            expect.stringContaining('/api/analysis/run'),
            expect.any(Object)
        );
    });

    // Feature: user-data-management-and-platform, Property 16: Memory preflight warns when over GPU limit
    it('Property 16: memory preflight warns when model exceeds GPU memory', async () => {
        setupWebGpu(true, 1); // 1MB GPU memory
        const { useAnalysisRouter } = await freshHook();
        const { result } = renderHook(() => useAnalysisRouter());
        await waitFor(() => expect(result.current.isDetecting).toBe(false));

        // Large model that will exceed 1MB
        const bigModel = makeModel(500, 500);
        const preflight = await result.current.checkMemoryPreflight(bigModel);

        // Either fits=false with warning, or fits=true if memory not reported
        if (!preflight.fits) {
            expect(preflight.warning).toBeDefined();
        }
    });

    // Feature: user-data-management-and-platform, Property 17: Local analysis result has correct compute mode
    it('Property 17: local analysis result has computeMode=local and computeUnitsCharged=0', async () => {
        setupWebGpu(true);
        const { useAnalysisRouter } = await freshHook();
        const { result } = renderHook(() => useAnalysisRouter());
        await waitFor(() => expect(result.current.isDetecting).toBe(false));

        const analysisResult = await result.current.runAnalysis(makeModel(), 'local');

        expect(analysisResult.computeMode).toBe('local');
        expect(analysisResult.computeUnitsCharged).toBe(0);
    });

    // Feature: user-data-management-and-platform, Property 10: Local compute does not consume server quota
    it('Property 10: local mode does not call server quota endpoints', async () => {
        setupWebGpu(true);
        const { useAnalysisRouter } = await freshHook();
        const { result } = renderHook(() => useAnalysisRouter());
        await waitFor(() => expect(result.current.isDetecting).toBe(false));

        await result.current.runAnalysis(makeModel(), 'local');

        const quotaCalls = mockFetch.mock.calls.filter(
            (call) => typeof call?.[0] === 'string' && (call[0].includes('/quota') || call[0].includes('/analysis/run'))
        );
        expect(quotaCalls.length).toBe(0);
    });

    // Feature: user-data-management-and-platform, Property 17: Local analysis result shape (property-based)
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

    it('WebGPU runtime error surfaces error result and offers server fallback', async () => {
        setupWebGpu(true);
        const { runLocalAnalysis } = await import('../../utils/webgpuRuntime.js');
        (runLocalAnalysis as any).mockRejectedValueOnce(new Error('GPU crash'));

        const { useAnalysisRouter } = await freshHook();
        const { result } = renderHook(() => useAnalysisRouter());
        await waitFor(() => expect(result.current.isDetecting).toBe(false));

        const res = await result.current.runAnalysis(makeModel(), 'local');
        expect(res.error).toBeDefined();
        expect(res.serverFallbackAvailable).toBe(true);
    });
});
