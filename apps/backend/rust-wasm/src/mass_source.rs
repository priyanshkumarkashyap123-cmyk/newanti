//! Mass Source Definition for Seismic Analysis
//!
//! Converts specified load cases (e.g., 1.0 DL + 0.25 LL) into the diagonal
//! mass matrix [M] for eigenvalue extraction (modal / response spectrum analysis).
//!
//! ## Features
//! - Multiple load case contributions with arbitrary scale factors
//! - Nodal mass, element self-weight, and additional mass sources
//! - Code-compliant defaults (IS 1893, ASCE 7, Eurocode 8)
//! - Per-node mass override capability
//! - Lumped or consistent mass formulation control
//!
//! ## References
//! - IS 1893:2016 Cl. 7.4.2: Seismic weight = DL + fraction of LL
//! - ASCE 7-22 §12.7.2: Effective seismic weight W
//! - Eurocode 8 §3.2.4: Combination coefficients ψ_Ei

use serde::{Deserialize, Serialize};
use std::collections::HashMap;

// ============================================================================
// LOAD CASE CONTRIBUTION
// ============================================================================

/// A single load case contribution to the seismic mass.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LoadCaseContribution {
    /// Load case identifier (e.g., "DL", "LL", "SDL", "CLAD")
    pub case_id: String,
    /// Scale factor applied to this load case (e.g., 1.0 for DL, 0.25 for LL)
    pub factor: f64,
    /// Description
    pub description: Option<String>,
}

impl LoadCaseContribution {
    pub fn new(case_id: &str, factor: f64) -> Self {
        Self {
            case_id: case_id.to_string(),
            factor,
            description: None,
        }
    }

    pub fn with_description(mut self, desc: &str) -> Self {
        self.description = Some(desc.to_string());
        self
    }
}

// ============================================================================
// MASS SOURCE DEFINITION
// ============================================================================

/// Mass source definition: specifies how to build the mass matrix [M]
/// from load cases and additional mass sources.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MassSourceDefinition {
    /// Name of this mass source definition
    pub name: String,
    /// Load case contributions with scale factors
    pub load_contributions: Vec<LoadCaseContribution>,
    /// Include element self-weight (from density × A × L)
    pub include_self_weight: bool,
    /// Self-weight scale factor (normally 1.0)
    pub self_weight_factor: f64,
    /// Additional point masses at specific nodes {node_id → mass_kg}
    pub additional_masses: HashMap<String, f64>,
    /// Mass formulation type
    pub mass_type: MassFormulation,
    /// Gravity acceleration (m/s²) for converting weight → mass
    pub gravity: f64,
    /// Lateral direction for mass participation check
    pub lateral_directions: Vec<MassDirection>,
}

/// Mass formulation type
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum MassFormulation {
    /// Lumped (diagonal) — faster, no rotational inertia
    Lumped,
    /// Consistent — full coupled mass matrix
    Consistent,
    /// Hybrid — consistent translational, lumped rotational
    HybridLumpedRotational,
}

impl Default for MassFormulation {
    fn default() -> Self {
        MassFormulation::Lumped
    }
}

/// Direction for mass participation
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum MassDirection {
    X,
    Y,
    Z,
    RX,
    RY,
    RZ,
}

impl Default for MassSourceDefinition {
    fn default() -> Self {
        // Default: 1.0 DL (self-weight assumed to be DL)
        Self {
            name: "Default Mass Source".to_string(),
            load_contributions: vec![
                LoadCaseContribution::new("DL", 1.0)
                    .with_description("Full dead load"),
            ],
            include_self_weight: true,
            self_weight_factor: 1.0,
            additional_masses: HashMap::new(),
            mass_type: MassFormulation::Lumped,
            gravity: 9.80665,
            lateral_directions: vec![MassDirection::X, MassDirection::Y],
        }
    }
}

impl MassSourceDefinition {
    /// IS 1893:2016 Cl. 7.4.2 mass source:
    /// - Seismic weight = DL + fraction of LL
    /// - Fraction of LL depends on imposed load intensity
    pub fn is1893(ll_fraction: f64) -> Self {
        Self {
            name: "IS 1893:2016 Seismic Mass".to_string(),
            load_contributions: vec![
                LoadCaseContribution::new("DL", 1.0)
                    .with_description("Full dead load (IS 1893 Cl. 7.4.2)"),
                LoadCaseContribution::new("LL", ll_fraction)
                    .with_description("Live load fraction per Table 8 of IS 1893"),
            ],
            include_self_weight: true,
            self_weight_factor: 1.0,
            additional_masses: HashMap::new(),
            mass_type: MassFormulation::Lumped,
            gravity: 9.80665,
            lateral_directions: vec![MassDirection::X, MassDirection::Y],
        }
    }

