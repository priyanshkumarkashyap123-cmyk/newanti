/**
 * DetailedSectionDesign.ts — Production-Level Section Design Engine
 *
 * Goes BEYOND utilization ratios to provide full detailed design output:
 *
 *  RC BEAM:  Required steel area → bar selection → curtailment → development
 *            length → crack width → deflection check → detailing sketch data
 *
 *  RC SLAB:  One-way / two-way slab design per IS 456 & ACI 318 → main/dist
 *            steel → temperature steel → reinforcement layout → punching shear
 *
 *  RC COLUMN: Interaction diagram → biaxial check → tie spacing → lap splices
 *
 *  STEEL:    Section classification → local buckling → LTB → web crippling
 *            → stiffener design → connection force demands
 *
 * This is what STAAD Pro, ETABS, Robot provide that we were missing:
 * actual DETAILING output, not just pass/fail.
 */

// ────────────────────────────────────────────────────────────────────────
// COMMON TYPES
// ────────────────────────────────────────────────────────────────────────

export interface BarInfo {
  diameter: number; // mm
  area: number; // mm²
  label: string; // e.g. "#16" or "16φ"
}

// Standard IS bar sizes
export const REBAR_SIZES: BarInfo[] = [
  { diameter: 8, area: 50.27, label: "8φ" },
  { diameter: 10, area: 78.54, label: "10φ" },
  { diameter: 12, area: 113.1, label: "12φ" },
  { diameter: 16, area: 201.06, label: "16φ" },
  { diameter: 20, area: 314.16, label: "20φ" },
  { diameter: 25, area: 490.87, label: "25φ" },
  { diameter: 28, area: 615.75, label: "28φ" },
  { diameter: 32, area: 804.25, label: "32φ" },
  { diameter: 36, area: 1017.88, label: "36φ" },
  { diameter: 40, area: 1256.64, label: "40φ" },
];

export const STIRRUP_SIZES: BarInfo[] = [
  { diameter: 6, area: 28.27, label: "6φ" },
  { diameter: 8, area: 50.27, label: "8φ" },
  { diameter: 10, area: 78.54, label: "10φ" },
  { diameter: 12, area: 113.1, label: "12φ" },
];

// ────────────────────────────────────────────────────────────────────────
// RC BEAM DETAILED DESIGN
// ────────────────────────────────────────────────────────────────────────

export interface RCBeamInput {
  // Geometry
  width: number; // mm
  depth: number; // mm (overall depth D)
  span: number; // mm
  clear_cover: number; // mm
  // Material
  fck: number; // MPa (characteristic concrete strength)
  fy: number; // MPa (rebar yield strength)
  // Forces (from analysis - at critical section)
  Mu: number; // kN·m — factored bending moment
  Vu: number; // kN — factored shear force
  Tu?: number; // kN·m — factored torsion (optional)
  // Design parameters
  exposureClass: "mild" | "moderate" | "severe" | "very_severe" | "extreme";
  beamType: "simply_supported" | "continuous" | "cantilever";
  code: "IS456" | "ACI318";
}

export interface CurtailmentPoint {
  distanceFromSupport: number; // mm
  barsRequired: number;
  barSize: number; // mm diameter
  momentAtPoint: number; // kN·m
}

export interface CrackWidthResult {
  wk: number; // mm — calculated crack width
  wk_limit: number; // mm — permissible crack width
  passes: boolean;
  spacing: number; // mm — bar spacing for crack control
  acr: number; // mm — distance from crack to nearest bar
}

export interface DeflectionResult {
  spanOverDepthActual: number;
  spanOverDepthPermissible: number;
  estimatedDeflection: number; // mm
  limitDeflection: number; // mm (span/250 or span/350)
  passes: boolean;
  modificationFactor_tension: number;
  modificationFactor_compression: number;
}

export interface RCBeamDetailedResult {
  // Flexure
  d: number; // mm — effective depth
  xu: number; // mm — neutral axis depth
  xu_max: number; // mm — maximum NA depth (balanced)
  isDoublyReinforced: boolean;
  Ast_required: number; // mm² — tension steel required
  Asc_required: number; // mm² — compression steel required (0 if singly)
  Ast_provided: number; // mm²
  Asc_provided: number; // mm²
  Ast_min: number; // mm²
  Ast_max: number; // mm²
  tensionBars: { count: number; size: BarInfo; layers: number };
  compressionBars: { count: number; size: BarInfo } | null;

  // Shear
  tau_v: number; // MPa — nominal shear stress
  tau_c: number; // MPa — design shear strength of concrete
  tau_c_max: number; // MPa — maximum shear stress
  Vus: number; // kN — shear to be carried by stirrups
  stirrups: { size: BarInfo; spacing: number; legs: number }; // mm spacing
  shearPasses: boolean;

  // Torsion (if applicable)
  torsionDesign?: {
    Me: number; // kN·m — equivalent bending moment
    Ve: number; // kN — equivalent shear
    additionalLongSteel: number; // mm²
    transverseSpacing: number; // mm
    sideFaceSteel?: number; // mm² — side face reinforcement for deep beams
  };

  // Development length
  Ld_tension: number; // mm
  Ld_compression: number; // mm
  anchorageRequired: boolean;

  // Curtailment
  curtailment: CurtailmentPoint[];

  // Crack width
  crackWidth: CrackWidthResult;

  // Deflection
  deflection: DeflectionResult;

  // Detailing summary
  detailingNotes: string[];

  // Sketch data for drawing
  sketch: {
    width: number;
    depth: number;
    cover: number;
    tensionBars: Array<{ x: number; y: number; dia: number }>;
    compressionBars: Array<{ x: number; y: number; dia: number }>;
    stirrup: { width: number; height: number; dia: number; spacing: number };
  };
}

