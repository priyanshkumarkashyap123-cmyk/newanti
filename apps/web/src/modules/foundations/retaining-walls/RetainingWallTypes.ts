/**
 * Retaining Wall Design Type Definitions
 * Per ACI 318-19, AASHTO LRFD
 * 
 * Includes:
 * - Cantilever retaining walls
 * - Gravity walls
 * - Counterfort walls
 * - Earth pressure calculations
 * - Stability checks (sliding, overturning, bearing)
 */

/**
 * Retaining wall types
 */
export enum RetainingWallType {
  CANTILEVER = 'CANTILEVER',
  GRAVITY = 'GRAVITY',
  COUNTERFORT = 'COUNTERFORT',
  BUTTRESS = 'BUTTRESS',
  MECHANICALLY_STABILIZED = 'MSE',
  SHEET_PILE = 'SHEET_PILE',
}

/**
 * Backfill slope condition
 */
export enum BackfillSlope {
  HORIZONTAL = 'HORIZONTAL',     // β = 0
  INCLINED_1V_3H = 'INCLINED_1V_3H', // β ≈ 18.4°
  INCLINED_1V_2H = 'INCLINED_1V_2H', // β ≈ 26.6°
  INCLINED_1V_1H = 'INCLINED_1V_1H', // β = 45°
}

/**
 * Wall friction angle delta
 */
export enum WallFriction {
  SMOOTH = 'SMOOTH',             // δ = 0
  CONCRETE_SOIL = 'CONCRETE_SOIL', // δ = φ/2 to 2φ/3
  ROUGH = 'ROUGH',               // δ ≈ φ
}

/**
 * Earth pressure theory
 */
export enum EarthPressureTheory {
  RANKINE = 'RANKINE',
  COULOMB = 'COULOMB',
  LOG_SPIRAL = 'LOG_SPIRAL',
}

/**
 * Calculation step for detailed output
 */
export interface CalculationStep {
  step: number;
  description: string;
  formula?: string;
  values?: Record<string, number | string>;
  result: number | string;
  unit?: string;
  reference?: string;
}

/**
 * Soil properties for backfill
 */
export interface BackfillProperties {
  gamma: number;              // Unit weight, pcf
  phi: number;                // Friction angle, degrees
  c?: number;                 // Cohesion, psf (usually 0 for backfill)
  delta?: number;             // Wall friction angle, degrees
  Ka?: number;                // Active coefficient (override)
  Kp?: number;                // Passive coefficient (override)
}

/**
 * Foundation soil properties
 */
export interface FoundationSoilProperties {
  gamma: number;              // Unit weight, pcf
  phi: number;                // Friction angle, degrees
  c?: number;                 // Cohesion, psf
  qa: number;                 // Allowable bearing capacity, psf
  mu?: number;                // Base friction coefficient
}

/**
 * Surcharge loading
 */
export interface SurchargeLoading {
  uniform?: number;           // Uniform surcharge, psf
  line?: {                    // Line load
    P: number;                // Load intensity, plf
    distance: number;         // Distance from wall, ft
  };
  strip?: {                   // Strip load
    q: number;                // Load intensity, psf
    a: number;                // Start distance from wall, ft
    b: number;                // End distance from wall, ft
  };
}

/**
 * Water conditions
 */
export interface WaterConditions {
  waterTableDepth?: number;   // Depth to water table from top of wall, ft
  drainage: 'DRAINED' | 'UNDRAINED' | 'SUBMERGED';
}

/**
 * Cantilever wall geometry
 */
export interface CantileverWallGeometry {
  H: number;                  // Total height of wall, ft
  t_stem_top: number;         // Stem thickness at top, in
  t_stem_bot: number;         // Stem thickness at bottom, in
  
  // Footing
  B: number;                  // Total footing width, ft
  t_f: number;                // Footing thickness, ft
  toe: number;                // Toe projection, ft
  heel: number;               // Heel projection, ft
  
  // Key (optional)
  keyWidth?: number;          // Key width, in
  keyDepth?: number;          // Key depth, in
  keyLocation?: number;       // Distance from toe to key, ft
  
