// ============================================================================
// GAMMA FUNCTION FAMILY
// ============================================================================

use std::f64::consts::PI;

/// Gamma function: Γ(x) = ∫₀^∞ t^(x-1) e^(-t) dt
/// 
/// Uses Lanczos approximation for high accuracy.
pub fn gamma(x: f64) -> f64 {
    if x.is_nan() {
        return f64::NAN;
    }
    
    // Handle special cases
    if x <= 0.0 && x == x.floor() {
        return f64::INFINITY; // Poles at non-positive integers
    }
    
    // Reflection formula for negative x
    if x < 0.5 {
        return PI / ((PI * x).sin() * gamma(1.0 - x));
    }
    
    let x = x - 1.0;
    
    // Lanczos coefficients (g=7)
    let p = [
        0.99999999999980993,
        676.5203681218851,
        -1259.1392167224028,
        771.32342877765313,
        -176.61502916214059,
        12.507343278686905,
        -0.13857109526572012,
        9.9843695780195716e-6,
        1.5056327351493116e-7,
    ];
    
    let g = 7.0;
    
    let mut sum = p[0];
    for i in 1..9 {
        sum += p[i] / (x + i as f64);
    }
    
    let t = x + g + 0.5;
    (2.0 * PI).sqrt() * t.powf(x + 0.5) * (-t).exp() * sum
}

/// Natural logarithm of gamma function: ln(Γ(x))
/// 
/// More stable than ln(gamma(x)) for large x.
pub fn lgamma(x: f64) -> f64 {
    if x.is_nan() || x <= 0.0 {
        return f64::NAN;
    }
    
    // For small x, use gamma directly
    if x < 12.0 {
        return gamma(x).ln();
    }
    
    // Stirling's approximation with correction terms
    let x2 = x * x;
    let x3 = x2 * x;
    let x5 = x3 * x2;
    let x7 = x5 * x2;
    
    (x - 0.5) * x.ln() - x + 0.5 * (2.0 * PI).ln()
        + 1.0 / (12.0 * x)
        - 1.0 / (360.0 * x3)
        + 1.0 / (1260.0 * x5)
        - 1.0 / (1680.0 * x7)
}

/// Digamma function (psi): ψ(x) = d/dx ln(Γ(x)) = Γ'(x)/Γ(x)
pub fn digamma(x: f64) -> f64 {
    if x.is_nan() || x <= 0.0 && x == x.floor() {
        return f64::NAN;
    }
    
    // Reflection formula
    if x < 0.0 {
        return digamma(1.0 - x) - PI / (PI * x).tan();
    }
    
    // Shift argument to x >= 6 for asymptotic expansion
    let mut result = 0.0;
    let mut x = x;
    
    while x < 6.0 {
        result -= 1.0 / x;
        x += 1.0;
    }
    
    // Asymptotic expansion
    let x2 = x * x;
    result += x.ln() - 0.5 / x
        - 1.0 / (12.0 * x2)
        + 1.0 / (120.0 * x2 * x2)
        - 1.0 / (252.0 * x2 * x2 * x2);
    
    result
}

/// Beta function: B(a, b) = Γ(a)Γ(b)/Γ(a+b)
pub fn beta(a: f64, b: f64) -> f64 {
    (lgamma(a) + lgamma(b) - lgamma(a + b)).exp()
}

/// Lower incomplete gamma function: γ(s, x) = ∫₀ˣ t^(s-1) e^(-t) dt
/// 
/// Returns γ(s, x) / Γ(s) (regularized form)
pub fn gammainc(s: f64, x: f64) -> f64 {
    if x < 0.0 || s <= 0.0 {
        return f64::NAN;
    }
    if x == 0.0 {
        return 0.0;
    }
    
    // Use series for small x, continued fraction for large x
    if x < s + 1.0 {
        // Series expansion
        gammainc_series(s, x)
    } else {
        // Continued fraction
        1.0 - gammainc_cf(s, x)
    }
}

/// Upper incomplete gamma function: Γ(s, x) = ∫ₓ^∞ t^(s-1) e^(-t) dt
/// 
/// Returns Γ(s, x) / Γ(s) (regularized form)
pub fn gammaincc(s: f64, x: f64) -> f64 {
    1.0 - gammainc(s, x)
}

