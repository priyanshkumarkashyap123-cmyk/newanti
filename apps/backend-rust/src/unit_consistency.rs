// ============================================================================
// UNIT CONSISTENCY AND TOLERANCE GUARDS
// ============================================================================
//
// P0 REQUIREMENT: Enforce unit consistency and tolerance guards in core
// engines and API inputs.
//
// Features:
// - Type-safe unit system with compile-time checks
// - Automatic unit conversion
// - Tolerance guards for numerical comparisons
// - Input validation with unit awareness
// - Dimensional analysis
//
// Industry Standard: All professional engineering software enforces units
// ============================================================================

use serde::{Deserialize, Serialize};
use std::fmt;
use std::ops::{Add, Div, Mul, Sub};

// ============================================================================
// PHYSICAL UNITS SYSTEM
// ============================================================================

/// Base unit systems supported
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum UnitSystem {
    /// SI units (m, N, kg, Pa)
    SI,
    /// Metric with mm (mm, N, kg, MPa)
    MetricMM,
    /// Imperial (ft, lbf, slug, psi)
    Imperial,
    /// Imperial with inches (in, lbf, lbm, ksi)
    ImperialInch,
}

impl Default for UnitSystem {
    fn default() -> Self {
        UnitSystem::SI
    }
}

// ============================================================================
// DIMENSIONAL QUANTITIES
// ============================================================================

/// Length with unit awareness
#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
pub struct Length {
    /// Value in base SI unit (meters)
    value_si: f64,
    /// Display unit
    display_unit: LengthUnit,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum LengthUnit {
    Meter,
    Millimeter,
    Centimeter,
    Kilometer,
    Foot,
    Inch,
    Yard,
}

impl Length {
    /// Create length from value and unit
    pub fn new(value: f64, unit: LengthUnit) -> Self {
        let value_si = match unit {
            LengthUnit::Meter => value,
            LengthUnit::Millimeter => value * 0.001,
            LengthUnit::Centimeter => value * 0.01,
            LengthUnit::Kilometer => value * 1000.0,
            LengthUnit::Foot => value * 0.3048,
            LengthUnit::Inch => value * 0.0254,
            LengthUnit::Yard => value * 0.9144,
        };
        Self { value_si, display_unit: unit }
    }

    /// Get value in specified unit
    pub fn in_unit(&self, unit: LengthUnit) -> f64 {
        match unit {
            LengthUnit::Meter => self.value_si,
            LengthUnit::Millimeter => self.value_si / 0.001,
            LengthUnit::Centimeter => self.value_si / 0.01,
            LengthUnit::Kilometer => self.value_si / 1000.0,
            LengthUnit::Foot => self.value_si / 0.3048,
            LengthUnit::Inch => self.value_si / 0.0254,
            LengthUnit::Yard => self.value_si / 0.9144,
        }
    }

    /// Get SI value (meters)
    pub fn si(&self) -> f64 {
        self.value_si
    }

    /// Shorthand constructors
    pub fn meters(value: f64) -> Self { Self::new(value, LengthUnit::Meter) }
    pub fn mm(value: f64) -> Self { Self::new(value, LengthUnit::Millimeter) }
    pub fn feet(value: f64) -> Self { Self::new(value, LengthUnit::Foot) }
    pub fn inches(value: f64) -> Self { Self::new(value, LengthUnit::Inch) }
}

impl fmt::Display for Length {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        let (value, unit_str) = match self.display_unit {
            LengthUnit::Meter => (self.value_si, "m"),
            LengthUnit::Millimeter => (self.in_unit(LengthUnit::Millimeter), "mm"),
            LengthUnit::Centimeter => (self.in_unit(LengthUnit::Centimeter), "cm"),
            LengthUnit::Kilometer => (self.in_unit(LengthUnit::Kilometer), "km"),
            LengthUnit::Foot => (self.in_unit(LengthUnit::Foot), "ft"),
            LengthUnit::Inch => (self.in_unit(LengthUnit::Inch), "in"),
            LengthUnit::Yard => (self.in_unit(LengthUnit::Yard), "yd"),
        };
        write!(f, "{:.4} {}", value, unit_str)
    }
}

/// Force with unit awareness
#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
pub struct Force {
    /// Value in base SI unit (Newtons)
    value_si: f64,
    display_unit: ForceUnit,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum ForceUnit {
    Newton,
    Kilonewton,
    Meganewton,
    PoundForce,
    Kip,
    Kilogram, // kgf
}

impl Force {
    pub fn new(value: f64, unit: ForceUnit) -> Self {
        let value_si = match unit {
            ForceUnit::Newton => value,
            ForceUnit::Kilonewton => value * 1000.0,
            ForceUnit::Meganewton => value * 1e6,
            ForceUnit::PoundForce => value * 4.44822,
            ForceUnit::Kip => value * 4448.22,
            ForceUnit::Kilogram => value * 9.80665,
        };
        Self { value_si, display_unit: unit }
    }

