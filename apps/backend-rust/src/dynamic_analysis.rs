//! Enhanced dynamic analysis with multi-step time integration.

use std::f64::consts::PI;

/// Multi-Step Time Integration Methods
/// Implements HHT-α, Generalized-α, and Bathe methods
#[derive(Debug, Clone)]
pub struct AdvancedTimeIntegration {
    pub method: IntegrationMethod,
    pub dt: f64,
    pub alpha: f64,     // HHT-α or Generalized-α parameter
    pub beta: f64,      // Newmark parameter
    pub gamma: f64,     // Newmark parameter
}

#[derive(Debug, Clone, Copy, PartialEq)]
pub enum IntegrationMethod {
    Newmark,            // Standard Newmark-β
    HHTAlpha,           // Hilber-Hughes-Taylor α-method (ABAQUS default)
    GeneralizedAlpha,   // Chung-Hulbert generalized-α (Nastran)
    WilsonTheta,        // Wilson-θ (unconditionally stable)
    Bathe,              // Bathe composite scheme (robust)
    CentralDifference,  // Explicit (conditionally stable)
}

impl Default for AdvancedTimeIntegration {
    fn default() -> Self {
        AdvancedTimeIntegration {
            method: IntegrationMethod::HHTAlpha,
            dt: 0.01,
            alpha: -0.05,   // HHT-α recommended for structural dynamics
            beta: 0.2756,   // (1-α)²/4 for optimal dissipation
            gamma: 0.55,    // (1-2α)/2
        }
    }
}

impl AdvancedTimeIntegration {
    pub fn newmark(dt: f64) -> Self {
        AdvancedTimeIntegration {
            method: IntegrationMethod::Newmark,
            dt,
            alpha: 0.0,
            beta: 0.25,     // Average acceleration
            gamma: 0.5,
            ..Default::default()
        }
    }
    
    pub fn hht_alpha(dt: f64, alpha: f64) -> Self {
        // α should be in [-1/3, 0] for unconditional stability
        let alpha = alpha.clamp(-0.333, 0.0);
        AdvancedTimeIntegration {
            method: IntegrationMethod::HHTAlpha,
            dt,
            alpha,
            beta: (1.0 - alpha).powi(2) / 4.0,
            gamma: (1.0 - 2.0 * alpha) / 2.0,
        }
    }
    
    pub fn generalized_alpha(dt: f64, rho_inf: f64) -> Self {
        // ρ_∞ is spectral radius at infinite frequency [0, 1]
        // ρ_∞ = 0: maximum dissipation, ρ_∞ = 1: no dissipation
        let rho = rho_inf.clamp(0.0, 1.0);
        let alpha_m = (2.0 * rho - 1.0) / (rho + 1.0);
        let alpha_f = rho / (rho + 1.0);
        let gamma = 0.5 - alpha_m + alpha_f;
        let beta = 0.25 * (1.0 - alpha_m + alpha_f).powi(2);
        
        AdvancedTimeIntegration {
            method: IntegrationMethod::GeneralizedAlpha,
            dt,
            alpha: alpha_f - alpha_m,  // Store difference
            beta,
            gamma,
        }
    }
    
    pub fn wilson_theta(dt: f64, theta: f64) -> Self {
        // θ ≥ 1.37 for unconditional stability
        let theta = theta.max(1.37);
        AdvancedTimeIntegration {
            method: IntegrationMethod::WilsonTheta,
            dt,
            alpha: theta,
            beta: 0.25,
            gamma: 0.5,
        }
    }
    
    pub fn bathe(dt: f64) -> Self {
        AdvancedTimeIntegration {
            method: IntegrationMethod::Bathe,
            dt,
            alpha: 0.5,  // Bathe uses dt/2 substeps
            beta: 0.25,
            gamma: 0.5,
        }
    }
    
    /// Compute effective stiffness matrix for implicit integration
    /// K_eff = a0*M + a1*C + K
    pub fn effective_stiffness_coefficients(&self) -> (f64, f64, f64) {
        match self.method {
            IntegrationMethod::Newmark | IntegrationMethod::HHTAlpha => {
                let a0 = 1.0 / (self.beta * self.dt.powi(2));
                let a1 = self.gamma / (self.beta * self.dt);
                (a0, a1, 1.0 + self.alpha)
            }
            IntegrationMethod::GeneralizedAlpha => {
                let a0 = 1.0 / (self.beta * self.dt.powi(2));
                let a1 = self.gamma / (self.beta * self.dt);
                (a0, a1, 1.0)
            }
            IntegrationMethod::WilsonTheta => {
                let theta = self.alpha;
                let dt_eff = theta * self.dt;
                let a0 = 6.0 / dt_eff.powi(2);
                let a1 = 3.0 / dt_eff;
                (a0, a1, 1.0)
            }
            IntegrationMethod::Bathe => {
                let dt_half = self.dt / 2.0;
                let a0 = 16.0 / dt_half.powi(2);
                let a1 = 4.0 / dt_half;
                (a0, a1, 1.0)
            }
            IntegrationMethod::CentralDifference => {
                let a0 = 1.0 / self.dt.powi(2);
                let a1 = 1.0 / (2.0 * self.dt);
                (a0, a1, 0.0)  // Explicit: no stiffness contribution
            }
        }
    }
    
