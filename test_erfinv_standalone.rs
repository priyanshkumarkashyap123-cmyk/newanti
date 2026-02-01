use std::f64::consts::{PI, SQRT_2};

// Copy of erfinv from special_functions
fn erfinv(y: f64) -> f64 {
    if y < -1.0 || y > 1.0 {
        return f64::NAN;
    }
    if y == -1.0 {
        return f64::NEG_INFINITY;
    }
    if y == 1.0 {
        return f64::INFINITY;
    }
    if y == 0.0 {
        return 0.0;
    }
    
    let sign = if y < 0.0 { -1.0 } else { 1.0 };
    let y_abs = y.abs();
    
    // Initial guess using simple rational approximation
    let w = -((1.0 - y_abs) * (1.0 + y_abs)).ln();
    let mut x = if w < 5.0 {
        let w = w - 2.5;
        let p = 2.81022636e-08f64.mul_add(w, 3.43273939e-07).mul_add(w, -3.5233877e-06)
            .mul_add(w, -4.39150654e-06).mul_add(w, 0.00021858087).mul_add(w, -0.00125372503)
            .mul_add(w, -0.00417768164).mul_add(w, 0.246640727).mul_add(w, 1.50140941);
        let q = 2.12344565e-08f64.mul_add(w, 1.28358e-07).mul_add(w, -1.02698715e-05)
            .mul_add(w, 2.38560742e-05).mul_add(w, 0.000109237065).mul_add(w, -0.00184039341)
            .mul_add(w, -0.0367342088).mul_add(w, 0.995346041).mul_add(w, 1.0);
        p / q
    } else {
        let w = w.sqrt() - 3.0;
        let p = 6.09951649e-08f64.mul_add(w, 2.45637599e-06).mul_add(w, 0.00015516896)
            .mul_add(w, 0.00536394404).mul_add(w, 0.0946544167).mul_add(w, 0.866377284)
            .mul_add(w, 3.94547046).mul_add(w, 8.56081202).mul_add(w, 6.65079579);
        let q = 7.46855133e-08f64.mul_add(w, 1.83608067e-05).mul_add(w, 0.00207688744)
            .mul_add(w, 0.111537604).mul_add(w, 3.08809622).mul_add(w, 42.9434076)
            .mul_add(w, 287.295875).mul_add(w, 817.182784).mul_add(w, 654.488786).mul_add(w, 1.0);
        p / q
    };
    
    x * sign
}

fn main() {
    let y = 0.9;
    let x = erfinv(y);
    println!("erfinv({}) = {}", y, x);
    println!("√2 * erfinv({}) = {}", y, SQRT_2 * x);
    println!("Expected Φ⁻¹(0.95) ≈ 1.645");
}
