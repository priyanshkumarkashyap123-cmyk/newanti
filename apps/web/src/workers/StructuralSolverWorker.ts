/**
 * StructuralSolverWorker - Enhanced Web Worker for Structural Analysis
 *
 * Features:
 * - Full assembly and solve logic inside worker
 * - Progress events for UI feedback
 * - Transferable Objects (ArrayBuffers) for zero-copy data transfer
 * - Automatic WASM/JS solver selection
 */

// ============================================
// IMPORTS
// ============================================

import {
  buildLocalAxesForDiagram,
  accumulateLoadEffects,
  buildDiagramStations,
  integrateDeflection,
  type DiagramLoad,
} from "../utils/diagramUtils";

// WASM Module import (dynamic from public folder)
interface WasmSolverModule {
  default: (wasmBytes: ArrayBuffer) => Promise<unknown>;
  solve_sparse_system?: (
    rows: Uint32Array,
    cols: Uint32Array,
    vals: Float64Array,
    forces: Float64Array,
    size: number,
  ) => Float64Array;
  solve_sparse_system_json?: (input: string) => string;
}

interface LocalForceState {
  axial: number;
  shear: number;
  moment: number;
  shearZ?: number;
  torsion?: number;
  momentY?: number;
}

interface MemberForceResult {
  id: string;
  start: LocalForceState;
  end: LocalForceState;
  localDisplacements?: Float64Array;
  [key: string]: unknown;
}

interface MemberLoadItem {
  memberId: string;
  type?: string; // 'UDL' | 'point' | 'UVL' | 'moment'
  w1?: number; // Distributed load intensity at start (kN/m)
  w2?: number; // Distributed load intensity at end (kN/m) — for UVL/trapezoidal
  P?: number; // Point load magnitude (kN)
  M?: number; // Point moment magnitude (kN·m)
  a?: number; // Distance of point load from start (m)
  startPos?: number; // Partial load start position (0-1 ratio)
  endPos?: number; // Partial load end position (0-1 ratio)
  direction?: string; // 'local_y' | 'local_z' | 'global_y' | 'global_x' | 'global_z' | 'axial'
}

interface ModelDataWithMemberLoads extends ModelData {
  memberLoads?: MemberLoadItem[];
}

let wasmModule: WasmSolverModule | null = null;
let wasmReady = false;

// Import Truss Solvers
import {
  computeTruss2DStiffness,
  computeTruss2DMemberForces,
} from "../solvers/elements/compute-truss-2d";
import {
  computeTruss3DStiffness,
  computeTruss3DMemberForces,
  computeMemberGeometry3D,
} from "../solvers/elements/compute-truss-3d";
import {
  computeSpringStiffness,
  computeSpringForces,
} from "../solvers/elements/compute-spring";
import { computeGeometricStiffness } from "../solvers/elements/compute-geometric-stiffness";
import {
  computeConsistentTrussMass,
  computeLumpedMass,
} from "../solvers/elements/compute-mass";

async function loadWasm(): Promise<void> {
  try {
    // Import the WASM glue code from public folder
    // This uses the wasm-pack "web" target which exports an init() function
    const response = await fetch("/solver_wasm_bg.wasm");
    if (!response.ok) {
      throw new Error(`Failed to fetch WASM: ${response.status}`);
    }
    const wasmBytes = await response.arrayBuffer();

    // Use the bundled solver_wasm.js from src/libs
    // Vite will bundle this correctly
    const importedModule =
      (await import("../libs/solver_wasm")) as unknown as WasmSolverModule;
    wasmModule = importedModule;

    // Initialize with the fetched bytes
    await importedModule.default(wasmBytes);
    wasmReady = true;
    console.log(
      "[StructuralSolverWorker] WASM Solver Module Loaded from public folder",
    );
  } catch (error) {
    console.warn(
      "[StructuralSolverWorker] WASM Solver not available, using JS fallback:",
      error,
    );
  }
}

// Start loading
loadWasm();

// ============================================
// MESSAGE TYPES
// ============================================

/** Input: Model data from main thread */
export interface ModelData {
  nodes: NodeData[];
  members: MemberData[];
  loads: LoadData[];
  memberLoads?: MemberLoadItem[]; // Member loads (UDL, point, etc.) — used for FEF assembly
  memberLoadsForRecovery?: MemberLoadItem[]; // Member loads used ONLY for force recovery (f = k*u − FEF)
  temperatureLoads?: TemperatureLoadData[]; // Temperature loads on elements
  pointLoadsOnMembers?: PointLoadOnMemberData[]; // Concentrated loads along members
  dofPerNode: 2 | 3 | 6;
  options?: SolverConfig;
  settings?: { selfWeight?: boolean }; // Alternative path from AnalysisService
}

/** Temperature load on an element */
export interface TemperatureLoadData {
  elementId: string;
  deltaT: number; // Uniform temperature change [°C]
  gradientY?: number; // Temperature gradient in Y [°C/m]
  gradientZ?: number; // Temperature gradient in Z [°C/m]
  alpha: number; // Thermal expansion coefficient [1/°C] (e.g. 12e-6 for steel)
}

/** Concentrated load at a specific position along a member */
export interface PointLoadOnMemberData {
  elementId: string;
  magnitude: number; // Load value [N] or [N·m]
  position: number; // Ratio along member (0=start, 1=end)
  direction: "GlobalX" | "GlobalY" | "GlobalZ" | "LocalX" | "LocalY" | "LocalZ";
  isMoment?: boolean; // true for moment load, false for force (default)
}

export interface NodeData {
  id: string;
  x: number;
  y: number;
  z: number;
  restraints?: {
    fx: boolean;
    fy: boolean;
    fz: boolean;
    mx: boolean;
    my: boolean;
    mz: boolean;
  };
}

export interface MemberData {
  id: string;
  startNodeId: string;
  endNodeId: string;
  E: number;
  A: number;
  I: number;
  Iy?: number; // Moment of inertia about local y-axis (bending in xz plane)
  Iz?: number; // Moment of inertia about local z-axis (bending in xy plane)
  J?: number; // Torsion constant (Saint-Venant)
  G?: number; // Shear modulus
  type?: "frame" | "truss" | "spring"; // Default to 'frame' if undefined
  springStiffness?: number; // For spring elements
  rho?: number; // Material density (kg/m³), default 7850 for steel
  betaAngle?: number; // Member rotation angle (degrees)
  releases?: {
    // DOF releases (hinges) at each end
    fxStart?: boolean;
    fyStart?: boolean;
    fzStart?: boolean;
    mxStart?: boolean;
    myStart?: boolean;
    mzStart?: boolean;
    fxEnd?: boolean;
    fyEnd?: boolean;
    fzEnd?: boolean;
    mxEnd?: boolean;
    myEnd?: boolean;
    mzEnd?: boolean;
  };
}

export interface LoadData {
  nodeId: string;
  fx?: number;
  fy?: number;
  fz?: number;
  mx?: number;
  my?: number;
  mz?: number;
}

export interface SolverConfig {
  analysisType?:
    | "linear"
    | "p-delta"
    | "dynamic"
    | "dynamic_time_history"
    | "topology_optimization"
    | "pinn_beam";
  maxIterations?: number;
  tolerance?: number;
  method?: "cg" | "direct" | "auto";
  timeStep?: number; // For dynamic analysis
  duration?: number; // For dynamic analysis
  targetVolume?: number; // For topology optimization (0-1 fraction)
  selfWeight?: boolean; // Auto-apply member self-weight (-Y direction)
  // M8: Rayleigh damping parameters for dynamic analysis
  dampingRatio?: number; // Damping ratio ζ (default 0.05 = 5%)
  firstModeFreq?: number; // First mode frequency in Hz (default 1.0)
  thirdModeFreq?: number; // Third mode frequency in Hz (default 5.0)
}

/** Load Combination request (processed via WASM) */
export interface LoadCombinationConfig {
  name: string;
  factors: Record<string, number>; // Load case label -> factor
}

/** Output: Progress events */
export interface ProgressEvent {
  type: "progress";
  stage: "assembling" | "applying_bc" | "solving" | "extracting" | "uploading";
  percent: number;
  message: string;
}

/** Output: Result data with Transferable buffers */
export interface ResultData {
  type: "result";
  success: boolean;
  displacements?: Float64Array; // Transferable
  reactions?: Float64Array; // Transferable (per DOF)
  memberForces?: MemberForceResult[]; // Small payload; object array for clarity
  densities?: Record<string, number>; // Topology optimization densities
  equilibrium_check?: {
    applied_forces: number[];
    reaction_forces: number[];
    residual: number[];
    error_percent: number;
    pass: boolean;
  };
  stats: {
    assemblyTimeMs: number;
    solveTimeMs: number;
    totalTimeMs: number;
    method?: string;
    iterations?: number;
    residual?: number;
    nnz?: number;
    sparsity?: number;
  };
  error?: string;
}

/** Request message from main thread */
interface WorkerRequest {
  type: "analyze" | "analyze_cloud";
  requestId: string;
  model: ModelData;
  url?: string; // For cloud analysis
  token?: string; // For cloud analysis auth
}

// ============================================
// SPARSE MATRIX (Inline for Worker - TypedArray COO)
// ============================================

/**
 * COO-format sparse matrix using TypedArrays.
 * ~10x faster than string-keyed Map for assembly and SpMV.
 */
class SparseMatrix {
  private rowArr: Int32Array;
  private colArr: Int32Array;
  private valArr: Float64Array;
  private count: number = 0;
  private capacity: number;
  // Fast diagonal lookup
  private diagCache: Float64Array | null = null;

  constructor(
    public rows: number,
    public cols: number,
    initialCapacity: number = 4096,
  ) {
    this.capacity = initialCapacity;
    this.rowArr = new Int32Array(this.capacity);
    this.colArr = new Int32Array(this.capacity);
    this.valArr = new Float64Array(this.capacity);
  }

  private grow(): void {
    const newCap = this.capacity * 2;
    const newRow = new Int32Array(newCap);
    const newCol = new Int32Array(newCap);
    const newVal = new Float64Array(newCap);
    newRow.set(this.rowArr);
    newCol.set(this.colArr);
    newVal.set(this.valArr);
    this.rowArr = newRow;
    this.colArr = newCol;
    this.valArr = newVal;
    this.capacity = newCap;
  }

  get(row: number, col: number): number {
    for (let i = 0; i < this.count; i++) {
      if (this.rowArr[i] === row && this.colArr[i] === col)
        return this.valArr[i] ?? 0;
    }
    return 0;
  }

  set(row: number, col: number, value: number): void {
    for (let i = 0; i < this.count; i++) {
      if (this.rowArr[i] === row && this.colArr[i] === col) {
        if (Math.abs(value) < 1e-15) {
          // Remove entry by swapping with last
          this.count--;
          this.rowArr[i] = this.rowArr[this.count] ?? 0;
          this.colArr[i] = this.colArr[this.count] ?? 0;
          this.valArr[i] = this.valArr[this.count] ?? 0;
        } else {
          this.valArr[i] = value;
        }
        this.diagCache = null;
        return;
      }
    }
    if (Math.abs(value) < 1e-15) return;
    if (this.count >= this.capacity) this.grow();
    this.rowArr[this.count] = row;
    this.colArr[this.count] = col;
    this.valArr[this.count] = value;
    this.count++;
    this.diagCache = null;
  }

  add(row: number, col: number, value: number): void {
    if (Math.abs(value) < 1e-15) return;
    // For assembly, duplicates are allowed and resolved in multiply/compress
    if (this.count >= this.capacity) this.grow();
    this.rowArr[this.count] = row;
    this.colArr[this.count] = col;
    this.valArr[this.count] = value;
    this.count++;
    this.diagCache = null;
  }

  get nnz(): number {
    return this.count;
  }

  getDiagonal(): Float64Array {
    if (this.diagCache) return this.diagCache;
    const diag = new Float64Array(Math.min(this.rows, this.cols));
    for (let i = 0; i < this.count; i++) {
      if (this.rowArr[i] === this.colArr[i]) {
        const ri = this.rowArr[i] as number;
        diag[ri] = (diag[ri] ?? 0) + (this.valArr[i] ?? 0);
      }
    }
    this.diagCache = diag;
    return diag;
  }

  // Matrix-vector multiply: COO format, no string parsing
  multiply(x: Float64Array): Float64Array {
    const y = new Float64Array(this.rows);
    const r = this.rowArr,
      c = this.colArr,
      v = this.valArr;
    for (let i = 0; i < this.count; i++) {
      const ri = r[i] as number;
      const ci = c[i] as number;
      y[ri] = (y[ri] ?? 0) + (v[i] ?? 0) * (x[ci] ?? 0);
    }
    return y;
  }

  // Get all entries as array for WASM solver (legacy – prefer getTypedArrays)
  getEntries(): { row: number; col: number; value: number }[] {
    const entries: { row: number; col: number; value: number }[] = new Array(
      this.count,
    );
    for (let i = 0; i < this.count; i++) {
      entries[i] = {
        row: this.rowArr[i]!,
        col: this.colArr[i]!,
        value: this.valArr[i]!,
      };
    }
    return entries;
  }

  /**
   * Return raw COO TypedArrays – zero-copy path to WASM.
   * Returns trimmed views (length === count) so no excess data is copied.
   */
  getTypedArrays(): {
    rows: Uint32Array;
    cols: Uint32Array;
    vals: Float64Array;
    count: number;
  } {
    return {
      rows: new Uint32Array(this.rowArr.buffer, 0, this.count),
      cols: new Uint32Array(this.colArr.buffer, 0, this.count),
      vals: new Float64Array(this.valArr.buffer, 0, this.count),
      count: this.count,
    };
  }
}

// ============================================
// PROGRESS REPORTING
// ============================================

function sendProgress(
  stage: ProgressEvent["stage"],
  percent: number,
  message: string,
): void {
  self.postMessage({
    type: "progress",
    stage,
    percent,
    message,
  } as ProgressEvent);
}

// ============================================
// ASSEMBLY FUNCTIONS
// ============================================

// Helper to map small matrix to large matrix
function mapMatrix(
  source: number[][],
  indices: (number | undefined)[],
  targetSize: number,
): number[][] {
  const target = Array(targetSize)
    .fill(0)
    .map(() => Array(targetSize).fill(0));
  for (let r = 0; r < indices.length; r++) {
    for (let c = 0; c < indices.length; c++) {
      const ir = indices[r];
      const ic = indices[c];
      const row = source[r];
      if (
        ir !== undefined &&
        ic !== undefined &&
        row !== undefined &&
        row[c] !== undefined
      ) {
        const targetRow = target[ir];
        if (targetRow !== undefined) {
          targetRow[ic] = row[c];
        }
      }
    }
  }
  return target;
}

// Helper type for WASM sparse format
interface SparseEntry {
  row: number;
  col: number;
  value: number;
}

function assembleMassMatrix(
  nodes: NodeData[],
  members: MemberData[],
  dofPerNode: number,
): { entries: SparseEntry[]; M_diag?: Float64Array } {
  const entries: SparseEntry[] = [];
  const nodeIndexMap = new Map<string, number>();
  nodes.forEach((node, index) => nodeIndexMap.set(node.id, index));

  // For Newmark (Implicit), we can handle Consistent Mass (Sparse)
  // We will assemble Consistent Mass M into entries.

  // We also return a diagonal M_diag approximation if needed (e.g. for Explicit).
  const M_diag = new Float64Array(nodes.length * dofPerNode);

  for (const member of members) {
    const i = nodeIndexMap.get(member.startNodeId);
    const j = nodeIndexMap.get(member.endNodeId);
    if (i === undefined || j === undefined) continue;

    const node1 = nodes[i];
    const node2 = nodes[j];
    if (!node1 || !node2) continue;
    const { L } = computeMemberGeometry3D(
      node1.x,
      node1.y,
      node1.z || 0,
      node2.x,
      node2.y,
      node2.z || 0,
    );
    const rho = member.rho || 7850; // Steel default
    const A = member.A || 0;

    const type = member.type || "frame";

    if (type === "spring") {
      // Massless spring usually. Or simple lumped?
      // Ignore mass for spring elements for now unless specified.
      continue;
    }

    // Use Consistent Mass
    if (dofPerNode === 2) {
      // Truss 2D
      void computeConsistentTrussMass;
      // Need simple Rotation? Truss 2D has no rotation of mass matrix if it's just translation?
      // Actually, the consistent mass is for Axial u1, u2.
      // We need to map to Global X,Y?
      // Mass is scalar for translation in global coords!
      // Consistent mass couples DOFs if they are local.
      // But Wait. Translation Mass is invariant of rotation?
      // [M]local = Integral(N' rho N).
      // If we rotate coordinates from u,v to X,Y:
      // M_global = T^T * M_local * T.
      // For Truss bar, consistent mass [2 1; 1 2] is strictly for AXIAL mode.
      // Is there transverse mass in Truss? Yes, the element has mass!
      // Usually Truss elements are allowed to have lumped mass at nodes.
      // Consistent mass for Truss usually implies Axial only?
      // Let's use LUMPED mass for Truss elements to be safe and simple in 2D/3D.
      // It's standard for Trusses.

      // ... Changing strategy to Lumped for Trusses, Consistent for Frames?
      // Let's implement Consistent Frame Mass properly logic requires Rotation T.

      // Simplification: Use Lumped Mass for ALL elements for Phase 3 Sprint 2 validation.
      // It significantly simplifies assembly (Diagonal only).
      // And is sufficient for typical low-mode dynamics.
    }

    // LUMPED MASS ASSEMBLY
    const lump = computeLumpedMass(rho, A, L, dofPerNode);
    const startBase = i * dofPerNode;
    const endBase = j * dofPerNode;

    // Local Indices for diagonal array:
    // 0..dof-1 for Node 1
    // dof..2*dof-1 for Node 2

    for (let k = 0; k < dofPerNode; k++) {
      const val1 = lump[k];
      if (val1 !== undefined) {
        M_diag[startBase + k] = (M_diag[startBase + k] || 0) + val1;
        entries.push({ row: startBase + k, col: startBase + k, value: val1 });
      }
    }
    for (let k = 0; k < dofPerNode; k++) {
      const val2 = lump[k + dofPerNode];
      if (val2 !== undefined) {
        M_diag[endBase + k] = (M_diag[endBase + k] || 0) + val2;
        entries.push({ row: endBase + k, col: endBase + k, value: val2 });
      }
    }
  }

  return { entries, M_diag };
}

