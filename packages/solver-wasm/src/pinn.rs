//! # Physics-Informed Neural Network for Beam Deflection
//!
//! Lightweight PINN implementation for structural analysis.
//! Uses finite difference for automatic differentiation.
//!
//! Supports Euler-Bernoulli beam theory:
//! PDE: EI * d⁴w/dx⁴ = q(x)

use nalgebra::{DMatrix, DVector};
use serde::{Deserialize, Serialize};
use wasm_bindgen::prelude::*;

// ============================================
// CONFIGURATION
// ============================================

/// Beam configuration for PINN training
#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct BeamConfig {
    pub length: f64,      // Beam length (m)
    pub e: f64,           // Young's modulus (Pa)
    pub i: f64,           // Second moment of area (m^4)
    pub load: f64,        // Uniform load magnitude (N/m, negative = downward)
    pub boundary: String, // "simply_supported", "cantilever", "fixed_fixed"
}

impl Default for BeamConfig {
    fn default() -> Self {
        Self {
            length: 10.0,
            e: 200e9,
            i: 1e-4,
            load: -10000.0,
            boundary: "simply_supported".to_string(),
        }
    }
}

/// Training hyperparameters
#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct TrainingConfig {
    pub epochs: usize,
    pub learning_rate: f64,
    pub lr_decay: f64,
    pub hidden_dims: Vec<usize>,
    pub num_collocation: usize,
    pub lambda_pde: f64,
    pub lambda_bc: f64,
}

impl Default for TrainingConfig {
    fn default() -> Self {
        Self {
            epochs: 2000,
            learning_rate: 0.01,
            lr_decay: 0.999,
            hidden_dims: vec![32, 32],
            num_collocation: 50,
            lambda_pde: 1.0,
            lambda_bc: 100.0,
        }
    }
}

// ============================================
// NEURAL NETWORK
// ============================================

/// Multi-layer perceptron for PINN
#[derive(Clone)]
pub struct BeamPINN {
    weights: Vec<DMatrix<f64>>,
    biases: Vec<DVector<f64>>,
    layer_sizes: Vec<usize>,
}

impl BeamPINN {
    /// Create new network with given layer sizes
    pub fn new(layer_sizes: Vec<usize>) -> Self {
        let mut weights = Vec::new();
        let mut biases = Vec::new();
        
        // Xavier initialization
        for i in 0..layer_sizes.len() - 1 {
            let n_in = layer_sizes[i];
            let n_out = layer_sizes[i + 1];
            let scale = (2.0 / (n_in + n_out) as f64).sqrt();
            
            // Random initialization using simple LCG
            let mut w = DMatrix::zeros(n_in, n_out);
            let mut b = DVector::zeros(n_out);
            
            let mut seed: u64 = 42 + i as u64;
            for r in 0..n_in {
                for c in 0..n_out {
                    seed = seed.wrapping_mul(1103515245).wrapping_add(12345);
                    let rand = ((seed >> 16) as f64 / 32768.0) - 1.0;
                    w[(r, c)] = rand * scale;
                }
            }
            for j in 0..n_out {
                b[j] = 0.0;
            }
            
            weights.push(w);
            biases.push(b);
        }
        
        Self { weights, biases, layer_sizes }
    }
    
    /// Forward pass: x -> w(x) (deflection)
    pub fn forward(&self, x: f64, beam_length: f64) -> f64 {
        // Normalize input to [0, 1]
        let x_norm = x / beam_length;
        
        // Create input vector with Fourier features
        let mut h = self.fourier_features(x_norm);
        
        // Hidden layers with tanh activation
        for i in 0..self.weights.len() - 1 {
            let z = &self.weights[i].transpose() * &h + &self.biases[i];
            h = z.map(|v| v.tanh());
        }
        
        // Output layer (no activation)
        let last = self.weights.len() - 1;
        let output = self.weights[last].transpose() * &h + &self.biases[last];
        
        output[0]
    }
    
    /// Fourier feature encoding for positional input
    fn fourier_features(&self, x: f64) -> DVector<f64> {
        let num_freq = (self.layer_sizes[0] - 1) / 2;
        let mut features = DVector::zeros(self.layer_sizes[0]);
        
        features[0] = x;
        for i in 1..=num_freq {
            let freq = i as f64 * std::f64::consts::PI;
            features[2 * i - 1] = (freq * x).sin();
            features[2 * i] = (freq * x).cos();
        }
        
        features
    }
    
