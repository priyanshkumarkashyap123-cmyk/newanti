// ============================================================================
// STADIUM & LONG-SPAN STRUCTURES MODULE  
// Space frames, tensile structures, retractable roofs
// ============================================================================

use serde::{Deserialize, Serialize};
use std::f64::consts::PI;

// ============================================================================
// SPACE FRAME STRUCTURES
// ============================================================================

/// Space frame grid type
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum SpaceFrameType {
    /// Two-way square grid
    SquareOnSquare,
    /// Diagonal on square
    DiagonalOnSquare,
    /// Triangular grid
    Triangular,
    /// Three-way grid
    ThreeWay,
}

/// Space frame node
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SpaceFrameNode {
    pub id: usize,
    pub x: f64,
    pub y: f64,
    pub z: f64,
    pub is_support: bool,
}

/// Space frame member
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SpaceFrameMember {
    pub start_node: usize,
    pub end_node: usize,
    pub area: f64,        // mm²
    pub is_chord: bool,   // Top/bottom chord vs web
}

/// Space frame structure
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SpaceFrame {
    /// Frame type
    pub frame_type: SpaceFrameType,
    /// Span in X (m)
    pub span_x: f64,
    /// Span in Y (m)
    pub span_y: f64,
    /// Module size (m)
    pub module_size: f64,
    /// Depth (m)
    pub depth: f64,
    /// Chord member area (mm²)
    pub chord_area: f64,
    /// Web member area (mm²)
    pub web_area: f64,
}

impl SpaceFrame {
    pub fn new(span_x: f64, span_y: f64, depth: f64) -> Self {
        let module_size = span_x.min(span_y) / 10.0;
        
        Self {
            frame_type: SpaceFrameType::SquareOnSquare,
            span_x,
            span_y,
            module_size,
            depth,
            chord_area: 2000.0,
            web_area: 1000.0,
        }
    }
    
    /// Number of modules in X
    pub fn modules_x(&self) -> u32 {
        (self.span_x / self.module_size).ceil() as u32
    }
    
    /// Number of modules in Y
    pub fn modules_y(&self) -> u32 {
        (self.span_y / self.module_size).ceil() as u32
    }
    
    /// Total number of nodes (approximate)
    pub fn node_count(&self) -> u32 {
        let nx = self.modules_x() + 1;
        let ny = self.modules_y() + 1;
        
        match self.frame_type {
            SpaceFrameType::SquareOnSquare => 2 * nx * ny,
            SpaceFrameType::DiagonalOnSquare => 2 * nx * ny,
            SpaceFrameType::Triangular => (2.0 * (nx * ny) as f64 * 1.15) as u32,
            SpaceFrameType::ThreeWay => (2.0 * (nx * ny) as f64 * 1.3) as u32,
        }
    }
    
    /// Total number of members (approximate)
    pub fn member_count(&self) -> u32 {
        let nx = self.modules_x();
        let ny = self.modules_y();
        
        match self.frame_type {
            SpaceFrameType::SquareOnSquare => {
                // Top chords + bottom chords + webs
                2 * (nx * (ny + 1) + ny * (nx + 1)) + 4 * nx * ny
            }
            SpaceFrameType::DiagonalOnSquare => {
                3 * (nx * (ny + 1) + ny * (nx + 1)) + 4 * nx * ny
            }
            _ => (5 * nx * ny) as u32,
        }
    }
    
    /// Estimated total weight (kN)
    pub fn estimated_weight(&self) -> f64 {
        let steel_density = 78.5; // kN/m³
        
        // Chord length
        let chord_length = 2.0 * (self.span_x * (self.modules_y() + 1) as f64 +
                                  self.span_y * (self.modules_x() + 1) as f64);
        
        // Web length (diagonal)
        let web_length_each = (self.module_size.powi(2) + self.depth.powi(2)).sqrt();
        let web_count = (4 * self.modules_x() * self.modules_y()) as f64;
        let total_web = web_length_each * web_count;
        
        let chord_volume = chord_length * self.chord_area / 1e6;
        let web_volume = total_web * self.web_area / 1e6;
        
        (chord_volume + web_volume) * steel_density
    }
    
    /// Equivalent distributed load for self-weight (kN/m²)
    pub fn self_weight_per_area(&self) -> f64 {
        self.estimated_weight() / (self.span_x * self.span_y)
    }
    
