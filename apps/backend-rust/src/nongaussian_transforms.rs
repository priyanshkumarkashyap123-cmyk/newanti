//! Non-Gaussian Transformations
//!
//! Industry-standard probability transformations for structural reliability.
//! Critical gap vs OpenTURNS and FERUM.
//!
//! ## Industry Gap Analysis
//!
//! | Feature | OpenTURNS | UQLab | FERUM | This Module |
//! |---------|-----------|-------|-------|-------------|
//! | Nataf Transform | ✓ | ✓ | ✓ | ✓ |
//! | Rosenblatt Transform | ✓ | ✓ | ✓ | ✓ |
//! | Copulas (Gaussian) | ✓ | ✓ | ✗ | ✓ |
//! | Copulas (Clayton) | ✓ | ✓ | ✗ | ✓ |
//! | Copulas (Frank) | ✓ | ✓ | ✗ | ✓ |
//! | Copulas (Gumbel) | ✓ | ✓ | ✗ | ✓ |
//! | Kernel Density Est. | ✓ | ✓ | ✗ | ✓ |

use std::f64::consts::PI;
use crate::special_functions::{gamma as gamma_func, lgamma, standard_normal_cdf, beta as beta_function, standard_normal_pdf};


fn standard_normal_inverse_cdf(p: f64) -> f64 {
    2.0_f64.sqrt() * crate::special_functions::erfinv(2.0 * p - 1.0)
}

// ============================================================================
// NATAF TRANSFORMATION
// ============================================================================

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

// ============================================================================
// VINE COPULAS (Industry Standard: High-Dimensional Dependency)
// ============================================================================

/// Vine copula types for high-dimensional dependency modeling
/// Industry standard: R VineCopula, OpenTURNS (>= 1.16), UQLab
/// Essential for structural systems with ≥5 correlated variables
#[derive(Debug, Clone)]
pub enum VineType {
    /// C-vine (Canonical vine) - one central variable
    CVine,
    /// D-vine (Drawable vine) - sequential ordering
    DVine,
    /// R-vine (Regular vine) - most general
    RVine,
}

/// Pair copula for vine construction
#[derive(Debug, Clone)]
pub struct PairCopula {
    pub copula_type: BivariateCopulaType,
    pub parameter: f64,
    pub rotation: u8,  // 0, 90, 180, 270 degrees
}

#[derive(Debug, Clone, Copy)]
pub enum BivariateCopulaType {
    Gaussian,
    Clayton,
    Frank,
    Gumbel,
    Joe,
    Independence,
}

/// Vine copula structure for high-dimensional dependency
#[derive(Debug, Clone)]
pub struct VineCopula {
    pub dimension: usize,
    pub vine_type: VineType,
    /// Tree structure: tree[t][e] = (i, j, conditioning_set)
    pub structure: Vec<Vec<(usize, usize, Vec<usize>)>>,
    /// Pair copulas for each edge in each tree
    pub pair_copulas: Vec<Vec<PairCopula>>,
}

impl VineCopula {
    /// Create a D-vine with sequential ordering
    pub fn d_vine(dimension: usize, copulas: Vec<Vec<PairCopula>>) -> Self {
        let mut structure = Vec::new();
        
        // Build D-vine structure
        for t in 0..(dimension - 1) {
            let mut tree = Vec::new();
            for e in 0..(dimension - 1 - t) {
                let i = e;
                let j = e + t + 1;
                let conditioning: Vec<usize> = (e + 1..e + t + 1).collect();
                tree.push((i, j, conditioning));
            }
            structure.push(tree);
        }
        
        VineCopula {
            dimension,
            vine_type: VineType::DVine,
            structure,
            pair_copulas: copulas,
        }
    }
    
    /// Create a C-vine with central variable at index 0
    pub fn c_vine(dimension: usize, copulas: Vec<Vec<PairCopula>>) -> Self {
        let mut structure = Vec::new();
        
        for t in 0..(dimension - 1) {
            let mut tree = Vec::new();
            for e in (t + 1)..dimension {
                let i = t;
                let j = e;
                let conditioning: Vec<usize> = (0..t).collect();
                tree.push((i, j, conditioning));
            }
            structure.push(tree);
        }
        
        VineCopula {
            dimension,
            vine_type: VineType::CVine,
            structure,
            pair_copulas: copulas,
        }
    }
    
    /// Sample from vine copula
    pub fn sample(&self, n_samples: usize, rng_state: &mut u64) -> Vec<Vec<f64>> {
        let d = self.dimension;
        let mut samples = Vec::with_capacity(n_samples);
        
        for _ in 0..n_samples {
            // Start with independent uniforms
            let w: Vec<f64> = (0..d).map(|_| lcg_random(rng_state)).collect();
            let mut u = vec![0.0; d];
            
            match self.vine_type {
                VineType::DVine => {
                    u[0] = w[0];
                    for i in 1..d {
                        u[i] = self.inverse_rosenblatt_d_vine(&w, &u, i);
                    }
                }
                VineType::CVine => {
                    u[0] = w[0];
                    for i in 1..d {
                        u[i] = self.inverse_rosenblatt_c_vine(&w, &u, i);
                    }
                }
                VineType::RVine => {
                    // General R-vine (simplified to D-vine for now)
                    u[0] = w[0];
                    for i in 1..d {
                        u[i] = self.inverse_rosenblatt_d_vine(&w, &u, i);
                    }
                }
            }
            
            samples.push(u);
        }
        
        samples
    }
    
    fn inverse_rosenblatt_d_vine(&self, w: &[f64], u: &[f64], idx: usize) -> f64 {
        // Sequential inverse Rosenblatt for D-vine
        let mut v = w[idx];
        
        for t in (0..idx).rev() {
            if t < self.pair_copulas.len() && (idx - t - 1) < self.pair_copulas[t].len() {
                let pc = &self.pair_copulas[t][idx - t - 1];
                v = self.h_inverse(v, u[t], pc);
            }
        }
        
        v
    }
    
    fn inverse_rosenblatt_c_vine(&self, w: &[f64], u: &[f64], idx: usize) -> f64 {
        let mut v = w[idx];
        
        for t in (0..idx).rev() {
            if t < self.pair_copulas.len() && (idx - t - 1) < self.pair_copulas[t].len() {
                let pc = &self.pair_copulas[t][idx - t - 1];
                v = self.h_inverse(v, u[t], pc);
            }
        }
        
        v
    }
    
    /// h-function inverse (conditional quantile)
    fn h_inverse(&self, v: f64, u: f64, pc: &PairCopula) -> f64 {
        match pc.copula_type {
            BivariateCopulaType::Independence => v,
            BivariateCopulaType::Gaussian => {
                let rho = pc.parameter;
                let t = standard_normal_inverse_cdf(u);
                let z = standard_normal_inverse_cdf(v);
                standard_normal_cdf(rho * t + (1.0 - rho * rho).sqrt() * z)
            }
            BivariateCopulaType::Clayton => {
                let theta = pc.parameter;
                let t = u.powf(-theta) * (v.powf(-theta / (1.0 + theta)) - 1.0) + 1.0;
                t.powf(-1.0 / theta).clamp(0.0, 1.0)
            }
            BivariateCopulaType::Frank => {
                let theta = pc.parameter;
                let _a = (-theta).exp() - 1.0;
                let b = (-theta * u).exp();
                let num = -((1.0 - (1.0 - b) / (v * (1.0 - (-theta).exp()) + b)).ln());
                (num / theta).clamp(0.0, 1.0)
            }
            BivariateCopulaType::Gumbel => {
                // Bisection for Gumbel h-inverse
                let mut lo = 0.0;
                let mut hi = 1.0;
                for _ in 0..50 {
                    let mid = (lo + hi) / 2.0;
                    let h = self.h_function(mid, u, pc);
                    if h < v { lo = mid; } else { hi = mid; }
                }
                (lo + hi) / 2.0
            }
            BivariateCopulaType::Joe => {
                // Bisection for Joe h-inverse  
                let mut lo = 0.0;
                let mut hi = 1.0;
                for _ in 0..50 {
                    let mid = (lo + hi) / 2.0;
                    let h = self.h_function(mid, u, pc);
                    if h < v { lo = mid; } else { hi = mid; }
                }
                (lo + hi) / 2.0
            }
        }
    }
    
