//! Vibration Serviceability Module
//!
//! Human-induced vibrations and floor serviceability analysis.
//! Based on: AISC Design Guide 11, SCI P354, ISO 10137
//!
//! Features:
//! - Floor vibration analysis
//! - Walking excitation models
//! - Rhythmic activity analysis
//! - Damping estimation

use serde::{Deserialize, Serialize};
use std::f64::consts::PI;

/// Activity type for vibration analysis
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum ActivityType {
    /// Normal walking
    Walking,
    /// Fast walking/running
    Running,
    /// Aerobics
    Aerobics,
    /// Dancing
    Dancing,
    /// Concert/stadium jumping
    Concert,
    /// Office activity
    Office,
    /// Residential
    Residential,
    /// Hospital/laboratory
    Sensitive,
}

/// Occupancy type
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum OccupancyType {
    /// Office building
    Office,
    /// Residential
    Residential,
    /// Shopping mall
    Shopping,
    /// Gymnasium
    Gymnasium,
    /// Hospital
    Hospital,
    /// Laboratory
    Laboratory,
    /// Industrial
    Industrial,
}

/// Floor system parameters
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FloorSystem {
    /// Span length (m)
    pub span: f64,
    /// Bay width (m)
    pub bay_width: f64,
    /// Total floor mass (kg/m²)
    pub mass_per_area: f64,
    /// Fundamental frequency (Hz)
    pub natural_frequency: f64,
    /// Modal mass (kg)
    pub modal_mass: f64,
    /// Damping ratio
    pub damping_ratio: f64,
    /// Mode shape factor
    pub mode_shape_factor: f64,
}

impl FloorSystem {
    /// Create new floor system
    pub fn new(span: f64, bay_width: f64, mass_per_area: f64) -> Self {
        Self {
            span,
            bay_width,
            mass_per_area,
            natural_frequency: 0.0,
            modal_mass: 0.0,
            damping_ratio: 0.03, // Default 3%
            mode_shape_factor: 1.3, // Typical for simply supported
        }
    }
    
    /// Estimate natural frequency for steel beam floor
    pub fn estimate_frequency_steel(&mut self, beam_stiffness: f64, girder_stiffness: f64) {
        // AISC DG11 simplified formula
        let delta_b = 5.0 * self.mass_per_area * 9.81 * self.bay_width * self.span.powi(4) 
            / (384.0 * beam_stiffness * 1e9);
        let delta_g = 5.0 * self.mass_per_area * 9.81 * self.span * self.bay_width.powi(4)
            / (384.0 * girder_stiffness * 1e9);
        
        let delta_total = delta_b + delta_g;
        
        // fn = 0.18 * sqrt(g/delta)
        self.natural_frequency = 0.18 * (9.81 / delta_total).sqrt();
        
        // Estimate modal mass
        let floor_area = self.span * self.bay_width;
        self.modal_mass = self.mass_per_area * floor_area / 4.0; // Approximate for first mode
    }
    
    /// Estimate natural frequency for concrete slab
    pub fn estimate_frequency_concrete(&mut self, slab_thickness: f64, fc: f64) {
        // Simplified formula for concrete slab
        let ec = 4700.0 * fc.sqrt(); // MPa
        let i = slab_thickness.powi(3) / 12.0; // m^4/m width
        
        let stiffness = ec * 1e6 * i; // N-m/m width
        
        let mass_per_length = self.mass_per_area * self.bay_width;
        
        // Simply supported beam formula
        self.natural_frequency = (PI / (2.0 * self.span.powi(2))) 
            * (stiffness * self.bay_width / mass_per_length).sqrt();
        
        let floor_area = self.span * self.bay_width;
        self.modal_mass = self.mass_per_area * floor_area / 4.0;
    }
    
    /// Set damping ratio based on finish
    pub fn set_damping(&mut self, finish: FloorFinish) {
        self.damping_ratio = match finish {
            FloorFinish::BareSteel => 0.01,
            FloorFinish::OpenPlanOffice => 0.03,
            FloorFinish::PartitionedOffice => 0.05,
            FloorFinish::FullHeightPartitions => 0.06,
            FloorFinish::Residential => 0.04,
        };
    }
}

