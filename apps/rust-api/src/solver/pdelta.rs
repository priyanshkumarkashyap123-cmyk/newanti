//! P-Delta Analysis Module
//! 
//! Implements second-order geometric nonlinearity analysis for structures
//! subject to large axial forces and lateral displacements.
//! 
//! THEORY:
//! P-Delta effects account for:
//! - P-Δ (Large): Column shortening effects (inter-story drift)
//! - P-δ (Small): Member curvature effects (within-member deformation)
//! 
//! FORMULATION:
//! [K_T]{Δu} = {ΔP}
//! where K_T = K_E + K_G (elastic + geometric stiffness)
//! 
//! APPLICATIONS:
//! - Tall buildings (e.g., Burj Khalifa 828m)
//! - Long-span bridges
//! - Cable-stayed structures
//! - Slender columns under high axial load
//! - Stability analysis (buckling)

use nalgebra::{DMatrix, DVector};
use serde::{Deserialize, Serialize};
use std::f64;

/// P-Delta analysis configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PDeltaConfig {
    /// Maximum number of iterations
    pub max_iterations: usize,
    
    /// Convergence tolerance for displacement (ratio)
    pub displacement_tolerance: f64,
    
    /// Convergence tolerance for force (N)
    pub force_tolerance: f64,
    
    /// Convergence tolerance for energy (J)
    pub energy_tolerance: f64,
    
    /// Load increment factor (for incremental analysis)
    pub load_increment: f64,
    
    /// Number of load steps
    pub num_load_steps: usize,
    
    /// Include P-δ effects (member curvature)?
    pub include_small_delta: bool,
    
    /// Include P-Δ effects (story drift)?
    pub include_large_delta: bool,
}

impl Default for PDeltaConfig {
    fn default() -> Self {
        Self {
            max_iterations: 100,
            displacement_tolerance: 1e-6,
            force_tolerance: 1e-3,
            energy_tolerance: 1e-6,
            load_increment: 0.1,
            num_load_steps: 10,
            include_small_delta: true,
            include_large_delta: true,
        }
    }
}

/// Convergence criteria for iterative analysis
#[derive(Debug, Clone, Copy, PartialEq)]
pub enum ConvergenceCriteria {
    /// Displacement convergence: ||Δu|| / ||u|| < tol
    Displacement,
    /// Force convergence: ||R|| < tol
    Force,
    /// Energy convergence: |Δu·R| < tol
    Energy,
    /// Combined (all three)
    Combined,
}

/// P-Delta analysis results
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PDeltaResult {
    /// Converged?
    pub converged: bool,
    
    /// Number of iterations used
    pub iterations: usize,
    
    /// Final displacements
    pub displacements: Vec<f64>,
    
    /// Final forces
    pub forces: Vec<f64>,
    
    /// Axial forces in members (for geometric stiffness)
    pub axial_forces: Vec<f64>,
    
    /// Maximum displacement magnitude
    pub max_displacement: f64,
    
    /// Displacement amplification factor (vs. first-order)
    pub amplification_factor: f64,
    
    /// Stability index (P-Δ coefficient)
    pub stability_index: f64,
    
    /// Convergence history
    pub convergence_history: Vec<ConvergenceMetrics>,
    
    /// Analysis time (ms)
    pub analysis_time_ms: f64,
}

/// Convergence metrics for each iteration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConvergenceMetrics {
    pub iteration: usize,
    pub displacement_norm: f64,
    pub force_norm: f64,
    pub energy_norm: f64,
    pub displacement_ratio: f64,
}

/// P-Delta solver
pub struct PDeltaSolver {
    config: PDeltaConfig,
}

impl PDeltaSolver {
    /// Create new P-Delta solver with configuration
    pub fn new(config: PDeltaConfig) -> Self {
        Self { config }
    }
    
    /// Create solver with default configuration
    pub fn default() -> Self {
        Self {
            config: PDeltaConfig::default(),
        }
    }
    
