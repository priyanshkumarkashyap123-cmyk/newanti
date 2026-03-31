pub fn aci209_strength(fck: f64, t_days: f64) -> f64 {
    let a = 0.4;
    let b = 0.85;
    let c = 0.95;
    fck * (a + b * (1.0 - (-c * t_days).exp()))
}

pub fn aci209_modulus(fck: f64) -> f64 {
    4700.0 * fck.sqrt()
}

pub fn aci209_creep(humidity: f64, volume_to_surface: f64, t_days: f64) -> f64 {
    let phi0 = 2.35 - 0.1 * humidity + 0.05 * volume_to_surface;
    phi0 / (1.0 + 0.1 * t_days)
}

pub fn aci209_shrinkage(humidity: f64, volume_to_surface: f64, t_days: f64) -> f64 {
    let eps_sh0 = 780.0e-6 * (1.0 - humidity / 100.0);
    eps_sh0 * (1.0 - (-0.03 * t_days).exp()) * (1.0 + 0.1 * volume_to_surface)
}

pub fn calculate_tau_b(fck: f64, rho: f64, sigma_cp: f64) -> f64 {
    0.25 * fck.sqrt() + 0.7 * rho + 0.1 * sigma_cp
}