    pub fn in_unit(&self, unit: ForceUnit) -> f64 {
        match unit {
            ForceUnit::Newton => self.value_si,
            ForceUnit::Kilonewton => self.value_si / 1000.0,
            ForceUnit::Meganewton => self.value_si / 1e6,
            ForceUnit::PoundForce => self.value_si / 4.44822,
            ForceUnit::Kip => self.value_si / 4448.22,
            ForceUnit::Kilogram => self.value_si / 9.80665,
        }
    }

    pub fn si(&self) -> f64 { self.value_si }
    pub fn newtons(value: f64) -> Self { Self::new(value, ForceUnit::Newton) }
    pub fn kn(value: f64) -> Self { Self::new(value, ForceUnit::Kilonewton) }
    pub fn kips(value: f64) -> Self { Self::new(value, ForceUnit::Kip) }
}

/// Stress/Pressure with unit awareness
#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
pub struct Stress {
    /// Value in base SI unit (Pascals)
    value_si: f64,
    display_unit: StressUnit,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum StressUnit {
    Pascal,
    Kilopascal,
    Megapascal,
    Gigapascal,
    Psi,
    Ksi,
    Bar,
}

impl Stress {
    pub fn new(value: f64, unit: StressUnit) -> Self {
        let value_si = match unit {
            StressUnit::Pascal => value,
            StressUnit::Kilopascal => value * 1e3,
            StressUnit::Megapascal => value * 1e6,
            StressUnit::Gigapascal => value * 1e9,
            StressUnit::Psi => value * 6894.76,
            StressUnit::Ksi => value * 6.89476e6,
            StressUnit::Bar => value * 1e5,
        };
        Self { value_si, display_unit: unit }
    }

    pub fn in_unit(&self, unit: StressUnit) -> f64 {
        match unit {
            StressUnit::Pascal => self.value_si,
            StressUnit::Kilopascal => self.value_si / 1e3,
            StressUnit::Megapascal => self.value_si / 1e6,
            StressUnit::Gigapascal => self.value_si / 1e9,
            StressUnit::Psi => self.value_si / 6894.76,
            StressUnit::Ksi => self.value_si / 6.89476e6,
            StressUnit::Bar => self.value_si / 1e5,
        }
    }

    pub fn si(&self) -> f64 { self.value_si }
    pub fn mpa(value: f64) -> Self { Self::new(value, StressUnit::Megapascal) }
    pub fn ksi(value: f64) -> Self { Self::new(value, StressUnit::Ksi) }
    pub fn psi(value: f64) -> Self { Self::new(value, StressUnit::Psi) }
}

/// Moment with unit awareness
#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
pub struct Moment {
    /// Value in base SI unit (Newton-meters)
    value_si: f64,
    display_unit: MomentUnit,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum MomentUnit {
    NewtonMeter,
    KilonewtonMeter,
    NewtonMillimeter,
    PoundFoot,
    KipFoot,
    KipInch,
}

impl Moment {
    pub fn new(value: f64, unit: MomentUnit) -> Self {
        let value_si = match unit {
            MomentUnit::NewtonMeter => value,
            MomentUnit::KilonewtonMeter => value * 1000.0,
            MomentUnit::NewtonMillimeter => value * 0.001,
            MomentUnit::PoundFoot => value * 1.35582,
            MomentUnit::KipFoot => value * 1355.82,
            MomentUnit::KipInch => value * 112.985,
        };
        Self { value_si, display_unit: unit }
    }

    pub fn si(&self) -> f64 { self.value_si }
    pub fn knm(value: f64) -> Self { Self::new(value, MomentUnit::KilonewtonMeter) }
    pub fn kip_ft(value: f64) -> Self { Self::new(value, MomentUnit::KipFoot) }
}

/// Area with unit awareness
#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
pub struct Area {
    /// Value in base SI unit (m²)
    value_si: f64,
    display_unit: AreaUnit,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum AreaUnit {
    SquareMeter,
    SquareMillimeter,
    SquareCentimeter,
    SquareFoot,
    SquareInch,
}

impl Area {
    pub fn new(value: f64, unit: AreaUnit) -> Self {
        let value_si = match unit {
            AreaUnit::SquareMeter => value,
            AreaUnit::SquareMillimeter => value * 1e-6,
            AreaUnit::SquareCentimeter => value * 1e-4,
            AreaUnit::SquareFoot => value * 0.092903,
            AreaUnit::SquareInch => value * 0.00064516,
        };
        Self { value_si, display_unit: unit }
    }

