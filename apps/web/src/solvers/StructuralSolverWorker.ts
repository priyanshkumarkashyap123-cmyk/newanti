/**
 * STRUCTURAL SOLVER WORKER - Multi-Element Assembly Framework
 * 
 * File: apps/web/src/solvers/StructuralSolverWorker.ts
 * Status: Phase 2 Sprint 1 Day 3 - Updated for mixed element types
 * Date: January 8, 2026
 * 
 * Enhancements:
 * - Element type discriminator (FRAME, TRUSS, SPRING, CABLE)
 * - Dynamic stiffness computation based on element type
 * - Unified assembly algorithm for mixed element structures
 * - Support for 2D and 3D analysis
 * 
 * Element Types:
 * ┌─────────────────┬──────────┬──────────────────┬────────────────┐
 * │ Element Type    │ 2D DOF   │ 3D DOF           │ Stiffness      │
 * ├─────────────────┼──────────┼──────────────────┼────────────────┤
 * │ Frame 2D        │ 3/node   │ N/A              │ 6×6 (2 nodes)  │
 * │ Frame 3D        │ N/A      │ 6/node           │ 12×12 (2 nodes)│
 * │ Truss 2D        │ 2/node   │ N/A              │ 4×4 (2 nodes)  │
 * │ Truss 3D        │ N/A      │ 3/node           │ 6×6 (2 nodes)  │
 * │ Spring          │ 1/node   │ 1 or 3/node      │ 2×2 (2 nodes)  │
 * │ Cable           │ varies   │ varies           │ Framework      │
 * └─────────────────┴──────────┴──────────────────┴────────────────┘
 */

import { multiply, lusolve, transpose, zeros } from 'mathjs';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

/**
 * Supported element types in structural analysis
 */
type ElementType = 'FRAME_2D' | 'FRAME_3D' | 'TRUSS_2D' | 'TRUSS_3D' | 'SPRING' | 'CABLE';

/**
 * Analysis type determines DOF and element selection
 */
type AnalysisType = '2D' | '3D';

/**
 * Member definition with element type
 */
interface Member {
  id: string;
  type: ElementType;
  nodes: [number, number];  // [node1_id, node2_id]
  material: {
    E: number;  // Young's modulus (Pa)
    ρ?: number;  // Density (kg/m³)
  };
  geometry: {
    A?: number;  // Cross-sectional area (m²)
    Iy?: number;  // Second moment of inertia Y (m⁴) - for frames
    Iz?: number;  // Second moment of inertia Z (m⁴) - for frames
    J?: number;  // Polar moment (m⁴) - for torsion
    k?: number;  // Spring constant (N/m)
  };
  x1?: number;  // Start node X coordinate
  y1?: number;  // Start node Y coordinate
  z1?: number;  // Start node Z coordinate (3D)
  x2?: number;  // End node X coordinate
  y2?: number;  // End node Y coordinate
  z2?: number;  // End node Z coordinate (3D)
}

/**
 * Node definition
 */
interface Node {
  id: number;
  x: number;
  y: number;
  z?: number;
  boundary: {
    fixed_x?: boolean;
    fixed_y?: boolean;
    fixed_z?: boolean;
    fixed_rx?: boolean;  // Rotation about X
    fixed_ry?: boolean;  // Rotation about Y
    fixed_rz?: boolean;  // Rotation about Z
  };
}

/**
 * Load definition
 */
interface Load {
  node: number;
  Fx?: number;  // Force in X direction (N)
  Fy?: number;  // Force in Y direction (N)
  Fz?: number;  // Force in Z direction (N)
  Mx?: number;  // Moment about X (N·m)
  My?: number;  // Moment about Y (N·m)
  Mz?: number;  // Moment about Z (N·m)
}

/**
 * Structural analysis input
 */
interface StructuralAnalysisInput {
  type: AnalysisType;
  nodes: Node[];
  members: Member[];
  loads: Load[];
  title?: string;
}

/**
 * Analysis result for a single element
 */
interface ElementResult {
  member_id: string;
  type: ElementType;
  axial_force?: number;
  shear_y?: number;
  shear_z?: number;
  torsion?: number;
  moment_y?: number;
  moment_z?: number;
  strain?: number;
  stress?: number;
}

/**
 * Full analysis results
 */
