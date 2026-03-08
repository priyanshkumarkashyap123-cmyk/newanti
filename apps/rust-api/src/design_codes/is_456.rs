//! IS 456:2000 — Plain and Reinforced Concrete (Limit State Method)
//!
//! Implements:
//! - Table 19: Permissible shear stress τc with full interpolation
//! - Flexural capacity (singly & doubly reinforced beams)
//! - P-M interaction curve via strain compatibility
//! - Biaxial column check per Cl. 39.6 (Bresler's equation)
//! - Slender column additional moments per Cl. 39.7
//! - Deflection check per Cl. 23.2 with modification factors
//! - Shear design per Cl. 40
//! - Development length per Cl. 26.2.1

use serde::{Deserialize, Serialize};
use std::f64::consts::PI;

// ── Constants ──

#[allow(dead_code)]
const GAMMA_C: f64 = 1.5;   // Partial safety factor for concrete
#[allow(dead_code)]
const GAMMA_S: f64 = 1.15;  // Partial safety factor for steel
const EPSILON_CU: f64 = 0.0035; // Ultimate strain in concrete

// ── Table 19 Data ──

/// IS 456 Table 19: τc anchor points for M20 concrete
/// Format: (pt%, τc in N/mm²)
const TC_TABLE_M20: [(f64, f64); 9] = [
    (0.15, 0.28),
    (0.25, 0.36),
    (0.50, 0.48),
    (0.75, 0.56),
    (1.00, 0.62),
    (1.25, 0.67),
    (1.50, 0.72),
    (2.00, 0.79),
    (2.50, 0.82),
];

/// Interpolate τc from Table 19 for given fck and pt
pub fn table_19_tc(fck: f64, pt_percent: f64) -> f64 {
    let pt = pt_percent.clamp(0.15, 3.0);

    // Interpolate for M20 base
    let tc_m20 = {
        let table = &TC_TABLE_M20;
        if pt <= table[0].0 {
            table[0].1
        } else if pt >= table[table.len() - 1].0 {
            table[table.len() - 1].1
        } else {
            let mut tc = table[0].1;
            for i in 1..table.len() {
                if pt <= table[i].0 {
                    let (p0, t0) = table[i - 1];
                    let (p1, t1) = table[i];
                    tc = t0 + (t1 - t0) * (pt - p0) / (p1 - p0);
                    break;
                }
            }
            tc
        }
    };

    // Scale for concrete grade: τc ∝ (fck/20)^0.5 per SP-16 derivation
    // More precisely: use the SP-16 formula
    // τc = 0.85 × √(0.8fck) × (√(1+5β)−1) / (6β)
    // where β = max(0.8fck / (6.89 × pt), 1.0)
    let beta = (0.8 * fck / (6.89 * pt)).max(1.0);
    let tc_exact = 0.85 * (0.8 * fck).sqrt() * ((1.0 + 5.0 * beta).sqrt() - 1.0)
        / (6.0 * beta);
    let tc_max = 0.63 * fck.sqrt(); // Table 20

    // Use the larger of interpolated (scaled) and exact formula
    let tc_scaled = tc_m20 * (fck / 20.0).sqrt();
    tc_exact.max(tc_scaled).min(tc_max).max(0.0)
}

// ── Flexural Capacity ──

/// Limiting neutral axis depth ratio xu_max/d (Table E)
pub fn xu_max_ratio(fy: f64) -> f64 {
    if fy <= 250.0 {
        0.53
    } else if fy <= 415.0 {
        0.48
    } else if fy <= 500.0 {
        0.46
    } else {
        0.44
    }
}

/// Singly reinforced beam flexural capacity Mu (kN·m)
/// Per IS 456 Cl. 38.1
pub fn flexural_capacity_singly(b: f64, d: f64, fck: f64, fy: f64, ast: f64) -> f64 {
    let xu = (0.87 * fy * ast) / (0.36 * fck * b);
    let xu_max = xu_max_ratio(fy) * d;

    if xu <= xu_max {
        // Under-reinforced
        0.87 * fy * ast * (d - 0.42 * xu) / 1e6
    } else {
        // Over-reinforced — limit to xu_max
        0.36 * fck * b * xu_max * (d - 0.42 * xu_max) / 1e6
    }
}

/// Doubly reinforced beam flexural capacity Mu (kN·m)
pub fn flexural_capacity_doubly(
    b: f64, d: f64, d_prime: f64, fck: f64, fy: f64, ast: f64, asc: f64,
) -> f64 {
    let xu_max = xu_max_ratio(fy) * d;
    let mu_lim = 0.36 * fck * b * xu_max * (d - 0.42 * xu_max) / 1e6;

    // Compression steel stress
    let epsilon_sc = EPSILON_CU * (1.0 - d_prime / xu_max);
    let fsc = (epsilon_sc * 200000.0).min(0.87 * fy);
    let _ = ast; // tension steel used for determining xu

    let mu2 = asc * (fsc - 0.45 * fck) * (d - d_prime) / 1e6;
    mu_lim + mu2
}

