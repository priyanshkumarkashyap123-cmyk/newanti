// ============================================================================
// DIGITAL TWIN - Real-Time Model, Simulation, Predictions
// Physics-Based Models, Data-Driven Models, Hybrid Approaches
// ============================================================================

use serde::{Deserialize, Serialize};
use std::collections::HashMap;

// ============================================================================
// DIGITAL TWIN STATE
// ============================================================================

/// Digital twin state representation
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DigitalTwinState {
    /// Current time
    pub timestamp: f64,
    /// State variables
    pub state_variables: HashMap<String, f64>,
    /// Input parameters
    pub inputs: HashMap<String, f64>,
    /// Output predictions
    pub outputs: HashMap<String, f64>,
    /// Confidence level (0-1)
    pub confidence: f64,
}

impl DigitalTwinState {
    pub fn new(timestamp: f64) -> Self {
        Self {
            timestamp,
            state_variables: HashMap::new(),
            inputs: HashMap::new(),
            outputs: HashMap::new(),
            confidence: 1.0,
        }
    }
    
    /// Set state variable
    pub fn set_state(&mut self, name: &str, value: f64) {
        self.state_variables.insert(name.to_string(), value);
    }
    
    /// Get state variable
    pub fn get_state(&self, name: &str) -> Option<f64> {
        self.state_variables.get(name).copied()
    }
    
    /// Set input
    pub fn set_input(&mut self, name: &str, value: f64) {
        self.inputs.insert(name.to_string(), value);
    }
    
    /// Set output
    pub fn set_output(&mut self, name: &str, value: f64) {
        self.outputs.insert(name.to_string(), value);
    }
}

// ============================================================================
// PHYSICS-BASED MODEL
// ============================================================================

/// Physics-based structural model
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PhysicsModel {
    /// Degrees of freedom
    pub ndof: usize,
    /// Mass matrix (diagonal for simplicity)
    pub mass: Vec<f64>,
    /// Stiffness matrix (banded)
    pub stiffness: Vec<Vec<f64>>,
    /// Damping matrix
    pub damping: Vec<Vec<f64>>,
    /// Current displacement
    pub displacement: Vec<f64>,
    /// Current velocity
    pub velocity: Vec<f64>,
    /// Current acceleration
    pub acceleration: Vec<f64>,
    /// Time step
    pub dt: f64,
}

impl PhysicsModel {
    pub fn new(ndof: usize) -> Self {
        Self {
            ndof,
            mass: vec![1.0; ndof],
            stiffness: vec![vec![0.0; ndof]; ndof],
            damping: vec![vec![0.0; ndof]; ndof],
            displacement: vec![0.0; ndof],
            velocity: vec![0.0; ndof],
            acceleration: vec![0.0; ndof],
            dt: 0.01,
        }
    }
    
    /// Simple chain system (1D)
    pub fn chain_system(ndof: usize, m: f64, k: f64, _c: f64) -> Self {
        let mut model = Self::new(ndof);
        
        // Mass
        for i in 0..ndof {
            model.mass[i] = m;
        }
        
        // Stiffness (tridiagonal)
        for i in 0..ndof {
            model.stiffness[i][i] = if i == 0 || i == ndof - 1 { k } else { 2.0 * k };
            
            if i > 0 {
                model.stiffness[i][i - 1] = -k;
                model.stiffness[i - 1][i] = -k;
            }
        }
        
        // Rayleigh damping
        let alpha = 0.1;
        let beta = 0.001;
        
        for i in 0..ndof {
            for j in 0..ndof {
                model.damping[i][j] = alpha * model.mass[i] * if i == j { 1.0 } else { 0.0 }
                    + beta * model.stiffness[i][j];
            }
        }
        
        model
    }
    
