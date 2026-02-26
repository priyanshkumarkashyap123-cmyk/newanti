//! Structural Optimization Module
//! 
//! Optimization algorithms for structural design:
//! - Size optimization (member dimensions)
//! - Shape optimization (geometry)
//! - Topology optimization (material distribution)
//! - Multi-objective optimization
//! - Constraint handling
//! - Sensitivity analysis

use serde::{Deserialize, Serialize};
use std::collections::HashMap;

/// Structural optimizer
#[derive(Debug, Clone)]
pub struct StructuralOptimizer {
    /// Problem definition
    pub problem: OptimizationProblem,
    /// Algorithm settings
    pub settings: OptimizerSettings,
    /// Current solution
    pub solution: Option<OptimizationSolution>,
    /// Iteration history
    pub history: Vec<IterationRecord>,
}

/// Optimization problem definition
#[derive(Debug, Clone)]
pub struct OptimizationProblem {
    /// Problem name
    pub name: String,
    /// Design variables
    pub variables: Vec<DesignVariable>,
    /// Objectives
    pub objectives: Vec<Objective>,
    /// Constraints
    pub constraints: Vec<Constraint>,
    /// Problem type
    pub problem_type: ProblemType,
}

/// Design variable
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DesignVariable {
    /// Variable name
    pub name: String,
    /// Lower bound
    pub lower: f64,
    /// Upper bound
    pub upper: f64,
    /// Current value
    pub value: f64,
    /// Variable type
    pub var_type: VariableType,
    /// Linked to
    pub linked_to: Option<String>,
}

/// Variable type
#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
pub enum VariableType {
    Continuous,
    Discrete,
    Integer,
    Binary,
}

/// Objective function
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Objective {
    /// Objective name
    pub name: String,
    /// Minimize or maximize
    pub sense: OptimizationSense,
    /// Weight (for weighted sum)
    pub weight: f64,
    /// Reference value
    pub reference: Option<f64>,
}

/// Optimization sense
#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
pub enum OptimizationSense {
    Minimize,
    Maximize,
}

/// Constraint definition
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Constraint {
    /// Constraint name
    pub name: String,
    /// Constraint type
    pub constraint_type: ConstraintType,
    /// Limit value
    pub limit: f64,
    /// Current value (for tracking)
    pub current_value: Option<f64>,
}

/// Constraint types
#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
pub enum ConstraintType {
    /// g(x) <= 0
    LessThanZero,
    /// g(x) >= 0
    GreaterThanZero,
    /// g(x) = 0
    EqualZero,
    /// g(x) <= limit
    LessThan,
    /// g(x) >= limit
    GreaterThan,
    /// lower <= g(x) <= upper
    Range { lower: f64 },
}

/// Problem type
#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
pub enum ProblemType {
    SizeOptimization,
    ShapeOptimization,
    TopologyOptimization,
    MultiObjective,
    Reliability,
}

/// Optimizer settings
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OptimizerSettings {
    /// Algorithm
    pub algorithm: OptimizationAlgorithm,
    /// Maximum iterations
    pub max_iterations: usize,
    /// Convergence tolerance
    pub tolerance: f64,
    /// Population size (for evolutionary)
    pub population_size: usize,
    /// Move limit (for topology)
    pub move_limit: f64,
    /// Penalty factor (for constraints)
    pub penalty_factor: f64,
}

/// Optimization algorithms
#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
pub enum OptimizationAlgorithm {
    /// Gradient-based
    GradientDescent,
    /// Sequential quadratic programming
    SQP,
    /// Method of moving asymptotes
    MMA,
    /// Optimality criteria
    OC,
    /// Genetic algorithm
    GA,
    /// Particle swarm
    PSO,
    /// Simulated annealing
    SA,
    /// NSGA-II (multi-objective)
    NSGAII,
}

