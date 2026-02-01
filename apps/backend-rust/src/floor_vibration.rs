// ============================================================================
// FLOOR VIBRATION ANALYSIS MODULE
// Human Comfort Assessment for Floor Systems
// ============================================================================

use serde::{Deserialize, Serialize};
use std::f64::consts::PI;

// ============================================================================
// VIBRATION CRITERIA
// ============================================================================

/// Floor occupancy types for vibration assessment
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum OccupancyType {
    /// Sensitive equipment (operating rooms, labs)
    SensitiveEquipment,
    /// Office/residential
    OfficeResidential,
    /// Pedestrian bridge
    PedestrianBridge,
    /// Shopping mall
    ShoppingMall,
    /// Gymnasium/dance floor
    RhythmicActivity,
    /// Industrial
    Industrial,
}

impl OccupancyType {
    /// Acceptable acceleration limit (g)
    pub fn acceleration_limit(&self) -> f64 {
        match self {
            OccupancyType::SensitiveEquipment => 0.005,
            OccupancyType::OfficeResidential => 0.005,
            OccupancyType::PedestrianBridge => 0.015,
            OccupancyType::ShoppingMall => 0.015,
            OccupancyType::RhythmicActivity => 0.05,
            OccupancyType::Industrial => 0.05,
        }
    }
    
    /// Minimum recommended natural frequency (Hz)
    pub fn min_frequency(&self) -> f64 {
        match self {
            OccupancyType::SensitiveEquipment => 8.0,
            OccupancyType::OfficeResidential => 5.0,
            OccupancyType::PedestrianBridge => 3.0,
            OccupancyType::ShoppingMall => 5.0,
            OccupancyType::RhythmicActivity => 9.0,
            OccupancyType::Industrial => 3.0,
        }
    }
    
    /// Walking frequency range (Hz)
    pub fn walking_frequency_range(&self) -> (f64, f64) {
        match self {
            OccupancyType::PedestrianBridge => (1.5, 2.5),
            OccupancyType::ShoppingMall => (1.6, 2.2),
            OccupancyType::RhythmicActivity => (1.5, 3.0),
            _ => (1.6, 2.2),
        }
    }
}

/// Vibration design code
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum VibrationCode {
    /// AISC Design Guide 11
    AiscDg11,
    /// SCI P354 (UK)
    SciP354,
    /// Eurocode (EN 1991-1-1)
    Eurocode,
    /// CCIP-016 (Concrete)
    Ccip016,
    /// ISO 10137
    Iso10137,
}

// ============================================================================
// FLOOR PROPERTIES
// ============================================================================

/// Floor system types
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum FloorSystemType {
    /// Steel beam with concrete slab
    SteelComposite,
    /// Steel joist with metal deck
    SteelJoist,
    /// Concrete flat slab
    ConcreteFlatSlab,
    /// Concrete beam and slab
    ConcreteBeamSlab,
    /// Post-tensioned slab
    PostTensioned,
    /// Timber floor
    Timber,
}

/// Floor bay properties
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FloorBay {
    /// Bay length in primary direction (m)
    pub length_x: f64,
    /// Bay width in secondary direction (m)
    pub length_y: f64,
    /// Floor system type
    pub system_type: FloorSystemType,
    /// Total floor mass (kg/m²)
    pub mass: f64,
    /// Primary beam moment of inertia (m⁴)
    pub i_beam: f64,
    /// Secondary beam/joist moment of inertia (m⁴)
    pub i_joist: f64,
    /// Slab thickness (m)
    pub slab_thickness: f64,
    /// Elastic modulus of concrete (MPa)
    pub ec: f64,
    /// Elastic modulus of steel (MPa)
    pub es: f64,
    /// Damping ratio (typically 0.02-0.05)
    pub damping: f64,
}

impl FloorBay {
    pub fn steel_composite(length_x: f64, length_y: f64, i_beam: f64, i_joist: f64, slab_t: f64) -> Self {
        // Typical mass: concrete slab + steel + finishes ≈ 350-500 kg/m²
        let mass = 2500.0 * slab_t + 50.0; // Concrete + finishes
        
        Self {
            length_x,
            length_y,
            system_type: FloorSystemType::SteelComposite,
            mass,
            i_beam,
            i_joist,
            slab_thickness: slab_t,
            ec: 30000.0,
            es: 200000.0,
            damping: 0.03,
        }
    }
    
