// ============================================================================
// CRACK WIDTH & SERVICEABILITY MODULE
// IS 456:2000, Eurocode 2, ACI 318-19 crack width calculations
// Deflection, durability, and long-term serviceability checks
// ============================================================================

use serde::{Deserialize, Serialize};
use std::f64::consts::PI;

// ============================================================================
// EXPOSURE CLASSES AND CRACK WIDTH LIMITS
// ============================================================================

/// Exposure class per Eurocode 2
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum ExposureClass {
    /// X0 - No risk of corrosion
    X0,
    /// XC1 - Carbonation: dry or permanently wet
    XC1,
    /// XC2 - Carbonation: wet, rarely dry
    XC2,
    /// XC3 - Carbonation: moderate humidity
    XC3,
    /// XC4 - Carbonation: cyclic wet/dry
    XC4,
    /// XD1 - Chloride (non-marine): moderate humidity
    XD1,
    /// XD2 - Chloride (non-marine): wet, rarely dry
    XD2,
    /// XD3 - Chloride (non-marine): cyclic wet/dry
    XD3,
    /// XS1 - Chloride (marine): airborne salt
    XS1,
    /// XS2 - Chloride (marine): submerged
    XS2,
    /// XS3 - Chloride (marine): tidal/splash zone
    XS3,
}

impl ExposureClass {
    /// Maximum crack width (mm) per Eurocode 2 Table 7.1N
    pub fn max_crack_width(&self) -> f64 {
        match self {
            ExposureClass::X0 => 0.40,
            ExposureClass::XC1 => 0.40,
            ExposureClass::XC2 | ExposureClass::XC3 | ExposureClass::XC4 => 0.30,
            ExposureClass::XD1 | ExposureClass::XD2 | ExposureClass::XD3 => 0.30,
            ExposureClass::XS1 | ExposureClass::XS2 | ExposureClass::XS3 => 0.30,
        }
    }
    
    /// Minimum cover (mm) per exposure
    pub fn min_cover(&self) -> f64 {
        match self {
            ExposureClass::X0 => 10.0,
            ExposureClass::XC1 => 15.0,
            ExposureClass::XC2 | ExposureClass::XC3 => 25.0,
            ExposureClass::XC4 => 30.0,
            ExposureClass::XD1 | ExposureClass::XD2 => 35.0,
            ExposureClass::XD3 => 40.0,
            ExposureClass::XS1 | ExposureClass::XS2 => 40.0,
            ExposureClass::XS3 => 45.0,
        }
    }
}

/// IS 456 exposure conditions
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum Is456Exposure {
    /// Mild - protected against weather
    Mild,
    /// Moderate - sheltered from severe rain
    Moderate,
    /// Severe - exposed to severe rain, coastal
    Severe,
    /// Very Severe - coastal, seawater spray
    VerySevere,
    /// Extreme - tidal zone, direct seawater
    Extreme,
}

impl Is456Exposure {
    /// Maximum crack width (mm) per IS 456 Table 14
    pub fn max_crack_width(&self) -> f64 {
        match self {
            Is456Exposure::Mild => 0.30,
            Is456Exposure::Moderate => 0.30,
            Is456Exposure::Severe | Is456Exposure::VerySevere | Is456Exposure::Extreme => 0.20,
        }
    }
    
    /// Minimum cover (mm) per IS 456 Table 16
    pub fn min_cover(&self) -> f64 {
        match self {
            Is456Exposure::Mild => 20.0,
            Is456Exposure::Moderate => 30.0,
            Is456Exposure::Severe => 45.0,
            Is456Exposure::VerySevere => 50.0,
            Is456Exposure::Extreme => 75.0,
        }
    }
}

// ============================================================================
// SECTION PROPERTIES FOR CRACK CALCULATION
// ============================================================================

