/**
 * ============================================================================
 * IS 800:2007 - GENERAL CONSTRUCTION IN STEEL
 * ============================================================================
 * CANONICAL REFERENCE MODULE — IS 800 constants, partial safety factors,
 * buckling curves, classification limits, and utility functions.
 * 
 * Other IS 800 engines should import constants from here where possible.
 * 
 * Related engines:
 *  - components/structural/SteelDesignEngine.ts — Beam LTB (production)
 *  - utils/IS800_SteelDesignEngine.ts — Member checks / FSD optimizer
 * 
 * Complete implementation of IS 800:2007 for Structural Steel Design
 * Limit State Method (LSM)
 * 
 * Includes:
 * - Section classification (Clause 3.7)
 * - Tension member design (Clause 6)
 * - Compression member design (Clause 7)
 * - Bending member design (Clause 8)
 * - Combined forces design (Clause 9)
 * - Connections - Bolted & Welded (Clause 10)
 * - Serviceability criteria
 * 
 * @version 1.0.0
 * @reference IS 800:2007 - Code of Practice for General Construction in Steel
 */

import {
  DesignCode,
  CalculationStep,
  DiagramData,
  DiagramType,
  createCalculationStep,
  roundTo,
} from '../core/CalculationEngine';

// ============================================================================
// CONSTANTS FROM IS 800:2007
// ============================================================================

/**
 * Steel grades per IS 2062 (Table 1, IS 800)
 */
export const IS800_STEEL_GRADES = {
  E250: { fy: 250, fu: 410, designation: 'E250 (Fe 410W)' },
  E300: { fy: 300, fu: 440, designation: 'E300 (Fe 440)' },
  E350: { fy: 350, fu: 490, designation: 'E350 (Fe 490)' },
  E410: { fy: 410, fu: 540, designation: 'E410 (Fe 540)' },
  E450: { fy: 450, fu: 570, designation: 'E450 (Fe 570)' },
  E550: { fy: 550, fu: 650, designation: 'E550 (Fe 650)' },
};

/**
 * Partial safety factors per IS 800 Clause 5.4.1
 */
export const IS800_PARTIAL_SAFETY_FACTORS = {
  // Material partial safety factors (Table 5)
  gamma_m0: 1.10,  // Yield stress and buckling
  gamma_m1: 1.25,  // Ultimate stress
  gamma_mw: 1.25,  // Welds
  gamma_mb: 1.25,  // Bolts - bearing type
  gamma_mf: 1.25,  // Friction type bolts
  
  // Load partial safety factors (Table 4)
  load: {
    DL: 1.5,       // Dead load
    LL: 1.5,       // Live load
    EQ: 1.5,       // Earthquake
    WL: 1.5,       // Wind load
  },
};

/**
 * Section classification limits per IS 800 Table 2
 */
export const IS800_CLASSIFICATION_LIMITS = {
  // For compression flange (outstand)
  flange_outstand: {
    plastic: 9.4,     // Class 1
    compact: 10.5,    // Class 2
    semi_compact: 15.7, // Class 3
  },
  // For web in compression
  web_compression: {
    plastic: 42,
    compact: 42,
    semi_compact: 42,
  },
  // For web in bending
  web_bending: {
    plastic: 84,
    compact: 105,
    semi_compact: 126,
  },
  // For web in combined (ψ = stress ratio)
  // Different limits based on ψ
};

/**
 * Imperfection factor α for buckling curves (Table 7)
 */
export const IS800_BUCKLING_CURVES: Record<string, number> = {
  a: 0.21,
  b: 0.34,
  c: 0.49,
  d: 0.76,
};

/**
 * Buckling class selection (Table 10)
 */
export function getBucklingClass(
  sectionType: 'rolled_I' | 'welded_I' | 'rolled_hollow' | 'welded_hollow' | 'angle' | 'channel' | 'tee',
  axis: 'zz' | 'yy',
  tf_ratio?: number // tf/tw ratio
): 'a' | 'b' | 'c' | 'd' {
  // Simplified assignment based on Table 10
  switch (sectionType) {
    case 'rolled_I':
      if (axis === 'zz') return tf_ratio && tf_ratio <= 40 ? 'a' : 'b';
      return 'b';
    case 'welded_I':
      if (axis === 'zz') return tf_ratio && tf_ratio <= 40 ? 'b' : 'c';
      return 'c';
    case 'rolled_hollow':
      return 'a';
    case 'welded_hollow':
      return 'b';
    case 'angle':
    case 'channel':
    case 'tee':
      return 'c';
    default:
      return 'c';
  }
}

/**
 * Effective length factors (Table 11)
 */
export const IS800_EFFECTIVE_LENGTH_FACTORS: Record<string, number> = {
  // Both ends fixed - rotation and translation
  both_fixed: 0.65,
  // One end fixed, one end hinged
  fixed_hinged: 0.80,
  // Both ends hinged
  both_hinged: 1.00,
  // One end fixed, one end free
  fixed_free: 2.00,
  // One end fixed (rotation), one end translation restrained
  fixed_rotation_free: 1.20,
  // Both ends partial restraint
  partial_restraint: 0.85,
};

/**
 * Maximum slenderness ratios (Table 3)
 */
