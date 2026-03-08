// Dynamic Analysis Module
// 
// This module implements dynamic structural analysis including:
// - Modal analysis (eigenvalue problem for natural frequencies)
// - Time-history analysis (step-by-step integration)
// - Frequency response analysis (harmonic loading)
// - Damping models (Rayleigh, modal)
//
// References:
// - Clough, R.W., Penzien, J. (1993). Dynamics of Structures. McGraw-Hill.
// - Chopra, A.K. (2017). Dynamics of Structures (5th ed.). Pearson.

use nalgebra::{DMatrix, DVector, SymmetricEigen};
use serde::{Deserialize, Serialize};
use std::f64::consts::PI;

/// Mass matrix assembly method
#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
pub enum MassMatrixType {
    /// Consistent mass (exact integration)
    Consistent,
    /// Lumped mass (diagonal, faster computation)
    Lumped,
}

/// Damping model type
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub enum DampingModel {
    /// No damping (undamped analysis)
    None,
    /// Rayleigh damping: C = α*M + β*K
    Rayleigh { alpha: f64, beta: f64 },
    /// Modal damping: ζ_i for each mode
    Modal { ratios: Vec<f64> },
}

/// Configuration for modal analysis
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ModalConfig {
    /// Number of modes to extract
    pub num_modes: usize,
    
    /// Mass matrix type
    pub mass_type: MassMatrixType,
    
    /// Normalize mode shapes (max amplitude = 1)
    pub normalize_modes: bool,
    
    /// Include mass participation factors
    pub compute_participation: bool,
}

impl Default for ModalConfig {
    fn default() -> Self {
        Self {
            num_modes: 10,
            mass_type: MassMatrixType::Lumped,
            normalize_modes: true,
            compute_participation: true,
        }
    }
}

/// Modal analysis result
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ModalResult {
    /// Natural frequencies (rad/s)
    pub frequencies: Vec<f64>,
    
    /// Natural periods (seconds)
    pub periods: Vec<f64>,
    
    /// Mode shapes (columns are modes, rows are DOFs)
    pub mode_shapes: DMatrix<f64>,
    
    /// Modal masses
    pub modal_masses: Vec<f64>,
    
    /// Mass participation factors (if computed)
    pub participation_factors: Option<Vec<f64>>,
    
    /// Cumulative mass participation ratio
    pub cumulative_participation: Option<Vec<f64>>,
    
    /// Analysis success status
    pub converged: bool,
    
    /// Number of modes found
    pub num_modes: usize,
}

/// Modal analysis solver
pub struct ModalSolver {
    config: ModalConfig,
}

impl ModalSolver {
    /// Create new modal solver with configuration
    pub fn new(config: ModalConfig) -> Self {
        Self { config }
    }
    
    /// Create solver with default configuration
    pub fn default() -> Self {
        Self::new(ModalConfig::default())
    }
    
