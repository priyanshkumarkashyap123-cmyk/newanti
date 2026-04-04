/**
 * PHASE 2 - TRUSS 3D ELEMENT IMPLEMENTATION
 * Axial-force-only members in 3D space
 * 
 * File: apps/web/src/solvers/elements/compute-truss-3d.ts
 * Status: Phase 2 Sprint 1 - Implemented
 * Date: January 8, 2026
 */

/**
 * Compute 3D Truss Element Stiffness Matrix
 * 
 * Theory:
 * - 3D truss members carry only axial force
 * - 2 nodes × 3 translational DOF/node = 6 DOF total (in pure truss system)
 * - However, for integration with Frame 3D solver (6 DOF/node), we map to 12 DOF system
 * - Rotational stiffness terms are zero
 * 
 * Local Stiffness (Axial):
 * k = EA/L
 * 
 * Transformation to Global:
 * K_global_3x3 = T^T * [k] * T (conceptually)
 * 
 * Explicit Global Stiffness Matrix (3x3 block):
 * Let cx, cy, cz be direction cosines.
 * 
 * K_block = (EA/L) * [
 *   cx^2   cx*cy  cx*cz
 *   cy*cx  cy^2   cy*cz
 *   cz*cx  cz*cy  cz^2
 * ]
 * 
 * Full 6x6 Matrix (Translational DOFs):
 * [  K_block   -K_block ]
 * [ -K_block    K_block ]
 * 
 * @param E Young's modulus (Pa)
 * @param A Cross-sectional area (m²)
 * @param L Member length (m)
 * @param cx Direction cosine x (dx/L)
 * @param cy Direction cosine y (dy/L)
 * @param cz Direction cosine z (dz/L)
 * 
 * @returns 6x6 stiffness matrix in global coordinates (Translational DOFs only)
 * The worker should map these to the 12x12 system (indices 0,1,2 and 6,7,8)
 */
export function computeTruss3DStiffness(
  E: number,
  A: number,
  L: number,
  cx: number,
  cy: number,
  cz: number
): number[][] {
  const k = (E * A) / L;

  // Precompute terms
  const cx2 = cx * cx;
  const cy2 = cy * cy;
  const cz2 = cz * cz;

  const cxcy = cx * cy;
  const cxcz = cx * cz;
  const cycz = cy * cz;

  // 3x3 Block K11
  // [ k*cx^2   k*cx*cy  k*cx*cz ]
  // [ k*cy*cx  k*cy^2   k*cy*cz ]
  // [ k*cz*cx  k*cz*cy  k*cz^2  ]

  // Full 6x6 Matrix Structure:
  // [ K11  -K11 ]
  // [ -K11  K11 ]

  const K: number[][] = [
    // Row 1 (u1)
    [k * cx2, k * cxcy, k * cxcz, -k * cx2, -k * cxcy, -k * cxcz],
    // Row 2 (v1)
    [k * cxcy, k * cy2, k * cycz, -k * cxcy, -k * cy2, -k * cycz],
    // Row 3 (w1)
    [k * cxcz, k * cycz, k * cz2, -k * cxcz, -k * cycz, -k * cz2],
    // Row 4 (u2)
    [-k * cx2, -k * cxcy, -k * cxcz, k * cx2, k * cxcy, k * cxcz],
    // Row 5 (v2)
    [-k * cxcy, -k * cy2, -k * cycz, k * cxcy, k * cy2, k * cycz],
    // Row 6 (w2)
    [-k * cxcz, -k * cycz, -k * cz2, k * cxcz, k * cycz, k * cz2]
  ];

  return K;
}

/**
 * Compute 3D Truss Member Axial Force
 * 
 * F = (EA/L) * Δu_local
 * Δu_local = (u2_global - u1_global) · director_vector
 *          = (u2-u1)*cx + (v2-v1)*cy + (w2-w1)*cz
 * 
 * Positive F = Tension
 * Negative F = Compression
 * 
 * @param u1 Displacement vector node 1 [u, v, w]
 * @param u2 Displacement vector node 2 [u, v, w]
 * @param E Young's modulus (same units as desired force output per unit area)
 * @param A Area
 * @param L Length
 * @param cx Direction cosine x
 * @param cy Direction cosine y
 * @param cz Direction cosine z
 */
export function computeTruss3DMemberForces(
  u1: number[], // [u, v, w]
  u2: number[], // [u, v, w]
  E: number,
  A: number,
  L: number,
  cx: number,
  cy: number,
  cz: number
): {
  axialForce: number; // Same force units as E×A
  stress: number;     // Same units as E
  strain: number;     // Dimensionless
} {
  // Relative displacements
  const du = u2[0] - u1[0];
  const dv = u2[1] - u1[1];
  const dw = u2[2] - u1[2];

  // Projection onto member axis (Change in Length)
  const delta_L = du * cx + dv * cy + dw * cz;

  // Stiffness
  const k = (E * A) / L;

  // Force (Newtons)
  const force_N = k * delta_L;

  // Stress (Pa) = F/A = E * (delta_L / L)
  const strain = delta_L / L;
  const stress = E * strain;

  return {
    axialForce: force_N, // Unit-consistent with E×A
    stress,
    strain
  };
}

/**
 * Compute 3D Member Geometry (Length and Direction Cosines)
 */
export function computeMemberGeometry3D(
  x1: number, y1: number, z1: number,
  x2: number, y2: number, z2: number
): { L: number, cx: number, cy: number, cz: number } {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const dz = z2 - z1;

  const L = Math.sqrt(dx * dx + dy * dy + dz * dz);

  // Handle zero length error? Worker typically handles this.
  // Return cosines
  return {
    L,
    cx: dx / L,
    cy: dy / L,
    cz: dz / L
  };
}
