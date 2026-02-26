/**
 * ============================================================================
 * IS 1343:2012 - PRESTRESSED CONCRETE DESIGN
 * ============================================================================
 * 
 * Comprehensive implementation of IS 1343:2012 for prestressed concrete
 * structures including pre-tensioned and post-tensioned members.
 * 
 * SCOPE:
 * - Permissible stresses at transfer and service
 * - Loss of prestress calculations
 * - Flexural strength (ultimate limit state)
 * - Shear design
 * - Deflection and cracking
 * - Transmission length and anchorage
 * 
 * @reference IS 1343:2012 - Bureau of Indian Standards
 * @author BeamLab Engineering Team
 * @version 1.0.0
 */

import {
  createSimpleStep,
  roundTo,
  SimpleCalculationStep,
} from '../core/CalculationEngine';

// Alias for backward compatibility
type CalculationStep = SimpleCalculationStep;
const createCalculationStep = createSimpleStep;

// ============================================================================
// MATERIAL PROPERTIES - IS 1343:2012 TABLE 1 & 2
// ============================================================================

/**
 * Characteristic strength of concrete for prestressed work
 * Table 1 - IS 1343:2012
 */
export const IS1343_CONCRETE_GRADES = {
  M30: { fck: 30, Ec: 31000, fci_min: 20 },
  M35: { fck: 35, Ec: 32500, fci_min: 24 },
  M40: { fck: 40, Ec: 33000, fci_min: 27 },
  M45: { fck: 45, Ec: 34000, fci_min: 30 },
  M50: { fck: 50, Ec: 35000, fci_min: 33 },
  M55: { fck: 55, Ec: 36000, fci_min: 37 },
  M60: { fck: 60, Ec: 37000, fci_min: 40 },
  M65: { fck: 65, Ec: 38000, fci_min: 43 },
  M70: { fck: 70, Ec: 39000, fci_min: 47 },
  M75: { fck: 75, Ec: 39500, fci_min: 50 },
  M80: { fck: 80, Ec: 40000, fci_min: 53 },
} as const;

/**
 * Prestressing steel properties
 * Table 2 - IS 1343:2012
 */
export const IS1343_PRESTRESS_STEEL = {
  // High Tensile Steel Bars (IS 2090)
  bars: {
    fy: 980,  // MPa - 0.2% proof stress
    fpu: 1030, // MPa - Ultimate tensile strength
    Es: 200000, // MPa - Modulus of elasticity
    relaxation: 'low', // Low relaxation
  },
  // High Tensile Steel Wire (IS 1785)
  wire_5mm: {
    fy: 1570,
    fpu: 1765,
    Es: 200000,
    relaxation: 'low',
  },
  wire_4mm: {
    fy: 1715,
    fpu: 1865,
    Es: 200000,
    relaxation: 'low',
  },
  // 7-Wire Strands (IS 6003/IS 6006)
  strand_12_7mm: {
    fy: 1580,  // 0.1% proof stress
    fpu: 1860,
    Es: 195000,
    area: 98.7, // mm² per strand
    relaxation: 'low',
  },
  strand_15_2mm: {
    fy: 1580,
    fpu: 1860,
    Es: 195000,
    area: 140, // mm² per strand
    relaxation: 'low',
  },
  strand_12_7mm_super: {
    fy: 1675,
    fpu: 1860,
    Es: 195000,
    area: 98.7,
    relaxation: 'super_low',
  },
} as const;

/**
 * Permissible stresses in concrete - Clause 22.1
 * At Transfer (fci = strength at transfer)
 * At Service (fck = 28-day strength)
 */
export const IS1343_PERMISSIBLE_STRESSES = {
  // Compression
  compression_transfer: 0.54, // 0.54 × fci
  compression_service: 0.41, // 0.41 × fck (for effective prestress + DL)
  compression_service_total: 0.35, // 0.35 × fck (for all loads)
  
  // Tension (Type 1 - No tensile stress)
  tension_type1_transfer: 0,
  tension_type1_service: 0,
  
  // Tension (Type 2 - Limited tensile stress, no visible cracking)
  tension_type2_transfer: (fci: number) => Math.min(3, 0.7 * Math.sqrt(fci)), // MPa
  tension_type2_service: (fck: number) => Math.min(4.5, 0.7 * Math.sqrt(fck)), // MPa
  
  // Tension (Type 3 - Cracking permitted)
  tension_type3_service: 'Design as per limit state method',
} as const;

/**
 * Permissible stresses in prestressing steel - Clause 22.2
 */
export const IS1343_STEEL_STRESS_LIMITS = {
  // At transfer
  initial_pretension: 0.80, // 0.80 × fpu (for pre-tensioned)
  initial_posttension: 0.90, // 0.90 × fy (for post-tensioned at jacking)
  
  // Effective prestress after losses
  effective_max: 0.70, // 0.70 × fpu
} as const;

// ============================================================================
// LOSS OF PRESTRESS - CLAUSE 18
// ============================================================================

export interface PrestressLossInput {
  // Geometry
  span: number;           // mm
  eccentricity: number;   // mm (average)
  Ac: number;             // mm² - Concrete area
  Ic: number;             // mm⁴ - Moment of inertia
  perimeter: number;      // mm - Perimeter for humidity calculation
  
