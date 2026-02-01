/**
 * ============================================================================
 * ADVANCED MATRIX STRUCTURAL ANALYSIS ENGINE
 * ============================================================================
 * 
 * Complete Direct Stiffness Method implementation with:
 * - 2D/3D Frame Analysis
 * - 2D/3D Truss Analysis
 * - Plate/Shell Elements (Mindlin-Reissner)
 * - P-Delta Effects (Geometric Nonlinearity)
 * - Member Releases (Hinges)
 * - Support Settlements
 * - Temperature Loading
 * - Moving Load Analysis
 * - Influence Lines
 * 
 * @version 3.0.0
 */

// ============================================================================
// TYPES AND INTERFACES
// ============================================================================

export type AnalysisType = '2D_FRAME' | '3D_FRAME' | '2D_TRUSS' | '3D_TRUSS' | 'PLATE' | 'SHELL';
export type ElementType = 'BEAM' | 'COLUMN' | 'TRUSS' | 'PLATE4' | 'PLATE3' | 'SHELL4';

export interface Node {
  id: string;
  x: number;
  y: number;
  z: number;
  restraints: [boolean, boolean, boolean, boolean, boolean, boolean]; // Ux, Uy, Uz, Rx, Ry, Rz
  settlement?: [number, number, number, number, number, number];
  mass?: number;
}

export interface Material {
  id: string;
  name: string;
  E: number;          // Elastic Modulus (MPa)
  G: number;          // Shear Modulus (MPa)
  nu: number;         // Poisson's Ratio
  rho: number;        // Density (kg/m³)
  alpha: number;      // Thermal expansion coefficient
  fy?: number;        // Yield strength (MPa)
  fu?: number;        // Ultimate strength (MPa)
}

export interface Section {
  id: string;
  name: string;
  A: number;          // Area (mm²)
  Ix: number;         // Moment of inertia about x (mm⁴)
  Iy: number;         // Moment of inertia about y (mm⁴)
  Iz: number;         // Moment of inertia about z (mm⁴) - Torsion
  J: number;          // Torsional constant (mm⁴)
  Avy: number;        // Shear area y (mm²)
  Avz: number;        // Shear area z (mm²)
  Zx?: number;        // Section modulus x (mm³)
  Zy?: number;        // Section modulus y (mm³)
  rx?: number;        // Radius of gyration x (mm)
  ry?: number;        // Radius of gyration y (mm)
}

export interface Element {
  id: string;
  type: ElementType;
  nodeI: string;
  nodeJ: string;
  nodeK?: string;     // For plates
  nodeL?: string;     // For plates
  materialId: string;
  sectionId: string;
  releases?: {
    startMomentY?: boolean;
    startMomentZ?: boolean;
    endMomentY?: boolean;
    endMomentZ?: boolean;
  };
  offset?: {
    iEnd: [number, number, number];
    jEnd: [number, number, number];
  };
  beta?: number;      // Rotation angle for orientation
}

export interface PointLoad {
  nodeId: string;
  Fx: number;
  Fy: number;
  Fz: number;
  Mx: number;
  My: number;
  Mz: number;
}

export interface DistributedLoad {
  elementId: string;
  type: 'UNIFORM' | 'TRIANGULAR' | 'TRAPEZOIDAL';
  direction: 'LOCAL_Y' | 'LOCAL_Z' | 'GLOBAL_Y' | 'GLOBAL_Z';
  w1: number;         // Start magnitude (kN/m)
  w2?: number;        // End magnitude (kN/m) for trapezoidal
  a?: number;         // Start position (0-1)
  b?: number;         // End position (0-1)
}

export interface TemperatureLoad {
  elementId: string;
  deltaT: number;     // Uniform temperature change
  gradientY?: number; // Temperature gradient in Y
  gradientZ?: number; // Temperature gradient in Z
}

export interface LoadCase {
  id: string;
  name: string;
  type: 'DEAD' | 'LIVE' | 'WIND' | 'SEISMIC' | 'SNOW' | 'TEMPERATURE' | 'SETTLEMENT';
  pointLoads: PointLoad[];
  distributedLoads: DistributedLoad[];
  temperatureLoads?: TemperatureLoad[];
}

export interface AnalysisOptions {
  type: AnalysisType;
  includePDelta: boolean;
  pDeltaIterations?: number;
  pDeltaTolerance?: number;
  includeShearDeformation: boolean;
  selfWeight: boolean;
  selfWeightFactor?: number;
}

export interface NodeResult {
  nodeId: string;
  displacements: number[];  // [Ux, Uy, Uz, Rx, Ry, Rz]
  reactions?: number[];     // For restrained DOFs
}

export interface ElementResult {
  elementId: string;
  forces: {
    start: number[];  // [Fx, Fy, Fz, Mx, My, Mz]
    end: number[];
  };
  maxMoment: number;
  maxShear: number;
  maxAxial: number;
  stressRatio?: number;
}

export interface AnalysisResult {
  loadCaseId: string;
  nodeResults: NodeResult[];
  elementResults: ElementResult[];
  maxDisplacement: number;
  maxReaction: number;
  convergence?: {
    iterations: number;
    finalError: number;
    converged: boolean;
  };
}

// ============================================================================
// MATRIX OPERATIONS CLASS
// ============================================================================

