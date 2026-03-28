// Dynamic Analysis Tests
//
// Comprehensive test suite for modal and time-history analysis

use beamlab_rust_api::solver::dynamics::*;
use nalgebra::{DMatrix, DVector};
use std::f64::consts::PI;

#[test]
fn test_modal_config_default() {
    let config = ModalConfig::default();
    assert_eq!(config.num_modes, 10);
    assert_eq!(config.mass_type, MassMatrixType::Lumped);
    assert!(config.normalize_modes);
    assert!(config.compute_participation);
}

#[test]
fn test_modal_config_custom() {
    let config = ModalConfig {
        num_modes: 5,
        mass_type: MassMatrixType::Consistent,
        normalize_modes: false,
        compute_participation: false,
    };
    
    assert_eq!(config.num_modes, 5);
    assert_eq!(config.mass_type, MassMatrixType::Consistent);
    assert!(!config.normalize_modes);
    assert!(!config.compute_participation);
}

#[test]
fn test_modal_solver_creation() {
    let solver = ModalSolver::default();
    // Should not panic
}

#[test]
fn test_modal_sdof_oscillator() {
    // Single degree-of-freedom oscillator
    // m = 1 kg, k = 100 N/m
    // Expected: ω = sqrt(k/m) = 10 rad/s, T = 0.628 s
    
    let k = DMatrix::from_element(1, 1, 100.0);
    let m = DMatrix::from_element(1, 1, 1.0);
    
    let config = ModalConfig {
        num_modes: 1,
        mass_type: MassMatrixType::Lumped,
        normalize_modes: true,
        compute_participation: false,
    };
    
    let solver = ModalSolver::new(config);
    let result = solver.analyze(&k, &m).unwrap();
    
    assert!(result.converged);
    assert_eq!(result.num_modes, 1);
    assert_eq!(result.frequencies.len(), 1);
    assert_eq!(result.periods.len(), 1);
    
    // Check natural frequency (should be 10 rad/s)
    let omega = result.frequencies[0];
    assert!((omega - 10.0).abs() < 0.01, "Expected ω=10, got {}", omega);
    
    // Check period (should be 2π/10 ≈ 0.628 s)
    let period = result.periods[0];
    assert!((period - 0.6283).abs() < 0.01, "Expected T=0.628s, got {}s", period);
}

#[test]
fn test_modal_2dof_oscillator() {
    // Two degree-of-freedom system
    // m1 = m2 = 1 kg, k1 = k2 = k3 = 100 N/m
    
    let k = DMatrix::from_row_slice(2, 2, &[
        200.0, -100.0,
        -100.0, 200.0,
    ]);
    
    let m = DMatrix::from_diagonal(&DVector::from_vec(vec![1.0, 1.0]));
    
    let config = ModalConfig {
        num_modes: 2,
        mass_type: MassMatrixType::Lumped,
        normalize_modes: true,
        compute_participation: false,
    };
    
    let solver = ModalSolver::new(config);
    let result = solver.analyze(&k, &m).unwrap();
    
    assert!(result.converged);
    assert_eq!(result.num_modes, 2);
    
    // Expected frequencies: ω1 = 10 rad/s, ω2 = 17.32 rad/s
    let omega1 = result.frequencies[0];
    let omega2 = result.frequencies[1];
    
    assert!((omega1 - 10.0).abs() < 0.5, "Mode 1: expected ω=10, got {}", omega1);
    assert!((omega2 - 17.32).abs() < 0.5, "Mode 2: expected ω=17.32, got {}", omega2);
    
    println!("Mode 1: ω = {:.2} rad/s, T = {:.3} s", omega1, result.periods[0]);
    println!("Mode 2: ω = {:.2} rad/s, T = {:.3} s", omega2, result.periods[1]);
}

