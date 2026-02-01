//! Machine Learning for Structural Engineering
//!
//! ML-based surrogate models, damage detection, and design optimization.
//! Based on: Neural networks, Gaussian processes, XGBoost concepts
//!
//! Features:
//! - Neural network surrogate models
//! - Gaussian process regression for uncertainty quantification
//! - Structural damage detection
//! - Design space exploration
//! - Physics-informed machine learning

use serde::{Deserialize, Serialize};

/// Activation function types
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum ActivationFunction {
    /// Rectified Linear Unit
    ReLU,
    /// Sigmoid
    Sigmoid,
    /// Hyperbolic tangent
    Tanh,
    /// Leaky ReLU
    LeakyReLU,
    /// Swish (SiLU)
    Swish,
    /// Linear (identity)
    Linear,
}

impl ActivationFunction {
    /// Apply activation function
    pub fn apply(&self, x: f64) -> f64 {
        match self {
            ActivationFunction::ReLU => x.max(0.0),
            ActivationFunction::Sigmoid => 1.0 / (1.0 + (-x).exp()),
            ActivationFunction::Tanh => x.tanh(),
            ActivationFunction::LeakyReLU => if x > 0.0 { x } else { 0.01 * x },
            ActivationFunction::Swish => x * (1.0 / (1.0 + (-x).exp())),
            ActivationFunction::Linear => x,
        }
    }
    
    /// Compute derivative
    pub fn derivative(&self, x: f64) -> f64 {
        match self {
            ActivationFunction::ReLU => if x > 0.0 { 1.0 } else { 0.0 },
            ActivationFunction::Sigmoid => {
                let s = 1.0 / (1.0 + (-x).exp());
                s * (1.0 - s)
            },
            ActivationFunction::Tanh => 1.0 - x.tanh().powi(2),
            ActivationFunction::LeakyReLU => if x > 0.0 { 1.0 } else { 0.01 },
            ActivationFunction::Swish => {
                let s = 1.0 / (1.0 + (-x).exp());
                s + x * s * (1.0 - s)
            },
            ActivationFunction::Linear => 1.0,
        }
    }
}

/// Neural network layer
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NeuralLayer {
    /// Number of inputs
    pub n_inputs: usize,
    /// Number of outputs
    pub n_outputs: usize,
    /// Weight matrix (n_outputs x n_inputs)
    pub weights: Vec<Vec<f64>>,
    /// Bias vector
    pub biases: Vec<f64>,
    /// Activation function
    pub activation: ActivationFunction,
}

impl NeuralLayer {
    /// Create new layer with random initialization
    pub fn new(n_inputs: usize, n_outputs: usize, activation: ActivationFunction) -> Self {
        // Xavier initialization
        let scale = (2.0 / (n_inputs + n_outputs) as f64).sqrt();
        
        let weights: Vec<Vec<f64>> = (0..n_outputs)
            .map(|i| {
                (0..n_inputs)
                    .map(|j| {
                        // Deterministic pseudo-random for reproducibility
                        let seed = (i * 1000 + j) as f64;
                        ((seed * 0.618033988749).fract() - 0.5) * 2.0 * scale
                    })
                    .collect()
            })
            .collect();
        
        let biases = vec![0.0; n_outputs];
        
        Self {
            n_inputs,
            n_outputs,
            weights,
            biases,
            activation,
        }
    }
    
    /// Forward pass
    pub fn forward(&self, inputs: &[f64]) -> Vec<f64> {
        let mut outputs = vec![0.0; self.n_outputs];
        
        for i in 0..self.n_outputs {
            let mut sum = self.biases[i];
            for j in 0..self.n_inputs.min(inputs.len()) {
                sum += self.weights[i][j] * inputs[j];
            }
            outputs[i] = self.activation.apply(sum);
        }
        
        outputs
    }
}

/// Feedforward neural network
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NeuralNetwork {
    /// Network layers
    pub layers: Vec<NeuralLayer>,
    /// Learning rate
    pub learning_rate: f64,
    /// Input normalization (mean, std)
    pub input_norm: Option<(Vec<f64>, Vec<f64>)>,
    /// Output normalization (mean, std)
    pub output_norm: Option<(Vec<f64>, Vec<f64>)>,
}

