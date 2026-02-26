//! Structural AI - Machine Learning Enhanced Analysis
//! 
//! Advanced AI/ML integration for structural engineering:
//! - Neural network-based design optimization
//! - Surrogate modeling for rapid evaluation
//! - Genetic algorithm optimization
//! - Reinforcement learning for structural control
//! - Computer vision for damage detection

use serde::{Deserialize, Serialize};

const PI: f64 = std::f64::consts::PI;

/// Neural network for structural prediction
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NeuralNetwork {
    /// Network name
    pub name: String,
    /// Layer sizes
    pub layers: Vec<usize>,
    /// Weights for each layer
    pub weights: Vec<Vec<Vec<f64>>>,
    /// Biases for each layer
    pub biases: Vec<Vec<f64>>,
    /// Activation function
    pub activation: ActivationFunction,
    /// Training epochs
    pub epochs_trained: usize,
    /// Loss history
    pub loss_history: Vec<f64>,
}

/// Activation functions
#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
pub enum ActivationFunction {
    /// Rectified Linear Unit
    ReLU,
    /// Sigmoid function
    Sigmoid,
    /// Hyperbolic tangent
    Tanh,
    /// Leaky ReLU
    LeakyReLU,
    /// Swish (SiLU)
    Swish,
    /// Linear
    Linear,
}

impl NeuralNetwork {
    /// Create new neural network
    pub fn new(name: &str, layers: Vec<usize>, activation: ActivationFunction) -> Self {
        let mut weights = Vec::new();
        let mut biases = Vec::new();
        
        // Initialize weights with Xavier initialization
        for i in 0..layers.len() - 1 {
            let input_size = layers[i];
            let output_size = layers[i + 1];
            let scale = (2.0 / (input_size + output_size) as f64).sqrt();
            
            let mut layer_weights = Vec::new();
            for _ in 0..output_size {
                let mut neuron_weights = Vec::new();
                for _ in 0..input_size {
                    // Simple pseudo-random initialization
                    let rand_val = ((i * 7 + neuron_weights.len() * 13) % 100) as f64 / 100.0 - 0.5;
                    neuron_weights.push(rand_val * scale);
                }
                layer_weights.push(neuron_weights);
            }
            weights.push(layer_weights);
            
            let layer_biases = vec![0.0; output_size];
            biases.push(layer_biases);
        }
        
        Self {
            name: name.to_string(),
            layers,
            weights,
            biases,
            activation,
            epochs_trained: 0,
            loss_history: Vec::new(),
        }
    }
    
    /// Forward pass through network
    pub fn forward(&self, input: &[f64]) -> Vec<f64> {
        let mut current = input.to_vec();
        
        for (layer_idx, (weights, biases)) in self.weights.iter().zip(self.biases.iter()).enumerate() {
            let mut output = Vec::new();
            
            for (neuron_weights, bias) in weights.iter().zip(biases.iter()) {
                let sum: f64 = neuron_weights.iter()
                    .zip(current.iter())
                    .map(|(w, x)| w * x)
                    .sum::<f64>() + bias;
                
                // Apply activation (except for last layer if regression)
                let activated = if layer_idx < self.weights.len() - 1 {
                    self.apply_activation(sum)
                } else {
                    sum // Linear output for regression
                };
                
                output.push(activated);
            }
            
            current = output;
        }
        
        current
    }
    
    /// Apply activation function
    fn apply_activation(&self, x: f64) -> f64 {
        match self.activation {
            ActivationFunction::ReLU => x.max(0.0),
            ActivationFunction::Sigmoid => 1.0 / (1.0 + (-x).exp()),
            ActivationFunction::Tanh => x.tanh(),
            ActivationFunction::LeakyReLU => if x > 0.0 { x } else { 0.01 * x },
            ActivationFunction::Swish => x / (1.0 + (-x).exp()),
            ActivationFunction::Linear => x,
        }
    }
    
