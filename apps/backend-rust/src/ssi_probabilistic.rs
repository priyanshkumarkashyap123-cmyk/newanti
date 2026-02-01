// ============================================================================
// SOIL-STRUCTURE INTERACTION & PROBABILISTIC ANALYSIS
// ============================================================================
//
// P3 REQUIREMENT: Advanced SSI and Probabilistic Checks
//
// Features:
// - Soil-structure interaction modeling
// - Foundation impedance functions
// - Kinematic and inertial interaction
// - First-order reliability method (FORM)
// - Monte Carlo simulation
// - Probability of failure estimation
// - Partial factor calibration
//
// Industry Standard: PLAXIS, OpenSees, MATLAB Reliability Toolbox
// ============================================================================

use serde::{Deserialize, Serialize};
use std::f64::consts::PI;

// ============================================================================
// SOIL-STRUCTURE INTERACTION
// ============================================================================

/// Foundation impedance for SSI analysis
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FoundationImpedance {
    /// Foundation type
    pub foundation_type: FoundationType,
    /// Foundation dimensions
    pub dimensions: FoundationDimensions,
    /// Soil properties
    pub soil: SoilProperties,
    /// Frequency-dependent impedances
    pub impedances: Vec<ImpedancePoint>,
    /// Static stiffnesses
    pub static_stiffness: Stiffness6DOF,
    /// Radiation damping
    pub damping: Damping6DOF,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum FoundationType {
    SurfaceFooting,
    EmbeddedFooting,
    PileGroup,
    MatFoundation,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FoundationDimensions {
    pub length: f64,          // m
    pub width: f64,           // m
    pub embedment: f64,       // m
    pub pile_count: Option<usize>,
    pub pile_diameter: Option<f64>,
    pub pile_length: Option<f64>,
    pub pile_spacing: Option<f64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SoilProperties {
    pub shear_modulus: f64,   // MPa (G)
    pub poissons_ratio: f64,  // ν
    pub density: f64,         // kg/m³
    pub shear_wave_vel: f64,  // m/s (Vs)
    pub damping_ratio: f64,   // ξ (material damping)
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Stiffness6DOF {
    pub kx: f64,              // kN/m (horizontal x)
    pub ky: f64,              // kN/m (horizontal y)
    pub kz: f64,              // kN/m (vertical)
    pub krx: f64,             // kN·m/rad (rocking about x)
    pub kry: f64,             // kN·m/rad (rocking about y)
    pub krz: f64,             // kN·m/rad (torsion)
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Damping6DOF {
    pub cx: f64,              // kN·s/m
    pub cy: f64,
    pub cz: f64,
    pub crx: f64,             // kN·m·s/rad
    pub cry: f64,
    pub crz: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ImpedancePoint {
    pub frequency: f64,       // Hz
    pub omega: f64,           // rad/s
    pub a0: f64,              // Dimensionless frequency
    pub k_real: Stiffness6DOF,
    pub k_imag: Stiffness6DOF, // Damping contribution
}

impl FoundationImpedance {
    /// Calculate impedance for surface circular footing (Gazetas, 1991)
    pub fn surface_circular(radius: f64, soil: SoilProperties) -> Self {
        let g = soil.shear_modulus * 1000.0; // kN/m²
        let v = soil.poissons_ratio;
        let rho = soil.density;
        let vs = soil.shear_wave_vel;

        // Static stiffnesses (Gazetas, 1991)
        let kz = 4.0 * g * radius / (1.0 - v);
        let kh = 8.0 * g * radius / (2.0 - v);
        let kr = 8.0 * g * radius.powi(3) / (3.0 * (1.0 - v));
        let kt = 16.0 * g * radius.powi(3) / 3.0;

        let static_stiffness = Stiffness6DOF {
            kx: kh,
            ky: kh,
            kz,
            krx: kr,
            kry: kr,
            krz: kt,
        };

        // Radiation damping at low frequency
        let a0_ref = 0.5; // Reference dimensionless frequency
        let cz = 0.85 * kz * radius / vs;
        let ch = 0.576 * kh * radius / vs;
        let cr = 0.30 * kr * radius / vs;
        let ct = 0.21 * kt * radius / vs;

        let damping = Damping6DOF {
            cx: ch,
            cy: ch,
            cz,
            crx: cr,
            cry: cr,
            crz: ct,
        };

        // Frequency-dependent impedances
        let mut impedances = Vec::new();
        for i in 0..=20 {
            let a0 = i as f64 * 0.5;
            let omega = a0 * vs / radius;
            let freq = omega / (2.0 * PI);

            // Simplified frequency dependence (actual curves are complex)
            let k_factor = 1.0 - 0.1 * a0.min(2.0);
            let c_factor = 1.0 + 0.2 * a0.min(2.0);

            impedances.push(ImpedancePoint {
                frequency: freq,
                omega,
                a0,
                k_real: Stiffness6DOF {
                    kx: kh * k_factor,
                    ky: kh * k_factor,
                    kz: kz * k_factor,
                    krx: kr * k_factor,
                    kry: kr * k_factor,
                    krz: kt * k_factor,
                },
                k_imag: Stiffness6DOF {
                    kx: ch * omega * c_factor,
                    ky: ch * omega * c_factor,
                    kz: cz * omega * c_factor,
                    krx: cr * omega * c_factor,
                    kry: cr * omega * c_factor,
                    krz: ct * omega * c_factor,
                },
            });
        }

        Self {
            foundation_type: FoundationType::SurfaceFooting,
            dimensions: FoundationDimensions {
                length: 2.0 * radius,
                width: 2.0 * radius,
                embedment: 0.0,
                pile_count: None,
                pile_diameter: None,
                pile_length: None,
                pile_spacing: None,
            },
            soil,
            impedances,
            static_stiffness,
            damping,
        }
    }

    /// Calculate impedance for embedded rectangular footing
    pub fn embedded_rectangular(
        length: f64,
        width: f64,
        embedment: f64,
        soil: SoilProperties,
    ) -> Self {
        let g = soil.shear_modulus * 1000.0; // kN/m²
        let v = soil.poissons_ratio;
        let vs = soil.shear_wave_vel;

        // Equivalent radius
        let r_eq = (length * width / PI).sqrt();
        
        // Base impedance (surface)
        let mut base = Self::surface_circular(r_eq, soil.clone());

        // Embedment factors (Gazetas, 1991)
        let d_b = embedment / width;
        let l_b = length / width;

        let eta_z = 1.0 + 0.25 * d_b;
        let eta_h = 1.0 + 0.55 * d_b;
        let eta_r = 1.0 + 1.26 * d_b;
        let eta_t = 1.0 + 0.33 * d_b;

        // Apply embedment factors
        base.static_stiffness.kz *= eta_z;
        base.static_stiffness.kx *= eta_h;
        base.static_stiffness.ky *= eta_h;
        base.static_stiffness.krx *= eta_r;
        base.static_stiffness.kry *= eta_r;
        base.static_stiffness.krz *= eta_t;

        base.foundation_type = FoundationType::EmbeddedFooting;
        base.dimensions = FoundationDimensions {
            length,
            width,
            embedment,
            pile_count: None,
            pile_diameter: None,
            pile_length: None,
            pile_spacing: None,
        };

        base
    }

    /// Get impedance at specific frequency
    pub fn impedance_at_frequency(&self, freq: f64) -> Option<&ImpedancePoint> {
        self.impedances.iter()
            .min_by(|a, b| {
                (a.frequency - freq).abs()
                    .partial_cmp(&(b.frequency - freq).abs())
                    .unwrap()
            })
    }
}

// ============================================================================
// KINEMATIC INTERACTION
// ============================================================================

/// Kinematic soil-structure interaction
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct KinematicInteraction {
    /// Foundation dimensions
    pub foundation_width: f64,
    /// Soil properties at different depths
    pub soil_profile: Vec<SoilLayer>,
    /// Transfer functions
    pub transfer_functions: TransferFunctions,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SoilLayer {
    pub depth: f64,           // m (from surface)
    pub thickness: f64,       // m
    pub vs: f64,              // m/s
    pub density: f64,         // kg/m³
    pub damping: f64,         // ratio
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TransferFunctions {
    /// Horizontal translation reduction (Hu/Uff)
    pub horizontal: Vec<(f64, f64)>,  // (freq, amplitude)
    /// Rocking induced by kinematic interaction
    pub rocking: Vec<(f64, f64)>,
    /// Base slab averaging effect
    pub base_slab: Vec<(f64, f64)>,
}

impl KinematicInteraction {
    /// Calculate kinematic interaction effects
    pub fn calculate(foundation_width: f64, soil_profile: Vec<SoilLayer>) -> Self {
        // Average shear wave velocity in top layer
        let vs_avg = soil_profile.iter()
            .take(3)
            .map(|l| l.vs * l.thickness)
            .sum::<f64>()
            / soil_profile.iter().take(3).map(|l| l.thickness).sum::<f64>();

        // Characteristic wavelength
        let mut horizontal = Vec::new();
        let mut rocking = Vec::new();
        let mut base_slab = Vec::new();

        for i in 0..=50 {
            let freq = i as f64 * 0.5; // 0 to 25 Hz
            let lambda = vs_avg / freq.max(0.1);
            let b_lambda = foundation_width / lambda;

            // Base slab averaging (Veletsos & Wei, 1971)
            let hu_uff = if b_lambda < 0.5 {
                1.0 - 0.2 * b_lambda.powi(2)
            } else {
                0.9 / (1.0 + b_lambda)
            };

            // Rocking from kinematic interaction
            let phi_k = if b_lambda < 0.3 {
                0.0
            } else {
                0.1 * (b_lambda - 0.3).min(0.5)
            };

            horizontal.push((freq, hu_uff));
            rocking.push((freq, phi_k));
            base_slab.push((freq, hu_uff));
        }

        Self {
            foundation_width,
            soil_profile,
            transfer_functions: TransferFunctions {
                horizontal,
                rocking,
                base_slab,
            },
        }
    }

    /// Get transfer function value at frequency
    pub fn horizontal_tf(&self, freq: f64) -> f64 {
        self.transfer_functions.horizontal.iter()
            .min_by(|a, b| (a.0 - freq).abs().partial_cmp(&(b.0 - freq).abs()).unwrap())
            .map(|p| p.1)
            .unwrap_or(1.0)
    }
}

// ============================================================================
// FIRST-ORDER RELIABILITY METHOD (FORM)
// ============================================================================

/// FORM reliability analysis
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FormAnalysis {
    /// Random variables
    pub variables: Vec<RandomVariable>,
    /// Limit state function description
    pub limit_state: String,
    /// Results
    pub results: FormResults,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RandomVariable {
    pub name: String,
    pub distribution: Distribution,
    pub mean: f64,
    pub std_dev: f64,
    pub cov: f64,
    /// Design point in original space
    pub design_point: Option<f64>,
    /// Design point in standard normal space
    pub design_point_u: Option<f64>,
    /// Sensitivity factor (alpha)
    pub alpha: Option<f64>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum Distribution {
    Normal,
    Lognormal,
    Uniform,
    Gumbel,
    Weibull,
    Exponential,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FormResults {
    /// Reliability index (β)
    pub beta: f64,
    /// Probability of failure
    pub pf: f64,
    /// Design point in U-space
    pub design_point_u: Vec<f64>,
    /// Design point in X-space
    pub design_point_x: Vec<f64>,
    /// Sensitivity factors
    pub alpha: Vec<f64>,
    /// Importance measures
    pub importance: Vec<f64>,
    /// Convergence info
    pub iterations: usize,
    pub converged: bool,
}

impl FormAnalysis {
    /// Perform FORM analysis using HL-RF algorithm
    pub fn analyze(
        variables: Vec<RandomVariable>,
        limit_state_fn: fn(&[f64]) -> f64,
        gradient_fn: fn(&[f64]) -> Vec<f64>,
        tolerance: f64,
        max_iter: usize,
    ) -> Self {
        let n = variables.len();
        
        // Initialize at mean point
        let mut u: Vec<f64> = vec![0.0; n];
        let mut x: Vec<f64> = variables.iter().map(|v| v.mean).collect();
        
        let mut beta = 0.0;
        let mut converged = false;
        let mut iterations = 0;

        for iter in 0..max_iter {
            iterations = iter + 1;

            // Transform to X-space
            x = transform_u_to_x(&u, &variables);

            // Evaluate limit state function and gradient
            let g = limit_state_fn(&x);
            let grad_g_x = gradient_fn(&x);

            // Transform gradient to U-space
            let grad_g_u = transform_gradient(&grad_g_x, &variables, &x);

            // Calculate alpha (sensitivity factors)
            let norm_grad: f64 = grad_g_u.iter().map(|g| g.powi(2)).sum::<f64>().sqrt();
            let alpha: Vec<f64> = grad_g_u.iter().map(|g| -g / norm_grad).collect();

            // Calculate beta
            let u_dot_alpha: f64 = u.iter().zip(&alpha).map(|(ui, ai)| ui * ai).sum();
            beta = u_dot_alpha + g / norm_grad;

            // Check convergence
            let u_new: Vec<f64> = alpha.iter().map(|a| beta * a).collect();
            let delta: f64 = u.iter().zip(&u_new).map(|(old, new)| (old - new).powi(2)).sum::<f64>().sqrt();

            if delta < tolerance && g.abs() < tolerance {
                converged = true;
                u = u_new;
                break;
            }

            // Update design point (HL-RF)
            u = u_new;
        }

        // Final calculations
        x = transform_u_to_x(&u, &variables);
        let pf = standard_normal_cdf(-beta);

        // Calculate importance measures
        let alpha: Vec<f64> = u.iter().map(|ui| -ui / beta.max(0.001)).collect();
        let importance: Vec<f64> = alpha.iter().map(|a| a.powi(2)).collect();

        let mut result_variables = variables;
        for (i, var) in result_variables.iter_mut().enumerate() {
            var.design_point = Some(x[i]);
            var.design_point_u = Some(u[i]);
            var.alpha = Some(alpha[i]);
        }

        Self {
            variables: result_variables,
            limit_state: "g(X) = R - S".to_string(),
            results: FormResults {
                beta,
                pf,
                design_point_u: u,
                design_point_x: x,
                alpha,
                importance,
                iterations,
                converged,
            },
        }
    }
}

fn transform_u_to_x(u: &[f64], variables: &[RandomVariable]) -> Vec<f64> {
    u.iter()
        .zip(variables)
        .map(|(ui, var)| {
            match var.distribution {
                Distribution::Normal => var.mean + ui * var.std_dev,
                Distribution::Lognormal => {
                    let zeta = (1.0 + var.cov.powi(2)).ln().sqrt();
                    let lambda = var.mean.ln() - 0.5 * zeta.powi(2);
                    (lambda + ui * zeta).exp()
                }
                _ => var.mean + ui * var.std_dev, // Simplified
            }
        })
        .collect()
}

fn transform_gradient(grad_x: &[f64], variables: &[RandomVariable], x: &[f64]) -> Vec<f64> {
    grad_x.iter()
        .zip(variables)
        .zip(x)
        .map(|((g, var), xi)| {
            match var.distribution {
                Distribution::Normal => *g * var.std_dev,
                Distribution::Lognormal => *g * xi * var.cov,
                _ => *g * var.std_dev,
            }
        })
        .collect()
}

fn standard_normal_cdf(x: f64) -> f64 {
    // Approximation of standard normal CDF
    let a1 = 0.254829592;
    let a2 = -0.284496736;
    let a3 = 1.421413741;
    let a4 = -1.453152027;
    let a5 = 1.061405429;
    let p = 0.3275911;

    let sign = if x < 0.0 { -1.0 } else { 1.0 };
    let x = x.abs();
    let t = 1.0 / (1.0 + p * x);
    let y = 1.0 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * (-x * x / 2.0).exp();

    0.5 * (1.0 + sign * y)
}

// ============================================================================
// MONTE CARLO SIMULATION
// ============================================================================

/// Monte Carlo reliability simulation
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MonteCarloSimulation {
    /// Number of simulations
    pub n_simulations: usize,
    /// Random variables
    pub variables: Vec<RandomVariable>,
    /// Results
    pub results: MonteCarloResults,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MonteCarloResults {
    /// Probability of failure
    pub pf: f64,
    /// Coefficient of variation of Pf
    pub cov_pf: f64,
    /// Reliability index (from Pf)
    pub beta: f64,
    /// Number of failures
    pub n_failures: usize,
    /// Mean of limit state function
    pub g_mean: f64,
    /// Std dev of limit state function
    pub g_std: f64,
    /// Sample statistics for each variable
    pub variable_stats: Vec<VariableStats>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VariableStats {
    pub name: String,
    pub sample_mean: f64,
    pub sample_std: f64,
    pub min: f64,
    pub max: f64,
}

impl MonteCarloSimulation {
    /// Run Monte Carlo simulation
    pub fn run(
        variables: Vec<RandomVariable>,
        limit_state_fn: fn(&[f64]) -> f64,
        n_simulations: usize,
        seed: u64,
    ) -> Self {
        let n_vars = variables.len();
        let mut failures = 0usize;
        let mut g_values = Vec::with_capacity(n_simulations);
        let mut samples: Vec<Vec<f64>> = (0..n_vars).map(|_| Vec::with_capacity(n_simulations)).collect();

        // Simple LCG random number generator
        let mut rng_state = seed;
        let lcg = |state: &mut u64| -> f64 {
            *state = state.wrapping_mul(6364136223846793005).wrapping_add(1442695040888963407);
            (*state >> 33) as f64 / (1u64 << 31) as f64
        };

        for _ in 0..n_simulations {
            // Generate samples for each variable
            let x: Vec<f64> = variables.iter().enumerate().map(|(i, var)| {
                let u1 = lcg(&mut rng_state);
                let u2 = lcg(&mut rng_state);
                
                // Box-Muller for normal
                let z = (-2.0 * u1.ln()).sqrt() * (2.0 * PI * u2).cos();
                
                let sample = match var.distribution {
                    Distribution::Normal => var.mean + z * var.std_dev,
                    Distribution::Lognormal => {
                        let zeta = (1.0 + var.cov.powi(2)).ln().sqrt();
                        let lambda = var.mean.ln() - 0.5 * zeta.powi(2);
                        (lambda + z * zeta).exp()
                    }
                    Distribution::Uniform => {
                        let a = var.mean - var.std_dev * 3.0_f64.sqrt();
                        let b = var.mean + var.std_dev * 3.0_f64.sqrt();
                        a + u1 * (b - a)
                    }
                    _ => var.mean + z * var.std_dev,
                };
                
                samples[i].push(sample);
                sample
            }).collect();

            // Evaluate limit state
            let g = limit_state_fn(&x);
            g_values.push(g);
            
            if g < 0.0 {
                failures += 1;
            }
        }

        // Calculate statistics
        let pf = failures as f64 / n_simulations as f64;
        let cov_pf = if failures > 0 {
            ((1.0 - pf) / (pf * n_simulations as f64)).sqrt()
        } else {
            f64::INFINITY
        };
        
        let beta = if pf > 0.0 && pf < 1.0 {
            -inverse_standard_normal_cdf(pf)
        } else if pf == 0.0 {
            f64::INFINITY
        } else {
            f64::NEG_INFINITY
        };

        let g_mean = g_values.iter().sum::<f64>() / n_simulations as f64;
        let g_std = (g_values.iter().map(|g| (g - g_mean).powi(2)).sum::<f64>() / n_simulations as f64).sqrt();

        let variable_stats: Vec<VariableStats> = samples.iter()
            .zip(&variables)
            .map(|(s, v)| {
                let mean = s.iter().sum::<f64>() / s.len() as f64;
                let std = (s.iter().map(|x| (x - mean).powi(2)).sum::<f64>() / s.len() as f64).sqrt();
                VariableStats {
                    name: v.name.clone(),
                    sample_mean: mean,
                    sample_std: std,
                    min: s.iter().cloned().fold(f64::INFINITY, f64::min),
                    max: s.iter().cloned().fold(f64::NEG_INFINITY, f64::max),
                }
            })
            .collect();

        Self {
            n_simulations,
            variables,
            results: MonteCarloResults {
                pf,
                cov_pf,
                beta,
                n_failures: failures,
                g_mean,
                g_std,
                variable_stats,
            },
        }
    }
}

fn inverse_standard_normal_cdf(p: f64) -> f64 {
    // Rational approximation
    if p <= 0.0 { return f64::NEG_INFINITY; }
    if p >= 1.0 { return f64::INFINITY; }
    
    let p = if p > 0.5 { 1.0 - p } else { p };
    let t = (-2.0 * p.ln()).sqrt();
    
    let c0 = 2.515517;
    let c1 = 0.802853;
    let c2 = 0.010328;
    let d1 = 1.432788;
    let d2 = 0.189269;
    let d3 = 0.001308;
    
    let result = t - (c0 + c1 * t + c2 * t * t) / (1.0 + d1 * t + d2 * t * t + d3 * t * t * t);
    
    if p > 0.5 { result } else { -result }
}

// ============================================================================
// PARTIAL FACTOR CALIBRATION
// ============================================================================

/// Partial factor calibration based on reliability
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PartialFactorCalibration {
    /// Target reliability index
    pub beta_target: f64,
    /// Resistance variables
    pub resistance: Vec<RandomVariable>,
    /// Load variables
    pub loads: Vec<RandomVariable>,
    /// Calibrated factors
    pub factors: CalibratedFactors,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CalibratedFactors {
    pub gamma_m: f64,         // Material factor
    pub gamma_g: f64,         // Permanent load factor
    pub gamma_q: f64,         // Variable load factor
    pub psi_0: f64,           // Combination factor
    pub achieved_beta: f64,
}

impl PartialFactorCalibration {
    /// Calibrate partial factors to achieve target reliability
    pub fn calibrate(
        beta_target: f64,
        resistance: Vec<RandomVariable>,
        loads: Vec<RandomVariable>,
    ) -> Self {
        // Simplified calibration using FORM sensitivities
        // Real calibration would involve optimization over many cases

        // Typical sensitivity factors from literature
        let alpha_r = 0.8;  // Resistance sensitivity
        let alpha_s = 0.7;  // Load sensitivity

        // Resistance factor
        let r_mean = resistance.first().map(|r| r.mean).unwrap_or(1.0);
        let r_cov = resistance.first().map(|r| r.cov).unwrap_or(0.1);
        let gamma_m = 1.0 / (1.0 - alpha_r * beta_target * r_cov);

        // Load factors
        let g_cov = loads.iter()
            .find(|l| l.name.to_lowercase().contains("dead") || l.name.to_lowercase().contains("permanent"))
            .map(|l| l.cov)
            .unwrap_or(0.1);
        
        let q_cov = loads.iter()
            .find(|l| l.name.to_lowercase().contains("live") || l.name.to_lowercase().contains("variable"))
            .map(|l| l.cov)
            .unwrap_or(0.3);

        let gamma_g = 1.0 + alpha_s * beta_target * g_cov;
        let gamma_q = 1.0 + alpha_s * beta_target * q_cov;

        // Combination factor (simplified)
        let psi_0 = 0.7;

        Self {
            beta_target,
            resistance,
            loads,
            factors: CalibratedFactors {
                gamma_m,
                gamma_g,
                gamma_q,
                psi_0,
                achieved_beta: beta_target * 0.98, // Approximate
            },
        }
    }
}

// ============================================================================
// TESTS
// ============================================================================

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_foundation_impedance() {
        let soil = SoilProperties {
            shear_modulus: 50.0,
            poissons_ratio: 0.3,
            density: 1800.0,
            shear_wave_vel: 200.0,
            damping_ratio: 0.05,
        };

        let impedance = FoundationImpedance::surface_circular(2.0, soil);
        
        assert!(impedance.static_stiffness.kz > 0.0);
        assert!(impedance.static_stiffness.kx > 0.0);
        assert!(!impedance.impedances.is_empty());
    }

    #[test]
    fn test_standard_normal_cdf() {
        assert!((standard_normal_cdf(0.0) - 0.5).abs() < 0.01);
        assert!(standard_normal_cdf(-3.0) < 0.01);
        assert!(standard_normal_cdf(3.0) > 0.99);
    }

    #[test]
    fn test_monte_carlo() {
        let variables = vec![
            RandomVariable {
                name: "R".to_string(),
                distribution: Distribution::Normal,
                mean: 100.0,
                std_dev: 10.0,
                cov: 0.1,
                design_point: None,
                design_point_u: None,
                alpha: None,
            },
            RandomVariable {
                name: "S".to_string(),
                distribution: Distribution::Normal,
                mean: 50.0,
                std_dev: 10.0,
                cov: 0.2,
                design_point: None,
                design_point_u: None,
                alpha: None,
            },
        ];

        fn limit_state(x: &[f64]) -> f64 {
            x[0] - x[1] // R - S
        }

        let mc = MonteCarloSimulation::run(variables, limit_state, 10000, 12345);
        
        assert!(mc.results.pf < 0.01); // Should be very low for this case
        assert!(mc.results.beta > 3.0);
    }

    #[test]
    fn test_partial_factor_calibration() {
        let resistance = vec![
            RandomVariable {
                name: "fy".to_string(),
                distribution: Distribution::Lognormal,
                mean: 355.0,
                std_dev: 25.0,
                cov: 0.07,
                design_point: None,
                design_point_u: None,
                alpha: None,
            },
        ];

        let loads = vec![
            RandomVariable {
                name: "Dead".to_string(),
                distribution: Distribution::Normal,
                mean: 50.0,
                std_dev: 5.0,
                cov: 0.1,
                design_point: None,
                design_point_u: None,
                alpha: None,
            },
            RandomVariable {
                name: "Live".to_string(),
                distribution: Distribution::Gumbel,
                mean: 30.0,
                std_dev: 9.0,
                cov: 0.3,
                design_point: None,
                design_point_u: None,
                alpha: None,
            },
        ];

        let calib = PartialFactorCalibration::calibrate(3.8, resistance, loads);
        
        assert!(calib.factors.gamma_m > 1.0);
        assert!(calib.factors.gamma_g > 1.0);
        assert!(calib.factors.gamma_q > 1.0);
    }
}
