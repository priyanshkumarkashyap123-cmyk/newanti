//! # Core Civil Engineering Module
//! 
//! Provides fundamental calculations, material properties, unit conversions,
//! and numerical methods used across all civil engineering disciplines.

use nalgebra::{DMatrix, DVector, Matrix3, Vector3};
use serde::{Deserialize, Serialize};
use std::f64::consts::PI;

// ============================================================================
// STANDARD MATERIALS DATABASE
// ============================================================================

/// Standard material properties for civil engineering applications
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Material {
    pub name: String,
    /// Young's modulus (Pa)
    pub e: f64,
    /// Shear modulus (Pa)
    pub g: f64,
    /// Poisson's ratio
    pub nu: f64,
    /// Density (kg/m³)
    pub density: f64,
    /// Yield strength (Pa) - for metals
    pub fy: Option<f64>,
    /// Ultimate strength (Pa)
    pub fu: Option<f64>,
    /// Characteristic compressive strength (Pa) - for concrete
    pub fck: Option<f64>,
    /// Coefficient of thermal expansion (1/°C)
    pub alpha: f64,
}

impl Material {
    /// Create concrete material by grade (e.g., M25, M30, M40)
    pub fn concrete(grade: u32) -> Self {
        let fck = (grade as f64) * 1e6; // MPa to Pa
        let e = 5000.0 * (fck / 1e6).sqrt() * 1e6; // IS 456 formula
        let nu = 0.2;
        let g = e / (2.0 * (1.0 + nu));
        
        Material {
            name: format!("M{}", grade),
            e,
            g,
            nu,
            density: 2500.0,
            fy: None,
            fu: None,
            fck: Some(fck),
            alpha: 10e-6,
        }
    }
    
    /// Create steel rebar by grade (e.g., Fe415, Fe500)
    pub fn steel_rebar(grade: u32) -> Self {
        let fy = (grade as f64) * 1e6;
        let e = 200e9;
        let nu = 0.3;
        let g = e / (2.0 * (1.0 + nu));
        
        Material {
            name: format!("Fe{}", grade),
            e,
            g,
            nu,
            density: 7850.0,
            fy: Some(fy),
            fu: Some(fy * 1.1),
            fck: None,
            alpha: 12e-6,
        }
    }
    
    /// Create structural steel (E250, E350, etc.)
    pub fn structural_steel(grade: u32) -> Self {
        let fy = (grade as f64) * 1e6;
        let e = 200e9;
        let nu = 0.3;
        let g = e / (2.0 * (1.0 + nu));
        
        Material {
            name: format!("E{}", grade),
            e,
            g,
            nu,
            density: 7850.0,
            fy: Some(fy),
            fu: Some(fy * 1.2),
            fck: None,
            alpha: 12e-6,
        }
    }
}

/// Standard material library
pub fn get_standard_materials() -> Vec<Material> {
    vec![
        Material::concrete(20),
        Material::concrete(25),
        Material::concrete(30),
        Material::concrete(35),
        Material::concrete(40),
        Material::steel_rebar(415),
        Material::steel_rebar(500),
        Material::steel_rebar(550),
        Material::structural_steel(250),
        Material::structural_steel(300),
        Material::structural_steel(350),
    ]
}

// ============================================================================
// SECTION PROPERTIES
// ============================================================================

/// Cross-section geometric properties
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SectionProperties {
    /// Cross-sectional area (m²)
    pub area: f64,
    /// Moment of inertia about major axis (m⁴)
    pub ixx: f64,
    /// Moment of inertia about minor axis (m⁴)
    pub iyy: f64,
    /// Torsional constant (m⁴)
    pub j: f64,
    /// Section modulus about major axis (m³)
    pub zxx: f64,
    /// Section modulus about minor axis (m³)
    pub zyy: f64,
    /// Plastic section modulus (m³)
    pub zp: f64,
    /// Radius of gyration about major axis (m)
    pub rxx: f64,
    /// Radius of gyration about minor axis (m)
    pub ryy: f64,
    /// Depth of section (m)
    pub depth: f64,
    /// Width of section (m)
    pub width: f64,
}