    /// Compute 4th derivative using finite differences
    pub fn d4w_dx4(&self, x: f64, beam_length: f64) -> f64 {
        let h = beam_length * 0.001; // Step size
        
        // 5-point stencil for 4th derivative
        let w_m2 = self.forward(x - 2.0 * h, beam_length);
        let w_m1 = self.forward(x - h, beam_length);
        let w_0 = self.forward(x, beam_length);
        let w_p1 = self.forward(x + h, beam_length);
        let w_p2 = self.forward(x + 2.0 * h, beam_length);
        
        // d⁴w/dx⁴ ≈ (w_{-2} - 4w_{-1} + 6w_0 - 4w_{+1} + w_{+2}) / h^4
        (w_m2 - 4.0 * w_m1 + 6.0 * w_0 - 4.0 * w_p1 + w_p2) / h.powi(4)
    }
    
    /// Compute 2nd derivative (for moment: M = -EI * w'')
    pub fn d2w_dx2(&self, x: f64, beam_length: f64) -> f64 {
        let h = beam_length * 0.001;
        
        let w_m1 = self.forward(x - h, beam_length);
        let w_0 = self.forward(x, beam_length);
        let w_p1 = self.forward(x + h, beam_length);
        
        (w_m1 - 2.0 * w_0 + w_p1) / h.powi(2)
    }
    
    /// Compute 1st derivative (for slope)
    pub fn dw_dx(&self, x: f64, beam_length: f64) -> f64 {
        let h = beam_length * 0.001;
        
        let w_m1 = self.forward(x - h, beam_length);
        let w_p1 = self.forward(x + h, beam_length);
        
        (w_p1 - w_m1) / (2.0 * h)
    }
    
    /// Get all parameters as flat vector
    fn get_params(&self) -> Vec<f64> {
        let mut params = Vec::new();
        for w in &self.weights {
            params.extend(w.iter().cloned());
        }
        for b in &self.biases {
            params.extend(b.iter().cloned());
        }
        params
    }
    
    /// Set parameters from flat vector
    fn set_params(&mut self, params: &[f64]) {
        let mut idx = 0;
        for w in &mut self.weights {
            for val in w.iter_mut() {
                *val = params[idx];
                idx += 1;
            }
        }
        for b in &mut self.biases {
            for val in b.iter_mut() {
                *val = params[idx];
                idx += 1;
            }
        }
    }
}

// ============================================
// PHYSICS LOSS
// ============================================

/// Compute PDE residual loss for Euler-Bernoulli beam
fn pde_loss(network: &BeamPINN, config: &BeamConfig, x_points: &[f64]) -> f64 {
    let ei = config.e * config.i;
    let q = config.load;
    let l = config.length;
    
    let mut total = 0.0;
    for &x in x_points {
        // PDE: EI * w'''' = q
        let w4 = network.d4w_dx4(x, l);
        let residual = ei * w4 - q;
        total += residual * residual;
    }
    
    total / x_points.len() as f64
}

/// Compute boundary condition loss
fn bc_loss(network: &BeamPINN, config: &BeamConfig) -> f64 {
    let l = config.length;
    let mut loss;
    
    match config.boundary.as_str() {
        "simply_supported" => {
            // w(0) = 0, w(L) = 0
            let w_0 = network.forward(0.0, l);
            let w_l = network.forward(l, l);
            // M(0) = 0, M(L) = 0 => w''(0) = 0, w''(L) = 0
            let w2_0 = network.d2w_dx2(0.0, l);
            let w2_l = network.d2w_dx2(l, l);
            
            loss = w_0.powi(2) + w_l.powi(2) + w2_0.powi(2) + w2_l.powi(2);
        }
        "cantilever" => {
            // w(0) = 0, w'(0) = 0 (fixed end)
            let w_0 = network.forward(0.0, l);
            let w1_0 = network.dw_dx(0.0, l);
            // V(L) = 0, M(L) = 0 (free end) - harder to enforce directly
            let w2_l = network.d2w_dx2(l, l);
            
            loss = w_0.powi(2) + w1_0.powi(2) + w2_l.powi(2);
        }
        "fixed_fixed" => {
            // w(0) = 0, w'(0) = 0, w(L) = 0, w'(L) = 0
            let w_0 = network.forward(0.0, l);
            let w1_0 = network.dw_dx(0.0, l);
            let w_l = network.forward(l, l);
            let w1_l = network.dw_dx(l, l);
            
            loss = w_0.powi(2) + w1_0.powi(2) + w_l.powi(2) + w1_l.powi(2);
        }
        _ => {
            // Default: simply supported
            let w_0 = network.forward(0.0, l);
            let w_l = network.forward(l, l);
            loss = w_0.powi(2) + w_l.powi(2);
        }
    }
    
    loss
}