interface AnalysisResult {
  title?: string;
  type: AnalysisType;
  convergence: boolean;
  iterations: number;
  displacements: Map<number, number[]>;  // node_id → [u, v, w, rx, ry, rz]
  reactions: Map<number, number[]>;  // node_id → [Rx, Ry, Rz, Mx, My, Mz]
  member_forces: ElementResult[];
  max_displacement: number;
  max_stress: number;
  execution_time_ms: number;
}

// ============================================================================
// ELEMENT STIFFNESS COMPUTATION
// ============================================================================

/**
 * Compute element stiffness matrix based on element type
 * 
 * Dispatch logic:
 * - FRAME_2D: 6×6 stiffness (2 nodes, 3 DOF each: u, v, θ)
 * - FRAME_3D: 12×12 stiffness (2 nodes, 6 DOF each: u, v, w, rx, ry, rz)
 * - TRUSS_2D: 4×4 stiffness (2 nodes, 2 DOF each: u, v)
 * - TRUSS_3D: 6×6 stiffness (2 nodes, 3 DOF each: u, v, w)
 * - SPRING: 2×2 stiffness (2 nodes, 1 DOF: axial)
 * - CABLE: Framework (nonlinear, deferred to Phase 3)
 */
function computeElementStiffness(member: Member): number[][] {
  const {type, material: {E}, geometry: {A = 0, Iy = 0, Iz = 0, J = 0, k = 0}, x1 = 0, y1 = 0, z1 = 0, x2 = 0, y2 = 0, z2 = 0} = member;
  
  // Calculate member length
  let L = 0;
  if (type === 'TRUSS_2D' || type === 'FRAME_2D') {
    L = Math.sqrt((x2 - x1)**2 + (y2 - y1)**2);
  } else if (type === 'TRUSS_3D' || type === 'FRAME_3D') {
    L = Math.sqrt((x2 - x1)**2 + (y2 - y1)**2 + (z2 - z1)**2);
  }
  
  switch (type) {
    case 'FRAME_2D':
      return computeFrame2DStiffness(E, A, Iy, L, x1, y1, x2, y2);
    
    case 'FRAME_3D':
      return computeFrame3DStiffness(E, A, Iy, Iz, J, L, x1, y1, z1, x2, y2, z2);
    
    case 'TRUSS_2D':
      return computeTruss2DStiffness(E, A, L, x1, y1, x2, y2);
    
    case 'TRUSS_3D':
      return computeTruss3DStiffness(E, A, L, x1, y1, z1, x2, y2, z2);
    
    case 'SPRING':
      return computeSpringStiffness(k);
    
    case 'CABLE':
      throw new Error('CABLE elements not yet implemented (Phase 3)');
    
    default:
      throw new Error(`Unknown element type: ${type}`);
  }
}

/**
 * 2D Frame element stiffness matrix (6×6)
 * Local stiffness with direction cosines rotation
 */
function computeFrame2DStiffness(E: number, A: number, I: number, L: number, x1: number, y1: number, x2: number, y2: number): number[][] {
  if (L === 0) throw new Error('Member length cannot be zero');
  
  // Direction cosines
  const cx = (x2 - x1) / L;
  const cy = (y2 - y1) / L;
  
  // Local stiffness matrix (6×6)
  const EA_L = E * A / L;
  const EI_L = E * I / L;
  const K_local = [
    [EA_L,          0,           0,        -EA_L,        0,           0        ],
    [0,    12*EI_L/L**2,   6*EI_L/L,      0,  -12*EI_L/L**2,   6*EI_L/L    ],
    [0,      6*EI_L/L,    4*EI_L,         0,   -6*EI_L/L,     2*EI_L      ],
    [-EA_L,         0,           0,        EA_L,        0,           0        ],
    [0,   -12*EI_L/L**2,  -6*EI_L/L,      0,   12*EI_L/L**2,  -6*EI_L/L    ],
    [0,      6*EI_L/L,    2*EI_L,         0,   -6*EI_L/L,     4*EI_L      ]
  ];
  
  // Transformation matrix (2D rotation)
  const T = [
    [cx, cy, 0, 0,  0,  0],
    [-cy, cx, 0, 0,  0,  0],
    [0,  0,  1, 0,  0,  0],
    [0,  0,  0, cx, cy, 0],
    [0,  0,  0, -cy, cx, 0],
    [0,  0,  0, 0,  0,  1]
  ];
  
  // K_global = T^T × K_local × T
  const K_global = multiply(multiply(transpose(T), K_local), T);
  
  return K_global as number[][];
}

