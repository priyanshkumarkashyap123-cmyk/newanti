/**
 * Structural Design Checks per Indian Standards
 *
 * Implements Limit State Design (LSD) checks for:
 *   - IS 456:2000 — Reinforced Concrete Structures
 *   - IS 800:2007 — General Construction in Steel (LSM)
 *
 * Phase 2 of the Structural Engine: Code Compliance
 *
 * Each check function returns a DesignCheckResult indicating:
 *   - pass/fail status
 *   - utilization ratio (demand/capacity)
 *   - detailed calculation breakdown
 *   - code clause reference
 *
 * @module design-checks
 */

// ============================================
// TYPES
// ============================================

/** Result of a single design check */
export interface DesignCheckResult {
  /** Check identifier */
  checkName: string;
  /** Code clause reference (e.g., "IS 456 Cl. 38.1") */
  codeRef: string;
  /** true if utilization ≤ 1.0 */
  pass: boolean;
  /** Demand-to-capacity ratio (< 1.0 = safe) */
  utilization: number;
  /** Demand value (factored force/moment) */
  demand: number;
  /** Capacity value */
  capacity: number;
  /** Unit for demand/capacity */
  unit: string;
  /** Detailed calculation breakdown */
  details: string;
  /** Warning messages (e.g., minimum reinforcement governs) */
  warnings?: string[];
}

/** Section properties for concrete members */
export interface ConcreteSectionProps {
  b: number;      // Width (mm)
  d: number;      // Effective depth (mm)
  D: number;      // Overall depth (mm)
  fck: number;    // Characteristic concrete strength (MPa) — IS 456 Table 2
  fy: number;     // Steel yield strength (MPa) — IS 456 Cl. 38.1
  Ast: number;    // Tension reinforcement area (mm²)
  Asc?: number;   // Compression reinforcement area (mm²)
  Asv?: number;   // Shear reinforcement area per unit spacing (mm²)
  sv?: number;    // Spacing of shear stirrups (mm)
  cover?: number; // Clear cover (mm) — IS 456 Cl. 26.4
  span?: number;  // Member span (mm) — for serviceability
}

/** Section properties for steel members */
export interface SteelSectionProps {
  // Cross-section dimensions
  d: number;      // Overall depth (mm)
  bf: number;     // Flange width (mm)
  tf: number;     // Flange thickness (mm)
  tw: number;     // Web thickness (mm)
  A: number;      // Cross-section area (mm²)

  // Section moduli
  Zx: number;     // Elastic section modulus about X (mm³)
  Zy: number;     // Elastic section modulus about Y (mm³)
  Zpx: number;    // Plastic section modulus about X (mm³)
  Zpy: number;    // Plastic section modulus about Y (mm³)

  // Moments of inertia
  Ix: number;     // Second moment about X (mm⁴)
  Iy: number;     // Second moment about Y (mm⁴)

  // Radii of gyration
  rx: number;     // Radius of gyration about X (mm)
  ry: number;     // Radius of gyration about Y (mm)

  // Material
  fy: number;     // Yield strength (MPa) — IS 800 Table 2
  fu: number;     // Ultimate tensile strength (MPa)
  E: number;      // Young's modulus (MPa) — typically 200000

  // Member properties
  L: number;      // Member length (mm)
  Lx?: number;    // Effective length about X (mm) — IS 800 Table 11
  Ly?: number;    // Effective length about Y (mm)
  Lb?: number;    // Laterally unsupported length (mm) — IS 800 Cl. 8.2.2

  // Section classification
  sectionType?: 'I' | 'H' | 'channel' | 'angle' | 'tube' | 'pipe';
}

// ============================================
// IS 456:2000 — REINFORCED CONCRETE CHECKS
// ============================================

