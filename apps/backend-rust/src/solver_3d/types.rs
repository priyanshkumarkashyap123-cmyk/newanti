use nalgebra::{DMatrix, DVector};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use crate::plate_element::PlateElement;

/// 3D Node with 6 degrees of freedom
/// Supports both Rust (restraints) and JavaScript (fixed) naming
#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct Node3D {
	#[serde(deserialize_with = "deserialize_string_or_number")]
	pub id: String,
	pub x: f64,
	pub y: f64,
	#[serde(default)]
	pub z: f64,
	/// Restraints: [Fx, Fy, Fz, Mx, My, Mz] - true if fixed
	/// Accepts 'restraints' (6-element) or 'fixed' (3-element from JS)
	#[serde(default, deserialize_with = "deserialize_restraints")]
	pub restraints: [bool; 6],
	/// Nodal mass for dynamic analysis [kg]
	#[serde(default)]
	pub mass: Option<f64>,
	/// Spring stiffness at this node [kx, ky, kz, krx, kry, krz] (N/m or N·m/rad)
	/// When specified, the node is elastically restrained (not fully fixed or free).
	/// The spring stiffness is added to the diagonal of the global stiffness matrix.
	#[serde(default)]
	pub spring_stiffness: Option<Vec<f64>>,
}

/// 3D Frame Element with full properties
/// Supports both Rust and JavaScript naming conventions
#[derive(Serialize, Deserialize, Debug, Clone)]
#[allow(non_snake_case)]
pub struct Element3D {
	#[serde(deserialize_with = "deserialize_string_or_number")]
	pub id: String,
    
	/// Start node ID - accepts node_i (Rust) or node_start (JS)
	#[serde(alias = "node_start", deserialize_with = "deserialize_string_or_number")]
	pub node_i: String,
    
	/// End node ID - accepts node_j (Rust) or node_end (JS)
	#[serde(alias = "node_end", deserialize_with = "deserialize_string_or_number")]
	pub node_j: String,
    
	// Material properties - accepts lowercase (JS) or uppercase (Rust)
	#[serde(alias = "e", alias = "E")]
	pub E: f64,           // Young's modulus [Pa]
    
	#[serde(default)]
	pub nu: Option<f64>,  // Poisson's ratio (for plates)
    
	#[serde(default = "default_shear_modulus")]
	pub G: f64,           // Shear modulus [Pa]
    
	#[serde(default = "default_density")]
	pub density: f64,     // Density [kg/m³]
    
	// Section properties
	#[serde(alias = "a", alias = "A")]
	pub A: f64,           // Cross-sectional area [m²]
    
	#[serde(alias = "i", alias = "I", alias = "Iy", default)]
	pub Iy: f64,          // Moment of inertia about y-axis [m⁴]
    
	/// Moment of inertia about z-axis. If not specified, defaults to Iy (symmetric section).
	/// This ensures old clients sending only `I` get correct bending in both planes.
	#[serde(alias = "Iz", default)]
	pub Iz: f64,          // Moment of inertia about z-axis [m⁴]
    
	#[serde(default)]
	pub J: f64,           // Torsional constant [m⁴]
    
	#[serde(default)]
	pub Asy: f64,         // Shear area Y (for Timoshenko beam)
    
	#[serde(default)]
	pub Asz: f64,         // Shear area Z
    
	// Member orientation
	#[serde(default)]
	pub beta: f64,        // Member rotation angle [radians]
    
	// End releases
	#[serde(default)]
	pub releases_i: [bool; 6], // Releases at node i
    
	#[serde(default)]
	pub releases_j: [bool; 6], // Releases at node j

	// Plate specific
	#[serde(default)]
	pub thickness: Option<f64>,
    
	#[serde(default)]
	pub node_k: Option<String>,
    
	#[serde(default)]
	pub node_l: Option<String>,
    
	// Element type
	#[serde(default)]
	pub element_type: ElementType,
}

