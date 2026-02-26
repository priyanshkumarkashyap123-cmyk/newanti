//! Design Optimization Module
//!
//! Automated structural design optimization using multiple algorithms.
//! Based on: Genetic algorithms, gradient-based methods, particle swarm
//!
//! Features:
//! - Section optimization
//! - Member sizing
//! - Layout optimization
//! - Multi-objective optimization
//! - Constraint handling

use serde::{Deserialize, Serialize};
use std::collections::HashMap;

/// Optimization algorithm type
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum OptimizationAlgorithm {
    /// Genetic Algorithm
    GeneticAlgorithm,
    /// Particle Swarm Optimization
    ParticleSwarm,
    /// Differential Evolution
    DifferentialEvolution,
    /// Simulated Annealing
    SimulatedAnnealing,
    /// Gradient Descent
    GradientDescent,
    /// Sequential Quadratic Programming
    SQP,
}

/// Design variable type
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum DesignVariable {
    /// Continuous variable
    Continuous {
        name: String,
        lower: f64,
        upper: f64,
        initial: f64,
    },
    /// Discrete variable (from set)
    Discrete {
        name: String,
        options: Vec<f64>,
        initial_index: usize,
    },
    /// Integer variable
    Integer {
        name: String,
        lower: i32,
        upper: i32,
        initial: i32,
    },
}

impl DesignVariable {
    /// Get variable name
    pub fn name(&self) -> &str {
        match self {
            DesignVariable::Continuous { name, .. } => name,
            DesignVariable::Discrete { name, .. } => name,
            DesignVariable::Integer { name, .. } => name,
        }
    }
    
    /// Get current value as f64
    pub fn value(&self) -> f64 {
        match self {
            DesignVariable::Continuous { initial, .. } => *initial,
            DesignVariable::Discrete { options, initial_index, .. } => {
                options.get(*initial_index).cloned().unwrap_or(0.0)
            },
            DesignVariable::Integer { initial, .. } => *initial as f64,
        }
    }
    
    /// Clamp value to bounds
    pub fn clamp(&self, value: f64) -> f64 {
        match self {
            DesignVariable::Continuous { lower, upper, .. } => value.clamp(*lower, *upper),
            DesignVariable::Discrete { options, .. } => {
                // Find nearest option
                options.iter()
                    .min_by(|a, b| ((*a - value).abs()).partial_cmp(&((*b - value).abs())).unwrap_or(std::cmp::Ordering::Equal))
                    .cloned()
                    .unwrap_or(value)
            },
            DesignVariable::Integer { lower, upper, .. } => {
                (value.round() as i32).clamp(*lower, *upper) as f64
            },
        }
    }
}

/// Constraint type
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Constraint {
    /// Constraint name
    pub name: String,
    /// Constraint function value (g(x) <= 0)
    pub value: f64,
    /// Constraint type
    pub constraint_type: ConstraintType,
    /// Is active (binding)
    pub active: bool,
    /// Violation amount
    pub violation: f64,
}

/// Constraint types
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum ConstraintType {
    /// g(x) <= 0
    Inequality,
    /// h(x) = 0
    Equality,
    /// x_lower <= x <= x_upper
    Bounds,
}

impl Constraint {
    /// Create inequality constraint
    pub fn inequality(name: &str, value: f64) -> Self {
        let violation = value.max(0.0);
        Self {
            name: name.to_string(),
            value,
            constraint_type: ConstraintType::Inequality,
            active: value >= -1e-6,
            violation,
        }
    }
    
    /// Create equality constraint
    pub fn equality(name: &str, value: f64, tolerance: f64) -> Self {
        let violation = value.abs();
        Self {
            name: name.to_string(),
            value,
            constraint_type: ConstraintType::Equality,
            active: violation < tolerance,
            violation,
        }
    }
    
    /// Check if constraint is satisfied
    pub fn is_satisfied(&self, tolerance: f64) -> bool {
        match self.constraint_type {
            ConstraintType::Inequality => self.value <= tolerance,
            ConstraintType::Equality => self.value.abs() <= tolerance,
            ConstraintType::Bounds => true,
        }
    }
}

