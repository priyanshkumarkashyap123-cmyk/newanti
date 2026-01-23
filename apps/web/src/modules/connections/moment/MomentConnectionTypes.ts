/**
 * Moment Connection Types
 * Pre-qualified moment connections per AISC 358 and Eurocode 3
 * 
 * Includes:
 * - Reduced Beam Section (RBS) "Dogbone"
 * - Bolted Flange Plate (BFP)
 * - Welded Unreinforced Flange-Welded Web (WUF-W)
 * - Extended End Plate (EEP)
 * - Bolted Stiffened End Plate (BSEP)
 * - Kaiser Bolted Bracket (KBB)
 * - SidePlate connections
 */

// ============================================================================
// Enums
// ============================================================================

export enum MomentConnectionType {
  // AISC 358 Pre-qualified Connections
  RBS = 'RBS',                    // Reduced Beam Section
  BFP = 'BFP',                    // Bolted Flange Plate
  BUEEP = 'BUEEP',               // Bolted Unstiffened Extended End Plate
  BSEEP = 'BSEEP',               // Bolted Stiffened Extended End Plate
  WUF_W = 'WUF_W',               // Welded Unreinforced Flange-Welded Web
  WUF_B = 'WUF_B',               // Welded Unreinforced Flange-Bolted Web
  FF = 'FF',                      // Free Flange
  KBB = 'KBB',                    // Kaiser Bolted Bracket
  SIDEPLATE = 'SIDEPLATE',        // SidePlate
  
  // Eurocode Connections
  FLUSH_END_PLATE = 'FLUSH_EP',   // Flush End Plate
  EXTENDED_END_PLATE = 'EXT_EP',  // Extended End Plate
  WELDED_HAUNCH = 'WELDED_HAUNCH', // Welded Haunch
}

export enum MomentConnectionDesignCode {
  AISC_358_22 = 'AISC_358_22',    // AISC 358-22
  AISC_358_16 = 'AISC_358_16',    // AISC 358-16
  EUROCODE_3 = 'EN_1993_1_8',     // EN 1993-1-8
  IS_800 = 'IS_800_2007',         // IS 800:2007
}

export enum SeismicDesignCategory {
  SDC_A = 'A',
  SDC_B = 'B', 
  SDC_C = 'C',
  SDC_D = 'D',
  SDC_E = 'E',
  SDC_F = 'F',
}

export enum FrameType {
  SMF = 'SMF',      // Special Moment Frame
  IMF = 'IMF',      // Intermediate Moment Frame
  OMF = 'OMF',      // Ordinary Moment Frame
}

export enum PanelZoneAction {
  STRONG = 'STRONG',     // Strong panel zone (no doubler)
  WEAK = 'WEAK',         // Weak panel zone (needs doubler)
  BALANCED = 'BALANCED', // Balanced design
}

// ============================================================================
// Interfaces - Input
// ============================================================================

export interface WideFlangeSectionData {
  designation: string;
  d: number;      // Total depth
  bf: number;     // Flange width
  tf: number;     // Flange thickness
  tw: number;     // Web thickness
  k: number;      // Distance from outer face of flange to web toe of fillet
  T: number;      // Distance between flanges less fillets
  Zx: number;     // Plastic section modulus (strong axis)
  Zy: number;     // Plastic section modulus (weak axis)
  A: number;      // Cross-sectional area
  Ix: number;     // Moment of inertia (strong axis)
  Iy: number;     // Moment of inertia (weak axis)
  ry: number;     // Radius of gyration (weak axis)
  Fy: number;     // Yield strength
  Fu: number;     // Ultimate strength
}

export interface RBSInput {
  designCode: MomentConnectionDesignCode;
  frameType: FrameType;
  
  // Beam properties
  beam: WideFlangeSectionData;
  beamSpan: number;        // Clear span Lh (in or mm)
  beamFy: number;          // Beam yield strength
  beamFu: number;          // Beam ultimate strength
  Ry: number;              // Ratio of expected to specified yield (1.1 for A992)
  Cpr: number;             // Peak connection strength factor (typically 1.15)
  
  // Column properties
  column: WideFlangeSectionData;
  columnFy: number;
  
