pub fn interp_sa(periods: &[f64], ordinates: &[f64], period: f64) -> f64 {
    if periods.is_empty() || ordinates.is_empty() || periods.len() != ordinates.len() {
        return 0.0;
    }

    if period <= periods[0] {
        return ordinates[0];
    }

    for i in 0..(periods.len() - 1) {
        let t1 = periods[i];
        let t2 = periods[i + 1];
        if period <= t2 {
            let y1 = ordinates[i];
            let y2 = ordinates[i + 1];
            let ratio = (period - t1) / (t2 - t1);
            return y1 + ratio * (y2 - y1);
        }
    }

    *ordinates.last().unwrap_or(&0.0)
}

pub fn gen_is1893_spectrum(zone_factor: f64, soil_factor: f64, damping_factor: f64) -> Vec<(f64, f64)> {
    let periods = [0.0, 0.1, 0.55, 1.0, 2.0, 4.0];
    let ordinates = [1.0, 2.5, 2.5, 1.7, 1.0, 0.5];

    periods
        .into_iter()
        .map(|t| {
            let sa = interp_sa(&periods, &ordinates, t) * zone_factor * soil_factor * damping_factor;
            (t, sa)
        })
        .collect()
}
