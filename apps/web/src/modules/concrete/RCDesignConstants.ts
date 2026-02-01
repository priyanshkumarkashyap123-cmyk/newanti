/**
 * ============================================================================
 * RC DESIGN CONSTANTS AND MATERIALS DATABASE
 * ============================================================================
 * 
 * Comprehensive material properties and design constants for reinforced
 * concrete design as per international codes.
 * 
 * Supported Codes:
 * - IS 456:2000 (India)
 * - ACI 318-19 (USA)
 * - EN 1992-1-1:2004 Eurocode 2 (Europe)
 * - AS 3600:2018 (Australia)
 * 
 * @version 1.0.0
 * @author Head of Engineering
 */

// =============================================================================
// TYPE DEFINITIONS
// =============================================================================

export type DesignCode = 'IS456' | 'ACI318' | 'EN1992' | 'AS3600';
export type ExposureClass = 'mild' | 'moderate' | 'severe' | 'very-severe' | 'extreme';
export type ConcreteType = 'normal' | 'lightweight' | 'high-strength';
export type SteelType = 'mild' | 'high-yield' | 'prestressing';

export interface ConcreteGrade {
  grade: string;
  fck: number;        // Characteristic compressive strength (MPa)
  fcm: number;        // Mean compressive strength (MPa)
  fctm: number;       // Mean tensile strength (MPa)
  fctk005: number;    // 5% fractile tensile strength (MPa)
  fctk095: number;    // 95% fractile tensile strength (MPa)
  Ecm: number;        // Elastic modulus (MPa)
  epsilon_cu: number; // Ultimate strain
  code: DesignCode;
}

export interface SteelGrade {
  grade: string;
  fy: number;         // Characteristic yield strength (MPa)
  fu: number;         // Ultimate tensile strength (MPa)
  Es: number;         // Elastic modulus (MPa)
  epsilon_y: number;  // Yield strain
  epsilon_u: number;  // Ultimate strain
  code: DesignCode;
}

export interface RebarSize {
  diameter: number;   // mm
  area: number;       // mm²
  perimeter: number;  // mm
  weight: number;     // kg/m
}

export interface CoverRequirement {
  exposureClass: ExposureClass;
  minCover: number;   // mm
  nominalCover: number; // mm
  fireRating: string;
}

export interface PartialSafetyFactors {
  gammac: number;     // Concrete
  gammas: number;     // Steel
  gammaG: number;     // Permanent loads
  gammaQ: number;     // Variable loads
}

// =============================================================================
// REBAR DATABASE
// =============================================================================

export const REBAR_SIZES: RebarSize[] = [
  { diameter: 6, area: 28.27, perimeter: 18.85, weight: 0.222 },
  { diameter: 8, area: 50.27, perimeter: 25.13, weight: 0.395 },
  { diameter: 10, area: 78.54, perimeter: 31.42, weight: 0.617 },
  { diameter: 12, area: 113.10, perimeter: 37.70, weight: 0.888 },
  { diameter: 14, area: 153.94, perimeter: 43.98, weight: 1.209 },
  { diameter: 16, area: 201.06, perimeter: 50.27, weight: 1.578 },
  { diameter: 18, area: 254.47, perimeter: 56.55, weight: 1.998 },
  { diameter: 20, area: 314.16, perimeter: 62.83, weight: 2.466 },
  { diameter: 22, area: 380.13, perimeter: 69.12, weight: 2.984 },
  { diameter: 25, area: 490.87, perimeter: 78.54, weight: 3.853 },
  { diameter: 28, area: 615.75, perimeter: 87.96, weight: 4.834 },
  { diameter: 32, area: 804.25, perimeter: 100.53, weight: 6.313 },
  { diameter: 36, area: 1017.88, perimeter: 113.10, weight: 7.990 },
  { diameter: 40, area: 1256.64, perimeter: 125.66, weight: 9.865 },
];

// =============================================================================
// CONCRETE GRADES - IS 456:2000
// =============================================================================