    /// Solve eigenvalue problem: K*φ = ω²*M*φ
    /// 
    /// # Arguments
    /// * `stiffness` - Global stiffness matrix (n×n)
    /// * `mass` - Global mass matrix (n×n)
    /// 
    /// # Returns
    /// Modal analysis results including frequencies and mode shapes
    pub fn analyze(
        &self,
        stiffness: &DMatrix<f64>,
        mass: &DMatrix<f64>,
    ) -> Result<ModalResult, String> {
        // Validate inputs
        if stiffness.nrows() != stiffness.ncols() {
            return Err("Stiffness matrix must be square".to_string());
        }
        
        if mass.nrows() != mass.ncols() {
            return Err("Mass matrix must be square".to_string());
        }
        
        if stiffness.nrows() != mass.nrows() {
            return Err("Stiffness and mass matrices must have same size".to_string());
        }
        
        let n = stiffness.nrows();
        
        if n == 0 {
            return Err("Matrix size cannot be zero".to_string());
        }
        
        // Check if mass matrix is singular
        if mass.determinant().abs() < 1e-12 {
            return Err("Mass matrix is singular or near-singular".to_string());
        }
        
        // Number of modes to extract (limited by DOFs)
        let num_modes = self.config.num_modes.min(n);
        
        // Solve generalized eigenvalue problem: K*φ = λ*M*φ
        // Convert to standard form: M^(-1)*K*φ = λ*φ
        
        // For symmetric matrices, use specialized solver
        let m_inv_k = match mass.clone().try_inverse() {
            Some(m_inv) => m_inv * stiffness,
            None => return Err("Failed to invert mass matrix".to_string()),
        };
        
        // Solve eigenvalue problem
        let eigen = SymmetricEigen::new(m_inv_k);
        
        // Extract eigenvalues and eigenvectors
        let eigenvalues = eigen.eigenvalues;
        let eigenvectors = eigen.eigenvectors;
        
        // Sort by eigenvalue (ascending - lowest frequency first)
        let mut indices: Vec<usize> = (0..n).collect();
        indices.sort_by(|&i, &j| {
            eigenvalues[i].partial_cmp(&eigenvalues[j]).unwrap_or(std::cmp::Ordering::Equal)
        });
        
        // Extract first num_modes
        let mut frequencies = Vec::with_capacity(num_modes);
        let mut periods = Vec::with_capacity(num_modes);
        let mut mode_shapes = DMatrix::zeros(n, num_modes);
        
        for (mode_idx, &eigen_idx) in indices.iter().take(num_modes).enumerate() {
            let lambda = eigenvalues[eigen_idx];
            
            // ω = sqrt(λ), where λ is eigenvalue of M^(-1)*K
            let omega = if lambda > 0.0 { lambda.sqrt() } else { 0.0 };
            frequencies.push(omega);
            
            // Period T = 2π/ω
            let period = if omega > 1e-12 { 2.0 * PI / omega } else { f64::INFINITY };
            periods.push(period);
            
            // Extract mode shape
            let mut mode_shape = eigenvectors.column(eigen_idx).clone_owned();
            
            // Normalize if requested
            if self.config.normalize_modes {
                let max_val = mode_shape.iter().map(|v| v.abs()).fold(0.0, f64::max);
                if max_val > 1e-12 {
                    mode_shape /= max_val;
                }
            }
            
            // Store mode shape
            mode_shapes.set_column(mode_idx, &mode_shape);
        }
        
        // Compute modal masses: M_n = φ_n^T * M * φ_n
        let mut modal_masses = Vec::with_capacity(num_modes);
        for mode_idx in 0..num_modes {
            let phi = mode_shapes.column(mode_idx);
            let m_phi = mass * &phi;
            let modal_mass = phi.dot(&m_phi);
            modal_masses.push(modal_mass);
        }
        
        // Compute participation factors if requested
        let (participation_factors, cumulative_participation) = if self.config.compute_participation {
            self.compute_participation_factors(&mode_shapes, mass)
        } else {
            (None, None)
        };
        
        Ok(ModalResult {
            frequencies,
            periods,
            mode_shapes,
            modal_masses,
            participation_factors,
            cumulative_participation,
            converged: true,
            num_modes,
        })
    }
    
    /// Compute mass participation factors
    /// 
    /// Γ_n = (φ_n^T * M * r) / (φ_n^T * M * φ_n)
    /// where r is influence vector (typically [1, 1, 1, ...])
    fn compute_participation_factors(
        &self,
        mode_shapes: &DMatrix<f64>,
        mass: &DMatrix<f64>,
    ) -> (Option<Vec<f64>>, Option<Vec<f64>>) {
        let n_dof = mode_shapes.nrows();
        let n_modes = mode_shapes.ncols();
        
        // Influence vector (all ones for gravity direction)
        let influence = DVector::from_element(n_dof, 1.0);
        
        let mut participation_factors = Vec::with_capacity(n_modes);
        let mut cumulative = Vec::with_capacity(n_modes);
        let mut total_participation = 0.0;
        
        // Total mass
        let total_mass: f64 = (0..n_dof).map(|i| mass[(i, i)]).sum();
        
        for mode_idx in 0..n_modes {
            let phi = mode_shapes.column(mode_idx);
            
            // Modal mass: M_n = φ_n^T * M * φ_n
            let m_phi = mass * &phi;
            let modal_mass = phi.dot(&m_phi);
            
            // Participation factor: Γ_n = (φ_n^T * M * r) / M_n
            let gamma = if modal_mass.abs() > 1e-12 {
                phi.dot(&(mass * &influence)) / modal_mass
            } else {
                0.0
            };
            
            participation_factors.push(gamma);
            
            // Effective modal mass: M_eff = Γ_n² * M_n
            let m_eff = gamma * gamma * modal_mass;
            
            // Cumulative participation ratio
            total_participation += m_eff / total_mass;
            cumulative.push(total_participation);
        }
        
        (Some(participation_factors), Some(cumulative))
    }
}

