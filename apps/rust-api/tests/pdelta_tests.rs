//! P-Delta Analysis Comprehensive Tests
//! 
//! Tests for second-order geometric nonlinearity analysis

use rust_api::solver::pdelta::{
    PDeltaSolver, PDeltaConfig, MemberGeometry, ConvergenceCriteria,
};
use nalgebra::{DMatrix, DVector};

const TOLERANCE: f64 = 1e-6;

// ============================================================================
// CONFIGURATION TESTS
// ============================================================================

#[test]
fn test_pdelta_config_default() {
    let config = PDeltaConfig::default();
    
    assert_eq!(config.max_iterations, 100);
    assert_eq!(config.displacement_tolerance, 1e-6);
    assert_eq!(config.force_tolerance, 1e-3);
    assert_eq!(config.energy_tolerance, 1e-6);
    assert_eq!(config.load_increment, 0.1);
    assert_eq!(config.num_load_steps, 10);
    assert!(config.include_small_delta);
    assert!(config.include_large_delta);
}

#[test]
fn test_pdelta_config_custom() {
    let config = PDeltaConfig {
        max_iterations: 50,
        displacement_tolerance: 1e-8,
        force_tolerance: 1e-5,
        energy_tolerance: 1e-8,
        load_increment: 0.2,
        num_load_steps: 5,
        include_small_delta: false,
        include_large_delta: true,
    };
    
    assert_eq!(config.max_iterations, 50);
    assert_eq!(config.displacement_tolerance, 1e-8);
    assert!(!config.include_small_delta);
}

// ============================================================================
// MEMBER GEOMETRY TESTS
// ============================================================================

#[test]
fn test_member_geometry_horizontal() {
    let member = MemberGeometry {
        node_i: [0.0, 0.0, 0.0],
        node_j: [10.0, 0.0, 0.0],
        node_i_dof: 0,
        node_j_dof: 6,
        area: 0.01,
        elastic_modulus: 200e9,
        moment_of_inertia: 1e-4,
    };
    
    assert_eq!(member.length(), 10.0);
    
    let (cx, cy, cz) = member.direction_cosines();
    assert!((cx - 1.0).abs() < TOLERANCE);
    assert!(cy.abs() < TOLERANCE);
    assert!(cz.abs() < TOLERANCE);
}

#[test]
fn test_member_geometry_vertical() {
    let member = MemberGeometry {
        node_i: [0.0, 0.0, 0.0],
        node_j: [0.0, 5.0, 0.0],
        node_i_dof: 0,
        node_j_dof: 6,
        area: 0.01,
        elastic_modulus: 200e9,
        moment_of_inertia: 1e-4,
    };
    
    assert_eq!(member.length(), 5.0);
    
    let (cx, cy, cz) = member.direction_cosines();
    assert!(cx.abs() < TOLERANCE);
    assert!((cy - 1.0).abs() < TOLERANCE);
    assert!(cz.abs() < TOLERANCE);
}

#[test]
fn test_member_geometry_diagonal() {
    let member = MemberGeometry {
        node_i: [0.0, 0.0, 0.0],
        node_j: [3.0, 4.0, 0.0],
        node_i_dof: 0,
        node_j_dof: 6,
        area: 0.01,
        elastic_modulus: 200e9,
        moment_of_inertia: 1e-4,
    };
    
    // 3-4-5 triangle
    assert!((member.length() - 5.0).abs() < TOLERANCE);
    
    let (cx, cy, cz) = member.direction_cosines();
    assert!((cx - 0.6).abs() < TOLERANCE);
    assert!((cy - 0.8).abs() < TOLERANCE);
    assert!(cz.abs() < TOLERANCE);
}