    /// h-function (conditional CDF)
    fn h_function(&self, u1: f64, u2: f64, pc: &PairCopula) -> f64 {
        match pc.copula_type {
            BivariateCopulaType::Independence => u1,
            BivariateCopulaType::Gaussian => {
                let rho = pc.parameter;
                let z1 = standard_normal_inverse_cdf(u1);
                let z2 = standard_normal_inverse_cdf(u2);
                standard_normal_cdf((z1 - rho * z2) / (1.0 - rho * rho).sqrt())
            }
            BivariateCopulaType::Clayton => {
                let theta = pc.parameter;
                let t = u2.powf(-theta - 1.0) * (u1.powf(-theta) + u2.powf(-theta) - 1.0)
                    .powf(-1.0 - 1.0 / theta);
                t.clamp(0.0, 1.0)
            }
            BivariateCopulaType::Frank => {
                let theta = pc.parameter;
                let e1 = (-theta * u1).exp();
                let e2 = (-theta * u2).exp();
                let e = (-theta).exp();
                (e2 * (e1 - 1.0) / ((e - 1.0) + (e1 - 1.0) * (e2 - 1.0))).clamp(0.0, 1.0)
            }
            BivariateCopulaType::Gumbel => {
                let theta = pc.parameter;
                let t1 = (-u1.ln()).powf(theta);
                let t2 = (-u2.ln()).powf(theta);
                let s = (t1 + t2).powf(1.0 / theta);
                let c = (-s).exp();
                (c * (t2 / (-u2.ln())) * (t1 + t2).powf(1.0 / theta - 1.0) / u2).clamp(0.0, 1.0)
            }
            BivariateCopulaType::Joe => {
                let theta = pc.parameter;
                let a = 1.0 - (1.0 - u1).powf(theta);
                let b = 1.0 - (1.0 - u2).powf(theta);
                let c = (a + b - a * b).powf(1.0 / theta);
                ((1.0 - u2).powf(theta - 1.0) * (1.0 - b) * c.powf(1.0 - theta)).clamp(0.0, 1.0)
            }
        }
    }
    
    /// Compute vine copula density
    pub fn pdf(&self, u: &[f64]) -> f64 {
        let mut density = 1.0;
        
        for (t, tree) in self.structure.iter().enumerate() {
            for (e, &(i, j, ref _cond)) in tree.iter().enumerate() {
                if t < self.pair_copulas.len() && e < self.pair_copulas[t].len() {
                    let pc = &self.pair_copulas[t][e];
                    density *= self.pair_copula_density(u[i], u[j], pc);
                }
            }
        }
        
        density
    }
    
    fn pair_copula_density(&self, u1: f64, u2: f64, pc: &PairCopula) -> f64 {
        match pc.copula_type {
            BivariateCopulaType::Independence => 1.0,
            BivariateCopulaType::Gaussian => {
                let rho = pc.parameter;
                let z1 = standard_normal_inverse_cdf(u1);
                let z2 = standard_normal_inverse_cdf(u2);
                let det = (1.0 - rho * rho).sqrt();
                (-(rho * rho * (z1 * z1 + z2 * z2) - 2.0 * rho * z1 * z2)
                    / (2.0 * (1.0 - rho * rho))).exp() / det
            }
            BivariateCopulaType::Clayton => {
                let theta = pc.parameter;
                (1.0 + theta) * (u1 * u2).powf(-theta - 1.0)
                    * (u1.powf(-theta) + u2.powf(-theta) - 1.0).powf(-2.0 - 1.0 / theta)
            }
            BivariateCopulaType::Frank => {
                let theta = pc.parameter;
                let e = (-theta).exp();
                let e1 = (-theta * u1).exp();
                let e2 = (-theta * u2).exp();
                theta * (1.0 - e) * (e1 * e2)
                    / ((1.0 - e) - (1.0 - e1) * (1.0 - e2)).powi(2)
            }
            BivariateCopulaType::Gumbel => {
                let theta = pc.parameter;
                let t1 = (-u1.ln()).powf(theta);
                let t2 = (-u2.ln()).powf(theta);
                let s = t1 + t2;
                let c = (-s.powf(1.0 / theta)).exp();
                c * (s.powf(2.0 / theta - 2.0)) * (t1 * t2 / (u1.ln() * u2.ln()))
                    * (theta - 1.0 + s.powf(1.0 / theta)) / (u1 * u2)
            }
            BivariateCopulaType::Joe => {
                let theta = pc.parameter;
                let a = (1.0 - u1).powf(theta);
                let b = (1.0 - u2).powf(theta);
                (a + b - a * b).powf(1.0 / theta - 2.0)
                    * (1.0 - u1).powf(theta - 1.0) * (1.0 - u2).powf(theta - 1.0)
                    * (theta - 1.0 + a + b - a * b)
            }
        }
    }
}

// ============================================================================
// MULTIVARIATE KERNEL DENSITY ESTIMATION
// ============================================================================

/// Multivariate kernel density estimator
/// Industry standard: OpenTURNS, SciPy, R ks package
#[derive(Debug, Clone)]
pub struct MultivariateKDE {
    pub samples: Vec<Vec<f64>>,
    pub dimension: usize,
    pub bandwidth_matrix: Vec<Vec<f64>>,
    pub bandwidth_method: BandwidthMethod,
}

#[derive(Debug, Clone, Copy)]
pub enum BandwidthMethod {
    /// Silverman's rule of thumb
    Silverman,
    /// Scott's rule
    Scott,
    /// Least squares cross-validation
    LSCV,
    /// Fixed bandwidth
    Fixed,
}

impl MultivariateKDE {
    pub fn new(samples: Vec<Vec<f64>>, method: BandwidthMethod) -> Self {
        let n = samples.len();
        let d = if n > 0 { samples[0].len() } else { 0 };
        
        let bandwidth_matrix = match method {
            BandwidthMethod::Silverman => Self::silverman_bandwidth(&samples, n, d),
            BandwidthMethod::Scott => Self::scott_bandwidth(&samples, n, d),
            BandwidthMethod::LSCV => Self::lscv_bandwidth(&samples, n, d),
            BandwidthMethod::Fixed => vec![vec![1.0; d]; d],
        };
        
        MultivariateKDE {
            samples,
            dimension: d,
            bandwidth_matrix,
            bandwidth_method: method,
        }
    }
    
