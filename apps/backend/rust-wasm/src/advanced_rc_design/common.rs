pub fn circle_area(diameter_mm: f64) -> f64 {
    std::f64::consts::PI * diameter_mm.powi(2) / 4.0
}

pub fn table19_tau_c(fck: f64, pt: f64) -> f64 {
    let pt = pt.max(0.15).min(3.0);
    let beta_sp = (0.8 * fck / (6.89 * pt.max(0.15))).max(1.0);
    0.85 * (0.8 * fck).sqrt() * ((1.0 + 5.0 * beta_sp).sqrt() - 1.0) / (6.0 * beta_sp)
}

pub fn max_shear_stress(fck: f64) -> f64 {
    0.63 * fck.sqrt()
}