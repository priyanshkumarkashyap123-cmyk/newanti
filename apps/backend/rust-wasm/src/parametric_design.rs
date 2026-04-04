//! Parametric Design Module
//!
//! Parametric modeling and generative design for structures.
//! Based on: Grasshopper/Dynamo concepts, computational design
//!
//! Features:
//! - Parameter-driven geometry
//! - Design space exploration
//! - Constraint-based design
//! - Sensitivity analysis

use serde::{Deserialize, Serialize};
use std::collections::HashMap;

/// Parameter type
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum ParameterType {
    /// Continuous value
    Continuous {
        min: f64,
        max: f64,
        step: Option<f64>,
    },
    /// Discrete set of values
    Discrete {
        values: Vec<f64>,
    },
    /// Integer range
    Integer {
        min: i64,
        max: i64,
    },
    /// Boolean
    Boolean,
    /// String selection
    Selection {
        options: Vec<String>,
    },
}

/// Design parameter
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DesignParameter {
    /// Parameter ID
    pub id: String,
    /// Parameter name
    pub name: String,
    /// Parameter type
    pub param_type: ParameterType,
    /// Current value
    pub value: ParameterValue,
    /// Unit
    pub unit: String,
    /// Description
    pub description: String,
    /// Locked (cannot be modified)
    pub locked: bool,
}

/// Parameter value
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum ParameterValue {
    Number(f64),
    Integer(i64),
    Boolean(bool),
    String(String),
}

impl ParameterValue {
    /// Get as f64
    pub fn as_f64(&self) -> Option<f64> {
        match self {
            ParameterValue::Number(v) => Some(*v),
            ParameterValue::Integer(v) => Some(*v as f64),
            _ => None,
        }
    }
    
    /// Get as string
    pub fn as_string(&self) -> String {
        match self {
            ParameterValue::Number(v) => format!("{}", v),
            ParameterValue::Integer(v) => format!("{}", v),
            ParameterValue::Boolean(v) => format!("{}", v),
            ParameterValue::String(v) => v.clone(),
        }
    }
}

impl DesignParameter {
    /// Create continuous parameter
    pub fn continuous(id: &str, name: &str, min: f64, max: f64, current: f64, unit: &str) -> Self {
        Self {
            id: id.to_string(),
            name: name.to_string(),
            param_type: ParameterType::Continuous { min, max, step: None },
            value: ParameterValue::Number(current),
            unit: unit.to_string(),
            description: String::new(),
            locked: false,
        }
    }
    
    /// Create integer parameter
    pub fn integer(id: &str, name: &str, min: i64, max: i64, current: i64) -> Self {
        Self {
            id: id.to_string(),
            name: name.to_string(),
            param_type: ParameterType::Integer { min, max },
            value: ParameterValue::Integer(current),
            unit: String::new(),
            description: String::new(),
            locked: false,
        }
    }
    
    /// Create selection parameter
    pub fn selection(id: &str, name: &str, options: Vec<String>, current: &str) -> Self {
        Self {
            id: id.to_string(),
            name: name.to_string(),
            param_type: ParameterType::Selection { options },
            value: ParameterValue::String(current.to_string()),
            unit: String::new(),
            description: String::new(),
            locked: false,
        }
    }
    
    /// Validate value against type
    pub fn validate(&self, value: &ParameterValue) -> bool {
        match (&self.param_type, value) {
            (ParameterType::Continuous { min, max, .. }, ParameterValue::Number(v)) => {
                *v >= *min && *v <= *max
            },
            (ParameterType::Integer { min, max }, ParameterValue::Integer(v)) => {
                *v >= *min && *v <= *max
            },
            (ParameterType::Boolean, ParameterValue::Boolean(_)) => true,
            (ParameterType::Selection { options }, ParameterValue::String(v)) => {
                options.contains(v)
            },
            (ParameterType::Discrete { values }, ParameterValue::Number(v)) => {
                values.iter().any(|x| (x - v).abs() < 1e-10)
            },
            _ => false,
        }
    }
}

/// Design constraint
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DesignConstraint {
    /// Constraint ID
    pub id: String,
    /// Constraint name
    pub name: String,
    /// Constraint type
    pub constraint_type: ConstraintType,
    /// Active
    pub active: bool,
    /// Weight (for soft constraints)
    pub weight: f64,
}

