//! Nataf transformation for correlated non-Gaussian random variables.

use std::f64::consts::PI;
use crate::special_functions::{gamma as gamma_func, lgamma, standard_normal_cdf, beta as beta_function, standard_normal_pdf};

fn standard_normal_inverse_cdf(p: f64) -> f64 {
    2.0_f64.sqrt() * crate::special_functions::erfinv(2.0 * p - 1.0)
}

fn lower_incomplete_gamma(a: f64, x: f64) -> f64 {
    let mut sum = 0.0;
    let mut term = 1.0 / a;
    sum += term;

    for n in 1..100 {
        term *= x / (a + n as f64);
        sum += term;
        if term.abs() < 1e-14 * sum.abs() {
            break;
        }
    }

    x.powf(a) * (-x).exp() * sum
}

fn beta_cf(a: f64, b: f64, x: f64) -> f64 {
    let mut c: f64 = 1.0;
    let mut d: f64 = 1.0 / (1.0 - (a + b) * x / (a + 1.0)).max(1e-30);
    let mut h: f64 = d;

    for m in 1..100 {
        let m = m as f64;

        let d_num: f64 = m * (b - m) * x / ((a + 2.0 * m - 1.0) * (a + 2.0 * m));
        d = 1.0 / (1.0 + d_num * d).max(1e-30);
        c = 1.0 + d_num / c.max(1e-30);
        h *= d * c;

        let d_num = -(a + m) * (a + b + m) * x / ((a + 2.0 * m) * (a + 2.0 * m + 1.0));
        d = 1.0 / (1.0 + d_num * d).max(1e-30);
        c = 1.0 + d_num / c.max(1e-30);

        let delta = d * c;
        h *= delta;

        if (delta - 1.0).abs() < 1e-10 {
            break;
        }
    }

    h
}

fn regularized_incomplete_beta(a: f64, b: f64, x: f64) -> f64 {
    if x <= 0.0 {
        return 0.0;
    }
    if x >= 1.0 {
        return 1.0;
    }

    let bt: f64 = if x == 0.0 || x == 1.0 {
        0.0
    } else {
        (lgamma(a) + lgamma(b) - lgamma(a + b) + a * x.ln() + b * (1.0 - x).ln()).exp()
    };

    if x < (a + 1.0) / (a + b + 2.0) {
        bt * beta_cf(a, b, x) / a
    } else {
        1.0 - bt * beta_cf(b, a, 1.0 - x) / b
    }
}

fn student_t_cdf(t: f64, nu: f64) -> f64 {
    let x = nu / (nu + t * t);
    0.5 + 0.5 * t.signum() * (1.0 - regularized_incomplete_beta(nu / 2.0, 0.5, x))
}

fn student_t_pdf(t: f64, nu: f64) -> f64 {
    let coef = gamma_func((nu + 1.0) / 2.0) / (gamma_func(nu / 2.0) * (nu * PI).sqrt());
    coef * (1.0 + t * t / nu).powf(-(nu + 1.0) / 2.0)
}

/// Nataf transformation for correlated non-Gaussian variables
/// Industry standard: OpenTURNS, FERUM, Strurel
///
/// Transforms correlated non-Gaussian X to independent standard normal U:
/// 1. X → Y (standard normal marginals using inverse CDF)
/// 2. Y → U (decorrelate using modified correlation matrix)
#[derive(Debug, Clone)]
pub struct NatafTransformation {
    pub n_vars: usize,
    /// Marginal distributions
    pub marginals: Vec<MarginalDistribution>,
    /// Original correlation matrix
    pub correlation: Vec<Vec<f64>>,
    /// Modified correlation in standard normal space
    pub modified_correlation: Vec<Vec<f64>>,
    /// Lower Cholesky factor L where LL^T = R_modified
    pub cholesky_l: Vec<Vec<f64>>,
    /// Inverse Cholesky for reverse transform
    pub cholesky_l_inv: Vec<Vec<f64>>,
}

