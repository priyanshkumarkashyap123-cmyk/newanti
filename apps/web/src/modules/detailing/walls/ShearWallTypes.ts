/**
 * RC Wall & Shear Wall Design Types
 * Wall design and detailing per ACI 318-19
 * 
 * Includes:
 * - Bearing walls
 * - Shear walls (ordinary, special)
 * - Coupled shear walls
 * - Boundary elements
 */

// ============================================================================
// Enums
// ============================================================================

export enum WallType {
  BEARING = 'BEARING',                  // Bearing wall
  SHEAR_ORDINARY = 'SHEAR_ORDINARY',    // Ordinary shear wall (OSW)
  SHEAR_SPECIAL = 'SHEAR_SPECIAL',      // Special shear wall (SSW)
  COUPLED = 'COUPLED',                  // Coupled shear wall
  BASEMENT = 'BASEMENT',                // Basement/retaining wall
}

export enum SeismicDesignCategory {
  SDC_A = 'SDC_A',
  SDC_B = 'SDC_B',
  SDC_C = 'SDC_C',
  SDC_D = 'SDC_D',
  SDC_E = 'SDC_E',
  SDC_F = 'SDC_F',
}

export enum BoundaryElementType {
  NONE = 'NONE',
  ORDINARY = 'ORDINARY',              // ACI 18.10.6.4(a)
  SPECIAL = 'SPECIAL',                // ACI 18.10.6.4(b)
}

export enum WallReinforcementLayout {
  SINGLE_LAYER = 'SINGLE_LAYER',      // h < 10"
  DOUBLE_LAYER = 'DOUBLE_LAYER',      // h ≥ 10"
}

export enum LateralLoadType {
  WIND = 'WIND',
  SEISMIC = 'SEISMIC',
  COMBINED = 'COMBINED',
}

// ============================================================================
// Interfaces - Input
// ============================================================================

export interface WallGeometryInput {
  hw: number;                          // Wall height (ft)
  Lw: number;                          // Wall length (ft)
  tw: number;                          // Wall thickness (in)
  
  // Openings (optional)
  openings?: {
    x: number;                         // Distance from left edge (ft)
    y: number;                         // Distance from bottom (ft)
    width: number;                     // Opening width (ft)
    height: number;                    // Opening height (ft)
  }[];
  
  // Boundary element dimensions (if pre-determined)
  boundaryElement?: {
    length: number;                    // Length along wall (in)
    width: number;                     // Width perpendicular (in)
  };
}

export interface WallMaterialInput {
  fc: number;                          // Concrete strength (psi)
  fy: number;                          // Steel yield strength (psi)
  fyt?: number;                        // Transverse steel yield (psi)
  Es?: number;                         // Steel modulus (default 29000 ksi)
  lambda?: number;                     // Lightweight factor
}

export interface WallLoadInput {
  // Axial load
  Pu: number;                          // Factored axial (kips)
  
  // In-plane forces
  Vu: number;                          // Factored shear (kips)
  Mu_base: number;                     // Factored moment at base (kip-ft)
  
  // Out-of-plane (if applicable)
  wu_oop?: number;                     // Out-of-plane pressure (psf)
  
  // Load type
  loadType: LateralLoadType;
}

export interface ShearWallInput {
  designCode: 'ACI_318_19' | 'ACI_318_14';
  wallType: WallType;
  seismicCategory: SeismicDesignCategory;
  
  geometry: WallGeometryInput;
  materials: WallMaterialInput;
  loads: WallLoadInput;
  
  // Design options
  checkBoundaryElements?: boolean;
  designCoupling?: boolean;
  couplingBeam?: {
    Ln: number;                        // Clear span (in)
    h: number;                         // Depth (in)
    b: number;                         // Width (in)
  };
}

// ============================================================================
// Interfaces - Results
// ============================================================================

export interface ShearDesignResult {
  Vu: number;                          // Applied shear
  phi_Vn: number;                      // Design capacity
  ratio: number;
  isAdequate: boolean;
  
  // Concrete contribution
  Vc: number;
  
  // Steel contribution
  Vs: number;
  rho_t: number;                       // Horizontal steel ratio
  horizontal_bars: { size: string; spacing: number };
  
  // ACI limits check
  Vn_max: number;                      // Max shear per ACI
  exceeds_limit: boolean;
}

export interface FlexuralDesignResult {
  Mu: number;                          // Applied moment
  phi_Mn: number;                      // Design capacity
  ratio: number;
  isAdequate: boolean;
  
  // Vertical reinforcement
  rho_l: number;                       // Vertical steel ratio
  vertical_bars: { 
    size: string; 
    spacing: number;
    total_each_face: number;
  };
  
  // Distributed steel
  As_dist: number;                     // Distributed steel area (in²)
  As_boundary?: number;                // Boundary element steel (in²)
}

export interface BoundaryElementResult {
  required: boolean;
  type: BoundaryElementType;
  
  // Trigger method
  triggerMethod?: 'STRESS' | 'DISPLACEMENT';
  
  // Geometry
  length: number;                      // Length along wall (in)
  width: number;                       // Width perpendicular (in)
  
  // Reinforcement
  longitudinal: {
    As: number;                        // Total area (in²)
    bars: string;                      // Bar designation
    arrangement: string;               // Layout description
  };
  
