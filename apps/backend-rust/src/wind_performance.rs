//! Performance Based Wind Engineering Module
//! 
//! Advanced wind engineering analysis:
//! - Wind tunnel test correlation
//! - Across-wind response analysis
//! - Aeroelastic effects
//! - Wind-induced fatigue
//! - Comfort criteria assessment

use serde::{Deserialize, Serialize};

const PI: f64 = std::f64::consts::PI;

/// Performance-based wind engineering analyzer
#[derive(Debug, Clone)]
pub struct WindPerformanceAnalyzer {
    /// Building properties
    pub building: BuildingAeroProperties,
    /// Wind climate
    pub climate: WindClimate,
    /// Design code
    pub code: WindDesignCode,
    /// Analysis results
    pub results: Option<WindPerformanceResults>,
}

/// Building aerodynamic properties
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BuildingAeroProperties {
    /// Building height (m)
    pub height: f64,
    /// Building width (normal to wind) (m)
    pub width: f64,
    /// Building depth (parallel to wind) (m)
    pub depth: f64,
    /// Fundamental frequency in along-wind direction (Hz)
    pub freq_along: f64,
    /// Fundamental frequency in across-wind direction (Hz)
    pub freq_across: f64,
    /// Fundamental torsional frequency (Hz)
    pub freq_torsion: f64,
    /// Generalized mass (kg)
    pub generalized_mass: f64,
    /// Structural damping ratio
    pub damping_ratio: f64,
    /// Building density (kg/m³)
    pub density: f64,
    /// Mode shape exponent
    pub mode_exponent: f64,
}

impl BuildingAeroProperties {
    /// Create typical tall building
    pub fn typical_tall_building(height: f64, width: f64, depth: f64) -> Self {
        // Empirical formula for fundamental frequency
        let freq = 46.0 / height;
        
        // Approximate generalized mass
        let building_mass = width * depth * height * 200.0; // 200 kg/m³ average
        let modal_factor = 1.0 / (1.0 + 2.0); // For linear mode shape
        let generalized_mass = building_mass * modal_factor;
        
        Self {
            height,
            width,
            depth,
            freq_along: freq,
            freq_across: freq * 1.1, // Typically slightly higher
            freq_torsion: freq * 1.3,
            generalized_mass,
            damping_ratio: 0.015, // 1.5% for concrete
            density: 200.0,
            mode_exponent: 1.0,
        }
    }
    
    /// Calculate aspect ratio
    pub fn aspect_ratio(&self) -> f64 {
        self.height / self.width.min(self.depth)
    }
    
    /// Calculate slenderness ratio
    pub fn slenderness(&self) -> f64 {
        self.height / (self.width * self.depth).sqrt()
    }
}

/// Wind climate data
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WindClimate {
    /// Location name
    pub location: String,
    /// Basic wind speed at 10m height (m/s)
    pub v_basic: f64,
    /// Terrain category
    pub terrain: TerrainCategory,
    /// Directional distribution
    pub directional: Option<DirectionalDistribution>,
    /// Annual occurrence probability
    pub return_period: f64,
}

/// Terrain category
#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
pub enum TerrainCategory {
    /// Open terrain (sea, flat land)
    Open,
    /// Suburban
    Suburban,
    /// Urban
    Urban,
    /// CentralCity (dense urban)
    CentralCity,
}

impl TerrainCategory {
    /// Get terrain parameters (alpha, z0)
    pub fn parameters(&self) -> (f64, f64) {
        match self {
            TerrainCategory::Open => (0.14, 0.01),
            TerrainCategory::Suburban => (0.22, 0.3),
            TerrainCategory::Urban => (0.33, 1.0),
            TerrainCategory::CentralCity => (0.40, 2.0),
        }
    }
    
    /// Get gradient height (m)
    pub fn gradient_height(&self) -> f64 {
        match self {
            TerrainCategory::Open => 274.0,
            TerrainCategory::Suburban => 366.0,
            TerrainCategory::Urban => 457.0,
            TerrainCategory::CentralCity => 549.0,
        }
    }
}