/// Floor finish type
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum FloorFinish {
    /// Bare steel structure
    BareSteel,
    /// Open plan office
    OpenPlanOffice,
    /// Office with partitions
    PartitionedOffice,
    /// Full height partitions
    FullHeightPartitions,
    /// Residential with fit-out
    Residential,
}

/// Walking excitation model
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WalkingModel {
    /// Pedestrian weight (N)
    pub weight: f64,
    /// Walking frequency (Hz)
    pub walking_freq: f64,
    /// Number of harmonics
    pub n_harmonics: usize,
    /// Fourier coefficients
    pub fourier_coeffs: Vec<f64>,
}

impl WalkingModel {
    /// Create standard walking model (AISC DG11)
    pub fn aisc_standard(weight: f64, walking_freq: f64) -> Self {
        // AISC DG11 Table 4.1
        let coeffs = vec![0.5, 0.2, 0.1, 0.05]; // First 4 harmonics
        
        Self {
            weight,
            walking_freq,
            n_harmonics: 4,
            fourier_coeffs: coeffs,
        }
    }
    
    /// Create SCI P354 walking model
    pub fn sci_model(weight: f64, walking_freq: f64) -> Self {
        // SCI P354 recommended coefficients
        let coeffs = vec![0.436, 0.006, 0.007, 0.007]; // First 4 harmonics
        
        Self {
            weight,
            walking_freq,
            n_harmonics: 4,
            fourier_coeffs: coeffs,
        }
    }
    
    /// Calculate force at time t
    pub fn force_at(&self, t: f64) -> f64 {
        let mut force = self.weight;
        
        for (i, &coeff) in self.fourier_coeffs.iter().enumerate() {
            let harmonic = (i + 1) as f64;
            force += self.weight * coeff * (2.0 * PI * harmonic * self.walking_freq * t).sin();
        }
        
        force
    }
    
    /// Get effective force amplitude for resonant response
    pub fn resonant_force(&self, harmonic: usize) -> f64 {
        if harmonic > 0 && harmonic <= self.fourier_coeffs.len() {
            self.weight * self.fourier_coeffs[harmonic - 1]
        } else {
            0.0
        }
    }
}

/// Vibration response calculator
#[derive(Debug, Clone)]
pub struct VibrationResponse {
    /// Peak acceleration (m/s²)
    pub peak_acceleration: f64,
    /// RMS acceleration (m/s²)
    pub rms_acceleration: f64,
    /// Velocity (mm/s)
    pub peak_velocity: f64,
    /// Displacement (mm)
    pub peak_displacement: f64,
    /// Response factor (R)
    pub response_factor: f64,
    /// VDV (m/s^1.75)
    pub vdv: f64,
}

impl VibrationResponse {
    /// Calculate resonant response (AISC DG11)
    pub fn resonant_walking_aisc(floor: &FloorSystem, walking: &WalkingModel) -> Self {
        // Find resonant harmonic
        let mut max_response = 0.0;
        let mut resonant_harmonic = 1;
        
        for h in 1..=walking.n_harmonics {
            let h_freq = h as f64 * walking.walking_freq;
            if (h_freq - floor.natural_frequency).abs() < 0.5 * floor.natural_frequency {
                let response = walking.resonant_force(h);
                if response > max_response {
                    max_response = response;
                    resonant_harmonic = h;
                }
            }
        }
        
        // AISC DG11 Equation 4.1
        let reduction_factor = 0.7; // Accounts for walking path not at center
        let peak_acc = reduction_factor * walking.resonant_force(resonant_harmonic) 
            * floor.mode_shape_factor 
            / (floor.modal_mass * 2.0 * floor.damping_ratio);
        
        // RMS is peak / sqrt(2) for sinusoidal response
        let rms_acc = peak_acc / 2.0_f64.sqrt();
        
        // Displacement from acceleration
        let omega = 2.0 * PI * floor.natural_frequency;
        let peak_disp = peak_acc / omega.powi(2) * 1000.0; // mm
        let peak_vel = peak_acc / omega * 1000.0; // mm/s
        
        // Response factor (ISO 10137 baseline 0.005 m/s² RMS)
        let response_factor = rms_acc / 0.005;
        
        // VDV for 8 hour exposure (simplified)
        let exposure_time: f64 = 8.0 * 3600.0; // seconds
        let vdv = peak_acc * exposure_time.powf(0.25) / 1.4;
        
        Self {
            peak_acceleration: peak_acc,
            rms_acceleration: rms_acc,
            peak_velocity: peak_vel,
            peak_displacement: peak_disp,
            response_factor,
            vdv,
        }
    }
    