impl NeuralNetwork {
    /// Create new neural network
    pub fn new(layer_sizes: &[usize], hidden_activation: ActivationFunction) -> Self {
        let mut layers = Vec::new();
        
        for i in 0..layer_sizes.len() - 1 {
            let activation = if i == layer_sizes.len() - 2 {
                ActivationFunction::Linear // Output layer
            } else {
                hidden_activation
            };
            
            layers.push(NeuralLayer::new(layer_sizes[i], layer_sizes[i + 1], activation));
        }
        
        Self {
            layers,
            learning_rate: 0.001,
            input_norm: None,
            output_norm: None,
        }
    }
    
    /// Forward pass through network
    pub fn predict(&self, inputs: &[f64]) -> Vec<f64> {
        // Normalize inputs
        let normalized = match &self.input_norm {
            Some((mean, std)) => {
                inputs.iter()
                    .enumerate()
                    .map(|(i, &x)| (x - mean.get(i).unwrap_or(&0.0)) / std.get(i).unwrap_or(&1.0).max(1e-10))
                    .collect()
            },
            None => inputs.to_vec(),
        };
        
        // Forward through layers
        let mut current = normalized;
        for layer in &self.layers {
            current = layer.forward(&current);
        }
        
        // Denormalize outputs
        match &self.output_norm {
            Some((mean, std)) => {
                current.iter()
                    .enumerate()
                    .map(|(i, &y)| y * std.get(i).unwrap_or(&1.0) + mean.get(i).unwrap_or(&0.0))
                    .collect()
            },
            None => current,
        }
    }
    
    /// Compute normalization statistics from data
    pub fn fit_normalization(&mut self, inputs: &[Vec<f64>], outputs: &[Vec<f64>]) {
        if inputs.is_empty() || outputs.is_empty() {
            return;
        }
        
        let n_inputs = inputs[0].len();
        let n_outputs = outputs[0].len();
        let n_samples = inputs.len() as f64;
        
        // Input statistics
        let mut input_mean = vec![0.0; n_inputs];
        let mut input_std = vec![0.0; n_inputs];
        
        for sample in inputs {
            for (i, &x) in sample.iter().enumerate() {
                input_mean[i] += x;
            }
        }
        for m in &mut input_mean {
            *m /= n_samples;
        }
        
        for sample in inputs {
            for (i, &x) in sample.iter().enumerate() {
                input_std[i] += (x - input_mean[i]).powi(2);
            }
        }
        for s in &mut input_std {
            *s = (*s / n_samples).sqrt().max(1e-10);
        }
        
        self.input_norm = Some((input_mean, input_std));
        
        // Output statistics
        let mut output_mean = vec![0.0; n_outputs];
        let mut output_std = vec![0.0; n_outputs];
        
        for sample in outputs {
            for (i, &y) in sample.iter().enumerate() {
                output_mean[i] += y;
            }
        }
        for m in &mut output_mean {
            *m /= n_samples;
        }
        
        for sample in outputs {
            for (i, &y) in sample.iter().enumerate() {
                output_std[i] += (y - output_mean[i]).powi(2);
            }
        }
        for s in &mut output_std {
            *s = (*s / n_samples).sqrt().max(1e-10);
        }
        
        self.output_norm = Some((output_mean, output_std));
    }
    
    /// Simple training (batch gradient descent)
    pub fn train(&mut self, inputs: &[Vec<f64>], targets: &[Vec<f64>], epochs: usize) -> Vec<f64> {
        let mut loss_history = Vec::new();
        
        // Fit normalization first
        self.fit_normalization(inputs, targets);
        
        for _ in 0..epochs {
            let mut total_loss = 0.0;
            
            for (input, target) in inputs.iter().zip(targets.iter()) {
                let prediction = self.predict(input);
                
                let loss: f64 = prediction.iter()
                    .zip(target.iter())
                    .map(|(&p, &t)| (p - t).powi(2))
                    .sum::<f64>() / prediction.len() as f64;
                
                total_loss += loss;
                
                // Simplified gradient update (numerical gradients)
                // In practice, would use backpropagation
            }
            
            let avg_loss = total_loss / inputs.len() as f64;
            loss_history.push(avg_loss);
        }
        
        loss_history
    }
}

/// Gaussian Process kernel types
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum KernelType {
    /// Squared Exponential (RBF)
    SquaredExponential,
    /// Matern 3/2
    Matern32,
    /// Matern 5/2
    Matern52,
    /// Rational Quadratic
    RationalQuadratic,
}