/**
 * 3D Frame element stiffness matrix (12×12)
 * Includes axial, shear (2 directions), torsion, bending (2 directions)
 */
function computeFrame3DStiffness(E: number, A: number, Iy: number, Iz: number, J: number, L: number, x1: number, y1: number, z1: number, x2: number, y2: number, z2: number, nu: number = 0.3): number[][] {
  if (L === 0) throw new Error('Member length cannot be zero');
  
  // Direction cosines
  const cx = (x2 - x1) / L;
  const cy = (y2 - y1) / L;
  const cz = (z2 - z1) / L;
  
  // Local stiffness (12×12) - all effects
  const EA_L = E * A / L;
  // G = E / (2*(1+ν)), use provided Poisson's ratio or default 0.3 (steel)
  const G = E / (2 * (1 + nu));
  const GJ_L = G * J / L;
  const EIy_L = E * Iy / L;
  const EIz_L = E * Iz / L;
  
  // Create 12×12 local stiffness matrix
  const K_local = zeros(12, 12) as number[][];
  
  // Axial (X-X terms)
  K_local[0][0] = EA_L;
  K_local[0][6] = -EA_L;
  K_local[6][0] = -EA_L;
  K_local[6][6] = EA_L;
  
  // Torsion (RX-RX terms)
  K_local[3][3] = GJ_L;
  K_local[3][9] = -GJ_L;
  K_local[9][3] = -GJ_L;
  K_local[9][9] = GJ_L;
  
  // Bending in Y-Z plane
  K_local[1][1] = 12*EIz_L/L**2;
  K_local[1][5] = 6*EIz_L/L;
  K_local[1][7] = -12*EIz_L/L**2;
  K_local[1][11] = 6*EIz_L/L;
  
  K_local[2][2] = 12*EIy_L/L**2;
  K_local[2][4] = -6*EIy_L/L;
  K_local[2][8] = -12*EIy_L/L**2;
  K_local[2][10] = -6*EIy_L/L;
  
  K_local[4][4] = 4*EIy_L;
  K_local[4][2] = -6*EIy_L/L;
  K_local[4][10] = 2*EIy_L;
  K_local[4][8] = 6*EIy_L/L;
  
  K_local[5][5] = 4*EIz_L;
  K_local[5][1] = 6*EIz_L/L;
  K_local[5][11] = 2*EIz_L;
  K_local[5][7] = -6*EIz_L/L;
  
  // Node 2 bending block (rows/cols 7-11) - must be explicit, not derived from symmetry
  K_local[7][7] = 12*EIz_L/L**2;
  K_local[7][11] = -6*EIz_L/L;
  K_local[8][8] = 12*EIy_L/L**2;
  K_local[8][10] = 6*EIy_L/L;
  K_local[10][10] = 4*EIy_L;
  K_local[11][11] = 4*EIz_L;
  
  // Symmetric terms (other half of matrix)
  for (let i = 0; i < 12; i++) {
    for (let j = i + 1; j < 12; j++) {
      K_local[j][i] = K_local[i][j];
    }
  }
  
  // Create 12×12 transformation matrix (3D rotation)
  const T = zeros(12, 12) as number[][];
  
  // Calculate perpendicular vectors (orthonormal basis)
  let px = 0, py = 0, pz = 0;
  if (Math.abs(cx) <= 0.9) {
    const ref = [1, 0, 0];
    [px, py, pz] = crossProduct([cx, cy, cz], ref);
  } else {
    const ref = [0, 1, 0];
    [px, py, pz] = crossProduct([cx, cy, cz], ref);
  }
  const p_mag = Math.sqrt(px**2 + py**2 + pz**2);
  [px, py, pz] = [px/p_mag, py/p_mag, pz/p_mag];
  
  const [qx, qy, qz] = crossProduct([cx, cy, cz], [px, py, pz]);
  
  // Fill transformation matrix with 3×3 rotation blocks (all 4 diagonal blocks)
  const rot_blocks = [
    [[cx, cy, cz], [px, py, pz], [qx, qy, qz]]
  ];
  
  for (let i = 0; i < 4; i++) {
    for (let j = 0; j < 3; j++) {
      for (let k = 0; k < 3; k++) {
        T[i*3 + j][i*3 + k] = rot_blocks[0][j][k];
      }
    }
  }
  
  // K_global = T^T × K_local × T
  const K_global = multiply(multiply(transpose(T), K_local), T);
  
  return K_global as number[][];
}

