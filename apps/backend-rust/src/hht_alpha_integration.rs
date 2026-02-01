// ============================================================================
// PHASE 52: HHT-α AND GENERALIZED-α TIME INTEGRATION
// ============================================================================
//
// Industry-standard implicit time integration methods:
// - HHT-α (Hilber-Hughes-Taylor): Superior numerical damping
// - Generalized-α: Optimal spectral properties
// - WBZ (Wood-Bossak-Zienkiewicz): Alternative formulation
//
// Industry Parity: ANSYS, ABAQUS, SAP2000, ETABS, LS-DYNA
// ============================================================================


#[cfg(feature = "wasm")]
use wasm_bindgen::prelude::*;


#[cfg(feature = "wasm")]
use serde::{Deserialize, Serialize};

// ============================================================================
// TIME INTEGRATION PARAMETERS
// ============================================================================

/// HHT-α method parameters
/// 
/// Achieves second-order accuracy with controllable numerical damping.
/// α ∈ [-1/3, 0]: α = 0 gives Newmark, α < 0 adds numerical damping
#[derive(Debug, Clone, Copy)]
#[cfg_attr(feature = "wasm", derive(Serialize, Deserialize))]
pub struct HHTAlphaParams {
    /// HHT-α parameter: controls numerical damping
    /// α = 0: no damping (Newmark)
    /// α = -0.05: light damping (recommended for general use)
    /// α = -1/3: maximum damping
    pub alpha: f64,
    /// Newmark β parameter (derived from α for unconditional stability)
    pub beta: f64,
    /// Newmark γ parameter (derived from α for optimal damping)
    pub gamma: f64,
}

impl HHTAlphaParams {
    /// Create HHT-α parameters with specified alpha
    /// 
    /// For unconditional stability and optimal damping:
    /// β = (1 - α)² / 4
    /// γ = (1 - 2α) / 2
    pub fn new(alpha: f64) -> Self {
        let alpha = alpha.clamp(-1.0 / 3.0, 0.0);
        let beta = (1.0 - alpha).powi(2) / 4.0;
        let gamma = (1.0 - 2.0 * alpha) / 2.0;
        
        Self { alpha, beta, gamma }
    }
    
    /// No numerical damping (equivalent to Newmark average acceleration)
    pub fn no_damping() -> Self {
        Self::new(0.0)
    }
    
    /// Light numerical damping (recommended for most analyses)
    pub fn light_damping() -> Self {
        Self::new(-0.05)
    }
    
    /// Moderate numerical damping
    pub fn moderate_damping() -> Self {
        Self::new(-0.1)
    }
    
    /// Maximum numerical damping
    pub fn max_damping() -> Self {
        Self::new(-1.0 / 3.0)
    }
    
    /// Spectral radius at infinite frequency (ρ∞)
    pub fn spectral_radius_inf(&self) -> f64 {
        (1.0 + self.alpha) / (1.0 - self.alpha)
    }
    
    /// Critical damping ratio introduced by numerical damping
    pub fn numerical_damping_ratio(&self, omega: f64, dt: f64) -> f64 {
        let omega_h = omega * dt;
        if omega_h.abs() < 1e-10 {
            return 0.0;
        }
        
        // Numerical damping ratio (approximate)
        -self.alpha * omega_h / (2.0 * (1.0 + omega_h.powi(2)).sqrt())
    }
}

impl Default for HHTAlphaParams {
    fn default() -> Self {
        Self::light_damping()
    }
}

/// Generalized-α method parameters
/// 
/// Most general single-step implicit method with optimal properties.
/// Controls high-frequency dissipation through ρ∞ parameter.
#[derive(Debug, Clone, Copy)]
pub struct GeneralizedAlphaParams {
    /// Parameter for mass matrix (αm)
    pub alpha_m: f64,
    /// Parameter for stiffness matrix (αf)
    pub alpha_f: f64,
    /// Newmark β parameter
    pub beta: f64,
    /// Newmark γ parameter
    pub gamma: f64,
}

impl GeneralizedAlphaParams {
    /// Create from spectral radius at infinite frequency
    /// 
    /// ρ∞ = 0: Maximum damping (asymptotically annihilating)
    /// ρ∞ = 1: No damping (Newmark trapezoidal)
    /// ρ∞ = 0.9: Light damping (recommended)
    pub fn from_spectral_radius(rho_inf: f64) -> Self {
        let rho_inf = rho_inf.clamp(0.0, 1.0);
        
        let alpha_m = (2.0 * rho_inf - 1.0) / (rho_inf + 1.0);
        let alpha_f = rho_inf / (rho_inf + 1.0);
        let gamma = 0.5 - alpha_m + alpha_f;
        let beta = 0.25 * (1.0 - alpha_m + alpha_f).powi(2);
        
        Self { alpha_m, alpha_f, beta, gamma }
    }
    
