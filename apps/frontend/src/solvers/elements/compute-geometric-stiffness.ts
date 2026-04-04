/**
 * PHASE 3 - GEOMETRIC STIFFNESS IMPLEMENTATION (P-DELTA)
 * 
 * File: apps/web/src/solvers/elements/compute-geometric-stiffness.ts
 * Status: Phase 3 Sprint 1 - Implemented
 * Date: January 8, 2026
 * 
 * Purpose:
 * Computes the Geometric Stiffness Matrix (Kg) dependent on internal axial force (P).
 * This matrix modifies the elemental stiffness to account for stress-stiffening (Tension)
 * or stress-softening (Compression) effects.
 * 
 * Convention:
 * P > 0 : Tension (Stiffening, usually neglected in simple P-Delta, but physically real)
 * P < 0 : Compression (Softening, leads to Buckling)
 * NOTE: Some texts use P=Compression > 0. We use P=Tension > 0.
 * So if P is negative (compression), coefficients reducing stiffness will apply.
 */

/**
 * Compute Geometric Stiffness for 3D Truss/Bar (String Stiffness)
 * 
 * For a bar carrying axial Force P:
 * The transverse stiffness generated is due to the rotation of the force vector.
 * Kg = (P/L) * [ I  -I ] (for transverse DOFs)
 * 
 * In local coordinates (x along member):
 * Transverse DOFs are y and z.
 * k_g_local = (P/L) * [
 *    0   0   0   0   0   0
 *    0   1   0   0  -1   0
 *    0   0   1   0   0  -1
 *    0   0   0   0   0   0
 *    0  -1   0   0   1   0
 *    0   0  -1   0   0   1
 * ] (for 3 translation DOFs per node: u,v,w)
 * 
 * @param P Axial Force (Tension > 0)
 * @param L Length
 * @param cx, cy, cz Direction Cosines
 * @param dofPerNode Number of DOFs (3 for Truss 3D, 6 for Frame 3D)
 */
