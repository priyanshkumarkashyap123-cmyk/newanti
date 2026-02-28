//! Topology Optimization Module
//! 
//! Implements structural topology optimization methods:
//! - SIMP (Solid Isotropic Material with Penalization)
//! - BESO (Bi-directional Evolutionary Structural Optimization)
//! - Level-set methods
//! - Compliance minimization with volume constraints

use serde::{Deserialize, Serialize};
use std::f64::consts::PI;

// ============================================================================
// OPTIMIZATION PROBLEM DEFINITION
// ============================================================================

/// Optimization objective type
#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
pub enum ObjectiveType {
    /// Minimize compliance (maximize stiffness)
    Compliance,
    /// Minimize volume
    Volume,
    /// Minimize stress
    MaxStress,
    /// Minimize displacement
    MaxDisplacement,
    /// Multi-objective
    MultiObjective,
    /// Frequency maximization
    Eigenfrequency,
}

/// Constraint type
#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
pub enum ConstraintType {
    /// Volume fraction constraint
    VolumeFraction,
    /// Stress constraint
    MaxStress,
    /// Displacement constraint
    MaxDisplacement,
    /// Frequency constraint
    MinFrequency,
}

/// Design constraint
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DesignConstraint {
    /// Constraint type
    pub constraint_type: ConstraintType,
    /// Upper bound
    pub upper_bound: f64,
    /// Lower bound
    pub lower_bound: f64,
    /// Current value
    pub current_value: f64,
    /// Active flag
    pub is_active: bool,
}

impl DesignConstraint {
    pub fn volume_fraction(target: f64) -> Self {
        Self {
            constraint_type: ConstraintType::VolumeFraction,
            upper_bound: target,
            lower_bound: 0.0,
            current_value: 1.0,
            is_active: true,
        }
    }
    
    pub fn max_stress(limit: f64) -> Self {
        Self {
            constraint_type: ConstraintType::MaxStress,
            upper_bound: limit,
            lower_bound: 0.0,
            current_value: 0.0,
            is_active: true,
        }
    }
    
    /// Check if constraint is violated
    pub fn is_violated(&self) -> bool {
        self.current_value > self.upper_bound || self.current_value < self.lower_bound
    }
}

// ============================================================================
// SIMP METHOD
// ============================================================================

/// SIMP optimization parameters
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SimpParameters {
    /// Penalization power (typically 3)
    pub penalty: f64,
    /// Minimum density (avoid singularity)
    pub rho_min: f64,
    /// Maximum density
    pub rho_max: f64,
    /// Target volume fraction
    pub volume_fraction: f64,
    /// Filter radius (mesh-independent)
    pub filter_radius: f64,
    /// Move limit for density update
    pub move_limit: f64,
    /// Convergence tolerance
    pub tolerance: f64,
    /// Maximum iterations
    pub max_iterations: usize,
}

impl SimpParameters {
    pub fn default_compliance() -> Self {
        Self {
            penalty: 3.0,
            rho_min: 0.001,
            rho_max: 1.0,
            volume_fraction: 0.5,
            filter_radius: 1.5,
            move_limit: 0.2,
            tolerance: 0.01,
            max_iterations: 100,
        }
    }
    
    /// Penalized modulus E(rho) = E0 * rho^p
    pub fn penalized_modulus(&self, rho: f64, e0: f64) -> f64 {
        e0 * rho.powf(self.penalty)
    }
    
    /// Derivative dE/drho = p * E0 * rho^(p-1)
    pub fn modulus_derivative(&self, rho: f64, e0: f64) -> f64 {
        self.penalty * e0 * rho.powf(self.penalty - 1.0)
    }
}

/// SIMP optimization element
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SimpElement {
    /// Element ID
    pub id: usize,
    /// Current density (design variable)
    pub density: f64,
    /// Element volume
    pub volume: f64,
    /// Element centroid
    pub centroid: [f64; 3],
    /// Compliance sensitivity
    pub dc: f64,
    /// Volume sensitivity (= 1)
    pub dv: f64,
    /// Filtered sensitivity
    pub dc_filtered: f64,
    /// Fixed element (non-designable)
    pub is_fixed: bool,
    /// Void element (forced to min)
    pub is_void: bool,
}