  // Design forces
  Mu: number;              // Required moment strength (factored)
  Vu: number;              // Required shear strength (factored)
  
  // RBS geometry (optional - will be calculated if not provided)
  a?: number;              // Distance from face of column to start of RBS
  b?: number;              // Length of RBS cut
  c?: number;              // Depth of cut at center
  
  // Connection details
  shearTabThickness?: number;
  shearTabDepth?: number;
  numShearBolts?: number;
  shearBoltDiameter?: number;
  
  // Analysis options
  checkPanelZone?: boolean;
  checkColumnFlexure?: boolean;
  checkLatBracingAtRBS?: boolean;
}

export interface BFPInput {
  designCode: MomentConnectionDesignCode;
  frameType: FrameType;
  
  beam: WideFlangeSectionData;
  column: WideFlangeSectionData;
  beamSpan: number;
  
  // Flange plate properties
  flangeplateFy: number;
  flangeplateFu: number;
  topPlateWidth?: number;
  topPlateThickness?: number;
  bottomPlateWidth?: number;
  bottomPlateThickness?: number;
  
  // Bolts
  boltDiameter: number;
  boltFu: number;         // Bolt ultimate (e.g., 120 ksi for A490)
  numBoltsPerRow: number;
  numRows: number;
  boltGage: number;
  boltPitch: number;
  
  // Welds
  plateToColumnWeldSize: number;
  weldType: 'CJP' | 'FILLET';
  
  Ry: number;
  Cpr: number;
}

export interface EndPlateInput {
  designCode: MomentConnectionDesignCode;
  frameType: FrameType;
  connectionType: 'BUEEP' | 'BSEEP' | 'FLUSH_EP' | 'EXT_EP';
  
  beam: WideFlangeSectionData;
  column: WideFlangeSectionData;
  beamSpan: number;
  
  // End plate geometry
  endPlateWidth: number;
  endPlateThickness: number;
  endPlateFy: number;
  endPlateFu: number;
  
  // Stiffener (for BSEEP)
  stiffenerThickness?: number;
  stiffenerLength?: number;
  
  // Bolts
  boltDiameter: number;
  boltFu: number;
  numBoltsOutsideTensionFlange: number;
  numBoltsBetweenFlanges: number;
  boltGageOutside: number;
  boltGageInside: number;
  boltPitchOutside: number;
  boltPitchInside: number;
  pfo: number;            // Distance from face of beam flange to first row of bolts
  pfi: number;            // Distance from face of beam flange to first inside row
  
  Ry: number;
  Cpr: number;
}

// ============================================================================
// Interfaces - Results
// ============================================================================

export interface RBSResult {
  isAdequate: boolean;
  
  // RBS geometry
  a: number;               // Distance from column to start of cut
  b: number;               // Length of cut
  c: number;               // Depth of cut at center
  R: number;               // Radius of cut
  
  // Section properties at RBS
  ZRBS: number;            // Plastic section modulus at RBS
  SRBS: number;            // Elastic section modulus at RBS
  
  // Strength values
  Mpr: number;             // Probable maximum moment at RBS
  Mf: number;              // Moment at face of column
  Vpr: number;             // Probable shear at RBS
  VfColumn: number;        // Shear at face of column
  
  // Capacity checks
  checks: {
    name: string;
    demand: number;
    capacity: number;
    ratio: number;
    status: 'OK' | 'NG' | 'WARN';
    reference: string;
  }[];
  
  // Panel zone
  panelZone?: {
    Vp: number;            // Panel zone shear demand
    phiRv: number;         // Panel zone shear capacity
    doublerRequired: boolean;
    doublerThickness?: number;
    ratio: number;
  };
  
  // Continuity plates
  continuityPlates: {
    required: boolean;
    thickness?: number;
    reason?: string;
  };
  
  // Web connection
  webConnection: {
    shearTabThickness: number;
    shearTabDepth: number;
    numBolts: number;
    boltDiameter: number;
    weldSize: number;
  };
  
  // Lateral bracing
  lateralBracing: {
    Lb_max: number;        // Maximum unbraced length
    requiredAtRBS: boolean;
  };
  
