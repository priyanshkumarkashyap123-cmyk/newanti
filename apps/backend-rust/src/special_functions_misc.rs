// ============================================================================
// MISCELLANEOUS SPECIAL FUNCTIONS
// ============================================================================

use std::f64::consts::PI;

use crate::special_functions_gamma::gamma;

/// Factorial n!
pub fn factorial(n: u64) -> f64 {
    if n > 170 {
        return f64::INFINITY;
    }
    
    // Use lookup table for small n
    const FACTORIALS: [f64; 21] = [
        1.0, 1.0, 2.0, 6.0, 24.0, 120.0, 720.0, 5040.0, 40320.0, 362880.0,
        3628800.0, 39916800.0, 479001600.0, 6227020800.0, 87178291200.0,
        1307674368000.0, 20922789888000.0, 355687428096000.0, 6402373705728000.0,
        121645100408832000.0, 2432902008176640000.0
    ];
    
    if n <= 20 {
        FACTORIALS[n as usize]
    } else {
        gamma(n as f64 + 1.0)
    }
}

/// Double factorial n!! 
pub fn double_factorial(n: u64) -> f64 {
    if n <= 1 {
        return 1.0;
    }
    
    let mut result = 1.0;
    let mut k = n;
    while k > 1 {
        result *= k as f64;
        k -= 2;
    }
    result
}

/// Binomial coefficient C(n, k) = n! / (k! * (n-k)!)
pub fn binomial(n: u64, k: u64) -> f64 {
    if k > n {
        return 0.0;
    }
    if k == 0 || k == n {
        return 1.0;
    }
    
    // Use smaller k
    let k = k.min(n - k);
    
    let mut result = 1.0;
    for i in 0..k {
        result *= (n - i) as f64 / (i + 1) as f64;
    }
    result
}

/// Riemann zeta function ζ(s)
pub fn zeta(s: f64) -> f64 {
    if s == 1.0 {
        return f64::INFINITY;
    }
    if s < 0.0 && s == s.floor() {
        // Trivial zeros at negative even integers
        if s as i64 % 2 == 0 {
            return 0.0;
        }
    }
    
    // Reflection formula for s < 0.5
    if s < 0.5 {
        return (2.0 * PI).powf(s) * (PI * s / 2.0).sin() * gamma(1.0 - s) * zeta(1.0 - s) / PI;
    }
    
    // Euler product approximation for s > 1
    if s > 1.0 {
        let mut sum = 0.0;
        for n in 1..1000 {
            sum += 1.0 / (n as f64).powf(s);
        }
        return sum;
    }
    
    // For 0.5 <= s <= 1, use Dirichlet eta function
    let mut sum = 0.0;
    let mut sign = 1.0;
    for n in 1..1000 {
        sum += sign / (n as f64).powf(s);
        sign = -sign;
    }
    sum / (1.0 - 2.0_f64.powf(1.0 - s))
}

/// Exponential integral E1(x)
pub fn expint_e1(x: f64) -> f64 {
    if x <= 0.0 {
        return f64::NAN;
    }
    
    if x < 1.0 {
        // Series expansion
        let euler = 0.5772156649015329;
        let mut sum = -euler - x.ln();
        let mut term = x;
        
        for n in 1..100 {
            sum += term / n as f64;
            term *= -x / (n + 1) as f64;
            if term.abs() < 1e-15 {
                break;
            }
        }
        
        sum
    } else {
        // Continued fraction
        let _result = 0.0;
        let mut b = x + 1.0;
        let mut c = 1e30;
        let mut d = 1.0 / b;
        let mut h = d;
        
        for i in 1..100 {
            let a = -(i * i) as f64;
            b += 2.0;
            d = 1.0 / (a * d + b);
            c = b + a / c;
            let delta = c * d;
            h *= delta;
            if (delta - 1.0).abs() < 1e-14 {
                break;
            }
        }
        
        h * (-x).exp()
    }
}

/// Sine integral Si(x)
pub fn sinint(x: f64) -> f64 {
    if x == 0.0 {
        return 0.0;
    }
    
    let sign = if x < 0.0 { -1.0 } else { 1.0 };
    let x = x.abs();
    
    if x < 4.0 {
        // Series expansion
        let mut sum = x;
        let mut term = x;
        
        for n in 1..100 {
            term *= -x * x / ((2 * n) * (2 * n + 1)) as f64;
            let contribution = term / (2 * n + 1) as f64;
            sum += contribution;
            if contribution.abs() < 1e-15 {
                break;
            }
        }
        
        sign * sum
    } else {
        // Auxiliary functions for asymptotic expansion:
        // Si(x) = π/2 - f(x)·cos(x) - g(x)·sin(x)
        // f(x) ~ (1/x)·Σ (-1)^k (2k)!/x^{2k}, g(x) ~ (1/x²)·Σ (-1)^k (2k+1)!/x^{2k}
        let f = {
            let mut sum = 0.0;
            let mut term = 1.0 / x;
            for n in 0..50 {
                sum += term;
                term *= -(2 * n + 1) as f64 * (2 * n + 2) as f64 / (x * x);
                if term.abs() < 1e-15 {
                    break;
                }
            }
            sum  // sum already = f(x) = (1/x)(1 - 2!/x² + 4!/x⁴ - ...)
        };
        
        let g = {
            let mut sum = 0.0;
            let mut term = 1.0;
            for n in 0..50 {
                sum += term;
                term *= -(2 * n + 2) as f64 * (2 * n + 3) as f64 / (x * x);
                if term.abs() < 1e-15 {
                    break;
                }
            }
            sum / (x * x)
        };
        
        sign * (PI / 2.0 - f * x.cos() - g * x.sin())
    }
}

/// Cosine integral Ci(x)
pub fn cosint(x: f64) -> f64 {
    if x <= 0.0 {
        return f64::NAN;
    }
    
    let euler = 0.5772156649015329;
    
    if x < 4.0 {
        // Series expansion: Ci(x) = γ + ln(x) + Σ (-1)^n * x^(2n) / (2n * (2n)!)
        let mut sum = euler + x.ln();
        let x2 = x * x;
        let mut term = 1.0;  // Will represent (-1)^n * x^(2n) / (2n)!
        
        for n in 1..100 {
            // term = (-1)^n * x^(2n) / (2n)!
            term *= -x2 / ((2 * n - 1) * 2 * n) as f64;
            let contribution = term / (2 * n) as f64;
            sum += contribution;
            if contribution.abs() < 1e-15 {
                break;
            }
        }
        
        sum
    } else {
        // Auxiliary functions (same as sinint)
        // Ci(x) = f(x)·sin(x) - g(x)·cos(x)
        let f = {
            let mut sum = 0.0;
            let mut term = 1.0 / x;
            for n in 0..50 {
                sum += term;
                term *= -(2 * n + 1) as f64 * (2 * n + 2) as f64 / (x * x);
                if term.abs() < 1e-15 {
                    break;
                }
            }
            sum  // sum already = f(x) = (1/x)(1 - 2!/x² + 4!/x⁴ - ...)
        };
        
        let g = {
            let mut sum = 0.0;
            let mut term = 1.0;
            for n in 0..50 {
                sum += term;
                term *= -(2 * n + 2) as f64 * (2 * n + 3) as f64 / (x * x);
                if term.abs() < 1e-15 {
                    break;
                }
            }
            sum / (x * x)
        };
        
        f * x.sin() - g * x.cos()
    }
}

// ============================================================================
