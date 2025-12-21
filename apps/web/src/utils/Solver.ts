import * as math from 'mathjs';
import { MatrixUtils } from './MatrixUtils';

// ============================================
// STRUCTURAL SOLVER CLASS
// ============================================
// Assembles and solves the global stiffness matrix for 3D frame analysis

export interface SolverNode {
    id: string;
    x: number;
    y: number;
    z: number;
    restraints?: {
        fx: boolean; fy: boolean; fz: boolean;
        mx: boolean; my: boolean; mz: boolean;
    };
}

export interface SolverMember {
    id: string;
    startNodeId: string;
    endNodeId: string;
    E: number;      // Young's Modulus (kN/m²)
    A: number;      // Cross-sectional Area (m²)
    Iy: number;     // Moment of inertia about y-axis (m⁴)
    Iz: number;     // Moment of inertia about z-axis (m⁴)
    G?: number;     // Shear Modulus (optional)
    J?: number;     // Torsional constant (optional)
    beta?: number;  // Roll angle (optional, radians)
}

export interface SolverLoad {
    nodeId: string;
    fx?: number;
    fy?: number;
    fz?: number;
    mx?: number;
    my?: number;
    mz?: number;
}

export interface SolverResult {
    displacements: Map<string, { dx: number; dy: number; dz: number; rx: number; ry: number; rz: number }>;
    reactions: Map<string, { fx: number; fy: number; fz: number; mx: number; my: number; mz: number }>;
    memberForces: Map<string, {
        axialStart: number; axialEnd: number;
        shearYStart: number; shearYEnd: number;
        shearZStart: number; shearZEnd: number;
        momentYStart: number; momentYEnd: number;
        momentZStart: number; momentZEnd: number;
        torsionStart: number; torsionEnd: number;
    }>;
}

export class Solver {
    private nodes: Map<string, SolverNode>;
    private members: Map<string, SolverMember>;
    private loads: SolverLoad[];

    // DOF mapping: nodeId -> starting global DOF index
    private nodeDOFMap: Map<string, number>;
    private nodeIdList: string[];
    private totalDOFs: number;

    // Global matrices
    private globalK: math.Matrix | null = null;
    private forceVector: math.Matrix | null = null;

    constructor(
        nodes: Map<string, SolverNode>,
        members: Map<string, SolverMember>,
        loads: SolverLoad[]
    ) {
        this.nodes = nodes;
        this.members = members;
        this.loads = loads;
        this.nodeDOFMap = new Map();
        this.nodeIdList = [];
        this.totalDOFs = 0;

        // Build DOF mapping
        this.buildDOFMapping();
    }

    /**
     * Build mapping from node IDs to global DOF indices
     * Each node has 6 DOFs: [dx, dy, dz, rx, ry, rz]
     */
    private buildDOFMapping(): void {
        let dofIndex = 0;
        this.nodeIdList = Array.from(this.nodes.keys());

        for (let i = 0; i < this.nodeIdList.length; i++) {
            const nodeId = this.nodeIdList[i]!;
            this.nodeDOFMap.set(nodeId, dofIndex);
            dofIndex += 6;
        }
        this.totalDOFs = dofIndex;
    }

    /**
     * Get global DOF indices for a node
     */
    private getNodeDOFs(nodeId: string): number[] {
        const startDOF = this.nodeDOFMap.get(nodeId);
        if (startDOF === undefined) {
            throw new Error(`Node ${nodeId} not found in DOF mapping`);
        }
        return [startDOF, startDOF + 1, startDOF + 2, startDOF + 3, startDOF + 4, startDOF + 5];
    }

