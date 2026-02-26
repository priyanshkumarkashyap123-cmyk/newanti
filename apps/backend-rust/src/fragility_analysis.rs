//! Fragility Analysis Module
//! 
//! Comprehensive fragility assessment for:
//! - Fragility curve development
//! - Damage state definitions
//! - Seismic fragility (HAZUS, FEMA P-58)
//! - Multi-hazard fragility
//! 
//! Standards: FEMA P-58, HAZUS, ATC-58, ASCE 41

#![allow(non_camel_case_types)]  // Intensity measures like Sa_03, Sa_10

use serde::{Deserialize, Serialize};
use std::f64::consts::PI;
use crate::special_functions::*;


fn standard_normal_inverse(p: f64) -> f64 {
    2.0_f64.sqrt() * crate::special_functions::erfinv(2.0 * p - 1.0)
}

/// Damage state definition
#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq, Hash)]
pub enum DamageState {
    /// No damage
    None,
    /// Slight damage - minor cracking
    Slight,
    /// Moderate damage - significant cracking
    Moderate,
    /// Extensive damage - severe damage
    Extensive,
    /// Complete damage - collapse imminent/occurred
    Complete,
}

impl DamageState {
    /// Get damage factor (0-1)
    pub fn damage_factor(&self) -> f64 {
        match self {
            DamageState::None => 0.0,
            DamageState::Slight => 0.02,
            DamageState::Moderate => 0.10,
            DamageState::Extensive => 0.40,
            DamageState::Complete => 1.00,
        }
    }
    
    /// Get repair cost ratio (approximate)
    pub fn repair_cost_ratio(&self) -> f64 {
        match self {
            DamageState::None => 0.0,
            DamageState::Slight => 0.02,
            DamageState::Moderate => 0.10,
            DamageState::Extensive => 0.50,
            DamageState::Complete => 1.00,
        }
    }
}

/// Fragility curve parameters (lognormal)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FragilityCurve {
    /// Damage state
    pub damage_state: DamageState,
    /// Median capacity (θ)
    pub median: f64,
    /// Dispersion (β - total uncertainty)
    pub dispersion: f64,
    /// Demand parameter type
    pub demand_type: DemandParameter,
}

/// Intensity measure / demand parameter
#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq)]
pub enum DemandParameter {
    /// Peak Ground Acceleration (g)
    PGA,
    /// Spectral Acceleration at T=0.3s (g)
    Sa_03,
    /// Spectral Acceleration at T=1.0s (g)
    Sa_10,
    /// Spectral Acceleration at fundamental period (g)
    Sa_T1,
    /// Peak Interstory Drift Ratio
    IDR,
    /// Peak Floor Acceleration (g)
    PFA,
    /// Peak Floor Velocity (m/s)
    PFV,
    /// Wind speed (m/s)
    WindSpeed,
    /// Flood depth (m)
    FloodDepth,
}

impl FragilityCurve {
    /// Create new fragility curve
    pub fn new(damage_state: DamageState, median: f64, dispersion: f64, demand_type: DemandParameter) -> Self {
        Self {
            damage_state,
            median,
            dispersion,
            demand_type,
        }
    }
    
    /// Calculate probability of exceeding damage state
    pub fn probability_of_exceedance(&self, demand: f64) -> f64 {
        if demand <= 0.0 {
            return 0.0;
        }
        
        let z = (demand / self.median).ln() / self.dispersion;
        standard_normal_cdf(z)
    }
    
    /// Calculate demand at given probability
    pub fn demand_at_probability(&self, prob: f64) -> f64 {
        let z = standard_normal_inverse(prob);
        self.median * (z * self.dispersion).exp()
    }
}

/// Standard normal CDF