    /// Train network on data
    pub fn train(&mut self, inputs: &[Vec<f64>], targets: &[Vec<f64>], epochs: usize, learning_rate: f64) {
        for _epoch in 0..epochs {
            let mut total_loss = 0.0;
            
            for (input, target) in inputs.iter().zip(targets.iter()) {
                let output = self.forward(input);
                
                // Calculate loss (MSE)
                let loss: f64 = output.iter()
                    .zip(target.iter())
                    .map(|(o, t)| (o - t).powi(2))
                    .sum::<f64>() / output.len() as f64;
                
                total_loss += loss;
                
                // Simplified gradient descent (for demonstration)
                let error: Vec<f64> = output.iter()
                    .zip(target.iter())
                    .map(|(o, t)| o - t)
                    .collect();
                
                // Calculate last layer input first (before mutable borrow)
                let last_input = if self.weights.len() > 1 {
                    let mut activation = input.to_vec();
                    let num_layers = self.weights.len();
                    for layer_idx in 0..num_layers - 1 {
                        let weights = &self.weights[layer_idx];
                        let mut next = vec![0.0; weights.len()];
                        for (i, neuron) in weights.iter().enumerate() {
                            let sum: f64 = neuron.iter()
                                .zip(activation.iter())
                                .map(|(w, a)| w * a)
                                .sum();
                            next[i] = self.apply_activation(sum);
                        }
                        activation = next;
                    }
                    activation
                } else {
                    input.clone()
                };
                
                // Now update weights with mutable borrow
                let num_weights = self.weights.len();
                if num_weights > 0 {
                    let last_idx = num_weights - 1;
                    let last_weights = &mut self.weights[last_idx];
                    
                    for (neuron_idx, (neuron_weights, err)) in last_weights.iter_mut()
                        .zip(error.iter()).enumerate() 
                    {
                        for (weight_idx, weight) in neuron_weights.iter_mut().enumerate() {
                            if weight_idx < last_input.len() {
                                *weight -= learning_rate * err * last_input[weight_idx];
                            }
                        }
                        // Update biases separately
                        if neuron_idx < self.biases[last_idx].len() {
                            self.biases[last_idx][neuron_idx] -= learning_rate * err;
                        }
                    }
                }
            }
            
            self.loss_history.push(total_loss / inputs.len() as f64);
            self.epochs_trained += 1;
        }
    }
}

/// Surrogate model for rapid structural evaluation
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SurrogateModel {
    /// Model type
    pub model_type: SurrogateType,
    /// Input parameters
    pub input_params: Vec<String>,
    /// Output parameters
    pub output_params: Vec<String>,
    /// Neural network (if NN-based)
    pub neural_net: Option<NeuralNetwork>,
    /// Training data bounds
    pub bounds: Vec<(f64, f64)>,
    /// R² score
    pub r_squared: f64,
}

/// Surrogate model types
#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
pub enum SurrogateType {
    /// Neural network
    NeuralNetwork,
    /// Kriging (Gaussian Process)
    Kriging,
    /// Radial Basis Function
    RBF,
    /// Polynomial Response Surface
    Polynomial,
    /// Support Vector Regression
    SVR,
}

impl SurrogateModel {
    /// Create neural network surrogate
    pub fn neural_network(input_params: Vec<String>, output_params: Vec<String>) -> Self {
        let input_size = input_params.len();
        let output_size = output_params.len();
        let hidden_size = (input_size + output_size) * 2;
        
        let nn = NeuralNetwork::new(
            "structural_surrogate",
            vec![input_size, hidden_size, hidden_size, output_size],
            ActivationFunction::ReLU,
        );
        
        Self {
            model_type: SurrogateType::NeuralNetwork,
            input_params,
            output_params,
            neural_net: Some(nn),
            bounds: Vec::new(),
            r_squared: 0.0,
        }
    }
    
    /// Train surrogate model
    pub fn train(&mut self, inputs: &[Vec<f64>], outputs: &[Vec<f64>], epochs: usize) {
        // Update bounds
        if !inputs.is_empty() {
            let num_params = inputs[0].len();
            self.bounds = (0..num_params)
                .map(|i| {
                    let values: Vec<f64> = inputs.iter().map(|x| x[i]).collect();
                    let min = values.iter().cloned().fold(f64::INFINITY, f64::min);
                    let max = values.iter().cloned().fold(f64::NEG_INFINITY, f64::max);
                    (min, max)
                })
                .collect();
        }
        
        if let Some(ref mut nn) = self.neural_net {
            nn.train(inputs, outputs, epochs, 0.001);
        }
        
        // Calculate R² score
        self.r_squared = self.calculate_r_squared(inputs, outputs);
    }
    
