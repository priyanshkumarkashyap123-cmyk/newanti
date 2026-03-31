use std::collections::HashMap;

use serde::{Deserialize, Serialize};

use super::base::{AnalysisConfig, AnalysisResult3D};

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

impl Default for MemberForces {
    fn default() -> Self {
        Self {
            forces_i: vec![0.0; 6],
            forces_j: vec![0.0; 6],
            max_shear_y: 0.0,
            max_shear_z: 0.0,
            max_moment_y: 0.0,
            max_moment_z: 0.0,
            max_axial: 0.0,
            max_torsion: 0.0,
        }
    }
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
#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct EquilibriumCheck {
    pub applied_forces: Vec<f64>,
    pub reaction_forces: Vec<f64>,
    pub residual: Vec<f64>,
    pub error_percent: f64,
    pub pass: bool,
}
