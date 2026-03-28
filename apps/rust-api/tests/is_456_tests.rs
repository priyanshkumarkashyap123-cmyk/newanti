use beamlab_rust_api::design_codes::is_456::{table_19_tc, flexural_capacity_singly_with_version, IS456Version};

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
    assert!((tc - 0.62 * (40.0f64/20.0).sqrt()).abs() < 0.1), "Scaling error, got {}", tc);
}

#[test]
fn test_flexural_capacity_singly() {
    // Example: b=300 mm, d=500 mm, fck=25 MPa, fy=415 MPa, Ast=400 mm²
    let mu = flexural_capacity_singly_with_version(300.0, 500.0, 25.0, 415.0, 400.0, IS456Version::V2000);
    // Expect a positive capacity
    assert!(mu > 0.0, "Flexural capacity should be positive, got {}", mu);
}
