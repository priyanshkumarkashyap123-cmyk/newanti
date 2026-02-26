/**
 * ============================================================================
 * CONCRETE DESIGN EXTENSIONS - PHASE 1 ENHANCEMENTS
 * ============================================================================
 * 
 * Adds missing RC design features per IS 456:
 * - Shear design (with/without stirrups)
 * - Punching shear
 * - Deflection (short-term + creep)
 * - Crack width
 * - Development length / anchorage
 * - Cover requirements
 * 
 * @version 1.0.0
 */

// ============================================================================
// SHEAR DESIGN
// ============================================================================

export interface ShearDesignResult {
  tauV: number;              // Nominal shear stress (MPa)
  tauC: number;              // Design shear strength of concrete (MPa)
  tauCMax: number;           // Maximum shear stress allowed (MPa)
  Vuc: number;               // Shear capacity of concrete (kN)
  Vus: number;               // Shear to be carried by stirrups (kN)
  stirrups: {
    required: boolean;
    diameter: number;
    legs: number;
    spacing: number;
    Asv: number;             // Area per unit length (mm²/m)
  };
  status: 'PASS' | 'FAIL';
  clause: string;
}

/**
 * IS 456 Table 19 - Design shear strength of concrete
 */
function getTauC(fck: number, pt: number): number {
  // pt = 100 * Ast / (b * d)
  const pts = [0.15, 0.25, 0.50, 0.75, 1.00, 1.25, 1.50, 1.75, 2.00, 2.25, 2.50, 2.75, 3.00];
  const tauC_M20: number[] = [0.28, 0.36, 0.48, 0.56, 0.62, 0.67, 0.72, 0.75, 0.79, 0.81, 0.82, 0.82, 0.82];
  
  // Interpolate and adjust for concrete grade
  const gradeMultiplier = Math.pow(fck / 20, 0.5);
  
  // Find interpolation bounds
  let i = 0;
  while (i < pts.length - 1 && pts[i + 1] < pt) i++;
  
  const ptLow = pts[Math.max(0, i)];
  const ptHigh = pts[Math.min(pts.length - 1, i + 1)];
  const tauLow = tauC_M20[Math.max(0, i)];
  const tauHigh = tauC_M20[Math.min(tauC_M20.length - 1, i + 1)];
  
  const tauC = tauLow + (tauHigh - tauLow) * (pt - ptLow) / (ptHigh - ptLow || 1);
  
  return Math.min(tauC * gradeMultiplier, 1.0);
}

export function designShearIS456(
  section: { b: number; d: number; Ast: number },
  Vu: number,              // kN
  material: { fck: number; fy: number },
  code: 'IS456' | 'ACI318' = 'IS456'
): ShearDesignResult {
  const { b, d, Ast } = section;
  const { fck, fy } = material;

  // Nominal shear stress
  const tauV = (Vu * 1000) / (b * d);

  // Steel percentage
  const pt = (100 * Ast) / (b * d);

  // Design shear strength of concrete
  const tauC = getTauC(fck, pt);

  // Maximum shear stress (IS 456 Cl. 40.2.3)
  const tauCMax = 0.63 * Math.sqrt(fck);

  // Shear capacity of concrete
  const Vuc = tauC * b * d / 1000; // kN

  // Shear to be resisted by stirrups
  const Vus = Math.max(0, Vu - Vuc);

  // Stirrup design
  const stirrupDia = 8;
  const legs = 2;
  const Asv1 = legs * Math.PI * stirrupDia * stirrupDia / 4;

  // Spacing (IS 456 Cl. 40.4)
  let spacing: number;
  if (Vus > 0) {
    spacing = (0.87 * fy * Asv1 * d) / (Vus * 1000);
  } else {
    // Minimum stirrups
    spacing = (0.87 * fy * Asv1) / (0.4 * b);
  }

  // Limits
  const maxSpacing = Math.min(0.75 * d, 300);
  spacing = Math.min(spacing, maxSpacing);
  spacing = Math.floor(spacing / 25) * 25; // Round to 25mm

  // Check if section is adequate
  const status = tauV <= tauCMax ? 'PASS' : 'FAIL';

  return {
    tauV: Math.round(tauV * 1000) / 1000,
    tauC: Math.round(tauC * 1000) / 1000,
    tauCMax: Math.round(tauCMax * 1000) / 1000,
    Vuc: Math.round(Vuc * 100) / 100,
    Vus: Math.round(Vus * 100) / 100,
    stirrups: {
      required: Vus > 0 || true, // Always provide minimum
      diameter: stirrupDia,
      legs,
      spacing: Math.max(spacing, 75),
      Asv: Math.round((Asv1 * 1000 / spacing) * 10) / 10,
    },
    status,
    clause: 'IS 456:2000 Cl. 40.1-40.4',
  };
}

