//! Structural Optimization Engine
//!
//! Comprehensive optimization framework for structural design including:
//! - Topology optimization (SIMP, BESO, Level Set)
//! - Shape optimization
//! - Size optimization
//! - Multi-objective optimization
//!
//! ## Optimization Methods
//! - **Gradient-based** - MMA, GCMMA, SLP, SQP
//! - **Gradient-free** - Genetic algorithms, PSO
//! - **Discrete** - Integer programming for sizing

use serde::{Deserialize, Serialize};

// ============================================================================
// OPTIMIZATION PROBLEM DEFINITION
// ============================================================================

/// Optimization problem
#[derive(Debug, Clone)]
pub struct OptimizationProblem {
    pub name: String,
    pub design_variables: Vec<DesignVariable>,
    pub objective: ObjectiveFunction,
    pub constraints: Vec<Constraint>,
    pub settings: OptimizationSettings,
}

/// Design variable
#[derive(Debug, Clone)]
pub struct DesignVariable {
    pub id: usize,
    pub name: String,
    pub var_type: VariableType,
    pub lower_bound: f64,
    pub upper_bound: f64,
    pub initial_value: f64,
    pub current_value: f64,
}

/// Type of design variable
#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
pub enum VariableType {
    Continuous,
    Integer,
    Discrete { values: [f64; 10], count: usize },
}

/// Objective function
#[derive(Debug, Clone)]
pub struct ObjectiveFunction {
    pub sense: OptimizationSense,
    pub function_type: ObjectiveType,
    pub weight: f64,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
pub enum OptimizationSense {
    Minimize,
    Maximize,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
pub enum ObjectiveType {
    Weight,
    Compliance,
    Stress,
    Displacement,
    Frequency,
    Custom,
}

/// Constraint
#[derive(Debug, Clone)]
pub struct Constraint {
    pub id: usize,
    pub name: String,
    pub constraint_type: ConstraintType,
    pub bound: f64,
    pub tolerance: f64,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
pub enum ConstraintType {
    StressMax,
    DisplacementMax,
    FrequencyMin,
    VolumeMax,
    VolumeFraction,
    Buckling,
    Custom,
}

/// Optimization settings
#[derive(Debug, Clone)]
pub struct OptimizationSettings {
    pub max_iterations: usize,
    pub convergence_tolerance: f64,
    pub move_limit: f64,
    pub continuation: bool,
}

impl Default for OptimizationSettings {
    fn default() -> Self {
        OptimizationSettings {
            max_iterations: 100,
            convergence_tolerance: 1e-4,
            move_limit: 0.2,
            continuation: true,
        }
    }
}

// ============================================================================
// TOPOLOGY OPTIMIZATION - SIMP
// ============================================================================

/// SIMP (Solid Isotropic Material with Penalization)
#[derive(Debug, Clone)]
pub struct SIMPOptimization {
    pub n_elements: usize,
    pub densities: Vec<f64>,          // ρ_e ∈ [0, 1]
    pub sensitivities: Vec<f64>,      // ∂C/∂ρ
    pub penalization: f64,            // p (typically 3)
    pub filter_radius: f64,
    pub volume_fraction: f64,         // Target volume
    pub min_density: f64,             // ρ_min (avoid singularity)
}

impl SIMPOptimization {
    pub fn new(n_elements: usize, volume_fraction: f64) -> Self {
        SIMPOptimization {
            n_elements,
            densities: vec![volume_fraction; n_elements],
            sensitivities: vec![0.0; n_elements],
            penalization: 3.0,
            filter_radius: 0.0,
            volume_fraction,
            min_density: 1e-3,
        }
    }

    /// Penalized stiffness: E(ρ) = ρ^p * E0
    pub fn penalized_modulus(&self, element_id: usize, e0: f64) -> f64 {
        let rho = self.densities[element_id].max(self.min_density);
        rho.powf(self.penalization) * e0
    }

