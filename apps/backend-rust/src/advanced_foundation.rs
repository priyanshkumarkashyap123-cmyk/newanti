//! Advanced Foundation Systems Module
//! 
//! Specialized foundation analysis and design:
//! - Raft/mat foundation design
//! - Combined footings
//! - Ring foundations
//! - Machine foundations
//! - Ground anchors and micropiles
//! - Soil-structure stiffness

use serde::{Deserialize, Serialize};
use std::f64::consts::PI;

/// Raft foundation analyzer
#[derive(Debug, Clone)]
pub struct RaftFoundation {
    /// Geometry
    pub geometry: RaftGeometry,
    /// Soil properties
    pub soil: SoilProperties,
    /// Loading
    pub loads: Vec<FoundationLoad>,
    /// Analysis method
    pub method: AnalysisMethod,
}

/// Raft geometry
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RaftGeometry {
    /// Length (m)
    pub length: f64,
    /// Width (m)
    pub width: f64,
    /// Thickness (m)
    pub thickness: f64,
    /// Edge thickening (m)
    pub edge_thickening: Option<f64>,
    /// Pedestal locations
    pub pedestals: Vec<Pedestal>,
}

/// Column pedestal
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Pedestal {
    /// X coordinate (m)
    pub x: f64,
    /// Y coordinate (m)
    pub y: f64,
    /// Pedestal width (m)
    pub width: f64,
    /// Pedestal depth (m)
    pub depth: f64,
    /// Pedestal height (m)
    pub height: f64,
}

/// Soil properties for foundation
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SoilProperties {
    /// Modulus of subgrade reaction (kN/m³)
    pub subgrade_modulus: f64,
    /// Bearing capacity (kPa)
    pub bearing_capacity: f64,
    /// Elastic modulus (kPa)
    pub elastic_modulus: f64,
    /// Poisson's ratio
    pub poisson_ratio: f64,
    /// Allowable settlement (mm)
    pub allowable_settlement: f64,
}

impl SoilProperties {
    /// Create from SPT N-value
    pub fn from_spt(n_value: u32) -> Self {
        let n = n_value as f64;
        Self {
            subgrade_modulus: n * 400.0, // Approximate kN/m³
            bearing_capacity: n * 12.0,   // Approximate kPa
            elastic_modulus: n * 500.0,
            poisson_ratio: 0.3,
            allowable_settlement: 25.0,
        }
    }
    
    /// Dense sand
    pub fn dense_sand() -> Self {
        Self {
            subgrade_modulus: 80000.0,
            bearing_capacity: 400.0,
            elastic_modulus: 50000.0,
            poisson_ratio: 0.3,
            allowable_settlement: 25.0,
        }
    }
    
    /// Stiff clay
    pub fn stiff_clay() -> Self {
        Self {
            subgrade_modulus: 30000.0,
            bearing_capacity: 200.0,
            elastic_modulus: 25000.0,
            poisson_ratio: 0.4,
            allowable_settlement: 50.0,
        }
    }
}

/// Foundation load
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FoundationLoad {
    /// Load name
    pub name: String,
    /// X location (m)
    pub x: f64,
    /// Y location (m)
    pub y: f64,
    /// Vertical load (kN, positive downward)
    pub fz: f64,
    /// Moment about X (kN·m)
    pub mx: f64,
    /// Moment about Y (kN·m)
    pub my: f64,
    /// Horizontal load X (kN)
    pub fx: f64,
    /// Horizontal load Y (kN)
    pub fy: f64,
}

/// Analysis method
#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
pub enum AnalysisMethod {
    /// Winkler (spring) model
    Winkler,
    /// Elastic half-space (Boussinesq)
    ElasticHalfSpace,
    /// Finite element plate on elastic foundation
    FiniteElement,
    /// Simplified rigid analysis
    Rigid,
}

impl RaftFoundation {
    /// Create new raft foundation
    pub fn new(geometry: RaftGeometry, soil: SoilProperties) -> Self {
        Self {
            geometry,
            soil,
            loads: Vec::new(),
            method: AnalysisMethod::Winkler,
        }
    }
    
    /// Add load
    pub fn add_load(&mut self, load: FoundationLoad) {
        self.loads.push(load);
    }
    
    /// Calculate total vertical load
    pub fn total_vertical_load(&self) -> f64 {
        self.loads.iter().map(|l| l.fz).sum()
    }
    