// Original assembleStiffnessMatrix (renamed to avoid conflict and for clarity)
function assembleStiffnessMatrixAndForces(
  nodes: NodeData[],
  members: MemberData[],
  dofPerNode: number,
  loads: LoadData[],
  memberAxialForces?: Record<string, number>,
  elementDensities?: Record<string, number>,
  selfWeight?: boolean,
  memberLoads?: MemberLoadItem[],
  temperatureLoads?: TemperatureLoadData[],
): {
  cooRows: Uint32Array;
  cooCols: Uint32Array;
  cooVals: Float64Array;
  nnz: number;
  F: Float64Array;
  fixedDofs: Set<number>;
} {
  // Build nodeIndexMap internally
  const nodeIndexMap = new Map<string, number>();
  nodes.forEach((n, i) => nodeIndexMap.set(n.id, i));

  const totalDof = nodes.length * dofPerNode;

  const K = new SparseMatrix(totalDof, totalDof);
  const F = new Float64Array(totalDof);
  const fixedDofs = new Set<number>();

  sendProgress("assembling", 0, "Starting stiffness matrix assembly...");

  // Identify fixed DOFs
  nodes.forEach((node, nodeIndex) => {
    if (node.restraints) {
      const baseDof = nodeIndex * dofPerNode;
      if (dofPerNode === 3) {
        // 2D Frame: DOF order = [u, v, θz]
        // DOF 0: translation X (fx)
        // DOF 1: translation Y (fy)
        // DOF 2: rotation about Z (accept both fz and mz for backward compat)
        if (node.restraints.fx) fixedDofs.add(baseDof);
        if (node.restraints.fy) fixedDofs.add(baseDof + 1);
        if (node.restraints.fz || node.restraints.mz)
          fixedDofs.add(baseDof + 2);
      } else {
        // 2D truss (2 DOF) or 3D frame (6 DOF) — standard mapping
        if (node.restraints.fx) fixedDofs.add(baseDof);
        if (node.restraints.fy) fixedDofs.add(baseDof + 1);
        if (node.restraints.fz && dofPerNode >= 3) fixedDofs.add(baseDof + 2);
        if (node.restraints.mx && dofPerNode >= 4) fixedDofs.add(baseDof + 3);
        if (node.restraints.my && dofPerNode >= 5) fixedDofs.add(baseDof + 4);
        if (node.restraints.mz && dofPerNode >= 6) fixedDofs.add(baseDof + 5);
      }
    }
  });

  // Assemble element stiffness matrices
  const totalMembers = members.length;
  for (let m = 0; m < totalMembers; m++) {
    const member = members[m];
    if (!member) continue;

    // Progress every 10% of members
    if (m % Math.max(1, Math.floor(totalMembers / 10)) === 0) {
      const percent = Math.round((m / totalMembers) * 60);
      sendProgress(
        "assembling",
        percent,
        `Assembling member ${m + 1}/${totalMembers}...`,
      );
    }

    try {
      // H6: Catch bad-element errors — skip with warning instead of crashing

      const startIdx = nodeIndexMap.get(member.startNodeId);
      const endIdx = nodeIndexMap.get(member.endNodeId);
      if (startIdx === undefined || endIdx === undefined) continue;

      const startNode = nodes[startIdx];
      const endNode = nodes[endIdx];
      if (!startNode || !endNode) continue;

      // Compute element stiffness
      const dx = endNode.x - startNode.x;
      const dy = endNode.y - startNode.y;
      const dz = (endNode.z || 0) - (startNode.z || 0);
      const L = Math.sqrt(dx * dx + dy * dy + dz * dz);
      if (L < 1e-12) continue; // Skip zero-length (coincident node) members

      const cx = dx / L;
      const cy = dy / L;
      const cz = dz / L;

      const E = member.E || 0;
      const A = member.A || 0;
      // Element stiffness
      let ke: number[][] = [];
      const type = member.type || "frame";

      // SIMP Scaling
      let E_eff = E;
      if (elementDensities && elementDensities[member.id] !== undefined) {
        const rho = elementDensities[member.id];
        if (rho !== undefined) {
          // E_eff = rho^p * E0 + E_min (to avoid singularity)
          E_eff = Math.pow(rho, SIMP_PENALTY) * E;
          if (E_eff < E * 1e-9) E_eff = E * 1e-9; // E_min = 1e-9 * E0
        }
      }

      // --- SELECTION LOGIC ---
      if (type === "spring") {
        const kSpringVal = member.springStiffness || E || 1.0;
        // Scale spring too? Usually yes for TopOpt on supports? Or no?
        // Assuming optimization is on structural members (E), not springs.
        // But if density map covers springs, we scale 'k'.
        // Let's assume springs are fixed supports/boundary for now (density=1).
        const kSpring = computeSpringStiffness(kSpringVal, cx, cy, cz);
        if (dofPerNode === 6) ke = mapMatrix(kSpring, [0, 1, 2, 6, 7, 8], 12);
        else if (dofPerNode === 3) ke = mapMatrix(kSpring, [0, 1, 3, 4], 6);
        else if (dofPerNode === 2) ke = mapMatrix(kSpring, [0, 1, 3, 4], 4);
        else ke = [];
      } else if (dofPerNode === 2) {
        // 2D Analysis
        if (type === "truss") {
          // Truss 2D (4x4)
          // Need angle for 2D truss. cx, cy give direction. angle = atan2(dy, dx)
          const angle = Math.atan2(dy, dx);
          ke = computeTruss2DStiffness(E_eff, A, L, angle);
        } else {
          // Re-using exiting logic for 'truss' check:
          ke = computeTruss2DStiffness(E_eff, A, L, Math.atan2(dy, dx));
        }
      } else if (dofPerNode === 3) {
        // 2D Frame (u, v, theta) - 6x6 matrix (3 dof * 2 nodes)
        if (type === "truss") {
          // Truss in 2D Frame system (still just axial)
          // We simply expand 4x4 to 6x6 with zeros for rotation
          // This requires mapping logic.
          // For now, let's keep it simple: Truss elements in Frame model
          const angle = Math.atan2(dy, dx);
          const kTruss = computeTruss2DStiffness(E_eff, A, L, angle); // 4x4

          // Expand to 6x6
          // Indices in 6x6: u1, v1, th1, u2, v2, th2 (0,1,2, 3,4,5)
          // Indices in 4x4: u1, v1, u2, v2 (0,1, 2,3)
          const idxMap = [0, 1, 3, 4];
          ke = mapMatrix(kTruss, idxMap, 6);
        } else {
          // Frame 2D
          ke = computeFrameStiffness(E_eff, A, member.I || 0, L, cx, cy, cz);
        }
      } else if (dofPerNode === 6) {
        // 3D Frame Space
        if (type === "truss") {
          // Truss 3D (6x6 translational, zero rotational)
          // computeTruss3DStiffness returns 6x6 for [u1,v1,w1, u2,v2,w2]
          // We need 12x12 for [u1,v1,w1,rx1,ry1,rz1, ...]
          const kTruss3D = computeTruss3DStiffness(E_eff, A, L, cx, cy, cz); // 6x6

          // Map 6x6 to 12x12
          // 3D Truss indices: 0,1,2 (node1 trans), 3,4,5 (node2 trans)
          // 3D Frame indices: 0,1,2 (n1 trans), 3,4,5 (n1 rot), 6,7,8 (n2 trans), 9,10,11 (n2 rot)
          // Source 0..2 -> Dest 0..2
          // Source 3..5 -> Dest 6..8
          const destIndices = [0, 1, 2, 6, 7, 8];
          ke = mapMatrix(kTruss3D, destIndices, 12);
        } else {
          // Full 3D Space Frame — bending about both axes, torsion, axial
          const Iy = member.Iy || member.I || 1e-6;
          const Iz = member.Iz || member.I || 1e-6;
          const J = member.J || 0; // 0 → fallback Iy+Iz inside fn
          const G = member.G || 0; // 0 → fallback E/2.6
          ke = computeFrame3DStiffness(
            E_eff,
            member.A,
            Iy,
            Iz,
            J,
            G,
            L,
            cx,
            cy,
            cz,
            member.betaAngle ?? 0,
          );
        }
      } else {
        // Fallback
        const k = (E_eff * member.A) / L;
        ke = computeTrussStiffness(k, cx, cy, cz, dofPerNode);
      }

      // --- GEOMETRIC STIFFNESS ---
      if (memberAxialForces && memberAxialForces[member.id]) {
        const P = memberAxialForces[member.id];
        if (P !== undefined && Math.abs(P) > 1e-5) {
          const kG = computeGeometricStiffness(
            P,
            L,
            cx,
            cy,
            cz,
            dofPerNode,
            type,
          );
          // Add Kg
          for (let r = 0; r < ke.length; r++) {
            const keRow = ke[r];
            const kgRow = kG[r];
            if (keRow && kgRow) {
              for (let c = 0; c < keRow.length; c++) {
                const kgVal = kgRow[c];
                if (kgVal !== undefined) {
                  keRow[c] = (keRow[c] || 0) + kgVal;
                }
              }
            }
          }
        }
      }

      // Apply member releases (static condensation in local coords)
      if (member.releases && type === "frame") {
        const releasedDofs = getReleasedDofs(member.releases, dofPerNode);
        if (releasedDofs.length > 0) {
          ke = applyMemberReleases(ke, releasedDofs);
        }
      }

      // Build DOF map
      const dofIndices: number[] = [];
      for (let i = 0; i < dofPerNode; i++) {
        dofIndices.push(startIdx * dofPerNode + i);
      }
      for (let i = 0; i < dofPerNode; i++) {
        dofIndices.push(endIdx * dofPerNode + i);
      }

      // Add to global matrix
      for (let i = 0; i < ke.length; i++) {
        const keRow = ke[i];
        if (!keRow) continue;
        for (let j = 0; j < keRow.length; j++) {
          const val = keRow[j];
          if (val !== undefined && Math.abs(val) > 1e-15) {
            const rowIdx = dofIndices[i];
            const colIdx = dofIndices[j];
            if (rowIdx !== undefined && colIdx !== undefined) {
              K.add(rowIdx, colIdx, val);
            }
          }
        }
      }
    } catch (memberErr) {
      // H6: Skip bad member with warning — don't crash entire analysis
      console.warn(
        `Warning: Skipping member ${member.id} (index ${m}) due to error:`,
        memberErr,
      );
    }
  }

  sendProgress("assembling", 70, "Assembling force vector...");

  // Assemble force vector
  for (const load of loads) {
    const nodeIndex = nodeIndexMap.get(load.nodeId);
    if (nodeIndex === undefined) continue;

    const baseDof = nodeIndex * dofPerNode;
    if (load.fx !== undefined) F[baseDof] = (F[baseDof] || 0) + load.fx;
    if (load.fy !== undefined) F[baseDof + 1] = (F[baseDof + 1] || 0) + load.fy;
    if (dofPerNode === 3) {
      // 2D Frame: DOF order is [u, v, θz] - apply Mz to rotation DOF
      if (load.mz !== undefined)
        F[baseDof + 2] = (F[baseDof + 2] || 0) + load.mz;
    } else {
      if (load.fz !== undefined && dofPerNode >= 3)
        F[baseDof + 2] = (F[baseDof + 2] || 0) + load.fz;
      if (load.mx !== undefined && dofPerNode >= 4)
        F[baseDof + 3] = (F[baseDof + 3] || 0) + load.mx;
      if (load.my !== undefined && dofPerNode >= 5)
        F[baseDof + 4] = (F[baseDof + 4] || 0) + load.my;
      if (load.mz !== undefined && dofPerNode >= 6)
        F[baseDof + 5] = (F[baseDof + 5] || 0) + load.mz;
    }
  }

  // ─── SELF-WEIGHT: Distribute member weight as equivalent nodal loads ───
  // Industry standard: w_sw = ρ·A·g, applied as UDL in global -Y direction.
  // Equivalent nodal loads: Fy = -ρ·A·g·L/2 at each end, Mz = ∓ρ·A·g·L²/12.
  if (selfWeight) {
    const g = 9.80665; // m/s² (standard gravity)
    for (const member of members) {
      const startIdx = nodeIndexMap.get(member.startNodeId);
      const endIdx = nodeIndexMap.get(member.endNodeId);
      if (startIdx === undefined || endIdx === undefined) continue;

      const n1 = nodes[startIdx];
      const n2 = nodes[endIdx];
      if (!n1 || !n2) continue;

      const dx = n2.x - n1.x;
      const dy = n2.y - n1.y;
      const dz = (n2.z || 0) - (n1.z || 0);
      const L = Math.sqrt(dx * dx + dy * dy + dz * dz);
      if (L < 1e-10) continue;

      const rho = member.rho ?? 7850; // kg/m³ (steel default)
      const A = member.A || 0;
      const w_sw = (rho * A * g) / 1000; // kN/m (convert N to kN)
      const totalWeight = w_sw * L; // kN

      // Self-weight acts in global -Y direction.
      // For lumped equivalent: each node gets half the total weight.
      const baseDofI = startIdx * dofPerNode;
      const baseDofJ = endIdx * dofPerNode;
      const fy_dofOffset = 1; // Y-translation is DOF index 1 for all frame types

      F[baseDofI + fy_dofOffset] =
        (F[baseDofI + fy_dofOffset] || 0) - totalWeight / 2;
      F[baseDofJ + fy_dofOffset] =
        (F[baseDofJ + fy_dofOffset] || 0) - totalWeight / 2;

      // For frame elements, also add fixed-end moments from distributed self-weight.
      // FEM for UDL w on fixed-fixed beam: M_start = +wL²/12, M_end = -wL²/12
      // But self-weight is in GLOBAL Y, for inclined members we need the component
      // perpendicular to the member in local coords. For simplicity (and industry
      // standard practice), apply as global -Y nodal loads with consistent FEF in global Y.
      if ((member.type || "frame") === "frame" && dofPerNode >= 3) {
        const FEM = (w_sw * L * L) / 12; // Fixed-end moment magnitude
        if (dofPerNode === 3) {
          // 2D frame: rotation DOF is index 2
          // Self-weight acts in global −Y. The local transverse component is
          //   q = −w_sw · (dx/L)  (signed — negative when dx>0, i.e. gravity
          //   pushes "down" in local y for a right-going member).
          // FEF for UDL q on fixed-fixed beam:
          //   M_start = +q·L²/12, M_end = −q·L²/12
          // Since q is negative for the common case, M_start < 0 and M_end > 0.
          const cosAlpha = dx / L; // SIGNED (not |dx|/L)
          const FEM_corrected = (w_sw * cosAlpha * L * L) / 12;
          F[baseDofI + 2] = (F[baseDofI + 2] || 0) - FEM_corrected;
          F[baseDofJ + 2] = (F[baseDofJ + 2] || 0) + FEM_corrected;
        } else if (dofPerNode === 6) {
          // 3D frame: Transform gravity (-Y) to local axes, apply FEF in both Mz and My
          const cx_m = dx / L;
          const cy_m = dy / L;
          const cz_m = dz / L;
          // Build local axes consistent with stiffness assembly
          const tol_sw = 1e-6;
          const isVert_sw = Math.abs(cx_m) < tol_sw && Math.abs(cz_m) < tol_sw;
          let ly_sw: number[];
          if (isVert_sw) {
            const sign_sw = cy_m > 0 ? 1 : -1;
            ly_sw = [-sign_sw, 0, 0];
          } else {
            const lzLen_sw = Math.sqrt(cz_m * cz_m + cx_m * cx_m);
            const lz_sw = [-cz_m / lzLen_sw, 0, cx_m / lzLen_sw];
            ly_sw = [
              lz_sw[1] * cz_m - lz_sw[2] * cy_m,
              lz_sw[2] * cx_m - lz_sw[0] * cz_m,
              lz_sw[0] * cy_m - lz_sw[1] * cx_m,
            ];
          }
          const lz_sw = [
            cy_m * ly_sw[2] - cz_m * ly_sw[1],
            cz_m * ly_sw[0] - cx_m * ly_sw[2],
            cx_m * ly_sw[1] - cy_m * ly_sw[0],
          ];
          // Gravity = [0, -1, 0] in global → project onto local axes
          // wLocal_y = ly_sw · [0, -w_sw, 0] = -w_sw * ly_sw[1]
          // wLocal_z = lz_sw · [0, -w_sw, 0] = -w_sw * lz_sw[1]
          const wLy_sw = -w_sw * ly_sw[1];
          const wLz_sw = -w_sw * lz_sw[1];
          // Local Y bending → Mz (DOF 5)
          if (Math.abs(wLy_sw) > 1e-10) {
            const FEM_y = (wLy_sw * L * L) / 12;
            F[baseDofI + 5] = (F[baseDofI + 5] || 0) + FEM_y;
            F[baseDofJ + 5] = (F[baseDofJ + 5] || 0) - FEM_y;
          }
          // Local Z bending → My (DOF 4) — opposite sign convention
          if (Math.abs(wLz_sw) > 1e-10) {
            const FEM_z = (wLz_sw * L * L) / 12;
            F[baseDofI + 4] = (F[baseDofI + 4] || 0) - FEM_z;
            F[baseDofJ + 4] = (F[baseDofJ + 4] || 0) + FEM_z;
          }
        }
      }
    }
  }

  // ─── MEMBER LOAD FEF: Apply fixed-end forces/moments to force vector ───
  // This converts distributed and point loads to equivalent nodal loads.
  if (memberLoads && memberLoads.length > 0) {
    for (const ml of memberLoads) {
      const member = members.find((m) => m.id === ml.memberId);
      if (!member) continue;

      const startIdx = nodeIndexMap.get(member.startNodeId);
      const endIdx = nodeIndexMap.get(member.endNodeId);
      if (startIdx === undefined || endIdx === undefined) continue;

      const n1 = nodes[startIdx];
      const n2 = nodes[endIdx];
      if (!n1 || !n2) continue;

      const dx = n2.x - n1.x;
      const dy = n2.y - n1.y;
      const dz = (n2.z || 0) - (n1.z || 0);
      const L = Math.sqrt(dx * dx + dy * dy + dz * dz);
      if (L < 1e-10) continue;

      const baseDofI = startIdx * dofPerNode;
      const baseDofJ = endIdx * dofPerNode;
      const type = ml.type || "UDL";

      if (type === "UDL" || type === "UVL") {
        const w1 = ml.w1 ?? 0;
        const w2 = ml.w2 ?? w1; // UDL: w2 = w1
        const s0 = (ml.startPos ?? 0) * L;
        const s1 = (ml.endPos ?? 1) * L;
        const loadLength = s1 - s0;
        if (
          loadLength < 1e-10 ||
          (Math.abs(w1) < 1e-12 && Math.abs(w2) < 1e-12)
        )
          continue;

        // For full-span UDL (most common case): simple FEF formulas
        if (
          Math.abs(s0) < 1e-10 &&
          Math.abs(s1 - L) < 1e-10 &&
          Math.abs(w1 - w2) < 1e-10
        ) {
          // Full-span uniform load
          const w = w1;
          if (dofPerNode === 3) {
            // 2D frame: [u1,v1,θ1, u2,v2,θ2]
            F[baseDofI + 1] = (F[baseDofI + 1] || 0) + (w * L) / 2;
            F[baseDofI + 2] = (F[baseDofI + 2] || 0) + (w * L * L) / 12;
            F[baseDofJ + 1] = (F[baseDofJ + 1] || 0) + (w * L) / 2;
            F[baseDofJ + 2] = (F[baseDofJ + 2] || 0) - (w * L * L) / 12;
          } else if (dofPerNode === 6) {
            // 3D frame: determine which DOFs receive the load based on direction
            const dir = ml.direction ?? "local_y";
            if (dir === "local_z") {
              // Local Z bending → shear in DOF 2 (uz), moment in DOF 4 (θy)
              F[baseDofI + 2] = (F[baseDofI + 2] || 0) + (w * L) / 2;
              F[baseDofI + 4] = (F[baseDofI + 4] || 0) - (w * L * L) / 12;
              F[baseDofJ + 2] = (F[baseDofJ + 2] || 0) + (w * L) / 2;
              F[baseDofJ + 4] = (F[baseDofJ + 4] || 0) + (w * L * L) / 12;
            } else if (dir === "local_x" || dir === "axial") {
              // Axial → DOF 0 (ux)
              F[baseDofI + 0] = (F[baseDofI + 0] || 0) + (w * L) / 2;
              F[baseDofJ + 0] = (F[baseDofJ + 0] || 0) + (w * L) / 2;
            } else if (dir === "global_x" || dir === "global_y" || dir === "global_z") {
              // Global direction: project load onto local axes via rotation matrix
              // Build R3 consistent with stiffness assembly
              const lx_m = [dx / L, dy / L, dz / L];
              const cx_m = lx_m[0], cy_m = lx_m[1], cz_m = lx_m[2];
              const tol_v = 1e-6;
              const isVertical_m = Math.abs(cx_m) < tol_v && Math.abs(cz_m) < tol_v;
              let ly_m: number[];
              if (isVertical_m) {
                const sign_m = cy_m > 0 ? 1 : -1;
                ly_m = [-sign_m, 0, 0];
              } else {
                const lzLen_m = Math.sqrt(cz_m * cz_m + cx_m * cx_m);
                const lz_m = [-cz_m / lzLen_m, 0, cx_m / lzLen_m];
                ly_m = [
                  lz_m[1] * cz_m - lz_m[2] * cy_m,
                  lz_m[2] * cx_m - lz_m[0] * cz_m,
                  lz_m[0] * cy_m - lz_m[1] * cx_m,
                ];
              }
              const lz_m = [
                cy_m * ly_m[2] - cz_m * ly_m[1],
                cz_m * ly_m[0] - cx_m * ly_m[2],
                cx_m * ly_m[1] - cy_m * ly_m[0],
              ];
              // R3 rows = [lx, ly, lz]; globalVec → localVec = R3 * globalVec
              const gCol = dir === "global_x" ? 0 : dir === "global_y" ? 1 : 2;
              const wLx = lx_m[gCol] * w;
              const wLy = ly_m[gCol] * w;
              const wLz = lz_m[gCol] * w;
              // Axial component
              if (Math.abs(wLx) > 1e-15) {
                F[baseDofI + 0] = (F[baseDofI + 0] || 0) + (wLx * L) / 2;
                F[baseDofJ + 0] = (F[baseDofJ + 0] || 0) + (wLx * L) / 2;
              }
              // Local Y → DOF 1, DOF 5
              if (Math.abs(wLy) > 1e-15) {
                F[baseDofI + 1] = (F[baseDofI + 1] || 0) + (wLy * L) / 2;
                F[baseDofI + 5] = (F[baseDofI + 5] || 0) + (wLy * L * L) / 12;
                F[baseDofJ + 1] = (F[baseDofJ + 1] || 0) + (wLy * L) / 2;
                F[baseDofJ + 5] = (F[baseDofJ + 5] || 0) - (wLy * L * L) / 12;
              }
              // Local Z → DOF 2, DOF 4
              if (Math.abs(wLz) > 1e-15) {
                F[baseDofI + 2] = (F[baseDofI + 2] || 0) + (wLz * L) / 2;
                F[baseDofI + 4] = (F[baseDofI + 4] || 0) - (wLz * L * L) / 12;
                F[baseDofJ + 2] = (F[baseDofJ + 2] || 0) + (wLz * L) / 2;
                F[baseDofJ + 4] = (F[baseDofJ + 4] || 0) + (wLz * L * L) / 12;
              }
            } else {
              // Default: local_y → DOF 1 (shear), DOF 5 (Mz)
              F[baseDofI + 1] = (F[baseDofI + 1] || 0) + (w * L) / 2;
              F[baseDofI + 5] = (F[baseDofI + 5] || 0) + (w * L * L) / 12;
              F[baseDofJ + 1] = (F[baseDofJ + 1] || 0) + (w * L) / 2;
              F[baseDofJ + 5] = (F[baseDofJ + 5] || 0) - (w * L * L) / 12;
            }
          }
        } else {
          // Partial or trapezoidal load — use numerical integration (Simpson's rule)
          // FEF: integrate w(x) against Hermite shape functions
          const nSeg = 20;
          let R1 = 0,
            M1_fef = 0,
            R2 = 0,
            M2_fef = 0;
          for (let k = 0; k <= nSeg; k++) {
            const x = s0 + (k / nSeg) * loadLength;
            const xi = x / L;
            const t = k / nSeg;
            const w_x = w1 + (w2 - w1) * t; // Linear interpolation of load intensity
            const dxStep = loadLength / nSeg;

            // Simpson weight
            let sw = 1;
            if (k === 0 || k === nSeg) sw = 1;
            else if (k % 2 === 1) sw = 4;
            else sw = 2;

            // Hermite shape functions for transverse displacement
            const N1 = 1 - 3 * xi * xi + 2 * xi * xi * xi;
            const N2 = L * (xi - 2 * xi * xi + xi * xi * xi);
            const N3 = 3 * xi * xi - 2 * xi * xi * xi;
            const N4 = L * (-xi * xi + xi * xi * xi);

            const factor = (w_x * dxStep * sw) / 3;
            R1 += factor * N1;
            M1_fef += factor * N2;
            R2 += factor * N3;
            M2_fef += factor * N4;
          }

          if (dofPerNode === 3) {
            F[baseDofI + 1] = (F[baseDofI + 1] || 0) + R1;
            F[baseDofI + 2] = (F[baseDofI + 2] || 0) + M1_fef;
            F[baseDofJ + 1] = (F[baseDofJ + 1] || 0) + R2;
            F[baseDofJ + 2] = (F[baseDofJ + 2] || 0) + M2_fef;
          } else if (dofPerNode === 6) {
            // Determine DOFs based on load direction (same as full-span logic)
            const dir_p = ml.direction ?? "local_y";
            if (dir_p === "local_z") {
              F[baseDofI + 2] = (F[baseDofI + 2] || 0) + R1;
              F[baseDofI + 4] = (F[baseDofI + 4] || 0) - M1_fef;
              F[baseDofJ + 2] = (F[baseDofJ + 2] || 0) + R2;
              F[baseDofJ + 4] = (F[baseDofJ + 4] || 0) - M2_fef;
            } else {
              // Default local_y → DOF 1 and DOF 5
              F[baseDofI + 1] = (F[baseDofI + 1] || 0) + R1;
              F[baseDofI + 5] = (F[baseDofI + 5] || 0) + M1_fef;
              F[baseDofJ + 1] = (F[baseDofJ + 1] || 0) + R2;
              F[baseDofJ + 5] = (F[baseDofJ + 5] || 0) + M2_fef;
            }
          }
        }
      } else if (type === "point") {
        // Point load at distance a from start
        const P = ml.P ?? 0;
        if (Math.abs(P) < 1e-12) continue;

        const a = ml.a ?? L / 2;
        const b = L - a;
        if (a < 0 || a > L) continue;

        // Fixed-end reactions for point load P at distance a from start:
        //   R1 = P·b²·(3a+b)/L³,  R2 = P·a²·(a+3b)/L³
        //   M1 = P·a·b²/L²,       M2 = -P·a²·b/L²
        const L2 = L * L;
        const L3 = L2 * L;
        const R1 = (P * b * b * (3 * a + b)) / L3;
        const R2 = (P * a * a * (a + 3 * b)) / L3;
        const M1_pt = (P * a * b * b) / L2;
        const M2_pt = (-P * a * a * b) / L2;

        if (dofPerNode === 3) {
          F[baseDofI + 1] = (F[baseDofI + 1] || 0) + R1;
          F[baseDofI + 2] = (F[baseDofI + 2] || 0) + M1_pt;
          F[baseDofJ + 1] = (F[baseDofJ + 1] || 0) + R2;
          F[baseDofJ + 2] = (F[baseDofJ + 2] || 0) + M2_pt;
        } else if (dofPerNode === 6) {
          const dir_pt = ml.direction ?? "local_y";
          if (dir_pt === "local_z") {
            F[baseDofI + 2] = (F[baseDofI + 2] || 0) + R1;
            F[baseDofI + 4] = (F[baseDofI + 4] || 0) - M1_pt;
            F[baseDofJ + 2] = (F[baseDofJ + 2] || 0) + R2;
            F[baseDofJ + 4] = (F[baseDofJ + 4] || 0) - M2_pt;
          } else {
            F[baseDofI + 1] = (F[baseDofI + 1] || 0) + R1;
            F[baseDofI + 5] = (F[baseDofI + 5] || 0) + M1_pt;
            F[baseDofJ + 1] = (F[baseDofJ + 1] || 0) + R2;
            F[baseDofJ + 5] = (F[baseDofJ + 5] || 0) + M2_pt;
          }
        }
      } else if (type === "moment") {
        // Applied moment at distance a from start
        const M_app = ml.M ?? 0;
        if (Math.abs(M_app) < 1e-12) continue;

        const a = ml.a ?? L / 2;
        const b = L - a;

        // FER for concentrated moment M at distance a:
        //   R1 = 6M·a·b/L³,  R2 = -6M·a·b/L³
        //   M1 = M·b·(2a-b)/L²,  M2 = M·a·(2b-a)/L²
        const L2 = L * L;
        const L3 = L2 * L;
        const R1 = (6 * M_app * a * b) / L3;
        const M1_mom = (M_app * b * (2 * a - b)) / L2;
        const M2_mom = (M_app * a * (2 * b - a)) / L2;

        if (dofPerNode === 3) {
          F[baseDofI + 1] = (F[baseDofI + 1] || 0) + R1;
          F[baseDofI + 2] = (F[baseDofI + 2] || 0) + M1_mom;
          F[baseDofJ + 1] = (F[baseDofJ + 1] || 0) - R1;
          F[baseDofJ + 2] = (F[baseDofJ + 2] || 0) + M2_mom;
        } else if (dofPerNode === 6) {
          const dir_mm = ml.direction ?? "local_y";
          if (dir_mm === "local_z") {
            F[baseDofI + 2] = (F[baseDofI + 2] || 0) + R1;
            F[baseDofI + 4] = (F[baseDofI + 4] || 0) - M1_mom;
            F[baseDofJ + 2] = (F[baseDofJ + 2] || 0) - R1;
            F[baseDofJ + 4] = (F[baseDofJ + 4] || 0) - M2_mom;
          } else {
            F[baseDofI + 1] = (F[baseDofI + 1] || 0) + R1;
            F[baseDofI + 5] = (F[baseDofI + 5] || 0) + M1_mom;
            F[baseDofJ + 1] = (F[baseDofJ + 1] || 0) - R1;
            F[baseDofJ + 5] = (F[baseDofJ + 5] || 0) + M2_mom;
          }
        }
      }
    }
  }

  // ─── TEMPERATURE LOADS: Compute equivalent thermal forces ───
  // Temperature loads create axial forces (F = E·A·α·ΔT) and bending moments
  // (from thermal gradients). Applied as equivalent nodal forces.
  if (temperatureLoads && temperatureLoads.length > 0) {
    for (const tl of temperatureLoads) {
      const member = members.find((m) => m.id === tl.elementId);
      if (!member) continue;

      const startIdx = nodeIndexMap.get(member.startNodeId);
      const endIdx = nodeIndexMap.get(member.endNodeId);
      if (startIdx === undefined || endIdx === undefined) continue;

      const n1 = nodes[startIdx];
      const n2 = nodes[endIdx];
      if (!n1 || !n2) continue;

      const dx = n2.x - n1.x;
      const dy = n2.y - n1.y;
      const dz = (n2.z || 0) - (n1.z || 0);
      const L = Math.sqrt(dx * dx + dy * dy + dz * dz);
      if (L < 1e-10) continue;

      const E = member.E;
      const A = member.A;
      const alpha = tl.alpha;
      const deltaT = tl.deltaT;

      // Uniform temperature: axial thermal force F_t = E·A·α·ΔT
      const Ft = E * A * alpha * deltaT;

      // Direction cosines
      const cx = dx / L;
      const cy = dy / L;
      const cz = dz / L;

      // Equivalent nodal forces in global coords:
      // Node i gets -F_t·{cx, cy, cz}, Node j gets +F_t·{cx, cy, cz}
      const baseDofI = startIdx * dofPerNode;
      const baseDofJ = endIdx * dofPerNode;

      if (dofPerNode >= 2) {
        F[baseDofI] = (F[baseDofI] || 0) - Ft * cx;
        F[baseDofI + 1] = (F[baseDofI + 1] || 0) - Ft * cy;
        F[baseDofJ] = (F[baseDofJ] || 0) + Ft * cx;
        F[baseDofJ + 1] = (F[baseDofJ + 1] || 0) + Ft * cy;
      }
      if (dofPerNode >= 3 && dofPerNode !== 3) {
        // 3D: also Z direction
        F[baseDofI + 2] = (F[baseDofI + 2] || 0) - Ft * cz;
        F[baseDofJ + 2] = (F[baseDofJ + 2] || 0) + Ft * cz;
      }

      // Thermal gradient (bending): M_t = E·I·α·(gradientY)
      const gradY = tl.gradientY ?? 0;
      if (Math.abs(gradY) > 1e-12) {
        const I = member.I || member.Iy || 0;
        const Mt = E * I * alpha * gradY;
        if (dofPerNode === 3) {
          F[baseDofI + 2] = (F[baseDofI + 2] || 0) + Mt;
          F[baseDofJ + 2] = (F[baseDofJ + 2] || 0) - Mt;
        } else if (dofPerNode === 6) {
          F[baseDofI + 5] = (F[baseDofI + 5] || 0) + Mt;
          F[baseDofJ + 5] = (F[baseDofJ + 5] || 0) - Mt;
        }
      }
    }
  }

  // Return raw TypedArrays – skip object-array intermediate
  const {
    rows: cooRows,
    cols: cooCols,
    vals: cooVals,
    count: nnz,
  } = K.getTypedArrays();
  return { cooRows, cooCols, cooVals, nnz, F, fixedDofs };
}