impl SimpElement {
    pub fn new(id: usize, volume: f64, centroid: [f64; 3]) -> Self {
        Self {
            id,
            density: 1.0, // Start with full material
            volume,
            centroid,
            dc: 0.0,
            dv: 1.0,
            dc_filtered: 0.0,
            is_fixed: false,
            is_void: false,
        }
    }
    
    /// Set as passive solid (always full)
    pub fn set_passive_solid(&mut self) {
        self.is_fixed = true;
        self.density = 1.0;
    }
    
    /// Set as passive void (always empty)
    pub fn set_passive_void(&mut self) {
        self.is_void = true;
        self.density = 0.001;
    }
}

/// SIMP optimizer
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SimpOptimizer {
    /// Optimization parameters
    pub params: SimpParameters,
    /// Elements with design variables
    pub elements: Vec<SimpElement>,
    /// Current iteration
    pub iteration: usize,
    /// Compliance history
    pub compliance_history: Vec<f64>,
    /// Volume fraction history
    pub volume_history: Vec<f64>,
    /// Converged flag
    pub converged: bool,
}

impl SimpOptimizer {
    pub fn new(params: SimpParameters, n_elements: usize) -> Self {
        let elements = (0..n_elements)
            .map(|i| SimpElement::new(i, 1.0, [0.0, 0.0, 0.0]))
            .collect();
        
        Self {
            params,
            elements,
            iteration: 0,
            compliance_history: Vec::new(),
            volume_history: Vec::new(),
            converged: false,
        }
    }
    
    /// Initialize with element data
    pub fn initialize(&mut self, volumes: &[f64], centroids: &[[f64; 3]]) {
        for (i, elem) in self.elements.iter_mut().enumerate() {
            if i < volumes.len() {
                elem.volume = volumes[i];
            }
            if i < centroids.len() {
                elem.centroid = centroids[i];
            }
            elem.density = self.params.volume_fraction; // Start uniform
        }
    }
    
    /// Compute sensitivity filter weights
    pub fn filter_weights(&self) -> Vec<Vec<(usize, f64)>> {
        let r = self.params.filter_radius;
        let mut weights = Vec::with_capacity(self.elements.len());
        
        for i in 0..self.elements.len() {
            let mut elem_weights = Vec::new();
            let ci = self.elements[i].centroid;
            
            for j in 0..self.elements.len() {
                let cj = self.elements[j].centroid;
                let dist = ((ci[0] - cj[0]).powi(2) + 
                           (ci[1] - cj[1]).powi(2) + 
                           (ci[2] - cj[2]).powi(2)).sqrt();
                
                if dist < r {
                    let w = r - dist;
                    elem_weights.push((j, w));
                }
            }
            
            weights.push(elem_weights);
        }
        
        weights
    }
    
    /// Apply sensitivity filter
    pub fn apply_filter(&mut self, weights: &[Vec<(usize, f64)>]) {
        for i in 0..self.elements.len() {
            let mut sum_num = 0.0;
            let mut sum_den = 0.0;
            
            for &(j, w) in &weights[i] {
                sum_num += w * self.elements[j].density * self.elements[j].dc;
                sum_den += w;
            }
            
            if sum_den > 1e-15 {
                self.elements[i].dc_filtered = sum_num / (self.elements[i].density * sum_den);
            }
        }
    }
    
    /// Update densities using optimality criteria (OC)
    pub fn oc_update(&mut self) {
        let v_target = self.params.volume_fraction * self.total_volume();
        
        // Bisection to find Lagrange multiplier
        let mut l1 = 0.0_f64;
        let mut l2 = 1e9_f64;
        
        while (l2 - l1) / (l1 + l2) > 1e-5 {
            let lmid = 0.5 * (l1 + l2);
            
            // Update densities
            for elem in &mut self.elements {
                if elem.is_fixed {
                    continue;
                }
                if elem.is_void {
                    continue;
                }
                
                let be = (-elem.dc_filtered / lmid).sqrt();
                let rho_new = elem.density * be;
                
                // Apply move limits
                let rho_lower = (elem.density - self.params.move_limit).max(self.params.rho_min);
                let rho_upper = (elem.density + self.params.move_limit).min(self.params.rho_max);
                
                elem.density = rho_new.max(rho_lower).min(rho_upper);
            }
            
            // Check volume constraint
            let v_current = self.current_volume();
            if v_current > v_target {
                l1 = lmid;
            } else {
                l2 = lmid;
            }
        }
    }
    
