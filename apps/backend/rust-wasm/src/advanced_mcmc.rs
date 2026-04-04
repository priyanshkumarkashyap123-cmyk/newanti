//! Advanced MCMC Methods
//!
//! Industry-standard advanced Markov Chain Monte Carlo algorithms.
//! Critical gap vs Stan, PyMC, NumPyro.
//!
//! ## Industry Gap Analysis
//!
//! | Feature | Stan | PyMC | NumPyro | This Module |
//! |---------|------|------|---------|-------------|
//! | HMC | ✓ | ✓ | ✓ | ✓ |
//! | NUTS | ✓ | ✓ | ✓ | ✓ |
//! | Parallel Tempering | ✗ | ✓ | ✗ | ✓ |
//! | SMC | ✗ | ✓ | ✓ | ✓ |
//! | DREAM | ✗ | ✓ | ✗ | ✓ |
//! | Adaptive HMC | ✓ | ✓ | ✓ | ✓ |

use std::f64::consts::PI;

// ============================================================================
// HAMILTONIAN MONTE CARLO (HMC)
// ============================================================================

/// Hamiltonian Monte Carlo sampler
/// Industry standard: Stan, PyMC, JAX
///
/// Uses Hamiltonian dynamics for efficient exploration of
/// probability distributions. Much better than random walk
/// for high-dimensional problems.
#[derive(Debug, Clone)]
pub struct HMC {
    pub dimension: usize,
    pub step_size: f64,
    pub n_leapfrog_steps: usize,
    pub mass_matrix: MassMatrix,
    pub samples: Vec<Vec<f64>>,
    pub acceptance_rate: f64,
}

#[derive(Debug, Clone)]
pub enum MassMatrix {
    /// Identity mass matrix (simplest)
    Identity,
    /// Diagonal mass matrix (adapted)
    Diagonal(Vec<f64>),
    /// Full mass matrix (most general)
    Full(Vec<Vec<f64>>),
}

impl MassMatrix {
    pub fn sample_momentum(&self, rng_state: &mut u64, n: usize) -> Vec<f64> {
        match self {
            MassMatrix::Identity => {
                (0..n).map(|_| box_muller_normal(rng_state)).collect()
            }
            MassMatrix::Diagonal(m) => {
                (0..n).map(|i| m[i].sqrt() * box_muller_normal(rng_state)).collect()
            }
            MassMatrix::Full(m) => {
                // Cholesky L of M
                let l = cholesky(m);
                let z: Vec<f64> = (0..n).map(|_| box_muller_normal(rng_state)).collect();
                mat_vec_mult(&l, &z)
            }
        }
    }

    pub fn kinetic_energy(&self, p: &[f64]) -> f64 {
        match self {
            MassMatrix::Identity => {
                0.5 * p.iter().map(|&pi| pi * pi).sum::<f64>()
            }
            MassMatrix::Diagonal(m) => {
                0.5 * p.iter().zip(m.iter())
                    .map(|(&pi, &mi)| pi * pi / mi)
                    .sum::<f64>()
            }
            MassMatrix::Full(m) => {
                let m_inv = invert_matrix(m);
                let m_inv_p = mat_vec_mult(&m_inv, p);
                0.5 * p.iter().zip(m_inv_p.iter())
                    .map(|(&pi, &mip)| pi * mip)
                    .sum::<f64>()
            }
        }
    }

    pub fn velocity(&self, p: &[f64]) -> Vec<f64> {
        match self {
            MassMatrix::Identity => p.to_vec(),
            MassMatrix::Diagonal(m) => {
                p.iter().zip(m.iter()).map(|(&pi, &mi)| pi / mi).collect()
            }
            MassMatrix::Full(m) => {
                let m_inv = invert_matrix(m);
                mat_vec_mult(&m_inv, p)
            }
        }
    }
}

impl HMC {
    pub fn new(dimension: usize) -> Self {
        HMC {
            dimension,
            step_size: 0.1,
            n_leapfrog_steps: 10,
            mass_matrix: MassMatrix::Identity,
            samples: Vec::new(),
            acceptance_rate: 0.0,
        }
    }

    pub fn with_step_size(mut self, eps: f64) -> Self {
        self.step_size = eps;
        self
    }

    pub fn with_leapfrog_steps(mut self, n: usize) -> Self {
        self.n_leapfrog_steps = n;
        self
    }

    pub fn with_mass_matrix(mut self, m: MassMatrix) -> Self {
        self.mass_matrix = m;
        self
    }