/// Directional wind distribution
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DirectionalDistribution {
    /// Wind speeds by direction (16 sectors, N, NNE, NE, ...)
    pub speeds: [f64; 16],
    /// Probabilities by direction
    pub probabilities: [f64; 16],
}

/// Wind design code
#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
pub enum WindDesignCode {
    /// ASCE 7-22
    ASCE7_22,
    /// EN 1991-1-4
    Eurocode1_4,
    /// AS/NZS 1170.2
    ASNZS1170_2,
    /// AIJ 2015
    AIJ2015,
    /// NBC Canada
    NBCC,
}

impl Default for WindClimate {
    fn default() -> Self {
        Self {
            location: "Generic".to_string(),
            v_basic: 40.0,
            terrain: TerrainCategory::Urban,
            directional: None,
            return_period: 50.0,
        }
    }
}

/// Wind performance results
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WindPerformanceResults {
    /// Peak base moment (kN·m)
    pub peak_base_moment: f64,
    /// Peak base shear (kN)
    pub peak_base_shear: f64,
    /// Peak displacement (mm)
    pub peak_displacement: f64,
    /// Peak acceleration (milli-g)
    pub peak_acceleration: f64,
    /// RMS acceleration (milli-g)
    pub rms_acceleration: f64,
    /// Along-wind response
    pub along_wind: WindResponse,
    /// Across-wind response
    pub across_wind: WindResponse,
    /// Torsional response
    pub torsional: Option<WindResponse>,
    /// Comfort assessment
    pub comfort: ComfortAssessment,
}

/// Wind response components
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WindResponse {
    /// Mean component
    pub mean: f64,
    /// Background (quasi-static) component
    pub background: f64,
    /// Resonant component
    pub resonant: f64,
    /// Peak factor
    pub peak_factor: f64,
    /// Total RMS
    pub rms_total: f64,
    /// Peak response
    pub peak: f64,
}

/// Occupant comfort assessment
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ComfortAssessment {
    /// 1-year return period acceleration (milli-g)
    pub accel_1yr: f64,
    /// 10-year return period acceleration (milli-g)
    pub accel_10yr: f64,
    /// Comfort criterion
    pub criterion: ComfortCriterion,
    /// Assessment result
    pub acceptable: bool,
    /// Perception threshold exceeded
    pub perceptible: bool,
}

/// Comfort criterion
#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
pub enum ComfortCriterion {
    /// ISO 10137
    ISO10137,
    /// AIJ 2004
    AIJ2004,
    /// CTBUH
    CTBUH,
    /// Melbourne & Palmer
    MelbournePalmer,
}

impl WindPerformanceAnalyzer {
    /// Create new analyzer
    pub fn new(building: BuildingAeroProperties, climate: WindClimate, code: WindDesignCode) -> Self {
        Self {
            building,
            climate,
            code,
            results: None,
        }
    }
    
    /// Calculate mean wind speed at height
    pub fn mean_wind_speed(&self, height: f64) -> f64 {
        let (alpha, _z0) = self.climate.terrain.parameters();
        let v_ref = self.climate.v_basic;
        
        // Power law profile
        v_ref * (height / 10.0).powf(alpha)
    }
    
    /// Calculate turbulence intensity at height
    pub fn turbulence_intensity(&self, height: f64) -> f64 {
        let (alpha, _z0) = self.climate.terrain.parameters();
        
        // Approximate formula
        let c = match self.climate.terrain {
            TerrainCategory::Open => 0.12,
            TerrainCategory::Suburban => 0.16,
            TerrainCategory::Urban => 0.20,
            TerrainCategory::CentralCity => 0.24,
        };
        
        c * (10.0 / height).powf(alpha / 2.0)
    }
    