    /// Calculate load centroid
    pub fn load_centroid(&self) -> (f64, f64) {
        let total_p = self.total_vertical_load();
        if total_p.abs() < 1e-10 {
            return (self.geometry.length / 2.0, self.geometry.width / 2.0);
        }
        
        let x_cg: f64 = self.loads.iter().map(|l| l.fz * l.x).sum::<f64>() / total_p;
        let y_cg: f64 = self.loads.iter().map(|l| l.fz * l.y).sum::<f64>() / total_p;
        
        (x_cg, y_cg)
    }
    
    /// Calculate eccentricity
    pub fn eccentricity(&self) -> (f64, f64) {
        let (x_cg, y_cg) = self.load_centroid();
        let e_x = x_cg - self.geometry.length / 2.0;
        let e_y = y_cg - self.geometry.width / 2.0;
        (e_x, e_y)
    }
    
    /// Calculate bearing pressure (rigid assumption)
    pub fn bearing_pressure_rigid(&self) -> BearingPressureResult {
        let l = self.geometry.length;
        let b = self.geometry.width;
        let area = l * b;
        
        let total_v = self.total_vertical_load();
        let (e_x, e_y) = self.eccentricity();
        
        // Total moments
        let total_mx: f64 = self.loads.iter().map(|ld| ld.mx).sum();
        let total_my: f64 = self.loads.iter().map(|ld| ld.my).sum();
        
        // Effective eccentricity including moments
        let eff_ex = e_x + total_my / total_v;
        let eff_ey = e_y + total_mx / total_v;
        
        // Section moduli
        let z_x = l * b * b / 6.0;
        let z_y = b * l * l / 6.0;
        
        // Average, max, min pressures
        let q_avg = total_v / area;
        let q_mx = total_v * eff_ex / z_y;
        let q_my = total_v * eff_ey / z_x;
        
        let q_max = q_avg + q_mx.abs() + q_my.abs();
        let q_min = q_avg - q_mx.abs() - q_my.abs();
        
        // Corner pressures
        let q_corners = [
            q_avg + q_mx + q_my, // Corner 1
            q_avg - q_mx + q_my, // Corner 2
            q_avg - q_mx - q_my, // Corner 3
            q_avg + q_mx - q_my, // Corner 4
        ];
        
        BearingPressureResult {
            average: q_avg,
            maximum: q_max,
            minimum: q_min,
            corners: q_corners,
            uplift: q_min < 0.0,
            utilization: q_max / self.soil.bearing_capacity,
        }
    }
    
    /// Calculate settlement (immediate elastic)
    pub fn settlement_immediate(&self) -> f64 {
        let pressure = self.bearing_pressure_rigid().average;
        let b = self.geometry.width.min(self.geometry.length);
        let l = self.geometry.width.max(self.geometry.length);
        
        // Influence factor for flexible rectangular
        let m = l / b;
        let i_f = PI * m.ln() + (1.0 + m * m).sqrt().ln();
        let influence = (1.0 - self.soil.poisson_ratio.powi(2)) * i_f / PI;
        
        // Settlement (mm)
        pressure * b * influence / self.soil.elastic_modulus * 1000.0
    }
    
    /// Check design (returns utilization ratios)
    pub fn check_design(&self) -> DesignCheck {
        let pressure = self.bearing_pressure_rigid();
        let settlement = self.settlement_immediate();
        
        DesignCheck {
            bearing_ratio: pressure.utilization,
            settlement_ratio: settlement / self.soil.allowable_settlement,
            uplift_check: !pressure.uplift,
            overall_pass: pressure.utilization <= 1.0 
                && settlement <= self.soil.allowable_settlement 
                && !pressure.uplift,
        }
    }
}

/// Bearing pressure result
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BearingPressureResult {
    /// Average pressure (kPa)
    pub average: f64,
    /// Maximum pressure (kPa)
    pub maximum: f64,
    /// Minimum pressure (kPa)
    pub minimum: f64,
    /// Corner pressures [kPa]
    pub corners: [f64; 4],
    /// Uplift occurs
    pub uplift: bool,
    /// Bearing capacity utilization
    pub utilization: f64,
}

/// Design check results
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DesignCheck {
    /// Bearing capacity ratio
    pub bearing_ratio: f64,
    /// Settlement ratio
    pub settlement_ratio: f64,
    /// Uplift check passed
    pub uplift_check: bool,
    /// Overall pass
    pub overall_pass: bool,
}

