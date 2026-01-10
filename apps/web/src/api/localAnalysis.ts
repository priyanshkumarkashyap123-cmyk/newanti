/**
 * Local structural analysis using the Rust WASM Solver
 * No backend required - runs entirely in the browser using WebAssembly
 */

import { useModelStore, type AnalysisResults } from '../store/model';
import { SparseMatrixAssembler } from '../utils/SparseMatrixAssembler';

// Import WASM functions
// Note: These might need to be dynamically imported if not using a bundler plugin
import init, { solve_sparse_system_json, init as initWasm } from 'solver-wasm';

export async function runLocalAnalysis(): Promise<{ success: boolean; message: string }> {
    const state = useModelStore.getState();

    // basic validation
    if (state.nodes.size < 2) return { success: false, message: 'Need at least 2 nodes' };
    if (state.members.size < 1) return { success: false, message: 'Need at least 1 member' };

    const hasSupports = Array.from(state.nodes.values()).some(n =>
        n.restraints && (n.restraints.fx || n.restraints.fy || n.restraints.fz || n.restraints.mx || n.restraints.my || n.restraints.mz)
    );
    if (!hasSupports) return { success: false, message: 'Structure needs at least one support' };

    state.setIsAnalyzing(true);

    try {
        // 1. Initialize WASM (if needed)
        try {
            await init();
            // Call init hook to set panic handler
            initWasm();
        } catch (e) {
            console.warn('WASM init failed or already initialized:', e);
        }

        // 2. Assemble Sparse Matrix (in JS for now, could be moved to WASM later)
        const startTime = performance.now();
        
        // Convert Maps to arrays for the assembler
        const nodesArray = Array.from(state.nodes.values());
        const membersArray = Array.from(state.members.values());
        
        // Convert node loads to the format expected by assembler
        // state.loads is an array of NodeLoad
        const loadsArray = state.loads.map((load: { nodeId: string; fx?: number; fy?: number; fz?: number; mx?: number; my?: number; mz?: number }) => ({
            nodeId: load.nodeId,
            fx: load.fx,
            fy: load.fy,
            fz: load.fz,
            mx: load.mx,
            my: load.my,
            mz: load.mz
        }));
        
        const assemblerInput = {
            nodes: nodesArray,
            members: membersArray,
            loads: loadsArray
        };
        
        const { entries, forces, dof, nodeMapping } = SparseMatrixAssembler.assemble(assemblerInput);
        const assemblyTime = performance.now() - startTime;
        console.log(`Matrix assembled in ${assemblyTime.toFixed(2)}ms. DOF: ${dof}, Non-zeros: ${entries.length}`);

        // 3. Prepare Input for Solver
        const input = {
            entries,
            forces,
            size: dof
        };

        // 4. Run WASM Solver
        // Serialize input to JSON string (overhead is small compared to dense matrix transfer)
        const inputJson = JSON.stringify(input);

        const solverStartTime = performance.now();
        const resultJson = solve_sparse_system_json(inputJson);
        const solverTotalTime = performance.now() - solverStartTime;

        const result = JSON.parse(resultJson);

        if (!result.success) {
            throw new Error(result.error || 'Unknown solver error');
        }

        console.log(`Solver finished in ${result.solve_time_ms.toFixed(2)}ms (wasm time) / ${solverTotalTime.toFixed(2)}ms (total)`);

        // 5. Map Results back to Model
        // Result.displacements is a flat array [dof]
        // We need to map back to nodes and calculate member forces

        const displacementsMap = new Map();

        // Map node displacements
        state.nodes.forEach(node => {
            const startIdx = nodeMapping.get(node.id);
            if (startIdx !== undefined) {
                displacementsMap.set(node.id, {
                    dx: result.displacements[startIdx + 0],
                    dy: result.displacements[startIdx + 1],
                    dz: result.displacements[startIdx + 2],
                    rx: result.displacements[startIdx + 3] || 0,
                    ry: result.displacements[startIdx + 4] || 0,
                    rz: result.displacements[startIdx + 5] || 0
                });
            }
        });

        // Calculate reactions and member forces
        // For now, we'll placeholder/calculate member forces in JS
        // Ideally this should also be done in WASM if performance critical
        // But for visualization, doing it here is okay for 50k elements as long as we don't block too long
        // (This should move to Web Worker next)

        const analysisResults: AnalysisResults = {
            displacements: displacementsMap,
            reactions: new Map(), // TODO: Calculate reactions
            memberForces: new Map() // TODO: Calculate member forces
        };

        state.setAnalysisResults(analysisResults);
        return { success: true, message: `Analysis complete in ${(assemblyTime + solverTotalTime).toFixed(0)}ms` };

    } catch (error) {
        state.setAnalysisResults(null);
        console.error('Analysis failed:', error);
        return { success: false, message: error instanceof Error ? error.message : 'Analysis failed' };
    } finally {
        state.setIsAnalyzing(false);
    }
}
