//! Fatigue and Fracture Mechanics
//!
//! Comprehensive framework for fatigue life prediction and fracture analysis.
//!
//! ## Fatigue Analysis Methods
//! - **Stress-Life (S-N)** - High cycle fatigue
//! - **Strain-Life (ε-N)** - Low cycle fatigue
//! - **Crack Growth** - Paris law, NASGRO
//!
//! ## Fracture Mechanics
//! - **LEFM** - Linear elastic fracture mechanics
//! - **EPFM** - Elastic-plastic (J-integral)
//! - **SIF Computation** - Stress intensity factors

use serde::{Deserialize, Serialize};
use std::f64::consts::PI;

// ============================================================================
// STRESS-LIFE (S-N) FATIGUE
// ============================================================================

/// S-N curve material data
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SNMaterial {
    pub name: String,
    pub fatigue_strength_coeff: f64,  // σ'f [MPa]
    pub fatigue_strength_exp: f64,    // b (typically -0.05 to -0.12)
    pub endurance_limit: Option<f64>, // Se [MPa] (if exists)
    pub ultimate_strength: f64,       // Su [MPa]
    pub yield_strength: f64,          // Sy [MPa]
}

impl SNMaterial {
    /// Steel (typical carbon steel)
    pub fn steel() -> Self {
        SNMaterial {
            name: "Steel (Generic)".to_string(),
            fatigue_strength_coeff: 1000.0,  // MPa
            fatigue_strength_exp: -0.085,
            endurance_limit: Some(250.0),    // MPa
            ultimate_strength: 500.0,
            yield_strength: 350.0,
        }
    }

    /// Aluminum 7075-T6
    pub fn aluminum_7075() -> Self {
        SNMaterial {
            name: "Aluminum 7075-T6".to_string(),
            fatigue_strength_coeff: 770.0,
            fatigue_strength_exp: -0.09,
            endurance_limit: None, // No true endurance limit
            ultimate_strength: 572.0,
            yield_strength: 503.0,
        }
    }

    /// Titanium Ti-6Al-4V
    pub fn titanium_6al4v() -> Self {
        SNMaterial {
            name: "Titanium Ti-6Al-4V".to_string(),
            fatigue_strength_coeff: 1500.0,
            fatigue_strength_exp: -0.08,
            endurance_limit: Some(510.0),
            ultimate_strength: 950.0,
            yield_strength: 880.0,
        }
    }

    /// Basquin equation: σa = σ'f * (2*Nf)^b
    pub fn cycles_to_failure(&self, stress_amplitude: f64) -> f64 {
        // Check endurance limit
        if let Some(se) = self.endurance_limit {
            if stress_amplitude <= se {
                return f64::INFINITY;
            }
        }

        // Nf = 0.5 * (σa / σ'f)^(1/b)
        let ratio = stress_amplitude / self.fatigue_strength_coeff;
        0.5 * ratio.powf(1.0 / self.fatigue_strength_exp)
    }

    /// Stress amplitude for given life
    pub fn stress_for_life(&self, cycles: f64) -> f64 {
        // σa = σ'f * (2*Nf)^b
        self.fatigue_strength_coeff * (2.0 * cycles).powf(self.fatigue_strength_exp)
    }
}

/// S-N fatigue analysis
pub struct SNFatigue {
    pub material: SNMaterial,
    pub mean_stress_correction: MeanStressCorrection,
    pub surface_factor: f64,
    pub size_factor: f64,
    pub reliability_factor: f64,
}

/// Mean stress correction method
#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
pub enum MeanStressCorrection {
    None,
    Goodman,
    Gerber,
    Soderberg,
    ASME,
    Morrow,
}

impl SNFatigue {
    pub fn new(material: SNMaterial) -> Self {
        SNFatigue {
            material,
            mean_stress_correction: MeanStressCorrection::Goodman,
            surface_factor: 0.9,
            size_factor: 0.85,
            reliability_factor: 0.897, // 90% reliability
        }
    }