/// Optimization objective
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Objective {
    /// Objective name
    pub name: String,
    /// Objective value
    pub value: f64,
    /// Weight (for multi-objective)
    pub weight: f64,
    /// Minimize or maximize
    pub minimize: bool,
}

/// Optimization problem definition
#[derive(Debug, Clone)]
pub struct OptimizationProblem {
    /// Design variables
    pub variables: Vec<DesignVariable>,
    /// Variable name to index mapping
    var_map: HashMap<String, usize>,
}

impl OptimizationProblem {
    /// Create new optimization problem
    pub fn new() -> Self {
        Self {
            variables: Vec::new(),
            var_map: HashMap::new(),
        }
    }
    
    /// Add design variable
    pub fn add_variable(&mut self, var: DesignVariable) {
        let name = var.name().to_string();
        let idx = self.variables.len();
        self.variables.push(var);
        self.var_map.insert(name, idx);
    }
    
    /// Get variable by name
    pub fn get_variable(&self, name: &str) -> Option<&DesignVariable> {
        self.var_map.get(name).and_then(|&idx| self.variables.get(idx))
    }
    
    /// Number of variables
    pub fn n_variables(&self) -> usize {
        self.variables.len()
    }
    
    /// Get initial design vector
    pub fn initial_design(&self) -> Vec<f64> {
        self.variables.iter().map(|v| v.value()).collect()
    }
}

/// Individual in genetic algorithm
#[derive(Debug, Clone)]
pub struct Individual {
    /// Design vector
    pub genes: Vec<f64>,
    /// Fitness value
    pub fitness: f64,
    /// Constraint violation
    pub violation: f64,
    /// Is feasible
    pub feasible: bool,
}

impl Individual {
    /// Create new individual
    pub fn new(genes: Vec<f64>) -> Self {
        Self {
            genes,
            fitness: f64::MAX,
            violation: 0.0,
            feasible: true,
        }
    }
    
    /// Create random individual
    pub fn random(problem: &OptimizationProblem, seed: u64) -> Self {
        let genes: Vec<f64> = problem.variables.iter()
            .enumerate()
            .map(|(i, var)| {
                let r = ((seed as f64 + i as f64) * 0.618033988749).fract();
                match var {
                    DesignVariable::Continuous { lower, upper, .. } => {
                        lower + r * (upper - lower)
                    },
                    DesignVariable::Discrete { options, .. } => {
                        let idx = (r * options.len() as f64) as usize;
                        options.get(idx.min(options.len() - 1)).cloned().unwrap_or(0.0)
                    },
                    DesignVariable::Integer { lower, upper, .. } => {
                        let range = (upper - lower + 1) as f64;
                        (lower + (r * range) as i32).min(*upper) as f64
                    },
                }
            })
            .collect();
        
        Self::new(genes)
    }
}

/// Genetic Algorithm optimizer
#[derive(Debug, Clone)]
pub struct GeneticAlgorithm {
    /// Population size
    pub pop_size: usize,
    /// Number of generations
    pub generations: usize,
    /// Crossover probability
    pub crossover_prob: f64,
    /// Mutation probability
    pub mutation_prob: f64,
    /// Elite count
    pub elite_count: usize,
    /// Tournament size
    pub tournament_size: usize,
}

impl GeneticAlgorithm {
    /// Create new GA optimizer
    pub fn new() -> Self {
        Self {
            pop_size: 50,
            generations: 100,
            crossover_prob: 0.8,
            mutation_prob: 0.1,
            elite_count: 2,
            tournament_size: 3,
        }
    }
    
