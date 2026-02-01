/**
 * ============================================================================
 * DEFLECTION ANALYSIS ENGINE - Serviceability & Deflection Calculations
 * ============================================================================
 * 
 * Comprehensive deflection analysis:
 * - Short-term Deflection (Immediate)
 * - Long-term Deflection (Creep & Shrinkage)
 * - Effective Moment of Inertia (Branson's Equation)
 * - Cracked Section Analysis
 * - Serviceability Limits per IS 456
 * 
 * References:
 * - IS 456:2000 Clause 23.2 - Deflection Control
 * - SP 24:1983 - Explanatory Handbook on IS 456
 * - ACI 318-19 (For comparison)
 * 
 * @version 1.0.0
 * @author BeamLab Engineering
 */

import type { CalculationResult, CalculationStep, CodeCheck } from './StructuralCalculator';

// ============================================================================
// DEFLECTION LIMITS (IS 456:2000 Table 4)
// ============================================================================

export const DEFLECTION_LIMITS_IS456 = {
  // Span/Deflection Limits
  beams_floors: 250,              // L/250 for general floors
  beams_brittle_partition: 350,   // L/350 with brittle partitions
  cantilever: 150,                // L/150 for cantilevers
  roofs: 250,                     // L/250 for roofs
  
  // Absolute Limits
  max_total: 20,                  // 20mm max total
  max_after_erection: 13,         // 13mm after erection of partitions
  
  // Construction tolerance
  precamber_limit: 0.001,         // L/1000 precamber accuracy
};

// ============================================================================
// MATERIAL PROPERTIES FOR DEFLECTION
// ============================================================================

export interface ConcreteProperties {
  fck: number;           // MPa
  Ec: number;            // MPa (short-term)
  Ec_long?: number;      // MPa (long-term, accounts for creep)
  fctm: number;          // Mean tensile strength (MPa)
  creepCoefficient: number;
  shrinkageStrain: number;
}

export function getConcreteProperties(fck: number, humidity: number = 50, age: number = 28): ConcreteProperties {
  // IS 456 Clause 6.2.3.1 - Modulus of Elasticity
  const Ec = 5000 * Math.sqrt(fck); // MPa
  
  // Tensile strength (IS 456 Clause 6.2.2)
  const fctm = 0.7 * Math.sqrt(fck); // MPa (approximately)
  
  // Creep coefficient (IS 456 Annex C or SP 24)
  // Simplified based on humidity and age
  let creepCoefficient = 2.0; // Default
  if (humidity < 50) creepCoefficient = 2.5;
  else if (humidity > 75) creepCoefficient = 1.5;
  
  // Age factor
  if (age < 7) creepCoefficient *= 1.3;
  else if (age > 90) creepCoefficient *= 0.8;
  
  // Shrinkage strain (IS 456 Annex C)
  let shrinkageStrain = 0.0003; // Default
  if (humidity < 50) shrinkageStrain = 0.0004;
  else if (humidity > 75) shrinkageStrain = 0.0002;
  
  // Long-term modulus (accounting for creep)
  const Ec_long = Ec / (1 + creepCoefficient);
  
  return {
    fck,
    Ec,
    Ec_long,
    fctm,
    creepCoefficient,
    shrinkageStrain,
  };
}

// ============================================================================
// CRACKED SECTION ANALYSIS
// ============================================================================

export interface CrackedSectionInput {
  b: number;             // Width (mm)
  d: number;             // Effective depth (mm)
  D: number;             // Total depth (mm)
  As: number;            // Tension steel area (mm²)
  As_comp?: number;      // Compression steel area (mm²)
  d_comp?: number;       // Depth to compression steel (mm)
  fck: number;           // Concrete grade (MPa)
  fy: number;            // Steel grade (MPa)
  Es?: number;           // Steel modulus (default 200000 MPa)
}

export interface CrackedSectionResult {
  xu: number;            // Neutral axis depth from compression face (mm)
  Icr: number;           // Cracked moment of inertia (mm⁴)
  Igross: number;        // Gross moment of inertia (mm⁴)
  Mcr: number;           // Cracking moment (kN·m)
  yt: number;            // Distance to tension face (mm)
  modularRatio: number;
}

