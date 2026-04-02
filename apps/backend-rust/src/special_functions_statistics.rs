// STATISTICAL DISTRIBUTIONS
// ============================================================================

use std::f64::consts::PI;

use crate::special_functions_error::{erf, erfinv};
use crate::special_functions_gamma::{beta, gamma, betainc, gammainc};

/// Standard normal PDF: φ(x) = e^(-x²/2) / √(2π)
pub fn normpdf(x: f64) -> f64 {
    (-0.5 * x * x).exp() / (2.0 * PI).sqrt()
}

/// Standard normal CDF: Φ(x) = ∫_{-∞}^x φ(t) dt
pub fn normcdf(x: f64) -> f64 {
    0.5 * (1.0 + erf(x / 2.0_f64.sqrt()))
}

/// Inverse standard normal CDF (probit function)
pub fn norminv(p: f64) -> f64 {
    if p <= 0.0 {
        return f64::NEG_INFINITY;
    }
    if p >= 1.0 {
        return f64::INFINITY;
    }
    
    2.0_f64.sqrt() * erfinv(2.0 * p - 1.0)
}

/// Chi-squared CDF with k degrees of freedom
pub fn chi2cdf(x: f64, k: f64) -> f64 {
    if x <= 0.0 {
        return 0.0;
    }
    gammainc(k / 2.0, x / 2.0)
}

/// Inverse chi-squared CDF
pub fn chi2inv(p: f64, k: f64) -> f64 {
    if p <= 0.0 {
        return 0.0;
    }
    if p >= 1.0 {
        return f64::INFINITY;
    }
    
    // Newton's method
    let mut x = k; // Initial guess
    
    for _ in 0..50 {
        let f = chi2cdf(x, k) - p;
        let df = 0.5_f64.powf(k / 2.0) * x.powf(k / 2.0 - 1.0) * (-x / 2.0).exp() / gamma(k / 2.0);
        
        if df.abs() < 1e-15 {
            break;
        }
        
        let x_new = x - f / df;
        if (x_new - x).abs() < 1e-10 {
            break;
        }
        x = x_new.max(1e-10);
    }
    
    x
}

/// Student's t-distribution CDF
pub fn tcdf(t: f64, nu: f64) -> f64 {
    if nu <= 0.0 {
        return f64::NAN;
    }
    
    let x = nu / (nu + t * t);
    
    if t >= 0.0 {
        1.0 - 0.5 * betainc(x, nu / 2.0, 0.5)
    } else {
        0.5 * betainc(x, nu / 2.0, 0.5)
    }
}

/// Inverse Student's t-distribution CDF
pub fn tinv(p: f64, nu: f64) -> f64 {
    if p <= 0.0 {
        return f64::NEG_INFINITY;
    }
    if p >= 1.0 {
        return f64::INFINITY;
    }
    if nu <= 0.0 {
        return f64::NAN;
    }
    
    // Newton's method with initial guess from normal
    let mut t = norminv(p);
    
    for _ in 0..50 {
        let f = tcdf(t, nu) - p;
        let df = gamma((nu + 1.0) / 2.0) / (gamma(nu / 2.0) * (nu * PI).sqrt())
            * (1.0 + t * t / nu).powf(-(nu + 1.0) / 2.0);
        
        if df.abs() < 1e-15 {
            break;
        }
        
        let t_new = t - f / df;
        if (t_new - t).abs() < 1e-10 {
            break;
        }
        t = t_new;
    }
    
    t
}

/// F-distribution CDF
pub fn fcdf(x: f64, d1: f64, d2: f64) -> f64 {
    if x <= 0.0 {
        return 0.0;
    }
    if d1 <= 0.0 || d2 <= 0.0 {
        return f64::NAN;
    }
    
    betainc(d1 * x / (d1 * x + d2), d1 / 2.0, d2 / 2.0)
}

/// Inverse F-distribution CDF
pub fn finv(p: f64, d1: f64, d2: f64) -> f64 {
    if p <= 0.0 {
        return 0.0;
    }
    if p >= 1.0 {
        return f64::INFINITY;
    }
    if d1 <= 0.0 || d2 <= 0.0 {
        return f64::NAN;
    }
    
    // Newton's method
    let mut x = d2 / (d2 - 2.0).max(0.1); // Mean of F-distribution
    
    for _ in 0..50 {
        let f = fcdf(x, d1, d2) - p;
        
        // PDF of F-distribution
        let df = d1.powf(d1 / 2.0) * d2.powf(d2 / 2.0) / beta(d1 / 2.0, d2 / 2.0)
            * x.powf(d1 / 2.0 - 1.0) * (d1 * x + d2).powf(-(d1 + d2) / 2.0);
        
        if df.abs() < 1e-15 {
            break;
        }
        
        let x_new = x - f / df;
        if (x_new - x).abs() < 1e-10 {
            break;
        }
        x = x_new.max(1e-10);
    }
    
    x
}