  // Material properties
  fck: number;            // MPa
  fci: number;            // MPa - Strength at transfer
  Ec: number;             // MPa
  Es: number;             // MPa - Steel modulus
  fpu: number;            // MPa - Ultimate strength of steel
  
  // Prestress details
  Ap: number;             // mm² - Area of prestressing steel
  fpi: number;            // MPa - Initial prestress
  type: 'pretension' | 'posttension';
  
  // Post-tension specific
  wobble_coefficient?: number;  // k per meter
  friction_coefficient?: number; // μ
  anchorage_slip?: number;      // mm
  cable_profile?: 'parabolic' | 'straight' | 'harped';
  
  // Environmental
  humidity: number;       // % (50-80 typical)
  age_at_transfer: number; // days
  age_at_service: number;  // days
}

export interface PrestressLossResult {
  // Individual losses (MPa)
  elastic_shortening: number;
  friction: number;
  anchorage_slip: number;
  relaxation: number;
  shrinkage: number;
  creep: number;
  
  // Total losses
  immediate_loss: number;
  time_dependent_loss: number;
  total_loss: number;
  loss_percentage: number;
  
  // Effective prestress
  fpe: number;            // MPa - Effective prestress
  Pe: number;             // kN - Effective prestressing force
  
  steps: CalculationStep[];
}

/**
 * Calculate elastic shortening loss
 * Clause 18.5.2.1
 */
export function calculateElasticShortening(
  fci: number,
  Ec: number,
  Es: number,
  fpi: number,
  Ap: number,
  Ac: number,
  e: number,
  Ic: number,
  type: 'pretension' | 'posttension',
  numStrands?: number
): { loss: number; step: CalculationStep } {
  // Modular ratio
  const m = Es / Ec;
  
  // Initial stress at centroid of steel
  const fcpi = (fpi * Ap / Ac) * (1 + (e * e * Ac) / Ic);
  
  let loss: number;
  
  if (type === 'pretension') {
    // For pre-tensioned: full elastic shortening
    loss = m * fcpi;
  } else {
    // For post-tensioned: depends on sequence of stressing
    // Average loss = (n-1)/(2n) × m × fcpi where n = number of stages
    const n = numStrands || 1;
    loss = ((n - 1) / (2 * n)) * m * fcpi;
  }
  
  const step = createCalculationStep(
    'Elastic Shortening Loss',
    `Per IS 1343 Clause 18.5.2.1:
    For ${type}: Δfp,es = ${type === 'pretension' ? 'm × fcgp' : '(n-1)/(2n) × m × fcgp'}
    where m = Es/Ec and fcgp = stress in concrete at steel centroid`,
    `\\Delta f_{p,es} = ${roundTo(m, 2)} \\times ${roundTo(fcpi, 2)} = ${roundTo(loss, 2)} \\text{ MPa}`,
    {
      'Modular ratio (m)': roundTo(m, 2),
      'Stress at steel level (fcgp)': `${roundTo(fcpi, 2)} MPa`,
      'Type': type,
      'Elastic shortening loss': `${roundTo(loss, 2)} MPa`,
    },
    'IS 1343 Cl. 18.5.2.1'
  );
  
  return { loss: roundTo(loss, 2), step };
}

/**
 * Calculate friction loss for post-tensioned members
 * Clause 18.5.2.2
 */
export function calculateFrictionLoss(
  fpi: number,
  mu: number,      // Friction coefficient (0.15-0.55)
  k: number,       // Wobble coefficient per meter (0.0015-0.0050)
  L: number,       // Length in mm
  alpha: number    // Total angular change in radians
): { loss: number; step: CalculationStep } {
  // Friction loss: Δfp,fr = fpi × (1 - e^(-μα - kL))
  const kL = k * (L / 1000); // Convert to meters
  const exponent = mu * alpha + kL;
  const loss = fpi * (1 - Math.exp(-exponent));
  
  const step = createCalculationStep(
    'Friction Loss (Post-tensioned)',
    `Per IS 1343 Clause 18.5.2.2:
    Δfp,fr = fpi × (1 - e^(-μα - kL))
    where μ = friction coefficient, k = wobble coefficient, α = angle change`,
    `\\Delta f_{p,fr} = ${fpi} \\times (1 - e^{-(${mu} \\times ${roundTo(alpha, 4)} + ${k} \\times ${L/1000})}) = ${roundTo(loss, 2)} \\text{ MPa}`,
    {
      'Initial prestress (fpi)': `${fpi} MPa`,
      'Friction coefficient (μ)': mu,
      'Wobble coefficient (k)': `${k} /m`,
      'Length (L)': `${L / 1000} m`,
      'Angular change (α)': `${roundTo(alpha, 4)} rad`,
      'Friction loss': `${roundTo(loss, 2)} MPa`,
    },
    'IS 1343 Cl. 18.5.2.2'
  );
  
  return { loss: roundTo(loss, 2), step };
}

/**
 * Calculate anchorage slip loss
 * Clause 18.5.2.3
 */
