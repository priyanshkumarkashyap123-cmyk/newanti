/**
 * API client for structural analysis
 * Uses WASM solver - NO backend calls
 */

import { useModelStore, type Node, type Member, type NodeLoad, type AnalysisResults, type MemberForceData } from '../store/model';

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
            // Convert results to Maps with proper typing
            const displacementsMap = new Map<string, { dx: number; dy: number; dz: number; rx: number; ry: number; rz: number }>();
            Object.entries(result.displacements || {}).forEach(([id, disp]) => {
                // Handle both array and object formats
                const d = disp as any;
                if (Array.isArray(d)) {
                    displacementsMap.set(id, {
                        dx: d[0] ?? 0, dy: d[1] ?? 0, dz: d[2] ?? 0,
                        rx: d[3] ?? 0, ry: d[4] ?? 0, rz: d[5] ?? 0
                    });
                } else {
                    displacementsMap.set(id, {
                        dx: d.dx ?? 0, dy: d.dy ?? 0, dz: d.dz ?? 0,
                        rx: d.rx ?? 0, ry: d.ry ?? 0, rz: d.rz ?? 0
                    });
                }
            });

            const reactionsMap = new Map<string, { fx: number; fy: number; fz: number; mx: number; my: number; mz: number }>();
            Object.entries(result.reactions || {}).forEach(([id, r]) => {
                const reaction = r as any;
                if (Array.isArray(reaction)) {
                    reactionsMap.set(id, {
                        fx: reaction[0] ?? 0, fy: reaction[1] ?? 0, fz: reaction[2] ?? 0,
                        mx: reaction[3] ?? 0, my: reaction[4] ?? 0, mz: reaction[5] ?? 0
                    });
                } else {
                    reactionsMap.set(id, {
                        fx: reaction?.fx ?? 0, fy: reaction?.fy ?? 0, fz: reaction?.fz ?? 0,
                        mx: reaction?.mx ?? 0, my: reaction?.my ?? 0, mz: reaction?.mz ?? 0
                    });
                }
            });

            const memberForcesMap = new Map<string, MemberForceData>();
            // Handle both member_forces and memberForces
            const memberForcesData = result.member_forces || (result as any).memberForces || {};
            Object.entries(memberForcesData).forEach(([id, f]) => {
                const forces = f as any;
                memberForcesMap.set(id, {
                    axial: forces?.axial ?? 0,
                    shearY: forces?.shearY ?? 0,
                    shearZ: forces?.shearZ ?? 0,
                    momentY: forces?.momentY ?? 0,
                    momentZ: forces?.momentZ ?? 0,
                    torsion: forces?.torsion ?? 0,
                    diagramData: forces?.diagramData
                });
            });

            const analysisResults: AnalysisResults = {
                displacements: displacementsMap,
                reactions: reactionsMap,
                memberForces: memberForcesMap
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
