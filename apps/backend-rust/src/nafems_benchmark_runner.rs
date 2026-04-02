// BENCHMARK RUNNER
// ============================================================================

use crate::nafems_benchmarks_core::*;

/// Run all benchmarks and generate report
pub struct BenchmarkRunner {
    suites: Vec<BenchmarkSuite>,
}

impl BenchmarkRunner {
    pub fn new() -> Self {
        BenchmarkRunner { suites: Vec::new() }
    }

    pub fn add_suite(&mut self, suite: BenchmarkSuite) {
        self.suites.push(suite);
    }

    pub fn total_tests(&self) -> usize {
        self.suites.iter().map(|s| s.total_tests).sum()
    }

    pub fn total_passed(&self) -> usize {
        self.suites.iter().map(|s| s.passed_tests).sum()
    }

    pub fn overall_pass_rate(&self) -> f64 {
        let total = self.total_tests();
        if total > 0 {
            100.0 * self.total_passed() as f64 / total as f64
        } else {
            0.0
        }
    }

    pub fn generate_report(&self) -> String {
        let mut report = String::new();
        
        report.push_str("=".repeat(60).as_str());
        report.push_str("\n  NAFEMS BENCHMARK VALIDATION REPORT\n");
        report.push_str("=".repeat(60).as_str());
        report.push_str("\n\n");
        
        for suite in &self.suites {
            report.push_str(&format!("{}\n", suite.summary()));
            report.push_str("-".repeat(40).as_str());
            report.push_str("\n");
            
            for result in &suite.results {
                let status = if result.passed { "✓" } else { "✗" };
                report.push_str(&format!(
                    "  {} {} | Target: {:.4} {} | Computed: {:.4} {} | Error: {:.2}%\n",
                    status, result.name, result.target_value, result.unit,
                    result.computed_value, result.unit, result.error_percent
                ));
            }
            report.push_str("\n");
        }
        
        report.push_str("=".repeat(60).as_str());
        report.push_str(&format!(
            "\n  OVERALL: {}/{} tests passed ({:.1}%)\n",
            self.total_passed(), self.total_tests(), self.overall_pass_rate()
        ));
        report.push_str("=".repeat(60).as_str());
        
        report
    }
}

impl Default for BenchmarkRunner {
    fn default() -> Self {
        Self::new()
    }
}

// ============================================================================
// ANALYTICAL SOLUTIONS LIBRARY
// ============================================================================

/// Collection of analytical solutions for validation
pub struct AnalyticalSolutions;

impl AnalyticalSolutions {
    /// Simply supported plate under uniform pressure (Navier solution)
    pub fn plate_simply_supported_uniform(
        a: f64,      // Length
        b: f64,      // Width  
        h: f64,      // Thickness
        e: f64,      // Young's modulus
        nu: f64,     // Poisson's ratio
        q: f64,      // Pressure
        x: f64,      // Point x
        y: f64,      // Point y
    ) -> f64 {
        let d = e * h.powi(3) / (12.0 * (1.0 - nu * nu));
        let pi = std::f64::consts::PI;
        
        let mut w = 0.0;
        for m in (1..=21).step_by(2) {
            for n in (1..=21).step_by(2) {
                let m_f = m as f64;
                let n_f = n as f64;
                
                let qmn = 16.0 * q / (pi * pi * m_f * n_f);
                let denom = pi.powi(4) * d * 
                    ((m_f / a).powi(2) + (n_f / b).powi(2)).powi(2);
                
                let sin_mx = (m_f * pi * x / a).sin();
                let sin_ny = (n_f * pi * y / b).sin();
                
                w += qmn * sin_mx * sin_ny / denom;
            }
        }
        
        w
    }

    /// Cantilever beam tip deflection (Euler-Bernoulli)
    pub fn cantilever_tip_deflection(
        l: f64,  // Length
        p: f64,  // End load
        e: f64,  // Young's modulus
        i: f64,  // Moment of inertia
    ) -> f64 {
        p * l.powi(3) / (3.0 * e * i)
    }

    /// Natural frequency of simply supported beam
    pub fn beam_natural_frequency(
        n: usize,    // Mode number
        l: f64,      // Length
        e: f64,      // Young's modulus
        i: f64,      // Moment of inertia
        rho: f64,    // Density
        a: f64,      // Cross-section area
    ) -> f64 {
        let pi = std::f64::consts::PI;
        let n_f = n as f64;
        
        (n_f * pi / l).powi(2) * (e * i / (rho * a)).sqrt() / (2.0 * pi)
    }

