//! # Fatigue Analysis Module
//! 
//! Comprehensive fatigue assessment per international codes:
//! - Eurocode 3 Part 1-9 (EN 1993-1-9:2005)
//! - AISC Design Guide 27
//! - BS 7608:2014
//! - IIW Recommendations
//!
//! Critical for: bridges, cranes, offshore platforms, wind turbines

use serde::{Deserialize, Serialize};
use std::f64::consts::PI;
use crate::special_functions::gamma as gamma_function;

// ============================================================================
// FATIGUE CONSTANTS AND TABLES
// ============================================================================

/// S-N curve detail categories per EN 1993-1-9
#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
pub enum DetailCategory {
    /// Parent material, rolled/extruded sections
    Cat160,
    Cat140,
    Cat125,
    Cat112,
    Cat100,
    /// Welded details
    Cat90,
    Cat80,
    Cat71,
    Cat63,
    Cat56,
    Cat50,
    Cat45,
    Cat40,
    Cat36,
    /// Very severe details
    Cat32,
    Cat28,
    Cat25,
}

impl DetailCategory {
    /// Reference stress range at 2 million cycles (MPa)
    pub fn delta_sigma_c(&self) -> f64 {
        match self {
            Self::Cat160 => 160.0,
            Self::Cat140 => 140.0,
            Self::Cat125 => 125.0,
            Self::Cat112 => 112.0,
            Self::Cat100 => 100.0,
            Self::Cat90 => 90.0,
            Self::Cat80 => 80.0,
            Self::Cat71 => 71.0,
            Self::Cat63 => 63.0,
            Self::Cat56 => 56.0,
            Self::Cat50 => 50.0,
            Self::Cat45 => 45.0,
            Self::Cat40 => 40.0,
            Self::Cat36 => 36.0,
            Self::Cat32 => 32.0,
            Self::Cat28 => 28.0,
            Self::Cat25 => 25.0,
        }
    }
    
    /// Constant amplitude fatigue limit (CAFL) at 5 million cycles
    pub fn delta_sigma_d(&self) -> f64 {
        // ΔσD = 0.737 × ΔσC for m=3
        self.delta_sigma_c() * 0.737
    }
    
    /// Cut-off limit at 100 million cycles
    pub fn delta_sigma_l(&self) -> f64 {
        // ΔσL = 0.549 × ΔσD for m=5
        self.delta_sigma_d() * 0.549
    }
    
    /// Slope for N < 5×10^6
    pub fn m1(&self) -> f64 {
        3.0
    }
    
    /// Slope for 5×10^6 < N < 10^8
    pub fn m2(&self) -> f64 {
        5.0
    }
}

/// Weld detail type for automatic category selection
#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
pub enum WeldDetail {
    /// Butt weld, full penetration, ground flush
    ButtWeldGroundFlush,
    /// Butt weld, full penetration, as-welded
    ButtWeldAsWelded,
    /// Fillet weld, load-carrying
    FilletWeldLoadCarrying,
    /// Fillet weld, non-load-carrying
    FilletWeldNonLoadCarrying,
    /// Cruciform joint, full penetration
    CruciformFullPen,
    /// Cruciform joint, partial penetration
    CruciformPartialPen,
    /// Transverse attachment, L < 50mm
    TransverseAttachmentShort,
    /// Transverse attachment, L > 100mm
    TransverseAttachmentLong,
    /// Longitudinal attachment
    LongitudinalAttachment,
    /// Cover plate end, tapered
    CoverPlateEndTapered,
    /// Cover plate end, not tapered
    CoverPlateEndSquare,
    /// Stiffener on flange
    StiffenerOnFlange,
    /// Cope hole
    CopeHole,
    /// Bolt hole (for slip-critical)
    BoltHole,
}