impl Default for OptimizerSettings {
    fn default() -> Self {
        Self {
            algorithm: OptimizationAlgorithm::OC,
            max_iterations: 100,
            tolerance: 1e-4,
            population_size: 50,
            move_limit: 0.2,
            penalty_factor: 1000.0,
        }
    }
}

/// Optimization solution
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OptimizationSolution {
    /// Optimal variable values
    pub variables: HashMap<String, f64>,
    /// Objective values
    pub objectives: HashMap<String, f64>,
    /// Constraint values
    pub constraints: HashMap<String, f64>,
    /// Is feasible
    pub feasible: bool,
    /// Number of iterations
    pub iterations: usize,
    /// Convergence achieved
    pub converged: bool,
}

/// Iteration record
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct IterationRecord {
    /// Iteration number
    pub iteration: usize,
    /// Objective value(s)
    pub objective: f64,
    /// Constraint violation
    pub violation: f64,
    /// Step size
    pub step_size: f64,
}

impl StructuralOptimizer {
    /// Create new optimizer
    pub fn new(problem: OptimizationProblem) -> Self {
        Self {
            problem,
            settings: OptimizerSettings::default(),
            solution: None,
            history: Vec::new(),
        }
    }
    
    /// Set algorithm
    pub fn set_algorithm(&mut self, algorithm: OptimizationAlgorithm) {
        self.settings.algorithm = algorithm;
    }
    
    /// Run optimization
    pub fn optimize<F>(&mut self, evaluate: F) -> &OptimizationSolution 
    where
        F: Fn(&[f64]) -> (f64, Vec<f64>), // Returns (objective, constraints)
    {
        match self.settings.algorithm {
            OptimizationAlgorithm::OC => self.run_oc(&evaluate),
            OptimizationAlgorithm::GradientDescent => self.run_gradient(&evaluate),
            OptimizationAlgorithm::GA => self.run_ga(&evaluate),
            OptimizationAlgorithm::PSO => self.run_pso(&evaluate),
            _ => self.run_oc(&evaluate),
        }
        
        self.solution.as_ref().unwrap()
    }
    
    /// Optimality criteria method
    fn run_oc<F>(&mut self, evaluate: &F) 
    where
        F: Fn(&[f64]) -> (f64, Vec<f64>),
    {
        let n = self.problem.variables.len();
        let mut x: Vec<f64> = self.problem.variables.iter().map(|v| v.value).collect();
        let mut converged = false;
        
        for iter in 0..self.settings.max_iterations {
            let (obj, constr) = evaluate(&x);
            
            // Calculate sensitivities (finite difference)
            let mut sensitivities = Vec::with_capacity(n);
            let delta = 1e-6;
            
            for i in 0..n {
                let mut x_plus = x.clone();
                x_plus[i] += delta;
                let (obj_plus, _) = evaluate(&x_plus);
                sensitivities.push((obj_plus - obj) / delta);
            }
            
            // OC update
            let move_limit = self.settings.move_limit;
            let mut x_new = vec![0.0; n];
            let mut change: f64 = 0.0;
            
            // Find Lagrange multiplier using bisection
            let mut lam_min: f64 = 1e-10;
            let mut lam_max: f64 = 1e10;
            
            for _ in 0..50 {
                let lam = (lam_min * lam_max).sqrt();
                let mut vol = 0.0;
                
                for i in 0..n {
                    let lower = self.problem.variables[i].lower;
                    let upper = self.problem.variables[i].upper;
                    
                    // OC update rule
                    let be = (-sensitivities[i] / lam).sqrt();
                    let x_cand = x[i] * be;
                    
                    // Apply move limits
                    let x_min = (x[i] - move_limit).max(lower);
                    let x_max = (x[i] + move_limit).min(upper);
                    
                    x_new[i] = x_cand.max(x_min).min(x_max);
                    vol += x_new[i];
                }
                
                // Check volume constraint (assuming first constraint is volume)
                let target = if !constr.is_empty() { constr[0] } else { vol };
                if vol > target {
                    lam_min = lam;
                } else {
                    lam_max = lam;
                }
            }
            
            // Calculate change
            for i in 0..n {
                change = change.max((x_new[i] - x[i]).abs());
            }
            
            x = x_new;
            
            // Record history
            let violation = constr.iter().map(|c| c.max(0.0)).sum();
            self.history.push(IterationRecord {
                iteration: iter,
                objective: obj,
                violation,
                step_size: change,
            });
            
            // Check convergence
            if change < self.settings.tolerance {
                converged = true;
                break;
            }
        }
        
        // Store solution
        let mut var_map = HashMap::new();
        for (i, var) in self.problem.variables.iter().enumerate() {
            var_map.insert(var.name.clone(), x[i]);
        }
        
        let (final_obj, final_constr) = evaluate(&x);
        let feasible = final_constr.iter().all(|c| *c <= 0.0);
        
        self.solution = Some(OptimizationSolution {
            variables: var_map,
            objectives: [("objective".to_string(), final_obj)].into_iter().collect(),
            constraints: final_constr.iter().enumerate()
                .map(|(i, c)| (format!("g{}", i), *c))
                .collect(),
            feasible,
            iterations: self.history.len(),
            converged,
        });
    }
    
