//! # Civil Engineering Computation Engine
//! 
//! **Industry-Standard High-Performance Structural Analysis Library**
//! 
//! A comprehensive Rust library for civil engineering computations designed to compile
//! to WebAssembly for browser-based computation while maintaining native performance.
//! 
//! ## Features
//! 
//! - **Structural Analysis**: Frame, truss, and plate element analysis using the direct stiffness method
//! - **Geotechnical**: Bearing capacity, settlement, earth pressure, and slope stability
//! - **Hydraulics**: Open channel flow, pipe networks, and hydrology calculations
//! - **Transportation**: Geometric design, pavement analysis, and traffic flow
//! - **Surveying**: Coordinate transformations, traverse adjustments, and earthwork
//! - **High-Performance Rendering**: LOD systems, mesh optimization, and GPU instancing
//! 
//! ## Performance Characteristics
//! 
//! | Operation | Problem Size | Time (WASM) | Throughput |
//! |-----------|-------------|-------------|------------|
//! | Frame Assembly | 1000 elements | <10ms | 100k elem/s |
//! | Linear Solve | 10k DOF | <100ms | 100k DOF/s |
//! | Mesh Compression | 100k vertices | <50ms | 2M vert/s |
//! 
//! ## Quality Standards
//! 
//! This library follows industry best practices:
//! 
//! - **Error Handling**: Typed errors with recovery hints ([`error`] module)
//! - **Input Validation**: Comprehensive bounds checking ([`validation`] module)
//! - **Numerical Stability**: Condition monitoring and safe operations ([`numerical`] module)
//! - **Logging**: Structured logging for debugging ([`logging`] module)
//! - **Benchmarking**: Performance regression testing ([`benchmarks`] module)
//! 
//! ## Example
//! 
//! ```rust,ignore
//! use backend_rust::civil_engineering::*;
//! 
//! // Create a 2D frame analysis
//! let mut frame = WasmFrame2D::new();
//! 
//! // Add nodes (x, y coordinates)
//! frame.add_node(0.0, 0.0);  // Node 0: origin
//! frame.add_node(6.0, 0.0);  // Node 1: 6m along x
//! frame.add_node(6.0, 4.0);  // Node 2: top of column
//! 
//! // Add members (E=200GPa, A=0.01m², I=8.33e-5m⁴)
//! frame.add_member(0, 1, 200e9, 0.01, 8.33e-5);
//! frame.add_member(1, 2, 200e9, 0.01, 8.33e-5);
//! 
//! // Add supports
//! frame.add_support(0, true, true, true);  // Fixed at node 0
//! 
//! // Add loads
//! frame.add_node_load(2, 0.0, -10000.0, 0.0);  // 10kN downward at node 2
//! 
//! // Solve and get results
//! let results = frame.solve();
//! ```
//! 
//! ## Module Organization
//! 
//! ### Core Infrastructure
//! - [`error`] - Industry-standard error types with recovery hints
//! - [`validation`] - Input validation and bounds checking
//! - [`numerical`] - Numerical safety and stability utilities
//! - [`logging`] - Structured logging and performance metrics
//! - [`benchmarks`] - Performance benchmarking suite
//! 
//! ### Engineering Modules
//! - [`core`] - Fundamental calculations, materials, matrix operations
//! - [`structural`] - Frame, truss, beam analysis using direct stiffness method
//! - [`geotechnical`] - Bearing capacity, settlement, slope stability
//! - [`hydraulics`] - Open channel flow, pipe flow, hydrology
//! - [`transportation`] - Geometric design, pavement design, traffic flow
//! - [`surveying`] - Coordinate transformations, traverse, earthwork
//! 
//! ### High-Performance Modules
//! - [`rendering`] - LOD, mesh optimization, spatial partitioning, instancing
//! - [`simd_optimized`] - Explicit SIMD vectorization for CPU-intensive operations
//! - [`webgpu_bridge`] - WebGPU compute shader interface for GPU acceleration
//! - [`lightweight_formats`] - Compact binary serialization for minimal bandwidth
//! 
//! ### WASM Interface
//! - [`wasm_bindings`] - JavaScript-friendly WASM bindings
//! - [`rendering_wasm`] - WASM bindings for rendering operations
//! 
//! ## Standards Compliance
//! 
//! Design calculations follow relevant codes:
//! - **IS 456:2000** - Indian Standard for Plain and Reinforced Concrete
//! - **IS 800:2007** - Indian Standard for Steel Structures  
//! - **IS 1893** - Seismic Design Criteria
//! - **AISC 360** - American Institute of Steel Construction
//! - **Eurocode 2/3** - European Design Standards
//! 
//! ## Performance Optimization
//! 
//! All computations leverage:
//! - SIMD operations via nalgebra and explicit vectorization
//! - Sparse matrix solvers for large systems
//! - Zero-copy data transfer with JavaScript
//! - Parallel computation where applicable
//! - LOD and frustum culling for minimal GPU load
//! - Geometry compression for reduced bandwidth
//! - WebGPU compute shaders for GPU-accelerated analysis
//! - Compact binary formats (3-5x smaller than JSON)

