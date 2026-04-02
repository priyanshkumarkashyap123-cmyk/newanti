// ============================================================================
// INDUSTRIAL FLOORING MODULE
// ACI 360, TR34, industrial floor design
// ============================================================================

use serde::{Deserialize, Serialize};

use crate::rebar_utils::circle_area;

// ============================================================================
// FLOOR TYPES
// ============================================================================

/// Floor type classification
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum FloorType {
    /// Ground supported slab
    GroundSupported,
    /// Suspended (elevated) slab
    Suspended,
    /// Post-tensioned
    PostTensioned,
    /// Steel fiber reinforced
    SteelFiberReinforced,
    /// Polypropylene fiber
    MacroFiber,
}

/// Floor use category
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum FloorUseCategory {
    /// Light foot traffic
    LightDuty,
    /// General purpose
    GeneralPurpose,
    /// Heavy industrial
    HeavyIndustrial,
    /// Warehouse racking
    WarehouseRacking,
    /// Cold storage
    ColdStorage,
    /// External/paving
    External,
}

impl FloorUseCategory {
    /// Typical uniformly distributed load (kN/m²)
    pub fn typical_udl(&self) -> f64 {
        match self {
            FloorUseCategory::LightDuty => 5.0,
            FloorUseCategory::GeneralPurpose => 10.0,
            FloorUseCategory::HeavyIndustrial => 25.0,
            FloorUseCategory::WarehouseRacking => 50.0,
            FloorUseCategory::ColdStorage => 15.0,
            FloorUseCategory::External => 10.0,
        }
    }
}

// ============================================================================
// GROUND SUPPORTED SLAB (TR34)
// ============================================================================

/// Subgrade properties
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Subgrade {
    /// Modulus of subgrade reaction k (MN/m³)
    pub k_value: f64,
    /// CBR value (%)
    pub cbr: f64,
    /// Description
    pub description: String,
}

impl Subgrade {
    pub fn poor() -> Self {
        Self {
            k_value: 15.0,
            cbr: 2.0,
            description: "Poor - soft clay".to_string(),
        }
    }
    
    pub fn medium() -> Self {
        Self {
            k_value: 40.0,
            cbr: 5.0,
            description: "Medium - stiff clay/loose sand".to_string(),
        }
    }
    
    pub fn good() -> Self {
        Self {
            k_value: 80.0,
            cbr: 15.0,
            description: "Good - dense sand/gravel".to_string(),
        }
    }
    
    pub fn excellent() -> Self {
        Self {
            k_value: 150.0,
            cbr: 30.0,
            description: "Excellent - rock/treated".to_string(),
        }
    }
    
    /// Estimate k from CBR
    pub fn k_from_cbr(cbr: f64) -> f64 {
        // Approximate relationship
        cbr * 0.3 * 33.9 // MN/m³
    }
}

/// Ground supported slab design (TR34)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GroundSlab {
    /// Slab thickness (mm)
    pub thickness: f64,
    /// Concrete grade fck (MPa)
    pub fck: f64,
    /// Characteristic flexural strength fctk (MPa)
    pub fctk: f64,
    /// Subgrade
    pub subgrade: Subgrade,
    /// Floor use
    pub use_category: FloorUseCategory,
    /// Is steel fiber reinforced
    pub is_sfrc: bool,
    /// Steel fiber dosage (kg/m³)
    pub fiber_dosage: f64,
    /// Fiber Re3 value
    pub re3: f64,
}

impl GroundSlab {
    pub fn new(thickness: f64, fck: f64, subgrade: Subgrade) -> Self {
        // Estimate flexural strength
        let fctk = 0.3 * fck.powf(2.0 / 3.0);
        
        Self {
            thickness,
            fck,
            fctk,
            subgrade,
            use_category: FloorUseCategory::GeneralPurpose,
            is_sfrc: false,
            fiber_dosage: 0.0,
            re3: 0.0,
        }
    }
    
    /// Enable SFRC
    pub fn with_fiber(&mut self, dosage: f64, re3: f64) {
        self.is_sfrc = true;
        self.fiber_dosage = dosage;
        self.re3 = re3;
    }
    
    /// Characteristic flexural strength (MPa)
    pub fn flexural_strength(&self) -> f64 {
        self.fctk
    }
    
    /// Design flexural strength (MPa)
    pub fn design_flexural(&self) -> f64 {
        self.fctk / 1.5 // γc = 1.5
    }
    
    /// Residual strength for SFRC (MPa)
    pub fn residual_strength(&self) -> f64 {
        if self.is_sfrc {
            self.design_flexural() * self.re3 / 100.0
        } else {
            0.0
        }
    }
    
