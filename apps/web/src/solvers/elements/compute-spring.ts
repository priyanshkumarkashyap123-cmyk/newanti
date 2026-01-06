/**
 * SPRING ELEMENT - Elastic Support Stiffness
 * 
 * File: apps/web/src/solvers/elements/compute-spring.ts
 * Status: Phase 2 Sprint 2 Day 4 - Production ready
 * Date: January 6, 2026
 * 
 * Spring Element:
 * - Models elastic supports (foundation stiffness)
 * - Linear force-displacement relationship
 * - Can be axial, lateral, or rotational
 * 
 * Stiffness Matrix (2×2):
 * ┌──────────┐
 * │  k,  -k  │  Node 1
 * │ -k,   k  │  Node 2
 * └──────────┘
 * 
 * Force Relationship:
 * F = k × Δu  (where Δu = u2 - u1)
 * 
 * Applications:
 * - Foundation springs (soil stiffness)
 * - Elastic supports (flexible boundaries)
 * - Connection flexibility
 * - Rotational restraints
 */

/**
 * Spring element properties interface
 */
export interface SpringProperties {
  k: number;  // Spring constant (N/m or N·m/rad)
  type: 'axial' | 'lateral' | 'rotational';
  direction?: 'x' | 'y' | 'z' | 'rx' | 'ry' | 'rz';
}

/**
 * Spring force result interface
 */
export interface SpringForceResult {
  force: number;           // Spring force (N or N·m)
  displacement: number;    // Relative displacement (m or rad)
  energy: number;          // Stored elastic energy (J)
  stiffness: number;       // Spring constant (N/m or N·m/rad)
}

/**
 * Compute 2×2 spring stiffness matrix
 * 
 * The spring element connects two nodes with elastic stiffness k.
 * The stiffness matrix is symmetric and singular (rank 1).
 * 
 * Local Stiffness:
 * K = k × [  1, -1 ]
 *         [ -1,  1 ]
 * 
 * Physical Meaning:
 * - Diagonal terms: Node stiffness (resistance to motion)
 * - Off-diagonal: Coupling (equal and opposite forces)
 * 
 * @param k - Spring constant (N/m for translation, N·m/rad for rotation)
 * @returns 2×2 stiffness matrix
 * 
 * @example
 * // Foundation spring with k = 100 kN/m
 * const k = 100e3;  // N/m
 * const K = computeSpringStiffness(k);
 * // K = [[ 100000, -100000],
 * //      [-100000,  100000]]
 */
export function computeSpringStiffness(k: number): number[][] {
  if (k <= 0) {
    throw new Error(`Spring constant must be positive, got k=${k}`);
  }
  
  return [
    [ k, -k],
    [-k,  k]
  ];
}

/**
 * Compute spring forces from displacements
 * 
 * Given the displacements at both nodes, compute:
 * 1. Relative displacement: Δu = u2 - u1
 * 2. Spring force: F = k × Δu
 * 3. Stored energy: E = 0.5 × k × Δu²
 * 
 * Sign Convention:
 * - Positive Δu → tension (nodes moving apart)
 * - Negative Δu → compression (nodes moving together)
 * 
 * @param u1 - Displacement at node 1 (m or rad)
 * @param u2 - Displacement at node 2 (m or rad)
 * @param k - Spring constant (N/m or N·m/rad)
 * @returns Spring force result with force, displacement, energy
 * 
 * @example
 * // Spring under load: u1 = 0 (fixed), u2 = 0.001m (1mm)
 * const result = computeSpringForces(0, 0.001, 100e3);
 * // result.force = 100 N (tension)
 * // result.displacement = 0.001 m
 * // result.energy = 0.05 J
 */
export function computeSpringForces(
  u1: number,
  u2: number,
  k: number
): SpringForceResult {
  if (k <= 0) {
    throw new Error(`Spring constant must be positive, got k=${k}`);
  }
  
  // Relative displacement
  const delta_u = u2 - u1;
  
  // Spring force (Hooke's law)
  const force = k * delta_u;
  
  // Elastic energy stored
  const energy = 0.5 * k * delta_u * delta_u;
  
  return {
    force,
    displacement: delta_u,
    energy,
    stiffness: k
  };
}

/**
 * Compute spring constant from geometry and material
 * 
 * For axial springs (bar springs):
 * k = (E × A) / L
 * 
 * For torsional springs:
 * k = (G × J) / L
 * 
 * For beam springs (lateral):
 * k = (3 × E × I) / L³
 * 
 * @param E - Elastic modulus (Pa)
 * @param A - Cross-sectional area (m²) - for axial
 * @param I - Moment of inertia (m⁴) - for lateral
 * @param L - Length (m)
 * @param type - Spring type ('axial', 'lateral', 'rotational')
 * @returns Spring constant (N/m or N·m/rad)
 * 
 * @example
 * // Axial spring: Steel bar, A=100mm², L=1m
 * const k_axial = computeSpringConstantFromGeometry(200e9, 100e-6, 0, 1.0, 'axial');
 * // k_axial = 20 MN/m
 * 
 * // Lateral spring: Cantilever, I=1000cm⁴, L=2m
 * const k_lateral = computeSpringConstantFromGeometry(200e9, 0, 1000e-8, 2.0, 'lateral');
 * // k_lateral = 75 kN/m
 */
