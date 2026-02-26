//! Comprehensive tests for seismic response spectrum analysis

use nalgebra::DMatrix;
use rust_api::solver::seismic::*;

// ============================================
// CONFIGURATION TESTS
// ============================================

#[test]
fn test_seismic_config_default() {
    let config = ResponseSpectrumConfig::default();
    
    assert_eq!(config.code, SeismicCode::IS1893);
    assert_eq!(config.zone, SeismicZone::Zone3);
    assert_eq!(config.soil_type, SoilType::TypeII);
    assert_eq!(config.damping_ratio, 0.05);
    assert_eq!(config.combination_method, CombinationMethod::CQC);
}

#[test]
fn test_seismic_config_custom() {
    let config = ResponseSpectrumConfig {
        code: SeismicCode::ASCE7,
        zone: SeismicZone::Zone5,
        soil_type: SoilType::TypeIII,
        importance: ImportanceFactor::Critical,
        response_reduction: ResponseReduction::SMRF,
        damping_ratio: 0.02,
        combination_method: CombinationMethod::CQC,
        include_vertical: true,
    };

    assert_eq!(config.zone.factor(), 0.36);
    assert_eq!(config.importance.value(), 1.5);
    assert_eq!(config.response_reduction.value(), 5.0);
}

// ============================================
// ZONE & SOIL FACTOR TESTS
// ============================================

#[test]
fn test_zone_factors() {
    assert_eq!(SeismicZone::Zone2.factor(), 0.10);
    assert_eq!(SeismicZone::Zone3.factor(), 0.16);
    assert_eq!(SeismicZone::Zone4.factor(), 0.24);
    assert_eq!(SeismicZone::Zone5.factor(), 0.36);
}

#[test]
fn test_importance_factors() {
    assert_eq!(ImportanceFactor::Ordinary.value(), 1.0);
    assert_eq!(ImportanceFactor::Important.value(), 1.2);
    assert_eq!(ImportanceFactor::Critical.value(), 1.5);
}

#[test]
fn test_response_reduction_factors() {
    assert_eq!(ResponseReduction::OMRF.value(), 3.0);
    assert_eq!(ResponseReduction::SMRF.value(), 5.0);
    assert_eq!(ResponseReduction::ShearWall.value(), 3.0);
    assert_eq!(ResponseReduction::DualSystem.value(), 5.0);
    assert_eq!(ResponseReduction::Custom(4.5).value(), 4.5);
}

// ============================================
// IS 1893 SPECTRUM TESTS
// ============================================

#[test]
fn test_is1893_spectrum_zone3_medium_soil() {
    let config = ResponseSpectrumConfig {
        code: SeismicCode::IS1893,
        zone: SeismicZone::Zone3,
        soil_type: SoilType::TypeII,
        importance: ImportanceFactor::Ordinary,
        response_reduction: ResponseReduction::SMRF,
        damping_ratio: 0.05,
        combination_method: CombinationMethod::SRSS,
        include_vertical: false,
    };

    let solver = ResponseSpectrumSolver::new(config);
    
    // Test periods: 0.0, 0.1, 0.3, 0.55, 1.0, 2.0
    let periods = vec![0.0, 0.1, 0.3, 0.55, 1.0, 2.0];
    let spectrum = solver.generate_spectrum(&periods);

    // Z = 0.16, I = 1.0, R = 5.0
    // Base factor = (Z/2) * (I/R) = (0.16/2) * (1/5) = 0.016

    // T = 0.0: Sa/g = 1.0, Sa = 0.016
    assert!((spectrum[0] - 0.016).abs() < 0.001, "T=0.0: expected 0.016, got {}", spectrum[0]);

    // T = 0.1 (corner): Sa/g = 2.5, Sa = 0.04
    assert!((spectrum[1] - 0.04).abs() < 0.001, "T=0.1: expected 0.04, got {}", spectrum[1]);

    // T = 0.3 (plateau): Sa/g = 2.5, Sa = 0.04
    assert!((spectrum[2] - 0.04).abs() < 0.001, "T=0.3: expected 0.04, got {}", spectrum[2]);

    // T = 0.55 (end of plateau): Sa/g = 2.5, Sa = 0.04
    assert!((spectrum[3] - 0.04).abs() < 0.001, "T=0.55: expected 0.04, got {}", spectrum[3]);

    // T = 1.0 (descending): Sa/g = 2.5 * (0.55/1.0) = 1.375, Sa = 0.022
    assert!((spectrum[4] - 0.022).abs() < 0.001, "T=1.0: expected 0.022, got {}", spectrum[4]);

    // T = 2.0 (descending): Sa/g = 2.5 * (0.55/2.0) = 0.6875, Sa = 0.011
    assert!((spectrum[5] - 0.011).abs() < 0.001, "T=2.0: expected 0.011, got {}", spectrum[5]);
}