  calculations: CalculationStep[];
  codeReference: string;
}

export interface BFPResult {
  isAdequate: boolean;
  
  // Plate sizing
  topPlate: {
    width: number;
    thickness: number;
    length: number;
  };
  bottomPlate: {
    width: number;
    thickness: number;
    length: number;
  };
  
  // Bolt design
  bolts: {
    diameter: number;
    numBoltsPerRow: number;
    numRows: number;
    totalBolts: number;
    tensionPerBolt: number;
    shearPerBolt: number;
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
  
  // Welds
  welds: {
    plateToColumnType: string;
    plateToColumnSize: number;
    plateToBeamType: string;
    plateToBeamSize: number;
  };
  
  panelZone?: {
    Vp: number;
    phiRv: number;
    doublerRequired: boolean;
    doublerThickness?: number;
    ratio: number;
  };
  
  continuityPlates: {
    required: boolean;
    thickness?: number;
  };
  
  calculations: CalculationStep[];
  codeReference: string;
}

export interface EndPlateResult {
  isAdequate: boolean;
  
  // End plate
  endPlate: {
    width: number;
    thickness: number;
    requiredThickness: number;
    length: number;
  };
  
  // Stiffener
  stiffener?: {
    thickness: number;
    length: number;
    width: number;
  };
  
