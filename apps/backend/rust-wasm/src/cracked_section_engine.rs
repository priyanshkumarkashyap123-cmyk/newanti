// =====================================================================
// Cracked Section & Effective Moment of Inertia Engine
// =====================================================================
//
// For concrete deflection, gross inertia (Ig) is useless under service
// loads.  This module computes:
//   - Cracking moment (Mcr)
//   - Cracked moment of inertia (Icr) for a given reinforcement layout
//   - Effective moment of inertia (Ie) per ACI 318-19 / IS 456:2000
//   - Long-term deflection multiplier (creep + shrinkage)
//   - Iterative deflection convergence for non-uniform moment diagrams
//
// References:
//   ACI 318-19  §24.2
//   IS 456:2000 §23.2, Annex C
//   EN 1992-1-1 (Eurocode 2) §7.4
// =====================================================================

use std::f64::consts::PI;

// ─── Material properties ────────────────────────────────────────────

/// Concrete grade properties.
#[derive(Debug, Clone)]
pub struct ConcreteProperties {
    pub fck_mpa: f64,        // characteristic compressive strength
    pub ec_mpa: f64,         // modulus of elasticity
    pub fr_mpa: f64,         // modulus of rupture
    pub gamma_c: f64,        // unit weight (kN/m³)
    pub creep_coefficient: f64,
    pub shrinkage_strain: f64,
}

impl ConcreteProperties {
    /// IS 456 / ACI standard concrete from fck (MPa).
    pub fn from_fck(fck: f64) -> Self {
        let ec = 5000.0 * fck.sqrt();         // IS 456: Ec = 5000√fck
        let fr = 0.7 * fck.sqrt();            // IS 456: fr = 0.7√fck
        ConcreteProperties {
            fck_mpa: fck,
            ec_mpa: ec,
            fr_mpa: fr,
            gamma_c: 25.0,
            creep_coefficient: 1.6,
            shrinkage_strain: 0.0003,
        }
    }

    /// ACI 318 concrete from f'c (MPa).
    pub fn from_fc_aci(fc: f64) -> Self {
        let ec = 4700.0 * fc.sqrt();          // ACI 318: Ec = 4700√f'c  (MPa)
        let fr = 0.62 * fc.sqrt();            // ACI 318: fr = 0.62√f'c
        ConcreteProperties {
            fck_mpa: fc,
            ec_mpa: ec,
            fr_mpa: fr,
            gamma_c: 24.0,
            creep_coefficient: 2.0,
            shrinkage_strain: 0.0004,
        }
    }
}

/// Reinforcement bar layer.
#[derive(Debug, Clone)]
pub struct RebarLayer {
    pub n_bars: usize,
    pub bar_dia_mm: f64,
    pub distance_from_extreme_comp_mm: f64,  // d or d' from top
}

impl RebarLayer {
    pub fn area_mm2(&self) -> f64 {
        self.n_bars as f64 * PI / 4.0 * self.bar_dia_mm * self.bar_dia_mm
    }
}

// ─── Section geometry ───────────────────────────────────────────────

/// Rectangular or flanged section.
#[derive(Debug, Clone)]
pub struct RCSection {
    pub b_mm: f64,              // width (or web width for T-section)
    pub h_mm: f64,              // total depth
    pub bf_mm: Option<f64>,     // flange width (T/L beam)
    pub hf_mm: Option<f64>,     // flange thickness
    pub tension_bars: Vec<RebarLayer>,
    pub compression_bars: Vec<RebarLayer>,
}

impl RCSection {
    /// Simple rectangular beam.
    pub fn rectangular(b: f64, h: f64) -> Self {
        RCSection { b_mm: b, h_mm: h, bf_mm: None, hf_mm: None,
            tension_bars: vec![], compression_bars: vec![] }
    }

    /// T-beam / L-beam.
    pub fn flanged(bw: f64, h: f64, bf: f64, hf: f64) -> Self {
        RCSection { b_mm: bw, h_mm: h, bf_mm: Some(bf), hf_mm: Some(hf),
            tension_bars: vec![], compression_bars: vec![] }
    }

    pub fn with_tension_bars(mut self, bars: Vec<RebarLayer>) -> Self {
        self.tension_bars = bars; self
    }

    pub fn with_compression_bars(mut self, bars: Vec<RebarLayer>) -> Self {
        self.compression_bars = bars; self
    }

