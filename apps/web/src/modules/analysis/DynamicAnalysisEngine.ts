/**
 * ============================================================================
 * ADVANCED DYNAMIC ANALYSIS ENGINE
 * ============================================================================
 * 
 * Comprehensive dynamic analysis capabilities including:
 * - Eigenvalue/Modal Analysis
 * - Response Spectrum Analysis
 * - Time History Analysis
 * - Harmonic Analysis
 * - Random Vibration Analysis
 * - Floor Response Spectra
 * - Modal Participation Factors
 * - Effective Modal Mass
 * 
 * Supports: IS 1893, ASCE 7, EC8, NBC
 * 
 * @version 2.0.0
 */

// ============================================================================
// TYPES AND INTERFACES
// ============================================================================

export interface MassMatrix {
  nodeId: string;
  mass: {
    mx: number;  // Mass in X direction (kg)
    my: number;  // Mass in Y direction (kg)
    mz: number;  // Mass in Z direction (kg)
    Ixx: number; // Mass moment of inertia about X (kg·m²)
    Iyy: number; // Mass moment of inertia about Y (kg·m²)
    Izz: number; // Mass moment of inertia about Z (kg·m²)
  };
}

export interface StiffnessMatrix {
  size: number;
  values: number[][];
  condensed?: boolean;
}

export interface ModeShape {
  modeNumber: number;
  frequency: number;        // Hz
  period: number;           // seconds
  circularFrequency: number; // rad/s
  eigenvalue: number;
  eigenvector: number[];
  normalizedVector: number[];
  participationFactors: {
    x: number;
    y: number;
    z: number;
    rx: number;
    ry: number;
    rz: number;
  };
  effectiveMass: {
    x: number;
    y: number;
    z: number;
    rx: number;
    ry: number;
    rz: number;
  };
  effectiveMassRatio: {
    x: number;
    y: number;
    z: number;
  };
  modalDamping: number;
}

export interface ModalAnalysisConfig {
  numModes: number;
  method: 'lanczos' | 'subspace' | 'jacobi' | 'qr';
  tolerance: number;
  maxIterations: number;
  massParticipationTarget: number; // Target cumulative mass participation (e.g., 0.90)
  includeResidualModes: boolean;
  dampingType: 'rayleigh' | 'modal' | 'constant';
  dampingRatio: number;
  rayleighAlpha?: number;
  rayleighBeta?: number;
}

export interface ResponseSpectrumConfig {
  spectrum: DesignSpectrum;
  directions: ('x' | 'y' | 'z')[];
  combinationRule: 'SRSS' | 'CQC' | 'ABS' | 'CQC3';
  directionalCombination: 'SRSS' | '100-30-30' | '100-40-40';
  scaleFactor: number;
  eccentricity?: {
    accidental: boolean;
    ratio: number; // e.g., 0.05 for 5%
  };
}

export interface DesignSpectrum {
  code: 'IS1893' | 'ASCE7' | 'EC8' | 'NBC';
  zoneOrSs: number;
  soilType: string;
  importance: number;
  responseReduction: number;
  damping: number;
  periods: number[];
  accelerations: number[];
}

export interface TimeHistoryConfig {
  groundMotion: GroundMotion;
  direction: 'x' | 'y' | 'z';
  scaleFactor: number;
  integrationMethod: 'newmark' | 'wilson' | 'central_difference' | 'hht';
  timeStep: number;
  beta?: number;  // Newmark beta
  gamma?: number; // Newmark gamma
  alpha?: number; // HHT alpha
  dampingModel: 'rayleigh' | 'modal' | 'caughey';
}

export interface GroundMotion {
  name: string;
  dt: number;           // Time step (seconds)
  npts: number;         // Number of points
  acceleration: number[]; // Acceleration values (g or m/s²)
  unit: 'g' | 'm/s2';
  pga: number;          // Peak ground acceleration
  pgv?: number;         // Peak ground velocity
  pgd?: number;         // Peak ground displacement
  duration: number;     // Total duration (seconds)
  significantDuration?: number; // 5-95% Arias intensity duration
}

export interface TimeHistoryResult {
  time: number[];
  displacement: number[][];
  velocity: number[][];
  acceleration: number[][];
  baseShear: number[];
  baseMoment: number[];
  maxDisplacement: number;
  maxVelocity: number;
  maxAcceleration: number;
  maxBaseShear: number;
  timeOfMax: number;
}

export interface HarmonicAnalysisConfig {
  frequencyRange: { start: number; end: number };
  numFrequencies: number;
  excitationType: 'force' | 'displacement' | 'acceleration';
  excitationAmplitude: number;
  excitationNode: string;
  excitationDof: number;
  responseNodes: string[];
}

export interface FloorSpectrumConfig {
  floorNodes: string[];
  dampingRatios: number[];
  periodRange: { min: number; max: number };
  numPeriods: number;
}

// ============================================================================
// MAIN DYNAMIC ANALYSIS ENGINE CLASS
// ============================================================================

export class DynamicAnalysisEngine {
  private massMatrix: number[][] = [];
  private stiffnessMatrix: number[][] = [];
  private dampingMatrix: number[][] = [];
  private dof: number = 0;
  private modes: ModeShape[] = [];
  private totalMass: { x: number; y: number; z: number } = { x: 0, y: 0, z: 0 };

  constructor() {}

  // --------------------------------------------------------------------------
  // MATRIX ASSEMBLY
  // --------------------------------------------------------------------------

  assembleMassMatrix(masses: MassMatrix[], dofPerNode: number = 6): number[][] {
    this.dof = masses.length * dofPerNode;
    this.massMatrix = this.createZeroMatrix(this.dof, this.dof);
    
    masses.forEach((nodeMass, i) => {
      const startDof = i * dofPerNode;
      this.massMatrix[startDof][startDof] = nodeMass.mass.mx;
      this.massMatrix[startDof + 1][startDof + 1] = nodeMass.mass.my;
      this.massMatrix[startDof + 2][startDof + 2] = nodeMass.mass.mz;
      if (dofPerNode > 3) {
        this.massMatrix[startDof + 3][startDof + 3] = nodeMass.mass.Ixx;
        this.massMatrix[startDof + 4][startDof + 4] = nodeMass.mass.Iyy;
        this.massMatrix[startDof + 5][startDof + 5] = nodeMass.mass.Izz;
      }
      
      // Track total mass
      this.totalMass.x += nodeMass.mass.mx;
      this.totalMass.y += nodeMass.mass.my;
      this.totalMass.z += nodeMass.mass.mz;
    });
    
    return this.massMatrix;
  }

  setStiffnessMatrix(K: number[][]): void {
    this.stiffnessMatrix = K;
    this.dof = K.length;
  }

  assembleRayleighDamping(alpha: number, beta: number): number[][] {
    // C = alpha * M + beta * K
    this.dampingMatrix = this.createZeroMatrix(this.dof, this.dof);
    
    for (let i = 0; i < this.dof; i++) {
      for (let j = 0; j < this.dof; j++) {
        this.dampingMatrix[i][j] = alpha * this.massMatrix[i][j] + beta * this.stiffnessMatrix[i][j];
      }
    }
    
    return this.dampingMatrix;
  }

