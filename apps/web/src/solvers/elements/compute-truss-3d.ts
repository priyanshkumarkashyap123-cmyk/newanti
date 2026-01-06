/**
 * PHASE 2 - TRUSS 3D ELEMENT IMPLEMENTATION
 * Axial-force-only members in 3D space for towers, space frames, lattices
 * 
 * File: apps/web/src/solvers/elements/compute-truss-3d.ts
 * Status: Phase 2 Sprint 1 Day 2 - Ready to integrate
 * Date: January 7, 2026
 */

/**
 * Compute 3D Truss Element Stiffness Matrix
 * 
 * Theory:
 * - 3D truss members carry only axial force (tension/compression)
 * - No bending moment, shear deformation, or torsion
 * - 2 nodes × 3 DOF/node = 6 DOF total (u, v, w at each node)
 * - DOF: [u1, v1, w1, u2, v2, w2] (3D displacements)
 * 
 * Local Stiffness (along member axis):
 * K_local = (EA/L) × [
 *    [ 1,  0,  0, -1,  0,  0]
 *    [ 0,  0,  0,  0,  0,  0]
 *    [ 0,  0,  0,  0,  0,  0]
 *    [-1,  0,  0,  1,  0,  0]
 *    [ 0,  0,  0,  0,  0,  0]
 *    [ 0,  0,  0,  0,  0,  0]
 * ]
 * 
 * Transformation to Global (3D):
 * K_global = T^T × K_local × T
 * where T is 6×6 rotation matrix with direction cosines
 * 
 * Direction Cosines (from node coordinates):
 * c_x = Δx/L, c_y = Δy/L, c_z = Δz/L
 * 
 * @param E Young's modulus (Pa) - e.g., 200e9 for steel
 * @param A Cross-sectional area (m²) - e.g., 0.001 for 1000 mm²
 * @param L Member length (m) - calculated from node coordinates
 * @param cx Direction cosine along x (Δx/L)
 * @param cy Direction cosine along y (Δy/L)
 * @param cz Direction cosine along z (Δz/L)
 * 
 * @returns 6×6 stiffness matrix in global coordinates
 * 
 * Example Usage:
 * const E = 200e9;  // Steel: 200 GPa
 * const A = 0.001;  // 1000 cm² = 0.001 m²
 * const x1 = 0, y1 = 0, z1 = 0;  // Node 1 at origin
 * const x2 = 3, y2 = 4, z2 = 0;  // Node 2
 * const dx = x2 - x1, dy = y2 - y1, dz = z2 - z1;
 * const L = Math.sqrt(dx*dx + dy*dy + dz*dz);  // = 5.0
 * const cx = dx/L, cy = dy/L, cz = dz/L;  // = 0.6, 0.8, 0.0
 * const K = computeTruss3DStiffness(E, A, L, cx, cy, cz);
 */
export function computeTruss3DStiffness(
  E: number,   // Young's modulus (Pa)
  A: number,   // Cross-sectional area (m²)
  L: number,   // Member length (m)
  cx: number,  // Direction cosine x (Δx/L)
  cy: number,  // Direction cosine y (Δy/L)
  cz: number   // Direction cosine z (Δz/L)
): number[][] {
  // Verify direction cosines sum to 1 (approximately)
  const sumSquares = cx*cx + cy*cy + cz*cz;
  if (Math.abs(sumSquares - 1.0) > 1e-6) {
    console.warn(`Warning: Direction cosines not normalized. Sum of squares = ${sumSquares}`);
  }
  
  // Axial stiffness
  const k = (E * A) / L;
  
  // ============================================
  // STEP 1: Local Stiffness Matrix (6×6)
  // ============================================
  // For 3D truss: only axial DOF (along member axis)
  // All perpendicular DOF have zero stiffness
  // Same pattern as 2D, extended to 6 DOF
  const K_local: number[][] = [
    [ k,  0,  0, -k,  0,  0],
    [ 0,  0,  0,  0,  0,  0],
    [ 0,  0,  0,  0,  0,  0],
    [-k,  0,  0,  k,  0,  0],
    [ 0,  0,  0,  0,  0,  0],
    [ 0,  0,  0,  0,  0,  0]
  ];
  
  // ============================================
  // STEP 2: Transformation Matrix (6×6)
  // ============================================
  // Maps from global coordinates to local (along member axis)
  // For each node: u_local = cx·u_global + cy·v_global + cz·w_global
  // 
  // Need perpendicular directions (orthonormal basis):
  // Primary axis: d = [cx, cy, cz]  (along member)
  // Need two perpendicular axes: p and q
  
  // Calculate perpendicular vector p:
  // Choose p perpendicular to d
  let px: number, py: number, pz: number;
  
  if (Math.abs(cx) < 0.9) {
    // d is not aligned with x-axis, use x-axis to form perpendicular
    // p = d × [1, 0, 0] (cross product)
    px = 0;
    py = cz;
    pz = -cy;
  } else {
    // d is aligned with x-axis, use y-axis instead
    // p = d × [0, 1, 0]
    px = -cz;
    py = 0;
    pz = cx;
  }
  
  // Normalize p
  const p_mag = Math.sqrt(px*px + py*py + pz*pz);
  px /= p_mag;
  py /= p_mag;
  pz /= p_mag;
  
  // Calculate third perpendicular vector q:
  // q = d × p (cross product)
  const qx = cy * pz - cz * py;
  const qy = cz * px - cx * pz;
  const qz = cx * py - cy * px;
  
  // Transformation matrix (6×6) with 3×3 blocks for each node
  // Node 1: [cx cy cz px py pz qx qy qz] forms rows 0-2
  // Node 2: same transformation for rows 3-5
  const T: number[][] = [
    // Node 1
    [ cx,  cy,  cz,  0,   0,   0],    // Local u (along member)
    [ px,  py,  pz,  0,   0,   0],    // Local v (perpendicular)
    [ qx,  qy,  qz,  0,   0,   0],    // Local w (perpendicular)
    // Node 2
    [ 0,   0,   0,   cx,  cy,  cz],   // Local u (along member)
    [ 0,   0,   0,   px,  py,  pz],   // Local v (perpendicular)
    [ 0,   0,   0,   qx,  qy,  qz]    // Local w (perpendicular)
  ];
  
  // ============================================
  // STEP 3: Transpose of T
  // ============================================
  const T_transpose = transpose6x6(T);
  
  // ============================================
  // STEP 4: Transform to Global Coordinates
  // ============================================
  // K_global = T^T × K_local × T
  
  // First: K_local × T
  const K_local_T = multiplyMatrices6x6(K_local, T);
  
  // Then: T^T × (K_local × T)
  const K_global = multiplyMatrices6x6(T_transpose, K_local_T);
  
  return K_global;
}