    /// Radius of relative stiffness (mm)
    pub fn radius_of_stiffness(&self) -> f64 {
        let e = 30000.0; // MPa, approximate for concrete
        let h = self.thickness;
        let nu: f64 = 0.15;
        let k = self.subgrade.k_value; // MN/m³
        
        let d = e * h.powi(3) / (12.0 * (1.0 - nu.powi(2)));
        // l = (D / k_N/mm³)^0.25 where k_N/mm³ = k_MN/m³ × 10⁻³
        (d * 1000.0 / k).powf(0.25)
    }
    
    /// Negative moment capacity Mp (kN·m/m)
    pub fn negative_moment_capacity(&self) -> f64 {
        let fctd = self.design_flexural();
        let h = self.thickness;
        
        fctd * h.powi(2) / 6.0 / 1000.0
    }
    
    /// Positive moment capacity (kN·m/m)
    pub fn positive_moment_capacity(&self) -> f64 {
        if self.is_sfrc {
            let frd = self.residual_strength();
            let h = self.thickness;
            
            // TR34 equation for SFRC
            frd * h.powi(2) / 6.0 / 1000.0
        } else {
            // Unreinforced - very limited
            self.negative_moment_capacity() * 0.1
        }
    }
    
    /// Point load capacity - interior (kN)
    pub fn point_load_interior(&self) -> f64 {
        let mp = self.negative_moment_capacity();
        let mn = self.positive_moment_capacity();
        
        // TR34 yield line
        2.0 * PI * (mp + mn)
    }
    
    /// Point load capacity - edge (kN)
    pub fn point_load_edge(&self) -> f64 {
        let mp = self.negative_moment_capacity();
        let mn = self.positive_moment_capacity();
        
        // Edge condition
        PI * (mp + mn) / 2.0 + 2.0 * mp
    }
    
    /// Point load capacity - corner (kN)
    pub fn point_load_corner(&self) -> f64 {
        let mp = self.negative_moment_capacity();
        
        // Corner - no positive moment
        2.0 * mp
    }
    
    /// Punching shear capacity (kN)
    pub fn punching_capacity(&self, contact_area: f64) -> f64 {
        let d = self.thickness * 0.9; // Effective depth
        
        // Contact radius
        let a = (contact_area / PI).sqrt();
        
        // Critical perimeter at 2d from loaded area (TR34/EC2)
        let u = 2.0 * PI * (a + 2.0 * d);
        
        // EC2 minimum punching shear stress (unreinforced)
        let k = (1.0 + (200.0 / d).sqrt()).min(2.0);
        let vc = 0.035 * k.powf(1.5) * self.fck.sqrt();
        
        vc * u * d / 1000.0
    }
    
    /// Required thickness for point load (mm)
    pub fn required_thickness(&self, load: f64, safety_factor: f64) -> f64 {
        let target = load * safety_factor;
        
        // Iterate to find thickness
        let mut h = 100.0_f64;
        while h < 500.0 {
            let mut test_slab = self.clone();
            test_slab.thickness = h;
            
            if test_slab.point_load_interior() >= target {
                return h;
            }
            h += 10.0;
        }
        
        h
    }
}

// ============================================================================
// JOINT DESIGN
// ============================================================================

/// Joint type
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum JointType {
    /// Sawn contraction joint
    Contraction,
    /// Formed construction joint
    Construction,
    /// Isolation joint
    Isolation,
    /// Expansion joint
    Expansion,
}

/// Dowel bar design
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DowelBar {
    /// Diameter (mm)
    pub diameter: f64,
    /// Length (mm)
    pub length: f64,
    /// Spacing (mm)
    pub spacing: f64,
    /// Yield strength (MPa)
    pub fy: f64,
}

impl DowelBar {
    pub fn standard(slab_thickness: f64) -> Self {
        // Typical sizing
        let d = (slab_thickness / 8.0).max(16.0).min(32.0);
        
        Self {
            diameter: d,
            length: 500.0,
            spacing: 300.0,
            fy: 250.0, // Mild steel
        }
    }
    
    /// Bearing stress (MPa)
    pub fn bearing_stress(&self, load: f64) -> f64 {
        let a = self.diameter * self.length / 2.0; // Embedded length
        load * 1000.0 / a
    }
    
    /// Shear capacity per dowel (kN)
    pub fn shear_capacity(&self) -> f64 {
        let area = circle_area(self.diameter);
        
        0.6 * self.fy * area / 1000.0
    }
    
    /// Load transfer efficiency (%)
    pub fn load_transfer_efficiency(&self, k: f64, thickness: f64) -> f64 {
        // Simplified approach
        let stiffness_ratio = self.diameter.powi(4) / (self.spacing * k * thickness);
        
        (50.0 * stiffness_ratio.powf(0.5)).min(100.0)
    }
}