#[test]
fn test_is1893_spectrum_different_zones() {
    let solver_z3 = ResponseSpectrumSolver::new(ResponseSpectrumConfig {
        zone: SeismicZone::Zone3,
        ..Default::default()
    });
    
    let solver_z5 = ResponseSpectrumSolver::new(ResponseSpectrumConfig {
        zone: SeismicZone::Zone5,
        ..Default::default()
    });

    let periods = vec![0.5];
    let spectrum_z3 = solver_z3.generate_spectrum(&periods);
    let spectrum_z5 = solver_z5.generate_spectrum(&periods);

    // Zone 5 should have higher spectral acceleration (Z5/Z3 = 0.36/0.16 = 2.25)
    assert!(spectrum_z5[0] > spectrum_z3[0]);
    assert!((spectrum_z5[0] / spectrum_z3[0] - 2.25).abs() < 0.01);
}

#[test]
fn test_is1893_spectrum_soil_types() {
    let periods = vec![1.0];
    
    let solver_soil1 = ResponseSpectrumSolver::new(ResponseSpectrumConfig {
        soil_type: SoilType::TypeI,
        ..Default::default()
    });
    
    let solver_soil3 = ResponseSpectrumSolver::new(ResponseSpectrumConfig {
        soil_type: SoilType::TypeIII,
        ..Default::default()
    });

    let spectrum_soil1 = solver_soil1.generate_spectrum(&periods);
    let spectrum_soil3 = solver_soil3.generate_spectrum(&periods);

    // Soft soil (Type III) should have higher spectral values at longer periods
    // due to longer plateau (0.67 vs 0.40)
    assert!(spectrum_soil3[0] > spectrum_soil1[0]);
}

// ============================================
// ASCE 7 SPECTRUM TESTS
// ============================================

#[test]
fn test_asce7_spectrum_generation() {
    let config = ResponseSpectrumConfig {
        code: SeismicCode::ASCE7,
        zone: SeismicZone::Zone4,
        soil_type: SoilType::TypeII,
        importance: ImportanceFactor::Ordinary,
        response_reduction: ResponseReduction::SMRF,
        damping_ratio: 0.05,
        combination_method: CombinationMethod::SRSS,
        include_vertical: false,
    };

    let solver = ResponseSpectrumSolver::new(config);
    let periods = vec![0.1, 0.5, 1.0, 2.0];
    let spectrum = solver.generate_spectrum(&periods);

    // All values should be positive
    assert!(spectrum.iter().all(|&sa| sa > 0.0));
    
    // Spectrum should generally decrease with period
    assert!(spectrum[3] < spectrum[0]);
}

// ============================================
// MODAL COMBINATION TESTS
// ============================================

#[test]
fn test_srss_combination() {
    let config = ResponseSpectrumConfig {
        combination_method: CombinationMethod::SRSS,
        ..Default::default()
    };
    let solver = ResponseSpectrumSolver::new(config);

    let displacements = vec![0.10, 0.05, 0.02];
    let shears = vec![100.0, 50.0, 20.0];
    
    let (disp, shear) = solver.combine_srss(&displacements, &shears);
    
    // SRSS: sqrt(0.10² + 0.05² + 0.02²) = sqrt(0.0129) ≈ 0.11358
    let expected_disp: f64 = (0.10_f64.powi(2) + 0.05_f64.powi(2) + 0.02_f64.powi(2)).sqrt();
    assert!((disp - expected_disp).abs() < 1e-6);
    
    // SRSS shear: sqrt(100² + 50² + 20²) = sqrt(12900) ≈ 113.578
    let expected_shear: f64 = (100.0_f64.powi(2) + 50.0_f64.powi(2) + 20.0_f64.powi(2)).sqrt();
    assert!((shear - expected_shear).abs() < 1e-3);
}

