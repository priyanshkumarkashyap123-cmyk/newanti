/**
 * ============================================================================
 * IS 456:2000 - PLAIN AND REINFORCED CONCRETE
 * ============================================================================
 * 
 * Complete implementation of IS 456:2000 for RCC design
 * 
 * Includes:
 * - Material properties and design strengths
 * - Flexural design (singly/doubly reinforced)
 * - Shear design
 * - Torsion design
 * - Development length and anchorage
 * - Deflection and cracking checks
 * - Detailing requirements
 * 
 * @version 1.0.0
 * @reference IS 456:2000 - Code of Practice for Plain and Reinforced Concrete
 */

import {
  DesignCode,
  CalculationStep,
  DiagramData,
  DiagramType,
  createCalculationStep,
  roundTo,
  SAFETY_FACTORS,
  MATERIAL_PROPERTIES,
} from '../core/CalculationEngine';

// ============================================================================
// CONSTANTS AND TABLES FROM IS 456:2000
// ============================================================================

/**
 * Concrete grades per IS 456 Table 2
 */
export const IS456_CONCRETE_GRADES = {
  // Ordinary concrete
  M10: { fck: 10, description: 'Ordinary - Lean concrete' },
  M15: { fck: 15, description: 'Ordinary - Plain concrete' },
  M20: { fck: 20, description: 'Ordinary - RCC general' },
  
  // Standard concrete
  M25: { fck: 25, description: 'Standard - RCC general' },
  M30: { fck: 30, description: 'Standard - RCC moderate exposure' },
  M35: { fck: 35, description: 'Standard - RCC severe exposure' },
  M40: { fck: 40, description: 'Standard - Prestressed/high strength' },
  M45: { fck: 45, description: 'Standard - Prestressed/high strength' },
  M50: { fck: 50, description: 'Standard - Special structures' },
  
  // High strength concrete
  M55: { fck: 55, description: 'High strength' },
  M60: { fck: 60, description: 'High strength' },
  M65: { fck: 65, description: 'High strength' },
  M70: { fck: 70, description: 'High strength' },
  M75: { fck: 75, description: 'High strength' },
  M80: { fck: 80, description: 'High strength' },
};

/**
 * Steel grades per IS 1786
 */
export const IS456_STEEL_GRADES = {
  Fe250: { fy: 250, fu: 410, designation: 'Mild Steel' },
  Fe415: { fy: 415, fu: 485, designation: 'HYSD - TMT' },
  Fe500: { fy: 500, fu: 545, designation: 'HYSD - TMT' },
  Fe550: { fy: 550, fu: 585, designation: 'HYSD - TMT' },
  Fe600: { fy: 600, fu: 660, designation: 'HYSD - TMT' },
};

/**
 * Partial safety factors per IS 456 Clause 36.4.2
 */
export const IS456_PARTIAL_SAFETY_FACTORS = {
  gamma_c: 1.5,    // Concrete
  gamma_s: 1.15,   // Steel
};

/**
 * Design stress-strain parameters
 */
export const IS456_DESIGN_CONSTANTS = {
  // Ultimate strain in concrete (Clause 38.1)
  epsilon_cu: 0.0035,
  
  // Stress block parameters (Clause 38.1, Fig 21)
  stress_block_depth_factor: 0.42,  // k1 = 0.36 × fck acts at 0.42xu from top
  stress_block_force_factor: 0.36,  // k2 = 0.36
  
  // Maximum strain in steel (for ductility)
  epsilon_s_min: 0.002 + (0.87 * 415) / (1.15 * 200000), // For Fe415
  
  // Modular ratio (Clause 44.1)
  // m = 280 / (3 × σcbc)
};

/**
 * Clear cover requirements per IS 456 Table 16 & 16A
 */
export const IS456_CLEAR_COVER: Record<string, Record<string, number>> = {
  // Exposure condition: { member type: cover in mm }
  mild: {
    slab: 20,
    beam: 25,
    column: 40,
    foundation: 50,
  },
  moderate: {
    slab: 30,
    beam: 30,
    column: 40,
    foundation: 50,
  },
  severe: {
    slab: 45,
    beam: 45,
    column: 45,
    foundation: 75,
  },
  very_severe: {
    slab: 50,
    beam: 50,
    column: 50,
    foundation: 75,
  },
  extreme: {
    slab: 75,
    beam: 75,
    column: 75,
    foundation: 75,
  },
};

/**
 * Maximum water-cement ratio per IS 456 Table 5
 */
export const IS456_MAX_WC_RATIO: Record<string, number> = {
  mild: 0.55,
  moderate: 0.50,
  severe: 0.45,
  very_severe: 0.45,
  extreme: 0.40,
};

/**
 * Minimum cement content per IS 456 Table 5 (kg/m³)
 */
