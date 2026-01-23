/**
 * RC Slab Design Types
 * Slab design and detailing per ACI 318-19
 * 
 * Includes:
 * - One-way slabs
 * - Two-way slabs (direct design)
 * - Flat plates
 * - Flat slabs with drops
 * - Waffle slabs
 */

// ============================================================================
// Enums
// ============================================================================

export enum SlabType {
  ONE_WAY = 'ONE_WAY',              // One-way slab on beams
  TWO_WAY_BEAM = 'TWO_WAY_BEAM',    // Two-way slab on beams
  FLAT_PLATE = 'FLAT_PLATE',        // Flat plate (no beams)
  FLAT_SLAB = 'FLAT_SLAB',          // Flat slab with drop panels
  WAFFLE = 'WAFFLE',                // Waffle slab (two-way joist)
}

export enum SpanCondition {
  INTERIOR = 'INTERIOR',            // Interior span
  END = 'END',                      // End span
  EDGE = 'EDGE',                    // Edge panel
  CORNER = 'CORNER',                // Corner panel
}

export enum DropPanelType {
  NONE = 'NONE',
  RECTANGULAR = 'RECTANGULAR',
  CIRCULAR = 'CIRCULAR',
}

export enum PunchingShearReinf {
  NONE = 'NONE',
  STIRRUPS = 'STIRRUPS',
  HEADED_STUDS = 'HEADED_STUDS',
  SHEAR_CAPS = 'SHEAR_CAPS',
}

// ============================================================================
// Interfaces - Input
// ============================================================================

export interface SlabGeometryInput {
  type: SlabType;
  h: number;                        // Slab thickness (in)
  cover: number;                    // Clear cover (in)
  
  // Span dimensions
  Lx: number;                       // Span in x-direction (ft)
  Ly: number;                       // Span in y-direction (ft)
  
  // For flat slabs
  dropPanel?: {
    type: DropPanelType;
    Ldx: number;                    // Drop panel dimension x (in)
    Ldy: number;                    // Drop panel dimension y (in)
    hd: number;                     // Drop panel thickness below slab (in)
  };
  
  // Column dimensions (for flat plates/slabs)
  column?: {
    c1: number;                     // Column dimension parallel to Lx (in)
    c2: number;                     // Column dimension parallel to Ly (in)
    isCircular?: boolean;
  };
  
  // Beam dimensions (for two-way with beams)
  beams?: {
    x: { b: number; h: number };    // Beam in x-direction
    y: { b: number; h: number };    // Beam in y-direction
  };
}

export interface SlabMaterialInput {
  fc: number;                       // Concrete strength (psi)
  fy: number;                       // Steel yield strength (psi)
  Es?: number;                      // Steel modulus (default 29000 ksi)
  lambda?: number;                  // Lightweight factor
}

export interface SlabLoadInput {
  // Service loads
  DL_super: number;                 // Superimposed dead load (psf)
  LL: number;                       // Live load (psf)
  
  // Factored loads
  wu: number;                       // Factored uniform load (psf)
  
  // For punching (column reaction)
  Vu_col?: number;                  // Factored column reaction (kips)
  Mu_unbalanced?: number;           // Unbalanced moment at column (kip-ft)
}

export interface SlabPanelInput {
  spanCondition: SpanCondition;
  
  // For two-way slabs - moment coefficients or use DDM
  useDirectDesign?: boolean;
  
  // Edge conditions
  edgeBeam?: boolean;               // Has edge beam (spandrel)
  discontinuousEdge?: 'NONE' | 'LEFT' | 'RIGHT' | 'TOP' | 'BOTTOM';
}

export interface RCSlabInput {
  designCode: 'ACI_318_19' | 'ACI_318_14';
  geometry: SlabGeometryInput;
  materials: SlabMaterialInput;
  loads: SlabLoadInput;
  panel: SlabPanelInput;
  
  // Options
  checkDeflection?: boolean;
  checkPunching?: boolean;
  preferredBarSize?: string;
}

// ============================================================================
// Interfaces - Results
// ============================================================================

export interface OneWaySlabResult {
  direction: 'X' | 'Y';
  strip: 'ENTIRE';
  
  // Moments
  Mu_pos: number;
  Mu_neg: number;
  
  // Reinforcement
  As_pos: number;
  As_neg: number;
  bars_pos: { size: string; spacing: number };
  bars_neg: { size: string; spacing: number };
  
  // Temperature/shrinkage
  As_temp: number;
  bars_temp: { size: string; spacing: number };
}

export interface TwoWaySlabResult {
  // Column strip
  columnStrip: {
    width: number;                  // Strip width (in)
    Mu_pos: number;                 // Positive moment (kip-ft/ft)
    Mu_neg_int: number;             // Negative moment at interior support
    Mu_neg_ext?: number;            // Negative moment at exterior support
    As_pos: number;
    As_neg: number;
    bars_pos: { size: string; spacing: number };
    bars_neg: { size: string; spacing: number };
  };
  
  // Middle strip
  middleStrip: {
    width: number;
    Mu_pos: number;
    Mu_neg: number;
    As_pos: number;
    As_neg: number;
    bars_pos: { size: string; spacing: number };
    bars_neg: { size: string; spacing: number };
  };
}

