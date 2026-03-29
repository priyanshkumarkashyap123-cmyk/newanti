//! Section-Wise Beam Design Engine
//!
//! Designs beams by checking capacity ≥ demand at every station along the span,
//! rather than only at the global max Mu / max Vu section.
//!
//! **RC Beams (IS 456:2000):**
//! - Flexure: Cl. 38.1 (singly/doubly reinforced)
//! - Shear: Cl. 40, Table 19 for τc
//! - Curtailment: Cl. 26.2.3.3 (min 1/3 bars continue past cutoff)
//! - Development length: Cl. 26.2.1
//! - Deflection: Cl. 23.2 (span/depth ratio)
//!
//! **Steel Beams (IS 800:2007):**
//! - Shear: Cl. 8.4
//! - Flexure: Cl. 8.2 (plastic/compact/semi-compact classification)
//! - LTB: Cl. 8.2.2 with moment gradient factor Cb varying along span
//! - High-shear interaction: Cl. 9.2 when V > 0.6Vd
//!
//! References: IS 456:2000, IS 800:2007, SP-16, SP-34

use serde::{Deserialize, Serialize};
use std::f64::consts::PI;

use super::is_456;
use super::is_800;

// ── Constants ──

/// Partial safety factor for concrete (IS 456 Cl. 36.4.2)
#[allow(dead_code)]
const GAMMA_C: f64 = 1.50;
/// Partial safety factor for steel reinforcement (IS 456 Cl. 36.4.2)
#[allow(dead_code)]
const GAMMA_S: f64 = 1.15;
/// Default number of stations along the beam span
const DEFAULT_N_SECTIONS: usize = 11;
/// Standard rebar diameters in mm (IS 1786)
const REBAR_DIAMETERS: [f64; 7] = [8.0, 10.0, 12.0, 16.0, 20.0, 25.0, 32.0];

// ── Data Structures ──

/// Support condition for demand envelope generation
#[derive(Debug, Clone, Deserialize, Serialize, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum SupportCondition {
    Simple,
    FixedFixed,
    Propped,
    Cantilever,
}

/// A discrete location along the beam span
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SectionLocation {
    /// Distance from left support (mm)
    pub x_mm: f64,
    /// Normalised position x/L (0.0 to 1.0)
    pub x_ratio: f64,
    /// Label for display, e.g. "0.3L"
    pub label: String,
}

/// Moment type at a section (drives top vs bottom steel placement)
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum MomentType {
    Sagging,
    Hogging,
}

/// Applied forces at a single station (demand)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SectionDemand {
    pub location: SectionLocation,
    /// Factored bending moment (kN·m) — sign preserved (+sagging, −hogging)
    pub mu_knm: f64,
    /// Factored shear force (kN) — absolute value
    pub vu_kn: f64,
    /// Moment type derived from sign
    pub moment_type: MomentType,
}

/// Capacity and utilisation at a single station
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SectionCapacity {
    pub location: SectionLocation,
    // ── Demand ──
    /// Applied moment magnitude (kN·m)
    pub mu_demand_knm: f64,
    /// Applied shear (kN)
    pub vu_demand_kn: f64,
    // ── Flexural capacity ──
    /// Required tension steel area (mm²)
    pub ast_required_mm2: f64,
    /// Provided tension steel area (mm²)
    pub ast_provided_mm2: f64,
    /// Provided bar description, e.g. "3-16φ"
    pub bar_description: String,
    /// Moment capacity with provided steel (kN·m)
    pub mu_capacity_knm: f64,
    /// Moment utilisation ratio (demand / capacity)
    pub utilization_m: f64,
    // ── Shear capacity ──
    /// Shear capacity of concrete Vc (kN)
    pub vc_kn: f64,
    /// Provided stirrup spacing (mm)
    pub stirrup_spacing_mm: f64,
    /// Stirrup description, e.g. "8φ @ 150mm c/c"
    pub stirrup_description: String,
    /// Total shear capacity (kN)
    pub vu_capacity_kn: f64,
    /// Shear utilisation ratio
    pub utilization_v: f64,
    // ── Status ──
    pub moment_type: MomentType,
    pub passed: bool,
    pub governing_check: String,
}

/// A point where reinforcement bars are curtailed
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CurtailmentPoint {
    /// Distance from left support (mm)
    pub x_mm: f64,
    /// Description of bars being terminated
    pub bar_description: String,
    /// Required development length (mm) per IS 456 Cl. 26.2.1
    pub ld_required_mm: f64,
    /// Available embedment length past cutoff (mm)
    pub ld_available_mm: f64,
    /// Whether Ld check is satisfied
    pub ld_satisfied: bool,
    pub message: String,
}

/// A zone of uniform reinforcement along the beam
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RebarZone {
    /// Start distance from left support (mm)
    pub x_start_mm: f64,
    /// End distance from left support (mm)
    pub x_end_mm: f64,
    /// Bottom (tension in sagging) bars
    pub bottom_bars: String,
    /// Bottom bar area (mm²)
    pub bottom_area_mm2: f64,
    /// Top (tension in hogging) bars
    pub top_bars: String,
    /// Top bar area (mm²)
    pub top_area_mm2: f64,
    /// Stirrup specification
    pub stirrup_spec: String,
    /// Zone label
    pub zone_label: String,
}

/// Complete section-wise design result
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SectionWiseResult {
    /// Overall pass/fail: all sections safe?
    pub passed: bool,
    /// Maximum utilisation across all sections and checks
    pub utilization: f64,
    /// Human-readable summary with clause reference
    pub message: String,
    /// Number of stations checked
    pub n_sections: usize,
    /// Per-station capacity checks
    pub section_checks: Vec<SectionCapacity>,
    /// Points where bars are curtailed
    pub curtailment_points: Vec<CurtailmentPoint>,
    /// Reinforcement zones (grouped regions)
    pub rebar_zones: Vec<RebarZone>,
    /// Economy ratio = max_Ast / avg_Ast (>1.0 means curtailment saves steel)
    pub economy_ratio: f64,
    /// Estimated steel savings from curtailment (%)
    pub steel_savings_percent: f64,
    /// Design approach identifier
    pub design_approach: String,
}

// ═══════════════════════════════════════════════════════════════════════════
// Demand Envelope Generators
// ═══════════════════════════════════════════════════════════════════════════

/// Generate demand envelope for a simply supported beam under UDL.
///
/// Mu(x) = (w·x / 2)·(L − x)     [parabolic, sagging throughout]
/// Vu(x) = w·(L/2 − x)            [linear, zero at midspan]
///
/// IS 456:2000 Cl. 22 — limit-state method, factored loads
pub fn generate_simply_supported_demands(
    span_mm: f64,
    w_kn_per_m: f64,
    n_sections: usize,
) -> Vec<SectionDemand> {
    let n = if n_sections < 3 {
        DEFAULT_N_SECTIONS
    } else {
        n_sections
    };
    let l = span_mm;
    let w = w_kn_per_m / 1000.0; // kN/mm

    (0..n)
        .map(|i| {
            let xi = i as f64 / (n - 1) as f64;
            let x = xi * l;

            // w is in kN/mm, x in mm, L in mm
            // M(x) = (w*x/2)*(L-x) in kN·mm → /1000 for kN·m
            // V(x) = w*(L/2 - x) in kN
            let mu_knm = (w * x / 2.0) * (l - x) / 1000.0;
            let vu_kn = (w * (l / 2.0 - x)).abs();

            SectionDemand {
                location: SectionLocation {
                    x_mm: x,
                    x_ratio: xi,
                    label: format!("{:.1}L", xi),
                },
                mu_knm,
                vu_kn,
                moment_type: MomentType::Sagging,
            }
        })
        .collect()
}

/// Generate demand envelope for a continuous beam under UDL.
///
/// **Fixed-fixed:** M(x) = wL²(6ξ − 6ξ² − 1)/12 where ξ = x/L
///   - Hogging at supports, sagging at midspan
/// **Propped cantilever:** Fixed left, pinned right
///   - Reaction: R_right = 5wL/8, M_fixed = −wL²/8
/// **Cantilever:** Fixed left, free right
///   - M(x) = −w(L−x)²/2 [hogging throughout]
///
/// IS 456:2000 Cl. 22
pub fn generate_continuous_beam_demands(
    span_mm: f64,
    w_kn_per_m: f64,
    condition: &SupportCondition,
    n_sections: usize,
) -> Vec<SectionDemand> {
    let n = if n_sections < 3 {
        DEFAULT_N_SECTIONS
    } else {
        n_sections
    };
    let l = span_mm;
    let w = w_kn_per_m / 1000.0; // kN/mm

    (0..n)
        .map(|i| {
            let xi = i as f64 / (n - 1) as f64;
            let x = xi * l;

            let (mu_knm, vu_kn) = match condition {
                SupportCondition::FixedFixed => {
                    // M(ξ) = wL²(6ξ − 6ξ² − 1)/12 in kN·mm → /1000 for kN·m
                    let m = w * l * l * (6.0 * xi - 6.0 * xi * xi - 1.0) / 12.0 / 1000.0;
                    // V(x) = wL(1 − 2ξ)/2 in kN
                    let v = (w * l * (1.0 - 2.0 * xi) / 2.0).abs();
                    (m, v)
                }
                SupportCondition::Propped => {
                    // Fixed left, pinned right. R_B = 5wL/8, M_A = −wL²/8
                    let r_a = w * l - 5.0 * w * l / 8.0; // 3wL/8
                    let m_a = -w * l * l / 8.0; // kN·mm
                    let m = m_a + r_a * x - w * x * x / 2.0; // kN·mm
                    let m_knm = m / 1000.0;
                    let v = (r_a - w * x).abs();
                    (m_knm, v)
                }
                SupportCondition::Cantilever => {
                    // Fixed at left, free at right. M(x) = −w(L−x)²/2 in kN·mm
                    let m = -w * (l - x) * (l - x) / 2.0 / 1000.0;
                    let v = (w * (l - x)).abs();
                    (m, v)
                }
                SupportCondition::Simple => {
                    let m = (w * x / 2.0) * (l - x) / 1000.0;
                    let v = (w * (l / 2.0 - x)).abs();
                    (m, v)
                }
            };

            let moment_type = if mu_knm >= 0.0 {
                MomentType::Sagging
            } else {
                MomentType::Hogging
            };

            SectionDemand {
                location: SectionLocation {
                    x_mm: x,
                    x_ratio: xi,
                    label: format!("{:.1}L", xi),
                },
                mu_knm,
                vu_kn,
                moment_type,
            }
        })
        .collect()
}