export function calculateAnchorageSlipLoss(
  slip: number,      // mm (typically 3-10mm)
  Es: number,        // MPa
  L: number,         // mm - Length to dead end
  frictionLossPerM: number // MPa/m
): { loss: number; affectedLength: number; step: CalculationStep } {
  // Affected length where slip overcomes friction
  const p = frictionLossPerM; // Loss per meter due to friction
  const L_affected = Math.sqrt((slip * Es) / (p * 1000)) * 1000; // mm
  
  // Loss at anchorage
  const loss = (2 * slip * Es) / L_affected;
  
  // If affected length > tendon length, recalculate
  const actualLoss = L_affected > L ? (slip * Es) / L : loss;
  const actualAffectedLength = Math.min(L_affected, L);
  
  const step = createCalculationStep(
    'Anchorage Slip Loss',
    `Per IS 1343 Clause 18.5.2.3:
    Affected length Lp = √(Δs × Es / p)
    Loss at anchor = 2 × Δs × Es / Lp`,
    `L_p = \\sqrt{\\frac{${slip} \\times ${Es}}{${p}}} = ${roundTo(actualAffectedLength, 0)} \\text{ mm}`,
    {
      'Anchorage slip (Δs)': `${slip} mm`,
      'Friction loss rate (p)': `${roundTo(p, 2)} MPa/m`,
      'Affected length': `${roundTo(actualAffectedLength, 0)} mm`,
      'Slip loss at anchor': `${roundTo(actualLoss, 2)} MPa`,
    },
    'IS 1343 Cl. 18.5.2.3'
  );
  
  return { 
    loss: roundTo(actualLoss, 2), 
    affectedLength: roundTo(actualAffectedLength, 0),
    step 
  };
}

/**
 * Calculate relaxation loss in prestressing steel
 * Clause 18.5.2.4
 */
export function calculateRelaxationLoss(
  fpi: number,
  fpu: number,
  relaxationType: 'normal' | 'low' | 'super_low',
  time: number      // Hours (typically 1000 for design)
): { loss: number; step: CalculationStep } {
  const ratio = fpi / fpu;
  
  // Relaxation factors based on initial stress ratio
  let relaxationPercent: number;
  
  if (relaxationType === 'super_low') {
    // Super low relaxation strands
    if (ratio <= 0.6) relaxationPercent = 0.5;
    else if (ratio <= 0.7) relaxationPercent = 1.0;
    else if (ratio <= 0.8) relaxationPercent = 2.5;
    else relaxationPercent = 4.0;
  } else if (relaxationType === 'low') {
    // Low relaxation strands
    if (ratio <= 0.6) relaxationPercent = 1.0;
    else if (ratio <= 0.7) relaxationPercent = 2.5;
    else if (ratio <= 0.8) relaxationPercent = 5.0;
    else relaxationPercent = 8.0;
  } else {
    // Normal relaxation
    if (ratio <= 0.6) relaxationPercent = 3.0;
    else if (ratio <= 0.7) relaxationPercent = 6.0;
    else if (ratio <= 0.8) relaxationPercent = 10.0;
    else relaxationPercent = 15.0;
  }
  
  // Time factor (approximately logarithmic)
  const timeFactor = Math.log10(time / 1000 + 1) + 1;
  const loss = fpi * relaxationPercent * timeFactor / 100;
  
  const step = createCalculationStep(
    'Relaxation Loss',
    `Per IS 1343 Clause 18.5.2.4:
    Relaxation depends on initial stress ratio (fpi/fpu) and steel type
    For ${relaxationType} relaxation at ratio ${roundTo(ratio, 2)}`,
    `\\Delta f_{p,rel} = f_{pi} \\times ${relaxationPercent}\\% \\times k_t = ${roundTo(loss, 2)} \\text{ MPa}`,
    {
      'Initial prestress (fpi)': `${fpi} MPa`,
      'Ultimate strength (fpu)': `${fpu} MPa`,
      'Stress ratio (fpi/fpu)': roundTo(ratio, 3),
      'Relaxation type': relaxationType,
      'Base relaxation': `${relaxationPercent}%`,
      'Relaxation loss': `${roundTo(loss, 2)} MPa`,
    },
    'IS 1343 Cl. 18.5.2.4'
  );
  
  return { loss: roundTo(loss, 2), step };
}

/**
 * Calculate shrinkage loss
 * Clause 18.5.2.5
 */