    /// Deflection under uniform load (approximate, m)
    pub fn deflection(&self, load_kpa: f64) -> f64 {
        let e = 200_000.0; // Steel E (N/mm²)
        let l = self.span_x.max(self.span_y) * 1000.0; // mm
        
        // Effective I per module strip: 2 chord layers at depth/2 from centroid
        let d_half = self.depth / 2.0 * 1000.0; // mm
        let i_eff = 2.0 * self.chord_area * d_half.powi(2); // mm⁴
        
        // Load per module strip width (N/mm)
        let w = load_kpa * 1e-3 * self.module_size * 1000.0;
        
        // Simply-supported deflection
        5.0 * w * l.powi(4) / (384.0 * e * i_eff) / 1000.0 // mm to m
    }
    
    /// Suggested depth based on span
    pub fn recommended_depth(span: f64) -> f64 {
        span / 20.0 // L/20 is typical for space frames
    }
}

// ============================================================================
// CABLE/TENSILE STRUCTURES
// ============================================================================

/// Cable structure type
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum CableStructureType {
    /// Simple catenary cable
    Catenary,
    /// Pretensioned cable truss
    CableTruss,
    /// Cable net (orthogonal)
    CableNet,
    /// Spoked wheel
    SpokedWheel,
    /// Radial cable dome
    CableDome,
}

/// Single cable element
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Cable {
    /// Span (m)
    pub span: f64,
    /// Sag (m)
    pub sag: f64,
    /// Cable area (mm²)
    pub area: f64,
    /// Breaking strength (kN)
    pub breaking_load: f64,
    /// Pretension (kN)
    pub pretension: f64,
}

impl Cable {
    pub fn new(span: f64, sag: f64, area: f64) -> Self {
        // High-strength strand: ~1770 MPa breaking
        let breaking_load = 1.77 * area;
        
        Self {
            span,
            sag,
            area,
            breaking_load,
            pretension: breaking_load * 0.3,
        }
    }
    
    /// Sag ratio (sag/span)
    pub fn sag_ratio(&self) -> f64 {
        self.sag / self.span
    }
    
    /// Cable length (parabolic approximation)
    pub fn length(&self) -> f64 {
        self.span * (1.0 + 8.0 * self.sag_ratio().powi(2) / 3.0)
    }
    
    /// Horizontal tension under uniform load (kN)
    pub fn horizontal_tension(&self, w_per_m: f64) -> f64 {
        w_per_m * self.span.powi(2) / (8.0 * self.sag)
    }
    
    /// Maximum cable tension (kN)
    pub fn max_tension(&self, w_per_m: f64) -> f64 {
        let h = self.horizontal_tension(w_per_m);
        let v = w_per_m * self.span / 2.0;
        (h.powi(2) + v.powi(2)).sqrt()
    }
    
    /// Cable stress (MPa)
    pub fn stress(&self, tension: f64) -> f64 {
        tension * 1000.0 / self.area
    }
    
    /// Factor of safety
    pub fn factor_of_safety(&self, tension: f64) -> f64 {
        self.breaking_load / tension
    }
    
    /// Elongation under tension (m)
    pub fn elongation(&self, tension: f64) -> f64 {
        let e = 160_000.0; // Cable E (MPa)
        tension * self.length() * 1000.0 / (self.area * e)
    }
}

/// Cable truss (prestressed)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CableTruss {
    /// Span (m)
    pub span: f64,
    /// Top cable sag (m, negative = sagging down)
    pub top_sag: f64,
    /// Bottom cable sag (m, positive = sagging down)
    pub bottom_sag: f64,
    /// Top cable area (mm²)
    pub top_area: f64,
    /// Bottom cable area (mm²)
    pub bottom_area: f64,
    /// Spreader spacing (m)
    pub spreader_spacing: f64,
}

impl CableTruss {
    pub fn new(span: f64, truss_depth: f64) -> Self {
        Self {
            span,
            top_sag: -truss_depth / 3.0,
            bottom_sag: 2.0 * truss_depth / 3.0,
            top_area: 1500.0,
            bottom_area: 2000.0,
            spreader_spacing: span / 10.0,
        }
    }
    
    /// Total truss depth (m)
    pub fn depth(&self) -> f64 {
        self.bottom_sag - self.top_sag
    }
    
    /// Stiffness increase factor over single cable
    pub fn stiffness_factor(&self) -> f64 {
        // Approximate based on depth/span
        1.0 + 5.0 * (self.depth() / self.span)
    }
    
    /// Minimum pretension to prevent slack (kN)
    pub fn min_pretension(&self, design_load: f64) -> f64 {
        let w = design_load; // kN/m
        let h = w * self.span.powi(2) / (8.0 * self.bottom_sag.abs());
        h * 0.3 // 30% margin
    }
}

// ============================================================================
// MEMBRANE STRUCTURES
// ============================================================================

