use beamlab_rust_api::design_codes::is_800::{
    bolt_grade, design_shear, GAMMA_M0, GAMMA_M1, GAMMA_MB, GAMMA_MF, GAMMA_MW, GAMMA_MW_FIELD,
};

#[test]
fn test_is800_safety_factors_constants() {
    assert_eq!(GAMMA_M0, 1.10, "γm0 must be 1.10");
    assert_eq!(GAMMA_M1, 1.25, "γm1 must be 1.25");
    assert_eq!(GAMMA_MB, 1.25, "γmb must be 1.25");
    assert_eq!(GAMMA_MW, 1.25, "γmw must be 1.25");
    assert_eq!(GAMMA_MW_FIELD, 1.50, "γmw_field must be 1.50");
    assert_eq!(GAMMA_MF, 1.10, "γmf must be 1.10");
}

#[test]
fn test_is800_design_shear_basic() {
    // Av = 300 mm × 10 mm = 3000 mm², fyw = 250 MPa
    // Vd = Av·fyw/(√3·γm0)/1000 ~ 3000*250/(1.732*1.10)/1000 ~ 393.8 kN
    let result = design_shear(300.0, 10.0, 250.0, 100.0);
    assert!(
        result.passed,
        "Shear of 100 kN should pass design capacity {} kN",
        result.vd_kn
    );
    assert!(
        result.utilization < 1.0,
        "Utilization {} must be <1",
        result.utilization
    );
}

#[test]
fn test_is800_bolt_grade() {
    let bg = bolt_grade("8.8").expect("Bolt grade 8.8 should exist");
    assert_eq!(bg.fub, 800.0, "Ultimate strength for 8.8 must be 800 N/mm²");
    assert_eq!(bg.fyb, 640.0, "Yield strength for 8.8 must be 640 N/mm²");
}

#[test]
fn test_design_bolt_bearing_results() {
    // Example: 2 bolts of 10mm, grade 8.8, plate_fu=250 N/mm², thk=10mm, 1 shear plane
    let res = beamlab_rust_api::design_codes::is_800::design_bolt_bearing(
        10.0, "8.8", 250.0, 10.0, 2, 1, 30.0, 50.0,
    )
    .unwrap();
    // Governing should be shear
    assert_eq!(res.governing, "shear");
    // Total capacity ≈ 2 × 22.6 kN = ~45.2 kN
    assert!(
        (res.total_capacity_kn - 45.2).abs() < 1.0,
        "Expected ~45 kN, got {}",
        res.total_capacity_kn
    );
}

#[test]
fn test_design_bolt_hsfg_results() {
    // Example: 2 HSFG bolts 10mm, grade 8.8, μ=0.3, kh=1.0, ne=1
    let res = beamlab_rust_api::design_codes::is_800::design_bolt_hsfg(10.0, "8.8", 2, 1, 0.3, 1.0)
        .unwrap();
    // Slip resistance per bolt ≈ 0.3×0.7×800×61.3/1.10/1000 ≈ 9.35 kN
    assert!(
        (res.slip_resistance_per_bolt_kn - 9.35).abs() < 0.5,
        "Expected ~9.35 kN, got {}",
        res.slip_resistance_per_bolt_kn
    );
    // Total capacity ≈ 2 × slip resistance
    assert!(
        (res.total_capacity_kn - 18.7).abs() < 1.0,
        "Expected ~18.7 kN, got {}",
        res.total_capacity_kn
    );
}

#[test]
fn test_design_fillet_weld_shop() {
    // Example: 5mm weld, 100mm length, fuw=410 MPa, shop weld
    let res = beamlab_rust_api::design_codes::is_800::design_fillet_weld(5.0, 100.0, 410.0, 50.0, "shop");
    // Throat = 0.7*5 = 3.5 mm, effective length = 90 mm
    // fw = 410/(√3*1.25) ≈ 189.4 MPa, capacity ≈ 3.5*90*189.4/1000 ≈ 59.7 kN
    assert!(res.passed, "Fillet weld of 50 kN should pass capacity {} kN", res.capacity_kn);
    assert!((res.capacity_kn - 59.7).abs() < 0.5, "Expected ~59.7 kN, got {}", res.capacity_kn);
}

#[test]
fn test_check_deflection_beam() {
    // Example: beam span 6000 mm, actual deflection 10 mm, allowable = L/300 = 20 mm
    let def = beamlab_rust_api::design_codes::is_800::check_deflection(6000.0, 10.0, "beam");
    assert!(def.passed, "Deflection 10 mm over 6000 mm span should pass allowable {} mm", def.allowable_mm);
    assert_eq!(def.span_divisor, 300.0, "Beam divisor should be L/300");
    assert_eq!(def.clause, "IS 800:2007 Table 6 (L/300)");
}

#[test]
fn test_classify_section() {
    use beamlab_rust_api::design_codes::is_800::{classify_section, SectionClass, IsmbSection};
    // Use ISMB200: depth 200, width 100, tf=10.8, tw=5.7, fy=250 MPa
    let sect = IsmbSection {
        name: "ISMB200".into(),
        depth: 200.0,
        width: 100.0,
        tw: 5.7,
        tf: 10.8,
        area: 3230.0,
        ixx: 0.0,
        iyy: 0.0,
        zxx: 0.0,
        zyy: 0.0,
        rxx: 0.0,
        ryy: 0.0,
        weight: 0.0,
    };
    let class = classify_section(&sect, 250.0);
    assert_eq!(class, SectionClass::Compact);
}