impl WeldDetail {
    /// Get the detail category
    pub fn category(&self) -> DetailCategory {
        match self {
            Self::ButtWeldGroundFlush => DetailCategory::Cat112,
            Self::ButtWeldAsWelded => DetailCategory::Cat90,
            Self::FilletWeldLoadCarrying => DetailCategory::Cat63,
            Self::FilletWeldNonLoadCarrying => DetailCategory::Cat80,
            Self::CruciformFullPen => DetailCategory::Cat71,
            Self::CruciformPartialPen => DetailCategory::Cat50,
            Self::TransverseAttachmentShort => DetailCategory::Cat80,
            Self::TransverseAttachmentLong => DetailCategory::Cat56,
            Self::LongitudinalAttachment => DetailCategory::Cat56,
            Self::CoverPlateEndTapered => DetailCategory::Cat71,
            Self::CoverPlateEndSquare => DetailCategory::Cat50,
            Self::StiffenerOnFlange => DetailCategory::Cat80,
            Self::CopeHole => DetailCategory::Cat71,
            Self::BoltHole => DetailCategory::Cat112,
        }
    }
}

// ============================================================================
// STRESS RANGE CALCULATION
// ============================================================================

/// Stress cycle from loading
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StressCycle {
    /// Maximum stress (MPa)
    pub sigma_max: f64,
    /// Minimum stress (MPa)
    pub sigma_min: f64,
    /// Number of cycles
    pub n_cycles: u64,
}

impl StressCycle {
    pub fn new(sigma_max: f64, sigma_min: f64, n_cycles: u64) -> Self {
        Self { sigma_max, sigma_min, n_cycles }
    }
    
    /// Stress range
    pub fn delta_sigma(&self) -> f64 {
        (self.sigma_max - self.sigma_min).abs()
    }
    
    /// Mean stress
    pub fn sigma_mean(&self) -> f64 {
        (self.sigma_max + self.sigma_min) / 2.0
    }
    
    /// Stress ratio R = σmin/σmax
    pub fn stress_ratio(&self) -> f64 {
        if self.sigma_max.abs() > 1e-10 {
            self.sigma_min / self.sigma_max
        } else {
            0.0
        }
    }
}

/// Stress history for rainflow counting
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StressHistory {
    /// Time points
    pub time: Vec<f64>,
    /// Stress values (MPa)
    pub stress: Vec<f64>,
}

impl StressHistory {
    pub fn new(time: Vec<f64>, stress: Vec<f64>) -> Self {
        Self { time, stress }
    }
    
    /// Rainflow cycle counting algorithm (ASTM E1049-85)
    pub fn rainflow_count(&self) -> Vec<StressCycle> {
        if self.stress.len() < 3 {
            return Vec::new();
        }
        
        // Extract peaks and valleys
        let extrema = self.extract_extrema();
        if extrema.len() < 3 {
            return Vec::new();
        }
        
        // Rainflow counting
        let mut cycles = Vec::new();
        let mut residue: Vec<f64> = Vec::new();
        
        for &s in &extrema {
            residue.push(s);
            
            while residue.len() >= 4 {
                let n = residue.len();
                let s0 = residue[n - 4];
                let s1 = residue[n - 3];
                let s2 = residue[n - 2];
                let s3 = residue[n - 1];
                
                let range_a = (s1 - s0).abs();
                let range_b = (s2 - s1).abs();
                let range_c = (s3 - s2).abs();
                
                if range_b <= range_a && range_b <= range_c {
                    // Found a cycle
                    let sigma_max = s1.max(s2);
                    let sigma_min = s1.min(s2);
                    cycles.push(StressCycle::new(sigma_max, sigma_min, 1));
                    
                    // Remove the cycle from residue
                    residue.remove(n - 3);
                    residue.remove(n - 3);
                } else {
                    break;
                }
            }
        }
        
        // Process residue as half cycles
        for window in residue.windows(2) {
            let sigma_max = window[0].max(window[1]);
            let sigma_min = window[0].min(window[1]);
            // Count as half cycles (0.5) - we'll consolidate later
            cycles.push(StressCycle::new(sigma_max, sigma_min, 1));
        }
        
        cycles
    }
    