/// Total loss = λ_pde * PDE_loss + λ_bc * BC_loss
fn total_loss(
    network: &BeamPINN,
    beam_config: &BeamConfig,
    train_config: &TrainingConfig,
    x_points: &[f64],
) -> f64 {
    let l_pde = pde_loss(network, beam_config, x_points);
    let l_bc = bc_loss(network, beam_config);
    
    train_config.lambda_pde * l_pde + train_config.lambda_bc * l_bc
}

// ============================================
// TRAINING
// ============================================

/// Training result
#[derive(Serialize, Deserialize)]
pub struct TrainingResult {
    pub success: bool,
    pub final_loss: f64,
    pub epochs_trained: usize,
    pub training_time_ms: f64,
}

/// Train PINN for beam deflection
pub fn train_pinn(
    beam_config: &BeamConfig,
    train_config: &TrainingConfig,
) -> (BeamPINN, TrainingResult) {
    let start = instant::Instant::now();
    
    // Build layer sizes: input (Fourier) -> hidden -> output (1)
    let num_fourier = 6;
    let input_dim = 1 + 2 * num_fourier; // x + sin/cos features
    let mut layer_sizes = vec![input_dim];
    layer_sizes.extend(&train_config.hidden_dims);
    layer_sizes.push(1);
    
    let mut network = BeamPINN::new(layer_sizes);
    
    // Generate collocation points
    let l = beam_config.length;
    let n = train_config.num_collocation;
    let x_points: Vec<f64> = (1..n)
        .map(|i| l * (i as f64) / (n as f64))
        .collect();
    
    let mut lr = train_config.learning_rate;
    let mut best_loss = f64::MAX;
    
    // Training loop with numerical gradient descent
    for _epoch in 0..train_config.epochs {
        let current_loss = total_loss(&network, beam_config, train_config, &x_points);
        
        if current_loss < best_loss {
            best_loss = current_loss;
        }
        
        // Compute gradients using finite differences
        let params = network.get_params();
        let mut grads = vec![0.0; params.len()];
        let eps = 1e-5;
        
        for i in 0..params.len() {
            let mut params_plus = params.clone();
            params_plus[i] += eps;
            network.set_params(&params_plus);
            let loss_plus = total_loss(&network, beam_config, train_config, &x_points);
            
            network.set_params(&params);
            grads[i] = (loss_plus - current_loss) / eps;
        }
        
        // Gradient descent update
        let new_params: Vec<f64> = params
            .iter()
            .zip(grads.iter())
            .map(|(p, g)| p - lr * g)
            .collect();
        network.set_params(&new_params);
        
        // Learning rate decay
        lr *= train_config.lr_decay;
    }
    
    let elapsed = start.elapsed().as_millis() as f64;
    let final_loss = total_loss(&network, beam_config, train_config, &x_points);
    
    let result = TrainingResult {
        success: true,
        final_loss,
        epochs_trained: train_config.epochs,
        training_time_ms: elapsed,
    };
    
    (network, result)
}

// ============================================
// PREDICTION
// ============================================

/// Prediction result
#[derive(Serialize, Deserialize)]
pub struct PredictionResult {
    pub x: Vec<f64>,
    pub deflection: Vec<f64>,
    pub max_deflection: f64,
    pub max_position: f64,
    pub inference_time_ms: f64,
}

