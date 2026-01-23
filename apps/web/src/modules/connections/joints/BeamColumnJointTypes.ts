/**
 * Beam-Column Joint Types
 * RC joint design per ACI 352R-02 and ACI 318-19
 * 
 * Includes:
 * - Interior joints
 * - Exterior joints
 * - Corner joints
 * - Roof joints
 * - Joint shear
 * - Confinement requirements
 */

// ============================================================================
// Enums
// ============================================================================

export enum JointType {
  INTERIOR = 'INTERIOR',       // Four beams framing
  EXTERIOR = 'EXTERIOR',       // Three beams framing
  CORNER = 'CORNER',           // Two beams framing (corner)
  KNEE = 'KNEE',               // Two beams (same direction)
  ROOF_INTERIOR = 'ROOF_INT',  // Interior at roof
  ROOF_EXTERIOR = 'ROOF_EXT',  // Exterior at roof
}

export enum JointClassification {
  TYPE_1 = 'TYPE_1',           // Non-seismic (gravity)
  TYPE_2 = 'TYPE_2',           // Seismic (moment frame)
}

export enum SeismicDesignCategory {
  A = 'A',
  B = 'B',
  C = 'C',
  D = 'D',
  E = 'E',
  F = 'F',
}

export enum ConfinementType {
  NONE = 'NONE',
  TIES = 'TIES',
  SPIRALS = 'SPIRALS',
  CROSSTIES = 'CROSSTIES',
}

export enum JointFailureMode {
  JOINT_SHEAR = 'JOINT_SHEAR',
  BOND = 'BOND',
  ANCHORAGE = 'ANCHORAGE',
  BEARING = 'BEARING',
}

// ============================================================================
// Interfaces - Input
// ============================================================================

export interface ColumnProperties {
  b: number;                // Column width perpendicular to joint shear
  h: number;                // Column depth in direction of joint shear
  Ag: number;               // Gross area
  Ast: number;              // Total longitudinal steel area
  rho_g: number;            // Longitudinal reinforcement ratio
  fc: number;               // Concrete strength (psi)
  fy: number;               // Steel yield strength (psi)
  db_long: number;          // Longitudinal bar diameter
  cover: number;            // Clear cover to ties
}

export interface BeamProperties {
  b: number;                // Beam width
  h: number;                // Beam depth
  d: number;                // Effective depth
  As_top: number;           // Top reinforcement area
  As_bot: number;           // Bottom reinforcement area
  db_top: number;           // Top bar diameter
  db_bot: number;           // Bottom bar diameter
  fc: number;               // Concrete strength
  fy: number;               // Steel yield strength
}

export interface JointShearInput {
  Mu_beam_left?: number;    // Moment from left beam (positive = tension top)
  Mu_beam_right?: number;   // Moment from right beam
  Mu_beam_top?: number;     // Moment from beam above (for knee joints)
  Mu_beam_bot?: number;     // Moment from beam below
  Vu_col_above: number;     // Column shear above joint
  Vu_col_below: number;     // Column shear below joint
  Pu_col: number;           // Column axial force (positive = compression)
}

export interface BeamColumnJointInput {
  designCode: 'ACI_318_19' | 'ACI_352R_02' | 'IS_13920' | 'EC8';
  jointType: JointType;
  classification: JointClassification;
  seismicCategory: SeismicDesignCategory;
  
  // Geometry
  column: ColumnProperties;
  beam_primary: BeamProperties;      // Primary direction beam
  beam_secondary?: BeamProperties;   // Secondary direction beam (if any)
  
  // Forces
  forces: JointShearInput;
  
  // Story information
  storyHeight: number;
  
  // Options
  considerBidirectional?: boolean;
  useProbableStrengths?: boolean;
}

// ============================================================================
// Interfaces - Results
// ============================================================================

export interface JointShearResult {
  Vj: number;               // Joint shear force (horizontal)
  Vn: number;               // Nominal joint shear strength
  phi_Vn: number;           // Design joint shear strength
  ratio: number;            // Demand/capacity ratio
  isAdequate: boolean;
  gamma: number;            // Joint shear stress coefficient
}

export interface JointConfinementResult {
  required: boolean;
  Ash_required: number;     // Required transverse reinforcement area
  s_max: number;            // Maximum tie spacing
  ties: {
    size: string;           // Tie bar size
    legs: number;           // Number of legs
    spacing: number;        // Provided spacing
    Ash_provided: number;   // Provided area
  };
  isAdequate: boolean;
}

export interface AnchorageResult {
  beam_bars_top: {
    db: number;
    ldh_required: number;   // Standard hook development
    ldh_available: number;
    isAdequate: boolean;
  };
  beam_bars_bot: {
    db: number;
    ldh_required: number;
    ldh_available: number;
    isAdequate: boolean;
  };
  column_bars: {
    continuity: 'CONTINUOUS' | 'SPLICED';
    splice_class?: 'A' | 'B';
  };
}

export interface BeamColumnJointResult {
  isAdequate: boolean;
  
  jointType: JointType;
  classification: JointClassification;
  
  // Dimensions
  effectiveJointWidth: number;
  effectiveJointDepth: number;
  effectiveJointArea: number;
  
  // Shear check
  jointShear: JointShearResult;
  
  // Confinement
  confinement: JointConfinementResult;
  
  // Anchorage
  anchorage: AnchorageResult;
  
  // Strong column - weak beam check
  strongColumnWeakBeam?: {
    sum_Mnc: number;        // Sum of column moment strengths
    sum_Mnb: number;        // Sum of beam moment strengths
    ratio: number;          // Mnc/Mnb ratio (must be ≥ 1.2 for Type 2)
    isAdequate: boolean;
  };
  
  // Development length within joint
  bondRequirement?: {
    hc_min: number;         // Minimum column depth for bond
    hc_provided: number;    // Provided column depth
    ratio: number;
    isAdequate: boolean;
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

// Joint shear stress coefficients (gamma) per ACI 352R
export const JOINT_SHEAR_COEFFICIENTS = {
  // Type 1 connections (non-seismic)
  TYPE_1: {
    INTERIOR: 24,
    EXTERIOR: 20,
    CORNER: 15,
    KNEE: 12,
  },
  // Type 2 connections (seismic)
  TYPE_2: {
    INTERIOR: 20,
    EXTERIOR: 15,
    CORNER: 12,
    KNEE: 10,
  },
};

// Confinement requirements
export const CONFINEMENT_LIMITS = {
  // Minimum spacing
  s_max_type1: 6,           // inches for Type 1
  s_max_type2: 4,           // inches for Type 2
  
  // Minimum Ash/s factor
  ash_factor_type2: 0.09,   // f'c/fyt factor for Type 2
  
  // Bar size requirements
  min_tie_size_type2: '#4', // Minimum tie size for Type 2
};

// Development length factors
export const DEVELOPMENT_FACTORS = {
  // Standard hook development
  ldh_factor: 0.02,         // Factor for standard hook in normal weight concrete
  
  // Straight bar development
  ld_factor: 0.04,          // Factor for straight bar development
  
  // Modification factors
  psi_e: 1.0,               // Coating factor (uncoated)
  psi_c: 1.0,               // Casting position factor
  psi_t_top: 1.3,           // Top bar factor
  psi_t_other: 1.0,         // Other bar factor
};

// Strong column - weak beam ratio
export const SCWB_RATIO = {
  TYPE_1: 1.0,              // No requirement for Type 1
  TYPE_2: 1.2,              // Minimum ratio for Type 2
  RECOMMENDED: 1.4,         // Recommended ratio
};