/**
 * IS 456 Cl. 38.1 — Flexure Check for Singly/Doubly Reinforced Beams
 *
 * Limit state of collapse (ULS) in flexure:
 *   Mu ≤ Mu_lim  (for singly reinforced)
 *   For Mu > Mu_lim, check as doubly reinforced
 *
 * Mu_lim = 0.36 × fck × b × xu_max × (d − 0.42 × xu_max)
 * where xu_max / d depends on fy:
 *   Fe 250: xu_max/d = 0.53
 *   Fe 415: xu_max/d = 0.48
 *   Fe 500: xu_max/d = 0.46
 *   Fe 550: xu_max/d = 0.44
 *
 * Actual moment capacity:
 *   Mu = 0.87 × fy × Ast × (d − 0.42 × xu)
 *   where xu = (0.87 × fy × Ast) / (0.36 × fck × b)
 *
 * @param Mu  Factored bending moment (kN·m)
 * @param section  Concrete section properties
 */
export function checkFlexureIS456(
  Mu: number,
  section: ConcreteSectionProps,
): DesignCheckResult {
  const { b, d, fck, fy, Ast, Asc = 0 } = section;
  const warnings: string[] = [];

  // xu_max / d ratio (IS 456 Cl. 38.1, Note)
  let xuMaxRatio: number;
  if (fy <= 250) xuMaxRatio = 0.53;
  else if (fy <= 415) xuMaxRatio = 0.48;
  else if (fy <= 500) xuMaxRatio = 0.46;
  else xuMaxRatio = 0.44;

  const xu_max = xuMaxRatio * d;

  // Limiting moment capacity (singly reinforced)
  const Mu_lim = 0.36 * fck * b * xu_max * (d - 0.42 * xu_max) / 1e6; // N·mm → kN·m

  // Actual neutral axis depth
  const xu = (0.87 * fy * Ast) / (0.36 * fck * b); // mm

  let Mu_capacity: number;

  if (xu <= xu_max) {
    // Singly reinforced — under-reinforced (ductile failure)
    Mu_capacity = 0.87 * fy * Ast * (d - 0.42 * xu) / 1e6; // kN·m
  } else {
    // Over-reinforced or doubly reinforced
    warnings.push('xu > xu_max: Section is over-reinforced. Consider adding compression steel.');

    if (Asc > 0) {
      // Doubly reinforced: Mu = Mu_lim + Mu2
      // Mu2 = (fsc - 0.447fck) × Asc × (d - d')
      // Assuming d' = cover + φ/2 ≈ 50mm
      const d_prime = section.cover ? section.cover + 10 : 50;
      const fsc = 0.87 * fy; // Conservative — stress in compression steel
      const Mu2 = (fsc - 0.447 * fck) * Asc * (d - d_prime) / 1e6;
      Mu_capacity = Mu_lim + Mu2;
    } else {
      // Limit to Mu_lim (IS 456 does not allow over-reinforced design)
      Mu_capacity = Mu_lim;
    }
  }

  // Minimum reinforcement check (IS 456 Cl. 26.5.1.1)
  const Ast_min = 0.85 * b * d / fy;
  if (Ast < Ast_min) {
    warnings.push(`Ast (${Ast.toFixed(0)} mm²) < Ast_min (${Ast_min.toFixed(0)} mm²) per IS 456 Cl. 26.5.1.1`);
  }

  // Maximum reinforcement check (IS 456 Cl. 26.5.1.2)
  const Ast_max = 0.04 * b * (section.D || d + 50);
  if (Ast > Ast_max) {
    warnings.push(`Ast (${Ast.toFixed(0)} mm²) > 4% of bD (${Ast_max.toFixed(0)} mm²)`);
  }

  const absMu = Math.abs(Mu);
  const utilization = Mu_capacity > 1e-6 ? absMu / Mu_capacity : (absMu > 0 ? Infinity : 0);

  return {
    checkName: 'Flexure (IS 456)',
    codeRef: 'IS 456 Cl. 38.1',
    pass: utilization <= 1.0,
    utilization,
    demand: absMu,
    capacity: Mu_capacity,
    unit: 'kN·m',
    details:
      `xu = ${xu.toFixed(1)} mm, xu_max = ${xu_max.toFixed(1)} mm, ` +
      `Mu_lim = ${Mu_lim.toFixed(2)} kN·m, Mu_capacity = ${Mu_capacity.toFixed(2)} kN·m, ` +
      `Mu_demand = ${absMu.toFixed(2)} kN·m`,
    warnings: warnings.length > 0 ? warnings : undefined,
  };
}

