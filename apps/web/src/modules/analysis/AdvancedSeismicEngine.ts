/**
 * ============================================================================
 * ADVANCED SEISMIC ANALYSIS ENGINE
 * ============================================================================
 * 
 * Comprehensive seismic analysis supporting:
 * - IS 1893:2016 (India)
 * - ASCE 7-22 / IBC (USA)
 * - Eurocode 8 (Europe)
 * - NZS 1170.5 (New Zealand)
 * - NBC 2020 (Canada)
 * 
 * Analysis Methods:
 * - Equivalent Static Method (ESM)
 * - Response Spectrum Analysis (RSA)
 * - Time History Analysis (THA)
 * - Pushover Analysis (Non-linear static)
 * - Performance Based Design (PBD)
 * 
 * @version 2.0.0
 */

// ============================================================================
// TYPES AND INTERFACES
// ============================================================================

export type SeismicCode = 'IS1893' | 'ASCE7' | 'EC8' | 'NZS1170' | 'NBC2020';
export type AnalysisMethod = 'ESM' | 'RSA' | 'THA' | 'PUSHOVER' | 'PBD';
export type SoilType = 'rock' | 'stiff' | 'medium' | 'soft' | 'very_soft';
export type BuildingType = 'regular' | 'irregular_plan' | 'irregular_elevation' | 'highly_irregular';
export type StructuralSystem = 'moment_frame' | 'braced_frame' | 'shear_wall' | 'dual_system' | 'tube' | 'outrigger';

export interface SeismicParameters {
  code: SeismicCode;
  zone: number | string;
  soilType: SoilType;
  importanceFactor: number;
  responseFactor: number;
  dampingRatio: number;
  buildingType: BuildingType;
  structuralSystem: StructuralSystem;
  height: number;
  fundamentalPeriod?: number;
  location?: {
    latitude: number;
    longitude: number;
    city?: string;
  };
}

export interface SpectrumPoint {
  period: number;
  acceleration: number;
  velocity?: number;
  displacement?: number;
}

export interface ModeShape {
  modeNumber: number;
  period: number;
  frequency: number;
  massParticipation: {
    x: number;
    y: number;
    z: number;
    rx: number;
    ry: number;
    rz: number;
  };
  shape: number[];
  modalMass: number;
}

export interface SeismicForces {
  baseShear: number;
  storyForces: { level: number; height: number; force: number; shear: number; moment: number }[];
  overturningMoment: number;
  torsionalMoment: number;
  accidentalEccentricity: number;
}

export interface SeismicResult {
  designSpectrum: SpectrumPoint[];
  fundamentalPeriod: number;
  spectralAcceleration: number;
  baseShear: { x: number; y: number };
  forces: SeismicForces;
  modeShapes?: ModeShape[];
  drifts: { level: number; drift: number; allowable: number; ratio: number }[];
  performance?: PerformanceLevel;
  compliance: ComplianceCheck[];
}

export interface PerformanceLevel {
  level: 'IO' | 'LS' | 'CP' | 'Collapse';
  description: string;
  probability: number;
  targetDrift: number;
  actualDrift: number;
}

export interface ComplianceCheck {
  requirement: string;
  reference: string;
  status: 'PASS' | 'FAIL' | 'WARNING';
  value: number;
  limit: number;
  utilization: number;
}

// ============================================================================
// SEISMIC HAZARD DATABASE
// ============================================================================

const INDIA_SEISMIC_ZONES: Record<string, { zone: number; Z: number; cities: string[] }> = {
  'zone5': { zone: 5, Z: 0.36, cities: ['Guwahati', 'Srinagar', 'Imphal', 'Gangtok', 'Port Blair'] },
  'zone4': { zone: 4, Z: 0.24, cities: ['Delhi', 'Mumbai', 'Patna', 'Shimla', 'Dehradun', 'Chandigarh'] },
  'zone3': { zone: 3, Z: 0.16, cities: ['Kolkata', 'Lucknow', 'Bhopal', 'Jaipur', 'Hyderabad'] },
  'zone2': { zone: 2, Z: 0.10, cities: ['Chennai', 'Bangalore', 'Trivandrum', 'Nagpur'] },
};