export const IS800_MAX_SLENDERNESS: Record<string, number> = {
  compression_member: 180,
  tension_member: 400,
  tension_member_reversal: 180,
  compression_brace: 250,
  tension_brace: 350,
};

/**
 * Elastic modulus of steel
 */
export const E_STEEL = 200000; // N/mm² (Clause 2.2.4.1)
export const G_STEEL = 76923;  // N/mm² (Shear modulus)

// ============================================================================
// DESIGN FUNCTIONS
// ============================================================================

/**
 * Calculate yield stress reduction for thick plates (Clause 2.3.1)
 */
export function getReducedYieldStress(fy: number, t: number): number {
  if (t <= 20) return fy;
  if (t <= 40) return fy - (fy * 0.08 * (t - 20) / 20);
  return fy * 0.92;
}

/**
 * Calculate ε = √(250/fy) factor
 */
export function getEpsilon(fy: number): number {
  return Math.sqrt(250 / fy);
}

/**
 * Section classification per IS 800 Table 2
 */
export function classifySection(
  sectionType: 'I' | 'box' | 'channel' | 'angle',
  bf: number,    // Flange width
  tf: number,    // Flange thickness
  hw: number,    // Web depth (clear)
  tw: number,    // Web thickness
  fy: number     // Yield stress
): { class: 1 | 2 | 3 | 4; description: string } {
  const epsilon = getEpsilon(fy);
  
  // Flange outstand (for I-section: b/tf where b = (bf - tw)/2)
  const b_flange = (bf - tw) / 2;
  const flange_ratio = b_flange / tf;
  
  // Web ratio
  const web_ratio = hw / tw;
  
  // Classification limits multiplied by ε
  const flange_limits = {
    plastic: 9.4 * epsilon,
    compact: 10.5 * epsilon,
    semi_compact: 15.7 * epsilon,
  };
  
  const web_limits = {
    plastic: 84 * epsilon,
    compact: 105 * epsilon,
    semi_compact: 126 * epsilon,
  };
  
  // Classify flange
  let flangeClass: 1 | 2 | 3 | 4;
  if (flange_ratio <= flange_limits.plastic) flangeClass = 1;
  else if (flange_ratio <= flange_limits.compact) flangeClass = 2;
  else if (flange_ratio <= flange_limits.semi_compact) flangeClass = 3;
  else flangeClass = 4;
  
  // Classify web
  let webClass: 1 | 2 | 3 | 4;
  if (web_ratio <= web_limits.plastic) webClass = 1;
  else if (web_ratio <= web_limits.compact) webClass = 2;
  else if (web_ratio <= web_limits.semi_compact) webClass = 3;
  else webClass = 4;
  
  // Overall class is the most critical
  const sectionClass = Math.max(flangeClass, webClass) as 1 | 2 | 3 | 4;
  
  const descriptions = {
    1: 'Plastic - Can develop plastic hinge with rotation capacity',
    2: 'Compact - Can develop plastic moment but limited rotation',
    3: 'Semi-compact - Cannot reach plastic moment, elastic only',
    4: 'Slender - Local buckling before yield stress',
  };
  
  return { class: sectionClass, description: descriptions[sectionClass] };
}

// ============================================================================
// TENSION MEMBER DESIGN (CLAUSE 6)
// ============================================================================

/**
 * Design tension capacity of net section (Clause 6.2)
 */
export function getTensionCapacityNetSection(
  Ag: number,    // Gross area, mm²
  An: number,    // Net area, mm²
  fu: number,    // Ultimate strength, N/mm²
  fy: number     // Yield strength, N/mm²
): { Tdg: number; Tdn: number; Td: number; governing: string } {
  const { gamma_m0, gamma_m1 } = IS800_PARTIAL_SAFETY_FACTORS;
  
  // Design strength due to yielding of gross section
  const Tdg = (Ag * fy) / (gamma_m0 * 1000); // kN
  
  // Design strength due to rupture of net section
  const Tdn = (0.9 * An * fu) / (gamma_m1 * 1000); // kN
  
  // Design capacity is the minimum
  const Td = Math.min(Tdg, Tdn);
  
  return {
    Tdg: roundTo(Tdg, 2),
    Tdn: roundTo(Tdn, 2),
    Td: roundTo(Td, 2),
    governing: Tdg < Tdn ? 'Yielding of gross section' : 'Rupture of net section',
  };
}

/**
 * Calculate block shear capacity (Clause 6.4)
 */
export function getBlockShearCapacity(
  Avg: number,   // Gross area in shear, mm²
  Avn: number,   // Net area in shear, mm²
  Atg: number,   // Gross area in tension, mm²
  Atn: number,   // Net area in tension, mm²
  fy: number,    // Yield strength, N/mm²
  fu: number     // Ultimate strength, N/mm²
): number {
  const { gamma_m0, gamma_m1 } = IS800_PARTIAL_SAFETY_FACTORS;
  
  // Tdb = (Avg × fy / (√3 × γm0) + 0.9 × Atn × fu / γm1)
  // or   = (0.9 × Avn × fu / (√3 × γm1) + Atg × fy / γm0)
  // whichever is smaller
  
  const Tdb1 = (Avg * fy / (Math.sqrt(3) * gamma_m0) + 0.9 * Atn * fu / gamma_m1) / 1000;
  const Tdb2 = (0.9 * Avn * fu / (Math.sqrt(3) * gamma_m1) + Atg * fy / gamma_m0) / 1000;
  
  return roundTo(Math.min(Tdb1, Tdb2), 2);
}