    /// Perform P-Delta analysis
    /// 
    /// # Arguments
    /// * `k_elastic` - Elastic stiffness matrix (n × n)
    /// * `forces` - Applied forces (n × 1)
    /// * `member_geometry` - Member data for geometric stiffness
    /// 
    /// # Returns
    /// P-Delta analysis results
    pub fn analyze(
        &self,
        k_elastic: &DMatrix<f64>,
        forces: &DVector<f64>,
        member_geometry: &[MemberGeometry],
    ) -> Result<PDeltaResult, String> {
        let start_time = std::time::Instant::now();
        let n = k_elastic.nrows();
        
        if k_elastic.ncols() != n {
            return Err("Stiffness matrix must be square".to_string());
        }
        if forces.len() != n {
            return Err("Force vector size must match stiffness matrix".to_string());
        }
        
        // Initialize displacements (first-order analysis)
        let mut u = DVector::zeros(n);
        let mut u_prev = DVector::zeros(n);
        
        // First-order solution (baseline)
        match k_elastic.clone().lu().solve(forces) {
            Some(u0) => {
                u = u0.clone();
                u_prev = u0;
            }
            None => return Err("Stiffness matrix is singular".to_string()),
        }
        
        let u_first_order = u.clone();
        let max_displacement_first_order = u.abs().max();
        
        // Convergence history
        let mut convergence_history = Vec::new();
        let mut converged = false;
        let mut iterations = 0;
        
        // Newton-Raphson iteration
        for iter in 0..self.config.max_iterations {
            iterations = iter + 1;
            
            // Compute axial forces in members
            let axial_forces = self.compute_axial_forces(&u, member_geometry);
            
            // Assemble geometric stiffness matrix (same size as elastic)
            let k_geometric = self.assemble_geometric_stiffness(&axial_forces, member_geometry, n);
            
            // Total tangent stiffness: K_T = K_E + K_G
            let k_tangent = k_elastic + &k_geometric;
            
            // Compute residual: R = F - K_T * u
            let internal_forces = &k_tangent * &u;
            let residual = forces - internal_forces;
            
            // Solve for displacement increment: K_T * Δu = R
            let du = match k_tangent.lu().solve(&residual) {
                Some(delta) => delta,
                None => return Err(format!("Tangent stiffness singular at iteration {}", iter)),
            };
            
            // Update displacements
            u_prev = u.clone();
            u += &du;
            
            // Compute convergence metrics
            let displacement_norm = du.norm();
            let force_norm = residual.norm();
            let energy_norm = du.dot(&residual).abs();
            let displacement_ratio = if u_prev.norm() > 1e-12 {
                displacement_norm / u_prev.norm()
            } else {
                displacement_norm
            };
            
            convergence_history.push(ConvergenceMetrics {
                iteration: iter + 1,
                displacement_norm,
                force_norm,
                energy_norm,
                displacement_ratio,
            });
            
            // Check convergence
            let displacement_converged = displacement_ratio < self.config.displacement_tolerance;
            let force_converged = force_norm < self.config.force_tolerance;
            let energy_converged = energy_norm < self.config.energy_tolerance;
            
            if displacement_converged && force_converged && energy_converged {
                converged = true;
                break;
            }
        }
        
        // Compute final metrics
        let max_displacement = u.abs().max();
        let amplification_factor = if max_displacement_first_order > 1e-12 {
            max_displacement / max_displacement_first_order
        } else {
            1.0
        };
        
        // Stability index: θ = ΣP*Δ / ΣV*h
        // where P = axial force, Δ = story drift, V = story shear, h = story height
        let axial_forces_vec = self.compute_axial_forces(&u, member_geometry);
        
        let mut sum_p_delta = 0.0;
        let mut sum_v_h = 0.0;
        
        for (member, &p) in member_geometry.iter().zip(axial_forces_vec.iter()) {
            let h = member.length();
            if h > 1e-12 {
                // Member drift contribution
                let i_dof = member.node_i_dof;
                let j_dof = member.node_j_dof;
                
                // Drift in direction perpendicular to member
                let delta_perp = if j_dof + 2 < n && i_dof + 2 < n {
                    let du_x = u[j_dof] - u[i_dof];
                    let du_y = u[j_dof + 1] - u[i_dof + 1];
                    (du_x * du_x + du_y * du_y).sqrt()
                } else {
                    0.0
                };
                
                sum_p_delta += p.abs() * delta_perp;
                
                // Approximate story shear from horizontal reactions
                // V ≈ (forces in horizontal DOFs) / h
                let v_approx = if i_dof + 1 < forces.len() {
                    (forces[i_dof].powi(2) + forces[i_dof + 1].powi(2)).sqrt()
                } else {
                    1.0e-12 // Prevent division by zero
                };
                
                sum_v_h += v_approx.max(1.0e-12) * h;
            }
        }
        
        // Stability index with guard for denominator
        let stability_index = if sum_v_h > 1e-12 {
            (sum_p_delta / sum_v_h).clamp(0.0, 1.0)
        } else {
            // Fallback: simplified ratio
            (amplification_factor - 1.0).max(0.0).min(1.0)
        };
        
        let analysis_time_ms = start_time.elapsed().as_secs_f64() * 1000.0;
        
        Ok(PDeltaResult {
            converged,
            iterations,
            displacements: u.as_slice().to_vec(),
            forces: forces.as_slice().to_vec(),
            axial_forces: self.compute_axial_forces(&u, member_geometry),
            max_displacement,
            amplification_factor,
            stability_index,
            convergence_history,
            analysis_time_ms,
        })
    }
    
