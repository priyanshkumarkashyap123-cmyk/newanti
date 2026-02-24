//! # Input Validation Module
//!
//! Industry-standard input validation for structural engineering computations.
//! Validates all inputs before expensive calculations to fail fast with helpful errors.
//!
//! ## Design Principles
//! - **Fail fast**: Validate inputs before computation
//! - **Descriptive errors**: Tell users exactly what's wrong and how to fix it
//! - **Unit-aware**: Validates physical units and ranges
//! - **Composable**: Validators can be chained and combined

use super::error::{
    EngineeringError, EngResult, ErrorCode, ValidationErrorBuilder,
    out_of_range_error, dimension_mismatch_error,
};

// =============================================================================
// PHYSICAL CONSTANTS AND LIMITS
// =============================================================================

/// Physical limits for validation (SI units)
pub mod limits {
    /// Minimum positive value for physical quantities
    pub const EPSILON: f64 = 1e-12;
    
    /// Maximum reasonable Young's modulus (diamond ~1200 GPa)
    pub const MAX_YOUNGS_MODULUS: f64 = 2e12; // Pa
    
    /// Minimum reasonable Young's modulus (soft rubber ~0.01 GPa)
    pub const MIN_YOUNGS_MODULUS: f64 = 1e6; // Pa
    
    /// Maximum reasonable density (osmium ~22,590 kg/m³)
    pub const MAX_DENSITY: f64 = 30_000.0; // kg/m³
    
    /// Maximum reasonable yield stress (ultra-high-strength steel ~2000 MPa)
    pub const MAX_YIELD_STRESS: f64 = 3e9; // Pa
    
    /// Maximum reasonable Poisson's ratio (theoretical limit 0.5)
    pub const MAX_POISSON_RATIO: f64 = 0.5;
    
    /// Minimum reasonable Poisson's ratio (auxetic materials can be negative)
    pub const MIN_POISSON_RATIO: f64 = -1.0;
    
    /// Maximum reasonable structure dimension
    pub const MAX_DIMENSION: f64 = 10_000.0; // m (10 km)
    
    /// Minimum reasonable structure dimension
    pub const MIN_DIMENSION: f64 = 1e-6; // m (1 micron)
    
    /// Maximum reasonable angle in radians
    pub const MAX_ANGLE: f64 = std::f64::consts::TAU; // 2π
    
    /// Maximum reasonable number of elements
    pub const MAX_ELEMENTS: usize = 10_000_000;
    
    /// Maximum reasonable DOF count
    pub const MAX_DOF: usize = 100_000_000;
    
    /// Maximum condition number before warning
    pub const CONDITION_NUMBER_WARNING: f64 = 1e10;
    
    /// Maximum condition number before error
    pub const CONDITION_NUMBER_ERROR: f64 = 1e14;
}

// =============================================================================
// VALIDATOR TRAIT
// =============================================================================

/// Trait for validatable types
pub trait Validate {
    /// Validate the value, returning an error if invalid
    fn validate(&self) -> EngResult<()>;
    
    /// Check if valid without consuming
    fn is_valid(&self) -> bool {
        self.validate().is_ok()
    }
}

// =============================================================================
// NUMERIC VALIDATORS
// =============================================================================

/// Validate that a value is finite (not NaN or infinite)
pub fn validate_finite(value: f64, field: &str) -> EngResult<()> {
    if !value.is_finite() {
        return Err(ValidationErrorBuilder::new(format!("{} must be a finite number", field))
            .code(ErrorCode::INVALID_INPUT)
            .field(field)
            .actual(format!("{}", value))
            .hint("Check for division by zero or overflow in preceding calculations")
            .build());
    }
    Ok(())
}