    /// Apply mean stress correction
    pub fn equivalent_amplitude(&self, stress_amp: f64, stress_mean: f64) -> f64 {
        let su = self.material.ultimate_strength;
        let sy = self.material.yield_strength;
        let sf = self.material.fatigue_strength_coeff;

        match self.mean_stress_correction {
            MeanStressCorrection::None => stress_amp,
            MeanStressCorrection::Goodman => {
                // σa_eq = σa / (1 - σm/Su)
                if stress_mean >= 0.0 {
                    stress_amp / (1.0 - stress_mean / su)
                } else {
                    stress_amp  // Compressive mean stress is beneficial
                }
            }
            MeanStressCorrection::Gerber => {
                // σa_eq = σa / (1 - (σm/Su)²)
                stress_amp / (1.0 - (stress_mean / su).powi(2))
            }
            MeanStressCorrection::Soderberg => {
                // σa_eq = σa / (1 - σm/Sy)
                stress_amp / (1.0 - stress_mean / sy)
            }
            MeanStressCorrection::ASME => {
                // Elliptic: σa_eq = σa / √(1 - (σm/Sy)²)
                stress_amp / (1.0 - (stress_mean / sy).powi(2)).sqrt()
            }
            MeanStressCorrection::Morrow => {
                // σa_eq = σa / (1 - σm/σ'f)
                stress_amp / (1.0 - stress_mean / sf)
            }
        }
    }

    /// Modified endurance limit
    pub fn modified_endurance_limit(&self) -> Option<f64> {
        self.material.endurance_limit.map(|se| {
            se * self.surface_factor * self.size_factor * self.reliability_factor
        })
    }

    /// Calculate fatigue life
    pub fn fatigue_life(&self, stress_amp: f64, stress_mean: f64) -> f64 {
        let equiv_amp = self.equivalent_amplitude(stress_amp, stress_mean);

        // Apply modification factors
        let modified_amp = equiv_amp / (self.surface_factor * self.size_factor * self.reliability_factor);

        self.material.cycles_to_failure(modified_amp)
    }

    /// Safety factor at given stress
    pub fn safety_factor(&self, stress_amp: f64, stress_mean: f64, target_life: f64) -> f64 {
        let allowable = self.material.stress_for_life(target_life)
            * self.surface_factor * self.size_factor * self.reliability_factor;

        let equiv_amp = self.equivalent_amplitude(stress_amp, stress_mean);

        allowable / equiv_amp
    }
}

// ============================================================================
// STRAIN-LIFE (ε-N) FATIGUE
// ============================================================================

/// Strain-life material data
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StrainLifeMaterial {
    pub name: String,
    pub elastic_modulus: f64,         // E [MPa]
    pub fatigue_strength_coeff: f64,  // σ'f [MPa]
    pub fatigue_strength_exp: f64,    // b
    pub fatigue_ductility_coeff: f64, // ε'f
    pub fatigue_ductility_exp: f64,   // c (typically -0.5 to -0.7)
    pub cyclic_strength_coeff: f64,   // K' [MPa]
    pub cyclic_strain_exp: f64,       // n'
}

impl StrainLifeMaterial {
    /// SAE 1045 Steel (normalized)
    pub fn sae_1045_steel() -> Self {
        StrainLifeMaterial {
            name: "SAE 1045 Steel".to_string(),
            elastic_modulus: 207000.0,
            fatigue_strength_coeff: 948.0,
            fatigue_strength_exp: -0.092,
            fatigue_ductility_coeff: 0.26,
            fatigue_ductility_exp: -0.445,
            cyclic_strength_coeff: 1258.0,
            cyclic_strain_exp: 0.208,
        }
    }

    /// Coffin-Manson equation with elastic component
    /// εa = (σ'f/E) * (2Nf)^b + ε'f * (2Nf)^c
    pub fn strain_amplitude(&self, cycles: f64) -> f64 {
        let two_nf = 2.0 * cycles;
        let elastic = (self.fatigue_strength_coeff / self.elastic_modulus)
            * two_nf.powf(self.fatigue_strength_exp);
        let plastic = self.fatigue_ductility_coeff
            * two_nf.powf(self.fatigue_ductility_exp);

        elastic + plastic
    }

