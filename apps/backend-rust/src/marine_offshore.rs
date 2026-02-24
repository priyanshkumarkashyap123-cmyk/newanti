// ============================================================================
// MARINE & OFFSHORE STRUCTURES MODULE
// API RP2A, ISO 19902, DNV-OS - Offshore platform design
// ============================================================================

use serde::{Deserialize, Serialize};
use std::f64::consts::PI;

// ============================================================================
// STRUCTURE TYPES
// ============================================================================

/// Offshore structure type
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum OffshoreType {
    /// Fixed jacket platform
    Jacket,
    /// Jack-up platform
    JackUp,
    /// Gravity-based structure
    GravityBased,
    /// Tension leg platform
    TensionLeg,
    /// Semi-submersible
    SemiSubmersible,
    /// FPSO
    Fpso,
    /// Monopile (wind turbine)
    Monopile,
    /// Tripod foundation
    Tripod,
}

/// Exposure category
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum ExposureCategory {
    /// L1 - Manned, non-evacuated
    L1,
    /// L2 - Manned, evacuated
    L2,
    /// L3 - Unmanned
    L3,
}

impl ExposureCategory {
    /// Load factor for environmental loads
    pub fn load_factor(&self) -> f64 {
        match self {
            ExposureCategory::L1 => 1.35,
            ExposureCategory::L2 => 1.25,
            ExposureCategory::L3 => 1.15,
        }
    }
    
    /// Return period for design wave (years)
    pub fn return_period(&self) -> u32 {
        match self {
            ExposureCategory::L1 => 100,
            ExposureCategory::L2 => 100,
            ExposureCategory::L3 => 50,
        }
    }
}

// ============================================================================
// WAVE LOADING
// ============================================================================

/// Wave parameters
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WaveData {
    /// Significant wave height Hs (m)
    pub hs: f64,
    /// Peak period Tp (s)
    pub tp: f64,
    /// Maximum wave height Hmax (m)
    pub hmax: f64,
    /// Associated period Tmax (s)
    pub tmax: f64,
    /// Water depth (m)
    pub water_depth: f64,
    /// Current velocity at surface (m/s)
    pub current_surface: f64,
    /// Current velocity at seabed (m/s)
    pub current_seabed: f64,
}

impl WaveData {
    pub fn new(hs: f64, tp: f64, water_depth: f64) -> Self {
        // Maximum wave height approximation
        let hmax = 1.86 * hs;
        let tmax = tp * 0.9;
        
        Self {
            hs,
            tp,
            hmax,
            tmax,
            water_depth,
            current_surface: 1.0,
            current_seabed: 0.5,
        }
    }
    
    /// Wave length (m) - deep water
    pub fn wave_length(&self) -> f64 {
        let g = 9.81;
        g * self.tmax.powi(2) / (2.0 * PI)
    }
    
    /// Wave number k (1/m)
    pub fn wave_number(&self) -> f64 {
        2.0 * PI / self.wave_length()
    }
    
    /// Check if deep water condition
    pub fn is_deep_water(&self) -> bool {
        self.water_depth / self.wave_length() > 0.5
    }
    
    /// Horizontal water particle velocity at depth z (m/s)
    /// z is measured from still water level (negative downward)
    pub fn horizontal_velocity(&self, z: f64) -> f64 {
        let h = self.hmax;
        let t = self.tmax;
        let d = self.water_depth;
        let k = self.wave_number();
        let _omega = 2.0 * PI / t;
        
        if self.is_deep_water() {
            // Deep water (Airy theory)
            PI * h / t * (k * z).exp()
        } else {
            // Shallow water
            PI * h / t * (k * (d + z)).cosh() / (k * d).sinh()
        }
    }
    
    /// Horizontal water particle acceleration at depth z (m/s²)
    pub fn horizontal_acceleration(&self, z: f64) -> f64 {
        let h = self.hmax;
        let t = self.tmax;
        let d = self.water_depth;
        let k = self.wave_number();
        let _omega = 2.0 * PI / t;
        
        if self.is_deep_water() {
            2.0 * PI.powi(2) * h / t.powi(2) * (k * z).exp()
        } else {
            2.0 * PI.powi(2) * h / t.powi(2) * (k * (d + z)).cosh() / (k * d).sinh()
        }
    }
    