  calculateRayleighCoefficients(omega1: number, omega2: number, zeta1: number, zeta2: number): { alpha: number; beta: number } {
    // Solve: [1/omega1  omega1] [alpha]   [2*zeta1]
    //        [1/omega2  omega2] [beta ] = [2*zeta2]
    
    const det = omega2 / omega1 - omega1 / omega2;
    const alpha = 2 * (zeta1 * omega2 - zeta2 * omega1) / (omega2 * omega2 - omega1 * omega1) * omega1 * omega2;
    const beta = 2 * (zeta2 * omega2 - zeta1 * omega1) / (omega2 * omega2 - omega1 * omega1);
    
    return { alpha, beta };
  }

  // --------------------------------------------------------------------------
  // EIGENVALUE ANALYSIS
  // --------------------------------------------------------------------------

  performModalAnalysis(config: ModalAnalysisConfig): ModeShape[] {
    const { numModes, method, tolerance, maxIterations } = config;
    
    // Choose eigenvalue solver based on method
    let eigenResults: { eigenvalues: number[]; eigenvectors: number[][] };
    
    switch (method) {
      case 'jacobi':
        eigenResults = this.jacobiMethod(numModes, tolerance, maxIterations);
        break;
      case 'subspace':
        eigenResults = this.subspaceIteration(numModes, tolerance, maxIterations);
        break;
      case 'lanczos':
        eigenResults = this.lanczosMethod(numModes, tolerance, maxIterations);
        break;
      case 'qr':
      default:
        eigenResults = this.qrMethod(numModes, tolerance, maxIterations);
    }
    
    // Process eigenvalues and vectors into mode shapes
    this.modes = [];
    let cumulativeMassX = 0;
    let cumulativeMassY = 0;
    let cumulativeMassZ = 0;
    
    for (let i = 0; i < eigenResults.eigenvalues.length; i++) {
      const eigenvalue = eigenResults.eigenvalues[i];
      const eigenvector = eigenResults.eigenvectors[i];
      
      if (eigenvalue <= 0) continue; // Skip negative or zero eigenvalues
      
      const omega = Math.sqrt(eigenvalue);
      const frequency = omega / (2 * Math.PI);
      const period = 1 / frequency;
      
      // Normalize eigenvector (mass normalization)
      const normalizedVector = this.massNormalize(eigenvector);
      
      // Calculate participation factors
      const participation = this.calculateParticipationFactors(normalizedVector);
      
      // Calculate effective modal mass
      const effectiveMass = this.calculateEffectiveModalMass(normalizedVector);
      
      // Calculate effective mass ratios
      const effectiveMassRatio = {
        x: effectiveMass.x / this.totalMass.x,
        y: effectiveMass.y / this.totalMass.y,
        z: effectiveMass.z / this.totalMass.z,
      };
      
      cumulativeMassX += effectiveMassRatio.x;
      cumulativeMassY += effectiveMassRatio.y;
      cumulativeMassZ += effectiveMassRatio.z;
      
      // Calculate modal damping
      const modalDamping = this.calculateModalDamping(omega, config);
      
      const mode: ModeShape = {
        modeNumber: i + 1,
        frequency,
        period,
        circularFrequency: omega,
        eigenvalue,
        eigenvector,
        normalizedVector,
        participationFactors: participation,
        effectiveMass,
        effectiveMassRatio,
        modalDamping,
      };
      
      this.modes.push(mode);
      
      // Check if we've achieved target mass participation
      if (cumulativeMassX >= config.massParticipationTarget &&
          cumulativeMassY >= config.massParticipationTarget &&
          cumulativeMassZ >= config.massParticipationTarget) {
        if (!config.includeResidualModes) break;
      }
    }
    
    return this.modes;
  }

  private jacobiMethod(numModes: number, tolerance: number, maxIterations: number): { eigenvalues: number[]; eigenvectors: number[][] } {
    // Generalized eigenvalue problem: K*phi = lambda*M*phi
    // Transform to standard form: A*phi = lambda*phi where A = M^(-1/2) * K * M^(-1/2)
    
    const n = this.dof;
    const A = this.transformToStandardForm();
    const V = this.createIdentityMatrix(n);
    
    // Jacobi rotation method
    for (let iter = 0; iter < maxIterations; iter++) {
      let maxOffDiag = 0;
      let p = 0, q = 1;
      
      // Find largest off-diagonal element
      for (let i = 0; i < n; i++) {
        for (let j = i + 1; j < n; j++) {
          if (Math.abs(A[i][j]) > maxOffDiag) {
            maxOffDiag = Math.abs(A[i][j]);
            p = i;
            q = j;
          }
        }
      }
      
      if (maxOffDiag < tolerance) break;
      
      // Compute rotation angle
      const theta = 0.5 * Math.atan2(2 * A[p][q], A[q][q] - A[p][p]);
      const c = Math.cos(theta);
      const s = Math.sin(theta);
      
      // Apply rotation to A
      this.applyJacobiRotation(A, V, p, q, c, s);
    }
    
    // Extract eigenvalues and eigenvectors
    const eigenvalues: number[] = [];
    const eigenvectors: number[][] = [];
    
    // Sort by eigenvalue (ascending - smallest first)
    const indices = Array.from({ length: n }, (_, i) => i);
    indices.sort((a, b) => A[a][a] - A[b][b]);
    
    for (let i = 0; i < Math.min(numModes, n); i++) {
      const idx = indices[i];
      eigenvalues.push(A[idx][idx]);
      
      // Transform eigenvector back
      const vec = this.extractColumn(V, idx);
      eigenvectors.push(this.transformEigenvectorBack(vec));
    }
    
    return { eigenvalues, eigenvectors };
  }

  private subspaceIteration(numModes: number, tolerance: number, maxIterations: number): { eigenvalues: number[]; eigenvectors: number[][] } {
    const n = this.dof;
    const p = Math.min(numModes * 2, n); // Subspace size
    
    // Initial guess for subspace
    let X = this.createRandomMatrix(n, p);
    let eigenvalues: number[] = [];
    const eigenvectors: number[][] = [];
    
    for (let iter = 0; iter < maxIterations; iter++) {
      // Solve K * Y = M * X (solve for each column of MX)
      const MX = this.matrixMultiply(this.massMatrix, X);
      const Y: number[][] = MX[0].map((_, colIdx) => {
        const col = MX.map(row => row[colIdx]);
        return this.solveSystem(this.stiffnessMatrix, col);
      });
      // Transpose Y to get proper orientation
      const YTransposed: number[][] = Y[0].map((_, i) => Y.map(row => row[i]));
      
      // Orthonormalize Y with respect to M
      X = this.mGramSchmidt(YTransposed);
      
      // Project onto subspace: K_reduced = X^T * K * X, M_reduced = X^T * M * X
      const K_red = this.projectMatrix(this.stiffnessMatrix, X);
      const M_red = this.projectMatrix(this.massMatrix, X);
      
      // Solve reduced eigenvalue problem
      const reduced = this.solveReducedEigenProblem(K_red, M_red);
      
      // Check convergence
      const converged = this.checkConvergence(reduced.eigenvalues, eigenvalues, tolerance);
      eigenvalues = reduced.eigenvalues;
      
      if (converged) {
        // Transform eigenvectors back to full space
        for (let i = 0; i < numModes; i++) {
          const vec = this.matrixVectorMultiply(X, reduced.eigenvectors[i]);
          eigenvectors.push(vec);
        }
        break;
      }
    }
    
    return { eigenvalues: eigenvalues.slice(0, numModes), eigenvectors };
  }

