/**
 * ============================================================================
 * CIVIL ENGINEERING CORE ENGINE
 * ============================================================================
 * 
 * Central calculation engine providing fundamental civil engineering computations.
 * Supports structural, geotechnical, hydraulic, and transportation calculations.
 * 
 * @version 2.0.0
 * @author Civil Engineering AI Team
 */

// =============================================================================
// TYPE DEFINITIONS
// =============================================================================

export type UnitSystem = 'SI' | 'Imperial' | 'MKS';

export interface Material {
  name: string;
  density: number;           // kg/m³
  elasticModulus: number;    // MPa
  poissonRatio: number;
  yieldStrength?: number;    // MPa
  ultimateStrength?: number; // MPa
  thermalCoeff?: number;     // per °C
}

export interface LoadCase {
  id: string;
  name: string;
  type: 'dead' | 'live' | 'wind' | 'seismic' | 'snow' | 'thermal' | 'water' | 'earth' | 'impact';
  factor: number;
  loads: Load[];
}

export interface Load {
  type: 'point' | 'distributed' | 'moment' | 'pressure' | 'temperature';
  magnitude: number;
  position?: number;
  startPosition?: number;
  endPosition?: number;
  direction?: 'x' | 'y' | 'z';
}

export interface CalculationResult {
  success: boolean;
  value: number | number[] | Record<string, number>;
  unit: string;
  description: string;
  warnings?: string[];
  details?: Record<string, any>;
}

// =============================================================================
// CONSTANTS
// =============================================================================

export const STANDARD_MATERIALS: Record<string, Material> = {
  CONCRETE_M25: {
    name: 'M25 Concrete',
    density: 2500,
    elasticModulus: 25000,
    poissonRatio: 0.2,
    yieldStrength: 25,
  },
  CONCRETE_M30: {
    name: 'M30 Concrete',
    density: 2500,
    elasticModulus: 27386,
    poissonRatio: 0.2,
    yieldStrength: 30,
  },
  CONCRETE_M35: {
    name: 'M35 Concrete',
    density: 2500,
    elasticModulus: 29580,
    poissonRatio: 0.2,
    yieldStrength: 35,
  },
  CONCRETE_M40: {
    name: 'M40 Concrete',
    density: 2500,
    elasticModulus: 31623,
    poissonRatio: 0.2,
    yieldStrength: 40,
  },
  STEEL_FE415: {
    name: 'Fe415 Steel',
    density: 7850,
    elasticModulus: 200000,
    poissonRatio: 0.3,
    yieldStrength: 415,
    ultimateStrength: 485,
  },
  STEEL_FE500: {
    name: 'Fe500 Steel',
    density: 7850,
    elasticModulus: 200000,
    poissonRatio: 0.3,
    yieldStrength: 500,
    ultimateStrength: 545,
  },
  STRUCTURAL_STEEL_E250: {
    name: 'E250 Structural Steel',
    density: 7850,
    elasticModulus: 200000,
    poissonRatio: 0.3,
    yieldStrength: 250,
    ultimateStrength: 410,
  },
  SOIL_CLAY: {
    name: 'Clay Soil',
    density: 1800,
    elasticModulus: 25,
    poissonRatio: 0.4,
  },
  SOIL_SAND: {
    name: 'Sandy Soil',
    density: 1900,
    elasticModulus: 50,
    poissonRatio: 0.3,
  },
  WATER: {
    name: 'Water',
    density: 1000,
    elasticModulus: 2200,
    poissonRatio: 0.5,
  },
  TIMBER_TEAK: {
    name: 'Teak Wood',
    density: 650,
    elasticModulus: 12500,
    poissonRatio: 0.35,
    yieldStrength: 50,
  },
  ALUMINUM_6061: {
    name: 'Aluminum 6061',
    density: 2700,
    elasticModulus: 69000,
    poissonRatio: 0.33,
    yieldStrength: 276,
    ultimateStrength: 310,
  },
};