impl SectionProperties {
    /// Calculate properties for rectangular section
    pub fn rectangular(width: f64, depth: f64) -> Self {
        let area = width * depth;
        let ixx = width * depth.powi(3) / 12.0;
        let iyy = depth * width.powi(3) / 12.0;
        let j = width * depth * (width.powi(2) + depth.powi(2)) / 12.0;
        let zxx = ixx / (depth / 2.0);
        let zyy = iyy / (width / 2.0);
        let zp = width * depth.powi(2) / 4.0;
        let rxx = (ixx / area).sqrt();
        let ryy = (iyy / area).sqrt();
        
        SectionProperties {
            area, ixx, iyy, j, zxx, zyy, zp, rxx, ryy, depth, width,
        }
    }
    
    /// Calculate properties for circular section
    pub fn circular(diameter: f64) -> Self {
        let r = diameter / 2.0;
        let area = PI * r.powi(2);
        let ixx = PI * r.powi(4) / 4.0;
        let iyy = ixx;
        let j = PI * r.powi(4) / 2.0;
        let zxx = ixx / r;
        let zyy = zxx;
        let zp = r.powi(3) * 4.0 / 3.0;
        let rxx = r / 2.0;
        let ryy = rxx;
        
        SectionProperties {
            area, ixx, iyy, j, zxx, zyy, zp, rxx, ryy, depth: diameter, width: diameter,
        }
    }
    
    /// Calculate properties for I-section (wide flange)
    pub fn i_section(depth: f64, flange_width: f64, flange_thickness: f64, web_thickness: f64) -> Self {
        let web_height = depth - 2.0 * flange_thickness;
        
        // Area
        let area = 2.0 * flange_width * flange_thickness + web_height * web_thickness;
        
        // Moment of inertia about major axis (Ixx)
        let ixx = (flange_width * depth.powi(3) - (flange_width - web_thickness) * web_height.powi(3)) / 12.0;
        
        // Moment of inertia about minor axis (Iyy)
        let iyy = (2.0 * flange_thickness * flange_width.powi(3) + web_height * web_thickness.powi(3)) / 12.0;
        
        // Torsional constant (approximate)
        let j = (2.0 * flange_width * flange_thickness.powi(3) + web_height * web_thickness.powi(3)) / 3.0;
        
        let zxx = ixx / (depth / 2.0);
        let zyy = iyy / (flange_width / 2.0);
        let zp = flange_width * flange_thickness * (depth - flange_thickness) + web_thickness * web_height.powi(2) / 4.0;
        let rxx = (ixx / area).sqrt();
        let ryy = (iyy / area).sqrt();
        
        SectionProperties {
            area, ixx, iyy, j, zxx, zyy, zp, rxx, ryy, depth, width: flange_width,
        }
    }
    
    /// Calculate properties for hollow circular section (pipe)
    pub fn hollow_circular(outer_diameter: f64, thickness: f64) -> Self {
        let ro = outer_diameter / 2.0;
        let ri = ro - thickness;
        let area = PI * (ro.powi(2) - ri.powi(2));
        let ixx = PI * (ro.powi(4) - ri.powi(4)) / 4.0;
        let iyy = ixx;
        let j = PI * (ro.powi(4) - ri.powi(4)) / 2.0;
        let zxx = ixx / ro;
        let zp = (ro.powi(3) - ri.powi(3)) * 4.0 / 3.0;
        let rxx = ((ro.powi(2) + ri.powi(2)) / 4.0).sqrt();
        
        SectionProperties {
            area, ixx, iyy, j, zxx, zyy: zxx, zp, rxx, ryy: rxx, 
            depth: outer_diameter, width: outer_diameter,
        }
    }
    