fn gammainc_series(s: f64, x: f64) -> f64 {
    let max_iter = 200;
    let eps = 1e-14;
    
    let mut sum = 1.0 / s;
    let mut term = 1.0 / s;
    
    for n in 1..max_iter {
        term *= x / (s + n as f64);
        sum += term;
        if term.abs() < eps * sum.abs() {
            break;
        }
    }
    
    sum * (-x + s * x.ln() - lgamma(s)).exp()
}

fn gammainc_cf(s: f64, x: f64) -> f64 {
    let max_iter = 200;
    let eps = 1e-14;
    
    let mut c = f64::MAX;
    let mut d = 1.0 / (x + 1.0 - s);
    let mut h = d;
    
    for n in 1..max_iter {
        let an = -(s - n as f64) * n as f64;
        let bn = x + (2 * n + 1) as f64 - s;
        
        d = bn + an * d;
        if d.abs() < 1e-30 {
            d = 1e-30;
        }
        d = 1.0 / d;
        
        c = bn + an / c;
        if c.abs() < 1e-30 {
            c = 1e-30;
        }
        
        let delta = c * d;
        h *= delta;
        
        if (delta - 1.0).abs() < eps {
            break;
        }
    }
    
    h * (-x + s * x.ln() - lgamma(s)).exp()
}

/// Regularized incomplete beta function: I_x(a, b) = B(x; a, b) / B(a, b)
pub fn betainc(x: f64, a: f64, b: f64) -> f64 {
    if x < 0.0 || x > 1.0 || a <= 0.0 || b <= 0.0 {
        return f64::NAN;
    }
    if x == 0.0 {
        return 0.0;
    }
    if x == 1.0 {
        return 1.0;
    }
    
    // Use symmetry: I_x(a,b) = 1 - I_{1-x}(b,a)
    if x > (a + 1.0) / (a + b + 2.0) {
        return 1.0 - betainc(1.0 - x, b, a);
    }
    
    // Use Gauss-Legendre quadrature for better accuracy
    // I_x(a,b) = x^a * (1-x)^b / (a * B(a,b)) * CF
    // where B(a,b) is the beta function
    
    // Alternatively, use series expansion for small x
    betainc_cf(x, a, b)
}

/// Incomplete beta function using continued fraction (Lentz's algorithm)
fn betainc_cf(x: f64, a: f64, b: f64) -> f64 {
    let lbeta = lgamma(a) + lgamma(b) - lgamma(a + b);
    let front = (a * x.ln() + b * (1.0 - x).ln() - lbeta).exp() / a;
    
    let fpmin = 1e-30;
    let eps = 1e-10;
    let max_iter = 200;
    
    // Modified Lentz's method for the continued fraction:
    // I_x(a,b) = front / (1 + d1/(1 + d2/(1 + ...)))
    
    let mut c = 1.0;
    let mut d = 1.0 - (a + b) * x / (a + 1.0);
    if d.abs() < fpmin { d = fpmin; }
    d = 1.0 / d;
    let mut h = d;
    
    for m in 1..=max_iter {
        let m_f = m as f64;
        
        // First partial quotient in this pair (m = 1, 2, 3, ...)
        let aa = m_f * (b - m_f) * x / ((a + 2.0 * m_f - 1.0) * (a + 2.0 * m_f));
        
        d = 1.0 + aa * d;
        if d.abs() < fpmin { d = fpmin; }
        c = 1.0 + aa / c;
        if c.abs() < fpmin { c = fpmin; }
        d = 1.0 / d;
        h *= d * c;
        
        // Second partial quotient in this pair
        let aa = -(a + m_f) * (a + b + m_f) * x / ((a + 2.0 * m_f) * (a + 2.0 * m_f + 1.0));
        
        d = 1.0 + aa * d;
        if d.abs() < fpmin { d = fpmin; }
        c = 1.0 + aa / c;
        if c.abs() < fpmin { c = fpmin; }
        d = 1.0 / d;
        let delta = d * c;
        h *= delta;
        
        if (delta - 1.0).abs() <= eps {
            break;
        }
    }
    
    front * h
}