    /// ASCE 7-22 §12.7.2 effective seismic weight W:
    /// - DL + applicable portions of other loads:
    ///   25% of floor live load for storage,
    ///   partition load ≥ 0.48 kPa,
    ///   equipment,
    ///   20% of snow where Pf > 1.44 kPa
    pub fn asce7(storage_ll_fraction: f64, snow_fraction: f64) -> Self {
        let mut contributions = vec![
            LoadCaseContribution::new("DL", 1.0)
                .with_description("Dead load (ASCE 7-22 §12.7.2)"),
        ];
        if storage_ll_fraction > 0.0 {
            contributions.push(
                LoadCaseContribution::new("LL_STORAGE", storage_ll_fraction)
                    .with_description("Storage live load (min 25%)"),
            );
        }
        if snow_fraction > 0.0 {
            contributions.push(
                LoadCaseContribution::new("S", snow_fraction)
                    .with_description("Snow load (20% where Pf > 1.44 kPa)"),
            );
        }

        Self {
            name: "ASCE 7-22 Seismic Weight".to_string(),
            load_contributions: contributions,
            include_self_weight: true,
            self_weight_factor: 1.0,
            additional_masses: HashMap::new(),
            mass_type: MassFormulation::Lumped,
            gravity: 9.80665,
            lateral_directions: vec![MassDirection::X, MassDirection::Y],
        }
    }

    /// Eurocode 8 §3.2.4 combination coefficients:
    /// G_k,j "+" Σ ψ_E,i × Q_k,i
    /// where ψ_E,i = φ × ψ_2,i
    pub fn eurocode8(psi_2i_factors: Vec<(String, f64, f64)>) -> Self {
        // psi_2i_factors: vec of (case_id, phi, psi_2i)
        let mut contributions = vec![
            LoadCaseContribution::new("DL", 1.0)
                .with_description("Permanent action G_k (EN 1998 §3.2.4)"),
        ];
        for (case_id, phi, psi_2i) in &psi_2i_factors {
            let psi_ei = phi * psi_2i;
            contributions.push(
                LoadCaseContribution::new(case_id, psi_ei)
                    .with_description(&format!("ψ_E = φ({:.1}) × ψ_2({:.2}) = {:.3}", phi, psi_2i, psi_ei)),
            );
        }

        Self {
            name: "Eurocode 8 Seismic Mass".to_string(),
            load_contributions: contributions,
            include_self_weight: true,
            self_weight_factor: 1.0,
            additional_masses: HashMap::new(),
            mass_type: MassFormulation::Lumped,
            gravity: 9.80665,
            lateral_directions: vec![MassDirection::X, MassDirection::Y],
        }
    }

    /// Add an additional point mass at a node
    pub fn add_point_mass(&mut self, node_id: &str, mass_kg: f64) {
        *self.additional_masses.entry(node_id.to_string()).or_insert(0.0) += mass_kg;
    }

    /// Total number of load contributions
    pub fn num_contributions(&self) -> usize {
        self.load_contributions.len()
    }
}

// ============================================================================
// NODAL LOAD → MASS CONVERSION
// ============================================================================

/// Per-node gravity load from a single load case
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NodalGravityLoad {
    pub node_id: String,
    /// Gravity-direction force (kN, positive downward)
    pub force_kn: f64,
}

/// Result of mass source conversion
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MassSourceResult {
    /// Diagonal mass vector (kg), indexed by global DOF
    pub mass_diagonal: Vec<f64>,
    /// Per-node mass summary {node_id → mass_kg}
    pub nodal_masses: HashMap<String, f64>,
    /// Total seismic mass (kg)
    pub total_mass_kg: f64,
    /// Total seismic weight (kN)
    pub total_weight_kn: f64,
    /// Mass source name
    pub source_name: String,
    /// Contributions breakdown
    pub contributions_summary: Vec<ContributionSummary>,
}

/// Summary of a single load case contribution to mass
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ContributionSummary {
    pub case_id: String,
    pub factor: f64,
    pub total_weight_kn: f64,
    pub total_mass_kg: f64,
}