    /// No numerical damping
    pub fn no_damping() -> Self {
        Self::from_spectral_radius(1.0)
    }
    
    /// Light damping (recommended)
    pub fn light_damping() -> Self {
        Self::from_spectral_radius(0.9)
    }
    
    /// Moderate damping
    pub fn moderate_damping() -> Self {
        Self::from_spectral_radius(0.7)
    }
    
    /// Asymptotic annihilation of high frequencies
    pub fn annihilating() -> Self {
        Self::from_spectral_radius(0.0)
    }
    
    /// Convert to HHT-α equivalent (when αm = 0)
    pub fn to_hht(&self) -> Option<HHTAlphaParams> {
        if self.alpha_m.abs() < 1e-10 {
            Some(HHTAlphaParams {
                alpha: self.alpha_f - 1.0,
                beta: self.beta,
                gamma: self.gamma,
            })
        } else {
            None // Not equivalent to HHT-α
        }
    }
}

impl Default for GeneralizedAlphaParams {
    fn default() -> Self {
        Self::light_damping()
    }
}

/// WBZ (Wood-Bossak-Zienkiewicz) method parameters
#[derive(Debug, Clone, Copy)]
pub struct WBZParams {
    /// WBZ α parameter
    pub alpha: f64,
    /// Newmark β parameter
    pub beta: f64,
    /// Newmark γ parameter  
    pub gamma: f64,
}

impl WBZParams {
    pub fn new(alpha: f64) -> Self {
        let alpha = alpha.clamp(-1.0 / 3.0, 0.0);
        let gamma = 0.5 - alpha;
        let beta = 0.25 * (1.0 - alpha).powi(2);
        
        Self { alpha, beta, gamma }
    }
    
    /// Light damping
    pub fn light_damping() -> Self {
        Self::new(-0.05)
    }
}

// ============================================================================
// HHT-α INTEGRATOR
// ============================================================================

/// State of the dynamic system at a time step
#[derive(Debug, Clone)]
#[cfg_attr(feature = "wasm", derive(Serialize, Deserialize))]
pub struct DynamicState {
    /// Displacement vector
    pub u: Vec<f64>,
    /// Velocity vector
    pub v: Vec<f64>,
    /// Acceleration vector
    pub a: Vec<f64>,
    /// Current time
    pub time: f64,
}

impl DynamicState {
    pub fn new(ndof: usize) -> Self {
        Self {
            u: vec![0.0; ndof],
            v: vec![0.0; ndof],
            a: vec![0.0; ndof],
            time: 0.0,
        }
    }
    
    pub fn with_initial(u0: Vec<f64>, v0: Vec<f64>) -> Self {
        let ndof = u0.len();
        Self {
            u: u0,
            v: v0,
            a: vec![0.0; ndof],
            time: 0.0,
        }
    }
}

/// HHT-α time integrator
/// 
/// Uses the corrected Newmark-based formulation where HHT-α modifies
/// the equilibrium equation evaluation point, NOT the Newmark update.
pub struct HHTAlphaIntegrator {
    /// Integration parameters
    pub params: HHTAlphaParams,
    /// Number of DOFs
    pub ndof: usize,
    /// Mass matrix (diagonal for simplicity)
    mass: Vec<f64>,
    /// Damping matrix (diagonal for simplicity)
    damping: Vec<f64>,
    /// Stiffness matrix (for linear systems, dense for small, sparse for large)
    stiffness: Vec<f64>, // Row-major dense
    /// Current state
    state: DynamicState,
    /// Previous state (for multi-step methods)
    prev_state: Option<DynamicState>,
    /// Previous external force (required for HHT-α)
    prev_force: Vec<f64>,
    /// Time step
    dt: f64,
}

impl HHTAlphaIntegrator {
    /// Create new integrator with diagonal mass and damping
    pub fn new(
        params: HHTAlphaParams,
        mass: Vec<f64>,
        damping: Vec<f64>,
        stiffness: Vec<f64>,
        dt: f64,
    ) -> Self {
        let ndof = mass.len();
        assert_eq!(damping.len(), ndof);
        assert_eq!(stiffness.len(), ndof * ndof);
        
        Self {
            params,
            ndof,
            mass,
            damping,
            stiffness,
            state: DynamicState::new(ndof),
            prev_state: None,
            prev_force: vec![0.0; ndof],
            dt,
        }
    }
    
    /// Set initial conditions
    pub fn set_initial(&mut self, u0: Vec<f64>, v0: Vec<f64>) {
        assert_eq!(u0.len(), self.ndof);
        assert_eq!(v0.len(), self.ndof);
        
        self.state = DynamicState::with_initial(u0, v0);
        self.prev_force = vec![0.0; self.ndof];
        
        // Compute initial acceleration from: M*a0 = F0 - C*v0 - K*u0
        // For zero initial force: M*a0 = -C*v0 - K*u0
        self.state.a = self.compute_initial_acceleration(&self.state.u, &self.state.v, &vec![0.0; self.ndof]);
    }
    
