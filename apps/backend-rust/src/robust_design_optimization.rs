//! Robust Design Optimization Module
//!
//! Optimization under uncertainty considering variability and robustness.
//! Essential for reliable engineering designs that perform well despite uncertainties.
//!
//! ## Methods Implemented
//! - **Robust Optimization** - Minimize mean + variance
//! - **Reliability-Based Design Optimization (RBDO)** - Probabilistic constraints
//! - **Multi-Objective Robust Optimization** - Pareto-optimal robust designs
//! - **Worst-Case Optimization** - Min-max formulation
//! - **Taguchi Methods** - Signal-to-noise ratio optimization

use serde::{Deserialize, Serialize};
use std::f64::consts::PI;

// ============================================================================
// DESIGN VARIABLE TYPES
// ============================================================================

/// Design variable with uncertainty
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UncertainDesignVariable {
    pub name: String,
    pub nominal: f64,
    pub lower_bound: f64,
    pub upper_bound: f64,
    pub cov: f64,  // Coefficient of variation
    pub is_deterministic: bool,
}

impl UncertainDesignVariable {
    pub fn deterministic(name: &str, nominal: f64, lower: f64, upper: f64) -> Self {
        UncertainDesignVariable {
            name: name.to_string(),
            nominal,
            lower_bound: lower,
            upper_bound: upper,
            cov: 0.0,
            is_deterministic: true,
        }
    }

    pub fn uncertain(name: &str, nominal: f64, lower: f64, upper: f64, cov: f64) -> Self {
        UncertainDesignVariable {
            name: name.to_string(),
            nominal,
            lower_bound: lower,
            upper_bound: upper,
            cov,
            is_deterministic: false,
        }
    }

    pub fn std_dev(&self) -> f64 {
        self.cov * self.nominal.abs()
    }
}

/// Random parameter (not a design variable)
#[derive(Debug, Clone)]
pub struct RandomParameter {
    pub name: String,
    pub mean: f64,
    pub std_dev: f64,
}

impl RandomParameter {
    pub fn new(name: &str, mean: f64, std_dev: f64) -> Self {
        RandomParameter {
            name: name.to_string(),
            mean,
            std_dev,
        }
    }
}

// ============================================================================
// ROBUST OPTIMIZATION
// ============================================================================

/// Robust optimization formulation
#[derive(Debug, Clone, Copy, PartialEq)]
pub enum RobustFormulation {
    /// Minimize mean only
    MeanOnly,
    /// Minimize mean + k * std_dev
    MeanPlusKSigma { k: f64 },
    /// Minimize variance only
    VarianceOnly,
    /// Weighted combination: w * mean + (1-w) * normalized_variance
    WeightedMeanVariance { weight: f64 },
}

/// Robust optimization solver
#[derive(Debug, Clone)]
pub struct RobustOptimizer {
    pub formulation: RobustFormulation,
    pub n_samples: usize,
    pub max_iterations: usize,
    pub tolerance: f64,
    pub optimal_design: Vec<f64>,
    pub optimal_mean: f64,
    pub optimal_std: f64,
    pub convergence_history: Vec<f64>,
}

impl RobustOptimizer {
    pub fn new(formulation: RobustFormulation) -> Self {
        RobustOptimizer {
            formulation,
            n_samples: 100,
            max_iterations: 100,
            tolerance: 1e-6,
            optimal_design: Vec::new(),
            optimal_mean: 0.0,
            optimal_std: 0.0,
            convergence_history: Vec::new(),
        }
    }

    /// Optimize with given objective function
    pub fn optimize<F>(
        &mut self,
        variables: &[UncertainDesignVariable],
        random_params: &[RandomParameter],
        objective: F,
    )
    where
        F: Fn(&[f64], &[f64]) -> f64,  // (design, random) -> objective
    {
        let n_design = variables.len();
        let mut rng_state = 42u64;

        // Initialize at nominal
        let mut current: Vec<f64> = variables.iter().map(|v| v.nominal).collect();
        let mut best = current.clone();
        let mut best_robust_obj = f64::INFINITY;

        self.convergence_history.clear();

        // Simple gradient-free optimization (coordinate search)
        for _iter in 0..self.max_iterations {
            // Evaluate robust objective
            let (mean, std) = self.evaluate_statistics(&current, variables, random_params, &objective, &mut rng_state);
            let robust_obj = self.compute_robust_objective(mean, std);

            self.convergence_history.push(robust_obj);

            if robust_obj < best_robust_obj {
                best_robust_obj = robust_obj;
                best = current.clone();
                self.optimal_mean = mean;
                self.optimal_std = std;
            }

            // Search each dimension
            for i in 0..n_design {
                let step = (variables[i].upper_bound - variables[i].lower_bound) * 0.1;

                // Try positive step
                let mut trial = current.clone();
                trial[i] = (current[i] + step).min(variables[i].upper_bound);
                let (mean_plus, std_plus) = self.evaluate_statistics(&trial, variables, random_params, &objective, &mut rng_state);
                let obj_plus = self.compute_robust_objective(mean_plus, std_plus);

                // Try negative step
                trial[i] = (current[i] - step).max(variables[i].lower_bound);
                let (mean_minus, std_minus) = self.evaluate_statistics(&trial, variables, random_params, &objective, &mut rng_state);
                let obj_minus = self.compute_robust_objective(mean_minus, std_minus);

                // Move to best direction
                if obj_plus < robust_obj && obj_plus < obj_minus {
                    current[i] = (current[i] + step).min(variables[i].upper_bound);
                } else if obj_minus < robust_obj {
                    current[i] = (current[i] - step).max(variables[i].lower_bound);
                }
            }

            // Check convergence
            if _iter > 0 {
                let change = (self.convergence_history[_iter] - self.convergence_history[_iter - 1]).abs();
                if change < self.tolerance {
                    break;
                }
            }
        }

        self.optimal_design = best;
    }