/// Build the diagonal mass vector from a mass source definition and nodal loads.
///
/// # Arguments
/// * `definition` - Mass source definition specifying load cases and factors
/// * `load_cases` - Map of load case ID → list of nodal gravity loads
///   (gravity-direction forces from the solver, in kN)
/// * `element_masses` - Element self-weight contributions per node {node_id → mass_kg}
/// * `n_nodes` - Total number of nodes (determines vector size)
/// * `node_index_map` - Maps node_id → sequential index (0-based)
/// * `dofs_per_node` - DOFs per node (default 6)
///
/// # Returns
/// `MassSourceResult` with diagonal mass vector and summary
pub fn build_mass_from_source(
    definition: &MassSourceDefinition,
    load_cases: &HashMap<String, Vec<NodalGravityLoad>>,
    element_masses: &HashMap<String, f64>,
    n_nodes: usize,
    node_index_map: &HashMap<String, usize>,
    dofs_per_node: usize,
) -> MassSourceResult {
    let n_dofs = n_nodes * dofs_per_node;
    let mut mass_diagonal = vec![0.0_f64; n_dofs];
    let mut nodal_masses: HashMap<String, f64> = HashMap::new();
    let mut contributions_summary = Vec::new();
    let g = definition.gravity;

    // 1. Load case contributions
    for contrib in &definition.load_contributions {
        let mut case_weight_kn = 0.0_f64;

        if let Some(loads) = load_cases.get(&contrib.case_id) {
            for load in loads {
                if let Some(&idx) = node_index_map.get(&load.node_id) {
                    // Force (kN) → mass (kg) = F / g × 1000 (kN→N conversion)
                    let mass_kg = (load.force_kn.abs() * 1000.0 / g) * contrib.factor;
                    let base_dof = idx * dofs_per_node;

                    // Translational DOFs only (0, 1, 2)
                    for d in 0..3.min(dofs_per_node) {
                        mass_diagonal[base_dof + d] += mass_kg;
                    }

                    *nodal_masses.entry(load.node_id.clone()).or_insert(0.0) += mass_kg;
                    case_weight_kn += load.force_kn.abs() * contrib.factor;
                }
            }
        }

        contributions_summary.push(ContributionSummary {
            case_id: contrib.case_id.clone(),
            factor: contrib.factor,
            total_weight_kn: case_weight_kn,
            total_mass_kg: case_weight_kn * 1000.0 / g,
        });
    }

    // 2. Element self-weight
    if definition.include_self_weight {
        let factor = definition.self_weight_factor;
        let mut sw_weight_kn = 0.0_f64;

        for (node_id, &mass_kg) in element_masses {
            if let Some(&idx) = node_index_map.get(node_id) {
                let scaled = mass_kg * factor;
                let base_dof = idx * dofs_per_node;
                for d in 0..3.min(dofs_per_node) {
                    mass_diagonal[base_dof + d] += scaled;
                }
                *nodal_masses.entry(node_id.clone()).or_insert(0.0) += scaled;
                sw_weight_kn += scaled * g / 1000.0;
            }
        }

        if sw_weight_kn > 0.0 {
            contributions_summary.push(ContributionSummary {
                case_id: "SELF_WEIGHT".to_string(),
                factor,
                total_weight_kn: sw_weight_kn,
                total_mass_kg: sw_weight_kn * 1000.0 / g,
            });
        }
    }

    // 3. Additional point masses
    for (node_id, &mass_kg) in &definition.additional_masses {
        if let Some(&idx) = node_index_map.get(node_id) {
            let base_dof = idx * dofs_per_node;
            for d in 0..3.min(dofs_per_node) {
                mass_diagonal[base_dof + d] += mass_kg;
            }
            *nodal_masses.entry(node_id.clone()).or_insert(0.0) += mass_kg;
        }
    }

    let total_mass_kg: f64 = nodal_masses.values().sum();
    let total_weight_kn = total_mass_kg * g / 1000.0;

    MassSourceResult {
        mass_diagonal,
        nodal_masses,
        total_mass_kg,
        total_weight_kn,
        source_name: definition.name.clone(),
        contributions_summary,
    }
}