    /// Run HMC sampling
    pub fn sample<F, G>(
        &mut self,
        n_samples: usize,
        n_warmup: usize,
        initial: &[f64],
        log_prob: F,
        grad_log_prob: G,
    ) where
        F: Fn(&[f64]) -> f64,
        G: Fn(&[f64]) -> Vec<f64>,
    {
        let mut rng_state = 42u64;
        let mut q = initial.to_vec();

        // Warmup with step size adaptation
        for i in 0..n_warmup {
            let result = self.hmc_step(&q, &log_prob, &grad_log_prob, &mut rng_state);
            
            if result.accepted {
                q = result.position;
            }

            // Adapt step size to target ~65% acceptance
            let adapt_rate = 0.05 / (1.0 + i as f64 / 100.0);
            let acceptance_prob = result.acceptance_prob;
            
            if acceptance_prob > 0.65 {
                self.step_size *= 1.0 + adapt_rate;
            } else {
                self.step_size *= 1.0 - adapt_rate;
            }
            
            self.step_size = self.step_size.clamp(1e-6, 1.0);
        }

        // Reset for sampling
        let mut n_accepted = 0;
        self.samples.clear();

        // Main sampling
        for _ in 0..n_samples {
            let result = self.hmc_step(&q, &log_prob, &grad_log_prob, &mut rng_state);
            
            if result.accepted {
                q = result.position;
                n_accepted += 1;
            }
            
            self.samples.push(q.clone());
        }

        self.acceptance_rate = n_accepted as f64 / n_samples as f64;
    }

    fn hmc_step<F, G>(
        &self,
        q: &[f64],
        log_prob: &F,
        grad_log_prob: &G,
        rng_state: &mut u64,
    ) -> HMCResult
    where
        F: Fn(&[f64]) -> f64,
        G: Fn(&[f64]) -> Vec<f64>,
    {
        let n = self.dimension;
        let eps = self.step_size;
        let l = self.n_leapfrog_steps;

        // Sample momentum
        let p0 = self.mass_matrix.sample_momentum(rng_state, n);
        
        // Initial Hamiltonian
        let h0 = -log_prob(q) + self.mass_matrix.kinetic_energy(&p0);

        // Leapfrog integration
        let mut q_new = q.to_vec();
        let mut p_new = p0.clone();

        // Half step for momentum
        let grad = grad_log_prob(&q_new);
        for i in 0..n {
            p_new[i] += 0.5 * eps * grad[i];
        }

        // Full steps
        for _ in 0..(l - 1) {
            // Full step for position
            let v = self.mass_matrix.velocity(&p_new);
            for i in 0..n {
                q_new[i] += eps * v[i];
            }

            // Full step for momentum
            let grad = grad_log_prob(&q_new);
            for i in 0..n {
                p_new[i] += eps * grad[i];
            }
        }

        // Final position step
        let v = self.mass_matrix.velocity(&p_new);
        for i in 0..n {
            q_new[i] += eps * v[i];
        }

        // Half step for momentum
        let grad = grad_log_prob(&q_new);
        for i in 0..n {
            p_new[i] += 0.5 * eps * grad[i];
        }

        // Negate momentum (for reversibility, not needed for acceptance)
        for i in 0..n {
            p_new[i] = -p_new[i];
        }

        // Final Hamiltonian
        let h1 = -log_prob(&q_new) + self.mass_matrix.kinetic_energy(&p_new);

        // Metropolis acceptance
        let acceptance_prob = (-(h1 - h0)).exp().min(1.0);
        let accepted = lcg_random(rng_state) < acceptance_prob;

        HMCResult {
            position: if accepted { q_new } else { q.to_vec() },
            momentum: p_new,
            accepted,
            acceptance_prob,
            hamiltonian: h1,
        }
    }
}

#[derive(Debug)]
#[allow(dead_code)]
struct HMCResult {
    position: Vec<f64>,
    momentum: Vec<f64>,
    accepted: bool,
    acceptance_prob: f64,
    hamiltonian: f64,
}

// ============================================================================
// NO-U-TURN SAMPLER (NUTS)
// ============================================================================

/// No-U-Turn Sampler - adaptive HMC
/// Industry standard: Stan's default sampler
///
/// Automatically tunes the number of leapfrog steps
/// by detecting when the trajectory starts to turn back.
#[derive(Debug, Clone)]
pub struct NUTS {
    pub dimension: usize,
    pub step_size: f64,
    pub max_tree_depth: usize,
    pub mass_matrix: MassMatrix,
    pub samples: Vec<Vec<f64>>,
    pub acceptance_rate: f64,
    pub avg_tree_depth: f64,
}

