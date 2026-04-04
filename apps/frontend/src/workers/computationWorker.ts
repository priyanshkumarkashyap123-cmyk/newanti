/**
 * Web Worker for Structural Analysis Computation
 *
 * Offloads heavy mathematics from main thread:
 * - Frame assembly (K matrix building)
 * - Matrix operations (solve, invert, transpose)
 * - Modal analysis (eigenvalue decomposition)
 * - Post-processing (stress, displacement interpolation)
 */

import type { WorkerMessage, WorkerResponse } from '../types/worker.types';

// Message handler
self.onmessage = async (event: MessageEvent<WorkerMessage>) => {
  const { id, type, payload } = event.data;

  try {
    let result: any;

    switch (type) {
      case 'ASSEMBLE_FRAME':
        result = assembleFrameMatrix(payload);
        break;

      case 'SOLVE_LINEAR_SYSTEM':
        result = solveLinearSystem(payload);
        break;

      case 'COMPUTE_MODAL_ANALYSIS':
        result = computeModalAnalysis(payload);
        break;

      case 'STRESS_CALCULATION':
        result = calculateStress(payload);
        break;

      case 'INTERPOLATE_DISPLACEMENT':
        result = interpolateDisplacement(payload);
        break;

      case 'MATRIX_OPERATIONS':
        result = performMatrixOp(payload);
        break;

      default:
        throw new Error(`Unknown worker task: ${type}`);
    }

    // Send success response
    const response: WorkerResponse = {
      id,
      status: 'success',
      result,
    };
    self.postMessage(response);
  } catch (error) {
    // Send error response
    const response: WorkerResponse = {
      id,
      status: 'error',
      error: error instanceof Error ? error.message : String(error),
    };
    self.postMessage(response);
  }
};

/**
 * Assemble global stiffness matrix from frame elements
 */
function assembleFrameMatrix(payload: { nodes: any[]; members: any[]; dof_per_node: number }) {
  const { nodes, members, dof_per_node = 6 } = payload;
  const n_dof = nodes.length * dof_per_node;

  // Initialize global matrix K (sparse representation)
  const K: { [key: string]: number } = {};

  for (const member of members) {
    const n1_idx = nodes.findIndex((n) => n.id === member.startNodeId);
    const n2_idx = nodes.findIndex((n) => n.id === member.endNodeId);

    if (n1_idx < 0 || n2_idx < 0) continue;

    // Get element properties
    const E = member.E || 200e9;
    const A = member.A || 0.01;
    const I = member.I || 1e-4;
    const L = computeDistance(nodes[n1_idx], nodes[n2_idx]);

    // Element stiffness matrix for 2-node frame element
    const ke = computeElementStiffness(E, A, I, L, dof_per_node);

    // Assemble into global matrix
    const dof1_start = n1_idx * dof_per_node;
    const dof2_start = n2_idx * dof_per_node;

    for (let i = 0; i < dof_per_node; i++) {
      for (let j = 0; j < dof_per_node; j++) {
        // (1,1) block
        const key1 = `${dof1_start + i},${dof1_start + j}`;
        K[key1] = (K[key1] || 0) + ke[i][j];

        // (1,2) block
        const key2 = `${dof1_start + i},${dof2_start + j}`;
        K[key2] = (K[key2] || 0) + ke[i][dof_per_node + j];

        // (2,1) block
        const key3 = `${dof2_start + i},${dof1_start + j}`;
        K[key3] = (K[key3] || 0) + ke[dof_per_node + i][j];

        // (2,2) block
        const key4 = `${dof2_start + i},${dof2_start + j}`;
        K[key4] = (K[key4] || 0) + ke[dof_per_node + i][dof_per_node + j];
      }
    }
  }

  return {
    type: 'sparse_matrix',
    dimension: n_dof,
    data: K,
    assembly_time_ms: 0,
  };
}

/**
 * Solve linear system Kx = f using Gaussian elimination
 */