    /// Calculate along-wind response (Davenport approach)
    pub fn along_wind_response(&self) -> WindResponse {
        let h = self.building.height;
        let b = self.building.width;
        let _d = self.building.depth;
        let n = self.building.freq_along;
        let zeta = self.building.damping_ratio;
        
        let v_h = self.mean_wind_speed(h);
        let i_h = self.turbulence_intensity(h);
        
        // Mean base moment
        let cd = 1.3; // Drag coefficient
        let rho_air = 1.225; // kg/m³
        let q_h = 0.5 * rho_air * v_h.powi(2);
        let m_mean = cd * q_h * b * h.powi(2) / 2.0 / 1e6; // kN·m
        
        // Background factor (B²)
        let l_h = 100.0 * (h / 10.0).powf(0.25); // Turbulence length scale
        let b_sq = 1.0 / (1.0 + 0.9 * ((b + h) / l_h).powf(0.63));
        
        // Resonance factor (R²)
        let reduced_freq = n * h / v_h;
        let s_l = 4.0 * reduced_freq / (1.0 + 70.9 * reduced_freq.powi(2)).powf(5.0/6.0);
        
        let eta_h = 4.6 * n * h / v_h;
        let eta_b = 4.6 * n * b / v_h;
        let r_h = if eta_h > 0.0 { 1.0 / eta_h - 1.0 / (2.0 * eta_h.powi(2)) * (1.0 - (-2.0 * eta_h).exp()) } else { 1.0 };
        let r_b = if eta_b > 0.0 { 1.0 / eta_b - 1.0 / (2.0 * eta_b.powi(2)) * (1.0 - (-2.0 * eta_b).exp()) } else { 1.0 };
        
        let r_sq = PI * s_l * r_h * r_b / (4.0 * zeta);
        
        // RMS and peak
        let sigma_m = m_mean * 2.0 * i_h * (b_sq + r_sq).sqrt();
        let g_v = (2.0 * (3600.0 * n).ln()).sqrt() + 0.5772 / (2.0 * (3600.0 * n).ln()).sqrt();
        let peak_factor = g_v;
        let m_peak = m_mean + peak_factor * sigma_m;
        
        WindResponse {
            mean: m_mean,
            background: m_mean * 2.0 * i_h * b_sq.sqrt(),
            resonant: m_mean * 2.0 * i_h * r_sq.sqrt(),
            peak_factor,
            rms_total: sigma_m,
            peak: m_peak,
        }
    }
    
    /// Calculate across-wind response (Karman vortex shedding)
    pub fn across_wind_response(&self) -> WindResponse {
        let h = self.building.height;
        let b = self.building.width;
        let _d = self.building.depth;
        let n = self.building.freq_across;
        let zeta = self.building.damping_ratio;
        let _m = self.building.generalized_mass;
        
        let v_h = self.mean_wind_speed(h);
        let rho_air = 1.225;
        
        // Strouhal number
        let st = 0.12; // Typical for rectangular sections
        let v_cr = n * b / st; // Critical velocity
        
        // Check if in lock-in range
        let _velocity_ratio = v_h / v_cr;
        
        // Spectral coefficient (empirical)
        let cm = 0.04; // Cross-wind force spectrum coefficient
        
        // Reduced velocity
        let v_star = v_h / (n * b);
        
        // Cross-wind force spectrum
        let s_cm = cm * v_star.powi(2) / (1.0 + (v_star / 5.0).powi(2)).powi(2);
        
        // RMS force coefficient
        let cl_rms = 0.3; // Typical for rectangular
        
        // RMS moment (simplified)
        let q_h = 0.5 * rho_air * v_h.powi(2);
        let sigma_m_cross = cl_rms * q_h * b * h.powi(2) / 2.0 / 1e6;
        
        // Resonant amplification
        let r_factor = 1.0 / (2.0 * zeta);
        let sigma_resonant = sigma_m_cross * r_factor.sqrt() * (s_cm / (4.0 * zeta)).sqrt();
        
        let g_v = (2.0 * (3600.0 * n).ln()).sqrt();
        let peak_factor = g_v;
        
        WindResponse {
            mean: 0.0, // No mean cross-wind
            background: sigma_m_cross,
            resonant: sigma_resonant,
            peak_factor,
            rms_total: (sigma_m_cross.powi(2) + sigma_resonant.powi(2)).sqrt(),
            peak: peak_factor * (sigma_m_cross.powi(2) + sigma_resonant.powi(2)).sqrt(),
        }
    }
    
