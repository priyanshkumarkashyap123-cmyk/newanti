use serde::{Deserialize, Serialize};
use std::collections::{HashMap, HashSet};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ValidationOutcome {
    pub passed: bool,
    pub utilization: f64,
    pub message: String,
    pub clause: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ValidationReport {
    pub total_checks: usize,
    pub passed: usize,
    pub warnings: usize,
    pub errors: usize,
    pub can_proceed: bool,
    pub messages: Vec<ValidationMessage>,
}

/// Comprehensive Input Validation System
/// Industry standard: SAP2000/ETABS model validation, ANSYS pre-check
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ModelValidator {
    pub warnings: Vec<ValidationMessage>,
    pub errors: Vec<ValidationMessage>,
    pub info: Vec<ValidationMessage>,
    pub checks_performed: usize,
    pub checks_passed: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ValidationMessage {
    pub code: String,
    pub severity: Severity,
    pub category: ValidationCategory,
    pub message: String,
    pub element_ids: Vec<usize>,
    pub suggestion: String,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq)]
pub enum Severity {
    Info,
    Warning,
    Error,
    Fatal,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq)]
pub enum ValidationCategory {
    Geometry,
    Connectivity,
    Material,
    Loads,
    Constraints,
    Numerical,
    Stability,
}

impl ModelValidator {
    /// Comprehensive input validation per SAP2000/ETABS-style precheck workflow.
    pub fn new() -> Self {
        ModelValidator {
            warnings: Vec::new(),
            errors: Vec::new(),
            info: Vec::new(),
            checks_performed: 0,
            checks_passed: 0,
        }
    }
    
    /// Check for coincident nodes
    pub fn check_coincident_nodes(&mut self, nodes: &[(usize, [f64; 3])], tolerance: f64) {
        self.checks_performed += 1;
        let mut coincident_pairs = Vec::new();
        
        for i in 0..nodes.len() {
            for j in (i + 1)..nodes.len() {
                let dx = nodes[i].1[0] - nodes[j].1[0];
                let dy = nodes[i].1[1] - nodes[j].1[1];
                let dz = nodes[i].1[2] - nodes[j].1[2];
                let dist = (dx * dx + dy * dy + dz * dz).sqrt();
                
                if dist < tolerance {
                    coincident_pairs.push((nodes[i].0, nodes[j].0));
                }
            }
        }
        
        if !coincident_pairs.is_empty() {
            self.warnings.push(ValidationMessage {
                code: "G001".to_string(),
                severity: Severity::Warning,
                category: ValidationCategory::Geometry,
                message: format!("{} pairs of coincident nodes found", coincident_pairs.len()),
                element_ids: coincident_pairs.iter().flat_map(|&(a, b)| vec![a, b]).collect(),
                suggestion: "Consider merging coincident nodes or increasing tolerance".to_string(),
            });
        } else {
            self.checks_passed += 1;
        }
    }
    
    /// Check for zero-length elements
    pub fn check_zero_length_elements(
        &mut self, 
        elements: &[(usize, usize, usize)],  // (id, node_i, node_j)
        nodes: &HashMap<usize, [f64; 3]>,
        tolerance: f64,
    ) {
        self.checks_performed += 1;
        let mut zero_length = Vec::new();
        
        for &(id, ni, nj) in elements {
            if let (Some(ci), Some(cj)) = (nodes.get(&ni), nodes.get(&nj)) {
                let dx = cj[0] - ci[0];
                let dy = cj[1] - ci[1];
                let dz = cj[2] - ci[2];
                let length = (dx * dx + dy * dy + dz * dz).sqrt();
                
                if length < tolerance {
                    zero_length.push(id);
                }
            }
        }
        
        if !zero_length.is_empty() {
            self.errors.push(ValidationMessage {
                code: "E001".to_string(),
                severity: Severity::Error,
                category: ValidationCategory::Geometry,
                message: format!("{} zero-length elements found", zero_length.len()),
                element_ids: zero_length,
                suggestion: "Remove zero-length elements or check node connectivity".to_string(),
            });
        } else {
            self.checks_passed += 1;
        }
    }
    