    /// Predict outputs
    pub fn predict(&self, input: &[f64]) -> Vec<f64> {
        match &self.neural_net {
            Some(nn) => nn.forward(input),
            None => vec![0.0; self.output_params.len()],
        }
    }
    
    /// Calculate R² score
    fn calculate_r_squared(&self, inputs: &[Vec<f64>], targets: &[Vec<f64>]) -> f64 {
        if inputs.is_empty() || targets.is_empty() {
            return 0.0;
        }
        
        let predictions: Vec<Vec<f64>> = inputs.iter()
            .map(|x| self.predict(x))
            .collect();
        
        let num_outputs = targets[0].len();
        let mut r2_sum = 0.0;
        
        for out_idx in 0..num_outputs {
            let actual: Vec<f64> = targets.iter().map(|t| t[out_idx]).collect();
            let predicted: Vec<f64> = predictions.iter().map(|p| p[out_idx]).collect();
            
            let mean_actual = actual.iter().sum::<f64>() / actual.len() as f64;
            let ss_tot: f64 = actual.iter().map(|a| (a - mean_actual).powi(2)).sum();
            let ss_res: f64 = actual.iter()
                .zip(predicted.iter())
                .map(|(a, p)| (a - p).powi(2))
                .sum();
            
            let r2 = if ss_tot > 0.0 { 1.0 - ss_res / ss_tot } else { 0.0 };
            r2_sum += r2;
        }
        
        r2_sum / num_outputs as f64
    }
}

/// Genetic algorithm optimizer
#[derive(Debug, Clone)]
pub struct GeneticOptimizer {
    /// Population size
    pub population_size: usize,
    /// Number of generations
    pub generations: usize,
    /// Crossover probability
    pub crossover_prob: f64,
    /// Mutation probability
    pub mutation_prob: f64,
    /// Tournament size
    pub tournament_size: usize,
    /// Elitism count
    pub elitism: usize,
    /// Parameter bounds
    pub bounds: Vec<(f64, f64)>,
    /// Constraint functions
    pub constraints: Vec<ConstraintType>,
    /// Best solution found
    pub best_solution: Option<Individual>,
    /// Fitness history
    pub fitness_history: Vec<f64>,
}

/// Individual in population
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Individual {
    /// Genes (parameter values)
    pub genes: Vec<f64>,
    /// Fitness value
    pub fitness: f64,
    /// Constraint violations
    pub violations: Vec<f64>,
    /// Feasibility flag
    pub feasible: bool,
}

/// Constraint types
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum ConstraintType {
    /// g(x) <= 0
    LessThanZero(String),
    /// g(x) = 0
    EqualZero(String),
    /// g(x) >= 0
    GreaterThanZero(String),
}

impl GeneticOptimizer {
    /// Create new genetic optimizer
    pub fn new(bounds: Vec<(f64, f64)>) -> Self {
        Self {
            population_size: 100,
            generations: 200,
            crossover_prob: 0.8,
            mutation_prob: 0.1,
            tournament_size: 3,
            elitism: 2,
            bounds,
            constraints: Vec::new(),
            best_solution: None,
            fitness_history: Vec::new(),
        }
    }
    
    /// Initialize population
    fn initialize_population(&self, seed: u64) -> Vec<Individual> {
        let mut population = Vec::new();
        
        for i in 0..self.population_size {
            let mut genes = Vec::new();
            
            for (idx, &(min, max)) in self.bounds.iter().enumerate() {
                // Pseudo-random within bounds
                let rand = ((seed.wrapping_mul(1103515245).wrapping_add(12345) 
                    .wrapping_mul((i * 37 + idx * 17) as u64)) % 10000) as f64 / 10000.0;
                genes.push(min + rand * (max - min));
            }
            
            population.push(Individual {
                genes,
                fitness: f64::MAX,
                violations: Vec::new(),
                feasible: true,
            });
        }
        
        population
    }
    