/**
 * Compute 3D Truss Member End Forces
 * 
 * Theory:
 * - Member carries only axial force: F = (EA/L) × Δu_local
 * - Where Δu_local = displacement change along member axis
 * - Tension is positive, compression is negative
 * 
 * Process:
 * 1. Get displacements at both nodes (u_global)
 * 2. Transform to local coordinates: u_local = T × u_global
 * 3. Calculate axial force: F = (EA/L) × (u2_local - u1_local)
 * 4. Return force and stress
 * 
 * @param u_global Global displacements [u1, v1, w1, u2, v2, w2] in meters
 * @param E Young's modulus (Pa)
 * @param A Cross-sectional area (m²)
 * @param L Member length (m)
 * @param cx Direction cosine x (Δx/L)
 * @param cy Direction cosine y (Δy/L)
 * @param cz Direction cosine z (Δz/L)
 * 
 * @returns Object with axial force, strain, and stress
 */
export function computeTruss3DMemberForces(
  u_global: number[],  // Global displacements [u1, v1, w1, u2, v2, w2]
  E: number,           // Young's modulus (Pa)
  A: number,           // Cross-sectional area (m²)
  L: number,           // Member length (m)
  cx: number,          // Direction cosine x
  cy: number,          // Direction cosine y
  cz: number           // Direction cosine z
): {
  axialForce: number;  // kN
  strain: number;      // Dimensionless
  stress: number;      // Pa
} {
  // Calculate perpendicular vectors (same as in stiffness calculation)
  let px: number, py: number, pz: number;
  
  if (Math.abs(cx) < 0.9) {
    px = 0;
    py = cz;
    pz = -cy;
  } else {
    px = -cz;
    py = 0;
    pz = cx;
  }
  
  const p_mag = Math.sqrt(px*px + py*py + pz*pz);
  px /= p_mag;
  py /= p_mag;
  pz /= p_mag;
  
  const qx = cy * pz - cz * py;
  const qy = cz * px - cx * pz;
  const qz = cx * py - cy * px;
  
  // ============================================
  // STEP 1: Transform to Local Coordinates
  // ============================================
  // u_local = T × u_global
  // For member axis direction:
  const u1_local = cx * u_global[0] + cy * u_global[1] + cz * u_global[2];
  const u2_local = cx * u_global[3] + cy * u_global[4] + cz * u_global[5];
  
  // ============================================
  // STEP 2: Calculate Change in Member Length
  // ============================================
  const delta_u = u2_local - u1_local;
  
  // ============================================
  // STEP 3: Calculate Axial Force
  // ============================================
  const k = (E * A) / L;
  const axialForce = k * delta_u / 1000;  // Convert to kN
  
  // ============================================
  // STEP 4: Calculate Strain and Stress
  // ============================================
  const strain = delta_u / L;
  const stress = E * strain;
  
  return {
    axialForce,  // kN
    strain,      // Dimensionless
    stress       // Pa
  };
}

/**
 * Calculate 3D Member Geometry from Node Positions
 * 
 * @param x1 First node x-coordinate (m)
 * @param y1 First node y-coordinate (m)
 * @param z1 First node z-coordinate (m)
 * @param x2 Second node x-coordinate (m)
 * @param y2 Second node y-coordinate (m)
 * @param z2 Second node z-coordinate (m)
 * 
 * @returns Object with length and direction cosines
 */
