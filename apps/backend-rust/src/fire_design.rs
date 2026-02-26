// ============================================================================
// FIRE DESIGN MODULE
// EN 1992-1-2 (Eurocode), IS 456, ACI 216.1 fire resistance design
// Temperature analysis, strength reduction, fire ratings
// ============================================================================

use serde::{Deserialize, Serialize};

// ============================================================================
// FIRE EXPOSURE CURVES
// ============================================================================

/// Standard fire curve type
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum FireCurve {
    /// ISO 834 / EN 1991-1-2 standard fire
    Iso834,
    /// ASTM E119 (similar to ISO 834)
    AstmE119,
    /// Hydrocarbon fire (more severe)
    Hydrocarbon,
    /// External fire (less severe)
    External,
    /// Parametric fire (variable)
    Parametric,
}

impl FireCurve {
    /// Temperature at time t (minutes) in °C
    pub fn temperature(&self, t_min: f64) -> f64 {
        let t0 = 20.0; // Ambient temperature
        
        match self {
            FireCurve::Iso834 | FireCurve::AstmE119 => {
                // θg = 20 + 345 * log10(8t + 1)
                t0 + 345.0 * (8.0 * t_min + 1.0).log10()
            }
            FireCurve::Hydrocarbon => {
                // θg = 1080 * (1 - 0.325*e^(-0.167t) - 0.675*e^(-2.5t)) + 20
                let term1 = 0.325 * (-0.167 * t_min).exp();
                let term2 = 0.675 * (-2.5 * t_min).exp();
                1080.0 * (1.0 - term1 - term2) + t0
            }
            FireCurve::External => {
                // θg = 660 * (1 - 0.687*e^(-0.32t) - 0.313*e^(-3.8t)) + 20
                let term1 = 0.687 * (-0.32 * t_min).exp();
                let term2 = 0.313 * (-3.8 * t_min).exp();
                660.0 * (1.0 - term1 - term2) + t0
            }
            FireCurve::Parametric => {
                // Simplified parametric (depends on ventilation/fuel)
                // Use ISO 834 as default
                t0 + 345.0 * (8.0 * t_min + 1.0).log10()
            }
        }
    }
    
    /// Heat flux at time t (kW/m²)
    pub fn heat_flux(&self, t_min: f64) -> f64 {
        let theta = self.temperature(t_min);
        let theta_k: f64 = theta + 273.0;
        let t0_k: f64 = 293.0;
        
        // Stefan-Boltzmann: q = ε * σ * (Tg⁴ - T0⁴)
        let sigma: f64 = 5.67e-8; // W/m²K⁴
        let epsilon: f64 = 0.8;
        
        epsilon * sigma * (theta_k.powi(4) - t0_k.powi(4)) / 1000.0
    }
}

// ============================================================================
// MATERIAL PROPERTIES AT ELEVATED TEMPERATURE
// ============================================================================

/// Concrete properties at elevated temperature
pub struct ConcreteFireProperties;

impl ConcreteFireProperties {
    /// Compressive strength reduction factor kc(θ) per EN 1992-1-2
    pub fn strength_factor(theta: f64, aggregate: &str) -> f64 {
        let kc = match aggregate {
            "siliceous" => {
                if theta <= 100.0 { 1.0 }
                else if theta <= 200.0 { 0.95 - 0.05 * (theta - 100.0) / 100.0 }
                else if theta <= 400.0 { 0.90 - 0.15 * (theta - 200.0) / 200.0 }
                else if theta <= 800.0 { 0.75 - 0.60 * (theta - 400.0) / 400.0 }
                else { 0.15 - 0.15 * (theta - 800.0) / 400.0 }
            }
            "calcareous" => {
                if theta <= 100.0 { 1.0 }
                else if theta <= 200.0 { 0.97 - 0.03 * (theta - 100.0) / 100.0 }
                else if theta <= 400.0 { 0.94 - 0.09 * (theta - 200.0) / 200.0 }
                else if theta <= 800.0 { 0.85 - 0.55 * (theta - 400.0) / 400.0 }
                else { 0.30 - 0.30 * (theta - 800.0) / 400.0 }
            }
            _ => Self::strength_factor(theta, "siliceous"),
        };
        kc.max(0.0)
    }
    