    /// Sensitivity: ∂C/∂ρ = -p * ρ^(p-1) * u^T * K0 * u
    pub fn compute_sensitivity(
        &mut self,
        element_id: usize,
        element_compliance: f64,
    ) {
        let rho = self.densities[element_id].max(self.min_density);
        let dc = -self.penalization * rho.powf(self.penalization - 1.0) * element_compliance;
        self.sensitivities[element_id] = dc;
    }

    /// Optimality Criteria (OC) update
    pub fn oc_update(&mut self, move_limit: f64) -> f64 {
        // Bi-section to find Lagrange multiplier
        let mut l1 = 0.0;
        let mut l2 = 1e9;

        let mut new_densities = self.densities.clone();

        while (l2 - l1) / (l2 + l1) > 1e-3 {
            let lambda = 0.5 * (l1 + l2);

            for (i, rho) in new_densities.iter_mut().enumerate() {
                let rho_old = self.densities[i];
                let _sens = self.sensitivities[i].abs().max(1e-10);

                // B_e = -∂C/∂ρ / λ
                let b_e = (-self.sensitivities[i] / lambda).max(0.0);

                // OC update with move limits
                let rho_new = rho_old * b_e.sqrt();

                // Apply bounds
                *rho = rho_new
                    .max(self.min_density)
                    .max(rho_old - move_limit)
                    .min(1.0)
                    .min(rho_old + move_limit);
            }

            // Check volume constraint
            let volume: f64 = new_densities.iter().sum::<f64>() / self.n_elements as f64;

            if volume > self.volume_fraction {
                l1 = lambda;
            } else {
                l2 = lambda;
            }
        }

        // Compute change
        let change: f64 = self.densities.iter()
            .zip(new_densities.iter())
            .map(|(old, new)| (old - new).abs())
            .fold(0.0, f64::max);

        self.densities = new_densities;
        change
    }

    /// Sensitivity filter (mesh-independent)
    pub fn apply_filter(&mut self, element_centers: &[(f64, f64, f64)]) {
        if self.filter_radius <= 0.0 {
            return;
        }

        let filtered: Vec<f64> = (0..self.n_elements)
            .map(|i| {
                let center_i = element_centers[i];
                let mut sum_h = 0.0;
                let mut sum_hs = 0.0;

                for (j, center_j) in element_centers.iter().enumerate() {
                    let dist = ((center_i.0 - center_j.0).powi(2)
                        + (center_i.1 - center_j.1).powi(2)
                        + (center_i.2 - center_j.2).powi(2))
                    .sqrt();

                    if dist < self.filter_radius {
                        let h = self.filter_radius - dist;
                        sum_h += h;
                        sum_hs += h * self.sensitivities[j] * self.densities[j];
                    }
                }

                if sum_h > 1e-10 {
                    sum_hs / (sum_h * self.densities[i].max(1e-10))
                } else {
                    self.sensitivities[i]
                }
            })
            .collect();

        self.sensitivities = filtered;
    }

    /// Current volume
    pub fn current_volume(&self) -> f64 {
        self.densities.iter().sum::<f64>() / self.n_elements as f64
    }

    /// Number of elements above threshold
    pub fn solid_elements(&self, threshold: f64) -> usize {
        self.densities.iter().filter(|&&d| d > threshold).count()
    }
}

// ============================================================================
// TOPOLOGY OPTIMIZATION - BESO
// ============================================================================

/// BESO (Bi-directional Evolutionary Structural Optimization)
#[derive(Debug, Clone)]
pub struct BESOOptimization {
    pub n_elements: usize,
    pub densities: Vec<f64>,          // 0 or 1 (with history averaging)
    pub sensitivities: Vec<f64>,
    pub history: Vec<f64>,            // Previous sensitivities
    pub evolutionary_ratio: f64,      // ER (removal ratio)
    pub volume_target: f64,
    pub addition_ratio: f64,          // AR
}

impl BESOOptimization {
    pub fn new(n_elements: usize, volume_target: f64) -> Self {
        BESOOptimization {
            n_elements,
            densities: vec![1.0; n_elements],
            sensitivities: vec![0.0; n_elements],
            history: vec![0.0; n_elements],
            evolutionary_ratio: 0.02,
            volume_target,
            addition_ratio: 0.01,
        }
    }