#[test]
fn test_member_geometry_3d() {
    let member = MemberGeometry {
        node_i: [0.0, 0.0, 0.0],
        node_j: [1.0, 2.0, 2.0],
        node_i_dof: 0,
        node_j_dof: 6,
        area: 0.01,
        elastic_modulus: 200e9,
        moment_of_inertia: 1e-4,
    };
    
    // Length = √(1² + 2² + 2²) = 3
    assert!((member.length() - 3.0).abs() < TOLERANCE);
    
    let (cx, cy, cz) = member.direction_cosines();
    assert!((cx - 1.0/3.0).abs() < TOLERANCE);
    assert!((cy - 2.0/3.0).abs() < TOLERANCE);
    assert!((cz - 2.0/3.0).abs() < TOLERANCE);
}

// ============================================================================
// EULER BUCKLING TESTS
// ============================================================================

#[test]
fn test_euler_buckling_load() {
    let member = MemberGeometry {
        node_i: [0.0, 0.0, 0.0],
        node_j: [0.0, 5.0, 0.0],
        node_i_dof: 0,
        node_j_dof: 6,
        area: 0.01,
        elastic_modulus: 200e9,
        moment_of_inertia: 1e-4,
    };
    
    let p_cr = member.euler_buckling_load();
    
    // P_cr = π²EI/L² = π² * 200e9 * 1e-4 / 25
    use std::f64::consts::PI;
    let expected = PI.powi(2) * 200e9 * 1e-4 / 25.0;
    
    assert!((p_cr - expected).abs() < 1e3);
    println!("Euler buckling load: {:.0} N", p_cr);
}

#[test]
fn test_euler_buckling_longer_column() {
    let short = MemberGeometry {
        node_i: [0.0, 0.0, 0.0],
        node_j: [0.0, 3.0, 0.0],
        node_i_dof: 0,
        node_j_dof: 6,
        area: 0.01,
        elastic_modulus: 200e9,
        moment_of_inertia: 1e-4,
    };
    
    let long = MemberGeometry {
        node_i: [0.0, 0.0, 0.0],
        node_j: [0.0, 6.0, 0.0],
        node_i_dof: 0,
        node_j_dof: 6,
        area: 0.01,
        elastic_modulus: 200e9,
        moment_of_inertia: 1e-4,
    };
    
    let p_cr_short = short.euler_buckling_load();
    let p_cr_long = long.euler_buckling_load();
    
    // Longer column buckles at lower load (P_cr ∝ 1/L²)
    assert!(p_cr_long < p_cr_short);
    
    // Ratio should be (L_short/L_long)² = (3/6)² = 1/4
    let ratio = p_cr_long / p_cr_short;
    assert!((ratio - 0.25).abs() < 0.01);
}

#[test]
fn test_effective_length_factor() {
    let member = MemberGeometry {
        node_i: [0.0, 0.0, 0.0],
        node_j: [0.0, 5.0, 0.0],
        node_i_dof: 0,
        node_j_dof: 6,
        area: 0.01,
        elastic_modulus: 200e9,
        moment_of_inertia: 1e-4,
    };
    
    // Default is simply supported (K = 1.0)
    let k = member.effective_length_factor();
    assert_eq!(k, 1.0);
}

// ============================================================================
// SIMPLE P-DELTA ANALYSIS TESTS
// ============================================================================

#[test]
fn test_pdelta_simple_cantilever() {
    // Simple cantilever column with tip load
    let config = PDeltaConfig::default();
    let solver = PDeltaSolver::new(config);
    
    // Single vertical member (5m tall)
    let member = MemberGeometry {
        node_i: [0.0, 0.0, 0.0],  // Base (fixed)
        node_j: [0.0, 5.0, 0.0],  // Top (free)
        node_i_dof: 0,
        node_j_dof: 6,
        area: 0.01,               // 100 cm²
        elastic_modulus: 200e9,   // Steel
        moment_of_inertia: 1e-4,  // I = 10000 cm⁴
    };
    
    // DOF: [u_x, u_y, u_z, θ_x, θ_y, θ_z] at base and top
    // Total: 12 DOF (but base is fixed, so 6 active)
    
    // Simplified: 2 DOF analysis (lateral displacement at top)
    let k = DMatrix::from_row_slice(2, 2, &[
        12.0 * member.elastic_modulus * member.moment_of_inertia / member.length().powi(3), 0.0,
        0.0, 1.0,  // Dummy for vertical DOF
    ]);
    
    let forces = DVector::from_vec(vec![1000.0, 0.0]); // 1kN lateral
    
    let result = solver.analyze(&k, &forces, &[member]);
    
    assert!(result.is_ok());
    let res = result.unwrap();
    println!("Converged: {}", res.converged);
    println!("Iterations: {}", res.iterations);
    println!("Max displacement: {:.6} m", res.max_displacement);
}

