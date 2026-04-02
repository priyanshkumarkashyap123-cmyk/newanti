



pub fn circle_area(diameter_mm: f64) -> f64 {
    std::f64::consts::PI * diameter_mm.powi(2) / 4.0
}

pub fn ring_area(outer_diameter_mm: f64, inner_diameter_mm: f64) -> f64 {
    circle_area(outer_diameter_mm) - circle_area(inner_diameter_mm)
}