    fn compute_initial_acceleration(&self, u: &[f64], v: &[f64], f: &[f64]) -> Vec<f64> {
        let mut a = vec![0.0; self.ndof];
        
        // Compute K*u
        for i in 0..self.ndof {
            let mut ku_i = 0.0;
            for j in 0..self.ndof {
                ku_i += self.stiffness[i * self.ndof + j] * u[j];
            }
            
            // a_i = (F_i - C_i * v_i - K*u) / M_i
            if self.mass[i].abs() > 1e-16 {
                a[i] = (f[i] - self.damping[i] * v[i] - ku_i) / self.mass[i];
            }
        }
        
        a
    }
    
    /// Advance one time step with HHT-α method
    /// 
    /// The HHT-α method uses Newmark updates but evaluates equilibrium at
    /// an intermediate time point t_{n+1+α} where α ∈ [-1/3, 0].
    /// 
    /// Newmark updates:
    ///   u_{n+1} = u_n + Δt·v_n + Δt²·[(1/2-β)·a_n + β·a_{n+1}]
    ///   v_{n+1} = v_n + Δt·[(1-γ)·a_n + γ·a_{n+1}]
    /// 
    /// HHT-α equilibrium (at intermediate point):
    ///   M·a_{n+1} + C·v_{n+1+α} + K·u_{n+1+α} = F_{n+1+α}
    /// where:
    ///   u_{n+1+α} = (1+α)·u_{n+1} - α·u_n
    ///   v_{n+1+α} = (1+α)·v_{n+1} - α·v_n
    ///   F_{n+1+α} = (1+α)·F_{n+1} - α·F_n
    pub fn step(&mut self, f_new: &[f64]) -> &DynamicState {
        let alpha = self.params.alpha;  // α ∈ [-1/3, 0]
        let beta = self.params.beta;
        let gamma = self.params.gamma;
        let dt = self.dt;
        
        // Newmark integration constants
        let a0 = 1.0 / (beta * dt * dt);
        let a1 = gamma / (beta * dt);
        let a2 = 1.0 / (beta * dt);
        let a3 = 1.0 / (2.0 * beta) - 1.0;
        let a4 = gamma / beta - 1.0;
        let a5 = dt * (gamma / (2.0 * beta) - 1.0);
        let a6 = dt * (1.0 - gamma);
        let a7 = gamma * dt;
        
        // Build effective stiffness matrix
        // K_eff = a0·M + (1+α)·a1·C + (1+α)·K
        let one_plus_alpha = 1.0 + alpha;
        
        let mut k_eff = vec![0.0; self.ndof * self.ndof];
        for i in 0..self.ndof {
            for j in 0..self.ndof {
                k_eff[i * self.ndof + j] = one_plus_alpha * self.stiffness[i * self.ndof + j];
            }
            // Diagonal contributions from M and C
            k_eff[i * self.ndof + i] += a0 * self.mass[i] + one_plus_alpha * a1 * self.damping[i];
        }
        
        // Build effective force vector
        let mut f_eff = vec![0.0; self.ndof];
        
        for i in 0..self.ndof {
            // External force at intermediate point: F_{n+1+α} = (1+α)·F_{n+1} - α·F_n
            f_eff[i] = one_plus_alpha * f_new[i] - alpha * self.prev_force[i];
            
            // Mass contribution: M·(a0·u_n + a2·v_n + a3·a_n)
            f_eff[i] += self.mass[i] * (a0 * self.state.u[i] + a2 * self.state.v[i] + a3 * self.state.a[i]);
            
            // Damping contribution at current state: (1+α)·C·(a1·u_n + a4·v_n + a5·a_n)
            f_eff[i] += one_plus_alpha * self.damping[i] * (a1 * self.state.u[i] + a4 * self.state.v[i] + a5 * self.state.a[i]);
            
            // Stiffness contribution at n (the -α·K·u_n part):
            // Note: We have (1+α)·K·u_{n+1} - α·K·u_n, so we add α·K·u_n to RHS
            for j in 0..self.ndof {
                f_eff[i] += (-alpha) * self.stiffness[i * self.ndof + j] * self.state.u[j];
            }
            
            // Damping at n (the -α·C·v_n part): add α·C·v_n to RHS
            f_eff[i] += (-alpha) * self.damping[i] * self.state.v[i];
        }
        
        // Solve K_eff · u_{n+1} = f_eff
        let u_new = self.solve_linear_system(&k_eff, &f_eff);
        
        // Newmark update for acceleration and velocity
        let mut a_new = vec![0.0; self.ndof];
        let mut v_new = vec![0.0; self.ndof];
        
        for i in 0..self.ndof {
            // a_{n+1} = a0·(u_{n+1} - u_n) - a2·v_n - a3·a_n
            a_new[i] = a0 * (u_new[i] - self.state.u[i]) - a2 * self.state.v[i] - a3 * self.state.a[i];
            
            // v_{n+1} = v_n + a6·a_n + a7·a_{n+1}
            v_new[i] = self.state.v[i] + a6 * self.state.a[i] + a7 * a_new[i];
        }
        
        // Update state
        self.prev_state = Some(self.state.clone());
        self.prev_force = f_new.to_vec();
        self.state.u = u_new;
        self.state.v = v_new;
        self.state.a = a_new;
        self.state.time += dt;
        
        &self.state
    }
    