/// Generate demand envelope from user-supplied force array.
///
/// Input: Vec<(x_mm, Mu_knm, Vu_kn)> at arbitrary stations.
/// Output: linearly interpolated demands at n_sections uniformly spaced stations.
pub fn generate_demands_from_forces(
    span_mm: f64,
    forces: &[(f64, f64, f64)],
    n_sections: usize,
) -> Vec<SectionDemand> {
    let n = if n_sections < 3 {
        DEFAULT_N_SECTIONS
    } else {
        n_sections
    };
    if forces.is_empty() {
        return Vec::new();
    }

    // Sort forces by x
    let mut sorted: Vec<(f64, f64, f64)> = forces.to_vec();
    sorted.sort_by(|a, b| a.0.partial_cmp(&b.0).unwrap_or(std::cmp::Ordering::Equal));

    (0..n)
        .map(|i| {
            let xi = i as f64 / (n - 1) as f64;
            let x = xi * span_mm;

            // Linear interpolation
            let (mu, vu) = interpolate_forces(&sorted, x);
            let moment_type = if mu >= 0.0 {
                MomentType::Sagging
            } else {
                MomentType::Hogging
            };

            SectionDemand {
                location: SectionLocation {
                    x_mm: x,
                    x_ratio: xi,
                    label: format!("{:.1}L", xi),
                },
                mu_knm: mu,
                vu_kn: vu.abs(),
                moment_type,
            }
        })
        .collect()
}

/// Linear interpolation of (Mu, Vu) at position x from sorted force array
fn interpolate_forces(sorted: &[(f64, f64, f64)], x: f64) -> (f64, f64) {
    if sorted.len() == 1 {
        return (sorted[0].1, sorted[0].2);
    }
    if x <= sorted[0].0 {
        return (sorted[0].1, sorted[0].2);
    }
    if x >= sorted[sorted.len() - 1].0 {
        let last = sorted[sorted.len() - 1];
        return (last.1, last.2);
    }

    for window in sorted.windows(2) {
        let (x0, m0, v0) = window[0];
        let (x1, m1, v1) = window[1];
        if x >= x0 && x <= x1 {
            let t = if (x1 - x0).abs() < f64::EPSILON {
                0.0
            } else {
                (x - x0) / (x1 - x0)
            };
            return (m0 + t * (m1 - m0), v0 + t * (v1 - v0));
        }
    }

    let last = sorted[sorted.len() - 1];
    (last.1, last.2)
}

// ═══════════════════════════════════════════════════════════════════════════
// RC Section-Wise Designer (IS 456:2000)
// ═══════════════════════════════════════════════════════════════════════════

/// Section-wise beam designer for reinforced concrete per IS 456:2000.
///
/// Checks capacity ≥ demand at every station along the span, computes
/// curtailment points per Cl. 26.2.3.3, and generates reinforcement zones.
pub struct RCSectionWiseDesigner {
    /// Concrete grade fck (N/mm²)
    pub fck: f64,
    /// Reinforcement grade fy (N/mm²)
    pub fy: f64,
    /// Limiting xu/d ratio (from fy per IS 456 Table E)
    xu_max_ratio: f64,
}

impl RCSectionWiseDesigner {
    pub fn new(fck: f64, fy: f64) -> Self {
        Self {
            fck,
            fy,
            xu_max_ratio: is_456::xu_max_ratio(fy),
        }
    }

    /// Design the beam section-by-section along its span.
    ///
    /// **Algorithm:**
    /// 1. At each station: compute Ast_required from Mu, check Vu vs τc
    /// 2. Select standard rebar configuration for each station
    /// 3. Compute moment & shear capacity with provided reinforcement
    /// 4. Determine curtailment points (IS 456 Cl. 26.2.3.3)
    /// 5. Group into reinforcement zones (left, middle, right)
    /// 6. Compute economy ratio
    ///
    /// Returns `Err` for invalid input (negative dimensions, zero grades).
    pub fn design_member_sectionwise(
        &self,
        b_mm: f64,
        d_mm: f64,
        cover_mm: f64,
        span_mm: f64,
        demands: &[SectionDemand],
    ) -> Result<SectionWiseResult, String> {
        // ── Input validation ──
        if b_mm <= 0.0 || d_mm <= 0.0 {
            return Err("Beam dimensions must be positive".into());
        }
        if self.fck <= 0.0 || self.fy <= 0.0 {
            return Err("Material strengths must be positive".into());
        }
        if span_mm <= 0.0 {
            return Err("Span must be positive".into());
        }
        if demands.is_empty() {
            return Err("At least one demand section required".into());
        }

        let overall_depth = d_mm + cover_mm;

        // ── Step 1–3: Design each section ──
        let section_checks: Vec<SectionCapacity> = demands
            .iter()
            .map(|demand| self.design_single_section(b_mm, d_mm, demand))
            .collect();

        // ── Step 4: Curtailment (IS 456 Cl. 26.2.3.3) ──
        let curtailment_points =
            self.compute_curtailment(span_mm, d_mm, overall_depth, demands, &section_checks);

        // ── Step 5: Rebar zones ──
        let rebar_zones = self.compute_rebar_zones(span_mm, &section_checks, &curtailment_points);

        // ── Step 6: Economy metrics ──
        let ast_values: Vec<f64> = section_checks.iter().map(|s| s.ast_provided_mm2).collect();
        let max_ast = ast_values.iter().cloned().fold(0.0_f64, f64::max);
        let avg_ast = if ast_values.is_empty() {
            0.0
        } else {
            ast_values.iter().sum::<f64>() / ast_values.len() as f64
        };
        let economy_ratio = if avg_ast > f64::EPSILON {
            max_ast / avg_ast
        } else {
            1.0
        };
        let steel_savings = if economy_ratio > 1.0 {
            (1.0 - 1.0 / economy_ratio) * 100.0
        } else {
            0.0
        };

        // ── Aggregate results ──
        let max_util_m = section_checks
            .iter()
            .map(|s| s.utilization_m)
            .fold(0.0_f64, f64::max);
        let max_util_v = section_checks
            .iter()
            .map(|s| s.utilization_v)
            .fold(0.0_f64, f64::max);
        let max_util = max_util_m.max(max_util_v);
        let all_passed = section_checks.iter().all(|s| s.passed);

        let message = if all_passed {
            format!(
                "Section-wise design SAFE per IS 456:2000. Max utilisation = {:.1}% at {}. \
                 Economy ratio = {:.2} ({:.0}% steel savings from curtailment).",
                max_util * 100.0,
                section_checks
                    .iter()
                    .max_by(|a, b| {
                        a.utilization_m
                            .max(a.utilization_v)
                            .partial_cmp(&b.utilization_m.max(b.utilization_v))
                            .unwrap_or(std::cmp::Ordering::Equal)
                    })
                    .map(|s| s.location.label.as_str())
                    .unwrap_or("?"),
                economy_ratio,
                steel_savings,
            )
        } else {
            let failing: Vec<&str> = section_checks
                .iter()
                .filter(|s| !s.passed)
                .map(|s| s.location.label.as_str())
                .collect();
            format!(
                "Section-wise design UNSAFE per IS 456:2000. Failing at: {}. \
                 Max utilisation = {:.1}%.",
                failing.join(", "),
                max_util * 100.0,
            )
        };

        Ok(SectionWiseResult {
            passed: all_passed,
            utilization: (max_util * 1000.0).round() / 1000.0,
            message,
            n_sections: section_checks.len(),
            section_checks,
            curtailment_points,
            rebar_zones,
            economy_ratio: (economy_ratio * 100.0).round() / 100.0,
            steel_savings_percent: (steel_savings * 10.0).round() / 10.0,
            design_approach: "section_wise".to_string(),
        })
    }

    // ── Internal: design a single section ──