/// Constraint type
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum ConstraintType {
    /// Less than or equal
    LessThanOrEqual {
        expression: String,
        limit: f64,
    },
    /// Greater than or equal
    GreaterThanOrEqual {
        expression: String,
        limit: f64,
    },
    /// Equal
    Equal {
        expression: String,
        target: f64,
        tolerance: f64,
    },
    /// Range
    Range {
        expression: String,
        min: f64,
        max: f64,
    },
    /// Ratio constraint
    Ratio {
        numerator: String,
        denominator: String,
        min_ratio: f64,
        max_ratio: f64,
    },
}

/// Parametric model
#[derive(Debug, Clone)]
pub struct ParametricModel {
    /// Model ID
    pub id: String,
    /// Model name
    pub name: String,
    /// Parameters
    pub parameters: HashMap<String, DesignParameter>,
    /// Constraints
    pub constraints: Vec<DesignConstraint>,
    /// Relationships (parameter expressions)
    pub relationships: Vec<ParameterRelationship>,
    /// Output metrics
    pub outputs: HashMap<String, f64>,
}

/// Parameter relationship
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ParameterRelationship {
    /// Output parameter ID
    pub output: String,
    /// Expression
    pub expression: String,
    /// Input parameters
    pub inputs: Vec<String>,
}

impl ParametricModel {
    /// Create new parametric model
    pub fn new(id: &str, name: &str) -> Self {
        Self {
            id: id.to_string(),
            name: name.to_string(),
            parameters: HashMap::new(),
            constraints: Vec::new(),
            relationships: Vec::new(),
            outputs: HashMap::new(),
        }
    }
    
    /// Add parameter
    pub fn add_parameter(&mut self, param: DesignParameter) {
        self.parameters.insert(param.id.clone(), param);
    }
    
    /// Add constraint
    pub fn add_constraint(&mut self, constraint: DesignConstraint) {
        self.constraints.push(constraint);
    }
    
    /// Add relationship
    pub fn add_relationship(&mut self, relationship: ParameterRelationship) {
        self.relationships.push(relationship);
    }
    
    /// Get parameter value
    pub fn get_value(&self, param_id: &str) -> Option<f64> {
        self.parameters.get(param_id).and_then(|p| p.value.as_f64())
    }
    
    /// Set parameter value
    pub fn set_value(&mut self, param_id: &str, value: ParameterValue) -> bool {
        if let Some(param) = self.parameters.get_mut(param_id) {
            if param.locked {
                return false;
            }
            if param.validate(&value) {
                param.value = value;
                return true;
            }
        }
        false
    }
    
    /// Evaluate simple expression (basic arithmetic)
    pub fn evaluate_expression(&self, expr: &str) -> f64 {
        // Simplified expression evaluation
        // Replace parameter references with values
        let mut result = expr.to_string();
        
        for (id, param) in &self.parameters {
            let placeholder = format!("{{{}}}", id);
            if result.contains(&placeholder) {
                if let Some(val) = param.value.as_f64() {
                    result = result.replace(&placeholder, &format!("{}", val));
                }
            }
        }
        
        // Try to parse as simple number
        result.parse::<f64>().unwrap_or(0.0)
    }
    
    /// Check all constraints
    pub fn check_constraints(&self) -> Vec<ConstraintResult> {
        let mut results = Vec::new();
        
        for constraint in &self.constraints {
            if !constraint.active {
                continue;
            }
            
            let result = match &constraint.constraint_type {
                ConstraintType::LessThanOrEqual { expression, limit } => {
                    let value = self.evaluate_expression(expression);
                    ConstraintResult {
                        constraint_id: constraint.id.clone(),
                        satisfied: value <= *limit,
                        value,
                        limit: *limit,
                        margin: *limit - value,
                    }
                },
                ConstraintType::GreaterThanOrEqual { expression, limit } => {
                    let value = self.evaluate_expression(expression);
                    ConstraintResult {
                        constraint_id: constraint.id.clone(),
                        satisfied: value >= *limit,
                        value,
                        limit: *limit,
                        margin: value - *limit,
                    }
                },
                ConstraintType::Range { expression, min, max } => {
                    let value = self.evaluate_expression(expression);
                    ConstraintResult {
                        constraint_id: constraint.id.clone(),
                        satisfied: value >= *min && value <= *max,
                        value,
                        limit: (*min + *max) / 2.0,
                        margin: (value - *min).min(*max - value),
                    }
                },
                _ => ConstraintResult {
                    constraint_id: constraint.id.clone(),
                    satisfied: true,
                    value: 0.0,
                    limit: 0.0,
                    margin: 0.0,
                },
            };
            
            results.push(result);
        }
        
        results
    }
}