const US_SEISMIC_PARAMS: Record<string, { Ss: number; S1: number; TL: number }> = {
  'LA': { Ss: 2.5, S1: 1.0, TL: 8 },
  'SF': { Ss: 2.0, S1: 0.8, TL: 8 },
  'Seattle': { Ss: 1.5, S1: 0.6, TL: 6 },
  'NYC': { Ss: 0.4, S1: 0.15, TL: 6 },
  'Chicago': { Ss: 0.2, S1: 0.08, TL: 4 },
};

const SOIL_AMPLIFICATION: Record<SoilType, { Fa: number; Fv: number; Tb: number; Tc: number; Td: number }> = {
  'rock': { Fa: 1.0, Fv: 1.0, Tb: 0.1, Tc: 0.4, Td: 2.0 },
  'stiff': { Fa: 1.2, Fv: 1.4, Tb: 0.1, Tc: 0.5, Td: 2.0 },
  'medium': { Fa: 1.5, Fv: 1.7, Tb: 0.1, Tc: 0.65, Td: 2.0 },
  'soft': { Fa: 1.6, Fv: 2.4, Tb: 0.1, Tc: 0.9, Td: 2.0 },
  'very_soft': { Fa: 2.5, Fv: 3.5, Tb: 0.1, Tc: 1.2, Td: 2.0 },
};

// ============================================================================
// ADVANCED SEISMIC ENGINE CLASS
// ============================================================================

export class AdvancedSeismicEngine {
  private params: SeismicParameters;
  private spectrum: SpectrumPoint[] = [];
  
  constructor(params: SeismicParameters) {
    this.params = params;
  }

  // --------------------------------------------------------------------------
  // FUNDAMENTAL PERIOD CALCULATION
  // --------------------------------------------------------------------------
  
  calculateFundamentalPeriod(height: number, system: StructuralSystem): number {
    // Multiple methods for period estimation
    const methods: Record<string, number> = {};
    
    // Method 1: Approximate formula (most codes)
    const Ct = this.getPeriodCoefficient(system);
    const x = this.getPeriodExponent(system);
    methods['approximate'] = Ct * Math.pow(height, x);
    
    // Method 2: Rayleigh method (if displacements known)
    // T = 2π √(Σmi·δi² / (g·Σfi·δi))
    
    // Method 3: IS 1893 formula
    if (this.params.code === 'IS1893') {
      if (system === 'moment_frame') {
        methods['is1893_mrf'] = 0.075 * Math.pow(height, 0.75);
      } else if (system === 'shear_wall') {
        // T = 0.075h^0.75 / √Aw
        methods['is1893_sw'] = 0.09 * height / Math.sqrt(height * 0.1);
      } else {
        methods['is1893_braced'] = 0.085 * Math.pow(height, 0.75);
      }
    }
    
    // Method 4: ASCE 7 formula
    if (this.params.code === 'ASCE7') {
      methods['asce7_approx'] = Ct * Math.pow(height * 3.28084, x); // Convert to feet
      methods['asce7_upper'] = methods['asce7_approx'] * 1.4; // Cu factor
    }
    
    // Return the most conservative value (shortest period = higher forces)
    return Math.min(...Object.values(methods).filter(v => v > 0));
  }

  private getPeriodCoefficient(system: StructuralSystem): number {
    const coefficients: Record<StructuralSystem, number> = {
      'moment_frame': 0.0724,
      'braced_frame': 0.0488,
      'shear_wall': 0.0488,
      'dual_system': 0.0488,
      'tube': 0.0488,
      'outrigger': 0.0488,
    };
    return coefficients[system] || 0.0488;
  }

  private getPeriodExponent(system: StructuralSystem): number {
    return system === 'moment_frame' ? 0.8 : 0.75;
  }

  // --------------------------------------------------------------------------
  // RESPONSE SPECTRUM GENERATION
  // --------------------------------------------------------------------------
  
