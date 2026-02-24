//! Durability Design and Service Life Prediction
//! 
//! Comprehensive durability analysis for:
//! - Chloride ingress modeling
//! - Carbonation depth prediction
//! - Corrosion initiation time
//! - Service life prediction
//! 
//! Standards: EN 206, ACI 318/365, fib Model Code, DuraCrete

use serde::{Deserialize, Serialize};
use crate::special_functions::erf;

/// Exposure class per EN 206
#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq)]
pub enum ExposureClass {
    // No risk of corrosion
    X0,
    // Carbonation-induced corrosion
    XC1, // Dry or permanently wet
    XC2, // Wet, rarely dry
    XC3, // Moderate humidity
    XC4, // Cyclic wet and dry
    // Chloride-induced (non-marine)
    XD1, // Moderate humidity
    XD2, // Wet, rarely dry
    XD3, // Cyclic wet and dry
    // Chloride-induced (marine)
    XS1, // Airborne salt
    XS2, // Submerged
    XS3, // Tidal/splash zone
    // Freeze-thaw
    XF1, // Moderate saturation, no de-icing
    XF2, // Moderate saturation, de-icing
    XF3, // High saturation, no de-icing
    XF4, // High saturation, de-icing
    // Chemical attack
    XA1, // Slightly aggressive
    XA2, // Moderately aggressive
    XA3, // Highly aggressive
}

impl ExposureClass {
    /// Get minimum cover requirement (mm)
    pub fn minimum_cover(&self, design_life_years: u32) -> f64 {
        let base_cover = match self {
            ExposureClass::X0 => 15.0,
            ExposureClass::XC1 => 25.0,
            ExposureClass::XC2 | ExposureClass::XC3 => 30.0,
            ExposureClass::XC4 => 35.0,
            ExposureClass::XD1 => 40.0,
            ExposureClass::XD2 => 45.0,
            ExposureClass::XD3 => 50.0,
            ExposureClass::XS1 => 45.0,
            ExposureClass::XS2 => 40.0,
            ExposureClass::XS3 => 50.0,
            ExposureClass::XF1 | ExposureClass::XF2 => 35.0,
            ExposureClass::XF3 | ExposureClass::XF4 => 40.0,
            ExposureClass::XA1 => 35.0,
            ExposureClass::XA2 => 40.0,
            ExposureClass::XA3 => 50.0,
        };
        
        // Adjust for design life
        if design_life_years > 50 {
            base_cover + 10.0
        } else {
            base_cover
        }
    }
    
    /// Get maximum w/c ratio
    pub fn max_wc_ratio(&self) -> f64 {
        match self {
            ExposureClass::X0 => 0.70,
            ExposureClass::XC1 => 0.65,
            ExposureClass::XC2 | ExposureClass::XC3 => 0.60,
            ExposureClass::XC4 => 0.55,
            ExposureClass::XD1 | ExposureClass::XD2 => 0.55,
            ExposureClass::XD3 => 0.50,
            ExposureClass::XS1 | ExposureClass::XS2 => 0.50,
            ExposureClass::XS3 => 0.45,
            ExposureClass::XF1 | ExposureClass::XF2 => 0.55,
            ExposureClass::XF3 | ExposureClass::XF4 => 0.50,
            ExposureClass::XA1 => 0.55,
            ExposureClass::XA2 => 0.50,
            ExposureClass::XA3 => 0.45,
        }
    }
    
    /// Get minimum strength class
    pub fn min_strength_class(&self) -> &str {
        match self {
            ExposureClass::X0 => "C12/15",
            ExposureClass::XC1 => "C20/25",
            ExposureClass::XC2 | ExposureClass::XC3 => "C25/30",
            ExposureClass::XC4 => "C30/37",
            ExposureClass::XD1 | ExposureClass::XD2 => "C30/37",
            ExposureClass::XD3 => "C35/45",
            ExposureClass::XS1 | ExposureClass::XS2 => "C30/37",
            ExposureClass::XS3 => "C35/45",
            ExposureClass::XF1 => "C30/37",
            ExposureClass::XF2 | ExposureClass::XF3 | ExposureClass::XF4 => "C30/37",
            ExposureClass::XA1 => "C30/37",
            ExposureClass::XA2 | ExposureClass::XA3 => "C35/45",
        }
    }
}