    fn evaluate_statistics<F>(
        &self,
        design: &[f64],
        variables: &[UncertainDesignVariable],
        random_params: &[RandomParameter],
        objective: &F,
        rng_state: &mut u64,
    ) -> (f64, f64)
    where
        F: Fn(&[f64], &[f64]) -> f64,
    {
        let mut sum = 0.0;
        let mut sum_sq = 0.0;

        for _ in 0..self.n_samples {
            // Sample uncertain design variables
            let realized_design: Vec<f64> = design.iter()
                .zip(variables.iter())
                .map(|(&d, v)| {
                    if v.is_deterministic {
                        d
                    } else {
                        d + v.std_dev() * box_muller_normal(rng_state)
                    }
                })
                .collect();

            // Sample random parameters
            let realized_params: Vec<f64> = random_params.iter()
                .map(|p| p.mean + p.std_dev * box_muller_normal(rng_state))
                .collect();

            let obj = objective(&realized_design, &realized_params);
            sum += obj;
            sum_sq += obj * obj;
        }

        let mean = sum / self.n_samples as f64;
        let variance = (sum_sq / self.n_samples as f64 - mean * mean).max(0.0);
        let std = variance.sqrt();

        (mean, std)
    }

    fn compute_robust_objective(&self, mean: f64, std: f64) -> f64 {
        match self.formulation {
            RobustFormulation::MeanOnly => mean,
            RobustFormulation::MeanPlusKSigma { k } => mean + k * std,
            RobustFormulation::VarianceOnly => std * std,
            RobustFormulation::WeightedMeanVariance { weight } => {
                weight * mean + (1.0 - weight) * std
            }
        }
    }
}

// ============================================================================
// RELIABILITY-BASED DESIGN OPTIMIZATION
// ============================================================================

/// Probabilistic constraint
#[derive(Debug, Clone)]
pub struct ProbabilisticConstraint {
    pub name: String,
    pub target_reliability: f64,  // β_target or P_f,target
    pub use_beta: bool,           // true: β ≥ β_target, false: P_f ≤ P_f,target
}

impl ProbabilisticConstraint {
    pub fn with_beta(name: &str, beta_target: f64) -> Self {
        ProbabilisticConstraint {
            name: name.to_string(),
            target_reliability: beta_target,
            use_beta: true,
        }
    }

    pub fn with_pf(name: &str, pf_target: f64) -> Self {
        ProbabilisticConstraint {
            name: name.to_string(),
            target_reliability: pf_target,
            use_beta: false,
        }
    }
}

/// RBDO solver
#[derive(Debug, Clone)]
pub struct RBDOOptimizer {
    pub max_iterations: usize,
    pub tolerance: f64,
    pub n_reliability_samples: usize,
    pub optimal_design: Vec<f64>,
    pub optimal_objective: f64,
    pub constraint_betas: Vec<f64>,
    pub converged: bool,
}

impl RBDOOptimizer {
    pub fn new() -> Self {
        RBDOOptimizer {
            max_iterations: 50,
            tolerance: 1e-4,
            n_reliability_samples: 500,
            optimal_design: Vec::new(),
            optimal_objective: 0.0,
            constraint_betas: Vec::new(),
            converged: false,
        }
    }