impl NUTS {
    pub fn new(dimension: usize) -> Self {
        NUTS {
            dimension,
            step_size: 0.1,
            max_tree_depth: 10,
            mass_matrix: MassMatrix::Identity,
            samples: Vec::new(),
            acceptance_rate: 0.0,
            avg_tree_depth: 0.0,
        }
    }

    pub fn with_step_size(mut self, eps: f64) -> Self {
        self.step_size = eps;
        self
    }

    pub fn with_max_tree_depth(mut self, d: usize) -> Self {
        self.max_tree_depth = d;
        self
    }

    /// Run NUTS sampling
    pub fn sample<F, G>(
        &mut self,
        n_samples: usize,
        n_warmup: usize,
        initial: &[f64],
        log_prob: F,
        grad_log_prob: G,
    ) where
        F: Fn(&[f64]) -> f64,
        G: Fn(&[f64]) -> Vec<f64>,
    {
        let mut rng_state = 42u64;
        let mut q = initial.to_vec();

        // Dual averaging for step size adaptation during warmup
        let mut log_eps = self.step_size.ln();
        let mut log_eps_bar = log_eps;
        let mut h_bar = 0.0;
        let mu = (10.0 * self.step_size).ln();
        let gamma = 0.05;
        let t0 = 10.0;
        let kappa = 0.75;
        let delta = 0.8; // Target acceptance

        // Mass matrix adaptation storage
        let mut sample_mean = vec![0.0; self.dimension];
        let mut sample_m2 = vec![0.0; self.dimension];

        // Warmup
        for m in 1..=n_warmup {
            let result = self.nuts_step(&q, &log_prob, &grad_log_prob, &mut rng_state);
            
            if result.valid {
                q = result.position;
            }

            // Dual averaging step size adaptation
            let w = 1.0 / (m as f64 + t0);
            h_bar = (1.0 - w) * h_bar + w * (delta - result.acceptance_stat);
            
            log_eps = mu - h_bar * (m as f64).sqrt() / gamma;
            let eta = (m as f64).powf(-kappa);
            log_eps_bar = (1.0 - eta) * log_eps_bar + eta * log_eps;
            
            self.step_size = log_eps.exp();

            // Update mass matrix estimate (Welford's algorithm)
            for (i, &qi) in q.iter().enumerate() {
                let delta = qi - sample_mean[i];
                sample_mean[i] += delta / m as f64;
                let delta2 = qi - sample_mean[i];
                sample_m2[i] += delta * delta2;
            }

            // Adapt mass matrix after half warmup
            if m == n_warmup / 2 && m > 10 {
                let vars: Vec<f64> = sample_m2.iter()
                    .map(|&m2| (m2 / (m - 1) as f64).max(1e-6))
                    .collect();
                self.mass_matrix = MassMatrix::Diagonal(vars);
            }
        }

        // Fix step size after warmup
        self.step_size = log_eps_bar.exp();

        // Main sampling
        self.samples.clear();
        let mut total_depth = 0;
        let mut n_accepted = 0;

        for _ in 0..n_samples {
            let result = self.nuts_step(&q, &log_prob, &grad_log_prob, &mut rng_state);
            
            if result.valid {
                q = result.position;
                n_accepted += 1;
            }
            
            self.samples.push(q.clone());
            total_depth += result.depth;
        }

        self.acceptance_rate = n_accepted as f64 / n_samples as f64;
        self.avg_tree_depth = total_depth as f64 / n_samples as f64;
    }