export function analyzeCrackedSection(input: CrackedSectionInput): CrackedSectionResult {
  const { b, d, D, As, As_comp = 0, d_comp = 0, fck } = input;
  const Es = input.Es || 200000;
  
  // Concrete properties
  const concrete = getConcreteProperties(fck);
  const Ec = concrete.Ec;
  
  // Modular ratio (IS 456 uses m = Es/Ec)
  const m = Es / Ec;
  
  // Gross section properties
  const Igross = b * Math.pow(D, 3) / 12;
  const yt = D / 2;
  
  // Cracking moment (Mcr = fctm * Igross / yt)
  const fctm = concrete.fctm;
  const Mcr = fctm * Igross / (yt * 1e6); // kN·m
  
  // Cracked neutral axis depth (xu)
  // For rectangular section with tension steel only:
  // b*xu²/2 = m*As*(d-xu)
  // Solving quadratic: xu = [-m*As + sqrt((m*As)² + 2*b*m*As*d)] / b
  
  let xu: number;
  
  if (As_comp > 0 && d_comp > 0) {
    // With compression steel
    // b*xu²/2 + (m-1)*As_comp*(xu-d_comp) = m*As*(d-xu)
    const A_coeff = b / 2;
    const B_coeff = (m - 1) * As_comp + m * As;
    const C_coeff = -((m - 1) * As_comp * d_comp + m * As * d);
    
    xu = (-B_coeff + Math.sqrt(B_coeff * B_coeff - 4 * A_coeff * C_coeff)) / (2 * A_coeff);
  } else {
    // Tension steel only
    const term1 = m * As;
    const term2 = Math.sqrt(term1 * term1 + 2 * b * m * As * d);
    xu = (-term1 + term2) / b;
  }
  
  // Cracked moment of inertia (Icr)
  // Icr = b*xu³/3 + m*As*(d-xu)² + (m-1)*As_comp*(xu-d_comp)²
  let Icr = b * Math.pow(xu, 3) / 3 + m * As * Math.pow(d - xu, 2);
  
  if (As_comp > 0 && d_comp > 0) {
    Icr += (m - 1) * As_comp * Math.pow(xu - d_comp, 2);
  }
  
  return {
    xu,
    Icr,
    Igross,
    Mcr,
    yt,
    modularRatio: m,
  };
}

// ============================================================================
// EFFECTIVE MOMENT OF INERTIA (BRANSON'S EQUATION)
// ============================================================================

export interface EffectiveMoIInput {
  Ma: number;            // Applied moment (kN·m)
  Mcr: number;           // Cracking moment (kN·m)
  Igross: number;        // Gross moment of inertia (mm⁴)
  Icr: number;           // Cracked moment of inertia (mm⁴)
}

export function calculateEffectiveMoI(input: EffectiveMoIInput): number {
  const { Ma, Mcr, Igross, Icr } = input;
  
  // Branson's equation (IS 456 Annex C / ACI 318)
  // Ieff = Icr + (Igross - Icr) * (Mcr/Ma)³
  
  if (Ma <= Mcr) {
    // Uncracked section
    return Igross;
  }
  
  const ratio = Math.pow(Mcr / Ma, 3);
  const Ieff = Icr + (Igross - Icr) * ratio;
  
  // Ieff should not exceed Igross
  return Math.min(Ieff, Igross);
}

// ============================================================================
// BEAM DEFLECTION FORMULAS
// ============================================================================

export type BeamSupportType = 'simply_supported' | 'cantilever' | 'fixed_fixed' | 'fixed_pinned' | 'continuous';
export type LoadingType = 'udl' | 'point_center' | 'point_third' | 'triangular' | 'moment_end';

export interface DeflectionFormulaInput {
  L: number;             // Span (mm)
  E: number;             // Modulus of elasticity (MPa)
  I: number;             // Moment of inertia (mm⁴)
  w?: number;            // UDL (N/mm)
  P?: number;            // Point load (N)
  M?: number;            // Moment (N·mm)
  supportType: BeamSupportType;
  loadingType: LoadingType;
}