/// Chloride ingress model
#[derive(Debug, Clone)]
pub struct ChlorideIngressModel {
    /// Surface chloride concentration (% by weight of cement)
    pub cs: f64,
    /// Initial chloride content (% by weight of cement)
    pub ci: f64,
    /// Apparent diffusion coefficient (m²/s)
    pub dapp: f64,
    /// Age factor for diffusion
    pub age_factor: f64,
    /// Reference time (s)
    pub t_ref: f64,
}

impl ChlorideIngressModel {
    /// Create model for marine exposure per fib MC 2010
    pub fn marine_exposure(exposure: ExposureClass, _concrete_grade: f64, w_c: f64) -> Self {
        // Surface chloride based on exposure
        let cs = match exposure {
            ExposureClass::XS1 => 2.0,  // Airborne
            ExposureClass::XS2 => 3.5,  // Submerged
            ExposureClass::XS3 => 5.0,  // Splash/tidal
            ExposureClass::XD1 | ExposureClass::XD2 => 2.0,
            ExposureClass::XD3 => 3.0,
            _ => 0.5,
        };
        
        // Diffusion coefficient from w/c ratio
        // D_app,28 = 10^(-12.06 + 2.4*w/c) m²/s (simplified)
        let d28 = 10.0_f64.powf(-12.06 + 2.4 * w_c);
        
        // Age factor depends on binder type
        let age_factor = 0.4; // CEM I, 0.6 for blended cements
        
        Self {
            cs,
            ci: 0.05, // Typical initial chloride
            dapp: d28,
            age_factor,
            t_ref: 28.0 * 24.0 * 3600.0, // 28 days in seconds
        }
    }
    
    /// Calculate chloride concentration at depth x after time t
    /// Using Fick's second law with time-dependent diffusion
    pub fn chloride_at_depth(&self, x_mm: f64, t_years: f64) -> f64 {
        let x = x_mm / 1000.0; // Convert to meters
        let t = t_years * 365.25 * 24.0 * 3600.0; // Convert to seconds
        
        // Time-dependent diffusion coefficient
        let d_t = self.dapp * (self.t_ref / t).powf(self.age_factor);
        
        // C(x,t) = Ci + (Cs - Ci) * (1 - erf(x / (2 * sqrt(D*t))))
        let arg = x / (2.0 * (d_t * t).sqrt());
        let erf_val = erf(arg);
        
        self.ci + (self.cs - self.ci) * (1.0 - erf_val)
    }
    
    /// Calculate time to reach critical chloride at given depth
    pub fn time_to_critical(&self, x_mm: f64, c_crit: f64) -> f64 {
        // Iterative solution (Newton-Raphson)
        let mut t = 10.0; // Initial guess: 10 years
        
        for _ in 0..50 {
            let c = self.chloride_at_depth(x_mm, t);
            let error = c - c_crit;
            
            if error.abs() < 0.001 {
                return t;
            }
            
            // Numerical derivative
            let dt = 0.1;
            let c_plus = self.chloride_at_depth(x_mm, t + dt);
            let dc_dt = (c_plus - c) / dt;
            
            if dc_dt.abs() > 1e-10 {
                t -= error / dc_dt;
                t = t.max(1.0); // Minimum 1 year
            }
        }
        
        t
    }
    