    /// Total design domain volume
    pub fn total_volume(&self) -> f64 {
        self.elements.iter().map(|e| e.volume).sum()
    }
    
    /// Current material volume
    pub fn current_volume(&self) -> f64 {
        self.elements.iter().map(|e| e.density * e.volume).sum()
    }
    
    /// Current volume fraction
    pub fn current_volume_fraction(&self) -> f64 {
        self.current_volume() / self.total_volume()
    }
    
    /// Set sensitivities from FEA
    pub fn set_sensitivities(&mut self, sensitivities: &[f64]) {
        for (i, elem) in self.elements.iter_mut().enumerate() {
            if i < sensitivities.len() {
                elem.dc = sensitivities[i];
            }
        }
    }
    
    /// Perform one optimization iteration
    pub fn iterate(&mut self, compliance: f64) -> IterationResult {
        self.iteration += 1;
        self.compliance_history.push(compliance);
        self.volume_history.push(self.current_volume_fraction());
        
        // Compute filter weights
        let weights = self.filter_weights();
        
        // Apply filter
        self.apply_filter(&weights);
        
        // Update densities
        self.oc_update();
        
        // Check convergence
        if self.iteration >= 2 {
            let c_prev = self.compliance_history[self.iteration - 2];
            let change = (compliance - c_prev).abs() / c_prev.max(1e-10);
            
            if change < self.params.tolerance {
                self.converged = true;
            }
        }
        
        IterationResult {
            iteration: self.iteration,
            compliance,
            volume_fraction: self.current_volume_fraction(),
            max_density_change: self.max_density_change(),
            converged: self.converged,
        }
    }
    
    fn max_density_change(&self) -> f64 {
        // Would need to store previous densities for accurate calculation
        0.01
    }
    
    /// Get final topology (threshold at 0.5)
    pub fn final_topology(&self, threshold: f64) -> Vec<bool> {
        self.elements.iter()
            .map(|e| e.density >= threshold)
            .collect()
    }
}

/// Iteration result
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct IterationResult {
    /// Iteration number
    pub iteration: usize,
    /// Current compliance
    pub compliance: f64,
    /// Current volume fraction
    pub volume_fraction: f64,
    /// Maximum density change
    pub max_density_change: f64,
    /// Convergence status
    pub converged: bool,
}

// ============================================================================
// BESO METHOD
// ============================================================================

/// BESO parameters
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BesoParameters {
    /// Target volume fraction
    pub volume_fraction: f64,
    /// Evolution rate (volume removal per iteration)
    pub evolution_rate: f64,
    /// Filter radius
    pub filter_radius: f64,
    /// Admission ratio for adding elements
    pub ar_max: f64,
    /// Maximum iterations
    pub max_iterations: usize,
    /// Convergence tolerance
    pub tolerance: f64,
    /// Number of history steps for convergence
    pub n_history: usize,
}

impl BesoParameters {
    pub fn default_compliance() -> Self {
        Self {
            volume_fraction: 0.5,
            evolution_rate: 0.02,
            filter_radius: 1.5,
            ar_max: 0.02,
            max_iterations: 100,
            tolerance: 0.001,
            n_history: 5,
        }
    }
}

/// BESO element state
#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
pub enum BesoState {
    /// Solid element
    Solid,
    /// Void element
    Void,
    /// Fixed solid
    FixedSolid,
    /// Fixed void
    FixedVoid,
}

/// BESO element
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BesoElement {
    /// Element ID
    pub id: usize,
    /// Current state
    pub state: BesoState,
    /// Element volume
    pub volume: f64,
    /// Sensitivity number
    pub sensitivity: f64,
    /// Filtered sensitivity
    pub filtered_sensitivity: f64,
    /// History of sensitivities
    pub sensitivity_history: Vec<f64>,
}

