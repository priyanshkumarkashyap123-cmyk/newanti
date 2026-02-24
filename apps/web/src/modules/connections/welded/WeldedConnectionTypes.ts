/**
 * Welded Connection Types
 * Comprehensive type definitions for welded steel connections
 * Per AWS D1.1, AISC 360, Eurocode 3, IS 800
 */

// ============================================================================
// Enums
// ============================================================================

export enum WeldDesignCode {
  AWS_D1_1 = 'AWS D1.1-2020',
  AISC_360 = 'AISC 360-22',
  EUROCODE_3 = 'EN 1993-1-8',
  IS_800 = 'IS 800:2007',
  AS_4100 = 'AS 4100-2020'
}

export enum WeldType {
  FILLET = 'Fillet Weld',
  COMPLETE_JOINT_PENETRATION = 'Complete Joint Penetration (CJP)',
  PARTIAL_JOINT_PENETRATION = 'Partial Joint Penetration (PJP)',
  PLUG = 'Plug Weld',
  SLOT = 'Slot Weld',
  FLARE_BEVEL = 'Flare Bevel Groove',
  FLARE_V = 'Flare V-Groove'
}

export enum WeldPosition {
  FLAT = 'Flat (1G/1F)',
  HORIZONTAL = 'Horizontal (2G/2F)',
  VERTICAL = 'Vertical (3G/3F)',
  OVERHEAD = 'Overhead (4G/4F)'
}

export enum WeldProcess {
  SMAW = 'Shielded Metal Arc Welding',
  GMAW = 'Gas Metal Arc Welding (MIG)',
  FCAW = 'Flux Cored Arc Welding',
  SAW = 'Submerged Arc Welding',
  GTAW = 'Gas Tungsten Arc Welding (TIG)'
}

export enum ElectrodeClass {
  E60XX = 'E60XX (60 ksi)',
  E70XX = 'E70XX (70 ksi)',
  E80XX = 'E80XX (80 ksi)',
  E90XX = 'E90XX (90 ksi)',
  E100XX = 'E100XX (100 ksi)',
  E110XX = 'E110XX (110 ksi)'
}

export enum FilletWeldOrientation {
  LONGITUDINAL = 'Longitudinal',
  TRANSVERSE = 'Transverse',
  INCLINED = 'Inclined'
}

export enum JointType {
  BUTT = 'Butt Joint',
  CORNER = 'Corner Joint',
  TEE = 'T-Joint',
  LAP = 'Lap Joint',
  EDGE = 'Edge Joint'
}

export enum LoadDirection {
  TENSION = 'Tension',
  COMPRESSION = 'Compression',
  SHEAR = 'Shear',
  COMBINED = 'Combined'
}

export enum WeldInspectionLevel {
  VISUAL = 'Visual Inspection',
  RT = 'Radiographic Testing',
  UT = 'Ultrasonic Testing',
  MT = 'Magnetic Particle Testing',
  PT = 'Penetrant Testing'
}

// ============================================================================
// Interfaces
// ============================================================================

export interface WeldMaterial {
  electrodeClass: ElectrodeClass;
  FEXX: number;           // Electrode tensile strength (ksi or MPa)
  Fy: number;             // Base metal yield strength (ksi or MPa)
  Fu: number;             // Base metal ultimate strength (ksi or MPa)
  baseMetal: string;      // e.g., 'A36', 'A992', 'S355'
}

export interface FilletWeldInput {
  designCode: WeldDesignCode;
  weldSize: number;       // Leg size (in or mm)
  weldLength: number;     // Effective length (in or mm)
  orientation: FilletWeldOrientation;
  loadAngle?: number;     // Angle to weld axis (degrees)
  material: WeldMaterial;
  appliedLoad: number;    // Applied force (kips or kN)
  loadDirection: LoadDirection;
  numberOfWelds?: number;
  jointType: JointType;
  basePlateThickness: number;
}

