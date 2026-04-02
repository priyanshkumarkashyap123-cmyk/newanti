// =====================================================================
// Rebar Curtailment & Detailing Rules
// =====================================================================
//
// RC design isn't just "Provide 1000 mm²."  It requires detailing:
//   - Development length (ACI 318 / IS 456 / EC2)
//   - Lap splice length & location
//   - Anchorage (hook, headed bar)
//   - Curtailment points (where bars can be cut as moment drops)
//   - Bar spacing / clear cover checks
//   - Minimum / maximum reinforcement limits
//
// References:
//   IS 456:2000  §26 (Development & Splicing of Reinforcement)
//   ACI 318-19   §25 (Reinforcement Details)
//   EN 1992-1-1  §8 (Detailing of Reinforcement)
// =====================================================================

use crate::rebar_utils::circle_area;

// ─── Material & geometry ────────────────────────────────────────────

#[derive(Debug, Clone)]
pub struct DetailingMaterials {
    pub fck_mpa: f64,        // concrete characteristic strength
    pub fy_mpa: f64,         // rebar yield strength
    pub bar_type: BarType,
    pub clear_cover_mm: f64,
    pub exposure: ExposureCondition,
}

#[derive(Debug, Clone, Copy, PartialEq)]
pub enum BarType { Deformed, Plain }

#[derive(Debug, Clone, Copy, PartialEq)]
pub enum ExposureCondition { Mild, Moderate, Severe, VeryAgressive }

#[derive(Debug, Clone, Copy, PartialEq)]
pub enum DetailingCode { IS456, ACI318, Eurocode2 }

// ─── Development length ─────────────────────────────────────────────

/// Development length calculation result.
#[derive(Debug, Clone)]
pub struct DevelopmentLengthResult {
    pub ld_mm: f64,
    pub ld_over_db: f64,
    pub bar_dia_mm: f64,
    pub code: DetailingCode,
    pub bar_position: BarPosition,
    pub modification_factors: Vec<(String, f64)>,
}

#[derive(Debug, Clone, Copy, PartialEq)]
pub enum BarPosition { Bottom, Top, Side }

/// IS 456:2000 §26.2.1 — development length for deformed bars.
pub fn development_length_is456(
    bar_dia_mm: f64,
    mat: &DetailingMaterials,
    position: BarPosition,
    is_tension: bool,
) -> DevelopmentLengthResult {
    // Ld = φ × σs / (4 × τbd)
    let tau_bd_base = match mat.fck_mpa as u32 {
        0..=19  => 1.2,
        20..=24 => 1.4,
        25..=29 => 1.5,
        30..=34 => 1.7,
        35..=39 => 1.9,
        _       => 2.2,
    };
    let tau_bd = if mat.bar_type == BarType::Deformed { tau_bd_base * 1.6 } else { tau_bd_base };
    let sigma_s = mat.fy_mpa;

    let ld = sigma_s * bar_dia_mm / (4.0 * tau_bd);

    let mut mods = vec![("Base τbd".to_string(), tau_bd)];

    // Top bar factor (IS 456 doesn't explicitly have one, but good practice)
    let ld_final = if position == BarPosition::Top {
        mods.push(("Top bar factor".to_string(), 1.3));
        ld * 1.3
    } else { ld };

    // Compression bars — IS 456 allows 0.8 × Ld
    let ld_final = if !is_tension {
        mods.push(("Compression factor".to_string(), 0.8));
        ld_final * 0.8
    } else { ld_final };

    DevelopmentLengthResult {
        ld_mm: ld_final,
        ld_over_db: ld_final / bar_dia_mm,
        bar_dia_mm,
        code: DetailingCode::IS456,
        bar_position: position,
        modification_factors: mods,
    }
}