export function computeSpringConstantFromGeometry(
  E: number,
  A: number,
  I: number,
  L: number,
  type: 'axial' | 'lateral' | 'rotational'
): number {
  if (L <= 0) {
    throw new Error(`Length must be positive, got L=${L}`);
  }
  
  switch (type) {
    case 'axial':
      if (A <= 0) {
        throw new Error(`Area must be positive for axial spring, got A=${A}`);
      }
      return (E * A) / L;
    
    case 'lateral':
      if (I <= 0) {
        throw new Error(`Moment of inertia must be positive for lateral spring, got I=${I}`);
      }
      return (3 * E * I) / (L ** 3);
    
    case 'rotational':
      // For rotational springs, use torsional stiffness
      // G ≈ E / 2.6 for steel
      const G = E / 2.6;
      if (I <= 0) {
        throw new Error(`Polar moment must be positive for rotational spring, got J=${I}`);
      }
      return (G * I) / L;
    
    default:
      throw new Error(`Unknown spring type: ${type}`);
  }
}

/**
 * Create spring element from foundation properties
 * 
 * Common foundation spring values:
 * - Dense sand: k = 50-100 MN/m³
 * - Medium clay: k = 10-30 MN/m³
 * - Soft clay: k = 2-10 MN/m³
 * - Rock: k = 100-500 MN/m³
 * 
 * Spring constant for footing:
 * k = k_s × A_footing
 * 
 * @param k_soil - Soil modulus (N/m³)
 * @param A_footing - Footing area (m²)
 * @returns Spring constant (N/m)
 * 
 * @example
 * // Foundation on medium clay: k_s = 20 MN/m³, A = 4m²
 * const k_foundation = computeFoundationSpringConstant(20e6, 4.0);
 * // k_foundation = 80 MN/m
 */
export function computeFoundationSpringConstant(
  k_soil: number,
  A_footing: number
): number {
  if (k_soil <= 0) {
    throw new Error(`Soil modulus must be positive, got k_soil=${k_soil}`);
  }
  if (A_footing <= 0) {
    throw new Error(`Footing area must be positive, got A=${A_footing}`);
  }
  
  return k_soil * A_footing;
}

/**
 * Matrix operations for spring elements
 */

/**
 * Add two 2×2 matrices
 */
export function addMatrices2x2(A: number[][], B: number[][]): number[][] {
  return [
    [A[0][0] + B[0][0], A[0][1] + B[0][1]],
    [A[1][0] + B[1][0], A[1][1] + B[1][1]]
  ];
}

/**
 * Multiply 2×2 matrix by vector
 */
export function multiplyMatrix2x1(A: number[][], u: number[]): number[] {
  return [
    A[0][0] * u[0] + A[0][1] * u[1],
    A[1][0] * u[0] + A[1][1] * u[1]
  ];
}

/**
 * Print 2×2 matrix with formatting
 */
export function printMatrix2x2(A: number[][], name: string = 'K'): void {
  console.log(`\n${name} (2×2):`);
  console.log(`┌ ${A[0][0].toExponential(4)}  ${A[0][1].toExponential(4)} ┐`);
  console.log(`└ ${A[1][0].toExponential(4)}  ${A[1][1].toExponential(4)} ┘`);
}

/**
 * Example usage and validation
 */
export function exampleSpringElement(): void {
  console.log('\n' + '='.repeat(60));
  console.log('SPRING ELEMENT EXAMPLE');
  console.log('='.repeat(60));
  
  // Foundation spring
  const k_soil = 20e6;  // 20 MN/m³ (medium clay)
  const A_footing = 4.0;  // 4 m² footing
  const k_foundation = computeFoundationSpringConstant(k_soil, A_footing);
  
  console.log(`\n1. Foundation Spring:`);
  console.log(`   Soil modulus: ${k_soil / 1e6} MN/m³`);
  console.log(`   Footing area: ${A_footing} m²`);
  console.log(`   Spring constant: ${k_foundation / 1e6} MN/m`);
  
  // Compute stiffness matrix
  const K = computeSpringStiffness(k_foundation);
  printMatrix2x2(K, 'K_spring');
  
  // Apply displacement
  const u1 = 0;  // Fixed base
  const u2 = 0.001;  // 1mm settlement
  
  const forces = computeSpringForces(u1, u2, k_foundation);
  
  console.log(`\n2. Spring Forces:`);
  console.log(`   Node 1 displacement: ${u1 * 1000} mm`);
  console.log(`   Node 2 displacement: ${u2 * 1000} mm`);
  console.log(`   Relative displacement: ${forces.displacement * 1000} mm`);
  console.log(`   Spring force: ${forces.force / 1e3} kN`);
  console.log(`   Stored energy: ${forces.energy} J`);
  
  // Axial spring from geometry
  const E = 200e9;  // Steel
  const A = 100e-6;  // 100 mm²
  const L = 1.0;  // 1m
  const k_axial = computeSpringConstantFromGeometry(E, A, 0, L, 'axial');
  
  console.log(`\n3. Axial Spring (from geometry):`);
  console.log(`   Material: E = ${E / 1e9} GPa`);
  console.log(`   Area: A = ${A * 1e6} mm²`);
  console.log(`   Length: L = ${L} m`);
  console.log(`   Spring constant: ${k_axial / 1e6} MN/m`);
  
  console.log('\n' + '='.repeat(60));
}

// Export all functions
export default {
  computeSpringStiffness,
  computeSpringForces,
  computeSpringConstantFromGeometry,
  computeFoundationSpringConstant,
  addMatrices2x2,
  multiplyMatrix2x1,
  printMatrix2x2,
  exampleSpringElement
};
