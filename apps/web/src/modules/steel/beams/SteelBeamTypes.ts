/**
 * Steel Beam Design Types
 * Per AISC 360-22 Chapters E, F, G
 * 
 * Includes:
 * - Flexural design (compact, non-compact, slender)
 * - Shear design
 * - Lateral-torsional buckling
 * - Serviceability (deflection)
 */

// ============================================================================
// Enums
// ============================================================================

export enum SteelGrade {
  A36 = 'A36',               // Fy = 36 ksi
  A572_50 = 'A572_50',       // Fy = 50 ksi
  A992 = 'A992',             // Fy = 50 ksi, Fu = 65 ksi (standard for W shapes)
  A500_B = 'A500_B',         // HSS Grade B, Fy = 46 ksi
  A500_C = 'A500_C',         // HSS Grade C, Fy = 50 ksi
}

export enum BeamSectionType {
  W_SHAPE = 'W_SHAPE',
  S_SHAPE = 'S_SHAPE',
  C_SHAPE = 'C_SHAPE',
  HSS_RECT = 'HSS_RECT',
  HSS_ROUND = 'HSS_ROUND',
  WT_SHAPE = 'WT_SHAPE',
  PLATE_GIRDER = 'PLATE_GIRDER',
}

export enum CompactnessClass {
  COMPACT = 'COMPACT',
  NON_COMPACT = 'NON_COMPACT',
  SLENDER = 'SLENDER',
}

export enum LateralBracing {
  CONTINUOUSLY_BRACED = 'CONTINUOUSLY_BRACED',
  DISCRETE_BRACING = 'DISCRETE_BRACING',
  UNBRACED = 'UNBRACED',
}

export enum LoadingType {
  UNIFORM = 'UNIFORM',
  CONCENTRATED = 'CONCENTRATED',
  TRIANGULAR = 'TRIANGULAR',
  COMBINED = 'COMBINED',
}

// ============================================================================
// Interfaces - Input
// ============================================================================

export interface WShapeProperties {
  designation: string;       // e.g., 'W24X104'
  d: number;                 // Depth (in)
  bf: number;                // Flange width (in)
  tf: number;                // Flange thickness (in)
  tw: number;                // Web thickness (in)
  A: number;                 // Area (in²)
  Ix: number;                // Moment of inertia, x-axis (in⁴)
  Iy: number;                // Moment of inertia, y-axis (in⁴)
  Sx: number;                // Section modulus, x-axis (in³)
  Sy: number;                // Section modulus, y-axis (in³)
  Zx: number;                // Plastic modulus, x-axis (in³)
  Zy: number;                // Plastic modulus, y-axis (in³)
  rx: number;                // Radius of gyration, x-axis (in)
  ry: number;                // Radius of gyration, y-axis (in)
  J: number;                 // Torsional constant (in⁴)
  Cw: number;                // Warping constant (in⁶)
  rts: number;               // Effective radius of gyration for LTB (in)
  ho: number;                // Distance between flange centroids (in)
  weight: number;            // Weight per foot (lb/ft)
}

export interface SteelBeamMaterial {
  grade: SteelGrade;
  Fy: number;                // Yield strength (ksi)
  Fu: number;                // Tensile strength (ksi)
  E: number;                 // Modulus of elasticity (ksi)
  G?: number;                // Shear modulus (ksi)
}

export interface BeamGeometry {
  L: number;                 // Span length (ft)
  Lb: number;                // Unbraced length (ft)
  Cb?: number;               // Lateral-torsional buckling modification factor
  bracingType: LateralBracing;
}

export interface BeamLoads {
  Mu: number;                // Required flexural strength (kip-ft)
  Vu: number;                // Required shear strength (kips)
  loadType: LoadingType;
  
  // Service loads for deflection
  wD?: number;               // Dead load (kip/ft)
  wL?: number;               // Live load (kip/ft)
  
  // Concentrated loads
  P?: number;                // Concentrated load (kips)
  a?: number;                // Distance to load (ft)
}

export interface SteelBeamInput {
  designCode: 'AISC_360_22' | 'AISC_360_16' | 'AISC_360_10';
  designMethod: 'LRFD' | 'ASD';
  section: WShapeProperties;
  material: SteelBeamMaterial;
  geometry: BeamGeometry;
  loads: BeamLoads;
  