export const PHYSICAL_CONSTANTS = {
  GRAVITY: 9.81,                    // m/s²
  WATER_DENSITY: 1000,              // kg/m³
  AIR_DENSITY: 1.225,               // kg/m³
  ATMOSPHERIC_PRESSURE: 101325,     // Pa
  STEFAN_BOLTZMANN: 5.67e-8,        // W/(m²·K⁴)
  UNIVERSAL_GAS: 8.314,             // J/(mol·K)
};

// =============================================================================
// CORE CALCULATION CLASS
// =============================================================================

export class CivilEngineeringCore {
  private unitSystem: UnitSystem;
  
  constructor(unitSystem: UnitSystem = 'SI') {
    this.unitSystem = unitSystem;
  }

  // ===========================================================================
  // UNIT CONVERSIONS
  // ===========================================================================

  /**
   * Convert length between unit systems
   */
  convertLength(value: number, from: UnitSystem, to: UnitSystem): number {
    const toMeters: Record<UnitSystem, number> = {
      'SI': 1,
      'Imperial': 0.3048,  // feet to meters
      'MKS': 1,
    };
    return value * toMeters[from] / toMeters[to];
  }

  /**
   * Convert force between unit systems
   */
  convertForce(value: number, from: UnitSystem, to: UnitSystem): number {
    const toNewtons: Record<UnitSystem, number> = {
      'SI': 1,
      'Imperial': 4.44822,  // lbf to N
      'MKS': 9.81,          // kgf to N
    };
    return value * toNewtons[from] / toNewtons[to];
  }

  /**
   * Convert pressure between unit systems
   */
  convertPressure(value: number, from: UnitSystem, to: UnitSystem): number {
    const toPascals: Record<UnitSystem, number> = {
      'SI': 1,
      'Imperial': 6894.76,  // psi to Pa
      'MKS': 9810,          // kgf/cm² to Pa
    };
    return value * toPascals[from] / toPascals[to];
  }

  // ===========================================================================
  // STRUCTURAL MECHANICS
  // ===========================================================================

  /**
   * Calculate moment of inertia for common sections
   */
  calculateMomentOfInertia(
    section: 'rectangle' | 'circle' | 'I-section' | 'T-section' | 'hollow-circle' | 'hollow-rectangle',
    dimensions: Record<string, number>
  ): CalculationResult {
    let I: number;
    
    switch (section) {
      case 'rectangle':
        // I = bh³/12
        I = (dimensions.b * Math.pow(dimensions.h, 3)) / 12;
        break;
      
      case 'circle':
        // I = πd⁴/64
        I = (Math.PI * Math.pow(dimensions.d, 4)) / 64;
        break;
      
      case 'I-section':
        // Web + 2 Flanges
        const { bf, tf, hw, tw } = dimensions;
        const Iflange = 2 * ((bf * Math.pow(tf, 3)) / 12 + bf * tf * Math.pow((hw + tf) / 2, 2));
        const Iweb = (tw * Math.pow(hw, 3)) / 12;
        I = Iflange + Iweb;
        break;
      
      case 'T-section':
        // Calculate centroid first
        const Af = dimensions.bf * dimensions.tf;
        const Aw = dimensions.tw * dimensions.hw;
        const ybar = (Af * (dimensions.hw + dimensions.tf / 2) + Aw * dimensions.hw / 2) / (Af + Aw);
        I = (dimensions.bf * Math.pow(dimensions.tf, 3)) / 12 + 
            Af * Math.pow(dimensions.hw + dimensions.tf / 2 - ybar, 2) +
            (dimensions.tw * Math.pow(dimensions.hw, 3)) / 12 +
            Aw * Math.pow(dimensions.hw / 2 - ybar, 2);
        break;
      
      case 'hollow-circle':
        // I = π(D⁴-d⁴)/64
        I = (Math.PI * (Math.pow(dimensions.D, 4) - Math.pow(dimensions.d, 4))) / 64;
        break;
      
      case 'hollow-rectangle':
        // I = (BH³-bh³)/12
        I = (dimensions.B * Math.pow(dimensions.H, 3) - dimensions.b * Math.pow(dimensions.h, 3)) / 12;
        break;
      
      default:
        return { success: false, value: 0, unit: 'mm⁴', description: 'Unknown section type' };
    }
    
    return {
      success: true,
      value: I,
      unit: 'mm⁴',
      description: `Moment of inertia for ${section}`,
    };
  }

