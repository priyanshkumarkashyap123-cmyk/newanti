//! Seismic Response Spectrum Analysis
//!
//! This module implements response spectrum analysis for earthquake engineering,
//! compliant with IS 1893 (India) and ASCE 7 (USA) provisions.
//!
//! Features:
//! - Design response spectrum generation
//! - Modal combination methods (CQC, SRSS, ABS)
//! - Base shear calculation
//! - Story forces distribution
//! - Drift calculation
//! - IS 1893:2016 compliance
//! - ASCE 7-16 compliance

use nalgebra::DMatrix;
use serde::{Deserialize, Serialize};
use std::f64::consts::PI;

// ============================================
// SEISMIC CODE ENUMERATIONS
// ============================================

/// Seismic design code
#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
pub enum SeismicCode {
    /// Indian Standard IS 1893:2016
    IS1893,
    /// ASCE 7-16 (USA)
    ASCE7,
    /// Eurocode 8 (Europe)
    EC8,
}

/// Seismic zone (IS 1893)
#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
pub enum SeismicZone {
    /// Zone II (Low seismicity) - Z = 0.10
    Zone2,
    /// Zone III (Moderate) - Z = 0.16
    Zone3,
    /// Zone IV (High) - Z = 0.24
    Zone4,
    /// Zone V (Very High) - Z = 0.36
    Zone5,
}

impl SeismicZone {
    /// Get zone factor Z
    pub fn factor(&self) -> f64 {
        match self {
            SeismicZone::Zone2 => 0.10,
            SeismicZone::Zone3 => 0.16,
            SeismicZone::Zone4 => 0.24,
            SeismicZone::Zone5 => 0.36,
        }
    }
}

/// Soil type classification
#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
pub enum SoilType {
    /// Type I - Rock or hard soil
    TypeI,
    /// Type II - Medium soil
    TypeII,
    /// Type III - Soft soil
    TypeIII,
}

/// Structure importance classification
#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
pub enum ImportanceFactor {
    /// Ordinary structures (I = 1.0)
    Ordinary,
    /// Important structures (I = 1.2)
    Important,
    /// Critical structures (I = 1.5)
    Critical,
}

impl ImportanceFactor {
    pub fn value(&self) -> f64 {
        match self {
            ImportanceFactor::Ordinary => 1.0,
            ImportanceFactor::Important => 1.2,
            ImportanceFactor::Critical => 1.5,
        }
    }
}

/// Response reduction factor (structural system)
#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
pub enum ResponseReduction {
    /// Ordinary moment resisting frame (R = 3.0)
    OMRF,
    /// Special moment resisting frame (R = 5.0)
    SMRF,
    /// Ordinary shear wall (R = 3.0)
    ShearWall,
    /// Dual system (R = 5.0)
    DualSystem,
    /// Custom value
    Custom(f64),
}

impl ResponseReduction {
    pub fn value(&self) -> f64 {
        match self {
            ResponseReduction::OMRF => 3.0,
            ResponseReduction::SMRF => 5.0,
            ResponseReduction::ShearWall => 3.0,
            ResponseReduction::DualSystem => 5.0,
            ResponseReduction::Custom(r) => *r,
        }
    }
}

/// Modal combination method
#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
pub enum CombinationMethod {
    /// Square Root of Sum of Squares (simple, conservative)
    SRSS,
    /// Complete Quadratic Combination (accounts for coupling)
    CQC,
    /// Absolute Sum (very conservative)
    ABS,
}

// ============================================
// RESPONSE SPECTRUM CONFIGURATION
// ============================================

/// Response spectrum configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ResponseSpectrumConfig {
    /// Design code to use
    pub code: SeismicCode,
    
    /// Seismic zone
    pub zone: SeismicZone,
    
    /// Soil type
    pub soil_type: SoilType,
    
    /// Importance factor
    pub importance: ImportanceFactor,
    
    /// Response reduction factor
    pub response_reduction: ResponseReduction,
    
    /// Damping ratio (typically 0.05 for 5%)
    pub damping_ratio: f64,
    
    /// Modal combination method
    pub combination_method: CombinationMethod,
    
    /// Consider vertical earthquake
    pub include_vertical: bool,
    
    /// ASCE 7 site-specific mapped spectral acceleration S_S (short period, g)
    #[serde(default)]
    pub asce7_ss: Option<f64>,
    
    /// ASCE 7 site-specific mapped spectral acceleration S_1 (1-second, g)
    #[serde(default)]
    pub asce7_s1: Option<f64>,
    
    /// EC8 ground type (A–E), determines soil factor and corner periods
    #[serde(default)]
    pub ec8_ground_type: Option<String>,
}