    /// Calculate top floor acceleration
    pub fn peak_acceleration(&self) -> f64 {
        let _h = self.building.height;
        let m = self.building.generalized_mass;
        let n_across = self.building.freq_across;
        let _zeta = self.building.damping_ratio;
        
        // Use across-wind response (typically governs for tall buildings)
        let cross_response = self.across_wind_response();
        
        // Convert moment to displacement
        let omega = 2.0 * PI * n_across;
        
        // Simplified acceleration (milli-g)
        let sigma_a = cross_response.rms_total * 1e6 / m * omega.powi(2) / 9.81 * 1000.0;
        
        let g_v = cross_response.peak_factor;
        g_v * sigma_a
    }
    
    /// Assess occupant comfort (ISO 10137)
    pub fn assess_comfort(&self) -> ComfortAssessment {
        let peak_accel = self.peak_acceleration();
        
        // Convert 50-year to 1-year using Gumbel distribution
        let accel_1yr = peak_accel * 0.6; // Approximate factor
        let accel_10yr = peak_accel * 0.8;
        
        // ISO 10137 limits (1-year return period)
        let freq = self.building.freq_across;
        let limit_office = if freq < 1.0 {
            10.0 * freq.powf(-0.5) // milli-g
        } else {
            10.0
        };
        
        let acceptable = accel_1yr <= limit_office;
        let perceptible = accel_1yr > 5.0; // General perception threshold
        
        ComfortAssessment {
            accel_1yr,
            accel_10yr,
            criterion: ComfortCriterion::ISO10137,
            acceptable,
            perceptible,
        }
    }
    
    /// Run full analysis
    pub fn analyze(&mut self) -> &WindPerformanceResults {
        let along = self.along_wind_response();
        let across = self.across_wind_response();
        let comfort = self.assess_comfort();
        
        let peak_accel = self.peak_acceleration();
        let rms_accel = peak_accel / 3.5; // Approximate
        
        // Peak base shear (from moment)
        let peak_shear = along.peak * 1.5 / self.building.height * 1000.0; // kN
        
        // Peak displacement
        let omega = 2.0 * PI * self.building.freq_along;
        let peak_disp = along.peak * 1e6 / self.building.generalized_mass / omega.powi(2) * 1000.0;
        
        self.results = Some(WindPerformanceResults {
            peak_base_moment: along.peak.max(across.peak),
            peak_base_shear: peak_shear,
            peak_displacement: peak_disp.abs(),
            peak_acceleration: peak_accel,
            rms_acceleration: rms_accel,
            along_wind: along,
            across_wind: across,
            torsional: None,
            comfort,
        });
        
        self.results.as_ref().unwrap()
    }
}

/// Vortex shedding analyzer
#[derive(Debug, Clone)]
pub struct VortexSheddingAnalyzer {
    /// Cross-section shape
    pub shape: CrossSectionShape,
    /// Characteristic dimension (m)
    pub dimension: f64,
    /// Natural frequency (Hz)
    pub frequency: f64,
    /// Damping ratio
    pub damping: f64,
    /// Mass per unit length (kg/m)
    pub mass_per_length: f64,
}

/// Cross-section shape
#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
pub enum CrossSectionShape {
    /// Circular
    Circular,
    /// Square
    Square,
    /// Rectangular { depth/width ratio }
    Rectangular(f64),
    /// Hexagonal
    Hexagonal,
}