export function calculateShrinkageLoss(
  Es: number,
  humidity: number,    // %
  age_transfer: number, // days
  age_service: number,  // days
  Ac: number,          // mm²
  perimeter: number    // mm
): { loss: number; strain: number; step: CalculationStep } {
  // Theoretical thickness
  const h0 = 2 * Ac / perimeter;
  
  // Base shrinkage strain (from IS 1343 Table 5)
  let eps_sh_base: number;
  if (humidity >= 70) {
    eps_sh_base = 275e-6;
  } else if (humidity >= 50) {
    eps_sh_base = 380e-6;
  } else {
    eps_sh_base = 500e-6;
  }
  
  // Size factor
  const k_h = h0 <= 100 ? 1.0 : h0 <= 200 ? 0.85 : h0 <= 300 ? 0.75 : 0.70;
  
  // Time development factor
  const t_s = age_transfer;
  const t = age_service;
  const beta_s = (t - t_s) / ((t - t_s) + 0.04 * Math.pow(h0, 1.5));
  
  const eps_sh = eps_sh_base * k_h * beta_s;
  const loss = eps_sh * Es;
  
  const step = createCalculationStep(
    'Shrinkage Loss',
    `Per IS 1343 Clause 18.5.2.5:
    εsh = εsh,base × kh × βs(t,ts)
    Δfp,sh = εsh × Es`,
    `\\Delta f_{p,sh} = ${roundTo(eps_sh * 1e6, 0)} \\times 10^{-6} \\times ${Es} = ${roundTo(loss, 2)} \\text{ MPa}`,
    {
      'Theoretical thickness (h0)': `${roundTo(h0, 0)} mm`,
      'Relative humidity': `${humidity}%`,
      'Base shrinkage strain': `${roundTo(eps_sh_base * 1e6, 0)} × 10⁻⁶`,
      'Size factor (kh)': roundTo(k_h, 2),
      'Time factor (βs)': roundTo(beta_s, 3),
      'Final shrinkage strain': `${roundTo(eps_sh * 1e6, 0)} × 10⁻⁶`,
      'Shrinkage loss': `${roundTo(loss, 2)} MPa`,
    },
    'IS 1343 Cl. 18.5.2.5'
  );
  
  return { loss: roundTo(loss, 2), strain: eps_sh, step };
}

/**
 * Calculate creep loss
 * Clause 18.5.2.6
 */
export function calculateCreepLoss(
  fci: number,
  fc_avg: number,      // Average concrete stress under sustained load
  Es: number,
  Ec: number,
  humidity: number,
  age_loading: number, // days
  age_service: number  // days
): { loss: number; coefficient: number; step: CalculationStep } {
  const m = Es / Ec;
  
  // Creep coefficient (from IS 1343 Table 4)
  let phi_base: number;
  if (humidity >= 70) {
    phi_base = age_loading <= 7 ? 2.5 : age_loading <= 28 ? 2.0 : 1.5;
  } else if (humidity >= 50) {
    phi_base = age_loading <= 7 ? 3.5 : age_loading <= 28 ? 2.8 : 2.2;
  } else {
    phi_base = age_loading <= 7 ? 4.5 : age_loading <= 28 ? 3.5 : 2.8;
  }
  
  // Time development
  const t0 = age_loading;
  const t = age_service;
  const beta_c = Math.pow((t - t0) / (350 + t - t0), 0.5);
  
  const phi = phi_base * beta_c;
  const loss = m * phi * fc_avg;
  
  const step = createCalculationStep(
    'Creep Loss',
    `Per IS 1343 Clause 18.5.2.6:
    φ(t,t0) = φ0 × βc(t-t0)
    Δfp,cr = m × φ × fc`,
    `\\Delta f_{p,cr} = ${roundTo(m, 2)} \\times ${roundTo(phi, 2)} \\times ${roundTo(fc_avg, 2)} = ${roundTo(loss, 2)} \\text{ MPa}`,
    {
      'Modular ratio (m)': roundTo(m, 2),
      'Base creep coefficient (φ0)': roundTo(phi_base, 2),
      'Time factor (βc)': roundTo(beta_c, 3),
      'Final creep coefficient (φ)': roundTo(phi, 2),
      'Average concrete stress': `${roundTo(fc_avg, 2)} MPa`,
      'Creep loss': `${roundTo(loss, 2)} MPa`,
    },
    'IS 1343 Cl. 18.5.2.6'
  );
  
  return { loss: roundTo(loss, 2), coefficient: phi, step };
}

/**
 * Calculate total prestress losses
 */
