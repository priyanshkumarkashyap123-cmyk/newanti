/**
 * AnalysisDebugger.ts - Comprehensive Debugging Utilities for Structural Analysis
 * 
 * Features:
 * - Matrix visualization and inspection
 * - Step-by-step analysis tracing
 * - Numerical stability checking
 * - Result validation
 * - Performance profiling
 * - Error diagnosis
 * 
 * Essential for debugging complex structural models
 */

import type { Node3D, Element3D, NodalLoad, AnalysisResult, MemberForces } from './HybridAnalysisEngine';

// ============================================
// DEBUG TYPES
// ============================================

export interface DebugConfig {
  enabled: boolean;
  verbosity: 'minimal' | 'normal' | 'verbose' | 'trace';
  logToConsole: boolean;
  saveToFile: boolean;
  breakOnError: boolean;
  maxMatrixDisplay: number;
  numericalPrecision: number;
}

export interface AnalysisTrace {
  timestamp: number;
  phase: AnalysisPhase;
  message: string;
  data?: unknown;
  duration?: number;
}

export type AnalysisPhase = 
  | 'initialization'
  | 'node-processing'
  | 'element-stiffness'
  | 'assembly'
  | 'boundary-conditions'
  | 'load-application'
  | 'solve'
  | 'post-processing'
  | 'validation';

export interface MatrixInfo {
  name: string;
  rows: number;
  cols: number;
  nonZeros: number;
  sparsity: number;
  symmetry: boolean;
  positiveDef: boolean;
  conditionNumber: number;
  bandwidth: number;
  maxElement: number;
  minElement: number;
  determinant?: number;
}

export interface NumericalDiagnosis {
  matrixCondition: 'well-conditioned' | 'mildly-ill-conditioned' | 'severely-ill-conditioned' | 'singular';
  conditionNumber: number;
  recommendedAction: string;
  pivotWarnings: string[];
  roundoffEstimate: number;
  stabilityRisk: 'low' | 'medium' | 'high' | 'critical';
}

export interface ResultDiagnosis {
  equilibriumError: number;
  energyBalance: number;
  displacementBounds: { min: number; max: number; reasonable: boolean };
  rotationBounds: { min: number; max: number; reasonable: boolean };
  reactionSum: { fx: number; fy: number; fz: number; mx: number; my: number; mz: number };
  appliedLoadSum: { fx: number; fy: number; fz: number; mx: number; my: number; mz: number };
  maxStress?: number;
  maxStrain?: number;
}

// ============================================
// ANALYSIS DEBUGGER CLASS
// ============================================

export class AnalysisDebugger {
  private config: DebugConfig;
  private traces: AnalysisTrace[] = [];
  private phaseStartTimes: Map<AnalysisPhase, number> = new Map();
  private matricesSaved: Map<string, number[][]> = new Map();
  
  constructor(config: Partial<DebugConfig> = {}) {
    this.config = {
      enabled: true,
      verbosity: 'normal',
      logToConsole: true,
      saveToFile: false,
      breakOnError: false,
      maxMatrixDisplay: 10,
      numericalPrecision: 1e-10,
      ...config,
    };
  }
  
  // ==========================================
  // TRACING
  // ==========================================
  
  /**
   * Start a new debug session
   */
  startSession(modelInfo: { nodes: number; elements: number; dofs: number }): void {
    this.traces = [];
    this.phaseStartTimes.clear();
    this.matricesSaved.clear();
    
    this.log('initialization', `Starting analysis debug session`);
    this.log('initialization', `Model: ${modelInfo.nodes} nodes, ${modelInfo.elements} elements, ${modelInfo.dofs} DOFs`);
  }
  
  /**
   * Begin tracking a phase
   */
  beginPhase(phase: AnalysisPhase): void {
    this.phaseStartTimes.set(phase, performance.now());
    this.log(phase, `Phase started: ${phase}`);
  }
  
  /**
   * End tracking a phase
   */
  endPhase(phase: AnalysisPhase, summary?: string): void {
    const startTime = this.phaseStartTimes.get(phase);
    const duration = startTime ? performance.now() - startTime : 0;
    
    this.log(phase, summary ?? `Phase completed: ${phase}`, { duration: `${duration.toFixed(2)}ms` });
  }
  
