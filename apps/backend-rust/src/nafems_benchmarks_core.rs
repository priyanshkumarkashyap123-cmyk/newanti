//! NAFEMS Benchmark Validation Tests
//!
//! Standard benchmark problems from NAFEMS (National Agency for Finite Element
//! Methods and Standards) to validate FEA implementation accuracy.
//!
//! ## Benchmark Categories
//! - **LE** - Linear Elastic verification
//! - **NL** - Nonlinear analysis
//! - **T** - Thermal analysis
//! - **FV** - Free vibration
//! - **IC** - Impact/Contact
//!
//! ## Reference Documents
//! - NAFEMS LE1-LE11: Linear elastic benchmarks
//! - NAFEMS FV12-FV72: Free vibration benchmarks
//! - NAFEMS NL1-NL7: Nonlinear benchmarks
//!
//! All target values are from published NAFEMS benchmark specifications.

use serde::{Deserialize, Serialize};

// ============================================================================
// BENCHMARK RESULT TRACKING
// ============================================================================

/// Benchmark test result
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BenchmarkResult {
    pub name: String,
    pub category: BenchmarkCategory,
    pub target_value: f64,
    pub computed_value: f64,
    pub unit: String,
    pub error_percent: f64,
    pub tolerance_percent: f64,
    pub passed: bool,
    pub notes: String,
}

/// Benchmark categories
#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq)]
pub enum BenchmarkCategory {
    LinearElastic,
    FreeVibration,
    Nonlinear,
    Thermal,
    Contact,
}

impl BenchmarkResult {
    pub fn new(
        name: &str,
        category: BenchmarkCategory,
        target: f64,
        computed: f64,
        unit: &str,
        tolerance: f64,
    ) -> Self {
        let error = if target.abs() > 1e-14 {
            100.0 * (computed - target).abs() / target.abs()
        } else {
            computed.abs() * 100.0
        };
        
        BenchmarkResult {
            name: name.to_string(),
            category,
            target_value: target,
            computed_value: computed,
            unit: unit.to_string(),
            error_percent: error,
            tolerance_percent: tolerance,
            passed: error <= tolerance,
            notes: String::new(),
        }
    }

    pub fn with_notes(mut self, notes: &str) -> Self {
        self.notes = notes.to_string();
        self
    }
}

/// Benchmark suite results
#[derive(Debug, Clone)]
pub struct BenchmarkSuite {
    pub name: String,
    pub results: Vec<BenchmarkResult>,
    pub total_tests: usize,
    pub passed_tests: usize,
}

impl BenchmarkSuite {
    pub fn new(name: &str) -> Self {
        BenchmarkSuite {
            name: name.to_string(),
            results: Vec::new(),
            total_tests: 0,
            passed_tests: 0,
        }
    }

    pub fn add_result(&mut self, result: BenchmarkResult) {
        self.total_tests += 1;
        if result.passed {
            self.passed_tests += 1;
        }
        self.results.push(result);
    }

    pub fn pass_rate(&self) -> f64 {
        if self.total_tests > 0 {
            100.0 * self.passed_tests as f64 / self.total_tests as f64
        } else {
            0.0
        }
    }

    pub fn summary(&self) -> String {
        format!(
            "{}: {}/{} tests passed ({:.1}%)",
            self.name, self.passed_tests, self.total_tests, self.pass_rate()
        )
    }
}

// ============================================================================
// NAFEMS LE1 - ELLIPTIC MEMBRANE
// ============================================================================

/// NAFEMS LE1: Elliptic membrane under uniform pressure
/// 
/// Tests plane stress analysis with curved boundaries
/// Target: σyy at point D = 92.7 MPa
pub struct NafemsLE1 {
    pub a: f64,          // Semi-major axis (2.0 m)
    pub b: f64,          // Semi-minor axis (1.0 m)
    pub thickness: f64,  // Thickness (0.1 m)
    pub e: f64,          // Young's modulus (210 GPa)
    pub nu: f64,         // Poisson's ratio (0.3)
    pub pressure: f64,   // Internal pressure (10 MPa)
}