    /// Solve RBDO using PMA (Performance Measure Approach)
    pub fn optimize<F, G>(
        &mut self,
        variables: &[UncertainDesignVariable],
        random_params: &[RandomParameter],
        objective: F,
        constraints: &[ProbabilisticConstraint],
        constraint_functions: Vec<G>,
    )
    where
        F: Fn(&[f64]) -> f64,  // Deterministic objective
        G: Fn(&[f64], &[f64]) -> f64,  // Limit state: g(d, r) ≤ 0 is failure
    {
        let n = variables.len();
        let _n_constraints = constraints.len();
        let mut rng_state = 12345u64;

        // Initialize
        let mut current: Vec<f64> = variables.iter().map(|v| v.nominal).collect();
        let mut penalty_factor = 1.0;

        for _outer in 0..self.max_iterations {
            // Evaluate current design
            let obj = objective(&current);

            // Compute reliability indices for each constraint
            let mut betas = Vec::new();
            let mut penalties = 0.0;

            for (_i, (constraint, g)) in constraints.iter().zip(constraint_functions.iter()).enumerate() {
                let beta = self.compute_reliability_index(
                    &current, variables, random_params, g, &mut rng_state);
                betas.push(beta);

                // Penalty for violated constraints
                let target_beta = if constraint.use_beta {
                    constraint.target_reliability
                } else {
                    Self::pf_to_beta(constraint.target_reliability)
                };

                if beta < target_beta {
                    penalties += penalty_factor * (target_beta - beta).powi(2);
                }
            }

            let augmented_obj = obj + penalties;

            // Simple steepest descent with penalty
            let mut grad = vec![0.0; n];
            let h = 1e-5;

            for i in 0..n {
                let mut d_plus = current.clone();
                d_plus[i] = (current[i] + h).min(variables[i].upper_bound);

                let obj_plus = objective(&d_plus);
                let mut pen_plus = 0.0;

                for (_j, (constraint, g)) in constraints.iter().zip(constraint_functions.iter()).enumerate() {
                    let beta = self.compute_reliability_index(
                        &d_plus, variables, random_params, g, &mut rng_state);
                    let target_beta = if constraint.use_beta {
                        constraint.target_reliability
                    } else {
                        Self::pf_to_beta(constraint.target_reliability)
                    };

                    if beta < target_beta {
                        pen_plus += penalty_factor * (target_beta - beta).powi(2);
                    }
                }

                grad[i] = ((obj_plus + pen_plus) - augmented_obj) / h;
            }

            // Update
            let grad_norm: f64 = grad.iter().map(|&x| x * x).sum::<f64>().sqrt();
            if grad_norm > 1e-10 {
                let step_size = 0.1 * (variables[0].upper_bound - variables[0].lower_bound) / grad_norm;

                for i in 0..n {
                    current[i] -= step_size * grad[i];
                    current[i] = current[i].clamp(variables[i].lower_bound, variables[i].upper_bound);
                }
            }

            self.constraint_betas = betas;

            // Increase penalty
            penalty_factor *= 1.5;

            // Check convergence
            if grad_norm < self.tolerance {
                self.converged = true;
                break;
            }
        }

        self.optimal_design = current;
        self.optimal_objective = objective(&self.optimal_design);
    }

    fn compute_reliability_index<G>(
        &self,
        design: &[f64],
        variables: &[UncertainDesignVariable],
        random_params: &[RandomParameter],
        limit_state: &G,
        rng_state: &mut u64,
    ) -> f64
    where
        G: Fn(&[f64], &[f64]) -> f64,
    {
        // Monte Carlo reliability assessment
        let mut n_failure = 0;

        for _ in 0..self.n_reliability_samples {
            // Sample uncertain design variables
            let realized_design: Vec<f64> = design.iter()
                .zip(variables.iter())
                .map(|(&d, v)| {
                    if v.is_deterministic {
                        d
                    } else {
                        d + v.std_dev() * box_muller_normal(rng_state)
                    }
                })
                .collect();

            // Sample random parameters
            let realized_params: Vec<f64> = random_params.iter()
                .map(|p| p.mean + p.std_dev * box_muller_normal(rng_state))
                .collect();

            let g = limit_state(&realized_design, &realized_params);
            if g <= 0.0 {
                n_failure += 1;
            }
        }

        let pf = n_failure as f64 / self.n_reliability_samples as f64;
        Self::pf_to_beta(pf.max(1e-10))
    }

    fn pf_to_beta(pf: f64) -> f64 {
        -inverse_standard_normal_cdf(pf)
    }
}

impl Default for RBDOOptimizer {
    fn default() -> Self {
        Self::new()
    }
}

// ============================================================================
// MULTI-OBJECTIVE ROBUST OPTIMIZATION
// ============================================================================

/// Pareto solution for multi-objective robust optimization
#[derive(Debug, Clone)]
pub struct RobustParetoSolution {
    pub design: Vec<f64>,
    pub objective_means: Vec<f64>,
    pub objective_stds: Vec<f64>,
    pub crowding_distance: f64,
}

/// Multi-objective robust optimizer
#[derive(Debug, Clone)]
pub struct MultiObjectiveRobust {
    pub population_size: usize,
    pub n_generations: usize,
    pub n_samples: usize,
    pub pareto_front: Vec<RobustParetoSolution>,
}