    /// Optimize using GA
    pub fn optimize<F>(&self, problem: &OptimizationProblem, objective_fn: F) -> GAResult
    where
        F: Fn(&[f64]) -> (f64, Vec<Constraint>),
    {
        // Initialize population
        let mut population: Vec<Individual> = (0..self.pop_size)
            .map(|i| Individual::random(problem, i as u64 * 12345))
            .collect();
        
        // Evaluate initial population
        for ind in &mut population {
            let (fitness, constraints) = objective_fn(&ind.genes);
            ind.fitness = fitness;
            ind.violation = constraints.iter().map(|c| c.violation).sum();
            ind.feasible = ind.violation < 1e-6;
        }
        
        let mut best_history = Vec::new();
        let mut best_ever = population[0].clone();
        
        for gen in 0..self.generations {
            // Sort by fitness (considering constraints)
            population.sort_by(|a, b| {
                // Feasible solutions preferred
                if a.feasible && !b.feasible {
                    std::cmp::Ordering::Less
                } else if !a.feasible && b.feasible {
                    std::cmp::Ordering::Greater
                } else if !a.feasible && !b.feasible {
                    a.violation.partial_cmp(&b.violation).unwrap_or(std::cmp::Ordering::Equal)
                } else {
                    a.fitness.partial_cmp(&b.fitness).unwrap_or(std::cmp::Ordering::Equal)
                }
            });
            
            // Update best
            if population[0].fitness < best_ever.fitness || 
               (population[0].feasible && !best_ever.feasible) {
                best_ever = population[0].clone();
            }
            
            best_history.push(best_ever.fitness);
            
            // Selection and reproduction
            let mut new_population = Vec::new();
            
            // Elitism
            for i in 0..self.elite_count.min(population.len()) {
                new_population.push(population[i].clone());
            }
            
            // Generate offspring
            while new_population.len() < self.pop_size {
                // Tournament selection
                let parent1 = self.tournament_select(&population, gen as u64);
                let parent2 = self.tournament_select(&population, gen as u64 + 1);
                
                // Crossover
                let (mut child1, mut child2) = if self.should_crossover(gen) {
                    self.crossover(&parent1, &parent2, problem)
                } else {
                    (parent1.clone(), parent2.clone())
                };
                
                // Mutation
                self.mutate(&mut child1, problem, gen);
                self.mutate(&mut child2, problem, gen);
                
                // Evaluate
                let (fitness1, constraints1) = objective_fn(&child1.genes);
                child1.fitness = fitness1;
                child1.violation = constraints1.iter().map(|c| c.violation).sum();
                child1.feasible = child1.violation < 1e-6;
                
                let (fitness2, constraints2) = objective_fn(&child2.genes);
                child2.fitness = fitness2;
                child2.violation = constraints2.iter().map(|c| c.violation).sum();
                child2.feasible = child2.violation < 1e-6;
                
                new_population.push(child1);
                if new_population.len() < self.pop_size {
                    new_population.push(child2);
                }
            }
            
            population = new_population;
        }
        
        GAResult {
            best_design: best_ever.genes,
            best_fitness: best_ever.fitness,
            feasible: best_ever.feasible,
            generations: self.generations,
            history: best_history,
        }
    }
    
    fn tournament_select(&self, population: &[Individual], seed: u64) -> Individual {
        let mut best_idx = 0;
        let mut best_fitness = f64::MAX;
        
        for i in 0..self.tournament_size {
            let idx = ((seed + i as u64) as f64 * 0.618).fract() * population.len() as f64;
            let idx = (idx as usize).min(population.len() - 1);
            
            if population[idx].fitness < best_fitness {
                best_fitness = population[idx].fitness;
                best_idx = idx;
            }
        }
        
        population[best_idx].clone()
    }
    
    fn should_crossover(&self, gen: usize) -> bool {
        (gen as f64 * 0.618).fract() < self.crossover_prob
    }
    