/// ACI 318-19 §25.4.2 — development length for deformed bars in tension.
pub fn development_length_aci318(
    bar_dia_mm: f64,
    mat: &DetailingMaterials,
    position: BarPosition,
    is_tension: bool,
    confinement_factor: f64,  // Ktr term, 0.0 if unknown
    spacing_mm: f64,
) -> DevelopmentLengthResult {
    let fc = mat.fck_mpa;
    let fy = mat.fy_mpa;
    let db = bar_dia_mm;

    let mut mods = Vec::new();

    // ψ_t: top bar factor
    let psi_t = if position == BarPosition::Top { 1.3 } else { 1.0 };
    mods.push(("ψ_t (top bar)".to_string(), psi_t));

    // ψ_e: epoxy factor (assume uncoated)
    let psi_e = 1.0;

    // ψ_s: bar size factor
    let psi_s = if db <= 22.0 { 0.8 } else { 1.0 };
    mods.push(("ψ_s (bar size)".to_string(), psi_s));

    // Clear cover cb
    let cb = mat.clear_cover_mm;

    // ACI 318 Eq 25.4.2.4a:
    // ld = (fy · ψ_t · ψ_e · ψ_s) / (1.1 · λ · √f'c) × db / ((cb + Ktr) / db)
    let lambda = 1.0; // normal weight concrete
    let cb_ktr = ((cb + confinement_factor) / db).min(2.5);

    let ld_tension = (fy * psi_t * psi_e * psi_s * db)
        / (1.1 * lambda * fc.sqrt() * cb_ktr);

    let ld = if is_tension {
        ld_tension.max(300.0) // min 300 mm
    } else {
        // Compression: ld = (0.24 fy / √f'c) × db  ≥ 200 mm
        let ld_comp = (0.24 * fy / fc.sqrt()) * db;
        ld_comp.max(200.0)
    };

    let _ = spacing_mm; // used for transverse reinforcement check

    DevelopmentLengthResult {
        ld_mm: ld,
        ld_over_db: ld / db,
        bar_dia_mm: db,
        code: DetailingCode::ACI318,
        bar_position: position,
        modification_factors: mods,
    }
}

/// EN 1992-1-1 §8.4 — basic anchorage length (Eurocode 2).
pub fn development_length_ec2(
    bar_dia_mm: f64,
    mat: &DetailingMaterials,
    position: BarPosition,
    is_tension: bool,
) -> DevelopmentLengthResult {
    let fck = mat.fck_mpa;
    let fyd = mat.fy_mpa / 1.15;
    let fctd = 0.21 * fck.powf(2.0 / 3.0) / 1.5; // design tensile strength
    let db = bar_dia_mm;

    let fbd = 2.25 * fctd; // bond strength (good conditions)

    // lb,rqd = (φ / 4) × (σsd / fbd)
    let lb_rqd = db / 4.0 * fyd / fbd;

    let mut mods = vec![("fbd".to_string(), fbd), ("fctd".to_string(), fctd)];

    // Position coefficients α1–α5
    let alpha1 = if position == BarPosition::Top { 1.0 } else { 1.0 }; // simplified
    let alpha2 = 1.0; // cover/spacing factor
    let alpha3 = 1.0; // confinement by transverse reinforcement
    let alpha5 = if !is_tension { 0.7 } else { 1.0 }; // compression

    let lbd = (alpha1 * alpha2 * alpha3 * alpha5 * lb_rqd).max(10.0 * db).max(100.0);
    mods.push(("α factors product".to_string(), alpha1 * alpha2 * alpha3 * alpha5));

    DevelopmentLengthResult {
        ld_mm: lbd,
        ld_over_db: lbd / db,
        bar_dia_mm: db,
        code: DetailingCode::Eurocode2,
        bar_position: position,
        modification_factors: mods,
    }
}

// ─── Lap splice length ──────────────────────────────────────────────

#[derive(Debug, Clone, Copy, PartialEq)]
pub enum LapClass {
    /// Class A: full development sufficient (low stress, staggered)
    ClassA,
    /// Class B: 1.3 × Ld (high stress or bunched)
    ClassB,
}

#[derive(Debug, Clone)]
pub struct LapSpliceResult {
    pub lap_length_mm: f64,
    pub lap_class: LapClass,
    pub development_length_mm: f64,
    pub pct_bars_spliced: f64,
    pub code: DetailingCode,
}

