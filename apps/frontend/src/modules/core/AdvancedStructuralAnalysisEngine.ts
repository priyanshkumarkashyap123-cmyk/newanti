/**
 * ============================================================================
 * ADVANCED STRUCTURAL ANALYSIS ENGINE V3.0
 * ============================================================================
 *
 * Comprehensive structural analysis with:
 * - Direct Stiffness Method (Matrix Analysis)
 * - 2D/3D Frame Analysis
 * - Truss Analysis
 * - Continuous Beam Analysis
 * - Moment Distribution Method
 * - Portal Frame Analysis
 * - P-Delta Analysis
 * - Modal Analysis
 *
 * @version 3.0.0
 */

import { PrecisionMath, EngineeringMath } from "./PrecisionMath";
import {
  EngineeringErrorHandler,
  ErrorSeverity,
} from "./EngineeringErrorHandler";

// ============================================================================
// TYPES AND INTERFACES
// ============================================================================

export type AnalysisType =
  | "2D_frame"
  | "3D_frame"
  | "truss"
  | "continuous_beam"
  | "portal_frame";

export type SupportType = "fixed" | "pinned" | "roller" | "spring" | "free";

export type LoadType =
  | "point_load"
  | "udl"
  | "uvl"
  | "moment"
  | "temperature"
  | "settlement";

export interface Node {
  id: number;
  x: number;
  y: number;
  z?: number;
  support?: SupportType;
  springStiffness?: {
    kx?: number;
    ky?: number;
    kz?: number;
    krx?: number;
    kry?: number;
    krz?: number;
  };
}

export interface Member {
  id: number;
  startNode: number;
  endNode: number;
  E: number; // Modulus of elasticity (MPa)
  A: number; // Cross-sectional area (mm²)
  I: number; // Moment of inertia (mm⁴)
  Iz?: number; // Moment of inertia about z-axis (mm⁴)
  J?: number; // Torsional constant (mm⁴)
  G?: number; // Shear modulus (MPa)
  release?: {
    start?: { moment?: boolean; axial?: boolean; shear?: boolean };
    end?: { moment?: boolean; axial?: boolean; shear?: boolean };
  };
}

export interface PointLoad {
  type: "point_load";
  nodeId?: number;
  memberId?: number;
  position?: number; // Distance from start for member loads (0-1)
  Fx: number; // Force in X direction (kN)
  Fy: number; // Force in Y direction (kN)
  Fz?: number; // Force in Z direction (kN)
}

export interface DistributedLoad {
  type: "udl" | "uvl";
  memberId: number;
  w1: number; // Load intensity at start (kN/m)
  w2?: number; // Load intensity at end for UVL (kN/m)
  startPos?: number; // Start position (0-1)
  endPos?: number; // End position (0-1)
  direction: "global" | "local";
}

export interface MomentLoad {
  type: "moment";
  nodeId?: number;
  memberId?: number;
  position?: number;
  Mx?: number; // Moment about X axis (kNm)
  My?: number; // Moment about Y axis (kNm)
  Mz?: number; // Moment about Z axis (kNm)
}

export type Load = PointLoad | DistributedLoad | MomentLoad;

export interface LoadCombination {
  name: string;
  factors: { [loadCaseName: string]: number };
}

export interface AnalysisInput {
  analysisType: AnalysisType;
  nodes: Node[];
  members: Member[];
  loads: { [loadCaseName: string]: Load[] };
  combinations?: LoadCombination[];
  options?: {
    includePDelta?: boolean;
    maxIterations?: number;
    tolerance?: number;
    includeShearDeformation?: boolean;
  };
}

export interface NodeDisplacement {
  nodeId: number;
  dx: number; // mm
  dy: number; // mm
  dz?: number; // mm
  rx?: number; // rad
  ry?: number; // rad
  rz: number; // rad
}

export interface MemberForce {
  memberId: number;
  startForces: {
    axial: number; // kN
    shearY: number; // kN
    shearZ?: number; // kN
    moment: number; // kNm
    momentY?: number; // kNm
    torsion?: number; // kNm
  };
  endForces: {
    axial: number;
    shearY: number;
    shearZ?: number;
    moment: number;
    momentY?: number;
    torsion?: number;
  };
  maxBendingMoment: number;
  maxShear: number;
  maxAxial: number;
}

export interface Reaction {
  nodeId: number;
  Rx: number; // kN
  Ry: number; // kN
  Rz?: number; // kN
  Mx?: number; // kNm
  My?: number; // kNm
  Mz?: number; // kNm
}

export interface AnalysisResult {
  analysisType: AnalysisType;
  loadCase: string;

  displacements: NodeDisplacement[];
  memberForces: MemberForce[];
  reactions: Reaction[];

  globalStiffnessMatrix?: number[][];
  eigenvalues?: number[];
  modeShapes?: number[][];

  convergence?: {
    iterations: number;
    finalError: number;
    converged: boolean;
  };

  summary: {
    maxDisplacement: { node: number; value: number; direction: string };
    maxMoment: { member: number; value: number };
    maxShear: { member: number; value: number };
    maxAxial: { member: number; value: number };
  };

  calculations?: {
    step: number;
    description: string;
    details: string;
  }[];
}

// ============================================================================
// MATRIX UTILITIES
// ============================================================================

class MatrixOps {
  static create(rows: number, cols: number, fill: number = 0): number[][] {
    return Array(rows)
      .fill(null)
      .map(() => Array(cols).fill(fill));
  }

  static identity(n: number): number[][] {
    const matrix = this.create(n, n, 0);
    for (let i = 0; i < n; i++) {
      if (matrix[i]) {
        matrix[i]![i] = 1;
      }
    }
    return matrix;
  }

  static multiply(A: number[][], B: number[][]): number[][] {
    const rowsA = A.length;
    const colsA = A[0]?.length || 0;
    const colsB = B[0]?.length || 0;

    const result = this.create(rowsA, colsB, 0);

    for (let i = 0; i < rowsA; i++) {
      for (let j = 0; j < colsB; j++) {
        for (let k = 0; k < colsA; k++) {
          if (result[i] && A[i] && B[k]) {
            result[i]![j]! += (A[i]![k] || 0) * (B[k]![j] || 0);
          }
        }
      }
    }

    return result;
  }

  static multiplyVector(A: number[][], v: number[]): number[] {
    const n = A.length;
    const result = new Array(n).fill(0);

    for (let i = 0; i < n; i++) {
      const cols = A[0]?.length || 0;
      for (let j = 0; j < cols; j++) {
        if (A[i]) {
          result[i] += (A[i]![j] || 0) * (v[j] || 0);
        }
      }
    }

    return result;
  }

