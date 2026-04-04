use std::f64::consts::PI;

pub fn deg_to_rad(deg: f64) -> f64 {
	deg * PI / 180.0
}

pub fn rad_to_deg(rad: f64) -> f64 {
	rad * 180.0 / PI
}

pub fn euclidean_length_3d(dx: f64, dy: f64, dz: f64) -> f64 {
	(dx * dx + dy * dy + dz * dz).sqrt()
}

pub fn euclidean_length_2d(dx: f64, dy: f64) -> f64 {
	(dx * dx + dy * dy).sqrt()
}

pub fn square(x: f64) -> f64 {
	x * x
}

pub fn cube(x: f64) -> f64 {
	x * x * x
}

pub fn pow4(x: f64) -> f64 {
	let x2 = x * x;
	x2 * x2
}

pub fn gravity_default() -> f64 {
	9.80665
}

pub fn gravity_direction_default() -> f64 {
	-1.0
}

pub fn member_axial_capacity_factor(phi: f64, fy: f64, a: f64) -> f64 {
	phi * fy * a
}

pub fn stress_block_factor(fck: f64, beta: f64) -> f64 {
	0.85 * (0.8 * fck).sqrt() * ((1.0 + 5.0 * beta).sqrt() - 1.0) / (6.0 * beta)
}
