/**
 * Splice Connection Types
 * Steel column splices, beam splices, and RC bar splices
 * Per AISC 360/341 and ACI 318
 * 
 * Includes:
 * - Column splices (bolted/welded)
 * - Beam splices (moment/shear)
 * - Partial joint penetration splices
 * - Bearing splices
 * - Tension splices
 */

// ============================================================================
// Enums
// ============================================================================

export enum SpliceType {
  // Steel Column Splices
  COLUMN_BOLTED_FLANGE = 'COL_BOLT_FLG',     // Bolted flange plates
  COLUMN_WELDED_FLANGE = 'COL_WELD_FLG',     // Welded flange
  COLUMN_BOLTED_WEB = 'COL_BOLT_WEB',        // Bolted web plates (with flange)
  COLUMN_CJP = 'COL_CJP',                     // Complete joint penetration
  COLUMN_PJP = 'COL_PJP',                     // Partial joint penetration
  COLUMN_BEARING = 'COL_BEARING',             // Bearing splice (finish to bear)
  
  // Steel Beam Splices
  BEAM_MOMENT = 'BEAM_MOMENT',                // Full moment splice
  BEAM_SHEAR_ONLY = 'BEAM_SHEAR',             // Shear-only splice
  BEAM_BOLTED_WEB = 'BEAM_BOLT_WEB',          // Bolted web splice
  BEAM_FLANGE_PLATE = 'BEAM_FLG_PLATE',       // Flange plate splice
}

export enum SpliceLocation {
  // Column splice locations
  ABOVE_FLOOR = 'ABOVE_FLOOR',     // 4 ft above floor (typical)
  AT_FLOOR = 'AT_FLOOR',           // At floor level
  MID_HEIGHT = 'MID_HEIGHT',       // Mid-height of story
  
  // Beam splice locations
  NEAR_SUPPORT = 'NEAR_SUPPORT',   // Near support (low moment)
  QUARTER_SPAN = 'QUARTER_SPAN',   // Quarter point of span
  MID_SPAN = 'MID_SPAN',           // Mid-span (for continuous beams)
}

export enum ColumnSpliceDesignLevel {
  STANDARD = 'STANDARD',           // Non-seismic (50% capacity)
  INTERMEDIATE = 'INTERMEDIATE',   // IMF/OCBF (higher requirements)
  SPECIAL = 'SPECIAL',             // SMF/SCBF (highest requirements)
}

export enum SpliceMaterial {
  A572_GR50 = 'A572_GR50',
  A992 = 'A992',
  A36 = 'A36',
  A913_GR65 = 'A913_GR65',
}

// ============================================================================
// Interfaces - Input
// ============================================================================

export interface ColumnSectionData {
  designation: string;
  d: number;               // Depth
  bf: number;              // Flange width
  tf: number;              // Flange thickness
  tw: number;              // Web thickness
  k: number;               // Fillet distance
  T: number;               // Web clear depth
  A: number;               // Area
  Ix: number;              // Moment of inertia x
  Iy: number;              // Moment of inertia y
  Sx: number;              // Section modulus x
  Sy: number;              // Section modulus y
  Zx: number;              // Plastic section modulus x
  Zy: number;              // Plastic section modulus y
  Fy: number;              // Yield strength
  Fu: number;              // Tensile strength
}

export interface ColumnSpliceInput {
  designCode: 'AISC_360_22' | 'AISC_341_22' | 'EC3';
  spliceType: SpliceType;
  designLevel: ColumnSpliceDesignLevel;
  location: SpliceLocation;
  
  // Columns
  columnAbove: ColumnSectionData;
  columnBelow: ColumnSectionData;
  
  // Forces at splice
  Pu: number;              // Factored axial (positive = compression)
  Mux: number;             // Factored moment about x-axis
  Muy: number;             // Factored moment about y-axis
  Vu: number;              // Factored shear
  
  // For seismic
  expectedStrengthFactor?: number;  // Ry for expected strength
  
  // Material
  splicePlate: {
    Fy: number;
    Fu: number;
    thickness?: number;    // Will be designed if not provided
  };
  
  // Fasteners
  bolts?: {
    type: 'A325' | 'A490' | 'F3125_A325' | 'F3125_A490';
    diameter: number;
    pretensioned: boolean;
    slipCritical: boolean;
  };
  
  // Welds
  welds?: {
    electrode: number;     // FEXX
    type: 'FILLET' | 'CJP' | 'PJP';
    pjpThroat?: number;    // For PJP welds
  };
  
  // Options
  finishToBear: boolean;   // Bearing splice option
  erectionBolts: number;   // Number of erection bolts
}

export interface BeamSpliceInput {
  designCode: 'AISC_360_22' | 'AISC_341_22';
  spliceType: SpliceType;
  location: SpliceLocation;
  
  // Beam section
  beam: ColumnSectionData;
  
  // Forces at splice
  Mu: number;              // Factored moment
  Vu: number;              // Factored shear
  