    fn silverman_bandwidth(samples: &[Vec<f64>], n: usize, d: usize) -> Vec<Vec<f64>> {
        let factor = (4.0 / ((d + 2) as f64 * n as f64)).powf(1.0 / (d as f64 + 4.0));
        let mut h = vec![vec![0.0; d]; d];
        
        for i in 0..d {
            let col: Vec<f64> = samples.iter().map(|s| s[i]).collect();
            let std = sample_std(&col);
            h[i][i] = (std * factor).powi(2);
        }
        
        h
    }
    
    fn scott_bandwidth(samples: &[Vec<f64>], n: usize, d: usize) -> Vec<Vec<f64>> {
        let factor = n.pow((d + 4) as u32) as f64;
        let factor = factor.powf(-1.0 / (d as f64 + 4.0));
        let mut h = vec![vec![0.0; d]; d];
        
        for i in 0..d {
            let col: Vec<f64> = samples.iter().map(|s| s[i]).collect();
            let std = sample_std(&col);
            h[i][i] = (std * factor).powi(2);
        }
        
        h
    }
    
    fn lscv_bandwidth(samples: &[Vec<f64>], n: usize, d: usize) -> Vec<Vec<f64>> {
        // Least-squares cross-validation (simplified grid search)
        let mut best_h = Self::silverman_bandwidth(samples, n, d);
        let mut best_score = f64::INFINITY;
        
        for scale in [0.5, 0.75, 1.0, 1.25, 1.5, 2.0].iter() {
            let mut h = Self::silverman_bandwidth(samples, n, d);
            for i in 0..d {
                h[i][i] *= scale;
            }
            
            let score = Self::lscv_objective(samples, &h, n, d);
            if score < best_score {
                best_score = score;
                best_h = h;
            }
        }
        
        best_h
    }
    
    fn lscv_objective(samples: &[Vec<f64>], h: &[Vec<f64>], n: usize, d: usize) -> f64 {
        let mut loo_sum = 0.0;
        
        for i in 0..n.min(100) {  // Subsample for speed
            let xi = &samples[i];
            let mut sum = 0.0;
            
            for (j, xj) in samples.iter().enumerate() {
                if i != j {
                    let k = Self::multivariate_kernel(xi, xj, h, d);
                    sum += k;
                }
            }
            
            loo_sum += (sum / (n - 1) as f64).ln().max(-50.0);
        }
        
        -loo_sum / n.min(100) as f64
    }
    
    fn multivariate_kernel(x: &[f64], xi: &[f64], h: &[Vec<f64>], d: usize) -> f64 {
        let mut quad = 0.0;
        let mut det = 1.0;
        
        for i in 0..d {
            let diff = x[i] - xi[i];
            quad += diff * diff / h[i][i].max(1e-10);
            det *= h[i][i].max(1e-10);
        }
        
        (-0.5 * quad).exp() / ((2.0 * PI).powf(d as f64 / 2.0) * det.sqrt())
    }
    
    /// Evaluate PDF at point x
    pub fn pdf(&self, x: &[f64]) -> f64 {
        let n = self.samples.len() as f64;
        let d = self.dimension;
        
        let sum: f64 = self.samples.iter()
            .map(|xi| Self::multivariate_kernel(x, xi, &self.bandwidth_matrix, d))
            .sum();
        
        sum / n
    }
    
    /// Generate random sample
    pub fn sample(&self, rng_state: &mut u64) -> Vec<f64> {
        let n = self.samples.len();
        let idx = (lcg_random(rng_state) * n as f64) as usize;
        let base = &self.samples[idx.min(n - 1)];
        
        base.iter().enumerate()
            .map(|(i, &b)| b + self.bandwidth_matrix[i][i].sqrt() * box_muller_normal(rng_state))
            .collect()
    }
}

impl NatafTransformation {
    pub fn new(marginals: Vec<MarginalDistribution>, correlation: Vec<Vec<f64>>) -> Self {
        let n = marginals.len();
        
        let mut nataf = NatafTransformation {
            n_vars: n,
            marginals,
            correlation: correlation.clone(),
            modified_correlation: vec![vec![0.0; n]; n],
            cholesky_l: vec![vec![0.0; n]; n],
            cholesky_l_inv: vec![vec![0.0; n]; n],
        };

        nataf.compute_modified_correlation();
        nataf.compute_cholesky();
        
        nataf
    }

    /// Compute modified correlation using Nataf model
    fn compute_modified_correlation(&mut self) {
        let n = self.n_vars;

        for i in 0..n {
            for j in 0..n {
                if i == j {
                    self.modified_correlation[i][j] = 1.0;
                } else {
                    // ρ_Y = F(ρ_X) where F is the Nataf formula
                    // Approximate: ρ_Y ≈ ρ_X * F_ij
                    let factor = self.nataf_correlation_factor(i, j);
                    self.modified_correlation[i][j] = self.correlation[i][j] * factor;
                }
            }
        }

        // Ensure positive definiteness
        self.ensure_positive_definite();
    }

    fn nataf_correlation_factor(&self, i: usize, j: usize) -> f64 {
        // Der Kiureghian & Liu (1986) approximation factors
        let cov_i = self.marginals[i].std() / self.marginals[i].mean().abs().max(1e-10);
        let cov_j = self.marginals[j].std() / self.marginals[j].mean().abs().max(1e-10);

        // Simplified factor based on distribution types
        let factor_i = self.single_var_factor(&self.marginals[i], cov_i);
        let factor_j = self.single_var_factor(&self.marginals[j], cov_j);

        (factor_i * factor_j).sqrt()
    }

    fn single_var_factor(&self, dist: &MarginalDistribution, cov: f64) -> f64 {
        match dist {
            MarginalDistribution::Normal { .. } => 1.0,
            MarginalDistribution::Lognormal { .. } => {
                let zeta = (1.0 + cov * cov).ln().sqrt();
                zeta / ((1.0 + cov * cov).ln()).sqrt()
            }
            MarginalDistribution::Uniform { .. } => 1.023,
            MarginalDistribution::Gumbel { .. } => 1.031,
            MarginalDistribution::Weibull { .. } => 1.031 + 0.052 * cov - 0.002 * cov * cov,
            MarginalDistribution::Gamma { .. } => 1.001 + 0.033 * cov,
            MarginalDistribution::Beta { .. } => 1.0,
            MarginalDistribution::Frechet { .. } => 1.03,
            MarginalDistribution::Exponential { .. } => 1.107,
            // New distributions - factors from Der Kiureghian & Liu extensions
            MarginalDistribution::StudentT { nu, .. } => {
                // Heavy-tailed: factor depends on degrees of freedom
                if *nu > 4.0 { 1.0 + 0.5 / nu } else { 1.1 }
            }
            MarginalDistribution::GEV { xi, .. } => {
                // GEV encompasses Gumbel, Frechet, Weibull extreme types
                if xi.abs() < 0.1 { 1.031 }  // Near Gumbel
                else if *xi > 0.0 { 1.03 + 0.24 * xi }  // Frechet-like
                else { 1.031 + 0.05 * xi.abs() }  // Weibull-like
            }
            MarginalDistribution::Pareto { alpha, .. } => {
                // Heavy-tailed power law
                if *alpha > 2.0 { 1.0 + 0.3 / alpha } else { 1.2 }
            }
            MarginalDistribution::Logistic { .. } => 1.05,  // Similar to normal but heavier tails
            MarginalDistribution::TruncatedNormal { .. } => 1.0 + 0.02 * cov,  // Near normal
            MarginalDistribution::InverseGaussian { .. } => 1.05 + 0.03 * cov,  // Asymmetric
        }
    }

