//! Result Post-Processing Engine
//!
//! Comprehensive post-processing for FEA results including stress/strain
//! analysis, result visualization data, and design checks.
//!
//! ## Features
//! - Nodal/element result extrapolation
//! - Stress invariants and derived quantities
//! - Design code checks
//! - Result combination and envelopes
//! - Export formats

use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::f64::consts::PI;

// ============================================================================
// RESULT DATA STRUCTURES
// ============================================================================

/// Complete analysis results container
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AnalysisResults {
    pub load_case_id: usize,
    pub load_case_name: String,
    pub displacement: DisplacementResults,
    pub stress: StressResults,
    pub strain: StrainResults,
    pub reaction: ReactionResults,
    pub derived: DerivedResults,
}

/// Displacement results
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct DisplacementResults {
    /// Node ID -> displacement vector [ux, uy, uz, rx, ry, rz]
    pub nodal: HashMap<usize, [f64; 6]>,
    pub max_displacement: f64,
    pub max_rotation: f64,
    pub node_with_max_disp: usize,
}

impl DisplacementResults {
    pub fn from_solution(solution: &[f64], dof_per_node: usize, num_nodes: usize) -> Self {
        let mut nodal = HashMap::new();
        let mut max_displacement = 0.0_f64;
        let mut max_rotation = 0.0_f64;
        let mut node_with_max = 0;

        for node_id in 0..num_nodes {
            let base = node_id * dof_per_node;
            let mut disp = [0.0; 6];

            for i in 0..dof_per_node.min(6) {
                if base + i < solution.len() {
                    disp[i] = solution[base + i];
                }
            }

            nodal.insert(node_id, disp);

            // Track maximum displacement magnitude
            let disp_mag = (disp[0].powi(2) + disp[1].powi(2) + disp[2].powi(2)).sqrt();
            if disp_mag > max_displacement {
                max_displacement = disp_mag;
                node_with_max = node_id;
            }

            let rot_mag = (disp[3].powi(2) + disp[4].powi(2) + disp[5].powi(2)).sqrt();
            max_rotation = max_rotation.max(rot_mag);
        }

        DisplacementResults {
            nodal,
            max_displacement,
            max_rotation,
            node_with_max_disp: node_with_max,
        }
    }

    /// Get displacement at specific node
    pub fn get_nodal(&self, node_id: usize) -> Option<[f64; 6]> {
        self.nodal.get(&node_id).copied()
    }
}

/// Stress results
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct StressResults {
    /// Element ID -> stress state at integration points
    pub element_stresses: HashMap<usize, Vec<StressState>>,
    /// Element ID -> stress at centroid
    pub centroid_stresses: HashMap<usize, StressState>,
    /// Node ID -> averaged nodal stress (extrapolated from elements)
    pub nodal_stresses: HashMap<usize, StressState>,
    pub max_von_mises: f64,
    pub element_with_max_vm: usize,
}

/// Full 3D stress tensor
#[derive(Debug, Clone, Copy, Default, Serialize, Deserialize)]
pub struct StressState {
    /// Components: σxx, σyy, σzz, τxy, τyz, τxz
    pub components: [f64; 6],
}

impl StressState {
    pub fn new(sxx: f64, syy: f64, szz: f64, sxy: f64, syz: f64, sxz: f64) -> Self {
        StressState {
            components: [sxx, syy, szz, sxy, syz, sxz],
        }
    }

    /// Von Mises equivalent stress
    pub fn von_mises(&self) -> f64 {
        let s = &self.components;
        let vm = 0.5 * ((s[0] - s[1]).powi(2) + (s[1] - s[2]).powi(2) + (s[2] - s[0]).powi(2))
            + 3.0 * (s[3].powi(2) + s[4].powi(2) + s[5].powi(2));
        vm.sqrt()
    }

    /// Tresca (maximum shear) stress
    pub fn tresca(&self) -> f64 {
        let principals = self.principal_stresses();
        let mut max_shear = 0.0_f64;
        for i in 0..3 {
            for j in (i + 1)..3 {
                let shear = (principals[i] - principals[j]).abs() / 2.0;
                max_shear = max_shear.max(shear);
            }
        }
        max_shear
    }