impl Default for NafemsLE1 {
    fn default() -> Self {
        NafemsLE1 {
            a: 2.0,
            b: 1.0,
            thickness: 0.1,
            e: 210e9,
            nu: 0.3,
            pressure: 10e6,
        }
    }
}

impl NafemsLE1 {
    pub const TARGET_STRESS_YY: f64 = 92.7e6;  // Pa at point D
    
    /// Analytical solution for hoop stress at point D (y=0, x=a)
    pub fn analytical_stress(&self) -> f64 {
        // For elliptic membrane under internal pressure
        // σyy at end of major axis
        self.pressure * self.a / self.thickness
    }

    /// Run benchmark and return result
    pub fn validate(&self, computed_stress: f64) -> BenchmarkResult {
        BenchmarkResult::new(
            "NAFEMS LE1 - Elliptic Membrane",
            BenchmarkCategory::LinearElastic,
            Self::TARGET_STRESS_YY,
            computed_stress,
            "Pa",
            2.0,  // 2% tolerance
        ).with_notes("σyy at point D on major axis")
    }
}

// ============================================================================
// NAFEMS LE3 - HEMISPHERE POINT LOADS
// ============================================================================

/// NAFEMS LE3: Hemispherical shell with point loads
///
/// Tests shell element accuracy with double curvature
/// Target: Radial displacement = 0.185 m (at load points)
pub struct NafemsLE3 {
    pub radius: f64,     // 10.0 m
    pub thickness: f64,  // 0.04 m
    pub e: f64,          // 68.25 MPa
    pub nu: f64,         // 0.3
    pub load: f64,       // 2.0 kN point loads
}

impl Default for NafemsLE3 {
    fn default() -> Self {
        NafemsLE3 {
            radius: 10.0,
            thickness: 0.04,
            e: 68.25e6,
            nu: 0.3,
            load: 2.0e3,
        }
    }
}

impl NafemsLE3 {
    pub const TARGET_DISPLACEMENT: f64 = 0.185;  // meters
    
    pub fn validate(&self, computed_disp: f64) -> BenchmarkResult {
        BenchmarkResult::new(
            "NAFEMS LE3 - Hemisphere Point Loads",
            BenchmarkCategory::LinearElastic,
            Self::TARGET_DISPLACEMENT,
            computed_disp,
            "m",
            2.0,
        ).with_notes("Radial displacement at load application point")
    }
}

// ============================================================================
// NAFEMS LE5 - Z-SECTION CANTILEVER
// ============================================================================

/// NAFEMS LE5: Z-section cantilever under torsion
///
/// Tests warping and torsion in thin-walled sections
/// Target: Axial stress σxx = -108 MPa at point A
pub struct NafemsLE5 {
    pub length: f64,     // 10.0 m
    pub height: f64,     // 2.0 m  
    pub width: f64,      // 1.0 m
    pub thickness: f64,  // 0.1 m
    pub e: f64,          // 210 GPa
    pub nu: f64,         // 0.3
    pub torque: f64,     // Applied moment
}

impl Default for NafemsLE5 {
    fn default() -> Self {
        NafemsLE5 {
            length: 10.0,
            height: 2.0,
            width: 1.0,
            thickness: 0.1,
            e: 210e9,
            nu: 0.3,
            torque: 1.2e6,  // N-m
        }
    }
}

impl NafemsLE5 {
    pub const TARGET_STRESS: f64 = -108e6;  // Pa
    
    pub fn validate(&self, computed_stress: f64) -> BenchmarkResult {
        BenchmarkResult::new(
            "NAFEMS LE5 - Z-Section Cantilever",
            BenchmarkCategory::LinearElastic,
            Self::TARGET_STRESS,
            computed_stress,
            "Pa",
            2.0,
        ).with_notes("Axial stress σxx at point A")
    }
}

// ============================================================================
// NAFEMS LE10 - THICK PLATE
// ============================================================================

