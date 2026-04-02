//! Enhanced nonlinear analysis: arc-length, continuation methods.

use std::f64::consts::PI;

/// Arc-Length Control (Riks/Crisfield Method)
/// Essential for snap-through, post-buckling, and limit point detection
#[derive(Debug, Clone)]
pub struct ArcLengthSolver {
    pub arc_length: f64,
    pub min_arc_length: f64,
    pub max_arc_length: f64,
    pub max_iterations: usize,
    pub tolerance: f64,
    pub method: ArcLengthMethod,
}

#[derive(Debug, Clone, Copy, PartialEq)]
pub enum ArcLengthMethod {
    Crisfield,      // Cylindrical arc-length
    Riks,           // Spherical arc-length
    Modified,       // Modified Riks with better bifurcation tracking
}

impl Default for ArcLengthSolver {
    fn default() -> Self {
        ArcLengthSolver {
            arc_length: 0.1,
            min_arc_length: 0.001,
            max_arc_length: 1.0,
            max_iterations: 25,
            tolerance: 1e-6,
            method: ArcLengthMethod::Crisfield,
        }
    }
}

/// Arc-length step result
#[derive(Debug, Clone)]
pub struct ArcLengthStep {
    pub displacement: Vec<f64>,
    pub load_factor: f64,
    pub iterations: usize,
    pub converged: bool,
    pub arc_length_used: f64,
}

impl ArcLengthSolver {
    /// Predictor step: estimate initial displacement and load factor increment
    pub fn predictor(
        &self,
        k_tangent: &SparseMatrixCSR,
        f_ref: &[f64],
        u_prev: &[f64],
        lambda_prev: f64,
        delta_lambda_prev: f64,
    ) -> (Vec<f64>, f64) {
        let n = f_ref.len();
        
        // Solve K * δu_f = f_ref
        let mut delta_u_f = vec![0.0; n];
        self.solve_linear(k_tangent, f_ref, &mut delta_u_f);
        
        // Arc-length constraint
        let delta_u_f_norm = norm(&delta_u_f);
        
        // Sign of load factor increment (follow equilibrium path)
        let sign = if delta_lambda_prev >= 0.0 { 1.0 } else { -1.0 };
        
        // Δλ = ± Δl / ||δu_f||
        let delta_lambda = sign * self.arc_length / delta_u_f_norm;
        
        // Δu = Δλ * δu_f
        let delta_u: Vec<f64> = delta_u_f.iter().map(|&x| delta_lambda * x).collect();
        
        let u_new: Vec<f64> = (0..n).map(|i| u_prev[i] + delta_u[i]).collect();
        let lambda_new = lambda_prev + delta_lambda;
        
        (u_new, lambda_new)
    }
    