/// Machine foundation analyzer
#[derive(Debug, Clone)]
pub struct MachineFoundation {
    /// Foundation block
    pub block: FoundationBlock,
    /// Machine properties
    pub machine: MachineProperties,
    /// Soil springs
    pub soil_springs: SoilSprings,
}

/// Foundation block geometry
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FoundationBlock {
    /// Length (m)
    pub length: f64,
    /// Width (m)
    pub width: f64,
    /// Height (m)
    pub height: f64,
    /// Embedment depth (m)
    pub embedment: f64,
    /// Concrete density (kg/m³)
    pub density: f64,
}

impl FoundationBlock {
    /// Calculate mass
    pub fn mass(&self) -> f64 {
        self.length * self.width * self.height * self.density
    }
    
    /// Calculate base area
    pub fn base_area(&self) -> f64 {
        self.length * self.width
    }
    
    /// Calculate moment of inertia about X
    pub fn i_xx(&self) -> f64 {
        self.mass() * (self.width.powi(2) + self.height.powi(2)) / 12.0
    }
    
    /// Calculate moment of inertia about Y
    pub fn i_yy(&self) -> f64 {
        self.mass() * (self.length.powi(2) + self.height.powi(2)) / 12.0
    }
    
    /// Calculate moment of inertia about Z
    pub fn i_zz(&self) -> f64 {
        self.mass() * (self.length.powi(2) + self.width.powi(2)) / 12.0
    }
}

/// Machine properties
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MachineProperties {
    /// Machine mass (kg)
    pub mass: f64,
    /// Operating frequency (Hz)
    pub operating_frequency: f64,
    /// Unbalanced force (N)
    pub unbalanced_force: f64,
    /// Machine type
    pub machine_type: MachineType,
    /// CG height above foundation top (m)
    pub cg_height: f64,
}

/// Machine type
#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
pub enum MachineType {
    /// Reciprocating (low speed)
    Reciprocating,
    /// Rotary (centrifugal)
    Rotary,
    /// Impact (hammer)
    Impact,
    /// High speed turbine
    Turbine,
}

/// Soil spring stiffnesses
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SoilSprings {
    /// Vertical stiffness (kN/m)
    pub k_z: f64,
    /// Horizontal X stiffness (kN/m)
    pub k_x: f64,
    /// Horizontal Y stiffness (kN/m)
    pub k_y: f64,
    /// Rocking about X stiffness (kN·m/rad)
    pub k_rx: f64,
    /// Rocking about Y stiffness (kN·m/rad)
    pub k_ry: f64,
    /// Torsional stiffness (kN·m/rad)
    pub k_t: f64,
}

impl SoilSprings {
    /// Calculate from soil properties (embedded foundation)
    pub fn from_soil(
        soil: &SoilProperties,
        block: &FoundationBlock,
    ) -> Self {
        let g = soil.elastic_modulus / (2.0 * (1.0 + soil.poisson_ratio));
        let nu = soil.poisson_ratio;
        
        let l = block.length / 2.0;
        let b = block.width / 2.0;
        let d = block.embedment;
        
        let _area = block.base_area();
        let i_x = block.length * block.width.powi(3) / 12.0;
        let i_y = block.width * block.length.powi(3) / 12.0;
        
        // Embedment factors (simplified)
        let eta_z = 1.0 + 0.6 * (d / b).sqrt();
        let eta_x = 1.0 + 0.55 * (d / b).sqrt();
        let eta_r = 1.0 + 1.2 * (d / b);
        
        // Stiffness coefficients (Gazetas)
        let k_z_0 = g * (3.4 * l / (1.0 - nu) + 1.6) * b;
        let k_x_0 = g * (6.8 * l / (2.0 - nu) + 2.4) * b;
        let k_rx_0 = g / (1.0 - nu) * i_x.powf(0.75);
        let k_ry_0 = g / (1.0 - nu) * i_y.powf(0.75);
        let k_t_0 = g * 16.0 / 3.0 * (l * b).powf(1.5);
        
        Self {
            k_z: k_z_0 * eta_z,
            k_x: k_x_0 * eta_x,
            k_y: k_x_0 * eta_x,
            k_rx: k_rx_0 * eta_r,
            k_ry: k_ry_0 * eta_r,
            k_t: k_t_0 * eta_r,
        }
    }
}

impl MachineFoundation {
    /// Create new machine foundation
    pub fn new(
        block: FoundationBlock,
        machine: MachineProperties,
        soil: &SoilProperties,
    ) -> Self {
        let soil_springs = SoilSprings::from_soil(soil, &block);
        Self {
            block,
            machine,
            soil_springs,
        }
    }
    