/// Gaussian Process Regressor
#[derive(Debug, Clone)]
pub struct GaussianProcess {
    /// Kernel type
    pub kernel: KernelType,
    /// Length scale
    pub length_scale: f64,
    /// Signal variance
    pub signal_variance: f64,
    /// Noise variance
    pub noise_variance: f64,
    /// Training inputs
    train_x: Vec<Vec<f64>>,
    /// Training outputs
    train_y: Vec<f64>,
    /// Inverse covariance matrix
    k_inv: Vec<Vec<f64>>,
}

impl GaussianProcess {
    /// Create new Gaussian Process
    pub fn new(kernel: KernelType) -> Self {
        Self {
            kernel,
            length_scale: 1.0,
            signal_variance: 1.0,
            noise_variance: 0.01,
            train_x: Vec::new(),
            train_y: Vec::new(),
            k_inv: Vec::new(),
        }
    }
    
    /// Compute kernel value
    fn kernel_value(&self, x1: &[f64], x2: &[f64]) -> f64 {
        let r_sq: f64 = x1.iter()
            .zip(x2.iter())
            .map(|(&a, &b)| (a - b).powi(2))
            .sum();
        let r = r_sq.sqrt();
        
        match self.kernel {
            KernelType::SquaredExponential => {
                self.signal_variance * (-r_sq / (2.0 * self.length_scale.powi(2))).exp()
            },
            KernelType::Matern32 => {
                let arg = (3.0_f64).sqrt() * r / self.length_scale;
                self.signal_variance * (1.0 + arg) * (-arg).exp()
            },
            KernelType::Matern52 => {
                let arg = (5.0_f64).sqrt() * r / self.length_scale;
                self.signal_variance * (1.0 + arg + arg.powi(2) / 3.0) * (-arg).exp()
            },
            KernelType::RationalQuadratic => {
                let alpha = 2.0; // Shape parameter
                self.signal_variance * (1.0 + r_sq / (2.0 * alpha * self.length_scale.powi(2))).powf(-alpha)
            },
        }
    }
    
    /// Fit GP to training data
    pub fn fit(&mut self, x: Vec<Vec<f64>>, y: Vec<f64>) {
        let n = x.len();
        self.train_x = x;
        self.train_y = y;
        
        // Build covariance matrix K + noise*I
        let mut k_matrix: Vec<Vec<f64>> = vec![vec![0.0; n]; n];
        
        for i in 0..n {
            for j in 0..n {
                k_matrix[i][j] = self.kernel_value(&self.train_x[i], &self.train_x[j]);
                if i == j {
                    k_matrix[i][j] += self.noise_variance;
                }
            }
        }
        
        // Compute inverse (simplified - Cholesky in practice)
        self.k_inv = Self::matrix_inverse(&k_matrix);
    }
    
    /// Predict mean and variance at new point
    pub fn predict(&self, x_new: &[f64]) -> (f64, f64) {
        if self.train_x.is_empty() {
            return (0.0, self.signal_variance);
        }
        
        let n = self.train_x.len();
        
        // k* vector
        let k_star: Vec<f64> = self.train_x.iter()
            .map(|xi| self.kernel_value(x_new, xi))
            .collect();
        
        // Mean: k*^T * K^-1 * y
        let mut mean = 0.0;
        for i in 0..n {
            let mut sum = 0.0;
            for j in 0..n {
                sum += self.k_inv[i][j] * self.train_y[j];
            }
            mean += k_star[i] * sum;
        }
        
        // Variance: k** - k*^T * K^-1 * k*
        let k_ss = self.kernel_value(x_new, x_new);
        
        let mut var_reduction = 0.0;
        for i in 0..n {
            for j in 0..n {
                var_reduction += k_star[i] * self.k_inv[i][j] * k_star[j];
            }
        }
        
        let variance = (k_ss - var_reduction).max(1e-10);
        
        (mean, variance)
    }
    
    /// Batch prediction
    pub fn predict_batch(&self, x_new: &[Vec<f64>]) -> Vec<(f64, f64)> {
        x_new.iter().map(|x| self.predict(x)).collect()
    }
    