/// Standard normal inverse CDF
/// Building type for HAZUS fragility
#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq)]
pub enum HAZUSBuildingType {
    /// Wood light frame
    W1,
    /// Wood commercial
    W2,
    /// Steel moment frame
    S1L, S1M, S1H,
    /// Steel braced frame
    S2L, S2M, S2H,
    /// Steel light frame
    S3,
    /// Steel frame with RC walls
    S4L, S4M, S4H,
    /// Steel frame with URM infill
    S5L, S5M, S5H,
    /// Concrete moment frame
    C1L, C1M, C1H,
    /// Concrete shear wall
    C2L, C2M, C2H,
    /// Concrete frame with URM infill
    C3L, C3M, C3H,
    /// Precast concrete tilt-up
    PC1,
    /// Precast concrete frame
    PC2L, PC2M, PC2H,
    /// Reinforced masonry
    RM1L, RM1M,
    /// Reinforced masonry bearing wall
    RM2L, RM2M, RM2H,
    /// Unreinforced masonry
    URML, URMM,
}

/// HAZUS fragility parameters
#[derive(Debug, Clone)]
pub struct HAZUSFragility;

impl HAZUSFragility {
    /// Get fragility curves for building type (code-compliant)
    pub fn get_curves(&self, building_type: HAZUSBuildingType) -> Vec<FragilityCurve> {
        // Representative values - actual HAZUS has extensive tables
        let (slight, moderate, extensive, complete) = match building_type {
            HAZUSBuildingType::W1 => {
                // Wood light frame - drift limits
                ((0.004, 0.64), (0.012, 0.64), (0.040, 0.64), (0.100, 0.64))
            }
            HAZUSBuildingType::S1L | HAZUSBuildingType::S1M | HAZUSBuildingType::S1H => {
                // Steel moment frame
                ((0.006, 0.64), (0.012, 0.64), (0.030, 0.64), (0.080, 0.64))
            }
            HAZUSBuildingType::C1L | HAZUSBuildingType::C1M | HAZUSBuildingType::C1H => {
                // Concrete moment frame
                ((0.005, 0.64), (0.010, 0.64), (0.025, 0.64), (0.060, 0.64))
            }
            HAZUSBuildingType::C2L | HAZUSBuildingType::C2M | HAZUSBuildingType::C2H => {
                // Concrete shear wall
                ((0.004, 0.64), (0.008, 0.64), (0.020, 0.64), (0.050, 0.64))
            }
            HAZUSBuildingType::URML | HAZUSBuildingType::URMM => {
                // Unreinforced masonry - most vulnerable
                ((0.002, 0.64), (0.005, 0.64), (0.012, 0.64), (0.028, 0.64))
            }
            _ => {
                // Default - moderate performance
                ((0.004, 0.64), (0.010, 0.64), (0.025, 0.64), (0.060, 0.64))
            }
        };
        
        vec![
            FragilityCurve::new(DamageState::Slight, slight.0, slight.1, DemandParameter::IDR),
            FragilityCurve::new(DamageState::Moderate, moderate.0, moderate.1, DemandParameter::IDR),
            FragilityCurve::new(DamageState::Extensive, extensive.0, extensive.1, DemandParameter::IDR),
            FragilityCurve::new(DamageState::Complete, complete.0, complete.1, DemandParameter::IDR),
        ]
    }
    