    /// Compute response to force
    pub fn apply_force(&mut self, force: &[f64]) {
        // Newmark-beta integration (simplified)
        let beta = 0.25;
        let gamma = 0.5;
        let dt = self.dt;
        
        // Effective stiffness
        let mut k_eff = vec![vec![0.0; self.ndof]; self.ndof];
        
        for i in 0..self.ndof {
            for j in 0..self.ndof {
                k_eff[i][j] = self.stiffness[i][j]
                    + self.mass[i] * if i == j { 1.0 } else { 0.0 } / (beta * dt * dt)
                    + gamma / (beta * dt) * self.damping[i][j];
            }
        }
        
        // Effective force
        let mut f_eff = vec![0.0; self.ndof];
        
        for i in 0..self.ndof {
            f_eff[i] = force[i];
            
            // Add inertia terms
            f_eff[i] += self.mass[i] * (
                self.displacement[i] / (beta * dt * dt)
                + self.velocity[i] / (beta * dt)
                + (0.5 / beta - 1.0) * self.acceleration[i]
            );
            
            // Add damping terms
            for j in 0..self.ndof {
                f_eff[i] += self.damping[i][j] * (
                    gamma / (beta * dt) * self.displacement[j]
                    + (gamma / beta - 1.0) * self.velocity[j]
                    + dt * (gamma / (2.0 * beta) - 1.0) * self.acceleration[j]
                );
            }
        }
        
        // Solve for new displacement (simplified - diagonal dominant)
        let mut new_disp = vec![0.0; self.ndof];
        
        for i in 0..self.ndof {
            if k_eff[i][i].abs() > 1e-10 {
                new_disp[i] = f_eff[i] / k_eff[i][i];
            }
        }
        
        // Update velocity and acceleration
        let mut new_acc = vec![0.0; self.ndof];
        let mut new_vel = vec![0.0; self.ndof];
        
        for i in 0..self.ndof {
            new_acc[i] = (new_disp[i] - self.displacement[i]) / (beta * dt * dt)
                - self.velocity[i] / (beta * dt)
                - (0.5 / beta - 1.0) * self.acceleration[i];
            
            new_vel[i] = self.velocity[i]
                + dt * ((1.0 - gamma) * self.acceleration[i] + gamma * new_acc[i]);
        }
        
        self.displacement = new_disp;
        self.velocity = new_vel;
        self.acceleration = new_acc;
    }
    
    /// Natural frequencies (simplified power iteration)
    pub fn natural_frequencies(&self) -> Vec<f64> {
        let mut frequencies = Vec::new();
        
        // Estimate fundamental frequency using diagonal stiffness and mass
        let avg_m = self.mass.iter().sum::<f64>() / self.ndof as f64;
        let avg_k = self.stiffness.iter()
            .map(|row| row.iter().map(|v| v.abs()).sum::<f64>())
            .sum::<f64>() / (self.ndof * 2) as f64;  // Approximate coupling
        
        let omega1 = if avg_k > 0.0 && avg_m > 0.0 {
            (avg_k / avg_m).sqrt()
        } else {
            1.0
        };
        
        frequencies.push(omega1 / (2.0 * std::f64::consts::PI));
        
        // Higher modes (estimate)
        for n in 2..=self.ndof.min(5) {
            frequencies.push(frequencies[0] * (n as f64));
        }
        
        frequencies
    }
}

// ============================================================================
// DATA-DRIVEN MODEL
// ============================================================================

/// Data-driven model types
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum DataDrivenModel {
    /// Linear regression
    LinearRegression { weights: Vec<f64>, bias: f64 },
    /// Polynomial regression
    PolynomialRegression { coefficients: Vec<f64>, degree: usize },
    /// Neural network (simplified)
    NeuralNetwork { layers: Vec<usize>, weights: Vec<Vec<Vec<f64>>> },
    /// Gaussian Process
    GaussianProcess { kernel_length: f64, noise: f64 },
}

impl DataDrivenModel {
    /// Create linear model
    pub fn linear(n_features: usize) -> Self {
        DataDrivenModel::LinearRegression {
            weights: vec![0.0; n_features],
            bias: 0.0,
        }
    }
    
    /// Predict output
    pub fn predict(&self, input: &[f64]) -> f64 {
        match self {
            DataDrivenModel::LinearRegression { weights, bias } => {
                weights.iter()
                    .zip(input.iter())
                    .map(|(w, x)| w * x)
                    .sum::<f64>() + bias
            }
            DataDrivenModel::PolynomialRegression { coefficients, degree } => {
                let mut result = 0.0;
                let mut idx = 0;
                
                for d in 0..=*degree {
                    if idx < coefficients.len() {
                        result += coefficients[idx] * input[0].powi(d as i32);
                        idx += 1;
                    }
                }
                
                result
            }
            _ => 0.0,
        }
    }
    
