// ============================================================================
// PERFORMANCE-BASED DESIGN - Multi-Hazard, Risk Assessment
// Performance-Based Wind, Fire, Seismic, Multi-Hazard Analysis
// ============================================================================

use serde::{Deserialize, Serialize};
use std::f64::consts::PI;
use crate::special_functions::erf;

// ============================================================================
// PERFORMANCE LEVELS
// ============================================================================

/// Structural performance levels
#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
pub enum PerformanceLevel {
    /// Immediate Occupancy (IO)
    ImmediateOccupancy,
    /// Damage Control (DC)
    DamageControl,
    /// Life Safety (LS)
    LifeSafety,
    /// Collapse Prevention (CP)
    CollapsePrevention,
    /// Fully Operational (FO)
    FullyOperational,
}

impl PerformanceLevel {
    /// Drift limit for each level
    pub fn drift_limit(&self) -> f64 {
        match self {
            PerformanceLevel::FullyOperational => 0.002,
            PerformanceLevel::ImmediateOccupancy => 0.007,
            PerformanceLevel::DamageControl => 0.015,
            PerformanceLevel::LifeSafety => 0.025,
            PerformanceLevel::CollapsePrevention => 0.04,
        }
    }
    
    /// Damage description
    pub fn damage_description(&self) -> &'static str {
        match self {
            PerformanceLevel::FullyOperational => "No damage, building fully functional",
            PerformanceLevel::ImmediateOccupancy => "Minor damage, safe for immediate occupancy",
            PerformanceLevel::DamageControl => "Moderate damage, repairable",
            PerformanceLevel::LifeSafety => "Significant damage, life safety maintained",
            PerformanceLevel::CollapsePrevention => "Near collapse, structural integrity marginal",
        }
    }
}

/// Hazard level
#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
pub struct HazardLevel {
    /// Return period (years)
    pub return_period: f64,
    /// Probability of exceedance in 50 years
    pub probability_50yr: f64,
    /// Intensity measure
    pub intensity: f64,
}

impl HazardLevel {
    /// Service Level Earthquake (SLE)
    pub fn sle() -> Self {
        Self {
            return_period: 72.0,
            probability_50yr: 0.50,
            intensity: 0.0,
        }
    }
    
    /// Design Basis Earthquake (DBE)
    pub fn dbe() -> Self {
        Self {
            return_period: 475.0,
            probability_50yr: 0.10,
            intensity: 0.0,
        }
    }
    
    /// Maximum Considered Earthquake (MCE)
    pub fn mce() -> Self {
        Self {
            return_period: 2475.0,
            probability_50yr: 0.02,
            intensity: 0.0,
        }
    }
    
    /// Convert return period to annual probability
    pub fn annual_probability(&self) -> f64 {
        1.0 / self.return_period
    }
    
    /// Probability to return period
    pub fn from_probability_50yr(prob: f64) -> Self {
        let rp = -50.0 / (1.0 - prob).ln();
        Self {
            return_period: rp,
            probability_50yr: prob,
            intensity: 0.0,
        }
    }
}

// ============================================================================
// PERFORMANCE-BASED SEISMIC DESIGN
// ============================================================================

/// Seismic performance objective
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SeismicPerformanceObjective {
    pub hazard: HazardLevel,
    pub target_performance: PerformanceLevel,
}

/// Performance-based seismic design
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PbSeismicDesign {
    /// Building parameters
    pub height: f64,           // m
    pub period: f64,           // s
    pub importance_factor: f64,
    pub ductility: f64,
    
    /// Performance objectives
    pub objectives: Vec<SeismicPerformanceObjective>,
    
    /// Hazard curve parameters
    pub k0: f64, // Scale parameter
    pub k: f64,  // Shape parameter
}

impl PbSeismicDesign {
    pub fn new(height: f64, period: f64) -> Self {
        Self {
            height,
            period,
            importance_factor: 1.0,
            ductility: 4.0,
            objectives: vec![
                SeismicPerformanceObjective {
                    hazard: HazardLevel::sle(),
                    target_performance: PerformanceLevel::ImmediateOccupancy,
                },
                SeismicPerformanceObjective {
                    hazard: HazardLevel::dbe(),
                    target_performance: PerformanceLevel::LifeSafety,
                },
                SeismicPerformanceObjective {
                    hazard: HazardLevel::mce(),
                    target_performance: PerformanceLevel::CollapsePrevention,
                },
            ],
            k0: 0.0025,
            k: 3.0,
        }
    }
    
