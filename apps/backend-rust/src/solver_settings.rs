// ============================================
// SOLVER SETTINGS - Industry-Standard Configuration
// ============================================
// Provides configurable numerical tolerances, validation,
// and diagnostic output per NAFEMS recommendations

use serde::{Deserialize, Serialize};
use std::fmt;

/// Numerical solver settings with industry-standard defaults
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SolverSettings {
    /// Relative convergence tolerance (default: 1e-6)
    pub tolerance_relative: f64,
    /// Absolute convergence tolerance (default: 1e-12)
    pub tolerance_absolute: f64,
    /// Maximum iterations for iterative solvers (default: 100)
    pub max_iterations: usize,
    /// Characteristic length for geometric tolerance (model-dependent)
    pub characteristic_length: Option<f64>,
    /// Condition number warning threshold (default: 1e10)
    pub condition_warning_threshold: f64,
    /// Condition number error threshold (default: 1e14)
    pub condition_error_threshold: f64,
    /// Enable automatic scaling of stiffness matrix
    pub auto_scaling: bool,
    /// Enable equilibrium checking after solution
    pub check_equilibrium: bool,
    /// Equilibrium tolerance as fraction of max force (default: 0.001)
    pub equilibrium_tolerance: f64,
    /// Enable verbose diagnostic output
    pub verbose: bool,
    /// Zero-length element tolerance in mm (default: 1e-6)
    pub zero_length_tolerance: f64,
    /// Nearly parallel member angle tolerance in radians (default: 0.01)
    pub parallel_tolerance: f64,
    /// Floating node detection
    pub detect_floating_nodes: bool,
    /// Mechanism detection
    pub detect_mechanisms: bool,
}

impl Default for SolverSettings {
    fn default() -> Self {
        SolverSettings {
            tolerance_relative: 1e-6,
            tolerance_absolute: 1e-12,
            max_iterations: 100,
            characteristic_length: None,
            condition_warning_threshold: 1e10,
            condition_error_threshold: 1e14,
            auto_scaling: true,
            check_equilibrium: true,
            equilibrium_tolerance: 0.001,
            verbose: false,
            zero_length_tolerance: 1e-6,
            parallel_tolerance: 0.01, // ~0.57 degrees
            detect_floating_nodes: true,
            detect_mechanisms: true,
        }
    }
}

impl SolverSettings {
    /// High-precision settings for critical structures
    pub fn high_precision() -> Self {
        SolverSettings {
            tolerance_relative: 1e-10,
            tolerance_absolute: 1e-14,
            max_iterations: 500,
            condition_warning_threshold: 1e8,
            condition_error_threshold: 1e12,
            equilibrium_tolerance: 0.0001,
            verbose: true,
            ..Default::default()
        }
    }
    
    /// Fast settings for preliminary analysis
    pub fn fast() -> Self {
        SolverSettings {
            tolerance_relative: 1e-4,
            tolerance_absolute: 1e-10,
            max_iterations: 50,
            check_equilibrium: false,
            verbose: false,
            ..Default::default()
        }
    }
}

// ============================================
// STRUCTURED ERROR HANDLING
// ============================================

/// Error severity levels per industry practice
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum Severity {
    /// Informational - analysis continues
    Info,
    /// Warning - results may be affected
    Warning,
    /// Error - analysis cannot proceed
    Error,
    /// Fatal - unrecoverable system error  
    Fatal,
}

/// Structured error codes for diagnostics
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum ErrorCode {
    // Geometry errors (1xxx)
    E1001ZeroLengthElement,
    E1002CoincidentNodes,
    E1003ParallelMembers,
    E1004InvalidCoordinates,
    E1005NegativeArea,
    
    // Topology errors (2xxx)
    E2001FloatingNode,
    E2002DisconnectedStructure,
    E2003InsufficientSupports,
    E2004Mechanism,
    E2005OverConstrained,
    
    // Material errors (3xxx)
    E3001InvalidModulus,
    E3002NegativeProperty,
    E3003MaterialOutOfBounds,
    
    // Load errors (4xxx)
    E4001LoadOnFreeNode,
    E4002NoLoadsApplied,
    E4003LoadCombinationError,
    E4004UnbalancedLoad,
    
    // Numerical errors (5xxx)
    E5001SingularMatrix,
    E5002IllConditioned,
    E5003ConvergenceFailure,
    E5004NumericalInstability,
    E5005EquilibriumError,
    
    // Result warnings (6xxx)
    W6001LargeDisplacement,
    W6002HighStress,
    W6003NegativeReaction,
    W6004UnexpectedResult,
}