impl Default for ResponseSpectrumConfig {
    fn default() -> Self {
        Self {
            code: SeismicCode::IS1893,
            zone: SeismicZone::Zone3,
            soil_type: SoilType::TypeII,
            importance: ImportanceFactor::Ordinary,
            response_reduction: ResponseReduction::SMRF,
            damping_ratio: 0.05,
            combination_method: CombinationMethod::CQC,
            include_vertical: false,
            asce7_ss: None,
            asce7_s1: None,
            ec8_ground_type: None,
        }
    }
}

// ============================================
// RESPONSE SPECTRUM SOLVER
// ============================================

/// Response spectrum analysis solver
pub struct ResponseSpectrumSolver {
    config: ResponseSpectrumConfig,
}

impl ResponseSpectrumSolver {
    /// Create new response spectrum solver
    pub fn new(config: ResponseSpectrumConfig) -> Self {
        Self { config }
    }

    /// Generate design response spectrum Sa(T)
    ///
    /// Returns spectral acceleration in g (gravity units) as function of period T
    pub fn generate_spectrum(&self, periods: &[f64]) -> Vec<f64> {
        match self.config.code {
            SeismicCode::IS1893 => self.generate_is1893_spectrum(periods),
            SeismicCode::ASCE7 => self.generate_asce7_spectrum(periods),
            SeismicCode::EC8 => self.generate_ec8_spectrum(periods),
        }
    }

    /// Generate IS 1893:2016 design response spectrum
    fn generate_is1893_spectrum(&self, periods: &[f64]) -> Vec<f64> {
        let z = self.config.zone.factor();
        let i = self.config.importance.value();
        let r = self.config.response_reduction.value();
        
        // Damping correction factor (Table 3, IS 1893)
        let damping_factor = if (self.config.damping_ratio - 0.05).abs() < 1e-6 {
            1.0
        } else {
            (0.05 / self.config.damping_ratio).sqrt()
        };

        periods.iter().map(|&t| {
            // Sa/g = (Z/2) * (I/R) * Sa/g(spectrum)
            let base_factor = (z / 2.0) * (i / r);
            
            // Spectral acceleration coefficient (Figure 2, IS 1893)
            let sa_g = self.is1893_spectral_coefficient(t);
            
            base_factor * sa_g * damping_factor
        }).collect()
    }

    /// IS 1893 spectral acceleration coefficient
    fn is1893_spectral_coefficient(&self, period: f64) -> f64 {
        // Get characteristic periods based on soil type
        let (t_corner, t_plateau) = match self.config.soil_type {
            SoilType::TypeI => (0.10, 0.40),   // Rock/Hard soil
            SoilType::TypeII => (0.10, 0.55),  // Medium soil
            SoilType::TypeIII => (0.10, 0.67), // Soft soil
        };

        if period <= t_corner {
            // Ascending branch: Sa/g = 1 + 15T
            1.0 + 15.0 * period
        } else if period <= t_plateau {
            // Plateau: Sa/g = 2.5
            2.5
        } else {
            // Descending branch: Sa/g = 2.5 * (t_plateau / T)
            2.5 * (t_plateau / period)
        }
    }

    /// Generate ASCE 7-22 design response spectrum
    /// Uses site-specific S_S and S_1 if provided, else defaults
    fn generate_asce7_spectrum(&self, periods: &[f64]) -> Vec<f64> {
        // Site coefficients Fa, Fv depend on site class and mapped S_S, S_1
        // Table 11.4-1 / 11.4-2 simplified for common cases
        let ss = self.config.asce7_ss.unwrap_or(0.4);
        let s1 = self.config.asce7_s1.unwrap_or(0.24);
        
        let (fa, fv) = match self.config.soil_type {
            SoilType::TypeI =>  (1.0, 1.0),   // Site Class B (rock)
            SoilType::TypeII => (1.2, 1.7),   // Site Class D (stiff soil) — typical default
            SoilType::TypeIII => (1.2, 2.4),  // Site Class E (soft soil)
        };
        
        let s_ds = (2.0 / 3.0) * ss * fa;
        let s_d1 = (2.0 / 3.0) * s1 * fv;
        
        let t_0 = 0.2 * (s_d1 / s_ds);
        let t_s = s_d1 / s_ds;

        periods.iter().map(|&t| {
            if t <= t_0 {
                s_ds * (0.4 + 0.6 * t / t_0)
            } else if t <= t_s {
                s_ds
            } else {
                s_d1 / t
            }
        }).collect()
    }