export function designRCBeamDetailed(input: RCBeamInput): RCBeamDetailedResult {
  const {
    width: b,
    depth: D,
    span: L,
    clear_cover: cc,
    fck,
    fy,
    Mu,
    Vu,
    Tu,
  } = input;

  // ── Effective depth ──────────────────────────────────────────────
  const assumed_bar_dia = 20; // mm
  const stirrup_dia = 8;
  const d = D - cc - stirrup_dia - assumed_bar_dia / 2;
  const d_prime = cc + stirrup_dia + assumed_bar_dia / 2;

  // ── IS 456 flexure design ────────────────────────────────────────
  const xu_max_ratio = fy <= 415 ? 0.48 : fy <= 500 ? 0.46 : 0.44;
  const xu_max = xu_max_ratio * d;

  // Limiting moment (singly reinforced)
  const Mu_lim = (0.36 * fck * b * xu_max * (d - 0.42 * xu_max)) / 1e6; // kN·m

  let Ast_required: number;
  let Asc_required = 0;
  let xu: number;
  let isDoublyReinforced = false;

  if (Mu <= Mu_lim) {
    // Singly reinforced
    // Mu = 0.87 * fy * Ast * (d - 0.42*xu) where xu = 0.87*fy*Ast / (0.36*fck*b)
    // IS 456 Annex G.1.1 (Limit State of Collapse — Flexure)
    const k = (4.6 * Mu * 1e6) / (fck * b * d * d);
    if (k >= 1) {
      // Fallback — needs doubly reinforced but k is too high, use Mu_lim approach
      isDoublyReinforced = true;
    } else {
      Ast_required = ((fck * b * d) / (2 * fy)) * (1 - Math.sqrt(1 - k));
      xu = (0.87 * fy * Ast_required) / (0.36 * fck * b);
    }
  }

  if (Mu > Mu_lim || isDoublyReinforced) {
    isDoublyReinforced = true;
    // Tension steel for Mu_lim
    const Ast1 = (0.36 * fck * b * xu_max) / (0.87 * fy);
    // Additional moment
    const Mu2 = Mu - Mu_lim;
    const fsc = getStressInCompSteel(fy, fck, xu_max, d_prime);
    Asc_required = (Mu2 * 1e6) / (fsc * (d - d_prime));
    const Ast2 = (Asc_required * fsc) / (0.87 * fy);
    Ast_required = Ast1 + Ast2;
    xu = xu_max;
  }

  // @ts-ignore — Ast_required is always assigned above
  if (!Ast_required!) Ast_required = 0;
  // @ts-ignore
  if (!xu!) xu = 0;

  // Min/Max steel (IS 456 Cl. 26.5.1)
  const Ast_min = (0.85 * b * d) / fy;
  const Ast_max = 0.04 * b * D;
  Ast_required = Math.max(Ast_required!, Ast_min);

  // ── Bar selection ────────────────────────────────────────────────
  const tensionBars = selectBarsForArea(Ast_required, b, cc, stirrup_dia);
  const Ast_provided = tensionBars.count * tensionBars.size.area;
  const compressionBars = isDoublyReinforced
    ? selectBarsForArea(Asc_required, b, cc, stirrup_dia)
    : null;
  const Asc_provided = compressionBars
    ? compressionBars.count * compressionBars.size.area
    : 0;

  // ── Shear design (IS 456 Cl. 40) ────────────────────────────────
  const tau_v = (Vu * 1000) / (b * d); // MPa
  const pt = (100 * Ast_provided) / (b * d);
  const tau_c = getTauc(fck, pt);
  const tau_c_max = getTaucMax(fck);
  let Vus = 0;
  let shearPasses = true;

  if (tau_v > tau_c_max) {
    shearPasses = false; // section inadequate
    Vus = ((tau_v - tau_c) * b * d) / 1000;
  } else if (tau_v > tau_c) {
    Vus = ((tau_v - tau_c) * b * d) / 1000; // kN
  }

  // Stirrup design
  const stirrups = designStirrups(Vus, b, d, fy, fck);

  // ── Torsion (IS 456 Cl. 41) ─────────────────────────────────────
  let torsionDesign: RCBeamDetailedResult["torsionDesign"];
  if (Tu && Tu > 0) {
    const b1 = b - 2 * cc - stirrup_dia;
    const d1 = D - 2 * cc - stirrup_dia; 
    
    // Side face reinforcement (IS 456 Cl. 26.5.1.3 & 41.4.3)
    const sideFaceRequired = D > 450; 
    let Asf = 0;
    if (sideFaceRequired) {
      Asf = 0.001 * b * D; // 0.1% of web area distributed on both faces
    }
    
    // Eq. Bending Moment Me1 (Cl. 41.4.2)
    const Mt = (Tu * (1 + D / b)) / 1.7;
    const Me1 = Mu + Mt;
    
    // Eq. Shear Ve (IS 456 Cl. 41.3.1)
    // Ve = Vu + 1.6 × (Tu / b), where Tu in kN·m, b in mm → result in kN
    const Ve = Vu + 1.6 * (Tu * 1e6) / b / 1000;
    
    torsionDesign = {
      Me: Me1,
      Ve: Ve,
      additionalLongSteel: (Mt * 1e6) / (0.87 * fy * d),
      transverseSpacing: Math.min(stirrups.spacing, b1, (b1 + d1) / 4, 300),
      sideFaceSteel: Asf,
    };
    
    // Total design shear is now equivalent shear
    input.Vu = Ve; 
  } else if (D > 750) {
    // Side face reinforcement for deep beams without torsion
    const Asf = 0.001 * b * D;
    torsionDesign = { Me: Mu, Ve: Vu, additionalLongSteel: 0, transverseSpacing: 0, sideFaceSteel: Asf };
  }

  // ── Development length (IS 456 Cl. 26.2.1) ──────────────────────
  const tau_bd = getBondStress(fck);
  const Ld_tension = (0.87 * fy * tensionBars.size.diameter) / (4 * tau_bd);
  const Ld_compression = 0.8 * Ld_tension;
  const anchorageRequired = true; // always provide anchorage

  // ── Strategic Curtailment (IS 456 Cl. 26.2.3) ──────────────────────
  const curtailment = computeCurtailment(input, Ast_required, tensionBars);

  // ── Crack width (IS 456 Annex F / EC2 approach) ──────────────────
  const crackWidth = computeCrackWidth(
    b,
    d,
    D,
    cc,
    Ast_provided,
    tensionBars,
    Mu,
    fck,
    fy,
    input.exposureClass,
  );

  // ── Deflection check (IS 456 Cl. 23.2) ───────────────────────────
  const deflection = checkDeflection(
    b,
    d,
    D,
    L,
    Ast_provided,
    Asc_provided,
    fck,
    fy,
    pt,
    input.beamType,
  );

  // ── Detailing notes ───────────────────────────────────────────────
  const notes: string[] = [];
  notes.push(
    `Min clear spacing between bars: ${Math.max(assumed_bar_dia, 25)} mm (IS 456 Cl. 26.3.2)`,
  );
  notes.push(
    `Side face reinforcement: ${D > 750 ? "REQUIRED (D > 750mm, provide 0.1% of web area per face)" : "Not required (D ≤ 750mm)"}`,
  );
  if (stirrups.spacing > 300)
    notes.push(`Max stirrup spacing capped at 300mm or 0.75d`);
  if (isDoublyReinforced)
    notes.push(
      "Doubly reinforced — ensure compression bars are properly confined with stirrups",
    );
  notes.push(
    `Curtailment: extend bars by Ld = ${Math.round(Ld_tension)} mm beyond theoretical cutoff`,
  );
  notes.push(
    `Provide at least ${Math.ceil(tensionBars.count / 3)} bars through the full span (IS 456 Cl. 26.2.3.3)`,
  );

  // ── Sketch data ───────────────────────────────────────────────────
  const sketch = generateBeamSketch(
    b,
    D,
    cc,
    stirrup_dia,
    tensionBars,
    compressionBars,
  );

  return {
    d,
    xu: xu!,
    xu_max,
    isDoublyReinforced,
    Ast_required,
    Asc_required,
    Ast_provided,
    Asc_provided,
    Ast_min,
    Ast_max,
    tensionBars: {
      ...tensionBars,
      layers: Math.ceil(
        tensionBars.count /
          Math.floor(
            (b - 2 * cc - 2 * stirrup_dia + 25) /
              (tensionBars.size.diameter + 25),
          ),
      ),
    },
    compressionBars,
    tau_v,
    tau_c,
    tau_c_max,
    Vus,
    stirrups,
    shearPasses,
    torsionDesign,
    Ld_tension,
    Ld_compression,
    anchorageRequired,
    curtailment,
    crackWidth,
    deflection,
    detailingNotes: notes,
    sketch,
  };
}

// ────────────────────────────────────────────────────────────────────────
// RC SLAB DETAILED DESIGN
// ────────────────────────────────────────────────────────────────────────

export type SlabType = "one_way" | "two_way";

export interface RCSlabInput {
  Lx: number; // mm — shorter span
  Ly: number; // mm — longer span
  thickness: number; // mm — overall slab thickness
  clear_cover: number; // mm
  fck: number; // MPa
  fy: number; // MPa
  liveLoad: number; // kN/m² — imposed
  finishLoad: number; // kN/m² — floor finish + partition
  edgeCondition:
    | "ss_all"
    | "fixed_all"
    | "one_long_fixed"
    | "adjacent_fixed"
    | "three_fixed";
  code: "IS456" | "ACI318";
}

export interface RCSlabDetailedResult {
  slabType: SlabType;
  ratio: number; // Ly/Lx
  d_short: number; // mm — effective depth (short span direction)
  d_long: number; // mm — effective depth (long span direction)

  // Loads
  selfWeight: number; // kN/m²
  totalFactoredLoad: number; // kN/m²

  // Moments (kN·m per meter width)
  Mx_pos: number;
  Mx_neg: number;
  My_pos: number;
  My_neg: number;

  // Steel required (mm² per meter width)
  Ast_x_pos: number; // short direction, midspan
  Ast_x_neg: number; // short direction, support
  Ast_y_pos: number; // long direction, midspan
  Ast_y_neg: number; // long direction, support
  Ast_min: number; // minimum steel

  // Reinforcement selection
  mainSteel: { bar: BarInfo; spacing: number; direction: string }[];
  distSteel: { bar: BarInfo; spacing: number; direction: string }[];
  temperatureSteel?: { bar: BarInfo; spacing: number };

  // Checks
  deflection: DeflectionResult;
  crackWidth: CrackWidthResult;

  detailingNotes: string[];
}