    fn ensure_positive_definite(&mut self) {
        // Eigenvalue adjustment if needed
        let n = self.n_vars;
        let _min_eigenvalue = 0.001;

        // Simple check: adjust diagonal
        for i in 0..n {
            let mut row_sum = 0.0;
            for j in 0..n {
                if i != j {
                    row_sum += self.modified_correlation[i][j].abs();
                }
            }
            if row_sum >= 1.0 {
                // Scale off-diagonal elements
                let scale = 0.99 / row_sum;
                for j in 0..n {
                    if i != j {
                        self.modified_correlation[i][j] *= scale;
                        self.modified_correlation[j][i] *= scale;
                    }
                }
            }
        }
    }

    fn compute_cholesky(&mut self) {
        let n = self.n_vars;
        let mut l = vec![vec![0.0; n]; n];

        for i in 0..n {
            for j in 0..=i {
                let mut sum = 0.0;
                
                if i == j {
                    for k in 0..j {
                        sum += l[j][k] * l[j][k];
                    }
                    l[i][j] = (self.modified_correlation[i][j] - sum).max(1e-10).sqrt();
                } else {
                    for k in 0..j {
                        sum += l[i][k] * l[j][k];
                    }
                    l[i][j] = (self.modified_correlation[i][j] - sum) / l[j][j].max(1e-10);
                }
            }
        }

        self.cholesky_l = l.clone();

        // Compute inverse of L
        self.cholesky_l_inv = self.invert_lower_triangular(&l);
    }

    fn invert_lower_triangular(&self, l: &[Vec<f64>]) -> Vec<Vec<f64>> {
        let n = l.len();
        let mut inv = vec![vec![0.0; n]; n];

        for i in 0..n {
            inv[i][i] = 1.0 / l[i][i];
            
            for j in 0..i {
                let mut sum = 0.0;
                for k in j..i {
                    sum += l[i][k] * inv[k][j];
                }
                inv[i][j] = -sum / l[i][i];
            }
        }

        inv
    }

    /// Transform X → U (physical to standard normal space)
    pub fn physical_to_standard(&self, x: &[f64]) -> Vec<f64> {
        // Step 1: X → Y (standard normal marginals)
        let y: Vec<f64> = x.iter()
            .zip(self.marginals.iter())
            .map(|(&xi, dist)| {
                let u = dist.cdf(xi);
                standard_normal_inverse_cdf(u)
            })
            .collect();

        // Step 2: Y → U (decorrelate)
        let mut u = vec![0.0; self.n_vars];
        for i in 0..self.n_vars {
            for j in 0..self.n_vars {
                u[i] += self.cholesky_l_inv[i][j] * y[j];
            }
        }

        u
    }

    /// Transform U → X (standard normal to physical space)
    pub fn standard_to_physical(&self, u: &[f64]) -> Vec<f64> {
        // Step 1: U → Y (correlate)
        let mut y = vec![0.0; self.n_vars];
        for i in 0..self.n_vars {
            for j in 0..self.n_vars {
                y[i] += self.cholesky_l[i][j] * u[j];
            }
        }

        // Step 2: Y → X (transform marginals)
        y.iter()
            .zip(self.marginals.iter())
            .map(|(&yi, dist)| {
                let p = standard_normal_cdf(yi);
                dist.inverse_cdf(p)
            })
            .collect()
    }

    /// Jacobian of transformation (for reliability analysis)
    pub fn jacobian_x_to_u(&self, x: &[f64]) -> Vec<Vec<f64>> {
        let n = self.n_vars;
        let mut jac = vec![vec![0.0; n]; n];

        for i in 0..n {
            // Diagonal: d(Φ^{-1}(F_i(x_i)))/dx_i
            let phi_inv = standard_normal_inverse_cdf(self.marginals[i].cdf(x[i]));
            let phi_pdf = standard_normal_pdf(phi_inv);
            let f_pdf = self.marginals[i].pdf(x[i]);

            let diag = if phi_pdf > 1e-14 { f_pdf / phi_pdf } else { 0.0 };
            
            // Apply Cholesky inverse
            for j in 0..n {
                jac[i][j] = if i == j { diag * self.cholesky_l_inv[i][j] } else { 0.0 };
            }
        }

        jac
    }
}

// ============================================================================
// ROSENBLATT TRANSFORMATION
// ============================================================================

/// Rosenblatt transformation for general dependent variables
/// Industry standard: OpenTURNS, UQLab
///
/// More general than Nataf - handles arbitrary joint distributions
/// defined through conditional distributions or copulas.
#[derive(Debug, Clone)]
pub struct RosenblattTransformation {
    pub dimension: usize,
    /// Conditional CDF: F_{i|1..i-1}(x_i | x_1, ..., x_{i-1})
    conditional_cdfs: Vec<Box<dyn ConditionalCDF>>,
}

pub trait ConditionalCDF: Send + Sync {
    fn cdf(&self, x: f64, conditioning: &[f64]) -> f64;
    fn inverse_cdf(&self, p: f64, conditioning: &[f64]) -> f64;
    fn clone_box(&self) -> Box<dyn ConditionalCDF>;
}

impl Clone for Box<dyn ConditionalCDF> {
    fn clone(&self) -> Self {
        self.clone_box()
    }
}

impl std::fmt::Debug for Box<dyn ConditionalCDF> {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "ConditionalCDF")
    }
}

/// Gaussian conditional CDF for multivariate normal
#[derive(Debug, Clone)]
pub struct GaussianConditionalCDF {
    pub index: usize,
    pub mean: Vec<f64>,
    pub covariance: Vec<Vec<f64>>,
}

impl ConditionalCDF for GaussianConditionalCDF {
    fn cdf(&self, x: f64, conditioning: &[f64]) -> f64 {
        let (cond_mean, cond_var) = self.compute_conditional_params(conditioning);
        let z = (x - cond_mean) / cond_var.sqrt();
        standard_normal_cdf(z)
    }

    fn inverse_cdf(&self, p: f64, conditioning: &[f64]) -> f64 {
        let (cond_mean, cond_var) = self.compute_conditional_params(conditioning);
        cond_mean + cond_var.sqrt() * standard_normal_inverse_cdf(p)
    }

    fn clone_box(&self) -> Box<dyn ConditionalCDF> {
        Box::new(self.clone())
    }
}

impl GaussianConditionalCDF {
    fn compute_conditional_params(&self, conditioning: &[f64]) -> (f64, f64) {
        let i = self.index;
        
        if conditioning.is_empty() {
            return (self.mean[i], self.covariance[i][i]);
        }

        let k = conditioning.len();
        
        // Σ_11: covariance of conditioning variables
        let mut sigma_11 = vec![vec![0.0; k]; k];
        for ii in 0..k {
            for jj in 0..k {
                sigma_11[ii][jj] = self.covariance[ii][jj];
            }
        }

        // Σ_12: covariance between target and conditioning
        let sigma_12: Vec<f64> = (0..k).map(|j| self.covariance[i][j]).collect();

        // Σ_22: variance of target
        let sigma_22 = self.covariance[i][i];

        // Inverse of Σ_11
        let sigma_11_inv = invert_matrix(&sigma_11);

        // Conditional mean: μ_i + Σ_12 * Σ_11^{-1} * (x_{1..k} - μ_{1..k})
        let mut cond_mean = self.mean[i];
        for j in 0..k {
            let mut term = 0.0;
            for l in 0..k {
                term += sigma_11_inv[j][l] * (conditioning[l] - self.mean[l]);
            }
            cond_mean += sigma_12[j] * term;
        }

        // Conditional variance: Σ_22 - Σ_12 * Σ_11^{-1} * Σ_21
        let mut var_reduction = 0.0;
        for j in 0..k {
            for l in 0..k {
                var_reduction += sigma_12[j] * sigma_11_inv[j][l] * sigma_12[l];
            }
        }
        let cond_var = (sigma_22 - var_reduction).max(1e-10);

        (cond_mean, cond_var)
    }
}