impl fmt::Display for ErrorCode {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            ErrorCode::E1001ZeroLengthElement => write!(f, "E1001"),
            ErrorCode::E1002CoincidentNodes => write!(f, "E1002"),
            ErrorCode::E1003ParallelMembers => write!(f, "E1003"),
            ErrorCode::E1004InvalidCoordinates => write!(f, "E1004"),
            ErrorCode::E1005NegativeArea => write!(f, "E1005"),
            ErrorCode::E2001FloatingNode => write!(f, "E2001"),
            ErrorCode::E2002DisconnectedStructure => write!(f, "E2002"),
            ErrorCode::E2003InsufficientSupports => write!(f, "E2003"),
            ErrorCode::E2004Mechanism => write!(f, "E2004"),
            ErrorCode::E2005OverConstrained => write!(f, "E2005"),
            ErrorCode::E3001InvalidModulus => write!(f, "E3001"),
            ErrorCode::E3002NegativeProperty => write!(f, "E3002"),
            ErrorCode::E3003MaterialOutOfBounds => write!(f, "E3003"),
            ErrorCode::E4001LoadOnFreeNode => write!(f, "E4001"),
            ErrorCode::E4002NoLoadsApplied => write!(f, "E4002"),
            ErrorCode::E4003LoadCombinationError => write!(f, "E4003"),
            ErrorCode::E4004UnbalancedLoad => write!(f, "E4004"),
            ErrorCode::E5001SingularMatrix => write!(f, "E5001"),
            ErrorCode::E5002IllConditioned => write!(f, "E5002"),
            ErrorCode::E5003ConvergenceFailure => write!(f, "E5003"),
            ErrorCode::E5004NumericalInstability => write!(f, "E5004"),
            ErrorCode::E5005EquilibriumError => write!(f, "E5005"),
            ErrorCode::W6001LargeDisplacement => write!(f, "W6001"),
            ErrorCode::W6002HighStress => write!(f, "W6002"),
            ErrorCode::W6003NegativeReaction => write!(f, "W6003"),
            ErrorCode::W6004UnexpectedResult => write!(f, "W6004"),
        }
    }
}

/// Suggested remediation action
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum Suggestion {
    CheckNodeCoordinates,
    MergeCoincidentNodes,
    AddSupports,
    CheckConnectivity,
    ReduceElementSize,
    IncreaseSection,
    CheckMaterial,
    ReviewLoads,
    UseIterativeRefinement,
    ScaleStiffnessMatrix,
    SimplifyModel,
    CheckBoundaryConditions,
}

impl fmt::Display for Suggestion {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Suggestion::CheckNodeCoordinates => write!(f, "Check node coordinates for errors"),
            Suggestion::MergeCoincidentNodes => write!(f, "Merge coincident nodes or adjust tolerance"),
            Suggestion::AddSupports => write!(f, "Add support conditions to stabilize structure"),
            Suggestion::CheckConnectivity => write!(f, "Verify all elements are connected"),
            Suggestion::ReduceElementSize => write!(f, "Use finer mesh for better accuracy"),
            Suggestion::IncreaseSection => write!(f, "Increase member section size"),
            Suggestion::CheckMaterial => write!(f, "Verify material properties are correct"),
            Suggestion::ReviewLoads => write!(f, "Review applied loads for correctness"),
            Suggestion::UseIterativeRefinement => write!(f, "Enable iterative refinement for precision"),
            Suggestion::ScaleStiffnessMatrix => write!(f, "Enable automatic scaling"),
            Suggestion::SimplifyModel => write!(f, "Simplify model geometry"),
            Suggestion::CheckBoundaryConditions => write!(f, "Review boundary conditions"),
        }
    }
}

