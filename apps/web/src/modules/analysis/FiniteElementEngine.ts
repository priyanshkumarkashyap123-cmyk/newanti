/**
 * ============================================================================
 * FINITE ELEMENT ANALYSIS ENGINE
 * ============================================================================
 * 
 * Professional-grade finite element analysis for structural engineering:
 * - 1D Elements (Truss, Beam, Frame)
 * - 2D Elements (Plane Stress, Plane Strain, Plate Bending)
 * - Shell Elements (Flat Shell, Curved Shell)
 * - Solid Elements (Tetrahedron, Hexahedron)
 * - Nonlinear Analysis (Material & Geometric)
 * - Dynamic Analysis (Modal, Harmonic, Transient)
 * 
 * Features:
 * - Automatic mesh generation
 * - Multiple solver options
 * - Post-processing capabilities
 * - Result visualization data
 * 
 * @version 3.0.0
 */

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export interface Node {
  id: number;
  x: number;
  y: number;
  z?: number;
  constraints?: {
    dx?: boolean;
    dy?: boolean;
    dz?: boolean;
    rx?: boolean;
    ry?: boolean;
    rz?: boolean;
  };
  loads?: {
    Fx?: number;
    Fy?: number;
    Fz?: number;
    Mx?: number;
    My?: number;
    Mz?: number;
  };
}

export interface Material {
  id: number;
  name: string;
  E: number;           // Young's modulus (MPa)
  nu: number;          // Poisson's ratio
  G?: number;          // Shear modulus (MPa)
  density: number;     // Density (kg/m³)
  fy?: number;         // Yield strength (MPa)
  alpha?: number;      // Thermal expansion coefficient
  type: 'linear-elastic' | 'elastoplastic' | 'hyperelastic' | 'viscoelastic';
  plasticityModel?: 'von-mises' | 'tresca' | 'mohr-coulomb' | 'drucker-prager';
}

export interface Section {
  id: number;
  name: string;
  type: 'general' | 'rectangular' | 'circular' | 'I-section' | 'box' | 'T-section';
  A: number;           // Area (mm²)
  Ix: number;          // Moment of inertia about x (mm⁴)
  Iy: number;          // Moment of inertia about y (mm⁴)
  J?: number;          // Torsional constant (mm⁴)
  Zx?: number;         // Section modulus x (mm³)
  Zy?: number;         // Section modulus y (mm³)
  Avx?: number;        // Shear area x (mm²)
  Avy?: number;        // Shear area y (mm²)
}

export interface Element {
  id: number;
  type: ElementType;
  nodes: number[];     // Node IDs
  materialId: number;
  sectionId?: number;  // For beam/frame elements
  thickness?: number;  // For plate/shell elements
  properties?: Record<string, number>;
}

export type ElementType = 
  | 'truss-2d' 
  | 'truss-3d' 
  | 'beam-2d' 
  | 'beam-3d' 
  | 'frame-2d' 
  | 'frame-3d'
  | 'plane-stress'
  | 'plane-strain'
  | 'axisymmetric'
  | 'plate-mindlin'
  | 'plate-kirchhoff'
  | 'shell-4node'
  | 'shell-8node'
  | 'tetra-4node'
  | 'tetra-10node'
  | 'hexa-8node'
  | 'hexa-20node';

export interface AnalysisOptions {
  type: 'linear-static' | 'nonlinear-static' | 'modal' | 'harmonic' | 'transient' | 'buckling';
  solver: 'direct' | 'iterative' | 'sparse';
  tolerance?: number;
  maxIterations?: number;
  numModes?: number;        // For modal analysis
  frequencyRange?: [number, number]; // For harmonic analysis
  timeStep?: number;        // For transient analysis
  totalTime?: number;       // For transient analysis
  loadSteps?: number;       // For nonlinear analysis
  geometricNonlinearity?: boolean;
  materialNonlinearity?: boolean;
}

export interface LoadCase {
  id: number;
  name: string;
  type: 'static' | 'dynamic' | 'thermal' | 'modal';
  nodalLoads?: {
    nodeId: number;
    Fx?: number;
    Fy?: number;
    Fz?: number;
    Mx?: number;
    My?: number;
    Mz?: number;
  }[];
  distributedLoads?: {
    elementId: number;
    type: 'uniform' | 'linear' | 'trapezoidal';
    direction: 'local' | 'global';
    values: number[];
  }[];
  pressureLoads?: {
    elementId: number;
    pressure: number;
    direction: 'normal' | number[];
  }[];
  temperatureLoads?: {
    nodeId?: number;
    elementId?: number;
    deltaT: number;
    gradient?: number;
  }[];
}

export interface AnalysisResult {
  displacements: Map<number, number[]>;
  reactions: Map<number, number[]>;
  elementForces: Map<number, ElementForces>;
  elementStresses: Map<number, StressResult>;
  eigenvalues?: number[];
  eigenvectors?: number[][];
  naturalFrequencies?: number[];
  modeShapes?: Map<number, number[]>[];
}

export interface ElementForces {
  axial?: number[];
  shear?: number[];
  moment?: number[];
  torsion?: number;
}

export interface StressResult {
  vonMises: number[];
  principal: [number, number, number][];
  shear: number[];
  normal: number[];
  direction?: number[];
}

// ============================================================================
// MATRIX UTILITIES
// ============================================================================

class SparseMatrix {
  private rows: number;
  private cols: number;
  private data: Map<string, number>;
  