export function calculateTotalPrestressLosses(
  input: PrestressLossInput
): PrestressLossResult {
  const steps: CalculationStep[] = [];
  const {
    span, eccentricity, Ac, Ic, perimeter,
    fck, fci, Ec, Es, fpu,
    Ap, fpi, type,
    wobble_coefficient, friction_coefficient, anchorage_slip, cable_profile,
    humidity, age_at_transfer, age_at_service
  } = input;
  
  // Initial prestressing force
  const Pi = fpi * Ap / 1000; // kN
  
  steps.push(createCalculationStep(
    'Initial Prestressing Force',
    'Calculate initial prestressing force before losses',
    `P_i = f_{pi} \\times A_p = ${fpi} \\times ${Ap} / 1000 = ${roundTo(Pi, 2)} \\text{ kN}`,
    {
      'Initial stress (fpi)': `${fpi} MPa`,
      'Steel area (Ap)': `${Ap} mm²`,
      'Initial force (Pi)': `${roundTo(Pi, 2)} kN`,
    },
    'IS 1343'
  ));
  
  // 1. Elastic shortening
  const elastic = calculateElasticShortening(fci, Ec, Es, fpi, Ap, Ac, eccentricity, Ic, type);
  steps.push(elastic.step);
  
  // 2. Friction (post-tensioned only)
  let friction = 0;
  if (type === 'posttension' && friction_coefficient && wobble_coefficient) {
    // Calculate angular change based on profile
    let alpha = 0;
    if (cable_profile === 'parabolic') {
      alpha = 8 * eccentricity / span; // Approximate for parabolic
    } else if (cable_profile === 'harped') {
      alpha = 2 * Math.atan(2 * eccentricity / span);
    }
    const frictionResult = calculateFrictionLoss(fpi, friction_coefficient, wobble_coefficient, span, alpha);
    friction = frictionResult.loss;
    steps.push(frictionResult.step);
  }
  
  // 3. Anchorage slip (post-tensioned only)
  let anchorageSlip = 0;
  if (type === 'posttension' && anchorage_slip && friction_coefficient && wobble_coefficient) {
    const frictionPerM = fpi * (friction_coefficient * 0.001 + wobble_coefficient);
    const slipResult = calculateAnchorageSlipLoss(anchorage_slip, Es, span, frictionPerM);
    anchorageSlip = slipResult.loss;
    steps.push(slipResult.step);
  }
  
  // Immediate losses
  const immediate_loss = elastic.loss + friction + anchorageSlip;
  
  // Stress after immediate losses
  const fp_after_immediate = fpi - immediate_loss;
  
  // 4. Relaxation
  const relaxation = calculateRelaxationLoss(fp_after_immediate, fpu, 'low', 1000000);
  steps.push(relaxation.step);
  
  // 5. Shrinkage
  const shrinkage = calculateShrinkageLoss(Es, humidity, age_at_transfer, age_at_service, Ac, perimeter);
  steps.push(shrinkage.step);
  
  // 6. Creep
  const fc_avg = fp_after_immediate * Ap * (1 + eccentricity * eccentricity * Ac / Ic) / Ac / 1000;
  const creep = calculateCreepLoss(fci, fc_avg, Es, Ec, humidity, age_at_transfer, age_at_service);
  steps.push(creep.step);
  
  // Time-dependent losses
  const time_dependent_loss = relaxation.loss + shrinkage.loss + creep.loss;
  
  // Total losses
  const total_loss = immediate_loss + time_dependent_loss;
  const loss_percentage = (total_loss / fpi) * 100;
  
  // Effective prestress
  const fpe = fpi - total_loss;
  const Pe = fpe * Ap / 1000;
  
  // Summary step
  steps.push(createCalculationStep(
    'Prestress Loss Summary',
    'Total losses and effective prestress',
    `f_{pe} = f_{pi} - \\Delta f_p = ${fpi} - ${roundTo(total_loss, 2)} = ${roundTo(fpe, 2)} \\text{ MPa}`,
    {
      'Elastic shortening': `${roundTo(elastic.loss, 2)} MPa`,
      'Friction': `${roundTo(friction, 2)} MPa`,
      'Anchorage slip': `${roundTo(anchorageSlip, 2)} MPa`,
      'Immediate losses': `${roundTo(immediate_loss, 2)} MPa`,
      'Relaxation': `${roundTo(relaxation.loss, 2)} MPa`,
      'Shrinkage': `${roundTo(shrinkage.loss, 2)} MPa`,
      'Creep': `${roundTo(creep.loss, 2)} MPa`,
      'Time-dependent losses': `${roundTo(time_dependent_loss, 2)} MPa`,
      'Total loss': `${roundTo(total_loss, 2)} MPa (${roundTo(loss_percentage, 1)}%)`,
      'Effective prestress (fpe)': `${roundTo(fpe, 2)} MPa`,
      'Effective force (Pe)': `${roundTo(Pe, 2)} kN`,
    },
    'IS 1343 Cl. 18.5'
  ));
  
  return {
    elastic_shortening: elastic.loss,
    friction,
    anchorage_slip: anchorageSlip,
    relaxation: relaxation.loss,
    shrinkage: shrinkage.loss,
    creep: creep.loss,
    immediate_loss,
    time_dependent_loss,
    total_loss,
    loss_percentage,
    fpe,
    Pe,
    steps,
  };
}

// ============================================================================
// FLEXURAL DESIGN - CLAUSE 23
// ============================================================================

export interface PrestressedBeamInput {
  // Geometry
  width: number;          // mm - b
  depth: number;          // mm - D
  flange_width?: number;  // mm - bf (for T/I sections)
  flange_depth?: number;  // mm - Df
  
  // Material
  fck: number;            // MPa
  fpu: number;            // MPa - Ultimate strength of strand
  fp0_1k: number;         // MPa - 0.1% proof stress
  Es: number;             // MPa
  
  // Prestress
  Ap: number;             // mm² - Area of prestressing steel
  dp: number;             // mm - Depth to prestressing steel
  fpe: number;            // MPa - Effective prestress after losses
  
  // Non-prestressed steel (if any)
  As?: number;            // mm² - Non-prestressed tension steel
  As_comp?: number;       // mm² - Compression steel
  ds?: number;            // mm - Depth to non-prestressed steel
  fy?: number;            // MPa - Yield strength of non-prestressed steel
  
  // Applied moment
  Mu: number;             // kN·m - Ultimate design moment
}

export interface PrestressedBeamResult {
  isAdequate: boolean;
  status: string;
  
  // Capacities
  Mn: number;             // kN·m - Nominal moment capacity
  phi_Mn: number;         // kN·m - Design moment capacity
  utilization: number;    // Mu / phi_Mn
  
  // Neutral axis
  c: number;              // mm - Depth to neutral axis
  a: number;              // mm - Depth of equivalent stress block
  
  // Steel stress at ultimate
  fps: number;            // MPa - Stress in prestressing steel at ultimate
  
