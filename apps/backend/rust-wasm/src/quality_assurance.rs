//! Quality Assurance and Validation Module
//!
//! Automated QA/QC for structural models and analysis results.
//! Based on: ISO 9001, engineering best practices
//!
//! Features:
//! - Model validation
//! - Results verification
//! - Error detection
//! - Documentation compliance

use serde::{Deserialize, Serialize};
use std::collections::HashMap;

/// QA check severity
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum Severity {
    /// Information only
    Info,
    /// Warning - review recommended
    Warning,
    /// Error - must be addressed
    Error,
    /// Critical - analysis cannot proceed
    Critical,
}

/// QA check category
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum CheckCategory {
    /// Geometry checks
    Geometry,
    /// Material checks
    Material,
    /// Loading checks
    Loading,
    /// Boundary condition checks
    Boundary,
    /// Connectivity checks
    Connectivity,
    /// Results checks
    Results,
    /// Documentation checks
    Documentation,
    /// Code compliance
    CodeCompliance,
}

/// QA check result
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CheckResult {
    /// Check ID
    pub id: String,
    /// Check name
    pub name: String,
    /// Category
    pub category: CheckCategory,
    /// Severity
    pub severity: Severity,
    /// Passed
    pub passed: bool,
    /// Message
    pub message: String,
    /// Affected elements
    pub affected_elements: Vec<String>,
    /// Suggested action
    pub action: Option<String>,
}

/// Model validator
#[derive(Debug, Clone)]
pub struct ModelValidator {
    /// Check results
    pub results: Vec<CheckResult>,
    /// Checks to run
    pub enabled_checks: HashMap<String, bool>,
    /// Custom thresholds
    pub thresholds: QAThresholds,
}

/// QA thresholds
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct QAThresholds {
    /// Maximum aspect ratio for elements
    pub max_aspect_ratio: f64,
    /// Minimum element angle (degrees)
    pub min_element_angle: f64,
    /// Maximum deflection ratio (L/n)
    pub max_deflection_ratio: f64,
    /// Maximum stress ratio
    pub max_stress_ratio: f64,
    /// Minimum natural frequency (Hz)
    pub min_frequency: f64,
    /// Maximum inter-story drift
    pub max_drift: f64,
}

impl Default for QAThresholds {
    fn default() -> Self {
        Self {
            max_aspect_ratio: 10.0,
            min_element_angle: 15.0,
            max_deflection_ratio: 240.0, // L/240
            max_stress_ratio: 1.0,
            min_frequency: 0.5,
            max_drift: 0.02, // 2%
        }
    }
}

impl ModelValidator {
    /// Create new model validator
    pub fn new() -> Self {
        Self {
            results: Vec::new(),
            enabled_checks: HashMap::new(),
            thresholds: QAThresholds::default(),
        }
    }
    
    /// Enable/disable check
    pub fn set_check_enabled(&mut self, check_id: &str, enabled: bool) {
        self.enabled_checks.insert(check_id.to_string(), enabled);
    }
    
    /// Check if check is enabled
    pub fn is_check_enabled(&self, check_id: &str) -> bool {
        *self.enabled_checks.get(check_id).unwrap_or(&true)
    }
    
    /// Run all geometry checks
    pub fn check_geometry(&mut self, elements: &[GeometryElement]) {
        // Check aspect ratios
        for elem in elements {
            if elem.aspect_ratio > self.thresholds.max_aspect_ratio {
                self.results.push(CheckResult {
                    id: format!("GEO_AR_{}", elem.id),
                    name: "Element Aspect Ratio".to_string(),
                    category: CheckCategory::Geometry,
                    severity: Severity::Warning,
                    passed: false,
                    message: format!(
                        "Element {} has aspect ratio {:.1}, exceeds limit {:.1}",
                        elem.id, elem.aspect_ratio, self.thresholds.max_aspect_ratio
                    ),
                    affected_elements: vec![elem.id.clone()],
                    action: Some("Consider refining mesh or adjusting element dimensions".to_string()),
                });
            }
            
            if elem.min_angle < self.thresholds.min_element_angle {
                self.results.push(CheckResult {
                    id: format!("GEO_ANG_{}", elem.id),
                    name: "Element Minimum Angle".to_string(),
                    category: CheckCategory::Geometry,
                    severity: Severity::Warning,
                    passed: false,
                    message: format!(
                        "Element {} has minimum angle {:.1}°, below limit {:.1}°",
                        elem.id, elem.min_angle, self.thresholds.min_element_angle
                    ),
                    affected_elements: vec![elem.id.clone()],
                    action: Some("Improve mesh quality".to_string()),
                });
            }
        }
    }
    