// ── Shear Design (Cl. 40) ──

/// Result of shear check
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ShearCheckResult {
    pub tau_v: f64,       // Applied shear stress (N/mm²)
    pub tau_c: f64,       // Permissible shear stress (N/mm²)
    pub tau_c_max: f64,   // Maximum shear stress (N/mm²)
    pub vus: f64,         // Shear to be resisted by stirrups (kN)
    pub spacing_mm: f64,  // Required stirrup spacing (mm)
    pub passed: bool,
    pub message: String,
}

/// Design shear per IS 456 Cl. 40
pub fn design_shear(
    vu_kn: f64, b: f64, d: f64, fck: f64, fy_stirrup: f64,
    pt_percent: f64, asv: f64,
) -> ShearCheckResult {
    let tau_v = vu_kn * 1000.0 / (b * d);
    let tau_c = table_19_tc(fck, pt_percent);
    let tau_c_max = 0.63 * fck.sqrt();

    if tau_v > tau_c_max {
        return ShearCheckResult {
            tau_v, tau_c, tau_c_max,
            vus: (tau_v - tau_c) * b * d / 1000.0,
            spacing_mm: 0.0,
            passed: false,
            message: format!(
                "τv = {tau_v:.3} > τc,max = {tau_c_max:.3} N/mm² — section inadequate"
            ),
        };
    }

    let vus = ((tau_v - tau_c) * b * d).max(0.0); // N
    let spacing = if vus > 0.0 {
        let sv = 0.87 * fy_stirrup * asv * d / vus;
        sv.min(0.75 * d).min(300.0)
    } else {
        (0.75 * d).min(300.0)
    };

    ShearCheckResult {
        tau_v, tau_c, tau_c_max,
        vus: vus / 1000.0,
        spacing_mm: spacing,
        passed: tau_v <= tau_c_max,
        message: format!(
            "τv = {tau_v:.3} vs τc = {tau_c:.3} N/mm², stirrup spacing = {spacing:.0} mm"
        ),
    }
}

// ── P-M Interaction Curve ──

/// A point on the P-M interaction diagram
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PMPoint {
    pub pu: f64,  // Axial force (kN)
    pub mu: f64,  // Moment capacity (kN·m)
}

/// Generate P-M interaction curve for rectangular column
/// Uses strain compatibility method varying xu from 0.05D to 2.5D
pub fn pm_interaction_curve(
    b: f64, big_d: f64, fck: f64, fy: f64, ast: f64,
    d_dash: f64, n_points: usize,
) -> Vec<PMPoint> {
    let d = big_d - d_dash;
    let n = n_points.max(20);
    let mut curve = Vec::with_capacity(n + 2);

    // Pure tension
    let p_tension = -0.87 * fy * ast / 1000.0;
    curve.push(PMPoint { pu: p_tension, mu: 0.0 });

    for i in 0..=n {
        let xu = 0.05 * big_d + (2.45 * big_d) * (i as f64) / (n as f64);

        // Concrete compression force
        let xu_eff = xu.min(big_d);
        let cu = 0.36 * fck * b * xu_eff / 1000.0; // kN

        // Concrete moment about centroid
        let m_c = cu * (big_d / 2.0 - 0.42 * xu_eff) / 1000.0; // kN·m

        // Steel forces (2-layer: top bars at d', bottom bars at d)
        let ast_per_face = ast / 2.0;

        // Bottom steel (tension face)
        let epsilon_s = EPSILON_CU * (d - xu) / xu;
        let fs = (epsilon_s.abs() * 200000.0).min(0.87 * fy) * epsilon_s.signum();
        let force_s = ast_per_face * fs / 1000.0; // kN

        // Top steel (compression face)
        let epsilon_sc = EPSILON_CU * (xu - d_dash) / xu;
        let fsc = (epsilon_sc.abs() * 200000.0).min(0.87 * fy) * epsilon_sc.signum();
        let force_sc = ast_per_face * (fsc - 0.45 * fck) / 1000.0; // kN (deduct concrete area)

        let pu = cu + force_sc - force_s;
        let mu = m_c
            + force_sc * (big_d / 2.0 - d_dash) / 1000.0
            + force_s * (d - big_d / 2.0) / 1000.0;

        curve.push(PMPoint { pu, mu: mu.abs() });
    }

    // Pure compression (Cl. 39.3)
    let p_uz = (0.45 * fck * (b * big_d - ast) + 0.75 * fy * ast) / 1000.0;
    curve.push(PMPoint { pu: p_uz, mu: 0.0 });

    curve
}

