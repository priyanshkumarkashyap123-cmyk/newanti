// ============================================================================
// SPACE STRUCTURES - Phase 21
// Geodesic domes, tensegrity, deployable structures
// Standards: AISC, ASCE 7, specialized research
// ============================================================================

use serde::{Deserialize, Serialize};
use std::f64::consts::PI;

// ============================================================================
// GEODESIC DOME
// ============================================================================

/// Geodesic dome frequency classes
#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
pub enum GeodesicFrequency {
    V1,  // 1-frequency (icosahedron)
    V2,  // 2-frequency
    V3,  // 3-frequency
    V4,  // 4-frequency
    V5,  // 5-frequency
    V6,  // 6-frequency
}

impl GeodesicFrequency {
    /// Number of faces
    pub fn num_faces(&self) -> usize {
        let n = self.value() as usize;
        20 * n * n
    }
    
    /// Number of vertices
    pub fn num_vertices(&self) -> usize {
        let n = self.value() as usize;
        10 * n * n + 2
    }
    
    /// Number of edges
    pub fn num_edges(&self) -> usize {
        let n = self.value() as usize;
        30 * n * n
    }
    
    /// Frequency value
    pub fn value(&self) -> u32 {
        match self {
            GeodesicFrequency::V1 => 1,
            GeodesicFrequency::V2 => 2,
            GeodesicFrequency::V3 => 3,
            GeodesicFrequency::V4 => 4,
            GeodesicFrequency::V5 => 5,
            GeodesicFrequency::V6 => 6,
        }
    }
}

/// Geodesic dome design
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GeodesicDome {
    /// Dome radius (m)
    pub radius: f64,
    /// Frequency
    pub frequency: GeodesicFrequency,
    /// Truncation fraction (1.0 = full sphere, 0.5 = hemisphere)
    pub truncation: f64,
    /// Hub type
    pub hub_type: String,
    /// Strut material
    pub strut_material: String,
}

impl GeodesicDome {
    pub fn new(radius: f64, frequency: GeodesicFrequency) -> Self {
        Self {
            radius,
            frequency,
            truncation: 0.5, // Hemisphere default
            hub_type: "steel_sphere".to_string(),
            strut_material: "steel_tube".to_string(),
        }
    }
    
    /// Full sphere
    pub fn full_sphere(radius: f64, frequency: GeodesicFrequency) -> Self {
        let mut dome = Self::new(radius, frequency);
        dome.truncation = 1.0;
        dome
    }
    
    /// Surface area (m²)
    pub fn surface_area(&self) -> f64 {
        4.0 * PI * self.radius.powi(2) * self.truncation
    }
    
    /// Floor area (m²)
    pub fn floor_area(&self) -> f64 {
        if self.truncation <= 0.5 {
            PI * self.radius.powi(2)
        } else {
            let h = self.radius * (2.0 * self.truncation - 1.0);
            PI * (self.radius.powi(2) - h.powi(2))
        }
    }
    
    /// Enclosed volume (m³)
    pub fn volume(&self) -> f64 {
        let v_sphere = 4.0 / 3.0 * PI * self.radius.powi(3);
        v_sphere * self.truncation
    }
    
    /// Number of struts
    pub fn num_struts(&self) -> usize {
        let full = self.frequency.num_edges();
        (full as f64 * self.truncation * 1.1) as usize // Approximate
    }
    
    /// Number of hubs
    pub fn num_hubs(&self) -> usize {
        let full = self.frequency.num_vertices();
        (full as f64 * self.truncation * 1.1) as usize
    }
    
    /// Average strut length (m)
    pub fn avg_strut_length(&self) -> f64 {
        let n = self.frequency.value() as f64;
        // Approximate chord length
        self.radius * PI / (n * 2.5)
    }
    
    /// Maximum strut length (m)
    pub fn max_strut_length(&self) -> f64 {
        self.avg_strut_length() * 1.15
    }
    