    /// Generate chloride profile at time t
    pub fn chloride_profile(&self, t_years: f64, max_depth_mm: f64) -> Vec<(f64, f64)> {
        let mut profile = Vec::new();
        let steps = 50;
        
        for i in 0..=steps {
            let x = max_depth_mm * i as f64 / steps as f64;
            let c = self.chloride_at_depth(x, t_years);
            profile.push((x, c));
        }
        
        profile
    }
}

/// Carbonation model
#[derive(Debug, Clone)]
pub struct CarbonationModel {
    /// Ambient CO2 concentration (%)
    pub co2_concentration: f64,
    /// Relative humidity (%)
    pub rh: f64,
    /// Concrete compressive strength (MPa)
    pub fck: f64,
    /// Cement content (kg/m³)
    pub cement_content: f64,
    /// Cement type factor
    pub cement_factor: f64,
}

impl CarbonationModel {
    /// Create model with standard parameters
    pub fn new(fck: f64, cement_content: f64, rh: f64) -> Self {
        Self {
            co2_concentration: 0.04, // 400 ppm
            rh,
            fck,
            cement_content,
            cement_factor: 1.0, // CEM I
        }
    }
    
    /// Calculate carbonation depth per fib Model Code
    pub fn carbonation_depth(&self, t_years: f64) -> f64 {
        // x_c = k * sqrt(t)
        // k depends on concrete quality and environment
        
        // Environmental function
        let k_e = if self.rh < 40.0 {
            0.0 // Too dry
        } else if self.rh > 90.0 {
            0.1 // Too wet
        } else {
            // Maximum carbonation around 50-70% RH
            1.0 - ((self.rh - 60.0) / 20.0).powi(2) * 0.5
        };
        
        // Concrete quality factor (inversely proportional to strength)
        let k_c = 70.0 / self.fck;
        
        // CO2 concentration factor
        let k_co2 = (self.co2_concentration / 0.03).sqrt();
        
        // Combined carbonation coefficient (mm/year^0.5)
        let k = 3.0 * k_e * k_c * k_co2 * self.cement_factor;
        
        k * t_years.sqrt()
    }
    
    /// Calculate time to reach depassivation depth
    pub fn time_to_depassivation(&self, cover_mm: f64) -> f64 {
        // Solve x_c = cover for t
        let k_e = if self.rh < 40.0 || self.rh > 90.0 { 0.5 } else { 1.0 };
        let k_c = 70.0 / self.fck;
        let k_co2 = (self.co2_concentration / 0.03).sqrt();
        let k = 3.0 * k_e * k_c * k_co2 * self.cement_factor;
        
        if k > 0.0 {
            (cover_mm / k).powi(2)
        } else {
            f64::INFINITY
        }
    }
    
    /// Predict carbonation depth over time
    pub fn carbonation_profile(&self, max_years: f64) -> Vec<(f64, f64)> {
        let mut profile = Vec::new();
        let steps = 50;
        
        for i in 0..=steps {
            let t = max_years * i as f64 / steps as f64;
            let depth = self.carbonation_depth(t);
            profile.push((t, depth));
        }
        
        profile
    }
}

/// Service life prediction model
#[derive(Debug, Clone)]
pub struct ServiceLifePredictor {
    /// Exposure class
    pub exposure: ExposureClass,
    /// Cover to reinforcement (mm)
    pub cover: f64,
    /// Concrete compressive strength (MPa)
    pub fck: f64,
    /// Water-cement ratio
    pub w_c: f64,
    /// Cement content (kg/m³)
    pub cement: f64,
    /// Critical chloride content (% by weight of cement)
    pub c_crit: f64,
}

impl ServiceLifePredictor {
    /// Create predictor with default critical chloride
    pub fn new(exposure: ExposureClass, cover: f64, fck: f64, w_c: f64, cement: f64) -> Self {
        Self {
            exposure,
            cover,
            fck,
            w_c,
            cement,
            c_crit: 0.4, // Typical critical chloride for black steel
        }
    }
    
