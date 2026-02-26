//! # Benchmark Suite
//!
//! Industry-standard benchmarks for civil engineering computations.
//! Measures performance across different problem sizes to establish baselines.
//!
//! ## Benchmark Categories
//! - Matrix operations (assembly, solve, multiply)
//! - Structural analysis (frame, truss, plate)
//! - Mesh operations (generation, LOD, compression)
//! - SIMD operations (vectorized computations)

use super::logging::{ComputationMetrics, PhaseTimer, MemoryEstimator};
use serde::{Deserialize, Serialize};
use wasm_bindgen::prelude::*;

// =============================================================================
// BENCHMARK RESULT
// =============================================================================

/// Result of a single benchmark run
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BenchmarkResult {
    /// Name of the benchmark
    pub name: String,
    /// Problem size parameter
    pub problem_size: usize,
    /// Execution times in milliseconds (multiple runs)
    pub times_ms: Vec<f64>,
    /// Mean execution time
    pub mean_ms: f64,
    /// Standard deviation
    pub std_dev_ms: f64,
    /// Minimum time
    pub min_ms: f64,
    /// Maximum time
    pub max_ms: f64,
    /// Operations per second (throughput)
    pub ops_per_sec: f64,
    /// Memory estimate in bytes
    pub memory_bytes: usize,
}

impl BenchmarkResult {
    /// Calculate statistics from times
    pub fn from_times(name: impl Into<String>, size: usize, times: Vec<f64>, memory: usize) -> Self {
        let n = times.len() as f64;
        let mean = times.iter().sum::<f64>() / n;
        let variance = times.iter().map(|t| (t - mean).powi(2)).sum::<f64>() / n;
        let std_dev = variance.sqrt();
        let min = times.iter().cloned().fold(f64::INFINITY, f64::min);
        let max = times.iter().cloned().fold(f64::NEG_INFINITY, f64::max);
        let ops_per_sec = if mean > 0.0 { 1000.0 / mean } else { 0.0 };

        Self {
            name: name.into(),
            problem_size: size,
            times_ms: times,
            mean_ms: mean,
            std_dev_ms: std_dev,
            min_ms: min,
            max_ms: max,
            ops_per_sec,
            memory_bytes: memory,
        }
    }

    /// Format as a table row
    pub fn to_row(&self) -> String {
        format!(
            "| {:30} | {:>10} | {:>10.3} | {:>10.3} | {:>12.1} | {:>10} |",
            self.name,
            self.problem_size,
            self.mean_ms,
            self.std_dev_ms,
            self.ops_per_sec,
            MemoryEstimator::format_bytes(self.memory_bytes)
        )
    }
}

// =============================================================================
// BENCHMARK SUITE
// =============================================================================

/// Collection of benchmark results
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BenchmarkSuite {
    /// Suite name
    pub name: String,
    /// Results
    pub results: Vec<BenchmarkResult>,
    /// Total execution time
    pub total_time_ms: f64,
    /// Environment info
    pub environment: BenchmarkEnvironment,
}

/// Environment information for reproducibility
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BenchmarkEnvironment {
    /// Platform (native/wasm)
    pub platform: String,
    /// Rust version (if available)
    pub rust_version: String,
    /// Build profile
    pub build_profile: String,
    /// Timestamp
    pub timestamp: String,
}

impl BenchmarkEnvironment {
    /// Detect current environment
    pub fn detect() -> Self {
        Self {
            #[cfg(target_arch = "wasm32")]
            platform: "wasm32".to_string(),
            #[cfg(not(target_arch = "wasm32"))]
            platform: std::env::consts::ARCH.to_string(),
            rust_version: env!("CARGO_PKG_RUST_VERSION", "unknown").to_string(),
            #[cfg(debug_assertions)]
            build_profile: "debug".to_string(),
            #[cfg(not(debug_assertions))]
            build_profile: "release".to_string(),
            timestamp: chrono_lite::now(),
        }
    }
}

/// Simple timestamp without chrono dependency
mod chrono_lite {
    pub fn now() -> String {
        #[cfg(target_arch = "wasm32")]
        {
            // Use JS Date in WASM
            use wasm_bindgen::prelude::*;
            #[wasm_bindgen]
            extern "C" {
                type Date;
                #[wasm_bindgen(constructor)]
                fn new() -> Date;
                #[wasm_bindgen(method, js_name = toISOString)]
                fn to_iso_string(this: &Date) -> String;
            }
            Date::new().to_iso_string()
        }
        #[cfg(not(target_arch = "wasm32"))]
        {
            use std::time::{SystemTime, UNIX_EPOCH};
            let secs = SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .map(|d| d.as_secs())
                .unwrap_or(0);
            format!("{}", secs)
        }
    }
}

