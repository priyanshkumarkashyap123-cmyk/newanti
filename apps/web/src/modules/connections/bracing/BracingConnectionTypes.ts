/**
 * Bracing Connection Types
 * Gusset plate connections for braced frames per AISC 341/360
 * 
 * Includes:
 * - Concentrically Braced Frames (SCBF, OCBF)
 * - Eccentrically Braced Frames (EBF)
 * - Buckling-Restrained Braced Frames (BRBF)
 * - Vertical/Chevron bracing
 * - Single/Double angle braces
 * - HSS/Pipe braces
 * - Wide flange braces
 */

// ============================================================================
// Enums
// ============================================================================

export enum BracingSystemType {
  SCBF = 'SCBF',           // Special Concentrically Braced Frame
  OCBF = 'OCBF',           // Ordinary Concentrically Braced Frame
  EBF = 'EBF',             // Eccentrically Braced Frame
  BRBF = 'BRBF',           // Buckling-Restrained Braced Frame
}

export enum BraceConfiguration {
  DIAGONAL = 'DIAGONAL',     // Single diagonal
  X_BRACE = 'X_BRACE',       // X-bracing
  CHEVRON = 'CHEVRON',       // Inverted V (chevron)
  V_BRACE = 'V_BRACE',       // V-bracing
  K_BRACE = 'K_BRACE',       // K-bracing (generally avoided in seismic)
  TWO_STORY_X = 'TWO_STORY_X', // Two-story X-brace
}

export enum BraceSectionType {
  HSS_ROUND = 'HSS_ROUND',   // Round HSS
  HSS_RECT = 'HSS_RECT',     // Rectangular HSS
  PIPE = 'PIPE',             // Standard pipe
  WIDE_FLANGE = 'WF',        // Wide flange
  DOUBLE_ANGLE = 'DBL_ANGLE', // Double angle
  SINGLE_ANGLE = 'SGL_ANGLE', // Single angle
  CHANNEL = 'CHANNEL',        // Double channel
  WT = 'WT',                  // Structural tee
}

export enum GussetConnectionType {
  CORNER = 'CORNER',           // Beam-column-brace at corner
  BEAM_MID = 'BEAM_MID',       // Brace to beam midspan (chevron)
  COLUMN_MID = 'COLUMN_MID',   // Brace to column mid-height
}

export enum GussetInterfaceType {
  WELDED = 'WELDED',           // Welded to frame
  BOLTED = 'BOLTED',           // Bolted to frame
  EXTENDED = 'EXTENDED',       // Extended gusset (free edge)
}

export enum BraceToGussetConnection {
  SLOTTED_HSS = 'SLOTTED_HSS',     // Slotted HSS with welds
  WELDED_WF = 'WELDED_WF',         // Welded wide flange
  BOLTED_ANGLES = 'BOLTED_ANGLES', // Bolted angle connection
  END_PLATE = 'END_PLATE',         // End plate connection
}

// ============================================================================
// Interfaces - Section Data
// ============================================================================

export interface HSSRoundData {
  designation: string;
  OD: number;              // Outside diameter
  t: number;               // Wall thickness
  A: number;               // Area
  I: number;               // Moment of inertia
  S: number;               // Section modulus
  r: number;               // Radius of gyration
  Z: number;               // Plastic section modulus
  Fy: number;
  Fu: number;
}

export interface HSSRectData {
  designation: string;
  Ht: number;              // Height
  B: number;               // Width
  t: number;               // Wall thickness
  A: number;
  Ix: number;
  Iy: number;
  Sx: number;
  Sy: number;
  rx: number;
  ry: number;
  Zx: number;
  Zy: number;
  Fy: number;
  Fu: number;
}

export interface AngleData {
  designation: string;
  longLeg: number;
  shortLeg: number;
  thickness: number;
  A: number;
  rx: number;
  ry: number;
  rz: number;              // Minimum radius of gyration
  Fy: number;
  Fu: number;
}

// ============================================================================
// Interfaces - Input
// ============================================================================

export interface GussetPlateInput {
  designCode: 'AISC_341_22' | 'AISC_360_22' | 'EC3' | 'IS_800';
  systemType: BracingSystemType;
  configuration: BraceConfiguration;
  connectionType: GussetConnectionType;
  
