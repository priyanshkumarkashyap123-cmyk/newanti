/**
 * PHASE 2 - TRUSS 2D ELEMENT IMPLEMENTATION
 * Axial-force-only members for bridge trusses, tower lattices
 * 
 * File: apps/web/src/solvers/elements/compute-truss-2d.ts
 * Status: Phase 2 Sprint 1 - Ready to integrate
 * Date: January 6, 2026
 */

/**
 * Compute 2D Truss Element Stiffness Matrix
 * 
 * Theory:
 * - 2D truss members carry only axial force (tension/compression)
 * - No bending moment or shear deformation
 * - 2 nodes × 2 DOF/node = 4 DOF total
 * - DOF: [u1, v1, u2, v2] (horizontal and vertical displacements)
 * 
 * Local Stiffness:
 * K_local = (EA/L) × [
 *    [ 1,  0, -1,  0]
 *    [ 0,  0,  0,  0]
 *    [-1,  0,  1,  0]
 *    [ 0,  0,  0,  0]
 * ]
 * 
 * Transformation to Global:
 * K_global = T^T × K_local × T
 * where T is 2D rotation matrix
 * 
 * @param E Young's modulus (Pa) - e.g., 200e9 for steel
 * @param A Cross-sectional area (m²) - e.g., 0.001 for 0.1m × 0.01m
 * @param L Member length (m) - calculated from node coordinates
 * @param angle Member angle from horizontal (radians)
 * 
 * @returns 4×4 stiffness matrix in global coordinates
 * 
 * Example Usage:
 * const E = 200e9;  // Steel: 200 GPa
 * const A = 0.001;  // 100 cm² = 0.001 m²
 * const L = 5.0;    // 5 meters
 * const angle = Math.PI / 4;  // 45 degrees
 * const K = computeTruss2DStiffness(E, A, L, angle);
 */
export function computeTruss2DStiffness(
  E: number,      // Young's modulus (Pa)
  A: number,      // Cross-sectional area (m²)
  L: number,      // Member length (m)
  angle: number   // Member angle from horizontal (radians)
): number[][] {
  // Calculate direction cosines
  const c = Math.cos(angle);  // cos(θ)
  const s = Math.sin(angle);  // sin(θ)
  
  // Axial stiffness
  const k = (E * A) / L;
  
  // ============================================
  // STEP 1: Local Stiffness Matrix (4×4)
  // ============================================
  // K_local has non-zero values only for axial terms
  // Shear terms (perpendicular to member) are zero
  const K_local: number[][] = [
    [ k,  0, -k,  0],
    [ 0,  0,  0,  0],
    [-k,  0,  k,  0],
    [ 0,  0,  0,  0]
  ];
  
  // ============================================
  // STEP 2: Transformation Matrix (4×4)
  // ============================================
  // Maps from global DOF [u_global, v_global] to local [u_local, v_local]
  // u_local = c·u_global + s·v_global
  // v_local = -s·u_global + c·v_global
  // 
  // For both nodes:
  const T: number[][] = [
    [ c,  s,  0,  0],    // Node 1 horizontal
    [-s,  c,  0,  0],    // Node 1 vertical
    [ 0,  0,  c,  s],    // Node 2 horizontal
    [ 0,  0, -s,  c]     // Node 2 vertical
  ];
  
  // ============================================
  // STEP 3: Transpose of T
  // ============================================
  const T_transpose: number[][] = [
    [ c, -s,  0,  0],
    [ s,  c,  0,  0],
    [ 0,  0,  c, -s],
    [ 0,  0,  s,  c]
  ];
  
  // ============================================
  // STEP 4: Transform to Global Coordinates
  // ============================================
  // K_global = T^T × K_local × T
  
  // First: K_local × T
  const K_local_T = multiplyMatrices4x4(K_local, T);
  
  // Then: T^T × (K_local × T)
  const K_global = multiplyMatrices4x4(T_transpose, K_local_T);
  
  return K_global;
}

/**
 * Compute 2D Truss Member End Forces
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
 * 4. Return force (tension/compression)
 * 
 * @param u_global Global displacements [u1, v1, u2, v2]
 * @param E Young's modulus (same units as desired output force per area)
 * @param A Cross-sectional area (m²)
 * @param L Member length (m)
 * @param angle Member angle from horizontal (radians)
 * 
 * @returns Object with axial force (same force unit as E×A implies)
 *   - Positive = Tension
 *   - Negative = Compression
 *   - If E is in kN/m², force is in kN. If E is in Pa, force is in N.
 * 
 * Example Usage:
 * const u_global = [0.001, 0.002, 0.0015, 0.0025];  // in meters
 * const force = computeTruss2DMemberForces(u_global, E, A, L, angle);
 * console.log(`Axial force: ${force.axialForce}`);
 */