impl BenchmarkSuite {
    /// Create a new benchmark suite
    pub fn new(name: impl Into<String>) -> Self {
        Self {
            name: name.into(),
            results: Vec::new(),
            total_time_ms: 0.0,
            environment: BenchmarkEnvironment::detect(),
        }
    }

    /// Add a result
    pub fn add(&mut self, result: BenchmarkResult) {
        self.total_time_ms += result.times_ms.iter().sum::<f64>();
        self.results.push(result);
    }

    /// Generate markdown report
    pub fn to_markdown(&self) -> String {
        let mut md = String::new();
        md.push_str(&format!("# {} Benchmark Results\n\n", self.name));
        md.push_str(&format!("**Platform:** {}\n", self.environment.platform));
        md.push_str(&format!("**Build:** {}\n", self.environment.build_profile));
        md.push_str(&format!("**Date:** {}\n\n", self.environment.timestamp));
        
        md.push_str("| Benchmark | Size | Mean (ms) | Std Dev | Ops/sec | Memory |\n");
        md.push_str("|-----------|------|-----------|---------|---------|--------|\n");
        
        for result in &self.results {
            md.push_str(&result.to_row());
            md.push('\n');
        }
        
        md.push_str(&format!("\n**Total benchmark time:** {:.2} ms\n", self.total_time_ms));
        md
    }

    /// Convert to JSON
    pub fn to_json(&self) -> String {
        serde_json::to_string_pretty(self).unwrap_or_default()
    }
}

// =============================================================================
// BENCHMARK RUNNER
// =============================================================================

/// Run a benchmark function multiple times and collect statistics
pub fn run_benchmark<F>(
    name: &str,
    size: usize,
    iterations: usize,
    warmup: usize,
    memory: usize,
    mut f: F,
) -> BenchmarkResult
where
    F: FnMut(),
{
    // Warmup runs (not measured)
    for _ in 0..warmup {
        f();
    }
    
    // Timed runs
    let mut times = Vec::with_capacity(iterations);
    for _ in 0..iterations {
        let timer = PhaseTimer::silent("benchmark", name);
        f();
        times.push(timer.stop());
    }
    
    BenchmarkResult::from_times(name, size, times, memory)
}

// =============================================================================
// STANDARD BENCHMARKS
// =============================================================================

/// Matrix operation benchmarks
pub mod matrix_benchmarks {
    use super::*;
    use nalgebra::DMatrix;

    /// Benchmark dense matrix multiplication
    pub fn bench_matmul(suite: &mut BenchmarkSuite, sizes: &[usize]) {
        for &n in sizes {
            let a = DMatrix::<f64>::from_fn(n, n, |i, j| (i + j) as f64);
            let b = DMatrix::<f64>::from_fn(n, n, |i, j| (i * j) as f64);
            let memory = MemoryEstimator::dense_matrix(n, n) * 3;
            
            let result = run_benchmark(
                &format!("matmul_{}x{}", n, n),
                n * n,
                10,
                2,
                memory,
                || { let _ = &a * &b; },
            );
            suite.add(result);
        }
    }

    /// Benchmark LU decomposition
    pub fn bench_lu(suite: &mut BenchmarkSuite, sizes: &[usize]) {
        for &n in sizes {
            let a = DMatrix::<f64>::from_fn(n, n, |i, j| {
                if i == j { 10.0 } else { (i + j) as f64 * 0.01 }
            });
            let memory = MemoryEstimator::dense_matrix(n, n) * 2;
            
            let result = run_benchmark(
                &format!("lu_decomp_{}x{}", n, n),
                n,
                5,
                1,
                memory,
                || { let _ = a.clone().lu(); },
            );
            suite.add(result);
        }
    }