    /// Calculate total mass
    pub fn total_mass(&self) -> f64 {
        self.block.mass() + self.machine.mass
    }
    
    /// Calculate vertical natural frequency
    pub fn natural_frequency_vertical(&self) -> f64 {
        let m = self.total_mass();
        let k = self.soil_springs.k_z * 1000.0; // Convert to N/m
        (k / m).sqrt() / (2.0 * PI)
    }
    
    /// Calculate horizontal natural frequency
    pub fn natural_frequency_horizontal(&self) -> f64 {
        let m = self.total_mass();
        let k = self.soil_springs.k_x * 1000.0;
        (k / m).sqrt() / (2.0 * PI)
    }
    
    /// Calculate rocking natural frequency
    pub fn natural_frequency_rocking(&self) -> f64 {
        let i = self.block.i_yy() + self.machine.mass * self.machine.cg_height.powi(2);
        let k = self.soil_springs.k_ry * 1000.0;
        (k / i).sqrt() / (2.0 * PI)
    }
    
    /// Check frequency ratio (should avoid resonance)
    pub fn frequency_ratio_check(&self) -> FrequencyCheck {
        let f_op = self.machine.operating_frequency;
        let f_v = self.natural_frequency_vertical();
        let f_h = self.natural_frequency_horizontal();
        let f_r = self.natural_frequency_rocking();
        
        let ratio_v = f_op / f_v;
        let ratio_h = f_op / f_h;
        let ratio_r = f_op / f_r;
        
        // Check for resonance zone (0.7 < ratio < 1.4)
        let resonance_zone = |r: f64| r > 0.7 && r < 1.4;
        
        FrequencyCheck {
            vertical_ratio: ratio_v,
            horizontal_ratio: ratio_h,
            rocking_ratio: ratio_r,
            vertical_ok: !resonance_zone(ratio_v),
            horizontal_ok: !resonance_zone(ratio_h),
            rocking_ok: !resonance_zone(ratio_r),
        }
    }
    
    /// Calculate steady-state amplitude
    pub fn vibration_amplitude(&self, damping_ratio: f64) -> VibrationAmplitude {
        let f_op = self.machine.operating_frequency;
        let omega = 2.0 * PI * f_op;
        let f0 = self.machine.unbalanced_force;
        
        // Vertical
        let f_v = self.natural_frequency_vertical();
        let r_v = f_op / f_v;
        let d_v = ((1.0 - r_v.powi(2)).powi(2) + (2.0 * damping_ratio * r_v).powi(2)).sqrt();
        let a_v = f0 / (self.soil_springs.k_z * 1000.0) / d_v;
        
        // Horizontal
        let f_h = self.natural_frequency_horizontal();
        let r_h = f_op / f_h;
        let d_h = ((1.0 - r_h.powi(2)).powi(2) + (2.0 * damping_ratio * r_h).powi(2)).sqrt();
        let a_h = f0 / (self.soil_springs.k_x * 1000.0) / d_h;
        
        VibrationAmplitude {
            vertical_mm: a_v * 1000.0,
            horizontal_mm: a_h * 1000.0,
            velocity_mm_s: omega * (a_v.powi(2) + a_h.powi(2)).sqrt() * 1000.0,
        }
    }
}

/// Frequency check results
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FrequencyCheck {
    /// Vertical frequency ratio
    pub vertical_ratio: f64,
    /// Horizontal frequency ratio
    pub horizontal_ratio: f64,
    /// Rocking frequency ratio
    pub rocking_ratio: f64,
    /// Vertical OK (not in resonance)
    pub vertical_ok: bool,
    /// Horizontal OK
    pub horizontal_ok: bool,
    /// Rocking OK
    pub rocking_ok: bool,
}

/// Vibration amplitude results
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VibrationAmplitude {
    /// Vertical amplitude (mm)
    pub vertical_mm: f64,
    /// Horizontal amplitude (mm)
    pub horizontal_mm: f64,
    /// Peak velocity (mm/s)
    pub velocity_mm_s: f64,
}

/// Ground anchor/micropile analyzer
#[derive(Debug, Clone)]
pub struct GroundAnchor {
    /// Anchor properties
    pub properties: AnchorProperties,
    /// Soil layers
    pub soil_layers: Vec<SoilLayer>,
    /// Design standard
    pub standard: AnchorStandard,
}

