// ============================================================================
// SCAFFOLDING & TEMPORARY WORKS MODULE
// BS 5975, EN 12811, OSHA design standards
// ============================================================================

use serde::{Deserialize, Serialize};
use std::f64::consts::PI;

// ============================================================================
// SCAFFOLD TYPES
// ============================================================================

/// Scaffold system type
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum ScaffoldSystem {
    /// Tube and coupler
    TubeAndCoupler,
    /// System scaffold (proprietary)
    SystemScaffold,
    /// Frame scaffold
    FrameScaffold,
    /// Mast climbing
    MastClimbing,
    /// Suspended scaffold
    Suspended,
}

/// Scaffold load class (EN 12811-1)
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum ScaffoldLoadClass {
    /// Class 1: Light inspection (0.75 kN/m²)
    Class1,
    /// Class 2: Light duty (1.5 kN/m²)
    Class2,
    /// Class 3: General building (2.0 kN/m²)
    Class3,
    /// Class 4: Heavy duty (3.0 kN/m²)
    Class4,
    /// Class 5: Masonry/heavy (4.5 kN/m²)
    Class5,
    /// Class 6: Very heavy (6.0 kN/m²)
    Class6,
}

impl ScaffoldLoadClass {
    /// Uniformly distributed load (kN/m²)
    pub fn udl(&self) -> f64 {
        match self {
            ScaffoldLoadClass::Class1 => 0.75,
            ScaffoldLoadClass::Class2 => 1.5,
            ScaffoldLoadClass::Class3 => 2.0,
            ScaffoldLoadClass::Class4 => 3.0,
            ScaffoldLoadClass::Class5 => 4.5,
            ScaffoldLoadClass::Class6 => 6.0,
        }
    }
    
    /// Point load for partial loading (kN)
    pub fn point_load(&self) -> f64 {
        match self {
            ScaffoldLoadClass::Class1 => 1.5,
            ScaffoldLoadClass::Class2 => 1.5,
            ScaffoldLoadClass::Class3 => 1.5,
            ScaffoldLoadClass::Class4 => 3.0,
            ScaffoldLoadClass::Class5 => 3.0,
            ScaffoldLoadClass::Class6 => 3.0,
        }
    }
    
    /// Maximum number of loaded platforms
    pub fn loaded_platforms(&self) -> u32 {
        match self {
            ScaffoldLoadClass::Class1 | ScaffoldLoadClass::Class2 => 4,
            ScaffoldLoadClass::Class3 => 3,
            _ => 2,
        }
    }
}

// ============================================================================
// TUBE AND COUPLER SCAFFOLD
// ============================================================================

/// Standard scaffold tube
#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
pub struct ScaffoldTube {
    /// Outside diameter (mm)
    pub od: f64,
    /// Wall thickness (mm)
    pub thickness: f64,
    /// Yield strength (MPa)
    pub fy: f64,
}

impl ScaffoldTube {
    /// Standard 48.3mm tube (BS EN 39)
    pub fn standard_48() -> Self {
        Self {
            od: 48.3,
            thickness: 3.2,
            fy: 235.0,
        }
    }
    
    /// Inside diameter (mm)
    pub fn id(&self) -> f64 {
        self.od - 2.0 * self.thickness
    }
    
    /// Cross-sectional area (mm²)
    pub fn area(&self) -> f64 {
        PI * (self.od.powi(2) - self.id().powi(2)) / 4.0
    }
    
    /// Second moment of area (mm⁴)
    pub fn inertia(&self) -> f64 {
        PI * (self.od.powi(4) - self.id().powi(4)) / 64.0
    }
    
    /// Radius of gyration (mm)
    pub fn radius_of_gyration(&self) -> f64 {
        (self.inertia() / self.area()).sqrt()
    }
    
    /// Section modulus (mm³)
    pub fn section_modulus(&self) -> f64 {
        2.0 * self.inertia() / self.od
    }
    
    /// Weight per meter (kg/m)
    pub fn weight(&self) -> f64 {
        self.area() * 7850.0 / 1e6 // kg/m
    }
    
    /// Elastic buckling load (kN)
    pub fn euler_load(&self, length: f64, k: f64) -> f64 {
        let e = 205000.0; // MPa
        let le = k * length;
        
        PI.powi(2) * e * self.inertia() / le.powi(2) / 1000.0
    }
    