/// Validate that a value is positive (> 0)
pub fn validate_positive(value: f64, field: &str) -> EngResult<()> {
    validate_finite(value, field)?;
    if value <= 0.0 {
        return Err(ValidationErrorBuilder::new(format!("{} must be positive", field))
            .code(ErrorCode::OUT_OF_RANGE)
            .field(field)
            .expected("> 0")
            .actual(format!("{}", value))
            .build());
    }
    Ok(())
}

/// Validate that a value is non-negative (>= 0)
pub fn validate_non_negative(value: f64, field: &str) -> EngResult<()> {
    validate_finite(value, field)?;
    if value < 0.0 {
        return Err(ValidationErrorBuilder::new(format!("{} must be non-negative", field))
            .code(ErrorCode::OUT_OF_RANGE)
            .field(field)
            .expected(">= 0")
            .actual(format!("{}", value))
            .build());
    }
    Ok(())
}

/// Validate that a value is within a range [min, max]
pub fn validate_range(value: f64, field: &str, min: f64, max: f64) -> EngResult<()> {
    validate_finite(value, field)?;
    if value < min || value > max {
        return Err(out_of_range_error(field, value, min, max));
    }
    Ok(())
}

/// Validate that a value is within a range (min, max) exclusive
pub fn validate_range_exclusive(value: f64, field: &str, min: f64, max: f64) -> EngResult<()> {
    validate_finite(value, field)?;
    if value <= min || value >= max {
        return Err(ValidationErrorBuilder::new(
            format!("Value {:.6} is outside exclusive range ({:.6}, {:.6})", value, min, max)
        )
            .code(ErrorCode::OUT_OF_RANGE)
            .field(field)
            .expected(format!("({}, {})", min, max))
            .actual(format!("{}", value))
            .build());
    }
    Ok(())
}

// =============================================================================
// MATERIAL PROPERTY VALIDATORS
// =============================================================================

/// Validate Young's modulus (E)
pub fn validate_youngs_modulus(e: f64) -> EngResult<()> {
    validate_finite(e, "Young's modulus (E)")?;
    if e <= 0.0 {
        return Err(ValidationErrorBuilder::new("Young's modulus must be positive")
            .code(ErrorCode::INVALID_MATERIAL)
            .field("E")
            .expected("> 0")
            .actual(format!("{:.2e}", e))
            .hint("Typical values: Steel ~200 GPa, Concrete ~30 GPa, Aluminum ~70 GPa")
            .build());
    }
    if e > limits::MAX_YOUNGS_MODULUS {
        return Err(ValidationErrorBuilder::new("Young's modulus exceeds physical limits")
            .code(ErrorCode::OUT_OF_RANGE)
            .field("E")
            .expected(format!("<= {:.2e}", limits::MAX_YOUNGS_MODULUS))
            .actual(format!("{:.2e}", e))
            .hint("Check units. Expected: Pa (N/m²)")
            .build());
    }
    Ok(())
}

/// Validate Poisson's ratio (ν)
pub fn validate_poisson_ratio(nu: f64) -> EngResult<()> {
    validate_finite(nu, "Poisson's ratio (ν)")?;
    if !(limits::MIN_POISSON_RATIO..=limits::MAX_POISSON_RATIO).contains(&nu) {
        return Err(ValidationErrorBuilder::new("Poisson's ratio out of physical limits")
            .code(ErrorCode::INVALID_MATERIAL)
            .field("nu")
            .expected(format!("[{}, {}]", limits::MIN_POISSON_RATIO, limits::MAX_POISSON_RATIO))
            .actual(format!("{:.4}", nu))
            .hint("Typical values: Steel ~0.3, Concrete ~0.2, Rubber ~0.5")
            .build());
    }
    if nu >= 0.5 {
        return Err(ValidationErrorBuilder::new("Poisson's ratio cannot be 0.5 (incompressible)")
            .code(ErrorCode::INVALID_MATERIAL)
            .field("nu")
            .expected("< 0.5")
            .actual(format!("{:.4}", nu))
            .hint("For nearly incompressible materials, use ν = 0.499")
            .build());
    }
    Ok(())
}

