/**
 * Structural Analysis Solver - Direct Stiffness Method for 2D Frame
 * 
 * For simplicity, we start with a 2D analysis (X-Y plane):
 * - 3 DOFs per node: dx, dy, rz (translation X, Y, rotation Z)
 * - Full frame element with axial, shear, and bending
 */

import * as math from 'mathjs';

// TypeScript interfaces matching frontend store
interface Node {
    id: string;
    x: number;
    y: number;
    z: number;
    restraints?: {
        fx: boolean; fy: boolean; fz: boolean;
        mx: boolean; my: boolean; mz: boolean;
    };
}

interface NodeLoad {
    id: string;
    nodeId: string;
    fx?: number; fy?: number; fz?: number;
    mx?: number; my?: number; mz?: number;
}

interface Member {
    id: string;
    startNodeId: string;
    endNodeId: string;
    sectionId: string;
    E?: number; // Young's Modulus (kN/m²)
    A?: number; // Cross-sectional Area (m²)
    I?: number; // Moment of Inertia (m⁴)
}

interface AnalysisRequest {
    nodes: Node[];
    members: Member[];
    loads: NodeLoad[];
}

interface DisplacementResult {
    dx: number; dy: number; dz: number;
    rx: number; ry: number; rz: number;
}

interface ReactionResult {
    fx: number; fy: number; fz: number;
    mx: number; my: number; mz: number;
}

interface MemberForceResult {
    axial: number;
    shearY: number;
    shearZ: number;
    momentY: number;
    momentZ: number;
    torsion: number;
}

interface AnalysisResult {
    displacements: Record<string, DisplacementResult>;
    reactions: Record<string, ReactionResult>;
    memberForces: Record<string, MemberForceResult>;
    success: boolean;
    message: string;
}

/**
 * Get local stiffness matrix for a 2D frame element
 * DOFs: [u1, v1, θ1, u2, v2, θ2] (axial, shear, rotation at each end)
 */
function getLocalStiffnessMatrix(E: number, A: number, I: number, L: number): number[][] {
    const EA_L = (E * A) / L;
    const EI_L3 = (12 * E * I) / (L * L * L);
    const EI_L2 = (6 * E * I) / (L * L);
    const EI_L = (4 * E * I) / L;
    const EI_L_2 = (2 * E * I) / L;

    return [
        [EA_L, 0, 0, -EA_L, 0, 0],
        [0, EI_L3, EI_L2, 0, -EI_L3, EI_L2],
        [0, EI_L2, EI_L, 0, -EI_L2, EI_L_2],
        [-EA_L, 0, 0, EA_L, 0, 0],
        [0, -EI_L3, -EI_L2, 0, EI_L3, -EI_L2],
        [0, EI_L2, EI_L_2, 0, -EI_L2, EI_L]
    ];
}

/**
 * Get transformation matrix from local to global coordinates
 */
function getTransformationMatrix(cos: number, sin: number): number[][] {
    return [
        [cos, sin, 0, 0, 0, 0],
        [-sin, cos, 0, 0, 0, 0],
        [0, 0, 1, 0, 0, 0],
        [0, 0, 0, cos, sin, 0],
        [0, 0, 0, -sin, cos, 0],
        [0, 0, 0, 0, 0, 1]
    ];
}

/**
 * Main analysis function
 */
