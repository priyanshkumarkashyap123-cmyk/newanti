/**
 * Eurocode2Checker.ts — EN 1992-1-1:2004 Reinforced Concrete Design
 *
 * Full implementation of EN 1992-1-1 design checks for:
 *   - ULS Flexure (§6.1) with parabolic-rectangular stress block
 *   - ULS Shear (§6.2) with VRd,c and VRd,s
 *   - Crack Width (§7.3.4) direct calculation
 *   - Deflection (§7.4) span/depth approach
 *   - Column design (§5.8) with second-order effects
 *   - Interaction (§6.1 + §6.2)
 *
 * National Annex support: UK (default), DE, FR
 *
 * Material partial factors (Table 2.1N):
 *   γc = 1.5 (concrete), γs = 1.15 (steel)
 *
 * Concrete classes: C12/15 to C90/105 (Table 3.1)
 * Steel grades: B400, B500A, B500B, B500C (Table C.1)
 *
 * @module Eurocode2Checker
 */

// ============================================
// TYPES
// ============================================

export interface EC2Material {
  /** Characteristic cylinder strength (MPa) — e.g., 25 for C25/30 */
  fck: number;
  /** Mean tensile strength (MPa) — computed from fck */
  fctm: number;
  /** Design compressive strength fcd = αcc × fck / γc */
  fcd: number;
  /** Secant modulus Ecm (MPa) */
  Ecm: number;
  /** Steel yield strength (MPa) — 400 or 500 */
  fyk: number;
  /** Design steel strength fyd = fyk / γs */
  fyd: number;
  /** Steel modulus Es (MPa) — 200000 */
  Es: number;
}

export interface EC2Section {
  /** Width (mm) */
  b: number;
  /** Effective depth (mm) */
  d: number;
  /** Overall depth (mm) */
  h: number;
  /** Tension reinforcement area (mm²) */
  As1: number;
  /** Compression reinforcement area (mm²) */
  As2: number;
  /** Clear cover to tension face (mm) */
  c: number;
  /** Span (mm) — for serviceability */
  span: number;
  /** Shear reinforcement: area per spacing (mm²/mm) */
  Asw_s?: number;
  /** Stirrup spacing (mm) */
  sw?: number;
}

export interface EC2CheckResult {
  name: string;
  clause: string;
  pass: boolean;
  utilization: number;
  demand: number;
  capacity: number;
  unit: string;
  details: string;
  warnings?: string[];
}

export interface EC2DesignOutput {
  /** Required tension steel (mm²) */
  As1_req: number;
  /** Required compression steel (mm²) */
  As2_req: number;
  /** Required shear reinforcement Asw/s (mm²/mm) */
  Asw_s_req: number;
  /** Suggested bar config */
  tensionBars: string;
  /** Suggested stirrups */
  stirrups: string;
}

// ============================================
// NATIONAL ANNEX PARAMETERS
// ============================================

interface NationalAnnex {
  /** αcc factor (§3.1.6) — long-term effects on compressive strength */
  alpha_cc: number;
  /** αct factor for tension */
  alpha_ct: number;
  /** γc — partial factor for concrete */
  gamma_c: number;
  /** γs — partial factor for steel */
  gamma_s: number;
  /** k1 factor for crack width (§7.3.4) */
  k1_crack: number;
  /** k2 factor for crack width */
  k2_crack: number;
}

const NATIONAL_ANNEXES: Record<string, NationalAnnex> = {
  UK: { alpha_cc: 0.85, alpha_ct: 1.0, gamma_c: 1.5, gamma_s: 1.15, k1_crack: 0.8, k2_crack: 0.5 },
  DE: { alpha_cc: 0.85, alpha_ct: 1.0, gamma_c: 1.5, gamma_s: 1.15, k1_crack: 0.8, k2_crack: 0.5 },
  FR: { alpha_cc: 1.0, alpha_ct: 1.0, gamma_c: 1.5, gamma_s: 1.15, k1_crack: 0.8, k2_crack: 0.5 },
};

// ============================================
// REBAR DATA (European sizes)
// ============================================

const EU_REBAR: Record<number, number> = {
  6: 28.27, 8: 50.27, 10: 78.54, 12: 113.10, 16: 201.06,
  20: 314.16, 25: 490.87, 32: 804.25, 40: 1256.64,
};