    /// Elastic modulus reduction factor
    pub fn modulus_factor(theta: f64) -> f64 {
        if theta <= 100.0 { 1.0 }
        else if theta <= 500.0 { 1.0 - 0.5 * (theta - 100.0) / 400.0 }
        else if theta <= 800.0 { 0.5 - 0.4 * (theta - 500.0) / 300.0 }
        else { 0.1 }
    }
    
    /// Thermal conductivity (W/mK)
    pub fn thermal_conductivity(theta: f64) -> f64 {
        // Upper limit per EN 1992-1-2
        let tc = theta / 100.0;
        (2.0 - 0.2451 * tc + 0.0107 * tc.powi(2)).max(0.5)
    }
    
    /// Specific heat (J/kgK)
    pub fn specific_heat(theta: f64, moisture: f64) -> f64 {
        // EN 1992-1-2 equation
        if theta <= 100.0 {
            900.0
        } else if theta <= 115.0 && moisture > 0.0 {
            900.0 + moisture * 18800.0 * (theta - 100.0) / 15.0
        } else if theta <= 200.0 {
            1000.0 + (theta - 200.0)
        } else if theta <= 400.0 {
            1000.0 + (theta - 200.0) / 2.0
        } else {
            1100.0
        }
    }
    
    /// 500°C isotherm depth (mm) - simplified
    pub fn isotherm_500_depth(fire_duration_min: f64, one_sided: bool) -> f64 {
        // Approximate penetration depth
        let depth = 8.0 * fire_duration_min.sqrt();
        if one_sided { depth } else { depth * 0.7 }
    }
}

/// Steel properties at elevated temperature
pub struct SteelFireProperties;

impl SteelFireProperties {
    /// Yield strength reduction factor ky(θ) per EN 1993-1-2
    pub fn yield_factor(theta: f64) -> f64 {
        if theta <= 400.0 { 1.0 }
        else if theta <= 500.0 { 1.0 - 0.22 * (theta - 400.0) / 100.0 }
        else if theta <= 600.0 { 0.78 - 0.31 * (theta - 500.0) / 100.0 }
        else if theta <= 700.0 { 0.47 - 0.24 * (theta - 600.0) / 100.0 }
        else if theta <= 800.0 { 0.23 - 0.12 * (theta - 700.0) / 100.0 }
        else if theta <= 900.0 { 0.11 - 0.05 * (theta - 800.0) / 100.0 }
        else { 0.06 - 0.04 * (theta - 900.0) / 100.0 }
    }
    
    /// Elastic modulus reduction factor kE(θ)
    pub fn modulus_factor(theta: f64) -> f64 {
        if theta <= 100.0 { 1.0 }
        else if theta <= 200.0 { 1.0 - 0.1 * (theta - 100.0) / 100.0 }
        else if theta <= 300.0 { 0.9 - 0.1 * (theta - 200.0) / 100.0 }
        else if theta <= 400.0 { 0.8 - 0.1 * (theta - 300.0) / 100.0 }
        else if theta <= 500.0 { 0.7 - 0.1 * (theta - 400.0) / 100.0 }
        else if theta <= 600.0 { 0.6 - 0.29 * (theta - 500.0) / 100.0 }
        else if theta <= 700.0 { 0.31 - 0.18 * (theta - 600.0) / 100.0 }
        else if theta <= 800.0 { 0.13 - 0.04 * (theta - 700.0) / 100.0 }
        else { 0.09 - 0.04 * (theta - 800.0) / 100.0 }
    }
    