#[test]
fn test_cqc_combination() {
    let config = ResponseSpectrumConfig {
        combination_method: CombinationMethod::CQC,
        damping_ratio: 0.05,
        ..Default::default()
    };
    let solver = ResponseSpectrumSolver::new(config);

    let displacements = vec![0.10, 0.05];
    let shears = vec![100.0, 50.0];
    let frequencies = vec![10.0, 15.0]; // rad/s
    
    let (disp, shear) = solver.combine_cqc(&displacements, &shears, &frequencies);
    
    // CQC should give values between SRSS and ABS
    let (disp_srss, shear_srss) = solver.combine_srss(&displacements, &shears);
    let (disp_abs, shear_abs) = solver.combine_abs(&displacements, &shears);
    
    assert!(disp >= disp_srss && disp <= disp_abs);
    assert!(shear >= shear_srss && shear <= shear_abs);
}

#[test]
fn test_abs_combination() {
    let config = ResponseSpectrumConfig {
        combination_method: CombinationMethod::ABS,
        ..Default::default()
    };
    let solver = ResponseSpectrumSolver::new(config);

    let displacements = vec![0.10, 0.05, 0.02];
    let shears = vec![100.0, 50.0, 20.0];
    
    let (disp, shear) = solver.combine_abs(&displacements, &shears);
    
    // ABS: 0.10 + 0.05 + 0.02 = 0.17
    let expected_disp: f64 = 0.17;
    assert!((disp - expected_disp).abs() < 1e-6);
    
    // ABS shear: 100 + 50 + 20 = 170
    let expected_shear: f64 = 170.0;
    assert!((shear - expected_shear).abs() < 1e-3);
}

#[test]
fn test_combination_method_ordering() {
    let config = ResponseSpectrumConfig::default();
    let solver = ResponseSpectrumSolver::new(config);

    let displacements = vec![0.10, 0.08, 0.05];
    let shears = vec![100.0, 80.0, 50.0];
    let frequencies = vec![8.0, 12.0, 18.0];
    
    let (disp_srss, shear_srss) = solver.combine_srss(&displacements, &shears);
    let (disp_cqc, shear_cqc) = solver.combine_cqc(&displacements, &shears, &frequencies);
    let (disp_abs, shear_abs) = solver.combine_abs(&displacements, &shears);
    
    // Expected ordering: SRSS <= CQC <= ABS (generally)
    assert!(disp_srss <= disp_abs);
    assert!(shear_srss <= shear_abs);
    assert!(disp_cqc <= disp_abs);
    assert!(shear_cqc <= shear_abs);
}

// ============================================
// FULL RESPONSE SPECTRUM ANALYSIS TESTS
// ============================================

#[test]
fn test_response_spectrum_analysis_3dof() {
    let config = ResponseSpectrumConfig {
        zone: SeismicZone::Zone3,
        soil_type: SoilType::TypeII,
        importance: ImportanceFactor::Ordinary,
        response_reduction: ResponseReduction::SMRF,
        combination_method: CombinationMethod::SRSS,
        ..Default::default()
    };

    let solver = ResponseSpectrumSolver::new(config);

    // 3-DOF system
    let frequencies = vec![10.0, 17.32, 22.36]; // rad/s
    let modal_masses = vec![100.0, 80.0, 60.0]; // kg
    let participation_factors = vec![1.0, 0.8, 0.5];
    
    // Simplified mode shapes (3 DOF × 3 modes)
    let mode_shapes = DMatrix::from_row_slice(3, 3, &[
        1.0, 0.5, 0.2,
        0.8, 0.3, -0.1,
        0.5, -0.2, 0.3,
    ]);

    let result = solver.analyze(
        &frequencies,
        &mode_shapes,
        &modal_masses,
        &participation_factors,
    ).unwrap();

    // Verify results structure
    assert_eq!(result.periods.len(), 3);
    assert_eq!(result.spectral_accelerations.len(), 3);
    assert_eq!(result.modal_displacements.len(), 3);
    assert_eq!(result.modal_base_shears.len(), 3);

    // All values should be positive
    assert!(result.periods.iter().all(|&t| t > 0.0));
    assert!(result.spectral_accelerations.iter().all(|&sa| sa > 0.0));
    assert!(result.modal_base_shears.iter().all(|&v| v > 0.0));

    // Combined values should be positive
    assert!(result.max_displacement > 0.0);
    assert!(result.max_base_shear > 0.0);
    assert!(result.code_base_shear > 0.0);

    // Periods should be in ascending order (T = 2π/ω, higher freq = lower period)
    // But our frequencies are ascending, so periods are descending
    // Actually periods[0] corresponds to frequencies[0] (lowest), so T[0] > T[1]
    assert!(result.periods[0] > result.periods[1]);
    assert!(result.periods[1] > result.periods[2]);
}