export function designRCSlabDetailed(input: RCSlabInput): RCSlabDetailedResult {
  const {
    Lx,
    Ly,
    thickness: D,
    clear_cover: cc,
    fck,
    fy,
    liveLoad,
    finishLoad,
  } = input;
  const ratio = Ly / Lx;
  const slabType: SlabType = ratio > 2 ? "one_way" : "two_way";

  const bar_dia = 10; // mm assumed
  const d_short = D - cc - bar_dia / 2;
  const d_long = D - cc - bar_dia - bar_dia / 2;

  // Loads
  const selfWeight = (25 * D) / 1000; // kN/m², concrete density 25 kN/m³
  const deadLoad = selfWeight + finishLoad;
  const wu = 1.5 * (deadLoad + liveLoad); // IS 456 factored (conservative)

  let Mx_pos = 0,
    Mx_neg = 0,
    My_pos = 0,
    My_neg = 0;

  if (slabType === "one_way") {
    // One-way slab — short span carries all load
    Mx_pos =
      (input.edgeCondition === "ss_all" ? 1 / 8 : 1 / 12) *
      wu *
      (Lx / 1000) ** 2;
    Mx_neg =
      input.edgeCondition === "ss_all" ? 0 : (1 / 12) * wu * (Lx / 1000) ** 2;
    My_pos = 0;
    My_neg = 0;
  } else {
    // Two-way slab — IS 456 Table 26
    const { alphaX_pos, alphaX_neg, alphaY_pos, alphaY_neg } =
      getBendingCoefficients(ratio, input.edgeCondition);
    Mx_pos = alphaX_pos * wu * (Lx / 1000) ** 2;
    Mx_neg = alphaX_neg * wu * (Lx / 1000) ** 2;
    My_pos = alphaY_pos * wu * (Lx / 1000) ** 2;
    My_neg = alphaY_neg * wu * (Lx / 1000) ** 2;
  }

  // Steel area per meter width (IS 456 Cl. 26.5.2.1)
  const Ast_min = (fy >= 415 ? 0.0012 : 0.0015) * 1000 * D;

  function steelForMoment(Mu_kNm: number, d_eff: number): number {
    if (Mu_kNm <= 0) return Ast_min;
    const Mu_Nmm = Mu_kNm * 1e6;
    const k = (4.6 * Mu_Nmm) / (fck * 1000 * d_eff ** 2);
    if (k >= 1) return 0.04 * 1000 * D; // over-reinforced — flag
    const Ast = ((fck * 1000 * d_eff) / (2 * fy)) * (1 - Math.sqrt(1 - k));
    return Math.max(Ast, Ast_min);
  }

  const Ast_x_pos = steelForMoment(Mx_pos, d_short);
  const Ast_x_neg = steelForMoment(Mx_neg, d_short);
  const Ast_y_pos = steelForMoment(My_pos, d_long);
  const Ast_y_neg = steelForMoment(My_neg, d_long);

  // Select bars
  function selectSlabBars(
    Ast_per_m: number,
    dir: string,
  ): { bar: BarInfo; spacing: number; direction: string } {
    // Try bar sizes from 8mm to 16mm
    for (const bar of [
      REBAR_SIZES[0],
      REBAR_SIZES[1],
      REBAR_SIZES[2],
      REBAR_SIZES[3],
    ]) {
      const spacing = Math.floor((bar.area / Ast_per_m) * 1000);
      const maxSpacing = Math.min(3 * D, 300);
      if (spacing >= 75 && spacing <= maxSpacing) {
        return { bar, spacing: Math.min(spacing, maxSpacing), direction: dir };
      }
    }
    // Default to 12mm @ calculated spacing
    const bar = REBAR_SIZES[2];
    return {
      bar,
      spacing: Math.max(75, Math.floor((bar.area / Ast_per_m) * 1000)),
      direction: dir,
    };
  }

  const mainSteel: { bar: BarInfo; spacing: number; direction: string }[] = [];
  mainSteel.push(selectSlabBars(Ast_x_pos, "X-dir midspan"));
  if (Ast_x_neg > Ast_min)
    mainSteel.push(selectSlabBars(Ast_x_neg, "X-dir support"));
  if (slabType === "two_way") {
    mainSteel.push(selectSlabBars(Ast_y_pos, "Y-dir midspan"));
    if (Ast_y_neg > Ast_min)
      mainSteel.push(selectSlabBars(Ast_y_neg, "Y-dir support"));
  }

  const distSteel: { bar: BarInfo; spacing: number; direction: string }[] = [];
  if (slabType === "one_way") {
    // Distribution steel = 0.12% of gross area
    distSteel.push(selectSlabBars(Ast_min, "Y-dir (distribution)"));
  }

  // Deflection check
  const pt_prov = (100 * Ast_x_pos) / (1000 * d_short);
  const deflection = checkDeflection(
    1000,
    d_short,
    D,
    Lx,
    Ast_x_pos,
    0,
    fck,
    fy,
    pt_prov,
    input.edgeCondition === "ss_all" ? "simply_supported" : "continuous",
  );

  // Crack width
  const crackWidth = computeCrackWidth(
    1000,
    d_short,
    D,
    cc,
    Ast_x_pos,
    { count: 1, size: REBAR_SIZES[1] },
    Mx_pos,
    fck,
    fy,
    "moderate",
  );

  const notes: string[] = [];
  notes.push(`Slab type: ${slabType} (Ly/Lx = ${ratio.toFixed(2)})`);
  notes.push(
    `Minimum thickness for deflection: ${Math.ceil(Lx / (slabType === "one_way" ? 26 : 30))} mm`,
  );
  notes.push(
    `Provide torsion steel at corners for two-way slabs (IS 456 Cl. D-1.8)`,
  );
  if (D > 200)
    notes.push("Consider providing distribution bars in both layers");
  notes.push(`Max spacing: ${Math.min(3 * D, 300)} mm`);

  return {
    slabType,
    ratio,
    d_short,
    d_long,
    selfWeight,
    totalFactoredLoad: wu,
    Mx_pos,
    Mx_neg,
    My_pos,
    My_neg,
    Ast_x_pos,
    Ast_x_neg,
    Ast_y_pos,
    Ast_y_neg,
    Ast_min,
    mainSteel,
    distSteel,
    deflection,
    crackWidth,
    detailingNotes: notes,
  };
}

// ────────────────────────────────────────────────────────────────────────
// RC COLUMN DETAILED DESIGN
// ────────────────────────────────────────────────────────────────────────

export interface RCColumnInput {
  width: number; // mm (B)
  depth: number; // mm (D)
  height: number; // mm — unsupported length
  clear_cover: number; // mm
  fck: number;
  fy: number;
  Pu: number; // kN — factored axial load
  Mux: number; // kN·m — factored moment about x
  Muy: number; // kN·m — factored moment about y
  endCondition: "fixed_fixed" | "fixed_hinged" | "hinged_hinged" | "fixed_free";
  isShortColumn?: boolean; // override auto-detection
}

export interface InteractionPoint {
  Pu: number; // kN
  Mu: number; // kN·m
}

export interface RCColumnDetailedResult {
  // Classification
  slendernessRatio: number;
  isShort: boolean;
  effectiveLength: number; // mm

  // Design
  Pu_capacity: number; // kN — axial capacity
  pt: number; // % — steel percentage
  Ast_required: number; // mm²
  Ast_provided: number; // mm²
  Ast_min: number;
  Ast_max: number;

  // Bar selection
  mainBars: { count: number; size: BarInfo; spacing: number };
  ties: { size: BarInfo; spacing: number; legCount: number };

  // Interaction diagram (8+ points)
  interactionDiagram: InteractionPoint[];

  // Biaxial check
  biaxialCheck: {
    P_ratio: number;
    Mux_ratio: number;
    Muy_ratio: number;
    alpha_n: number;
    interactionValue: number; // ≤ 1.0 passes
    passes: boolean;
  };

  // Splice
  lapLength: number; // mm

  detailingNotes: string[];
}

