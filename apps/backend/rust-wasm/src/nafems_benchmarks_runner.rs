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