// ============================================================================
// COMPRESSION MEMBER DESIGN (CLAUSE 7)
// ============================================================================

/**
 * Calculate non-dimensional slenderness ratio λ (Clause 7.1.2.1)
 */
export function getNonDimensionalSlenderness(
  KL_r: number,  // Effective slenderness ratio
  fy: number,    // Yield stress, N/mm²
  E: number = E_STEEL
): number {
  const fcc = (Math.PI ** 2 * E) / (KL_r ** 2); // Euler buckling stress
  return Math.sqrt(fy / fcc);
}

/**
 * Calculate stress reduction factor χ (Clause 7.1.2.1)
 * Per IS 800:2007 Clause 7.1.2.1:
 * χ = 1 / (φ + √(φ² - λ²)) ≤ 1.0
 * where φ = 0.5 × [1 + α(λ - 0.2) + λ²]
 * 
 * Note: By definition, φ ≥ λ always, so φ² - λ² ≥ 0
 * but we add safety check for numerical stability
 */
export function getStressReductionFactor(
  lambda: number,  // Non-dimensional slenderness ratio λ
  alpha: number    // Imperfection factor α from Table 7
): number {
  // For very low slenderness, no buckling reduction
  if (lambda <= 0.2) {
    return 1.0;
  }
  
  // Calculate φ per Clause 7.1.2.1
  const phi = 0.5 * (1 + alpha * (lambda - 0.2) + lambda ** 2);
  
  // Safety check: φ² - λ² should always be ≥ 0 by definition
  // (since φ = 0.5(1 + α(λ-0.2) + λ²) ≥ 0.5λ² + 0.5 ≥ λ² when α ≥ 0)
  // But add numerical safety
  const discriminant = Math.max(phi ** 2 - lambda ** 2, 0);
  
  // Buckling reduction factor χ
  const chi = 1 / (phi + Math.sqrt(discriminant));
  
  // χ cannot exceed 1.0
  return Math.min(chi, 1.0);
}

/**
 * Design compressive strength (Clause 7.1.2)
 */
export function getCompressionCapacity(
  Ag: number,         // Gross area, mm²
  fy: number,         // Yield stress, N/mm²
  KL: number,         // Effective length, mm
  r_min: number,      // Minimum radius of gyration, mm
  bucklingClass: 'a' | 'b' | 'c' | 'd'
): { Pd: number; chi: number; lambda: number; fcd: number } {
  const { gamma_m0 } = IS800_PARTIAL_SAFETY_FACTORS;
  
  // Slenderness ratio
  const KL_r = KL / r_min;
  
  // Non-dimensional slenderness
  const lambda = getNonDimensionalSlenderness(KL_r, fy);
  
  // Imperfection factor
  const alpha = IS800_BUCKLING_CURVES[bucklingClass];
  
  // Stress reduction factor
  const chi = getStressReductionFactor(lambda, alpha);
  
  // Design compressive stress
  const fcd = chi * fy / gamma_m0;
  
  // Design compressive strength
  const Pd = fcd * Ag / 1000; // kN
  
  return {
    Pd: roundTo(Pd, 2),
    chi: roundTo(chi, 4),
    lambda: roundTo(lambda, 3),
    fcd: roundTo(fcd, 2),
  };
}

// ============================================================================
// BENDING MEMBER DESIGN (CLAUSE 8)
// ============================================================================

/**
 * Plastic section modulus calculation for I-section
 */
export function getPlasticModulusI(
  bf: number,    // Flange width, mm
  tf: number,    // Flange thickness, mm
  hw: number,    // Web height, mm
  tw: number     // Web thickness, mm
): { Zpz: number; Zpy: number } {
  // About major axis (z-z)
  const Zpz = bf * tf * (hw + tf) + tw * hw ** 2 / 4;
  
  // About minor axis (y-y)
  const Zpy = 2 * tf * bf ** 2 / 4 + hw * tw ** 2 / 4;
  
  return { Zpz: roundTo(Zpz, 0), Zpy: roundTo(Zpy, 0) };
}

/**
 * Design bending strength (Clause 8.2)
 */
export function getBendingCapacity(
  sectionClass: 1 | 2 | 3 | 4,
  Zp: number,     // Plastic section modulus, mm³
  Ze: number,     // Elastic section modulus, mm³
  fy: number,     // Yield stress, N/mm²
  axis: 'major' | 'minor'
): { Md: number; beta_b: number } {
  const { gamma_m0 } = IS800_PARTIAL_SAFETY_FACTORS;
  
  let beta_b: number;
  
  switch (sectionClass) {
    case 1:
    case 2:
      beta_b = Zp / Ze; // Can use plastic section modulus
      break;
    case 3:
      beta_b = 1.0; // Can only use elastic section modulus
      break;
    case 4:
      // Need to use effective section modulus (reduced for local buckling)
      beta_b = 0.85; // Simplified, actual calculation depends on slenderness
      break;
  }
  
  // Design bending moment capacity
  // Md = βb × Zp × fy / γm0 for class 1, 2
  // Md = Ze × fy / γm0 for class 3, 4
  
  const Z_design = sectionClass <= 2 ? Zp : Ze;
  const Md = beta_b * Z_design * fy / (gamma_m0 * 1e6); // kN-m
  
  return { Md: roundTo(Md, 2), beta_b: roundTo(beta_b, 3) };
}