#[derive(Debug, Clone)]
pub enum MarginalDistribution {
    Normal { mean: f64, std: f64 },
    Lognormal { lambda: f64, zeta: f64 },  // underlying normal params
    Uniform { a: f64, b: f64 },
    Gumbel { mu: f64, beta: f64 },
    Weibull { k: f64, lambda: f64 },
    Gamma { shape: f64, scale: f64 },
    Beta { alpha: f64, beta: f64, a: f64, b: f64 },
    Frechet { alpha: f64, beta: f64, gamma: f64 },
    Exponential { lambda: f64 },
    /// Student-t distribution (industry standard for heavy tails)
    StudentT { nu: f64, mu: f64, sigma: f64 },
    /// Generalized Extreme Value (GEV) - essential for structural loads (EN 1991)
    GEV { mu: f64, sigma: f64, xi: f64 },
    /// Pareto distribution (Type II) - for extreme value modeling
    Pareto { alpha: f64, xm: f64 },
    /// Logistic distribution - for reliability analysis
    Logistic { mu: f64, s: f64 },
    /// Truncated Normal - essential for bounded physical quantities
    TruncatedNormal { mean: f64, std: f64, a: f64, b: f64 },
    /// Inverse Gaussian (Wald) - for time-to-failure modeling
    InverseGaussian { mu: f64, lambda: f64 },
}

impl MarginalDistribution {
    /// CDF: P(X ≤ x)
    pub fn cdf(&self, x: f64) -> f64 {
        match self {
            MarginalDistribution::Normal { mean, std } => {
                standard_normal_cdf((x - mean) / std)
            }
            MarginalDistribution::Lognormal { lambda, zeta } => {
                if x <= 0.0 {
                    0.0
                } else {
                    standard_normal_cdf((x.ln() - lambda) / zeta)
                }
            }
            MarginalDistribution::Uniform { a, b } => {
                if x <= *a { 0.0 }
                else if x >= *b { 1.0 }
                else { (x - a) / (b - a) }
            }
            MarginalDistribution::Gumbel { mu, beta } => {
                let z = (x - mu) / beta;
                (-(-z).exp()).exp()
            }
            MarginalDistribution::Weibull { k, lambda } => {
                if x <= 0.0 { 0.0 }
                else { 1.0 - (-(x / lambda).powf(*k)).exp() }
            }
            MarginalDistribution::Gamma { shape, scale } => {
                if x <= 0.0 { 0.0 }
                else { lower_incomplete_gamma(*shape, x / scale) / gamma_func(*shape) }
            }
            MarginalDistribution::Beta { alpha, beta, a, b } => {
                let z = (x - a) / (b - a);
                if z <= 0.0 { 0.0 }
                else if z >= 1.0 { 1.0 }
                else { regularized_incomplete_beta(*alpha, *beta, z) }
            }
            MarginalDistribution::Frechet { alpha, beta, gamma } => {
                if x <= *gamma { 0.0 }
                else { (-((x - gamma) / beta).powf(-*alpha)).exp() }
            }
            MarginalDistribution::Exponential { lambda } => {
                if x <= 0.0 { 0.0 }
                else { 1.0 - (-lambda * x).exp() }
            }
            MarginalDistribution::StudentT { nu, mu, sigma } => {
                let t = (x - mu) / sigma;
                student_t_cdf(t, *nu)
            }
            MarginalDistribution::GEV { mu, sigma, xi } => {
                // Generalized Extreme Value CDF: exp(-(1 + ξ(x-μ)/σ)^(-1/ξ))
                let z = (x - mu) / sigma;
                if xi.abs() < 1e-10 {
                    // Gumbel limit (ξ → 0)
                    (-(-z).exp()).exp()
                } else {
                    let t = 1.0 + xi * z;
                    if t <= 0.0 {
                        if *xi > 0.0 { 0.0 } else { 1.0 }
                    } else {
                        (-t.powf(-1.0 / xi)).exp()
                    }
                }
            }
            MarginalDistribution::Pareto { alpha, xm } => {
                if x < *xm { 0.0 }
                else { 1.0 - (xm / x).powf(*alpha) }
            }
            MarginalDistribution::Logistic { mu, s } => {
                1.0 / (1.0 + (-((x - mu) / s)).exp())
            }
            MarginalDistribution::TruncatedNormal { mean, std, a, b } => {
                let phi_a = standard_normal_cdf((a - mean) / std);
                let phi_b = standard_normal_cdf((b - mean) / std);
                let phi_x = standard_normal_cdf((x - mean) / std);
                if x <= *a { 0.0 }
                else if x >= *b { 1.0 }
                else { (phi_x - phi_a) / (phi_b - phi_a) }
            }
            MarginalDistribution::InverseGaussian { mu, lambda } => {
                if x <= 0.0 { 0.0 }
                else {
                    let sqrt_lx = (lambda / x).sqrt();
                    let z1 = sqrt_lx * (x / mu - 1.0);
                    let z2 = -sqrt_lx * (x / mu + 1.0);
                    standard_normal_cdf(z1) + (2.0 * lambda / mu).exp() * standard_normal_cdf(z2)
                }
            }
        }
    }