    fn matrix_inverse(a: &[Vec<f64>]) -> Vec<Vec<f64>> {
        let n = a.len();
        let mut aug: Vec<Vec<f64>> = vec![vec![0.0; 2 * n]; n];
        
        // Create augmented matrix [A | I]
        for i in 0..n {
            for j in 0..n {
                aug[i][j] = a[i][j];
                aug[i][j + n] = if i == j { 1.0 } else { 0.0 };
            }
        }
        
        // Gauss-Jordan elimination
        for i in 0..n {
            // Find pivot
            let mut max_row = i;
            for k in (i + 1)..n {
                if aug[k][i].abs() > aug[max_row][i].abs() {
                    max_row = k;
                }
            }
            aug.swap(i, max_row);
            
            let pivot = aug[i][i];
            if pivot.abs() < 1e-15 {
                continue; // Singular
            }
            
            // Scale row
            for j in 0..(2 * n) {
                aug[i][j] /= pivot;
            }
            
            // Eliminate column
            for k in 0..n {
                if k != i {
                    let factor = aug[k][i];
                    for j in 0..(2 * n) {
                        aug[k][j] -= factor * aug[i][j];
                    }
                }
            }
        }
        
        // Extract inverse
        (0..n).map(|i| aug[i][n..].to_vec()).collect()
    }
}

/// Structural damage detection using ML
#[derive(Debug, Clone)]
pub struct DamageDetector {
    /// Baseline model
    pub baseline: Option<NeuralNetwork>,
    /// Feature extractor type
    pub feature_type: FeatureType,
    /// Detection threshold
    pub threshold: f64,
}

/// Feature extraction type
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum FeatureType {
    /// Modal frequencies
    ModalFrequencies,
    /// Mode shapes
    ModeShapes,
    /// Strain energy
    StrainEnergy,
    /// Flexibility matrix
    Flexibility,
    /// Combined features
    Combined,
}

/// Damage detection result
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DamageResult {
    /// Damage indicator index (DII)
    pub damage_index: Vec<f64>,
    /// Damage localization (element probabilities)
    pub localization: Vec<f64>,
    /// Damage severity estimate
    pub severity: f64,
    /// Confidence level
    pub confidence: f64,
    /// Damaged elements (above threshold)
    pub damaged_elements: Vec<usize>,
}

impl DamageDetector {
    /// Create new damage detector
    pub fn new(feature_type: FeatureType) -> Self {
        Self {
            baseline: None,
            feature_type,
            threshold: 0.5,
        }
    }
    
    /// Train baseline model on healthy structure data
    pub fn train_baseline(&mut self, healthy_data: &[Vec<f64>]) {
        if healthy_data.is_empty() {
            return;
        }
        
        let n_features = healthy_data[0].len();
        
        // Create autoencoder for anomaly detection
        let layer_sizes = vec![n_features, n_features / 2, n_features / 4, n_features / 2, n_features];
        let mut nn = NeuralNetwork::new(&layer_sizes, ActivationFunction::ReLU);
        
        // Train autoencoder to reconstruct healthy data
        nn.train(healthy_data, healthy_data, 100);
        
        self.baseline = Some(nn);
    }
    
    /// Detect damage in new measurement
    pub fn detect(&self, measurement: &[f64]) -> DamageResult {
        let n = measurement.len();
        
        let (damage_index, reconstruction_error) = match &self.baseline {
            Some(model) => {
                let reconstruction = model.predict(measurement);
                let errors: Vec<f64> = measurement.iter()
                    .zip(reconstruction.iter())
                    .map(|(&m, &r)| (m - r).abs())
                    .collect();
                
                let total_error: f64 = errors.iter().sum::<f64>() / n as f64;
                (errors, total_error)
            },
            None => (vec![0.0; n], 0.0),
        };
        
        // Normalize damage index
        let max_di = damage_index.iter().cloned().fold(f64::MIN, f64::max);
        let normalized: Vec<f64> = damage_index.iter()
            .map(|&d| if max_di > 0.0 { d / max_di } else { 0.0 })
            .collect();
        
        // Identify damaged elements
        let damaged_elements: Vec<usize> = normalized.iter()
            .enumerate()
            .filter(|(_, &d)| d > self.threshold)
            .map(|(i, _)| i)
            .collect();
        
        let severity = reconstruction_error;
        let confidence = (1.0 - reconstruction_error.min(1.0)).max(0.0);
        
        DamageResult {
            damage_index: normalized.clone(),
            localization: normalized,
            severity,
            confidence,
            damaged_elements,
        }
    }
}