/// Interpolate moment capacity from P-M curve at given Pu
fn mu_at_pu(curve: &[PMPoint], pu: f64) -> f64 {
    // Find two bounding points
    let mut best_mu: f64 = 0.0;
    for window in curve.windows(2) {
        let (p0, m0) = (window[0].pu, window[0].mu);
        let (p1, m1) = (window[1].pu, window[1].mu);
        if (pu >= p0.min(p1)) && (pu <= p0.max(p1)) {
            let t = if (p1 - p0).abs() < 1e-10 { 0.5 } else { (pu - p0) / (p1 - p0) };
            let mu_interp = m0 + t * (m1 - m0);
            best_mu = best_mu.max(mu_interp);
        }
    }
    best_mu
}

// ── Biaxial Column Check (Cl. 39.6) ──

/// Result of biaxial column check
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BiaxialColumnResult {
    pub passed: bool,
    pub utilization: f64,
    pub alpha_n: f64,
    pub mux1: f64,  // Uniaxial moment capacity about X (kN·m)
    pub muy1: f64,  // Uniaxial moment capacity about Y (kN·m)
    pub p_uz: f64,  // Squash load (kN)
    pub clause: String,
    pub message: String,
}

/// Check column under biaxial bending per IS 456 Cl. 39.6 (Bresler)
///
/// (Mux/Mux1)^αn + (Muy/Muy1)^αn ≤ 1.0
///
/// αn = 1.0 at Pu/Puz = 0.2, αn = 2.0 at Pu/Puz = 0.8 (linear interpolation)
#[allow(non_snake_case)]
pub fn check_column_biaxial(
    b: f64,       // Width (mm)
    D: f64,       // Depth (mm)
    fck: f64,     // Concrete grade (N/mm²)
    fy: f64,      // Steel grade (N/mm²)
    Pu: f64,      // Factored axial load (kN)
    Mux: f64,     // Factored moment about X (kN·m)
    Muy: f64,     // Factored moment about Y (kN·m)
    Ast: f64,     // Total steel area (mm²)
    d_dash: f64,  // Cover to centre of reinforcement (mm) — default ~50
    Leff_x: f64,  // Effective length about X (mm) — 0 = no slenderness check
    Leff_y: f64,  // Effective length about Y (mm) — 0 = no slenderness check
) -> BiaxialColumnResult {
    let d_dash = if d_dash <= 0.0 { 50.0 } else { d_dash };

    // Slenderness check (Cl. 39.7) — additional moments
    let mut mux_design = Mux.abs();
    let mut muy_design = Muy.abs();

    if Leff_x > 0.0 && (Leff_x / D) > 12.0 {
        let eax = Leff_x * Leff_x / (2000.0 * D); // Additional eccentricity (mm)
        let max = Pu * eax / 1000.0; // Additional moment (kN·m)
        mux_design += max;
    }
    if Leff_y > 0.0 && (Leff_y / b) > 12.0 {
        let eay = Leff_y * Leff_y / (2000.0 * b);
        let may = Pu * eay / 1000.0;
        muy_design += may;
    }

    // Minimum eccentricity (Cl. 25.4)
    let e_min_x = (D / 30.0 + Leff_x / 500.0).max(20.0); // mm
    let e_min_y = (b / 30.0 + Leff_y / 500.0).max(20.0);  // mm
    mux_design = mux_design.max(Pu * e_min_x / 1000.0);
    muy_design = muy_design.max(Pu * e_min_y / 1000.0);

    // Squash load Puz (Cl. 39.6)
    let p_uz = (0.45 * fck * (b * D - Ast) + 0.75 * fy * Ast) / 1000.0;

    // Generate P-M curves for both axes
    let curve_x = pm_interaction_curve(b, D, fck, fy, Ast, d_dash, 50);
    let curve_y = pm_interaction_curve(D, b, fck, fy, Ast, d_dash, 50);

    let mux1 = mu_at_pu(&curve_x, Pu);
    let muy1 = mu_at_pu(&curve_y, Pu);

    // Bresler exponent αn
    let pu_ratio = (Pu / p_uz).clamp(0.0, 1.0);
    let alpha_n = if pu_ratio <= 0.2 {
        1.0
    } else if pu_ratio >= 0.8 {
        2.0
    } else {
        1.0 + (pu_ratio - 0.2) / (0.8 - 0.2) // Linear 1.0 → 2.0
    };

    // Utilization
    let term_x = if mux1 > 1e-6 {
        (mux_design / mux1).powf(alpha_n)
    } else {
        if mux_design > 1e-6 { 999.0 } else { 0.0 }
    };
    let term_y = if muy1 > 1e-6 {
        (muy_design / muy1).powf(alpha_n)
    } else {
        if muy_design > 1e-6 { 999.0 } else { 0.0 }
    };

    let utilization = term_x + term_y;
    let passed = utilization <= 1.0;

    BiaxialColumnResult {
        passed,
        utilization: (utilization * 1000.0).round() / 1000.0,
        alpha_n: (alpha_n * 1000.0).round() / 1000.0,
        mux1: (mux1 * 100.0).round() / 100.0,
        muy1: (muy1 * 100.0).round() / 100.0,
        p_uz: (p_uz * 100.0).round() / 100.0,
        clause: "IS 456:2000 Cl. 39.6".to_string(),
        message: format!(
            "(Mux/Mux1)^{alpha_n:.2} + (Muy/Muy1)^{alpha_n:.2} = {utilization:.3} {} 1.0",
            if passed { "≤" } else { ">" }
        ),
    }
}

