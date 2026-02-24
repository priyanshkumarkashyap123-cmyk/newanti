//! Generative Design Module
//! 
//! AI-powered generative design for structural systems:
//! - Multi-objective optimization
//! - Pareto frontier exploration
//! - Constraint handling
//! - Design variant generation
//! - Performance-driven design

use serde::{Deserialize, Serialize};
use std::collections::HashMap;

const PI: f64 = std::f64::consts::PI;

/// Generative design engine
#[derive(Debug, Clone)]
pub struct GenerativeDesignEngine {
    /// Design parameters
    pub parameters: Vec<DesignParameter>,
    /// Objectives
    pub objectives: Vec<DesignObjective>,
    /// Constraints
    pub constraints: Vec<DesignConstraint>,
    /// Generated designs
    pub designs: Vec<GeneratedDesign>,
    /// Pareto front
    pub pareto_front: Vec<usize>,
    /// Configuration
    pub config: GenerativeConfig,
}

/// Design parameter
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DesignParameter {
    /// Parameter name
    pub name: String,
    /// Parameter type
    pub param_type: ParameterType,
    /// Current value
    pub value: f64,
    /// Description
    pub description: String,
}

/// Parameter type
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum ParameterType {
    /// Continuous range
    Continuous { min: f64, max: f64, step: Option<f64> },
    /// Discrete set of values
    Discrete { values: Vec<f64> },
    /// Integer range
    Integer { min: i32, max: i32 },
    /// Boolean
    Boolean,
    /// Categorical choice
    Categorical { options: Vec<String> },
}

/// Design objective
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DesignObjective {
    /// Objective name
    pub name: String,
    /// Direction (minimize or maximize)
    pub direction: OptimizationDirection,
    /// Weight for scalarization
    pub weight: f64,
    /// Target value (if any)
    pub target: Option<f64>,
    /// Importance level
    pub importance: ImportanceLevel,
}

/// Optimization direction
#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
pub enum OptimizationDirection {
    Minimize,
    Maximize,
}

/// Importance level
#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
pub enum ImportanceLevel {
    Critical,
    High,
    Medium,
    Low,
}

/// Design constraint
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DesignConstraint {
    /// Constraint name
    pub name: String,
    /// Constraint type
    pub constraint_type: ConstraintType,
    /// Limit value
    pub limit: f64,
    /// Hard or soft constraint
    pub hard: bool,
    /// Penalty factor for soft constraints
    pub penalty_factor: f64,
}

/// Constraint type
#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
pub enum ConstraintType {
    /// Less than or equal
    LessEqual,
    /// Greater than or equal
    GreaterEqual,
    /// Equal (within tolerance)
    Equal,
    /// Range constraint
    Range,
}

/// Generated design
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GeneratedDesign {
    /// Design ID
    pub id: String,
    /// Parameter values
    pub parameters: HashMap<String, f64>,
    /// Objective values
    pub objectives: HashMap<String, f64>,
    /// Constraint values
    pub constraints: HashMap<String, ConstraintResult>,
    /// Overall feasibility
    pub feasible: bool,
    /// Pareto rank
    pub pareto_rank: usize,
    /// Crowding distance
    pub crowding_distance: f64,
    /// Generation number
    pub generation: usize,
}

/// Constraint check result
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConstraintResult {
    /// Calculated value
    pub value: f64,
    /// Satisfied flag
    pub satisfied: bool,
    /// Violation amount
    pub violation: f64,
}

/// Generative design configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GenerativeConfig {
    /// Population size
    pub population_size: usize,
    /// Number of generations
    pub generations: usize,
    /// Algorithm type
    pub algorithm: OptimizationAlgorithm,
    /// Crossover probability
    pub crossover_prob: f64,
    /// Mutation probability
    pub mutation_prob: f64,
    /// Random seed
    pub seed: u64,
}

/// Optimization algorithm
#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
pub enum OptimizationAlgorithm {
    /// NSGA-II
    NSGAII,
    /// NSGA-III
    NSGAIII,
    /// MOEA/D
    MOEAD,
    /// SPEA2
    SPEA2,
    /// Particle Swarm
    PSO,
}

impl Default for GenerativeConfig {
    fn default() -> Self {
        Self {
            population_size: 100,
            generations: 200,
            algorithm: OptimizationAlgorithm::NSGAII,
            crossover_prob: 0.9,
            mutation_prob: 0.1,
            seed: 42,
        }
    }
}

