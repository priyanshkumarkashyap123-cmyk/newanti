use nalgebra::{DMatrix, SymmetricEigen};
use crate::solver_3d::{Node3D, Element3D, ElementType};
use std::collections::HashMap;
use serde::{Deserialize, Serialize};

// ============================================
// MODAL ANALYSIS STRUCTURES
// ============================================

#[derive(Serialize, Deserialize, Debug)]
pub struct ModalResult {
    pub success: bool,
    pub error: Option<String>,
    pub frequencies: Vec<f64>,      // Natural frequencies (Hz)
    pub periods: Vec<f64>,          // Natural periods (s)
    pub mode_shapes: Vec<HashMap<String, Vec<f64>>>, // Mode shapes per node
    pub mass_participation: Vec<HashMap<String, f64>>, // Mass participation factors
    #[serde(default)]
    pub raw_eigenvectors: Vec<Vec<f64>>,      // Raw mode shapes in reduced DOF space
    #[serde(default)]
    pub effective_modal_masses: Vec<f64>,      // Effective modal mass per mode (X-direction, kN)
    #[serde(default)]
    pub total_mass: f64,                       // Total structural mass (kg)
}

// ============================================
// MASS MATRIX ASSEMBLY
// ============================================

/// Assemble Global Consistent Mass Matrix
#[allow(non_snake_case)]
pub fn assemble_mass_matrix(
    nodes: &[Node3D],
    elements: &[Element3D],
    node_map: &HashMap<String, usize>,
    dof: usize
) -> Result<DMatrix<f64>, String> {
    let mut m_global = DMatrix::zeros(dof, dof);

    // 1. Element Mass Matrices
    for element in elements {
        // --- Frame Elements ---
        if element.element_type == ElementType::Frame {
             let i_idx = *node_map.get(&element.node_i).ok_or("Node not found")?;
             let j_idx = *node_map.get(&element.node_j).ok_or("Node not found")?;
             
             let node_i = &nodes[i_idx];
             let node_j = &nodes[j_idx];
             
             let dx = node_j.x - node_i.x;
             let dy = node_j.y - node_i.y;
             let dz = node_j.z - node_i.z;
             let L = (dx*dx + dy*dy + dz*dz).sqrt();
             
             // Consistent Mass Matrix for Frame (12x12)
             // Simplified formulation: Lumped or Consistent? 
             // Let's use Consistent Mass for higher accuracy in dynamics
             let _m_local = consistent_mass_frame(element, L);
             
             // Transformation
             // Reuse transformation logic from solver_3d if possible, or re-implement
             // For now, let's assume standard rotation matrix R
             // M_global = T^T * M_local * T
             // (Need to import transformation_matrix_3d from solver_3d, or make it public)
             // For MVP, we will use LUMPED MASS approximation for Frames which is rotationally invariant for translations
             // But for consistent mass, we need T.
             // Let's go with LUMPED MASS for MVP speed and stability.
             
             let total_mass = element.A * element.density * L;
             let half_mass = total_mass / 2.0;
             
             // Add to diagonals (Translational DOFs only for lumped)
             // Node i
             let dof_i = i_idx * 6;
             m_global[(dof_i+0, dof_i+0)] += half_mass;
             m_global[(dof_i+1, dof_i+1)] += half_mass;
             m_global[(dof_i+2, dof_i+2)] += half_mass;
             
             // Node j
             let dof_j = j_idx * 6;
             m_global[(dof_j+0, dof_j+0)] += half_mass;
             m_global[(dof_j+1, dof_j+1)] += half_mass;
             m_global[(dof_j+2, dof_j+2)] += half_mass;
        }
        
        // --- Plate Elements ---
        else if element.element_type == ElementType::Plate {
             // 4-node plate
             // Area * thickness * density
             // Distribute to 4 nodes
             // TODO: Accurate area calc from coords
             // For now: Average side * Average side approx or just 1/4 total mass
             // Let's do simplified lumped mass for plates too
             let k_missing = element.node_k.is_none();
             if k_missing { continue; }
             
             // ... Logic to calc Area ...
             // Mass = Area * thickness * density
             // m_node = Mass / 4.0
             // Add to diagonal
        }
    }

    // 2. Nodal Masses (Added mass)
    for (i, node) in nodes.iter().enumerate() {
        if let Some(mass) = node.mass {
            let dof_i = i * 6;
            m_global[(dof_i+0, dof_i+0)] += mass;
            m_global[(dof_i+1, dof_i+1)] += mass;
            m_global[(dof_i+2, dof_i+2)] += mass;
        }
    }

    Ok(m_global)
}