  static transpose(A: number[][]): number[][] {
    const rows = A.length;
    const cols = A[0]?.length || 0;
    const result = this.create(cols, rows, 0);

    for (let i = 0; i < rows; i++) {
      for (let j = 0; j < cols; j++) {
        if (result[j] && A[i]) {
          result[j]![i] = A[i]![j] || 0;
        }
      }
    }

    return result;
  }

  static add(A: number[][], B: number[][]): number[][] {
    const rows = A.length;
    const cols = A[0]?.length || 0;
    const result = this.create(rows, cols, 0);

    for (let i = 0; i < rows; i++) {
      for (let j = 0; j < cols; j++) {
        if (result[i] && A[i] && B[i]) {
          result[i]![j] = (A[i]![j] || 0) + (B[i]![j] || 0);
        }
      }
    }

    return result;
  }

  static scale(A: number[][], scalar: number): number[][] {
    return A.map((row) => row.map((val) => val * scalar));
  }

  // LU Decomposition for solving linear systems
  static luDecomposition(A: number[][]): {
    L: number[][];
    U: number[][];
    P: number[];
  } {
    const n = A.length;
    const L = this.create(n, n, 0);
    const U = this.create(n, n, 0);
    const P = Array(n)
      .fill(0)
      .map((_, i) => i);

    // Copy A to U
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        if (U[i] && A[i]) {
          U[i]![j] = A[i]![j] || 0;
        }
      }
    }

    // Gaussian elimination with partial pivoting
    for (let k = 0; k < n; k++) {
      // Find pivot
      let maxVal = Math.abs(U[k]?.[k] || 0);
      let maxRow = k;

      for (let i = k + 1; i < n; i++) {
        if (Math.abs(U[i]?.[k] || 0) > maxVal) {
          maxVal = Math.abs(U[i]?.[k] || 0);
          maxRow = i;
        }
      }

      // Swap rows
      if (maxRow !== k) {
        const tempU = U[k];
        U[k] = U[maxRow]!;
        U[maxRow] = tempU!;

        const tempL = L[k];
        L[k] = L[maxRow]!;
        L[maxRow] = tempL!;

        const tempP = P[k];
        P[k] = P[maxRow]!;
        P[maxRow] = tempP!;
      }

      if (L[k]) {
        L[k]![k] = 1;
      }

      // Eliminate
      for (let i = k + 1; i < n; i++) {
        if (Math.abs(U[k]?.[k] || 0) > 1e-12) {
          if (L[i] && U[i] && U[k]) {
            L[i]![k] = (U[i]![k] || 0) / (U[k]![k] || 1);
            for (let j = k; j < n; j++) {
              U[i]![j] -= (L[i]![k] || 0) * (U[k]![j] || 0);
            }
          }
        }
      }
    }

    return { L, U, P };
  }

  static solve(A: number[][], b: number[]): number[] {
    const n = A.length;
    const { L, U, P } = this.luDecomposition(A);

    // Apply permutation to b
    const pb = new Array(n);
    for (let i = 0; i < n; i++) {
      const pIndex = P[i];
      pb[i] = pIndex !== undefined ? b[pIndex] : 0;
    }

    // Forward substitution: Ly = pb
    const y = new Array(n).fill(0);
    for (let i = 0; i < n; i++) {
      y[i] = pb[i] || 0;
      for (let j = 0; j < i; j++) {
        if (L[i]) {
          y[i] -= (L[i]![j] || 0) * (y[j] || 0);
        }
      }
    }

    // Back substitution: Ux = y
    const x = new Array(n).fill(0);
    for (let i = n - 1; i >= 0; i--) {
      x[i] = y[i] || 0;
      for (let j = i + 1; j < n; j++) {
        if (U[i]) {
          x[i] -= (U[i]![j] || 0) * (x[j] || 0);
        }
      }
      if (U[i] && Math.abs(U[i]![i] || 0) > 1e-12) {
        x[i] /= U[i]![i] || 1;
      }
    }

    return x;
  }

  // Cholesky decomposition for symmetric positive definite matrices
  static choleskyDecomposition(A: number[][]): number[][] {
    const n = A.length;
    const L = this.create(n, n, 0);

    for (let i = 0; i < n; i++) {
      for (let j = 0; j <= i; j++) {
        let sum = 0;

        if (j === i) {
          for (let k = 0; k < j; k++) {
            if (L[j]) {
              sum += (L[j]![k] || 0) * (L[j]![k] || 0);
            }
          }
          const val = (A[j]?.[j] || 0) - sum;
          if (L[j]) {
            L[j]![j] = val > 0 ? Math.sqrt(val) : 0;
          }
        } else {
          for (let k = 0; k < j; k++) {
            if (L[i] && L[j]) {
              sum += (L[i]![k] || 0) * (L[j]![k] || 0);
            }
          }
          if (L[i] && L[j] && A[i]) {
            const ljj = L[j]![j] || 0;
            L[i]![j] = ljj !== 0 ? ((A[i]![j] || 0) - sum) / ljj : 0;
          }
        }
      }
    }

    return L;
  }
}

// ============================================================================
// MAIN STRUCTURAL ANALYSIS ENGINE
// ============================================================================

export class AdvancedStructuralAnalysisEngine {
  private input: AnalysisInput;
  private nodeMap: Map<number, number>; // Node ID -> DOF start index
  private totalDOFs: number;
  private errorHandler: EngineeringErrorHandler;

  constructor(input: AnalysisInput) {
    this.input = input;
    this.nodeMap = new Map();
    this.totalDOFs = 0;
    this.errorHandler = new EngineeringErrorHandler({
      context: { module: "StructuralAnalysis", function: "constructor" },
    });
    this.initializeDOFs();
  }

  private initializeDOFs(): void {
    const dofsPerNode = this.input.analysisType === "3D_frame" ? 6 : 3;

    this.input.nodes.forEach((node, index) => {
      this.nodeMap.set(node.id, index * dofsPerNode);
    });

    this.totalDOFs = this.input.nodes.length * dofsPerNode;
  }

  // --------------------------------------------------------------------------
  // MAIN ANALYSIS METHOD
  // --------------------------------------------------------------------------

  public analyze(): Map<string, AnalysisResult> {
    const results = new Map<string, AnalysisResult>();

    for (const [loadCaseName, loads] of Object.entries(this.input.loads)) {
      const result = this.analyzeLoadCase(loadCaseName, loads);
      results.set(loadCaseName, result);
    }

    // Analyze combinations if provided
    if (this.input.combinations) {
      for (const combination of this.input.combinations) {
        const result = this.analyzeCombination(combination, results);
        results.set(combination.name, result);
      }
    }

    return results;
  }

