/**
 * ============================================================================
 * TIMBER DESIGN ENGINE - PHASE 3 STUB
 * ============================================================================
 * 
 * Timber structural design per:
 * - NDS (National Design Specification for Wood Construction)
 * - EN 1995 (Eurocode 5)
 * - IS 883
 * 
 * Covers:
 * - Sawn lumber
 * - Glued laminated timber (Glulam)
 * - Cross-laminated timber (CLT)
 * - Mass timber connections
 * 
 * STATUS: STUB - Core structure and interfaces ready for full implementation
 * 
 * @version 0.1.0
 */

// ============================================================================
// TYPES
// ============================================================================

export type TimberGrade = 
  | 'Select_Structural' | 'No1' | 'No2' | 'No3' | 'Stud' | 'Construction'  // NDS
  | 'C14' | 'C16' | 'C18' | 'C22' | 'C24' | 'C27' | 'C30' | 'C35' | 'C40' | 'C50'  // EN 1995
  | 'GL24h' | 'GL28h' | 'GL32h' | 'GL24c' | 'GL28c' | 'GL32c';  // Glulam

export type TimberSpecies = 
  | 'Douglas_Fir' | 'Southern_Pine' | 'Hem_Fir' | 'Spruce_Pine_Fir'
  | 'Norway_Spruce' | 'European_Larch' | 'Oak' | 'Teak' | 'Sal';

export interface TimberMemberInput {
  type: 'sawn' | 'glulam' | 'clt' | 'lvl';
  species?: TimberSpecies;
  grade: TimberGrade;
  
  // Dimensions
  width: number;              // mm (b)
  depth: number;              // mm (d)
  length: number;             // m
  
  // For CLT
  cltLayers?: number;
  cltLayerThickness?: number; // mm
  
  // Bracing
  lateralSupport: 'continuous' | 'discrete' | 'none';
  unbragedLength?: number;    // m
  
  // Loads
  loadDuration: 'permanent' | 'long_term' | 'medium_term' | 'short_term' | 'instantaneous';
  moistureCondition: 'dry' | 'wet';
  temperature: 'normal' | 'elevated';
}

export interface TimberBeamResult {
  // Adjusted capacities
  Fb_adj: number;             // Adjusted bending stress (MPa)
  Fv_adj: number;             // Adjusted shear stress (MPa)
  Fc_perp_adj: number;        // Adjusted bearing stress (MPa)
  E_adj: number;              // Adjusted modulus of elasticity (MPa)
  
  // Capacities
  M_capacity: number;         // Moment capacity (kN·m)
  V_capacity: number;         // Shear capacity (kN)
  
  // Adjustment factors applied
  adjustmentFactors: {
    CD: number;               // Load duration factor
    CM: number;               // Wet service factor
    Ct: number;               // Temperature factor
    CL: number;               // Beam stability factor
    CF: number;               // Size factor
    Cfu: number;              // Flat use factor
    Ci: number;               // Incising factor
    Cr: number;               // Repetitive member factor
  };
  
  status: 'PASS' | 'FAIL';
  governingCheck: string;
  designCode: string;
  clause: string;
}

export interface TimberColumnResult {
  Fc_adj: number;             // Adjusted compression stress (MPa)
  P_capacity: number;         // Axial capacity (kN)
  slendernessRatio: number;
  Cp: number;                 // Column stability factor
  status: 'PASS' | 'FAIL';
  governingCheck: string;
  designCode: string;
  clause: string;
}

export interface TimberConnectionInput {
  type: 'nailed' | 'screwed' | 'bolted' | 'lag_screwed' | 'doweled' | 'glued';
  
  // Fastener properties
  fastenerDiameter?: number;   // mm
  fastenerLength?: number;     // mm
  fastenerCount?: number;
  rows?: number;
  spacing?: number;            // mm
  edgeDistance?: number;       // mm
  endDistance?: number;        // mm
  