    /// Get Sa-based fragility curves
    pub fn get_sa_curves(&self, building_type: HAZUSBuildingType) -> Vec<FragilityCurve> {
        // Sa(T1) based fragility - representative values
        let (slight, moderate, extensive, complete) = match building_type {
            HAZUSBuildingType::W1 => {
                ((0.20, 0.65), (0.40, 0.65), (0.80, 0.65), (1.60, 0.65))
            }
            HAZUSBuildingType::S1L | HAZUSBuildingType::S1M | HAZUSBuildingType::S1H => {
                ((0.15, 0.65), (0.30, 0.65), (0.60, 0.65), (1.20, 0.65))
            }
            HAZUSBuildingType::C1L | HAZUSBuildingType::C1M | HAZUSBuildingType::C1H => {
                ((0.12, 0.65), (0.25, 0.65), (0.50, 0.65), (1.00, 0.65))
            }
            HAZUSBuildingType::URML | HAZUSBuildingType::URMM => {
                ((0.08, 0.65), (0.16, 0.65), (0.32, 0.65), (0.64, 0.65))
            }
            _ => {
                ((0.12, 0.65), (0.25, 0.65), (0.50, 0.65), (1.00, 0.65))
            }
        };
        
        vec![
            FragilityCurve::new(DamageState::Slight, slight.0, slight.1, DemandParameter::Sa_T1),
            FragilityCurve::new(DamageState::Moderate, moderate.0, moderate.1, DemandParameter::Sa_T1),
            FragilityCurve::new(DamageState::Extensive, extensive.0, extensive.1, DemandParameter::Sa_T1),
            FragilityCurve::new(DamageState::Complete, complete.0, complete.1, DemandParameter::Sa_T1),
        ]
    }
}

/// Component fragility (FEMA P-58)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ComponentFragility {
    /// Component category
    pub category: ComponentCategory,
    /// Component name
    pub name: String,
    /// Demand parameter
    pub demand_type: DemandParameter,
    /// Damage state fragilities
    pub damage_states: Vec<ComponentDamageState>,
}

/// Component category per FEMA P-58
#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq)]
pub enum ComponentCategory {
    /// Structural - columns, beams, walls
    Structural,
    /// Nonstructural drift-sensitive
    NSDriftSensitive,
    /// Nonstructural acceleration-sensitive
    NSAccelSensitive,
    /// Contents
    Contents,
}

/// Component damage state
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ComponentDamageState {
    /// Damage state number (1, 2, 3...)
    pub ds_number: u8,
    /// Description
    pub description: String,
    /// Median demand
    pub median: f64,
    /// Dispersion
    pub dispersion: f64,
    /// Repair cost per unit (median)
    pub repair_cost_median: f64,
    /// Repair cost dispersion
    pub repair_cost_dispersion: f64,
    /// Repair time per unit (days)
    pub repair_time_days: f64,
}

/// Fragility function generator
#[derive(Debug, Clone)]
pub struct FragilityGenerator;

impl FragilityGenerator {
    /// Generate fragility from test/analysis data using MLE
    pub fn generate_from_data(&self, data: &[FragilityDataPoint]) -> FragilityCurve {
        // Maximum Likelihood Estimation for lognormal fragility
        if data.is_empty() {
            return FragilityCurve::new(DamageState::Moderate, 1.0, 0.6, DemandParameter::PGA);
        }
        
        // Initial guess
        let mut median = data.iter().map(|d| d.demand).sum::<f64>() / data.len() as f64;
        let mut dispersion = 0.4;
        
        // Iterative MLE
        for _ in 0..100 {
            let mut sum_num = 0.0;
            let mut sum_den = 0.0;
            let mut sum_beta = 0.0;
            let mut count = 0;
            
            for point in data {
                let z = (point.demand / median).ln() / dispersion;
                let phi = standard_normal_cdf(z);
                let pdf = (-0.5 * z.powi(2)).exp() / (2.0 * PI).sqrt();
                
                if point.failed {
                    if phi > 1e-10 {
                        sum_num += (point.demand / median).ln() * pdf / (dispersion * phi);
                        sum_den += pdf / (dispersion * phi);
                        sum_beta += ((point.demand / median).ln().powi(2) - dispersion.powi(2)) * pdf / (dispersion * phi);
                    }
                } else {
                    let phi_c = 1.0 - phi;
                    if phi_c > 1e-10 {
                        sum_num -= (point.demand / median).ln() * pdf / (dispersion * phi_c);
                        sum_den -= pdf / (dispersion * phi_c);
                        sum_beta -= ((point.demand / median).ln().powi(2) - dispersion.powi(2)) * pdf / (dispersion * phi_c);
                    }
                }
                count += 1;
            }
            
            if sum_den.abs() > 1e-10 && count > 0 {
                let delta_ln_median = sum_num / sum_den;
                median *= (delta_ln_median * 0.1).exp(); // Damped update
                
                let delta_beta = sum_beta / count as f64;
                dispersion = (dispersion.powi(2) + delta_beta * 0.1).sqrt().max(0.1);
            }
        }
        
        FragilityCurve::new(DamageState::Moderate, median, dispersion.min(1.5), DemandParameter::PGA)
    }
    