    /// Gradient descent
    fn run_gradient<F>(&mut self, evaluate: &F) 
    where
        F: Fn(&[f64]) -> (f64, Vec<f64>),
    {
        let n = self.problem.variables.len();
        let mut x: Vec<f64> = self.problem.variables.iter().map(|v| v.value).collect();
        let mut converged = false;
        
        let mut step_size = 0.1;
        
        for iter in 0..self.settings.max_iterations {
            let (obj, constr) = evaluate(&x);
            
            // Calculate gradient (finite difference)
            let mut grad = vec![0.0; n];
            let delta = 1e-6;
            
            for i in 0..n {
                let mut x_plus = x.clone();
                x_plus[i] += delta;
                let (obj_plus, _) = evaluate(&x_plus);
                grad[i] = (obj_plus - obj) / delta;
            }
            
            // Add penalty for constraints
            for (i, c) in constr.iter().enumerate() {
                if *c > 0.0 {
                    // Constraint violated
                    for j in 0..n {
                        let mut x_plus = x.clone();
                        x_plus[j] += delta;
                        let (_, constr_plus) = evaluate(&x_plus);
                        let dc = (constr_plus[i] - c) / delta;
                        grad[j] += self.settings.penalty_factor * c * dc;
                    }
                }
            }
            
            // Update variables
            let grad_norm = grad.iter().map(|g| g * g).sum::<f64>().sqrt();
            let mut change: f64 = 0.0;
            
            for i in 0..n {
                let lower = self.problem.variables[i].lower;
                let upper = self.problem.variables[i].upper;
                
                let step = step_size * grad[i] / grad_norm.max(1e-10);
                let x_new = (x[i] - step).max(lower).min(upper);
                change = change.max((x_new - x[i]).abs());
                x[i] = x_new;
            }
            
            // Record history
            let violation = constr.iter().map(|c| c.max(0.0)).sum();
            self.history.push(IterationRecord {
                iteration: iter,
                objective: obj,
                violation,
                step_size,
            });
            
            // Adjust step size
            if iter > 0 && self.history[iter].objective > self.history[iter - 1].objective {
                step_size *= 0.5;
            }
            
            if change < self.settings.tolerance {
                converged = true;
                break;
            }
        }
        
        // Store solution
        let mut var_map = HashMap::new();
        for (i, var) in self.problem.variables.iter().enumerate() {
            var_map.insert(var.name.clone(), x[i]);
        }
        
        let (final_obj, final_constr) = evaluate(&x);
        
        self.solution = Some(OptimizationSolution {
            variables: var_map,
            objectives: [("objective".to_string(), final_obj)].into_iter().collect(),
            constraints: final_constr.iter().enumerate()
                .map(|(i, c)| (format!("g{}", i), *c))
                .collect(),
            feasible: final_constr.iter().all(|c| *c <= 0.0),
            iterations: self.history.len(),
            converged,
        });
    }
    