  // Member properties
  mainMemberThickness: number; // mm
  sideMemberThickness: number; // mm
  mainMemberSpecies: TimberSpecies;
  sideMemberSpecies: TimberSpecies;
  sideMemberType: 'wood' | 'steel';
  
  // Load
  loadAngle: number;           // degrees (0 = parallel to grain)
  loadType: 'lateral' | 'withdrawal';
}

export interface TimberConnectionResult {
  Z_reference: number;         // Reference design value (kN)
  Z_adjusted: number;          // Adjusted capacity (kN)
  governingMode: string;       // Yield mode (Im, Is, II, IIIm, IIIs, IV)
  groupAction: number;         // Group action factor Cg
  geometryFactor: number;      // Geometry factor CΔ
  status: 'PASS' | 'FAIL';
  designCode: string;
  clause: string;
}

// ============================================================================
// REFERENCE DESIGN VALUES (NDS Table 4A excerpt)
// ============================================================================

const NDS_REFERENCE_VALUES: Record<string, {
  Fb: number;   // Bending (MPa)
  Ft: number;   // Tension (MPa)
  Fv: number;   // Shear (MPa)
  Fc_perp: number; // Compression perpendicular (MPa)
  Fc: number;   // Compression parallel (MPa)
  E: number;    // Modulus of elasticity (MPa)
  Emin: number; // Min modulus for stability (MPa)
  G: number;    // Specific gravity
}> = {
  'Douglas_Fir_Select_Structural': { Fb: 10.3, Ft: 6.9, Fv: 1.2, Fc_perp: 4.5, Fc: 11.0, E: 12400, Emin: 6500, G: 0.50 },
  'Douglas_Fir_No1': { Fb: 7.6, Ft: 5.2, Fv: 1.2, Fc_perp: 4.5, Fc: 8.6, E: 11700, Emin: 6200, G: 0.50 },
  'Douglas_Fir_No2': { Fb: 6.2, Ft: 4.1, Fv: 1.2, Fc_perp: 4.5, Fc: 5.5, E: 11000, Emin: 5500, G: 0.50 },
  'Southern_Pine_Select_Structural': { Fb: 13.1, Ft: 8.6, Fv: 1.4, Fc_perp: 4.0, Fc: 12.4, E: 12400, Emin: 6500, G: 0.55 },
  'Southern_Pine_No1': { Fb: 10.3, Ft: 6.9, Fv: 1.4, Fc_perp: 4.0, Fc: 10.3, E: 11700, Emin: 6200, G: 0.55 },
  'Southern_Pine_No2': { Fb: 8.3, Ft: 4.8, Fv: 1.4, Fc_perp: 4.0, Fc: 8.3, E: 11000, Emin: 5500, G: 0.55 },
};

// Eurocode 5 strength classes
const EN1995_VALUES: Record<string, {
  fm_k: number; ft_0_k: number; ft_90_k: number; fc_0_k: number; fc_90_k: number;
  fv_k: number; E_0_mean: number; E_0_05: number; G_mean: number; rho_k: number;
}> = {
  'C24': { fm_k: 24, ft_0_k: 14, ft_90_k: 0.5, fc_0_k: 21, fc_90_k: 2.5, fv_k: 4.0, E_0_mean: 11000, E_0_05: 7400, G_mean: 690, rho_k: 350 },
  'C30': { fm_k: 30, ft_0_k: 18, ft_90_k: 0.6, fc_0_k: 23, fc_90_k: 2.7, fv_k: 4.0, E_0_mean: 12000, E_0_05: 8000, G_mean: 750, rho_k: 380 },
  'GL28h': { fm_k: 28, ft_0_k: 19.5, ft_90_k: 0.5, fc_0_k: 26.5, fc_90_k: 3.0, fv_k: 3.5, E_0_mean: 12600, E_0_05: 10200, G_mean: 780, rho_k: 410 },
  'GL32h': { fm_k: 32, ft_0_k: 22.5, ft_90_k: 0.5, fc_0_k: 29, fc_90_k: 3.3, fv_k: 3.8, E_0_mean: 13700, E_0_05: 11100, G_mean: 850, rho_k: 430 },
};