export function computeTruss2DMemberForces(
  u_global: number[],  // Global displacements [u1, v1, u2, v2] in meters
  E: number,           // Young's modulus
  A: number,           // Cross-sectional area (m²)
  L: number,           // Member length (m)
  angle: number        // Member angle from horizontal (radians)
): {
  axialForce: number;  // Same force unit as E*A/L*displacement
  strain: number;      // Axial strain (dimensionless)
  stress: number;      // Normal stress (same unit as E)
} {
  // Calculate direction cosines
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  
  // ============================================
  // STEP 1: Transform to Local Coordinates
  // ============================================
  // u_local = T × u_global
  const u1_local = c * u_global[0] + s * u_global[1];       // Node 1 along member
  const v1_local = -s * u_global[0] + c * u_global[1];      // Node 1 perpendicular
  const u2_local = c * u_global[2] + s * u_global[3];       // Node 2 along member
  const v2_local = -s * u_global[2] + c * u_global[3];      // Node 2 perpendicular
  
  // ============================================
  // STEP 2: Calculate Change in Member Length
  // ============================================
  // Δu = u2_local - u1_local (elongation)
  const delta_u = u2_local - u1_local;
  
  // ============================================
  // STEP 3: Calculate Axial Force
  // ============================================
  // F = (EA/L) × Δu
  // Note: Positive = Tension, Negative = Compression
  // Force units match E×A units (e.g., kN if E in kN/m² and A in m²)
  const k = (E * A) / L;
  const axialForce = k * delta_u;
  
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
 * Convert 2D Node Positions to Member Angle
 * 
 * Calculates the angle from horizontal for a member connecting two nodes
 * 
 * @param x1 First node x-coordinate (m)
 * @param y1 First node y-coordinate (m)
 * @param x2 Second node x-coordinate (m)
 * @param y2 Second node y-coordinate (m)
 * 
 * @returns angle in radians (0 to 2π)
 * 
 * Example:
 * const angle = computeAngle2D(0, 0, 5, 5);  // 45 degrees = π/4 radians
 */
export function computeAngle2D(
  x1: number,
  y1: number,
  x2: number,
  y2: number
): number {
  const dx = x2 - x1;
  const dy = y2 - y1;
  return Math.atan2(dy, dx);
}

/**
 * Calculate Member Length from 2D Node Positions
 * 
 * @param x1 First node x-coordinate (m)
 * @param y1 First node y-coordinate (m)
 * @param x2 Second node x-coordinate (m)
 * @param y2 Second node y-coordinate (m)
 * 
 * @returns Length in meters
 * 
 * Example:
 * const L = computeLength2D(0, 0, 3, 4);  // Returns 5.0 (3-4-5 triangle)
 */
export function computeLength2D(
  x1: number,
  y1: number,
  x2: number,
  y2: number
): number {
  const dx = x2 - x1;
  const dy = y2 - y1;
  return Math.sqrt(dx * dx + dy * dy);
}

/**
 * Helper: Multiply two 4×4 matrices
 * C = A × B
 */
function multiplyMatrices4x4(A: number[][], B: number[][]): number[][] {
  const C: number[][] = Array(4)
    .fill(null)
    .map(() => Array(4).fill(0));
  
  for (let i = 0; i < 4; i++) {
    for (let j = 0; j < 4; j++) {
      for (let k = 0; k < 4; k++) {
        C[i][j] += A[i][k] * B[k][j];
      }
    }
  }
  
  return C;
}

/**
 * Helper: Multiply 4×4 matrix by 4×1 vector
 * v = A × u
 */
export function multiplyMatrix4x1(A: number[][], u: number[]): number[] {
  const v = Array(4).fill(0);
  for (let i = 0; i < 4; i++) {
    for (let k = 0; k < 4; k++) {
      v[i] += A[i][k] * u[k];
    }
  }
  return v;
}

/**
 * Helper: Transpose a 4×4 matrix
 */
export function transpose4x4(A: number[][]): number[][] {
  const AT: number[][] = Array(4)
    .fill(null)
    .map(() => Array(4).fill(0));
  
  for (let i = 0; i < 4; i++) {
    for (let j = 0; j < 4; j++) {
      AT[j][i] = A[i][j];
    }
  }
  
  return AT;
}

// ============================================
// EXPORT SUMMARY
// ============================================
// 
// Main Functions:
// 1. computeTruss2DStiffness() → 4×4 matrix (global coordinates)
// 2. computeTruss2DMemberForces() → Axial force, strain, stress
// 3. computeAngle2D() → Member angle from nodes
// 4. computeLength2D() → Member length from nodes
// 
// Status: ✅ Ready for integration
// Next: Create validation tests, then 3D version