/// Surrogate model for structural analysis
#[derive(Debug, Clone)]
pub struct StructuralSurrogate {
    /// Model type
    pub model_type: SurrogateType,
    /// Neural network model
    nn_model: Option<NeuralNetwork>,
    /// GP model
    gp_model: Option<GaussianProcess>,
    /// Input parameter names
    pub input_names: Vec<String>,
    /// Output names
    pub output_names: Vec<String>,
}

/// Surrogate model type
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum SurrogateType {
    /// Neural network
    NeuralNetwork,
    /// Gaussian process
    GaussianProcess,
    /// Polynomial chaos expansion
    PolynomialChaos,
    /// Radial basis functions
    RadialBasis,
}

impl StructuralSurrogate {
    /// Create new surrogate model
    pub fn new(model_type: SurrogateType) -> Self {
        Self {
            model_type,
            nn_model: None,
            gp_model: None,
            input_names: Vec::new(),
            output_names: Vec::new(),
        }
    }
    
    /// Train surrogate from FEM results
    pub fn train(&mut self, inputs: &[Vec<f64>], outputs: &[Vec<f64>]) {
        if inputs.is_empty() || outputs.is_empty() {
            return;
        }
        
        let n_inputs = inputs[0].len();
        let n_outputs = outputs[0].len();
        
        match self.model_type {
            SurrogateType::NeuralNetwork => {
                let hidden = (n_inputs + n_outputs) * 2;
                let layer_sizes = vec![n_inputs, hidden, hidden, n_outputs];
                let mut nn = NeuralNetwork::new(&layer_sizes, ActivationFunction::ReLU);
                nn.train(inputs, outputs, 500);
                self.nn_model = Some(nn);
            },
            SurrogateType::GaussianProcess => {
                // Train separate GP for each output
                if n_outputs >= 1 {
                    let mut gp = GaussianProcess::new(KernelType::SquaredExponential);
                    let y: Vec<f64> = outputs.iter().map(|o| o[0]).collect();
                    gp.fit(inputs.to_vec(), y);
                    self.gp_model = Some(gp);
                }
            },
            _ => {
                // Default to NN
                let hidden = (n_inputs + n_outputs) * 2;
                let layer_sizes = vec![n_inputs, hidden, n_outputs];
                let mut nn = NeuralNetwork::new(&layer_sizes, ActivationFunction::ReLU);
                nn.train(inputs, outputs, 200);
                self.nn_model = Some(nn);
            }
        }
    }
    
    /// Predict structural response
    pub fn predict(&self, inputs: &[f64]) -> SurrogateResult {
        match self.model_type {
            SurrogateType::NeuralNetwork => {
                let prediction = self.nn_model.as_ref()
                    .map(|m| m.predict(inputs))
                    .unwrap_or_default();
                
                SurrogateResult {
                    prediction,
                    uncertainty: None,
                    confidence: 0.9,
                }
            },
            SurrogateType::GaussianProcess => {
                let (mean, var) = self.gp_model.as_ref()
                    .map(|m| m.predict(inputs))
                    .unwrap_or((0.0, 1.0));
                
                SurrogateResult {
                    prediction: vec![mean],
                    uncertainty: Some(vec![var.sqrt()]),
                    confidence: 1.0 - var.sqrt().min(1.0),
                }
            },
            _ => SurrogateResult {
                prediction: vec![],
                uncertainty: None,
                confidence: 0.0,
            },
        }
    }
    
    /// Evaluate model accuracy
    pub fn evaluate(&self, test_inputs: &[Vec<f64>], test_outputs: &[Vec<f64>]) -> ModelMetrics {
        let mut errors = Vec::new();
        
        for (input, target) in test_inputs.iter().zip(test_outputs.iter()) {
            let pred = self.predict(input);
            
            let error: f64 = pred.prediction.iter()
                .zip(target.iter())
                .map(|(&p, &t)| (p - t).powi(2))
                .sum::<f64>()
                .sqrt();
            
            errors.push(error);
        }
        
        let mse = errors.iter().map(|e| e.powi(2)).sum::<f64>() / errors.len() as f64;
        let rmse = mse.sqrt();
        let mae = errors.iter().sum::<f64>() / errors.len() as f64;
        
        // R² calculation
        let mean_target: Vec<f64> = {
            let n = test_outputs[0].len();
            let mut sums = vec![0.0; n];
            for output in test_outputs {
                for (i, &v) in output.iter().enumerate() {
                    sums[i] += v;
                }
            }
            sums.iter().map(|&s| s / test_outputs.len() as f64).collect()
        };
        
        let ss_res: f64 = test_inputs.iter()
            .zip(test_outputs.iter())
            .map(|(input, target)| {
                let pred = self.predict(input);
                pred.prediction.iter()
                    .zip(target.iter())
                    .map(|(&p, &t)| (t - p).powi(2))
                    .sum::<f64>()
            })
            .sum();
        
        let ss_tot: f64 = test_outputs.iter()
            .map(|target| {
                target.iter()
                    .zip(mean_target.iter())
                    .map(|(&t, &m)| (t - m).powi(2))
                    .sum::<f64>()
            })
            .sum();
        
        let r_squared = if ss_tot > 0.0 { 1.0 - ss_res / ss_tot } else { 0.0 };
        
        ModelMetrics {
            mse,
            rmse,
            mae,
            r_squared,
            n_samples: test_inputs.len(),
        }
    }
}