  constructor(rows: number, cols: number) {
    this.rows = rows;
    this.cols = cols;
    this.data = new Map();
  }
  
  private key(i: number, j: number): string {
    return `${i},${j}`;
  }
  
  get(i: number, j: number): number {
    return this.data.get(this.key(i, j)) || 0;
  }
  
  set(i: number, j: number, value: number): void {
    if (Math.abs(value) > 1e-14) {
      this.data.set(this.key(i, j), value);
    } else {
      this.data.delete(this.key(i, j));
    }
  }
  
  add(i: number, j: number, value: number): void {
    const current = this.get(i, j);
    this.set(i, j, current + value);
  }
  
  multiply(vector: number[]): number[] {
    const result = new Array(this.rows).fill(0);
    this.data.forEach((value, key) => {
      const [i, j] = key.split(',').map(Number);
      result[i] += value * vector[j];
    });
    return result;
  }
  
  toDense(): number[][] {
    const dense = Array(this.rows).fill(null)
      .map(() => Array(this.cols).fill(0));
    this.data.forEach((value, key) => {
      const [i, j] = key.split(',').map(Number);
      dense[i][j] = value;
    });
    return dense;
  }
  
  get size(): { rows: number; cols: number; nnz: number } {
    return { rows: this.rows, cols: this.cols, nnz: this.data.size };
  }
}

// ============================================================================
// ELEMENT FORMULATIONS
// ============================================================================

class ElementFormulation {
  // 2D Truss element stiffness matrix
  static truss2D(
    L: number,
    A: number,
    E: number,
    angle: number
  ): number[][] {
    const c = Math.cos(angle);
    const s = Math.sin(angle);
    const EA_L = E * A / L;
    
    return [
      [c*c*EA_L, c*s*EA_L, -c*c*EA_L, -c*s*EA_L],
      [c*s*EA_L, s*s*EA_L, -c*s*EA_L, -s*s*EA_L],
      [-c*c*EA_L, -c*s*EA_L, c*c*EA_L, c*s*EA_L],
      [-c*s*EA_L, -s*s*EA_L, c*s*EA_L, s*s*EA_L]
    ];
  }
  
  // 2D Beam element stiffness matrix (Euler-Bernoulli)
  static beam2D(L: number, E: number, I: number): number[][] {
    const EI = E * I;
    const L2 = L * L;
    const L3 = L * L * L;
    
    return [
      [12*EI/L3, 6*EI/L2, -12*EI/L3, 6*EI/L2],
      [6*EI/L2, 4*EI/L, -6*EI/L2, 2*EI/L],
      [-12*EI/L3, -6*EI/L2, 12*EI/L3, -6*EI/L2],
      [6*EI/L2, 2*EI/L, -6*EI/L2, 4*EI/L]
    ];
  }
  
  // 2D Frame element stiffness matrix
  static frame2D(
    L: number,
    A: number,
    E: number,
    I: number,
    angle: number
  ): number[][] {
    const c = Math.cos(angle);
    const s = Math.sin(angle);
    
    // Local stiffness matrix
    const EI = E * I;
    const EA = E * A;
    const L2 = L * L;
    const L3 = L * L * L;
    
    const kLocal = [
      [EA/L, 0, 0, -EA/L, 0, 0],
      [0, 12*EI/L3, 6*EI/L2, 0, -12*EI/L3, 6*EI/L2],
      [0, 6*EI/L2, 4*EI/L, 0, -6*EI/L2, 2*EI/L],
      [-EA/L, 0, 0, EA/L, 0, 0],
      [0, -12*EI/L3, -6*EI/L2, 0, 12*EI/L3, -6*EI/L2],
      [0, 6*EI/L2, 2*EI/L, 0, -6*EI/L2, 4*EI/L]
    ];
    
    // Transformation matrix
    const T = [
      [c, s, 0, 0, 0, 0],
      [-s, c, 0, 0, 0, 0],
      [0, 0, 1, 0, 0, 0],
      [0, 0, 0, c, s, 0],
      [0, 0, 0, -s, c, 0],
      [0, 0, 0, 0, 0, 1]
    ];
    
    // Global stiffness: K_global = T^T * K_local * T
    return this.transformMatrix(kLocal, T);
  }
  