// ============================================================================
// STUB IMPLEMENTATIONS
// ============================================================================

export function designTimberBeam(
  input: TimberMemberInput,
  loads: { Mu: number; Vu: number }, // kN·m, kN
  code: 'NDS' | 'EN1995' | 'IS883' = 'NDS'
): TimberBeamResult {
  const { width: b, depth: d, length, lateralSupport, moistureCondition, temperature, loadDuration, species, grade, type } = input;
  const lu = (input.unbragedLength ?? length) * 1000; // mm

  if (code === 'NDS') {
    // ---- NDS Adjustment Factor Cascade ----
    const key = `${species ?? 'Douglas_Fir'}_${grade}`;
    const ref = NDS_REFERENCE_VALUES[key] ?? NDS_REFERENCE_VALUES['Douglas_Fir_No2'];

    // CD — Load duration factor (NDS Table 2.3.2)
    const CD = LOAD_DURATION_FACTORS[loadDuration]?.CD ?? 1.0;

    // CM — Wet service factor (NDS Table 4A footnotes)
    const CM_Fb = moistureCondition === 'wet' ? 0.85 : 1.0;
    const CM_Fv = moistureCondition === 'wet' ? 0.97 : 1.0;
    const CM_Fc_perp = moistureCondition === 'wet' ? 0.67 : 1.0;
    const CM_E = moistureCondition === 'wet' ? 0.9 : 1.0;

    // Ct — Temperature factor (NDS Sec. 2.3.3)
    const Ct = temperature === 'elevated' ? 0.9 : 1.0;

    // CF — Size factor (NDS Sec. 4.3.6) for sawn lumber d > 305mm (12")
    let CF = 1.0;
    if (type === 'sawn' && d > 305) {
      CF = Math.pow(305 / d, 1 / 9); // (12/d_inches)^(1/9)
    }

    // Cfu — Flat use factor (loaded on narrow face) — assume normal use
    const Cfu = 1.0;

    // Ci — Incising factor (NDS Sec. 4.3.8) — assume not incised
    const Ci = 1.0;

    // Cr — Repetitive member factor (NDS Sec. 4.3.9) — assume yes for typical framing
    const Cr = (type === 'sawn' && b <= 89) ? 1.15 : 1.0;

    // CL — Beam stability factor (NDS Sec. 3.3.3)
    let CL = 1.0;
    if (lateralSupport !== 'continuous') {
      const le_eff = lateralSupport === 'discrete' ? 1.63 * lu + 3 * d : 1.84 * lu;
      const RB = Math.sqrt(le_eff * d / (b * b)); // Slenderness ratio for bending
      if (RB > 50) {
        // Exceeds slenderness limit NDS Sec. 3.3.3
      }
      const Fb_star = ref.Fb * CD * CM_Fb * Ct * CF * Ci * Cr;
      const FbE = 1.20 * ref.Emin * CM_E * Ct * Ci / (RB * RB);
      const ratio = FbE / Fb_star;
      CL = (1 + ratio) / 1.9 - Math.sqrt(Math.pow((1 + ratio) / 1.9, 2) - ratio / 0.95);
      CL = Math.min(1.0, Math.max(0, CL));
    }

    // Adjusted design values (NDS Sec. 4.3)
    const Fb_adj = ref.Fb * CD * CM_Fb * Ct * CL * CF * Cfu * Ci * Cr;
    const Fv_adj = ref.Fv * CD * CM_Fv * Ct * Ci;
    const Fc_perp_adj = ref.Fc_perp * CM_Fc_perp * Ct * Ci;
    const E_adj = ref.E * CM_E * Ct * Ci;

    // Section properties
    const S = b * d * d / 6; // Section modulus (mm³)
    const A_gross = b * d;

    // Capacities
    const M_capacity = Fb_adj * S / 1e6; // kN·m
    const V_capacity = Fv_adj * (2 / 3) * A_gross / 1000; // kN (NDS Sec. 3.4.2)

    const governingCheck = loads.Mu / M_capacity > loads.Vu / V_capacity ? 'Bending (NDS 3.3)' : 'Shear (NDS 3.4)';
    const maxUtil = Math.max(loads.Mu / M_capacity, loads.Vu / V_capacity);

    return {
      Fb_adj: Math.round(Fb_adj * 100) / 100,
      Fv_adj: Math.round(Fv_adj * 100) / 100,
      Fc_perp_adj: Math.round(Fc_perp_adj * 100) / 100,
      E_adj: Math.round(E_adj),
      M_capacity: Math.round(M_capacity * 100) / 100,
      V_capacity: Math.round(V_capacity * 100) / 100,
      adjustmentFactors: { CD, CM: CM_Fb, Ct, CL: Math.round(CL * 1000) / 1000, CF, Cfu, Ci, Cr },
      status: maxUtil <= 1.0 ? 'PASS' : 'FAIL',
      governingCheck,
      designCode: 'NDS',
      clause: 'NDS 2018 Sec. 3.3, 3.4, 4.3',
    };
  } else {
    // ---- EN 1995 ----
    const gradeKey = grade as string;
    const ref = EN1995_VALUES[gradeKey] ?? EN1995_VALUES['C24'];
    const gamma_M = type === 'glulam' ? 1.25 : 1.30; // EN 1995 Table 2.3
    const kmod = KMOD_VALUES[type === 'glulam' ? 'glulam' : 'solid_timber']?.[loadDuration] ?? 0.8;
    const kh = d < 150 ? Math.min(1.3, Math.pow(150 / d, 0.2)) : 1.0; // Size factor EN 1995 Cl. 3.2
    const kcrit = lateralSupport === 'continuous' ? 1.0 : Math.min(1.0, Math.sqrt(ref.E_0_05 / (ref.fm_k * (lu * d / (b * b)))));

    const fm_d = kmod * kh * kcrit * ref.fm_k / gamma_M;
    const fv_d = kmod * ref.fv_k / gamma_M;
    const S = b * d * d / 6;
    const M_capacity = fm_d * S / 1e6;
    const V_capacity = fv_d * (2 / 3) * b * d / 1000;
    const maxUtil = Math.max(loads.Mu / M_capacity, loads.Vu / V_capacity);

    return {
      Fb_adj: fm_d, Fv_adj: fv_d, Fc_perp_adj: kmod * ref.fc_90_k / gamma_M, E_adj: ref.E_0_mean,
      M_capacity: Math.round(M_capacity * 100) / 100, V_capacity: Math.round(V_capacity * 100) / 100,
      adjustmentFactors: { CD: kmod, CM: 1, Ct: 1, CL: kcrit, CF: kh, Cfu: 1, Ci: 1, Cr: 1 },
      status: maxUtil <= 1.0 ? 'PASS' : 'FAIL',
      governingCheck: loads.Mu / M_capacity > loads.Vu / V_capacity ? 'Bending (EC5 6.1)' : 'Shear (EC5 6.1.7)',
      designCode: 'EN1995', clause: 'EN 1995-1-1 Cl. 6.1, 6.1.7',
    };
  }
}