#[test]
fn test_modal_cantilever_beam() {
    // Simplified 3-DOF cantilever (only lateral degrees of freedom)
    // Fixed at base, 2 free nodes
    
    let n = 2; // 2 free DOFs
    let mut k = DMatrix::zeros(n, n);
    let mut m = DMatrix::zeros(n, n);
    
    // Simple spring-mass model
    k[(0, 0)] = 200.0;
    k[(1, 1)] = 200.0;
    k[(0, 1)] = -100.0;
    k[(1, 0)] = -100.0;
    
    // Lumped mass
    let mass_per_node = 100.0; // kg
    for i in 0..n {
        m[(i, i)] = mass_per_node;
    }
    
    let config = ModalConfig {
        num_modes: 2,
        mass_type: MassMatrixType::Lumped,
        normalize_modes: true,
        compute_participation: false,
    };
    
    let solver = ModalSolver::new(config);
    let result = solver.analyze(&k, &m).unwrap();
    
    assert!(result.converged);
    assert!(result.frequencies[0] > 0.0);
    
    println!("Cantilever fundamental frequency: {:.2} rad/s", result.frequencies[0]);
    println!("Cantilever fundamental period: {:.3} s", result.periods[0]);
}

#[test]
fn test_modal_participation_factors() {
    // Simple 2-DOF system with participation factor calculation
    
    let k = DMatrix::from_row_slice(2, 2, &[
        200.0, -100.0,
        -100.0, 200.0,
    ]);
    
    let m = DMatrix::from_diagonal(&DVector::from_vec(vec![1.0, 1.0]));
    
    let config = ModalConfig {
        num_modes: 2,
        mass_type: MassMatrixType::Lumped,
        normalize_modes: true,
        compute_participation: true,
    };
    
    let solver = ModalSolver::new(config);
    let result = solver.analyze(&k, &m).unwrap();
    
    assert!(result.converged);
    assert!(result.participation_factors.is_some());
    assert!(result.cumulative_participation.is_some());
    
    let participation = result.participation_factors.unwrap();
    let cumulative = result.cumulative_participation.unwrap();
    
    println!("Mode 1 participation: {:.3}", participation[0]);
    println!("Mode 2 participation: {:.3}", participation[1]);
    println!("Cumulative after mode 1: {:.1}%", cumulative[0] * 100.0);
    println!("Cumulative after mode 2: {:.1}%", cumulative[1] * 100.0);
    
    // Second mode should capture close to 100% of mass
    assert!(cumulative[1] > 0.9);
}

#[test]
fn test_modal_error_non_square_matrix() {
    let k = DMatrix::from_element(3, 2, 100.0);
    let m = DMatrix::from_element(2, 2, 1.0);
    
    let solver = ModalSolver::default();
    let result = solver.analyze(&k, &m);
    
    assert!(result.is_err());
    assert!(result.unwrap_err().contains("square"));
}

#[test]
fn test_modal_error_size_mismatch() {
    let k = DMatrix::from_element(3, 3, 100.0);
    let m = DMatrix::from_element(2, 2, 1.0);
    
    let solver = ModalSolver::default();
    let result = solver.analyze(&k, &m);
    
    assert!(result.is_err());
    assert!(result.unwrap_err().contains("same size"));
}

#[test]
fn test_modal_error_singular_mass() {
    let k = DMatrix::from_element(2, 2, 100.0);
    let m = DMatrix::zeros(2, 2); // Singular mass matrix
    
    let solver = ModalSolver::default();
    let result = solver.analyze(&k, &m);
    
    assert!(result.is_err());
    assert!(result.unwrap_err().contains("singular"));
}

#[test]
fn test_modal_normalize_modes() {
    let k = DMatrix::from_element(2, 2, 100.0);
    let m = DMatrix::from_diagonal(&DVector::from_vec(vec![1.0, 1.0]));
    
    let config = ModalConfig {
        num_modes: 2,
        mass_type: MassMatrixType::Lumped,
        normalize_modes: true,
        compute_participation: false,
    };
    
    let solver = ModalSolver::new(config);
    let result = solver.analyze(&k, &m).unwrap();
    
    // Check that mode shapes are normalized (max value = 1)
    for mode_idx in 0..result.num_modes {
        let mode = result.mode_shapes.column(mode_idx);
        let max_val = mode.iter().map(|v| v.abs()).fold(0.0, f64::max);
        assert!((max_val - 1.0).abs() < 0.01, "Mode {} not normalized: max = {}", mode_idx, max_val);
    }
}

#[test]
fn test_time_history_config() {
    let config = TimeHistoryConfig {
        dt: 0.01,
        duration: 10.0,
        method: IntegrationMethod::default(),
        damping: DampingModel::None,
        output_interval: 1,
    };
    
    assert_eq!(config.dt, 0.01);
    assert_eq!(config.duration, 10.0);
}