    /// Proportional limit reduction factor
    pub fn proportional_factor(theta: f64) -> f64 {
        if theta <= 100.0 { 1.0 }
        else if theta <= 200.0 { 0.807 }
        else if theta <= 300.0 { 0.613 }
        else if theta <= 400.0 { 0.420 }
        else if theta <= 500.0 { 0.360 }
        else if theta <= 600.0 { 0.180 }
        else if theta <= 700.0 { 0.075 }
        else if theta <= 800.0 { 0.050 }
        else { 0.0375 }
    }
    
    /// Thermal expansion coefficient
    pub fn thermal_expansion(theta: f64) -> f64 {
        // EN 1993-1-2
        if theta <= 750.0 {
            1.2e-5 + 0.4e-8 * theta - 2.416e-11 * theta.powi(2)
        } else if theta <= 860.0 {
            1.1e-2
        } else {
            2.0e-5 * theta - 6.2e-3
        }
    }
    
    /// Steel temperature for unprotected section (simplified)
    pub fn unprotected_temperature(
        section_factor: f64, // Am/V (m⁻¹)
        time_min: f64,
        fire_curve: &FireCurve,
    ) -> f64 {
        // Incremental method (simplified)
        let mut theta_s = 20.0;
        let dt = 0.5; // 30 seconds
        
        for i in 0..(time_min / dt * 2.0) as i32 {
            let t = (i as f64) * dt;
            let theta_g = fire_curve.temperature(t);
            
            // Heat transfer
            let h_net = 25.0 + 0.04 * (theta_g - theta_s); // Convection + radiation approx
            let d_theta = section_factor * h_net * dt * 60.0 / (7850.0 * 600.0);
            
            theta_s += d_theta;
            theta_s = theta_s.min(theta_g);
        }
        
        theta_s
    }
    
    /// Critical temperature for utilization factor
    pub fn critical_temperature(utilization: f64) -> f64 {
        // EN 1993-1-2 equation 4.22
        39.19 * (1.0 / (0.9674 * utilization.powf(3.833)) - 1.0).ln() + 482.0
    }
}

/// Reinforcement properties at elevated temperature
pub struct RebarFireProperties;

impl RebarFireProperties {
    /// Yield strength reduction for hot-rolled bars
    pub fn yield_factor_hot_rolled(theta: f64) -> f64 {
        if theta <= 400.0 { 1.0 }
        else if theta <= 500.0 { 1.0 - 0.22 * (theta - 400.0) / 100.0 }
        else if theta <= 600.0 { 0.78 - 0.31 * (theta - 500.0) / 100.0 }
        else if theta <= 700.0 { 0.47 - 0.24 * (theta - 600.0) / 100.0 }
        else if theta <= 800.0 { 0.23 - 0.12 * (theta - 700.0) / 100.0 }
        else { 0.11 - 0.05 * (theta - 800.0) / 100.0 }
    }
    
    /// Yield strength reduction for cold-worked bars
    pub fn yield_factor_cold_worked(theta: f64) -> f64 {
        if theta <= 100.0 { 1.0 }
        else if theta <= 200.0 { 1.0 - 0.04 * (theta - 100.0) / 100.0 }
        else if theta <= 300.0 { 0.96 - 0.15 * (theta - 200.0) / 100.0 }
        else if theta <= 400.0 { 0.81 - 0.18 * (theta - 300.0) / 100.0 }
        else if theta <= 500.0 { 0.63 - 0.23 * (theta - 400.0) / 100.0 }
        else if theta <= 600.0 { 0.40 - 0.18 * (theta - 500.0) / 100.0 }
        else if theta <= 700.0 { 0.22 - 0.14 * (theta - 600.0) / 100.0 }
        else { 0.08 - 0.05 * (theta - 700.0) / 100.0 }
    }
    