impl MultiObjectiveRobust {
    pub fn new(pop_size: usize, n_generations: usize) -> Self {
        MultiObjectiveRobust {
            population_size: pop_size,
            n_generations,
            n_samples: 50,
            pareto_front: Vec::new(),
        }
    }

    /// Optimize multiple objectives robustly
    pub fn optimize<F>(
        &mut self,
        variables: &[UncertainDesignVariable],
        random_params: &[RandomParameter],
        objectives: &[F],  // Multiple objective functions
    )
    where
        F: Fn(&[f64], &[f64]) -> f64,
    {
        let n_vars = variables.len();
        let n_obj = objectives.len();
        let mut rng_state = 98765u64;

        // Initialize population
        let mut population: Vec<Vec<f64>> = (0..self.population_size)
            .map(|_| {
                variables.iter()
                    .map(|v| v.lower_bound + lcg_random(&mut rng_state) * (v.upper_bound - v.lower_bound))
                    .collect()
            })
            .collect();

        for _gen in 0..self.n_generations {
            // Evaluate objectives with uncertainty
            let evaluated: Vec<(Vec<f64>, Vec<f64>, Vec<f64>)> = population.iter()
                .map(|design| {
                    let (means, stds) = self.evaluate_robust_objectives(
                        design, variables, random_params, objectives, &mut rng_state);
                    (design.clone(), means, stds)
                })
                .collect();

            // Non-dominated sorting (simplified - using mean objectives)
            let ranks = self.fast_non_dominated_sort(&evaluated, n_obj);

            // Select parents based on rank
            let mut new_population = Vec::new();

            for rank in 0..self.population_size {
                for (i, &r) in ranks.iter().enumerate() {
                    if r == rank && new_population.len() < self.population_size {
                        new_population.push(population[i].clone());
                    }
                }
                if new_population.len() >= self.population_size {
                    break;
                }
            }

            // Fill remaining with offspring
            while new_population.len() < self.population_size {
                // Select parents
                let p1 = &new_population[lcg_random(&mut rng_state) as usize % new_population.len()];
                let p2 = &new_population[lcg_random(&mut rng_state) as usize % new_population.len()];

                // Crossover
                let mut child: Vec<f64> = (0..n_vars)
                    .map(|i| {
                        if lcg_random(&mut rng_state) < 0.5 { p1[i] } else { p2[i] }
                    })
                    .collect();

                // Mutation
                for i in 0..n_vars {
                    if lcg_random(&mut rng_state) < 0.1 {
                        let range = variables[i].upper_bound - variables[i].lower_bound;
                        child[i] += 0.1 * range * (2.0 * lcg_random(&mut rng_state) - 1.0);
                        child[i] = child[i].clamp(variables[i].lower_bound, variables[i].upper_bound);
                    }
                }

                new_population.push(child);
            }

            population = new_population;
        }

        // Extract Pareto front
        let evaluated: Vec<(Vec<f64>, Vec<f64>, Vec<f64>)> = population.iter()
            .map(|design| {
                let (means, stds) = self.evaluate_robust_objectives(
                    design, variables, random_params, objectives, &mut rng_state);
                (design.clone(), means, stds)
            })
            .collect();

        let ranks = self.fast_non_dominated_sort(&evaluated, n_obj);

        self.pareto_front = evaluated.iter()
            .zip(ranks.iter())
            .filter(|(_, &r)| r == 0)
            .map(|((design, means, stds), _)| {
                RobustParetoSolution {
                    design: design.clone(),
                    objective_means: means.clone(),
                    objective_stds: stds.clone(),
                    crowding_distance: 0.0,
                }
            })
            .collect();
    }

    fn evaluate_robust_objectives<F>(
        &self,
        design: &[f64],
        variables: &[UncertainDesignVariable],
        random_params: &[RandomParameter],
        objectives: &[F],
        rng_state: &mut u64,
    ) -> (Vec<f64>, Vec<f64>)
    where
        F: Fn(&[f64], &[f64]) -> f64,
    {
        let n_obj = objectives.len();
        let mut sums = vec![0.0; n_obj];
        let mut sum_sqs = vec![0.0; n_obj];

        for _ in 0..self.n_samples {
            let realized_design: Vec<f64> = design.iter()
                .zip(variables.iter())
                .map(|(&d, v)| {
                    if v.is_deterministic { d } 
                    else { d + v.std_dev() * box_muller_normal(rng_state) }
                })
                .collect();

            let realized_params: Vec<f64> = random_params.iter()
                .map(|p| p.mean + p.std_dev * box_muller_normal(rng_state))
                .collect();

            for (j, obj) in objectives.iter().enumerate() {
                let val = obj(&realized_design, &realized_params);
                sums[j] += val;
                sum_sqs[j] += val * val;
            }
        }

        let means: Vec<f64> = sums.iter().map(|&s| s / self.n_samples as f64).collect();
        let stds: Vec<f64> = means.iter().zip(sum_sqs.iter())
            .map(|(&m, &sq)| ((sq / self.n_samples as f64 - m * m).max(0.0)).sqrt())
            .collect();

        (means, stds)
    }

