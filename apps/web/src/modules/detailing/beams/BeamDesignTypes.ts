/**
 * RC Beam Design Types
 * Beam design and detailing per ACI 318-19
 * 
 * Includes:
 * - Flexural design (rectangular/T-beams)
 * - Shear design
 * - Torsion design
 * - Deflection check
 * - Bar cutoff and development
 * - Seismic detailing
 */

// ============================================================================
// Enums
// ============================================================================

export enum BeamType {
  RECTANGULAR = 'RECTANGULAR',
  T_BEAM = 'T_BEAM',
  L_BEAM = 'L_BEAM',
  INVERTED_T = 'INVERTED_T',
  SPANDREL = 'SPANDREL',
}

export enum SupportCondition {
  SIMPLE = 'SIMPLE',               // Simply supported
  CONTINUOUS = 'CONTINUOUS',       // Continuous over supports
  CANTILEVER = 'CANTILEVER',       // Cantilever
  FIXED = 'FIXED',                 // Fixed ends
}

export enum LoadPattern {
  UNIFORM = 'UNIFORM',             // Uniformly distributed
  CONCENTRATED = 'CONCENTRATED',   // Point loads
  TRIANGULAR = 'TRIANGULAR',       // Triangular distribution
  PARTIAL = 'PARTIAL',             // Partial span loading
}

export enum SeismicBeamCategory {
  ORDINARY = 'ORDINARY',           // Non-seismic
  INTERMEDIATE = 'INTERMEDIATE',   // IMF
  SPECIAL = 'SPECIAL',             // SMF
}

export enum TorsionCategory {
  NEGLIGIBLE = 'NEGLIGIBLE',       // Tu < 0.25φTcr
  COMPATIBILITY = 'COMPATIBILITY', // Statically indeterminate
  EQUILIBRIUM = 'EQUILIBRIUM',     // Statically required
}

// ============================================================================
// Interfaces - Input
// ============================================================================

export interface BeamGeometryInput {
  type: BeamType;
  b: number;               // Web width (in)
  h: number;               // Total depth (in)
  d?: number;              // Effective depth (in) - calculated if not provided
  L: number;               // Span length (ft)
  cover: number;           // Clear cover (in)
  
  // For T-beams
  beff?: number;           // Effective flange width (in)
  hf?: number;             // Flange thickness (in)
  
  // For continuous beams
  supportWidth?: number;   // Width of support (in)
}

export interface BeamMaterialInput {
  fc: number;              // Concrete strength (psi)
  fy: number;              // Flexural steel yield (psi)
  fyt: number;             // Transverse steel yield (psi)
  Es?: number;             // Steel modulus (default 29000 ksi)
  lambda?: number;         // Lightweight factor (1.0 for normal weight)
}

export interface BeamLoadInput {
  // Dead loads
  wD: number;              // Uniform dead load (kip/ft)
  PD?: number[];           // Concentrated dead loads [magnitude, location]
  
  // Live loads
  wL: number;              // Uniform live load (kip/ft)
  PL?: number[];           // Concentrated live loads
  
  // Factored envelope
  Mu_pos: number;          // Maximum positive moment (kip-ft)
  Mu_neg_left?: number;    // Negative moment at left support (kip-ft)
  Mu_neg_right?: number;   // Negative moment at right support
  Vu_left: number;         // Shear at left support (kips)
  Vu_right: number;        // Shear at right support (kips)
  
  // Torsion (if applicable)
  Tu?: number;             // Factored torsion (kip-ft)
}

export interface RCBeamInput {
  designCode: 'ACI_318_19' | 'ACI_318_14' | 'IS_456';
  geometry: BeamGeometryInput;
  materials: BeamMaterialInput;
  loads: BeamLoadInput;
  supportCondition: SupportCondition;
  seismicCategory: SeismicBeamCategory;
  
  // Deflection requirements
  deflectionLimit?: number;  // L/xxx limit
  checkDeflection?: boolean;
  
  // Options
  useStirrups?: boolean;
  maxBarSize?: string;
  preferredStirrupSize?: string;
}

// ============================================================================
// Interfaces - Results
// ============================================================================

export interface FlexuralDesignResult {
  location: 'POSITIVE' | 'NEG_LEFT' | 'NEG_RIGHT';
  Mu: number;
  phi_Mn: number;
  ratio: number;
  isAdequate: boolean;
  
  // Steel
  As_required: number;
  As_min: number;
  As_max: number;
  As_provided: number;
  
  // Bars
  bars: {
    size: string;
    quantity: number;
    layers: number;
  };
  
  // Section behavior
  a: number;               // Stress block depth (in)
  c: number;               // Neutral axis depth (in)
  epsilon_t: number;       // Steel strain
  isCompressionControlled: boolean;
}

export interface ShearDesignResult {
  Vu: number;              // Factored shear at d from face
  phi_Vc: number;          // Concrete contribution
  phi_Vs: number;          // Steel contribution
  phi_Vn: number;          // Total capacity
  ratio: number;
  isAdequate: boolean;
  