    /// Calculate impulsive response for high-frequency floors
    pub fn impulsive_walking(floor: &FloorSystem, walking: &WalkingModel) -> Self {
        // AISC DG11 Equation 4.4 - for fn > 9 Hz
        let fn_hz = floor.natural_frequency;
        
        // Impulsive force approximation
        let impulse = walking.weight * 0.7 / walking.walking_freq;
        
        // Peak velocity
        let peak_vel = impulse / floor.modal_mass * 1000.0; // mm/s
        
        // Decay exponentially with frequency
        let decay_factor = (-0.35 * fn_hz).exp();
        let peak_vel_adj = peak_vel * decay_factor;
        
        // Convert to acceleration
        let omega = 2.0 * PI * fn_hz;
        let peak_acc = peak_vel_adj * omega / 1000.0;
        let rms_acc = peak_acc / 4.0; // Approximate for transient
        
        let peak_disp = peak_vel_adj / omega;
        let response_factor = rms_acc / 0.005;
        
        Self {
            peak_acceleration: peak_acc,
            rms_acceleration: rms_acc,
            peak_velocity: peak_vel_adj,
            peak_displacement: peak_disp,
            response_factor,
            vdv: 0.0, // Not applicable for impulsive
        }
    }
}

/// Acceptance criteria
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AcceptanceCriteria {
    /// Maximum acceleration (m/s²)
    pub max_acceleration: f64,
    /// Maximum response factor
    pub max_response_factor: f64,
    /// Maximum velocity (mm/s)
    pub max_velocity: f64,
    /// Standard/code reference
    pub reference: String,
}

impl AcceptanceCriteria {
    /// AISC DG11 criteria for offices
    pub fn aisc_office() -> Self {
        Self {
            max_acceleration: 0.05, // 0.5% g
            max_response_factor: 8.0,
            max_velocity: 15.0,
            reference: "AISC Design Guide 11".to_string(),
        }
    }
    
    /// AISC DG11 criteria for shopping/dining
    pub fn aisc_shopping() -> Self {
        Self {
            max_acceleration: 0.015,
            max_response_factor: 4.0,
            max_velocity: 10.0,
            reference: "AISC Design Guide 11".to_string(),
        }
    }
    
    /// AISC DG11 criteria for rhythmic activities
    pub fn aisc_rhythmic() -> Self {
        Self {
            max_acceleration: 0.05,
            max_response_factor: 8.0,
            max_velocity: 20.0,
            reference: "AISC Design Guide 11".to_string(),
        }
    }
    
    /// ISO 10137 criteria by occupancy
    pub fn iso_10137(occupancy: OccupancyType) -> Self {
        let (rf, reference) = match occupancy {
            OccupancyType::Office => (8.0, "ISO 10137 - Office"),
            OccupancyType::Residential => (4.0, "ISO 10137 - Residential (day)"),
            OccupancyType::Hospital => (2.0, "ISO 10137 - Hospital"),
            OccupancyType::Laboratory => (1.0, "ISO 10137 - Sensitive"),
            _ => (8.0, "ISO 10137 - General"),
        };
        
        Self {
            max_acceleration: rf * 0.005,
            max_response_factor: rf,
            max_velocity: rf * 1.0,
            reference: reference.to_string(),
        }
    }
    
    /// Check if response is acceptable
    pub fn check(&self, response: &VibrationResponse) -> VibrationCheck {
        let acc_ok = response.peak_acceleration <= self.max_acceleration;
        let rf_ok = response.response_factor <= self.max_response_factor;
        let vel_ok = response.peak_velocity <= self.max_velocity;
        
        let status = if acc_ok && rf_ok && vel_ok {
            CheckStatus::Pass
        } else if response.response_factor <= self.max_response_factor * 1.2 {
            CheckStatus::Marginal
        } else {
            CheckStatus::Fail
        };
        
        VibrationCheck {
            status,
            acceleration_ratio: response.peak_acceleration / self.max_acceleration,
            response_factor_ratio: response.response_factor / self.max_response_factor,
            velocity_ratio: response.peak_velocity / self.max_velocity,
            criteria_ref: self.reference.clone(),
        }
    }
}