/// Joint spacing design
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct JointSpacing {
    /// Slab thickness (mm)
    pub thickness: f64,
    /// Maximum aggregate size (mm)
    pub aggregate_size: f64,
    /// Subgrade drag coefficient
    pub friction_coefficient: f64,
}

impl JointSpacing {
    pub fn new(thickness: f64) -> Self {
        Self {
            thickness,
            aggregate_size: 20.0,
            friction_coefficient: 1.5,
        }
    }
    
    /// Maximum contraction joint spacing (m) - empirical
    pub fn max_spacing_empirical(&self) -> f64 {
        // Rule of thumb: 24-30 × thickness
        25.0 * self.thickness / 1000.0
    }
    
    /// Joint spacing by ACI 360
    pub fn spacing_aci(&self) -> f64 {
        // Based on shrinkage control
        let t_ft = self.thickness / 25.4 / 12.0; // Convert to feet
        
        (2.0 + 0.25 * t_ft) * 3.048 // Convert back to m
    }
    
    /// Panel aspect ratio limit
    pub fn max_aspect_ratio(&self) -> f64 {
        1.5
    }
    
    /// Saw cut depth (mm)
    pub fn saw_cut_depth(&self) -> f64 {
        self.thickness / 4.0
    }
    
    /// Saw cut timing (hours after placement)
    pub fn saw_cut_timing(&self) -> (f64, f64) {
        // Temperature dependent - cool to hot
        (4.0, 12.0)
    }
}

// ============================================================================
// FORKLIFT / MHE LOADING
// ============================================================================

/// Material handling equipment
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ForkliftLoad {
    /// Laden weight (kN)
    pub laden_weight: f64,
    /// Unladen weight (kN)
    pub unladen_weight: f64,
    /// Wheelbase (mm)
    pub wheelbase: f64,
    /// Track width (mm)
    pub track_width: f64,
    /// Front axle load ratio
    pub front_axle_ratio: f64,
    /// Tire contact area (mm²)
    pub contact_area: f64,
}

impl ForkliftLoad {
    pub fn counterbalance_2t() -> Self {
        Self {
            laden_weight: 50.0,
            unladen_weight: 35.0,
            wheelbase: 1500.0,
            track_width: 900.0,
            front_axle_ratio: 0.85,
            contact_area: 10000.0,
        }
    }
    
    pub fn counterbalance_3_5t() -> Self {
        Self {
            laden_weight: 85.0,
            unladen_weight: 55.0,
            wheelbase: 1800.0,
            track_width: 1000.0,
            front_axle_ratio: 0.85,
            contact_area: 15000.0,
        }
    }
    
    pub fn reach_truck() -> Self {
        Self {
            laden_weight: 40.0,
            unladen_weight: 30.0,
            wheelbase: 1400.0,
            track_width: 1100.0,
            front_axle_ratio: 0.75,
            contact_area: 8000.0,
        }
    }
    
    pub fn vna_truck() -> Self {
        Self {
            laden_weight: 60.0,
            unladen_weight: 45.0,
            wheelbase: 1600.0,
            track_width: 1200.0,
            front_axle_ratio: 0.70,
            contact_area: 12000.0,
        }
    }
    
    /// Front axle load (kN)
    pub fn front_axle_load(&self) -> f64 {
        self.laden_weight * self.front_axle_ratio
    }
    
    /// Wheel load (kN) - single wheel
    pub fn wheel_load(&self) -> f64 {
        self.front_axle_load() / 2.0
    }
    
    /// Contact pressure (MPa)
    pub fn contact_pressure(&self) -> f64 {
        self.wheel_load() * 1000.0 / self.contact_area
    }
    
    /// Equivalent single wheel load (kN)
    pub fn equivalent_single(&self) -> f64 {
        // For dual wheels or closely spaced
        self.front_axle_load() * 0.85
    }
}

// ============================================================================
// RACKING LOADS
// ============================================================================

/// Racking post load
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RackingLoad {
    /// Post load (kN)
    pub post_load: f64,
    /// Baseplate size (mm)
    pub baseplate_size: f64,
    /// Post spacing - along aisle (mm)
    pub spacing_along: f64,
    /// Post spacing - across aisle (mm)
    pub spacing_across: f64,
    /// Number of posts
    pub num_posts: u32,
}

impl RackingLoad {
    pub fn new(post_load: f64, baseplate: f64) -> Self {
        Self {
            post_load,
            baseplate_size: baseplate,
            spacing_along: 2700.0,
            spacing_across: 1000.0,
            num_posts: 4, // Typical bay
        }
    }
    
    /// Contact area per post (mm²)
    pub fn contact_area(&self) -> f64 {
        self.baseplate_size.powi(2)
    }
    
    /// Contact pressure (MPa)
    pub fn contact_pressure(&self) -> f64 {
        self.post_load * 1000.0 / self.contact_area()
    }
    