    /// Extract peaks and valleys from stress history
    fn extract_extrema(&self) -> Vec<f64> {
        if self.stress.len() < 2 {
            return self.stress.clone();
        }
        
        let mut extrema = Vec::new();
        extrema.push(self.stress[0]);
        
        for i in 1..self.stress.len() - 1 {
            let prev = self.stress[i - 1];
            let curr = self.stress[i];
            let next = self.stress[i + 1];
            
            // Check if local maximum or minimum
            if (curr > prev && curr > next) || (curr < prev && curr < next) {
                extrema.push(curr);
            }
        }
        
        extrema.push(*self.stress.last().unwrap());
        extrema
    }
}

// ============================================================================
// FATIGUE DAMAGE CALCULATION
// ============================================================================

/// Fatigue assessment result
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FatigueResult {
    /// Detail category used
    pub detail_category: DetailCategory,
    /// Total damage (Miner's sum)
    pub total_damage: f64,
    /// Design life consumed (%)
    pub life_consumed_percent: f64,
    /// Remaining life (years)
    pub remaining_life_years: f64,
    /// Critical stress range (MPa)
    pub critical_stress_range: f64,
    /// Governing load case
    pub governing_case: String,
    /// Pass/fail status
    pub status: FatigueStatus,
    /// Detailed cycle damages
    pub cycle_damages: Vec<CycleDamage>,
}

#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
pub enum FatigueStatus {
    Pass,
    Warning,  // 0.8 < D < 1.0
    Fail,
}

/// Damage contribution from a single cycle type
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CycleDamage {
    pub stress_range: f64,
    pub cycle_count: u64,
    pub allowable_cycles: f64,
    pub damage_fraction: f64,
}

/// Fatigue assessor using Miner's rule
pub struct FatigueAssessor {
    /// Detail category
    pub category: DetailCategory,
    /// Partial safety factor for fatigue (γMf)
    pub gamma_mf: f64,
    /// Partial safety factor for stress (γFf)
    pub gamma_ff: f64,
    /// Design life in years
    pub design_life_years: f64,
    /// Cycles per year (for equivalent damage)
    pub cycles_per_year: f64,
}

impl FatigueAssessor {
    /// Create new assessor with Eurocode defaults
    pub fn new(category: DetailCategory) -> Self {
        Self {
            category,
            gamma_mf: 1.35,  // Damage tolerant design
            gamma_ff: 1.0,
            design_life_years: 50.0,
            cycles_per_year: 2e6,  // ~2 million cycles/year for bridges
        }
    }
    
    /// Set safety factors per consequence class
    pub fn with_safety_factors(mut self, gamma_mf: f64, gamma_ff: f64) -> Self {
        self.gamma_mf = gamma_mf;
        self.gamma_ff = gamma_ff;
        self
    }
    
    /// Set design life
    pub fn with_design_life(mut self, years: f64, cycles_per_year: f64) -> Self {
        self.design_life_years = years;
        self.cycles_per_year = cycles_per_year;
        self
    }
    
    /// Calculate allowable cycles for a stress range (N-Δσ relationship)
    pub fn allowable_cycles(&self, delta_sigma: f64) -> f64 {
        let delta_sigma_r = delta_sigma * self.gamma_ff / self.gamma_mf;
        let delta_sigma_c = self.category.delta_sigma_c();
        let delta_sigma_d = self.category.delta_sigma_d();
        let delta_sigma_l = self.category.delta_sigma_l();
        
        if delta_sigma_r <= delta_sigma_l {
            // Below cut-off: infinite life
            f64::INFINITY
        } else if delta_sigma_r <= delta_sigma_d {
            // CAFL to cut-off region (slope m=5)
            let n_d = 5e6;
            n_d * (delta_sigma_d / delta_sigma_r).powf(5.0)
        } else {
            // Above CAFL (slope m=3)
            let n_c = 2e6;
            n_c * (delta_sigma_c / delta_sigma_r).powf(3.0)
        }
    }
    