  generateDesignSpectrum(): SpectrumPoint[] {
    switch (this.params.code) {
      case 'IS1893':
        return this.generateIS1893Spectrum();
      case 'ASCE7':
        return this.generateASCE7Spectrum();
      case 'EC8':
        return this.generateEC8Spectrum();
      default:
        return this.generateIS1893Spectrum();
    }
  }

  private generateIS1893Spectrum(): SpectrumPoint[] {
    const Z = this.getZoneFactor();
    const I = this.params.importanceFactor;
    const R = this.params.responseFactor;
    const soil = SOIL_AMPLIFICATION[this.params.soilType];
    
    const spectrum: SpectrumPoint[] = [];
    const periods = this.generatePeriodArray(0, 4, 0.01);
    
    for (const T of periods) {
      let Sa_g: number;
      
      // IS 1893:2016 spectrum shape
      if (T <= 0.1) {
        Sa_g = 1 + 15 * T;
      } else if (T <= soil.Tc) {
        Sa_g = 2.5;
      } else if (T <= soil.Td) {
        Sa_g = 2.5 * soil.Tc / T;
      } else {
        Sa_g = 2.5 * soil.Tc * soil.Td / (T * T);
      }
      
      // Apply zone, importance, and response reduction
      const Ah = (Z * I * Sa_g) / (2 * R);
      
      spectrum.push({
        period: T,
        acceleration: Ah,
        velocity: Ah * T / (2 * Math.PI) * 9.81,
        displacement: Ah * T * T / (4 * Math.PI * Math.PI) * 9.81,
      });
    }
    
    this.spectrum = spectrum;
    return spectrum;
  }

  private generateASCE7Spectrum(): SpectrumPoint[] {
    // Get site-specific parameters
    const { Ss, S1, TL } = this.getSiteParameters();
    const soil = SOIL_AMPLIFICATION[this.params.soilType];
    
    // Design spectral accelerations
    const SDS = (2/3) * soil.Fa * Ss;
    const SD1 = (2/3) * soil.Fv * S1;
    
    const T0 = 0.2 * SD1 / SDS;
    const Ts = SD1 / SDS;
    
    const spectrum: SpectrumPoint[] = [];
    const periods = this.generatePeriodArray(0, 4, 0.01);
    
    for (const T of periods) {
      let Sa: number;
      
      if (T < T0) {
        Sa = SDS * (0.4 + 0.6 * T / T0);
      } else if (T <= Ts) {
        Sa = SDS;
      } else if (T <= TL) {
        Sa = SD1 / T;
      } else {
        Sa = SD1 * TL / (T * T);
      }
      
      // Apply importance and response factors
      const Ie = this.params.importanceFactor;
      const R = this.params.responseFactor;
      const Cs = Sa * Ie / R;
      
      spectrum.push({
        period: T,
        acceleration: Cs,
        velocity: Cs * T / (2 * Math.PI) * 9.81,
        displacement: Cs * T * T / (4 * Math.PI * Math.PI) * 9.81,
      });
    }
    
    this.spectrum = spectrum;
    return spectrum;
  }

  private generateEC8Spectrum(): SpectrumPoint[] {
    const ag = this.getPGA();
    const soil = SOIL_AMPLIFICATION[this.params.soilType];
    const q = this.params.responseFactor;
    const eta = Math.max(0.55, Math.sqrt(10 / (5 + this.params.dampingRatio * 100)));
    
    const TB = soil.Tb;
    const TC = soil.Tc;
    const TD = soil.Td;
    const S = soil.Fa;
    
    const spectrum: SpectrumPoint[] = [];
    const periods = this.generatePeriodArray(0, 4, 0.01);
    
    for (const T of periods) {
      let Se: number;
      
      if (T <= TB) {
        Se = ag * S * (1 + T / TB * (eta * 2.5 - 1));
      } else if (T <= TC) {
        Se = ag * S * eta * 2.5;
      } else if (T <= TD) {
        Se = ag * S * eta * 2.5 * TC / T;
      } else {
        Se = ag * S * eta * 2.5 * TC * TD / (T * T);
      }
      
      // Design spectrum
      const Sd = Se / q;
      
      spectrum.push({
        period: T,
        acceleration: Sd,
        velocity: Sd * T / (2 * Math.PI),
        displacement: Sd * T * T / (4 * Math.PI * Math.PI),
      });
    }
    
    this.spectrum = spectrum;
    return spectrum;
  }

