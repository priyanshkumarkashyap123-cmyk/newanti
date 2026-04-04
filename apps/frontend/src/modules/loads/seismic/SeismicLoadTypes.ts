/**
 * Seismic Load Types
 * Per ASCE 7-22 Chapters 11-12
 * 
 * Includes:
 * - Equivalent Lateral Force (ELF) Procedure
 * - Seismic Design Category determination
 * - Response modification factors
 * - Vertical distribution of forces
 */

// ============================================================================
// Enums
// ============================================================================

export enum SiteClass {
  A = 'A',           // Hard rock
  B = 'B',           // Rock
  BC = 'BC',         // Soft rock
  C = 'C',           // Very dense soil
  CD = 'CD',         // Dense soil
  D = 'D',           // Stiff soil (default)
  DE = 'DE',         // Soft stiff soil
  E = 'E',           // Soft soil
  F = 'F',           // Site-specific required
}

export enum RiskCategory {
  I = 'I',           // Low hazard
  II = 'II',         // Standard
  III = 'III',       // Substantial hazard
  IV = 'IV',         // Essential facilities
}

export enum SeismicDesignCategory {
  A = 'A',
  B = 'B',
  C = 'C',
  D = 'D',
  D0 = 'D0',
  D1 = 'D1',
  D2 = 'D2',
  E = 'E',
  F = 'F',
}

export enum StructuralSystem {
  // Bearing Wall Systems
  SPECIAL_RC_SHEAR_WALL = 'SPECIAL_RC_SHEAR_WALL',
  ORDINARY_RC_SHEAR_WALL = 'ORDINARY_RC_SHEAR_WALL',
  SPECIAL_MASONRY_SHEAR_WALL = 'SPECIAL_MASONRY_SHEAR_WALL',
  
  // Building Frame Systems
  STEEL_ECCENTRICALLY_BRACED = 'STEEL_ECCENTRICALLY_BRACED',
  STEEL_SPECIAL_CONC_BRACED = 'STEEL_SPECIAL_CONC_BRACED',
  STEEL_ORDINARY_CONC_BRACED = 'STEEL_ORDINARY_CONC_BRACED',
  SPECIAL_RC_SHEAR_WALL_FRAME = 'SPECIAL_RC_SHEAR_WALL_FRAME',
  
  // Moment Frame Systems
  STEEL_SPECIAL_MOMENT_FRAME = 'STEEL_SPECIAL_MOMENT_FRAME',
  STEEL_INTERMEDIATE_MOMENT_FRAME = 'STEEL_INTERMEDIATE_MOMENT_FRAME',
  STEEL_ORDINARY_MOMENT_FRAME = 'STEEL_ORDINARY_MOMENT_FRAME',
  SPECIAL_RC_MOMENT_FRAME = 'SPECIAL_RC_MOMENT_FRAME',
  INTERMEDIATE_RC_MOMENT_FRAME = 'INTERMEDIATE_RC_MOMENT_FRAME',
  ORDINARY_RC_MOMENT_FRAME = 'ORDINARY_RC_MOMENT_FRAME',
  
  // Dual Systems
  DUAL_SPECIAL_MOMENT_SPECIAL_WALL = 'DUAL_SPECIAL_MOMENT_SPECIAL_WALL',
  DUAL_INTERMEDIATE_MOMENT_SPECIAL_WALL = 'DUAL_INTERMEDIATE_MOMENT_SPECIAL_WALL',
}

export enum IrregularityType {
  NONE = 'NONE',
  
  // Horizontal
  TORSIONAL = 'TORSIONAL',
  EXTREME_TORSIONAL = 'EXTREME_TORSIONAL',
  REENTRANT_CORNER = 'REENTRANT_CORNER',
  DIAPHRAGM_DISCONTINUITY = 'DIAPHRAGM_DISCONTINUITY',
  OUT_OF_PLANE_OFFSET = 'OUT_OF_PLANE_OFFSET',
  NONPARALLEL_SYSTEMS = 'NONPARALLEL_SYSTEMS',
  
