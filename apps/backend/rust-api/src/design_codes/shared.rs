//! Shared design code constants (generated). Do not edit manually.
use once_cell::sync::Lazy;
use serde::Deserialize;

#[derive(Debug, Deserialize)]
pub struct DesignCodeRecord {
    pub meta: Meta,
    pub partialSafety: Option<PartialSafety>,
    pub windSeismic: Option<WindSeismic>,
}

#[derive(Debug, Deserialize)]
pub struct Meta {
    pub id: String,
    pub name: String,
    pub edition: String,
    pub units: String,
    pub source: String,
    pub clauses: Option<std::collections::HashMap<String, String>>,
}

#[derive(Debug, Deserialize)]
pub struct PartialSafety {
    pub concrete: Option<f64>,
    pub steel: Option<f64>,
    pub gamma_m0: Option<f64>,
    pub gamma_m1: Option<f64>,
    pub gamma_mb: Option<f64>,
    pub phi_flexure: Option<f64>,
    pub phi_shear: Option<f64>,
    pub phi_axial: Option<f64>,
}

#[derive(Debug, Deserialize)]
pub struct WindSeismic {
    pub zone_factors: Option<std::collections::HashMap<String, f64>>,
    pub importance_factors: Option<std::collections::HashMap<String, f64>>,
}

pub static DESIGN_CODES: Lazy<std::collections::HashMap<String, DesignCodeRecord>> = Lazy::new(|| {
    let raw = include_str!("./designCodes.json");
    serde_json::from_str(raw).expect("Failed to parse designCodes.json")
});