export const CONCRETE_GRADES_IS456: ConcreteGrade[] = [
  { grade: 'M15', fck: 15, fcm: 23, fctm: 1.6, fctk005: 1.1, fctk095: 2.0, Ecm: 25000, epsilon_cu: 0.0035, code: 'IS456' },
  { grade: 'M20', fck: 20, fcm: 28, fctm: 2.2, fctk005: 1.5, fctk095: 2.9, Ecm: 27000, epsilon_cu: 0.0035, code: 'IS456' },
  { grade: 'M25', fck: 25, fcm: 33, fctm: 2.6, fctk005: 1.8, fctk095: 3.3, Ecm: 28500, epsilon_cu: 0.0035, code: 'IS456' },
  { grade: 'M30', fck: 30, fcm: 38, fctm: 2.9, fctk005: 2.0, fctk095: 3.8, Ecm: 30000, epsilon_cu: 0.0035, code: 'IS456' },
  { grade: 'M35', fck: 35, fcm: 43, fctm: 3.2, fctk005: 2.2, fctk095: 4.2, Ecm: 31500, epsilon_cu: 0.0035, code: 'IS456' },
  { grade: 'M40', fck: 40, fcm: 48, fctm: 3.5, fctk005: 2.5, fctk095: 4.6, Ecm: 33000, epsilon_cu: 0.0035, code: 'IS456' },
  { grade: 'M45', fck: 45, fcm: 53, fctm: 3.8, fctk005: 2.7, fctk095: 5.0, Ecm: 34000, epsilon_cu: 0.0035, code: 'IS456' },
  { grade: 'M50', fck: 50, fcm: 58, fctm: 4.1, fctk005: 2.9, fctk095: 5.3, Ecm: 35000, epsilon_cu: 0.0035, code: 'IS456' },
  { grade: 'M55', fck: 55, fcm: 63, fctm: 4.3, fctk005: 3.0, fctk095: 5.6, Ecm: 36000, epsilon_cu: 0.0035, code: 'IS456' },
  { grade: 'M60', fck: 60, fcm: 68, fctm: 4.5, fctk005: 3.2, fctk095: 5.9, Ecm: 37000, epsilon_cu: 0.0035, code: 'IS456' },
];

// =============================================================================
// CONCRETE GRADES - ACI 318-19
// =============================================================================

export const CONCRETE_GRADES_ACI318: ConcreteGrade[] = [
  { grade: 'C20', fck: 20, fcm: 28, fctm: 2.2, fctk005: 1.5, fctk095: 2.9, Ecm: 21538, epsilon_cu: 0.003, code: 'ACI318' },
  { grade: 'C25', fck: 25, fcm: 33, fctm: 2.6, fctk005: 1.8, fctk095: 3.3, Ecm: 24083, epsilon_cu: 0.003, code: 'ACI318' },
  { grade: 'C30', fck: 30, fcm: 38, fctm: 2.9, fctk005: 2.0, fctk095: 3.8, Ecm: 26389, epsilon_cu: 0.003, code: 'ACI318' },
  { grade: 'C35', fck: 35, fcm: 43, fctm: 3.2, fctk005: 2.2, fctk095: 4.2, Ecm: 28512, epsilon_cu: 0.003, code: 'ACI318' },
  { grade: 'C40', fck: 40, fcm: 48, fctm: 3.5, fctk005: 2.5, fctk095: 4.6, Ecm: 30487, epsilon_cu: 0.003, code: 'ACI318' },
  { grade: 'C45', fck: 45, fcm: 53, fctm: 3.8, fctk005: 2.7, fctk095: 5.0, Ecm: 32341, epsilon_cu: 0.003, code: 'ACI318' },
  { grade: 'C50', fck: 50, fcm: 58, fctm: 4.1, fctk005: 2.9, fctk095: 5.3, Ecm: 34094, epsilon_cu: 0.003, code: 'ACI318' },
  { grade: 'C55', fck: 55, fcm: 63, fctm: 4.3, fctk005: 3.0, fctk095: 5.6, Ecm: 35760, epsilon_cu: 0.003, code: 'ACI318' },
  { grade: 'C60', fck: 60, fcm: 68, fctm: 4.5, fctk005: 3.2, fctk095: 5.9, Ecm: 37351, epsilon_cu: 0.003, code: 'ACI318' },
];