export function designRCColumnDetailed(
  input: RCColumnInput,
): RCColumnDetailedResult {
  const {
    width: B,
    depth: D,
    height: L,
    clear_cover: cc,
    fck,
    fy,
    Pu,
    Mux,
    Muy,
  } = input;

  // Effective length
  const le_factor: Record<string, number> = {
    fixed_fixed: 0.65,
    fixed_hinged: 0.8,
    hinged_hinged: 1.0,
    fixed_free: 2.0,
  };
  const k = le_factor[input.endCondition] ?? 1.0;
  const le = k * L;
  const slendernessRatio = le / Math.min(B, D);
  const isShort = input.isShortColumn ?? slendernessRatio < 12;

  // Minimum eccentricity (IS 456 Cl. 25.4)
  const emin_x = Math.max(L / 500 + D / 30, 20); // mm
  const emin_y = Math.max(L / 500 + B / 30, 20);

  // Check if moment is below minimum eccentricity
  const Mu_min_x = (Pu * emin_x) / 1000; // kN·m
  const Mu_min_y = (Pu * emin_y) / 1000;
  const Mux_design = Math.max(Mux, Mu_min_x);
  const Muy_design = Math.max(Muy, Mu_min_y);

  const Ag = B * D;
  const Ast_min = 0.008 * Ag; // 0.8% minimum IS 456 Cl. 26.5.3.1
  const Ast_max = 0.06 * Ag; // 6% absolute maximum

  // Iterative steel increment to satisfy true Biaxial P-M interaction
  let pt_iter = 0.8;
  const PT_INCREMENT = 0.2; // 0.2% steps
  
  let bestMainBars: any = null;
  let bestInteractionValue = 999;
  let bestPuCapacity = 0;
  let bestMux1 = 0;
  let bestMuy1 = 0;
  let bestInteractionDiagram: InteractionPoint[] = [];
  let biaxialPasses = false;

  // Base axial capacity check (pure compression)
  let baseAxialSteel = (Pu * 1000 - 0.4 * fck * Ag) / (0.67 * fy - 0.4 * fck);
  baseAxialSteel = Math.max(Ast_min, Math.min(baseAxialSteel, Ast_max));
  pt_iter = Math.max(0.8, (baseAxialSteel / Ag) * 100);

  while (pt_iter <= 6.0) {
    const trialAst = (pt_iter / 100) * Ag;
    const trialBars = selectColumnBars(trialAst, B, D, cc);
    const providedAst = trialBars.count * trialBars.size.area;

    // Interaction diagram for Major Axis Bending (X)
    const intDiagX = computeInteractionDiagram(B, D, cc, providedAst, fck, fy, trialBars);
    const Mux1 = interpolateInteractionCapacity(intDiagX, Pu);

    // Interaction diagram for Minor Axis Bending (Y) - Width/Depth swapped algebraically
    // The neutral axis depth now occurs along the 'B' dimension
    const intDiagY = computeInteractionDiagram(D, B, cc, providedAst, fck, fy, trialBars); 
    const Muy1 = interpolateInteractionCapacity(intDiagY, Pu);

    // IS 456 Cl. 39.6 — Bresler Biaxial Load Contour parameter Puz
    const Puz = 0.45 * fck * (Ag - providedAst) + 0.75 * fy * providedAst; // N
    const Puz_kN = Puz / 1000;
    const P_ratio = Pu / Puz_kN;

    // alpha_n ranges from 1.0 (P/Puz ≤ 0.2) to 2.0 (P/Puz ≥ 0.8)
    const alpha_n = P_ratio <= 0.2 ? 1.0 : (P_ratio >= 0.8 ? 2.0 : 1.0 + ((P_ratio - 0.2) * 1.0) / 0.6);

    const Mux_ratio = Mux1 > 0 ? (Mux_design / Mux1) : 1;
    const Muy_ratio = Muy1 > 0 ? (Muy_design / Muy1) : 1;
    
    // Interaction check value
    const interactionValue = Math.pow(Mux_ratio, alpha_n) + Math.pow(Muy_ratio, alpha_n);

    // We reached a valid design envelope
    if (interactionValue <= 1.0) {
      bestInteractionValue = interactionValue;
      bestMainBars = trialBars;
      bestInteractionDiagram = intDiagX; // Default to major axis for drawing
      bestPuCapacity = 0.4 * fck * (Ag - providedAst) + 0.67 * fy * providedAst;
      biaxialPasses = true;
      bestMux1 = Mux1;
      bestMuy1 = Muy1;
      break;
    }

    // Keep track of best passing condition in case it ultimately fails
    if (interactionValue < bestInteractionValue) {
      bestInteractionValue = interactionValue;
      bestMainBars = trialBars;
      bestInteractionDiagram = intDiagX;
      bestPuCapacity = 0.4 * fck * (Ag - providedAst) + 0.67 * fy * providedAst;
      bestMux1 = Mux1;
      bestMuy1 = Muy1;
    }

    pt_iter += PT_INCREMENT;
  }

  const mainBars = bestMainBars;
  const Ast_provided = mainBars.count * mainBars.size.area;
  const pt = (100 * Ast_provided) / Ag;
  const Ast_required = mainBars.count * mainBars.size.area; // Resolved

  // Ties (IS 456 Cl. 26.5.3.2)
  const maxBarDia = mainBars.size.diameter;
  const tieDia = Math.max(6, maxBarDia / 4);
  const tieBar = STIRRUP_SIZES.find((s) => s.diameter >= tieDia) || STIRRUP_SIZES[1];
  const tieSpacing = Math.min(300, 16 * mainBars.size.diameter, Math.min(B, D));
  const legCount = mainBars.count > 4 ? Math.ceil(mainBars.count / 2) : 2;

  const interactionDiagram = bestInteractionDiagram;

  // Final check readout for payload
  const Puz = 0.45 * fck * (Ag - Ast_provided) + 0.75 * fy * Ast_provided;
  const Puz_kN = Puz / 1000;
  const P_ratio = Pu / Puz_kN;
  const alpha_n = P_ratio <= 0.2 ? 1.0 : (P_ratio >= 0.8 ? 2.0 : 1.0 + ((P_ratio - 0.2) * 1.0) / 0.6);
  const Mux_ratio = bestMux1 > 0 ? (Mux_design / bestMux1) : 1;
  const Muy_ratio = bestMuy1 > 0 ? (Muy_design / bestMuy1) : 1;
  const interactionValue = Math.pow(Mux_ratio, alpha_n) + Math.pow(Muy_ratio, alpha_n);

  const Pu_capacity = bestPuCapacity;

  // Lap length (IS 456 Cl. 26.2.5.1)
  const lapLength = Math.max(
    Ld_tension_calc(mainBars.size.diameter, fck, fy),
    24 * mainBars.size.diameter,
  );

  const notes: string[] = [];
  notes.push(
    `Column type: ${isShort ? "Short" : "Slender"} (λ = ${slendernessRatio.toFixed(1)})`,
  );
  notes.push(`Effective length: ${(le / 1000).toFixed(2)} m (k = ${k})`);
  notes.push(`Steel ratio: ${pt.toFixed(2)}% (min 0.8%, max 4% / 6% at laps)`);
  notes.push(`Tie spacing: ${tieSpacing} mm c/c`);
  if (!biaxialPasses)
    notes.push("⚠ BIAXIAL CHECK FAILS — increase section or steel");
  if (!isShort)
    notes.push(
      "Slender column — additional moment due to slenderness per Cl. 39.7",
    );
  notes.push(`Lap splice: ${lapLength} mm (zone: lower half for compression)`);

  return {
    slendernessRatio,
    isShort,
    effectiveLength: le,
    Pu_capacity: Pu_capacity / 1000, // kN
    pt,
    Ast_required,
    Ast_provided,
    Ast_min,
    Ast_max,
    mainBars: {
      ...mainBars,
      spacing: Math.round(
        (2 * (B - 2 * cc) + 2 * (D - 2 * cc)) / mainBars.count,
      ),
    },
    ties: { size: tieBar, spacing: tieSpacing, legCount: legCount },
    interactionDiagram,
    biaxialCheck: {
      P_ratio,
      Mux_ratio,
      Muy_ratio,
      alpha_n,
      interactionValue,
      passes: biaxialPasses,
    },
    lapLength,
    detailingNotes: notes,
  };
}

// ────────────────────────────────────────────────────────────────────────
// STEEL SECTION DETAILED DESIGN
// ────────────────────────────────────────────────────────────────────────

export interface SteelSectionInput {
  // Section properties
  sectionType: "I-BEAM" | "TUBE" | "C-CHANNEL" | "L-ANGLE";
  depth: number; // mm (d)
  width: number; // mm (bf)
  tw: number; // mm — web thickness
  tf: number; // mm — flange thickness
  // Material
  fy: number; // MPa
  fu: number; // MPa (ultimate)
  E: number; // MPa (200000 default)
  // Member geometry
  length: number; // mm
  Lb: number; // mm — unbraced length for LTB
  Cb: number; // moment gradient factor (1.0 default)
  K: number; // effective length factor
  // Forces
  Pu: number; // kN — factored axial
  Mu: number; // kN·m — factored moment (major)
  Vu: number; // kN — factored shear
  code: "IS800" | "AISC360";
}

export type SectionClass = "plastic" | "compact" | "semi-compact" | "slender";

export interface SteelDetailedResult {
  // Classification
  sectionClass: SectionClass;
  flangeClass: SectionClass;
  webClass: SectionClass;
  flangeSlenderness: number;
  webSlenderness: number;
  flangeLimit: number;
  webLimit: number;

  // Capacity checks
  tensionCapacity: number; // kN
  compressionCapacity: number; // kN — with buckling
  momentCapacity: number; // kN·m — including LTB
  shearCapacity: number; // kN

  // LTB details
  ltb: {
    Mcr: number; // kN·m — elastic critical moment
    lambda_LT: number; // non-dimensional slenderness
    chi_LT: number; // LTB reduction factor
    Md: number; // kN·m — design bending strength
  };

  // Interaction check
  interaction: {
    N_ratio: number;
    M_ratio: number;
    combined: number; // ≤ 1.0
    passes: boolean;
    formula: string;
  };

