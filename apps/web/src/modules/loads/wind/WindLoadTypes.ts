/**
 * Wind Load Types
 * Per ASCE 7-22 Chapters 26-31
 * 
 * Includes:
 * - Main Wind Force Resisting System (MWFRS)
 * - Components and Cladding (C&C)
 * - Directional Procedure (Chapter 27)
 * - Envelope Procedure (Chapter 28)
 */

// ============================================================================
// Enums
// ============================================================================

export enum WindExposureCategory {
  B = 'B',           // Urban, suburban
  C = 'C',           // Open terrain
  D = 'D',           // Flat, unobstructed coastal
}

export enum EnclosureClassification {
  ENCLOSED = 'ENCLOSED',
  PARTIALLY_ENCLOSED = 'PARTIALLY_ENCLOSED',
  PARTIALLY_OPEN = 'PARTIALLY_OPEN',
  OPEN = 'OPEN',
}

export enum RoofType {
  FLAT = 'FLAT',
  GABLE = 'GABLE',
  HIP = 'HIP',
  MONOSLOPE = 'MONOSLOPE',
  MANSARD = 'MANSARD',
}

export enum BuildingType {
  RIGID = 'RIGID',           // Natural frequency > 1 Hz
  FLEXIBLE = 'FLEXIBLE',     // Natural frequency ≤ 1 Hz
}

export enum WindLoadCase {
  MWFRS = 'MWFRS',          // Main Wind Force Resisting System
  CC = 'CC',                 // Components and Cladding
}

// ============================================================================
// Interfaces - Input
// ============================================================================

export interface SiteParameters {
  V: number;                       // Basic wind speed (mph)
  exposure: WindExposureCategory;
  Kd: number;                      // Wind directionality factor (default 0.85)
  Kzt: number;                     // Topographic factor (default 1.0)
  Ke: number;                      // Ground elevation factor
}

export interface BuildingGeometry {
  B: number;                       // Building width perpendicular to wind (ft)
  L: number;                       // Building length parallel to wind (ft)
  h: number;                       // Mean roof height (ft)
  roofType: RoofType;
  roofAngle: number;               // Roof angle (degrees)
  eaveHeight?: number;             // Eave height if different from h
}

export interface WindLoadInput {
  designCode: 'ASCE_7_22' | 'ASCE_7_16' | 'ASCE_7_10';
  riskCategory: 'I' | 'II' | 'III' | 'IV';
  site: SiteParameters;
  building: BuildingGeometry;
  enclosure: EnclosureClassification;
  buildingType: BuildingType;
  
  // Optional
  naturalFrequency?: number;       // Building natural frequency (Hz)
  dampingRatio?: number;           // Damping ratio (default 0.01)
}

// ============================================================================
// Interfaces - Results
// ============================================================================

export interface VelocityPressureResult {
  z: number;                       // Height (ft)
  Kz: number;                      // Velocity pressure coefficient
  qz: number;                      // Velocity pressure at z (psf)
  qh: number;                      // Velocity pressure at h (psf)
}

export interface GustFactorResult {
  G: number;                       // Gust effect factor
  Gf?: number;                     // Flexible building gust factor
  n1: number;                      // Natural frequency used
  method: 'RIGID' | 'FLEXIBLE';
}

export interface PressureCoefficients {
  Cp_windward: number;             // Windward wall
  Cp_leeward: number;              // Leeward wall
  Cp_sidewall: number;             // Side walls
  Cp_roof_windward: number;        // Windward roof
  Cp_roof_leeward: number;         // Leeward roof
}

export interface InternalPressure {
  GCpi_positive: number;           // +GCpi
  GCpi_negative: number;           // -GCpi
}

export interface DesignPressure {
  surface: string;
  p_positive: number;              // Positive pressure (psf)
  p_negative: number;              // Negative pressure (psf)
  p_net: number;                   // Net pressure (psf)
}

export interface BaseShearResult {
  direction: 'X' | 'Y';
  V: number;                       // Base shear (kips)
  M_base: number;                  // Overturning moment at base (kip-ft)
  pressureDistribution: {
    height: number;
    pressure: number;
    force: number;
  }[];
}

export interface WindLoadResult {
  isAdequate: boolean;
  
  // Basic parameters
  parameters: {
    V: number;                     // Basic wind speed
    Kd: number;                    // Directionality factor
    Kzt: number;                   // Topographic factor
    Ke: number;                    // Ground elevation factor
    exposure: WindExposureCategory;
  };
  