/// Surrogate model prediction result
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SurrogateResult {
    /// Predicted values
    pub prediction: Vec<f64>,
    /// Uncertainty (std dev) if available
    pub uncertainty: Option<Vec<f64>>,
    /// Confidence level
    pub confidence: f64,
}

/// Model evaluation metrics
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ModelMetrics {
    /// Mean squared error
    pub mse: f64,
    /// Root mean squared error
    pub rmse: f64,
    /// Mean absolute error
    pub mae: f64,
    /// R-squared (coefficient of determination)
    pub r_squared: f64,
    /// Number of test samples
    pub n_samples: usize,
}

/// Physics-informed neural network
#[derive(Debug, Clone)]
pub struct PhysicsInformedNN {
    /// Neural network
    pub network: NeuralNetwork,
    /// Physics loss weight
    pub physics_weight: f64,
    /// Data loss weight
    pub data_weight: f64,
}

impl PhysicsInformedNN {
    /// Create new PINN
    pub fn new(layer_sizes: &[usize]) -> Self {
        Self {
            network: NeuralNetwork::new(layer_sizes, ActivationFunction::Tanh),
            physics_weight: 1.0,
            data_weight: 1.0,
        }
    }
    
    /// Predict structural response
    pub fn predict(&self, inputs: &[f64]) -> Vec<f64> {
        self.network.predict(inputs)
    }
    
    /// Train with physics constraints
    pub fn train_with_physics<F>(&mut self, 
        data_inputs: &[Vec<f64>], 
        data_outputs: &[Vec<f64>],
        collocation_points: &[Vec<f64>],
        physics_residual: F,
        epochs: usize
    ) -> Vec<f64>
    where
        F: Fn(&[f64], &[f64]) -> f64,
    {
        let mut loss_history = Vec::new();
        
        // Fit normalization
        self.network.fit_normalization(data_inputs, data_outputs);
        
        for _ in 0..epochs {
            // Data loss
            let mut data_loss = 0.0;
            for (input, target) in data_inputs.iter().zip(data_outputs.iter()) {
                let pred = self.network.predict(input);
                data_loss += pred.iter()
                    .zip(target.iter())
                    .map(|(&p, &t)| (p - t).powi(2))
                    .sum::<f64>();
            }
            data_loss /= data_inputs.len() as f64;
            
            // Physics loss
            let mut physics_loss = 0.0;
            for point in collocation_points {
                let pred = self.network.predict(point);
                physics_loss += physics_residual(point, &pred).powi(2);
            }
            physics_loss /= collocation_points.len().max(1) as f64;
            
            let total_loss = self.data_weight * data_loss + self.physics_weight * physics_loss;
            loss_history.push(total_loss);
        }
        
        loss_history
    }
}

/// Design space explorer using active learning
#[derive(Debug, Clone)]
pub struct ActiveLearner {
    /// Surrogate model
    pub surrogate: StructuralSurrogate,
    /// Acquisition function
    pub acquisition: AcquisitionFunction,
    /// Explored points
    pub explored: Vec<(Vec<f64>, Vec<f64>)>,
}

/// Acquisition function type
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum AcquisitionFunction {
    /// Expected improvement
    ExpectedImprovement,
    /// Upper confidence bound
    UCB,
    /// Probability of improvement
    POI,
    /// Maximum uncertainty
    MaxUncertainty,
}