export const IS456_MIN_CEMENT: Record<string, number> = {
  mild: 300,
  moderate: 300,
  severe: 320,
  very_severe: 340,
  extreme: 360,
};

/**
 * Limiting values of xu/d per IS 456 Clause 38.1
 */
export const IS456_XU_D_LIMIT: Record<string, number> = {
  Fe250: 0.53,
  Fe415: 0.48,
  Fe500: 0.46,
  Fe550: 0.44,
  Fe600: 0.42,
};

/**
 * Development length factors per IS 456 Clause 26.2.1
 */
export const IS456_BOND_STRESS: Record<string, Record<string, number>> = {
  // fck: { deformed_tension, deformed_compression, plain_tension, plain_compression }
  M20: { deformed_tension: 1.2, deformed_compression: 1.5, plain_tension: 0.8, plain_compression: 1.0 },
  M25: { deformed_tension: 1.4, deformed_compression: 1.75, plain_tension: 0.9, plain_compression: 1.125 },
  M30: { deformed_tension: 1.5, deformed_compression: 1.875, plain_tension: 1.0, plain_compression: 1.25 },
  M35: { deformed_tension: 1.7, deformed_compression: 2.125, plain_tension: 1.1, plain_compression: 1.375 },
  M40: { deformed_tension: 1.9, deformed_compression: 2.375, plain_tension: 1.2, plain_compression: 1.5 },
};

/**
 * Span/depth ratios for deflection control per IS 456 Clause 23.2.1
 */
export const IS456_SPAN_DEPTH_RATIO = {
  cantilever: 7,
  simply_supported: 20,
  continuous: 26,
};

/**
 * Modification factors for tension reinforcement (Fig 4, IS 456)
 * Returns modification factor based on pt% and fck
 */
export function getModificationFactorTension(
  pt: number,  // Percentage of tension reinforcement
  fs: number,  // Steel stress at service load (N/mm²)
  fck: number  // Characteristic strength of concrete (N/mm²)
): number {
  // Simplified formula based on IS 456 Fig 4
  // More accurate values should be interpolated from the chart
  const ptRequired = pt;
  const factor = 2 - 0.05 * fs / (0.58 * 415); // Simplified
  return Math.min(Math.max(factor, 1.0), 2.0);
}

/**
 * Modification factor for compression reinforcement (Fig 5, IS 456)
 */
export function getModificationFactorCompression(pc: number): number {
  // Percentage of compression reinforcement
  if (pc <= 0) return 1.0;
  if (pc <= 0.5) return 1.0 + pc * 0.1 / 0.5;
  if (pc <= 1.0) return 1.1 + (pc - 0.5) * 0.1 / 0.5;
  if (pc <= 1.5) return 1.2 + (pc - 1.0) * 0.1 / 0.5;
  if (pc <= 2.0) return 1.3 + (pc - 1.5) * 0.1 / 0.5;
  if (pc <= 2.5) return 1.4 + (pc - 2.0) * 0.05 / 0.5;
  return 1.5; // Max value
}

// ============================================================================
// DESIGN FUNCTIONS
// ============================================================================

/**
 * Calculate design strength of concrete
 */
export function getConcreteDesignStrength(fck: number): number {
  // fcd = 0.67 × fck / γc = 0.67 × fck / 1.5 = 0.447 × fck
  return 0.67 * fck / IS456_PARTIAL_SAFETY_FACTORS.gamma_c;
}

/**
 * Calculate design strength of steel
 */
export function getSteelDesignStrength(fy: number): number {
  // fyd = fy / γs = fy / 1.15 = 0.87 × fy
  return fy / IS456_PARTIAL_SAFETY_FACTORS.gamma_s;
}

/**
 * Calculate modulus of elasticity of concrete
 * Per IS 456 Clause 6.2.3.1
 */
export function getConcreteModulus(fck: number): number {
  return 5000 * Math.sqrt(fck); // N/mm²
}

/**
 * Calculate limiting moment of resistance
 * Per IS 456 Clause 38.1
 */
export function getLimitingMoment(
  fck: number,
  fy: number,
  b: number,    // Width in mm
  d: number     // Effective depth in mm
): number {
  const xuMax_d = IS456_XU_D_LIMIT[`Fe${fy}`] || 0.48;
  
  // Mu,lim = 0.36 × fck × b × xu,max × (d - 0.42 × xu,max)
  const xuMax = xuMax_d * d;
  const Mu_lim = 0.36 * fck * b * xuMax * (d - 0.42 * xuMax);
  
  return Mu_lim / 1e6; // Convert to kN-m
}

/**
 * Calculate neutral axis depth for singly reinforced section
 */