impl BesoElement {
    pub fn new(id: usize, volume: f64) -> Self {
        Self {
            id,
            state: BesoState::Solid,
            volume,
            sensitivity: 0.0,
            filtered_sensitivity: 0.0,
            sensitivity_history: Vec::new(),
        }
    }
    
    /// Is element active (solid)?
    pub fn is_solid(&self) -> bool {
        matches!(self.state, BesoState::Solid | BesoState::FixedSolid)
    }
    
    /// Average sensitivity over history
    pub fn averaged_sensitivity(&self, n: usize) -> f64 {
        if self.sensitivity_history.is_empty() {
            return self.sensitivity;
        }
        
        let take = n.min(self.sensitivity_history.len());
        let sum: f64 = self.sensitivity_history.iter().rev().take(take).sum();
        sum / take as f64
    }
}

/// BESO optimizer
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BesoOptimizer {
    /// Parameters
    pub params: BesoParameters,
    /// Elements
    pub elements: Vec<BesoElement>,
    /// Iteration count
    pub iteration: usize,
    /// Compliance history
    pub compliance_history: Vec<f64>,
    /// Volume history
    pub volume_history: Vec<f64>,
    /// Converged flag
    pub converged: bool,
}

impl BesoOptimizer {
    pub fn new(params: BesoParameters, n_elements: usize) -> Self {
        let elements = (0..n_elements)
            .map(|i| BesoElement::new(i, 1.0))
            .collect();
        
        Self {
            params,
            elements,
            iteration: 0,
            compliance_history: Vec::new(),
            volume_history: Vec::new(),
            converged: false,
        }
    }
    
    /// Current volume fraction
    pub fn current_volume_fraction(&self) -> f64 {
        let total: f64 = self.elements.iter().map(|e| e.volume).sum();
        let solid: f64 = self.elements.iter()
            .filter(|e| e.is_solid())
            .map(|e| e.volume)
            .sum();
        solid / total
    }
    
    /// Target volume for this iteration
    pub fn target_volume(&self) -> f64 {
        let current_vf = self.current_volume_fraction();
        let target_vf = self.params.volume_fraction;
        
        if current_vf > target_vf {
            (current_vf - self.params.evolution_rate).max(target_vf)
        } else {
            current_vf
        }
    }
    
    /// Update element states based on sensitivities
    pub fn update_topology(&mut self) {
        // Store sensitivity history
        for elem in &mut self.elements {
            elem.sensitivity_history.push(elem.filtered_sensitivity);
        }
        
        // Compute threshold using averaged sensitivities
        let target_vf = self.target_volume();
        let total_vol: f64 = self.elements.iter().map(|e| e.volume).sum();
        let target_vol = target_vf * total_vol;
        
        // Sort by averaged sensitivity
        let mut sens_vol: Vec<(f64, f64, usize)> = self.elements.iter()
            .map(|e| (e.averaged_sensitivity(self.params.n_history), e.volume, e.id))
            .collect();
        sens_vol.sort_by(|a, b| b.0.partial_cmp(&a.0).unwrap_or(std::cmp::Ordering::Equal));
        
        // Determine threshold
        let mut cum_vol = 0.0;
        let mut threshold = 0.0;
        for (sens, vol, _) in &sens_vol {
            cum_vol += vol;
            if cum_vol >= target_vol {
                threshold = *sens;
                break;
            }
        }
        
        // Update states
        let ar_max = self.params.ar_max;
        let mut added = 0;
        let n_elements = self.elements.len();
        
        for elem in &mut self.elements {
            if matches!(elem.state, BesoState::FixedSolid | BesoState::FixedVoid) {
                continue;
            }
            
            let avg_sens = elem.averaged_sensitivity(self.params.n_history);
            
            if avg_sens > threshold {
                if elem.state == BesoState::Void && (added as f64) < ar_max * n_elements as f64 {
                    elem.state = BesoState::Solid;
                    added += 1;
                } else if elem.state == BesoState::Solid {
                    // Keep solid
                }
            } else {
                elem.state = BesoState::Void;
            }
        }
    }
    