/// NAFEMS LE10: Thick square plate under pressure
///
/// Tests 3D solid element accuracy
/// Target: σyy = -5.38 MPa at center of top surface
pub struct NafemsLE10 {
    pub side: f64,       // 1.0 m
    pub thickness: f64,  // 0.6 m (thick)
    pub e: f64,          // 210 GPa
    pub nu: f64,         // 0.3
    pub pressure: f64,   // 1.0 MPa
}

impl Default for NafemsLE10 {
    fn default() -> Self {
        NafemsLE10 {
            side: 1.0,
            thickness: 0.6,
            e: 210e9,
            nu: 0.3,
            pressure: 1e6,
        }
    }
}

impl NafemsLE10 {
    pub const TARGET_STRESS: f64 = -5.38e6;  // Pa
    
    pub fn validate(&self, computed_stress: f64) -> BenchmarkResult {
        BenchmarkResult::new(
            "NAFEMS LE10 - Thick Plate",
            BenchmarkCategory::LinearElastic,
            Self::TARGET_STRESS,
            computed_stress,
            "Pa",
            2.0,
        ).with_notes("σyy at center of top surface")
    }
}

// ============================================================================
// NAFEMS FV12 - FREE SQUARE PLATE
// ============================================================================

/// NAFEMS FV12: Free square plate modal analysis
///
/// Tests plate bending modes
/// Target frequencies for first 6 modes
pub struct NafemsFV12 {
    pub side: f64,       // 10.0 m
    pub thickness: f64,  // 0.05 m
    pub e: f64,          // 200 GPa
    pub nu: f64,         // 0.3
    pub density: f64,    // 8000 kg/m³
}

impl Default for NafemsFV12 {
    fn default() -> Self {
        NafemsFV12 {
            side: 10.0,
            thickness: 0.05,
            e: 200e9,
            nu: 0.3,
            density: 8000.0,
        }
    }
}

impl NafemsFV12 {
    /// Target frequencies (Hz) for first 6 modes
    pub const TARGET_FREQUENCIES: [f64; 6] = [
        1.622,   // Mode 1
        2.360,   // Mode 2
        2.922,   // Mode 3
        4.233,   // Mode 4
        4.674,   // Mode 5
        5.825,   // Mode 6
    ];

    pub fn validate(&self, computed_freqs: &[f64]) -> Vec<BenchmarkResult> {
        let mut results = Vec::new();
        
        for (i, target) in Self::TARGET_FREQUENCIES.iter().enumerate() {
            let computed = computed_freqs.get(i).copied().unwrap_or(0.0);
            results.push(BenchmarkResult::new(
                &format!("NAFEMS FV12 Mode {}", i + 1),
                BenchmarkCategory::FreeVibration,
                *target,
                computed,
                "Hz",
                2.0,
            ));
        }
        
        results
    }
}

// ============================================================================
// NAFEMS FV32 - CANTILEVERED BEAM
// ============================================================================

/// NAFEMS FV32: Cantilevered tapered beam
///
/// Tests beam element natural frequencies
pub struct NafemsFV32 {
    pub length: f64,     // 10.0 m
    pub depth_root: f64, // 2.0 m
    pub depth_tip: f64,  // 1.0 m
    pub width: f64,      // 0.5 m
    pub e: f64,          // 200 GPa
    pub density: f64,    // 8000 kg/m³
}

impl Default for NafemsFV32 {
    fn default() -> Self {
        NafemsFV32 {
            length: 10.0,
            depth_root: 2.0,
            depth_tip: 1.0,
            width: 0.5,
            e: 200e9,
            density: 8000.0,
        }
    }
}

impl NafemsFV32 {
    pub const TARGET_FREQUENCY_1: f64 = 7.296;  // Hz
    pub const TARGET_FREQUENCY_2: f64 = 29.51;  // Hz
    
    pub fn validate(&self, freq1: f64, freq2: f64) -> Vec<BenchmarkResult> {
        vec![
            BenchmarkResult::new(
                "NAFEMS FV32 Mode 1",
                BenchmarkCategory::FreeVibration,
                Self::TARGET_FREQUENCY_1,
                freq1,
                "Hz",
                2.0,
            ),
            BenchmarkResult::new(
                "NAFEMS FV32 Mode 2",
                BenchmarkCategory::FreeVibration,
                Self::TARGET_FREQUENCY_2,
                freq2,
                "Hz",
                2.0,
            ),
        ]
    }
}