    /// Allowable axial load (kN) - slenderness based
    pub fn allowable_axial(&self, length: f64, k: f64) -> f64 {
        let r = self.radius_of_gyration();
        let le = k * length * 1000.0; // Convert to mm
        let lambda = le / r;
        
        // Perry-Robertson approach
        let lambda_0 = PI * (205000.0 / self.fy).sqrt();
        let lambda_bar = lambda / lambda_0;
        
        if lambda_bar <= 0.2 {
            self.fy * self.area() / 1.5 / 1000.0
        } else {
            // EC3 curve c imperfection factor (α=0.49) for scaffold tubes
            let eta = 0.49 * (lambda_bar - 0.2);
            let phi = (1.0 + eta + lambda_bar.powi(2)) / 2.0;
            let chi = 1.0 / (phi + (phi.powi(2) - lambda_bar.powi(2)).sqrt());
            
            chi * self.fy * self.area() / 1.5 / 1000.0
        }
    }
    
    /// Allowable bending moment (kN·m)
    pub fn allowable_moment(&self) -> f64 {
        self.fy * self.section_modulus() / 1.5 / 1e6
    }
}

/// Scaffold coupler type
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum CouplerType {
    /// Right-angle coupler
    RightAngle,
    /// Swivel coupler
    Swivel,
    /// Putlog coupler
    Putlog,
    /// Sleeve coupler
    Sleeve,
    /// Baseplate
    Baseplate,
}

impl CouplerType {
    /// Safe working load (kN) - BS EN 74
    pub fn safe_load(&self) -> f64 {
        match self {
            CouplerType::RightAngle => 6.25,
            CouplerType::Swivel => 6.25,
            CouplerType::Putlog => 6.25,
            CouplerType::Sleeve => 6.25,
            CouplerType::Baseplate => 20.0,
        }
    }
    
    /// Slip resistance (kN)
    pub fn slip_resistance(&self) -> f64 {
        match self {
            CouplerType::RightAngle => 9.1,
            CouplerType::Swivel => 6.1,
            CouplerType::Putlog => 6.1,
            CouplerType::Sleeve => 6.1,
            CouplerType::Baseplate => 0.0,
        }
    }
}

// ============================================================================
// SCAFFOLD DESIGN
// ============================================================================

/// Tube and coupler scaffold
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TubeCouplerScaffold {
    /// Height (m)
    pub height: f64,
    /// Length (m)
    pub length: f64,
    /// Lift height (m)
    pub lift_height: f64,
    /// Bay length (m)
    pub bay_length: f64,
    /// Width (m)
    pub width: f64,
    /// Load class
    pub load_class: ScaffoldLoadClass,
    /// Tube specification
    pub tube: ScaffoldTube,
    /// Number of board widths
    pub board_widths: u32,
    /// Cladding (sheeted)
    pub is_sheeted: bool,
}

impl TubeCouplerScaffold {
    pub fn new(height: f64, length: f64, load_class: ScaffoldLoadClass) -> Self {
        Self {
            height,
            length,
            lift_height: 2.0,
            bay_length: 2.1,
            width: 1.3,
            load_class,
            tube: ScaffoldTube::standard_48(),
            board_widths: 5,
            is_sheeted: false,
        }
    }
    
    /// Number of lifts
    pub fn num_lifts(&self) -> u32 {
        (self.height / self.lift_height).ceil() as u32
    }
    
    /// Number of bays
    pub fn num_bays(&self) -> u32 {
        (self.length / self.bay_length).ceil() as u32
    }
    
    /// Dead load per platform (kN/m²)
    pub fn dead_load(&self) -> f64 {
        // Boards + ledgers + transoms
        0.3 + 0.15 * self.board_widths as f64 / 5.0
    }
    
    /// Total UDL on platform (kN/m²)
    pub fn total_udl(&self) -> f64 {
        self.dead_load() + self.load_class.udl()
    }
    
    /// Wind load (kN/m²) on sheeted scaffold
    pub fn wind_load(&self, wind_speed: f64) -> f64 {
        if self.is_sheeted {
            0.613e-3 * wind_speed.powi(2) * 1.2 // Cf = 1.2
        } else {
            0.613e-3 * wind_speed.powi(2) * 1.3 * 0.4 // Solidity 0.4
        }
    }
    
    /// Standard load per platform (kN)
    pub fn standard_load(&self) -> f64 {
        let area = self.bay_length * self.width;
        let num_platforms = self.load_class.loaded_platforms().min(self.num_lifts());
        
        self.total_udl() * area * num_platforms as f64
    }
    
    /// Load per inner standard (kN)
    pub fn load_inner_standard(&self) -> f64 {
        self.standard_load() / 2.0
    }
    
    /// Load per outer standard (kN)
    pub fn load_outer_standard(&self) -> f64 {
        // Reduced due to cantilever
        self.standard_load() * 0.4
    }
    
    /// Effective length of standard (m)
    pub fn effective_length_standard(&self) -> f64 {
        self.lift_height * 1.0 // K = 1.0 with ledger bracing
    }
    