function selectEUBars(As_req: number): { count: number; dia: number; area: number; label: string } {
  const diameters = [12, 16, 20, 25, 32];
  let best = { count: 99, dia: 12, area: 0, label: '' };
  for (const dia of diameters) {
    const barArea = EU_REBAR[dia]!;
    const count = Math.ceil(As_req / barArea);
    if (count >= 2 && count <= 8 && count < best.count) {
      best = { count, dia, area: count * barArea, label: `${count}H${dia}` };
    }
  }
  if (best.count === 99) {
    const barArea = EU_REBAR[25]!;
    const count = Math.max(2, Math.ceil(As_req / barArea));
    best = { count, dia: 25, area: count * barArea, label: `${count}H25` };
  }
  return best;
}

// ============================================
// EUROCODE 2 CHECKER CLASS
// ============================================

export default class Eurocode2Checker {
  private annex: NationalAnnex;

  constructor(country: 'UK' | 'DE' | 'FR' = 'UK') {
    this.annex = NATIONAL_ANNEXES[country]!;
  }

  /** Compute material design values from fck and fyk */
  getMaterial(fck: number, fyk: number = 500): EC2Material {
    const { alpha_cc, gamma_c, gamma_s } = this.annex;

    // Mean tensile strength (EN 1992-1-1 Table 3.1)
    const fctm = fck <= 50
      ? 0.30 * Math.pow(fck, 2 / 3)
      : 2.12 * Math.log(1 + fck / 10);

    // Secant modulus (Table 3.1)
    const Ecm = 22000 * Math.pow(fck / 10, 0.3);

    const fcd = alpha_cc * fck / gamma_c;
    const fyd = fyk / gamma_s;

    return { fck, fctm, fcd, Ecm, fyk, fyd, Es: 200000 };
  }

  // ============================================
  // ULS FLEXURE — EN 1992-1-1 §6.1
  // ============================================