    /// Minimum strut length (m)
    pub fn min_strut_length(&self) -> f64 {
        self.avg_strut_length() * 0.85
    }
    
    /// Number of unique strut lengths
    pub fn num_strut_types(&self) -> usize {
        let n = self.frequency.value() as usize;
        match n {
            1 => 1,
            2 => 2,
            3 => 3,
            4 => 6,
            5 => 9,
            6 => 12,
            _ => n * 2,
        }
    }
    
    /// Wind load coefficient (simplified)
    pub fn wind_coefficient(&self) -> f64 {
        // Dome shape factor
        0.5 + 0.3 * (1.0 - self.truncation)
    }
    
    /// Snow load coefficient
    pub fn snow_coefficient(&self) -> f64 {
        // Curved roof factor
        if self.truncation <= 0.3 {
            0.7
        } else {
            0.7 + 0.3 * (self.truncation - 0.3)
        }
    }
}

// ============================================================================
// TENSEGRITY
// ============================================================================

/// Tensegrity topology types
#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
pub enum TensegrityType {
    /// Simplex (3-strut prism)
    Simplex,
    /// Icosahedron
    Icosahedron,
    /// Octahedron
    Octahedron,
    /// Truncated tetrahedron
    TruncatedTetrahedron,
    /// Snelson X-piece
    SnelsonX,
    /// Tower (stacked modules)
    Tower,
}

/// Tensegrity structure
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Tensegrity {
    /// Type
    pub tensegrity_type: TensegrityType,
    /// Characteristic dimension (m)
    pub size: f64,
    /// Strut material
    pub strut_material: String,
    /// Strut diameter (mm)
    pub strut_diameter: f64,
    /// Cable material
    pub cable_material: String,
    /// Cable diameter (mm)
    pub cable_diameter: f64,
    /// Prestress level (kN)
    pub prestress: f64,
}

impl Tensegrity {
    pub fn new(tensegrity_type: TensegrityType, size: f64) -> Self {
        Self {
            tensegrity_type,
            size,
            strut_material: "steel_tube".to_string(),
            strut_diameter: 50.0,
            cable_material: "stainless_steel".to_string(),
            cable_diameter: 8.0,
            prestress: 10.0,
        }
    }
    
    /// Number of struts
    pub fn num_struts(&self) -> usize {
        match self.tensegrity_type {
            TensegrityType::Simplex => 3,
            TensegrityType::Icosahedron => 6,
            TensegrityType::Octahedron => 3,
            TensegrityType::TruncatedTetrahedron => 6,
            TensegrityType::SnelsonX => 4,
            TensegrityType::Tower => 12, // 4-module tower
        }
    }
    
    /// Number of cables
    pub fn num_cables(&self) -> usize {
        match self.tensegrity_type {
            TensegrityType::Simplex => 9,
            TensegrityType::Icosahedron => 24,
            TensegrityType::Octahedron => 12,
            TensegrityType::TruncatedTetrahedron => 18,
            TensegrityType::SnelsonX => 16,
            TensegrityType::Tower => 36,
        }
    }
    
    /// Strut length (m)
    pub fn strut_length(&self) -> f64 {
        match self.tensegrity_type {
            TensegrityType::Simplex => self.size * 1.732,
            TensegrityType::Icosahedron => self.size * 1.618,
            TensegrityType::Octahedron => self.size * 1.414,
            TensegrityType::TruncatedTetrahedron => self.size * 1.5,
            TensegrityType::SnelsonX => self.size * 1.414,
            TensegrityType::Tower => self.size / 4.0 * 1.5,
        }
    }
    
    /// Average cable length (m)
    pub fn cable_length(&self) -> f64 {
        match self.tensegrity_type {
            TensegrityType::Simplex => self.size * 0.8,
            TensegrityType::Icosahedron => self.size * 0.6,
            TensegrityType::Octahedron => self.size * 0.7,
            TensegrityType::TruncatedTetrahedron => self.size * 0.65,
            TensegrityType::SnelsonX => self.size * 0.5,
            TensegrityType::Tower => self.size / 4.0 * 0.7,
        }
    }
    