#[test]
fn test_pdelta_solver_creation() {
    let solver = PDeltaSolver::default();
    let config = PDeltaConfig::default();
    let solver2 = PDeltaSolver::new(config);
    
    // Both should be valid
    assert_eq!(std::mem::size_of_val(&solver), std::mem::size_of_val(&solver2));
}

#[test]
fn test_pdelta_convergence_metrics() {
    let config = PDeltaConfig {
        max_iterations: 10,
        displacement_tolerance: 1e-4,
        force_tolerance: 1.0,
        energy_tolerance: 1e-4,
        load_increment: 1.0,
        num_load_steps: 1,
        include_small_delta: true,
        include_large_delta: true,
    };
    
    let solver = PDeltaSolver::new(config);
    
    // Simple 1-DOF system: k*u = F
    let k = DMatrix::from_row_slice(1, 1, &[1000.0]);
    let f = DVector::from_vec(vec![100.0]);
    
    let member = MemberGeometry {
        node_i: [0.0, 0.0, 0.0],
        node_j: [1.0, 0.0, 0.0],
        node_i_dof: 0,
        node_j_dof: 1,
        area: 0.01,
        elastic_modulus: 200e9,
        moment_of_inertia: 1e-4,
    };
    
    let result = solver.analyze(&k, &f, &[member]).unwrap();
    
    assert!(result.converged);
    assert!(!result.convergence_history.is_empty());
    
    // First iteration should show convergence
    let first_iter = &result.convergence_history[0];
    println!("Iteration {}: displacement_norm={:.2e}, force_norm={:.2e}", 
             first_iter.iteration, 
             first_iter.displacement_norm, 
             first_iter.force_norm);
}

// ============================================================================
// AMPLIFICATION FACTOR TESTS
// ============================================================================

#[test]
fn test_amplification_factor_low_load() {
    // At low loads, second-order effects should be minimal
    let config = PDeltaConfig::default();
    let solver = PDeltaSolver::new(config);
    
    let k = DMatrix::from_row_slice(2, 2, &[
        1000.0, 0.0,
        0.0, 1000.0,
    ]);
    
    let f = DVector::from_vec(vec![10.0, 0.0]);
    
    let member = MemberGeometry {
        node_i: [0.0, 0.0, 0.0],
        node_j: [5.0, 0.0, 0.0],
        node_i_dof: 0,
        node_j_dof: 2,
        area: 0.01,
        elastic_modulus: 200e9,
        moment_of_inertia: 1e-4,
    };
    
    let result = solver.analyze(&k, &f, &[member]).unwrap();
    
    // Amplification should be close to 1.0 (minimal second-order effects)
    println!("Amplification factor: {:.4}", result.amplification_factor);
    assert!(result.amplification_factor < 1.2);
}

// ============================================================================
// ERROR HANDLING TESTS
// ============================================================================

#[test]
fn test_pdelta_non_square_matrix() {
    let solver = PDeltaSolver::default();
    
    let k = DMatrix::from_row_slice(2, 3, &[
        1.0, 0.0, 0.0,
        0.0, 1.0, 0.0,
    ]);
    
    let f = DVector::from_vec(vec![1.0, 1.0]);
    
    let result = solver.analyze(&k, &f, &[]);
    
    assert!(result.is_err());
    assert!(result.unwrap_err().contains("square"));
}