    pub fn si(&self) -> f64 { self.value_si }
    pub fn mm2(value: f64) -> Self { Self::new(value, AreaUnit::SquareMillimeter) }
    pub fn in2(value: f64) -> Self { Self::new(value, AreaUnit::SquareInch) }
}

// ============================================================================
// TOLERANCE GUARDS
// ============================================================================

/// Tolerance configuration for numerical comparisons
#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
pub struct ToleranceConfig {
    /// Absolute tolerance for near-zero comparisons
    pub absolute: f64,
    /// Relative tolerance for general comparisons
    pub relative: f64,
    /// Length tolerance (mm)
    pub length_mm: f64,
    /// Force tolerance (N)
    pub force_n: f64,
    /// Stress tolerance (Pa)
    pub stress_pa: f64,
    /// Angle tolerance (radians)
    pub angle_rad: f64,
}

impl Default for ToleranceConfig {
    fn default() -> Self {
        Self {
            absolute: 1e-10,
            relative: 1e-6,
            length_mm: 0.1,      // 0.1 mm
            force_n: 1.0,        // 1 N
            stress_pa: 1000.0,   // 1 kPa
            angle_rad: 1e-6,     // ~0.00006 degrees
        }
    }
}

/// Strict tolerance for high-precision applications
impl ToleranceConfig {
    pub fn strict() -> Self {
        Self {
            absolute: 1e-12,
            relative: 1e-9,
            length_mm: 0.01,
            force_n: 0.1,
            stress_pa: 100.0,
            angle_rad: 1e-9,
        }
    }

    pub fn relaxed() -> Self {
        Self {
            absolute: 1e-6,
            relative: 1e-3,
            length_mm: 1.0,
            force_n: 10.0,
            stress_pa: 10000.0,
            angle_rad: 1e-4,
        }
    }
}

/// Tolerance-aware comparison utilities
pub struct ToleranceGuard {
    config: ToleranceConfig,
}

impl ToleranceGuard {
    pub fn new(config: ToleranceConfig) -> Self {
        Self { config }
    }

    pub fn default_guard() -> Self {
        Self::new(ToleranceConfig::default())
    }

    /// Check if two values are approximately equal
    pub fn approx_eq(&self, a: f64, b: f64) -> bool {
        let diff = (a - b).abs();
        let max_abs = a.abs().max(b.abs());
        
        // Use absolute tolerance for small values
        if max_abs < self.config.absolute {
            return diff < self.config.absolute;
        }
        
        // Use relative tolerance for larger values
        diff / max_abs < self.config.relative
    }

    /// Check if value is approximately zero
    pub fn is_zero(&self, value: f64) -> bool {
        value.abs() < self.config.absolute
    }

    /// Check if lengths are equal within tolerance
    pub fn lengths_eq(&self, a: &Length, b: &Length) -> bool {
        let diff_mm = (a.in_unit(LengthUnit::Millimeter) - b.in_unit(LengthUnit::Millimeter)).abs();
        diff_mm < self.config.length_mm
    }

    /// Check if forces are equal within tolerance
    pub fn forces_eq(&self, a: &Force, b: &Force) -> bool {
        let diff_n = (a.si() - b.si()).abs();
        diff_n < self.config.force_n
    }

    /// Check if stresses are equal within tolerance
    pub fn stresses_eq(&self, a: &Stress, b: &Stress) -> bool {
        let diff_pa = (a.si() - b.si()).abs();
        diff_pa < self.config.stress_pa
    }

    /// Clamp to zero if within tolerance
    pub fn clamp_zero(&self, value: f64) -> f64 {
        if self.is_zero(value) { 0.0 } else { value }
    }