    /// Run connectivity checks
    pub fn check_connectivity(&mut self, model: &ModelConnectivity) {
        // Check for disconnected nodes
        if !model.disconnected_nodes.is_empty() {
            self.results.push(CheckResult {
                id: "CON_DISC".to_string(),
                name: "Disconnected Nodes".to_string(),
                category: CheckCategory::Connectivity,
                severity: Severity::Error,
                passed: false,
                message: format!(
                    "{} nodes are not connected to any element",
                    model.disconnected_nodes.len()
                ),
                affected_elements: model.disconnected_nodes.clone(),
                action: Some("Remove or connect disconnected nodes".to_string()),
            });
        }
        
        // Check for duplicate nodes
        if !model.duplicate_nodes.is_empty() {
            self.results.push(CheckResult {
                id: "CON_DUP".to_string(),
                name: "Duplicate Nodes".to_string(),
                category: CheckCategory::Connectivity,
                severity: Severity::Warning,
                passed: false,
                message: format!(
                    "{} duplicate nodes found (within tolerance)",
                    model.duplicate_nodes.len()
                ),
                affected_elements: model.duplicate_nodes.iter()
                    .flat_map(|(a, b)| vec![a.clone(), b.clone()])
                    .collect(),
                action: Some("Merge duplicate nodes".to_string()),
            });
        }
        
        // Check stability
        if !model.is_stable {
            self.results.push(CheckResult {
                id: "CON_STAB".to_string(),
                name: "Model Stability".to_string(),
                category: CheckCategory::Connectivity,
                severity: Severity::Critical,
                passed: false,
                message: "Model is unstable - insufficient supports or connections".to_string(),
                affected_elements: vec![],
                action: Some("Add supports or fix connectivity".to_string()),
            });
        }
    }
    
    /// Run load checks
    pub fn check_loads(&mut self, loads: &LoadSummary) {
        // Check if loads are applied
        if loads.total_load_cases == 0 {
            self.results.push(CheckResult {
                id: "LD_NONE".to_string(),
                name: "No Load Cases".to_string(),
                category: CheckCategory::Loading,
                severity: Severity::Error,
                passed: false,
                message: "No load cases defined".to_string(),
                affected_elements: vec![],
                action: Some("Define at least one load case".to_string()),
            });
        }
        
        // Check equilibrium
        if !loads.is_in_equilibrium {
            self.results.push(CheckResult {
                id: "LD_EQ".to_string(),
                name: "Load Equilibrium".to_string(),
                category: CheckCategory::Loading,
                severity: Severity::Warning,
                passed: false,
                message: format!(
                    "Applied loads are not in equilibrium. Residual: {:.2} kN",
                    loads.equilibrium_residual
                ),
                affected_elements: vec![],
                action: Some("Verify load application and reactions".to_string()),
            });
        }
        
        // Check for zero gravity loads on floor structures
        if loads.has_floors && loads.total_gravity_load.abs() < 0.01 {
            self.results.push(CheckResult {
                id: "LD_GRAV".to_string(),
                name: "Missing Gravity Loads".to_string(),
                category: CheckCategory::Loading,
                severity: Severity::Warning,
                passed: false,
                message: "Floor structure has no gravity loads applied".to_string(),
                affected_elements: vec![],
                action: Some("Apply dead and live loads to floor elements".to_string()),
            });
        }
    }
    