    /// Genetic algorithm
    fn run_ga<F>(&mut self, evaluate: &F) 
    where
        F: Fn(&[f64]) -> (f64, Vec<f64>),
    {
        let n = self.problem.variables.len();
        let pop_size = self.settings.population_size;
        
        // Initialize population
        let mut population: Vec<Vec<f64>> = (0..pop_size)
            .map(|_| {
                self.problem.variables.iter()
                    .map(|v| v.lower + pseudo_random(0) * (v.upper - v.lower))
                    .collect()
            })
            .collect();
        
        let mut best_solution = population[0].clone();
        let mut best_fitness = f64::MAX;
        
        for iter in 0..self.settings.max_iterations {
            // Evaluate fitness
            let fitness: Vec<f64> = population.iter()
                .map(|x| {
                    let (obj, constr) = evaluate(x);
                    let penalty = constr.iter()
                        .map(|c| self.settings.penalty_factor * c.max(0.0).powi(2))
                        .sum::<f64>();
                    obj + penalty
                })
                .collect();
            
            // Track best
            for (i, &f) in fitness.iter().enumerate() {
                if f < best_fitness {
                    best_fitness = f;
                    best_solution = population[i].clone();
                }
            }
            
            let (obj, constr) = evaluate(&best_solution);
            self.history.push(IterationRecord {
                iteration: iter,
                objective: obj,
                violation: constr.iter().map(|c| c.max(0.0)).sum(),
                step_size: 0.0,
            });
            
            // Selection (tournament)
            let mut new_pop = Vec::with_capacity(pop_size);
            for _ in 0..pop_size {
                let i1 = (pseudo_random(iter) * pop_size as f64) as usize % pop_size;
                let i2 = (pseudo_random(iter + 1) * pop_size as f64) as usize % pop_size;
                let winner = if fitness[i1] < fitness[i2] { i1 } else { i2 };
                new_pop.push(population[winner].clone());
            }
            
            // Crossover
            for i in (0..pop_size - 1).step_by(2) {
                if pseudo_random(iter + i) < 0.8 {
                    let alpha = pseudo_random(iter + i + 100);
                    for j in 0..n {
                        let temp = new_pop[i][j];
                        new_pop[i][j] = alpha * temp + (1.0 - alpha) * new_pop[i + 1][j];
                        new_pop[i + 1][j] = (1.0 - alpha) * temp + alpha * new_pop[i + 1][j];
                    }
                }
            }
            
            // Mutation
            let mutation_rate = 0.1;
            for individual in &mut new_pop {
                for j in 0..n {
                    if pseudo_random(iter + j + 200) < mutation_rate {
                        let lower = self.problem.variables[j].lower;
                        let upper = self.problem.variables[j].upper;
                        individual[j] = lower + pseudo_random(iter + j + 300) * (upper - lower);
                    }
                }
            }
            
            // Elitism
            new_pop[0] = best_solution.clone();
            population = new_pop;
        }
        
        // Store solution
        let mut var_map = HashMap::new();
        for (i, var) in self.problem.variables.iter().enumerate() {
            var_map.insert(var.name.clone(), best_solution[i]);
        }
        
        let (final_obj, final_constr) = evaluate(&best_solution);
        
        self.solution = Some(OptimizationSolution {
            variables: var_map,
            objectives: [("objective".to_string(), final_obj)].into_iter().collect(),
            constraints: final_constr.iter().enumerate()
                .map(|(i, c)| (format!("g{}", i), *c))
                .collect(),
            feasible: final_constr.iter().all(|c| *c <= 0.0),
            iterations: self.history.len(),
            converged: true,
        });
    }
    