    /// Strut compression force (kN)
    pub fn strut_compression(&self) -> f64 {
        // Based on prestress equilibrium
        self.prestress * 2.5
    }
    
    /// Cable tension (kN)
    pub fn cable_tension(&self) -> f64 {
        self.prestress
    }
    
    /// Strut area required (mm²)
    pub fn strut_area_required(&self, fy: f64, safety_factor: f64) -> f64 {
        let p = self.strut_compression() * 1000.0; // N
        let allowable = fy / safety_factor;
        
        p / allowable
    }
    
    /// Cable area required (mm²)
    pub fn cable_area_required(&self, fu: f64, safety_factor: f64) -> f64 {
        let t = self.cable_tension() * 1000.0; // N
        let allowable = fu / safety_factor;
        
        t / allowable
    }
    
    /// Total strut weight (kg)
    pub fn strut_weight(&self) -> f64 {
        let area = PI * self.strut_diameter.powi(2) / 4.0; // mm²
        let length = self.strut_length() * 1000.0; // mm
        let volume = area * length / 1e9; // m³
        
        self.num_struts() as f64 * volume * 7850.0
    }
    
    /// Total cable weight (kg)
    pub fn cable_weight(&self) -> f64 {
        let area = PI * self.cable_diameter.powi(2) / 4.0;
        let length = self.cable_length() * 1000.0;
        let volume = area * length / 1e9;
        
        self.num_cables() as f64 * volume * 7850.0
    }
    
    /// Stiffness ratio (higher = stiffer)
    pub fn stiffness_ratio(&self) -> f64 {
        self.prestress / self.size
    }
}

// ============================================================================
// DEPLOYABLE STRUCTURES
// ============================================================================

/// Deployable mechanism types
#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
pub enum DeployableMechanism {
    /// Scissor mechanism (pantograph)
    Scissor,
    /// Foldable plates
    FoldablePlates,
    /// Cable-strut
    CableStrut,
    /// Inflatable
    Inflatable,
    /// Shape memory
    ShapeMemory,
    /// Telescopic
    Telescopic,
}

/// Scissor unit parameters
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ScissorUnit {
    /// Bar length (m)
    pub bar_length: f64,
    /// Pivot position ratio (0-1)
    pub pivot_ratio: f64,
    /// Current deployment angle (degrees)
    pub deployment_angle: f64,
    /// Bar cross-section area (mm²)
    pub bar_area: f64,
    /// Joint friction coefficient
    pub friction: f64,
}

impl ScissorUnit {
    pub fn symmetric(bar_length: f64) -> Self {
        Self {
            bar_length,
            pivot_ratio: 0.5,
            deployment_angle: 30.0,
            bar_area: 500.0,
            friction: 0.1,
        }
    }
    
    pub fn asymmetric(bar_length: f64, pivot_ratio: f64) -> Self {
        Self {
            bar_length,
            pivot_ratio,
            deployment_angle: 30.0,
            bar_area: 500.0,
            friction: 0.1,
        }
    }
    
    /// Unit height at current deployment
    pub fn height(&self) -> f64 {
        let angle_rad = self.deployment_angle * PI / 180.0;
        self.bar_length * angle_rad.sin()
    }
    
    /// Unit span at current deployment
    pub fn span(&self) -> f64 {
        let angle_rad = self.deployment_angle * PI / 180.0;
        2.0 * self.bar_length * angle_rad.cos()
    }
    
    /// Deployment ratio
    pub fn deployment_ratio(&self) -> f64 {
        self.deployment_angle / 90.0
    }
    
    /// Folded length (stowed)
    pub fn folded_length(&self) -> f64 {
        self.bar_length * 2.0
    }
    