// =============================================================================
// CONCRETE GRADES - EUROCODE 2
// =============================================================================

export const CONCRETE_GRADES_EN1992: ConcreteGrade[] = [
  { grade: 'C12/15', fck: 12, fcm: 20, fctm: 1.6, fctk005: 1.1, fctk095: 2.0, Ecm: 27000, epsilon_cu: 0.0035, code: 'EN1992' },
  { grade: 'C16/20', fck: 16, fcm: 24, fctm: 1.9, fctk005: 1.3, fctk095: 2.5, Ecm: 29000, epsilon_cu: 0.0035, code: 'EN1992' },
  { grade: 'C20/25', fck: 20, fcm: 28, fctm: 2.2, fctk005: 1.5, fctk095: 2.9, Ecm: 30000, epsilon_cu: 0.0035, code: 'EN1992' },
  { grade: 'C25/30', fck: 25, fcm: 33, fctm: 2.6, fctk005: 1.8, fctk095: 3.3, Ecm: 31000, epsilon_cu: 0.0035, code: 'EN1992' },
  { grade: 'C30/37', fck: 30, fcm: 38, fctm: 2.9, fctk005: 2.0, fctk095: 3.8, Ecm: 33000, epsilon_cu: 0.0035, code: 'EN1992' },
  { grade: 'C35/45', fck: 35, fcm: 43, fctm: 3.2, fctk005: 2.2, fctk095: 4.2, Ecm: 34000, epsilon_cu: 0.0035, code: 'EN1992' },
  { grade: 'C40/50', fck: 40, fcm: 48, fctm: 3.5, fctk005: 2.5, fctk095: 4.6, Ecm: 35000, epsilon_cu: 0.0035, code: 'EN1992' },
  { grade: 'C45/55', fck: 45, fcm: 53, fctm: 3.8, fctk005: 2.7, fctk095: 5.0, Ecm: 36000, epsilon_cu: 0.0035, code: 'EN1992' },
  { grade: 'C50/60', fck: 50, fcm: 58, fctm: 4.1, fctk005: 2.9, fctk095: 5.3, Ecm: 37000, epsilon_cu: 0.0035, code: 'EN1992' },
  { grade: 'C55/67', fck: 55, fcm: 63, fctm: 4.2, fctk005: 3.0, fctk095: 5.5, Ecm: 38000, epsilon_cu: 0.0031, code: 'EN1992' },
  { grade: 'C60/75', fck: 60, fcm: 68, fctm: 4.4, fctk005: 3.1, fctk095: 5.7, Ecm: 39000, epsilon_cu: 0.0029, code: 'EN1992' },
];

// =============================================================================
// STEEL GRADES - ALL CODES
// =============================================================================

export const STEEL_GRADES_IS456: SteelGrade[] = [
  { grade: 'Fe250', fy: 250, fu: 410, Es: 200000, epsilon_y: 0.00125, epsilon_u: 0.12, code: 'IS456' },
  { grade: 'Fe415', fy: 415, fu: 485, Es: 200000, epsilon_y: 0.002075, epsilon_u: 0.12, code: 'IS456' },
  { grade: 'Fe500', fy: 500, fu: 545, Es: 200000, epsilon_y: 0.0025, epsilon_u: 0.12, code: 'IS456' },
  { grade: 'Fe500D', fy: 500, fu: 565, Es: 200000, epsilon_y: 0.0025, epsilon_u: 0.16, code: 'IS456' },
  { grade: 'Fe550', fy: 550, fu: 585, Es: 200000, epsilon_y: 0.00275, epsilon_u: 0.10, code: 'IS456' },
  { grade: 'Fe550D', fy: 550, fu: 600, Es: 200000, epsilon_y: 0.00275, epsilon_u: 0.14, code: 'IS456' },
  { grade: 'Fe600', fy: 600, fu: 660, Es: 200000, epsilon_y: 0.003, epsilon_u: 0.10, code: 'IS456' },
];