    fn crossover(&self, parent1: &Individual, parent2: &Individual, problem: &OptimizationProblem) -> (Individual, Individual) {
        let n = parent1.genes.len();
        let mut child1_genes = vec![0.0; n];
        let mut child2_genes = vec![0.0; n];
        
        // BLX-alpha crossover
        let alpha = 0.5;
        
        for i in 0..n {
            let (min_val, max_val) = if parent1.genes[i] < parent2.genes[i] {
                (parent1.genes[i], parent2.genes[i])
            } else {
                (parent2.genes[i], parent1.genes[i])
            };
            
            let range = max_val - min_val;
            let lower = min_val - alpha * range;
            let upper = max_val + alpha * range;
            
            let r1 = (i as f64 * 0.618).fract();
            let r2 = ((i + 1) as f64 * 0.618).fract();
            
            child1_genes[i] = problem.variables[i].clamp(lower + r1 * (upper - lower));
            child2_genes[i] = problem.variables[i].clamp(lower + r2 * (upper - lower));
        }
        
        (Individual::new(child1_genes), Individual::new(child2_genes))
    }
    
    fn mutate(&self, individual: &mut Individual, problem: &OptimizationProblem, gen: usize) {
        let scale = 0.1 * (1.0 - gen as f64 / self.generations as f64);
        
        for (i, gene) in individual.genes.iter_mut().enumerate() {
            let r = ((gen + i) as f64 * 0.618).fract();
            if r < self.mutation_prob {
                match &problem.variables[i] {
                    DesignVariable::Continuous { lower, upper, .. } => {
                        let range = upper - lower;
                        let mutation = (r - 0.5) * range * scale;
                        *gene = problem.variables[i].clamp(*gene + mutation);
                    },
                    DesignVariable::Discrete { options, .. } => {
                        let idx = (r * options.len() as f64) as usize;
                        *gene = options.get(idx.min(options.len() - 1)).cloned().unwrap_or(*gene);
                    },
                    DesignVariable::Integer { lower, upper, .. } => {
                        let mutation = ((r - 0.5) * 3.0).round() as i32;
                        let new_val = (*gene as i32 + mutation).clamp(*lower, *upper);
                        *gene = new_val as f64;
                    },
                }
            }
        }
    }
}

/// GA optimization result
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GAResult {
    /// Best design found
    pub best_design: Vec<f64>,
    /// Best fitness value
    pub best_fitness: f64,
    /// Is feasible
    pub feasible: bool,
    /// Number of generations
    pub generations: usize,
    /// Fitness history
    pub history: Vec<f64>,
}

/// Particle Swarm Optimization
#[derive(Debug, Clone)]
pub struct ParticleSwarm {
    /// Number of particles
    pub n_particles: usize,
    /// Maximum iterations
    pub max_iter: usize,
    /// Inertia weight
    pub w: f64,
    /// Cognitive coefficient
    pub c1: f64,
    /// Social coefficient
    pub c2: f64,
}

/// Particle in PSO
#[derive(Debug, Clone)]
struct Particle {
    position: Vec<f64>,
    velocity: Vec<f64>,
    best_position: Vec<f64>,
    best_fitness: f64,
    current_fitness: f64,
}

impl ParticleSwarm {
    /// Create new PSO optimizer
    pub fn new() -> Self {
        Self {
            n_particles: 30,
            max_iter: 100,
            w: 0.7,
            c1: 1.5,
            c2: 1.5,
        }
    }
    