    /// Spectral acceleration at hazard level
    pub fn spectral_acceleration(&self, hazard: &HazardLevel) -> f64 {
        self.k0 * hazard.return_period.powf(1.0 / self.k)
    }
    
    /// Expected drift at hazard level
    pub fn expected_drift(&self, sa: f64) -> f64 {
        // Simplified drift estimate
        let c_d = 4.0; // Deflection amplification
        let h = self.height;
        
        c_d * sa * 9.81 * self.period.powi(2) / (4.0 * PI.powi(2) * h)
    }
    
    /// Check performance objective
    pub fn check_objective(&self, obj: &SeismicPerformanceObjective) -> (bool, f64, f64) {
        let sa = self.spectral_acceleration(&obj.hazard);
        let drift = self.expected_drift(sa);
        let limit = obj.target_performance.drift_limit();
        
        (drift <= limit, drift, limit)
    }
    
    /// Check all objectives
    pub fn check_all_objectives(&self) -> Vec<(String, bool, f64, f64)> {
        self.objectives.iter()
            .map(|obj| {
                let (ok, drift, limit) = self.check_objective(obj);
                let name = format!(
                    "{:.0}yr return - {:?}",
                    obj.hazard.return_period,
                    obj.target_performance
                );
                (name, ok, drift, limit)
            })
            .collect()
    }
    
    /// Mean annual frequency of exceeding performance level
    pub fn maf_exceedance(&self, pl: PerformanceLevel) -> f64 {
        let drift_limit = pl.drift_limit();
        
        // Simplified fragility-based calculation
        let beta: f64 = 0.4; // Dispersion
        let sa_capacity = drift_limit * self.height * 4.0 * PI.powi(2) 
            / (4.0 * 9.81 * self.period.powi(2));
        
        // Integrate hazard curve with fragility
        self.k0 / sa_capacity.powf(self.k) * (0.5 * self.k * beta.powi(2)).exp()
    }
    
    /// Collapse probability in 50 years
    pub fn collapse_probability_50yr(&self) -> f64 {
        let maf = self.maf_exceedance(PerformanceLevel::CollapsePrevention);
        1.0 - (-maf * 50.0).exp()
    }
}

// ============================================================================
// PERFORMANCE-BASED WIND DESIGN
// ============================================================================

/// Wind performance criteria
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WindPerformanceCriteria {
    /// Peak acceleration limit (mg)
    pub acceleration_limit: f64,
    /// Drift limit
    pub drift_limit: f64,
    /// Return period (years)
    pub return_period: f64,
}

impl WindPerformanceCriteria {
    /// Serviceability (human comfort)
    pub fn serviceability() -> Self {
        Self {
            acceleration_limit: 15.0, // mg (10-year return)
            drift_limit: 0.002,       // H/500
            return_period: 10.0,
        }
    }
    
    /// Design wind (strength)
    pub fn design_strength() -> Self {
        Self {
            acceleration_limit: 50.0,
            drift_limit: 0.004, // H/250
            return_period: 50.0,
        }
    }
    
    /// Extreme wind (ultimate)
    pub fn extreme() -> Self {
        Self {
            acceleration_limit: 100.0,
            drift_limit: 0.010,
            return_period: 700.0,
        }
    }
}

/// Performance-based wind design
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PbWindDesign {
    pub height: f64,          // m
    pub width: f64,           // m (across wind)
    pub depth: f64,           // m (along wind)
    pub period_x: f64,        // s
    pub period_y: f64,        // s
    pub damping_ratio: f64,
    pub terrain_category: u8, // 1-4
    pub basic_wind_speed: f64, // m/s (3s gust)
}

impl PbWindDesign {
    pub fn new(height: f64, width: f64, depth: f64) -> Self {
        Self {
            height,
            width,
            depth,
            period_x: 0.1 * height.powf(0.75),
            period_y: 0.1 * height.powf(0.75),
            damping_ratio: 0.01,
            terrain_category: 2,
            basic_wind_speed: 40.0,
        }
    }
    