// ============================================================================
// PUNCHING SHEAR
// ============================================================================

export interface PunchingShearResult {
  tauV: number;              // Punching shear stress (MPa)
  tauC: number;              // Allowable punching stress (MPa)
  criticalPerimeter: number; // mm
  ratio: number;
  status: 'PASS' | 'FAIL';
  clause: string;
}

export function checkPunchingShear(
  column: { a: number; b: number },  // Column dimensions (mm)
  slab: { d: number; fck: number },  // Effective depth and concrete grade
  Vu: number,                        // Ultimate punching force (kN)
  code: 'IS456' | 'ACI318' = 'IS456'
): PunchingShearResult {
  const { a, b } = column;
  const { d, fck } = slab;

  // Critical perimeter at d/2 from column face
  const b0 = 2 * (a + d) + 2 * (b + d);

  // Punching shear stress
  const tauV = (Vu * 1000) / (b0 * d);

  // Allowable punching stress (IS 456 Cl. 31.6.3)
  // τc = ks * 0.25 * sqrt(fck)
  const betaC = Math.max(a, b) / Math.min(a, b);
  const ks = Math.min(0.5 + betaC, 1.0);
  const tauC = ks * 0.25 * Math.sqrt(fck);

  const ratio = tauV / tauC;

  return {
    tauV: Math.round(tauV * 1000) / 1000,
    tauC: Math.round(tauC * 1000) / 1000,
    criticalPerimeter: b0,
    ratio: Math.round(ratio * 1000) / 1000,
    status: ratio <= 1.0 ? 'PASS' : 'FAIL',
    clause: 'IS 456:2000 Cl. 31.6.3',
  };
}

// ============================================================================
// DEFLECTION CHECK
// ============================================================================

export interface DeflectionResult {
  calculatedDeflection: number;  // mm
  allowableDeflection: number;   // mm
  spanDepthRatio: number;
  allowableSpanDepth: number;
  creepMultiplier: number;
  ratio: number;
  status: 'PASS' | 'FAIL';
  clause: string;
}