/**
 * IS 456 Cl. 40 — Shear Check for RC Beams
 *
 * Nominal shear stress: τv = Vu / (b × d)
 * Design shear strength of concrete: τc (from IS 456 Table 19)
 * Maximum shear stress: τc_max (from IS 456 Table 20)
 *
 * If τv ≤ τc: No shear reinforcement required (but provide minimum per Cl. 26.5.1.6)
 * If τc < τv ≤ τc_max: Provide shear reinforcement
 * If τv > τc_max: Redesign section (increase depth)
 *
 * @param Vu  Factored shear force (kN)
 * @param section  Concrete section properties
 */
export function checkShearIS456(
  Vu: number,
  section: ConcreteSectionProps,
): DesignCheckResult {
  const { b, d, fck, fy, Ast, Asv = 0, sv = 300 } = section;
  const warnings: string[] = [];

  const absVu = Math.abs(Vu);

  // Nominal shear stress (IS 456 Cl. 40.1)
  const tau_v = (absVu * 1000) / (b * d); // kN → N, result in MPa

  // Design shear strength of concrete τc (IS 456 Table 19)
  // Depends on pt = 100 × Ast / (b × d)
  const pt = (100 * Ast) / (b * d);

  // IS 456 Table 19 interpolation for M20-M40 concrete
  // τc for M20 (fck = 20 MPa) — scaled by (fck/20)^0.5 for other grades
  // pt:     0.15  0.25  0.50  0.75  1.00  1.25  1.50  1.75  2.00  2.25  2.50  2.75  3.00
  // τc(20): 0.28  0.36  0.48  0.56  0.62  0.67  0.72  0.75  0.79  0.81  0.82  0.82  0.82
  const ptTable = [0.15, 0.25, 0.50, 0.75, 1.00, 1.25, 1.50, 1.75, 2.00, 2.25, 2.50, 2.75, 3.00];
  const tcTable = [0.28, 0.36, 0.48, 0.56, 0.62, 0.67, 0.72, 0.75, 0.79, 0.81, 0.82, 0.82, 0.82];

  let tau_c_m20: number;
  if (pt <= 0.15) {
    tau_c_m20 = 0.28;
  } else if (pt >= 3.0) {
    tau_c_m20 = 0.82;
  } else {
    // Linear interpolation
    let i = 0;
    while (i < ptTable.length - 1 && ptTable[i + 1] < pt) i++;
    const p0 = ptTable[i], p1 = ptTable[i + 1];
    const t0 = tcTable[i], t1 = tcTable[i + 1];
    tau_c_m20 = t0 + (t1 - t0) * (pt - p0) / (p1 - p0);
  }

  // Scale for concrete grade > M20
  const tau_c = tau_c_m20 * Math.pow(fck / 20, 0.5);

  // Maximum shear stress τc_max (IS 456 Table 20)
  const tcMaxTable: Record<number, number> = {
    15: 2.5, 20: 2.8, 25: 3.1, 30: 3.5, 35: 3.7, 40: 4.0,
  };
  const fckRound = Math.min(40, Math.max(15, Math.round(fck / 5) * 5));
  const tau_c_max = tcMaxTable[fckRound] ?? 2.8;

  if (tau_v > tau_c_max) {
    warnings.push(`τv (${tau_v.toFixed(2)} MPa) > τc_max (${tau_c_max.toFixed(2)} MPa). Increase section depth.`);
  }

  // Shear capacity with stirrups: Vus = 0.87 × fy × Asv × d / sv
  let Vc = tau_c * b * d / 1000; // kN — concrete contribution
  let Vs = 0;
  if (Asv > 0 && sv > 0) {
    Vs = 0.87 * fy * Asv * d / (sv * 1000); // kN — steel contribution
  }
  let Vu_capacity = Vc + Vs;

  // Ensure capacity doesn't exceed τc_max limit
  const Vu_max = tau_c_max * b * d / 1000;
  Vu_capacity = Math.min(Vu_capacity, Vu_max);

  // Minimum shear reinforcement check (IS 456 Cl. 26.5.1.6)
  if (tau_v > tau_c && Asv > 0) {
    const Asv_min = 0.4 * b * sv / (0.87 * fy);
    if (Asv < Asv_min) {
      warnings.push(`Asv (${Asv.toFixed(0)} mm²) < minimum (${Asv_min.toFixed(0)} mm²) per Cl. 26.5.1.6`);
    }
  }

  const utilization = Vu_capacity > 1e-6 ? absVu / Vu_capacity : (absVu > 0 ? Infinity : 0);

  return {
    checkName: 'Shear (IS 456)',
    codeRef: 'IS 456 Cl. 40.1, 40.4',
    pass: utilization <= 1.0 && tau_v <= tau_c_max,
    utilization,
    demand: absVu,
    capacity: Vu_capacity,
    unit: 'kN',
    details:
      `τv = ${tau_v.toFixed(2)} MPa, τc = ${tau_c.toFixed(2)} MPa, ` +
      `τc_max = ${tau_c_max.toFixed(2)} MPa, ` +
      `Vc = ${Vc.toFixed(1)} kN, Vs = ${Vs.toFixed(1)} kN, ` +
      `Vu_capacity = ${Vu_capacity.toFixed(1)} kN`,
    warnings: warnings.length > 0 ? warnings : undefined,
  };
}