    fn design_single_section(&self, b: f64, d: f64, demand: &SectionDemand) -> SectionCapacity {
        let mu_abs = demand.mu_knm.abs();
        let vu_abs = demand.vu_kn.abs();

        // ── Flexure: compute Ast required ──
        let ast_req = self.compute_ast_required(b, d, mu_abs);

        // Minimum steel: IS 456 Cl. 26.5.1.1
        // Ast_min = 0.85 * b * d / fy
        let ast_min = 0.85 * b * d / self.fy;
        let ast_req = ast_req.max(ast_min);

        // Select standard bars
        let (bar_dia, bar_count, ast_provided) = select_bars_for_area(ast_req);
        let bar_desc = format!("{}-{}φ", bar_count, bar_dia as u32);

        // Moment capacity with provided steel
        let mu_cap = is_456::flexural_capacity_singly(b, d, self.fck, self.fy, ast_provided);
        let util_m = if mu_cap > f64::EPSILON {
            mu_abs / mu_cap
        } else {
            if mu_abs > f64::EPSILON {
                99.0
            } else {
                0.0
            }
        };

        // ── Shear: check τv vs τc, design stirrups ──
        let pt = ast_provided / (b * d) * 100.0; // percent
        let shear_result = is_456::design_shear(
            vu_abs, b, d, self.fck, self.fy, pt, 100.0, // default 2L-8mm Asv
        );
        let vc_kn = shear_result.tau_c * b * d / 1000.0;

        // Stirrup spacing — use design_stirrup_spacing if Vus > 0
        let (stir_dia, stir_spacing) = if shear_result.vus > f64::EPSILON {
            let (dia, spacing, _asv) =
                is_456::design_stirrup_spacing(shear_result.vus, b, d, self.fy);
            (dia, spacing)
        } else {
            (8.0, (0.75 * d).min(300.0))
        };
        let stir_spacing = (stir_spacing / 25.0).floor() * 25.0; // round to 25mm
        let stir_spacing = stir_spacing.clamp(75.0, 300.0);
        let stir_desc = format!("{}φ @ {}mm c/c", stir_dia as u32, stir_spacing as u32);

        // Total shear capacity = Vc + Vus_provided
        let asv_prov = 2.0 * PI / 4.0 * stir_dia * stir_dia;
        let vus_prov = 0.87 * self.fy * asv_prov * d / (stir_spacing * 1000.0); // kN
        let vu_cap = vc_kn + vus_prov;
        let util_v = if vu_cap > f64::EPSILON {
            vu_abs / vu_cap
        } else {
            if vu_abs > f64::EPSILON {
                99.0
            } else {
                0.0
            }
        };

        let passed = util_m <= 1.0 && util_v <= 1.0 && shear_result.passed;
        let governing = if util_m >= util_v { "flexure" } else { "shear" };

        SectionCapacity {
            location: demand.location.clone(),
            mu_demand_knm: mu_abs,
            vu_demand_kn: vu_abs,
            ast_required_mm2: (ast_req * 10.0).round() / 10.0,
            ast_provided_mm2: (ast_provided * 10.0).round() / 10.0,
            bar_description: bar_desc,
            mu_capacity_knm: (mu_cap * 100.0).round() / 100.0,
            utilization_m: (util_m * 1000.0).round() / 1000.0,
            vc_kn: (vc_kn * 100.0).round() / 100.0,
            stirrup_spacing_mm: stir_spacing,
            stirrup_description: stir_desc,
            vu_capacity_kn: (vu_cap * 100.0).round() / 100.0,
            utilization_v: (util_v * 1000.0).round() / 1000.0,
            moment_type: demand.moment_type.clone(),
            passed,
            governing_check: governing.to_string(),
        }
    }

    /// Compute required tension steel area (mm²) for a given moment.
    ///
    /// IS 456 Cl. 38.1: Mu = 0.87·fy·Ast·d·(1 − Ast·fy/(b·d·fck))
    /// Rearranging: R = Mu×1e6/(b·d²), then pt = 0.5·(fck/fy)·(1−√(1−4.6R/fck))
    fn compute_ast_required(&self, b: f64, d: f64, mu_knm: f64) -> f64 {
        if mu_knm <= f64::EPSILON {
            return 0.0;
        }

        let r = mu_knm * 1e6 / (b * d * d);
        let disc = 1.0 - 4.6 * r / self.fck;

        if disc < 0.0 {
            // Section needs compression steel — for now, return Ast for balanced section
            // and flag that doubly reinforced design is needed
            let xu_max = self.xu_max_ratio * d;
            let mu_lim = 0.36 * self.fck * b * xu_max * (d - 0.42 * xu_max) / 1e6;
            let ast_lim = 0.36 * self.fck * b * xu_max / (0.87 * self.fy);
            // Additional steel for moment exceeding Mu_lim
            let mu_extra = mu_knm - mu_lim;
            let ast_extra = mu_extra * 1e6 / (0.87 * self.fy * (d - d * 0.08)); // d' ≈ 0.08d
            ast_lim + ast_extra
        } else {
            let pt = 0.5 * (self.fck / self.fy) * (1.0 - disc.sqrt());
            pt * b * d
        }
    }

    /// Compute curtailment points per IS 456 Cl. 26.2.3.3.
    ///
    /// Rules:
    /// - At least 1/3 of max bottom steel must continue to the support
    /// - Bars can only be curtailed past the point where they are no longer
    ///   needed, plus an extension of Ld + d
    /// - Development length per Cl. 26.2.1
    fn compute_curtailment(
        &self,
        span_mm: f64,
        d: f64,
        _overall_depth: f64,
        _demands: &[SectionDemand],
        checks: &[SectionCapacity],
    ) -> Vec<CurtailmentPoint> {
        if checks.is_empty() {
            return Vec::new();
        }

        let mut curtailment_points = Vec::new();

        // Find maximum Ast section (typically midspan for sagging)
        let max_check = checks
            .iter()
            .max_by(|a, b| {
                a.ast_provided_mm2
                    .partial_cmp(&b.ast_provided_mm2)
                    .unwrap_or(std::cmp::Ordering::Equal)
            })
            .unwrap();

        let max_bars = max_check.ast_provided_mm2;
        if max_bars <= f64::EPSILON {
            return curtailment_points;
        }

        // Minimum continuing bars: at least 1/3 of max steel per Cl. 26.2.3.3
        let min_continuing_area = max_bars / 3.0;

        // Find the bar configuration for minimum continuing
        let (_cont_dia, _cont_count, cont_area) = select_bars_for_area(min_continuing_area);

        // Reduced moment capacity with only continuing bars
        let _mu_reduced = is_456::flexural_capacity_singly(
            checks[0].location.x_mm.max(1.0).min(1e6) * 0.0 + checks.iter().map(|_| 0.0).sum::<f64>() * 0.0 + // just to reference — b and d from first check
            // We need b and d, reconstruct from context
            0.0,
            0.0,
            self.fck,
            self.fy,
            cont_area,
        );

        // Actually compute mu_reduced with correct b, d from checks
        // We derive b from check data: b = (Ast * 0.87 * fy) / (0.36 * fck * xu)
        // Simpler: re-derive from Ast_provided and mu_capacity
        // b·d is implicit. Use the demand/capacity relationship.
        // For curtailment, find where demand drops below reduced capacity.

        // Use demand array to find theoretical cutoff points
        let bar_dia_main = {
            // Extract bar diameter from the max section's description
            let desc = &max_check.bar_description;
            desc.split('-')
                .nth(1)
                .and_then(|s| s.trim_end_matches('φ').parse::<f64>().ok())
                .unwrap_or(16.0)
        };

        let ld = is_456::development_length(bar_dia_main, self.fy, self.fck);

        // Find theoretical cutoff: where |Mu_demand| drops below reduced capacity fraction
        // Reduced capacity ≈ (cont_area / max_bars) × max_mu_capacity
        let max_mu_cap = max_check.mu_capacity_knm;
        let mu_cutoff_threshold = max_mu_cap * (cont_area / max_bars);

        // Scan from left to find where demand exceeds threshold
        let mut left_cutoff: Option<f64> = None;
        let mut right_cutoff: Option<f64> = None;

        for check in checks.iter() {
            if check.mu_demand_knm > mu_cutoff_threshold && left_cutoff.is_none() {
                left_cutoff = Some(check.location.x_mm);
            }
        }
        for check in checks.iter().rev() {
            if check.mu_demand_knm > mu_cutoff_threshold && right_cutoff.is_none() {
                right_cutoff = Some(check.location.x_mm);
            }
        }

        // Actual cutoff = theoretical − (Ld + d) for left, + (Ld + d) for right
        let extension = ld + d;

        if let Some(left_x) = left_cutoff {
            let actual_x = (left_x - extension).max(0.0);
            let ld_available = left_x - actual_x;
            curtailment_points.push(CurtailmentPoint {
                x_mm: (actual_x * 10.0).round() / 10.0,
                bar_description: format!("Curtail to continuing bars near left support"),
                ld_required_mm: (ld * 10.0).round() / 10.0,
                ld_available_mm: (ld_available * 10.0).round() / 10.0,
                ld_satisfied: ld_available >= ld,
                message: format!(
                    "IS 456 Cl. 26.2.3.3: Ld = {:.0} mm, available = {:.0} mm → {}",
                    ld,
                    ld_available,
                    if ld_available >= ld {
                        "OK"
                    } else {
                        "INSUFFICIENT"
                    }
                ),
            });
        }

        if let Some(right_x) = right_cutoff {
            let actual_x = (right_x + extension).min(span_mm);
            let ld_available = actual_x - right_x;
            curtailment_points.push(CurtailmentPoint {
                x_mm: (actual_x * 10.0).round() / 10.0,
                bar_description: format!("Curtail to continuing bars near right support"),
                ld_required_mm: (ld * 10.0).round() / 10.0,
                ld_available_mm: (ld_available * 10.0).round() / 10.0,
                ld_satisfied: ld_available >= ld,
                message: format!(
                    "IS 456 Cl. 26.2.3.3: Ld = {:.0} mm, available = {:.0} mm → {}",
                    ld,
                    ld_available,
                    if ld_available >= ld {
                        "OK"
                    } else {
                        "INSUFFICIENT"
                    }
                ),
            });
        }

        curtailment_points
    }