    /// Round to significant figures based on tolerance
    pub fn round_to_tolerance(&self, value: f64) -> f64 {
        if self.is_zero(value) {
            return 0.0;
        }
        let sig_figs = (-self.config.relative.log10()).ceil() as i32;
        let multiplier = 10_f64.powi(sig_figs - 1 - value.abs().log10().floor() as i32);
        (value * multiplier).round() / multiplier
    }
}

// ============================================================================
// INPUT VALIDATION
// ============================================================================

/// Validation result for engineering inputs
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ValidationResult {
    pub is_valid: bool,
    pub errors: Vec<ValidationError>,
    pub warnings: Vec<ValidationWarning>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ValidationError {
    pub field: String,
    pub message: String,
    pub code: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ValidationWarning {
    pub field: String,
    pub message: String,
    pub suggestion: Option<String>,
}

/// Input validator for engineering values
pub struct InputValidator {
    tolerance: ToleranceGuard,
}

impl InputValidator {
    pub fn new() -> Self {
        Self {
            tolerance: ToleranceGuard::default_guard(),
        }
    }

    /// Validate a length value
    pub fn validate_length(&self, value: f64, field: &str, min: Option<f64>, max: Option<f64>) -> ValidationResult {
        let mut errors = Vec::new();
        let mut warnings = Vec::new();

        // Check for NaN/Infinity
        if value.is_nan() {
            errors.push(ValidationError {
                field: field.to_string(),
                message: "Length value is NaN".to_string(),
                code: "E001_NAN".to_string(),
            });
        } else if value.is_infinite() {
            errors.push(ValidationError {
                field: field.to_string(),
                message: "Length value is infinite".to_string(),
                code: "E002_INF".to_string(),
            });
        }

        // Check for negative length
        if value < 0.0 {
            errors.push(ValidationError {
                field: field.to_string(),
                message: "Length cannot be negative".to_string(),
                code: "E003_NEG_LENGTH".to_string(),
            });
        }

        // Check bounds
        if let Some(min_val) = min {
            if value < min_val {
                errors.push(ValidationError {
                    field: field.to_string(),
                    message: format!("Length {} is below minimum {}", value, min_val),
                    code: "E004_BELOW_MIN".to_string(),
                });
            }
        }

        if let Some(max_val) = max {
            if value > max_val {
                errors.push(ValidationError {
                    field: field.to_string(),
                    message: format!("Length {} exceeds maximum {}", value, max_val),
                    code: "E005_ABOVE_MAX".to_string(),
                });
            }
        }

        // Warn for very small values
        if value > 0.0 && value < 0.001 {
            warnings.push(ValidationWarning {
                field: field.to_string(),
                message: "Length is very small (< 1mm)".to_string(),
                suggestion: Some("Verify this value is intentional".to_string()),
            });
        }

        ValidationResult {
            is_valid: errors.is_empty(),
            errors,
            warnings,
        }
    }

    /// Validate a force value
    pub fn validate_force(&self, value: f64, field: &str) -> ValidationResult {
        let mut errors = Vec::new();
        let warnings = Vec::new();

        if value.is_nan() {
            errors.push(ValidationError {
                field: field.to_string(),
                message: "Force value is NaN".to_string(),
                code: "E001_NAN".to_string(),
            });
        } else if value.is_infinite() {
            errors.push(ValidationError {
                field: field.to_string(),
                message: "Force value is infinite".to_string(),
                code: "E002_INF".to_string(),
            });
        }

        ValidationResult {
            is_valid: errors.is_empty(),
            errors,
            warnings,
        }
    }

    /// Validate material properties
    pub fn validate_material(&self, e: f64, fy: f64, fu: Option<f64>) -> ValidationResult {
        let mut errors = Vec::new();
        let mut warnings = Vec::new();

        // Modulus of elasticity checks
        if e <= 0.0 {
            errors.push(ValidationError {
                field: "E".to_string(),
                message: "Elastic modulus must be positive".to_string(),
                code: "E010_INVALID_E".to_string(),
            });
        }

        // Steel E should be around 200-210 GPa
        if e > 0.0 && (e < 1e9 || e > 1e12) {
            warnings.push(ValidationWarning {
                field: "E".to_string(),
                message: format!("Elastic modulus {} Pa seems unusual", e),
                suggestion: Some("Typical steel E is ~200 GPa, concrete ~25-40 GPa".to_string()),
            });
        }

        // Yield strength checks
        if fy <= 0.0 {
            errors.push(ValidationError {
                field: "fy".to_string(),
                message: "Yield strength must be positive".to_string(),
                code: "E011_INVALID_FY".to_string(),
            });
        }

        // Ultimate strength should exceed yield
        if let Some(fu_val) = fu {
            if fu_val <= fy {
                errors.push(ValidationError {
                    field: "fu".to_string(),
                    message: "Ultimate strength must exceed yield strength".to_string(),
                    code: "E012_FU_LT_FY".to_string(),
                });
            }
        }

        ValidationResult {
            is_valid: errors.is_empty(),
            errors,
            warnings,
        }
    }

    /// Validate section dimensions
    pub fn validate_section(&self, depth: f64, width: f64, thickness: Option<f64>) -> ValidationResult {
        let mut errors = Vec::new();
        let mut warnings = Vec::new();

        if depth <= 0.0 {
            errors.push(ValidationError {
                field: "depth".to_string(),
                message: "Section depth must be positive".to_string(),
                code: "E020_INVALID_DEPTH".to_string(),
            });
        }

        if width <= 0.0 {
            errors.push(ValidationError {
                field: "width".to_string(),
                message: "Section width must be positive".to_string(),
                code: "E021_INVALID_WIDTH".to_string(),
            });
        }

        // Check aspect ratio
        if depth > 0.0 && width > 0.0 {
            let aspect = depth / width;
            if aspect > 20.0 || aspect < 0.05 {
                warnings.push(ValidationWarning {
                    field: "aspect_ratio".to_string(),
                    message: format!("Unusual aspect ratio: {:.2}", aspect),
                    suggestion: Some("Verify section dimensions".to_string()),
                });
            }
        }

        if let Some(t) = thickness {
            if t <= 0.0 {
                errors.push(ValidationError {
                    field: "thickness".to_string(),
                    message: "Thickness must be positive".to_string(),
                    code: "E022_INVALID_THICKNESS".to_string(),
                });
            }

            // Thickness should be less than half the smaller dimension
            let min_dim = depth.min(width);
            if t > min_dim / 2.0 {
                errors.push(ValidationError {
                    field: "thickness".to_string(),
                    message: "Thickness exceeds half the section dimension".to_string(),
                    code: "E023_THICKNESS_TOO_LARGE".to_string(),
                });
            }
        }

        ValidationResult {
            is_valid: errors.is_empty(),
            errors,
            warnings,
        }
    }
}

impl Default for InputValidator {
    fn default() -> Self {
        Self::new()
    }
}

// ============================================================================
// UNIT CONVERSION UTILITIES
// ============================================================================

/// Batch unit conversion for arrays
pub fn convert_lengths(values: &[f64], from: LengthUnit, to: LengthUnit) -> Vec<f64> {
    values.iter()
        .map(|&v| Length::new(v, from).in_unit(to))
        .collect()
}

pub fn convert_forces(values: &[f64], from: ForceUnit, to: ForceUnit) -> Vec<f64> {
    values.iter()
        .map(|&v| Force::new(v, from).in_unit(to))
        .collect()
}

pub fn convert_stresses(values: &[f64], from: StressUnit, to: StressUnit) -> Vec<f64> {
    values.iter()
        .map(|&v| Stress::new(v, from).in_unit(to))
        .collect()
}

// ============================================================================
// TESTS
// ============================================================================

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_length_conversion() {
        let l = Length::meters(1.0);
        assert!((l.in_unit(LengthUnit::Millimeter) - 1000.0).abs() < 1e-6);
        assert!((l.in_unit(LengthUnit::Foot) - 3.28084).abs() < 0.001);
        
        let l2 = Length::feet(10.0);
        assert!((l2.in_unit(LengthUnit::Meter) - 3.048).abs() < 0.001);
    }

    #[test]
    fn test_force_conversion() {
        let f = Force::kn(100.0);
        assert!((f.si() - 100000.0).abs() < 1e-6);
        
        let f2 = Force::kips(10.0);
        assert!((f2.in_unit(ForceUnit::Kilonewton) - 44.482).abs() < 0.01);
    }

    #[test]
    fn test_stress_conversion() {
        let s = Stress::mpa(345.0);
        assert!((s.in_unit(StressUnit::Ksi) - 50.038).abs() < 0.01);
    }

    #[test]
    fn test_tolerance_guard() {
        let guard = ToleranceGuard::default_guard();
        
        assert!(guard.approx_eq(1.0, 1.0 + 1e-9));
        assert!(!guard.approx_eq(1.0, 1.001));
        assert!(guard.is_zero(1e-12));
        assert!(!guard.is_zero(1e-5));
    }

    #[test]
    fn test_input_validation() {
        let validator = InputValidator::new();
        
        // Valid length
        let result = validator.validate_length(100.0, "span", Some(0.0), Some(1000.0));
        assert!(result.is_valid);
        
        // Invalid negative length
        let result = validator.validate_length(-10.0, "depth", None, None);
        assert!(!result.is_valid);
        assert_eq!(result.errors[0].code, "E003_NEG_LENGTH");
        
        // Invalid NaN
        let result = validator.validate_length(f64::NAN, "width", None, None);
        assert!(!result.is_valid);
    }

    #[test]
    fn test_material_validation() {
        let validator = InputValidator::new();
        
        // Valid steel
        let result = validator.validate_material(200e9, 345e6, Some(450e6));
        assert!(result.is_valid);
        
        // Invalid: fu < fy
        let result = validator.validate_material(200e9, 345e6, Some(300e6));
        assert!(!result.is_valid);
    }
}