    /// Current velocity at depth z (m/s) - linear interpolation
    pub fn current_velocity(&self, z: f64) -> f64 {
        let ratio = (self.water_depth + z) / self.water_depth;
        self.current_seabed + (self.current_surface - self.current_seabed) * ratio
    }
}

// ============================================================================
// MORISON EQUATION
// ============================================================================

/// Morison equation parameters for a member
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MorisonMember {
    /// Member diameter (m)
    pub diameter: f64,
    /// Member length (m)
    pub length: f64,
    /// Top elevation from seabed (m)
    pub top_elevation: f64,
    /// Bottom elevation from seabed (m)
    pub bottom_elevation: f64,
    /// Drag coefficient Cd
    pub cd: f64,
    /// Inertia coefficient Cm
    pub cm: f64,
    /// Marine growth thickness (m)
    pub marine_growth: f64,
}

impl MorisonMember {
    pub fn new(diameter: f64, top: f64, bottom: f64) -> Self {
        Self {
            diameter,
            length: top - bottom,
            top_elevation: top,
            bottom_elevation: bottom,
            cd: 0.65,  // Smooth cylinder
            cm: 1.6,
            marine_growth: 0.0,
        }
    }
    
    pub fn with_marine_growth(mut self, thickness: f64) -> Self {
        self.marine_growth = thickness;
        self.cd = 1.05; // Rough cylinder
        self
    }
    
    /// Effective diameter including marine growth (m)
    pub fn effective_diameter(&self) -> f64 {
        self.diameter + 2.0 * self.marine_growth
    }
    
    /// Wave force on segment at elevation z (kN/m)
    pub fn wave_force_per_length(&self, wave: &WaveData, z: f64) -> f64 {
        let d_eff = self.effective_diameter();
        let rho = 1025.0; // Seawater density kg/m³
        
        let u = wave.horizontal_velocity(z - wave.water_depth) + 
                wave.current_velocity(z - wave.water_depth);
        let a = wave.horizontal_acceleration(z - wave.water_depth);
        
        // Drag force
        let fd = 0.5 * rho * self.cd * d_eff * u.abs() * u / 1000.0;
        
        // Inertia force
        let fi = rho * self.cm * PI * d_eff.powi(2) / 4.0 * a / 1000.0;
        
        fd + fi
    }
    
    /// Total wave force on member (kN)
    pub fn total_wave_force(&self, wave: &WaveData) -> f64 {
        let n = 20;
        let dz = self.length / (n as f64);
        let mut total = 0.0;
        
        for i in 0..n {
            let z = self.bottom_elevation + (i as f64 + 0.5) * dz;
            if z <= wave.water_depth {
                total += self.wave_force_per_length(wave, z) * dz;
            }
        }
        
        total
    }
    
    /// Overturning moment about seabed (kN·m)
    pub fn overturning_moment(&self, wave: &WaveData) -> f64 {
        let n = 20;
        let dz = self.length / (n as f64);
        let mut moment = 0.0;
        
        for i in 0..n {
            let z = self.bottom_elevation + (i as f64 + 0.5) * dz;
            if z <= wave.water_depth {
                let f = self.wave_force_per_length(wave, z) * dz;
                moment += f * z;
            }
        }
        
        moment
    }
}

// ============================================================================
// TUBULAR JOINT DESIGN (API RP2A)
// ============================================================================

/// Tubular joint types
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum JointType {
    /// T/Y joint
    TY,
    /// K joint
    K,
    /// X joint (cross)
    X,
    /// KT joint
    KT,
}

/// Tubular joint configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TubularJoint {
    /// Chord outer diameter (m)
    pub chord_od: f64,
    /// Chord wall thickness (m)
    pub chord_t: f64,
    /// Brace outer diameter (m)
    pub brace_od: f64,
    /// Brace wall thickness (m)
    pub brace_t: f64,
    /// Brace angle from chord axis (degrees)
    pub theta: f64,
    /// Joint type
    pub joint_type: JointType,
    /// Gap between braces for K-joint (m)
    pub gap: Option<f64>,
}

