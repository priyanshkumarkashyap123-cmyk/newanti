//! # Geotechnical Engineering Module (Rust)
//! 
//! High-performance geotechnical calculations including:
//! - Bearing capacity (Terzaghi, Meyerhof, Hansen, Vesic)
//! - Settlement analysis (immediate, consolidation, secondary)
//! - Earth pressure (Rankine, Coulomb)
//! - Slope stability (infinite slope, Bishop, Fellenius)
//! - Pile foundation design

use serde::{Deserialize, Serialize};
use std::f64::consts::PI;

// ============================================================================
// SOIL PROPERTIES
// ============================================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SoilProperties {
    /// Soil classification (USCS)
    pub classification: String,
    /// Unit weight (kN/m³)
    pub gamma: f64,
    /// Saturated unit weight (kN/m³)
    pub gamma_sat: f64,
    /// Cohesion (kPa)
    pub c: f64,
    /// Effective cohesion (kPa)
    pub c_prime: f64,
    /// Friction angle (degrees)
    pub phi: f64,
    /// Effective friction angle (degrees)
    pub phi_prime: f64,
    /// Compression index
    pub cc: f64,
    /// Recompression index
    pub cr: f64,
    /// Initial void ratio
    pub e0: f64,
    /// Coefficient of volume compressibility (m²/kN)
    pub mv: f64,
    /// Coefficient of consolidation (m²/year)
    pub cv: f64,
    /// SPT N value
    pub n_spt: Option<u32>,
    /// Undrained shear strength (kPa)
    pub su: Option<f64>,
}

impl Default for SoilProperties {
    fn default() -> Self {
        SoilProperties {
            classification: "Unknown".to_string(),
            gamma: 18.0,
            gamma_sat: 20.0,
            c: 0.0,
            c_prime: 0.0,
            phi: 30.0,
            phi_prime: 30.0,
            cc: 0.3,
            cr: 0.05,
            e0: 0.8,
            mv: 0.0003,
            cv: 3.0,
            n_spt: None,
            su: None,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SoilLayer {
    pub soil: SoilProperties,
    /// Thickness of layer (m)
    pub thickness: f64,
    /// Depth to top of layer (m)
    pub depth_top: f64,
}

// ============================================================================
// BEARING CAPACITY
// ============================================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FoundationInput {
    /// Foundation width (m)
    pub b: f64,
    /// Foundation length (m)
    pub l: f64,
    /// Depth of foundation (m)
    pub df: f64,
    /// Foundation shape
    pub shape: FoundationShape,
    /// Load inclination angle (degrees)
    pub inclination: f64,
    /// Ground slope (degrees)
    pub ground_slope: f64,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq)]
pub enum FoundationShape {
    Strip,
    Square,
    Rectangular,
    Circular,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BearingCapacityResult {
    pub method: String,
    /// Ultimate bearing capacity (kPa)
    pub qu: f64,
    /// Net ultimate bearing capacity (kPa)
    pub qu_net: f64,
    /// Allowable bearing capacity with FOS (kPa)
    pub qa: f64,
    /// Bearing capacity factors
    pub nc: f64,
    pub nq: f64,
    pub n_gamma: f64,
    /// Shape factors
    pub sc: f64,
    pub sq: f64,
    pub s_gamma: f64,
    /// Depth factors
    pub dc: f64,
    pub dq: f64,
    pub d_gamma: f64,
    /// Inclination factors
    pub ic: f64,
    pub iq: f64,
    pub i_gamma: f64,
}

/// Bearing capacity calculator
pub struct BearingCapacity;

impl BearingCapacity {
    /// Calculate bearing capacity using Terzaghi's method
    pub fn terzaghi(foundation: &FoundationInput, soil: &SoilProperties, fos: f64) -> BearingCapacityResult {
        let phi_rad = soil.phi.to_radians();
        
        // Terzaghi bearing capacity factors
        let nq = (PI * (0.75 - soil.phi / 360.0)).tan().powi(2) 
            * (PI * phi_rad.tan()).exp();
        let nc = (nq - 1.0) / phi_rad.tan();
        let n_gamma = (nq - 1.0) * (1.4 * phi_rad).tan();
        
        // Shape factors (Terzaghi)
        let (sc, sq, s_gamma) = match foundation.shape {
            FoundationShape::Strip => (1.0, 1.0, 1.0),
            FoundationShape::Square => (1.3, 1.0, 0.8),
            FoundationShape::Circular => (1.3, 1.0, 0.6),
            FoundationShape::Rectangular => {
                let b_l = foundation.b / foundation.l;
                (1.0 + 0.3 * b_l, 1.0, 1.0 - 0.2 * b_l)
            }
        };
        
        let gamma = soil.gamma;
        let c = soil.c;
        let b = foundation.b;
        let df = foundation.df;
        
        // Surcharge
        let q = gamma * df;
        
        // Ultimate bearing capacity
        let qu = c * nc * sc + q * nq * sq + 0.5 * gamma * b * n_gamma * s_gamma;
        let qu_net = qu - q;
        let qa = qu_net / fos + q;
        
        BearingCapacityResult {
            method: "Terzaghi".to_string(),
            qu, qu_net, qa,
            nc, nq, n_gamma,
            sc, sq, s_gamma,
            dc: 1.0, dq: 1.0, d_gamma: 1.0,
            ic: 1.0, iq: 1.0, i_gamma: 1.0,
        }
    }
    