  // Options
  checkDeflection?: boolean;
  deflectionLimit_L?: number;  // L/xxx for total
  deflectionLimit_LL?: number; // L/xxx for live load
}

// ============================================================================
// Interfaces - Results
// ============================================================================

export interface FlexuralStrengthResult {
  Mn: number;                // Nominal flexural strength (kip-ft)
  phi_Mn: number;            // Design strength LRFD (kip-ft)
  Mn_omega: number;          // Allowable strength ASD (kip-ft)
  Mu: number;                // Required strength (kip-ft)
  ratio: number;             // Mu / φMn
  isAdequate: boolean;
  
  // Limit states
  limitState: 'YIELDING' | 'LTB_INELASTIC' | 'LTB_ELASTIC' | 'FLB' | 'WEB_LOCAL_BUCKLING';
  
  // LTB parameters
  Lp: number;                // Limiting unbraced length (plastic) (ft)
  Lr: number;                // Limiting unbraced length (inelastic) (ft)
  Lb: number;                // Unbraced length (ft)
  Cb: number;                // Moment gradient factor
  
  // Yielding strength
  Mp: number;                // Plastic moment (kip-ft)
}

export interface ShearStrengthResult {
  Vn: number;                // Nominal shear strength (kips)
  phi_Vn: number;            // Design strength LRFD (kips)
  Vn_omega: number;          // Allowable strength ASD (kips)
  Vu: number;                // Required strength (kips)
  ratio: number;
  isAdequate: boolean;
  
  // Parameters
  Cv1: number;               // Web shear coefficient
  Aw: number;                // Web area (in²)
  h_tw: number;              // Web slenderness
}

export interface CompactnessResult {
  flange: {
    class: CompactnessClass;
    lambda: number;          // bf/2tf
    lambda_p: number;        // Compact limit
    lambda_r: number;        // Non-compact limit
  };
  web: {
    class: CompactnessClass;
    lambda: number;          // h/tw
    lambda_p: number;
    lambda_r: number;
  };
}

export interface DeflectionResult {
  delta_D: number;           // Dead load deflection (in)
  delta_L: number;           // Live load deflection (in)
  delta_total: number;       // Total deflection (in)
  L_delta_total: number;     // L/Δtotal
  L_delta_L: number;         // L/ΔL
  limit_total: number;       // Allowable L/Δ
  limit_L: number;           // Allowable L/ΔL
  isAdequate: boolean;
}

export interface SteelBeamResult {
  isAdequate: boolean;
  section: string;
  
  // Material
  material: {
    grade: SteelGrade;
    Fy: number;
    Fu: number;
  };
  
  // Section properties
  compactness: CompactnessResult;
  
  // Design results
  flexure: FlexuralStrengthResult;
  shear: ShearStrengthResult;
  deflection?: DeflectionResult;
  
  // Capacity ratios
  capacityRatios: {
    flexure: number;
    shear: number;
    combined: number;
  };
  
  calculations: CalculationStep[];
  codeReference: string;
}

export interface CalculationStep {
  step: number;
  description: string;
  formula?: string;
  values?: Record<string, number | string>;
  result: number | string;
  unit?: string;
  reference?: string;
}

// ============================================================================
// Constants - Material Properties
// ============================================================================

export const STEEL_GRADES: Record<SteelGrade, { Fy: number; Fu: number }> = {
  [SteelGrade.A36]: { Fy: 36, Fu: 58 },
  [SteelGrade.A572_50]: { Fy: 50, Fu: 65 },
  [SteelGrade.A992]: { Fy: 50, Fu: 65 },
  [SteelGrade.A500_B]: { Fy: 46, Fu: 58 },
  [SteelGrade.A500_C]: { Fy: 50, Fu: 62 },
};

// ============================================================================
// Constants - Resistance Factors (AISC 360-22)
// ============================================================================

export const RESISTANCE_FACTORS = {
  phi_b: 0.90,               // Flexure
  phi_v: 1.00,               // Shear (most rolled shapes)
  phi_v_built: 0.90,         // Shear (built-up members)
  omega_b: 1.67,             // Flexure (ASD)
  omega_v: 1.50,             // Shear (ASD)
};