/// Anchor properties
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AnchorProperties {
    /// Anchor type
    pub anchor_type: AnchorType,
    /// Total length (m)
    pub total_length: f64,
    /// Free length (m)
    pub free_length: f64,
    /// Bond length (m)
    pub bond_length: f64,
    /// Drill diameter (mm)
    pub drill_diameter: f64,
    /// Tendon area (mm²)
    pub tendon_area: f64,
    /// Tendon ultimate strength (MPa)
    pub tendon_fpu: f64,
    /// Inclination (degrees)
    pub inclination: f64,
}

/// Anchor type
#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
pub enum AnchorType {
    /// Temporary (< 2 years)
    Temporary,
    /// Permanent
    Permanent,
    /// Removable
    Removable,
}

/// Soil layer for anchor
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SoilLayer {
    /// Layer name
    pub name: String,
    /// Top depth (m)
    pub top_depth: f64,
    /// Bottom depth (m)
    pub bottom_depth: f64,
    /// Unit skin friction (kPa)
    pub skin_friction: f64,
    /// Soil type
    pub soil_type: SoilType,
}

/// Soil type
#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
pub enum SoilType {
    Rock,
    GravelDense,
    SandDense,
    SandMedium,
    SandLoose,
    ClayStiff,
    ClayMedium,
    ClaySoft,
}

impl SoilType {
    /// Typical skin friction range (kPa)
    pub fn typical_skin_friction(&self) -> (f64, f64) {
        match self {
            SoilType::Rock => (1000.0, 3000.0),
            SoilType::GravelDense => (150.0, 350.0),
            SoilType::SandDense => (100.0, 200.0),
            SoilType::SandMedium => (60.0, 100.0),
            SoilType::SandLoose => (30.0, 60.0),
            SoilType::ClayStiff => (60.0, 120.0),
            SoilType::ClayMedium => (30.0, 60.0),
            SoilType::ClaySoft => (10.0, 30.0),
        }
    }
}

/// Anchor design standard
#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
pub enum AnchorStandard {
    /// EN 1537
    EN1537,
    /// BS 8081
    BS8081,
    /// PTI DC35
    PTI,
    /// FHWA
    FHWA,
}

impl GroundAnchor {
    /// Create new anchor
    pub fn new(properties: AnchorProperties, standard: AnchorStandard) -> Self {
        Self {
            properties,
            soil_layers: Vec::new(),
            standard,
        }
    }
    
    /// Add soil layer
    pub fn add_soil_layer(&mut self, layer: SoilLayer) {
        self.soil_layers.push(layer);
    }
    
    /// Calculate bond capacity
    pub fn bond_capacity(&self) -> f64 {
        let drill_diam = self.properties.drill_diameter / 1000.0; // Convert to m
        let perimeter = PI * drill_diam;
        
        let free_depth = self.properties.free_length;
        let total_depth = self.properties.total_length;
        
        let mut capacity = 0.0;
        
        for layer in &self.soil_layers {
            // Check if bond zone intersects layer
            let bond_start = free_depth;
            let bond_end = total_depth;
            
            let intersect_top = bond_start.max(layer.top_depth);
            let intersect_bot = bond_end.min(layer.bottom_depth);
            
            if intersect_bot > intersect_top {
                let length_in_layer = intersect_bot - intersect_top;
                capacity += perimeter * length_in_layer * layer.skin_friction;
            }
        }
        
        capacity
    }
    
    /// Calculate tendon capacity
    pub fn tendon_capacity(&self) -> f64 {
        let factor = match self.properties.anchor_type {
            AnchorType::Temporary => 0.80,
            AnchorType::Permanent => 0.60,
            AnchorType::Removable => 0.60,
        };
        
        self.properties.tendon_area * self.properties.tendon_fpu * factor / 1000.0 // kN
    }
    
    /// Calculate design capacity
    pub fn design_capacity(&self) -> AnchorCapacity {
        let bond = self.bond_capacity();
        let tendon = self.tendon_capacity();
        
        // Safety factors
        let (sf_bond, sf_tendon) = match self.standard {
            AnchorStandard::EN1537 => (1.5, 1.15),
            AnchorStandard::BS8081 => (2.0, 1.4),
            AnchorStandard::PTI => (2.0, 1.5),
            AnchorStandard::FHWA => (2.0, 1.67),
        };
        
        let design_bond = bond / sf_bond;
        let design_tendon = tendon / sf_tendon;
        
        AnchorCapacity {
            ultimate_bond: bond,
            ultimate_tendon: tendon,
            design_bond,
            design_tendon,
            design_capacity: design_bond.min(design_tendon),
            governing: if design_bond < design_tendon { "Bond" } else { "Tendon" }.to_string(),
        }
    }
    