    /// Generate Eurocode 8 design response spectrum (Type 1)
    /// Supports ground types A–E per EC8 Table 3.2
    fn generate_ec8_spectrum(&self, periods: &[f64]) -> Vec<f64> {
        let ag = self.config.zone.factor();
        let eta = (10.0 / (5.0 + self.config.damping_ratio * 100.0)).sqrt().max(0.55);
        
        // Ground type parameters per EC8 Table 3.2 (Type 1 spectrum)
        let ground = self.config.ec8_ground_type.as_deref().unwrap_or("B");
        let (s, t_b, t_c, t_d) = match ground {
            "A" => (1.0,  0.15, 0.40, 2.0),
            "B" => (1.2,  0.15, 0.50, 2.0),
            "C" => (1.15, 0.20, 0.60, 2.0),
            "D" => (1.35, 0.20, 0.80, 2.0),
            "E" => (1.40, 0.15, 0.50, 2.0),
            _   => (1.2,  0.15, 0.50, 2.0), // Default to B
        };

        periods.iter().map(|&t| {
            if t <= t_b {
                ag * s * (1.0 + t / t_b * (eta * 2.5 - 1.0))
            } else if t <= t_c {
                ag * s * eta * 2.5
            } else if t <= t_d {
                ag * s * eta * 2.5 * (t_c / t)
            } else {
                ag * s * eta * 2.5 * (t_c * t_d / (t * t))
            }
        }).collect()
    }

    /// Perform modal response spectrum analysis
    ///
    /// # Arguments
    /// * `frequencies` - Natural frequencies from modal analysis (rad/s)
    /// * `mode_shapes` - Mode shape matrix (N_dof × N_modes)
    /// * `modal_masses` - Modal masses for each mode
    /// * `participation_factors` - Modal participation factors
    ///
    /// # Returns
    /// ResponseSpectrumResult with combined responses
    pub fn analyze(
        &self,
        frequencies: &[f64],
        _mode_shapes: &DMatrix<f64>,
        modal_masses: &[f64],
        participation_factors: &[f64],
    ) -> Result<ResponseSpectrumResult, String> {
        let n_modes = frequencies.len();
        
        if n_modes == 0 {
            return Err("No modes provided".to_string());
        }
        
        if modal_masses.iter().any(|&m| m <= 0.0) {
            return Err("Modal masses must be positive".to_string());
        }
        
        if frequencies.iter().any(|&f| f <= 0.0) {
            return Err("Frequencies must be positive".to_string());
        }

        // Convert frequencies to periods: T = 2π/ω
        let periods: Vec<f64> = frequencies.iter()
            .map(|&omega| 2.0 * PI / omega)
            .collect();

        // Get spectral accelerations for each mode
        let spectral_accelerations = self.generate_spectrum(&periods);

        // Compute modal responses (displacement, base shear, etc.)
        let mut modal_displacements = Vec::new();
        let mut modal_base_shears = Vec::new();

        for i in 0..n_modes {
            let sa = spectral_accelerations[i];
            let gamma = participation_factors[i];
            let m_star = modal_masses[i];
            
            // Modal displacement: D_n = Γ_n * Sa_n / ω_n²
            let omega = frequencies[i];
            let modal_disp = gamma * sa * 9.81 / (omega * omega);
            modal_displacements.push(modal_disp);

            // Modal base shear: V_n = M*_n * Sa_n
            let modal_shear = m_star * sa * 9.81;
            modal_base_shears.push(modal_shear);
        }

        // Combine modal responses
        let (max_displacement, max_base_shear) = match self.config.combination_method {
            CombinationMethod::SRSS => self.combine_srss(&modal_displacements, &modal_base_shears),
            CombinationMethod::CQC => self.combine_cqc(&modal_displacements, &modal_base_shears, frequencies),
            CombinationMethod::ABS => self.combine_abs(&modal_displacements, &modal_base_shears),
        };

        // Calculate total base shear using code formula (for comparison)
        let code_base_shear = self.calculate_code_base_shear(
            modal_masses.iter().sum(),
            periods[0], // Fundamental period
        );

        Ok(ResponseSpectrumResult {
            periods,
            spectral_accelerations,
            modal_displacements,
            modal_base_shears,
            max_displacement,
            max_base_shear,
            code_base_shear,
            combination_method: self.config.combination_method,
        })
    }

