// ============================================================================
// ELLIPTIC INTEGRALS
// ============================================================================

use std::f64::consts::PI;

/// Complete elliptic integral of the first kind K(k)
/// K(k) = ∫₀^(π/2) dθ / √(1 - k²sin²θ)
pub fn ellipk(k: f64) -> f64 {
    if k.abs() >= 1.0 {
        return f64::INFINITY;
    }
    
    // Arithmetic-geometric mean method
    let mut a = 1.0;
    let mut b = (1.0 - k * k).sqrt();
    
    for _ in 0..50 {
        let a_new = (a + b) / 2.0;
        let b_new = (a * b).sqrt();
        
        if (a_new - b_new).abs() < 1e-15 {
            break;
        }
        
        a = a_new;
        b = b_new;
    }
    
    PI / (2.0 * a)
}

/// Complete elliptic integral of the second kind E(k)
/// E(k) = ∫₀^(π/2) √(1 - k²sin²θ) dθ
pub fn ellipe(k: f64) -> f64 {
    if k.abs() > 1.0 {
        return f64::NAN;
    }
    if k.abs() == 1.0 {
        return 1.0;
    }
    
    // Arithmetic-geometric mean method
    let mut a = 1.0;
    let mut b = (1.0 - k * k).sqrt();
    let mut _c = k.abs();
    let mut sum = k * k;
    let mut power = 1.0;
    
    for _ in 0..50 {
        let a_new = (a + b) / 2.0;
        let b_new = (a * b).sqrt();
        _c = (a - b) / 2.0;
        
        power *= 2.0;
        sum += power * _c * _c;
        
        if _c.abs() < 1e-15 {
            break;
        }
        
        a = a_new;
        b = b_new;
    }
    
    PI / (2.0 * a) * (1.0 - sum / 2.0)
}

/// Incomplete elliptic integral of the first kind F(φ, k)
/// F(φ, k) = ∫₀^φ dθ / √(1 - k²sin²θ)
pub fn ellipf(phi: f64, k: f64) -> f64 {
    if k.abs() > 1.0 {
        return f64::NAN;
    }
    
    // Handle special cases
    if phi == 0.0 {
        return 0.0;
    }
    if k == 0.0 {
        return phi;
    }
    if k.abs() == 1.0 {
        return phi.tan().asinh();
    }
    
    // Carlson's form using RF
    let sin_phi = phi.sin();
    let cos_phi = phi.cos();
    let _c = 1.0 / (sin_phi * sin_phi);
    let k2 = k * k;
    
    sin_phi * carlson_rf(cos_phi * cos_phi, 1.0 - k2 * sin_phi * sin_phi, 1.0)
}

/// Carlson's symmetric elliptic integral RF(x, y, z)
///
/// Computes RF via the duplication algorithm. When x ≈ y ≈ z ≈ μ,
/// the result is (1/√μ) with higher-order correction terms from
/// E₂ = dₓdᵧ + dᵧdᵤ + dᵤdₓ and E₃ = dₓdᵧdᵤ.
fn carlson_rf(x: f64, y: f64, z: f64) -> f64 {
    let mut x = x;
    let mut y = y;
    let mut z = z;
    
    for _ in 0..50 {
        let lambda = (x * y).sqrt() + (y * z).sqrt() + (z * x).sqrt();
        x = (x + lambda) / 4.0;
        y = (y + lambda) / 4.0;
        z = (z + lambda) / 4.0;
        
        let avg = (x + y + z) / 3.0;
        let dx = (avg - x) / avg;
        let dy = (avg - y) / avg;
        let dz = (avg - z) / avg;
        
        if dx.abs().max(dy.abs()).max(dz.abs()) < 1e-14 {
            break;
        }
    }
    
    // Correct formula: 1/√μ with series correction terms
    let avg = (x + y + z) / 3.0;
    let dx = (avg - x) / avg;
    let dy = (avg - y) / avg;
    let dz = (avg - z) / avg;
    let e2 = dx * dy + dy * dz + dz * dx;
    let e3 = dx * dy * dz;
    (1.0 - e2 / 10.0 + e3 / 14.0 + e2 * e2 / 24.0 - 3.0 * e2 * e3 / 44.0) / avg.sqrt()
}

// ============================================================================