    /// Generate from two known points
    pub fn generate_from_two_points(
        &self,
        demand1: f64,
        prob1: f64,
        demand2: f64,
        prob2: f64,
        damage_state: DamageState,
        demand_type: DemandParameter,
    ) -> FragilityCurve {
        let z1 = standard_normal_inverse(prob1);
        let z2 = standard_normal_inverse(prob2);
        
        let dispersion = (demand2.ln() - demand1.ln()) / (z2 - z1);
        let median = (demand1.ln() - z1 * dispersion).exp();
        
        FragilityCurve::new(damage_state, median, dispersion.abs(), demand_type)
    }
}

/// Data point for fragility fitting
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FragilityDataPoint {
    /// Demand value
    pub demand: f64,
    /// Did failure occur
    pub failed: bool,
}

/// Multi-hazard fragility analyzer
#[derive(Debug, Clone)]
pub struct MultiHazardFragility {
    /// Seismic fragility curves
    pub seismic: Vec<FragilityCurve>,
    /// Wind fragility curves
    pub wind: Vec<FragilityCurve>,
    /// Flood fragility curves
    pub flood: Vec<FragilityCurve>,
}

impl MultiHazardFragility {
    /// Create new multi-hazard fragility
    pub fn new() -> Self {
        Self {
            seismic: Vec::new(),
            wind: Vec::new(),
            flood: Vec::new(),
        }
    }
    
    /// Add seismic fragility
    pub fn add_seismic(&mut self, curve: FragilityCurve) {
        self.seismic.push(curve);
    }
    
    /// Add wind fragility
    pub fn add_wind(&mut self, curve: FragilityCurve) {
        self.wind.push(curve);
    }
    
    /// Add flood fragility
    pub fn add_flood(&mut self, curve: FragilityCurve) {
        self.flood.push(curve);
    }
    
    /// Calculate combined probability (assuming independence)
    pub fn combined_probability(&self, pga: f64, wind_speed: f64, flood_depth: f64, damage_state: DamageState) -> f64 {
        let p_seismic = self.seismic.iter()
            .find(|c| c.damage_state == damage_state)
            .map(|c| c.probability_of_exceedance(pga))
            .unwrap_or(0.0);
        
        let p_wind = self.wind.iter()
            .find(|c| c.damage_state == damage_state)
            .map(|c| c.probability_of_exceedance(wind_speed))
            .unwrap_or(0.0);
        
        let p_flood = self.flood.iter()
            .find(|c| c.damage_state == damage_state)
            .map(|c| c.probability_of_exceedance(flood_depth))
            .unwrap_or(0.0);
        
        // Union probability (independent events)
        1.0 - (1.0 - p_seismic) * (1.0 - p_wind) * (1.0 - p_flood)
    }
}

/// Fragility assessment result
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FragilityAssessmentResult {
    /// Damage state probabilities
    pub damage_probabilities: Vec<(DamageState, f64)>,
    /// Expected damage factor
    pub expected_damage_factor: f64,
    /// Expected repair cost ratio
    pub expected_repair_cost_ratio: f64,
    /// Most likely damage state
    pub most_likely_state: DamageState,
}

/// Fragility assessor
#[derive(Debug, Clone)]
pub struct FragilityAssessor;