    /// Principal stresses (sorted: σ1 ≥ σ2 ≥ σ3)
    pub fn principal_stresses(&self) -> [f64; 3] {
        let s = &self.components;

        // Fast path: For diagonal stress tensor (no shear), eigenvalues are the diagonal entries
        if s[3].abs() < 1e-14 && s[4].abs() < 1e-14 && s[5].abs() < 1e-14 {
            let mut principals = [s[0], s[1], s[2]];
            principals.sort_by(|a, b| b.partial_cmp(a).unwrap());
            return principals;
        }

        // Stress invariants
        let i1 = s[0] + s[1] + s[2];
        let i2 = s[0] * s[1] + s[1] * s[2] + s[2] * s[0]
            - s[3].powi(2) - s[4].powi(2) - s[5].powi(2);
        let i3 = s[0] * s[1] * s[2]
            + 2.0 * s[3] * s[4] * s[5]
            - s[0] * s[4].powi(2)
            - s[1] * s[5].powi(2)
            - s[2] * s[3].powi(2);

        // Solve cubic equation using Cardano's formula
        let p = i2 - i1.powi(2) / 3.0;
        let q = 2.0 * i1.powi(3) / 27.0 - i1 * i2 / 3.0 + i3;

        let discriminant = q.powi(2) / 4.0 + p.powi(3) / 27.0;

        let mut principals = if discriminant < 0.0 || (p.abs() > 1e-10 && discriminant.abs() / (p.abs().powi(3)) < 1e-6) {
            // Three real roots (negative discriminant, or nearly zero relative to p)
            let r = ((-p).max(0.0).powi(3) / 27.0).sqrt();
            let phi = if r.abs() > 1e-20 {
                (-q / (2.0 * r)).clamp(-1.0, 1.0).acos()
            } else {
                0.0
            };
            let two_r_cbrt = 2.0 * (-p / 3.0).max(0.0).sqrt();

            [
                two_r_cbrt * (phi / 3.0).cos() + i1 / 3.0,
                two_r_cbrt * ((phi + 2.0 * PI) / 3.0).cos() + i1 / 3.0,
                two_r_cbrt * ((phi + 4.0 * PI) / 3.0).cos() + i1 / 3.0,
            ]
        } else {
            // Use Cardano's general formula
            let sqrt_disc = discriminant.abs().sqrt();
            let u_arg = -q / 2.0 + sqrt_disc;
            let v_arg = -q / 2.0 - sqrt_disc;
            let u = if u_arg >= 0.0 { u_arg.cbrt() } else { -(-u_arg).cbrt() };
            let v = if v_arg >= 0.0 { v_arg.cbrt() } else { -(-v_arg).cbrt() };
            [u + v + i1 / 3.0, i1 / 3.0, i1 / 3.0]
        };

        // Sort descending
        principals.sort_by(|a, b| b.partial_cmp(a).unwrap());
        principals
    }

    /// Hydrostatic stress (mean stress)
    pub fn hydrostatic(&self) -> f64 {
        (self.components[0] + self.components[1] + self.components[2]) / 3.0
    }

    /// Deviatoric stress magnitude
    pub fn deviatoric_magnitude(&self) -> f64 {
        let p = self.hydrostatic();
        let dev = [
            self.components[0] - p,
            self.components[1] - p,
            self.components[2] - p,
            self.components[3],
            self.components[4],
            self.components[5],
        ];

        let j2 = 0.5 * (dev[0].powi(2) + dev[1].powi(2) + dev[2].powi(2))
            + dev[3].powi(2) + dev[4].powi(2) + dev[5].powi(2);
        (3.0 * j2).sqrt()
    }

    /// Maximum principal stress
    pub fn max_principal(&self) -> f64 {
        self.principal_stresses()[0]
    }

    /// Minimum principal stress
    pub fn min_principal(&self) -> f64 {
        self.principal_stresses()[2]
    }

    /// Stress triaxiality (η = σm / σeq)
    pub fn triaxiality(&self) -> f64 {
        let vm = self.von_mises();
        if vm.abs() > 1e-15 {
            self.hydrostatic() / vm
        } else {
            0.0
        }
    }
}