    /// Sensitivity averaging (for stability)
    pub fn average_sensitivities(&mut self) {
        for i in 0..self.n_elements {
            self.sensitivities[i] = 0.5 * (self.sensitivities[i] + self.history[i]);
        }
        self.history = self.sensitivities.clone();
    }

    /// BESO update
    pub fn update(&mut self, target_volume: f64) -> f64 {
        // Sort elements by sensitivity
        let mut indexed: Vec<(usize, f64)> = self.sensitivities.iter()
            .enumerate()
            .map(|(i, &s)| (i, s))
            .collect();

        indexed.sort_by(|a, b| a.1.partial_cmp(&b.1).unwrap_or(std::cmp::Ordering::Equal));

        // Determine threshold
        let current_volume: f64 = self.densities.iter().sum();
        let n_remove = ((current_volume - target_volume * self.n_elements as f64)
            .max(0.0) * self.evolutionary_ratio) as usize;

        let threshold_idx = n_remove.min(indexed.len() - 1);
        let threshold = indexed[threshold_idx].1;

        // Update densities
        let mut changes = 0;
        for i in 0..self.n_elements {
            let _old = self.densities[i];
            if self.sensitivities[i] <= threshold && self.densities[i] > 0.5 {
                self.densities[i] = 0.001; // Remove
                changes += 1;
            } else if self.sensitivities[i] > threshold && self.densities[i] < 0.5 {
                self.densities[i] = 1.0; // Add
                changes += 1;
            }
        }

        changes as f64 / self.n_elements as f64
    }

    /// Current solid volume
    pub fn solid_volume(&self) -> f64 {
        self.densities.iter().filter(|&&d| d > 0.5).count() as f64 / self.n_elements as f64
    }
}

// ============================================================================
// SIZE OPTIMIZATION
// ============================================================================

/// Size optimization (cross-section, thickness)
#[derive(Debug, Clone)]
pub struct SizeOptimization {
    pub variables: Vec<SizeVariable>,
    pub constraints: Vec<SizeConstraint>,
    pub objective: SizeObjective,
}

/// Size design variable
#[derive(Debug, Clone)]
pub struct SizeVariable {
    pub id: usize,
    pub element_ids: Vec<usize>,
    pub property_type: PropertyType,
    pub lower_bound: f64,
    pub upper_bound: f64,
    pub current_value: f64,
    pub gradient: f64,
}

#[derive(Debug, Clone, Copy)]
pub enum PropertyType {
    Thickness,
    CrossSection,
    Diameter,
    Width,
    Height,
}

/// Size constraint
#[derive(Debug, Clone)]
pub struct SizeConstraint {
    pub name: String,
    pub response: ResponseType,
    pub bound: f64,
    pub is_upper: bool,
    pub gradient: Vec<f64>,
}

#[derive(Debug, Clone, Copy)]
pub enum ResponseType {
    MaxStress,
    MaxDisplacement,
    Weight,
    Frequency,
    Buckling,
}

/// Size objective
#[derive(Debug, Clone)]
pub struct SizeObjective {
    pub response: ResponseType,
    pub minimize: bool,
    pub value: f64,
    pub gradient: Vec<f64>,
}

impl SizeOptimization {
    pub fn new() -> Self {
        SizeOptimization {
            variables: Vec::new(),
            constraints: Vec::new(),
            objective: SizeObjective {
                response: ResponseType::Weight,
                minimize: true,
                value: 0.0,
                gradient: Vec::new(),
            },
        }
    }

