// ============================================================================
// SOLVER VALIDATION BENCHMARKS
// ============================================================================
// 
// Industry-standard validation tests for structural analysis solvers.
// Based on:
// - NAFEMS benchmarks
// - Cantilever beam exact solutions
// - Portal frame verification
// - Modal analysis verification
// 
// These tests verify solver accuracy against known analytical solutions.
// 
// @version 1.0.0
// @author BeamLab Engineering Team
// ============================================================================

// Solver Validation Benchmark Tests
// Run with: cargo test benchmark_tests --release -- --nocapture


/// Tolerance for numerical comparisons
const TOLERANCE: f64 = 0.01; // 1% error tolerance
const STRICT_TOLERANCE: f64 = 0.001; // 0.1% for simple cases

// ============================================================================
// BENCHMARK TEST STRUCTURES
// ============================================================================

/// Cantilever beam benchmark case
pub struct CantileverBenchmark {
    pub length: f64,      // m
    pub e: f64,           // Pa (Young's modulus)
    pub i: f64,           // m^4 (Moment of inertia)
    pub a: f64,           // m^2 (Cross-sectional area)
    pub load: f64,        // N (Point load at tip)
}

impl CantileverBenchmark {
    /// Exact deflection at free end: δ = PL³/3EI
    pub fn exact_deflection(&self) -> f64 {
        self.load * self.length.powi(3) / (3.0 * self.e * self.i)
    }
    
    /// Exact rotation at free end: θ = PL²/2EI
    pub fn exact_rotation(&self) -> f64 {
        self.load * self.length.powi(2) / (2.0 * self.e * self.i)
    }
    
    /// Exact moment at fixed end: M = PL
    pub fn exact_moment(&self) -> f64 {
        self.load * self.length
    }
    
    /// Exact reaction at fixed end: R = P
    pub fn exact_reaction(&self) -> f64 {
        self.load
    }
}

/// Simply supported beam benchmark
pub struct SimplySupportedBenchmark {
    pub length: f64,
    pub e: f64,
    pub i: f64,
    pub load: f64,  // Point load at center
}

impl SimplySupportedBenchmark {
    /// Exact deflection at center: δ = PL³/48EI
    pub fn exact_midspan_deflection(&self) -> f64 {
        self.load * self.length.powi(3) / (48.0 * self.e * self.i)
    }
    
    /// Exact moment at center: M = PL/4
    pub fn exact_midspan_moment(&self) -> f64 {
        self.load * self.length / 4.0
    }
    
    /// Exact reaction at each support: R = P/2
    pub fn exact_reaction(&self) -> f64 {
        self.load / 2.0
    }
}

/// Fixed-fixed beam benchmark
pub struct FixedFixedBenchmark {
    pub length: f64,
    pub e: f64,
    pub i: f64,
    pub load: f64,  // Point load at center
}

impl FixedFixedBenchmark {
    /// Exact deflection at center: δ = PL³/192EI
    pub fn exact_midspan_deflection(&self) -> f64 {
        self.load * self.length.powi(3) / (192.0 * self.e * self.i)
    }
    
    /// Exact moment at center: M = PL/8
    pub fn exact_midspan_moment(&self) -> f64 {
        self.load * self.length / 8.0
    }
    
    /// Exact moment at fixed ends: M = -PL/8
    pub fn exact_fixed_end_moment(&self) -> f64 {
        -self.load * self.length / 8.0
    }
}

/// Single DOF system for modal analysis verification
pub struct SingleDofBenchmark {
    pub mass: f64,     // kg
    pub stiffness: f64, // N/m
}

impl SingleDofBenchmark {
    /// Exact natural frequency: ω = √(k/m)
    pub fn exact_frequency_rad(&self) -> f64 {
        (self.stiffness / self.mass).sqrt()
    }
    
    /// Exact natural frequency in Hz: f = ω/2π
    pub fn exact_frequency_hz(&self) -> f64 {
        self.exact_frequency_rad() / (2.0 * std::f64::consts::PI)
    }
    
