// ============================================================================
// BRIDGE BEARINGS & EXPANSION JOINTS MODULE
// EN 1337, AASHTO LRFD, IRC bearing and joint design
// ============================================================================

use serde::{Deserialize, Serialize};
use std::f64::consts::PI;

use crate::rebar_utils::circle_area;

// ============================================================================
// ELASTOMERIC BEARINGS
// ============================================================================

/// Elastomeric bearing type
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum ElastomericType {
    /// Plain elastomeric pad
    Plain,
    /// Steel-reinforced elastomeric
    SteelReinforced,
    /// Fiber-reinforced elastomeric
    FiberReinforced,
}

/// Elastomeric bearing design (EN 1337-3)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ElastomericBearing {
    /// Bearing type
    pub bearing_type: ElastomericType,
    /// Plan dimension a (mm)
    pub dim_a: f64,
    /// Plan dimension b (mm)
    pub dim_b: f64,
    /// Total elastomer thickness te (mm)
    pub elastomer_thickness: f64,
    /// Individual layer thickness ti (mm)
    pub layer_thickness: f64,
    /// Number of internal steel plates
    pub steel_plates: u32,
    /// Steel plate thickness (mm)
    pub plate_thickness: f64,
    /// Shear modulus G (MPa)
    pub shear_modulus: f64,
    /// Bulk modulus Eb (MPa)
    pub bulk_modulus: f64,
}

impl ElastomericBearing {
    pub fn new(dim_a: f64, dim_b: f64, elastomer_thickness: f64) -> Self {
        let layers = (elastomer_thickness / 12.0).ceil() as u32;
        
        Self {
            bearing_type: ElastomericType::SteelReinforced,
            dim_a,
            dim_b,
            elastomer_thickness,
            layer_thickness: elastomer_thickness / layers as f64,
            steel_plates: layers - 1,
            plate_thickness: 3.0,
            shear_modulus: 0.9, // MPa, typical IRHD 60
            bulk_modulus: 2000.0,
        }
    }
    
    /// Effective plan area (mm²)
    pub fn area(&self) -> f64 {
        self.dim_a * self.dim_b
    }
    
    /// Shape factor S (EN 1337-3)
    pub fn shape_factor(&self) -> f64 {
        let a = self.dim_a;
        let b = self.dim_b;
        let ti = self.layer_thickness;
        
        a * b / (2.0 * ti * (a + b))
    }
    
    /// Effective area after shear deformation (mm²)
    pub fn effective_area(&self, shear_displacement: f64) -> f64 {
        let a = self.dim_a;
        let b = self.dim_b;
        let vx = shear_displacement;
        
        // Reduced area due to shear
        a * b - b * vx
    }
    
    /// Compressive stiffness (kN/mm)
    pub fn compressive_stiffness(&self) -> f64 {
        let s = self.shape_factor();
        let g = self.shear_modulus;
        let eb = self.bulk_modulus;
        let a = self.area();
        let te = self.elastomer_thickness;
        
        // Effective modulus
        let ec = 3.0 * g * (1.0 + 2.0 * s.powi(2));
        let e_eff = ec * eb / (ec + eb);
        
        e_eff * a / te / 1000.0
    }
    
    /// Shear stiffness (kN/mm)
    pub fn shear_stiffness(&self) -> f64 {
        let g = self.shear_modulus;
        let a = self.area();
        let te = self.elastomer_thickness;
        
        g * a / te / 1000.0
    }
    
    /// Rotational stiffness about axis (kN·m/rad)
    pub fn rotational_stiffness(&self) -> f64 {
        let s = self.shape_factor();
        let g = self.shear_modulus;
        let a = self.dim_a;
        let b = self.dim_b;
        let ti = self.layer_thickness;
        let n = (self.steel_plates + 1) as f64;
        
        // Approximate rotational stiffness
        g * s.powi(2) * a * b.powi(3) / (n * ti) / 1e9
    }
    
    /// Maximum compressive stress (MPa) - EN 1337-3
    pub fn max_compressive_stress(&self) -> f64 {
        let s = self.shape_factor();
        let g = self.shear_modulus;
        
        // Type B bearing limit
        1.5 * g * s
    }
    
