// ============================================================================
// VIBRATION CONTROL & ISOLATION MODULE
// Equipment isolation, TMD, base isolation refinements - ISO 10816, ASHRAE
// ============================================================================

use serde::{Deserialize, Serialize};
use std::f64::consts::PI;

// ============================================================================
// VIBRATION CRITERIA
// ============================================================================

/// Vibration sensitivity class (ISO 10816 / ASHRAE)
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum SensitivityClass {
    /// Workshop - high vibration acceptable
    Workshop,
    /// Office - moderate vibration
    Office,
    /// Residential - low vibration
    Residential,
    /// Operating theatre / precision lab
    OperatingTheatre,
    /// Optical/electron microscope
    Microscope,
    /// Semiconductor fab / nanotechnology
    Semiconductor,
}

impl SensitivityClass {
    /// Velocity limit (mm/s RMS)
    pub fn velocity_limit(&self) -> f64 {
        match self {
            SensitivityClass::Workshop => 1.0,
            SensitivityClass::Office => 0.4,
            SensitivityClass::Residential => 0.2,
            SensitivityClass::OperatingTheatre => 0.1,
            SensitivityClass::Microscope => 0.025,
            SensitivityClass::Semiconductor => 0.006,
        }
    }
    
    /// VC curve designation
    pub fn vc_curve(&self) -> &'static str {
        match self {
            SensitivityClass::Workshop => "Workshop",
            SensitivityClass::Office => "VC-A",
            SensitivityClass::Residential => "VC-B",
            SensitivityClass::OperatingTheatre => "VC-C",
            SensitivityClass::Microscope => "VC-D",
            SensitivityClass::Semiconductor => "VC-E",
        }
    }
    
    /// Maximum displacement amplitude at 10 Hz (μm)
    pub fn displacement_limit_10hz(&self) -> f64 {
        self.velocity_limit() * 1000.0 / (2.0 * PI * 10.0)
    }
}

/// Machine class (ISO 10816)
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum MachineClass {
    /// Class I: Small machines up to 15 kW
    ClassI,
    /// Class II: Medium machines 15-75 kW
    ClassII,
    /// Class III: Large rigid foundation machines
    ClassIII,
    /// Class IV: Large flexible foundation machines
    ClassIV,
}

impl MachineClass {
    /// Good condition velocity limit (mm/s RMS)
    pub fn good_limit(&self) -> f64 {
        match self {
            MachineClass::ClassI => 0.71,
            MachineClass::ClassII => 1.12,
            MachineClass::ClassIII => 1.8,
            MachineClass::ClassIV => 2.8,
        }
    }
    
    /// Satisfactory limit (mm/s RMS)
    pub fn satisfactory_limit(&self) -> f64 {
        match self {
            MachineClass::ClassI => 1.8,
            MachineClass::ClassII => 2.8,
            MachineClass::ClassIII => 4.5,
            MachineClass::ClassIV => 7.1,
        }
    }
    
    /// Unsatisfactory limit - action required (mm/s RMS)
    pub fn unsatisfactory_limit(&self) -> f64 {
        match self {
            MachineClass::ClassI => 4.5,
            MachineClass::ClassII => 7.1,
            MachineClass::ClassIII => 11.2,
            MachineClass::ClassIV => 18.0,
        }
    }
}

// ============================================================================
// EQUIPMENT VIBRATION ISOLATION
// ============================================================================

/// Isolator type
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum IsolatorType {
    /// Steel spring
    SteelSpring,
    /// Rubber pad
    RubberPad,
    /// Air spring (pneumatic)
    AirSpring,
    /// Cork pad
    Cork,
    /// Neoprene mount
    Neoprene,
    /// Wire rope isolator
    WireRope,
}

impl IsolatorType {
    /// Typical damping ratio
    pub fn damping_ratio(&self) -> f64 {
        match self {
            IsolatorType::SteelSpring => 0.01,
            IsolatorType::RubberPad => 0.05,
            IsolatorType::AirSpring => 0.02,
            IsolatorType::Cork => 0.06,
            IsolatorType::Neoprene => 0.05,
            IsolatorType::WireRope => 0.12,
        }
    }
    