impl FragilityAssessor {
    /// Assess damage state probabilities
    pub fn assess(&self, curves: &[FragilityCurve], demand: f64) -> FragilityAssessmentResult {
        // Get exceedance probabilities
        let mut exceedance_probs: Vec<(DamageState, f64)> = curves
            .iter()
            .map(|c| (c.damage_state, c.probability_of_exceedance(demand)))
            .collect();
        
        // Sort by damage state severity
        exceedance_probs.sort_by_key(|(ds, _)| *ds as u8);
        
        // Convert to state probabilities (discrete)
        let mut damage_probs = Vec::new();
        let mut _prev_prob = 1.0;
        
        // P(None) = 1 - P(Slight or worse)
        let p_slight_or_worse = exceedance_probs.iter()
            .find(|(ds, _)| *ds == DamageState::Slight)
            .map(|(_, p)| *p)
            .unwrap_or(0.0);
        damage_probs.push((DamageState::None, 1.0 - p_slight_or_worse));
        _prev_prob = p_slight_or_worse;
        
        // For each state: P(state) = P(state or worse) - P(worse)
        for i in 0..exceedance_probs.len() {
            let (ds, p_exceed) = exceedance_probs[i];
            let next_exceed = if i + 1 < exceedance_probs.len() {
                exceedance_probs[i + 1].1
            } else {
                0.0
            };
            
            let p_state = p_exceed - next_exceed;
            damage_probs.push((ds, p_state.max(0.0)));
        }
        
        // Calculate expected values
        let mut expected_damage = 0.0;
        let mut expected_cost = 0.0;
        let mut max_prob = 0.0;
        let mut most_likely = DamageState::None;
        
        for (ds, prob) in &damage_probs {
            expected_damage += ds.damage_factor() * prob;
            expected_cost += ds.repair_cost_ratio() * prob;
            
            if *prob > max_prob {
                max_prob = *prob;
                most_likely = *ds;
            }
        }
        
        FragilityAssessmentResult {
            damage_probabilities: damage_probs,
            expected_damage_factor: expected_damage,
            expected_repair_cost_ratio: expected_cost,
            most_likely_state: most_likely,
        }
    }
}

/// Wind fragility for structures
#[derive(Debug, Clone)]
pub struct WindFragility;

impl WindFragility {
    /// Get wind fragility curves for building type
    pub fn get_curves(&self, roof_type: RoofType, terrain: TerrainCategory) -> Vec<FragilityCurve> {
        // Wind speed at damage threshold (3-second gust, m/s)
        let factor = match terrain {
            TerrainCategory::Open => 1.0,
            TerrainCategory::Suburban => 1.15,
            TerrainCategory::Urban => 1.30,
        };
        
        let (slight, moderate, extensive, complete) = match roof_type {
            RoofType::Gable => {
                ((25.0 * factor, 0.20), (35.0 * factor, 0.20), (50.0 * factor, 0.20), (70.0 * factor, 0.20))
            }
            RoofType::Hip => {
                ((30.0 * factor, 0.20), (40.0 * factor, 0.20), (55.0 * factor, 0.20), (75.0 * factor, 0.20))
            }
            RoofType::Flat => {
                ((28.0 * factor, 0.25), (38.0 * factor, 0.25), (52.0 * factor, 0.25), (72.0 * factor, 0.25))
            }
        };
        
        vec![
            FragilityCurve::new(DamageState::Slight, slight.0, slight.1, DemandParameter::WindSpeed),
            FragilityCurve::new(DamageState::Moderate, moderate.0, moderate.1, DemandParameter::WindSpeed),
            FragilityCurve::new(DamageState::Extensive, extensive.0, extensive.1, DemandParameter::WindSpeed),
            FragilityCurve::new(DamageState::Complete, complete.0, complete.1, DemandParameter::WindSpeed),
        ]
    }
}

/// Roof type for wind fragility
#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq)]
pub enum RoofType {
    Gable,
    Hip,
    Flat,
}

/// Terrain category
#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq)]
pub enum TerrainCategory {
    Open,
    Suburban,
    Urban,
}

/// Flood fragility
#[derive(Debug, Clone)]
pub struct FloodFragility;