function solveLinearSystem(payload: { K: any[]; f: number[]; sparse?: boolean }) {
  const { K, f, sparse = false } = payload;
  const n = f.length;

  // Convert to dense matrix if needed
  const A = Array.isArray(K[0]) ? K.map((row) => [...row]) : sparseToDense(K, n);
  const b = [...f];

  // Forward elimination with partial pivoting
  for (let i = 0; i < n; i++) {
    // Find pivot
    let max_idx = i;
    for (let k = i + 1; k < n; k++) {
      if (Math.abs(A[k][i]) > Math.abs(A[max_idx][i])) {
        max_idx = k;
      }
    }

    // Swap rows
    [A[i], A[max_idx]] = [A[max_idx], A[i]];
    [b[i], b[max_idx]] = [b[max_idx], b[i]];

    // Check singularity
    if (Math.abs(A[i][i]) < 1e-15) {
      throw new Error(`Singular matrix detected at row ${i}`);
    }

    // Eliminate column
    for (let k = i + 1; k < n; k++) {
      const factor = A[k][i] / A[i][i];
      for (let j = i; j < n; j++) {
        A[k][j] -= factor * A[i][j];
      }
      b[k] -= factor * b[i];
    }
  }

  // Back substitution
  const x = new Array(n);
  for (let i = n - 1; i >= 0; i--) {
    x[i] = b[i];
    for (let j = i + 1; j < n; j++) {
      x[i] -= A[i][j] * x[j];
    }
    x[i] /= A[i][i];
  }

  return { solution: x, condition_number: estimateConditionNumber(A) };
}

/**
 * Compute eigenvalues and eigenvectors (power iteration method)
 */
function computeModalAnalysis(payload: { K: number[][]; M: number[][]; num_modes: number }) {
  const { K, M, num_modes } = payload;
  const n = K.length;

  const eigenvalues: number[] = [];
  const eigenvectors: number[][] = [];

  // Inverse iteration starting with random vector
  for (let mode = 0; mode < num_modes; mode++) {
    let v = Array(n)
      .fill(0)
      .map(() => Math.random());
    let lambda = 0;
    const max_iter = 50;
    const tolerance = 1e-8;

    for (let iter = 0; iter < max_iter; iter++) {
      // Solve K*w = M*v (inverse iteration)
      const Mv = matrixVectorProduct(M, v);
      const w = solveLinearSystem({ K, f: Mv }).solution;

      // Rayleigh quotient
      const numerator = dotProduct(v, matrixVectorProduct(K, w));
      const denominator = dotProduct(v, matrixVectorProduct(M, w));
      const lambda_new = numerator / denominator;

      if (Math.abs(lambda_new - lambda) < tolerance) {
        lambda = lambda_new;
        break;
      }

      lambda = lambda_new;
      v = normalize(w);
    }

    eigenvalues.push(lambda);
    eigenvectors.push(normalize(v));
  }

  // Convert to frequencies
  const frequencies = eigenvalues.map((λ) => Math.sqrt(λ) / (2 * Math.PI));
  const periods = frequencies.map((f) => (f > 0 ? 1 / f : Infinity));

  return {
    eigenvalues,
    frequencies,
    periods,
    mode_shapes: eigenvectors,
    n_modes: num_modes,
  };
}

/**
 * Calculate stress at control points
 */
