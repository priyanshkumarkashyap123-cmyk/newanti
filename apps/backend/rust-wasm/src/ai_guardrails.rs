// ============================================================================
// AI GUARDRAILS AND SAFETY FRAMEWORK
// ============================================================================
//
// P2 REQUIREMENT: AI Guardrails
//
// Features:
// - Clause citation requirements for AI suggestions
// - Confidence tagging (high/medium/low)
// - Domain validation (block unvalidated domains)
// - Engineering limits checking
// - Hallucination detection
// - Audit trail for AI decisions
//
// Industry Standard: Responsible AI principles
// ============================================================================

use serde::{Deserialize, Serialize};
use std::collections::{HashMap, HashSet};

// ============================================================================
// CONFIDENCE CLASSIFICATION
// ============================================================================

/// Confidence level for AI-generated recommendations
#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Hash, Serialize, Deserialize)]
pub enum ConfidenceLevel {
    /// Fully validated, code-backed calculation
    VeryHigh,
    /// Standard case with high validation coverage
    High,
    /// Reasonable inference with some validation
    Medium,
    /// Limited validation, user verification required
    Low,
    /// Experimental/unvalidated, expert review mandatory
    VeryLow,
}

impl ConfidenceLevel {
    pub fn to_percentage(&self) -> u8 {
        match self {
            ConfidenceLevel::VeryHigh => 95,
            ConfidenceLevel::High => 85,
            ConfidenceLevel::Medium => 70,
            ConfidenceLevel::Low => 50,
            ConfidenceLevel::VeryLow => 25,
        }
    }

    pub fn requires_expert_review(&self) -> bool {
        matches!(self, ConfidenceLevel::Low | ConfidenceLevel::VeryLow)
    }

    pub fn color_code(&self) -> &'static str {
        match self {
            ConfidenceLevel::VeryHigh => "green",
            ConfidenceLevel::High => "green",
            ConfidenceLevel::Medium => "yellow",
            ConfidenceLevel::Low => "orange",
            ConfidenceLevel::VeryLow => "red",
        }
    }
}

// ============================================================================
// AI SUGGESTION FRAMEWORK
// ============================================================================