// ============================================================================
// NAFEMS FV52 - CLAMPED SQUARE PLATE
// ============================================================================

/// NAFEMS FV52: Clamped square plate with central mass
///
/// Tests mass element handling
pub struct NafemsFV52 {
    pub side: f64,       // 10.0 m
    pub thickness: f64,  // 0.05 m
    pub e: f64,          // 200 GPa
    pub nu: f64,         // 0.3
    pub density: f64,    // 8000 kg/m³
    pub central_mass: f64,  // 40 kg
}

impl Default for NafemsFV52 {
    fn default() -> Self {
        NafemsFV52 {
            side: 10.0,
            thickness: 0.05,
            e: 200e9,
            nu: 0.3,
            density: 8000.0,
            central_mass: 40.0,
        }
    }
}

impl NafemsFV52 {
    pub const TARGET_FREQUENCY_1: f64 = 1.722;  // Hz
    
    pub fn validate(&self, freq1: f64) -> BenchmarkResult {
        BenchmarkResult::new(
            "NAFEMS FV52 - Clamped Plate with Mass",
            BenchmarkCategory::FreeVibration,
            Self::TARGET_FREQUENCY_1,
            freq1,
            "Hz",
            2.0,
        )
    }
}

// ============================================================================
// NAFEMS NL1 - ELASTIC-PLASTIC ANALYSIS
// ============================================================================

/// NAFEMS NL1: Elastic-plastic analysis
///
/// Tests material nonlinearity with plasticity
pub struct NafemsNL1 {
    pub e: f64,          // 250 GPa
    pub nu: f64,         // 0.25
    pub yield_stress: f64,  // 5.0 MPa
    pub h: f64,          // Hardening modulus
}

impl Default for NafemsNL1 {
    fn default() -> Self {
        NafemsNL1 {
            e: 250e9,
            nu: 0.25,
            yield_stress: 5e6,
            h: 0.0,  // Perfect plasticity
        }
    }
}

impl NafemsNL1 {
    pub const TARGET_PLASTIC_STRAIN: f64 = 5.0e-3;
    
    pub fn validate(&self, plastic_strain: f64) -> BenchmarkResult {
        BenchmarkResult::new(
            "NAFEMS NL1 - Elastic-Plastic",
            BenchmarkCategory::Nonlinear,
            Self::TARGET_PLASTIC_STRAIN,
            plastic_strain,
            "",
            5.0,  // Larger tolerance for nonlinear
        )
    }
}

// ============================================================================
// NAFEMS NL7 - LARGE DEFLECTION
// ============================================================================

/// NAFEMS NL7: Large deflection of cantilever beam
///
/// Tests geometric nonlinearity
pub struct NafemsNL7 {
    pub length: f64,     // 3.2 m
    pub height: f64,     // 1.0 m (rectangular section)
    pub width: f64,      // 0.1 m
    pub e: f64,          // 210 GPa
    pub load: f64,       // End moment
}

impl Default for NafemsNL7 {
    fn default() -> Self {
        NafemsNL7 {
            length: 3.2,
            height: 1.0,
            width: 0.1,
            e: 210e9,
            load: 2.0e6,  // N-m
        }
    }
}

impl NafemsNL7 {
    // Tip displacement for various load levels
    pub const TARGET_TIP_DISP: f64 = 2.78;  // m for full load
    
    pub fn validate(&self, tip_disp: f64) -> BenchmarkResult {
        BenchmarkResult::new(
            "NAFEMS NL7 - Large Deflection",
            BenchmarkCategory::Nonlinear,
            Self::TARGET_TIP_DISP,
            tip_disp,
            "m",
            5.0,
        ).with_notes("Large deflection cantilever beam")
    }
}

// ============================================================================
// NAFEMS T1 - STEADY-STATE THERMAL
// ============================================================================