    fn fast_non_dominated_sort(&self, solutions: &[(Vec<f64>, Vec<f64>, Vec<f64>)], _n_obj: usize) -> Vec<usize> {
        let n = solutions.len();
        let mut ranks = vec![0; n];
        let mut domination_count = vec![0; n];
        let mut dominated = vec![Vec::new(); n];

        for i in 0..n {
            for j in 0..n {
                if i == j { continue; }

                if self.dominates(&solutions[i].1, &solutions[j].1) {
                    dominated[i].push(j);
                } else if self.dominates(&solutions[j].1, &solutions[i].1) {
                    domination_count[i] += 1;
                }
            }
        }

        // Assign ranks
        let mut current_rank = 0;
        let mut front: Vec<usize> = (0..n).filter(|&i| domination_count[i] == 0).collect();

        while !front.is_empty() {
            for &i in &front {
                ranks[i] = current_rank;
            }

            let mut next_front = Vec::new();
            for &i in &front {
                for &j in &dominated[i] {
                    domination_count[j] -= 1;
                    if domination_count[j] == 0 {
                        next_front.push(j);
                    }
                }
            }

            front = next_front;
            current_rank += 1;
        }

        ranks
    }

    fn dominates(&self, a: &[f64], b: &[f64]) -> bool {
        let mut dominated = false;
        for (ai, bi) in a.iter().zip(b.iter()) {
            if ai > bi { return false; }
            if ai < bi { dominated = true; }
        }
        dominated
    }
}

// ============================================================================
// WORST-CASE OPTIMIZATION
// ============================================================================

/// Worst-case robust optimization
#[derive(Debug, Clone)]
pub struct WorstCaseOptimizer {
    pub uncertainty_set_type: UncertaintySetType,
    pub max_iterations: usize,
    pub optimal_design: Vec<f64>,
    pub worst_case_objective: f64,
}

#[derive(Debug, Clone, Copy)]
pub enum UncertaintySetType {
    /// Box uncertainty: each param in [μ - Δ, μ + Δ]
    Box,
    /// Ellipsoidal uncertainty: (p - μ)ᵀΣ⁻¹(p - μ) ≤ 1
    Ellipsoidal,
}

impl WorstCaseOptimizer {
    pub fn new(set_type: UncertaintySetType) -> Self {
        WorstCaseOptimizer {
            uncertainty_set_type: set_type,
            max_iterations: 100,
            optimal_design: Vec::new(),
            worst_case_objective: 0.0,
        }
    }

    /// Min-max optimization
    pub fn optimize<F>(
        &mut self,
        variables: &[UncertainDesignVariable],
        random_params: &[RandomParameter],
        objective: F,
    )
    where
        F: Fn(&[f64], &[f64]) -> f64,
    {
        let n = variables.len();
        let _rng_state = 33333u64;

        let mut current: Vec<f64> = variables.iter().map(|v| v.nominal).collect();
        let mut best_worst_case = f64::INFINITY;

        for _iter in 0..self.max_iterations {
            // Find worst-case parameters for current design
            let worst_params = self.find_worst_case(&current, random_params, &objective);
            let worst_obj = objective(&current, &worst_params);

            if worst_obj < best_worst_case {
                best_worst_case = worst_obj;
                self.optimal_design = current.clone();
            }

            // Update design to minimize worst case
            let mut grad = vec![0.0; n];
            let h = 1e-5;

            for i in 0..n {
                let mut d_plus = current.clone();
                d_plus[i] = (current[i] + h).min(variables[i].upper_bound);
                let worst_plus = self.find_worst_case(&d_plus, random_params, &objective);
                let obj_plus = objective(&d_plus, &worst_plus);

                grad[i] = (obj_plus - worst_obj) / h;
            }

            let grad_norm: f64 = grad.iter().map(|&x| x * x).sum::<f64>().sqrt();
            if grad_norm > 1e-10 {
                let step = 0.1 * (variables[0].upper_bound - variables[0].lower_bound) / grad_norm;
                for i in 0..n {
                    current[i] -= step * grad[i];
                    current[i] = current[i].clamp(variables[i].lower_bound, variables[i].upper_bound);
                }
            }
        }

        self.worst_case_objective = best_worst_case;
    }