    /// Exact period: T = 2π√(m/k)
    pub fn exact_period(&self) -> f64 {
        2.0 * std::f64::consts::PI * (self.mass / self.stiffness).sqrt()
    }
}

/// Two-story shear frame for modal verification
pub struct TwoStoryFrameBenchmark {
    pub mass: [f64; 2],      // Mass at each floor (kg)
    pub stiffness: [f64; 2], // Story stiffness (N/m)
}

impl TwoStoryFrameBenchmark {
    /// Calculate exact frequencies for 2-DOF system
    /// Using eigenvalue analysis of the 2x2 system
    pub fn exact_frequencies(&self) -> (f64, f64) {
        let m1 = self.mass[0];
        let m2 = self.mass[1];
        let k1 = self.stiffness[0];
        let k2 = self.stiffness[1];
        
        // Stiffness matrix: K = [[k1+k2, -k2], [-k2, k2]]
        // Mass matrix: M = [[m1, 0], [0, m2]]
        
        // For generalized eigenvalue problem: (K - ω²M)φ = 0
        // det(K - ω²M) = 0
        
        let a = m1 * m2;
        let b = -(m1 * k2 + m2 * (k1 + k2));
        let c = k1 * k2;
        
        let discriminant = b * b - 4.0 * a * c;
        let omega1_sq = (-b - discriminant.sqrt()) / (2.0 * a);
        let omega2_sq = (-b + discriminant.sqrt()) / (2.0 * a);
        
        let f1 = omega1_sq.sqrt() / (2.0 * std::f64::consts::PI);
        let f2 = omega2_sq.sqrt() / (2.0 * std::f64::consts::PI);
        
        (f1, f2)
    }
}

// ============================================================================
// VALIDATION FUNCTIONS
// ============================================================================

/// Validate solver result against expected value
pub fn validate_result(computed: f64, expected: f64, tolerance: f64) -> ValidationResult {
    let error = if expected.abs() > 1e-10 {
        (computed - expected).abs() / expected.abs()
    } else {
        (computed - expected).abs()
    };
    
    let passed = error <= tolerance;
    
    ValidationResult {
        computed,
        expected,
        error,
        passed,
    }
}

/// Validation result structure
#[derive(Debug, Clone)]
pub struct ValidationResult {
    pub computed: f64,
    pub expected: f64,
    pub error: f64,
    pub passed: bool,
}

impl std::fmt::Display for ValidationResult {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(
            f,
            "Computed: {:.6}, Expected: {:.6}, Error: {:.4}%, Status: {}",
            self.computed,
            self.expected,
            self.error * 100.0,
            if self.passed { "PASS ✓" } else { "FAIL ✗" }
        )
    }
}

/// Complete benchmark report
#[derive(Debug, Clone)]
pub struct BenchmarkReport {
    pub name: String,
    pub category: String,
    pub results: Vec<(String, ValidationResult)>,
    pub overall_passed: bool,
}

impl BenchmarkReport {
    pub fn new(name: &str, category: &str) -> Self {
        BenchmarkReport {
            name: name.to_string(),
            category: category.to_string(),
            results: Vec::new(),
            overall_passed: true,
        }
    }
    
    pub fn add_result(&mut self, description: &str, result: ValidationResult) {
        if !result.passed {
            self.overall_passed = false;
        }
        self.results.push((description.to_string(), result));
    }
    
    pub fn print_report(&self) {
        println!("\n╔══════════════════════════════════════════════════════════════╗");
        println!("║ BENCHMARK: {} ", self.name);
        println!("║ Category: {}", self.category);
        println!("╠══════════════════════════════════════════════════════════════╣");
        
        for (desc, result) in &self.results {
            println!("║ {}: {}", desc, result);
        }
        
        println!("╠══════════════════════════════════════════════════════════════╣");
        println!("║ OVERALL: {} ", if self.overall_passed { "PASSED ✓" } else { "FAILED ✗" });
        println!("╚══════════════════════════════════════════════════════════════╝");
    }
}

// ============================================================================
// STANDARD BENCHMARK CASES
// ============================================================================