  // Vertical
  SOFT_STORY = 'SOFT_STORY',
  EXTREME_SOFT_STORY = 'EXTREME_SOFT_STORY',
  WEIGHT_IRREGULARITY = 'WEIGHT_IRREGULARITY',
  VERTICAL_GEOMETRIC = 'VERTICAL_GEOMETRIC',
  IN_PLANE_DISCONTINUITY = 'IN_PLANE_DISCONTINUITY',
  WEAK_STORY = 'WEAK_STORY',
}

// ============================================================================
// Interfaces - Input
// ============================================================================

export interface SeismicSiteData {
  Ss: number;              // Mapped spectral acceleration at short periods (g)
  S1: number;              // Mapped spectral acceleration at 1-second (g)
  siteClass: SiteClass;
  TL: number;              // Long-period transition period (s)
}

export interface BuildingData {
  W: number;               // Effective seismic weight (kips)
  T: number;               // Fundamental period (s)
  T_approx?: number;       // Approximate period from code
  hn: number;              // Structural height (ft)
  stories: number;         // Number of stories
  structuralSystem: StructuralSystem;
}

export interface StoryData {
  level: number;
  height: number;          // Height above base (ft)
  weight: number;          // Seismic weight at level (kips)
  stiffness?: number;      // Story stiffness (kip/in)
}

export interface SeismicLoadInput {
  designCode: 'ASCE_7_22' | 'ASCE_7_16' | 'ASCE_7_10';
  riskCategory: RiskCategory;
  site: SeismicSiteData;
  building: BuildingData;
  stories: StoryData[];
  
  // Options
  irregularities?: IrregularityType[];
  allowTperiodLimit?: boolean;   // Use Cu × Ta limit
  includeVertical?: boolean;     // Include Ev component
}

// ============================================================================
// Interfaces - Results
// ============================================================================

export interface SpectralAccelerations {
  Ss: number;
  S1: number;
  Fa: number;              // Site coefficient for short period
  Fv: number;              // Site coefficient for long period
  SMS: number;             // MCE spectral acceleration (short)
  SM1: number;             // MCE spectral acceleration (1-sec)
  SDS: number;             // Design spectral acceleration (short)
  SD1: number;             // Design spectral acceleration (1-sec)
}

export interface DesignCoefficients {
  R: number;               // Response modification factor
  Cd: number;              // Deflection amplification factor
  omega_0: number;         // Overstrength factor
  Ie: number;              // Importance factor
  rho: number;             // Redundancy factor
  Cs: number;              // Seismic response coefficient
}

export interface PeriodResult {
  T_calc: number;          // Calculated period
  Ta: number;              // Approximate period
  Cu: number;              // Upper limit coefficient
  T_upper: number;         // Cu × Ta limit
  T_design: number;        // Design period used
  method: string;
}

export interface BaseShearResult {
  Cs: number;              // Seismic coefficient
  Cs_min: number;          // Minimum Cs
  Cs_max: number;          // Maximum Cs
  V: number;               // Design base shear (kips)
  W: number;               // Seismic weight
  governs: 'UPPER' | 'LOWER' | 'CALCULATED';
}

export interface VerticalDistribution {
  level: number;
  wx: number;              // Weight at level
  hx: number;              // Height of level
  wxhxk: number;           // Weight × height^k
  Cvx: number;             // Vertical distribution factor
  Fx: number;              // Lateral force at level (kips)
  Vx: number;              // Story shear (kips)
  Mx: number;              // Overturning moment (kip-ft)
}

export interface StoryDriftResult {
  level: number;
  delta_xe: number;        // Elastic displacement (in)
  delta_x: number;         // Amplified displacement (in)
  delta: number;           // Story drift (in)
  drift_ratio: number;     // Drift ratio
  allowable: number;       // Allowable drift
  isAdequate: boolean;
}

export interface SeismicLoadResult {
  isAdequate: boolean;
  
  // Seismic Design Category
  SDC: SeismicDesignCategory;
  
  // Spectral accelerations
  spectral: SpectralAccelerations;
  
  // Design coefficients
  coefficients: DesignCoefficients;
  
  // Period
  period: PeriodResult;
  
  // Base shear
  baseShear: BaseShearResult;
  