    /// Typical frequency range (Hz)
    pub fn frequency_range(&self) -> (f64, f64) {
        match self {
            IsolatorType::SteelSpring => (1.5, 8.0),
            IsolatorType::RubberPad => (8.0, 25.0),
            IsolatorType::AirSpring => (0.5, 3.0),
            IsolatorType::Cork => (15.0, 40.0),
            IsolatorType::Neoprene => (5.0, 20.0),
            IsolatorType::WireRope => (3.0, 15.0),
        }
    }
}

/// Vibration isolator design
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VibrationIsolator {
    /// Isolator type
    pub isolator_type: IsolatorType,
    /// Equipment weight (kN)
    pub equipment_weight: f64,
    /// Operating frequency (Hz)
    pub operating_frequency: f64,
    /// Number of isolators
    pub num_isolators: u32,
    /// Required isolation efficiency (%)
    pub required_efficiency: f64,
}

impl VibrationIsolator {
    pub fn new(weight: f64, operating_freq: f64, efficiency: f64) -> Self {
        Self {
            isolator_type: IsolatorType::SteelSpring,
            equipment_weight: weight,
            operating_frequency: operating_freq,
            num_isolators: 4,
            required_efficiency: efficiency,
        }
    }
    
    /// Frequency ratio for desired isolation
    pub fn required_frequency_ratio(&self) -> f64 {
        let eff = self.required_efficiency / 100.0;
        let _zeta = self.isolator_type.damping_ratio();
        
        // T = 1 / sqrt((1-r²)² + (2ζr)²) = 1 - efficiency
        // For high efficiency, simplified: r = sqrt(1 + 1/(1-eff))
        ((1.0 + 1.0 / (1.0 - eff))).sqrt()
    }
    
    /// Required natural frequency (Hz)
    pub fn required_natural_frequency(&self) -> f64 {
        self.operating_frequency / self.required_frequency_ratio()
    }
    
    /// Required static deflection (mm)
    pub fn required_static_deflection(&self) -> f64 {
        let fn_hz = self.required_natural_frequency();
        
        // fn = (1/2π) * sqrt(g/δ) -> δ = g / (2π*fn)²
        9810.0 / (2.0 * PI * fn_hz).powi(2)
    }
    
    /// Required stiffness per isolator (kN/m)
    pub fn required_stiffness_per_isolator(&self) -> f64 {
        let k_total = self.equipment_weight / (self.required_static_deflection() / 1000.0);
        k_total / (self.num_isolators as f64)
    }
    
    /// Transmissibility at operating frequency
    pub fn transmissibility(&self, natural_freq: f64) -> f64 {
        let r = self.operating_frequency / natural_freq;
        let zeta = self.isolator_type.damping_ratio();
        
        let num = 1.0 + (2.0 * zeta * r).powi(2);
        let den = (1.0 - r.powi(2)).powi(2) + (2.0 * zeta * r).powi(2);
        
        (num / den).sqrt()
    }
    
    /// Isolation efficiency at operating frequency
    pub fn isolation_efficiency(&self, natural_freq: f64) -> f64 {
        let t = self.transmissibility(natural_freq);
        (1.0 - t).max(0.0) * 100.0
    }
    
    /// Transmitted force (kN)
    pub fn transmitted_force(&self, disturbing_force: f64, natural_freq: f64) -> f64 {
        disturbing_force * self.transmissibility(natural_freq)
    }
    
    /// Recommend isolator type
    pub fn recommend_isolator(&self) -> IsolatorType {
        let fn_req = self.required_natural_frequency();
        
        if fn_req < 2.0 {
            IsolatorType::AirSpring
        } else if fn_req < 5.0 {
            IsolatorType::SteelSpring
        } else if fn_req < 15.0 {
            IsolatorType::Neoprene
        } else {
            IsolatorType::RubberPad
        }
    }
}

// ============================================================================
// INERTIA BASE
// ============================================================================

