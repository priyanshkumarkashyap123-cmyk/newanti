/**
 * Local structural analysis using the Solver class
 * No backend required - runs entirely in the browser
 */

import { useModelStore, type AnalysisResults } from '../store/model';
import { Solver, type SolverNode, type SolverMember, type SolverLoad } from '../utils/Solver';

// Default material properties for steel (if not specified on member)
const DEFAULT_E = 210000000; // kN/m² (210 GPa)
const DEFAULT_A = 0.01;      // m² (100 cm²)
const DEFAULT_Iy = 0.0001;   // m⁴
const DEFAULT_Iz = 0.0001;   // m⁴

export function runLocalAnalysis(): { success: boolean; message: string } {
    const state = useModelStore.getState();

    // Convert store data to solver format
    const nodes = Array.from(state.nodes.values());
    const members = Array.from(state.members.values());
    const loads = state.loads;
    const memberLoads = state.memberLoads; // UDL, UVL, point loads on members

    // Validation
    if (nodes.length < 2) {
        return { success: false, message: 'Need at least 2 nodes' };
    }
    if (members.length < 1) {
        return { success: false, message: 'Need at least 1 member' };
    }

    const hasSupports = nodes.some(n => n.restraints && (n.restraints.fx || n.restraints.fy || n.restraints.mz));
    if (!hasSupports) {
        return { success: false, message: 'Structure needs at least one support' };
    }

    // Check for any loads (nodal OR member loads like UDL/UVL)
    const hasLoads = loads.length > 0 || memberLoads.length > 0;
    if (!hasLoads) {
        return { success: false, message: 'Structure needs at least one load (nodal or distributed)' };
    }

    state.setIsAnalyzing(true);

    try {
        // Convert to solver format
        const solverNodes = new Map<string, SolverNode>();
        for (const node of nodes) {
            const solverNode: SolverNode = {
                id: node.id,
                x: node.x,
                y: node.y,
                z: node.z
            };
            if (node.restraints) {
                solverNode.restraints = {
                    fx: node.restraints.fx,
                    fy: node.restraints.fy,
                    fz: node.restraints.fz ?? false,
                    mx: node.restraints.mx ?? false,
                    my: node.restraints.my ?? false,
                    mz: node.restraints.mz
                };
            }
            solverNodes.set(node.id, solverNode);
        }

        const solverMembers = new Map<string, SolverMember>();
        for (const member of members) {
            solverMembers.set(member.id, {
                id: member.id,
                startNodeId: member.startNodeId,
                endNodeId: member.endNodeId,
                E: member.E ?? DEFAULT_E,
                A: member.A ?? DEFAULT_A,
                Iy: member.I ?? DEFAULT_Iy,
                Iz: member.I ?? DEFAULT_Iz
            });
        }

        const solverLoads: SolverLoad[] = loads.map(load => ({
            nodeId: load.nodeId,
            fx: load.fx ?? 0,
            fy: load.fy ?? 0,
            fz: load.fz ?? 0,
            mx: load.mx ?? 0,
            my: load.my ?? 0,
            mz: load.mz ?? 0
        }));

        // Create and run solver
        const solver = new Solver(solverNodes, solverMembers, solverLoads);
        const result = solver.solveWithCondensation();

        // Convert results to store format
        const analysisResults: AnalysisResults = {
            displacements: result.displacements,
            reactions: result.reactions,
            memberForces: new Map(
                Array.from(result.memberForces.entries()).map(([id, forces]) => [
                    id,
                    {
                        axial: forces.axialStart,
                        shearY: forces.shearYStart,
                        shearZ: forces.shearZStart,
                        momentY: forces.momentYStart,
                        momentZ: forces.momentZStart,
                        torsion: forces.torsionStart
                    }
                ])
            )
        };

        state.setAnalysisResults(analysisResults);
        return { success: true, message: 'Analysis complete ✓' };

    } catch (error) {
        state.setAnalysisResults(null);
        const message = error instanceof Error ? error.message : 'Analysis failed';
        return { success: false, message };
    } finally {
        state.setIsAnalyzing(false);
    }
}