/// AI-generated engineering suggestion with guardrails
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AiSuggestion {
    /// Unique suggestion ID
    pub id: String,
    /// Suggestion type
    pub suggestion_type: SuggestionType,
    /// The actual suggestion content
    pub content: SuggestionContent,
    /// Confidence assessment
    pub confidence: ConfidenceAssessment,
    /// Code citations supporting this suggestion
    pub citations: Vec<CodeCitation>,
    /// Domain validation status
    pub domain_validation: DomainValidation,
    /// Limitations and caveats
    pub limitations: Vec<String>,
    /// Required user actions
    pub required_actions: Vec<RequiredAction>,
    /// Timestamp
    pub timestamp: String,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum SuggestionType {
    DesignRecommendation,
    SectionSelection,
    LoadEstimation,
    CodeInterpretation,
    OptimizationHint,
    SafetyWarning,
    AlternativeDesign,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum SuggestionContent {
    Text(String),
    NumericValue { value: f64, unit: String, context: String },
    SectionChoice { recommended: String, alternatives: Vec<String>, rationale: String },
    LoadValue { value: f64, unit: String, basis: String },
    DesignParameters(HashMap<String, f64>),
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConfidenceAssessment {
    pub level: ConfidenceLevel,
    pub score: f64,
    pub factors: Vec<ConfidenceFactor>,
    pub reasoning: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConfidenceFactor {
    pub name: String,
    pub weight: f64,
    pub score: f64,
    pub description: String,
}

// ============================================================================
// CODE CITATION REQUIREMENTS
// ============================================================================

/// Citation to a design code clause
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CodeCitation {
    /// Design code identifier
    pub code: DesignCode,
    /// Clause/section number
    pub clause: String,
    /// Clause title
    pub title: String,
    /// Relevant excerpt (abbreviated)
    pub excerpt: String,
    /// Page number if applicable
    pub page: Option<String>,
    /// Verification status
    pub verified: bool,
    /// Citation type
    pub citation_type: CitationType,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[allow(non_camel_case_types)]
pub enum DesignCode {
    // Indian Codes
    IS456_2000,
    IS800_2007,
    IS1893_2016,
    IS13920_2016,
    IS875_Part1,
    IS875_Part2,
    IS875_Part3,
    IS875_Part5,
    
    // US Codes
    AISC360_22,
    ACI318_19,
    ASCE7_22,
    IBC2021,
    
    // Eurocode
    EN1990,
    EN1991,
    EN1992,
    EN1993,
    EN1994,
    EN1997,
    EN1998,
    
    // British Standards
    BS5950,
    BS8110,
    
    // Other
    NBC2016,
    Custom(u32),
}

impl DesignCode {
    pub fn display_name(&self) -> &'static str {
        match self {
            DesignCode::IS456_2000 => "IS 456:2000",
            DesignCode::IS800_2007 => "IS 800:2007",
            DesignCode::IS1893_2016 => "IS 1893:2016",
            DesignCode::IS13920_2016 => "IS 13920:2016",
            DesignCode::IS875_Part1 => "IS 875 Part 1",
            DesignCode::IS875_Part2 => "IS 875 Part 2",
            DesignCode::IS875_Part3 => "IS 875 Part 3",
            DesignCode::IS875_Part5 => "IS 875 Part 5",
            DesignCode::AISC360_22 => "AISC 360-22",
            DesignCode::ACI318_19 => "ACI 318-19",
            DesignCode::ASCE7_22 => "ASCE 7-22",
            DesignCode::IBC2021 => "IBC 2021",
            DesignCode::EN1990 => "EN 1990",
            DesignCode::EN1991 => "EN 1991",
            DesignCode::EN1992 => "EN 1992",
            DesignCode::EN1993 => "EN 1993",
            DesignCode::EN1994 => "EN 1994",
            DesignCode::EN1997 => "EN 1997",
            DesignCode::EN1998 => "EN 1998",
            DesignCode::BS5950 => "BS 5950",
            DesignCode::BS8110 => "BS 8110",
            DesignCode::NBC2016 => "NBC 2016",
            DesignCode::Custom(_) => "Custom Code",
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum CitationType {
    /// Direct requirement from code
    Mandatory,
    /// Recommended practice
    Guidance,
    /// Commentary/explanation
    Commentary,
    /// Reference to another document
    Reference,
}

// ============================================================================
// DOMAIN VALIDATION
// ============================================================================

/// Domain validation for AI suggestions
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DomainValidation {
    /// Domain category
    pub domain: EngineeringDomain,
    /// Whether this domain is validated in the software
    pub is_validated: bool,
    /// Validation coverage percentage
    pub coverage: f64,
    /// Known limitations
    pub limitations: Vec<String>,
    /// Blocked operations in this domain
    pub blocked_operations: Vec<String>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub enum EngineeringDomain {
    // Validated domains
    SteelDesign,
    ConcreteDesign,
    SeismicAnalysis,
    LoadCombinations,
    ConnectionDesign,
    FoundationDesign,
    
    // Partially validated
    TimberDesign,
    MasonryDesign,
    CompositeDesign,
    PrecastConcrete,
    
    // Limited validation
    OffshorePlatforms,
    NuclearStructures,
    BlastResistant,
    
    // Not validated - AI blocked
    DamDesign,
    BridgeCables,
    TunnelLining,
    MarineVessels,
    AircraftStructures,
}

impl EngineeringDomain {
    pub fn is_fully_validated(&self) -> bool {
        matches!(
            self,
            EngineeringDomain::SteelDesign
                | EngineeringDomain::ConcreteDesign
                | EngineeringDomain::SeismicAnalysis
                | EngineeringDomain::LoadCombinations
                | EngineeringDomain::ConnectionDesign
                | EngineeringDomain::FoundationDesign
        )
    }

    pub fn is_partially_validated(&self) -> bool {
        matches!(
            self,
            EngineeringDomain::TimberDesign
                | EngineeringDomain::MasonryDesign
                | EngineeringDomain::CompositeDesign
                | EngineeringDomain::PrecastConcrete
        )
    }

    pub fn is_blocked(&self) -> bool {
        matches!(
            self,
            EngineeringDomain::DamDesign
                | EngineeringDomain::BridgeCables
                | EngineeringDomain::TunnelLining
                | EngineeringDomain::MarineVessels
                | EngineeringDomain::AircraftStructures
        )
    }
}

// ============================================================================
// GUARDRAIL ENGINE
// ============================================================================

/// Core guardrail validation engine
#[allow(dead_code)]
pub struct GuardrailEngine {
    /// Validated domains
    validated_domains: HashSet<EngineeringDomain>,
    /// Engineering limits
    limits: EngineeringLimits,
    /// Hallucination detectors
    hallucination_checks: Vec<HallucinationCheck>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EngineeringLimits {
    pub max_span_ratio: f64,         // Max L/d ratio
    pub max_slenderness: f64,        // Max column slenderness
    pub min_reinforcement_ratio: f64,
    pub max_reinforcement_ratio: f64,
    pub max_deflection_ratio: f64,   // L/limit
    pub max_drift_ratio: f64,        // Story drift limit
    pub min_factor_of_safety: f64,
    pub max_utilization_ratio: f64,
}

impl Default for EngineeringLimits {
    fn default() -> Self {
        Self {
            max_span_ratio: 30.0,
            max_slenderness: 200.0,
            min_reinforcement_ratio: 0.002,
            max_reinforcement_ratio: 0.04,
            max_deflection_ratio: 250.0,
            max_drift_ratio: 0.025,
            min_factor_of_safety: 1.5,
            max_utilization_ratio: 1.0,
        }
    }
}

#[derive(Debug, Clone)]
pub struct HallucinationCheck {
    pub name: String,
    pub check_fn: fn(&str) -> Option<HallucinationWarning>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HallucinationWarning {
    pub warning_type: HallucinationType,
    pub message: String,
    pub severity: WarningLevel,
    pub context: String,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum HallucinationType {
    FabricatedCode,       // Non-existent code clause
    IncorrectFormula,     // Wrong equation
    MadeUpValue,          // Fictitious material property
    MisattributedSource,  // Wrong code reference
    OutdatedInfo,         // Superseded code
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum WarningLevel {
    Critical,
    Warning,
    Caution,
    Info,
}

impl Default for GuardrailEngine {
    fn default() -> Self {
        Self::new()
    }
}

impl GuardrailEngine {
    pub fn new() -> Self {
        let mut validated = HashSet::new();
        validated.insert(EngineeringDomain::SteelDesign);
        validated.insert(EngineeringDomain::ConcreteDesign);
        validated.insert(EngineeringDomain::SeismicAnalysis);
        validated.insert(EngineeringDomain::LoadCombinations);
        validated.insert(EngineeringDomain::ConnectionDesign);
        validated.insert(EngineeringDomain::FoundationDesign);

        Self {
            validated_domains: validated,
            limits: EngineeringLimits::default(),
            hallucination_checks: vec![
                HallucinationCheck {
                    name: "Non-existent clause check".to_string(),
                    check_fn: check_fabricated_clause,
                },
                HallucinationCheck {
                    name: "Unrealistic value check".to_string(),
                    check_fn: check_unrealistic_values,
                },
            ],
        }
    }

    /// Validate an AI suggestion
    pub fn validate_suggestion(&self, suggestion: &AiSuggestion) -> ValidationResult {
        let mut errors = Vec::new();
        let mut warnings = Vec::new();
        let mut info = Vec::new();

        // 1. Domain validation
        if suggestion.domain_validation.domain.is_blocked() {
            errors.push(ValidationError {
                code: "DOMAIN_BLOCKED".to_string(),
                message: format!(
                    "AI suggestions are blocked for domain: {:?}. Expert manual design required.",
                    suggestion.domain_validation.domain
                ),
                severity: WarningLevel::Critical,
            });
        }

        // 2. Citation requirements
        if suggestion.citations.is_empty() {
            warnings.push(ValidationError {
                code: "NO_CITATIONS".to_string(),
                message: "Suggestion has no code citations. Verification required.".to_string(),
                severity: WarningLevel::Warning,
            });
        }

        // 3. Confidence check
        if suggestion.confidence.level.requires_expert_review() {
            warnings.push(ValidationError {
                code: "LOW_CONFIDENCE".to_string(),
                message: format!(
                    "Confidence level is {:?} ({}%). Expert review required.",
                    suggestion.confidence.level,
                    suggestion.confidence.level.to_percentage()
                ),
                severity: WarningLevel::Warning,
            });
        }

        // 4. Check for unverified citations
        let unverified_count = suggestion.citations.iter().filter(|c| !c.verified).count();
        if unverified_count > 0 {
            info.push(ValidationError {
                code: "UNVERIFIED_CITATIONS".to_string(),
                message: format!("{} citation(s) have not been verified against source.", unverified_count),
                severity: WarningLevel::Caution,
            });
        }

        // 5. Hallucination checks
        if let SuggestionContent::Text(text) = &suggestion.content {
            for check in &self.hallucination_checks {
                if let Some(warning) = (check.check_fn)(text) {
                    warnings.push(ValidationError {
                        code: format!("HALLUCINATION_{:?}", warning.warning_type),
                        message: warning.message,
                        severity: warning.severity,
                    });
                }
            }
        }

        ValidationResult {
            is_valid: errors.is_empty(),
            can_proceed: errors.is_empty() && !warnings.iter().any(|w| w.severity == WarningLevel::Critical),
            requires_review: suggestion.confidence.level.requires_expert_review(),
            errors,
            warnings,
            info,
        }
    }

    /// Check engineering value against limits
    pub fn check_engineering_limits(&self, check: &EngineeringCheck) -> LimitCheckResult {
        let mut violations = Vec::new();

        match check {
            EngineeringCheck::SpanRatio(ratio) => {
                if *ratio > self.limits.max_span_ratio {
                    violations.push(LimitViolation {
                        limit_name: "Span/Depth Ratio".to_string(),
                        value: *ratio,
                        limit: self.limits.max_span_ratio,
                        severity: WarningLevel::Warning,
                    });
                }
            }
            EngineeringCheck::Slenderness(ratio) => {
                if *ratio > self.limits.max_slenderness {
                    violations.push(LimitViolation {
                        limit_name: "Slenderness Ratio".to_string(),
                        value: *ratio,
                        limit: self.limits.max_slenderness,
                        severity: WarningLevel::Critical,
                    });
                }
            }
            EngineeringCheck::ReinforcementRatio(ratio) => {
                if *ratio < self.limits.min_reinforcement_ratio {
                    violations.push(LimitViolation {
                        limit_name: "Min Reinforcement".to_string(),
                        value: *ratio,
                        limit: self.limits.min_reinforcement_ratio,
                        severity: WarningLevel::Warning,
                    });
                }
                if *ratio > self.limits.max_reinforcement_ratio {
                    violations.push(LimitViolation {
                        limit_name: "Max Reinforcement".to_string(),
                        value: *ratio,
                        limit: self.limits.max_reinforcement_ratio,
                        severity: WarningLevel::Critical,
                    });
                }
            }
            EngineeringCheck::Utilization(ratio) => {
                if *ratio > self.limits.max_utilization_ratio {
                    violations.push(LimitViolation {
                        limit_name: "Utilization Ratio".to_string(),
                        value: *ratio,
                        limit: self.limits.max_utilization_ratio,
                        severity: WarningLevel::Critical,
                    });
                }
            }
            EngineeringCheck::DriftRatio(ratio) => {
                if *ratio > self.limits.max_drift_ratio {
                    violations.push(LimitViolation {
                        limit_name: "Story Drift".to_string(),
                        value: *ratio,
                        limit: self.limits.max_drift_ratio,
                        severity: WarningLevel::Critical,
                    });
                }
            }
        }

        LimitCheckResult {
            is_within_limits: violations.is_empty(),
            violations,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum EngineeringCheck {
    SpanRatio(f64),
    Slenderness(f64),
    ReinforcementRatio(f64),
    Utilization(f64),
    DriftRatio(f64),
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ValidationResult {
    pub is_valid: bool,
    pub can_proceed: bool,
    pub requires_review: bool,
    pub errors: Vec<ValidationError>,
    pub warnings: Vec<ValidationError>,
    pub info: Vec<ValidationError>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ValidationError {
    pub code: String,
    pub message: String,
    pub severity: WarningLevel,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LimitCheckResult {
    pub is_within_limits: bool,
    pub violations: Vec<LimitViolation>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LimitViolation {
    pub limit_name: String,
    pub value: f64,
    pub limit: f64,
    pub severity: WarningLevel,
}

// ============================================================================
// REQUIRED ACTIONS
// ============================================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RequiredAction {
    pub action_type: ActionType,
    pub description: String,
    pub priority: ActionPriority,
    pub is_completed: bool,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum ActionType {
    ExpertReview,
    CodeVerification,
    InputValidation,
    SiteSpecificCheck,
    ClientConfirmation,
    RegulatorApproval,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum ActionPriority {
    Mandatory,
    Recommended,
    Optional,
}

// ============================================================================
// HALLUCINATION DETECTORS
// ============================================================================

fn check_fabricated_clause(text: &str) -> Option<HallucinationWarning> {
    // Check for obviously wrong clause patterns
    let suspicious_patterns = [
        "IS 456:2025",  // Future code
        "IS 800:2025",
        "AISC 360-25",
        "Clause 99.",   // Unlikely high clause numbers
        "Section 50.",
    ];

    for pattern in &suspicious_patterns {
        if text.contains(pattern) {
            return Some(HallucinationWarning {
                warning_type: HallucinationType::FabricatedCode,
                message: format!("Suspicious code reference detected: {}. This may not exist.", pattern),
                severity: WarningLevel::Warning,
                context: text.to_string(),
            });
        }
    }

    None
}

fn check_unrealistic_values(text: &str) -> Option<HallucinationWarning> {
    // Check for unrealistic engineering values
    let unrealistic = [
        ("steel yield strength", 1000.0, "MPa"),  // Steel > 1000 MPa unusual
        ("concrete compressive", 200.0, "MPa"),   // Concrete > 200 MPa unusual
        ("modulus of elasticity", 1000.0, "GPa"), // E > 1000 GPa impossible
    ];

    // Simple pattern matching (in production, use NLP)
    for (name, _limit, _unit) in &unrealistic {
        if text.to_lowercase().contains(name) {
            // Would need actual value extraction here
            // This is a placeholder
        }
    }

    None
}

// ============================================================================
// AUDIT TRAIL
// ============================================================================

/// Audit trail for AI decisions
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AuditTrail {
    pub entries: Vec<AuditEntry>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AuditEntry {
    pub timestamp: String,
    pub suggestion_id: String,
    pub action: AuditAction,
    pub user: String,
    pub details: String,
    pub validation_result: Option<ValidationResult>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum AuditAction {
    SuggestionGenerated,
    ValidationPerformed,
    UserAccepted,
    UserRejected,
    UserModified,
    ExpertReviewed,
    FlaggedForReview,
}

impl AuditTrail {
    pub fn new() -> Self {
        Self { entries: Vec::new() }
    }

    pub fn add_entry(&mut self, entry: AuditEntry) {
        self.entries.push(entry);
    }

    pub fn get_for_suggestion(&self, suggestion_id: &str) -> Vec<&AuditEntry> {
        self.entries.iter()
            .filter(|e| e.suggestion_id == suggestion_id)
            .collect()
    }
}

impl Default for AuditTrail {
    fn default() -> Self {
        Self::new()
    }
}

// ============================================================================
// TESTS
// ============================================================================

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_confidence_levels() {
        assert_eq!(ConfidenceLevel::VeryHigh.to_percentage(), 95);
        assert!(!ConfidenceLevel::High.requires_expert_review());
        assert!(ConfidenceLevel::Low.requires_expert_review());
    }

    #[test]
    fn test_domain_validation() {
        assert!(EngineeringDomain::SteelDesign.is_fully_validated());
        assert!(EngineeringDomain::TimberDesign.is_partially_validated());
        assert!(EngineeringDomain::DamDesign.is_blocked());
    }

    #[test]
    fn test_guardrail_engine() {
        let engine = GuardrailEngine::new();

        // Test slenderness limit
        let result = engine.check_engineering_limits(&EngineeringCheck::Slenderness(250.0));
        assert!(!result.is_within_limits);
        assert_eq!(result.violations.len(), 1);

        // Test valid slenderness
        let result = engine.check_engineering_limits(&EngineeringCheck::Slenderness(150.0));
        assert!(result.is_within_limits);
    }

    #[test]
    fn test_hallucination_check() {
        let result = check_fabricated_clause("According to IS 456:2025 Clause 5.1");
        assert!(result.is_some());

        let result = check_fabricated_clause("According to IS 456:2000 Clause 5.1");
        assert!(result.is_none());
    }

    #[test]
    fn test_design_code_names() {
        assert_eq!(DesignCode::IS456_2000.display_name(), "IS 456:2000");
        assert_eq!(DesignCode::AISC360_22.display_name(), "AISC 360-22");
    }
}