/// Constraint check result
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConstraintResult {
    /// Constraint ID
    pub constraint_id: String,
    /// Satisfied
    pub satisfied: bool,
    /// Current value
    pub value: f64,
    /// Limit value
    pub limit: f64,
    /// Safety margin
    pub margin: f64,
}

/// Design space explorer
#[derive(Debug, Clone)]
pub struct DesignSpaceExplorer {
    /// Model
    pub model: ParametricModel,
    /// Explored designs
    pub designs: Vec<DesignPoint>,
    /// Sampling method
    pub sampling_method: SamplingMethod,
}

/// Sampling method
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum SamplingMethod {
    /// Grid sampling
    Grid,
    /// Random sampling
    Random,
    /// Latin Hypercube
    LatinHypercube,
    /// Sobol sequence
    Sobol,
}

/// Design point
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DesignPoint {
    /// Design ID
    pub id: String,
    /// Parameter values
    pub parameters: HashMap<String, f64>,
    /// Output values
    pub outputs: HashMap<String, f64>,
    /// Feasible
    pub feasible: bool,
    /// Objective value
    pub objective: f64,
}

impl DesignSpaceExplorer {
    /// Create new explorer
    pub fn new(model: ParametricModel, sampling_method: SamplingMethod) -> Self {
        Self {
            model,
            designs: Vec::new(),
            sampling_method,
        }
    }
    
    /// Generate design samples
    pub fn generate_samples(&mut self, n_samples: usize) {
        self.designs.clear();
        
        match self.sampling_method {
            SamplingMethod::Grid => self.generate_grid_samples(n_samples),
            SamplingMethod::Random => self.generate_random_samples(n_samples),
            SamplingMethod::LatinHypercube => self.generate_lhs_samples(n_samples),
            SamplingMethod::Sobol => self.generate_sobol_samples(n_samples),
        }
    }
    
    fn generate_grid_samples(&mut self, n_samples: usize) {
        // Simple grid for 1D case
        let continuous_params: Vec<_> = self.model.parameters.iter()
            .filter(|(_, p)| matches!(p.param_type, ParameterType::Continuous { .. }))
            .collect();
        
        if continuous_params.is_empty() {
            return;
        }
        
        let (id, param) = &continuous_params[0];
        if let ParameterType::Continuous { min, max, .. } = &param.param_type {
            let step = (max - min) / (n_samples - 1).max(1) as f64;
            
            for i in 0..n_samples {
                let value = min + step * i as f64;
                let mut params = HashMap::new();
                params.insert((*id).clone(), value);
                
                self.designs.push(DesignPoint {
                    id: format!("design_{}", i),
                    parameters: params,
                    outputs: HashMap::new(),
                    feasible: true,
                    objective: 0.0,
                });
            }
        }
    }
    
    fn generate_random_samples(&mut self, n_samples: usize) {
        // Simple pseudo-random using linear congruential generator
        let mut seed = 12345u64;
        
        for i in 0..n_samples {
            let mut params = HashMap::new();
            
            for (id, param) in &self.model.parameters {
                if let ParameterType::Continuous { min, max, .. } = &param.param_type {
                    seed = seed.wrapping_mul(1103515245).wrapping_add(12345);
                    let r = (seed % 10000) as f64 / 10000.0;
                    let value = min + r * (max - min);
                    params.insert(id.clone(), value);
                }
            }
            
            self.designs.push(DesignPoint {
                id: format!("design_{}", i),
                parameters: params,
                outputs: HashMap::new(),
                feasible: true,
                objective: 0.0,
            });
        }
    }
    
    fn generate_lhs_samples(&mut self, n_samples: usize) {
        // Simplified Latin Hypercube
        for i in 0..n_samples {
            let mut params = HashMap::new();
            
            for (id, param) in &self.model.parameters {
                if let ParameterType::Continuous { min, max, .. } = &param.param_type {
                    // Divide range into n_samples intervals
                    let interval_size = (max - min) / n_samples as f64;
                    let interval_start = min + interval_size * i as f64;
                    let value = interval_start + interval_size * 0.5; // Center of interval
                    params.insert(id.clone(), value);
                }
            }
            
            self.designs.push(DesignPoint {
                id: format!("design_{}", i),
                parameters: params,
                outputs: HashMap::new(),
                feasible: true,
                objective: 0.0,
            });
        }
    }
    