    /// Assess fatigue damage from stress cycles
    pub fn assess(&self, cycles: &[StressCycle]) -> FatigueResult {
        let mut total_damage = 0.0;
        let mut cycle_damages = Vec::new();
        let mut max_stress_range = 0.0;
        
        for cycle in cycles {
            let delta_sigma = cycle.delta_sigma();
            let n = cycle.n_cycles as f64;
            let n_allowable = self.allowable_cycles(delta_sigma);
            
            let damage = if n_allowable.is_infinite() {
                0.0
            } else {
                n / n_allowable
            };
            
            total_damage += damage;
            
            if delta_sigma > max_stress_range {
                max_stress_range = delta_sigma;
            }
            
            cycle_damages.push(CycleDamage {
                stress_range: delta_sigma,
                cycle_count: cycle.n_cycles,
                allowable_cycles: n_allowable,
                damage_fraction: damage,
            });
        }
        
        let life_consumed = total_damage * 100.0;
        let remaining_life = if total_damage > 0.0 {
            self.design_life_years * (1.0 - total_damage) / total_damage
        } else {
            f64::INFINITY
        };
        
        let status = if total_damage <= 0.8 {
            FatigueStatus::Pass
        } else if total_damage <= 1.0 {
            FatigueStatus::Warning
        } else {
            FatigueStatus::Fail
        };
        
        FatigueResult {
            detail_category: self.category,
            total_damage,
            life_consumed_percent: life_consumed,
            remaining_life_years: remaining_life.min(1000.0),
            critical_stress_range: max_stress_range,
            governing_case: "Combined".to_string(),
            status,
            cycle_damages,
        }
    }
    
    /// Equivalent constant amplitude stress range
    pub fn equivalent_stress_range(&self, cycles: &[StressCycle]) -> f64 {
        let mut sum_ni_sigma_m = 0.0;
        let mut sum_ni = 0.0;
        let m = 3.0;  // Slope
        
        for cycle in cycles {
            let ni = cycle.n_cycles as f64;
            let sigma = cycle.delta_sigma();
            sum_ni_sigma_m += ni * sigma.powf(m);
            sum_ni += ni;
        }
        
        if sum_ni > 0.0 {
            (sum_ni_sigma_m / sum_ni).powf(1.0 / m)
        } else {
            0.0
        }
    }
}

// ============================================================================
// STRESS CONCENTRATION FACTORS
// ============================================================================

/// Stress concentration factor calculator
pub struct StressConcentration;

impl StressConcentration {
    /// SCF for circular hole in plate under tension
    pub fn circular_hole(d: f64, w: f64) -> f64 {
        // Peterson's formula
        let ratio = d / w;
        if ratio < 0.5 {
            3.0 - 3.13 * ratio + 3.66 * ratio.powi(2) - 1.53 * ratio.powi(3)
        } else {
            3.0  // Fallback
        }
    }
    
    /// SCF for fillet weld toe
    pub fn fillet_weld_toe(t: f64, l: f64, theta_deg: f64) -> f64 {
        // IIW formula
        let theta = theta_deg * PI / 180.0;
        let m_k = 0.8 * (t / l).powf(0.27) * theta.powf(0.22);
        1.0 + m_k
    }
    
    /// SCF for butt weld misalignment
    pub fn butt_weld_misalignment(e: f64, t: f64) -> f64 {
        // e = eccentricity, t = plate thickness
        1.0 + 3.0 * e / t
    }
    
    /// SCF for cover plate end
    pub fn cover_plate_end(t_flange: f64, t_cover: f64, w_taper: f64) -> f64 {
        // Simplified formula
        let ratio = t_cover / t_flange;
        if w_taper > 0.0 {
            1.5 + 0.5 * ratio  // Tapered
        } else {
            2.0 + ratio  // Square end
        }
    }
}