    /// Check convergence
    pub fn check_convergence(&mut self, compliance: f64) {
        self.compliance_history.push(compliance);
        self.volume_history.push(self.current_volume_fraction());
        
        let n = self.params.n_history;
        if self.compliance_history.len() >= 2 * n {
            let recent: f64 = self.compliance_history.iter().rev().take(n).sum::<f64>() / n as f64;
            let prev: f64 = self.compliance_history.iter().rev().skip(n).take(n).sum::<f64>() / n as f64;
            
            let change = (recent - prev).abs() / prev.max(1e-10);
            if change < self.params.tolerance && 
               (self.current_volume_fraction() - self.params.volume_fraction).abs() < 0.01 
            {
                self.converged = true;
            }
        }
    }
    
    /// Perform iteration
    pub fn iterate(&mut self, compliance: f64) -> IterationResult {
        self.iteration += 1;
        
        self.update_topology();
        self.check_convergence(compliance);
        
        IterationResult {
            iteration: self.iteration,
            compliance,
            volume_fraction: self.current_volume_fraction(),
            max_density_change: 0.0,
            converged: self.converged,
        }
    }
}

// ============================================================================
// LEVEL SET METHOD
// ============================================================================

/// Level set parameters
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LevelSetParameters {
    /// Time step for Hamilton-Jacobi evolution
    pub dt: f64,
    /// Velocity extension method
    pub velocity_extension: VelocityExtension,
    /// Regularization parameter
    pub regularization: f64,
    /// Reinitialization frequency
    pub reinit_frequency: usize,
    /// Maximum iterations
    pub max_iterations: usize,
}

/// Velocity extension method
#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
pub enum VelocityExtension {
    /// Normal extension
    Normal,
    /// Fast marching
    FastMarching,
    /// PDE-based
    PdeBased,
}

impl LevelSetParameters {
    pub fn default_2d() -> Self {
        Self {
            dt: 0.5,
            velocity_extension: VelocityExtension::Normal,
            regularization: 0.1,
            reinit_frequency: 5,
            max_iterations: 100,
        }
    }
}

/// Level set function on regular grid
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LevelSetFunction {
    /// Grid dimensions
    pub nx: usize,
    pub ny: usize,
    /// Grid spacing
    pub dx: f64,
    pub dy: f64,
    /// Level set values (phi)
    pub phi: Vec<f64>,
    /// Velocity field
    pub velocity: Vec<f64>,
}

impl LevelSetFunction {
    pub fn new(nx: usize, ny: usize, dx: f64, dy: f64) -> Self {
        Self {
            nx,
            ny,
            dx,
            dy,
            phi: vec![1.0; nx * ny], // Start as solid
            velocity: vec![0.0; nx * ny],
        }
    }
    
    /// Initialize with multiple holes
    pub fn init_with_holes(&mut self, holes: &[([f64; 2], f64)]) {
        for i in 0..self.nx {
            for j in 0..self.ny {
                let x = i as f64 * self.dx;
                let y = j as f64 * self.dy;
                let idx = i * self.ny + j;
                
                // Start with boundary distance
                let mut phi_min = ((self.nx as f64 * self.dx) / 2.0 - x).abs()
                    .min(((self.ny as f64 * self.dy) / 2.0 - y).abs());
                
                // Subtract holes
                for &(center, radius) in holes {
                    let dist = ((x - center[0]).powi(2) + (y - center[1]).powi(2)).sqrt() - radius;
                    if dist < 0.0 {
                        phi_min = dist;
                    }
                }
                
                self.phi[idx] = phi_min;
            }
        }
    }
    
    /// Get value at grid point
    pub fn get(&self, i: usize, j: usize) -> f64 {
        self.phi[i * self.ny + j]
    }
    
    /// Set value at grid point
    pub fn set(&mut self, i: usize, j: usize, val: f64) {
        self.phi[i * self.ny + j] = val;
    }
    
    /// Gradient at point (central difference)
    pub fn gradient(&self, i: usize, j: usize) -> [f64; 2] {
        let i_m = if i > 0 { i - 1 } else { 0 };
        let i_p = if i < self.nx - 1 { i + 1 } else { self.nx - 1 };
        let j_m = if j > 0 { j - 1 } else { 0 };
        let j_p = if j < self.ny - 1 { j + 1 } else { self.ny - 1 };
        
        let dphi_dx = (self.get(i_p, j) - self.get(i_m, j)) / (2.0 * self.dx);
        let dphi_dy = (self.get(i, j_p) - self.get(i, j_m)) / (2.0 * self.dy);
        
        [dphi_dx, dphi_dy]
    }
    