  // Confinement
  transverse?: {
    Ash_req: number;                   // Required confining steel
    size: string;
    spacing: number;
    legs: number;
  };
  
  // Height extent
  height_extent: number;               // Height requiring boundary element (ft)
}

export interface WallStabilityResult {
  slenderness: number;                 // klu/r
  isSlender: boolean;
  
  // Euler buckling
  Pc: number;                          // Critical buckling load
  
  // Moment magnification
  delta_ns?: number;                   // Non-sway magnifier
  Mc?: number;                         // Magnified moment
}

export interface OutOfPlaneResult {
  Mu_oop: number;                      // Out-of-plane moment
  isAdequate: boolean;
  
  As_req: number;                      // Required steel
  bars: { size: string; spacing: number };
}

export interface CouplingBeamResult {
  Vu_beam: number;                     // Design shear
  Mn_beam: number;                     // Moment capacity
  isAdequate: boolean;
  
  // Reinforcement
  diagonal?: {
    As: number;
    bars: string;
    angle: number;                     // Diagonal angle (degrees)
  };
  
  conventional?: {
    As_flex: number;
    Av: number;
    stirrups: { size: string; spacing: number };
  };
}

export interface ShearWallResult {
  isAdequate: boolean;
  wallType: WallType;
  seismicCategory: SeismicDesignCategory;
  
  // Section properties
  section: {
    hw: number;                        // Height (ft)
    Lw: number;                        // Length (ft)
    tw: number;                        // Thickness (in)
    Ag: number;                        // Gross area (in²)
    Ig: number;                        // Gross moment of inertia (in⁴)
    hw_Lw_ratio: number;               // Aspect ratio
  };
  
  // Design results
  shear: ShearDesignResult;
  flexure: FlexuralDesignResult;
  boundary?: BoundaryElementResult;
  stability?: WallStabilityResult;
  outOfPlane?: OutOfPlaneResult;
  couplingBeam?: CouplingBeamResult;
  
  // Reinforcement schedule
  reinforcement: {
    vertical: { size: string; spacing: number; layers: 1 | 2 };
    horizontal: { size: string; spacing: number; layers: 1 | 2 };
    boundary?: {
      longitudinal: string;
      transverse: string;
    };
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

// Minimum reinforcement ratios (ACI 318-19 11.6)
export const WALL_REINFORCEMENT_LIMITS = {
  // Minimum ratios
  rho_l_min: 0.0012,                   // Vertical (Grade 60, #5 or smaller)
  rho_l_min_larger: 0.0015,            // Vertical (bars > #5)
  rho_t_min: 0.0020,                   // Horizontal (Grade 60)
  rho_t_min_40: 0.0025,                // Horizontal (Grade 40)
  
  // Maximum spacing
  s_max_vert: 18,                      // Vertical bars max (in)
  s_max_horiz: 18,                     // Horizontal bars max (in)
  s_max_3tw: 3,                        // 3 × tw factor
  
  // Double layer threshold
  double_layer_tw: 10,                 // Thickness requiring double layer (in)
};

// Shear wall provisions (ACI 318-19 18.10)
export const SPECIAL_SHEAR_WALL = {
  // Boundary element triggers
  stress_trigger: 0.2,                 // 0.2 f'c stress trigger
  displacement_trigger: 0.005,         // Drift trigger for SSW
  
  // Minimum boundary dimensions
  be_min_length: 12,                   // Min boundary length (in)
  
  // Confinement requirements
  Ash_factor_1: 0.09,                  // Ash factor for equation 1
  Ash_factor_2: 0.3,                   // Ash factor for equation 2
  
  // Reinforcement limits
  rho_l_min_be: 0.005,                 // Min longitudinal in BE
  rho_l_max_be: 0.06,                  // Max longitudinal in BE
  
  // Coupling beam limits
  coupling_aspect_low: 2.0,            // Ln/h ≤ 2 (diagonal required)
  coupling_aspect_high: 4.0,           // Ln/h > 4 (conventional OK)
};

// Ordinary shear wall limits
export const ORDINARY_SHEAR_WALL = {
  // Shear strength
  Vn_limit_factor: 10,                 // 10√f'c × Acv limit
  
  // hw/Lw effects on shear
  alpha_c_low: 3.0,                    // For hw/Lw ≤ 1.5
  alpha_c_high: 2.0,                   // For hw/Lw ≥ 2.0
};

// Rebar data
export const REBAR_DATA_WALL: Record<string, { 
  db: number; 
  Ab: number; 
  weight: number 
}> = {
  '#4': { db: 0.5, Ab: 0.20, weight: 0.668 },
  '#5': { db: 0.625, Ab: 0.31, weight: 1.043 },
  '#6': { db: 0.75, Ab: 0.44, weight: 1.502 },
  '#7': { db: 0.875, Ab: 0.60, weight: 2.044 },
  '#8': { db: 1.0, Ab: 0.79, weight: 2.670 },
  '#9': { db: 1.128, Ab: 1.00, weight: 3.400 },
  '#10': { db: 1.27, Ab: 1.27, weight: 4.303 },
  '#11': { db: 1.41, Ab: 1.56, weight: 5.313 },
};