impl CrossSectionShape {
    /// Get Strouhal number
    pub fn strouhal_number(&self) -> f64 {
        match self {
            CrossSectionShape::Circular => 0.20,
            CrossSectionShape::Square => 0.12,
            CrossSectionShape::Rectangular(ratio) => {
                if *ratio < 1.0 { 0.12 }
                else if *ratio < 2.0 { 0.10 }
                else { 0.08 }
            }
            CrossSectionShape::Hexagonal => 0.15,
        }
    }
    
    /// Get lift coefficient RMS
    pub fn lift_coefficient_rms(&self) -> f64 {
        match self {
            CrossSectionShape::Circular => 0.3,
            CrossSectionShape::Square => 0.5,
            CrossSectionShape::Rectangular(ratio) => 0.3 + 0.2 * ratio.min(2.0),
            CrossSectionShape::Hexagonal => 0.35,
        }
    }
}

impl VortexSheddingAnalyzer {
    /// Create analyzer for circular section
    pub fn circular(diameter: f64, frequency: f64, damping: f64, mass_per_length: f64) -> Self {
        Self {
            shape: CrossSectionShape::Circular,
            dimension: diameter,
            frequency,
            damping,
            mass_per_length,
        }
    }
    
    /// Calculate critical velocity
    pub fn critical_velocity(&self) -> f64 {
        let st = self.shape.strouhal_number();
        self.frequency * self.dimension / st
    }
    
    /// Calculate Scruton number
    pub fn scruton_number(&self) -> f64 {
        let rho_air = 1.225;
        let m_star = self.mass_per_length / (rho_air * self.dimension.powi(2));
        2.0 * self.damping * m_star
    }
    
    /// Calculate lock-in range
    pub fn lock_in_range(&self) -> (f64, f64) {
        let v_cr = self.critical_velocity();
        let sc = self.scruton_number();
        
        // Lock-in range depends on Scruton number
        let bandwidth = 0.4 / (1.0 + 0.1 * sc);
        
        (v_cr * (1.0 - bandwidth), v_cr * (1.0 + bandwidth))
    }
    
    /// Calculate peak cross-wind displacement
    pub fn peak_displacement(&self, wind_speed: f64) -> f64 {
        let _v_cr = self.critical_velocity();
        let sc = self.scruton_number();
        
        // Check if in lock-in range
        let (v_min, v_max) = self.lock_in_range();
        
        if wind_speed < v_min || wind_speed > v_max {
            // Outside lock-in
            let cl_rms = self.shape.lift_coefficient_rms();
            let rho = 1.225;
            let q = 0.5 * rho * wind_speed.powi(2);
            
            // Broadband response
            let force_rms = cl_rms * q * self.dimension;
            let omega = 2.0 * PI * self.frequency;
            
            // RMS displacement
            let y_rms = force_rms / (self.mass_per_length * omega.powi(2)) 
                * (PI / (4.0 * self.damping)).sqrt();
            
            3.5 * y_rms // Peak factor
        } else {
            // Lock-in response
            let cl_max = 1.2 * self.shape.lift_coefficient_rms(); // Enhanced during lock-in
            let rho = 1.225;
            let _q = 0.5 * rho * wind_speed.powi(2);
            
            // EN 1991-1-4 approach
            let y_max = self.dimension * cl_max / (sc.max(0.1) * 4.0);
            
            y_max.min(0.1 * self.dimension) // Limit to 10% of dimension
        }
    }
}

/// Wind fatigue analyzer
#[derive(Debug, Clone)]
pub struct WindFatigueAnalyzer {
    /// S-N curve parameters
    pub sn_curve: SNcurve,
    /// Design life (years)
    pub design_life: f64,
    /// Stress concentration factor
    pub scf: f64,
}

/// S-N curve parameters
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SNcurve {
    /// Curve category
    pub category: String,
    /// Reference stress range at 2M cycles (MPa)
    pub delta_sigma_c: f64,
    /// Slope m
    pub m: f64,
    /// Cut-off stress (MPa)
    pub cut_off: f64,
}