/// Reinforced concrete section for crack width calculation
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CrackSection {
    /// Width (mm)
    pub b: f64,
    /// Total depth (mm)
    pub h: f64,
    /// Effective depth (mm)
    pub d: f64,
    /// Tension steel area (mm²)
    pub as_tension: f64,
    /// Compression steel area (mm²)
    pub as_compression: f64,
    /// Tension bar diameter (mm)
    pub bar_dia: f64,
    /// Bar spacing (mm)
    pub bar_spacing: f64,
    /// Clear cover (mm)
    pub cover: f64,
    /// Concrete grade fck (MPa)
    pub fck: f64,
    /// Steel yield strength (MPa)
    pub fy: f64,
    /// Concrete modulus (MPa)
    pub ec: f64,
    /// Steel modulus (MPa)
    pub es: f64,
}

impl CrackSection {
    /// Create standard rectangular section
    pub fn rectangular(b: f64, h: f64, d: f64, as_tension: f64, bar_dia: f64, fck: f64) -> Self {
        let cover = h - d - bar_dia / 2.0;
        let n_bars = (as_tension / (PI * bar_dia.powi(2) / 4.0)).round() as i32;
        let spacing = if n_bars > 1 {
            (b - 2.0 * cover) / ((n_bars - 1) as f64)
        } else {
            b - 2.0 * cover
        };
        
        Self {
            b,
            h,
            d,
            as_tension,
            as_compression: 0.0,
            bar_dia,
            bar_spacing: spacing,
            cover,
            fck,
            fy: 500.0,
            ec: 5000.0 * fck.sqrt(),
            es: 200_000.0,
        }
    }
    
    /// Modular ratio
    pub fn modular_ratio(&self) -> f64 {
        self.es / self.ec
    }
    
    /// Effective tension area Ac,eff (mm²)
    pub fn effective_tension_area(&self) -> f64 {
        let hc_ef = ((self.h - self.d) * 2.5).min(self.h / 2.0).min((self.h - self.d) + self.bar_dia);
        self.b * hc_ef
    }
    
    /// Effective reinforcement ratio ρp,eff
    pub fn effective_rho(&self) -> f64 {
        self.as_tension / self.effective_tension_area()
    }
    
    /// Neutral axis depth for cracked section (mm)
    pub fn cracked_neutral_axis(&self) -> f64 {
        let m = self.modular_ratio();
        let rho = self.as_tension / (self.b * self.d);
        
        // x = d * (-m*ρ + sqrt((m*ρ)² + 2*m*ρ))
        self.d * (-m * rho + ((m * rho).powi(2) + 2.0 * m * rho).sqrt())
    }
    
    /// Cracked moment of inertia (mm⁴)
    pub fn cracked_inertia(&self) -> f64 {
        let x = self.cracked_neutral_axis();
        let m = self.modular_ratio();
        
        self.b * x.powi(3) / 3.0 + m * self.as_tension * (self.d - x).powi(2)
    }
    
    /// Steel stress under service moment (MPa)
    pub fn steel_stress(&self, moment: f64) -> f64 {
        // moment in kN·m
        let x = self.cracked_neutral_axis();
        let i_cr = self.cracked_inertia();
        let m = self.modular_ratio();
        
        m * moment * 1e6 * (self.d - x) / i_cr
    }
}

// ============================================================================
// EUROCODE 2 CRACK WIDTH CALCULATION
// ============================================================================

/// Eurocode 2 crack width calculator
pub struct Eurocode2CrackWidth {
    pub section: CrackSection,
    pub exposure: ExposureClass,
    /// Long-term loading factor kt (0.4 for long-term, 0.6 for short-term)
    pub kt: f64,
}

impl Eurocode2CrackWidth {
    pub fn new(section: CrackSection, exposure: ExposureClass) -> Self {
        Self {
            section,
            exposure,
            kt: 0.4, // Long-term default
        }
    }
    