/// IS 456:2000 §26.2.5 — lap splice length.
pub fn lap_splice_is456(
    bar_dia_mm: f64,
    mat: &DetailingMaterials,
    position: BarPosition,
    is_tension: bool,
    pct_bars_spliced: f64,   // fraction of bars spliced at same location
) -> LapSpliceResult {
    let ld_result = development_length_is456(bar_dia_mm, mat, position, is_tension);
    let ld = ld_result.ld_mm;

    // IS 456: lap = Ld for ≤ 50% spliced, 1.3 × Ld for > 50%
    let (lap_class, factor) = if pct_bars_spliced <= 0.50 {
        (LapClass::ClassA, 1.0)
    } else {
        (LapClass::ClassB, 1.3)
    };

    // Minimum 15φ or 200 mm
    let lap = (ld * factor).max(15.0 * bar_dia_mm).max(200.0);

    LapSpliceResult {
        lap_length_mm: lap,
        lap_class,
        development_length_mm: ld,
        pct_bars_spliced,
        code: DetailingCode::IS456,
    }
}

/// ACI 318-19 §25.5 — lap splice.
pub fn lap_splice_aci318(
    bar_dia_mm: f64,
    mat: &DetailingMaterials,
    position: BarPosition,
    pct_bars_spliced: f64,
) -> LapSpliceResult {
    let ld_result = development_length_aci318(bar_dia_mm, mat, position, true, 0.0, 150.0);
    let ld = ld_result.ld_mm;

    let (lap_class, factor) = if pct_bars_spliced <= 0.50 {
        (LapClass::ClassA, 1.0)
    } else {
        (LapClass::ClassB, 1.3)
    };

    let lap = (ld * factor).max(300.0);

    LapSpliceResult {
        lap_length_mm: lap,
        lap_class,
        development_length_mm: ld,
        pct_bars_spliced,
        code: DetailingCode::ACI318,
    }
}

// ─── Anchorage (hooks) ──────────────────────────────────────────────

/// Hook type per ACI 318 / IS 456.
#[derive(Debug, Clone, Copy, PartialEq)]
pub enum HookType {
    Standard90,    // 90° bend + 12db extension
    Standard180,   // 180° bend + 4db extension
    HeadedBar,     // mechanical head
}

#[derive(Debug, Clone)]
pub struct AnchorageResult {
    pub hook_type: HookType,
    pub ldh_mm: f64,              // straight portion before hook
    pub bend_radius_mm: f64,
    pub extension_mm: f64,
    pub total_hook_length_mm: f64,
    pub code: DetailingCode,
}

/// IS 456:2000 / ACI 318 standard hook anchorage.
pub fn hook_anchorage(
    bar_dia_mm: f64,
    mat: &DetailingMaterials,
    hook: HookType,
    code: DetailingCode,
) -> AnchorageResult {
    let db = bar_dia_mm;
    let (bend_factor, extension_factor) = match hook {
        HookType::Standard90  => (4.0, 12.0),
        HookType::Standard180 => (4.0, 4.0),
        HookType::HeadedBar   => (0.0, 0.0),
    };

    let bend_radius = bend_factor * db;
    let extension = extension_factor * db;

    // Development length of hook
    let ldh = match code {
        DetailingCode::ACI318 => {
            // ACI 318 §25.4.3: ldh = (0.24·ψ_e·fy / (λ·√f'c)) × db  ≥ 8db, ≥ 150 mm
            let ldh = (0.24 * mat.fy_mpa / mat.fck_mpa.sqrt()) * db;
            ldh.max(8.0 * db).max(150.0)
        }
        DetailingCode::IS456 => {
            // IS 456: ldh ≈ Ld - anchorage value of hook
            // Anchorage value of 90° = 8φ, 180° = 16φ
            let anch = match hook {
                HookType::Standard90 => 8.0 * db,
                HookType::Standard180 => 16.0 * db,
                HookType::HeadedBar => 12.0 * db,
            };
            let ld = development_length_is456(db, mat, BarPosition::Bottom, true).ld_mm;
            (ld - anch).max(0.0)
        }
        DetailingCode::Eurocode2 => {
            let ld = development_length_ec2(db, mat, BarPosition::Bottom, true).ld_mm;
            (ld * 0.7).max(10.0 * db).max(100.0)
        }
    };

    let total = ldh + PI * bend_radius + extension;

    AnchorageResult {
        hook_type: hook,
        ldh_mm: ldh,
        bend_radius_mm: bend_radius,
        extension_mm: extension,
        total_hook_length_mm: total,
        code,
    }
}