export function compute3DMemberGeometry(
  x1: number, y1: number, z1: number,
  x2: number, y2: number, z2: number
): {
  L: number;   // Member length
  cx: number;  // Direction cosine x
  cy: number;  // Direction cosine y
  cz: number;  // Direction cosine z
} {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const dz = z2 - z1;
  
  const L = Math.sqrt(dx*dx + dy*dy + dz*dz);
  
  if (L < 1e-10) {
    throw new Error('Invalid member: nodes are coincident');
  }
  
  return {
    L,
    cx: dx / L,
    cy: dy / L,
    cz: dz / L
  };
}

/**
 * Verify 3D transformation matrix orthonormality
 * 
 * The transformation matrix should preserve vector length:
 * |T × v|² = |v|²
 * 
 * This is used to verify numerical correctness
 */
export function verify3DTransformation(
  cx: number, cy: number, cz: number,
  px: number, py: number, pz: number,
  qx: number, qy: number, qz: number
): boolean {
  // Check: |d|² = 1
  const d_norm = cx*cx + cy*cy + cz*cz;
  
  // Check: |p|² = 1
  const p_norm = px*px + py*py + pz*pz;
  
  // Check: |q|² = 1
  const q_norm = qx*qx + qy*qy + qz*qz;
  
  // Check: d · p = 0 (orthogonal)
  const d_dot_p = cx*px + cy*py + cz*pz;
  
  // Check: d · q = 0 (orthogonal)
  const d_dot_q = cx*qx + cy*qy + cz*qz;
  
  // Check: p · q = 0 (orthogonal)
  const p_dot_q = px*qx + py*qy + pz*qz;
  
  const tolerance = 1e-6;
  
  const valid = 
    Math.abs(d_norm - 1.0) < tolerance &&
    Math.abs(p_norm - 1.0) < tolerance &&
    Math.abs(q_norm - 1.0) < tolerance &&
    Math.abs(d_dot_p) < tolerance &&
    Math.abs(d_dot_q) < tolerance &&
    Math.abs(p_dot_q) < tolerance;
  
  return valid;
}

/**
 * Helper: Multiply two 6×6 matrices
 * C = A × B
 */
function multiplyMatrices6x6(A: number[][], B: number[][]): number[][] {
  const C: number[][] = Array(6)
    .fill(null)
    .map(() => Array(6).fill(0));
  
  for (let i = 0; i < 6; i++) {
    for (let j = 0; j < 6; j++) {
      for (let k = 0; k < 6; k++) {
        C[i][j] += A[i][k] * B[k][j];
      }
    }
  }
  
  return C;
}

/**
 * Helper: Multiply 6×6 matrix by 6×1 vector
 * v = A × u
 */
export function multiplyMatrix6x1(A: number[][], u: number[]): number[] {
  const v = Array(6).fill(0);
  for (let i = 0; i < 6; i++) {
    for (let k = 0; k < 6; k++) {
      v[i] += A[i][k] * u[k];
    }
  }
  return v;
}

/**
 * Helper: Transpose a 6×6 matrix
 */
export function transpose6x6(A: number[][]): number[][] {
  const AT: number[][] = Array(6)
    .fill(null)
    .map(() => Array(6).fill(0));
  
  for (let i = 0; i < 6; i++) {
    for (let j = 0; j < 6; j++) {
      AT[j][i] = A[i][j];
    }
  }
  
  return AT;
}

/**
 * Helper: Add two 6×6 matrices
 */
export function addMatrices6x6(A: number[][], B: number[][]): number[][] {
  const C: number[][] = Array(6)
    .fill(null)
    .map(() => Array(6).fill(0));
  
  for (let i = 0; i < 6; i++) {
    for (let j = 0; j < 6; j++) {
      C[i][j] = A[i][j] + B[i][j];
    }
  }
  
  return C;
}

/**
 * Helper: Print a 6×6 matrix in readable format
 */
export function print6x6Matrix(A: number[][], name: string = 'Matrix'): void {
  console.log(`\n${name}:`);
  for (let i = 0; i < 6; i++) {
    const row = A[i].map(v => v.toFixed(4)).join('\t');
    console.log(`  [${row}]`);
  }
}

// ============================================
// EXPORT SUMMARY
// ============================================
// 
// Main Functions:
// 1. computeTruss3DStiffness() → 6×6 matrix (global coordinates)
// 2. computeTruss3DMemberForces() → Axial force, strain, stress
// 3. compute3DMemberGeometry() → Length and direction cosines from node positions
// 4. verify3DTransformation() → Check orthonormality of basis vectors
// 
// Helper Functions:
// 5. multiplyMatrices6x6() → Matrix multiplication
// 6. multiplyMatrix6x1() → Matrix-vector multiplication
// 7. transpose6x6() → Matrix transpose
// 8. addMatrices6x6() → Matrix addition
// 9. print6x6Matrix() → Debug output
// 
// Status: ✅ Ready for integration
// Next: Create validation tests for 3D transformation