function computeTrussStiffness(
  k: number,
  cx: number,
  cy: number,
  cz: number,
  dofPerNode: number,
): number[][] {
  if (dofPerNode === 2) {
    const c2 = cx * cx,
      s2 = cy * cy,
      cs = cx * cy;
    return [
      [k * c2, k * cs, -k * c2, -k * cs],
      [k * cs, k * s2, -k * cs, -k * s2],
      [-k * c2, -k * cs, k * c2, k * cs],
      [-k * cs, -k * s2, k * cs, k * s2],
    ];
  } else {
    // 3D truss (6 DOF per element, 2 nodes)
    return [
      [
        k * cx * cx,
        k * cx * cy,
        k * cx * cz,
        -k * cx * cx,
        -k * cx * cy,
        -k * cx * cz,
      ],
      [
        k * cy * cx,
        k * cy * cy,
        k * cy * cz,
        -k * cy * cx,
        -k * cy * cy,
        -k * cy * cz,
      ],
      [
        k * cz * cx,
        k * cz * cy,
        k * cz * cz,
        -k * cz * cx,
        -k * cz * cy,
        -k * cz * cz,
      ],
      [
        -k * cx * cx,
        -k * cx * cy,
        -k * cx * cz,
        k * cx * cx,
        k * cx * cy,
        k * cx * cz,
      ],
      [
        -k * cy * cx,
        -k * cy * cy,
        -k * cy * cz,
        k * cy * cx,
        k * cy * cy,
        k * cy * cz,
      ],
      [
        -k * cz * cx,
        -k * cz * cy,
        -k * cz * cz,
        k * cz * cx,
        k * cz * cy,
        k * cz * cz,
      ],
    ];
  }
}

// 2D Frame (u, v, theta per node) transformed to global coordinates
function computeFrameStiffness(
  E: number,
  A: number,
  I: number,
  L: number,
  cx: number,
  cy: number,
  cz: number,
): number[][] {
  // Local 2D frame stiffness (6x6)
  const EA_L = (E * A) / L;
  const EI = E * I;
  const L2 = L * L;
  const L3 = L2 * L;

  const kLocal = [
    [EA_L, 0, 0, -EA_L, 0, 0],
    [0, (12 * EI) / L3, (6 * EI) / L2, 0, (-12 * EI) / L3, (6 * EI) / L2],
    [0, (6 * EI) / L2, (4 * EI) / L, 0, (-6 * EI) / L2, (2 * EI) / L],
    [-EA_L, 0, 0, EA_L, 0, 0],
    [0, (-12 * EI) / L3, (-6 * EI) / L2, 0, (12 * EI) / L3, (-6 * EI) / L2],
    [0, (6 * EI) / L2, (2 * EI) / L, 0, (-6 * EI) / L2, (4 * EI) / L],
  ];

  // Direction cosines (2D projection)
  const Lproj = Math.sqrt(cx * cx + cy * cy + cz * cz);
  const c = cx / Lproj;
  const s = cy / Lproj;

  // Transformation matrix T (6x6) - standard local->global
  // T rotates from local to global: [c, s; -s, c]
  const T = [
    [c, s, 0, 0, 0, 0],
    [-s, c, 0, 0, 0, 0],
    [0, 0, 1, 0, 0, 0],
    [0, 0, 0, c, s, 0],
    [0, 0, 0, -s, c, 0],
    [0, 0, 0, 0, 0, 1],
  ];

  // ke = T^T * kLocal * T
  const temp: number[][] = Array.from({ length: 6 }, () => Array(6).fill(0));
  for (let i = 0; i < 6; i++) {
    for (let j = 0; j < 6; j++) {
      for (let k = 0; k < 6; k++) {
        const kLocalVal = kLocal[i]?.[k] || 0;
        const tVal = T[k]?.[j] || 0;
        const tempRow = temp[i];
        if (tempRow !== undefined) {
          tempRow[j] = (tempRow[j] || 0) + kLocalVal * tVal;
        }
      }
    }
  }

  const kGlobal: number[][] = Array.from({ length: 6 }, () => Array(6).fill(0));
  for (let i = 0; i < 6; i++) {
    for (let j = 0; j < 6; j++) {
      for (let k = 0; k < 6; k++) {
        const tVal = T[k]?.[i] || 0;
        const tempVal = temp[k]?.[j] || 0;
        const kGlobalRow = kGlobal[i];
        if (kGlobalRow !== undefined) {
          kGlobalRow[j] = (kGlobalRow[j] || 0) + tVal * tempVal;
        }
      }
    }
  }

  return kGlobal;
}

/**
 * 3D Space Frame Element Stiffness — 12×12 in global coordinates.
 *
 * DOF order per node: [u, v, w, θx, θy, θz]
 * Local x-axis = member axis.
 *
 * @param E  Young's modulus
 * @param A  Cross-section area
 * @param Iy Iy (moment of inertia about LOCAL y — bending in local xz)
 * @param Iz Iz (moment of inertia about LOCAL z — bending in local xy)
 * @param J  Torsion constant (Saint-Venant). If 0, approximate as Σbt³/3-like fraction.
 * @param G  Shear modulus. If 0 use E / (2(1+ν)), ν=0.3 for steel.
 * @param L  Element length
 * @param cx, cy, cz  Direction cosines of the member
 */