impl SNcurve {
    /// Eurocode 3 Category 160
    pub fn ec3_160() -> Self {
        Self {
            category: "160".to_string(),
            delta_sigma_c: 160.0,
            m: 3.0,
            cut_off: 36.0,
        }
    }
    
    /// Eurocode 3 Category 90
    pub fn ec3_90() -> Self {
        Self {
            category: "90".to_string(),
            delta_sigma_c: 90.0,
            m: 3.0,
            cut_off: 20.0,
        }
    }
}

impl WindFatigueAnalyzer {
    /// Create analyzer
    pub fn new(sn_curve: SNcurve, design_life: f64) -> Self {
        Self {
            sn_curve,
            design_life,
            scf: 1.0,
        }
    }
    
    /// Calculate fatigue damage for stress range histogram
    pub fn calculate_damage(&self, stress_ranges: &[(f64, u64)]) -> f64 {
        let mut damage = 0.0;
        
        for &(delta_sigma, cycles) in stress_ranges {
            let effective_stress = delta_sigma * self.scf;
            
            if effective_stress >= self.sn_curve.cut_off {
                let n_f = 2e6 * (self.sn_curve.delta_sigma_c / effective_stress).powf(self.sn_curve.m);
                damage += cycles as f64 / n_f;
            }
        }
        
        damage
    }
    