    /// Total tension steel area (mm²).
    pub fn ast_mm2(&self) -> f64 {
        self.tension_bars.iter().map(|l| l.area_mm2()).sum()
    }

    /// Total compression steel area (mm²).
    pub fn asc_mm2(&self) -> f64 {
        self.compression_bars.iter().map(|l| l.area_mm2()).sum()
    }

    /// Effective depth (mm) — centroid of tension steel from top.
    pub fn d_eff(&self) -> f64 {
        let total = self.ast_mm2();
        if total < 1e-6 { return self.h_mm - 50.0; }
        let sum: f64 = self.tension_bars.iter()
            .map(|l| l.area_mm2() * l.distance_from_extreme_comp_mm)
            .sum();
        sum / total
    }

    /// Gross moment of inertia about centroid (mm⁴).
    pub fn ig_mm4(&self) -> f64 {
        let b = self.bf_mm.unwrap_or(self.b_mm);
        let h = self.h_mm;
        match (self.bf_mm, self.hf_mm) {
            (Some(bf), Some(hf)) => {
                // T-section: flange rectangle + web rectangle about centroid
                let bw = self.b_mm;
                let hw = h - hf;
                let a_flange = bf * hf;
                let a_web = bw * hw;
                let a_total = a_flange + a_web;
                let y_f = hf / 2.0;
                let y_w = hf + hw / 2.0;
                let y_bar = (a_flange * y_f + a_web * y_w) / a_total;
                let i_f = bf * hf.powi(3) / 12.0 + a_flange * (y_bar - y_f).powi(2);
                let i_w = bw * hw.powi(3) / 12.0 + a_web * (y_bar - y_w).powi(2);
                i_f + i_w
            }
            _ => b * h.powi(3) / 12.0,
        }
    }

    /// Distance from centroid to extreme tension fibre (mm).
    pub fn yt(&self) -> f64 {
        match (self.bf_mm, self.hf_mm) {
            (Some(bf), Some(hf)) => {
                let bw = self.b_mm;
                let hw = self.h_mm - hf;
                let a_f = bf * hf;
                let a_w = bw * hw;
                let y_bar = (a_f * hf / 2.0 + a_w * (hf + hw / 2.0)) / (a_f + a_w);
                self.h_mm - y_bar
            }
            _ => self.h_mm / 2.0,
        }
    }
}

// ─── Cracked section analysis ───────────────────────────────────────

/// Results of cracked section computation.
#[derive(Debug, Clone)]
pub struct CrackedSectionResult {
    /// Cracking moment (kN·m)
    pub mcr_knm: f64,
    /// Neutral axis depth of cracked section (mm)
    pub x_cr_mm: f64,
    /// Cracked moment of inertia (mm⁴)
    pub icr_mm4: f64,
    /// Gross moment of inertia (mm⁴)
    pub ig_mm4: f64,
    /// Modular ratio n = Es / Ec
    pub modular_ratio: f64,
    /// Effective moment of inertia at Ma (mm⁴)
    pub ie_mm4: f64,
    /// Applied moment used (kN·m)
    pub ma_knm: f64,
    /// Ratio Ig / Ie
    pub stiffness_reduction: f64,
}

/// Compute cracking moment Mcr.
pub fn cracking_moment(section: &RCSection, conc: &ConcreteProperties) -> f64 {
    let ig = section.ig_mm4();
    let yt = section.yt();
    // Mcr = fr × Ig / yt  (N·mm → kN·m)
    conc.fr_mpa * ig / yt / 1e6
}