  /**
   * Log a message
   */
  log(phase: AnalysisPhase, message: string, data?: unknown): void {
    if (!this.config.enabled) return;
    
    const trace: AnalysisTrace = {
      timestamp: Date.now(),
      phase,
      message,
      data,
    };
    
    this.traces.push(trace);
    
    if (this.config.logToConsole) {
      const prefix = `[${phase.toUpperCase()}]`;
      if (data !== undefined) {
        console.log(`${prefix} ${message}`, data);
      } else {
        console.log(`${prefix} ${message}`);
      }
    }
  }
  
  /**
   * Log an error
   */
  error(phase: AnalysisPhase, message: string, error?: Error | unknown): void {
    this.log(phase, `ERROR: ${message}`, error);
    
    if (this.config.breakOnError) {
       
      console.error('[AnalysisDebugger] Break on error triggered:', message, error);
    }
  }
  
  /**
   * Log a warning
   */
  warn(phase: AnalysisPhase, message: string): void {
    this.log(phase, `WARNING: ${message}`);
  }
  
  // ==========================================
  // MATRIX ANALYSIS
  // ==========================================
  
  /**
   * Analyze and save a matrix for debugging
   */
  inspectMatrix(name: string, matrix: number[][]): MatrixInfo {
    this.matricesSaved.set(name, matrix);
    
    const rows = matrix.length;
    const cols = matrix[0]?.length ?? 0;
    
    let nonZeros = 0;
    let maxElement = -Infinity;
    let minElement = Infinity;
    let maxNonZero = -Infinity;
    let minNonZero = Infinity;
    
    // Count non-zeros and find extremes
    for (let i = 0; i < rows; i++) {
      for (let j = 0; j < cols; j++) {
        const val = matrix[i][j];
        
        if (Math.abs(val) > this.config.numericalPrecision) {
          nonZeros++;
          maxNonZero = Math.max(maxNonZero, val);
          minNonZero = Math.min(minNonZero, val);
        }
        
        maxElement = Math.max(maxElement, val);
        minElement = Math.min(minElement, val);
      }
    }
    
    const sparsity = 1 - nonZeros / (rows * cols);
    
    // Check symmetry
    const symmetry = this.checkSymmetry(matrix);
    
    // Calculate bandwidth
    const bandwidth = this.calculateBandwidth(matrix);
    
    // Check positive definiteness (simplified)
    const positiveDef = this.checkPositiveDefinite(matrix);
    
    // Estimate condition number
    const conditionNumber = this.estimateConditionNumber(matrix);
    
    const info: MatrixInfo = {
      name,
      rows,
      cols,
      nonZeros,
      sparsity,
      symmetry,
      positiveDef,
      conditionNumber,
      bandwidth,
      maxElement,
      minElement,
    };
    
    if (this.config.verbosity === 'verbose' || this.config.verbosity === 'trace') {
      this.log('assembly', `Matrix ${name} analysis:`, info);
    }
    
    return info;
  }
  