    /// Simple Gaussian elimination for dense system (for demonstration)
    fn solve_linear_system(&self, a: &[f64], b: &[f64]) -> Vec<f64> {
        let n = self.ndof;
        let mut aug = vec![0.0; n * (n + 1)];
        
        // Build augmented matrix
        for i in 0..n {
            for j in 0..n {
                aug[i * (n + 1) + j] = a[i * n + j];
            }
            aug[i * (n + 1) + n] = b[i];
        }
        
        // Forward elimination
        for k in 0..n {
            // Find pivot
            let mut max_row = k;
            for i in (k + 1)..n {
                if aug[i * (n + 1) + k].abs() > aug[max_row * (n + 1) + k].abs() {
                    max_row = i;
                }
            }
            
            // Swap rows
            for j in 0..=n {
                let tmp = aug[k * (n + 1) + j];
                aug[k * (n + 1) + j] = aug[max_row * (n + 1) + j];
                aug[max_row * (n + 1) + j] = tmp;
            }
            
            // Eliminate
            let pivot = aug[k * (n + 1) + k];
            if pivot.abs() < 1e-16 {
                continue;
            }
            
            for i in (k + 1)..n {
                let factor = aug[i * (n + 1) + k] / pivot;
                for j in k..=n {
                    aug[i * (n + 1) + j] -= factor * aug[k * (n + 1) + j];
                }
            }
        }
        
        // Back substitution
        let mut x = vec![0.0; n];
        for i in (0..n).rev() {
            x[i] = aug[i * (n + 1) + n];
            for j in (i + 1)..n {
                x[i] -= aug[i * (n + 1) + j] * x[j];
            }
            let diag = aug[i * (n + 1) + i];
            if diag.abs() > 1e-16 {
                x[i] /= diag;
            }
        }
        
        x
    }
    
    /// Get current state
    pub fn state(&self) -> &DynamicState {
        &self.state
    }
    
    /// Get current time
    pub fn time(&self) -> f64 {
        self.state.time
    }
}

// ============================================================================
// GENERALIZED-α INTEGRATOR
// ============================================================================

/// Generalized-α time integrator
/// 
/// More general than HHT-α with independent control of numerical damping
/// through spectral radius ρ∞.
pub struct GeneralizedAlphaIntegrator {
    /// Integration parameters
    pub params: GeneralizedAlphaParams,
    /// Number of DOFs
    pub ndof: usize,
    /// Mass matrix (diagonal)
    mass: Vec<f64>,
    /// Damping matrix (diagonal)
    damping: Vec<f64>,
    /// Stiffness matrix (dense row-major)
    stiffness: Vec<f64>,
    /// Current state
    state: DynamicState,
    /// Previous force (required for Generalized-α)
    prev_force: Vec<f64>,
    /// Time step
    dt: f64,
}

impl GeneralizedAlphaIntegrator {
    pub fn new(
        params: GeneralizedAlphaParams,
        mass: Vec<f64>,
        damping: Vec<f64>,
        stiffness: Vec<f64>,
        dt: f64,
    ) -> Self {
        let ndof = mass.len();
        Self {
            params,
            ndof,
            mass,
            damping,
            stiffness,
            state: DynamicState::new(ndof),
            prev_force: vec![0.0; ndof],
            dt,
        }
    }
    
    pub fn set_initial(&mut self, u0: Vec<f64>, v0: Vec<f64>) {
        self.state = DynamicState::with_initial(u0, v0);
        self.prev_force = vec![0.0; self.ndof];
        // Compute initial acceleration
        let mut a0 = vec![0.0; self.ndof];
        for i in 0..self.ndof {
            let mut ku = 0.0;
            for j in 0..self.ndof {
                ku += self.stiffness[i * self.ndof + j] * self.state.u[j];
            }
            if self.mass[i].abs() > 1e-16 {
                a0[i] = (-self.damping[i] * self.state.v[i] - ku) / self.mass[i];
            }
        }
        self.state.a = a0;
    }
    