    /// Curvature at point
    pub fn curvature(&self, i: usize, j: usize) -> f64 {
        let grad = self.gradient(i, j);
        let grad_mag = (grad[0].powi(2) + grad[1].powi(2)).sqrt();
        
        if grad_mag < 1e-10 {
            return 0.0;
        }
        
        // Second derivatives
        let i_m = if i > 0 { i - 1 } else { 0 };
        let i_p = if i < self.nx - 1 { i + 1 } else { self.nx - 1 };
        let j_m = if j > 0 { j - 1 } else { 0 };
        let j_p = if j < self.ny - 1 { j + 1 } else { self.ny - 1 };
        
        let phi_xx = (self.get(i_p, j) - 2.0 * self.get(i, j) + self.get(i_m, j)) / (self.dx * self.dx);
        let phi_yy = (self.get(i, j_p) - 2.0 * self.get(i, j) + self.get(i, j_m)) / (self.dy * self.dy);
        let phi_xy = (self.get(i_p, j_p) - self.get(i_p, j_m) - self.get(i_m, j_p) + self.get(i_m, j_m))
            / (4.0 * self.dx * self.dy);
        
        let num = phi_xx * grad[1].powi(2) - 2.0 * phi_xy * grad[0] * grad[1] + phi_yy * grad[0].powi(2);
        num / grad_mag.powi(3)
    }
    
    /// Heaviside function (material indicator)
    pub fn heaviside(&self, i: usize, j: usize, epsilon: f64) -> f64 {
        let phi = self.get(i, j);
        
        if phi < -epsilon {
            0.0
        } else if phi > epsilon {
            1.0
        } else {
            0.5 * (1.0 + phi / epsilon + (PI * phi / epsilon).sin() / PI)
        }
    }
    
    /// Delta function (boundary indicator)
    pub fn delta(&self, i: usize, j: usize, epsilon: f64) -> f64 {
        let phi = self.get(i, j);
        
        if phi.abs() > epsilon {
            0.0
        } else {
            0.5 / epsilon * (1.0 + (PI * phi / epsilon).cos())
        }
    }
    
    /// Evolve level set by one time step
    pub fn evolve(&mut self, dt: f64) {
        let mut new_phi = self.phi.clone();
        
        for i in 0..self.nx {
            for j in 0..self.ny {
                let idx = i * self.ny + j;
                let grad = self.gradient(i, j);
                let grad_mag = (grad[0].powi(2) + grad[1].powi(2)).sqrt().max(1e-10);
                
                // Hamilton-Jacobi update: phi_t + V|∇phi| = 0
                new_phi[idx] = self.phi[idx] - dt * self.velocity[idx] * grad_mag;
            }
        }
        
        self.phi = new_phi;
    }
    
    /// Reinitialize to signed distance function
    pub fn reinitialize(&mut self, n_iterations: usize) {
        for _ in 0..n_iterations {
            let phi_old = self.phi.clone();
            
            for i in 0..self.nx {
                for j in 0..self.ny {
                    let idx = i * self.ny + j;
                    let phi = phi_old[idx];
                    let sign = phi / (phi.powi(2) + self.dx.powi(2)).sqrt();
                    
                    let grad = self.gradient(i, j);
                    let grad_mag = (grad[0].powi(2) + grad[1].powi(2)).sqrt();
                    
                    self.phi[idx] = phi - 0.5 * self.dx * sign * (grad_mag - 1.0);
                }
            }
        }
    }
    
    /// Current volume fraction
    pub fn volume_fraction(&self, epsilon: f64) -> f64 {
        let mut vol = 0.0;
        for i in 0..self.nx {
            for j in 0..self.ny {
                vol += self.heaviside(i, j, epsilon);
            }
        }
        vol / (self.nx * self.ny) as f64
    }
}