    /// Inverse CDF (quantile function)
    pub fn inverse_cdf(&self, p: f64) -> f64 {
        let p = p.clamp(1e-12, 1.0 - 1e-12);
        
        match self {
            MarginalDistribution::Normal { mean, std } => {
                mean + std * standard_normal_inverse_cdf(p)
            }
            MarginalDistribution::Lognormal { lambda, zeta } => {
                (lambda + zeta * standard_normal_inverse_cdf(p)).exp()
            }
            MarginalDistribution::Uniform { a, b } => {
                a + p * (b - a)
            }
            MarginalDistribution::Gumbel { mu, beta } => {
                mu - beta * (-p.ln()).ln()
            }
            MarginalDistribution::Weibull { k, lambda } => {
                lambda * (-( 1.0 - p).ln()).powf(1.0 / k)
            }
            MarginalDistribution::Gamma { shape, scale } => {
                // Newton iteration
                let mut x = *shape * *scale;  // initial guess at mean
                for _ in 0..50 {
                    let cdf = self.cdf(x);
                    let pdf = self.pdf(x);
                    if pdf < 1e-14 { break; }
                    let dx = (cdf - p) / pdf;
                    x -= dx;
                    x = x.max(1e-10);
                    if dx.abs() < 1e-10 { break; }
                }
                x
            }
            MarginalDistribution::Beta { alpha, beta, a, b } => {
                // Bisection
                let mut lo = 0.0;
                let mut hi = 1.0;
                for _ in 0..50 {
                    let mid = (lo + hi) / 2.0;
                    let cdf = regularized_incomplete_beta(*alpha, *beta, mid);
                    if cdf < p { lo = mid; }
                    else { hi = mid; }
                }
                a + (lo + hi) / 2.0 * (b - a)
            }
            MarginalDistribution::Frechet { alpha, beta, gamma } => {
                gamma + beta * (-p.ln()).powf(-1.0 / alpha)
            }
            MarginalDistribution::Exponential { lambda } => {
                -(1.0 - p).ln() / lambda
            }
            MarginalDistribution::StudentT { nu, mu, sigma } => {
                // Newton iteration for Student-t quantile
                let mut t = standard_normal_inverse_cdf(p); // initial guess
                for _ in 0..20 {
                    let cdf = student_t_cdf(t, *nu);
                    let pdf = student_t_pdf(t, *nu);
                    if pdf < 1e-14 { break; }
                    let dt = (cdf - p) / pdf;
                    t -= dt;
                    if dt.abs() < 1e-10 { break; }
                }
                mu + sigma * t
            }
            MarginalDistribution::GEV { mu, sigma, xi } => {
                if xi.abs() < 1e-10 {
                    mu - sigma * (-p.ln()).ln()
                } else {
                    mu + sigma * ((-p.ln()).powf(-*xi) - 1.0) / xi
                }
            }
            MarginalDistribution::Pareto { alpha, xm } => {
                xm / (1.0 - p).powf(1.0 / alpha)
            }
            MarginalDistribution::Logistic { mu, s } => {
                mu + s * (p / (1.0 - p)).ln()
            }
            MarginalDistribution::TruncatedNormal { mean, std, a, b } => {
                let phi_a = standard_normal_cdf((a - mean) / std);
                let phi_b = standard_normal_cdf((b - mean) / std);
                let phi_x = phi_a + p * (phi_b - phi_a);
                mean + std * standard_normal_inverse_cdf(phi_x)
            }
            MarginalDistribution::InverseGaussian { mu, lambda: _ } => {
                // Newton iteration
                let mut x = *mu;  // start at mean
                for _ in 0..30 {
                    let cdf = self.cdf(x);
                    let pdf = self.pdf(x);
                    if pdf < 1e-14 { break; }
                    let dx = (cdf - p) / pdf;
                    x -= dx;
                    x = x.max(1e-10);
                    if dx.abs() < 1e-10 { break; }
                }
                x
            }
        }
    }