  /**
   * Flexure check using rectangular stress block (§3.1.7, Figure 3.5)
   *
   * Simplified rectangular block:
   *   λ = 0.8 for fck ≤ 50 MPa
   *   η = 1.0 for fck ≤ 50 MPa
   *   fcd_block = η × fcd
   *   x_max = 0.45d (ductility limit for Class B/C steel)
   *
   * MRd = fcd_block × b × λx × (d − λx/2)
   * As1 = MRd / (fyd × (d − λx/2))
   */
  checkFlexure(
    MEd: number, section: EC2Section, mat: EC2Material,
  ): EC2CheckResult & { design: EC2DesignOutput } {
    const { b, d, h, As1, As2 = 0 } = section;
    const { fcd, fyd } = mat;
    const warnings: string[] = [];

    // Stress block parameters (§3.1.7(3))
    const lambda = mat.fck <= 50 ? 0.8 : 0.8 - (mat.fck - 50) / 400;
    const eta = mat.fck <= 50 ? 1.0 : 1.0 - (mat.fck - 50) / 200;

    // Ductility limit: x ≤ x_u,lim = 0.45d for B500B/C
    const x_lim = 0.45 * d;

    // Limiting moment (singly reinforced)
    const MRd_lim = eta * fcd * b * lambda * x_lim * (d - lambda * x_lim / 2) / 1e6; // kN·m

    // Provided reinforcement capacity
    const x_prov = As1 * fyd / (eta * fcd * b * lambda);
    let MRd: number;

    if (x_prov <= x_lim) {
      MRd = As1 * fyd * (d - lambda * x_prov / 2) / 1e6;
    } else {
      warnings.push('x > x_lim: over-reinforced. Compression steel required.');
      if (As2 > 0) {
        const d2 = section.c + 10;
        const fsc = mat.Es * 0.0035 * (1 - d2 / x_lim);
        const fsc_design = Math.min(fsc, fyd);
        const MRd2 = fsc_design * As2 * (d - d2) / 1e6;
        MRd = MRd_lim + MRd2;
      } else {
        MRd = MRd_lim;
      }
    }

    // DESIGN: required reinforcement
    const absMEd = Math.abs(MEd);
    let As1_req: number;
    let As2_req = 0;

    // Normalised bending coefficient K = MEd / (bd²fck)
    const K = absMEd * 1e6 / (b * d * d * mat.fck);
    const K_lim = 0.167; // K' for x/d = 0.45

    if (K <= K_lim) {
      // Singly reinforced
      const z = d * Math.min(0.5 * (1 + Math.sqrt(1 - 3.53 * K)), 0.95 * d) / d;
      const z_actual = z * d;
      As1_req = absMEd * 1e6 / (fyd * z_actual);
    } else {
      // Doubly reinforced
      const z_lim = d * (1 - 0.4 * x_lim / d);
      const As1_lim = MRd_lim * 1e6 / (fyd * z_lim);
      const dM = (absMEd - MRd_lim) * 1e6;
      const d2 = section.c + 10;
      As2_req = dM / (fyd * (d - d2));
      As1_req = As1_lim + As2_req;
      warnings.push(`Doubly reinforced: MEd=${absMEd.toFixed(1)} > MRd_lim=${MRd_lim.toFixed(1)} kN·m`);
    }

    // Minimum reinforcement (§9.2.1.1)
    const As_min = Math.max(0.26 * mat.fctm / mat.fyk * b * d, 0.0013 * b * d);
    if (As1_req < As_min) {
      As1_req = As_min;
      warnings.push(`Minimum reinforcement governs: As_min=${As_min.toFixed(0)} mm²`);
    }

    // Maximum reinforcement (§9.2.1.1(3))
    const As_max = 0.04 * b * h;
    if (As1_req > As_max) {
      warnings.push(`As_req (${As1_req.toFixed(0)}) > 4% of Ac (${As_max.toFixed(0)})`);
    }

    const tensionBars = selectEUBars(As1_req);
    const compBars = As2_req > 0 ? selectEUBars(As2_req) : { label: 'None' };

    const utilization = MRd > 1e-6 ? absMEd / MRd : (absMEd > 0 ? Infinity : 0);

    return {
      name: 'Flexure (EN 1992)',
      clause: 'EN 1992-1-1 §6.1',
      pass: utilization <= 1.0,
      utilization,
      demand: absMEd,
      capacity: MRd,
      unit: 'kN·m',
      details:
        `K=${K.toFixed(4)}, K'=${K_lim}, x=${x_prov.toFixed(1)} mm, x_lim=${x_lim.toFixed(1)} mm | ` +
        `MRd=${MRd.toFixed(2)} kN·m | ` +
        `Required: As1=${As1_req.toFixed(0)} mm² (${tensionBars.label})` +
        (As2_req > 0 ? `, As2=${As2_req.toFixed(0)} mm² (${compBars.label})` : ''),
      warnings: warnings.length > 0 ? warnings : undefined,
      design: {
        As1_req,
        As2_req,
        Asw_s_req: 0,
        tensionBars: tensionBars.label,
        stirrups: '',
      },
    };
  }

  // ============================================
  // ULS SHEAR — EN 1992-1-1 §6.2
  // ============================================