    /// Predict service life (time to corrosion initiation)
    pub fn predict_service_life(&self) -> ServiceLifeResult {
        // Determine dominant deterioration mechanism
        let is_chloride = matches!(self.exposure, 
            ExposureClass::XD1 | ExposureClass::XD2 | ExposureClass::XD3 |
            ExposureClass::XS1 | ExposureClass::XS2 | ExposureClass::XS3);
        
        let is_carbonation = matches!(self.exposure,
            ExposureClass::XC1 | ExposureClass::XC2 | ExposureClass::XC3 | ExposureClass::XC4);
        
        let mut initiation_time = f64::INFINITY;
        let mut mechanism = "None";
        
        if is_chloride {
            // Chloride-induced corrosion
            let model = ChlorideIngressModel::marine_exposure(self.exposure, self.fck, self.w_c);
            initiation_time = model.time_to_critical(self.cover, self.c_crit);
            mechanism = "Chloride-induced corrosion";
        } else if is_carbonation {
            // Carbonation-induced corrosion
            let rh = match self.exposure {
                ExposureClass::XC1 => 40.0,
                ExposureClass::XC2 => 80.0,
                ExposureClass::XC3 => 60.0,
                ExposureClass::XC4 => 70.0,
                _ => 60.0,
            };
            let model = CarbonationModel::new(self.fck, self.cement, rh);
            initiation_time = model.time_to_depassivation(self.cover);
            mechanism = "Carbonation-induced corrosion";
        }
        
        // Propagation period (simplified - typically 10-20 years)
        let propagation_time = if initiation_time < f64::INFINITY {
            15.0
        } else {
            0.0
        };
        
        let total_service_life = initiation_time + propagation_time;
        
        // Check against typical design life
        let design_life = 50.0;
        let reliability_index = initiation_time / design_life;
        
        ServiceLifeResult {
            initiation_time,
            propagation_time,
            total_service_life,
            mechanism: mechanism.to_string(),
            reliability_index,
            is_adequate: reliability_index >= 1.0,
        }
    }
    
    /// Calculate required cover for target service life
    pub fn required_cover(&self, target_life: f64) -> f64 {
        let is_chloride = matches!(self.exposure, 
            ExposureClass::XD1 | ExposureClass::XD2 | ExposureClass::XD3 |
            ExposureClass::XS1 | ExposureClass::XS2 | ExposureClass::XS3);
        
        if is_chloride {
            // Binary search for required cover
            let mut low = 20.0;
            let mut high = 100.0;
            
            while high - low > 1.0 {
                let mid = (low + high) / 2.0;
                let model = ChlorideIngressModel::marine_exposure(self.exposure, self.fck, self.w_c);
                let time = model.time_to_critical(mid, self.c_crit);
                
                if time >= target_life {
                    high = mid;
                } else {
                    low = mid;
                }
            }
            
            high.ceil()
        } else {
            // Carbonation - solve analytically
            let rh = 60.0;
            let model = CarbonationModel::new(self.fck, self.cement, rh);
            
            // x = k * sqrt(t), so cover = k * sqrt(target_life)
            model.carbonation_depth(target_life).ceil() + 10.0 // Add safety margin
        }
    }
}

/// Service life result
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ServiceLifeResult {
    /// Time to corrosion initiation (years)
    pub initiation_time: f64,
    /// Propagation period (years)
    pub propagation_time: f64,
    /// Total service life (years)
    pub total_service_life: f64,
    /// Dominant deterioration mechanism
    pub mechanism: String,
    /// Reliability index (initiation/design life)
    pub reliability_index: f64,
    /// Is service life adequate
    pub is_adequate: bool,
}

/// Corrosion rate model
#[derive(Debug, Clone)]
pub struct CorrosionRateModel {
    /// Corrosion current density (μA/cm²)
    pub i_corr: f64,
}

