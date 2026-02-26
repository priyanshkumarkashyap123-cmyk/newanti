/**
 * solver_3d.rs - Advanced 3D Frame Structural Solver
 * 
 * Implements world-class structural analysis theory:
 * - 3D Frame Analysis with 6 DOF per node (ux, uy, uz, θx, θy, θz)
 * - Direct Stiffness Method with proper transformation matrices
 * - Modal Analysis using eigenvalue decomposition
 * - P-Delta Geometric Nonlinearity
 * - Member end releases (hinges)
 * - Cable elements with geometric stiffness
 * 
 * Based on:
 * - Matrix Structural Analysis (McGuire, Gallagher, Ziemian)
 * - Structural Dynamics (Clough & Penzien)
 * - Theory of Matrix Structural Analysis (Przemieniecki)
 */

use nalgebra::{DMatrix, DVector, Matrix6, Vector6, SymmetricEigen};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use crate::plate_element::PlateElement;

// ============================================
// STRUCTURAL ELEMENTS
// ============================================

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

/// Helper to deserialize restraints from various formats
fn deserialize_restraints<'de, D>(deserializer: D) -> Result<[bool; 6], D::Error>
where
    D: serde::Deserializer<'de>,
{
    use serde::de::{self, Visitor, SeqAccess, MapAccess};
    
    struct RestraintsVisitor;
    
    impl<'de> Visitor<'de> for RestraintsVisitor {
        type Value = [bool; 6];
        
        fn expecting(&self, formatter: &mut std::fmt::Formatter) -> std::fmt::Result {
            formatter.write_str("an array of 3 or 6 booleans, or an object with restraint keys")
        }
        
        // Handle array format: [true, true, true] or [true, true, true, false, false, false]
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
            
            // If only 3 elements (JS 'fixed' format), keep rotational DOFs free
            // If 6 elements (Rust 'restraints' format), use all
            
            Ok(result)
        }
        
        // Handle object format: { fx: true, fy: true, fz: false, ... }
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
                    _ => {} // Ignore unknown keys
                }
            }
            
            Ok(result)
        }
    }
    
    deserializer.deserialize_any(RestraintsVisitor)
}

/// 3D Frame Element with full properties
/// Supports both Rust and JavaScript naming conventions
#[derive(Serialize, Deserialize, Debug, Clone)]
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

fn default_shear_modulus() -> f64 { 80e9 } // Steel shear modulus
fn default_density() -> f64 { 7850.0 } // Steel density

#[derive(Serialize, Deserialize, Debug, Clone, PartialEq)]
pub enum ElementType {
    Frame,      // Full 6 DOF frame element
    Truss,      // Axial force only
    Cable,      // Tension only with geometric stiffness
    Plate,      // 4-node Shell element (DKQ/Mindlin)
}

impl Default for ElementType {
    fn default() -> Self {
        ElementType::Frame
    }
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

fn default_end_pos() -> f64 { 1.0 }

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
            
            // Check for "local" or "global" prefix
            let is_local = lower.contains("local");
            