    /// Benchmark sparse matrix-vector multiply
    pub fn bench_spmv(suite: &mut BenchmarkSuite, sizes: &[usize]) {
        use nalgebra_sparse::{CooMatrix, CsrMatrix};
        
        for &n in sizes {
            // Create sparse tridiagonal matrix
            let mut coo = CooMatrix::<f64>::new(n, n);
            for i in 0..n {
                coo.push(i, i, 2.0);
                if i > 0 { coo.push(i, i-1, -1.0); }
                if i < n-1 { coo.push(i, i+1, -1.0); }
            }
            let csr = CsrMatrix::from(&coo);
            let x = nalgebra::DVector::<f64>::from_element(n, 1.0);
            let nnz = 3 * n - 2;
            let memory = MemoryEstimator::sparse_matrix_csr(nnz, n) + MemoryEstimator::vector(n) * 2;
            
            let result = run_benchmark(
                &format!("spmv_{}", n),
                n,
                100,
                10,
                memory,
                || { let _ = &csr * &x; },
            );
            suite.add(result);
        }
    }
}

/// Structural analysis benchmarks
pub mod structural_benchmarks {
    use super::*;

    /// Benchmark frame stiffness assembly
    pub fn bench_frame_assembly(suite: &mut BenchmarkSuite, element_counts: &[usize]) {
        for &num_elements in element_counts {
            let dof = (num_elements + 1) * 6;
            let memory = MemoryEstimator::dense_matrix(dof, dof);
            
            // Create mock element data
            let elements: Vec<_> = (0..num_elements)
                .map(|i| MockElement {
                    node_i: i,
                    node_j: i + 1,
                    e: 200e9,
                    a: 0.01,
                    i: 1e-4,
                    l: 3.0,
                })
                .collect();
            
            let result = run_benchmark(
                &format!("frame_assembly_{}_elem", num_elements),
                num_elements,
                20,
                2,
                memory,
                || { assemble_mock_stiffness(&elements); },
            );
            suite.add(result);
        }
    }

    struct MockElement {
        node_i: usize,
        node_j: usize,
        e: f64,
        a: f64,
        i: f64,
        l: f64,
    }

    fn assemble_mock_stiffness(elements: &[MockElement]) {
        let n = (elements.len() + 1) * 6;
        let mut k = vec![0.0; n * n];
        
        for elem in elements {
            let k_local = element_stiffness_2d(elem.e, elem.a, elem.i, elem.l);
            let dofs_i = elem.node_i * 6;
            let dofs_j = elem.node_j * 6;
            
            // Simple assembly (not optimized)
            for i in 0..6 {
                for j in 0..6 {
                    k[(dofs_i + i) * n + (dofs_i + j)] += k_local[i * 12 + j];
                    k[(dofs_i + i) * n + (dofs_j + j)] += k_local[i * 12 + j + 6];
                    k[(dofs_j + i) * n + (dofs_i + j)] += k_local[(i + 6) * 12 + j];
                    k[(dofs_j + i) * n + (dofs_j + j)] += k_local[(i + 6) * 12 + j + 6];
                }
            }
        }
    }

    fn element_stiffness_2d(e: f64, a: f64, i: f64, l: f64) -> [f64; 144] {
        let mut k = [0.0; 144];
        let ea_l = e * a / l;
        let ei_l3 = e * i / (l * l * l);
        let ei_l2 = e * i / (l * l);
        let ei_l = e * i / l;
        
        // Axial
        k[0] = ea_l; k[6] = -ea_l;
        k[72] = -ea_l; k[78] = ea_l;
        
        // Bending
        k[13] = 12.0 * ei_l3; k[17] = 6.0 * ei_l2;
        k[19] = -12.0 * ei_l3; k[23] = 6.0 * ei_l2;
        k[61] = 6.0 * ei_l2; k[65] = 4.0 * ei_l;
        k[67] = -6.0 * ei_l2; k[71] = 2.0 * ei_l;
        
        k
    }
}

/// SIMD operation benchmarks
pub mod simd_benchmarks {
    use super::*;

    /// Benchmark SIMD dot product
    pub fn bench_dot_product(suite: &mut BenchmarkSuite, sizes: &[usize]) {
        use super::super::simd_optimized::simd_dot_product;
        
        for &n in sizes {
            let a: Vec<f32> = (0..n).map(|i| i as f32).collect();
            let b: Vec<f32> = (0..n).map(|i| (n - i) as f32).collect();
            let memory = MemoryEstimator::vector(n) * 2;
            
            let result = run_benchmark(
                &format!("simd_dot_{}", n),
                n,
                1000,
                100,
                memory,
                || { let _ = simd_dot_product(&a, &b); },
            );
            suite.add(result);
        }
    }