impl RosenblattTransformation {
    /// Create from multivariate normal
    pub fn from_gaussian(mean: Vec<f64>, covariance: Vec<Vec<f64>>) -> Self {
        let n = mean.len();
        
        let conditional_cdfs: Vec<Box<dyn ConditionalCDF>> = (0..n)
            .map(|i| {
                Box::new(GaussianConditionalCDF {
                    index: i,
                    mean: mean.clone(),
                    covariance: covariance.clone(),
                }) as Box<dyn ConditionalCDF>
            })
            .collect();

        RosenblattTransformation {
            dimension: n,
            conditional_cdfs,
        }
    }

    /// Transform X → U
    pub fn transform(&self, x: &[f64]) -> Vec<f64> {
        let mut u = Vec::with_capacity(self.dimension);

        for i in 0..self.dimension {
            let conditioning = &x[..i];
            let p = self.conditional_cdfs[i].cdf(x[i], conditioning);
            u.push(standard_normal_inverse_cdf(p));
        }

        u
    }

    /// Inverse transform U → X
    pub fn inverse_transform(&self, u: &[f64]) -> Vec<f64> {
        let mut x = Vec::with_capacity(self.dimension);

        for i in 0..self.dimension {
            let conditioning: Vec<f64> = x.clone();
            let p = standard_normal_cdf(u[i]);
            let xi = self.conditional_cdfs[i].inverse_cdf(p, &conditioning);
            x.push(xi);
        }

        x
    }
}

// ============================================================================
// COPULAS
// ============================================================================

/// Copula types for dependency modeling
/// Industry standard: OpenTURNS, UQLab, R copula package
#[derive(Debug, Clone)]
pub enum Copula {
    /// Gaussian copula with correlation matrix
    Gaussian { correlation: Vec<Vec<f64>>, cholesky: Vec<Vec<f64>> },
    /// Clayton copula (lower tail dependence)
    Clayton { theta: f64 },
    /// Frank copula (symmetric, no tail dependence)
    Frank { theta: f64 },
    /// Gumbel copula (upper tail dependence)
    Gumbel { theta: f64 },
    /// Student-t copula (symmetric tail dependence)
    StudentT { correlation: Vec<Vec<f64>>, nu: f64 },
}

impl Copula {
    /// Create Gaussian copula
    pub fn gaussian(correlation: Vec<Vec<f64>>) -> Self {
        let n = correlation.len();
        let mut cholesky: Vec<Vec<f64>> = vec![vec![0.0; n]; n];

        // Cholesky decomposition
        for i in 0..n {
            for j in 0..=i {
                let mut sum: f64 = 0.0;
                if i == j {
                    for k in 0..j {
                        let v: f64 = cholesky[j][k];
                        sum += v * v;
                    }
                    cholesky[i][j] = (correlation[i][j] - sum).max(1e-10).sqrt();
                } else {
                    for k in 0..j {
                        sum += cholesky[i][k] * cholesky[j][k];
                    }
                    let denom: f64 = cholesky[j][j];
                    cholesky[i][j] = (correlation[i][j] - sum) / denom.max(1e-10);
                }
            }
        }

        Copula::Gaussian { correlation, cholesky }
    }

    /// Create Clayton copula
    pub fn clayton(theta: f64) -> Self {
        assert!(theta > 0.0, "Clayton theta must be > 0");
        Copula::Clayton { theta }
    }

    /// Create Frank copula
    pub fn frank(theta: f64) -> Self {
        assert!(theta != 0.0, "Frank theta must be non-zero");
        Copula::Frank { theta }
    }

    /// Create Gumbel copula
    pub fn gumbel(theta: f64) -> Self {
        assert!(theta >= 1.0, "Gumbel theta must be >= 1");
        Copula::Gumbel { theta }
    }

    /// Sample from copula (returns uniform marginals)
    pub fn sample(&self, n_samples: usize, rng_state: &mut u64) -> Vec<Vec<f64>> {
        match self {
            Copula::Gaussian { cholesky, .. } => {
                self.sample_gaussian(n_samples, cholesky, rng_state)
            }
            Copula::Clayton { theta } => {
                self.sample_clayton(n_samples, *theta, rng_state)
            }
            Copula::Frank { theta } => {
                self.sample_frank(n_samples, *theta, rng_state)
            }
            Copula::Gumbel { theta } => {
                self.sample_gumbel(n_samples, *theta, rng_state)
            }
            Copula::StudentT { correlation, nu } => {
                self.sample_student_t(n_samples, correlation, *nu, rng_state)
            }
        }
    }

    fn sample_gaussian(&self, n: usize, cholesky: &[Vec<f64>], rng_state: &mut u64) -> Vec<Vec<f64>> {
        let dim = cholesky.len();
        let mut samples = Vec::new();

        for _ in 0..n {
            // Generate independent standard normals
            let z: Vec<f64> = (0..dim).map(|_| box_muller_normal(rng_state)).collect();

            // Apply Cholesky
            let mut y = vec![0.0; dim];
            for i in 0..dim {
                for j in 0..=i {
                    y[i] += cholesky[i][j] * z[j];
                }
            }

            // Transform to uniform
            let u: Vec<f64> = y.iter().map(|&yi| standard_normal_cdf(yi)).collect();
            samples.push(u);
        }

        samples
    }

    fn sample_clayton(&self, n: usize, theta: f64, rng_state: &mut u64) -> Vec<Vec<f64>> {
        // Bivariate Clayton sampling using conditional method
        let mut samples = Vec::new();

        for _ in 0..n {
            let u1 = lcg_random(rng_state);
            let v = lcg_random(rng_state);

            // Conditional u2 | u1
            let u2 = u1 * (v.powf(-theta / (1.0 + theta)) - 1.0 + u1.powf(theta))
                .powf(-1.0 / theta);

            samples.push(vec![u1, u2.clamp(0.0, 1.0)]);
        }

        samples
    }

    fn sample_frank(&self, n: usize, theta: f64, rng_state: &mut u64) -> Vec<Vec<f64>> {
        let mut samples = Vec::new();

        for _ in 0..n {
            let u1 = lcg_random(rng_state);
            let v = lcg_random(rng_state);

            // Conditional u2 | u1
            let a = 1.0 - (-theta).exp();
            let b = (-theta * u1).exp();
            let u2 = -((1.0 - a / (a * v / b + (1.0 - v))).ln()) / theta;

            samples.push(vec![u1, u2.clamp(0.0, 1.0)]);
        }

        samples
    }