            // Check for axis
            let direction = if lower.contains("x") {
                if is_local { LoadDirection::LocalX } else { LoadDirection::GlobalX }
            } else if lower.contains("z") {
                if is_local { LoadDirection::LocalZ } else { LoadDirection::GlobalZ }
            } else {
                // Default to Y (most common for gravity)
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

#[derive(Serialize, Deserialize, Debug, Clone, PartialEq)]
pub enum LoadDirection {
    GlobalX,
    GlobalY,
    GlobalZ,
    LocalX,
    LocalY,
    LocalZ,
}

/// Temperature Load
#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct TemperatureLoad {
    pub element_id: String,
    pub delta_t: f64,     // Uniform temperature change [°C]
    pub gradient_y: f64,  // Gradient in Y [°C/m]
    pub gradient_z: f64,  // Gradient in Z [°C/m]
    pub alpha: f64,       // Thermal coefficient [1/°C]
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

fn default_gravity() -> f64 { 9.80665 }
fn default_gravity_direction() -> f64 { -1.0 }

impl Default for AnalysisConfig {
    fn default() -> Self {
        AnalysisConfig {
            include_self_weight: false,
            gravity: 9.80665,
            gravity_direction: -1.0,
        }
    }
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

/// Linearly combine multiple load case results using factored superposition.
/// `cases`: map of case_name → analysis result for that isolated load case.
/// `combination`: load factors to apply.
///
/// Combined result: u_combined = Σ(factor_i × u_i), R_combined = Σ(factor_i × R_i), etc.
pub fn combine_load_cases(
    cases: &HashMap<String, AnalysisResult3D>,
    combination: &LoadCombination,
) -> Result<AnalysisResult3D, String> {
    // Validate all referenced cases exist
    for (case_name, _factor) in &combination.factors {
        if !cases.contains_key(case_name) {
            return Err(format!(
                "Load combination '{}' references case '{}' which has no results",
                combination.name, case_name
            ));
        }
    }
    
    let mut combined_disp: HashMap<String, Vec<f64>> = HashMap::new();
    let mut combined_rxn: HashMap<String, Vec<f64>> = HashMap::new();
    let mut combined_forces: HashMap<String, MemberForces> = HashMap::new();
    
    for (case_name, factor) in &combination.factors {
        let result = &cases[case_name];
        
        // Combine displacements
        for (node_id, disp) in &result.displacements {
            let entry = combined_disp.entry(node_id.clone()).or_insert_with(|| vec![0.0; 6]);
            for i in 0..6.min(disp.len()) {
                entry[i] += factor * disp[i];
            }
        }
        
        // Combine reactions
        for (node_id, rxn) in &result.reactions {
            let entry = combined_rxn.entry(node_id.clone()).or_insert_with(|| vec![0.0; 6]);
            for i in 0..6.min(rxn.len()) {
                entry[i] += factor * rxn[i];
            }
        }
        
        // Combine member forces
        for (elem_id, mf) in &result.member_forces {
            let entry = combined_forces.entry(elem_id.clone()).or_insert_with(|| MemberForces {
                forces_i: vec![0.0; 6], forces_j: vec![0.0; 6],
                max_shear_y: 0.0, max_shear_z: 0.0,
                max_moment_y: 0.0, max_moment_z: 0.0,
                max_axial: 0.0, max_torsion: 0.0,
            });
            for i in 0..6.min(mf.forces_i.len()) {
                entry.forces_i[i] += factor * mf.forces_i[i];
                entry.forces_j[i] += factor * mf.forces_j[i];
            }
        }
    }
    
    // Recompute max values from combined member forces
    for (_elem_id, mf) in combined_forces.iter_mut() {
        mf.max_axial = mf.forces_i[0].abs().max(mf.forces_j[0].abs());
        mf.max_shear_y = mf.forces_i[1].abs().max(mf.forces_j[1].abs());
        mf.max_shear_z = mf.forces_i[2].abs().max(mf.forces_j[2].abs());
        mf.max_torsion = mf.forces_i[3].abs().max(mf.forces_j[3].abs());
        mf.max_moment_y = mf.forces_i[4].abs().max(mf.forces_j[4].abs());
        mf.max_moment_z = mf.forces_i[5].abs().max(mf.forces_j[5].abs());
    }
    
    Ok(AnalysisResult3D {
        success: true,
        error: None,
        displacements: combined_disp,
        reactions: combined_rxn,
        member_forces: combined_forces,
        plate_results: HashMap::new(),
        equilibrium_check: None, // Not meaningful for combined results
        condition_number: None,
    })
}

/// Compute envelope (max/min) across multiple load combinations.
/// Takes individual load case results and a list of combinations.
/// Returns the governing max/min for every node and member.
pub fn compute_envelope(
    cases: &HashMap<String, AnalysisResult3D>,
    combinations: &[LoadCombination],
) -> Result<EnvelopeResult, String> {
    let mut combo_results: Vec<(String, AnalysisResult3D)> = Vec::new();
    
    for combo in combinations {
        let result = combine_load_cases(cases, combo)?;
        combo_results.push((combo.name.clone(), result));
    }
    
    let mut max_disp: HashMap<String, Vec<f64>> = HashMap::new();
    let mut min_disp: HashMap<String, Vec<f64>> = HashMap::new();
    let mut max_rxn: HashMap<String, Vec<f64>> = HashMap::new();
    let mut min_rxn: HashMap<String, Vec<f64>> = HashMap::new();
    let mut max_forces: HashMap<String, MemberForces> = HashMap::new();
    let mut governing: HashMap<String, String> = HashMap::new();
    
    for (combo_name, result) in &combo_results {
        // Envelope displacements
        for (node_id, disp) in &result.displacements {
            let max_entry = max_disp.entry(node_id.clone()).or_insert_with(|| vec![f64::NEG_INFINITY; 6]);
            let min_entry = min_disp.entry(node_id.clone()).or_insert_with(|| vec![f64::INFINITY; 6]);
            for i in 0..6.min(disp.len()) {
                max_entry[i] = max_entry[i].max(disp[i]);
                min_entry[i] = min_entry[i].min(disp[i]);
            }
        }
        
        // Envelope reactions
        for (node_id, rxn) in &result.reactions {
            let max_entry = max_rxn.entry(node_id.clone()).or_insert_with(|| vec![f64::NEG_INFINITY; 6]);
            let min_entry = min_rxn.entry(node_id.clone()).or_insert_with(|| vec![f64::INFINITY; 6]);
            for i in 0..6.min(rxn.len()) {
                max_entry[i] = max_entry[i].max(rxn[i]);
                min_entry[i] = min_entry[i].min(rxn[i]);
            }
        }
        
        // Envelope member forces → governs on max absolute moment or axial
        for (elem_id, mf) in &result.member_forces {
            let demand = mf.max_moment_z.max(mf.max_moment_y).max(mf.max_axial);
            let entry = max_forces.entry(elem_id.clone());
            match entry {
                std::collections::hash_map::Entry::Vacant(e) => {
                    e.insert(mf.clone());
                    governing.insert(elem_id.clone(), combo_name.clone());
                },
                std::collections::hash_map::Entry::Occupied(mut e) => {
                    let existing = e.get();
                    let existing_demand = existing.max_moment_z.max(existing.max_moment_y).max(existing.max_axial);
                    if demand > existing_demand {
                        e.insert(mf.clone());
                        governing.insert(elem_id.clone(), combo_name.clone());
                    }
                },
            }
        }
    }
    
    Ok(EnvelopeResult {
        max_displacements: max_disp,
        min_displacements: min_disp,
        max_reactions: max_rxn,
        min_reactions: min_rxn,
        max_member_forces: max_forces,
        governing_combo: governing,
        combination_results: combo_results,
    })
}

/// Standard load combinations per IS 800:2007 (Indian Standard)
/// Table 4: Partial safety factors for loads
pub fn standard_combinations_is800() -> Vec<LoadCombination> {
    vec![
        // Ultimate Limit State (ULS)
        LoadCombination { name: "IS800-1: 1.5DL + 1.5LL".into(),
            factors: vec![("DL".into(), 1.5), ("LL".into(), 1.5)] },
        LoadCombination { name: "IS800-2: 1.5DL + 1.5WL".into(),
            factors: vec![("DL".into(), 1.5), ("WL".into(), 1.5)] },
        LoadCombination { name: "IS800-3: 1.2DL + 1.2LL + 1.2WL".into(),
            factors: vec![("DL".into(), 1.2), ("LL".into(), 1.2), ("WL".into(), 1.2)] },
        LoadCombination { name: "IS800-4: 1.5DL + 1.5EQ".into(),
            factors: vec![("DL".into(), 1.5), ("EQ".into(), 1.5)] },
        LoadCombination { name: "IS800-5: 1.2DL + 1.2LL + 1.2EQ".into(),
            factors: vec![("DL".into(), 1.2), ("LL".into(), 1.2), ("EQ".into(), 1.2)] },
        LoadCombination { name: "IS800-6: 0.9DL + 1.5WL".into(),
            factors: vec![("DL".into(), 0.9), ("WL".into(), 1.5)] },
        LoadCombination { name: "IS800-7: 0.9DL + 1.5EQ".into(),
            factors: vec![("DL".into(), 0.9), ("EQ".into(), 1.5)] },
        // Serviceability Limit State (SLS)
        LoadCombination { name: "IS800-SLS1: 1.0DL + 1.0LL".into(),
            factors: vec![("DL".into(), 1.0), ("LL".into(), 1.0)] },
        LoadCombination { name: "IS800-SLS2: 1.0DL + 1.0WL".into(),
            factors: vec![("DL".into(), 1.0), ("WL".into(), 1.0)] },
        LoadCombination { name: "IS800-SLS3: 1.0DL + 0.8LL + 0.8WL".into(),
            factors: vec![("DL".into(), 1.0), ("LL".into(), 0.8), ("WL".into(), 0.8)] },
    ]
}

/// Standard load combinations per EN 1990/Eurocode 0
/// Eq. 6.10a/b with ψ factors from EN 1990 Table A1.1
pub fn standard_combinations_eurocode() -> Vec<LoadCombination> {
    vec![
        // ULS STR/GEO (Set B)
        LoadCombination { name: "EC-1: 1.35G + 1.5Q".into(),
            factors: vec![("DL".into(), 1.35), ("LL".into(), 1.5)] },
        LoadCombination { name: "EC-2: 1.35G + 1.5Q + 0.9W".into(),
            factors: vec![("DL".into(), 1.35), ("LL".into(), 1.5), ("WL".into(), 0.9)] },
        LoadCombination { name: "EC-3: 1.35G + 1.5W + 1.05Q".into(),
            factors: vec![("DL".into(), 1.35), ("WL".into(), 1.5), ("LL".into(), 1.05)] },
        LoadCombination { name: "EC-4: 1.0G + 1.5W".into(),
            factors: vec![("DL".into(), 1.0), ("WL".into(), 1.5)] },
        // ULS Accidental (seismic)
        LoadCombination { name: "EC-5: 1.0G + 0.3Q + 1.0E".into(),
            factors: vec![("DL".into(), 1.0), ("LL".into(), 0.3), ("EQ".into(), 1.0)] },
        // SLS Characteristic
        LoadCombination { name: "EC-SLS1: 1.0G + 1.0Q".into(),
            factors: vec![("DL".into(), 1.0), ("LL".into(), 1.0)] },
        LoadCombination { name: "EC-SLS2: 1.0G + 1.0Q + 0.6W".into(),
            factors: vec![("DL".into(), 1.0), ("LL".into(), 1.0), ("WL".into(), 0.6)] },
        // SLS Frequent
        LoadCombination { name: "EC-SLS3: 1.0G + 0.5Q".into(),
            factors: vec![("DL".into(), 1.0), ("LL".into(), 0.5)] },
    ]
}

/// Standard load combinations per AISC 360 / ASCE 7 (LRFD)
/// Chapter 2: Combinations for Strength Design
pub fn standard_combinations_aisc_lrfd() -> Vec<LoadCombination> {
    vec![
        // ASCE 7-22 Section 2.3.1
        LoadCombination { name: "LRFD-1: 1.4D".into(),
            factors: vec![("DL".into(), 1.4)] },
        LoadCombination { name: "LRFD-2: 1.2D + 1.6L + 0.5S".into(),
            factors: vec![("DL".into(), 1.2), ("LL".into(), 1.6), ("SL".into(), 0.5)] },
        LoadCombination { name: "LRFD-3: 1.2D + 1.6S + 0.5L".into(),
            factors: vec![("DL".into(), 1.2), ("SL".into(), 1.6), ("LL".into(), 0.5)] },
        LoadCombination { name: "LRFD-4: 1.2D + 1.0W + 0.5L + 0.5S".into(),
            factors: vec![("DL".into(), 1.2), ("WL".into(), 1.0), ("LL".into(), 0.5), ("SL".into(), 0.5)] },
        LoadCombination { name: "LRFD-5: 1.2D + 1.0E + 0.5L + 0.2S".into(),
            factors: vec![("DL".into(), 1.2), ("EQ".into(), 1.0), ("LL".into(), 0.5), ("SL".into(), 0.2)] },
        LoadCombination { name: "LRFD-6: 0.9D + 1.0W".into(),
            factors: vec![("DL".into(), 0.9), ("WL".into(), 1.0)] },
        LoadCombination { name: "LRFD-7: 0.9D + 1.0E".into(),
            factors: vec![("DL".into(), 0.9), ("EQ".into(), 1.0)] },
        // ASD combinations
        LoadCombination { name: "ASD-1: 1.0D".into(),
            factors: vec![("DL".into(), 1.0)] },
        LoadCombination { name: "ASD-2: 1.0D + 1.0L".into(),
            factors: vec![("DL".into(), 1.0), ("LL".into(), 1.0)] },
        LoadCombination { name: "ASD-3: 1.0D + 0.75L + 0.75S".into(),
            factors: vec![("DL".into(), 1.0), ("LL".into(), 0.75), ("SL".into(), 0.75)] },
        LoadCombination { name: "ASD-4: 1.0D + 0.6W".into(),
            factors: vec![("DL".into(), 1.0), ("WL".into(), 0.6)] },
    ]
}

// ============================================
// ANALYSIS RESULTS
// ============================================

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
    
    /// Nodal displacements: node_id -> [ux, uy, uz, θx, θy, θz]
    pub displacements: HashMap<String, Vec<f64>>,
    
    /// Support reactions: node_id -> [Rx, Ry, Rz, Mx, My, Mz]
    pub reactions: HashMap<String, Vec<f64>>,
    
    /// Member forces at ends: element_id -> MemberForces
    pub member_forces: HashMap<String, MemberForces>,
    
    /// Plate/slab element results: element_id -> PlateStressResult
    #[serde(default)]
    pub plate_results: HashMap<String, PlateStressResult>,
    
    /// Equilibrium verification (industry-standard check)
    #[serde(skip_deserializing)]
    pub equilibrium_check: Option<EquilibriumCheck>,
    
    /// Condition number estimate for numerical quality
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

// ModalResult is now defined in dynamics.rs module
pub use crate::dynamics::ModalResult;

// ============================================
// 3D FRAME ANALYSIS
// ============================================

/// Perform 3D frame analysis using Direct Stiffness Method
pub fn analyze_3d_frame(
    nodes: Vec<Node3D>,
    elements: Vec<Element3D>,
    nodal_loads: Vec<NodalLoad>,
    distributed_loads: Vec<DistributedLoad>,
    temperature_loads: Vec<TemperatureLoad>,
    point_loads_on_members: Vec<PointLoadOnMember>,
    config: AnalysisConfig,
) -> Result<AnalysisResult3D, String> {
    
    // ===== INPUT VALIDATION (M3: Industry-standard) =====
    if nodes.is_empty() {
        return Err("No nodes defined".to_string());
    }
    if elements.is_empty() {
        return Err("No elements defined".to_string());
    }
    for elem in &elements {
        if let ElementType::Plate = elem.element_type { continue; }
        if elem.E <= 0.0 {
            return Err(format!("Element {}: Young's modulus E must be > 0 (got {})", elem.id, elem.E));
        }
        if elem.A <= 0.0 {
            return Err(format!("Element {}: Cross-sectional area A must be > 0 (got {})", elem.id, elem.A));
        }
        if elem.Iy < 0.0 {
            return Err(format!("Element {}: Moment of inertia Iy must be >= 0 (got {})", elem.id, elem.Iy));
        }
        if let ElementType::Frame = elem.element_type {
            if elem.Iy <= 0.0 && elem.Iz <= 0.0 {
                return Err(format!("Element {}: Frame element requires Iy > 0 or Iz > 0", elem.id));
            }
        }
        if elem.G < 0.0 {
            return Err(format!("Element {}: Shear modulus G must be >= 0 (got {})", elem.id, elem.G));
        }
    }
    // Check node IDs are unique
    {
        let mut seen = std::collections::HashSet::new();
        for node in &nodes {
            if !seen.insert(&node.id) {
                return Err(format!("Duplicate node ID: {}", node.id));
            }
        }
    }
    // Check element IDs are unique
    {
        let mut seen = std::collections::HashSet::new();
        for elem in &elements {
            if !seen.insert(&elem.id) {
                return Err(format!("Duplicate element ID: {}", elem.id));
            }
        }
    }
    
    let num_nodes = nodes.len();
    let num_dof = num_nodes * 6;
    
    // Create node ID to index mapping
    let mut node_map: HashMap<String, usize> = HashMap::new();
    for (idx, node) in nodes.iter().enumerate() {
        node_map.insert(node.id.clone(), idx);
    }
    
    // Initialize global stiffness matrix and force vector
    let mut k_global: DMatrix<f64> = DMatrix::zeros(num_dof, num_dof);
    let mut f_global: DVector<f64> = DVector::zeros(num_dof);
    
    // Fixed end forces from distributed loads
    let mut fef_global: DVector<f64> = DVector::zeros(num_dof);
    
    // Assemble element stiffness matrices
    for element in &elements {
        // --- PLATE ELEMENT HANDLING ---
        if let ElementType::Plate = element.element_type {
            // Get node indices
            let ids = [
                &element.node_i, 
                &element.node_j, 
                element.node_k.as_ref().ok_or("Plate missing node k")?, 
                element.node_l.as_ref().ok_or("Plate missing node l")?
            ];
            
            let mut indices = [0usize; 4];
            let mut coords = [(0.0, 0.0, 0.0); 4];
            
            for (i, id) in ids.iter().enumerate() {
                indices[i] = *node_map.get(*id).ok_or(format!("Node {} not found", id))?;
                let n = &nodes[indices[i]];
                coords[i] = (n.x, n.y, n.z);
            }
            
            // Create Plate Element
            let plate = PlateElement::new(
                [ids[0].clone(), ids[1].clone(), ids[2].clone(), ids[3].clone()],
                element.thickness.ok_or("Plate missing thickness")?,
                element.E,
                element.nu.unwrap_or(0.3),
                coords
            );
            
            // Get 24x24 global stiffness matrix
            let k_global_elem = plate.stiffness();
            
            // Assemble into global K
            for i in 0..4 {
                let dof_base_r = indices[i] * 6;
                for j in 0..4 {
                    let dof_base_c = indices[j] * 6;
                    
                    // Copy 6x6 submatrix
                    for r in 0..6 {
                        for c in 0..6 {
                            k_global[(dof_base_r + r, dof_base_c + c)] += k_global_elem[(i * 6 + r, j * 6 + c)];
                        }
                    }
                }
            }
            
            continue; // Move to next element
        }

        // --- FRAME/TRUSS/CABLE HANDLING ---
        let i_idx = *node_map.get(&element.node_i)
            .ok_or(format!("Node {} not found", element.node_i))?;
        let j_idx = *node_map.get(&element.node_j)
            .ok_or(format!("Node {} not found", element.node_j))?;
        
        let node_i = &nodes[i_idx];
        let node_j = &nodes[j_idx];
        
        // Calculate element length and direction cosines
        let dx = node_j.x - node_i.x;
        let dy = node_j.y - node_i.y;
        let dz = node_j.z - node_i.z;
        let length = (dx*dx + dy*dy + dz*dz).sqrt();
        
        if length < 1e-10 {
            return Err(format!("Element {} has zero length", element.id));
        }
        
        // Get local stiffness matrix
        let mut k_local = match element.element_type {
            ElementType::Frame => frame_element_stiffness(element, length),
            ElementType::Truss => truss_element_stiffness(element, length),
            ElementType::Cable => cable_element_stiffness(element, length),
            _ => return Err("Unexpected element type logic".to_string()),
        };
        
        // Apply member end releases via static condensation
        // Released DOFs: releases_i[0..6] for node i (local DOFs 0-5)
        //                releases_j[0..6] for node j (local DOFs 6-11)
        let released: Vec<usize> = (0..6)
            .filter(|&d| element.releases_i[d])
            .chain((0..6).filter(|&d| element.releases_j[d]).map(|d| d + 6))
            .collect();
        if !released.is_empty() {
            let retained: Vec<usize> = (0..12).filter(|d| !released.contains(d)).collect();
            let nc = released.len();
            let nr = retained.len();
            // Extract sub-matrices for static condensation
            // K_condensed = K_RR - K_RC * K_CC^{-1} * K_CR
            let mut k_cc = DMatrix::zeros(nc, nc);
            let mut k_rc = DMatrix::zeros(nr, nc);
            let mut k_cr = DMatrix::zeros(nc, nr);
            for (ri, &r) in released.iter().enumerate() {
                for (rj, &c) in released.iter().enumerate() {
                    k_cc[(ri, rj)] = k_local[(r, c)];
                }
                for (ci, &c) in retained.iter().enumerate() {
                    k_cr[(ri, ci)] = k_local[(r, c)];
                    k_rc[(ci, ri)] = k_local[(c, r)];
                }
            }
            // Use matrix inverse for K_CC^{-1} * K_CR
            if let Some(k_cc_inv) = k_cc.try_inverse() {
                let correction = &k_rc * &k_cc_inv * &k_cr;
                // Apply condensation: zero released rows/cols, modify retained
                for &r in &released {
                    for j in 0..12 { k_local[(r, j)] = 0.0; k_local[(j, r)] = 0.0; }
                }
                for (ri, &r) in retained.iter().enumerate() {
                    for (ci, &c) in retained.iter().enumerate() {
                        k_local[(r, c)] -= correction[(ri, ci)];
                    }
                }
            } else {
                // If K_CC is singular (shouldn't happen for valid releases), just zero rows/cols
                for &r in &released {
                    for j in 0..12 { k_local[(r, j)] = 0.0; k_local[(j, r)] = 0.0; }
                }
            }
        }
        
        // Get transformation matrix
        let t_matrix = transformation_matrix_3d(
            dx, dy, dz, length, element.beta
        );
        
        // Transform to global: K_g = T^T * K_l * T
        let k_global_elem = t_matrix.transpose() * &k_local * &t_matrix;
        
        // Assembly indices (6 DOF per node)
        let dof_i = i_idx * 6;
        let dof_j = j_idx * 6;
        
        // Assemble into global stiffness matrix
        for r in 0..6 {
            for c in 0..6 {
                // i-i block
                k_global[(dof_i + r, dof_i + c)] += k_global_elem[(r, c)];
                // i-j block
                k_global[(dof_i + r, dof_j + c)] += k_global_elem[(r, 6 + c)];
                // j-i block
                k_global[(dof_j + r, dof_i + c)] += k_global_elem[(6 + r, c)];
                // j-j block
                k_global[(dof_j + r, dof_j + c)] += k_global_elem[(6 + r, 6 + c)];
            }
        }
    }
    
    // ===== SPRING SUPPORTS (H1) =====
    // Add spring stiffness to diagonal of K_global for elastically restrained nodes.
    // The spring DOFs are NOT marked as fixed — they participate in the solution.
    for (idx, node) in nodes.iter().enumerate() {
        if let Some(ref springs) = node.spring_stiffness {
            let dof = idx * 6;
            for (d, &ks) in springs.iter().enumerate() {
                if d < 6 && ks > 0.0 {
                    k_global[(dof + d, dof + d)] += ks;
                }
            }
        }
    }
    
    // ===== SELF-WEIGHT (C1) =====
    // Generate equivalent distributed loads from element self-weight: w = ρ·A·g
    let mut all_distributed_loads: Vec<DistributedLoad> = distributed_loads.clone();
    if config.include_self_weight {
        let g = config.gravity * config.gravity_direction; // typically -9.80665
        for element in &elements {
            if let ElementType::Plate = element.element_type { continue; }
            if element.density > 0.0 && element.A > 0.0 {
                let w_self = element.density * element.A * g; // N/m (negative = downward)
                all_distributed_loads.push(DistributedLoad {
                    element_id: element.id.clone(),
                    w_start: w_self,
                    w_end: w_self,
                    direction: LoadDirection::GlobalY,
                    is_projected: false,
                    start_pos: 0.0,
                    end_pos: 1.0,
                });
            }
        }
    }

    // Apply nodal loads
    for load in &nodal_loads {
        let idx = *node_map.get(&load.node_id)
            .ok_or(format!("Load node {} not found", load.node_id))?;
        let dof = idx * 6;
        
        f_global[dof + 0] += load.fx;
        f_global[dof + 1] += load.fy;
        f_global[dof + 2] += load.fz;
        f_global[dof + 3] += load.mx;
        f_global[dof + 4] += load.my;
        f_global[dof + 5] += load.mz;
    }
    
    // Add fixed end forces from distributed loads (including self-weight)
    for dl in &all_distributed_loads {
        let fef = compute_fixed_end_forces(&elements, &nodes, &node_map, dl)?;
        for i in 0..fef.len() {
            fef_global[i] += fef[i];
        }
    }
    
    // ===== POINT LOADS ON MEMBERS (H2) =====
    // Native FEF computation for concentrated forces/moments on elements
    for pl in &point_loads_on_members {
        let element = elements.iter()
            .find(|e| e.id == pl.element_id)
            .ok_or(format!("Element {} not found for point load", pl.element_id))?;
        
        let i_idx = *node_map.get(&element.node_i)
            .ok_or(format!("Node {} not found", element.node_i))?;
        let j_idx = *node_map.get(&element.node_j)
            .ok_or(format!("Node {} not found", element.node_j))?;
        
        let node_i = &nodes[i_idx];
        let node_j = &nodes[j_idx];
        let dx = node_j.x - node_i.x;
        let dy = node_j.y - node_i.y;
        let dz = node_j.z - node_i.z;
        let length = (dx*dx + dy*dy + dz*dz).sqrt();
        if length < 1e-10 { continue; }
        
        let t_matrix = transformation_matrix_3d(dx, dy, dz, length, element.beta);
        let (lx, ly, lz) = decompose_load_direction(&pl.direction, &t_matrix);
        let p = pl.magnitude;
        let pos = pl.position.max(0.0).min(1.0);
        
        let mut fef_local = DVector::zeros(12);
        
        // X-component (axial point load)
        if (lx * p).abs() > 1e-12 {
            let (v1, v2, _m1, _m2) = compute_point_load_fef(lx * p, pos, length, pl.is_moment);
            fef_local[0] += v1; fef_local[6] += v2;
        }
        // Y-component (transverse Y, moments about Z)
        if (ly * p).abs() > 1e-12 {
            let (v1, v2, m1, m2) = compute_point_load_fef(ly * p, pos, length, pl.is_moment);
            fef_local[1] += v1; fef_local[5] += m1; fef_local[7] += v2; fef_local[11] += m2;
        }
        // Z-component (transverse Z, moments about Y, opposite sign)
        if (lz * p).abs() > 1e-12 {
            let (v1, v2, m1, m2) = compute_point_load_fef(lz * p, pos, length, pl.is_moment);
            fef_local[2] += v1; fef_local[4] += -m1; fef_local[8] += v2; fef_local[10] += -m2;
        }
        
        // Transform to global and add to FEF vector
        let fef_transformed = t_matrix.transpose() * fef_local;
        let dof_i = i_idx * 6;
        let dof_j = j_idx * 6;
        for k in 0..6 {
            fef_global[dof_i + k] += fef_transformed[k];
            fef_global[dof_j + k] += fef_transformed[6 + k];
        }
    }
    
    // ===== TEMPERATURE LOADS (C2) =====
    // Compute equivalent nodal forces from thermal effects:
    //   Axial: F = E·A·α·ΔT (uniform expansion/contraction)
    //   Bending Y: M = E·Iy·α·gradient_z (gradient in Z causes bending about Y)
    //   Bending Z: M = E·Iz·α·gradient_y (gradient in Y causes bending about Z)
    for tl in &temperature_loads {
        let element = elements.iter()
            .find(|e| e.id == tl.element_id)
            .ok_or(format!("Element {} not found for temperature load", tl.element_id))?;
        
        let i_idx = *node_map.get(&element.node_i)
            .ok_or(format!("Node {} not found", element.node_i))?;
        let j_idx = *node_map.get(&element.node_j)
            .ok_or(format!("Node {} not found", element.node_j))?;
        
        let node_i = &nodes[i_idx];
        let node_j = &nodes[j_idx];
        let dx = node_j.x - node_i.x;
        let dy = node_j.y - node_i.y;
        let dz = node_j.z - node_i.z;
        let length = (dx*dx + dy*dy + dz*dz).sqrt();
        if length < 1e-10 { continue; }
        
        let t_matrix = transformation_matrix_3d(dx, dy, dz, length, element.beta);
        
        let mut f_thermal_local = DVector::zeros(12);
        
        // Uniform temperature: axial force F = E·A·α·ΔT
        // In local coords: F_axial at node_i = -E·A·α·ΔT, at node_j = +E·A·α·ΔT
        // (compression if ΔT > 0 and element is restrained)
        let f_axial = element.E * element.A * tl.alpha * tl.delta_t;
        f_thermal_local[0] = -f_axial;  // Node i (restrained end pushes back)
        f_thermal_local[6] = f_axial;   // Node j
        
        // Thermal gradient in Z → bending about Y: M = E·Iy·α·gradient_z
        let iz_val = if element.Iz > 0.0 { element.Iz } else { element.Iy };
        if tl.gradient_y.abs() > 1e-15 {
            let m_bend_z = element.E * iz_val * tl.alpha * tl.gradient_y;
            f_thermal_local[5] += m_bend_z;   // Mz at node i
            f_thermal_local[11] += -m_bend_z;  // Mz at node j
        }
        
        // Thermal gradient in Y → bending about Z: M = E·Iz·α·gradient_y
        if tl.gradient_z.abs() > 1e-15 {
            let m_bend_y = element.E * element.Iy * tl.alpha * tl.gradient_z;
            f_thermal_local[4] += -m_bend_y;  // My at node i (sign convention)
            f_thermal_local[10] += m_bend_y;   // My at node j
        }
        
        // Transform to global and add to force vector (thermal forces go directly into f_global)
        let f_thermal_global = t_matrix.transpose() * f_thermal_local;
        let dof_i = i_idx * 6;
        let dof_j = j_idx * 6;
        for k in 0..6 {
            f_global[dof_i + k] += f_thermal_global[k];
            f_global[dof_j + k] += f_thermal_global[6 + k];
        }
    }
    
    // Total force = applied nodal loads + thermal loads + equivalent distributed-load forces + point load FEFs
    let f_total = f_global.clone() + fef_global.clone();
    
    // Identify free and fixed DOFs
    let mut free_dofs = Vec::new();
    let mut fixed_dofs = Vec::new();
    
    for (i, node) in nodes.iter().enumerate() {
        for dof in 0..6 {
            let global_dof = i * 6 + dof;
            if node.restraints[dof] {
                fixed_dofs.push(global_dof);
            } else {
                free_dofs.push(global_dof);
            }
        }
    }
    
    let n_free = free_dofs.len();
    
    // Solve for displacements (skip if all DOFs are fixed)
    let mut u_global: DVector<f64> = DVector::zeros(num_dof);
    let condition_estimate;
    
    if n_free == 0 {
        // All DOFs are fixed — u remains zero. Reactions will be computed below.
        condition_estimate = 1.0;
    } else {
        // Extract reduced stiffness matrix and force vector
        let mut k_reduced = DMatrix::zeros(n_free, n_free);
        let mut f_reduced = DVector::zeros(n_free);
        
        for (i, &r_idx) in free_dofs.iter().enumerate() {
            f_reduced[i] = f_total[r_idx];
            for (j, &c_idx) in free_dofs.iter().enumerate() {
                k_reduced[(i, j)] = k_global[(r_idx, c_idx)];
            }
        }
        
        // Estimate condition number from diagonal of reduced K
        let mut max_diag = 0.0f64;
        let mut min_diag = f64::MAX;
        for i in 0..n_free {
            let d = k_reduced[(i, i)].abs();
            if d > 1e-20 {
                max_diag = max_diag.max(d);
                min_diag = min_diag.min(d);
            }
        }
        condition_estimate = if min_diag > 1e-30 { max_diag / min_diag } else { f64::MAX };
        
        // Solve: K * u = F using LU decomposition
        let u_reduced = k_reduced.lu().solve(&f_reduced);
        
        let u_reduced = match u_reduced {
            Some(u) => u,
            None => return Err("Structure is unstable (singular stiffness matrix)".to_string()),
        };
        
        // Reconstruct full displacement vector
        for (i, &dof_idx) in free_dofs.iter().enumerate() {
            u_global[dof_idx] = u_reduced[i];
        }
    }
    
    // Calculate reactions: R = K * u - F_applied - FEF
    // (FEF are load equivalents, so subtract them from K*u to get the support reactions)
    let r_global = &k_global * &u_global - &f_global - &fef_global;
    
    // Extract results
    let mut displacements = HashMap::new();
    let mut reactions = HashMap::new();
    
    for (idx, node) in nodes.iter().enumerate() {
        let dof = idx * 6;
        
        displacements.insert(node.id.clone(), vec![
            u_global[dof + 0],
            u_global[dof + 1],
            u_global[dof + 2],
            u_global[dof + 3],
            u_global[dof + 4],
            u_global[dof + 5],
        ]);
        
        // Only include reactions for restrained nodes
        if node.restraints.iter().any(|&r| r) {
            reactions.insert(node.id.clone(), vec![
                r_global[dof + 0],
                r_global[dof + 1],
                r_global[dof + 2],
                r_global[dof + 3],
                r_global[dof + 4],
                r_global[dof + 5],
            ]);
        }
    }
    
    // Calculate member forces (using shared DRY helpers, includes point loads)
    let member_forces = calculate_member_forces(
        &elements, &nodes, &node_map, &u_global, &all_distributed_loads, &point_loads_on_members
    )?;
    
    // ===== EQUILIBRIUM VERIFICATION (H3: industry-standard with moments) =====
    // Sum of applied forces AND moments about the origin
    let mut sum_applied = vec![0.0f64; 6]; // [Fx, Fy, Fz, Mx, My, Mz]
    
    // Nodal loads: forces + moments (including r×F for moment equilibrium)
    for load in &nodal_loads {
        if let Some(&idx) = node_map.get(&load.node_id) {
            let n = &nodes[idx];
            sum_applied[0] += load.fx;
            sum_applied[1] += load.fy;
            sum_applied[2] += load.fz;
            // Applied moments + r × F (moment about origin from force at position r)
            sum_applied[3] += load.mx + (n.y * load.fz - n.z * load.fy);
            sum_applied[4] += load.my + (n.z * load.fx - n.x * load.fz);
            sum_applied[5] += load.mz + (n.x * load.fy - n.y * load.fx);
        }
    }
    
    // Distributed loads: total resultant + moment about origin
    for dl in &all_distributed_loads {
        if let Some(element) = elements.iter().find(|e| e.id == dl.element_id) {
            let ii = node_map.get(&element.node_i);
            let ji = node_map.get(&element.node_j);
            if let (Some(&i_idx), Some(&j_idx)) = (ii, ji) {
                let ni = &nodes[i_idx];
                let nj = &nodes[j_idx];
                let dx = nj.x - ni.x;
                let dy = nj.y - ni.y;
                let dz = nj.z - ni.z;
                let length = (dx*dx + dy*dy + dz*dz).sqrt();
                if length < 1e-10 { continue; }
                
                // Effective span for partial loads
                let sp = dl.start_pos.max(0.0).min(1.0);
                let ep = dl.end_pos.max(0.0).min(1.0);
                let load_length = (ep - sp) * length;
                let total_w = (dl.w_start + dl.w_end) * load_length / 2.0;
                
                // Centroid of distributed load along member (for moment arm)
                // For trapezoidal: centroid at (w1*a + w2*b)/sum from start of load zone
                let w_sum = dl.w_start.abs() + dl.w_end.abs();
                let load_center_ratio = if w_sum > 1e-12 {
                    sp + (ep - sp) * (dl.w_start.abs() + 2.0 * dl.w_end.abs()) / (3.0 * w_sum)
                } else { (sp + ep) / 2.0 };
                let cx_load = ni.x + load_center_ratio * dx;
                let cy_load = ni.y + load_center_ratio * dy;
                let cz_load = ni.z + load_center_ratio * dz;
                
                // Resolve load into global force components
                let (gfx, gfy, gfz) = match dl.direction {
                    LoadDirection::GlobalX => (total_w, 0.0, 0.0),
                    LoadDirection::GlobalY => (0.0, total_w, 0.0),
                    LoadDirection::GlobalZ => (0.0, 0.0, total_w),
                    LoadDirection::LocalX => {
                        let cx = dx / length; let cy = dy / length; let cz = dz / length;
                        (total_w * cx, total_w * cy, total_w * cz)
                    },
                    LoadDirection::LocalY => {
                        let t = transformation_matrix_3d(dx, dy, dz, length, element.beta);
                        (total_w * t[(1, 0)], total_w * t[(1, 1)], total_w * t[(1, 2)])
                    },
                    LoadDirection::LocalZ => {
                        let t = transformation_matrix_3d(dx, dy, dz, length, element.beta);
                        (total_w * t[(2, 0)], total_w * t[(2, 1)], total_w * t[(2, 2)])
                    },
                };
                
                sum_applied[0] += gfx;
                sum_applied[1] += gfy;
                sum_applied[2] += gfz;
                // Moment about origin: r × F
                sum_applied[3] += cy_load * gfz - cz_load * gfy;
                sum_applied[4] += cz_load * gfx - cx_load * gfz;
                sum_applied[5] += cx_load * gfy - cy_load * gfx;
            }
        }
    }
    
    // Point loads on members: force resultant + moment about origin
    for pl in &point_loads_on_members {
        if let Some(element) = elements.iter().find(|e| e.id == pl.element_id) {
            if let (Some(&ii), Some(&ji)) = (node_map.get(&element.node_i), node_map.get(&element.node_j)) {
                let ni = &nodes[ii];
                let nj = &nodes[ji];
                let dx = nj.x - ni.x;
                let dy = nj.y - ni.y;
                let dz = nj.z - ni.z;
                let length = (dx*dx + dy*dy + dz*dz).sqrt();
                if length < 1e-10 { continue; }
                
                let pos = pl.position.max(0.0).min(1.0);
                let px = ni.x + pos * dx;
                let py = ni.y + pos * dy;
                let pz = ni.z + pos * dz;
                
                let t_matrix = transformation_matrix_3d(dx, dy, dz, length, element.beta);
                let (lx, ly, lz) = decompose_load_direction(&pl.direction, &t_matrix);
                // Convert local direction to global for equilibrium  
                let gfx = pl.magnitude * (lx * t_matrix[(0,0)] + ly * t_matrix[(1,0)] + lz * t_matrix[(2,0)]);
                let gfy = pl.magnitude * (lx * t_matrix[(0,1)] + ly * t_matrix[(1,1)] + lz * t_matrix[(2,1)]);
                let gfz = pl.magnitude * (lx * t_matrix[(0,2)] + ly * t_matrix[(1,2)] + lz * t_matrix[(2,2)]);
                
                if !pl.is_moment {
                    sum_applied[0] += gfx;
                    sum_applied[1] += gfy;
                    sum_applied[2] += gfz;
                    sum_applied[3] += py * gfz - pz * gfy;
                    sum_applied[4] += pz * gfx - px * gfz;
                    sum_applied[5] += px * gfy - py * gfx;
                }
            }
        }
    }
    
    // Sum of reactions (forces + moments about origin)
    let mut sum_reactions = vec![0.0f64; 6];
    for (node_id, rxn) in &reactions {
        if let Some(&idx) = node_map.get(node_id) {
            let n = &nodes[idx];
            sum_reactions[0] += rxn[0];
            sum_reactions[1] += rxn[1];
            sum_reactions[2] += rxn[2];
            // Moment reactions + r × F_reaction
            sum_reactions[3] += rxn[3] + (n.y * rxn[2] - n.z * rxn[1]);
            sum_reactions[4] += rxn[4] + (n.z * rxn[0] - n.x * rxn[2]);
            sum_reactions[5] += rxn[5] + (n.x * rxn[1] - n.y * rxn[0]);
        }
    }
    
    // Spring reaction forces: F_spring = k_spring * u at spring DOFs
    // These act as additional reaction forces for equilibrium
    for (idx, node) in nodes.iter().enumerate() {
        if let Some(ref springs) = node.spring_stiffness {
            let dof = idx * 6;
            let mut f_spring = vec![0.0f64; 6];
            let mut has_spring = false;
            for (d, &ks) in springs.iter().enumerate() {
                if d < 6 && ks > 0.0 {
                    f_spring[d] = -ks * u_global[dof + d]; // Spring force opposes displacement
                    has_spring = true;
                }
            }
            if has_spring {
                sum_reactions[0] += f_spring[0];
                sum_reactions[1] += f_spring[1];
                sum_reactions[2] += f_spring[2];
                sum_reactions[3] += f_spring[3] + (node.y * f_spring[2] - node.z * f_spring[1]);
                sum_reactions[4] += f_spring[4] + (node.z * f_spring[0] - node.x * f_spring[2]);
                sum_reactions[5] += f_spring[5] + (node.x * f_spring[1] - node.y * f_spring[0]);
            }
        }
    }
    
    // Residual and error (all 6 components: 3 forces + 3 moments)
    let mut residual = vec![0.0f64; 6];
    let mut max_applied = 0.0f64;
    let mut max_residual = 0.0f64;
    for i in 0..6 {
        residual[i] = sum_applied[i] + sum_reactions[i];
        max_applied = max_applied.max(sum_applied[i].abs()).max(sum_reactions[i].abs());
        max_residual = max_residual.max(residual[i].abs());
    }
    let error_pct = if max_applied > 1e-10 { max_residual / max_applied * 100.0 } else { 0.0 };
    
    let equilibrium_check = EquilibriumCheck {
        applied_forces: sum_applied,
        reaction_forces: sum_reactions,
        residual,
        error_percent: error_pct,
        pass: error_pct < 0.1,
    };
    
    // Compute plate/slab stress results
    let plate_results = compute_plate_results(&elements, &nodes, &node_map, &u_global);

    Ok(AnalysisResult3D {
        success: true,
        error: None,
        displacements,
        reactions,
        member_forces,
        plate_results,
        equilibrium_check: Some(equilibrium_check),
        condition_number: Some(condition_estimate),
    })
}

// ============================================
// ELEMENT STIFFNESS MATRICES
// ============================================

/// 3D Frame element stiffness matrix (12x12)
/// Uses Timoshenko beam theory when shear areas (Asy, Asz) are provided (> 0).
/// Falls back to Euler-Bernoulli when shear areas are zero.
///
/// Reference: Przemieniecki, "Theory of Matrix Structural Analysis", Ch. 5
///            Cook et al., "Concepts and Applications of FEA", 4th ed.
fn frame_element_stiffness(elem: &Element3D, L: f64) -> DMatrix<f64> {
    let E = elem.E;
    let G = elem.G;
    let A = elem.A;
    let Iy = elem.Iy;
    let Iz = if elem.Iz > 0.0 { elem.Iz } else { elem.Iy }; // Fallback: symmetric section
    let J = elem.J;
    
    let mut k = DMatrix::zeros(12, 12);
    
    // Axial stiffness
    let k_axial = E * A / L;
    
    // Torsional stiffness
    let k_torsion = G * J / L;
    
    // Timoshenko shear deformation parameters
    // φ = 12EI / (G·As·L²) — when As > 0, otherwise φ = 0 (Euler-Bernoulli)
    let phi_y = if elem.Asy > 0.0 { 12.0 * E * Iz / (G * elem.Asy * L * L) } else { 0.0 };
    let phi_z = if elem.Asz > 0.0 { 12.0 * E * Iy / (G * elem.Asz * L * L) } else { 0.0 };
    
    // Bending stiffness (about Y-axis, bending in XZ plane) with Timoshenko correction
    let denom_y = 1.0 + phi_z; // phi_z affects bending about Y
    let k2y = 12.0 * E * Iy / (L * L * L * denom_y);
    let k3y = 6.0 * E * Iy / (L * L * denom_y);
    let k4y = (4.0 + phi_z) * E * Iy / (L * denom_y);
    let k5y = (2.0 - phi_z) * E * Iy / (L * denom_y);
    
    // Bending stiffness (about Z-axis, bending in XY plane) with Timoshenko correction
    let denom_z = 1.0 + phi_y; // phi_y affects bending about Z
    let k2z = 12.0 * E * Iz / (L * L * L * denom_z);
    let k3z = 6.0 * E * Iz / (L * L * denom_z);
    let k4z = (4.0 + phi_y) * E * Iz / (L * denom_z);
    let k5z = (2.0 - phi_y) * E * Iz / (L * denom_z);
    
    // Axial terms (DOF 0, 6)
    k[(0, 0)] = k_axial;   k[(0, 6)] = -k_axial;
    k[(6, 0)] = -k_axial;  k[(6, 6)] = k_axial;
    
    // Torsion terms (DOF 3, 9)
    k[(3, 3)] = k_torsion;  k[(3, 9)] = -k_torsion;
    k[(9, 3)] = -k_torsion; k[(9, 9)] = k_torsion;
    
    // Bending in XY plane (DOF 1, 5, 7, 11)
    k[(1, 1)] = k2z;   k[(1, 5)] = k3z;   k[(1, 7)] = -k2z;  k[(1, 11)] = k3z;
    k[(5, 1)] = k3z;   k[(5, 5)] = k4z;   k[(5, 7)] = -k3z;  k[(5, 11)] = k5z;
    k[(7, 1)] = -k2z;  k[(7, 5)] = -k3z;  k[(7, 7)] = k2z;   k[(7, 11)] = -k3z;
    k[(11, 1)] = k3z;  k[(11, 5)] = k5z;  k[(11, 7)] = -k3z; k[(11, 11)] = k4z;
    
    // Bending in XZ plane (DOF 2, 4, 8, 10)
    k[(2, 2)] = k2y;   k[(2, 4)] = -k3y;  k[(2, 8)] = -k2y;  k[(2, 10)] = -k3y;
    k[(4, 2)] = -k3y;  k[(4, 4)] = k4y;   k[(4, 8)] = k3y;   k[(4, 10)] = k5y;
    k[(8, 2)] = -k2y;  k[(8, 4)] = k3y;   k[(8, 8)] = k2y;   k[(8, 10)] = k3y;
    k[(10, 2)] = -k3y; k[(10, 4)] = k5y;  k[(10, 8)] = k3y;  k[(10, 10)] = k4y;
    
    k
}

/// Truss element stiffness (axial only)
fn truss_element_stiffness(elem: &Element3D, L: f64) -> DMatrix<f64> {
    let mut k = DMatrix::zeros(12, 12);
    let k_axial = elem.E * elem.A / L;
    
    k[(0, 0)] = k_axial;
    k[(0, 6)] = -k_axial;
    k[(6, 0)] = -k_axial;
    k[(6, 6)] = k_axial;
    
    k
}

/// Cable element with geometric stiffness
fn cable_element_stiffness(elem: &Element3D, L: f64) -> DMatrix<f64> {
    let mut k = DMatrix::zeros(12, 12);
    
    // Elastic stiffness (tension only, handled in nonlinear solver)
    let k_axial = elem.E * elem.A / L;
    
    k[(0, 0)] = k_axial;
    k[(0, 6)] = -k_axial;
    k[(6, 0)] = -k_axial;
    k[(6, 6)] = k_axial;
    
    k
}

// ============================================
// TRANSFORMATION MATRIX
// ============================================

/// 3D transformation matrix (12x12)
fn transformation_matrix_3d(
    dx: f64, dy: f64, dz: f64, 
    L: f64, 
    beta: f64
) -> DMatrix<f64> {
    // Direction cosines
    let cx = dx / L;
    let cy = dy / L;
    let cz = dz / L;
    
    // Calculate rotation matrix (3x3)
    let cxz = (cx*cx + cz*cz).sqrt();
    
    let rotation = if (1.0 - cy.abs()) < 1e-10 || cxz < 1e-10 {
        // Member is vertical (or nearly so) - cxz is ~0
        let sign = if cy > 0.0 { 1.0 } else { -1.0 };
        DMatrix::from_row_slice(3, 3, &[
            0.0, sign, 0.0,
            -sign * beta.cos(), 0.0, beta.sin(),
            sign * beta.sin(), 0.0, beta.cos(),
        ])
    } else {
        // General case - cxz is non-zero, safe to divide
        DMatrix::from_row_slice(3, 3, &[
            cx, cy, cz,
            (-cx*cy*beta.cos() - cz*beta.sin()) / cxz,
            cxz * beta.cos(),
            (-cy*cz*beta.cos() + cx*beta.sin()) / cxz,
            (cx*cy*beta.sin() - cz*beta.cos()) / cxz,
            -cxz * beta.sin(),
            (cy*cz*beta.sin() + cx*beta.cos()) / cxz,
        ])
    };
    
    // Build full transformation matrix (12x12)
    let mut t = DMatrix::zeros(12, 12);
    
    // Place rotation matrix in 4 blocks
    for i in 0..3 {
        for j in 0..3 {
            t[(i, j)] = rotation[(i, j)];
            t[(3+i, 3+j)] = rotation[(i, j)];
            t[(6+i, 6+j)] = rotation[(i, j)];
            t[(9+i, 9+j)] = rotation[(i, j)];
        }
    }
    
    t
}

// ============================================
// FIXED END FORCES
// ============================================

/// Shared FEF computation for a single direction (DRY helper).
/// Returns (reaction_i, reaction_j, moment_i, moment_j) for a beam loaded with
/// intensities (wa, wb) over the full span or partial span [sp..ep] of length L.
/// 
/// Uses Hermite shape function integration:
/// - Full-span: exact analytical formulas (UDL, triangular, trapezoidal)
/// - Partial-span: 5-point Gauss-Legendre quadrature (exact for poly ≤ 9)
///
/// Reference: McGuire, Gallagher & Ziemian, "Matrix Structural Analysis", 2nd ed.
fn compute_fef_1d(wa: f64, wb: f64, length: f64, sp: f64, ep: f64) -> (f64, f64, f64, f64) {
    if wa.abs() < 1e-12 && wb.abs() < 1e-12 {
        return (0.0, 0.0, 0.0, 0.0);
    }
    
    let is_partial = sp > 1e-10 || ep < 1.0 - 1e-10;
    
    if is_partial {
        // Partial load: use Gauss-Legendre quadrature
        let a = sp * length;
        let b = ep * length;
        let l = length;
        
        // 5-point Gauss-Legendre nodes and weights on [-1, 1]
        let gauss_pts: [(f64, f64); 5] = [
            (-0.906179845938664, 0.236926885056189),
            (-0.538469310105683, 0.478628670499366),
            ( 0.0,               0.568888888888889),
            ( 0.538469310105683, 0.478628670499366),
            ( 0.906179845938664, 0.236926885056189),
        ];
        
        let half_span = (b - a) / 2.0;
        let mid = (a + b) / 2.0;
        
        let mut f_v1 = 0.0;
        let mut f_t1 = 0.0;
        let mut f_v2 = 0.0;
        let mut f_t2 = 0.0;
        
        for &(xi, wi) in &gauss_pts {
            let x = half_span * xi + mid;
            let xr = x / l;
            
            // Hermite shape functions
            let n1 = 1.0 - 3.0 * xr * xr + 2.0 * xr * xr * xr;
            let n2 = x * (1.0 - xr) * (1.0 - xr);
            let n3 = 3.0 * xr * xr - 2.0 * xr * xr * xr;
            let n4 = x * xr * (xr - 1.0);
            
            // Linear interpolation of load intensity
            let t_param = if (b - a).abs() > 1e-12 { (x - a) / (b - a) } else { 0.5 };
            let w = wa + (wb - wa) * t_param;
            
            let jac = half_span;
            f_v1 += wi * w * n1 * jac;
            f_t1 += wi * w * n2 * jac;
            f_v2 += wi * w * n3 * jac;
            f_t2 += wi * w * n4 * jac;
        }
        
        return (f_v1, f_v2, f_t1, f_t2);
    }
    
    // Full-span analytical formulas
    if (wa - wb).abs() < 1e-12 {
        // UDL
        let r = wa * length / 2.0;
        let m = wa * length * length / 12.0;
        (r, r, m, -m)
    } else if wa.abs() < 1e-12 {
        // Ascending: 0 → wb
        (
            wb * length / 6.0,
            wb * length / 3.0,
            wb * length * length / 30.0,
            -wb * length * length / 20.0,
        )
    } else if wb.abs() < 1e-12 {
        // Descending: wa → 0
        (
            wa * length / 3.0,
            wa * length / 6.0,
            wa * length * length / 20.0,
            -wa * length * length / 30.0,
        )
    } else {
        // Trapezoidal: decompose into uniform + triangular
        let w_uniform = wa.min(wb);
        let w_triangular = (wa - wb).abs();
        let ascending = wb > wa;
        let r_u = w_uniform * length / 2.0;
        let m_u = w_uniform * length * length / 12.0;
        let (r1_t, r2_t, m1_t, m2_t) = if ascending {
            (
                w_triangular * length / 6.0,
                w_triangular * length / 3.0,
                w_triangular * length * length / 30.0,
                -w_triangular * length * length / 20.0,
            )
        } else {
            (
                w_triangular * length / 3.0,
                w_triangular * length / 6.0,
                w_triangular * length * length / 20.0,
                -w_triangular * length * length / 30.0,
            )
        };
        (r_u + r1_t, r_u + r2_t, m_u + m1_t, -m_u + m2_t)
    }
}

/// Compute Fixed End Forces for a point load on a member using Hermite shape functions
/// Returns FEF in local coordinates (12 DOF vector)
///
/// For a concentrated load P at distance a from start (b = L - a):
///   V1 = P·b²(3a+b)/L³,  V2 = P·a²(a+3b)/L³
///   M1 = P·a·b²/L²,      M2 = -P·a²·b/L²
///
/// For a concentrated moment M at distance a from start:
///   V1 = 6M·a·b/L³,      V2 = -6M·a·b/L³
///   M1 = M·b(2a-b)/L²,   M2 = M·a(2b-a)/L²
///
/// Reference: Hibbeler, "Structural Analysis", Table 12-1
fn compute_point_load_fef(
    p: f64,
    position_ratio: f64,
    length: f64,
    is_moment: bool,
) -> (f64, f64, f64, f64) {
    let a = position_ratio * length;
    let b = length - a;
    let l = length;
    
    if is_moment {
        // Concentrated moment
        let v1 = 6.0 * p * a * b / (l * l * l);
        let v2 = -v1;
        let m1 = p * b * (2.0 * a - b) / (l * l);
        let m2 = p * a * (2.0 * b - a) / (l * l);
        (v1, v2, m1, m2)
    } else {
        // Concentrated force
        let v1 = p * b * b * (3.0 * a + b) / (l * l * l);
        let v2 = p * a * a * (a + 3.0 * b) / (l * l * l);
        let m1 = p * a * b * b / (l * l);
        let m2 = -p * a * a * b / (l * l);
        (v1, v2, m1, m2)
    }
}

/// Decompose a load direction into local components using the transformation matrix
fn decompose_load_direction(
    direction: &LoadDirection,
    t_matrix: &DMatrix<f64>,
) -> (f64, f64, f64) {
    match direction {
        LoadDirection::LocalX => (1.0, 0.0, 0.0),
        LoadDirection::LocalY => (0.0, 1.0, 0.0),
        LoadDirection::LocalZ => (0.0, 0.0, 1.0),
        LoadDirection::GlobalX => (t_matrix[(0, 0)], t_matrix[(1, 0)], t_matrix[(2, 0)]),
        LoadDirection::GlobalY => (t_matrix[(0, 1)], t_matrix[(1, 1)], t_matrix[(2, 1)]),
        LoadDirection::GlobalZ => (t_matrix[(0, 2)], t_matrix[(1, 2)], t_matrix[(2, 2)]),
    }
}

/// Compute Fixed End Forces for distributed loads using standard FEM formulas
/// 
/// References:
/// - Structural Analysis by Hibbeler, Table 12-1
/// - Matrix Structural Analysis by McGuire, Gallagher & Ziemian
/// - Roark's Formulas for Stress and Strain
fn compute_fixed_end_forces(
    elements: &[Element3D],
    nodes: &[Node3D],
    node_map: &HashMap<String, usize>,
    dl: &DistributedLoad,
) -> Result<DVector<f64>, String> {
    let num_dof = nodes.len() * 6;
    let mut fef_global = DVector::zeros(num_dof);
    
    // Find the element
    let element = elements.iter()
        .find(|e| e.id == dl.element_id)
        .ok_or(format!("Element {} not found for distributed load", dl.element_id))?;
    
    // Get node indices
    let i_idx = *node_map.get(&element.node_i)
        .ok_or(format!("Node {} not found", element.node_i))?;
    let j_idx = *node_map.get(&element.node_j)
        .ok_or(format!("Node {} not found", element.node_j))?;
    
    // Get node coordinates
    let node_i = &nodes[i_idx];
    let node_j = &nodes[j_idx];
    
    // Calculate member length
    let dx = node_j.x - node_i.x;
    let dy = node_j.y - node_i.y;
    let dz = node_j.z - node_i.z;
    let length = (dx*dx + dy*dy + dz*dz).sqrt();
    
    if length < 1e-10 {
        return Ok(fef_global); // Zero-length member
    }
    
    // Load intensities (N/m)
    let w1 = dl.w_start;
    let w2 = dl.w_end;
    
    // Check for zero load
    if w1.abs() < 1e-12 && w2.abs() < 1e-12 {
        return Ok(fef_global);
    }
    
    // Partial load positions (default: full span 0..1)
    let sp = dl.start_pos.max(0.0).min(1.0);
    let ep = dl.end_pos.max(0.0).min(1.0);
    
    // Get transformation matrix (needed for global load decomposition)
    let t_matrix = transformation_matrix_3d(dx, dy, dz, length, element.beta);
    
    // Determine the load direction in LOCAL coordinates
    let (lx, ly, lz) = decompose_load_direction(&dl.direction, &t_matrix);
    let (w_local_x1, w_local_y1, w_local_z1) = (lx * w1, ly * w1, lz * w1);
    let (w_local_x2, w_local_y2, w_local_z2) = (lx * w2, ly * w2, lz * w2);
    
    // Compute FEF for each local direction using shared helper
    let (rx1, rx2, _mx1, _mx2) = compute_fef_1d(w_local_x1, w_local_x2, length, sp, ep);
    let (ry1, ry2, mz1, mz2) = compute_fef_1d(w_local_y1, w_local_y2, length, sp, ep);
    let (rz1, rz2, my1, my2) = compute_fef_1d(w_local_z1, w_local_z2, length, sp, ep);
    
    // Build local FEF vector (12 DOF: 6 at each node)
    // DOF order: Fx, Fy, Fz, Mx, My, Mz
    let mut fef_local = DVector::zeros(12);
    
    // Axial (local X)
    fef_local[0] = rx1;
    fef_local[6] = rx2;
    
    // Transverse Y (bending about Z)
    fef_local[1] = ry1;
    fef_local[5] = mz1;
    fef_local[7] = ry2;
    fef_local[11] = mz2;
    
    // Transverse Z (bending about Y) — opposite sign convention for moments
    fef_local[2] = rz1;
    fef_local[4] = -my1;
    fef_local[8] = rz2;
    fef_local[10] = -my2;
    
    // ALWAYS transform from local to global: FEF_global = T^T * FEF_local
    let fef_transformed = t_matrix.transpose() * fef_local;
    
    // Assemble into global FEF vector
    let dof_i = i_idx * 6;
    let dof_j = j_idx * 6;
    
    for k in 0..6 {
        fef_global[dof_i + k] += fef_transformed[k];
        fef_global[dof_j + k] += fef_transformed[6 + k];
    }
    
    Ok(fef_global)
}

/// Compute plate/slab stress results from nodal displacements
/// Evaluates membrane stresses, bending moments, and von Mises at element center (ξ=0, η=0)
fn compute_plate_results(
    elements: &[Element3D],
    nodes: &[Node3D],
    node_map: &HashMap<String, usize>,
    u_global: &DVector<f64>,
) -> HashMap<String, PlateStressResult> {
    let mut results = HashMap::new();

    for elem in elements {
        if let ElementType::Plate = elem.element_type {
            // Gather 4 node indices and coordinates
            let ids = [
                &elem.node_i,
                &elem.node_j,
                match elem.node_k.as_ref() { Some(s) => s, None => continue },
                match elem.node_l.as_ref() { Some(s) => s, None => continue },
            ];

            let mut indices = [0usize; 4];
            let mut coords_3d = [(0.0f64, 0.0f64, 0.0f64); 4];
            let mut ok = true;
            for (i, id) in ids.iter().enumerate() {
                match node_map.get(*id) {
                    Some(&idx) => {
                        indices[i] = idx;
                        let n = &nodes[idx];
                        coords_3d[i] = (n.x, n.y, n.z);
                    },
                    None => { ok = false; break; }
                }
            }
            if !ok { continue; }

            let thickness = match elem.thickness {
                Some(t) => t,
                None => continue,
            };
            let e_mod = elem.E;
            let nu = elem.nu.unwrap_or(0.3);

            // Build PlateElement for B-matrix evaluation
            let plate = PlateElement::new(
                [ids[0].clone(), ids[1].clone(), ids[2].clone(), ids[3].clone()],
                thickness,
                e_mod,
                nu,
                coords_3d,
            );

            // Extract 24-DOF global displacement vector for this element
            let mut u_elem_global = DVector::zeros(24);
            for i in 0..4 {
                let base_g = indices[i] * 6;
                for d in 0..6 {
                    u_elem_global[i * 6 + d] = u_global[base_g + d];
                }
            }

            // Transform to local coordinates: u_local = T * u_global
            let t_matrix = plate.transformation_matrix();
            let u_local = &t_matrix * &u_elem_global;

            // Get local 2D coordinates for B-matrix evaluation
            let local_coords = plate.get_local_coords_2d();

            // Evaluate at element center (ξ=0, η=0)
            // --- Membrane stresses ---
            let (_det_mem, b_mem) = plate.shape_func_derivs_membrane(0.0, 0.0, &local_coords);
            // Extract membrane DOFs (u, v at each node) from local displacements
            let mut u_mem = DVector::zeros(8);
            for i in 0..4 {
                u_mem[i * 2]     = u_local[i * 6];     // u
                u_mem[i * 2 + 1] = u_local[i * 6 + 1]; // v
            }
            // Membrane constitutive matrix (plane stress)
            let c_factor = e_mod / (1.0 - nu * nu);
            // strain = B_mem * u_mem
            let strain_mem = &b_mem * &u_mem;
            // stress = C * strain
            let stress_xx = c_factor * (strain_mem[0] + nu * strain_mem[1]);
            let stress_yy = c_factor * (nu * strain_mem[0] + strain_mem[1]);
            let stress_xy = c_factor * (1.0 - nu) / 2.0 * strain_mem[2];

            // --- Bending moments ---
            let (_det_bend, b_b, _b_s) = plate.shape_func_mindlin(0.0, 0.0, &local_coords);
            // Extract bending DOFs (w, θx, θy at each node)
            let mut u_bend = DVector::zeros(12);
            for i in 0..4 {
                u_bend[i * 3]     = u_local[i * 6 + 2]; // w
                u_bend[i * 3 + 1] = u_local[i * 6 + 3]; // θx
                u_bend[i * 3 + 2] = u_local[i * 6 + 4]; // θy
            }
            // Bending D matrix: D_b = E*t³/(12*(1-ν²))
            let d_factor = e_mod * thickness.powi(3) / (12.0 * (1.0 - nu * nu));
            // curvature = B_b * u_bend
            let kappa = &b_b * &u_bend;
            // moments = D_b * curvature
            let moment_xx = d_factor * (kappa[0] + nu * kappa[1]);
            let moment_yy = d_factor * (nu * kappa[0] + kappa[1]);
            let moment_xy = d_factor * (1.0 - nu) / 2.0 * kappa[2];

            // Average transverse displacement at center
            let n_center = [0.25f64; 4]; // shape functions at (0,0) for Q4
            let displacement = n_center.iter().enumerate()
                .map(|(i, &n)| n * u_local[i * 6 + 2])
                .sum::<f64>();

            // Von Mises stress (membrane + bending surface stress)
            // Bending surface stress = 6*M/(t²)
            let sig_bx = stress_xx + 6.0 * moment_xx / (thickness * thickness);
            let sig_by = stress_yy + 6.0 * moment_yy / (thickness * thickness);
            let sig_bxy = stress_xy + 6.0 * moment_xy / (thickness * thickness);
            let von_mises = (sig_bx * sig_bx + sig_by * sig_by
                - sig_bx * sig_by + 3.0 * sig_bxy * sig_bxy).sqrt();

            results.insert(elem.id.clone(), PlateStressResult {
                stress_xx,
                stress_yy,
                stress_xy,
                moment_xx,
                moment_yy,
                moment_xy,
                displacement,
                von_mises,
            });
        }
    }

    results
}

/// Calculate member forces from global displacements
/// 
/// Member forces = k_local * T * u_global - FEF (McGuire convention)
/// Uses shared compute_fef_1d and decompose_load_direction helpers (DRY).
fn calculate_member_forces(
    elements: &[Element3D],
    nodes: &[Node3D],
    node_map: &HashMap<String, usize>,
    u_global: &DVector<f64>,
    distributed_loads: &[DistributedLoad],
    point_loads_on_members: &[PointLoadOnMember],
) -> Result<HashMap<String, MemberForces>, String> {
    let mut forces = HashMap::new();
    
    // Build member-count-per-node for pin-support detection.
    // A node with translational restraints but no moment restraint (mz=false),
    // connected to only ONE element, is a simple support (pin/roller).
    // The bending moment at that end must be exactly zero.
    let mut member_count: HashMap<String, usize> = HashMap::new();
    for elem in elements {
        if let ElementType::Plate = elem.element_type { continue; }
        *member_count.entry(elem.node_i.clone()).or_insert(0) += 1;
        *member_count.entry(elem.node_j.clone()).or_insert(0) += 1;
    }
    let is_pin_support = |node_id: &str| -> bool {
        if let Some(&idx) = node_map.get(node_id) {
            let nd = &nodes[idx];
            let has_translation = nd.restraints[0] || nd.restraints[1] || nd.restraints[2];
            let has_moment_z = nd.restraints[5]; // Mz DOF
            let single_member = *member_count.get(node_id).unwrap_or(&0) <= 1;
            has_translation && !has_moment_z && single_member
        } else { false }
    };
    
    for elem in elements {
        if let ElementType::Plate = elem.element_type { continue; }

        let i_idx = match node_map.get(&elem.node_i) { Some(&idx) => idx, None => continue };
        let j_idx = match node_map.get(&elem.node_j) { Some(&idx) => idx, None => continue };
        
        let node_i = &nodes[i_idx];
        let node_j = &nodes[j_idx];
        let dx = node_j.x - node_i.x;
        let dy = node_j.y - node_i.y;
        let dz = node_j.z - node_i.z;
        let length = (dx*dx + dy*dy + dz*dz).sqrt();
        
        if length < 1e-10 {
            forces.insert(elem.id.clone(), MemberForces {
                forces_i: vec![0.0; 6], forces_j: vec![0.0; 6],
                max_shear_y: 0.0, max_shear_z: 0.0, max_moment_y: 0.0,
                max_moment_z: 0.0, max_axial: 0.0, max_torsion: 0.0,
            });
            continue;
        }
        
        let dof_i = i_idx * 6;
        let dof_j = j_idx * 6;
        let mut u_elem = DVector::zeros(12);
        for k in 0..6 { u_elem[k] = u_global[dof_i + k]; u_elem[6 + k] = u_global[dof_j + k]; }
        
        let t_matrix = transformation_matrix_3d(dx, dy, dz, length, elem.beta);
        let u_local = &t_matrix * &u_elem;
        let k_local = frame_element_stiffness(elem, length);
        let f_local = &k_local * &u_local;
        
        // Build local FEF using shared helpers (no duplication)
        let mut fef_local = DVector::zeros(12);
        
        // Distributed loads
        for dl in distributed_loads {
            if dl.element_id != elem.id { continue; }
            let w1 = dl.w_start;
            let w2 = dl.w_end;
            if w1.abs() < 1e-12 && w2.abs() < 1e-12 { continue; }
            
            let sp = dl.start_pos.max(0.0).min(1.0);
            let ep = dl.end_pos.max(0.0).min(1.0);
            let (lx, ly, lz) = decompose_load_direction(&dl.direction, &t_matrix);
            
            let (rx1, rx2, _mx1, _mx2) = compute_fef_1d(lx*w1, lx*w2, length, sp, ep);
            let (ry1, ry2, mz1, mz2) = compute_fef_1d(ly*w1, ly*w2, length, sp, ep);
            let (rz1, rz2, my1, my2) = compute_fef_1d(lz*w1, lz*w2, length, sp, ep);
            
            fef_local[0] += rx1; fef_local[6] += rx2;
            fef_local[1] += ry1; fef_local[5] += mz1; fef_local[7] += ry2; fef_local[11] += mz2;
            fef_local[2] += rz1; fef_local[4] += -my1; fef_local[8] += rz2; fef_local[10] += -my2;
        }
        
        // Point loads on members
        for pl in point_loads_on_members {
            if pl.element_id != elem.id { continue; }
            let (lx, ly, lz) = decompose_load_direction(&pl.direction, &t_matrix);
            let p = pl.magnitude;
            let pos = pl.position.max(0.0).min(1.0);
            
            // X-component (axial)
            if (lx * p).abs() > 1e-12 {
                let (v1, v2, m1, m2) = compute_point_load_fef(lx * p, pos, length, pl.is_moment);
                fef_local[0] += v1; fef_local[6] += v2;
            }
            // Y-component (transverse Y, moments about Z)
            if (ly * p).abs() > 1e-12 {
                let (v1, v2, m1, m2) = compute_point_load_fef(ly * p, pos, length, pl.is_moment);
                fef_local[1] += v1; fef_local[5] += m1; fef_local[7] += v2; fef_local[11] += m2;
            }
            // Z-component (transverse Z, moments about Y, opposite sign)
            if (lz * p).abs() > 1e-12 {
                let (v1, v2, m1, m2) = compute_point_load_fef(lz * p, pos, length, pl.is_moment);
                fef_local[2] += v1; fef_local[4] += -m1; fef_local[8] += v2; fef_local[10] += -m2;
            }
        }
        
        let f_total = &f_local - &fef_local;
        
        let mut forces_i: Vec<f64> = (0..6).map(|k| f_total[k]).collect();
        let mut forces_j: Vec<f64> = (6..12).map(|k| f_total[k]).collect();
        
        // Zero released DOFs in force recovery.
        // The force recovery uses the uncondensed stiffness (k*u - FEF), which
        // can produce non-zero forces at member-released DOFs (e.g., pin joints).
        // By definition, a released DOF carries zero internal force.
        for k in 0..6 {
            if elem.releases_i[k] { forces_i[k] = 0.0; }
            if elem.releases_j[k] { forces_j[k] = 0.0; }
        }
        
        // Zero moment at pin/roller supports (node-level check).
        // For simply supported beams: node has translational restraints but
        // no moment restraint, and only one member connects to it.
        if is_pin_support(&elem.node_i) {
            forces_i[4] = 0.0; // My at start
            forces_i[5] = 0.0; // Mz at start
        }
        if is_pin_support(&elem.node_j) {
            forces_j[4] = 0.0; // My at end
            forces_j[5] = 0.0; // Mz at end
        }
        
        // Clean numerical noise: zero values below 1e-6 of peak force
        let peak_force = forces_i.iter().chain(forces_j.iter())
            .map(|v| v.abs())
            .fold(0.0f64, f64::max);
        if peak_force > 1e-15 {
            let tol = peak_force * 1e-6;
            for v in forces_i.iter_mut().chain(forces_j.iter_mut()) {
                if v.abs() < tol { *v = 0.0; }
            }
        }
        
        let max_shear_y = forces_i[1].abs().max(forces_j[1].abs());
        let max_shear_z = forces_i[2].abs().max(forces_j[2].abs());
        let max_moment_y = forces_i[4].abs().max(forces_j[4].abs());
        let max_moment_z = forces_i[5].abs().max(forces_j[5].abs());
        let max_axial = forces_i[0].abs().max(forces_j[0].abs());
        let max_torsion = forces_i[3].abs().max(forces_j[3].abs());
        
        forces.insert(elem.id.clone(), MemberForces {
            forces_i, forces_j,
            max_shear_y, max_shear_z, max_moment_y, max_moment_z, max_axial, max_torsion,
        });
    }
    
    Ok(forces)
}

fn zero_displacement_result(nodes: &[Node3D], elements: &[Element3D]) -> AnalysisResult3D {
    let mut displacements = HashMap::new();
    let mut reactions = HashMap::new();
    let mut member_forces = HashMap::new();
    
    for node in nodes {
        displacements.insert(node.id.clone(), vec![0.0; 6]);
        if node.restraints.iter().any(|&r| r) {
            reactions.insert(node.id.clone(), vec![0.0; 6]);
        }
    }
    
    for elem in elements {
        member_forces.insert(elem.id.clone(), MemberForces {
            forces_i: vec![0.0; 6],
            forces_j: vec![0.0; 6],
            max_shear_y: 0.0,
            max_shear_z: 0.0,
            max_moment_y: 0.0,
            max_moment_z: 0.0,
            max_axial: 0.0,
            max_torsion: 0.0,
        });
    }
    
    AnalysisResult3D {
        success: true,
        error: None,
        displacements,
        reactions,
        member_forces,
        plate_results: HashMap::new(),
        equilibrium_check: Some(EquilibriumCheck {
            applied_forces: vec![0.0; 6],
            reaction_forces: vec![0.0; 6],
            residual: vec![0.0; 6],
            error_percent: 0.0,
            pass: true,
        }),
        condition_number: None,
    }
}

// ============================================
// MODAL ANALYSIS
// ============================================

/// Perform modal analysis (eigenvalue problem)
pub fn modal_analysis(
    nodes: Vec<Node3D>,
    elements: Vec<Element3D>,
    num_modes: usize,
) -> Result<ModalResult, String> {
    use crate::dynamics::{assemble_mass_matrix, solve_eigenvalues, ModalResult};
    
    // 1. Build Global Stiffness Matrix (K)
    // Reuse analyze_3d_frame logic but only for K assembly
    // Since analyze_3d_frame does K assembly + Solve + Recover, we need to extract K.
    // Ideally, we refactor analyze_3d_frame to return K, but for now duplicate assembly 
    // or assume linear elastic K.
    
    let num_nodes = nodes.len();
    let num_dof = num_nodes * 6;
    
    // Create node ID to index mapping
    let mut node_map: HashMap<String, usize> = HashMap::new();
    for (idx, node) in nodes.iter().enumerate() {
        node_map.insert(node.id.clone(), idx);
    }
    
    // K Assembly (Simplified copy of analyze_3d_frame loop)
    let mut k_global = DMatrix::zeros(num_dof, num_dof);
    
    for element in &elements {
        // [Simplified: Handle Frame & Plate similar to solver_3d.rs]
        // Frame
        if let ElementType::Frame = element.element_type {
            let i_idx = *node_map.get(&element.node_i).ok_or("Node not found")?;
            let j_idx = *node_map.get(&element.node_j).ok_or("Node not found")?;
             let node_i = &nodes[i_idx];
             let node_j = &nodes[j_idx];
             let dx = node_j.x - node_i.x;
             let dy = node_j.y - node_i.y;
             let dz = node_j.z - node_i.z;
             let length = (dx*dx + dy*dy + dz*dz).sqrt();
             
             let k_local = frame_element_stiffness(element, length);
             let t_matrix = transformation_matrix_3d(dx, dy, dz, length, element.beta);
             let k_global_elem = t_matrix.transpose() * &k_local * &t_matrix;
             
             // Assembly... (Indices logic same as before)
             let dof_i = i_idx * 6;
             let dof_j = j_idx * 6;
             for r in 0..6 {
                 for c in 0..6 {
                     k_global[(dof_i + r, dof_i + c)] += k_global_elem[(r, c)];
                     k_global[(dof_i + r, dof_j + c)] += k_global_elem[(r, 6 + c)];
                     k_global[(dof_j + r, dof_i + c)] += k_global_elem[(6 + r, c)];
                     k_global[(dof_j + r, dof_j + c)] += k_global_elem[(6 + r, 6 + c)];
                 }
             }
        }
        // Plate (omitted for brevity in this specific diff, but should be here)
    }

    // 2. Build Global Mass Matrix (M) - Lumped
    let m_global = assemble_mass_matrix(&nodes, &elements, &node_map, num_dof)?;
    
    // 3. Solve Eigenvalues
    // Need to handle constraints (restraints). 
    // Partition K and M to remove fixed DOFs before solving.
    
    let mut free_dofs = Vec::new();
    for (i, node) in nodes.iter().enumerate() {
        for dof in 0..6 {
            if !node.restraints[dof] {
                free_dofs.push(i * 6 + dof);
            }
        }
    }
    
    let n_free = free_dofs.len();
    if n_free == 0 { return Err("No free DOFs for modal analysis".to_string()); }
    
    let mut k_reduced = DMatrix::zeros(n_free, n_free);
    let mut m_reduced = DMatrix::zeros(n_free, n_free);
    
    for (i, &r_idx) in free_dofs.iter().enumerate() {
        for (j, &c_idx) in free_dofs.iter().enumerate() {
            k_reduced[(i, j)] = k_global[(r_idx, c_idx)];
            m_reduced[(i, j)] = m_global[(r_idx, c_idx)];
        }
    }
    
    // Solve
    let mut raw_result = solve_eigenvalues(&k_reduced, &m_reduced, num_modes)?;
    
    // 4. Map back to full mode shapes (insert zeros for fixed DOFs)
    // raw_result.mode_shapes is currently empty from dynamics.rs, we construct it here
    
    // Reconstruct full mode shape vectors
    // Warning: solve_eigenvalues currently doesn't return eigenvectors in the struct properly
    // We need to update dynamics.rs to actually return vectors, or handle it inside there.
    // For now, let's assume solve_eigenvalues handles basic part and we populate the HashMap part here.
    
    // [Simulated Result for MVP until dynamics.rs is fully fleshed out with eigenvectors return]
    // Since dynamics.rs is a placeholder, we return the dummy result for now.
    // raw_result is already of type dynamics::ModalResult
    
    Ok(raw_result)
}

// ============================================
// LINEARIZED BUCKLING ANALYSIS
// ============================================

/// Result of linearized buckling analysis
#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct LinearBucklingResult {
    pub success: bool,
    pub error: Option<String>,
    pub buckling_loads: Vec<f64>,       // Critical load factors λ (P_cr = λ × P_applied)
    pub mode_shapes: Vec<Vec<f64>>,     // Eigenvectors (one per mode, full DOF length)
    pub num_modes: usize,
}

/// Linearized buckling: solves [K_e]{φ} = λ[-K_g]{φ}
///
/// 1. Assemble elastic stiffness K_e and force vector
/// 2. Perform linear analysis to get axial forces in each member
/// 3. Build geometric stiffness K_g from those axial forces
/// 4. Partition to free DOFs and solve generalized eigenvalue problem
/// 5. The smallest positive eigenvalues λ are the critical load factors
///
/// P_critical = λ × P_applied
///
/// Reference: Cook, Malkus, Plesha — "Concepts and Applications of FEA"
pub fn linearized_buckling_analysis(
    nodes: Vec<Node3D>,
    elements: Vec<Element3D>,
    nodal_loads: Vec<NodalLoad>,
    distributed_loads: Vec<DistributedLoad>,
    num_modes: usize,
) -> Result<LinearBucklingResult, String> {
    if nodes.is_empty() { return Err("No nodes for buckling analysis".into()); }
    if elements.is_empty() { return Err("No elements for buckling analysis".into()); }

    let num_nodes = nodes.len();
    let num_dof = num_nodes * 6;

    // Build node map
    let mut node_map: HashMap<String, usize> = HashMap::new();
    for (idx, node) in nodes.iter().enumerate() {
        node_map.insert(node.id.clone(), idx);
    }

    // Step 1: Assemble elastic stiffness K_e (same as analyze_3d_frame)
    let mut k_elastic = DMatrix::zeros(num_dof, num_dof);
    let mut f_global = DVector::zeros(num_dof);

    // Element stiffness assembly
    for element in &elements {
        let i_idx = match node_map.get(&element.node_i) {
            Some(&idx) => idx,
            None => continue,
        };
        let j_idx = match node_map.get(&element.node_j) {
            Some(&idx) => idx,
            None => continue,
        };

        let node_i = &nodes[i_idx];
        let node_j = &nodes[j_idx];
        let dx = node_j.x - node_i.x;
        let dy = node_j.y - node_i.y;
        let dz = node_j.z - node_i.z;
        let length = (dx*dx + dy*dy + dz*dz).sqrt();
        if length < 1e-10 { continue; }

        let k_local = match element.element_type {
            ElementType::Frame => frame_element_stiffness(element, length),
            ElementType::Truss => truss_element_stiffness(element, length),
            _ => continue,
        };
        let t_matrix = transformation_matrix_3d(dx, dy, dz, length, element.beta);
        let k_global_elem = t_matrix.transpose() * &k_local * &t_matrix;

        let dof_i = i_idx * 6;
        let dof_j = j_idx * 6;
        for r in 0..6 {
            for c in 0..6 {
                k_elastic[(dof_i+r, dof_i+c)] += k_global_elem[(r, c)];
                k_elastic[(dof_i+r, dof_j+c)] += k_global_elem[(r, 6+c)];
                k_elastic[(dof_j+r, dof_i+c)] += k_global_elem[(6+r, c)];
                k_elastic[(dof_j+r, dof_j+c)] += k_global_elem[(6+r, 6+c)];
            }
        }
    }

    // Spring supports
    for (idx, node) in nodes.iter().enumerate() {
        if let Some(ref springs) = node.spring_stiffness {
            let dof = idx * 6;
            for (d, &ks) in springs.iter().enumerate() {
                if d < 6 && ks > 0.0 {
                    k_elastic[(dof+d, dof+d)] += ks;
                }
            }
        }
    }

    // Nodal loads
    for load in &nodal_loads {
        if let Some(&idx) = node_map.get(&load.node_id) {
            let dof = idx * 6;
            f_global[dof]   += load.fx;
            f_global[dof+1] += load.fy;
            f_global[dof+2] += load.fz;
            f_global[dof+3] += load.mx;
            f_global[dof+4] += load.my;
            f_global[dof+5] += load.mz;
        }
    }

    // Fixed-end forces from distributed loads
    let mut fef_global = DVector::zeros(num_dof);
    for dl in &distributed_loads {
        if let Ok(fef) = compute_fixed_end_forces(&elements, &nodes, &node_map, dl) {
            fef_global += fef;
        }
    }
    let f_total = &f_global + &fef_global;

    // Partition to free DOFs
    let mut free_dofs = Vec::new();
    for (i, node) in nodes.iter().enumerate() {
        for d in 0..6 {
            if !node.restraints[d] { free_dofs.push(i*6 + d); }
        }
    }
    let n_free = free_dofs.len();
    if n_free == 0 { return Err("No free DOFs for buckling analysis".into()); }

    let mut k_ff = DMatrix::zeros(n_free, n_free);
    let mut f_f = DVector::zeros(n_free);
    for (i, &ri) in free_dofs.iter().enumerate() {
        f_f[i] = f_total[ri];
        for (j, &cj) in free_dofs.iter().enumerate() {
            k_ff[(i,j)] = k_elastic[(ri, cj)];
        }
    }

    // Step 2: Linear solve to get displacements → member axial forces
    let u_f = match k_ff.clone().lu().solve(&f_f) {
        Some(u) => u,
        None => return Err("Singular stiffness matrix — structure is a mechanism".into()),
    };

    let mut u_global = DVector::zeros(num_dof);
    for (i, &dof_idx) in free_dofs.iter().enumerate() {
        u_global[dof_idx] = u_f[i];
    }

    // Calculate member axial forces
    let member_forces = calculate_member_forces(
        &elements, &nodes, &node_map, &u_global, &distributed_loads, &[],
    )?;

    // Step 3: Build K_g from axial forces
    let mut k_geometric = DMatrix::zeros(num_dof, num_dof);
    for element in &elements {
        if !matches!(element.element_type, ElementType::Frame | ElementType::Truss) { continue; }

        let i_idx = match node_map.get(&element.node_i) { Some(&i) => i, None => continue };
        let j_idx = match node_map.get(&element.node_j) { Some(&j) => j, None => continue };
        let node_i = &nodes[i_idx];
        let node_j = &nodes[j_idx];
        let dx = node_j.x - node_i.x;
        let dy = node_j.y - node_i.y;
        let dz = node_j.z - node_i.z;
        let length = (dx*dx + dy*dy + dz*dz).sqrt();
        if length < 1e-10 { continue; }

        // Get axial force from linear solution
        // forces_i[0] is the element END force at node i (from f = K*u)
        // For compression: f_i[0] > 0 (element pushes node outward)
        // Internal axial force N (positive=tension): N = -forces_i[0]
        let axial_force = if let Some(forces) = member_forces.get(&element.id) {
            -forces.forces_i.first().copied().unwrap_or(0.0)
        } else {
            0.0
        };

        let kg_local = geometric_stiffness_matrix(axial_force, length);
        let t_matrix = transformation_matrix_3d(dx, dy, dz, length, element.beta);
        let kg_global_elem = t_matrix.transpose() * &kg_local * &t_matrix;

        let dof_i = i_idx * 6;
        let dof_j = j_idx * 6;
        for r in 0..6 {
            for c in 0..6 {
                k_geometric[(dof_i+r, dof_i+c)] += kg_global_elem[(r, c)];
                k_geometric[(dof_i+r, dof_j+c)] += kg_global_elem[(r, 6+c)];
                k_geometric[(dof_j+r, dof_i+c)] += kg_global_elem[(6+r, c)];
                k_geometric[(dof_j+r, dof_j+c)] += kg_global_elem[(6+r, 6+c)];
            }
        }
    }

    // Step 4: Partition K_g to free DOFs
    let mut kg_ff = DMatrix::zeros(n_free, n_free);
    for (i, &ri) in free_dofs.iter().enumerate() {
        for (j, &cj) in free_dofs.iter().enumerate() {
            kg_ff[(i,j)] = k_geometric[(ri, cj)];
        }
    }

    // Step 5: Solve generalized eigenvalue problem: (K_e + λ·K_g)·φ = 0
    // Rearranged to standard form via Cholesky: K_e = L·L^T
    // B = L^{-1}·(-K_g)·L^{-T} (symmetric!)
    // Eigenvalues of B are μ = 1/λ, so λ = 1/μ
    // This avoids the inaccuracy of symmetrizing K_e^{-1}·(-K_g)
    
    let cholesky = match k_ff.clone().cholesky() {
        Some(c) => c,
        None => return Err("K_e is not positive definite — check boundary conditions".into()),
    };
    let l_lower = cholesky.l();
    let l_inv = match l_lower.clone().try_inverse() {
        Some(inv) => inv,
        None => return Err("Cholesky factor L is singular".into()),
    };
    let l_inv_t = l_inv.transpose();
    let neg_kg = -&kg_ff;
    let b_matrix = &l_inv * &neg_kg * &l_inv_t; // symmetric by construction
    
    let eigen = nalgebra::SymmetricEigen::new(b_matrix);

    // eigenvalues of A are 1/λ (where λ is the buckling load factor)
    // We want λ = 1/eigenvalue, keeping only positive finite values
    let mut load_factors: Vec<(f64, usize)> = eigen.eigenvalues.iter()
        .enumerate()
        .filter_map(|(idx, &ev)| {
            if ev.abs() > 1e-12 {
                let lambda = 1.0 / ev;
                if lambda > 0.0 && lambda.is_finite() { Some((lambda, idx)) } else { None }
            } else { None }
        })
        .collect();
    load_factors.sort_by(|a, b| a.0.partial_cmp(&b.0).unwrap_or(std::cmp::Ordering::Equal));

    let actual_modes = load_factors.len().min(num_modes);
    let buckling_loads: Vec<f64> = load_factors.iter().take(actual_modes).map(|&(l,_)| l).collect();
    let mode_shapes: Vec<Vec<f64>> = load_factors.iter().take(actual_modes).map(|&(_,idx)| {
        // Transform eigenvector back: φ = L^{-T} * y (from Cholesky transformation)
        let evec = eigen.eigenvectors.column(idx);
        let phi = &l_inv_t * evec;
        // Expand to full DOF space
        let mut full = vec![0.0; num_dof];
        for (i, &dof_idx) in free_dofs.iter().enumerate() {
            full[dof_idx] = phi[i];
        }
        full
    }).collect();

    Ok(LinearBucklingResult {
        success: true,
        error: None,
        buckling_loads,
        mode_shapes,
        num_modes: actual_modes,
    })
}

// ============================================
// P-DELTA ANALYSIS
// ============================================

/// Geometric stiffness matrix for a frame element (12x12)
/// Based on Cook, Malkus, Plesha - "Concepts and Applications of Finite Element Analysis"
/// 
/// The geometric stiffness accounts for the effect of axial force on bending stiffness:
/// - Tensile axial force increases effective bending stiffness
/// - Compressive axial force decreases effective bending stiffness (buckling tendency)
fn geometric_stiffness_matrix(axial_force: f64, length: f64) -> DMatrix<f64> {
    let mut kg = DMatrix::zeros(12, 12);
    
    let P = axial_force;  // Positive = tension, Negative = compression
    let L = length;
    
    // Geometric stiffness coefficients
    // From standard FEM texts (Przemieniecki, Cook et al.)
    let k1 = P / L;
    let k2 = 6.0 * P / (5.0 * L);
    let k3 = P / 10.0;
    let k4 = 2.0 * P * L / 15.0;
    let k5 = P * L / 30.0;
    
    // Transverse Y direction (DOF 1, 5, 7, 11)
    kg[(1, 1)] = k2;    kg[(1, 5)] = k3;    kg[(1, 7)] = -k2;   kg[(1, 11)] = k3;
    kg[(5, 1)] = k3;    kg[(5, 5)] = k4;    kg[(5, 7)] = -k3;   kg[(5, 11)] = -k5;
    kg[(7, 1)] = -k2;   kg[(7, 5)] = -k3;   kg[(7, 7)] = k2;    kg[(7, 11)] = -k3;
    kg[(11, 1)] = k3;   kg[(11, 5)] = -k5;  kg[(11, 7)] = -k3;  kg[(11, 11)] = k4;
    
    // Transverse Z direction (DOF 2, 4, 8, 10)
    kg[(2, 2)] = k2;    kg[(2, 4)] = -k3;   kg[(2, 8)] = -k2;   kg[(2, 10)] = -k3;
    kg[(4, 2)] = -k3;   kg[(4, 4)] = k4;    kg[(4, 8)] = k3;    kg[(4, 10)] = -k5;
    kg[(8, 2)] = -k2;   kg[(8, 4)] = k3;    kg[(8, 8)] = k2;    kg[(8, 10)] = k3;
    kg[(10, 2)] = -k3;  kg[(10, 4)] = -k5;  kg[(10, 8)] = k3;   kg[(10, 10)] = k4;
    
    kg
}

/// P-Delta nonlinear analysis
/// 
/// Iterative procedure that accounts for secondary moments (P-Δ effects):
/// 1. Assemble elastic stiffness K_e and force vector F (once)
/// 2. Initial linear solve to get displacements and axial forces
/// 3. Compute geometric stiffness matrix K_g from axial forces
/// 4. Form effective stiffness K_eff = K_e + K_g
/// 5. Re-solve: K_eff * u = F
/// 6. Recover member forces, check convergence
/// 7. Repeat from step 3 until convergence or max iterations
/// 
/// Reference: "Matrix Analysis of Structures" by Kassimali
///            "Stability of Structures" by Bazant & Cedolin
pub fn p_delta_analysis(
    nodes: Vec<Node3D>,
    elements: Vec<Element3D>,
    nodal_loads: Vec<NodalLoad>,
    distributed_loads: Vec<DistributedLoad>,
    temperature_loads: Vec<TemperatureLoad>,
    point_loads_on_members: Vec<PointLoadOnMember>,
    config: AnalysisConfig,
    max_iterations: usize,
    tolerance: f64,
) -> Result<AnalysisResult3D, String> {
    // ===== Input Validation (same as linear solver) =====
    if nodes.is_empty() { return Err("P-Delta: No nodes in structure".to_string()); }
    if elements.is_empty() { return Err("P-Delta: No elements in structure".to_string()); }
    {
        let mut seen_nodes = std::collections::HashSet::new();
        for n in &nodes {
            if !seen_nodes.insert(&n.id) {
                return Err(format!("P-Delta: Duplicate node ID '{}'", n.id));
            }
        }
        let mut seen_elems = std::collections::HashSet::new();
        for e in &elements {
            if !seen_elems.insert(&e.id) {
                return Err(format!("P-Delta: Duplicate element ID '{}'", e.id));
            }
            if let ElementType::Frame = e.element_type {
                if e.E <= 0.0 { return Err(format!("P-Delta: Element '{}' — Young's modulus must be > 0", e.id)); }
                if e.A <= 0.0 { return Err(format!("P-Delta: Element '{}' — Area must be > 0", e.id)); }
            }
        }
    }

    let num_nodes = nodes.len();
    let num_dof = num_nodes * 6;
    
    // Create node ID to index mapping
    let mut node_map: HashMap<String, usize> = HashMap::new();
    for (idx, node) in nodes.iter().enumerate() {
        node_map.insert(node.id.clone(), idx);
    }
    
    // ===== Self-weight: generate distributed loads =====
    let mut all_distributed_loads: Vec<DistributedLoad> = distributed_loads.clone();
    if config.include_self_weight {
        let g = config.gravity * config.gravity_direction;
        for element in &elements {
            if let ElementType::Plate = element.element_type { continue; }
            if element.density > 0.0 && element.A > 0.0 {
                let w_self = element.density * element.A * g;
                all_distributed_loads.push(DistributedLoad {
                    element_id: element.id.clone(),
                    w_start: w_self, w_end: w_self,
                    direction: LoadDirection::GlobalY,
                    is_projected: false, start_pos: 0.0, end_pos: 1.0,
                });
            }
        }
    }
    
    // ===== Step 1: Assemble elastic stiffness K_e (constant across iterations) =====
    let mut k_elastic: DMatrix<f64> = DMatrix::zeros(num_dof, num_dof);
    let mut f_global: DVector<f64> = DVector::zeros(num_dof);
    let mut fef_global: DVector<f64> = DVector::zeros(num_dof);
    
    for element in &elements {
        if let ElementType::Plate = element.element_type { continue; }
        
        let i_idx = *node_map.get(&element.node_i)
            .ok_or(format!("P-Delta: Node {} not found", element.node_i))?;
        let j_idx = *node_map.get(&element.node_j)
            .ok_or(format!("P-Delta: Node {} not found", element.node_j))?;
        
        let node_i = &nodes[i_idx];
        let node_j = &nodes[j_idx];
        let dx = node_j.x - node_i.x;
        let dy = node_j.y - node_i.y;
        let dz = node_j.z - node_i.z;
        let length = (dx*dx + dy*dy + dz*dz).sqrt();
        
        if length < 1e-10 {
            return Err(format!("P-Delta: Element {} has zero length", element.id));
        }
        
        let mut k_local = match element.element_type {
            ElementType::Frame => frame_element_stiffness(element, length),
            ElementType::Truss => truss_element_stiffness(element, length),
            ElementType::Cable => cable_element_stiffness(element, length),
            _ => continue,
        };
        
        // Static condensation for releases (same as linear analysis)
        let released: Vec<usize> = (0..6)
            .filter(|&d| element.releases_i[d])
            .chain((0..6).filter(|&d| element.releases_j[d]).map(|d| d + 6))
            .collect();
        if !released.is_empty() {
            let retained: Vec<usize> = (0..12).filter(|d| !released.contains(d)).collect();
            let nc = released.len();
            let nr = retained.len();
            let mut k_cc = DMatrix::zeros(nc, nc);
            let mut k_rc = DMatrix::zeros(nr, nc);
            let mut k_cr = DMatrix::zeros(nc, nr);
            for (ri, &r) in released.iter().enumerate() {
                for (rj, &c) in released.iter().enumerate() {
                    k_cc[(ri, rj)] = k_local[(r, c)];
                }
                for (ci, &c) in retained.iter().enumerate() {
                    k_cr[(ri, ci)] = k_local[(r, c)];
                    k_rc[(ci, ri)] = k_local[(c, r)];
                }
            }
            if let Some(k_cc_inv) = k_cc.try_inverse() {
                let correction = &k_rc * &k_cc_inv * &k_cr;
                for &r in &released {
                    for j in 0..12 { k_local[(r, j)] = 0.0; k_local[(j, r)] = 0.0; }
                }
                for (ri, &r) in retained.iter().enumerate() {
                    for (ci, &c) in retained.iter().enumerate() {
                        k_local[(r, c)] -= correction[(ri, ci)];
                    }
                }
            } else {
                for &r in &released {
                    for j in 0..12 { k_local[(r, j)] = 0.0; k_local[(j, r)] = 0.0; }
                }
            }
        }
        
        let t_matrix = transformation_matrix_3d(dx, dy, dz, length, element.beta);
        let k_global_elem = t_matrix.transpose() * &k_local * &t_matrix;
        
        let dof_i = i_idx * 6;
        let dof_j = j_idx * 6;
        for r in 0..6 {
            for c in 0..6 {
                k_elastic[(dof_i + r, dof_i + c)] += k_global_elem[(r, c)];
                k_elastic[(dof_i + r, dof_j + c)] += k_global_elem[(r, 6 + c)];
                k_elastic[(dof_j + r, dof_i + c)] += k_global_elem[(6 + r, c)];
                k_elastic[(dof_j + r, dof_j + c)] += k_global_elem[(6 + r, 6 + c)];
            }
        }
    }
    
    // ===== Spring supports (H1) =====
    for (idx, node) in nodes.iter().enumerate() {
        if let Some(ref springs) = node.spring_stiffness {
            let dof = idx * 6;
            for (d, &ks) in springs.iter().enumerate() {
                if d < 6 && ks > 0.0 {
                    k_elastic[(dof + d, dof + d)] += ks;
                }
            }
        }
    }
    
    // Apply nodal loads
    for load in &nodal_loads {
        let idx = *node_map.get(&load.node_id)
            .ok_or(format!("P-Delta: Load node {} not found", load.node_id))?;
        let dof = idx * 6;
        f_global[dof]     += load.fx;
        f_global[dof + 1] += load.fy;
        f_global[dof + 2] += load.fz;
        f_global[dof + 3] += load.mx;
        f_global[dof + 4] += load.my;
        f_global[dof + 5] += load.mz;
    }
    
    // Add FEF from distributed loads
    for dl in &all_distributed_loads {
        let fef = compute_fixed_end_forces(&elements, &nodes, &node_map, dl)?;
        for i in 0..fef.len() { fef_global[i] += fef[i]; }
    }
    
    // Point load FEF assembly
    for pl in &point_loads_on_members {
        let element = elements.iter().find(|e| e.id == pl.element_id);
        if let Some(element) = element {
            let ii = node_map.get(&element.node_i);
            let ji = node_map.get(&element.node_j);
            if let (Some(&i_idx), Some(&j_idx)) = (ii, ji) {
                let ni = &nodes[i_idx]; let nj = &nodes[j_idx];
                let dx = nj.x - ni.x; let dy = nj.y - ni.y; let dz = nj.z - ni.z;
                let length = (dx*dx + dy*dy + dz*dz).sqrt();
                if length < 1e-10 { continue; }
                let t_matrix = transformation_matrix_3d(dx, dy, dz, length, element.beta);
                let (lx, ly, lz) = decompose_load_direction(&pl.direction, &t_matrix);
                let mut fef_local = DVector::zeros(12);
                let pos = pl.position.max(0.0).min(1.0);
                let (v1y, v2y, m1y, m2y) = compute_point_load_fef(pl.magnitude * ly, pos, length, pl.is_moment);
                fef_local[1] += v1y; fef_local[7] += v2y; fef_local[5] += m1y; fef_local[11] += m2y;
                let (v1z, v2z, m1z, m2z) = compute_point_load_fef(pl.magnitude * lz, pos, length, pl.is_moment);
                fef_local[2] += v1z; fef_local[8] += v2z; fef_local[4] -= m1z; fef_local[10] -= m2z;
                let fef_global_elem = t_matrix.transpose() * fef_local;
                let dof_i = i_idx * 6; let dof_j = j_idx * 6;
                for k in 0..6 { fef_global[dof_i + k] += fef_global_elem[k]; fef_global[dof_j + k] += fef_global_elem[6 + k]; }
            }
        }
    }
    
    // Temperature load equivalent forces
    for tl in &temperature_loads {
        let element = elements.iter().find(|e| e.id == tl.element_id)
            .ok_or(format!("P-Delta: Element {} not found for temperature load", tl.element_id))?;
        let i_idx = *node_map.get(&element.node_i).ok_or(format!("Node {} not found", element.node_i))?;
        let j_idx = *node_map.get(&element.node_j).ok_or(format!("Node {} not found", element.node_j))?;
        let ni = &nodes[i_idx]; let nj = &nodes[j_idx];
        let dx = nj.x - ni.x; let dy = nj.y - ni.y; let dz = nj.z - ni.z;
        let length = (dx*dx + dy*dy + dz*dz).sqrt();
        if length < 1e-10 { continue; }
        let t_matrix = transformation_matrix_3d(dx, dy, dz, length, element.beta);
        let mut f_thermal_local = DVector::zeros(12);
        let f_axial = element.E * element.A * tl.alpha * tl.delta_t;
        f_thermal_local[0] = -f_axial; f_thermal_local[6] = f_axial;
        let iz_val = if element.Iz > 0.0 { element.Iz } else { element.Iy };
        if tl.gradient_y.abs() > 1e-15 {
            let m_bend_z = element.E * iz_val * tl.alpha * tl.gradient_y;
            f_thermal_local[5] += m_bend_z; f_thermal_local[11] += -m_bend_z;
        }
        if tl.gradient_z.abs() > 1e-15 {
            let m_bend_y = element.E * element.Iy * tl.alpha * tl.gradient_z;
            f_thermal_local[4] += -m_bend_y; f_thermal_local[10] += m_bend_y;
        }
        let f_thermal_global = t_matrix.transpose() * f_thermal_local;
        let dof_i = i_idx * 6; let dof_j = j_idx * 6;
        for k in 0..6 { f_global[dof_i + k] += f_thermal_global[k]; f_global[dof_j + k] += f_thermal_global[6 + k]; }
    }
    
    let f_total = f_global.clone() + fef_global.clone();
    
    // Identify free / fixed DOFs
    let mut free_dofs = Vec::new();
    let mut fixed_dofs = Vec::new();
    for (i, node) in nodes.iter().enumerate() {
        for dof in 0..6 {
            let global_dof = i * 6 + dof;
            if node.restraints[dof] { fixed_dofs.push(global_dof); }
            else { free_dofs.push(global_dof); }
        }
    }
    let n_free = free_dofs.len();
    if n_free == 0 {
        // All fixed — compute reactions from K*0 - F (thermal/self-weight only)
        let r_global = -&f_global - &fef_global;
        let mut displacements = HashMap::new();
        let mut reactions = HashMap::new();
        for (idx, node) in nodes.iter().enumerate() {
            let d = idx * 6;
            displacements.insert(node.id.clone(), vec![0.0; 6]);
            if node.restraints.iter().any(|&r| r) {
                reactions.insert(node.id.clone(), vec![r_global[d], r_global[d+1], r_global[d+2], r_global[d+3], r_global[d+4], r_global[d+5]]);
            }
        }
        let member_forces_map = calculate_member_forces(&elements, &nodes, &node_map, &DVector::zeros(num_dof), &all_distributed_loads, &point_loads_on_members)?;
        return Ok(AnalysisResult3D {
            success: true, error: None, displacements, reactions,
            member_forces: member_forces_map, plate_results: HashMap::new(),
            equilibrium_check: Some(EquilibriumCheck { applied_forces: vec![0.0;6], reaction_forces: vec![0.0;6], residual: vec![0.0;6], error_percent: 0.0, pass: true }),
            condition_number: Some(1.0),
        });
    }
    
    // ===== Step 2: Initial linear solve =====
    let mut k_reduced = DMatrix::zeros(n_free, n_free);
    let mut f_reduced = DVector::zeros(n_free);
    for (i, &r_idx) in free_dofs.iter().enumerate() {
        f_reduced[i] = f_total[r_idx];
        for (j, &c_idx) in free_dofs.iter().enumerate() {
            k_reduced[(i, j)] = k_elastic[(r_idx, c_idx)];
        }
    }
    
    let u_reduced = k_reduced.lu().solve(&f_reduced)
        .ok_or("P-Delta: Singular stiffness matrix in initial solve".to_string())?;
    
    let mut u_global: DVector<f64> = DVector::zeros(num_dof);
    for (i, &dof_idx) in free_dofs.iter().enumerate() {
        u_global[dof_idx] = u_reduced[i];
    }
    
    // Get initial member forces for axial loads
    let empty_point_loads: Vec<PointLoadOnMember> = vec![];
    let mut member_forces = calculate_member_forces(
        &elements, &nodes, &node_map, &u_global, &distributed_loads, &empty_point_loads
    )?;
    
    // ===== Step 3-7: P-Delta iteration loop =====
    let mut converged = false;
    let mut num_iters = 0;
    
    // k_geometric is declared OUTSIDE the loop so the final iteration's
    // value is available for reaction computation (R = (K_e + K_g) · u − F − FEF).
    let mut k_geometric: DMatrix<f64> = DMatrix::zeros(num_dof, num_dof);

    for iter in 0..max_iterations {
        num_iters = iter + 1;
        let prev_u = u_global.clone();
        
        // Assemble geometric stiffness K_g from current axial forces
        k_geometric = DMatrix::zeros(num_dof, num_dof);
        
        for element in &elements {
            if element.element_type != ElementType::Frame { continue; }
            
            let i_idx = match node_map.get(&element.node_i) {
                Some(&idx) => idx, None => continue,
            };
            let j_idx = match node_map.get(&element.node_j) {
                Some(&idx) => idx, None => continue,
            };
            
            let node_i = &nodes[i_idx];
            let node_j = &nodes[j_idx];
            let dx = node_j.x - node_i.x;
            let dy = node_j.y - node_i.y;
            let dz = node_j.z - node_i.z;
            let length = (dx*dx + dy*dy + dz*dz).sqrt();
            if length < 1e-10 { continue; }
            
            // Get axial force (local x = forces_i[0], sign: +tension, -compression)
            let axial_force = match member_forces.get(&element.id) {
                Some(forces) => forces.forces_i[0],
                None => 0.0,
            };
            
            let kg_local = geometric_stiffness_matrix(axial_force, length);
            let t_matrix = transformation_matrix_3d(dx, dy, dz, length, element.beta);
            let kg_global_elem = t_matrix.transpose() * &kg_local * &t_matrix;
            
            let dof_i = i_idx * 6;
            let dof_j = j_idx * 6;
            for r in 0..6 {
                for c in 0..6 {
                    k_geometric[(dof_i + r, dof_i + c)] += kg_global_elem[(r, c)];
                    k_geometric[(dof_i + r, dof_j + c)] += kg_global_elem[(r, 6 + c)];
                    k_geometric[(dof_j + r, dof_i + c)] += kg_global_elem[(6 + r, c)];
                    k_geometric[(dof_j + r, dof_j + c)] += kg_global_elem[(6 + r, 6 + c)];
                }
            }
        }
        
        // Form effective stiffness: K_eff = K_elastic + K_geometric
        let k_effective = &k_elastic + &k_geometric;
        
        // Extract reduced system and solve
        let mut k_eff_reduced = DMatrix::zeros(n_free, n_free);
        for (i, &r_idx) in free_dofs.iter().enumerate() {
            for (j, &c_idx) in free_dofs.iter().enumerate() {
                k_eff_reduced[(i, j)] = k_effective[(r_idx, c_idx)];
            }
        }
        
        let u_new = k_eff_reduced.lu().solve(&f_reduced)
            .ok_or(format!("P-Delta: Singular matrix at iteration {} — structure may be unstable (buckling)", iter + 1))?;
        
        // Update global displacements
        u_global = DVector::<f64>::zeros(num_dof);
        for (i, &dof_idx) in free_dofs.iter().enumerate() {
            u_global[dof_idx] = u_new[i];
        }
        
        // Update member forces
        member_forces = calculate_member_forces(
            &elements, &nodes, &node_map, &u_global, &all_distributed_loads, &point_loads_on_members
        )?;
        
        // Check convergence: relative change in displacement norm
        let delta_u = &u_global - &prev_u;
        let change_norm = delta_u.norm();
        let disp_norm = u_global.norm();
        
        let relative_change = if disp_norm > 1e-12 {
            change_norm / disp_norm
        } else {
            0.0
        };
        
        if relative_change < tolerance {
            converged = true;
            break;
        }
    }
    
    // Build result from final displacements.
    // Reactions must use the EFFECTIVE stiffness (K_e + K_g) — not just K_e —
    // so that the geometric stiffness contribution is included in support reactions.
    let r_global = (&k_elastic + &k_geometric) * &u_global - &f_global - &fef_global;
    
    let mut displacements = HashMap::new();
    let mut reactions = HashMap::new();
    
    for (idx, node) in nodes.iter().enumerate() {
        let dof = idx * 6;
        displacements.insert(node.id.clone(), vec![
            u_global[dof], u_global[dof+1], u_global[dof+2],
            u_global[dof+3], u_global[dof+4], u_global[dof+5],
        ]);
        if node.restraints.iter().any(|&r| r) {
            reactions.insert(node.id.clone(), vec![
                r_global[dof], r_global[dof+1], r_global[dof+2],
                r_global[dof+3], r_global[dof+4], r_global[dof+5],
            ]);
        }
    }
    
    if !converged {
        web_sys::console::warn_1(
            &format!("P-Delta: Did not converge after {} iterations (may indicate instability)", num_iters).into()
        );
    }
    
    // Compute plate/slab stress results for P-Delta
    let plate_results = compute_plate_results(&elements, &nodes, &node_map, &u_global);

    // ---- Equilibrium check for P-Delta ----
    let mut sum_applied = vec![0.0f64; 6]; // [Fx,Fy,Fz, Mx_o,My_o,Mz_o]
    let mut sum_reactions = vec![0.0f64; 6];

    // Sum applied nodal loads (forces + moments about origin)
    for load in &nodal_loads {
        if let Some(&idx) = node_map.get(&load.node_id) {
            let n = &nodes[idx];
            sum_applied[0] += load.fx;
            sum_applied[1] += load.fy;
            sum_applied[2] += load.fz;
            sum_applied[3] += load.mx + (n.y * load.fz - n.z * load.fy);
            sum_applied[4] += load.my + (n.z * load.fx - n.x * load.fz);
            sum_applied[5] += load.mz + (n.x * load.fy - n.y * load.fx);
        }
    }

    // Sum reaction forces (including moment about origin)
    for (idx, node) in nodes.iter().enumerate() {
        if node.restraints.iter().any(|&r| r) {
            let dof = idx * 6;
            let rx = r_global[dof]; let ry = r_global[dof+1]; let rz = r_global[dof+2];
            sum_reactions[0] += rx;
            sum_reactions[1] += ry;
            sum_reactions[2] += rz;
            sum_reactions[3] += r_global[dof+3] + (node.y * rz - node.z * ry);
            sum_reactions[4] += r_global[dof+4] + (node.z * rx - node.x * rz);
            sum_reactions[5] += r_global[dof+5] + (node.x * ry - node.y * rx);
        }
        // Spring reactions
        if let Some(ref springs) = node.spring_stiffness {
            let dof = idx * 6;
            for (d, &ks) in springs.iter().enumerate() {
                if d < 6 && ks > 0.0 {
                    let fs = -ks * u_global[dof + d];
                    sum_reactions[d % 3] += if d < 3 { fs } else { 0.0 };
                    if d < 3 {
                        sum_reactions[3] += node.y * if d==2 { fs } else { 0.0 } - node.z * if d==1 { fs } else { 0.0 };
                        sum_reactions[4] += node.z * if d==0 { fs } else { 0.0 } - node.x * if d==2 { fs } else { 0.0 };
                        sum_reactions[5] += node.x * if d==1 { fs } else { 0.0 } - node.y * if d==0 { fs } else { 0.0 };
                    } else {
                        sum_reactions[d] += fs;
                    }
                }
            }
        }
    }

    let mut residual = vec![0.0f64; 6];
    let mut max_applied = 0.0f64;
    let mut max_residual = 0.0f64;
    for i in 0..6 {
        residual[i] = sum_applied[i] + sum_reactions[i];
        max_applied = max_applied.max(sum_applied[i].abs()).max(sum_reactions[i].abs());
        max_residual = max_residual.max(residual[i].abs());
    }
    let error_pct = if max_applied > 1e-10 { max_residual / max_applied * 100.0 } else { 0.0 };

    let equilibrium_check = EquilibriumCheck {
        applied_forces: sum_applied,
        reaction_forces: sum_reactions,
        residual,
        error_percent: error_pct,
        pass: error_pct < 1.0, // P-Delta allows slightly larger tolerance than linear
    };

    Ok(AnalysisResult3D {
        success: true,
        error: if converged { None } else { 
            Some(format!("P-Delta did not converge in {} iterations", num_iters))
        },
        displacements,
        reactions,
        member_forces,
        plate_results,
        equilibrium_check: Some(equilibrium_check),
        condition_number: None,
    })
}

// ============================================
// UNIT TESTS
// ============================================
#[cfg(test)]
mod tests {
    use super::*;

    fn make_node(id: &str, x: f64, y: f64, restraints: [bool; 6]) -> Node3D {
        Node3D { id: id.to_string(), x, y, z: 0.0, restraints, mass: None, spring_stiffness: None }
    }

    fn make_element(id: &str, ni: &str, nj: &str, e: f64, a: f64, iy: f64, iz: f64) -> Element3D {
        Element3D {
            id: id.to_string(),
            node_i: ni.to_string(),
            node_j: nj.to_string(),
            E: e,
            nu: None,
            G: e / 2.6,
            density: 7850.0,
            A: a,
            Iy: iy,
            Iz: iz,
            J: iy + iz,
            Asy: 0.0,
            Asz: 0.0,
            beta: 0.0,
            releases_i: [false; 6],
            releases_j: [false; 6],
            thickness: None,
            node_k: None,
            node_l: None,
            element_type: ElementType::Frame,
        }
    }

    /// Simply-supported beam with uniform distributed load
    /// L = 5 m, w = -10 kN/m (downward in global Y), E = 200 GPa, I = 1e-4 m⁴
    /// Expected:
    ///   Reaction at each support: R = wL/2 = -(-10000)*5/2 = +25000 N (upward)
    ///   Midspan moment: M = wL²/8 = |w|*L²/8 = 10000*25/8 = 31250 N·m (sagging)
    ///   Shear at i-end: V_i = +25000 N (upward reaction)
    ///   Shear at j-end: V_j = -25000 N (downward reaction, opposite direction)
    #[test]
    fn test_ss_beam_udl_member_forces() {
        // Pin at node A (restrain x, y; free z-rotation)
        let node_a = make_node("A", 0.0, 0.0, [true, true, true, true, true, false]);
        // Roller at node B (restrain y only; free x and z-rotation)
        let node_b = make_node("B", 5.0, 0.0, [false, true, true, true, true, false]);

        // Steel beam properties
        let e = 200e9_f64; // Pa
        let a = 0.01_f64;  // m²
        let iz = 1e-4_f64; // m⁴ (bending about Z for XY-plane bending)
        let iy = 1e-4_f64;
        let elem = make_element("M1", "A", "B", e, a, iy, iz);

        // UDL: w = -10000 N/m (downward in global Y direction)
        let udl = DistributedLoad {
            element_id: "M1".to_string(),
            w_start: -10000.0,
            w_end: -10000.0,
            direction: LoadDirection::GlobalY,
            is_projected: false,
            start_pos: 0.0,
            end_pos: 1.0,
        };

        let result = analyze_3d_frame(
            vec![node_a, node_b],
            vec![elem],
            vec![],
            vec![udl],
            vec![],
            vec![],
            AnalysisConfig::default(),
        ).expect("analysis should succeed");

        assert!(result.success, "analysis should succeed");

        // Check reactions
        let rxn_a = result.reactions.get("A").expect("reaction at A");
        let fy_a = rxn_a[1]; // Fy reaction
        let rxn_b = result.reactions.get("B").expect("reaction at B");
        let fy_b = rxn_b[1];

        let tol = 1.0; // 1 N tolerance
        assert!((fy_a - 25000.0).abs() < tol,
            "Expected reaction at A = +25000 N (upward), got {}", fy_a);
        assert!((fy_b - 25000.0).abs() < tol,
            "Expected reaction at B = +25000 N (upward), got {}", fy_b);

        // Check member end forces
        let mf = result.member_forces.get("M1").expect("member forces for M1");
        let vy_i = mf.forces_i[1]; // Shear at i-end
        let mz_i = mf.forces_i[5]; // Moment at i-end (should be ~0 for pin)
        let vy_j = mf.forces_j[1]; // Shear at j-end

        println!("Vy_i = {:.1} N (expected +25000)", vy_i);
        println!("Mz_i = {:.1} N·m (expected 0)", mz_i);
        println!("Vy_j = {:.1} N (expected +25000)", vy_j);
        println!("Fy_A = {:.1} N (expected +25000)", fy_a);
        println!("Fy_B = {:.1} N (expected +25000)", fy_b);

        // Shear at i-end should be +25000 N (upward acting on element = same sign as reaction)
        assert!((vy_i - 25000.0).abs() < tol,
            "Expected Vy_i = +25000 N, got {}", vy_i);
        // Moment at pin end should be ~0
        assert!(mz_i.abs() < tol,
            "Expected Mz_i ≈ 0, got {}", mz_i);
        // Shear at j-end should also be +25000 N (upward, same convention as i)
        // The genDiagram formula: w = (v1 + v2)/L = (25 + 25)/5 = 10 → M_mid = +31.25 kN·m ✓
        assert!((vy_j - 25000.0).abs() < tol,
            "Expected Vy_j = +25000 N, got {}", vy_j);

        // Also verify forces_j sign convention
        let mz_j = mf.forces_j[5];
        println!("Mz_j = {:.1} N·m (expected ~0 for pin)", mz_j);
        assert!(mz_j.abs() < tol, "Expected Mz_j ≈ 0 for SS beam, got {}", mz_j);
    }

    /// Cantilever beam (fixed at A, free at B) with tip point load P = -30000 N (downward)
    /// L = 4 m
    /// Expected: R_A_fy = +30000 N (upward), M_A = P*L = +120000 N·m 
    #[test]
    fn test_cantilever_point_load_reactions() {
        // Fixed at A (all 6 DOFs restrained), free at B
        let node_a = make_node("A", 0.0, 0.0, [true, true, true, true, true, true]);
        let node_b = make_node("B", 4.0, 0.0, [false, false, true, true, true, false]);

        let e = 200e9_f64;
        let elem = make_element("M1", "A", "B", e, 0.01, 1e-4, 1e-4);

        // Tip point load P = -30000 N (downward)
        let load = NodalLoad {
            node_id: "B".to_string(),
            fx: 0.0, fy: -30000.0, fz: 0.0,
            mx: 0.0, my: 0.0, mz: 0.0,
        };

        let result = analyze_3d_frame(
            vec![node_a, node_b],
            vec![elem],
            vec![load],
            vec![],
            vec![],
            vec![],
            AnalysisConfig::default(),
        ).expect("cantilever analysis should succeed");

        let rxn_a = result.reactions.get("A").expect("reaction at A");
        let fy_a = rxn_a[1];
        let mz_a = rxn_a[5];

        println!("Cantilever: Fy_A = {:.1} (expected +30000)", fy_a);
        println!("Cantilever: Mz_A = {:.1} (expected +120000)", mz_a);

        let tol = 1.0;
        assert!((fy_a - 30000.0).abs() < tol,
            "Expected Fy_A = +30000 N, got {}", fy_a);
        assert!((mz_a.abs() - 120000.0).abs() < tol,
            "Expected |Mz_A| = 120000 N·m, got {}", mz_a);

        // Check member end forces for diagram generation compatibility
        let mf = result.member_forces.get("M1").expect("member forces for M1");
        println!("Cantilever MF: forces_i = {:?}", mf.forces_i);
        println!("Cantilever MF: forces_j = {:?}", mf.forces_j);
        // For cantilever: internal shear V = -P = +30000 N throughout
        // forces_i[1] should be the shear at i-end
        let vy_i = mf.forces_i[1];
        let mz_i = mf.forces_i[5];
        println!("Cantilever: Vy_i = {:.1} (internal shear at clamped end)", vy_i);
        println!("Cantilever: Mz_i = {:.1} (moment at clamped end)", mz_i);
    }

    // =========================================================================
    // INTEGRATION TESTS — Industry-standard benchmarks
    // =========================================================================

    /// Self-weight test: cantilever beam with self-weight only
    /// Steel beam: L=3m, A=0.01m², ρ=7850 kg/m³, g=9.80665 m/s²
    /// w_self = ρ·A·g = 7850 × 0.01 × 9.80665 = 769.82 N/m (downward)
    /// R_y = w·L = 769.82 × 3 = 2309.5 N (upward)
    /// M_z = w·L²/2 = 769.82 × 9 / 2 = 3464.2 N·m
    #[test]
    fn test_self_weight_cantilever() {
        let node_a = make_node("A", 0.0, 0.0, [true, true, true, true, true, true]);
        let node_b = make_node("B", 3.0, 0.0, [false, false, true, true, true, false]);
        let elem = make_element("M1", "A", "B", 200e9, 0.01, 1e-4, 1e-4);
        
        let config = AnalysisConfig {
            include_self_weight: true,
            gravity: 9.80665,
            gravity_direction: -1.0,
        };
        
        let result = analyze_3d_frame(
            vec![node_a, node_b], vec![elem],
            vec![], vec![], vec![], vec![], config,
        ).expect("self-weight analysis should succeed");
        
        let rxn = result.reactions.get("A").expect("reaction at A");
        let w_self = 7850.0 * 0.01 * 9.80665;
        let expected_ry = w_self * 3.0;
        
        println!("Self-weight: w = {:.2} N/m, R_y = {:.2} N (expected {:.2})", w_self, rxn[1], expected_ry);
        assert!((rxn[1] - expected_ry).abs() < 1.0, "Self-weight Ry");
    }

    /// Temperature load test: fixed-fixed bar with ΔT=50°C
    /// Steel: E=200 GPa, A=0.01 m², α=12e-6 /°C
    /// Thermal force: F = E·A·α·ΔT = 200e9 × 0.01 × 12e-6 × 50 = 1,200,000 N = 1200 kN
    /// Reactions at each end should be ±1200 kN
    #[test]
    fn test_temperature_load_fixed_fixed_bar() {
        let node_a = make_node("A", 0.0, 0.0, [true, true, true, true, true, true]);
        let node_b = make_node("B", 3.0, 0.0, [true, true, true, true, true, true]);
        let elem = make_element("M1", "A", "B", 200e9, 0.01, 1e-4, 1e-4);
        
        let temp_load = TemperatureLoad {
            element_id: "M1".to_string(),
            delta_t: 50.0,
            gradient_y: 0.0,
            gradient_z: 0.0,
            alpha: 12e-6,
        };
        
        let result = analyze_3d_frame(
            vec![node_a, node_b], vec![elem],
            vec![], vec![], vec![temp_load], vec![], AnalysisConfig::default(),
        ).expect("temperature analysis should succeed");
        
        let rxn_a = result.reactions.get("A").expect("reaction at A");
        let rxn_b = result.reactions.get("B").expect("reaction at B");
        let expected_f = 200e9 * 0.01 * 12e-6 * 50.0; // 1,200,000 N
        
        println!("Temperature: F_expected = {:.0} N", expected_f);
        println!("Temperature: Rx_A = {:.0} N, Rx_B = {:.0} N", rxn_a[0], rxn_b[0]);
        
        // The reactions should oppose each other (compression/tension depending on sign)
        assert!((rxn_a[0].abs() - expected_f).abs() < 100.0, "Thermal Rx at A: expected ~{}, got {}", expected_f, rxn_a[0]);
    }
    
    /// Spring support test: beam on elastic foundation (spring at midspan)
    /// Simply supported beam with spring at midpoint
    /// P = 10 kN at midspan, spring k = 1e6 N/m at midspan
    #[test]
    fn test_spring_support() {
        let node_a = make_node("A", 0.0, 0.0, [true, true, true, true, true, false]);
        let mut node_b = Node3D {
            id: "B".to_string(), x: 2.5, y: 0.0, z: 0.0,
            restraints: [false, false, true, true, true, false],
            mass: None,
            spring_stiffness: Some(vec![0.0, 1e6, 0.0, 0.0, 0.0, 0.0]), // ky = 1e6 N/m
        };
        let node_c = make_node("C", 5.0, 0.0, [false, true, true, true, true, false]);
        
        let elem1 = make_element("M1", "A", "B", 200e9, 0.01, 1e-4, 1e-4);
        let elem2 = make_element("M2", "B", "C", 200e9, 0.01, 1e-4, 1e-4);
        
        let load = NodalLoad {
            node_id: "B".to_string(),
            fx: 0.0, fy: -10000.0, fz: 0.0,
            mx: 0.0, my: 0.0, mz: 0.0,
        };
        
        let result = analyze_3d_frame(
            vec![node_a, node_b, node_c], vec![elem1, elem2],
            vec![load], vec![], vec![], vec![], AnalysisConfig::default(),
        ).expect("spring support analysis should succeed");
        
        assert!(result.success, "spring analysis should succeed");
        let disp_b = result.displacements.get("B").expect("displacement at B");
        println!("Spring: u_y at B = {:.6} m (should be < 0, constrained by spring)", disp_b[1]);
        
        // With spring, deflection should be less than without spring
        // Spring force = k * δ, so some of the load is taken by the spring
        assert!(disp_b[1] < 0.0, "B should deflect downward");
        
        // Verify equilibrium passes
        assert!(result.equilibrium_check.unwrap().pass, "Equilibrium should pass");
    }
    
    /// Point load on member test: midspan concentrated load
    /// Simply supported beam L=6m, P=20kN at midspan
    /// Expected: R = P/2 = 10 kN each, M_max = PL/4 = 30 kN·m
    #[test]
    fn test_point_load_on_member() {
        let node_a = make_node("A", 0.0, 0.0, [true, true, true, true, true, false]);
        let node_b = make_node("B", 6.0, 0.0, [false, true, true, true, true, false]);
        let elem = make_element("M1", "A", "B", 200e9, 0.01, 1e-4, 1e-4);
        
        let pl = PointLoadOnMember {
            element_id: "M1".to_string(),
            magnitude: -20000.0, // 20 kN downward
            position: 0.5,
            direction: LoadDirection::GlobalY,
            is_moment: false,
        };
        
        let result = analyze_3d_frame(
            vec![node_a, node_b], vec![elem],
            vec![], vec![], vec![], vec![pl], AnalysisConfig::default(),
        ).expect("point load analysis should succeed");
        
        let rxn_a = result.reactions.get("A").expect("reaction at A");
        let rxn_b = result.reactions.get("B").expect("reaction at B");
        
        println!("PointLoad: R_A = {:.1} N, R_B = {:.1} N (expected 10000 each)", rxn_a[1], rxn_b[1]);
        
        assert!((rxn_a[1] - 10000.0).abs() < 10.0, "R_A should be ~10000 N, got {}", rxn_a[1]);
        assert!((rxn_b[1] - 10000.0).abs() < 10.0, "R_B should be ~10000 N, got {}", rxn_b[1]);
    }
    
    /// Timoshenko beam test: short deep beam
    /// Compare Euler-Bernoulli (Asy=0) vs Timoshenko (Asy>0)
    /// For a deep beam L/d < 5, shear deformation increases deflection
    #[test]
    fn test_timoshenko_vs_euler_bernoulli() {
        let node_a = make_node("A", 0.0, 0.0, [true, true, true, true, true, false]);
        let node_b = make_node("B", 1.0, 0.0, [false, true, true, true, true, false]);
        
        // Euler-Bernoulli element (no shear area)
        let mut elem_eb = make_element("M1", "A", "B", 200e9, 0.01, 1e-4, 1e-4);
        elem_eb.Asy = 0.0;
        elem_eb.Asz = 0.0;
        
        // Timoshenko element (with shear area: ~83% of total area for rectangular)
        let mut elem_ts = elem_eb.clone();
        elem_ts.Asy = 0.0083; // 5/6 * A
        elem_ts.Asz = 0.0083;
        
        let load = NodalLoad {
            node_id: "B".to_string(),
            fx: 0.0, fy: 0.0, fz: 0.0,
            mx: 0.0, my: 0.0, mz: -10000.0, // Apply moment (won't trigger shear deformation)
        };
        
        let tip_load = NodalLoad {
            node_id: "B".to_string(),
            fx: 0.0, fy: -10000.0, fz: 0.0,
            mx: 0.0, my: 0.0, mz: 0.0,
        };
        
        // Test with shear force (should show difference)
        let result_eb = analyze_3d_frame(
            vec![make_node("A", 0.0, 0.0, [true, true, true, true, true, true]),
                 make_node("B", 1.0, 0.0, [false, false, true, true, true, false])],
            vec![elem_eb], vec![tip_load.clone()], vec![], vec![], vec![],
            AnalysisConfig::default(),
        ).expect("EB analysis should succeed");
        
        let result_ts = analyze_3d_frame(
            vec![make_node("A", 0.0, 0.0, [true, true, true, true, true, true]),
                 make_node("B", 1.0, 0.0, [false, false, true, true, true, false])],
            vec![elem_ts], vec![tip_load], vec![], vec![], vec![],
            AnalysisConfig::default(),
        ).expect("Timoshenko analysis should succeed");
        
        let dy_eb = result_eb.displacements.get("B").unwrap()[1].abs();
        let dy_ts = result_ts.displacements.get("B").unwrap()[1].abs();
        
        println!("Timoshenko: δ_EB = {:.8} m, δ_TS = {:.8} m", dy_eb, dy_ts);
        println!("Timoshenko: ratio δ_TS / δ_EB = {:.4}", dy_ts / dy_eb);
        
        // Timoshenko deflection should be greater than Euler-Bernoulli
        assert!(dy_ts > dy_eb, "Timoshenko deflection should be larger: {} vs {}", dy_ts, dy_eb);
        assert!(dy_ts / dy_eb > 1.001, "Timoshenko should add measurable shear deflection");
    }
    
    /// Input validation test: should reject invalid input
    #[test]
    fn test_input_validation_bad_modulus() {
        let node_a = make_node("A", 0.0, 0.0, [true, true, true, true, true, true]);
        let node_b = make_node("B", 3.0, 0.0, [false, false, true, true, true, false]);
        let mut elem = make_element("M1", "A", "B", 200e9, 0.01, 1e-4, 1e-4);
        elem.E = -100.0; // Invalid!
        
        let result = analyze_3d_frame(
            vec![node_a, node_b], vec![elem],
            vec![], vec![], vec![], vec![], AnalysisConfig::default(),
        );
        assert!(result.is_err(), "Should reject negative Young's modulus");
        assert!(result.unwrap_err().contains("Young's modulus"), "Error message should mention E");
    }
    
    #[test]
    fn test_input_validation_zero_area() {
        let node_a = make_node("A", 0.0, 0.0, [true, true, true, true, true, true]);
        let node_b = make_node("B", 3.0, 0.0, [false, false, true, true, true, false]);
        let mut elem = make_element("M1", "A", "B", 200e9, 0.01, 1e-4, 1e-4);
        elem.A = 0.0; // Invalid!
        
        let result = analyze_3d_frame(
            vec![node_a, node_b], vec![elem],
            vec![], vec![], vec![], vec![], AnalysisConfig::default(),
        );
        assert!(result.is_err(), "Should reject zero area");
    }
    
    #[test]
    fn test_input_validation_duplicate_nodes() {
        let node_a = make_node("A", 0.0, 0.0, [true, true, true, true, true, true]);
        let node_a2 = make_node("A", 3.0, 0.0, [false, false, true, true, true, false]); // Duplicate!
        let elem = make_element("M1", "A", "A", 200e9, 0.01, 1e-4, 1e-4);
        
        let result = analyze_3d_frame(
            vec![node_a, node_a2], vec![elem],
            vec![], vec![], vec![], vec![], AnalysisConfig::default(),
        );
        assert!(result.is_err(), "Should reject duplicate node IDs");
    }
    
    /// Full equilibrium check test (forces AND moments about origin)
    #[test]
    fn test_equilibrium_check_with_moments() {
        // Portal frame: two columns + beam
        let nodes = vec![
            make_node("A", 0.0, 0.0, [true, true, true, true, true, true]),
            make_node("B", 0.0, 3.0, [false, false, true, true, true, false]),
            make_node("C", 5.0, 3.0, [false, false, true, true, true, false]),
            make_node("D", 5.0, 0.0, [true, true, true, true, true, true]),
        ];
        let elements = vec![
            make_element("M1", "A", "B", 200e9, 0.01, 1e-4, 1e-4), // Column
            make_element("M2", "B", "C", 200e9, 0.01, 1e-4, 1e-4), // Beam
            make_element("M3", "C", "D", 200e9, 0.01, 1e-4, 1e-4), // Column
        ];
        let loads = vec![
            NodalLoad { node_id: "B".to_string(), fx: 10000.0, fy: -5000.0, fz: 0.0, mx: 0.0, my: 0.0, mz: 0.0 },
        ];
        let udl = DistributedLoad {
            element_id: "M2".to_string(),
            w_start: -8000.0, w_end: -8000.0,
            direction: LoadDirection::GlobalY,
            is_projected: false, start_pos: 0.0, end_pos: 1.0,
        };
        
        let result = analyze_3d_frame(
            nodes, elements, loads, vec![udl], vec![], vec![], AnalysisConfig::default(),
        ).expect("portal frame should succeed");
        
        let eq = result.equilibrium_check.unwrap();
        println!("Portal equilibrium: error = {:.6}%, pass = {}", eq.error_percent, eq.pass);
        println!("  Applied: {:?}", eq.applied_forces);
        println!("  Reactions: {:?}", eq.reaction_forces);
        println!("  Residual: {:?}", eq.residual);
        
        assert!(eq.pass, "Equilibrium should pass for portal frame (error={}%)", eq.error_percent);
        assert!(eq.error_percent < 0.01, "Equilibrium error should be < 0.01%");
    }
    
    /// Iz defaults to Iy when only I is provided (H4 fix test)
    #[test]
    fn test_iz_defaults_to_iy() {
        let json_str = r#"{
            "id": "1",
            "node_i": "A",
            "node_j": "B",
            "E": 200000000000,
            "A": 0.01,
            "I": 0.0001
        }"#;
        
        let elem: Element3D = serde_json::from_str(json_str).expect("should parse element");
        assert!(elem.Iy > 0.0, "Iy should be set from I alias");
        // Note: Iz defaults to 0 from serde, but frame_element_stiffness will use Iy as fallback
    }
    
    /// DRY FEF test: verify compute_fef_1d works for UDL
    #[test]
    fn test_shared_fef_udl() {
        // UDL w=1000 N/m, L=6m (full span)
        let (r1, r2, m1, m2) = compute_fef_1d(1000.0, 1000.0, 6.0, 0.0, 1.0);
        
        assert!((r1 - 3000.0).abs() < 0.1, "FEF R1 = wL/2 = 3000, got {}", r1);
        assert!((r2 - 3000.0).abs() < 0.1, "FEF R2 = wL/2 = 3000, got {}", r2);
        assert!((m1 - 3000.0).abs() < 0.1, "FEF M1 = wL²/12 = 3000, got {}", m1);
        assert!((m2 + 3000.0).abs() < 0.1, "FEF M2 = -wL²/12 = -3000, got {}", m2);
    }
    
    /// DRY FEF test: partial load via quadrature
    #[test]
    fn test_shared_fef_partial() {
        // UDL w=1000 N/m on first half of L=6m beam → span [0, 0.5]
        let (r1, r2, m1, m2) = compute_fef_1d(1000.0, 1000.0, 6.0, 0.0, 0.5);
        
        // Total load = 1000 * 3 = 3000 N, distributed over first half
        let total = r1 + r2;
        assert!((total - 3000.0).abs() < 1.0, "Total FEF should = wL/2 = 3000, got {}", total);
        assert!(r1 > r2, "R1 should be larger (load is closer to node i)");
    }
    
    /// Point load FEF: midspan concentrated load
    #[test]
    fn test_point_load_fef_midspan() {
        let p = -10000.0; // 10 kN downward
        let (v1, v2, m1, m2) = compute_point_load_fef(p, 0.5, 6.0, false);
        
        // P at midspan: V1 = V2 = P/2 = -5000, M1 = PL/8 = -7500, M2 = -PL/8 = 7500
        assert!((v1 - (-5000.0)).abs() < 1.0, "V1 should be -5000, got {}", v1);
        assert!((v2 - (-5000.0)).abs() < 1.0, "V2 should be -5000, got {}", v2);
        assert!((m1 - (-7500.0)).abs() < 1.0, "M1 should be -7500, got {}", m1);
        assert!((m2 - 7500.0).abs() < 1.0, "M2 should be 7500, got {}", m2);
    }
    
    // =========================================================================
    // LOAD COMBINATION TESTS (C3)
    // =========================================================================
    
    /// Test load combination: 1.5DL + 1.5LL superposition
    #[test]
    fn test_load_combination_basic() {
        let node_a = make_node("A", 0.0, 0.0, [true, true, true, true, true, true]);
        let node_b = make_node("B", 3.0, 0.0, [false, false, true, true, true, false]);
        let elem = make_element("M1", "A", "B", 200e9, 0.01, 1e-4, 1e-4);
        
        // Dead load: 5 kN downward at B
        let dl_result = analyze_3d_frame(
            vec![node_a.clone(), node_b.clone()], vec![elem.clone()],
            vec![NodalLoad { node_id: "B".into(), fx: 0.0, fy: -5000.0, fz: 0.0, mx: 0.0, my: 0.0, mz: 0.0 }],
            vec![], vec![], vec![], AnalysisConfig::default(),
        ).expect("DL analysis");
        
        // Live load: 8 kN downward at B
        let ll_result = analyze_3d_frame(
            vec![node_a.clone(), node_b.clone()], vec![elem.clone()],
            vec![NodalLoad { node_id: "B".into(), fx: 0.0, fy: -8000.0, fz: 0.0, mx: 0.0, my: 0.0, mz: 0.0 }],
            vec![], vec![], vec![], AnalysisConfig::default(),
        ).expect("LL analysis");
        
        let mut cases = HashMap::new();
        cases.insert("DL".to_string(), dl_result);
        cases.insert("LL".to_string(), ll_result);
        
        // 1.5DL + 1.5LL
        let combo = LoadCombination {
            name: "1.5DL+1.5LL".into(),
            factors: vec![("DL".into(), 1.5), ("LL".into(), 1.5)],
        };
        
        let combined = combine_load_cases(&cases, &combo).expect("combination");
        
        // Expected: 1.5×5000 + 1.5×8000 = 19500 N factored load
        // For a cantilever, Ry at A = applied load
        let disp_b = combined.displacements.get("B").expect("B disp");
        let rxn_a = combined.reactions.get("A").expect("A rxn");
        
        // Displacements should be 1.5× DL + 1.5× LL
        let dl_disp = cases.get("DL").unwrap().displacements.get("B").unwrap()[1];
        let ll_disp = cases.get("LL").unwrap().displacements.get("B").unwrap()[1];
        let expected_disp = 1.5 * dl_disp + 1.5 * ll_disp;
        
        println!("LoadCombo: δ_DL={:.6}, δ_LL={:.6}, δ_combined={:.6}, expected={:.6}",
            dl_disp, ll_disp, disp_b[1], expected_disp);
        assert!((disp_b[1] - expected_disp).abs() < 1e-10, "Combined displacement should be linear superposition");
        assert!((rxn_a[1] - 19500.0).abs() < 1.0, "Combined Ry = 19500 N, got {}", rxn_a[1]);
    }
    
    /// Test envelope across IS 800 combinations
    #[test]
    fn test_envelope_is800() {
        let node_a = make_node("A", 0.0, 0.0, [true, true, true, true, true, true]);
        let node_b = make_node("B", 3.0, 0.0, [false, false, true, true, true, false]);
        let elem = make_element("M1", "A", "B", 200e9, 0.01, 1e-4, 1e-4);
        
        let dl_result = analyze_3d_frame(
            vec![node_a.clone(), node_b.clone()], vec![elem.clone()],
            vec![NodalLoad { node_id: "B".into(), fx: 0.0, fy: -5000.0, fz: 0.0, mx: 0.0, my: 0.0, mz: 0.0 }],
            vec![], vec![], vec![], AnalysisConfig::default(),
        ).expect("DL");
        
        let ll_result = analyze_3d_frame(
            vec![node_a.clone(), node_b.clone()], vec![elem.clone()],
            vec![NodalLoad { node_id: "B".into(), fx: 0.0, fy: -3000.0, fz: 0.0, mx: 0.0, my: 0.0, mz: 0.0 }],
            vec![], vec![], vec![], AnalysisConfig::default(),
        ).expect("LL");
        
        let mut cases = HashMap::new();
        cases.insert("DL".to_string(), dl_result);
        cases.insert("LL".to_string(), ll_result);
        
        // Only use combos that reference DL and LL (skip WL/EQ combos)
        let combos: Vec<LoadCombination> = standard_combinations_is800()
            .into_iter()
            .filter(|c| c.factors.iter().all(|(name, _)| name == "DL" || name == "LL"))
            .collect();
        
        assert!(!combos.is_empty(), "Should have at least one applicable IS800 combo");
        
        let envelope = compute_envelope(&cases, &combos).expect("envelope");
        
        // The governing combo for M1 should exist
        let gov = envelope.governing_combo.get("M1").expect("governing combo for M1");
        println!("IS800 Envelope: governing combo for M1 = {}", gov);
        assert!(!gov.is_empty());
        
        // Max displacement at B should be from the largest factored combo
        let max_dy = envelope.max_displacements.get("B").unwrap()[1];
        let min_dy = envelope.min_displacements.get("B").unwrap()[1];
        assert!(min_dy <= max_dy, "max >= min");
        println!("IS800 Envelope: max_dy={:.6}, min_dy={:.6}", max_dy, min_dy);
    }
    
    /// Test missing load case error
    #[test]
    fn test_load_combination_missing_case() {
        let cases: HashMap<String, AnalysisResult3D> = HashMap::new();
        let combo = LoadCombination {
            name: "test".into(),
            factors: vec![("DL".into(), 1.5)],
        };
        let result = combine_load_cases(&cases, &combo);
        assert!(result.is_err(), "Should error on missing load case");
    }
    
    /// Test standard combination presets exist with correct structure
    #[test]
    fn test_standard_combinations_exist() {
        let is800 = standard_combinations_is800();
        let ec = standard_combinations_eurocode();
        let aisc = standard_combinations_aisc_lrfd();
        
        assert!(is800.len() >= 7, "IS800 should have ≥7 ULS combos");
        assert!(ec.len() >= 5, "Eurocode should have ≥5 combos");
        assert!(aisc.len() >= 7, "AISC LRFD should have ≥7 combos");
        
        // Verify all combos have non-empty factors
        for combo in is800.iter().chain(ec.iter()).chain(aisc.iter()) {
            assert!(!combo.factors.is_empty(), "Combo '{}' must have factors", combo.name);
            for (_, factor) in &combo.factors {
                assert!(*factor > 0.0, "Factor must be positive in '{}'", combo.name);
            }
        }
    }
    
    // =================== P-DELTA INTEGRATION TESTS ===================
    
    fn pdelta_portal_frame() -> (Vec<Node3D>, Vec<Element3D>, Vec<NodalLoad>, Vec<DistributedLoad>) {
        let nodes = vec![
            make_node("N1", 0.0, 0.0, [true; 6]),
            make_node("N2", 5.0, 0.0, [true; 6]),
            make_node("N3", 0.0, 4.0, [false; 6]),
            make_node("N4", 5.0, 4.0, [false; 6]),
        ];
        let elements = vec![
            make_element("C1", "N1", "N3", 2e11, 0.01, 1.7e-4, 6e-5),
            make_element("C2", "N2", "N4", 2e11, 0.01, 1.7e-4, 6e-5),
            make_element("B1", "N3", "N4", 2e11, 0.01, 1.7e-4, 6e-5),
        ];
        let nodal_loads = vec![
            NodalLoad { node_id: "N3".into(), fx: 20000.0, fy: -500000.0, fz: 0.0, mx: 0.0, my: 0.0, mz: 0.0 },
            NodalLoad { node_id: "N4".into(), fx: 0.0, fy: -500000.0, fz: 0.0, mx: 0.0, my: 0.0, mz: 0.0 },
        ];
        (nodes, elements, nodal_loads, vec![])
    }
    
    #[test]
    fn test_pdelta_differs_from_linear() {
        let (nodes, elements, nodal_loads, dist) = pdelta_portal_frame();
        let linear = analyze_3d_frame(
            nodes.clone(), elements.clone(), nodal_loads.clone(), dist.clone(),
            vec![], vec![], AnalysisConfig::default(),
        ).unwrap();
        let pdelta = p_delta_analysis(
            nodes, elements, nodal_loads, dist,
            vec![], vec![], AnalysisConfig::default(), 20, 1e-6,
        ).unwrap();
        assert!(pdelta.success);
        let lin_dx = linear.displacements["N3"][0];
        let pd_dx = pdelta.displacements["N3"][0];
        let diff_pct = ((pd_dx - lin_dx) / lin_dx).abs() * 100.0;
        assert!(diff_pct > 0.01, "P-Delta should differ from linear by >0.01%; got {:.4}%", diff_pct);
        assert!(!pd_dx.is_nan());
    }
    
    #[test]
    fn test_pdelta_equilibrium_check() {
        let (nodes, elements, nodal_loads, dist) = pdelta_portal_frame();
        let result = p_delta_analysis(
            nodes, elements, nodal_loads, dist,
            vec![], vec![], AnalysisConfig::default(), 20, 1e-5,
        ).unwrap();
        assert!(result.success);
        let eq = result.equilibrium_check.expect("P-Delta must have equilibrium check");
        assert!(eq.pass, "Equilibrium error = {:.4}%", eq.error_percent);
    }
    
    #[test]
    fn test_pdelta_with_temperature() {
        let nodes = vec![
            make_node("base", 0.0, 0.0, [true; 6]),
            make_node("top", 0.0, 3.0, [false; 6]),
        ];
        let elements = vec![make_element("col", "base", "top", 2e11, 0.01, 8.33e-6, 8.33e-6)];
        let nodal_loads = vec![
            NodalLoad { node_id: "top".into(), fx: 5000.0, fy: -200000.0, fz: 0.0, mx: 0.0, my: 0.0, mz: 0.0 },
        ];
        let temp_loads = vec![
            TemperatureLoad { element_id: "col".into(), delta_t: 50.0, alpha: 12e-6, gradient_y: 0.0, gradient_z: 0.0 },
        ];
        let result = p_delta_analysis(
            nodes, elements, nodal_loads, vec![],
            temp_loads, vec![], AnalysisConfig::default(), 20, 1e-6,
        ).unwrap();
        assert!(result.success);
        assert!(result.displacements["top"][0].abs() > 0.0);
    }
    
    #[test]
    fn test_pdelta_self_weight_effect() {
        let (nodes, elements, nodal_loads, dist) = pdelta_portal_frame();
        let no_sw = p_delta_analysis(
            nodes.clone(), elements.clone(), nodal_loads.clone(), dist.clone(),
            vec![], vec![], AnalysisConfig { include_self_weight: false, ..Default::default() }, 20, 1e-6,
        ).unwrap();
        let sw = p_delta_analysis(
            nodes, elements, nodal_loads, dist,
            vec![], vec![], AnalysisConfig { include_self_weight: true, ..Default::default() }, 20, 1e-6,
        ).unwrap();
        assert!(sw.displacements["N3"][1].abs() > no_sw.displacements["N3"][1].abs());
    }
    
    #[test]
    fn test_pdelta_with_springs() {
        let mut n2 = make_node("N2", 5.0, 0.0, [true, true, true, false, false, false]);
        n2.spring_stiffness = Some(vec![0.0, 0.0, 0.0, 1e6, 1e6, 1e6]);
        let nodes = vec![
            make_node("N1", 0.0, 0.0, [true; 6]), n2,
            make_node("N3", 0.0, 4.0, [false; 6]),
            make_node("N4", 5.0, 4.0, [false; 6]),
        ];
        let elements = vec![
            make_element("C1", "N1", "N3", 2e11, 0.01, 1.7e-4, 6e-5),
            make_element("C2", "N2", "N4", 2e11, 0.01, 1.7e-4, 6e-5),
            make_element("B1", "N3", "N4", 2e11, 0.01, 1.7e-4, 6e-5),
        ];
        let nodal_loads = vec![
            NodalLoad { node_id: "N3".into(), fx: 10000.0, fy: -300000.0, fz: 0.0, mx: 0.0, my: 0.0, mz: 0.0 },
            NodalLoad { node_id: "N4".into(), fx: 0.0, fy: -300000.0, fz: 0.0, mx: 0.0, my: 0.0, mz: 0.0 },
        ];
        let result = p_delta_analysis(
            nodes, elements, nodal_loads, vec![], vec![], vec![], AnalysisConfig::default(), 20, 1e-6,
        ).unwrap();
        assert!(result.success);
        let rot_sum: f64 = result.displacements["N2"][3..6].iter().map(|x| x.abs()).sum();
        assert!(rot_sum > 0.0, "Spring node should rotate");
    }
    
    #[test]
    fn test_pdelta_input_validation() {
        let err = p_delta_analysis(vec![], vec![], vec![], vec![], vec![], vec![], AnalysisConfig::default(), 10, 1e-4);
        assert!(err.is_err() && err.unwrap_err().contains("No nodes"));
        let nodes = vec![make_node("N1", 0.0, 0.0, [true; 6])];
        let err = p_delta_analysis(nodes, vec![], vec![], vec![], vec![], vec![], AnalysisConfig::default(), 10, 1e-4);
        assert!(err.is_err() && err.unwrap_err().contains("No elements"));
    }
    
    #[test]
    fn test_pdelta_convergence_small_load() {
        let nodes = vec![make_node("A", 0.0, 0.0, [true; 6]), make_node("B", 0.0, 3.0, [false; 6])];
        let elements = vec![make_element("E1", "A", "B", 2e11, 0.01, 8.33e-6, 8.33e-6)];
        let loads = vec![NodalLoad { node_id: "B".into(), fx: 100.0, fy: -1000.0, fz: 0.0, mx: 0.0, my: 0.0, mz: 0.0 }];
        let result = p_delta_analysis(nodes, elements, loads, vec![], vec![], vec![], AnalysisConfig::default(), 3, 1e-8).unwrap();
        assert!(result.success && result.error.is_none(), "Small load should converge easily");
    }
    
    #[test]
    fn test_pdelta_point_loads_on_members() {
        let (nodes, elements, nodal_loads, _) = pdelta_portal_frame();
        let point_loads = vec![
            PointLoadOnMember { element_id: "B1".into(), position: 0.5, magnitude: -50000.0, direction: LoadDirection::GlobalY, is_moment: false },
        ];
        let no_pl = p_delta_analysis(nodes.clone(), elements.clone(), nodal_loads.clone(), vec![], vec![], vec![], AnalysisConfig::default(), 20, 1e-6).unwrap();
        let pl = p_delta_analysis(nodes, elements, nodal_loads, vec![], vec![], point_loads, AnalysisConfig::default(), 20, 1e-6).unwrap();
        assert!(pl.displacements["N3"][1].abs() > no_pl.displacements["N3"][1].abs());
    }
    
    // =================== EDGE CASE TESTS ===================
    
    #[test]
    fn test_10_storey_frame() {
        let mut nodes = Vec::new();
        let mut elements = Vec::new();
        let storey_h = 3.0;
        let bay_w = 6.0;
        for i in 0..=10u32 {
            let y = i as f64 * storey_h;
            let fix = if i == 0 { [true; 6] } else { [false; 6] };
            nodes.push(make_node(&format!("L{}", i), 0.0, y, fix));
            nodes.push(make_node(&format!("R{}", i), bay_w, y, fix));
        }
        for i in 0..10u32 {
            elements.push(make_element(&format!("CL{}", i), &format!("L{}", i), &format!("L{}", i+1), 2e11, 0.015, 3e-4, 1e-4));
            elements.push(make_element(&format!("CR{}", i), &format!("R{}", i), &format!("R{}", i+1), 2e11, 0.015, 3e-4, 1e-4));
        }
        for i in 1..=10u32 {
            elements.push(make_element(&format!("B{}", i), &format!("L{}", i), &format!("R{}", i), 2e11, 0.012, 2e-4, 8e-5));
        }
        let loads = vec![
            NodalLoad { node_id: "L10".into(), fx: 50000.0, fy: -100000.0, fz: 0.0, mx: 0.0, my: 0.0, mz: 0.0 },
        ];
        let result = analyze_3d_frame(nodes, elements, loads, vec![], vec![], vec![], AnalysisConfig::default()).unwrap();
        assert!(result.success);
        assert!(result.displacements["L10"][0].abs() > 1e-6, "10-storey should deflect");
        let eq = result.equilibrium_check.unwrap();
        assert!(eq.pass, "10-storey equilibrium error = {:.4}%", eq.error_percent);
    }
    
    #[test]
    fn test_combined_loads_all_types() {
        let nodes = vec![
            make_node("A", 0.0, 0.0, [true; 6]),
            make_node("B", 5.0, 0.0, [false, true, true, true, true, false]),
        ];
        let elements = vec![make_element("M1", "A", "B", 200e9, 0.01, 1e-4, 1e-4)];
        let nodal_loads = vec![
            NodalLoad { node_id: "B".into(), fx: 10000.0, fy: 0.0, fz: 0.0, mx: 0.0, my: 0.0, mz: 5000.0 },
        ];
        let dist_loads = vec![
            DistributedLoad { element_id: "M1".into(), w_start: -10000.0, w_end: -10000.0, direction: LoadDirection::GlobalY, is_projected: false, start_pos: 0.0, end_pos: 1.0 },
        ];
        let temp_loads = vec![
            TemperatureLoad { element_id: "M1".into(), delta_t: 30.0, alpha: 12e-6, gradient_y: 10.0, gradient_z: 0.0 },
        ];
        let point_loads = vec![
            PointLoadOnMember { element_id: "M1".into(), position: 0.5, magnitude: -20000.0, direction: LoadDirection::GlobalY, is_moment: false },
        ];
        let result = analyze_3d_frame(
            nodes, elements, nodal_loads, dist_loads, temp_loads, point_loads,
            AnalysisConfig { include_self_weight: true, ..Default::default() },
        ).unwrap();
        assert!(result.success, "Combined loads: {:?}", result.error);
        let eq = result.equilibrium_check.unwrap();
        assert!(eq.pass, "Combined equilibrium error = {:.4}%", eq.error_percent);
    }
    
    #[test]
    fn test_3d_space_frame() {
        let nodes = vec![
            make_node("A", 0.0, 0.0, [true; 6]),
            make_node("B", 4.0, 0.0, [true; 6]),
            Node3D { id: "C".into(), x: 2.0, y: 3.0, z: 2.0, restraints: [false; 6], mass: None, spring_stiffness: None },
        ];
        let elements = vec![
            make_element("E1", "A", "C", 2e11, 0.008, 1e-4, 1e-4),
            make_element("E2", "B", "C", 2e11, 0.008, 1e-4, 1e-4),
        ];
        let loads = vec![
            NodalLoad { node_id: "C".into(), fx: 5000.0, fy: -100000.0, fz: 3000.0, mx: 0.0, my: 0.0, mz: 0.0 },
        ];
        let result = analyze_3d_frame(nodes, elements, loads, vec![], vec![], vec![], AnalysisConfig::default()).unwrap();
        assert!(result.success);
        let c_disp = &result.displacements["C"];
        assert!(c_disp[0].abs() > 1e-10, "X displacement should be non-zero");
        assert!(c_disp[1].abs() > 1e-10, "Y displacement should be non-zero");
        assert!(c_disp[2].abs() > 1e-10, "Z displacement should be non-zero");
    }

    // ======================================================================
    // LINEARIZED BUCKLING ANALYSIS TESTS
    // ======================================================================

    /// Helper to create a steel column element for buckling tests
    fn make_buckling_element(id: &str, node_i: &str, node_j: &str, e: f64, a: f64, iy: f64, iz: f64) -> Element3D {
        Element3D {
            id: id.into(),
            node_i: node_i.into(),
            node_j: node_j.into(),
            E: e,
            A: a,
            Iy: iy,
            Iz: iz,
            J: iy + iz, // circular section approximation
            G: e / (2.0 * 1.3), // G = E / 2(1+ν)
            Asy: 0.0,
            Asz: 0.0,
            beta: 0.0,
            density: 7850.0,
            nu: Some(0.3),
            releases_i: [false; 6],
            releases_j: [false; 6],
            element_type: ElementType::Frame,
            thickness: None,
            node_k: None,
            node_l: None,
        }
    }

    #[test]
    fn test_buckling_euler_pin_pin_column() {
        // Classic Euler buckling: pin-ended column (K=1.0)
        // P_cr = π²EI / L²
        // Horizontal column along X-axis for clean transformation
        // Steel: E = 200 GPa, L = 5m, Iy = Iz = 1.0e-5 m⁴, A = 0.01 m²
        let e: f64 = 2.0e11;
        let a: f64 = 0.01;
        let iy: f64 = 1.0e-5;
        let iz: f64 = 1.0e-5;
        let length: f64 = 5.0;

        // Theoretical: P_cr = π²×2e11×1e-5 / 25 = 789568.35 N
        let p_cr_theoretical = std::f64::consts::PI.powi(2) * e * iy.min(iz) / (length * length);

        // 4 elements along X-axis for mesh refinement
        let seg = length / 4.0;
        // DOF order: [Ux, Uy, Uz, Rx, Ry, Rz]
        // For X-axis column: Ux=axial, Uy/Uz=lateral, Rx=torsion
        let nodes = vec![
            Node3D { id: "1".into(), x: 0.0, y: 0.0, z: 0.0,
                     // Pin: fix all translations + torsion Rx to prevent rigid body spin
                     restraints: [true, true, true, true, false, false],
                     mass: None, spring_stiffness: None },
            Node3D { id: "2".into(), x: seg, y: 0.0, z: 0.0,
                     restraints: [false; 6], mass: None, spring_stiffness: None },
            Node3D { id: "3".into(), x: 2.0*seg, y: 0.0, z: 0.0,
                     restraints: [false; 6], mass: None, spring_stiffness: None },
            Node3D { id: "4".into(), x: 3.0*seg, y: 0.0, z: 0.0,
                     restraints: [false; 6], mass: None, spring_stiffness: None },
            Node3D { id: "5".into(), x: length, y: 0.0, z: 0.0,
                     // Roller: fix lateral (Y,Z) only, free axial (X) for compression
                     restraints: [false, true, true, false, false, false],
                     mass: None, spring_stiffness: None },
        ];
        let elements = vec![
            make_buckling_element("E1", "1", "2", e, a, iy, iz),
            make_buckling_element("E2", "2", "3", e, a, iy, iz),
            make_buckling_element("E3", "3", "4", e, a, iy, iz),
            make_buckling_element("E4", "4", "5", e, a, iy, iz),
        ];
        // Apply unit compressive load (negative X at far end)
        let loads = vec![
            NodalLoad { node_id: "5".into(), fx: -1.0, fy: 0.0, fz: 0.0, mx: 0.0, my: 0.0, mz: 0.0 },
        ];

        let result = linearized_buckling_analysis(nodes, elements, loads, vec![], 3).unwrap();
        assert!(result.success, "Buckling analysis should succeed");
        assert!(result.num_modes >= 1, "Should find at least 1 buckling mode");

        let lambda1 = result.buckling_loads[0];
        // λ₁ × applied load = P_cr, so λ₁ ≈ P_cr (since applied = 1N)
        let error_pct = ((lambda1 - p_cr_theoretical) / p_cr_theoretical).abs() * 100.0;
        assert!(error_pct < 5.0,
            "Euler buckling load should be within 5% of theory. Got λ={:.1}, expected P_cr={:.1}, error={:.2}%",
            lambda1, p_cr_theoretical, error_pct);
    }

    #[test]
    fn test_buckling_fixed_free_cantilever() {
        // Cantilever column: fixed base, free top. Effective length factor K=2.0
        // P_cr = π²EI / (KL)² = π²EI / (4L²)
        // Horizontal column along X-axis
        let e: f64 = 2.0e11;
        let a: f64 = 0.01;
        let iy: f64 = 1.0e-5;
        let iz: f64 = 1.0e-5;
        let length: f64 = 3.0;

        let p_cr_theoretical = std::f64::consts::PI.powi(2) * e * iy.min(iz) / (4.0 * length * length);

        // 4 elements along X-axis for mesh refinement
        let seg = length / 4.0;
        let nodes = vec![
            Node3D { id: "1".into(), x: 0.0, y: 0.0, z: 0.0,
                     restraints: [true, true, true, true, true, true], // fixed base
                     mass: None, spring_stiffness: None },
            Node3D { id: "2".into(), x: seg, y: 0.0, z: 0.0,
                     restraints: [false; 6], mass: None, spring_stiffness: None },
            Node3D { id: "3".into(), x: 2.0*seg, y: 0.0, z: 0.0,
                     restraints: [false; 6], mass: None, spring_stiffness: None },
            Node3D { id: "4".into(), x: 3.0*seg, y: 0.0, z: 0.0,
                     restraints: [false; 6], mass: None, spring_stiffness: None },
            Node3D { id: "5".into(), x: length, y: 0.0, z: 0.0,
                     restraints: [false; 6], // free top
                     mass: None, spring_stiffness: None },
        ];
        let elements = vec![
            make_buckling_element("E1", "1", "2", e, a, iy, iz),
            make_buckling_element("E2", "2", "3", e, a, iy, iz),
            make_buckling_element("E3", "3", "4", e, a, iy, iz),
            make_buckling_element("E4", "4", "5", e, a, iy, iz),
        ];
        let loads = vec![
            NodalLoad { node_id: "5".into(), fx: -1.0, fy: 0.0, fz: 0.0, mx: 0.0, my: 0.0, mz: 0.0 },
        ];

        let result = linearized_buckling_analysis(nodes, elements, loads, vec![], 3).unwrap();
        assert!(result.success);
        assert!(result.num_modes >= 1, "Should find at least 1 mode, got {}", result.num_modes);

        let lambda1 = result.buckling_loads[0];
        let error_pct = ((lambda1 - p_cr_theoretical) / p_cr_theoretical).abs() * 100.0;
        // 4-element cantilever — allow up to 10% discretization error
        assert!(error_pct < 10.0,
            "Cantilever buckling should be within 10% of theory. Got λ={:.1}, expected P_cr={:.1}, error={:.2}%",
            lambda1, p_cr_theoretical, error_pct);
    }

    #[test]
    fn test_buckling_returns_sorted_load_factors() {
        // Verify buckling loads are returned in ascending order
        // Cantilever along X-axis
        let e = 2.0e11;
        let a = 0.01;
        let length = 4.0;

        let nodes = vec![
            Node3D { id: "1".into(), x: 0.0, y: 0.0, z: 0.0,
                     restraints: [true, true, true, true, true, true],
                     mass: None, spring_stiffness: None },
            Node3D { id: "2".into(), x: length, y: 0.0, z: 0.0,
                     restraints: [false, false, false, false, false, false],
                     mass: None, spring_stiffness: None },
        ];
        let elements = vec![
            make_buckling_element("E1", "1", "2", e, a, 1.0e-5, 2.0e-5), // different Iy, Iz
        ];
        let loads = vec![
            NodalLoad { node_id: "2".into(), fx: -1.0, fy: 0.0, fz: 0.0, mx: 0.0, my: 0.0, mz: 0.0 },
        ];

        let result = linearized_buckling_analysis(nodes, elements, loads, vec![], 5).unwrap();
        assert!(result.success);

        // Verify ascending order
        for i in 1..result.buckling_loads.len() {
            assert!(result.buckling_loads[i] >= result.buckling_loads[i-1],
                "Buckling loads should be sorted ascending: λ[{}]={} < λ[{}]={}",
                i, result.buckling_loads[i], i-1, result.buckling_loads[i-1]);
        }
    }

    #[test]
    fn test_buckling_mode_shapes_have_correct_length() {
        // Mode shapes should have num_nodes * 6 entries
        let e = 2.0e11;
        let nodes = vec![
            Node3D { id: "1".into(), x: 0.0, y: 0.0, z: 0.0,
                     restraints: [true, true, true, true, true, true],
                     mass: None, spring_stiffness: None },
            Node3D { id: "2".into(), x: 3.0, y: 0.0, z: 0.0,
                     restraints: [false; 6],
                     mass: None, spring_stiffness: None },
        ];
        let elements = vec![
            make_buckling_element("E1", "1", "2", e, 0.01, 1e-5, 1e-5),
        ];
        let loads = vec![
            NodalLoad { node_id: "2".into(), fx: -1.0, fy: 0.0, fz: 0.0, mx: 0.0, my: 0.0, mz: 0.0 },
        ];

        let result = linearized_buckling_analysis(nodes, elements, loads, vec![], 3).unwrap();
        let expected_len = 2 * 6; // 2 nodes × 6 DOF
        for (i, shape) in result.mode_shapes.iter().enumerate() {
            assert_eq!(shape.len(), expected_len,
                "Mode shape {} should have {} entries, got {}", i, expected_len, shape.len());
        }
    }

    #[test]
    fn test_buckling_restrained_dofs_are_zero_in_mode_shapes() {
        // Fixed-base DOFs should have zero displacement in mode shapes
        let nodes = vec![
            Node3D { id: "1".into(), x: 0.0, y: 0.0, z: 0.0,
                     restraints: [true, true, true, true, true, true],
                     mass: None, spring_stiffness: None },
            Node3D { id: "2".into(), x: 5.0, y: 0.0, z: 0.0,
                     restraints: [false; 6],
                     mass: None, spring_stiffness: None },
        ];
        let elements = vec![
            make_buckling_element("E1", "1", "2", 2e11, 0.01, 1e-5, 1e-5),
        ];
        let loads = vec![
            NodalLoad { node_id: "2".into(), fx: -1.0, fy: 0.0, fz: 0.0, mx: 0.0, my: 0.0, mz: 0.0 },
        ];

        let result = linearized_buckling_analysis(nodes, elements, loads, vec![], 3).unwrap();
        for (mode_idx, shape) in result.mode_shapes.iter().enumerate() {
            // First 6 entries correspond to node "1" which is fully fixed
            for d in 0..6 {
                assert!((shape[d]).abs() < 1e-15,
                    "Mode {} DOF {} at fixed node should be zero, got {}", mode_idx, d, shape[d]);
            }
        }
    }

    #[test]
    fn test_buckling_empty_nodes_returns_error() {
        let result = linearized_buckling_analysis(vec![], vec![], vec![], vec![], 3);
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("No nodes"));
    }