/// Strain results
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct StrainResults {
    /// Element ID -> strain state at integration points
    pub element_strains: HashMap<usize, Vec<StrainState>>,
    /// Node ID -> averaged nodal strain
    pub nodal_strains: HashMap<usize, StrainState>,
}

/// Full 3D strain tensor
#[derive(Debug, Clone, Copy, Default, Serialize, Deserialize)]
pub struct StrainState {
    /// Components: εxx, εyy, εzz, γxy, γyz, γxz (engineering shear strains)
    pub components: [f64; 6],
}

impl StrainState {
    pub fn new(exx: f64, eyy: f64, ezz: f64, gxy: f64, gyz: f64, gxz: f64) -> Self {
        StrainState {
            components: [exx, eyy, ezz, gxy, gyz, gxz],
        }
    }

    /// Volumetric strain
    pub fn volumetric(&self) -> f64 {
        self.components[0] + self.components[1] + self.components[2]
    }

    /// Equivalent plastic strain (for elasto-plastic analysis)
    pub fn equivalent(&self) -> f64 {
        let e = &self.components;
        let dev_e = [
            e[0] - self.volumetric() / 3.0,
            e[1] - self.volumetric() / 3.0,
            e[2] - self.volumetric() / 3.0,
        ];

        let term1 = dev_e[0].powi(2) + dev_e[1].powi(2) + dev_e[2].powi(2);
        let term2 = (e[3].powi(2) + e[4].powi(2) + e[5].powi(2)) / 4.0; // Convert from engineering

        ((2.0 / 3.0) * (term1 + 2.0 * term2)).sqrt()
    }
}

/// Reaction force results
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct ReactionResults {
    /// Node ID -> reaction forces [Fx, Fy, Fz, Mx, My, Mz]
    pub nodal_reactions: HashMap<usize, [f64; 6]>,
    /// Total reactions
    pub total_force: [f64; 3],
    pub total_moment: [f64; 3],
}

impl ReactionResults {
    pub fn compute_totals(&mut self) {
        self.total_force = [0.0; 3];
        self.total_moment = [0.0; 3];

        for reaction in self.nodal_reactions.values() {
            for i in 0..3 {
                self.total_force[i] += reaction[i];
                self.total_moment[i] += reaction[3 + i];
            }
        }
    }
}

/// Derived quantities
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct DerivedResults {
    /// Strain energy
    pub strain_energy: f64,
    /// Compliance (2 × strain energy for linear problems)
    pub compliance: f64,
    /// Element ID -> strain energy density
    pub strain_energy_density: HashMap<usize, f64>,
}

// ============================================================================
// STRESS EXTRAPOLATION
// ============================================================================

/// Extrapolation from integration points to nodes
pub struct StressExtrapolation;

impl StressExtrapolation {
    /// Extrapolate stresses from Gauss points to corner nodes (2D Quad)
    pub fn extrapolate_quad4(gauss_stresses: &[[f64; 6]; 4]) -> [[f64; 6]; 4] {
        // For 2×2 Gauss quadrature in bilinear quad
        // Extrapolation factor = 1 + √3 ≈ 2.732
        let a = 1.0 + 3.0_f64.sqrt();
        let b = -1.0 / 3.0_f64.sqrt();

        // Shape function-like extrapolation
        let weights = [
            [a, b, b * b, b],
            [b, a, b, b * b],
            [b * b, b, a, b],
            [b, b * b, b, a],
        ];

        let mut nodal_stresses = [[0.0; 6]; 4];

        for (node, node_stress) in nodal_stresses.iter_mut().enumerate() {
            for comp in 0..6 {
                for (gp, gp_stress) in gauss_stresses.iter().enumerate() {
                    node_stress[comp] += weights[node][gp] * gp_stress[comp];
                }
            }
        }

        nodal_stresses
    }