    /// Calculate properties for hollow rectangular section (box)
    pub fn hollow_rectangular(width: f64, depth: f64, thickness: f64) -> Self {
        let wi = width - 2.0 * thickness;
        let di = depth - 2.0 * thickness;
        
        let area = width * depth - wi * di;
        let ixx = (width * depth.powi(3) - wi * di.powi(3)) / 12.0;
        let iyy = (depth * width.powi(3) - di * wi.powi(3)) / 12.0;
        let j = 2.0 * thickness * (width - thickness).powi(2) * (depth - thickness).powi(2) / (width + depth - 2.0 * thickness);
        let zxx = ixx / (depth / 2.0);
        let zyy = iyy / (width / 2.0);
        let zp = width * depth.powi(2) / 4.0 - wi * di.powi(2) / 4.0;
        let rxx = (ixx / area).sqrt();
        let ryy = (iyy / area).sqrt();
        
        SectionProperties {
            area, ixx, iyy, j, zxx, zyy, zp, rxx, ryy, depth, width,
        }
    }
}

// ============================================================================
// MATRIX OPERATIONS (HIGH PERFORMANCE)
// ============================================================================

/// High-performance matrix operations for structural analysis
pub struct MatrixOps;

impl MatrixOps {
    /// Solve linear system Ax = b using LU decomposition
    #[inline]
    pub fn solve_lu(a: &DMatrix<f64>, b: &DVector<f64>) -> Result<DVector<f64>, &'static str> {
        a.clone().lu().solve(b).ok_or("Singular matrix - cannot solve")
    }
    
    /// Solve linear system using Cholesky decomposition (for SPD matrices)
    #[inline]
    pub fn solve_cholesky(a: &DMatrix<f64>, b: &DVector<f64>) -> Result<DVector<f64>, &'static str> {
        let cholesky = a.clone().cholesky().ok_or("Matrix not positive definite")?;
        Ok(cholesky.solve(b))
    }
    
    /// Compute eigenvalues and eigenvectors (for modal analysis)
    pub fn eigen_symmetric(a: &DMatrix<f64>) -> (DVector<f64>, DMatrix<f64>) {
        let eigen = a.clone().symmetric_eigen();
        (eigen.eigenvalues, eigen.eigenvectors)
    }
    
    /// Sparse matrix-vector multiplication
    pub fn sparse_mv(indices: &[(usize, usize)], values: &[f64], size: usize, v: &DVector<f64>) -> DVector<f64> {
        let mut result = DVector::zeros(size);
        for (&(i, j), &val) in indices.iter().zip(values.iter()) {
            result[i] += val * v[j];
        }
        result
    }
    
    /// Band matrix solver (efficient for tridiagonal and banded systems)
    pub fn solve_tridiagonal(lower: &[f64], diag: &[f64], upper: &[f64], b: &[f64]) -> Vec<f64> {
        let n = diag.len();
        let mut c_prime = vec![0.0; n];
        let mut d_prime = vec![0.0; n];
        let mut x = vec![0.0; n];
        
        // Forward sweep
        c_prime[0] = upper[0] / diag[0];
        d_prime[0] = b[0] / diag[0];
        
        for i in 1..n {
            let denom = diag[i] - lower[i-1] * c_prime[i-1];
            if i < n - 1 {
                c_prime[i] = upper[i] / denom;
            }
            d_prime[i] = (b[i] - lower[i-1] * d_prime[i-1]) / denom;
        }
        
        // Back substitution
        x[n-1] = d_prime[n-1];
        for i in (0..n-1).rev() {
            x[i] = d_prime[i] - c_prime[i] * x[i+1];
        }
        
        x
    }
    
    /// Determinant calculation
    #[inline]
    pub fn determinant(a: &DMatrix<f64>) -> f64 {
        a.clone().lu().determinant()
    }
    
    /// Matrix condition number estimate
    pub fn condition_number(a: &DMatrix<f64>) -> f64 {
        let svd = a.clone().svd(false, false);
        let singular_values = svd.singular_values;
        if singular_values.len() == 0 {
            return f64::INFINITY;
        }
        let max_sv = singular_values.iter().cloned().fold(f64::NEG_INFINITY, f64::max);
        let min_sv = singular_values.iter().cloned().fold(f64::INFINITY, f64::min);
        if min_sv.abs() < 1e-15 {
            f64::INFINITY
        } else {
            max_sv / min_sv
        }
    }
}