  private analyzeLoadCase(name: string, loads: Load[]): AnalysisResult {
    const calculations: AnalysisResult["calculations"] = [];

    // Step 1: Assemble global stiffness matrix
    calculations.push({
      step: 1,
      description: "Assemble Global Stiffness Matrix",
      details: `Creating ${this.totalDOFs}×${this.totalDOFs} global stiffness matrix`,
    });

    const K_global = this.assembleGlobalStiffnessMatrix();

    // Step 2: Assemble load vector
    calculations.push({
      step: 2,
      description: "Assemble Load Vector",
      details: `Processing ${loads.length} loads for load case: ${name}`,
    });

    const F_global = this.assembleLoadVector(loads);

    // Step 3: Apply boundary conditions
    calculations.push({
      step: 3,
      description: "Apply Boundary Conditions",
      details: "Modifying stiffness matrix for support conditions",
    });

    const { K_reduced, F_reduced, freeDOFs, fixedDOFs } =
      this.applyBoundaryConditions(K_global, F_global);

    // Step 4: Solve for displacements
    calculations.push({
      step: 4,
      description: "Solve System of Equations",
      details: `Solving [K]{D} = {F} for ${freeDOFs.length} unknown displacements`,
    });

    let displacements: number[];

    if (this.input.options?.includePDelta) {
      displacements = this.solveWithPDelta(
        K_global,
        F_global,
        freeDOFs,
        fixedDOFs,
      );
    } else {
      const D_free = MatrixOps.solve(K_reduced, F_reduced);
      displacements = this.expandDisplacements(D_free, freeDOFs, fixedDOFs);
    }

    // Step 5: Calculate member forces
    calculations.push({
      step: 5,
      description: "Calculate Member Forces",
      details: "Computing internal forces in all members",
    });

    const memberForces = this.calculateMemberForces(displacements, loads);

    // Step 6: Calculate reactions
    calculations.push({
      step: 6,
      description: "Calculate Reactions",
      details: "Computing support reactions",
    });

    const reactions = this.calculateReactions(
      K_global,
      displacements,
      F_global,
    );

    // Create node displacements
    const nodeDisplacements = this.createNodeDisplacements(displacements);

    // Calculate summary
    const summary = this.calculateSummary(nodeDisplacements, memberForces);

    return {
      analysisType: this.input.analysisType,
      loadCase: name,
      displacements: nodeDisplacements,
      memberForces,
      reactions,
      globalStiffnessMatrix: K_global,
      summary,
      calculations,
    };
  }

  // --------------------------------------------------------------------------
  // STIFFNESS MATRIX ASSEMBLY
  // --------------------------------------------------------------------------

  private assembleGlobalStiffnessMatrix(): number[][] {
    const K = MatrixOps.create(this.totalDOFs, this.totalDOFs, 0);

    for (const member of this.input.members) {
      const k_local = this.calculateLocalStiffnessMatrix(member);
      const T = this.getTransformationMatrix(member);

      // Transform to global: k_global = T' * k_local * T
      const k_global = MatrixOps.multiply(
        MatrixOps.multiply(MatrixOps.transpose(T), k_local),
        T,
      );

      // Add to global matrix
      this.addToGlobalMatrix(K, k_global, member);
    }

    return K;
  }

  private calculateLocalStiffnessMatrix(member: Member): number[][] {
    const startNode = this.input.nodes.find((n) => n.id === member.startNode)!;
    const endNode = this.input.nodes.find((n) => n.id === member.endNode)!;

    const dx = endNode.x - startNode.x;
    const dy = endNode.y - startNode.y;
    const dz = (endNode.z || 0) - (startNode.z || 0);
    const L = Math.sqrt(dx * dx + dy * dy + dz * dz);

    const { E, A, I } = member;

    if (this.input.analysisType === "2D_frame") {
      return this.calculate2DFrameStiffness(E, A, I, L, member);
    } else if (this.input.analysisType === "truss") {
      return this.calculateTrussStiffness(E, A, L);
    } else {
      return this.calculate3DFrameStiffness(member, L);
    }
  }

  private calculate2DFrameStiffness(
    E: number,
    A: number,
    I: number,
    L: number,
    member: Member,
  ): number[][] {
    // 6x6 stiffness matrix for 2D frame element
    const k = MatrixOps.create(6, 6, 0);

    const EA_L = (E * A) / L;
    const EI_L = (E * I) / L;
    const EI_L2 = (E * I) / (L * L);
    const EI_L3 = (E * I) / (L * L * L);

    // Axial terms
    if (k[0]) {
      k[0]![0] = EA_L;
      k[0]![3] = -EA_L;
    }
    if (k[3]) {
      k[3]![0] = -EA_L;
      k[3]![3] = EA_L;
    }

    // Bending terms
    if (k[1]) {
      k[1]![1] = 12 * EI_L3;
      k[1]![2] = 6 * EI_L2;
      k[1]![4] = -12 * EI_L3;
      k[1]![5] = 6 * EI_L2;
    }

    if (k[2]) {
      k[2]![1] = 6 * EI_L2;
      k[2]![2] = 4 * EI_L;
      k[2]![4] = -6 * EI_L2;
      k[2]![5] = 2 * EI_L;
    }

    if (k[4]) {
      k[4]![1] = -12 * EI_L3;
      k[4]![2] = -6 * EI_L2;
      k[4]![4] = 12 * EI_L3;
      k[4]![5] = -6 * EI_L2;
    }

    if (k[5]) {
      k[5]![1] = 6 * EI_L2;
      k[5]![2] = 2 * EI_L;
      k[5]![4] = -6 * EI_L2;
      k[5]![5] = 4 * EI_L;
    }

    // Apply moment releases if specified
    if (member.release) {
      // Modify for hinges
      if (member.release.start?.moment) {
        // Pin at start - modify rows/cols for rotation at node i
        if (k[2]) {
          k[2]![2] = 0;
          k[2]![5] = 0;
        }
        if (k[5]) {
          k[5]![2] = 0;
        }
      }
      if (member.release.end?.moment) {
        if (k[5]) {
          k[5]![5] = 0;
          k[5]![2] = 0;
        }
        if (k[2]) {
          k[2]![5] = 0;
        }
      }
    }

    return k;
  }

  private calculateTrussStiffness(E: number, A: number, L: number): number[][] {
    // 4x4 stiffness matrix for 2D truss element (axial only)
    const k = MatrixOps.create(4, 4, 0);
    const EA_L = (E * A) / L;

    if (k[0]) {
      k[0]![0] = EA_L;
      k[0]![2] = -EA_L;
    }
    if (k[2]) {
      k[2]![0] = -EA_L;
      k[2]![2] = EA_L;
    }

    return k;
  }