    /// Calculate bearing capacity using Meyerhof's method
    pub fn meyerhof(foundation: &FoundationInput, soil: &SoilProperties, fos: f64) -> BearingCapacityResult {
        let phi_rad = soil.phi.to_radians();
        
        // Meyerhof bearing capacity factors
        let nq = (PI * phi_rad.tan()).exp() * ((45.0 + soil.phi / 2.0).to_radians().tan().powi(2));
        let nc = (nq - 1.0) / phi_rad.tan();
        let n_gamma = (nq - 1.0) * (1.4 * phi_rad).tan();
        
        let b = foundation.b;
        let l = foundation.l;
        let df = foundation.df;
        let phi = soil.phi;
        
        // Shape factors
        let kp = (45.0 + phi / 2.0).to_radians().tan().powi(2);
        let (sc, sq, s_gamma) = match foundation.shape {
            FoundationShape::Strip => (1.0, 1.0, 1.0),
            _ => {
                let b_l = b / l;
                (1.0 + 0.2 * kp * b_l, 1.0 + 0.1 * kp * b_l, 1.0 + 0.1 * kp * b_l)
            }
        };
        
        // Depth factors
        let (dc, dq, d_gamma) = if df / b <= 1.0 {
            (1.0 + 0.2 * kp.sqrt() * df / b,
             1.0 + 0.1 * kp.sqrt() * df / b,
             1.0 + 0.1 * kp.sqrt() * df / b)
        } else {
            (1.0 + 0.2 * kp.sqrt() * (df / b).atan(),
             1.0 + 0.1 * kp.sqrt() * (df / b).atan(),
             1.0 + 0.1 * kp.sqrt() * (df / b).atan())
        };
        
        // Inclination factors
        let alpha = foundation.inclination.to_radians();
        let ic = (1.0 - alpha / (PI / 2.0)).powi(2);
        let iq = ic;
        let i_gamma = (1.0 - alpha / phi_rad).powi(2);
        
        let gamma = soil.gamma;
        let c = soil.c;
        let q = gamma * df;
        
        let qu = c * nc * sc * dc * ic + q * nq * sq * dq * iq + 0.5 * gamma * b * n_gamma * s_gamma * d_gamma * i_gamma;
        let qu_net = qu - q;
        let qa = qu_net / fos + q;
        
        BearingCapacityResult {
            method: "Meyerhof".to_string(),
            qu, qu_net, qa,
            nc, nq, n_gamma,
            sc, sq, s_gamma,
            dc, dq, d_gamma,
            ic, iq, i_gamma,
        }
    }
    
