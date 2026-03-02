//! # Global Solid Element Solver
//!
//! Assembles and solves 3D solid finite element problems using Hex8 elements.
//! Uses Direct Stiffness Method with nalgebra for linear algebra.
//!
//! ## Pipeline
//! 1. Element stiffness matrices (from `solid_elements::Hex8Element`)
//! 2. Global assembly via DOF scatter
//! 3. Boundary condition application (penalty method)
//! 4. LU decomposition solve
//! 5. Stress recovery at Gauss points

use nalgebra::{DMatrix, DVector};
use crate::solid_elements::{Hex8Element, SolidMaterial, StressResult};

// ============================================================================
// DATA STRUCTURES
// ============================================================================

/// Complete solid FEA model
pub struct SolidModel {
    /// Node coordinates: each entry is [x, y, z]
    pub nodes: Vec<[f64; 3]>,
    /// Hex8 element connectivity: each entry is 8 node indices
    pub hex8_elements: Vec<[usize; 8]>,
    /// Material (single material for now)
    pub material: SolidMaterial,
    /// Fixed DOFs: (global_dof_index, prescribed_displacement_value)
    /// DOF numbering: node_i has DOFs [3*i, 3*i+1, 3*i+2] = [ux, uy, uz]
    pub fixed_dofs: Vec<(usize, f64)>,
    /// Nodal forces: (node_index, [fx, fy, fz])
    pub nodal_forces: Vec<(usize, [f64; 3])>,
}

/// Solution of a solid FEA problem
pub struct SolidResult {
    /// Global displacement vector [u0x, u0y, u0z, u1x, u1y, u1z, ...]
    pub displacements: Vec<f64>,
    /// Element-level stress results at Gauss points
    pub element_stresses: Vec<Vec<StressResult>>,
}

// ============================================================================
// SOLVER
// ============================================================================