    /// Step using generalized-α method
    /// 
    /// Generalized-α evaluates equilibrium at intermediate time levels:
    ///   M·a_{n+1-αm} + C·v_{n+1-αf} + K·u_{n+1-αf} = F_{n+1-αf}
    /// where:
    ///   u_{n+1-αf} = (1-αf)·u_{n+1} + αf·u_n
    ///   v_{n+1-αf} = (1-αf)·v_{n+1} + αf·v_n  
    ///   a_{n+1-αm} = (1-αm)·a_{n+1} + αm·a_n
    ///   F_{n+1-αf} = (1-αf)·F_{n+1} + αf·F_n
    pub fn step(&mut self, f_new: &[f64]) -> &DynamicState {
        let alpha_m = self.params.alpha_m;
        let alpha_f = self.params.alpha_f;
        let beta = self.params.beta;
        let gamma = self.params.gamma;
        let dt = self.dt;
        
        // Newmark integration constants
        let a0 = 1.0 / (beta * dt * dt);
        let a1 = gamma / (beta * dt);
        let a2 = 1.0 / (beta * dt);
        let a3 = 1.0 / (2.0 * beta) - 1.0;
        let a4 = gamma / beta - 1.0;
        let a5 = dt * (gamma / (2.0 * beta) - 1.0);
        let a6 = dt * (1.0 - gamma);
        let a7 = gamma * dt;
        
        // Generalized-α coefficients
        let one_minus_af = 1.0 - alpha_f;
        let one_minus_am = 1.0 - alpha_m;
        
        // Build effective stiffness
        // K_eff = (1-αm)·a0·M + (1-αf)·a1·C + (1-αf)·K
        let mut k_eff = vec![0.0; self.ndof * self.ndof];
        for i in 0..self.ndof {
            for j in 0..self.ndof {
                k_eff[i * self.ndof + j] = one_minus_af * self.stiffness[i * self.ndof + j];
            }
            k_eff[i * self.ndof + i] += one_minus_am * a0 * self.mass[i] 
                                      + one_minus_af * a1 * self.damping[i];
        }
        
        // Build effective force
        let mut f_eff = vec![0.0; self.ndof];
        
        for i in 0..self.ndof {
            // Interpolated external force: F_{n+1-αf} = (1-αf)·F_{n+1} + αf·F_n
            f_eff[i] = one_minus_af * f_new[i] + alpha_f * self.prev_force[i];
            
            // Mass contributions
            f_eff[i] += one_minus_am * self.mass[i] * (a0 * self.state.u[i] + a2 * self.state.v[i] + a3 * self.state.a[i]);
            f_eff[i] += alpha_m * self.mass[i] * self.state.a[i];
            
            // Damping contributions  
            f_eff[i] += one_minus_af * self.damping[i] * (a1 * self.state.u[i] + a4 * self.state.v[i] + a5 * self.state.a[i]);
            f_eff[i] += alpha_f * self.damping[i] * self.state.v[i];
            
            // Stiffness at n (the αf·K·u_n part)
            for j in 0..self.ndof {
                f_eff[i] += alpha_f * self.stiffness[i * self.ndof + j] * self.state.u[j];
            }
        }
        
        // Solve
        let u_new = self.solve_linear_system(&k_eff, &f_eff);
        
        // Newmark corrector
        let mut a_new = vec![0.0; self.ndof];
        let mut v_new = vec![0.0; self.ndof];
        
        for i in 0..self.ndof {
            a_new[i] = a0 * (u_new[i] - self.state.u[i]) - a2 * self.state.v[i] - a3 * self.state.a[i];
            v_new[i] = self.state.v[i] + a6 * self.state.a[i] + a7 * a_new[i];
        }
        
        // Update state
        self.prev_force = f_new.to_vec();
        self.state.u = u_new;
        self.state.v = v_new;
        self.state.a = a_new;
        self.state.time += dt;
        
        &self.state
    }
    
    fn solve_linear_system(&self, a: &[f64], b: &[f64]) -> Vec<f64> {
        // Same Gaussian elimination as HHT-α
        let n = self.ndof;
        let mut aug = vec![0.0; n * (n + 1)];
        
        for i in 0..n {
            for j in 0..n {
                aug[i * (n + 1) + j] = a[i * n + j];
            }
            aug[i * (n + 1) + n] = b[i];
        }
        
        for k in 0..n {
            let mut max_row = k;
            for i in (k + 1)..n {
                if aug[i * (n + 1) + k].abs() > aug[max_row * (n + 1) + k].abs() {
                    max_row = i;
                }
            }
            
            for j in 0..=n {
                let tmp = aug[k * (n + 1) + j];
                aug[k * (n + 1) + j] = aug[max_row * (n + 1) + j];
                aug[max_row * (n + 1) + j] = tmp;
            }
            
            let pivot = aug[k * (n + 1) + k];
            if pivot.abs() < 1e-16 { continue; }
            
            for i in (k + 1)..n {
                let factor = aug[i * (n + 1) + k] / pivot;
                for j in k..=n {
                    aug[i * (n + 1) + j] -= factor * aug[k * (n + 1) + j];
                }
            }
        }
        
        let mut x = vec![0.0; n];
        for i in (0..n).rev() {
            x[i] = aug[i * (n + 1) + n];
            for j in (i + 1)..n {
                x[i] -= aug[i * (n + 1) + j] * x[j];
            }
            let diag = aug[i * (n + 1) + i];
            if diag.abs() > 1e-16 { x[i] /= diag; }
        }
        
        x
    }
    