impl TubularJoint {
    pub fn new(chord_od: f64, chord_t: f64, brace_od: f64, brace_t: f64, theta: f64) -> Self {
        Self {
            chord_od,
            chord_t,
            brace_od,
            brace_t,
            theta,
            joint_type: JointType::TY,
            gap: None,
        }
    }
    
    /// Beta ratio (brace/chord diameter)
    pub fn beta(&self) -> f64 {
        self.brace_od / self.chord_od
    }
    
    /// Gamma ratio (chord radius/thickness)
    pub fn gamma(&self) -> f64 {
        self.chord_od / (2.0 * self.chord_t)
    }
    
    /// Tau ratio (brace/chord thickness)
    pub fn tau(&self) -> f64 {
        self.brace_t / self.chord_t
    }
    
    /// Chord stress utilization factor Qf
    pub fn qf(&self, chord_stress_ratio: f64) -> f64 {
        (1.0 - chord_stress_ratio.abs()).max(0.0)
    }
    
    /// Punching shear parameter Qbeta
    pub fn qbeta(&self) -> f64 {
        let beta = self.beta();
        
        if beta <= 0.6 {
            1.0
        } else {
            0.3 / (beta * (1.0 - 0.833 * beta))
        }
    }
    
    /// Ultimate strength factor Qu for axial load
    pub fn qu_axial(&self) -> f64 {
        let beta = self.beta();
        let gamma = self.gamma();
        let _theta = self.theta.to_radians();
        
        match self.joint_type {
            JointType::TY => {
                (2.8 + (14.0 + 0.7 * gamma) * beta.powi(2)) * self.qbeta()
            }
            JointType::K => {
                let zeta = self.gap.unwrap_or(0.05) / self.chord_od;
                (1.9 + 10.0 * beta.powf(1.5)) * (1.0 + 0.25 * zeta) * self.qbeta()
            }
            JointType::X => {
                (2.0 + 11.0 * beta.powf(1.5)) * self.qbeta()
            }
            JointType::KT => {
                (1.7 + 8.0 * beta.powf(1.5)) * self.qbeta()
            }
        }
    }
    
    /// Punching shear capacity (kN)
    pub fn punching_shear_capacity(&self, fy_chord: f64) -> f64 {
        let qu = self.qu_axial();
        let t = self.chord_t;
        let theta = self.theta.to_radians();
        
        qu * fy_chord * t.powi(2) / theta.sin() / 1000.0
    }
    
    /// Simple joint capacity (kN)
    pub fn joint_capacity(&self, fy_chord: f64) -> f64 {
        let ps = self.punching_shear_capacity(fy_chord);
        
        // Apply factors
        ps * 0.95 // Safety factor
    }
}

// ============================================================================
// JACKET STRUCTURE ANALYSIS
// ============================================================================

/// Simple jacket platform model
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct JacketPlatform {
    /// Water depth (m)
    pub water_depth: f64,
    /// Deck elevation above water (m)
    pub deck_elevation: f64,
    /// Number of legs
    pub num_legs: u32,
    /// Leg spacing at mudline (m)
    pub base_spacing: f64,
    /// Leg spacing at waterline (m)
    pub top_spacing: f64,
    /// Leg diameter (m)
    pub leg_diameter: f64,
    /// Leg wall thickness (m)
    pub leg_thickness: f64,
    /// Number of brace levels
    pub brace_levels: u32,
    /// Topside weight (kN)
    pub topside_weight: f64,
}

impl JacketPlatform {
    pub fn new(water_depth: f64) -> Self {
        Self {
            water_depth,
            deck_elevation: 15.0,
            num_legs: 4,
            base_spacing: water_depth * 0.6,
            top_spacing: water_depth * 0.3,
            leg_diameter: 1.5,
            leg_thickness: 0.05,
            brace_levels: 4,
            topside_weight: 10000.0,
        }
    }
    
    /// Batter angle (degrees)
    pub fn batter(&self) -> f64 {
        let height = self.water_depth + self.deck_elevation;
        let spread = (self.base_spacing - self.top_spacing) / 2.0;
        (spread / height).atan().to_degrees()
    }
    