/// Inertia base (concrete block) for equipment
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct InertiaBase {
    /// Length (m)
    pub length: f64,
    /// Width (m)
    pub width: f64,
    /// Height (m)
    pub height: f64,
    /// Concrete density (kN/m³)
    pub density: f64,
    /// Equipment mass on base (kg)
    pub equipment_mass: f64,
}

impl InertiaBase {
    pub fn new(length: f64, width: f64, height: f64) -> Self {
        Self {
            length,
            width,
            height,
            density: 24.0,
            equipment_mass: 0.0,
        }
    }
    
    /// Block volume (m³)
    pub fn volume(&self) -> f64 {
        self.length * self.width * self.height
    }
    
    /// Block weight (kN)
    pub fn weight(&self) -> f64 {
        self.volume() * self.density
    }
    
    /// Block mass (kg)
    pub fn mass(&self) -> f64 {
        self.weight() * 1000.0 / 9.81
    }
    
    /// Total mass including equipment (kg)
    pub fn total_mass(&self) -> f64 {
        self.mass() + self.equipment_mass
    }
    
    /// Mass ratio (block/equipment)
    pub fn mass_ratio(&self) -> f64 {
        if self.equipment_mass > 0.0 {
            self.mass() / self.equipment_mass
        } else {
            0.0
        }
    }
    
    /// Center of gravity height (m)
    pub fn cg_height(&self) -> f64 {
        let block_cg = self.height / 2.0;
        let equip_cg = self.height + 0.5; // Assume equipment CG 0.5m above base
        
        (self.mass() * block_cg + self.equipment_mass * equip_cg) / self.total_mass()
    }
    
    /// Moment of inertia about vertical axis (kg·m²)
    pub fn moment_of_inertia_vertical(&self) -> f64 {
        self.mass() * (self.length.powi(2) + self.width.powi(2)) / 12.0
    }
    
    /// Rocking frequency (Hz) on isolators
    pub fn rocking_frequency(&self, k_vertical: f64, spacing: f64) -> f64 {
        let i_rock = self.total_mass() * self.height.powi(2) / 3.0;
        let k_rock = k_vertical * spacing.powi(2);
        
        (k_rock / i_rock).sqrt() / (2.0 * PI)
    }
    
    /// Minimum mass ratio recommendation
    pub fn recommended_mass_ratio(&self, unbalance_force: f64) -> f64 {
        // Rule of thumb: base mass >= 3-5× equipment for reciprocating
        // Higher for impact machines
        if unbalance_force > 10.0 {
            5.0
        } else {
            3.0
        }
    }
}

// ============================================================================
// TUNED MASS DAMPER
// ============================================================================

/// Tuned mass damper (TMD)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TunedMassDamper {
    /// Main structure mass (tonnes)
    pub structure_mass: f64,
    /// Main structure frequency (Hz)
    pub structure_frequency: f64,
    /// Main structure damping ratio
    pub structure_damping: f64,
    /// TMD mass ratio (μ = m_d / m_s)
    pub mass_ratio: f64,
}

impl TunedMassDamper {
    pub fn new(structure_mass: f64, structure_freq: f64, mass_ratio: f64) -> Self {
        Self {
            structure_mass,
            structure_frequency: structure_freq,
            structure_damping: 0.02,
            mass_ratio,
        }
    }
    
    /// TMD mass (tonnes)
    pub fn tmd_mass(&self) -> f64 {
        self.structure_mass * self.mass_ratio
    }
    
    /// Optimal tuning ratio (Den Hartog)
    pub fn optimal_tuning_ratio(&self) -> f64 {
        1.0 / (1.0 + self.mass_ratio)
    }
    
    /// Optimal TMD frequency (Hz)
    pub fn optimal_tmd_frequency(&self) -> f64 {
        self.structure_frequency * self.optimal_tuning_ratio()
    }
    
    /// Optimal TMD damping ratio (Den Hartog)
    pub fn optimal_tmd_damping(&self) -> f64 {
        (3.0 * self.mass_ratio / (8.0 * (1.0 + self.mass_ratio))).sqrt()
    }
    