// ============================================================================
// NUMERICAL INTEGRATION
// ============================================================================

/// Numerical integration methods
pub struct Integration;

impl Integration {
    /// Trapezoidal rule integration
    pub fn trapezoidal<F: Fn(f64) -> f64>(f: &F, a: f64, b: f64, n: usize) -> f64 {
        let h = (b - a) / (n as f64);
        let mut sum = 0.5 * (f(a) + f(b));
        for i in 1..n {
            sum += f(a + (i as f64) * h);
        }
        sum * h
    }
    
    /// Simpson's 1/3 rule integration
    pub fn simpson<F: Fn(f64) -> f64>(f: &F, a: f64, b: f64, n: usize) -> f64 {
        let n = if n % 2 == 1 { n + 1 } else { n };
        let h = (b - a) / (n as f64);
        let mut sum = f(a) + f(b);
        
        for i in 1..n {
            let x = a + (i as f64) * h;
            if i % 2 == 0 {
                sum += 2.0 * f(x);
            } else {
                sum += 4.0 * f(x);
            }
        }
        
        sum * h / 3.0
    }
    
    /// Gauss-Legendre quadrature (2-point)
    pub fn gauss_2<F: Fn(f64) -> f64>(f: &F, a: f64, b: f64) -> f64 {
        let c1 = (b - a) / 2.0;
        let c2 = (a + b) / 2.0;
        let x1 = -1.0 / 3.0_f64.sqrt();
        let x2 = 1.0 / 3.0_f64.sqrt();
        c1 * (f(c1 * x1 + c2) + f(c1 * x2 + c2))
    }
    
    /// Gauss-Legendre quadrature (3-point)
    pub fn gauss_3<F: Fn(f64) -> f64>(f: &F, a: f64, b: f64) -> f64 {
        let c1 = (b - a) / 2.0;
        let c2 = (a + b) / 2.0;
        let x1 = -(3.0 / 5.0_f64).sqrt();
        let x2 = 0.0;
        let x3 = (3.0 / 5.0_f64).sqrt();
        let w1 = 5.0 / 9.0;
        let w2 = 8.0 / 9.0;
        let w3 = 5.0 / 9.0;
        c1 * (w1 * f(c1 * x1 + c2) + w2 * f(c1 * x2 + c2) + w3 * f(c1 * x3 + c2))
    }
}

// ============================================================================
// ROOT FINDING
// ============================================================================

/// Root finding algorithms
pub struct RootFinding;

impl RootFinding {
    /// Newton-Raphson method
    pub fn newton_raphson<F, G>(f: F, df: G, x0: f64, tol: f64, max_iter: usize) -> Result<f64, &'static str>
    where
        F: Fn(f64) -> f64,
        G: Fn(f64) -> f64,
    {
        let mut x = x0;
        for _ in 0..max_iter {
            let fx = f(x);
            let dfx = df(x);
            
            if dfx.abs() < 1e-15 {
                return Err("Derivative too small");
            }
            
            let x_new = x - fx / dfx;
            
            if (x_new - x).abs() < tol {
                return Ok(x_new);
            }
            x = x_new;
        }
        Err("Did not converge")
    }
    
    /// Bisection method
    pub fn bisection<F: Fn(f64) -> f64>(f: F, mut a: f64, mut b: f64, tol: f64, max_iter: usize) -> Result<f64, &'static str> {
        let mut fa = f(a);
        let fb = f(b);
        
        if fa * fb > 0.0 {
            return Err("Root not bracketed");
        }
        
