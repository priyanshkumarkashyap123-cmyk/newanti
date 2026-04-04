
// ============================================
// MASS MATRIX CALCULATIONS
// ============================================

/**
 * Computes the Consistent Mass Matrix for a 2D/3D Truss Element (Axial Only).
 * Local Coordinates.
 * 
 * Mass is distributed linearly along the element.
 * M = (rho * A * L / 6) * [ 2  1 ]
 *                         [ 1  2 ]
 * 
 * @param rho Density (kg/m3)
 * @param A Area (m2)
 * @param L Length (m)
 * @returns 2x2 Matrix for Axial DOFs [u1, u2]
 */
export function computeConsistentTrussMass(rho: number, A: number, L: number): number[][] {
    const totalMass = rho * A * L;
    const factor = totalMass / 6;

    return [
        [2 * factor, 1 * factor],
        [1 * factor, 2 * factor]
    ];
}

/**
 * Computes the Consistent Mass Matrix for a 2D Frame Element (Beam-Column).
 * Local Coordinates (u, v, theta).
 * 
 * Includes Axial (Linear) and Transverse (Cubic hermite shapes).
 * 
 * @param rho Density (kg/m3)
 * @param A Area (m2)
 * @param L Length (m)
 * @returns 6x6 Matrix for [u1, v1, th1, u2, v2, th2]
 */
export function computeConsistentFrameMass(rho: number, A: number, L: number): number[][] {
    const m = rho * A * L; // Total Mass

    // Axial Part (u) - Same as Truss
    // factor = m/6
    // [2, 1; 1, 2] at indices 0, 3 (u1, u2)

    // Transverse Part (v, theta) - Bernoulli Beam
    // Coefficients for m/420
    // [156, 22L, 54, -13L
    //  22L, 4L^2, 13L, -3L^2
    //  54, 13L, 156, -22L
    // -13L, -3L^2, -22L, 4L^2]

    const c1 = m / 420;
    const u_fac = m / 6;

    const M = Array(6).fill(0).map(() => Array(6).fill(0));

    // Axial (indices 0, 3)
    M[0][0] = 2 * u_fac; M[0][3] = 1 * u_fac;
    M[3][0] = 1 * u_fac; M[3][3] = 2 * u_fac;

    // Transverse (indices 1, 2, 4, 5) => v1, th1, v2, th2
    // Row 1 (v1)
    M[1][1] = 156 * c1; M[1][2] = 22 * L * c1; M[1][4] = 54 * c1; M[1][5] = -13 * L * c1;
    // Row 2 (th1)
    M[2][1] = 22 * L * c1; M[2][2] = 4 * L * L * c1; M[2][4] = 13 * L * c1; M[2][5] = -3 * L * L * c1;
    // Row 4 (v2)
    M[4][1] = 54 * c1; M[4][2] = 13 * L * c1; M[4][4] = 156 * c1; M[4][5] = -22 * L * c1;
    // Row 5 (th2)
    M[5][1] = -13 * L * c1; M[5][2] = -3 * L * L * c1; M[5][4] = -22 * L * c1; M[5][5] = 4 * L * L * c1;

    // Mirror for symmetry (handled above explicitly, but checking)
    // 1-2 vs 2-1: 22L vs 22L (OK)

    return M;
}

/**
 * Computes Lumped Mass Matrix (Diagonal).
 * Splits total mass equally to translational DOFs.
 * Rotational inertia is often neglected or small (rho*Ip*L/2?), but strictly Lumped usually just puts mass on u,v,w.
 * 
 * @param rho Density
 * @param A Area
 * @param L Length
 * @param dofPerNode 
 * @returns Diagonal array (vector) for the element DOFs
 */
export function computeLumpedMass(rho: number, A: number, L: number, dofPerNode: number): number[] {
    const totalMass = rho * A * L;
    const nodeMass = totalMass / 2;

    const diag = new Array(dofPerNode * 2).fill(0);

    // Add mass to translational DOFs only
    // 2D Truss: u, v (indices 0,1 and 2,3)
    // 2D Frame: u, v (indices 0,1 and 3,4). Theta (2,5) often 0 or small rotary inertia.
    // 3D Frame: u, v, w (0,1,2 and 6,7,8).

    if (dofPerNode === 2) {
        // Truss 2D
        diag[0] = nodeMass; diag[1] = nodeMass;
        diag[2] = nodeMass; diag[3] = nodeMass;
    } else if (dofPerNode === 3) {
        // Frame 2D (u, v, theta)
        diag[0] = nodeMass; diag[1] = nodeMass; diag[2] = 0; // Neglect rotary
        diag[3] = nodeMass; diag[4] = nodeMass; diag[5] = 0;
    } else if (dofPerNode === 6) {
        // Frame 3D
        diag[0] = nodeMass; diag[1] = nodeMass; diag[2] = nodeMass;
        diag[3] = 0; diag[4] = 0; diag[5] = 0;

        diag[6] = nodeMass; diag[7] = nodeMass; diag[8] = nodeMass;
        diag[9] = 0; diag[10] = 0; diag[11] = 0;
    }

    return diag;
}