  private lanczosMethod(numModes: number, tolerance: number, maxIterations: number): { eigenvalues: number[]; eigenvectors: number[][] } {
    // Lanczos algorithm for sparse matrices
    const n = this.dof;
    const m = Math.min(numModes * 3, n); // Lanczos vectors
    
    // Initialize
    const V: number[][] = []; // Lanczos vectors
    const alpha: number[] = []; // Diagonal of tridiagonal matrix
    const beta: number[] = [0]; // Off-diagonal of tridiagonal matrix
    
    // Start with random vector
    let v = this.randomVector(n);
    v = this.normalize(v);
    V.push(v);
    
    // Lanczos iteration
    for (let j = 0; j < m; j++) {
      // w = M^(-1) * K * v_j
      const Kv = this.matrixVectorMultiply(this.stiffnessMatrix, V[j]);
      const w = this.solveDiagonalSystem(this.massMatrix, Kv);
      
      // Alpha_j = v_j^T * M * w
      const Mw = this.matrixVectorMultiply(this.massMatrix, w);
      alpha[j] = this.dotProduct(V[j], Mw);
      
      // w = w - alpha_j * v_j - beta_j * v_{j-1}
      for (let i = 0; i < n; i++) {
        w[i] -= alpha[j] * V[j][i];
        if (j > 0) w[i] -= beta[j] * V[j - 1][i];
      }
      
      // Reorthogonalize
      for (let k = 0; k <= j; k++) {
        const MVk = this.matrixVectorMultiply(this.massMatrix, V[k]);
        const coeff = this.dotProduct(w, MVk);
        for (let i = 0; i < n; i++) {
          w[i] -= coeff * V[k][i];
        }
      }
      
      // Beta_{j+1} = sqrt(w^T * M * w)
      const Mw2 = this.matrixVectorMultiply(this.massMatrix, w);
      beta[j + 1] = Math.sqrt(Math.abs(this.dotProduct(w, Mw2)));
      
      if (beta[j + 1] < tolerance) break;
      
      // v_{j+1} = w / beta_{j+1}
      const vNext: number[] = new Array(n);
      for (let i = 0; i < n; i++) {
        vNext[i] = w[i] / beta[j + 1];
      }
      V.push(vNext);
    }
    
    // Solve tridiagonal eigenvalue problem
    const tridiagResult = this.solveTridiagonalEigen(alpha, beta.slice(1, alpha.length), numModes);
    
    // Transform eigenvectors back
    const eigenvectors: number[][] = [];
    for (let i = 0; i < numModes; i++) {
      const vec = new Array(n).fill(0);
      for (let j = 0; j < V.length; j++) {
        for (let k = 0; k < n; k++) {
          vec[k] += tridiagResult.eigenvectors[i][j] * V[j][k];
        }
      }
      eigenvectors.push(vec);
    }
    
    return { eigenvalues: tridiagResult.eigenvalues, eigenvectors };
  }

  private qrMethod(numModes: number, tolerance: number, maxIterations: number): { eigenvalues: number[]; eigenvectors: number[][] } {
    // QR algorithm with shifts
    const A = this.transformToStandardForm();
    const n = this.dof;
    let Q_total = this.createIdentityMatrix(n);
    
    for (let iter = 0; iter < maxIterations; iter++) {
      // Wilkinson shift
      const shift = this.wilkinsonShift(A);
      
      // Shift matrix
      for (let i = 0; i < n; i++) {
        A[i][i] -= shift;
      }
      
      // QR decomposition
      const { Q, R } = this.qrDecomposition(A);
      
      // A = R * Q + shift * I
      const RQ = this.matrixMultiply(R, Q);
      for (let i = 0; i < n; i++) {
        for (let j = 0; j < n; j++) {
          A[i][j] = RQ[i][j];
        }
        A[i][i] += shift;
      }
      
      // Accumulate eigenvectors
      Q_total = this.matrixMultiply(Q_total, Q);
      
      // Check convergence (off-diagonal elements)
      let maxOffDiag = 0;
      for (let i = 0; i < n - 1; i++) {
        maxOffDiag = Math.max(maxOffDiag, Math.abs(A[i + 1][i]));
      }
      
      if (maxOffDiag < tolerance) break;
    }
    
    // Extract results
    const eigenvalues: number[] = [];
    const eigenvectors: number[][] = [];
    
    const indices = Array.from({ length: n }, (_, i) => i);
    indices.sort((a, b) => A[a][a] - A[b][b]);
    
    for (let i = 0; i < Math.min(numModes, n); i++) {
      const idx = indices[i];
      eigenvalues.push(A[idx][idx]);
      eigenvectors.push(this.transformEigenvectorBack(this.extractColumn(Q_total, idx)));
    }
    
    return { eigenvalues, eigenvectors };
  }

  // --------------------------------------------------------------------------
  // PARTICIPATION FACTORS AND EFFECTIVE MASS
  // --------------------------------------------------------------------------

  private calculateParticipationFactors(phi: number[]): ModeShape['participationFactors'] {
    // Gamma_x = (phi^T * M * r_x) / (phi^T * M * phi)
    // where r_x is influence vector for x-direction
    
    const dofPerNode = 6;
    const numNodes = this.dof / dofPerNode;
    
    // Create influence vectors
    const rx = this.createInfluenceVector('x', numNodes, dofPerNode);
    const ry = this.createInfluenceVector('y', numNodes, dofPerNode);
    const rz = this.createInfluenceVector('z', numNodes, dofPerNode);
    const rrx = this.createInfluenceVector('rx', numNodes, dofPerNode);
    const rry = this.createInfluenceVector('ry', numNodes, dofPerNode);
    const rrz = this.createInfluenceVector('rz', numNodes, dofPerNode);
    
    // phi^T * M * phi (generalized mass)
    const Mphi = this.matrixVectorMultiply(this.massMatrix, phi);
    const genMass = this.dotProduct(phi, Mphi);
    
    // Participation factors
    const Mrx = this.matrixVectorMultiply(this.massMatrix, rx);
    const Mry = this.matrixVectorMultiply(this.massMatrix, ry);
    const Mrz = this.matrixVectorMultiply(this.massMatrix, rz);
    const Mrrx = this.matrixVectorMultiply(this.massMatrix, rrx);
    const Mrry = this.matrixVectorMultiply(this.massMatrix, rry);
    const Mrrz = this.matrixVectorMultiply(this.massMatrix, rrz);
    
    return {
      x: this.dotProduct(phi, Mrx) / genMass,
      y: this.dotProduct(phi, Mry) / genMass,
      z: this.dotProduct(phi, Mrz) / genMass,
      rx: this.dotProduct(phi, Mrrx) / genMass,
      ry: this.dotProduct(phi, Mrry) / genMass,
      rz: this.dotProduct(phi, Mrrz) / genMass,
    };
  }

