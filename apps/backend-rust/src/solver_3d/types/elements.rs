use serde::{Deserialize, Serialize};

use super::base::{deserialize_load_direction, deserialize_string_or_number, ElementType, LoadDirection};

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
    pub E: f64,

    #[serde(default)]
    pub nu: Option<f64>,

    #[serde(default = "default_shear_modulus")]
    pub G: f64,

    #[serde(default = "default_density")]
    pub density: f64,

    // Section properties
    #[serde(alias = "a", alias = "A")]
    pub A: f64,

    #[serde(alias = "i", alias = "I", alias = "Iy", default)]
    pub Iy: f64,

    /// Moment of inertia about z-axis. If not specified, defaults to Iy (symmetric section).
    #[serde(alias = "Iz", default)]
    pub Iz: f64,

    #[serde(default)]
    pub J: f64,

    #[serde(default)]
    pub Asy: f64,

    #[serde(default)]
    pub Asz: f64,

    // Member orientation
    #[serde(default)]
    pub beta: f64,

    // End releases
    #[serde(default)]
    pub releases_i: [bool; 6],

    #[serde(default)]
    pub releases_j: [bool; 6],

    // Plate specific
    #[serde(default)]
    pub thickness: Option<f64>,

    #[serde(default)]
    pub node_k: Option<String>,

    #[serde(default)]
    pub node_l: Option<String>,

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
    #[serde(deserialize_with = "deserialize_string_or_number")]
    pub element_id: String,

    #[serde(alias = "w1")]
    pub w_start: f64,

    #[serde(alias = "w2")]
    pub w_end: f64,

    #[serde(deserialize_with = "deserialize_load_direction")]
    pub direction: LoadDirection,

    #[serde(default)]
    pub is_projected: bool,

    #[serde(default)]
    pub start_pos: f64,

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
#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct PointLoadOnMember {
    #[serde(deserialize_with = "deserialize_string_or_number")]
    pub element_id: String,
    pub magnitude: f64,
    pub position: f64,
    #[serde(deserialize_with = "deserialize_load_direction")]
    pub direction: LoadDirection,
    #[serde(default)]
    pub is_moment: bool,
}

fn default_shear_modulus() -> f64 {
    80e9
}

fn default_density() -> f64 {
    7850.0
}

fn default_end_pos() -> f64 {
    1.0
}

/// Helper to deserialize restraints from various formats
fn deserialize_restraints<'de, D>(deserializer: D) -> Result<[bool; 6], D::Error>
where
    D: serde::Deserializer<'de>,
{
    use serde::de::{MapAccess, SeqAccess, Visitor};

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