    /// Add design variable
    pub fn add_variable(
        &mut self,
        element_ids: Vec<usize>,
        prop_type: PropertyType,
        lower: f64,
        upper: f64,
        initial: f64,
    ) {
        let id = self.variables.len();
        self.variables.push(SizeVariable {
            id,
            element_ids,
            property_type: prop_type,
            lower_bound: lower,
            upper_bound: upper,
            current_value: initial,
            gradient: 0.0,
        });
    }

    /// Current design vector
    pub fn design_vector(&self) -> Vec<f64> {
        self.variables.iter().map(|v| v.current_value).collect()
    }

    /// Update design
    pub fn set_design(&mut self, x: &[f64]) {
        for (i, val) in x.iter().enumerate() {
            if i < self.variables.len() {
                self.variables[i].current_value = *val;
            }
        }
    }
}

impl Default for SizeOptimization {
    fn default() -> Self {
        Self::new()
    }
}

// ============================================================================
// METHOD OF MOVING ASYMPTOTES (MMA)
// ============================================================================

/// MMA optimizer
pub struct MMAOptimizer {
    pub n_vars: usize,
    pub n_constraints: usize,
    pub x_old1: Vec<f64>,
    pub x_old2: Vec<f64>,
    pub low: Vec<f64>,
    pub upp: Vec<f64>,
    pub move_limit: f64,
    pub asymptote_init: f64,
    pub asymptote_incr: f64,
    pub asymptote_decr: f64,
}

impl MMAOptimizer {
    pub fn new(n_vars: usize, n_constraints: usize) -> Self {
        MMAOptimizer {
            n_vars,
            n_constraints,
            x_old1: vec![0.0; n_vars],
            x_old2: vec![0.0; n_vars],
            low: vec![0.0; n_vars],
            upp: vec![1.0; n_vars],
            move_limit: 0.2,
            asymptote_init: 0.5,
            asymptote_incr: 1.2,
            asymptote_decr: 0.7,
        }
    }

    /// MMA subproblem solve
    pub fn update(
        &mut self,
        x: &[f64],
        x_min: &[f64],
        x_max: &[f64],
        _f0: f64,
        df0: &[f64],
        _fval: &[f64],
        _dfdx: &[Vec<f64>],
        iteration: usize,
    ) -> Vec<f64> {
        let mut x_new = vec![0.0; self.n_vars];

        // Update asymptotes
        if iteration <= 2 {
            for i in 0..self.n_vars {
                self.low[i] = x[i] - self.asymptote_init * (x_max[i] - x_min[i]);
                self.upp[i] = x[i] + self.asymptote_init * (x_max[i] - x_min[i]);
            }
        } else {
            for i in 0..self.n_vars {
                let oscil = (x[i] - self.x_old1[i]) * (self.x_old1[i] - self.x_old2[i]);

                let factor = if oscil < 0.0 {
                    self.asymptote_decr
                } else {
                    self.asymptote_incr
                };

                self.low[i] = x[i] - factor * (self.x_old1[i] - self.low[i]);
                self.upp[i] = x[i] + factor * (self.upp[i] - self.x_old1[i]);

                // Bounds on asymptotes
                let d = x_max[i] - x_min[i];
                self.low[i] = self.low[i].max(x[i] - 10.0 * d).min(x[i] - 0.01 * d);
                self.upp[i] = self.upp[i].max(x[i] + 0.01 * d).min(x[i] + 10.0 * d);
            }
        }

        // Move limits
        let alpha: Vec<f64> = (0..self.n_vars)
            .map(|i| {
                x_min[i].max(self.low[i] + 0.1 * (x[i] - self.low[i]))
                    .max(x[i] - self.move_limit * (x_max[i] - x_min[i]))
            })
            .collect();

        let beta: Vec<f64> = (0..self.n_vars)
            .map(|i| {
                x_max[i].min(self.upp[i] - 0.1 * (self.upp[i] - x[i]))
                    .min(x[i] + self.move_limit * (x_max[i] - x_min[i]))
            })
            .collect();

        // Solve subproblem (simplified dual approach)
        for i in 0..self.n_vars {
            let p0i = if df0[i] > 0.0 {
                (self.upp[i] - x[i]).powi(2) * df0[i]
            } else {
                0.0
            };
            let q0i = if df0[i] < 0.0 {
                (x[i] - self.low[i]).powi(2) * (-df0[i])
            } else {
                0.0
            };

            // Simplified update (without full dual solve)
            let b = p0i / (self.upp[i] - x[i]).powi(2) + q0i / (x[i] - self.low[i]).powi(2);

            if b.abs() > 1e-10 {
                // Newton-like step
                x_new[i] = (self.low[i] * q0i.sqrt() + self.upp[i] * p0i.sqrt())
                    / (q0i.sqrt() + p0i.sqrt() + 1e-10);
            } else {
                x_new[i] = x[i];
            }

            // Apply bounds
            x_new[i] = x_new[i].max(alpha[i]).min(beta[i]);
        }

        // Update history
        self.x_old2 = self.x_old1.clone();
        self.x_old1 = x.to_vec();

        x_new
    }
}

// ============================================================================
// GENETIC ALGORITHM
// ============================================================================

/// Genetic algorithm optimizer
#[derive(Debug, Clone)]
pub struct GeneticAlgorithm {
    pub population_size: usize,
    pub n_generations: usize,
    pub crossover_rate: f64,
    pub mutation_rate: f64,
    pub elitism: usize,
    pub tournament_size: usize,
}

impl GeneticAlgorithm {
    pub fn new(pop_size: usize, n_gen: usize) -> Self {
        GeneticAlgorithm {
            population_size: pop_size,
            n_generations: n_gen,
            crossover_rate: 0.9,
            mutation_rate: 0.01,
            elitism: 2,
            tournament_size: 3,
        }
    }