/// Solve a solid FEA problem end-to-end.
///
/// This is a REAL solver that:
/// 1. Computes element stiffness matrices using isoparametric Hex8 formulation
/// 2. Assembles the global stiffness matrix K
/// 3. Builds the global force vector F
/// 4. Applies displacement BCs via penalty method
/// 5. Solves K*u = F using LU decomposition
/// 6. Recovers stresses at Gauss points via σ = D·B·u
pub fn solve_solid_model(model: &SolidModel) -> Result<SolidResult, String> {
    let n_nodes = model.nodes.len();
    let n_dof = n_nodes * 3;

    if n_nodes == 0 {
        return Err("No nodes defined".to_string());
    }
    if model.hex8_elements.is_empty() {
        return Err("No elements defined".to_string());
    }

    // Validate connectivity
    for (eid, conn) in model.hex8_elements.iter().enumerate() {
        for &nid in conn {
            if nid >= n_nodes {
                return Err(format!(
                    "Element {}: node index {} out of range (max {})",
                    eid, nid, n_nodes - 1
                ));
            }
        }
    }

    // ===== STEP 1: Assemble global stiffness matrix =====
    let mut k_global = DMatrix::<f64>::zeros(n_dof, n_dof);

    for (eid, conn) in model.hex8_elements.iter().enumerate() {
        // Extract element node coordinates
        let mut coords = [0.0f64; 24];
        for (i, &node_idx) in conn.iter().enumerate() {
            coords[3 * i]     = model.nodes[node_idx][0];
            coords[3 * i + 1] = model.nodes[node_idx][1];
            coords[3 * i + 2] = model.nodes[node_idx][2];
        }

        let elem = Hex8Element::new(coords, model.material.clone());
        let ke = elem.stiffness_matrix(2)
            .ok_or(format!("Element {}: failed to compute stiffness matrix (check node ordering)", eid))?;

        // Scatter element stiffness to global
        for i in 0..8 {
            let gi = conn[i]; // global node index for local node i
            for j in 0..8 {
                let gj = conn[j]; // global node index for local node j
                for di in 0..3 {
                    for dj in 0..3 {
                        let local_row = i * 3 + di;
                        let local_col = j * 3 + dj;
                        let global_row = gi * 3 + di;
                        let global_col = gj * 3 + dj;
                        k_global[(global_row, global_col)] += ke[local_row * 24 + local_col];
                    }
                }
            }
        }
    }

    // ===== STEP 2: Build global force vector =====
    let mut f_global = DVector::<f64>::zeros(n_dof);
    for &(node_idx, forces) in &model.nodal_forces {
        if node_idx >= n_nodes {
            return Err(format!("Nodal force: node index {} out of range", node_idx));
        }
        f_global[node_idx * 3]     += forces[0];
        f_global[node_idx * 3 + 1] += forces[1];
        f_global[node_idx * 3 + 2] += forces[2];
    }

    // ===== STEP 3: Apply boundary conditions (penalty method) =====
    // Penalty value: large enough to enforce BC but not cause ill-conditioning
    let max_diag = (0..n_dof)
        .map(|i| k_global[(i, i)].abs())
        .fold(0.0f64, f64::max);
    let penalty = max_diag * 1e10;

    for &(dof, value) in &model.fixed_dofs {
        if dof >= n_dof {
            return Err(format!("Fixed DOF {} out of range (max {})", dof, n_dof - 1));
        }
        k_global[(dof, dof)] += penalty;
        f_global[dof] += penalty * value;
    }

    // ===== STEP 4: Solve via LU decomposition =====
    let lu = k_global.clone().lu();
    let u_global = lu.solve(&f_global)
        .ok_or("Failed to solve: matrix is singular or ill-conditioned")?;

    let displacements: Vec<f64> = u_global.iter().cloned().collect();

    // ===== STEP 5: Stress recovery =====
    let mut element_stresses = Vec::new();

    for conn in &model.hex8_elements {
        let mut coords = [0.0f64; 24];
        let mut elem_disp = [0.0f64; 24];
        for (i, &node_idx) in conn.iter().enumerate() {
            coords[3 * i]     = model.nodes[node_idx][0];
            coords[3 * i + 1] = model.nodes[node_idx][1];
            coords[3 * i + 2] = model.nodes[node_idx][2];
            elem_disp[3 * i]     = displacements[node_idx * 3];
            elem_disp[3 * i + 1] = displacements[node_idx * 3 + 1];
            elem_disp[3 * i + 2] = displacements[node_idx * 3 + 2];
        }

        let elem = Hex8Element::new(coords, model.material.clone());
        let stresses = elem.stresses(&elem_disp)
            .ok_or("Failed to compute stresses")?;
        element_stresses.push(stresses);
    }

    Ok(SolidResult {
        displacements,
        element_stresses,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_single_hex8_uniaxial() {
        // Unit cube under uniaxial tension in X
        // E = 1000, nu = 0.3
        // Applied stress σ_xx = 100
        // Expected: ε_xx = σ/E = 0.1, ε_yy = ε_zz = -ν·σ/E = -0.03
        let material = SolidMaterial::new(1000.0, 0.3, 1.0, "Test");
        let model = SolidModel {
            nodes: vec![
                [0.0, 0.0, 0.0], // 0
                [1.0, 0.0, 0.0], // 1
                [1.0, 1.0, 0.0], // 2
                [0.0, 1.0, 0.0], // 3
                [0.0, 0.0, 1.0], // 4
                [1.0, 0.0, 1.0], // 5
                [1.0, 1.0, 1.0], // 6
                [0.0, 1.0, 1.0], // 7
            ],
            hex8_elements: vec![[0, 1, 2, 3, 4, 5, 6, 7]],
            material,
            // Fix x=0 face in x-direction, constrain rigid body
            fixed_dofs: vec![
                (0 * 3, 0.0), // node 0 ux = 0
                (3 * 3, 0.0), // node 3 ux = 0
                (4 * 3, 0.0), // node 4 ux = 0
                (7 * 3, 0.0), // node 7 ux = 0
                // Prevent rigid body in y and z
                (0 * 3 + 1, 0.0), // node 0 uy = 0
                (0 * 3 + 2, 0.0), // node 0 uz = 0
                (1 * 3 + 1, 0.0), // node 1 uy = 0
                (1 * 3 + 2, 0.0), // node 1 uz = 0
                (4 * 3 + 1, 0.0), // node 4 uy = 0  (prevent z-face y-drift)
                (3 * 3 + 1, 0.0), // node 3 uy = 0  (prevent y-face y-drift)
            ],
            // Apply σ = 100 Pa on x=1 face (nodes 1,2,5,6), area = 1
            // Force per node = 100 * 1/4 = 25 N
            nodal_forces: vec![
                (1, [25.0, 0.0, 0.0]),
                (2, [25.0, 0.0, 0.0]),
                (5, [25.0, 0.0, 0.0]),
                (6, [25.0, 0.0, 0.0]),
            ],
        };

        let result = solve_solid_model(&model).unwrap();

        // Check axial strain
        let ux_node1 = result.displacements[1 * 3]; // ux at node 1
        let expected_strain = 100.0 / 1000.0; // σ/E = 0.1
        let computed_strain = ux_node1; // since L = 1.0

        assert!(
            (computed_strain - expected_strain).abs() / expected_strain < 0.01,
            "Axial strain: computed={}, expected={}", computed_strain, expected_strain
        );
    }
}