function computeFrame3DStiffness(
  E: number,
  A: number,
  Iy: number,
  Iz: number,
  J: number,
  G: number,
  L: number,
  cx: number,
  cy: number,
  cz: number,
  betaAngle: number = 0,
): number[][] {
  // Fallbacks
  // J = Iy + Iz is only valid for CIRCULAR sections (polar MOI).
  // For open sections (I-beams, channels) J ≈ Σbt³/3 which is 100–1000× smaller.
  // Use conservative lower-bound: J ≈ min(Iy, Iz) / 500, then clamp to avoid zero.
  if (!J || J === 0) {
    J = Math.max(Math.min(Iy, Iz) / 500, (Iy + Iz) * 1e-4);
  }
  if (!G || G === 0) G = E / (2 * (1 + 0.3)); // Steel Poisson ν=0.3

  const EA_L = (E * A) / L;
  const EIz = E * Iz;
  const EIy = E * Iy;
  const GJ_L = (G * J) / L;
  const L2 = L * L;
  const L3 = L2 * L;

  // Local 12×12 stiffness (standard Euler-Bernoulli beam)
  // DOF order local: [u1, v1, w1, θx1, θy1, θz1, u2, v2, w2, θx2, θy2, θz2]
  const kL: number[][] = Array.from({ length: 12 }, () => Array(12).fill(0));

  // Helper to safely set kL values
  const setKL = (r: number, c: number, val: number) => {
    const row = kL[r];
    if (row !== undefined) {
      row[c] = val;
    }
  };

  // Axial
  setKL(0, 0, EA_L);
  setKL(0, 6, -EA_L);
  setKL(6, 0, -EA_L);
  setKL(6, 6, EA_L);

  // Torsion
  setKL(3, 3, GJ_L);
  setKL(3, 9, -GJ_L);
  setKL(9, 3, -GJ_L);
  setKL(9, 9, GJ_L);

  // Bending in local xy plane (uses Iz, rotation about z)
  const a1 = (12 * EIz) / L3;
  const a2 = (6 * EIz) / L2;
  const a3 = (4 * EIz) / L;
  const a4 = (2 * EIz) / L;

  setKL(1, 1, a1);
  setKL(1, 5, a2);
  setKL(1, 7, -a1);
  setKL(1, 11, a2);
  setKL(5, 1, a2);
  setKL(5, 5, a3);
  setKL(5, 7, -a2);
  setKL(5, 11, a4);
  setKL(7, 1, -a1);
  setKL(7, 5, -a2);
  setKL(7, 7, a1);
  setKL(7, 11, -a2);
  setKL(11, 1, a2);
  setKL(11, 5, a4);
  setKL(11, 7, -a2);
  setKL(11, 11, a3);

  // Bending in local xz plane (uses Iy, rotation about y)
  const b1 = (12 * EIy) / L3;
  const b2 = (6 * EIy) / L2;
  const b3 = (4 * EIy) / L;
  const b4 = (2 * EIy) / L;

  setKL(2, 2, b1);
  setKL(2, 4, -b2);
  setKL(2, 8, -b1);
  setKL(2, 10, -b2);
  setKL(4, 2, -b2);
  setKL(4, 4, b3);
  setKL(4, 8, b2);
  setKL(4, 10, b4);
  setKL(8, 2, -b1);
  setKL(8, 4, b2);
  setKL(8, 8, b1);
  setKL(8, 10, b2);
  setKL(10, 2, -b2);
  setKL(10, 4, b4);
  setKL(10, 8, b2);
  setKL(10, 10, b3);

  // Build 3×3 rotation matrix R from local to global
  // Local x-axis along member: lx = (cx, cy, cz)
  // Need to pick a local y-axis perpendicular to x
  const lx = [cx, cy, cz];
  let ly: number[];
  const tol = 1e-6;
  const isVertical = Math.abs(cx) < tol && Math.abs(cz) < tol;
  if (isVertical) {
    // Member along global Y — match Rust/EnhancedEngine convention:
    // local x = member axis = (0, sign, 0)
    // local y = -sign * globalX = (-sign, 0, 0)
    // local z = (0, 0, 1)
    const sign = cy > 0 ? 1 : -1;
    ly = [-sign, 0, 0];
  } else {
    // Cross product with global Y to get z, then y = z × x
    // lz_temp = lx × (0,1,0)
    const lz_temp = [
      lx[2] || 0, // cy*0 - cz*1 → -cz → wait: cx×(0,1,0) = (cy*0 - cz*1, cz*0 - cx*0, cx*1 - cy*0) = (-cz, 0, cx)
      0,
      lx[0] || 0,
    ];
    // Correct: lx × Y = (cy*0 - cz*1, cz*0 - cx*0, cx*1 - cy*0) = (-cz, 0, cx)
    lz_temp[0] = -cz;
    lz_temp[1] = 0;
    lz_temp[2] = cx;
    const lzLen = Math.sqrt(
      lz_temp[0] * lz_temp[0] +
        lz_temp[1] * lz_temp[1] +
        lz_temp[2] * lz_temp[2],
    );
    const lz = [lz_temp[0] / lzLen, lz_temp[1] / lzLen, lz_temp[2] / lzLen];

    // ly = lz × lx
    ly = [
      (lz[1] || 0) * (lx[2] || 0) - (lz[2] || 0) * (lx[1] || 0),
      (lz[2] || 0) * (lx[0] || 0) - (lz[0] || 0) * (lx[2] || 0),
      (lz[0] || 0) * (lx[1] || 0) - (lz[1] || 0) * (lx[0] || 0),
    ];
  }

  // ─── Apply betaAngle: rotate ly and lz about lx (member axis) ───
  // betaAngle is the member roll angle (degrees), standard in SAP2000/STAAD.
  // This rotates the local y-z plane about the local x-axis.
  if (betaAngle !== 0) {
    const betaRad = (betaAngle * Math.PI) / 180;
    const cb = Math.cos(betaRad);
    const sb = Math.sin(betaRad);
    // ly_new = cos(β)·ly + sin(β)·lz_before
    // We need lz_before first. Since ly is computed, lz_before = lx × ly
    const lz_before = [
      (lx[1] || 0) * (ly[2] || 0) - (lx[2] || 0) * (ly[1] || 0),
      (lx[2] || 0) * (ly[0] || 0) - (lx[0] || 0) * (ly[2] || 0),
      (lx[0] || 0) * (ly[1] || 0) - (lx[1] || 0) * (ly[0] || 0),
    ];
    const ly_new = [
      cb * (ly[0] || 0) + sb * (lz_before[0] || 0),
      cb * (ly[1] || 0) + sb * (lz_before[1] || 0),
      cb * (ly[2] || 0) + sb * (lz_before[2] || 0),
    ];
    ly = ly_new;
  }

  // Recompute lz = lx × ly (ensure right-hand system)
  const lz = [
    (lx[1] || 0) * (ly[2] || 0) - (lx[2] || 0) * (ly[1] || 0),
    (lx[2] || 0) * (ly[0] || 0) - (lx[0] || 0) * (ly[2] || 0),
    (lx[0] || 0) * (ly[1] || 0) - (lx[1] || 0) * (ly[0] || 0),
  ];

  // Rotation matrix R (3×3): columns = lx, ly, lz (rows of R = local axes in global coords)
  // Convention: u_local = R * u_global → ke_global = R^T * ke_local * R
  const R = [
    [lx[0] || 0, lx[1] || 0, lx[2] || 0],
    [ly[0] || 0, ly[1] || 0, ly[2] || 0],
    [lz[0] || 0, lz[1] || 0, lz[2] || 0],
  ];

  // Build 12×12 transformation T = diag(R, R, R, R)
  const T: number[][] = Array.from({ length: 12 }, () => Array(12).fill(0));
  for (let block = 0; block < 4; block++) {
    const off = block * 3;
    for (let i = 0; i < 3; i++) {
      for (let j = 0; j < 3; j++) {
        const rRow = R[i];
        const tRow = T[off + i];
        if (rRow !== undefined && tRow !== undefined) {
          tRow[off + j] = rRow[j] || 0;
        }
      }
    }
  }

  // ke_global = T^T * kL * T
  const temp: number[][] = Array.from({ length: 12 }, () => Array(12).fill(0));
  for (let i = 0; i < 12; i++) {
    for (let j = 0; j < 12; j++) {
      let s = 0;
      for (let k = 0; k < 12; k++) {
        const klRow = kL[i];
        const tRow = T[k];
        if (klRow !== undefined && tRow !== undefined) {
          s += (klRow[k] || 0) * (tRow[j] || 0);
        }
      }
      const tempRow = temp[i];
      if (tempRow !== undefined) {
        tempRow[j] = s;
      }
    }
  }

  const kG: number[][] = Array.from({ length: 12 }, () => Array(12).fill(0));
  for (let i = 0; i < 12; i++) {
    for (let j = 0; j < 12; j++) {
      let s = 0;
      for (let k = 0; k < 12; k++) {
        const tRow = T[k];
        const tempRow = temp[k];
        if (tRow !== undefined && tempRow !== undefined) {
          s += (tRow[i] || 0) * (tempRow[j] || 0);
        }
      }
      const kgRow = kG[i];
      if (kgRow !== undefined) {
        kgRow[j] = s;
      }
    }
  }

  return kG;
}