    /// Calculate bearing capacity using Hansen's method
    pub fn hansen(foundation: &FoundationInput, soil: &SoilProperties, fos: f64) -> BearingCapacityResult {
        let phi_rad = soil.phi.to_radians();
        
        // Hansen bearing capacity factors
        let nq = (PI * phi_rad.tan()).exp() * ((45.0 + soil.phi / 2.0).to_radians().tan().powi(2));
        let nc = if soil.phi > 0.0 { (nq - 1.0) / phi_rad.tan() } else { 5.14 };
        let n_gamma = 1.5 * (nq - 1.0) * phi_rad.tan();
        
        let b = foundation.b;
        let l = foundation.l;
        let df = foundation.df;
        
        // Shape factors
        let (sc, sq, s_gamma) = match foundation.shape {
            FoundationShape::Strip => (1.0, 1.0, 1.0),
            _ => {
                let b_l = b / l;
                (1.0 + (nq / nc) * b_l,
                 1.0 + b_l * phi_rad.tan(),
                 1.0 - 0.4 * b_l)
            }
        };
        
        // Depth factors
        let k = if df / b <= 1.0 { df / b } else { (df / b).atan() };
        let dc = 1.0 + 0.4 * k;
        let dq = 1.0 + 2.0 * phi_rad.tan() * (1.0 - phi_rad.sin()).powi(2) * k;
        let d_gamma = 1.0;
        
        // Inclination factors
        let alpha = foundation.inclination.to_radians();
        let ic = 1.0 - alpha / (PI / 2.0);
        let iq = 1.0 - 0.5 * alpha / phi_rad;
        let i_gamma = (1.0 - 0.7 * alpha / phi_rad).max(0.0);
        
        let gamma = soil.gamma;
        let c = soil.c;
        let q = gamma * df;
        
        let qu = c * nc * sc * dc * ic + q * nq * sq * dq * iq + 0.5 * gamma * b * n_gamma * s_gamma * d_gamma * i_gamma;
        let qu_net = qu - q;
        let qa = qu_net / fos + q;
        
        BearingCapacityResult {
            method: "Hansen".to_string(),
            qu, qu_net, qa,
            nc, nq, n_gamma,
            sc, sq, s_gamma,
            dc, dq, d_gamma,
            ic, iq, i_gamma,
        }
    }
    
    /// Calculate bearing capacity using Vesic's method
    pub fn vesic(foundation: &FoundationInput, soil: &SoilProperties, fos: f64) -> BearingCapacityResult {
        let phi_rad = soil.phi.to_radians();
        
        // Vesic bearing capacity factors
        let nq = (PI * phi_rad.tan()).exp() * ((45.0 + soil.phi / 2.0).to_radians().tan().powi(2));
        let nc = if soil.phi > 0.0 { (nq - 1.0) / phi_rad.tan() } else { 5.14 };
        let n_gamma = 2.0 * (nq + 1.0) * phi_rad.tan();
        
        let b = foundation.b;
        let l = foundation.l;
        let df = foundation.df;
        
        // Shape factors (same as Hansen)
        let (sc, sq, s_gamma) = match foundation.shape {
            FoundationShape::Strip => (1.0, 1.0, 1.0),
            _ => {
                let b_l = b / l;
                (1.0 + (nq / nc) * b_l,
                 1.0 + b_l * phi_rad.tan(),
                 1.0 - 0.4 * b_l)
            }
        };
        
        // Depth factors
        let k = if df / b <= 1.0 { df / b } else { (df / b).atan() };
        let dc = 1.0 + 0.4 * k;
        let dq = 1.0 + 2.0 * phi_rad.tan() * (1.0 - phi_rad.sin()).powi(2) * k;
        let d_gamma = 1.0;
        
        // Inclination factors (Vesic uses more complex formulas)
        let ic = 1.0;
        let iq = 1.0;
        let i_gamma = 1.0;
        
        let gamma = soil.gamma;
        let c = soil.c;
        let q = gamma * df;
        
        let qu = c * nc * sc * dc * ic + q * nq * sq * dq * iq + 0.5 * gamma * b * n_gamma * s_gamma * d_gamma * i_gamma;
        let qu_net = qu - q;
        let qa = qu_net / fos + q;
        
        BearingCapacityResult {
            method: "Vesic".to_string(),
            qu, qu_net, qa,
            nc, nq, n_gamma,
            sc, sq, s_gamma,
            dc, dq, d_gamma,
            ic, iq, i_gamma,
        }
    }
}

// ============================================================================
// SETTLEMENT ANALYSIS
// ============================================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SettlementInput {
    /// Applied stress (kPa)
    pub delta_sigma: f64,
    /// Foundation width (m)
    pub b: f64,
    /// Foundation length (m)
    pub l: f64,
    /// Elastic modulus of soil (kPa)
    pub es: f64,
    /// Poisson's ratio
    pub nu: f64,
    /// Influence factor
    pub influence_factor: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SettlementResult {
    /// Immediate settlement (m)
    pub immediate: f64,
    /// Primary consolidation settlement (m)
    pub consolidation: f64,
    /// Secondary compression settlement (m)
    pub secondary: f64,
    /// Total settlement (m)
    pub total: f64,
    /// Time for 90% consolidation (years)
    pub t90: f64,
}

/// Settlement calculator
pub struct Settlement;

impl Settlement {
    /// Calculate immediate (elastic) settlement
    pub fn immediate(input: &SettlementInput) -> f64 {
        let q = input.delta_sigma;
        let b = input.b;
        let es = input.es;
        let nu = input.nu;
        let ip = input.influence_factor; // Typically 0.5-0.95 based on foundation type
        
        // Elastic settlement formula
        q * b * (1.0 - nu * nu) * ip / es
    }
    