    /// Compressive strain under load
    pub fn compressive_strain(&self, vertical_load: f64) -> f64 {
        let sigma = vertical_load * 1000.0 / self.area();
        let s = self.shape_factor();
        let g = self.shear_modulus;
        let eb = self.bulk_modulus;
        
        let ec = 3.0 * g * (1.0 + 2.0 * s.powi(2));
        let e_eff = ec * eb / (ec + eb);
        
        sigma / e_eff
    }
    
    /// Shear strain from horizontal displacement
    pub fn shear_strain(&self, displacement: f64) -> f64 {
        displacement / self.elastomer_thickness
    }
    
    /// Angular rotation strain
    pub fn rotation_strain(&self, rotation: f64) -> f64 {
        let a = self.dim_a;
        let ti = self.layer_thickness;
        
        a.powi(2) * rotation / (2.0 * ti.powi(2))
    }
    
    /// Total strain check (EN 1337-3 limit = 7.0 typically)
    pub fn total_strain(&self, vertical_load: f64, displacement: f64, rotation: f64) -> f64 {
        let eps_c = self.compressive_strain(vertical_load);
        let gamma_q = self.shear_strain(displacement);
        let eps_alpha = self.rotation_strain(rotation);
        
        // KL factor (typically 1.0 for reinforced)
        let kl = 1.0;
        
        kl * eps_c + gamma_q + eps_alpha
    }
    
    /// Stability check - buckling
    pub fn buckling_load(&self) -> f64 {
        let s = self.shape_factor();
        let g = self.shear_modulus;
        let a = self.area();
        let te = self.elastomer_thickness;
        
        // Haringx formula approximation
        2.0 * g * s * a * (self.dim_a / te) / 3.0 / 1000.0
    }
    
    /// Design check summary
    pub fn design_check(&self, fz: f64, vx: f64, alpha: f64) -> BearingCheckResult {
        let stress = fz * 1000.0 / self.area();
        let max_stress = self.max_compressive_stress();
        let total_strain = self.total_strain(fz, vx, alpha);
        let buckling = self.buckling_load();
        
        BearingCheckResult {
            stress_ratio: stress / max_stress,
            strain_total: total_strain,
            strain_limit: 7.0,
            buckling_ratio: fz / buckling,
            is_adequate: stress / max_stress < 1.0 && 
                        total_strain < 7.0 && 
                        fz / buckling < 0.5,
        }
    }
}

/// Bearing design check result
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BearingCheckResult {
    pub stress_ratio: f64,
    pub strain_total: f64,
    pub strain_limit: f64,
    pub buckling_ratio: f64,
    pub is_adequate: bool,
}

// ============================================================================
// POT BEARINGS
// ============================================================================

/// Pot bearing movement type
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum PotBearingType {
    /// Fixed (no movement)
    Fixed,
    /// Guided (one direction)
    Guided,
    /// Free (multidirectional)
    Free,
}

/// Pot bearing design (EN 1337-5)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PotBearing {
    /// Bearing type
    pub bearing_type: PotBearingType,
    /// Pot internal diameter (mm)
    pub pot_diameter: f64,
    /// Elastomeric disc thickness (mm)
    pub disc_thickness: f64,
    /// Pot wall thickness (mm)
    pub wall_thickness: f64,
    /// PTFE thickness (mm)
    pub ptfe_thickness: f64,
    /// Stainless steel thickness (mm)
    pub ss_thickness: f64,
    /// Design vertical load (kN)
    pub design_load: f64,
    /// Rotation capacity (rad)
    pub rotation_capacity: f64,
}

impl PotBearing {
    pub fn new(design_load: f64) -> Self {
        // Size pot based on load (45 MPa typical)
        let area_required = design_load * 1000.0 / 45.0;
        let diameter = (4.0 * area_required / PI).sqrt();
        
        Self {
            bearing_type: PotBearingType::Guided,
            pot_diameter: diameter,
            disc_thickness: 0.2 * diameter,
            wall_thickness: 20.0,
            ptfe_thickness: 3.0,
            ss_thickness: 2.0,
            design_load,
            rotation_capacity: 0.02,
        }
    }
    
    /// Effective bearing area (mm²)
    pub fn effective_area(&self) -> f64 {
        circle_area(self.pot_diameter)
    }
    
    /// Contact pressure on elastomer (MPa)
    pub fn elastomer_pressure(&self) -> f64 {
        self.design_load * 1000.0 / self.effective_area()
    }
    
    /// PTFE contact pressure (MPa)
    pub fn ptfe_pressure(&self) -> f64 {
        self.design_load * 1000.0 / self.effective_area()
    }
    