    /// Optimize using PSO
    pub fn optimize<F>(&self, problem: &OptimizationProblem, objective_fn: F) -> PSOResult
    where
        F: Fn(&[f64]) -> f64,
    {
        let n_vars = problem.n_variables();
        
        // Initialize particles
        let mut particles: Vec<Particle> = (0..self.n_particles)
            .map(|i| {
                let position: Vec<f64> = problem.variables.iter()
                    .enumerate()
                    .map(|(j, var)| {
                        let r = ((i * n_vars + j) as f64 * 0.618).fract();
                        match var {
                            DesignVariable::Continuous { lower, upper, .. } => lower + r * (upper - lower),
                            DesignVariable::Discrete { options, .. } => {
                                options[(r * options.len() as f64) as usize % options.len()]
                            },
                            DesignVariable::Integer { lower, upper, .. } => {
                                (lower + (r * (upper - lower + 1) as f64) as i32).min(*upper) as f64
                            },
                        }
                    })
                    .collect();
                
                let velocity = vec![0.0; n_vars];
                let fitness = objective_fn(&position);
                
                Particle {
                    position: position.clone(),
                    velocity,
                    best_position: position,
                    best_fitness: fitness,
                    current_fitness: fitness,
                }
            })
            .collect();
        
        // Find global best
        let mut global_best = particles[0].best_position.clone();
        let mut global_best_fitness = particles[0].best_fitness;
        
        for p in &particles {
            if p.best_fitness < global_best_fitness {
                global_best_fitness = p.best_fitness;
                global_best = p.best_position.clone();
            }
        }
        
        let mut history = vec![global_best_fitness];
        
        // Main loop
        for iter in 0..self.max_iter {
            let w = self.w * (1.0 - 0.5 * iter as f64 / self.max_iter as f64);
            
            for (p_idx, particle) in particles.iter_mut().enumerate() {
                // Update velocity and position
                for i in 0..n_vars {
                    let r1 = ((iter * self.n_particles + p_idx + i) as f64 * 0.618).fract();
                    let r2 = ((iter * self.n_particles + p_idx + i + 1) as f64 * 0.618).fract();
                    
                    particle.velocity[i] = w * particle.velocity[i]
                        + self.c1 * r1 * (particle.best_position[i] - particle.position[i])
                        + self.c2 * r2 * (global_best[i] - particle.position[i]);
                    
                    particle.position[i] = problem.variables[i].clamp(
                        particle.position[i] + particle.velocity[i]
                    );
                }
                
                // Evaluate
                particle.current_fitness = objective_fn(&particle.position);
                
                // Update personal best
                if particle.current_fitness < particle.best_fitness {
                    particle.best_fitness = particle.current_fitness;
                    particle.best_position = particle.position.clone();
                    
                    // Update global best
                    if particle.best_fitness < global_best_fitness {
                        global_best_fitness = particle.best_fitness;
                        global_best = particle.best_position.clone();
                    }
                }
            }
            
            history.push(global_best_fitness);
        }
        
        PSOResult {
            best_design: global_best,
            best_fitness: global_best_fitness,
            iterations: self.max_iter,
            history,
        }
    }
}

/// PSO optimization result
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PSOResult {
    /// Best design found
    pub best_design: Vec<f64>,
    /// Best fitness value
    pub best_fitness: f64,
    /// Number of iterations
    pub iterations: usize,
    /// Fitness history
    pub history: Vec<f64>,
}

/// Section optimizer for steel/concrete members
#[derive(Debug, Clone)]
pub struct SectionOptimizer {
    /// Available steel sections
    pub steel_sections: Vec<SteelSection>,
    /// Concrete grades
    pub concrete_grades: Vec<f64>,
    /// Rebar sizes
    pub rebar_sizes: Vec<f64>,
}

/// Steel section data
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SteelSection {
    /// Section name
    pub name: String,
    /// Depth (mm)
    pub depth: f64,
    /// Width (mm)
    pub width: f64,
    /// Area (mm²)
    pub area: f64,
    /// Moment of inertia X (mm⁴)
    pub ix: f64,
    /// Moment of inertia Y (mm⁴)
    pub iy: f64,
    /// Plastic modulus X (mm³)
    pub zx: f64,
    /// Weight (kg/m)
    pub weight: f64,
}

/// Optimized section result
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OptimizedSection {
    /// Selected section
    pub section: String,
    /// Utilization ratio
    pub utilization: f64,
    /// Weight efficiency
    pub weight_efficiency: f64,
    /// Is adequate
    pub adequate: bool,
}