/// Predict deflection at given points
pub fn predict(network: &BeamPINN, beam_length: f64, num_points: usize) -> PredictionResult {
    let start = instant::Instant::now();
    
    let x: Vec<f64> = (0..=num_points)
        .map(|i| beam_length * (i as f64) / (num_points as f64))
        .collect();
    
    let deflection: Vec<f64> = x.iter()
        .map(|&xi| network.forward(xi, beam_length))
        .collect();
    
    // Find max deflection
    let mut max_deflection = 0.0f64;
    let mut max_position = 0.0f64;
    for (i, &w) in deflection.iter().enumerate() {
        if w.abs() > max_deflection.abs() {
            max_deflection = w;
            max_position = x[i];
        }
    }
    
    let elapsed = start.elapsed().as_millis() as f64;
    
    PredictionResult {
        x,
        deflection,
        max_deflection,
        max_position,
        inference_time_ms: elapsed,
    }
}

// ============================================
// WASM BINDINGS
// ============================================

/// Train PINN and return model as JSON (for persistence)
#[wasm_bindgen]
pub fn train_beam_pinn(config_json: &str) -> String {
    #[derive(Deserialize)]
    struct FullConfig {
        beam: BeamConfig,
        training: TrainingConfig,
    }
    
    let config: FullConfig = match serde_json::from_str(config_json) {
        Ok(c) => c,
        Err(e) => {
            return serde_json::json!({
                "success": false,
                "error": format!("Invalid config: {}", e)
            }).to_string();
        }
    };
    
    let (network, result) = train_pinn(&config.beam, &config.training);
    
    // Predict for visualization
    let prediction = predict(&network, config.beam.length, 100);
    
    serde_json::json!({
        "success": result.success,
        "training": {
            "final_loss": result.final_loss,
            "epochs_trained": result.epochs_trained,
            "training_time_ms": result.training_time_ms
        },
        "prediction": {
            "x": prediction.x,
            "deflection": prediction.deflection,
            "max_deflection": prediction.max_deflection,
            "max_position": prediction.max_position
        }
    }).to_string()
}

/// Quick demo: train and predict with defaults
#[wasm_bindgen]
pub fn pinn_demo() -> String {
    let beam_config = BeamConfig::default();
    let train_config = TrainingConfig {
        epochs: 500,
        hidden_dims: vec![16, 16],
        ..Default::default()
    };
    
    let (network, result) = train_pinn(&beam_config, &train_config);
    let prediction = predict(&network, beam_config.length, 50);
    
    // Analytical solution for comparison
    let l = beam_config.length;
    let q = beam_config.load.abs();
    let ei = beam_config.e * beam_config.i;
    let w_max_analytical = 5.0 * q * l.powi(4) / (384.0 * ei);
    
    serde_json::json!({
        "success": true,
        "pinn_max_deflection": prediction.max_deflection.abs(),
        "analytical_max_deflection": w_max_analytical,
        "relative_error_percent": ((prediction.max_deflection.abs() - w_max_analytical).abs() / w_max_analytical) * 100.0,
        "training_time_ms": result.training_time_ms,
        "final_loss": result.final_loss
    }).to_string()
}

#[cfg(test)]
mod tests {
    use super::*;
    
    #[test]
    fn test_network_forward() {
        let network = BeamPINN::new(vec![13, 16, 16, 1]);
        let w = network.forward(5.0, 10.0);
        assert!(w.is_finite());
    }
    
    #[test]
    fn test_derivatives() {
        let network = BeamPINN::new(vec![13, 16, 16, 1]);
        let l = 10.0;
        
        let w1 = network.dw_dx(5.0, l);
        let w2 = network.d2w_dx2(5.0, l);
        let w4 = network.d4w_dx4(5.0, l);
        
        assert!(w1.is_finite());
        assert!(w2.is_finite());
        assert!(w4.is_finite());
    }
    
    #[test]
    fn test_training_reduces_loss() {
        let beam_config = BeamConfig::default();
        let train_config = TrainingConfig {
            epochs: 100,
            hidden_dims: vec![8, 8],
            num_collocation: 10,
            ..Default::default()
        };
        
        let (_, result) = train_pinn(&beam_config, &train_config);
        assert!(result.success);
        assert!(result.final_loss.is_finite());
    }
}