    /// Load per unit area (kN/m²)
    pub fn equivalent_udl(&self) -> f64 {
        let area = self.spacing_along * self.spacing_across / 1e6; // m²
        
        self.post_load * self.num_posts as f64 / area
    }
    
    /// Edge distance requirement (mm)
    pub fn min_edge_distance(&self, slab_thickness: f64) -> f64 {
        slab_thickness.max(self.baseplate_size * 1.5)
    }
}

// ============================================================================
// FLATNESS / LEVELNESS
// ============================================================================

/// Floor flatness class (TR34)
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum FlatnessClass {
    /// FM1 - Superflat
    FM1,
    /// FM2 - High flatness
    FM2,
    /// FM3 - Standard
    FM3,
}

impl FlatnessClass {
    /// Property II (SR) limit (mm over 300mm)
    pub fn sr_limit(&self) -> f64 {
        match self {
            FlatnessClass::FM1 => 1.0,
            FlatnessClass::FM2 => 2.5,
            FlatnessClass::FM3 => 4.0,
        }
    }
    
    /// Property III (SL) limit (mm over 3m)
    pub fn sl_limit(&self) -> f64 {
        match self {
            FlatnessClass::FM1 => 2.0,
            FlatnessClass::FM2 => 5.0,
            FlatnessClass::FM3 => 8.0,
        }
    }
    
    /// Property IV (SC) limit (mm)
    pub fn sc_limit(&self) -> f64 {
        match self {
            FlatnessClass::FM1 => 3.0,
            FlatnessClass::FM2 => 6.0,
            FlatnessClass::FM3 => 10.0,
        }
    }
    
    /// Typical FF number (ACI)
    pub fn ff_number(&self) -> f64 {
        match self {
            FlatnessClass::FM1 => 100.0,
            FlatnessClass::FM2 => 50.0,
            FlatnessClass::FM3 => 25.0,
        }
    }
    
    /// Typical FL number (ACI)
    pub fn fl_number(&self) -> f64 {
        match self {
            FlatnessClass::FM1 => 100.0,
            FlatnessClass::FM2 => 50.0,
            FlatnessClass::FM3 => 25.0,
        }
    }
}

// ============================================================================
// TESTS
// ============================================================================

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_subgrade() {
        let good = Subgrade::good();
        assert!(good.k_value > 50.0);
        assert!(good.cbr > 10.0);
    }

    #[test]
    fn test_ground_slab() {
        let slab = GroundSlab::new(150.0, 30.0, Subgrade::medium());
        
        assert!(slab.radius_of_stiffness() > 0.0);
        assert!(slab.negative_moment_capacity() > 0.0);
    }

    #[test]
    fn test_sfrc_slab() {
        let mut slab = GroundSlab::new(150.0, 30.0, Subgrade::medium());
        slab.with_fiber(35.0, 50.0);
        
        assert!(slab.positive_moment_capacity() > 0.0);
        assert!(slab.point_load_interior() > 0.0);
    }

    #[test]
    fn test_point_load_locations() {
        let mut slab = GroundSlab::new(175.0, 35.0, Subgrade::good());
        slab.with_fiber(40.0, 55.0);
        
        let interior = slab.point_load_interior();
        let edge = slab.point_load_edge();
        let corner = slab.point_load_corner();
        
        // Interior > Edge > Corner
        assert!(interior > edge);
        assert!(edge > corner);
    }

    #[test]
    fn test_dowel_bar() {
        let dowel = DowelBar::standard(150.0);
        
        assert!(dowel.diameter >= 16.0);
        assert!(dowel.shear_capacity() > 10.0);
    }

    #[test]
    fn test_joint_spacing() {
        let joints = JointSpacing::new(150.0);
        
        let spacing = joints.max_spacing_empirical();
        assert!(spacing > 3.0 && spacing < 5.0);
    }

    #[test]
    fn test_forklift() {
        let fl = ForkliftLoad::counterbalance_3_5t();
        
        assert!(fl.wheel_load() > 30.0);
        assert!(fl.contact_pressure() > 2.0);
    }

    #[test]
    fn test_racking() {
        let rack = RackingLoad::new(80.0, 150.0);
        
        assert!(rack.contact_pressure() > 3.0);
        assert!(rack.equivalent_udl() > 50.0);
    }

    #[test]
    fn test_flatness() {
        let fm1 = FlatnessClass::FM1;
        let fm3 = FlatnessClass::FM3;
        
        assert!(fm1.sr_limit() < fm3.sr_limit());
        assert!(fm1.ff_number() > fm3.ff_number());
    }

    #[test]
    fn test_required_thickness() {
        let slab = GroundSlab::new(150.0, 30.0, Subgrade::medium());
        let t = slab.required_thickness(200.0, 1.5);
        
        assert!(t > 150.0);
    }
}