    /// Compute axial forces in members from displacements
    fn compute_axial_forces(
        &self,
        displacements: &DVector<f64>,
        member_geometry: &[MemberGeometry],
    ) -> Vec<f64> {
        let n_dof = displacements.len();
        
        member_geometry
            .iter()
            .map(|member| {
                // Check if DOFs are within bounds
                if member.node_i_dof + 2 >= n_dof || member.node_j_dof + 2 >= n_dof {
                    return 0.0; // Skip if out of bounds
                }
                
                // Get nodal displacements (first 3 components only: ux, uy, uz)
                let u_i_x = displacements[member.node_i_dof];
                let u_i_y = if member.node_i_dof + 1 < n_dof { displacements[member.node_i_dof + 1] } else { 0.0 };
                let u_i_z = if member.node_i_dof + 2 < n_dof { displacements[member.node_i_dof + 2] } else { 0.0 };
                
                let u_j_x = displacements[member.node_j_dof];
                let u_j_y = if member.node_j_dof + 1 < n_dof { displacements[member.node_j_dof + 1] } else { 0.0 };
                let u_j_z = if member.node_j_dof + 2 < n_dof { displacements[member.node_j_dof + 2] } else { 0.0 };
                
                // Direction vector
                let dx = member.node_j[0] - member.node_i[0];
                let dy = member.node_j[1] - member.node_i[1];
                let dz = member.node_j[2] - member.node_i[2];
                let L = (dx * dx + dy * dy + dz * dz).sqrt();
                
                // Direction cosines
                let cx = dx / L;
                let cy = dy / L;
                let cz = dz / L;
                
                // Axial deformation: Δ = (u_j - u_i) · [c]
                let du_x = u_j_x - u_i_x;
                let du_y = u_j_y - u_i_y;
                let du_z = u_j_z - u_i_z;
                let delta = du_x * cx + du_y * cy + du_z * cz;
                
                // Axial force: P = EA/L * Δ
                member.elastic_modulus * member.area * delta / L
            })
            .collect()
    }
    
    /// Assemble geometric stiffness matrix
    fn assemble_geometric_stiffness(
        &self,
        axial_forces: &[f64],
        member_geometry: &[MemberGeometry],
        n_dof: usize,
    ) -> DMatrix<f64> {
        let mut k_g = DMatrix::zeros(n_dof, n_dof);
        
        for (member, &axial_force) in member_geometry.iter().zip(axial_forces.iter()) {
            // Geometric stiffness coefficient
            let L = member.length();
            let k_geom = axial_force / L;
            
            // Direction cosines
            let (cx, cy, cz) = member.direction_cosines();
            
            // 6×6 geometric stiffness matrix for member
            // K_G = (P/L) * [[I - cc^T, -(I - cc^T)], [-(I - cc^T), I - cc^T]]
            
            // Only assemble if DOFs are within bounds
            if member.node_i_dof + 2 >= n_dof || member.node_j_dof + 2 >= n_dof {
                continue;
            }
            
            for i in 0..3 {
                for j in 0..3 {
                    let c = [cx, cy, cz];
                    let delta_ij = if i == j { 1.0 } else { 0.0 };
                    let term = k_geom * (delta_ij - c[i] * c[j]);
                    
                    let i_dof_a = member.node_i_dof + i;
                    let j_dof_a = member.node_i_dof + j;
                    let i_dof_b = member.node_j_dof + i;
                    let j_dof_b = member.node_j_dof + j;
                    
                    // Check bounds before assignment
                    if i_dof_a < n_dof && j_dof_a < n_dof {
                        k_g[(i_dof_a, j_dof_a)] += term;
                    }
                    if i_dof_a < n_dof && j_dof_b < n_dof {
                        k_g[(i_dof_a, j_dof_b)] -= term;
                    }
                    if i_dof_b < n_dof && j_dof_a < n_dof {
                        k_g[(i_dof_b, j_dof_a)] -= term;
                    }
                    if i_dof_b < n_dof && j_dof_b < n_dof {
                        k_g[(i_dof_b, j_dof_b)] += term;
                    }
                }
            }
        }
        
        k_g
    }
    