    /// Wind speed at return period
    pub fn wind_speed(&self, return_period: f64) -> f64 {
        // Type I Gumbel distribution
        let v10 = self.basic_wind_speed; // 10-year basic
        let cv = 0.15; // Coefficient of variation
        
        // Reduced variate: y = -ln(-ln(1 - 1/T))
        let y = -(-((1.0 - 1.0 / return_period).ln())).ln();
        let y10: f64 = -(-((1.0 - 1.0 / 10.0_f64).ln())).ln();
        
        v10 * (1.0 + cv * 0.78 * (y - y10))
    }
    
    /// Reference pressure (Pa)
    pub fn reference_pressure(&self, return_period: f64) -> f64 {
        let v = self.wind_speed(return_period);
        0.5 * 1.225 * v.powi(2)
    }
    
    /// Along-wind response (simplified gust factor approach)
    pub fn along_wind_response(&self, criteria: &WindPerformanceCriteria) -> (f64, f64) {
        let q = self.reference_pressure(criteria.return_period);
        
        // Gust factor
        let gust_factor = 2.0; // Simplified
        
        // Base shear coefficient
        let cf = 1.3; // Drag coefficient
        
        // Mean displacement at top
        let f_mean = cf * q * self.width * self.height;
        let k_approx = 4.0 * PI.powi(2) * 1e6 / self.period_x.powi(2); // Approximate stiffness
        
        let mean_drift = f_mean * gust_factor / k_approx / self.height;
        
        // Peak acceleration (simplified)
        let peak_acc = 0.5 * gust_factor * q * self.width / (1e6 * self.height) * 1000.0; // mg
        
        (mean_drift, peak_acc)
    }
    
    /// Across-wind response (vortex shedding)
    pub fn across_wind_response(&self, criteria: &WindPerformanceCriteria) -> (f64, f64) {
        let v = self.wind_speed(criteria.return_period);
        
        // Strouhal number
        let st = 0.10;
        
        // Vortex shedding frequency
        let f_vs = st * v / self.width;
        let f_n = 1.0 / self.period_y;
        
        // Resonance check
        let response_factor = if (f_vs - f_n).abs() / f_n < 0.2 {
            1.0 / (2.0 * self.damping_ratio) // Near resonance
        } else {
            1.0 / ((1.0 - (f_vs / f_n).powi(2)).powi(2) + (2.0 * self.damping_ratio * f_vs / f_n).powi(2)).sqrt()
        };
        
        // Simplified response
        let cl_rms = 0.3; // Lift coefficient RMS
        let q = self.reference_pressure(criteria.return_period);
        
        let rms_force = cl_rms * q * self.depth * self.height;
        let peak_factor = 3.5;
        
        let drift = peak_factor * response_factor * rms_force / (4.0 * PI.powi(2) / self.period_y.powi(2) * 1e6) / self.height;
        let acc = peak_factor * response_factor * rms_force / 1e6 * 1000.0; // mg
        
        (drift.min(0.02), acc.min(100.0))
    }
    
    /// Check wind performance
    pub fn check_performance(&self, criteria: &WindPerformanceCriteria) -> WindPerformanceResult {
        let (along_drift, along_acc) = self.along_wind_response(criteria);
        let (across_drift, across_acc) = self.across_wind_response(criteria);
        
        let max_drift = along_drift.max(across_drift);
        let max_acc = along_acc.max(across_acc);
        
        WindPerformanceResult {
            criteria: criteria.clone(),
            along_wind_drift: along_drift,
            across_wind_drift: across_drift,
            peak_acceleration: max_acc,
            drift_ok: max_drift <= criteria.drift_limit,
            acceleration_ok: max_acc <= criteria.acceleration_limit,
        }
    }
}

/// Wind performance check result
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WindPerformanceResult {
    pub criteria: WindPerformanceCriteria,
    pub along_wind_drift: f64,
    pub across_wind_drift: f64,
    pub peak_acceleration: f64,
    pub drift_ok: bool,
    pub acceleration_ok: bool,
}