    /// Train on data (simplified)
    pub fn train(&mut self, inputs: &[Vec<f64>], outputs: &[f64]) {
        if inputs.is_empty() || outputs.is_empty() {
            return;
        }
        
        match self {
            DataDrivenModel::LinearRegression { weights, bias } => {
                // Simple gradient descent
                let lr = 0.01;
                let n = inputs.len() as f64;
                
                for _ in 0..1000 {
                    let mut grad_w = vec![0.0; weights.len()];
                    let mut grad_b = 0.0;
                    
                    for (input, &target) in inputs.iter().zip(outputs.iter()) {
                        let pred: f64 = weights.iter()
                            .zip(input.iter())
                            .map(|(w, x)| w * x)
                            .sum::<f64>() + *bias;
                        
                        let error = pred - target;
                        
                        for (i, x) in input.iter().enumerate() {
                            if i < grad_w.len() {
                                grad_w[i] += error * x / n;
                            }
                        }
                        grad_b += error / n;
                    }
                    
                    for (w, g) in weights.iter_mut().zip(grad_w.iter()) {
                        *w -= lr * g;
                    }
                    *bias -= lr * grad_b;
                }
            }
            _ => {}
        }
    }
}

// ============================================================================
// HYBRID MODEL
// ============================================================================

/// Hybrid physics-data model
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HybridModel {
    /// Physics model
    pub physics: PhysicsModel,
    /// Data-driven correction
    pub correction: DataDrivenModel,
    /// Blending factor (0 = pure physics, 1 = pure data)
    pub blend_factor: f64,
}

impl HybridModel {
    pub fn new(physics: PhysicsModel) -> Self {
        Self {
            physics,
            correction: DataDrivenModel::linear(1),
            blend_factor: 0.2,
        }
    }
    
    /// Predict with hybrid model
    pub fn predict(&self, input: &[f64]) -> Vec<f64> {
        // Physics prediction
        let mut physics_pred = self.physics.displacement.clone();
        
        // Data-driven correction
        let correction = self.correction.predict(input);
        
        // Blend
        for p in &mut physics_pred {
            *p = (1.0 - self.blend_factor) * *p + self.blend_factor * correction;
        }
        
        physics_pred
    }
    
    /// Update model with new data
    pub fn update(&mut self, measured: &[f64], predicted: &[f64]) {
        // Compute residual
        let residual: Vec<f64> = measured.iter()
            .zip(predicted.iter())
            .map(|(m, p)| m - p)
            .collect();
        
        // Update blend factor based on residual
        let rmse: f64 = (residual.iter().map(|r| r * r).sum::<f64>() / residual.len() as f64).sqrt();
        
        // If physics model has large errors, increase data contribution
        if rmse > 0.1 {
            self.blend_factor = (self.blend_factor + 0.1).min(0.8);
        } else {
            self.blend_factor = (self.blend_factor - 0.05).max(0.1);
        }
    }
}

// ============================================================================
// DIGITAL TWIN CORE
// ============================================================================

/// Digital twin for structural system
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DigitalTwin {
    /// Name/identifier
    pub name: String,
    /// Current state
    pub state: DigitalTwinState,
    /// State history
    pub history: Vec<DigitalTwinState>,
    /// Model
    pub model: HybridModel,
    /// Update interval
    pub update_interval: f64,
    /// Prediction horizon
    pub prediction_horizon: f64,
}

impl DigitalTwin {
    pub fn new(name: &str, ndof: usize) -> Self {
        let physics = PhysicsModel::chain_system(ndof, 1.0, 1000.0, 10.0);
        
        Self {
            name: name.to_string(),
            state: DigitalTwinState::new(0.0),
            history: Vec::new(),
            model: HybridModel::new(physics),
            update_interval: 0.1,
            prediction_horizon: 10.0,
        }
    }
    