/// Validate density (ρ)
pub fn validate_density(rho: f64) -> EngResult<()> {
    validate_positive(rho, "density (ρ)")?;
    if rho > limits::MAX_DENSITY {
        return Err(ValidationErrorBuilder::new("Density exceeds physical limits")
            .code(ErrorCode::OUT_OF_RANGE)
            .field("rho")
            .expected(format!("<= {}", limits::MAX_DENSITY))
            .actual(format!("{}", rho))
            .hint("Check units. Expected: kg/m³. Steel ~7850 kg/m³")
            .build());
    }
    Ok(())
}

/// Validate yield stress (σ_y)
pub fn validate_yield_stress(fy: f64) -> EngResult<()> {
    validate_positive(fy, "yield stress (σ_y)")?;
    if fy > limits::MAX_YIELD_STRESS {
        return Err(ValidationErrorBuilder::new("Yield stress exceeds physical limits")
            .code(ErrorCode::OUT_OF_RANGE)
            .field("fy")
            .expected(format!("<= {:.2e}", limits::MAX_YIELD_STRESS))
            .actual(format!("{:.2e}", fy))
            .hint("Check units. Expected: Pa. Typical steel: 250-500 MPa")
            .build());
    }
    Ok(())
}

// =============================================================================
// GEOMETRY VALIDATORS
// =============================================================================

/// Validate a length dimension
pub fn validate_length(length: f64, field: &str) -> EngResult<()> {
    validate_positive(length, field)?;
    if length < limits::MIN_DIMENSION {
        return Err(ValidationErrorBuilder::new(format!("{} is below minimum resolution", field))
            .code(ErrorCode::OUT_OF_RANGE)
            .field(field)
            .expected(format!(">= {:.2e}", limits::MIN_DIMENSION))
            .actual(format!("{:.2e}", length))
            .hint("Check units. Expected: meters")
            .build());
    }
    if length > limits::MAX_DIMENSION {
        return Err(ValidationErrorBuilder::new(format!("{} exceeds maximum dimension", field))
            .code(ErrorCode::OUT_OF_RANGE)
            .field(field)
            .expected(format!("<= {}", limits::MAX_DIMENSION))
            .actual(format!("{}", length))
            .hint("Check units. Expected: meters")
            .build());
    }
    Ok(())
}

/// Validate cross-sectional area
pub fn validate_area(area: f64, field: &str) -> EngResult<()> {
    validate_positive(area, field)?;
    let min_area = limits::MIN_DIMENSION.powi(2);
    let max_area = limits::MAX_DIMENSION.powi(2);
    if area < min_area || area > max_area {
        return Err(out_of_range_error(field, area, min_area, max_area));
    }
    Ok(())
}

/// Validate moment of inertia
pub fn validate_moment_of_inertia(i: f64, field: &str) -> EngResult<()> {
    validate_positive(i, field)?;
    let min_i = limits::MIN_DIMENSION.powi(4);
    let max_i = limits::MAX_DIMENSION.powi(4);
    if i < min_i || i > max_i {
        return Err(out_of_range_error(field, i, min_i, max_i));
    }
    Ok(())
}

/// Validate angle in radians
pub fn validate_angle(angle: f64, field: &str) -> EngResult<()> {
    validate_finite(angle, field)?;
    // Normalize to [-2π, 2π] range
    let normalized = angle % limits::MAX_ANGLE;
    if normalized.abs() > limits::MAX_ANGLE {
        return Err(out_of_range_error(field, angle, -limits::MAX_ANGLE, limits::MAX_ANGLE));
    }
    Ok(())
}

// =============================================================================
// STRUCTURAL VALIDATORS
// =============================================================================