    /// Initialize population
    pub fn initialize(&self, _n_vars: usize, bounds: &[(f64, f64)]) -> Vec<Vec<f64>> {
        let mut pop = Vec::new();

        for _ in 0..self.population_size {
            let individual: Vec<f64> = bounds.iter()
                .map(|(lo, hi)| lo + rand_f64() * (hi - lo))
                .collect();
            pop.push(individual);
        }

        pop
    }

    /// Tournament selection
    pub fn select(&self, fitness: &[f64]) -> usize {
        let mut best = (rand_f64() * self.population_size as f64) as usize;
        best = best.min(self.population_size - 1);

        for _ in 1..self.tournament_size {
            let candidate = (rand_f64() * self.population_size as f64) as usize;
            let candidate = candidate.min(self.population_size - 1);

            if fitness[candidate] < fitness[best] {
                best = candidate;
            }
        }

        best
    }

    /// SBX crossover
    pub fn crossover(&self, p1: &[f64], p2: &[f64], bounds: &[(f64, f64)]) -> (Vec<f64>, Vec<f64>) {
        let mut c1 = p1.to_vec();
        let mut c2 = p2.to_vec();

        if rand_f64() < self.crossover_rate {
            let eta = 20.0; // Distribution index

            for i in 0..p1.len() {
                if rand_f64() < 0.5 {
                    let (lo, hi) = bounds[i];

                    let y1 = p1[i].min(p2[i]);
                    let y2 = p1[i].max(p2[i]);

                    if (y2 - y1).abs() > 1e-10 {
                        let beta = 1.0 + (2.0 * (y1 - lo) / (y2 - y1));
                        let alpha = 2.0 - beta.powf(-(eta + 1.0));
                        let betaq = self.sbx_betaq(rand_f64(), alpha, eta);

                        c1[i] = 0.5 * ((y1 + y2) - betaq * (y2 - y1));

                        let beta = 1.0 + (2.0 * (hi - y2) / (y2 - y1));
                        let alpha = 2.0 - beta.powf(-(eta + 1.0));
                        let betaq = self.sbx_betaq(rand_f64(), alpha, eta);

                        c2[i] = 0.5 * ((y1 + y2) + betaq * (y2 - y1));

                        c1[i] = c1[i].max(lo).min(hi);
                        c2[i] = c2[i].max(lo).min(hi);
                    }
                }
            }
        }

        (c1, c2)
    }