function computeMemberEndForces(
  model: ModelData,
  displacements: Float64Array,
  nodeIndexMap: Map<string, number>,
): MemberForceResult[] {
  const { members, nodes, dofPerNode } = model;
  const results: MemberForceResult[] = [];

  // ─── Build member-count-per-node for pin-support detection ───
  // A node with translational restraints but no moment restraint (mz=false),
  // connected to only ONE member, is a simple support (pin/roller).
  // The bending moment at that end MUST be exactly zero.
  const memberCountPerNode = new Map<string, number>();
  for (const mm of members) {
    memberCountPerNode.set(
      mm.startNodeId,
      (memberCountPerNode.get(mm.startNodeId) ?? 0) + 1,
    );
    memberCountPerNode.set(
      mm.endNodeId,
      (memberCountPerNode.get(mm.endNodeId) ?? 0) + 1,
    );
  }
  const isPinSupportNode = (nodeId: string): boolean => {
    const idx = nodeIndexMap.get(nodeId);
    if (idx === undefined) return false;
    const nd = nodes[idx];
    if (!nd?.restraints) return false;
    const r = nd.restraints as Record<string, boolean>;
    const hasTranslation = r.fx || r.fy || r.fz;
    const hasMomentRestraint = r.mz;
    const singleMember = (memberCountPerNode.get(nodeId) ?? 0) <= 1;
    return !!hasTranslation && !hasMomentRestraint && singleMember;
  };

  for (const member of members) {
    const i = nodeIndexMap.get(member.startNodeId);
    const j = nodeIndexMap.get(member.endNodeId);
    if (i === undefined || j === undefined) continue;

    const n1 = nodes[i];
    const n2 = nodes[j];
    if (!n1 || !n2) continue;

    const dx = n2.x - n1.x;
    const dy = n2.y - n1.y;
    const dz = (n2.z || 0) - (n1.z || 0);
    const L = Math.sqrt(dx * dx + dy * dy + dz * dz);
    const cx = dx / L;
    const cy = dy / L;
    const cz = dz / L;

    if (member.type === "truss") {
      // TRUSS FORCE CALCULATION — inline, unit-consistent
      // Axial force = (EA/L) * (projection of relative displacement onto member axis)
      // Works for any dofPerNode (2, 3, or 6)
      const baseI = i * dofPerNode;
      const baseJ = j * dofPerNode;
      const du_x = (displacements[baseJ] || 0) - (displacements[baseI] || 0);
      const du_y =
        (displacements[baseJ + 1] || 0) - (displacements[baseI + 1] || 0);
      const du_z =
        dofPerNode >= 3 && dofPerNode !== 3
          ? (displacements[baseJ + 2] || 0) - (displacements[baseI + 2] || 0)
          : 0; // dofPerNode=3 means 2D frame [u,v,θ] — DOF 2 is rotation, not Z

      // For dofPerNode=6, use translational DOFs only (indices 0,1,2)
      let deltaAxial: number;
      if (dofPerNode === 6) {
        deltaAxial = du_x * cx + du_y * cy + du_z * cz;
      } else {
        // 2D: project onto member axis using only x,y components
        deltaAxial = du_x * cx + du_y * cy;
      }

      const E = member.E || 0;
      const A = member.A || 0;
      const axialForce = ((E * A) / L) * deltaAxial;

      results.push({
        id: member.id,
        start: { axial: axialForce, shear: 0, moment: 0 },
        end: { axial: -axialForce, shear: 0, moment: 0 },
      });
    } else if (member.type === "spring") {
      // SPRING FORCE CALCULATION — inline, unit-consistent
      // Spring force = k * (projection of relative displacement onto spring axis)
      const baseI = i * dofPerNode;
      const baseJ = j * dofPerNode;
      const du_x = (displacements[baseJ] || 0) - (displacements[baseI] || 0);
      const du_y =
        (displacements[baseJ + 1] || 0) - (displacements[baseI + 1] || 0);
      let du_z = 0;
      if (dofPerNode === 6) {
        du_z =
          (displacements[baseJ + 2] || 0) - (displacements[baseI + 2] || 0);
      }

      const kSpring = member.springStiffness || member.E || 1.0;
      const deltaAxial = du_x * cx + du_y * cy + du_z * cz;
      const springForce = kSpring * deltaAxial;

      results.push({
        id: member.id,
        start: { axial: springForce, shear: 0, moment: 0 },
        end: { axial: -springForce, shear: 0, moment: 0 },
      });
    } else if (dofPerNode === 6) {
      // 3D SPACE FRAME FORCE CALCULATION — full 12×12
      const Iy = member.Iy || member.I || 1e-6;
      const Iz = member.Iz || member.I || 1e-6;
      let Jval = member.J || 0;
      let Gval = member.G || 0;
      // J = Iy+Iz only for circular sections. Conservative fallback for open sections:
      if (!Jval) Jval = Math.max(Math.min(Iy, Iz) / 500, (Iy + Iz) * 1e-4);
      if (!Gval) Gval = (member.E || 0) / (2 * (1 + 0.3));

      // Extract 12 DOF displacements
      const dofIndices12: number[] = [];
      for (let k = 0; k < 6; k++) dofIndices12.push(i * 6 + k);
      for (let k = 0; k < 6; k++) dofIndices12.push(j * 6 + k);
      const uGlobal12 = new Float64Array(12);
      for (let n = 0; n < 12; n++) {
        const idx = dofIndices12[n];
        if (idx !== undefined) {
          uGlobal12[n] = displacements[idx] || 0;
        }
      }

      // Build 3×3 rotation matrix R
      const lx = [cx, cy, cz];
      let ly3d: number[];
      const tol3d = 1e-6;
      const isVert = Math.abs(cx) < tol3d && Math.abs(cz) < tol3d;
      if (isVert) {
        // Must match stiffness assembly: local Y = -sign * globalX
        const sign = cy > 0 ? 1 : -1;
        ly3d = [-sign, 0, 0];
      } else {
        const lz_tmp = [-cz, 0, cx];
        const lzLen = Math.sqrt(
          (lz_tmp[0] || 0) * (lz_tmp[0] || 0) +
            (lz_tmp[2] || 0) * (lz_tmp[2] || 0),
        );
        const lz3 = [(lz_tmp[0] || 0) / lzLen, 0, (lz_tmp[2] || 0) / lzLen];
        ly3d = [
          (lz3[1] || 0) * (lx[2] || 0) - (lz3[2] || 0) * (lx[1] || 0),
          (lz3[2] || 0) * (lx[0] || 0) - (lz3[0] || 0) * (lx[2] || 0),
          (lz3[0] || 0) * (lx[1] || 0) - (lz3[1] || 0) * (lx[0] || 0),
        ];
      }

      // Apply betaAngle rotation about member axis (same as in stiffness)
      const betaDeg = member.betaAngle ?? 0;
      if (betaDeg !== 0) {
        const betaRad = (betaDeg * Math.PI) / 180;
        const cb = Math.cos(betaRad);
        const sb = Math.sin(betaRad);
        const lz_pre = [
          (lx[1] || 0) * (ly3d[2] || 0) - (lx[2] || 0) * (ly3d[1] || 0),
          (lx[2] || 0) * (ly3d[0] || 0) - (lx[0] || 0) * (ly3d[2] || 0),
          (lx[0] || 0) * (ly3d[1] || 0) - (lx[1] || 0) * (ly3d[0] || 0),
        ];
        ly3d = [
          cb * (ly3d[0] || 0) + sb * (lz_pre[0] || 0),
          cb * (ly3d[1] || 0) + sb * (lz_pre[1] || 0),
          cb * (ly3d[2] || 0) + sb * (lz_pre[2] || 0),
        ];
      }

      const lz3d = [
        (lx[1] || 0) * (ly3d[2] || 0) - (lx[2] || 0) * (ly3d[1] || 0),
        (lx[2] || 0) * (ly3d[0] || 0) - (lx[0] || 0) * (ly3d[2] || 0),
        (lx[0] || 0) * (ly3d[1] || 0) - (lx[1] || 0) * (ly3d[0] || 0),
      ];
      const R3 = [
        [lx[0] || 0, lx[1] || 0, lx[2] || 0],
        [ly3d[0] || 0, ly3d[1] || 0, ly3d[2] || 0],
        [lz3d[0] || 0, lz3d[1] || 0, lz3d[2] || 0],
      ];

      // Build 12×12 T = diag(R,R,R,R)
      const T12: number[][] = Array.from({ length: 12 }, () =>
        Array(12).fill(0),
      );
      for (let blk = 0; blk < 4; blk++) {
        const off = blk * 3;
        for (let ii = 0; ii < 3; ii++)
          for (let jj = 0; jj < 3; jj++) {
            const rRow = R3[ii];
            const tRow = T12[off + ii];
            if (rRow !== undefined && tRow !== undefined) {
              tRow[off + jj] = rRow[jj] || 0;
            }
          }
      }

      // Transform to local: u_local = T * u_global
      const uLocal12 = new Float64Array(12);
      for (let r = 0; r < 12; r++) {
        let s = 0;
        for (let c2 = 0; c2 < 12; c2++) {
          const tRow = T12[r];
          if (tRow !== undefined) {
            s += (tRow[c2] || 0) * (uGlobal12[c2] || 0);
          }
        }
        uLocal12[r] = s;
      }

      // Build local 12×12 stiffness
      const EA_L3 = ((member.E || 0) * (member.A || 0)) / L;
      const GJ_L3 = (Gval * Jval) / L;
      const EIz3 = (member.E || 0) * Iz;
      const EIy3 = (member.E || 0) * Iy;
      const L2_3 = L * L;
      const L3_3 = L2_3 * L;

      const kL12: number[][] = Array.from({ length: 12 }, () =>
        Array(12).fill(0),
      );

      const setKL12 = (r: number, c: number, val: number) => {
        const row = kL12[r];
        if (row !== undefined) {
          row[c] = val;
        }
      };

      // Axial
      setKL12(0, 0, EA_L3);
      setKL12(0, 6, -EA_L3);
      setKL12(6, 0, -EA_L3);
      setKL12(6, 6, EA_L3);
      // Torsion
      setKL12(3, 3, GJ_L3);
      setKL12(3, 9, -GJ_L3);
      setKL12(9, 3, -GJ_L3);
      setKL12(9, 9, GJ_L3);
      // Bending xy (Iz)
      const a1 = (12 * EIz3) / L3_3,
        a2 = (6 * EIz3) / L2_3,
        a3 = (4 * EIz3) / L,
        a4 = (2 * EIz3) / L;
      setKL12(1, 1, a1);
      setKL12(1, 5, a2);
      setKL12(1, 7, -a1);
      setKL12(1, 11, a2);
      setKL12(5, 1, a2);
      setKL12(5, 5, a3);
      setKL12(5, 7, -a2);
      setKL12(5, 11, a4);
      setKL12(7, 1, -a1);
      setKL12(7, 5, -a2);
      setKL12(7, 7, a1);
      setKL12(7, 11, -a2);
      setKL12(11, 1, a2);
      setKL12(11, 5, a4);
      setKL12(11, 7, -a2);
      setKL12(11, 11, a3);
      // Bending xz (Iy)
      const b1 = (12 * EIy3) / L3_3,
        b2 = (6 * EIy3) / L2_3,
        b3 = (4 * EIy3) / L,
        b4 = (2 * EIy3) / L;
      setKL12(2, 2, b1);
      setKL12(2, 4, -b2);
      setKL12(2, 8, -b1);
      setKL12(2, 10, -b2);
      setKL12(4, 2, -b2);
      setKL12(4, 4, b3);
      setKL12(4, 8, b2);
      setKL12(4, 10, b4);
      setKL12(8, 2, -b1);
      setKL12(8, 4, b2);
      setKL12(8, 8, b1);
      setKL12(8, 10, b2);
      setKL12(10, 2, -b2);
      setKL12(10, 4, b4);
      setKL12(10, 8, b2);
      setKL12(10, 10, b3);

      // f_local = kL * uL  (stiffness × local displacements)
      // FEF subtraction is applied below for force recovery.
      const fLocal12 = new Float64Array(12);
      for (let r = 0; r < 12; r++) {
        let s = 0;
        for (let c2 = 0; c2 < 12; c2++) {
          const klRow = kL12[r];
          if (klRow !== undefined) {
            s += (klRow[c2] || 0) * (uLocal12[c2] || 0);
          }
        }
        fLocal12[r] = s;
      }

      // Subtract fixed-end forces for force recovery: f = k*u − FEF
      // Uses memberLoadsForRecovery (not memberLoads, which is cleared to
      // prevent double-counting during assembly — loadConversion handles that).
      // Sign: SUBTRACTION matches McGuire convention used by Rust solver.
      const recoveryLoads =
        (model as ModelDataWithMemberLoads).memberLoadsForRecovery ??
        (model as ModelDataWithMemberLoads).memberLoads;
      if (recoveryLoads) {
        for (const ml of recoveryLoads) {
          if (ml.memberId !== member.id) continue;

          const dir = ml.direction ?? "local_y";

          // For global directions on 3D members, project load onto local axes
          // using the R3 rotation matrix (rows = local axes in global coords).
          // R3 * global_vec = local_vec
          // Column index: global_x=0, global_y=1, global_z=2
          const isGlobal = dir.startsWith("global_");
          let wLx = 0,
            wLy = 0,
            wLz = 0; // local-axis load components

          if (ml.type === "UDL") {
            const w = ml.w1 ?? 0;
            if (Math.abs(w) < 1e-15) continue;

            if (isGlobal) {
              // Which global axis?
              const gCol = dir === "global_x" ? 0 : dir === "global_y" ? 1 : 2;
              const r0 = R3[0];
              const r1 = R3[1];
              const r2 = R3[2];
              wLx = (r0 ? (r0[gCol] ?? 0) : 0) * w; // axial component
              wLy = (r1 ? (r1[gCol] ?? 0) : 0) * w; // local-Y component
              wLz = (r2 ? (r2[gCol] ?? 0) : 0) * w; // local-Z component
            } else if (dir === "local_y") {
              wLy = w;
            } else if (dir === "local_z") {
              wLz = w;
            } else if (dir === "local_x" || dir === "axial") {
              wLx = w;
            }

            // Axial FEF (local X)
            if (Math.abs(wLx) > 1e-15) {
              fLocal12[0] -= (wLx * L) / 2;
              fLocal12[6] -= (wLx * L) / 2;
            }
            // Local Y bending → Mz
            if (Math.abs(wLy) > 1e-15) {
              fLocal12[1] -= (wLy * L) / 2;
              fLocal12[5] -= (wLy * L * L) / 12;
              fLocal12[7] -= (wLy * L) / 2;
              fLocal12[11] -= (-wLy * L * L) / 12;
            }
            // Local Z bending → My (opposite sign per Rust convention)
            if (Math.abs(wLz) > 1e-15) {
              fLocal12[2] -= (wLz * L) / 2;
              fLocal12[4] -= (-wLz * L * L) / 12;
              fLocal12[8] -= (wLz * L) / 2;
              fLocal12[10] -= (wLz * L * L) / 12;
            }
          } else if (ml.type === "point") {
            const P = ml.P ?? 0;
            if (Math.abs(P) < 1e-15) continue;
            const a = ml.a ?? L / 2;
            const b = L - a;
            if (a < 0 || a > L) continue;
            const L2 = L * L;
            const L3 = L2 * L;

            let pLx = 0,
              pLy = 0,
              pLz = 0;
            if (isGlobal) {
              const gCol = dir === "global_x" ? 0 : dir === "global_y" ? 1 : 2;
              const r0 = R3[0];
              const r1 = R3[1];
              const r2 = R3[2];
              pLx = (r0 ? (r0[gCol] ?? 0) : 0) * P;
              pLy = (r1 ? (r1[gCol] ?? 0) : 0) * P;
              pLz = (r2 ? (r2[gCol] ?? 0) : 0) * P;
            } else if (dir === "local_y") {
              pLy = P;
            } else if (dir === "local_z") {
              pLz = P;
            } else if (dir === "local_x" || dir === "axial") {
              pLx = P;
            }

            // Axial FEF (local X)
            if (Math.abs(pLx) > 1e-15) {
              fLocal12[0] -= (pLx * (L - a)) / L;
              fLocal12[6] -= (pLx * a) / L;
            }
            // Local Y → Mz
            if (Math.abs(pLy) > 1e-15) {
              fLocal12[1] -= (pLy * b * b * (3 * a + b)) / L3;
              fLocal12[5] -= (pLy * a * b * b) / L2;
              fLocal12[7] -= (pLy * a * a * (a + 3 * b)) / L3;
              fLocal12[11] -= (-pLy * a * a * b) / L2;
            }
            // Local Z → My (opposite sign)
            if (Math.abs(pLz) > 1e-15) {
              fLocal12[2] -= (pLz * b * b * (3 * a + b)) / L3;
              fLocal12[4] -= (-pLz * a * b * b) / L2;
              fLocal12[8] -= (pLz * a * a * (a + 3 * b)) / L3;
              fLocal12[10] -= (pLz * a * a * b) / L2;
            }
          } else if (ml.type === "moment") {
            const M_app = ml.M ?? 0;
            if (Math.abs(M_app) < 1e-15) continue;
            const a = ml.a ?? L / 2;
            const b = L - a;
            const L2 = L * L;
            const L3 = L2 * L;

            // Concentrated moment acts about an axis.
            // For local_y direction: moment about local Z → bending in XY
            // For local_z direction: moment about local Y → bending in XZ
            if (dir === "local_y" || dir === "global_y") {
              // Moment about Mz
              const R1 = (6 * M_app * a * b) / L3;
              const M1 = (M_app * b * (2 * a - b)) / L2;
              const M2 = (M_app * a * (2 * b - a)) / L2;
              fLocal12[1] -= R1;
              fLocal12[5] -= M1;
              fLocal12[7] -= -R1;
              fLocal12[11] -= M2;
            } else if (dir === "local_z" || dir === "global_z") {
              // Moment about My (opposite sign convention)
              const R1 = (6 * M_app * a * b) / L3;
              const M1 = (M_app * b * (2 * a - b)) / L2;
              const M2 = (M_app * a * (2 * b - a)) / L2;
              fLocal12[2] -= -R1;
              fLocal12[4] -= -M1;
              fLocal12[8] -= R1;
              fLocal12[10] -= -M2;
            }
          }
        }
      }

      // ─── Zero released DOFs in force recovery ───
      // The uncondensed stiffness k*u − FEF may produce non-zero forces at
      // member-released DOFs (e.g. pin connections, moment releases).
      // By definition, a released DOF carries zero force.
      // Also clean tiny numerical residuals (< 1e-6 × peak force).
      if (member.releases) {
        const rel = member.releases;
        if (rel.fxStart) fLocal12[0] = 0;
        if (rel.fyStart) fLocal12[1] = 0;
        if (rel.fzStart) fLocal12[2] = 0;
        if (rel.mxStart) fLocal12[3] = 0;
        if (rel.myStart) fLocal12[4] = 0;
        if (rel.mzStart) fLocal12[5] = 0;
        if (rel.fxEnd) fLocal12[6] = 0;
        if (rel.fyEnd) fLocal12[7] = 0;
        if (rel.fzEnd) fLocal12[8] = 0;
        if (rel.mxEnd) fLocal12[9] = 0;
        if (rel.myEnd) fLocal12[10] = 0;
        if (rel.mzEnd) fLocal12[11] = 0;
      }
      // ─── Pin/roller support zeroing: zero moment at simple supports ───
      if (isPinSupportNode(member.startNodeId)) {
        fLocal12[4] = 0; // My at start
        fLocal12[5] = 0; // Mz at start
      }
      if (isPinSupportNode(member.endNodeId)) {
        fLocal12[10] = 0; // My at end
        fLocal12[11] = 0; // Mz at end
      }
      // Clean numerical noise: zero values below 1e-6 of peak force
      let peakF12 = 0;
      for (let k = 0; k < 12; k++) {
        const absV = Math.abs(fLocal12[k]);
        if (absV > peakF12) peakF12 = absV;
      }
      if (peakF12 > 1e-15) {
        const tol12 = peakF12 * 1e-6;
        for (let k = 0; k < 12; k++) {
          if (Math.abs(fLocal12[k]) < tol12) fLocal12[k] = 0;
        }
      }

      results.push({
        id: member.id,
        localDisplacements: uLocal12,
        start: {
          axial: fLocal12[0] || 0,
          shear: fLocal12[1] || 0,
          shearZ: fLocal12[2] || 0,
          torsion: fLocal12[3] || 0,
          momentY: fLocal12[4] || 0,
          moment: fLocal12[5] || 0, // Mz at start
        },
        end: {
          axial: fLocal12[6] || 0,
          shear: fLocal12[7] || 0,
          shearZ: fLocal12[8] || 0,
          torsion: fLocal12[9] || 0,
          momentY: fLocal12[10] || 0,
          moment: fLocal12[11] || 0, // Mz at end
        },
      });
    } else if (dofPerNode >= 3) {
      // 2D FRAME FORCE CALCULATION (dofPerNode = 3)
      const dofIndices = [
        i * dofPerNode + 0,
        i * dofPerNode + 1,
        i * dofPerNode + 2,
        j * dofPerNode + 0,
        j * dofPerNode + 1,
        j * dofPerNode + 2,
      ];

      const uGlobal = new Float64Array(6);
      for (let n = 0; n < 6; n++) {
        const idx = dofIndices[n];
        if (idx !== undefined) {
          uGlobal[n] = displacements[idx] || 0;
        }
      }

      // Build transformation matrix T (same as in stiffness)
      const Lproj = Math.sqrt(cx * cx + cy * cy + cz * cz);
      const c = cx / Lproj;
      const s = cy / Lproj;
      const T = [
        [c, s, 0, 0, 0, 0],
        [-s, c, 0, 0, 0, 0],
        [0, 0, 1, 0, 0, 0],
        [0, 0, 0, c, s, 0],
        [0, 0, 0, -s, c, 0],
        [0, 0, 0, 0, 0, 1],
      ];

      const uLocal = new Float64Array(6);
      for (let r = 0; r < 6; r++) {
        let sum = 0;
        for (let cIdx = 0; cIdx < 6; cIdx++) {
          const tRow = T[r];
          if (tRow !== undefined) {
            sum += (tRow[cIdx] || 0) * (uGlobal[cIdx] || 0);
          }
        }
        uLocal[r] = sum;
      }

      // Local end forces f = k_local * u_local
      const EA_L = ((member.E || 0) * (member.A || 0)) / L;
      const EI = (member.E || 0) * (member.I || 0);
      const L2 = L * L;
      const L3 = L2 * L;

      const kLocal = [
        [EA_L, 0, 0, -EA_L, 0, 0],
        [0, (12 * EI) / L3, (6 * EI) / L2, 0, (-12 * EI) / L3, (6 * EI) / L2],
        [0, (6 * EI) / L2, (4 * EI) / L, 0, (-6 * EI) / L2, (2 * EI) / L],
        [-EA_L, 0, 0, EA_L, 0, 0],
        [0, (-12 * EI) / L3, (-6 * EI) / L2, 0, (12 * EI) / L3, (-6 * EI) / L2],
        [0, (6 * EI) / L2, (2 * EI) / L, 0, (-6 * EI) / L2, (4 * EI) / L],
      ];

      // f_local = k_local * u_local − FEF (subtraction for force recovery)
      const fLocal = new Float64Array(6);
      for (let r = 0; r < 6; r++) {
        let sum = 0;
        for (let cIdx = 0; cIdx < 6; cIdx++) {
          const klRow = kLocal[r];
          if (klRow !== undefined) {
            sum += (klRow[cIdx] || 0) * (uLocal[cIdx] || 0);
          }
        }
        fLocal[r] = sum;
      }

      // Subtract FEF for force recovery: f = k*u − FEF
      // Uses memberLoadsForRecovery (memberLoads is cleared for assembly).
      // For global directions, project onto local axes using 2D rotation.
      const recoveryLoads2D =
        (model as ModelDataWithMemberLoads).memberLoadsForRecovery ??
        (model as ModelDataWithMemberLoads).memberLoads;
      if (recoveryLoads2D) {
        for (const ml of recoveryLoads2D) {
          if (ml.memberId !== member.id) continue;
          const dir = ml.direction ?? "local_y";
          const isGlobal = dir.startsWith("global_");

          if (ml.type === "UDL") {
            const w = ml.w1 ?? 0;
            if (Math.abs(w) < 1e-15) continue;

            let wAxial = 0,
              wTransverse = 0;
            if (isGlobal) {
              // 2D rotation: local_x = c*gx + s*gy, local_y = -s*gx + c*gy
              if (dir === "global_x") {
                wAxial = c * w;
                wTransverse = -s * w;
              } else if (dir === "global_y") {
                wAxial = s * w;
                wTransverse = c * w;
              }
              // global_z not applicable in 2D
            } else if (dir === "local_y") {
              wTransverse = w;
            } else if (dir === "local_x" || dir === "axial") {
              wAxial = w;
            }

            if (Math.abs(wAxial) > 1e-15) {
              fLocal[0] -= (wAxial * L) / 2;
              fLocal[3] -= (wAxial * L) / 2;
            }
            if (Math.abs(wTransverse) > 1e-15) {
              fLocal[1] -= (wTransverse * L) / 2;
              fLocal[2] -= (wTransverse * L * L) / 12;
              fLocal[4] -= (wTransverse * L) / 2;
              fLocal[5] -= (-wTransverse * L * L) / 12;
            }
          } else if (ml.type === "point") {
            const P = ml.P ?? 0;
            if (Math.abs(P) < 1e-15) continue;
            const a = ml.a ?? L / 2;
            const b = L - a;
            if (a < 0 || a > L) continue;

            let pAxial = 0,
              pTransverse = 0;
            if (isGlobal) {
              if (dir === "global_x") {
                pAxial = c * P;
                pTransverse = -s * P;
              } else if (dir === "global_y") {
                pAxial = s * P;
                pTransverse = c * P;
              }
            } else if (dir === "local_y") {
              pTransverse = P;
            } else if (dir === "local_x" || dir === "axial") {
              pAxial = P;
            }

            if (Math.abs(pAxial) > 1e-15) {
              fLocal[0] -= (pAxial * (L - a)) / L;
              fLocal[3] -= (pAxial * a) / L;
            }
            if (Math.abs(pTransverse) > 1e-15) {
              fLocal[1] -= (pTransverse * b * b * (3 * a + b)) / (L * L * L);
              fLocal[2] -= (pTransverse * a * b * b) / (L * L);
              fLocal[4] -= (pTransverse * a * a * (a + 3 * b)) / (L * L * L);
              fLocal[5] -= (-pTransverse * a * a * b) / (L * L);
            }
          } else if (ml.type === "moment") {
            const M_app = ml.M ?? 0;
            if (Math.abs(M_app) < 1e-15) continue;
            const a = ml.a ?? L / 2;
            const b = L - a;
            const R1 = (6 * M_app * a * b) / (L * L * L);
            const M1 = (M_app * b * (2 * a - b)) / (L * L);
            const M2 = (M_app * a * (2 * b - a)) / (L * L);
            fLocal[1] -= R1;
            fLocal[2] -= M1;
            fLocal[4] -= -R1;
            fLocal[5] -= M2;
          }
        }
      }

      // Zero released DOFs for 2D frame (DOFs: [axial1, shear1, moment1, axial2, shear2, moment2])
      if (member.releases) {
        const rel = member.releases;
        if (rel.fxStart) fLocal[0] = 0;
        if (rel.fyStart) fLocal[1] = 0;
        if (rel.mzStart) fLocal[2] = 0;
        if (rel.fxEnd) fLocal[3] = 0;
        if (rel.fyEnd) fLocal[4] = 0;
        if (rel.mzEnd) fLocal[5] = 0;
      }
      // Pin/roller support zeroing for 2D
      if (isPinSupportNode(member.startNodeId)) fLocal[2] = 0; // Mz at start
      if (isPinSupportNode(member.endNodeId)) fLocal[5] = 0; // Mz at end
      // Clean numerical noise
      let peakF6 = 0;
      for (let k = 0; k < 6; k++) {
        const absV = Math.abs(fLocal[k]);
        if (absV > peakF6) peakF6 = absV;
      }
      if (peakF6 > 1e-15) {
        const tol6 = peakF6 * 1e-6;
        for (let k = 0; k < 6; k++) {
          if (Math.abs(fLocal[k]) < tol6) fLocal[k] = 0;
        }
      }

      results.push({
        id: member.id,
        localDisplacements: uLocal,
        start: {
          axial: fLocal[0] || 0,
          shear: fLocal[1] || 0,
          moment: fLocal[2] || 0,
        },
        end: {
          axial: fLocal[3] || 0,
          shear: fLocal[4] || 0,
          moment: fLocal[5] || 0,
        },
      });
    }
  }

  return results;
}