    /// Synchronize with physical asset
    pub fn synchronize(&mut self, sensor_data: HashMap<String, f64>, timestamp: f64) {
        // Save current state to history
        self.history.push(self.state.clone());
        
        // Update state
        self.state.timestamp = timestamp;
        
        for (key, value) in sensor_data {
            self.state.set_input(&key, value);
        }
        
        // Update confidence based on sensor agreement
        self.state.confidence = 0.95; // Simplified
    }
    
    /// Run simulation step
    pub fn simulate_step(&mut self, external_force: &[f64]) {
        self.model.physics.apply_force(external_force);
        
        // Update state
        for (i, &d) in self.model.physics.displacement.iter().enumerate() {
            self.state.set_state(&format!("disp_{}", i), d);
        }
        
        for (i, &v) in self.model.physics.velocity.iter().enumerate() {
            self.state.set_state(&format!("vel_{}", i), v);
        }
        
        self.state.timestamp += self.model.physics.dt;
    }
    
    /// Predict future state
    pub fn predict(&self, horizon: f64, external_force: &[f64]) -> Vec<DigitalTwinState> {
        let mut predictions = Vec::new();
        let mut model_copy = self.model.clone();
        let mut current_time = self.state.timestamp;
        
        let steps = (horizon / model_copy.physics.dt) as usize;
        
        for _ in 0..steps {
            model_copy.physics.apply_force(external_force);
            current_time += model_copy.physics.dt;
            
            let mut pred_state = DigitalTwinState::new(current_time);
            
            for (i, &d) in model_copy.physics.displacement.iter().enumerate() {
                pred_state.set_output(&format!("disp_{}", i), d);
            }
            
            predictions.push(pred_state);
        }
        
        predictions
    }
    
    /// Compute remaining useful life (simplified)
    pub fn remaining_useful_life(&self, damage_threshold: f64) -> f64 {
        // Simplified: based on current state and damage accumulation rate
        let current_damage = self.state.get_state("damage").unwrap_or(0.0);
        let damage_rate = self.state.get_state("damage_rate").unwrap_or(0.001);
        
        if damage_rate > 1e-10 {
            (damage_threshold - current_damage) / damage_rate
        } else {
            f64::INFINITY
        }
    }
    
    /// Get statistics
    pub fn statistics(&self) -> DigitalTwinStats {
        let mut max_disp = 0.0;
        let mut total_energy = 0.0;
        
        for (_, &v) in self.state.state_variables.iter() {
            if v.abs() > max_disp {
                max_disp = v.abs();
            }
        }
        
        for &m in &self.model.physics.mass {
            for &v in &self.model.physics.velocity {
                total_energy += 0.5 * m * v * v;
            }
        }
        
        DigitalTwinStats {
            current_time: self.state.timestamp,
            max_displacement: max_disp,
            total_energy,
            confidence: self.state.confidence,
            history_length: self.history.len(),
        }
    }
}

/// Digital twin statistics
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DigitalTwinStats {
    pub current_time: f64,
    pub max_displacement: f64,
    pub total_energy: f64,
    pub confidence: f64,
    pub history_length: usize,
}

// ============================================================================
// ANOMALY DETECTION
// ============================================================================

/// Anomaly detection for digital twin
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AnomalyDetection {
    /// Moving average window
    pub window_size: usize,
    /// Threshold (standard deviations)
    pub threshold: f64,
    /// Historical values
    pub history: Vec<f64>,
}

impl AnomalyDetection {
    pub fn new(window_size: usize, threshold: f64) -> Self {
        Self {
            window_size,
            threshold,
            history: Vec::new(),
        }
    }
    
    /// Add value and check for anomaly
    pub fn check(&mut self, value: f64) -> bool {
        if self.history.len() < self.window_size {
            self.history.push(value);
            return false;
        }
        
        // Compute statistics on window BEFORE adding new value
        let recent: Vec<f64> = self.history.iter()
            .rev()
            .take(self.window_size)
            .copied()
            .collect();
        
        let mean: f64 = recent.iter().sum::<f64>() / recent.len() as f64;
        let variance: f64 = recent.iter()
            .map(|x| (x - mean).powi(2))
            .sum::<f64>() / recent.len() as f64;
        let std = variance.sqrt();
        
        // Now add the new value
        self.history.push(value);
        
        // Check if current value is anomalous compared to historical window
        if std > 1e-10 {
            (value - mean).abs() / std > self.threshold
        } else {
            // If std is very small, any significant deviation is anomalous
            (value - mean).abs() > 0.1
        }
    }
    