/**
 * Lateral torsional buckling (Clause 8.2.2)
 * 
 * Per IS 800:2007 Clause 8.2.2.1:
 * The design bending strength of laterally unsupported beams
 * 
 * @param Zp - Plastic section modulus, mm³
 * @param Ze - Elastic section modulus, mm³
 * @param fy - Yield stress, N/mm²
 * @param Mcr - Elastic critical moment, kN-m
 * @param sectionClass - Section class (1, 2, 3, or 4)
 * @param sectionType - Type of section for αLT determination
 * @param h_bf_ratio - h/bf ratio for rolled sections (optional)
 */
export function getLTBCapacity(
  Zp: number,
  Ze: number,
  fy: number,
  Mcr: number,
  sectionClass: 1 | 2 | 3 | 4,
  sectionType: 'rolled' | 'welded' = 'rolled',
  h_bf_ratio?: number
): { Md: number; lambda_LT: number; chi_LT: number; alpha_LT: number } {
  const { gamma_m0 } = IS800_PARTIAL_SAFETY_FACTORS;
  
  // Plastic moment capacity
  const Zp_mm3 = Zp;
  const Mcr_Nmm = Mcr * 1e6;
  const Mp = Zp_mm3 * fy;
  
  // Non-dimensional slenderness ratio for LTB
  const lambda_LT = Math.sqrt(Mp / Mcr_Nmm);
  
  /**
   * Imperfection factor αLT per IS 800 Table 14:
   * - Rolled I-sections, h/bf ≤ 2: αLT = 0.21
   * - Rolled I-sections, h/bf > 2: αLT = 0.34
   * - Welded I-sections: αLT = 0.49
   */
  let alpha_LT: number;
  
  if (sectionType === 'welded') {
    alpha_LT = 0.49;  // Welded sections have more imperfections
  } else {
    // Rolled sections - depends on h/bf ratio
    if (h_bf_ratio !== undefined) {
      alpha_LT = h_bf_ratio <= 2 ? 0.21 : 0.34;
    } else {
      alpha_LT = 0.34;  // Conservative default for rolled sections
    }
  }
  
  // For very low slenderness, no LTB reduction needed
  if (lambda_LT <= 0.4) {
    const Md = (sectionClass <= 2 ? Zp : Ze) * fy / (gamma_m0 * 1e6);
    return {
      Md: roundTo(Md, 2),
      lambda_LT: roundTo(lambda_LT, 3),
      chi_LT: 1.0,
      alpha_LT,
    };
  }
  
  // Calculate φLT per Clause 8.2.2.1
  const phi_LT = 0.5 * (1 + alpha_LT * (lambda_LT - 0.2) + lambda_LT ** 2);
  
  // Safety check for numerical stability
  const discriminant = Math.max(phi_LT ** 2 - lambda_LT ** 2, 0);
  
  // LTB reduction factor χLT
  const chi_LT = Math.min(1 / (phi_LT + Math.sqrt(discriminant)), 1.0);
  
  // Design moment capacity
  let Md: number;
  if (sectionClass <= 2) {
    Md = chi_LT * Zp * fy / (gamma_m0 * 1e6);
  } else {
    Md = chi_LT * Ze * fy / (gamma_m0 * 1e6);
  }
  
  return {
    Md: roundTo(Md, 2),
    lambda_LT: roundTo(lambda_LT, 3),
    chi_LT: roundTo(chi_LT, 4),
    alpha_LT,
  };
}

/**
 * Elastic critical moment Mcr (Clause 8.2.2.1)
 */
export function getElasticCriticalMoment(
  LLT: number,    // Effective length for LTB, mm
  Iy: number,     // Moment of inertia about minor axis, mm⁴
  Iw: number,     // Warping constant, mm⁶
  It: number,     // Torsional constant, mm⁴
  Ze: number,     // Elastic section modulus, mm³
  fy: number      // Yield stress, N/mm²
): number {
  // Mcr = (π²EIy/LLT²) × √[(Iw/Iy) + (LLT²GIt)/(π²EIy)]
  
  const term1 = (Math.PI ** 2 * E_STEEL * Iy) / (LLT ** 2);
  const term2 = Math.sqrt(Iw / Iy + (LLT ** 2 * G_STEEL * It) / (Math.PI ** 2 * E_STEEL * Iy));
  
  const Mcr = term1 * term2 / 1e6; // kN-m
  
  return roundTo(Mcr, 2);
}

// ============================================================================
// SHEAR DESIGN (CLAUSE 8.4)
// ============================================================================

/**
 * Design shear strength (Clause 8.4.1)
 */
export function getShearCapacity(
  Av: number,     // Shear area, mm²
  fy: number      // Yield stress, N/mm²
): number {
  const { gamma_m0 } = IS800_PARTIAL_SAFETY_FACTORS;
  
  // Vd = Av × fyw / (√3 × γm0)
  const Vd = Av * fy / (Math.sqrt(3) * gamma_m0 * 1000); // kN
  
  return roundTo(Vd, 2);
}