    /// Circular plate center deflection (clamped edge, uniform load)
    pub fn circular_plate_clamped(
        r: f64,   // Radius
        h: f64,   // Thickness
        e: f64,   // Young's modulus
        nu: f64,  // Poisson's ratio
        q: f64,   // Pressure
    ) -> f64 {
        let d = e * h.powi(3) / (12.0 * (1.0 - nu * nu));
        q * r.powi(4) / (64.0 * d)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_benchmark_result_creation() {
        let result = BenchmarkResult::new(
            "Test",
            BenchmarkCategory::LinearElastic,
            100.0,
            99.0,
            "MPa",
            2.0,
        );
        
        assert!(result.passed);
        assert!((result.error_percent - 1.0).abs() < 0.1);
    }

    #[test]
    fn test_benchmark_result_failure() {
        let result = BenchmarkResult::new(
            "Test",
            BenchmarkCategory::LinearElastic,
            100.0,
            95.0,
            "MPa",
            2.0,  // 2% tolerance
        );
        
        assert!(!result.passed);  // 5% error > 2% tolerance
    }

    #[test]
    fn test_benchmark_suite() {
        let mut suite = BenchmarkSuite::new("Test Suite");
        
        suite.add_result(BenchmarkResult::new(
            "Test 1", BenchmarkCategory::LinearElastic, 100.0, 100.0, "MPa", 2.0
        ));
        suite.add_result(BenchmarkResult::new(
            "Test 2", BenchmarkCategory::LinearElastic, 100.0, 90.0, "MPa", 2.0
        ));
        
        assert_eq!(suite.total_tests, 2);
        assert_eq!(suite.passed_tests, 1);
        assert!((suite.pass_rate() - 50.0).abs() < 0.1);
    }

    #[test]
    fn test_nafems_le1() {
        let le1 = NafemsLE1::default();
        assert!((le1.a - 2.0).abs() < 1e-10);
        
        let result = le1.validate(NafemsLE1::TARGET_STRESS_YY);
        assert!(result.passed);
    }

    #[test]
    fn test_nafems_le3() {
        let le3 = NafemsLE3::default();
        let result = le3.validate(NafemsLE3::TARGET_DISPLACEMENT);
        assert!(result.passed);
    }

    #[test]
    fn test_nafems_fv12() {
        let fv12 = NafemsFV12::default();
        let results = fv12.validate(&NafemsFV12::TARGET_FREQUENCIES);
        
        assert_eq!(results.len(), 6);
        for result in &results {
            assert!(result.passed);
        }
    }

    #[test]
    fn test_nafems_fv32() {
        let fv32 = NafemsFV32::default();
        let results = fv32.validate(
            NafemsFV32::TARGET_FREQUENCY_1,
            NafemsFV32::TARGET_FREQUENCY_2
        );
        
        assert_eq!(results.len(), 2);
    }

    #[test]
    fn test_timoshenko_beam() {
        let beam = TimoshenkoBeam::default();
        let exact = beam.exact_deflection();
        
        assert!(exact > 0.0);
        
        let result = beam.validate(exact);
        assert!(result.passed);
    }

    #[test]
    fn test_patch_test() {
        let patch = PatchTest::constant_strain("QUAD4");
        let strains = vec![
            [1e-4, 1e-4, 0.0],
            [1e-4, 1e-4, 0.0],
            [1e-4, 1e-4, 0.0],
        ];
        
        let result = patch.validate(&strains);
        assert!(result.passed);
    }

    #[test]
    fn test_benchmark_runner() {
        let mut runner = BenchmarkRunner::new();
        
        let mut suite = BenchmarkSuite::new("Test");
        suite.add_result(BenchmarkResult::new(
            "Test", BenchmarkCategory::LinearElastic, 1.0, 1.0, "", 1.0
        ));
        runner.add_suite(suite);
        
        assert_eq!(runner.total_tests(), 1);
        assert_eq!(runner.total_passed(), 1);
    }

    #[test]
    fn test_analytical_cantilever() {
        let defl = AnalyticalSolutions::cantilever_tip_deflection(
            1.0,    // 1 m
            1000.0, // 1 kN
            200e9,  // 200 GPa
            8.33e-6 // I for 100x100mm section
        );
        
        assert!(defl > 0.0);
    }

    #[test]
    fn test_analytical_beam_frequency() {
        let freq = AnalyticalSolutions::beam_natural_frequency(
            1,       // First mode
            10.0,    // 10 m
            200e9,   // 200 GPa
            8.33e-4, // I
            7850.0,  // Steel density
            0.01,    // Area
        );
        
        assert!(freq > 0.0);
    }

    #[test]
    fn test_report_generation() {
        let mut runner = BenchmarkRunner::new();
        let mut suite = BenchmarkSuite::new("Test Suite");
        suite.add_result(BenchmarkResult::new(
            "Test 1", BenchmarkCategory::LinearElastic, 100.0, 100.0, "MPa", 2.0
        ));
        runner.add_suite(suite);
        
        let report = runner.generate_report();
        assert!(report.contains("Test Suite"));
        assert!(report.contains("OVERALL"));
    }

    #[test]
    fn test_nafems_t1() {
        let t1 = NafemsT1::default();
        
        // Check linear distribution
        assert!((t1.target_temperature(0.0) - 0.0).abs() < 1e-10);
        assert!((t1.target_temperature(1.0) - 100.0).abs() < 1e-10);
        assert!((t1.target_temperature(0.5) - 50.0).abs() < 1e-10);
    }
}