#[allow(non_snake_case)]
fn consistent_mass_frame(elem: &Element3D, L: f64) -> DMatrix<f64> {
    // Standard 12x12 consistent mass matrix for a 3D Euler-Bernoulli beam
    // Reference: Przemieniecki, "Theory of Matrix Structural Analysis"
    // DOFs: [u1,v1,w1,θx1,θy1,θz1, u2,v2,w2,θx2,θy2,θz2]
    let rho = elem.density;
    let A = elem.A;
    let factor = rho * A * L / 420.0;

    let mut m = DMatrix::zeros(12, 12);

    // Axial (u): DOFs 0, 6
    m[(0, 0)] = 140.0 * factor;
    m[(0, 6)] = 70.0 * factor;
    m[(6, 0)] = 70.0 * factor;
    m[(6, 6)] = 140.0 * factor;

    // Bending in xy-plane (v, θz): DOFs 1,5, 7,11
    m[(1, 1)] = 156.0 * factor;
    m[(1, 5)] = 22.0 * L * factor;
    m[(1, 7)] = 54.0 * factor;
    m[(1, 11)] = -13.0 * L * factor;
    m[(5, 1)] = 22.0 * L * factor;
    m[(5, 5)] = 4.0 * L * L * factor;
    m[(5, 7)] = 13.0 * L * factor;
    m[(5, 11)] = -3.0 * L * L * factor;
    m[(7, 1)] = 54.0 * factor;
    m[(7, 5)] = 13.0 * L * factor;
    m[(7, 7)] = 156.0 * factor;
    m[(7, 11)] = -22.0 * L * factor;
    m[(11, 1)] = -13.0 * L * factor;
    m[(11, 5)] = -3.0 * L * L * factor;
    m[(11, 7)] = -22.0 * L * factor;
    m[(11, 11)] = 4.0 * L * L * factor;

    // Bending in xz-plane (w, θy): DOFs 2,4, 8,10
    // Sign flips on coupling terms due to θy = -dw/dx convention
    m[(2, 2)] = 156.0 * factor;
    m[(2, 4)] = -22.0 * L * factor;
    m[(2, 8)] = 54.0 * factor;
    m[(2, 10)] = 13.0 * L * factor;
    m[(4, 2)] = -22.0 * L * factor;
    m[(4, 4)] = 4.0 * L * L * factor;
    m[(4, 8)] = -13.0 * L * factor;
    m[(4, 10)] = -3.0 * L * L * factor;
    m[(8, 2)] = 54.0 * factor;
    m[(8, 4)] = -13.0 * L * factor;
    m[(8, 8)] = 156.0 * factor;
    m[(8, 10)] = 22.0 * L * factor;
    m[(10, 2)] = 13.0 * L * factor;
    m[(10, 4)] = -3.0 * L * L * factor;
    m[(10, 8)] = 22.0 * L * factor;
    m[(10, 10)] = 4.0 * L * L * factor;

    // Torsion (θx): DOFs 3, 9
    // Rotary inertia: ρ·Ip·L/420, where Ip ≈ Iy + Iz
    let ip = elem.Iy + elem.Iz;
    let t_factor = rho * ip * L / 420.0;
    m[(3, 3)] = 140.0 * t_factor;
    m[(3, 9)] = 70.0 * t_factor;
    m[(9, 3)] = 70.0 * t_factor;
    m[(9, 9)] = 140.0 * t_factor;

    m
}