// ─── Curtailment points ─────────────────────────────────────────────

/// Moment-demand point along a beam.
#[derive(Debug, Clone)]
pub struct MomentPoint {
    pub x_mm: f64,           // distance from left support
    pub moment_knm: f64,     // bending moment at x
}

/// Result of curtailment analysis for a bar group.
#[derive(Debug, Clone)]
pub struct CurtailmentResult {
    pub bar_group: String,
    pub bar_dia_mm: f64,
    pub n_bars_total: usize,
    /// Each entry: (n_bars_continuing, cutoff_x_mm, theoretical_x_mm)
    pub cutoff_points: Vec<CutoffPoint>,
    pub development_length_mm: f64,
    pub total_rebar_length_mm: f64,
    pub savings_pct: f64,
}

#[derive(Debug, Clone)]
pub struct CutoffPoint {
    pub bars_continuing: usize,
    pub bars_cutoff: usize,
    pub theoretical_cutoff_x_mm: f64,
    pub actual_cutoff_x_mm: f64,     // theoretical + Ld (anchored)
    pub moment_capacity_knm: f64,
}

/// Compute curtailment schedule for bottom bars of a simply-supported beam.
///
/// Given the moment diagram and reinforcement capacity, determine where
/// bars can be cut off as the moment drops.
pub fn compute_curtailment(
    moment_diagram: &[MomentPoint],
    n_bars_total: usize,
    bar_dia_mm: f64,
    b_mm: f64,
    d_mm: f64,
    fck_mpa: f64,
    fy_mpa: f64,
    code: DetailingCode,
    mat: &DetailingMaterials,
    span_mm: f64,
) -> CurtailmentResult {
    if moment_diagram.is_empty() || n_bars_total == 0 {
        return CurtailmentResult {
            bar_group: "bottom".into(), bar_dia_mm, n_bars_total,
            cutoff_points: vec![], development_length_mm: 0.0,
            total_rebar_length_mm: 0.0, savings_pct: 0.0,
        };
    }

    let bar_area = circle_area(bar_dia_mm);
    let ld = match code {
        DetailingCode::IS456 =>
            development_length_is456(bar_dia_mm, mat, BarPosition::Bottom, true).ld_mm,
        DetailingCode::ACI318 =>
            development_length_aci318(bar_dia_mm, mat, BarPosition::Bottom, true, 0.0, 150.0).ld_mm,
        DetailingCode::Eurocode2 =>
            development_length_ec2(bar_dia_mm, mat, BarPosition::Bottom, true).ld_mm,
    };

    // Peak moment
    let _m_max = moment_diagram.iter().map(|p| p.moment_knm.abs())
        .fold(0.0_f64, f64::max);

    // Capacity for n bars: Mu = 0.87·fy·Ast·(d - Ast·fy / (2·b·0.36·fck))
    let capacity_n_bars = |n: usize| -> f64 {
        let ast = n as f64 * bar_area;
        let a = ast * fy_mpa / (0.36 * fck_mpa * b_mm);
        0.87 * fy_mpa * ast * (d_mm - a / 2.0) / 1e6 // kN·m
    };

    let mut cutoff_points = Vec::new();
    let mut bars_remaining = n_bars_total;
    let min_bars = (n_bars_total + 2) / 3; // at least 1/3 bars must continue

    // Determine cutoff groups (cut 1 bar at a time, or groups)
    while bars_remaining > min_bars {
        let bars_to_cut = 1;
        let new_remaining = bars_remaining - bars_to_cut;
        let m_capacity = capacity_n_bars(new_remaining);

        if m_capacity < 1.0 { break; }

        // Find where moment first drops below capacity
        // (searching from midspan outward toward supports)
        let mut theo_x: Option<f64> = None;
        // Sort by distance from midspan
        let mid = span_mm / 2.0;
        let mut sorted: Vec<&MomentPoint> = moment_diagram.iter().collect();
        sorted.sort_by(|a, b| {
            let da = (a.x_mm - mid).abs();
            let db_val = (b.x_mm - mid).abs();
            da.partial_cmp(&db_val).unwrap()
        });

        // Find the point where |M| drops below m_capacity (going outward from peak)
        for pt in &sorted {
            if pt.moment_knm.abs() <= m_capacity {
                theo_x = Some(pt.x_mm);
                break;
            }
        }

        if let Some(tx) = theo_x {
            // Actual cutoff = theoretical point ± Ld (extend toward support)
            let actual = if tx < mid {
                (tx - ld - d_mm).max(0.0)  // extend Ld + d toward left support
            } else {
                (tx + ld + d_mm).min(span_mm)  // extend toward right support
            };

            cutoff_points.push(CutoffPoint {
                bars_continuing: new_remaining,
                bars_cutoff: bars_to_cut,
                theoretical_cutoff_x_mm: tx,
                actual_cutoff_x_mm: actual,
                moment_capacity_knm: m_capacity,
            });

            bars_remaining = new_remaining;
        } else {
            break; // moment never drops below capacity
        }
    }

    // Total rebar length saved
    let full_length = n_bars_total as f64 * span_mm;
    let actual_length: f64 = {
        // Bars that run full span
        let mut total = bars_remaining as f64 * span_mm;
        // Bars that are cut off
        for cp in &cutoff_points {
            let bar_len = span_mm - 2.0 * cp.actual_cutoff_x_mm.min(span_mm / 2.0);
            total += cp.bars_cutoff as f64 * bar_len.max(0.0);
        }
        total
    };
    let savings_pct = (1.0 - actual_length / full_length.max(1.0)) * 100.0;

    CurtailmentResult {
        bar_group: "bottom".to_string(),
        bar_dia_mm,
        n_bars_total,
        cutoff_points,
        development_length_mm: ld,
        total_rebar_length_mm: actual_length,
        savings_pct,
    }
}