export interface FilletWeldResult {
  designCode: WeldDesignCode;
  weldSize: number;
  effectiveThroat: number;
  effectiveLength: number;
  weldStrength: number;   // Nominal strength (kips or kN)
  designStrength: number; // φRn or Rn/γ (kips or kN)
  appliedLoad: number;
  utilizationRatio: number;
  isAdequate: boolean;
  minSize: number;
  maxSize: number;
  warnings: string[];
  detailingRequirements: string[];
}

export interface GrooveWeldInput {
  designCode: WeldDesignCode;
  weldType: WeldType.COMPLETE_JOINT_PENETRATION | WeldType.PARTIAL_JOINT_PENETRATION;
  effectiveThroat: number;  // For PJP welds (in or mm)
  weldLength: number;
  material: WeldMaterial;
  appliedForces: {
    tension?: number;
    compression?: number;
    shear?: number;
    moment?: number;
  };
  jointType: JointType;
  basePlateThickness: number;
  grooveAngle?: number;
}

export interface GrooveWeldResult {
  designCode: WeldDesignCode;
  weldType: WeldType;
  effectiveThroat: number;
  effectiveArea: number;
  nominalStrength: number;
  designStrength: number;
  appliedStress: number;
  utilizationRatio: number;
  isAdequate: boolean;
  preheatRequired: boolean;
  preheatTemperature?: number;
  warnings: string[];
}

export interface WeldGroupInput {
  designCode: WeldDesignCode;
  welds: Array<{
    type: WeldType;
    size: number;
    length: number;
    x: number;           // Centroid x-coordinate
    y: number;           // Centroid y-coordinate
    orientation: number; // Angle from horizontal (degrees)
  }>;
  material: WeldMaterial;
  appliedForces: {
    Px?: number;         // Force in x-direction
    Py?: number;         // Force in y-direction
    M?: number;          // Moment about centroid
  };
  loadPoint: {
    x: number;
    y: number;
  };
}

export interface WeldGroupResult {
  centroid: { x: number; y: number };
  polarMomentOfInertia: number;
  maxStress: number;
  designStrength: number;
  utilizationRatio: number;
  isAdequate: boolean;
  criticalWeldLocation: { x: number; y: number };
  stressDistribution: Array<{
    weldIndex: number;
    directStress: number;
    torsionalStress: number;
    combinedStress: number;
  }>;
}

// ============================================================================
// Constants
// ============================================================================

export const ELECTRODE_STRENGTH: Record<ElectrodeClass, number> = {
  [ElectrodeClass.E60XX]: 60,
  [ElectrodeClass.E70XX]: 70,
  [ElectrodeClass.E80XX]: 80,
  [ElectrodeClass.E90XX]: 90,
  [ElectrodeClass.E100XX]: 100,
  [ElectrodeClass.E110XX]: 110
};

// Minimum fillet weld size per AISC Table J2.4
export const AISC_MIN_FILLET_SIZE: Record<string, number> = {
  '0.25': 0.125,   // t ≤ 1/4"
  '0.50': 0.1875,  // 1/4" < t ≤ 1/2"
  '0.75': 0.25,    // 1/2" < t ≤ 3/4"
  'over': 0.3125   // t > 3/4"
};

// EC3 minimum fillet weld size (correlation with plate thickness)
export const EC3_MIN_FILLET_SIZE: Record<string, number> = {
  '10': 3,    // t ≤ 10mm
  '20': 4,    // 10 < t ≤ 20mm
  '30': 5,    // 20 < t ≤ 30mm
  'over': 6   // t > 30mm
};

// Strength reduction factors
export const WELD_PHI_FACTORS = {
  AISC: {
    fillet: 0.75,
    CJP_tension: 0.90,
    CJP_compression: 0.90,
    CJP_shear: 0.80,
    PJP_tension: 0.80,
    PJP_compression: 0.90,
    PJP_shear: 0.75
  },
  EC3: {
    gamma_M2: 1.25  // Partial factor for welds
  },
  IS800: {
    gamma_mw: 1.25  // Partial safety factor for shop welds
  }
};