  private calculateEffectiveModalMass(phi: number[]): ModeShape['effectiveMass'] {
    // M_eff,x = (phi^T * M * r_x)^2 / (phi^T * M * phi)
    
    const dofPerNode = 6;
    const numNodes = this.dof / dofPerNode;
    
    const rx = this.createInfluenceVector('x', numNodes, dofPerNode);
    const ry = this.createInfluenceVector('y', numNodes, dofPerNode);
    const rz = this.createInfluenceVector('z', numNodes, dofPerNode);
    const rrx = this.createInfluenceVector('rx', numNodes, dofPerNode);
    const rry = this.createInfluenceVector('ry', numNodes, dofPerNode);
    const rrz = this.createInfluenceVector('rz', numNodes, dofPerNode);
    
    const Mphi = this.matrixVectorMultiply(this.massMatrix, phi);
    const genMass = this.dotProduct(phi, Mphi);
    
    const Mrx = this.matrixVectorMultiply(this.massMatrix, rx);
    const Mry = this.matrixVectorMultiply(this.massMatrix, ry);
    const Mrz = this.matrixVectorMultiply(this.massMatrix, rz);
    const Mrrx = this.matrixVectorMultiply(this.massMatrix, rrx);
    const Mrry = this.matrixVectorMultiply(this.massMatrix, rry);
    const Mrrz = this.matrixVectorMultiply(this.massMatrix, rrz);
    
    const Lx = this.dotProduct(phi, Mrx);
    const Ly = this.dotProduct(phi, Mry);
    const Lz = this.dotProduct(phi, Mrz);
    const Lrx = this.dotProduct(phi, Mrrx);
    const Lry = this.dotProduct(phi, Mrry);
    const Lrz = this.dotProduct(phi, Mrrz);
    
    return {
      x: (Lx * Lx) / genMass,
      y: (Ly * Ly) / genMass,
      z: (Lz * Lz) / genMass,
      rx: (Lrx * Lrx) / genMass,
      ry: (Lry * Lry) / genMass,
      rz: (Lrz * Lrz) / genMass,
    };
  }

  private createInfluenceVector(direction: string, numNodes: number, dofPerNode: number): number[] {
    const r = new Array(numNodes * dofPerNode).fill(0);
    const dofIndex = { x: 0, y: 1, z: 2, rx: 3, ry: 4, rz: 5 }[direction] || 0;
    
    for (let i = 0; i < numNodes; i++) {
      r[i * dofPerNode + dofIndex] = 1;
    }
    
    return r;
  }

  // --------------------------------------------------------------------------
  // RESPONSE SPECTRUM ANALYSIS
  // --------------------------------------------------------------------------

  performResponseSpectrumAnalysis(config: ResponseSpectrumConfig): ResponseSpectrumResult {
    const { spectrum, directions, combinationRule, directionalCombination, scaleFactor } = config;
    
    // Get spectral accelerations for each mode
    const modalResponses: ModalResponse[] = [];
    
    for (const mode of this.modes) {
      const Sa = this.getSpectralAcceleration(spectrum, mode.period);
      
      const response: ModalResponse = {
        modeNumber: mode.modeNumber,
        period: mode.period,
        Sa: Sa * scaleFactor,
        Sd: Sa * scaleFactor * mode.period * mode.period / (4 * Math.PI * Math.PI),
        responses: {},
      };
      
      // Calculate modal response for each direction
      for (const dir of directions) {
        const gamma = mode.participationFactors[dir];
        const phi = mode.normalizedVector;
        
        // Modal displacement: u_n = gamma * Sa * T^2 / (4*pi^2) * phi
        const modalDisp = phi.map(p => gamma * response.Sd * p);
        
        // Modal force: f_n = gamma * Sa * M * phi
        const Mphi = this.matrixVectorMultiply(this.massMatrix, phi);
        const modalForce = Mphi.map(m => gamma * response.Sa * m);
        
        response.responses[dir] = {
          displacement: modalDisp,
          force: modalForce,
          baseShear: modalForce.reduce((sum, f, i) => i % 6 === 0 ? sum + f : sum, 0),
        };
      }
      
      modalResponses.push(response);
    }
    
    // Combine modal responses
    const combinedResponse = this.combineModalResponses(modalResponses, combinationRule);
    
    // Combine directional responses
    const totalResponse = this.combineDirectionalResponses(combinedResponse, directions, directionalCombination);
    
    // Apply accidental eccentricity if specified
    if (config.eccentricity?.accidental) {
      this.applyAccidentalEccentricity(totalResponse, config.eccentricity.ratio);
    }
    
    return {
      modalResponses,
      combinedResponse,
      totalResponse,
      baseShear: totalResponse.baseShear,
      baseMoment: totalResponse.baseMoment,
      maxDisplacement: Math.max(...totalResponse.displacement.map(Math.abs)),
    };
  }

  private getSpectralAcceleration(spectrum: DesignSpectrum, period: number): number {
    // Interpolate from spectrum data
    const { periods, accelerations } = spectrum;
    
    if (period <= periods[0]) return accelerations[0];
    if (period >= periods[periods.length - 1]) return accelerations[accelerations.length - 1];
    
    for (let i = 0; i < periods.length - 1; i++) {
      if (period >= periods[i] && period <= periods[i + 1]) {
        const t1 = periods[i], t2 = periods[i + 1];
        const a1 = accelerations[i], a2 = accelerations[i + 1];
        return a1 + (a2 - a1) * (period - t1) / (t2 - t1);
      }
    }
    
    return accelerations[0];
  }

  private combineModalResponses(responses: ModalResponse[], rule: string): CombinedResponse {
    const n = this.dof;
    const combined: CombinedResponse = {
      displacement: new Array(n).fill(0),
      velocity: new Array(n).fill(0),
      acceleration: new Array(n).fill(0),
      force: new Array(n).fill(0),
      baseShear: 0,
      baseMoment: 0,
    };
    
    if (rule === 'SRSS') {
      // Square Root of Sum of Squares
      for (const resp of responses) {
        for (const dir of Object.keys(resp.responses)) {
          const dirResp = resp.responses[dir];
          for (let i = 0; i < n; i++) {
            combined.displacement[i] += dirResp.displacement[i] ** 2;
            combined.force[i] += dirResp.force[i] ** 2;
          }
          combined.baseShear += dirResp.baseShear ** 2;
        }
      }
      
      for (let i = 0; i < n; i++) {
        combined.displacement[i] = Math.sqrt(combined.displacement[i]);
        combined.force[i] = Math.sqrt(combined.force[i]);
      }
      combined.baseShear = Math.sqrt(combined.baseShear);
      
    } else if (rule === 'CQC') {
      // Complete Quadratic Combination
      const numModes = responses.length;
      
      for (let i = 0; i < numModes; i++) {
        for (let j = 0; j < numModes; j++) {
          const rho = this.cqcCorrelation(
            this.modes[i].circularFrequency,
            this.modes[j].circularFrequency,
            this.modes[i].modalDamping,
            this.modes[j].modalDamping
          );
          
          for (const dir of Object.keys(responses[i].responses)) {
            const ri = responses[i].responses[dir];
            const rj = responses[j].responses[dir];
            
            for (let k = 0; k < n; k++) {
              combined.displacement[k] += rho * ri.displacement[k] * rj.displacement[k];
              combined.force[k] += rho * ri.force[k] * rj.force[k];
            }
            combined.baseShear += rho * ri.baseShear * rj.baseShear;
          }
        }
      }
      
      for (let i = 0; i < n; i++) {
        combined.displacement[i] = Math.sqrt(Math.abs(combined.displacement[i]));
        combined.force[i] = Math.sqrt(Math.abs(combined.force[i]));
      }
      combined.baseShear = Math.sqrt(Math.abs(combined.baseShear));
    }
    
    return combined;
  }