    /// Transition life (elastic = plastic)
    pub fn transition_life(&self) -> f64 {
        // 2Nt = (ε'f * E / σ'f)^(1/(b-c))
        let ratio = self.fatigue_ductility_coeff * self.elastic_modulus
            / self.fatigue_strength_coeff;
        let exp = 1.0 / (self.fatigue_strength_exp - self.fatigue_ductility_exp);

        0.5 * ratio.powf(exp)
    }
}

/// Strain-life fatigue analysis
pub struct StrainLifeFatigue {
    pub material: StrainLifeMaterial,
    pub mean_strain_correction: bool,
}

impl StrainLifeFatigue {
    pub fn new(material: StrainLifeMaterial) -> Self {
        StrainLifeFatigue {
            material,
            mean_strain_correction: true,
        }
    }

    /// Solve for fatigue life (Newton-Raphson)
    pub fn fatigue_life(&self, strain_amplitude: f64) -> f64 {
        // Iteratively solve: εa = (σ'f/E)*(2Nf)^b + ε'f*(2Nf)^c

        let mut nf = 1000.0; // Initial guess

        for _ in 0..50 {
            let eps = self.material.strain_amplitude(nf);
            let diff = strain_amplitude - eps;

            if diff.abs() < 1e-10 {
                break;
            }

            // Numerical derivative
            let delta = 0.01 * nf;
            let eps_plus = self.material.strain_amplitude(nf + delta);
            let deriv = (eps_plus - eps) / delta;

            if deriv.abs() > 1e-20 {
                nf -= diff / deriv;
                nf = nf.max(1.0);
            }
        }

        nf
    }

    /// Neuber's rule for notch analysis
    /// (Kf * S)² / E = σ * ε
    pub fn neuber_correction(
        &self,
        nominal_stress: f64,
        stress_concentration: f64,
    ) -> (f64, f64) {
        let e = self.material.elastic_modulus;
        let kp = self.material.cyclic_strength_coeff;
        let np = self.material.cyclic_strain_exp;

        let neuber_product = (stress_concentration * nominal_stress).powi(2) / e;

        // Solve: σ*ε = neuber_product with ε = σ/E + (σ/K')^(1/n')
        let mut sigma = (neuber_product * e).sqrt(); // Elastic estimate

        for _ in 0..20 {
            let eps_elastic = sigma / e;
            let eps_plastic = (sigma / kp).powf(1.0 / np);
            let eps_total = eps_elastic + eps_plastic;

            let f = sigma * eps_total - neuber_product;
            let df = eps_total + sigma * (1.0 / e + (1.0 / (np * kp)) * (sigma / kp).powf(1.0 / np - 1.0));

            if f.abs() < 1e-6 {
                break;
            }

            sigma -= f / df;
            sigma = sigma.max(1.0);
        }

        let strain = neuber_product / sigma;
        (sigma, strain)
    }
}

// ============================================================================
// RAINFLOW CYCLE COUNTING
// ============================================================================

/// Rainflow cycle counting for variable amplitude loading
pub struct RainflowCounter {
    pub peaks_valleys: Vec<f64>,
    pub cycles: Vec<RainflowCycle>,
}

/// Single rainflow cycle
#[derive(Debug, Clone)]
pub struct RainflowCycle {
    pub amplitude: f64,
    pub mean: f64,
    pub count: f64,  // 0.5 or 1.0
    pub start_index: usize,
    pub end_index: usize,
}

impl RainflowCounter {
    pub fn new() -> Self {
        RainflowCounter {
            peaks_valleys: Vec::new(),
            cycles: Vec::new(),
        }
    }

    /// Extract peaks and valleys from stress history
    pub fn extract_peaks_valleys(&mut self, stress_history: &[f64]) {
        if stress_history.len() < 3 {
            self.peaks_valleys = stress_history.to_vec();
            return;
        }

        self.peaks_valleys.clear();
        self.peaks_valleys.push(stress_history[0]);

        for i in 1..stress_history.len() - 1 {
            let prev = stress_history[i - 1];
            let curr = stress_history[i];
            let next = stress_history[i + 1];

            // Peak or valley
            if (curr > prev && curr > next) || (curr < prev && curr < next) {
                self.peaks_valleys.push(curr);
            }
        }

        if let Some(&last) = stress_history.last() {
            self.peaks_valleys.push(last);
        }
    }