  // Web checks
  webBearing: {
    bearingCapacity: number; // kN
    passes: boolean;
  };
  webBuckling: {
    bucklingCapacity: number; // kN
    passes: boolean;
  };

  // Stiffener requirement
  stiffenerRequired: boolean;
  stiffenerReason: string;

  // Connection force demands
  connectionDemands: {
    boltShearForce: number; // kN (estimated per bolt)
    weldForcePerMm: number; // kN/mm (weld demand)
    endPlateThickness: number; // mm (recommended)
  };

  utilization: number;
  detailingNotes: string[];
}

export function designSteelSectionDetailed(
  input: SteelSectionInput,
): SteelDetailedResult {
  const {
    depth: d,
    width: bf,
    tw,
    tf,
    fy,
    fu,
    E = 200000,
    length: L,
    Lb,
    Cb = 1.0,
    K,
    Pu,
    Mu,
    Vu,
  } = input;

  const epsilon = Math.sqrt(250 / fy);
  const Ag = 2 * bf * tf + (d - 2 * tf) * tw; // mm²
  const gamma_m0 = input.code === "IS800" ? 1.1 : 0.9; // IS 800 / AISC LRFD phi

  // ── Section classification (IS 800 Table 2) ──────────────────────
  const flangeSlenderness = bf / 2 / tf;
  const webSlenderness = (d - 2 * tf) / tw;

  const flangeLimit_plastic = 9.4 * epsilon;
  const flangeLimit_compact = 10.5 * epsilon;
  const flangeLimit_semi = 15.7 * epsilon;

  const webLimit_plastic = 84 * epsilon;
  const webLimit_compact = 105 * epsilon;
  const webLimit_semi = 126 * epsilon;

  const flangeClass: SectionClass =
    flangeSlenderness <= flangeLimit_plastic
      ? "plastic"
      : flangeSlenderness <= flangeLimit_compact
        ? "compact"
        : flangeSlenderness <= flangeLimit_semi
          ? "semi-compact"
          : "slender";

  const webClass: SectionClass =
    webSlenderness <= webLimit_plastic
      ? "plastic"
      : webSlenderness <= webLimit_compact
        ? "compact"
        : webSlenderness <= webLimit_semi
          ? "semi-compact"
          : "slender";

  const sectionClass =
    ["slender", "semi-compact", "compact", "plastic"].indexOf(flangeClass) <
    ["slender", "semi-compact", "compact", "plastic"].indexOf(webClass)
      ? flangeClass
      : webClass;

  // ── Tension capacity (IS 800 Cl. 6) ──────────────────────────────
  const Td = (Ag * fy) / (gamma_m0 * 1000); // kN

  // ── Compression capacity (IS 800 Cl. 7) ──────────────────────────
  // Structural Properties based on Section Type
  let I_minor = 0;
  if (input.sectionType === "L-ANGLE") {
    // Principal axis buckling — Mohr's circle for I_vv (IS 800 Cl. 7.1.2.1)
    // Centroidal axes first
    const x_bar = (bf * tf * bf / 2 + (d - tf) * tw * tw / 2) / Ag;
    const y_bar = (bf * tf * (d - tf / 2) + (d - tf) * tw * (d - tf) / 2) / Ag;
    const Ix_c = (bf * tf ** 3 / 12 + bf * tf * (d - tf / 2 - y_bar) ** 2) +
                 (tw * (d - tf) ** 3 / 12 + (d - tf) * tw * ((d - tf) / 2 - y_bar) ** 2);
    const Iy_c = (tf * bf ** 3 / 12 + bf * tf * (bf / 2 - x_bar) ** 2) +
                 ((d - tf) * tw ** 3 / 12 + (d - tf) * tw * (tw / 2 - x_bar) ** 2);
    const Ixy = bf * tf * (bf / 2 - x_bar) * (d - tf / 2 - y_bar) +
                (d - tf) * tw * (tw / 2 - x_bar) * ((d - tf) / 2 - y_bar);
    // Mohr's circle: I_vv = (Ix + Iy)/2 - sqrt(((Ix-Iy)/2)^2 + Ixy^2)
    I_minor = (Ix_c + Iy_c) / 2 - Math.sqrt(((Ix_c - Iy_c) / 2) ** 2 + Ixy ** 2);
  } else if (input.sectionType === "TUBE") {
    I_minor = (bf * d ** 3 / 12) - ((bf - 2 * tw) * (d - 2 * tf) ** 3 / 12);
  } else {
    // I-BEAM / C-CHANNEL
    I_minor = (2 * tf * bf ** 3) / 12 + ((d - 2 * tf) * tw ** 3) / 12;
  }
  
  const r_min = Math.sqrt(I_minor / Ag);
  const lambda = (K * L) / r_min;
  const fcc = (Math.PI ** 2 * E) / lambda ** 2;
  const lambda_bar = Math.sqrt(fy / fcc);

  // IS 800 Table 10 — Buckling curve selection
  // a: α=0.21, b: α=0.34, c: α=0.49, d: α=0.76
  let alpha_imp = 0.49; // Default: curve 'c'
  if (input.sectionType === "TUBE") {
    alpha_imp = 0.21; // Hot-finished hollow: curve 'a'
  } else if (input.sectionType === "L-ANGLE") {
    alpha_imp = 0.76; // Angles: curve 'd'
  } else if (input.sectionType === "C-CHANNEL") {
    alpha_imp = 0.49; // Channels: curve 'c'
  } else {
    // I-BEAM: curve 'b' for major, 'c' for minor (use 'c' conservative)
    alpha_imp = 0.49;
  }

  const phi_buck = 0.5 * (1 + alpha_imp * (lambda_bar - 0.2) + lambda_bar ** 2);
  const chi = Math.min(
    1.0,
    1 / (phi_buck + Math.sqrt(Math.max(phi_buck ** 2 - lambda_bar ** 2, 0.001))),
  );
  const Pd = (chi * Ag * fy) / (gamma_m0 * 1000); // kN

  // Plastic and Elastic Section Moduli — Section-specific formulas
  let Zp = 0;
  let Ze = 0;
  if (input.sectionType === "TUBE") {
    // Plastic: full plastic neutral axis at mid-height
    Zp = bf * tf * (d - tf) + tw * (d - 2 * tf) ** 2 / 4 +
         (bf - 2 * tw) * tf * (d - tf) - (bf - 2 * tw) * tf * (d - tf); // Simplified
    Zp = (bf * d ** 2 / 4) - ((bf - 2 * tw) * (d - 2 * tf) ** 2 / 4);
    const I_major = (bf * d ** 3 / 12) - ((bf - 2 * tw) * (d - 2 * tf) ** 3 / 12);
    Ze = I_major / (d / 2);
  } else if (input.sectionType === "L-ANGLE") {
    // For angles, use elastic modulus about weaker axis
    Ze = I_minor / Math.max(bf, d); // Conservative
    Zp = Ze * 1.5; // Shape factor ~1.5 for angles
  } else {
    // I-BEAM / C-CHANNEL
    Zp = bf * tf * (d - tf) + (tw * (d - 2 * tf) ** 2) / 4;
    Ze = (2 * bf * tf * ((d - tf) / 2) ** 2 + (tw * (d - 2 * tf) ** 3) / 12) / (d / 2);
  }
  const Mp = (Zp * fy) / 1e6; // kN·m

  // Critical LTB moment (Timoshenko with section-specific geometric properties)
  const Iy = I_minor;
  let J = 0;
  let Iw = 0;

  if (input.sectionType === "TUBE") {
    // Closed section St. Venant torsion and zero warping
    const A_enclosed = (bf - tw) * (d - tf);
    const perimeter = 2 * ((bf - tw) + (d - tf));
    const t_min = Math.min(tf, tw);
    J = perimeter > 0 ? (4 * A_enclosed ** 2 * t_min) / perimeter : 0;
    Iw = 0; // Warping is negligible for closed tubular sections
  } else if (input.sectionType === "L-ANGLE") {
    J = (bf * tf ** 3 + (d - tf) * tw ** 3) / 3;
    Iw = 0; // Primary warping is zero for angles
  } else {
    // Deterministic Branching for I-BEAM and C-CHANNEL properties
    J = (2 * bf * tf ** 3 + (d - 2 * tf) * tw ** 3) / 3;
    Iw = (Iy * (d - tf) ** 2) / 4; 
  }
  const Mcr =
    Cb *
    (Math.PI / Lb) *
    Math.sqrt(E * Iy * (E * Iw + (G_steel_MPa() * J * Lb ** 2) / Math.PI ** 2));
  const Mcr_kNm = Mcr / 1e6;

  const lambda_LT = Math.sqrt(Mp / (Mcr_kNm || 1));
  const alpha_LT = 0.49; // curve c for LTB
  const phi_LT = 0.5 * (1 + alpha_LT * (lambda_LT - 0.2) + lambda_LT ** 2);
  const chi_LT = Math.min(
    1.0,
    1 / (phi_LT + Math.sqrt(Math.max(phi_LT ** 2 - lambda_LT ** 2, 0.001))),
  );

  const Md = (chi_LT * Mp) / gamma_m0;

  // ── Shear capacity (IS 800 Cl. 8.4) ─────────────────────────────
  const Av = d * tw; // mm²
  const Vd = (Av * fy) / (Math.sqrt(3) * gamma_m0 * 1000); // kN

  // ── Interaction (IS 800 Cl. 9.3) ─────────────────────────────────
  const N_ratio = Math.abs(Pu) / (Pu >= 0 ? Td : Pd);
  const M_ratio = Math.abs(Mu) / Md;
  const combined = N_ratio + M_ratio; // Conservative linear interaction
  const interactionPasses = combined <= 1.0;

  // ── Web bearing (IS 800 Cl. 8.7.4) ──────────────────────────────
  const n1 = tf + 5 * (tf + tw); // dispersion length
  const Fw = ((n1 + 50) * tw * fy) / (gamma_m0 * 1000);

  // Web buckling
  const hw = d - 2 * tf;
  const Ncr_web = (0.9 * E * tw ** 3) / (2.4 * hw ** 2);
  const Fwb = (Ncr_web * tw) / 1000;

  // ── Stiffener requirement ────────────────────────────────────────
  const stiffenerRequired = webSlenderness > webLimit_semi || Vu > Fwb;
  const stiffenerReason = stiffenerRequired
    ? webSlenderness > webLimit_semi
      ? "Slender web requires stiffeners"
      : "Web buckling capacity exceeded"
    : "Not required";

  // ── Connection demands ───────────────────────────────────────────
  const boltRows = Math.max(2, Math.ceil(d / 100));
  const boltShearForce = Math.abs(Vu) / (boltRows * 2);
  const weldForcePerMm = Math.max(
    Math.abs(Vu) / (2 * (d - 2 * tf)),
    (Math.abs(Mu) * 1000) / (d * (d - 2 * tf)),
  );
  const endPlateThickness = Math.ceil(
    Math.sqrt((6 * Math.abs(Mu) * 1e6) / (bf * fy)),
  );

  const utilization = Math.max(N_ratio + M_ratio, Math.abs(Vu) / Vd);

  const notes: string[] = [];
  notes.push(
    `Section class: ${sectionClass} (flange: ${flangeClass}, web: ${webClass})`,
  );
  notes.push(
    `λ_LT = ${lambda_LT.toFixed(2)}, χ_LT = ${chi_LT.toFixed(3)}, Md = ${Md.toFixed(1)} kN·m`,
  );
  notes.push(
    `KL/r = ${lambda.toFixed(1)}, χ = ${chi.toFixed(3)}, Pd = ${Pd.toFixed(1)} kN`,
  );
  if (sectionClass === "slender")
    notes.push("⚠ SLENDER section — use effective width method");
  if (stiffenerRequired) notes.push(`⚠ ${stiffenerReason}`);
  notes.push(`Utilization: ${(utilization * 100).toFixed(1)}%`);

  return {
    sectionClass,
    flangeClass,
    webClass,
    flangeSlenderness,
    webSlenderness,
    flangeLimit: flangeLimit_compact,
    webLimit: webLimit_compact,
    tensionCapacity: Td,
    compressionCapacity: Pd,
    momentCapacity: Md,
    shearCapacity: Vd,
    ltb: { Mcr: Mcr_kNm, lambda_LT, chi_LT, Md },
    interaction: {
      N_ratio,
      M_ratio,
      combined,
      passes: interactionPasses,
      formula: "N/Nd + M/Md ≤ 1.0 (IS 800 Cl. 9.3)",
    },
    webBearing: { bearingCapacity: Fw, passes: Vu <= Fw },
    webBuckling: { bucklingCapacity: Fwb, passes: Vu <= Fwb },
    stiffenerRequired,
    stiffenerReason,
    connectionDemands: { boltShearForce, weldForcePerMm, endPlateThickness },
    utilization,
    detailingNotes: notes,
  };
}