    /// Extrapolate stresses from Gauss points to corner nodes (3D Hex8)
    pub fn extrapolate_hex8(gauss_stresses: &[[f64; 6]; 8]) -> [[f64; 6]; 8] {
        // Similar extrapolation for 2×2×2 Gauss quadrature
        let a = 1.0 + 3.0_f64.sqrt();
        let b = -1.0 / 3.0_f64.sqrt();

        let mut nodal_stresses = [[0.0; 6]; 8];

        // Simplified: average nearby Gauss points
        for (node, node_stress) in nodal_stresses.iter_mut().enumerate() {
            for comp in 0..6 {
                node_stress[comp] = gauss_stresses[node][comp] * a / 4.0;
                for (gp, gp_stress) in gauss_stresses.iter().enumerate() {
                    if gp != node {
                        node_stress[comp] += gp_stress[comp] * b / 4.0;
                    }
                }
            }
        }

        nodal_stresses
    }

    /// Average nodal stresses from contributing elements
    pub fn average_nodal_stresses(
        element_nodal_stresses: &[(usize, Vec<(usize, StressState)>)],
    ) -> HashMap<usize, StressState> {
        let mut nodal_sum: HashMap<usize, ([f64; 6], usize)> = HashMap::new();

        for (_elem_id, node_stresses) in element_nodal_stresses {
            for (node_id, stress) in node_stresses {
                let entry = nodal_sum.entry(*node_id).or_insert(([0.0; 6], 0));
                for i in 0..6 {
                    entry.0[i] += stress.components[i];
                }
                entry.1 += 1;
            }
        }

        let mut averaged = HashMap::new();
        for (node_id, (sum, count)) in nodal_sum {
            if count > 0 {
                let mut avg = [0.0; 6];
                for (i, s) in sum.iter().enumerate() {
                    avg[i] = s / count as f64;
                }
                averaged.insert(node_id, StressState { components: avg });
            }
        }

        averaged
    }
}

// ============================================================================
// DESIGN CHECKS
// ============================================================================

/// Design code checker
pub struct DesignChecker {
    pub safety_factor: f64,
    pub yield_strength: f64,
    pub ultimate_strength: f64,
    pub fatigue_limit: Option<f64>,
}

impl DesignChecker {
    pub fn new(yield_strength: f64, ultimate_strength: f64) -> Self {
        DesignChecker {
            safety_factor: 1.5,
            yield_strength,
            ultimate_strength,
            fatigue_limit: None,
        }
    }

    /// Check stress against yield criterion
    pub fn check_yield(&self, stress: &StressState) -> DesignCheckResult {
        let vm = stress.von_mises();
        let allowable = self.yield_strength / self.safety_factor;
        let utilization = vm / allowable;

        DesignCheckResult {
            check_type: DesignCheck::Yield,
            demand: vm,
            capacity: allowable,
            utilization,
            passed: utilization <= 1.0,
        }
    }

    /// Check stress against ultimate criterion
    pub fn check_ultimate(&self, stress: &StressState) -> DesignCheckResult {
        let max_principal = stress.max_principal();
        let allowable = self.ultimate_strength / self.safety_factor;
        let utilization = max_principal.abs() / allowable;

        DesignCheckResult {
            check_type: DesignCheck::Ultimate,
            demand: max_principal.abs(),
            capacity: allowable,
            utilization,
            passed: utilization <= 1.0,
        }
    }

    /// Check fatigue (simplified)
    pub fn check_fatigue(&self, stress_amplitude: f64) -> Option<DesignCheckResult> {
        self.fatigue_limit.map(|limit| {
            let allowable = limit / self.safety_factor;
            let utilization = stress_amplitude / allowable;

            DesignCheckResult {
                check_type: DesignCheck::Fatigue,
                demand: stress_amplitude,
                capacity: allowable,
                utilization,
                passed: utilization <= 1.0,
            }
        })
    }

    /// Run all design checks
    pub fn run_all_checks(&self, stress: &StressState) -> Vec<DesignCheckResult> {
        let mut results = vec![
            self.check_yield(stress),
            self.check_ultimate(stress),
        ];

        if let Some(fatigue) = self.check_fatigue(stress.von_mises() / 2.0) {
            results.push(fatigue);
        }

        results
    }
}

#[derive(Debug, Clone, Copy, PartialEq)]
pub enum DesignCheck {
    Yield,
    Ultimate,
    Fatigue,
    Buckling,
    Deflection,
    Custom(usize),
}