    /// Maximum crack spacing Sr,max (mm) - Eq. 7.11
    pub fn max_crack_spacing(&self) -> f64 {
        let c = self.section.cover;
        let phi = self.section.bar_dia;
        let rho_p_eff = self.section.effective_rho();
        
        // k1 = 0.8 for high bond bars, k2 = 0.5 for bending
        let k1 = 0.8;
        let k2 = 0.5;
        let k3 = 3.4;
        let k4 = 0.425;
        
        k3 * c + k1 * k2 * k4 * phi / rho_p_eff
    }
    
    /// Mean strain difference (εsm - εcm) - Eq. 7.9
    pub fn mean_strain_difference(&self, sigma_s: f64) -> f64 {
        let es = self.section.es;
        let fct_eff = 0.3 * self.section.fck.powf(2.0 / 3.0); // Mean tensile strength
        let rho_p_eff = self.section.effective_rho();
        let alpha_e = self.section.modular_ratio();
        
        // (εsm - εcm) = [σs - kt * fct,eff * (1 + αe * ρp,eff) / ρp,eff] / Es
        let term = self.kt * fct_eff * (1.0 + alpha_e * rho_p_eff) / rho_p_eff;
        let strain_diff = (sigma_s - term) / es;
        
        // But not less than 0.6 * σs / Es
        strain_diff.max(0.6 * sigma_s / es)
    }
    
    /// Calculate crack width wk (mm) - Eq. 7.8
    pub fn calculate_crack_width(&self, service_moment: f64) -> CrackWidthResult {
        let sigma_s = self.section.steel_stress(service_moment);
        let sr_max = self.max_crack_spacing();
        let strain_diff = self.mean_strain_difference(sigma_s);
        
        // wk = Sr,max * (εsm - εcm)
        let wk = sr_max * strain_diff;
        let wk_limit = self.exposure.max_crack_width();
        
        CrackWidthResult {
            code: "EN 1992-1-1 (Eurocode 2)".to_string(),
            steel_stress: sigma_s,
            max_crack_spacing: sr_max,
            mean_strain: strain_diff,
            crack_width: wk,
            allowable: wk_limit,
            utilization: wk / wk_limit,
            pass: wk <= wk_limit,
        }
    }
}

/// IS 456 crack width calculator
pub struct Is456CrackWidth {
    pub section: CrackSection,
    pub exposure: Is456Exposure,
}

impl Is456CrackWidth {
    pub fn new(section: CrackSection, exposure: Is456Exposure) -> Self {
        Self { section, exposure }
    }
    
    /// Apparent strain at surface (IS 456 Annex F)
    pub fn apparent_strain(&self, sigma_s: f64) -> f64 {
        let es = self.section.es;
        let epsilon_1 = sigma_s / es;
        
        // Account for stiffening effect of concrete
        let d = self.section.d;
        let x = self.section.cracked_neutral_axis();
        let _a = self.section.h - d; // Distance from steel to tension face
        
        // ε1 = steel strain at level considered
        // ε2 = strain at steel level = σs/Es
        // εm = ε1 - (b * (h - x) * (a' - x)) / (3 * Es * As * (d - x))
        
        let b = self.section.b;
        let h = self.section.h;
        let as_ = self.section.as_tension;
        
        let bt = b; // Width at tension face
        let a_prime = h - x; // Distance from NA to tension face
        
        let stiffening = bt * a_prime * (a_prime - x / 3.0) / (3.0 * es * as_ * (d - x));
        
        (epsilon_1 - stiffening).max(0.0)
    }
    