  // Stirrups
  stirrups: {
    size: string;
    legs: number;
    spacing_max: number;   // Maximum required spacing
    spacing_min: number;   // Minimum code spacing
    spacing_provided: number;
  };
  
  // Regions
  regions: {
    start: number;         // Distance from support (in)
    end: number;
    spacing: number;
    stirrupSize: string;
  }[];
}

export interface TorsionDesignResult {
  category: TorsionCategory;
  Tu: number;
  phi_Tcr: number;         // Cracking torque
  phi_Tn: number;          // Design torsional capacity
  ratio: number;
  isAdequate: boolean;
  
  // Longitudinal steel for torsion
  Al_required: number;
  
  // Transverse for torsion
  At_s_required: number;   // At/s required
  
  // Combined stirrups (shear + torsion)
  combinedStirrups?: {
    size: string;
    legs: number;
    spacing: number;
  };
}

export interface DeflectionResult {
  Ie: number;              // Effective moment of inertia (in⁴)
  delta_imm: number;       // Immediate deflection (in)
  delta_LT: number;        // Long-term deflection (in)
  delta_total: number;     // Total deflection (in)
  limit: number;           // Allowable deflection (in)
  ratio: number;
  isAdequate: boolean;
}

export interface BarCutoffResult {
  bottom: {
    fullLength: number;    // Bars continuing full length
    cutoff: {
      quantity: number;
      location: number;    // Distance from support face (in)
      developmentOK: boolean;
    }[];
  };
  top: {
    left: {
      quantity: number;
      cutoffLocation: number;  // From left support
    };
    right: {
      quantity: number;
      cutoffLocation: number;  // From right support
    };
  };
}

export interface RCBeamResult {
  isAdequate: boolean;
  
  // Section
  section: {
    b: number;
    h: number;
    d: number;
    beff?: number;
    type: BeamType;
  };
  
  // Flexure
  flexure: {
    positive: FlexuralDesignResult;
    negative_left?: FlexuralDesignResult;
    negative_right?: FlexuralDesignResult;
  };
  
  // Shear
  shear: ShearDesignResult;
  
  // Torsion (if applicable)
  torsion?: TorsionDesignResult;
  
  // Deflection
  deflection?: DeflectionResult;
  
  // Bar cutoff
  barCutoff: BarCutoffResult;
  
  // Seismic requirements
  seismicDetails?: {
    rho_max: number;
    clearSpacing_min: number;
    stirrup_s_max: number;
    hinge_length: number;
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

export const ACI_BEAM_LIMITS = {
  // Reinforcement limits
  rho_min_factor: 3,       // ρ_min = max(3√f'c/fy, 200/fy)
  rho_max_factor: 0.85,    // ρ_max based on 0.85β₁f'c/fy × εcu/(εcu+εy)
  
  // Bar spacing
  min_spacing: 1,          // Minimum clear spacing (in)
  max_spacing: 18,         // Maximum spacing (in)
  
  // Stirrup limits
  Vs_max_factor: 8,        // Vs ≤ 8√f'c × bw × d
  s_max_Vs_low: 0.5,       // s ≤ d/2 when Vs ≤ 4√f'c×bw×d
  s_max_Vs_high: 0.25,     // s ≤ d/4 when Vs > 4√f'c×bw×d
  
  // Development
  ld_factor: {
    top: 1.3,              // Top bar factor
    epoxy: 1.5,            // Epoxy-coated factor
    size: 0.8,             // Size factor for #6 and smaller
  },
};

export const SEISMIC_BEAM_REQUIREMENTS = {
  SMF: {
    rho_max: 0.025,
    As_prime_ratio: 0.5,   // As' ≥ 0.5 × As at any section
    s_max_hinge: [0.25, 8, 24, 12], // d/4, 8db_long, 24db_tie, 12"
    hinge_length_factor: 2, // 2h from column face
  },
  IMF: {
    rho_max: 0.025,
    As_prime_ratio: 0.5,
    s_max_hinge: [0.25, 8, 24, 12],
    hinge_length_factor: 2,
  },
  ORDINARY: {
    rho_max: 0.85 * 0.003 / 0.005, // εcu/(εcu + 0.005)
    As_prime_ratio: 0,
    s_max_hinge: [0.5, 24], // d/2, 24"
  },
};

// Standard rebar data
export const REBAR_DATA_BEAM: Record<string, { 
  db: number; 
  Ab: number; 
  weight: number 
}> = {
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

// T-beam effective width coefficients
export const T_BEAM_BEFF = {
  interior: {
    L_factor: 0.25,        // L/4
    spacing_factor: 1.0,   // ≤ beam spacing
    overhang: 8,           // 8×hf each side
  },
  edge: {
    L_factor: 0.125,       // L/12
    overhang: 6,           // 6×hf one side
  },
};