impl SectionOptimizer {
    /// Create new section optimizer with IS sections
    pub fn new_is() -> Self {
        let steel_sections = vec![
            SteelSection { name: "ISMB 100".into(), depth: 100.0, width: 75.0, area: 1167.0, ix: 2.57e6, iy: 0.41e6, zx: 51400.0, weight: 9.16 },
            SteelSection { name: "ISMB 150".into(), depth: 150.0, width: 80.0, area: 1808.0, ix: 7.26e6, iy: 0.53e6, zx: 96800.0, weight: 14.2 },
            SteelSection { name: "ISMB 200".into(), depth: 200.0, width: 100.0, area: 2857.0, ix: 22.35e6, iy: 1.5e6, zx: 223500.0, weight: 22.4 },
            SteelSection { name: "ISMB 250".into(), depth: 250.0, width: 125.0, area: 4755.0, ix: 51.31e6, iy: 3.34e6, zx: 410500.0, weight: 37.3 },
            SteelSection { name: "ISMB 300".into(), depth: 300.0, width: 140.0, area: 5680.0, ix: 86.04e6, iy: 4.54e6, zx: 573600.0, weight: 44.6 },
            SteelSection { name: "ISMB 350".into(), depth: 350.0, width: 140.0, area: 6671.0, ix: 136.3e6, iy: 5.37e6, zx: 778900.0, weight: 52.4 },
            SteelSection { name: "ISMB 400".into(), depth: 400.0, width: 140.0, area: 7846.0, ix: 204.58e6, iy: 6.22e6, zx: 1022900.0, weight: 61.6 },
            SteelSection { name: "ISMB 450".into(), depth: 450.0, width: 150.0, area: 9227.0, ix: 303.91e6, iy: 8.34e6, zx: 1350700.0, weight: 72.4 },
            SteelSection { name: "ISMB 500".into(), depth: 500.0, width: 180.0, area: 11074.0, ix: 452.18e6, iy: 13.7e6, zx: 1808700.0, weight: 86.9 },
            SteelSection { name: "ISMB 550".into(), depth: 550.0, width: 190.0, area: 13211.0, ix: 649.0e6, iy: 18.16e6, zx: 2359100.0, weight: 103.7 },
            SteelSection { name: "ISMB 600".into(), depth: 600.0, width: 210.0, area: 15621.0, ix: 918.1e6, iy: 26.28e6, zx: 3060300.0, weight: 122.6 },
        ];
        
        Self {
            steel_sections,
            concrete_grades: vec![20.0, 25.0, 30.0, 35.0, 40.0, 45.0, 50.0],
            rebar_sizes: vec![8.0, 10.0, 12.0, 16.0, 20.0, 25.0, 32.0],
        }
    }
    
    /// Select optimal steel section for given demand
    pub fn select_steel_beam(&self, mu_demand: f64, fy: f64) -> OptimizedSection {
        let gamma_m0 = 1.1;
        let required_zx = mu_demand * 1e6 * gamma_m0 / fy;
        
        // Find lightest adequate section
        let mut best_section: Option<&SteelSection> = None;
        let mut best_weight = f64::MAX;
        
        for section in &self.steel_sections {
            if section.zx >= required_zx && section.weight < best_weight {
                best_weight = section.weight;
                best_section = Some(section);
            }
        }
        
        match best_section {
            Some(section) => {
                let capacity = section.zx * fy / (gamma_m0 * 1e6);
                OptimizedSection {
                    section: section.name.clone(),
                    utilization: mu_demand / capacity,
                    weight_efficiency: required_zx / section.zx,
                    adequate: true,
                }
            },
            None => OptimizedSection {
                section: "No adequate section".to_string(),
                utilization: 1.0,
                weight_efficiency: 0.0,
                adequate: false,
            },
        }
    }
    
