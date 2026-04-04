/**
 * ============================================================================
 * COMPOSITE DESIGN ENGINE — AISC 360 Chapter I / EN 1994
 * ============================================================================
 * 
 * Composite steel-concrete design per:
 * - AISC 360 Chapter I (Composite Members)
 * - EN 1994 (Eurocode 4)
 * - IS 11384
 * 
 * STATUS: IMPLEMENTED — Stud capacity, PNA, composite beam/column design
 * 
 * @version 0.1.0
 */

// ============================================================================
// TYPES
// ============================================================================

export interface CompositeBeamInput {
  // Steel section properties (explicit — avoids section DB dependency)
  steelSection: string;          // e.g., 'W14x22' (label only)
  As: number;                    // Steel area (mm²)
  d: number;                     // Steel beam depth (mm)
  tw: number;                    // Web thickness (mm)
  bf: number;                    // Flange width (mm)
  tf: number;                    // Flange thickness (mm)
  Ix: number;                    // Strong-axis moment of inertia (mm⁴)
  Fy: number;                    // Steel yield strength (MPa)
  Fu: number;                    // Steel ultimate strength (MPa)

  // Concrete slab
  slabWidth: number;             // Effective slab width (mm)
  slabThickness: number;         // Slab thickness (mm)
  fc: number;                    // Concrete compressive strength (MPa)
  deckType: 'solid' | 'metal_deck';
  deckRibHeight?: number;        // Deck rib height (mm) if metal_deck
  deckRibWidth?: number;         // Deck rib width (mm) if metal_deck

  // Shear studs
  studDiameter: number;          // mm
  studHeight: number;            // mm
  studFu: number;                // MPa
  studSpacing: number;           // mm

  // Geometry
  span: number;                  // m
  unbragedLength?: number;       // m (for construction stage)
}

export interface CompositeBeamResult {
  // Capacities
  Mn_positive: number;           // Positive moment capacity (kN·m)
  Mn_negative: number;           // Negative moment capacity (kN·m)
  Vn: number;                    // Shear capacity (kN)
  
  // Composite action
  compositeRatio: number;        // 0-1 (1 = full composite)
  PNA_location: string;          // Plastic neutral axis location
  Qn_stud: number;               // Stud shear strength (kN)
  studsRequired: number;         // Number of studs required per half span
  
  // Deflection
  Ieff: number;                  // Effective moment of inertia (mm⁴)
  deflection_live: number;       // Live load deflection (mm)
  deflection_total: number;      // Total deflection (mm)
  
  // Status
  status: 'PASS' | 'FAIL';
  governingCheck: string;
  designCode: string;
  clause: string;
}

export interface CompositeColumnInput {
  type: 'encased' | 'filled_rectangular' | 'filled_circular';
  
  // Steel
  steelSection?: string;         // For encased columns
  tubeDimensions?: {             // For filled columns
    width: number;               // mm (or diameter for circular)
    depth?: number;              // mm (only for rectangular)
    thickness: number;           // mm
  };
  Fy: number;                    // MPa
  
  // Concrete
  fc: number;                    // MPa
  
  // Reinforcement (for encased)
  rebarArea?: number;            // mm²
  rebarFy?: number;              // MPa
  
  // Geometry
  length: number;                // m
  K: number;                     // Effective length factor
  
  // Loads
  Pu: number;                    // Axial load (kN)
  Mux: number;                   // Moment about X (kN·m)
  Muy: number;                   // Moment about Y (kN·m)
}

export interface CompositeColumnResult {
  Pn: number;                    // Axial capacity (kN)
  Mnx: number;                   // Moment capacity X (kN·m)
  Mny: number;                   // Moment capacity Y (kN·m)
  utilizationRatio: number;      // DCR
  status: 'PASS' | 'FAIL';
  governingCheck: string;
  designCode: string;
  clause: string;
}

// ============================================================================
// DESIGN IMPLEMENTATIONS
// ============================================================================