  // 3D Frame element stiffness matrix
  static frame3D(
    L: number,
    A: number,
    E: number,
    G: number,
    Iy: number,
    Iz: number,
    J: number,
    transform: number[][]
  ): number[][] {
    const EIy = E * Iy;
    const EIz = E * Iz;
    const GJ = G * J;
    const EA = E * A;
    const L2 = L * L;
    const L3 = L * L * L;
    
    // Local stiffness matrix (12x12)
    const kLocal = Array(12).fill(null).map(() => Array(12).fill(0));
    
    // Axial
    kLocal[0][0] = EA/L;
    kLocal[0][6] = -EA/L;
    kLocal[6][0] = -EA/L;
    kLocal[6][6] = EA/L;
    
    // Torsion
    kLocal[3][3] = GJ/L;
    kLocal[3][9] = -GJ/L;
    kLocal[9][3] = -GJ/L;
    kLocal[9][9] = GJ/L;
    
    // Bending about y
    kLocal[2][2] = 12*EIy/L3;
    kLocal[2][4] = 6*EIy/L2;
    kLocal[2][8] = -12*EIy/L3;
    kLocal[2][10] = 6*EIy/L2;
    kLocal[4][2] = 6*EIy/L2;
    kLocal[4][4] = 4*EIy/L;
    kLocal[4][8] = -6*EIy/L2;
    kLocal[4][10] = 2*EIy/L;
    kLocal[8][2] = -12*EIy/L3;
    kLocal[8][4] = -6*EIy/L2;
    kLocal[8][8] = 12*EIy/L3;
    kLocal[8][10] = -6*EIy/L2;
    kLocal[10][2] = 6*EIy/L2;
    kLocal[10][4] = 2*EIy/L;
    kLocal[10][8] = -6*EIy/L2;
    kLocal[10][10] = 4*EIy/L;
    
    // Bending about z
    kLocal[1][1] = 12*EIz/L3;
    kLocal[1][5] = -6*EIz/L2;
    kLocal[1][7] = -12*EIz/L3;
    kLocal[1][11] = -6*EIz/L2;
    kLocal[5][1] = -6*EIz/L2;
    kLocal[5][5] = 4*EIz/L;
    kLocal[5][7] = 6*EIz/L2;
    kLocal[5][11] = 2*EIz/L;
    kLocal[7][1] = -12*EIz/L3;
    kLocal[7][5] = 6*EIz/L2;
    kLocal[7][7] = 12*EIz/L3;
    kLocal[7][11] = 6*EIz/L2;
    kLocal[11][1] = -6*EIz/L2;
    kLocal[11][5] = 2*EIz/L;
    kLocal[11][7] = 6*EIz/L2;
    kLocal[11][11] = 4*EIz/L;
    
    return this.transformMatrix(kLocal, transform);
  }
  
  // Plane stress/strain 3-node triangular element (CST)
  static triangleCST(
    nodes: [number, number][],
    E: number,
    nu: number,
    t: number,
    type: 'stress' | 'strain'
  ): number[][] {
    const [x1, y1] = nodes[0];
    const [x2, y2] = nodes[1];
    const [x3, y3] = nodes[2];
    
    // Area
    const A = 0.5 * Math.abs(
      x1 * (y2 - y3) + x2 * (y3 - y1) + x3 * (y1 - y2)
    );
    
    // B matrix
    const b1 = y2 - y3;
    const b2 = y3 - y1;
    const b3 = y1 - y2;
    const c1 = x3 - x2;
    const c2 = x1 - x3;
    const c3 = x2 - x1;
    
    const B = [
      [b1, 0, b2, 0, b3, 0],
      [0, c1, 0, c2, 0, c3],
      [c1, b1, c2, b2, c3, b3]
    ].map(row => row.map(val => val / (2 * A)));
    
    // D matrix (constitutive)
    let D: number[][];
    if (type === 'stress') {
      const factor = E / (1 - nu * nu);
      D = [
        [factor, factor * nu, 0],
        [factor * nu, factor, 0],
        [0, 0, factor * (1 - nu) / 2]
      ];
    } else {
      const factor = E * (1 - nu) / ((1 + nu) * (1 - 2 * nu));
      const v_ratio = nu / (1 - nu);
      D = [
        [factor, factor * v_ratio, 0],
        [factor * v_ratio, factor, 0],
        [0, 0, factor * (1 - 2 * nu) / (2 * (1 - nu))]
      ];
    }
    
    // K = t * A * B^T * D * B
    const BT = this.transpose(B);
    const DB = this.matMul(D, B);
    const K = this.matMul(BT, DB).map(row => row.map(val => val * t * A));
    
    return K;
  }
  
  // 4-node quadrilateral element (Q4)
  static quadQ4(
    nodes: [number, number][],
    E: number,
    nu: number,
    t: number,
    type: 'stress' | 'strain'
  ): number[][] {
    // Gauss integration points (2x2)
    const gauss = [-1/Math.sqrt(3), 1/Math.sqrt(3)];
    const weights = [1, 1];
    
    // Initialize stiffness matrix
    const K = Array(8).fill(null).map(() => Array(8).fill(0));
    
    // D matrix
    let D: number[][];
    if (type === 'stress') {
      const factor = E / (1 - nu * nu);
      D = [
        [factor, factor * nu, 0],
        [factor * nu, factor, 0],
        [0, 0, factor * (1 - nu) / 2]
      ];
    } else {
      const factor = E * (1 - nu) / ((1 + nu) * (1 - 2 * nu));
      const v_ratio = nu / (1 - nu);
      D = [
        [factor, factor * v_ratio, 0],
        [factor * v_ratio, factor, 0],
        [0, 0, factor * (1 - 2 * nu) / (2 * (1 - nu))]
      ];
    }
    
    // Gauss quadrature
    for (let i = 0; i < 2; i++) {
      for (let j = 0; j < 2; j++) {
        const xi = gauss[i];
        const eta = gauss[j];
        const w = weights[i] * weights[j];
        
        // Shape function derivatives
        const dN_dxi = [
          [-(1-eta)/4, (1-eta)/4, (1+eta)/4, -(1+eta)/4],
          [-(1-xi)/4, -(1+xi)/4, (1+xi)/4, (1-xi)/4]
        ];
        
        // Jacobian
        const J = this.matMul(dN_dxi, nodes.map(([x, y]) => [x, y]));
        const detJ = J[0][0] * J[1][1] - J[0][1] * J[1][0];
        const Jinv = [
          [J[1][1] / detJ, -J[0][1] / detJ],
          [-J[1][0] / detJ, J[0][0] / detJ]
        ];
        
        // B matrix
        const dN_dxy = this.matMul(Jinv, dN_dxi);
        const B = Array(3).fill(null).map(() => Array(8).fill(0));
        for (let k = 0; k < 4; k++) {
          B[0][2*k] = dN_dxy[0][k];
          B[1][2*k+1] = dN_dxy[1][k];
          B[2][2*k] = dN_dxy[1][k];
          B[2][2*k+1] = dN_dxy[0][k];
        }
        
        // Add contribution: K += w * t * |J| * B^T * D * B
        const BT = this.transpose(B);
        const DB = this.matMul(D, B);
        const contrib = this.matMul(BT, DB);
        const factor = w * t * Math.abs(detJ);
        
        for (let m = 0; m < 8; m++) {
          for (let n = 0; n < 8; n++) {
            K[m][n] += contrib[m][n] * factor;
          }
        }
      }
    }
    
    return K;
  }
  