        for _ in 0..max_iter {
            let c = (a + b) / 2.0;
            let fc = f(c);
            
            if fc.abs() < tol || (b - a) / 2.0 < tol {
                return Ok(c);
            }
            
            if fa * fc < 0.0 {
                b = c;
            } else {
                a = c;
                fa = fc;
            }
        }
        
        Ok((a + b) / 2.0)
    }
    
    /// Secant method
    pub fn secant<F: Fn(f64) -> f64>(f: F, x0: f64, x1: f64, tol: f64, max_iter: usize) -> Result<f64, &'static str> {
        let mut x_prev = x0;
        let mut x_curr = x1;
        let mut f_prev = f(x_prev);
        
        for _ in 0..max_iter {
            let f_curr = f(x_curr);
            
            if (f_curr - f_prev).abs() < 1e-15 {
                return Err("Division by zero");
            }
            
            let x_new = x_curr - f_curr * (x_curr - x_prev) / (f_curr - f_prev);
            
            if (x_new - x_curr).abs() < tol {
                return Ok(x_new);
            }
            
            x_prev = x_curr;
            f_prev = f_curr;
            x_curr = x_new;
        }
        
        Err("Did not converge")
    }
    
    /// Brent's method (robust bracketing method)
    pub fn brent<F: Fn(f64) -> f64>(f: F, a: f64, b: f64, tol: f64, max_iter: usize) -> Result<f64, &'static str> {
        let mut a = a;
        let mut b = b;
        let mut fa = f(a);
        let mut fb = f(b);
        
        if fa * fb > 0.0 {
            return Err("Root not bracketed");
        }
        
        if fa.abs() < fb.abs() {
            std::mem::swap(&mut a, &mut b);
            std::mem::swap(&mut fa, &mut fb);
        }
        
        let mut c = a;
        let mut fc = fa;
        let mut mflag = true;
        let mut d = 0.0;
        
        for _ in 0..max_iter {
            if fb.abs() < tol {
                return Ok(b);
            }
            
            let s = if (fa - fc).abs() > tol && (fb - fc).abs() > tol {
                // Inverse quadratic interpolation
                a * fb * fc / ((fa - fb) * (fa - fc))
                    + b * fa * fc / ((fb - fa) * (fb - fc))
                    + c * fa * fb / ((fc - fa) * (fc - fb))
            } else {
                // Secant method
                b - fb * (b - a) / (fb - fa)
            };
            
            let cond1 = s < (3.0 * a + b) / 4.0 || s > b;
            let cond2 = mflag && (s - b).abs() >= (b - c).abs() / 2.0;
            let cond3 = !mflag && (s - b).abs() >= (c - d).abs() / 2.0;
            let cond4 = mflag && (b - c).abs() < tol;
            let cond5 = !mflag && (c - d).abs() < tol;
            
            let s = if cond1 || cond2 || cond3 || cond4 || cond5 {
                mflag = true;
                (a + b) / 2.0
            } else {
                mflag = false;
                s
            };
            
            let fs = f(s);
            d = c;
            c = b;
            fc = fb;
            
            if fa * fs < 0.0 {
                b = s;
                fb = fs;
            } else {
                a = s;
                fa = fs;
            }
            
            if fa.abs() < fb.abs() {
                std::mem::swap(&mut a, &mut b);
                std::mem::swap(&mut fa, &mut fb);
            }
        }
        
        Ok(b)
    }
}

// ============================================================================
// UNIT CONVERSIONS
// ============================================================================

/// Unit conversion utilities
pub struct Units;

impl Units {
    // Length conversions
    pub fn m_to_mm(m: f64) -> f64 { m * 1000.0 }
    pub fn mm_to_m(mm: f64) -> f64 { mm / 1000.0 }
    pub fn m_to_ft(m: f64) -> f64 { m * 3.28084 }
    pub fn ft_to_m(ft: f64) -> f64 { ft / 3.28084 }
    pub fn m_to_in(m: f64) -> f64 { m * 39.3701 }
    pub fn in_to_m(inch: f64) -> f64 { inch / 39.3701 }
    