/// Comprehensive analysis diagnostic
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AnalysisDiagnostic {
    pub code: ErrorCode,
    pub severity: Severity,
    pub message: String,
    pub location: Option<String>,  // e.g., "Element 5" or "Node 12"
    pub value: Option<f64>,        // Relevant numerical value
    pub threshold: Option<f64>,    // Threshold that was exceeded
    pub suggestion: Option<Suggestion>,
}

impl AnalysisDiagnostic {
    pub fn error(code: ErrorCode, message: impl Into<String>) -> Self {
        AnalysisDiagnostic {
            code,
            severity: Severity::Error,
            message: message.into(),
            location: None,
            value: None,
            threshold: None,
            suggestion: None,
        }
    }
    
    pub fn warning(code: ErrorCode, message: impl Into<String>) -> Self {
        AnalysisDiagnostic {
            code,
            severity: Severity::Warning,
            message: message.into(),
            location: None,
            value: None,
            threshold: None,
            suggestion: None,
        }
    }
    
    pub fn with_location(mut self, location: impl Into<String>) -> Self {
        self.location = Some(location.into());
        self
    }
    
    pub fn with_value(mut self, value: f64) -> Self {
        self.value = Some(value);
        self
    }
    
    pub fn with_threshold(mut self, threshold: f64) -> Self {
        self.threshold = Some(threshold);
        self
    }
    
    pub fn with_suggestion(mut self, suggestion: Suggestion) -> Self {
        self.suggestion = Some(suggestion);
        self
    }
}

impl fmt::Display for AnalysisDiagnostic {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        let severity_str = match self.severity {
            Severity::Info => "INFO",
            Severity::Warning => "WARNING",
            Severity::Error => "ERROR",
            Severity::Fatal => "FATAL",
        };
        
        write!(f, "[{}] {}: {}", self.code, severity_str, self.message)?;
        
        if let Some(ref loc) = self.location {
            write!(f, " at {}", loc)?;
        }
        
        if let Some(val) = self.value {
            if let Some(thresh) = self.threshold {
                write!(f, " (value: {:.6e}, threshold: {:.6e})", val, thresh)?;
            } else {
                write!(f, " (value: {:.6e})", val)?;
            }
        }
        
        if let Some(ref sug) = self.suggestion {
            write!(f, ". Suggestion: {}", sug)?;
        }
        
        Ok(())
    }
}

/// Collection of diagnostics from analysis
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct DiagnosticReport {
    pub diagnostics: Vec<AnalysisDiagnostic>,
    pub has_errors: bool,
    pub has_warnings: bool,
    pub condition_number: Option<f64>,
    pub max_displacement: Option<f64>,
    pub max_stress: Option<f64>,
    pub equilibrium_error: Option<f64>,
}

impl DiagnosticReport {
    pub fn new() -> Self {
        DiagnosticReport::default()
    }
    
    pub fn add(&mut self, diagnostic: AnalysisDiagnostic) {
        match diagnostic.severity {
            Severity::Error | Severity::Fatal => self.has_errors = true,
            Severity::Warning => self.has_warnings = true,
            _ => {}
        }
        self.diagnostics.push(diagnostic);
    }
    
    pub fn add_error(&mut self, code: ErrorCode, message: impl Into<String>) {
        self.add(AnalysisDiagnostic::error(code, message));
    }
    
    pub fn add_warning(&mut self, code: ErrorCode, message: impl Into<String>) {
        self.add(AnalysisDiagnostic::warning(code, message));
    }
    
    pub fn is_ok(&self) -> bool {
        !self.has_errors
    }
    
    pub fn errors(&self) -> Vec<&AnalysisDiagnostic> {
        self.diagnostics.iter()
            .filter(|d| matches!(d.severity, Severity::Error | Severity::Fatal))
            .collect()
    }
    