  // Velocity pressure
  velocityPressure: VelocityPressureResult;
  
  // Gust factor
  gustFactor: GustFactorResult;
  
  // Pressure coefficients
  externalCoefficients: PressureCoefficients;
  internalPressure: InternalPressure;
  
  // Design pressures
  designPressures: DesignPressure[];
  
  // Base shear
  baseShear: {
    X: BaseShearResult;
    Y: BaseShearResult;
  };
  
  // Summary
  summary: {
    qh: number;                    // Velocity pressure at roof
    maxPressure: number;           // Maximum design pressure
    minPressure: number;           // Minimum (suction) pressure
    totalBaseShear: number;        // Larger base shear
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
// Constants - Velocity Pressure Coefficients (ASCE 7-22 Table 26.10-1)
// ============================================================================

export const VELOCITY_PRESSURE_COEFFICIENTS = {
  // Exposure B
  B: {
    alpha: 7.0,
    zg: 1200,
    alpha_hat: 0.143,
    b_hat: 0.84,
    c: 0.30,
    l: 320,
    epsilon: 0.333,
    Kz_15: 0.57,
  },
  // Exposure C
  C: {
    alpha: 9.5,
    zg: 900,
    alpha_hat: 0.111,
    b_hat: 1.00,
    c: 0.20,
    l: 500,
    epsilon: 0.200,
    Kz_15: 0.85,
  },
  // Exposure D
  D: {
    alpha: 11.5,
    zg: 700,
    alpha_hat: 0.095,
    b_hat: 1.07,
    c: 0.15,
    l: 650,
    epsilon: 0.154,
    Kz_15: 1.03,
  },
};

// ============================================================================
// Constants - Directionality Factor (ASCE 7-22 Table 26.6-1)
// ============================================================================

export const DIRECTIONALITY_FACTOR = {
  buildings_MWFRS: 0.85,
  buildings_CC: 0.85,
  chimneys_tanks: 0.95,
  signs: 0.85,
  lattice_frameworks: 0.85,
  trussed_towers: 0.85,
};

// ============================================================================
// Constants - Internal Pressure Coefficients (ASCE 7-22 Table 26.13-1)
// ============================================================================

export const INTERNAL_PRESSURE_COEFF = {
  [EnclosureClassification.ENCLOSED]: { positive: 0.18, negative: -0.18 },
  [EnclosureClassification.PARTIALLY_ENCLOSED]: { positive: 0.55, negative: -0.55 },
  [EnclosureClassification.PARTIALLY_OPEN]: { positive: 0.55, negative: -0.55 },
  [EnclosureClassification.OPEN]: { positive: 0.00, negative: 0.00 },
};

// ============================================================================
// Constants - Wall Pressure Coefficients (ASCE 7-22 Figure 27.3-1)
// ============================================================================

export const WALL_PRESSURE_COEFF = {
  windward: 0.8,                   // All L/B ratios
  leeward: {                       // Varies with L/B
    '0-1': -0.5,
    '2': -0.3,
    '4+': -0.2,
  },
  sidewall: -0.7,
};

// ============================================================================
// Constants - Roof Pressure Coefficients (ASCE 7-22 Figure 27.3-1)
// Simplified for flat roofs (θ ≤ 10°)
// ============================================================================

export const ROOF_PRESSURE_COEFF_FLAT = {
  // Normal to ridge, h/L ≤ 0.5
  windward: {
    h_L_05: { zone1: -0.9, zone2: -0.9, zone3: -0.5 },
    h_L_10: { zone1: -1.3, zone2: -0.7, zone3: -0.7 },
  },
  leeward: -0.5,
};

// ============================================================================
// Basic Wind Speed Maps (ASCE 7-22 Figures 26.5-1 through 26.5-4)
// Representative values - actual design requires site-specific lookup
// ============================================================================

export const BASIC_WIND_SPEED_REFERENCE = {
  risk_I: {
    typical_interior: 95,
    hurricane_coast: 130,
    alaska: 105,
  },
  risk_II: {
    typical_interior: 115,
    hurricane_coast: 150,
    alaska: 115,
  },
  risk_III: {
    typical_interior: 120,
    hurricane_coast: 160,
    alaska: 120,
  },
  risk_IV: {
    typical_interior: 130,
    hurricane_coast: 170,
    alaska: 130,
  },
};