// ── Deflection Check (Cl. 23.2) ──

/// Result of deflection check
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DeflectionCheckResult {
    pub passed: bool,
    pub allowable_l_by_d: f64,
    pub basic_l_by_d: f64,
    pub alpha: f64,   // Tension reinforcement factor
    pub beta: f64,    // Compression reinforcement factor
    pub clause: String,
    pub message: String,
}

/// Check deflection per IS 456 Cl. 23.2 using span/depth ratio
///
/// Allowable L/d = basic × α × β
/// - basic = 7 (cantilever), 20 (simply supported), 26 (continuous)
/// - α from Fig 4 based on tension steel stress fs and pt
/// - β from Fig 5 based on compression steel percentage pc
pub fn check_deflection(
    span_mm: f64,
    effective_depth: f64,
    support_type: &str,     // "cantilever", "simply_supported", "continuous"
    pt_percent: f64,        // Tension steel percentage
    pc_percent: f64,        // Compression steel percentage
    fy: f64,                // Steel yield strength (N/mm²)
    actual_ast: f64,        // Actual tension steel area (mm²)
    required_ast: f64,      // Required tension steel area (mm²)
) -> DeflectionCheckResult {
    let basic = match support_type {
        "cantilever" => 7.0,
        "continuous" => 26.0,
        _ => 20.0, // simply_supported default
    };

    // Steel stress under service loads (Cl. 23.2.1)
    let fs = 0.58 * fy * required_ast / actual_ast.max(1.0);

    // Modification factor α (Fig 4 per IS 456 Cl. 23.2.1)
    // α = modification factor for tension reinforcement
    // Interpolation from Fig 4: α depends on fs and pt
    let alpha = {
        let fs_clamped = fs.clamp(100.0, 400.0);
        let pt_clamped = (pt_percent / 100.0).clamp(0.0025, 0.04);
        
        // Approximate formula derived from Fig 4 datapoints
        // For fs=250 N/mm², α ≈ 1.6 at pt=0.5%, decreasing to 1.0 at pt=2%
        let base = 2.0 - 0.5 * (fs_clamped / 250.0);
        let reduction = (pt_clamped - 0.005) / 0.035 * 0.6;
        (base - reduction).clamp(0.8, 2.0)
    };

    // Modification factor β (Fig 5 approximation)
    // β = 1 + pc/(3 + pc) for compression steel
    let beta = if pc_percent > 0.0 {
        1.0 + pc_percent / (3.0 + pc_percent)
    } else {
        1.0
    };

    let allowable = basic * alpha * beta;
    let actual_l_by_d = span_mm / effective_depth;
    let passed = actual_l_by_d <= allowable;

    DeflectionCheckResult {
        passed,
        allowable_l_by_d: (allowable * 100.0).round() / 100.0,
        basic_l_by_d: basic,
        alpha: (alpha * 1000.0).round() / 1000.0,
        beta: (beta * 1000.0).round() / 1000.0,
        clause: "IS 456:2000 Cl. 23.2".to_string(),
        message: format!(
            "L/d = {actual_l_by_d:.1} vs {allowable:.1} (basic={basic} × α={alpha:.2} × β={beta:.2}) → {}",
            if passed { "OK" } else { "FAIL" }
        ),
    }
}

// ── Development Length (Cl. 26.2.1) ──

/// Calculate development length Ld (mm)
pub fn development_length(phi: f64, fy: f64, fck: f64) -> f64 {
    let tau_bd = if fck <= 15.0 { 1.0 }
        else if fck <= 20.0 { 1.2 }
        else if fck <= 25.0 { 1.4 }
        else if fck <= 30.0 { 1.5 }
        else if fck <= 35.0 { 1.7 }
        else { 1.9 };
    let tau_bd = tau_bd * 1.6; // For deformed bars

    let sigma_s = 0.87 * fy;
    phi * sigma_s / (4.0 * tau_bd)
}

// ── Standard Rebar & Stirrup Diameters (IS 1786) ──

/// Standard rebar diameters in mm
const STANDARD_REBAR_DIAMETERS: [f64; 8] = [8.0, 10.0, 12.0, 16.0, 20.0, 25.0, 28.0, 32.0];

/// Standard stirrup diameters in mm
const STANDARD_STIRRUP_DIAMETERS: [f64; 4] = [6.0, 8.0, 10.0, 12.0];