export function computeGeometricStiffness(
    P: number,
    L: number,
    cx: number,
    cy: number,
    cz: number,
    dofPerNode: number,
    type: 'frame' | 'truss' | 'spring' = 'frame'
): number[][] {

    // Geometric Stiffness involves P/L
    // If L is very small, this can be huge. Solver handles small L usually.
    // If P is 0, Kg is zero.

    if (Math.abs(P) < 1e-6) {
        // Return zeros
        const size = dofPerNode * 2;
        return Array(size).fill(0).map(() => Array(size).fill(0));
    }

    // 1. Compute Local Kg
    // We construct a generalized local Kg for 3D Frame (12x12).
    // For Truss (3 DOF/node), we take subset.

    // Standard Consistent Geometric Stiffness Matrix for Prismatic Beam-Column (3D)
    // Ref: McGuire, Matrix Structural Analysis
    // Terms depend on P.

    // We normalize by P/L.
    const q = P / L;

    // Construct local matrix (12x12)
    const kgLocal = Array(12).fill(0).map(() => Array(12).fill(0));

    if (type === 'truss' || type === 'spring') {
        // String Stiffness only (transverse displacement resistance)
        // No rotational interaction.
        // Indices in local: u(0), v(1), w(2) ... u2(6), v2(7), w2(8)
        // Note: Truss 3D might be integrated as 6 dof/node in worker if using 'frame' map.
        // If dofPerNode=3 (Truss 3D standalone), indices are 0,1,2, 3,4,5.
        // Let's assume standard 12x12 "Frame" container for simplicity in 3D, and map down.
        // Or handle sparse logic.

        // For Truss:
        // k_v = P/L  (resistance to v)
        // k_w = P/L  (resistance to w)
        // k_u = 0    (axial geometric stiffness is 0 for small strain)

        // Local indices: 0(x), 1(y), 2(z)
        // Kg(1,1) = q, Kg(1,4) = -q ...

        const indices = (dofPerNode === 3)
            ? [0, 1, 2, 3, 4, 5] // u1, v1, w1, u2, v2, w2
            : [0, 1, 2, 6, 7, 8]; // u1, v1, w1, ..., u2, v2, w2  (skipping rotations)

        // Map: v1, w1, v2, w2
        // v1 (idx local 1) -> P/L
        // w1 (idx local 2) -> P/L
        // v2 (idx local 4 or 7) -> P/L
        // w2 (idx local 5 or 8) -> P/L

        // Off diagonals -P/L
        // The implementation logic for mapping local to global needs Rotation Matrix T.
        // Global Kg = T^T * Kg_local * T

        // Let's implement full 12x12 Local Kg for Frame, and zero out rotations for Truss.

        // Frame Geometric Stiffness (Standard)
        // Non-zero terms (upper triangle):
        // (1,1) = 0 (axial)
        // (2,2) = 6/5 (shear y?) -- No, this is consistent mass?
        // Wait, Consistent Geometric Stiffness for Beam:
        // (2,2) = 6/5 * P/L ? No.

        // Simplified "String Stiffness" approximation is often sufficient for P-Delta 
        // if we ignore P-little-delta (curvature effect).
        // But for buckling analysis of columns, curvature terms are critical.
        // Terms are: 6/5, 1/10, 2/15 etc.

        /* 
           McGuire Eq 9.14 (3D Beam-Column):
           Factor = P / L
           Terms involving L^2 etc.
        */

        // Since implementing full 12x12 consistent Kg is verbose and error-prone inline,
        // and Truss is our priority validation target for Sprint 3 (Space Truss Buckling maybe?),
        // let's start with the "String Stiffness" (P/L) which captures the major P-Delta sway effect.
        // P-little-delta requires refined elements or consistent matrix.

        // For Frame, we will use String Stiffness for now (Good for global P-Delta).
        // Kg_local = (P/L) * [
        //   0  0  0   0  0  0
        //   0  1  0   0 -1  0
        //   0  0  1   0  0 -1
        //   ...
        // ]

        // Fill Local Matrix (String Stiffness Model)
        // u1=0, v1=1, w1=2, u2=6, v2=7, w2=8 (for 12x12)
        const idx_v1 = 1;
        const idx_w1 = 2;
        const idx_v2 = 7;
        const idx_w2 = 8;

        kgLocal[idx_v1][idx_v1] = q;
        kgLocal[idx_w1][idx_w1] = q;
        kgLocal[idx_v2][idx_v2] = q;
        kgLocal[idx_w2][idx_w2] = q;

        kgLocal[idx_v1][idx_v2] = -q;
        kgLocal[idx_v2][idx_v1] = -q;
        kgLocal[idx_w1][idx_w2] = -q;
        kgLocal[idx_w2][idx_w1] = -q;

        // If Frame, we might want rotational interaction?
        // Ref: Traditional P-Delta uses this "Geo Stiffness" for sway.
        // It accounts for "Lean on column".
        // It does NOT account for individual member buckling between nodes (P-little-delta).
        // That requires multiple elements per member or higher order matrix.
        // We will stick to this "Sway P-Delta" matrix for simplicity and robustness first.

    } else {
        // FRAME: Consistent Beam-Column Geometric Stiffness (McGuire Eq 9.14)
        // Accounts for P-δ (member-level buckling) in addition to P-Δ (sway)
        // Factor: P / (30 * L)
        const f = P / (30.0 * L);
        const L2 = L * L;

        // Bending in xy-plane (v, θz): DOFs 1,5,7,11
        kgLocal[1][1]   =  36 * f;
        kgLocal[1][5]   =  3 * L * f;
        kgLocal[1][7]   = -36 * f;
        kgLocal[1][11]  =  3 * L * f;
        kgLocal[5][1]   =  3 * L * f;
        kgLocal[5][5]   =  4 * L2 * f;
        kgLocal[5][7]   = -3 * L * f;
        kgLocal[5][11]  = -L2 * f;
        kgLocal[7][1]   = -36 * f;
        kgLocal[7][5]   = -3 * L * f;
        kgLocal[7][7]   =  36 * f;
        kgLocal[7][11]  = -3 * L * f;
        kgLocal[11][1]  =  3 * L * f;
        kgLocal[11][5]  = -L2 * f;
        kgLocal[11][7]  = -3 * L * f;
        kgLocal[11][11] =  4 * L2 * f;

        // Bending in xz-plane (w, θy): DOFs 2,4,8,10
        // Sign changes on θy coupling due to θy = -dw/dx convention
        kgLocal[2][2]   =  36 * f;
        kgLocal[2][4]   = -3 * L * f;
        kgLocal[2][8]   = -36 * f;
        kgLocal[2][10]  = -3 * L * f;
        kgLocal[4][2]   = -3 * L * f;
        kgLocal[4][4]   =  4 * L2 * f;
        kgLocal[4][8]   =  3 * L * f;
        kgLocal[4][10]  = -L2 * f;
        kgLocal[8][2]   = -36 * f;
        kgLocal[8][4]   =  3 * L * f;
        kgLocal[8][8]   =  36 * f;
        kgLocal[8][10]  =  3 * L * f;
        kgLocal[10][2]  = -3 * L * f;
        kgLocal[10][4]  = -L2 * f;
        kgLocal[10][8]  =  3 * L * f;
        kgLocal[10][10] =  4 * L2 * f;
    }

    // 2. Transform to Global: Kg_global = T^T * Kg_local * T
    // Build rotation matrix t (3×3)
    const uVec = [cx, cy, cz]; // Member axis direction

    // Help vector for y' and z'
    let v_help = [0, 1, 0]; // Global Y
    if (Math.abs(cx) < 1e-4 && Math.abs(cz) < 1e-4) {
        v_help = [1, 0, 0]; // Vertical element → use Global X
    }

    // z' = x' × v_help
    let w = crossProduct(uVec, v_help);
    let magW = Math.sqrt(w[0] * w[0] + w[1] * w[1] + w[2] * w[2]);
    if (magW < 1e-9) { w = [0, 0, 1]; magW = 1; }
    w = w.map(val => val / magW);

    // y' = z' × x'
    const vDir = crossProduct(w, uVec);

    // 3×3 rotation matrix
    const tRot = [
        [uVec[0], uVec[1], uVec[2]],
        [vDir[0], vDir[1], vDir[2]],
        [w[0],    w[1],    w[2]]
    ];

    // Build 12×12 transformation matrix T = diag(t, t, t, t)
    const matSize = dofPerNode * 2;
    const K = Array(matSize).fill(0).map(() => Array(matSize).fill(0));

    if (type === 'truss' || dofPerNode === 3) {
        // For truss/3-DOF: use analytical formula (P/L)(I - n·nᵀ)
        const I3 = [[1, 0, 0], [0, 1, 0], [0, 0, 1]];
        const nDir = [cx, cy, cz];
        const subK: number[][] = [];
        for (let r = 0; r < 3; r++) {
            const row: number[] = [];
            for (let c = 0; c < 3; c++) {
                row.push(q * (I3[r][c] - nDir[r] * nDir[c]));
            }
            subK.push(row);
        }
        const n1 = 0;
        const n2 = dofPerNode;
        for (let r = 0; r < 3; r++) {
            for (let c = 0; c < 3; c++) {
                K[n1 + r][n1 + c] = subK[r][c];
                K[n2 + r][n2 + c] = subK[r][c];
                K[n1 + r][n2 + c] = -subK[r][c];
                K[n2 + r][n1 + c] = -subK[r][c];
            }
        }
    } else {
        // Frame (6 DOF/node): full T^T * Kg_local * T transformation
        // Construct full 12×12 T matrix
        const T: number[][] = Array(12).fill(0).map(() => Array(12).fill(0));
        for (let block = 0; block < 4; block++) {
            for (let r = 0; r < 3; r++) {
                for (let c = 0; c < 3; c++) {
                    T[block * 3 + r][block * 3 + c] = tRot[r][c];
                }
            }
        }

        // Kg_global = T^T * kgLocal * T
        // Step 1: temp = kgLocal * T
        const temp: number[][] = Array(12).fill(0).map(() => Array(12).fill(0));
        for (let i = 0; i < 12; i++) {
            for (let j = 0; j < 12; j++) {
                let sum = 0;
                for (let k = 0; k < 12; k++) {
                    sum += kgLocal[i][k] * T[k][j];
                }
                temp[i][j] = sum;
            }
        }
        // Step 2: K = T^T * temp
        for (let i = 0; i < 12; i++) {
            for (let j = 0; j < 12; j++) {
                let sum = 0;
                for (let k = 0; k < 12; k++) {
                    sum += T[k][i] * temp[k][j]; // T^T[i][k] = T[k][i]
                }
                K[i][j] = sum;
            }
        }
    }

    return K;
}

function crossProduct(a: number[], b: number[]): number[] {
    return [
        a[1] * b[2] - a[2] * b[1],
        a[2] * b[0] - a[0] * b[2],
        a[0] * b[1] - a[1] * b[0]
    ];
}