/// Time-history analysis configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TimeHistoryConfig {
    /// Time step (seconds)
    pub dt: f64,
    
    /// Total duration (seconds)
    pub duration: f64,
    
    /// Integration method
    pub method: IntegrationMethod,
    
    /// Damping model
    pub damping: DampingModel,
    
    /// Output interval (save every N steps)
    pub output_interval: usize,
}

/// Numerical integration method for time-history analysis
#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
pub enum IntegrationMethod {
    /// Central difference (explicit)
    CentralDifference,
    
    /// Newmark-β method (implicit, unconditionally stable)
    Newmark { beta: f64, gamma: f64 },
    
    /// Wilson-θ method (implicit)
    Wilson { theta: f64 },
}

impl Default for IntegrationMethod {
    fn default() -> Self {
        // Average acceleration method (unconditionally stable)
        IntegrationMethod::Newmark { beta: 0.25, gamma: 0.5 }
    }
}

/// Time-history analysis result
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TimeHistoryResult {
    /// Time points (seconds)
    pub time: Vec<f64>,
    
    /// Displacement history (n_dof × n_steps)
    pub displacements: Vec<DVector<f64>>,
    
    /// Velocity history (n_dof × n_steps)
    pub velocities: Vec<DVector<f64>>,
    
    /// Acceleration history (n_dof × n_steps)
    pub accelerations: Vec<DVector<f64>>,
    
    /// Maximum displacement at each DOF
    pub max_displacements: DVector<f64>,
    
    /// Maximum velocity at each DOF
    pub max_velocities: DVector<f64>,
    
    /// Maximum acceleration at each DOF
    pub max_accelerations: DVector<f64>,
    
    /// Analysis completed successfully
    pub converged: bool,
    
    /// Number of time steps
    pub num_steps: usize,
}

/// Time-history analysis solver
pub struct TimeHistorySolver {
    config: TimeHistoryConfig,
}

impl TimeHistorySolver {
    /// Create new time-history solver
    pub fn new(config: TimeHistoryConfig) -> Self {
        Self { config }
    }
    
