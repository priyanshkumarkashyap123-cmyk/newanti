use nalgebra::{DMatrix, DVector, SymmetricEigen};
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
}

// ============================================
// MASS MATRIX ASSEMBLY
// ============================================

/// Assemble Global Consistent Mass Matrix
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
             let m_local = consistent_mass_frame(element, L);
             
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

fn consistent_mass_frame(elem: &Element3D, L: f64) -> DMatrix<f64> {
    // Placeholder for 12x12 consistent mass matrix
    DMatrix::zeros(12, 12)
}

// ============================================
// EIGENVALUE SOLVER
// ============================================

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
    for i in 0..dof {
        let m = m_global[(i, i)];
        if m > 1e-9 {
            m_inv_sqrt[(i, i)] = 1.0 / m.sqrt();
        } else {
            // Massless DOF (e.g. rotation in lumped model)
            // Assign dummy small mass? Or condense?
            // Condensation is complex.
            // Dummy mass approach:
            // m_inv_sqrt[(i, i)] = 1.0 / (1e-6).sqrt(); 
            // Better: If diagonal is zero, it might be a static slave DOF.
            // Let's skip dynamics for those or set small mass.
            m_inv_sqrt[(i, i)] = 1.0 / (1e-3).sqrt(); // Small fictitious mass
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
    modes.sort_by(|a, b| a.0.partial_cmp(&b.0).unwrap());
    
    let count = num_modes.min(modes.len());
    let mut frequencies = Vec::new();
    let mut periods = Vec::new();
    let mut mode_shapes_vec = Vec::new();
    
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
        
        // Normalize (Mass normalized? or Unity?)
        // Let's normalize so max displacement is 1.0 for visualization
        let max_disp = x.iter().fold(0.0f64, |acc, &val| acc.max(val.abs()));
        let x_norm = x / max_disp;
        
        // Store in HashMap format
        // Need node mapping passed here or reconstruct? 
        // We will return raw vector for now and mapper handles it?
        // Let's return raw vector logic placeholder
    }

    Ok(ModalResult {
        success: true,
        error: None,
        frequencies,
        periods,
        mode_shapes: vec![], // To be filled by mapper
        mass_participation: vec![], // To be filled
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

pub fn calculate_response_spectrum(
    modal_results: &ModalResult,
    zone_factor: f64, // Z
    importance_factor: f64, // I
    response_reduction: f64, // R
    soil_type: u8, // 1=Hard, 2=Medium, 3=Soft
) -> SeismicResult {
    // IS 1893:2016 Method
    let mut total_base_shear_x = 0.0;
    let mut total_base_shear_z = 0.0;
    
    // SRSS Accumulators
    let mut sum_sq_shear_x = 0.0;
    
    let mut modal_shears = Vec::new();
    
    for (i, T) in modal_results.periods.iter().enumerate() {
        // 1. Calculate Sa/g
        let sa_g = get_spectral_acceleration(*T, soil_type);
        
        // 2. Horizontal Seismic Coefficient (Ah)
        // Ah = (Z * I * Sa/g) / (2 * R)
        let ah = (zone_factor * importance_factor * sa_g) / (2.0 * response_reduction);
        
        // 3. Modal Mass (Mk)
        // Need participation factors. For now assume unity or user provided mock.
        // In real impl, Mk = (phi * M * r)^2 / (phi * M * phi)
        // Let's assume a simplified Modal Mass for the MVP demo based on equal distribution
        // or mock participation for the first few modes (e.g., 80% mass in mode 1)
        let effective_weight = if i == 0 { 100000.0 } else { 10000.0 }; // Mock weight (kN)
        
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

fn get_spectral_acceleration(T: f64, soil: u8) -> f64 {
    // IS 1893 (Part 1): 2016
    match soil {
        1 => { // Hard Soil (Rock)
             if T < 0.10 { 1.0 + 15.0 * T }
             else if T <= 0.40 { 2.5 }
             else { 1.0 / T }
        },
        2 => { // Medium Soil
             if T < 0.10 { 1.0 + 15.0 * T }
             else if T <= 0.55 { 2.5 }
             else { 1.36 / T }
        },
        3 => { // Soft Soil
             if T < 0.10 { 1.0 + 15.0 * T }
             else if T <= 0.67 { 2.5 }
             else { 1.67 / T }
        },
        _ => 2.5 // Conservative
    }
}