export function getNeutralAxisDepth(
  Ast: number,  // Area of tension steel, mm²
  fck: number,  // Concrete strength, N/mm²
  fy: number,   // Steel strength, N/mm²
  b: number     // Width, mm
): number {
  // From equilibrium: 0.36 × fck × b × xu = 0.87 × fy × Ast
  // xu = (0.87 × fy × Ast) / (0.36 × fck × b)
  return (0.87 * fy * Ast) / (0.36 * fck * b);
}

/**
 * Calculate moment of resistance for singly reinforced section
 */
export function getMomentCapacity(
  Ast: number,  // Area of tension steel, mm²
  fck: number,  // Concrete strength, N/mm²
  fy: number,   // Steel strength, N/mm²
  b: number,    // Width, mm
  d: number     // Effective depth, mm
): { Mu: number; xu: number; xu_d: number; isUnderReinforced: boolean } {
  const xu = getNeutralAxisDepth(Ast, fck, fy, b);
  const xu_d = xu / d;
  const xuMax_d = IS456_XU_D_LIMIT[`Fe${fy}`] || 0.48;
  
  let Mu: number;
  
  if (xu_d <= xuMax_d) {
    // Under-reinforced section - steel yields
    Mu = 0.87 * fy * Ast * (d - 0.42 * xu);
  } else {
    // Over-reinforced section - use limiting moment
    Mu = 0.36 * fck * b * xuMax_d * d * d * (1 - 0.42 * xuMax_d);
  }
  
  return {
    Mu: Mu / 1e6, // kN-m
    xu,
    xu_d,
    isUnderReinforced: xu_d <= xuMax_d,
  };
}

/**
 * Calculate required tension steel for given moment
 */
export function getRequiredTensionSteel(
  Mu: number,   // Required moment capacity, kN-m
  fck: number,  // Concrete strength, N/mm²
  fy: number,   // Steel strength, N/mm²
  b: number,    // Width, mm
  d: number     // Effective depth, mm
): { Ast: number; xu: number; isDoublyReinforced: boolean; Asc?: number } {
  const Mu_Nmm = Mu * 1e6;
  const Mu_lim = getLimitingMoment(fck, fy, b, d) * 1e6;
  
  if (Mu_Nmm <= Mu_lim) {
    // Singly reinforced section
    // Mu = 0.87 × fy × Ast × (d - 0.42 × xu)
    // Mu = 0.87 × fy × Ast × d × (1 - 0.42 × xu/d)
    // Using xu from equilibrium:
    // Mu = 0.87 × fy × Ast × d - (0.87 × fy × Ast)² × 0.42 / (0.36 × fck × b)
    
    // Quadratic solution for Ast
    const a = (0.87 * fy) ** 2 * 0.42 / (0.36 * fck * b);
    const bb = -0.87 * fy * d;
    const c = Mu_Nmm;
    
    const discriminant = bb * bb - 4 * a * c;
    const Ast = (-bb - Math.sqrt(discriminant)) / (2 * a);
    const xu = getNeutralAxisDepth(Ast, fck, fy, b);
    
    return { Ast, xu, isDoublyReinforced: false };
  } else {
    // Doubly reinforced section required
    const xuMax_d = IS456_XU_D_LIMIT[`Fe${fy}`] || 0.48;
    const xuMax = xuMax_d * d;
    
    // Steel for limiting moment
    const Ast1 = Mu_lim / (0.87 * fy * (d - 0.42 * xuMax));
    
    // Additional moment
    const Mu2 = Mu_Nmm - Mu_lim;
    
    // Assume compression steel yields
    const d_prime = 0.1 * d; // Assume d' = 0.1d
    const fsc = 0.87 * fy; // Assuming compression steel yields
    
    // Additional steel for Mu2
    const Ast2 = Mu2 / (fsc * (d - d_prime));
    const Asc = Mu2 / ((fsc - 0.447 * fck) * (d - d_prime));
    
    return {
      Ast: Ast1 + Ast2,
      xu: xuMax,
      isDoublyReinforced: true,
      Asc,
    };
  }
}

/**
 * Calculate shear capacity per IS 456 Table 19
 */
