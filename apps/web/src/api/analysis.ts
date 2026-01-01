/**
 * API client for structural analysis
 */

import { useModelStore, type Node, type Member, type NodeLoad, type AnalysisResults } from '../store/model';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001';

export async function runAnalysis(): Promise<{ success: boolean; message: string }> {
    const state = useModelStore.getState();

    // Convert Maps to arrays for API
    const nodes: Node[] = Array.from(state.nodes.values());
    const members: Member[] = Array.from(state.members.values());
    const loads: NodeLoad[] = state.loads;
    const memberLoads = state.memberLoads; // UDL, UVL, point loads on members

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

    // Check for any loads (nodal OR member loads like UDL/UVL)
    const hasLoads = loads.length > 0 || memberLoads.length > 0;
    if (!hasLoads) {
        return { success: false, message: 'Structure needs at least one load (nodal or distributed)' };
    }

    state.setIsAnalyzing(true);

    try {
        const response = await fetch(`${API_BASE}/api/analyze`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ nodes, members, loads, memberLoads })
        });

        const result = await response.json();

        if (result.success) {
            // Convert results back to Maps
            const analysisResults: AnalysisResults = {
                displacements: new Map(Object.entries(result.displacements)),
                reactions: new Map(Object.entries(result.reactions)),
                memberForces: new Map(Object.entries(result.memberForces))
            };
            state.setAnalysisResults(analysisResults);
            return { success: true, message: result.message };
        } else {
            state.setAnalysisResults(null);
            return { success: false, message: result.message };
        }
    } catch (error) {
        state.setAnalysisResults(null);
        const message = error instanceof Error ? error.message : 'Network error';
        return { success: false, message };
    } finally {
        state.setIsAnalyzing(false);
    }
}