/// Minimum stirrup spacing (mm)
const MIN_STIRRUP_SPACING: f64 = 100.0;

/// Maximum stirrup spacing (mm)
const MAX_STIRRUP_SPACING: f64 = 300.0;

// ── Rebar Selection ──

/// Selected reinforcement configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RebarConfig {
    pub diameter_mm: f64,
    pub count: usize,
    pub area_provided_mm2: f64,
    pub description: String, // e.g. "3-16φ"
}

/// Select standard reinforcement bars that satisfy required area
///
/// Tries to fit with minimum bars and good utilization.
/// Returns the configuration closest to (but >= ) the required area.
pub fn select_reinforcement(ast_required: f64, width_mm: f64) -> RebarConfig {
    let mut best: Option<(f64, f64, usize, f64)> = None; // (excess, dia, count, area)

    // Iterate diameters largest-first for fewer bars
    for &dia in STANDARD_REBAR_DIAMETERS.iter().rev() {
        let bar_area = PI / 4.0 * dia * dia;
        let min_spacing = 20.0_f64;
        let max_bars = ((width_mm - 40.0) / (dia + min_spacing)).floor().max(2.0) as usize;

        for count in 2..=max_bars {
            let provided = count as f64 * bar_area;
            let excess = provided - ast_required;
            if excess >= 0.0 {
                if best.as_ref().map_or(true, |b| excess < b.0) {
                    best = Some((excess, dia, count, provided));
                }
            }
        }
    }

    match best {
        Some((_, dia, count, area)) => RebarConfig {
            diameter_mm: dia,
            count,
            area_provided_mm2: area,
            description: format!("{count}-{dia:.0}φ"),
        },
        None => {
            // Fallback: use 32mm bars with whatever count is needed
            let dia = 32.0;
            let bar_area = PI / 4.0 * dia * dia;
            let count = (ast_required / bar_area).ceil().max(2.0) as usize;
            RebarConfig {
                diameter_mm: dia,
                count,
                area_provided_mm2: count as f64 * bar_area,
                description: format!("{count}-{dia:.0}φ"),
            }
        }
    }
}

// ── Stirrup Design ──

/// Design stirrup spacing for given shear force
///
/// Formula: s = (Asv × 0.87 × fy × d) / Vus
/// where Asv = 2-leg stirrup area
pub fn design_stirrup_spacing(
    vus_kn: f64,
    _b: f64,
    d: f64,
    fy: f64,
) -> (f64, f64, f64) {
    // (stirrup_dia, spacing_mm, asv)
    let fyd = 0.87 * fy;

    for &dia in STANDARD_STIRRUP_DIAMETERS.iter().rev() {
        let asv = 2.0 * PI / 4.0 * dia * dia; // 2-legged
        let required_spacing = (asv * fyd * d) / (vus_kn * 1000.0);
        // Round down to 50mm increments
        let spacing = (required_spacing / 50.0).floor() * 50.0;
        let spacing = spacing.clamp(MIN_STIRRUP_SPACING, MAX_STIRRUP_SPACING);

        if spacing >= MIN_STIRRUP_SPACING {
            return (dia, spacing, asv);
        }
    }

    // Fallback
    let dia = STANDARD_STIRRUP_DIAMETERS[0]; // 6mm
    let asv = 2.0 * PI / 4.0 * dia * dia;
    (dia, MIN_STIRRUP_SPACING, asv)
}

// ── Limiting Moment (Cl. 38.1) ──

/// Limiting moment result
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LimitingMomentResult {
    pub mu_lim_knm: f64,
    pub xu_lim_mm: f64,
    pub z_lim_mm: f64,
    pub r_lim: f64,
}

/// Calculate limiting moment of resistance per IS 456 Cl. 38.1
pub fn limiting_moment(b: f64, d: f64, fck: f64, fy: f64) -> LimitingMomentResult {
    let xu_ratio = xu_max_ratio(fy);
    let xu_lim = xu_ratio * d;
    let z_lim = d - 0.42 * xu_lim;
    let mu_lim = 0.36 * fck * b * xu_lim * z_lim / 1e6;
    let r_lim = mu_lim * 1e6 / (b * d * d);

    LimitingMomentResult {
        mu_lim_knm: mu_lim,
        xu_lim_mm: xu_lim,
        z_lim_mm: z_lim,
        r_lim,
    }
}

// ── Bending Design Result ──

/// Complete bending design result
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BendingDesignResult {
    pub design_type: String, // "singly_reinforced" or "doubly_reinforced"
    pub ast_required_mm2: f64,
    pub asc_required_mm2: f64,
    pub xu_mm: f64,
    pub z_mm: f64,
    pub mu_provided_knm: f64,
    pub pt_percent: f64,
    pub main_rebar: RebarConfig,
    pub comp_rebar: Option<RebarConfig>,
    pub mu_ratio: f64,
}