    /// Total structural weight (approximate, kN)
    pub fn structural_weight(&self) -> f64 {
        let height = self.water_depth + self.deck_elevation;
        let leg_length = height / self.batter().to_radians().cos();
        
        // Leg weight
        let leg_area = PI * (self.leg_diameter - self.leg_thickness) * self.leg_thickness;
        let leg_weight = self.num_legs as f64 * leg_area * leg_length * 78.5; // Steel density
        
        // Brace weight (approximate 30% of legs)
        let brace_weight = leg_weight * 0.3;
        
        leg_weight + brace_weight
    }
    
    /// Base shear from environmental loads (kN)
    pub fn base_shear(&self, wave: &WaveData, wind_force: f64) -> f64 {
        // Wave force on legs
        let member = MorisonMember::new(
            self.leg_diameter,
            self.water_depth,
            0.0
        ).with_marine_growth(0.05);
        
        let wave_shear = member.total_wave_force(wave) * self.num_legs as f64;
        
        // Wind force on deck
        wave_shear + wind_force
    }
    
    /// Overturning moment about mudline (kN·m)
    pub fn overturning_moment(&self, wave: &WaveData, wind_force: f64) -> f64 {
        let member = MorisonMember::new(
            self.leg_diameter,
            self.water_depth,
            0.0
        ).with_marine_growth(0.05);
        
        let wave_moment = member.overturning_moment(wave) * self.num_legs as f64;
        
        // Wind moment
        let wind_arm = self.water_depth + self.deck_elevation / 2.0;
        let wind_moment = wind_force * wind_arm;
        
        wave_moment + wind_moment
    }
    
    /// Foundation reaction at corner pile (kN)
    pub fn pile_reaction(&self, wave: &WaveData, wind_force: f64) -> f64 {
        let m = self.overturning_moment(wave, wind_force);
        let p = self.topside_weight + self.structural_weight();
        
        let lever_arm = self.base_spacing / 2.0 * 1.414; // Diagonal
        let n = self.num_legs as f64;
        
        // Maximum pile load
        p / n + m / (lever_arm * n / 2.0)
    }
}

// ============================================================================
// CATHODIC PROTECTION
// ============================================================================

