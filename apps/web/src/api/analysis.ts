/**
 * API client for structural analysis
 * Uses WASM solver - NO backend calls
 */

import { useModelStore, type Node, type Member, type NodeLoad, type AnalysisResults } from '../store/model';

export async function runAnalysis(): Promise<{ success: boolean; message: string }> {
    const state = useModelStore.getState();

    // Convert Maps to arrays for analysis
    const nodes: Node[] = Array.from(state.nodes.values());
    const members: Member[] = Array.from(state.members.values());
    const loads: NodeLoad[] = state.loads;
    const memberLoads = state.memberLoads;

    // Validate
    if (nodes.length < 2) {
        return { success: false, message: 'Need at least 2 nodes' };
    }
    if (members.length < 1) {
        return { success: false, message: 'Need at least 1 member' };
    }

    // Check for supports
    const hasSupports = nodes.some(n => n.restraints && (n.restraints.fx || n.restraints.fy || n.restraints.mz));
    if (!hasSupports) {
        return { success: false, message: 'Structure needs at least one support (restrained node)' };
    }

    // Check for any loads
    const hasLoads = loads.length > 0 || memberLoads.length > 0;
    if (!hasLoads) {
        return { success: false, message: 'Structure needs at least one load (nodal or distributed)' };
    }

    state.setIsAnalyzing(true);

    try {
        // Use WASM solver (client-side - no network calls!)
        const { analyzeStructure, initSolver } = await import('../services/wasmSolverService');
        await initSolver();

        // Convert to WASM format
        const wasmNodes = nodes.map(n => ({
            id: parseInt(n.id) || 0,
            x: n.x,
            y: n.y,
            fixed: [
                n.restraints?.fx || false,
                n.restraints?.fy || false,
                n.restraints?.fz || false
            ] as [boolean, boolean, boolean]
        }));

        const wasmElements = members.map(m => ({
            id: parseInt(m.id) || 0,
            node_start: parseInt(m.startNodeId) || 0,
            node_end: parseInt(m.endNodeId) || 0,
            e: m.E || 200e9,
            i: m.I || 8.33e-6,
            a: m.A || 0.01
        }));

        const result = await analyzeStructure(wasmNodes, wasmElements);

        if (result.success) {
            // Convert results to Maps
            const analysisResults: AnalysisResults = {
                displacements: new Map(
                    Object.entries(result.displacements).map(([id, disp]) => [id, disp as number[]])
                ),
                reactions: new Map(
                    Object.entries(result.reactions || {}).map(([id, r]) => [id, r as number[]])
                ),
                memberForces: new Map(
                    Object.entries(result.memberForces || {}).map(([id, f]) => [id, f])
                )
            };
            state.setAnalysisResults(analysisResults);
            return { success: true, message: 'Analysis completed (WASM solver)' };
        } else {
            state.setAnalysisResults(null);
            return { success: false, message: result.error || 'Analysis failed' };
        }
    } catch (error) {
        state.setAnalysisResults(null);
        const message = error instanceof Error ? error.message : 'WASM solver error';
        return { success: false, message };
    } finally {
        state.setIsAnalyzing(false);
    }
}
