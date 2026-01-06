/**
 * SparseMatrixAssembler.ts
 * 
 * Efficiently assembles the global stiffness matrix in Coordinate Format (COO)
 * for the WASM sparse solver.
 * 
 * Decoupled from store for Web Worker usage.
 */

// ============================================
// TYPES
// ============================================

export interface SparseEntry {
    row: number;
    col: number;
    value: number;
}

export interface SparseAssemblerOutput {
    entries: SparseEntry[];
    forces: number[];
    dof: number;
    nodeMapping: Map<string, number>; // Maps node ID to DOF index start
}

// Generic Input Interface (compatible with Worker ModelData)
export interface AssemblerInput {
    nodes: Array<{
        id: string;
        x: number;
        y: number;
        z: number;
        restraints?: {
            fx: boolean; fy: boolean; fz: boolean;
            mx: boolean; my: boolean; mz: boolean;
        };
    }>;
    members: Array<{
        id: string;
        startNodeId: string;
        endNodeId: string;
        E?: number;
        A?: number;
        I?: number;     // for Iy and Iz if same
        Iy?: number;
        Iz?: number;
        J?: number;
        betaAngle?: number;
    }>;
    loads: Array<{
        nodeId: string;
        fx?: number; fy?: number; fz?: number;
        mx?: number; my?: number; mz?: number;
    }>;
}

// ============================================
// CONSTANTS
// ============================================

const DOF_PER_NODE = 6; // 3D Frame: x, y, z, rx, ry, rz

// ============================================
// HELPERS (Pure functions)
// ============================================

/**
 * Calculate 12x12 local stiffness matrix for a 3D frame element
 */
function getLocalStiffnessMatrix(
    E: number,
    G: number,
    A: number,
    Iy: number,
    Iz: number,
    J: number,
    L: number
): Float64Array {
    const k = new Float64Array(144); // 12x12 flattened

    // Helper to set symmetric values
    const set = (r: number, c: number, v: number) => {
        k[r * 12 + c] = v;
        k[c * 12 + r] = v;
    };

    // Geometric properties
    const A_L = A / L;
    const Iz_L = Iz / L;
    const Iz_L2 = Iz / (L * L);
    const Iz_L3 = Iz / (L * L * L);
    const Iy_L = Iy / L;
    const Iy_L2 = Iy / (L * L);
    const Iy_L3 = Iy / (L * L * L);
    const J_L = J / L;

    // Axial (x)
    const k_axial = E * A_L;
    set(0, 0, k_axial);
    set(0, 6, -k_axial);
    set(6, 6, k_axial);

    // Torsion (rx)
    const k_torsion = G * J_L;
    set(3, 3, k_torsion);
    set(3, 9, -k_torsion);
    set(9, 9, k_torsion);

    // Bending about Z (affects y and rz)
    const k_bz_1 = 12 * E * Iz_L3;
    const k_bz_2 = 6 * E * Iz_L2;
    const k_bz_3 = 4 * E * Iz_L;
    const k_bz_4 = 2 * E * Iz_L;

    set(1, 1, k_bz_1);
    set(1, 5, k_bz_2);
    set(1, 7, -k_bz_1);
    set(1, 11, k_bz_2);

    set(5, 5, k_bz_3);
    set(5, 7, -k_bz_2);
    set(5, 11, k_bz_4);

    set(7, 7, k_bz_1);
    set(7, 11, -k_bz_2);

    set(11, 11, k_bz_3);

    // Bending about Y (affects z and ry)
    const k_by_1 = 12 * E * Iy_L3;
    const k_by_2 = 6 * E * Iy_L2;
    const k_by_3 = 4 * E * Iy_L;
    const k_by_4 = 2 * E * Iy_L;

    set(2, 2, k_by_1);
    set(2, 4, -k_by_2);
    set(2, 8, -k_by_1);
    set(2, 10, -k_by_2);

    set(4, 4, k_by_3);
    set(4, 8, k_by_2);
    set(4, 10, k_by_4);

    set(8, 8, k_by_1);
    set(8, 10, k_by_2);

    set(10, 10, k_by_3);

    return k;
}