    /// Get current statistics
    pub fn statistics(&self) -> (f64, f64) {
        if self.history.is_empty() {
            return (0.0, 0.0);
        }
        
        let mean: f64 = self.history.iter().sum::<f64>() / self.history.len() as f64;
        let variance: f64 = self.history.iter()
            .map(|x| (x - mean).powi(2))
            .sum::<f64>() / self.history.len() as f64;
        
        (mean, variance.sqrt())
    }
}

// ============================================================================
// TESTS
// ============================================================================

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_digital_twin_state() {
        let mut state = DigitalTwinState::new(0.0);
        
        state.set_state("displacement", 0.5);
        state.set_input("force", 100.0);
        
        assert!((state.get_state("displacement").unwrap() - 0.5).abs() < 0.01);
    }

    #[test]
    fn test_physics_model() {
        let model = PhysicsModel::chain_system(5, 1.0, 1000.0, 10.0);
        
        assert_eq!(model.ndof, 5);
        assert!(model.stiffness[0][0] > 0.0);
    }

    #[test]
    fn test_physics_simulation() {
        let mut model = PhysicsModel::chain_system(3, 1.0, 100.0, 1.0);
        
        let force = vec![10.0, 0.0, 0.0];
        model.apply_force(&force);
        
        assert!(model.displacement[0].abs() > 0.0);
    }

    #[test]
    fn test_natural_frequencies() {
        let model = PhysicsModel::chain_system(5, 1.0, 1000.0, 10.0);
        
        let freqs = model.natural_frequencies();
        
        assert!(!freqs.is_empty());
        assert!(freqs[0] > 0.0);
    }

    #[test]
    fn test_linear_regression() {
        let mut model = DataDrivenModel::linear(1);
        
        let inputs = vec![vec![1.0], vec![2.0], vec![3.0]];
        let outputs = vec![2.0, 4.0, 6.0];
        
        model.train(&inputs, &outputs);
        
        let pred = model.predict(&[2.5]);
        assert!((pred - 5.0).abs() < 1.0);
    }

    #[test]
    fn test_digital_twin() {
        let mut twin = DigitalTwin::new("Bridge", 5);
        
        let force = vec![10.0, 0.0, 0.0, 0.0, 0.0];
        twin.simulate_step(&force);
        
        let stats = twin.statistics();
        assert!(stats.current_time > 0.0);
    }

    #[test]
    fn test_prediction() {
        let twin = DigitalTwin::new("Building", 3);
        
        let force = vec![5.0, 0.0, 0.0];
        let predictions = twin.predict(1.0, &force);
        
        assert!(!predictions.is_empty());
    }

    #[test]
    fn test_anomaly_detection() {
        let mut detector = AnomalyDetection::new(10, 3.0);
        
        // Normal values (very stable around 10)
        for _ in 0..20 {
            let normal = !detector.check(10.0);
            // After window fills, normal values should not be anomalies
        }
        
        // Extreme anomaly (much larger than 3 std deviations)
        let anomaly = detector.check(1000.0);
        assert!(anomaly);
    }

    #[test]
    fn test_hybrid_model() {
        let physics = PhysicsModel::chain_system(3, 1.0, 100.0, 1.0);
        let hybrid = HybridModel::new(physics);
        
        let pred = hybrid.predict(&[1.0]);
        assert_eq!(pred.len(), 3);
    }

    #[test]
    fn test_synchronize() {
        let mut twin = DigitalTwin::new("Test", 2);
        
        let mut data = HashMap::new();
        data.insert("sensor1".to_string(), 0.5);
        
        twin.synchronize(data, 1.0);
        
        assert!((twin.state.timestamp - 1.0).abs() < 0.01);
    }
}