// ============================================
// SFD / BMD / DEFLECTION DIAGRAM GENERATOR
// ============================================

/**
 * Generates intermediate station diagram data from member end forces.
 * Uses exact Euler-Bernoulli beam theory with cubic Hermite interpolation.
 *
 * For a member with end forces [N1, V1, M1, N2, V2, M2]:
 *   V(x) = V1                              (constant for no span load)
 *   M_internal(x) = -M1 + V1*x             (linear for no span load)
 *   For UDL w: V(x) = V1 - w*x, M_internal(x) = -M1 + V1*x - w*x²/2
 *   (FEM Mz is CCW+; internal bending moment is sagging+ → negate M1)
 *
 * Generates NUM_STATIONS equally-spaced points along each member.
 */
const DIAGRAM_STATIONS = 51;

function generateDiagramData(
  memberEndForces: MemberForceResult[],
  model: ModelData,
  nodeIndexMap: Map<string, number>,
): MemberForceResult[] {
  const enriched: MemberForceResult[] = [];

  for (const mf of memberEndForces) {
    const member = model.members.find((m) => m.id === mf.id);
    if (!member) {
      enriched.push(mf);
      continue;
    }

    const iIdx = nodeIndexMap.get(member.startNodeId);
    const jIdx = nodeIndexMap.get(member.endNodeId);
    if (iIdx === undefined || jIdx === undefined) {
      enriched.push(mf);
      continue;
    }

    const n1 = model.nodes[iIdx];
    const n2 = model.nodes[jIdx];
    if (!n1 || !n2) {
      enriched.push(mf);
      continue;
    }
    const dx = n2.x - n1.x;
    const dy = n2.y - n1.y;
    const dz = (n2.z ?? 0) - (n1.z ?? 0);
    const L = Math.sqrt(dx * dx + dy * dy + dz * dz);
    if (L < 1e-10) {
      enriched.push(mf);
      continue;
    }

    // Extract end forces in local coords
    // These are TOTAL forces (k_local * u_local + FEF), already include all load effects
    const V1 = mf.start?.shear ?? 0; // Shear at start (local Y)
    const M1 = mf.start?.moment ?? 0; // Moment at start (Mz)
    const N1 = mf.start?.axial ?? 0; // Axial at start
    const N2 = mf.end?.axial ?? 0;
    const V2 = mf.end?.shear ?? 0; // Shear at end (local Y)
    const M2 = mf.end?.moment ?? 0; // Moment at end (Mz)

    // Z-direction forces (3D frames)
    const Vz1 = mf.start?.shearZ ?? 0; // Shear Z at start
    const My1 = mf.start?.momentY ?? 0; // Moment about Y at start
    const Tx1 = mf.start?.torsion ?? 0; // Torsion at start
    const Vz2 = mf.end?.shearZ ?? 0;
    const My2 = mf.end?.momentY ?? 0; // Moment about Y at end
    const Tx2 = mf.end?.torsion ?? 0;

    const EIz = (member.E ?? 2e8) * (member.I ?? 1e-4); // EI for bending about Z (deflection in Y)
    const EIy = (member.E ?? 2e8) * (member.Iy ?? member.I ?? 1e-4); // EI for bending about Y (deflection in Z)

    // ─── Gather actual member loads for piecewise SFD/BMD generation ───
    const allMemberLoads: DiagramLoad[] = ((model as ModelDataWithMemberLoads)
      .memberLoadsForRecovery ??
      (model as ModelDataWithMemberLoads).memberLoads ??
      []) as DiagramLoad[];
    const myLoads = allMemberLoads.filter(
      (ml) => (ml as MemberLoadItem).memberId === mf.id,
    );
    const { ly: lyAxis, lz: lzAxis } = buildLocalAxesForDiagram(
      dx,
      dy,
      dz,
      L,
      member.betaAngle ?? 0,
    );

    // Build station positions (includes discontinuity points for point loads / moments)
    const stations = buildDiagramStations(L, myLoads, DIAGRAM_STATIONS);

    // ─── Extract actual local nodal displacements for Hermite interpolation ───
    const ld = mf.localDisplacements;
    let vy1 = 0,
      thz1 = 0,
      vy2 = 0,
      thz2 = 0; // Y-deflection: vy and θz
    let vz1 = 0,
      thy1 = 0,
      vz2 = 0,
      thy2 = 0; // Z-deflection: vz and θy

    if (ld && ld.length === 12) {
      // 3D frame: [u1,vy1,vz1,θx1,θy1,θz1, u2,vy2,vz2,θx2,θy2,θz2]
      vy1 = ld[1] || 0;
      thz1 = ld[5] || 0;
      vy2 = ld[7] || 0;
      thz2 = ld[11] || 0;
      vz1 = ld[2] || 0;
      thy1 = ld[4] || 0;
      vz2 = ld[8] || 0;
      thy2 = ld[10] || 0;
    } else if (ld && ld.length === 6) {
      // 2D frame: [u1,v1,θ1, u2,v2,θ2]
      vy1 = ld[1] || 0;
      thz1 = ld[2] || 0;
      vy2 = ld[4] || 0;
      thz2 = ld[5] || 0;
    }

    // Generate stations
    // Naming convention: Mz_arr = internal bending moment about Z-axis (primary, XY plane)
    //                    My_arr = internal bending moment about Y-axis (weak-axis, XZ plane)
    const numSt = stations.length;
    const x_values: number[] = [];
    const shear_y: number[] = [];
    const Mz_arr: number[] = []; // Internal moment about Z (primary BMD)
    const axial: number[] = [];
    const deflection_y: number[] = [];
    const shear_z: number[] = [];
    const My_arr: number[] = []; // Internal moment about Y (weak-axis BMD)
    const torsion: number[] = [];
    const deflection_z: number[] = [];

    for (let s = 0; s < numSt; s++) {
      const x = stations[s];
      const xi = L > 1e-12 ? x / L : 0; // normalized 0..1

      x_values.push(x);

      // ─── Axial: constant along member (no intermediate axial loads) ───
      axial.push(N1);

      // ─── Accumulate actual load effects at this position ───
      const { dVy, dMz, dVz, dMy } = accumulateLoadEffects(
        x,
        myLoads,
        L,
        lyAxis,
        lzAxis,
      );

      // accumulateLoadEffects returns the integral of the applied load:
      //   dVy = ∫₀ˣ w_y(s)ds,  dMz = ∫₀ˣ w_y(s)·(x−s)ds
      // Free-body equilibrium of the left portion [0, x]:
      //   V(x) = V₁ + dVy,  M(x) = −M₁ + V₁·x + dMz

      // ─── Shear Y: V(x) = V1 + dVy ───
      shear_y.push(V1 + dVy);

      // ─── Moment about Z (internal bending moment — PRIMARY BMD) ───
      //   Mz_internal(x) = −M1 + V1·x + dMz
      Mz_arr.push(-M1 + V1 * x + dMz);

      // ─── Shear Z: Vz(x) = Vz1 + dVz ───
      shear_z.push(Vz1 + dVz);

      // ─── Moment about Y (weak-axis BMD — XZ plane bending) ───
      //   My_internal(x) = My1 + Vz1·x + dMy
      My_arr.push(My1 + Vz1 * x + dMy);

      // ─── Torsion: linear interpolation between ends ───
      torsion.push(Tx1 + (Tx2 - Tx1) * xi);
    }

    // ─── Enforce endpoint closure ───
    // Floating-point drift in the integration can cause the last station to
    // deviate from the solver's end value. Force exact endpoint match.
    //
    // At node j (far end), the sign conventions are:
    //   Shear: V_internal(L) = −V2  (reaction opposes internal shear)
    //   Mz:    M_internal(L) = +M2  (at far end, the CCW↔sagging relationship
    //          reverses vs the near end, so Mz is NOT negated)
    //   My:    My_internal(L) = −My2 (Rust solver negates My FEF, so extra
    //          negation at far end is needed to stay consistent)
    if (numSt > 0) {
      Mz_arr[0] = -M1;
      Mz_arr[numSt - 1] = M2; // NOT -M2: at far end, M_internal = Mz_j
      My_arr[0] = My1;
      My_arr[numSt - 1] = -My2;
      shear_y[0] = V1;
      shear_y[numSt - 1] = -V2;
      shear_z[0] = Vz1;
      shear_z[numSt - 1] = -Vz2;
    }

    // ─── Deflection Y via double integration of Mz(x) ───
    //   EI_z · v″ = M_z → integrate with sign = +1
    const rawDeflY = integrateDeflection(stations, Mz_arr, EIz, vy1, vy2, L, 1);
    for (let s = 0; s < numSt; s++) deflection_y.push(rawDeflY[s] * 1000); // m → mm

    // ─── Deflection Z via double integration of My(x) ───
    //   EI_y · v″ = −M_y → integrate with sign = −1
    const rawDeflZ = integrateDeflection(
      stations,
      My_arr,
      EIy,
      vz1,
      vz2,
      L,
      -1,
    );
    for (let s = 0; s < numSt; s++) deflection_z.push(rawDeflZ[s] * 1000); // m → mm

    // Find max absolute values
    const maxAbs = (arr: number[]) =>
      arr.reduce((mx, v) => Math.max(mx, Math.abs(v)), 0);

    enriched.push({
      ...mf,
      maxShearY: maxAbs(shear_y),
      maxShearZ: maxAbs(shear_z),
      maxMomentZ: maxAbs(Mz_arr), // Primary BMD (about Z-axis)
      maxMomentY: maxAbs(My_arr), // Weak-axis BMD (about Y-axis)
      maxAxial: maxAbs(axial),
      maxDeflectionY: maxAbs(deflection_y),
      maxDeflectionZ: maxAbs(deflection_z),
      diagramData: {
        x_values,
        shear_y,
        shear_z,
        moment_y: My_arr, // My(x) — bending about Y-axis (weak-axis, XZ plane)
        moment_z: Mz_arr, // Mz(x) — bending about Z-axis (primary, XY plane)
        axial,
        torsion,
        deflection_y,
        deflection_z,
      },
    });
  }

  return enriched;
}

// ============================================
// MAIN ANALYSIS FUNCTION
// ============================================

// ============================================
// ASSEMBLY & SOLVER
// ============================================

// SIMP Penalty parameter
const SIMP_PENALTY = 3; // Common value for SIMP

// Helper for Topology Optimization
function computeSensitivity(rho: number, p: number, energy0: number): number {
  // dc/drho = -p * rho^(p-1) * (u^T K0 u)
  // Here, energy0 is u^T K0 u
  return -p * Math.pow(rho, p - 1) * energy0;
}

function updateDensitiesOC(
  densities: number[],
  sensitivities: number[],
  volumes: number[],
  totalTargetVol: number,
  moveLimit: number = 0.2,
  eta: number = 0.5, // Damping factor for OC
): number[] {
  const n = densities.length;
  const newDensities = new Array<number>(n);

  // Binary search for Lagrange multiplier lambda
  let lambdaMin = 0;
  let lambdaMax = 1e9; // A sufficiently large number
  let lambda = 0;

  for (let iter = 0; iter < 50; iter++) {
    // Max 50 iterations for lambda search
    lambda = (lambdaMin + lambdaMax) / 2;
    let currentVolume = 0;

    for (let i = 0; i < n; i++) {
      const d = densities[i] ?? 0;
      const s = sensitivities[i] ?? 0;
      const v = volumes[i] ?? 0;
      // Heuristic update rule (Optimality Criteria)
      // x_new = x * (-dc/dx / lambda)^eta
      let val = d * Math.pow(-s / lambda, eta);

      // Apply move limit
      val = Math.max(d - moveLimit, Math.min(d + moveLimit, val));

      // Apply bounds [0.001, 1]
      newDensities[i] = Math.max(0.001, Math.min(1, val));
      currentVolume += (newDensities[i] ?? 0) * v;
    }

    if (currentVolume > totalTargetVol) {
      lambdaMin = lambda;
    } else {
      lambdaMax = lambda;
    }
    if (lambdaMax - lambdaMin < 1e-6) break; // Convergence check for lambda
  }

  return newDensities;
}

// Analysis Implementation
// Helper to wait for WASM initialization
async function waitForWasm(): Promise<void> {
  if (wasmReady) return;

  // Check every 100ms
  return new Promise((resolve, reject) => {
    const start = performance.now();
    const checkInterval = setInterval(() => {
      if (wasmReady) {
        clearInterval(checkInterval);
        resolve();
      } else if (performance.now() - start > 10000) {
        // 10s timeout
        clearInterval(checkInterval);
        reject(new Error("Timeout waiting for WASM solver module."));
      }
    }, 100);
  });
}

// Analysis Implementation
// Helper to call WASM sparse solver with TypedArrays (Zero-Copy-ish)
// Overload 1: Pre-built TypedArrays (fast path — zero intermediate allocations)
// Overload 2: Object-array entries (legacy path — for dynamic_time_history)
function solveSystemWasmTyped(
  rows: Uint32Array,
  cols: Uint32Array,
  vals: Float64Array,
  F: Float64Array,
  dof: number,
): Float64Array {
  if (!wasmModule || !wasmModule.solve_sparse_system) {
    if (wasmModule && wasmModule.solve_sparse_system_json) {
      console.warn("Using slow JSON solver path");
      const entries: SparseEntry[] = new Array(rows.length);
      for (let i = 0; i < rows.length; i++) {
        entries[i] = {
          row: rows[i] ?? 0,
          col: cols[i] ?? 0,
          value: vals[i] ?? 0,
        };
      }
      const input = { entries, forces: Array.from(F), size: dof };
      const res = JSON.parse(
        wasmModule.solve_sparse_system_json(JSON.stringify(input)),
      );
      if (!res.success) throw new Error(res.error);
      return new Float64Array(res.displacements);
    }
    throw new Error(
      "WASM solve_sparse_system not available. Please rebuild solver-wasm.",
    );
  }

  try {
    const estimatedBytes = rows.length * 16 + dof * 8 * 2;
    if (estimatedBytes > 500 * 1024 * 1024) {
      console.warn(
        `[Solver] Large allocation: ${(estimatedBytes / 1024 / 1024).toFixed(0)}MB`,
      );
    }
    return wasmModule.solve_sparse_system(rows, cols, vals, F, dof);
  } catch (e) {
    const errorStr = String(e);
    if (
      errorStr.includes("memory") ||
      errorStr.includes("OOM") ||
      errorStr.includes("alloc") ||
      errorStr.includes("grow")
    ) {
      throw new Error(
        `Out of memory: Model with ${dof.toLocaleString()} DOF requires too much memory.`,
      );
    } else if (
      errorStr.includes("unreachable") ||
      errorStr.includes("RuntimeError")
    ) {
      throw new Error(
        `Solver crashed (Error 5): Model may be too large or malformed.`,
      );
    } else if (
      errorStr.includes("unstable") ||
      errorStr.includes("singular") ||
      errorStr.includes("indefinite")
    ) {
      throw new Error("Structure is unstable. Add proper supports.");
    } else {
      throw new Error("Solver Failed: " + errorStr);
    }
  }
}

function solveSystemWasm(
  entries: SparseEntry[],
  F: Float64Array | number[],
  dof: number,
): Float64Array {
  if (!wasmModule || !wasmModule.solve_sparse_system) {
    // Fallback or error
    if (wasmModule && wasmModule.solve_sparse_system_json) {
      // Legacy Path (if WASM not updated yet)
      console.warn("Using slow JSON solver path");
      const input = {
        entries: entries,
        forces: F instanceof Float64Array ? Array.from(F) : F,
        size: dof,
      };
      const res = JSON.parse(
        wasmModule.solve_sparse_system_json(JSON.stringify(input)),
      );
      if (!res.success) throw new Error(res.error);
      return new Float64Array(res.displacements);
    }
    throw new Error(
      "WASM solve_sparse_system not available. Please rebuild solver-wasm.",
    );
  }

  // Convert to TypedArrays for efficient WASM boundary crossing
  const count = entries.length;
  const rows = new Uint32Array(count);
  const cols = new Uint32Array(count);
  const vals = new Float64Array(count);

  for (let i = 0; i < count; i++) {
    const e = entries[i];
    rows[i] = e?.row ?? 0;
    cols[i] = e?.col ?? 0;
    vals[i] = e?.value ?? 0;
  }

  const forces = F instanceof Float64Array ? F : new Float64Array(F);

  // Call WASM directly
  // This expects: solve_sparse_system(rows: Uint32Array, cols: Uint32Array, vals: Float64Array, forces: Float64Array, size: number)
  try {
    // Check for memory before calling WASM
    const estimatedBytes = count * 16 + dof * 8 * 2; // entries + vectors
    if (estimatedBytes > 500 * 1024 * 1024) {
      // 500MB warning
      console.warn(
        `[Solver] Large allocation: ${(estimatedBytes / 1024 / 1024).toFixed(0)}MB`,
      );
    }

    const displacements = wasmModule.solve_sparse_system(
      rows,
      cols,
      vals,
      forces,
      dof,
    );
    return displacements;
  } catch (e) {
    const errorStr = String(e);
    // Provide user-friendly error messages for common failure modes
    if (
      errorStr.includes("memory") ||
      errorStr.includes("OOM") ||
      errorStr.includes("alloc") ||
      errorStr.includes("grow")
    ) {
      throw new Error(
        `Out of memory: Model with ${dof.toLocaleString()} DOF requires too much memory. Try:\n• Reducing model size\n• Closing other browser tabs\n• Using cloud solver for large models`,
      );
    } else if (
      errorStr.includes("unreachable") ||
      errorStr.includes("RuntimeError")
    ) {
      throw new Error(
        `Solver crashed (Error 5): Model may be too large or malformed. Try:\n• Checking for disconnected nodes\n• Reducing model complexity\n• Using cloud solver`,
      );
    } else if (
      errorStr.includes("unstable") ||
      errorStr.includes("singular") ||
      errorStr.includes("indefinite")
    ) {
      throw new Error(
        "Structure is unstable. Please ensure:\n• All nodes have proper supports (at least 3 DOF restrained)\n• The structure is not a mechanism\n• All members are connected to the rest of the structure",
      );
    } else if (errorStr.includes("boundary conditions")) {
      throw new Error(
        "Missing boundary conditions. Add fixed or pinned supports to the structure.",
      );
    } else if (errorStr.includes("too large") || errorStr.includes("exceeds")) {
      throw new Error(
        `Model exceeds solver limits: ${dof.toLocaleString()} DOF. Use cloud solver for large models.`,
      );
    } else {
      throw new Error("Solver Failed: " + errorStr);
    }
  }
}

/**
 * Apply penalty boundary conditions directly to COO TypedArrays.
 * Appends penalty entries and zeroes out F at fixed DOFs.
 * Returns new typed arrays with the extra entries appended.
 */
/**
 * Compute support reactions: R = K*u - F at fixed DOFs.
 * Uses pre-BC COO stiffness matrix to compute K*u at supported DOFs,
 * then subtracts the original applied force vector.
 */