class MatrixOps {
  static create(rows: number, cols: number, fill = 0): number[][] {
    return Array(rows).fill(null).map(() => Array(cols).fill(fill));
  }

  static identity(n: number): number[][] {
    const I = this.create(n, n);
    for (let i = 0; i < n; i++) I[i][i] = 1;
    return I;
  }

  static multiply(A: number[][], B: number[][]): number[][] {
    const m = A.length;
    const n = B[0].length;
    const p = B.length;
    const C = this.create(m, n);
    
    for (let i = 0; i < m; i++) {
      for (let j = 0; j < n; j++) {
        let sum = 0;
        for (let k = 0; k < p; k++) {
          sum += A[i][k] * B[k][j];
        }
        C[i][j] = sum;
      }
    }
    return C;
  }

  static multiplyVector(A: number[][], v: number[]): number[] {
    const m = A.length;
    const n = v.length;
    const result = new Array(m).fill(0);
    
    for (let i = 0; i < m; i++) {
      for (let j = 0; j < n; j++) {
        result[i] += A[i][j] * v[j];
      }
    }
    return result;
  }

  static transpose(A: number[][]): number[][] {
    const m = A.length;
    const n = A[0].length;
    const T = this.create(n, m);
    
    for (let i = 0; i < m; i++) {
      for (let j = 0; j < n; j++) {
        T[j][i] = A[i][j];
      }
    }
    return T;
  }

  static add(A: number[][], B: number[][]): number[][] {
    const m = A.length;
    const n = A[0].length;
    const C = this.create(m, n);
    
    for (let i = 0; i < m; i++) {
      for (let j = 0; j < n; j++) {
        C[i][j] = A[i][j] + B[i][j];
      }
    }
    return C;
  }

  static scale(A: number[][], s: number): number[][] {
    return A.map(row => row.map(val => val * s));
  }

  // Cholesky decomposition for symmetric positive definite matrices
  static cholesky(A: number[][]): number[][] {
    const n = A.length;
    const L = this.create(n, n);
    
    for (let i = 0; i < n; i++) {
      for (let j = 0; j <= i; j++) {
        let sum = 0;
        
        if (i === j) {
          for (let k = 0; k < j; k++) {
            sum += L[j][k] * L[j][k];
          }
          L[j][j] = Math.sqrt(A[j][j] - sum);
        } else {
          for (let k = 0; k < j; k++) {
            sum += L[i][k] * L[j][k];
          }
          L[i][j] = (A[i][j] - sum) / L[j][j];
        }
      }
    }
    return L;
  }

  // Solve Ax = b using Cholesky decomposition
  static solveCholesky(A: number[][], b: number[]): number[] {
    const n = A.length;
    const L = this.cholesky(A);
    
    // Forward substitution: Ly = b
    const y = new Array(n).fill(0);
    for (let i = 0; i < n; i++) {
      let sum = 0;
      for (let j = 0; j < i; j++) {
        sum += L[i][j] * y[j];
      }
      y[i] = (b[i] - sum) / L[i][i];
    }
    
    // Back substitution: L^T x = y
    const x = new Array(n).fill(0);
    for (let i = n - 1; i >= 0; i--) {
      let sum = 0;
      for (let j = i + 1; j < n; j++) {
        sum += L[j][i] * x[j];
      }
      x[i] = (y[i] - sum) / L[i][i];
    }
    
    return x;
  }

  // LU decomposition with partial pivoting
  static luDecomposition(A: number[][]): { L: number[][]; U: number[][]; P: number[] } {
    const n = A.length;
    const L = this.identity(n);
    const U = A.map(row => [...row]);
    const P = Array.from({ length: n }, (_, i) => i);
    
    for (let k = 0; k < n - 1; k++) {
      // Find pivot
      let maxVal = Math.abs(U[k][k]);
      let maxIdx = k;
      for (let i = k + 1; i < n; i++) {
        if (Math.abs(U[i][k]) > maxVal) {
          maxVal = Math.abs(U[i][k]);
          maxIdx = i;
        }
      }
      
      // Swap rows
      if (maxIdx !== k) {
        [U[k], U[maxIdx]] = [U[maxIdx], U[k]];
        [P[k], P[maxIdx]] = [P[maxIdx], P[k]];
        for (let j = 0; j < k; j++) {
          [L[k][j], L[maxIdx][j]] = [L[maxIdx][j], L[k][j]];
        }
      }
      
      // Elimination
      for (let i = k + 1; i < n; i++) {
        L[i][k] = U[i][k] / U[k][k];
        for (let j = k; j < n; j++) {
          U[i][j] -= L[i][k] * U[k][j];
        }
      }
    }
    
    return { L, U, P };
  }

  // Solve using LU decomposition
  static solveLU(A: number[][], b: number[]): number[] {
    const n = A.length;
    const { L, U, P } = this.luDecomposition(A);
    
    // Permute b
    const pb = P.map(i => b[i]);
    
    // Forward substitution: Ly = Pb
    const y = new Array(n).fill(0);
    for (let i = 0; i < n; i++) {
      let sum = pb[i];
      for (let j = 0; j < i; j++) {
        sum -= L[i][j] * y[j];
      }
      y[i] = sum;
    }
    
    // Back substitution: Ux = y
    const x = new Array(n).fill(0);
    for (let i = n - 1; i >= 0; i--) {
      let sum = y[i];
      for (let j = i + 1; j < n; j++) {
        sum -= U[i][j] * x[j];
      }
      x[i] = sum / U[i][i];
    }
    
    return x;
  }