  // Bolts
  bolts: {
    numOutside: number;
    numInside: number;
    totalBolts: number;
    tensionPerBolt: number;
    pryingForce: number;
    totalTensionWithPrying: number;
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
  
  // Welds
  welds: {
    flangeToPlateType: string;
    flangeToPlateSize: number;
    webToPlateType: string;
    webToPlateSize: number;
  };
  
  panelZone?: {
    Vp: number;
    phiRv: number;
    doublerRequired: boolean;
    doublerThickness?: number;
    ratio: number;
  };
  
  continuityPlates: {
    required: boolean;
    thickness?: number;
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
// Constants - AISC Standard Sections
// ============================================================================

export const WIDE_FLANGE_SECTIONS: Record<string, Partial<WideFlangeSectionData>> = {
  // W14 columns (common for SMF)
  'W14x500': { d: 19.6, bf: 17.0, tf: 2.19, tw: 1.31, k: 3.31, Zx: 838, A: 147 },
  'W14x455': { d: 19.0, bf: 16.8, tf: 2.02, tw: 1.19, k: 3.13, Zx: 756, A: 134 },
  'W14x398': { d: 18.3, bf: 16.6, tf: 1.77, tw: 1.04, k: 2.88, Zx: 656, A: 117 },
  'W14x370': { d: 17.9, bf: 16.5, tf: 1.66, tw: 0.98, k: 2.75, Zx: 607, A: 109 },
  'W14x342': { d: 17.5, bf: 16.4, tf: 1.54, tw: 0.93, k: 2.63, Zx: 558, A: 101 },
  'W14x311': { d: 17.1, bf: 16.2, tf: 1.41, tw: 0.86, k: 2.50, Zx: 506, A: 91.4 },
  'W14x283': { d: 16.7, bf: 16.1, tf: 1.29, tw: 0.78, k: 2.38, Zx: 459, A: 83.3 },
  'W14x257': { d: 16.4, bf: 16.0, tf: 1.18, tw: 0.71, k: 2.25, Zx: 415, A: 75.6 },
  'W14x233': { d: 16.0, bf: 15.9, tf: 1.07, tw: 0.65, k: 2.13, Zx: 375, A: 68.5 },
  'W14x211': { d: 15.7, bf: 15.8, tf: 0.98, tw: 0.59, k: 2.00, Zx: 338, A: 62.0 },
  
  // W24 beams (common for SMF)
  'W24x176': { d: 25.2, bf: 12.9, tf: 1.34, tw: 0.75, k: 1.91, Zx: 511, A: 51.7 },
  'W24x162': { d: 25.0, bf: 13.0, tf: 1.22, tw: 0.71, k: 1.78, Zx: 468, A: 47.7 },
  'W24x146': { d: 24.7, bf: 12.9, tf: 1.09, tw: 0.65, k: 1.66, Zx: 418, A: 43.0 },
  'W24x131': { d: 24.5, bf: 12.9, tf: 0.96, tw: 0.61, k: 1.53, Zx: 370, A: 38.5 },
  'W24x117': { d: 24.3, bf: 12.8, tf: 0.85, tw: 0.55, k: 1.41, Zx: 327, A: 34.4 },
  'W24x104': { d: 24.1, bf: 12.8, tf: 0.75, tw: 0.50, k: 1.28, Zx: 289, A: 30.6 },
  'W24x94': { d: 24.3, bf: 9.07, tf: 0.87, tw: 0.52, k: 1.44, Zx: 254, A: 27.7 },
  'W24x84': { d: 24.1, bf: 9.02, tf: 0.77, tw: 0.47, k: 1.34, Zx: 224, A: 24.7 },
  'W24x76': { d: 23.9, bf: 8.99, tf: 0.68, tw: 0.44, k: 1.25, Zx: 200, A: 22.4 },
  
  // W21 beams
  'W21x147': { d: 22.1, bf: 12.5, tf: 1.15, tw: 0.72, k: 1.72, Zx: 373, A: 43.2 },
  'W21x132': { d: 21.8, bf: 12.4, tf: 1.04, tw: 0.65, k: 1.59, Zx: 333, A: 38.8 },
  'W21x122': { d: 21.7, bf: 12.4, tf: 0.96, tw: 0.60, k: 1.50, Zx: 307, A: 35.9 },
  'W21x111': { d: 21.5, bf: 12.3, tf: 0.88, tw: 0.55, k: 1.41, Zx: 279, A: 32.7 },
  'W21x101': { d: 21.4, bf: 12.3, tf: 0.80, tw: 0.50, k: 1.34, Zx: 253, A: 29.8 },
  'W21x93': { d: 21.6, bf: 8.42, tf: 0.93, tw: 0.58, k: 1.47, Zx: 221, A: 27.3 },
  'W21x83': { d: 21.4, bf: 8.36, tf: 0.83, tw: 0.52, k: 1.38, Zx: 196, A: 24.3 },
  
  // W18 beams
  'W18x119': { d: 19.0, bf: 11.3, tf: 1.06, tw: 0.66, k: 1.56, Zx: 262, A: 35.1 },
  'W18x106': { d: 18.7, bf: 11.2, tf: 0.94, tw: 0.59, k: 1.44, Zx: 231, A: 31.1 },
  'W18x97': { d: 18.6, bf: 11.1, tf: 0.87, tw: 0.54, k: 1.34, Zx: 211, A: 28.5 },
  'W18x86': { d: 18.4, bf: 11.1, tf: 0.77, tw: 0.48, k: 1.25, Zx: 186, A: 25.3 },
  'W18x76': { d: 18.2, bf: 11.0, tf: 0.68, tw: 0.43, k: 1.16, Zx: 163, A: 22.3 },
};

// RBS geometry limits per AISC 358
export const RBS_LIMITS = {
  a_min_factor: 0.5,      // a ≥ 0.5bf
  a_max_factor: 0.75,     // a ≤ 0.75bf
  b_min_factor: 0.65,     // b ≥ 0.65d
  b_max_factor: 0.85,     // b ≤ 0.85d
  c_max_factor: 0.25,     // c ≤ 0.25bf
  ZRBS_min_factor: 0.70,  // ZRBS ≥ 0.7 * Zx,beam (ACI 318-19 25.3)
};

// Pre-qualified connection limits per AISC 358
export const PREQUALIFIED_LIMITS = {
  SMF: {
    beam_depth_min: 9,       // W9 minimum
    beam_depth_max: 36,      // W36 maximum
    beam_weight_max: 300,    // plf
    column_depth_min: 10,    // W10 minimum
    span_to_depth_max: 50,   // L/d ≤ 50
    story_drift_max: 0.04,   // 4% radians
  },
  IMF: {
    beam_depth_min: 9,
    beam_depth_max: 36,
    beam_weight_max: 300,
    column_depth_min: 10,
    span_to_depth_max: 50,
    story_drift_max: 0.02,   // 2% radians
  },
};