/**
 * Calculate transformation matrix T (12x12)
 * from local to global coordinates
 */
function getTransformationMatrix(
    start: { x: number, y: number, z: number },
    end: { x: number, y: number, z: number },
    betaAngle: number = 0
): Float64Array {
    const T = new Float64Array(144);

    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const dz = end.z - start.z;
    const L = Math.sqrt(dx * dx + dy * dy + dz * dz);

    if (L < 1e-9) return T; // Zero length protection

    // Direction cosines of local x-axis
    const cx = dx / L;
    const cy = dy / L;
    const cz = dz / L;

    // Build rotation matrix R (3x3)
    let r11, r12, r13;
    let r21, r22, r23;
    let r31, r32, r33;

    r11 = cx;
    r12 = cy;
    r13 = cz;

    if (Math.abs(cx) < 1e-5 && Math.abs(cz) < 1e-5) {
        // Vertical member (along global Y)
        if (cy > 0) {
            r21 = 0; r22 = 0; r23 = -1;
            r31 = -1; r32 = 0; r33 = 0;
        } else {
            r21 = 0; r22 = 0; r23 = 1;
            r31 = 1; r32 = 0; r33 = 0;
        }
    } else {
        // General orientation
        const D = Math.sqrt(cx * cx + cz * cz);
        r21 = -cx * cy / D;
        r22 = D;
        r23 = -cy * cz / D;

        r31 = -cz / D;
        r32 = 0;
        r33 = cx / D;
    }

    // Apply Beta Angle rotation
    if (betaAngle !== 0) {
        const rad = betaAngle * Math.PI / 180;
        const c = Math.cos(rad);
        const s = Math.sin(rad);

        const r21_n = r21 * c + r31 * s;
        const r22_n = r22 * c + r32 * s;
        const r23_n = r23 * c + r33 * s;

        const r31_n = -r21 * s + r31 * c;
        const r32_n = -r22 * s + r32 * c;
        const r33_n = -r23 * s + r33 * c;

        r21 = r21_n; r22 = r22_n; r23 = r23_n;
        r31 = r31_n; r32 = r32_n; r33 = r33_n;
    }

    // Fill 12x12 T matrix
    for (let i = 0; i < 4; i++) {
        const offset = i * 3 * 12 + i * 3;
        T[offset + 0 * 12 + 0] = r11; T[offset + 0 * 12 + 1] = r12; T[offset + 0 * 12 + 2] = r13;
        T[offset + 1 * 12 + 0] = r21; T[offset + 1 * 12 + 1] = r22; T[offset + 1 * 12 + 2] = r23;
        T[offset + 2 * 12 + 0] = r31; T[offset + 2 * 12 + 1] = r32; T[offset + 2 * 12 + 2] = r33;
    }

    return T;
}

// ============================================
// MAIN ASSEMBLER CLASS
// ============================================

export class SparseMatrixAssembler {