    /// Temperature at depth from fire-exposed surface (simplified)
    pub fn temperature_at_depth(depth_mm: f64, fire_duration_min: f64) -> f64 {
        // Simplified 1D heat transfer
        let fire = FireCurve::Iso834;
        let theta_g = fire.temperature(fire_duration_min);
        
        // Exponential decay with depth
        let alpha = 0.5e-6; // Thermal diffusivity m²/s
        let t = fire_duration_min * 60.0;
        let x = depth_mm / 1000.0;
        
        let decay = (-x / (2.0 * (alpha * t).sqrt())).exp();
        20.0 + (theta_g - 20.0) * decay
    }
}

// ============================================================================
// FIRE RATING CALCULATION
// ============================================================================

/// Fire resistance rating calculator
pub struct FireRatingCalculator {
    pub fire_curve: FireCurve,
}

impl FireRatingCalculator {
    pub fn new() -> Self {
        Self {
            fire_curve: FireCurve::Iso834,
        }
    }
    
    /// Minimum concrete cover for fire rating (mm) - IS 456 Table 16A
    pub fn min_cover_is456(fire_rating_hr: f64, member: &str) -> f64 {
        match member {
            "beam" => {
                if fire_rating_hr <= 0.5 { 20.0 }
                else if fire_rating_hr <= 1.0 { 20.0 }
                else if fire_rating_hr <= 1.5 { 20.0 }
                else if fire_rating_hr <= 2.0 { 40.0 }
                else if fire_rating_hr <= 3.0 { 60.0 }
                else { 70.0 }
            }
            "column" => {
                if fire_rating_hr <= 0.5 { 20.0 }
                else if fire_rating_hr <= 1.0 { 20.0 }
                else if fire_rating_hr <= 1.5 { 20.0 }
                else if fire_rating_hr <= 2.0 { 25.0 }
                else if fire_rating_hr <= 3.0 { 25.0 }
                else { 25.0 }
            }
            "slab" => {
                if fire_rating_hr <= 0.5 { 15.0 }
                else if fire_rating_hr <= 1.0 { 20.0 }
                else if fire_rating_hr <= 1.5 { 25.0 }
                else if fire_rating_hr <= 2.0 { 35.0 }
                else { 45.0 }
            }
            _ => 25.0,
        }
    }
    
    /// Minimum beam width for fire rating (mm) - IS 456
    pub fn min_beam_width_is456(fire_rating_hr: f64) -> f64 {
        if fire_rating_hr <= 0.5 { 80.0 }
        else if fire_rating_hr <= 1.0 { 120.0 }
        else if fire_rating_hr <= 1.5 { 150.0 }
        else if fire_rating_hr <= 2.0 { 200.0 }
        else if fire_rating_hr <= 3.0 { 240.0 }
        else { 280.0 }
    }
    
    /// Minimum column dimension for fire rating (mm) - IS 456
    pub fn min_column_dimension_is456(fire_rating_hr: f64) -> f64 {
        if fire_rating_hr <= 0.5 { 150.0 }
        else if fire_rating_hr <= 1.0 { 200.0 }
        else if fire_rating_hr <= 1.5 { 250.0 }
        else if fire_rating_hr <= 2.0 { 300.0 }
        else if fire_rating_hr <= 3.0 { 400.0 }
        else { 450.0 }
    }
    
    /// Minimum slab thickness for fire rating (mm)
    pub fn min_slab_thickness(fire_rating_hr: f64) -> f64 {
        if fire_rating_hr <= 0.5 { 75.0 }
        else if fire_rating_hr <= 1.0 { 95.0 }
        else if fire_rating_hr <= 1.5 { 110.0 }
        else if fire_rating_hr <= 2.0 { 125.0 }
        else if fire_rating_hr <= 3.0 { 150.0 }
        else { 170.0 }
    }
}

impl Default for FireRatingCalculator {
    fn default() -> Self {
        Self::new()
    }
}

// ============================================================================
// RC BEAM FIRE DESIGN
// ============================================================================