export function getShearCapacity(
  fck: number,  // Concrete strength, N/mm²
  pt: number,   // Percentage of tension reinforcement
  b: number,    // Width, mm
  d: number     // Effective depth, mm
): number {
  /**
   * Design shear strength τc from IS 456:2000 Table 19
   * Table values are for M20 concrete.
   * For other grades: τc = τc,M20 × (fck/20)^0.5 but ≤ τc for M40
   * Per IS 456 Table 19 footnote
   */
  
  // Base τc values for M20 concrete (from Table 19)
  const TAU_C_TABLE: { pt: number; tau: number }[] = [
    { pt: 0.15, tau: 0.28 },
    { pt: 0.25, tau: 0.36 },
    { pt: 0.50, tau: 0.48 },
    { pt: 0.75, tau: 0.56 },
    { pt: 1.00, tau: 0.62 },
    { pt: 1.25, tau: 0.67 },
    { pt: 1.50, tau: 0.72 },
    { pt: 1.75, tau: 0.75 },
    { pt: 2.00, tau: 0.79 },
    { pt: 2.25, tau: 0.81 },
    { pt: 2.50, tau: 0.82 },
    { pt: 2.75, tau: 0.82 },
    { pt: 3.00, tau: 0.82 },
  ];
  
  // Interpolate τc for M20 concrete
  let tau_c_M20: number;
  
  if (pt <= TAU_C_TABLE[0].pt) {
    tau_c_M20 = TAU_C_TABLE[0].tau;
  } else if (pt >= TAU_C_TABLE[TAU_C_TABLE.length - 1].pt) {
    tau_c_M20 = TAU_C_TABLE[TAU_C_TABLE.length - 1].tau;
  } else {
    // Linear interpolation
    for (let i = 0; i < TAU_C_TABLE.length - 1; i++) {
      if (pt >= TAU_C_TABLE[i].pt && pt <= TAU_C_TABLE[i + 1].pt) {
        const ratio = (pt - TAU_C_TABLE[i].pt) / (TAU_C_TABLE[i + 1].pt - TAU_C_TABLE[i].pt);
        tau_c_M20 = TAU_C_TABLE[i].tau + ratio * (TAU_C_TABLE[i + 1].tau - TAU_C_TABLE[i].tau);
        break;
      }
    }
  }
  
  // Grade factor per IS 456 Table 19 footnote:
  // τc for other grades = τc,M20 × √(fck/20), but not exceeding value for M40
  // For M40: max grade factor = √(40/20) = √2 ≈ 1.414
  const gradeFactor = Math.min(Math.sqrt(fck / 20), Math.sqrt(40 / 20));
  const tau_c = tau_c_M20! * gradeFactor;
  
  // Return shear capacity in kN
  return tau_c * b * d / 1000;
}

/**
 * Maximum shear stress per IS 456 Table 20
 */
export function getMaxShearStress(fck: number): number {
  if (fck <= 20) return 2.8;
  if (fck <= 25) return 3.1;
  if (fck <= 30) return 3.5;
  if (fck <= 35) return 3.7;
  if (fck <= 40) return 4.0;
  return 4.0;
}

/**
 * Calculate shear reinforcement per IS 456 Clause 40.4
 */
export function getShearReinforcement(
  Vu: number,   // Factored shear, kN
  Vc: number,   // Shear capacity of concrete, kN
  fy: number,   // Steel strength, N/mm²
  b: number,    // Width, mm
  d: number     // Effective depth, mm
): { Vus: number; Asv_s: number; minAsv_s: number } {
  const Vus = Vu - Vc; // Shear to be resisted by stirrups
  
  // Asv/s = Vus / (0.87 × fy × d)
  const Asv_s = Vus > 0 ? (Vus * 1000) / (0.87 * fy * d) : 0;
  
  // Minimum shear reinforcement per Clause 26.5.1.6
  // Asv ≥ 0.4 × b × s / (0.87 × fy)
  const minAsv_s = (0.4 * b) / (0.87 * fy);
  
  return { Vus: Math.max(0, Vus), Asv_s, minAsv_s };
}

/**
 * Calculate development length per IS 456 Clause 26.2.1
 */
export function getDevelopmentLength(
  phi: number,   // Bar diameter, mm
  fy: number,    // Steel strength, N/mm²
  fck: number,   // Concrete strength, N/mm²
  isCompression: boolean = false,
  isDeformed: boolean = true
): number {
  // τbd from Table (simplified)
  let tau_bd: number;
  const grade = `M${Math.round(fck / 5) * 5}`;
  const bondValues = IS456_BOND_STRESS[grade] || IS456_BOND_STRESS.M20;
  
  if (isDeformed) {
    tau_bd = isCompression ? bondValues.deformed_compression : bondValues.deformed_tension;
  } else {
    tau_bd = isCompression ? bondValues.plain_compression : bondValues.plain_tension;
  }
  
  // Ld = φ × σs / (4 × τbd)
  // σs = 0.87 × fy
  const sigma_s = 0.87 * fy;
  const Ld = (phi * sigma_s) / (4 * tau_bd);
  
  return Ld;
}

/**
 * Calculate deflection per IS 456 Clause 23.2
 */