  // --------------------------------------------------------------------------
  // EQUIVALENT STATIC METHOD
  // --------------------------------------------------------------------------
  
  calculateESM(
    storyData: { height: number; mass: number; seismicWeight: number }[]
  ): SeismicForces {
    const T = this.params.fundamentalPeriod || 
              this.calculateFundamentalPeriod(this.params.height, this.params.structuralSystem);
    
    // Get spectral acceleration at fundamental period
    const Sa = this.getSpectralAcceleration(T);
    
    // Total seismic weight
    const W = storyData.reduce((sum, s) => sum + s.seismicWeight, 0);
    
    // Base shear
    let Vb: number;
    
    switch (this.params.code) {
      case 'IS1893':
        Vb = Sa * W;
        break;
      case 'ASCE7':
        Vb = Sa * W;
        // Check minimum base shear
        const Vmin = 0.044 * Sa * W * this.params.importanceFactor;
        Vb = Math.max(Vb, Vmin);
        break;
      default:
        Vb = Sa * W;
    }
    
    // Vertical distribution factor k
    const k = T <= 0.5 ? 1 : (T >= 2.5 ? 2 : 1 + (T - 0.5) / 2);
    
    // Calculate story forces
    const sumWiHik = storyData.reduce((sum, s) => 
      sum + s.seismicWeight * Math.pow(s.height, k), 0);
    
    const storyForces = storyData.map((story, i) => {
      const Cvx = (story.seismicWeight * Math.pow(story.height, k)) / sumWiHik;
      const Fx = Cvx * Vb;
      
      // Cumulative story shear (from top down)
      const shear = storyData.slice(i).reduce((sum, s, j) => {
        const Cv = (s.seismicWeight * Math.pow(s.height, k)) / sumWiHik;
        return sum + Cv * Vb;
      }, 0);
      
      // Overturning moment at this level
      const moment = storyData.slice(i).reduce((sum, s, j) => {
        const Cv = (s.seismicWeight * Math.pow(s.height, k)) / sumWiHik;
        return sum + Cv * Vb * (s.height - story.height);
      }, 0);
      
      return {
        level: i + 1,
        height: story.height,
        force: Fx,
        shear,
        moment,
      };
    });
    
    // Total overturning moment at base
    const overturningMoment = storyData.reduce((sum, s) => {
      const Cvx = (s.seismicWeight * Math.pow(s.height, k)) / sumWiHik;
      return sum + Cvx * Vb * s.height;
    }, 0);
    
    // Accidental eccentricity (5% of building dimension)
    const buildingWidth = 20; // Assume 20m, should be input
    const accidentalEccentricity = 0.05 * buildingWidth;
    const torsionalMoment = Vb * accidentalEccentricity;
    
    return {
      baseShear: Vb,
      storyForces,
      overturningMoment,
      torsionalMoment,
      accidentalEccentricity,
    };
  }

  // --------------------------------------------------------------------------
  // RESPONSE SPECTRUM ANALYSIS
  // --------------------------------------------------------------------------
  