    /// Run results checks
    pub fn check_results(&mut self, results: &AnalysisResults) {
        // Check deflection limits
        for (element, deflection) in &results.deflections {
            if let Some(span) = results.spans.get(element) {
                let ratio = span / deflection.abs().max(0.001);
                if ratio < self.thresholds.max_deflection_ratio {
                    self.results.push(CheckResult {
                        id: format!("RES_DEF_{}", element),
                        name: "Excessive Deflection".to_string(),
                        category: CheckCategory::Results,
                        severity: Severity::Warning,
                        passed: false,
                        message: format!(
                            "Element {} deflection ratio L/{:.0} exceeds limit L/{:.0}",
                            element, ratio, self.thresholds.max_deflection_ratio
                        ),
                        affected_elements: vec![element.clone()],
                        action: Some("Increase section size or add support".to_string()),
                    });
                }
            }
        }
        
        // Check stress ratios
        for (element, stress_ratio) in &results.stress_ratios {
            if *stress_ratio > self.thresholds.max_stress_ratio {
                let severity = if *stress_ratio > 1.2 {
                    Severity::Error
                } else {
                    Severity::Warning
                };
                
                self.results.push(CheckResult {
                    id: format!("RES_STR_{}", element),
                    name: "Stress Ratio Exceeded".to_string(),
                    category: CheckCategory::Results,
                    severity,
                    passed: false,
                    message: format!(
                        "Element {} stress ratio {:.2} exceeds limit {:.2}",
                        element, stress_ratio, self.thresholds.max_stress_ratio
                    ),
                    affected_elements: vec![element.clone()],
                    action: Some("Increase section capacity".to_string()),
                });
            }
        }
        
        // Check natural frequency
        if let Some(freq) = results.fundamental_frequency {
            if freq < self.thresholds.min_frequency {
                self.results.push(CheckResult {
                    id: "RES_FREQ".to_string(),
                    name: "Low Natural Frequency".to_string(),
                    category: CheckCategory::Results,
                    severity: Severity::Warning,
                    passed: false,
                    message: format!(
                        "Fundamental frequency {:.3} Hz below minimum {:.3} Hz",
                        freq, self.thresholds.min_frequency
                    ),
                    affected_elements: vec![],
                    action: Some("Review structure stiffness or mass distribution".to_string()),
                });
            }
        }
    }
    
    /// Generate summary
    pub fn summary(&self) -> QASummary {
        let total = self.results.len();
        let passed = self.results.iter().filter(|r| r.passed).count();
        let warnings = self.results.iter().filter(|r| r.severity == Severity::Warning && !r.passed).count();
        let errors = self.results.iter().filter(|r| r.severity == Severity::Error && !r.passed).count();
        let critical = self.results.iter().filter(|r| r.severity == Severity::Critical && !r.passed).count();
        
        QASummary {
            total_checks: total,
            passed,
            warnings,
            errors,
            critical,
            pass_rate: if total > 0 { passed as f64 / total as f64 * 100.0 } else { 100.0 },
        }
    }
    
    /// Get failed checks
    pub fn failed_checks(&self) -> Vec<&CheckResult> {
        self.results.iter().filter(|r| !r.passed).collect()
    }
    
    /// Get checks by category
    pub fn checks_by_category(&self, category: CheckCategory) -> Vec<&CheckResult> {
        self.results.iter().filter(|r| r.category == category).collect()
    }
    
    /// Clear results
    pub fn clear(&mut self) {
        self.results.clear();
    }
}

/// QA summary
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct QASummary {
    /// Total checks
    pub total_checks: usize,
    /// Passed checks
    pub passed: usize,
    /// Warnings
    pub warnings: usize,
    /// Errors
    pub errors: usize,
    /// Critical issues
    pub critical: usize,
    /// Pass rate percentage
    pub pass_rate: f64,
}

/// Geometry element for checking
#[derive(Debug, Clone)]
pub struct GeometryElement {
    /// Element ID
    pub id: String,
    /// Aspect ratio
    pub aspect_ratio: f64,
    /// Minimum angle (degrees)
    pub min_angle: f64,
    /// Element type
    pub element_type: String,
}

/// Model connectivity info
#[derive(Debug, Clone)]
pub struct ModelConnectivity {
    /// Disconnected nodes
    pub disconnected_nodes: Vec<String>,
    /// Duplicate nodes (pairs)
    pub duplicate_nodes: Vec<(String, String)>,
    /// Model is stable
    pub is_stable: bool,
}

/// Load summary
#[derive(Debug, Clone)]
pub struct LoadSummary {
    /// Total load cases
    pub total_load_cases: usize,
    /// Is in equilibrium
    pub is_in_equilibrium: bool,
    /// Equilibrium residual
    pub equilibrium_residual: f64,
    /// Has floor elements
    pub has_floors: bool,
    /// Total gravity load
    pub total_gravity_load: f64,
}

/// Analysis results for checking
#[derive(Debug, Clone)]
pub struct AnalysisResults {
    /// Deflections by element
    pub deflections: HashMap<String, f64>,
    /// Spans by element
    pub spans: HashMap<String, f64>,
    /// Stress ratios by element
    pub stress_ratios: HashMap<String, f64>,
    /// Fundamental frequency
    pub fundamental_frequency: Option<f64>,
}