#[derive(Debug, Clone)]
pub struct DesignCheckResult {
    pub check_type: DesignCheck,
    pub demand: f64,
    pub capacity: f64,
    pub utilization: f64,
    pub passed: bool,
}

// ============================================================================
// RESULT COMBINATIONS
// ============================================================================

/// Load combination type
#[derive(Debug, Clone, Copy, PartialEq)]
pub enum CombinationType {
    Linear,         // Simple superposition
    SRSS,           // Square Root of Sum of Squares
    CQC,            // Complete Quadratic Combination
    AbsoluteSum,    // Sum of absolute values
    Envelope,       // Maximum/minimum envelope
}

/// Load case combination
#[derive(Debug, Clone)]
pub struct LoadCombination {
    pub name: String,
    pub combination_type: CombinationType,
    pub factors: Vec<(usize, f64)>,  // (load_case_id, factor)
}

/// Result combiner
pub struct ResultCombiner;

impl ResultCombiner {
    /// Combine displacement results
    pub fn combine_displacements(
        results: &[&DisplacementResults],
        factors: &[f64],
        combination_type: CombinationType,
    ) -> DisplacementResults {
        let mut combined = DisplacementResults::default();

        match combination_type {
            CombinationType::Linear => {
                for node_id in results[0].nodal.keys() {
                    let mut disp = [0.0; 6];
                    for (i, result) in results.iter().enumerate() {
                        if let Some(r) = result.nodal.get(node_id) {
                            let factor = factors.get(i).copied().unwrap_or(1.0);
                            for j in 0..6 {
                                disp[j] += factor * r[j];
                            }
                        }
                    }
                    combined.nodal.insert(*node_id, disp);
                }
            }
            CombinationType::SRSS => {
                for node_id in results[0].nodal.keys() {
                    let mut disp = [0.0; 6];
                    for j in 0..6 {
                        let mut sum_sq = 0.0;
                        for (i, result) in results.iter().enumerate() {
                            if let Some(r) = result.nodal.get(node_id) {
                                let factor = factors.get(i).copied().unwrap_or(1.0);
                                sum_sq += (factor * r[j]).powi(2);
                            }
                        }
                        disp[j] = sum_sq.sqrt();
                    }
                    combined.nodal.insert(*node_id, disp);
                }
            }
            CombinationType::AbsoluteSum => {
                for node_id in results[0].nodal.keys() {
                    let mut disp = [0.0; 6];
                    for (i, result) in results.iter().enumerate() {
                        if let Some(r) = result.nodal.get(node_id) {
                            let factor = factors.get(i).copied().unwrap_or(1.0);
                            for j in 0..6 {
                                disp[j] += (factor * r[j]).abs();
                            }
                        }
                    }
                    combined.nodal.insert(*node_id, disp);
                }
            }
            _ => {
                // Default to linear for other types
                return Self::combine_displacements(results, factors, CombinationType::Linear);
            }
        }

        // Update max values
        for (&node_id, disp) in &combined.nodal {
            let mag = (disp[0].powi(2) + disp[1].powi(2) + disp[2].powi(2)).sqrt();
            if mag > combined.max_displacement {
                combined.max_displacement = mag;
                combined.node_with_max_disp = node_id;
            }
        }

        combined
    }

    /// Create envelope from multiple load cases
    pub fn envelope_stresses(
        results: &[&StressResults],
    ) -> (HashMap<usize, StressState>, HashMap<usize, StressState>) {
        let mut max_envelope: HashMap<usize, StressState> = HashMap::new();
        let mut min_envelope: HashMap<usize, StressState> = HashMap::new();

        for result in results {
            for (&elem_id, stress) in &result.centroid_stresses {
                let max_entry = max_envelope.entry(elem_id).or_default();
                let min_entry = min_envelope.entry(elem_id).or_default();

                for i in 0..6 {
                    max_entry.components[i] = max_entry.components[i].max(stress.components[i]);
                    min_entry.components[i] = min_entry.components[i].min(stress.components[i]);
                }
            }
        }

        (max_envelope, min_envelope)
    }
}

// ============================================================================
// EXPORT FORMATS
// ============================================================================

/// Result exporter
pub struct ResultExporter;