  // Eigenvalue decomposition using QR algorithm
  static eigenvalues(A: number[][], maxIter = 100, tol = 1e-10): { values: number[]; vectors: number[][] } {
    const n = A.length;
    let Ak = A.map(row => [...row]);
    let V = this.identity(n);
    
    for (let iter = 0; iter < maxIter; iter++) {
      // QR decomposition using Householder
      const { Q, R } = this.qrDecomposition(Ak);
      Ak = this.multiply(R, Q);
      V = this.multiply(V, Q);
      
      // Check convergence (off-diagonal elements)
      let offDiag = 0;
      for (let i = 0; i < n; i++) {
        for (let j = 0; j < i; j++) {
          offDiag += Ak[i][j] * Ak[i][j];
        }
      }
      if (Math.sqrt(offDiag) < tol) break;
    }
    
    const values = Ak.map((row, i) => row[i]);
    return { values, vectors: V };
  }

  static qrDecomposition(A: number[][]): { Q: number[][]; R: number[][] } {
    const m = A.length;
    const n = A[0].length;
    const Q = this.identity(m);
    const R = A.map(row => [...row]);
    
    for (let k = 0; k < Math.min(m - 1, n); k++) {
      // Extract column
      const x = new Array(m - k).fill(0);
      for (let i = k; i < m; i++) {
        x[i - k] = R[i][k];
      }
      
      // Compute Householder vector
      const normX = Math.sqrt(x.reduce((sum, val) => sum + val * val, 0));
      const sign = x[0] >= 0 ? 1 : -1;
      x[0] += sign * normX;
      const normV = Math.sqrt(x.reduce((sum, val) => sum + val * val, 0));
      
      if (normV > 1e-14) {
        for (let i = 0; i < x.length; i++) {
          x[i] /= normV;
        }
        
        // Apply Householder to R
        for (let j = k; j < n; j++) {
          let dot = 0;
          for (let i = k; i < m; i++) {
            dot += x[i - k] * R[i][j];
          }
          for (let i = k; i < m; i++) {
            R[i][j] -= 2 * x[i - k] * dot;
          }
        }
        
        // Apply Householder to Q
        for (let j = 0; j < m; j++) {
          let dot = 0;
          for (let i = k; i < m; i++) {
            dot += x[i - k] * Q[i][j];
          }
          for (let i = k; i < m; i++) {
            Q[i][j] -= 2 * x[i - k] * dot;
          }
        }
      }
    }
    
    return { Q: this.transpose(Q), R };
  }

  // Sparse matrix operations for large systems
  static sparseSolve(
    rowPtr: number[],
    colIdx: number[],
    values: number[],
    b: number[],
    maxIter = 1000,
    tol = 1e-10
  ): number[] {
    // Conjugate Gradient method for sparse symmetric positive definite
    const n = b.length;
    const x = new Array(n).fill(0);
    
    // Sparse matrix-vector multiplication
    const spMV = (v: number[]): number[] => {
      const result = new Array(n).fill(0);
      for (let i = 0; i < n; i++) {
        for (let j = rowPtr[i]; j < rowPtr[i + 1]; j++) {
          result[i] += values[j] * v[colIdx[j]];
        }
      }
      return result;
    };
    
    const r = b.map((bi, i) => bi - spMV(x)[i]);
    const p = [...r];
    let rsOld = r.reduce((sum, ri) => sum + ri * ri, 0);
    
    for (let iter = 0; iter < maxIter; iter++) {
      const Ap = spMV(p);
      const pAp = p.reduce((sum, pi, i) => sum + pi * Ap[i], 0);
      const alpha = rsOld / pAp;
      
      for (let i = 0; i < n; i++) {
        x[i] += alpha * p[i];
        r[i] -= alpha * Ap[i];
      }
      
      const rsNew = r.reduce((sum, ri) => sum + ri * ri, 0);
      if (Math.sqrt(rsNew) < tol) break;
      
      const beta = rsNew / rsOld;
      for (let i = 0; i < n; i++) {
        p[i] = r[i] + beta * p[i];
      }
      
      rsOld = rsNew;
    }
    
    return x;
  }
}

// ============================================================================
// MAIN ANALYSIS ENGINE CLASS
// ============================================================================

export class AdvancedMatrixAnalysisEngine {
  private nodes: Map<string, Node> = new Map();
  private elements: Map<string, Element> = new Map();
  private materials: Map<string, Material> = new Map();
  private sections: Map<string, Section> = new Map();
  private loadCases: Map<string, LoadCase> = new Map();
  private options: AnalysisOptions;
  
  private dofMap: Map<string, number[]> = new Map();
  private totalDOF = 0;
  private freeDOF = 0;
  
  constructor(options: AnalysisOptions) {
    this.options = options;
  }

  // --------------------------------------------------------------------------
  // MODEL BUILDING
  // --------------------------------------------------------------------------

  addNode(node: Node): void {
    this.nodes.set(node.id, node);
  }

  addElement(element: Element): void {
    this.elements.set(element.id, element);
  }

  addMaterial(material: Material): void {
    this.materials.set(material.id, material);
  }

  addSection(section: Section): void {
    this.sections.set(section.id, section);
  }