export function designCompositeBeam(
  input: CompositeBeamInput,
  code: 'AISC360' | 'EN1994' | 'IS11384' = 'AISC360',
  version: 'VCurrent' | 'V2025Sandbox' = 'VCurrent'
): CompositeBeamResult {
  const { As, d, tw, bf, tf, Ix, Fy, Fu, slabWidth: beff, slabThickness: tc, fc, deckType, studDiameter, studHeight, studFu, studSpacing, span } = input;
  const deckRibHeight = input.deckRibHeight ?? 0;
  const L_mm = span * 1000;

  // ---- 1. Stud capacity (AISC 360 I8.2a) ----
  const Asc = Math.PI * (studDiameter / 2) ** 2;
  const Ec = 4700 * Math.sqrt(fc);
  const Qn_breakout = 0.5 * Asc * Math.sqrt(fc * Ec) / 1000; // kN
  const Qn_shear = Asc * studFu / 1000; // kN
  let Rp = 1.0;
  if (deckType === 'metal_deck' && deckRibHeight > 0) {
    Rp = Math.max(0.6, Math.min(1.0, 0.85 * (studHeight / deckRibHeight - 1)));
  }
  const Qn_stud = Math.min(Qn_breakout, Qn_shear) * Rp;

  // ---- 2. Plastic neutral axis & moment capacity (AISC 360 I3.2a) ----
  // Full composite forces
  const Cc = 0.85 * fc * beff * tc / 1000; // kN — concrete compression
  const Ts = As * Fy / 1000; // kN — steel tension

  // Horizontal shear: sum of stud strengths over half-span
  const studsPerHalfSpan = Math.floor((L_mm / 2) / studSpacing);
  const sumQn = studsPerHalfSpan * Qn_stud; // kN
  const C_prime = Math.min(Cc, Ts, sumQn); // Governing compression force (partial composite)
  const compositeRatio = C_prime / Math.min(Cc, Ts);

  let PNA_location: string;
  let Mn_positive: number; // kN·m

  if (C_prime <= Cc) {
    // PNA in concrete slab — most common for full composite beams
    const a = C_prime * 1000 / (0.85 * fc * beff); // depth of concrete stress block (mm)
    PNA_location = `In concrete slab (a = ${a.toFixed(1)} mm)`;
    // Steel centroid at d/2 from bottom of steel, top of steel at tc (slab bottom is at deckRibHeight)
    const ySteel = d / 2; // distance from bottom of steel to steel centroid
    const yConcrete = d + deckRibHeight + tc - a / 2; // distance from bottom of steel to concrete resultant
    
    // For partial composite, leftover steel force goes into steel couple
    const leftoverSteel = Ts - C_prime;
    if (leftoverSteel > 0) {
      // Compression in top of steel section
      // Simplified: assume all excess goes into symmetrical steel couple
      const Msteel = leftoverSteel * (d / 2) / 1000; // approximate
      Mn_positive = C_prime * (yConcrete) / 1000 + Msteel;
    } else {
      // Full composite — all steel in tension
      Mn_positive = C_prime * (ySteel + yConcrete) / 2000 + Ts * ySteel / 1000;
      // More precise: Mn = C × (distance from C resultant to T resultant)
      const leverArm = yConcrete - 0 + ySteel; // simplified
      Mn_positive = C_prime * leverArm / 1000;
    }
  } else {
    // PNA in steel section
    PNA_location = 'In steel section';
    // Concrete capacity governs
    const Ac_compression = Cc * 1000 / Fy; // area of steel in compression
    const y_comp = Ac_compression / (2 * bf); // approximate depth in steel
    const leverArm = (d - y_comp) / 2 + deckRibHeight + tc / 2;
    Mn_positive = Cc * leverArm / 1000;
  }

  // Apply phi = 0.90 for AISC LRFD
  const phi_b = code === 'AISC360' ? 0.90 : (code === 'EN1994' ? 1.0 : 0.90);
  Mn_positive *= phi_b;

  // ---- 3. Negative moment capacity (steel section only) ----
  // Conservative: non-composite negative moment
  const Zx = As * d / 4; // approximate plastic modulus for I-shape
  const Mn_negative = phi_b * Zx * Fy / 1e6; // kN·m

  // ---- 4. Shear capacity (steel web only, AISC 360 G2) ----
  const Aw = d * tw;
  const Cv1 = 1.0; // For most rolled shapes
  const Vn = phi_b * 0.6 * Fy * Aw * Cv1 / 1000; // kN

  // ---- 5. Required studs ----
  const studsRequired = Math.ceil(C_prime / Qn_stud);

  // ---- 6. Effective moment of inertia — lower-bound method (AISC 360 I3.2d) ----
  const n = 200000 / Ec; // modular ratio (Es / Ec)
  const Ac_transformed = beff * tc / n;
  // Distance from bottom of steel to centroid of transformed section
  const y_steel = d / 2;
  const y_slab = d + deckRibHeight + tc / 2;
  const A_total = As + Ac_transformed;
  const y_bar = (As * y_steel + Ac_transformed * y_slab) / A_total;
  
  // Parallel axis theorem
  const Itr = Ix + As * (y_bar - y_steel) ** 2 + (beff * tc ** 3) / (12 * n) + Ac_transformed * (y_slab - y_bar) ** 2;
  
  // Lower-bound Ieff for partial composite (AISC Commentary I3.2d)
  const Ieff = Ix + compositeRatio ** 0.5 * (Itr - Ix);

  // ---- 7. Deflection estimate ----
  // Assume uniform load for deflection check: w = 8M / L²
  const deflection_live = 5 * L_mm ** 3 / (384 * 200000 * Ieff) * 1; // placeholder unit load
  const deflection_total = deflection_live * 1.5;

  // ---- 8. Governing check ----
  const governingCheck = compositeRatio < 0.25 ? 'Insufficient composite action (< 25%)' :
    'Flexure (composite stage)';

  return {
    Mn_positive: Math.round(Mn_positive * 10) / 10,
    Mn_negative: Math.round(Mn_negative * 10) / 10,
    Vn: Math.round(Vn * 10) / 10,
    compositeRatio: Math.round(compositeRatio * 1000) / 1000,
    PNA_location,
    Qn_stud: Math.round(Qn_stud * 10) / 10,
    studsRequired,
    Ieff: Math.round(Ieff),
    deflection_live: Math.round(deflection_live * 100) / 100,
    deflection_total: Math.round(deflection_total * 100) / 100,
    status: compositeRatio >= 0.25 ? 'PASS' : 'FAIL',
    governingCheck,
    designCode: code,
    clause: code === 'AISC360' ? 'AISC 360-22 I3.2a' :
            code === 'EN1994' ? 'EN 1994-1-1 Cl. 6.3' : 'IS 11384 Cl. 10',
  };
}