    /// Update displacement, velocity, acceleration after solving
    pub fn update_state(
        &self,
        u_new: &[f64],
        u_old: &[f64],
        v_old: &[f64],
        a_old: &[f64],
    ) -> (Vec<f64>, Vec<f64>) {
        let n = u_new.len();
        let mut v_new = vec![0.0; n];
        let mut a_new = vec![0.0; n];
        
        match self.method {
            IntegrationMethod::Newmark | IntegrationMethod::HHTAlpha |
            IntegrationMethod::GeneralizedAlpha => {
                let c0 = self.gamma / (self.beta * self.dt);
                let c1 = 1.0 - self.gamma / self.beta;
                let c2 = self.dt * (1.0 - self.gamma / (2.0 * self.beta));
                
                let a0 = 1.0 / (self.beta * self.dt.powi(2));
                let a1 = 1.0 / (self.beta * self.dt);
                let a2 = 1.0 / (2.0 * self.beta) - 1.0;
                
                for i in 0..n {
                    let du = u_new[i] - u_old[i];
                    a_new[i] = a0 * du - a1 * v_old[i] - a2 * a_old[i];
                    v_new[i] = v_old[i] + c1 * self.dt * a_old[i] + c0 * du - c2 * a_old[i];
                }
            }
            IntegrationMethod::CentralDifference => {
                let dt2 = self.dt.powi(2);
                for i in 0..n {
                    // Assuming u_prev available (stored in a_old for this scheme)
                    v_new[i] = (u_new[i] - a_old[i]) / (2.0 * self.dt);
                    a_new[i] = (u_new[i] - 2.0 * u_old[i] + a_old[i]) / dt2;
                }
            }
            _ => {
                // Default Newmark-like update
                for i in 0..n {
                    let du = u_new[i] - u_old[i];
                    a_new[i] = du / (self.beta * self.dt.powi(2)) - v_old[i] / (self.beta * self.dt) 
                             - (0.5 / self.beta - 1.0) * a_old[i];
                    v_new[i] = v_old[i] + self.dt * ((1.0 - self.gamma) * a_old[i] + self.gamma * a_new[i]);
                }
            }
        }
        
        (v_new, a_new)
    }
}

/// Modal Superposition with Modal Damping
#[derive(Debug, Clone)]
pub struct ModalSuperposition {
    pub frequencies: Vec<f64>,      // Natural frequencies (rad/s)
    pub mode_shapes: Vec<Vec<f64>>, // Mass-normalized mode shapes
    pub damping_ratios: Vec<f64>,   // Modal damping ratios
    pub participation_factors: Vec<f64>,
}

impl ModalSuperposition {
    pub fn new(
        frequencies: Vec<f64>,
        mode_shapes: Vec<Vec<f64>>,
        damping_ratios: Vec<f64>,
    ) -> Self {
        let n_modes = frequencies.len();
        ModalSuperposition {
            frequencies,
            mode_shapes,
            damping_ratios: if damping_ratios.len() == n_modes {
                damping_ratios
            } else {
                vec![0.05; n_modes]  // Default 5% damping
            },
            participation_factors: vec![1.0; n_modes],
        }
    }
    
    /// Compute participation factors for a given load direction
    pub fn compute_participation_factors(&mut self, m_mat: &[f64], load_dir: &[f64], ndof: usize) {
        self.participation_factors.clear();
        
        for mode in &self.mode_shapes {
            // Γ_i = φ_i^T * M * r / (φ_i^T * M * φ_i)
            // For mass-normalized modes: φ_i^T * M * φ_i = 1
            
            let mut num = 0.0;
            for j in 0..ndof {
                let mut m_r = 0.0;
                for k in 0..ndof {
                    m_r += m_mat[j * ndof + k] * load_dir[k];
                }
                num += mode[j] * m_r;
            }
            
            self.participation_factors.push(num);
        }
    }
    
    /// Solve SDOF modal equation: q̈ + 2ξωq̇ + ω²q = Γ*a(t)
    /// Returns modal coordinate time history
    pub fn integrate_mode(
        &self,
        mode_idx: usize,
        acceleration: &[f64],  // Ground acceleration or load factor history
        dt: f64,
    ) -> Vec<f64> {
        let omega = self.frequencies[mode_idx];
        let xi = self.damping_ratios[mode_idx];
        let gamma = self.participation_factors.get(mode_idx).copied().unwrap_or(1.0);
        
        let _omega_d = omega * (1.0 - xi * xi).sqrt();  // Damped frequency
        
        let n_steps = acceleration.len();
        let mut q = vec![0.0; n_steps];
        let mut q_dot = vec![0.0; n_steps];
        
        // Duhamel integral via Newmark
        let beta = 0.25;
        let gamma_nm = 0.5;
        
        let c0 = 1.0 / (beta * dt.powi(2));
        let c1 = gamma_nm / (beta * dt);
        let c2 = 1.0 / (beta * dt);
        let c3 = 1.0 / (2.0 * beta) - 1.0;
        
        let k_eff = omega * omega + c0 + 2.0 * xi * omega * c1;
        
        for i in 1..n_steps {
            let p_eff = gamma * acceleration[i]
                      + c0 * q[i-1] + c2 * q_dot[i-1] + c3 * 0.0  // a_old approximated
                      + 2.0 * xi * omega * (c1 * q[i-1] + (gamma_nm / beta - 1.0) * q_dot[i-1]);
            
            q[i] = p_eff / k_eff;
            q_dot[i] = c1 * (q[i] - q[i-1]) + (1.0 - gamma_nm / beta) * q_dot[i-1];
        }
        
        q
    }
    
    /// Recover physical displacements from modal coordinates
    pub fn recover_displacement(&self, modal_coords: &[Vec<f64>], time_idx: usize) -> Vec<f64> {
        let n_dof = self.mode_shapes[0].len();
        let mut u = vec![0.0; n_dof];
        
        for (mode_idx, mode) in self.mode_shapes.iter().enumerate() {
            let q_i = modal_coords[mode_idx][time_idx];
            for j in 0..n_dof {
                u[j] += mode[j] * q_i;
            }
        }
        
        u
    }
}