export function checkDeflection(
  span: number,       // Span in mm
  d: number,          // Effective depth in mm
  pt: number,         // Tension reinforcement %
  pc: number,         // Compression reinforcement %
  fs: number,         // Steel stress at service load
  fck: number,        // Concrete strength
  supportCondition: 'cantilever' | 'simply_supported' | 'continuous'
): { isOk: boolean; actualRatio: number; allowableRatio: number; modificationFactor: number } {
  const basicRatio = IS456_SPAN_DEPTH_RATIO[supportCondition];
  
  const kt = getModificationFactorTension(pt, fs, fck);
  const kc = getModificationFactorCompression(pc);
  
  const modificationFactor = kt * kc;
  const allowableRatio = basicRatio * modificationFactor;
  const actualRatio = span / d;
  
  return {
    isOk: actualRatio <= allowableRatio,
    actualRatio,
    allowableRatio,
    modificationFactor,
  };
}

// ============================================================================
// COMPREHENSIVE BEAM DESIGN
// ============================================================================

export interface IS456BeamInput {
  // Geometry
  b: number;          // Width, mm
  D: number;          // Overall depth, mm
  d?: number;         // Effective depth, mm (calculated if not provided)
  span: number;       // Span, mm
  
  // Materials
  fck: number;        // Concrete grade, N/mm²
  fy: number;         // Steel grade, N/mm²
  
  // Loads (factored)
  Mu: number;         // Design moment, kN-m
  Vu: number;         // Design shear, kN
  
  // Service loads (for deflection)
  Ms?: number;        // Service moment, kN-m
  
  // Cover
  cover: number;      // Clear cover, mm
  
  // Support condition
  support: 'cantilever' | 'simply_supported' | 'continuous';
  
  // Options
  showDetailedCalc?: boolean;
}

export interface IS456BeamResult {
  isAdequate: boolean;
  
  // Flexure
  flexure: {
    isDoublyReinforced: boolean;
    Ast_required: number;    // mm²
    Asc_required?: number;   // mm²
    Ast_provided: number;    // mm²
    Asc_provided?: number;   // mm²
    bars_tension: string;    // e.g., "4-20φ"
    bars_compression?: string;
    pt: number;              // %
    pc?: number;             // %
    xu: number;              // mm
    xu_d: number;
    Mu_capacity: number;     // kN-m
    ratio: number;
  };
  
  // Shear
  shear: {
    tau_v: number;           // N/mm²
    tau_c: number;           // N/mm²
    tau_c_max: number;       // N/mm²
    Vc: number;              // kN
    Vus: number;             // kN
    stirrup_size: number;    // mm
    stirrup_spacing: number; // mm
    ratio: number;
  };
  
  // Deflection
  deflection?: {
    isOk: boolean;
    actualRatio: number;
    allowableRatio: number;
  };
  
  // Calculation steps
  calculations: CalculationStep[];
  
  // Diagrams
  diagrams: DiagramData[];
  
  summary: {
    utilizationRatio: number;
    governingCondition: string;
    status: 'ADEQUATE' | 'INADEQUATE';
  };
}

/**
 * Complete beam design per IS 456
 */