  // Brace properties
  braceSection: {
    type: BraceSectionType;
    designation: string;
    A: number;              // Area
    r_min: number;          // Minimum radius of gyration
    Ag: number;             // Gross area
    An?: number;            // Net area (if applicable)
    Fy: number;
    Fu: number;
    Ry: number;             // Expected yield ratio (1.1-1.5)
    Rt: number;             // Expected tensile ratio
  };
  braceLength: number;      // Work-point to work-point length
  braceAngle: number;       // Angle from horizontal (degrees)
  
  // Design forces
  Pu_tension: number;       // Factored tension
  Pu_compression: number;   // Factored compression
  
  // Expected strengths (for capacity design)
  Pn_expected_tension?: number;
  Pn_expected_compression?: number;
  
  // Gusset plate
  gussetFy: number;
  gussetFu: number;
  gussetThickness?: number; // Will be designed if not provided
  
  // Weld properties
  weldElectrode: number;    // FEXX (70, 80, etc.)
  weldType: 'FILLET' | 'CJP' | 'PJP';
  
  // Frame member properties (for interface design)
  beam?: {
    d: number;
    bf: number;
    tf: number;
    tw: number;
    Fy: number;
  };
  column?: {
    d: number;
    bf: number;
    tf: number;
    tw: number;
    Fy: number;
  };
  
  // Connection details
  interfaceType: GussetInterfaceType;
  braceToGusset: BraceToGussetConnection;
  
  // Clearances
  linear_clearance?: number;   // 2t_gusset typical
  elliptical_clearance?: boolean; // Use 8t clearance zone
}

export interface BraceConnectionInput {
  designCode: 'AISC_341_22' | 'AISC_360_22';
  systemType: BracingSystemType;
  
  // Brace
  braceType: BraceSectionType;
  braceDesignation: string;
  braceProperties: {
    A: number;
    r: number;
    Fy: number;
    Fu: number;
  };
  
  // For slotted HSS
  slotLength?: number;
  reinforcingPlate?: {
    thickness: number;
    length: number;
    width: number;
  };
  
  // Welds
  weldSize: number;
  weldLength: number;
  
  // Forces
  Pu: number;
}

// ============================================================================
// Interfaces - Results
// ============================================================================

export interface GussetPlateResult {
  isAdequate: boolean;
  
  // Gusset geometry
  gusset: {
    thickness: number;
    length_beam: number;      // Length along beam
    length_column: number;    // Length along column
    length_brace: number;     // Length along brace
    whitmore_width: number;   // Whitmore effective width
    area_whitmore: number;    // Whitmore section area
  };
  
  // Clearance zones
  clearance: {
    type: 'LINEAR' | 'ELLIPTICAL';
    dimension: number;
  };
  
  // Strength checks
  checks: {
    name: string;
    demand: number;
    capacity: number;
    ratio: number;
    status: 'OK' | 'NG' | 'WARN';
    reference: string;
  }[];
  
  // Interface design
  beamInterface?: {
    weldSize: number;
    weldLength: number;
    forceHorizontal: number;
    forceVertical: number;
  };
  
  columnInterface?: {
    weldSize: number;
    weldLength: number;
    forceHorizontal: number;
    forceVertical: number;
  };
  
  // Brace-to-gusset connection
  braceConnection: {
    type: BraceToGussetConnection;
    weldSize?: number;
    weldLength?: number;
    slotLength?: number;
    blockShearCapacity?: number;
    netSectionCapacity?: number;
  };
  