impl GenerativeDesignEngine {
    /// Create new generative design engine
    pub fn new() -> Self {
        Self {
            parameters: Vec::new(),
            objectives: Vec::new(),
            constraints: Vec::new(),
            designs: Vec::new(),
            pareto_front: Vec::new(),
            config: GenerativeConfig::default(),
        }
    }
    
    /// Add design parameter
    pub fn add_parameter(&mut self, param: DesignParameter) {
        self.parameters.push(param);
    }
    
    /// Add continuous parameter
    pub fn add_continuous_param(&mut self, name: &str, min: f64, max: f64, description: &str) {
        self.parameters.push(DesignParameter {
            name: name.to_string(),
            param_type: ParameterType::Continuous { min, max, step: None },
            value: (min + max) / 2.0,
            description: description.to_string(),
        });
    }
    
    /// Add discrete parameter
    pub fn add_discrete_param(&mut self, name: &str, values: Vec<f64>, description: &str) {
        let default = values.first().cloned().unwrap_or(0.0);
        self.parameters.push(DesignParameter {
            name: name.to_string(),
            param_type: ParameterType::Discrete { values },
            value: default,
            description: description.to_string(),
        });
    }
    
    /// Add objective
    pub fn add_objective(&mut self, name: &str, direction: OptimizationDirection, weight: f64) {
        self.objectives.push(DesignObjective {
            name: name.to_string(),
            direction,
            weight,
            target: None,
            importance: ImportanceLevel::High,
        });
    }
    
    /// Add constraint
    pub fn add_constraint(&mut self, name: &str, constraint_type: ConstraintType, limit: f64, hard: bool) {
        self.constraints.push(DesignConstraint {
            name: name.to_string(),
            constraint_type,
            limit,
            hard,
            penalty_factor: 1000.0,
        });
    }
    
    /// Generate random design
    fn generate_random_design(&self, id: usize, seed: u64) -> GeneratedDesign {
        let mut parameters = HashMap::new();
        
        for (idx, param) in self.parameters.iter().enumerate() {
            let rand = ((seed.wrapping_mul(1103515245).wrapping_add(idx as u64 * 12345)) % 10000) as f64 / 10000.0;
            
            let value = match &param.param_type {
                ParameterType::Continuous { min, max, .. } => {
                    min + rand * (max - min)
                }
                ParameterType::Discrete { values } => {
                    let idx = (rand * values.len() as f64) as usize;
                    values[idx.min(values.len() - 1)]
                }
                ParameterType::Integer { min, max } => {
                    (min + (rand * (max - min + 1) as f64) as i32) as f64
                }
                ParameterType::Boolean => {
                    if rand < 0.5 { 0.0 } else { 1.0 }
                }
                ParameterType::Categorical { options } => {
                    (rand * options.len() as f64) as f64
                }
            };
            
            parameters.insert(param.name.clone(), value);
        }
        
        GeneratedDesign {
            id: format!("design_{}", id),
            parameters,
            objectives: HashMap::new(),
            constraints: HashMap::new(),
            feasible: true,
            pareto_rank: 0,
            crowding_distance: 0.0,
            generation: 0,
        }
    }
    
    /// Evaluate design objectives (simplified - uses parameter-based heuristics)
    fn evaluate_design(&self, design: &mut GeneratedDesign) {
        // Simplified evaluation - in production, this would call FEA solvers
        for objective in &self.objectives {
            let value = self.calculate_objective_heuristic(&objective.name, &design.parameters);
            design.objectives.insert(objective.name.clone(), value);
        }
        
        // Evaluate constraints
        design.feasible = true;
        for constraint in &self.constraints {
            let value = self.calculate_constraint_heuristic(&constraint.name, &design.parameters);
            let satisfied = match constraint.constraint_type {
                ConstraintType::LessEqual => value <= constraint.limit,
                ConstraintType::GreaterEqual => value >= constraint.limit,
                ConstraintType::Equal => (value - constraint.limit).abs() < 0.01 * constraint.limit.abs().max(1.0),
                ConstraintType::Range => true, // Simplified
            };
            
            let violation = if satisfied {
                0.0
            } else {
                match constraint.constraint_type {
                    ConstraintType::LessEqual => value - constraint.limit,
                    ConstraintType::GreaterEqual => constraint.limit - value,
                    _ => (value - constraint.limit).abs(),
                }
            };
            
            design.constraints.insert(constraint.name.clone(), ConstraintResult {
                value,
                satisfied,
                violation,
            });
            
            if constraint.hard && !satisfied {
                design.feasible = false;
            }
        }
    }
    