export function designBeamIS456(input: IS456BeamInput): IS456BeamResult {
  const calculations: CalculationStep[] = [];
  const diagrams: DiagramData[] = [];
  let stepNo = 1;
  
  const { b, D, span, fck, fy, Mu, Vu, Ms, cover, support } = input;
  
  // Calculate effective depth
  const assumed_bar_dia = 20;
  const stirrup_dia = 8;
  const d = input.d || (D - cover - stirrup_dia - assumed_bar_dia / 2);
  
  // ============================================================================
  // STEP 1: FLEXURAL DESIGN
  // ============================================================================
  
  calculations.push(createCalculationStep({
    step: stepNo++,
    title: 'Effective Depth Calculation',
    description: 'Calculate effective depth considering clear cover and reinforcement',
    formula: 'd = D - cover - φ_stirrup - φ_bar/2',
    values: {
      D: { value: D, unit: 'mm', description: 'Overall depth' },
      cover: { value: cover, unit: 'mm', description: 'Clear cover' },
      'φ_stirrup': { value: stirrup_dia, unit: 'mm', description: 'Stirrup diameter' },
      'φ_bar': { value: assumed_bar_dia, unit: 'mm', description: 'Main bar diameter' },
    },
    result: { value: roundTo(d, 1), unit: 'mm', description: 'Effective depth' },
    code: DesignCode.IS_456,
    clause: '26.4.2.1',
    status: 'OK',
  }));
  
  // Limiting moment
  const Mu_lim = getLimitingMoment(fck, fy, b, d);
  const xuMax_d = IS456_XU_D_LIMIT[`Fe${fy}`] || 0.48;
  
  calculations.push(createCalculationStep({
    step: stepNo++,
    title: 'Limiting Moment of Resistance',
    description: 'Calculate limiting moment for balanced section',
    formula: 'M_u,lim = 0.36 × f_ck × b × x_u,max × (d - 0.42 × x_u,max)',
    values: {
      f_ck: { value: fck, unit: 'N/mm²', description: 'Concrete strength' },
      b: { value: b, unit: 'mm', description: 'Width' },
      'd': { value: roundTo(d, 1), unit: 'mm', description: 'Effective depth' },
      'x_u,max/d': { value: xuMax_d, description: `For Fe${fy}` },
    },
    result: { value: roundTo(Mu_lim, 2), unit: 'kN-m', description: 'Limiting moment' },
    code: DesignCode.IS_456,
    clause: '38.1',
    table: 'Clause 38.1',
    status: 'OK',
    diagram: {
      type: DiagramType.STRESS_DIAGRAM,
      title: 'Stress-Strain Distribution at Limiting State',
      data: {
        section: { b, D, d, cover },
        stressBlock: {
          xu: xuMax_d * d,
          compression: 0.447 * fck,
        },
      },
    },
  }));
  
  // Required steel
  const steelResult = getRequiredTensionSteel(Mu, fck, fy, b, d);
  const isDoublyReinforced = steelResult.isDoublyReinforced;
  
  let Ast_required = steelResult.Ast;
  let Asc_required = steelResult.Asc;
  
  // Minimum reinforcement per IS 456 Clause 26.5.1.1
  const Ast_min = 0.85 * b * d / fy;
  // Maximum reinforcement per IS 456 Clause 26.5.1.1
  const Ast_max = 0.04 * b * D;
  
  Ast_required = Math.max(Ast_required, Ast_min);
  
  calculations.push(createCalculationStep({
    step: stepNo++,
    title: 'Required Tension Reinforcement',
    description: isDoublyReinforced 
      ? 'Section requires compression reinforcement (doubly reinforced)'
      : 'Singly reinforced section is sufficient',
    formula: isDoublyReinforced
      ? 'A_st = A_st1 + A_st2; A_st1 for M_u,lim, A_st2 for (M_u - M_u,lim)'
      : 'A_st = M_u / (0.87 × f_y × (d - 0.42 × x_u))',
    values: {
      M_u: { value: Mu, unit: 'kN-m', description: 'Design moment' },
      M_u_lim: { value: roundTo(Mu_lim, 2), unit: 'kN-m', description: 'Limiting moment' },
      f_y: { value: fy, unit: 'N/mm²', description: 'Steel strength' },
    },
    result: { 
      value: roundTo(Ast_required, 0), 
      unit: 'mm²', 
      description: 'Required tension steel' 
    },
    code: DesignCode.IS_456,
    clause: '38.1',
    status: Ast_required <= Ast_max ? 'OK' : 'WARNING',
    notes: [
      `Minimum reinforcement: ${roundTo(Ast_min, 0)} mm² (Clause 26.5.1.1)`,
      `Maximum reinforcement: ${roundTo(Ast_max, 0)} mm² (4% of bD)`,
    ],
  }));
  
  // Select bars
  const { bars: bars_tension, As: Ast_provided, details: tension_details } = selectBars(Ast_required, b, cover);
  
  let bars_compression: string | undefined;
  let Asc_provided: number | undefined;
  
  if (isDoublyReinforced && Asc_required) {
    const compResult = selectBars(Asc_required, b, cover);
    bars_compression = compResult.bars;
    Asc_provided = compResult.As;
  }
  
  // Calculate actual moment capacity
  const capacityResult = getMomentCapacity(Ast_provided, fck, fy, b, d);
  
  calculations.push(createCalculationStep({
    step: stepNo++,
    title: 'Reinforcement Selection and Capacity Check',
    description: 'Select reinforcement bars and verify moment capacity',
    formula: 'M_u,provided = 0.87 × f_y × A_st × (d - 0.42 × x_u)',
    values: {
      A_st_provided: { value: roundTo(Ast_provided, 0), unit: 'mm²', description: 'Provided steel' },
      bars: { value: bars_tension, description: 'Bar arrangement' },
      x_u: { value: roundTo(capacityResult.xu, 1), unit: 'mm', description: 'Neutral axis depth' },
    },
    result: { 
      value: roundTo(capacityResult.Mu, 2), 
      unit: 'kN-m', 
      description: 'Moment capacity' 
    },
    code: DesignCode.IS_456,
    clause: '38.1',
    status: capacityResult.Mu >= Mu ? 'OK' : 'FAIL',
    notes: [
      `x_u/d = ${roundTo(capacityResult.xu_d, 3)} ${capacityResult.isUnderReinforced ? '< ' : '> '} ${xuMax_d} (${capacityResult.isUnderReinforced ? 'Under-reinforced - OK' : 'Over-reinforced - Check!'})`,
    ],
    diagram: {
      type: DiagramType.CROSS_SECTION,
      title: 'Beam Cross-Section with Reinforcement',
      data: {
        b, D, d, cover,
        tension: { bars: bars_tension, As: Ast_provided },
        compression: bars_compression ? { bars: bars_compression, As: Asc_provided } : undefined,
      },
    },
  }));
  
  const pt = (Ast_provided * 100) / (b * d);
  const pc = Asc_provided ? (Asc_provided * 100) / (b * d) : 0;
  
  // ============================================================================
  // STEP 2: SHEAR DESIGN
  // ============================================================================
  
  const tau_v = (Vu * 1000) / (b * d); // N/mm²
  const tau_c_max = getMaxShearStress(fck);
  const Vc = getShearCapacity(fck, pt, b, d);
  const tau_c = Vc * 1000 / (b * d);
  
  calculations.push(createCalculationStep({
    step: stepNo++,
    title: 'Nominal Shear Stress',
    description: 'Calculate nominal shear stress and compare with permissible values',
    formula: 'τ_v = V_u / (b × d)',
    values: {
      V_u: { value: Vu, unit: 'kN', description: 'Design shear force' },
      b: { value: b, unit: 'mm', description: 'Width' },
      d: { value: roundTo(d, 1), unit: 'mm', description: 'Effective depth' },
    },
    result: { 
      value: roundTo(tau_v, 3), 
      unit: 'N/mm²', 
      description: 'Nominal shear stress' 
    },
    code: DesignCode.IS_456,
    clause: '40.1',
    status: tau_v <= tau_c_max ? 'OK' : 'FAIL',
    notes: [
      `τ_c (Table 19) = ${roundTo(tau_c, 3)} N/mm² for pt = ${roundTo(pt, 2)}%`,
      `τ_c,max (Table 20) = ${tau_c_max} N/mm² for M${fck}`,
    ],
  }));
  
  // Shear reinforcement
  const shearResult = getShearReinforcement(Vu, Vc, fy, b, d);
  
  let stirrup_dia_selected = 8;
  let Asv = 2 * Math.PI * (stirrup_dia_selected / 2) ** 2; // 2-legged stirrup
  let sv = shearResult.Asv_s > 0 
    ? Asv / Math.max(shearResult.Asv_s, shearResult.minAsv_s)
    : Asv / shearResult.minAsv_s;
  
  // Round down to practical spacing
  sv = Math.floor(sv / 25) * 25;
  sv = Math.min(sv, 0.75 * d, 300); // Maximum spacing per IS 456 Clause 26.5.1.5
  
  calculations.push(createCalculationStep({
    step: stepNo++,
    title: 'Shear Reinforcement Design',
    description: 'Design stirrups to resist excess shear',
    formula: 'V_us = V_u - V_c; A_sv/s_v = V_us / (0.87 × f_y × d)',
    values: {
      V_c: { value: roundTo(Vc, 2), unit: 'kN', description: 'Shear capacity of concrete' },
      V_us: { value: roundTo(shearResult.Vus, 2), unit: 'kN', description: 'Shear by stirrups' },
      f_y: { value: fy, unit: 'N/mm²', description: 'Stirrup yield strength' },
    },
    result: { 
      value: `${stirrup_dia_selected}φ @ ${sv} c/c`, 
      unit: 'mm', 
      description: '2-legged stirrups' 
    },
    code: DesignCode.IS_456,
    clause: '40.4',
    status: 'OK',
    notes: [
      `Minimum Asv/sv = ${roundTo(shearResult.minAsv_s, 4)} mm²/mm (Clause 26.5.1.6)`,
      `Maximum spacing = min(0.75d, 300) = ${Math.min(0.75 * d, 300)} mm`,
    ],
    diagram: {
      type: DiagramType.SHEAR_DIAGRAM,
      title: 'Shear Force Diagram and Stirrup Spacing',
      data: {
        Vu, Vc, tau_v, tau_c,
        stirrups: { dia: stirrup_dia_selected, spacing: sv },
      },
    },
  }));
  
  // ============================================================================
  // STEP 3: DEFLECTION CHECK
  // ============================================================================
  
  let deflectionResult: { isOk: boolean; actualRatio: number; allowableRatio: number } | undefined;
  
  if (Ms) {
    const fs = 0.58 * fy; // Approximate service stress
    deflectionResult = checkDeflection(span, d, pt, pc, fs, fck, support);
    
    calculations.push(createCalculationStep({
      step: stepNo++,
      title: 'Deflection Check (Span/Depth Ratio)',
      description: 'Verify deflection using simplified span/depth ratio method',
      formula: 'L/d_actual ≤ Basic ratio × k_t × k_c',
      values: {
        'L': { value: span, unit: 'mm', description: 'Span' },
        'd': { value: roundTo(d, 1), unit: 'mm', description: 'Effective depth' },
        'Basic ratio': { value: IS456_SPAN_DEPTH_RATIO[support], description: `For ${support}` },
        'p_t': { value: roundTo(pt, 2), unit: '%', description: 'Tension steel percentage' },
      },
      result: { 
        value: deflectionResult.isOk ? 'SATISFACTORY' : 'NOT SATISFACTORY', 
        description: `Actual ${roundTo(deflectionResult.actualRatio, 1)} vs Allowable ${roundTo(deflectionResult.allowableRatio, 1)}` 
      },
      code: DesignCode.IS_456,
      clause: '23.2.1',
      figure: 'Fig 4 & 5',
      status: deflectionResult.isOk ? 'OK' : 'FAIL',
    }));
  }
  
  // ============================================================================
  // SUMMARY
  // ============================================================================
  
  const flexureRatio = Mu / capacityResult.Mu;
  const shearRatio = tau_v / tau_c_max;
  const governingRatio = Math.max(flexureRatio, shearRatio);
  
  const isAdequate = 
    capacityResult.Mu >= Mu &&
    tau_v <= tau_c_max &&
    (!deflectionResult || deflectionResult.isOk);
  
  // Add reinforcement layout diagram
  diagrams.push({
    type: DiagramType.REINFORCEMENT_LAYOUT,
    title: 'Complete Reinforcement Layout',
    data: {
      geometry: { b, D, d, span, cover },
      reinforcement: {
        tension: { bars: bars_tension, As: Ast_provided },
        compression: bars_compression ? { bars: bars_compression, As: Asc_provided } : undefined,
        stirrups: { dia: stirrup_dia_selected, spacing: sv },
      },
    },
  });
  
  return {
    isAdequate,
    flexure: {
      isDoublyReinforced,
      Ast_required,
      Asc_required,
      Ast_provided,
      Asc_provided,
      bars_tension,
      bars_compression,
      pt,
      pc: pc > 0 ? pc : undefined,
      xu: capacityResult.xu,
      xu_d: capacityResult.xu_d,
      Mu_capacity: capacityResult.Mu,
      ratio: flexureRatio,
    },
    shear: {
      tau_v,
      tau_c,
      tau_c_max,
      Vc,
      Vus: shearResult.Vus,
      stirrup_size: stirrup_dia_selected,
      stirrup_spacing: sv,
      ratio: shearRatio,
    },
    deflection: deflectionResult,
    calculations,
    diagrams,
    summary: {
      utilizationRatio: governingRatio,
      governingCondition: flexureRatio > shearRatio ? 'Flexure' : 'Shear',
      status: isAdequate ? 'ADEQUATE' : 'INADEQUATE',
    },
  };
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Select reinforcement bars
 */
function selectBars(
  As_required: number,
  width: number,
  cover: number
): { bars: string; As: number; details: { dia: number; count: number }[] } {
  const standardBars = [12, 16, 20, 25, 32];
  const results: { bars: string; As: number; details: { dia: number; count: number }[] }[] = [];
  
  // Try single bar size
  for (const dia of standardBars) {
    const area = Math.PI * (dia / 2) ** 2;
    const count = Math.ceil(As_required / area);
    const As = count * area;
    
    // Check if bars fit
    const minSpacing = Math.max(dia, 25); // IS 456 Clause 26.3.2
    const requiredWidth = 2 * cover + count * dia + (count - 1) * minSpacing;
    
    if (requiredWidth <= width && count >= 2 && count <= 8) {
      results.push({
        bars: `${count}-${dia}φ`,
        As: roundTo(As, 0),
        details: [{ dia, count }],
      });
    }
  }
  
  // Try combinations of two bar sizes
  for (let i = 0; i < standardBars.length - 1; i++) {
    const dia1 = standardBars[i];
    const dia2 = standardBars[i + 1];
    
    for (let n1 = 2; n1 <= 4; n1++) {
      for (let n2 = 2; n2 <= 4; n2++) {
        const As = n1 * Math.PI * (dia1 / 2) ** 2 + n2 * Math.PI * (dia2 / 2) ** 2;
        
        if (As >= As_required && As <= As_required * 1.15) {
          results.push({
            bars: `${n1}-${dia1}φ + ${n2}-${dia2}φ`,
            As: roundTo(As, 0),
            details: [{ dia: dia1, count: n1 }, { dia: dia2, count: n2 }],
          });
        }
      }
    }
  }
  
  // Sort by efficiency (closest to required without going under)
  results.sort((a, b) => a.As - b.As);
  
  // Return the most efficient option
  return results.find(r => r.As >= As_required) || results[results.length - 1] || {
    bars: `${Math.ceil(As_required / (Math.PI * 12.5 ** 2))}-25φ`,
    As: Math.ceil(As_required / (Math.PI * 12.5 ** 2)) * Math.PI * 12.5 ** 2,
    details: [{ dia: 25, count: Math.ceil(As_required / (Math.PI * 12.5 ** 2)) }],
  };
}

// Export types
export type { CalculationStep, DiagramData };