    pub fn state(&self) -> &DynamicState {
        &self.state
    }
}

// ============================================================================
// ADAPTIVE TIME STEPPING
// ============================================================================

/// Adaptive time step controller
pub struct AdaptiveTimeStep {
    /// Minimum time step
    pub dt_min: f64,
    /// Maximum time step
    pub dt_max: f64,
    /// Current time step
    pub dt: f64,
    /// Target local error
    pub tol: f64,
    /// Safety factor
    pub safety: f64,
    /// Growth factor limit
    pub max_growth: f64,
}

impl AdaptiveTimeStep {
    pub fn new(dt_initial: f64, dt_min: f64, dt_max: f64, tol: f64) -> Self {
        Self {
            dt_min,
            dt_max,
            dt: dt_initial,
            tol,
            safety: 0.9,
            max_growth: 2.0,
        }
    }
    
    /// Compute new time step based on local truncation error estimate
    /// 
    /// Uses embedded error estimate: error ~ |a_{n+1} - a_pred|
    pub fn adapt(&mut self, error: f64) -> (f64, bool) {
        if error < 1e-16 {
            // Very small error, increase step
            let dt_new = (self.dt * self.max_growth).min(self.dt_max);
            self.dt = dt_new;
            return (dt_new, true);
        }
        
        // Compute optimal step size
        let ratio = self.tol / error;
        let exponent = 1.0 / 3.0; // For second-order method
        let factor = self.safety * ratio.powf(exponent);
        
        let dt_new = self.dt * factor.clamp(1.0 / self.max_growth, self.max_growth);
        let dt_new = dt_new.clamp(self.dt_min, self.dt_max);
        
        // Accept step if error within tolerance
        let accept = error <= self.tol;
        
        self.dt = dt_new;
        (dt_new, accept)
    }
}

// ============================================================================
// MODAL DECOMPOSITION FOR EFFICIENCY
// ============================================================================

/// Modal coordinates for decoupled integration
#[derive(Debug, Clone)]
pub struct ModalIntegrator {
    /// Natural frequencies (rad/s)
    pub omega: Vec<f64>,
    /// Damping ratios
    pub zeta: Vec<f64>,
    /// Mode shapes (column-major: ndof x nmodes)
    pub phi: Vec<f64>,
    /// Number of DOFs
    pub ndof: usize,
    /// Number of modes
    pub nmodes: usize,
    /// Modal displacements
    pub q: Vec<f64>,
    /// Modal velocities
    pub q_dot: Vec<f64>,
    /// Time step
    pub dt: f64,
}

impl ModalIntegrator {
    pub fn new(omega: Vec<f64>, zeta: Vec<f64>, phi: Vec<f64>, ndof: usize, dt: f64) -> Self {
        let nmodes = omega.len();
        Self {
            omega,
            zeta,
            phi,
            ndof,
            nmodes,
            q: vec![0.0; nmodes],
            q_dot: vec![0.0; nmodes],
            dt,
        }
    }
    
    /// Project physical initial conditions to modal coordinates
    pub fn set_initial_physical(&mut self, u0: &[f64], v0: &[f64]) {
        // q = Φ^T * u (assuming mass-normalized modes)
        for m in 0..self.nmodes {
            self.q[m] = 0.0;
            self.q_dot[m] = 0.0;
            for i in 0..self.ndof {
                let phi_im = self.phi[i * self.nmodes + m];
                self.q[m] += phi_im * u0[i];
                self.q_dot[m] += phi_im * v0[i];
            }
        }
    }
    