    /// Geometric advantage (force amplification)
    pub fn geometric_advantage(&self) -> f64 {
        let angle_rad = self.deployment_angle * PI / 180.0;
        1.0 / angle_rad.tan()
    }
    
    /// Deployment force for given load (kN)
    pub fn deployment_force(&self, vertical_load: f64) -> f64 {
        vertical_load / self.geometric_advantage() * (1.0 + self.friction)
    }
}

/// Deployable arch structure
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DeployableArch {
    /// Span when deployed (m)
    pub deployed_span: f64,
    /// Rise when deployed (m)
    pub deployed_rise: f64,
    /// Number of scissor units
    pub n_units: usize,
    /// Scissor unit properties
    pub unit: ScissorUnit,
    /// Covering material
    pub covering: String,
}

impl DeployableArch {
    pub fn new(span: f64, rise: f64, n_units: usize) -> Self {
        // Calculate bar length from geometry
        let arc_length = 2.0 * rise.atan2(span / 2.0) * (span.powi(2) / 4.0 + rise.powi(2)).sqrt();
        let bar_length = arc_length / (2.0 * n_units as f64);
        
        Self {
            deployed_span: span,
            deployed_rise: rise,
            n_units,
            unit: ScissorUnit::symmetric(bar_length),
            covering: "fabric".to_string(),
        }
    }
    
    /// Stowed dimensions (m)
    pub fn stowed_dimensions(&self) -> (f64, f64, f64) {
        let length = self.unit.folded_length() * 1.1; // Some overlap
        let width = 0.5; // Bundle width estimate
        let height = 0.3; // Bundle height estimate
        
        (length, width, height)
    }
    
    /// Deployment ratio (current/full span)
    pub fn deployment_ratio(&self) -> f64 {
        self.unit.deployment_ratio()
    }
    
    /// Total number of bars
    pub fn total_bars(&self) -> usize {
        self.n_units * 4 // 4 bars per unit (2 scissors)
    }
    
    /// Total bar length (m)
    pub fn total_bar_length(&self) -> f64 {
        self.total_bars() as f64 * self.unit.bar_length
    }
    
    /// Estimated weight (kg)
    pub fn estimated_weight(&self) -> f64 {
        let bar_volume = self.total_bar_length() * self.unit.bar_area / 1e6; // m³
        bar_volume * 7850.0 * 1.3 // Include joints
    }
    
    /// Deployment time estimate (seconds)
    pub fn deployment_time(&self, deployment_speed: f64) -> f64 {
        // Speed in degrees per second
        (90.0 - self.unit.deployment_angle) / deployment_speed
    }
    
    /// Covered area (m²)
    pub fn covered_area(&self) -> f64 {
        // Approximate as parabolic arch
        2.0 / 3.0 * self.deployed_span * self.deployed_rise * PI / 2.0
    }
}

// ============================================================================
// RECIPROCAL FRAME
// ============================================================================

/// Reciprocal frame structure (nexorade)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ReciprocalFrame {
    /// Number of members per fan
    pub n_members: usize,
    /// Member length (m)
    pub member_length: f64,
    /// Engagement length (overlap) (m)
    pub engagement_length: f64,
    /// Member section depth (mm)
    pub section_depth: f64,
    /// Number of fans
    pub n_fans: usize,
}

impl ReciprocalFrame {
    pub fn new(n_members: usize, member_length: f64, engagement_ratio: f64) -> Self {
        Self {
            n_members,
            member_length,
            engagement_length: member_length * engagement_ratio,
            section_depth: member_length * 50.0, // Typical L/D ratio
            n_fans: 1,
        }
    }
    
    /// Single fan radius (m)
    pub fn fan_radius(&self) -> f64 {
        let n = self.n_members as f64;
        let angle = 2.0 * PI / n;
        
        self.engagement_length / (2.0 * (angle / 2.0).sin())
    }
    
    /// Fan rise (m)
    pub fn fan_rise(&self) -> f64 {
        let r = self.fan_radius();
        (self.member_length.powi(2) - r.powi(2)).sqrt() * 0.3
    }
    