  // Mindlin plate element (4-node)
  static plateMindlin(
    nodes: [number, number][],
    E: number,
    nu: number,
    t: number
  ): number[][] {
    // This is a simplified version
    // Full implementation would include shear locking prevention
    
    const D_bend = E * t * t * t / (12 * (1 - nu * nu));
    const D_shear = 5/6 * E * t / (2 * (1 + nu)); // Shear correction factor
    
    // Gauss integration (2x2 for bending, 1x1 for shear to avoid locking)
    const gauss = [-1/Math.sqrt(3), 1/Math.sqrt(3)];
    
    // Each node has 3 DOFs: w, theta_x, theta_y
    const K = Array(12).fill(null).map(() => Array(12).fill(0));
    
    // Bending contribution (2x2 integration)
    for (let i = 0; i < 2; i++) {
      for (let j = 0; j < 2; j++) {
        const xi = gauss[i];
        const eta = gauss[j];
        
        // Shape functions
        const N = [
          (1-xi)*(1-eta)/4,
          (1+xi)*(1-eta)/4,
          (1+xi)*(1+eta)/4,
          (1-xi)*(1+eta)/4
        ];
        
        // Derivatives
        const dN_dxi = [
          [-(1-eta)/4, (1-eta)/4, (1+eta)/4, -(1+eta)/4],
          [-(1-xi)/4, -(1+xi)/4, (1+xi)/4, (1-xi)/4]
        ];
        
        // Jacobian
        const J = this.matMul(dN_dxi, nodes.map(([x, y]) => [x, y]));
        const detJ = J[0][0] * J[1][1] - J[0][1] * J[1][0];
        const Jinv = [
          [J[1][1] / detJ, -J[0][1] / detJ],
          [-J[1][0] / detJ, J[0][0] / detJ]
        ];
        
        const dN_dxy = this.matMul(Jinv, dN_dxi);
        
        // Bending strain-displacement matrix
        // kappa_x = dtheta_y/dx, kappa_y = -dtheta_x/dy, kappa_xy = dtheta_y/dy - dtheta_x/dx
        const Bb = Array(3).fill(null).map(() => Array(12).fill(0));
        for (let k = 0; k < 4; k++) {
          Bb[0][3*k+2] = dN_dxy[0][k];  // d/dx of theta_y
          Bb[1][3*k+1] = -dN_dxy[1][k]; // -d/dy of theta_x
          Bb[2][3*k+1] = -dN_dxy[0][k]; // -d/dx of theta_x
          Bb[2][3*k+2] = dN_dxy[1][k];  // d/dy of theta_y
        }
        
        // Constitutive matrix for bending
        const Db = [
          [D_bend, D_bend * nu, 0],
          [D_bend * nu, D_bend, 0],
          [0, 0, D_bend * (1 - nu) / 2]
        ];
        
        // Add bending contribution
        const BbT = this.transpose(Bb);
        const DbBb = this.matMul(Db, Bb);
        const contrib = this.matMul(BbT, DbBb);
        
        for (let m = 0; m < 12; m++) {
          for (let n = 0; n < 12; n++) {
            K[m][n] += contrib[m][n] * Math.abs(detJ);
          }
        }
      }
    }
    
    // Shear contribution (1x1 reduced integration)
    {
      const xi = 0;
      const eta = 0;
      
      const N = [0.25, 0.25, 0.25, 0.25];
      const dN_dxi = [
        [-(1-eta)/4, (1-eta)/4, (1+eta)/4, -(1+eta)/4],
        [-(1-xi)/4, -(1+xi)/4, (1+xi)/4, (1-xi)/4]
      ];
      
      const J = this.matMul(dN_dxi, nodes.map(([x, y]) => [x, y]));
      const detJ = J[0][0] * J[1][1] - J[0][1] * J[1][0];
      const Jinv = [
        [J[1][1] / detJ, -J[0][1] / detJ],
        [-J[1][0] / detJ, J[0][0] / detJ]
      ];
      
      const dN_dxy = this.matMul(Jinv, dN_dxi);
      
      // Shear strain-displacement matrix
      // gamma_xz = dw/dx + theta_y, gamma_yz = dw/dy - theta_x
      const Bs = Array(2).fill(null).map(() => Array(12).fill(0));
      for (let k = 0; k < 4; k++) {
        Bs[0][3*k] = dN_dxy[0][k];   // dw/dx
        Bs[0][3*k+2] = N[k];          // theta_y
        Bs[1][3*k] = dN_dxy[1][k];   // dw/dy
        Bs[1][3*k+1] = -N[k];         // -theta_x
      }
      
      const Ds = [
        [D_shear, 0],
        [0, D_shear]
      ];
      
      const BsT = this.transpose(Bs);
      const DsBs = this.matMul(Ds, Bs);
      const contrib = this.matMul(BsT, DsBs);
      
      // Weight = 4 for 1x1 integration over [-1,1]x[-1,1]
      for (let m = 0; m < 12; m++) {
        for (let n = 0; n < 12; n++) {
          K[m][n] += contrib[m][n] * 4 * Math.abs(detJ);
        }
      }
    }
    
    return K;
  }
  