    /**
     * Assemble the global stiffness matrix and force vector
     */
    static assemble(input: AssemblerInput): SparseAssemblerOutput {
        const { nodes, members, loads } = input;

        // 1. Map nodes to DOF indices
        // ==========================
        const nodeMapping = new Map<string, number>();
        // Fast lookup map
        const nodeMap = new Map<string, typeof nodes[0]>();

        nodes.forEach((node, index) => {
            nodeMapping.set(node.id, index * DOF_PER_NODE);
            nodeMap.set(node.id, node);
        });

        const totalDOF = nodes.length * DOF_PER_NODE;
        const forces = new Float64Array(totalDOF);
        const entries: SparseEntry[] = [];

        // 2. Assemble Member Stiffness
        // ==========================

        const membersCount = members.length;

        for (let m = 0; m < membersCount; m++) {
            const member = members[m];
            const startNode = nodeMap.get(member.startNodeId);
            const endNode = nodeMap.get(member.endNodeId);

            if (!startNode || !endNode) continue;

            // Material & Section Properties (with defaults)
            const E = member.E || 200e9; // 200 GPa
            const G = 77e9; // Shear modulus
            const A = member.A || 0.01;
            const Iy = member.Iy || member.I || 0.0001;
            const Iz = member.Iz || member.I || 0.0001;
            const J = member.J || (Iy + Iz);

            const dx = endNode.x - startNode.x;
            const dy = endNode.y - startNode.y;
            const dz = endNode.z - startNode.z;
            const L = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1e-9;

            // 1. Calculate Local K (12x12)
            const Kl = getLocalStiffnessMatrix(E, G, A, Iy, Iz, J, L);

            // 2. Calculate Transformation T (12x12)
            const T = getTransformationMatrix(
                { x: startNode.x, y: startNode.y, z: startNode.z },
                { x: endNode.x, y: endNode.y, z: endNode.z },
                member.betaAngle || 0
            );

            // 3. Transform to Global: Kg = T' * Kl * T
            const Kl_T = new Float64Array(144);

            // Kl * T
            for (let i = 0; i < 12; i++) {
                for (let j = 0; j < 12; j++) {
                    let sum = 0;
                    for (let k = 0; k < 12; k++) {
                        sum += Kl[i * 12 + k] * T[k * 12 + j];
                    }
                    Kl_T[i * 12 + j] = sum;
                }
            }

            // T' * (Kl * T)
            for (let i = 0; i < 12; i++) {
                for (let j = 0; j < 12; j++) {
                    let sum = 0;
                    for (let k = 0; k < 12; k++) {
                        sum += T[k * 12 + i] * Kl_T[k * 12 + j];
                    }

                    if (Math.abs(sum) > 1e-10) {
                        const startDofIndex = nodeMapping.get(member.startNodeId)!;
                        const endDofIndex = nodeMapping.get(member.endNodeId)!;

                        const globalRow = (i < 6) ? startDofIndex + i : endDofIndex + (i - 6);
                        const globalCol = (j < 6) ? startDofIndex + j : endDofIndex + (j - 6);

                        entries.push({
                            row: globalRow,
                            col: globalCol,
                            value: sum
                        });
                    }
                }
            }
        }

        // 3. Apply Boundary Conditions
        // ==========================
        const PENALTY = 1e16;

        nodes.forEach(node => {
            if (node.restraints) {
                const startDof = nodeMapping.get(node.id)!;
                if (node.restraints.fx) entries.push({ row: startDof + 0, col: startDof + 0, value: PENALTY });
                if (node.restraints.fy) entries.push({ row: startDof + 1, col: startDof + 1, value: PENALTY });
                if (node.restraints.fz) entries.push({ row: startDof + 2, col: startDof + 2, value: PENALTY });
                if (node.restraints.mx) entries.push({ row: startDof + 3, col: startDof + 3, value: PENALTY });
                if (node.restraints.my) entries.push({ row: startDof + 4, col: startDof + 4, value: PENALTY });
                if (node.restraints.mz) entries.push({ row: startDof + 5, col: startDof + 5, value: PENALTY });
            }
        });

        // 4. Assemble Load Vector
        // =======================
        loads.forEach(load => {
            const startDof = nodeMapping.get(load.nodeId);
            if (startDof !== undefined) {
                if (load.fx) forces[startDof + 0] += load.fx;
                if (load.fy) forces[startDof + 1] += load.fy;
                if (load.fz) forces[startDof + 2] += load.fz;
                if (load.mx) forces[startDof + 3] += load.mx;
                if (load.my) forces[startDof + 4] += load.my;
                if (load.mz) forces[startDof + 5] += load.mz;
            }
        });

        return {
            entries,
            forces: Array.from(forces),
            dof: totalDOF,
            nodeMapping
        };
    }
}