function calculateStress(payload: {
  displacements: { [key: string]: number[] };
  member_forces: { [key: string]: { [key: string]: number } };
  section_properties: { area: number; Ixx: number; Iyy: number; depth: number };
}) {
  const { displacements, member_forces, section_properties } = payload;
  const { area, Ixx, Iyy, depth } = section_properties;

  const stress_points = [];

  for (const [member_id, forces] of Object.entries(member_forces)) {
    const { axial = 0, moment_x = 0, moment_y = 0, shear_y = 0, shear_z = 0 } = forces;

    // Bending stresses
    const sigma_bending_max = (Math.abs(moment_y) / Ixx) * (depth / 2);
    const sigma_axial = axial / area;

    // Maximum stresses
    const sigma_x = sigma_axial + sigma_bending_max;
    const tau_max = Math.max(Math.abs(shear_y) / (0.6 * area), Math.abs(shear_z) / (0.6 * area));

    // Von Mises stress
    const von_mises = Math.sqrt(sigma_x ** 2 + 3 * tau_max ** 2);

    // Principal stresses (2D approximation)
    const principal_1 = sigma_x / 2 + Math.sqrt((sigma_x / 2) ** 2 + tau_max ** 2);
    const principal_3 = sigma_x / 2 - Math.sqrt((sigma_x / 2) ** 2 + tau_max ** 2);

    stress_points.push({
      member_id,
      sigma_x,
      sigma_y: 0,
      sigma_z: 0,
      tau_xy: tau_max,
      von_mises,
      principal_1,
      principal_2: 0,
      principal_3,
      max_shear: Math.abs(principal_1 - principal_3) / 2,
    });
  }

  return { stress_points };
}

/**
 * Interpolate displacement along element
 */
function interpolateDisplacement(payload: {
  node_displacements: any[];
  position_parameter: number; // parameter from 0 to 1
  element_type: string;
}) {
  const { node_displacements, position_parameter: xi, element_type } = payload;

  // Shape functions (linear for 2-node element)
  const N1 = (1 - xi) / 2;
  const N2 = (1 + xi) / 2;

  const disp = {
    dx: N1 * node_displacements[0].dx + N2 * node_displacements[1].dx,
    dy: N1 * node_displacements[0].dy + N2 * node_displacements[1].dy,
    dz: N1 * node_displacements[0].dz + N2 * node_displacements[1].dz,
    rx: N1 * node_displacements[0].rx + N2 * node_displacements[1].rx,
    ry: N1 * node_displacements[0].ry + N2 * node_displacements[1].ry,
    rz: N1 * node_displacements[0].rz + N2 * node_displacements[1].rz,
  };

  return disp;
}

/**
 * Perform matrix operations (multiply, transpose, invert)
 */
function performMatrixOp(payload: {
  operation: 'multiply' | 'transpose' | 'invert' | 'determinant';
  A: number[][];
  B?: number[][];
}) {
  const { operation, A, B } = payload;

  switch (operation) {
    case 'multiply':
      if (!B) throw new Error('B matrix required for multiply');
      return { result: matrixMultiply(A, B) };

    case 'transpose':
      return { result: transpose(A) };

    case 'invert':
      return { result: invertMatrix(A), condition_number: estimateConditionNumber(A) };

    case 'determinant':
      return { determinant: determinant(A) };

    default:
      throw new Error(`Unknown matrix operation: ${operation}`);
  }
}

// ─────────────────────────────────────────────────────────────
// Helper Functions
// ─────────────────────────────────────────────────────────────

function computeDistance(n1: any, n2: any): number {
  return Math.sqrt((n2.x - n1.x) ** 2 + (n2.y - n1.y) ** 2 + (n2.z - n1.z) ** 2);
}

function computeElementStiffness(
  E: number,
  A: number,
  I: number,
  L: number,
  dof: number,
): number[][] {
  const ke = Array(dof * 2)
    .fill(0)
    .map(() => Array(dof * 2).fill(0));

  // 2D frame element stiffness (simplified)
  const EA_L = (E * A) / L;
  const EI_L3 = (E * I) / (L * L * L);
  const EI_L2 = (E * I) / (L * L);

  // Diagonal terms (simplified for 3D: expand as needed)
  ke[0][0] = EA_L; // Axial
  ke[1][1] = 12 * EI_L3; // Shear Y
  ke[2][2] = 12 * EI_L3; // Shear Z
  // Torsion stiffness: GJ/L where G = E/(2(1+ν)), ν ≈ 0.3 for steel
  // Use J (torsional constant) if available, otherwise approximate for solid rectangular: J ≈ a*b³/3
  const poissonRatio = 0.3;
  const G = E / (2 * (1 + poissonRatio)); // Shear modulus
  const J_approx = A > 0 ? (A * A) / (4 * Math.PI * I) * 1e-2 : 1e-5; // Approximate J from A and I
  ke[3][3] = (G * Math.max(J_approx, 1e-8)) / L; // Torsion: GJ/L
  ke[4][4] = 4 * EI_L2; // Moment Y
  ke[5][5] = 4 * EI_L2; // Moment Z

  // Symmetric terms
  ke[0][dof] = -EA_L;
  ke[1][1 + dof] = -12 * EI_L3;
  ke[4][2 + dof] = 2 * EI_L2;

  return ke;
}