    /// Calculate proof test load
    pub fn proof_test_load(&self) -> f64 {
        match self.properties.anchor_type {
            AnchorType::Temporary => self.design_capacity().design_capacity * 1.25,
            AnchorType::Permanent => self.design_capacity().design_capacity * 1.50,
            AnchorType::Removable => self.design_capacity().design_capacity * 1.50,
        }
    }
}

/// Anchor capacity results
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AnchorCapacity {
    /// Ultimate bond capacity (kN)
    pub ultimate_bond: f64,
    /// Ultimate tendon capacity (kN)
    pub ultimate_tendon: f64,
    /// Design bond capacity (kN)
    pub design_bond: f64,
    /// Design tendon capacity (kN)
    pub design_tendon: f64,
    /// Design capacity (kN)
    pub design_capacity: f64,
    /// Governing failure mode
    pub governing: String,
}

/// Combined footing designer
#[derive(Debug, Clone)]
pub struct CombinedFooting {
    /// Column loads
    pub columns: Vec<ColumnLoad>,
    /// Soil bearing capacity (kPa)
    pub bearing_capacity: f64,
    /// Footing width (m) - to be determined
    pub width: Option<f64>,
}

/// Column load for combined footing
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ColumnLoad {
    /// Column ID
    pub id: String,
    /// X position (m)
    pub x: f64,
    /// Axial load (kN)
    pub axial: f64,
    /// Column width (m)
    pub column_width: f64,
}

impl CombinedFooting {
    /// Create new combined footing
    pub fn new(columns: Vec<ColumnLoad>, bearing_capacity: f64) -> Self {
        Self {
            columns,
            bearing_capacity,
            width: None,
        }
    }
    
    /// Calculate resultant position
    pub fn resultant_position(&self) -> f64 {
        let total_p: f64 = self.columns.iter().map(|c| c.axial).sum();
        let moment: f64 = self.columns.iter().map(|c| c.axial * c.x).sum();
        moment / total_p
    }
    
    /// Calculate required length for uniform pressure
    pub fn required_length(&self) -> f64 {
        let x_r = self.resultant_position();
        
        // For uniform pressure, resultant should be at center
        // Length = 2 * (distance from first column to resultant + cantilever)
        let x_min = self.columns.iter().map(|c| c.x).fold(f64::INFINITY, f64::min);
        let x_max = self.columns.iter().map(|c| c.x).fold(f64::NEG_INFINITY, f64::max);
        
        2.0 * (x_r - x_min).max(x_max - x_r) + 0.3 // Add edge distance
    }
    
    /// Calculate required width
    pub fn calculate_width(&mut self) -> f64 {
        let total_p: f64 = self.columns.iter().map(|c| c.axial).sum();
        let length = self.required_length();
        
        // Required area for bearing
        let required_area = total_p / (0.9 * self.bearing_capacity); // 90% for moment effect
        let width = required_area / length;
        
        // Minimum width = largest column + 0.3m each side
        let min_width = self.columns.iter()
            .map(|c| c.column_width)
            .fold(0.0, f64::max) + 0.6;
        
        let final_width = width.max(min_width);
        self.width = Some(final_width);
        final_width
    }
    