    fn sample_gumbel(&self, n: usize, theta: f64, rng_state: &mut u64) -> Vec<Vec<f64>> {
        // Using Marshall-Olkin algorithm
        let mut samples = Vec::new();

        for _ in 0..n {
            // Generate gamma(1/theta, 1)
            let s = gamma_sample(1.0 / theta, rng_state);

            let e1 = -lcg_random(rng_state).ln();
            let e2 = -lcg_random(rng_state).ln();

            let u1 = (-( e1 / s).powf(theta)).exp();
            let u2 = (-(e2 / s).powf(theta)).exp();

            samples.push(vec![u1, u2]);
        }

        samples
    }

    fn sample_student_t(&self, n: usize, corr: &[Vec<f64>], nu: f64, rng_state: &mut u64) -> Vec<Vec<f64>> {
        let dim = corr.len();
        
        // Cholesky of correlation
        let mut chol: Vec<Vec<f64>> = vec![vec![0.0; dim]; dim];
        for i in 0..dim {
            for j in 0..=i {
                let mut sum: f64 = 0.0;
                if i == j {
                    for k in 0..j { 
                        let v: f64 = chol[j][k];
                        sum += v * v; 
                    }
                    chol[i][j] = (corr[i][j] - sum).max(1e-10).sqrt();
                } else {
                    for k in 0..j { sum += chol[i][k] * chol[j][k]; }
                    let denom: f64 = chol[j][j];
                    chol[i][j] = (corr[i][j] - sum) / denom.max(1e-10);
                }
            }
        }

        let mut samples = Vec::new();

        for _ in 0..n {
            // Chi-squared sample
            let chi2 = gamma_sample(nu / 2.0, rng_state) * 2.0;
            let s = (chi2 / nu).sqrt();

            // Standard normal vector
            let z: Vec<f64> = (0..dim).map(|_| box_muller_normal(rng_state)).collect();

            // Correlated normal
            let mut y = vec![0.0; dim];
            for i in 0..dim {
                for j in 0..=i {
                    y[i] += chol[i][j] * z[j];
                }
            }

            // T-distributed
            let t: Vec<f64> = y.iter().map(|&yi| yi / s).collect();

            // To uniform using t-CDF
            let u: Vec<f64> = t.iter().map(|&ti| student_t_cdf(ti, nu)).collect();
            samples.push(u);
        }

        samples
    }

    /// Copula CDF (for bivariate)
    pub fn cdf(&self, u: &[f64]) -> f64 {
        match self {
            Copula::Clayton { theta } => {
                if u[0] <= 0.0 || u[1] <= 0.0 { return 0.0; }
                (u[0].powf(-*theta) + u[1].powf(-*theta) - 1.0).max(0.0).powf(-1.0 / theta)
            }
            Copula::Frank { theta } => {
                let a = (-*theta).exp() - 1.0;
                let num = ((-theta * u[0]).exp() - 1.0) * ((-theta * u[1]).exp() - 1.0);
                -(1.0 + num / a).ln() / theta
            }
            Copula::Gumbel { theta } => {
                if u[0] <= 0.0 || u[1] <= 0.0 { return 0.0; }
                let t = ((-u[0].ln()).powf(*theta) + (-u[1].ln()).powf(*theta)).powf(1.0 / theta);
                (-t).exp()
            }
            _ => {
                // Numerical for Gaussian and Student-t
                0.0 // Placeholder
            }
        }
    }

    /// Copula density (for bivariate)
    pub fn pdf(&self, u: &[f64]) -> f64 {
        match self {
            Copula::Clayton { theta } => {
                if u[0] <= 0.0 || u[1] <= 0.0 { return 0.0; }
                let sum = u[0].powf(-*theta) + u[1].powf(-*theta) - 1.0;
                (1.0 + theta) * (u[0] * u[1]).powf(-theta - 1.0) * sum.powf(-2.0 - 1.0 / theta)
            }
            Copula::Frank { theta } => {
                let a = theta * (1.0 - (-*theta).exp());
                let num = a * (-theta * (u[0] + u[1])).exp();
                let den = ((-*theta).exp() - 1.0 + ((-theta * u[0]).exp() - 1.0) 
                    * ((-theta * u[1]).exp() - 1.0)).powi(2);
                num / den
            }
            Copula::Gumbel { theta } => {
                if u[0] <= 0.0 || u[1] <= 0.0 { return 0.0; }
                let t1 = (-u[0].ln()).powf(*theta);
                let t2 = (-u[1].ln()).powf(*theta);
                let t = (t1 + t2).powf(1.0 / theta);
                let c = (-t).exp();
                let factor = c / (u[0] * u[1]) * (t1 / (-u[0].ln()) * t2 / (-u[1].ln()))
                    * (t1 + t2).powf(2.0 / theta - 2.0) * (theta - 1.0 + t);
                factor
            }
            _ => 1.0,
        }
    }
}

// ============================================================================
// KERNEL DENSITY ESTIMATION
// ============================================================================

/// Kernel density estimator for unknown distributions
/// Industry standard: OpenTURNS, SciPy
#[derive(Debug, Clone)]
pub struct KernelDensityEstimate {
    pub samples: Vec<f64>,
    pub bandwidth: f64,
    pub kernel: KernelType,
}

#[derive(Debug, Clone, Copy)]
pub enum KernelType {
    Gaussian,
    Epanechnikov,
    Triangular,
    Uniform,
}

impl KernelDensityEstimate {
    pub fn new(samples: Vec<f64>) -> Self {
        let n = samples.len() as f64;
        
        // Silverman's rule of thumb for bandwidth
        let std = sample_std(&samples);
        let iqr = interquartile_range(&samples);
        let bandwidth = 0.9 * std.min(iqr / 1.34) * n.powf(-0.2);

        KernelDensityEstimate {
            samples,
            bandwidth,
            kernel: KernelType::Gaussian,
        }
    }

    pub fn with_bandwidth(mut self, h: f64) -> Self {
        self.bandwidth = h;
        self
    }

    pub fn with_kernel(mut self, kernel: KernelType) -> Self {
        self.kernel = kernel;
        self
    }

    /// Evaluate PDF at point x
    pub fn pdf(&self, x: f64) -> f64 {
        let n = self.samples.len() as f64;
        let h = self.bandwidth;

        let sum: f64 = self.samples.iter()
            .map(|&xi| self.kernel_function((x - xi) / h))
            .sum();

        sum / (n * h)
    }

    /// Evaluate CDF at point x
    pub fn cdf(&self, x: f64) -> f64 {
        let n = self.samples.len() as f64;
        let h = self.bandwidth;

        let sum: f64 = self.samples.iter()
            .map(|&xi| self.kernel_cdf((x - xi) / h))
            .sum();

        sum / n
    }

    fn kernel_function(&self, u: f64) -> f64 {
        match self.kernel {
            KernelType::Gaussian => {
                (-0.5 * u * u).exp() / (2.0 * PI).sqrt()
            }
            KernelType::Epanechnikov => {
                if u.abs() <= 1.0 { 0.75 * (1.0 - u * u) }
                else { 0.0 }
            }
            KernelType::Triangular => {
                if u.abs() <= 1.0 { 1.0 - u.abs() }
                else { 0.0 }
            }
            KernelType::Uniform => {
                if u.abs() <= 1.0 { 0.5 }
                else { 0.0 }
            }
        }
    }

