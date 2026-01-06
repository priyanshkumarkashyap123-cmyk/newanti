//! Integration tests for Rust analysis solvers
//!
//! These tests verify the core solver implementations work correctly

use nalgebra::{DMatrix, DVector};
use rust_api::solver::{
    ModalSolver, ModalConfig, MassMatrixType,
    TimeHistorySolver, TimeHistoryConfig, IntegrationMethod, DampingModel,
    ResponseSpectrumSolver, ResponseSpectrumConfig,
    SeismicCode, SeismicZone, SoilType, ImportanceFactor, ResponseReduction, CombinationMethod,
};

/// Test modal analysis with 2-DOF system
#[test]
fn test_modal_analysis_valid_2dof() {
    // 2-DOF system: K = [200 -100; -100 100], M = [100 0; 0 100]
    let k = DMatrix::from_row_slice(2, 2, &[200.0, -100.0, -100.0, 100.0]);
    let m = DMatrix::from_row_slice(2, 2, &[100.0, 0.0, 0.0, 100.0]);
    
    let config = ModalConfig {
        num_modes: 2,
        mass_type: MassMatrixType::Consistent,
        normalize_modes: true,
        compute_participation: true,
    };
    
    let solver = ModalSolver::new(config);
    let result = solver.analyze(&k, &m).expect("Modal analysis should succeed");
    
    // Verify results
    assert_eq!(result.num_modes, 2);
    assert_eq!(result.frequencies.len(), 2);
    assert_eq!(result.periods.len(), 2);
    assert!(result.converged);
    
    // Frequencies should be positive
    assert!(result.frequencies[0] > 0.0);
    assert!(result.frequencies[1] > 0.0);
    
    // First mode has lower frequency
    assert!(result.frequencies[0] < result.frequencies[1]);
    
    println!("✓ 2-DOF modal analysis: f1={:.2} Hz, f2={:.2} Hz", 
             result.frequencies[0] / (2.0 * std::f64::consts::PI),
             result.frequencies[1] / (2.0 * std::f64::consts::PI));
}

/// Test modal analysis with mismatched dimensions (should fail gracefully)
#[test]
fn test_modal_analysis_dimension_mismatch() {
    // 3×3 K but 2×2 M (invalid)
    let k = DMatrix::from_row_slice(3, 3, &[1.0, 0.0, 0.0, 0.0, 1.0, 0.0, 0.0, 0.0, 1.0]);
    let m = DMatrix::from_row_slice(2, 2, &[1.0, 0.0, 0.0, 1.0]);
    
    let config = ModalConfig::default();
    let solver = ModalSolver::new(config);
    let result = solver.analyze(&k, &m);
    
    assert!(result.is_err(), "Should reject mismatched matrices");
    println!("✓ Correctly rejected dimension mismatch");
}

/// Test time-history analysis with SDOF system
#[test]
fn test_time_history_sdof() {
    // Simple SDOF: k=100, m=1, no damping
    let k = DMatrix::from_row_slice(1, 1, &[100.0]);
    let m = DMatrix::from_row_slice(1, 1, &[1.0]);
    
    // Impulse force: [0, 10, 0, -10, 0]
    let force_history: Vec<DVector<f64>> = vec![
        DVector::from_element(1, 0.0),
        DVector::from_element(1, 10.0),
        DVector::from_element(1, 0.0),
        DVector::from_element(1, -10.0),
        DVector::from_element(1, 0.0),
    ];
    
    let config = TimeHistoryConfig {
        dt: 0.01,
        duration: 0.05,
        method: IntegrationMethod::Newmark { beta: 0.25, gamma: 0.5 },
        damping: DampingModel::None,
        output_interval: 1,
    };
    
    let solver = TimeHistorySolver::new(config);
    let result = solver.analyze(&k, &m, &force_history, None, None)
        .expect("Time-history should succeed");
    
    assert!(result.converged);
    assert_eq!(result.num_steps, 5);
    assert_eq!(result.displacements.len(), 5);
    
    println!("✓ SDOF time-history: max_disp={:.4} m", result.max_displacements[0]);
}