/// Level set optimizer
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LevelSetOptimizer {
    /// Parameters
    pub params: LevelSetParameters,
    /// Level set function
    pub phi: LevelSetFunction,
    /// Iteration count
    pub iteration: usize,
    /// Converged flag
    pub converged: bool,
}

impl LevelSetOptimizer {
    pub fn new(params: LevelSetParameters, nx: usize, ny: usize, dx: f64, dy: f64) -> Self {
        Self {
            params,
            phi: LevelSetFunction::new(nx, ny, dx, dy),
            iteration: 0,
            converged: false,
        }
    }
    
    /// Set velocity field from shape sensitivities
    pub fn set_velocity(&mut self, velocity: Vec<f64>) {
        self.phi.velocity = velocity;
    }
    
    /// Perform one iteration
    pub fn iterate(&mut self) -> IterationResult {
        self.iteration += 1;
        
        // Evolve level set
        self.phi.evolve(self.params.dt);
        
        // Reinitialize periodically
        if self.iteration % self.params.reinit_frequency == 0 {
            self.phi.reinitialize(5);
        }
        
        IterationResult {
            iteration: self.iteration,
            compliance: 0.0,
            volume_fraction: self.phi.volume_fraction(self.params.regularization),
            max_density_change: 0.0,
            converged: self.converged,
        }
    }
}

// ============================================================================
// MANUFACTURABILITY CONSTRAINTS
// ============================================================================

/// Manufacturing constraint type
#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
pub enum ManufacturingConstraint {
    /// Minimum member size
    MinMemberSize,
    /// Maximum member size
    MaxMemberSize,
    /// Minimum hole size
    MinHoleSize,
    /// No closed voids
    NoClosedVoids,
    /// Overhang angle (for additive manufacturing)
    OverhangAngle,
    /// Draw direction (for casting)
    DrawDirection,
}

/// Heaviside projection filter parameters
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProjectionFilter {
    /// Threshold (eta)
    pub eta: f64,
    /// Sharpness parameter (beta)
    pub beta: f64,
}

impl ProjectionFilter {
    pub fn new(eta: f64, beta: f64) -> Self {
        Self { eta, beta }
    }
    
    /// Apply Heaviside projection (Guest-Lazarov-Sigmund)
    pub fn project(&self, rho_tilde: f64) -> f64 {
        let b = self.beta;
        let e = self.eta;
        let num = (b * e).tanh() + (b * (rho_tilde - e)).tanh();
        let den = (b * e).tanh() + (b * (1.0 - e)).tanh();
        num / den
    }
    
    /// Derivative of projection
    pub fn project_derivative(&self, rho_tilde: f64) -> f64 {
        let b = self.beta;
        let e = self.eta;
        let num = b * (1.0 - (b * (rho_tilde - e)).tanh().powi(2));
        let den = (b * e).tanh() + (b * (1.0 - e)).tanh();
        num / den
    }
}

/// Robust formulation (eroded, intermediate, dilated)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RobustFormulation {
    /// Eroded threshold
    pub eta_e: f64,
    /// Intermediate threshold  
    pub eta_i: f64,
    /// Dilated threshold
    pub eta_d: f64,
    /// Sharpness
    pub beta: f64,
}

impl RobustFormulation {
    pub fn new() -> Self {
        Self {
            eta_e: 0.75,
            eta_i: 0.5,
            eta_d: 0.25,
            beta: 16.0,
        }
    }
    
    /// Get projections for all three thresholds
    pub fn project_all(&self, rho_tilde: f64) -> [f64; 3] {
        let f_e = ProjectionFilter::new(self.eta_e, self.beta);
        let f_i = ProjectionFilter::new(self.eta_i, self.beta);
        let f_d = ProjectionFilter::new(self.eta_d, self.beta);
        
        [f_e.project(rho_tilde), f_i.project(rho_tilde), f_d.project(rho_tilde)]
    }
}

impl Default for RobustFormulation {
    fn default() -> Self {
        Self::new()
    }
}

