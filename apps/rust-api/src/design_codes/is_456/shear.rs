use super::traits::StructuralElement;

const TABLE_19_FCK: [f64; 7] = [15.0, 20.0, 25.0, 30.0, 35.0, 40.0, 45.0];
const TABLE_19_PT: [f64; 10] = [0.15, 0.25, 0.50, 0.75, 1.00, 1.25, 1.50, 1.75, 2.00, 3.00];

// IS 456 Table 19: τc values in N/mm²
const TABLE_19_TAU_C: [[f64; 10]; 7] = [
    [0.28, 0.36, 0.48, 0.58, 0.62, 0.70, 0.76, 0.81, 0.87, 0.95],
    [0.36, 0.48, 0.62, 0.74, 0.80, 0.87, 0.93, 0.99, 1.04, 1.12],
    [0.40, 0.54, 0.70, 0.82, 0.90, 0.98, 1.05, 1.11, 1.16, 1.24],
    [0.44, 0.60, 0.76, 0.90, 0.98, 1.06, 1.13, 1.19, 1.24, 1.31],
    [0.48, 0.64, 0.82, 0.96, 1.05, 1.13, 1.20, 1.26, 1.31, 1.38],
    [0.50, 0.68, 0.86, 1.00, 1.10, 1.18, 1.25, 1.31, 1.36, 1.43],
    [0.52, 0.70, 0.90, 1.04, 1.14, 1.22, 1.29, 1.35, 1.40, 1.46],
];

#[derive(Debug, Clone)]
pub struct ShearCheckResult {
    pub passed: bool,
    pub utilization: f64,
    pub message: String,
    pub clause: &'static str,
    pub tau_v: f64,
    pub tau_c: f64,
    pub vc_kn: f64,
}

fn lerp(x0: f64, x1: f64, y0: f64, y1: f64, x: f64) -> f64 {
    if (x1 - x0).abs() < f64::EPSILON { return y0; }
    y0 + (y1 - y0) * (x - x0) / (x1 - x0)
}

fn bracket_index(values: &[f64], x: f64) -> usize {
    if x <= values[0] { return 0; }
    if x >= values[values.len() - 1] { return values.len() - 2; }
    values.windows(2).position(|w| x >= w[0] && x <= w[1]).unwrap_or(values.len() - 2)
}

/// IS 456:2000 Table 19 interpolation for concrete shear stress τc.
pub fn calculate_tau_c(fck: f64, pt: f64) -> f64 {
    let i = bracket_index(&TABLE_19_FCK, fck);
    let j = bracket_index(&TABLE_19_PT, pt);

    let fck0 = TABLE_19_FCK[i];
    let fck1 = TABLE_19_FCK[i + 1];
    let pt0 = TABLE_19_PT[j];
    let pt1 = TABLE_19_PT[j + 1];

    let q00 = TABLE_19_TAU_C[i][j];
    let q01 = TABLE_19_TAU_C[i][j + 1];
    let q10 = TABLE_19_TAU_C[i + 1][j];
    let q11 = TABLE_19_TAU_C[i + 1][j + 1];

    let r0 = lerp(pt0, pt1, q00, q01, pt);
    let r1 = lerp(pt0, pt1, q10, q11, pt);
    lerp(fck0, fck1, r0, r1, fck)
}

/// Table 19-based shear capacity check for a structural element.
pub fn calculate_shear_capacity<T: StructuralElement>(
    element: &T,
    vu_kn: f64,
    ast_mm2: f64,
) -> ShearCheckResult {
    let b = element.width_mm().max(f64::EPSILON);
    let d = element.effective_depth_mm().max(f64::EPSILON);
    let fck = element.fck_mpa().max(f64::EPSILON);
    let pt = (ast_mm2 / (b * d)) * 100.0;
    let tau_v = vu_kn * 1000.0 / (b * d);
    let tau_c = calculate_tau_c(fck, pt);
    let vc_kn = tau_c * b * d / 1000.0;
    let utilization = if vc_kn > f64::EPSILON { vu_kn.abs() / vc_kn } else { f64::INFINITY };

    ShearCheckResult {
        passed: tau_v <= tau_c,
        utilization,
        message: format!("IS 456 shear check using Table 19; τv={:.3}, τc={:.3}", tau_v, tau_c),
        clause: "IS 456:2000, Cl. 40.1-40.5, Table 19",
        tau_v,
        tau_c,
        vc_kn,
    }
}