/// Documentation checker
#[derive(Debug, Clone)]
pub struct DocumentationChecker {
    /// Required items
    pub required_items: Vec<String>,
    /// Provided items
    pub provided_items: HashMap<String, bool>,
}

impl DocumentationChecker {
    /// Create new documentation checker
    pub fn new() -> Self {
        Self {
            required_items: vec![
                "Project Title".to_string(),
                "Engineer Name".to_string(),
                "Date".to_string(),
                "Revision".to_string(),
                "Design Code".to_string(),
                "Material Properties".to_string(),
                "Load Combinations".to_string(),
            ],
            provided_items: HashMap::new(),
        }
    }
    
    /// Mark item as provided
    pub fn mark_provided(&mut self, item: &str) {
        self.provided_items.insert(item.to_string(), true);
    }
    
    /// Check completeness
    pub fn check(&self) -> Vec<CheckResult> {
        let mut results = Vec::new();
        
        for item in &self.required_items {
            let provided = self.provided_items.get(item).copied().unwrap_or(false);
            
            if !provided {
                results.push(CheckResult {
                    id: format!("DOC_{}", item.replace(' ', "_").to_uppercase()),
                    name: format!("Missing {}", item),
                    category: CheckCategory::Documentation,
                    severity: Severity::Warning,
                    passed: false,
                    message: format!("Required documentation item '{}' is missing", item),
                    affected_elements: vec![],
                    action: Some(format!("Provide {}", item)),
                });
            }
        }
        
        results
    }
    