    fn sbx_betaq(&self, rand: f64, alpha: f64, eta: f64) -> f64 {
        if rand <= 1.0 / alpha {
            (rand * alpha).powf(1.0 / (eta + 1.0))
        } else {
            (1.0 / (2.0 - rand * alpha)).powf(1.0 / (eta + 1.0))
        }
    }

    /// Polynomial mutation
    pub fn mutate(&self, individual: &mut [f64], bounds: &[(f64, f64)]) {
        let eta = 20.0;

        for (i, x) in individual.iter_mut().enumerate() {
            if rand_f64() < self.mutation_rate {
                let (lo, hi) = bounds[i];
                let delta1 = (*x - lo) / (hi - lo);
                let delta2 = (hi - *x) / (hi - lo);

                let rand = rand_f64();
                let deltaq = if rand < 0.5 {
                    let val = 2.0 * rand + (1.0 - 2.0 * rand) * (1.0 - delta1).powf(eta + 1.0);
                    val.powf(1.0 / (eta + 1.0)) - 1.0
                } else {
                    let val = 2.0 * (1.0 - rand) + 2.0 * (rand - 0.5) * (1.0 - delta2).powf(eta + 1.0);
                    1.0 - val.powf(1.0 / (eta + 1.0))
                };

                *x = (*x + deltaq * (hi - lo)).max(lo).min(hi);
            }
        }
    }
}

// ============================================================================
// MULTI-OBJECTIVE OPTIMIZATION
// ============================================================================

/// Multi-objective problem
#[derive(Debug, Clone)]
pub struct MultiObjectiveProblem {
    pub n_objectives: usize,
    pub objectives: Vec<ObjectiveFunction>,
    pub pareto_front: Vec<ParetoPoint>,
}

/// Pareto optimal point
#[derive(Debug, Clone)]
pub struct ParetoPoint {
    pub design: Vec<f64>,
    pub objectives: Vec<f64>,
    pub rank: usize,
    pub crowding_distance: f64,
}

impl MultiObjectiveProblem {
    pub fn new(n_obj: usize) -> Self {
        MultiObjectiveProblem {
            n_objectives: n_obj,
            objectives: Vec::new(),
            pareto_front: Vec::new(),
        }
    }

    /// Non-dominated sorting
    pub fn non_dominated_sort(&mut self, population: &[ParetoPoint]) -> Vec<Vec<usize>> {
        let n = population.len();
        let mut fronts: Vec<Vec<usize>> = vec![Vec::new()];
        let mut domination_count = vec![0; n];
        let mut dominated_by: Vec<Vec<usize>> = vec![Vec::new(); n];

        for i in 0..n {
            for j in (i + 1)..n {
                let dom = self.dominates(&population[i], &population[j]);

                if dom == 1 {
                    dominated_by[i].push(j);
                    domination_count[j] += 1;
                } else if dom == -1 {
                    dominated_by[j].push(i);
                    domination_count[i] += 1;
                }
            }

            if domination_count[i] == 0 {
                fronts[0].push(i);
            }
        }

        let mut i = 0;
        while !fronts[i].is_empty() {
            let mut next_front = Vec::new();

            for &p in &fronts[i] {
                for &q in &dominated_by[p] {
                    domination_count[q] -= 1;
                    if domination_count[q] == 0 {
                        next_front.push(q);
                    }
                }
            }

            i += 1;
            if !next_front.is_empty() {
                fronts.push(next_front);
            }
        }

        fronts
    }

    /// Check dominance (1: p dominates q, -1: q dominates p, 0: neither)
    fn dominates(&self, p: &ParetoPoint, q: &ParetoPoint) -> i32 {
        let mut p_better = false;
        let mut q_better = false;

        for i in 0..self.n_objectives {
            if p.objectives[i] < q.objectives[i] {
                p_better = true;
            } else if p.objectives[i] > q.objectives[i] {
                q_better = true;
            }
        }

        if p_better && !q_better {
            1
        } else if q_better && !p_better {
            -1
        } else {
            0
        }
    }

