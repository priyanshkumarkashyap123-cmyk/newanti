//! # Engineering Error Types
//!
//! Industry-standard error handling with rich context and recovery hints.
//! Follows Rust best practices with `thiserror` for ergonomic error definitions.
//!
//! ## Design Principles
//! - **Typed errors**: No stringly-typed errors, all errors are enums
//! - **Context preservation**: Errors carry full context for debugging
//! - **Recovery hints**: Errors suggest how to fix the issue
//! - **Error codes**: Numeric codes for logging/monitoring systems
//! - **Chaining**: Supports `?` operator and error wrapping

use std::fmt;
use thiserror::Error;
use serde::{Deserialize, Serialize};

// =============================================================================
// ERROR CODES (Industry Standard: Numeric codes for monitoring/logging)
// =============================================================================

/// Error code categories following industry conventions
/// - 1xxx: Input validation errors
/// - 2xxx: Numerical/computation errors  
/// - 3xxx: Structural analysis errors
/// - 4xxx: Geotechnical errors
/// - 5xxx: Hydraulics errors
/// - 6xxx: System/resource errors
/// - 9xxx: Internal errors
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub struct ErrorCode(pub u16);

impl ErrorCode {
    // Input validation (1xxx)
    pub const INVALID_INPUT: Self = Self(1000);
    pub const OUT_OF_RANGE: Self = Self(1001);
    pub const DIMENSION_MISMATCH: Self = Self(1002);
    pub const MISSING_REQUIRED: Self = Self(1003);
    pub const INVALID_GEOMETRY: Self = Self(1004);
    pub const INVALID_MATERIAL: Self = Self(1005);
    pub const INVALID_BOUNDARY: Self = Self(1006);
    
    // Numerical errors (2xxx)
    pub const SINGULAR_MATRIX: Self = Self(2000);
    pub const NO_CONVERGENCE: Self = Self(2001);
    pub const NUMERICAL_INSTABILITY: Self = Self(2002);
    pub const OVERFLOW: Self = Self(2003);
    pub const UNDERFLOW: Self = Self(2004);
    pub const DIVIDE_BY_ZERO: Self = Self(2005);
    pub const ILL_CONDITIONED: Self = Self(2006);
    
    // Structural analysis (3xxx)
    pub const UNSTABLE_STRUCTURE: Self = Self(3000);
    pub const MECHANISM: Self = Self(3001);
    pub const INSUFFICIENT_SUPPORTS: Self = Self(3002);
    pub const ELEMENT_FAILURE: Self = Self(3003);
    pub const BUCKLING: Self = Self(3004);
    pub const EXCESSIVE_DEFLECTION: Self = Self(3005);
    pub const STRESS_LIMIT_EXCEEDED: Self = Self(3006);
    
    // Geotechnical (4xxx)
    pub const BEARING_FAILURE: Self = Self(4000);
    pub const SLOPE_FAILURE: Self = Self(4001);
    pub const SETTLEMENT_EXCEEDED: Self = Self(4002);
    pub const LIQUEFACTION_RISK: Self = Self(4003);
    
    // Hydraulics (5xxx)
    pub const FLOW_REGIME_ERROR: Self = Self(5000);
    pub const PIPE_PRESSURE_EXCEEDED: Self = Self(5001);
    pub const FLOOD_CAPACITY_EXCEEDED: Self = Self(5002);
    
    // System errors (6xxx)
    pub const MEMORY_ALLOCATION: Self = Self(6000);
    pub const TIMEOUT: Self = Self(6001);
    pub const RESOURCE_EXHAUSTED: Self = Self(6002);
    
    // Internal errors (9xxx)
    pub const INTERNAL_ERROR: Self = Self(9000);
    pub const NOT_IMPLEMENTED: Self = Self(9001);
}

impl fmt::Display for ErrorCode {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "E{:04}", self.0)
    }
}

// =============================================================================
// MAIN ERROR TYPE
// =============================================================================

/// Main engineering computation error type
#[derive(Error, Debug, Clone, Serialize, Deserialize)]
pub enum EngineeringError {
    /// Input validation failed
    #[error("[{code}] Validation error: {message}")]
    Validation {
        code: ErrorCode,
        message: String,
        field: Option<String>,
        expected: Option<String>,
        actual: Option<String>,
        hint: Option<String>,
    },

    /// Numerical computation failed
    #[error("[{code}] Numerical error: {message}")]
    Numerical {
        code: ErrorCode,
        message: String,
        operation: String,
        hint: Option<String>,
    },

    /// Structural analysis failed
    #[error("[{code}] Structural error: {message}")]
    Structural {
        code: ErrorCode,
        message: String,
        element_id: Option<String>,
        location: Option<String>,
        hint: Option<String>,
    },

    /// Geotechnical analysis failed
    #[error("[{code}] Geotechnical error: {message}")]
    Geotechnical {
        code: ErrorCode,
        message: String,
        hint: Option<String>,
    },