/// Cathodic protection design
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CathodicProtection {
    /// Total surface area to protect (m²)
    pub surface_area: f64,
    /// Current density requirement (mA/m²)
    pub current_density: f64,
    /// Design life (years)
    pub design_life: u32,
    /// Anode type
    pub anode_type: AnodeType,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum AnodeType {
    /// Aluminum anode
    Aluminum,
    /// Zinc anode
    Zinc,
    /// Magnesium anode (for fresh water)
    Magnesium,
}

impl AnodeType {
    /// Anode capacity (A·h/kg)
    pub fn capacity(&self) -> f64 {
        match self {
            AnodeType::Aluminum => 2500.0,
            AnodeType::Zinc => 780.0,
            AnodeType::Magnesium => 1100.0,
        }
    }
    
    /// Anode utilization factor
    pub fn utilization(&self) -> f64 {
        0.85
    }
}

impl CathodicProtection {
    pub fn new(surface_area: f64, design_life: u32) -> Self {
        Self {
            surface_area,
            current_density: 110.0, // Typical for bare steel in seawater
            design_life,
            anode_type: AnodeType::Aluminum,
        }
    }
    
    /// Total current required (A)
    pub fn total_current(&self) -> f64 {
        self.surface_area * self.current_density / 1000.0
    }
    
    /// Total charge required (A·h)
    pub fn total_charge(&self) -> f64 {
        self.total_current() * (self.design_life as f64) * 8760.0
    }
    
    /// Total anode mass required (kg)
    pub fn anode_mass(&self) -> f64 {
        self.total_charge() / (self.anode_type.capacity() * self.anode_type.utilization())
    }
    
    /// Number of anodes required (given individual mass)
    pub fn num_anodes(&self, anode_mass: f64) -> u32 {
        (self.anode_mass() / anode_mass).ceil() as u32
    }
}

// ============================================================================
// TESTS
// ============================================================================

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_wave_data() {
        let wave = WaveData::new(10.0, 14.0, 50.0);
        
        assert!((wave.hmax - 18.6).abs() < 0.1);
    }

    #[test]
    fn test_wave_length() {
        let wave = WaveData::new(10.0, 14.0, 100.0);
        let l = wave.wave_length();
        
        assert!(l > 200.0 && l < 400.0);
    }

    #[test]
    fn test_deep_water() {
        let deep = WaveData::new(5.0, 8.0, 200.0);
        let shallow = WaveData::new(5.0, 8.0, 20.0);
        
        assert!(deep.is_deep_water());
        assert!(!shallow.is_deep_water());
    }

    #[test]
    fn test_particle_velocity() {
        let wave = WaveData::new(10.0, 14.0, 50.0);
        
        let v_surface = wave.horizontal_velocity(0.0);
        let v_mid = wave.horizontal_velocity(-25.0);
        
        assert!(v_surface > v_mid);
    }

    #[test]
    fn test_morison_member() {
        let member = MorisonMember::new(1.0, 30.0, 0.0);
        
        assert_eq!(member.length, 30.0);
        assert_eq!(member.effective_diameter(), 1.0);
    }

    #[test]
    fn test_marine_growth() {
        let member = MorisonMember::new(1.0, 30.0, 0.0).with_marine_growth(0.1);
        
        assert_eq!(member.effective_diameter(), 1.2);
        assert!(member.cd > 1.0);
    }

    #[test]
    fn test_wave_force() {
        let wave = WaveData::new(10.0, 14.0, 50.0);
        let member = MorisonMember::new(1.5, 50.0, 0.0);
        
        let force = member.total_wave_force(&wave);
        
        assert!(force > 0.0);
    }

    #[test]
    fn test_tubular_joint_ratios() {
        let joint = TubularJoint::new(1.2, 0.05, 0.6, 0.025, 45.0);
        
        assert!((joint.beta() - 0.5).abs() < 0.001);
        assert!((joint.gamma() - 12.0).abs() < 0.001);
        assert!((joint.tau() - 0.5).abs() < 0.001);
    }

    #[test]
    fn test_joint_capacity() {
        let joint = TubularJoint::new(1.2, 0.05, 0.6, 0.025, 45.0);
        let cap = joint.joint_capacity(345.0);
        
        assert!(cap > 0.0);
    }

    #[test]
    fn test_jacket_platform() {
        let jacket = JacketPlatform::new(50.0);
        
        assert!(jacket.batter() > 0.0);
        assert!(jacket.structural_weight() > 0.0);
    }

    #[test]
    fn test_jacket_loads() {
        let jacket = JacketPlatform::new(50.0);
        let wave = WaveData::new(10.0, 14.0, 50.0);
        
        let shear = jacket.base_shear(&wave, 1000.0);
        let moment = jacket.overturning_moment(&wave, 1000.0);
        
        assert!(shear > 0.0);
        assert!(moment > 0.0);
    }

    #[test]
    fn test_pile_reaction() {
        let jacket = JacketPlatform::new(50.0);
        let wave = WaveData::new(10.0, 14.0, 50.0);
        
        let reaction = jacket.pile_reaction(&wave, 1000.0);
        
        assert!(reaction > 0.0);
    }

    #[test]
    fn test_cathodic_protection() {
        let cp = CathodicProtection::new(5000.0, 25);
        
        let current = cp.total_current();
        let mass = cp.anode_mass();
        
        assert!(current > 0.0);
        assert!(mass > 0.0);
    }

    #[test]
    fn test_anode_count() {
        let cp = CathodicProtection::new(5000.0, 25);
        let num = cp.num_anodes(200.0);
        
        assert!(num > 0);
    }

    #[test]
    fn test_exposure_categories() {
        assert!(ExposureCategory::L1.load_factor() > ExposureCategory::L3.load_factor());
    }

    #[test]
    fn test_joint_types() {
        let ty = TubularJoint::new(1.2, 0.05, 0.6, 0.025, 45.0);
        let mut k = ty.clone();
        k.joint_type = JointType::K;
        k.gap = Some(0.1);
        
        assert!(ty.qu_axial() != k.qu_axial());
    }
}
