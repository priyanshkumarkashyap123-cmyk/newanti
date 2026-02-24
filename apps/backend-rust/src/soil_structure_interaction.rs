// ============================================================================
// SOIL-STRUCTURE INTERACTION MODULE
// Dynamic foundation modeling, impedance functions, subgrade reaction
// ============================================================================

use serde::{Deserialize, Serialize};
use std::f64::consts::PI;

// ============================================================================
// FOUNDATION IMPEDANCE
// ============================================================================

/// Foundation type for SSI
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum FoundationType {
    /// Shallow mat/raft
    ShallowMat,
    /// Pile group
    PileGroup,
    /// Deep caisson
    Caisson,
    /// Embedded box
    EmbeddedBox,
}

/// Soil profile for SSI
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SoilProfile {
    /// Shear wave velocity (m/s)
    pub vs: f64,
    /// Mass density (kg/m³)
    pub rho: f64,
    /// Poisson's ratio
    pub poisson: f64,
    /// Damping ratio
    pub damping: f64,
    /// Layer thickness (m)
    pub thickness: f64,
}

impl SoilProfile {
    pub fn new(vs: f64, rho: f64) -> Self {
        Self {
            vs,
            rho,
            poisson: 0.3,
            damping: 0.05,
            thickness: 30.0,
        }
    }
    
    /// Shear modulus (MPa)
    pub fn shear_modulus(&self) -> f64 {
        self.rho * self.vs.powi(2) / 1e6
    }
    
    /// Young's modulus (MPa)
    pub fn youngs_modulus(&self) -> f64 {
        2.0 * self.shear_modulus() * (1.0 + self.poisson)
    }
    
    /// Site period (s)
    pub fn site_period(&self) -> f64 {
        4.0 * self.thickness / self.vs
    }
    
    /// Site class (ASCE 7)
    pub fn site_class(&self) -> char {
        if self.vs >= 1500.0 { 'A' }
        else if self.vs >= 760.0 { 'B' }
        else if self.vs >= 360.0 { 'C' }
        else if self.vs >= 180.0 { 'D' }
        else { 'E' }
    }
}

/// Foundation impedance (complex stiffness)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FoundationImpedance {
    /// Foundation radius/equivalent radius (m)
    pub radius: f64,
    /// Embedment depth (m)
    pub embedment: f64,
    /// Soil profile
    pub soil: SoilProfile,
    /// Excitation frequency (Hz)
    pub frequency: f64,
}

impl FoundationImpedance {
    pub fn new(radius: f64, embedment: f64, soil: SoilProfile) -> Self {
        Self {
            radius,
            embedment,
            soil,
            frequency: 5.0, // Default
        }
    }
    
    /// Dimensionless frequency
    pub fn dimensionless_frequency(&self) -> f64 {
        2.0 * PI * self.frequency * self.radius / self.soil.vs
    }
    
    /// Static vertical stiffness (kN/m)
    pub fn static_vertical_stiffness(&self) -> f64 {
        let g = self.soil.shear_modulus() * 1000.0; // kPa
        let r = self.radius;
        let nu = self.soil.poisson;
        
        // Embedded circular foundation (Gazetas)
        let k_surface = 4.0 * g * r / (1.0 - nu);
        let embed_factor = 1.0 + 0.54 * self.embedment / r;
        
        k_surface * embed_factor
    }
    
    /// Static horizontal stiffness (kN/m)
    pub fn static_horizontal_stiffness(&self) -> f64 {
        let g = self.soil.shear_modulus() * 1000.0;
        let r = self.radius;
        let nu = self.soil.poisson;
        
        let k_surface = 8.0 * g * r / (2.0 - nu);
        let embed_factor = 1.0 + 0.55 * self.embedment / r;
        
        k_surface * embed_factor
    }
    