    /// PDF
    pub fn pdf(&self, x: f64) -> f64 {
        match self {
            MarginalDistribution::Normal { mean, std } => {
                let z = (x - mean) / std;
                (-0.5 * z * z).exp() / (std * (2.0 * PI).sqrt())
            }
            MarginalDistribution::Lognormal { lambda, zeta } => {
                if x <= 0.0 { 0.0 }
                else {
                    let z = (x.ln() - lambda) / zeta;
                    (-0.5 * z * z).exp() / (x * zeta * (2.0 * PI).sqrt())
                }
            }
            MarginalDistribution::Uniform { a, b } => {
                if x >= *a && x <= *b { 1.0 / (b - a) }
                else { 0.0 }
            }
            MarginalDistribution::Gumbel { mu, beta } => {
                let z = (x - mu) / beta;
                let ez = (-z).exp();
                ez * (-ez).exp() / beta
            }
            MarginalDistribution::Weibull { k, lambda } => {
                if x <= 0.0 { 0.0 }
                else {
                    (k / lambda) * (x / lambda).powf(k - 1.0) * (-(x / lambda).powf(*k)).exp()
                }
            }
            MarginalDistribution::Gamma { shape, scale } => {
                if x <= 0.0 { 0.0 }
                else {
                    x.powf(shape - 1.0) * (-x / scale).exp() / (scale.powf(*shape) * gamma_func(*shape))
                }
            }
            MarginalDistribution::Beta { alpha, beta, a, b } => {
                let z = (x - a) / (b - a);
                if z <= 0.0 || z >= 1.0 { 0.0 }
                else {
                    z.powf(alpha - 1.0) * (1.0 - z).powf(beta - 1.0) 
                        / (beta_function(*alpha, *beta) * (b - a))
                }
            }
            MarginalDistribution::Frechet { alpha, beta, gamma } => {
                if x <= *gamma { 0.0 }
                else {
                    let z = (x - gamma) / beta;
                    (alpha / beta) * z.powf(-1.0 - alpha) * (-z.powf(-*alpha)).exp()
                }
            }
            MarginalDistribution::Exponential { lambda } => {
                if x < 0.0 { 0.0 }
                else { lambda * (-lambda * x).exp() }
            }
            MarginalDistribution::StudentT { nu, mu, sigma } => {
                let t = (x - mu) / sigma;
                student_t_pdf(t, *nu) / sigma
            }
            MarginalDistribution::GEV { mu, sigma, xi } => {
                let z = (x - mu) / sigma;
                if xi.abs() < 1e-10 {
                    // Gumbel
                    let ez = (-z).exp();
                    ez * (-ez).exp() / sigma
                } else {
                    let t = 1.0 + xi * z;
                    if t <= 0.0 { 0.0 }
                    else {
                        t.powf(-1.0 / xi - 1.0) * (-t.powf(-1.0 / xi)).exp() / sigma
                    }
                }
            }
            MarginalDistribution::Pareto { alpha, xm } => {
                if x < *xm { 0.0 }
                else { alpha * xm.powf(*alpha) / x.powf(alpha + 1.0) }
            }
            MarginalDistribution::Logistic { mu, s } => {
                let z = (x - mu) / s;
                let ez = (-z).exp();
                ez / (s * (1.0 + ez).powi(2))
            }
            MarginalDistribution::TruncatedNormal { mean, std, a, b } => {
                if x < *a || x > *b { 0.0 }
                else {
                    let phi_a = standard_normal_cdf((a - mean) / std);
                    let phi_b = standard_normal_cdf((b - mean) / std);
                    let z = (x - mean) / std;
                    standard_normal_pdf(z) / (std * (phi_b - phi_a))
                }
            }
            MarginalDistribution::InverseGaussian { mu, lambda } => {
                if x <= 0.0 { 0.0 }
                else {
                    (lambda / (2.0 * PI * x.powi(3))).sqrt()
                        * (-lambda * (x - mu).powi(2) / (2.0 * mu * mu * x)).exp()
                }
            }
        }
    }