    /// Calculate consolidation settlement for a single layer
    pub fn consolidation_single_layer(
        layer: &SoilLayer,
        sigma_0: f64,      // Initial effective stress at mid-layer
        delta_sigma: f64,  // Stress increase
        is_oc: bool,       // Is overconsolidated
        sigma_c: f64,      // Preconsolidation pressure (if OC)
    ) -> f64 {
        let h = layer.thickness;
        let e0 = layer.soil.e0;
        let cc = layer.soil.cc;
        let cr = layer.soil.cr;
        
        if is_oc && sigma_0 + delta_sigma <= sigma_c {
            // Entirely in recompression range
            cr * h / (1.0 + e0) * ((sigma_0 + delta_sigma) / sigma_0).log10()
        } else if is_oc {
            // Partially in compression range
            let s_recomp = cr * h / (1.0 + e0) * (sigma_c / sigma_0).log10();
            let s_virgin = cc * h / (1.0 + e0) * ((sigma_0 + delta_sigma) / sigma_c).log10();
            s_recomp + s_virgin
        } else {
            // Normally consolidated
            cc * h / (1.0 + e0) * ((sigma_0 + delta_sigma) / sigma_0).log10()
        }
    }
    
    /// Calculate consolidation settlement for multiple layers
    pub fn consolidation_multilayer(
        layers: &[SoilLayer],
        stress_profile: &[(f64, f64)], // (sigma_0, delta_sigma) for each layer
    ) -> f64 {
        let mut total = 0.0;
        
        for (i, layer) in layers.iter().enumerate() {
            if i < stress_profile.len() {
                let (sigma_0, delta_sigma) = stress_profile[i];
                total += Self::consolidation_single_layer(layer, sigma_0, delta_sigma, false, 0.0);
            }
        }
        
        total
    }
    
    /// Calculate time for given degree of consolidation
    pub fn time_for_consolidation(
        layer_thickness: f64,
        cv: f64,           // Coefficient of consolidation (m²/year)
        drainage: Drainage,
        degree: f64,       // 0.0 to 1.0
    ) -> f64 {
        let h_dr = match drainage {
            Drainage::SingleDrainage => layer_thickness,
            Drainage::DoubleDrainage => layer_thickness / 2.0,
        };
        
        // Time factor for given degree of consolidation
        let tv = if degree <= 0.6 {
            PI * degree * degree / 4.0
        } else {
            -0.933 * (1.0 - degree).ln() - 0.085
        };
        
        tv * h_dr * h_dr / cv
    }
    
    /// Calculate secondary compression settlement
    pub fn secondary_compression(
        c_alpha: f64,      // Secondary compression index
        h: f64,            // Layer thickness
        e0: f64,           // Initial void ratio
        t1: f64,           // End of primary consolidation (years)
        t2: f64,           // Time of interest (years)
    ) -> f64 {
        if t2 <= t1 || t1 <= 0.0 {
            return 0.0;
        }
        c_alpha * h / (1.0 + e0) * (t2 / t1).log10()
    }
    