  // Ductility check
  c_dp_ratio: number;     // c/dp ratio
  ductility_ok: boolean;
  
  steps: CalculationStep[];
}

/**
 * Calculate stress in prestressing steel at ultimate
 * Clause 23.1.2 - Using strain compatibility
 */
export function calculateFpsAtUltimate(
  fpu: number,
  fpe: number,
  dp: number,
  c: number,
  bondedOrUnbonded: 'bonded' | 'unbonded'
): number {
  if (bondedOrUnbonded === 'bonded') {
    // For bonded tendons - strain compatibility
    const eps_pe = fpe / 195000; // Initial strain
    const eps_cu = 0.0035;       // Concrete ultimate strain
    const eps_ps = eps_pe + eps_cu * (dp - c) / c;
    
    // Stress-strain for low relaxation strand
    const fps = Math.min(
      fpu * (1 - 0.04 / (eps_ps / 0.007)),
      fpu
    );
    return roundTo(Math.max(fps, fpe), 2);
  } else {
    // For unbonded tendons (simplified per IS 1343)
    return roundTo(Math.min(fpe + 70, fpu), 2);
  }
}

/**
 * Design prestressed beam for flexure
 * Per IS 1343 Clause 23
 */
export function designPrestressedBeamIS1343(
  input: PrestressedBeamInput
): PrestressedBeamResult {
  const steps: CalculationStep[] = [];
  const {
    width, depth, flange_width, flange_depth,
    fck, fpu, fp0_1k, Es,
    Ap, dp, fpe,
    As, As_comp, ds, fy,
    Mu
  } = input;
  
  const b = flange_width || width;
  const Df = flange_depth || 0;
  const effective_b = b; // Simplified
  
  steps.push(createCalculationStep(
    'Section Properties',
    'Define cross-section geometry',
    '',
    {
      'Width (b)': `${width} mm`,
      'Depth (D)': `${depth} mm`,
      'Effective depth (dp)': `${dp} mm`,
      'Concrete grade': `M${fck}`,
      'Prestressing steel area (Ap)': `${Ap} mm²`,
      'Effective prestress (fpe)': `${fpe} MPa`,
    },
    'IS 1343'
  ));
  
  // Initial estimate of neutral axis using approximate fps
  let fps = Math.min(fpe + 400, 0.9 * fpu);
  let c = (Ap * fps) / (0.36 * fck * effective_b);
  
  // Iterate to find actual c and fps
  for (let i = 0; i < 10; i++) {
    fps = calculateFpsAtUltimate(fpu, fpe, dp, c, 'bonded');
    const T = Ap * fps + (As || 0) * (fy || 0);
    const C = 0.36 * fck * effective_b * c;
    
    if (Math.abs(T - C) < 100) break;
    
    c = T / (0.36 * fck * effective_b);
  }
  
  steps.push(createCalculationStep(
    'Steel Stress at Ultimate',
    `Per IS 1343 Clause 23.1.2 - Strain compatibility for bonded tendons`,
    `f_{ps} = f_{pu} \\times \\left(1 - \\frac{0.04}{\\epsilon_{ps}/0.007}\\right) = ${roundTo(fps, 2)} \\text{ MPa}`,
    {
      'Effective prestress (fpe)': `${fpe} MPa`,
      'Ultimate strength (fpu)': `${fpu} MPa`,
      'Stress at ultimate (fps)': `${roundTo(fps, 2)} MPa`,
      'Neutral axis depth (c)': `${roundTo(c, 1)} mm`,
    },
    'IS 1343 Cl. 23.1.2'
  ));
  
  // Equivalent stress block depth
  const a = 0.42 * c * 2; // IS 456 stress block: a = 0.42 × 2xu = 0.84c
  
  // Check if neutral axis is within flange (for T-section)
  let Mn: number;
  if (Df > 0 && c <= Df) {
    // Neutral axis within flange - rectangular behavior
    Mn = Ap * fps * (dp - a / 2) / 1e6;
  } else if (Df > 0 && c > Df) {
    // Neutral axis below flange - T-section behavior
    const Cf = 0.45 * fck * (b - width) * Df;
    const Cw = 0.36 * fck * width * c;
    Mn = (Cw * (dp - 0.42 * c) + Cf * (dp - Df / 2)) / 1e6;
  } else {
    // Rectangular section
    Mn = Ap * fps * (dp - 0.42 * c) / 1e6;
  }
  
  // Add non-prestressed steel contribution if present
  if (As && ds && fy) {
    Mn += As * fy * (ds - 0.42 * c) / 1e6;
  }
  
  // Capacity reduction factor
  const phi = 0.9; // For flexure
  const phi_Mn = phi * Mn;
  
  steps.push(createCalculationStep(
    'Moment Capacity Calculation',
    `Per IS 1343 Clause 23.1:
    Mu = Ap × fps × (dp - 0.42c) for rectangular section`,
    `M_n = ${Ap} \\times ${roundTo(fps, 2)} \\times (${dp} - 0.42 \\times ${roundTo(c, 1)}) / 10^6 = ${roundTo(Mn, 2)} \\text{ kN·m}`,
    {
      'Neutral axis (c)': `${roundTo(c, 1)} mm`,
      'Stress block depth (a)': `${roundTo(a, 1)} mm`,
      'Lever arm': `${roundTo(dp - 0.42 * c, 1)} mm`,
      'Nominal capacity (Mn)': `${roundTo(Mn, 2)} kN·m`,
      'Design capacity (φMn)': `${roundTo(phi_Mn, 2)} kN·m`,
    },
    'IS 1343 Cl. 23.1'
  ));
  
  // Ductility check (c/dp ratio)
  const c_dp_ratio = c / dp;
  const ductility_limit = 0.4; // Approximate limit for ductile failure
  const ductility_ok = c_dp_ratio <= ductility_limit;
  
  steps.push(createCalculationStep(
    'Ductility Check',
    `Per IS 1343: Ensure ductile failure by limiting c/dp ratio
    For ductile failure: c/dp ≤ 0.4 (approximately)`,
    `\\frac{c}{d_p} = \\frac{${roundTo(c, 1)}}{${dp}} = ${roundTo(c_dp_ratio, 3)}`,
    {
      'c/dp ratio': roundTo(c_dp_ratio, 3),
      'Limit': ductility_limit,
      'Status': ductility_ok ? 'DUCTILE ✓' : 'OVER-REINFORCED ✗',
    },
    'IS 1343'
  ));
  
  // Utilization
  const utilization = Mu / phi_Mn;
  const isAdequate = utilization <= 1.0 && ductility_ok;
  
  steps.push(createCalculationStep(
    'Flexural Design Summary',
    'Check if section is adequate for applied moment',
    `\\text{Utilization} = \\frac{M_u}{\\phi M_n} = \\frac{${Mu}}{${roundTo(phi_Mn, 2)}} = ${roundTo(utilization, 3)}`,
    {
      'Applied moment (Mu)': `${Mu} kN·m`,
      'Design capacity (φMn)': `${roundTo(phi_Mn, 2)} kN·m`,
      'Utilization ratio': `${roundTo(utilization * 100, 1)}%`,
      'Ductility': ductility_ok ? 'OK' : 'NOT OK',
      'Status': isAdequate ? 'ADEQUATE ✓' : 'INADEQUATE ✗',
    },
    'IS 1343 Cl. 23'
  ));
  
  return {
    isAdequate,
    status: isAdequate ? 'Section is adequate for flexure' : 'Section is inadequate - increase prestress or section',
    Mn: roundTo(Mn, 2),
    phi_Mn: roundTo(phi_Mn, 2),
    utilization: roundTo(utilization, 3),
    c: roundTo(c, 1),
    a: roundTo(a, 1),
    fps: roundTo(fps, 2),
    c_dp_ratio: roundTo(c_dp_ratio, 3),
    ductility_ok,
    steps,
  };
}