/// RC beam fire design per EN 1992-1-2
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RcBeamFireDesign {
    /// Width (mm)
    pub width: f64,
    /// Depth (mm)
    pub depth: f64,
    /// Cover to centroid of reinforcement (mm)
    pub axis_distance: f64,
    /// Concrete grade fck (MPa)
    pub fck: f64,
    /// Steel yield strength (MPa)
    pub fy: f64,
    /// Tension steel area (mm²)
    pub as_tension: f64,
    /// Fire exposure sides (1, 2, or 3)
    pub exposed_sides: u8,
}

impl RcBeamFireDesign {
    /// Check tabulated method (EN 1992-1-2 Table 5.5)
    pub fn check_tabulated(&self, fire_rating_min: f64) -> FireCheckResult {
        // Minimum dimensions from tables
        let (min_width, min_axis) = match fire_rating_min as u32 {
            0..=30 => (80.0, 15.0),
            31..=60 => (120.0, 25.0),
            61..=90 => (150.0, 35.0),
            91..=120 => (200.0, 45.0),
            121..=180 => (240.0, 55.0),
            _ => (280.0, 65.0),
        };
        
        let width_ok = self.width >= min_width;
        let cover_ok = self.axis_distance >= min_axis;
        
        FireCheckResult {
            method: "Tabulated (EN 1992-1-2)".to_string(),
            fire_rating_min: fire_rating_min as f64,
            required_width: min_width,
            actual_width: self.width,
            required_axis: min_axis,
            actual_axis: self.axis_distance,
            capacity_ratio: 0.0, // Not calculated for tabulated
            pass: width_ok && cover_ok,
        }
    }
    