export interface PunchingShearResult {
  Vu: number;                       // Factored shear at critical section
  phi_Vc: number;                   // Concrete shear capacity
  phi_Vn: number;                   // Total capacity
  ratio: number;
  isAdequate: boolean;
  
  criticalSection: {
    type: 'INTERIOR' | 'EDGE' | 'CORNER';
    bo: number;                     // Perimeter (in)
    d: number;                      // Effective depth (in)
    location: number;               // d/2 from column face
  };
  
  // If reinforcement needed
  reinforcement?: {
    type: PunchingShearReinf;
    phi_Vs: number;
    details: string;
  };
  
  // Moment transfer
  momentTransfer?: {
    gamma_f: number;                // Fraction by flexure
    gamma_v: number;                // Fraction by eccentricity of shear
    b1: number;                     // Critical section dimension
    b2: number;
  };
}

export interface SlabDeflectionResult {
  Ie: number;                       // Effective moment of inertia (in⁴/ft)
  delta_imm: number;                // Immediate deflection (in)
  delta_LT: number;                 // Long-term deflection (in)
  delta_total: number;              // Total deflection (in)
  limit: number;                    // Allowable deflection (in)
  ratio: number;
  isAdequate: boolean;
}

export interface RCSlabResult {
  isAdequate: boolean;
  slabType: SlabType;
  
  // Section
  section: {
    h: number;
    d: number;                      // Effective depth
    aspectRatio: number;            // Ly/Lx
  };
  
  // Design results
  oneWay?: OneWaySlabResult;
  twoWay?: {
    xDirection: TwoWaySlabResult;
    yDirection: TwoWaySlabResult;
  };
  
  // Punching shear
  punching?: PunchingShearResult;
  
  // Deflection
  deflection?: SlabDeflectionResult;
  
  // Summary reinforcement schedule
  reinforcement: {
    bottom_x: { size: string; spacing: number };
    bottom_y: { size: string; spacing: number };
    top_x: { size: string; spacing: number };
    top_y: { size: string; spacing: number };
    temp?: { size: string; spacing: number };
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

// Direct Design Method moment coefficients (ACI 318-19 8.10)
export const DDM_MOMENT_FACTORS = {
  // Total static moment distribution
  totalMoment: {
    interior: { negative: 0.65, positive: 0.35 },
    end_discontinuous: { negative: 0.75, positive: 0.63, exterior_neg: 0 },
    end_integral: { negative: 0.70, positive: 0.57, exterior_neg: 0.16 },
  },
  
  // Column strip distribution (percent of strip moment)
  columnStrip: {
    negative_interior: {
      alpha_0: 0.75,                // No beam
      alpha_1: 0.90,                // Stiff beam (αf1l2/l1 ≥ 1.0)
    },
    positive: {
      alpha_0: 0.60,
      alpha_1: 0.75,
    },
    negative_exterior: {
      alpha_0: 1.00,                // No edge beam
      alpha_1: 0.75,                // With edge beam
    },
  },
};

// Minimum slab thickness (ACI 318-19 Table 8.3.1.1)
export const MIN_SLAB_THICKNESS = {
  // Without drop panels
  flat_plate: {
    interior: 33,                   // Ln/33
    edge: 30,                       // Ln/30
    corner: 30,                     // Ln/30
    discontinuous: 36,              // Ln/36 with edge beam
  },
  // With drop panels
  flat_slab: {
    interior: 36,
    edge: 33,
    corner: 33,
    discontinuous: 40,
  },
  // One-way
  one_way: {
    simply_supported: 20,           // L/20
    one_end_continuous: 24,         // L/24
    both_ends_continuous: 28,       // L/28
    cantilever: 10,                 // L/10
  },
};

// Punching shear coefficients (ACI 318-19 22.6.5.2)
export const PUNCHING_SHEAR = {
  // Column location factors (αs)
  alpha_s: {
    interior: 40,
    edge: 30,
    corner: 20,
  },
  
  // Maximum without shear reinforcement
  vc_max_unreinforced: 4,           // 4√f'c (normal weight)
  
  // Maximum with reinforcement
  vc_max_reinforced: 8,             // 8√f'c
  
  // Headed stud limits
  vc_with_studs: 2,                 // Concrete contribution with studs
};

// Temperature and shrinkage reinforcement (ACI 318-19 24.4)
export const TEMP_SHRINKAGE = {
  grade_60: 0.0018,                 // As/Ag for Grade 60
  grade_40_50: 0.0020,              // As/Ag for Grade 40/50
  max_spacing: 18,                  // Maximum spacing (in)
  min_spacing: 5,                   // Practical minimum (in)
};

// Standard rebar for slabs
export const REBAR_DATA_SLAB: Record<string, { 
  db: number; 
  Ab: number; 
  weight: number 
}> = {
  '#3': { db: 0.375, Ab: 0.11, weight: 0.376 },
  '#4': { db: 0.5, Ab: 0.20, weight: 0.668 },
  '#5': { db: 0.625, Ab: 0.31, weight: 1.043 },
  '#6': { db: 0.75, Ab: 0.44, weight: 1.502 },
  '#7': { db: 0.875, Ab: 0.60, weight: 2.044 },
};
