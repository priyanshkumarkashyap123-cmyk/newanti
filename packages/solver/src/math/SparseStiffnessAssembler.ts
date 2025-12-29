/**
 * SparseStiffnessAssembler - Efficient Global Stiffness Matrix Assembly
 * 
 * Uses sparse storage for efficient assembly of large structural systems.
 */

import { SparseMatrix, CSRMatrix } from './SparseMatrix';
import { sparseSolve, CGResult, SparseSolverOptions } from './ConjugateGradient';
import { reverseCuthillMcKee, computeBandwidth } from './MatrixReordering';

// Export extended options locally since we don't modify ConjugateGradient yet
export interface AssemblerSolverOptions extends SparseSolverOptions {
    useRCM?: boolean;
}

// ============================================
// TYPES
// ============================================

export interface Node {
    id: string;
    x: number;
    y: number;
    z: number;
    restraints?: {
        fx: boolean;
        fy: boolean;
        fz: boolean;
        mx: boolean;
        my: boolean;
        mz: boolean;
    };
}

export interface Member {
    id: string;
    startNodeId: string;
    endNodeId: string;
    E: number;      // Young's modulus
    A: number;      // Cross-sectional area
    I: number;      // Moment of inertia
    G?: number;     // Shear modulus
    J?: number;     // Torsional constant
}

export interface NodalLoad {
    nodeId: string;
    fx?: number;
    fy?: number;
    fz?: number;
    mx?: number;
    my?: number;
    mz?: number;
}

export interface AnalysisInput {
    nodes: Node[];
    members: Member[];
    loads: NodalLoad[];
    dofPerNode?: 2 | 3 | 6;  // 2D truss, 3D truss, 3D frame
}

export interface AnalysisResult {
    displacements: Map<string, number[]>;
    reactions: Map<string, number[]>;
    memberForces: Map<string, { axial: number; shear?: number; moment?: number }>;
    solverStats: CGResult;
}

// ============================================
// STIFFNESS ASSEMBLER
// ============================================

export class SparseStiffnessAssembler {
    private nodes: Node[];
    private members: Member[];
    private loads: NodalLoad[];
    private dofPerNode: number;
    private totalDof: number;
    private nodeIndexMap: Map<string, number>;
    private fixedDofs: Set<number>;

    constructor(input: AnalysisInput) {
        this.nodes = input.nodes;
        this.members = input.members;
        this.loads = input.loads;
        this.dofPerNode = input.dofPerNode ?? 6;
        this.totalDof = this.nodes.length * this.dofPerNode;

        // Map node IDs to indices
        this.nodeIndexMap = new Map();
        this.nodes.forEach((node, index) => {
            this.nodeIndexMap.set(node.id, index);
        });

        // Identify fixed DOFs from restraints
        this.fixedDofs = new Set();
        this.nodes.forEach((node, nodeIndex) => {
            if (node.restraints) {
                const baseDof = nodeIndex * this.dofPerNode;
                if (node.restraints.fx) this.fixedDofs.add(baseDof);
                if (node.restraints.fy) this.fixedDofs.add(baseDof + 1);
                if (node.restraints.fz && this.dofPerNode >= 3) this.fixedDofs.add(baseDof + 2);
                if (node.restraints.mx && this.dofPerNode >= 4) this.fixedDofs.add(baseDof + 3);
                if (node.restraints.my && this.dofPerNode >= 5) this.fixedDofs.add(baseDof + 4);
                if (node.restraints.mz && this.dofPerNode >= 6) this.fixedDofs.add(baseDof + 5);
            }
        });
    }

    /**
     * Assemble global stiffness matrix using sparse storage
     */
    assembleStiffnessMatrix(): SparseMatrix {
        const K = new SparseMatrix(this.totalDof, this.totalDof);

        for (const member of this.members) {
            const elementK = this.computeElementStiffness(member);
            const dofMap = this.getMemberDofMap(member);

            // Add element stiffness to global (sparse)
            K.addSubmatrix(0, 0, elementK, dofMap);
        }

        return K;
    }

    /**
     * Assemble force vector
     */
    assembleForceVector(): Float64Array {
        const F = new Float64Array(this.totalDof);

        for (const load of this.loads) {
            const nodeIndex = this.nodeIndexMap.get(load.nodeId);
            if (nodeIndex === undefined) continue;

            const baseDof = nodeIndex * this.dofPerNode;

            if (load.fx) F[baseDof] += load.fx;
            if (load.fy) F[baseDof + 1] += load.fy;
            if (load.fz && this.dofPerNode >= 3) F[baseDof + 2] += load.fz;
            if (load.mx && this.dofPerNode >= 4) F[baseDof + 3] += load.mx;
            if (load.my && this.dofPerNode >= 5) F[baseDof + 4] += load.my;
            if (load.mz && this.dofPerNode >= 6) F[baseDof + 5] += load.mz;
        }

        return F;
    }