  private calculate3DFrameStiffness(member: Member, L: number): number[][] {
    // 12x12 stiffness matrix for 3D frame element
    const k = MatrixOps.create(12, 12, 0);
    const { E, A, I, Iz = I } = member;
    // J = I is only valid for circular sections. For open sections J << I.
    // Conservative fallback: J ≈ min(I, Iz)/500, clamped above zero
    const J = member.J ?? Math.max(Math.min(I, Iz) / 500, (I + Iz) * 1e-4);
    // G = E/(2(1+ν)); default ν=0.3 for steel → G = E/2.6
    const G = member.G ?? E / (2 * (1 + 0.3));

    const EA_L = (E * A) / L;
    const EIy_L = (E * I) / L;
    const EIz_L = (E * (Iz || I)) / L;
    const GJ_L = (G * (J || I)) / L;

    // Fill 3D stiffness matrix
    // Axial
    if (k[0]) {
      k[0]![0] = EA_L;
      k[0]![6] = -EA_L;
    }
    if (k[6]) {
      k[6]![0] = -EA_L;
      k[6]![6] = EA_L;
    }

    // Torsion
    if (k[3]) {
      k[3]![3] = GJ_L;
      k[3]![9] = -GJ_L;
    }
    if (k[9]) {
      k[9]![3] = -GJ_L;
      k[9]![9] = GJ_L;
    }

    // Bending about y-axis
    const coeff_y = [
      (12 * EIy_L) / (L * L),
      (6 * EIy_L) / L,
      4 * EIy_L,
      2 * EIy_L,
    ];
    if (k[2]) {
      k[2]![2] = coeff_y[0] || 0;
      k[2]![4] = -(coeff_y[1] || 0);
      k[2]![8] = -(coeff_y[0] || 0);
      k[2]![10] = -(coeff_y[1] || 0);
    }
    if (k[4]) {
      k[4]![2] = -(coeff_y[1] || 0);
      k[4]![4] = coeff_y[2] || 0;
      k[4]![8] = coeff_y[1] || 0;
      k[4]![10] = coeff_y[3] || 0;
    }
    if (k[8]) {
      k[8]![2] = -(coeff_y[0] || 0);
      k[8]![4] = coeff_y[1] || 0;
      k[8]![8] = coeff_y[0] || 0;
      k[8]![10] = coeff_y[1] || 0;
    }
    if (k[10]) {
      k[10]![2] = -(coeff_y[1] || 0);
      k[10]![4] = coeff_y[3] || 0;
      k[10]![8] = coeff_y[1] || 0;
      k[10]![10] = coeff_y[2] || 0;
    }

    // Bending about z-axis
    const coeff_z = [
      (12 * EIz_L) / (L * L),
      (6 * EIz_L) / L,
      4 * EIz_L,
      2 * EIz_L,
    ];
    if (k[1]) {
      k[1]![1] = coeff_z[0] || 0;
      k[1]![5] = coeff_z[1] || 0;
      k[1]![7] = -(coeff_z[0] || 0);
      k[1]![11] = coeff_z[1] || 0;
    }
    if (k[5]) {
      k[5]![1] = coeff_z[1] || 0;
      k[5]![5] = coeff_z[2] || 0;
      k[5]![7] = -(coeff_z[1] || 0);
      k[5]![11] = coeff_z[3] || 0;
    }
    if (k[7]) {
      k[7]![1] = -(coeff_z[0] || 0);
      k[7]![5] = -(coeff_z[1] || 0);
      k[7]![7] = coeff_z[0] || 0;
      k[7]![11] = -(coeff_z[1] || 0);
    }
    if (k[11]) {
      k[11]![1] = coeff_z[1] || 0;
      k[11]![5] = coeff_z[3] || 0;
      k[11]![7] = -(coeff_z[1] || 0);
      k[11]![11] = coeff_z[2] || 0;
    }

    return k;
  }

  private getTransformationMatrix(member: Member): number[][] {
    const startNode = this.input.nodes.find((n) => n.id === member.startNode)!;
    const endNode = this.input.nodes.find((n) => n.id === member.endNode)!;

    const dx = endNode.x - startNode.x;
    const dy = endNode.y - startNode.y;
    const L = Math.sqrt(dx * dx + dy * dy);

    const c = dx / L; // cos(theta)
    const s = dy / L; // sin(theta)

    if (this.input.analysisType === "2D_frame") {
      // 6x6 transformation matrix
      const T = MatrixOps.create(6, 6, 0);

      if (T[0]) {
        T[0]![0] = c;
        T[0]![1] = s;
      }
      if (T[1]) {
        T[1]![0] = -s;
        T[1]![1] = c;
      }
      if (T[2]) {
        T[2]![2] = 1;
      }
      if (T[3]) {
        T[3]![3] = c;
        T[3]![4] = s;
      }
      if (T[4]) {
        T[4]![3] = -s;
        T[4]![4] = c;
      }
      if (T[5]) {
        T[5]![5] = 1;
      }

      return T;
    } else if (this.input.analysisType === "truss") {
      // 4x4 transformation matrix for truss
      const T = MatrixOps.create(4, 4, 0);

      if (T[0]) {
        T[0]![0] = c;
        T[0]![1] = s;
      }
      if (T[1]) {
        T[1]![0] = -s;
        T[1]![1] = c;
      }
      if (T[2]) {
        T[2]![2] = c;
        T[2]![3] = s;
      }
      if (T[3]) {
        T[3]![2] = -s;
        T[3]![3] = c;
      }

      return T;
    }

    // 3D transformation matrix would be more complex
    return MatrixOps.identity(12);
  }

  private addToGlobalMatrix(
    K: number[][],
    k: number[][],
    member: Member,
  ): void {
    const startDOF = this.nodeMap.get(member.startNode)!;
    const endDOF = this.nodeMap.get(member.endNode)!;

    const dofsPerNode =
      this.input.analysisType === "3D_frame"
        ? 6
        : this.input.analysisType === "truss"
          ? 2
          : 3;

    const indices = [
      ...Array(dofsPerNode)
        .fill(0)
        .map((_, i) => startDOF + i),
      ...Array(dofsPerNode)
        .fill(0)
        .map((_, i) => endDOF + i),
    ];

    for (let i = 0; i < indices.length; i++) {
      for (let j = 0; j < indices.length; j++) {
        const idxI = indices[i];
        const idxJ = indices[j];
        if (idxI !== undefined && idxJ !== undefined && K[idxI] && k[i]) {
          K[idxI]![idxJ] += k[i]![j] || 0;
        }
      }
    }
  }