export function designTimberColumn(
  input: TimberMemberInput,
  Pu: number, // Axial load (kN)
  code: 'NDS' | 'EN1995' | 'IS883' = 'NDS'
): TimberColumnResult {
  const { width: b, depth: d, length, moistureCondition, temperature, loadDuration, species, grade, type } = input;
  const le = (input.unbragedLength ?? length) * 1000; // mm
  const d_min = Math.min(b, d);

  if (code === 'NDS') {
    const key = `${species ?? 'Douglas_Fir'}_${grade}`;
    const ref = NDS_REFERENCE_VALUES[key] ?? NDS_REFERENCE_VALUES['Douglas_Fir_No2'];

    const CD = LOAD_DURATION_FACTORS[loadDuration]?.CD ?? 1.0;
    const CM = moistureCondition === 'wet' ? 0.8 : 1.0;
    const Ct = temperature === 'elevated' ? 0.9 : 1.0;

    // Slenderness ratio (NDS Sec. 3.7.1.3)
    const slenderness = le / d_min;

    // Column stability factor Cp (NDS Sec. 3.7.1.5)
    const Fc_star = ref.Fc * CD * CM * Ct; // Fc* (Fc with all factors except Cp)
    const Emin_adj = ref.Emin * CM * Ct;
    const FcE = 0.822 * Emin_adj / (slenderness * slenderness); // Euler critical stress (NDS Eq. 3.7-1)
    const c = type === 'sawn' ? 0.8 : 0.9; // 0.8 for sawn, 0.9 for glulam (NDS Sec. 3.7.1.5)
    const ratioCol = FcE / Fc_star;
    const Cp = (1 + ratioCol) / (2 * c) - Math.sqrt(Math.pow((1 + ratioCol) / (2 * c), 2) - ratioCol / c);

    const Fc_adj = Fc_star * Cp;
    const A = b * d;
    const P_capacity = Fc_adj * A / 1000; // kN

    return {
      Fc_adj: Math.round(Fc_adj * 100) / 100,
      P_capacity: Math.round(P_capacity * 100) / 100,
      slendernessRatio: Math.round(slenderness * 10) / 10,
      Cp: Math.round(Cp * 1000) / 1000,
      status: Pu <= P_capacity ? 'PASS' : 'FAIL',
      governingCheck: slenderness > 50 ? 'Buckling (NDS 3.7.1)' : 'Material crushing (NDS 3.6)',
      designCode: 'NDS',
      clause: 'NDS 2018 Sec. 3.7.1',
    };
  } else {
    // EN 1995 Cl. 6.3.2
    const gradeKey = grade as string;
    const ref = EN1995_VALUES[gradeKey] ?? EN1995_VALUES['C24'];
    const gamma_M = type === 'glulam' ? 1.25 : 1.30;
    const kmod = KMOD_VALUES[type === 'glulam' ? 'glulam' : 'solid_timber']?.[loadDuration] ?? 0.8;

    const i = d_min / Math.sqrt(12); // radius of gyration for rectangular
    const lambda_rel = (le / (Math.PI * i)) * Math.sqrt(ref.fc_0_k / ref.E_0_05);
    const beta_c = type === 'sawn' ? 0.2 : 0.1;
    const k = 0.5 * (1 + beta_c * (lambda_rel - 0.3) + lambda_rel * lambda_rel);
    const kc = 1 / (k + Math.sqrt(k * k - lambda_rel * lambda_rel));

    const fc_0_d = kmod * ref.fc_0_k / gamma_M;
    const Fc_adj = kc * fc_0_d;
    const P_capacity = Fc_adj * b * d / 1000;
    const slenderness = le / d_min;

    return {
      Fc_adj: Math.round(Fc_adj * 100) / 100,
      P_capacity: Math.round(P_capacity * 100) / 100,
      slendernessRatio: Math.round(slenderness * 10) / 10,
      Cp: Math.round(kc * 1000) / 1000,
      status: Pu <= P_capacity ? 'PASS' : 'FAIL',
      governingCheck: lambda_rel > 0.3 ? 'Buckling (EC5 6.3.2)' : 'Material crushing (EC5 6.1.4)',
      designCode: 'EN1995',
      clause: 'EN 1995-1-1 Cl. 6.3.2',
    };
  }
}