// ============================================
// IS 800:2007 — STEEL DESIGN CHECKS
// ============================================

/**
 * IS 800 Cl. 8.2 — Flexure Check for Steel Beams (Laterally Supported)
 *
 * Design bending strength:
 *   Md = βb × Zp × fy / γm0
 *
 * where:
 *   βb = 1.0 for compact sections, Ze/Zp for semi-compact
 *   γm0 = 1.10 (IS 800 Table 5)
 *   Zp = plastic section modulus
 *
 * Section classification per IS 800 Table 2:
 *   Compact:      plastic hinge can form
 *   Semi-compact: extreme fiber can yield, no plastic hinge
 *   Slender:      local buckling before yield
 *
 * @param Mu      Factored bending moment (kN·m)
 * @param section Steel section properties
 * @param axis    Bending axis ('x' = major, 'y' = minor)
 */
export function checkFlexureIS800(
  Mu: number,
  section: SteelSectionProps,
  axis: 'x' | 'y' = 'x',
): DesignCheckResult {
  const { fy, bf, tf, tw, d: depth } = section;
  const gamma_m0 = 1.10; // IS 800 Table 5
  const warnings: string[] = [];

  // Section classification (simplified — IS 800 Table 2)
  const epsilon = Math.sqrt(250 / fy);
  const bf_tf = (bf / 2) / tf; // Outstanding flange ratio (half-width)
  const dw_tw = (depth - 2 * tf) / tw; // Web depth-to-thickness

  // Flange classification
  const flangeCompact = bf_tf <= 9.4 * epsilon;
  const flangeSemiCompact = bf_tf <= 15.7 * epsilon;

  // Web classification (bending)
  const webCompact = dw_tw <= 84 * epsilon;
  const webSemiCompact = dw_tw <= 126 * epsilon;

  const isCompact = flangeCompact && webCompact;
  const isSemiCompact = flangeSemiCompact && webSemiCompact;

  if (!isSemiCompact) {
    warnings.push('Section is SLENDER — local buckling governs. Use effective section properties.');
  }

  // Design bending strength
  const Zp = axis === 'x' ? section.Zpx : section.Zpy;
  const Ze = axis === 'x' ? section.Zx : section.Zy;

  const betaB = isCompact ? 1.0 : (Ze / Zp);
  const Md = betaB * Zp * fy / (gamma_m0 * 1e6); // N·mm → kN·m

  // Check for lateral torsional buckling (IS 800 Cl. 8.2.2)
  if (section.Lb && section.Lb > 0 && axis === 'x') {
    // Critical moment Mcr — simplified approach
    const Lb = section.Lb;
    const E = section.E || 200000;
    const Iy = section.Iy;
    const G = E / (2 * 1.3); // ν = 0.3
    const It = (2 * bf * tf * tf * tf + (depth - 2 * tf) * tw * tw * tw) / 3; // Approximate

    const Mcr = Math.PI * Math.PI * E * Iy / (Lb * Lb) *
      Math.sqrt(G * It * Lb * Lb / (Math.PI * Math.PI * E * Iy) + 1);

    if (Mcr < Md * 1e6) {
      warnings.push(`LTB governs: Mcr = ${(Mcr / 1e6).toFixed(1)} kN·m < Md_section = ${Md.toFixed(1)} kN·m`);
    }
  }

  // Shear lag — IS 800, not typically critical for standard sections
  // Web crippling — checked separately

  const absMu = Math.abs(Mu);
  const utilization = Md > 1e-6 ? absMu / Md : (absMu > 0 ? Infinity : 0);

  return {
    checkName: `Flexure ${axis.toUpperCase()}-axis (IS 800)`,
    codeRef: 'IS 800 Cl. 8.2.1',
    pass: utilization <= 1.0,
    utilization,
    demand: absMu,
    capacity: Md,
    unit: 'kN·m',
    details:
      `Section: ${isCompact ? 'Compact' : isSemiCompact ? 'Semi-compact' : 'Slender'}, ` +
      `βb = ${betaB.toFixed(3)}, Zp = ${Zp.toFixed(0)} mm³, ` +
      `Md = ${Md.toFixed(2)} kN·m, Mu = ${absMu.toFixed(2)} kN·m, ` +
      `γm0 = ${gamma_m0}`,
    warnings: warnings.length > 0 ? warnings : undefined,
  };
}