    /// Complete settlement analysis
    pub fn analyze(
        foundation: &FoundationInput,
        layers: &[SoilLayer],
        applied_stress: f64,
        time_years: f64,
    ) -> SettlementResult {
        // Calculate stress distribution (Boussinesq)
        let mut stress_profile = Vec::new();
        let mut depth = foundation.df;
        
        for layer in layers {
            let z = depth + layer.thickness / 2.0;
            let sigma_0 = layer.soil.gamma * z;
            
            // Stress influence factor (approximate)
            let m = foundation.l / foundation.b;
            let n = z / (foundation.b / 2.0);
            let influence = 0.5 * (1.0 / (1.0 + n * n).sqrt()); // Simplified
            
            let delta_sigma = applied_stress * influence;
            stress_profile.push((sigma_0, delta_sigma));
            depth += layer.thickness;
        }
        
        // Calculate settlements
        let immediate = if !layers.is_empty() {
            let input = SettlementInput {
                delta_sigma: applied_stress,
                b: foundation.b,
                l: foundation.l,
                es: 5000.0 * layers[0].soil.su.unwrap_or(50.0), // Approximate
                nu: 0.3,
                influence_factor: 0.85,
            };
            Self::immediate(&input)
        } else {
            0.0
        };
        
        let consolidation = Self::consolidation_multilayer(layers, &stress_profile);
        
        // T90 calculation
        let t90 = if !layers.is_empty() {
            let cv = layers[0].soil.cv;
            let h = layers.iter().map(|l| l.thickness).sum::<f64>();
            Self::time_for_consolidation(h, cv, Drainage::DoubleDrainage, 0.9)
        } else {
            1.0
        };
        
        let secondary = if !layers.is_empty() && time_years > t90 {
            let c_alpha = layers[0].soil.cc * 0.04; // Approximate
            let h = layers.iter().map(|l| l.thickness).sum::<f64>();
            Self::secondary_compression(c_alpha, h, layers[0].soil.e0, t90, time_years)
        } else {
            0.0
        };
        
        SettlementResult {
            immediate,
            consolidation,
            secondary,
            total: immediate + consolidation + secondary,
            t90,
        }
    }
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
pub enum Drainage {
    SingleDrainage,
    DoubleDrainage,
}

// ============================================================================
// EARTH PRESSURE
// ============================================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EarthPressureResult {
    /// Active earth pressure coefficient
    pub ka: f64,
    /// Passive earth pressure coefficient
    pub kp: f64,
    /// At-rest earth pressure coefficient
    pub k0: f64,
    /// Active pressure at depth h (kPa)
    pub pa: f64,
    /// Passive pressure at depth h (kPa)
    pub pp: f64,
    /// Total active force (kN/m)
    pub total_active: f64,
    /// Total passive force (kN/m)
    pub total_passive: f64,
    /// Point of application (m from base)
    pub application_point: f64,
}

/// Earth pressure calculator
pub struct EarthPressure;

impl EarthPressure {
    /// Rankine earth pressure theory
    pub fn rankine(
        soil: &SoilProperties,
        wall_height: f64,
        water_table_depth: Option<f64>,
        surcharge: f64,
    ) -> EarthPressureResult {
        let phi_rad = soil.phi.to_radians();
        
        // Rankine coefficients
        let ka = (45.0 - soil.phi / 2.0).to_radians().tan().powi(2);
        let kp = (45.0 + soil.phi / 2.0).to_radians().tan().powi(2);
        let k0 = 1.0 - phi_rad.sin(); // Jaky's formula
        
        let gamma = soil.gamma;
        let c = soil.c;
        let h = wall_height;
        
        // Active pressure at base
        let pa = ka * gamma * h + 2.0 * c * ka.sqrt() + ka * surcharge;
        
        // Passive pressure at base
        let pp = kp * gamma * h + 2.0 * c * kp.sqrt();
        
        // Total forces (triangular distribution)
        let total_active = 0.5 * ka * gamma * h * h + ka * surcharge * h;
        let total_passive = 0.5 * kp * gamma * h * h;
        
        // Point of application
        let application_point = h / 3.0;
        
        EarthPressureResult {
            ka, kp, k0, pa, pp,
            total_active, total_passive,
            application_point,
        }
    }
    