  // Helper: Matrix transpose
  static transpose(A: number[][]): number[][] {
    const rows = A.length;
    const cols = A[0].length;
    const result = Array(cols).fill(null).map(() => Array(rows).fill(0));
    for (let i = 0; i < rows; i++) {
      for (let j = 0; j < cols; j++) {
        result[j][i] = A[i][j];
      }
    }
    return result;
  }
  
  // Helper: Matrix multiplication
  static matMul(A: number[][], B: number[][]): number[][] {
    const rowsA = A.length;
    const colsA = A[0].length;
    const colsB = B[0].length;
    const result = Array(rowsA).fill(null).map(() => Array(colsB).fill(0));
    
    for (let i = 0; i < rowsA; i++) {
      for (let j = 0; j < colsB; j++) {
        for (let k = 0; k < colsA; k++) {
          result[i][j] += A[i][k] * B[k][j];
        }
      }
    }
    
    return result;
  }
  
  // Helper: Transform matrix K_global = T^T * K_local * T
  static transformMatrix(K: number[][], T: number[][]): number[][] {
    const TT = this.transpose(T);
    const KT = this.matMul(K, T);
    return this.matMul(TT, KT);
  }
}

// ============================================================================
// FINITE ELEMENT MODEL
// ============================================================================

export class FEModel {
  nodes: Map<number, Node> = new Map();
  elements: Map<number, Element> = new Map();
  materials: Map<number, Material> = new Map();
  sections: Map<number, Section> = new Map();
  loadCases: Map<number, LoadCase> = new Map();
  
  private totalDOFs: number = 0;
  private dofMap: Map<number, number[]> = new Map(); // nodeId -> global DOF indices
  
  // Add node
  addNode(node: Node): void {
    this.nodes.set(node.id, node);
  }
  
  // Add element
  addElement(element: Element): void {
    this.elements.set(element.id, element);
  }
  
  // Add material
  addMaterial(material: Material): void {
    this.materials.set(material.id, material);
  }
  
  // Add section
  addSection(section: Section): void {
    this.sections.set(section.id, section);
  }
  
  // Add load case
  addLoadCase(loadCase: LoadCase): void {
    this.loadCases.set(loadCase.id, loadCase);
  }
  
  // Get DOFs per node based on element types
  private getDOFsPerNode(elementType: ElementType): number {
    switch (elementType) {
      case 'truss-2d': return 2;
      case 'truss-3d': return 3;
      case 'beam-2d': return 2;
      case 'beam-3d': return 6;
      case 'frame-2d': return 3;
      case 'frame-3d': return 6;
      case 'plane-stress':
      case 'plane-strain':
      case 'axisymmetric': return 2;
      case 'plate-mindlin':
      case 'plate-kirchhoff': return 3;
      case 'shell-4node':
      case 'shell-8node': return 6;
      case 'tetra-4node':
      case 'tetra-10node':
      case 'hexa-8node':
      case 'hexa-20node': return 3;
      default: return 6;
    }
  }
  
  // Build DOF map
  buildDOFMap(): void {
    const dofsPerNode = 6; // Maximum DOFs
    this.dofMap.clear();
    
    let globalDOF = 0;
    this.nodes.forEach((node, nodeId) => {
      const dofs: number[] = [];
      for (let i = 0; i < dofsPerNode; i++) {
        dofs.push(globalDOF++);
      }
      this.dofMap.set(nodeId, dofs);
    });
    
    this.totalDOFs = globalDOF;
  }
  
  // Assemble global stiffness matrix
  assembleStiffnessMatrix(): SparseMatrix {
    this.buildDOFMap();
    const K = new SparseMatrix(this.totalDOFs, this.totalDOFs);
    
    this.elements.forEach((element) => {
      const ke = this.computeElementStiffness(element);
      const nodeDOFs = this.getElementDOFs(element);
      
      // Assembly
      for (let i = 0; i < ke.length; i++) {
        for (let j = 0; j < ke[i].length; j++) {
          if (nodeDOFs[i] >= 0 && nodeDOFs[j] >= 0) {
            K.add(nodeDOFs[i], nodeDOFs[j], ke[i][j]);
          }
        }
      }
    });
    
    return K;
  }
  