/**
 * IS 800 Cl. 8.4 — Shear Check for Steel Beams
 *
 * Design shear strength (plastic/post-buckling):
 *   Vd = Av × fy / (√3 × γm0)
 *
 * where Av = shear area:
 *   I-section (major axis):  Av = d × tw (IS 800 Cl. 8.4.1.1)
 *   I-section (minor axis):  Av = 2 × bf × tf
 *
 * @param Vu      Factored shear force (kN)
 * @param section Steel section properties
 * @param axis    Shear direction ('x' = transverse to major axis)
 */
export function checkShearIS800(
  Vu: number,
  section: SteelSectionProps,
  axis: 'x' | 'y' = 'x',
): DesignCheckResult {
  const { fy, d: depth, bf, tf, tw } = section;
  const gamma_m0 = 1.10;
  const warnings: string[] = [];

  // Shear area (IS 800 Cl. 8.4.1.1)
  let Av: number;
  if (axis === 'x') {
    Av = depth * tw; // Shear in web for major-axis bending
  } else {
    Av = 2 * bf * tf; // Shear in flanges for minor-axis bending
  }

  // Design shear strength (IS 800 Cl. 8.4.1)
  const Vd = Av * fy / (Math.sqrt(3) * gamma_m0 * 1000); // N → kN

  // Check for shear buckling of web (IS 800 Cl. 8.4.2)
  const epsilon = Math.sqrt(250 / fy);
  const dw = depth - 2 * tf;
  if (dw / tw > 67 * epsilon) {
    warnings.push(`Web d/tw = ${(dw / tw).toFixed(1)} > 67ε = ${(67 * epsilon).toFixed(1)}. Check web shear buckling per Cl. 8.4.2.`);
  }

  const absVu = Math.abs(Vu);
  const utilization = Vd > 1e-6 ? absVu / Vd : (absVu > 0 ? Infinity : 0);

  // High shear check (IS 800 Cl. 9.2.2) — affects moment capacity if Vu > 0.6Vd
  if (absVu > 0.6 * Vd) {
    warnings.push(`High shear: Vu/Vd = ${utilization.toFixed(2)} > 0.6. Reduced moment capacity per Cl. 9.2.2.`);
  }

  return {
    checkName: 'Shear (IS 800)',
    codeRef: 'IS 800 Cl. 8.4.1',
    pass: utilization <= 1.0,
    utilization,
    demand: absVu,
    capacity: Vd,
    unit: 'kN',
    details:
      `Av = ${Av.toFixed(0)} mm², fy = ${fy} MPa, ` +
      `Vd = ${Vd.toFixed(1)} kN, Vu = ${absVu.toFixed(1)} kN`,
    warnings: warnings.length > 0 ? warnings : undefined,
  };
}