// ============================================================================
// BRIDGE-SPECIFIC FATIGUE (EN 1991-2)
// ============================================================================

/// Bridge traffic fatigue assessment
pub struct BridgeFatigueAssessment {
    /// Traffic category
    pub traffic_category: TrafficCategory,
    /// Span length (m)
    pub span: f64,
    /// Number of slow lanes
    pub n_lanes: u32,
}

#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
pub enum TrafficCategory {
    /// Long distance, heavy traffic
    Category1,
    /// Medium distance traffic
    Category2,
    /// Local traffic, light
    Category3,
    /// Local traffic, very light
    Category4,
}

impl TrafficCategory {
    /// Annual traffic volume (millions of vehicles)
    pub fn n_obs_per_year(&self) -> f64 {
        match self {
            Self::Category1 => 2.0,
            Self::Category2 => 0.5,
            Self::Category3 => 0.125,
            Self::Category4 => 0.05,
        }
    }
    
    /// Average vehicle weight (kN)
    pub fn q_m1(&self) -> f64 {
        match self {
            Self::Category1 => 480.0,
            Self::Category2 => 400.0,
            Self::Category3 => 320.0,
            Self::Category4 => 280.0,
        }
    }
}

impl BridgeFatigueAssessment {
    pub fn new(traffic: TrafficCategory, span: f64, n_lanes: u32) -> Self {
        Self {
            traffic_category: traffic,
            span,
            n_lanes,
        }
    }
    
    /// Lambda factor for damage equivalent
    pub fn lambda_factor(&self) -> f64 {
        // λ = λ1 × λ2 × λ3 × λ4
        self.lambda_1() * self.lambda_2() * self.lambda_3() * self.lambda_4()
    }
    
    /// λ1 - Damage effect of traffic
    fn lambda_1(&self) -> f64 {
        // Depends on influence line shape - simplified for midspan moment
        if self.span <= 10.0 {
            2.55
        } else if self.span <= 20.0 {
            2.0 + 0.55 * (20.0 - self.span) / 10.0
        } else if self.span <= 50.0 {
            1.7 + 0.3 * (50.0 - self.span) / 30.0
        } else {
            1.7
        }
    }
    
    /// λ2 - Traffic volume effect
    fn lambda_2(&self) -> f64 {
        let n_obs = self.traffic_category.n_obs_per_year();
        let q_m1 = self.traffic_category.q_m1();
        
        // Reference: 2 million trucks/year, Qm = 480kN
        ((n_obs / 2.0) * (q_m1 / 480.0).powi(5)).powf(0.2)
    }
    
    /// λ3 - Design life effect
    fn lambda_3(&self) -> f64 {
        // Assuming 100-year design life (reference)
        1.0
    }
    
    /// λ4 - Multi-lane effect
    fn lambda_4(&self) -> f64 {
        match self.n_lanes {
            1 => 1.0,
            2 => 0.9,
            _ => 0.85,
        }
    }
    
    /// Fatigue load model stress
    pub fn fatigue_load_stress(&self, influence_value: f64, section_modulus: f64) -> f64 {
        // FLM3: Single vehicle of 480kN
        let q_fat = 480.0;  // kN
        let moment = q_fat * influence_value * self.lambda_factor();
        moment / section_modulus
    }
}

// ============================================================================
// OFFSHORE FATIGUE (DNV STANDARDS)
// ============================================================================

/// Offshore fatigue assessment per DNV-RP-C203
pub struct OffshoreFatigueAssessment {
    /// SCF (stress concentration factor)
    pub scf: f64,
    /// Design fatigue factor (DFF)
    pub dff: f64,
    /// S-N curve type
    pub sn_curve: OffshoreSnCurve,
    /// In seawater with cathodic protection
    pub in_seawater: bool,
}

#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
pub enum OffshoreSnCurve {
    /// Welded joints in air
    B1Air,
    C1Air,
    D,
    E,
    F,
    F1,
    F3,
    G,
    W1,
    W2,
    W3,
    /// Seawater curves
    DSea,
    ESea,
}