// ============================================================================
// PERFORMANCE-BASED FIRE DESIGN
// ============================================================================

/// Fire severity
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum FireSeverity {
    /// Light fire load
    Light,
    /// Medium fire load
    Medium,
    /// Heavy fire load
    Heavy,
    /// Hydrocarbon fire
    Hydrocarbon,
}

impl FireSeverity {
    /// Fire load density (MJ/m²)
    pub fn fire_load(&self) -> f64 {
        match self {
            FireSeverity::Light => 300.0,
            FireSeverity::Medium => 600.0,
            FireSeverity::Heavy => 1200.0,
            FireSeverity::Hydrocarbon => 2000.0,
        }
    }
}

/// Fire performance level
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum FirePerformanceLevel {
    /// Life safety - occupant evacuation
    LifeSafety,
    /// Property protection
    PropertyProtection,
    /// Structural stability
    StructuralStability,
    /// Continuous operation
    ContinuousOperation,
}

/// Performance-based fire design
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PbFireDesign {
    pub compartment_area: f64,     // m²
    pub compartment_height: f64,    // m
    pub opening_factor: f64,        // m^0.5
    pub fire_load: f64,             // MJ/m²
    pub structural_fire_resistance: f64, // minutes
}

impl PbFireDesign {
    pub fn new(area: f64, height: f64, severity: FireSeverity) -> Self {
        Self {
            compartment_area: area,
            compartment_height: height,
            opening_factor: 0.04,
            fire_load: severity.fire_load(),
            structural_fire_resistance: 60.0,
        }
    }
    
    /// Equivalent fire duration (Eurocode parametric)
    pub fn equivalent_fire_duration(&self) -> f64 {
        // Simplified parametric fire
        let q_td = self.fire_load * self.compartment_area;
        let at = self.compartment_area * (1.0 + 2.0 * self.compartment_height / self.compartment_area.sqrt());
        
        // t_eq = q_td / (O * sqrt(b))
        let b: f64 = 1500.0; // Thermal inertia (average)
        
        q_td / (self.opening_factor * b.sqrt() * at) * 0.13
    }
    
    /// Maximum gas temperature (°C)
    pub fn max_gas_temperature(&self) -> f64 {
        // Simplified: Eurocode parametric fire max
        1325.0 * (1.0 - 0.324 * (-0.2 * self.opening_factor * self.compartment_area.sqrt()).exp())
    }
    
    /// Required fire resistance rating (minutes)
    pub fn required_fire_resistance(&self) -> f64 {
        let t_eq = self.equivalent_fire_duration();
        
        // Round up to standard rating
        if t_eq <= 30.0 { 30.0 }
        else if t_eq <= 60.0 { 60.0 }
        else if t_eq <= 90.0 { 90.0 }
        else if t_eq <= 120.0 { 120.0 }
        else { 180.0 }
    }
    
    /// Check structural adequacy
    pub fn check_structural(&self) -> bool {
        self.structural_fire_resistance >= self.required_fire_resistance()
    }
    
    /// Steel temperature at time t (simplified)
    pub fn steel_temperature(&self, time_min: f64, section_factor: f64) -> f64 {
        // Section factor Am/V in 1/m
        // Simplified lumped capacitance with ISO fire
        
        let t_gas = 20.0 + 345.0 * (8.0 * time_min + 1.0).log10();
        let factor = section_factor / 1500.0; // Normalized
        
        20.0 + (t_gas - 20.0) * (1.0 - (-factor * time_min).exp())
    }
    
    /// Steel strength reduction at temperature
    pub fn steel_strength_reduction(&self, temperature: f64) -> f64 {
        // Eurocode 3 reduction factors
        if temperature <= 400.0 {
            1.0
        } else if temperature <= 500.0 {
            1.0 - 0.22 * (temperature - 400.0) / 100.0
        } else if temperature <= 600.0 {
            0.78 - 0.31 * (temperature - 500.0) / 100.0
        } else if temperature <= 700.0 {
            0.47 - 0.24 * (temperature - 600.0) / 100.0
        } else if temperature <= 800.0 {
            0.23 - 0.12 * (temperature - 700.0) / 100.0
        } else {
            0.11 - 0.05 * (temperature - 800.0) / 100.0
        }.max(0.0)
    }
}