    /// Static rocking stiffness (kN·m/rad)
    pub fn static_rocking_stiffness(&self) -> f64 {
        let g = self.soil.shear_modulus() * 1000.0;
        let r = self.radius;
        let nu = self.soil.poisson;
        
        let k_surface = 8.0 * g * r.powi(3) / (3.0 * (1.0 - nu));
        let embed_factor = 1.0 + 2.0 * self.embedment / r;
        
        k_surface * embed_factor
    }
    
    /// Static torsional stiffness (kN·m/rad)
    pub fn static_torsional_stiffness(&self) -> f64 {
        let g = self.soil.shear_modulus() * 1000.0;
        let r = self.radius;
        
        let k_surface = 16.0 * g * r.powi(3) / 3.0;
        let embed_factor = 1.0 + 2.3 * self.embedment / r;
        
        k_surface * embed_factor
    }
    
    /// Dynamic stiffness coefficient (real part factor)
    pub fn dynamic_stiffness_factor(&self, mode: &str) -> f64 {
        let a0 = self.dimensionless_frequency();
        
        match mode {
            "vertical" => 1.0 - 0.2 * a0.powi(2),
            "horizontal" => 1.0 - 0.1 * a0.powi(2),
            "rocking" => 1.0 - 0.35 * a0.powi(2),
            _ => 1.0,
        }
    }
    
    /// Radiation damping coefficient
    pub fn radiation_damping(&self, mode: &str) -> f64 {
        let a0 = self.dimensionless_frequency();
        
        match mode {
            "vertical" => 0.85 * a0,
            "horizontal" => 0.58 * a0,
            "rocking" => 0.15 * a0.powi(3),
            _ => 0.5 * a0,
        }
    }
    
    /// Effective damping ratio including material damping
    pub fn effective_damping(&self, mode: &str) -> f64 {
        let beta_rad = self.radiation_damping(mode);
        let beta_mat = self.soil.damping;
        
        beta_rad + beta_mat
    }
}

// ============================================================================
// SUBGRADE REACTION
// ============================================================================

/// Subgrade reaction model
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum SubgradeModel {
    /// Winkler spring model
    Winkler,
    /// Two-parameter (Pasternak)
    Pasternak,
    /// Vlasov model
    Vlasov,
    /// Kerr model (three-parameter)
    Kerr,
}

/// Subgrade reaction parameters
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SubgradeReaction {
    /// Model type
    pub model: SubgradeModel,
    /// Modulus of subgrade reaction (kN/m³)
    pub ks: f64,
    /// Foundation width (m)
    pub width: f64,
    /// Foundation length (m)
    pub length: f64,
}

impl SubgradeReaction {
    pub fn new(ks: f64, width: f64, length: f64) -> Self {
        Self {
            model: SubgradeModel::Winkler,
            ks,
            width,
            length,
        }
    }
    
    /// Ks from soil type (ACI 336 approximation)
    pub fn from_soil_type(soil_type: &str, width: f64) -> Self {
        let ks = match soil_type {
            "loose_sand" => 5000.0,
            "medium_sand" => 15000.0,
            "dense_sand" => 40000.0,
            "soft_clay" => 8000.0,
            "stiff_clay" => 25000.0,
            "hard_clay" => 50000.0,
            _ => 20000.0,
        };
        
        // Width correction (ks decreases with width)
        let ks_corrected = ks * (0.3 / width).min(1.0);
        
        Self::new(ks_corrected, width, width)
    }
    
    /// Characteristic length (Winkler beam)
    pub fn characteristic_length(&self, ei: f64) -> f64 {
        // λ = (ks × b / (4 × EI))^0.25
        (self.ks * self.width / (4.0 * ei)).powf(0.25)
    }
    
    /// Flexible vs rigid foundation check
    pub fn is_flexible(&self, ei: f64) -> bool {
        let lambda = self.characteristic_length(ei);
        lambda * self.length > PI // Flexible if λL > π
    }
    
