/**
 * Foundation Types
 * Spread footings, combined footings, mat foundations
 * Per ACI 318-19 Chapter 13
 * 
 * Includes:
 * - Isolated spread footings
 * - Combined footings
 * - Strap footings
 * - Mat/raft foundations
 * - Pile caps
 */

// ============================================================================
// Enums
// ============================================================================

export enum FoundationType {
  ISOLATED_SPREAD = 'ISOLATED',          // Single column spread footing
  COMBINED = 'COMBINED',                  // Two or more columns
  STRAP = 'STRAP',                        // Two footings connected by strap
  CONTINUOUS = 'CONTINUOUS',              // Wall footing
  MAT = 'MAT',                            // Mat/raft foundation
  PILE_CAP = 'PILE_CAP',                  // Pile cap
}

export enum FootingShape {
  SQUARE = 'SQUARE',
  RECTANGULAR = 'RECTANGULAR',
  CIRCULAR = 'CIRCULAR',
  TRAPEZOIDAL = 'TRAPEZOIDAL',
}

export enum SoilType {
  ROCK = 'ROCK',
  DENSE_GRAVEL = 'DENSE_GRAVEL',
  MEDIUM_SAND = 'MEDIUM_SAND',
  LOOSE_SAND = 'LOOSE_SAND',
  STIFF_CLAY = 'STIFF_CLAY',
  MEDIUM_CLAY = 'MEDIUM_CLAY',
  SOFT_CLAY = 'SOFT_CLAY',
}

export enum LoadCombination {
  ACI_STRENGTH = 'ACI_STRENGTH',          // 1.4D, 1.2D+1.6L, etc.
  ACI_SERVICE = 'ACI_SERVICE',            // D+L (for soil pressure)
  SEISMIC = 'SEISMIC',                    // Including E
  WIND = 'WIND',                          // Including W
}

export enum ShearCheckType {
  ONE_WAY = 'ONE_WAY',                    // Beam shear
  TWO_WAY = 'TWO_WAY',                    // Punching shear
}

export enum ReinforcementLayout {
  UNIFORM = 'UNIFORM',                    // Uniform distribution
  BANDED = 'BANDED',                      // Banded near column
}

// ============================================================================
// Interfaces - Input
// ============================================================================

export interface ColumnLoadInput {
  Pu: number;              // Factored axial load (kips)
  Mux: number;             // Factored moment about x (kip-ft)
  Muy: number;             // Factored moment about y (kip-ft)
  Vu: number;              // Factored shear (kips)
  
  // Service loads (for soil pressure)
  P_service: number;       // Service axial (kips)
  Mx_service: number;      // Service moment x (kip-ft)
  My_service: number;      // Service moment y (kip-ft)
}

export interface ColumnGeometry {
  type: 'SQUARE' | 'RECTANGULAR' | 'CIRCULAR';
  b: number;               // Width (in) - or diameter for circular
  h: number;               // Depth (in)
  location: {
    x: number;             // X offset from footing center
    y: number;             // Y offset from footing center
  };
}

export interface SoilParameters {
  type: SoilType;
  qa: number;              // Allowable bearing pressure (ksf)
  qu?: number;             // Ultimate bearing capacity (ksf)
  gamma: number;           // Unit weight (pcf)
  phi?: number;            // Friction angle (degrees)
  c?: number;              // Cohesion (psf)
  subgradeModulus?: number; // Modulus of subgrade reaction (pci)
}

export interface FootingMaterials {
  fc: number;              // Concrete strength (psi)
  fy: number;              // Rebar yield strength (psi)
  cover: number;           // Clear cover to reinforcement (in)
  barSize?: string;        // Preferred bar size (#4, #5, etc.)
  maxBarSize?: string;     // Maximum bar size
}

export interface IsolatedFootingInput {
  designCode: 'ACI_318_19' | 'ACI_318_14' | 'IS_456';
  foundationType: FoundationType.ISOLATED_SPREAD;
  
  // Column
  column: ColumnGeometry;
  loads: ColumnLoadInput;
  
  // Soil
  soil: SoilParameters;
  
  // Materials
  materials: FootingMaterials;
  
  // Geometry constraints
  constraints?: {
    minDepth?: number;     // Minimum footing depth (in)
    maxDepth?: number;     // Maximum depth
    lengthWidthRatio?: number; // Max L/B ratio
    edgeDistance?: number; // Min distance from column to edge
  };
  
  // Site conditions
  depthOfFooting: number;  // Depth below grade (ft)
  groundwaterDepth?: number; // Depth to groundwater (ft)
  
  // Options
  useShearReinforcement?: boolean;
  usePedestal?: boolean;
}

export interface CombinedFootingInput {
  designCode: 'ACI_318_19';
  foundationType: FoundationType.COMBINED;
  
  // Columns (2 or more)
  columns: {
    geometry: ColumnGeometry;
    loads: ColumnLoadInput;
    spacing: number;       // Distance from previous column (in)
  }[];
  
  // Soil and materials
  soil: SoilParameters;
  materials: FootingMaterials;
  
  // Site
  depthOfFooting: number;
}

// ============================================================================
// Interfaces - Results
// ============================================================================

export interface FootingDimensions {
  L: number;               // Length (in)
  B: number;               // Width (in)
  h: number;               // Total depth (in)
  d: number;               // Effective depth (in)
  area: number;            // Plan area (sf)
  volume: number;          // Concrete volume (cy)
}