    /// Span of single fan (m)
    pub fn fan_span(&self) -> f64 {
        2.0 * self.fan_radius()
    }
    
    /// Eccentricity at joint (m)
    pub fn joint_eccentricity(&self) -> f64 {
        self.section_depth / 1000.0 / 2.0
    }
    
    /// Member end reaction angle (degrees)
    pub fn reaction_angle(&self) -> f64 {
        let n = self.n_members as f64;
        90.0 - 180.0 / n
    }
    
    /// Required engagement ratio for stability
    pub fn required_engagement_ratio(&self) -> f64 {
        let n = self.n_members as f64;
        0.3 + 0.1 * (n - 3.0)
    }
    
    /// Is configuration stable?
    pub fn is_stable(&self) -> bool {
        let actual_ratio = self.engagement_length / self.member_length;
        actual_ratio >= self.required_engagement_ratio()
    }
    
    /// Bending moment at joint (kN·m) for unit load
    pub fn joint_moment(&self, unit_load: f64) -> f64 {
        let e = self.joint_eccentricity();
        let reaction = unit_load / self.n_members as f64;
        
        reaction * e * 1000.0 // N·m to kN·mm to kN·m
    }
}

// ============================================================================
// GRID SHELL
// ============================================================================

/// Grid shell configuration
#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
pub enum GridShellType {
    /// Single layer
    SingleLayer,
    /// Double layer
    DoubleLayer,
    /// Triangular grid
    Triangular,
    /// Quadrilateral grid
    Quadrilateral,
    /// Diagrid
    Diagrid,
}

/// Grid shell structure
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GridShell {
    /// Shell type
    pub shell_type: GridShellType,
    /// Span (m)
    pub span: f64,
    /// Rise (m)
    pub rise: f64,
    /// Grid spacing (m)
    pub grid_spacing: f64,
    /// Member section (mm)
    pub section_size: f64,
    /// Node type
    pub node_type: String,
}

impl GridShell {
    pub fn new(shell_type: GridShellType, span: f64, rise: f64, grid_spacing: f64) -> Self {
        Self {
            shell_type,
            span,
            rise,
            grid_spacing,
            section_size: 100.0,
            node_type: "bolted".to_string(),
        }
    }
    
    /// Approximate surface area (m²)
    pub fn surface_area(&self) -> f64 {
        // Spherical cap approximation
        2.0 * PI * self.radius_of_curvature() * self.rise
    }
    
    /// Radius of curvature (m)
    pub fn radius_of_curvature(&self) -> f64 {
        (self.span.powi(2) / 4.0 + self.rise.powi(2)) / (2.0 * self.rise)
    }
    
    /// Rise to span ratio
    pub fn rise_span_ratio(&self) -> f64 {
        self.rise / self.span
    }
    
    /// Number of grid divisions
    pub fn grid_divisions(&self) -> usize {
        (self.span / self.grid_spacing).ceil() as usize
    }
    
    /// Approximate number of members
    pub fn num_members(&self) -> usize {
        let n = self.grid_divisions();
        let multiplier = match self.shell_type {
            GridShellType::SingleLayer | GridShellType::Quadrilateral => 2,
            GridShellType::Triangular | GridShellType::Diagrid => 3,
            GridShellType::DoubleLayer => 4,
        };
        
        n * n * multiplier
    }
    
    /// Approximate number of nodes
    pub fn num_nodes(&self) -> usize {
        let n = self.grid_divisions();
        (n + 1) * (n + 1)
    }
    
    /// Buckling critical load factor (simplified)
    pub fn buckling_factor(&self) -> f64 {
        // Higher is better
        let r = self.radius_of_curvature();
        let l = self.grid_spacing;
        
        (r / l).powi(2) * 0.1
    }
    
    /// Membrane vs bending behavior
    pub fn is_membrane_dominant(&self) -> bool {
        self.rise_span_ratio() > 0.15
    }
    