    /// Wall hoop stress (MPa)
    pub fn wall_hoop_stress(&self) -> f64 {
        let p = self.elastomer_pressure();
        let r = self.pot_diameter / 2.0;
        let t = self.wall_thickness;
        
        p * r / t
    }
    
    /// Friction coefficient for PTFE
    pub fn friction_coefficient(&self) -> f64 {
        let pressure = self.ptfe_pressure();
        
        // EN 1337-2 friction values
        if pressure < 5.0 {
            0.08
        } else if pressure < 10.0 {
            0.06
        } else if pressure < 20.0 {
            0.04
        } else {
            0.03
        }
    }
    
    /// Friction force (kN)
    pub fn friction_force(&self) -> f64 {
        self.design_load * self.friction_coefficient()
    }
    
    /// Minimum pot wall thickness (mm)
    pub fn min_wall_thickness(&self, fy: f64) -> f64 {
        let p = self.elastomer_pressure();
        let d = self.pot_diameter;
        
        p * d / (2.0 * fy / 1.5)
    }
    
    /// Rotation capacity check
    pub fn rotation_check(&self, applied_rotation: f64) -> bool {
        applied_rotation <= self.rotation_capacity
    }
}

// ============================================================================
// SPHERICAL BEARINGS
// ============================================================================

/// Spherical bearing (EN 1337-7)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SphericalBearing {
    /// Spherical radius (mm)
    pub radius: f64,
    /// Bearing diameter (mm)
    pub diameter: f64,
    /// Design vertical load (kN)
    pub design_load: f64,
    /// Maximum rotation (rad)
    pub max_rotation: f64,
    /// Convex element material
    pub convex_material: SlidingMaterial,
    /// Concave element material
    pub concave_material: SlidingMaterial,
}

/// Sliding surface material
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum SlidingMaterial {
    /// Stainless steel
    StainlessSteel,
    /// PTFE (Teflon)
    PTFE,
    /// UHMWPE
    UHMWPE,
    /// Bronze
    Bronze,
}

impl SphericalBearing {
    pub fn new(design_load: f64, max_rotation: f64) -> Self {
        // Size based on pressure limit (90 MPa for dimpled PTFE)
        let area = design_load * 1000.0 / 60.0;
        let diameter = (4.0 * area / PI).sqrt();
        let radius = diameter / (2.0 * max_rotation.sin());
        
        Self {
            radius,
            diameter,
            design_load,
            max_rotation,
            convex_material: SlidingMaterial::StainlessSteel,
            concave_material: SlidingMaterial::PTFE,
        }
    }
    
    /// Projected contact area (mm²)
    pub fn contact_area(&self) -> f64 {
        PI * self.diameter.powi(2) / 4.0
    }
    
    /// Average contact pressure (MPa)
    pub fn contact_pressure(&self) -> f64 {
        self.design_load * 1000.0 / self.contact_area()
    }
    
    /// Maximum edge pressure (MPa)
    pub fn edge_pressure(&self) -> f64 {
        // Edge pressure factor for spherical
        self.contact_pressure() * 1.5
    }
    
    /// Height of convex element (mm)
    pub fn convex_height(&self) -> f64 {
        let r = self.radius;
        let d = self.diameter;
        
        r - (r.powi(2) - (d / 2.0).powi(2)).sqrt()
    }
    
    /// Restoring moment under rotation (kN·m)
    pub fn restoring_moment(&self, rotation: f64) -> f64 {
        let e = self.radius * rotation.sin();
        
        self.design_load * e / 1000.0
    }
}

// ============================================================================
// EXPANSION JOINTS
// ============================================================================

/// Expansion joint type
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum ExpansionJointType {
    /// Asphaltic plug joint (< 25mm)
    AsphaltPlug,
    /// Nosing joint (< 40mm)
    Nosing,
    /// Single seal strip (< 80mm)
    SingleSeal,
    /// Multiple seal strip (< 300mm)
    MultipleSeal,
    /// Finger joint (< 600mm)
    Finger,
    /// Modular joint (> 600mm)
    Modular,
}

impl ExpansionJointType {
    /// Typical movement capacity (mm)
    pub fn movement_capacity(&self) -> f64 {
        match self {
            ExpansionJointType::AsphaltPlug => 25.0,
            ExpansionJointType::Nosing => 40.0,
            ExpansionJointType::SingleSeal => 80.0,
            ExpansionJointType::MultipleSeal => 300.0,
            ExpansionJointType::Finger => 600.0,
            ExpansionJointType::Modular => 1500.0,
        }
    }
}