/// Vibration check result
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VibrationCheck {
    /// Check status
    pub status: CheckStatus,
    /// Acceleration ratio (actual/limit)
    pub acceleration_ratio: f64,
    /// Response factor ratio
    pub response_factor_ratio: f64,
    /// Velocity ratio
    pub velocity_ratio: f64,
    /// Criteria reference
    pub criteria_ref: String,
}

/// Check status
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum CheckStatus {
    Pass,
    Marginal,
    Fail,
}

/// Rhythmic activity parameters
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RhythmicActivity {
    /// Activity type
    pub activity: ActivityType,
    /// Activity frequency (Hz)
    pub frequency: f64,
    /// Number of participants
    pub n_participants: usize,
    /// Dynamic load factor
    pub dlf: f64,
    /// Participant weight (N)
    pub weight_per_person: f64,
}

impl RhythmicActivity {
    /// Standard aerobics parameters
    pub fn aerobics(n_participants: usize) -> Self {
        Self {
            activity: ActivityType::Aerobics,
            frequency: 2.0, // 2 Hz typical
            n_participants,
            dlf: 1.5,
            weight_per_person: 750.0,
        }
    }
    
    /// Standard dancing parameters
    pub fn dancing(n_participants: usize) -> Self {
        Self {
            activity: ActivityType::Dancing,
            frequency: 2.5,
            n_participants,
            dlf: 1.3,
            weight_per_person: 750.0,
        }
    }
    
    /// Concert jumping parameters
    pub fn concert(n_participants: usize) -> Self {
        Self {
            activity: ActivityType::Concert,
            frequency: 2.0,
            n_participants,
            dlf: 2.0,
            weight_per_person: 750.0,
        }
    }
    
    /// Calculate total dynamic force
    pub fn total_dynamic_force(&self) -> f64 {
        self.n_participants as f64 * self.weight_per_person * self.dlf
    }
    