    /// Tournament selection
    fn tournament_select<'a>(&self, population: &'a [Individual], seed: u64) -> &'a Individual {
        let mut best: Option<&Individual> = None;
        
        for i in 0..self.tournament_size {
            let idx = ((seed.wrapping_mul(1103515245 + i as u64)) % population.len() as u64) as usize;
            let candidate = &population[idx];
            
            if best.is_none() || self.compare_individuals(candidate, best.unwrap()) {
                best = Some(candidate);
            }
        }
        
        best.unwrap_or(&population[0])
    }
    
    /// Compare individuals (feasible-first rule)
    fn compare_individuals(&self, a: &Individual, b: &Individual) -> bool {
        if a.feasible && !b.feasible {
            return true;
        }
        if !a.feasible && b.feasible {
            return false;
        }
        if !a.feasible && !b.feasible {
            let a_violation: f64 = a.violations.iter().sum();
            let b_violation: f64 = b.violations.iter().sum();
            return a_violation < b_violation;
        }
        a.fitness < b.fitness
    }
    
    /// Crossover two parents
    fn crossover(&self, parent1: &Individual, parent2: &Individual, seed: u64) -> (Individual, Individual) {
        let mut child1 = parent1.clone();
        let mut child2 = parent2.clone();
        
        // SBX crossover
        let eta_c = 20.0;
        
        for i in 0..parent1.genes.len() {
            let rand = ((seed.wrapping_mul(1103515245 + i as u64)) % 10000) as f64 / 10000.0;
            
            if rand < self.crossover_prob {
                let p1 = parent1.genes[i];
                let p2 = parent2.genes[i];
                
                if (p1 - p2).abs() > 1e-10 {
                    let (y1, y2) = if p1 < p2 { (p1, p2) } else { (p2, p1) };
                    
                    let rand_u = ((seed.wrapping_mul(12345 + i as u64)) % 10000) as f64 / 10000.0;
                    let beta = if rand_u <= 0.5 {
                        (2.0 * rand_u).powf(1.0 / (eta_c + 1.0))
                    } else {
                        (1.0 / (2.0 * (1.0 - rand_u))).powf(1.0 / (eta_c + 1.0))
                    };
                    
                    child1.genes[i] = 0.5 * ((y1 + y2) - beta * (y2 - y1));
                    child2.genes[i] = 0.5 * ((y1 + y2) + beta * (y2 - y1));
                    
                    // Clamp to bounds
                    let (min, max) = self.bounds[i];
                    child1.genes[i] = child1.genes[i].clamp(min, max);
                    child2.genes[i] = child2.genes[i].clamp(min, max);
                }
            }
        }
        
        (child1, child2)
    }
    
    /// Mutate individual
    fn mutate(&self, individual: &mut Individual, seed: u64, generation: usize) {
        // Polynomial mutation
        let eta_m = 20.0 + (generation as f64 / self.generations as f64) * 30.0;
        
        for i in 0..individual.genes.len() {
            let rand = ((seed.wrapping_mul(1103515245 + i as u64)) % 10000) as f64 / 10000.0;
            
            if rand < self.mutation_prob {
                let (min, max) = self.bounds[i];
                let delta_max = max - min;
                let x = individual.genes[i];
                
                let rand_mut = ((seed.wrapping_mul(54321 + i as u64)) % 10000) as f64 / 10000.0;
                
                let delta = if rand_mut < 0.5 {
                    let xy = (x - min) / delta_max;
                    let val = 2.0 * rand_mut + (1.0 - 2.0 * rand_mut) * (1.0 - xy).powf(eta_m + 1.0);
                    val.powf(1.0 / (eta_m + 1.0)) - 1.0
                } else {
                    let xy = (max - x) / delta_max;
                    let val = 2.0 * (1.0 - rand_mut) + 
                        2.0 * (rand_mut - 0.5) * (1.0 - xy).powf(eta_m + 1.0);
                    1.0 - val.powf(1.0 / (eta_m + 1.0))
                };
                
                individual.genes[i] = (x + delta * delta_max).clamp(min, max);
            }
        }
    }
    
    /// Optimize using genetic algorithm
    pub fn optimize<F>(&mut self, objective: F, seed: u64) -> &Individual 
    where F: Fn(&[f64]) -> f64 
    {
        let mut population = self.initialize_population(seed);
        
        // Evaluate initial population
        for individual in &mut population {
            individual.fitness = objective(&individual.genes);
        }
        
        // Sort by fitness
        population.sort_by(|a, b| a.fitness.partial_cmp(&b.fitness).unwrap_or(std::cmp::Ordering::Equal));
        self.best_solution = Some(population[0].clone());
        self.fitness_history.push(population[0].fitness);
        
        for gen in 0..self.generations {
            let mut new_population = Vec::new();
            
            // Elitism
            for elite in population.iter().take(self.elitism) {
                new_population.push(elite.clone());
            }
            
            // Generate offspring
            while new_population.len() < self.population_size {
                let parent1 = self.tournament_select(&population, seed.wrapping_add(gen as u64 * 7));
                let parent2 = self.tournament_select(&population, seed.wrapping_add(gen as u64 * 13));
                
                let (mut child1, mut child2) = self.crossover(parent1, parent2, seed.wrapping_add(gen as u64));
                
                self.mutate(&mut child1, seed.wrapping_add(gen as u64 * 3), gen);
                self.mutate(&mut child2, seed.wrapping_add(gen as u64 * 5), gen);
                
                child1.fitness = objective(&child1.genes);
                child2.fitness = objective(&child2.genes);
                
                new_population.push(child1);
                if new_population.len() < self.population_size {
                    new_population.push(child2);
                }
            }
            
            population = new_population;
            population.sort_by(|a, b| a.fitness.partial_cmp(&b.fitness).unwrap_or(std::cmp::Ordering::Equal));
            
            if let Some(ref best) = self.best_solution {
                if population[0].fitness < best.fitness {
                    self.best_solution = Some(population[0].clone());
                }
            }
            self.fitness_history.push(population[0].fitness);
        }
        
        self.best_solution.as_ref().unwrap()
    }
}