    /// Contact pressure distribution factor
    pub fn pressure_factor(&self, ei: f64) -> f64 {
        let lambda = self.characteristic_length(ei);
        let lambda_l = lambda * self.length;
        
        if lambda_l <= PI {
            // Rigid
            1.0
        } else if lambda_l <= 3.0 * PI {
            // Semi-flexible
            0.85
        } else {
            // Flexible
            0.7
        }
    }
    
    /// Settlement at center under uniform load (m)
    pub fn central_settlement(&self, pressure: f64) -> f64 {
        // Winkler: w = p/ks
        pressure / self.ks
    }
    
    /// Spring stiffness per node (kN/m)
    pub fn spring_per_node(&self, node_spacing: f64) -> f64 {
        self.ks * self.width * node_spacing
    }
}

// ============================================================================
// KINEMATIC INTERACTION
// ============================================================================

/// Kinematic interaction factors
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct KinematicInteraction {
    /// Foundation radius (m)
    pub radius: f64,
    /// Embedment depth (m)
    pub embedment: f64,
    /// Soil shear wave velocity (m/s)
    pub vs: f64,
    /// Excitation frequency (Hz)
    pub frequency: f64,
}

impl KinematicInteraction {
    pub fn new(radius: f64, embedment: f64, vs: f64) -> Self {
        Self {
            radius,
            embedment,
            vs,
            frequency: 5.0,
        }
    }
    
    /// Dimensionless frequency
    pub fn a0(&self) -> f64 {
        2.0 * PI * self.frequency * self.radius / self.vs
    }
    
    /// Translation transfer function |H_u|
    pub fn translation_factor(&self) -> f64 {
        let a0 = self.a0();
        
        // Iguchi (1982) approximation
        if a0 < 0.5 {
            1.0
        } else {
            1.0 / (1.0 + 0.4 * a0.powi(2)).sqrt()
        }
    }
    
    /// Rocking transfer function |H_φ|
    pub fn rocking_factor(&self) -> f64 {
        let a0 = self.a0();
        let d_r = self.embedment / self.radius;
        
        // Base rocking induced by wave passage
        0.4 * a0 * d_r
    }
    
    /// Base motion reduction for embedded foundation
    pub fn base_motion_reduction(&self) -> f64 {
        let d_r = self.embedment / self.radius;
        let period_ratio = self.vs / (4.0 * self.embedment * self.frequency);
        
        if period_ratio > 5.0 {
            1.0
        } else {
            (0.2 * PI * d_r).cos().max(0.7)
        }
    }
}

// ============================================================================
// INERTIAL INTERACTION
// ============================================================================

/// Inertial interaction (period lengthening)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct InertialInteraction {
    /// Fixed-base period (s)
    pub fixed_base_period: f64,
    /// Structure height (m)
    pub height: f64,
    /// Structure mass (tonnes)
    pub mass: f64,
    /// Foundation stiffness vertical (kN/m)
    pub kv: f64,
    /// Foundation stiffness horizontal (kN/m)
    pub kh: f64,
    /// Foundation stiffness rocking (kN·m/rad)
    pub kr: f64,
}

impl InertialInteraction {
    pub fn new(t_fixed: f64, height: f64, mass: f64, kv: f64, kh: f64, kr: f64) -> Self {
        Self {
            fixed_base_period: t_fixed,
            height,
            mass,
            kv,
            kh,
            kr,
        }
    }
    
    /// SSI-modified period (s) - Veletsos approach
    pub fn ssi_period(&self) -> f64 {
        let k_fixed = 4.0 * PI.powi(2) * self.mass * 1000.0 / self.fixed_base_period.powi(2);
        
        // Horizontal compliance
        let c_h = 1.0 / self.kh;
        
        // Rocking compliance
        let c_r = self.height.powi(2) / self.kr;
        
        // Modified stiffness
        let c_total = 1.0 / k_fixed + c_h + c_r;
        let k_ssi = 1.0 / c_total;
        
        2.0 * PI * (self.mass * 1000.0 / k_ssi).sqrt()
    }
    