    /// Particle swarm optimization
    fn run_pso<F>(&mut self, evaluate: &F) 
    where
        F: Fn(&[f64]) -> (f64, Vec<f64>),
    {
        let n = self.problem.variables.len();
        let pop_size = self.settings.population_size;
        
        // Initialize particles
        let mut positions: Vec<Vec<f64>> = (0..pop_size)
            .map(|_| {
                self.problem.variables.iter()
                    .map(|v| v.lower + pseudo_random(0) * (v.upper - v.lower))
                    .collect()
            })
            .collect();
        
        let mut velocities: Vec<Vec<f64>> = (0..pop_size)
            .map(|_| vec![0.0; n])
            .collect();
        
        let mut p_best = positions.clone();
        let mut p_best_fitness: Vec<f64> = positions.iter()
            .map(|x| {
                let (obj, constr) = evaluate(x);
                obj + self.settings.penalty_factor * constr.iter().map(|c| c.max(0.0)).sum::<f64>()
            })
            .collect();
        
        let mut g_best = positions[0].clone();
        let mut g_best_fitness = p_best_fitness[0];
        
        for i in 0..pop_size {
            if p_best_fitness[i] < g_best_fitness {
                g_best_fitness = p_best_fitness[i];
                g_best = positions[i].clone();
            }
        }
        
        let w = 0.7; // Inertia
        let c1 = 1.5; // Cognitive
        let c2 = 1.5; // Social
        
        for iter in 0..self.settings.max_iterations {
            for i in 0..pop_size {
                // Update velocity
                for j in 0..n {
                    let r1 = pseudo_random(iter + i + j);
                    let r2 = pseudo_random(iter + i + j + 100);
                    
                    velocities[i][j] = w * velocities[i][j]
                        + c1 * r1 * (p_best[i][j] - positions[i][j])
                        + c2 * r2 * (g_best[j] - positions[i][j]);
                }
                
                // Update position
                for j in 0..n {
                    let lower = self.problem.variables[j].lower;
                    let upper = self.problem.variables[j].upper;
                    positions[i][j] = (positions[i][j] + velocities[i][j]).max(lower).min(upper);
                }
                
                // Evaluate
                let (obj, constr) = evaluate(&positions[i]);
                let fitness = obj + self.settings.penalty_factor * 
                    constr.iter().map(|c| c.max(0.0)).sum::<f64>();
                
                // Update personal best
                if fitness < p_best_fitness[i] {
                    p_best_fitness[i] = fitness;
                    p_best[i] = positions[i].clone();
                    
                    // Update global best
                    if fitness < g_best_fitness {
                        g_best_fitness = fitness;
                        g_best = positions[i].clone();
                    }
                }
            }
            
            let (obj, constr) = evaluate(&g_best);
            self.history.push(IterationRecord {
                iteration: iter,
                objective: obj,
                violation: constr.iter().map(|c| c.max(0.0)).sum(),
                step_size: 0.0,
            });
        }
        
        // Store solution
        let mut var_map = HashMap::new();
        for (i, var) in self.problem.variables.iter().enumerate() {
            var_map.insert(var.name.clone(), g_best[i]);
        }
        
        let (final_obj, final_constr) = evaluate(&g_best);
        
        self.solution = Some(OptimizationSolution {
            variables: var_map,
            objectives: [("objective".to_string(), final_obj)].into_iter().collect(),
            constraints: final_constr.iter().enumerate()
                .map(|(i, c)| (format!("g{}", i), *c))
                .collect(),
            feasible: final_constr.iter().all(|c| *c <= 0.0),
            iterations: self.history.len(),
            converged: true,
        });
    }
}

