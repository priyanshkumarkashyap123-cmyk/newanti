/**
 * RC Column Design Types
 * Column design and detailing per ACI 318-19
 * 
 * Includes:
 * - Short columns (material failure)
 * - Slender columns (stability)
 * - Interaction diagrams
 * - Confinement requirements
 * - Splice design
 */

// ============================================================================
// Enums
// ============================================================================

export enum ColumnType {
  TIED = 'TIED',                // Tied rectangular/square column
  SPIRAL = 'SPIRAL',            // Spiral reinforced circular
  COMPOSITE = 'COMPOSITE',      // Steel-concrete composite
}

export enum ColumnCategory {
  SHORT = 'SHORT',              // Short column (no slenderness effects)
  SLENDER = 'SLENDER',          // Slender column (moment magnification)
}

export enum FrameType {
  SWAY = 'SWAY',               // Unbraced (sway) frame
  NONSWAY = 'NONSWAY',         // Braced (non-sway) frame
}

export enum SeismicDetailingCategory {
  ORDINARY = 'ORDINARY',        // Ordinary moment frame (OMF)
  INTERMEDIATE = 'INTERMEDIATE', // Intermediate moment frame (IMF)
  SPECIAL = 'SPECIAL',          // Special moment frame (SMF)
}

export enum TieConfiguration {
  PERIMETER_ONLY = 'PERIMETER',
  PERIMETER_CROSSTIES = 'CROSSTIES',
  PERIMETER_DIAMOND = 'DIAMOND',
  OVERLAPPING = 'OVERLAPPING',
}

// ============================================================================
// Interfaces - Input
// ============================================================================

export interface ColumnGeometryInput {
  type: ColumnType;
  b: number;               // Width (in) - or diameter for circular
  h: number;               // Depth (in)
  L_clear: number;         // Clear unsupported length (ft)
  cover: number;           // Clear cover to ties (in)
}

export interface ColumnMaterialInput {
  fc: number;              // Concrete strength (psi)
  fy: number;              // Longitudinal steel yield (psi)
  fyt: number;             // Transverse steel yield (psi)
  Es?: number;             // Steel modulus (default 29000 ksi)
}

export interface ColumnLoadInput {
  // Factored forces
  Pu: number;              // Axial force (kips) - positive = compression
  Mux: number;             // Moment about x-axis (kip-ft)
  Muy: number;             // Moment about y-axis (kip-ft)
  Vu: number;              // Shear (kips)
  
  // For slenderness
  M1x?: number;            // Smaller end moment x (kip-ft)
  M2x?: number;            // Larger end moment x (kip-ft)
  M1y?: number;            // Smaller end moment y (kip-ft)
  M2y?: number;            // Larger end moment y (kip-ft)
  
  // For sway analysis
  Cm?: number;             // Equivalent moment factor
  delta_s?: number;        // Sway deflection (in)
}

export interface ColumnFrameInput {
  frameType: FrameType;
  seismicCategory: SeismicDetailingCategory;
  
  // End conditions (for effective length)
  psi_top: number;         // Stiffness ratio at top
  psi_bottom: number;      // Stiffness ratio at bottom
  
  // Story information
  storyStiffness?: number; // ΣPu × Δ / (V × Lc)
}

export interface RCColumnInput {
  designCode: 'ACI_318_19' | 'ACI_318_14' | 'IS_456';
  geometry: ColumnGeometryInput;
  materials: ColumnMaterialInput;
  loads: ColumnLoadInput;
  frame: ColumnFrameInput;
  
  // Optional initial design
  longitudinalBars?: {
    size: string;
    quantity: number;
    arrangement?: 'UNIFORM' | 'CONCENTRATED';
  };
}

// ============================================================================
// Interfaces - Results
// ============================================================================

export interface SlendernessResult {
  category: ColumnCategory;
  kx: number;              // Effective length factor x
  ky: number;              // Effective length factor y
  r_x: number;             // Radius of gyration x (in)
  r_y: number;             // Radius of gyration y (in)
  kLu_r_x: number;         // Slenderness ratio x
  kLu_r_y: number;         // Slenderness ratio y
  limit: number;           // Slenderness limit
  isSlender: boolean;
  governingAxis: 'X' | 'Y';
}

export interface MomentMagnificationResult {
  required: boolean;
  Mc_x: number;            // Magnified moment x (kip-ft)
  Mc_y: number;            // Magnified moment y (kip-ft)
  delta_ns_x: number;      // Non-sway magnification factor x
  delta_ns_y: number;      // Non-sway magnification factor y
  delta_s?: number;        // Sway magnification factor
  Pc_x: number;            // Critical buckling load x (kips)
  Pc_y: number;            // Critical buckling load y (kips)
}

export interface InteractionPoint {
  phi_Pn: number;          // Design axial capacity (kips)
  phi_Mn: number;          // Design moment capacity (kip-ft)
  type: 'COMPRESSION' | 'TENSION' | 'BALANCE' | 'PURE_MOMENT';
}

export interface CapacityResult {
  phi_Pn_max: number;      // Maximum compression capacity (kips)
  phi_Pn_t: number;        // Tension capacity (kips)
  phi_Mn_x: number;        // Moment capacity x at Pu (kip-ft)
  phi_Mn_y: number;        // Moment capacity y at Pu (kip-ft)
  interactionRatio: number;
  isAdequate: boolean;
  interactionDiagram?: InteractionPoint[];
}