/**
 * IS 800 Cl. 9.3 — Axial + Flexural Interaction Check
 *
 * Combined axial force and bending moment check (beam-column).
 *
 * Unity Check (IS 800 Cl. 9.3.1.1):
 *   (N / Nd) + (Mx × Cmx / Mdx) + (My × Cmy / Mdy) ≤ 1.0
 *
 * Where:
 *   N  = factored axial force
 *   Nd = design axial capacity (Cl. 7.1.2 for tension, Cl. 7.1.2 for compression)
 *   Mx, My = factored bending moments
 *   Mdx, Mdy = design bending capacities
 *   Cmx, Cmy = equivalent uniform moment factors
 *
 * @param N   Factored axial force (kN) — positive = tension, negative = compression
 * @param Mx  Factored moment about X (kN·m) — major axis
 * @param My  Factored moment about Y (kN·m) — minor axis
 * @param section Steel section properties
 */
export function checkInteractionIS800(
  N: number,
  Mx: number,
  My: number,
  section: SteelSectionProps,
): DesignCheckResult {
  const { A, fy, E, rx, ry, Zpx, Zpy } = section;
  const gamma_m0 = 1.10;
  const gamma_m1 = 1.25; // IS 800 Table 5 — for buckling
  const warnings: string[] = [];

  const absN = Math.abs(N);
  const absMx = Math.abs(Mx);
  const absMy = Math.abs(My);

  // Design axial capacity
  let Nd: number;

  if (N >= 0) {
    // TENSION (IS 800 Cl. 6.2)
    // Tdy = A × fy / γm0
    Nd = A * fy / (gamma_m0 * 1000); // kN
  } else {
    // COMPRESSION (IS 800 Cl. 7.1.2 — Column Buckling)
    const Lx = section.Lx ?? section.L;
    const Ly = section.Ly ?? section.L;

    // Slenderness ratios
    const lambdaX = Lx / rx;
    const lambdaY = Ly / ry;
    const lambda = Math.max(lambdaX, lambdaY);

    // Non-dimensional effective slenderness (IS 800 Cl. 7.1.2.1)
    const lambdaE = Math.sqrt(fy / (Math.PI * Math.PI * E)) * lambda;

    // Imperfection factor α (IS 800 Table 7 — curve 'b' for hot-rolled I-sections)
    const alpha = 0.34; // Buckling curve 'b'

    // Design compressive stress (IS 800 Cl. 7.1.2.1)
    const phi = 0.5 * (1 + alpha * (lambdaE - 0.2) + lambdaE * lambdaE);
    const chi = 1 / (phi + Math.sqrt(phi * phi - lambdaE * lambdaE));
    const fcd = Math.min(chi, 1.0) * fy / gamma_m1;

    Nd = fcd * A / 1000; // kN

    if (lambda > 180) {
      warnings.push(`Slenderness λ = ${lambda.toFixed(0)} > 180 (IS 800 Cl. 3.8 limit).`);
    }
  }

  // Design bending capacities
  const Mdx = Zpx * fy / (gamma_m0 * 1e6); // kN·m
  const Mdy = Zpy * fy / (gamma_m0 * 1e6); // kN·m

  // Equivalent uniform moment factors (conservative: Cm = 1.0)
  // For non-sway frames with no transverse loads: Cm = 0.6 + 0.4ψ ≥ 0.4
  // Use Cm = 1.0 (conservative) unless specific end moment ratio is provided
  const Cmx = 1.0;
  const Cmy = 1.0;

  // Unity check (IS 800 Cl. 9.3.1.1, Equation 9)
  const nRatio = Nd > 1e-6 ? absN / Nd : 0;
  const mxRatio = Mdx > 1e-6 ? (absMx * Cmx) / Mdx : 0;
  const myRatio = Mdy > 1e-6 ? (absMy * Cmy) / Mdy : 0;

  const utilization = nRatio + mxRatio + myRatio;

  return {
    checkName: 'Axial-Flexural Interaction (IS 800)',
    codeRef: 'IS 800 Cl. 9.3.1.1',
    pass: utilization <= 1.0,
    utilization,
    demand: utilization, // Unity check — demand IS the ratio
    capacity: 1.0,
    unit: 'ratio',
    details:
      `N/${N >= 0 ? 'Tdy' : 'Pdy'} = ${nRatio.toFixed(3)} (${absN.toFixed(1)}/${Nd.toFixed(1)} kN), ` +
      `Mx/Mdx = ${mxRatio.toFixed(3)} (${absMx.toFixed(1)}/${Mdx.toFixed(1)} kN·m), ` +
      `My/Mdy = ${myRatio.toFixed(3)} (${absMy.toFixed(1)}/${Mdy.toFixed(1)} kN·m), ` +
      `Total = ${utilization.toFixed(3)} ≤ 1.0`,
    warnings: warnings.length > 0 ? warnings : undefined,
  };
}