export function checkDeflection(
  beam: {
    L: number;            // Span (mm)
    b: number;            // Width (mm)
    d: number;            // Effective depth (mm)
    D: number;            // Total depth (mm)
    Ast: number;          // Tension steel (mm²)
    Asc?: number;         // Compression steel (mm²)
  },
  loads: {
    deadLoad: number;     // kN/m
    liveLoad: number;     // kN/m
    sustainedRatio?: number; // Fraction of live load sustained (default 0.25)
  },
  material: { fck: number; fy: number; Ec?: number },
  beamType: 'simply_supported' | 'continuous' | 'cantilever' = 'simply_supported',
  code: 'IS456' | 'ACI318' = 'IS456'
): DeflectionResult {
  const { L, b, d, D, Ast, Asc = 0 } = beam;
  const { fck, fy, Ec = 5000 * Math.sqrt(fck) } = material;
  const sustainedRatio = loads.sustainedRatio ?? 0.25;

  // Basic span/depth ratio (IS 456 Cl. 23.2.1)
  let basicRatio: number;
  switch (beamType) {
    case 'cantilever': basicRatio = 7; break;
    case 'continuous': basicRatio = 26; break;
    default: basicRatio = 20;
  }

  // Modification factors
  // Steel stress factor (fs)
  const fs = 0.58 * fy * (Ast / (b * d)) / 0.01; // Simplified
  const f1 = Math.min(2.0, Math.max(1.0, 1.4 - fs / 1000));

  // Compression steel factor (IS 456 Fig. 4)
  const pc = (100 * Asc) / (b * d);
  const f2 = pc > 0 ? Math.min(1.6, 1 + pc / 3) : 1.0;

  // Allowable L/d
  const allowableSpanDepth = basicRatio * f1 * f2;
  const actualSpanDepth = L / d;

  // Simplified deflection calculation using span/d check
  // Immediate deflection (elastic)
  const Ie = (b * Math.pow(D, 3)) / 12; // Gross moment of inertia (simplified)
  const w = loads.deadLoad + loads.liveLoad; // kN/m
  let delta_i: number;
  switch (beamType) {
    case 'cantilever':
      delta_i = (w * Math.pow(L, 4)) / (8 * Ec * Ie) * 1e9;
      break;
    case 'continuous':
      delta_i = (w * Math.pow(L, 4)) / (384 * Ec * Ie) * 1e9;
      break;
    default:
      delta_i = (5 * w * Math.pow(L, 4)) / (384 * Ec * Ie) * 1e9;
  }

  // Long-term multiplier (IS 456 Cl. 23.2.1, ACI 318 Eq. 24.2.4.1.1)
  const rhoP = Asc / (b * d);
  const xi = 2.0; // Time-dependent factor at 5+ years
  const lambda = xi / (1 + 50 * rhoP);
  const creepMultiplier = 1 + lambda * sustainedRatio;

  // Total deflection
  const totalDeflection = delta_i * creepMultiplier;

  // Allowable deflection (L/250 for total, L/350 for live load)
  const allowableDeflection = L / 250;

  const ratio = totalDeflection / allowableDeflection;

  return {
    calculatedDeflection: Math.round(totalDeflection * 100) / 100,
    allowableDeflection: Math.round(allowableDeflection * 100) / 100,
    spanDepthRatio: Math.round(actualSpanDepth * 10) / 10,
    allowableSpanDepth: Math.round(allowableSpanDepth * 10) / 10,
    creepMultiplier: Math.round(creepMultiplier * 100) / 100,
    ratio: Math.round(ratio * 1000) / 1000,
    status: ratio <= 1.0 && actualSpanDepth <= allowableSpanDepth ? 'PASS' : 'FAIL',
    clause: 'IS 456:2000 Cl. 23.2',
  };
}

// ============================================================================
// CRACK WIDTH
// ============================================================================

export interface CrackWidthResult {
  calculatedWidth: number;   // mm
  allowableWidth: number;    // mm
  acr: number;               // Distance from crack to nearest bar surface
  epsilon_m: number;         // Average strain
  status: 'PASS' | 'FAIL';
  clause: string;
}

export function calculateCrackWidth(
  section: { b: number; d: number; D: number; cover: number },
  reinforcement: { diameter: number; spacing: number; Ast: number },
  moment: number,            // Service moment (kNm)
  material: { fck: number; fy: number; Es?: number },
  exposureClass: 'mild' | 'moderate' | 'severe' | 'very_severe' | 'extreme' = 'moderate',
  code: 'IS456' | 'EN1992' = 'IS456'
): CrackWidthResult {
  const { b, d, D, cover } = section;
  const { diameter, spacing, Ast } = reinforcement;
  const { fck, fy, Es = 200000 } = material;
  const Ec = 5000 * Math.sqrt(fck);
  const m = Es / Ec;

  // Allowable crack width based on exposure
  const allowableWidths: Record<string, number> = {
    mild: 0.3,
    moderate: 0.3,
    severe: 0.2,
    very_severe: 0.1,
    extreme: 0.1,
  };
  const allowableWidth = allowableWidths[exposureClass];

  // Neutral axis depth (cracked section)
  const pt = Ast / (b * d);
  const x = d * (Math.sqrt(2 * m * pt + Math.pow(m * pt, 2)) - m * pt);

  // Steel stress under service load
  const z = d - x / 3;
  const fs = (moment * 1e6) / (Ast * z);

  // Average strain (IS 456 Annex F)
  const epsilon_1 = fs / Es;
  const bt = 0.5; // For short-term loading
  const epsilon_m = epsilon_1 - (bt * b * (D - x) * (d - x)) / (3 * Es * Ast * (d - x));

  // Distance from crack to bar surface
  const acr = Math.sqrt(Math.pow(spacing / 2, 2) + Math.pow(cover + diameter / 2, 2)) - diameter / 2;

  // Crack width (IS 456 Annex F, Eq. 11)
  const Cmin = cover;
  const wk = (3 * acr * epsilon_m) / (1 + 2 * (acr - Cmin) / (D - x));

  return {
    calculatedWidth: Math.round(wk * 1000) / 1000,
    allowableWidth,
    acr: Math.round(acr * 10) / 10,
    epsilon_m: Math.round(epsilon_m * 1e6) / 1e6,
    status: wk <= allowableWidth ? 'PASS' : 'FAIL',
    clause: 'IS 456:2000 Annex F',
  };
}