    /// Corrector iterations with arc-length constraint
    pub fn corrector(
        &self,
        k_tangent_fn: &dyn Fn(&[f64]) -> SparseMatrixCSR,
        internal_force_fn: &dyn Fn(&[f64]) -> Vec<f64>,
        f_ref: &[f64],
        u_pred: Vec<f64>,
        lambda_pred: f64,
        u_base: &[f64],
        lambda_base: f64,
    ) -> ArcLengthStep {
        let n = f_ref.len();
        
        let mut u = u_pred;
        let mut lambda = lambda_pred;
        
        for iter in 0..self.max_iterations {
            // Compute residual: R = λ*f_ref - f_int(u)
            let f_int = internal_force_fn(&u);
            let residual: Vec<f64> = (0..n)
                .map(|i| lambda * f_ref[i] - f_int[i])
                .collect();
            
            let r_norm = norm(&residual);
            let f_norm = norm(f_ref);
            
            // Check convergence
            if r_norm < self.tolerance * f_norm.max(1.0) {
                return ArcLengthStep {
                    displacement: u,
                    load_factor: lambda,
                    iterations: iter + 1,
                    converged: true,
                    arc_length_used: self.arc_length,
                };
            }
            
            // Compute tangent stiffness
            let k_t = k_tangent_fn(&u);
            
            // Solve K_t * δu_r = R
            let mut delta_u_r = vec![0.0; n];
            self.solve_linear(&k_t, &residual, &mut delta_u_r);
            
            // Solve K_t * δu_f = f_ref
            let mut delta_u_f = vec![0.0; n];
            self.solve_linear(&k_t, f_ref, &mut delta_u_f);
            
            // Arc-length constraint equation
            let delta_u_total: Vec<f64> = (0..n).map(|i| u[i] - u_base[i]).collect();
            let delta_lambda_total = lambda - lambda_base;
            
            let (delta_lambda, delta_u) = match self.method {
                ArcLengthMethod::Crisfield => {
                    // Cylindrical: ||Δu||² = Δl²
                    // Solve quadratic: a*δλ² + b*δλ + c = 0
                    let a = dot(&delta_u_f, &delta_u_f);
                    let b = 2.0 * (dot(&delta_u_total, &delta_u_f) + dot(&delta_u_r, &delta_u_f));
                    let c = dot(&delta_u_total, &delta_u_total) + 2.0 * dot(&delta_u_total, &delta_u_r)
                          + dot(&delta_u_r, &delta_u_r) - self.arc_length.powi(2);
                    
                    let discriminant = b * b - 4.0 * a * c;
                    let delta_lambda = if discriminant >= 0.0 {
                        let sqrt_disc = discriminant.sqrt();
                        let dl1 = (-b + sqrt_disc) / (2.0 * a);
                        let dl2 = (-b - sqrt_disc) / (2.0 * a);
                        
                        // Choose root that gives smaller angle with current direction
                        if (delta_lambda_total + dl1).abs() < (delta_lambda_total + dl2).abs() {
                            dl1
                        } else {
                            dl2
                        }
                    } else {
                        0.0  // No solution, use pure correction
                    };
                    
                    let delta_u: Vec<f64> = (0..n)
                        .map(|i| delta_u_r[i] + delta_lambda * delta_u_f[i])
                        .collect();
                    
                    (delta_lambda, delta_u)
                }
                ArcLengthMethod::Riks | ArcLengthMethod::Modified => {
                    // Spherical: ||Δu||² + Δλ² * ||f||² = Δl²
                    // Linearized update
                    let f_norm_sq = dot(f_ref, f_ref);
                    let num = -dot(&delta_u_total, &delta_u_r) - delta_lambda_total * dot(f_ref, &delta_u_r) / f_norm_sq;
                    let den = dot(&delta_u_total, &delta_u_f) + delta_lambda_total + dot(&delta_u_f, &delta_u_f);
                    
                    let delta_lambda = num / den.max(1e-14);
                    let delta_u: Vec<f64> = (0..n)
                        .map(|i| delta_u_r[i] + delta_lambda * delta_u_f[i])
                        .collect();
                    
                    (delta_lambda, delta_u)
                }
            };
            
            // Update
            for i in 0..n {
                u[i] += delta_u[i];
            }
            lambda += delta_lambda;
        }
        
        ArcLengthStep {
            displacement: u,
            load_factor: lambda,
            iterations: self.max_iterations,
            converged: false,
            arc_length_used: self.arc_length,
        }
    }
    
    /// Simple CG solver for the linear system
    fn solve_linear(&self, k: &SparseMatrixCSR, b: &[f64], x: &mut [f64]) {
        let n = b.len();
        x.iter_mut().for_each(|v| *v = 0.0);
        
        let mut r: Vec<f64> = b.to_vec();
        let mut p = r.clone();
        let mut ap = vec![0.0; n];
        
        let mut rtr = dot(&r, &r);
        
        for _iter in 0..1000 {
            k.multiply(&p, &mut ap);
            
            let pap = dot(&p, &ap);
            if pap.abs() < 1e-14 {
                break;
            }
            
            let alpha = rtr / pap;
            
            for i in 0..n {
                x[i] += alpha * p[i];
                r[i] -= alpha * ap[i];
            }
            
            let rtr_new = dot(&r, &r);
            if rtr_new.sqrt() < 1e-10 * dot(b, b).sqrt() {
                break;
            }
            
            let beta = rtr_new / rtr;
            rtr = rtr_new;
            
            for i in 0..n {
                p[i] = r[i] + beta * p[i];
            }
        }
    }
    
    /// Adapt arc-length based on convergence
    pub fn adapt_arc_length(&mut self, iterations: usize, converged: bool) {
        let target_iters = 5;
        
        if !converged {
            self.arc_length = (self.arc_length * 0.5).max(self.min_arc_length);
        } else if iterations < target_iters {
            self.arc_length = (self.arc_length * 1.5).min(self.max_arc_length);
        } else if iterations > target_iters * 2 {
            self.arc_length = (self.arc_length * 0.7).max(self.min_arc_length);
        }
    }
}

/// Automatic Load Stepping with Sub-incrementation
#[derive(Debug, Clone)]
pub struct AdaptiveLoadStepping {
    pub initial_step: f64,
    pub min_step: f64,
    pub max_step: f64,
    pub target_iterations: usize,
    pub bisection_limit: usize,
}

impl Default for AdaptiveLoadStepping {
    fn default() -> Self {
        AdaptiveLoadStepping {
            initial_step: 0.1,
            min_step: 1e-6,
            max_step: 0.5,
            target_iterations: 5,
            bisection_limit: 5,
        }
    }
}

impl AdaptiveLoadStepping {
    /// Compute next step size based on convergence history
    pub fn compute_next_step(&self, prev_step: f64, iterations: usize, converged: bool) -> f64 {
        if !converged {
            (prev_step * 0.25).max(self.min_step)
        } else {
            let ratio = (self.target_iterations as f64 / iterations as f64).sqrt();
            (prev_step * ratio).clamp(self.min_step, self.max_step)
        }
    }
}