  // Special requirements for SCBF
  scbfRequirements?: {
    ductileLimit: boolean;
    clearanceProvided: boolean;
    yielding_section: 'BRACE' | 'GUSSET' | 'CONNECTION';
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
// Constants - Standard Sections
// ============================================================================

export const HSS_ROUND_SECTIONS: Record<string, Partial<HSSRoundData>> = {
  'HSS20.000x0.500': { OD: 20, t: 0.465, A: 28.5, r: 6.90 },
  'HSS18.000x0.500': { OD: 18, t: 0.465, A: 25.6, r: 6.20 },
  'HSS16.000x0.500': { OD: 16, t: 0.465, A: 22.7, r: 5.50 },
  'HSS14.000x0.500': { OD: 14, t: 0.465, A: 19.8, r: 4.79 },
  'HSS12.750x0.500': { OD: 12.75, t: 0.465, A: 17.9, r: 4.35 },
  'HSS10.750x0.500': { OD: 10.75, t: 0.465, A: 15.0, r: 3.64 },
  'HSS10.000x0.500': { OD: 10, t: 0.465, A: 13.9, r: 3.38 },
  'HSS8.625x0.500': { OD: 8.625, t: 0.465, A: 11.9, r: 2.89 },
  'HSS8.625x0.375': { OD: 8.625, t: 0.349, A: 9.07, r: 2.93 },
  'HSS7.500x0.500': { OD: 7.5, t: 0.465, A: 10.3, r: 2.49 },
  'HSS7.000x0.500': { OD: 7, t: 0.465, A: 9.53, r: 2.31 },
  'HSS6.625x0.500': { OD: 6.625, t: 0.465, A: 9.00, r: 2.18 },
  'HSS6.625x0.375': { OD: 6.625, t: 0.349, A: 6.87, r: 2.22 },
  'HSS6.000x0.500': { OD: 6, t: 0.465, A: 8.09, r: 1.96 },
  'HSS5.563x0.375': { OD: 5.563, t: 0.349, A: 5.72, r: 1.84 },
  'HSS5.000x0.375': { OD: 5, t: 0.349, A: 5.10, r: 1.64 },
};

export const HSS_RECT_SECTIONS: Record<string, Partial<HSSRectData>> = {
  'HSS12x12x5/8': { Ht: 12, B: 12, t: 0.581, A: 25.7, rx: 4.57, ry: 4.57 },
  'HSS12x12x1/2': { Ht: 12, B: 12, t: 0.465, A: 21.0, rx: 4.64, ry: 4.64 },
  'HSS10x10x5/8': { Ht: 10, B: 10, t: 0.581, A: 21.0, rx: 3.78, ry: 3.78 },
  'HSS10x10x1/2': { Ht: 10, B: 10, t: 0.465, A: 17.2, rx: 3.85, ry: 3.85 },
  'HSS10x10x3/8': { Ht: 10, B: 10, t: 0.349, A: 13.1, rx: 3.91, ry: 3.91 },
  'HSS8x8x5/8': { Ht: 8, B: 8, t: 0.581, A: 16.4, rx: 2.99, ry: 2.99 },
  'HSS8x8x1/2': { Ht: 8, B: 8, t: 0.465, A: 13.5, rx: 3.05, ry: 3.05 },
  'HSS8x8x3/8': { Ht: 8, B: 8, t: 0.349, A: 10.4, rx: 3.11, ry: 3.11 },
  'HSS8x6x1/2': { Ht: 8, B: 6, t: 0.465, A: 11.7, rx: 2.93, ry: 2.27 },
  'HSS8x6x3/8': { Ht: 8, B: 6, t: 0.349, A: 9.07, rx: 2.99, ry: 2.32 },
  'HSS6x6x1/2': { Ht: 6, B: 6, t: 0.465, A: 9.74, rx: 2.25, ry: 2.25 },
  'HSS6x6x3/8': { Ht: 6, B: 6, t: 0.349, A: 7.58, rx: 2.30, ry: 2.30 },
  'HSS6x4x1/2': { Ht: 6, B: 4, t: 0.465, A: 7.88, rx: 2.12, ry: 1.49 },
  'HSS6x4x3/8': { Ht: 6, B: 4, t: 0.349, A: 6.18, rx: 2.17, ry: 1.53 },
};

// SCBF limits per AISC 341
export const SCBF_LIMITS = {
  kl_r_max: 200,           // Maximum slenderness
  b_t_round: 0.044,        // D/t ≤ 0.044 E/Fy for round HSS
  b_t_rect: 0.64,          // b/t ≤ 0.64 √(E/Fy) for rectangular HSS
  ry_min_factor: 1.1,      // Ry minimum
  whitmore_angle: 30,      // Whitmore spread angle (degrees)
  clearance_factor: 2,     // Linear clearance = 2t
  ellipse_factor: 8,       // Elliptical clearance = 8t
};