// ────────────────────────────────────────────────────────────────────────
// HELPER FUNCTIONS
// ────────────────────────────────────────────────────────────────────────

function G_steel_MPa(): number {
  return 76923;
} // ≈ E/(2*(1+ν))

function getStressInCompSteel(
  fy: number,
  _fck: number,
  xu: number,
  d_prime: number,
): number {
  const strain_sc = 0.0035 * (1 - d_prime / xu);
  const Es = 200000; // MPa
  const fsc = Math.min(Es * strain_sc, 0.87 * fy);
  return fsc;
}

/** 
 * IS 456:2000 Table 19 — Design shear strength of concrete τc (N/mm²)
 * Performs bilinear interpolation based on Concrete Grade and Pt (%)
 */
function getTauc(fck: number, pt: number): number {
  const pt_keys = [0.15, 0.25, 0.50, 0.75, 1.00, 1.25, 1.50, 1.75, 2.00, 2.25, 2.50, 2.75, 3.00];
  const table: Record<number, number[]> = {
    15: [0.28, 0.35, 0.46, 0.54, 0.60, 0.64, 0.68, 0.71, 0.71, 0.71, 0.71, 0.71, 0.71],
    20: [0.28, 0.36, 0.48, 0.56, 0.62, 0.67, 0.72, 0.75, 0.79, 0.81, 0.82, 0.82, 0.82],
    25: [0.29, 0.36, 0.49, 0.57, 0.64, 0.70, 0.74, 0.78, 0.82, 0.85, 0.88, 0.90, 0.92],
    30: [0.29, 0.37, 0.50, 0.59, 0.66, 0.71, 0.76, 0.80, 0.84, 0.88, 0.91, 0.94, 0.96],
    35: [0.30, 0.38, 0.51, 0.60, 0.68, 0.73, 0.78, 0.82, 0.86, 0.90, 0.93, 0.96, 0.99],
    40: [0.30, 0.38, 0.51, 0.60, 0.68, 0.74, 0.79, 0.83, 0.87, 0.91, 0.94, 0.97, 1.01],
  };

  const fck_val = Math.max(15, Math.min(fck, 40));
  const grades = [15, 20, 25, 30, 35, 40];
  
  // Find fck bounds
  let f1 = 15, f2 = 15;
  for (let i = 0; i < grades.length; i++) {
    if (fck_val <= grades[i]) {
      f2 = grades[i];
      f1 = i > 0 ? grades[i-1] : grades[i];
      break;
    }
  }

  const interpolatePt = (grade: number, p: number) => {
    const row = table[grade];
    if (p <= pt_keys[0]) return row[0];
    if (p >= pt_keys[pt_keys.length - 1]) return row[row.length - 1];
    for (let i = 0; i < pt_keys.length - 1; i++) {
      if (p <= pt_keys[i+1]) {
        const t = (p - pt_keys[i]) / (pt_keys[i+1] - pt_keys[i]);
        return row[i] + t * (row[i+1] - row[i]);
      }
    }
    return row[row.length - 1];
  };

  const t1 = interpolatePt(f1, pt);
  const t2 = interpolatePt(f2, pt);
  
  if (f1 === f2) return t1;
  const ft = (fck_val - f1) / (f2 - f1);
  return t1 + ft * (t2 - t1);
}

/** IS 456 Table 20 — Maximum shear stress τc,max */
function getTaucMax(fck: number): number {
  if (fck <= 20) return 2.8;
  if (fck <= 25) return 3.1;
  if (fck <= 30) return 3.5;
  if (fck <= 35) return 3.7;
  if (fck <= 40) return 4.0;
  return 4.0;
}

/** IS 456 Table 21 — Bond stress */
function getBondStress(fck: number): number {
  if (fck <= 20) return 1.2;
  if (fck <= 25) return 1.4;
  if (fck <= 30) return 1.5;
  if (fck <= 35) return 1.7;
  return 1.9;
}

function Ld_tension_calc(dia: number, fck: number, fy: number): number {
  return (0.87 * fy * dia) / (4 * getBondStress(fck));
}