/**
 * 2D Truss element stiffness matrix (4×4)
 * Axial-only element with direction cosines
 */
function computeTruss2DStiffness(E: number, A: number, L: number, x1: number, y1: number, x2: number, y2: number): number[][] {
  if (L === 0 || A === 0) throw new Error('Invalid truss geometry');
  
  // Direction cosines
  const cx = (x2 - x1) / L;
  const cy = (y2 - y1) / L;
  
  // Local stiffness (4×4)
  const EA_L = E * A / L;
  const K_local = [
    [EA_L,  0, -EA_L,  0],
    [0,     0,   0,    0],
    [-EA_L, 0,  EA_L,  0],
    [0,     0,   0,    0]
  ];
  
  // Transformation matrix (2D rotation, axial only)
  const T = [
    [cx, cy,  0,  0],
    [-cy, cx, 0,  0],
    [0,  0,  cx, cy],
    [0,  0, -cy, cx]
  ];
  
  // K_global = T^T × K_local × T
  const K_global = multiply(multiply(transpose(T), K_local), T);
  
  return K_global as number[][];
}

/**
 * 3D Truss element stiffness matrix (6×6)
 * Axial-only element with 3D direction cosines and orthonormal basis
 */
function computeTruss3DStiffness(E: number, A: number, L: number, x1: number, y1: number, z1: number, x2: number, y2: number, z2: number): number[][] {
  if (L === 0 || A === 0) throw new Error('Invalid truss geometry');
  
  // Direction cosines
  const cx = (x2 - x1) / L;
  const cy = (y2 - y1) / L;
  const cz = (z2 - z1) / L;
  
  // Local stiffness (6×6)
  const EA_L = E * A / L;
  const K_local = [
    [EA_L,  0,  0, -EA_L,  0,  0],
    [0,     0,  0,   0,    0,  0],
    [0,     0,  0,   0,    0,  0],
    [-EA_L, 0,  0,  EA_L,  0,  0],
    [0,     0,  0,   0,    0,  0],
    [0,     0,  0,   0,    0,  0]
  ];
  
  // Calculate perpendicular vectors
  let px = 0, py = 0, pz = 0;
  if (Math.abs(cx) <= 0.9) {
    const ref = [1, 0, 0];
    [px, py, pz] = crossProduct([cx, cy, cz], ref);
  } else {
    const ref = [0, 1, 0];
    [px, py, pz] = crossProduct([cx, cy, cz], ref);
  }
  const p_mag = Math.sqrt(px**2 + py**2 + pz**2);
  [px, py, pz] = [px/p_mag, py/p_mag, pz/p_mag];
  
  const [qx, qy, qz] = crossProduct([cx, cy, cz], [px, py, pz]);
  
  // Transformation matrix (3D rotation, 6×6 with 3×3 blocks)
  const T = [
    [cx, cy, cz,  0,  0,  0],
    [px, py, pz,  0,  0,  0],
    [qx, qy, qz,  0,  0,  0],
    [0,  0,  0,  cx, cy, cz],
    [0,  0,  0,  px, py, pz],
    [0,  0,  0,  qx, qy, qz]
  ];
  
  // K_global = T^T × K_local × T
  const K_global = multiply(multiply(transpose(T), K_local), T);
  
  return K_global as number[][];
}

/**
 * Spring element stiffness matrix (2×2)
 * Simple diagonal spring: K = [k, -k; -k, k]
 */