  /**
   * Calculate section modulus
   */
  calculateSectionModulus(I: number, yMax: number): CalculationResult {
    const Z = I / yMax;
    return {
      success: true,
      value: Z,
      unit: 'mm³',
      description: 'Section modulus',
    };
  }

  /**
   * Calculate radius of gyration
   */
  calculateRadiusOfGyration(I: number, A: number): CalculationResult {
    const r = Math.sqrt(I / A);
    return {
      success: true,
      value: r,
      unit: 'mm',
      description: 'Radius of gyration',
    };
  }

  /**
   * Calculate stress using σ = My/I
   */
  calculateBendingStress(M: number, y: number, I: number): CalculationResult {
    const sigma = (M * y) / I;
    return {
      success: true,
      value: sigma,
      unit: 'MPa',
      description: 'Bending stress',
    };
  }

  /**
   * Calculate shear stress using τ = VQ/Ib
   */
  calculateShearStress(V: number, Q: number, I: number, b: number): CalculationResult {
    const tau = (V * Q) / (I * b);
    return {
      success: true,
      value: tau,
      unit: 'MPa',
      description: 'Shear stress',
    };
  }

  /**
   * Calculate deflection for common beam cases
   */
  calculateBeamDeflection(
    loadCase: 'simply-supported-center' | 'simply-supported-udl' | 'cantilever-end' | 'cantilever-udl',
    params: { P?: number; w?: number; L: number; E: number; I: number }
  ): CalculationResult {
    let delta: number;
    const { P, w, L, E, I } = params;
    
    switch (loadCase) {
      case 'simply-supported-center':
        // δ = PL³/48EI
        delta = (P! * Math.pow(L, 3)) / (48 * E * I);
        break;
      
      case 'simply-supported-udl':
        // δ = 5wL⁴/384EI
        delta = (5 * w! * Math.pow(L, 4)) / (384 * E * I);
        break;
      
      case 'cantilever-end':
        // δ = PL³/3EI
        delta = (P! * Math.pow(L, 3)) / (3 * E * I);
        break;
      
      case 'cantilever-udl':
        // δ = wL⁴/8EI
        delta = (w! * Math.pow(L, 4)) / (8 * E * I);
        break;
      
      default:
        return { success: false, value: 0, unit: 'mm', description: 'Unknown load case' };
    }
    
    return {
      success: true,
      value: delta,
      unit: 'mm',
      description: `Deflection for ${loadCase}`,
    };
  }

  /**
   * Calculate buckling load (Euler's formula)
   */
  calculateEulerBucklingLoad(E: number, I: number, Le: number): CalculationResult {
    const Pcr = (Math.PI * Math.PI * E * I) / (Le * Le);
    return {
      success: true,
      value: Pcr,
      unit: 'N',
      description: 'Critical buckling load (Euler)',
    };
  }

  /**
   * Calculate slenderness ratio
   */
  calculateSlendernessRatio(Le: number, r: number): CalculationResult {
    const lambda = Le / r;
    return {
      success: true,
      value: lambda,
      unit: '',
      description: 'Slenderness ratio',
    };
  }

  // ===========================================================================
  // LOAD COMBINATIONS
  // ===========================================================================