function computeReactions(
  cooRows: Uint32Array,
  cooCols: Uint32Array,
  cooVals: Float64Array,
  nnz: number,
  displacements: Float64Array,
  F_orig: Float64Array,
  fixedDofs: Set<number>,
  totalDof: number,
): Float64Array {
  const reactions = new Float64Array(totalDof);
  // Compute K*u at fixed DOF rows only
  for (let k = 0; k < nnz; k++) {
    const row = cooRows[k];
    const col = cooCols[k];
    if (row !== undefined && col !== undefined && fixedDofs.has(row)) {
      const prev = reactions[row] ?? 0;
      reactions[row] = prev + (cooVals[k] ?? 0) * (displacements[col] ?? 0);
    }
  }
  // Subtract original applied forces
  for (const dof of fixedDofs) {
    const prev = reactions[dof] ?? 0;
    reactions[dof] = prev - (F_orig[dof] ?? 0);
  }
  return reactions;
}

/**
 * Equilibrium check: ΣReactions ≈ ΣApplied for force/moment balance.
 * Returns an object matching the Rust EquilibriumCheck format.
 *
 * For 2D (dofPerNode=3): checks Fx, Fy, Mz
 * For 3D (dofPerNode=6): checks all 6 components
 */
interface EquilibriumCheckResult {
  applied_forces: number[];
  reaction_forces: number[];
  residual: number[];
  error_percent: number;
  pass: boolean;
}

function computeEquilibriumCheck(
  nodes: NodeData[],
  loads: LoadData[],
  reactions: Float64Array,
  fixedDofs: Set<number>,
  dofPerNode: number,
): EquilibriumCheckResult {
  const nComp = dofPerNode <= 3 ? 3 : 6; // [Fx,Fy,Mz] or [Fx,Fy,Fz,Mx,My,Mz]
  const sumApplied = new Array(nComp).fill(0);
  const sumReactions = new Array(nComp).fill(0);

  // Sum applied nodal loads
  const nodeIndexMap = new Map<string, number>();
  nodes.forEach((n, i) => nodeIndexMap.set(n.id, i));

  for (const load of loads) {
    const idx = nodeIndexMap.get(load.nodeId);
    if (idx === undefined) continue;
    const n = nodes[idx];
    if (!n) continue;
    if (dofPerNode <= 3) {
      sumApplied[0] += load.fx || 0;
      sumApplied[1] += load.fy || 0;
      // Moment about origin: Mz += mz + x*Fy - y*Fx
      sumApplied[2] +=
        (load.mz || 0) + n.x * (load.fy || 0) - n.y * (load.fx || 0);
    } else {
      sumApplied[0] += load.fx || 0;
      sumApplied[1] += load.fy || 0;
      sumApplied[2] += load.fz || 0;
      const nx = n.x,
        ny = n.y,
        nz = n.z || 0;
      sumApplied[3] +=
        (load.mx || 0) + ny * (load.fz || 0) - nz * (load.fy || 0);
      sumApplied[4] +=
        (load.my || 0) + nz * (load.fx || 0) - nx * (load.fz || 0);
      sumApplied[5] +=
        (load.mz || 0) + nx * (load.fy || 0) - ny * (load.fx || 0);
    }
  }

  // Sum reaction forces at fixed DOFs
  for (let i = 0; i < nodes.length; i++) {
    const n = nodes[i];
    if (!n) continue;
    const baseDof = i * dofPerNode;
    // Check if this node has any restrained DOFs
    let hasRestraint = false;
    for (let d = 0; d < dofPerNode; d++) {
      if (fixedDofs.has(baseDof + d)) {
        hasRestraint = true;
        break;
      }
    }
    if (!hasRestraint) continue;

    if (dofPerNode <= 3) {
      const rx = reactions[baseDof] ?? 0;
      const ry = reactions[baseDof + 1] ?? 0;
      const rmz = reactions[baseDof + 2] ?? 0;
      sumReactions[0] += rx;
      sumReactions[1] += ry;
      sumReactions[2] += rmz + n.x * ry - n.y * rx;
    } else {
      const rx = reactions[baseDof] ?? 0;
      const ry = reactions[baseDof + 1] ?? 0;
      const rz = reactions[baseDof + 2] ?? 0;
      sumReactions[0] += rx;
      sumReactions[1] += ry;
      sumReactions[2] += rz;
      const nx = n.x,
        ny = n.y,
        nz = n.z || 0;
      sumReactions[3] += (reactions[baseDof + 3] ?? 0) + ny * rz - nz * ry;
      sumReactions[4] += (reactions[baseDof + 4] ?? 0) + nz * rx - nx * rz;
      sumReactions[5] += (reactions[baseDof + 5] ?? 0) + nx * ry - ny * rx;
    }
  }

  const residual = sumApplied.map((ap, i) => ap + (sumReactions[i] ?? 0));
  let maxMag = 0;
  let maxRes = 0;
  for (let i = 0; i < nComp; i++) {
    maxMag = Math.max(
      maxMag,
      Math.abs(sumApplied[i]),
      Math.abs(sumReactions[i] ?? 0),
    );
    maxRes = Math.max(maxRes, Math.abs(residual[i] ?? 0));
  }
  const errorPct = maxMag > 1e-10 ? (maxRes / maxMag) * 100 : 0;

  return {
    applied_forces: sumApplied,
    reaction_forces: sumReactions,
    residual,
    error_percent: errorPct,
    pass: errorPct < 0.1,
  };
}

/**
 * Apply static condensation for member releases (hinges).
 * For each released DOF r in the element local stiffness matrix:
 *   k_condensed[i][j] = k[i][j] - k[i][r]*k[r][j] / k[r][r]
 * Then zero out the released row and column.
 * This is the structurally correct approach for moment/force releases.
 */
function applyMemberReleases(
  ke: number[][],
  releasedLocalDofs: number[],
): number[][] {
  const n = ke.length;
  const k = ke.map((row) => [...row]); // Deep copy
  for (const r of releasedLocalDofs) {
    if (r < 0 || r >= n) continue;
    const rowR = k[r];
    if (!rowR) continue;
    const pivot = rowR[r] ?? 0;
    if (Math.abs(pivot) < 1e-20) continue; // Already zero, skip
    // Static condensation
    for (let i = 0; i < n; i++) {
      if (i === r) continue;
      const rowI = k[i];
      if (!rowI) continue;
      for (let j = 0; j < n; j++) {
        if (j === r) continue;
        rowI[j] = (rowI[j] ?? 0) - ((rowI[r] ?? 0) * (rowR[j] ?? 0)) / pivot;
      }
    }
    // Zero out released row and column
    for (let i = 0; i < n; i++) {
      rowR[i] = 0;
      const rowI = k[i];
      if (rowI) rowI[r] = 0;
    }
  }
  return k;
}

/**
 * Convert member releases object to array of local DOF indices.
 */
function getReleasedDofs(
  releases: MemberData["releases"],
  dofPerNode: number,
): number[] {
  if (!releases) return [];
  const released: number[] = [];
  if (dofPerNode === 3) {
    // 2D Frame: [u1, v1, θz1, u2, v2, θz2]
    if (releases.fxStart) released.push(0);
    if (releases.fyStart) released.push(1);
    if (releases.mzStart) released.push(2);
    if (releases.fxEnd) released.push(3);
    if (releases.fyEnd) released.push(4);
    if (releases.mzEnd) released.push(5);
  } else if (dofPerNode === 6) {
    // 3D Frame: [u1,v1,w1,θx1,θy1,θz1, u2,v2,w2,θx2,θy2,θz2]
    if (releases.fxStart) released.push(0);
    if (releases.fyStart) released.push(1);
    if (releases.fzStart) released.push(2);
    if (releases.mxStart) released.push(3);
    if (releases.myStart) released.push(4);
    if (releases.mzStart) released.push(5);
    if (releases.fxEnd) released.push(6);
    if (releases.fyEnd) released.push(7);
    if (releases.fzEnd) released.push(8);
    if (releases.mxEnd) released.push(9);
    if (releases.myEnd) released.push(10);
    if (releases.mzEnd) released.push(11);
  }
  return released;
}

function applyPenaltyBC(
  cooRows: Uint32Array,
  cooCols: Uint32Array,
  cooVals: Float64Array,
  nnz: number,
  F: Float64Array,
  fixedDofs: Set<number>,
  penalty: number = 1e20,
): { rows: Uint32Array; cols: Uint32Array; vals: Float64Array } {
  const bcCount = fixedDofs.size;
  const totalNnz = nnz + bcCount;
  const rows = new Uint32Array(totalNnz);
  const cols = new Uint32Array(totalNnz);
  const vals = new Float64Array(totalNnz);
  rows.set(cooRows.subarray(0, nnz));
  cols.set(cooCols.subarray(0, nnz));
  vals.set(cooVals.subarray(0, nnz));
  let idx = nnz;
  for (const dof of fixedDofs) {
    rows[idx] = dof;
    cols[idx] = dof;
    vals[idx] = penalty;
    F[dof] = 0;
    idx++;
  }
  return { rows, cols, vals };
}