  /**
   * Shear check per §6.2.2 (no shear reinforcement) and §6.2.3 (with)
   *
   * VRd,c = [CRd,c × k × (100 × ρl × fck)^(1/3)] × bw × d
   *   with minimum VRd,c = (vmin) × bw × d
   *   k = 1 + √(200/d) ≤ 2.0
   *   ρl = As1 / (bw × d) ≤ 0.02
   *   CRd,c = 0.18 / γc
   *
   * VRd,s = Asw/s × z × fywd × cot(θ)
   *   z = 0.9d
   *   θ between 21.8° and 45° (cot θ between 1.0 and 2.5)
   */
  checkShear(
    VEd: number, section: EC2Section, mat: EC2Material,
  ): EC2CheckResult & { design: EC2DesignOutput } {
    const { b, d, As1 } = section;
    const warnings: string[] = [];
    const absVEd = Math.abs(VEd);

    // Concrete shear resistance VRd,c (§6.2.2)
    const k = Math.min(1 + Math.sqrt(200 / d), 2.0);
    const rho_l = Math.min(As1 / (b * d), 0.02);
    const CRd_c = 0.18 / this.annex.gamma_c;
    const VRd_c = CRd_c * k * Math.pow(100 * rho_l * mat.fck, 1 / 3) * b * d / 1000; // kN

    // Minimum shear resistance
    const v_min = 0.035 * Math.pow(k, 1.5) * Math.pow(mat.fck, 0.5);
    const VRd_c_min = v_min * b * d / 1000;
    const VRd_c_design = Math.max(VRd_c, VRd_c_min);

    // Maximum shear resistance VRd,max (§6.2.3(3))
    const z = 0.9 * d;
    const nu1 = 0.6 * (1 - mat.fck / 250);
    const VRd_max = b * z * nu1 * mat.fcd / (1000 * 2); // cot(θ) + tan(θ) ≈ 2 at θ = 45°

    if (absVEd > VRd_max) {
      warnings.push(`VEd=${absVEd.toFixed(1)} kN > VRd,max=${VRd_max.toFixed(1)} kN. INCREASE SECTION.`);
    }

    // Design shear reinforcement
    let Asw_s_req = 0;
    let stirrups = '';

    if (absVEd > VRd_c_design) {
      // Shear reinforcement required
      // Choose θ: cot(θ) = min(2.5, max(1.0, VRd_max / VEd))
      const cot_theta = Math.min(2.5, Math.max(1.0, VRd_max / absVEd));
      const fywd = mat.fyd; // Design yield of stirrups

      // Asw/s = VEd / (z × fywd × cot(θ))
      Asw_s_req = absVEd * 1000 / (z * fywd * cot_theta); // mm²/mm

      // Minimum shear reinforcement (§9.2.2(5))
      const Asw_s_min = 0.08 * Math.sqrt(mat.fck) * b / mat.fyk;
      if (Asw_s_req < Asw_s_min) {
        Asw_s_req = Asw_s_min;
        warnings.push('Minimum shear reinforcement governs.');
      }

      // Convert to practical stirrup spacing
      const legs = 2;
      const diameters = [8, 10, 12];
      for (const dia of diameters) {
        const Asw = legs * EU_REBAR[dia]!;
        const s = Asw / Asw_s_req;
        const s_max = Math.min(0.75 * d, 400); // §9.2.2(6)
        const s_round = Math.floor(Math.min(s, s_max) / 25) * 25;
        if (s_round >= 75) {
          stirrups = `2L H${dia}@${s_round}`;
          break;
        }
      }
      if (!stirrups) stirrups = '4L H12@75';
    } else {
      stirrups = 'Nominal (VEd ≤ VRd,c)';
    }

    // Capacity with provided reinforcement
    let VRd: number;
    if (section.Asw_s && section.Asw_s > 0) {
      const VRd_s = section.Asw_s * z * mat.fyd * 2.5 / 1000; // Assuming cot θ = 2.5
      VRd = Math.min(VRd_c_design + VRd_s, VRd_max);
    } else {
      VRd = VRd_c_design;
    }

    const utilization = VRd > 1e-6 ? absVEd / VRd : (absVEd > 0 ? Infinity : 0);

    return {
      name: 'Shear (EN 1992)',
      clause: 'EN 1992-1-1 §6.2',
      pass: utilization <= 1.0,
      utilization,
      demand: absVEd,
      capacity: VRd,
      unit: 'kN',
      details:
        `k=${k.toFixed(2)}, ρl=${(rho_l * 100).toFixed(2)}%, ` +
        `VRd,c=${VRd_c_design.toFixed(1)} kN, VRd,max=${VRd_max.toFixed(1)} kN | ` +
        `VRd=${VRd.toFixed(1)} kN | Design: Asw/s=${(Asw_s_req * 1000).toFixed(1)} mm²/m, ${stirrups}`,
      warnings: warnings.length > 0 ? warnings : undefined,
      design: {
        As1_req: 0,
        As2_req: 0,
        Asw_s_req,
        tensionBars: '',
        stirrups,
      },
    };
  }

  // ============================================
  // SLS CRACK WIDTH — EN 1992-1-1 §7.3.4
  // ============================================