    /// Check for unreferenced nodes
    pub fn check_unreferenced_nodes(
        &mut self,
        all_nodes: &[usize],
        elements: &[(usize, usize, usize)],
    ) {
        self.checks_performed += 1;
        
        let mut referenced: HashSet<usize> = HashSet::new();
        for &(_, ni, nj) in elements {
            referenced.insert(ni);
            referenced.insert(nj);
        }
        
        let unreferenced: Vec<usize> = all_nodes.iter()
            .filter(|&&n| !referenced.contains(&n))
            .copied()
            .collect();
        
        if !unreferenced.is_empty() {
            self.warnings.push(ValidationMessage {
                code: "C001".to_string(),
                severity: Severity::Warning,
                category: ValidationCategory::Connectivity,
                message: format!("{} unreferenced nodes found", unreferenced.len()),
                element_ids: unreferenced,
                suggestion: "Remove unreferenced nodes or add missing elements".to_string(),
            });
        } else {
            self.checks_passed += 1;
        }
    }
    
    /// Check material property validity
    pub fn check_material_properties(
        &mut self,
        materials: &[(usize, f64, f64, f64)],  // (id, E, nu, rho)
    ) {
        self.checks_performed += 1;
        let mut invalid = Vec::new();
        
        for &(id, e, nu, rho) in materials {
            let mut issues = Vec::new();
            
            if e <= 0.0 {
                issues.push("E <= 0");
            }
            if nu < -1.0 || nu >= 0.5 {
                issues.push("Poisson's ratio out of range [-1, 0.5)");
            }
            if rho < 0.0 {
                issues.push("negative density");
            }
            
            if !issues.is_empty() {
                invalid.push(id);
            }
        }
        
        if !invalid.is_empty() {
            self.errors.push(ValidationMessage {
                code: "M001".to_string(),
                severity: Severity::Error,
                category: ValidationCategory::Material,
                message: format!("{} materials with invalid properties", invalid.len()),
                element_ids: invalid,
                suggestion: "Check E > 0, -1 <= ν < 0.5, ρ >= 0".to_string(),
            });
        } else {
            self.checks_passed += 1;
        }
    }
    
    /// Check for instability (insufficient restraints)
    pub fn check_stability(
        &mut self,
        num_free_dofs: usize,
        _num_equations: usize,
        stiffness_rank: usize,
    ) {
        self.checks_performed += 1;
        
        let deficiency = num_free_dofs.saturating_sub(stiffness_rank);
        
        if deficiency > 0 {
            self.errors.push(ValidationMessage {
                code: "S001".to_string(),
                severity: Severity::Fatal,
                category: ValidationCategory::Stability,
                message: format!("Structure is unstable: {} rigid body modes", deficiency),
                element_ids: vec![],
                suggestion: "Add supports or check connectivity. Model may have mechanisms.".to_string(),
            });
        } else {
            self.checks_passed += 1;
        }
    }
    
    /// Check matrix condition number
    pub fn check_condition_number(&mut self, condition: f64) {
        self.checks_performed += 1;
        
        const WARN_THRESHOLD: f64 = 1e10;
        const ERROR_THRESHOLD: f64 = 1e14;
        
        if condition >= ERROR_THRESHOLD {
            self.errors.push(ValidationMessage {
                code: "N001".to_string(),
                severity: Severity::Error,
                category: ValidationCategory::Numerical,
                message: format!("Extremely ill-conditioned matrix: κ = {:.2e}", condition),
                element_ids: vec![],
                suggestion: "Check for nearly singular supports, very stiff/soft elements, or unit inconsistencies".to_string(),
            });
        } else if condition >= WARN_THRESHOLD {
            self.warnings.push(ValidationMessage {
                code: "N002".to_string(),
                severity: Severity::Warning,
                category: ValidationCategory::Numerical,
                message: format!("Potentially ill-conditioned matrix: κ = {:.2e}", condition),
                element_ids: vec![],
                suggestion: "Results may have reduced accuracy. Consider model refinement.".to_string(),
            });
        } else {
            self.checks_passed += 1;
        }
    }
    