async function analyze(model: ModelData): Promise<ResultData> {
  const startTime = performance.now();

  // Ensure WASM is ready
  try {
    await waitForWasm();
  } catch (e) {
    return {
      type: "result",
      success: false,
      error:
        "WASM Solver Init Failed: " +
        (e instanceof Error ? e.message : String(e)),
      stats: { assemblyTimeMs: 0, solveTimeMs: 0, totalTimeMs: 0 },
    };
  }

  const config = model.options || {};
  // Bridge selfWeight from AnalysisService's settings path
  if (model.settings?.selfWeight && !config.selfWeight) {
    config.selfWeight = true;
  }
  const analysisType = config.analysisType || "linear";

  // Model size validation - Use tiered limits based on solver capability
  const totalDOF = model.nodes.length * model.dofPerNode;

  // Tiered DOF limits:
  // - LEGACY_MAX: Old direct solver limit (kept for compatibility)
  // - ULTRA_MAX: Ultra solver with AMG preconditioner (handles 100k+ nodes)
  // - ABSOLUTE_MAX: Hard memory limit to prevent browser crashes
  const LEGACY_MAX_DOF = 18000; // ~3000 nodes at 6 DOF/node (direct solver)
  const ULTRA_MAX_DOF = 600000; // ~100,000 nodes at 6 DOF/node (ultra solver)
  const ABSOLUTE_MAX_DOF = 1200000; // ~200,000 nodes - hard memory limit
  const WARN_DOF = 30000; // ~5000 nodes - show progress warning

  // Check absolute memory limit
  if (totalDOF > ABSOLUTE_MAX_DOF) {
    return {
      type: "result",
      success: false,
      error: `Model exceeds browser memory limits: ${model.nodes.length.toLocaleString()} nodes (${totalDOF.toLocaleString()} DOF). Maximum supported: ~200,000 nodes. Please use cloud computing for larger models.`,
      stats: { assemblyTimeMs: 0, solveTimeMs: 0, totalTimeMs: 0 },
    };
  }

  // Check if ultra solver is needed
  const useUltraSolver = totalDOF > LEGACY_MAX_DOF;

  if (useUltraSolver && totalDOF > ULTRA_MAX_DOF) {
    return {
      type: "result",
      success: false,
      error: `Model too large for browser: ${model.nodes.length.toLocaleString()} nodes (${totalDOF.toLocaleString()} DOF). Maximum for browser analysis: ~100,000 nodes. Use cloud solver for larger models.`,
      stats: { assemblyTimeMs: 0, solveTimeMs: 0, totalTimeMs: 0 },
    };
  }

  // Memory check - estimate required memory and warn if low
  const estimatedMemoryMB = Math.ceil(
    ((totalDOF * totalDOF * 8) / (1024 * 1024)) * 0.01,
  ); // Sparse ~1% density
  if (estimatedMemoryMB > 500) {
    sendProgress(
      "assembling",
      0,
      `⚠️ Large model: ${model.nodes.length.toLocaleString()} nodes. Estimated memory: ${estimatedMemoryMB}MB. Analysis may take longer...`,
    );
  } else if (totalDOF > WARN_DOF) {
    sendProgress(
      "assembling",
      0,
      `Large model detected (${model.nodes.length.toLocaleString()} nodes). ${useUltraSolver ? "Using Ultra Solver..." : "Analysis may take longer..."}`,
    );
  }

  // Dynamic settings
  const dt = config.timeStep || 0.01;
  const duration = config.duration || 1.0;
  const timeSteps = Math.ceil(duration / dt);

  try {
    if (analysisType === "dynamic_time_history") {
      // DYNAMIC ANALYSIS (Newmark-Beta)
      // ===============================
      sendProgress("assembling", 0, "Assembling Mass and Stiffness...");

      // 1. Assemble matrices
      const nodeIndexMap = new Map<string, number>();
      model.nodes.forEach((n, i) => nodeIndexMap.set(n.id, i));

      // K (Elastic)
      const kResult = assembleStiffnessMatrixAndForces(
        model.nodes,
        model.members,
        model.dofPerNode,
        model.loads,
        undefined,
        undefined,
        config.selfWeight,
        model.memberLoads,
        model.temperatureLoads,
      );
      const F_static = kResult.F;
      const fixedDofs = kResult.fixedDofs;

      // M (Lumped Default)
      const { entries: entriesM, M_diag } = assembleMassMatrix(
        model.nodes,
        model.members,
        model.dofPerNode,
      );

      const dof = model.nodes.length * model.dofPerNode;
      const u = new Float64Array(dof);
      const v = new Float64Array(dof);
      const a = new Float64Array(dof);

      // Newmark Parameters (Average Acceleration)
      const gamma = 0.5;
      const beta = 0.25;

      // M8: Rayleigh damping — C = α_M * M + β_K * K
      // Default: 5% damping at 1st & 3rd mode approximation
      // α_M & β_K from config or estimated from typical structural damping
      const dampingRatio = config.dampingRatio ?? 0.05; // 5% of critical (typical steel/concrete)
      // Approximate: for ω1~2π & ω2~6π → α_M ≈ 2ζω1ω2/(ω1+ω2), β_K ≈ 2ζ/(ω1+ω2)
      // Simplified Rayleigh coefficients for typical building (f1≈1Hz, f3≈5Hz)
      const omega1 = 2 * Math.PI * (config.firstModeFreq ?? 1.0); // rad/s
      const omega2 = 2 * Math.PI * (config.thirdModeFreq ?? 5.0);
      const alpha_M = (2 * dampingRatio * omega1 * omega2) / (omega1 + omega2);
      const beta_K = (2 * dampingRatio) / (omega1 + omega2);

      // Effective Stiffness K_hat = K + (1/(beta*dt^2))*M + (gamma/(beta*dt))*C
      // C = α_M * M + β_K * K  →  K_hat = (1 + β_K*γ/(β*dt))*K + (1/(β*dt²) + α_M*γ/(β*dt))*M
      const a0 = 1 / (beta * dt * dt);
      const a1_coeff = gamma / (beta * dt);

      // K_hat coefficients
      const kScale = 1.0 + beta_K * a1_coeff; // multiplier for K entries
      const mScale = a0 + alpha_M * a1_coeff; // multiplier for M entries

      // Combine K and M into K_hat entries (object array for legacy solveSystemWasm)
      // K_hat = kScale * K + mScale * M
      const entriesK_hat: SparseEntry[] = [];
      for (let i = 0; i < kResult.nnz; i++) {
        entriesK_hat.push({
          row: kResult.cooRows[i] ?? 0,
          col: kResult.cooCols[i] ?? 0,
          value: (kResult.cooVals[i] ?? 0) * kScale,
        });
      }
      for (const em of entriesM) {
        entriesK_hat.push({
          row: em.row,
          col: em.col,
          value: em.value * mScale,
        });
      }

      // Apply BCs to K_hat (Penalty)
      const penalty = 1e20;
      fixedDofs.forEach((idx) => {
        entriesK_hat.push({ row: idx, col: idx, value: penalty });
      });

      // Factorize K_hat ONCE (if Linear)
      // But we simulate by solving linear system each step.
      // WASM "solve_sparse_system" does factorization + solve.
      // Ideally we should reuse factorization. `solver-wasm` might not expose it yet.
      // We will call solve each step (slower but works).

      const history: Float64Array[] = [];

      sendProgress("solving", 0, `Integrating ${timeSteps} steps...`);

      // Time Loop
      for (let t = 0; t < timeSteps; t++) {
        // Effective Load
        // F_hat = F(t) + M * (a0*u + a2*v + a3*a) + C * ...
        // Predictors
        // For Newmark:
        // F_hat = F_ext + M * ( (1/beta/dt^2)*u + (1/beta/dt)*v + (1/2beta - 1)*a )
        // Note: Standard Newmark Formulation

        // M * predictors
        const p_u = 1 / (beta * dt * dt);
        const p_v = 1 / (beta * dt);
        const p_a = 1 / (2 * beta) - 1;

        const F_eff = new Float64Array(dof);

        // Add static load (step loading assumption)
        for (let i = 0; i < dof; i++) F_eff[i] = F_static[i] ?? 0;

        // Add Inertial terms M * (p_u*u + p_v*v + p_a*a)
        // + Damping terms C * (c_u*u + c_v*v + c_a*a)
        // C = α_M * M + β_K * K → for lumped M: C_diag_mass = α_M * M_diag
        // K contribution handled via β_K already baked into K_hat
        const c_u = a1_coeff; // γ/(β·dt)
        const c_v = gamma / beta - 1;
        const c_a = dt * (gamma / (2 * beta) - 1);

        // Since M is diagonal (Lumped), easy loop
        if (M_diag) {
          for (let i = 0; i < dof; i++) {
            const m_val = M_diag[i] ?? 0;
            const inertia_pred =
              p_u * (u[i] ?? 0) + p_v * (v[i] ?? 0) + p_a * (a[i] ?? 0);
            // Rayleigh mass-proportional damping predictor
            const damp_pred =
              alpha_M *
              (c_u * (u[i] ?? 0) + c_v * (v[i] ?? 0) + c_a * (a[i] ?? 0));
            F_eff[i] = (F_eff[i] ?? 0) + m_val * (inertia_pred + damp_pred);
          }
        }

        // Apply BC to Force (Zero out fixed)
        fixedDofs.forEach((idx) => (F_eff[idx] = 0)); // Or prescribed * penalty

        // SOLVE
        // K_hat * u_next = F_eff
        // Using WASM
        // Using WASM
        if (wasmReady && wasmModule) {
          const u_next = solveSystemWasm(entriesK_hat, F_eff, dof);

          // Update Kinematics

          // Update Kinematics
          // a_next = a0 * (u_next - u) - a0*dt*v - (1/2beta - 1)*a ???
          // Standard:
          // a_next = (u_next - u)/(beta*dt^2) - v/(beta*dt) - (1/2beta-1)*a
          // v_next = v + dt*( (1-gamma)*a + gamma*a_next )

          const a_next = new Float64Array(dof);
          const v_next = new Float64Array(dof);

          for (let i = 0; i < dof; i++) {
            const du = (u_next[i] ?? 0) - (u[i] ?? 0);
            a_next[i] = a0 * du - a0 * dt * (v[i] ?? 0) - p_a * (a[i] ?? 0); // check signs
            v_next[i] =
              (v[i] ?? 0) +
              dt * ((1 - gamma) * (a[i] ?? 0) + gamma * (a_next[i] ?? 0));
          }

          // Store
          u.set(u_next);
          v.set(v_next);
          a.set(a_next);

          // Save history (sparse or full? Full for small duration)
          if (t % 5 === 0) history.push(u.slice()); // Save every 5th step
        } else {
          throw new Error("WASM required for Dynamic Analysis");
        }

        if (t % 10 === 0)
          sendProgress(
            "solving",
            (t / timeSteps) * 100,
            `Time: ${(t * dt).toFixed(3)}s`,
          );
      }

      return {
        type: "result",
        success: true,
        displacements: u, // Final state
        memberForces: [], // Skip force calc for history for now
        stats: {
          assemblyTimeMs: 0,
          solveTimeMs: 0,
          totalTimeMs: performance.now() - startTime,
        },
      };
    } else if (analysisType === "p-delta") {
      // P-Delta nonlinear iteration
      const maxIter = config.maxIterations || 10;
      const tolerance = config.tolerance || 1e-4;

      let displacements: Float64Array = new Float64Array(0);
      let memberForces: MemberForceResult[] = [];
      const stats: Record<string, number> = {};
      const memberAxialForces: Record<string, number> = {};
      let prevDisplacements: Float64Array | null = null;

      // Build node index map once (used for diagram generation after convergence)
      const nodeIndexMap = new Map<string, number>();
      model.nodes.forEach((n, i) => nodeIndexMap.set(n.id, i));

      for (let iter = 0; iter < maxIter; iter++) {
        sendProgress(
          "solving",
          (iter / maxIter) * 100,
          `Iteration ${iter + 1}/${maxIter}...`,
        );
        void performance.now();

        const dofPerNode = model.dofPerNode;

        const pdResult = assembleStiffnessMatrixAndForces(
          model.nodes,
          model.members,
          dofPerNode,
          model.loads,
          memberAxialForces,
          undefined,
          config.selfWeight,
          model.memberLoads,
          model.temperatureLoads,
        );
        const F = pdResult.F;
        const fixedDofs = pdResult.fixedDofs;

        const dof = model.nodes.length * dofPerNode;
        const {
          rows: bcRows,
          cols: bcCols,
          vals: bcVals,
        } = applyPenaltyBC(
          pdResult.cooRows,
          pdResult.cooCols,
          pdResult.cooVals,
          pdResult.nnz,
          F,
          fixedDofs,
        );

        if (wasmReady && wasmModule) {
          displacements = solveSystemWasmTyped(bcRows, bcCols, bcVals, F, dof);
          stats.solveTimeMs = (stats.solveTimeMs || 0) + 0;
        } else {
          throw new Error("WASM required");
        }

        memberForces = computeMemberEndForces(
          model,
          displacements,
          nodeIndexMap,
        );
        let maxForceChange = 0;
        memberForces.forEach((mf) => {
          const prevP = memberAxialForces[mf.id] || 0;
          const newP = mf.start.axial;
          memberAxialForces[mf.id] = newP;
          maxForceChange = Math.max(maxForceChange, Math.abs(newP - prevP));
        });

        if (prevDisplacements) {
          let diff = 0,
            norm = 0;
          for (let i = 0; i < displacements.length; i++) {
            const d = displacements[i] ?? 0;
            diff += (d - (prevDisplacements[i] ?? 0)) ** 2;
            norm += d ** 2;
          }
          if (Math.sqrt(diff) / (Math.sqrt(norm) + 1e-10) < tolerance) {
            break;
          }
        }
        prevDisplacements = displacements.slice();
      }

      // Compute reactions for P-Delta result
      const pdFinal = assembleStiffnessMatrixAndForces(
        model.nodes,
        model.members,
        model.dofPerNode,
        model.loads,
        memberAxialForces,
        undefined,
        config.selfWeight,
        model.memberLoads,
        model.temperatureLoads,
      );
      // Use the full force vector from assembly (includes self-weight + member loads + temperature)
      const pdF_orig = pdFinal.F.slice(); // before penalty BC modifies it
      const pdReactions = computeReactions(
        pdFinal.cooRows,
        pdFinal.cooCols,
        pdFinal.cooVals,
        pdFinal.nnz,
        displacements,
        pdF_orig,
        pdFinal.fixedDofs,
        model.nodes.length * model.dofPerNode,
      );

      return {
        type: "result",
        success: true,
        displacements,
        reactions: pdReactions,
        memberForces: generateDiagramData(memberForces, model, nodeIndexMap),
        stats: {
          assemblyTimeMs: stats.assemblyTimeMs || 0,
          solveTimeMs: stats.solveTimeMs || 0,
          ...stats,
          totalTimeMs: performance.now() - startTime,
        },
      };
    } else if (analysisType === "topology_optimization") {
      // TOPOLOGY OPTIMIZATION (SIMP)
      // ============================
      const optMaxIter = config.maxIterations || 50;
      const targetFraction = config.targetVolume || 0.5;

      // Initial Densities
      const densities: Record<string, number> = {};
      model.members.forEach((m) => (densities[m.id] = targetFraction)); // Start uniform? Or 1.0?
      // Better start: Uniform = Target.

      // Loop
      let finalDisplacements = new Float64Array(0);

      for (let iter = 0; iter < optMaxIter; iter++) {
        sendProgress(
          "solving",
          (iter / optMaxIter) * 100,
          `Optimization Iteration ${iter + 1}/${optMaxIter}`,
        );

        // 1. Analyze (Linear with Scaled Stiffness)
        const topoResult = assembleStiffnessMatrixAndForces(
          model.nodes,
          model.members,
          model.dofPerNode,
          model.loads,
          undefined,
          densities,
        );
        const F = topoResult.F;
        const fixedDofs = topoResult.fixedDofs;
        const dof = model.nodes.length * model.dofPerNode;
        const {
          rows: bcRows,
          cols: bcCols,
          vals: bcVals,
        } = applyPenaltyBC(
          topoResult.cooRows,
          topoResult.cooCols,
          topoResult.cooVals,
          topoResult.nnz,
          F,
          fixedDofs,
        );

        // Solve
        let u: Float64Array;
        if (wasmReady && wasmModule) {
          u = solveSystemWasmTyped(bcRows, bcCols, bcVals, F, dof);
        } else throw new Error("WASM required for Optimization");

        finalDisplacements = Float64Array.from(u);

        // 2. Sensitivity Analysis (Compliance)
        // c = U^T K U = Sum( u_e^T k_e u_e )
        // Strain Energy per element.
        const sensitivities: number[] = [];
        const volumes: number[] = [];
        const densityArray: number[] = [];
        const memberIds: string[] = [];

        // Calculate Strain Energy for each element
        const nodeIndexMap = new Map();
        model.nodes.forEach((n, i) => nodeIndexMap.set(n.id, i));

        // Re-assemble (messy to re-call assemble? We need element matrices).
        // Or compute element energy here.
        // We'll calculate Element Strain Energy explicitly.

        void 0;

        model.members.forEach((member) => {
          const i = nodeIndexMap.get(member.startNodeId);
          const j = nodeIndexMap.get(member.endNodeId);
          if (i === undefined || j === undefined) return;

          const rho = densities[member.id] || 0.001;
          densityArray.push(rho);
          // Geometry
          const n1 = model.nodes[i],
            n2 = model.nodes[j];
          if (!n1 || !n2) return;
          const { L, cx, cy, cz } = computeMemberGeometry3D(
            n1.x,
            n1.y,
            n1.z,
            n2.x,
            n2.y,
            n2.z,
          );
          volumes.push(member.A * L); // L needed. Recompute geom?
          memberIds.push(member.id);

          // Stiffness Matrix (Unscaled E0)
          // ... Need compute KE0 ...
          // This duplicates selection logic. Ideally refactor `computeElementK(member, rho=1)`.
          // For brevity, assume Truss 2D/3D logic dominance or use simplified energy calc?
          // U_e^T * K * U_e
          // Truss: 1/2 * k * (delta_L)^2 ?
          // K_truss = E A / L.
          // Strain Energy = 1/2 * (EA/L) * (dL)^2.
          // This is exact for Truss.
          // For Frame, we need full u_e^T K u_e.

          // To avoid duplicating logic, we rely on Trust Assumption for Demo?
          // Or implement full K calculation call?
          // Let's call the *unscaled* stiffness functions directly.

          // Re-use logic:
          // Using `assembleStiffnessMatrix` with density=1 for this member? No too slow.
          // Just call compute func.

          const type = member.type || "frame";
          const E0 = member.E;

          // Check dof
          // Simplifying: Only support Truss/Frame logic used in assemble
          // Assuming dofPerNode=6 for general case or 2 for 2D.
          // ... (Code duplication risk).
          // Let's create `getElementStiffness(member, nodes, 1.0)`.

          // For now, implement Truss Strain Energy (Axial) as dominant for trusses.
          // If Frame, ignore bending energy for optimization? BAD.
          // Let's compute full K.

          // Quick Compute K0 (Density=1)
          let ke: number[][] = [];
          if (type === "spring") {
            const k = member.springStiffness || member.E || 1.0;
            const kSpring = computeSpringStiffness(k, cx, cy, cz);
            if (model.dofPerNode === 6)
              ke = mapMatrix(kSpring, [0, 1, 2, 6, 7, 8], 12);
            else if (model.dofPerNode === 3)
              ke = mapMatrix(kSpring, [0, 1, 3, 4], 6);
            else if (model.dofPerNode === 2)
              ke = mapMatrix(kSpring, [0, 1, 3, 4], 4);
            else ke = [];
          } else if (model.dofPerNode === 2) {
            ke = computeTruss2DStiffness(
              E0,
              member.A,
              L,
              Math.atan2(n2.y - n1.y, n2.x - n1.x),
            );
          } else if (model.dofPerNode === 3) {
            if (type === "truss") {
              const kTruss = computeTruss2DStiffness(
                E0,
                member.A,
                L,
                Math.atan2(n2.y - n1.y, n2.x - n1.x),
              );
              ke = mapMatrix(kTruss, [0, 1, 3, 4], 6);
            } else {
              ke = computeFrameStiffness(E0, member.A, member.I, L, cx, cy, cz);
            }
          } else if (model.dofPerNode === 6) {
            if (type === "truss") {
              const kTruss = computeTruss3DStiffness(
                E0,
                member.A,
                L,
                cx,
                cy,
                cz,
              );
              ke = mapMatrix(kTruss, [0, 1, 2, 6, 7, 8], 12);
            } else {
              // Placeholder for Frame 3D, using Truss 3D for now
              const kTruss = computeTruss3DStiffness(
                E0,
                member.A,
                L,
                cx,
                cy,
                cz,
              );
              ke = mapMatrix(kTruss, [0, 1, 2, 6, 7, 8], 12);
            }
          } else {
            const kVal = (E0 * member.A) / L;
            ke = computeTrussStiffness(kVal, cx, cy, cz, model.dofPerNode);
          }

          // Extract u_e
          const u_e = [];
          const dofP = model.dofPerNode;
          for (let k = 0; k < dofP; k++) u_e.push(u[i * dofP + k] ?? 0);
          for (let k = 0; k < dofP; k++) u_e.push(u[j * dofP + k] ?? 0);

          // Strain Energy = u_e^T * ke * u_e
          // Note: This strain energy corresponds to rho=1 stiffness.
          // Actual energy in structure is rho^p * Energy0.
          // Sensitivity uses Energy0 (unpenalized stiffness energy).
          // dc/drho = -p * rho^(p-1) * (u^T K0 u)

          let energy0 = 0;
          for (let r = 0; r < ke.length; r++) {
            for (let c = 0; c < ke.length; c++) {
              const row = ke[r];
              energy0 += (u_e[r] ?? 0) * (row?.[c] ?? 0) * (u_e[c] ?? 0);
            }
          }

          // Check polarity? Energy must be positive.
          // compliance += rho^p * energy0 ?
          // Compliance = F^T u.

          const sens = computeSensitivity(rho, SIMP_PENALTY, energy0);
          sensitivities.push(sens);
        });

        // 3. Update Densities (OC)
        const totalTargetVol =
          volumes.reduce((a, b) => a + b, 0) * targetFraction;
        const newDensitiesArray = updateDensitiesOC(
          densityArray,
          sensitivities,
          volumes,
          totalTargetVol,
        );

        // Apply
        let maxDiff = 0;
        newDensitiesArray.forEach((val, idx) => {
          const mid = memberIds[idx];
          if (!mid) return;
          const diff = Math.abs(val - (densities[mid] ?? 0));
          if (diff > maxDiff) maxDiff = diff;
          densities[mid] = val;
        });

        if (maxDiff < 0.01) {
          console.log(`Optimization Converged at Iter ${iter}`);
          break;
        }
      }

      // Return results with densities
      return {
        type: "result",
        success: true,
        displacements: finalDisplacements,
        reactions: new Float64Array(0),
        memberForces: [], // Calculate final forces if needed
        densities: densities, // Return Map
        stats: {
          assemblyTimeMs: 0,
          solveTimeMs: 0,
          totalTimeMs: performance.now() - startTime,
        },
      };
    } else {
      // LINEAR ANALYSIS (Default)
      // ... Standard assemble ...
      const nodeIndexMap = new Map();
      model.nodes.forEach((n, i) => nodeIndexMap.set(n.id, i));
      const assemblyStart = performance.now();
      const linResult = assembleStiffnessMatrixAndForces(
        model.nodes,
        model.members,
        model.dofPerNode,
        model.loads,
        undefined,
        undefined,
        config.selfWeight,
        model.memberLoads,
        model.temperatureLoads,
      );
      const F = linResult.F;
      const F_orig = F.slice(); // Save before penalty BC zeros out fixed DOFs
      const dof = model.nodes.length * model.dofPerNode;
      const {
        rows: bcRows,
        cols: bcCols,
        vals: bcVals,
      } = applyPenaltyBC(
        linResult.cooRows,
        linResult.cooCols,
        linResult.cooVals,
        linResult.nnz,
        F,
        linResult.fixedDofs,
      );
      const assemblyTimeMs = performance.now() - assemblyStart;

      const solveStart = performance.now();
      let displacements;
      if (wasmReady && wasmModule) {
        displacements = solveSystemWasmTyped(bcRows, bcCols, bcVals, F, dof);
      } else {
        throw new Error("WASM not ready");
      }
      const solveTimeMs = performance.now() - solveStart;

      // Compute support reactions: R = K*u - F at restrained DOFs
      const reactions = computeReactions(
        linResult.cooRows,
        linResult.cooCols,
        linResult.cooVals,
        linResult.nnz,
        displacements,
        F_orig,
        linResult.fixedDofs,
        dof,
      );

      const memberForces = computeMemberEndForces(
        model,
        displacements,
        nodeIndexMap,
      );
      const enrichedForces = generateDiagramData(
        memberForces,
        model,
        nodeIndexMap,
      );

      // C4: Equilibrium check — verify ΣReactions ≈ ΣApplied
      const equilibriumCheck = computeEquilibriumCheck(
        model.nodes,
        model.loads,
        reactions,
        linResult.fixedDofs,
        model.dofPerNode,
      );

      return {
        type: "result",
        success: true,
        displacements,
        reactions,
        memberForces: enrichedForces,
        equilibrium_check: equilibriumCheck,
        stats: {
          assemblyTimeMs,
          solveTimeMs,
          totalTimeMs: performance.now() - startTime,
          nnz: linResult.nnz,
          sparsity: 1 - linResult.nnz / (dof * dof),
        },
      };
    }
  } catch (error) {
    console.error("Worker Analysis Failed:", error);
    return {
      type: "result",
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
      stats: { assemblyTimeMs: 0, solveTimeMs: 0, totalTimeMs: 0 },
    };
  }
}

// ============================================
// MESSAGE HANDLER
// ============================================

self.onmessage = async (event: MessageEvent<WorkerRequest>) => {
  const request = event.data;

  if (request.type === "analyze_cloud") {
    // --- CLOUD ANALYSIS (Offload main thread) ---
    try {
      sendProgress("uploading", 0, "Preparing data for cloud solver...");

      const { model, url, token } = request;

      // Serialize in worker to avoid main thread blocking
      const body = JSON.stringify({
        nodes: model.nodes.map((n) => ({
          id: n.id,
          x: n.x,
          y: n.y,
          z: n.z,
          // Map restraints to backend format
          support:
            n.restraints?.fx && n.restraints?.fy && n.restraints?.fz
              ? n.restraints?.mx && n.restraints?.my && n.restraints?.mz
                ? "fixed"
                : "pinned"
              : n.restraints?.fy
                ? "roller"
                : "none",
        })),
        members: model.members.map((m) => ({
          id: m.id,
          startNodeId: m.startNodeId,
          endNodeId: m.endNodeId,
          E: m.E,
          A: m.A,
          Iy: m.I,
          Iz: m.I,
          J: m.I * 0.1, // Approximate J if not provided
          G: m.E / (2 * (1 + 0.3)), // Poisson 0.3
        })),
        node_loads: model.loads.map((l) => ({
          nodeId: l.nodeId,
          fx: l.fx || 0,
          fy: l.fy || 0,
          fz: l.fz || 0,
          mx: l.mx || 0,
          my: l.my || 0,
          mz: l.mz || 0,
        })),
        method: "auto",
      });

      sendProgress("uploading", 20, "Sending to High-Performance Solver...");

      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };
      if (token) headers["Authorization"] = `Bearer ${token}`;

      const response = await fetch(`${url}/analyze/large-frame`, {
        method: "POST",
        headers,
        body,
      });

      if (!response.ok) {
        let errText: string;
        let errCode: string | undefined;
        let errDetails: any[] | undefined;
        try {
          const errJson = await response.json();
          errText = errJson.error || `Cloud solver error (${response.status})`;
          errCode = errJson.errorCode;
          errDetails = errJson.errorDetails;
        } catch {
          errText = await response.text().catch(() => `HTTP ${response.status}`);
        }
        self.postMessage({
          type: "result",
          requestId: request.requestId,
          success: false,
          error: errText,
          errorCode: errCode,
          errorDetails: errDetails,
        });
        return;
      }

      const result = await response.json();

      if (!result.success) {
        self.postMessage({
          type: "result",
          requestId: request.requestId,
          success: false,
          error: result.error || "Unknown solver error",
          errorCode: result.errorCode,
          errorDetails: result.errorDetails,
        });
        return;
      }

      self.postMessage({
        type: "result",
        requestId: request.requestId,
        success: true,
        data: result, // Pass raw backend result
        stats: result.stats,
      });
    } catch (error) {
      self.postMessage({
        type: "result",
        requestId: request.requestId,
        success: false,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  } else if (request.type === "analyze") {
    const result = await analyze(request.model);

    // Use Transferable Objects for zero-copy transfer
    const transferables: Transferable[] = [];

    if (result.displacements) {
      transferables.push(result.displacements.buffer);
    }
    if (result.reactions) {
      transferables.push(result.reactions.buffer);
    }
    // memberForces is an object array (small), no transferable

    // Post with transferables (zero-copy)
    self.postMessage(result, { transfer: transferables });
  }
};

// Export for TypeScript
export {};