    /// Optimize RC beam reinforcement
    pub fn optimize_rc_beam(&self, b: f64, d: f64, fck: f64, fy: f64, mu: f64) -> RCBeamDesign {
        // Required Ast from moment
        let xu_max = 0.48 * d;
        let mu_lim = 0.36 * fck * b * xu_max * (d - 0.42 * xu_max) / 1e6;
        
        let doubly_reinforced = mu > mu_lim;
        
        if !doubly_reinforced {
            // Singly reinforced
            let r = mu * 1e6 / (b * d * d);
            let pt = (fck / (2.0 * fy)) * (1.0 - (1.0 - 4.6 * r / fck).sqrt());
            let ast = pt * b * d / 100.0;
            
            // Select rebar
            let (n_bars, dia) = self.select_rebar(ast);
            let ast_provided = n_bars as f64 * std::f64::consts::PI * dia.powi(2) / 4.0;
            
            RCBeamDesign {
                ast_required: ast,
                ast_provided,
                asc_required: 0.0,
                asc_provided: 0.0,
                tension_bars: format!("{} Nos {}mm", n_bars, dia as i32),
                compression_bars: "None".to_string(),
                doubly_reinforced,
                utilization: mu / mu_lim,
            }
        } else {
            // Doubly reinforced
            let mu2 = mu - mu_lim;
            let d_prime = 0.1 * d;
            let ast_lim = 0.36 * fck * b * xu_max / (0.87 * fy);
            let ast2 = mu2 * 1e6 / (0.87 * fy * (d - d_prime));
            let ast_total = ast_lim + ast2;
            let asc = ast2 * fy / (0.87 * fy - 0.446 * fck);
            
            let (n_tens, dia_tens) = self.select_rebar(ast_total);
            let (n_comp, dia_comp) = self.select_rebar(asc);
            
            let ast_provided = n_tens as f64 * std::f64::consts::PI * dia_tens.powi(2) / 4.0;
            let asc_provided = n_comp as f64 * std::f64::consts::PI * dia_comp.powi(2) / 4.0;
            
            RCBeamDesign {
                ast_required: ast_total,
                ast_provided,
                asc_required: asc,
                asc_provided,
                tension_bars: format!("{} Nos {}mm", n_tens, dia_tens as i32),
                compression_bars: format!("{} Nos {}mm", n_comp, dia_comp as i32),
                doubly_reinforced,
                utilization: mu / (mu_lim + 0.87 * fy * asc_provided * (d - d_prime) / 1e6),
            }
        }
    }
    
    fn select_rebar(&self, ast_required: f64) -> (usize, f64) {
        // Try different combinations
        for &dia in self.rebar_sizes.iter().rev() {
            let area_per_bar = std::f64::consts::PI * dia.powi(2) / 4.0;
            let n_bars = (ast_required / area_per_bar).ceil() as usize;
            
            if n_bars >= 2 && n_bars <= 8 {
                return (n_bars, dia);
            }
        }
        
        // Default
        (4, 20.0)
    }
}

/// RC beam design result
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RCBeamDesign {
    /// Required tension steel area
    pub ast_required: f64,
    /// Provided tension steel area
    pub ast_provided: f64,
    /// Required compression steel area
    pub asc_required: f64,
    /// Provided compression steel area
    pub asc_provided: f64,
    /// Tension bar description
    pub tension_bars: String,
    /// Compression bar description
    pub compression_bars: String,
    /// Is doubly reinforced
    pub doubly_reinforced: bool,
    /// Utilization ratio
    pub utilization: f64,
}

#[cfg(test)]
mod tests {
    use super::*;
    
    #[test]
    fn test_design_variable_continuous() {
        let var = DesignVariable::Continuous {
            name: "depth".to_string(),
            lower: 200.0,
            upper: 800.0,
            initial: 400.0,
        };
        
        assert_eq!(var.name(), "depth");
        assert_eq!(var.value(), 400.0);
        assert_eq!(var.clamp(1000.0), 800.0);
        assert_eq!(var.clamp(100.0), 200.0);
    }
    
    #[test]
    fn test_design_variable_discrete() {
        let var = DesignVariable::Discrete {
            name: "section".to_string(),
            options: vec![200.0, 250.0, 300.0, 350.0, 400.0],
            initial_index: 2,
        };
        
        assert_eq!(var.value(), 300.0);
        assert_eq!(var.clamp(275.0), 250.0); // Nearest
    }
    