/// Validate element connectivity
pub fn validate_connectivity(
    elements: &[(usize, usize)],
    num_nodes: usize,
) -> EngResult<()> {
    for (i, &(n1, n2)) in elements.iter().enumerate() {
        if n1 >= num_nodes || n2 >= num_nodes {
            return Err(ValidationErrorBuilder::new(
                format!("Element {} references invalid node index", i)
            )
                .code(ErrorCode::INVALID_INPUT)
                .field(format!("element[{}]", i))
                .expected(format!("node indices < {}", num_nodes))
                .actual(format!("({}, {})", n1, n2))
                .build());
        }
        if n1 == n2 {
            return Err(ValidationErrorBuilder::new(
                format!("Element {} has zero length (same start/end node)", i)
            )
                .code(ErrorCode::INVALID_GEOMETRY)
                .field(format!("element[{}]", i))
                .hint("Each element must connect two different nodes")
                .build());
        }
    }
    Ok(())
}

/// Validate support conditions (ensure structure is not a mechanism)
pub fn validate_supports(
    supports: &[(usize, [bool; 6])], // (node_index, [rx, ry, rz, mx, my, mz])
    num_nodes: usize,
    num_dimensions: usize,
) -> EngResult<()> {
    // Count restrained DOFs
    let mut restrained_dofs = 0;
    for &(node, restraints) in supports {
        if node >= num_nodes {
            return Err(ValidationErrorBuilder::new("Support references invalid node")
                .code(ErrorCode::INVALID_BOUNDARY)
                .field("support_node")
                .expected(format!("< {}", num_nodes))
                .actual(format!("{}", node))
                .build());
        }
        restrained_dofs += restraints.iter().filter(|&&r| r).count();
    }
    
    // Minimum DOFs required for stability
    let min_restrained = match num_dimensions {
        2 => 3,  // 2D: prevent translation (2) + rotation (1)
        3 => 6,  // 3D: prevent translation (3) + rotation (3)
        _ => 1,
    };
    
    if restrained_dofs < min_restrained {
        return Err(ValidationErrorBuilder::new(
            format!("Insufficient supports: {} DOFs restrained, need at least {}", 
                    restrained_dofs, min_restrained)
        )
            .code(ErrorCode::INSUFFICIENT_SUPPORTS)
            .hint("Add more supports to prevent rigid body motion")
            .build());
    }
    
    Ok(())
}

/// Validate matrix dimensions for system K*u = F
pub fn validate_system_dimensions(
    k_rows: usize,
    k_cols: usize,
    f_len: usize,
) -> EngResult<()> {
    if k_rows != k_cols {
        return Err(ValidationErrorBuilder::new("Stiffness matrix must be square")
            .code(ErrorCode::DIMENSION_MISMATCH)
            .field("K")
            .expected("n×n")
            .actual(format!("{}×{}", k_rows, k_cols))
            .build());
    }
    if k_rows != f_len {
        return Err(dimension_mismatch_error((k_rows, 1), (f_len, 1)));
    }
    if k_rows > limits::MAX_DOF {
        return Err(ValidationErrorBuilder::new("System size exceeds maximum")
            .code(ErrorCode::RESOURCE_EXHAUSTED)
            .field("DOF")
            .expected(format!("<= {}", limits::MAX_DOF))
            .actual(format!("{}", k_rows))
            .hint("Consider model reduction or domain decomposition")
            .build());
    }
    Ok(())
}

// =============================================================================
// BATCH VALIDATORS
// =============================================================================

/// Validate a vector of values with a validator function
pub fn validate_all<F>(values: &[f64], field: &str, validator: F) -> EngResult<()>
where
    F: Fn(f64, &str) -> EngResult<()>,
{
    for (i, &value) in values.iter().enumerate() {
        validator(value, &format!("{}[{}]", field, i))?;
    }
    Ok(())
}

/// Validate all values are finite
pub fn validate_all_finite(values: &[f64], field: &str) -> EngResult<()> {
    validate_all(values, field, validate_finite)
}