/// Design singly reinforced beam for bending
pub fn design_bending_singly(
    mu_knm: f64,
    b: f64,
    d: f64,
    fck: f64,
    fy: f64,
) -> BendingDesignResult {
    let fyd = 0.87 * fy;

    // Moment coefficient K = Mu / (fck·b·d²)
    let k = mu_knm * 1e6 / (fck * b * d * d);
    // Quadratic: 0.1512·m² - 0.36·m + K = 0
    let disc = 0.36_f64 * 0.36 - 4.0 * 0.1512 * k;
    let m = if disc >= 0.0 {
        let m1 = (0.36 + disc.sqrt()) / (2.0 * 0.1512);
        let m2 = (0.36 - disc.sqrt()) / (2.0 * 0.1512);
        m1.min(m2)
    } else {
        xu_max_ratio(fy) // fallback
    };
    let xu = m * d;
    let z = (d - 0.42 * xu).max(0.95 * d);

    let ast_required = mu_knm * 1e6 / (fyd * z);
    let main_rebar = select_reinforcement(ast_required, b);
    let mu_provided = fyd * main_rebar.area_provided_mm2 * z / 1e6;
    let pt = main_rebar.area_provided_mm2 / (b * d) * 100.0;

    BendingDesignResult {
        design_type: "singly_reinforced".into(),
        ast_required_mm2: ast_required,
        asc_required_mm2: 0.0,
        xu_mm: xu,
        z_mm: z,
        mu_provided_knm: mu_provided,
        pt_percent: pt,
        main_rebar,
        comp_rebar: None,
        mu_ratio: mu_knm / mu_provided,
    }
}

/// Design doubly reinforced beam for bending (Mu > Mu_lim)
pub fn design_bending_doubly(
    mu_knm: f64,
    mu_lim_knm: f64,
    b: f64,
    d: f64,
    d_prime: f64,
    _fck: f64,
    fy: f64,
) -> BendingDesignResult {
    let fyd = 0.87 * fy;
    let xu_lim = xu_max_ratio(fy) * d;
    let z_lim = d - 0.42 * xu_lim;

    // Compression steel for excess moment
    let mu_excess = mu_knm - mu_lim_knm;
    let asc_required = (mu_excess * 1e6 / (fyd * (d - d_prime))).min(0.04 * b * d);
    let comp_rebar = select_reinforcement(asc_required, b);

    // Tension steel: part 1 for Mu_lim, part 2 = Asc
    let ast1 = mu_lim_knm * 1e6 / (fyd * z_lim);
    let ast2 = comp_rebar.area_provided_mm2;
    let ast_required = ast1 + ast2;
    let main_rebar = select_reinforcement(ast_required, b);

    let mu_provided = fyd * main_rebar.area_provided_mm2 * z_lim / 1e6
        + fyd * comp_rebar.area_provided_mm2 * (d - d_prime) / 1e6;
    let pt = main_rebar.area_provided_mm2 / (b * d) * 100.0;

    BendingDesignResult {
        design_type: "doubly_reinforced".into(),
        ast_required_mm2: ast_required,
        asc_required_mm2: asc_required,
        xu_mm: xu_lim,
        z_mm: z_lim,
        mu_provided_knm: mu_provided,
        pt_percent: pt,
        main_rebar,
        comp_rebar: Some(comp_rebar),
        mu_ratio: mu_knm / mu_provided,
    }
}
// ── Tests ──

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_table_19_tc_interpolation() {
        // Test M20 concrete at 1.0% steel
        let tc = table_19_tc(20.0, 1.0);
        assert!((tc - 0.62).abs() < 0.05, "M20 @ 1.0% should be ~0.62 N/mm²");
        
        // Test M30 concrete scaling
        let tc_m30 = table_19_tc(30.0, 1.0);
        assert!(tc_m30 > tc, "M30 should have higher τc than M20");
        assert!(tc_m30 < 0.63 * (30.0_f64).sqrt(), "Must stay below Table 20 max");
    }

    #[test]
    fn test_xu_max_ratio() {
        let xu_250 = xu_max_ratio(250.0);
        let xu_415 = xu_max_ratio(415.0);
        let xu_500 = xu_max_ratio(500.0);
        
        assert_eq!(xu_250, 0.53);
        assert_eq!(xu_415, 0.48);
        assert_eq!(xu_500, 0.46);
        assert!(xu_250 > xu_500, "Lower grade steel allows deeper NA");
    }

    #[test]
    fn test_flexural_capacity_singly() {
        // 300mm × 500mm beam, d=450mm, M25, Fe415, Ast=1256mm² (4×20Ø)
        let ast = 4.0 * 314.0;
        let mu = flexural_capacity_singly(300.0, 450.0, 25.0, 415.0, ast);
        
        // Expected: ~170-190 kN·m for this section
        assert!(mu > 150.0 && mu < 200.0, "Mu should be 150-200 kN·m, got {}", mu);
    }

    #[test]
    fn test_limiting_moment() {
        let result = limiting_moment(250.0, 450.0, 25.0, 415.0);
        
        assert!(result.xu_lim_mm > 0.0);
        assert!(result.z_lim_mm > 0.0);
        assert!(result.mu_lim_knm > 100.0 && result.mu_lim_knm < 200.0,
            "250×450 M25 Fe415 Mu_lim should be ~175 kN·m, got {}", result.mu_lim_knm);
        assert_eq!(result.xu_lim_mm / 450.0, xu_max_ratio(415.0));
    }

    #[test]
    fn test_shear_stirrup_design() {
        // Design stirrups for Vus = 80 kN, b=300mm, d=450mm, Fe415
        let (dia, spacing, asv) = design_stirrup_spacing(80.0, 300.0, 450.0, 415.0);
        
        assert!(dia >= 6.0 && dia <= 12.0, "Stirrup dia should be 6-12mm");
        assert!(spacing >= 75.0, "Min spacing 75mm per Cl. 26.5.1.5");
        assert!(spacing <= 0.75 * 450.0, "Max spacing 0.75d per Cl. 40.4");
        assert!(asv > 0.0);
    }

    #[test]
    fn test_design_bending_singly() {
        let result = design_bending_singly(120.0, 300.0, 450.0, 25.0, 415.0);
        
        assert_eq!(result.design_type, "singly_reinforced");
        assert!(result.ast_required_mm2 > 600.0);
        assert!(result.xu_mm > 0.0 && result.xu_mm < 450.0);
        assert!(result.mu_provided_knm >= 120.0);
        assert!(result.pt_percent > 0.4 && result.pt_percent < 4.0);
        assert!(result.main_rebar.area_provided_mm2 >= result.ast_required_mm2);
    }
}
// ── Complete LSD Beam Design ──