  // Backfill slope
  backfillSlope: BackfillSlope;
  slopeAngle?: number;        // Custom slope angle, degrees
}

/**
 * Retaining wall input
 */
export interface RetainingWallInput {
  // Wall type
  wallType: RetainingWallType;
  
  // Geometry
  geometry: CantileverWallGeometry;
  
  // Soil properties
  backfill: BackfillProperties;
  foundationSoil: FoundationSoilProperties;
  
  // Loading
  surcharge?: SurchargeLoading;
  water?: WaterConditions;
  seismicCoeff?: number;      // Horizontal seismic coefficient kh
  
  // Materials
  concrete: {
    fc: number;               // Compressive strength, psi
    cover: number;            // Clear cover, in
  };
  steel: {
    fy: number;               // Yield strength, psi
  };
  
  // Design options
  designMethod: 'LRFD' | 'ASD';
  earthPressureTheory: EarthPressureTheory;
}

/**
 * Earth pressure result
 */
export interface EarthPressureResult {
  Ka: number;                 // Active coefficient
  Kp: number;                 // Passive coefficient
  K0?: number;                // At-rest coefficient
  
  Pa: number;                 // Active force, plf
  Pa_h: number;               // Horizontal component of Pa, plf
  Pa_v: number;               // Vertical component of Pa, plf
  ya: number;                 // Height of Pa from base, ft
  
  Pp?: number;                // Passive force, plf
  yp?: number;                // Height of Pp from base, ft
  
  // Surcharge induced
  Ps?: number;                // Surcharge force, plf
  ys?: number;                // Height of Ps from base, ft
  
  // Seismic
  Pae?: number;               // Seismic active force (Mononobe-Okabe), plf
}

/**
 * Stability check result
 */
export interface StabilityResult {
  // Overturning
  Mo: number;                 // Overturning moment, kip-ft/ft
  Mr: number;                 // Resisting moment, kip-ft/ft
  FS_overturning: number;     // Factor of safety (≥ 1.5 or 2.0)
  
  // Sliding
  Fh: number;                 // Horizontal driving force, kips/ft
  Fr: number;                 // Resisting friction force, kips/ft
  FS_sliding: number;         // Factor of safety (≥ 1.5)
  
  // Bearing
  q_toe: number;              // Bearing pressure at toe, psf
  q_heel: number;             // Bearing pressure at heel, psf
  q_max: number;              // Maximum bearing pressure, psf
  eccentricity: number;       // Eccentricity of resultant, ft
  B_eff: number;              // Effective width, ft
  FS_bearing: number;         // Factor of safety (≥ 3.0)
  
  // Adequacy
  isAdequate_overturning: boolean;
  isAdequate_sliding: boolean;
  isAdequate_bearing: boolean;
  isAdequate_eccentricity: boolean;
}

/**
 * Stem design result
 */
export interface StemDesignResult {
  // Critical section (at base of stem)
  Mu: number;                 // Factored moment, kip-ft/ft
  Vu: number;                 // Factored shear, kips/ft
  
  // Flexural design
  As_required: number;        // Required reinforcement, in²/ft
  As_provided: number;        // Provided reinforcement, in²/ft
  phi_Mn: number;             // Design moment strength, kip-ft/ft
  barSize: string;
  spacing: number;            // Bar spacing, in
  ratio_flexure: number;
  
  // Shear design
  phi_Vc: number;             // Design shear strength, kips/ft
  ratio_shear: number;
  
  // Min reinforcement
  As_min: number;
  As_shrinkage: number;       // Horizontal (shrinkage) steel
  
  isAdequate: boolean;
}

/**
 * Heel design result
 */
export interface HeelDesignResult {
  // Loading
  w_soil: number;             // Soil weight on heel, kips/ft²
  w_concrete: number;         // Concrete weight, kips/ft²
  w_net: number;              // Net upward pressure, kips/ft²
  
  // Design
  Mu: number;                 // Factored moment, kip-ft/ft
  Vu: number;                 // Factored shear, kips/ft
  
  As_required: number;
  As_provided: number;
  barSize: string;
  spacing: number;
  ratio: number;
  
  isAdequate: boolean;
}

/**
 * Toe design result
 */