/// Validate all values are positive
pub fn validate_all_positive(values: &[f64], field: &str) -> EngResult<()> {
    validate_all(values, field, validate_positive)
}

// =============================================================================
// CONDITION NUMBER CHECK
// =============================================================================

/// Check matrix condition number and warn/error if ill-conditioned
pub fn check_condition_number(condition_number: f64, context: &str) -> EngResult<()> {
    if !condition_number.is_finite() {
        return Err(EngineeringError::Numerical {
            code: ErrorCode::SINGULAR_MATRIX,
            message: format!("Matrix is singular (infinite condition number) in {}", context),
            operation: context.to_string(),
            hint: Some("Check boundary conditions and element connectivity".to_string()),
        });
    }
    
    if condition_number > limits::CONDITION_NUMBER_ERROR {
        return Err(EngineeringError::Numerical {
            code: ErrorCode::ILL_CONDITIONED,
            message: format!(
                "Matrix is too ill-conditioned (κ = {:.2e} > {:.2e}) in {}",
                condition_number, limits::CONDITION_NUMBER_ERROR, context
            ),
            operation: context.to_string(),
            hint: Some("The problem is numerically unstable. Consider rescaling or reformulating.".to_string()),
        });
    }
    
    if condition_number > limits::CONDITION_NUMBER_WARNING {
        // Log warning but continue
        #[cfg(target_arch = "wasm32")]
        {
            use wasm_bindgen::prelude::*;
            #[wasm_bindgen]
            extern "C" {
                #[wasm_bindgen(js_namespace = console)]
                fn warn(s: &str);
            }
            warn(&format!(
                "Warning: Matrix has high condition number (κ = {:.2e}) in {}. Results may have reduced accuracy.",
                condition_number, context
            ));
        }
    }
    
    Ok(())
}

// =============================================================================
// TESTS
// =============================================================================

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_validate_positive() {
        assert!(validate_positive(1.0, "test").is_ok());
        assert!(validate_positive(0.0, "test").is_err());
        assert!(validate_positive(-1.0, "test").is_err());
        assert!(validate_positive(f64::NAN, "test").is_err());
    }

    #[test]
    fn test_validate_youngs_modulus() {
        assert!(validate_youngs_modulus(200e9).is_ok()); // Steel
        assert!(validate_youngs_modulus(30e9).is_ok());  // Concrete
        assert!(validate_youngs_modulus(0.0).is_err());
        assert!(validate_youngs_modulus(-1.0).is_err());
        assert!(validate_youngs_modulus(1e15).is_err()); // Too high
    }

    #[test]
    fn test_validate_poisson_ratio() {
        assert!(validate_poisson_ratio(0.3).is_ok());
        assert!(validate_poisson_ratio(0.0).is_ok());
        assert!(validate_poisson_ratio(-0.1).is_ok()); // Auxetic
        assert!(validate_poisson_ratio(0.5).is_err()); // Incompressible
        assert!(validate_poisson_ratio(0.6).is_err());
    }

    #[test]
    fn test_validate_connectivity() {
        let elements = vec![(0, 1), (1, 2)];
        assert!(validate_connectivity(&elements, 3).is_ok());
        assert!(validate_connectivity(&elements, 2).is_err()); // Node 2 invalid
        
        let bad_elements = vec![(0, 0)]; // Zero length
        assert!(validate_connectivity(&bad_elements, 3).is_err());
    }

    #[test]
    fn test_validate_system_dimensions() {
        assert!(validate_system_dimensions(6, 6, 6).is_ok());
        assert!(validate_system_dimensions(6, 5, 6).is_err()); // Not square
        assert!(validate_system_dimensions(6, 6, 5).is_err()); // F mismatch
    }

    #[test]
    fn test_condition_number_check() {
        assert!(check_condition_number(100.0, "test").is_ok());
        assert!(check_condition_number(1e15, "test").is_err());
        assert!(check_condition_number(f64::INFINITY, "test").is_err());
    }
}