  // Splice plates
  flangePlate?: {
    width: number;
    thickness: number;
    Fy: number;
    Fu: number;
  };
  webPlate?: {
    depth: number;
    thickness: number;
    Fy: number;
    Fu: number;
  };
  
  // Bolts
  bolts: {
    type: 'A325' | 'A490';
    diameter: number;
    pretensioned: boolean;
  };
}

// ============================================================================
// Interfaces - Results
// ============================================================================

export interface ColumnSpliceResult {
  isAdequate: boolean;
  spliceType: SpliceType;
  
  // Geometry
  flangePlates?: {
    thickness: number;
    width: number;
    length: number;
    quantity: number;      // Usually 4 (2 per flange)
  };
  webPlates?: {
    thickness: number;
    depth: number;
    length: number;
    quantity: number;      // Usually 2
  };
  
  // Fasteners
  bolts?: {
    size: string;
    quantity: number;
    rows: number;
    columns: number;
    spacing: number;
    edgeDistance: number;
  };
  
  // Welds
  welds?: {
    flangeWeld: {
      type: string;
      size?: number;
      length?: number;
    };
    webWeld?: {
      type: string;
      size?: number;
      length?: number;
    };
  };
  
  // Capacity checks
  checks: {
    name: string;
    demand: number;
    capacity: number;
    ratio: number;
    status: 'OK' | 'NG' | 'WARN';
    reference: string;
  }[];
  
  // Design notes
  notes: string[];
  
  calculations: CalculationStep[];
  codeReference: string;
}

export interface BeamSpliceResult {
  isAdequate: boolean;
  spliceType: SpliceType;
  
  // Components
  flangePlates?: {
    top: { thickness: number; width: number; length: number };
    bottom: { thickness: number; width: number; length: number };
    bolts: number;
  };
  webPlates?: {
    thickness: number;
    depth: number;
    length: number;
    bolts: number;
  };
  
  // Checks
  checks: {
    name: string;
    demand: number;
    capacity: number;
    ratio: number;
    status: 'OK' | 'NG' | 'WARN';
    reference: string;
  }[];
  
  calculations: CalculationStep[];
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

// Minimum splice design forces per AISC
export const SPLICE_DESIGN_REQUIREMENTS = {
  // Non-seismic column splice
  STANDARD: {
    flange_tension: 0.5,   // 50% of Fy × Af (flange area)
    shear: 1.0,            // 100% of required shear
  },
  // Intermediate seismic
  INTERMEDIATE: {
    flange_tension: 0.5,
    expected_factor: 1.1,  // Ry factor
  },
  // Special seismic (AISC 341)
  SPECIAL: {
    flange_tension: 1.0,   // 100% of expected Fy × Af
    expected_Ry: 1.1,      // Expected yield ratio
    web_shear: 1.0,        // 100% of expected shear
  },
};

// Column splice plate limits
export const SPLICE_PLATE_LIMITS = {
  min_thickness: 0.5,      // Minimum plate thickness (in)
  min_width_factor: 1.1,   // Minimum width = 1.1 × flange width
  min_length_factor: 1.5,  // Minimum length based on bolt pattern
  max_edge_distance: 12,   // Maximum edge distance (times bolt diameter)
};

// Bolt spacing requirements
export const BOLT_SPACING = {
  min_spacing_factor: 2.67, // Minimum = 2⅔ × d
  preferred_spacing: 3,     // Preferred = 3 × d
  min_edge: 1.5,            // Minimum edge = 1.5 × d (sheared edge)
  min_edge_rolled: 1.25,    // Minimum edge = 1.25 × d (rolled edge)
};

// Standard bolt data
export const BOLT_DATA: Record<string, {
  Ab: number;              // Nominal area
  Fnt: number;             // Nominal tensile stress (ksi)
  Fnv: number;             // Nominal shear stress (ksi) - threads excluded
  Tb: number;              // Minimum pretension (kips)
}> = {
  'A325_3/4': { Ab: 0.442, Fnt: 90, Fnv: 54, Tb: 28 },
  'A325_7/8': { Ab: 0.601, Fnt: 90, Fnv: 54, Tb: 39 },
  'A325_1': { Ab: 0.785, Fnt: 90, Fnv: 54, Tb: 51 },
  'A325_1-1/8': { Ab: 0.994, Fnt: 90, Fnv: 54, Tb: 56 },
  'A490_3/4': { Ab: 0.442, Fnt: 113, Fnv: 68, Tb: 35 },
  'A490_7/8': { Ab: 0.601, Fnt: 113, Fnv: 68, Tb: 49 },
  'A490_1': { Ab: 0.785, Fnt: 113, Fnv: 68, Tb: 64 },
  'A490_1-1/8': { Ab: 0.994, Fnt: 113, Fnv: 68, Tb: 80 },
};

// Bearing splice requirements
export const BEARING_SPLICE = {
  contact_factor: 1.5,     // Factor for finish-to-bear contact
  erection_bolts_min: 4,   // Minimum erection bolts
  erection_bolts_typical: 8, // Typical for heavy columns
};