/**
 * Shear buckling strength for unstiffened webs (Clause 8.4.2)
 */
export function getShearBucklingStrength(
  d: number,      // Web depth, mm
  tw: number,     // Web thickness, mm
  fy: number,     // Yield stress, N/mm²
  a?: number      // Stiffener spacing, mm (if stiffened)
): { tau_cr_e: number; lambda_w: number; tau_b: number } {
  const epsilon = getEpsilon(fy);
  
  // Web slenderness
  const lambda_w = d / (tw * 67 * epsilon);
  
  // Elastic critical shear stress
  let kv = 5.35; // For unstiffened web
  if (a) {
    kv = 4.0 + 5.35 / (a / d) ** 2; // For stiffened web
  }
  
  const tau_cr_e = kv * Math.PI ** 2 * E_STEEL / (12 * (1 - 0.3 ** 2) * (d / tw) ** 2);
  
  // Shear buckling strength
  let tau_b: number;
  if (lambda_w <= 0.8) {
    tau_b = fy / Math.sqrt(3);
  } else if (lambda_w <= 1.2) {
    tau_b = (1 - 0.8 * (lambda_w - 0.8)) * fy / Math.sqrt(3);
  } else {
    tau_b = tau_cr_e;
  }
  
  return {
    tau_cr_e: roundTo(tau_cr_e, 2),
    lambda_w: roundTo(lambda_w, 3),
    tau_b: roundTo(tau_b, 2),
  };
}

// ============================================================================
// COMBINED FORCES (CLAUSE 9)
// ============================================================================

/**
 * Combined axial force and bending (Clause 9.3)
 */
export function checkCombinedForces(
  N: number,      // Factored axial force, kN (tension +ve)
  Mz: number,     // Factored moment about z-z, kN-m
  My: number,     // Factored moment about y-y, kN-m
  Nd: number,     // Design axial capacity, kN
  Mdz: number,    // Design moment capacity about z-z, kN-m
  Mdy: number,    // Design moment capacity about y-y, kN-m
  sectionClass: 1 | 2 | 3 | 4
): { ratio: number; isOk: boolean; formula: string } {
  let ratio: number;
  let formula: string;
  
  if (sectionClass <= 2) {
    // Plastic sections (Clause 9.3.1.1)
    // For I-sections: (Mz/Mdz)^α1 + (My/Mdy)^α2 ≤ 1.0
    // α1 = α2 = 2 for Class 1, 2
    const n = Math.abs(N) / Nd;
    const alpha1 = 2;
    const alpha2 = 2;
    
    // Reduced moment capacity due to axial force
    const Mnz = Mdz * (1 - n);
    const Mny = Mdy * Math.min(1, (1 - n) / 0.5);
    
    ratio = Math.pow(Math.abs(Mz) / Mnz, alpha1) + Math.pow(Math.abs(My) / Mny, alpha2);
    formula = '(Mz/Mnz)^2 + (My/Mny)^2 ≤ 1.0';
  } else {
    // Semi-compact/slender sections (Clause 9.3.2)
    // Linear interaction
    ratio = Math.abs(N) / Nd + Math.abs(Mz) / Mdz + Math.abs(My) / Mdy;
    formula = 'N/Nd + Mz/Mdz + My/Mdy ≤ 1.0';
  }
  
  return {
    ratio: roundTo(ratio, 3),
    isOk: ratio <= 1.0,
    formula,
  };
}

// ============================================================================
// BOLTED CONNECTION DESIGN (CLAUSE 10.3)
// ============================================================================

/**
 * Bolt grades and strengths
 */
export const IS800_BOLT_GRADES = {
  '4.6': { fyb: 240, fub: 400 },
  '4.8': { fyb: 320, fub: 400 },
  '5.6': { fyb: 300, fub: 500 },
  '5.8': { fyb: 400, fub: 500 },
  '8.8': { fyb: 640, fub: 800 },
  '10.9': { fyb: 900, fub: 1000 },
  '12.9': { fyb: 1080, fub: 1200 },
};

/**
 * Design shear capacity of bolt (Clause 10.3.3)
 */
export function getBoltShearCapacity(
  d: number,           // Bolt diameter, mm
  grade: keyof typeof IS800_BOLT_GRADES,
  nn: number = 1,      // Number of shear planes with threads
  ns: number = 0,      // Number of shear planes without threads
  isLongJoint: boolean = false
): number {
  const { gamma_mb } = IS800_PARTIAL_SAFETY_FACTORS;
  const { fub } = IS800_BOLT_GRADES[grade];
  
  // Nominal bolt area
  const Anb = 0.78 * Math.PI * (d / 2) ** 2; // Net tensile area (approx)
  const Asb = Math.PI * (d / 2) ** 2;        // Shank area
  
  // Vnsb = fub × (nn × Anb + ns × Asb) / (√3 × γmb)
  const Vnsb = fub * (nn * Anb + ns * Asb) / (Math.sqrt(3) * gamma_mb * 1000); // kN
  
  // Reduction for long joints
  const beta_lj = isLongJoint ? 0.75 : 1.0; // Simplified
  
  return roundTo(Vnsb * beta_lj, 2);
}