    /**
     * Assemble the global stiffness matrix
     */
    assemble(): math.Matrix {
        // 1. Initialize zero-filled GlobalK matrix (Nodes * 6 DOFs)
        this.globalK = MatrixUtils.zeros(this.totalDOFs, this.totalDOFs);

        // 2. Loop through all members
        const memberList = Array.from(this.members.values());

        for (let m = 0; m < memberList.length; m++) {
            const member = memberList[m];

            // Get member end nodes
            const nodeA = this.nodes.get(member.startNodeId);
            const nodeB = this.nodes.get(member.endNodeId);

            if (!nodeA || !nodeB) {
                console.warn(`Member ${member.id}: Missing node(s)`);
                continue;
            }

            // Get member length
            const L = MatrixUtils.getMemberLength(nodeA, nodeB);
            if (L < 1e-10) {
                console.warn(`Member ${member.id}: Zero length`);
                continue;
            }

            // 3. Calculate local stiffness matrix (12x12)
            const k_local = MatrixUtils.getLocalStiffnessMatrix(
                member.E,
                member.Iy,
                member.Iz,
                member.A,
                L,
                member.G,
                member.J
            );

            // 4. Calculate transformation matrix (12x12)
            const R = MatrixUtils.getRotationMatrix(nodeA, nodeB, member.beta ?? 0);
            const T = MatrixUtils.getTransformationMatrix(R);

            // 5. Transform to global: k_global = T^T * k_local * T
            const k_global = MatrixUtils.transformToGlobal(k_local, T);

            // 6. Get DOF indices for start and end nodes
            const startDOFs = this.getNodeDOFs(member.startNodeId);
            const endDOFs = this.getNodeDOFs(member.endNodeId);

            // 7. Assemble into global stiffness matrix
            MatrixUtils.assembleToGlobal(this.globalK, k_global, startDOFs, endDOFs);
        }

        return this.globalK;
    }

    /**
     * Assemble the global force vector from applied loads
     */
    assembleForces(): math.Matrix {
        this.forceVector = MatrixUtils.zeros(this.totalDOFs, 1);
        const fArray = this.forceVector.toArray() as number[][];

        for (let i = 0; i < this.loads.length; i++) {
            const load = this.loads[i];
            const dofs = this.getNodeDOFs(load.nodeId);

            if (load.fx !== undefined) fArray[dofs[0]][0] += load.fx;
            if (load.fy !== undefined) fArray[dofs[1]][0] += load.fy;
            if (load.fz !== undefined) fArray[dofs[2]][0] += load.fz;
            if (load.mx !== undefined) fArray[dofs[3]][0] += load.mx;
            if (load.my !== undefined) fArray[dofs[4]][0] += load.my;
            if (load.mz !== undefined) fArray[dofs[5]][0] += load.mz;
        }

        this.forceVector = math.matrix(fArray);
        return this.forceVector;
    }

    /**
     * Get list of constrained DOF indices from supports
     * @returns Object with free and constrained DOF arrays
     */
    private getConstrainedDOFs(): { freeDOFs: number[]; constrainedDOFs: number[] } {
        const constrainedDOFs: number[] = [];
        const freeDOFs: number[] = [];

        for (let i = 0; i < this.nodeIdList.length; i++) {
            const nodeId = this.nodeIdList[i];
            const node = this.nodes.get(nodeId);
            const dofs = this.getNodeDOFs(nodeId);

            if (node && node.restraints) {
                const r = node.restraints;
                // Check each DOF
                r.fx ? constrainedDOFs.push(dofs[0]) : freeDOFs.push(dofs[0]);
                r.fy ? constrainedDOFs.push(dofs[1]) : freeDOFs.push(dofs[1]);
                r.fz ? constrainedDOFs.push(dofs[2]) : freeDOFs.push(dofs[2]);
                r.mx ? constrainedDOFs.push(dofs[3]) : freeDOFs.push(dofs[3]);
                r.my ? constrainedDOFs.push(dofs[4]) : freeDOFs.push(dofs[4]);
                r.mz ? constrainedDOFs.push(dofs[5]) : freeDOFs.push(dofs[5]);
            } else {
                // All DOFs are free
                freeDOFs.push(...dofs);
            }
        }

        return { freeDOFs, constrainedDOFs };
    }

    /**
     * Extract submatrix from a matrix given row and column indices
     */
    private extractSubmatrix(M: math.Matrix, rows: number[], cols: number[]): math.Matrix {
        const subData: number[][] = [];
        const mArray = M.toArray() as number[][];

        for (let i = 0; i < rows.length; i++) {
            const row: number[] = [];
            for (let j = 0; j < cols.length; j++) {
                row.push(mArray[rows[i]][cols[j]]);
            }
            subData.push(row);
        }

        return math.matrix(subData);
    }

    /**
     * Extract subvector from a vector given indices
     */
    private extractSubvector(V: math.Matrix, indices: number[]): math.Matrix {
        const vArray = V.toArray() as number[][];
        const subData: number[][] = [];

        for (let i = 0; i < indices.length; i++) {
            subData.push([vArray[indices[i]][0]]);
        }

        return math.matrix(subData);
    }