    /// Estimated steel tonnage
    pub fn estimated_tonnage(&self) -> f64 {
        let member_length = self.grid_spacing;
        let area = PI * self.section_size.powi(2) / 4.0; // Circular section
        let volume = area * member_length * 1000.0 * self.num_members() as f64 / 1e9;
        
        volume * 7850.0 / 1000.0 // tonnes
    }
}

// ============================================================================
// TESTS
// ============================================================================

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_geodesic_frequency() {
        let v3 = GeodesicFrequency::V3;
        
        assert_eq!(v3.num_faces(), 180);
        assert_eq!(v3.num_edges(), 270);
    }

    #[test]
    fn test_geodesic_dome() {
        let dome = GeodesicDome::new(20.0, GeodesicFrequency::V4);
        
        let area = dome.surface_area();
        assert!(area > 1000.0);
        
        let volume = dome.volume();
        assert!(volume > 10000.0);
    }

    #[test]
    fn test_dome_struts() {
        let dome = GeodesicDome::new(15.0, GeodesicFrequency::V3);
        
        let n_struts = dome.num_struts();
        assert!(n_struts > 100);
        
        let avg_len = dome.avg_strut_length();
        assert!(avg_len > 0.0 && avg_len < dome.radius); // Avg strut should be less than radius
    }

    #[test]
    fn test_tensegrity() {
        let tens = Tensegrity::new(TensegrityType::Icosahedron, 5.0);
        
        assert_eq!(tens.num_struts(), 6);
        assert_eq!(tens.num_cables(), 24);
    }

    #[test]
    fn test_tensegrity_forces() {
        let mut tens = Tensegrity::new(TensegrityType::Simplex, 3.0);
        tens.prestress = 20.0;
        
        let compression = tens.strut_compression();
        let tension = tens.cable_tension();
        
        assert!(compression > tension);
    }

    #[test]
    fn test_scissor_unit() {
        let unit = ScissorUnit::symmetric(2.0);
        
        let height = unit.height();
        let span = unit.span();
        
        assert!(height > 0.0);
        assert!(span > 0.0);
    }

    #[test]
    fn test_deployable_arch() {
        let arch = DeployableArch::new(20.0, 5.0, 10);
        
        let (l, w, h) = arch.stowed_dimensions();
        assert!(l < arch.deployed_span);
        
        let area = arch.covered_area();
        assert!(area > 50.0);
    }

    #[test]
    fn test_reciprocal_frame() {
        let rf = ReciprocalFrame::new(6, 3.0, 0.7); // Use ratio 0.7 >= 0.6 required
        
        let radius = rf.fan_radius();
        assert!(radius > 0.0);
        
        assert!(rf.is_stable());
    }

    #[test]
    fn test_reciprocal_stability() {
        let stable = ReciprocalFrame::new(4, 2.0, 0.4);
        let unstable = ReciprocalFrame::new(4, 2.0, 0.1);
        
        assert!(stable.is_stable());
        assert!(!unstable.is_stable());
    }

    #[test]
    fn test_grid_shell() {
        let shell = GridShell::new(
            GridShellType::Triangular,
            40.0, 8.0, 2.0,
        );
        
        let area = shell.surface_area();
        assert!(area > 1000.0);
        
        let n_members = shell.num_members();
        assert!(n_members > 500);
    }

    #[test]
    fn test_grid_shell_behavior() {
        let shallow = GridShell::new(GridShellType::SingleLayer, 50.0, 3.0, 2.0);
        let deep = GridShell::new(GridShellType::SingleLayer, 50.0, 12.0, 2.0);
        
        assert!(!shallow.is_membrane_dominant());
        assert!(deep.is_membrane_dominant());
    }

    #[test]
    fn test_deployment_force() {
        let unit = ScissorUnit::symmetric(2.0);
        
        let force = unit.deployment_force(10.0);
        assert!(force > 0.0);
    }
}