  /**
   * Check matrix symmetry
   */
  private checkSymmetry(matrix: number[][]): boolean {
    const n = matrix.length;
    
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        if (Math.abs(matrix[i][j] - matrix[j][i]) > this.config.numericalPrecision) {
          return false;
        }
      }
    }
    
    return true;
  }
  
  /**
   * Calculate matrix bandwidth
   */
  private calculateBandwidth(matrix: number[][]): number {
    const n = matrix.length;
    let maxBandwidth = 0;
    
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        if (Math.abs(matrix[i][j]) > this.config.numericalPrecision) {
          maxBandwidth = Math.max(maxBandwidth, Math.abs(i - j));
        }
      }
    }
    
    return maxBandwidth;
  }
  
  /**
   * Check positive definiteness (Sylvester's criterion - simplified)
   */
  private checkPositiveDefinite(matrix: number[][]): boolean {
    const n = matrix.length;
    
    // Check all diagonal elements are positive
    for (let i = 0; i < n; i++) {
      if (matrix[i][i] <= 0) {
        return false;
      }
    }
    
    // Check 2x2 leading principal minors
    if (n >= 2) {
      const det2 = matrix[0][0] * matrix[1][1] - matrix[0][1] * matrix[1][0];
      if (det2 <= 0) {
        return false;
      }
    }
    
    return true;
  }
  
  /**
   * Estimate condition number
   */
  private estimateConditionNumber(matrix: number[][]): number {
    const n = matrix.length;
    if (n === 0) return 1;
    
    // Simplified: ratio of max to min absolute diagonal elements
    let maxDiag = 0;
    let minDiag = Infinity;
    
    for (let i = 0; i < n; i++) {
      const absVal = Math.abs(matrix[i][i]);
      maxDiag = Math.max(maxDiag, absVal);
      if (absVal > this.config.numericalPrecision) {
        minDiag = Math.min(minDiag, absVal);
      }
    }
    
    return minDiag > 0 ? maxDiag / minDiag : Infinity;
  }
  
  /**
   * Print matrix in readable format
   */
  printMatrix(name: string, maxSize?: number): string {
    const matrix = this.matricesSaved.get(name);
    if (!matrix) {
      return `Matrix "${name}" not found`;
    }
    
    const size = maxSize ?? this.config.maxMatrixDisplay;
    const rows = Math.min(matrix.length, size);
    const cols = Math.min(matrix[0]?.length ?? 0, size);
    
    const lines: string[] = [
      `Matrix: ${name} (${matrix.length}×${matrix[0]?.length ?? 0})`,
      '-'.repeat(60),
    ];
    
    for (let i = 0; i < rows; i++) {
      const row = matrix[i].slice(0, cols).map(v => 
        v.toExponential(2).padStart(12)
      ).join(' ');
      
      lines.push(`[${row}${cols < matrix[0].length ? ' ...' : ''}]`);
    }
    
    if (rows < matrix.length) {
      lines.push('...');
    }
    
    return lines.join('\n');
  }
  
  // ==========================================
  // NUMERICAL STABILITY ANALYSIS
  // ==========================================
  
  /**
   * Diagnose numerical issues
   */
  diagnoseNumericalStability(stiffnessMatrix: number[][]): NumericalDiagnosis {
    const conditionNumber = this.estimateConditionNumber(stiffnessMatrix);
    const pivotWarnings: string[] = [];
    
    // Check diagonal dominance and potential pivots
    const n = stiffnessMatrix.length;
    
    for (let i = 0; i < n; i++) {
      const diagonal = Math.abs(stiffnessMatrix[i][i]);
      let rowSum = 0;
      
      for (let j = 0; j < n; j++) {
        if (i !== j) {
          rowSum += Math.abs(stiffnessMatrix[i][j]);
        }
      }
      
      if (diagonal < rowSum) {
        pivotWarnings.push(`Row ${i}: Not diagonally dominant (|a[${i}][${i}]| = ${diagonal.toExponential(2)} < ${rowSum.toExponential(2)})`);
      }
      
      if (diagonal < this.config.numericalPrecision) {
        pivotWarnings.push(`Row ${i}: Near-zero diagonal (${diagonal.toExponential(2)})`);
      }
    }
    
    // Determine condition
    let matrixCondition: NumericalDiagnosis['matrixCondition'];
    let stabilityRisk: NumericalDiagnosis['stabilityRisk'];
    let recommendedAction: string;
    
    if (conditionNumber < 1e6) {
      matrixCondition = 'well-conditioned';
      stabilityRisk = 'low';
      recommendedAction = 'No action needed';
    } else if (conditionNumber < 1e10) {
      matrixCondition = 'mildly-ill-conditioned';
      stabilityRisk = 'medium';
      recommendedAction = 'Consider iterative refinement or higher precision';
    } else if (conditionNumber < 1e14) {
      matrixCondition = 'severely-ill-conditioned';
      stabilityRisk = 'high';
      recommendedAction = 'Check model for near-singular elements or constraints';
    } else {
      matrixCondition = 'singular';
      stabilityRisk = 'critical';
      recommendedAction = 'Model has mechanism or conflicting constraints';
    }
    
    // Estimate roundoff error
    const machineEpsilon = 2.22e-16;
    const roundoffEstimate = conditionNumber * machineEpsilon;
    
    return {
      matrixCondition,
      conditionNumber,
      recommendedAction,
      pivotWarnings: pivotWarnings.slice(0, 10), // Limit to 10 warnings
      roundoffEstimate,
      stabilityRisk,
    };
  }
  
  // ==========================================
  // RESULT VALIDATION
  // ==========================================
  
  /**
   * Validate analysis results
   */
  validateResults(
    nodes: Node3D[],
    loads: NodalLoad[],
    result: AnalysisResult
  ): ResultDiagnosis {
    // Sum applied loads
    const appliedLoadSum = { fx: 0, fy: 0, fz: 0, mx: 0, my: 0, mz: 0 };
    
    for (const load of loads) {
      appliedLoadSum.fx += load.fx ?? 0;
      appliedLoadSum.fy += load.fy ?? 0;
      appliedLoadSum.fz += load.fz ?? 0;
      appliedLoadSum.mx += load.mx ?? 0;
      appliedLoadSum.my += load.my ?? 0;
      appliedLoadSum.mz += load.mz ?? 0;
    }
    
    // Sum reactions
    const reactionSum = { fx: 0, fy: 0, fz: 0, mx: 0, my: 0, mz: 0 };
    
    for (const [, reaction] of result.reactions) {
      reactionSum.fx += reaction[0] ?? 0;
      reactionSum.fy += reaction[1] ?? 0;
      reactionSum.fz += reaction[2] ?? 0;
      reactionSum.mx += reaction[3] ?? 0;
      reactionSum.my += reaction[4] ?? 0;
      reactionSum.mz += reaction[5] ?? 0;
    }
    
    // Calculate equilibrium error
    const equilibriumError = Math.sqrt(
      Math.pow(appliedLoadSum.fx + reactionSum.fx, 2) +
      Math.pow(appliedLoadSum.fy + reactionSum.fy, 2) +
      Math.pow(appliedLoadSum.fz + reactionSum.fz, 2)
    );
    
    // Find displacement bounds
    let minDisp = Infinity;
    let maxDisp = -Infinity;
    let minRot = Infinity;
    let maxRot = -Infinity;
    
    for (const [, disp] of result.displacements) {
      for (let i = 0; i < 3; i++) {
        minDisp = Math.min(minDisp, disp[i]);
        maxDisp = Math.max(maxDisp, disp[i]);
      }
      for (let i = 3; i < 6; i++) {
        minRot = Math.min(minRot, disp[i]);
        maxRot = Math.max(maxRot, disp[i]);
      }
    }
    
    // Estimate energy balance (simplified: W = 0.5 * F * u)
    let workDone = 0;
    
    for (const load of loads) {
      const disp = result.displacements.get(load.node_id);
      if (disp) {
        workDone += (load.fx ?? 0) * disp[0];
        workDone += (load.fy ?? 0) * disp[1];
        workDone += (load.fz ?? 0) * disp[2];
        workDone += (load.mx ?? 0) * disp[3];
        workDone += (load.my ?? 0) * disp[4];
        workDone += (load.mz ?? 0) * disp[5];
      }
    }
    
    const energyBalance = workDone * 0.5;
    
    return {
      equilibriumError,
      energyBalance,
      displacementBounds: {
        min: minDisp,
        max: maxDisp,
        reasonable: Math.abs(maxDisp) < 1 && Math.abs(minDisp) < 1, // < 1m
      },
      rotationBounds: {
        min: minRot,
        max: maxRot,
        reasonable: Math.abs(maxRot) < 0.5 && Math.abs(minRot) < 0.5, // < 0.5 rad
      },
      reactionSum,
      appliedLoadSum,
    };
  }
  
  // ==========================================
  // ELEMENT DEBUGGING
  // ==========================================
  
  /**
   * Debug single element stiffness
   */
  debugElementStiffness(
    element: Element3D,
    nodeI: Node3D,
    nodeJ: Node3D
  ): {
    length: number;
    direction: [number, number, number];
    localStiffness: number[][];
    transformationMatrix: number[][];
    issues: string[];
  } {
    const dx = nodeJ.x - nodeI.x;
    const dy = nodeJ.y - nodeI.y;
    const dz = nodeJ.z - nodeI.z;
    const length = Math.sqrt(dx * dx + dy * dy + dz * dz);
    
    const issues: string[] = [];
    
    // Check length
    if (length < 1e-10) {
      issues.push('Zero-length element detected');
    } else if (length < 0.001) {
      issues.push(`Very short element: L = ${length.toExponential(2)} m`);
    }
    
    // Check properties
    if (element.E <= 0) {
      issues.push(`Invalid Young's modulus: E = ${element.E}`);
    }
    
    if (element.A <= 0) {
      issues.push(`Invalid area: A = ${element.A}`);
    }
    
    if (element.Iy <= 0 || element.Iz <= 0) {
      issues.push(`Invalid moment of inertia: Iy = ${element.Iy}, Iz = ${element.Iz}`);
    }
    
    // Direction cosines
    const direction: [number, number, number] = length > 0 
      ? [dx / length, dy / length, dz / length]
      : [1, 0, 0];
    
    // Build local stiffness matrix (simplified 12x12 for frame)
    const localStiffness = this.buildLocalStiffnessMatrix(element, length);
    
    // Transformation matrix
    const transformationMatrix = this.buildTransformationMatrix(direction, element.beta ?? 0);
    
    // Check matrix properties
    const stiffnessInfo = this.inspectMatrix(`element_${element.id}_local_K`, localStiffness);
    
    if (!stiffnessInfo.symmetry) {
      issues.push('Local stiffness matrix is not symmetric');
    }
    
    if (!stiffnessInfo.positiveDef) {
      issues.push('Local stiffness matrix may not be positive definite');
    }
    
    return {
      length,
      direction,
      localStiffness,
      transformationMatrix,
      issues,
    };
  }
  
  /**
   * Build 12x12 local frame stiffness matrix
   */
  private buildLocalStiffnessMatrix(element: Element3D, L: number): number[][] {
    const E = element.E;
    const A = element.A;
    const Iy = element.Iy;
    const Iz = element.Iz;
    const G = element.G ?? E / 2.6;
    const J = element.J ?? (Iy + Iz);
    
    // Initialize 12x12 matrix
    const k: number[][] = Array(12).fill(null).map(() => Array(12).fill(0));
    
    if (L < 1e-10) return k;
    
    // Axial stiffness
    const EA_L = E * A / L;
    
    // Bending stiffness
    const EIy_L3 = E * Iy / (L * L * L);
    const EIz_L3 = E * Iz / (L * L * L);
    const EIy_L2 = E * Iy / (L * L);
    const EIz_L2 = E * Iz / (L * L);
    const EIy_L = E * Iy / L;
    const EIz_L = E * Iz / L;
    
    // Torsional stiffness
    const GJ_L = G * J / L;
    
    // Axial (DOF 0, 6)
    k[0][0] = EA_L;
    k[0][6] = -EA_L;
    k[6][0] = -EA_L;
    k[6][6] = EA_L;
    
    // Torsion (DOF 3, 9)
    k[3][3] = GJ_L;
    k[3][9] = -GJ_L;
    k[9][3] = -GJ_L;
    k[9][9] = GJ_L;
    
    // Bending about Y (DOF 2, 4, 8, 10)
    k[2][2] = 12 * EIy_L3;
    k[2][4] = 6 * EIy_L2;
    k[2][8] = -12 * EIy_L3;
    k[2][10] = 6 * EIy_L2;
    
    k[4][2] = 6 * EIy_L2;
    k[4][4] = 4 * EIy_L;
    k[4][8] = -6 * EIy_L2;
    k[4][10] = 2 * EIy_L;
    
    k[8][2] = -12 * EIy_L3;
    k[8][4] = -6 * EIy_L2;
    k[8][8] = 12 * EIy_L3;
    k[8][10] = -6 * EIy_L2;
    
    k[10][2] = 6 * EIy_L2;
    k[10][4] = 2 * EIy_L;
    k[10][8] = -6 * EIy_L2;
    k[10][10] = 4 * EIy_L;
    
    // Bending about Z (DOF 1, 5, 7, 11)
    k[1][1] = 12 * EIz_L3;
    k[1][5] = -6 * EIz_L2;
    k[1][7] = -12 * EIz_L3;
    k[1][11] = -6 * EIz_L2;
    
    k[5][1] = -6 * EIz_L2;
    k[5][5] = 4 * EIz_L;
    k[5][7] = 6 * EIz_L2;
    k[5][11] = 2 * EIz_L;
    
    k[7][1] = -12 * EIz_L3;
    k[7][5] = 6 * EIz_L2;
    k[7][7] = 12 * EIz_L3;
    k[7][11] = 6 * EIz_L2;
    
    k[11][1] = -6 * EIz_L2;
    k[11][5] = 2 * EIz_L;
    k[11][7] = 6 * EIz_L2;
    k[11][11] = 4 * EIz_L;
    
    return k;
  }
  
  /**
   * Build 12x12 transformation matrix
   */
  private buildTransformationMatrix(
    direction: [number, number, number],
    beta: number
  ): number[][] {
    const [cx, cy, cz] = direction;
    
    // Initialize 12x12 identity matrix
    const T: number[][] = Array(12).fill(null).map(() => Array(12).fill(0));
    
    // Build 3x3 rotation matrix
    const L = Math.sqrt(cx * cx + cy * cy + cz * cz);
    
    if (L < 1e-10) {
      // Identity for zero-length
      for (let i = 0; i < 12; i++) {
        T[i][i] = 1;
      }
      return T;
    }
    
    const betaRad = beta * Math.PI / 180;
    const cb = Math.cos(betaRad);
    const sb = Math.sin(betaRad);
    
    let R: number[][];
    
    if (Math.abs(cx) < 0.001 && Math.abs(cy) < 0.001) {
      // Vertical member
      const sign = cz > 0 ? 1 : -1;
      R = [
        [0, sign, 0],
        [-sign * cb, 0, sb],
        [sign * sb, 0, cb],
      ];
    } else {
      // General member
      const d = Math.sqrt(cx * cx + cy * cy);
      
      R = [
        [cx, cy, cz],
        [(-cy * cb - cx * cz * sb) / d, (cx * cb - cy * cz * sb) / d, d * sb],
        [(cy * sb - cx * cz * cb) / d, (-cx * sb - cy * cz * cb) / d, d * cb],
      ];
    }
    
    // Fill 12x12 transformation matrix
    for (let block = 0; block < 4; block++) {
      const offset = block * 3;
      for (let i = 0; i < 3; i++) {
        for (let j = 0; j < 3; j++) {
          T[offset + i][offset + j] = R[i][j];
        }
      }
    }
    
    return T;
  }
  
  // ==========================================
  // REPORT GENERATION
  // ==========================================
  
  /**
   * Generate full debug report
   */
  generateReport(): string {
    const lines: string[] = [
      '════════════════════════════════════════════════════════════════════════',
      '                    STRUCTURAL ANALYSIS DEBUG REPORT                     ',
      '════════════════════════════════════════════════════════════════════════',
      '',
      `Generated: ${new Date().toISOString()}`,
      '',
      '─────────────────────────────────────────────────────────────────────────',
      'ANALYSIS TRACE',
      '─────────────────────────────────────────────────────────────────────────',
    ];
    
    // Group traces by phase
    const phaseTraces = new Map<AnalysisPhase, AnalysisTrace[]>();
    
    for (const trace of this.traces) {
      if (!phaseTraces.has(trace.phase)) {
        phaseTraces.set(trace.phase, []);
      }
      phaseTraces.get(trace.phase)!.push(trace);
    }
    
    for (const [phase, traces] of phaseTraces) {
      lines.push('');
      lines.push(`[${phase.toUpperCase()}]`);
      
      for (const trace of traces) {
        const timeStr = new Date(trace.timestamp).toISOString().substr(11, 12);
        lines.push(`  ${timeStr} - ${trace.message}`);
        
        if (trace.data && this.config.verbosity !== 'minimal') {
          lines.push(`            ${JSON.stringify(trace.data)}`);
        }
      }
    }
    
    lines.push('');
    lines.push('─────────────────────────────────────────────────────────────────────────');
    lines.push('MATRICES INSPECTED');
    lines.push('─────────────────────────────────────────────────────────────────────────');
    
    for (const [name, matrix] of this.matricesSaved) {
      const info = this.inspectMatrix(name, matrix);
      lines.push('');
      lines.push(`Matrix: ${name}`);
      lines.push(`  Size: ${info.rows}×${info.cols}`);
      lines.push(`  Non-zeros: ${info.nonZeros} (Sparsity: ${(info.sparsity * 100).toFixed(1)}%)`);
      lines.push(`  Symmetric: ${info.symmetry ? 'Yes' : 'No'}`);
      lines.push(`  Positive Definite: ${info.positiveDef ? 'Likely' : 'Unlikely'}`);
      lines.push(`  Condition Number: ${info.conditionNumber.toExponential(2)}`);
      lines.push(`  Bandwidth: ${info.bandwidth}`);
    }
    
    return lines.join('\n');
  }
  
  /**
   * Get all traces
   */
  getTraces(): AnalysisTrace[] {
    return [...this.traces];
  }
  
  /**
   * Clear debug data
   */
  clear(): void {
    this.traces = [];
    this.phaseStartTimes.clear();
    this.matricesSaved.clear();
  }
}