/// Nodal Load - accepts node_id as string or number
#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct NodalLoad {
	#[serde(deserialize_with = "deserialize_string_or_number")]
	pub node_id: String,
	#[serde(default)]
	pub fx: f64,
	#[serde(default)]
	pub fy: f64,
	#[serde(default)]
	pub fz: f64,
	#[serde(default)]
	pub mx: f64,
	#[serde(default)]
	pub my: f64,
	#[serde(default)]
	pub mz: f64,
}

/// Distributed Load on Member - accepts both Rust and JavaScript naming conventions
#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct DistributedLoad {
	/// Element ID - accepts both string and number (via serde deserialize_with helper)
	#[serde(deserialize_with = "deserialize_string_or_number")]
	pub element_id: String,
    
	/// Load intensity at start [N/m] - accepts w_start or w1
	#[serde(alias = "w1")]
	pub w_start: f64,
    
	/// Load intensity at end [N/m] - accepts w_end or w2
	#[serde(alias = "w2")]
	pub w_end: f64,
    
	/// Load direction
	#[serde(deserialize_with = "deserialize_load_direction")]
	pub direction: LoadDirection,
    
	/// Whether load is projected (for wind/snow)
	#[serde(default)]
	pub is_projected: bool,
    
	/// Start position along member as ratio (0.0 = start, 1.0 = end). Default 0.
	#[serde(default)]
	pub start_pos: f64,
    
	/// End position along member as ratio (0.0 = start, 1.0 = end). Default 1 via fn.
	#[serde(default = "default_end_pos")]
	pub end_pos: f64,
}

/// Temperature Load
#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct TemperatureLoad {
	pub element_id: String,
	pub delta_t: f64,
	pub gradient_y: f64,
	pub gradient_z: f64,
	pub alpha: f64,
}

/// Point Load on a member (concentrated load at a specific position)
/// FEF computed natively in Rust using Hermite shape functions
#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct PointLoadOnMember {
	#[serde(deserialize_with = "deserialize_string_or_number")]
	pub element_id: String,
	/// Load magnitude [N for force, N·m for moment]
	pub magnitude: f64,
	/// Position along member as ratio (0.0 = start, 1.0 = end)
	pub position: f64,
	/// Load direction
	#[serde(deserialize_with = "deserialize_load_direction")]
	pub direction: LoadDirection,
	/// Whether this is a moment load (true) or force load (false, default)
	#[serde(default)]
	pub is_moment: bool,
}

/// Analysis configuration options
#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct AnalysisConfig {
	/// Whether to include self-weight of elements (density × A × g)
	#[serde(default)]
	pub include_self_weight: bool,
	/// Gravitational acceleration [m/s²] (default: 9.80665)
	#[serde(default = "default_gravity")]
	pub gravity: f64,
	/// Gravity direction: -1.0 for downward in global Y (default), +1.0 for upward
	#[serde(default = "default_gravity_direction")]
	pub gravity_direction: f64,
}

/// Load combination for code-compliant analysis
/// Supports IS 800, Eurocode, AISC LRFD/ASD combinations
#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct LoadCombination {
	pub name: String,
	/// Factors for each load case: [(case_name, factor)]
	pub factors: Vec<(String, f64)>,
}

/// Combined load case results: envelope of max/min across all combinations
#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct EnvelopeResult {
	/// Per-node max and min displacements across all combinations
	pub max_displacements: HashMap<String, Vec<f64>>,
	pub min_displacements: HashMap<String, Vec<f64>>,
	/// Per-node max and min reactions
	pub max_reactions: HashMap<String, Vec<f64>>,
	pub min_reactions: HashMap<String, Vec<f64>>,
	/// Per-member max forces
	pub max_member_forces: HashMap<String, MemberForces>,
	/// Governing combination name for each member (based on max axial or moment)
	pub governing_combo: HashMap<String, String>,
	/// All individual combination results
	pub combination_results: Vec<(String, AnalysisResult3D)>,
}