export function calculateMaxDeflection(input: DeflectionFormulaInput): { 
  deflection: number;    // mm
  location: number;      // mm from left support
  formula: string;
} {
  const { L, E, I, w = 0, P = 0, M = 0, supportType, loadingType } = input;
  const EI = E * I;
  
  let deflection = 0;
  let location = L / 2;
  let formula = '';
  
  if (supportType === 'simply_supported') {
    if (loadingType === 'udl') {
      deflection = 5 * w * Math.pow(L, 4) / (384 * EI);
      location = L / 2;
      formula = 'δ = 5wL⁴/(384EI)';
    } else if (loadingType === 'point_center') {
      deflection = P * Math.pow(L, 3) / (48 * EI);
      location = L / 2;
      formula = 'δ = PL³/(48EI)';
    } else if (loadingType === 'point_third') {
      // Two point loads at L/3
      deflection = 23 * P * Math.pow(L, 3) / (648 * EI);
      location = L / 2;
      formula = 'δ = 23PL³/(648EI)';
    } else if (loadingType === 'triangular') {
      // Peak at center
      deflection = w * Math.pow(L, 4) / (60 * EI);
      location = L / 2;
      formula = 'δ = wL⁴/(60EI)';
    }
  } else if (supportType === 'cantilever') {
    if (loadingType === 'udl') {
      deflection = w * Math.pow(L, 4) / (8 * EI);
      location = L;
      formula = 'δ = wL⁴/(8EI)';
    } else if (loadingType === 'point_center') {
      // Point load at tip
      deflection = P * Math.pow(L, 3) / (3 * EI);
      location = L;
      formula = 'δ = PL³/(3EI)';
    } else if (loadingType === 'moment_end') {
      deflection = M * Math.pow(L, 2) / (2 * EI);
      location = L;
      formula = 'δ = ML²/(2EI)';
    }
  } else if (supportType === 'fixed_fixed') {
    if (loadingType === 'udl') {
      deflection = w * Math.pow(L, 4) / (384 * EI);
      location = L / 2;
      formula = 'δ = wL⁴/(384EI)';
    } else if (loadingType === 'point_center') {
      deflection = P * Math.pow(L, 3) / (192 * EI);
      location = L / 2;
      formula = 'δ = PL³/(192EI)';
    }
  } else if (supportType === 'fixed_pinned') {
    if (loadingType === 'udl') {
      deflection = w * Math.pow(L, 4) / (185 * EI);
      location = 0.4215 * L;
      formula = 'δ = wL⁴/(185EI) at x = 0.4215L';
    } else if (loadingType === 'point_center') {
      deflection = P * Math.pow(L, 3) / (107.3 * EI);
      location = 0.4472 * L;
      formula = 'δ = PL³/(107.3EI)';
    }
  }
  
  return { deflection, location, formula };
}

// ============================================================================
// COMPLETE DEFLECTION ANALYSIS
// ============================================================================

export interface DeflectionAnalysisInput {
  // Geometry
  span: number;                    // mm
  b: number;                       // mm
  D: number;                       // mm
  d: number;                       // mm (effective depth)
  
  // Reinforcement
  As: number;                      // mm²
  As_comp?: number;                // mm² (compression steel)
  d_comp?: number;                 // mm
  
  // Material
  fck: number;                     // MPa
  fy: number;                      // MPa
  
  // Loading
  deadLoad: number;                // kN/m (unfactored)
  liveLoad: number;                // kN/m (unfactored)
  
  // Options
  supportType: BeamSupportType;
  humidity?: number;               // % RH
  loadingAge?: number;             // days
  includeCreep?: boolean;
  includeShrinkage?: boolean;
  hasBrittleFinish?: boolean;
  memberType?: 'beam' | 'slab' | 'cantilever';
}

export interface DeflectionAnalysisResult extends CalculationResult {
  // Section properties
  Igross: number;
  Icr: number;
  Ieff_dead: number;
  Ieff_total: number;
  Mcr: number;
  xu: number;
  
  // Deflections
  immediateDeadLoad: number;       // mm
  immediateLiveLoad: number;       // mm
  immediateTotal: number;          // mm
  longTermCreep: number;           // mm
  shrinkageDeflection: number;     // mm
  totalLongTerm: number;           // mm
  totalDeflection: number;         // mm
  
  // Checks
  spanDeflectionRatio: number;
  allowableDeflection: number;
  utilizationRatio: number;
  deflectionStatus: 'OK' | 'MARGINAL' | 'FAIL';
  
  // Precamber recommendation
  recommendedPrecamber: number;
}