    /// Check load equilibrium
    pub fn check_load_equilibrium(
        &mut self,
        applied_forces: [f64; 6],   // Fx, Fy, Fz, Mx, My, Mz
        reactions: [f64; 6],
        tolerance_ratio: f64,
    ) {
        self.checks_performed += 1;
        
        let mut max_residual: f64 = 0.0;
        for i in 0..6 {
            let residual = (applied_forces[i] + reactions[i]).abs();
            let scale = applied_forces[i].abs().max(reactions[i].abs()).max(1.0);
            max_residual = max_residual.max(residual / scale);
        }
        
        if max_residual > tolerance_ratio {
            self.warnings.push(ValidationMessage {
                code: "L001".to_string(),
                severity: Severity::Warning,
                category: ValidationCategory::Loads,
                message: format!("Load-reaction equilibrium check failed: max residual = {:.2e}", max_residual),
                element_ids: vec![],
                suggestion: "Check that all loads and reactions are correctly applied".to_string(),
            });
        } else {
            self.checks_passed += 1;
        }
    }

    /// Return a compact validation outcome for downstream UI or API consumers.
    pub fn summarize_outcome(&self) -> ValidationOutcome {
        let utilization = if self.checks_performed > 0 {
            self.errors.len() as f64 / self.checks_performed as f64
        } else {
            0.0
        };
        let passed = self.errors.iter().all(|e| e.severity != Severity::Fatal);
        ValidationOutcome {
            passed,
            utilization,
            message: if passed {
                format!("Validation passed with {} warnings and {} errors", self.warnings.len(), self.errors.len())
            } else {
                format!("Validation failed with {} errors", self.errors.len())
            },
            clause: "SAP2000/ETABS pre-analysis validation workflow".to_string(),
        }
    }
    
    /// Generate validation report
    pub fn generate_report(&self) -> ValidationReport {
        ValidationReport {
            total_checks: self.checks_performed,
            passed: self.checks_passed,
            warnings: self.warnings.len(),
            errors: self.errors.len(),
            can_proceed: self.errors.iter().all(|e| e.severity != Severity::Fatal),
            messages: self.warnings.iter()
                .chain(self.errors.iter())
                .chain(self.info.iter())
                .cloned()
                .collect(),
        }
    }

    /// Return the most severe validation message, if any.
    pub fn top_issue(&self) -> Option<&ValidationMessage> {
        self.errors
            .iter()
            .chain(self.warnings.iter())
            .chain(self.info.iter())
            .max_by_key(|msg| severity_rank(msg.severity))
    }
}

fn severity_rank(severity: Severity) -> u8 {
    match severity {
        Severity::Info => 0,
        Severity::Warning => 1,
        Severity::Error => 2,
        Severity::Fatal => 3,
    }
}

impl Default for ModelValidator {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn summarize_outcome_passes_without_fatal_errors() {
        let mut validator = ModelValidator::new();
        validator.warnings.push(ValidationMessage {
            code: "W001".to_string(),
            severity: Severity::Warning,
            category: ValidationCategory::Numerical,
            message: "warning".to_string(),
            element_ids: vec![],
            suggestion: "none".to_string(),
        });
        let out = validator.summarize_outcome();
        assert!(out.passed);
    }

    #[test]
    fn summarize_outcome_fails_with_fatal_error() {
        let mut validator = ModelValidator::new();
        validator.checks_performed = 1;
        validator.errors.push(ValidationMessage {
            code: "S001".to_string(),
            severity: Severity::Fatal,
            category: ValidationCategory::Stability,
            message: "fatal".to_string(),
            element_ids: vec![],
            suggestion: "fix supports".to_string(),
        });
        let out = validator.summarize_outcome();
        assert!(!out.passed);
        assert!(out.utilization > 0.0);
    }
}