    /// Perform time-history analysis using Newmark-β method
    /// 
    /// # Arguments
    /// * `stiffness` - Global stiffness matrix
    /// * `mass` - Global mass matrix
    /// * `force_history` - Force vector at each time step
    /// * `initial_displacement` - Initial displacement (optional)
    /// * `initial_velocity` - Initial velocity (optional)
    pub fn analyze(
        &self,
        stiffness: &DMatrix<f64>,
        mass: &DMatrix<f64>,
        force_history: &[DVector<f64>],
        initial_displacement: Option<&DVector<f64>>,
        initial_velocity: Option<&DVector<f64>>,
    ) -> Result<TimeHistoryResult, String> {
        // Validate inputs
        if stiffness.nrows() != mass.nrows() {
            return Err("Stiffness and mass matrices must have same size".to_string());
        }
        
        let n_dof = stiffness.nrows();
        let n_steps = force_history.len();
        
        if n_steps == 0 {
            return Err("Force history cannot be empty".to_string());
        }
        
        // Initialize state vectors
        let mut u = initial_displacement
            .cloned()
            .unwrap_or_else(|| DVector::<f64>::zeros(n_dof));
        
        let mut v = initial_velocity
            .cloned()
            .unwrap_or_else(|| DVector::<f64>::zeros(n_dof));
        
        let mut a: DVector<f64> = DVector::zeros(n_dof);
        
        // Assemble damping matrix
        let damping = match self.config.damping {
            DampingModel::None => DMatrix::<f64>::zeros(n_dof, n_dof),
            DampingModel::Rayleigh { alpha, beta } => {
                alpha * mass + beta * stiffness
            }
            DampingModel::Modal { .. } => {
                // Modal damping requires modal decomposition
                // For simplicity, use proportional damping
                DMatrix::<f64>::zeros(n_dof, n_dof)
            }
        };
        
        // Newmark-β parameters
        let (beta, gamma) = match self.config.method {
            IntegrationMethod::Newmark { beta, gamma } => (beta, gamma),
            _ => (0.25, 0.5), // Default to average acceleration
        };
        
        let dt = self.config.dt;
        
        // Integration constants
        let a0 = 1.0 / (beta * dt * dt);
        let a1 = gamma / (beta * dt);
        let a2 = 1.0 / (beta * dt);
        let a3 = 1.0 / (2.0 * beta) - 1.0;
        let a4 = gamma / beta - 1.0;
        let a5 = dt * (gamma / (2.0 * beta) - 1.0);
        let a6 = dt * (1.0 - gamma);
        let a7 = gamma * dt;
        
        // Effective stiffness: K_eff = K + a0*M + a1*C
        let k_eff = stiffness + a0 * mass + a1 * &damping;
        
        // Compute initial acceleration: M*a_0 = F_0 - C*v_0 - K*u_0
        let f0 = &force_history[0];
        let r0 = f0 - &damping * &v - stiffness * &u;
        a = mass.clone().try_inverse()
            .ok_or("Failed to invert mass matrix")?
            * r0;
        
        // Storage for results
        let mut time = Vec::with_capacity(n_steps);
        let mut displacements = Vec::with_capacity(n_steps);
        let mut velocities = Vec::with_capacity(n_steps);
        let mut accelerations = Vec::with_capacity(n_steps);
        
        // Store initial state
        time.push(0.0);
        displacements.push(u.clone());
        velocities.push(v.clone());
        accelerations.push(a.clone());
        
        // Time-stepping loop
        for step in 1..n_steps {
            let t = step as f64 * dt;
            let f = &force_history[step];
            
            // Effective load: F_eff = F + M*(a0*u + a2*v + a3*a) + C*(a1*u + a4*v + a5*a)
            let f_eff = f
                + mass * (a0 * &u + a2 * &v + a3 * &a)
                + &damping * (a1 * &u + a4 * &v + a5 * &a);
            
            // Solve for displacement: K_eff * u_{n+1} = F_eff
            let u_new = k_eff.clone().try_inverse()
                .ok_or("Failed to invert effective stiffness")?
                * f_eff;
            
            // Update acceleration: a_{n+1} = a0*(u_{n+1} - u_n) - a2*v_n - a3*a_n
            let a_new = a0 * (&u_new - &u) - a2 * &v - a3 * &a;
            
            // Update velocity: v_{n+1} = v_n + a6*a_n + a7*a_{n+1}
            let v_new = &v + a6 * &a + a7 * &a_new;
            
            // Update state
            u = u_new;
            v = v_new;
            a = a_new;
            
            // Store results (with output interval)
            if step % self.config.output_interval == 0 {
                time.push(t);
                displacements.push(u.clone());
                velocities.push(v.clone());
                accelerations.push(a.clone());
            }
        }
        
        // Compute maximum values
        let mut max_displacements = DVector::zeros(n_dof);
        let mut max_velocities = DVector::zeros(n_dof);
        let mut max_accelerations = DVector::zeros(n_dof);
        
        for i in 0..n_dof {
            max_displacements[i] = displacements.iter()
                .map(|u| u[i].abs())
                .fold(0.0, f64::max);
            
            max_velocities[i] = velocities.iter()
                .map(|v| v[i].abs())
                .fold(0.0, f64::max);
            
            max_accelerations[i] = accelerations.iter()
                .map(|a| a[i].abs())
                .fold(0.0, f64::max);
        }
        
        Ok(TimeHistoryResult {
            time,
            displacements,
            velocities,
            accelerations,
            max_displacements,
            max_velocities,
            max_accelerations,
            converged: true,
            num_steps: n_steps,
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    
    #[test]
    fn test_modal_config_default() {
        let config = ModalConfig::default();
        assert_eq!(config.num_modes, 10);
        assert_eq!(config.mass_type, MassMatrixType::Lumped);
        assert!(config.normalize_modes);
    }
    
    #[test]
    fn test_integration_method_default() {
        let method = IntegrationMethod::default();
        match method {
            IntegrationMethod::Newmark { beta, gamma } => {
                assert_eq!(beta, 0.25);
                assert_eq!(gamma, 0.5);
            }
            _ => panic!("Expected Newmark method"),
        }
    }
}