    /**
     * Solve using Matrix Condensation (Partitioning Method)
     * 
     * This is the proper structural analysis approach:
     * 1. Partition [K] into free and constrained DOFs
     * 2. Solve reduced system for free DOFs
     * 3. Expand solution and calculate reactions
     * 
     * @param loads Optional loads to override constructor loads
     * @param supports Optional - uses node restraints from constructor
     * @returns SolverResult with displacements, reactions, member forces
     */
    solveWithCondensation(loads?: SolverLoad[], supports?: Map<string, SolverNode['restraints']>): SolverResult {
        // Use provided loads or fall back to constructor loads
        if (loads) {
            this.loads = loads;
        }

        // Apply supports if provided
        if (supports) {
            supports.forEach((restraints, nodeId) => {
                const node = this.nodes.get(nodeId);
                if (node && restraints) {
                    node.restraints = restraints;
                }
            });
        }

        // 1. Assemble global stiffness matrix if not done
        if (!this.globalK) this.assemble();

        // 2. Create Force Vector F
        this.assembleForces();

        // 3. Apply Boundary Conditions - Identify constrained DOFs
        const { freeDOFs, constrainedDOFs } = this.getConstrainedDOFs();

        if (freeDOFs.length === 0) {
            throw new Error('All DOFs are constrained - no solution possible');
        }

        // 4. Partition GlobalK and F (Matrix Condensation)
        // K_ff = stiffness for free DOFs
        // K_fc = coupling between free and constrained
        // K_cf = coupling between constrained and free  
        // K_cc = stiffness for constrained DOFs
        const K_ff = this.extractSubmatrix(this.globalK!, freeDOFs, freeDOFs);
        const F_f = this.extractSubvector(this.forceVector!, freeDOFs);

        // 5. Solve: u_free = inv(K_ff) * F_f
        const u_free = MatrixUtils.solve(K_ff, F_f);
        const uFreeArray = u_free.toArray() as number[][];

        // 6. Expand u_free back to full displacement vector
        const fullDisplacements = new Array(this.totalDOFs).fill(0);
        for (let i = 0; i < freeDOFs.length; i++) {
            fullDisplacements[freeDOFs[i]] = uFreeArray[i][0];
        }
        // Constrained DOFs remain 0 (prescribed displacement = 0)

        // 7. Calculate reactions: R = K * u - F
        const uFullMatrix = math.matrix(fullDisplacements.map(v => [v]));
        const internalForces = MatrixUtils.multiply(this.globalK!, uFullMatrix);
        const iFArray = internalForces.toArray() as number[][];
        const fArray = this.forceVector!.toArray() as number[][];

        // Build results
        const displacements = new Map<string, { dx: number; dy: number; dz: number; rx: number; ry: number; rz: number }>();
        const reactions = new Map<string, { fx: number; fy: number; fz: number; mx: number; my: number; mz: number }>();

        // 8. Return NodeID -> Displacement map
        for (let i = 0; i < this.nodeIdList.length; i++) {
            const nodeId = this.nodeIdList[i];
            const node = this.nodes.get(nodeId)!;
            const dofs = this.getNodeDOFs(nodeId);

            displacements.set(nodeId, {
                dx: fullDisplacements[dofs[0]],
                dy: fullDisplacements[dofs[1]],
                dz: fullDisplacements[dofs[2]],
                rx: fullDisplacements[dofs[3]],
                ry: fullDisplacements[dofs[4]],
                rz: fullDisplacements[dofs[5]]
            });

            // Calculate reactions for restrained DOFs
            if (node.restraints) {
                const r = node.restraints;
                reactions.set(nodeId, {
                    fx: r.fx ? iFArray[dofs[0]][0] - fArray[dofs[0]][0] : 0,
                    fy: r.fy ? iFArray[dofs[1]][0] - fArray[dofs[1]][0] : 0,
                    fz: r.fz ? iFArray[dofs[2]][0] - fArray[dofs[2]][0] : 0,
                    mx: r.mx ? iFArray[dofs[3]][0] - fArray[dofs[3]][0] : 0,
                    my: r.my ? iFArray[dofs[4]][0] - fArray[dofs[4]][0] : 0,
                    mz: r.mz ? iFArray[dofs[5]][0] - fArray[dofs[5]][0] : 0
                });
            }
        }

        // Calculate member forces
        const memberForces = this.calculateMemberForces(fullDisplacements);

        return { displacements, reactions, memberForces };
    }