    /// Calculate objective heuristic
    fn calculate_objective_heuristic(&self, name: &str, params: &HashMap<String, f64>) -> f64 {
        // Simplified heuristics for common structural objectives
        match name {
            "weight" | "mass" => {
                let volume: f64 = params.values().map(|v| v.abs()).product();
                volume.powf(0.3) * 7850.0 // Steel density
            }
            "cost" => {
                let volume: f64 = params.values().map(|v| v.abs()).product();
                volume.powf(0.3) * 5.0 // Cost per unit volume
            }
            "displacement" | "deflection" => {
                let stiffness: f64 = params.values().map(|v| v.max(1.0).powf(3.0)).sum();
                100.0 / stiffness.max(1.0)
            }
            "stress" => {
                let area: f64 = params.values().map(|v| v.max(1.0)).product();
                1000.0 / area.powf(0.5).max(1.0)
            }
            "carbon_footprint" => {
                let volume: f64 = params.values().map(|v| v.abs()).product();
                volume.powf(0.3) * 2.0 // kg CO2 per unit volume
            }
            _ => params.values().sum()
        }
    }
    
    /// Calculate constraint heuristic
    fn calculate_constraint_heuristic(&self, name: &str, params: &HashMap<String, f64>) -> f64 {
        match name {
            "max_stress" => {
                let area: f64 = params.values().map(|v| v.max(1.0)).product();
                1000.0 / area.powf(0.5).max(1.0)
            }
            "max_displacement" => {
                let stiffness: f64 = params.values().map(|v| v.max(1.0).powf(3.0)).sum();
                100.0 / stiffness.max(1.0)
            }
            "buckling_ratio" => {
                let slenderness: f64 = params.values().sum::<f64>() / params.len() as f64;
                slenderness / 100.0
            }
            "frequency" => {
                let stiffness: f64 = params.values().map(|v| v.max(1.0).powf(3.0)).sum();
                let mass: f64 = params.values().sum();
                (stiffness / mass.max(1.0)).sqrt()
            }
            _ => params.values().sum()
        }
    }
    
    /// Compute Pareto dominance
    fn dominates(&self, design_a: &GeneratedDesign, design_b: &GeneratedDesign) -> bool {
        if !design_a.feasible && design_b.feasible {
            return false;
        }
        if design_a.feasible && !design_b.feasible {
            return true;
        }
        
        let mut dominated_in_all = true;
        let mut strictly_better_in_one = false;
        
        for objective in &self.objectives {
            let a = design_a.objectives.get(&objective.name).unwrap_or(&0.0);
            let b = design_b.objectives.get(&objective.name).unwrap_or(&0.0);
            
            let better = match objective.direction {
                OptimizationDirection::Minimize => a < b,
                OptimizationDirection::Maximize => a > b,
            };
            
            let not_worse = match objective.direction {
                OptimizationDirection::Minimize => a <= b,
                OptimizationDirection::Maximize => a >= b,
            };
            
            if better {
                strictly_better_in_one = true;
            }
            if !not_worse {
                dominated_in_all = false;
            }
        }
        
        dominated_in_all && strictly_better_in_one
    }
    
    /// Compute Pareto ranks (NSGA-II style)
    fn compute_pareto_ranks(&mut self) {
        let n = self.designs.len();
        let mut domination_count = vec![0; n];
        let mut dominated_set: Vec<Vec<usize>> = vec![Vec::new(); n];
        let mut fronts: Vec<Vec<usize>> = Vec::new();
        
        // Compute domination relations
        for i in 0..n {
            for j in 0..n {
                if i != j {
                    if self.dominates(&self.designs[i], &self.designs[j]) {
                        dominated_set[i].push(j);
                    } else if self.dominates(&self.designs[j], &self.designs[i]) {
                        domination_count[i] += 1;
                    }
                }
            }
        }
        
        // First front
        let mut current_front: Vec<usize> = (0..n)
            .filter(|&i| domination_count[i] == 0)
            .collect();
        
        let mut rank = 0;
        while !current_front.is_empty() {
            for &i in &current_front {
                self.designs[i].pareto_rank = rank;
            }
            fronts.push(current_front.clone());
            
            let mut next_front = Vec::new();
            for &i in &current_front {
                for &j in &dominated_set[i] {
                    domination_count[j] -= 1;
                    if domination_count[j] == 0 {
                        next_front.push(j);
                    }
                }
            }
            
            current_front = next_front;
            rank += 1;
        }
        
        // Store Pareto front (rank 0)
        self.pareto_front = fronts.first().cloned().unwrap_or_default();
    }
    