// =============================================================================
// CORE INFRASTRUCTURE (Industry-Standard Quality)
// =============================================================================

/// Error types with codes and recovery hints
pub mod error;

/// Input validation and bounds checking  
pub mod validation;

/// Numerical safety and stability utilities
pub mod numerical;

/// Structured logging and performance metrics
pub mod logging;

/// Performance benchmarking suite
pub mod benchmarks;

// =============================================================================
// ENGINEERING MODULES
// =============================================================================

/// Fundamental calculations, materials, matrix operations
pub mod core;

/// Frame, truss, beam analysis using direct stiffness method
pub mod structural;

/// Bearing capacity, settlement, slope stability
pub mod geotechnical;

/// Open channel flow, pipe flow, hydrology
pub mod hydraulics;

/// Geometric design, pavement design, traffic flow
pub mod transportation;

/// Coordinate transformations, traverse, earthwork
pub mod surveying;

// =============================================================================
// HIGH-PERFORMANCE MODULES
// =============================================================================

/// LOD, mesh optimization, spatial partitioning, instancing
pub mod rendering;

/// JavaScript-friendly WASM bindings for structural analysis
pub mod wasm_bindings;

/// WASM bindings for rendering operations
pub mod rendering_wasm;

/// Explicit SIMD vectorization for CPU-intensive operations
pub mod simd_optimized;

/// WebGPU compute shader interface for GPU acceleration
pub mod webgpu_bridge;

/// Compact binary serialization for minimal bandwidth
pub mod lightweight_formats;

// =============================================================================
// RE-EXPORTS FOR CONVENIENCE
// =============================================================================

// Error handling
pub use error::{EngineeringError, EngResult, ErrorCode};
pub use error::{validation_error, numerical_error, structural_error};
pub use error::{singular_matrix_error, convergence_error, unstable_structure_error};

// Validation
pub use validation::{Validate, limits};
pub use validation::{validate_finite, validate_positive, validate_range};
pub use validation::{validate_youngs_modulus, validate_poisson_ratio};

// Numerical utilities
pub use numerical::{safe_divide, safe_sqrt, robust_solve};
pub use numerical::{estimate_condition_number_1norm, is_positive_definite};
pub use numerical::{KahanSum, kahan_sum};

// Logging
pub use logging::{LogLevel, LogEntry, ComputationMetrics, PhaseTimer};
pub use logging::{info, warn_log, error_log, debug_log};

// Benchmarks
pub use benchmarks::{BenchmarkResult, BenchmarkSuite, run_benchmark};

// Core engineering
pub use core::*;

// Rendering
pub use rendering::*;

// WASM bindings
pub use wasm_bindings::*;
pub use rendering_wasm::*;

// High-performance modules
pub use simd_optimized::*;
pub use webgpu_bridge::*;
pub use lightweight_formats::*;

// =============================================================================
// VERSION INFORMATION
// =============================================================================

/// Library version
pub const VERSION: &str = env!("CARGO_PKG_VERSION");

/// Get version information as JSON
pub fn version_info() -> String {
    serde_json::json!({
        "version": VERSION,
        "features": {
            "wasm": cfg!(feature = "wasm"),
            "benchmarks": cfg!(feature = "benchmarks"),
            "validation": cfg!(feature = "validation"),
            "logging": cfg!(feature = "logging"),
        },
        "build": {
            "debug": cfg!(debug_assertions),
            "target_arch": std::env::consts::ARCH,
        }
    }).to_string()
}