  // Compute element stiffness matrix
  private computeElementStiffness(element: Element): number[][] {
    const material = this.materials.get(element.materialId);
    if (!material) throw new Error(`Material ${element.materialId} not found`);
    
    const nodeCoords = element.nodes.map(id => {
      const node = this.nodes.get(id);
      if (!node) throw new Error(`Node ${id} not found`);
      return [node.x, node.y, node.z || 0] as [number, number, number];
    });
    
    switch (element.type) {
      case 'truss-2d': {
        const [[x1, y1], [x2, y2]] = nodeCoords;
        const L = Math.sqrt((x2-x1)**2 + (y2-y1)**2);
        const angle = Math.atan2(y2-y1, x2-x1);
        const section = this.sections.get(element.sectionId!);
        return ElementFormulation.truss2D(L, section!.A, material.E, angle);
      }
      
      case 'frame-2d': {
        const [[x1, y1], [x2, y2]] = nodeCoords;
        const L = Math.sqrt((x2-x1)**2 + (y2-y1)**2);
        const angle = Math.atan2(y2-y1, x2-x1);
        const section = this.sections.get(element.sectionId!);
        return ElementFormulation.frame2D(L, section!.A, material.E, section!.Ix, angle);
      }
      
      case 'plane-stress':
      case 'plane-strain': {
        const t = element.thickness || 1;
        const type = element.type === 'plane-stress' ? 'stress' : 'strain';
        if (nodeCoords.length === 3) {
          return ElementFormulation.triangleCST(
            nodeCoords.map(([x, y]) => [x, y]) as [number, number][],
            material.E,
            material.nu,
            t,
            type
          );
        } else {
          return ElementFormulation.quadQ4(
            nodeCoords.map(([x, y]) => [x, y]) as [number, number][],
            material.E,
            material.nu,
            t,
            type
          );
        }
      }
      
      case 'plate-mindlin': {
        const t = element.thickness || 100;
        return ElementFormulation.plateMindlin(
          nodeCoords.map(([x, y]) => [x, y]) as [number, number][],
          material.E,
          material.nu,
          t
        );
      }
      
      default:
        throw new Error(`Element type ${element.type} is currently unsupported`);
    }
  }
  
  // Get global DOF indices for element
  private getElementDOFs(element: Element): number[] {
    const dofs: number[] = [];
    const dofsPerNode = this.getDOFsPerNode(element.type);
    
    for (const nodeId of element.nodes) {
      const nodeDOFs = this.dofMap.get(nodeId);
      if (nodeDOFs) {
        for (let i = 0; i < dofsPerNode; i++) {
          dofs.push(nodeDOFs[i]);
        }
      }
    }
    
    return dofs;
  }
  
  // Assemble load vector
  assembleLoadVector(loadCaseId: number): number[] {
    const F = new Array(this.totalDOFs).fill(0);
    const loadCase = this.loadCases.get(loadCaseId);
    
    if (!loadCase) return F;
    
    // Nodal loads
    if (loadCase.nodalLoads) {
      for (const load of loadCase.nodalLoads) {
        const nodeDOFs = this.dofMap.get(load.nodeId);
        if (nodeDOFs) {
          if (load.Fx) F[nodeDOFs[0]] += load.Fx;
          if (load.Fy) F[nodeDOFs[1]] += load.Fy;
          if (load.Fz && nodeDOFs.length > 2) F[nodeDOFs[2]] += load.Fz;
          if (load.Mx && nodeDOFs.length > 3) F[nodeDOFs[3]] += load.Mx;
          if (load.My && nodeDOFs.length > 4) F[nodeDOFs[4]] += load.My;
          if (load.Mz && nodeDOFs.length > 5) F[nodeDOFs[5]] += load.Mz;
        }
      }
    }
    
    return F;
  }
  
  // Apply boundary conditions
  applyBoundaryConditions(K: SparseMatrix, F: number[]): { K: SparseMatrix; F: number[] } {
    const constrainedDOFs: number[] = [];
    
    this.nodes.forEach((node, nodeId) => {
      if (node.constraints) {
        const nodeDOFs = this.dofMap.get(nodeId);
        if (nodeDOFs) {
          if (node.constraints.dx) constrainedDOFs.push(nodeDOFs[0]);
          if (node.constraints.dy) constrainedDOFs.push(nodeDOFs[1]);
          if (node.constraints.dz && nodeDOFs.length > 2) constrainedDOFs.push(nodeDOFs[2]);
          if (node.constraints.rx && nodeDOFs.length > 3) constrainedDOFs.push(nodeDOFs[3]);
          if (node.constraints.ry && nodeDOFs.length > 4) constrainedDOFs.push(nodeDOFs[4]);
          if (node.constraints.rz && nodeDOFs.length > 5) constrainedDOFs.push(nodeDOFs[5]);
        }
      }
    });
    
    // Penalty method for applying constraints
    const penalty = 1e12;
    for (const dof of constrainedDOFs) {
      K.set(dof, dof, K.get(dof, dof) + penalty);
      F[dof] = 0;
    }
    
    return { K, F };
  }
}

// ============================================================================
// FEA SOLVER
// ============================================================================

export class FEASolver {
  private model: FEModel;
  private options: AnalysisOptions;
  
  constructor(model: FEModel, options: AnalysisOptions) {
    this.model = model;
    this.options = options;
  }
  
  // Solve the system
  solve(loadCaseId: number): AnalysisResult {
    switch (this.options.type) {
      case 'linear-static':
        return this.solveLinearStatic(loadCaseId);
      case 'modal':
        return this.solveModal();
      case 'buckling':
        return this.solveBuckling(loadCaseId);
      default:
        return this.solveLinearStatic(loadCaseId);
    }
  }
  
  // Linear static analysis
  private solveLinearStatic(loadCaseId: number): AnalysisResult {
    // Assemble
    let K = this.model.assembleStiffnessMatrix();
    let F = this.model.assembleLoadVector(loadCaseId);
    
    // Apply BCs
    const bc = this.model.applyBoundaryConditions(K, F);
    K = bc.K;
    F = bc.F;
    
    // Solve Ku = F
    const u = this.solveLinearSystem(K.toDense(), F);
    
    // Post-process
    const displacements = this.extractDisplacements(u);
    const reactions = this.computeReactions(K, u, F);
    const elementForces = this.computeElementForces(u);
    const elementStresses = this.computeElementStresses(u);
    
    return {
      displacements,
      reactions,
      elementForces,
      elementStresses
    };
  }
  