function sparseToDense(sparse: any, n: number): number[][] {
  const dense = Array(n)
    .fill(0)
    .map(() => Array(n).fill(0));
  for (const [key, val] of Object.entries(sparse)) {
    const [i, j] = key.split(',').map(Number);
    dense[i][j] = val as number;
  }
  return dense;
}

function matrixVectorProduct(A: number[][], v: number[]): number[] {
  return A.map((row) => row.reduce((sum, val, idx) => sum + val * v[idx], 0));
}

function matrixMultiply(A: number[][], B: number[][]): number[][] {
  const result = Array(A.length)
    .fill(0)
    .map(() => Array(B[0].length).fill(0));
  for (let i = 0; i < A.length; i++) {
    for (let j = 0; j < B[0].length; j++) {
      for (let k = 0; k < B.length; k++) {
        result[i][j] += A[i][k] * B[k][j];
      }
    }
  }
  return result;
}

function transpose(A: number[][]): number[][] {
  return A[0].map((_, j) => A.map((row) => row[j]));
}

function dotProduct(a: number[], b: number[]): number {
  return a.reduce((sum, val, idx) => sum + val * b[idx], 0);
}

function normalize(v: number[]): number[] {
  const norm = Math.sqrt(v.reduce((sum, val) => sum + val * val, 0));
  return v.map((val) => val / norm);
}

function invertMatrix(A: number[][]): number[][] {
  const n = A.length;
  const aug = A.map((row, i) => [
    ...row,
    ...Array(n)
      .fill(0)
      .map((_, j) => (i === j ? 1 : 0)),
  ]);

  // Gaussian elimination
  for (let i = 0; i < n; i++) {
    // Find pivot
    let max_idx = i;
    for (let k = i + 1; k < n; k++) {
      if (Math.abs(aug[k][i]) > Math.abs(aug[max_idx][i])) max_idx = k;
    }
    [aug[i], aug[max_idx]] = [aug[max_idx], aug[i]];

    // Normalize pivot row
    const pivot = aug[i][i];
    for (let j = 0; j < 2 * n; j++) aug[i][j] /= pivot;

    // Eliminate column
    for (let k = 0; k < n; k++) {
      if (k !== i) {
        const factor = aug[k][i];
        for (let j = 0; j < 2 * n; j++) aug[k][j] -= factor * aug[i][j];
      }
    }
  }

  return aug.map((row) => row.slice(n));
}

function determinant(A: number[][]): number {
  const n = A.length;
  if (n === 1) return A[0][0];
  if (n === 2) return A[0][0] * A[1][1] - A[0][1] * A[1][0];

  let det = 0;
  for (let j = 0; j < n; j++) {
    det +=
      (j % 2 === 0 ? 1 : -1) *
      A[0][j] *
      determinant(A.slice(1).map((row) => [...row.slice(0, j), ...row.slice(j + 1)]));
  }
  return det;
}

function estimateConditionNumber(A: number[][]): number {
  // Simplified: return norm ratio
  const norm_A = Math.sqrt(A.flat().reduce((sum, val) => sum + val * val, 0));
  return norm_A > 0 ? norm_A / 1e-10 : Infinity;
}