/// Expansion joint design
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExpansionJoint {
    /// Joint type
    pub joint_type: ExpansionJointType,
    /// Expansion length (m)
    pub expansion_length: f64,
    /// Coefficient of thermal expansion (/°C)
    pub alpha: f64,
    /// Temperature range (°C)
    pub temp_range: f64,
    /// Creep/shrinkage movement (mm)
    pub creep_shrinkage: f64,
    /// Setting temperature (°C)
    pub setting_temp: f64,
    /// Skew angle (degrees)
    pub skew_angle: f64,
}

impl ExpansionJoint {
    pub fn new(expansion_length: f64, temp_range: f64) -> Self {
        Self {
            joint_type: ExpansionJointType::SingleSeal,
            expansion_length,
            alpha: 12e-6, // Steel/concrete
            temp_range,
            creep_shrinkage: 0.0,
            skew_angle: 0.0,
            setting_temp: 20.0,
        }
    }
    
    /// Thermal movement (mm)
    pub fn thermal_movement(&self) -> f64 {
        self.alpha * self.expansion_length * 1000.0 * self.temp_range
    }
    
    /// Total longitudinal movement (mm)
    pub fn total_movement(&self) -> f64 {
        self.thermal_movement() + self.creep_shrinkage.abs()
    }
    
    /// Movement parallel to joint (mm) - for skewed joints
    pub fn parallel_movement(&self) -> f64 {
        let skew_rad = self.skew_angle.to_radians();
        
        self.total_movement() * skew_rad.sin()
    }
    
    /// Movement perpendicular to joint (mm)
    pub fn perpendicular_movement(&self) -> f64 {
        let skew_rad = self.skew_angle.to_radians();
        
        self.total_movement() * skew_rad.cos()
    }
    
    /// Select appropriate joint type
    pub fn select_joint_type(&mut self) {
        let movement = self.total_movement();
        
        self.joint_type = if movement <= 25.0 {
            ExpansionJointType::AsphaltPlug
        } else if movement <= 40.0 {
            ExpansionJointType::Nosing
        } else if movement <= 80.0 {
            ExpansionJointType::SingleSeal
        } else if movement <= 300.0 {
            ExpansionJointType::MultipleSeal
        } else if movement <= 600.0 {
            ExpansionJointType::Finger
        } else {
            ExpansionJointType::Modular
        };
    }
    
    /// Gap at setting (mm)
    pub fn gap_at_setting(&self) -> f64 {
        // Set at mid-range
        self.total_movement() / 2.0 + 10.0 // 10mm tolerance
    }
    
    /// Minimum gap (mm)
    pub fn minimum_gap(&self) -> f64 {
        10.0 // Typical minimum
    }
    
    /// Maximum gap (mm)
    pub fn maximum_gap(&self) -> f64 {
        self.gap_at_setting() + self.total_movement() / 2.0
    }
    
    /// Number of seals for modular joint
    pub fn number_of_seals(&self) -> u32 {
        if self.total_movement() <= 80.0 {
            1
        } else {
            ((self.total_movement() / 80.0).ceil() as u32).max(2)
        }
    }
}

// ============================================================================
// SLIDING BEARINGS
// ============================================================================

/// Sliding bearing
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SlidingBearing {
    /// PTFE diameter (mm)
    pub ptfe_diameter: f64,
    /// PTFE thickness (mm)
    pub ptfe_thickness: f64,
    /// Design load (kN)
    pub design_load: f64,
    /// Sliding surface type
    pub surface_type: SlidingMaterial,
    /// Is dimpled PTFE?
    pub is_dimpled: bool,
}

impl SlidingBearing {
    pub fn new(design_load: f64) -> Self {
        // Size for 30 MPa
        let area = design_load * 1000.0 / 30.0;
        let diameter = (4.0 * area / PI).sqrt();
        
        Self {
            ptfe_diameter: diameter,
            ptfe_thickness: 4.5, // Minimum per EN 1337-2
            design_load,
            surface_type: SlidingMaterial::PTFE,
            is_dimpled: false,
        }
    }
    