    /// Period lengthening ratio
    pub fn period_ratio(&self) -> f64 {
        self.ssi_period() / self.fixed_base_period
    }
    
    /// Foundation damping contribution
    pub fn foundation_damping(&self, beta_soil: f64) -> f64 {
        let ratio = self.period_ratio();
        
        // Wolf's approximation
        beta_soil * (1.0 - 1.0 / ratio.powi(2))
    }
    
    /// System damping (structure + foundation)
    pub fn system_damping(&self, beta_structure: f64, beta_soil: f64) -> f64 {
        let ratio = self.period_ratio();
        let beta_found = self.foundation_damping(beta_soil);
        
        (beta_structure / ratio.powi(2)) + beta_found
    }
    
    /// Spectral acceleration modification
    pub fn spectral_modification(&self, sa_fixed: f64, damping_ratio: f64) -> f64 {
        let beta_eff = damping_ratio;
        
        // Damping correction factor (Eurocode 8)
        let eta = (0.10 / (0.05 + beta_eff)).sqrt().min(1.0);
        
        sa_fixed * eta
    }
}

// ============================================================================
// PILE GROUP INTERACTION
// ============================================================================

/// Pile group interaction factors
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PileGroupInteraction {
    /// Pile diameter (m)
    pub diameter: f64,
    /// Pile length (m)
    pub length: f64,
    /// Pile spacing (m)
    pub spacing: f64,
    /// Number of piles
    pub num_piles: u32,
    /// Soil shear modulus (MPa)
    pub soil_g: f64,
    /// Pile modulus (MPa)
    pub pile_e: f64,
}

impl PileGroupInteraction {
    pub fn new(diameter: f64, length: f64, spacing: f64, num_piles: u32) -> Self {
        Self {
            diameter,
            length,
            spacing,
            num_piles,
            soil_g: 50.0,
            pile_e: 30000.0,
        }
    }
    
    /// Spacing ratio (s/d)
    pub fn spacing_ratio(&self) -> f64 {
        self.spacing / self.diameter
    }
    
    /// Slenderness ratio (L/d)
    pub fn slenderness_ratio(&self) -> f64 {
        self.length / self.diameter
    }
    
    /// Pile-soil stiffness ratio
    pub fn stiffness_ratio(&self) -> f64 {
        self.pile_e / self.soil_g
    }
    
    /// Single pile vertical stiffness (kN/m)
    pub fn single_pile_stiffness(&self) -> f64 {
        let _ep = self.pile_e * 1000.0; // kPa
        let r = self.diameter / 2.0;
        let l = self.length;
        let g = self.soil_g * 1000.0;
        
        // Randolph & Wroth approximation
        let ro = r * 2.5;
        let zeta = (ro / r).ln();
        
        2.0 * PI * g * l / zeta
    }
    
    /// Group efficiency (axial)
    pub fn group_efficiency_axial(&self) -> f64 {
        let s_d = self.spacing_ratio();
        
        // Block failure vs individual
        if s_d < 3.0 {
            0.7 // Block action
        } else if s_d < 6.0 {
            0.7 + 0.1 * (s_d - 3.0)
        } else {
            1.0
        }
    }
    
    /// Group efficiency (lateral)
    pub fn group_efficiency_lateral(&self) -> f64 {
        let s_d = self.spacing_ratio();
        
        // P-multiplier approach
        if s_d < 3.0 {
            0.5
        } else if s_d < 5.0 {
            0.5 + 0.15 * (s_d - 3.0)
        } else {
            0.8
        }
    }
    
    /// Group stiffness (vertical, kN/m)
    pub fn group_stiffness(&self) -> f64 {
        let k_single = self.single_pile_stiffness();
        let efficiency = self.group_efficiency_axial();
        
        k_single * self.num_piles as f64 * efficiency
    }
    