    /// Calculate resonant acceleration
    pub fn resonant_acceleration(&self, floor: &FloorSystem) -> f64 {
        // Check if resonant
        let freq_ratio = self.frequency / floor.natural_frequency;
        
        if freq_ratio < 0.8 || freq_ratio > 1.2 {
            // Not resonant - reduced response
            let dynamic_factor = 1.0 / ((1.0 - freq_ratio.powi(2)).powi(2) 
                + (2.0 * floor.damping_ratio * freq_ratio).powi(2)).sqrt();
            self.total_dynamic_force() * dynamic_factor / floor.modal_mass
        } else {
            // Resonant - amplified by 1/(2*zeta)
            self.total_dynamic_force() / (floor.modal_mass * 2.0 * floor.damping_ratio)
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    
    #[test]
    fn test_floor_system() {
        let mut floor = FloorSystem::new(8.0, 10.0, 400.0);
        
        assert_eq!(floor.span, 8.0);
        assert_eq!(floor.damping_ratio, 0.03);
        
        floor.set_damping(FloorFinish::BareSteel);
        assert_eq!(floor.damping_ratio, 0.01);
    }
    
    #[test]
    fn test_walking_model() {
        let walking = WalkingModel::aisc_standard(750.0, 2.0);
        
        assert_eq!(walking.weight, 750.0);
        assert_eq!(walking.n_harmonics, 4);
        
        let force = walking.force_at(0.0);
        assert!(force > 0.0);
    }
    
    #[test]
    fn test_resonant_force() {
        let walking = WalkingModel::aisc_standard(750.0, 2.0);
        
        let f1 = walking.resonant_force(1);
        let f2 = walking.resonant_force(2);
        
        assert!(f1 > f2); // First harmonic should be larger
        
        let f0 = walking.resonant_force(0);
        assert_eq!(f0, 0.0);
    }
    
    #[test]
    fn test_sci_walking_model() {
        let walking = WalkingModel::sci_model(700.0, 1.8);
        
        assert!(walking.fourier_coeffs[0] > 0.4);
    }
    
    #[test]
    fn test_vibration_response() {
        let mut floor = FloorSystem::new(7.0, 9.0, 350.0);
        floor.natural_frequency = 6.0;
        floor.modal_mass = 5000.0;
        floor.damping_ratio = 0.03;
        
        let walking = WalkingModel::aisc_standard(750.0, 2.0);
        
        let response = VibrationResponse::resonant_walking_aisc(&floor, &walking);
        
        assert!(response.peak_acceleration > 0.0);
        assert!(response.rms_acceleration > 0.0);
        assert!(response.response_factor > 0.0);
    }
    
    #[test]
    fn test_impulsive_response() {
        let mut floor = FloorSystem::new(5.0, 6.0, 400.0);
        floor.natural_frequency = 12.0;
        floor.modal_mass = 3000.0;
        
        let walking = WalkingModel::aisc_standard(750.0, 2.0);
        
        let response = VibrationResponse::impulsive_walking(&floor, &walking);
        
        assert!(response.peak_velocity > 0.0);
    }
    
    #[test]
    fn test_acceptance_criteria() {
        let criteria = AcceptanceCriteria::aisc_office();
        
        assert!(criteria.max_acceleration > 0.0);
        assert!(criteria.max_response_factor > 0.0);
    }
    
    #[test]
    fn test_vibration_check_pass() {
        let criteria = AcceptanceCriteria::aisc_office();
        
        let response = VibrationResponse {
            peak_acceleration: 0.02,
            rms_acceleration: 0.01,
            peak_velocity: 5.0,
            peak_displacement: 0.5,
            response_factor: 2.0,
            vdv: 0.1,
        };
        
        let check = criteria.check(&response);
        assert_eq!(check.status, CheckStatus::Pass);
    }
    
    #[test]
    fn test_vibration_check_fail() {
        let criteria = AcceptanceCriteria::aisc_office();
        
        let response = VibrationResponse {
            peak_acceleration: 0.1,
            rms_acceleration: 0.07,
            peak_velocity: 25.0,
            peak_displacement: 2.0,
            response_factor: 15.0,
            vdv: 0.5,
        };
        
        let check = criteria.check(&response);
        assert_eq!(check.status, CheckStatus::Fail);
    }
    
    #[test]
    fn test_iso_criteria() {
        let office = AcceptanceCriteria::iso_10137(OccupancyType::Office);
        let hospital = AcceptanceCriteria::iso_10137(OccupancyType::Hospital);
        
        assert!(hospital.max_response_factor < office.max_response_factor);
    }
    
    #[test]
    fn test_rhythmic_activity() {
        let aerobics = RhythmicActivity::aerobics(30);
        
        assert_eq!(aerobics.n_participants, 30);
        assert_eq!(aerobics.frequency, 2.0);
        
        let force = aerobics.total_dynamic_force();
        assert!(force > 0.0);
    }
    
    #[test]
    fn test_dancing_activity() {
        let dancing = RhythmicActivity::dancing(50);
        
        assert_eq!(dancing.activity, ActivityType::Dancing);
        assert_eq!(dancing.dlf, 1.3);
    }
    
    #[test]
    fn test_rhythmic_acceleration() {
        let concert = RhythmicActivity::concert(100);
        
        let mut floor = FloorSystem::new(10.0, 15.0, 500.0);
        floor.natural_frequency = 4.0;
        floor.modal_mass = 20000.0;
        floor.damping_ratio = 0.04;
        
        let acc = concert.resonant_acceleration(&floor);
        assert!(acc > 0.0);
    }
    
    #[test]
    fn test_floor_frequency_concrete() {
        let mut floor = FloorSystem::new(6.0, 6.0, 400.0);
        floor.estimate_frequency_concrete(0.15, 30.0);
        
        assert!(floor.natural_frequency > 0.0);
    }
    
    #[test]
    fn test_activity_types() {
        assert_ne!(ActivityType::Walking, ActivityType::Running);
        assert_eq!(ActivityType::Office, ActivityType::Office);
    }
}