    /// Contact area (mm²)
    pub fn contact_area(&self) -> f64 {
        PI * self.ptfe_diameter.powi(2) / 4.0
    }
    
    /// Contact pressure (MPa)
    pub fn contact_pressure(&self) -> f64 {
        self.design_load * 1000.0 / self.contact_area()
    }
    
    /// Maximum allowable pressure (MPa)
    pub fn max_pressure(&self) -> f64 {
        if self.is_dimpled {
            90.0
        } else {
            30.0
        }
    }
    
    /// Friction coefficient
    pub fn friction_coefficient(&self) -> f64 {
        let p = self.contact_pressure();
        
        // Temperature 20°C values
        if self.is_dimpled {
            if p < 10.0 { 0.06 } else { 0.04 }
        } else {
            if p < 5.0 { 0.08 }
            else if p < 10.0 { 0.06 }
            else if p < 20.0 { 0.04 }
            else { 0.03 }
        }
    }
    
    /// Friction force (kN)
    pub fn friction_force(&self) -> f64 {
        self.design_load * self.friction_coefficient()
    }
    
    /// Minimum PTFE thickness (mm)
    pub fn min_ptfe_thickness(&self) -> f64 {
        if self.is_dimpled {
            5.5
        } else {
            4.5
        }
    }
    
    /// Wear rate (mm per km of sliding)
    pub fn wear_rate(&self) -> f64 {
        let p = self.contact_pressure();
        
        // Approximate wear
        0.001 * p
    }
}

// ============================================================================
// TESTS
// ============================================================================

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_elastomeric_shape_factor() {
        let bearing = ElastomericBearing::new(400.0, 500.0, 60.0);
        let s = bearing.shape_factor();
        
        assert!(s > 5.0 && s < 15.0);
    }

    #[test]
    fn test_elastomeric_stiffness() {
        let bearing = ElastomericBearing::new(400.0, 500.0, 60.0);
        
        assert!(bearing.compressive_stiffness() > 100.0);
        assert!(bearing.shear_stiffness() > 1.0);
    }

    #[test]
    fn test_elastomeric_strain() {
        let bearing = ElastomericBearing::new(400.0, 500.0, 60.0);
        let strain = bearing.total_strain(1000.0, 30.0, 0.01);
        
        assert!(strain > 0.0 && strain < 10.0);
    }

    #[test]
    fn test_elastomeric_check() {
        let bearing = ElastomericBearing::new(400.0, 500.0, 60.0);
        let result = bearing.design_check(1000.0, 20.0, 0.005);
        
        assert!(result.stress_ratio < 2.0);
    }

    #[test]
    fn test_pot_bearing() {
        let pot = PotBearing::new(5000.0);
        
        assert!(pot.pot_diameter > 300.0);
        assert!(pot.elastomer_pressure() < 50.0);
    }

    #[test]
    fn test_pot_friction() {
        let pot = PotBearing::new(3000.0);
        let mu = pot.friction_coefficient();
        
        assert!(mu > 0.02 && mu < 0.1);
    }

    #[test]
    fn test_spherical_bearing() {
        let sph = SphericalBearing::new(10000.0, 0.02);
        
        assert!(sph.contact_pressure() < 100.0);
    }

    #[test]
    fn test_expansion_joint() {
        let mut joint = ExpansionJoint::new(100.0, 60.0);
        joint.select_joint_type();
        
        let movement = joint.thermal_movement();
        assert!(movement > 50.0 && movement < 100.0);
    }

    #[test]
    fn test_joint_selection() {
        let mut joint = ExpansionJoint::new(200.0, 50.0);
        joint.select_joint_type();
        
        // For 200m span, likely needs multi-seal or finger
        assert!(joint.total_movement() > 100.0);
    }

    #[test]
    fn test_sliding_bearing() {
        let sliding = SlidingBearing::new(2000.0);
        
        assert!(sliding.contact_pressure() < sliding.max_pressure());
    }

    #[test]
    fn test_sliding_friction() {
        let sliding = SlidingBearing::new(2000.0);
        let mu = sliding.friction_coefficient();
        
        assert!(mu > 0.0 && mu < 0.1);
    }

    #[test]
    fn test_skewed_joint() {
        let mut joint = ExpansionJoint::new(100.0, 50.0);
        joint.skew_angle = 30.0;
        
        let perp = joint.perpendicular_movement();
        let para = joint.parallel_movement();
        
        assert!(perp > para);
    }
}