    /// Compute crowding distance
    fn compute_crowding_distance(&mut self, front: &[usize]) {
        if front.len() <= 2 {
            for &idx in front {
                self.designs[idx].crowding_distance = f64::INFINITY;
            }
            return;
        }
        
        for &idx in front {
            self.designs[idx].crowding_distance = 0.0;
        }
        
        for objective in &self.objectives {
            // Sort by objective
            let mut sorted: Vec<usize> = front.to_vec();
            sorted.sort_by(|&a, &b| {
                let va = self.designs[a].objectives.get(&objective.name).unwrap_or(&0.0);
                let vb = self.designs[b].objectives.get(&objective.name).unwrap_or(&0.0);
                va.partial_cmp(vb).unwrap_or(std::cmp::Ordering::Equal)
            });
            
            // Boundary points have infinite distance
            self.designs[sorted[0]].crowding_distance = f64::INFINITY;
            self.designs[sorted[sorted.len() - 1]].crowding_distance = f64::INFINITY;
            
            // Calculate range
            let f_min = self.designs[sorted[0]].objectives.get(&objective.name).unwrap_or(&0.0);
            let f_max = self.designs[sorted[sorted.len() - 1]].objectives.get(&objective.name).unwrap_or(&0.0);
            let range = (f_max - f_min).max(1e-10);
            
            // Calculate crowding distance
            for i in 1..sorted.len() - 1 {
                let prev = self.designs[sorted[i - 1]].objectives.get(&objective.name).unwrap_or(&0.0);
                let next = self.designs[sorted[i + 1]].objectives.get(&objective.name).unwrap_or(&0.0);
                self.designs[sorted[i]].crowding_distance += (next - prev) / range;
            }
        }
    }
    
    /// Run generative design optimization
    pub fn optimize<F>(&mut self, evaluator: Option<F>) -> Vec<&GeneratedDesign>
    where F: Fn(&HashMap<String, f64>) -> HashMap<String, f64>
    {
        // Initialize population
        self.designs.clear();
        for i in 0..self.config.population_size {
            let mut design = self.generate_random_design(i, self.config.seed.wrapping_add(i as u64));
            
            if let Some(ref eval) = evaluator {
                design.objectives = eval(&design.parameters);
            } else {
                self.evaluate_design(&mut design);
            }
            
            self.designs.push(design);
        }
        
        // Evolution loop
        for gen in 0..self.config.generations {
            self.compute_pareto_ranks();
            
            // Compute crowding distance for each front
            let fronts = self.get_fronts();
            for front in fronts {
                self.compute_crowding_distance(&front);
            }
            
            // Selection and reproduction
            let mut offspring = Vec::new();
            while offspring.len() < self.config.population_size {
                let parent1_idx = self.tournament_select(self.config.seed.wrapping_add(gen as u64 * 2));
                let parent2_idx = self.tournament_select(self.config.seed.wrapping_add(gen as u64 * 2 + 1));
                
                let (mut child1, mut child2) = self.crossover(
                    &self.designs[parent1_idx],
                    &self.designs[parent2_idx],
                    self.config.seed.wrapping_add(gen as u64 * 3),
                );
                
                self.mutate(&mut child1, self.config.seed.wrapping_add(gen as u64 * 5));
                self.mutate(&mut child2, self.config.seed.wrapping_add(gen as u64 * 7));
                
                child1.generation = gen + 1;
                child2.generation = gen + 1;
                
                if let Some(ref eval) = evaluator {
                    child1.objectives = eval(&child1.parameters);
                    child2.objectives = eval(&child2.parameters);
                } else {
                    self.evaluate_design(&mut child1);
                    self.evaluate_design(&mut child2);
                }
                
                offspring.push(child1);
                if offspring.len() < self.config.population_size {
                    offspring.push(child2);
                }
            }
            
            // Merge and select
            self.designs.extend(offspring);
            self.compute_pareto_ranks();
            
            let fronts = self.get_fronts();
            let mut new_population = Vec::new();
            
            for front in fronts {
                if new_population.len() + front.len() <= self.config.population_size {
                    for &idx in &front {
                        new_population.push(self.designs[idx].clone());
                    }
                } else {
                    // Need to select from this front
                    self.compute_crowding_distance(&front);
                    let mut remaining: Vec<usize> = front.to_vec();
                    remaining.sort_by(|&a, &b| {
                        self.designs[b].crowding_distance
                            .partial_cmp(&self.designs[a].crowding_distance)
                            .unwrap_or(std::cmp::Ordering::Equal)
                    });
                    
                    let needed = self.config.population_size - new_population.len();
                    for &idx in remaining.iter().take(needed) {
                        new_population.push(self.designs[idx].clone());
                    }
                    break;
                }
            }
            
            self.designs = new_population;
        }
        
        self.compute_pareto_ranks();
        self.pareto_front.iter()
            .map(|&idx| &self.designs[idx])
            .collect()
    }
    