    /**
     * Calculate member forces from displacements
     */
    private calculateMemberForces(fullDisplacements: number[]): Map<string, {
        axialStart: number; axialEnd: number;
        shearYStart: number; shearYEnd: number;
        shearZStart: number; shearZEnd: number;
        momentYStart: number; momentYEnd: number;
        momentZStart: number; momentZEnd: number;
        torsionStart: number; torsionEnd: number;
    }> {
        const memberForces = new Map<string, {
            axialStart: number; axialEnd: number;
            shearYStart: number; shearYEnd: number;
            shearZStart: number; shearZEnd: number;
            momentYStart: number; momentYEnd: number;
            momentZStart: number; momentZEnd: number;
            torsionStart: number; torsionEnd: number;
        }>();

        const memberList = Array.from(this.members.values());
        for (let m = 0; m < memberList.length; m++) {
            const member = memberList[m];
            const nodeA = this.nodes.get(member.startNodeId)!;
            const nodeB = this.nodes.get(member.endNodeId)!;

            const startDOFs = this.getNodeDOFs(member.startNodeId);
            const endDOFs = this.getNodeDOFs(member.endNodeId);

            // Get member displacements in global coordinates
            const dGlobal: number[] = [];
            const allDOFs = [...startDOFs, ...endDOFs];
            for (let d = 0; d < allDOFs.length; d++) {
                dGlobal.push(fullDisplacements[allDOFs[d]]);
            }

            // Transform to local coordinates
            const L = MatrixUtils.getMemberLength(nodeA, nodeB);
            const R = MatrixUtils.getRotationMatrix(nodeA, nodeB, member.beta ?? 0);
            const T = MatrixUtils.getTransformationMatrix(R);
            const TT = MatrixUtils.transpose(T);

            const dGlobalMatrix = math.matrix(dGlobal.map(v => [v]));
            const dLocalMatrix = MatrixUtils.multiply(TT, dGlobalMatrix);

            // Calculate local forces: f = k * d
            const k_local = MatrixUtils.getLocalStiffnessMatrix(
                member.E, member.Iy, member.Iz, member.A, L, member.G, member.J
            );
            const fLocalMatrix = MatrixUtils.multiply(k_local, dLocalMatrix);
            const fLocal = (fLocalMatrix.toArray() as number[][]).map(row => row[0]);

            memberForces.set(member.id, {
                axialStart: -fLocal[0],
                axialEnd: fLocal[6],
                shearYStart: -fLocal[1],
                shearYEnd: fLocal[7],
                shearZStart: -fLocal[2],
                shearZEnd: fLocal[8],
                torsionStart: -fLocal[3],
                torsionEnd: fLocal[9],
                momentYStart: -fLocal[4],
                momentYEnd: fLocal[10],
                momentZStart: -fLocal[5],
                momentZEnd: fLocal[11]
            });
        }

        return memberForces;
    }

    /**
     * Apply boundary conditions using the penalty method (legacy)
     */
    applyBoundaryConditions(): void {
        if (!this.globalK) {
            throw new Error('Global stiffness matrix not assembled');
        }

        const penalty = 1e15;

        for (let i = 0; i < this.nodeIdList.length; i++) {
            const nodeId = this.nodeIdList[i];
            const node = this.nodes.get(nodeId);
            if (!node || !node.restraints) continue;

            const dofs = this.getNodeDOFs(nodeId);
            const r = node.restraints;

            if (r.fx) this.globalK.set([dofs[0], dofs[0]], penalty);
            if (r.fy) this.globalK.set([dofs[1], dofs[1]], penalty);
            if (r.fz) this.globalK.set([dofs[2], dofs[2]], penalty);
            if (r.mx) this.globalK.set([dofs[3], dofs[3]], penalty);
            if (r.my) this.globalK.set([dofs[4], dofs[4]], penalty);
            if (r.mz) this.globalK.set([dofs[5], dofs[5]], penalty);
        }
    }