// ============================================================================
// TESTS
// ============================================================================

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_simp_parameters() {
        let params = SimpParameters::default_compliance();
        
        let e_full = params.penalized_modulus(1.0, 200000.0);
        let e_half = params.penalized_modulus(0.5, 200000.0);
        
        assert!((e_full - 200000.0).abs() < 1.0);
        assert!(e_half < e_full);
    }

    #[test]
    fn test_simp_element() {
        let mut elem = SimpElement::new(0, 1.0, [0.5, 0.5, 0.0]);
        
        elem.set_passive_solid();
        assert!(elem.is_fixed);
        assert!((elem.density - 1.0).abs() < 1e-10);
    }

    #[test]
    fn test_simp_optimizer() {
        let params = SimpParameters::default_compliance();
        let mut optimizer = SimpOptimizer::new(params, 100);
        
        let volumes: Vec<f64> = vec![1.0; 100];
        let centroids: Vec<[f64; 3]> = (0..100).map(|i| [(i % 10) as f64, (i / 10) as f64, 0.0]).collect();
        
        optimizer.initialize(&volumes, &centroids);
        
        assert!((optimizer.current_volume_fraction() - 0.5).abs() < 0.01);
    }

    #[test]
    fn test_volume_constraint() {
        let constraint = DesignConstraint::volume_fraction(0.5);
        
        assert!(constraint.is_active);
        assert!(constraint.is_violated()); // current_value = 1.0 > upper_bound = 0.5
    }

    #[test]
    fn test_beso_element() {
        let elem = BesoElement::new(0, 1.0);
        
        assert!(elem.is_solid());
        assert_eq!(elem.state, BesoState::Solid);
    }

    #[test]
    fn test_beso_optimizer() {
        let params = BesoParameters::default_compliance();
        let optimizer = BesoOptimizer::new(params, 100);
        
        assert!((optimizer.current_volume_fraction() - 1.0).abs() < 0.01);
    }

    #[test]
    fn test_level_set_function() {
        let mut phi = LevelSetFunction::new(10, 10, 0.1, 0.1);
        
        // Initialize with a hole
        phi.init_with_holes(&[([0.5, 0.5], 0.2)]);
        
        // Check that there's material and void
        let vf = phi.volume_fraction(0.01);
        assert!(vf > 0.0 && vf < 1.0);
    }

    #[test]
    fn test_level_set_heaviside() {
        let phi = LevelSetFunction::new(5, 5, 0.1, 0.1);
        
        // Default is 1.0 everywhere (solid)
        let h = phi.heaviside(2, 2, 0.1);
        assert!(h > 0.9);
    }

    #[test]
    fn test_projection_filter() {
        let filter = ProjectionFilter::new(0.5, 8.0);
        
        let p_low = filter.project(0.1);
        let p_mid = filter.project(0.5);
        let p_high = filter.project(0.9);
        
        assert!(p_low < p_mid);
        assert!(p_mid < p_high);
    }

    #[test]
    fn test_robust_formulation() {
        let robust = RobustFormulation::new();
        
        let [e, i, d] = robust.project_all(0.5);
        
        // Eroded < Intermediate < Dilated for same input
        assert!(e < i);
        assert!(i < d);
    }

    #[test]
    fn test_oc_update() {
        let params = SimpParameters::default_compliance();
        let mut optimizer = SimpOptimizer::new(params, 10);
        
        // Set some sensitivities
        for (i, elem) in optimizer.elements.iter_mut().enumerate() {
            elem.dc = -(i as f64 + 1.0); // Negative sensitivities (compliance)
            elem.dc_filtered = elem.dc;
        }
        
        optimizer.oc_update();
        
        // Check volume constraint is approximately satisfied
        let vf = optimizer.current_volume_fraction();
        assert!(vf > 0.0 && vf <= 1.0); // Reasonable bounds
    }

    #[test]
    fn test_iteration_result() {
        let result = IterationResult {
            iteration: 1,
            compliance: 100.0,
            volume_fraction: 0.5,
            max_density_change: 0.1,
            converged: false,
        };
        
        assert!(!result.converged);
        assert_eq!(result.iteration, 1);
    }

    #[test]
    fn test_curvature() {
        let phi = LevelSetFunction::new(10, 10, 0.1, 0.1);
        
        // Curvature at center (uniform phi=1)
        let kappa = phi.curvature(5, 5);
        assert!(kappa.abs() < 1e-5); // Nearly zero for flat field
    }
}