    /// Simplified calculation method - 500°C isotherm
    pub fn check_simplified(&self, fire_rating_min: f64) -> FireCheckResult {
        let fire_duration = fire_rating_min;
        
        // 500°C isotherm depth
        let a_500 = ConcreteFireProperties::isotherm_500_depth(fire_duration, true);
        
        // Reduced section
        let b_fi = self.width - 2.0 * a_500;
        let d_fi = self.depth - a_500;
        
        // Rebar temperature
        let theta_s = RebarFireProperties::temperature_at_depth(self.axis_distance, fire_duration);
        let ks = RebarFireProperties::yield_factor_hot_rolled(theta_s);
        
        // Reduced moment capacity
        let z = d_fi - self.axis_distance;
        let m_rd_fi = self.as_tension * ks * self.fy * z / 1e6; // kN·m
        
        // Cold capacity (for comparison)
        let z_cold = self.depth - self.axis_distance - self.axis_distance;
        let m_rd_cold = self.as_tension * self.fy * z_cold / 1e6;
        
        let ratio = m_rd_fi / m_rd_cold;
        
        FireCheckResult {
            method: "500°C Isotherm (EN 1992-1-2)".to_string(),
            fire_rating_min,
            required_width: 0.0,
            actual_width: b_fi,
            required_axis: 0.0,
            actual_axis: self.axis_distance,
            capacity_ratio: ratio,
            pass: ratio >= 0.5, // Typical utilization factor
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FireCheckResult {
    pub method: String,
    pub fire_rating_min: f64,
    pub required_width: f64,
    pub actual_width: f64,
    pub required_axis: f64,
    pub actual_axis: f64,
    pub capacity_ratio: f64,
    pub pass: bool,
}

// ============================================================================
// STEEL BEAM FIRE DESIGN
// ============================================================================

/// Steel beam fire design per EN 1993-1-2
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SteelBeamFireDesign {
    /// Section factor Am/V (m⁻¹)
    pub section_factor: f64,
    /// Yield strength (MPa)
    pub fy: f64,
    /// Applied moment ratio (M/M_Rd)
    pub utilization: f64,
    /// Protection type
    pub protection: SteelFireProtection,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum SteelFireProtection {
    /// No protection
    Unprotected,
    /// Spray-applied protection
    SprayApplied,
    /// Board protection
    Board,
    /// Intumescent coating
    Intumescent,
    /// Concrete encasement
    ConcreteEncased,
}

impl SteelBeamFireDesign {
    /// Critical temperature
    pub fn critical_temperature(&self) -> f64 {
        SteelFireProperties::critical_temperature(self.utilization)
    }
    
    /// Fire resistance time (minutes) for unprotected
    pub fn unprotected_fire_time(&self) -> f64 {
        let theta_cr = self.critical_temperature();
        
        // Inverse temperature calculation
        let fire = FireCurve::Iso834;
        
        for t in (1..240).step_by(1) {
            let theta_s = SteelFireProperties::unprotected_temperature(
                self.section_factor,
                t as f64,
                &fire,
            );
            
            if theta_s >= theta_cr {
                return t as f64;
            }
        }
        
        240.0
    }
    
    /// Required protection thickness (mm) for rating
    pub fn required_protection_thickness(&self, fire_rating_min: f64) -> f64 {
        let theta_cr = self.critical_temperature();
        
        match self.protection {
            SteelFireProtection::Unprotected => 0.0,
            SteelFireProtection::SprayApplied => {
                // Empirical: dp = 0.1 * Am/V * t / 60 * (1100 - θcr) / 500
                0.1 * self.section_factor * fire_rating_min / 60.0 * (1100.0 - theta_cr) / 500.0
            }
            SteelFireProtection::Board => {
                // Boards typically thicker
                0.15 * self.section_factor * fire_rating_min / 60.0 * (1100.0 - theta_cr) / 500.0
            }
            SteelFireProtection::Intumescent => {
                // Thin film, typically 0.5-2mm
                (fire_rating_min / 30.0).min(2.0)
            }
            SteelFireProtection::ConcreteEncased => {
                // Concrete cover
                15.0 + fire_rating_min / 2.0
            }
        }
    }
    
    /// Check fire resistance
    pub fn check_fire_resistance(&self, fire_rating_min: f64) -> SteelFireResult {
        let theta_cr = self.critical_temperature();
        let actual_time = self.unprotected_fire_time();
        let protection_needed = actual_time < fire_rating_min;
        let protection_thickness = if protection_needed {
            self.required_protection_thickness(fire_rating_min)
        } else {
            0.0
        };
        
        SteelFireResult {
            section_factor: self.section_factor,
            utilization: self.utilization,
            critical_temperature: theta_cr,
            unprotected_time: actual_time,
            required_rating: fire_rating_min,
            protection_needed,
            protection_thickness,
            pass: actual_time >= fire_rating_min || protection_needed,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SteelFireResult {
    pub section_factor: f64,
    pub utilization: f64,
    pub critical_temperature: f64,
    pub unprotected_time: f64,
    pub required_rating: f64,
    pub protection_needed: bool,
    pub protection_thickness: f64,
    pub pass: bool,
}

// ============================================================================
// COLUMN FIRE DESIGN
// ============================================================================

/// RC column fire design
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RcColumnFireDesign {
    /// Width (mm)
    pub width: f64,
    /// Depth (mm)
    pub depth: f64,
    /// Axis distance (mm)
    pub axis_distance: f64,
    /// Concrete fck (MPa)
    pub fck: f64,
    /// Steel area (mm²)
    pub as_total: f64,
    /// Mechanical reinforcement ratio ω
    pub omega: f64,
    /// Slenderness λ
    pub slenderness: f64,
    /// First order eccentricity ratio e/h
    pub eccentricity_ratio: f64,
}

impl RcColumnFireDesign {
    /// Check Method A - Tabulated (EN 1992-1-2 Table 5.2a)
    pub fn check_tabulated(&self, fire_rating_min: f64) -> FireCheckResult {
        // Simplified table lookup
        let (min_b, min_a) = match fire_rating_min as u32 {
            0..=30 => (200.0, 25.0),
            31..=60 => (250.0, 30.0),
            61..=90 => (300.0, 40.0),
            91..=120 => (350.0, 50.0),
            121..=180 => (400.0, 55.0),
            _ => (450.0, 60.0),
        };
        
        let b_ok = self.width >= min_b && self.depth >= min_b;
        let a_ok = self.axis_distance >= min_a;
        
        FireCheckResult {
            method: "Tabulated Method A (EN 1992-1-2)".to_string(),
            fire_rating_min,
            required_width: min_b,
            actual_width: self.width.min(self.depth),
            required_axis: min_a,
            actual_axis: self.axis_distance,
            capacity_ratio: 0.0,
            pass: b_ok && a_ok,
        }
    }
    
    /// Zone method capacity ratio
    pub fn zone_method_ratio(&self, fire_rating_min: f64) -> f64 {
        // Simplified zone method
        let a_500 = ConcreteFireProperties::isotherm_500_depth(fire_rating_min, true);
        
        // Reduced dimensions
        let b_fi = self.width - 2.0 * a_500;
        let h_fi = self.depth - 2.0 * a_500;
        
        // Rebar temperature and strength
        let theta_s = RebarFireProperties::temperature_at_depth(self.axis_distance, fire_rating_min);
        let ks = RebarFireProperties::yield_factor_hot_rolled(theta_s);
        
        // Concrete strength reduction (average)
        let kc = ConcreteFireProperties::strength_factor(400.0, "siliceous");
        
        // Capacity ratio (simplified)
        (b_fi * h_fi / (self.width * self.depth)) * kc * (1.0 + self.omega * ks)
    }
}

// ============================================================================
// TESTS
// ============================================================================

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_iso834_temperature() {
        let fire = FireCurve::Iso834;
        
        let t30 = fire.temperature(30.0);
        let t60 = fire.temperature(60.0);
        let t120 = fire.temperature(120.0);
        
        assert!(t30 > 800.0 && t30 < 900.0);
        assert!(t60 > 900.0 && t60 < 1000.0);
        assert!(t120 > 1000.0);
    }

    #[test]
    fn test_hydrocarbon_temperature() {
        let fire = FireCurve::Hydrocarbon;
        let t30 = fire.temperature(30.0);
        
        // Hydrocarbon is more severe
        assert!(t30 > FireCurve::Iso834.temperature(30.0));
    }

    #[test]
    fn test_concrete_strength_factor() {
        let k20 = ConcreteFireProperties::strength_factor(20.0, "siliceous");
        let k400 = ConcreteFireProperties::strength_factor(400.0, "siliceous");
        let k800 = ConcreteFireProperties::strength_factor(800.0, "siliceous");
        
        assert!((k20 - 1.0).abs() < 0.01);
        assert!(k400 < k20);
        assert!(k800 < k400);
    }

    #[test]
    fn test_steel_yield_factor() {
        let k20 = SteelFireProperties::yield_factor(20.0);
        let k500 = SteelFireProperties::yield_factor(500.0);
        let k700 = SteelFireProperties::yield_factor(700.0);
        
        assert!((k20 - 1.0).abs() < 0.01);
        assert!(k500 < k20);
        assert!(k700 < k500);
    }

    #[test]
    fn test_critical_temperature() {
        let theta_05 = SteelFireProperties::critical_temperature(0.5);
        let theta_03 = SteelFireProperties::critical_temperature(0.3);
        
        assert!(theta_05 > 500.0);
        assert!(theta_03 > theta_05);
    }

    #[test]
    fn test_rebar_temperature() {
        let t30 = RebarFireProperties::temperature_at_depth(30.0, 60.0);
        let t50 = RebarFireProperties::temperature_at_depth(50.0, 60.0);
        
        assert!(t30 > t50); // Deeper = cooler
    }

    #[test]
    fn test_fire_rating_cover() {
        let c1 = FireRatingCalculator::min_cover_is456(1.0, "beam");
        let c2 = FireRatingCalculator::min_cover_is456(2.0, "beam");
        
        assert!(c2 > c1);
    }

    #[test]
    fn test_fire_rating_width() {
        let w1 = FireRatingCalculator::min_beam_width_is456(1.0);
        let w2 = FireRatingCalculator::min_beam_width_is456(2.0);
        
        assert!(w2 > w1);
    }

    #[test]
    fn test_rc_beam_tabulated() {
        let beam = RcBeamFireDesign {
            width: 200.0,
            depth: 400.0,
            axis_distance: 45.0,
            fck: 30.0,
            fy: 500.0,
            as_tension: 1200.0,
            exposed_sides: 3,
        };
        
        let result = beam.check_tabulated(90.0);
        assert!(result.pass);
    }

    #[test]
    fn test_rc_beam_simplified() {
        let beam = RcBeamFireDesign {
            width: 250.0,
            depth: 500.0,
            axis_distance: 40.0,
            fck: 30.0,
            fy: 500.0,
            as_tension: 1500.0,
            exposed_sides: 3,
        };
        
        let result = beam.check_simplified(60.0);
        assert!(result.capacity_ratio > 0.0);
    }

    #[test]
    fn test_steel_beam_fire() {
        let beam = SteelBeamFireDesign {
            section_factor: 150.0,
            fy: 355.0,
            utilization: 0.5,
            protection: SteelFireProtection::Unprotected,
        };
        
        let theta_cr = beam.critical_temperature();
        assert!(theta_cr > 500.0);
    }

    #[test]
    fn test_steel_fire_time() {
        let beam = SteelBeamFireDesign {
            section_factor: 100.0,
            fy: 355.0,
            utilization: 0.6,
            protection: SteelFireProtection::Unprotected,
        };
        
        let time = beam.unprotected_fire_time();
        assert!(time > 0.0);
    }

    #[test]
    fn test_steel_fire_check() {
        let beam = SteelBeamFireDesign {
            section_factor: 150.0,
            fy: 355.0,
            utilization: 0.5,
            protection: SteelFireProtection::SprayApplied,
        };
        
        let result = beam.check_fire_resistance(60.0);
        assert!(result.critical_temperature > 0.0);
    }

    #[test]
    fn test_rc_column_tabulated() {
        let col = RcColumnFireDesign {
            width: 350.0,
            depth: 350.0,
            axis_distance: 50.0,
            fck: 30.0,
            as_total: 2400.0,
            omega: 0.1,
            slenderness: 30.0,
            eccentricity_ratio: 0.2,
        };
        
        let result = col.check_tabulated(120.0);
        assert!(result.pass);
    }

    #[test]
    fn test_zone_method() {
        let col = RcColumnFireDesign {
            width: 400.0,
            depth: 400.0,
            axis_distance: 45.0,
            fck: 30.0,
            as_total: 3200.0,
            omega: 0.15,
            slenderness: 25.0,
            eccentricity_ratio: 0.15,
        };
        
        let ratio = col.zone_method_ratio(60.0);
        assert!(ratio > 0.0 && ratio < 1.0);
    }

    #[test]
    fn test_isotherm_depth() {
        let d30 = ConcreteFireProperties::isotherm_500_depth(30.0, true);
        let d60 = ConcreteFireProperties::isotherm_500_depth(60.0, true);
        
        assert!(d60 > d30);
    }

    #[test]
    fn test_thermal_conductivity() {
        let k20 = ConcreteFireProperties::thermal_conductivity(20.0);
        let k500 = ConcreteFireProperties::thermal_conductivity(500.0);
        
        assert!(k20 > k500);
    }

    #[test]
    fn test_heat_flux() {
        let fire = FireCurve::Iso834;
        let q30 = fire.heat_flux(30.0);
        let q60 = fire.heat_flux(60.0);
        
        assert!(q30 > 0.0);
        assert!(q60 > q30);
    }
}