    fn nuts_step<F, G>(
        &self,
        q0: &[f64],
        log_prob: &F,
        grad_log_prob: &G,
        rng_state: &mut u64,
    ) -> NUTSResult
    where
        F: Fn(&[f64]) -> f64,
        G: Fn(&[f64]) -> Vec<f64>,
    {
        let n = self.dimension;
        let eps = self.step_size;

        // Sample momentum
        let p0 = self.mass_matrix.sample_momentum(rng_state, n);

        // Initial Hamiltonian
        let h0 = -log_prob(q0) + self.mass_matrix.kinetic_energy(&p0);

        // Slice variable
        let log_u = (h0 - lcg_random(rng_state).ln()).min(0.0);

        // Initialize tree
        let mut q_minus = q0.to_vec();
        let mut q_plus = q0.to_vec();
        let mut p_minus = p0.clone();
        let mut p_plus = p0.clone();
        
        let mut q = q0.to_vec();
        let mut n_valid = 1;
        #[allow(unused_assignments)]
        let mut s = true;
        let mut depth = 0;
        let mut alpha_sum = 0.0;
        let mut n_alpha = 0;

        for j in 0..self.max_tree_depth {
            // Choose direction
            let v = if lcg_random(rng_state) < 0.5 { 1 } else { -1 };

            // Build tree in direction v
            let tree = if v == -1 {
                self.build_tree(
                    &q_minus, &p_minus, log_u, v, j, eps,
                    log_prob, grad_log_prob, rng_state, h0,
                )
            } else {
                self.build_tree(
                    &q_plus, &p_plus, log_u, v, j, eps,
                    log_prob, grad_log_prob, rng_state, h0,
                )
            };

            if tree.s && tree.n_valid > 0 {
                // Accept with probability n'/n
                let accept_prob = (tree.n_valid as f64 / n_valid as f64).min(1.0);
                if lcg_random(rng_state) < accept_prob {
                    q = tree.q_prime.clone();
                }
            }

            // Update tree endpoints
            if v == -1 {
                q_minus = tree.q_minus;
                p_minus = tree.p_minus;
            } else {
                q_plus = tree.q_plus;
                p_plus = tree.p_plus;
            }

            n_valid += tree.n_valid;
            alpha_sum += tree.alpha_sum;
            n_alpha += tree.n_alpha;

            // Check stopping criterion
            let dq: Vec<f64> = q_plus.iter().zip(q_minus.iter())
                .map(|(&qp, &qm)| qp - qm)
                .collect();
            
            let s1 = dot(&dq, &p_minus) >= 0.0;
            let s2 = dot(&dq, &p_plus) >= 0.0;
            
            s = tree.s && s1 && s2;
            depth = j + 1;

            if !s { break; }
        }

        NUTSResult {
            position: q,
            valid: n_valid > 0,
            acceptance_stat: if n_alpha > 0 { alpha_sum / n_alpha as f64 } else { 0.0 },
            depth,
        }
    }

    fn build_tree<F, G>(
        &self,
        q: &[f64],
        p: &[f64],
        log_u: f64,
        v: i32,
        j: usize,
        eps: f64,
        log_prob: &F,
        grad_log_prob: &G,
        rng_state: &mut u64,
        h0: f64,
    ) -> TreeResult
    where
        F: Fn(&[f64]) -> f64,
        G: Fn(&[f64]) -> Vec<f64>,
    {
        if j == 0 {
            // Base case: single leapfrog step
            let (q_new, p_new) = self.leapfrog(q, p, v as f64 * eps, grad_log_prob);
            
            let h = -log_prob(&q_new) + self.mass_matrix.kinetic_energy(&p_new);
            let n_valid = if -h >= log_u { 1 } else { 0 };
            let s = -h >= log_u - 1000.0; // Numerical guard
            
            let alpha = ((-h + h0).exp()).min(1.0);

            TreeResult {
                q_minus: q_new.clone(),
                p_minus: p_new.clone(),
                q_plus: q_new.clone(),
                p_plus: p_new.clone(),
                q_prime: q_new,
                n_valid,
                s,
                alpha_sum: alpha,
                n_alpha: 1,
            }
        } else {
            // Recursion: build subtree
            let tree1 = self.build_tree(q, p, log_u, v, j - 1, eps, 
                log_prob, grad_log_prob, rng_state, h0);

            if !tree1.s {
                return tree1;
            }

            let tree2 = if v == -1 {
                self.build_tree(&tree1.q_minus, &tree1.p_minus, log_u, v, j - 1, eps,
                    log_prob, grad_log_prob, rng_state, h0)
            } else {
                self.build_tree(&tree1.q_plus, &tree1.p_plus, log_u, v, j - 1, eps,
                    log_prob, grad_log_prob, rng_state, h0)
            };

            // Combine results
            let n_valid = tree1.n_valid + tree2.n_valid;
            
            let q_prime = if n_valid > 0 && 
                lcg_random(rng_state) < tree2.n_valid as f64 / n_valid as f64 
            {
                tree2.q_prime
            } else {
                tree1.q_prime
            };

            let (q_minus, p_minus, q_plus, p_plus) = if v == -1 {
                (tree2.q_minus, tree2.p_minus, tree1.q_plus, tree1.p_plus)
            } else {
                (tree1.q_minus, tree1.p_minus, tree2.q_plus, tree2.p_plus)
            };

            // U-turn check
            let dq: Vec<f64> = q_plus.iter().zip(q_minus.iter())
                .map(|(&qp, &qm)| qp - qm)
                .collect();
            
            let s = tree1.s && tree2.s 
                && dot(&dq, &p_minus) >= 0.0 
                && dot(&dq, &p_plus) >= 0.0;

            TreeResult {
                q_minus,
                p_minus,
                q_plus,
                p_plus,
                q_prime,
                n_valid,
                s,
                alpha_sum: tree1.alpha_sum + tree2.alpha_sum,
                n_alpha: tree1.n_alpha + tree2.n_alpha,
            }
        }
    }