/**
 * Design bearing capacity of bolt (Clause 10.3.4)
 */
export function getBoltBearingCapacity(
  d: number,           // Bolt diameter, mm
  t: number,           // Sum of plate thicknesses, mm
  grade: keyof typeof IS800_BOLT_GRADES,
  fu: number,          // Ultimate strength of connected plate, N/mm²
  e: number,           // End distance, mm
  p: number,           // Pitch, mm
  d0: number           // Hole diameter, mm
): number {
  const { gamma_mb } = IS800_PARTIAL_SAFETY_FACTORS;
  const { fub } = IS800_BOLT_GRADES[grade];
  
  // Kb = min(e/(3d0), p/(3d0) - 0.25, fub/fu, 1.0)
  const kb = Math.min(e / (3 * d0), p / (3 * d0) - 0.25, fub / fu, 1.0);
  
  // Vnpb = 2.5 × kb × d × t × fu / γmb
  const Vnpb = 2.5 * kb * d * t * fu / (gamma_mb * 1000); // kN
  
  return roundTo(Vnpb, 2);
}

/**
 * Design tension capacity of bolt (Clause 10.3.5)
 */
export function getBoltTensionCapacity(
  d: number,           // Bolt diameter, mm
  grade: keyof typeof IS800_BOLT_GRADES
): number {
  const { gamma_mb } = IS800_PARTIAL_SAFETY_FACTORS;
  const { fub } = IS800_BOLT_GRADES[grade];
  
  // Net tensile area (approx)
  const Anb = 0.78 * Math.PI * (d / 2) ** 2;
  
  // Tnb = 0.9 × fub × Anb / γmb
  const Tnb = 0.9 * fub * Anb / (gamma_mb * 1000); // kN
  
  return roundTo(Tnb, 2);
}

/**
 * Combined shear and tension in bolt (Clause 10.3.6)
 */
export function checkBoltCombined(
  Vsb: number,    // Factored shear, kN
  Tb: number,     // Factored tension, kN
  Vdb: number,    // Design shear capacity, kN
  Tdb: number     // Design tension capacity, kN
): { ratio: number; isOk: boolean } {
  // (Vsb/Vdb)² + (Tb/Tdb)² ≤ 1.0
  const ratio = (Vsb / Vdb) ** 2 + (Tb / Tdb) ** 2;
  
  return { ratio: roundTo(ratio, 3), isOk: ratio <= 1.0 };
}

// ============================================================================
// WELDED CONNECTION DESIGN (CLAUSE 10.5)
// ============================================================================

/**
 * Design strength of fillet weld (Clause 10.5.7)
 */
export function getFilletWeldStrength(
  s: number,           // Size of weld, mm
  Lw: number,          // Effective length of weld, mm
  fu: number,          // Ultimate strength of weaker plate, N/mm²
  angle: number = 90   // Angle of weld axis to force direction
): number {
  const { gamma_mw } = IS800_PARTIAL_SAFETY_FACTORS;
  
  // Throat thickness
  const tt = 0.7 * s;
  
  // Design strength
  const fwd = fu / (Math.sqrt(3) * gamma_mw);
  
  // Capacity
  // For transverse weld (90°): factor = 1.0
  // For longitudinal weld (0°): factor = 0.707
  const directionFactor = angle === 90 ? 1.0 : (angle === 0 ? 0.707 : Math.sin(angle * Math.PI / 180));
  
  const Rw = fwd * tt * Lw * directionFactor / 1000; // kN
  
  return roundTo(Rw, 2);
}

/**
 * Minimum size of fillet weld (Table 21)
 */
export function getMinFilletWeldSize(tmax: number): number {
  if (tmax <= 10) return 3;
  if (tmax <= 20) return 5;
  if (tmax <= 32) return 6;
  if (tmax <= 50) return 8;
  return 10;
}

// ============================================================================
// COMPREHENSIVE BEAM DESIGN
// ============================================================================

export interface IS800BeamInput {
  // Section properties
  section: {
    designation: string;
    D: number;      // Overall depth, mm
    bf: number;     // Flange width, mm
    tf: number;     // Flange thickness, mm
    tw: number;     // Web thickness, mm
    r1?: number;    // Root radius, mm
    A: number;      // Area, mm²
    Iz: number;     // Moment of inertia about z-z, mm⁴
    Iy: number;     // Moment of inertia about y-y, mm⁴
    rz: number;     // Radius of gyration about z-z, mm
    ry: number;     // Radius of gyration about y-y, mm
    Zez: number;    // Elastic section modulus about z-z, mm³
    Zey: number;    // Elastic section modulus about y-y, mm³
    Zpz: number;    // Plastic section modulus about z-z, mm³
    Zpy: number;    // Plastic section modulus about y-y, mm³
    It?: number;    // Torsional constant, mm⁴
    Iw?: number;    // Warping constant, mm⁶
  };
  
  // Material
  grade: keyof typeof IS800_STEEL_GRADES;
  
  // Geometry
  span: number;         // Span, mm
  LLT?: number;         // Effective length for LTB, mm
  supportCondition: 'simply_supported' | 'fixed_fixed' | 'fixed_hinged' | 'cantilever';
  