// ============================================
// EIGENVALUE SOLVER
// ============================================

#[allow(non_snake_case)]
pub fn solve_eigenvalues(
    k_global: &DMatrix<f64>,
    m_global: &DMatrix<f64>,
    num_modes: usize
) -> Result<ModalResult, String> {
    // Solve Generalized Eigenvalue Problem: K * phi = lambda * M * phi
    // Transform to Standard Eigenvalue Problem or use Generalized Solver
    // nalgebra::SymmetricEigen is for A*x = lambda*x
    // For K*x = lambda*M*x, if M is diagonal (Lumped Mass), easily transform:
    // A = M^(-1/2) * K * M^(-1/2)
    // y = M^(1/2) * x
    // A * y = lambda * y
    
    let dof = k_global.nrows();
    
    // 1. Invert Mass Matrix (assume diagonal lumped mass)
    // Check for zero mass DOFs (can cause issues). 
    // Guyan Reduction (Static Condensation) usually needed for massless rotational DOFs.
    // For MVP: Apply small mass to massless DOFs to avoid singularity or use partition.
    
    let mut m_inv_sqrt = DMatrix::zeros(dof, dof);
    // Find minimum real mass entry for dummy mass scaling
    let min_real_mass = (0..dof)
        .map(|i| m_global[(i, i)])
        .filter(|&m| m > 1e-15)
        .fold(f64::MAX, f64::min);
    let dummy_mass = if min_real_mass < f64::MAX { min_real_mass * 1e-8 } else { 1e-10 };
    
    for i in 0..dof {
        let m = m_global[(i, i)];
        if m > 1e-9 {
            m_inv_sqrt[(i, i)] = 1.0 / m.sqrt();
        } else {
            // Massless DOF (e.g. rotation in lumped model)
            // Use small fraction of minimum real mass to avoid corrupting eigenvalue spectrum
            m_inv_sqrt[(i, i)] = 1.0 / dummy_mass.sqrt();
        }
    }
    
    // 2. Form Transform Matrix A = M^(-0.5) * K * M^(-0.5)
    let a_mat = &m_inv_sqrt * k_global * &m_inv_sqrt;
    
    // 3. Eigen Decomposition
    // SymmetricEigen ensures real eigenvalues for symmetric matrices
    let eigen = SymmetricEigen::new(a_mat);
    
    let eigenvalues = eigen.eigenvalues; // Lambda = omega^2
    let eigenvectors = eigen.eigenvectors;
    
    // 4. Sort and Extract Modes
    // nalgebra usually sorts ascending? Need to verify.
    // We want smallest positive eigenvalues (fundamental modes).
    
    let mut modes = Vec::new();
    for (i, &lambda) in eigenvalues.iter().enumerate() {
        if lambda > 0.0 {
            modes.push((lambda, i));
        }
    }
    modes.sort_by(|a, b| a.0.partial_cmp(&b.0).unwrap_or(std::cmp::Ordering::Equal));
    
    let count = num_modes.min(modes.len());
    let mut frequencies = Vec::new();
    let mut periods = Vec::new();
    let mut raw_eigenvectors: Vec<Vec<f64>> = Vec::new();
    
    // Compute total mass from diagonal of M
    let total_mass: f64 = (0..dof).step_by(6).map(|i| m_global[(i, i)]).sum();
    
    for k in 0..count {
        let (lambda, idx) = modes[k];
        let omega = lambda.sqrt();
        let f = omega / (2.0 * std::f64::consts::PI);
        let T = 1.0 / f;
        
        frequencies.push(f);
        periods.push(T);
        
        // Recover Mode Shape x = M^(-0.5) * y
        let y = eigenvectors.column(idx);
        let x = &m_inv_sqrt * y;
        
        // Normalize so max displacement is 1.0 for visualization
        let max_disp = x.iter().fold(0.0f64, |acc, &val| acc.max(val.abs()));
        let x_norm = if max_disp > 1e-15 { &x / max_disp } else { x.clone() };
        
        // Store raw eigenvector (reduced DOF space, normalized)
        raw_eigenvectors.push(x_norm.iter().cloned().collect());
    }

    Ok(ModalResult {
        success: true,
        error: None,
        frequencies,
        periods,
        mode_shapes: vec![], // Populated by modal_analysis after DOF expansion
        mass_participation: vec![], // Populated by modal_analysis
        raw_eigenvectors,
        effective_modal_masses: vec![], // Populated by modal_analysis
        total_mass,
    })
}