impl ResultExporter {
    /// Export to CSV format
    pub fn to_csv_nodal_displacements(results: &DisplacementResults) -> String {
        let mut csv = String::from("NodeID,Ux,Uy,Uz,Rx,Ry,Rz,Magnitude\n");

        let mut sorted: Vec<_> = results.nodal.iter().collect();
        sorted.sort_by_key(|&(id, _)| id);

        for (node_id, disp) in sorted {
            let mag = (disp[0].powi(2) + disp[1].powi(2) + disp[2].powi(2)).sqrt();
            csv.push_str(&format!(
                "{},{:.6e},{:.6e},{:.6e},{:.6e},{:.6e},{:.6e},{:.6e}\n",
                node_id, disp[0], disp[1], disp[2], disp[3], disp[4], disp[5], mag
            ));
        }

        csv
    }

    /// Export to CSV format
    pub fn to_csv_element_stresses(results: &StressResults) -> String {
        let mut csv = String::from("ElementID,Sxx,Syy,Szz,Sxy,Syz,Sxz,VonMises\n");

        let mut sorted: Vec<_> = results.centroid_stresses.iter().collect();
        sorted.sort_by_key(|&(id, _)| id);

        for (elem_id, stress) in sorted {
            let s = &stress.components;
            csv.push_str(&format!(
                "{},{:.6e},{:.6e},{:.6e},{:.6e},{:.6e},{:.6e},{:.6e}\n",
                elem_id, s[0], s[1], s[2], s[3], s[4], s[5], stress.von_mises()
            ));
        }

        csv
    }

    /// Export to VTK format (simplified - point data only)
    pub fn to_vtk(
        nodes: &[(f64, f64, f64)],
        displacements: &DisplacementResults,
    ) -> String {
        let mut vtk = String::from("# vtk DataFile Version 3.0\n");
        vtk.push_str("FEA Results\n");
        vtk.push_str("ASCII\n");
        vtk.push_str("DATASET POLYDATA\n");

        // Points
        vtk.push_str(&format!("POINTS {} float\n", nodes.len()));
        for (x, y, z) in nodes {
            vtk.push_str(&format!("{} {} {}\n", x, y, z));
        }

        // Point data
        vtk.push_str(&format!("POINT_DATA {}\n", nodes.len()));
        vtk.push_str("VECTORS displacement float\n");
        for node_id in 0..nodes.len() {
            if let Some(disp) = displacements.nodal.get(&node_id) {
                vtk.push_str(&format!("{} {} {}\n", disp[0], disp[1], disp[2]));
            } else {
                vtk.push_str("0 0 0\n");
            }
        }

        vtk
    }
}

// ============================================================================
// RESULT SUMMARY
// ============================================================================

/// Analysis result summary
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ResultSummary {
    pub max_displacement: f64,
    pub max_displacement_node: usize,
    pub max_von_mises: f64,
    pub max_von_mises_element: usize,
    pub max_principal_stress: f64,
    pub min_principal_stress: f64,
    pub total_strain_energy: f64,
    pub reaction_sum: [f64; 6],
}