    /// Perform incremental P-Delta analysis
    pub fn incremental_analyze(
        &self,
        k_elastic: &DMatrix<f64>,
        forces: &DVector<f64>,
        member_geometry: &[MemberGeometry],
    ) -> Result<Vec<PDeltaResult>, String> {
        let mut results = Vec::new();
        let increment = 1.0 / self.config.num_load_steps as f64;
        
        for step in 1..=self.config.num_load_steps {
            let load_factor = increment * step as f64;
            let incremental_forces = forces * load_factor;
            
            let result = self.analyze(k_elastic, &incremental_forces, member_geometry)?;
            results.push(result);
            
            if !results.last().unwrap().converged {
                return Err(format!("Load step {} failed to converge", step));
            }
        }
        
        Ok(results)
    }
}

/// Member geometry data for P-Delta analysis
#[derive(Debug, Clone)]
pub struct MemberGeometry {
    /// Node i coordinates [x, y, z]
    pub node_i: [f64; 3],
    
    /// Node j coordinates [x, y, z]
    pub node_j: [f64; 3],
    
    /// Node i DOF start index
    pub node_i_dof: usize,
    
    /// Node j DOF start index
    pub node_j_dof: usize,
    
    /// Cross-sectional area (m²)
    pub area: f64,
    
    /// Young's modulus (Pa)
    pub elastic_modulus: f64,
    
    /// Moment of inertia (m⁴) - for P-δ effects
    pub moment_of_inertia: f64,
}

impl MemberGeometry {
    /// Calculate member length
    pub fn length(&self) -> f64 {
        let dx = self.node_j[0] - self.node_i[0];
        let dy = self.node_j[1] - self.node_i[1];
        let dz = self.node_j[2] - self.node_i[2];
        (dx * dx + dy * dy + dz * dz).sqrt()
    }
    
    /// Calculate direction cosines (cx, cy, cz)
    pub fn direction_cosines(&self) -> (f64, f64, f64) {
        let L = self.length();
        let dx = self.node_j[0] - self.node_i[0];
        let dy = self.node_j[1] - self.node_i[1];
        let dz = self.node_j[2] - self.node_i[2];
        (dx / L, dy / L, dz / L)
    }
    
    /// Calculate Euler buckling load
    pub fn euler_buckling_load(&self) -> f64 {
        let L = self.length();
        let E = self.elastic_modulus;
        let I = self.moment_of_inertia;
        
        // P_cr = π²EI/L²
        std::f64::consts::PI.powi(2) * E * I / L.powi(2)
    }
    
    /// Calculate effective length factor (K) based on end conditions
    /// Returns K for simply-supported (K=1.0)
    pub fn effective_length_factor(&self) -> f64 {
        // Default: simply supported (K = 1.0)
        // Fixed-fixed: K = 0.5
        // Fixed-pinned: K = 0.7
        // Pinned-pinned: K = 1.0
        // Fixed-free: K = 2.0
        1.0
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    
    #[test]
    fn test_pdelta_config_default() {
        let config = PDeltaConfig::default();
        
        assert_eq!(config.max_iterations, 100);
        assert_eq!(config.displacement_tolerance, 1e-6);
        assert_eq!(config.force_tolerance, 1e-3);
        assert!(config.include_large_delta);
        assert!(config.include_small_delta);
    }
    
    #[test]
    fn test_member_geometry() {
        let member = MemberGeometry {
            node_i: [0.0, 0.0, 0.0],
            node_j: [3.0, 4.0, 0.0],
            node_i_dof: 0,
            node_j_dof: 6,
            area: 0.01,
            elastic_modulus: 200e9,
            moment_of_inertia: 1e-4,
        };
        
        // Length should be 5.0 (3-4-5 triangle)
        assert!((member.length() - 5.0).abs() < 1e-10);
        
        // Direction cosines
        let (cx, cy, cz) = member.direction_cosines();
        assert!((cx - 0.6).abs() < 1e-10);
        assert!((cy - 0.8).abs() < 1e-10);
        assert!(cz.abs() < 1e-10);
    }
    
    #[test]
    fn test_euler_buckling_load() {
        let member = MemberGeometry {
            node_i: [0.0, 0.0, 0.0],
            node_j: [0.0, 5.0, 0.0],
            node_i_dof: 0,
            node_j_dof: 6,
            area: 0.01,
            elastic_modulus: 200e9,
            moment_of_inertia: 1e-4,
        };
        
        let p_cr = member.euler_buckling_load();
        
        // P_cr = π²EI/L² = π² * 200e9 * 1e-4 / 25
        let expected = std::f64::consts::PI.powi(2) * 200e9 * 1e-4 / 25.0;
        assert!((p_cr - expected).abs() < 1.0);
    }
}