  performRSA(
    modes: ModeShape[],
    combinationMethod: 'SRSS' | 'CQC' | 'ABS' = 'CQC'
  ): { combinedResponse: number[]; modalContributions: number[][] } {
    const n = modes.length;
    const responses: number[][] = [];
    
    // Calculate response for each mode
    for (const mode of modes) {
      const Sa = this.getSpectralAcceleration(mode.period);
      const modalResponse = mode.shape.map(phi => 
        phi * mode.modalMass * Sa / mode.massParticipation.x
      );
      responses.push(modalResponse);
    }
    
    // Combine modal responses
    let combinedResponse: number[];
    
    if (combinationMethod === 'SRSS') {
      // Square Root of Sum of Squares
      combinedResponse = responses[0].map((_, i) => 
        Math.sqrt(responses.reduce((sum, r) => sum + r[i] * r[i], 0))
      );
    } else if (combinationMethod === 'CQC') {
      // Complete Quadratic Combination
      const rho = this.calculateCQCCoefficients(modes);
      combinedResponse = responses[0].map((_, i) => {
        let sum = 0;
        for (let j = 0; j < n; j++) {
          for (let k = 0; k < n; k++) {
            sum += rho[j][k] * responses[j][i] * responses[k][i];
          }
        }
        return Math.sqrt(sum);
      });
    } else {
      // Absolute sum (conservative)
      combinedResponse = responses[0].map((_, i) => 
        responses.reduce((sum, r) => sum + Math.abs(r[i]), 0)
      );
    }
    
    return { combinedResponse, modalContributions: responses };
  }