impl CorrosionRateModel {
    /// Estimate corrosion rate from exposure
    pub fn from_exposure(exposure: ExposureClass, rh: f64, temp_c: f64) -> Self {
        // Base corrosion rate (μA/cm²) per exposure
        let i_base = match exposure {
            ExposureClass::XC1 | ExposureClass::XC2 => 0.1,
            ExposureClass::XC3 | ExposureClass::XC4 => 0.5,
            ExposureClass::XD1 | ExposureClass::XS1 => 1.0,
            ExposureClass::XD2 | ExposureClass::XS2 => 2.0,
            ExposureClass::XD3 | ExposureClass::XS3 => 5.0,
            _ => 0.1,
        };
        
        // Temperature correction (Arrhenius)
        let t_factor = ((temp_c - 20.0) / 10.0).exp() * 0.1 + 1.0;
        
        // Humidity correction
        let rh_factor = if rh < 40.0 {
            0.1
        } else if rh > 95.0 {
            0.5 // Reduced O2 availability
        } else {
            1.0
        };
        
        Self {
            i_corr: i_base * t_factor * rh_factor,
        }
    }
    
    /// Calculate section loss rate (mm/year)
    pub fn section_loss_rate(&self) -> f64 {
        // Faraday's law: x = 0.0116 * i_corr (mm/year for i_corr in μA/cm²)
        0.0116 * self.i_corr
    }
    
    /// Calculate time to critical section loss
    pub fn time_to_section_loss(&self, target_loss_mm: f64) -> f64 {
        target_loss_mm / self.section_loss_rate()
    }
    
    /// Calculate crack width development
    pub fn crack_width(&self, bar_diameter: f64, cover: f64, time_years: f64) -> f64 {
        let section_loss = self.section_loss_rate() * time_years;
        
        // Empirical crack width model
        // w = α * (Δr - Δr_crit) where Δr is radius loss
        let radius_loss = section_loss / 2.0;
        let critical_loss = 0.05; // mm (typical crack initiation)
        
        if radius_loss > critical_loss {
            let alpha = 0.05 * (cover / bar_diameter); // Empirical factor
            alpha * (radius_loss - critical_loss) * 10.0 // mm
        } else {
            0.0
        }
    }
}

/// Durability design checker
#[derive(Debug, Clone)]
pub struct DurabilityChecker {
    /// Target design life (years)
    pub design_life: f64,
}

impl DurabilityChecker {
    /// Create new checker
    pub fn new(design_life: f64) -> Self {
        Self { design_life }
    }
    
    /// Check concrete mix durability
    pub fn check_concrete_mix(
        &self,
        exposure: ExposureClass,
        w_c: f64,
        fck: f64,
        cement_content: f64,
    ) -> ConcreteCheckResult {
        let max_wc = exposure.max_wc_ratio();
        let min_strength = self.parse_strength_class(exposure.min_strength_class());
        let min_cement = self.minimum_cement_content(exposure);
        
        let wc_ok = w_c <= max_wc;
        let strength_ok = fck >= min_strength;
        let cement_ok = cement_content >= min_cement;
        
        ConcreteCheckResult {
            exposure,
            w_c_ratio: w_c,
            max_w_c: max_wc,
            w_c_ok: wc_ok,
            fck,
            min_fck: min_strength,
            strength_ok,
            cement_content,
            min_cement: min_cement,
            cement_ok,
            is_compliant: wc_ok && strength_ok && cement_ok,
        }
    }
    
    /// Check cover adequacy
    pub fn check_cover(
        &self,
        exposure: ExposureClass,
        provided_cover: f64,
        tolerance: f64,
    ) -> CoverCheckResult {
        let c_min = exposure.minimum_cover(self.design_life as u32);
        let c_nom = c_min + tolerance;
        
        let is_adequate = provided_cover >= c_nom;
        
        CoverCheckResult {
            exposure,
            c_min,
            tolerance,
            c_nom,
            provided_cover,
            is_adequate,
            deficit: if is_adequate { 0.0 } else { c_nom - provided_cover },
        }
    }
    