export function analyzeDeflection(input: DeflectionAnalysisInput): DeflectionAnalysisResult {
  const steps: CalculationStep[] = [];
  const codeChecks: CodeCheck[] = [];
  const warnings: string[] = [];
  
  const {
    span,
    b,
    D,
    d,
    As,
    As_comp = 0,
    d_comp = D - 50, // Default compression steel depth
    fck,
    fy,
    deadLoad,
    liveLoad,
    supportType,
    humidity = 50,
    loadingAge = 28,
    includeCreep = true,
    includeShrinkage = true,
    hasBrittleFinish = false,
    memberType = 'beam',
  } = input;
  
  // Step 1: Material Properties
  const concrete = getConcreteProperties(fck, humidity, loadingAge);
  const Es = 200000; // MPa
  
  steps.push({
    title: 'Material Properties',
    description: 'Concrete and steel properties for deflection analysis',
    formula: 'Ec = 5000√fck (IS 456 Cl. 6.2.3.1)',
    values: {
      'fck (MPa)': fck,
      'Ec (MPa)': concrete.Ec.toFixed(0),
      'fctm (MPa)': concrete.fctm.toFixed(2),
      'Creep Coefficient': concrete.creepCoefficient.toFixed(2),
      'Shrinkage Strain': concrete.shrinkageStrain.toFixed(5),
    },
    result: `Short-term Ec = ${concrete.Ec.toFixed(0)} MPa`,
  });
  
  // Step 2: Section Properties
  const crackedSection = analyzeCrackedSection({
    b, d, D, As, As_comp, d_comp, fck, fy, Es,
  });
  
  const { xu, Icr, Igross, Mcr, modularRatio } = crackedSection;
  
  steps.push({
    title: 'Section Properties',
    description: 'Gross and cracked section analysis',
    formula: 'Cracked neutral axis from equilibrium',
    values: {
      'b (mm)': b,
      'd (mm)': d,
      'As (mm²)': As,
      'Modular ratio (m)': modularRatio.toFixed(2),
      'Neutral axis xu (mm)': xu.toFixed(1),
      'Igross (mm⁴)': Igross.toExponential(3),
      'Icr (mm⁴)': Icr.toExponential(3),
      'Mcr (kN·m)': Mcr.toFixed(2),
    },
    result: `Icr/Igross = ${(Icr / Igross * 100).toFixed(1)}%`,
  });
  
  // Step 3: Calculate Service Moments
  const L_m = span / 1000; // Convert to meters
  let M_dead: number, M_live: number, M_total: number;
  
  if (supportType === 'simply_supported') {
    M_dead = deadLoad * L_m * L_m / 8;
    M_live = liveLoad * L_m * L_m / 8;
  } else if (supportType === 'cantilever') {
    M_dead = deadLoad * L_m * L_m / 2;
    M_live = liveLoad * L_m * L_m / 2;
  } else if (supportType === 'fixed_fixed') {
    M_dead = deadLoad * L_m * L_m / 12; // At support
    M_live = liveLoad * L_m * L_m / 12;
  } else {
    M_dead = deadLoad * L_m * L_m / 8;
    M_live = liveLoad * L_m * L_m / 8;
  }
  
  M_total = M_dead + M_live;
  
  steps.push({
    title: 'Service Moments',
    description: 'Unfactored moments for deflection calculation',
    formula: supportType === 'simply_supported' ? 'M = wL²/8' : 'Based on support conditions',
    values: {
      'Dead Load (kN/m)': deadLoad.toFixed(2),
      'Live Load (kN/m)': liveLoad.toFixed(2),
      'M_dead (kN·m)': M_dead.toFixed(2),
      'M_live (kN·m)': M_live.toFixed(2),
      'M_total (kN·m)': M_total.toFixed(2),
    },
    result: M_total > Mcr ? 'Section is CRACKED' : 'Section is UNCRACKED',
  });
  
  // Step 4: Effective Moment of Inertia
  const Ieff_dead = calculateEffectiveMoI({ Ma: M_dead, Mcr, Igross, Icr });
  const Ieff_total = calculateEffectiveMoI({ Ma: M_total, Mcr, Igross, Icr });
  
  steps.push({
    title: 'Effective Moment of Inertia',
    description: "Branson's equation (IS 456 Annex C)",
    formula: 'Ieff = Icr + (Ig - Icr)(Mcr/Ma)³',
    values: {
      'Ma/Mcr (dead)': (M_dead / Mcr).toFixed(3),
      'Ma/Mcr (total)': (M_total / Mcr).toFixed(3),
      'Ieff_dead (mm⁴)': Ieff_dead.toExponential(3),
      'Ieff_total (mm⁴)': Ieff_total.toExponential(3),
    },
    result: `Using Ieff = ${Ieff_total.toExponential(3)} mm⁴ for total load`,
  });
  
  // Step 5: Immediate Deflections
  const w_dead = deadLoad / 1000; // N/mm
  const w_live = liveLoad / 1000; // N/mm
  const E = concrete.Ec; // Short-term modulus
  
  const deflectionDead = calculateMaxDeflection({
    L: span, E, I: Ieff_dead, w: w_dead,
    supportType, loadingType: 'udl',
  });
  
  const deflectionLive = calculateMaxDeflection({
    L: span, E, I: Ieff_total, w: w_live,
    supportType, loadingType: 'udl',
  });
  
  const immediateDeadLoad = deflectionDead.deflection;
  const immediateLiveLoad = deflectionLive.deflection;
  const immediateTotal = immediateDeadLoad + immediateLiveLoad;
  
  steps.push({
    title: 'Immediate Deflection',
    description: 'Short-term elastic deflection',
    formula: deflectionDead.formula,
    values: {
      'Dead load deflection (mm)': immediateDeadLoad.toFixed(2),
      'Live load deflection (mm)': immediateLiveLoad.toFixed(2),
      'Immediate total (mm)': immediateTotal.toFixed(2),
    },
    result: `δi = ${immediateTotal.toFixed(2)} mm`,
  });
  
  // Step 6: Long-term Deflection (Creep)
  let longTermCreep = 0;
  
  if (includeCreep) {
    // IS 456 Clause 23.2.1: Multiplier for long-term deflection
    // λ = ξ / (1 + 50ρ')
    // where ξ depends on duration (typically 2.0 for 5 years)
    // ρ' = As'/bd
    
    const rho_comp = As_comp / (b * d);
    const xi = concrete.creepCoefficient; // Time-dependent factor
    const lambda = xi / (1 + 50 * rho_comp);
    
    longTermCreep = lambda * immediateDeadLoad;
    
    steps.push({
      title: 'Long-term Deflection (Creep)',
      description: 'IS 456 Clause 23.2.1',
      formula: 'δlt = λ × δi(dead) where λ = ξ/(1+50ρ\')',
      values: {
        'ξ (creep coefficient)': xi.toFixed(2),
        "ρ' (compression steel ratio)": (rho_comp * 100).toFixed(3) + '%',
        'λ (multiplier)': lambda.toFixed(2),
        'Creep deflection (mm)': longTermCreep.toFixed(2),
      },
      result: `δcreep = ${longTermCreep.toFixed(2)} mm`,
    });
  }
  
  // Step 7: Shrinkage Deflection
  let shrinkageDeflection = 0;
  
  if (includeShrinkage) {
    // Simplified shrinkage curvature
    // κsh = εsh × S/I × (m × ρ - ρ') for uncracked
    // Deflection: δsh = κsh × L² / k (k depends on support)
    
    const rho = As / (b * d);
    const rho_comp = As_comp / (b * d);
    const ecs = concrete.shrinkageStrain;
    
    // Shrinkage curvature (simplified)
    const psi_sh = ecs * modularRatio * (rho - rho_comp) / (1 + modularRatio * rho);
    
    // Deflection factor based on support
    let k_sh = 8; // Simply supported
    if (supportType === 'cantilever') k_sh = 2;
    else if (supportType === 'fixed_fixed') k_sh = 16;
    else if (supportType === 'fixed_pinned') k_sh = 11;
    
    shrinkageDeflection = psi_sh * span * span / k_sh;
    
    steps.push({
      title: 'Shrinkage Deflection',
      description: 'IS 456 Annex C / SP 24',
      formula: 'δsh = ψsh × L² / k',
      values: {
        'εcs (shrinkage strain)': ecs.toFixed(5),
        'ψsh (curvature)': psi_sh.toExponential(3),
        'Shrinkage deflection (mm)': shrinkageDeflection.toFixed(2),
      },
      result: `δsh = ${shrinkageDeflection.toFixed(2)} mm`,
    });
  }
  
  // Step 8: Total Deflection
  const totalLongTerm = immediateDeadLoad + longTermCreep + shrinkageDeflection;
  const totalDeflection = immediateTotal + longTermCreep + shrinkageDeflection;
  
  // Deflection after erection of partitions
  const deflectionAfterErection = immediateLiveLoad + longTermCreep + shrinkageDeflection;
  
  steps.push({
    title: 'Total Deflection Summary',
    description: 'Combined short-term and long-term effects',
    formula: 'δtotal = δi(DL) + δi(LL) + δcreep + δsh',
    values: {
      'Immediate dead load (mm)': immediateDeadLoad.toFixed(2),
      'Immediate live load (mm)': immediateLiveLoad.toFixed(2),
      'Creep (mm)': longTermCreep.toFixed(2),
      'Shrinkage (mm)': shrinkageDeflection.toFixed(2),
      'Total (mm)': totalDeflection.toFixed(2),
      'After partition erection (mm)': deflectionAfterErection.toFixed(2),
    },
    result: `Total deflection = ${totalDeflection.toFixed(2)} mm`,
  });
  
  // Step 9: Serviceability Checks
  const L_mm = span;
  let allowableRatio = DEFLECTION_LIMITS_IS456.beams_floors;
  
  if (memberType === 'cantilever') {
    allowableRatio = DEFLECTION_LIMITS_IS456.cantilever;
  } else if (hasBrittleFinish) {
    allowableRatio = DEFLECTION_LIMITS_IS456.beams_brittle_partition;
  }
  
  const allowableDeflection = L_mm / allowableRatio;
  const spanDeflectionRatio = L_mm / totalDeflection;
  const utilizationRatio = totalDeflection / allowableDeflection;
  
  let deflectionStatus: 'OK' | 'MARGINAL' | 'FAIL' = 'OK';
  if (utilizationRatio > 1) deflectionStatus = 'FAIL';
  else if (utilizationRatio > 0.85) deflectionStatus = 'MARGINAL';
  
  steps.push({
    title: 'Serviceability Check',
    description: 'IS 456 Clause 23.2 & Table 4',
    formula: `Allowable = L/${allowableRatio}`,
    values: {
      'Span (mm)': L_mm,
      'Total deflection (mm)': totalDeflection.toFixed(2),
      'Allowable (mm)': allowableDeflection.toFixed(2),
      'Span/Deflection ratio': spanDeflectionRatio.toFixed(0),
      'Utilization': (utilizationRatio * 100).toFixed(1) + '%',
    },
    result: deflectionStatus === 'OK' ? 
      `SAFE: L/${spanDeflectionRatio.toFixed(0)} > L/${allowableRatio}` :
      `FAILS: L/${spanDeflectionRatio.toFixed(0)} < L/${allowableRatio}`,
  });
  
  // Code checks
  codeChecks.push({
    clause: 'IS 456 Cl. 23.2(a)',
    description: 'Final deflection limit',
    limit: `L/${allowableRatio} = ${allowableDeflection.toFixed(1)} mm`,
    actual: `${totalDeflection.toFixed(2)} mm`,
    utilization: utilizationRatio,
    status: deflectionStatus === 'OK' ? 'OK' : (deflectionStatus === 'MARGINAL' ? 'WARNING' : 'FAIL'),
  });
  
  // Check deflection after partition erection
  const allowableAfterPartition = hasBrittleFinish ? 
    Math.min(L_mm / 350, 13) : 
    Math.min(L_mm / 250, 20);
  
  codeChecks.push({
    clause: 'IS 456 Cl. 23.2(b)',
    description: 'Deflection after partition erection',
    limit: `${allowableAfterPartition.toFixed(1)} mm`,
    actual: `${deflectionAfterErection.toFixed(2)} mm`,
    utilization: deflectionAfterErection / allowableAfterPartition,
    status: deflectionAfterErection <= allowableAfterPartition ? 'OK' : 'FAIL',
  });
  
  // Warnings
  if (deflectionStatus === 'FAIL') {
    warnings.push(`Deflection (${totalDeflection.toFixed(1)} mm) exceeds allowable limit (L/${allowableRatio})`);
    warnings.push('Consider: Increasing section depth, adding compression steel, or using higher concrete grade');
  }
  
  if (M_total > Mcr) {
    warnings.push('Section is cracked under service loads - effective I used for deflection');
  }
  
  // Recommended precamber
  const recommendedPrecamber = immediateDeadLoad + longTermCreep * 0.5;
  
  const isAdequate = deflectionStatus === 'OK';
  
  return {
    // Base CalculationResult properties
    isAdequate,
    utilization: utilizationRatio,
    capacity: allowableDeflection,
    demand: totalDeflection,
    status: deflectionStatus === 'MARGINAL' ? 'WARNING' : (deflectionStatus === 'OK' ? 'OK' : 'FAIL'),
    message: isAdequate ? 'Deflection within limits' : 'Deflection exceeds allowable limit',
    summary: {
      'Section': `${b} × ${D} mm`,
      'Span': `${(span / 1000).toFixed(2)} m`,
      'Immediate Deflection': `${immediateTotal.toFixed(2)} mm`,
      'Long-term Deflection': `${totalLongTerm.toFixed(2)} mm`,
      'Total Deflection': `${totalDeflection.toFixed(2)} mm`,
      'Span/Deflection': `L/${spanDeflectionRatio.toFixed(0)}`,
      'Status': deflectionStatus,
    },
    steps,
    codeChecks,
    warnings,
    Igross,
    Icr,
    Ieff_dead,
    Ieff_total,
    Mcr,
    xu,
    immediateDeadLoad,
    immediateLiveLoad,
    immediateTotal,
    longTermCreep,
    shrinkageDeflection,
    totalLongTerm,
    totalDeflection,
    spanDeflectionRatio,
    allowableDeflection,
    utilizationRatio,
    deflectionStatus,
    recommendedPrecamber,
  };
}