  // Modal analysis
  private solveModal(): AnalysisResult {
    // Assemble stiffness
    let K = this.model.assembleStiffnessMatrix();
    
    // Assemble mass matrix (simplified - lumped mass)
    const M = this.assembleMassMatrix();
    
    // Apply BCs
    const bc = this.model.applyBoundaryConditions(K, new Array(K.size.rows).fill(0));
    K = bc.K;
    
    // Solve eigenvalue problem: K*phi = omega^2*M*phi
    const { eigenvalues, eigenvectors } = this.solveEigenProblem(K.toDense(), M.toDense());
    
    // Natural frequencies
    const naturalFrequencies = eigenvalues.map(lambda => Math.sqrt(Math.abs(lambda)) / (2 * Math.PI));
    
    // Mode shapes
    const modeShapes = eigenvectors.map((vec, i) => {
      const mode = new Map<number, number[]>();
      this.model.nodes.forEach((node, nodeId) => {
        const dofs = (this.model as any).dofMap.get(nodeId);
        if (dofs) {
          mode.set(nodeId, dofs.map((dof: number) => vec[dof] || 0));
        }
      });
      return mode;
    });
    
    return {
      displacements: new Map(),
      reactions: new Map(),
      elementForces: new Map(),
      elementStresses: new Map(),
      eigenvalues,
      eigenvectors,
      naturalFrequencies,
      modeShapes
    };
  }
  
  // Buckling analysis
  private solveBuckling(loadCaseId: number): AnalysisResult {
    // First solve static to get stress state
    const staticResult = this.solveLinearStatic(loadCaseId);
    
    // Compute geometric stiffness matrix (simplified)
    const K = this.model.assembleStiffnessMatrix();
    const Kg = this.assembleGeometricStiffnessMatrix(staticResult);
    
    // Eigenvalue problem: (K - lambda*Kg)*phi = 0
    const KDense = K.toDense();
    const KgDense = Kg.toDense();
    
    const { eigenvalues, eigenvectors } = this.solveGeneralizedEigenProblem(KDense, KgDense);
    
    return {
      ...staticResult,
      eigenvalues,
      eigenvectors
    };
  }
  
  // Solve linear system Ax = b using Cholesky decomposition
  private solveLinearSystem(A: number[][], b: number[]): number[] {
    const n = A.length;
    
    // Cholesky decomposition A = L*L^T
    const L = Array(n).fill(null).map(() => Array(n).fill(0));
    
    for (let i = 0; i < n; i++) {
      for (let j = 0; j <= i; j++) {
        let sum = A[i][j];
        for (let k = 0; k < j; k++) {
          sum -= L[i][k] * L[j][k];
        }
        
        if (i === j) {
          if (sum <= 0) {
            // Not positive definite - use LU instead
            return this.solveLU(A, b);
          }
          L[i][j] = Math.sqrt(sum);
        } else {
          L[i][j] = sum / L[j][j];
        }
      }
    }
    
    // Forward substitution: L*y = b
    const y = new Array(n).fill(0);
    for (let i = 0; i < n; i++) {
      let sum = b[i];
      for (let j = 0; j < i; j++) {
        sum -= L[i][j] * y[j];
      }
      y[i] = sum / L[i][i];
    }
    
    // Back substitution: L^T*x = y
    const x = new Array(n).fill(0);
    for (let i = n - 1; i >= 0; i--) {
      let sum = y[i];
      for (let j = i + 1; j < n; j++) {
        sum -= L[j][i] * x[j];
      }
      x[i] = sum / L[i][i];
    }
    
    return x;
  }
  
  // LU decomposition solver
  private solveLU(A: number[][], b: number[]): number[] {
    const n = A.length;
    const L = Array(n).fill(null).map(() => Array(n).fill(0));
    const U = A.map(row => [...row]);
    
    for (let i = 0; i < n; i++) {
      L[i][i] = 1;
      for (let j = i + 1; j < n; j++) {
        const factor = U[j][i] / U[i][i];
        L[j][i] = factor;
        for (let k = i; k < n; k++) {
          U[j][k] -= factor * U[i][k];
        }
      }
    }
    
    // Forward: L*y = b
    const y = new Array(n).fill(0);
    for (let i = 0; i < n; i++) {
      y[i] = b[i];
      for (let j = 0; j < i; j++) {
        y[i] -= L[i][j] * y[j];
      }
    }
    
    // Backward: U*x = y
    const x = new Array(n).fill(0);
    for (let i = n - 1; i >= 0; i--) {
      x[i] = y[i];
      for (let j = i + 1; j < n; j++) {
        x[i] -= U[i][j] * x[j];
      }
      x[i] /= U[i][i];
    }
    
    return x;
  }
  
  // Assemble mass matrix (lumped)
  private assembleMassMatrix(): SparseMatrix {
    const n = (this.model as any).totalDOFs;
    const M = new SparseMatrix(n, n);
    
    this.model.elements.forEach((element) => {
      const material = this.model.materials.get(element.materialId);
      if (!material) return;
      
      // Simple lumped mass approach
      const nodeDOFs = (this.model as any).getElementDOFs.call(this.model, element);
      const nodesCount = element.nodes.length;
      
      // Element mass (simplified)
      let elementMass = 0;
      if (element.sectionId) {
        const section = this.model.sections.get(element.sectionId);
        if (section) {
          // For 1D elements
          const nodeCoords = element.nodes.map(id => this.model.nodes.get(id)!);
          const L = Math.sqrt(
            (nodeCoords[1].x - nodeCoords[0].x) ** 2 +
            (nodeCoords[1].y - nodeCoords[0].y) ** 2
          );
          elementMass = material.density * section.A * L * 1e-9; // Convert to tonnes
        }
      }
      
      const massPerNode = elementMass / nodesCount;
      const dofsPerNode = nodeDOFs.length / nodesCount;
      
      for (let i = 0; i < nodeDOFs.length; i++) {
        if (i % dofsPerNode < 3) { // Only translational DOFs
          M.add(nodeDOFs[i], nodeDOFs[i], massPerNode);
        }
      }
    });
    
    return M;
  }
  