impl OffshoreSnCurve {
    /// Get S-N curve parameters (log_a, m)
    pub fn parameters(&self) -> (f64, f64, f64, f64) {
        // (log_a1, m1, log_a2, m2) for bi-linear curve
        match self {
            Self::B1Air => (15.117, 4.0, 17.146, 5.0),
            Self::C1Air => (14.717, 3.5, 16.786, 4.5),
            Self::D => (12.164, 3.0, 15.606, 5.0),
            Self::E => (12.010, 3.0, 15.350, 5.0),
            Self::F => (11.855, 3.0, 15.091, 5.0),
            Self::F1 => (11.699, 3.0, 14.832, 5.0),
            Self::F3 => (11.546, 3.0, 14.576, 5.0),
            Self::G => (11.398, 3.0, 14.330, 5.0),
            Self::W1 => (11.261, 3.0, 14.101, 5.0),
            Self::W2 => (11.107, 3.0, 13.825, 5.0),
            Self::W3 => (10.970, 3.0, 13.617, 5.0),
            Self::DSea => (11.764, 3.0, 15.606, 5.0),
            Self::ESea => (11.610, 3.0, 15.350, 5.0),
        }
    }
    
    /// Cycles at transition point
    pub fn n_transition(&self) -> f64 {
        1e7  // 10 million cycles
    }
}

impl OffshoreFatigueAssessment {
    pub fn new(sn_curve: OffshoreSnCurve, scf: f64, dff: f64) -> Self {
        Self {
            scf,
            dff,
            sn_curve,
            in_seawater: false,
        }
    }
    
    /// Calculate allowable cycles
    pub fn allowable_cycles(&self, stress_range: f64) -> f64 {
        let hot_spot_stress = stress_range * self.scf;
        let (log_a1, m1, log_a2, m2) = self.sn_curve.parameters();
        
        // Check which segment of bi-linear curve
        let n_trans = self.sn_curve.n_transition();
        let sigma_trans = 10.0_f64.powf((log_a1 - n_trans.log10()) / m1);
        
        let n = if hot_spot_stress > sigma_trans {
            10.0_f64.powf(log_a1 - m1 * hot_spot_stress.log10())
        } else {
            10.0_f64.powf(log_a2 - m2 * hot_spot_stress.log10())
        };
        
        n / self.dff
    }
    
    /// Damage from Weibull distribution
    pub fn weibull_damage(&self, sigma_0: f64, h: f64, n0: f64) -> f64 {
        // σ_0 = scale parameter, h = shape parameter, n0 = total cycles
        let (log_a, m, _, _) = self.sn_curve.parameters();
        
        // Analytical solution for Weibull spectrum
        // D = n0 / 10^log_a × σ_0^m × Γ(1 + m/h)
        let gamma_val = gamma_function(1.0 + m / h);
        
        n0 * (self.scf * sigma_0).powf(m) * gamma_val / (10.0_f64.powf(log_a) / self.dff)
    }
}

// ============================================================================
// TESTS
// ============================================================================

#[cfg(test)]
mod tests {
    use super::*;
    
    #[test]
    fn test_detail_category_values() {
        let cat = DetailCategory::Cat71;
        assert!((cat.delta_sigma_c() - 71.0).abs() < 0.01);
        assert!((cat.delta_sigma_d() - 52.33).abs() < 0.1);
    }
    
    #[test]
    fn test_weld_detail_categories() {
        assert_eq!(WeldDetail::ButtWeldGroundFlush.category(), DetailCategory::Cat112);
        assert_eq!(WeldDetail::FilletWeldLoadCarrying.category(), DetailCategory::Cat63);
    }
    
    #[test]
    fn test_stress_cycle() {
        let cycle = StressCycle::new(100.0, -50.0, 1000);
        assert!((cycle.delta_sigma() - 150.0).abs() < 0.01);
        assert!((cycle.sigma_mean() - 25.0).abs() < 0.01);
        assert!((cycle.stress_ratio() - (-0.5)).abs() < 0.01);
    }
    