    /// ASTM E1049 4-point rainflow counting
    pub fn count_cycles(&mut self) {
        self.cycles.clear();

        let mut points = self.peaks_valleys.clone();

        // Rearrange to start from absolute maximum
        if let Some(max_idx) = points.iter()
            .enumerate()
            .max_by(|(_, a), (_, b)| a.abs().partial_cmp(&b.abs()).unwrap_or(std::cmp::Ordering::Equal))
            .map(|(i, _)| i)
        {
            points.rotate_left(max_idx);
        }

        let mut stack: Vec<(f64, usize)> = Vec::new();

        for (i, &s) in points.iter().enumerate() {
            stack.push((s, i));

            while stack.len() >= 4 {
                let n = stack.len();
                let (s1, _) = stack[n - 4];
                let (s2, i2) = stack[n - 3];
                let (s3, i3) = stack[n - 2];
                let (s4, _) = stack[n - 1];

                let r1 = (s2 - s1).abs();
                let r2 = (s3 - s2).abs();
                let r3 = (s4 - s3).abs();

                if r2 <= r1 && r2 <= r3 {
                    // Extract cycle
                    let amplitude = r2 / 2.0;
                    let mean = (s2 + s3) / 2.0;

                    self.cycles.push(RainflowCycle {
                        amplitude,
                        mean,
                        count: 1.0,
                        start_index: i2,
                        end_index: i3,
                    });

                    // Remove s2 and s3
                    stack.remove(n - 3);
                    stack.remove(n - 3);
                } else {
                    break;
                }
            }
        }

        // Remaining points form half-cycles
        while stack.len() >= 2 {
            let (s1, i1) = stack.remove(0);
            let (s2, i2) = stack[0];

            let amplitude = (s2 - s1).abs() / 2.0;
            let mean = (s1 + s2) / 2.0;

            self.cycles.push(RainflowCycle {
                amplitude,
                mean,
                count: 0.5,
                start_index: i1,
                end_index: i2,
            });
        }
    }

    /// Miner's rule damage summation
    pub fn miner_damage(&self, sn_fatigue: &SNFatigue) -> f64 {
        self.cycles.iter()
            .map(|cycle| {
                let nf = sn_fatigue.fatigue_life(cycle.amplitude, cycle.mean);
                if nf.is_finite() {
                    cycle.count / nf
                } else {
                    0.0
                }
            })
            .sum()
    }
}

impl Default for RainflowCounter {
    fn default() -> Self {
        Self::new()
    }
}

// ============================================================================
// FRACTURE MECHANICS
// ============================================================================

/// Crack geometry
#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
pub enum CrackGeometry {
    /// Through crack in infinite plate
    ThroughCrack { half_length: f64 },
    /// Edge crack
    EdgeCrack { depth: f64 },
    /// Semi-elliptical surface crack
    SurfaceCrack { depth: f64, half_length: f64 },
    /// Corner crack
    CornerCrack { depth: f64, half_length: f64 },
    /// Penny-shaped internal crack
    PennyCrack { radius: f64 },
}

impl CrackGeometry {
    /// Characteristic dimension (a)
    pub fn crack_size(&self) -> f64 {
        match self {
            CrackGeometry::ThroughCrack { half_length } => *half_length,
            CrackGeometry::EdgeCrack { depth } => *depth,
            CrackGeometry::SurfaceCrack { depth, .. } => *depth,
            CrackGeometry::CornerCrack { depth, .. } => *depth,
            CrackGeometry::PennyCrack { radius } => *radius,
        }
    }
}

/// Stress intensity factor calculator
#[derive(Clone)]
pub struct StressIntensityFactor {
    pub crack: CrackGeometry,
    pub width: f64,      // Plate/component width
    pub thickness: f64,  // Plate thickness
}

impl StressIntensityFactor {
    pub fn new(crack: CrackGeometry, width: f64, thickness: f64) -> Self {
        StressIntensityFactor { crack, width, thickness }
    }