  /**
   * Calculate factored load combinations per IS 456
   */
  calculateLoadCombinationsIS456(
    deadLoad: number,
    liveLoad: number,
    windLoad?: number,
    seismicLoad?: number
  ): CalculationResult {
    const combinations: Record<string, number> = {};
    
    // Basic combinations
    combinations['1.5DL + 1.5LL'] = 1.5 * deadLoad + 1.5 * liveLoad;
    combinations['1.5DL + 1.5WL'] = 1.5 * deadLoad + (windLoad ? 1.5 * windLoad : 0);
    combinations['1.2DL + 1.2LL + 1.2WL'] = 1.2 * deadLoad + 1.2 * liveLoad + (windLoad ? 1.2 * windLoad : 0);
    combinations['0.9DL + 1.5WL'] = 0.9 * deadLoad + (windLoad ? 1.5 * windLoad : 0);
    
    if (seismicLoad) {
      combinations['1.5DL + 1.5EL'] = 1.5 * deadLoad + 1.5 * seismicLoad;
      combinations['1.2DL + 1.2LL + 1.2EL'] = 1.2 * deadLoad + 1.2 * liveLoad + 1.2 * seismicLoad;
      combinations['0.9DL + 1.5EL'] = 0.9 * deadLoad + 1.5 * seismicLoad;
    }
    
    const maxLoad = Math.max(...Object.values(combinations));
    
    return {
      success: true,
      value: combinations,
      unit: 'kN',
      description: 'Load combinations per IS 456',
      details: { maxFactoredLoad: maxLoad },
    };
  }

  /**
   * Calculate load combinations per ACI 318
   */
  calculateLoadCombinationsACI318(
    deadLoad: number,
    liveLoad: number,
    windLoad?: number,
    seismicLoad?: number,
    snowLoad?: number
  ): CalculationResult {
    const combinations: Record<string, number> = {};
    
    // ACI 318-19 Load Combinations
    combinations['1.4D'] = 1.4 * deadLoad;
    combinations['1.2D + 1.6L'] = 1.2 * deadLoad + 1.6 * liveLoad;
    combinations['1.2D + 1.6L + 0.5S'] = 1.2 * deadLoad + 1.6 * liveLoad + (snowLoad ? 0.5 * snowLoad : 0);
    
    if (windLoad) {
      combinations['1.2D + 1.0W + L'] = 1.2 * deadLoad + windLoad + liveLoad;
      combinations['0.9D + 1.0W'] = 0.9 * deadLoad + windLoad;
    }
    
    if (seismicLoad) {
      combinations['1.2D + 1.0E + L'] = 1.2 * deadLoad + seismicLoad + liveLoad;
      combinations['0.9D + 1.0E'] = 0.9 * deadLoad + seismicLoad;
    }
    
    const maxLoad = Math.max(...Object.values(combinations));
    
    return {
      success: true,
      value: combinations,
      unit: 'kips',
      description: 'Load combinations per ACI 318',
      details: { maxFactoredLoad: maxLoad },
    };
  }

  // ===========================================================================
  // MATERIAL PROPERTIES
  // ===========================================================================

  /**
   * Get modulus of elasticity for concrete (IS 456)
   */
  getConcreteModulusIS456(fck: number): number {
    return 5000 * Math.sqrt(fck); // MPa
  }

  /**
   * Get modulus of elasticity for concrete (ACI 318)
   */
  getConcreteModulusACI318(fc: number, wc: number = 2400): number {
    return 0.043 * Math.pow(wc, 1.5) * Math.sqrt(fc); // MPa
  }

  /**
   * Get design strength of concrete (IS 456)
   */
  getConcreteDesignStrengthIS456(fck: number): number {
    return 0.67 * fck / 1.5; // MPa (with γm = 1.5)
  }

  /**
   * Get design strength of steel (IS 456)
   */
  getSteelDesignStrengthIS456(fy: number): number {
    return 0.87 * fy; // MPa (fy/1.15)
  }
}

// =============================================================================
// MATRIX OPERATIONS FOR STRUCTURAL ANALYSIS
// =============================================================================

export class MatrixOperations {
  /**
   * Matrix multiplication
   */
  static multiply(A: number[][], B: number[][]): number[][] {
    const rowsA = A.length;
    const colsA = A[0].length;
    const colsB = B[0].length;
    
    const result: number[][] = Array(rowsA).fill(null).map(() => Array(colsB).fill(0));
    
    for (let i = 0; i < rowsA; i++) {
      for (let j = 0; j < colsB; j++) {
        for (let k = 0; k < colsA; k++) {
          result[i][j] += A[i][k] * B[k][j];
        }
      }
    }
    
    return result;
  }