#[test]
fn test_time_history_sdof_free_vibration() {
    // Free vibration of SDOF system
    // m = 1 kg, k = 100 N/m, ω = 10 rad/s
    
    let k = DMatrix::from_element(1, 1, 100.0);
    let m = DMatrix::from_element(1, 1, 1.0);
    
    let dt = 0.01;
    let duration = 2.0;
    let n_steps = (duration / dt) as usize;
    
    // Zero force (free vibration)
    let force_history: Vec<DVector<f64>> = (0..n_steps)
        .map(|_| DVector::from_element(1, 0.0))
        .collect();
    
    // Initial displacement: u0 = 1.0 m
    let u0 = DVector::from_element(1, 1.0);
    
    let config = TimeHistoryConfig {
        dt,
        duration,
        method: IntegrationMethod::Newmark { beta: 0.25, gamma: 0.5 },
        damping: DampingModel::None,
        output_interval: 1,
    };
    
    let solver = TimeHistorySolver::new(config);
    let result = solver.analyze(&k, &m, &force_history, Some(&u0), None).unwrap();
    
    assert!(result.converged);
    assert!(result.num_steps == n_steps);
    
    // Check that displacement oscillates around zero
    let max_disp = result.max_displacements[0];
    assert!(max_disp > 0.9 && max_disp < 1.1, "Expected max ~1.0, got {}", max_disp);
    
    println!("Free vibration max displacement: {:.3} m", max_disp);
}

#[test]
fn test_time_history_sdof_forced_vibration() {
    // Forced vibration: harmonic load F = F0*sin(ωt)
    // m = 1 kg, k = 100 N/m
    
    let k = DMatrix::from_element(1, 1, 100.0);
    let m = DMatrix::from_element(1, 1, 1.0);
    
    let dt = 0.01;
    let duration = 3.0;
    let n_steps = (duration / dt) as usize;
    
    // Harmonic force: F = 10*sin(5t) N
    let force_frequency = 5.0; // rad/s (half of natural frequency)
    let force_amplitude = 10.0;
    
    let force_history: Vec<DVector<f64>> = (0..n_steps)
        .map(|i| {
            let t = i as f64 * dt;
            let f = force_amplitude * (force_frequency * t).sin();
            DVector::from_element(1, f)
        })
        .collect();
    
    let config = TimeHistoryConfig {
        dt,
        duration,
        method: IntegrationMethod::Newmark { beta: 0.25, gamma: 0.5 },
        damping: DampingModel::None,
        output_interval: 1,
    };
    
    let solver = TimeHistorySolver::new(config);
    let result = solver.analyze(&k, &m, &force_history, None, None).unwrap();
    
    assert!(result.converged);
    assert!(result.max_displacements[0] > 0.0);
    
    println!("Forced vibration max displacement: {:.3} m", result.max_displacements[0]);
}

#[test]
fn test_time_history_with_rayleigh_damping() {
    // SDOF with Rayleigh damping
    
    let k = DMatrix::from_element(1, 1, 100.0);
    let m = DMatrix::from_element(1, 1, 1.0);
    
    let dt = 0.01;
    let duration = 5.0;
    let n_steps = (duration / dt) as usize;
    
    let force_history: Vec<DVector<f64>> = (0..n_steps)
        .map(|_| DVector::from_element(1, 0.0))
        .collect();
    
    let u0 = DVector::from_element(1, 1.0);
    
    // Rayleigh damping: C = α*M + β*K
    // For 5% damping at ω = 10 rad/s: α = 0.1, β = 0.01
    let config = TimeHistoryConfig {
        dt,
        duration,
        method: IntegrationMethod::Newmark { beta: 0.25, gamma: 0.5 },
        damping: DampingModel::Rayleigh { alpha: 0.1, beta: 0.01 },
        output_interval: 1,
    };
    
    let solver = TimeHistorySolver::new(config);
    let result = solver.analyze(&k, &m, &force_history, Some(&u0), None).unwrap();
    
    assert!(result.converged);
    
    // With damping, amplitude should decay
    let final_disp = result.displacements.last().unwrap()[0].abs();
    assert!(final_disp < 0.5, "Expected decay, final displacement: {}", final_disp);
    
    println!("Damped vibration final displacement: {:.4} m", final_disp);
}