export function analyzeStructure(request: AnalysisRequest): AnalysisResult {
    const { nodes, members, loads } = request;

    // Validation
    if (nodes.length < 2) {
        return { displacements: {}, reactions: {}, memberForces: {}, success: false, message: 'Need at least 2 nodes' };
    }
    if (members.length < 1) {
        return { displacements: {}, reactions: {}, memberForces: {}, success: false, message: 'Need at least 1 member' };
    }

    // Create node index map
    const nodeIndexMap = new Map<string, number>();
    nodes.forEach((node, idx) => nodeIndexMap.set(node.id, idx));

    const numNodes = nodes.length;
    const dofsPerNode = 3; // For 2D: dx, dy, rz
    const totalDofs = numNodes * dofsPerNode;

    // Initialize global stiffness matrix and force vector
    const K: number[][] = Array(totalDofs).fill(null).map(() => Array(totalDofs).fill(0));
    const F: number[] = Array(totalDofs).fill(0);

    // Assemble global stiffness matrix
    for (const member of members) {
        const startIdx = nodeIndexMap.get(member.startNodeId);
        const endIdx = nodeIndexMap.get(member.endNodeId);

        if (startIdx === undefined || endIdx === undefined) continue;

        const startNode = nodes[startIdx];
        const endNode = nodes[endIdx];
        if (!startNode || !endNode) continue;

        // Calculate member geometry
        const dx = endNode.x - startNode.x;
        const dy = endNode.y - startNode.y;
        const L = Math.sqrt(dx * dx + dy * dy);

        if (L < 1e-10) continue; // Skip zero-length members

        const cos = dx / L;
        const sin = dy / L;

        // Get material properties
        const E = member.E ?? 200e6;
        const A = member.A ?? 0.01;
        const I = member.I ?? 1e-4;

        // Local and transformation matrices
        const kLocal = getLocalStiffnessMatrix(E, A, I, L);
        const T = getTransformationMatrix(cos, sin);

        // Transform to global: K_global = T^T * K_local * T
        const TT = math.transpose(T) as number[][];
        const kGlobal = math.multiply(math.multiply(TT, kLocal), T) as number[][];

        // DOF mapping for this element
        const dofs = [
            startIdx * 3, startIdx * 3 + 1, startIdx * 3 + 2,
            endIdx * 3, endIdx * 3 + 1, endIdx * 3 + 2
        ];

        // Assemble into global matrix
        for (let i = 0; i < 6; i++) {
            for (let j = 0; j < 6; j++) {
                const di = dofs[i];
                const dj = dofs[j];
                const kRow = kGlobal[i];
                if (di !== undefined && dj !== undefined && kRow !== undefined) {
                    const KRow = K[di];
                    const kVal = kRow[j];
                    if (KRow !== undefined && kVal !== undefined) {
                        KRow[dj] = (KRow[dj] ?? 0) + kVal;
                    }
                }
            }
        }
    }

    // Apply loads
    for (const load of loads) {
        const nodeIdx = nodeIndexMap.get(load.nodeId);
        if (nodeIdx === undefined) continue;

        const baseDof = nodeIdx * dofsPerNode;
        F[baseDof]! += load.fx ?? 0;
        F[baseDof + 1]! += load.fy ?? 0;
        F[baseDof + 2]! += load.mz ?? 0;
    }

    // Identify restrained DOFs
    const restrainedDofs: number[] = [];
    const freeDofs: number[] = [];

    for (let i = 0; i < numNodes; i++) {
        const node = nodes[i]!;
        const baseDof = i * dofsPerNode;

        if (node.restraints?.fx) restrainedDofs.push(baseDof);
        else freeDofs.push(baseDof);

        if (node.restraints?.fy) restrainedDofs.push(baseDof + 1);
        else freeDofs.push(baseDof + 1);

        if (node.restraints?.mz) restrainedDofs.push(baseDof + 2);
        else freeDofs.push(baseDof + 2);
    }

    // Check if structure is stable
    if (restrainedDofs.length < 3) {
        return { displacements: {}, reactions: {}, memberForces: {}, success: false, message: 'Structure is unstable - needs at least 3 restrained DOFs' };
    }

    // Extract reduced stiffness matrix and force vector
    const nFree = freeDofs.length;
    const Kff: number[][] = Array(nFree).fill(null).map(() => Array(nFree).fill(0));
    const Ff: number[] = Array(nFree).fill(0);

    for (let i = 0; i < nFree; i++) {
        Ff[i] = F[freeDofs[i]!]!;
        for (let j = 0; j < nFree; j++) {
            Kff[i]![j] = K[freeDofs[i]!]![freeDofs[j]!]!;
        }
    }

    // Solve for displacements: Kff * Uf = Ff
    let Uf: number[];
    try {
        const solution = math.lusolve(Kff, Ff) as number[][];
        Uf = solution.map(row => row[0] ?? 0);
    } catch (error) {
        return { displacements: {}, reactions: {}, memberForces: {}, success: false, message: 'Matrix is singular - structure may be unstable' };
    }

    // Build full displacement vector
    const U: number[] = Array(totalDofs).fill(0);
    for (let i = 0; i < freeDofs.length; i++) {
        U[freeDofs[i]!] = Uf[i]!;
    }

    // Calculate reactions: R = K * U - F
    const R = math.subtract(math.multiply(K, U), F) as number[];

    // Build result objects
    const displacements: Record<string, DisplacementResult> = {};
    const reactions: Record<string, ReactionResult> = {};

    for (const node of nodes) {
        const idx = nodeIndexMap.get(node.id)!;
        const baseDof = idx * dofsPerNode;

        displacements[node.id] = {
            dx: U[baseDof]!,
            dy: U[baseDof + 1]!,
            dz: 0,
            rx: 0,
            ry: 0,
            rz: U[baseDof + 2]!
        };

        // Only report reactions at restrained nodes
        if (node.restraints?.fx || node.restraints?.fy || node.restraints?.mz) {
            reactions[node.id] = {
                fx: R[baseDof]!,
                fy: R[baseDof + 1]!,
                fz: 0,
                mx: 0,
                my: 0,
                mz: R[baseDof + 2]!
            };
        }
    }

    // Calculate member forces
    const memberForces: Record<string, MemberForceResult> = {};
    for (const member of members) {
        const startIdx = nodeIndexMap.get(member.startNodeId);
        const endIdx = nodeIndexMap.get(member.endNodeId);
        if (startIdx === undefined || endIdx === undefined) continue;

        const startNode = nodes[startIdx]!;
        const endNode = nodes[endIdx]!;

        const dx = endNode.x - startNode.x;
        const dy = endNode.y - startNode.y;
        const L = Math.sqrt(dx * dx + dy * dy);
        if (L < 1e-10) continue;

        const cos = dx / L;
        const sin = dy / L;

        const E = member.E ?? 200e6;
        const A = member.A ?? 0.01;
        const I = member.I ?? 1e-4;

        // Get element displacements in global coords
        const uGlobal = [
            U[startIdx * 3]!, U[startIdx * 3 + 1]!, U[startIdx * 3 + 2]!,
            U[endIdx * 3]!, U[endIdx * 3 + 1]!, U[endIdx * 3 + 2]!
        ];

        // Transform to local
        const T = getTransformationMatrix(cos, sin);
        const uLocal = math.multiply(T, uGlobal) as number[];

        // Calculate local forces
        const kLocal = getLocalStiffnessMatrix(E, A, I, L);
        const fLocal = math.multiply(kLocal, uLocal) as number[];

        // Extract forces at start node (positive tension, positive shear up, positive moment CCW)
        memberForces[member.id] = {
            axial: -fLocal[0]!, // Tension positive
            shearY: fLocal[1]!,
            shearZ: 0,
            momentY: 0,
            momentZ: fLocal[2]!,
            torsion: 0
        };
    }

    return {
        displacements,
        reactions,
        memberForces,
        success: true,
        message: 'Analysis completed successfully'
    };
}