    /// Hydraulic analysis failed
    #[error("[{code}] Hydraulic error: {message}")]
    Hydraulic {
        code: ErrorCode,
        message: String,
        hint: Option<String>,
    },

    /// System/resource error
    #[error("[{code}] System error: {message}")]
    System {
        code: ErrorCode,
        message: String,
    },

    /// Internal error (should not happen in production)
    #[error("[{code}] Internal error: {message}")]
    Internal {
        code: ErrorCode,
        message: String,
    },
}

impl EngineeringError {
    /// Get the error code
    pub fn code(&self) -> ErrorCode {
        match self {
            Self::Validation { code, .. } => *code,
            Self::Numerical { code, .. } => *code,
            Self::Structural { code, .. } => *code,
            Self::Geotechnical { code, .. } => *code,
            Self::Hydraulic { code, .. } => *code,
            Self::System { code, .. } => *code,
            Self::Internal { code, .. } => *code,
        }
    }

    /// Get recovery hint if available
    pub fn hint(&self) -> Option<&str> {
        match self {
            Self::Validation { hint, .. } => hint.as_deref(),
            Self::Numerical { hint, .. } => hint.as_deref(),
            Self::Structural { hint, .. } => hint.as_deref(),
            Self::Geotechnical { hint, .. } => hint.as_deref(),
            Self::Hydraulic { hint, .. } => hint.as_deref(),
            _ => None,
        }
    }

    /// Check if error is recoverable
    pub fn is_recoverable(&self) -> bool {
        matches!(self.code().0, 1000..=1999 | 3005..=3006)
    }
}

// =============================================================================
// ERROR BUILDERS (Fluent API for constructing errors)
// =============================================================================

/// Builder for validation errors
pub struct ValidationErrorBuilder {
    code: ErrorCode,
    message: String,
    field: Option<String>,
    expected: Option<String>,
    actual: Option<String>,
    hint: Option<String>,
}

impl ValidationErrorBuilder {
    pub fn new(message: impl Into<String>) -> Self {
        Self {
            code: ErrorCode::INVALID_INPUT,
            message: message.into(),
            field: None,
            expected: None,
            actual: None,
            hint: None,
        }
    }

    pub fn code(mut self, code: ErrorCode) -> Self {
        self.code = code;
        self
    }

    pub fn field(mut self, field: impl Into<String>) -> Self {
        self.field = Some(field.into());
        self
    }

    pub fn expected(mut self, expected: impl Into<String>) -> Self {
        self.expected = Some(expected.into());
        self
    }

    pub fn actual(mut self, actual: impl Into<String>) -> Self {
        self.actual = Some(actual.into());
        self
    }

    pub fn hint(mut self, hint: impl Into<String>) -> Self {
        self.hint = Some(hint.into());
        self
    }

    pub fn build(self) -> EngineeringError {
        EngineeringError::Validation {
            code: self.code,
            message: self.message,
            field: self.field,
            expected: self.expected,
            actual: self.actual,
            hint: self.hint,
        }
    }
}

/// Builder for numerical errors
pub struct NumericalErrorBuilder {
    code: ErrorCode,
    message: String,
    operation: String,
    hint: Option<String>,
}

impl NumericalErrorBuilder {
    pub fn new(message: impl Into<String>, operation: impl Into<String>) -> Self {
        Self {
            code: ErrorCode::NUMERICAL_INSTABILITY,
            message: message.into(),
            operation: operation.into(),
            hint: None,
        }
    }

    pub fn code(mut self, code: ErrorCode) -> Self {
        self.code = code;
        self
    }

    pub fn hint(mut self, hint: impl Into<String>) -> Self {
        self.hint = Some(hint.into());
        self
    }

    pub fn build(self) -> EngineeringError {
        EngineeringError::Numerical {
            code: self.code,
            message: self.message,
            operation: self.operation,
            hint: self.hint,
        }
    }
}

/// Builder for structural errors
pub struct StructuralErrorBuilder {
    code: ErrorCode,
    message: String,
    element_id: Option<String>,
    location: Option<String>,
    hint: Option<String>,
}

impl StructuralErrorBuilder {
    pub fn new(message: impl Into<String>) -> Self {
        Self {
            code: ErrorCode::ELEMENT_FAILURE,
            message: message.into(),
            element_id: None,
            location: None,
            hint: None,
        }
    }

    pub fn code(mut self, code: ErrorCode) -> Self {
        self.code = code;
        self
    }

    pub fn element(mut self, id: impl Into<String>) -> Self {
        self.element_id = Some(id.into());
        self
    }

    pub fn location(mut self, loc: impl Into<String>) -> Self {
        self.location = Some(loc.into());
        self
    }

    pub fn hint(mut self, hint: impl Into<String>) -> Self {
        self.hint = Some(hint.into());
        self
    }

