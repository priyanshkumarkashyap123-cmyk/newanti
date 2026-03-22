/**
 * wasmSolver — thin adapter that delegates to the existing wasmSolverService
 * for in-browser WASM-based structural analysis.
 *
 * Used by useAnalysisRouter for small static models (nodeCount < 500).
 * Requirements: 7.1
 */

import { analyzeStructure } from '../services/wasmSolverService';
import type { AnalysisModel } from '../hooks/useAnalysisRouter';

export interface WasmAnalysisResult {
    displacements: unknown[];
    reactions: unknown[];
    memberForces: unknown[];
    backend: 'wasm';
    [key: string]: unknown;
}

/**
 * Run structural analysis using the in-browser WASM solver.
 * Throws on solver failure so the caller can fall through to a server backend.
 */
export async function runWasmAnalysis(model: AnalysisModel): Promise<WasmAnalysisResult> {
    const nodes = model.nodes.map((n, i) => ({
        id: n.id,
        x: n.x,
        y: n.y,
        z: n.z,
        dof: [true, true, true, true, true, true] as [boolean, boolean, boolean, boolean, boolean, boolean],
        index: i,
    }));

    const elements = model.members.map((m, i) => ({
        id: m.id,
        startNodeId: m.startNodeId,
        endNodeId: m.endNodeId,
        index: i,
        E: 200000,   // kN/m² default (steel)
        A: 0.01,     // m²
        Iz: 0.0001,  // m⁴
        Iy: 0.0001,
        J: 0.0002,
        G: 80000,
        density: 7850,
    }));

    const result = await analyzeStructure(nodes, elements, (model.loads as any[]) ?? [], []);

    return {
        displacements: result.displacements ? Object.values(result.displacements) : [],
        reactions: result.reactions ? Object.values(result.reactions) : [],
        memberForces: result.member_forces ? Object.values(result.member_forces) : [],
        backend: 'wasm',
    };
}