  // Loads (factored)
  Mz: number;           // Major axis moment, kN-m
  My?: number;          // Minor axis moment, kN-m
  V: number;            // Shear force, kN
  P?: number;           // Axial force, kN (tension +ve)
  
  // Options
  isLaterallyRestrained?: boolean;
  showDetailedCalc?: boolean;
}

export interface IS800BeamResult {
  isAdequate: boolean;
  
  // Section classification
  classification: {
    class: 1 | 2 | 3 | 4;
    description: string;
  };
  
  // Capacities
  Mdz: number;          // Major axis moment capacity, kN-m
  Mdy?: number;         // Minor axis moment capacity, kN-m
  Vd: number;           // Shear capacity, kN
  
  // LTB
  ltb?: {
    lambda_LT: number;
    chi_LT: number;
    Mcr: number;
    Md_ltb: number;
  };
  
  // Utilization ratios
  ratios: {
    moment: number;
    shear: number;
    combined?: number;
    governing: string;
  };
  
  calculations: CalculationStep[];
  diagrams: DiagramData[];
  
  summary: {
    utilizationRatio: number;
    governingCondition: string;
    status: 'ADEQUATE' | 'INADEQUATE';
  };
}

/**
 * Complete beam design per IS 800
 */
export function designBeamIS800(input: IS800BeamInput): IS800BeamResult {
  const calculations: CalculationStep[] = [];
  const diagrams: DiagramData[] = [];
  let stepNo = 1;
  
  const { section, grade, span, Mz, My = 0, V, P = 0, supportCondition, isLaterallyRestrained = false } = input;
  const { fy, fu } = IS800_STEEL_GRADES[grade];
  
  // ============================================================================
  // STEP 1: SECTION CLASSIFICATION
  // ============================================================================
  
  const hw = section.D - 2 * section.tf; // Web clear height
  const classification = classifySection('I', section.bf, section.tf, hw, section.tw, fy);
  
  calculations.push(createCalculationStep({
    step: stepNo++,
    title: 'Section Classification',
    description: 'Classify section based on width-to-thickness ratios',
    formula: 'Check b/tf ≤ limits × ε; d/tw ≤ limits × ε',
    values: {
      'ε': { value: roundTo(getEpsilon(fy), 3), description: '√(250/fy)' },
      'b/tf (flange)': { value: roundTo((section.bf - section.tw) / (2 * section.tf), 2) },
      'd/tw (web)': { value: roundTo(hw / section.tw, 2) },
    },
    result: {
      value: `Class ${classification.class}`,
      description: classification.description,
    },
    code: DesignCode.IS_800,
    clause: '3.7.2',
    table: 'Table 2',
    status: classification.class <= 3 ? 'OK' : 'WARNING',
  }));
  
  // ============================================================================
  // STEP 2: MOMENT CAPACITY
  // ============================================================================
  
  const { gamma_m0 } = IS800_PARTIAL_SAFETY_FACTORS;
  
  // Design moment capacity (without LTB)
  const { Md: Mdz_no_ltb, beta_b } = getBendingCapacity(
    classification.class, 
    section.Zpz, 
    section.Zez, 
    fy, 
    'major'
  );
  
  calculations.push(createCalculationStep({
    step: stepNo++,
    title: 'Design Bending Moment Capacity (Without LTB)',
    description: 'Calculate plastic moment capacity for section class',
    formula: 'Md = βb × Zp × fy / γm0',
    values: {
      'βb': { value: beta_b, description: `For Class ${classification.class}` },
      'Zp': { value: section.Zpz, unit: 'mm³', description: 'Plastic modulus' },
      'fy': { value: fy, unit: 'N/mm²' },
      'γm0': { value: gamma_m0 },
    },
    result: {
      value: roundTo(Mdz_no_ltb, 2),
      unit: 'kN-m',
      description: 'Moment capacity',
    },
    code: DesignCode.IS_800,
    clause: '8.2.1.2',
    status: 'OK',
  }));
  
  // ============================================================================
  // STEP 3: LATERAL TORSIONAL BUCKLING (if applicable)
  // ============================================================================
  
  let Mdz = Mdz_no_ltb;
  let ltbResult: IS800BeamResult['ltb'];
  
  if (!isLaterallyRestrained && section.It && section.Iw) {
    const LLT = input.LLT || span;
    
    // Calculate elastic critical moment
    const Mcr = getElasticCriticalMoment(LLT, section.Iy, section.Iw, section.It, section.Zez, fy);
    
    // Calculate LTB capacity
    const ltb = getLTBCapacity(section.Zpz, section.Zez, fy, Mcr, classification.class);
    
    Mdz = Math.min(Mdz_no_ltb, ltb.Md);
    ltbResult = {
      lambda_LT: ltb.lambda_LT,
      chi_LT: ltb.chi_LT,
      Mcr,
      Md_ltb: ltb.Md,
    };
    
    calculations.push(createCalculationStep({
      step: stepNo++,
      title: 'Lateral Torsional Buckling Check',
      description: 'Calculate reduced moment capacity due to LTB',
      formula: 'Mcr = (π²EIy/LLT²) × √[(Iw/Iy) + (LLT²GIt)/(π²EIy)]',
      values: {
        'LLT': { value: LLT, unit: 'mm', description: 'Effective length for LTB' },
        'Mcr': { value: Mcr, unit: 'kN-m', description: 'Elastic critical moment' },
        'λLT': { value: ltb.lambda_LT, description: 'Non-dimensional slenderness' },
        'χLT': { value: ltb.chi_LT, description: 'LTB reduction factor' },
      },
      result: {
        value: roundTo(ltb.Md, 2),
        unit: 'kN-m',
        description: 'Moment capacity with LTB',
      },
      code: DesignCode.IS_800,
      clause: '8.2.2',
      status: ltb.Md >= Mz ? 'OK' : 'FAIL',
    }));
  }
  
  // ============================================================================
  // STEP 4: SHEAR CAPACITY
  // ============================================================================
  
  // Shear area for I-section
  const Av = section.D * section.tw; // Simplified
  const Vd = getShearCapacity(Av, fy);
  
  calculations.push(createCalculationStep({
    step: stepNo++,
    title: 'Design Shear Capacity',
    description: 'Calculate shear capacity of web',
    formula: 'Vd = Av × fy / (√3 × γm0)',
    values: {
      'Av': { value: Av, unit: 'mm²', description: 'Shear area' },
      'fy': { value: fy, unit: 'N/mm²' },
      'γm0': { value: gamma_m0 },
    },
    result: {
      value: roundTo(Vd, 2),
      unit: 'kN',
      description: 'Shear capacity',
    },
    code: DesignCode.IS_800,
    clause: '8.4.1',
    status: Vd >= V ? 'OK' : 'FAIL',
  }));
  
  // High shear check (Clause 9.2.2)
  const isHighShear = V > 0.6 * Vd;
  
  if (isHighShear) {
    calculations.push(createCalculationStep({
      step: stepNo++,
      title: 'High Shear Check',
      description: 'Check if shear-moment interaction is required',
      formula: 'V > 0.6 × Vd triggers interaction',
      values: {
        'V': { value: V, unit: 'kN' },
        '0.6Vd': { value: roundTo(0.6 * Vd, 2), unit: 'kN' },
      },
      result: {
        value: 'INTERACTION REQUIRED',
        description: 'Reduce moment capacity',
      },
      code: DesignCode.IS_800,
      clause: '9.2.2',
      status: 'WARNING',
      notes: ['Moment capacity should be reduced due to high shear'],
    }));
  }
  
  // ============================================================================
  // STEP 5: UTILIZATION RATIOS
  // ============================================================================
  
  const momentRatio = Mz / Mdz;
  const shearRatio = V / Vd;
  
  let Mdy: number | undefined;
  let combinedRatio: number | undefined;
  
  if (My > 0 || P !== 0) {
    Mdy = getBendingCapacity(classification.class, section.Zpy, section.Zey, fy, 'minor').Md;
    
    if (P !== 0) {
      // Combined check needed
      const Nd = getTensionCapacityNetSection(section.A, section.A, fu, fy).Td;
      const combined = checkCombinedForces(P, Mz, My, Nd, Mdz, Mdy, classification.class);
      combinedRatio = combined.ratio;
    }
  }
  
  const governingRatio = Math.max(momentRatio, shearRatio, combinedRatio || 0);
  const governingCondition = 
    momentRatio >= shearRatio && momentRatio >= (combinedRatio || 0) ? 'Bending' :
    shearRatio >= (combinedRatio || 0) ? 'Shear' : 'Combined';
  
  // Final summary step
  calculations.push(createCalculationStep({
    step: stepNo++,
    title: 'Utilization Summary',
    description: 'Final capacity checks',
    formula: 'Utilization ratio = Applied/Capacity',
    values: {
      'Moment ratio': { value: roundTo(momentRatio, 3), description: `${roundTo(Mz, 2)}/${roundTo(Mdz, 2)}` },
      'Shear ratio': { value: roundTo(shearRatio, 3), description: `${roundTo(V, 2)}/${roundTo(Vd, 2)}` },
    },
    result: {
      value: governingRatio <= 1.0 ? 'ADEQUATE' : 'INADEQUATE',
      description: `Utilization: ${roundTo(governingRatio * 100, 1)}%`,
    },
    code: DesignCode.IS_800,
    clause: '8, 9',
    status: governingRatio <= 1.0 ? 'OK' : 'FAIL',
  }));
  
  // Add stress diagram
  diagrams.push({
    type: DiagramType.STRESS_DIAGRAM,
    title: 'Bending Stress Distribution',
    data: {
      section,
      moment: Mz,
      stresses: {
        top: Mz * 1e6 / section.Zez,
        bottom: -Mz * 1e6 / section.Zez,
      },
    },
  });
  
  return {
    isAdequate: governingRatio <= 1.0,
    classification,
    Mdz,
    Mdy,
    Vd,
    ltb: ltbResult,
    ratios: {
      moment: momentRatio,
      shear: shearRatio,
      combined: combinedRatio,
      governing: governingCondition,
    },
    calculations,
    diagrams,
    summary: {
      utilizationRatio: governingRatio,
      governingCondition,
      status: governingRatio <= 1.0 ? 'ADEQUATE' : 'INADEQUATE',
    },
  };
}

// Export types
export type { CalculationStep, DiagramData };