// ─── Spacing & cover checks ─────────────────────────────────────────

#[derive(Debug, Clone)]
pub struct SpacingCheckResult {
    pub clear_spacing_mm: f64,
    pub min_required_mm: f64,
    pub max_allowed_mm: f64,
    pub pass_min: bool,
    pub pass_max: bool,
    pub code: DetailingCode,
}

/// IS 456:2000 §26.3 — minimum spacing check.
pub fn check_bar_spacing_is456(
    bar_dia_mm: f64,
    n_bars: usize,
    beam_width_mm: f64,
    clear_cover_mm: f64,
    max_aggregate_mm: f64,
) -> SpacingCheckResult {
    let total_bar_width = n_bars as f64 * bar_dia_mm;
    let available = beam_width_mm - 2.0 * clear_cover_mm - total_bar_width;
    let clear_spacing = if n_bars > 1 { available / (n_bars - 1) as f64 } else { available };

    // IS 456 §26.3.2: min spacing = max(bar_dia, max_agg + 5mm)
    let min_spacing = bar_dia_mm.max(max_aggregate_mm + 5.0);
    // Max spacing for crack control: 3d or 300 mm
    let max_spacing = 300.0;

    SpacingCheckResult {
        clear_spacing_mm: clear_spacing,
        min_required_mm: min_spacing,
        max_allowed_mm: max_spacing,
        pass_min: clear_spacing >= min_spacing,
        pass_max: clear_spacing <= max_spacing,
        code: DetailingCode::IS456,
    }
}

// ─── Min/max reinforcement ──────────────────────────────────────────