// ============================================================================
// MULTI-HAZARD ANALYSIS
// ============================================================================

/// Multi-hazard scenario
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MultiHazardScenario {
    pub seismic_intensity: f64,   // PGA (g)
    pub wind_speed: f64,          // m/s
    pub flood_depth: f64,         // m
    pub fire_intensity: f64,      // MW
    pub combined_probability: f64,
}

impl MultiHazardScenario {
    pub fn new() -> Self {
        Self {
            seismic_intensity: 0.0,
            wind_speed: 0.0,
            flood_depth: 0.0,
            fire_intensity: 0.0,
            combined_probability: 1.0,
        }
    }
    
    /// Set seismic
    pub fn with_seismic(mut self, pga: f64, probability: f64) -> Self {
        self.seismic_intensity = pga;
        self.combined_probability *= probability;
        self
    }
    
    /// Set wind
    pub fn with_wind(mut self, speed: f64, probability: f64) -> Self {
        self.wind_speed = speed;
        self.combined_probability *= probability;
        self
    }
}

/// Multi-hazard risk assessment
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MultiHazardRisk {
    pub scenarios: Vec<MultiHazardScenario>,
    pub consequences: Vec<ConsequenceFunction>,
}

/// Consequence function
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConsequenceFunction {
    pub name: String,
    pub damage_function: DamageFunction,
    pub replacement_cost: f64, // $
}

/// Damage function type
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum DamageFunction {
    /// Linear damage function
    Linear { threshold: f64, max_intensity: f64 },
    /// Lognormal fragility
    Lognormal { median: f64, beta: f64 },
    /// Step function
    Step { threshold: f64 },
}

impl DamageFunction {
    /// Damage ratio (0-1) at intensity
    pub fn damage_ratio(&self, intensity: f64) -> f64 {
        match self {
            DamageFunction::Linear { threshold, max_intensity } => {
                if intensity < *threshold {
                    0.0
                } else if intensity > *max_intensity {
                    1.0
                } else {
                    (intensity - threshold) / (max_intensity - threshold)
                }
            }
            DamageFunction::Lognormal { median, beta } => {
                // Standard normal CDF approximation
                let z = (intensity / median).ln() / beta;
                0.5 * (1.0 + erf(z / 2.0_f64.sqrt()))
            }
            DamageFunction::Step { threshold } => {
                if intensity >= *threshold { 1.0 } else { 0.0 }
            }
        }
    }
}

impl MultiHazardRisk {
    pub fn new() -> Self {
        Self {
            scenarios: Vec::new(),
            consequences: Vec::new(),
        }
    }
    
    /// Add scenario
    pub fn add_scenario(&mut self, scenario: MultiHazardScenario) {
        self.scenarios.push(scenario);
    }
    
    /// Add consequence function
    pub fn add_consequence(&mut self, consequence: ConsequenceFunction) {
        self.consequences.push(consequence);
    }
    
    /// Expected annual loss
    pub fn expected_annual_loss(&self) -> f64 {
        let mut eal = 0.0;
        
        for scenario in &self.scenarios {
            for consequence in &self.consequences {
                let dr = consequence.damage_function.damage_ratio(scenario.seismic_intensity);
                let loss = dr * consequence.replacement_cost;
                eal += loss * scenario.combined_probability;
            }
        }
        
        eal
    }
    
    /// Loss exceedance curve
    pub fn loss_exceedance(&self, loss_levels: &[f64]) -> Vec<f64> {
        loss_levels.iter()
            .map(|&l| {
                self.scenarios.iter()
                    .map(|s| {
                        let total_loss: f64 = self.consequences.iter()
                            .map(|c| c.damage_function.damage_ratio(s.seismic_intensity) * c.replacement_cost)
                            .sum();
                        
                        if total_loss >= l { s.combined_probability } else { 0.0 }
                    })
                    .sum()
            })
            .collect()
    }
}

