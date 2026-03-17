/**
 * Property-Based Tests for useAnalysis.ts
 *
 * Property 6: Analysis routing by node count
 * Property 7: Analysis result shape invariant
 *
 * Validates: Requirements 9.1, 9.2, 9.3, 9.4
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as fc from 'fast-check';
import type { AnalysisModel } from '../../api/rustApi';

// Mock rustApi before importing routeAnalysis
vi.mock('../../api/rustApi', () => ({
  rustApi: {
    isAvailable: vi.fn(),
    smartAnalyze: vi.fn(),
    analyzeStatic: vi.fn(),
  },
}));

// Mock toast
vi.mock('../../components/ui/ToastSystem', () => ({
  toast: { info: vi.fn() },
}));

import { routeAnalysis } from '../useAnalysis';
import { rustApi } from '../../api/rustApi';

function buildModel(nodeCount: number): AnalysisModel {
  const nodes = Array.from({ length: nodeCount }, (_, i) => ({
    id: i,
    x: i * 1.0,
    y: 0,
    z: 0,
  }));
  return {
    nodes,
    members: [],
    supports: [],
    loads: [],
  };
}

const mockWasmResult = {
  displacements: {},
  reactions: {},
  member_forces: {},
  backend: 'wasm',
  computeTimeMs: 10,
};

const mockRustResult = {
  displacements: {},
  reactions: {},
  member_forces: {},
  backend: 'rust',
  computeTimeMs: 50,
};

describe('Property 6: Analysis routing by node count', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('models < 500 nodes with static type route to WASM when wasmRunner is available', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 1, max: 499 }),
        async (nodeCount) => {
          const model = buildModel(nodeCount);
          const mockWasmRunner = vi.fn().mockResolvedValue(mockWasmResult);

          const result = await routeAnalysis(model, 'static', mockWasmRunner);
          return result.backend === 'wasm';
        },
      ),
      { numRuns: 100 },
    );
  });

  it('models >= 500 nodes route to Rust when available', async () => {
    vi.mocked(rustApi.isAvailable).mockResolvedValue(true);
    vi.mocked(rustApi.smartAnalyze).mockResolvedValue({ result: mockRustResult, backend: 'rust', timeMs: 50 });

    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 500, max: 5000 }),
        async (nodeCount) => {
          const model = buildModel(nodeCount);
          const result = await routeAnalysis(model, 'static');
          return result.backend === 'rust';
        },
      ),
      { numRuns: 100 },
    );
  });

  it('models < 500 nodes without wasmRunner route to Rust when available', async () => {
    vi.mocked(rustApi.isAvailable).mockResolvedValue(true);
    vi.mocked(rustApi.smartAnalyze).mockResolvedValue({ result: mockRustResult, backend: 'rust', timeMs: 50 });

    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 1, max: 499 }),
        async (nodeCount) => {
          const model = buildModel(nodeCount);
          // No wasmRunner provided
          const result = await routeAnalysis(model, 'static');
          return result.backend === 'rust';
        },
      ),
      { numRuns: 100 },
    );
  });
});

describe('Property 7: Analysis result shape invariant', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('result always contains displacements, reactions, memberForces, backend, computeTimeMs', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({ nodeCount: fc.integer({ min: 1, max: 499 }) }),
        async ({ nodeCount }) => {
          const model = buildModel(nodeCount);
          const mockWasmRunner = vi.fn().mockResolvedValue(mockWasmResult);

          const result = await routeAnalysis(model, 'static', mockWasmRunner);

          return (
            result.displacements !== undefined &&
            result.reactions !== undefined &&
            result.memberForces !== undefined &&
            typeof result.backend === 'string' &&
            typeof result.computeTimeMs === 'number'
          );
        },
      ),
      { numRuns: 100 },
    );
  });
});