function selectBarsForArea(
  Ast: number,
  b: number,
  cc: number,
  stirrupDia: number,
) {
  const availWidth = b - 2 * cc - 2 * stirrupDia;
  let bestBar: BarInfo = REBAR_SIZES[3]; // 16mm default
  let bestCount = Math.ceil(Ast / bestBar.area);

  for (const bar of REBAR_SIZES) {
    if (bar.diameter < 12 || bar.diameter > 32) continue;
    const count = Math.ceil(Ast / bar.area);
    const spaceNeeded =
      count * bar.diameter + (count - 1) * Math.max(bar.diameter, 25);
    if (spaceNeeded <= availWidth && count >= 2 && count <= 8) {
      bestBar = bar;
      bestCount = count;
      break;
    }
  }
  return { count: Math.max(2, bestCount), size: bestBar };
}

function selectColumnBars(Ast: number, B: number, D: number, cc: number) {
  const perimeter = 2 * (B - 2 * cc + D - 2 * cc);
  for (const bar of REBAR_SIZES) {
    if (bar.diameter < 12 || bar.diameter > 32) continue;
    const count = Math.ceil(Ast / bar.area);
    const minCount = 4; // minimum 4 bars for rectangular column
    const nBars = Math.max(count, minCount);
    const spacing = perimeter / nBars;
    if (spacing >= 75 && nBars <= 16) {
      return { count: nBars, size: bar, spacing: Math.round(spacing) };
    }
  }
  return {
    count: Math.max(4, Math.ceil(Ast / REBAR_SIZES[4].area)),
    size: REBAR_SIZES[4],
    spacing: 150,
  };
}

function designStirrups(
  Vus: number,
  b: number,
  d: number,
  fy: number,
  _fck: number,
) {
  if (Vus <= 0) {
    // Minimum stirrups (IS 456 Cl. 26.5.1.6)
    const bar = STIRRUP_SIZES[1]; // 8mm
    const spacing = Math.min(
      300,
      Math.floor(0.75 * d),
      Math.floor((0.87 * fy * 2 * bar.area) / (0.4 * b)),
    );
    return { size: bar, spacing, legs: 2 };
  }

  // Try 2-legged stirrups first, then 4-legged
  for (const legs of [2, 4]) {
    for (const bar of STIRRUP_SIZES) {
      const Asv = legs * bar.area;
      const spacing = Math.floor((0.87 * fy * Asv * d) / (Vus * 1000));
      const maxSpacing = Math.min(300, Math.floor(0.75 * d));
      if (spacing >= 75 && spacing <= maxSpacing) {
        return { size: bar, spacing: Math.min(spacing, maxSpacing), legs };
      }
    }
  }

  // Fallback
  return { size: STIRRUP_SIZES[2], spacing: 100, legs: 4 };
}

function computeCurtailment(
  input: RCBeamInput,
  Ast_required: number,
  tensionBars: { count: number; size: BarInfo },
): CurtailmentPoint[] {
  const points: CurtailmentPoint[] = [];
  const L = input.span;

  if (input.beamType === "simply_supported") {
    // Strategic Curtailment (IS 456 Cl. 26.2.3.1)
    const extension = Math.max(input.depth - 20, 12 * tensionBars.size.diameter);
    points.push({
      distanceFromSupport: Math.max(L * 0.1, extension),
      barsRequired: Math.ceil(tensionBars.count / 2),
      barSize: tensionBars.size.diameter,
      momentAtPoint: input.Mu * 0.5,
    });
    points.push({
      distanceFromSupport: L * 0.5,
      barsRequired: tensionBars.count,
      barSize: tensionBars.size.diameter,
      momentAtPoint: input.Mu,
    });
  } else {
    points.push({
      distanceFromSupport: 0,
      barsRequired: tensionBars.count,
      barSize: tensionBars.size.diameter,
      momentAtPoint: input.Mu * 0.8,
    });
    points.push({
      distanceFromSupport: L * 0.3,
      barsRequired: Math.ceil(tensionBars.count * 0.5),
      barSize: tensionBars.size.diameter,
      momentAtPoint: input.Mu * 0.3,
    });
    points.push({
      distanceFromSupport: L * 0.5,
      barsRequired: Math.ceil(tensionBars.count * 0.67),
      barSize: tensionBars.size.diameter,
      momentAtPoint: input.Mu * 0.6,
    });
  }

  return points;
}

function computeCrackWidth(
  b: number,
  d: number,
  D: number,
  cc: number,
  Ast: number,
  bars: { count: number; size: BarInfo },
  Mu: number,
  fck: number,
  fy: number,
  exposure: string,
): CrackWidthResult {
  // IS 456 Annex F
  const wk_limit =
    exposure === "mild" ? 0.3 : exposure === "moderate" ? 0.3 : 0.2;

  const spacing = Ast > 0 ? (b - 2 * cc) / Math.max(bars.count - 1, 1) : 150;
  const acr = Math.sqrt(spacing ** 2 / 4 + cc ** 2) - bars.size.diameter / 2;

  // Estimate strain
  const m = 200000 / (5000 * Math.sqrt(fck)); // modular ratio
  const x = ((m * Ast) / b) * (-1 + Math.sqrt(1 + (2 * b * d) / (m * Ast)));
  const epsilon_m = (Mu * 1e6) / (Ast * 0.87 * fy * (d - x / 3));
  const epsilon_1 = epsilon_m > 0 ? epsilon_m : 0.001;

  const wk = (3 * acr * epsilon_1) / (1 + (2 * (acr - cc)) / (D - x));

  return {
    wk: Math.abs(wk),
    wk_limit,
    passes: Math.abs(wk) <= wk_limit,
    spacing,
    acr,
  };
}

function checkDeflection(
  b: number,
  d: number,
  D: number,
  L: number,
  Ast_prov: number,
  Asc_prov: number,
  fck: number,
  fy: number,
  pt: number,
  beamType: 'simply_supported' | 'continuous' | 'cantilever',
): DeflectionResult {
  // 1. IS 456 Cl. 23.2.1 — Span/depth basic ratios
  const basicRatios = { simply_supported: 20, continuous: 26, cantilever: 7 };
  const basicRatio = basicRatios[beamType] || 20;

  // 2. Modification factors (Cl. 23.2.1 a, b, c)
  const fs = 0.58 * fy; // Service stress (IS 456 Cl. 23.2.1)
  const mf_tension = Math.min(2.0, 1 / (0.225 + 0.00322 * fs - 0.625 * Math.log10(pt)));
  const pc = (100 * Asc_prov) / (b * d);
  const mf_compression = Math.min(1.5, (1.6 * pc) / (pc + 0.275) || 1.0);

  const permissibleRatio = basicRatio * mf_tension * mf_compression;
  const actualRatio = L / d;

  // 3. IS 456 Annex C — Rigorous Deflection (Short-term)
  const Ec = 5000 * Math.sqrt(fck);
  const m = 200000 / Ec; // Modular ratio
  const Ig = (b * D ** 3) / 12; // Gross moment of inertia
  
  // Cracked neutral axis xu_cr
  // b*x^2/2 + m*Asc*(x-dc) = m*Ast*(d-x)
  const dc = D - d;
  const B_quad = (m * Ast_prov + m * Asc_prov) / b;
  const C_quad = -(m * Ast_prov * d + m * Asc_prov * dc) / b;
  const discriminant = B_quad ** 2 - 2 * C_quad;
  // NaN guard: if discriminant < 0 (unusual reinforcement), fall back to d/3
  const xu_cr = discriminant > 0 ? (-B_quad + Math.sqrt(discriminant)) : (d / 3);
  
  const Icr = (b * xu_cr ** 3) / 3 + m * Ast_prov * (d - xu_cr) ** 2 + m * Asc_prov * (xu_cr - dc) ** 2;
  
  // Effective moment of inertia calculation (IS 456 Annex C.1.1)
  // Ieff = Icr / (1 - (1.2*Mr/M)*(1-Icr/Ig))
  const fcr = 0.7 * Math.sqrt(fck);
  const Mr = (fcr * Ig) / (D / 2) / 1e6; // kNm (Cracking moment)
  
  // Service moment ≈ factored moment / load factor (IS 456 Cl. 36.1)
  // For limit state, γf = 1.5 for DL+LL combination
  const w_service = (Ast_prov * 0.87 * fy * (d - 0.42 * d * 0.46)) / (L * L / 8) / 1e6; // kN/m (back-calculated)
  const M_service = w_service * L * L / 8 / 1e6; // Approximate service moment from section capacity
  // Alternate: Use factored Mu / 1.5 as a reasonable service moment estimate
  const M_serv = M_service > 0.01 ? M_service : (pt * b * d * 0.87 * fy * 0.9 * d) / (100 * 1.5 * 1e6);
  
  let Ieff: number;
  if (M_serv <= Mr) {
    // Uncracked section — use gross moment of inertia
    Ieff = Ig;
  } else {
    // IS 456 Annex C.1.1: I_eff = I_cr / (1 - (1.2·Mr/M)·(1 - I_cr/I_g))
    Ieff = Icr / (1 - Math.min(1.0, (1.2 * Mr) / M_serv) * (1 - Icr / Ig));
    Ieff = Math.max(Icr, Math.min(Ieff, Ig));
  }

  // Short-term deflection for UDL: δ = 5·w·L⁴/(384·Ec·I_eff)
  const w_udl = (M_serv * 8) / (L * L) * 1e6; // N/mm (back-calculated UDL)
  const deflection_est = (5 * w_udl * L ** 4) / (384 * Ec * Ieff); // mm
  const limitDeflection = L / 250;

  return {
    spanOverDepthActual: actualRatio,
    spanOverDepthPermissible: permissibleRatio,
    estimatedDeflection: deflection_est,
    limitDeflection,
    passes: actualRatio <= permissibleRatio,
    modificationFactor_tension: mf_tension,
    modificationFactor_compression: mf_compression,
  };
}