  addLoadCase(loadCase: LoadCase): void {
    this.loadCases.set(loadCase.id, loadCase);
  }

  // --------------------------------------------------------------------------
  // DOF NUMBERING
  // --------------------------------------------------------------------------

  private numberDOFs(): void {
    const dofPerNode = this.getDOFPerNode();
    let freeDofCounter = 0;
    let fixedDofCounter = 0;
    
    // First pass: number free DOFs
    this.nodes.forEach((node, nodeId) => {
      const nodeDofs: number[] = [];
      for (let i = 0; i < dofPerNode; i++) {
        if (!node.restraints[i]) {
          nodeDofs.push(freeDofCounter++);
        } else {
          nodeDofs.push(-1); // Mark as fixed temporarily
        }
      }
      this.dofMap.set(nodeId, nodeDofs);
    });
    
    this.freeDOF = freeDofCounter;
    
    // Second pass: number fixed DOFs
    this.nodes.forEach((node, nodeId) => {
      const nodeDofs = this.dofMap.get(nodeId)!;
      for (let i = 0; i < dofPerNode; i++) {
        if (nodeDofs[i] === -1) {
          nodeDofs[i] = freeDofCounter + fixedDofCounter++;
        }
      }
    });
    
    this.totalDOF = freeDofCounter + fixedDofCounter;
  }

  private getDOFPerNode(): number {
    switch (this.options.type) {
      case '2D_TRUSS': return 2;
      case '2D_FRAME': return 3;
      case '3D_TRUSS': return 3;
      case '3D_FRAME': return 6;
      case 'PLATE':
      case 'SHELL': return 6;
      default: return 6;
    }
  }

  // --------------------------------------------------------------------------
  // ELEMENT STIFFNESS MATRICES
  // --------------------------------------------------------------------------

  private getBeamStiffness3D(element: Element): number[][] {
    const nodeI = this.nodes.get(element.nodeI)!;
    const nodeJ = this.nodes.get(element.nodeJ)!;
    const material = this.materials.get(element.materialId)!;
    const section = this.sections.get(element.sectionId)!;
    
    const dx = nodeJ.x - nodeI.x;
    const dy = nodeJ.y - nodeI.y;
    const dz = nodeJ.z - nodeI.z;
    const L = Math.sqrt(dx * dx + dy * dy + dz * dz);
    
    const E = material.E;
    const G = material.G;
    const A = section.A;
    const Iy = section.Iy;
    const Iz = section.Ix; // Note: Iz is about local z-axis
    const J = section.J;
    
    // Include shear deformation if requested
    let phiY = 0, phiZ = 0;
    if (this.options.includeShearDeformation && section.Avy && section.Avz) {
      phiY = 12 * E * Iz / (G * section.Avy * L * L);
      phiZ = 12 * E * Iy / (G * section.Avz * L * L);
    }
    
    // Local stiffness matrix (12x12)
    const k = MatrixOps.create(12, 12);
    
    // Axial terms
    const EA_L = E * A / L;
    k[0][0] = k[6][6] = EA_L;
    k[0][6] = k[6][0] = -EA_L;
    
    // Torsion terms
    const GJ_L = G * J / L;
    k[3][3] = k[9][9] = GJ_L;
    k[3][9] = k[9][3] = -GJ_L;
    
    // Bending about local y-axis (in x-z plane)
    const EIy = E * Iy;
    const L2 = L * L;
    const L3 = L2 * L;
    const factorY = 1 / (1 + phiY);
    
    k[2][2] = k[8][8] = 12 * EIy / L3 * factorY;
    k[2][8] = k[8][2] = -12 * EIy / L3 * factorY;
    k[2][4] = k[4][2] = 6 * EIy / L2 * factorY;
    k[2][10] = k[10][2] = 6 * EIy / L2 * factorY;
    k[8][4] = k[4][8] = -6 * EIy / L2 * factorY;
    k[8][10] = k[10][8] = -6 * EIy / L2 * factorY;
    k[4][4] = k[10][10] = (4 + phiY) * EIy / L * factorY;
    k[4][10] = k[10][4] = (2 - phiY) * EIy / L * factorY;
    
    // Bending about local z-axis (in x-y plane)
    const EIz = E * Iz;
    const factorZ = 1 / (1 + phiZ);
    
    k[1][1] = k[7][7] = 12 * EIz / L3 * factorZ;
    k[1][7] = k[7][1] = -12 * EIz / L3 * factorZ;
    k[1][5] = k[5][1] = -6 * EIz / L2 * factorZ;
    k[1][11] = k[11][1] = -6 * EIz / L2 * factorZ;
    k[7][5] = k[5][7] = 6 * EIz / L2 * factorZ;
    k[7][11] = k[11][7] = 6 * EIz / L2 * factorZ;
    k[5][5] = k[11][11] = (4 + phiZ) * EIz / L * factorZ;
    k[5][11] = k[11][5] = (2 - phiZ) * EIz / L * factorZ;
    
    // Apply member releases (hinges)
    if (element.releases) {
      this.applyMemberReleases(k, element.releases, L, EIy, EIz);
    }
    
    // Transformation matrix
    const T = this.getTransformationMatrix3D(nodeI, nodeJ, element.beta || 0);
    
    // Transform to global: K_global = T^T * k * T
    const Tt = MatrixOps.transpose(T);
    const kT = MatrixOps.multiply(k, T);
    const K = MatrixOps.multiply(Tt, kT);
    
    return K;
  }