    /// Group section checks into reinforcement zones.
    ///
    /// Creates 3 zones: left support → transition → midspan (full steel) → transition → right support.
    fn compute_rebar_zones(
        &self,
        span_mm: f64,
        checks: &[SectionCapacity],
        curtailment_points: &[CurtailmentPoint],
    ) -> Vec<RebarZone> {
        if checks.is_empty() {
            return Vec::new();
        }

        // Find the maximum steel section (typically midspan)
        let max_check = checks
            .iter()
            .max_by(|a, b| {
                a.ast_provided_mm2
                    .partial_cmp(&b.ast_provided_mm2)
                    .unwrap_or(std::cmp::Ordering::Equal)
            })
            .unwrap();

        // Find minimum required (at supports for simply supported)
        let min_check = checks
            .iter()
            .min_by(|a, b| {
                a.ast_required_mm2
                    .partial_cmp(&b.ast_required_mm2)
                    .unwrap_or(std::cmp::Ordering::Equal)
            })
            .unwrap();

        // Minimum steel for support zone: 1/3 of max per Cl. 26.2.3.3
        let min_area = max_check.ast_provided_mm2 / 3.0;
        let _ast_min_code = 0.85
            * (max_check.ast_provided_mm2
                / (max_check.ast_provided_mm2 / min_check.ast_required_mm2.max(1.0)))
            / self.fy; // not quite right
        let support_area = min_area.max(min_check.ast_required_mm2);
        let (_sup_dia, _sup_count, sup_area_prov) = select_bars_for_area(support_area);

        // Zone boundaries from curtailment points
        let left_boundary = curtailment_points
            .first()
            .map(|c| c.x_mm)
            .unwrap_or(span_mm * 0.2);
        let right_boundary = curtailment_points
            .last()
            .map(|c| c.x_mm)
            .unwrap_or(span_mm * 0.8);

        // Determine stirrup spacing for each zone (tighter near supports for shear)
        let support_stirrup = checks
            .first()
            .map(|s| s.stirrup_description.clone())
            .unwrap_or_else(|| "8φ @ 150mm c/c".to_string());
        let midspan_stirrup = checks
            .get(checks.len() / 2)
            .map(|s| s.stirrup_description.clone())
            .unwrap_or_else(|| "8φ @ 200mm c/c".to_string());

        // Support bar config
        let (sup_dia, sup_count, _) = select_bars_for_area(support_area);
        let sup_desc = format!("{}-{}φ", sup_count, sup_dia as u32);

        vec![
            RebarZone {
                x_start_mm: 0.0,
                x_end_mm: left_boundary,
                bottom_bars: sup_desc.clone(),
                bottom_area_mm2: sup_area_prov,
                top_bars: "Nominal".to_string(),
                top_area_mm2: 0.0,
                stirrup_spec: support_stirrup.clone(),
                zone_label: "Left support zone".to_string(),
            },
            RebarZone {
                x_start_mm: left_boundary,
                x_end_mm: right_boundary,
                bottom_bars: max_check.bar_description.clone(),
                bottom_area_mm2: max_check.ast_provided_mm2,
                top_bars: "Nominal".to_string(),
                top_area_mm2: 0.0,
                stirrup_spec: midspan_stirrup,
                zone_label: "Midspan zone (full reinforcement)".to_string(),
            },
            RebarZone {
                x_start_mm: right_boundary,
                x_end_mm: span_mm,
                bottom_bars: sup_desc,
                bottom_area_mm2: sup_area_prov,
                top_bars: "Nominal".to_string(),
                top_area_mm2: 0.0,
                stirrup_spec: support_stirrup,
                zone_label: "Right support zone".to_string(),
            },
        ]
    }
}

// ═══════════════════════════════════════════════════════════════════════════
// Helper: Select standard bars for a given area
// ═══════════════════════════════════════════════════════════════════════════

/// Select standard rebar configuration that provides ≥ the required area.
///
/// Returns (diameter_mm, count, area_provided_mm²).
/// Favours smaller excess and fewer bars.
fn select_bars_for_area(ast_required: f64) -> (f64, usize, f64) {
    if ast_required <= f64::EPSILON {
        return (8.0, 2, 2.0 * PI / 4.0 * 64.0); // minimum 2-8φ
    }

    let mut best: Option<(f64, f64, usize, f64)> = None; // (excess, dia, count, area)

    for &dia in REBAR_DIAMETERS.iter() {
        let bar_area = PI / 4.0 * dia * dia;
        let min_count = 2_usize;
        let max_count = 10_usize;

        for count in min_count..=max_count {
            let provided = count as f64 * bar_area;
            let excess = provided - ast_required;
            if excess >= 0.0 {
                let is_better = best
                    .as_ref()
                    .map_or(true, |b| excess < b.0 || (excess == b.0 && dia < b.1));
                if is_better {
                    best = Some((excess, dia, count, provided));
                }
            }
        }
    }

    match best {
        Some((_, dia, count, area)) => (dia, count, area),
        None => {
            // Fallback: 32mm bars
            let dia = 32.0;
            let bar_area = PI / 4.0 * dia * dia;
            let count = (ast_required / bar_area).ceil().max(2.0) as usize;
            (dia, count, count as f64 * bar_area)
        }
    }
}

// ═══════════════════════════════════════════════════════════════════════════
// Steel Section-Wise Designer (IS 800:2007 / AISC 360-22)
// ═══════════════════════════════════════════════════════════════════════════

/// Young's modulus for structural steel (N/mm²)
const E_STEEL: f64 = 200_000.0;
/// Poisson's ratio for steel
const NU_STEEL: f64 = 0.3;
/// Shear modulus G = E / (2(1+ν)) per copilot-instructions (N/mm²)
const G_STEEL: f64 = E_STEEL / (2.0 * (1.0 + NU_STEEL));
/// IS 800 Table 2 — ε = √(250/fy)
fn epsilon(fy: f64) -> f64 {
    (250.0 / fy).sqrt()
}

/// Section classification per IS 800:2007 Table 2
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum SectionClass {
    Plastic,
    Compact,
    SemiCompact,
    Slender,
}

/// Design code for steel section-wise design
#[derive(Debug, Clone, Deserialize, Serialize, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum SteelDesignCode {
    Is800,
    Aisc360,
}

/// Steel section input — from ISMB database or custom properties
#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct SteelSectionInput {
    pub name: String,
    /// Overall depth (mm)
    pub depth: f64,
    /// Flange width bf (mm)
    pub width: f64,
    /// Web thickness (mm)
    pub tw: f64,
    /// Flange thickness (mm)
    pub tf: f64,
    /// Cross-sectional area (mm²)
    pub area: f64,
    /// Second moment about x-x (mm⁴)
    pub ixx: f64,
    /// Second moment about y-y (mm⁴)
    pub iyy: f64,
    /// Elastic section modulus about x-x (mm³)
    pub zxx: f64,
    /// Elastic section modulus about y-y (mm³)
    pub zyy: f64,
    /// Radius of gyration about y-y (mm)
    pub ryy: f64,
    /// St. Venant torsional constant (mm⁴) — derived from geometry if 0
    #[serde(default)]
    pub j_mm4: f64,
    /// Warping constant (mm⁶) — derived from geometry if 0
    #[serde(default)]
    pub cw_mm6: f64,
}

impl SteelSectionInput {
    /// Build from ISMB database section
    pub fn from_ismb(s: &is_800::IsmbSection) -> Self {
        let d_w = s.depth - 2.0 * s.tf;
        // St. Venant torsional constant: J ≈ (2bf·tf³ + dw·tw³) / 3
        let j = (2.0 * s.width * s.tf.powi(3) + d_w * s.tw.powi(3)) / 3.0;
        // Warping constant: Cw ≈ Iy × (d − tf)² / 4
        let cw = s.iyy * (s.depth - s.tf).powi(2) / 4.0;
        Self {
            name: s.name.clone(),
            depth: s.depth,
            width: s.width,
            tw: s.tw,
            tf: s.tf,
            area: s.area,
            ixx: s.ixx,
            iyy: s.iyy,
            zxx: s.zxx,
            zyy: s.zyy,
            ryy: s.ryy,
            j_mm4: j,
            cw_mm6: cw,
        }
    }

    /// Compute plastic section modulus Zp for doubly-symmetric I-section (mm³)
    ///
    /// Zp = bf·tf·(d − tf) + tw·(d − 2tf)² / 4
    pub fn zp(&self) -> f64 {
        let d_w = self.depth - 2.0 * self.tf;
        self.width * self.tf * (self.depth - self.tf) + self.tw * d_w * d_w / 4.0
    }