/// Membrane material type
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum MembraneType {
    /// PVC coated polyester
    PvcPolyester,
    /// PTFE coated fiberglass
    PtfeFiberglass,
    /// ETFE foil
    Etfe,
    /// Silicone coated fiberglass
    SiliconeFiberglass,
}

impl MembraneType {
    /// Tensile strength (kN/m)
    pub fn tensile_strength(&self) -> f64 {
        match self {
            MembraneType::PvcPolyester => 80.0,
            MembraneType::PtfeFiberglass => 140.0,
            MembraneType::Etfe => 50.0,
            MembraneType::SiliconeFiberglass => 100.0,
        }
    }
    
    /// Weight (kg/m²)
    pub fn weight(&self) -> f64 {
        match self {
            MembraneType::PvcPolyester => 1.0,
            MembraneType::PtfeFiberglass => 1.5,
            MembraneType::Etfe => 0.35, // Single layer
            MembraneType::SiliconeFiberglass => 1.2,
        }
    }
    
    /// Typical lifespan (years)
    pub fn lifespan(&self) -> u32 {
        match self {
            MembraneType::PvcPolyester => 15,
            MembraneType::PtfeFiberglass => 30,
            MembraneType::Etfe => 25,
            MembraneType::SiliconeFiberglass => 25,
        }
    }
    
    /// Translucency (%)
    pub fn translucency(&self) -> f64 {
        match self {
            MembraneType::PvcPolyester => 15.0,
            MembraneType::PtfeFiberglass => 12.0,
            MembraneType::Etfe => 95.0,
            MembraneType::SiliconeFiberglass => 20.0,
        }
    }
}

/// Anticlastic (saddle) membrane
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SaddleMembrane {
    /// Span in main direction (m)
    pub span_x: f64,
    /// Span in cross direction (m)
    pub span_y: f64,
    /// Rise (high points, m)
    pub rise: f64,
    /// Dip (low points, m)
    pub dip: f64,
    /// Membrane material
    pub material: MembraneType,
    /// Prestress (kN/m)
    pub prestress: f64,
}

impl SaddleMembrane {
    pub fn new(span_x: f64, span_y: f64) -> Self {
        let curvature = span_x.max(span_y) / 10.0;
        
        Self {
            span_x,
            span_y,
            rise: curvature,
            dip: curvature,
            material: MembraneType::PvcPolyester,
            prestress: 2.0, // kN/m
        }
    }
    
    /// Principal curvature radii (m)
    pub fn curvature_radii(&self) -> (f64, f64) {
        // Approximate for hyperbolic paraboloid
        let r1 = self.span_x.powi(2) / (8.0 * self.rise);
        let r2 = self.span_y.powi(2) / (8.0 * self.dip);
        (r1, r2)
    }
    
    /// Surface area (approximate, m²)
    pub fn surface_area(&self) -> f64 {
        // Slightly larger than plan due to curvature
        self.span_x * self.span_y * 1.05
    }
    
    /// Membrane stress under external pressure (kN/m)
    pub fn stress_under_pressure(&self, pressure_kpa: f64) -> f64 {
        let (r1, r2) = self.curvature_radii();
        
        // Membrane equation: σ/R = p (for each direction)
        let sigma_1 = pressure_kpa * r1 + self.prestress;
        let sigma_2 = pressure_kpa * r2 + self.prestress;
        
        sigma_1.max(sigma_2)
    }
    
    /// Factor of safety
    pub fn factor_of_safety(&self, stress: f64) -> f64 {
        self.material.tensile_strength() / stress
    }
    
    /// Self-weight load (kN/m²)
    pub fn self_weight(&self) -> f64 {
        self.material.weight() * 9.81 / 1000.0
    }
}

// ============================================================================
// RETRACTABLE ROOF
// ============================================================================

/// Retractable roof type
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum RetractableRoofType {
    /// Sliding panels
    Sliding,
    /// Folding/pleating panels
    Folding,
    /// Radial (rotating panels)
    Radial,
    /// Pantograph mechanism
    Pantograph,
    /// Retractable membrane
    Membrane,
}

/// Retractable roof system
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RetractableRoof {
    /// Roof type
    pub roof_type: RetractableRoofType,
    /// Opening span (m)
    pub span: f64,
    /// Opening width (m)
    pub width: f64,
    /// Number of panels
    pub num_panels: u32,
    /// Opening time (minutes)
    pub opening_time: f64,
    /// Panel weight (kN/m²)
    pub panel_weight: f64,
}