// ============================================
// PERFORMANCE PROFILER
// ============================================

export class PerformanceProfiler {
  private timings: Map<string, number[]> = new Map();
  private activeTimers: Map<string, number> = new Map();
  
  /**
   * Start a timer
   */
  start(name: string): void {
    this.activeTimers.set(name, performance.now());
  }
  
  /**
   * Stop a timer and record the duration
   */
  stop(name: string): number {
    const startTime = this.activeTimers.get(name);
    if (startTime === undefined) {
      console.warn(`Timer "${name}" was not started`);
      return 0;
    }
    
    const duration = performance.now() - startTime;
    
    if (!this.timings.has(name)) {
      this.timings.set(name, []);
    }
    this.timings.get(name)!.push(duration);
    
    this.activeTimers.delete(name);
    
    return duration;
  }
  
  /**
   * Get statistics for a timer
   */
  getStats(name: string): {
    count: number;
    total: number;
    mean: number;
    min: number;
    max: number;
    stdDev: number;
  } | null {
    const times = this.timings.get(name);
    if (!times || times.length === 0) return null;
    
    const count = times.length;
    const total = times.reduce((a, b) => a + b, 0);
    const mean = total / count;
    const min = Math.min(...times);
    const max = Math.max(...times);
    
    const variance = times.reduce((sum, t) => sum + Math.pow(t - mean, 2), 0) / count;
    const stdDev = Math.sqrt(variance);
    
    return { count, total, mean, min, max, stdDev };
  }
  