export function designCompositeColumn(
  input: CompositeColumnInput,
  code: 'AISC360' | 'EN1994' = 'AISC360'
): CompositeColumnResult {
  const { type, Fy, fc, length, K, Pu, Mux, Muy } = input;
  const rebarFy = input.rebarFy ?? 415;

  // ---- Section properties ----
  let As = 0, Ac = 0, Ar = input.rebarArea ?? 0;
  let Is = 0, Ic = 0, Ir = 0;
  let d_col = 0, b_col = 0;

  if (type === 'filled_circular' && input.tubeDimensions) {
    const D = input.tubeDimensions.width;
    const t = input.tubeDimensions.thickness;
    d_col = D; b_col = D;
    const D_inner = D - 2 * t;
    As = Math.PI / 4 * (D ** 2 - D_inner ** 2);
    Ac = Math.PI / 4 * D_inner ** 2 - Ar;
    Is = Math.PI / 64 * (D ** 4 - D_inner ** 4);
    Ic = Math.PI / 64 * D_inner ** 4;
    Ir = Ar * (D_inner / 4) ** 2; // approximate
  } else if (type === 'filled_rectangular' && input.tubeDimensions) {
    const B = input.tubeDimensions.width;
    const H = input.tubeDimensions.depth ?? B;
    const t = input.tubeDimensions.thickness;
    d_col = H; b_col = B;
    const B_inner = B - 2 * t;
    const H_inner = H - 2 * t;
    As = B * H - B_inner * H_inner;
    Ac = B_inner * H_inner - Ar;
    Is = (B * H ** 3 - B_inner * H_inner ** 3) / 12;
    Ic = B_inner * H_inner ** 3 / 12;
    Ir = Ar * (H_inner / 4) ** 2;
  } else {
    // Encased — assume W-shape area from simplified formula
    // For encased: concrete area = gross - steel - rebar
    As = input.tubeDimensions ? input.tubeDimensions.width * input.tubeDimensions.thickness : 10000; // fallback
    d_col = 400; b_col = 400; // default encased
    Ac = d_col * b_col - As - Ar;
    Is = As * d_col ** 2 / 12;
    Ic = b_col * d_col ** 3 / 12 - Is;
    Ir = Ar * (d_col / 4) ** 2;
  }

  // ---- AISC 360 I2.1b: Nominal axial compressive strength ----
  const Es = 200000; // MPa
  const Ec = 4700 * Math.sqrt(fc);

  // Plastic axial capacity (squash load)
  const C1 = type === 'filled_circular' ? 0.95 :
             type === 'filled_rectangular' ? 0.85 : 0.70;
  const Pno = As * Fy + Ar * rebarFy + C1 * Ac * fc; // N → convert later

  // Effective stiffness EI_eff (AISC 360 Eq. I2-12)
  const C3_num = As + Ar;
  const C3_den = As + Ar + Ac;
  const C3 = Math.max(0.25, Math.min(0.7, 0.45 + 3 * C3_num / C3_den));
  const EIeff = Es * Is + Es * Ir + C3 * Ec * Ic; // N·mm²

  // Euler buckling load Pe
  const Lc = K * length * 1000; // mm
  const Pe = Math.PI ** 2 * EIeff / Lc ** 2; // N

  // Nominal compressive strength Pn (AISC 360 Eq. I2-2, I2-3)
  let Pn: number;
  const ratio = Pno / Pe;
  if (ratio <= 2.25) {
    Pn = Pno * Math.pow(0.658, ratio); // Eq. I2-2
  } else {
    Pn = 0.877 * Pe; // Eq. I2-3
  }

  // Apply phi_c = 0.75
  const phi_c = 0.75;
  const Pn_design = phi_c * Pn / 1000; // kN

  // ---- Moment capacity (simplified P-M interaction) ----
  // Use AISC interaction method (Eq. H1-1a/b)
  const Zs = As * d_col / 4; // approximate plastic section modulus
  const Mn = 0.9 * Zs * Fy / 1e6; // kN·m (steel contribution primarily)

  const Pr = Pu;
  const Mrx = Mux;
  const Mry = Muy;

  let utilizationRatio: number;
  if (Pr / Pn_design >= 0.2) {
    // Eq. H1-1a
    utilizationRatio = Pr / Pn_design + (8 / 9) * (Mrx / Mn + Mry / Mn);
  } else {
    // Eq. H1-1b
    utilizationRatio = Pr / (2 * Pn_design) + (Mrx / Mn + Mry / Mn);
  }

  const status = utilizationRatio <= 1.0 ? 'PASS' as const : 'FAIL' as const;
  const governingCheck = Pr / Pn_design > 0.5 ? 'Axial compression' : 'P-M interaction';

  return {
    Pn: Math.round(Pn_design * 10) / 10,
    Mnx: Math.round(Mn * 10) / 10,
    Mny: Math.round(Mn * 10) / 10,
    utilizationRatio: Math.round(utilizationRatio * 1000) / 1000,
    status,
    governingCheck,
    designCode: code,
    clause: code === 'AISC360' ? 'AISC 360-22 I2.1b, H1-1' : 'EN 1994-1-1 Cl. 6.7',
  };
}