    /// Mean
    pub fn mean(&self) -> f64 {
        match self {
            MarginalDistribution::Normal { mean, .. } => *mean,
            MarginalDistribution::Lognormal { lambda, zeta } => (*lambda + 0.5 * zeta * zeta).exp(),
            MarginalDistribution::Uniform { a, b } => (a + b) / 2.0,
            MarginalDistribution::Gumbel { mu, beta } => mu + 0.5772156649 * beta,
            MarginalDistribution::Weibull { k, lambda } => lambda * gamma_func(1.0 + 1.0 / k),
            MarginalDistribution::Gamma { shape, scale } => shape * scale,
            MarginalDistribution::Beta { alpha, beta, a, b } => a + (b - a) * alpha / (alpha + beta),
            MarginalDistribution::Frechet { alpha, beta, gamma: loc } => {
                if *alpha > 1.0 { loc + beta * gamma_func(1.0 - 1.0 / alpha) }
                else { f64::INFINITY }
            }
            MarginalDistribution::Exponential { lambda } => 1.0 / lambda,
            MarginalDistribution::StudentT { mu, nu, .. } => {
                if *nu > 1.0 { *mu } else { f64::NAN }
            }
            MarginalDistribution::GEV { mu, sigma, xi } => {
                if *xi >= 1.0 { f64::INFINITY }
                else if xi.abs() < 1e-10 { mu + sigma * 0.5772156649 }
                else { mu + sigma * (gamma_func(1.0 - xi) - 1.0) / xi }
            }
            MarginalDistribution::Pareto { alpha, xm } => {
                if *alpha > 1.0 { alpha * xm / (alpha - 1.0) }
                else { f64::INFINITY }
            }
            MarginalDistribution::Logistic { mu, .. } => *mu,
            MarginalDistribution::TruncatedNormal { mean, std, a, b } => {
                let alpha = (a - mean) / std;
                let beta = (b - mean) / std;
                let phi_alpha = standard_normal_cdf(alpha);
                let phi_beta = standard_normal_cdf(beta);
                let pdf_alpha = standard_normal_pdf(alpha);
                let pdf_beta = standard_normal_pdf(beta);
                mean + std * (pdf_alpha - pdf_beta) / (phi_beta - phi_alpha)
            }
            MarginalDistribution::InverseGaussian { mu, .. } => *mu,
        }
    }

    /// Standard deviation
    pub fn std(&self) -> f64 {
        match self {
            MarginalDistribution::Normal { std, .. } => *std,
            MarginalDistribution::Lognormal { lambda, zeta } => {
                let m = (lambda + 0.5 * zeta * zeta).exp();
                m * (zeta * zeta).exp_m1().sqrt()
            }
            MarginalDistribution::Uniform { a, b } => (b - a) / (12.0_f64).sqrt(),
            MarginalDistribution::Gumbel { beta, .. } => PI * beta / (6.0_f64).sqrt(),
            MarginalDistribution::Weibull { k, lambda } => {
                let g1 = gamma_func(1.0 + 1.0 / k);
                let g2 = gamma_func(1.0 + 2.0 / k);
                lambda * (g2 - g1 * g1).sqrt()
            }
            MarginalDistribution::Gamma { shape, scale } => (shape).sqrt() * scale,
            MarginalDistribution::Beta { alpha, beta, a, b } => {
                (b - a) * (alpha * beta / ((alpha + beta).powi(2) * (alpha + beta + 1.0))).sqrt()
            }
            MarginalDistribution::Frechet { alpha, beta, .. } => {
                if *alpha > 2.0 {
                    let g1 = gamma_func(1.0 - 1.0 / alpha);
                    let g2 = gamma_func(1.0 - 2.0 / alpha);
                    beta * (g2 - g1 * g1).sqrt()
                } else {
                    f64::INFINITY
                }
            }
            MarginalDistribution::Exponential { lambda } => 1.0 / lambda,
            MarginalDistribution::StudentT { nu, sigma, .. } => {
                if *nu > 2.0 { sigma * (nu / (nu - 2.0)).sqrt() }
                else { f64::INFINITY }
            }
            MarginalDistribution::GEV { sigma, xi, .. } => {
                if *xi >= 0.5 { f64::INFINITY }
                else if xi.abs() < 1e-10 { sigma * PI / 6.0_f64.sqrt() }
                else {
                    let g1 = gamma_func(1.0 - xi);
                    let g2 = gamma_func(1.0 - 2.0 * xi);
                    sigma * (g2 - g1 * g1).sqrt() / xi.abs()
                }
            }
            MarginalDistribution::Pareto { alpha, xm } => {
                if *alpha > 2.0 {
                    xm * (alpha / ((alpha - 1.0).powi(2) * (alpha - 2.0))).sqrt()
                } else { f64::INFINITY }
            }
            MarginalDistribution::Logistic { s, .. } => s * PI / 3.0_f64.sqrt(),
            MarginalDistribution::TruncatedNormal { mean, std, a, b } => {
                let alpha = (a - mean) / std;
                let beta = (b - mean) / std;
                let phi_alpha = standard_normal_cdf(alpha);
                let phi_beta = standard_normal_cdf(beta);
                let pdf_alpha = standard_normal_pdf(alpha);
                let pdf_beta = standard_normal_pdf(beta);
                let z = phi_beta - phi_alpha;
                let mean_adj = (pdf_alpha - pdf_beta) / z;
                let var = 1.0 + (alpha * pdf_alpha - beta * pdf_beta) / z - mean_adj.powi(2);
                std * var.max(0.0).sqrt()
            }
            MarginalDistribution::InverseGaussian { mu, lambda } => {
                mu * (mu / lambda).sqrt()
            }
        }
    }
}