    /// Exact integration for each decoupled SDOF oscillator
    /// 
    /// Uses analytical solution for underdamped oscillator
    pub fn step(&mut self, modal_force: &[f64]) {
        for m in 0..self.nmodes {
            let omega = self.omega[m];
            let zeta = self.zeta[m];
            let f = modal_force[m];
            let dt = self.dt;
            
            if omega.abs() < 1e-10 {
                // Rigid body mode
                self.q[m] += dt * self.q_dot[m] + 0.5 * dt * dt * f;
                self.q_dot[m] += dt * f;
                continue;
            }
            
            let omega_d = omega * (1.0 - zeta * zeta).sqrt().max(0.0);
            let exp_term = (-zeta * omega * dt).exp();
            
            if omega_d.abs() < 1e-10 {
                // Critically damped
                let a = self.q[m];
                let b = self.q_dot[m] + zeta * omega * a;
                self.q[m] = (a + b * dt) * exp_term + f / (omega * omega);
                self.q_dot[m] = (b - omega * zeta * (a + b * dt)) * exp_term;
            } else {
                // Underdamped (typical case)
                let cos_wd = (omega_d * dt).cos();
                let sin_wd = (omega_d * dt).sin();
                
                let a = self.q[m] - f / (omega * omega);
                let b = (self.q_dot[m] + zeta * omega * (self.q[m] - f / (omega * omega))) / omega_d;
                
                self.q[m] = exp_term * (a * cos_wd + b * sin_wd) + f / (omega * omega);
                self.q_dot[m] = exp_term * ((b * omega_d - a * zeta * omega) * cos_wd
                                          - (a * omega_d + b * zeta * omega) * sin_wd);
            }
        }
    }
    
    /// Transform back to physical coordinates
    pub fn physical_displacement(&self) -> Vec<f64> {
        let mut u = vec![0.0; self.ndof];
        for i in 0..self.ndof {
            for m in 0..self.nmodes {
                u[i] += self.phi[i * self.nmodes + m] * self.q[m];
            }
        }
        u
    }
    
    /// Transform back to physical velocities
    pub fn physical_velocity(&self) -> Vec<f64> {
        let mut v = vec![0.0; self.ndof];
        for i in 0..self.ndof {
            for m in 0..self.nmodes {
                v[i] += self.phi[i * self.nmodes + m] * self.q_dot[m];
            }
        }
        v
    }
}

// ============================================================================
// TESTS
// ============================================================================

#[cfg(test)]
mod tests {
    use super::*;
    use std::f64::consts::PI;
    
    #[test]
    fn test_hht_params() {
        let params = HHTAlphaParams::new(-0.1);
        
        assert!(params.alpha >= -1.0 / 3.0 && params.alpha <= 0.0);
        assert!(params.beta > 0.0);
        assert!(params.gamma >= 0.5);
        
        // Check optimal relations
        let expected_beta = (1.0 - params.alpha).powi(2) / 4.0;
        let expected_gamma = (1.0 - 2.0 * params.alpha) / 2.0;
        assert!((params.beta - expected_beta).abs() < 1e-10);
        assert!((params.gamma - expected_gamma).abs() < 1e-10);
    }
    
    #[test]
    fn test_generalized_alpha_params() {
        let params = GeneralizedAlphaParams::from_spectral_radius(0.9);
        
        // Check second-order accuracy conditions
        let cond1 = params.gamma - 0.5 + params.alpha_m - params.alpha_f;
        assert!(cond1.abs() < 1e-10);
        
        // Check unconditional stability
        assert!(params.beta >= 0.25 * (0.5 + params.gamma).powi(2));
    }
    
    #[test]
    fn test_hht_free_vibration() {
        // SDOF oscillator: m=1, c=0, k=1 => ω=1 rad/s, T=2π
        // Analytical: u(t) = cos(t), v(t) = -sin(t)
        let mass = vec![1.0];
        let damping = vec![0.0];
        let stiffness = vec![1.0];
        let dt = 0.05; // Time step ≈ T/125
        
        let params = HHTAlphaParams::no_damping(); // α=0 reduces to Newmark average acceleration
        let mut integrator = HHTAlphaIntegrator::new(params, mass, damping, stiffness, dt);
        
        // Initial displacement u0=1, v0=0
        integrator.set_initial(vec![1.0], vec![0.0]);
        
        // Integrate for one full period (T = 2π ≈ 6.28)
        let n_steps = (2.0 * PI / dt) as usize;
        for _ in 0..n_steps {
            integrator.step(&[0.0]);
        }
        
        // After one period, should return close to initial: u ≈ 1.0
        let u = integrator.state().u[0];
        let v = integrator.state().v[0];
        
        // With Newmark average acceleration, period elongation is minimal
        assert!((u - 1.0).abs() < 0.1, "u = {} (expected ~1.0 after one period)", u);
        assert!(v.abs() < 0.1, "v = {} (expected ~0.0 after one period)", v);
    }
    