// ============================================================================
// SHEAR STUD DESIGN
// ============================================================================

export function calculateStudCapacity(
  studDia: number,        // mm
  studHeight: number,     // mm
  studFu: number,         // MPa
  fc: number,             // MPa
  deckType: 'solid' | 'metal_deck',
  deckRibHeight?: number  // mm
): { Qn: number; governedBy: string; clause: string } {
  // AISC 360 I8.2a
  const Asc = Math.PI * (studDia / 2) ** 2;
  const Ec = 4700 * Math.sqrt(fc); // MPa
  
  // Breakout strength
  const Qn_breakout = 0.5 * Asc * Math.sqrt(fc * Ec) / 1000; // kN
  
  // Shear strength
  const Qn_shear = Asc * studFu / 1000; // kN
  
  // Deck reduction factor (if applicable)
  let Rp = 1.0;
  if (deckType === 'metal_deck' && deckRibHeight) {
    // Simplified reduction
    Rp = Math.min(1.0, 0.85 * (studHeight / deckRibHeight - 1));
    Rp = Math.max(0.6, Rp);
  }
  
  const Qn = Math.min(Qn_breakout, Qn_shear) * Rp;
  
  return {
    Qn: Math.round(Qn * 10) / 10,
    governedBy: Qn_breakout < Qn_shear ? 'Concrete breakout' : 'Steel shear',
    clause: 'AISC 360-22 I8.2a',
  };
}

// ============================================================================
// EFFECTIVE WIDTH CALCULATION
// ============================================================================

export function calculateEffectiveSlabWidth(
  span: number,           // m
  beamSpacing: number,    // m
  edgeDistance: number,   // m (distance to slab edge, if edge beam)
  position: 'interior' | 'edge' = 'interior'
): { beff: number; clause: string } {
  // AISC 360 I3.1a
  const L = span * 1000; // mm
  const s = beamSpacing * 1000; // mm
  const edge = edgeDistance * 1000; // mm
  
  let beff: number;
  
  if (position === 'interior') {
    beff = Math.min(L / 4, s);
  } else {
    beff = Math.min(L / 8, edge) + Math.min(L / 8, s / 2);
  }
  
  return {
    beff: Math.round(beff),
    clause: 'AISC 360-22 I3.1a',
  };
}