    pub fn warnings(&self) -> Vec<&AnalysisDiagnostic> {
        self.diagnostics.iter()
            .filter(|d| matches!(d.severity, Severity::Warning))
            .collect()
    }
    
    pub fn summary(&self) -> String {
        let errors = self.errors().len();
        let warnings = self.warnings().len();
        
        if errors == 0 && warnings == 0 {
            "Analysis completed successfully with no issues.".to_string()
        } else if errors == 0 {
            format!("Analysis completed with {} warning(s).", warnings)
        } else {
            format!("Analysis failed with {} error(s) and {} warning(s).", errors, warnings)
        }
    }
}

// ============================================
// INPUT VALIDATION
// ============================================

/// Pre-analysis input validation
pub fn validate_model_input(
    nodes: &[(String, f64, f64, f64)],  // (id, x, y, z)
    elements: &[(String, String, String)],  // (id, start_node, end_node)
    settings: &SolverSettings,
) -> DiagnosticReport {
    let mut report = DiagnosticReport::new();
    
    // Check for coincident nodes
    for i in 0..nodes.len() {
        for j in (i + 1)..nodes.len() {
            let (id_i, xi, yi, zi) = &nodes[i];
            let (id_j, xj, yj, zj) = &nodes[j];
            
            let dist = ((xj - xi).powi(2) + (yj - yi).powi(2) + (zj - zi).powi(2)).sqrt();
            
            if dist < settings.zero_length_tolerance {
                report.add(
                    AnalysisDiagnostic::error(
                        ErrorCode::E1002CoincidentNodes,
                        format!("Nodes {} and {} are coincident", id_i, id_j)
                    )
                    .with_value(dist)
                    .with_threshold(settings.zero_length_tolerance)
                    .with_suggestion(Suggestion::MergeCoincidentNodes)
                );
            }
        }
    }
    
    // Check for zero-length elements
    let node_map: std::collections::HashMap<&str, (f64, f64, f64)> = nodes.iter()
        .map(|(id, x, y, z)| (id.as_str(), (*x, *y, *z)))
        .collect();
    
    for (elem_id, start_id, end_id) in elements {
        if let (Some(&(x1, y1, z1)), Some(&(x2, y2, z2))) = 
            (node_map.get(start_id.as_str()), node_map.get(end_id.as_str())) 
        {
            let length = ((x2 - x1).powi(2) + (y2 - y1).powi(2) + (z2 - z1).powi(2)).sqrt();
            
            if length < settings.zero_length_tolerance {
                report.add(
                    AnalysisDiagnostic::error(
                        ErrorCode::E1001ZeroLengthElement,
                        format!("Element {} has zero or near-zero length", elem_id)
                    )
                    .with_location(format!("Element {}", elem_id))
                    .with_value(length)
                    .with_threshold(settings.zero_length_tolerance)
                    .with_suggestion(Suggestion::CheckNodeCoordinates)
                );
            }
        } else {
            report.add(
                AnalysisDiagnostic::error(
                    ErrorCode::E2001FloatingNode,
                    format!("Element {} references non-existent node(s)", elem_id)
                )
                .with_location(format!("Element {}", elem_id))
                .with_suggestion(Suggestion::CheckConnectivity)
            );
        }
    }
    
    // Check for disconnected nodes (nodes not referenced by any element)
    if settings.detect_floating_nodes {
        let mut referenced_nodes = std::collections::HashSet::new();
        for (_, start_id, end_id) in elements {
            referenced_nodes.insert(start_id.as_str());
            referenced_nodes.insert(end_id.as_str());
        }
        
        for (node_id, _, _, _) in nodes {
            if !referenced_nodes.contains(node_id.as_str()) {
                report.add(
                    AnalysisDiagnostic::warning(
                        ErrorCode::E2001FloatingNode,
                        format!("Node {} is not connected to any element", node_id)
                    )
                    .with_location(format!("Node {}", node_id))
                    .with_suggestion(Suggestion::CheckConnectivity)
                );
            }
        }
    }
    
    report
}