    pub fn build(self) -> EngineeringError {
        EngineeringError::Structural {
            code: self.code,
            message: self.message,
            element_id: self.element_id,
            location: self.location,
            hint: self.hint,
        }
    }
}

// =============================================================================
// CONVENIENCE FUNCTIONS
// =============================================================================

/// Result type alias for engineering computations
pub type EngResult<T> = Result<T, EngineeringError>;

/// Quick validation error
pub fn validation_error(message: impl Into<String>) -> EngineeringError {
    ValidationErrorBuilder::new(message).build()
}

/// Quick numerical error
pub fn numerical_error(message: impl Into<String>, operation: impl Into<String>) -> EngineeringError {
    NumericalErrorBuilder::new(message, operation).build()
}

/// Quick structural error
pub fn structural_error(message: impl Into<String>) -> EngineeringError {
    StructuralErrorBuilder::new(message).build()
}

/// Singular matrix error
pub fn singular_matrix_error(context: impl Into<String>) -> EngineeringError {
    NumericalErrorBuilder::new("Matrix is singular or nearly singular", context)
        .code(ErrorCode::SINGULAR_MATRIX)
        .hint("Check boundary conditions and element connectivity. Ensure the structure is stable.")
        .build()
}

/// Convergence error
pub fn convergence_error(iterations: usize, tolerance: f64, achieved: f64) -> EngineeringError {
    NumericalErrorBuilder::new(
        format!("Failed to converge after {} iterations (tolerance: {:.2e}, achieved: {:.2e})", 
                iterations, tolerance, achieved),
        "iterative_solver"
    )
    .code(ErrorCode::NO_CONVERGENCE)
    .hint("Try increasing max iterations, relaxing tolerance, or improving initial guess")
    .build()
}

/// Unstable structure error
pub fn unstable_structure_error(reason: impl Into<String>) -> EngineeringError {
    StructuralErrorBuilder::new(format!("Structure is unstable: {}", reason.into()))
        .code(ErrorCode::UNSTABLE_STRUCTURE)
        .hint("Add supports or constraints to prevent rigid body motion")
        .build()
}

/// Out of range error
pub fn out_of_range_error(
    field: impl Into<String>,
    value: f64,
    min: f64,
    max: f64,
) -> EngineeringError {
    ValidationErrorBuilder::new(format!("Value {:.4} is out of valid range [{:.4}, {:.4}]", value, min, max))
        .code(ErrorCode::OUT_OF_RANGE)
        .field(field)
        .expected(format!("[{}, {}]", min, max))
        .actual(format!("{}", value))
        .build()
}

/// Dimension mismatch error
pub fn dimension_mismatch_error(
    expected: (usize, usize),
    actual: (usize, usize),
) -> EngineeringError {
    ValidationErrorBuilder::new("Matrix/vector dimension mismatch")
        .code(ErrorCode::DIMENSION_MISMATCH)
        .expected(format!("{}×{}", expected.0, expected.1))
        .actual(format!("{}×{}", actual.0, actual.1))
        .build()
}

// =============================================================================
// WASM INTEROP
// =============================================================================

use wasm_bindgen::prelude::*;

impl From<EngineeringError> for JsValue {
    fn from(err: EngineeringError) -> Self {
        let obj = js_sys::Object::new();
        let _ = js_sys::Reflect::set(&obj, &"code".into(), &err.code().0.into());
        let _ = js_sys::Reflect::set(&obj, &"message".into(), &err.to_string().into());
        if let Some(hint) = err.hint() {
            let _ = js_sys::Reflect::set(&obj, &"hint".into(), &hint.into());
        }
        let _ = js_sys::Reflect::set(&obj, &"recoverable".into(), &err.is_recoverable().into());
        obj.into()
    }
}

// =============================================================================
// TESTS
// =============================================================================

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_error_codes() {
        assert_eq!(format!("{}", ErrorCode::SINGULAR_MATRIX), "E2000");
        assert_eq!(format!("{}", ErrorCode::INVALID_INPUT), "E1000");
    }

    #[test]
    fn test_validation_error_builder() {
        let err = ValidationErrorBuilder::new("Invalid Young's modulus")
            .code(ErrorCode::OUT_OF_RANGE)
            .field("E")
            .expected("> 0")
            .actual("-100")
            .hint("Young's modulus must be positive")
            .build();

        assert_eq!(err.code(), ErrorCode::OUT_OF_RANGE);
        assert!(err.is_recoverable());
        assert!(err.hint().is_some());
    }

    #[test]
    fn test_numerical_error_builder() {
        let err = singular_matrix_error("stiffness matrix assembly");
        assert_eq!(err.code(), ErrorCode::SINGULAR_MATRIX);
        assert!(!err.is_recoverable());
    }

    #[test]
    fn test_convergence_error() {
        let err = convergence_error(100, 1e-6, 1e-3);
        assert_eq!(err.code(), ErrorCode::NO_CONVERGENCE);
        assert!(err.to_string().contains("100 iterations"));
    }
}