  /**
   * Generate performance report
   */
  getReport(): string {
    const lines: string[] = [
      '┌────────────────────────────────────────────────────────────────────┐',
      '│                    PERFORMANCE PROFILE REPORT                      │',
      '├─────────────────────┬───────┬──────────┬──────────┬───────────────┤',
      '│ Timer               │ Count │ Mean(ms) │ Total(ms)│ Min/Max(ms)   │',
      '├─────────────────────┼───────┼──────────┼──────────┼───────────────┤',
    ];
    
    for (const [name] of this.timings) {
      const stats = this.getStats(name);
      if (!stats) continue;
      
      lines.push(
        `│ ${name.padEnd(19)} │ ${stats.count.toString().padStart(5)} │ ${stats.mean.toFixed(2).padStart(8)} │ ${stats.total.toFixed(1).padStart(8)} │ ${stats.min.toFixed(2)}/${stats.max.toFixed(2).padStart(6)} │`
      );
    }
    
    lines.push('└─────────────────────┴───────┴──────────┴──────────┴───────────────┘');
    
    return lines.join('\n');
  }
  
  /**
   * Clear all timings
   */
  clear(): void {
    this.timings.clear();
    this.activeTimers.clear();
  }
}

// ============================================
// EXPORTS
// ============================================

export const analysisDebugger = new AnalysisDebugger();
export const performanceProfiler = new PerformanceProfiler();

export default {
  AnalysisDebugger,
  PerformanceProfiler,
  analysisDebugger,
  performanceProfiler,
};