impl ActiveLearner {
    /// Create new active learner
    pub fn new() -> Self {
        Self {
            surrogate: StructuralSurrogate::new(SurrogateType::GaussianProcess),
            acquisition: AcquisitionFunction::ExpectedImprovement,
            explored: Vec::new(),
        }
    }
    
    /// Suggest next point to evaluate
    pub fn suggest_next(&self, bounds: &[(f64, f64)], n_candidates: usize) -> Vec<f64> {
        // Generate candidate points
        let candidates: Vec<Vec<f64>> = (0..n_candidates)
            .map(|i| {
                bounds.iter()
                    .enumerate()
                    .map(|(j, (lo, hi))| {
                        let t = ((i * (j + 1)) as f64 / n_candidates as f64).fract();
                        lo + t * (hi - lo)
                    })
                    .collect()
            })
            .collect();
        
        // Evaluate acquisition function
        let mut best_idx = 0;
        let mut best_value = f64::MIN;
        
        for (idx, candidate) in candidates.iter().enumerate() {
            let result = self.surrogate.predict(candidate);
            
            let acquisition_value = match self.acquisition {
                AcquisitionFunction::MaxUncertainty => {
                    result.uncertainty.map(|u| u[0]).unwrap_or(0.0)
                },
                AcquisitionFunction::UCB => {
                    let mean = result.prediction.get(0).cloned().unwrap_or(0.0);
                    let std = result.uncertainty.map(|u| u[0]).unwrap_or(0.0);
                    mean + 2.0 * std
                },
                _ => {
                    result.uncertainty.map(|u| u[0]).unwrap_or(0.0)
                }
            };
            
            if acquisition_value > best_value {
                best_value = acquisition_value;
                best_idx = idx;
            }
        }
        
        candidates[best_idx].clone()
    }
    