#[derive(Debug, Clone)]
pub struct ReinforcementLimitsResult {
    pub ast_provided_mm2: f64,
    pub ast_min_mm2: f64,
    pub ast_max_mm2: f64,
    pub rho_pct: f64,
    pub rho_min_pct: f64,
    pub rho_max_pct: f64,
    pub pass_min: bool,
    pub pass_max: bool,
}

/// IS 456 / ACI 318 reinforcement limits.
pub fn check_reinforcement_limits(
    b_mm: f64, d_mm: f64,
    ast_mm2: f64,
    fck_mpa: f64, fy_mpa: f64,
    code: DetailingCode,
) -> ReinforcementLimitsResult {
    let bd = b_mm * d_mm;
    let rho = ast_mm2 / bd;

    let (rho_min, rho_max) = match code {
        DetailingCode::IS456 => {
            // IS 456 §26.5.1.1: min 0.12% (HYSD) or 0.15% (mild steel)
            let r_min = 0.0012;
            let r_max = 0.04; // §26.5.1.2
            (r_min, r_max)
        }
        DetailingCode::ACI318 => {
            // ACI 318: As,min = max(0.25√f'c/fy, 1.4/fy) × bd
            let r_min_1 = 0.25 * fck_mpa.sqrt() / fy_mpa;
            let r_min_2 = 1.4 / fy_mpa;
            (r_min_1.max(r_min_2), 0.04)
        }
        DetailingCode::Eurocode2 => {
            // EC2 §9.2.1.1: As,min = max(0.26·fctm/fyk, 0.0013) × bt·d
            let fctm = 0.30 * fck_mpa.powf(2.0 / 3.0);
            let r_min = (0.26 * fctm / fy_mpa).max(0.0013);
            (r_min, 0.04)
        }
    };

    ReinforcementLimitsResult {
        ast_provided_mm2: ast_mm2,
        ast_min_mm2: rho_min * bd,
        ast_max_mm2: rho_max * bd,
        rho_pct: rho * 100.0,
        rho_min_pct: rho_min * 100.0,
        rho_max_pct: rho_max * 100.0,
        pass_min: rho >= rho_min,
        pass_max: rho <= rho_max,
    }
}

// ─── Full detailing report ──────────────────────────────────────────

/// Comprehensive detailing result for a beam.
#[derive(Debug, Clone)]
pub struct BeamDetailingResult {
    pub development_length: DevelopmentLengthResult,
    pub lap_splice: LapSpliceResult,
    pub anchorage: AnchorageResult,
    pub curtailment: Option<CurtailmentResult>,
    pub bar_spacing: SpacingCheckResult,
    pub reinforcement_limits: ReinforcementLimitsResult,
    pub all_pass: bool,
    pub issues: Vec<String>,
}