impl RetractableRoof {
    pub fn sliding(span: f64, width: f64) -> Self {
        Self {
            roof_type: RetractableRoofType::Sliding,
            span,
            width,
            num_panels: 2,
            opening_time: 20.0,
            panel_weight: 1.5,
        }
    }
    
    /// Total panel area (m²)
    pub fn panel_area(&self) -> f64 {
        self.span * self.width
    }
    
    /// Total roof weight (kN)
    pub fn total_weight(&self) -> f64 {
        self.panel_area() * self.panel_weight
    }
    
    /// Travel distance per panel (m)
    pub fn travel_distance(&self) -> f64 {
        match self.roof_type {
            RetractableRoofType::Sliding => self.span / (self.num_panels as f64),
            RetractableRoofType::Folding => self.span * 0.8,
            RetractableRoofType::Radial => PI * self.span / 4.0,
            RetractableRoofType::Pantograph => self.span * 0.7,
            RetractableRoofType::Membrane => self.span,
        }
    }
    
    /// Travel speed (m/min)
    pub fn travel_speed(&self) -> f64 {
        self.travel_distance() / self.opening_time
    }
    
    /// Drive force required (kN) - simplified
    pub fn drive_force(&self) -> f64 {
        let weight_per_panel = self.total_weight() / (self.num_panels as f64);
        let friction = 0.02; // Wheel friction coefficient
        let incline_factor = 1.1; // For slight slopes
        
        weight_per_panel * friction * incline_factor
    }
    
    /// Drive power required (kW)
    pub fn drive_power(&self) -> f64 {
        let force = self.drive_force();
        let speed = self.travel_speed() / 60.0; // m/s
        let efficiency = 0.7;
        
        force * speed / efficiency
    }
}

// ============================================================================
// TESTS
// ============================================================================

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_space_frame() {
        let frame = SpaceFrame::new(50.0, 50.0, 3.0);
        
        assert!(frame.node_count() > 100);
        assert!(frame.member_count() > 200);
    }

    #[test]
    fn test_space_frame_weight() {
        let frame = SpaceFrame::new(50.0, 50.0, 3.0);
        let weight = frame.estimated_weight();
        
        assert!(weight > 0.0);
    }

    #[test]
    fn test_space_frame_deflection() {
        let frame = SpaceFrame::new(50.0, 50.0, 3.0);
        let defl = frame.deflection(1.0);
        
        assert!(defl > 0.0 && defl < 1.0);
    }

    #[test]
    fn test_cable() {
        let cable = Cable::new(100.0, 5.0, 2000.0);
        
        assert!(cable.sag_ratio() < 0.1);
        assert!(cable.length() > cable.span);
    }

    #[test]
    fn test_cable_tension() {
        let cable = Cable::new(100.0, 5.0, 2000.0);
        let t = cable.max_tension(5.0);
        
        assert!(t > 0.0);
    }

    #[test]
    fn test_cable_fos() {
        let cable = Cable::new(100.0, 5.0, 2000.0);
        let t = cable.max_tension(5.0);
        let fos = cable.factor_of_safety(t);
        
        assert!(fos > 1.0);
    }

    #[test]
    fn test_cable_truss() {
        let truss = CableTruss::new(100.0, 5.0);
        
        assert!(truss.depth() > 0.0);
        assert!(truss.stiffness_factor() > 1.0);
    }

    #[test]
    fn test_membrane_material() {
        assert!(MembraneType::PtfeFiberglass.tensile_strength() > 
                MembraneType::PvcPolyester.tensile_strength());
    }

    #[test]
    fn test_saddle_membrane() {
        let membrane = SaddleMembrane::new(30.0, 30.0);
        
        assert!(membrane.surface_area() > 900.0);
    }

    #[test]
    fn test_membrane_stress() {
        let membrane = SaddleMembrane::new(30.0, 30.0);
        let stress = membrane.stress_under_pressure(1.0);
        
        assert!(stress > 0.0);
    }

    #[test]
    fn test_retractable_roof() {
        let roof = RetractableRoof::sliding(100.0, 80.0);
        
        assert_eq!(roof.panel_area(), 8000.0);
    }

    #[test]
    fn test_roof_mechanics() {
        let roof = RetractableRoof::sliding(100.0, 80.0);
        
        assert!(roof.travel_speed() > 0.0);
        assert!(roof.drive_force() > 0.0);
        assert!(roof.drive_power() > 0.0);
    }

    #[test]
    fn test_recommended_depth() {
        let depth = SpaceFrame::recommended_depth(60.0);
        
        assert!((depth - 3.0).abs() < 0.1);
    }

    #[test]
    fn test_etfe_translucency() {
        assert!(MembraneType::Etfe.translucency() > 90.0);
    }
}