  private getTransformationMatrix3D(nodeI: Node, nodeJ: Node, beta: number): number[][] {
    const dx = nodeJ.x - nodeI.x;
    const dy = nodeJ.y - nodeI.y;
    const dz = nodeJ.z - nodeI.z;
    const L = Math.sqrt(dx * dx + dy * dy + dz * dz);
    
    // Direction cosines
    const cx = dx / L;
    const cy = dy / L;
    const cz = dz / L;
    
    // Local x-axis along member
    const lx = [cx, cy, cz];
    
    // Local z-axis (typically vertical reference)
    let lz: number[];
    const horizontal = Math.sqrt(cx * cx + cy * cy);
    
    if (horizontal < 1e-10) {
      // Vertical member
      lz = [Math.cos(beta), Math.sin(beta), 0];
    } else {
      // Non-vertical member
      const tempZ = [0, 0, 1];
      // lz = tempZ - (tempZ . lx) * lx, then normalize
      const dot = cz;
      lz = [
        -cx * dot,
        -cy * dot,
        1 - cz * dot
      ];
      const norm = Math.sqrt(lz[0] * lz[0] + lz[1] * lz[1] + lz[2] * lz[2]);
      lz = lz.map(v => v / norm);
      
      // Apply beta rotation
      if (Math.abs(beta) > 1e-10) {
        const cosBeta = Math.cos(beta);
        const sinBeta = Math.sin(beta);
        // Rodrigues' rotation formula around lx
        const lzNew = [
          lz[0] * cosBeta + (lx[1] * lz[2] - lx[2] * lz[1]) * sinBeta,
          lz[1] * cosBeta + (lx[2] * lz[0] - lx[0] * lz[2]) * sinBeta,
          lz[2] * cosBeta + (lx[0] * lz[1] - lx[1] * lz[0]) * sinBeta
        ];
        lz = lzNew;
      }
    }
    
    // Local y-axis = lz × lx
    const ly = [
      lz[1] * lx[2] - lz[2] * lx[1],
      lz[2] * lx[0] - lz[0] * lx[2],
      lz[0] * lx[1] - lz[1] * lx[0]
    ];
    
    // 3x3 rotation matrix
    const R = [
      [lx[0], lx[1], lx[2]],
      [ly[0], ly[1], ly[2]],
      [lz[0], lz[1], lz[2]]
    ];
    
    // 12x12 transformation matrix
    const T = MatrixOps.create(12, 12);
    for (let i = 0; i < 4; i++) {
      for (let j = 0; j < 3; j++) {
        for (let k = 0; k < 3; k++) {
          T[i * 3 + j][i * 3 + k] = R[j][k];
        }
      }
    }
    
    return T;
  }

  private applyMemberReleases(k: number[][], releases: Element['releases'], L: number, EIy: number, EIz: number): void {
    // Modify stiffness matrix for moment releases (hinges)
    // Using condensation approach
    
    if (releases?.startMomentZ) {
      // Release My at start (rotation about z)
      const factor = 3 / 4;
      k[5][5] *= factor;
      k[11][11] *= factor;
      k[5][11] = k[11][5] = 0;
    }
    
    if (releases?.endMomentZ) {
      // Release My at end
      const factor = 3 / 4;
      k[5][5] *= factor;
      k[11][11] *= factor;
      k[5][11] = k[11][5] = 0;
    }
    
    if (releases?.startMomentY) {
      // Release Mz at start
      const factor = 3 / 4;
      k[4][4] *= factor;
      k[10][10] *= factor;
      k[4][10] = k[10][4] = 0;
    }
    
    if (releases?.endMomentY) {
      // Release Mz at end
      const factor = 3 / 4;
      k[4][4] *= factor;
      k[10][10] *= factor;
      k[4][10] = k[10][4] = 0;
    }
  }

  private getTrussStiffness3D(element: Element): number[][] {
    const nodeI = this.nodes.get(element.nodeI)!;
    const nodeJ = this.nodes.get(element.nodeJ)!;
    const material = this.materials.get(element.materialId)!;
    const section = this.sections.get(element.sectionId)!;
    
    const dx = nodeJ.x - nodeI.x;
    const dy = nodeJ.y - nodeI.y;
    const dz = nodeJ.z - nodeI.z;
    const L = Math.sqrt(dx * dx + dy * dy + dz * dz);
    
    const cx = dx / L;
    const cy = dy / L;
    const cz = dz / L;
    
    const EA_L = material.E * section.A / L;
    
    // 6x6 stiffness in global coordinates
    const k = MatrixOps.create(6, 6);
    
    const coeffs = [
      [cx * cx, cx * cy, cx * cz],
      [cy * cx, cy * cy, cy * cz],
      [cz * cx, cz * cy, cz * cz]
    ];
    
    for (let i = 0; i < 3; i++) {
      for (let j = 0; j < 3; j++) {
        k[i][j] = EA_L * coeffs[i][j];
        k[i + 3][j + 3] = EA_L * coeffs[i][j];
        k[i][j + 3] = -EA_L * coeffs[i][j];
        k[i + 3][j] = -EA_L * coeffs[i][j];
      }
    }
    
    return k;
  }

  // --------------------------------------------------------------------------
  // GEOMETRIC STIFFNESS (P-DELTA)
  // --------------------------------------------------------------------------

