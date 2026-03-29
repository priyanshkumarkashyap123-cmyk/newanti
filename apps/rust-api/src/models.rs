//! Shared data models for the Rust API

use serde::{Deserialize, Serialize};

/// 3D Node representation
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Node {
    pub id: usize,
    pub x: f64,
    pub y: f64,
    pub z: f64,
}

/// Member/Element connecting two nodes
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Member {
    pub id: usize,
    pub start_node: usize,
    pub end_node: usize,

    // Section properties
    #[serde(default = "default_e")]
    pub e: f64, // Elastic modulus (N/mm² or MPa)
    #[serde(default = "default_g")]
    pub g: f64, // Shear modulus
    #[serde(default = "default_a")]
    pub a: f64, // Cross-sectional area (mm²)
    #[serde(default = "default_ix")]
    pub ix: f64, // Moment of inertia X (mm⁴)
    #[serde(default = "default_iy")]
    pub iy: f64, // Moment of inertia Y (mm⁴)
    #[serde(default = "default_j")]
    pub j: f64, // Torsional constant (mm⁴)

    // Optional releases
    #[serde(default)]
    pub start_release: EndRelease,
    #[serde(default)]
    pub end_release: EndRelease,
}

fn default_e() -> f64 {
    210000.0
} // Steel default
fn default_g() -> f64 {
    80769.0
} // Steel default
fn default_a() -> f64 {
    1000.0
} // 1000 mm²
fn default_ix() -> f64 {
    1e6
} // 1e6 mm⁴
fn default_iy() -> f64 {
    1e6
}
fn default_j() -> f64 {
    1e5
}

/// End release flags (hinges)
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct EndRelease {
    #[serde(default)]
    pub fx: bool, // Axial
    #[serde(default)]
    pub fy: bool, // Shear Y
    #[serde(default)]
    pub fz: bool, // Shear Z
    #[serde(default)]
    pub mx: bool, // Torsion
    #[serde(default)]
    pub my: bool, // Moment Y (hinge about Y)
    #[serde(default)]
    pub mz: bool, // Moment Z (hinge about Z)
}

/// Support/boundary condition
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Support {
    pub node: usize,

    #[serde(default = "default_true")]
    pub dx: bool, // Restrained in X
    #[serde(default = "default_true")]
    pub dy: bool, // Restrained in Y
    #[serde(default = "default_true")]
    pub dz: bool, // Restrained in Z
    #[serde(default = "default_true")]
    pub rx: bool, // Rotation X restrained
    #[serde(default = "default_true")]
    pub ry: bool, // Rotation Y restrained
    #[serde(default = "default_true")]
    pub rz: bool, // Rotation Z restrained

    // Spring supports (optional)
    #[serde(default)]
    pub kx: Option<f64>, // Spring stiffness X
    #[serde(default)]
    pub ky: Option<f64>,
    #[serde(default)]
    pub kz: Option<f64>,
    #[serde(default)]
    pub krx: Option<f64>,
    #[serde(default)]
    pub kry: Option<f64>,
    #[serde(default)]
    pub krz: Option<f64>,
}

fn default_true() -> bool {
    true
}

/// Load types
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type")]
pub enum Load {
    /// Nodal load
    #[serde(rename = "nodal")]
    Nodal {
        node: usize,
        #[serde(default)]
        fx: f64,
        #[serde(default)]
        fy: f64,
        #[serde(default)]
        fz: f64,
        #[serde(default)]
        mx: f64,
        #[serde(default)]
        my: f64,
        #[serde(default)]
        mz: f64,
    },

    /// Uniformly distributed load on member
    #[serde(rename = "distributed")]
    Distributed {
        member: usize,
        #[serde(default)]
        wx: f64, // Load intensity X (N/mm)
        #[serde(default)]
        wy: f64, // Load intensity Y
        #[serde(default)]
        wz: f64, // Load intensity Z
    },

    /// Point load on member
    #[serde(rename = "point")]
    Point {
        member: usize,
        position: f64, // 0 to 1 along member
        #[serde(default)]
        fx: f64,
        #[serde(default)]
        fy: f64,
        #[serde(default)]
        fz: f64,
    },

    /// Self-weight
    #[serde(rename = "self_weight")]
    SelfWeight {
        factor: f64, // Multiplier (typically 1.0)
        #[serde(default)]
        density: f64, // Material density (kg/m³)
    },