    /// Required TMD stiffness (kN/m)
    pub fn required_tmd_stiffness(&self) -> f64 {
        let m = self.tmd_mass() * 1000.0; // kg
        let omega = 2.0 * PI * self.optimal_tmd_frequency();
        
        m * omega.powi(2) / 1000.0
    }
    
    /// Required TMD damping coefficient (kN·s/m)
    pub fn required_tmd_damping_coef(&self) -> f64 {
        let m = self.tmd_mass() * 1000.0;
        let omega = 2.0 * PI * self.optimal_tmd_frequency();
        let zeta = self.optimal_tmd_damping();
        
        2.0 * zeta * m * omega / 1000.0
    }
    
    /// Response reduction factor (approximate)
    pub fn response_reduction(&self) -> f64 {
        // Simplified formula for optimal TMD
        let mu = self.mass_ratio;
        
        (1.0 + mu / 2.0).sqrt() / (1.0 + mu).sqrt()
    }
    
    /// Effective damping added to structure
    pub fn effective_damping(&self) -> f64 {
        let mu = self.mass_ratio;
        
        // Approximate added damping
        (mu / 2.0).sqrt() / 2.0
    }
    
    /// TMD stroke requirement (mm) for given structure amplitude
    pub fn tmd_stroke(&self, structure_amplitude: f64) -> f64 {
        // TMD moves more than structure
        let amplification = 1.0 / self.optimal_tmd_damping() / 2.0;
        structure_amplitude * amplification
    }
}

// ============================================================================
// FLOOR VIBRATION (AISC DG11 / SCI P354 Extension)
// ============================================================================

/// Walking excitation model
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum WalkingModel {
    /// AISC Design Guide 11
    AiscDg11,
    /// SCI P354
    SciP354,
    /// ISO 10137
    Iso10137,
}

/// Floor vibration assessment
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FloorVibrationControl {
    /// Floor natural frequency (Hz)
    pub natural_frequency: f64,
    /// Modal mass (kg)
    pub modal_mass: f64,
    /// Damping ratio
    pub damping_ratio: f64,
    /// Walking model
    pub model: WalkingModel,
}

impl FloorVibrationControl {
    pub fn new(freq: f64, mass: f64, damping: f64) -> Self {
        Self {
            natural_frequency: freq,
            modal_mass: mass,
            damping_ratio: damping,
            model: WalkingModel::AiscDg11,
        }
    }
    
    /// Walking force dynamic load factor
    pub fn walking_dlf(&self, harmonic: u32) -> f64 {
        // Typical Fourier coefficients
        match harmonic {
            1 => 0.4,
            2 => 0.1,
            3 => 0.1,
            4 => 0.05,
            _ => 0.0,
        }
    }
    
    /// Resonant harmonic for walking pace (1.8-2.2 Hz typical)
    pub fn resonant_harmonic(&self, walking_pace: f64) -> Option<u32> {
        for h in 1..=4 {
            let excitation_freq = h as f64 * walking_pace;
            if (excitation_freq - self.natural_frequency).abs() < 0.5 {
                return Some(h);
            }
        }
        None
    }
    
    /// Peak acceleration (m/s²) - resonant response
    pub fn peak_acceleration_resonant(&self, walker_weight: f64) -> f64 {
        let p0 = walker_weight * 9.81; // N
        let alpha = self.walking_dlf(1);
        let m = self.modal_mass;
        let zeta = self.damping_ratio;
        
        alpha * p0 / (2.0 * zeta * m * 9.81) * 9.81
    }
    
    /// RMS acceleration (m/s²)
    pub fn rms_acceleration(&self, walker_weight: f64) -> f64 {
        self.peak_acceleration_resonant(walker_weight) / 2.0_f64.sqrt()
    }
    
    /// Response factor (R) per AISC DG11
    pub fn response_factor(&self, walker_weight: f64) -> f64 {
        let ap = self.peak_acceleration_resonant(walker_weight);
        let g = 9.81;
        
        // R = ap / (0.5% g baseline)
        ap / (0.005 * g)
    }
    