export const STEEL_GRADES_ACI318: SteelGrade[] = [
  { grade: 'Grade 40', fy: 276, fu: 414, Es: 200000, epsilon_y: 0.00138, epsilon_u: 0.12, code: 'ACI318' },
  { grade: 'Grade 60', fy: 414, fu: 620, Es: 200000, epsilon_y: 0.00207, epsilon_u: 0.12, code: 'ACI318' },
  { grade: 'Grade 75', fy: 517, fu: 690, Es: 200000, epsilon_y: 0.00259, epsilon_u: 0.10, code: 'ACI318' },
  { grade: 'Grade 80', fy: 552, fu: 689, Es: 200000, epsilon_y: 0.00276, epsilon_u: 0.10, code: 'ACI318' },
  { grade: 'Grade 100', fy: 690, fu: 862, Es: 200000, epsilon_y: 0.00345, epsilon_u: 0.08, code: 'ACI318' },
];

export const STEEL_GRADES_EN1992: SteelGrade[] = [
  { grade: 'B400', fy: 400, fu: 480, Es: 200000, epsilon_y: 0.002, epsilon_u: 0.05, code: 'EN1992' },
  { grade: 'B500A', fy: 500, fu: 525, Es: 200000, epsilon_y: 0.0025, epsilon_u: 0.025, code: 'EN1992' },
  { grade: 'B500B', fy: 500, fu: 540, Es: 200000, epsilon_y: 0.0025, epsilon_u: 0.05, code: 'EN1992' },
  { grade: 'B500C', fy: 500, fu: 575, Es: 200000, epsilon_y: 0.0025, epsilon_u: 0.075, code: 'EN1992' },
  { grade: 'B600B', fy: 600, fu: 660, Es: 200000, epsilon_y: 0.003, epsilon_u: 0.05, code: 'EN1992' },
];

// =============================================================================
// PARTIAL SAFETY FACTORS
// =============================================================================

export const SAFETY_FACTORS: Record<DesignCode, PartialSafetyFactors> = {
  IS456: { gammac: 1.5, gammas: 1.15, gammaG: 1.5, gammaQ: 1.5 },
  ACI318: { gammac: 1.0, gammas: 1.0, gammaG: 1.2, gammaQ: 1.6 }, // Uses strength reduction factors instead
  EN1992: { gammac: 1.5, gammas: 1.15, gammaG: 1.35, gammaQ: 1.5 },
  AS3600: { gammac: 1.5, gammas: 1.15, gammaG: 1.2, gammaQ: 1.5 },
};

// ACI 318 Strength Reduction Factors
export const ACI_PHI_FACTORS = {
  flexure: 0.90,
  shear: 0.75,
  torsion: 0.75,
  compression_tied: 0.65,
  compression_spiral: 0.75,
  bearing: 0.65,
};

// =============================================================================
// COVER REQUIREMENTS
// =============================================================================

export const COVER_REQUIREMENTS_IS456: CoverRequirement[] = [
  { exposureClass: 'mild', minCover: 20, nominalCover: 25, fireRating: '0.5hr' },
  { exposureClass: 'moderate', minCover: 30, nominalCover: 35, fireRating: '1hr' },
  { exposureClass: 'severe', minCover: 45, nominalCover: 50, fireRating: '1.5hr' },
  { exposureClass: 'very-severe', minCover: 50, nominalCover: 55, fireRating: '2hr' },
  { exposureClass: 'extreme', minCover: 75, nominalCover: 80, fireRating: '3hr' },
];

// =============================================================================
// DESIGN LIMITS
// =============================================================================