    // Force conversions
    pub fn n_to_kn(n: f64) -> f64 { n / 1000.0 }
    pub fn kn_to_n(kn: f64) -> f64 { kn * 1000.0 }
    pub fn n_to_lbf(n: f64) -> f64 { n * 0.224809 }
    pub fn lbf_to_n(lbf: f64) -> f64 { lbf / 0.224809 }
    pub fn n_to_kip(n: f64) -> f64 { n * 0.000224809 }
    pub fn kip_to_n(kip: f64) -> f64 { kip / 0.000224809 }
    pub fn kn_to_kips(kn: f64) -> f64 { kn * 0.224809 }
    pub fn kips_to_kn(kips: f64) -> f64 { kips / 0.224809 }
    
    // Stress/Pressure conversions
    pub fn pa_to_mpa(pa: f64) -> f64 { pa / 1e6 }
    pub fn mpa_to_pa(mpa: f64) -> f64 { mpa * 1e6 }
    pub fn pa_to_ksi(pa: f64) -> f64 { pa * 0.000145038 }
    pub fn ksi_to_pa(ksi: f64) -> f64 { ksi / 0.000145038 }
    pub fn mpa_to_ksi(mpa: f64) -> f64 { mpa * 0.145038 }
    pub fn ksi_to_mpa(ksi: f64) -> f64 { ksi / 0.145038 }
    pub fn pa_to_psi(pa: f64) -> f64 { pa * 0.145038 }
    pub fn psi_to_pa(psi: f64) -> f64 { psi / 0.145038 }
    
    // Moment conversions
    pub fn nm_to_knm(nm: f64) -> f64 { nm / 1000.0 }
    pub fn knm_to_nm(knm: f64) -> f64 { knm * 1000.0 }
    pub fn nm_to_kipft(nm: f64) -> f64 { nm * 0.000737562 }
    pub fn kipft_to_nm(kipft: f64) -> f64 { kipft / 0.000737562 }
    
    // Area conversions
    pub fn m2_to_mm2(m2: f64) -> f64 { m2 * 1e6 }
    pub fn mm2_to_m2(mm2: f64) -> f64 { mm2 / 1e6 }
    pub fn m2_to_ft2(m2: f64) -> f64 { m2 * 10.7639 }
    pub fn ft2_to_m2(ft2: f64) -> f64 { ft2 / 10.7639 }
    
    // Volume conversions
    pub fn m3_to_l(m3: f64) -> f64 { m3 * 1000.0 }
    pub fn l_to_m3(l: f64) -> f64 { l / 1000.0 }
    pub fn m3_to_gal(m3: f64) -> f64 { m3 * 264.172 }
    pub fn gal_to_m3(gal: f64) -> f64 { gal / 264.172 }
    
    // Angle conversions
    pub fn deg_to_rad(deg: f64) -> f64 { deg * PI / 180.0 }
    pub fn rad_to_deg(rad: f64) -> f64 { rad * 180.0 / PI }
    
    // Flow rate conversions
    pub fn m3s_to_lps(m3s: f64) -> f64 { m3s * 1000.0 }
    pub fn lps_to_m3s(lps: f64) -> f64 { lps / 1000.0 }
    pub fn m3s_to_cfs(m3s: f64) -> f64 { m3s * 35.3147 }
    pub fn cfs_to_m3s(cfs: f64) -> f64 { cfs / 35.3147 }
}

// ============================================================================
// INTERPOLATION
// ============================================================================

/// Interpolation methods
pub struct Interpolation;

impl Interpolation {
    /// Linear interpolation
    pub fn linear(x: f64, x0: f64, y0: f64, x1: f64, y1: f64) -> f64 {
        y0 + (x - x0) * (y1 - y0) / (x1 - x0)
    }
    