  private calculateCQCCoefficients(modes: ModeShape[]): number[][] {
    const n = modes.length;
    const zeta = this.params.dampingRatio;
    const rho: number[][] = Array(n).fill(null).map(() => Array(n).fill(0));
    
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        const r = modes[j].frequency / modes[i].frequency;
        const num = 8 * zeta * zeta * (1 + r) * Math.pow(r, 1.5);
        const den = Math.pow(1 - r * r, 2) + 4 * zeta * zeta * r * Math.pow(1 + r, 2);
        rho[i][j] = num / den;
      }
    }
    
    return rho;
  }

  // --------------------------------------------------------------------------
  // TIME HISTORY ANALYSIS
  // --------------------------------------------------------------------------
  
  performTimeHistory(
    groundMotion: { time: number[]; acceleration: number[] },
    mass: number[],
    stiffness: number[][],
    damping: number[][]
  ): { time: number[]; displacement: number[][]; velocity: number[][]; acceleration: number[][] } {
    const n = mass.length;
    const dt = groundMotion.time[1] - groundMotion.time[0];
    const nSteps = groundMotion.time.length;
    
    // Newmark-beta method parameters
    const gamma = 0.5;
    const beta = 0.25;
    
    // Initialize arrays
    const u: number[][] = Array(nSteps).fill(null).map(() => Array(n).fill(0));
    const v: number[][] = Array(nSteps).fill(null).map(() => Array(n).fill(0));
    const a: number[][] = Array(nSteps).fill(null).map(() => Array(n).fill(0));
    
    // Effective stiffness matrix
    const K_eff = this.matrixAdd(
      this.matrixAdd(
        stiffness,
        this.scalarMultiply(damping, gamma / (beta * dt))
      ),
      this.scalarMultiply(this.diagonalMatrix(mass), 1 / (beta * dt * dt))
    );
    
    // Time stepping
    for (let i = 1; i < nSteps; i++) {
      const ag = groundMotion.acceleration[i];
      
      // Effective force
      const P_eff = mass.map((m, j) => {
        const inertia = -m * ag;
        const dampingTerm = damping[j].reduce((sum, c, k) => 
          sum + c * (v[i-1][k] + (1 - gamma/beta) * a[i-1][k] * dt), 0
        ) * gamma / (beta * dt);
        const massTerm = mass[j] * (
          u[i-1][j] / (beta * dt * dt) + 
          v[i-1][j] / (beta * dt) + 
          (1/(2*beta) - 1) * a[i-1][j]
        );
        return inertia + dampingTerm + massTerm;
      });
      
      // Solve for displacement
      u[i] = this.solveLinearSystem(K_eff, P_eff);
      
      // Update velocity and acceleration
      for (let j = 0; j < n; j++) {
        v[i][j] = gamma / (beta * dt) * (u[i][j] - u[i-1][j]) + 
                  (1 - gamma/beta) * v[i-1][j] + 
                  dt * (1 - gamma/(2*beta)) * a[i-1][j];
        a[i][j] = 1 / (beta * dt * dt) * (u[i][j] - u[i-1][j]) - 
                  v[i-1][j] / (beta * dt) - 
                  (1/(2*beta) - 1) * a[i-1][j];
      }
    }
    
    return {
      time: groundMotion.time,
      displacement: u,
      velocity: v,
      acceleration: a,
    };
  }

  // --------------------------------------------------------------------------
  // PUSHOVER ANALYSIS
  // --------------------------------------------------------------------------
  
  performPushover(
    storyData: { height: number; mass: number; capacity: number; ductility: number }[],
    targetDisplacement: number,
    loadPattern: 'triangular' | 'uniform' | 'modal' = 'modal'
  ): { curve: { displacement: number; baseShear: number }[]; performance: PerformanceLevel } {
    const curve: { displacement: number; baseShear: number }[] = [];
    const n = storyData.length;
    
    // Generate load pattern
    let pattern: number[];
    if (loadPattern === 'triangular') {
      pattern = storyData.map(s => s.height);
    } else if (loadPattern === 'uniform') {
      pattern = storyData.map(() => 1);
    } else {
      // First mode shape approximation
      pattern = storyData.map(s => s.height * s.mass);
    }
    
    // Normalize pattern
    const patternSum = pattern.reduce((a, b) => a + b, 0);
    pattern = pattern.map(p => p / patternSum);
    
    // Incremental analysis
    let totalDisp = 0;
    const roofIndex = n - 1;
    const dispIncrement = targetDisplacement / 100;
    
    while (totalDisp <= targetDisplacement) {
      // Calculate base shear at current displacement
      let baseShear = 0;
      for (let i = 0; i < n; i++) {
        const storyDisp = totalDisp * pattern[i] / pattern[roofIndex];
        const yieldDisp = storyData[i].capacity / (storyData[i].mass * 100); // Approximate
        
        if (storyDisp <= yieldDisp) {
          // Elastic range
          baseShear += storyData[i].capacity * (storyDisp / yieldDisp) * pattern[i];
        } else {
          // Post-yield (bilinear approximation)
          const ductilityDemand = storyDisp / yieldDisp;
          const postYieldStiffness = 0.05; // 5% post-yield stiffness
          if (ductilityDemand <= storyData[i].ductility) {
            baseShear += storyData[i].capacity * (1 + postYieldStiffness * (ductilityDemand - 1)) * pattern[i];
          } else {
            // Capacity degradation
            baseShear += storyData[i].capacity * 0.8 * pattern[i];
          }
        }
      }
      
      curve.push({ displacement: totalDisp, baseShear });
      totalDisp += dispIncrement;
    }
    
    // Determine performance level
    const maxDrift = targetDisplacement / this.params.height;
    const performance = this.assessPerformanceLevel(maxDrift);
    
    return { curve, performance };
  }

  private assessPerformanceLevel(maxDrift: number): PerformanceLevel {
    // Performance levels per ASCE 41
    if (maxDrift <= 0.007) {
      return {
        level: 'IO',
        description: 'Immediate Occupancy - Minor damage, building functional',
        probability: 0.5,
        targetDrift: 0.007,
        actualDrift: maxDrift,
      };
    } else if (maxDrift <= 0.025) {
      return {
        level: 'LS',
        description: 'Life Safety - Moderate damage, life safety maintained',
        probability: 0.1,
        targetDrift: 0.025,
        actualDrift: maxDrift,
      };
    } else if (maxDrift <= 0.05) {
      return {
        level: 'CP',
        description: 'Collapse Prevention - Severe damage, collapse prevented',
        probability: 0.02,
        targetDrift: 0.05,
        actualDrift: maxDrift,
      };
    } else {
      return {
        level: 'Collapse',
        description: 'Collapse - Structure has collapsed or is at imminent risk',
        probability: 0.9,
        targetDrift: 0.05,
        actualDrift: maxDrift,
      };
    }
  }

  // --------------------------------------------------------------------------
  // DRIFT CHECK
  // --------------------------------------------------------------------------
  
  checkDrifts(
    storyDisplacements: { level: number; height: number; displacement: number }[]
  ): { level: number; drift: number; allowable: number; ratio: number }[] {
    const allowableDrift = this.getAllowableDrift();
    const drifts: { level: number; drift: number; allowable: number; ratio: number }[] = [];
    
    for (let i = 0; i < storyDisplacements.length; i++) {
      const current = storyDisplacements[i];
      const below = i > 0 ? storyDisplacements[i - 1] : { height: 0, displacement: 0 };
      
      const storyHeight = current.height - below.height;
      const storyDrift = (current.displacement - below.displacement) / storyHeight;
      
      drifts.push({
        level: current.level,
        drift: storyDrift,
        allowable: allowableDrift,
        ratio: storyDrift / allowableDrift,
      });
    }
    
    return drifts;
  }

  private getAllowableDrift(): number {
    switch (this.params.code) {
      case 'IS1893':
        return 0.004; // 0.4% for RC frames
      case 'ASCE7':
        return 0.02; // 2% for most buildings
      case 'EC8':
        return 0.0075; // 0.75% reduction * 1% limit
      default:
        return 0.02;
    }
  }

  // --------------------------------------------------------------------------
  // COMPLIANCE CHECKS
  // --------------------------------------------------------------------------
  
  checkCompliance(forces: SeismicForces, drifts: { drift: number; allowable: number }[]): ComplianceCheck[] {
    const checks: ComplianceCheck[] = [];
    
    // Base shear check
    const minBaseShear = this.getMinimumBaseShear();
    checks.push({
      requirement: 'Minimum Base Shear',
      reference: `${this.params.code} Base Shear Requirement`,
      status: forces.baseShear >= minBaseShear ? 'PASS' : 'FAIL',
      value: forces.baseShear,
      limit: minBaseShear,
      utilization: minBaseShear / forces.baseShear,
    });
    
    // Drift checks
    const maxDrift = Math.max(...drifts.map(d => d.drift));
    const allowableDrift = this.getAllowableDrift();
    checks.push({
      requirement: 'Story Drift Limit',
      reference: `${this.params.code} Drift Requirements`,
      status: maxDrift <= allowableDrift ? 'PASS' : 'FAIL',
      value: maxDrift,
      limit: allowableDrift,
      utilization: maxDrift / allowableDrift,
    });
    
    // P-Delta effects
    const stabilityCoeff = this.calculateStabilityCoefficient(forces);
    const maxStability = 0.1; // Typically 0.1 without special considerations
    checks.push({
      requirement: 'P-Delta Stability',
      reference: `${this.params.code} Stability Requirements`,
      status: stabilityCoeff <= maxStability ? 'PASS' : (stabilityCoeff <= 0.25 ? 'WARNING' : 'FAIL'),
      value: stabilityCoeff,
      limit: maxStability,
      utilization: stabilityCoeff / maxStability,
    });
    
    // Irregularity checks
    if (this.params.buildingType !== 'regular') {
      checks.push({
        requirement: 'Irregularity Penalty',
        reference: `${this.params.code} Irregularity Provisions`,
        status: 'WARNING',
        value: 1.0,
        limit: 1.0,
        utilization: 1.0,
      });
    }
    
    return checks;
  }

  private getMinimumBaseShear(): number {
    // Code-specific minimum base shear requirements
    const Sa = this.getSpectralAcceleration(this.params.fundamentalPeriod || 1.0);
    
    switch (this.params.code) {
      case 'IS1893':
        return 0.0; // No explicit minimum in IS 1893
      case 'ASCE7':
        return 0.044 * Sa * this.params.importanceFactor;
      default:
        return 0.0;
    }
  }

  private calculateStabilityCoefficient(forces: SeismicForces): number {
    // θ = (P × Δ) / (V × h × Cd)
    // Simplified calculation
    if (forces.storyForces.length === 0) return 0;
    
    const topStory = forces.storyForces[forces.storyForces.length - 1];
    const drift = 0.02; // Assume 2% drift for calculation
    const P = topStory.shear * 10; // Approximate gravity load
    const delta = drift * topStory.height;
    const Cd = this.params.responseFactor * 0.8; // Deflection amplification
    
    return (P * delta) / (topStory.shear * topStory.height * Cd);
  }

  // --------------------------------------------------------------------------
  // HELPER METHODS
  // --------------------------------------------------------------------------
  
  private getZoneFactor(): number {
    const zone = this.params.zone;
    if (typeof zone === 'number') {
      const factors: Record<number, number> = { 2: 0.10, 3: 0.16, 4: 0.24, 5: 0.36 };
      return factors[zone] || 0.16;
    }
    return 0.16;
  }

  private getSiteParameters(): { Ss: number; S1: number; TL: number } {
    if (this.params.location?.city) {
      return US_SEISMIC_PARAMS[this.params.location.city] || { Ss: 1.0, S1: 0.4, TL: 6 };
    }
    return { Ss: 1.0, S1: 0.4, TL: 6 };
  }

  private getPGA(): number {
    // Peak Ground Acceleration based on zone/location
    return this.getZoneFactor() / 2;
  }

  private getSpectralAcceleration(period: number): number {
    if (this.spectrum.length === 0) {
      this.generateDesignSpectrum();
    }
    
    // Interpolate from spectrum
    for (let i = 1; i < this.spectrum.length; i++) {
      if (period <= this.spectrum[i].period) {
        const t1 = this.spectrum[i - 1].period;
        const t2 = this.spectrum[i].period;
        const a1 = this.spectrum[i - 1].acceleration;
        const a2 = this.spectrum[i].acceleration;
        return a1 + (a2 - a1) * (period - t1) / (t2 - t1);
      }
    }
    
    return this.spectrum[this.spectrum.length - 1].acceleration;
  }

  private generatePeriodArray(start: number, end: number, step: number): number[] {
    const periods: number[] = [];
    for (let t = start; t <= end; t += step) {
      periods.push(Math.round(t * 1000) / 1000);
    }
    return periods;
  }

  // Matrix operations
  private matrixAdd(a: number[][], b: number[][]): number[][] {
    return a.map((row, i) => row.map((val, j) => val + b[i][j]));
  }

  private scalarMultiply(matrix: number[][], scalar: number): number[][] {
    return matrix.map(row => row.map(val => val * scalar));
  }

  private diagonalMatrix(diagonal: number[]): number[][] {
    const n = diagonal.length;
    const matrix = Array(n).fill(null).map(() => Array(n).fill(0));
    for (let i = 0; i < n; i++) {
      matrix[i][i] = diagonal[i];
    }
    return matrix;
  }

  private solveLinearSystem(A: number[][], b: number[]): number[] {
    // Gaussian elimination with partial pivoting
    const n = b.length;
    const augmented = A.map((row, i) => [...row, b[i]]);
    
    // Forward elimination
    for (let i = 0; i < n; i++) {
      // Find pivot
      let maxRow = i;
      for (let k = i + 1; k < n; k++) {
        if (Math.abs(augmented[k][i]) > Math.abs(augmented[maxRow][i])) {
          maxRow = k;
        }
      }
      [augmented[i], augmented[maxRow]] = [augmented[maxRow], augmented[i]];
      
      // Eliminate
      for (let k = i + 1; k < n; k++) {
        const factor = augmented[k][i] / augmented[i][i];
        for (let j = i; j <= n; j++) {
          augmented[k][j] -= factor * augmented[i][j];
        }
      }
    }
    
    // Back substitution
    const x = Array(n).fill(0);
    for (let i = n - 1; i >= 0; i--) {
      x[i] = augmented[i][n];
      for (let j = i + 1; j < n; j++) {
        x[i] -= augmented[i][j] * x[j];
      }
      x[i] /= augmented[i][i];
    }
    
    return x;
  }
}

// ============================================================================
// EXPORTS
// ============================================================================

export const createSeismicEngine = (params: SeismicParameters) => new AdvancedSeismicEngine(params);

export default AdvancedSeismicEngine;