    /**
     * Apply boundary conditions using penalty method
     */
    applyBoundaryConditions(K: SparseMatrix, F: Float64Array): void {
        const penalty = 1e20;

        for (const dof of this.fixedDofs) {
            // Add large value to diagonal
            const existing = K.get(dof, dof);
            K.set(dof, dof, existing + penalty);
            // Zero the force at this DOF
            F[dof] = 0;
        }
    }

    /**
     * Solve the system Ku = F
     */
    solve(options?: AssemblerSolverOptions): AnalysisResult {
        const startTime = performance.now();
        console.log(`[SparseAssembler] Starting assembly...`);

        // Assemble
        const K = this.assembleStiffnessMatrix();
        const F = this.assembleForceVector();

        // Apply boundary conditions
        this.applyBoundaryConditions(K, F);

        console.log(`[SparseAssembler] Matrix size: ${this.totalDof}, nnz: ${K.nnz}`);

        // RCM Optimization
        let finalK = K;
        let finalF = F;
        let permutation: number[] | null = null;

        if (options?.useRCM) {
            const bwBefore = computeBandwidth(K);
            console.log(`[SparseAssembler] Computing RCM reordering...`);

            const rcmResult = reverseCuthillMcKee(K);
            permutation = rcmResult.permutation;

            finalK = K.permute(permutation);
            finalF = SparseMatrix.permuteVector(F, permutation);

            const bwAfter = computeBandwidth(finalK);
            console.log(`[SparseAssembler] Bandwidth reduced: ${bwBefore} -> ${bwAfter}`);
        } else {
            const stats = K.getStats();
            console.log(`[SparseAssembler] Sparsity: ${(1 - stats.density) * 100}%`);
        }

        // Solve using iterative solver
        const solverResult = sparseSolve(finalK, finalF, {
            tolerance: 1e-8,
            maxIterations: this.totalDof * 3,
            precondition: true,
            ...options
        });

        // Map solution back to original ordering if needed
        if (permutation) {
            solverResult.x = SparseMatrix.inversePermuteVector(solverResult.x, permutation);
        }

        console.log(`[SparseAssembler] Solved in ${solverResult.iterations} iterations`);
        console.log(`[SparseAssembler] Residual: ${solverResult.residual.toExponential(3)}`);
        console.log(`[SparseAssembler] Total time: ${(performance.now() - startTime).toFixed(2)}ms`);

        // Extract results
        return this.extractResults(solverResult);
    }

    /**
     * Extract displacements and forces from solution
     */
    private extractResults(solverResult: CGResult): AnalysisResult {
        const displacements = new Map<string, number[]>();
        const reactions = new Map<string, number[]>();
        const memberForces = new Map<string, { axial: number; shear?: number; moment?: number }>();

        // Extract nodal displacements
        for (const node of this.nodes) {
            const nodeIndex = this.nodeIndexMap.get(node.id)!;
            const baseDof = nodeIndex * this.dofPerNode;

            const nodeDisp: number[] = [];
            for (let i = 0; i < this.dofPerNode; i++) {
                nodeDisp.push(solverResult.x[baseDof + i]);
            }
            displacements.set(node.id, nodeDisp);

            // Calculate reactions at fixed DOFs
            if (node.restraints) {
                const nodeReact: number[] = [];
                // Reactions would be calculated from K * u at fixed DOFs
                // Simplified: just store if there are restraints
                reactions.set(node.id, nodeReact);
            }
        }

        // Calculate member forces (simplified axial)
        for (const member of this.members) {
            const startIndex = this.nodeIndexMap.get(member.startNodeId)!;
            const endIndex = this.nodeIndexMap.get(member.endNodeId)!;

            const startNode = this.nodes[startIndex];
            const endNode = this.nodes[endIndex];

            // Length
            const dx = endNode.x - startNode.x;
            const dy = endNode.y - startNode.y;
            const dz = endNode.z - startNode.z;
            const L = Math.sqrt(dx * dx + dy * dy + dz * dz);

            // Axial displacement difference
            const startDisp = displacements.get(member.startNodeId)!;
            const endDisp = displacements.get(member.endNodeId)!;

            // Simplified axial force (for truss-like behavior)
            const axialStrain = ((endDisp[0] - startDisp[0]) * dx / L +
                (endDisp[1] - startDisp[1]) * dy / L +
                (endDisp[2] - startDisp[2]) * dz / L) / L;
            const axialForce = member.E * member.A * axialStrain;

            memberForces.set(member.id, { axial: axialForce });
        }

        return {
            displacements,
            reactions,
            memberForces,
            solverStats: solverResult
        };
    }