/// Compute cracked neutral axis depth and Icr for a rectangular section.
/// Uses the transformed section method:   b·x²/2 + (n-1)·Asc·(x-d') = n·Ast·(d-x)
pub fn cracked_section_rectangular(
    section: &RCSection,
    conc: &ConcreteProperties,
    es_mpa: f64,   // steel Es (typically 200,000 MPa)
) -> (f64, f64) {
    let n = es_mpa / conc.ec_mpa;
    let b = section.b_mm;
    let d = section.d_eff();
    let ast = section.ast_mm2();
    let asc = section.asc_mm2();
    let d_prime = if !section.compression_bars.is_empty() {
        section.compression_bars[0].distance_from_extreme_comp_mm
    } else { 50.0 };

    // Quadratic: (b/2)·x² + (n·Ast + (n-1)·Asc)·x - (n·Ast·d + (n-1)·Asc·d') = 0
    // Simplified: (b/2)·x² + n·Ast·(x - d) + (n-1)·Asc·(x - d') = 0
    let a_coeff = b / 2.0;
    let b_coeff = n * ast + (n - 1.0) * asc;
    let c_coeff = -(n * ast * d + (n - 1.0) * asc * d_prime);

    let discriminant = b_coeff * b_coeff - 4.0 * a_coeff * c_coeff;
    let x = (-b_coeff + discriminant.max(0.0).sqrt()) / (2.0 * a_coeff);
    let x = x.max(0.0).min(d);

    // Icr = b·x³/3 + n·Ast·(d-x)² + (n-1)·Asc·(x-d')²
    let icr = b * x.powi(3) / 3.0
        + n * ast * (d - x).powi(2)
        + (n - 1.0) * asc * (x - d_prime).powi(2);

    (x, icr)
}

/// Compute cracked section for T-beam.
pub fn cracked_section_flanged(
    section: &RCSection,
    conc: &ConcreteProperties,
    es_mpa: f64,
) -> (f64, f64) {
    let bf = section.bf_mm.unwrap_or(section.b_mm);
    let hf = section.hf_mm.unwrap_or(0.0);
    let bw = section.b_mm;
    let n = es_mpa / conc.ec_mpa;
    let d = section.d_eff();
    let ast = section.ast_mm2();
    let asc = section.asc_mm2();
    let d_prime = if !section.compression_bars.is_empty() {
        section.compression_bars[0].distance_from_extreme_comp_mm
    } else { 50.0 };

    // First try NA within flange
    let (x_rect, icr_rect) = {
        // Treat as rectangular with width = bf
        let a = bf / 2.0;
        let b_c = n * ast + (n - 1.0) * asc;
        let c = -(n * ast * d + (n - 1.0) * asc * d_prime);
        let disc = b_c * b_c - 4.0 * a * c;
        let x = (-b_c + disc.max(0.0).sqrt()) / (2.0 * a);
        let x = x.max(0.0);
        let icr = bf * x.powi(3) / 3.0 + n * ast * (d - x).powi(2)
            + (n - 1.0) * asc * (x - d_prime).powi(2);
        (x, icr)
    };

    if x_rect <= hf {
        // NA in flange → rectangular treatment is correct
        return (x_rect, icr_rect);
    }

    // NA in web: bf·hf·(x - hf/2) + bw·(x-hf)²/2 = n·Ast·(d-x) + ...
    // Solve iteratively
    let mut x = hf + 10.0; // initial guess
    for _ in 0..50 {
        let f = bf * hf * (x - hf / 2.0) + bw * (x - hf).powi(2) / 2.0
            + (n - 1.0) * asc * (x - d_prime)
            - n * ast * (d - x);
        let df = bf * hf + bw * (x - hf) + (n - 1.0) * asc + n * ast;
        let dx = f / df;
        x -= dx;
        if dx.abs() < 0.001 { break; }
    }
    x = x.max(hf).min(d);

    let icr = bf * hf.powi(3) / 12.0 + bf * hf * (x - hf / 2.0).powi(2)
        + bw * (x - hf).powi(3) / 3.0
        + n * ast * (d - x).powi(2)
        + (n - 1.0) * asc * (x - d_prime).powi(2);

    (x, icr)
}

// ─── Effective moment of inertia ────────────────────────────────────

#[derive(Debug, Clone, Copy, PartialEq)]
pub enum IeMethod {
    /// ACI 318 / IS 456 — Branson's equation
    BransonACI,
    /// Eurocode 2 — interpolation coefficient ζ
    Eurocode2,
    /// ACI 318-19 — Bischoff's equation (improved)
    BischoffACI318_19,
}