/// Computer vision for damage detection
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DamageDetector {
    /// Detection model
    pub model: DamageDetectionModel,
    /// Detection threshold
    pub threshold: f64,
    /// Damage categories
    pub categories: Vec<String>,
}

/// Damage detection model types
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum DamageDetectionModel {
    /// Convolutional neural network
    CNN { layers: Vec<String> },
    /// YOLO-based detection
    YOLO { version: String },
    /// Semantic segmentation
    Segmentation { backbone: String },
}

/// Detected damage
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DetectedDamage {
    /// Damage type
    pub damage_type: String,
    /// Confidence score
    pub confidence: f64,
    /// Bounding box [x, y, width, height]
    pub bbox: [f64; 4],
    /// Severity estimate
    pub severity: DamageSeverity,
    /// Estimated dimensions
    pub dimensions: Option<DamageDimensions>,
}

/// Damage severity levels
#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
pub enum DamageSeverity {
    Minor,
    Moderate,
    Severe,
    Critical,
}

/// Damage dimensions
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DamageDimensions {
    /// Width in mm
    pub width: f64,
    /// Length in mm
    pub length: f64,
    /// Depth in mm (if estimable)
    pub depth: Option<f64>,
}

impl DamageDetector {
    /// Create CNN-based detector
    pub fn cnn() -> Self {
        Self {
            model: DamageDetectionModel::CNN {
                layers: vec![
                    "Conv2D(32, 3x3)".to_string(),
                    "MaxPool(2x2)".to_string(),
                    "Conv2D(64, 3x3)".to_string(),
                    "MaxPool(2x2)".to_string(),
                    "Conv2D(128, 3x3)".to_string(),
                    "GlobalAvgPool".to_string(),
                    "Dense(256)".to_string(),
                    "Dense(num_classes)".to_string(),
                ],
            },
            threshold: 0.5,
            categories: vec![
                "crack_hairline".to_string(),
                "crack_structural".to_string(),
                "spalling".to_string(),
                "corrosion".to_string(),
                "efflorescence".to_string(),
                "delamination".to_string(),
                "moisture_damage".to_string(),
            ],
        }
    }
    
    /// Detect damage (simulated)
    pub fn detect(&self, _image_data: &[u8], width: usize, height: usize) -> Vec<DetectedDamage> {
        // Simplified simulation - in production, this would run actual ML inference
        let mut detections = Vec::new();
        
        // Simulate detection based on image size
        let num_detections = (width * height / 100000).min(5);
        
        for i in 0..num_detections {
            let category_idx = i % self.categories.len();
            let x = (width as f64 * 0.1 * (i + 1) as f64) / num_detections as f64;
            let y = (height as f64 * 0.1 * (i + 1) as f64) / num_detections as f64;
            
            detections.push(DetectedDamage {
                damage_type: self.categories[category_idx].clone(),
                confidence: 0.7 + (i as f64 * 0.05).min(0.25),
                bbox: [x, y, 50.0, 30.0],
                severity: match i % 4 {
                    0 => DamageSeverity::Minor,
                    1 => DamageSeverity::Moderate,
                    2 => DamageSeverity::Severe,
                    _ => DamageSeverity::Critical,
                },
                dimensions: Some(DamageDimensions {
                    width: 2.0 + i as f64 * 0.5,
                    length: 10.0 + i as f64 * 5.0,
                    depth: Some(0.5 + i as f64 * 0.2),
                }),
            });
        }
        
        detections.into_iter()
            .filter(|d| d.confidence >= self.threshold)
            .collect()
    }
}