    #[test]
    fn test_rainflow_counting() {
        let history = StressHistory::new(
            vec![0.0, 1.0, 2.0, 3.0, 4.0, 5.0],
            vec![0.0, 100.0, 50.0, 80.0, 30.0, 60.0],
        );
        
        let cycles = history.rainflow_count();
        assert!(!cycles.is_empty());
    }
    
    #[test]
    fn test_fatigue_assessment() {
        let assessor = FatigueAssessor::new(DetailCategory::Cat71);
        
        let cycles = vec![
            StressCycle::new(60.0, 0.0, 1_000_000),
            StressCycle::new(40.0, 0.0, 5_000_000),
        ];
        
        let result = assessor.assess(&cycles);
        assert!(result.total_damage > 0.0);
        assert!(result.total_damage < 10.0);  // Should be reasonable
    }
    
    #[test]
    fn test_allowable_cycles() {
        let assessor = FatigueAssessor::new(DetailCategory::Cat71);
        
        // At reference (71 MPa, 2 million cycles)
        let n_ref = assessor.allowable_cycles(71.0);
        assert!(n_ref > 1e6 && n_ref < 1e7);
        
        // Higher stress = fewer cycles
        let n_high = assessor.allowable_cycles(100.0);
        assert!(n_high < n_ref);
        
        // Below cut-off = infinite
        let n_low = assessor.allowable_cycles(10.0);
        assert!(n_low > 1e10);
    }
    
    #[test]
    fn test_equivalent_stress_range() {
        let assessor = FatigueAssessor::new(DetailCategory::Cat71);
        
        let cycles = vec![
            StressCycle::new(80.0, 0.0, 1000),
            StressCycle::new(60.0, 0.0, 2000),
            StressCycle::new(40.0, 0.0, 4000),
        ];
        
        let eq_stress = assessor.equivalent_stress_range(&cycles);
        // Should be between max and min
        assert!(eq_stress > 40.0 && eq_stress < 80.0);
    }
    
    #[test]
    fn test_stress_concentration() {
        let scf = StressConcentration::circular_hole(10.0, 100.0);
        assert!(scf > 2.5 && scf < 3.5);
    }
    
    #[test]
    fn test_bridge_fatigue() {
        let bridge = BridgeFatigueAssessment::new(
            TrafficCategory::Category1,
            30.0,  // 30m span
            2,     // 2 lanes
        );
        
        let lambda = bridge.lambda_factor();
        assert!(lambda > 0.5 && lambda < 5.0);
    }
    
    #[test]
    fn test_offshore_fatigue() {
        let offshore = OffshoreFatigueAssessment::new(
            OffshoreSnCurve::D,
            1.5,  // SCF
            2.0,  // DFF
        );
        
        let n_allow = offshore.allowable_cycles(100.0);
        assert!(n_allow > 1e4 && n_allow < 1e8);
    }
    
    #[test]
    fn test_weibull_damage() {
        let offshore = OffshoreFatigueAssessment::new(
            OffshoreSnCurve::D,
            1.2,
            3.0,  // High DFF for inspection-critical
        );
        
        // 20-year design life, ~1e8 cycles
        let damage = offshore.weibull_damage(50.0, 0.8, 1e8);
        assert!(damage > 0.0);
    }
    
    #[test]
    fn test_gamma_function() {
        // Γ(1) = 1
        assert!((gamma_function(1.0) - 1.0).abs() < 0.01);
        // Γ(2) = 1
        assert!((gamma_function(2.0) - 1.0).abs() < 0.01);
        // Γ(3) = 2
        assert!((gamma_function(3.0) - 2.0).abs() < 0.01);
        // Γ(4) = 6
        assert!((gamma_function(4.0) - 6.0).abs() < 0.1);
    }
}