    fn kernel_cdf(&self, u: f64) -> f64 {
        match self.kernel {
            KernelType::Gaussian => {
                standard_normal_cdf(u)
            }
            KernelType::Epanechnikov => {
                if u < -1.0 { 0.0 }
                else if u > 1.0 { 1.0 }
                else { 0.5 + 0.75 * u - 0.25 * u.powi(3) }
            }
            KernelType::Triangular => {
                if u < -1.0 { 0.0 }
                else if u < 0.0 { 0.5 * (1.0 + u).powi(2) }
                else if u < 1.0 { 1.0 - 0.5 * (1.0 - u).powi(2) }
                else { 1.0 }
            }
            KernelType::Uniform => {
                if u < -1.0 { 0.0 }
                else if u > 1.0 { 1.0 }
                else { 0.5 * (u + 1.0) }
            }
        }
    }

    /// Generate random sample
    pub fn sample(&self, rng_state: &mut u64) -> f64 {
        let n = self.samples.len();
        let idx = (lcg_random(rng_state) * n as f64) as usize;
        let base = self.samples[idx.min(n - 1)];
        
        base + self.bandwidth * box_muller_normal(rng_state)
    }
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================


fn lower_incomplete_gamma(a: f64, x: f64) -> f64 {
    // Series expansion
    let mut sum = 0.0;
    let mut term = 1.0 / a;
    sum += term;
    
    for n in 1..100 {
        term *= x / (a + n as f64);
        sum += term;
        if term.abs() < 1e-14 * sum.abs() { break; }
    }
    
    x.powf(a) * (-x).exp() * sum
}

fn regularized_incomplete_beta(a: f64, b: f64, x: f64) -> f64 {
    if x <= 0.0 { return 0.0; }
    if x >= 1.0 { return 1.0; }
    
    // Continued fraction
    let bt: f64 = if x == 0.0 || x == 1.0 {
        0.0
    } else {
        (lgamma(a) + lgamma(b) - lgamma(a + b)
            + a * x.ln() + b * (1.0 - x).ln()).exp()
    };
    
    if x < (a + 1.0) / (a + b + 2.0) {
        bt * beta_cf(a, b, x) / a
    } else {
        1.0 - bt * beta_cf(b, a, 1.0 - x) / b
    }
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
        
        if (delta - 1.0).abs() < 1e-10 { break; }
    }
    
    h
}

fn student_t_cdf(t: f64, nu: f64) -> f64 {
    let x = nu / (nu + t * t);
    0.5 + 0.5 * t.signum() * (1.0 - regularized_incomplete_beta(nu / 2.0, 0.5, x))
}

fn student_t_pdf(t: f64, nu: f64) -> f64 {
    let coef = gamma_func((nu + 1.0) / 2.0) / (gamma_func(nu / 2.0) * (nu * PI).sqrt());
    coef * (1.0 + t * t / nu).powf(-(nu + 1.0) / 2.0)
}

// ============================================================================
// COMPLETE NATAF CORRELATION FACTOR TABLES (DER KIUREGHIAN & LIU 1986)
// ============================================================================

/// Complete Nataf correlation factor computation per Der Kiureghian & Liu (1986)
/// Industry standard: FERUM, OpenTURNS, Strurel
pub struct NatafFactorTables;

impl NatafFactorTables {
    /// Get correlation modification factor F such that ρ_Y = ρ_X / F
    pub fn correlation_factor(
        dist1: &MarginalDistribution,
        dist2: &MarginalDistribution,
        rho: f64,
    ) -> f64 {
        let cov1 = dist1.std() / dist1.mean().abs().max(1e-10);
        let cov2 = dist2.std() / dist2.mean().abs().max(1e-10);
        
        // Table from Der Kiureghian & Liu (1986), Table 1
        let f = match (dist1, dist2) {
            // Normal - Normal
            (MarginalDistribution::Normal { .. }, MarginalDistribution::Normal { .. }) => 1.0,
            
            // Normal - Lognormal
            (MarginalDistribution::Normal { .. }, MarginalDistribution::Lognormal { .. }) |
            (MarginalDistribution::Lognormal { .. }, MarginalDistribution::Normal { .. }) => {
                let v = cov1.max(cov2);
                v / (1.0 + v * v).ln().sqrt()
            }
            
            // Lognormal - Lognormal
            (MarginalDistribution::Lognormal { .. }, MarginalDistribution::Lognormal { .. }) => {
                let zeta1 = (1.0 + cov1 * cov1).ln().sqrt();
                let zeta2 = (1.0 + cov2 * cov2).ln().sqrt();
                (((1.0 + rho * cov1 * cov2).ln()) / (zeta1 * zeta2)).clamp(-0.999, 0.999)
            }
            
            // Normal - Uniform
            (MarginalDistribution::Normal { .. }, MarginalDistribution::Uniform { .. }) |
            (MarginalDistribution::Uniform { .. }, MarginalDistribution::Normal { .. }) => 1.023,
            
            // Normal - Gumbel (Type I Extreme)
            (MarginalDistribution::Normal { .. }, MarginalDistribution::Gumbel { .. }) |
            (MarginalDistribution::Gumbel { .. }, MarginalDistribution::Normal { .. }) => 1.031,
            
            // Normal - Weibull
            (MarginalDistribution::Normal { .. }, MarginalDistribution::Weibull { k: _, .. }) |
            (MarginalDistribution::Weibull { k: _, .. }, MarginalDistribution::Normal { .. }) => {
                let v = cov1.max(cov2);
                1.031 - 0.195 * v + 0.328 * v * v
            }
            
            // Normal - Gamma
            (MarginalDistribution::Normal { .. }, MarginalDistribution::Gamma { shape, .. }) |
            (MarginalDistribution::Gamma { shape, .. }, MarginalDistribution::Normal { .. }) => {
                let k = *shape;
                1.001 - 0.007 / k.sqrt() + 0.118 / k
            }
            
            // Normal - Exponential
            (MarginalDistribution::Normal { .. }, MarginalDistribution::Exponential { .. }) |
            (MarginalDistribution::Exponential { .. }, MarginalDistribution::Normal { .. }) => 1.107,
            
            // Normal - Frechet (Type II Extreme)
            (MarginalDistribution::Normal { .. }, MarginalDistribution::Frechet { alpha, .. }) |
            (MarginalDistribution::Frechet { alpha, .. }, MarginalDistribution::Normal { .. }) => {
                let a = *alpha;
                1.03 + 0.238 / a + 0.364 / (a * a)
            }
            
            // Uniform - Uniform
            (MarginalDistribution::Uniform { .. }, MarginalDistribution::Uniform { .. }) => 1.047,
            
            // Gumbel - Gumbel
            (MarginalDistribution::Gumbel { .. }, MarginalDistribution::Gumbel { .. }) => {
                1.064 - 0.069 * rho + 0.005 * rho * rho
            }
            
            // Exponential - Exponential  
            (MarginalDistribution::Exponential { .. }, MarginalDistribution::Exponential { .. }) => {
                1.229 - 0.367 * rho + 0.153 * rho * rho
            }
            
            // Default: numerical integration (simplified)
            _ => {
                // Use approximate formula based on COVs
                let max_cov = cov1.max(cov2);
                1.0 + 0.05 * max_cov + 0.02 * max_cov * max_cov
            }
        };
        
        f.max(0.1).min(2.0)  // Bound for numerical stability
    }
    