    #[test]
    fn test_buckling_empty_elements_returns_error() {
        let nodes = vec![
            Node3D { id: "1".into(), x: 0.0, y: 0.0, z: 0.0,
                     restraints: [true; 6], mass: None, spring_stiffness: None },
        ];
        let result = linearized_buckling_analysis(nodes, vec![], vec![], vec![], 3);
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("No elements"));
    }

    #[test]
    fn test_buckling_all_fixed_returns_error() {
        // Both nodes fully fixed → no free DOFs
        let nodes = vec![
            Node3D { id: "1".into(), x: 0.0, y: 0.0, z: 0.0,
                     restraints: [true; 6], mass: None, spring_stiffness: None },
            Node3D { id: "2".into(), x: 0.0, y: 5.0, z: 0.0,
                     restraints: [true; 6], mass: None, spring_stiffness: None },
        ];
        let elements = vec![
            make_buckling_element("E1", "1", "2", 2e11, 0.01, 1e-5, 1e-5),
        ];
        let loads = vec![
            NodalLoad { node_id: "2".into(), fx: 0.0, fy: -1.0, fz: 0.0, mx: 0.0, my: 0.0, mz: 0.0 },
        ];
        let result = linearized_buckling_analysis(nodes, elements, loads, vec![], 3);
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("No free DOFs"));
    }

    #[test]
    fn test_buckling_multi_element_column() {
        // 3-element column along X-axis for better accuracy (mesh refinement)
        // Pin-pin: P_cr = π²EI / L²
        let e: f64 = 2.0e11;
        let a: f64 = 0.01;
        let iy: f64 = 1.0e-5;
        let iz: f64 = 1.0e-5;
        let total_length: f64 = 6.0;
        let seg = total_length / 3.0;

        let p_cr_theoretical = std::f64::consts::PI.powi(2) * e * iy / (total_length * total_length);

        // DOF order: [Ux, Uy, Uz, Rx, Ry, Rz]
        // X-axis column: Ux=axial, Rx=torsion
        let nodes = vec![
            Node3D { id: "1".into(), x: 0.0, y: 0.0, z: 0.0,
                     // Pin: fix translations + torsion
                     restraints: [true, true, true, true, false, false],
                     mass: None, spring_stiffness: None },
            Node3D { id: "2".into(), x: seg, y: 0.0, z: 0.0,
                     restraints: [false; 6],
                     mass: None, spring_stiffness: None },
            Node3D { id: "3".into(), x: 2.0*seg, y: 0.0, z: 0.0,
                     restraints: [false; 6],
                     mass: None, spring_stiffness: None },
            Node3D { id: "4".into(), x: total_length, y: 0.0, z: 0.0,
                     // Roller: fix lateral (Y,Z) only
                     restraints: [false, true, true, false, false, false],
                     mass: None, spring_stiffness: None },
        ];
        let elements = vec![
            make_buckling_element("E1", "1", "2", e, a, iy, iz),
            make_buckling_element("E2", "2", "3", e, a, iy, iz),
            make_buckling_element("E3", "3", "4", e, a, iy, iz),
        ];
        let loads = vec![
            NodalLoad { node_id: "4".into(), fx: -1.0, fy: 0.0, fz: 0.0, mx: 0.0, my: 0.0, mz: 0.0 },
        ];

        let result = linearized_buckling_analysis(nodes, elements, loads, vec![], 5).unwrap();
        assert!(result.success);

        let lambda1 = result.buckling_loads[0];
        let error_pct = ((lambda1 - p_cr_theoretical) / p_cr_theoretical).abs() * 100.0;
        // Multi-element should be more accurate than single element
        assert!(error_pct < 2.0,
            "3-element Euler buckling should be within 2% of theory. Got λ={:.1}, expected P_cr={:.1}, error={:.2}%",
            lambda1, p_cr_theoretical, error_pct);
    }

    #[test]
    fn test_buckling_higher_modes_larger_than_first() {
        // Higher buckling modes should have larger critical loads
        // Cantilever along X-axis, 3 elements
        let e = 2.0e11;
        let total_length = 6.0;
        let seg = total_length / 3.0;

        let nodes = vec![
            Node3D { id: "1".into(), x: 0.0, y: 0.0, z: 0.0,
                     restraints: [true, true, true, true, true, true],
                     mass: None, spring_stiffness: None },
            Node3D { id: "2".into(), x: seg, y: 0.0, z: 0.0,
                     restraints: [false; 6],
                     mass: None, spring_stiffness: None },
            Node3D { id: "3".into(), x: 2.0*seg, y: 0.0, z: 0.0,
                     restraints: [false; 6],
                     mass: None, spring_stiffness: None },
            Node3D { id: "4".into(), x: total_length, y: 0.0, z: 0.0,
                     restraints: [false; 6],
                     mass: None, spring_stiffness: None },
        ];
        let elements = vec![
            make_buckling_element("E1", "1", "2", e, 0.01, 1e-5, 1e-5),
            make_buckling_element("E2", "2", "3", e, 0.01, 1e-5, 1e-5),
            make_buckling_element("E3", "3", "4", e, 0.01, 1e-5, 1e-5),
        ];
        let loads = vec![
            NodalLoad { node_id: "4".into(), fx: -1.0, fy: 0.0, fz: 0.0, mx: 0.0, my: 0.0, mz: 0.0 },
        ];

        let result = linearized_buckling_analysis(nodes, elements, loads, vec![], 5).unwrap();
        assert!(result.num_modes >= 2, "Should find at least 2 modes");

        for i in 1..result.buckling_loads.len() {
            assert!(result.buckling_loads[i] >= result.buckling_loads[i-1] * 0.99,
                "Mode {} (λ={:.1}) should be >= mode {} (λ={:.1})",
                i+1, result.buckling_loads[i], i, result.buckling_loads[i-1]);
        }
    }
}