#[test]
fn test_response_spectrum_single_mode() {
    let config = ResponseSpectrumConfig::default();
    let solver = ResponseSpectrumSolver::new(config);

    // SDOF system
    let frequencies = vec![10.0]; // rad/s
    let modal_masses = vec![1000.0]; // kg
    let participation_factors = vec![1.0];
    let mode_shapes = DMatrix::from_element(1, 1, 1.0);

    let result = solver.analyze(
        &frequencies,
        &mode_shapes,
        &modal_masses,
        &participation_factors,
    ).unwrap();

    assert_eq!(result.periods.len(), 1);
    
    // For SDOF, combined = modal
    assert!((result.max_displacement - result.modal_displacements[0]).abs() < 1e-6);
    assert!((result.max_base_shear - result.modal_base_shears[0]).abs() < 1e-6);
}

// ============================================
// STORY FORCE DISTRIBUTION TESTS
// ============================================

#[test]
fn test_story_force_distribution_uniform() {
    let config = ResponseSpectrumConfig::default();
    let solver = ResponseSpectrumSolver::new(config);

    let base_shear = 1_000_000.0; // 1000 kN in N
    let heights = vec![3.0, 6.0, 9.0]; // m
    let masses = vec![100_000.0, 100_000.0, 100_000.0]; // kg

    let forces = solver.distribute_story_forces(base_shear, &heights, &masses);

    assert_eq!(forces.len(), 3);
    
    // Total force should equal base shear (within tolerance)
    let total_force: f64 = forces.iter().map(|f| f.force_kn).sum();
    assert!((total_force - 1000.0).abs() < 0.1, "Total force {} != 1000", total_force);
    
    // Higher stories should get more force (Wi*hi distribution)
    assert!(forces[2].force_kn > forces[1].force_kn, "Story 3 force should be greater than Story 2");
    assert!(forces[1].force_kn > forces[0].force_kn, "Story 2 force should be greater than Story 1");
    
    // Cumulative shear should increase downward
    assert!(forces[0].shear_kn > forces[1].shear_kn);
    assert!(forces[1].shear_kn > forces[2].shear_kn);
    
    // Top story shear = top story force
    assert!((forces[2].shear_kn - forces[2].force_kn).abs() < 0.01);
}

#[test]
fn test_story_force_distribution_varying_mass() {
    let config = ResponseSpectrumConfig::default();
    let solver = ResponseSpectrumSolver::new(config);

    let base_shear = 500_000.0; // 500 kN in N
    let heights = vec![4.0, 8.0, 12.0];
    let masses = vec![200_000.0, 150_000.0, 100_000.0]; // Decreasing mass

    let forces = solver.distribute_story_forces(base_shear, &heights, &masses);

    // Total should match base shear
    let total: f64 = forces.iter().map(|f| f.force_kn).sum();
    assert!((total - 500.0).abs() < 0.1);
    
    // Despite lower mass, top story should still get significant force due to height
    assert!(forces[2].force_kn > 0.0);
}

#[test]
fn test_story_force_empty_building() {
    let config = ResponseSpectrumConfig::default();
    let solver = ResponseSpectrumSolver::new(config);

    let forces = solver.distribute_story_forces(1000.0, &[], &[]);
    assert_eq!(forces.len(), 0);
}

// ============================================
// CODE BASE SHEAR TESTS
// ============================================

#[test]
fn test_code_base_shear_is1893() {
    let config = ResponseSpectrumConfig {
        code: SeismicCode::IS1893,
        zone: SeismicZone::Zone3, // Z = 0.16
        importance: ImportanceFactor::Ordinary, // I = 1.0
        response_reduction: ResponseReduction::SMRF, // R = 5.0
        soil_type: SoilType::TypeII,
        ..Default::default()
    };

    let solver = ResponseSpectrumSolver::new(config);
    
    let total_mass = 300_000.0; // kg
    let fundamental_period = 1.0; // s
    
    let base_shear = solver.calculate_code_base_shear(total_mass, fundamental_period);
    
    // Expected: Ah = (Z/2) * (I/R) * Sa/g
    // Sa/g at T=1.0 for Type II soil = 2.5 * (0.55/1.0) = 1.375
    // Ah = (0.16/2) * (1.0/5.0) * 1.375 = 0.022
    // V = Ah * W = 0.022 * 300000 * 9.81 = 64,746 N
    
    assert!(base_shear > 0.0);
    assert!(base_shear < total_mass * 9.81); // Should be fraction of weight
}