    fn leapfrog<G>(&self, q: &[f64], p: &[f64], eps: f64, grad_log_prob: &G) -> (Vec<f64>, Vec<f64>)
    where
        G: Fn(&[f64]) -> Vec<f64>,
    {
        let n = q.len();
        let mut q_new = q.to_vec();
        let mut p_new = p.to_vec();

        // Half step momentum
        let grad = grad_log_prob(&q_new);
        for i in 0..n {
            p_new[i] += 0.5 * eps * grad[i];
        }

        // Full step position
        let v = self.mass_matrix.velocity(&p_new);
        for i in 0..n {
            q_new[i] += eps * v[i];
        }

        // Half step momentum
        let grad = grad_log_prob(&q_new);
        for i in 0..n {
            p_new[i] += 0.5 * eps * grad[i];
        }

        (q_new, p_new)
    }
}

#[derive(Debug)]
struct NUTSResult {
    position: Vec<f64>,
    valid: bool,
    acceptance_stat: f64,
    depth: usize,
}

#[derive(Debug)]
struct TreeResult {
    q_minus: Vec<f64>,
    p_minus: Vec<f64>,
    q_plus: Vec<f64>,
    p_plus: Vec<f64>,
    q_prime: Vec<f64>,
    n_valid: usize,
    s: bool,
    alpha_sum: f64,
    n_alpha: usize,
}

// ============================================================================
// PARALLEL TEMPERING
// ============================================================================

/// Parallel tempering (replica exchange MCMC)
/// Industry standard: PyMC, for multi-modal distributions
#[derive(Debug, Clone)]
pub struct ParallelTempering {
    pub dimension: usize,
    pub n_chains: usize,
    pub temperatures: Vec<f64>,
    pub samples: Vec<Vec<Vec<f64>>>,  // [chain][sample][dim]
    pub swap_acceptance_rates: Vec<f64>,
}

impl ParallelTempering {
    pub fn new(dimension: usize, n_chains: usize) -> Self {
        // Geometric temperature ladder
        let t_max: f64 = 10.0;
        let temperatures: Vec<f64> = (0..n_chains)
            .map(|i| t_max.powf(i as f64 / (n_chains - 1) as f64))
            .collect();

        ParallelTempering {
            dimension,
            n_chains,
            temperatures,
            samples: vec![Vec::new(); n_chains],
            swap_acceptance_rates: vec![0.0; n_chains - 1],
        }
    }

    /// Run parallel tempering
    pub fn sample<F>(
        &mut self,
        n_samples: usize,
        initial: &[f64],
        log_prob: F,
        proposal_std: f64,
    ) where
        F: Fn(&[f64]) -> f64,
    {
        let mut rng_state = 42u64;
        
        // Initialize chains
        let mut chains: Vec<Vec<f64>> = (0..self.n_chains)
            .map(|_| initial.to_vec())
            .collect();

        let mut swap_accepts = vec![0usize; self.n_chains - 1];
        let mut swap_attempts = vec![0usize; self.n_chains - 1];

        for _ in 0..n_samples {
            // Within-chain updates (MH)
            for (chain_idx, chain) in chains.iter_mut().enumerate() {
                let temp = self.temperatures[chain_idx];
                
                // Propose
                let proposal: Vec<f64> = chain.iter()
                    .map(|&x| x + proposal_std * box_muller_normal(&mut rng_state))
                    .collect();

                // Tempered acceptance
                let log_alpha = (log_prob(&proposal) - log_prob(chain)) / temp;
                
                if lcg_random(&mut rng_state).ln() < log_alpha {
                    *chain = proposal;
                }
            }

            // Between-chain swaps
            for i in 0..(self.n_chains - 1) {
                let j = i + 1;
                
                // Swap probability
                let log_pi_i = log_prob(&chains[i]);
                let log_pi_j = log_prob(&chains[j]);
                let t_i = self.temperatures[i];
                let t_j = self.temperatures[j];

                let log_alpha = (log_pi_i - log_pi_j) * (1.0 / t_j - 1.0 / t_i);
                
                swap_attempts[i] += 1;
                
                if lcg_random(&mut rng_state).ln() < log_alpha {
                    chains.swap(i, j);
                    swap_accepts[i] += 1;
                }
            }

            // Store samples from cold chain
            for (chain_idx, chain) in chains.iter().enumerate() {
                self.samples[chain_idx].push(chain.clone());
            }
        }

        // Compute swap rates
        for i in 0..(self.n_chains - 1) {
            self.swap_acceptance_rates[i] = swap_accepts[i] as f64 / swap_attempts[i] as f64;
        }
    }