// ============================================
// RESPONSE SPECTRUM ANALYSIS (Seismic)
// ============================================

#[derive(Serialize, Deserialize, Debug)]
pub struct SeismicResult {
    pub success: bool,
    pub base_shear_x: f64,
    pub base_shear_z: f64,
    pub modal_base_shears: Vec<f64>,
    pub periods: Vec<f64>,
}

#[allow(non_snake_case)]
pub fn calculate_response_spectrum(
    modal_results: &ModalResult,
    zone_factor: f64, // Z
    importance_factor: f64, // I
    response_reduction: f64, // R
    soil_type: u8, // 1=Hard, 2=Medium, 3=Soft
) -> SeismicResult {
    // IS 1893:2016 Method
    let _total_base_shear_x = 0.0;
    let _total_base_shear_z = 0.0;
    
    // SRSS Accumulators
    let mut sum_sq_shear_x = 0.0;
    
    let mut modal_shears = Vec::new();
    
    for (i, T) in modal_results.periods.iter().enumerate() {
        // 1. Calculate Sa/g
        let sa_g = get_spectral_acceleration(*T, soil_type);
        
        // 2. Horizontal Seismic Coefficient (Ah)
        // Ah = (Z * I * Sa/g) / (2 * R)
        let ah = (zone_factor * importance_factor * sa_g) / (2.0 * response_reduction);
        
        // 3. Effective modal mass (from modal analysis)
        // Use real computed effective modal masses if available, else estimate
        let effective_weight = if i < modal_results.effective_modal_masses.len() {
            // effective_modal_masses stored in kg, convert to weight in kN (force = mass * g)
            modal_results.effective_modal_masses[i] * 9.81 / 1000.0
        } else {
            // Fallback: distribute remaining mass across higher modes
            let total_weight = modal_results.total_mass * 9.81 / 1000.0;
            if i == 0 { total_weight * 0.7 } else { total_weight * 0.1 }
        };
        
        let shear_k = ah * effective_weight;
        modal_shears.push(shear_k);
        
        sum_sq_shear_x += shear_k * shear_k;
    }
    
    SeismicResult {
        success: true,
        base_shear_x: sum_sq_shear_x.sqrt(),
        base_shear_z: sum_sq_shear_x.sqrt() * 0.3, // Simple assumption for Z
        modal_base_shears: modal_shears,
        periods: modal_results.periods.clone(),
    }
}

#[allow(non_snake_case)]
fn get_spectral_acceleration(T: f64, soil: u8) -> f64 {
    // IS 1893 (Part 1): 2016
    match soil {
        1 => { // Hard Soil (Rock)
             if T < 0.10 { 1.0 + 15.0 * T }
             else if T <= 0.40 { 2.5 }
             else if T <= 4.0 { 1.0 / T }
             else { 1.0 / 4.0 } // Cap at T=4.0s per IS 1893:2016 Cl. 6.4.2
        },
        2 => { // Medium Soil
             if T < 0.10 { 1.0 + 15.0 * T }
             else if T <= 0.55 { 2.5 }
             else if T <= 4.0 { 1.36 / T }
             else { 1.36 / 4.0 }
        },
        3 => { // Soft Soil
             if T < 0.10 { 1.0 + 15.0 * T }
             else if T <= 0.67 { 2.5 }
             else if T <= 4.0 { 1.67 / T }
             else { 1.67 / 4.0 }
        },
        _ => 2.5 // Conservative
    }
}