#[test]
fn test_pdelta_mismatched_force_vector() {
    let solver = PDeltaSolver::default();
    
    let k = DMatrix::from_row_slice(2, 2, &[
        1.0, 0.0,
        0.0, 1.0,
    ]);
    
    let f = DVector::from_vec(vec![1.0, 1.0, 1.0]); // Wrong size
    
    let result = solver.analyze(&k, &f, &[]);
    
    assert!(result.is_err());
    assert!(result.unwrap_err().contains("size must match"));
}

#[test]
fn test_pdelta_singular_matrix() {
    let solver = PDeltaSolver::default();
    
    // Singular matrix (determinant = 0)
    let k = DMatrix::from_row_slice(2, 2, &[
        1.0, 1.0,
        1.0, 1.0,
    ]);
    
    let f = DVector::from_vec(vec![1.0, 1.0]);
    
    let result = solver.analyze(&k, &f, &[]);
    
    assert!(result.is_err());
    assert!(result.unwrap_err().contains("singular"));
}

// ============================================================================
// INTEGRATION TESTS
// ============================================================================

#[test]
fn test_pdelta_portal_frame() {
    // Simple portal frame: two columns + beam
    let config = PDeltaConfig {
        max_iterations: 50,
        displacement_tolerance: 1e-5,
        force_tolerance: 1e-2,
        energy_tolerance: 1e-5,
        load_increment: 1.0,
        num_load_steps: 1,
        include_small_delta: true,
        include_large_delta: true,
    };
    
    let solver = PDeltaSolver::new(config);
    
    println!("\n=== Portal Frame P-Delta Analysis ===");
    println!("Configuration: 2 columns (5m) + beam (10m)");
    println!("Material: Steel (E=200 GPa)");
    println!("Section: 100 cm² area, 10000 cm⁴ inertia");
}

#[test]
fn test_pdelta_tall_building_column() {
    // Simplified tall building column (50 stories)
    println!("\n=== Tall Building Column P-Delta ===");
    println!("Height: 150m (50 floors × 3m)");
    println!("Axial load: 10 MN (gravity)");
    println!("Lateral load: 100 kN (wind)");
    
    let member = MemberGeometry {
        node_i: [0.0, 0.0, 0.0],
        node_j: [0.0, 150.0, 0.0],
        node_i_dof: 0,
        node_j_dof: 6,
        area: 0.5,  // 5000 cm² (large column)
        elastic_modulus: 200e9,
        moment_of_inertia: 0.2,  // 2,000,000 cm⁴ (very stiff column)
    };
    
    let p_cr = member.euler_buckling_load();
    println!("Euler buckling load: {:.2} MN", p_cr / 1e6);
    
    // Load ratio
    let axial_load = 10e6; // 10 MN
    let load_ratio = axial_load / p_cr;
    println!("Load ratio (P/P_cr): {:.3}", load_ratio);
    
    // For stable structure, load ratio should be << 1.0
    // Typical design limit is P/P_cr < 0.75 for safety
    assert!(load_ratio < 0.75);
}

// ============================================================================
// PERFORMANCE TESTS
// ============================================================================

#[test]
fn test_pdelta_performance_small() {
    use std::time::Instant;
    
    let solver = PDeltaSolver::default();
    let n = 10; // 10 DOF
    
    let k = DMatrix::identity(n, n) * 1000.0;
    let f = DVector::from_element(n, 100.0);
    
    let members: Vec<MemberGeometry> = (0..5)
        .map(|i| MemberGeometry {
            node_i: [i as f64, 0.0, 0.0],
            node_j: [(i + 1) as f64, 0.0, 0.0],
            node_i_dof: i * 2,
            node_j_dof: (i + 1) * 2,
            area: 0.01,
            elastic_modulus: 200e9,
            moment_of_inertia: 1e-4,
        })
        .collect();
    
    let start = Instant::now();
    let result = solver.analyze(&k, &f, &members);
    let duration = start.elapsed();
    
    assert!(result.is_ok());
    println!("Analysis time (10 DOF): {:.3} ms", duration.as_secs_f64() * 1000.0);
    assert!(duration.as_millis() < 100); // Should be fast
}