    pub fn concrete_flat_slab(length_x: f64, length_y: f64, slab_t: f64) -> Self {
        let mass = 2500.0 * slab_t + 100.0;
        
        Self {
            length_x,
            length_y,
            system_type: FloorSystemType::ConcreteFlatSlab,
            mass,
            i_beam: 0.0,
            i_joist: 0.0,
            slab_thickness: slab_t,
            ec: 30000.0,
            es: 200000.0,
            damping: 0.02,
        }
    }
    
    /// Effective panel width (m) - AISC DG11
    pub fn effective_width(&self) -> f64 {
        // Typically 0.5-0.7 of bay width
        0.6 * self.length_y
    }
    
    /// Equivalent uniform thickness for concrete slab (m)
    pub fn equivalent_thickness(&self) -> f64 {
        match self.system_type {
            FloorSystemType::SteelComposite | FloorSystemType::SteelJoist => {
                // Include contribution from deck ribs
                self.slab_thickness * 1.1
            }
            _ => self.slab_thickness,
        }
    }
}

// ============================================================================
// NATURAL FREQUENCY CALCULATION
// ============================================================================

/// Natural frequency calculator
pub struct FrequencyCalculator;

impl FrequencyCalculator {
    /// AISC DG11 method for composite floors
    pub fn aisc_dg11(bay: &FloorBay) -> FrequencyResult {
        let lx = bay.length_x;
        let ly = bay.length_y;
        
        // Beam frequency
        let w_beam = bay.mass * ly; // Load per unit length (kg/m)
        let delta_beam = 5.0 * w_beam * 9.81 * lx.powi(4) / (384.0 * bay.es * 1e6 * bay.i_beam);
        let f_beam = 0.18 * (9.81 / delta_beam).sqrt();
        
        // Joist/girder frequency
        let w_joist = bay.mass * lx / 3.0; // Assume 3 joists per bay
        let delta_joist = 5.0 * w_joist * 9.81 * ly.powi(4) / (384.0 * bay.es * 1e6 * bay.i_joist);
        let f_joist = if bay.i_joist > 0.0 { 
            0.18 * (9.81 / delta_joist).sqrt() 
        } else { 
            f64::MAX 
        };
        
        // Combined frequency (Dunkerley's equation)
        let f_combined = 1.0 / (1.0 / f_beam.powi(2) + 1.0 / f_joist.powi(2)).sqrt();
        
        FrequencyResult {
            f_beam,
            f_joist: if f_joist.is_finite() { f_joist } else { 0.0 },
            f_combined,
            delta_beam,
            delta_joist: if delta_joist.is_finite() { delta_joist } else { 0.0 },
            mode_shape: ModeShape::FirstBending,
        }
    }
    
    /// SCI P354 method (UK)
    pub fn sci_p354(bay: &FloorBay) -> FrequencyResult {
        // Simplified method for composite floors
        let l = bay.length_x;
        let w = bay.mass * 9.81 * bay.length_y; // Total load per unit length
        
        // Effective second moment
        let i_eff = bay.i_beam + bay.ec / bay.es * bay.slab_thickness.powi(3) * bay.length_y / 12.0;
        
        let delta = 5.0 * w * l.powi(4) / (384.0 * bay.es * 1e6 * i_eff);
        let f0 = 18.0 / delta.sqrt();
        
        FrequencyResult {
            f_beam: f0,
            f_joist: 0.0,
            f_combined: f0,
            delta_beam: delta,
            delta_joist: 0.0,
            mode_shape: ModeShape::FirstBending,
        }
    }
    