/// Plate/slab stress results at element center
#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct PlateStressResult {
	pub stress_xx: f64,
	pub stress_yy: f64,
	pub stress_xy: f64,
	pub moment_xx: f64,
	pub moment_yy: f64,
	pub moment_xy: f64,
	pub displacement: f64,
	pub von_mises: f64,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct AnalysisResult3D {
	pub success: bool,
	pub error: Option<String>,
	pub displacements: HashMap<String, Vec<f64>>,
	pub reactions: HashMap<String, Vec<f64>>,
	pub member_forces: HashMap<String, MemberForces>,
	#[serde(default)]
	pub plate_results: HashMap<String, PlateStressResult>,
	#[serde(skip_deserializing)]
	pub equilibrium_check: Option<EquilibriumCheck>,
	#[serde(skip_deserializing)]
	pub condition_number: Option<f64>,
}

/// Equilibrium verification: ΣReactions must equal ΣApplied loads
/// Per IS 800, EN 1993, AISC 360 — mandatory for structural analysis reports
#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct EquilibriumCheck {
	/// Sum of applied forces [Fx, Fy, Fz, Mx, My, Mz] (includes nodal + FEF equivalent)
	pub applied_forces: Vec<f64>,
	/// Sum of reaction forces [Fx, Fy, Fz, Mx, My, Mz]
	pub reaction_forces: Vec<f64>,
	/// Residual = applied - reactions (should be ~0)
	pub residual: Vec<f64>,
	/// Max relative error as percentage
	pub error_percent: f64,
	/// Pass/fail: error < 0.1% is industry-standard acceptable
	pub pass: bool,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct MemberForces {
	/// Forces at node i: [Fx, Fy, Fz, Mx, My, Mz]
	pub forces_i: Vec<f64>,
	/// Forces at node j: [Fx, Fy, Fz, Mx, My, Mz]
	pub forces_j: Vec<f64>,
	/// Maximum values along member
	pub max_shear_y: f64,
	pub max_shear_z: f64,
	pub max_moment_y: f64,
	pub max_moment_z: f64,
	pub max_axial: f64,
	pub max_torsion: f64,
}

#[derive(Serialize, Deserialize, Debug, Clone, PartialEq)]
pub enum ElementType {
	Frame,
	Truss,
	Cable,
	Plate,
}

#[derive(Serialize, Deserialize, Debug, Clone, PartialEq)]
pub enum LoadDirection {
	GlobalX,
	GlobalY,
	GlobalZ,
	LocalX,
	LocalY,
	LocalZ,
}

impl Default for ElementType {
	fn default() -> Self {
		ElementType::Frame
	}
}

impl Default for AnalysisConfig {
	fn default() -> Self {
		AnalysisConfig {
			include_self_weight: false,
			gravity: 9.80665,
			gravity_direction: -1.0,
		}
	}
}

fn default_shear_modulus() -> f64 { 80e9 }
fn default_density() -> f64 { 7850.0 }
fn default_end_pos() -> f64 { 1.0 }
fn default_gravity() -> f64 { 9.80665 }
fn default_gravity_direction() -> f64 { -1.0 }

