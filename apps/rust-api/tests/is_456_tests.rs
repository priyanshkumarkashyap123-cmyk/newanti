use beamlab_rust_api::design_codes::is_456::{
    flexural_capacity_singly_with_version, table_19_tc, IS456Version,
};

#[test]
fn test_table_19_tc_baseline() {
    // For M20 and pt=1.0 (1%), table value should be around 0.62 N/mm²
    let tc = table_19_tc(20.0, 1.0);
    assert!((tc - 0.62).abs() < 0.05, "Expected ~0.62, got {}", tc);
}

#[test]
fn test_table_19_tc_scale() {
    // For M40, scaled value sqrt(40/20)*0.62 ~ 0.877
    let tc = table_19_tc(40.0, 1.0);
    assert!(
        (tc - 0.62 * (40.0f64 / 20.0).sqrt()).abs() < 0.1,
        "Scaling error, got {}",
        tc
    );
}

#[test]
fn test_flexural_capacity_singly() {
    // Example: b=300 mm, d=500 mm, fck=25 MPa, fy=415 MPa, Ast=400 mm²
    let mu = flexural_capacity_singly_with_version(
        300.0,
        500.0,
        25.0,
        415.0,
        400.0,
        IS456Version::V2000,
    );
    // Expect a positive capacity
    assert!(mu > 0.0, "Flexural capacity should be positive, got {}", mu);
}

// Additional tests for coding accuracy
#[test]
fn test_table_19_known_points() {
    // Base table points for M20
    assert!(
        (table_19_tc(20.0, 0.15) - 0.28).abs() < 1e-3,
        "Expected 0.28 at 0.15%, got {}",
        table_19_tc(20.0, 0.15)
    );
    assert!(
        (table_19_tc(20.0, 2.50) - 0.82).abs() < 1e-3,
        "Expected 0.82 at 2.5%, got {}",
        table_19_tc(20.0, 2.50)
    );
}

#[test]
fn test_design_safety_factors_constants() {
    use beamlab_rust_api::design_codes::is_456::{GAMMA_C, GAMMA_S};
    assert_eq!(GAMMA_C, 1.50, "GAMMA_C must be 1.50");
    assert_eq!(GAMMA_S, 1.15, "GAMMA_S must be 1.15");
}

#[test]
fn test_stirrup_spacing_limits() {
    // For Vus = 80 kN, d = 450 mm
    let (_dia, spacing, _asv) =
        beamlab_rust_api::design_codes::is_456::design_stirrup_spacing(80.0, 300.0, 450.0, 415.0);
    // Minimum spacing 75 mm per Cl.26.5.1.5
    assert!(spacing >= 75.0, "Spacing {} is below min 75 mm", spacing);
    // Maximum spacing 0.75*d per Cl.40.4
    assert!(
        spacing <= 0.75 * 450.0,
        "Spacing {} exceeds max 0.75d",
        spacing
    );
}