    /// Get samples from cold chain (T=1)
    pub fn cold_chain_samples(&self) -> &Vec<Vec<f64>> {
        &self.samples[0]
    }
}

// ============================================================================
// SEQUENTIAL MONTE CARLO (SMC)
// ============================================================================

/// Sequential Monte Carlo sampler
/// Industry standard: PyMC, NumPyro
#[derive(Debug, Clone)]
pub struct SMCSampler {
    pub dimension: usize,
    pub n_particles: usize,
    pub particles: Vec<Vec<f64>>,
    pub weights: Vec<f64>,
    pub log_evidence: f64,
}

impl SMCSampler {
    pub fn new(dimension: usize, n_particles: usize) -> Self {
        SMCSampler {
            dimension,
            n_particles,
            particles: Vec::new(),
            weights: vec![1.0 / n_particles as f64; n_particles],
            log_evidence: 0.0,
        }
    }

    /// Run SMC sampling with annealing schedule
    pub fn sample<F>(
        &mut self,
        prior_sample: impl Fn(&mut u64) -> Vec<f64>,
        log_likelihood: F,
        n_temp_steps: usize,
    ) where
        F: Fn(&[f64]) -> f64,
    {
        let mut rng_state = 42u64;

        // Sample from prior
        self.particles = (0..self.n_particles)
            .map(|_| prior_sample(&mut rng_state))
            .collect();
        self.weights = vec![1.0 / self.n_particles as f64; self.n_particles];
        self.log_evidence = 0.0;

        // Temperature schedule
        let temps: Vec<f64> = (0..=n_temp_steps)
            .map(|i| i as f64 / n_temp_steps as f64)
            .collect();

        for i in 1..=n_temp_steps {
            let temp_prev = temps[i - 1];
            let temp_curr = temps[i];
            let delta_temp = temp_curr - temp_prev;

            // Reweight
            let log_weights: Vec<f64> = self.particles.iter()
                .map(|p| delta_temp * log_likelihood(p))
                .collect();

            // Normalize
            let max_log_w = log_weights.iter().cloned().fold(f64::NEG_INFINITY, f64::max);
            let sum_exp: f64 = log_weights.iter().map(|&lw| (lw - max_log_w).exp()).sum();
            
            self.log_evidence += max_log_w + sum_exp.ln() - (self.n_particles as f64).ln();

            self.weights = log_weights.iter()
                .map(|&lw| (lw - max_log_w).exp() / sum_exp)
                .collect();

            // Compute ESS
            let ess = 1.0 / self.weights.iter().map(|&w| w * w).sum::<f64>();

            // Resample if ESS too low
            if ess < self.n_particles as f64 / 2.0 {
                self.particles = self.resample(&mut rng_state);
                self.weights = vec![1.0 / self.n_particles as f64; self.n_particles];
            }

            // MCMC rejuvenation
            self.rejuvenate(temp_curr, &log_likelihood, &mut rng_state);
        }
    }

    fn resample(&self, rng_state: &mut u64) -> Vec<Vec<f64>> {
        // Systematic resampling
        let n = self.n_particles;
        let mut cumsum = vec![0.0; n + 1];
        for i in 0..n {
            cumsum[i + 1] = cumsum[i] + self.weights[i];
        }

        let u0 = lcg_random(rng_state) / n as f64;
        let mut new_particles = Vec::with_capacity(n);
        let mut j = 0;

        for i in 0..n {
            let u = u0 + i as f64 / n as f64;
            while u > cumsum[j + 1] && j < n - 1 {
                j += 1;
            }
            new_particles.push(self.particles[j].clone());
        }

        new_particles
    }

    fn rejuvenate<F>(&mut self, temp: f64, log_likelihood: &F, rng_state: &mut u64)
    where
        F: Fn(&[f64]) -> f64,
    {
        // Estimate proposal scale from particle spread
        let mean: Vec<f64> = (0..self.dimension)
            .map(|d| {
                self.particles.iter().map(|p| p[d]).sum::<f64>() / self.n_particles as f64
            })
            .collect();

        let std: Vec<f64> = (0..self.dimension)
            .map(|d| {
                let var = self.particles.iter()
                    .map(|p| (p[d] - mean[d]).powi(2))
                    .sum::<f64>() / self.n_particles as f64;
                var.sqrt().max(0.01)
            })
            .collect();

        // MH steps for each particle
        for particle in &mut self.particles {
            for _ in 0..5 {
                let proposal: Vec<f64> = particle.iter().zip(std.iter())
                    .map(|(&x, &s)| x + 0.5 * s * box_muller_normal(rng_state))
                    .collect();

                let log_alpha = temp * (log_likelihood(&proposal) - log_likelihood(particle));

                if lcg_random(rng_state).ln() < log_alpha {
                    *particle = proposal;
                }
            }
        }
    }