impl FloodFragility {
    /// Get flood fragility curves (depth-damage)
    pub fn get_curves(&self, foundation_type: FoundationType) -> Vec<FragilityCurve> {
        // Flood depth at damage threshold (m)
        let base_elevation = match foundation_type {
            FoundationType::SlabOnGrade => 0.0,
            FoundationType::CrawlSpace => 0.6,
            FoundationType::Basement => -2.4,
            FoundationType::Elevated => 2.4,
        };
        
        vec![
            FragilityCurve::new(DamageState::Slight, base_elevation + 0.3, 0.30, DemandParameter::FloodDepth),
            FragilityCurve::new(DamageState::Moderate, base_elevation + 0.9, 0.30, DemandParameter::FloodDepth),
            FragilityCurve::new(DamageState::Extensive, base_elevation + 1.8, 0.30, DemandParameter::FloodDepth),
            FragilityCurve::new(DamageState::Complete, base_elevation + 3.0, 0.30, DemandParameter::FloodDepth),
        ]
    }
}

/// Foundation type for flood fragility
#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq)]
pub enum FoundationType {
    SlabOnGrade,
    CrawlSpace,
    Basement,
    Elevated,
}

#[cfg(test)]
mod tests {
    use super::*;
    
    #[test]
    fn test_fragility_curve_probability() {
        let curve = FragilityCurve::new(DamageState::Moderate, 0.5, 0.4, DemandParameter::PGA);
        
        // At median, probability should be 50%
        let prob_median = curve.probability_of_exceedance(0.5);
        assert!((prob_median - 0.5).abs() < 0.01);
        
        // Below median, probability < 50%
        let prob_low = curve.probability_of_exceedance(0.3);
        assert!(prob_low < 0.5);
        
        // Above median, probability > 50%
        let prob_high = curve.probability_of_exceedance(0.8);
        assert!(prob_high > 0.5);
    }
    
    #[test]
    fn test_fragility_curve_demand() {
        let curve = FragilityCurve::new(DamageState::Moderate, 0.5, 0.4, DemandParameter::PGA);
        
        // Demand at 50% should be median
        let demand_50 = curve.demand_at_probability(0.5);
        assert!((demand_50 - 0.5).abs() < 0.01);
        
        // Demand at 16% should be about median * exp(-beta)
        let demand_16 = curve.demand_at_probability(0.16);
        assert!(demand_16 < 0.5);
    }
    
    #[test]
    fn test_damage_state_factors() {
        assert_eq!(DamageState::None.damage_factor(), 0.0);
        assert_eq!(DamageState::Complete.damage_factor(), 1.0);
        
        // Increasing damage factors
        assert!(DamageState::Slight.damage_factor() < DamageState::Moderate.damage_factor());
        assert!(DamageState::Moderate.damage_factor() < DamageState::Extensive.damage_factor());
    }
    
    #[test]
    fn test_hazus_fragility() {
        let hazus = HAZUSFragility;
        
        let curves = hazus.get_curves(HAZUSBuildingType::C1M);
        
        assert_eq!(curves.len(), 4);
        
        // Check ordering (slight < moderate < extensive < complete)
        assert!(curves[0].median < curves[1].median);
        assert!(curves[1].median < curves[2].median);
        assert!(curves[2].median < curves[3].median);
    }
    
    #[test]
    fn test_urm_more_vulnerable() {
        let hazus = HAZUSFragility;
        
        let urm_curves = hazus.get_curves(HAZUSBuildingType::URML);
        let concrete_curves = hazus.get_curves(HAZUSBuildingType::C1M);
        
        // URM should have lower median (more vulnerable)
        assert!(urm_curves[1].median < concrete_curves[1].median);
    }
    