    /// Get completion percentage
    pub fn completion(&self) -> f64 {
        if self.required_items.is_empty() {
            return 100.0;
        }
        
        let provided = self.required_items.iter()
            .filter(|item| self.provided_items.get(*item).copied().unwrap_or(false))
            .count();
        
        provided as f64 / self.required_items.len() as f64 * 100.0
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    
    #[test]
    fn test_model_validator() {
        let validator = ModelValidator::new();
        assert!(validator.results.is_empty());
    }
    
    #[test]
    fn test_geometry_check() {
        let mut validator = ModelValidator::new();
        validator.thresholds.max_aspect_ratio = 5.0;
        
        let elements = vec![
            GeometryElement {
                id: "E1".to_string(),
                aspect_ratio: 3.0,
                min_angle: 30.0,
                element_type: "beam".to_string(),
            },
            GeometryElement {
                id: "E2".to_string(),
                aspect_ratio: 8.0, // Exceeds limit
                min_angle: 45.0,
                element_type: "beam".to_string(),
            },
        ];
        
        validator.check_geometry(&elements);
        
        assert!(!validator.results.is_empty());
        assert!(validator.results.iter().any(|r| r.affected_elements.contains(&"E2".to_string())));
    }
    
    #[test]
    fn test_connectivity_check() {
        let mut validator = ModelValidator::new();
        
        let connectivity = ModelConnectivity {
            disconnected_nodes: vec!["N5".to_string(), "N6".to_string()],
            duplicate_nodes: vec![],
            is_stable: true,
        };
        
        validator.check_connectivity(&connectivity);
        
        assert!(validator.results.iter().any(|r| r.id == "CON_DISC"));
    }
    
    #[test]
    fn test_unstable_model() {
        let mut validator = ModelValidator::new();
        
        let connectivity = ModelConnectivity {
            disconnected_nodes: vec![],
            duplicate_nodes: vec![],
            is_stable: false,
        };
        
        validator.check_connectivity(&connectivity);
        
        let critical = validator.results.iter()
            .find(|r| r.severity == Severity::Critical);
        assert!(critical.is_some());
    }
    
    #[test]
    fn test_load_check() {
        let mut validator = ModelValidator::new();
        
        let loads = LoadSummary {
            total_load_cases: 0,
            is_in_equilibrium: true,
            equilibrium_residual: 0.0,
            has_floors: false,
            total_gravity_load: 0.0,
        };
        
        validator.check_loads(&loads);
        
        assert!(validator.results.iter().any(|r| r.id == "LD_NONE"));
    }
    
    #[test]
    fn test_results_check() {
        let mut validator = ModelValidator::new();
        validator.thresholds.max_stress_ratio = 1.0;
        
        let mut stress_ratios = HashMap::new();
        stress_ratios.insert("B1".to_string(), 1.15);
        
        let results = AnalysisResults {
            deflections: HashMap::new(),
            spans: HashMap::new(),
            stress_ratios,
            fundamental_frequency: Some(0.3),
        };
        
        validator.check_results(&results);
        
        // Should flag both stress ratio and frequency
        assert!(validator.results.len() >= 2);
    }
    
    #[test]
    fn test_summary() {
        let mut validator = ModelValidator::new();
        
        validator.results.push(CheckResult {
            id: "TEST1".to_string(),
            name: "Test 1".to_string(),
            category: CheckCategory::Geometry,
            severity: Severity::Info,
            passed: true,
            message: "OK".to_string(),
            affected_elements: vec![],
            action: None,
        });
        
        validator.results.push(CheckResult {
            id: "TEST2".to_string(),
            name: "Test 2".to_string(),
            category: CheckCategory::Geometry,
            severity: Severity::Warning,
            passed: false,
            message: "Warning".to_string(),
            affected_elements: vec![],
            action: None,
        });
        
        let summary = validator.summary();
        
        assert_eq!(summary.total_checks, 2);
        assert_eq!(summary.passed, 1);
        assert_eq!(summary.warnings, 1);
    }
    
    #[test]
    fn test_failed_checks() {
        let mut validator = ModelValidator::new();
        
        validator.results.push(CheckResult {
            id: "PASS".to_string(),
            name: "Passed".to_string(),
            category: CheckCategory::Geometry,
            severity: Severity::Info,
            passed: true,
            message: "OK".to_string(),
            affected_elements: vec![],
            action: None,
        });
        
        validator.results.push(CheckResult {
            id: "FAIL".to_string(),
            name: "Failed".to_string(),
            category: CheckCategory::Loading,
            severity: Severity::Error,
            passed: false,
            message: "Error".to_string(),
            affected_elements: vec![],
            action: None,
        });
        
        let failed = validator.failed_checks();
        
        assert_eq!(failed.len(), 1);
        assert_eq!(failed[0].id, "FAIL");
    }
    
    #[test]
    fn test_documentation_checker() {
        let mut checker = DocumentationChecker::new();
        
        assert!(checker.completion() < 100.0);
        
        checker.mark_provided("Project Title");
        checker.mark_provided("Engineer Name");
        
        assert!(checker.completion() > 0.0);
    }
    
    #[test]
    fn test_documentation_check() {
        let checker = DocumentationChecker::new();
        
        let results = checker.check();
        
        assert!(!results.is_empty());
        assert!(results.iter().all(|r| r.category == CheckCategory::Documentation));
    }
    
    #[test]
    fn test_thresholds() {
        let thresholds = QAThresholds::default();
        
        assert_eq!(thresholds.max_aspect_ratio, 10.0);
        assert_eq!(thresholds.max_deflection_ratio, 240.0);
    }
    
    #[test]
    fn test_check_enabled() {
        let mut validator = ModelValidator::new();
        
        assert!(validator.is_check_enabled("any_check"));
        
        validator.set_check_enabled("custom_check", false);
        assert!(!validator.is_check_enabled("custom_check"));
    }
    
    #[test]
    fn test_clear_results() {
        let mut validator = ModelValidator::new();
        
        validator.results.push(CheckResult {
            id: "TEST".to_string(),
            name: "Test".to_string(),
            category: CheckCategory::Geometry,
            severity: Severity::Info,
            passed: true,
            message: "OK".to_string(),
            affected_elements: vec![],
            action: None,
        });
        
        validator.clear();
        
        assert!(validator.results.is_empty());
    }
    
    #[test]
    fn test_checks_by_category() {
        let mut validator = ModelValidator::new();
        
        validator.results.push(CheckResult {
            id: "GEO1".to_string(),
            name: "Geo 1".to_string(),
            category: CheckCategory::Geometry,
            severity: Severity::Info,
            passed: true,
            message: "OK".to_string(),
            affected_elements: vec![],
            action: None,
        });
        
        validator.results.push(CheckResult {
            id: "LD1".to_string(),
            name: "Load 1".to_string(),
            category: CheckCategory::Loading,
            severity: Severity::Info,
            passed: true,
            message: "OK".to_string(),
            affected_elements: vec![],
            action: None,
        });
        
        let geo_checks = validator.checks_by_category(CheckCategory::Geometry);
        
        assert_eq!(geo_checks.len(), 1);
    }
}