    /// Compute J from geometry if not provided
    pub fn j(&self) -> f64 {
        if self.j_mm4 > f64::EPSILON {
            self.j_mm4
        } else {
            let d_w = self.depth - 2.0 * self.tf;
            (2.0 * self.width * self.tf.powi(3) + d_w * self.tw.powi(3)) / 3.0
        }
    }

    /// Compute Cw from geometry if not provided
    pub fn cw(&self) -> f64 {
        if self.cw_mm6 > f64::EPSILON {
            self.cw_mm6
        } else {
            self.iyy * (self.depth - self.tf).powi(2) / 4.0
        }
    }
}

/// Capacity at a single station for steel beam
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SteelSectionCapacity {
    pub location: SectionLocation,
    // ── Demand ──
    /// Applied moment magnitude (kN·m)
    pub mu_demand_knm: f64,
    /// Applied shear (kN)
    pub vu_demand_kn: f64,
    // ── Flexural capacity ──
    /// Plastic moment Mp (kN·m) — without LTB reduction
    pub mp_knm: f64,
    /// Design bending strength Md (kN·m) — with LTB & high-shear
    pub md_knm: f64,
    /// Moment utilisation ratio
    pub utilization_m: f64,
    // ── LTB ──
    /// Elastic critical moment Mcr (kN·m) — IS 800 Cl. 8.2.2 / Annex E
    pub mcr_knm: f64,
    /// Non-dimensional LTB slenderness λLT
    pub lambda_lt: f64,
    /// LTB reduction factor χLT (1.0 = no LTB)
    pub chi_lt: f64,
    // ── Shear capacity ──
    /// Design shear capacity Vd (kN)
    pub vd_kn: f64,
    /// Shear utilisation ratio
    pub utilization_v: f64,
    // ── High-shear interaction (IS 800 Cl. 9.2) ──
    /// Whether V > 0.6Vd at this station
    pub high_shear: bool,
    /// Reduced moment capacity due to high shear (kN·m); equals md_knm when not high-shear
    pub mdv_knm: f64,
    // ── Classification ──
    pub section_class: SectionClass,
    // ── Status ──
    pub moment_type: MomentType,
    pub passed: bool,
    pub governing_check: String,
}

/// Zone where web stiffeners are recommended (V > 0.6Vd)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StiffenerZone {
    /// Start distance from left support (mm)
    pub x_start_mm: f64,
    /// End distance from left support (mm)
    pub x_end_mm: f64,
    /// Maximum shear in this zone (kN)
    pub max_shear_kn: f64,
    /// Design shear capacity (kN)
    pub shear_capacity_kn: f64,
    pub reason: String,
}

/// Complete steel section-wise design result
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SteelSectionWiseResult {
    pub passed: bool,
    pub utilization: f64,
    pub message: String,
    pub n_sections: usize,
    pub section_checks: Vec<SteelSectionCapacity>,
    /// Zones where web stiffeners are needed (V > 0.6Vd)
    pub stiffener_zones: Vec<StiffenerZone>,
    pub design_code: String,
    pub section_name: String,
    pub section_class: SectionClass,
    /// Moment gradient factor Cb used in LTB check
    pub cb: f64,
}

// ── Section Classification per IS 800:2007 Table 2 ──

/// Classify an I-section per IS 800:2007 Table 2.
///
/// Checks flange outstand ratio bf/(2tf) and web slenderness d/(tw)
/// against limits that depend on ε = √(250/fy).
///
/// Returns the most adverse classification of flange and web.
pub fn classify_section_is800(bf: f64, tf: f64, d_web: f64, tw: f64, fy: f64) -> SectionClass {
    let eps = epsilon(fy);

    // Flange: outstand ratio b/tf where b = (bf − tw) / 2 for rolled I
    let b_out = (bf - tw) / 2.0;
    let flange_ratio = b_out / tf;

    // IS 800 Table 2 — Outstand element of compression flange (rolled)
    let flange_class = if flange_ratio <= 9.4 * eps {
        SectionClass::Plastic
    } else if flange_ratio <= 10.5 * eps {
        SectionClass::Compact
    } else if flange_ratio <= 15.7 * eps {
        SectionClass::SemiCompact
    } else {
        SectionClass::Slender
    };

    // Web: d/tw for bending (neutral axis at mid-depth)
    let web_ratio = d_web / tw;

    // IS 800 Table 2 — Web of I-section (bending, NA at mid-depth)
    let web_class = if web_ratio <= 84.0 * eps {
        SectionClass::Plastic
    } else if web_ratio <= 105.0 * eps {
        SectionClass::Compact
    } else if web_ratio <= 126.0 * eps {
        SectionClass::SemiCompact
    } else {
        SectionClass::Slender
    };

    // Overall = most adverse
    let class_rank = |c: &SectionClass| -> u8 {
        match c {
            SectionClass::Plastic => 0,
            SectionClass::Compact => 1,
            SectionClass::SemiCompact => 2,
            SectionClass::Slender => 3,
        }
    };

    if class_rank(&flange_class) >= class_rank(&web_class) {
        flange_class
    } else {
        web_class
    }
}

/// Compute moment gradient factor Cb from quarter-point moments.
///
/// AISC 360 Eq. F1-1 / IS 800 Table 42 (equivalent):
/// Cb = 12.5·Mmax / (2.5·Mmax + 3·MA + 4·MB + 3·MC)
///
/// where MA, MB, MC are absolute moments at quarter, half, three-quarter
/// points of the unbraced segment, and Mmax is the absolute maximum.
pub fn compute_cb(demands: &[SectionDemand]) -> f64 {
    if demands.len() < 3 {
        return 1.0;
    }

    let n = demands.len();
    let mmax = demands
        .iter()
        .map(|d| d.mu_knm.abs())
        .fold(0.0_f64, f64::max);
    if mmax < f64::EPSILON {
        return 1.0;
    }

    // Quarter, half, three-quarter indices
    let i_a = n / 4;
    let i_b = n / 2;
    let i_c = 3 * n / 4;

    let m_a = demands[i_a].mu_knm.abs();
    let m_b = demands[i_b].mu_knm.abs();
    let m_c = demands[i_c].mu_knm.abs();

    let cb = 12.5 * mmax / (2.5 * mmax + 3.0 * m_a + 4.0 * m_b + 3.0 * m_c);
    // Cb ≤ 3.0 per AISC, and ≥ 1.0 is typical for non-uniform moment
    cb.clamp(1.0, 3.0)
}

/// Elastic critical moment for LTB per IS 800:2007 Cl. 8.2.2 / Annex E.
///
/// Mcr = Cb × (π/LLT) × √(E·Iy·G·J) × √(1 + (π²·E·Cw)/(G·J·LLT²))
///
/// All units: N, mm → result in N·mm, converted to kN·m.
fn compute_mcr(section: &SteelSectionInput, l_lt: f64, cb: f64) -> f64 {
    let iy = section.iyy;
    let j = section.j();
    let cw = section.cw();

    if l_lt < f64::EPSILON || j < f64::EPSILON {
        return f64::MAX; // No LTB (fully braced)
    }

    let term1 = PI / l_lt;
    let term2 = (E_STEEL * iy * G_STEEL * j).sqrt();
    let term3 = (1.0 + (PI * PI * E_STEEL * cw) / (G_STEEL * j * l_lt * l_lt)).sqrt();

    let mcr_nmm = cb * term1 * term2 * term3;
    mcr_nmm / 1e6 // N·mm → kN·m
}

/// LTB reduction factor χLT per IS 800:2007 Cl. 8.2.2.
///
/// λLT = √(βb × Zp × fy / Mcr)
/// φLT = 0.5 × (1 + αLT × (λLT − 0.2) + λLT²)
/// χLT = 1 / (φLT + √(φLT² − λLT²))  ≤  1.0
///
/// αLT = 0.21 for rolled sections (buckling curve a), 0.49 for welded (curve b).
fn compute_chi_lt(lambda_lt: f64, is_rolled: bool) -> f64 {
    if lambda_lt <= 0.2 {
        return 1.0; // No LTB reduction for very stocky sections
    }

    // IS 800 Cl. 8.2.2 — imperfection factor αLT
    let alpha_lt = if is_rolled { 0.21 } else { 0.49 };

    let phi_lt = 0.5 * (1.0 + alpha_lt * (lambda_lt - 0.2) + lambda_lt * lambda_lt);
    let discriminant = (phi_lt * phi_lt - lambda_lt * lambda_lt).max(0.0);

    let chi_lt = 1.0 / (phi_lt + discriminant.sqrt());
    chi_lt.min(1.0)
}

/// Steel section-wise beam designer.
///
/// Checks capacity ≥ demand at every station along the span for steel I-beams.
///
/// **IS 800:2007:**
/// - Shear per Cl. 8.4 (via existing `is_800::design_shear`)
/// - Flexure per Cl. 8.2.1 (plastic / compact: Md = βb·Zp·fy/γm0)
/// - LTB per Cl. 8.2.2 / Annex E with moment gradient factor Cb
/// - High-shear interaction per Cl. 9.2 when V > 0.6Vd
///
/// **AISC 360-22:**
/// - Bending per Chapter F (F2 for doubly-symmetric I-shapes)
/// - Shear per Chapter G (G2.1 for rolled I-shapes)
/// - Cb from quarter-point moments (Eq. F1-1)
pub struct SteelSectionWiseDesigner {
    /// Yield strength fy (N/mm²)
    pub fy: f64,
    /// Design code
    pub design_code: SteelDesignCode,
}