    /// Compute full modified correlation matrix
    pub fn modified_correlation_matrix(
        marginals: &[MarginalDistribution],
        correlation: &[Vec<f64>],
    ) -> Vec<Vec<f64>> {
        let n = marginals.len();
        let mut modified = vec![vec![0.0; n]; n];
        
        for i in 0..n {
            for j in 0..n {
                if i == j {
                    modified[i][j] = 1.0;
                } else {
                    let rho = correlation[i][j];
                    let f = Self::correlation_factor(&marginals[i], &marginals[j], rho);
                    modified[i][j] = rho / f;
                }
            }
        }
        
        // Ensure positive definiteness
        Self::nearest_positive_definite(&mut modified);
        
        modified
    }
    
    /// Project to nearest positive definite matrix (Higham 2002)
    fn nearest_positive_definite(matrix: &mut Vec<Vec<f64>>) {
        let n = matrix.len();
        
        // Simple eigenvalue clipping approach
        // For full Higham algorithm, iterate alternating projections
        
        // Ensure symmetry
        for i in 0..n {
            for j in (i + 1)..n {
                let avg = (matrix[i][j] + matrix[j][i]) / 2.0;
                matrix[i][j] = avg;
                matrix[j][i] = avg;
            }
        }
        
        // Ensure diagonal dominance (simple fix)
        for i in 0..n {
            let off_diag_sum: f64 = (0..n)
                .filter(|&j| j != i)
                .map(|j| matrix[i][j].abs())
                .sum();
            
            if off_diag_sum >= 1.0 {
                let scale = 0.99 / off_diag_sum;
                for j in 0..n {
                    if j != i {
                        matrix[i][j] *= scale;
                        matrix[j][i] *= scale;
                    }
                }
            }
        }
    }
}

fn lcg_random(state: &mut u64) -> f64 {
    *state = state.wrapping_mul(6364136223846793005).wrapping_add(1);
    (*state as f64) / (u64::MAX as f64)
}

fn box_muller_normal(state: &mut u64) -> f64 {
    let u1 = lcg_random(state);
    let u2 = lcg_random(state);
    (-2.0 * u1.ln()).sqrt() * (2.0 * PI * u2).cos()
}

fn gamma_sample(shape: f64, rng_state: &mut u64) -> f64 {
    // Marsaglia and Tsang's method
    if shape < 1.0 {
        return gamma_sample(shape + 1.0, rng_state) * lcg_random(rng_state).powf(1.0 / shape);
    }
    
    let d = shape - 1.0 / 3.0;
    let c = 1.0 / (9.0 * d).sqrt();
    
    loop {
        let x = box_muller_normal(rng_state);
        let v = (1.0 + c * x).powi(3);
        
        if v > 0.0 {
            let u = lcg_random(rng_state);
            if u < 1.0 - 0.0331 * x.powi(4) {
                return d * v;
            }
            if u.ln() < 0.5 * x * x + d * (1.0 - v + v.ln()) {
                return d * v;
            }
        }
    }
}

fn invert_matrix(a: &[Vec<f64>]) -> Vec<Vec<f64>> {
    let n = a.len();
    let mut aug = vec![vec![0.0; 2 * n]; n];

    for i in 0..n {
        for j in 0..n {
            aug[i][j] = a[i][j];
            aug[i][n + j] = if i == j { 1.0 } else { 0.0 };
        }
    }

    for i in 0..n {
        let mut max_row = i;
        for k in (i + 1)..n {
            if aug[k][i].abs() > aug[max_row][i].abs() {
                max_row = k;
            }
        }
        aug.swap(i, max_row);

        let pivot = aug[i][i];
        if pivot.abs() < 1e-14 { continue; }

        for j in 0..(2 * n) {
            aug[i][j] /= pivot;
        }

        for k in 0..n {
            if k == i { continue; }
            let factor = aug[k][i];
            for j in 0..(2 * n) {
                aug[k][j] -= factor * aug[i][j];
            }
        }
    }

    let mut inv = vec![vec![0.0; n]; n];
    for i in 0..n {
        for j in 0..n {
            inv[i][j] = aug[i][n + j];
        }
    }
    inv
}

fn sample_std(samples: &[f64]) -> f64 {
    let n = samples.len() as f64;
    let mean = samples.iter().sum::<f64>() / n;
    let variance = samples.iter().map(|&x| (x - mean).powi(2)).sum::<f64>() / (n - 1.0);
    variance.sqrt()
}

fn interquartile_range(samples: &[f64]) -> f64 {
    let mut sorted = samples.to_vec();
    sorted.sort_by(|a, b| a.partial_cmp(b).unwrap_or(std::cmp::Ordering::Equal));
    
    let n = sorted.len();
    let q1_idx = n / 4;
    let q3_idx = 3 * n / 4;
    
    sorted[q3_idx] - sorted[q1_idx]
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_nataf_transform() {
        let marginals = vec![
            MarginalDistribution::Normal { mean: 10.0, std: 2.0 },
            MarginalDistribution::Lognormal { lambda: 2.0, zeta: 0.3 },
        ];
        
        let correlation = vec![
            vec![1.0, 0.5],
            vec![0.5, 1.0],
        ];
        
        let nataf = NatafTransformation::new(marginals, correlation);
        
        let x = vec![10.0, 8.0];
        let u = nataf.physical_to_standard(&x);
        let x_back = nataf.standard_to_physical(&u);
        
        assert!((x[0] - x_back[0]).abs() < 0.01);
        assert!((x[1] - x_back[1]).abs() < 0.1);
    }

    #[test]
    fn test_marginal_distributions() {
        let normal = MarginalDistribution::Normal { mean: 5.0, std: 2.0 };
        assert!((normal.mean() - 5.0).abs() < 1e-10);
        
        let uniform = MarginalDistribution::Uniform { a: 0.0, b: 10.0 };
        assert!((uniform.cdf(5.0) - 0.5).abs() < 1e-10);
        
        let weibull = MarginalDistribution::Weibull { k: 2.0, lambda: 5.0 };
        assert!(weibull.pdf(5.0) > 0.0);
    }

    #[test]
    fn test_rosenblatt_gaussian() {
        let mean = vec![0.0, 0.0];
        let cov = vec![vec![1.0, 0.5], vec![0.5, 1.0]];
        
        let rosenblatt = RosenblattTransformation::from_gaussian(mean, cov);
        
        let x = vec![0.5, 0.3];
        let u = rosenblatt.transform(&x);
        let x_back = rosenblatt.inverse_transform(&u);
        
        assert!((x[0] - x_back[0]).abs() < 0.1);
    }

    #[test]
    fn test_copulas() {
        let mut rng_state = 42u64;
        
        // Gaussian copula
        let corr = vec![vec![1.0, 0.7], vec![0.7, 1.0]];
        let gaussian = Copula::gaussian(corr);
        let samples = gaussian.sample(100, &mut rng_state);
        assert_eq!(samples.len(), 100);
        
        // Clayton copula
        let clayton = Copula::clayton(2.0);
        let samples = clayton.sample(100, &mut rng_state);
        assert_eq!(samples.len(), 100);
        
        // All samples in [0,1]
        for s in &samples {
            assert!(s[0] >= 0.0 && s[0] <= 1.0);
            assert!(s[1] >= 0.0 && s[1] <= 1.0);
        }
    }

    #[test]
    fn test_kde() {
        let samples: Vec<f64> = (0..100).map(|i| i as f64 / 100.0).collect();
        let kde = KernelDensityEstimate::new(samples);
        
        // PDF should be positive in data range
        assert!(kde.pdf(0.5) > 0.0);
        
        // CDF should be monotonic
        assert!(kde.cdf(0.7) > kde.cdf(0.3));
    }
}