  // Vertical distribution
  distribution: VerticalDistribution[];
  
  // Story drift (if stiffness provided)
  drift?: StoryDriftResult[];
  
  // Summary
  summary: {
    SDC: SeismicDesignCategory;
    SDS: number;
    SD1: number;
    T: number;
    V: number;
    V_per_W: number;        // V/W percentage
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
// Constants - Site Coefficients (ASCE 7-22 Tables 11.4-1, 11.4-2)
// ============================================================================

export const SITE_COEFFICIENT_FA: Record<SiteClass, Record<string, number>> = {
  [SiteClass.A]: { '0.25': 0.8, '0.5': 0.8, '0.75': 0.8, '1.0': 0.8, '1.25': 0.8 },
  [SiteClass.B]: { '0.25': 0.9, '0.5': 0.9, '0.75': 0.9, '1.0': 0.9, '1.25': 0.9 },
  [SiteClass.BC]: { '0.25': 1.0, '0.5': 1.0, '0.75': 1.0, '1.0': 1.0, '1.25': 1.0 },
  [SiteClass.C]: { '0.25': 1.2, '0.5': 1.2, '0.75': 1.1, '1.0': 1.0, '1.25': 1.0 },
  [SiteClass.CD]: { '0.25': 1.3, '0.5': 1.3, '0.75': 1.2, '1.0': 1.1, '1.25': 1.0 },
  [SiteClass.D]: { '0.25': 1.4, '0.5': 1.4, '0.75': 1.3, '1.0': 1.2, '1.25': 1.1 },
  [SiteClass.DE]: { '0.25': 1.5, '0.5': 1.5, '0.75': 1.4, '1.0': 1.3, '1.25': 1.2 },
  [SiteClass.E]: { '0.25': 1.6, '0.5': 1.6, '0.75': 1.5, '1.0': 1.4, '1.25': 1.3 },
  [SiteClass.F]: { '0.25': 0, '0.5': 0, '0.75': 0, '1.0': 0, '1.25': 0 }, // Requires site analysis
};

export const SITE_COEFFICIENT_FV: Record<SiteClass, Record<string, number>> = {
  [SiteClass.A]: { '0.1': 0.8, '0.2': 0.8, '0.3': 0.8, '0.4': 0.8, '0.5': 0.8 },
  [SiteClass.B]: { '0.1': 0.8, '0.2': 0.8, '0.3': 0.8, '0.4': 0.8, '0.5': 0.8 },
  [SiteClass.BC]: { '0.1': 1.0, '0.2': 1.0, '0.3': 1.0, '0.4': 1.0, '0.5': 1.0 },
  [SiteClass.C]: { '0.1': 1.5, '0.2': 1.5, '0.3': 1.5, '0.4': 1.4, '0.5': 1.3 },
  [SiteClass.CD]: { '0.1': 1.8, '0.2': 1.7, '0.3': 1.6, '0.4': 1.5, '0.5': 1.4 },
  [SiteClass.D]: { '0.1': 2.2, '0.2': 2.0, '0.3': 1.9, '0.4': 1.8, '0.5': 1.7 },
  [SiteClass.DE]: { '0.1': 2.8, '0.2': 2.5, '0.3': 2.4, '0.4': 2.2, '0.5': 2.0 },
  [SiteClass.E]: { '0.1': 3.5, '0.2': 3.2, '0.3': 3.0, '0.4': 2.8, '0.5': 2.6 },
  [SiteClass.F]: { '0.1': 0, '0.2': 0, '0.3': 0, '0.4': 0, '0.5': 0 },
};

// ============================================================================
// Constants - Response Modification Factors (ASCE 7-22 Table 12.2-1)
// ============================================================================

export const RESPONSE_FACTORS: Record<StructuralSystem, { R: number; Cd: number; omega_0: number }> = {
  // Bearing Wall Systems
  [StructuralSystem.SPECIAL_RC_SHEAR_WALL]: { R: 5, Cd: 5, omega_0: 2.5 },
  [StructuralSystem.ORDINARY_RC_SHEAR_WALL]: { R: 4, Cd: 4, omega_0: 2.5 },
  [StructuralSystem.SPECIAL_MASONRY_SHEAR_WALL]: { R: 5, Cd: 3.5, omega_0: 2.5 },
  
  // Building Frame Systems
  [StructuralSystem.STEEL_ECCENTRICALLY_BRACED]: { R: 8, Cd: 4, omega_0: 2 },
  [StructuralSystem.STEEL_SPECIAL_CONC_BRACED]: { R: 6, Cd: 5, omega_0: 2 },
  [StructuralSystem.STEEL_ORDINARY_CONC_BRACED]: { R: 3.25, Cd: 3.25, omega_0: 2 },
  [StructuralSystem.SPECIAL_RC_SHEAR_WALL_FRAME]: { R: 6, Cd: 5, omega_0: 2.5 },
  
  // Moment Frame Systems
  [StructuralSystem.STEEL_SPECIAL_MOMENT_FRAME]: { R: 8, Cd: 5.5, omega_0: 3 },
  [StructuralSystem.STEEL_INTERMEDIATE_MOMENT_FRAME]: { R: 4.5, Cd: 4, omega_0: 3 },
  [StructuralSystem.STEEL_ORDINARY_MOMENT_FRAME]: { R: 3.5, Cd: 3, omega_0: 3 },
  [StructuralSystem.SPECIAL_RC_MOMENT_FRAME]: { R: 8, Cd: 5.5, omega_0: 3 },
  [StructuralSystem.INTERMEDIATE_RC_MOMENT_FRAME]: { R: 5, Cd: 4.5, omega_0: 3 },
  [StructuralSystem.ORDINARY_RC_MOMENT_FRAME]: { R: 3, Cd: 2.5, omega_0: 3 },
  
  // Dual Systems
  [StructuralSystem.DUAL_SPECIAL_MOMENT_SPECIAL_WALL]: { R: 7, Cd: 5.5, omega_0: 2.5 },
  [StructuralSystem.DUAL_INTERMEDIATE_MOMENT_SPECIAL_WALL]: { R: 6, Cd: 5, omega_0: 2.5 },
};

// ============================================================================
// Constants - Importance Factor (ASCE 7-22 Table 1.5-2)
// ============================================================================

export const IMPORTANCE_FACTOR_SEISMIC: Record<RiskCategory, number> = {
  [RiskCategory.I]: 1.00,
  [RiskCategory.II]: 1.00,
  [RiskCategory.III]: 1.25,
  [RiskCategory.IV]: 1.50,
};

// ============================================================================
// Constants - Period Coefficient Cu (ASCE 7-22 Table 12.8-1)
// ============================================================================

export const PERIOD_COEFFICIENT_CU: Record<string, number> = {
  '0.4+': 1.4,
  '0.3': 1.4,
  '0.2': 1.5,
  '0.15': 1.6,
  '0.1': 1.7,
};

// ============================================================================
// Constants - Approximate Period Parameters (ASCE 7-22 Table 12.8-2)
// ============================================================================

export const APPROXIMATE_PERIOD_PARAMS: Record<string, { Ct: number; x: number }> = {
  steel_moment_frame: { Ct: 0.028, x: 0.8 },
  concrete_moment_frame: { Ct: 0.016, x: 0.9 },
  steel_eccentrically_braced: { Ct: 0.03, x: 0.75 },
  steel_buckling_restrained: { Ct: 0.03, x: 0.75 },
  other: { Ct: 0.02, x: 0.75 },
};

// ============================================================================
// Constants - Allowable Story Drift (ASCE 7-22 Table 12.12-1)
// ============================================================================

export const ALLOWABLE_DRIFT: Record<RiskCategory, Record<string, number>> = {
  [RiskCategory.I]: { 'masonry': 0.010, 'other_4+': 0.020, 'other_under4': 0.025 },
  [RiskCategory.II]: { 'masonry': 0.010, 'other_4+': 0.020, 'other_under4': 0.025 },
  [RiskCategory.III]: { 'masonry': 0.010, 'other_4+': 0.015, 'other_under4': 0.020 },
  [RiskCategory.IV]: { 'masonry': 0.010, 'other_4+': 0.010, 'other_under4': 0.015 },
};