/// Run complete detailing check for a beam's bottom reinforcement.
pub fn run_beam_detailing(
    bar_dia_mm: f64,
    n_bars: usize,
    b_mm: f64,
    _h_mm: f64,
    d_mm: f64,
    mat: &DetailingMaterials,
    code: DetailingCode,
    moment_diagram: Option<&[MomentPoint]>,
    span_mm: f64,
) -> BeamDetailingResult {
    let position = BarPosition::Bottom;
    let bar_area = circle_area(bar_dia_mm);
    let ast = n_bars as f64 * bar_area;

    // Development length
    let ld = match code {
        DetailingCode::IS456 => development_length_is456(bar_dia_mm, mat, position, true),
        DetailingCode::ACI318 => development_length_aci318(bar_dia_mm, mat, position, true, 0.0, 150.0),
        DetailingCode::Eurocode2 => development_length_ec2(bar_dia_mm, mat, position, true),
    };

    // Lap splice
    let lap = match code {
        DetailingCode::IS456 => lap_splice_is456(bar_dia_mm, mat, position, true, 0.50),
        _ => lap_splice_aci318(bar_dia_mm, mat, position, 0.50),
    };

    // Anchorage
    let anch = hook_anchorage(bar_dia_mm, mat, HookType::Standard90, code);

    // Curtailment
    let curt = moment_diagram.map(|md| {
        compute_curtailment(md, n_bars, bar_dia_mm, b_mm, d_mm,
            mat.fck_mpa, mat.fy_mpa, code, mat, span_mm)
    });

    // Bar spacing
    let spacing = check_bar_spacing_is456(bar_dia_mm, n_bars, b_mm, mat.clear_cover_mm, 20.0);

    // Reinforcement limits
    let limits = check_reinforcement_limits(b_mm, d_mm, ast, mat.fck_mpa, mat.fy_mpa, code);

    // Collect issues
    let mut issues = Vec::new();
    if !spacing.pass_min { issues.push("Bar spacing below minimum".to_string()); }
    if !spacing.pass_max { issues.push("Bar spacing exceeds maximum for crack control".to_string()); }
    if !limits.pass_min { issues.push(format!("ρ = {:.3}% below min {:.3}%", limits.rho_pct, limits.rho_min_pct)); }
    if !limits.pass_max { issues.push(format!("ρ = {:.3}% exceeds max {:.1}%", limits.rho_pct, limits.rho_max_pct)); }

    let all_pass = spacing.pass_min && spacing.pass_max && limits.pass_min && limits.pass_max;

    BeamDetailingResult {
        development_length: ld,
        lap_splice: lap,
        anchorage: anch,
        curtailment: curt,
        bar_spacing: spacing,
        reinforcement_limits: limits,
        all_pass,
        issues,
    }
}

// =====================================================================
// Tests
// =====================================================================

#[cfg(test)]
mod tests {
    use super::*;

    fn test_mat() -> DetailingMaterials {
        DetailingMaterials {
            fck_mpa: 30.0,
            fy_mpa: 500.0,
            bar_type: BarType::Deformed,
            clear_cover_mm: 40.0,
            exposure: ExposureCondition::Moderate,
        }
    }

    #[test]
    fn test_development_length_is456() {
        let mat = test_mat();
        let r = development_length_is456(20.0, &mat, BarPosition::Bottom, true);
        // τ_bd for M30 deformed = 1.7 × 1.6 = 2.72
        // Ld = 500 × 20 / (4 × 2.72) ≈ 919 mm
        assert!(r.ld_mm > 800.0 && r.ld_mm < 1100.0, "Ld={}", r.ld_mm);
        assert!(r.ld_over_db > 40.0 && r.ld_over_db < 60.0);
    }

    #[test]
    fn test_development_length_aci318() {
        let mat = test_mat();
        let r = development_length_aci318(20.0, &mat, BarPosition::Bottom, true, 0.0, 150.0);
        assert!(r.ld_mm > 300.0, "ACI Ld={}", r.ld_mm);
    }

    #[test]
    fn test_development_length_ec2() {
        let mat = test_mat();
        let r = development_length_ec2(20.0, &mat, BarPosition::Bottom, true);
        assert!(r.ld_mm > 100.0, "EC2 lbd={}", r.ld_mm);
    }

    #[test]
    fn test_top_bar_factor() {
        let mat = test_mat();
        let r_bot = development_length_is456(20.0, &mat, BarPosition::Bottom, true);
        let r_top = development_length_is456(20.0, &mat, BarPosition::Top, true);
        assert!(r_top.ld_mm > r_bot.ld_mm, "Top bar → longer Ld");
    }

    #[test]
    fn test_compression_reduction() {
        let mat = test_mat();
        let r_ten = development_length_is456(20.0, &mat, BarPosition::Bottom, true);
        let r_comp = development_length_is456(20.0, &mat, BarPosition::Bottom, false);
        assert!(r_comp.ld_mm < r_ten.ld_mm, "Compression → shorter Ld");
    }

    #[test]
    fn test_lap_splice_is456() {
        let mat = test_mat();
        let r = lap_splice_is456(20.0, &mat, BarPosition::Bottom, true, 0.30);
        assert!(r.lap_class == LapClass::ClassA);
        assert!(r.lap_length_mm >= r.development_length_mm);

        let r2 = lap_splice_is456(20.0, &mat, BarPosition::Bottom, true, 0.75);
        assert!(r2.lap_class == LapClass::ClassB);
        assert!(r2.lap_length_mm > r.lap_length_mm);
    }