/// Check condition number and add diagnostics
pub fn check_condition_number(
    condition_number: f64,
    settings: &SolverSettings,
    report: &mut DiagnosticReport,
) -> bool {
    report.condition_number = Some(condition_number);
    
    if !condition_number.is_finite() {
        report.add(
            AnalysisDiagnostic::error(
                ErrorCode::E5001SingularMatrix,
                "Stiffness matrix is singular (infinite condition number)"
            )
            .with_value(condition_number)
            .with_suggestion(Suggestion::AddSupports)
        );
        return false;
    }
    
    if condition_number > settings.condition_error_threshold {
        report.add(
            AnalysisDiagnostic::error(
                ErrorCode::E5002IllConditioned,
                "Stiffness matrix is severely ill-conditioned"
            )
            .with_value(condition_number)
            .with_threshold(settings.condition_error_threshold)
            .with_suggestion(Suggestion::ScaleStiffnessMatrix)
        );
        return false;
    }
    
    if condition_number > settings.condition_warning_threshold {
        report.add(
            AnalysisDiagnostic::warning(
                ErrorCode::E5002IllConditioned,
                "Stiffness matrix is moderately ill-conditioned"
            )
            .with_value(condition_number)
            .with_threshold(settings.condition_warning_threshold)
            .with_suggestion(Suggestion::UseIterativeRefinement)
        );
    }
    
    true
}

/// Check equilibrium after solution
pub fn check_equilibrium(
    residual_norm: f64,
    force_norm: f64,
    settings: &SolverSettings,
    report: &mut DiagnosticReport,
) -> bool {
    if force_norm < 1e-20 {
        // No loads applied
        report.add(
            AnalysisDiagnostic::warning(
                ErrorCode::E4002NoLoadsApplied,
                "No significant loads applied to structure"
            )
            .with_suggestion(Suggestion::ReviewLoads)
        );
        return true;
    }
    
    let relative_error = residual_norm / force_norm;
    report.equilibrium_error = Some(relative_error);
    
    if relative_error > settings.equilibrium_tolerance {
        report.add(
            AnalysisDiagnostic::warning(
                ErrorCode::E5005EquilibriumError,
                "Equilibrium not satisfied within tolerance"
            )
            .with_value(relative_error)
            .with_threshold(settings.equilibrium_tolerance)
            .with_suggestion(Suggestion::UseIterativeRefinement)
        );
        return false;
    }
    
    true
}

#[cfg(test)]
mod tests {
    use super::*;
    
    #[test]
    fn test_default_settings() {
        let settings = SolverSettings::default();
        assert_eq!(settings.tolerance_relative, 1e-6);
        assert_eq!(settings.max_iterations, 100);
        assert!(settings.auto_scaling);
    }
    
    #[test]
    fn test_diagnostic_formatting() {
        let diag = AnalysisDiagnostic::error(
            ErrorCode::E1001ZeroLengthElement,
            "Element has zero length"
        )
        .with_location("Element 5")
        .with_value(1e-10)
        .with_threshold(1e-6)
        .with_suggestion(Suggestion::CheckNodeCoordinates);
        
        let formatted = format!("{}", diag);
        assert!(formatted.contains("E1001"));
        assert!(formatted.contains("ERROR"));
        assert!(formatted.contains("Element 5"));
    }
    
    #[test]
    fn test_validation_coincident_nodes() {
        let nodes = vec![
            ("N1".to_string(), 0.0, 0.0, 0.0),
            ("N2".to_string(), 0.0, 0.0, 0.0), // Coincident with N1
            ("N3".to_string(), 1.0, 0.0, 0.0),
        ];
        let elements = vec![
            ("E1".to_string(), "N1".to_string(), "N3".to_string()),
        ];
        
        let report = validate_model_input(&nodes, &elements, &SolverSettings::default());
        assert!(report.has_errors);
        assert!(report.errors().iter().any(|e| matches!(e.code, ErrorCode::E1002CoincidentNodes)));
    }
}