/// Test seismic response spectrum analysis
#[test]
fn test_seismic_analysis_is1893() {
    // 3-DOF building approximation
    let k = DMatrix::from_row_slice(3, 3, &[
        200.0, -100.0, 0.0,
        -100.0, 200.0, -100.0,
        0.0, -100.0, 100.0,
    ]);
    
    let m = DMatrix::from_row_slice(3, 3, &[
        100.0, 0.0, 0.0,
        0.0, 100.0, 0.0,
        0.0, 0.0, 100.0,
    ]);
    
    // First perform modal analysis to get frequencies and mode shapes
    let modal_config = ModalConfig {
        num_modes: 3,
        mass_type: MassMatrixType::Lumped,
        normalize_modes: true,
        compute_participation: true,
    };
    
    let modal_solver = ModalSolver::new(modal_config);
    let modal_result = modal_solver.analyze(&k, &m)
        .expect("Modal analysis should succeed");
    
    // Now perform seismic analysis using modal results
    let config = ResponseSpectrumConfig {
        code: SeismicCode::IS1893,
        zone: SeismicZone::Zone3,
        soil_type: SoilType::TypeII,
        importance: ImportanceFactor::Ordinary,
        response_reduction: ResponseReduction::SMRF,
        damping_ratio: 0.05,
        combination_method: CombinationMethod::CQC,
        include_vertical: false,
    };
    
    let solver = ResponseSpectrumSolver::new(config);
    let result = solver.analyze(
        &modal_result.frequencies,
        &modal_result.mode_shapes,
        &modal_result.modal_masses,
        &modal_result.participation_factors.unwrap(),
    ).expect("Seismic analysis should succeed");
    
    assert_eq!(result.periods.len(), 3);
    assert_eq!(result.modal_base_shears.len(), 3);
    
    // Base shear should be positive
    assert!(result.modal_base_shears.iter().all(|&v| v >= 0.0));
    assert!(result.max_base_shear >= 0.0);
    
    println!("✓ IS1893 seismic: T1={:.3}s, V_base={:.1} kN", 
             result.periods[0], result.max_base_shear / 1000.0);
}

/// Performance benchmark: 10-DOF modal analysis
#[test]
fn test_performance_benchmark_10dof() {
    use std::time::Instant;
    
    // 10-DOF tridiagonal system
    let n = 10;
    let mut k_data = vec![0.0; n * n];
    let mut m_data = vec![0.0; n * n];
    
    for i in 0..n {
        // Diagonal terms
        k_data[i * n + i] = 200.0;
        m_data[i * n + i] = 100.0;
        
        // Off-diagonal terms
        if i > 0 {
            k_data[i * n + (i-1)] = -100.0;
            k_data[(i-1) * n + i] = -100.0;
        }
    }
    
    let k = DMatrix::from_row_slice(n, n, &k_data);
    let m = DMatrix::from_row_slice(n, n, &m_data);
    
    let config = ModalConfig {
        num_modes: 5,
        mass_type: MassMatrixType::Lumped,
        normalize_modes: false,
        compute_participation: false,
    };
    
    let solver = ModalSolver::new(config);
    
    let start = Instant::now();
    let result = solver.analyze(&k, &m).expect("Should solve 10-DOF system");
    let duration = start.elapsed();
    
    assert_eq!(result.num_modes, 5);
    assert!(duration.as_millis() < 100, "Should complete in < 100ms (got {:?})", duration);
    
    println!("✓ 10-DOF benchmark: {} modes in {:?}", result.num_modes, duration);
}

/// Test error handling: singular mass matrix
#[test]
fn test_singular_mass_matrix() {
    let k = DMatrix::from_row_slice(2, 2, &[1.0, 0.0, 0.0, 1.0]);
    let m = DMatrix::from_row_slice(2, 2, &[0.0, 0.0, 0.0, 0.0]); // Singular!
    
    let config = ModalConfig::default();
    let solver = ModalSolver::new(config);
    let result = solver.analyze(&k, &m);
    
    assert!(result.is_err(), "Should reject singular mass matrix");
    println!("✓ Correctly rejected singular mass matrix");
}

/// Test time-history with empty force history
#[test]
fn test_empty_force_history() {
    let k = DMatrix::from_row_slice(1, 1, &[100.0]);
    let m = DMatrix::from_row_slice(1, 1, &[1.0]);
    let force_history: Vec<DVector<f64>> = vec![]; // Empty!
    
    let config = TimeHistoryConfig {
        dt: 0.01,
        duration: 0.0,
        method: IntegrationMethod::default(),
        damping: DampingModel::None,
        output_interval: 1,
    };
    
    let solver = TimeHistorySolver::new(config);
    let result = solver.analyze(&k, &m, &force_history, None, None);
    
    assert!(result.is_err(), "Should reject empty force history");
    println!("✓ Correctly rejected empty force history");
}