    fn generate_sobol_samples(&mut self, n_samples: usize) {
        // Simplified - use van der Corput sequence
        for i in 0..n_samples {
            let mut params = HashMap::new();
            let vdc = Self::van_der_corput(i, 2);
            
            for (id, param) in &self.model.parameters {
                if let ParameterType::Continuous { min, max, .. } = &param.param_type {
                    let value = min + vdc * (max - min);
                    params.insert(id.clone(), value);
                }
            }
            
            self.designs.push(DesignPoint {
                id: format!("design_{}", i),
                parameters: params,
                outputs: HashMap::new(),
                feasible: true,
                objective: 0.0,
            });
        }
    }
    
    fn van_der_corput(mut n: usize, base: usize) -> f64 {
        let mut result = 0.0;
        let mut denom = 1.0;
        
        while n > 0 {
            denom *= base as f64;
            result += (n % base) as f64 / denom;
            n /= base;
        }
        
        result
    }
    
    /// Get feasible designs
    pub fn feasible_designs(&self) -> Vec<&DesignPoint> {
        self.designs.iter().filter(|d| d.feasible).collect()
    }
    
    /// Get best design (by objective)
    pub fn best_design(&self) -> Option<&DesignPoint> {
        self.designs.iter()
            .filter(|d| d.feasible)
            .min_by(|a, b| a.objective.partial_cmp(&b.objective).unwrap_or(std::cmp::Ordering::Equal))
    }
}

/// Sensitivity analysis
#[derive(Debug, Clone)]
pub struct SensitivityAnalysis {
    /// Parameter sensitivities
    pub sensitivities: HashMap<String, f64>,
    /// Output name
    pub output: String,
}

impl SensitivityAnalysis {
    /// Create new sensitivity analysis
    pub fn new(output: &str) -> Self {
        Self {
            sensitivities: HashMap::new(),
            output: output.to_string(),
        }
    }
    
    /// Calculate one-at-a-time sensitivity
    pub fn calculate_oat(&mut self, model: &ParametricModel, delta: f64) {
        let base_output = model.outputs.get(&self.output).copied().unwrap_or(0.0);
        
        for (param_id, param) in &model.parameters {
            if param.locked {
                continue;
            }
            
            if let Some(base_value) = param.value.as_f64() {
                // Calculate central difference
                let sensitivity = if let ParameterType::Continuous { min, max, .. } = &param.param_type {
                    let range = max - min;
                    let step = range * delta;
                    
                    // Approximate derivative
                    (base_output * step) / (range * base_value.max(1e-10))
                } else {
                    0.0
                };
                
                self.sensitivities.insert(param_id.clone(), sensitivity.abs());
            }
        }
    }
    