    fn parse_strength_class(&self, class: &str) -> f64 {
        // Parse "C30/37" format
        if let Some(pos) = class.find('/') {
            class[1..pos].parse().unwrap_or(20.0)
        } else {
            20.0
        }
    }
    
    fn minimum_cement_content(&self, exposure: ExposureClass) -> f64 {
        match exposure {
            ExposureClass::X0 => 260.0,
            ExposureClass::XC1 => 280.0,
            ExposureClass::XC2 | ExposureClass::XC3 => 300.0,
            ExposureClass::XC4 => 320.0,
            ExposureClass::XD1 | ExposureClass::XD2 | ExposureClass::XD3 => 340.0,
            ExposureClass::XS1 | ExposureClass::XS2 | ExposureClass::XS3 => 360.0,
            ExposureClass::XF1 | ExposureClass::XF2 | ExposureClass::XF3 | ExposureClass::XF4 => 340.0,
            ExposureClass::XA1 => 320.0,
            ExposureClass::XA2 | ExposureClass::XA3 => 360.0,
        }
    }
}

/// Concrete check result
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConcreteCheckResult {
    pub exposure: ExposureClass,
    pub w_c_ratio: f64,
    pub max_w_c: f64,
    pub w_c_ok: bool,
    pub fck: f64,
    pub min_fck: f64,
    pub strength_ok: bool,
    pub cement_content: f64,
    pub min_cement: f64,
    pub cement_ok: bool,
    pub is_compliant: bool,
}

/// Cover check result
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CoverCheckResult {
    pub exposure: ExposureClass,
    pub c_min: f64,
    pub tolerance: f64,
    pub c_nom: f64,
    pub provided_cover: f64,
    pub is_adequate: bool,
    pub deficit: f64,
}

#[cfg(test)]
mod tests {
    use super::*;
    
    #[test]
    fn test_exposure_class_requirements() {
        assert!((ExposureClass::XS3.minimum_cover(50) - 50.0).abs() < 0.1);
        assert!((ExposureClass::XS3.max_wc_ratio() - 0.45).abs() < 0.01);
        assert_eq!(ExposureClass::XS3.min_strength_class(), "C35/45");
    }
    
    #[test]
    fn test_chloride_ingress() {
        let model = ChlorideIngressModel::marine_exposure(
            ExposureClass::XS3,
            35.0,
            0.45,
        );
        
        // Chloride at surface should be near Cs
        let c_surface = model.chloride_at_depth(0.0, 50.0);
        assert!((c_surface - model.cs).abs() < 0.1);
        
        // Chloride should decrease with depth
        let c_deep = model.chloride_at_depth(100.0, 50.0);
        assert!(c_deep < c_surface);
    }
    
    #[test]
    fn test_time_to_critical_chloride() {
        let model = ChlorideIngressModel::marine_exposure(
            ExposureClass::XS2,
            35.0,
            0.50,
        );
        
        let time = model.time_to_critical(50.0, 0.4);
        
        // Should be a positive, reasonable value
        assert!(time > 0.0);
        assert!(time < 200.0); // Less than 200 years is reasonable
    }
    
    #[test]
    fn test_carbonation_depth() {
        let model = CarbonationModel::new(30.0, 350.0, 60.0);
        
        let depth_10 = model.carbonation_depth(10.0);
        let depth_50 = model.carbonation_depth(50.0);
        
        // Carbonation should follow sqrt(t) relationship
        assert!(depth_50 > depth_10);
        assert!((depth_50 / depth_10 - (50.0_f64 / 10.0).sqrt()).abs() < 0.5);
    }
    
    #[test]
    fn test_service_life_prediction() {
        let predictor = ServiceLifePredictor::new(
            ExposureClass::XS3,
            50.0,  // 50mm cover
            35.0,  // C35/45
            0.45,  // w/c
            360.0, // cement content
        );
        
        let result = predictor.predict_service_life();
        
        assert!(result.initiation_time > 0.0);
        assert!(result.mechanism.contains("Chloride"));
    }
    