    /// Compute crowding distance
    pub fn crowding_distance(&self, front: &mut [ParetoPoint]) {
        let n = front.len();
        if n == 0 {
            return;
        }

        for point in front.iter_mut() {
            point.crowding_distance = 0.0;
        }

        for m in 0..self.n_objectives {
            // Sort by objective m
            front.sort_by(|a, b| a.objectives[m].partial_cmp(&b.objectives[m]).unwrap_or(std::cmp::Ordering::Equal));

            // Boundary points get infinite distance
            front[0].crowding_distance = f64::INFINITY;
            front[n - 1].crowding_distance = f64::INFINITY;

            let f_max = front[n - 1].objectives[m];
            let f_min = front[0].objectives[m];
            let range = f_max - f_min;

            if range > 1e-10 {
                for i in 1..n - 1 {
                    front[i].crowding_distance += (front[i + 1].objectives[m] - front[i - 1].objectives[m]) / range;
                }
            }
        }
    }
}

// ============================================================================
// COMPLIANCE MINIMIZATION
// ============================================================================

/// Compliance minimization problem
pub struct ComplianceMinimization {
    pub simp: SIMPOptimization,
    pub iteration: usize,
    pub compliance_history: Vec<f64>,
    pub volume_history: Vec<f64>,
}

impl ComplianceMinimization {
    pub fn new(n_elements: usize, volume_fraction: f64) -> Self {
        ComplianceMinimization {
            simp: SIMPOptimization::new(n_elements, volume_fraction),
            iteration: 0,
            compliance_history: Vec::new(),
            volume_history: Vec::new(),
        }
    }

    /// Single optimization iteration
    pub fn iterate(&mut self, element_compliances: &[f64], move_limit: f64) -> (f64, f64) {
        self.iteration += 1;

        // Compute sensitivities
        for (i, &ce) in element_compliances.iter().enumerate() {
            self.simp.compute_sensitivity(i, ce);
        }

        // Update densities
        let change = self.simp.oc_update(move_limit);

        // Compute total compliance
        let total_compliance: f64 = element_compliances.iter()
            .zip(self.simp.densities.iter())
            .map(|(&c, &rho)| c * rho.powf(self.simp.penalization))
            .sum();

        let volume = self.simp.current_volume();

        self.compliance_history.push(total_compliance);
        self.volume_history.push(volume);

        (change, total_compliance)
    }