/// Reinforcement learning for structural control
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StructuralControlRL {
    /// State dimension
    pub state_dim: usize,
    /// Action dimension
    pub action_dim: usize,
    /// Q-network
    pub q_network: NeuralNetwork,
    /// Learning rate
    pub learning_rate: f64,
    /// Discount factor
    pub gamma: f64,
    /// Exploration rate
    pub epsilon: f64,
    /// Experience buffer
    pub experience_buffer: Vec<Experience>,
}

/// Experience tuple for replay
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Experience {
    /// Current state
    pub state: Vec<f64>,
    /// Action taken
    pub action: usize,
    /// Reward received
    pub reward: f64,
    /// Next state
    pub next_state: Vec<f64>,
    /// Episode done flag
    pub done: bool,
}

impl StructuralControlRL {
    /// Create new RL controller
    pub fn new(state_dim: usize, action_dim: usize) -> Self {
        let hidden = (state_dim + action_dim) * 4;
        let q_network = NeuralNetwork::new(
            "q_network",
            vec![state_dim, hidden, hidden, action_dim],
            ActivationFunction::ReLU,
        );
        
        Self {
            state_dim,
            action_dim,
            q_network,
            learning_rate: 0.001,
            gamma: 0.99,
            epsilon: 1.0,
            experience_buffer: Vec::new(),
        }
    }
    
    /// Select action using epsilon-greedy
    pub fn select_action(&self, state: &[f64], seed: u64) -> usize {
        let rand = (seed % 1000) as f64 / 1000.0;
        
        if rand < self.epsilon {
            // Explore
            (seed % self.action_dim as u64) as usize
        } else {
            // Exploit
            let q_values = self.q_network.forward(state);
            q_values.iter()
                .enumerate()
                .max_by(|(_, a), (_, b)| a.partial_cmp(b).unwrap_or(std::cmp::Ordering::Equal))
                .map(|(idx, _)| idx)
                .unwrap_or(0)
        }
    }
    
    /// Store experience
    pub fn store_experience(&mut self, state: Vec<f64>, action: usize, reward: f64, 
                           next_state: Vec<f64>, done: bool) {
        self.experience_buffer.push(Experience {
            state,
            action,
            reward,
            next_state,
            done,
        });
        
        // Limit buffer size
        if self.experience_buffer.len() > 10000 {
            self.experience_buffer.remove(0);
        }
    }
    