    fn find_worst_case<F>(&self, design: &[f64], random_params: &[RandomParameter], objective: &F) -> Vec<f64>
    where
        F: Fn(&[f64], &[f64]) -> f64,
    {
        let n = random_params.len();
        let mut worst = random_params.iter().map(|p| p.mean).collect::<Vec<_>>();
        let mut worst_obj = objective(design, &worst);

        // Grid search over uncertainty set
        let _n_grid = 5;

        match self.uncertainty_set_type {
            UncertaintySetType::Box => {
                // Check corners of box
                for mask in 0..(1 << n) {
                    let candidate: Vec<f64> = random_params.iter()
                        .enumerate()
                        .map(|(i, p)| {
                            if (mask >> i) & 1 == 1 {
                                p.mean + 3.0 * p.std_dev  // +3σ bound
                            } else {
                                p.mean - 3.0 * p.std_dev  // -3σ bound
                            }
                        })
                        .collect();

                    let obj = objective(design, &candidate);
                    if obj > worst_obj {
                        worst_obj = obj;
                        worst = candidate;
                    }
                }
            }
            UncertaintySetType::Ellipsoidal => {
                // Sample directions on unit sphere
                let mut rng = 77777u64;
                for _ in 0..20 {
                    let mut dir: Vec<f64> = (0..n).map(|_| box_muller_normal(&mut rng)).collect();
                    let norm: f64 = dir.iter().map(|&x| x * x).sum::<f64>().sqrt();
                    for d in &mut dir { *d /= norm; }

                    // Scale by uncertainty
                    let candidate: Vec<f64> = random_params.iter()
                        .zip(dir.iter())
                        .map(|(p, &d)| p.mean + 3.0 * p.std_dev * d)
                        .collect();

                    let obj = objective(design, &candidate);
                    if obj > worst_obj {
                        worst_obj = obj;
                        worst = candidate;
                    }
                }
            }
        }

        worst
    }
}

// ============================================================================
// TAGUCHI METHOD
// ============================================================================

/// Taguchi robust design method
#[derive(Debug, Clone)]
pub struct TaguchiMethod {
    pub orthogonal_array: Vec<Vec<i32>>,  // L_n array
    pub levels: Vec<Vec<f64>>,             // Factor levels
    pub sn_ratios: Vec<f64>,
    pub optimal_levels: Vec<usize>,
}

#[derive(Debug, Clone, Copy)]
pub enum TaguchiObjective {
    SmallerIsBetter,
    LargerIsBetter,
    NominalIsBest { target: f64 },
}

impl TaguchiMethod {
    pub fn new() -> Self {
        TaguchiMethod {
            orthogonal_array: Vec::new(),
            levels: Vec::new(),
            sn_ratios: Vec::new(),
            optimal_levels: Vec::new(),
        }
    }

    /// Setup L9 orthogonal array for 4 factors at 3 levels
    pub fn setup_l9(&mut self, factor_levels: Vec<Vec<f64>>) {
        self.orthogonal_array = vec![
            vec![0, 0, 0, 0],
            vec![0, 1, 1, 1],
            vec![0, 2, 2, 2],
            vec![1, 0, 1, 2],
            vec![1, 1, 2, 0],
            vec![1, 2, 0, 1],
            vec![2, 0, 2, 1],
            vec![2, 1, 0, 2],
            vec![2, 2, 1, 0],
        ];
        self.levels = factor_levels;
    }

    /// Setup L4 orthogonal array for 3 factors at 2 levels
    pub fn setup_l4(&mut self, factor_levels: Vec<Vec<f64>>) {
        self.orthogonal_array = vec![
            vec![0, 0, 0],
            vec![0, 1, 1],
            vec![1, 0, 1],
            vec![1, 1, 0],
        ];
        self.levels = factor_levels;
    }

    /// Run experiment and analyze
    pub fn analyze<F>(
        &mut self,
        objective: TaguchiObjective,
        experiment: F,
        n_replications: usize,
    )
    where
        F: Fn(&[f64]) -> f64,
    {
        let _n_experiments = self.orthogonal_array.len();
        let n_factors = if !self.orthogonal_array.is_empty() { 
            self.orthogonal_array[0].len() 
        } else { 0 };

        let mut results: Vec<Vec<f64>> = Vec::new();

        // Run experiments
        let mut rng = 55555u64;
        for exp in &self.orthogonal_array {
            let factors: Vec<f64> = exp.iter()
                .enumerate()
                .map(|(i, &level)| self.levels[i][level as usize])
                .collect();

            let mut rep_results = Vec::new();
            for _ in 0..n_replications {
                // Add noise for replications
                let noisy_factors: Vec<f64> = factors.iter()
                    .map(|&f| f * (1.0 + 0.01 * box_muller_normal(&mut rng)))
                    .collect();
                rep_results.push(experiment(&noisy_factors));
            }
            results.push(rep_results);
        }

        // Compute S/N ratios
        self.sn_ratios = results.iter()
            .map(|rep| self.compute_sn_ratio(rep, objective))
            .collect();

        // Analyze main effects
        let n_levels = if !self.levels.is_empty() { self.levels[0].len() } else { 0 };

        self.optimal_levels = (0..n_factors)
            .map(|factor| {
                let level_means: Vec<f64> = (0..n_levels)
                    .map(|level| {
                        let matching: Vec<f64> = self.orthogonal_array.iter()
                            .zip(self.sn_ratios.iter())
                            .filter(|(exp, _)| exp[factor] == level as i32)
                            .map(|(_, &sn)| sn)
                            .collect();
                        matching.iter().sum::<f64>() / matching.len().max(1) as f64
                    })
                    .collect();

                // Find level with highest S/N
                level_means.iter()
                    .enumerate()
                    .max_by(|(_, a), (_, b)| a.partial_cmp(b).unwrap())
                    .map(|(i, _)| i)
                    .unwrap_or(0)
            })
            .collect();
    }