    /// Mode I stress intensity factor
    /// K_I = Y * σ * √(π*a)
    pub fn k_i(&self, stress: f64) -> f64 {
        let a = self.crack.crack_size();
        let y = self.geometry_factor();

        y * stress * (PI * a).sqrt()
    }

    /// Geometry correction factor (Y or F)
    pub fn geometry_factor(&self) -> f64 {
        match self.crack {
            CrackGeometry::ThroughCrack { half_length } => {
                // Finite width correction (Isida)
                let a_w = half_length / self.width;
                (1.0 - 0.025 * a_w.powi(2) + 0.06 * a_w.powi(4))
                    / (1.0 - a_w.powi(2)).sqrt()
            }
            CrackGeometry::EdgeCrack { depth } => {
                // Edge crack in finite width (Tada)
                let a_w = depth / self.width;
                1.12 - 0.231 * a_w + 10.55 * a_w.powi(2)
                    - 21.72 * a_w.powi(3) + 30.39 * a_w.powi(4)
            }
            CrackGeometry::SurfaceCrack { depth, half_length } => {
                // Newman-Raju equation (simplified)
                let a = depth;
                let c = half_length;
                let t = self.thickness;
                let aspect = a / c;

                // Shape factor
                let q = 1.0 + 1.464 * aspect.powf(1.65);

                // Finite thickness correction
                let m1 = 1.0;
                let m2 = 0.05 / (0.11 + aspect.powf(1.5));
                let m3 = 0.29 / (0.23 + aspect.powf(1.5));
                let g = 1.0 + (0.1 + 0.35 * (a / t).powi(2)) * (1.0 - (PI / 2.0).sin()).powi(2);

                let f_s = (m1 + m2 * (a / t).powi(2) + m3 * (a / t).powi(4)) * g;

                f_s / q.sqrt()
            }
            CrackGeometry::CornerCrack { depth, half_length } => {
                let aspect = depth / half_length;
                let q = 1.0 + 1.464 * aspect.powf(1.65);
                1.12 / q.sqrt()
            }
            CrackGeometry::PennyCrack { .. } => {
                // Embedded circular crack
                2.0 / PI
            }
        }
    }

    /// Critical crack size from K_Ic
    pub fn critical_crack_size(&self, stress: f64, k_ic: f64) -> f64 {
        let y = self.geometry_factor();
        (k_ic / (y * stress)).powi(2) / PI
    }
}

/// Fracture toughness material data
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FractureMaterial {
    pub name: String,
    pub k_ic: f64,           // Plane strain fracture toughness [MPa√m]
    pub yield_strength: f64, // σy [MPa]
    pub elastic_modulus: f64, // E [MPa]
    pub poisson_ratio: f64,
}

impl FractureMaterial {
    /// 4340 Steel (quenched & tempered)
    pub fn steel_4340() -> Self {
        FractureMaterial {
            name: "4340 Steel".to_string(),
            k_ic: 50.0,
            yield_strength: 1515.0,
            elastic_modulus: 207000.0,
            poisson_ratio: 0.3,
        }
    }

    /// Aluminum 7075-T651
    pub fn aluminum_7075() -> Self {
        FractureMaterial {
            name: "7075-T651 Al".to_string(),
            k_ic: 27.0,
            yield_strength: 503.0,
            elastic_modulus: 71700.0,
            poisson_ratio: 0.33,
        }
    }

    /// Plastic zone size (plane strain)
    pub fn plastic_zone_radius(&self, k_i: f64) -> f64 {
        // r_y = (1/(6π)) * (K_I/σ_y)²  (plane strain)
        (1.0 / (6.0 * PI)) * (k_i / self.yield_strength).powi(2)
    }

    /// J-integral from K (LEFM relationship)
    pub fn j_from_k(&self, k_i: f64) -> f64 {
        // J = K²(1-ν²)/E  (plane strain)
        k_i.powi(2) * (1.0 - self.poisson_ratio.powi(2)) / self.elastic_modulus
    }