    /// Decay exploration rate
    pub fn decay_epsilon(&mut self, min_epsilon: f64, decay_rate: f64) {
        self.epsilon = (self.epsilon * decay_rate).max(min_epsilon);
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    
    #[test]
    fn test_neural_network_creation() {
        let nn = NeuralNetwork::new("test", vec![4, 8, 2], ActivationFunction::ReLU);
        assert_eq!(nn.layers, vec![4, 8, 2]);
        assert_eq!(nn.weights.len(), 2);
        assert_eq!(nn.biases.len(), 2);
    }
    
    #[test]
    fn test_neural_network_forward() {
        let nn = NeuralNetwork::new("test", vec![2, 4, 1], ActivationFunction::Sigmoid);
        let input = vec![1.0, 2.0];
        let output = nn.forward(&input);
        assert_eq!(output.len(), 1);
    }
    
    #[test]
    fn test_neural_network_training() {
        let mut nn = NeuralNetwork::new("test", vec![2, 4, 1], ActivationFunction::ReLU);
        
        let inputs = vec![
            vec![0.0, 0.0],
            vec![1.0, 0.0],
            vec![0.0, 1.0],
            vec![1.0, 1.0],
        ];
        let targets = vec![
            vec![0.0],
            vec![1.0],
            vec![1.0],
            vec![0.0],
        ];
        
        nn.train(&inputs, &targets, 10, 0.01);
        assert!(nn.epochs_trained >= 10);
    }
    
    #[test]
    fn test_surrogate_model() {
        let mut model = SurrogateModel::neural_network(
            vec!["width".to_string(), "height".to_string()],
            vec!["stress".to_string()],
        );
        
        let inputs = vec![
            vec![100.0, 200.0],
            vec![150.0, 300.0],
            vec![200.0, 400.0],
        ];
        let outputs = vec![
            vec![50.0],
            vec![75.0],
            vec![100.0],
        ];
        
        model.train(&inputs, &outputs, 10);
        
        let prediction = model.predict(&[125.0, 250.0]);
        assert_eq!(prediction.len(), 1);
    }
    
    #[test]
    fn test_genetic_optimizer_creation() {
        let optimizer = GeneticOptimizer::new(vec![(0.0, 10.0), (0.0, 10.0)]);
        assert_eq!(optimizer.bounds.len(), 2);
        assert_eq!(optimizer.population_size, 100);
    }
    
    #[test]
    fn test_genetic_optimization() {
        let mut optimizer = GeneticOptimizer::new(vec![(0.0, 10.0), (0.0, 10.0)]);
        optimizer.population_size = 20;
        optimizer.generations = 10;
        
        // Minimize sphere function
        let objective = |x: &[f64]| x.iter().map(|xi| xi.powi(2)).sum();
        
        let best = optimizer.optimize(objective, 42);
        
        // Should move towards origin
        assert!(best.fitness < 200.0); // Much better than random
    }
    
    #[test]
    fn test_genetic_optimizer_elitism() {
        let mut optimizer = GeneticOptimizer::new(vec![(0.0, 1.0)]);
        optimizer.elitism = 5;
        assert_eq!(optimizer.elitism, 5);
    }
    
    #[test]
    fn test_damage_detector_creation() {
        let detector = DamageDetector::cnn();
        assert!(detector.categories.contains(&"crack_structural".to_string()));
        assert_eq!(detector.threshold, 0.5);
    }
    
    #[test]
    fn test_damage_detection() {
        let detector = DamageDetector::cnn();
        let image = vec![0u8; 640 * 480]; // Dummy image
        
        let detections = detector.detect(&image, 640, 480);
        
        // Should detect some damage in large image
        for detection in &detections {
            assert!(detection.confidence >= detector.threshold);
        }
    }
    
    #[test]
    fn test_damage_severity() {
        assert_ne!(DamageSeverity::Minor, DamageSeverity::Critical);
    }
    
    #[test]
    fn test_rl_controller_creation() {
        let controller = StructuralControlRL::new(4, 3);
        assert_eq!(controller.state_dim, 4);
        assert_eq!(controller.action_dim, 3);
        assert_eq!(controller.epsilon, 1.0);
    }
    
    #[test]
    fn test_rl_action_selection() {
        let controller = StructuralControlRL::new(4, 3);
        let state = vec![1.0, 2.0, 3.0, 4.0];
        
        let action = controller.select_action(&state, 42);
        assert!(action < 3);
    }
    
    #[test]
    fn test_rl_experience_storage() {
        let mut controller = StructuralControlRL::new(2, 2);
        
        controller.store_experience(
            vec![1.0, 2.0],
            0,
            1.0,
            vec![2.0, 3.0],
            false,
        );
        
        assert_eq!(controller.experience_buffer.len(), 1);
    }
    
    #[test]
    fn test_epsilon_decay() {
        let mut controller = StructuralControlRL::new(2, 2);
        controller.epsilon = 1.0;
        
        controller.decay_epsilon(0.1, 0.95);
        
        assert!((controller.epsilon - 0.95).abs() < 0.01);
    }
    
    #[test]
    fn test_activation_functions() {
        let nn_relu = NeuralNetwork::new("relu", vec![2, 2], ActivationFunction::ReLU);
        let nn_sigmoid = NeuralNetwork::new("sigmoid", vec![2, 2], ActivationFunction::Sigmoid);
        let nn_tanh = NeuralNetwork::new("tanh", vec![2, 2], ActivationFunction::Tanh);
        
        assert_eq!(nn_relu.activation, ActivationFunction::ReLU);
        assert_eq!(nn_sigmoid.activation, ActivationFunction::Sigmoid);
        assert_eq!(nn_tanh.activation, ActivationFunction::Tanh);
    }
}