    /// Bilinear interpolation
    pub fn bilinear(x: f64, y: f64, x0: f64, x1: f64, y0: f64, y1: f64, 
                    q00: f64, q01: f64, q10: f64, q11: f64) -> f64 {
        let denom = (x1 - x0) * (y1 - y0);
        (q00 * (x1 - x) * (y1 - y) + 
         q10 * (x - x0) * (y1 - y) +
         q01 * (x1 - x) * (y - y0) +
         q11 * (x - x0) * (y - y0)) / denom
    }
    
    /// Lagrange interpolation
    pub fn lagrange(x: f64, xs: &[f64], ys: &[f64]) -> f64 {
        let n = xs.len();
        let mut result = 0.0;
        
        for i in 0..n {
            let mut term = ys[i];
            for j in 0..n {
                if i != j {
                    term *= (x - xs[j]) / (xs[i] - xs[j]);
                }
            }
            result += term;
        }
        
        result
    }
    
    /// Cubic spline interpolation (returns spline coefficients)
    pub fn cubic_spline_coeffs(xs: &[f64], ys: &[f64]) -> Vec<(f64, f64, f64, f64)> {
        let n = xs.len();
        if n < 2 {
            return vec![];
        }
        
        let mut h = vec![0.0; n - 1];
        let mut alpha = vec![0.0; n - 1];
        
        for i in 0..n-1 {
            h[i] = xs[i+1] - xs[i];
        }
        
        for i in 1..n-1 {
            alpha[i] = 3.0 / h[i] * (ys[i+1] - ys[i]) - 3.0 / h[i-1] * (ys[i] - ys[i-1]);
        }
        
        let mut l = vec![1.0; n];
        let mut mu = vec![0.0; n];
        let mut z = vec![0.0; n];
        
        for i in 1..n-1 {
            l[i] = 2.0 * (xs[i+1] - xs[i-1]) - h[i-1] * mu[i-1];
            mu[i] = h[i] / l[i];
            z[i] = (alpha[i] - h[i-1] * z[i-1]) / l[i];
        }
        
        let mut c = vec![0.0; n];
        let mut b = vec![0.0; n - 1];
        let mut d = vec![0.0; n - 1];
        
        for j in (0..n-1).rev() {
            c[j] = z[j] - mu[j] * c[j+1];
            b[j] = (ys[j+1] - ys[j]) / h[j] - h[j] * (c[j+1] + 2.0 * c[j]) / 3.0;
            d[j] = (c[j+1] - c[j]) / (3.0 * h[j]);
        }
        
        (0..n-1).map(|i| (ys[i], b[i], c[i], d[i])).collect()
    }
}

// ============================================================================
// TESTS
// ============================================================================

#[cfg(test)]
mod tests {
    use super::*;
    
    #[test]
    fn test_rectangular_section() {
        let section = SectionProperties::rectangular(0.3, 0.5);
        assert!((section.area - 0.15).abs() < 1e-10);
        assert!((section.ixx - 0.003125).abs() < 1e-10);
    }
    
    #[test]
    fn test_newton_raphson() {
        // Find root of x^2 - 2 = 0 (should be sqrt(2))
        let root = RootFinding::newton_raphson(
            |x| x * x - 2.0,
            |x| 2.0 * x,
            1.0,
            1e-10,
            100
        ).unwrap();
        assert!((root - 2.0_f64.sqrt()).abs() < 1e-9);
    }
    
    #[test]
    fn test_integration() {
        // Integrate x^2 from 0 to 1 (should be 1/3)
        let result = Integration::simpson(&|x| x * x, 0.0, 1.0, 100);
        assert!((result - 1.0/3.0).abs() < 1e-6);
    }
    
    #[test]
    fn test_unit_conversion() {
        assert!((Units::m_to_mm(1.0) - 1000.0).abs() < 1e-10);
        assert!((Units::deg_to_rad(180.0) - PI).abs() < 1e-10);
    }
}