#[test]
fn test_time_history_2dof_system() {
    // 2-DOF system time-history
    
    let k = DMatrix::from_row_slice(2, 2, &[
        200.0, -100.0,
        -100.0, 200.0,
    ]);
    
    let m = DMatrix::from_diagonal(&DVector::from_vec(vec![1.0, 1.0]));
    
    let dt = 0.01;
    let duration = 2.0;
    let n_steps = (duration / dt) as usize;
    
    // Force on first DOF only
    let force_history: Vec<DVector<f64>> = (0..n_steps)
        .map(|i| {
            let t = i as f64 * dt;
            let f1 = 10.0 * (5.0 * t).sin();
            DVector::from_vec(vec![f1, 0.0])
        })
        .collect();
    
    let config = TimeHistoryConfig {
        dt,
        duration,
        method: IntegrationMethod::Newmark { beta: 0.25, gamma: 0.5 },
        damping: DampingModel::None,
        output_interval: 10,
    };
    
    let solver = TimeHistorySolver::new(config);
    let result = solver.analyze(&k, &m, &force_history, None, None).unwrap();
    
    assert!(result.converged);
    assert_eq!(result.max_displacements.len(), 2);
    
    println!("2-DOF max displacements: [{:.3}, {:.3}]", 
             result.max_displacements[0], result.max_displacements[1]);
}

#[test]
fn test_integration_method_newmark_average_acceleration() {
    // Average acceleration method (β=0.25, γ=0.5)
    let method = IntegrationMethod::Newmark { beta: 0.25, gamma: 0.5 };
    
    match method {
        IntegrationMethod::Newmark { beta, gamma } => {
            assert_eq!(beta, 0.25);
            assert_eq!(gamma, 0.5);
        }
        _ => panic!("Expected Newmark method"),
    }
}

#[test]
fn test_integration_method_newmark_linear_acceleration() {
    // Linear acceleration method (β=1/6, γ=0.5)
    let method = IntegrationMethod::Newmark { beta: 1.0/6.0, gamma: 0.5 };
    
    match method {
        IntegrationMethod::Newmark { beta, gamma } => {
            assert!((beta - 0.1667).abs() < 0.01);
            assert_eq!(gamma, 0.5);
        }
        _ => panic!("Expected Newmark method"),
    }
}

#[test]
fn test_damping_model_none() {
    let damping = DampingModel::None;
    match damping {
        DampingModel::None => { /* OK */ }
        _ => panic!("Expected None damping"),
    }
}

#[test]
fn test_damping_model_rayleigh() {
    let damping = DampingModel::Rayleigh { alpha: 0.1, beta: 0.01 };
    match damping {
        DampingModel::Rayleigh { alpha, beta } => {
            assert_eq!(alpha, 0.1);
            assert_eq!(beta, 0.01);
        }
        _ => panic!("Expected Rayleigh damping"),
    }
}

#[test]
fn test_time_history_performance() {
    // Performance test: 10-DOF system, 1000 time steps
    
    let n = 10;
    let k = DMatrix::from_diagonal(&DVector::from_element(n, 100.0));
    let m = DMatrix::from_diagonal(&DVector::from_element(n, 1.0));
    
    let dt = 0.01;
    let n_steps = 1000;
    
    let force_history: Vec<DVector<f64>> = (0..n_steps)
        .map(|_| DVector::zeros(n))
        .collect();
    
    let config = TimeHistoryConfig {
        dt,
        duration: n_steps as f64 * dt,
        method: IntegrationMethod::default(),
        damping: DampingModel::None,
        output_interval: 10,
    };
    
    let solver = TimeHistorySolver::new(config);
    
    let start = std::time::Instant::now();
    let result = solver.analyze(&k, &m, &force_history, None, None).unwrap();
    let elapsed = start.elapsed().as_millis();
    
    assert!(result.converged);
    assert!(elapsed < 500, "Analysis too slow: {} ms (target <500ms for 10 DOF, 1000 steps)", elapsed);
    
    println!("Time-history performance (10 DOF, 1000 steps): {} ms", elapsed);
}