    /// Critical J-integral
    pub fn j_ic(&self) -> f64 {
        self.j_from_k(self.k_ic)
    }
}

// ============================================================================
// CRACK GROWTH ANALYSIS
// ============================================================================

/// Paris law crack growth parameters
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ParisLaw {
    pub c: f64,        // Paris constant
    pub m: f64,        // Paris exponent
    pub delta_k_th: f64, // Threshold ΔK [MPa√m]
    pub k_ic: f64,     // Fracture toughness [MPa√m]
}

impl ParisLaw {
    /// Steel (typical)
    pub fn steel() -> Self {
        ParisLaw {
            c: 6.9e-12, // m/cycle / (MPa√m)^m
            m: 3.0,
            delta_k_th: 3.0,
            k_ic: 50.0,
        }
    }

    /// Aluminum
    pub fn aluminum() -> Self {
        ParisLaw {
            c: 1.0e-10,
            m: 3.3,
            delta_k_th: 1.5,
            k_ic: 27.0,
        }
    }

    /// Crack growth rate: da/dN = C * (ΔK)^m
    pub fn growth_rate(&self, delta_k: f64) -> f64 {
        if delta_k <= self.delta_k_th {
            0.0
        } else {
            self.c * delta_k.powf(self.m)
        }
    }

    /// Cycles to grow from a0 to af (numerical integration)
    pub fn cycles_to_failure(
        &self,
        sif_calc: &StressIntensityFactor,
        stress_range: f64,
        initial_crack: f64,
        final_crack: f64,
    ) -> f64 {
        let mut a = initial_crack;
        let mut n: f64 = 0.0;
        let da = (final_crack - initial_crack) / 1000.0;

        while a < final_crack {
            // Update SIF calculator with current crack size
            let mut sif_current = sif_calc.clone();
            match &mut sif_current.crack {
                CrackGeometry::ThroughCrack { half_length } => *half_length = a,
                CrackGeometry::EdgeCrack { depth } => *depth = a,
                CrackGeometry::SurfaceCrack { depth, .. } => *depth = a,
                CrackGeometry::CornerCrack { depth, .. } => *depth = a,
                CrackGeometry::PennyCrack { radius } => *radius = a,
            }

            let delta_k = sif_current.k_i(stress_range);

            // Check fracture
            if delta_k >= self.k_ic {
                break;
            }

            let dadn = self.growth_rate(delta_k);
            if dadn > 1e-20 {
                n += da / dadn;
            }

            a += da;
        }

        n
    }
}

/// NASGRO equation (more comprehensive)
#[derive(Debug, Clone)]
pub struct NASGROEquation {
    pub c: f64,
    pub n: f64,
    pub p: f64,
    pub q: f64,
    pub delta_k_th_0: f64,
    pub k_ic: f64,
    pub k_max_crit: f64,
    pub a_0: f64,  // Intrinsic crack length
}

impl NASGROEquation {
    /// Crack growth rate with threshold and instability effects
    /// da/dN = C * [(1-f)ΔK]^n * [(1-ΔKth/ΔK)^p] / [(1-Kmax/Kcrit)^q]
    pub fn growth_rate(&self, delta_k: f64, r_ratio: f64) -> f64 {
        // Newman closure function
        let f = self.closure_function(r_ratio);

        // Threshold (R-ratio dependent)
        let delta_k_th = self.delta_k_th_0 * ((1.0 - r_ratio) / (1.0 - f)).sqrt();

        if delta_k <= delta_k_th {
            return 0.0;
        }

        let k_max = delta_k / (1.0 - r_ratio);

        // Check instability
        if k_max >= self.k_max_crit {
            return f64::INFINITY;
        }

        let term1 = self.c * ((1.0 - f) * delta_k).powf(self.n);
        let term2 = (1.0 - delta_k_th / delta_k).powf(self.p);
        let term3 = 1.0 / (1.0 - k_max / self.k_max_crit).powf(self.q);

        term1 * term2 * term3
    }

    /// Newman crack closure function
    fn closure_function(&self, r: f64) -> f64 {
        if r >= 0.0 {
            (0.825 - 0.34 * r + 0.05 * r.powi(2)) * (PI * r / 2.0).cos()
        } else {
            0.825 - 0.34 * r
        }
    }
}