// ============================================================================
// TESTS
// ============================================================================

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_performance_levels() {
        assert!(PerformanceLevel::ImmediateOccupancy.drift_limit() < 
                PerformanceLevel::LifeSafety.drift_limit());
    }

    #[test]
    fn test_hazard_levels() {
        let sle = HazardLevel::sle();
        let dbe = HazardLevel::dbe();
        
        assert!(sle.return_period < dbe.return_period);
        assert!(sle.probability_50yr > dbe.probability_50yr);
    }

    #[test]
    fn test_pb_seismic() {
        let pbs = PbSeismicDesign::new(30.0, 1.5);
        
        let results = pbs.check_all_objectives();
        assert!(!results.is_empty());
    }

    #[test]
    fn test_collapse_probability() {
        let pbs = PbSeismicDesign::new(30.0, 1.5);
        
        let pc = pbs.collapse_probability_50yr();
        assert!(pc >= 0.0 && pc <= 1.0);
    }

    #[test]
    fn test_wind_criteria() {
        let service = WindPerformanceCriteria::serviceability();
        let design = WindPerformanceCriteria::design_strength();
        
        assert!(service.return_period < design.return_period);
        assert!(service.acceleration_limit < design.acceleration_limit);
    }

    #[test]
    fn test_pb_wind() {
        let pbw = PbWindDesign::new(200.0, 50.0, 50.0);
        
        let result = pbw.check_performance(&WindPerformanceCriteria::serviceability());
        
        assert!(result.along_wind_drift > 0.0);
        assert!(result.peak_acceleration > 0.0);
    }

    #[test]
    fn test_wind_speed_return_period() {
        let pbw = PbWindDesign::new(100.0, 40.0, 40.0);
        
        let v10 = pbw.wind_speed(10.0);
        let v50 = pbw.wind_speed(50.0);
        let v100 = pbw.wind_speed(100.0);
        
        assert!(v50 > v10);
        assert!(v100 > v50);
    }

    #[test]
    fn test_fire_design() {
        let fire = PbFireDesign::new(200.0, 3.0, FireSeverity::Medium);
        
        let t_eq = fire.equivalent_fire_duration();
        let t_max = fire.max_gas_temperature();
        
        assert!(t_eq > 0.0);
        assert!(t_max > 500.0);
    }

    #[test]
    fn test_steel_temperature() {
        let fire = PbFireDesign::new(100.0, 3.0, FireSeverity::Heavy);
        
        let temp_30 = fire.steel_temperature(30.0, 200.0);
        let temp_60 = fire.steel_temperature(60.0, 200.0);
        
        assert!(temp_60 > temp_30);
    }

    #[test]
    fn test_strength_reduction() {
        let fire = PbFireDesign::new(100.0, 3.0, FireSeverity::Medium);
        
        let k_400 = fire.steel_strength_reduction(400.0);
        let k_600 = fire.steel_strength_reduction(600.0);
        
        assert!(k_400 > k_600);
        assert!((k_400 - 1.0).abs() < 0.01);
    }

    #[test]
    fn test_damage_function() {
        let linear = DamageFunction::Linear { threshold: 0.1, max_intensity: 0.5 };
        let lognormal = DamageFunction::Lognormal { median: 0.3, beta: 0.4 };
        
        let dr_linear = linear.damage_ratio(0.3);
        let dr_log = lognormal.damage_ratio(0.3);
        
        assert!(dr_linear > 0.0 && dr_linear < 1.0);
        assert!(dr_log > 0.0 && dr_log < 1.0);
    }

    #[test]
    fn test_multi_hazard() {
        let mut risk = MultiHazardRisk::new();
        
        risk.add_scenario(
            MultiHazardScenario::new()
                .with_seismic(0.3, 0.01)
        );
        
        risk.add_consequence(ConsequenceFunction {
            name: "Structural".to_string(),
            damage_function: DamageFunction::Lognormal { median: 0.4, beta: 0.5 },
            replacement_cost: 10_000_000.0,
        });
        
        let eal = risk.expected_annual_loss();
        assert!(eal > 0.0);
    }

    #[test]
    fn test_seismic_spectral() {
        let pbs = PbSeismicDesign::new(50.0, 2.0);
        
        let sa_dbe = pbs.spectral_acceleration(&HazardLevel::dbe());
        let sa_mce = pbs.spectral_acceleration(&HazardLevel::mce());
        
        assert!(sa_mce > sa_dbe);
    }
}