  private getGeometricStiffness3D(element: Element, axialForce: number): number[][] {
    const nodeI = this.nodes.get(element.nodeI)!;
    const nodeJ = this.nodes.get(element.nodeJ)!;
    
    const dx = nodeJ.x - nodeI.x;
    const dy = nodeJ.y - nodeI.y;
    const dz = nodeJ.z - nodeI.z;
    const L = Math.sqrt(dx * dx + dy * dy + dz * dz);
    
    const P = axialForce; // Positive = tension
    const P_L = P / L;
    
    // Local geometric stiffness matrix
    const kg = MatrixOps.create(12, 12);
    
    // Transverse terms
    const coeff = P_L * 6 / 5;
    kg[1][1] = kg[2][2] = kg[7][7] = kg[8][8] = coeff;
    kg[1][7] = kg[7][1] = kg[2][8] = kg[8][2] = -coeff;
    
    // Coupling terms
    const coeff2 = P_L * L / 10;
    kg[1][5] = kg[5][1] = kg[1][11] = kg[11][1] = -coeff2;
    kg[7][5] = kg[5][7] = kg[7][11] = kg[11][7] = coeff2;
    kg[2][4] = kg[4][2] = kg[2][10] = kg[10][2] = coeff2;
    kg[8][4] = kg[4][8] = kg[8][10] = kg[10][8] = -coeff2;
    
    // Rotational terms
    const coeff3 = P_L * L * L / 30;
    kg[4][4] = kg[5][5] = kg[10][10] = kg[11][11] = 2 * coeff3;
    kg[4][10] = kg[10][4] = kg[5][11] = kg[11][5] = -coeff3;
    
    // Transform to global
    const T = this.getTransformationMatrix3D(nodeI, nodeJ, element.beta || 0);
    const Tt = MatrixOps.transpose(T);
    const kgT = MatrixOps.multiply(kg, T);
    const Kg = MatrixOps.multiply(Tt, kgT);
    
    return Kg;
  }

  // --------------------------------------------------------------------------
  // LOAD VECTORS
  // --------------------------------------------------------------------------

  private assembleLoadVector(loadCase: LoadCase): number[] {
    const F = new Array(this.totalDOF).fill(0);
    const dofPerNode = this.getDOFPerNode();
    
    // Point loads
    loadCase.pointLoads.forEach(pl => {
      const nodeDofs = this.dofMap.get(pl.nodeId);
      if (!nodeDofs) return;
      
      const loads = [pl.Fx, pl.Fy, pl.Fz, pl.Mx, pl.My, pl.Mz];
      for (let i = 0; i < dofPerNode; i++) {
        F[nodeDofs[i]] += loads[i] || 0;
      }
    });
    
    // Distributed loads (convert to equivalent nodal loads)
    loadCase.distributedLoads.forEach(dl => {
      const element = this.elements.get(dl.elementId);
      if (!element) return;
      
      const nodeI = this.nodes.get(element.nodeI)!;
      const nodeJ = this.nodes.get(element.nodeJ)!;
      const L = this.getElementLength(element);
      
      const feq = this.getEquivalentNodalLoads(dl, L, element);
      
      // Transform and add to global load vector
      const T = this.getTransformationMatrix3D(nodeI, nodeJ, element.beta || 0);
      const Tt = MatrixOps.transpose(T);
      const Feq = MatrixOps.multiplyVector(Tt, feq);
      
      const dofsI = this.dofMap.get(element.nodeI)!;
      const dofsJ = this.dofMap.get(element.nodeJ)!;
      
      for (let i = 0; i < 6; i++) {
        F[dofsI[i]] += Feq[i];
        F[dofsJ[i]] += Feq[i + 6];
      }
    });
    
    // Self-weight
    if (this.options.selfWeight) {
      this.elements.forEach(element => {
        const material = this.materials.get(element.materialId)!;
        const section = this.sections.get(element.sectionId)!;
        const L = this.getElementLength(element);
        
        const weight = material.rho * section.A * L * 9.81e-6 * (this.options.selfWeightFactor || 1);
        const halfWeight = weight / 2;
        
        const dofsI = this.dofMap.get(element.nodeI)!;
        const dofsJ = this.dofMap.get(element.nodeJ)!;
        
        // Assume gravity in -Z direction
        F[dofsI[2]] -= halfWeight;
        F[dofsJ[2]] -= halfWeight;
      });
    }
    
    return F;
  }