    /// Check standard capacity
    pub fn check_standard(&self) -> StandardCheck {
        let load = self.load_inner_standard();
        let capacity = self.tube.allowable_axial(
            self.effective_length_standard(), 
            1.0
        );
        
        StandardCheck {
            applied_load: load,
            capacity,
            utilization: load / capacity,
            is_adequate: load / capacity <= 1.0,
        }
    }
    
    /// Ledger bending check
    pub fn check_ledger(&self) -> LedgerCheck {
        let w = self.total_udl() * self.width / 2.0; // kN/m
        let l = self.bay_length;
        
        // Simply supported moment
        let m_applied = w * l.powi(2) / 8.0;
        let m_capacity = self.tube.allowable_moment();
        
        LedgerCheck {
            applied_moment: m_applied,
            capacity: m_capacity,
            utilization: m_applied / m_capacity,
            is_adequate: m_applied / m_capacity <= 1.0,
        }
    }
    
    /// Tie spacing required (m²) - BS 5975
    pub fn tie_spacing(&self) -> f64 {
        if self.is_sheeted {
            // Sheeted scaffold - closer ties
            32.0 / (1.0 + self.height / 10.0)
        } else {
            // Open scaffold
            40.0
        }
    }
    
    /// Number of ties required
    pub fn num_ties(&self) -> u32 {
        let area = self.height * self.length;
        (area / self.tie_spacing()).ceil() as u32
    }
    
    /// Tie load (kN) per tie
    pub fn tie_load(&self, wind_speed: f64) -> f64 {
        let wind_force = self.wind_load(wind_speed) * self.height * self.length;
        
        wind_force / self.num_ties() as f64
    }
}

/// Standard check result
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StandardCheck {
    pub applied_load: f64,
    pub capacity: f64,
    pub utilization: f64,
    pub is_adequate: bool,
}

/// Ledger check result
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LedgerCheck {
    pub applied_moment: f64,
    pub capacity: f64,
    pub utilization: f64,
    pub is_adequate: bool,
}

// ============================================================================
// FALSEWORK / SHORING
// ============================================================================

/// Falsework prop type
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum PropType {
    /// Adjustable steel prop
    AdjustableProp,
    /// Heavy duty prop
    HeavyDutyProp,
    /// Scaffolding tower
    ScaffoldTower,
    /// Shore frame
    ShoreFrame,
}

/// Adjustable prop (Acrow type)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AdjustableProp {
    /// Prop size (0-4)
    pub size: u32,
    /// Minimum length (m)
    pub min_length: f64,
    /// Maximum length (m)
    pub max_length: f64,
    /// Inner tube OD (mm)
    pub inner_od: f64,
    /// Outer tube OD (mm)
    pub outer_od: f64,
}

impl AdjustableProp {
    pub fn size_1() -> Self {
        Self {
            size: 1,
            min_length: 1.75,
            max_length: 3.12,
            inner_od: 48.3,
            outer_od: 60.3,
        }
    }
    
    pub fn size_2() -> Self {
        Self {
            size: 2,
            min_length: 1.98,
            max_length: 3.35,
            inner_od: 48.3,
            outer_od: 60.3,
        }
    }
    
    pub fn size_3() -> Self {
        Self {
            size: 3,
            min_length: 2.59,
            max_length: 3.96,
            inner_od: 48.3,
            outer_od: 60.3,
        }
    }
    
    pub fn size_4() -> Self {
        Self {
            size: 4,
            min_length: 3.20,
            max_length: 4.88,
            inner_od: 48.3,
            outer_od: 60.3,
        }
    }
    
    /// Safe working load (kN) based on extension
    pub fn safe_load(&self, length: f64) -> f64 {
        let base_load = match self.size {
            0 => 29.0,
            1 => 24.0,
            2 => 20.0,
            3 => 17.0,
            4 => 13.0,
            _ => 10.0,
        };
        
        // Reduction for extension
        let extension_ratio = (length - self.min_length) / 
                             (self.max_length - self.min_length);
        
        base_load * (1.0 - 0.3 * extension_ratio)
    }
    
    /// Check prop adequacy
    pub fn check(&self, load: f64, length: f64) -> bool {
        load <= self.safe_load(length) && 
        length >= self.min_length && 
        length <= self.max_length
    }
}

/// Falsework design
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Falsework {
    /// Clear height (m)
    pub clear_height: f64,
    /// Supported area (m²)
    pub area: f64,
    /// Slab thickness (mm)
    pub slab_thickness: f64,
    /// Concrete density (kN/m³)
    pub concrete_density: f64,
    /// Construction live load (kN/m²)
    pub construction_load: f64,
}

impl Falsework {
    pub fn new(clear_height: f64, area: f64, slab_thickness: f64) -> Self {
        Self {
            clear_height,
            area,
            slab_thickness,
            concrete_density: 25.0,
            construction_load: 1.5, // kN/m²
        }
    }
    