/// Compute effective moment of inertia Ie.
pub fn effective_inertia(
    ig: f64, icr: f64, mcr: f64, ma: f64,
    method: IeMethod,
) -> f64 {
    if ma.abs() < 1e-6 || ma.abs() <= mcr.abs() {
        return ig; // uncracked
    }

    match method {
        IeMethod::BransonACI => {
            // Ie = (Mcr/Ma)³ × Ig + (1 - (Mcr/Ma)³) × Icr
            let ratio = (mcr / ma).powi(3);
            let ie = ratio * ig + (1.0 - ratio) * icr;
            ie.min(ig).max(icr)
        }
        IeMethod::Eurocode2 => {
            // ζ = 1 - β₁·β₂·(Mcr/Ma)²,  β₁=1.0(deformed), β₂=0.5(long-term)
            let beta1 = 1.0;
            let beta2 = 0.5; // long-term
            let zeta = (1.0 - beta1 * beta2 * (mcr / ma).powi(2)).max(0.0);
            let ie = (1.0 - zeta) * ig + zeta * icr;
            ie.min(ig).max(icr)
        }
        IeMethod::BischoffACI318_19 => {
            // Ie = Icr / (1 - (1 - Icr/Ig)·(Mcr/Ma)²)
            let ratio_sq = (mcr / ma).powi(2);
            let denom = 1.0 - (1.0 - icr / ig) * ratio_sq;
            if denom < 0.01 { return ig; }
            let ie = icr / denom;
            ie.min(ig).max(icr)
        }
    }
}

// ─── Long-term deflection multiplier ────────────────────────────────

/// ACI 318 long-term multiplier λΔ = ξ / (1 + 50ρ')
/// where ξ depends on duration, ρ' = compression steel ratio.
pub fn long_term_multiplier_aci(
    duration_months: f64,
    rho_prime: f64,     // Asc / (b·d)
) -> f64 {
    let xi = if duration_months >= 60.0 { 2.0 }
    else if duration_months >= 36.0 { 1.8 }
    else if duration_months >= 12.0 { 1.4 }
    else if duration_months >= 6.0 { 1.2 }
    else { 1.0 };
    xi / (1.0 + 50.0 * rho_prime)
}

/// IS 456 method: shrinkage + creep deflection separately.
pub fn long_term_multiplier_is456(
    creep_coefficient: f64,
    _shrinkage_strain: f64,
    rho_prime: f64,
) -> f64 {
    // IS 456 Annex C.3.1: λ = 1 + Cθ / (1 + ρ'/ρ_bal)
    // Simplified: total multiplier ≈ (1 + creep_coeff) / (1 + 50ρ')
    (1.0 + creep_coefficient) / (1.0 + 50.0 * rho_prime)
}

// ─── Deflection computation ─────────────────────────────────────────

/// Simply-supported beam deflection under UDL.
pub fn deflection_udl(
    w_kn_per_m: f64,
    span_mm: f64,
    ie_mm4: f64,
    ec_mpa: f64,
) -> f64 {
    // δ = 5·w·L⁴ / (384·E·I)
    let w_n_per_mm = w_kn_per_m * 1e3 / 1000.0; // N/mm
    5.0 * w_n_per_mm * span_mm.powi(4) / (384.0 * ec_mpa * ie_mm4)
}

/// Cantilever deflection under UDL.
pub fn deflection_cantilever_udl(
    w_kn_per_m: f64,
    span_mm: f64,
    ie_mm4: f64,
    ec_mpa: f64,
) -> f64 {
    let w_n_per_mm = w_kn_per_m * 1e3 / 1000.0;
    w_n_per_mm * span_mm.powi(4) / (8.0 * ec_mpa * ie_mm4)
}

/// Simply-supported beam with point load at midspan.
pub fn deflection_point_midspan(
    p_kn: f64,
    span_mm: f64,
    ie_mm4: f64,
    ec_mpa: f64,
) -> f64 {
    let p = p_kn * 1e3; // N
    p * span_mm.powi(3) / (48.0 * ec_mpa * ie_mm4)
}

// ─── Full analysis pipeline ─────────────────────────────────────────

/// Configuration for cracked-section deflection analysis.
#[derive(Debug, Clone)]
pub struct CrackedDeflectionConfig {
    pub es_mpa: f64,                 // steel modulus (default 200,000)
    pub method: IeMethod,
    pub long_term_months: f64,       // load duration
    pub include_long_term: bool,
}

impl Default for CrackedDeflectionConfig {
    fn default() -> Self {
        Self {
            es_mpa: 200_000.0,
            method: IeMethod::BransonACI,
            long_term_months: 60.0,
            include_long_term: true,
        }
    }
}

/// Full result of cracked-section deflection analysis.
#[derive(Debug, Clone)]
pub struct CrackedDeflectionResult {
    pub section_properties: CrackedSectionResult,
    pub immediate_deflection_mm: f64,
    pub long_term_multiplier: f64,
    pub long_term_deflection_mm: f64,
    pub total_deflection_mm: f64,
    pub span_ratio: f64,                // L / δ_total
    pub allowable_span_ratio: f64,      // e.g. L/250
    pub pass: bool,
}

