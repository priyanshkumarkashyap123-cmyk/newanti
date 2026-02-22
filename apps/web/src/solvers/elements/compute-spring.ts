/**
 * PHASE 2 - SPRING ELEMENT IMPLEMENTATION
 * Elastic support/connector elements (2-node)
 * 
 * File: apps/web/src/solvers/elements/compute-spring.ts
 * Status: Phase 2 Sprint 2 - Implemented
 * Date: January 8, 2026
 */

/**
 * Compute 3D Spring Element Stiffness Matrix
 * 
 * Theory:
 * - A 2-node spring connects two nodes with a specified axial stiffness 'k' (Force/Length).
 * - It acts exactly like a Truss element, but 'k' is provided directly instead of computed from (EA/L).
 * - Used for elastic supports, soil springs, or base isolation.
 * 
 * Local Stiffness:
 * k_local = k
 * 
 * Global Stiffness (6x6):
 * [  K_block   -K_block ]
 * [ -K_block    K_block ]
 * 
 * Where K_block (3x3) = k * [
 *   cx^2   cx*cy  cx*cz
 *   cy*cx  cy^2   cy*cz
 *   cz*cx  cz*cy  cz^2
 * ]
 * 
 * @param k Spring axial stiffness (N/m)
 * @param cx Direction cosine x
 * @param cy Direction cosine y
 * @param cz Direction cosine z
 * 
 * @returns 6x6 stiffness matrix in global coordinates
 */
export function computeSpringStiffness(
  k: number,
  cx: number,
  cy: number,
  cz: number
): number[][] {
  // Precompute terms
  const cx2 = cx * cx;
  const cy2 = cy * cy;
  const cz2 = cz * cz;
  
  const cxcy = cx * cy;
  const cxcz = cx * cz;
  const cycz = cy * cz;
  
  // Full 6x6 Matrix Structure
  const K: number[][] = [
    // Row 1 (u1)
    [ k*cx2,   k*cxcy,  k*cxcz,  -k*cx2,  -k*cxcy, -k*cxcz ],
    // Row 2 (v1)
    [ k*cxcy,  k*cy2,   k*cycz,  -k*cxcy, -k*cy2,  -k*cycz ],
    // Row 3 (w1)
    [ k*cxcz,  k*cycz,  k*cz2,   -k*cxcz, -k*cycz, -k*cz2  ],
    // Row 4 (u2)
    [-k*cx2,  -k*cxcy, -k*cxcz,   k*cx2,   k*cxcy,  k*cxcz ],
    // Row 5 (v2)
    [-k*cxcy, -k*cy2,  -k*cycz,   k*cxcy,  k*cy2,   k*cycz ],
    // Row 6 (w2)
    [-k*cxcz, -k*cycz, -k*cz2,    k*cxcz,  k*cycz,  k*cz2  ]
  ];
  
  return K;
}

/**
 * Compute Spring Member Forces
 * 
 * F = k * ΔL
 * 
 * @param u1 Displacement vector node 1 [u, v, w]
 * @param u2 Displacement vector node 2 [u, v, w]
 * @param k Spring stiffness (force/length units)
 * @param cx Direction cosine x
 * @param cy Direction cosine y
 * @param cz Direction cosine z
 */
export function computeSpringForces(
  u1: number[],
  u2: number[],
  k: number,
  cx: number,
  cy: number,
  cz: number
): {
  force: number; // Same force units as k×length (Tension + / Compression -)
  elongation: number; // Same length units as input displacements
} {
  // Relative displacements
  const du = u2[0] - u1[0];
  const dv = u2[1] - u1[1];
  const dw = u2[2] - u1[2];
  
  // Projection onto spring axis (Elongation)
  const delta_L = du * cx + dv * cy + dw * cz;
  
  // Force (Newtons)
  const force_N = k * delta_L;
  
  return {
    force: force_N, // Unit-consistent with k×displacement
    elongation: delta_L
  };
}