    /// Coulomb earth pressure theory
    pub fn coulomb(
        soil: &SoilProperties,
        wall_height: f64,
        wall_friction: f64,    // delta (degrees)
        wall_inclination: f64, // alpha from vertical (degrees)
        backfill_slope: f64,   // beta (degrees)
    ) -> EarthPressureResult {
        let phi = soil.phi.to_radians();
        let delta = wall_friction.to_radians();
        let alpha = wall_inclination.to_radians();
        let beta = backfill_slope.to_radians();
        
        // Coulomb active coefficient
        let num = (phi + alpha).cos().powi(2);
        let denom1 = alpha.cos().powi(2) * (alpha - delta).cos();
        let inner = ((phi + delta).sin() * (phi - beta).sin() 
                    / ((alpha - delta).cos() * (alpha + beta).cos())).sqrt();
        let denom2 = (1.0 + inner).powi(2);
        let ka = num / (denom1 * denom2);
        
        // Coulomb passive coefficient
        let num_p = (phi - alpha).cos().powi(2);
        let denom1_p = alpha.cos().powi(2) * (alpha + delta).cos();
        let inner_p = ((phi + delta).sin() * (phi + beta).sin()
                      / ((alpha + delta).cos() * (alpha + beta).cos())).sqrt();
        let denom2_p = (1.0 - inner_p).powi(2);
        let kp = num_p / (denom1_p * denom2_p);
        
        let k0 = 1.0 - phi.sin();
        
        let gamma = soil.gamma;
        let h = wall_height;
        
        let pa = ka * gamma * h;
        let pp = kp * gamma * h;
        
        let total_active = 0.5 * ka * gamma * h * h;
        let total_passive = 0.5 * kp * gamma * h * h;
        
        EarthPressureResult {
            ka, kp, k0, pa, pp,
            total_active, total_passive,
            application_point: h / 3.0,
        }
    }
}

// ============================================================================
// SLOPE STABILITY
// ============================================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SlopeInput {
    /// Slope height (m)
    pub height: f64,
    /// Slope angle (degrees)
    pub slope_angle: f64,
    /// Water table depth from crest (m)
    pub water_table: Option<f64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SlopeStabilityResult {
    pub method: String,
    /// Factor of safety
    pub fos: f64,
    /// Critical slip surface parameters
    pub critical_surface: Option<CriticalSurface>,
    /// Is stable (FOS > 1.5 typically)
    pub is_stable: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CriticalSurface {
    pub center_x: f64,
    pub center_y: f64,
    pub radius: f64,
}

/// Slope stability calculator
pub struct SlopeStability;

impl SlopeStability {
    /// Infinite slope analysis (for shallow failures)
    pub fn infinite_slope(
        soil: &SoilProperties,
        slope_angle: f64,
        depth: f64,
        is_submerged: bool,
    ) -> SlopeStabilityResult {
        let beta = slope_angle.to_radians();
        let phi = soil.phi.to_radians();
        let c = soil.c;
        let gamma = if is_submerged { soil.gamma_sat - 9.81 } else { soil.gamma };
        
        // Factor of safety
        let fos = if c > 0.0 {
            c / (gamma * depth * beta.cos().powi(2) * beta.tan()) 
                + phi.tan() / beta.tan()
        } else {
            phi.tan() / beta.tan()
        };
        
        SlopeStabilityResult {
            method: "Infinite Slope".to_string(),
            fos,
            critical_surface: None,
            is_stable: fos >= 1.5,
        }
    }
    
    /// Culmann method (planar failure surface)
    pub fn culmann(
        soil: &SoilProperties,
        slope: &SlopeInput,
    ) -> SlopeStabilityResult {
        let beta = slope.slope_angle.to_radians();
        let phi = soil.phi.to_radians();
        let c = soil.c;
        let gamma = soil.gamma;
        let h = slope.height;
        
        // Critical height for cohesive soil
        let hc = 4.0 * c * beta.cos() * phi.cos() 
            / (gamma * (1.0 - (phi - beta).cos()));
        
        // Factor of safety
        let fos = hc / h;
        
        SlopeStabilityResult {
            method: "Culmann".to_string(),
            fos,
            critical_surface: None,
            is_stable: fos >= 1.5,
        }
    }
    
    /// Fellenius (Swedish) method of slices
    pub fn fellenius(
        soil: &SoilProperties,
        slope: &SlopeInput,
        n_slices: usize,
    ) -> SlopeStabilityResult {
        let beta = slope.slope_angle.to_radians();
        let h = slope.height;
        let phi = soil.phi.to_radians();
        let c = soil.c;
        let gamma = soil.gamma;
        
        // Estimate critical circle
        let r = h / beta.sin(); // Approximate radius
        let xc = h / (2.0 * beta.tan());
        let yc = r;
        
        // Simplified analysis with assumed failure surface
        let l = PI * r * beta / PI; // Arc length
        let slice_width = h / (n_slices as f64) / beta.tan();
        
        let mut sum_resisting = 0.0;
        let mut sum_driving = 0.0;
        
        for i in 0..n_slices {
            let x = (i as f64 + 0.5) * slice_width;
            let slice_height = h - x * beta.tan();
            
            if slice_height > 0.0 {
                let weight = gamma * slice_height * slice_width;
                let alpha = (x / r).asin(); // Angle at base
                
                let n = weight * alpha.cos();
                let t = weight * alpha.sin();
                
                sum_resisting += c * slice_width / alpha.cos() + n * phi.tan();
                sum_driving += t;
            }
        }
        
        let fos = if sum_driving > 0.0 { sum_resisting / sum_driving } else { 10.0 };
        
        SlopeStabilityResult {
            method: "Fellenius".to_string(),
            fos,
            critical_surface: Some(CriticalSurface {
                center_x: xc,
                center_y: yc,
                radius: r,
            }),
            is_stable: fos >= 1.5,
        }
    }
    
    /// Bishop's simplified method
    pub fn bishop_simplified(
        soil: &SoilProperties,
        slope: &SlopeInput,
        n_slices: usize,
    ) -> SlopeStabilityResult {
        let h = slope.height;
        let beta = slope.slope_angle.to_radians();
        let phi = soil.phi.to_radians();
        let c = soil.c;
        let gamma = soil.gamma;
        
        // Estimate critical circle
        let r = h / beta.sin();
        let xc = h / (2.0 * beta.tan());
        let yc = r;
        
        let slice_width = h / (n_slices as f64) / beta.tan();
        
        // Iterative solution for FOS
        let mut fos = 1.5; // Initial guess
        
        for _ in 0..20 {
            let mut sum_resisting = 0.0;
            let mut sum_driving = 0.0;
            
            for i in 0..n_slices {
                let x = (i as f64 + 0.5) * slice_width;
                let slice_height = h - x * beta.tan();
                
                if slice_height > 0.0 {
                    let weight = gamma * slice_height * slice_width;
                    let alpha = (x / r).asin();
                    
                    let m_alpha = alpha.cos() + phi.tan() * alpha.sin() / fos;
                    
                    if m_alpha > 0.01 {
                        sum_resisting += (c * slice_width + weight * phi.tan()) / m_alpha;
                    }
                    sum_driving += weight * alpha.sin();
                }
            }
            
            let new_fos = if sum_driving > 0.0 { sum_resisting / sum_driving } else { 10.0 };
            
            if (new_fos - fos).abs() < 0.001 {
                fos = new_fos;
                break;
            }
            fos = new_fos;
        }
        
        SlopeStabilityResult {
            method: "Bishop Simplified".to_string(),
            fos,
            critical_surface: Some(CriticalSurface {
                center_x: xc,
                center_y: yc,
                radius: r,
            }),
            is_stable: fos >= 1.5,
        }
    }
}

// ============================================================================
// PILE FOUNDATION
// ============================================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PileInput {
    /// Pile diameter (m)
    pub diameter: f64,
    /// Pile length (m)
    pub length: f64,
    /// Pile type
    pub pile_type: PileType,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
pub enum PileType {
    Driven,
    Bored,
    CFA,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PileCapacityResult {
    /// End bearing capacity (kN)
    pub qb: f64,
    /// Shaft friction capacity (kN)
    pub qs: f64,
    /// Ultimate capacity (kN)
    pub qu: f64,
    /// Allowable capacity with FOS (kN)
    pub qa: f64,
}

/// Pile capacity calculator
pub struct PileCapacity;

impl PileCapacity {
    /// Static formula method for sand
    pub fn static_sand(pile: &PileInput, soil: &SoilProperties, fos: f64) -> PileCapacityResult {
        let d = pile.diameter;
        let l = pile.length;
        let area_base = PI * d * d / 4.0;
        let perimeter = PI * d;
        
        let phi = soil.phi.to_radians();
        let gamma = soil.gamma;
        
        // Meyerhof method
        let nq = (PI * phi.tan()).exp() * ((45.0 + soil.phi / 2.0).to_radians().tan().powi(2));
        
        // End bearing
        let sigma_v = gamma * l;
        let qb = area_base * sigma_v * nq;
        
        // Shaft friction (using beta method)
        let k = 1.0 - phi.sin(); // K0
        let beta = k * phi.tan();
        let qs = perimeter * l * 0.5 * gamma * l * beta;
        
        let qu = qb + qs;
        let qa = qu / fos;
        
        PileCapacityResult { qb, qs, qu, qa }
    }
    
    /// Static formula method for clay
    pub fn static_clay(pile: &PileInput, soil: &SoilProperties, fos: f64) -> PileCapacityResult {
        let d = pile.diameter;
        let l = pile.length;
        let area_base = PI * d * d / 4.0;
        let perimeter = PI * d;
        
        let su = soil.su.unwrap_or(50.0);
        
        // End bearing (Nc = 9 for deep piles)
        let nc = 9.0;
        let qb = area_base * nc * su;
        
        // Shaft friction (alpha method)
        let alpha = match pile.pile_type {
            PileType::Driven => if su <= 50.0 { 1.0 } else { 0.5 },
            PileType::Bored => 0.45,
            PileType::CFA => 0.55,
        };
        let qs = perimeter * l * alpha * su;
        
        let qu = qb + qs;
        let qa = qu / fos;
        
        PileCapacityResult { qb, qs, qu, qa }
    }
    
    /// Capacity from SPT correlation
    pub fn from_spt(pile: &PileInput, n_values: &[u32], fos: f64) -> PileCapacityResult {
        let d = pile.diameter;
        let l = pile.length;
        let area_base = PI * d * d / 4.0;
        let perimeter = PI * d;
        
        // Average N value
        let n_avg: f64 = n_values.iter().map(|&n| n as f64).sum::<f64>() / n_values.len() as f64;
        
        // Meyerhof correlation for driven piles
        let qb = area_base * 400.0 * n_avg; // kN
        
        // Average shaft friction
        let qs = perimeter * l * 2.0 * n_avg; // kN
        
        let qu = qb + qs;
        let qa = qu / fos;
        
        PileCapacityResult { qb, qs, qu, qa }
    }
    
    /// Pile group capacity
    pub fn group_capacity(
        single_capacity: f64,
        n_piles: usize,
        pile_spacing: f64,
        pile_diameter: f64,
    ) -> (f64, f64) {
        // Group efficiency
        let m = (n_piles as f64).sqrt().ceil() as usize;
        let n = n_piles / m;
        
        let s = pile_spacing;
        let d = pile_diameter;
        
        // Converse-Labarre formula
        let theta = (d / s).atan();
        let efficiency = 1.0 - theta * ((m - 1) * n + (n - 1) * m) as f64 
            / (90.0_f64.to_radians() * m as f64 * n as f64);
        
        let group_capacity = efficiency * single_capacity * n_piles as f64;
        
        (group_capacity, efficiency)
    }
}

// ============================================================================
// TESTS
// ============================================================================

#[cfg(test)]
mod tests {
    use super::*;
    
    #[test]
    fn test_bearing_capacity_terzaghi() {
        let soil = SoilProperties {
            phi: 30.0,
            c: 10.0,
            gamma: 18.0,
            ..Default::default()
        };
        
        let foundation = FoundationInput {
            b: 2.0,
            l: 2.0,
            df: 1.0,
            shape: FoundationShape::Square,
            inclination: 0.0,
            ground_slope: 0.0,
        };
        
        let result = BearingCapacity::terzaghi(&foundation, &soil, 3.0);
        assert!(result.qu > 0.0);
        assert!(result.qa < result.qu);
    }
    
    #[test]
    fn test_earth_pressure_rankine() {
        let soil = SoilProperties {
            phi: 30.0,
            c: 0.0,
            gamma: 18.0,
            ..Default::default()
        };
        
        let result = EarthPressure::rankine(&soil, 5.0, None, 0.0);
        assert!(result.ka < 1.0);
        assert!(result.kp > 1.0);
        assert!(result.total_passive > result.total_active);
    }
    
    #[test]
    fn test_slope_stability() {
        let soil = SoilProperties {
            phi: 25.0,
            c: 20.0,
            gamma: 18.0,
            ..Default::default()
        };
        
        let slope = SlopeInput {
            height: 10.0,
            slope_angle: 30.0,
            water_table: None,
        };
        
        let result = SlopeStability::bishop_simplified(&soil, &slope, 10);
        assert!(result.fos > 0.0);
    }
}