  /**
   * Matrix transpose
   */
  static transpose(A: number[][]): number[][] {
    return A[0].map((_, colIndex) => A.map(row => row[colIndex]));
  }

  /**
   * Matrix inverse using Gauss-Jordan elimination
   */
  static inverse(A: number[][]): number[][] | null {
    const n = A.length;
    const augmented = A.map((row, i) => [...row, ...Array(n).fill(0).map((_, j) => (i === j ? 1 : 0))]);
    
    for (let i = 0; i < n; i++) {
      // Find pivot
      let maxRow = i;
      for (let k = i + 1; k < n; k++) {
        if (Math.abs(augmented[k][i]) > Math.abs(augmented[maxRow][i])) {
          maxRow = k;
        }
      }
      [augmented[i], augmented[maxRow]] = [augmented[maxRow], augmented[i]];
      
      if (Math.abs(augmented[i][i]) < 1e-10) return null; // Singular matrix
      
      // Scale pivot row
      const pivot = augmented[i][i];
      for (let j = 0; j < 2 * n; j++) {
        augmented[i][j] /= pivot;
      }
      
      // Eliminate column
      for (let k = 0; k < n; k++) {
        if (k !== i) {
          const factor = augmented[k][i];
          for (let j = 0; j < 2 * n; j++) {
            augmented[k][j] -= factor * augmented[i][j];
          }
        }
      }
    }
    
    return augmented.map(row => row.slice(n));
  }

  /**
   * Solve linear system Ax = b
   */
  static solve(A: number[][], b: number[]): number[] | null {
    const Ainv = this.inverse(A);
    if (!Ainv) return null;
    
    const bMatrix = b.map(val => [val]);
    const result = this.multiply(Ainv, bMatrix);
    return result.map(row => row[0]);
  }

  /**
   * Create identity matrix
   */
  static identity(n: number): number[][] {
    return Array(n).fill(null).map((_, i) => Array(n).fill(0).map((_, j) => (i === j ? 1 : 0)));
  }

  /**
   * Create zero matrix
   */
  static zeros(rows: number, cols: number): number[][] {
    return Array(rows).fill(null).map(() => Array(cols).fill(0));
  }

  /**
   * Add matrices
   */
  static add(A: number[][], B: number[][]): number[][] {
    return A.map((row, i) => row.map((val, j) => val + B[i][j]));
  }

  /**
   * Scale matrix
   */
  static scale(A: number[][], scalar: number): number[][] {
    return A.map(row => row.map(val => val * scalar));
  }

  /**
   * Calculate determinant
   */
  static determinant(A: number[][]): number {
    const n = A.length;
    if (n === 1) return A[0][0];
    if (n === 2) return A[0][0] * A[1][1] - A[0][1] * A[1][0];
    
    let det = 0;
    for (let j = 0; j < n; j++) {
      const minor = A.slice(1).map(row => [...row.slice(0, j), ...row.slice(j + 1)]);
      det += Math.pow(-1, j) * A[0][j] * this.determinant(minor);
    }
    return det;
  }
}

// =============================================================================
// NUMERICAL INTEGRATION
// =============================================================================

export class NumericalIntegration {
  /**
   * Trapezoidal rule integration
   */
  static trapezoidal(f: (x: number) => number, a: number, b: number, n: number): number {
    const h = (b - a) / n;
    let sum = 0.5 * (f(a) + f(b));
    
    for (let i = 1; i < n; i++) {
      sum += f(a + i * h);
    }
    
    return h * sum;
  }

  /**
   * Simpson's rule integration
   */
  static simpsons(f: (x: number) => number, a: number, b: number, n: number): number {
    if (n % 2 !== 0) n++; // Ensure n is even
    const h = (b - a) / n;
    let sum = f(a) + f(b);
    
    for (let i = 1; i < n; i++) {
      const coeff = i % 2 === 0 ? 2 : 4;
      sum += coeff * f(a + i * h);
    }
    
    return (h / 3) * sum;
  }