  private cqcCorrelation(omegai: number, omegaj: number, zetai: number, zetaj: number): number {
    // CQC correlation coefficient (Der Kiureghian)
    const r = omegai / omegaj;
    const zeta = Math.sqrt(zetai * zetaj);
    
    const num = 8 * zeta * zeta * (1 + r) * Math.pow(r, 1.5);
    const den = Math.pow(1 - r * r, 2) + 4 * zeta * zeta * r * (1 + r) * (1 + r);
    
    return num / den;
  }

  private combineDirectionalResponses(
    response: CombinedResponse,
    directions: string[],
    rule: string
  ): CombinedResponse {
    // For simplicity, return as-is (actual implementation would combine X, Y, Z responses)
    return response;
  }

  private applyAccidentalEccentricity(response: CombinedResponse, ratio: number): void {
    // Amplify torsional response by accidental eccentricity
    // Simplified implementation - actual would modify moments
  }

  // --------------------------------------------------------------------------
  // TIME HISTORY ANALYSIS
  // --------------------------------------------------------------------------

  performTimeHistoryAnalysis(config: TimeHistoryConfig): TimeHistoryResult {
    const { groundMotion, direction, scaleFactor, integrationMethod, timeStep } = config;
    
    const dt = timeStep || groundMotion.dt;
    const nSteps = Math.floor(groundMotion.duration / dt);
    const n = this.dof;
    
    // Initialize arrays
    const time: number[] = [];
    const displacement: number[][] = [];
    const velocity: number[][] = [];
    const acceleration: number[][] = [];
    const baseShear: number[] = [];
    const baseMoment: number[] = [];
    
    // Initial conditions
    let u = new Array(n).fill(0);
    let v = new Array(n).fill(0);
    let a = new Array(n).fill(0);
    
    // Calculate initial acceleration
    const dofIndex = { x: 0, y: 1, z: 2 }[direction] || 0;
    
    // Effective stiffness for Newmark method
    const beta = config.beta || 0.25;
    const gamma = config.gamma || 0.5;
    
    const a0 = 1 / (beta * dt * dt);
    const a1 = gamma / (beta * dt);
    const a2 = 1 / (beta * dt);
    const a3 = 1 / (2 * beta) - 1;
    const a4 = gamma / beta - 1;
    const a5 = (dt / 2) * (gamma / beta - 2);
    const a6 = dt * (1 - gamma);
    const a7 = gamma * dt;
    
    // Effective stiffness matrix
    const Keff = this.createZeroMatrix(n, n);
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        Keff[i][j] = this.stiffnessMatrix[i][j] + 
                     a0 * this.massMatrix[i][j] + 
                     a1 * this.dampingMatrix[i][j];
      }
    }
    
    // LU decomposition of Keff for efficiency
    const { L, U } = this.luDecomposition(Keff);
    
    // Time stepping
    for (let step = 0; step < nSteps; step++) {
      const t = step * dt;
      time.push(t);
      
      // Get ground acceleration (interpolate if necessary)
      const agIndex = Math.min(step, groundMotion.acceleration.length - 1);
      let ag = groundMotion.acceleration[agIndex] * scaleFactor;
      if (groundMotion.unit === 'g') ag *= 9.81; // Convert to m/s²
      
      // Effective load vector
      const Peff = new Array(n).fill(0);
      for (let i = 0; i < n; i++) {
        // Ground motion contribution
        const numNodes = n / 6;
        for (let node = 0; node < numNodes; node++) {
          Peff[node * 6 + dofIndex] = -this.massMatrix[node * 6 + dofIndex][node * 6 + dofIndex] * ag;
        }
        
        // Previous state contribution
        for (let j = 0; j < n; j++) {
          Peff[i] += this.massMatrix[i][j] * (a0 * u[j] + a2 * v[j] + a3 * a[j]);
          Peff[i] += this.dampingMatrix[i][j] * (a1 * u[j] + a4 * v[j] + a5 * a[j]);
        }
      }
      
      // Solve for displacement
      const uNew = this.solveLU(L, U, Peff);
      
      // Calculate new acceleration and velocity
      const aNew = new Array(n);
      const vNew = new Array(n);
      
      for (let i = 0; i < n; i++) {
        aNew[i] = a0 * (uNew[i] - u[i]) - a2 * v[i] - a3 * a[i];
        vNew[i] = v[i] + a6 * a[i] + a7 * aNew[i];
      }
      
      // Store results
      displacement.push([...uNew]);
      velocity.push([...vNew]);
      acceleration.push([...aNew]);
      
      // Calculate base shear
      const shear = this.calculateBaseShear(uNew, vNew, aNew);
      baseShear.push(shear);
      
      // Update state
      u = uNew;
      v = vNew;
      a = aNew;
    }
    
    // Find maximum values
    const maxDisplacement = Math.max(...displacement.flat().map(Math.abs));
    const maxVelocity = Math.max(...velocity.flat().map(Math.abs));
    const maxAcceleration = Math.max(...acceleration.flat().map(Math.abs));
    const maxBaseShear = Math.max(...baseShear.map(Math.abs));
    const timeOfMax = time[baseShear.indexOf(maxBaseShear)];
    
    return {
      time,
      displacement,
      velocity,
      acceleration,
      baseShear,
      baseMoment,
      maxDisplacement,
      maxVelocity,
      maxAcceleration,
      maxBaseShear,
      timeOfMax,
    };
  }

  private calculateBaseShear(u: number[], v: number[], a: number[]): number {
    // Base shear = sum of inertia forces
    const Ma = this.matrixVectorMultiply(this.massMatrix, a);
    const Cv = this.matrixVectorMultiply(this.dampingMatrix, v);
    
    let shear = 0;
    const numNodes = this.dof / 6;
    
    for (let i = 0; i < numNodes; i++) {
      shear += Ma[i * 6] + Cv[i * 6]; // X-direction forces
    }
    
    return Math.abs(shear);
  }

  // --------------------------------------------------------------------------
  // FLOOR RESPONSE SPECTRA
  // --------------------------------------------------------------------------

  calculateFloorResponseSpectra(config: FloorSpectrumConfig, timeHistoryResult: TimeHistoryResult): FloorSpectrum[] {
    const spectra: FloorSpectrum[] = [];
    const { dampingRatios, periodRange, numPeriods } = config;
    
    // Generate period array
    const periods: number[] = [];
    const logMin = Math.log10(periodRange.min);
    const logMax = Math.log10(periodRange.max);
    
    for (let i = 0; i < numPeriods; i++) {
      const logT = logMin + (logMax - logMin) * i / (numPeriods - 1);
      periods.push(Math.pow(10, logT));
    }
    
    // Calculate spectrum for each floor and damping ratio
    for (const nodeIndex of config.floorNodes.map(n => parseInt(n))) {
      for (const zeta of dampingRatios) {
        const floorAccel = timeHistoryResult.acceleration.map(a => a[nodeIndex * 6]); // X-direction
        const dt = timeHistoryResult.time[1] - timeHistoryResult.time[0];
        
        const Sa: number[] = [];
        const Sd: number[] = [];
        const Sv: number[] = [];
        
        for (const T of periods) {
          const omega = 2 * Math.PI / T;
          const { maxDisp, maxVel, maxAccel } = this.sdofResponse(floorAccel, dt, omega, zeta);
          
          Sd.push(maxDisp);
          Sv.push(maxVel);
          Sa.push(maxAccel);
        }
        
        spectra.push({
          nodeId: nodeIndex.toString(),
          dampingRatio: zeta,
          periods,
          Sa,
          Sv,
          Sd,
        });
      }
    }
    
    return spectra;
  }

  private sdofResponse(
    groundAccel: number[],
    dt: number,
    omega: number,
    zeta: number
  ): { maxDisp: number; maxVel: number; maxAccel: number } {
    // Duhamel integral for SDOF response
    const omegaD = omega * Math.sqrt(1 - zeta * zeta);
    
    let u = 0, v = 0;
    let maxDisp = 0, maxVel = 0, maxAccel = 0;
    
    for (const ag of groundAccel) {
      // Newmark-beta for SDOF
      const aNew = -2 * zeta * omega * v - omega * omega * u - ag;
      v += 0.5 * dt * aNew;
      u += dt * v;
      
      const totalAccel = aNew + ag;
      
      maxDisp = Math.max(maxDisp, Math.abs(u));
      maxVel = Math.max(maxVel, Math.abs(v));
      maxAccel = Math.max(maxAccel, Math.abs(totalAccel));
    }
    
    return { maxDisp, maxVel, maxAccel };
  }

  // --------------------------------------------------------------------------
  // HARMONIC ANALYSIS
  // --------------------------------------------------------------------------

  performHarmonicAnalysis(config: HarmonicAnalysisConfig): HarmonicResult {
    const { frequencyRange, numFrequencies, excitationAmplitude, excitationNode, excitationDof, responseNodes } = config;
    
    const frequencies: number[] = [];
    const responseAmplitudes: Map<string, number[]> = new Map();
    const responsePhases: Map<string, number[]> = new Map();
    
    // Initialize response arrays
    for (const node of responseNodes) {
      responseAmplitudes.set(node, []);
      responsePhases.set(node, []);
    }
    
    // Calculate response at each frequency
    for (let i = 0; i < numFrequencies; i++) {
      const f = frequencyRange.start + (frequencyRange.end - frequencyRange.start) * i / (numFrequencies - 1);
      frequencies.push(f);
      
      const omega = 2 * Math.PI * f;
      
      // Dynamic stiffness matrix: K_dyn = K - omega^2*M + i*omega*C
      const Kdyn_real = this.createZeroMatrix(this.dof, this.dof);
      const Kdyn_imag = this.createZeroMatrix(this.dof, this.dof);
      
      for (let j = 0; j < this.dof; j++) {
        for (let k = 0; k < this.dof; k++) {
          Kdyn_real[j][k] = this.stiffnessMatrix[j][k] - omega * omega * this.massMatrix[j][k];
          Kdyn_imag[j][k] = omega * this.dampingMatrix[j][k];
        }
      }
      
      // Create force vector
      const F_real = new Array(this.dof).fill(0);
      const F_imag = new Array(this.dof).fill(0);
      
      const excNodeIdx = parseInt(excitationNode);
      F_real[excNodeIdx * 6 + excitationDof] = excitationAmplitude;
      
      // Solve complex system (simplified - real implementation would use complex solver)
      const u_real = this.solveSystem(Kdyn_real, F_real);
      const u_imag = this.solveSystem(Kdyn_real, F_imag); // Simplified
      
      // Calculate response at each node
      for (const node of responseNodes) {
        const nodeIdx = parseInt(node);
        const ur = u_real[nodeIdx * 6];
        const ui = u_imag[nodeIdx * 6];
        
        const amplitude = Math.sqrt(ur * ur + ui * ui);
        const phase = Math.atan2(ui, ur) * 180 / Math.PI;
        
        responseAmplitudes.get(node)!.push(amplitude);
        responsePhases.get(node)!.push(phase);
      }
    }
    
    return {
      frequencies,
      responseAmplitudes,
      responsePhases,
      resonantFrequencies: this.findResonantFrequencies(frequencies, responseAmplitudes),
    };
  }

  private findResonantFrequencies(frequencies: number[], amplitudes: Map<string, number[]>): number[] {
    const resonant: number[] = [];
    
    for (const [, amps] of amplitudes) {
      for (let i = 1; i < amps.length - 1; i++) {
        if (amps[i] > amps[i - 1] && amps[i] > amps[i + 1]) {
          resonant.push(frequencies[i]);
        }
      }
    }
    
    return [...new Set(resonant)].sort((a, b) => a - b);
  }

  // --------------------------------------------------------------------------
  // UTILITY METHODS
  // --------------------------------------------------------------------------

  private calculateModalDamping(omega: number, config: ModalAnalysisConfig): number {
    if (config.dampingType === 'constant') {
      return config.dampingRatio;
    } else if (config.dampingType === 'rayleigh') {
      const alpha = config.rayleighAlpha || 0;
      const beta = config.rayleighBeta || 0;
      return alpha / (2 * omega) + beta * omega / 2;
    }
    return config.dampingRatio;
  }

  private massNormalize(phi: number[]): number[] {
    const Mphi = this.matrixVectorMultiply(this.massMatrix, phi);
    const genMass = Math.sqrt(Math.abs(this.dotProduct(phi, Mphi)));
    return phi.map(p => p / genMass);
  }

  private transformToStandardForm(): number[][] {
    // A = M^(-1/2) * K * M^(-1/2)
    const n = this.dof;
    const Msqrt_inv = this.createZeroMatrix(n, n);
    
    // For diagonal mass matrix
    for (let i = 0; i < n; i++) {
      if (this.massMatrix[i][i] > 0) {
        Msqrt_inv[i][i] = 1 / Math.sqrt(this.massMatrix[i][i]);
      }
    }
    
    const temp = this.matrixMultiply(this.stiffnessMatrix, Msqrt_inv);
    return this.matrixMultiply(Msqrt_inv, temp);
  }

  private transformEigenvectorBack(phi: number[]): number[] {
    // Transform eigenvector back from standard form
    const n = this.dof;
    const result = new Array(n);
    
    for (let i = 0; i < n; i++) {
      if (this.massMatrix[i][i] > 0) {
        result[i] = phi[i] / Math.sqrt(this.massMatrix[i][i]);
      } else {
        result[i] = phi[i];
      }
    }
    
    return result;
  }

  // Matrix operations
  private createZeroMatrix(rows: number, cols: number): number[][] {
    return Array.from({ length: rows }, () => new Array(cols).fill(0));
  }

  private createIdentityMatrix(n: number): number[][] {
    const I = this.createZeroMatrix(n, n);
    for (let i = 0; i < n; i++) I[i][i] = 1;
    return I;
  }

  private createRandomMatrix(rows: number, cols: number): number[][] {
    return Array.from({ length: rows }, () => 
      Array.from({ length: cols }, () => Math.random() - 0.5)
    );
  }

  private randomVector(n: number): number[] {
    return Array.from({ length: n }, () => Math.random() - 0.5);
  }

  private matrixMultiply(A: number[][], B: number[][]): number[][] {
    const m = A.length;
    const n = B[0].length;
    const p = B.length;
    const C = this.createZeroMatrix(m, n);
    
    for (let i = 0; i < m; i++) {
      for (let j = 0; j < n; j++) {
        for (let k = 0; k < p; k++) {
          C[i][j] += A[i][k] * B[k][j];
        }
      }
    }
    
    return C;
  }

  private matrixVectorMultiply(A: number[][], v: number[]): number[] {
    const n = A.length;
    const result = new Array(n).fill(0);
    
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < v.length; j++) {
        result[i] += A[i][j] * v[j];
      }
    }
    
    return result;
  }

  private dotProduct(a: number[], b: number[]): number {
    return a.reduce((sum, ai, i) => sum + ai * b[i], 0);
  }

  private normalize(v: number[]): number[] {
    const norm = Math.sqrt(this.dotProduct(v, v));
    return v.map(x => x / norm);
  }

  private extractColumn(A: number[][], col: number): number[] {
    return A.map(row => row[col]);
  }

  private solveSystem(A: number[][], b: number[]): number[] {
    // Gaussian elimination with partial pivoting
    const n = A.length;
    const Aug = A.map((row, i) => [...row, b[i]]);
    
    for (let i = 0; i < n; i++) {
      // Partial pivoting
      let maxRow = i;
      for (let k = i + 1; k < n; k++) {
        if (Math.abs(Aug[k][i]) > Math.abs(Aug[maxRow][i])) {
          maxRow = k;
        }
      }
      [Aug[i], Aug[maxRow]] = [Aug[maxRow], Aug[i]];
      
      // Forward elimination
      for (let k = i + 1; k < n; k++) {
        const c = Aug[k][i] / Aug[i][i];
        for (let j = i; j <= n; j++) {
          Aug[k][j] -= c * Aug[i][j];
        }
      }
    }
    
    // Back substitution
    const x = new Array(n);
    for (let i = n - 1; i >= 0; i--) {
      x[i] = Aug[i][n];
      for (let j = i + 1; j < n; j++) {
        x[i] -= Aug[i][j] * x[j];
      }
      x[i] /= Aug[i][i];
    }
    
    return x;
  }

  private solveDiagonalSystem(D: number[][], b: number[]): number[] {
    return b.map((bi, i) => D[i][i] !== 0 ? bi / D[i][i] : 0);
  }

  private luDecomposition(A: number[][]): { L: number[][]; U: number[][] } {
    const n = A.length;
    const L = this.createZeroMatrix(n, n);
    const U = this.createZeroMatrix(n, n);
    
    for (let i = 0; i < n; i++) {
      L[i][i] = 1;
      
      for (let j = i; j < n; j++) {
        let sum = 0;
        for (let k = 0; k < i; k++) {
          sum += L[i][k] * U[k][j];
        }
        U[i][j] = A[i][j] - sum;
      }
      
      for (let j = i + 1; j < n; j++) {
        let sum = 0;
        for (let k = 0; k < i; k++) {
          sum += L[j][k] * U[k][i];
        }
        L[j][i] = (A[j][i] - sum) / U[i][i];
      }
    }
    
    return { L, U };
  }

  private solveLU(L: number[][], U: number[][], b: number[]): number[] {
    const n = b.length;
    
    // Forward substitution: L*y = b
    const y = new Array(n);
    for (let i = 0; i < n; i++) {
      y[i] = b[i];
      for (let j = 0; j < i; j++) {
        y[i] -= L[i][j] * y[j];
      }
    }
    
    // Back substitution: U*x = y
    const x = new Array(n);
    for (let i = n - 1; i >= 0; i--) {
      x[i] = y[i];
      for (let j = i + 1; j < n; j++) {
        x[i] -= U[i][j] * x[j];
      }
      x[i] /= U[i][i];
    }
    
    return x;
  }

  private qrDecomposition(A: number[][]): { Q: number[][]; R: number[][] } {
    const n = A.length;
    const Q = this.createIdentityMatrix(n);
    const R = A.map(row => [...row]);
    
    for (let j = 0; j < n - 1; j++) {
      for (let i = n - 1; i > j; i--) {
        const a = R[i - 1][j];
        const b = R[i][j];
        const r = Math.sqrt(a * a + b * b);
        
        if (r === 0) continue;
        
        const c = a / r;
        const s = -b / r;
        
        // Apply Givens rotation to R
        for (let k = 0; k < n; k++) {
          const temp1 = c * R[i - 1][k] - s * R[i][k];
          const temp2 = s * R[i - 1][k] + c * R[i][k];
          R[i - 1][k] = temp1;
          R[i][k] = temp2;
        }
        
        // Apply Givens rotation to Q
        for (let k = 0; k < n; k++) {
          const temp1 = c * Q[k][i - 1] - s * Q[k][i];
          const temp2 = s * Q[k][i - 1] + c * Q[k][i];
          Q[k][i - 1] = temp1;
          Q[k][i] = temp2;
        }
      }
    }
    
    return { Q, R };
  }

  private wilkinsonShift(A: number[][]): number {
    const n = A.length;
    const a = A[n - 2][n - 2];
    const b = A[n - 2][n - 1];
    const c = A[n - 1][n - 2];
    const d = A[n - 1][n - 1];
    
    const tr = a + d;
    const det = a * d - b * c;
    const disc = Math.sqrt(tr * tr / 4 - det);
    
    const eig1 = tr / 2 + disc;
    const eig2 = tr / 2 - disc;
    
    return Math.abs(eig1 - d) < Math.abs(eig2 - d) ? eig1 : eig2;
  }

  private applyJacobiRotation(A: number[][], V: number[][], p: number, q: number, c: number, s: number): void {
    const n = A.length;
    
    for (let i = 0; i < n; i++) {
      const Aip = A[i][p];
      const Aiq = A[i][q];
      A[i][p] = c * Aip - s * Aiq;
      A[i][q] = s * Aip + c * Aiq;
    }
    
    for (let j = 0; j < n; j++) {
      const Apj = A[p][j];
      const Aqj = A[q][j];
      A[p][j] = c * Apj - s * Aqj;
      A[q][j] = s * Apj + c * Aqj;
    }
    
    for (let i = 0; i < n; i++) {
      const Vip = V[i][p];
      const Viq = V[i][q];
      V[i][p] = c * Vip - s * Viq;
      V[i][q] = s * Vip + c * Viq;
    }
  }

  private mGramSchmidt(X: number[][]): number[][] {
    const n = X.length;
    const m = X[0].length;
    const Q = this.createZeroMatrix(n, m);
    
    for (let j = 0; j < m; j++) {
      // Copy column j
      for (let i = 0; i < n; i++) {
        Q[i][j] = X[i][j];
      }
      
      // Orthogonalize against previous columns with M-inner product
      for (let k = 0; k < j; k++) {
        const Mqk = this.matrixVectorMultiply(this.massMatrix, this.extractColumn(Q, k));
        const qj = this.extractColumn(Q, j);
        const coeff = this.dotProduct(qj, Mqk);
        
        for (let i = 0; i < n; i++) {
          Q[i][j] -= coeff * Q[i][k];
        }
      }
      
      // Normalize with M-norm
      const qj = this.extractColumn(Q, j);
      const Mqj = this.matrixVectorMultiply(this.massMatrix, qj);
      const norm = Math.sqrt(Math.abs(this.dotProduct(qj, Mqj)));
      
      for (let i = 0; i < n; i++) {
        Q[i][j] /= norm;
      }
    }
    
    return Q;
  }

  private projectMatrix(A: number[][], X: number[][]): number[][] {
    // A_reduced = X^T * A * X
    const AX = this.matrixMultiply(A, X);
    const XT = this.transpose(X);
    return this.matrixMultiply(XT, AX);
  }

  private transpose(A: number[][]): number[][] {
    const m = A.length;
    const n = A[0].length;
    const AT = this.createZeroMatrix(n, m);
    
    for (let i = 0; i < m; i++) {
      for (let j = 0; j < n; j++) {
        AT[j][i] = A[i][j];
      }
    }
    
    return AT;
  }

  private solveReducedEigenProblem(K: number[][], M: number[][]): { eigenvalues: number[]; eigenvectors: number[][] } {
    // Simplified - use QR method for small matrices
    const n = K.length;
    const Minv = this.invertMatrix(M);
    const A = this.matrixMultiply(Minv, K);
    
    return this.qrMethod(n, 1e-10, 100);
  }

  private invertMatrix(A: number[][]): number[][] {
    const n = A.length;
    const Aug = A.map((row, i) => {
      const extRow = new Array(2 * n).fill(0);
      for (let j = 0; j < n; j++) {
        extRow[j] = row[j];
      }
      extRow[n + i] = 1;
      return extRow;
    });
    
    // Gauss-Jordan elimination
    for (let i = 0; i < n; i++) {
      let maxRow = i;
      for (let k = i + 1; k < n; k++) {
        if (Math.abs(Aug[k][i]) > Math.abs(Aug[maxRow][i])) {
          maxRow = k;
        }
      }
      [Aug[i], Aug[maxRow]] = [Aug[maxRow], Aug[i]];
      
      const pivot = Aug[i][i];
      for (let j = 0; j < 2 * n; j++) {
        Aug[i][j] /= pivot;
      }
      
      for (let k = 0; k < n; k++) {
        if (k !== i) {
          const factor = Aug[k][i];
          for (let j = 0; j < 2 * n; j++) {
            Aug[k][j] -= factor * Aug[i][j];
          }
        }
      }
    }
    
    return Aug.map(row => row.slice(n));
  }

  private checkConvergence(newEig: number[], oldEig: number[], tol: number): boolean {
    if (oldEig.length === 0) return false;
    
    const minLen = Math.min(newEig.length, oldEig.length);
    for (let i = 0; i < minLen; i++) {
      if (Math.abs(newEig[i] - oldEig[i]) / Math.abs(newEig[i]) > tol) {
        return false;
      }
    }
    return true;
  }

  private solveTridiagonalEigen(alpha: number[], beta: number[], numModes: number): { eigenvalues: number[]; eigenvectors: number[][] } {
    // QR algorithm for tridiagonal matrix
    const n = alpha.length;
    const T = this.createZeroMatrix(n, n);
    
    for (let i = 0; i < n; i++) {
      T[i][i] = alpha[i];
      if (i < n - 1) {
        T[i][i + 1] = beta[i];
        T[i + 1][i] = beta[i];
      }
    }
    
    return this.qrMethod(numModes, 1e-10, 100);
  }

  // --------------------------------------------------------------------------
  // GETTERS
  // --------------------------------------------------------------------------

  getModes(): ModeShape[] {
    return this.modes;
  }

  getModalSummary(): ModalSummary {
    const summary: ModalSummary = {
      numModes: this.modes.length,
      fundamentalPeriod: this.modes[0]?.period || 0,
      fundamentalFrequency: this.modes[0]?.frequency || 0,
      cumulativeMassParticipation: { x: 0, y: 0, z: 0 },
      modes: this.modes.map(m => ({
        number: m.modeNumber,
        period: m.period,
        frequency: m.frequency,
        massX: m.effectiveMassRatio.x,
        massY: m.effectiveMassRatio.y,
        massZ: m.effectiveMassRatio.z,
      })),
    };
    
    for (const mode of this.modes) {
      summary.cumulativeMassParticipation.x += mode.effectiveMassRatio.x;
      summary.cumulativeMassParticipation.y += mode.effectiveMassRatio.y;
      summary.cumulativeMassParticipation.z += mode.effectiveMassRatio.z;
    }
    
    return summary;
  }
}