    #[test]
    fn test_fragility_generator_two_points() {
        let generator = FragilityGenerator;
        
        // If 16% failure at 0.3g and 84% at 0.7g
        let curve = generator.generate_from_two_points(
            0.3, 0.16,
            0.7, 0.84,
            DamageState::Moderate,
            DemandParameter::PGA,
        );
        
        // Median should be between the two points
        assert!(curve.median > 0.3 && curve.median < 0.7);
        
        // Check probabilities at input points
        let prob1 = curve.probability_of_exceedance(0.3);
        let prob2 = curve.probability_of_exceedance(0.7);
        assert!((prob1 - 0.16).abs() < 0.05);
        assert!((prob2 - 0.84).abs() < 0.05);
    }
    
    #[test]
    fn test_fragility_assessor() {
        let assessor = FragilityAssessor;
        
        let curves = vec![
            FragilityCurve::new(DamageState::Slight, 0.2, 0.4, DemandParameter::PGA),
            FragilityCurve::new(DamageState::Moderate, 0.4, 0.4, DemandParameter::PGA),
            FragilityCurve::new(DamageState::Extensive, 0.6, 0.4, DemandParameter::PGA),
            FragilityCurve::new(DamageState::Complete, 0.8, 0.4, DemandParameter::PGA),
        ];
        
        // Low demand - most likely no damage
        let result_low = assessor.assess(&curves, 0.1);
        assert!(result_low.expected_damage_factor < 0.1);
        
        // High demand - significant damage expected
        let result_high = assessor.assess(&curves, 0.7);
        assert!(result_high.expected_damage_factor > result_low.expected_damage_factor);
    }
    
    #[test]
    fn test_multi_hazard() {
        let mut mh = MultiHazardFragility::new();
        
        mh.add_seismic(FragilityCurve::new(DamageState::Moderate, 0.4, 0.4, DemandParameter::PGA));
        mh.add_wind(FragilityCurve::new(DamageState::Moderate, 40.0, 0.2, DemandParameter::WindSpeed));
        mh.add_flood(FragilityCurve::new(DamageState::Moderate, 1.0, 0.3, DemandParameter::FloodDepth));
        
        // Combined probability should be higher than individual
        let p_seismic_only = mh.combined_probability(0.4, 0.0, 0.0, DamageState::Moderate);
        let p_combined = mh.combined_probability(0.4, 40.0, 1.0, DamageState::Moderate);
        
        assert!(p_combined >= p_seismic_only);
    }
    
    #[test]
    fn test_wind_fragility() {
        let wind = WindFragility;
        
        let gable_curves = wind.get_curves(RoofType::Gable, TerrainCategory::Open);
        let hip_curves = wind.get_curves(RoofType::Hip, TerrainCategory::Open);
        
        // Hip roof should be less vulnerable (higher median)
        assert!(hip_curves[1].median > gable_curves[1].median);
    }
    
    #[test]
    fn test_flood_fragility() {
        let flood = FloodFragility;
        
        let slab_curves = flood.get_curves(FoundationType::SlabOnGrade);
        let elevated_curves = flood.get_curves(FoundationType::Elevated);
        
        // Elevated foundation should be less vulnerable (higher median)
        assert!(elevated_curves[1].median > slab_curves[1].median);
    }
    
    #[test]
    fn test_component_fragility() {
        let component = ComponentFragility {
            category: ComponentCategory::Structural,
            name: "RC Column".to_string(),
            demand_type: DemandParameter::IDR,
            damage_states: vec![
                ComponentDamageState {
                    ds_number: 1,
                    description: "Hairline cracks".to_string(),
                    median: 0.005,
                    dispersion: 0.4,
                    repair_cost_median: 5000.0,
                    repair_cost_dispersion: 0.3,
                    repair_time_days: 2.0,
                },
                ComponentDamageState {
                    ds_number: 2,
                    description: "Spalling".to_string(),
                    median: 0.015,
                    dispersion: 0.4,
                    repair_cost_median: 20000.0,
                    repair_cost_dispersion: 0.4,
                    repair_time_days: 10.0,
                },
            ],
        };
        
        assert_eq!(component.category, ComponentCategory::Structural);
        assert_eq!(component.damage_states.len(), 2);
    }
}