    /// Get Pareto fronts
    fn get_fronts(&self) -> Vec<Vec<usize>> {
        let max_rank = self.designs.iter()
            .map(|d| d.pareto_rank)
            .max()
            .unwrap_or(0);
        
        (0..=max_rank)
            .map(|rank| {
                self.designs.iter()
                    .enumerate()
                    .filter(|(_, d)| d.pareto_rank == rank)
                    .map(|(i, _)| i)
                    .collect()
            })
            .collect()
    }
    
    /// Tournament selection
    fn tournament_select(&self, seed: u64) -> usize {
        let tournament_size = 3;
        let mut best_idx = (seed % self.designs.len() as u64) as usize;
        
        for i in 1..tournament_size {
            let idx = ((seed.wrapping_mul(1103515245).wrapping_add(i * 12345)) % self.designs.len() as u64) as usize;
            
            let candidate = &self.designs[idx];
            let best = &self.designs[best_idx];
            
            if candidate.pareto_rank < best.pareto_rank ||
               (candidate.pareto_rank == best.pareto_rank && 
                candidate.crowding_distance > best.crowding_distance) {
                best_idx = idx;
            }
        }
        
        best_idx
    }
    
    /// Crossover operation
    fn crossover(&self, parent1: &GeneratedDesign, parent2: &GeneratedDesign, seed: u64) -> (GeneratedDesign, GeneratedDesign) {
        let mut child1 = parent1.clone();
        let mut child2 = parent2.clone();
        child1.id = format!("design_{}", seed);
        child2.id = format!("design_{}", seed + 1);
        
        // SBX crossover
        let eta_c = 20.0;
        
        for (idx, param) in self.parameters.iter().enumerate() {
            let rand = ((seed.wrapping_mul(1103515245).wrapping_add(idx as u64 * 12345)) % 10000) as f64 / 10000.0;
            
            if rand < self.config.crossover_prob {
                if let ParameterType::Continuous { min, max, .. } = &param.param_type {
                    let p1 = parent1.parameters.get(&param.name).unwrap_or(&0.0);
                    let p2 = parent2.parameters.get(&param.name).unwrap_or(&0.0);
                    
                    if (p1 - p2).abs() > 1e-10 {
                        let (y1, y2) = if p1 < p2 { (*p1, *p2) } else { (*p2, *p1) };
                        
                        let rand_u = ((seed.wrapping_mul(12345).wrapping_add(idx as u64 * 67890)) % 10000) as f64 / 10000.0;
                        let beta = if rand_u <= 0.5 {
                            (2.0 * rand_u).powf(1.0 / (eta_c + 1.0))
                        } else {
                            (1.0 / (2.0 * (1.0 - rand_u))).powf(1.0 / (eta_c + 1.0))
                        };
                        
                        let c1 = (0.5 * ((y1 + y2) - beta * (y2 - y1))).clamp(*min, *max);
                        let c2 = (0.5 * ((y1 + y2) + beta * (y2 - y1))).clamp(*min, *max);
                        
                        child1.parameters.insert(param.name.clone(), c1);
                        child2.parameters.insert(param.name.clone(), c2);
                    }
                }
            }
        }
        
        (child1, child2)
    }
    
