//! Types for load combinations and envelopes

use serde::{Deserialize, Serialize};
use std::collections::HashMap;

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq)]
#[allow(non_camel_case_types)]
pub enum CombinationCode {
    IS456,
    ASCE7_LRFD,
    ASCE7_ASD,
    Eurocode,
    Custom,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq, Hash)]
pub enum LoadCaseType {
    Dead,
    Live,
    Wind,
    Seismic,
    Snow,
    Rain,
    Temperature,
    Settlement,
    Prestress,
    Pattern,
    Custom,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LoadCase {
    pub id: String,
    pub name: String,
    pub case_type: LoadCaseType,
    pub displacements: HashMap<String, [f64; 6]>,
    pub member_forces: HashMap<String, [f64; 12]>,
    pub reactions: HashMap<String, [f64; 6]>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LoadFactor {
    pub load_case_id: String,
    pub factor: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LoadCombination {
    pub id: String,
    pub name: String,
    pub code: CombinationCode,
    pub factors: Vec<LoadFactor>,
    pub is_service: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CombinationResult {
    pub combination_id: String,
    pub combination_name: String,
    pub displacements: HashMap<String, [f64; 6]>,
    pub member_forces: HashMap<String, [f64; 12]>,
    pub reactions: HashMap<String, [f64; 6]>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EnvelopeResult {
    pub node_displacements: HashMap<String, EnvelopeValues6>,
    pub member_forces: HashMap<String, EnvelopeValues12>,
    pub reactions: HashMap<String, EnvelopeValues6>,
    pub governing_combinations: HashMap<String, String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EnvelopeValues6 {
    pub max: [f64; 6],
    pub min: [f64; 6],
    pub max_combo: [String; 6],
    pub min_combo: [String; 6],
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EnvelopeValues12 {
    pub max: [f64; 12],
    pub min: [f64; 12],
    pub max_combo: [String; 12],
    pub min_combo: [String; 12],
}

pub struct LoadCombinationEngine {
    pub load_cases: Vec<LoadCase>,
    pub combinations: Vec<LoadCombination>,
}

impl LoadCombinationEngine {
    pub fn new() -> Self {
        Self { load_cases: Vec::new(), combinations: Vec::new() }
    }
}