    fn compute_sn_ratio(&self, values: &[f64], objective: TaguchiObjective) -> f64 {
        let n = values.len() as f64;

        match objective {
            TaguchiObjective::SmallerIsBetter => {
                let mean_sq = values.iter().map(|&y| y * y).sum::<f64>() / n;
                -10.0 * mean_sq.log10()
            }
            TaguchiObjective::LargerIsBetter => {
                let mean_inv_sq = values.iter().map(|&y| 1.0 / (y * y).max(1e-10)).sum::<f64>() / n;
                -10.0 * mean_inv_sq.log10()
            }
            TaguchiObjective::NominalIsBest { target: _ } => {
                let mean = values.iter().sum::<f64>() / n;
                let variance = values.iter().map(|&y| (y - mean).powi(2)).sum::<f64>() / n;
                10.0 * (mean * mean / variance.max(1e-10)).log10()
            }
        }
    }

    /// Get optimal design point
    pub fn optimal_design(&self) -> Vec<f64> {
        self.optimal_levels.iter()
            .enumerate()
            .map(|(i, &level)| self.levels[i][level])
            .collect()
    }
}

impl Default for TaguchiMethod {
    fn default() -> Self {
        Self::new()
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

fn inverse_standard_normal_cdf(p: f64) -> f64 {
    if p <= 0.0 { return f64::NEG_INFINITY; }
    if p >= 1.0 { return f64::INFINITY; }

    let a = [
        -3.969683028665376e+01,
        2.209460984245205e+02,
        -2.759285104469687e+02,
        1.383577518672690e+02,
        -3.066479806614716e+01,
        2.506628277459239e+00,
    ];
    let b = [
        -5.447609879822406e+01,
        1.615858368580409e+02,
        -1.556989798598866e+02,
        6.680131188771972e+01,
        -1.328068155288572e+01,
    ];
    let c = [
        -7.784894002430293e-03,
        -3.223964580411365e-01,
        -2.400758277161838e+00,
        -2.549732539343734e+00,
        4.374664141464968e+00,
        2.938163982698783e+00,
    ];
    let d = [
        7.784695709041462e-03,
        3.224671290700398e-01,
        2.445134137142996e+00,
        3.754408661907416e+00,
    ];

    let p_low = 0.02425;
    let p_high = 1.0 - p_low;

    if p < p_low {
        let q = (-2.0 * p.ln()).sqrt();
        (((((c[0]*q + c[1])*q + c[2])*q + c[3])*q + c[4])*q + c[5]) /
        ((((d[0]*q + d[1])*q + d[2])*q + d[3])*q + 1.0)
    } else if p <= p_high {
        let q = p - 0.5;
        let r = q * q;
        (((((a[0]*r + a[1])*r + a[2])*r + a[3])*r + a[4])*r + a[5])*q /
        (((((b[0]*r + b[1])*r + b[2])*r + b[3])*r + b[4])*r + 1.0)
    } else {
        let q = (-2.0 * (1.0 - p).ln()).sqrt();
        -(((((c[0]*q + c[1])*q + c[2])*q + c[3])*q + c[4])*q + c[5]) /
        ((((d[0]*q + d[1])*q + d[2])*q + d[3])*q + 1.0)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_uncertain_design_variable() {
        let var = UncertainDesignVariable::uncertain("thickness", 10.0, 5.0, 15.0, 0.1);
        assert!((var.std_dev() - 1.0).abs() < 1e-10);
    }

    #[test]
    fn test_robust_optimizer_mean_plus_sigma() {
        let mut opt = RobustOptimizer::new(RobustFormulation::MeanPlusKSigma { k: 2.0 });
        opt.n_samples = 50;
        opt.max_iterations = 20;

        let variables = vec![
            UncertainDesignVariable::deterministic("x", 0.0, -5.0, 5.0),
        ];
        let random_params = vec![
            RandomParameter::new("noise", 0.0, 0.5),
        ];

        // Simple quadratic objective
        let objective = |d: &[f64], r: &[f64]| (d[0] - 2.0).powi(2) + r[0];

        opt.optimize(&variables, &random_params, objective);

        // Optimal should be near x = 2
        assert!((opt.optimal_design[0] - 2.0).abs() < 1.0);
    }

    #[test]
    fn test_rbdo_optimizer() {
        let mut opt = RBDOOptimizer::new();
        opt.max_iterations = 10;
        opt.n_reliability_samples = 100;

        let variables = vec![
            UncertainDesignVariable::deterministic("area", 100.0, 50.0, 200.0),
        ];
        let random_params = vec![
            RandomParameter::new("load", 1000.0, 100.0),
        ];

        let objective = |d: &[f64]| d[0];  // Minimize area
        let constraints = vec![
            ProbabilisticConstraint::with_beta("stress", 3.0),
        ];
        let constraint_fns: Vec<Box<dyn Fn(&[f64], &[f64]) -> f64>> = vec![
            Box::new(|d: &[f64], r: &[f64]| r[0] / d[0] - 15.0),  // stress <= 15
        ];

        opt.optimize(&variables, &random_params, objective, &constraints,
            constraint_fns.iter().map(|f| |d: &[f64], r: &[f64]| f(d, r)).collect::<Vec<_>>());

        assert!(!opt.optimal_design.is_empty());
    }

    #[test]
    fn test_multi_objective_robust() {
        let mut opt = MultiObjectiveRobust::new(20, 10);
        opt.n_samples = 20;

        let variables = vec![
            UncertainDesignVariable::deterministic("x", 0.0, 0.0, 10.0),
        ];
        let random_params = vec![];

        let objectives: Vec<Box<dyn Fn(&[f64], &[f64]) -> f64>> = vec![
            Box::new(|d: &[f64], _: &[f64]| d[0]),       // Minimize x
            Box::new(|d: &[f64], _: &[f64]| (10.0 - d[0]).abs()), // Minimize |10-x|
        ];

        opt.optimize(&variables, &random_params, 
            &objectives.iter().map(|f| |d: &[f64], r: &[f64]| f(d, r)).collect::<Vec<_>>());

        assert!(!opt.pareto_front.is_empty());
    }

    #[test]
    fn test_worst_case_optimizer() {
        let mut opt = WorstCaseOptimizer::new(UncertaintySetType::Box);
        opt.max_iterations = 20;

        let variables = vec![
            UncertainDesignVariable::deterministic("x", 0.0, -5.0, 5.0),
        ];
        let random_params = vec![
            RandomParameter::new("p", 0.0, 1.0),
        ];

        let objective = |d: &[f64], r: &[f64]| (d[0] - r[0]).powi(2);

        opt.optimize(&variables, &random_params, objective);

        assert!(!opt.optimal_design.is_empty());
    }

    #[test]
    fn test_taguchi_l4() {
        let mut taguchi = TaguchiMethod::new();
        
        let levels = vec![
            vec![1.0, 2.0],
            vec![10.0, 20.0],
            vec![0.1, 0.2],
        ];
        taguchi.setup_l4(levels);

        let experiment = |factors: &[f64]| factors[0] * factors[1] + factors[2];

        taguchi.analyze(TaguchiObjective::SmallerIsBetter, experiment, 3);

        assert_eq!(taguchi.optimal_levels.len(), 3);
    }

    #[test]
    fn test_taguchi_l9() {
        let mut taguchi = TaguchiMethod::new();
        
        let levels = vec![
            vec![1.0, 2.0, 3.0],
            vec![10.0, 20.0, 30.0],
            vec![0.1, 0.2, 0.3],
            vec![100.0, 200.0, 300.0],
        ];
        taguchi.setup_l9(levels);

        let experiment = |factors: &[f64]| factors.iter().sum::<f64>();

        taguchi.analyze(TaguchiObjective::LargerIsBetter, experiment, 2);

        assert!(!taguchi.sn_ratios.is_empty());
    }

    #[test]
    fn test_sn_ratio_smaller_is_better() {
        let taguchi = TaguchiMethod::new();
        let values = vec![1.0, 2.0, 3.0];
        let sn = taguchi.compute_sn_ratio(&values, TaguchiObjective::SmallerIsBetter);
        assert!(sn < 0.0);  // Negative for larger values
    }

    #[test]
    fn test_sn_ratio_nominal_is_best() {
        let taguchi = TaguchiMethod::new();
        let values = vec![10.0, 10.1, 9.9];
        let sn = taguchi.compute_sn_ratio(&values, TaguchiObjective::NominalIsBest { target: 10.0 });
        assert!(sn > 0.0);  // High S/N for low variance around mean
    }
}