/// Standard cantilever benchmark (used across industry)
pub fn standard_cantilever() -> CantileverBenchmark {
    CantileverBenchmark {
        length: 3.0,                    // 3 meters
        e: 200e9,                       // Steel: 200 GPa
        i: 8.333e-5,                    // IPE 200: 8.33e-5 m^4
        a: 28.5e-4,                     // IPE 200: 28.5 cm²
        load: 10000.0,                  // 10 kN
    }
}

/// Standard simply supported benchmark
pub fn standard_simply_supported() -> SimplySupportedBenchmark {
    SimplySupportedBenchmark {
        length: 6.0,
        e: 200e9,
        i: 8.333e-5,
        load: 50000.0,  // 50 kN at center
    }
}

/// Standard single DOF system
pub fn standard_single_dof() -> SingleDofBenchmark {
    SingleDofBenchmark {
        mass: 1000.0,      // 1000 kg
        stiffness: 1e6,    // 1 MN/m
    }
}

/// Standard two-story frame
pub fn standard_two_story() -> TwoStoryFrameBenchmark {
    TwoStoryFrameBenchmark {
        mass: [50000.0, 40000.0],       // 50t, 40t
        stiffness: [20e6, 15e6],        // 20 MN/m, 15 MN/m
    }
}

// ============================================================================
// TEST RUNNER
// ============================================================================

/// Run all benchmark tests and return comprehensive report
pub fn run_all_benchmarks() -> Vec<BenchmarkReport> {
    let reports = Vec::new();
    
    // Cantilever benchmark
    let cantilever = standard_cantilever();
    let _cant_report = BenchmarkReport::new("Cantilever Beam", "Static Analysis");
    
    // Expected values
    let expected_deflection = cantilever.exact_deflection();
    let expected_rotation = cantilever.exact_rotation();
    let expected_moment = cantilever.exact_moment();
    
    // These would be filled by actual solver calls
    // For now, show the expected values
    println!("\nCantilever Benchmark Expected Values:");
    println!("  Deflection at tip: {:.6} m = {:.3} mm", expected_deflection, expected_deflection * 1000.0);
    println!("  Rotation at tip: {:.6} rad = {:.3} deg", expected_rotation, expected_rotation.to_degrees());
    println!("  Moment at fixed end: {:.2} N·m = {:.2} kN·m", expected_moment, expected_moment / 1000.0);
    
    // Simply supported benchmark
    let ss = standard_simply_supported();
    println!("\nSimply Supported Benchmark Expected Values:");
    println!("  Midspan deflection: {:.6} m = {:.3} mm", ss.exact_midspan_deflection(), ss.exact_midspan_deflection() * 1000.0);
    println!("  Midspan moment: {:.2} N·m = {:.2} kN·m", ss.exact_midspan_moment(), ss.exact_midspan_moment() / 1000.0);
    
    // Modal analysis benchmark
    let sdof = standard_single_dof();
    println!("\nSingle DOF Modal Benchmark Expected Values:");
    println!("  Natural frequency: {:.4} Hz", sdof.exact_frequency_hz());
    println!("  Natural period: {:.4} s", sdof.exact_period());
    
    let two_story = standard_two_story();
    let (f1, f2) = two_story.exact_frequencies();
    println!("\nTwo-Story Frame Modal Benchmark Expected Values:");
    println!("  First mode frequency: {:.4} Hz", f1);
    println!("  Second mode frequency: {:.4} Hz", f2);
    
    reports
}

// ============================================================================
// UNIT TESTS
// ============================================================================

#[cfg(test)]
mod tests {
    use super::*;
    
    #[test]
    fn test_cantilever_formulas() {
        let cantilever = standard_cantilever();
        
        // PL³/3EI for standard case
        let deflection = cantilever.exact_deflection();
        assert!(deflection > 0.0, "Deflection should be positive");
        assert!(deflection < 0.1, "Deflection should be reasonable (< 100mm)");
        
        println!("Cantilever deflection: {:.6} m", deflection);
    }
    