    /// Calculate shear and moment diagram points
    pub fn internal_forces(&mut self, num_points: usize) -> Vec<(f64, f64, f64)> {
        let length = self.required_length();
        let width = self.width.unwrap_or_else(|| self.calculate_width());
        let total_p: f64 = self.columns.iter().map(|c| c.axial).sum();
        let pressure = total_p / (length * width);
        
        let mut results = Vec::new();
        let dx = length / (num_points - 1) as f64;
        
        let mut x = 0.0;
        for _ in 0..num_points {
            // Shear = integral of (pressure - point loads)
            let shear = pressure * width * x 
                - self.columns.iter()
                    .filter(|c| c.x <= x)
                    .map(|c| c.axial)
                    .sum::<f64>();
            
            // Moment = integral of shear
            let moment = pressure * width * x.powi(2) / 2.0
                - self.columns.iter()
                    .filter(|c| c.x <= x)
                    .map(|c| c.axial * (x - c.x))
                    .sum::<f64>();
            
            results.push((x, shear, moment));
            x += dx;
        }
        
        results
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    
    #[test]
    fn test_soil_from_spt() {
        let soil = SoilProperties::from_spt(30);
        assert!(soil.subgrade_modulus > 10000.0);
        assert!(soil.bearing_capacity > 300.0);
    }
    
    #[test]
    fn test_raft_creation() {
        let geometry = RaftGeometry {
            length: 20.0,
            width: 15.0,
            thickness: 0.8,
            edge_thickening: None,
            pedestals: vec![],
        };
        
        let soil = SoilProperties::dense_sand();
        let raft = RaftFoundation::new(geometry, soil);
        
        assert_eq!(raft.method, AnalysisMethod::Winkler);
    }
    
    #[test]
    fn test_raft_load_centroid() {
        let geometry = RaftGeometry {
            length: 10.0,
            width: 10.0,
            thickness: 0.5,
            edge_thickening: None,
            pedestals: vec![],
        };
        
        let mut raft = RaftFoundation::new(geometry, SoilProperties::stiff_clay());
        
        raft.add_load(FoundationLoad {
            name: "C1".to_string(),
            x: 2.0, y: 5.0, fz: 1000.0, mx: 0.0, my: 0.0, fx: 0.0, fy: 0.0,
        });
        raft.add_load(FoundationLoad {
            name: "C2".to_string(),
            x: 8.0, y: 5.0, fz: 1000.0, mx: 0.0, my: 0.0, fx: 0.0, fy: 0.0,
        });
        
        let (x_cg, y_cg) = raft.load_centroid();
        assert!((x_cg - 5.0).abs() < 0.01);
        assert!((y_cg - 5.0).abs() < 0.01);
    }
    
    #[test]
    fn test_bearing_pressure() {
        let geometry = RaftGeometry {
            length: 10.0,
            width: 10.0,
            thickness: 0.5,
            edge_thickening: None,
            pedestals: vec![],
        };
        
        let mut raft = RaftFoundation::new(geometry, SoilProperties::dense_sand());
        
        raft.add_load(FoundationLoad {
            name: "C1".to_string(),
            x: 5.0, y: 5.0, fz: 10000.0, mx: 0.0, my: 0.0, fx: 0.0, fy: 0.0,
        });
        
        let pressure = raft.bearing_pressure_rigid();
        
        // Average = 10000 / 100 = 100 kPa
        assert!((pressure.average - 100.0).abs() < 0.1);
    }
    
    #[test]
    fn test_settlement() {
        let geometry = RaftGeometry {
            length: 10.0,
            width: 10.0,
            thickness: 0.5,
            edge_thickening: None,
            pedestals: vec![],
        };
        
        let mut raft = RaftFoundation::new(geometry, SoilProperties::dense_sand());
        
        raft.add_load(FoundationLoad {
            name: "C1".to_string(),
            x: 5.0, y: 5.0, fz: 5000.0, mx: 0.0, my: 0.0, fx: 0.0, fy: 0.0,
        });
        
        let settlement = raft.settlement_immediate();
        assert!(settlement > 0.0);
        assert!(settlement < 100.0); // Reasonable range
    }
    
    #[test]
    fn test_foundation_block() {
        let block = FoundationBlock {
            length: 4.0,
            width: 3.0,
            height: 1.5,
            embedment: 0.5,
            density: 2400.0,
        };
        
        let mass = block.mass();
        assert!((mass - 4.0 * 3.0 * 1.5 * 2400.0).abs() < 1.0);
    }
    
    #[test]
    fn test_machine_foundation() {
        let block = FoundationBlock {
            length: 4.0,
            width: 3.0,
            height: 1.5,
            embedment: 0.5,
            density: 2400.0,
        };
        
        let machine = MachineProperties {
            mass: 5000.0,
            operating_frequency: 25.0,
            unbalanced_force: 10000.0,
            machine_type: MachineType::Rotary,
            cg_height: 0.5,
        };
        
        let soil = SoilProperties::dense_sand();
        let foundation = MachineFoundation::new(block, machine, &soil);
        
        assert!(foundation.total_mass() > 40000.0);
    }
    
    #[test]
    fn test_natural_frequencies() {
        let block = FoundationBlock {
            length: 4.0,
            width: 3.0,
            height: 1.5,
            embedment: 0.5,
            density: 2400.0,
        };
        
        let machine = MachineProperties {
            mass: 5000.0,
            operating_frequency: 25.0,
            unbalanced_force: 10000.0,
            machine_type: MachineType::Rotary,
            cg_height: 0.5,
        };
        
        let soil = SoilProperties::dense_sand();
        let foundation = MachineFoundation::new(block, machine, &soil);
        
        let f_v = foundation.natural_frequency_vertical();
        let f_h = foundation.natural_frequency_horizontal();
        
        assert!(f_v > 0.0);
        assert!(f_h > 0.0);
    }
    
    #[test]
    fn test_frequency_check() {
        let block = FoundationBlock {
            length: 6.0,
            width: 4.0,
            height: 2.0,
            embedment: 1.0,
            density: 2400.0,
        };
        
        let machine = MachineProperties {
            mass: 10000.0,
            operating_frequency: 50.0,
            unbalanced_force: 20000.0,
            machine_type: MachineType::Turbine,
            cg_height: 1.0,
        };
        
        let soil = SoilProperties::dense_sand();
        let foundation = MachineFoundation::new(block, machine, &soil);
        
        let check = foundation.frequency_ratio_check();
        // Should have non-zero ratios
        assert!(check.vertical_ratio > 0.0);
    }
    
    #[test]
    fn test_anchor_creation() {
        let props = AnchorProperties {
            anchor_type: AnchorType::Permanent,
            total_length: 15.0,
            free_length: 8.0,
            bond_length: 7.0,
            drill_diameter: 150.0,
            tendon_area: 1400.0,
            tendon_fpu: 1860.0,
            inclination: 15.0,
        };
        
        let anchor = GroundAnchor::new(props, AnchorStandard::EN1537);
        assert!(anchor.soil_layers.is_empty());
    }
    
    #[test]
    fn test_anchor_capacity() {
        let props = AnchorProperties {
            anchor_type: AnchorType::Permanent,
            total_length: 15.0,
            free_length: 8.0,
            bond_length: 7.0,
            drill_diameter: 150.0,
            tendon_area: 1400.0,
            tendon_fpu: 1860.0,
            inclination: 15.0,
        };
        
        let mut anchor = GroundAnchor::new(props, AnchorStandard::EN1537);
        
        anchor.add_soil_layer(SoilLayer {
            name: "Sand".to_string(),
            top_depth: 0.0,
            bottom_depth: 20.0,
            skin_friction: 100.0,
            soil_type: SoilType::SandDense,
        });
        
        let capacity = anchor.design_capacity();
        assert!(capacity.design_capacity > 0.0);
    }
    
    #[test]
    fn test_soil_type_friction() {
        let (min, max) = SoilType::Rock.typical_skin_friction();
        assert!(min > 500.0);
        assert!(max > min);
    }
    
    #[test]
    fn test_combined_footing() {
        let columns = vec![
            ColumnLoad { id: "C1".to_string(), x: 0.0, axial: 1000.0, column_width: 0.4 },
            ColumnLoad { id: "C2".to_string(), x: 4.0, axial: 1500.0, column_width: 0.4 },
        ];
        
        let mut footing = CombinedFooting::new(columns, 200.0);
        
        let resultant_x = footing.resultant_position();
        // Weighted average: (1000*0 + 1500*4) / 2500 = 2.4
        assert!((resultant_x - 2.4).abs() < 0.01);
    }
    
    #[test]
    fn test_combined_footing_width() {
        let columns = vec![
            ColumnLoad { id: "C1".to_string(), x: 0.0, axial: 1000.0, column_width: 0.4 },
            ColumnLoad { id: "C2".to_string(), x: 4.0, axial: 1000.0, column_width: 0.4 },
        ];
        
        let mut footing = CombinedFooting::new(columns, 200.0);
        let width = footing.calculate_width();
        
        assert!(width >= 1.0);
    }
    
    #[test]
    fn test_internal_forces() {
        let columns = vec![
            ColumnLoad { id: "C1".to_string(), x: 1.0, axial: 1000.0, column_width: 0.4 },
            ColumnLoad { id: "C2".to_string(), x: 5.0, axial: 1000.0, column_width: 0.4 },
        ];
        
        let mut footing = CombinedFooting::new(columns, 200.0);
        footing.calculate_width();
        
        let forces = footing.internal_forces(10);
        assert_eq!(forces.len(), 10);
    }
    
    #[test]
    fn test_machine_types() {
        assert_ne!(MachineType::Reciprocating, MachineType::Turbine);
    }
    
    #[test]
    fn test_anchor_standards() {
        assert_ne!(AnchorStandard::EN1537, AnchorStandard::FHWA);
    }
}