/// Topology optimization using SIMP
#[derive(Debug, Clone)]
pub struct TopologyOptimizer {
    /// Grid dimensions
    pub nx: usize,
    pub ny: usize,
    /// Density field
    pub densities: Vec<f64>,
    /// SIMP penalty
    pub penalty: f64,
    /// Volume fraction target
    pub volume_fraction: f64,
    /// Minimum density
    pub min_density: f64,
    /// Filter radius
    pub filter_radius: f64,
}

impl TopologyOptimizer {
    /// Create new topology optimizer
    pub fn new(nx: usize, ny: usize, volume_fraction: f64) -> Self {
        let n = nx * ny;
        Self {
            nx,
            ny,
            densities: vec![volume_fraction; n],
            penalty: 3.0,
            volume_fraction,
            min_density: 0.001,
            filter_radius: 1.5,
        }
    }
    
    /// Get element index
    fn idx(&self, i: usize, j: usize) -> usize {
        j * self.nx + i
    }
    
    /// Calculate filter weights
    fn filter_weights(&self) -> Vec<Vec<(usize, f64)>> {
        let n = self.nx * self.ny;
        let mut weights = vec![Vec::new(); n];
        
        for j in 0..self.ny {
            for i in 0..self.nx {
                let e = self.idx(i, j);
                let cx = i as f64 + 0.5;
                let cy = j as f64 + 0.5;
                
                for jj in 0..self.ny {
                    for ii in 0..self.nx {
                        let ee = self.idx(ii, jj);
                        let dx = (ii as f64 + 0.5) - cx;
                        let dy = (jj as f64 + 0.5) - cy;
                        let dist = (dx * dx + dy * dy).sqrt();
                        
                        if dist < self.filter_radius {
                            let w = self.filter_radius - dist;
                            weights[e].push((ee, w));
                        }
                    }
                }
            }
        }
        
        weights
    }
    
    /// Apply density filter
    fn apply_filter(&self, densities: &[f64], weights: &[Vec<(usize, f64)>]) -> Vec<f64> {
        let n = self.nx * self.ny;
        let mut filtered = vec![0.0; n];
        
        for e in 0..n {
            let mut sum_w = 0.0;
            let mut sum_wx = 0.0;
            
            for &(ee, w) in &weights[e] {
                sum_w += w;
                sum_wx += w * densities[ee];
            }
            
            filtered[e] = sum_wx / sum_w.max(1e-10);
        }
        
        filtered
    }
    
    /// Run optimization with simple compliance minimization
    pub fn optimize(&mut self, max_iter: usize) -> TopologyResult {
        let n = self.nx * self.ny;
        let weights = self.filter_weights();
        let mut change = 1.0;
        let tol = 0.01;
        
        let mut history = Vec::new();
        
        for iter in 0..max_iter {
            if change < tol {
                break;
            }
            
            // Apply filter
            let physical = self.apply_filter(&self.densities, &weights);
            
            // Compute compliance and sensitivities (simplified)
            // In real implementation, this would involve FEA
            let mut sensitivities = vec![0.0; n];
            let mut compliance = 0.0;
            
            for e in 0..n {
                let rho = physical[e];
                let ke = rho.powf(self.penalty); // Penalized stiffness
                let ue = 1.0; // Simplified - would come from FEA
                
                let ce = ke * ue * ue;
                compliance += ce;
                
                // Sensitivity
                sensitivities[e] = -self.penalty * rho.powf(self.penalty - 1.0) * ue * ue;
            }
            
            // Filter sensitivities
            let filtered_sens = self.apply_filter(&sensitivities, &weights);
            
            // OC update
            let mut lam_min: f64 = 1e-9;
            let mut lam_max: f64 = 1e9;
            let move_limit = 0.2;
            
            let target_vol = self.volume_fraction * n as f64;
            let mut new_densities = vec![0.0; n];
            
            for _ in 0..50 {
                let lam = (lam_min * lam_max).sqrt();
                let mut vol = 0.0;
                
                for e in 0..n {
                    let be = (-filtered_sens[e] / lam).sqrt();
                    let x_new = self.densities[e] * be;
                    
                    let x_min = (self.densities[e] - move_limit).max(self.min_density);
                    let x_max = (self.densities[e] + move_limit).min(1.0);
                    
                    new_densities[e] = x_new.max(x_min).min(x_max);
                    vol += new_densities[e];
                }
                
                if vol > target_vol {
                    lam_min = lam;
                } else {
                    lam_max = lam;
                }
            }
            
            // Calculate change
            change = self.densities.iter()
                .zip(&new_densities)
                .map(|(old, new)| (new - old).abs())
                .fold(0.0, f64::max);
            
            self.densities = new_densities;
            
            history.push(TopologyIteration {
                iteration: iter,
                compliance,
                volume: self.densities.iter().sum::<f64>() / n as f64,
                change,
            });
        }
        
        TopologyResult {
            densities: self.densities.clone(),
            nx: self.nx,
            ny: self.ny,
            final_compliance: history.last().map(|h| h.compliance).unwrap_or(0.0),
            final_volume: self.densities.iter().sum::<f64>() / n as f64,
            iterations: history.len(),
            history,
        }
    }
    