  // --------------------------------------------------------------------------
  // LOAD VECTOR ASSEMBLY
  // --------------------------------------------------------------------------

  private assembleLoadVector(loads: Load[]): number[] {
    const F = new Array(this.totalDOFs).fill(0);

    for (const load of loads) {
      if (load.type === "point_load") {
        this.applyPointLoad(F, load);
      } else if (load.type === "udl" || load.type === "uvl") {
        this.applyDistributedLoad(F, load);
      } else if (load.type === "moment") {
        this.applyMomentLoad(F, load);
      }
    }

    return F;
  }

  private applyPointLoad(F: number[], load: PointLoad): void {
    if (load.nodeId !== undefined) {
      const dofStart = this.nodeMap.get(load.nodeId)!;
      if (F[dofStart] !== undefined) F[dofStart]! += load.Fx || 0;
      if (F[dofStart + 1] !== undefined) F[dofStart + 1]! += load.Fy || 0;
      if (this.input.analysisType === "3D_frame" && load.Fz !== undefined) {
        if (F[dofStart + 2] !== undefined) F[dofStart + 2]! += load.Fz || 0;
      }
    } else if (load.memberId !== undefined && load.position !== undefined) {
      // Point load on member - calculate equivalent nodal loads
      const member = this.input.members.find((m) => m.id === load.memberId)!;
      const startNode = this.input.nodes.find(
        (n) => n.id === member.startNode,
      )!;
      const endNode = this.input.nodes.find((n) => n.id === member.endNode)!;

      const L = Math.sqrt(
        Math.pow(endNode.x - startNode.x, 2) +
          Math.pow(endNode.y - startNode.y, 2),
      );

      const a = load.position * L;
      const b = L - a;

      // Fixed end reactions for point load
      const startDOF = this.nodeMap.get(member.startNode)!;
      const endDOF = this.nodeMap.get(member.endNode)!;

      // Vertical load contribution
      const Fy = load.Fy || 0;
      if (F[startDOF + 1] !== undefined)
        F[startDOF + 1]! += (Fy * b * b * (3 * a + b)) / (L * L * L);
      if (F[startDOF + 2] !== undefined)
        F[startDOF + 2]! += (Fy * a * b * b) / (L * L);
      if (F[endDOF + 1] !== undefined)
        F[endDOF + 1]! += (Fy * a * a * (a + 3 * b)) / (L * L * L);
      if (F[endDOF + 2] !== undefined)
        F[endDOF + 2]! -= (Fy * a * a * b) / (L * L);
    }
  }

  private applyDistributedLoad(F: number[], load: DistributedLoad): void {
    const member = this.input.members.find((m) => m.id === load.memberId)!;
    const startNode = this.input.nodes.find((n) => n.id === member.startNode)!;
    const endNode = this.input.nodes.find((n) => n.id === member.endNode)!;

    const L = Math.sqrt(
      Math.pow(endNode.x - startNode.x, 2) +
        Math.pow(endNode.y - startNode.y, 2),
    );

    const startDOF = this.nodeMap.get(member.startNode)!;
    const endDOF = this.nodeMap.get(member.endNode)!;

    if (load.type === "udl") {
      const w = load.w1 || 0; // kN/m

      // Fixed end reactions for UDL
      if (F[startDOF + 1] !== undefined) F[startDOF + 1]! += (w * L) / 2;
      if (F[startDOF + 2] !== undefined) F[startDOF + 2]! += (w * L * L) / 12;
      if (F[endDOF + 1] !== undefined) F[endDOF + 1]! += (w * L) / 2;
      if (F[endDOF + 2] !== undefined) F[endDOF + 2]! -= (w * L * L) / 12;
    } else if (load.type === "uvl") {
      const w1 = load.w1 || 0;
      const w2 = load.w2 || 0;

      // Fixed end reactions for triangular load (simplified)
      const wAvg = (w1 + w2) / 2;
      const denom = w1 + w2;
      if (denom !== 0) {
        if (F[startDOF + 1] !== undefined)
          F[startDOF + 1]! += (wAvg * L * (2 * w1 + w2)) / (3 * denom);
        if (F[endDOF + 1] !== undefined)
          F[endDOF + 1]! += (wAvg * L * (w1 + 2 * w2)) / (3 * denom);
      }
    }
  }

  private applyMomentLoad(F: number[], load: MomentLoad): void {
    if (load.nodeId !== undefined) {
      const dofStart = this.nodeMap.get(load.nodeId)!;

      if (this.input.analysisType === "2D_frame") {
        if (F[dofStart + 2] !== undefined) F[dofStart + 2]! += load.Mz || 0;
      } else if (this.input.analysisType === "3D_frame") {
        if (F[dofStart + 3] !== undefined) F[dofStart + 3]! += load.Mx || 0;
        if (F[dofStart + 4] !== undefined) F[dofStart + 4]! += load.My || 0;
        if (F[dofStart + 5] !== undefined) F[dofStart + 5]! += load.Mz || 0;
      }
    }
  }

  // --------------------------------------------------------------------------
  // BOUNDARY CONDITIONS
  // --------------------------------------------------------------------------

  private applyBoundaryConditions(
    K: number[][],
    F: number[],
  ): {
    K_reduced: number[][];
    F_reduced: number[];
    freeDOFs: number[];
    fixedDOFs: number[];
  } {
    const dofsPerNode =
      this.input.analysisType === "3D_frame"
        ? 6
        : this.input.analysisType === "truss"
          ? 2
          : 3;

    const fixedDOFs: number[] = [];
    const freeDOFs: number[] = [];

    for (const node of this.input.nodes) {
      const dofStart = this.nodeMap.get(node.id)!;

      if (node.support === "fixed") {
        for (let i = 0; i < dofsPerNode; i++) {
          fixedDOFs.push(dofStart + i);
        }
      } else if (node.support === "pinned") {
        fixedDOFs.push(dofStart); // dx
        fixedDOFs.push(dofStart + 1); // dy
        freeDOFs.push(dofStart + 2); // rotation free
      } else if (node.support === "roller") {
        fixedDOFs.push(dofStart + 1); // dy fixed (vertical support)
        freeDOFs.push(dofStart); // dx free
        freeDOFs.push(dofStart + 2); // rotation free
      } else {
        for (let i = 0; i < dofsPerNode; i++) {
          freeDOFs.push(dofStart + i);
        }
      }
    }

    // Create reduced system
    const n = freeDOFs.length;
    const K_reduced = MatrixOps.create(n, n, 0);
    const F_reduced = new Array(n).fill(0);

    for (let i = 0; i < n; i++) {
      const freeDofI = freeDOFs[i];
      if (freeDofI !== undefined) {
        F_reduced[i] = F[freeDofI] || 0;
        for (let j = 0; j < n; j++) {
          const freeDofJ = freeDOFs[j];
          if (freeDofJ !== undefined && K_reduced[i] && K[freeDofI]) {
            K_reduced[i]![j] = K[freeDofI]![freeDofJ] || 0;
          }
        }
      }
    }

    return { K_reduced, F_reduced, freeDOFs, fixedDOFs };
  }