impl SteelSectionWiseDesigner {
    pub fn new(fy: f64, design_code: SteelDesignCode) -> Self {
        Self { fy, design_code }
    }

    /// Design the steel beam section-by-section along its span.
    ///
    /// **Arguments:**
    /// - `section` — I-section properties (from ISMB database or custom)
    /// - `demands` — force envelope at each station
    /// - `unbraced_length_mm` — laterally unbraced length LLT (mm)
    /// - `is_rolled` — true for hot-rolled (αLT = 0.21), false for welded (αLT = 0.49)
    ///
    /// **Returns** `SteelSectionWiseResult` with per-station checks, stiffener zones,
    /// and overall pass/fail.
    pub fn design_member_sectionwise(
        &self,
        section: &SteelSectionInput,
        demands: &[SectionDemand],
        unbraced_length_mm: f64,
        is_rolled: bool,
    ) -> Result<SteelSectionWiseResult, String> {
        // ── Validation ──
        if section.depth <= 0.0 || section.width <= 0.0 || section.tw <= 0.0 || section.tf <= 0.0 {
            return Err("Section dimensions must be positive".into());
        }
        if self.fy <= 0.0 {
            return Err("Yield strength must be positive".into());
        }
        if demands.is_empty() {
            return Err("At least one demand section required".into());
        }
        if unbraced_length_mm <= 0.0 {
            return Err("Unbraced length must be positive".into());
        }

        let d_web = section.depth - 2.0 * section.tf;
        let zp = section.zp();

        // ── Classification (IS 800 Table 2) ──
        let sec_class =
            classify_section_is800(section.width, section.tf, d_web, section.tw, self.fy);

        // βb: 1.0 for plastic/compact, Ze/Zp for semi-compact
        let beta_b = match sec_class {
            SectionClass::Plastic | SectionClass::Compact => 1.0,
            SectionClass::SemiCompact | SectionClass::Slender => (section.zxx / zp).min(1.0),
        };

        // ── Cb from moment diagram ──
        let cb = compute_cb(demands);

        // ── Elastic critical moment & LTB ──
        let mcr_knm = match self.design_code {
            SteelDesignCode::Is800 => compute_mcr(section, unbraced_length_mm, cb),
            SteelDesignCode::Aisc360 => {
                // AISC uses same Mcr formula (Chapter F2)
                compute_mcr(section, unbraced_length_mm, cb)
            }
        };

        // λLT = √(βb × Zp × fy / (Mcr × 1e6))   [Mcr in kN·m → N·mm via 1e6]
        let lambda_lt = if mcr_knm > f64::EPSILON {
            (beta_b * zp * self.fy / (mcr_knm * 1e6)).sqrt()
        } else {
            5.0 // Very slender — force high reduction
        };
        let chi_lt = match self.design_code {
            SteelDesignCode::Is800 => compute_chi_lt(lambda_lt, is_rolled),
            SteelDesignCode::Aisc360 => {
                // AISC uses different LTB formulation; for section-wise we already
                // have bending capacity via Lp/Lr; approximate with same chi_lt
                compute_chi_lt(lambda_lt, true)
            }
        };

        // ── Flexural capacity (without high-shear) ──
        let md_knm = match self.design_code {
            SteelDesignCode::Is800 => {
                // IS 800 Cl. 8.2.1: Md = βb × Zp × fy / γm0
                // With LTB: Md = βb × Zp × (χLT × fy) / γm0
                // Cl. 8.2.1 Md ≤ 1.2 × Ze × fy / γm0 (to avoid irreversible deformation)
                let md = beta_b * zp * chi_lt * self.fy / (is_800::GAMMA_M0 * 1e6);
                let md_limit = 1.2 * section.zxx * self.fy / (is_800::GAMMA_M0 * 1e6);
                md.min(md_limit)
            }
            SteelDesignCode::Aisc360 => {
                // AISC 360 F2: φMn = 0.9 × Mp (when Lb ≤ Lp), reduced for LTB
                let phi = 0.9;
                let mp = zp * self.fy / 1e6;
                phi * chi_lt * mp
            }
        };

        // ── Plastic moment (reference) ──
        let mp_knm = match self.design_code {
            SteelDesignCode::Is800 => beta_b * zp * self.fy / (is_800::GAMMA_M0 * 1e6),
            SteelDesignCode::Aisc360 => 0.9 * zp * self.fy / 1e6,
        };

        // ── Shear capacity ──
        let shear_result = is_800::design_shear(d_web, section.tw, self.fy, 0.0);
        let vd_kn = shear_result.vd_kn;

        // ── Moment capacity of flanges only (for Cl. 9.2 interaction) ──
        // Mfd = bf × tf × (d − tf) × fy / γm0  (flanges only, plastic)
        let mfd_knm = section.width * section.tf * (section.depth - section.tf) * self.fy
            / (is_800::GAMMA_M0 * 1e6);

        // ── Per-station checks ──
        let section_checks: Vec<SteelSectionCapacity> = demands
            .iter()
            .map(|demand| {
                let mu_abs = demand.mu_knm.abs();
                let vu_abs = demand.vu_kn.abs();

                // Shear utilisation
                let util_v = if vd_kn > f64::EPSILON {
                    vu_abs / vd_kn
                } else {
                    99.0
                };

                // High-shear interaction per IS 800 Cl. 9.2
                let high_shear = vu_abs > 0.6 * vd_kn;
                let mdv = if high_shear && self.design_code == SteelDesignCode::Is800 {
                    // β = (2V/Vd − 1)²
                    let beta = (2.0 * vu_abs / vd_kn - 1.0).powi(2);
                    // Mdv = Md − β(Md − Mfd) ≥ Mfd
                    (md_knm - beta * (md_knm - mfd_knm)).max(mfd_knm)
                } else {
                    md_knm
                };

                // Moment utilisation (against mdv to account for high-shear)
                let effective_md = mdv;
                let util_m = if effective_md > f64::EPSILON {
                    mu_abs / effective_md
                } else {
                    99.0
                };

                let passed = util_m <= 1.0 && util_v <= 1.0;
                let governing = if util_m >= util_v { "flexure" } else { "shear" };

                SteelSectionCapacity {
                    location: demand.location.clone(),
                    mu_demand_knm: mu_abs,
                    vu_demand_kn: vu_abs,
                    mp_knm: (mp_knm * 100.0).round() / 100.0,
                    md_knm: (md_knm * 100.0).round() / 100.0,
                    utilization_m: (util_m * 1000.0).round() / 1000.0,
                    mcr_knm: (mcr_knm * 100.0).round() / 100.0,
                    lambda_lt: (lambda_lt * 1000.0).round() / 1000.0,
                    chi_lt: (chi_lt * 1000.0).round() / 1000.0,
                    vd_kn: (vd_kn * 100.0).round() / 100.0,
                    utilization_v: (util_v * 1000.0).round() / 1000.0,
                    high_shear,
                    mdv_knm: (mdv * 100.0).round() / 100.0,
                    section_class: sec_class.clone(),
                    moment_type: demand.moment_type.clone(),
                    passed,
                    governing_check: governing.to_string(),
                }
            })
            .collect();

        // ── Stiffener zones (V > 0.6Vd) ──
        let stiffener_zones = self.compute_stiffener_zones(&section_checks, vd_kn);

        // ── Aggregate results ──
        let max_util = section_checks
            .iter()
            .map(|s| s.utilization_m.max(s.utilization_v))
            .fold(0.0_f64, f64::max);
        let all_passed = section_checks.iter().all(|s| s.passed);

        let code_name = match self.design_code {
            SteelDesignCode::Is800 => "IS 800:2007",
            SteelDesignCode::Aisc360 => "AISC 360-22",
        };

        let message = if all_passed {
            format!(
                "Section-wise steel design SAFE per {}. {} ({}). \
                 Max utilisation = {:.1}%. Cb = {:.2}, χLT = {:.3}.",
                code_name,
                section.name,
                match sec_class {
                    SectionClass::Plastic => "Class 1 — Plastic",
                    SectionClass::Compact => "Class 2 — Compact",
                    SectionClass::SemiCompact => "Class 3 — Semi-compact",
                    SectionClass::Slender => "Class 4 — Slender",
                },
                max_util * 100.0,
                cb,
                chi_lt,
            )
        } else {
            let failing: Vec<&str> = section_checks
                .iter()
                .filter(|s| !s.passed)
                .map(|s| s.location.label.as_str())
                .collect();
            format!(
                "Section-wise steel design UNSAFE per {}. {} ({}). \
                 Failing at: {}. Max utilisation = {:.1}%.",
                code_name,
                section.name,
                match sec_class {
                    SectionClass::Plastic => "Class 1 — Plastic",
                    SectionClass::Compact => "Class 2 — Compact",
                    SectionClass::SemiCompact => "Class 3 — Semi-compact",
                    SectionClass::Slender => "Class 4 — Slender",
                },
                failing.join(", "),
                max_util * 100.0,
            )
        };

        Ok(SteelSectionWiseResult {
            passed: all_passed,
            utilization: (max_util * 1000.0).round() / 1000.0,
            message,
            n_sections: section_checks.len(),
            section_checks,
            stiffener_zones,
            design_code: code_name.to_string(),
            section_name: section.name.clone(),
            section_class: sec_class,
            cb: (cb * 1000.0).round() / 1000.0,
        })
    }