    /// Mutation operation
    fn mutate(&self, design: &mut GeneratedDesign, seed: u64) {
        let eta_m = 20.0;
        
        for (idx, param) in self.parameters.iter().enumerate() {
            let rand = ((seed.wrapping_mul(1103515245).wrapping_add(idx as u64 * 54321)) % 10000) as f64 / 10000.0;
            
            if rand < self.config.mutation_prob {
                if let ParameterType::Continuous { min, max, .. } = &param.param_type {
                    let x = design.parameters.get(&param.name).unwrap_or(&0.0);
                    let delta_max = max - min;
                    
                    let rand_mut = ((seed.wrapping_mul(67890).wrapping_add(idx as u64 * 11111)) % 10000) as f64 / 10000.0;
                    
                    let delta = if rand_mut < 0.5 {
                        let xy = (x - min) / delta_max;
                        let val = 2.0 * rand_mut + (1.0 - 2.0 * rand_mut) * (1.0 - xy).powf(eta_m + 1.0);
                        val.powf(1.0 / (eta_m + 1.0)) - 1.0
                    } else {
                        let xy = (max - x) / delta_max;
                        let val = 2.0 * (1.0 - rand_mut) + 2.0 * (rand_mut - 0.5) * (1.0 - xy).powf(eta_m + 1.0);
                        1.0 - val.powf(1.0 / (eta_m + 1.0))
                    };
                    
                    let new_val = (x + delta * delta_max).clamp(*min, *max);
                    design.parameters.insert(param.name.clone(), new_val);
                }
            }
        }
    }
    
    /// Get Pareto front designs
    pub fn get_pareto_designs(&self) -> Vec<&GeneratedDesign> {
        self.pareto_front.iter()
            .map(|&idx| &self.designs[idx])
            .collect()
    }
}

/// Design variant generator
#[derive(Debug, Clone)]
pub struct VariantGenerator {
    /// Base design
    pub base_design: HashMap<String, f64>,
    /// Variation strategies
    pub strategies: Vec<VariationStrategy>,
}

/// Variation strategy
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum VariationStrategy {
    /// Scale parameters uniformly
    UniformScale { factor_range: (f64, f64) },
    /// Proportional variation
    Proportional { base_param: String, ratios: Vec<(String, f64)> },
    /// Random perturbation
    Perturbation { std_dev: f64 },
    /// Grid sampling
    Grid { steps: usize },
    /// Latin hypercube
    LatinHypercube { samples: usize },
}

impl VariantGenerator {
    /// Create variant generator
    pub fn new(base_design: HashMap<String, f64>) -> Self {
        Self {
            base_design,
            strategies: Vec::new(),
        }
    }
    
    /// Generate variants using perturbation
    pub fn generate_perturbation_variants(&self, num_variants: usize, std_dev: f64, seed: u64) -> Vec<HashMap<String, f64>> {
        let mut variants = Vec::new();
        
        for i in 0..num_variants {
            let mut variant = self.base_design.clone();
            
            for (_key, value) in variant.iter_mut() {
                // Box-Muller transform for normal distribution
                let u1 = ((seed.wrapping_mul(1103515245).wrapping_add(i as u64 * 12345)) % 10000) as f64 / 10000.0;
                let u2 = ((seed.wrapping_mul(22695477).wrapping_add(i as u64 * 67890)) % 10000) as f64 / 10000.0;
                
                let z = (-2.0 * u1.max(1e-10).ln()).sqrt() * (2.0 * PI * u2).cos();
                *value *= 1.0 + z * std_dev;
            }
            
            variants.push(variant);
        }
        
        variants
    }
    