// ============================================================================
// SHEAR DESIGN - CLAUSE 23.4
// ============================================================================

export interface PrestressedShearInput {
  // Geometry
  bw: number;             // mm - Web width
  d: number;              // mm - Effective depth
  
  // Material
  fck: number;            // MPa
  fy_stirrup: number;     // MPa - Stirrup yield strength
  
  // Prestress
  fpe: number;            // MPa - Effective prestress
  Aps: number;            // mm² - Prestressing steel area
  
  // Forces at section
  Vu: number;             // kN - Ultimate shear force
  Mu: number;             // kN·m - Ultimate moment at section
  
  // Section properties
  I: number;              // mm⁴ - Moment of inertia
  y_b: number;            // mm - Distance to extreme tension fiber
  Ac: number;             // mm² - Cross-section area
}

/**
 * Calculate shear capacity of prestressed section
 * Per IS 1343 Clause 23.4
 */
export function calculatePrestressedShearCapacity(
  input: PrestressedShearInput
): { Vcw: number; Vci: number; Vc: number; steps: CalculationStep[] } {
  const steps: CalculationStep[] = [];
  const { bw, d, fck, fpe, Aps, Vu, Mu, I, y_b, Ac } = input;
  
  // Prestress at centroidal axis
  const fcp = fpe * Aps / Ac;
  
  // Principal tensile stress at Vcw (web-shear cracking)
  // Vcw = 0.67 × bw × d × √(ft² + 0.8 × fcp × ft)
  const ft = 0.24 * Math.sqrt(fck); // Tensile strength
  const Vcw = 0.67 * bw * d * Math.sqrt(ft * ft + 0.8 * fcp * ft) / 1000;
  
  steps.push(createCalculationStep(
    'Web-Shear Cracking Capacity (Vcw)',
    `Per IS 1343 Clause 23.4.2:
    Vcw = 0.67 × bw × d × √(ft² + 0.8 × fcp × ft)`,
    `V_{cw} = 0.67 \\times ${bw} \\times ${d} \\times \\sqrt{${roundTo(ft, 3)}^2 + 0.8 \\times ${roundTo(fcp, 2)} \\times ${roundTo(ft, 3)}} / 1000 = ${roundTo(Vcw, 2)} \\text{ kN}`,
    {
      'Web width (bw)': `${bw} mm`,
      'Effective depth (d)': `${d} mm`,
      'Tensile strength (ft)': `${roundTo(ft, 3)} MPa`,
      'Prestress at centroid (fcp)': `${roundTo(fcp, 2)} MPa`,
      'Vcw': `${roundTo(Vcw, 2)} kN`,
    },
    'IS 1343 Cl. 23.4.2'
  ));
  
  // Flexure-shear cracking (Vci)
  // Vci = 0.05 × √fck × bw × d + Mcr × V / M
  const Mcr = I * (0.7 * Math.sqrt(fck) + fcp) / y_b / 1e6; // Cracking moment
  const Vci = 0.05 * Math.sqrt(fck) * bw * d / 1000 + Mcr * Vu / Mu;
  
  steps.push(createCalculationStep(
    'Flexure-Shear Cracking Capacity (Vci)',
    `Per IS 1343 Clause 23.4.3:
    Vci = 0.05 × √fck × bw × d + Mcr × Vu / Mu`,
    `V_{ci} = 0.05 \\times \\sqrt{${fck}} \\times ${bw} \\times ${d} / 1000 + ${roundTo(Mcr, 2)} \\times ${Vu} / ${Mu} = ${roundTo(Vci, 2)} \\text{ kN}`,
    {
      'Cracking moment (Mcr)': `${roundTo(Mcr, 2)} kN·m`,
      'Vci': `${roundTo(Vci, 2)} kN`,
    },
    'IS 1343 Cl. 23.4.3'
  ));
  
  // Concrete shear capacity is minimum of Vcw and Vci
  const Vc = Math.min(Vcw, Vci);
  
  steps.push(createCalculationStep(
    'Design Shear Capacity (Vc)',
    'Concrete contribution is minimum of web-shear and flexure-shear',
    `V_c = \\min(V_{cw}, V_{ci}) = \\min(${roundTo(Vcw, 2)}, ${roundTo(Vci, 2)}) = ${roundTo(Vc, 2)} \\text{ kN}`,
    {
      'Vcw': `${roundTo(Vcw, 2)} kN`,
      'Vci': `${roundTo(Vci, 2)} kN`,
      'Vc (governing)': `${roundTo(Vc, 2)} kN`,
      'Governing mode': Vcw < Vci ? 'Web-shear' : 'Flexure-shear',
    },
    'IS 1343 Cl. 23.4'
  ));
  
  return {
    Vcw: roundTo(Vcw, 2),
    Vci: roundTo(Vci, 2),
    Vc: roundTo(Vc, 2),
    steps,
  };
}