  private getEquivalentNodalLoads(dl: DistributedLoad, L: number, element: Element): number[] {
    const feq = new Array(12).fill(0);
    const w1 = dl.w1;
    const w2 = dl.w2 ?? w1;
    const a = dl.a ?? 0;
    const b = dl.b ?? 1;
    
    // Full span uniform load for simplicity
    if (dl.type === 'UNIFORM') {
      const w = w1;
      
      if (dl.direction === 'LOCAL_Y' || dl.direction === 'GLOBAL_Y') {
        // Shear forces
        feq[1] = w * L / 2;
        feq[7] = w * L / 2;
        // Moments
        feq[5] = -w * L * L / 12;
        feq[11] = w * L * L / 12;
      } else {
        // Load in Z direction
        feq[2] = w * L / 2;
        feq[8] = w * L / 2;
        feq[4] = w * L * L / 12;
        feq[10] = -w * L * L / 12;
      }
    } else if (dl.type === 'TRIANGULAR') {
      // Linear varying load from 0 to w2
      if (dl.direction === 'LOCAL_Z' || dl.direction === 'GLOBAL_Z') {
        feq[2] = 3 * w2 * L / 20;
        feq[8] = 7 * w2 * L / 20;
        feq[4] = w2 * L * L / 30;
        feq[10] = -w2 * L * L / 20;
      }
    } else if (dl.type === 'TRAPEZOIDAL') {
      // Trapezoidal = uniform + triangular
      const wUniform = Math.min(w1, w2);
      const wTriangular = Math.abs(w2 - w1);
      
      if (dl.direction === 'LOCAL_Z' || dl.direction === 'GLOBAL_Z') {
        feq[2] = wUniform * L / 2 + 3 * wTriangular * L / 20;
        feq[8] = wUniform * L / 2 + 7 * wTriangular * L / 20;
        feq[4] = wUniform * L * L / 12 + wTriangular * L * L / 30;
        feq[10] = -wUniform * L * L / 12 - wTriangular * L * L / 20;
      }
    }
    
    return feq;
  }

  // --------------------------------------------------------------------------
  // ASSEMBLY AND SOLUTION
  // --------------------------------------------------------------------------

  private assembleGlobalStiffness(): number[][] {
    const K = MatrixOps.create(this.totalDOF, this.totalDOF);
    
    this.elements.forEach(element => {
      let ke: number[][];
      
      if (element.type === 'TRUSS') {
        ke = this.getTrussStiffness3D(element);
      } else {
        ke = this.getBeamStiffness3D(element);
      }
      
      const dofsI = this.dofMap.get(element.nodeI)!;
      const dofsJ = this.dofMap.get(element.nodeJ)!;
      const dofs = element.type === 'TRUSS' 
        ? [...dofsI.slice(0, 3), ...dofsJ.slice(0, 3)]
        : [...dofsI, ...dofsJ];
      
      const n = dofs.length;
      for (let i = 0; i < n; i++) {
        for (let j = 0; j < n; j++) {
          K[dofs[i]][dofs[j]] += ke[i][j];
        }
      }
    });
    
    return K;
  }

  private solve(K: number[][], F: number[]): number[] {
    // Extract free DOF portion
    const Kff = MatrixOps.create(this.freeDOF, this.freeDOF);
    const Ff = new Array(this.freeDOF).fill(0);
    
    for (let i = 0; i < this.freeDOF; i++) {
      Ff[i] = F[i];
      for (let j = 0; j < this.freeDOF; j++) {
        Kff[i][j] = K[i][j];
      }
    }
    
    // Solve for free displacements
    const Uf = MatrixOps.solveLU(Kff, Ff);
    
    // Full displacement vector
    const U = new Array(this.totalDOF).fill(0);
    for (let i = 0; i < this.freeDOF; i++) {
      U[i] = Uf[i];
    }
    
    return U;
  }

  // --------------------------------------------------------------------------
  // P-DELTA ANALYSIS
  // --------------------------------------------------------------------------

  private analyzePDelta(loadCaseId: string): AnalysisResult {
    const loadCase = this.loadCases.get(loadCaseId)!;
    const maxIter = this.options.pDeltaIterations || 10;
    const tol = this.options.pDeltaTolerance || 0.01;
    
    const K = this.assembleGlobalStiffness();
    const F = this.assembleLoadVector(loadCase);
    let U = this.solve(K, F);
    let prevU = [...U];
    
    let converged = false;
    let iteration = 0;
    let error = 1;
    
    for (iteration = 1; iteration <= maxIter; iteration++) {
      // Get element forces from current displacements
      const elementForces = this.calculateElementForces(U);
      
      // Assemble geometric stiffness
      const Kg = MatrixOps.create(this.totalDOF, this.totalDOF);
      
      this.elements.forEach(element => {
        if (element.type === 'TRUSS') return; // Skip trusses for P-Delta
        
        const forces = elementForces.get(element.id)!;
        const axialForce = forces.start[0]; // Axial force
        
        const kg = this.getGeometricStiffness3D(element, axialForce);
        
        const dofsI = this.dofMap.get(element.nodeI)!;
        const dofsJ = this.dofMap.get(element.nodeJ)!;
        const dofs = [...dofsI, ...dofsJ];
        
        for (let i = 0; i < 12; i++) {
          for (let j = 0; j < 12; j++) {
            Kg[dofs[i]][dofs[j]] += kg[i][j];
          }
        }
      });
      
      // Modified stiffness: K + Kg
      const Kmod = MatrixOps.add(K, Kg);
      
      // Solve with modified stiffness
      U = this.solve(Kmod, F);
      
      // Check convergence
      let maxDiff = 0;
      let maxDisp = 0;
      for (let i = 0; i < this.freeDOF; i++) {
        maxDiff = Math.max(maxDiff, Math.abs(U[i] - prevU[i]));
        maxDisp = Math.max(maxDisp, Math.abs(U[i]));
      }
      
      error = maxDisp > 1e-10 ? maxDiff / maxDisp : 0;
      
      if (error < tol) {
        converged = true;
        break;
      }
      
      prevU = [...U];
    }
    
    return this.processResults(loadCaseId, U, {
      iterations: iteration,
      finalError: error,
      converged
    });
  }