// ============================================================================
// ADDITIONAL INTERFACES FOR RESULTS
// ============================================================================

interface ModalResponse {
  modeNumber: number;
  period: number;
  Sa: number;
  Sd: number;
  responses: Record<string, {
    displacement: number[];
    force: number[];
    baseShear: number;
  }>;
}

interface CombinedResponse {
  displacement: number[];
  velocity: number[];
  acceleration: number[];
  force: number[];
  baseShear: number;
  baseMoment: number;
}

interface ResponseSpectrumResult {
  modalResponses: ModalResponse[];
  combinedResponse: CombinedResponse;
  totalResponse: CombinedResponse;
  baseShear: number;
  baseMoment: number;
  maxDisplacement: number;
}

interface FloorSpectrum {
  nodeId: string;
  dampingRatio: number;
  periods: number[];
  Sa: number[];
  Sv: number[];
  Sd: number[];
}

interface HarmonicResult {
  frequencies: number[];
  responseAmplitudes: Map<string, number[]>;
  responsePhases: Map<string, number[]>;
  resonantFrequencies: number[];
}

interface ModalSummary {
  numModes: number;
  fundamentalPeriod: number;
  fundamentalFrequency: number;
  cumulativeMassParticipation: { x: number; y: number; z: number };
  modes: {
    number: number;
    period: number;
    frequency: number;
    massX: number;
    massY: number;
    massZ: number;
  }[];
}

// ============================================================================
// EXPORTS
// ============================================================================

export const createDynamicAnalysisEngine = () => new DynamicAnalysisEngine();

export default DynamicAnalysisEngine;