// ============================================
// SERVICEABILITY — DEFLECTION CHECKS
// ============================================

/**
 * Deflection check per IS 456 / IS 800
 *
 * IS 456 Cl. 23.2: Deflection limits for RC beams
 *   - Span / 250 (final deflection including long-term)
 *   - Span / 350 (deflection after erection of partitions)
 *
 * IS 800 Cl. 5.6.1: Deflection limits for steel beams (Table 6)
 *   - Span / 300 (beams carrying plaster)
 *   - Span / 240 (beams generally)
 *   - Span / 150 (purlins, sheeting rails)
 *   - Span / 180 (gantry crane girders — vertical)
 *   - Span / 400 (gantry crane girders — lateral)
 *
 * @param actualDeflection  Maximum computed deflection (mm)
 * @param span  Member span (mm)
 * @param code  Design code ('IS456' | 'IS800')
 * @param memberType  Member classification for limit selection
 */
export function checkDeflection(
  actualDeflection: number,
  span: number,
  code: 'IS456' | 'IS800' = 'IS456',
  memberType: 'beam' | 'cantilever' | 'purlin' | 'crane_girder' = 'beam',
): DesignCheckResult {
  const absDefl = Math.abs(actualDeflection);

  // Determine deflection limit
  let limitRatio: number;
  let codeRef: string;

  if (code === 'IS456') {
    limitRatio = memberType === 'cantilever' ? 125 : 250;
    codeRef = 'IS 456 Cl. 23.2, Table 4';
  } else {
    // IS 800 Table 6
    switch (memberType) {
      case 'purlin':
        limitRatio = 150;
        codeRef = 'IS 800 Table 6 (purlin)';
        break;
      case 'crane_girder':
        limitRatio = 500;
        codeRef = 'IS 800 Table 6 (crane girder)';
        break;
      case 'cantilever':
        limitRatio = 120;
        codeRef = 'IS 800 Table 6 (cantilever)';
        break;
      default:
        limitRatio = 300;
        codeRef = 'IS 800 Table 6 (beam)';
    }
  }

  const allowable = span / limitRatio;
  const utilization = allowable > 1e-6 ? absDefl / allowable : (absDefl > 0 ? Infinity : 0);

  return {
    checkName: `Deflection (${code})`,
    codeRef,
    pass: utilization <= 1.0,
    utilization,
    demand: absDefl,
    capacity: allowable,
    unit: 'mm',
    details:
      `δ_actual = ${absDefl.toFixed(2)} mm, δ_allow = Span/${limitRatio} = ${allowable.toFixed(2)} mm, ` +
      `Span = ${span.toFixed(0)} mm`,
  };
}