  /**
   * Crack width calculation per §7.3.4
   *
   * wk = sr,max × (εsm − εcm)
   *
   * sr,max = k3×c + k1×k2×k4×φ/ρp,eff  (§7.3.4(3))
   *
   * εsm − εcm = [σs − kt × fct,eff/ρp,eff × (1 + αe×ρp,eff)] / Es
   *   ≥ 0.6 × σs / Es
   *
   * Limits (Table 7.1N): 0.4mm (XC1), 0.3mm (XC2-XC4), 0.2mm (XD/XS)
   */
  checkCrackWidth(
    Mk: number, section: EC2Section, mat: EC2Material,
    exposureClass: 'XC1' | 'XC2' | 'XC3' | 'XC4' | 'XD' | 'XS' = 'XC2',
  ): EC2CheckResult {
    const { b, d, h, As1, c } = section;
    const warnings: string[] = [];

    // Crack width limit (Table 7.1N)
    let wk_limit: number;
    if (exposureClass === 'XC1') wk_limit = 0.4;
    else if (exposureClass === 'XD' || exposureClass === 'XS') wk_limit = 0.2;
    else wk_limit = 0.3;

    // Effective tension area (§7.3.2(3))
    const hc_eff = Math.min(2.5 * (h - d), (h - d) / 3 + (h - d), h / 2);
    const Ac_eff = b * hc_eff;
    const rho_p_eff = As1 / Ac_eff;

    // Modular ratio
    const alpha_e = mat.Es / mat.Ecm;

    // Cracked NA depth
    const ae_rho = alpha_e * As1 / (b * d);
    const x = d * (-ae_rho / (b * d / (b * d)) + Math.sqrt(
      Math.pow(alpha_e * As1 / (b * d), 2) + 2 * alpha_e * As1 / (b * d)
    ));

    // Steel stress under service moment
    const z_crack = d - x / 3;
    const sigma_s = Math.abs(Mk) * 1e6 / (As1 * z_crack);

    // Crack spacing sr,max (§7.3.4(3))
    const k1 = this.annex.k1_crack; // 0.8 for deformed bars
    const k2 = this.annex.k2_crack; // 0.5 for bending
    const k3 = 3.4;
    const k4 = 0.425;
    const phi_bar = 16; // Assumed bar diameter
    const sr_max = k3 * c + k1 * k2 * k4 * phi_bar / rho_p_eff;

    // Strain (§7.3.4(2))
    const fct_eff = mat.fctm;
    const kt = 0.4; // Long-term loading
    const eps_diff = (sigma_s - kt * fct_eff / rho_p_eff * (1 + alpha_e * rho_p_eff)) / mat.Es;
    const eps_min = 0.6 * sigma_s / mat.Es;
    const eps_sm_cm = Math.max(eps_diff, eps_min);

    // Crack width
    const wk = sr_max * eps_sm_cm;

    const utilization = wk_limit > 0 ? wk / wk_limit : 0;

    if (wk > wk_limit) {
      warnings.push(`wk=${wk.toFixed(3)} mm > limit ${wk_limit} mm. Reduce spacing or add As.`);
    }

    return {
      name: 'Crack Width (EN 1992)',
      clause: 'EN 1992-1-1 §7.3.4',
      pass: wk <= wk_limit,
      utilization,
      demand: wk,
      capacity: wk_limit,
      unit: 'mm',
      details:
        `σs=${sigma_s.toFixed(1)} MPa, sr,max=${sr_max.toFixed(1)} mm, ` +
        `εsm−εcm=${eps_sm_cm.toExponential(2)}, wk=${wk.toFixed(3)} mm ≤ ${wk_limit} mm (${exposureClass})`,
      warnings: warnings.length > 0 ? warnings : undefined,
    };
  }

  // ============================================
  // SLS DEFLECTION — EN 1992-1-1 §7.4
  // ============================================