    /// Crack width calculation per IS 456 Annex F
    pub fn calculate_crack_width(&self, service_moment: f64) -> CrackWidthResult {
        let sigma_s = self.section.steel_stress(service_moment);
        let epsilon_m = self.apparent_strain(sigma_s);
        
        // acr = distance from point to nearest bar surface
        let c = self.section.cover;
        let s = self.section.bar_spacing;
        let phi = self.section.bar_dia;
        
        // For point at extreme tension fiber
        let acr = ((s / 2.0).powi(2) + (c + phi / 2.0).powi(2)).sqrt() - phi / 2.0;
        
        // Surface crack width
        // w = 3 * acr * εm / (1 + 2*(acr - cmin)/(h - x))
        let x = self.section.cracked_neutral_axis();
        let h = self.section.h;
        let cmin = c;
        
        let wk = 3.0 * acr * epsilon_m / (1.0 + 2.0 * (acr - cmin) / (h - x));
        let wk_limit = self.exposure.max_crack_width();
        
        CrackWidthResult {
            code: "IS 456:2000 Annex F".to_string(),
            steel_stress: sigma_s,
            max_crack_spacing: 2.0 * acr, // Approximate
            mean_strain: epsilon_m,
            crack_width: wk,
            allowable: wk_limit,
            utilization: wk / wk_limit,
            pass: wk <= wk_limit,
        }
    }
}

/// ACI 318 crack control (Gergely-Lutz)
pub struct Aci318CrackControl {
    pub section: CrackSection,
    /// Interior or exterior exposure
    pub exterior: bool,
}

impl Aci318CrackControl {
    pub fn new(section: CrackSection, exterior: bool) -> Self {
        Self { section, exterior }
    }
    
    /// Maximum bar spacing per ACI 318-19 Table 24.3.2
    pub fn max_bar_spacing(&self, sigma_s: f64) -> f64 {
        let cc = self.section.cover;
        let fs = sigma_s; // MPa
        
        // s ≤ 380 * (280/fs) - 2.5*cc but not > 300 * (280/fs)
        let s1 = 380.0 * (280.0 / fs) - 2.5 * cc;
        let s2 = 300.0 * (280.0 / fs);
        
        s1.min(s2)
    }
    
    /// Z-factor (Gergely-Lutz parameter)
    pub fn z_factor(&self, sigma_s: f64) -> f64 {
        let dc = self.section.cover + self.section.bar_dia / 2.0;
        let a = 2.0 * dc * self.section.bar_spacing;
        
        // z = fs * (dc * A)^(1/3)
        sigma_s * (dc * a).powf(1.0 / 3.0)
    }
    
    /// Check crack control
    pub fn check_crack_control(&self, service_moment: f64) -> CrackWidthResult {
        let sigma_s = self.section.steel_stress(service_moment);
        let max_spacing = self.max_bar_spacing(sigma_s);
        let actual_spacing = self.section.bar_spacing;
        
        // Z-factor limit
        let z = self.z_factor(sigma_s);
        let z_limit = if self.exterior { 25000.0 } else { 30000.0 }; // N/mm
        
        // Estimate crack width from Z
        let wk = z / 1e4; // Approximate mm
        let wk_limit = if self.exterior { 0.30 } else { 0.40 };
        
        let pass = actual_spacing <= max_spacing && z <= z_limit;
        
        CrackWidthResult {
            code: "ACI 318-19 §24.3".to_string(),
            steel_stress: sigma_s,
            max_crack_spacing: max_spacing,
            mean_strain: sigma_s / self.section.es,
            crack_width: wk,
            allowable: wk_limit,
            utilization: z / z_limit,
            pass,
        }
    }
}

/// Crack width calculation result
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CrackWidthResult {
    pub code: String,
    pub steel_stress: f64,
    pub max_crack_spacing: f64,
    pub mean_strain: f64,
    pub crack_width: f64,
    pub allowable: f64,
    pub utilization: f64,
    pub pass: bool,
}

// ============================================================================
// DEFLECTION CALCULATION
// ============================================================================

/// Deflection calculator for RC beams
pub struct DeflectionCalculator {
    pub section: CrackSection,
    /// Span length (mm)
    pub span: f64,
    /// Support condition factor
    pub k: f64,
}