export interface ToeDesignResult {
  // Loading
  q_avg: number;              // Average bearing pressure, psf
  
  // Design
  Mu: number;                 // Factored moment, kip-ft/ft
  Vu: number;                 // Factored shear, kips/ft
  
  As_required: number;
  As_provided: number;
  barSize: string;
  spacing: number;
  ratio: number;
  
  isAdequate: boolean;
}

/**
 * Complete retaining wall result
 */
export interface RetainingWallResult {
  isAdequate: boolean;
  wallType: RetainingWallType;
  
  // Earth pressure
  earthPressure: EarthPressureResult;
  
  // Stability
  stability: StabilityResult;
  
  // Structural design
  stem: StemDesignResult;
  heel: HeelDesignResult;
  toe: ToeDesignResult;
  
  // Summary
  governingRatio: number;
  governingCondition: string;
  
  calculations: CalculationStep[];
  codeReference: string;
}

/**
 * Earth pressure coefficients
 */
export const EARTH_PRESSURE_COEFFICIENTS = {
  // Rankine Ka = (1 - sin φ) / (1 + sin φ)
  // Rankine Kp = (1 + sin φ) / (1 - sin φ)
  
  // Typical values
  typical_Ka: {
    28: 0.361,
    30: 0.333,
    32: 0.307,
    34: 0.283,
    36: 0.260,
    38: 0.238,
    40: 0.217,
  } as Record<number, number>,
  
  typical_Kp: {
    28: 2.77,
    30: 3.00,
    32: 3.25,
    34: 3.54,
    36: 3.85,
    38: 4.20,
    40: 4.60,
  } as Record<number, number>,
};

/**
 * Minimum factors of safety (ASD)
 */
export const MINIMUM_FS = {
  overturning: 2.0,           // Against overturning
  sliding: 1.5,               // Against sliding
  bearing: 3.0,               // Against bearing failure
  eccentricity_middle_third: 6, // Resultant in middle third (e ≤ B/6)
};

/**
 * Load factors for LRFD
 */
export const RETAINING_WALL_LOAD_FACTORS = {
  gamma_EH_active: 1.50,      // Horizontal earth pressure (active)
  gamma_EH_at_rest: 1.35,     // Horizontal earth pressure (at rest)
  gamma_EV: 1.35,             // Vertical earth pressure
  gamma_DC: 1.25,             // Dead load - components
  gamma_LL_surcharge: 1.75,   // Live load surcharge
  gamma_EQ: 1.00,             // Seismic
};

/**
 * Resistance factors for LRFD
 */
export const RETAINING_WALL_RESISTANCE_FACTORS = {
  phi_bearing: 0.55,          // Bearing on soil
  phi_sliding: 0.80,          // Sliding on soil
  phi_b: 0.90,                // Flexure
  phi_v: 0.75,                // Shear
};

/**
 * Standard rebar areas
 */
export const REBAR_AREAS: Record<string, number> = {
  '#3': 0.11,
  '#4': 0.20,
  '#5': 0.31,
  '#6': 0.44,
  '#7': 0.60,
  '#8': 0.79,
  '#9': 1.00,
  '#10': 1.27,
  '#11': 1.56,
};

/**
 * Calculate Rankine Ka
 */
export function calculateKa_Rankine(phi: number, beta: number = 0): number {
  const phi_rad = phi * Math.PI / 180;
  const beta_rad = beta * Math.PI / 180;
  
  if (beta === 0) {
    return (1 - Math.sin(phi_rad)) / (1 + Math.sin(phi_rad));
  }
  
  // Inclined backfill
  const cos_beta = Math.cos(beta_rad);
  const cos_phi = Math.cos(phi_rad);
  const cos_diff = Math.sqrt(cos_beta * cos_beta - cos_phi * cos_phi);
  
  return cos_beta * (cos_beta - cos_diff) / (cos_beta + cos_diff);
}

/**
 * Calculate Rankine Kp
 */
export function calculateKp_Rankine(phi: number): number {
  const phi_rad = phi * Math.PI / 180;
  return (1 + Math.sin(phi_rad)) / (1 - Math.sin(phi_rad));
}
