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
        // Assume default behavior is String Stiffness for now 
        // until we add full Beam-Column Kg.
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
    }

    // 2. Transform to Global: Kg_global = T^T * Kg_local * T
    // Build Transformation Matrix T (12x12)
    // T = diag(t, t, t, t) where t is 3x3 rotation
    // t rows are: x' (axis), y', z' (principal axes)

    // Calculate local axes
    // x' = [cx, cy, cz]
    const u = [cx, cy, cz];

    // Help vector for y' and z'
    // If vertical member (cx~0, cz~0), use global X as help?
    // Standard logic:
    let v_help = [0, 1, 0]; // Global Y
    if (Math.abs(cx) < 1e-4 && Math.abs(cz) < 1e-4) {
        // Vertical element
        v_help = [1, 0, 0]; // Global X
    }

    // z' = x' cross v_help
    let w = crossProduct(u, v_help);
    let magW = Math.sqrt(w[0] * w[0] + w[1] * w[1] + w[2] * w[2]);
    if (magW < 1e-9) {
        // Singularity? Should be handled by v_help check
        w = [0, 0, 1]; magW = 1;
    }
    w = w.map(val => val / magW);

    // y' = z' cross x'
    const v = crossProduct(w, u);
    // Normalize v (should be unit)

    // Rotation Matrix t (3x3)
    // [ cx cy cz ] (Row 1 is x')
    // [ vx vy vz ] (Row 2 is y')
    // [ wx wy wz ] (Row 3 is z')

    const t = [
        [u[0], u[1], u[2]],
        [v[0], v[1], v[2]],
        [w[0], w[1], w[2]]
    ];

    // Full T (12x12) or 6x6
    const size = (dofPerNode === 3) ? 6 : 12;
    const numNodes = 2;

    // Perform Transformation
    // K_global = T^T * K_local * T
    // Since K_local is 12x12 (or virtual), we map it manually or multiply.
    // Optimization: Matrix calc

    // For String Stiffness, Kg_local corresponds to:
    // v, w terms.
    // Actually, String stiffness in Global coordinates is simply:
    // Kg_global = (P/L) * [ I - n*n^T   -(I - n*n^T) ]
    //             [ -(I - n*n^T)   I - n*n^T   ]
    // where n is unit vector (cx,cy,cz) and I is 3x3 identity.
    // (I - n*n^T) is the projection onto the plane perpendicular to the member.
    // This is mathematically equivalent to T^T * [0 0 0; 0 1 0; 0 0 1] * T.

    // This formula is much simpler and avoids explicit T construction for Truss/String Kg.
    // Formula: K_sub = (P/L) * (I_3x3 - n * n^T)
    // n = [cx, cy, cz]

    const I3 = [[1, 0, 0], [0, 1, 0], [0, 0, 1]];
    const n = [cx, cy, cz];

    const subK: number[][] = [];
    for (let r = 0; r < 3; r++) {
        const row: number[] = [];
        for (let c = 0; c < 3; c++) {
            const val = q * (I3[r][c] - n[r] * n[c]);
            row.push(val);
        }
        subK.push(row);
    }

    // Assembly into full matrix
    // Dimensions
    const matSize = dofPerNode * 2;
    const K = Array(matSize).fill(0).map(() => Array(matSize).fill(0));

    // Indices for Translation
    // Node 1: 0,1,2
    // Node 2: dofPerNode, dofPerNode+1, dofPerNode+2
    const n1 = 0;
    const n2 = dofPerNode;

    for (let r = 0; r < 3; r++) {
        for (let c = 0; c < 3; c++) {
            const val = subK[r][c];
            // K11
            K[n1 + r][n1 + c] = val;
            // K22
            K[n2 + r][n2 + c] = val;
            // K12
            K[n1 + r][n2 + c] = -val;
            // K21
            K[n2 + r][n1 + c] = -val;
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