/// Helper to deserialize restraints from various formats
fn deserialize_restraints<'de, D>(deserializer: D) -> Result<[bool; 6], D::Error>
where
	D: serde::Deserializer<'de>,
{
	use serde::de::{Visitor, SeqAccess, MapAccess};
    
	struct RestraintsVisitor;
    
	impl<'de> Visitor<'de> for RestraintsVisitor {
		type Value = [bool; 6];
        
		fn expecting(&self, formatter: &mut std::fmt::Formatter) -> std::fmt::Result {
			formatter.write_str("an array of 3 or 6 booleans, or an object with restraint keys")
		}
        
		fn visit_seq<A>(self, mut seq: A) -> Result<[bool; 6], A::Error>
		where
			A: SeqAccess<'de>,
		{
			let mut result = [false; 6];
			let mut count = 0;
            
			while let Some(val) = seq.next_element::<bool>()? {
				if count < 6 {
					result[count] = val;
				}
				count += 1;
			}
            
			Ok(result)
		}
        
		fn visit_map<M>(self, mut map: M) -> Result<[bool; 6], M::Error>
		where
			M: MapAccess<'de>,
		{
			let mut result = [false; 6];
            
			while let Some(key) = map.next_key::<String>()? {
				let val: bool = map.next_value()?;
				match key.to_lowercase().as_str() {
					"fx" | "x" | "0" => result[0] = val,
					"fy" | "y" | "1" => result[1] = val,
					"fz" | "z" | "2" => result[2] = val,
					"mx" | "rx" | "3" => result[3] = val,
					"my" | "ry" | "4" => result[4] = val,
					"mz" | "rz" | "5" => result[5] = val,
					_ => {}
				}
			}
            
			Ok(result)
		}
	}
    
	deserializer.deserialize_any(RestraintsVisitor)
}

/// Helper to deserialize string or number as String
fn deserialize_string_or_number<'de, D>(deserializer: D) -> Result<String, D::Error>
where
	D: serde::Deserializer<'de>,
{
	use serde::de::{self, Visitor};
    
	struct StringOrNumberVisitor;
    
	impl<'de> Visitor<'de> for StringOrNumberVisitor {
		type Value = String;
        
		fn expecting(&self, formatter: &mut std::fmt::Formatter) -> std::fmt::Result {
			formatter.write_str("a string or a number")
		}
        
		fn visit_str<E>(self, value: &str) -> Result<String, E>
		where
			E: de::Error,
		{
			Ok(value.to_string())
		}
        
		fn visit_string<E>(self, value: String) -> Result<String, E>
		where
			E: de::Error,
		{
			Ok(value)
		}
        
		fn visit_i64<E>(self, value: i64) -> Result<String, E>
		where
			E: de::Error,
		{
			Ok(value.to_string())
		}
        
		fn visit_u64<E>(self, value: u64) -> Result<String, E>
		where
			E: de::Error,
		{
			Ok(value.to_string())
		}
        
		fn visit_f64<E>(self, value: f64) -> Result<String, E>
		where
			E: de::Error,
		{
			Ok(value.to_string())
		}
	}
    
	deserializer.deserialize_any(StringOrNumberVisitor)
}

/// Helper to deserialize LoadDirection from string
fn deserialize_load_direction<'de, D>(deserializer: D) -> Result<LoadDirection, D::Error>
where
	D: serde::Deserializer<'de>,
{
	use serde::de::{self, Visitor};
    
	struct LoadDirectionVisitor;
    
	impl<'de> Visitor<'de> for LoadDirectionVisitor {
		type Value = LoadDirection;
        
		fn expecting(&self, formatter: &mut std::fmt::Formatter) -> std::fmt::Result {
			formatter.write_str("a load direction string like 'global_y', 'local_x', etc.")
		}
        
		fn visit_str<E>(self, value: &str) -> Result<LoadDirection, E>
		where
			E: de::Error,
		{
			let lower = value.to_lowercase();
			let is_local = lower.contains("local");
			let direction = if lower.contains("x") {
				if is_local { LoadDirection::LocalX } else { LoadDirection::GlobalX }
			} else if lower.contains("z") {
				if is_local { LoadDirection::LocalZ } else { LoadDirection::GlobalZ }
			} else {
				if is_local { LoadDirection::LocalY } else { LoadDirection::GlobalY }
			};
			Ok(direction)
		}
        
		fn visit_string<E>(self, value: String) -> Result<LoadDirection, E>
		where
			E: de::Error,
		{
			self.visit_str(&value)
		}
	}
    
	deserializer.deserialize_any(LoadDirectionVisitor)
}