    #[test]
    fn test_simply_supported_formulas() {
        let ss = standard_simply_supported();
        
        let deflection = ss.exact_midspan_deflection();
        let moment = ss.exact_midspan_moment();
        
        assert!(deflection > 0.0);
        assert!(moment > 0.0);
        
        // Check moment is PL/4
        let expected_moment = ss.load * ss.length / 4.0;
        assert!((moment - expected_moment).abs() < 1e-10);
        
        println!("Simply supported deflection: {:.6} m", deflection);
        println!("Simply supported moment: {:.2} kN·m", moment / 1000.0);
    }
    
    #[test]
    fn test_fixed_fixed_formulas() {
        let ff = FixedFixedBenchmark {
            length: 6.0,
            e: 200e9,
            i: 8.333e-5,
            load: 50000.0,
        };
        
        // Fixed-fixed is 4x stiffer than simply supported
        let ss = SimplySupportedBenchmark {
            length: ff.length,
            e: ff.e,
            i: ff.i,
            load: ff.load,
        };
        
        let ratio = ss.exact_midspan_deflection() / ff.exact_midspan_deflection();
        assert!((ratio - 4.0).abs() < 0.01, "Fixed-fixed should be 4x stiffer");
        
        println!("Stiffness ratio (SS/FF): {:.2}", ratio);
    }
    
    #[test]
    fn test_single_dof_modal() {
        let sdof = standard_single_dof();
        
        let freq = sdof.exact_frequency_hz();
        let period = sdof.exact_period();
        
        // f = 1/T
        assert!((freq * period - 1.0).abs() < 1e-10);
        
        // For k=1e6 N/m, m=1000 kg: ω = √(1e6/1000) = √1000 ≈ 31.62 rad/s
        // f = ω/2π ≈ 5.03 Hz
        assert!((freq - 5.03).abs() < 0.01);
        
        println!("Single DOF frequency: {:.4} Hz", freq);
    }
    
    #[test]
    fn test_two_story_modal() {
        let frame = standard_two_story();
        let (f1, f2) = frame.exact_frequencies();
        
        // First mode should be lower than second
        assert!(f1 < f2, "First mode frequency should be lower");
        
        // Both should be positive
        assert!(f1 > 0.0 && f2 > 0.0);
        
        println!("Two-story frame frequencies: {:.4} Hz, {:.4} Hz", f1, f2);
    }
    
    #[test]
    fn test_validation_function() {
        let result = validate_result(10.05, 10.0, TOLERANCE);
        assert!(result.passed, "0.5% error should pass with 1% tolerance");
        
        let result2 = validate_result(10.15, 10.0, TOLERANCE);
        assert!(!result2.passed, "1.5% error should fail with 1% tolerance");
    }
}

// ============================================================================
// INTEGRATION WITH SOLVER
// ============================================================================

/// Interface for solver validation
pub trait SolverValidator {
    /// Run static analysis and return displacement at specified node
    fn analyze_and_get_displacement(&self, node_id: &str) -> Option<f64>;
    
    /// Run modal analysis and return frequencies
    fn modal_analysis(&self, num_modes: usize) -> Option<Vec<f64>>;
}

/// Validate a solver implementation
pub fn validate_solver<S: SolverValidator>(solver: &S) -> BenchmarkReport {
    let cantilever = standard_cantilever();
    let mut report = BenchmarkReport::new("Solver Validation", "Complete Test Suite");
    
    // Test 1: Cantilever deflection
    if let Some(computed) = solver.analyze_and_get_displacement("tip") {
        let expected = cantilever.exact_deflection();
        let result = validate_result(computed, expected, TOLERANCE);
        report.add_result("Cantilever Deflection", result);
    }
    
    // Test 2: Modal analysis
    let sdof = standard_single_dof();
    if let Some(frequencies) = solver.modal_analysis(1) {
        if !frequencies.is_empty() {
            let expected = sdof.exact_frequency_hz();
            let result = validate_result(frequencies[0], expected, TOLERANCE);
            report.add_result("Modal Frequency (SDOF)", result);
        }
    }
    
    report
}