// ============================================================================
// DEVELOPMENT LENGTH
// ============================================================================

export interface DevelopmentLengthResult {
  Ld: number;                // Required development length (mm)
  Ld_provided: number;       // Available length (mm)
  tau_bd: number;            // Bond stress (MPa)
  status: 'PASS' | 'FAIL';
  clause: string;
}

export function calculateDevelopmentLength(
  bar: { diameter: number; type: 'deformed' | 'plain' },
  material: { fck: number; fy: number },
  availableLength: number,
  inTension: boolean = true,
  code: 'IS456' | 'ACI318' = 'IS456'
): DevelopmentLengthResult {
  const { diameter, type } = bar;
  const { fck, fy } = material;

  // Bond stress (IS 456 Cl. 26.2.1.1)
  // τbd for deformed bars = 1.6 * τbd for plain bars
  // τbd increases with concrete grade
  const baseBond = 1.2 + 0.025 * fck; // Approximate for M20+
  const tau_bd = type === 'deformed' ? 1.6 * baseBond : baseBond;

  // Development length (IS 456 Cl. 26.2.1)
  // Ld = φ * σs / (4 * τbd)
  const sigma_s = 0.87 * fy; // For tension
  const Ld = (diameter * sigma_s) / (4 * tau_bd);

  // Compression modification
  const Ld_final = inTension ? Ld : 0.8 * Ld;

  return {
    Ld: Math.round(Ld_final),
    Ld_provided: availableLength,
    tau_bd: Math.round(tau_bd * 100) / 100,
    status: availableLength >= Ld_final ? 'PASS' : 'FAIL',
    clause: 'IS 456:2000 Cl. 26.2.1',
  };
}

// ============================================================================
// COVER REQUIREMENTS
// ============================================================================

export interface CoverResult {
  minCover: number;          // mm
  nominalCover: number;      // mm (min + tolerance)
  durabilityRequirement: number;
  fireRequirement: number;
  barSizeRequirement: number;
  clause: string;
}

export function getCoverRequirements(
  exposureClass: 'mild' | 'moderate' | 'severe' | 'very_severe' | 'extreme',
  memberType: 'beam' | 'column' | 'slab' | 'footing',
  mainBarDia: number,
  concreteGrade: number,
  fireRating: 0 | 0.5 | 1 | 1.5 | 2 | 3 | 4 = 1,  // hours
  code: 'IS456' | 'EN1992' = 'IS456'
): CoverResult {
  // Durability cover (IS 456 Table 16)
  const durabilityCovers: Record<string, number> = {
    mild: 20,
    moderate: 30,
    severe: 45,
    very_severe: 50,
    extreme: 75,
  };

  // Fire cover (IS 456 Table 16A - simplified)
  const fireCovers: Record<number, number> = {
    0: 20,
    0.5: 20,
    1: 20,
    1.5: 25,
    2: 35,
    3: 45,
    4: 55,
  };

  const durabilityRequirement = durabilityCovers[exposureClass];
  const fireRequirement = fireCovers[fireRating] || 20;
  const barSizeRequirement = mainBarDia;

  // Minimum cover is max of all requirements
  const minCover = Math.max(durabilityRequirement, fireRequirement, barSizeRequirement);

  // Nominal cover = min cover + tolerance (5-10mm typically)
  const tolerance = minCover >= 75 ? 10 : 5;
  const nominalCover = minCover + tolerance;

  return {
    minCover,
    nominalCover,
    durabilityRequirement,
    fireRequirement,
    barSizeRequirement,
    clause: 'IS 456:2000 Cl. 26.4, Table 16, Table 16A',
  };
}