    /// Interaction factor (between two piles)
    pub fn interaction_factor(&self, distance: f64) -> f64 {
        let r = self.diameter / 2.0;
        
        // Randolph approximation
        (r / distance).sqrt() * 0.5
    }
}

// ============================================================================
// TESTS
// ============================================================================

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_soil_profile() {
        // Use Vs=400 m/s to be clearly in Site Class C
        let soil = SoilProfile::new(400.0, 1800.0);
        
        assert!(soil.shear_modulus() > 100.0);
        assert_eq!(soil.site_class(), 'C');
    }

    #[test]
    fn test_site_period() {
        let soil = SoilProfile::new(300.0, 1800.0);
        
        assert!(soil.site_period() > 0.0 && soil.site_period() < 1.0);
    }

    #[test]
    fn test_foundation_impedance() {
        let soil = SoilProfile::new(300.0, 1800.0);
        let imp = FoundationImpedance::new(10.0, 5.0, soil);
        
        assert!(imp.static_vertical_stiffness() > 0.0);
        assert!(imp.static_horizontal_stiffness() > 0.0);
    }

    #[test]
    fn test_rocking_stiffness() {
        let soil = SoilProfile::new(300.0, 1800.0);
        let imp = FoundationImpedance::new(10.0, 5.0, soil);
        
        assert!(imp.static_rocking_stiffness() > 0.0);
    }

    #[test]
    fn test_radiation_damping() {
        let soil = SoilProfile::new(300.0, 1800.0);
        let mut imp = FoundationImpedance::new(10.0, 5.0, soil);
        imp.frequency = 10.0;
        
        assert!(imp.radiation_damping("vertical") > 0.0);
    }

    #[test]
    fn test_subgrade_reaction() {
        // Use width=0.3m to avoid width correction reducing ks below 10000
        let sr = SubgradeReaction::from_soil_type("stiff_clay", 0.3);
        
        assert!(sr.ks > 10000.0);
    }

    #[test]
    fn test_characteristic_length() {
        let sr = SubgradeReaction::new(20000.0, 2.0, 10.0);
        let lambda = sr.characteristic_length(1e6);
        
        assert!(lambda > 0.0 && lambda < 1.0);
    }

    #[test]
    fn test_kinematic_interaction() {
        let ki = KinematicInteraction::new(10.0, 5.0, 300.0);
        
        assert!(ki.translation_factor() <= 1.0);
    }

    #[test]
    fn test_inertial_interaction() {
        let ii = InertialInteraction::new(1.0, 30.0, 5000.0, 1e6, 5e5, 1e8);
        let ratio = ii.period_ratio();
        
        assert!(ratio >= 1.0); // SSI lengthens period
    }

    #[test]
    fn test_ssi_period() {
        let ii = InertialInteraction::new(1.0, 30.0, 5000.0, 1e6, 5e5, 1e8);
        
        assert!(ii.ssi_period() >= ii.fixed_base_period);
    }

    #[test]
    fn test_system_damping() {
        let ii = InertialInteraction::new(1.0, 30.0, 5000.0, 1e6, 5e5, 1e8);
        let beta = ii.system_damping(0.05, 0.10);
        
        assert!(beta > 0.0 && beta < 0.30);
    }

    #[test]
    fn test_pile_group_interaction() {
        let pg = PileGroupInteraction::new(0.6, 20.0, 1.8, 9);
        
        assert!((pg.spacing_ratio() - 3.0).abs() < 0.1);
    }

    #[test]
    fn test_group_efficiency() {
        let pg = PileGroupInteraction::new(0.6, 20.0, 3.6, 9);
        
        assert!(pg.group_efficiency_axial() > 0.8);
    }

    #[test]
    fn test_group_stiffness() {
        let pg = PileGroupInteraction::new(0.6, 20.0, 1.8, 9);
        let k = pg.group_stiffness();
        
        assert!(k > 0.0);
    }
}