    /**
     * Solve the system: [K]{D} = {F}
     */
    solve(): SolverResult {
        // Assemble matrices if not done
        if (!this.globalK) this.assemble();
        if (!this.forceVector) this.assembleForces();

        // Apply boundary conditions
        this.applyBoundaryConditions();

        // Solve for displacements: D = K^-1 * F
        const D = MatrixUtils.solve(this.globalK!, this.forceVector!);
        const dArray = D.toArray() as number[][];

        // Build results
        const displacements = new Map<string, { dx: number; dy: number; dz: number; rx: number; ry: number; rz: number }>();
        const reactions = new Map<string, { fx: number; fy: number; fz: number; mx: number; my: number; mz: number }>();
        const memberForces = new Map<string, {
            axialStart: number; axialEnd: number;
            shearYStart: number; shearYEnd: number;
            shearZStart: number; shearZEnd: number;
            momentYStart: number; momentYEnd: number;
            momentZStart: number; momentZEnd: number;
            torsionStart: number; torsionEnd: number;
        }>();

        // Extract displacements for each node
        const penalty = 1e15;
        for (let i = 0; i < this.nodeIdList.length; i++) {
            const nodeId = this.nodeIdList[i];
            const node = this.nodes.get(nodeId)!;
            const dofs = this.getNodeDOFs(nodeId);

            displacements.set(nodeId, {
                dx: dArray[dofs[0]][0],
                dy: dArray[dofs[1]][0],
                dz: dArray[dofs[2]][0],
                rx: dArray[dofs[3]][0],
                ry: dArray[dofs[4]][0],
                rz: dArray[dofs[5]][0]
            });

            // Calculate reactions for restrained nodes
            if (node.restraints) {
                const r = node.restraints;
                reactions.set(nodeId, {
                    fx: r.fx ? -penalty * dArray[dofs[0]][0] : 0,
                    fy: r.fy ? -penalty * dArray[dofs[1]][0] : 0,
                    fz: r.fz ? -penalty * dArray[dofs[2]][0] : 0,
                    mx: r.mx ? -penalty * dArray[dofs[3]][0] : 0,
                    my: r.my ? -penalty * dArray[dofs[4]][0] : 0,
                    mz: r.mz ? -penalty * dArray[dofs[5]][0] : 0
                });
            }
        }

        // Calculate member forces
        const memberList = Array.from(this.members.values());
        for (let m = 0; m < memberList.length; m++) {
            const member = memberList[m];
            const nodeA = this.nodes.get(member.startNodeId)!;
            const nodeB = this.nodes.get(member.endNodeId)!;

            const startDOFs = this.getNodeDOFs(member.startNodeId);
            const endDOFs = this.getNodeDOFs(member.endNodeId);

            // Get member displacements in global coordinates
            const dGlobal: number[] = [];
            const allDOFs = [...startDOFs, ...endDOFs];
            for (let d = 0; d < allDOFs.length; d++) {
                dGlobal.push(dArray[allDOFs[d]][0]);
            }

            // Transform to local coordinates
            const L = MatrixUtils.getMemberLength(nodeA, nodeB);
            const R = MatrixUtils.getRotationMatrix(nodeA, nodeB, member.beta ?? 0);
            const T = MatrixUtils.getTransformationMatrix(R);
            const TT = MatrixUtils.transpose(T);

            const dGlobalMatrix = math.matrix(dGlobal.map(v => [v]));
            const dLocalMatrix = MatrixUtils.multiply(TT, dGlobalMatrix);

            // Calculate local forces: f = k * d
            const k_local = MatrixUtils.getLocalStiffnessMatrix(
                member.E, member.Iy, member.Iz, member.A, L, member.G, member.J
            );
            const fLocalMatrix = MatrixUtils.multiply(k_local, dLocalMatrix);
            const fLocal = (fLocalMatrix.toArray() as number[][]).map(row => row[0]);

            memberForces.set(member.id, {
                axialStart: -fLocal[0],
                axialEnd: fLocal[6],
                shearYStart: -fLocal[1],
                shearYEnd: fLocal[7],
                shearZStart: -fLocal[2],
                shearZEnd: fLocal[8],
                torsionStart: -fLocal[3],
                torsionEnd: fLocal[9],
                momentYStart: -fLocal[4],
                momentYEnd: fLocal[10],
                momentZStart: -fLocal[5],
                momentZEnd: fLocal[11]
            });
        }

        return { displacements, reactions, memberForces };
    }

    getTotalDOFs(): number {
        return this.totalDOFs;
    }

    getGlobalK(): math.Matrix | null {
        return this.globalK;
    }
}

export default Solver;