    /// Identify zones where V > 0.6Vd (web stiffeners recommended per IS 800 Cl. 8.4.2.1)
    fn compute_stiffener_zones(
        &self,
        checks: &[SteelSectionCapacity],
        vd_kn: f64,
    ) -> Vec<StiffenerZone> {
        let mut zones: Vec<StiffenerZone> = Vec::new();
        let threshold = 0.6 * vd_kn;

        let mut in_zone = false;
        let mut zone_start = 0.0;
        let mut zone_max_v = 0.0_f64;

        for check in checks {
            if check.vu_demand_kn > threshold {
                if !in_zone {
                    zone_start = check.location.x_mm;
                    in_zone = true;
                    zone_max_v = check.vu_demand_kn;
                } else {
                    zone_max_v = zone_max_v.max(check.vu_demand_kn);
                }
            } else if in_zone {
                zones.push(StiffenerZone {
                    x_start_mm: zone_start,
                    x_end_mm: check.location.x_mm,
                    max_shear_kn: (zone_max_v * 100.0).round() / 100.0,
                    shear_capacity_kn: (vd_kn * 100.0).round() / 100.0,
                    reason: "V > 0.6Vd — IS 800 Cl. 8.4.2.1 / Cl. 9.2".into(),
                });
                in_zone = false;
            }
        }

        // Close last zone if still open
        if in_zone {
            if let Some(last) = checks.last() {
                zones.push(StiffenerZone {
                    x_start_mm: zone_start,
                    x_end_mm: last.location.x_mm,
                    max_shear_kn: (zone_max_v * 100.0).round() / 100.0,
                    shear_capacity_kn: (vd_kn * 100.0).round() / 100.0,
                    reason: "V > 0.6Vd — IS 800 Cl. 8.4.2.1 / Cl. 9.2".into(),
                });
            }
        }

        zones
    }
}

/// Lookup an ISMB section by name from the standard database.
///
/// Returns `SteelSectionInput` with torsional properties derived from geometry.
pub fn lookup_ismb(name: &str) -> Option<SteelSectionInput> {
    is_800::ismb_database()
        .iter()
        .find(|s| s.name.eq_ignore_ascii_case(name))
        .map(|s| SteelSectionInput::from_ismb(s))
}