    /// Benchmark SIMD AXPY (c = a*x + b)
    pub fn bench_axpy(suite: &mut BenchmarkSuite, sizes: &[usize]) {
        use super::super::simd_optimized::simd_axpy;
        
        for &n in sizes {
            let x: Vec<f32> = (0..n).map(|i| i as f32).collect();
            let y: Vec<f32> = (0..n).map(|i| (n - i) as f32).collect();
            let mut c: Vec<f32> = vec![0.0; n];
            let memory = MemoryEstimator::vector(n) * 3;
            
            let result = run_benchmark(
                &format!("simd_axpy_{}", n),
                n,
                1000,
                100,
                memory,
                || { simd_axpy(2.0, &x, &y, &mut c); },
            );
            suite.add(result);
        }
    }
}

/// Mesh operation benchmarks
pub mod mesh_benchmarks {
    use super::*;

    /// Benchmark mesh compression
    pub fn bench_compression(suite: &mut BenchmarkSuite, vertex_counts: &[usize]) {
        use super::super::simd_optimized::simd_compress_vertices;
        
        for &n in vertex_counts {
            let positions: Vec<f32> = (0..n * 3).map(|i| (i as f32) * 0.1).collect();
            let normals: Vec<f32> = (0..n * 3).map(|i| {
                let v = (i % 3) as f32;
                if i % 3 == 2 { 1.0 } else { v * 0.1 }
            }).collect();
            let aabb_min = [0.0f32, 0.0, 0.0];
            let aabb_scale = 100.0f32;
            let mut compressed_pos: Vec<u16> = vec![0; n * 3];
            let mut compressed_normals: Vec<i16> = vec![0; n * 2];
            let memory = n * (12 + 12 + 6 + 4); // Input + output
            
            let result = run_benchmark(
                &format!("mesh_compress_{}_verts", n),
                n,
                50,
                5,
                memory,
                || { simd_compress_vertices(&positions, &normals, aabb_min, aabb_scale, &mut compressed_pos, &mut compressed_normals); },
            );
            suite.add(result);
        }
    }
}

// =============================================================================
// WASM EXPORTS
// =============================================================================

/// Run all benchmarks and return JSON results
#[wasm_bindgen]
pub fn run_all_benchmarks() -> String {
    let mut suite = BenchmarkSuite::new("Civil Engineering Computations");
    
    // Matrix benchmarks
    matrix_benchmarks::bench_matmul(&mut suite, &[50, 100, 200]);
    matrix_benchmarks::bench_lu(&mut suite, &[50, 100, 200]);
    matrix_benchmarks::bench_spmv(&mut suite, &[1000, 5000, 10000]);
    
    // Structural benchmarks
    structural_benchmarks::bench_frame_assembly(&mut suite, &[100, 500, 1000]);
    
    // SIMD benchmarks
    simd_benchmarks::bench_dot_product(&mut suite, &[1000, 10000, 100000]);
    simd_benchmarks::bench_axpy(&mut suite, &[1000, 10000, 100000]);
    
    // Mesh benchmarks
    mesh_benchmarks::bench_compression(&mut suite, &[1000, 10000, 50000]);
    
    suite.to_json()
}

/// Get benchmark report as markdown
#[wasm_bindgen]
pub fn get_benchmark_report() -> String {
    let mut suite = BenchmarkSuite::new("Civil Engineering Computations");
    
    // Run quick benchmarks
    matrix_benchmarks::bench_spmv(&mut suite, &[1000, 5000]);
    simd_benchmarks::bench_dot_product(&mut suite, &[10000, 100000]);
    mesh_benchmarks::bench_compression(&mut suite, &[10000]);
    
    suite.to_markdown()
}

// =============================================================================
// TESTS
// =============================================================================

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_benchmark_result() {
        let result = BenchmarkResult::from_times("test", 100, vec![1.0, 2.0, 3.0, 4.0, 5.0], 1000);
        assert!((result.mean_ms - 3.0).abs() < 0.001);
        assert!(result.min_ms < result.max_ms);
    }

    #[test]
    fn test_benchmark_suite() {
        let mut suite = BenchmarkSuite::new("Test Suite");
        let result = BenchmarkResult::from_times("test", 100, vec![1.0, 2.0, 3.0], 1000);
        suite.add(result);
        
        let md = suite.to_markdown();
        assert!(md.contains("Test Suite"));
        assert!(md.contains("test"));
    }

    #[test]
    fn test_run_benchmark() {
        let mut counter = 0;
        let result = run_benchmark("counter", 1, 10, 2, 0, || { counter += 1; });
        
        assert_eq!(result.problem_size, 1);
        assert_eq!(result.times_ms.len(), 10);
        assert_eq!(counter, 12); // 2 warmup + 10 measured
    }
}