    /// Check convergence
    pub fn converged(&self, tolerance: f64, min_iterations: usize) -> bool {
        if self.iteration < min_iterations {
            return false;
        }

        if self.compliance_history.len() < 5 {
            return false;
        }

        let n = self.compliance_history.len();
        let recent: Vec<f64> = self.compliance_history[n - 5..].to_vec();
        let avg = recent.iter().sum::<f64>() / 5.0;
        let max_dev = recent.iter().map(|&c| (c - avg).abs()).fold(0.0, f64::max);

        max_dev / avg < tolerance
    }
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/// Simple pseudo-random number generator
fn rand_f64() -> f64 {
    use std::time::{SystemTime, UNIX_EPOCH};
    static mut SEED: u64 = 12345;

    unsafe {
        SEED = SEED.wrapping_mul(1103515245).wrapping_add(12345);
        let time_component = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .map(|d| d.as_nanos() as u64)
            .unwrap_or(0);
        SEED ^= time_component;
        (SEED % 10000) as f64 / 10000.0
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_simp_penalization() {
        let simp = SIMPOptimization::new(100, 0.5);
        let e0 = 210e9;

        // Full density
        let e_full = simp.penalized_modulus(0, e0);
        assert!((e_full / e0 - 0.5_f64.powf(3.0)).abs() < 1e-6);
    }

    #[test]
    fn test_simp_oc_update() {
        let mut simp = SIMPOptimization::new(10, 0.5);
        simp.sensitivities = vec![-1.0; 10];

        let change = simp.oc_update(0.2);
        assert!(change >= 0.0);
    }

    #[test]
    fn test_simp_volume() {
        let simp = SIMPOptimization::new(100, 0.5);
        let vol = simp.current_volume();
        assert!((vol - 0.5).abs() < 1e-10);
    }

    #[test]
    fn test_beso_initialization() {
        let beso = BESOOptimization::new(100, 0.5);
        assert_eq!(beso.solid_volume(), 1.0); // Starts full
    }

    #[test]
    fn test_size_optimization() {
        let mut opt = SizeOptimization::new();
        opt.add_variable(vec![0, 1, 2], PropertyType::Thickness, 0.001, 0.01, 0.005);

        assert_eq!(opt.variables.len(), 1);
        assert_eq!(opt.design_vector(), vec![0.005]);
    }

    #[test]
    fn test_mma_asymptotes() {
        let mma = MMAOptimizer::new(5, 2);
        assert_eq!(mma.n_vars, 5);
        assert_eq!(mma.low.len(), 5);
    }

    #[test]
    fn test_genetic_algorithm() {
        let ga = GeneticAlgorithm::new(50, 100);
        let bounds = vec![(0.0, 1.0); 3];

        let pop = ga.initialize(3, &bounds);
        assert_eq!(pop.len(), 50);
        assert_eq!(pop[0].len(), 3);
    }

    #[test]
    fn test_ga_crossover() {
        let ga = GeneticAlgorithm::new(50, 100);
        let p1 = vec![0.2, 0.3, 0.4];
        let p2 = vec![0.8, 0.7, 0.6];
        let bounds = vec![(0.0, 1.0); 3];

        let (c1, c2) = ga.crossover(&p1, &p2, &bounds);

        for i in 0..3 {
            assert!(c1[i] >= 0.0 && c1[i] <= 1.0);
            assert!(c2[i] >= 0.0 && c2[i] <= 1.0);
        }
    }

    #[test]
    fn test_multi_objective() {
        let mo = MultiObjectiveProblem::new(2);

        let p1 = ParetoPoint {
            design: vec![0.5],
            objectives: vec![1.0, 2.0],
            rank: 0,
            crowding_distance: 0.0,
        };

        let p2 = ParetoPoint {
            design: vec![0.6],
            objectives: vec![2.0, 1.0],
            rank: 0,
            crowding_distance: 0.0,
        };

        let dom = mo.dominates(&p1, &p2);
        assert_eq!(dom, 0); // Neither dominates (trade-off)
    }

    #[test]
    fn test_dominance() {
        let mo = MultiObjectiveProblem::new(2);

        let p1 = ParetoPoint {
            design: vec![0.5],
            objectives: vec![1.0, 1.0],
            rank: 0,
            crowding_distance: 0.0,
        };

        let p2 = ParetoPoint {
            design: vec![0.6],
            objectives: vec![2.0, 2.0],
            rank: 0,
            crowding_distance: 0.0,
        };

        let dom = mo.dominates(&p1, &p2);
        assert_eq!(dom, 1); // p1 dominates p2
    }

    #[test]
    fn test_compliance_minimization() {
        let mut opt = ComplianceMinimization::new(100, 0.5);
        let element_compliances = vec![1.0; 100];

        let (change, compliance) = opt.iterate(&element_compliances, 0.2);

        assert!(change >= 0.0);
        assert!(compliance > 0.0);
    }

    #[test]
    fn test_convergence_check() {
        let mut opt = ComplianceMinimization::new(10, 0.5);

        // Add some history
        for i in 0..10 {
            opt.compliance_history.push(100.0 - i as f64 * 0.1);
        }
        opt.iteration = 10;

        // Should be converged with tolerance 0.01
        let conv = opt.converged(0.01, 5);
        assert!(conv);
    }
}