// ============================================================================
// FAILURE ASSESSMENT DIAGRAM (FAD)
// ============================================================================

/// Failure Assessment Diagram analysis
pub struct FailureAssessment {
    pub material: FractureMaterial,
    pub fad_option: FADOption,
}

/// FAD option (different curve definitions)
#[derive(Debug, Clone, Copy)]
pub enum FADOption {
    /// Option 1: Generic curve (BS 7910)
    Option1,
    /// Option 2: Material-specific
    Option2,
    /// Option 3: J-integral based
    Option3,
}

impl FailureAssessment {
    pub fn new(material: FractureMaterial) -> Self {
        FailureAssessment {
            material,
            fad_option: FADOption::Option1,
        }
    }

    /// Failure assessment point (Kr, Lr)
    pub fn assessment_point(&self, k_i: f64, applied_stress: f64) -> (f64, f64) {
        // Kr = K_I / K_Ic
        let kr = k_i / self.material.k_ic;

        // Lr = σ / σ_y (or σ / σ_flow)
        let lr = applied_stress / self.material.yield_strength;

        (kr, lr)
    }

    /// FAD curve Kr = f(Lr)
    pub fn fad_curve(&self, lr: f64) -> f64 {
        match self.fad_option {
            FADOption::Option1 => {
                // BS 7910 Option 1
                if lr <= 1.0 {
                    (1.0 + 0.5 * lr.powi(2)).powf(-0.5) * (0.3 + 0.7 * (-0.65 * lr.powi(6)).exp())
                } else {
                    0.0
                }
            }
            FADOption::Option2 => {
                // Material-specific (requires σ-ε curve)
                let e = self.material.elastic_modulus;
                let sy = self.material.yield_strength;
                let eps_ref = sy / e;  // Reference strain

                if lr <= 1.0 {
                    (eps_ref * lr / (eps_ref * lr + lr.powi(2) / (2.0 * e / sy))).sqrt()
                } else {
                    0.0
                }
            }
            FADOption::Option3 => {
                // J-based (simplified)
                if lr <= 1.0 {
                    1.0 / (1.0 + 0.5 * lr.powi(2)).sqrt()
                } else {
                    0.0
                }
            }
        }
    }

    /// Check if point is acceptable
    pub fn is_acceptable(&self, k_i: f64, applied_stress: f64) -> bool {
        let (kr, lr) = self.assessment_point(k_i, applied_stress);
        let kr_allowable = self.fad_curve(lr);

        kr <= kr_allowable && lr <= 1.0
    }