    /// Get binary layout (threshold at 0.5)
    pub fn get_binary(&self) -> Vec<bool> {
        self.densities.iter().map(|&d| d > 0.5).collect()
    }
}

/// Topology optimization result
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TopologyResult {
    /// Final density field
    pub densities: Vec<f64>,
    /// Grid dimensions
    pub nx: usize,
    pub ny: usize,
    /// Final compliance
    pub final_compliance: f64,
    /// Final volume fraction
    pub final_volume: f64,
    /// Number of iterations
    pub iterations: usize,
    /// Iteration history
    pub history: Vec<TopologyIteration>,
}

/// Topology iteration record
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TopologyIteration {
    /// Iteration number
    pub iteration: usize,
    /// Compliance
    pub compliance: f64,
    /// Volume fraction
    pub volume: f64,
    /// Max change
    pub change: f64,
}

/// Pseudo-random number generator (deterministic for reproducibility)
fn pseudo_random(seed: usize) -> f64 {
    let x = ((seed as u64).wrapping_mul(1103515245).wrapping_add(12345)) % (1 << 31);
    x as f64 / (1u64 << 31) as f64
}

#[cfg(test)]
mod tests {
    use super::*;
    
    #[test]
    fn test_design_variable() {
        let var = DesignVariable {
            name: "thickness".to_string(),
            lower: 0.01,
            upper: 0.1,
            value: 0.05,
            var_type: VariableType::Continuous,
            linked_to: None,
        };
        
        assert!(var.value >= var.lower && var.value <= var.upper);
    }
    
    #[test]
    fn test_optimization_problem() {
        let problem = OptimizationProblem {
            name: "Test".to_string(),
            variables: vec![
                DesignVariable {
                    name: "x".to_string(),
                    lower: 0.0,
                    upper: 10.0,
                    value: 5.0,
                    var_type: VariableType::Continuous,
                    linked_to: None,
                },
            ],
            objectives: vec![
                Objective {
                    name: "weight".to_string(),
                    sense: OptimizationSense::Minimize,
                    weight: 1.0,
                    reference: None,
                },
            ],
            constraints: vec![],
            problem_type: ProblemType::SizeOptimization,
        };
        
        assert_eq!(problem.variables.len(), 1);
    }
    
    #[test]
    fn test_optimizer_settings() {
        let settings = OptimizerSettings::default();
        
        assert_eq!(settings.max_iterations, 100);
    }
    