/// Complete LSD design output matching Python LimitStateDesignBeam
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LSDBeamDesignResult {
    // Section
    pub b_mm: f64,
    pub d_mm: f64,
    pub d_prime_mm: f64,
    pub fck: f64,
    pub fy: f64,
    // Loads
    pub mu_knm: f64,
    pub vu_kn: f64,
    // Limiting moment
    pub limiting_moment: LimitingMomentResult,
    // Bending design
    pub bending: BendingDesignResult,
    // Shear design
    pub shear: ShearCheckResult,
    // Summary
    pub rebar_summary: String,
    pub design_status: String,   // "PASS" or "FAIL"
    pub design_ratio: f64,
    pub messages: Vec<String>,
}

/// Master LSD beam design algorithm per IS 456:2000
///
/// This is the Rust equivalent of Python's `LimitStateDesignBeam.design()`.
/// Complete workflow:
/// 1. Calculate limiting moment (Cl. 38.1)
/// 2. Design bending — singly or doubly reinforced (Cl. 38.2/38.3)
/// 3. Design shear reinforcement (Cl. 40)
/// 4. Select actual rebar configurations
/// 5. Return comprehensive result with rebar specifications
pub fn design_rc_beam_lsd(
    b: f64,          // Width (mm)
    d: f64,          // Effective depth (mm)
    d_prime: f64,    // Cover to compression steel centre (mm), typ. 50
    fck: f64,        // Concrete grade (N/mm²): 20, 25, 30, 35, 40
    fy: f64,         // Steel grade (N/mm²): 415, 500
    mu_knm: f64,     // Ultimate factored moment (kN·m)
    vu_kn: f64,      // Ultimate factored shear (kN)
) -> LSDBeamDesignResult {
    let mut messages: Vec<String> = Vec::new();

    // ── Step 1: Limiting Moment (Cl. 38.1) ──
    let lim = limiting_moment(b, d, fck, fy);
    messages.push(format!("Limiting moment: {:.2} kN·m", lim.mu_lim_knm));

    // ── Step 2: Bending Design ──
    let bending = if mu_knm <= lim.mu_lim_knm {
        messages.push("Design Type: Singly Reinforced".into());
        design_bending_singly(mu_knm, b, d, fck, fy)
    } else {
        messages.push("Design Type: Doubly Reinforced".into());
        design_bending_doubly(mu_knm, lim.mu_lim_knm, b, d, d_prime, fck, fy)
    };

    // ── Step 3: Shear Design ──
    // Use 2-legged 8mm stirrups as default Asv for initial check
    let asv_default = 2.0 * PI / 4.0 * 8.0 * 8.0; // ~100.5 mm²
    let mut shear = design_shear(vu_kn, b, d, fck, fy, bending.pt_percent, asv_default);

    // Design stirrup spacing if needed
    if shear.vus > 0.0 {
        let (dia, spacing, _asv) = design_stirrup_spacing(shear.vus, b, d, fy);
        shear.spacing_mm = spacing;
        shear.message = format!(
            "τv = {:.3} vs τc = {:.3} N/mm², stirrups {dia:.0}φ @ {spacing:.0} c/c",
            shear.tau_v, shear.tau_c
        );
    }

    // ── Step 4: Summary ──
    let comp_desc = match &bending.comp_rebar {
        Some(c) => format!("Top: {}", c.description),
        None => "Top: 2-10φ (min)".into(),
    };
    let stirrup_desc = if shear.vus > 0.0 {
        format!("Shear: {:.0}φ @ {:.0} c/c", 8.0, shear.spacing_mm)
    } else {
        format!("Shear: 8φ @ {:.0} c/c (min)", MAX_STIRRUP_SPACING)
    };
    let rebar_summary = format!(
        "Bottom: {} | {} | {}",
        bending.main_rebar.description, comp_desc, stirrup_desc
    );

    // Design ratio: max(bending ratio, shear ratio against τc_max Table 20)
    let tau_c_max_val = 0.63 * fck.sqrt();
    let shear_ratio = if tau_c_max_val > 0.0 { shear.tau_v / tau_c_max_val } else { 0.0 };
    let design_ratio = bending.mu_ratio.abs().max(shear_ratio);
    let design_status = if design_ratio <= 1.0 { "PASS" } else { "FAIL" };

    LSDBeamDesignResult {
        b_mm: b,
        d_mm: d,
        d_prime_mm: d_prime,
        fck,
        fy,
        mu_knm,
        vu_kn,
        limiting_moment: lim,
        bending,
        shear,
        rebar_summary,
        design_status: design_status.into(),
        design_ratio,
        messages,
    }
}