// ============================================================================
// Constants - Compactness Limits (AISC 360-22 Table B4.1b)
// ============================================================================

export const COMPACTNESS_LIMITS = {
  // Flanges of rolled I-shapes (Case 10)
  flange_rolled: {
    lambda_p_factor: 0.38,   // λp = 0.38√(E/Fy)
    lambda_r_factor: 1.0,    // λr = 1.0√(E/Fy)
  },
  // Webs in flexural compression (Case 15)
  web_flexure: {
    lambda_p_factor: 3.76,   // λp = 3.76√(E/Fy)
    lambda_r_factor: 5.70,   // λr = 5.70√(E/Fy)
  },
};

// ============================================================================
// Constants - Common W-Shapes (partial list)
// ============================================================================

export const W_SHAPES: Record<string, WShapeProperties> = {
  'W24X104': {
    designation: 'W24X104',
    d: 24.1, bf: 12.8, tf: 0.750, tw: 0.500,
    A: 30.6, Ix: 3100, Iy: 259, Sx: 258, Sy: 40.7,
    Zx: 289, Zy: 62.4, rx: 10.1, ry: 2.91,
    J: 4.72, Cw: 30000, rts: 3.34, ho: 23.4, weight: 104,
  },
  'W21X73': {
    designation: 'W21X73',
    d: 21.2, bf: 8.30, tf: 0.740, tw: 0.455,
    A: 21.5, Ix: 1600, Iy: 70.6, Sx: 151, Sy: 17.0,
    Zx: 172, Zy: 26.6, rx: 8.64, ry: 1.81,
    J: 2.94, Cw: 8460, rts: 2.14, ho: 20.5, weight: 73,
  },
  'W18X50': {
    designation: 'W18X50',
    d: 18.0, bf: 7.50, tf: 0.570, tw: 0.355,
    A: 14.7, Ix: 800, Iy: 40.1, Sx: 88.9, Sy: 10.7,
    Zx: 101, Zy: 16.6, rx: 7.38, ry: 1.65,
    J: 1.24, Cw: 3040, rts: 1.94, ho: 17.4, weight: 50,
  },
  'W16X40': {
    designation: 'W16X40',
    d: 16.0, bf: 7.00, tf: 0.505, tw: 0.305,
    A: 11.8, Ix: 518, Iy: 28.9, Sx: 64.7, Sy: 8.25,
    Zx: 73.0, Zy: 12.7, rx: 6.63, ry: 1.57,
    J: 0.794, Cw: 1740, rts: 1.82, ho: 15.5, weight: 40,
  },
  'W14X30': {
    designation: 'W14X30',
    d: 13.8, bf: 6.73, tf: 0.385, tw: 0.270,
    A: 8.85, Ix: 291, Iy: 19.6, Sx: 42.0, Sy: 5.82,
    Zx: 47.3, Zy: 8.99, rx: 5.73, ry: 1.49,
    J: 0.380, Cw: 887, rts: 1.70, ho: 13.4, weight: 30,
  },
  'W12X26': {
    designation: 'W12X26',
    d: 12.2, bf: 6.49, tf: 0.380, tw: 0.230,
    A: 7.65, Ix: 204, Iy: 17.3, Sx: 33.4, Sy: 5.34,
    Zx: 37.2, Zy: 8.17, rx: 5.17, ry: 1.51,
    J: 0.300, Cw: 607, rts: 1.72, ho: 11.9, weight: 26,
  },
  'W10X22': {
    designation: 'W10X22',
    d: 10.2, bf: 5.75, tf: 0.360, tw: 0.240,
    A: 6.49, Ix: 118, Iy: 11.4, Sx: 23.2, Sy: 3.97,
    Zx: 26.0, Zy: 6.10, rx: 4.27, ry: 1.33,
    J: 0.239, Cw: 313, rts: 1.51, ho: 9.88, weight: 22,
  },
};

// ============================================================================
// Constants - Cb Values for Common Cases
// ============================================================================

export const CB_VALUES = {
  uniform_moment: 1.0,
  single_curvature_linear: 1.75,
  reverse_curvature: 2.3,
  cantilever_concentrated_end: 1.0,
  cantilever_uniform: 2.0,
  simple_uniform: 1.14,
  simple_concentrated_center: 1.32,
  simple_concentrated_third_points: 1.01,
};