  private expandDisplacements(
    D_free: number[],
    freeDOFs: number[],
    _fixedDOFs: number[],
  ): number[] {
    const D = new Array(this.totalDOFs).fill(0);

    freeDOFs.forEach((dof, index) => {
      D[dof] = D_free[index] || 0;
    });

    return D;
  }

  // --------------------------------------------------------------------------
  // P-DELTA ANALYSIS
  // --------------------------------------------------------------------------

  private solveWithPDelta(
    K: number[][],
    F: number[],
    freeDOFs: number[],
    fixedDOFs: number[],
  ): number[] {
    const maxIterations = this.input.options?.maxIterations || 10;
    const tolerance = this.input.options?.tolerance || 1e-6;

    let D_prev = new Array(this.totalDOFs).fill(0);
    let converged = false;
    let iteration = 0;

    while (!converged && iteration < maxIterations) {
      // Add geometric stiffness
      const K_geo = this.calculateGeometricStiffnessMatrix(D_prev);
      const K_total = MatrixOps.add(K, K_geo);

      // Reduce and solve
      const { K_reduced, F_reduced } = this.applyBoundaryConditions(K_total, F);
      const D_free = MatrixOps.solve(K_reduced, F_reduced);
      const D_new = this.expandDisplacements(D_free, freeDOFs, fixedDOFs);

      // Check convergence
      let maxChange = 0;
      for (let i = 0; i < this.totalDOFs; i++) {
        maxChange = Math.max(
          maxChange,
          Math.abs((D_new[i] || 0) - (D_prev[i] || 0)),
        );
      }

      converged = maxChange < tolerance;
      D_prev = D_new;
      iteration++;
    }

    return D_prev;
  }

  private calculateGeometricStiffnessMatrix(D: number[]): number[][] {
    const K_geo = MatrixOps.create(this.totalDOFs, this.totalDOFs, 0);

    for (const member of this.input.members) {
      const startNode = this.input.nodes.find(
        (n) => n.id === member.startNode,
      )!;
      const endNode = this.input.nodes.find((n) => n.id === member.endNode)!;

      const dx = endNode.x - startNode.x;
      const dy = endNode.y - startNode.y;
      const L = Math.sqrt(dx * dx + dy * dy);

      // Get axial force from current displacement
      const startDOF = this.nodeMap.get(member.startNode)!;
      const endDOF = this.nodeMap.get(member.endNode)!;

      const du = (D[endDOF] || 0) - (D[startDOF] || 0);
      const dv = (D[endDOF + 1] || 0) - (D[startDOF + 1] || 0);

      const c = dx / L;
      const s = dy / L;

      const axialDeformation = du * c + dv * s;
      const P = (member.E * member.A * axialDeformation) / L; // Axial force

      // Geometric stiffness contribution
      const k_geo_local = MatrixOps.create(6, 6, 0);
      const PL = P / L;

      if (k_geo_local[1]) {
        k_geo_local[1]![1] = (6 * PL) / 5;
        k_geo_local[1]![2] = (PL * L) / 10;
        k_geo_local[1]![4] = (-6 * PL) / 5;
        k_geo_local[1]![5] = (PL * L) / 10;
      }

      if (k_geo_local[2]) {
        k_geo_local[2]![1] = (PL * L) / 10;
        k_geo_local[2]![2] = (2 * PL * L * L) / 15;
        k_geo_local[2]![4] = (-PL * L) / 10;
        k_geo_local[2]![5] = (-PL * L * L) / 30;
      }

      if (k_geo_local[4]) {
        k_geo_local[4]![1] = (-6 * PL) / 5;
        k_geo_local[4]![2] = (-PL * L) / 10;
        k_geo_local[4]![4] = (6 * PL) / 5;
        k_geo_local[4]![5] = (-PL * L) / 10;
      }

      if (k_geo_local[5]) {
        k_geo_local[5]![1] = (PL * L) / 10;
        k_geo_local[5]![2] = (-PL * L * L) / 30;
        k_geo_local[5]![4] = (-PL * L) / 10;
        k_geo_local[5]![5] = (2 * PL * L * L) / 15;
      }

      // Transform and add to global
      const T = this.getTransformationMatrix(member);
      const k_geo_global = MatrixOps.multiply(
        MatrixOps.multiply(MatrixOps.transpose(T), k_geo_local),
        T,
      );

      this.addToGlobalMatrix(K_geo, k_geo_global, member);
    }

    return K_geo;
  }

  // --------------------------------------------------------------------------
  // MEMBER FORCE CALCULATION
  // --------------------------------------------------------------------------