export const DESIGN_LIMITS = {
  IS456: {
    minSteelRatio: 0.85 / 415, // 0.85*bd/fy for Fe415
    maxSteelRatio: 0.04,
    minShearReinf: 0.4 / 415, // 0.4*b*sv/fy
    maxCrackWidth_severe: 0.2, // mm
    maxCrackWidth_moderate: 0.3, // mm
    maxSpanDepthRatio_cantilever: 7,
    maxSpanDepthRatio_simplysupported: 20,
    maxSpanDepthRatio_continuous: 26,
    minBeamWidth: 200, // mm
    maxBarSpacing_main: 300, // mm
    minBarSpacing: 25, // mm or bar diameter
    maxStirrupSpacing: 0.75, // * d
  },
  ACI318: {
    minSteelRatio: 200 / 60000, // 3√fc'/fy but not less than 200/fy
    maxSteelRatio: 0.025, // for beams in seismic
    beta1_max: 0.85,
    beta1_min: 0.65,
    maxCrackWidth: 0.41, // mm (0.016 in)
    minBeamWidth: 250, // mm (10 in)
  },
  EN1992: {
    minSteelRatio: 0.26, // * fctm/fyk but >= 0.0013
    maxSteelRatio: 0.04,
    maxCrackWidth_XC1: 0.4, // mm
    maxCrackWidth_XC2_XC4: 0.3, // mm
    maxSpanDepthRatio_K: {
      simply_supported: 1.0,
      end_span: 1.3,
      interior_span: 1.5,
      cantilever: 0.4,
    },
  },
};

// =============================================================================
// STRESS BLOCK PARAMETERS
// =============================================================================

export const STRESS_BLOCK = {
  IS456: {
    lambda: 0.8,        // Depth of rectangular stress block / x
    eta: 0.67 * 0.85,   // Stress intensity factor (0.67 * 0.85 for γm = 1.5)
    k: 0.42,            // x_u,max / d for balanced section
    k_values: {         // x_u,max / d for different steel grades
      Fe250: 0.53,
      Fe415: 0.48,
      Fe500: 0.46,
      Fe550: 0.44,
    },
  },
  ACI318: {
    alpha1: 0.85,       // For fc' ≤ 28 MPa
    getBeta1: (fc: number) => Math.max(0.65, Math.min(0.85, 0.85 - 0.05 * (fc - 28) / 7)),
    epsilonC: 0.003,    // Ultimate concrete strain
  },
  EN1992: {
    lambda: (fck: number) => fck <= 50 ? 0.8 : 0.8 - (fck - 50) / 400,
    eta: (fck: number) => fck <= 50 ? 1.0 : 1.0 - (fck - 50) / 200,
    epsilonCu2: (fck: number) => fck <= 50 ? 0.0035 : 0.0026 + 0.035 * Math.pow((90 - fck) / 100, 4),
    epsilonCu3: (fck: number) => fck <= 50 ? 0.0035 : 0.0026 + 0.035 * Math.pow((90 - fck) / 100, 4),
  },
};

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

/**
 * Get rebar by diameter
 */
export function getRebarByDiameter(diameter: number): RebarSize | undefined {
  return REBAR_SIZES.find(r => r.diameter === diameter);
}

/**
 * Calculate area of rebars
 */
export function calculateRebarArea(diameter: number, count: number): number {
  const rebar = getRebarByDiameter(diameter);
  return rebar ? rebar.area * count : 0;
}

/**
 * Get concrete grade by code
 */
export function getConcreteGrades(code: DesignCode): ConcreteGrade[] {
  switch (code) {
    case 'IS456': return CONCRETE_GRADES_IS456;
    case 'ACI318': return CONCRETE_GRADES_ACI318;
    case 'EN1992': return CONCRETE_GRADES_EN1992;
    case 'AS3600': return CONCRETE_GRADES_IS456; // Similar to IS
    default: return CONCRETE_GRADES_IS456;
  }
}

/**
 * Get steel grades by code
 */