  /**
   * Gauss-Legendre quadrature (2-point)
   */
  static gaussLegendre2(f: (x: number) => number, a: number, b: number): number {
    const t1 = -1 / Math.sqrt(3);
    const t2 = 1 / Math.sqrt(3);
    
    const x1 = ((b - a) * t1 + (b + a)) / 2;
    const x2 = ((b - a) * t2 + (b + a)) / 2;
    
    return ((b - a) / 2) * (f(x1) + f(x2));
  }

  /**
   * Gauss-Legendre quadrature (3-point)
   */
  static gaussLegendre3(f: (x: number) => number, a: number, b: number): number {
    const t1 = -Math.sqrt(3/5);
    const t2 = 0;
    const t3 = Math.sqrt(3/5);
    
    const w1 = 5/9;
    const w2 = 8/9;
    const w3 = 5/9;
    
    const x1 = ((b - a) * t1 + (b + a)) / 2;
    const x2 = ((b - a) * t2 + (b + a)) / 2;
    const x3 = ((b - a) * t3 + (b + a)) / 2;
    
    return ((b - a) / 2) * (w1 * f(x1) + w2 * f(x2) + w3 * f(x3));
  }
}

// =============================================================================
// ROOT FINDING
// =============================================================================

export class RootFinding {
  /**
   * Newton-Raphson method
   */
  static newtonRaphson(
    f: (x: number) => number,
    df: (x: number) => number,
    x0: number,
    tol: number = 1e-6,
    maxIter: number = 100
  ): { root: number; iterations: number; converged: boolean } {
    let x = x0;
    
    for (let i = 0; i < maxIter; i++) {
      const fx = f(x);
      const dfx = df(x);
      
      if (Math.abs(dfx) < 1e-12) {
        return { root: x, iterations: i, converged: false };
      }
      
      const xNew = x - fx / dfx;
      
      if (Math.abs(xNew - x) < tol) {
        return { root: xNew, iterations: i + 1, converged: true };
      }
      
      x = xNew;
    }
    
    return { root: x, iterations: maxIter, converged: false };
  }

  /**
   * Bisection method
   */
  static bisection(
    f: (x: number) => number,
    a: number,
    b: number,
    tol: number = 1e-6,
    maxIter: number = 100
  ): { root: number; iterations: number; converged: boolean } {
    if (f(a) * f(b) > 0) {
      return { root: NaN, iterations: 0, converged: false };
    }
    
    for (let i = 0; i < maxIter; i++) {
      const c = (a + b) / 2;
      const fc = f(c);
      
      if (Math.abs(fc) < tol || (b - a) / 2 < tol) {
        return { root: c, iterations: i + 1, converged: true };
      }
      
      if (f(a) * fc < 0) {
        b = c;
      } else {
        a = c;
      }
    }
    
    return { root: (a + b) / 2, iterations: maxIter, converged: false };
  }

  /**
   * Secant method
   */
  static secant(
    f: (x: number) => number,
    x0: number,
    x1: number,
    tol: number = 1e-6,
    maxIter: number = 100
  ): { root: number; iterations: number; converged: boolean } {
    let xPrev = x0;
    let xCurr = x1;
    
    for (let i = 0; i < maxIter; i++) {
      const fPrev = f(xPrev);
      const fCurr = f(xCurr);
      
      if (Math.abs(fCurr - fPrev) < 1e-12) {
        return { root: xCurr, iterations: i, converged: false };
      }
      
      const xNew = xCurr - fCurr * (xCurr - xPrev) / (fCurr - fPrev);
      
      if (Math.abs(xNew - xCurr) < tol) {
        return { root: xNew, iterations: i + 1, converged: true };
      }
      
      xPrev = xCurr;
      xCurr = xNew;
    }
    
    return { root: xCurr, iterations: maxIter, converged: false };
  }
}

// Export singleton instance
export const civilCore = new CivilEngineeringCore();
export default CivilEngineeringCore;