    /// Flat slab natural frequency (CCIP-016)
    pub fn flat_slab(bay: &FloorBay) -> FrequencyResult {
        let lx = bay.length_x;
        let ly = bay.length_y;
        let t = bay.slab_thickness;
        
        // Plate stiffness
        let d = bay.ec * 1e6 * t.powi(3) / (12.0 * (1.0 - 0.2_f64.powi(2)));
        
        // Mass per unit area
        let m = bay.mass;
        
        // First mode frequency (simply supported plate)
        let lambda_sq = PI.powi(4) * ((1.0 / lx.powi(2) + 1.0 / ly.powi(2)).powi(2));
        let f0 = (lambda_sq * d / m).sqrt() / (2.0 * PI);
        
        // Deflection
        let q = m * 9.81;
        let delta = q * lx.powi(4) / (d * PI.powi(4)) * (1.0 / (1.0 + (lx / ly).powi(4)));
        
        FrequencyResult {
            f_beam: f0,
            f_joist: 0.0,
            f_combined: f0,
            delta_beam: delta,
            delta_joist: 0.0,
            mode_shape: ModeShape::PlateMode,
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum ModeShape {
    FirstBending,
    SecondBending,
    Torsional,
    PlateMode,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FrequencyResult {
    pub f_beam: f64,
    pub f_joist: f64,
    pub f_combined: f64,
    pub delta_beam: f64,
    pub delta_joist: f64,
    pub mode_shape: ModeShape,
}

// ============================================================================
// WALKING EXCITATION
// ============================================================================

/// Walking load model
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WalkingLoad {
    /// Walker mass (kg)
    pub walker_mass: f64,
    /// Walking frequency (Hz)
    pub frequency: f64,
    /// Dynamic load factors for harmonics
    pub dlf: Vec<f64>,
}

impl WalkingLoad {
    /// Standard walking load (AISC DG11)
    pub fn standard(frequency: f64) -> Self {
        // Dynamic load factors for walking
        let dlf = vec![
            0.5,   // 1st harmonic
            0.2,   // 2nd harmonic
            0.1,   // 3rd harmonic
            0.05,  // 4th harmonic
        ];
        
        Self {
            walker_mass: 75.0, // Average person
            frequency,
            dlf,
        }
    }
    
    /// Running load (higher DLF)
    pub fn running(frequency: f64) -> Self {
        let dlf = vec![1.6, 0.7, 0.3, 0.15];
        
        Self {
            walker_mass: 75.0,
            frequency,
            dlf,
        }
    }
    
    /// Peak force (N) for nth harmonic
    pub fn peak_force(&self, harmonic: usize) -> f64 {
        let weight = self.walker_mass * 9.81;
        if harmonic < self.dlf.len() {
            weight * self.dlf[harmonic]
        } else {
            0.0
        }
    }
    
    /// Harmonic frequency (Hz)
    pub fn harmonic_frequency(&self, n: usize) -> f64 {
        (n + 1) as f64 * self.frequency
    }
}

// ============================================================================
// VIBRATION RESPONSE
// ============================================================================

/// Vibration response calculator
pub struct VibrationResponse;

impl VibrationResponse {
    /// Calculate steady-state response to walking
    pub fn walking_response(
        bay: &FloorBay,
        walking: &WalkingLoad,
        frequency: &FrequencyResult,
    ) -> ResponseResult {
        let fn_floor = frequency.f_combined;
        let zeta = bay.damping;
        let modal_mass = bay.mass * bay.length_x * bay.length_y * 0.5; // Approximate
        
        let mut total_accel = 0.0;
        let mut critical_harmonic = 0;
        let mut max_response = 0.0;
        
        // Check response to each harmonic
        for n in 0..4 {
            let f_harmonic = walking.harmonic_frequency(n);
            let force = walking.peak_force(n);
            
            // Frequency ratio
            let r = f_harmonic / fn_floor;
            
            // Dynamic amplification factor
            let dmf = 1.0 / ((1.0 - r.powi(2)).powi(2) + (2.0 * zeta * r).powi(2)).sqrt();
            
            // Acceleration response
            let accel = force * dmf / modal_mass;
            
            if accel > max_response {
                max_response = accel;
                critical_harmonic = n + 1;
            }
            
            // SRSS combination
            total_accel += accel.powi(2);
        }
        
        total_accel = total_accel.sqrt();
        
        // Convert to g's
        let accel_g = total_accel / 9.81;
        
        ResponseResult {
            peak_acceleration: total_accel,
            acceleration_g: accel_g,
            critical_harmonic,
            max_harmonic_response: max_response / 9.81,
            rms_velocity: total_accel / (2.0 * PI * fn_floor),
        }
    }
    
    /// Resonance response (worst case)
    pub fn resonance_response(
        bay: &FloorBay,
        walking: &WalkingLoad,
        frequency: &FrequencyResult,
    ) -> ResponseResult {
        let fn_floor = frequency.f_combined;
        let zeta = bay.damping;
        let modal_mass = bay.mass * bay.length_x * bay.length_y * 0.5;
        
        // Assume resonance with first harmonic
        let force = walking.peak_force(0);
        
        // Resonance amplification (1/2ζ)
        let dmf = 1.0 / (2.0 * zeta);
        
        let peak_accel = force * dmf / modal_mass;
        
        ResponseResult {
            peak_acceleration: peak_accel,
            acceleration_g: peak_accel / 9.81,
            critical_harmonic: 1,
            max_harmonic_response: peak_accel / 9.81,
            rms_velocity: peak_accel / (2.0 * PI * fn_floor),
        }
    }
    
    /// Transient (heel-drop) response
    pub fn heel_drop_response(
        bay: &FloorBay,
        frequency: &FrequencyResult,
    ) -> ResponseResult {
        let fn_floor = frequency.f_combined;
        let zeta = bay.damping;
        let modal_mass = bay.mass * bay.length_x * bay.length_y * 0.5;
        
        // Heel-drop impulse ≈ 70 N·s
        let impulse = 70.0;
        
        // Peak velocity
        let v_peak = impulse / modal_mass;
        
        // Peak acceleration (exponentially decaying)
        let peak_accel = 2.0 * PI * fn_floor * v_peak;
        
        ResponseResult {
            peak_acceleration: peak_accel,
            acceleration_g: peak_accel / 9.81,
            critical_harmonic: 0,
            max_harmonic_response: 0.0,
            rms_velocity: v_peak * (1.0 - (-zeta * 2.0 * PI).exp()) / (2.0 * zeta),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ResponseResult {
    pub peak_acceleration: f64,
    pub acceleration_g: f64,
    pub critical_harmonic: usize,
    pub max_harmonic_response: f64,
    pub rms_velocity: f64,
}

// ============================================================================
// VIBRATION ASSESSMENT
// ============================================================================

/// Floor vibration assessment per various codes
pub struct VibrationAssessment;

impl VibrationAssessment {
    /// AISC Design Guide 11 assessment
    pub fn aisc_dg11(
        bay: &FloorBay,
        occupancy: OccupancyType,
    ) -> AssessmentResult {
        let frequency = FrequencyCalculator::aisc_dg11(bay);
        let walking = WalkingLoad::standard(2.0);
        let response = VibrationResponse::walking_response(bay, &walking, &frequency);
        
        let limit = occupancy.acceleration_limit();
        let min_freq = occupancy.min_frequency();
        
        let frequency_ok = frequency.f_combined >= min_freq;
        let acceleration_ok = response.acceleration_g <= limit;
        
        AssessmentResult {
            code: VibrationCode::AiscDg11,
            natural_frequency: frequency.f_combined,
            min_frequency: min_freq,
            frequency_ok,
            peak_acceleration: response.acceleration_g,
            acceleration_limit: limit,
            acceleration_ok,
            overall_pass: frequency_ok && acceleration_ok,
            recommendation: Self::recommendation(frequency.f_combined, response.acceleration_g, limit),
        }
    }
    
    /// SCI P354 assessment
    pub fn sci_p354(
        bay: &FloorBay,
        occupancy: OccupancyType,
    ) -> AssessmentResult {
        let frequency = FrequencyCalculator::sci_p354(bay);
        let walking = WalkingLoad::standard(2.0);
        let response = VibrationResponse::walking_response(bay, &walking, &frequency);
        
        // SCI uses response factor R
        let r_factor = response.acceleration_g / 0.005; // Normalized to base curve
        let r_limit = match occupancy {
            OccupancyType::SensitiveEquipment => 1.0,
            OccupancyType::OfficeResidential => 4.0,
            OccupancyType::ShoppingMall => 8.0,
            OccupancyType::RhythmicActivity => 16.0,
            _ => 4.0,
        };
        
        let limit = occupancy.acceleration_limit();
        let min_freq = occupancy.min_frequency();
        
        AssessmentResult {
            code: VibrationCode::SciP354,
            natural_frequency: frequency.f_combined,
            min_frequency: min_freq,
            frequency_ok: frequency.f_combined >= min_freq,
            peak_acceleration: response.acceleration_g,
            acceleration_limit: limit,
            acceleration_ok: r_factor <= r_limit,
            overall_pass: frequency.f_combined >= min_freq && r_factor <= r_limit,
            recommendation: Self::recommendation(frequency.f_combined, response.acceleration_g, limit),
        }
    }
    
    /// Quick check - simplified assessment
    pub fn quick_check(
        bay: &FloorBay,
        occupancy: OccupancyType,
    ) -> AssessmentResult {
        // Simple frequency check
        let l = bay.length_x.max(bay.length_y);
        let delta_est = 5.0 * bay.mass * 9.81 * l.powi(4) / (384.0 * bay.es * 1e6 * bay.i_beam.max(0.0001));
        let f_est = 0.18 * (9.81 / delta_est.max(0.001)).sqrt();
        
        let min_freq = occupancy.min_frequency();
        let limit = occupancy.acceleration_limit();
        
        AssessmentResult {
            code: VibrationCode::AiscDg11,
            natural_frequency: f_est,
            min_frequency: min_freq,
            frequency_ok: f_est >= min_freq,
            peak_acceleration: 0.0,
            acceleration_limit: limit,
            acceleration_ok: true, // Assume OK if frequency is adequate
            overall_pass: f_est >= min_freq,
            recommendation: if f_est >= min_freq {
                "Floor frequency adequate for intended use".to_string()
            } else {
                format!("Increase stiffness to achieve minimum frequency of {:.1} Hz", min_freq)
            },
        }
    }
    
    fn recommendation(freq: f64, accel: f64, limit: f64) -> String {
        if freq < 5.0 {
            "Consider increasing beam stiffness or reducing span".to_string()
        } else if accel > limit {
            "Consider adding mass or increasing damping (TMD)".to_string()
        } else {
            "Floor vibration performance is acceptable".to_string()
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AssessmentResult {
    pub code: VibrationCode,
    pub natural_frequency: f64,
    pub min_frequency: f64,
    pub frequency_ok: bool,
    pub peak_acceleration: f64,
    pub acceleration_limit: f64,
    pub acceleration_ok: bool,
    pub overall_pass: bool,
    pub recommendation: String,
}

// ============================================================================
// TUNED MASS DAMPER (TMD)
// ============================================================================

/// Tuned mass damper design
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TunedMassDamper {
    /// TMD mass (kg)
    pub mass: f64,
    /// TMD frequency (Hz)
    pub frequency: f64,
    /// TMD damping ratio
    pub damping: f64,
    /// Stiffness (N/m)
    pub stiffness: f64,
    /// Damping coefficient (N·s/m)
    pub damping_coef: f64,
}

impl TunedMassDamper {
    /// Design TMD for floor vibration control
    pub fn design(floor_mass: f64, floor_freq: f64, mass_ratio: f64) -> Self {
        let m_tmd = mass_ratio * floor_mass;
        
        // Optimal tuning (Den Hartog)
        let f_opt = floor_freq / (1.0 + mass_ratio);
        let zeta_opt = (3.0 * mass_ratio / (8.0 * (1.0 + mass_ratio))).sqrt();
        
        let omega = 2.0 * PI * f_opt;
        let k = m_tmd * omega.powi(2);
        let c = 2.0 * zeta_opt * (k * m_tmd).sqrt();
        
        Self {
            mass: m_tmd,
            frequency: f_opt,
            damping: zeta_opt,
            stiffness: k,
            damping_coef: c,
        }
    }
    
    /// Expected reduction in response (fraction)
    pub fn response_reduction(&self, mass_ratio: f64) -> f64 {
        // Approximate reduction from TMD
        1.0 / (1.0 + 15.0 * mass_ratio.sqrt())
    }
}

// ============================================================================
// TESTS
// ============================================================================

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_occupancy_limits() {
        assert!((OccupancyType::OfficeResidential.acceleration_limit() - 0.005).abs() < 0.001);
        assert_eq!(OccupancyType::OfficeResidential.min_frequency(), 5.0);
    }

    #[test]
    fn test_floor_bay_composite() {
        let bay = FloorBay::steel_composite(9.0, 6.0, 0.0005, 0.0001, 0.15);
        
        assert!(bay.mass > 0.0);
        assert_eq!(bay.system_type, FloorSystemType::SteelComposite);
    }

    #[test]
    fn test_floor_bay_flat_slab() {
        let bay = FloorBay::concrete_flat_slab(8.0, 8.0, 0.25);
        
        assert!(bay.mass > 500.0);
        assert_eq!(bay.damping, 0.02);
    }

    #[test]
    fn test_frequency_aisc() {
        let bay = FloorBay::steel_composite(10.0, 7.5, 0.001, 0.0003, 0.15);
        let result = FrequencyCalculator::aisc_dg11(&bay);
        
        assert!(result.f_combined > 0.0);
        assert!(result.delta_beam > 0.0);
    }

    #[test]
    fn test_frequency_flat_slab() {
        let bay = FloorBay::concrete_flat_slab(8.0, 8.0, 0.25);
        let result = FrequencyCalculator::flat_slab(&bay);
        
        assert!(result.f_combined > 0.0);
        assert!(result.f_combined < 20.0); // Reasonable range
    }

    #[test]
    fn test_walking_load() {
        let walking = WalkingLoad::standard(2.0);
        
        assert_eq!(walking.walker_mass, 75.0);
        assert!(walking.peak_force(0) > 0.0);
        assert_eq!(walking.harmonic_frequency(0), 2.0);
        assert_eq!(walking.harmonic_frequency(1), 4.0);
    }

    #[test]
    fn test_walking_response() {
        let bay = FloorBay::steel_composite(10.0, 7.5, 0.001, 0.0003, 0.15);
        let freq = FrequencyCalculator::aisc_dg11(&bay);
        let walking = WalkingLoad::standard(2.0);
        
        let response = VibrationResponse::walking_response(&bay, &walking, &freq);
        
        assert!(response.peak_acceleration > 0.0);
        assert!(response.acceleration_g < 1.0); // Should be small
    }

    #[test]
    fn test_resonance_response() {
        let bay = FloorBay::steel_composite(10.0, 7.5, 0.0008, 0.0002, 0.15);
        let freq = FrequencyCalculator::aisc_dg11(&bay);
        let walking = WalkingLoad::standard(2.0);
        
        let response = VibrationResponse::resonance_response(&bay, &walking, &freq);
        
        assert!(response.peak_acceleration > 0.0);
    }

    #[test]
    fn test_heel_drop() {
        let bay = FloorBay::steel_composite(9.0, 6.0, 0.0006, 0.0002, 0.15);
        let freq = FrequencyCalculator::aisc_dg11(&bay);
        
        let response = VibrationResponse::heel_drop_response(&bay, &freq);
        
        assert!(response.peak_acceleration > 0.0);
        assert!(response.rms_velocity > 0.0);
    }

    #[test]
    fn test_assessment_aisc() {
        let bay = FloorBay::steel_composite(8.0, 6.0, 0.0012, 0.0004, 0.15);
        let result = VibrationAssessment::aisc_dg11(&bay, OccupancyType::OfficeResidential);
        
        assert!(result.natural_frequency > 0.0);
        assert!(result.acceleration_limit > 0.0);
    }

    #[test]
    fn test_assessment_sci() {
        let bay = FloorBay::steel_composite(8.0, 6.0, 0.0012, 0.0004, 0.15);
        let result = VibrationAssessment::sci_p354(&bay, OccupancyType::OfficeResidential);
        
        assert!(result.natural_frequency > 0.0);
    }

    #[test]
    fn test_quick_check() {
        let bay = FloorBay::steel_composite(10.0, 7.0, 0.001, 0.0003, 0.15);
        let result = VibrationAssessment::quick_check(&bay, OccupancyType::OfficeResidential);
        
        assert!(result.natural_frequency > 0.0);
        assert!(!result.recommendation.is_empty());
    }

    #[test]
    fn test_tmd_design() {
        let floor_mass = 50000.0; // 50 tonnes
        let floor_freq = 5.0;
        let mass_ratio = 0.02;
        
        let tmd = TunedMassDamper::design(floor_mass, floor_freq, mass_ratio);
        
        assert!((tmd.mass - 1000.0).abs() < 1.0);
        assert!(tmd.frequency < floor_freq); // TMD tuned below floor
        assert!(tmd.damping > 0.0);
    }

    #[test]
    fn test_tmd_reduction() {
        let tmd = TunedMassDamper::design(50000.0, 5.0, 0.02);
        let reduction = tmd.response_reduction(0.02);
        
        assert!(reduction < 1.0);
        assert!(reduction > 0.3); // TMD provides significant reduction
    }
}