export function getSteelGrades(code: DesignCode): SteelGrade[] {
  switch (code) {
    case 'IS456': return STEEL_GRADES_IS456;
    case 'ACI318': return STEEL_GRADES_ACI318;
    case 'EN1992': return STEEL_GRADES_EN1992;
    case 'AS3600': return STEEL_GRADES_IS456;
    default: return STEEL_GRADES_IS456;
  }
}

/**
 * Calculate elastic modulus of concrete (IS 456)
 */
export function calculateEcm_IS456(fck: number): number {
  return 5000 * Math.sqrt(fck);
}

/**
 * Calculate elastic modulus of concrete (ACI 318)
 */
export function calculateEcm_ACI318(fc: number): number {
  return 4700 * Math.sqrt(fc);
}

/**
 * Calculate elastic modulus of concrete (EN 1992)
 */
export function calculateEcm_EN1992(fcm: number): number {
  return 22000 * Math.pow(fcm / 10, 0.3);
}

/**
 * Calculate design compressive strength
 */
export function getDesignStrength(fck: number, code: DesignCode): number {
  const factors = SAFETY_FACTORS[code];
  switch (code) {
    case 'IS456':
      return 0.67 * fck / factors.gammac; // 0.446 * fck
    case 'ACI318':
      return 0.85 * fck; // Uses phi factor separately
    case 'EN1992':
      return 0.85 * fck / factors.gammac; // αcc * fck / γc
    default:
      return 0.67 * fck / factors.gammac;
  }
}

/**
 * Calculate design yield strength of steel
 */
export function getDesignYieldStrength(fy: number, code: DesignCode): number {
  const factors = SAFETY_FACTORS[code];
  switch (code) {
    case 'IS456':
      return fy / factors.gammas; // 0.87 * fy
    case 'ACI318':
      return fy; // Uses phi factor separately
    case 'EN1992':
      return fy / factors.gammas;
    default:
      return fy / factors.gammas;
  }
}

/**
 * Calculate modular ratio
 */
export function calculateModularRatio(Es: number, Ec: number): number {
  return Es / Ec;
}

/**
 * Select optimum bar combination
 */
export function selectBars(requiredArea: number, maxBars: number = 8, preferredDiameters?: number[]): { diameter: number; count: number; area: number }[] {
  const results: { diameter: number; count: number; area: number; efficiency: number }[] = [];
  const diameters = preferredDiameters || [12, 16, 20, 25, 28, 32];
  
  for (const dia of diameters) {
    const rebar = getRebarByDiameter(dia);
    if (!rebar) continue;
    
    for (let count = 2; count <= maxBars; count++) {
      const area = rebar.area * count;
      if (area >= requiredArea) {
        const efficiency = requiredArea / area;
        results.push({ diameter: dia, count, area, efficiency });
      }
    }
  }
  
  // Sort by efficiency (closest to 100% utilization) then by area
  results.sort((a, b) => {
    const effDiff = Math.abs(1 - a.efficiency) - Math.abs(1 - b.efficiency);
    if (Math.abs(effDiff) < 0.05) return a.area - b.area;
    return effDiff;
  });
  
  return results.slice(0, 5).map(r => ({ diameter: r.diameter, count: r.count, area: r.area }));
}

export default {
  REBAR_SIZES,
  CONCRETE_GRADES_IS456,
  CONCRETE_GRADES_ACI318,
  CONCRETE_GRADES_EN1992,
  STEEL_GRADES_IS456,
  STEEL_GRADES_ACI318,
  STEEL_GRADES_EN1992,
  SAFETY_FACTORS,
  ACI_PHI_FACTORS,
  COVER_REQUIREMENTS_IS456,
  DESIGN_LIMITS,
  STRESS_BLOCK,
  getRebarByDiameter,
  calculateRebarArea,
  getConcreteGrades,
  getSteelGrades,
  calculateEcm_IS456,
  calculateEcm_ACI318,
  calculateEcm_EN1992,
  getDesignStrength,
  getDesignYieldStrength,
  calculateModularRatio,
  selectBars,
};