// ============================================================================
// TESTS
// ============================================================================

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_default_mass_source() {
        let ms = MassSourceDefinition::default();
        assert_eq!(ms.load_contributions.len(), 1);
        assert_eq!(ms.load_contributions[0].case_id, "DL");
        assert!((ms.load_contributions[0].factor - 1.0).abs() < 1e-10);
        assert!(ms.include_self_weight);
    }

    #[test]
    fn test_is1893_mass_source() {
        let ms = MassSourceDefinition::is1893(0.25);
        assert_eq!(ms.load_contributions.len(), 2);
        assert_eq!(ms.load_contributions[0].case_id, "DL");
        assert_eq!(ms.load_contributions[1].case_id, "LL");
        assert!((ms.load_contributions[1].factor - 0.25).abs() < 1e-10);
    }

    #[test]
    fn test_asce7_mass_source() {
        let ms = MassSourceDefinition::asce7(0.25, 0.2);
        assert_eq!(ms.load_contributions.len(), 3);
    }

    #[test]
    fn test_eurocode8_mass_source() {
        let factors = vec![
            ("LL_OFFICE".to_string(), 1.0, 0.3),
            ("LL_STORAGE".to_string(), 1.0, 0.8),
        ];
        let ms = MassSourceDefinition::eurocode8(factors);
        assert_eq!(ms.load_contributions.len(), 3); // DL + 2 LL types
    }

    #[test]
    fn test_add_point_mass() {
        let mut ms = MassSourceDefinition::default();
        ms.add_point_mass("N5", 500.0);
        ms.add_point_mass("N5", 200.0);
        assert!((ms.additional_masses["N5"] - 700.0).abs() < 1e-10);
    }

    #[test]
    fn test_build_mass_from_source() {
        let definition = MassSourceDefinition::is1893(0.25);

        let mut load_cases: HashMap<String, Vec<NodalGravityLoad>> = HashMap::new();
        load_cases.insert("DL".to_string(), vec![
            NodalGravityLoad { node_id: "N1".to_string(), force_kn: 100.0 },
            NodalGravityLoad { node_id: "N2".to_string(), force_kn: 200.0 },
        ]);
        load_cases.insert("LL".to_string(), vec![
            NodalGravityLoad { node_id: "N1".to_string(), force_kn: 50.0 },
            NodalGravityLoad { node_id: "N2".to_string(), force_kn: 80.0 },
        ]);

        let element_masses: HashMap<String, f64> = HashMap::new(); // no self-weight in this test

        let mut node_index_map = HashMap::new();
        node_index_map.insert("N1".to_string(), 0_usize);
        node_index_map.insert("N2".to_string(), 1_usize);

        let result = build_mass_from_source(
            &definition,
            &load_cases,
            &element_masses,
            2,
            &node_index_map,
            6,
        );

        // N1: DL=100kN×1.0 + LL=50kN×0.25 = 112.5 kN → mass = 112500/9.80665
        let expected_n1 = 112.5 * 1000.0 / 9.80665;
        let actual_n1 = result.nodal_masses["N1"];
        assert!((actual_n1 - expected_n1).abs() / expected_n1 < 0.01);

        // N2: DL=200×1.0 + LL=80×0.25 = 220 kN
        let expected_n2 = 220.0 * 1000.0 / 9.80665;
        let actual_n2 = result.nodal_masses["N2"];
        assert!((actual_n2 - expected_n2).abs() / expected_n2 < 0.01);

        // Check diagonal: N1 DOF 0,1,2 should all equal expected_n1
        assert!((result.mass_diagonal[0] - expected_n1).abs() / expected_n1 < 0.01);
        assert!((result.mass_diagonal[1] - expected_n1).abs() / expected_n1 < 0.01);
        assert!((result.mass_diagonal[2] - expected_n1).abs() / expected_n1 < 0.01);
        // DOF 3,4,5 (rotational) = 0 for lumped
        assert!((result.mass_diagonal[3]).abs() < 1e-10);

        assert!(result.total_mass_kg > 0.0);
        assert!(result.total_weight_kn > 0.0);
        assert_eq!(result.contributions_summary.len(), 2); // DL + LL, no self-weight elements
    }

    #[test]
    fn test_self_weight_contribution() {
        let definition = MassSourceDefinition::default();

        let load_cases: HashMap<String, Vec<NodalGravityLoad>> = HashMap::new();
        let mut element_masses: HashMap<String, f64> = HashMap::new();
        element_masses.insert("N1".to_string(), 500.0); // 500 kg at N1

        let mut node_index_map = HashMap::new();
        node_index_map.insert("N1".to_string(), 0_usize);

        let result = build_mass_from_source(
            &definition,
            &load_cases,
            &element_masses,
            1,
            &node_index_map,
            6,
        );

        assert!((result.nodal_masses["N1"] - 500.0).abs() < 1e-10);
        assert!((result.mass_diagonal[0] - 500.0).abs() < 1e-10);
    }

    #[test]
    fn test_mass_formulation_types() {
        assert_eq!(MassFormulation::default(), MassFormulation::Lumped);
    }

    #[test]
    fn test_additional_point_mass_in_build() {
        let mut definition = MassSourceDefinition::default();
        definition.include_self_weight = false;
        definition.load_contributions.clear();
        definition.add_point_mass("N1", 1000.0);

        let load_cases: HashMap<String, Vec<NodalGravityLoad>> = HashMap::new();
        let element_masses: HashMap<String, f64> = HashMap::new();
        let mut node_index_map = HashMap::new();
        node_index_map.insert("N1".to_string(), 0_usize);

        let result = build_mass_from_source(
            &definition,
            &load_cases,
            &element_masses,
            1,
            &node_index_map,
            6,
        );

        assert!((result.nodal_masses["N1"] - 1000.0).abs() < 1e-10);
        assert!((result.total_mass_kg - 1000.0).abs() < 1e-10);
    }
}