export interface SoilPressureResult {
  q_max: number;           // Maximum pressure (ksf)
  q_min: number;           // Minimum pressure (ksf)
  q_avg: number;           // Average pressure (ksf)
  q_allowable: number;     // Allowable pressure (ksf)
  ratio: number;           // Max/allowable ratio
  isAdequate: boolean;
  eccentricity?: {
    ex: number;            // Eccentricity in x (in)
    ey: number;            // Eccentricity in y (in)
    isWithinKern: boolean; // ex, ey within B/6, L/6
  };
}

export interface ShearResult {
  oneWay: {
    Vu: number;            // Factored shear (kips)
    phi_Vc: number;        // Design shear capacity (kips)
    ratio: number;
    isAdequate: boolean;
    criticalSection: number; // Distance from column face (in)
  };
  twoWay: {
    Vu: number;            // Factored shear (kips)
    phi_Vc: number;        // Design shear capacity (kips)
    ratio: number;
    isAdequate: boolean;
    bo: number;            // Perimeter of critical section (in)
    criticalSection: number; // d/2 from column face
  };
}

export interface FlexuralResult {
  direction: 'X' | 'Y';
  Mu: number;              // Factored moment (kip-ft)
  phi_Mn: number;          // Design moment capacity (kip-ft)
  ratio: number;
  isAdequate: boolean;
  As_required: number;     // Required steel area (in²)
  As_min: number;          // Minimum steel (in²)
  As_provided: number;     // Provided steel (in²)
  bars: {
    size: string;
    quantity: number;
    spacing: number;
  };
}

export interface DevelopmentResult {
  ld_required: number;     // Required development length (in)
  ld_available: number;    // Available length (in)
  ratio: number;
  isAdequate: boolean;
  useHook: boolean;
}

export interface IsolatedFootingResult {
  isAdequate: boolean;
  
  // Geometry
  dimensions: FootingDimensions;
  
  // Soil pressure
  soilPressure: SoilPressureResult;
  
  // Structural checks
  shear: ShearResult;
  flexure: {
    x: FlexuralResult;
    y: FlexuralResult;
  };
  development: DevelopmentResult;
  
  // Reinforcement
  reinforcement: {
    bottom: {
      x: { size: string; quantity: number; spacing: number };
      y: { size: string; quantity: number; spacing: number };
    };
    top?: {
      x: { size: string; quantity: number; spacing: number };
      y: { size: string; quantity: number; spacing: number };
    };
    dowels: {
      size: string;
      quantity: number;
      embedment: number;
      projection: number;
    };
  };
  
  // Pedestal (if used)
  pedestal?: {
    width: number;
    height: number;
    reinforcement: string;
  };
  
  // Material quantities
  quantities: {
    concrete_cy: number;
    rebar_lbs: number;
    formwork_sf: number;
    excavation_cy: number;
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

// Typical allowable soil bearing pressures (ksf)
export const TYPICAL_SOIL_CAPACITY: Record<SoilType, { qa: number; gamma: number }> = {
  ROCK: { qa: 60, gamma: 150 },
  DENSE_GRAVEL: { qa: 6, gamma: 130 },
  MEDIUM_SAND: { qa: 3, gamma: 120 },
  LOOSE_SAND: { qa: 1.5, gamma: 110 },
  STIFF_CLAY: { qa: 4, gamma: 125 },
  MEDIUM_CLAY: { qa: 2, gamma: 120 },
  SOFT_CLAY: { qa: 1, gamma: 110 },
};

// ACI 318 requirements
export const ACI_FOOTING_REQUIREMENTS = {
  // Minimum cover
  cover_cast_against_earth: 3,        // in
  cover_exposed_to_earth: 2,          // in
  cover_not_exposed: 1.5,             // in
  
  // Minimum depth
  min_depth_above_rebar: 6,           // in (footing on soil)
  min_depth_on_piles: 12,             // in (footing on piles)
  
  // Reinforcement limits
  rho_min: 0.0018,                    // As_min / (b × h) for slabs
  max_spacing: 18,                    // Maximum bar spacing (in)
  
  // One-way shear
  Vc_factor: 2,                       // Vc = 2 × √f'c × b × d
  
  // Two-way shear
  punching_beta_factor: 4,            // For square columns
  punching_alpha_s: {
    interior: 40,
    edge: 30,
    corner: 20,
  },
};

// Standard rebar data
export const REBAR_DATA: Record<string, { db: number; Ab: number; weight: number }> = {
  '#3': { db: 0.375, Ab: 0.11, weight: 0.376 },
  '#4': { db: 0.5, Ab: 0.20, weight: 0.668 },
  '#5': { db: 0.625, Ab: 0.31, weight: 1.043 },
  '#6': { db: 0.75, Ab: 0.44, weight: 1.502 },
  '#7': { db: 0.875, Ab: 0.60, weight: 2.044 },
  '#8': { db: 1.0, Ab: 0.79, weight: 2.670 },
  '#9': { db: 1.128, Ab: 1.00, weight: 3.400 },
  '#10': { db: 1.27, Ab: 1.27, weight: 4.303 },
  '#11': { db: 1.41, Ab: 1.56, weight: 5.313 },
};

// Dowel requirements
export const DOWEL_REQUIREMENTS = {
  min_dowels: 4,
  max_spacing: 12,                    // Maximum spacing around perimeter
  min_embedment_factor: 12,           // Minimum embedment = 12 × db
  compression_lap_factor: 30,         // Compression lap = 30 × db
  tension_lap_factor: 40,             // Tension lap = 40 × db (Class B)
};