impl DeflectionCalculator {
    pub fn simply_supported(section: CrackSection, span: f64) -> Self {
        Self { section, span, k: 5.0 / 384.0 }
    }
    
    pub fn cantilever(section: CrackSection, span: f64) -> Self {
        Self { section, span, k: 1.0 / 8.0 }
    }
    
    pub fn fixed_ends(section: CrackSection, span: f64) -> Self {
        Self { section, span, k: 1.0 / 384.0 }
    }
    
    /// Gross moment of inertia (mm⁴)
    pub fn gross_inertia(&self) -> f64 {
        self.section.b * self.section.h.powi(3) / 12.0
    }
    
    /// Cracking moment (kN·m)
    pub fn cracking_moment(&self) -> f64 {
        let fr = 0.7 * self.section.fck.sqrt(); // Modulus of rupture (MPa)
        let ig = self.gross_inertia();
        let yt = self.section.h / 2.0;
        
        fr * ig / (yt * 1e6) // kN·m
    }
    
    /// Effective moment of inertia (Branson's equation) (mm⁴)
    pub fn effective_inertia(&self, service_moment: f64) -> f64 {
        let mcr = self.cracking_moment();
        let ma = service_moment;
        let ig = self.gross_inertia();
        let icr = self.section.cracked_inertia();
        
        if ma <= mcr {
            ig
        } else {
            // Ie = (Mcr/Ma)³ * Ig + [1 - (Mcr/Ma)³] * Icr
            let ratio = mcr / ma;
            let ratio_cubed = ratio.powi(3);
            
            (ratio_cubed * ig + (1.0 - ratio_cubed) * icr).min(ig)
        }
    }
    
    /// Immediate deflection (mm)
    pub fn immediate_deflection(&self, load_per_m: f64) -> f64 {
        let m = load_per_m * self.span.powi(2) / 8.0 / 1e6; // Service moment kN·m
        let ie = self.effective_inertia(m);
        let ec = self.section.ec;
        
        // δ = k * w * L⁴ / (E * I)
        self.k * load_per_m / 1000.0 * self.span.powi(4) / (ec * ie)
    }
    
    /// Long-term deflection multiplier (ACI 318)
    pub fn long_term_factor(&self, duration_months: u32, compression_rho: f64) -> f64 {
        // λΔ = ξ / (1 + 50 * ρ')
        let xi = match duration_months {
            0..=3 => 1.0,
            4..=6 => 1.2,
            7..=12 => 1.4,
            _ => 2.0, // 5 years or more
        };
        
        xi / (1.0 + 50.0 * compression_rho)
    }
    