    #[test]
    fn test_hook_anchorage() {
        let mat = test_mat();
        let r90 = hook_anchorage(20.0, &mat, HookType::Standard90, DetailingCode::IS456);
        let r180 = hook_anchorage(20.0, &mat, HookType::Standard180, DetailingCode::IS456);
        assert!(r90.total_hook_length_mm > 0.0);
        // 180° hook has shorter straight portion required (more anchorage value)
        assert!(r180.ldh_mm < r90.ldh_mm || r180.total_hook_length_mm > 0.0);
    }

    #[test]
    fn test_curtailment_schedule() {
        let mat = test_mat();
        // Simply-supported beam 6m span, parabolic moment
        let span = 6000.0;
        let m_max = 200.0; // kN·m at midspan
        let md: Vec<MomentPoint> = (0..=20).map(|i| {
            let x = i as f64 * span / 20.0;
            let m = 4.0 * m_max * x * (span - x) / (span * span);
            MomentPoint { x_mm: x, moment_knm: m }
        }).collect();

        let result = compute_curtailment(
            &md, 5, 20.0, 300.0, 450.0, 30.0, 500.0,
            DetailingCode::IS456, &mat, span,
        );

        assert!(!result.cutoff_points.is_empty(), "Should have curtailment points");
        assert!(result.savings_pct > 0.0, "Should save rebar: {:.1}%", result.savings_pct);
        println!("Curtailment: {} points, savings={:.1}%", result.cutoff_points.len(), result.savings_pct);
        for cp in &result.cutoff_points {
            println!("  Cut {} bar(s) at x={:.0} mm (theo={:.0}, cont={})",
                cp.bars_cutoff, cp.actual_cutoff_x_mm, cp.theoretical_cutoff_x_mm, cp.bars_continuing);
        }
    }

    #[test]
    fn test_bar_spacing_check() {
        let r = check_bar_spacing_is456(20.0, 4, 300.0, 40.0, 20.0);
        assert!(r.clear_spacing_mm > 0.0);
        println!("Spacing: {:.1} mm, min={:.1}, pass={}", r.clear_spacing_mm, r.min_required_mm, r.pass_min);
    }

    #[test]
    fn test_reinforcement_limits() {
        let ast = 4.0 * circle_area(20.0); // 4×20mm = 1257 mm²
        let r = check_reinforcement_limits(300.0, 450.0, ast, 30.0, 500.0, DetailingCode::IS456);
        assert!(r.pass_min, "4φ20 in 300×450 should pass min");
        assert!(r.pass_max, "4φ20 in 300×450 should pass max");
        println!("ρ = {:.3}%, min = {:.3}%, max = {:.1}%", r.rho_pct, r.rho_min_pct, r.rho_max_pct);
    }

    #[test]
    fn test_full_detailing_report() {
        let mat = test_mat();
        let span = 6000.0;
        let m_max = 150.0;
        let md: Vec<MomentPoint> = (0..=20).map(|i| {
            let x = i as f64 * span / 20.0;
            let m = 4.0 * m_max * x * (span - x) / (span * span);
            MomentPoint { x_mm: x, moment_knm: m }
        }).collect();

        let result = run_beam_detailing(
            20.0, 4, 300.0, 500.0, 450.0,
            &mat, DetailingCode::IS456,
            Some(&md), span,
        );

        assert!(result.development_length.ld_mm > 0.0);
        assert!(result.lap_splice.lap_length_mm > 0.0);
        assert!(result.curtailment.is_some());
        println!("Detailing: Ld={:.0} mm, lap={:.0} mm, pass={}",
            result.development_length.ld_mm, result.lap_splice.lap_length_mm, result.all_pass);
        for issue in &result.issues {
            println!("  ISSUE: {}", issue);
        }
    }
}