// ============================================
// COMBINED MEMBER CHECK
// ============================================

/** Complete design check result for a member */
export interface MemberDesignResult {
  memberId: string;
  checks: DesignCheckResult[];
  overallPass: boolean;
  criticalCheck: string;
  maxUtilization: number;
}

/**
 * Run all applicable design checks for a steel beam-column member.
 *
 * @param memberId  Member identifier
 * @param N   Factored axial force (kN)
 * @param Vx  Factored shear about X (kN)
 * @param Mx  Factored moment about X (kN·m)
 * @param My  Factored moment about Y (kN·m)
 * @param deflection  Maximum deflection (mm)
 * @param section  Steel section properties
 */
export function checkSteelMember(
  memberId: string,
  N: number, Vx: number, Mx: number, My: number,
  deflection: number,
  section: SteelSectionProps,
): MemberDesignResult {
  const checks: DesignCheckResult[] = [];

  // 1. Flexure X-axis
  checks.push(checkFlexureIS800(Mx, section, 'x'));

  // 2. Flexure Y-axis (if significant)
  if (Math.abs(My) > 0.01) {
    checks.push(checkFlexureIS800(My, section, 'y'));
  }

  // 3. Shear
  checks.push(checkShearIS800(Vx, section, 'x'));

  // 4. Axial-Flexural Interaction (if axial load present)
  if (Math.abs(N) > 0.01) {
    checks.push(checkInteractionIS800(N, Mx, My, section));
  }

  // 5. Deflection
  if (section.L > 0) {
    checks.push(checkDeflection(deflection, section.L, 'IS800'));
  }

  // Determine overall result
  let maxUtil = 0;
  let criticalCheck = '';
  let allPass = true;

  for (const check of checks) {
    if (!check.pass) allPass = false;
    if (check.utilization > maxUtil) {
      maxUtil = check.utilization;
      criticalCheck = check.checkName;
    }
  }

  return {
    memberId,
    checks,
    overallPass: allPass,
    criticalCheck,
    maxUtilization: maxUtil,
  };
}

/**
 * Run all applicable design checks for a concrete beam member.
 *
 * @param memberId  Member identifier
 * @param Vu   Factored shear force (kN)
 * @param Mu   Factored bending moment (kN·m)
 * @param deflection  Maximum deflection (mm)
 * @param section  Concrete section properties
 */
export function checkConcreteMember(
  memberId: string,
  Vu: number, Mu: number,
  deflection: number,
  section: ConcreteSectionProps,
): MemberDesignResult {
  const checks: DesignCheckResult[] = [];

  // 1. Flexure
  checks.push(checkFlexureIS456(Mu, section));

  // 2. Shear
  checks.push(checkShearIS456(Vu, section));

  // 3. Deflection
  if (section.span && section.span > 0) {
    checks.push(checkDeflection(deflection, section.span, 'IS456'));
  }

  // Determine overall result
  let maxUtil = 0;
  let criticalCheck = '';
  let allPass = true;

  for (const check of checks) {
    if (!check.pass) allPass = false;
    if (check.utilization > maxUtil) {
      maxUtil = check.utilization;
      criticalCheck = check.checkName;
    }
  }

  return {
    memberId,
    checks,
    overallPass: allPass,
    criticalCheck,
    maxUtilization: maxUtil,
  };
}