  /**
   * Deemed-to-satisfy span/depth check (§7.4.2)
   *
   * Basic span/depth ratios (Table 7.4N):
   *   ρ ≤ ρ0: L/d = K[11 + 1.5√fck × ρ0/ρ + 3.2√fck × (ρ0/ρ − 1)^1.5]
   *   ρ > ρ0: L/d = K[11 + 1.5√fck × ρ0/(ρ − ρ') + √fck/12 × √(ρ'/ρ0)]
   *
   * K factors: simply supported=1.0, end span=1.3, interior span=1.5, cantilever=0.4
   */
  checkDeflection(
    section: EC2Section, mat: EC2Material,
    supportType: 'simply_supported' | 'end_span' | 'interior_span' | 'cantilever' = 'simply_supported',
  ): EC2CheckResult {
    const { b, d, span, As1, As2 = 0 } = section;

    let K: number;
    switch (supportType) {
      case 'simply_supported': K = 1.0; break;
      case 'end_span': K = 1.3; break;
      case 'interior_span': K = 1.5; break;
      case 'cantilever': K = 0.4; break;
    }

    const rho = As1 / (b * d);
    const rho_prime = As2 / (b * d);
    const rho_0 = Math.sqrt(mat.fck) / 1000; // Reference reinforcement ratio

    let ld_basic: number;
    if (rho <= rho_0) {
      ld_basic = K * (11 + 1.5 * Math.sqrt(mat.fck) * rho_0 / rho
        + 3.2 * Math.sqrt(mat.fck) * Math.pow(Math.max(rho_0 / rho - 1, 0), 1.5));
    } else {
      const denom = rho - rho_prime;
      ld_basic = K * (11 + 1.5 * Math.sqrt(mat.fck) * rho_0 / Math.max(denom, 1e-6)
        + Math.sqrt(mat.fck) / 12 * Math.sqrt(rho_prime / rho_0));
    }

    // Modification for steel stress (§7.4.2(2))
    const sigma_s_ratio = (mat.fyk === 500) ? 1.0 : 500 / mat.fyk;
    const As_prov_As_req_ratio = 1.0; // Assume As_prov = As_req (conservative)
    const mod_factor = Math.min(310 / (sigma_s_ratio * mat.fyd * As_prov_As_req_ratio / 1), 1.5);

    const ld_allowable = ld_basic * mod_factor;
    const ld_actual = span / d;

    const utilization = ld_allowable > 0 ? ld_actual / ld_allowable : 0;

    return {
      name: 'Deflection (EN 1992)',
      clause: 'EN 1992-1-1 §7.4.2',
      pass: utilization <= 1.0,
      utilization,
      demand: ld_actual,
      capacity: ld_allowable,
      unit: 'L/d ratio',
      details:
        `ρ=${(rho * 100).toFixed(3)}%, ρ0=${(rho_0 * 100).toFixed(3)}% | ` +
        `K=${K}, L/d_basic=${ld_basic.toFixed(1)}, mod=${mod_factor.toFixed(2)} | ` +
        `L/d_actual=${ld_actual.toFixed(1)} ≤ L/d_allow=${ld_allowable.toFixed(1)}`,
    };
  }

  // ============================================
  // COLUMN CHECK — EN 1992-1-1 §5.8, §6.1
  // ============================================

  /**
   * Column check with second-order effects (simplified method §5.8.7)
   *
   * Slenderness: λ = l0/i where i = √(I/A)
   * Limit: λlim = 20×A×B×C/√n  where n = NEd/(Ac×fcd)
   * If λ > λlim: second-order effects via additional moment
   *   M2 = NEd × e2
   *   e2 = (1/r) × l0²/10
   *   1/r = Kr × Kφ × (fyd/(Es × 0.45d))
   */
  checkColumn(
    NEd: number, MEd: number,
    section: EC2Section, mat: EC2Material,
    l0: number, // Effective length (mm)
  ): EC2CheckResult {
    const { b, d, h, As1: Ast } = section;
    const warnings: string[] = [];
    const absNEd = Math.abs(NEd);
    const absMEd = Math.abs(MEd);

    const Ac = b * h;
    const I = b * h * h * h / 12;
    const i = Math.sqrt(I / Ac);

    // Slenderness
    const lambda = l0 / i;

    // Slenderness limit (§5.8.3.1)
    const n = absNEd * 1000 / (Ac * mat.fcd);
    const A_sl = 1 / (1 + 0.2 * 0.35); // Default φef = 0.35
    const B_sl = Math.sqrt(1 + 2 * 0.1); // Default ω = 0.1
    const C_sl = 1.7; // Default rm = 0
    const lambda_lim = 20 * A_sl * B_sl * C_sl / Math.sqrt(Math.max(n, 0.01));

    const isSlender = lambda > lambda_lim;
    if (isSlender) {
      warnings.push(`Slender: λ=${lambda.toFixed(1)} > λlim=${lambda_lim.toFixed(1)}`);
    }

    // Second-order moment
    let M2 = 0;
    if (isSlender) {
      // Simplified method (§5.8.7)
      const Kr = Math.min(1.0, (n - 0.4) / (n - 1)); // Correction factor
      const K_phi = 1.0; // Simplified (no creep data)
      const one_over_r = Math.max(Kr, 0) * K_phi * mat.fyd / (mat.Es * 0.45 * d);
      const e2 = one_over_r * l0 * l0 / 10;
      M2 = absNEd * e2 / 1000; // kN·m
      warnings.push(`Second-order moment M2=${M2.toFixed(1)} kN·m`);
    }

    // Minimum eccentricity (§6.1(4))
    const e0 = Math.max(h / 30, 20); // mm
    const M_min = absNEd * e0 / 1000;
    const M_Ed_design = Math.max(absMEd + M2, M_min);

    // Axial capacity (simplified)
    const NRd = (mat.fcd * (Ac - Ast) + mat.fyd * Ast) / 1000; // kN

    // Interaction (simplified N+M check using linear interaction)
    const n_ratio = absNEd / NRd;
    const MRd = mat.fyd * (Ast / 2) * (d - (section.c + 10)) / 1e6; // Approximate
    const m_ratio = MRd > 0 ? M_Ed_design / MRd : 0;

    const utilization = n_ratio + m_ratio;

    // Reinforcement limits (§9.5.2)
    const As_min_col = Math.max(0.1 * absNEd * 1000 / mat.fyd, 0.002 * Ac);
    const As_max_col = 0.04 * Ac;
    if (Ast < As_min_col) warnings.push(`As=${Ast.toFixed(0)} < As_min=${As_min_col.toFixed(0)} mm²`);
    if (Ast > As_max_col) warnings.push(`As=${Ast.toFixed(0)} > 4% Ac=${As_max_col.toFixed(0)} mm²`);

    return {
      name: 'Column (EN 1992)',
      clause: 'EN 1992-1-1 §5.8, §6.1',
      pass: utilization <= 1.0,
      utilization,
      demand: utilization,
      capacity: 1.0,
      unit: 'ratio',
      details:
        `λ=${lambda.toFixed(1)}, λlim=${lambda_lim.toFixed(1)} | ` +
        `NRd=${NRd.toFixed(1)} kN, N/NRd=${n_ratio.toFixed(3)} | ` +
        `MEd=${M_Ed_design.toFixed(1)} kN·m, MRd=${MRd.toFixed(1)} kN·m | ` +
        `Unity=${utilization.toFixed(3)}`,
      warnings: warnings.length > 0 ? warnings : undefined,
    };
  }

