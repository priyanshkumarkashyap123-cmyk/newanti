use serde::{Deserialize, Serialize};

/// Result of root-finding algorithm
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RootResult {
    pub root: f64,
    pub converged: bool,
    pub iterations: usize,
    pub function_value: f64,
    pub error_estimate: f64,
}

/// Result of numerical integration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct IntegrationResult {
    pub value: f64,
    pub error_estimate: f64,
    pub evaluations: usize,
    pub converged: bool,
}

/// Result of optimization
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OptimizationResult {
    pub x: f64,
    pub fx: f64,
    pub iterations: usize,
    pub converged: bool,
}

/// Result of ODE integration
#[derive(Debug, Clone)]
pub struct OdeResult {
    /// Time points
    pub t: Vec<f64>,
    /// Solution values at each time point (vector for systems)
    pub y: Vec<Vec<f64>>,
    /// Number of function evaluations
    pub evaluations: usize,
    /// Number of rejected steps (for adaptive methods)
    pub rejected_steps: usize,
}