function computeSpringStiffness(k: number): number[][] {
  return [
    [k, -k],
    [-k, k]
  ];
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Calculate cross product of two 3D vectors
 */
function crossProduct(a: number[], b: number[]): number[] {
  return [
    a[1]*b[2] - a[2]*b[1],
    a[2]*b[0] - a[0]*b[2],
    a[0]*b[1] - a[1]*b[0]
  ];
}

/**
 * Determine degrees of freedom per node based on analysis type
 */
function getDOFPerNode(type: AnalysisType): number {
  return type === '2D' ? 3 : 6;  // 2D: u,v,θ; 3D: u,v,w,rx,ry,rz
}

/**
 * Determine global DOF index for a node and local DOF
 * 
 * Example (2D analysis):
 * - Node 0: global DOF 0,1,2 (u, v, θ)
 * - Node 1: global DOF 3,4,5 (u, v, θ)
 * - Node 2: global DOF 6,7,8 (u, v, θ)
 */
function getGlobalDOFIndex(node_id: number, local_dof: number, dof_per_node: number): number {
  return node_id * dof_per_node + local_dof;
}

// ============================================================================
// MAIN SOLVER
// ============================================================================

/**
 * Structural analysis with multi-element assembly
 * 
 * Algorithm:
 * 1. Initialize global stiffness matrix
 * 2. For each member:
 *    a. Compute element stiffness (dispatch by type)
 *    b. Assemble into global stiffness matrix
 * 3. Apply boundary conditions
 * 4. Solve for displacements
 * 5. Compute reactions and member forces
 */
export async function solveStructure(input: StructuralAnalysisInput): Promise<AnalysisResult> {
  const start_time = Date.now();
  
  console.log(`\n[STRUCTURAL SOLVER] ${input.title || 'Untitled'}`);
  console.log(`Analysis type: ${input.type} | Nodes: ${input.nodes.length} | Members: ${input.members.length}`);
  
  const dof_per_node = getDOFPerNode(input.type);
  const total_dof = input.nodes.length * dof_per_node;
  
  // Initialize global stiffness matrix
  const K_global = zeros(total_dof, total_dof) as number[][];
  
  // Assemble stiffness from all elements
  console.log(`\n[ASSEMBLY] Creating ${total_dof}×${total_dof} global stiffness matrix`);
  
  for (const member of input.members) {
    console.log(`  Assembling ${member.type}: ${member.id}`);
    
    const K_element = computeElementStiffness(member);
    const n1 = member.nodes[0];
    const n2 = member.nodes[1];
    
    // Assemble element into global matrix
    // DOF indices must be concatenated [node1_dofs..., node2_dofs...]
    // NOT interleaved, to match element stiffness matrix ordering
    const dof_indices = [];
    for (let i = 0; i < dof_per_node; i++) {
      dof_indices.push(getGlobalDOFIndex(n1, i, dof_per_node));
    }
    for (let i = 0; i < dof_per_node; i++) {
      dof_indices.push(getGlobalDOFIndex(n2, i, dof_per_node));
    }
    
    for (let i = 0; i < dof_indices.length; i++) {
      for (let j = 0; j < dof_indices.length; j++) {
        K_global[dof_indices[i]][dof_indices[j]] += K_element[i][j];
      }
    }
  }
  
  // Apply boundary conditions and loads
  const F_global = zeros(total_dof, 1) as number[][];
  const is_constrained = new Array(total_dof).fill(false);
  
  for (const node of input.nodes) {
    const {boundary} = node;
    const dof_offset = node.id * dof_per_node;
    
    if (input.type === '2D') {
      if (boundary.fixed_x) is_constrained[dof_offset] = true;
      if (boundary.fixed_y) is_constrained[dof_offset + 1] = true;
      if (boundary.fixed_rz) is_constrained[dof_offset + 2] = true;
    } else {
      if (boundary.fixed_x) is_constrained[dof_offset] = true;
      if (boundary.fixed_y) is_constrained[dof_offset + 1] = true;
      if (boundary.fixed_z) is_constrained[dof_offset + 2] = true;
      if (boundary.fixed_rx) is_constrained[dof_offset + 3] = true;
      if (boundary.fixed_ry) is_constrained[dof_offset + 4] = true;
      if (boundary.fixed_rz) is_constrained[dof_offset + 5] = true;
    }
  }
  
  // Apply loads
  for (const load of input.loads) {
    const dof_offset = load.node * dof_per_node;
    if (load.Fx) F_global[dof_offset][0] += load.Fx;
    if (load.Fy) F_global[dof_offset + 1][0] += load.Fy;
    if (input.type === '3D' && load.Fz) F_global[dof_offset + 2][0] += load.Fz;
    // Apply moment loads (previously silently dropped)
    if (input.type === '2D' && load.Mz && dof_per_node >= 3) {
      F_global[dof_offset + 2][0] += load.Mz;
    }
    if (input.type === '3D') {
      if (load.Mx && dof_per_node >= 4) F_global[dof_offset + 3][0] += load.Mx;
      if (load.My && dof_per_node >= 5) F_global[dof_offset + 4][0] += load.My;
      if (load.Mz && dof_per_node >= 6) F_global[dof_offset + 5][0] += load.Mz;
    }
  }
  
  // Solve for displacements
  console.log(`\n[SOLUTION] Solving system of ${total_dof} equations`);
  
  // Remove constrained DOF (reduction method)
  const free_dof = [];
  for (let i = 0; i < total_dof; i++) {
    if (!is_constrained[i]) free_dof.push(i);
  }
  
  const K_reduced = zeros(free_dof.length, free_dof.length) as number[][];
  const F_reduced = zeros(free_dof.length, 1) as number[][];
  
  for (let i = 0; i < free_dof.length; i++) {
    for (let j = 0; j < free_dof.length; j++) {
      K_reduced[i][j] = K_global[free_dof[i]][free_dof[j]];
    }
    F_reduced[i][0] = F_global[free_dof[i]][0];
  }
  
  const u_reduced = lusolve(K_reduced, F_reduced) as number[][];
  
  // Expand solution to full system
  const u_global = zeros(total_dof, 1) as number[][];
  for (let i = 0; i < free_dof.length; i++) {
    u_global[free_dof[i]][0] = u_reduced[i][0];
  }
  
  // Extract results
  const displacements = new Map<number, number[]>();
  const member_forces: ElementResult[] = [];
  
  for (const node of input.nodes) {
    const dof_offset = node.id * dof_per_node;
    const disp = [];
    for (let i = 0; i < dof_per_node; i++) {
      disp.push(u_global[dof_offset + i][0]);
    }
    displacements.set(node.id, disp);
  }
  
  // Compute member forces
  for (const member of input.members) {
    const n1 = member.nodes[0];
    const n2 = member.nodes[1];
    const u1 = displacements.get(n1) || [];
    const u2 = displacements.get(n2) || [];
    
    const force_result: ElementResult = {
      member_id: member.id,
      type: member.type
    };
    
    // Compute member forces based on element type
    if (member.type === 'TRUSS_2D' || member.type === 'TRUSS_3D') {
      const L = member.type === 'TRUSS_2D' 
        ? Math.sqrt((member.x2! - member.x1!)** 2 + (member.y2! - member.y1!)** 2)
        : Math.sqrt((member.x2! - member.x1!)** 2 + (member.y2! - member.y1!)** 2 + (member.z2! - member.z1!)** 2);
      
      // Project relative displacement along member axis for correct axial elongation
      const cx = (member.x2! - member.x1!) / L;
      const cy = (member.y2! - member.y1!) / L;
      const cz = ((member.z2 || 0) - (member.z1 || 0)) / L;
      const u_elongation = (u2[0] - u1[0]) * cx + (u2[1] - u1[1]) * cy + ((u2[2] || 0) - (u1[2] || 0)) * cz;
      force_result.axial_force = (member.material.E * member.geometry.A! / L) * u_elongation;
      force_result.strain = u_elongation / L;
      force_result.stress = force_result.axial_force / member.geometry.A!;
    }
    
    member_forces.push(force_result);
  }
  
  // Compute reactions
  const reactions = new Map<number, number[]>();
  const R_global = multiply(K_global, u_global);
  
  for (const node of input.nodes) {
    const dof_offset = node.id * dof_per_node;
    const react = [];
    for (let i = 0; i < dof_per_node; i++) {
      const F_applied = F_global[dof_offset + i][0];
      const R = R_global[dof_offset + i][0] - F_applied;
      react.push(R);
    }
    reactions.set(node.id, react);
  }
  
  const execution_time = Date.now() - start_time;
  
  console.log(`\n[RESULTS]`);
  console.log(`  Execution time: ${execution_time} ms`);
  console.log(`  Convergence: true`);
  console.log(`  Member forces computed: ${member_forces.length}`);
  
  return {
    title: input.title,
    type: input.type,
    convergence: true,
    iterations: 1,
    displacements,
    reactions,
    member_forces,
    max_displacement: Math.max(...Array.from(displacements.values()).map(d => Math.max(...d.map(x => Math.abs(x))))),
    max_stress: Math.max(...member_forces.map(f => Math.abs(f.stress || 0))),
    execution_time_ms: execution_time
  };
}

export default solveStructure;