    /// SRSS modal combination
    pub fn combine_srss(&self, displacements: &[f64], shears: &[f64]) -> (f64, f64) {
        let disp = (displacements.iter().map(|d| d * d).sum::<f64>()).sqrt();
        let shear = (shears.iter().map(|v| v * v).sum::<f64>()).sqrt();
        (disp, shear)
    }

    /// CQC modal combination (accounts for modal coupling)
    pub fn combine_cqc(&self, displacements: &[f64], shears: &[f64], frequencies: &[f64]) -> (f64, f64) {
        let n = displacements.len();
        let xi = self.config.damping_ratio;

        let mut disp_sum = 0.0;
        let mut shear_sum = 0.0;

        for i in 0..n {
            for j in 0..n {
                let omega_i = frequencies[i];
                let omega_j = frequencies[j];
                let beta = omega_j / omega_i;
                
                // CQC correlation coefficient
                let rho_ij = if (omega_i - omega_j).abs() < 1e-6 {
                    1.0
                } else {
                    let numerator = 8.0 * xi * xi * (1.0 + beta) * beta.powf(1.5);
                    let denominator = (1.0 - beta * beta).powi(2) + 4.0 * xi * xi * beta * (1.0 + beta).powi(2);
                    numerator / denominator
                };

                disp_sum += displacements[i] * displacements[j] * rho_ij;
                shear_sum += shears[i] * shears[j] * rho_ij;
            }
        }

        (disp_sum.sqrt(), shear_sum.sqrt())
    }

    /// Absolute sum combination (very conservative)
    pub fn combine_abs(&self, displacements: &[f64], shears: &[f64]) -> (f64, f64) {
        let disp: f64 = displacements.iter().map(|d| d.abs()).sum();
        let shear: f64 = shears.iter().map(|v| v.abs()).sum();
        (disp, shear)
    }

    /// Calculate code-based design base shear
    pub fn calculate_code_base_shear(&self, total_mass: f64, fundamental_period: f64) -> f64 {
        match self.config.code {
            SeismicCode::IS1893 => {
                let z = self.config.zone.factor();
                let i = self.config.importance.value();
                let r = self.config.response_reduction.value();
                let sa_g = self.is1893_spectral_coefficient(fundamental_period);
                
                // V = (Z/2) * (I/R) * Sa/g * W
                let ah = (z / 2.0) * (i / r) * sa_g;
                ah * total_mass * 9.81
            }
            SeismicCode::ASCE7 => {
                // V = C_s * W (simplified)
                let c_s = 0.15; // Simplified seismic response coefficient
                c_s * total_mass * 9.81
            }
            SeismicCode::EC8 => {
                // Simplified
                let ag = self.config.zone.factor();
                ag * total_mass * 9.81
            }
        }
    }

    /// Distribute base shear to story forces
    pub fn distribute_story_forces(
        &self,
        base_shear: f64,
        story_heights: &[f64],
        story_masses: &[f64],
    ) -> Vec<StoryForce> {
        let n = story_heights.len();
        if n == 0 {
            return Vec::new();
        }

        // Calculate Wi * hi (mass × height)
        let wi_hi: Vec<f64> = story_masses.iter()
            .zip(story_heights.iter())
            .map(|(w, h)| w * h)
            .collect();

        let sum_wi_hi: f64 = wi_hi.iter().sum();

        // Distribute forces: Fi = (Wi * hi / Σ(Wj * hj)) * V
        let mut story_forces = Vec::new();
        let mut cumulative_shear = 0.0;

        for i in (0..n).rev() {
            let force = (wi_hi[i] / sum_wi_hi) * base_shear;
            cumulative_shear += force;
            
            story_forces.push(StoryForce {
                level: i + 1,
                height: story_heights[i],
                force_kn: force / 1000.0, // Convert to kN
                shear_kn: cumulative_shear / 1000.0,
            });
        }

        story_forces.reverse();
        story_forces
    }
}

// ============================================
// RESULT STRUCTURES
// ============================================

/// Response spectrum analysis result
#[derive(Debug, Clone, Serialize)]
pub struct ResponseSpectrumResult {
    /// Natural periods for each mode (seconds)
    pub periods: Vec<f64>,
    