// ============================================================================
// SPAN-TO-DEPTH RATIO CHECK (IS 456 Clause 23.2.1)
// ============================================================================

export interface SpanDepthInput {
  span: number;              // mm
  effectiveDepth: number;    // mm
  memberType: 'beam' | 'slab_one_way' | 'slab_two_way' | 'cantilever';
  supportCondition: 'simply_supported' | 'continuous' | 'cantilever';
  steelPercentage: number;   // % (pt)
  compressionSteelPercent?: number; // % (pc)
  fck: number;
  fy: number;
}

export interface SpanDepthResult {
  basicRatio: number;
  modificationFactor_tension: number;
  modificationFactor_compression: number;
  allowableRatio: number;
  actualRatio: number;
  status: 'OK' | 'FAIL';
}

export function checkSpanDepthRatio(input: SpanDepthInput): SpanDepthResult {
  const {
    span,
    effectiveDepth,
    memberType,
    supportCondition,
    steelPercentage,
    compressionSteelPercent = 0,
    fck,
    fy,
  } = input;
  
  // Basic span/depth ratios (IS 456 Clause 23.2.1)
  let basicRatio: number;
  
  if (memberType === 'cantilever') {
    basicRatio = 7;
  } else if (supportCondition === 'simply_supported') {
    basicRatio = memberType === 'beam' ? 20 : 26; // Beams vs slabs
  } else if (supportCondition === 'continuous') {
    basicRatio = memberType === 'beam' ? 26 : 32;
  } else {
    basicRatio = 20;
  }
  
  // Modification factor for tension reinforcement (Figure 4)
  // Approximate formula based on IS 456 Figure 4
  const fs = 0.58 * fy * (steelPercentage / 100); // Approx stress
  const pt = steelPercentage;
  
  let mf_tension: number;
  if (pt <= 0.25) {
    mf_tension = 2.0;
  } else if (pt <= 0.5) {
    mf_tension = 1.6 + (2.0 - 1.6) * (0.5 - pt) / 0.25;
  } else if (pt <= 1.0) {
    mf_tension = 1.2 + (1.6 - 1.2) * (1.0 - pt) / 0.5;
  } else if (pt <= 2.0) {
    mf_tension = 1.0 + (1.2 - 1.0) * (2.0 - pt) / 1.0;
  } else {
    mf_tension = 0.8;
  }
  
  // Modification factor for compression reinforcement (Figure 5)
  let mf_compression = 1.0;
  if (compressionSteelPercent > 0) {
    const pc = compressionSteelPercent;
    mf_compression = 1 + pc / (3 + pc);
    mf_compression = Math.min(mf_compression, 1.5);
  }
  
  // Allowable span/depth ratio
  const allowableRatio = basicRatio * mf_tension * mf_compression;
  
  // Actual span/depth ratio
  const actualRatio = span / effectiveDepth;
  
  const status: 'OK' | 'FAIL' = actualRatio <= allowableRatio ? 'OK' : 'FAIL';
  
  return {
    basicRatio,
    modificationFactor_tension: mf_tension,
    modificationFactor_compression: mf_compression,
    allowableRatio,
    actualRatio,
    status,
  };
}

// All functions are already exported with 'export function' declarations above