/// NAFEMS T1: Steady-state thermal analysis
///
/// Tests thermal conductivity
pub struct NafemsT1 {
    pub length: f64,         // 1.0 m
    pub conductivity: f64,   // 52 W/m-K
    pub temp_left: f64,      // 0°C
    pub temp_right: f64,     // 100°C
}

impl Default for NafemsT1 {
    fn default() -> Self {
        NafemsT1 {
            length: 1.0,
            conductivity: 52.0,
            temp_left: 0.0,
            temp_right: 100.0,
        }
    }
}

impl NafemsT1 {
    pub fn target_temperature(&self, x: f64) -> f64 {
        // Linear distribution for 1D steady state
        self.temp_left + (self.temp_right - self.temp_left) * x / self.length
    }
    
    pub fn validate(&self, x: f64, computed_temp: f64) -> BenchmarkResult {
        let target = self.target_temperature(x);
        BenchmarkResult::new(
            &format!("NAFEMS T1 at x={:.2}m", x),
            BenchmarkCategory::Thermal,
            target,
            computed_temp,
            "°C",
            1.0,
        )
    }
}

// ============================================================================
// TIMOSHENKO BEAM BENCHMARK
// ============================================================================

/// Timoshenko beam: Simply supported beam with central load
///
/// Classic analytical benchmark for beam elements
pub struct TimoshenkoBeam {
    pub length: f64,
    pub width: f64,
    pub height: f64,
    pub e: f64,
    pub nu: f64,
    pub load: f64,
}

impl Default for TimoshenkoBeam {
    fn default() -> Self {
        TimoshenkoBeam {
            length: 10.0,
            width: 0.5,
            height: 1.0,
            e: 200e9,
            nu: 0.3,
            load: 100e3,  // 100 kN
        }
    }
}

impl TimoshenkoBeam {
    /// Exact center deflection including shear
    pub fn exact_deflection(&self) -> f64 {
        let i = self.width * self.height.powi(3) / 12.0;
        let a = self.width * self.height;
        let g = self.e / (2.0 * (1.0 + self.nu));
        let kappa = 5.0 / 6.0;  // Shear correction
        let l = self.length;
        let p = self.load;
        
        // Bending deflection + Shear deflection
        let bending = p * l.powi(3) / (48.0 * self.e * i);
        let shear = p * l / (4.0 * kappa * g * a);
        
        bending + shear
    }

    pub fn validate(&self, computed_disp: f64) -> BenchmarkResult {
        BenchmarkResult::new(
            "Timoshenko Beam - Central Load",
            BenchmarkCategory::LinearElastic,
            self.exact_deflection(),
            computed_disp,
            "m",
            1.0,
        ).with_notes("Simply supported beam with shear deformation")
    }
}

// ============================================================================
// PATCH TEST
// ============================================================================

/// Standard patch test for element validation
///
/// Verifies that elements can represent constant strain states
#[derive(Debug, Clone)]
pub struct PatchTest {
    pub element_type: String,
    pub strain_state: [f64; 3],  // εxx, εyy, γxy
}

impl PatchTest {
    pub fn constant_strain(element_type: &str) -> Self {
        PatchTest {
            element_type: element_type.to_string(),
            strain_state: [1e-4, 1e-4, 0.0],
        }
    }

    pub fn validate(&self, computed_strains: &[[f64; 3]]) -> BenchmarkResult {
        // Check that all elements have the same strain
        let mut max_error: f64 = 0.0;
        
        for strain in computed_strains {
            for i in 0..3 {
                let error = (strain[i] - self.strain_state[i]).abs();
                let rel_error = if self.strain_state[i].abs() > 1e-14 {
                    error / self.strain_state[i].abs()
                } else {
                    error
                };
                max_error = max_error.max(rel_error);
            }
        }
        
        BenchmarkResult::new(
            &format!("Patch Test - {}", self.element_type),
            BenchmarkCategory::LinearElastic,
            0.0,  // Target: zero error
            max_error * 100.0,  // Percent error
            "%",
            0.1,  // Very tight tolerance
        )
    }
}

// ============================================================================