    /// Get most sensitive parameters
    pub fn most_sensitive(&self, n: usize) -> Vec<(&String, &f64)> {
        let mut sorted: Vec<_> = self.sensitivities.iter().collect();
        sorted.sort_by(|a, b| b.1.partial_cmp(a.1).unwrap_or(std::cmp::Ordering::Equal));
        sorted.into_iter().take(n).collect()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    
    #[test]
    fn test_design_parameter() {
        let param = DesignParameter::continuous("span", "Span Length", 5.0, 15.0, 10.0, "m");
        
        assert_eq!(param.id, "span");
        assert!(param.value.as_f64().unwrap() - 10.0 < 0.001);
    }
    
    #[test]
    fn test_parameter_validation() {
        let param = DesignParameter::continuous("width", "Width", 0.0, 100.0, 50.0, "mm");
        
        assert!(param.validate(&ParameterValue::Number(75.0)));
        assert!(!param.validate(&ParameterValue::Number(150.0)));
    }
    
    #[test]
    fn test_parametric_model() {
        let mut model = ParametricModel::new("model1", "Test Model");
        
        model.add_parameter(DesignParameter::continuous("L", "Length", 5.0, 20.0, 10.0, "m"));
        model.add_parameter(DesignParameter::continuous("W", "Width", 0.3, 1.0, 0.5, "m"));
        
        assert_eq!(model.parameters.len(), 2);
        assert_eq!(model.get_value("L"), Some(10.0));
    }
    
    #[test]
    fn test_set_parameter_value() {
        let mut model = ParametricModel::new("m1", "M1");
        model.add_parameter(DesignParameter::continuous("x", "X", 0.0, 100.0, 50.0, ""));
        
        let success = model.set_value("x", ParameterValue::Number(75.0));
        assert!(success);
        assert_eq!(model.get_value("x"), Some(75.0));
    }
    
    #[test]
    fn test_locked_parameter() {
        let mut model = ParametricModel::new("m1", "M1");
        let mut param = DesignParameter::continuous("x", "X", 0.0, 100.0, 50.0, "");
        param.locked = true;
        model.add_parameter(param);
        
        let success = model.set_value("x", ParameterValue::Number(75.0));
        assert!(!success);
    }
    
    #[test]
    fn test_constraint_check() {
        let mut model = ParametricModel::new("m1", "M1");
        model.add_parameter(DesignParameter::continuous("x", "X", 0.0, 100.0, 50.0, ""));
        
        model.add_constraint(DesignConstraint {
            id: "c1".to_string(),
            name: "Limit".to_string(),
            constraint_type: ConstraintType::LessThanOrEqual {
                expression: "{x}".to_string(),
                limit: 60.0,
            },
            active: true,
            weight: 1.0,
        });
        
        let results = model.check_constraints();
        assert_eq!(results.len(), 1);
        assert!(results[0].satisfied);
    }
    
    #[test]
    fn test_design_space_explorer() {
        let model = ParametricModel::new("m1", "M1");
        let mut explorer = DesignSpaceExplorer::new(model, SamplingMethod::Random);
        
        explorer.model.add_parameter(
            DesignParameter::continuous("x", "X", 0.0, 10.0, 5.0, "")
        );
        
        explorer.generate_samples(10);
        
        assert_eq!(explorer.designs.len(), 10);
    }
    
    #[test]
    fn test_grid_sampling() {
        let mut model = ParametricModel::new("m1", "M1");
        model.add_parameter(DesignParameter::continuous("x", "X", 0.0, 10.0, 5.0, ""));
        
        let mut explorer = DesignSpaceExplorer::new(model, SamplingMethod::Grid);
        explorer.generate_samples(5);
        
        assert_eq!(explorer.designs.len(), 5);
        
        // Check first and last values
        let first = explorer.designs[0].parameters.get("x").unwrap();
        let last = explorer.designs[4].parameters.get("x").unwrap();
        
        assert!((first - 0.0).abs() < 0.01);
        assert!((last - 10.0).abs() < 0.01);
    }
    
    #[test]
    fn test_lhs_sampling() {
        let mut model = ParametricModel::new("m1", "M1");
        model.add_parameter(DesignParameter::continuous("x", "X", 0.0, 100.0, 50.0, ""));
        
        let mut explorer = DesignSpaceExplorer::new(model, SamplingMethod::LatinHypercube);
        explorer.generate_samples(10);
        
        assert_eq!(explorer.designs.len(), 10);
    }
    
    #[test]
    fn test_sensitivity_analysis() {
        let mut model = ParametricModel::new("m1", "M1");
        model.add_parameter(DesignParameter::continuous("x", "X", 0.0, 100.0, 50.0, ""));
        model.outputs.insert("output".to_string(), 100.0);
        
        let mut sensitivity = SensitivityAnalysis::new("output");
        sensitivity.calculate_oat(&model, 0.01);
        
        assert!(!sensitivity.sensitivities.is_empty());
    }
    
    #[test]
    fn test_integer_parameter() {
        let param = DesignParameter::integer("n", "Count", 1, 10, 5);
        
        assert!(param.validate(&ParameterValue::Integer(7)));
        assert!(!param.validate(&ParameterValue::Integer(15)));
    }
    
    #[test]
    fn test_selection_parameter() {
        let param = DesignParameter::selection(
            "grade",
            "Steel Grade",
            vec!["Fe250".to_string(), "Fe415".to_string(), "Fe500".to_string()],
            "Fe415",
        );
        
        assert!(param.validate(&ParameterValue::String("Fe500".to_string())));
        assert!(!param.validate(&ParameterValue::String("Fe600".to_string())));
    }
    
    #[test]
    fn test_van_der_corput() {
        let vdc0 = DesignSpaceExplorer::van_der_corput(0, 2);
        let vdc1 = DesignSpaceExplorer::van_der_corput(1, 2);
        
        assert_eq!(vdc0, 0.0);
        assert_eq!(vdc1, 0.5);
    }
    
    #[test]
    fn test_parameter_value_string() {
        let num = ParameterValue::Number(3.14);
        let int = ParameterValue::Integer(42);
        let bool_val = ParameterValue::Boolean(true);
        
        assert!(num.as_string().contains("3.14"));
        assert_eq!(int.as_string(), "42");
        assert_eq!(bool_val.as_string(), "true");
    }
}