    /// Generate grid variants
    pub fn generate_grid_variants(&self, param_name: &str, values: &[f64]) -> Vec<HashMap<String, f64>> {
        values.iter()
            .map(|&val| {
                let mut variant = self.base_design.clone();
                variant.insert(param_name.to_string(), val);
                variant
            })
            .collect()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    
    #[test]
    fn test_generative_engine_creation() {
        let engine = GenerativeDesignEngine::new();
        assert!(engine.parameters.is_empty());
        assert!(engine.objectives.is_empty());
    }
    
    #[test]
    fn test_add_parameters() {
        let mut engine = GenerativeDesignEngine::new();
        engine.add_continuous_param("width", 100.0, 500.0, "Beam width in mm");
        engine.add_continuous_param("depth", 200.0, 800.0, "Beam depth in mm");
        
        assert_eq!(engine.parameters.len(), 2);
    }
    
    #[test]
    fn test_add_objectives() {
        let mut engine = GenerativeDesignEngine::new();
        engine.add_objective("weight", OptimizationDirection::Minimize, 1.0);
        engine.add_objective("stiffness", OptimizationDirection::Maximize, 0.5);
        
        assert_eq!(engine.objectives.len(), 2);
    }
    
    #[test]
    fn test_add_constraints() {
        let mut engine = GenerativeDesignEngine::new();
        engine.add_constraint("max_stress", ConstraintType::LessEqual, 250.0, true);
        
        assert_eq!(engine.constraints.len(), 1);
    }
    
    #[test]
    fn test_optimization_direction() {
        assert_ne!(OptimizationDirection::Minimize, OptimizationDirection::Maximize);
    }
    
    #[test]
    fn test_importance_levels() {
        assert_ne!(ImportanceLevel::Critical, ImportanceLevel::Low);
    }
    
    #[test]
    fn test_random_design_generation() {
        let mut engine = GenerativeDesignEngine::new();
        engine.add_continuous_param("width", 100.0, 500.0, "Width");
        
        let design = engine.generate_random_design(0, 42);
        
        let width = design.parameters.get("width").unwrap();
        assert!(*width >= 100.0 && *width <= 500.0);
    }
    
    #[test]
    fn test_design_evaluation() {
        let mut engine = GenerativeDesignEngine::new();
        engine.add_continuous_param("width", 100.0, 500.0, "Width");
        engine.add_objective("weight", OptimizationDirection::Minimize, 1.0);
        engine.add_constraint("max_stress", ConstraintType::LessEqual, 500.0, true);
        
        let mut design = engine.generate_random_design(0, 42);
        engine.evaluate_design(&mut design);
        
        assert!(design.objectives.contains_key("weight"));
    }
    
    #[test]
    fn test_pareto_dominance() {
        let mut engine = GenerativeDesignEngine::new();
        engine.add_objective("weight", OptimizationDirection::Minimize, 1.0);
        engine.add_objective("cost", OptimizationDirection::Minimize, 1.0);
        
        let mut design_a = GeneratedDesign {
            id: "a".to_string(),
            parameters: HashMap::new(),
            objectives: HashMap::from([
                ("weight".to_string(), 10.0),
                ("cost".to_string(), 100.0),
            ]),
            constraints: HashMap::new(),
            feasible: true,
            pareto_rank: 0,
            crowding_distance: 0.0,
            generation: 0,
        };
        
        let mut design_b = GeneratedDesign {
            id: "b".to_string(),
            parameters: HashMap::new(),
            objectives: HashMap::from([
                ("weight".to_string(), 20.0),
                ("cost".to_string(), 200.0),
            ]),
            constraints: HashMap::new(),
            feasible: true,
            pareto_rank: 0,
            crowding_distance: 0.0,
            generation: 0,
        };
        
        assert!(engine.dominates(&design_a, &design_b));
        assert!(!engine.dominates(&design_b, &design_a));
    }
    
    #[test]
    fn test_simple_optimization() {
        let mut engine = GenerativeDesignEngine::new();
        engine.add_continuous_param("x", 0.0, 10.0, "X coordinate");
        engine.add_objective("minimize_x", OptimizationDirection::Minimize, 1.0);
        engine.config.population_size = 20;
        engine.config.generations = 10;
        
        let pareto = engine.optimize::<fn(&HashMap<String, f64>) -> HashMap<String, f64>>(None);
        
        assert!(!pareto.is_empty());
    }
    
    #[test]
    fn test_variant_generator() {
        let base = HashMap::from([
            ("width".to_string(), 200.0),
            ("depth".to_string(), 400.0),
        ]);
        
        let generator = VariantGenerator::new(base);
        let variants = generator.generate_perturbation_variants(5, 0.1, 42);
        
        assert_eq!(variants.len(), 5);
    }
    
    #[test]
    fn test_grid_variants() {
        let base = HashMap::from([
            ("width".to_string(), 200.0),
        ]);
        
        let generator = VariantGenerator::new(base);
        let variants = generator.generate_grid_variants("width", &[150.0, 200.0, 250.0]);
        
        assert_eq!(variants.len(), 3);
        assert_eq!(*variants[0].get("width").unwrap(), 150.0);
    }
    
    #[test]
    fn test_constraint_types() {
        assert_ne!(ConstraintType::LessEqual, ConstraintType::GreaterEqual);
    }
    
    #[test]
    fn test_algorithm_types() {
        assert_ne!(OptimizationAlgorithm::NSGAII, OptimizationAlgorithm::MOEAD);
    }
}