  private calculateMemberForces(D: number[], loads: Load[]): MemberForce[] {
    const memberForces: MemberForce[] = [];

    for (const member of this.input.members) {
      const startNode = this.input.nodes.find(
        (n) => n.id === member.startNode,
      )!;
      const endNode = this.input.nodes.find((n) => n.id === member.endNode)!;

      const dx = endNode.x - startNode.x;
      const dy = endNode.y - startNode.y;
      const L = Math.sqrt(dx * dx + dy * dy);

      const startDOF = this.nodeMap.get(member.startNode)!;
      const endDOF = this.nodeMap.get(member.endNode)!;

      // Get displacements in local coordinates
      const T = this.getTransformationMatrix(member);

      let d_global: number[];
      if (this.input.analysisType === "2D_frame") {
        d_global = [
          D[startDOF] || 0,
          D[startDOF + 1] || 0,
          D[startDOF + 2] || 0,
          D[endDOF] || 0,
          D[endDOF + 1] || 0,
          D[endDOF + 2] || 0,
        ];
      } else {
        d_global = [
          D[startDOF] || 0,
          D[startDOF + 1] || 0,
          D[endDOF] || 0,
          D[endDOF + 1] || 0,
        ];
      }

      const d_local = MatrixOps.multiplyVector(T, d_global);

      // Calculate forces
      const k_local = this.calculateLocalStiffnessMatrix(member);
      const f_local = MatrixOps.multiplyVector(k_local, d_local);

      // Add fixed end forces from loads
      const fef = this.calculateFixedEndForces(member, loads);

      let startAxial: number, startShear: number, startMoment: number;
      let endAxial: number, endShear: number, endMoment: number;

      if (this.input.analysisType === "2D_frame") {
        startAxial = -((f_local[0] || 0) + (fef[0] || 0)) / 1000; // kN
        startShear = -((f_local[1] || 0) + (fef[1] || 0)) / 1000; // kN
        startMoment = -((f_local[2] || 0) + (fef[2] || 0)) / 1e6; // kNm
        endAxial = ((f_local[3] || 0) + (fef[3] || 0)) / 1000;
        endShear = ((f_local[4] || 0) + (fef[4] || 0)) / 1000;
        endMoment = ((f_local[5] || 0) + (fef[5] || 0)) / 1e6;
      } else {
        startAxial = -(f_local[0] || 0) / 1000;
        endAxial = (f_local[2] || 0) / 1000;
        startShear = 0;
        endShear = 0;
        startMoment = 0;
        endMoment = 0;
      }

      memberForces.push({
        memberId: member.id,
        startForces: {
          axial: PrecisionMath.round(startAxial, 3),
          shearY: PrecisionMath.round(startShear, 3),
          moment: PrecisionMath.round(startMoment, 3),
        },
        endForces: {
          axial: PrecisionMath.round(endAxial, 3),
          shearY: PrecisionMath.round(endShear, 3),
          moment: PrecisionMath.round(endMoment, 3),
        },
        maxBendingMoment: Math.max(Math.abs(startMoment), Math.abs(endMoment)),
        maxShear: Math.max(Math.abs(startShear), Math.abs(endShear)),
        maxAxial: Math.max(Math.abs(startAxial), Math.abs(endAxial)),
      });
    }

    return memberForces;
  }

  private calculateFixedEndForces(member: Member, loads: Load[]): number[] {
    const fef = new Array(6).fill(0);

    const startNode = this.input.nodes.find((n) => n.id === member.startNode)!;
    const endNode = this.input.nodes.find((n) => n.id === member.endNode)!;
    const L = Math.sqrt(
      Math.pow(endNode.x - startNode.x, 2) +
        Math.pow(endNode.y - startNode.y, 2),
    );

    for (const load of loads) {
      if (
        load.type === "udl" &&
        (load as DistributedLoad).memberId === member.id
      ) {
        const w = (load as DistributedLoad).w1 * 1000; // N/m
        fef[1] += (w * L) / 2;
        fef[2] += (w * L * L) / 12;
        fef[4] += (w * L) / 2;
        fef[5] -= (w * L * L) / 12;
      }
    }

    return fef;
  }

  // --------------------------------------------------------------------------
  // REACTIONS
  // --------------------------------------------------------------------------

  private calculateReactions(
    K: number[][],
    D: number[],
    F: number[],
  ): Reaction[] {
    const reactions: Reaction[] = [];
    const F_int = MatrixOps.multiplyVector(K, D);

    for (const node of this.input.nodes) {
      if (node.support && node.support !== "free") {
        const dofStart = this.nodeMap.get(node.id)!;

        const Rx = ((F_int[dofStart] || 0) - (F[dofStart] || 0)) / 1000; // kN
        const Ry = ((F_int[dofStart + 1] || 0) - (F[dofStart + 1] || 0)) / 1000;

        let Mz = 0;
        if (this.input.analysisType === "2D_frame") {
          Mz = ((F_int[dofStart + 2] || 0) - (F[dofStart + 2] || 0)) / 1e6; // kNm
        }

        reactions.push({
          nodeId: node.id,
          Rx: PrecisionMath.round(Rx, 3),
          Ry: PrecisionMath.round(Ry, 3),
          Mz: PrecisionMath.round(Mz, 3),
        });
      }
    }

    return reactions;
  }

  // --------------------------------------------------------------------------
  // OUTPUT FORMATTING
  // --------------------------------------------------------------------------

  private createNodeDisplacements(D: number[]): NodeDisplacement[] {
    const displacements: NodeDisplacement[] = [];
    const dofsPerNode =
      this.input.analysisType === "3D_frame"
        ? 6
        : this.input.analysisType === "truss"
          ? 2
          : 3;

    for (const node of this.input.nodes) {
      const dofStart = this.nodeMap.get(node.id)!;

      displacements.push({
        nodeId: node.id,
        dx: PrecisionMath.round(D[dofStart] || 0, 6),
        dy: PrecisionMath.round(D[dofStart + 1] || 0, 6),
        rz: dofsPerNode >= 3 ? PrecisionMath.round(D[dofStart + 2] || 0, 8) : 0,
      });
    }

    return displacements;
  }

  private calculateSummary(
    displacements: NodeDisplacement[],
    memberForces: MemberForce[],
  ): AnalysisResult["summary"] {
    let maxDisp = { node: 0, value: 0, direction: "Y" };
    let maxMom = { member: 0, value: 0 };
    let maxShear = { member: 0, value: 0 };
    let maxAxial = { member: 0, value: 0 };

    for (const d of displacements) {
      if (Math.abs(d.dy) > Math.abs(maxDisp.value)) {
        maxDisp = { node: d.nodeId, value: d.dy, direction: "Y" };
      }
      if (Math.abs(d.dx) > Math.abs(maxDisp.value)) {
        maxDisp = { node: d.nodeId, value: d.dx, direction: "X" };
      }
    }

    for (const mf of memberForces) {
      if (mf.maxBendingMoment > maxMom.value) {
        maxMom = { member: mf.memberId, value: mf.maxBendingMoment };
      }
      if (mf.maxShear > maxShear.value) {
        maxShear = { member: mf.memberId, value: mf.maxShear };
      }
      if (mf.maxAxial > maxAxial.value) {
        maxAxial = { member: mf.memberId, value: mf.maxAxial };
      }
    }

    return {
      maxDisplacement: maxDisp,
      maxMoment: maxMom,
      maxShear: maxShear,
      maxAxial: maxAxial,
    };
  }