    #[test]
    fn test_constraint() {
        let c1 = Constraint::inequality("stress", -0.5);
        assert!(c1.is_satisfied(0.01));
        assert_eq!(c1.violation, 0.0);
        
        let c2 = Constraint::inequality("stress", 0.5);
        assert!(!c2.is_satisfied(0.01));
        assert!(c2.violation > 0.0);
    }
    
    #[test]
    fn test_optimization_problem() {
        let mut problem = OptimizationProblem::new();
        
        problem.add_variable(DesignVariable::Continuous {
            name: "width".to_string(),
            lower: 100.0,
            upper: 500.0,
            initial: 300.0,
        });
        
        problem.add_variable(DesignVariable::Continuous {
            name: "depth".to_string(),
            lower: 200.0,
            upper: 800.0,
            initial: 500.0,
        });
        
        assert_eq!(problem.n_variables(), 2);
        assert!(problem.get_variable("width").is_some());
        
        let initial = problem.initial_design();
        assert_eq!(initial.len(), 2);
    }
    
    #[test]
    fn test_genetic_algorithm() {
        let mut problem = OptimizationProblem::new();
        
        problem.add_variable(DesignVariable::Continuous {
            name: "x".to_string(),
            lower: -5.0,
            upper: 5.0,
            initial: 0.0,
        });
        
        let mut ga = GeneticAlgorithm::new();
        ga.pop_size = 20;
        ga.generations = 50;
        
        // Minimize x^2
        let result = ga.optimize(&problem, |x| {
            let fitness = x[0] * x[0];
            let constraints = vec![];
            (fitness, constraints)
        });
        
        assert!(result.best_fitness < 1.0);
    }
    
    #[test]
    fn test_particle_swarm() {
        let mut problem = OptimizationProblem::new();
        
        problem.add_variable(DesignVariable::Continuous {
            name: "x".to_string(),
            lower: -5.0,
            upper: 5.0,
            initial: 3.0,
        });
        
        let mut pso = ParticleSwarm::new();
        pso.n_particles = 15;
        pso.max_iter = 30;
        
        let result = pso.optimize(&problem, |x| x[0] * x[0]);
        
        assert!(result.best_fitness < 1.0);
    }
    
    #[test]
    fn test_section_optimizer() {
        let optimizer = SectionOptimizer::new_is();
        
        let result = optimizer.select_steel_beam(100.0, 250.0);
        
        assert!(result.adequate);
        assert!(result.utilization > 0.0 && result.utilization <= 1.0);
    }
    
    #[test]
    fn test_rc_beam_design() {
        let optimizer = SectionOptimizer::new_is();
        
        let design = optimizer.optimize_rc_beam(300.0, 450.0, 25.0, 415.0, 150.0);
        
        assert!(design.ast_provided >= design.ast_required);
        assert!(design.utilization > 0.0);
    }
    
    #[test]
    fn test_individual_creation() {
        let mut problem = OptimizationProblem::new();
        problem.add_variable(DesignVariable::Continuous {
            name: "x".to_string(),
            lower: 0.0,
            upper: 10.0,
            initial: 5.0,
        });
        
        let ind = Individual::random(&problem, 42);
        
        assert_eq!(ind.genes.len(), 1);
        assert!(ind.genes[0] >= 0.0 && ind.genes[0] <= 10.0);
    }
    
    #[test]
    fn test_optimization_algorithms() {
        assert_ne!(OptimizationAlgorithm::GeneticAlgorithm, OptimizationAlgorithm::ParticleSwarm);
        assert_eq!(OptimizationAlgorithm::SQP, OptimizationAlgorithm::SQP);
    }
    
    #[test]
    fn test_steel_section() {
        let optimizer = SectionOptimizer::new_is();
        
        assert!(!optimizer.steel_sections.is_empty());
        assert!(optimizer.steel_sections[0].weight > 0.0);
    }
}
