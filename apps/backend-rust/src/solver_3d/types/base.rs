use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize, Debug, Clone, PartialEq)]
pub enum LoadDirection {
    GlobalX,
    GlobalY,
    GlobalZ,
    LocalX,
    LocalY,
    LocalZ,
}

#[derive(Serialize, Deserialize, Debug, Clone, PartialEq)]
pub enum ElementType {
    Frame,
    Truss,
    Cable,
    Plate,
}

impl Default for ElementType {
    fn default() -> Self {
        ElementType::Frame
    }
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

fn default_gravity() -> f64 {
    9.80665
}

fn default_gravity_direction() -> f64 {
    -1.0
}

impl Default for AnalysisConfig {
    fn default() -> Self {
        AnalysisConfig {
            include_self_weight: false,
            gravity: default_gravity(),
            gravity_direction: default_gravity_direction(),
        }
    }
}

/// Helper to deserialize string or number as String
pub fn deserialize_string_or_number<'de, D>(deserializer: D) -> Result<String, D::Error>
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
pub fn deserialize_load_direction<'de, D>(deserializer: D) -> Result<LoadDirection, D::Error>
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
                if is_local {
                    LoadDirection::LocalX
                } else {
                    LoadDirection::GlobalX
                }
            } else if lower.contains("z") {
                if is_local {
                    LoadDirection::LocalZ
                } else {
                    LoadDirection::GlobalZ
                }
            } else if is_local {
                LoadDirection::LocalY
            } else {
                LoadDirection::GlobalY
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