#[cfg(test)]
mod lsd_tests {
    use super::*;

    #[test]
    fn test_table_19_tc() {
        let tc = table_19_tc(20.0, 1.0);
        assert!((tc - 0.62).abs() < 0.05, "τc(M20, 1%) should be ~0.62, got {tc}");
    }

    #[test]
    fn test_flexural_capacity() {
        // 300×500 beam, M25, Fe500, 3×20mm bars (942 mm²)
        let mu = flexural_capacity_singly(300.0, 450.0, 25.0, 500.0, 942.0);
        assert!(mu > 100.0 && mu < 250.0, "Mu should be reasonable: {mu}");
    }

    #[test]
    fn test_biaxial_column() {
        let result = check_column_biaxial(
            400.0, 400.0, 25.0, 415.0,
            1200.0, 100.0, 80.0, 2400.0,
            50.0, 0.0, 0.0,
        );
        assert!(result.passed, "Should pass: util={}", result.utilization);
        assert!(result.utilization < 1.0);
    }

    #[test]
    fn test_shear_design() {
        let result = design_shear(150.0, 300.0, 450.0, 25.0, 415.0, 1.0, 157.0);
        assert!(result.passed);
        assert!(result.spacing_mm > 0.0);
    }

    #[test]
    fn test_lsd_beam_design_singly() {
        // 300×600 beam, M30, Fe500, Mu=200 kN·m, Vu=100 kN
        let result = design_rc_beam_lsd(300.0, 600.0, 50.0, 30.0, 500.0, 200.0, 100.0);
        assert_eq!(result.design_status, "PASS");
        assert!(result.design_ratio < 1.0, "ratio={}", result.design_ratio);
        assert_eq!(result.bending.design_type, "singly_reinforced");
        assert!(result.bending.main_rebar.area_provided_mm2 > 0.0);
        assert!(!result.rebar_summary.is_empty());
    }

    #[test]
    fn test_lsd_beam_design_doubly() {
        // 250×400 beam, M20, Fe415, Mu=250 kN·m (high moment → doubly)
        let result = design_rc_beam_lsd(250.0, 400.0, 50.0, 20.0, 415.0, 250.0, 120.0);
        // High moment on small section → likely doubly reinforced
        assert!(!result.rebar_summary.is_empty());
        assert!(result.bending.ast_required_mm2 > 0.0);
    }

    #[test]
    fn test_rebar_selection() {
        let cfg = select_reinforcement(1200.0, 300.0);
        assert!(cfg.area_provided_mm2 >= 1200.0);
        assert!(cfg.count >= 2);
        assert!(!cfg.description.is_empty());
    }

    #[test]
    fn test_development_length() {
        let ld = development_length(16.0, 500.0, 25.0);
        assert!(ld > 200.0 && ld < 1000.0, "Ld should be reasonable: {ld}");
    }

    #[test]
    fn test_limiting_moment() {
        let lim = limiting_moment(300.0, 500.0, 25.0, 500.0);
        assert!(lim.mu_lim_knm > 100.0, "Mu_lim should be > 100 kN·m: {}", lim.mu_lim_knm);
        assert!(lim.xu_lim_mm > 0.0);
        assert!(lim.z_lim_mm > 0.0);
    }
}