// ============================================================================
// TRANSMISSION LENGTH - CLAUSE 19.5
// ============================================================================

/**
 * Calculate transmission length for pretensioned members
 * Clause 19.5.2
 */
export function calculateTransmissionLength(
  db: number,           // mm - Nominal diameter of tendon
  fpi: number,          // MPa - Initial prestress
  fck: number,          // MPa - Concrete strength at transfer
  surfaceCondition: 'plain_wire' | 'crimped_wire' | 'strand'
): { Lt: number; step: CalculationStep } {
  // Transmission length per IS 1343 Clause 19.5.2
  let kt: number;
  switch (surfaceCondition) {
    case 'plain_wire':
      kt = 100;
      break;
    case 'crimped_wire':
      kt = 60;
      break;
    case 'strand':
      kt = 40;
      break;
  }
  
  // Lt = kt × db × (fpi / fck)^0.5
  const Lt = kt * db * Math.sqrt(fpi / fck);
  
  const step = createCalculationStep(
    'Transmission Length',
    `Per IS 1343 Clause 19.5.2:
    Lt = kt × db × √(fpi/fck)
    where kt depends on surface condition`,
    `L_t = ${kt} \\times ${db} \\times \\sqrt{\\frac{${fpi}}{${fck}}} = ${roundTo(Lt, 0)} \\text{ mm}`,
    {
      'Tendon diameter (db)': `${db} mm`,
      'Initial prestress (fpi)': `${fpi} MPa`,
      'Concrete strength (fck)': `${fck} MPa`,
      'Surface condition': surfaceCondition,
      'Coefficient (kt)': kt,
      'Transmission length (Lt)': `${roundTo(Lt, 0)} mm`,
    },
    'IS 1343 Cl. 19.5.2'
  );
  
  return { Lt: roundTo(Lt, 0), step };
}

// ============================================================================
// EXPORT QUICK REFERENCE
// ============================================================================

export const IS1343_QUICK_REFERENCE = {
  permissible_stresses: {
    compression_transfer: '0.54 fci',
    compression_service: '0.41 fck (prestress + DL) or 0.35 fck (all loads)',
    tension_type1: '0 (no tension)',
    tension_type2: 'min(3, 0.7√fck) MPa',
  },
  steel_limits: {
    initial_pretension: '0.80 fpu',
    initial_posttension: '0.90 fy',
    effective_max: '0.70 fpu',
  },
  losses_typical: {
    pretension: '15-25%',
    posttension: '18-30%',
    elastic_shortening: '2-6%',
    friction: '5-10%',
    anchorage_slip: '1-3%',
    relaxation: '2-4%',
    shrinkage: '3-6%',
    creep: '4-8%',
  },
  strand_properties: {
    '12.7mm_strand': { area: 98.7, fpu: 1860 },
    '15.2mm_strand': { area: 140, fpu: 1860 },
    Es: 195000,
  },
};