/// Run the full cracked-section deflection analysis.
pub fn run_cracked_deflection_analysis(
    section: &RCSection,
    conc: &ConcreteProperties,
    config: &CrackedDeflectionConfig,
    applied_moment_knm: f64,
    span_mm: f64,
    load_kn_per_m: f64,
    allowable_span_ratio: f64,      // e.g. 250.0 for L/250
) -> CrackedDeflectionResult {
    let ig = section.ig_mm4();
    let mcr = cracking_moment(section, conc);

    // Cracked section
    let (x_cr, icr) = if section.bf_mm.is_some() {
        cracked_section_flanged(section, conc, config.es_mpa)
    } else {
        cracked_section_rectangular(section, conc, config.es_mpa)
    };

    let n = config.es_mpa / conc.ec_mpa;

    // Effective inertia
    let ie = effective_inertia(ig, icr, mcr, applied_moment_knm, config.method);

    let sec_result = CrackedSectionResult {
        mcr_knm: mcr,
        x_cr_mm: x_cr,
        icr_mm4: icr,
        ig_mm4: ig,
        modular_ratio: n,
        ie_mm4: ie,
        ma_knm: applied_moment_knm,
        stiffness_reduction: ig / ie.max(1.0),
    };

    // Immediate deflection
    let defl_imm = deflection_udl(load_kn_per_m, span_mm, ie, conc.ec_mpa);

    // Long-term multiplier
    let d_eff = section.d_eff();
    let rho_prime = section.asc_mm2() / (section.b_mm * d_eff).max(1.0);
    let lt_mult = if config.include_long_term {
        long_term_multiplier_aci(config.long_term_months, rho_prime)
    } else { 0.0 };

    let defl_lt = defl_imm * lt_mult;
    let defl_total = defl_imm + defl_lt;
    let span_ratio = span_mm / defl_total.max(0.001);
    let pass = span_ratio >= allowable_span_ratio;

    CrackedDeflectionResult {
        section_properties: sec_result,
        immediate_deflection_mm: defl_imm,
        long_term_multiplier: lt_mult,
        long_term_deflection_mm: defl_lt,
        total_deflection_mm: defl_total,
        span_ratio,
        allowable_span_ratio,
        pass,
    }
}

// =====================================================================
// Tests
// =====================================================================

#[cfg(test)]
mod tests {
    use super::*;

    fn test_section() -> (RCSection, ConcreteProperties) {
        let sec = RCSection::rectangular(300.0, 500.0)
            .with_tension_bars(vec![
                RebarLayer { n_bars: 3, bar_dia_mm: 20.0, distance_from_extreme_comp_mm: 450.0 },
            ])
            .with_compression_bars(vec![
                RebarLayer { n_bars: 2, bar_dia_mm: 12.0, distance_from_extreme_comp_mm: 50.0 },
            ]);
        let conc = ConcreteProperties::from_fck(30.0);
        (sec, conc)
    }

    #[test]
    fn test_rebar_area() {
        let layer = RebarLayer { n_bars: 4, bar_dia_mm: 16.0, distance_from_extreme_comp_mm: 450.0 };
        let area = layer.area_mm2();
        let expected = 4.0 * PI / 4.0 * 16.0 * 16.0;
        assert!((area - expected).abs() < 0.1);
    }

    #[test]
    fn test_gross_inertia_rectangular() {
        let sec = RCSection::rectangular(300.0, 500.0);
        let ig = sec.ig_mm4();
        let expected = 300.0 * 500.0_f64.powi(3) / 12.0;
        assert!((ig - expected).abs() / expected < 0.001);
    }

    #[test]
    fn test_cracking_moment() {
        let (sec, conc) = test_section();
        let mcr = cracking_moment(&sec, &conc);
        // fr = 0.7√30 = 3.834 MPa,  Ig = 3.125e9,  yt = 250
        // Mcr = 3.834 × 3.125e9 / 250 / 1e6 ≈ 47.9 kN·m
        assert!(mcr > 40.0 && mcr < 60.0, "Mcr={}", mcr);
    }