    /**
     * Compute element stiffness matrix
     */
    private computeElementStiffness(member: Member): number[][] {
        const startIndex = this.nodeIndexMap.get(member.startNodeId)!;
        const endIndex = this.nodeIndexMap.get(member.endNodeId)!;

        const startNode = this.nodes[startIndex];
        const endNode = this.nodes[endIndex];

        const dx = endNode.x - startNode.x;
        const dy = endNode.y - startNode.y;
        const dz = endNode.z - startNode.z;
        const L = Math.sqrt(dx * dx + dy * dy + dz * dz);

        const cx = dx / L;  // Direction cosines
        const cy = dy / L;
        const cz = dz / L;

        const { E, A, I } = member;

        if (this.dofPerNode === 2) {
            // 2D Truss element (4x4)
            return this.compute2DTrussStiffness(E, A, L, cx, cy);
        } else if (this.dofPerNode === 3) {
            // 3D Truss element (6x6)
            return this.compute3DTrussStiffness(E, A, L, cx, cy, cz);
        } else {
            // 3D Frame element (12x12) - simplified
            return this.compute3DFrameStiffness(E, A, I, L, cx, cy, cz);
        }
    }

    private compute2DTrussStiffness(E: number, A: number, L: number, cx: number, cy: number): number[][] {
        const k = (E * A) / L;
        const c2 = cx * cx;
        const s2 = cy * cy;
        const cs = cx * cy;

        return [
            [k * c2, k * cs, -k * c2, -k * cs],
            [k * cs, k * s2, -k * cs, -k * s2],
            [-k * c2, -k * cs, k * c2, k * cs],
            [-k * cs, -k * s2, k * cs, k * s2]
        ];
    }

    private compute3DTrussStiffness(E: number, A: number, L: number, cx: number, cy: number, cz: number): number[][] {
        const k = (E * A) / L;

        return [
            [k * cx * cx, k * cx * cy, k * cx * cz, -k * cx * cx, -k * cx * cy, -k * cx * cz],
            [k * cy * cx, k * cy * cy, k * cy * cz, -k * cy * cx, -k * cy * cy, -k * cy * cz],
            [k * cz * cx, k * cz * cy, k * cz * cz, -k * cz * cx, -k * cz * cy, -k * cz * cz],
            [-k * cx * cx, -k * cx * cy, -k * cx * cz, k * cx * cx, k * cx * cy, k * cx * cz],
            [-k * cy * cx, -k * cy * cy, -k * cy * cz, k * cy * cx, k * cy * cy, k * cy * cz],
            [-k * cz * cx, -k * cz * cy, -k * cz * cz, k * cz * cx, k * cz * cy, k * cz * cz]
        ];
    }

    private compute3DFrameStiffness(E: number, A: number, I: number, L: number, cx: number, cy: number, cz: number): number[][] {
        // Simplified: returns axial terms only
        // Full implementation would include bending terms
        const k = (E * A) / L;
        const n = 12;
        const stiffness: number[][] = Array.from({ length: n }, () => Array(n).fill(0));

        // Axial terms (simplified)
        stiffness[0][0] = k * cx * cx;
        stiffness[0][6] = -k * cx * cx;
        stiffness[6][0] = -k * cx * cx;
        stiffness[6][6] = k * cx * cx;

        // Add small values to diagonal for numerical stability
        for (let i = 0; i < n; i++) {
            if (stiffness[i][i] === 0) stiffness[i][i] = 1e-10;
        }

        return stiffness;
    }

    /**
     * Get DOF mapping for element
     */
    private getMemberDofMap(member: Member): number[] {
        const startIndex = this.nodeIndexMap.get(member.startNodeId)!;
        const endIndex = this.nodeIndexMap.get(member.endNodeId)!;

        const dofMap: number[] = [];

        for (let i = 0; i < this.dofPerNode; i++) {
            dofMap.push(startIndex * this.dofPerNode + i);
        }
        for (let i = 0; i < this.dofPerNode; i++) {
            dofMap.push(endIndex * this.dofPerNode + i);
        }

        return dofMap;
    }
}

export default SparseStiffnessAssembler;