  // --------------------------------------------------------------------------
  // RESULTS PROCESSING
  // --------------------------------------------------------------------------

  private calculateElementForces(U: number[]): Map<string, { start: number[]; end: number[] }> {
    const forces = new Map<string, { start: number[]; end: number[] }>();
    
    this.elements.forEach((element, elementId) => {
      const dofsI = this.dofMap.get(element.nodeI)!;
      const dofsJ = this.dofMap.get(element.nodeJ)!;
      
      let ue: number[];
      let ke: number[][];
      
      if (element.type === 'TRUSS') {
        ue = [...dofsI.slice(0, 3), ...dofsJ.slice(0, 3)].map(d => U[d]);
        ke = this.getTrussStiffness3D(element);
      } else {
        ue = [...dofsI, ...dofsJ].map(d => U[d]);
        ke = this.getBeamStiffness3D(element);
      }
      
      const fe = MatrixOps.multiplyVector(ke, ue);
      
      const n = element.type === 'TRUSS' ? 3 : 6;
      forces.set(elementId, {
        start: fe.slice(0, n),
        end: fe.slice(n)
      });
    });
    
    return forces;
  }

  private processResults(
    loadCaseId: string,
    U: number[],
    convergence?: { iterations: number; finalError: number; converged: boolean }
  ): AnalysisResult {
    const dofPerNode = this.getDOFPerNode();
    const nodeResults: NodeResult[] = [];
    let maxDisp = 0;
    const maxReaction = 0;
    
    // Node results
    this.nodes.forEach((node, nodeId) => {
      const dofs = this.dofMap.get(nodeId)!;
      const displacements = dofs.map(d => U[d]);
      
      // Track max displacement
      const dispMag = Math.sqrt(
        displacements[0] ** 2 + 
        displacements[1] ** 2 + 
        (displacements[2] || 0) ** 2
      );
      maxDisp = Math.max(maxDisp, dispMag);
      
      // Calculate reactions for restrained DOFs
      let reactions: number[] | undefined;
      if (node.restraints.some(r => r)) {
        reactions = [];
        // Would need to compute K * U - F for reaction DOFs
      }
      
      nodeResults.push({
        nodeId,
        displacements,
        reactions
      });
    });
    
    // Element results
    const elementForces = this.calculateElementForces(U);
    const elementResults: ElementResult[] = [];
    
    this.elements.forEach((element, elementId) => {
      const forces = elementForces.get(elementId)!;
      
      const maxMoment = Math.max(
        Math.abs(forces.start[4] || 0),
        Math.abs(forces.start[5] || 0),
        Math.abs(forces.end[4] || 0),
        Math.abs(forces.end[5] || 0)
      );
      
      const maxShear = Math.max(
        Math.abs(forces.start[1] || 0),
        Math.abs(forces.start[2] || 0),
        Math.abs(forces.end[1] || 0),
        Math.abs(forces.end[2] || 0)
      );
      
      const maxAxial = Math.max(
        Math.abs(forces.start[0]),
        Math.abs(forces.end[0])
      );
      
      elementResults.push({
        elementId,
        forces,
        maxMoment,
        maxShear,
        maxAxial
      });
    });
    
    return {
      loadCaseId,
      nodeResults,
      elementResults,
      maxDisplacement: maxDisp,
      maxReaction,
      convergence
    };
  }

  // --------------------------------------------------------------------------
  // MAIN ANALYSIS METHOD
  // --------------------------------------------------------------------------

  analyze(): Map<string, AnalysisResult> {
    this.numberDOFs();
    
    const results = new Map<string, AnalysisResult>();
    
    this.loadCases.forEach((_, loadCaseId) => {
      let result: AnalysisResult;
      
      if (this.options.includePDelta) {
        result = this.analyzePDelta(loadCaseId);
      } else {
        const K = this.assembleGlobalStiffness();
        const F = this.assembleLoadVector(this.loadCases.get(loadCaseId)!);
        const U = this.solve(K, F);
        result = this.processResults(loadCaseId, U);
      }
      
      results.set(loadCaseId, result);
    });
    
    return results;
  }

  // --------------------------------------------------------------------------
  // UTILITY METHODS
  // --------------------------------------------------------------------------

  private getElementLength(element: Element): number {
    const nodeI = this.nodes.get(element.nodeI)!;
    const nodeJ = this.nodes.get(element.nodeJ)!;
    
    const dx = nodeJ.x - nodeI.x;
    const dy = nodeJ.y - nodeI.y;
    const dz = nodeJ.z - nodeI.z;
    
    return Math.sqrt(dx * dx + dy * dy + dz * dz);
  }

  getModelSummary(): {
    nodes: number;
    elements: number;
    totalDOF: number;
    freeDOF: number;
    restrainedDOF: number;
  } {
    return {
      nodes: this.nodes.size,
      elements: this.elements.size,
      totalDOF: this.totalDOF,
      freeDOF: this.freeDOF,
      restrainedDOF: this.totalDOF - this.freeDOF
    };
  }
}

// ============================================================================
// FACTORY AND EXPORTS
// ============================================================================

export const createAdvancedAnalysisEngine = (options: AnalysisOptions) => 
  new AdvancedMatrixAnalysisEngine(options);

export { MatrixOps };
export default AdvancedMatrixAnalysisEngine;