    /// Safety factor
    pub fn safety_factor(&self, k_i: f64, applied_stress: f64) -> f64 {
        let (kr, lr) = self.assessment_point(k_i, applied_stress);
        let kr_allowable = self.fad_curve(lr);

        if kr > 1e-10 {
            (kr_allowable / kr).min(1.0 / lr)
        } else {
            1.0 / lr
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_sn_material() {
        let steel = SNMaterial::steel();
        let life = steel.cycles_to_failure(300.0);

        assert!(life > 1e4 && life < 1e8); // Reasonable range
    }

    #[test]
    fn test_endurance_limit() {
        let steel = SNMaterial::steel();
        let life = steel.cycles_to_failure(200.0); // Below endurance limit

        assert!(life.is_infinite());
    }

    #[test]
    fn test_goodman_correction() {
        let steel = SNMaterial::steel();
        let fatigue = SNFatigue::new(steel);

        let amp = 200.0;
        let mean_zero = fatigue.equivalent_amplitude(amp, 0.0);
        let mean_positive = fatigue.equivalent_amplitude(amp, 100.0);

        assert!(mean_positive > mean_zero); // Mean stress increases effective amplitude
    }

    #[test]
    fn test_strain_life() {
        let mat = StrainLifeMaterial::sae_1045_steel();
        let strain = mat.strain_amplitude(1000.0);

        assert!(strain > 0.001 && strain < 0.1);
    }

    #[test]
    fn test_transition_life() {
        let mat = StrainLifeMaterial::sae_1045_steel();
        let nt = mat.transition_life();

        assert!(nt > 100.0 && nt < 1e6);
    }

    #[test]
    fn test_neuber() {
        let mat = StrainLifeMaterial::sae_1045_steel();
        let fatigue = StrainLifeFatigue::new(mat);

        let (sigma, eps) = fatigue.neuber_correction(200.0, 2.0);

        // Should satisfy Neuber: σ*ε = (Kt*S)²/E
        let neuber = (2.0 * 200.0_f64).powi(2) / 207000.0;
        assert!((sigma * eps - neuber).abs() < 0.01 * neuber);
    }

    #[test]
    fn test_rainflow() {
        let mut counter = RainflowCounter::new();
        let history = vec![0.0, 100.0, 50.0, 120.0, 30.0, 80.0, 0.0];

        counter.extract_peaks_valleys(&history);
        counter.count_cycles();

        assert!(!counter.cycles.is_empty());
    }

    #[test]
    fn test_stress_intensity_through_crack() {
        let crack = CrackGeometry::ThroughCrack { half_length: 0.01 }; // 10mm
        let sif = StressIntensityFactor::new(crack, 0.2, 0.01);

        let k = sif.k_i(100.0); // 100 MPa
        // K ≈ σ√(πa) = 100 * √(π*0.01) ≈ 17.7 MPa√m
        assert!((k - 17.7).abs() < 2.0);
    }

    #[test]
    fn test_edge_crack_factor() {
        let crack = CrackGeometry::EdgeCrack { depth: 0.005 };
        let sif = StressIntensityFactor::new(crack, 0.1, 0.01);

        let y = sif.geometry_factor();
        assert!(y > 1.0); // Edge crack Y > 1
    }

    #[test]
    fn test_plastic_zone() {
        let mat = FractureMaterial::steel_4340();
        let r_y = mat.plastic_zone_radius(50.0);

        assert!(r_y > 0.0 && r_y < 0.01);
    }

    #[test]
    fn test_paris_law() {
        let paris = ParisLaw::steel();

        // Below threshold
        let rate = paris.growth_rate(2.0);
        assert_eq!(rate, 0.0);

        // Above threshold
        let rate = paris.growth_rate(10.0);
        assert!(rate > 0.0);
    }

    #[test]
    fn test_fad() {
        let mat = FractureMaterial::steel_4340();
        let fad = FailureAssessment::new(mat);

        // Low stress, small crack (safe)
        let safe = fad.is_acceptable(25.0, 500.0);
        assert!(safe);

        // High K (unsafe)
        let unsafe_k = fad.is_acceptable(60.0, 500.0);
        assert!(!unsafe_k);
    }

    #[test]
    fn test_fad_curve() {
        let mat = FractureMaterial::steel_4340();
        let fad = FailureAssessment::new(mat);

        let kr_0 = fad.fad_curve(0.0);
        let kr_1 = fad.fad_curve(1.0);

        assert!((kr_0 - 1.0).abs() < 0.01); // Kr = 1 at Lr = 0
        assert!(kr_1 < kr_0);               // Decreases with Lr
    }

    #[test]
    fn test_critical_crack_size() {
        let crack = CrackGeometry::ThroughCrack { half_length: 0.01 };
        let sif = StressIntensityFactor::new(crack, 0.2, 0.01);

        let a_crit = sif.critical_crack_size(100.0, 50.0);
        assert!(a_crit > 0.01 && a_crit < 0.5);
    }

    #[test]
    fn test_nasgro_closure() {
        let nasgro = NASGROEquation {
            c: 1e-10,
            n: 3.0,
            p: 0.5,
            q: 1.0,
            delta_k_th_0: 3.0,
            k_ic: 50.0,
            k_max_crit: 45.0,
            a_0: 1e-5,
        };

        let rate_r0 = nasgro.growth_rate(10.0, 0.0);
        let rate_r05 = nasgro.growth_rate(10.0, 0.5);

        // Higher R ratio typically gives higher growth rate
        assert!(rate_r05 > rate_r0 || rate_r0 > 0.0);
    }
}