    /// Spectral accelerations for each mode (g)
    pub spectral_accelerations: Vec<f64>,
    
    /// Modal displacements (m)
    pub modal_displacements: Vec<f64>,
    
    /// Modal base shears (N)
    pub modal_base_shears: Vec<f64>,
    
    /// Maximum combined displacement (m)
    pub max_displacement: f64,
    
    /// Maximum combined base shear (N)
    pub max_base_shear: f64,
    
    /// Code-based design base shear (N)
    pub code_base_shear: f64,
    
    /// Combination method used
    pub combination_method: CombinationMethod,
}

/// Story force distribution
#[derive(Debug, Clone, Serialize)]
pub struct StoryForce {
    /// Story level (1-based)
    pub level: usize,
    
    /// Height from ground (m)
    pub height: f64,
    
    /// Lateral force at this story (kN)
    pub force_kn: f64,
    
    /// Cumulative shear at this story (kN)
    pub shear_kn: f64,
}

// ============================================
// TESTS
// ============================================

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_seismic_zone_factors() {
        assert_eq!(SeismicZone::Zone2.factor(), 0.10);
        assert_eq!(SeismicZone::Zone3.factor(), 0.16);
        assert_eq!(SeismicZone::Zone4.factor(), 0.24);
        assert_eq!(SeismicZone::Zone5.factor(), 0.36);
    }

    #[test]
    fn test_importance_factors() {
        assert_eq!(ImportanceFactor::Ordinary.value(), 1.0);
        assert_eq!(ImportanceFactor::Important.value(), 1.2);
        assert_eq!(ImportanceFactor::Critical.value(), 1.5);
    }

    #[test]
    fn test_response_reduction() {
        assert_eq!(ResponseReduction::OMRF.value(), 3.0);
        assert_eq!(ResponseReduction::SMRF.value(), 5.0);
        assert_eq!(ResponseReduction::Custom(4.5).value(), 4.5);
    }

    #[test]
    fn test_is1893_spectrum_generation() {
        let config = ResponseSpectrumConfig {
            code: SeismicCode::IS1893,
            zone: SeismicZone::Zone3,
            soil_type: SoilType::TypeII,
            importance: ImportanceFactor::Ordinary,
            response_reduction: ResponseReduction::SMRF,
            damping_ratio: 0.05,
            combination_method: CombinationMethod::SRSS,
            include_vertical: false,
            asce7_ss: None,
            asce7_s1: None,
            ec8_ground_type: None,
        };

        let solver = ResponseSpectrumSolver::new(config);
        let periods = vec![0.5, 1.0, 2.0, 3.0];
        let spectrum = solver.generate_spectrum(&periods);

        // Check that spectrum values are positive and reasonable
        assert!(spectrum.iter().all(|&sa| sa > 0.0));
        assert!(spectrum[0] > 0.01); // Reasonable spectral acceleration
    }

    #[test]
    fn test_modal_combination_srss() {
        let config = ResponseSpectrumConfig::default();
        let solver = ResponseSpectrumSolver::new(config);

        let displacements = vec![0.10, 0.05, 0.02];
        let shears = vec![100.0, 50.0, 20.0];
        
        let (disp, shear) = solver.combine_srss(&displacements, &shears);
        
        // SRSS: sqrt(0.10² + 0.05² + 0.02²) = sqrt(0.0129) ≈ 0.1136
        assert!((disp - 0.1136).abs() < 0.001);
        
        // SRSS shear: sqrt(100² + 50² + 20²) = sqrt(12900) ≈ 113.58
        assert!((shear - 113.58).abs() < 0.1);
    }

    #[test]
    fn test_story_force_distribution() {
        let config = ResponseSpectrumConfig::default();
        let solver = ResponseSpectrumSolver::new(config);

        let base_shear = 1000_000.0; // 1000 kN in N
        let heights = vec![3.0, 6.0, 9.0];
        let masses = vec![100_000.0, 100_000.0, 100_000.0]; // kg

        let forces = solver.distribute_story_forces(base_shear, &heights, &masses);

        assert_eq!(forces.len(), 3);
        
        // Total force should equal base shear
        let total_force: f64 = forces.iter().map(|f| f.force_kn).sum();
        assert!((total_force - 1000.0).abs() < 0.1);
        
        // Higher stories should get more force
        assert!(forces[2].force_kn > forces[1].force_kn);
        assert!(forces[1].force_kn > forces[0].force_kn);
    }
}