    /// Get weighted samples
    pub fn weighted_samples(&self) -> Vec<(Vec<f64>, f64)> {
        self.particles.iter()
            .zip(self.weights.iter())
            .map(|(p, &w)| (p.clone(), w))
            .collect()
    }
}

// ============================================================================
// DIFFERENTIAL EVOLUTION ADAPTIVE METROPOLIS (DREAM)
// ============================================================================

/// DREAM algorithm for high-dimensional sampling
/// Industry standard: PyMC
#[derive(Debug, Clone)]
pub struct DREAM {
    pub dimension: usize,
    pub n_chains: usize,
    pub samples: Vec<Vec<Vec<f64>>>,
    pub gamma: f64,
    pub crossover_prob: f64,
}

impl DREAM {
    pub fn new(dimension: usize, n_chains: usize) -> Self {
        DREAM {
            dimension,
            n_chains: n_chains.max(3),
            samples: Vec::new(),
            gamma: 2.38 / (2.0 * dimension as f64).sqrt(),
            crossover_prob: 0.9,
        }
    }

    /// Run DREAM sampling
    pub fn sample<F>(
        &mut self,
        n_samples: usize,
        initial: &[Vec<f64>],
        log_prob: F,
    ) where
        F: Fn(&[f64]) -> f64,
    {
        let mut rng_state = 42u64;

        // Initialize chains
        let mut chains: Vec<Vec<f64>> = if initial.len() >= self.n_chains {
            initial[..self.n_chains].to_vec()
        } else {
            // Perturb initial point
            let base = &initial[0];
            (0..self.n_chains)
                .map(|_| {
                    base.iter()
                        .map(|&x| x + 0.1 * box_muller_normal(&mut rng_state))
                        .collect()
                })
                .collect()
        };

        self.samples = vec![Vec::new(); self.n_chains];

        for _ in 0..n_samples {
            for i in 0..self.n_chains {
                // Select two different chains
                let mut r1 = (lcg_random(&mut rng_state) * self.n_chains as f64) as usize;
                let mut r2 = (lcg_random(&mut rng_state) * self.n_chains as f64) as usize;
                
                while r1 == i { r1 = (lcg_random(&mut rng_state) * self.n_chains as f64) as usize; }
                while r2 == i || r2 == r1 { r2 = (lcg_random(&mut rng_state) * self.n_chains as f64) as usize; }

                // Differential evolution proposal
                let mut proposal = chains[i].clone();
                
                for d in 0..self.dimension {
                    if lcg_random(&mut rng_state) < self.crossover_prob {
                        let diff = chains[r1][d] - chains[r2][d];
                        let epsilon = 1e-6 * box_muller_normal(&mut rng_state);
                        proposal[d] += self.gamma * diff + epsilon;
                    }
                }

                // Metropolis acceptance
                let log_alpha = log_prob(&proposal) - log_prob(&chains[i]);
                
                if lcg_random(&mut rng_state).ln() < log_alpha {
                    chains[i] = proposal;
                }

                self.samples[i].push(chains[i].clone());
            }
        }
    }