    #[test]
    fn test_required_cover_calculation() {
        let predictor = ServiceLifePredictor::new(
            ExposureClass::XS2,
            40.0,
            35.0,
            0.50,
            350.0,
        );
        
        let required = predictor.required_cover(100.0);
        
        // Required cover for 100 years should be substantial
        assert!(required > 40.0);
        assert!(required < 150.0);
    }
    
    #[test]
    fn test_corrosion_rate() {
        let model = CorrosionRateModel::from_exposure(ExposureClass::XS3, 80.0, 20.0);
        
        let rate = model.section_loss_rate();
        
        // Typical rates 0.01-0.1 mm/year for active corrosion
        assert!(rate > 0.0);
        assert!(rate < 1.0);
    }
    
    #[test]
    fn test_crack_width_development() {
        let model = CorrosionRateModel::from_exposure(ExposureClass::XD3, 70.0, 25.0);
        
        let crack_0 = model.crack_width(16.0, 40.0, 0.0);
        let crack_10 = model.crack_width(16.0, 40.0, 10.0);
        
        assert_eq!(crack_0, 0.0); // No cracks initially
        assert!(crack_10 >= 0.0); // May have cracks after 10 years
    }
    
    #[test]
    fn test_durability_checker_concrete() {
        let checker = DurabilityChecker::new(50.0);
        
        let result = checker.check_concrete_mix(
            ExposureClass::XS3,
            0.45,
            35.0,
            360.0,
        );
        
        assert!(result.is_compliant);
        
        // Non-compliant mix
        let result_bad = checker.check_concrete_mix(
            ExposureClass::XS3,
            0.55,  // Too high w/c
            30.0,  // Too low strength
            300.0, // Too low cement
        );
        
        assert!(!result_bad.is_compliant);
    }
    
    #[test]
    fn test_durability_checker_cover() {
        let checker = DurabilityChecker::new(50.0);
        
        let result = checker.check_cover(
            ExposureClass::XC3,
            40.0,  // Provided cover
            10.0,  // Tolerance
        );
        
        assert!(result.is_adequate);
        
        // Inadequate cover
        let result_bad = checker.check_cover(
            ExposureClass::XS3,
            40.0,  // Provided cover
            10.0,  // Tolerance
        );
        
        assert!(!result_bad.is_adequate);
    }
    
    #[test]
    fn test_chloride_profile() {
        let model = ChlorideIngressModel::marine_exposure(
            ExposureClass::XS2,
            35.0,
            0.50,
        );
        
        let profile = model.chloride_profile(50.0, 100.0);
        
        assert!(!profile.is_empty());
        // Chloride should decrease monotonically with depth
        for i in 1..profile.len() {
            assert!(profile[i].1 <= profile[i-1].1);
        }
    }
    
    #[test]
    fn test_erf_function() {
        // Known values
        assert!((erf(0.0)).abs() < 0.001);
        assert!((erf(1.0) - 0.8427).abs() < 0.01);
        assert!(erf(3.0) > 0.99);
    }
    
    #[test]
    fn test_carbonation_humidity_effect() {
        let model_dry = CarbonationModel::new(30.0, 350.0, 30.0);
        let model_optimal = CarbonationModel::new(30.0, 350.0, 60.0);
        let model_wet = CarbonationModel::new(30.0, 350.0, 95.0);
        
        let depth_dry = model_dry.carbonation_depth(50.0);
        let depth_optimal = model_optimal.carbonation_depth(50.0);
        let depth_wet = model_wet.carbonation_depth(50.0);
        
        // Carbonation is highest at moderate humidity
        assert!(depth_optimal >= depth_dry);
        assert!(depth_optimal >= depth_wet);
    }
}