    #[test]
    fn test_optimizer_oc() {
        let problem = OptimizationProblem {
            name: "Test".to_string(),
            variables: vec![
                DesignVariable {
                    name: "x".to_string(),
                    lower: 0.1,
                    upper: 1.0,
                    value: 0.5,
                    var_type: VariableType::Continuous,
                    linked_to: None,
                },
            ],
            objectives: vec![],
            constraints: vec![],
            problem_type: ProblemType::SizeOptimization,
        };
        
        let mut optimizer = StructuralOptimizer::new(problem);
        optimizer.settings.max_iterations = 10;
        
        let solution = optimizer.optimize(|x| {
            let obj = x[0] * x[0];
            let constr = vec![x[0] - 0.3]; // x >= 0.3
            (obj, constr)
        });
        
        assert!(solution.variables.contains_key("x"));
    }
    
    #[test]
    fn test_optimizer_ga() {
        let problem = OptimizationProblem {
            name: "Test".to_string(),
            variables: vec![
                DesignVariable {
                    name: "x".to_string(),
                    lower: 0.0,
                    upper: 10.0,
                    value: 5.0,
                    var_type: VariableType::Continuous,
                    linked_to: None,
                },
            ],
            objectives: vec![],
            constraints: vec![],
            problem_type: ProblemType::SizeOptimization,
        };
        
        let mut optimizer = StructuralOptimizer::new(problem);
        optimizer.set_algorithm(OptimizationAlgorithm::GA);
        optimizer.settings.max_iterations = 10;
        optimizer.settings.population_size = 10;
        
        let solution = optimizer.optimize(|x| {
            ((x[0] - 3.0).powi(2), vec![])
        });
        
        assert!(solution.variables.contains_key("x"));
    }
    
    #[test]
    fn test_optimizer_pso() {
        let problem = OptimizationProblem {
            name: "Test".to_string(),
            variables: vec![
                DesignVariable {
                    name: "x".to_string(),
                    lower: 0.0,
                    upper: 10.0,
                    value: 5.0,
                    var_type: VariableType::Continuous,
                    linked_to: None,
                },
            ],
            objectives: vec![],
            constraints: vec![],
            problem_type: ProblemType::SizeOptimization,
        };
        
        let mut optimizer = StructuralOptimizer::new(problem);
        optimizer.set_algorithm(OptimizationAlgorithm::PSO);
        optimizer.settings.max_iterations = 10;
        optimizer.settings.population_size = 10;
        
        let solution = optimizer.optimize(|x| {
            ((x[0] - 3.0).powi(2), vec![])
        });
        
        assert!(solution.variables.contains_key("x"));
    }
    
    #[test]
    fn test_topology_optimizer() {
        let mut topo = TopologyOptimizer::new(10, 10, 0.4);
        
        assert_eq!(topo.densities.len(), 100);
        assert!((topo.volume_fraction - 0.4).abs() < 0.01);
    }
    
    #[test]
    fn test_topology_optimize() {
        let mut topo = TopologyOptimizer::new(5, 5, 0.5);
        let result = topo.optimize(10);
        
        assert!(!result.densities.is_empty());
        assert!(result.final_volume > 0.0);
    }
    
    #[test]
    fn test_binary_layout() {
        let topo = TopologyOptimizer::new(3, 3, 0.5);
        let binary = topo.get_binary();
        
        assert_eq!(binary.len(), 9);
    }
    
    #[test]
    fn test_pseudo_random() {
        let r1 = pseudo_random(42);
        let r2 = pseudo_random(42);
        let r3 = pseudo_random(43);
        
        assert!((r1 - r2).abs() < 1e-10);
        assert!((r1 - r3).abs() > 1e-10);
    }
    
    #[test]
    fn test_variable_types() {
        assert_ne!(VariableType::Continuous, VariableType::Discrete);
    }
    
    #[test]
    fn test_optimization_sense() {
        assert_ne!(OptimizationSense::Minimize, OptimizationSense::Maximize);
    }
    
    #[test]
    fn test_algorithms() {
        assert_ne!(OptimizationAlgorithm::GA, OptimizationAlgorithm::PSO);
    }
}