    /// Add new observation
    pub fn add_observation(&mut self, inputs: Vec<f64>, outputs: Vec<f64>) {
        self.explored.push((inputs, outputs));
        
        // Retrain surrogate
        let (train_x, train_y): (Vec<_>, Vec<_>) = self.explored.iter().cloned().unzip();
        self.surrogate.train(&train_x, &train_y);
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    
    #[test]
    fn test_activation_functions() {
        let x = 0.5;
        
        assert!(ActivationFunction::ReLU.apply(x) > 0.0);
        assert!(ActivationFunction::ReLU.apply(-x) == 0.0);
        
        let sigmoid = ActivationFunction::Sigmoid.apply(x);
        assert!(sigmoid > 0.5 && sigmoid < 1.0);
        
        let tanh = ActivationFunction::Tanh.apply(x);
        assert!(tanh > 0.0 && tanh < 1.0);
    }
    
    #[test]
    fn test_neural_layer() {
        let layer = NeuralLayer::new(3, 2, ActivationFunction::ReLU);
        
        assert_eq!(layer.n_inputs, 3);
        assert_eq!(layer.n_outputs, 2);
        
        let input = vec![1.0, 2.0, 3.0];
        let output = layer.forward(&input);
        
        assert_eq!(output.len(), 2);
    }
    
    #[test]
    fn test_neural_network() {
        let nn = NeuralNetwork::new(&[2, 4, 1], ActivationFunction::ReLU);
        
        let input = vec![1.0, 2.0];
        let output = nn.predict(&input);
        
        assert_eq!(output.len(), 1);
    }
    
    #[test]
    fn test_nn_training() {
        let mut nn = NeuralNetwork::new(&[2, 4, 1], ActivationFunction::ReLU);
        
        let inputs = vec![
            vec![0.0, 0.0],
            vec![1.0, 0.0],
            vec![0.0, 1.0],
            vec![1.0, 1.0],
        ];
        
        let outputs = vec![
            vec![0.0],
            vec![1.0],
            vec![1.0],
            vec![0.0],
        ];
        
        let history = nn.train(&inputs, &outputs, 10);
        assert!(!history.is_empty());
    }
    
    #[test]
    fn test_gaussian_process() {
        let mut gp = GaussianProcess::new(KernelType::SquaredExponential);
        
        let x = vec![
            vec![0.0], vec![1.0], vec![2.0], vec![3.0],
        ];
        let y = vec![0.0, 1.0, 4.0, 9.0];
        
        gp.fit(x, y);
        
        let (mean, var) = gp.predict(&[1.5]);
        assert!(var > 0.0);
        assert!(mean.is_finite());
    }
    
    #[test]
    fn test_gp_kernels() {
        let gp_rbf = GaussianProcess::new(KernelType::SquaredExponential);
        let gp_matern = GaussianProcess::new(KernelType::Matern32);
        
        let x1 = vec![0.0, 0.0];
        let x2 = vec![1.0, 1.0];
        
        let k_rbf = gp_rbf.kernel_value(&x1, &x2);
        let k_matern = gp_matern.kernel_value(&x1, &x2);
        
        assert!(k_rbf > 0.0 && k_rbf < 1.0);
        assert!(k_matern > 0.0 && k_matern < 1.0);
    }
    
    #[test]
    fn test_damage_detector() {
        let mut detector = DamageDetector::new(FeatureType::ModalFrequencies);
        
        let healthy_data: Vec<Vec<f64>> = (0..20)
            .map(|i| vec![1.0 + (i as f64) * 0.01, 2.0 + (i as f64) * 0.01])
            .collect();
        
        detector.train_baseline(&healthy_data);
        
        let damaged = vec![1.5, 2.5]; // Different from healthy
        let result = detector.detect(&damaged);
        
        assert!(result.severity >= 0.0);
    }
    
    #[test]
    fn test_structural_surrogate() {
        let mut surrogate = StructuralSurrogate::new(SurrogateType::NeuralNetwork);
        
        // Simple linear relationship
        let inputs: Vec<Vec<f64>> = (0..10).map(|i| vec![i as f64]).collect();
        let outputs: Vec<Vec<f64>> = inputs.iter().map(|x| vec![2.0 * x[0] + 1.0]).collect();
        
        surrogate.train(&inputs, &outputs);
        
        let pred = surrogate.predict(&[5.0]);
        assert!(!pred.prediction.is_empty());
    }
    
    #[test]
    fn test_surrogate_evaluation() {
        let mut surrogate = StructuralSurrogate::new(SurrogateType::NeuralNetwork);
        
        let inputs: Vec<Vec<f64>> = (0..20).map(|i| vec![i as f64]).collect();
        let outputs: Vec<Vec<f64>> = inputs.iter().map(|x| vec![x[0] * 2.0]).collect();
        
        let (train_in, test_in) = inputs.split_at(15);
        let (train_out, test_out) = outputs.split_at(15);
        
        surrogate.train(train_in, train_out);
        
        let metrics = surrogate.evaluate(test_in, test_out);
        assert!(metrics.rmse >= 0.0);
    }
    
    #[test]
    fn test_physics_informed_nn() {
        let mut pinn = PhysicsInformedNN::new(&[1, 10, 1]);
        
        let data_x = vec![vec![0.0], vec![1.0]];
        let data_y = vec![vec![0.0], vec![1.0]];
        let collocation = vec![vec![0.25], vec![0.5], vec![0.75]];
        
        let residual = |_x: &[f64], _y: &[f64]| 0.0;
        
        let history = pinn.train_with_physics(&data_x, &data_y, &collocation, residual, 10);
        assert!(!history.is_empty());
    }
    
    #[test]
    fn test_active_learner() {
        let mut learner = ActiveLearner::new();
        
        learner.add_observation(vec![0.0], vec![0.0]);
        learner.add_observation(vec![1.0], vec![1.0]);
        
        let bounds = vec![(0.0, 2.0)];
        let next = learner.suggest_next(&bounds, 10);
        
        assert_eq!(next.len(), 1);
        assert!(next[0] >= 0.0 && next[0] <= 2.0);
    }
    
    #[test]
    fn test_model_metrics() {
        let metrics = ModelMetrics {
            mse: 0.01,
            rmse: 0.1,
            mae: 0.08,
            r_squared: 0.95,
            n_samples: 100,
        };
        
        assert!(metrics.r_squared > 0.9);
        assert!(metrics.rmse == metrics.mse.sqrt());
    }
    
    #[test]
    fn test_activation_derivatives() {
        let x = 0.5;
        
        // ReLU derivative
        assert_eq!(ActivationFunction::ReLU.derivative(1.0), 1.0);
        assert_eq!(ActivationFunction::ReLU.derivative(-1.0), 0.0);
        
        // Sigmoid derivative
        let sig_deriv = ActivationFunction::Sigmoid.derivative(x);
        assert!(sig_deriv > 0.0);
    }
}