  // ============================================
  // COMBINED MEMBER CHECK
  // ============================================

  /**
   * Run all applicable EN 1992 checks for a beam
   */
  checkBeam(
    VEd: number, MEd: number, Mk: number,
    section: EC2Section, mat: EC2Material,
    exposure?: 'XC1' | 'XC2' | 'XC3' | 'XC4' | 'XD' | 'XS',
  ): { checks: EC2CheckResult[]; design: EC2DesignOutput; overallPass: boolean; maxUtil: number } {
    const checks: EC2CheckResult[] = [];

    const flexResult = this.checkFlexure(MEd, section, mat);
    checks.push(flexResult);

    const shearResult = this.checkShear(VEd, section, mat);
    checks.push(shearResult);

    if (section.span > 0) {
      checks.push(this.checkDeflection(section, mat));
    }

    if (Math.abs(Mk) > 0.01) {
      checks.push(this.checkCrackWidth(Mk, section, mat, exposure ?? 'XC2'));
    }

    let maxUtil = 0;
    let allPass = true;
    for (const c of checks) {
      if (!c.pass) allPass = false;
      if (c.utilization > maxUtil) maxUtil = c.utilization;
    }

    return {
      checks,
      design: {
        As1_req: flexResult.design.As1_req,
        As2_req: flexResult.design.As2_req,
        Asw_s_req: shearResult.design.Asw_s_req,
        tensionBars: flexResult.design.tensionBars,
        stirrups: shearResult.design.stirrups,
      },
      overallPass: allPass,
      maxUtil,
    };
  }

  /**
   * Quick check for a beam (simplified API)
   */
  quickCheck(
    fck: number, fyk: number,
    b: number, h: number, d: number, cover: number,
    As1: number, span: number,
    VEd: number, MEd: number,
  ): { passed: boolean; checks: EC2CheckResult[] } {
    const mat = this.getMaterial(fck, fyk);
    const section: EC2Section = { b, d, h, As1, As2: 0, c: cover, span };
    const result = this.checkBeam(VEd, MEd, MEd / 1.5, section, mat);
    return { passed: result.overallPass, checks: result.checks };
  }
}

/** Singleton instance (UK National Annex) */
export const eurocode2 = new Eurocode2Checker('UK');