    /// Acceptable for occupancy type?
    pub fn is_acceptable(&self, occupancy: SensitivityClass, walker_weight: f64) -> bool {
        let velocity = self.rms_acceleration(walker_weight) / (2.0 * PI * self.natural_frequency) * 1000.0;
        velocity < occupancy.velocity_limit()
    }
    
    /// Required damping for acceptable response
    pub fn required_damping(&self, target_acceleration: f64, walker_weight: f64) -> f64 {
        let p0 = walker_weight * 9.81;
        let alpha = self.walking_dlf(1);
        let m = self.modal_mass;
        
        alpha * p0 / (2.0 * target_acceleration * m)
    }
}

// ============================================================================
// TESTS
// ============================================================================

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_sensitivity_class() {
        assert!(SensitivityClass::Workshop.velocity_limit() > 
                SensitivityClass::Semiconductor.velocity_limit());
    }

    #[test]
    fn test_machine_class() {
        assert!(MachineClass::ClassIV.satisfactory_limit() > 
                MachineClass::ClassI.satisfactory_limit());
    }

    #[test]
    fn test_isolator() {
        let iso = VibrationIsolator::new(50.0, 25.0, 90.0);
        
        assert!(iso.required_natural_frequency() < iso.operating_frequency);
    }

    #[test]
    fn test_static_deflection() {
        let iso = VibrationIsolator::new(50.0, 25.0, 90.0);
        let defl = iso.required_static_deflection();
        
        assert!(defl > 1.0 && defl < 100.0);
    }

    #[test]
    fn test_transmissibility() {
        let iso = VibrationIsolator::new(50.0, 25.0, 90.0);
        let t = iso.transmissibility(5.0); // 5 Hz natural freq
        
        assert!(t < 1.0); // Should isolate at r > sqrt(2)
    }

    #[test]
    fn test_isolator_recommendation() {
        let iso = VibrationIsolator::new(50.0, 5.0, 80.0);
        let recommended = iso.recommend_isolator();
        
        // Low freq should recommend air spring or steel spring
        assert!(matches!(recommended, IsolatorType::AirSpring | IsolatorType::SteelSpring));
    }

    #[test]
    fn test_inertia_base() {
        let base = InertiaBase::new(3.0, 2.0, 1.0);
        
        assert!((base.volume() - 6.0).abs() < 0.01);
    }

    #[test]
    fn test_base_mass_ratio() {
        let mut base = InertiaBase::new(3.0, 2.0, 1.0);
        base.equipment_mass = 2000.0;
        
        assert!(base.mass_ratio() > 2.0);
    }

    #[test]
    fn test_tmd() {
        let tmd = TunedMassDamper::new(1000.0, 2.0, 0.02);
        
        assert!(tmd.tmd_mass() > 15.0 && tmd.tmd_mass() < 25.0);
    }

    #[test]
    fn test_tmd_optimal() {
        let tmd = TunedMassDamper::new(1000.0, 2.0, 0.02);
        
        assert!(tmd.optimal_tmd_frequency() < tmd.structure_frequency);
        assert!(tmd.optimal_tmd_damping() > 0.05);
    }

    #[test]
    fn test_tmd_reduction() {
        let tmd = TunedMassDamper::new(1000.0, 2.0, 0.02);
        
        assert!(tmd.response_reduction() < 1.0);
    }

    #[test]
    fn test_floor_vibration() {
        let floor = FloorVibrationControl::new(6.0, 50000.0, 0.03);
        let ap = floor.peak_acceleration_resonant(75.0);
        
        assert!(ap > 0.0 && ap < 1.0);
    }

    #[test]
    fn test_response_factor() {
        let floor = FloorVibrationControl::new(6.0, 50000.0, 0.03);
        let r = floor.response_factor(75.0);
        
        assert!(r > 0.0);
    }

    #[test]
    fn test_isolator_type_damping() {
        assert!(IsolatorType::WireRope.damping_ratio() > IsolatorType::SteelSpring.damping_ratio());
    }
}