    /// Get combined samples from all chains
    pub fn all_samples(&self) -> Vec<Vec<f64>> {
        self.samples.iter().flatten().cloned().collect()
    }
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

fn lcg_random(state: &mut u64) -> f64 {
    *state = state.wrapping_mul(6364136223846793005).wrapping_add(1);
    (*state as f64) / (u64::MAX as f64)
}

fn box_muller_normal(state: &mut u64) -> f64 {
    let u1 = lcg_random(state);
    let u2 = lcg_random(state);
    (-2.0 * u1.ln()).sqrt() * (2.0 * PI * u2).cos()
}

fn dot(a: &[f64], b: &[f64]) -> f64 {
    a.iter().zip(b.iter()).map(|(&ai, &bi)| ai * bi).sum()
}

fn mat_vec_mult(a: &[Vec<f64>], x: &[f64]) -> Vec<f64> {
    a.iter().map(|row| dot(row, x)).collect()
}

fn cholesky(a: &[Vec<f64>]) -> Vec<Vec<f64>> {
    let n = a.len();
    let mut l = vec![vec![0.0; n]; n];

    for i in 0..n {
        for j in 0..=i {
            let mut sum = 0.0;
            
            if i == j {
                for k in 0..j {
                    sum += l[j][k] * l[j][k];
                }
                l[i][j] = (a[i][j] - sum).max(1e-10).sqrt();
            } else {
                for k in 0..j {
                    sum += l[i][k] * l[j][k];
                }
                l[i][j] = (a[i][j] - sum) / l[j][j].max(1e-10);
            }
        }
    }

    l
}

fn invert_matrix(a: &[Vec<f64>]) -> Vec<Vec<f64>> {
    let n = a.len();
    let mut aug = vec![vec![0.0; 2 * n]; n];

    for i in 0..n {
        for j in 0..n {
            aug[i][j] = a[i][j];
            aug[i][n + j] = if i == j { 1.0 } else { 0.0 };
        }
    }

    for i in 0..n {
        let mut max_row = i;
        for k in (i + 1)..n {
            if aug[k][i].abs() > aug[max_row][i].abs() {
                max_row = k;
            }
        }
        aug.swap(i, max_row);

        let pivot = aug[i][i];
        if pivot.abs() < 1e-14 { continue; }

        for j in 0..(2 * n) {
            aug[i][j] /= pivot;
        }

        for k in 0..n {
            if k == i { continue; }
            let factor = aug[k][i];
            for j in 0..(2 * n) {
                aug[k][j] -= factor * aug[i][j];
            }
        }
    }

    let mut inv = vec![vec![0.0; n]; n];
    for i in 0..n {
        for j in 0..n {
            inv[i][j] = aug[i][n + j];
        }
    }
    inv
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_hmc_normal() {
        let mut hmc = HMC::new(2)
            .with_step_size(0.1)
            .with_leapfrog_steps(20);

        let log_prob = |x: &[f64]| -0.5 * (x[0] * x[0] + x[1] * x[1]);
        let grad = |x: &[f64]| vec![-x[0], -x[1]];

        hmc.sample(100, 50, &[0.0, 0.0], log_prob, grad);

        assert_eq!(hmc.samples.len(), 100);
        assert!(hmc.acceptance_rate > 0.3);
    }

    #[test]
    fn test_nuts() {
        let mut nuts = NUTS::new(2)
            .with_step_size(0.1)
            .with_max_tree_depth(5);

        let log_prob = |x: &[f64]| -0.5 * (x[0] * x[0] + x[1] * x[1]);
        let grad = |x: &[f64]| vec![-x[0], -x[1]];

        nuts.sample(100, 50, &[0.0, 0.0], log_prob, grad);

        assert_eq!(nuts.samples.len(), 100);
    }

    #[test]
    fn test_parallel_tempering() {
        let mut pt = ParallelTempering::new(2, 4);

        // Bimodal distribution
        let log_prob = |x: &[f64]| {
            let mode1 = -0.5 * ((x[0] - 2.0).powi(2) + x[1].powi(2));
            let mode2 = -0.5 * ((x[0] + 2.0).powi(2) + x[1].powi(2));
            (mode1.exp() + mode2.exp()).ln()
        };

        pt.sample(500, &[0.0, 0.0], log_prob, 0.5);

        assert_eq!(pt.cold_chain_samples().len(), 500);
    }

    #[test]
    fn test_smc() {
        let mut smc = SMCSampler::new(2, 100);

        let prior_sample = |rng: &mut u64| {
            vec![
                box_muller_normal(rng) * 5.0,
                box_muller_normal(rng) * 5.0,
            ]
        };

        let log_likelihood = |x: &[f64]| -0.5 * (x[0].powi(2) + x[1].powi(2));

        smc.sample(prior_sample, log_likelihood, 10);

        assert_eq!(smc.particles.len(), 100);
    }

    #[test]
    fn test_dream() {
        let mut dream = DREAM::new(2, 5);

        let log_prob = |x: &[f64]| -0.5 * (x[0] * x[0] + x[1] * x[1]);

        let initial: Vec<Vec<f64>> = (0..5)
            .map(|i| vec![i as f64 * 0.1, i as f64 * 0.1])
            .collect();

        dream.sample(100, &initial, log_prob);

        assert_eq!(dream.samples.len(), 5);
        assert_eq!(dream.samples[0].len(), 100);
    }

    #[test]
    fn test_mass_matrix() {
        let mut rng = 42u64;
        
        let identity = MassMatrix::Identity;
        let p = identity.sample_momentum(&mut rng, 3);
        assert_eq!(p.len(), 3);
        
        let diag = MassMatrix::Diagonal(vec![1.0, 2.0, 0.5]);
        let ke = diag.kinetic_energy(&[1.0, 1.0, 1.0]);
        assert!(ke > 0.0);
    }
}