impl ResultSummary {
    pub fn from_results(results: &AnalysisResults) -> Self {
        ResultSummary {
            max_displacement: results.displacement.max_displacement,
            max_displacement_node: results.displacement.node_with_max_disp,
            max_von_mises: results.stress.max_von_mises,
            max_von_mises_element: results.stress.element_with_max_vm,
            max_principal_stress: 0.0, // Would compute from stress results
            min_principal_stress: 0.0,
            total_strain_energy: results.derived.strain_energy,
            reaction_sum: [
                results.reaction.total_force[0],
                results.reaction.total_force[1],
                results.reaction.total_force[2],
                results.reaction.total_moment[0],
                results.reaction.total_moment[1],
                results.reaction.total_moment[2],
            ],
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_von_mises_uniaxial() {
        let stress = StressState::new(100.0, 0.0, 0.0, 0.0, 0.0, 0.0);
        assert!((stress.von_mises() - 100.0).abs() < 1e-10);
    }

    #[test]
    fn test_von_mises_pure_shear() {
        let stress = StressState::new(0.0, 0.0, 0.0, 100.0, 0.0, 0.0);
        let expected = (3.0_f64).sqrt() * 100.0;
        assert!((stress.von_mises() - expected).abs() < 1e-10);
    }

    #[test]
    fn test_principal_stresses_uniaxial() {
        let stress = StressState::new(100.0, 0.0, 0.0, 0.0, 0.0, 0.0);
        let principals = stress.principal_stresses();

        assert!((principals[0] - 100.0).abs() < 1e-6);
        assert!(principals[1].abs() < 1e-6);
        assert!(principals[2].abs() < 1e-6);
    }

    #[test]
    fn test_hydrostatic() {
        let stress = StressState::new(100.0, 200.0, 300.0, 0.0, 0.0, 0.0);
        assert!((stress.hydrostatic() - 200.0).abs() < 1e-10);
    }

    #[test]
    fn test_tresca() {
        let stress = StressState::new(100.0, 0.0, -100.0, 0.0, 0.0, 0.0);
        assert!((stress.tresca() - 100.0).abs() < 1e-6);
    }

    #[test]
    fn test_strain_volumetric() {
        let strain = StrainState::new(0.001, 0.001, 0.001, 0.0, 0.0, 0.0);
        assert!((strain.volumetric() - 0.003).abs() < 1e-10);
    }

    #[test]
    fn test_displacement_results() {
        let solution = vec![1.0, 2.0, 3.0, 0.1, 0.2, 0.3, 4.0, 5.0, 6.0, 0.4, 0.5, 0.6];
        let results = DisplacementResults::from_solution(&solution, 6, 2);

        assert_eq!(results.nodal.len(), 2);
        assert!(results.max_displacement > 0.0);
    }

    #[test]
    fn test_design_checker() {
        let checker = DesignChecker::new(250.0, 400.0);
        let stress = StressState::new(100.0, 0.0, 0.0, 0.0, 0.0, 0.0);

        let yield_check = checker.check_yield(&stress);
        assert!(yield_check.passed);
        assert!(yield_check.utilization < 1.0);
    }

    #[test]
    fn test_csv_export() {
        let mut results = DisplacementResults::default();
        results.nodal.insert(0, [1.0, 2.0, 3.0, 0.0, 0.0, 0.0]);
        results.nodal.insert(1, [4.0, 5.0, 6.0, 0.0, 0.0, 0.0]);

        let csv = ResultExporter::to_csv_nodal_displacements(&results);
        assert!(csv.contains("NodeID"));
        assert!(csv.contains("1.000000e0"));
    }

    #[test]
    fn test_result_combiner_linear() {
        let mut r1 = DisplacementResults::default();
        r1.nodal.insert(0, [1.0, 0.0, 0.0, 0.0, 0.0, 0.0]);

        let mut r2 = DisplacementResults::default();
        r2.nodal.insert(0, [0.0, 2.0, 0.0, 0.0, 0.0, 0.0]);

        let combined = ResultCombiner::combine_displacements(
            &[&r1, &r2],
            &[1.0, 1.0],
            CombinationType::Linear,
        );

        let disp = combined.nodal.get(&0).unwrap();
        assert_eq!(disp[0], 1.0);
        assert_eq!(disp[1], 2.0);
    }

    #[test]
    fn test_result_combiner_srss() {
        let mut r1 = DisplacementResults::default();
        r1.nodal.insert(0, [3.0, 0.0, 0.0, 0.0, 0.0, 0.0]);

        let mut r2 = DisplacementResults::default();
        r2.nodal.insert(0, [4.0, 0.0, 0.0, 0.0, 0.0, 0.0]);

        let combined = ResultCombiner::combine_displacements(
            &[&r1, &r2],
            &[1.0, 1.0],
            CombinationType::SRSS,
        );

        let disp = combined.nodal.get(&0).unwrap();
        assert!((disp[0] - 5.0).abs() < 1e-10); // sqrt(9 + 16) = 5
    }

    #[test]
    fn test_stress_triaxiality() {
        let uniaxial = StressState::new(100.0, 0.0, 0.0, 0.0, 0.0, 0.0);
        let triax = uniaxial.triaxiality();
        assert!((triax - 1.0 / 3.0).abs() < 1e-6);
    }
}