    /// Temperature load
    #[serde(rename = "temperature")]
    Temperature {
        member: usize,
        delta_t: f64, // Temperature change (°C)
        #[serde(default)]
        gradient: f64, // Temperature gradient across section
    },
}

/// Load combination
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LoadCombination {
    pub name: String,
    pub factors: Vec<LoadFactor>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LoadFactor {
    pub load_case: String,
    pub factor: f64,
}

/// Analysis result for a node
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NodeResult {
    pub id: usize,
    pub dx: f64, // Displacement X (mm)
    pub dy: f64, // Displacement Y
    pub dz: f64, // Displacement Z
    pub rx: f64, // Rotation X (rad)
    pub ry: f64, // Rotation Y
    pub rz: f64, // Rotation Z
}

/// Analysis result for a member
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MemberResult {
    pub id: usize,

    // Forces at start
    pub fx_start: f64, // Axial force (N)
    pub fy_start: f64, // Shear Y
    pub fz_start: f64, // Shear Z
    pub mx_start: f64, // Torsion
    pub my_start: f64, // Moment Y
    pub mz_start: f64, // Moment Z

    // Forces at end
    pub fx_end: f64,
    pub fy_end: f64,
    pub fz_end: f64,
    pub mx_end: f64,
    pub my_end: f64,
    pub mz_end: f64,

    // Stresses (optional)
    pub max_stress: Option<f64>,
    pub min_stress: Option<f64>,
    pub utilization: Option<f64>,
}

/// Reaction at support
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ReactionResult {
    pub node: usize,
    pub fx: f64,
    pub fy: f64,
    pub fz: f64,
    pub mx: f64,
    pub my: f64,
    pub mz: f64,
}

/// Modal analysis result
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ModeResult {
    pub mode_number: usize,
    pub frequency: f64, // Hz
    pub period: f64,    // seconds
    pub mass_participation_x: f64,
    pub mass_participation_y: f64,
    pub mass_participation_z: f64,
    pub mode_shape: Vec<NodeResult>,
}

/// Buckling analysis result
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BucklingResult {
    pub mode_number: usize,
    pub load_factor: f64,
    pub critical_load: f64,
    pub buckling_shape: Vec<NodeResult>,
}

/// Material definition
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Material {
    pub id: String,
    pub name: String,
    pub material_type: MaterialType,
    pub e: f64,          // Elastic modulus (N/mm²)
    pub g: f64,          // Shear modulus
    pub nu: f64,         // Poisson's ratio
    pub density: f64,    // kg/m³
    pub fy: Option<f64>, // Yield strength
    pub fu: Option<f64>, // Ultimate strength
    pub alpha: f64,      // Thermal expansion coefficient
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum MaterialType {
    Steel,
    Concrete,
    Aluminum,
    Timber,
    Custom,
}

/// Section definition
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Section {
    pub id: String,
    pub name: String,
    pub section_type: SectionType,
    pub a: f64,  // Area (mm²)
    pub ix: f64, // Moment of inertia X (mm⁴)
    pub iy: f64, // Moment of inertia Y (mm⁴)
    pub j: f64,  // Torsional constant (mm⁴)
    pub sx: f64, // Section modulus X (mm³)
    pub sy: f64, // Section modulus Y (mm³)
    pub zx: f64, // Plastic modulus X (mm³)
    pub zy: f64, // Plastic modulus Y (mm³)
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum SectionType {
    IBeam,
    Channel,
    Angle,
    Tube,
    Pipe,
    Rectangular,
    Circular,
    Custom,
}

/// Project/Structure metadata
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProjectMetadata {
    pub id: String,
    pub name: String,
    pub description: Option<String>,
    pub created_at: String,
    pub updated_at: String,
    pub user_id: String,

    // Analysis settings
    pub units: Units,
    pub code: DesignCode,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Units {
    pub length: String, // "mm", "m", "in", "ft"
    pub force: String,  // "N", "kN", "lb", "kip"
    pub moment: String, // "N-mm", "kN-m", "lb-ft", "kip-ft"
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum DesignCode {
    #[serde(rename = "IS456")]
    IS456,
    #[serde(rename = "IS800")]
    IS800,
    #[serde(rename = "AISC360")]
    AISC360,
    #[serde(rename = "Eurocode")]
    Eurocode,
    #[serde(rename = "None")]
    None,
}