    /// Calculate equivalent stress range
    pub fn equivalent_stress_range(&self, stress_ranges: &[(f64, u64)]) -> f64 {
        let total_cycles: u64 = stress_ranges.iter().map(|&(_, n)| n).sum();
        
        if total_cycles == 0 {
            return 0.0;
        }
        
        let sum: f64 = stress_ranges.iter()
            .map(|&(s, n)| n as f64 * s.powf(self.sn_curve.m))
            .sum();
        
        (sum / total_cycles as f64).powf(1.0 / self.sn_curve.m)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    
    #[test]
    fn test_building_creation() {
        let building = BuildingAeroProperties::typical_tall_building(200.0, 40.0, 40.0);
        
        assert!((building.freq_along - 0.23).abs() < 0.1);
        assert!(building.aspect_ratio() == 5.0);
    }
    
    #[test]
    fn test_terrain_parameters() {
        let (alpha, z0) = TerrainCategory::Urban.parameters();
        assert!((alpha - 0.33).abs() < 0.01);
    }
    
    #[test]
    fn test_mean_wind_speed() {
        let building = BuildingAeroProperties::typical_tall_building(200.0, 40.0, 40.0);
        let climate = WindClimate::default();
        let analyzer = WindPerformanceAnalyzer::new(building, climate, WindDesignCode::ASCE7_22);
        
        let v_200 = analyzer.mean_wind_speed(200.0);
        let v_10 = analyzer.mean_wind_speed(10.0);
        
        assert!(v_200 > v_10);
    }
    
    #[test]
    fn test_turbulence_intensity() {
        let building = BuildingAeroProperties::typical_tall_building(200.0, 40.0, 40.0);
        let climate = WindClimate::default();
        let analyzer = WindPerformanceAnalyzer::new(building, climate, WindDesignCode::ASCE7_22);
        
        let i_10 = analyzer.turbulence_intensity(10.0);
        let i_200 = analyzer.turbulence_intensity(200.0);
        
        assert!(i_10 > i_200); // Turbulence decreases with height
    }
    
    #[test]
    fn test_along_wind_response() {
        let building = BuildingAeroProperties::typical_tall_building(200.0, 40.0, 40.0);
        let climate = WindClimate::default();
        let analyzer = WindPerformanceAnalyzer::new(building, climate, WindDesignCode::ASCE7_22);
        
        let response = analyzer.along_wind_response();
        
        assert!(response.mean > 0.0);
        assert!(response.peak > response.mean);
    }
    
    #[test]
    fn test_across_wind_response() {
        let building = BuildingAeroProperties::typical_tall_building(200.0, 40.0, 40.0);
        let climate = WindClimate::default();
        let analyzer = WindPerformanceAnalyzer::new(building, climate, WindDesignCode::ASCE7_22);
        
        let response = analyzer.across_wind_response();
        
        assert!(response.mean == 0.0); // No mean cross-wind
        assert!(response.resonant > 0.0);
    }
    
    #[test]
    fn test_comfort_assessment() {
        let building = BuildingAeroProperties::typical_tall_building(200.0, 40.0, 40.0);
        let climate = WindClimate::default();
        let analyzer = WindPerformanceAnalyzer::new(building, climate, WindDesignCode::ASCE7_22);
        
        let comfort = analyzer.assess_comfort();
        
        assert!(comfort.accel_1yr > 0.0);
    }
    
    #[test]
    fn test_full_analysis() {
        let building = BuildingAeroProperties::typical_tall_building(200.0, 40.0, 40.0);
        let climate = WindClimate::default();
        let mut analyzer = WindPerformanceAnalyzer::new(building, climate, WindDesignCode::ASCE7_22);
        
        let results = analyzer.analyze();
        
        assert!(results.peak_base_moment > 0.0);
        assert!(results.peak_acceleration > 0.0);
    }
    
    #[test]
    fn test_strouhal_number() {
        let st_circ = CrossSectionShape::Circular.strouhal_number();
        let st_sq = CrossSectionShape::Square.strouhal_number();
        
        assert!((st_circ - 0.20).abs() < 0.01);
        assert!((st_sq - 0.12).abs() < 0.01);
    }
    
    #[test]
    fn test_vortex_critical_velocity() {
        let analyzer = VortexSheddingAnalyzer::circular(1.0, 1.0, 0.01, 100.0);
        let v_cr = analyzer.critical_velocity();
        
        // V_cr = f * D / St = 1.0 * 1.0 / 0.20 = 5.0
        assert!((v_cr - 5.0).abs() < 0.1);
    }
    
    #[test]
    fn test_scruton_number() {
        let analyzer = VortexSheddingAnalyzer::circular(1.0, 1.0, 0.01, 100.0);
        let sc = analyzer.scruton_number();
        
        assert!(sc > 0.0);
    }
    
    #[test]
    fn test_lock_in_range() {
        let analyzer = VortexSheddingAnalyzer::circular(1.0, 1.0, 0.01, 100.0);
        let (v_min, v_max) = analyzer.lock_in_range();
        
        assert!(v_min < v_max);
    }
    
    #[test]
    fn test_sn_curve() {
        let sn = SNcurve::ec3_160();
        assert_eq!(sn.delta_sigma_c, 160.0);
        assert_eq!(sn.m, 3.0);
    }
    
    #[test]
    fn test_fatigue_damage() {
        let analyzer = WindFatigueAnalyzer::new(SNcurve::ec3_160(), 50.0);
        
        let stress_ranges = vec![
            (50.0, 1000000),
            (100.0, 100000),
        ];
        
        let damage = analyzer.calculate_damage(&stress_ranges);
        assert!(damage > 0.0);
    }
    
    #[test]
    fn test_equivalent_stress() {
        let analyzer = WindFatigueAnalyzer::new(SNcurve::ec3_160(), 50.0);
        
        let stress_ranges = vec![
            (50.0, 1000),
            (100.0, 500),
        ];
        
        let eq_stress = analyzer.equivalent_stress_range(&stress_ranges);
        assert!(eq_stress > 50.0 && eq_stress < 100.0);
    }
    
    #[test]
    fn test_comfort_criteria() {
        assert_ne!(ComfortCriterion::ISO10137, ComfortCriterion::AIJ2004);
    }
    
    #[test]
    fn test_wind_codes() {
        assert_ne!(WindDesignCode::ASCE7_22, WindDesignCode::Eurocode1_4);
    }
}