export interface ConfinementResult {
  tieSize: string;
  tieSpacing: number;
  tieLegsx: number;        // Legs in x-direction
  tieLegsy: number;        // Legs in y-direction
  Ash_provided_x: number;
  Ash_provided_y: number;
  Ash_required_x: number;
  Ash_required_y: number;
  isAdequate: boolean;
  specialRequirements?: {
    lo: number;            // Confinement zone length (in)
    s_max_conf: number;    // Max spacing in conf. zone
    s_max_other: number;   // Max spacing outside conf. zone
  };
}

export interface ShearResult {
  Vu: number;
  phi_Vc: number;
  phi_Vs: number;
  phi_Vn: number;
  ratio: number;
  isAdequate: boolean;
  shearReinfRequired: boolean;
}

export interface RCColumnResult {
  isAdequate: boolean;
  
  // Section properties
  section: {
    b: number;
    h: number;
    Ag: number;
    Ast: number;
    rho_g: number;
  };
  
  // Longitudinal reinforcement
  longitudinal: {
    bars: { size: string; quantity: number };
    Ast: number;
    rho_g: number;
    arrangement: string;
    clearSpacing: number;
    isAdequate: boolean;
  };
  
  // Analysis results
  slenderness: SlendernessResult;
  momentMagnification?: MomentMagnificationResult;
  capacity: CapacityResult;
  
  // Transverse reinforcement
  confinement: ConfinementResult;
  shear: ShearResult;
  
  // Splice requirements
  splice: {
    class: 'A' | 'B';
    length: number;        // Splice length (in)
    location: string;
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
// Constants
// ============================================================================

// ACI 318-19 Column Requirements
export const ACI_COLUMN_LIMITS = {
  // Reinforcement ratio limits
  rho_g_min: 0.01,          // Minimum 1%
  rho_g_max: 0.08,          // Maximum 8%
  rho_g_max_seismic: 0.06,  // Maximum 6% for seismic
  
  // Bar limits
  min_bars_tied: 4,         // Minimum 4 for tied
  min_bars_spiral: 6,       // Minimum 6 for spiral
  
  // Tie limits
  tie_min_size: '#3',       // Minimum #3 for bars up to #10
  tie_min_size_large: '#4', // Minimum #4 for #11+ bars or bundles
  
  // Spacing limits
  s_max_bars: 6,            // Maximum 6" between supported bars
  s_max_ties_factor: [16, 48, 'b'], // 16×db_long, 48×db_tie, min(b,h)
  
  // Slenderness
  slender_limit_nonsway: 34 - 12 * 0, // 34 - 12×(M1/M2) ≤ 40
  slender_limit_sway: 22,   // kLu/r ≤ 22 for sway
  slender_max: 100,         // Maximum slenderness ratio
};

// Seismic detailing requirements (ACI 318-19 Chapter 18)
export const SEISMIC_COLUMN_REQUIREMENTS = {
  // Special moment frame columns
  SMF: {
    rho_g_max: 0.06,
    lo_factor: Math.max,     // lo = max(h, L_clear/6, 18")
    lo_min: 18,              // Minimum confinement zone
    s_max_lo: [0.25, 6, 1], // s ≤ min(h/4, 6×db_long, so) - coefficients
    Ash_factor: 0.3,         // Ash = 0.3×s×bc×(f'c/fyt)×(Ag/Ach - 1)
  },
  
  // Intermediate moment frame columns  
  IMF: {
    rho_g_max: 0.06,
    lo_factor: Math.max,
    lo_min: 18,
    s_max_lo: [8, 24, 0.5],
  },
  
  // Ordinary - same as ACI_COLUMN_LIMITS
  OMF: {
    rho_g_max: 0.08,
  },
};

// Effective length factors (k) for braced/unbraced
export const EFFECTIVE_LENGTH_CHARTS = {
  // For braced (non-sway) frames - conservative values
  NONSWAY: {
    fixed_fixed: 0.65,
    fixed_pinned: 0.80,
    pinned_pinned: 1.0,
  },
  // For unbraced (sway) frames - conservative values
  SWAY: {
    fixed_fixed: 1.2,
    fixed_pinned: 2.0,
    pinned_pinned: 2.0, // Actually unstable
  },
};

// Standard rebar data
export const REBAR_DATA_COL: Record<string, { 
  db: number; 
  Ab: number; 
  weight: number;
  perimeter: number;
}> = {
  '#3': { db: 0.375, Ab: 0.11, weight: 0.376, perimeter: 1.178 },
  '#4': { db: 0.5, Ab: 0.20, weight: 0.668, perimeter: 1.571 },
  '#5': { db: 0.625, Ab: 0.31, weight: 1.043, perimeter: 1.963 },
  '#6': { db: 0.75, Ab: 0.44, weight: 1.502, perimeter: 2.356 },
  '#7': { db: 0.875, Ab: 0.60, weight: 2.044, perimeter: 2.749 },
  '#8': { db: 1.0, Ab: 0.79, weight: 2.670, perimeter: 3.142 },
  '#9': { db: 1.128, Ab: 1.00, weight: 3.400, perimeter: 3.544 },
  '#10': { db: 1.27, Ab: 1.27, weight: 4.303, perimeter: 3.990 },
  '#11': { db: 1.41, Ab: 1.56, weight: 5.313, perimeter: 4.430 },
  '#14': { db: 1.693, Ab: 2.25, weight: 7.65, perimeter: 5.32 },
  '#18': { db: 2.257, Ab: 4.00, weight: 13.60, perimeter: 7.09 },
};