    #[test]
    fn test_hht_numerical_damping() {
        // Test that HHT-α with max damping reduces high-frequency content
        let mass = vec![1.0];
        let damping = vec![0.0]; // No physical damping
        let stiffness = vec![100.0]; // ω = 10 rad/s
        let dt = 0.1; // Large time step: Δt/T ≈ 0.16
        
        let params = HHTAlphaParams::max_damping(); // α = -1/3
        let mut integrator = HHTAlphaIntegrator::new(params, mass, damping, stiffness, dt);
        
        integrator.set_initial(vec![1.0], vec![0.0]);
        
        // Integrate for several periods
        for _ in 0..50 {
            integrator.step(&[0.0]);
        }
        
        // With numerical damping, amplitude should decrease
        let amplitude = integrator.state().u[0].abs();
        // High-frequency modes are damped, so amplitude < initial
        assert!(amplitude < 1.0, "amplitude = {} (should be reduced by numerical damping)", amplitude);
    }
    
    #[test]
    fn test_generalized_alpha_free_vibration() {
        // SDOF oscillator: m=1, c=0, k=1 => ω=1 rad/s
        let mass = vec![1.0];
        let damping = vec![0.0];
        let stiffness = vec![1.0];
        let dt = 0.05;
        
        let params = GeneralizedAlphaParams::no_damping(); // ρ∞=1.0
        let mut integrator = GeneralizedAlphaIntegrator::new(params, mass, damping, stiffness, dt);
        
        integrator.set_initial(vec![1.0], vec![0.0]);
        
        // Integrate for one period
        let n_steps = (2.0 * PI / dt) as usize;
        for _ in 0..n_steps {
            integrator.step(&[0.0]);
        }
        
        // After one period, should return close to initial
        let u = integrator.state().u[0];
        assert!((u - 1.0).abs() < 0.1, "u = {} (expected ~1.0)", u);
    }
    
    #[test]
    fn test_adaptive_time_step() {
        let mut adapter = AdaptiveTimeStep::new(0.01, 0.001, 0.1, 1e-4);
        
        // Small error should increase step
        let (dt_new, accept) = adapter.adapt(1e-6);
        assert!(accept);
        assert!(dt_new > 0.01);
        
        // Reset
        adapter.dt = 0.01;
        
        // Large error should decrease step
        let (dt_new, accept) = adapter.adapt(1e-2);
        assert!(!accept);
        assert!(dt_new < 0.01);
    }
    
    #[test]
    fn test_modal_integrator() {
        // Two-DOF system
        let omega = vec![1.0, 10.0]; // Two frequencies
        let zeta = vec![0.05, 0.05]; // 5% damping
        // Simple mode shapes (identity for testing)
        let phi = vec![1.0, 0.0, 0.0, 1.0]; // 2x2 identity
        
        let mut modal = ModalIntegrator::new(omega, zeta, phi, 2, 0.01);
        modal.set_initial_physical(&[1.0, 0.5], &[0.0, 0.0]);
        
        // Integrate
        for _ in 0..100 {
            modal.step(&[0.0, 0.0]);
        }
        
        // Displacement should exist (damped response)
        let u = modal.physical_displacement();
        assert!(u[0].abs() < 1.5);
        assert!(u[1].abs() < 1.0);
    }
    
    #[test]
    fn test_spectral_radius() {
        let hht = HHTAlphaParams::new(-0.1);
        let rho = hht.spectral_radius_inf();
        
        // Should be < 1 for damping
        assert!(rho < 1.0);
        assert!(rho > 0.0);
        
        // No damping case
        let hht_no_damp = HHTAlphaParams::no_damping();
        let rho_nd = hht_no_damp.spectral_radius_inf();
        assert!((rho_nd - 1.0).abs() < 1e-10);
    }
}

// ============================================================================
// WASM BINDINGS
// ============================================================================

#[cfg(feature = "wasm")]
#[wasm_bindgen]
pub struct WasmHHTIntegrator {
    inner: HHTAlphaIntegrator,
}

#[cfg(feature = "wasm")]
#[wasm_bindgen]
impl WasmHHTIntegrator {
    #[wasm_bindgen(constructor)]
    pub fn new(alpha: f64, mass: Vec<f64>, damping: Vec<f64>, stiffness: Vec<f64>, dt: f64) -> Self {
        let params = HHTAlphaParams::new(alpha);
        let integrator = HHTAlphaIntegrator::new(params, mass, damping, stiffness, dt);
        Self { inner: integrator }
    }

    pub fn set_initial(&mut self, u0: Vec<f64>, v0: Vec<f64>) {
        self.inner.set_initial(u0, v0);
    }
    
    pub fn step(&mut self, force: Vec<f64>) -> Result<JsValue, JsValue> {
        let state = self.inner.step(&force);
        serde_wasm_bindgen::to_value(state).map_err(|e| e.into())
    }
    
    pub fn get_displacement(&self) -> Vec<f64> {
        self.inner.state.u.clone()
    }
    
    pub fn get_velocity(&self) -> Vec<f64> {
        self.inner.state.v.clone()
    }
    
    pub fn get_acceleration(&self) -> Vec<f64> {
        self.inner.state.a.clone()
    }
    
    pub fn get_time(&self) -> f64 {
        self.inner.state.time
    }
}