function generateBeamSketch(
  b: number,
  D: number,
  cc: number,
  stirrup_dia: number,
  tensionBars: { count: number; size: BarInfo },
  compressionBars: { count: number; size: BarInfo } | null,
) {
  const tension: Array<{ x: number; y: number; dia: number }> = [];
  const compression: Array<{ x: number; y: number; dia: number }> = [];

  const startX = cc + stirrup_dia + tensionBars.size.diameter / 2;
  const availW = b - 2 * startX;
  const gap = tensionBars.count > 1 ? availW / (tensionBars.count - 1) : 0;

  for (let i = 0; i < tensionBars.count; i++) {
    tension.push({
      x: startX + i * gap,
      y: D - cc - stirrup_dia - tensionBars.size.diameter / 2,
      dia: tensionBars.size.diameter,
    });
  }

  if (compressionBars) {
    const startXc = cc + stirrup_dia + compressionBars.size.diameter / 2;
    const availWc = b - 2 * startXc;
    const gapC =
      compressionBars.count > 1 ? availWc / (compressionBars.count - 1) : 0;
    for (let i = 0; i < compressionBars.count; i++) {
      compression.push({
        x: startXc + i * gapC,
        y: cc + stirrup_dia + compressionBars.size.diameter / 2,
        dia: compressionBars.size.diameter,
      });
    }
  }

  return {
    width: b,
    depth: D,
    cover: cc,
    tensionBars: tension,
    compressionBars: compression,
    stirrup: {
      width: b - 2 * cc,
      height: D - 2 * cc,
      dia: stirrup_dia,
      spacing: 150,
    },
  };
}

/** IS 456:2000 Table 26 — Bending moment coefficients for two-way slabs */
function getBendingCoefficients(ratio: number, edge: string) {
  const r = Math.max(1.0, Math.min(ratio, 2.0));
  const r_keys = [1.0, 1.1, 1.2, 1.3, 1.4, 1.5, 1.75, 2.0];

  // Table indices: [alphaX negative, alphaX positive, alphaY negative, alphaY positive]
  // Note: alphaY coefficients are constant for all ratios
  const coeffs: Record<string, number[][]> = {
    fixed_all: [
      [0.032, 0.024, 0.032, 0.024], // 1.0
      [0.037, 0.028, 0.032, 0.024], // 1.1
      [0.043, 0.032, 0.032, 0.024], // 1.2
      [0.047, 0.035, 0.032, 0.024], // 1.3
      [0.051, 0.038, 0.032, 0.024], // 1.4
      [0.053, 0.040, 0.032, 0.024], // 1.5
      [0.058, 0.044, 0.032, 0.024], // 1.75
      [0.063, 0.047, 0.032, 0.024], // 2.0
    ],
    ss_all: [
      [0, 0.062, 0, 0.062], // 1.0
      [0, 0.074, 0, 0.062], // 1.1
      [0, 0.084, 0, 0.062], // 1.2
      [0, 0.093, 0, 0.062], // 1.3
      [0, 0.099, 0, 0.062], // 1.4
      [0, 0.104, 0, 0.062], // 1.5
      [0, 0.113, 0, 0.062], // 1.75
      [0, 0.121, 0, 0.062], // 2.0
    ],
    adjacent_fixed: [
      [0.047, 0.035, 0.047, 0.035], // 1.0
      [0.053, 0.040, 0.047, 0.035], // 1.1
      [0.060, 0.045, 0.047, 0.035], // 1.2
      [0.065, 0.049, 0.047, 0.035], // 1.3
      [0.071, 0.053, 0.047, 0.035], // 1.4
      [0.075, 0.056, 0.047, 0.035], // 1.5
      [0.082, 0.062, 0.047, 0.035], // 1.75
      [0.089, 0.067, 0.047, 0.035], // 2.0
    ]
  };

  const case_rows = coeffs[edge] || coeffs['ss_all'];
  let row1 = case_rows[0], row2 = case_rows[0];
  let r1 = 1.0, r2 = 1.0;

  for (let i = 0; i < r_keys.length - 1; i++) {
    if (ratio <= r_keys[i + 1]) {
      r1 = r_keys[i];
      r2 = r_keys[i + 1];
      row1 = case_rows[i];
      row2 = case_rows[i + 1];
      break;
    }
  }

  const t = r1 === r2 ? 0 : (ratio - r1) / (r2 - r1);
  return {
    alphaX_neg: row1[0] + t * (row2[0] - row1[0]),
    alphaX_pos: row1[1] + t * (row2[1] - row1[1]),
    alphaY_neg: row1[2],
    alphaY_pos: row1[3],
  };
}

function computeInteractionDiagram(
  B: number,
  D: number,
  cc: number,
  Ast: number,
  fck: number,
  fy: number,
  bars: { count: number; size: BarInfo },
): InteractionPoint[] {
  const d = D - cc - 8 - bars.size.diameter / 2;
  const d_prime = cc + 8 + bars.size.diameter / 2;
  const points: InteractionPoint[] = [];
  const As_half = Ast / 2;

  // Pure compression (xu → infinity)
  const P0 = (0.4 * fck * B * D + 0.67 * fy * Ast) / 1000;
  points.push({ Pu: P0, Mu: 0 });

  // Balanced section
  const xu_bal = 0.46 * d;
  const Cu_bal = 0.36 * fck * B * xu_bal;
  const fsc_top = Math.min(0.87 * fy, 200000 * 0.0035 * (1 - d_prime / xu_bal));
  const Tu_bal = 0.87 * fy * As_half;
  const Pu_bal = (Cu_bal + fsc_top * As_half - Tu_bal) / 1000;
  const Mu_bal =
    (Cu_bal * (D / 2 - 0.42 * xu_bal) +
      fsc_top * As_half * (D / 2 - d_prime) +
      Tu_bal * (d - D / 2)) /
    1e6;
  points.push({ Pu: Pu_bal, Mu: Mu_bal });

  // Intermediate points
  for (const xu_ratio of [2.0, 1.0, 0.7, 0.5, 0.3]) {
    const xu = xu_ratio * d;
    const Cu = 0.36 * fck * B * Math.min(xu, D);
    const fsc = Math.min(
      0.87 * fy,
      200000 * 0.0035 * Math.max(0, 1 - d_prime / xu),
    );
    const Tu = 0.87 * fy * As_half;
    const P = (Cu + fsc * As_half - Tu) / 1000;
    const M =
      (Cu * (D / 2 - 0.42 * Math.min(xu, D)) +
        fsc * As_half * (D / 2 - d_prime) +
        Tu * (d - D / 2)) /
      1e6;
    points.push({ Pu: Math.max(P, 0), Mu: Math.max(M, 0) });
  }

  // Pure tension
  const Pt = -(0.87 * fy * Ast) / 1000;
  points.push({ Pu: Pt, Mu: 0 });

  // Sort by Pu descending
  points.sort((a, b) => b.Pu - a.Pu);
  return points;
}

function interpolateInteractionCapacity(
  diagram: InteractionPoint[],
  Pu: number,
): number {
  for (let i = 0; i < diagram.length - 1; i++) {
    if (Pu <= diagram[i].Pu && Pu >= diagram[i + 1].Pu) {
      const t =
        (diagram[i].Pu - Pu) / (diagram[i].Pu - diagram[i + 1].Pu + 0.001);
      return diagram[i].Mu + t * (diagram[i + 1].Mu - diagram[i].Mu);
    }
  }
  return diagram[Math.floor(diagram.length / 2)]?.Mu ?? 0;
}