    #[test]
    fn test_cracked_na_depth() {
        let (sec, conc) = test_section();
        let (x, icr) = cracked_section_rectangular(&sec, &conc, 200_000.0);
        // NA should be well above mid-depth for typical beam
        assert!(x > 50.0 && x < 250.0, "x_cr={}", x);
        assert!(icr > 0.0);
        let ig = sec.ig_mm4();
        assert!(icr < ig, "Icr must be < Ig");
    }

    #[test]
    fn test_effective_inertia_branson() {
        let ig = 3.125e9;
        let icr = 1.0e9;
        let mcr = 48.0;
        let ma = 120.0;
        let ie = effective_inertia(ig, icr, mcr, ma, IeMethod::BransonACI);
        assert!(ie >= icr && ie <= ig, "Ie={}", ie);
        // For Ma >> Mcr, Ie → Icr
        let ie_high = effective_inertia(ig, icr, mcr, 500.0, IeMethod::BransonACI);
        assert!((ie_high - icr) / icr < 0.05, "High moment → Ie≈Icr");
    }

    #[test]
    fn test_effective_inertia_bischoff() {
        let ig = 3.125e9;
        let icr = 1.0e9;
        let mcr = 48.0;
        let ma = 120.0;
        let ie = effective_inertia(ig, icr, mcr, ma, IeMethod::BischoffACI318_19);
        assert!(ie >= icr && ie <= ig);
    }

    #[test]
    fn test_long_term_multiplier() {
        let lam_no_comp = long_term_multiplier_aci(60.0, 0.0);
        assert!((lam_no_comp - 2.0).abs() < 0.01, "No comp steel → λ=2.0");

        let lam_with_comp = long_term_multiplier_aci(60.0, 0.01);
        assert!(lam_with_comp < 2.0, "Comp steel reduces λ");
    }

    #[test]
    fn test_deflection_udl() {
        // 300×500 beam, 6m span, 20 kN/m, Ig concrete
        let ec = 5000.0 * 30.0_f64.sqrt();
        let ig = 300.0 * 500.0_f64.powi(3) / 12.0;
        let defl = deflection_udl(20.0, 6000.0, ig, ec);
        // Expect a few mm for this beam
        assert!(defl > 1.0 && defl < 30.0, "δ={}", defl);
    }

    #[test]
    fn test_full_pipeline() {
        let (sec, conc) = test_section();
        let config = CrackedDeflectionConfig::default();
        let result = run_cracked_deflection_analysis(
            &sec, &conc, &config,
            120.0,  // applied moment kN·m
            6000.0, // span mm
            20.0,   // load kN/m
            250.0,  // L/250
        );
        assert!(result.section_properties.mcr_knm > 0.0);
        assert!(result.section_properties.icr_mm4 < result.section_properties.ig_mm4);
        assert!(result.immediate_deflection_mm > 0.0);
        assert!(result.total_deflection_mm > result.immediate_deflection_mm);
        println!("Ie/Ig = {:.3}, δ_imm = {:.2} mm, δ_total = {:.2} mm, L/δ = {:.0}, pass={}",
            1.0/result.section_properties.stiffness_reduction,
            result.immediate_deflection_mm,
            result.total_deflection_mm,
            result.span_ratio,
            result.pass);
    }

    #[test]
    fn test_t_section_cracked() {
        let sec = RCSection::flanged(250.0, 600.0, 1200.0, 120.0)
            .with_tension_bars(vec![
                RebarLayer { n_bars: 5, bar_dia_mm: 25.0, distance_from_extreme_comp_mm: 550.0 },
            ]);
        let conc = ConcreteProperties::from_fck(35.0);
        let (x, icr) = cracked_section_flanged(&sec, &conc, 200_000.0);
        assert!(x > 0.0, "x_cr={}", x);
        assert!(icr > 0.0, "Icr={}", icr);
        let ig = sec.ig_mm4();
        assert!(icr < ig);
        println!("T-beam: x_cr={:.1} mm, Icr={:.3e}, Ig={:.3e}", x, icr, ig);
    }

    #[test]
    fn test_uncracked_returns_ig() {
        // Small moment < Mcr → Ie = Ig
        let (sec, conc) = test_section();
        let mcr = cracking_moment(&sec, &conc);
        let ig = sec.ig_mm4();
        let ie = effective_inertia(ig, 1.0e9, mcr, mcr * 0.5, IeMethod::BransonACI);
        assert!((ie - ig).abs() < 1.0, "Ma < Mcr → Ie = Ig");
    }
}