  private analyzeCombination(
    combination: LoadCombination,
    results: Map<string, AnalysisResult>,
  ): AnalysisResult {
    // Combine results from multiple load cases
    const combinedDisplacements: NodeDisplacement[] = [];
    const combinedForces: MemberForce[] = [];
    const combinedReactions: Reaction[] = [];

    // Initialize with zeros
    for (const node of this.input.nodes) {
      combinedDisplacements.push({
        nodeId: node.id,
        dx: 0,
        dy: 0,
        rz: 0,
      });
    }

    for (const member of this.input.members) {
      combinedForces.push({
        memberId: member.id,
        startForces: { axial: 0, shearY: 0, moment: 0 },
        endForces: { axial: 0, shearY: 0, moment: 0 },
        maxBendingMoment: 0,
        maxShear: 0,
        maxAxial: 0,
      });
    }

    // Add factored contributions
    for (const [loadCase, factor] of Object.entries(combination.factors)) {
      const result = results.get(loadCase);
      if (result) {
        for (let i = 0; i < combinedDisplacements.length; i++) {
          const cd = combinedDisplacements[i];
          const rd = result.displacements[i];
          if (cd && rd) {
            cd.dx += rd.dx * factor;
            cd.dy += rd.dy * factor;
            cd.rz += (rd.rz || 0) * factor;
          }
        }

        for (let i = 0; i < combinedForces.length; i++) {
          const cf = combinedForces[i];
          const rf = result.memberForces[i];
          if (cf && rf) {
            cf.startForces.axial += rf.startForces.axial * factor;
            cf.startForces.shearY += rf.startForces.shearY * factor;
            cf.startForces.moment += rf.startForces.moment * factor;
            cf.endForces.axial += rf.endForces.axial * factor;
            cf.endForces.shearY += rf.endForces.shearY * factor;
            cf.endForces.moment += rf.endForces.moment * factor;
          }
        }
      }
    }

    // Update max values
    for (const mf of combinedForces) {
      mf.maxBendingMoment = Math.max(
        Math.abs(mf.startForces.moment),
        Math.abs(mf.endForces.moment),
      );
      mf.maxShear = Math.max(
        Math.abs(mf.startForces.shearY),
        Math.abs(mf.endForces.shearY),
      );
      mf.maxAxial = Math.max(
        Math.abs(mf.startForces.axial),
        Math.abs(mf.endForces.axial),
      );
    }

    return {
      analysisType: this.input.analysisType,
      loadCase: combination.name,
      displacements: combinedDisplacements,
      memberForces: combinedForces,
      reactions: combinedReactions,
      summary: this.calculateSummary(combinedDisplacements, combinedForces),
    };
  }

  // --------------------------------------------------------------------------
  // CONTINUOUS BEAM ANALYSIS (MOMENT DISTRIBUTION)
  // --------------------------------------------------------------------------

  public static momentDistribution(
    spans: number[],
    EI: number[],
    loads: {
      span: number;
      type: "udl" | "point";
      value: number;
      position?: number;
    }[],
    supports: ("fixed" | "pinned" | "roller")[],
  ): { moments: number[]; reactions: number[] } {
    const n = spans.length;
    const fem: number[][] = []; // Fixed end moments
    const com = 0.5; // Carry-over factor

    // Calculate fixed end moments
    for (let i = 0; i < n; i++) {
      fem[i] = [0, 0]; // [left moment, right moment]

      for (const load of loads) {
        if (load.span === i) {
          const L = spans[i] || 1;
          if (load.type === "udl") {
            if (fem[i]) {
              fem[i]![0] = (-load.value * L * L) / 12;
              fem[i]![1] = (load.value * L * L) / 12;
            }
          } else if (load.type === "point" && load.position !== undefined) {
            const a = load.position * L;
            const b = L - a;
            if (fem[i]) {
              fem[i]![0] = (-load.value * a * b * b) / (L * L);
              fem[i]![1] = (load.value * a * a * b) / (L * L);
            }
          }
        }
      }
    }

    // Calculate stiffness and distribution factors
    const stiffness: number[][] = [];
    for (let i = 0; i < n; i++) {
      const L = spans[i] || 1;
      const ei = EI[i] || 1;
      const k = (4 * ei) / L;
      stiffness[i] = [k, k]; // [left, right]

      // Modify for support conditions
      if (i === 0 && supports[0] === "pinned") {
        if (stiffness[i]) stiffness[i]![0] = (3 * ei) / L;
      }
      if (i === n - 1 && supports[n] === "pinned") {
        if (stiffness[i]) stiffness[i]![1] = (3 * ei) / L;
      }
    }

    // Moment distribution iterations
    const moments = new Array(n + 1).fill(0);
    const maxIterations = 20;
    const tolerance = 0.001;

    // Initialize with FEMs
    const jointMoments: number[][] = [];
    for (let i = 0; i <= n; i++) {
      jointMoments[i] = [
        i > 0 && fem[i - 1] ? fem[i - 1]![1] || 0 : 0,
        i < n && fem[i] ? fem[i]![0] || 0 : 0,
      ];
    }

    for (let iter = 0; iter < maxIterations; iter++) {
      let maxUnbalance = 0;

      for (let j = 1; j < n; j++) {
        // Interior joints only
        const sumK =
          (j > 0 && stiffness[j - 1] ? stiffness[j - 1]![1] || 0 : 0) +
          (j < n && stiffness[j] ? stiffness[j]![0] || 0 : 0);

        if (jointMoments[j]) {
          const unbalance =
            (jointMoments[j]![0] || 0) + (jointMoments[j]![1] || 0);

          if (Math.abs(unbalance) > tolerance) {
            const df_left =
              j > 0 && stiffness[j - 1]
                ? (stiffness[j - 1]![1] || 0) / sumK
                : 0;
            const df_right =
              j < n && stiffness[j] ? (stiffness[j]![0] || 0) / sumK : 0;

            const dist_left = -unbalance * df_left;
            const dist_right = -unbalance * df_right;

            // Distribute
            if (jointMoments[j]) {
              jointMoments[j]![0] = (jointMoments[j]![0] || 0) + dist_left;
              jointMoments[j]![1] = (jointMoments[j]![1] || 0) + dist_right;
            }

            // Carry over
            if (j > 0 && jointMoments[j - 1]) {
              jointMoments[j - 1]![1] =
                (jointMoments[j - 1]![1] || 0) + dist_left * com;
            }
            if (j < n && jointMoments[j + 1]) {
              jointMoments[j + 1]![0] =
                (jointMoments[j + 1]![0] || 0) + dist_right * com;
            }

            maxUnbalance = Math.max(maxUnbalance, Math.abs(unbalance));
          }
        }
      }

      if (maxUnbalance < tolerance) break;
    }

    // Extract final moments at joints
    for (let i = 0; i <= n; i++) {
      if (jointMoments[i]) {
        moments[i] = (jointMoments[i]![0] || 0) + (jointMoments[i]![1] || 0);
      }
    }

    // Calculate reactions (simplified)
    const reactions = new Array(n + 1).fill(0);
    // ... (would need full implementation)

    return { moments, reactions };
  }
}

// ============================================================================
// FACTORY FUNCTIONS
// ============================================================================

export const createStructuralAnalysis = (input: AnalysisInput) => {
  return new AdvancedStructuralAnalysisEngine(input);
};

export default AdvancedStructuralAnalysisEngine;