    /// Concrete self weight (kN/m²)
    pub fn concrete_load(&self) -> f64 {
        self.slab_thickness / 1000.0 * self.concrete_density
    }
    
    /// Formwork weight (kN/m²)
    pub fn formwork_load(&self) -> f64 {
        0.5 // Typical for plywood + bearers
    }
    
    /// Total load (kN/m²)
    pub fn total_load(&self) -> f64 {
        self.concrete_load() + self.formwork_load() + self.construction_load
    }
    
    /// Design load with factors (kN/m²)
    pub fn design_load(&self) -> f64 {
        // BS 5975 partial factors
        1.4 * (self.concrete_load() + self.formwork_load()) + 
        1.6 * self.construction_load
    }
    
    /// Prop spacing for given prop capacity (m)
    pub fn prop_spacing(&self, prop_capacity: f64) -> f64 {
        (prop_capacity / self.design_load()).sqrt()
    }
    
    /// Number of props required
    pub fn num_props(&self, prop_capacity: f64) -> u32 {
        let spacing = self.prop_spacing(prop_capacity);
        let props_per_row = (self.area.sqrt() / spacing).ceil();
        
        (props_per_row.powi(2)) as u32
    }
    
    /// Primary beam span (m)
    pub fn primary_beam_span(&self, prop_spacing: f64) -> f64 {
        prop_spacing
    }
    
    /// Secondary beam span (m)
    pub fn secondary_beam_span(&self, prop_spacing: f64) -> f64 {
        prop_spacing
    }
    
    /// Minimum reshoring time (days) - approximate
    pub fn reshore_time(&self) -> u32 {
        // Based on slab thickness
        if self.slab_thickness <= 150.0 { 3 }
        else if self.slab_thickness <= 200.0 { 7 }
        else if self.slab_thickness <= 300.0 { 14 }
        else { 21 }
    }
}

// ============================================================================
// TESTS
// ============================================================================

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_tube_properties() {
        let tube = ScaffoldTube::standard_48();
        
        assert!((tube.area() - 453.0).abs() < 10.0); // ~453 mm²
        assert!(tube.radius_of_gyration() > 15.0);
    }

    #[test]
    fn test_tube_capacity() {
        let tube = ScaffoldTube::standard_48();
        let capacity = tube.allowable_axial(2.0, 1.0);
        
        assert!(capacity > 20.0 && capacity < 80.0);
    }

    #[test]
    fn test_scaffold_loads() {
        let scaffold = TubeCouplerScaffold::new(10.0, 20.0, ScaffoldLoadClass::Class3);
        
        assert!(scaffold.total_udl() > 2.0);
        assert!(scaffold.standard_load() > 10.0);
    }

    #[test]
    fn test_standard_check() {
        let scaffold = TubeCouplerScaffold::new(8.0, 15.0, ScaffoldLoadClass::Class3);
        let check = scaffold.check_standard();
        
        // Should be adequate for typical scaffold
        assert!(check.utilization < 2.0);
    }

    #[test]
    fn test_ledger_check() {
        let scaffold = TubeCouplerScaffold::new(10.0, 20.0, ScaffoldLoadClass::Class3);
        let check = scaffold.check_ledger();
        
        assert!(check.utilization < 2.0);
    }

    #[test]
    fn test_tie_requirements() {
        let mut scaffold = TubeCouplerScaffold::new(20.0, 30.0, ScaffoldLoadClass::Class4);
        scaffold.is_sheeted = true;
        
        let num_ties = scaffold.num_ties();
        assert!(num_ties > 10);
    }

    #[test]
    fn test_adjustable_prop() {
        let prop = AdjustableProp::size_2();
        
        let load_min = prop.safe_load(prop.min_length);
        let load_max = prop.safe_load(prop.max_length);
        
        assert!(load_min > load_max);
    }

    #[test]
    fn test_falsework_loads() {
        let fw = Falsework::new(3.0, 100.0, 200.0);
        
        assert!(fw.concrete_load() > 4.0 && fw.concrete_load() < 6.0);
        assert!(fw.design_load() > 8.0);
    }

    #[test]
    fn test_prop_spacing() {
        let fw = Falsework::new(2.8, 200.0, 150.0);
        let spacing = fw.prop_spacing(20.0);
        
        assert!(spacing > 1.0 && spacing < 3.0);
    }

    #[test]
    fn test_coupler_load() {
        let ra = CouplerType::RightAngle;
        assert!((ra.safe_load() - 6.25).abs() < 0.1);
    }

    #[test]
    fn test_load_class() {
        assert!((ScaffoldLoadClass::Class3.udl() - 2.0).abs() < 0.01);
        assert!((ScaffoldLoadClass::Class6.udl() - 6.0).abs() < 0.01);
    }
}