    /// Total long-term deflection (mm)
    pub fn total_deflection(&self, dead_load: f64, live_load: f64, duration_months: u32) -> DeflectionResult {
        let rho_prime = self.section.as_compression / (self.section.b * self.section.d);
        let lambda = self.long_term_factor(duration_months, rho_prime);
        
        let delta_d = self.immediate_deflection(dead_load);
        let delta_l = self.immediate_deflection(live_load);
        
        // Total = λ * δD + δL (sustained) + δL (transient)
        let sustained_live = 0.3 * live_load; // 30% sustained
        let delta_l_sustained = self.immediate_deflection(sustained_live);
        let delta_l_transient = delta_l - delta_l_sustained;
        
        let total = lambda * delta_d + lambda * delta_l_sustained + delta_l_transient;
        
        // Allowable: L/240 for floors, L/480 for roofs
        let allowable = self.span / 240.0;
        
        DeflectionResult {
            immediate_dead: delta_d,
            immediate_live: delta_l,
            long_term_factor: lambda,
            total_deflection: total,
            allowable,
            span_ratio: self.span / total,
            utilization: total / allowable,
            pass: total <= allowable,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DeflectionResult {
    pub immediate_dead: f64,
    pub immediate_live: f64,
    pub long_term_factor: f64,
    pub total_deflection: f64,
    pub allowable: f64,
    pub span_ratio: f64,
    pub utilization: f64,
    pub pass: bool,
}

// ============================================================================
// SPAN/DEPTH RATIO CHECK (SIMPLIFIED DEFLECTION)
// ============================================================================

/// Span/depth ratio limits
pub struct SpanDepthRatio;

impl SpanDepthRatio {
    /// Basic span/effective depth ratio (Eurocode 2 Table 7.4N)
    pub fn ec2_basic_ratio(rho: f64, fck: f64) -> f64 {
        let rho_0 = (fck.sqrt() / 1000.0).max(0.001);
        
        if rho <= rho_0 {
            // Lightly reinforced
            11.0 + 1.5 * fck.sqrt() * rho_0 / rho + 3.2 * fck.sqrt() * ((rho_0 / rho) - 1.0).powf(1.5)
        } else {
            // Normally reinforced
            11.0 + 1.5 * fck.sqrt() * rho_0 / (rho - rho_0) + (1.0 / 12.0) * fck.sqrt() * (rho_0 / rho).sqrt()
        }
    }
    
    /// Modification factor for span type
    pub fn span_factor(support_type: &str) -> f64 {
        match support_type {
            "cantilever" => 0.4,
            "simply_supported" => 1.0,
            "continuous_end" => 1.3,
            "continuous_interior" => 1.5,
            _ => 1.0,
        }
    }
    
    /// IS 456 basic span/depth ratios
    pub fn is456_basic_ratio(support_type: &str, tension_rho: f64, _fck: f64) -> f64 {
        let basic = match support_type {
            "cantilever" => 7.0,
            "simply_supported" => 20.0,
            "continuous" => 26.0,
            _ => 20.0,
        };
        
        // Modification factor for steel stress (IS 456 Fig. 4)
        let fs = 0.58 * 500.0 * tension_rho.min(0.04) / 0.01; // Approximate
        let mf = (1.4 - fs / 1500.0).max(0.8).min(2.0);
        
        basic * mf
    }
    
    /// Check span/depth ratio
    pub fn check(
        span: f64,
        d: f64,
        rho: f64,
        fck: f64,
        support_type: &str,
        code: &str,
    ) -> SpanDepthResult {
        let actual = span / d;
        
        let allowable = match code {
            "EC2" => Self::ec2_basic_ratio(rho, fck) * Self::span_factor(support_type),
            "IS456" => Self::is456_basic_ratio(support_type, rho, fck),
            _ => 20.0,
        };
        
        SpanDepthResult {
            actual_ratio: actual,
            allowable_ratio: allowable,
            utilization: actual / allowable,
            pass: actual <= allowable,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SpanDepthResult {
    pub actual_ratio: f64,
    pub allowable_ratio: f64,
    pub utilization: f64,
    pub pass: bool,
}

// ============================================================================
// COMPREHENSIVE SERVICEABILITY CHECK
// ============================================================================

/// Full serviceability assessment
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ServiceabilityCheck {
    pub section: CrackSection,
    pub span: f64,
    pub service_moment: f64,
    pub dead_load: f64,
    pub live_load: f64,
    pub code: String,
}

impl ServiceabilityCheck {
    pub fn new(section: CrackSection, span: f64, service_moment: f64) -> Self {
        Self {
            section,
            span,
            service_moment,
            dead_load: 10.0,
            live_load: 5.0,
            code: "EC2".to_string(),
        }
    }
    
    /// Full serviceability assessment
    pub fn full_check(&self) -> ServiceabilityResult {
        // Crack width (EC2)
        let crack_calc = Eurocode2CrackWidth::new(
            self.section.clone(),
            ExposureClass::XC3,
        );
        let crack = crack_calc.calculate_crack_width(self.service_moment);
        
        // Deflection
        let defl_calc = DeflectionCalculator::simply_supported(
            self.section.clone(),
            self.span,
        );
        let deflection = defl_calc.total_deflection(self.dead_load, self.live_load, 60);
        
        // Span/depth
        let rho = self.section.as_tension / (self.section.b * self.section.d);
        let span_depth = SpanDepthRatio::check(
            self.span,
            self.section.d,
            rho,
            self.section.fck,
            "simply_supported",
            "EC2",
        );
        
        // Overall pass
        let pass = crack.pass && deflection.pass && span_depth.pass;
        
        ServiceabilityResult {
            crack_width: crack,
            deflection,
            span_depth: span_depth,
            overall_pass: pass,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ServiceabilityResult {
    pub crack_width: CrackWidthResult,
    pub deflection: DeflectionResult,
    pub span_depth: SpanDepthResult,
    pub overall_pass: bool,
}

// ============================================================================
// TESTS
// ============================================================================

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_exposure_crack_width() {
        assert!((ExposureClass::X0.max_crack_width() - 0.4).abs() < 0.01);
        assert!((ExposureClass::XC3.max_crack_width() - 0.3).abs() < 0.01);
    }

    #[test]
    fn test_exposure_cover() {
        assert!((ExposureClass::XC1.min_cover() - 15.0).abs() < 1.0);
        assert!((ExposureClass::XS3.min_cover() - 45.0).abs() < 1.0);
    }

    #[test]
    fn test_is456_exposure() {
        assert!((Is456Exposure::Mild.max_crack_width() - 0.3).abs() < 0.01);
        assert!((Is456Exposure::Severe.max_crack_width() - 0.2).abs() < 0.01);
    }

    #[test]
    fn test_crack_section() {
        let section = CrackSection::rectangular(300.0, 500.0, 450.0, 1500.0, 16.0, 30.0);
        
        assert!(section.modular_ratio() > 5.0 && section.modular_ratio() < 10.0);
    }

    #[test]
    fn test_neutral_axis() {
        let section = CrackSection::rectangular(300.0, 500.0, 450.0, 1500.0, 16.0, 30.0);
        let x = section.cracked_neutral_axis();
        
        // Should be in upper portion of section
        assert!(x > 50.0 && x < 250.0);
    }

    #[test]
    fn test_cracked_inertia() {
        let section = CrackSection::rectangular(300.0, 500.0, 450.0, 1500.0, 16.0, 30.0);
        let icr = section.cracked_inertia();
        
        // Should be positive
        assert!(icr > 0.0);
    }

    #[test]
    fn test_steel_stress() {
        let section = CrackSection::rectangular(300.0, 500.0, 450.0, 1500.0, 16.0, 30.0);
        let sigma = section.steel_stress(100.0); // 100 kN·m
        
        // Should be reasonable steel stress
        assert!(sigma > 0.0 && sigma < 500.0);
    }

    #[test]
    fn test_ec2_crack_spacing() {
        let section = CrackSection::rectangular(300.0, 500.0, 450.0, 1500.0, 16.0, 30.0);
        let calc = Eurocode2CrackWidth::new(section, ExposureClass::XC3);
        
        let sr = calc.max_crack_spacing();
        assert!(sr > 100.0 && sr < 500.0);
    }

    #[test]
    fn test_ec2_crack_width() {
        let section = CrackSection::rectangular(300.0, 500.0, 450.0, 1500.0, 16.0, 30.0);
        let calc = Eurocode2CrackWidth::new(section, ExposureClass::XC3);
        
        let result = calc.calculate_crack_width(80.0);
        
        assert!(result.crack_width > 0.0);
        assert!(result.crack_width < 1.0);
    }

    #[test]
    fn test_is456_crack_width() {
        let section = CrackSection::rectangular(300.0, 500.0, 450.0, 1500.0, 16.0, 30.0);
        let calc = Is456CrackWidth::new(section, Is456Exposure::Moderate);
        
        let result = calc.calculate_crack_width(80.0);
        
        assert!(result.crack_width > 0.0);
    }

    #[test]
    fn test_aci_crack_control() {
        let section = CrackSection::rectangular(300.0, 500.0, 450.0, 1500.0, 16.0, 30.0);
        let calc = Aci318CrackControl::new(section, false);
        
        let result = calc.check_crack_control(80.0);
        
        assert!(result.steel_stress > 0.0);
    }

    #[test]
    fn test_cracking_moment() {
        let section = CrackSection::rectangular(300.0, 500.0, 450.0, 1500.0, 16.0, 30.0);
        let calc = DeflectionCalculator::simply_supported(section, 6000.0);
        
        let mcr = calc.cracking_moment();
        assert!(mcr > 0.0 && mcr < 100.0);
    }

    #[test]
    fn test_effective_inertia() {
        let section = CrackSection::rectangular(300.0, 500.0, 450.0, 1500.0, 16.0, 30.0);
        let calc = DeflectionCalculator::simply_supported(section, 6000.0);
        
        let ig = calc.gross_inertia();
        let ie = calc.effective_inertia(80.0);
        
        // Effective should be less than gross for cracked section
        assert!(ie <= ig);
        assert!(ie > 0.0);
    }

    #[test]
    fn test_immediate_deflection() {
        let section = CrackSection::rectangular(300.0, 500.0, 450.0, 1500.0, 16.0, 30.0);
        let calc = DeflectionCalculator::simply_supported(section, 6000.0);
        
        let delta = calc.immediate_deflection(15.0); // 15 kN/m
        
        assert!(delta > 0.0 && delta < 100.0);
    }

    #[test]
    fn test_long_term_factor() {
        let section = CrackSection::rectangular(300.0, 500.0, 450.0, 1500.0, 16.0, 30.0);
        let calc = DeflectionCalculator::simply_supported(section, 6000.0);
        
        let lambda = calc.long_term_factor(60, 0.005);
        
        assert!(lambda > 1.0 && lambda < 3.0);
    }

    #[test]
    fn test_total_deflection() {
        let section = CrackSection::rectangular(300.0, 500.0, 450.0, 1500.0, 16.0, 30.0);
        let calc = DeflectionCalculator::simply_supported(section, 6000.0);
        
        let result = calc.total_deflection(10.0, 5.0, 60);
        
        assert!(result.total_deflection > 0.0);
        assert!(result.span_ratio > 0.0);
    }

    #[test]
    fn test_span_depth_ec2() {
        let result = SpanDepthRatio::check(6000.0, 450.0, 0.01, 30.0, "simply_supported", "EC2");
        
        assert!(result.actual_ratio > 10.0);
        assert!(result.allowable_ratio > 15.0);
    }

    #[test]
    fn test_span_depth_is456() {
        let result = SpanDepthRatio::check(6000.0, 450.0, 0.01, 30.0, "simply_supported", "IS456");
        
        assert!(result.actual_ratio > 10.0);
    }

    #[test]
    fn test_full_serviceability() {
        let section = CrackSection::rectangular(300.0, 500.0, 450.0, 1500.0, 16.0, 30.0);
        let check = ServiceabilityCheck::new(section, 6000.0, 80.0);
        
        let result = check.full_check();
        
        assert!(result.crack_width.crack_width > 0.0);
        assert!(result.deflection.total_deflection > 0.0);
    }

    #[test]
    fn test_effective_tension_area() {
        let section = CrackSection::rectangular(300.0, 500.0, 450.0, 1500.0, 16.0, 30.0);
        let ac_eff = section.effective_tension_area();
        
        assert!(ac_eff > 0.0);
    }

    #[test]
    fn test_effective_rho() {
        let section = CrackSection::rectangular(300.0, 500.0, 450.0, 1500.0, 16.0, 30.0);
        let rho = section.effective_rho();
        
        assert!(rho > 0.0 && rho < 0.1);
    }
}