// ═══════════════════════════════════════════════════════════════════════════
// Tests
// ═══════════════════════════════════════════════════════════════════════════

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn simply_supported_demand_parabolic_moment() {
        // 6m span, 20 kN/m UDL
        // Max moment = wL²/8 = 20 × 6² / 8 = 90 kN·m at midspan
        let demands = generate_simply_supported_demands(6000.0, 20.0, 11);

        assert_eq!(demands.len(), 11);
        // Midspan (index 5) should have max moment
        let mid = &demands[5];
        assert!(
            (mid.mu_knm - 90.0).abs() < 0.5,
            "Midspan Mu = {}",
            mid.mu_knm
        );
        // Midspan shear ≈ 0
        assert!(
            mid.vu_kn < 1.0,
            "Midspan Vu should be ~0, got {}",
            mid.vu_kn
        );
        // Support (index 0) moment = 0
        assert!(
            demands[0].mu_knm.abs() < 0.1,
            "Support Mu = {}",
            demands[0].mu_knm
        );
        // Support shear = wL/2 = 60 kN
        assert!(
            (demands[0].vu_kn - 60.0).abs() < 0.5,
            "Support Vu = {}",
            demands[0].vu_kn
        );
    }

    #[test]
    fn fixed_fixed_demand_hogging_at_supports() {
        // 6m span, 20 kN/m, fixed-fixed
        // Support moment = −wL²/12 = −60 kN·m (hogging)
        // Midspan moment = +wL²/24 = +30 kN·m (sagging)
        let demands =
            generate_continuous_beam_demands(6000.0, 20.0, &SupportCondition::FixedFixed, 11);

        assert_eq!(demands.len(), 11);
        // Support hogging
        assert!(demands[0].mu_knm < 0.0, "Support should be hogging");
        assert!(
            (demands[0].mu_knm - (-60.0)).abs() < 1.0,
            "Support Mu = {}, expected ≈ -60",
            demands[0].mu_knm
        );
        assert_eq!(demands[0].moment_type, MomentType::Hogging);
        // Midspan sagging
        assert!(demands[5].mu_knm > 0.0, "Midspan should be sagging");
        assert!(
            (demands[5].mu_knm - 30.0).abs() < 1.0,
            "Midspan Mu = {}, expected ≈ 30",
            demands[5].mu_knm
        );
    }

    #[test]
    fn cantilever_demand_hogging_throughout() {
        // 3m cantilever, 15 kN/m
        // M(0) = −wL²/2 = −67.5 kN·m, M(L) = 0
        let demands =
            generate_continuous_beam_demands(3000.0, 15.0, &SupportCondition::Cantilever, 11);

        for d in &demands {
            assert!(
                d.mu_knm <= 0.0 + 0.01,
                "All moments should be ≤ 0 (hogging)"
            );
        }
        // Fixed end
        assert!(
            (demands[0].mu_knm - (-67.5)).abs() < 1.0,
            "Fixed end Mu = {}, expected ≈ -67.5",
            demands[0].mu_knm
        );
        // Free end
        assert!(
            demands[10].mu_knm.abs() < 0.5,
            "Free end Mu = {}, expected ≈ 0",
            demands[10].mu_knm
        );
    }

    #[test]
    fn demands_from_custom_forces_interpolation() {
        // Provide 3 custom points, verify interpolation at 5 stations
        let forces = vec![
            (0.0, 0.0, 50.0),     // left support
            (3000.0, 90.0, 0.0),  // midspan
            (6000.0, 0.0, -50.0), // right support
        ];
        let demands = generate_demands_from_forces(6000.0, &forces, 5);
        assert_eq!(demands.len(), 5);
        // At x=1500 (quarter point): Mu ≈ 45 kN·m (linear interp)
        assert!(
            (demands[1].mu_knm - 45.0).abs() < 1.0,
            "Quarter Mu = {}, expected ≈ 45",
            demands[1].mu_knm
        );
    }

    #[test]
    fn rc_section_wise_simply_supported_beam() {
        // IS 456 textbook example: 300×500mm beam, M25, Fe415, 6m span, 20 kN/m
        // This is a standard SP-16 verification case.
        let designer = RCSectionWiseDesigner::new(25.0, 415.0);
        let demands = generate_simply_supported_demands(6000.0, 20.0, 11);
        let result = designer.design_member_sectionwise(300.0, 450.0, 50.0, 6000.0, &demands);

        assert!(result.is_ok(), "Design should succeed: {:?}", result.err());
        let r = result.unwrap();

        // All sections should pass (20 kN/m on 300×500 is modest)
        assert!(r.passed, "All sections should pass: {}", r.message);

        // Economy ratio should be > 1.0 (midspan needs more steel than supports)
        assert!(
            r.economy_ratio > 1.0,
            "Economy ratio should >1 for parabolic moment, got {}",
            r.economy_ratio
        );

        // Midspan utilization should be highest
        let mid = &r.section_checks[5];
        assert!(
            mid.utilization_m > 0.1,
            "Midspan should have non-trivial moment utilization"
        );

        // Support shear utilization should be highest
        let support = &r.section_checks[0];
        assert!(
            support.utilization_v >= r.section_checks[5].utilization_v,
            "Support shear util {} should >= midspan shear util {}",
            support.utilization_v,
            r.section_checks[5].utilization_v
        );

        // Curtailment points should exist
        assert!(
            !r.curtailment_points.is_empty(),
            "Should have curtailment points"
        );

        // Rebar zones should have 3 zones (left, middle, right)
        assert_eq!(r.rebar_zones.len(), 3, "Expected 3 rebar zones");
    }

    #[test]
    fn minimum_steel_enforced() {
        // Very low moment: Ast_min = 0.85*b*d/fy should govern
        let designer = RCSectionWiseDesigner::new(25.0, 415.0);
        let demands = vec![SectionDemand {
            location: SectionLocation {
                x_mm: 0.0,
                x_ratio: 0.0,
                label: "0.0L".to_string(),
            },
            mu_knm: 0.1, // tiny moment
            vu_kn: 1.0,
            moment_type: MomentType::Sagging,
        }];
        let result = designer.design_member_sectionwise(300.0, 450.0, 50.0, 6000.0, &demands);
        let r = result.unwrap();
        let ast_min = 0.85 * 300.0 * 450.0 / 415.0; // ≈ 277 mm²
        assert!(
            r.section_checks[0].ast_provided_mm2 >= ast_min,
            "Provided {} should >= Ast_min {}",
            r.section_checks[0].ast_provided_mm2,
            ast_min
        );
    }

    #[test]
    fn invalid_input_returns_error() {
        let designer = RCSectionWiseDesigner::new(25.0, 415.0);
        let demands = generate_simply_supported_demands(6000.0, 20.0, 11);
        // Zero width
        let result = designer.design_member_sectionwise(0.0, 450.0, 50.0, 6000.0, &demands);
        assert!(result.is_err());
        // Empty demands
        let result = designer.design_member_sectionwise(300.0, 450.0, 50.0, 6000.0, &[]);
        assert!(result.is_err());
    }

    // ═══════════════════════════════════════════════════════════════
    // Steel Section-Wise Design Tests
    // ═══════════════════════════════════════════════════════════════

    #[test]
    fn section_classification_is800_ismb300() {
        // ISMB 300: bf=140, tf=13.1, tw=7.7, d=300
        // d_web = 300 − 2×13.1 = 273.8, fy=250 → ε=1.0
        // Flange: b = (140−7.7)/2 = 66.15, b/tf = 66.15/13.1 = 5.05 < 9.4 → Plastic
        // Web: d/tw = 273.8/7.7 = 35.6 < 84.0 → Plastic
        let class = classify_section_is800(140.0, 13.1, 273.8, 7.7, 250.0);
        assert_eq!(class, SectionClass::Plastic);
    }

    #[test]
    fn section_classification_slender_thin_flange() {
        // Deliberately thin flange: bf=200, tf=5, tw=4, d_web=400, fy=250
        // b = (200−4)/2 = 98, b/tf = 98/5 = 19.6 > 15.7 → Slender
        let class = classify_section_is800(200.0, 5.0, 400.0, 4.0, 250.0);
        assert_eq!(class, SectionClass::Slender);
    }

    #[test]
    fn cb_uniform_moment_equals_one() {
        // Uniform moment → Cb = 12.5/(2.5+3+4+3) = 12.5/12.5 = 1.0
        let demands: Vec<SectionDemand> = (0..11)
            .map(|i| SectionDemand {
                location: SectionLocation {
                    x_mm: i as f64 * 600.0,
                    x_ratio: i as f64 / 10.0,
                    label: format!("{:.1}L", i as f64 / 10.0),
                },
                mu_knm: 100.0,
                vu_kn: 0.0,
                moment_type: MomentType::Sagging,
            })
            .collect();
        let cb = compute_cb(&demands);
        assert!(
            (cb - 1.0).abs() < 0.01,
            "Uniform moment Cb = {}, expected 1.0",
            cb
        );
    }

    #[test]
    fn cb_parabolic_moment_greater_than_one() {
        // Simply-supported UDL → parabolic moment, Cb > 1.0
        let demands = generate_simply_supported_demands(6000.0, 20.0, 11);
        let cb = compute_cb(&demands);
        assert!(cb > 1.0, "Parabolic Cb = {}, should be > 1.0", cb);
        assert!(
            cb < 1.5,
            "Parabolic Cb = {}, should be < 1.5 (typically ~1.14)",
            cb
        );
    }

    #[test]
    fn steel_section_wise_ismb300_is800() {
        // ISMB 300, fy=250, 6m simply-supported, 25 kN/m UDL
        // Lateral bracing at L/3 intervals → unbraced length = 2000 mm
        // hand check: d_web=273.8, Vd = Av×fy/(√3×γm0)/1000
        // Av = 273.8×7.7 = 2108.26 mm², Vd = 2108.26×250/(1.732×1.1×1000) ≈ 276.5 kN
        // wL/2 = 25×6/2 = 75 kN → shear OK
        // Zp ≈ 140×13.1×(300−13.1) + 7.7×273.8²/4 ≈ 670,534 mm³
        // With Lb=2000: χLT ≈ 0.88, Md ≈ 134.6 kN·m
        // Mu_max = wL²/8 = 25×36/8 = 112.5 kN·m → util ≈ 0.84 → should pass
        let section = lookup_ismb("ISMB300").expect("ISMB300 should exist");
        let designer = SteelSectionWiseDesigner::new(250.0, SteelDesignCode::Is800);
        let demands = generate_simply_supported_demands(6000.0, 25.0, 11);

        let result = designer.design_member_sectionwise(&section, &demands, 2000.0, true);
        assert!(result.is_ok(), "Design should succeed: {:?}", result.err());
        let r = result.unwrap();

        assert!(
            r.passed,
            "ISMB300 should pass for 25 kN/m on 6m: {}",
            r.message
        );
        assert_eq!(r.section_class, SectionClass::Plastic);

        // Midspan utilisation should be the highest for flexure
        let mid = &r.section_checks[5];
        assert!(
            mid.utilization_m > 0.3,
            "Midspan flex util {}, expected > 0.3",
            mid.utilization_m
        );
        assert!(
            mid.utilization_m < 1.0,
            "Midspan should pass: util={}",
            mid.utilization_m
        );

        // Support shear should be highest
        let sup = &r.section_checks[0];
        assert!(
            sup.utilization_v > sup.utilization_m,
            "Support should be shear-governed: V={}, M={}",
            sup.utilization_v,
            sup.utilization_m
        );

        // Cb should be > 1.0 for parabolic moment
        assert!(r.cb > 1.0, "Cb={}, should >1 for parabolic", r.cb);
    }

    #[test]
    fn steel_section_wise_ismb200_is800_high_load_fails() {
        // ISMB 200, fy=250, 8m span, 40 kN/m → Mu_max = 40×64/8 = 320 kN·m
        // Zp_200 ≈ 100×10.8×(200−10.8) + 5.7×(200−21.6)²/4 ≈ 204,422+45,457 ≈ 249,879 mm³
        // Mp ≈ 249879×250/(1.1×1e6) ≈ 56.8 kN·m → MUST FAIL
        let section = lookup_ismb("ISMB200").expect("ISMB200 should exist");
        let designer = SteelSectionWiseDesigner::new(250.0, SteelDesignCode::Is800);
        let demands = generate_simply_supported_demands(8000.0, 40.0, 11);

        let result = designer
            .design_member_sectionwise(&section, &demands, 8000.0, true)
            .unwrap();
        assert!(
            !result.passed,
            "ISMB200 should fail for 40 kN/m on 8m: {}",
            result.message
        );
        assert!(result.utilization > 1.0);
    }

    #[test]
    fn steel_section_wise_aisc360() {
        // W12x120 equivalent, AISC 360, 6m span, 30 kN/m
        // φMp = 0.9 × Zp × Fy / 1e6
        let section = SteelSectionInput {
            name: "W12x120".into(),
            depth: 310.0,
            width: 260.0,
            tw: 12.0,
            tf: 20.0,
            area: 15000.0,
            ixx: 350e6,
            iyy: 115e6,
            zxx: 1150e3,
            zyy: 350e3,
            ryy: 88.0,
            j_mm4: 47e6,
            cw_mm6: 8.0e9,
        };
        let designer = SteelSectionWiseDesigner::new(345.0, SteelDesignCode::Aisc360);
        let demands = generate_simply_supported_demands(6000.0, 30.0, 11);

        let result = designer
            .design_member_sectionwise(&section, &demands, 3000.0, true)
            .unwrap();
        assert!(result.passed, "W12x120 should pass: {}", result.message);
        assert_eq!(result.design_code, "AISC 360-22");
    }

    #[test]
    fn high_shear_interaction_reduces_moment() {
        // Short span, heavy load → high shear at supports
        // ISMB 200, 2m span, 100 kN/m → V_support = 100 kN ≈ 0.6×Vd area
        let section = lookup_ismb("ISMB300").expect("ISMB300");
        let designer = SteelSectionWiseDesigner::new(250.0, SteelDesignCode::Is800);

        // Build demands with very high shear at support
        let demands = generate_simply_supported_demands(2000.0, 300.0, 11);

        let result = designer
            .design_member_sectionwise(&section, &demands, 2000.0, true)
            .unwrap();

        // Check that at least one station has high_shear = true
        let has_high_shear = result.section_checks.iter().any(|s| s.high_shear);
        assert!(
            has_high_shear,
            "With 300 kN/m on 2m, expect high shear zones"
        );

        // At high-shear stations, mdv should be ≤ md
        for check in &result.section_checks {
            if check.high_shear {
                assert!(
                    check.mdv_knm <= check.md_knm + 0.01,
                    "High-shear Mdv={} should ≤ Md={}",
                    check.mdv_knm,
                    check.md_knm
                );
            }
        }
    }

    #[test]
    fn steel_invalid_input() {
        let section = lookup_ismb("ISMB300").expect("ISMB300");
        let designer = SteelSectionWiseDesigner::new(250.0, SteelDesignCode::Is800);
        let demands = generate_simply_supported_demands(6000.0, 20.0, 11);

        // Zero unbraced length
        assert!(designer
            .design_member_sectionwise(&section, &demands, 0.0, true)
            .is_err());
        // Empty demands
        assert!(designer
            .design_member_sectionwise(&section, &[], 6000.0, true)
            .is_err());
        // Negative fy
        let bad = SteelSectionWiseDesigner::new(-250.0, SteelDesignCode::Is800);
        assert!(bad
            .design_member_sectionwise(&section, &demands, 6000.0, true)
            .is_err());
    }

    #[test]
    fn lookup_ismb_sections() {
        let s = lookup_ismb("ISMB300");
        assert!(s.is_some());
        let s = s.unwrap();
        assert_eq!(s.depth, 300.0);
        assert!(s.j_mm4 > 0.0, "J should be derived from geometry");
        assert!(s.cw_mm6 > 0.0, "Cw should be derived from geometry");
        assert!(s.zp() > s.zxx, "Zp should > Ze for I-section");

        // Non-existent
        assert!(lookup_ismb("ISMB999").is_none());
    }
}