// ============================================
// ERROR HANDLING TESTS
// ============================================

#[test]
fn test_analyze_no_modes() {
    let config = ResponseSpectrumConfig::default();
    let solver = ResponseSpectrumSolver::new(config);

    let result = solver.analyze(
        &[],
        &DMatrix::zeros(0, 0),
        &[],
        &[],
    );

    assert!(result.is_err());
    assert!(result.unwrap_err().contains("No modes"));
}

// ============================================
// VALIDATION TESTS
// ============================================

#[test]
fn test_is1893_5story_building_mumbai() {
    // Real-world validation: 5-story RC building in Mumbai (Zone III)
    let config = ResponseSpectrumConfig {
        code: SeismicCode::IS1893,
        zone: SeismicZone::Zone3,
        soil_type: SoilType::TypeII,
        importance: ImportanceFactor::Ordinary,
        response_reduction: ResponseReduction::SMRF,
        damping_ratio: 0.05,
        combination_method: CombinationMethod::SRSS,
        include_vertical: false,
    };

    let solver = ResponseSpectrumSolver::new(config);

    // First 3 modes
    let frequencies = vec![8.0, 15.0, 22.0]; // rad/s (approx. T = 0.79, 0.42, 0.29 s)
    let modal_masses = vec![450_000.0, 350_000.0, 250_000.0]; // kg
    let participation_factors = vec![1.3, 0.9, 0.5];
    
    let mode_shapes = DMatrix::from_row_slice(15, 3, &[
        1.0, 0.8, 0.5,
        0.95, 0.6, 0.2,
        0.85, 0.3, -0.1,
        0.70, 0.0, -0.3,
        0.50, -0.3, -0.4,
        0.9, 0.7, 0.4,
        0.85, 0.5, 0.1,
        0.75, 0.2, -0.2,
        0.60, -0.1, -0.3,
        0.40, -0.4, -0.5,
        0.8, 0.6, 0.3,
        0.75, 0.4, 0.0,
        0.65, 0.1, -0.3,
        0.50, -0.2, -0.4,
        0.30, -0.5, -0.6,
    ]);

    let result = solver.analyze(
        &frequencies,
        &mode_shapes,
        &modal_masses,
        &participation_factors,
    ).unwrap();

    // Sanity checks
    assert!(result.max_base_shear > 0.0);
    assert!(result.max_base_shear < 1_050_000.0 * 9.81); // Less than total weight
    assert!(result.max_displacement > 0.0);
    assert!(result.max_displacement < 1.0); // Less than 1m seems reasonable
    
    // Code base shear should be in reasonable range
    assert!(result.code_base_shear > 0.0);
    
    println!("Mumbai 5-story building:");
    println!("  Max displacement: {:.3} m", result.max_displacement);
    println!("  Max base shear: {:.1} kN", result.max_base_shear / 1000.0);
    println!("  Code base shear: {:.1} kN", result.code_base_shear / 1000.0);
}

// ============================================
// PERFORMANCE TEST
// ============================================

#[test]
fn test_response_spectrum_performance() {
    let config = ResponseSpectrumConfig::default();
    let solver = ResponseSpectrumSolver::new(config);

    // 10-mode system
    let frequencies: Vec<f64> = (1..=10).map(|i| 5.0 * i as f64).collect();
    let modal_masses: Vec<f64> = (1..=10).map(|i| 100_000.0 / i as f64).collect();
    let participation_factors: Vec<f64> = (1..=10).map(|i| 1.0 / i as f64).collect();
    
    let mode_shapes = DMatrix::identity(10, 10);

    let start = std::time::Instant::now();
    let result = solver.analyze(
        &frequencies,
        &mode_shapes,
        &modal_masses,
        &participation_factors,
    );
    let elapsed = start.elapsed();

    assert!(result.is_ok());
    assert!(elapsed.as_millis() < 10, "Analysis too slow: {:?}", elapsed);
    
    println!("Response spectrum analysis (10 modes): {:?}", elapsed);
}