export function designTimberConnection(
  input: TimberConnectionInput,
  load: number, // kN
  code: 'NDS' | 'EN1995' = 'NDS'
): TimberConnectionResult {
  const { type: connType, fastenerDiameter: D_f = 12, fastenerLength: Lf = 100, fastenerCount: n = 4, mainMemberThickness: lm, sideMemberThickness: ls, mainMemberSpecies, sideMemberSpecies, sideMemberType, loadAngle } = input;

  if (code !== 'NDS') {
    // EN 1995 Cl. 8.2 placeholder — single-fastener Johansen equations are extensive
    const fh_k = 0.082 * (1 - 0.01 * (D_f ?? 12)) * 350; // dowel bearing strength
    const My_k = 0.3 * 400 * Math.pow(D_f, 2.6); // yield moment Nmm
    const Fv_Rk = Math.min(fh_k * lm * D_f / 1000, Math.sqrt(2 * My_k * fh_k * D_f) / 1000);
    const Z_adj = Fv_Rk * n / 1.3; // /gamma_M
    return { Z_reference: Fv_Rk, Z_adjusted: Z_adj, governingMode: 'Johansen', groupAction: 1, geometryFactor: 1,
      status: load <= Z_adj ? 'PASS' : 'FAIL', designCode: 'EN1995', clause: 'EN 1995-1-1 Cl. 8.2.2' };
  }

  // ---- NDS Yield Mode Equations (Chapter 12, Table 12.3.1A/B) ----
  // Dowel bearing strengths
  const G_main = (NDS_REFERENCE_VALUES[`${mainMemberSpecies}_No2`] ?? NDS_REFERENCE_VALUES['Douglas_Fir_No2']).G;
  const G_side = sideMemberType === 'steel' ? 1.0 : (NDS_REFERENCE_VALUES[`${sideMemberSpecies}_No2`] ?? NDS_REFERENCE_VALUES['Douglas_Fir_No2']).G;

  // Fe — dowel bearing strength (NDS Table 12.3.3)
  // For bolts: Fe_parallel = 11200 × G (NDS Eq. 12.3-2)
  const Fe_m = 11200 * G_main; // psi → convert to MPa: ×0.006895
  const Fe_s = sideMemberType === 'steel' ? 1.5 * 580 : 11200 * G_side; // Steel: 1.5Fu for 10mm+ plate

  // Hankinson formula for angle to grain (NDS Eq. 12.3-5)
  const theta_rad = loadAngle * Math.PI / 180;
  const Fe_m_theta = Fe_m; // simplified for parallel
  const Fe_s_theta = Fe_s;

  // Yield moment My (NDS Eq. 12.3-6): Fyb × D³ / 6 for bolts  
  const Fyb = connType === 'bolted' ? 310 : 620; // MPa approx (A307 vs screws)
  const My = Fyb * Math.pow(D_f, 3) / 6; // N·mm

  // Yield modes for single shear (NDS Table 12.3.1B)
  const Re = Fe_m_theta / Fe_s_theta;
  const Rt = lm / ls;

  // Convert Fe to N/mm² basis (already in psi-equivalent for NDS formula, need consistency)
  const Fe_m_Nmm = Fe_m * 0.006895; // psi to MPa
  const Fe_s_Nmm = Fe_s * 0.006895;

  // Mode Im
  const Z_Im = D_f * lm * Fe_m_Nmm / 1000; // kN
  // Mode Is
  const Z_Is = D_f * ls * Fe_s_Nmm / 1000;
  // Mode II
  const k1_denom = Re + 2 * Re * Re * (1 + Rt + Rt * Rt) + Rt * Rt * Re * Re * Re;
  const k1 = (Math.sqrt(k1_denom) - Re * (1 + Rt)) / (1 + Re);
  const Z_II = k1 * D_f * ls * Fe_s_Nmm / 1000;
  // Mode IIIm
  const k2_inner = 2 * (1 + Re) + 2 * My * (1 + 2 * Re) / (D_f * D_f * lm * lm * Fe_m_Nmm);
  const k2 = -1 + Math.sqrt(k2_inner);
  const Z_IIIm = k2 * D_f * lm * Fe_m_Nmm / (1000 * (1 + 2 * Re));
  // Mode IIIs
  const k3_inner = 2 * (1 + Re) / Re + 2 * My * (2 + Re) / (D_f * D_f * ls * ls * Fe_s_Nmm * Re);
  const k3 = -1 + Math.sqrt(k3_inner);
  const Z_IIIs = k3 * D_f * ls * Fe_s_Nmm / (1000 * (2 + Re));
  // Mode IV
  const Z_IV = Math.sqrt(2 * Fe_m_Nmm * My / (3 * (1 + Re))) * D_f / (1000 * D_f); // Simplified
  const Z_IV_correct = (2 / (3 * (1 + Re))) * Math.sqrt(2 * My * Fe_m_Nmm * D_f + 0) / 1000;

  const modes = [
    { mode: 'Mode Im', Z: Z_Im },
    { mode: 'Mode Is', Z: Z_Is },
    { mode: 'Mode II', Z: isFinite(Z_II) ? Z_II : Infinity },
    { mode: 'Mode IIIm', Z: isFinite(Z_IIIm) ? Z_IIIm : Infinity },
    { mode: 'Mode IIIs', Z: isFinite(Z_IIIs) ? Z_IIIs : Infinity },
    { mode: 'Mode IV', Z: isFinite(Z_IV_correct) ? Z_IV_correct : Infinity },
  ];

  const governing = modes.reduce((min, m) => m.Z > 0 && m.Z < min.Z ? m : min, modes[0]);
  const Z_ref = governing.Z;

  // Reduction factor Rd = 4Kθ (NDS Table 12.3.1B) — Kθ = 1 + 0.25(θ/90)
  const Ktheta = 1 + 0.25 * (loadAngle / 90);
  const Rd = 4 * Ktheta;
  const Z_per_bolt = Z_ref / Rd;

  // Group action factor Cg (NDS Sec. 12.3.7 — simplified)
  const Cg = n <= 2 ? 1.0 : n <= 4 ? 0.97 : n <= 7 ? 0.92 : 0.88;

  // Geometry factor CΔ (NDS Sec. 12.5.1)
  const minEdge = 4 * D_f;
  const minEnd = 7 * D_f;
  const CΔ = Math.min(1.0,
    (input.edgeDistance ?? minEdge) / minEdge,
    (input.endDistance ?? minEnd) / minEnd
  );

  const Z_adjusted = Z_per_bolt * n * Cg * CΔ;

  return {
    Z_reference: Math.round(Z_per_bolt * 100) / 100,
    Z_adjusted: Math.round(Z_adjusted * 100) / 100,
    governingMode: governing.mode,
    groupAction: Cg,
    geometryFactor: Math.round(CΔ * 1000) / 1000,
    status: load <= Z_adjusted ? 'PASS' : 'FAIL',
    designCode: 'NDS',
    clause: 'NDS 2018 Sec. 12.3.1, Table 12.3.1B',
  };
}

// ============================================================================
// LOAD DURATION FACTORS (NDS Table 2.3.2)
// ============================================================================

export const LOAD_DURATION_FACTORS: Record<string, { CD: number; description: string }> = {
  permanent: { CD: 0.9, description: 'Dead load only' },
  long_term: { CD: 1.0, description: 'Occupancy live load (10 years)' },
  medium_term: { CD: 1.15, description: 'Snow load (2 months)' },
  short_term: { CD: 1.25, description: 'Construction load (7 days)' },
  instantaneous: { CD: 1.6, description: 'Wind/seismic (10 minutes)' },
};

// kmod values (EN 1995)
export const KMOD_VALUES: Record<string, Record<string, number>> = {
  'solid_timber': {
    permanent: 0.6,
    long_term: 0.7,
    medium_term: 0.8,
    short_term: 0.9,
    instantaneous: 1.1,
  },
  'glulam': {
    permanent: 0.6,
    long_term: 0.7,
    medium_term: 0.8,
    short_term: 0.9,
    instantaneous: 1.1,
  },
  'clt': {
    permanent: 0.6,
    long_term: 0.7,
    medium_term: 0.8,
    short_term: 0.9,
    instantaneous: 1.1,
  },
};