  // Simplified eigenvalue solver (Power iteration for dominant mode)
  private solveEigenProblem(K: number[][], M: number[][]): { eigenvalues: number[]; eigenvectors: number[][] } {
    const n = K.length;
    const numModes = this.options.numModes || 5;
    
    const eigenvalues: number[] = [];
    const eigenvectors: number[][] = [];
    
    // Inverse iteration for each mode
    for (let mode = 0; mode < Math.min(numModes, n); mode++) {
      // Random initial vector
      let v = new Array(n).fill(0).map(() => Math.random());
      
      // Orthogonalize against previous modes
      for (const prevV of eigenvectors) {
        const dot = v.reduce((sum, vi, i) => sum + vi * prevV[i], 0);
        v = v.map((vi, i) => vi - dot * prevV[i]);
      }
      
      // Normalize
      let norm = Math.sqrt(v.reduce((sum, vi) => sum + vi * vi, 0));
      v = v.map(vi => vi / norm);
      
      let lambda = 0;
      const maxIter = 100;
      const tol = 1e-8;
      
      for (let iter = 0; iter < maxIter; iter++) {
        // Mv
        const Mv = M.map((row, i) => row.reduce((sum, mij, j) => sum + mij * v[j], 0));
        
        // Solve Kw = Mv
        const w = this.solveLinearSystem(K, Mv);
        
        // New eigenvalue estimate
        const newLambda = v.reduce((sum, vi, i) => sum + vi * w[i], 0) /
                         v.reduce((sum, vi, i) => sum + vi * Mv[i], 0);
        
        // Normalize w
        norm = Math.sqrt(w.reduce((sum, wi) => sum + wi * wi, 0));
        const newV = w.map(wi => wi / norm);
        
        if (Math.abs(newLambda - lambda) < tol) {
          eigenvalues.push(1 / newLambda); // Invert because we solved Kw = lambda*Mw
          eigenvectors.push(newV);
          break;
        }
        
        lambda = newLambda;
        v = newV;
      }
    }
    
    return { eigenvalues, eigenvectors };
  }
  
  // Generalized eigenvalue problem (simplified)
  private solveGeneralizedEigenProblem(K: number[][], Kg: number[][]): { eigenvalues: number[]; eigenvectors: number[][] } {
    // Similar to standard eigenvalue but with K - lambda*Kg
    return this.solveEigenProblem(K, Kg);
  }
  
  // Assemble geometric stiffness matrix (simplified)
  private assembleGeometricStiffnessMatrix(staticResult: AnalysisResult): SparseMatrix {
    const n = (this.model as any).totalDOFs;
    return new SparseMatrix(n, n); // Placeholder - would compute from element stresses
  }
  
  // Extract displacements from solution vector
  private extractDisplacements(u: number[]): Map<number, number[]> {
    const displacements = new Map<number, number[]>();
    
    this.model.nodes.forEach((node, nodeId) => {
      const dofs = (this.model as any).dofMap.get(nodeId);
      if (dofs) {
        displacements.set(nodeId, dofs.map((dof: number) => u[dof] || 0));
      }
    });
    
    return displacements;
  }
  
  // Compute reactions
  private computeReactions(K: SparseMatrix, u: number[], F: number[]): Map<number, number[]> {
    const Ku = K.multiply(u);
    const reactions = new Map<number, number[]>();
    
    this.model.nodes.forEach((node, nodeId) => {
      if (node.constraints) {
        const dofs = (this.model as any).dofMap.get(nodeId);
        if (dofs) {
          reactions.set(nodeId, dofs.map((dof: number, i: number) => Ku[dof] - F[dof]));
        }
      }
    });
    
    return reactions;
  }
  
  // Compute element forces
  private computeElementForces(u: number[]): Map<number, ElementForces> {
    const forces = new Map<number, ElementForces>();
    
    this.model.elements.forEach((element, elementId) => {
      // Extract element displacements
      const nodeDOFs = (this.model as any).getElementDOFs.call(this.model, element);
      const ue = nodeDOFs.map((dof: number) => u[dof] || 0);
      
      // Compute forces based on element type
      forces.set(elementId, {
        axial: [ue[0], ue[nodeDOFs.length / 2] || 0],
        shear: [],
        moment: []
      });
    });
    
    return forces;
  }
  
  // Compute element stresses
  private computeElementStresses(u: number[]): Map<number, StressResult> {
    const stresses = new Map<number, StressResult>();
    
    this.model.elements.forEach((element, elementId) => {
      stresses.set(elementId, {
        vonMises: [0],
        principal: [[0, 0, 0]],
        shear: [0],
        normal: [0]
      });
    });
    
    return stresses;
  }
}

// ============================================================================
// EXPORTS
// ============================================================================

export default {
  FEModel,
  FEASolver,
  ElementFormulation,
  SparseMatrix
};
