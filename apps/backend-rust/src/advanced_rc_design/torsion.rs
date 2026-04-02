//! Torsion design per IS 456:2000 Clause 41
//! Combined torsion and shear with stirrup and longitudinal design

use serde::{Deserialize, Serialize};

use super::common::{circle_area, max_shear_stress, table19_tau_c};
use super::punching_shear::DesignStatus;

/// Torsion designer (IS 456:2000 Cl. 41)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TorsionDesigner {
    /// Characteristic concrete strength (N/mm²)
    pub fck: f64,
    /// Yield strength of stirrup steel (N/mm²)
    pub fy: f64,
    /// Beam width (mm)
    pub b: f64,
    /// Beam overall depth (mm)
    pub d_overall: f64,
    /// Effective depth (mm)
    pub d: f64,
    /// Cover to center of reinforcement (mm)
    pub cover: f64,
}

/// Torsion design result
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TorsionResult {
    pub equivalent_shear_ve: f64,       // kN
    pub equivalent_moment_me: f64,      // kNm
    pub tau_ve: f64,                    // N/mm²
    pub tau_c: f64,                     // N/mm²
    pub tau_c_max: f64,                 // N/mm²
    pub asv_torsion: f64,               // mm²/m (stirrup area per unit length)
    pub asv_shear: f64,                 // mm²/m
    pub asv_total: f64,                 // mm²/m
    pub asl: f64,                       // mm² (longitudinal steel)
    pub stirrup_diameter: f64,          // mm
    pub stirrup_spacing: f64,           // mm
    pub stirrup_legs: usize,
    pub longitudinal_bars: usize,
    pub longitudinal_diameter: f64,     // mm
    pub status: DesignStatus,
}

impl TorsionDesigner {
    pub fn new(fck: f64, fy: f64, b: f64, d_overall: f64, cover: f64) -> Self {
        Self {
            fck,
            fy,
            b,
            d_overall,
            d: d_overall - cover - 10.0, // Assuming 10mm stirrup
            cover,
        }
    }

    /// Design for combined torsion and shear (IS 456 Clause 41.4)
    pub fn design(
        &self,
        tu: f64,  // Torsional moment (kNm)
        vu: f64,  // Shear force (kN)
        mu: f64,  // Bending moment (kNm)
        pt: f64,  // Tension reinforcement percentage
    ) -> TorsionResult {
        let b = self.b;
        let d = self.d;
        let d1 = self.d_overall;

        // Equivalent shear (Clause 41.3.1)
        let ve = vu + 1.6 * tu * 1000.0 / b;

        // Equivalent bending moment (Clause 41.4.2)
        let mt = tu * (1.0 + d1 / b) / 1.7; // IS 456: Mt = Tu*(1 + D/b)/1.7
        let me = mu + mt;

        // Shear stress
        let tau_ve = ve * 1000.0 / (b * d);

        // Design shear strength (Table 19)
        let tau_c = self.calculate_tau_c(pt);

        // Maximum shear stress (Table 20)
        let tau_c_max = max_shear_stress(self.fck);

        // Check status
        let status = if tau_ve > tau_c_max {
            DesignStatus::IncreaseDepth
        } else if tau_ve > tau_c {
            DesignStatus::NeedsReinforcement
        } else {
            DesignStatus::Pass
        };

        // Transverse reinforcement (Clause 41.4.3)
        let b1 = b - 2.0 * self.cover;
        let d1_eff = d1 - 2.0 * self.cover;

        // Asv/sv >= Tu/(b1*d1*0.87fy) + Vu/(2.5*d1*0.87fy)
        let asv_torsion = tu * 1e6 / (b1 * d1_eff * 0.87 * self.fy);
        let asv_shear = vu * 1000.0 / (2.5 * d1_eff * 0.87 * self.fy);
        let asv_total = (asv_torsion + asv_shear).max(0.4 * b / (0.87 * self.fy)); // min reinforcement

        // Longitudinal reinforcement (Clause 41.4.3)
        let asl = tu * 1e6 * (b1 + d1_eff) / (b1 * d1_eff * 0.87 * self.fy);

        // Detail stirrups
        let (stirrup_dia, spacing, legs) = self.design_stirrups(asv_total * 1000.0);

        // Detail longitudinal bars
        let (long_bars, long_dia) = self.design_longitudinal(asl);

        TorsionResult {
            equivalent_shear_ve: ve,
            equivalent_moment_me: me,
            tau_ve,
            tau_c,
            tau_c_max,
            asv_torsion: asv_torsion * 1000.0,
            asv_shear: asv_shear * 1000.0,
            asv_total: asv_total * 1000.0,
            asl,
            stirrup_diameter: stirrup_dia,
            stirrup_spacing: spacing,
            stirrup_legs: legs,
            longitudinal_bars: long_bars,
            longitudinal_diameter: long_dia,
            status,
        }
    }

    /// τc from IS 456 Table 19 (interpolated and scaled)
    fn calculate_tau_c(&self, pt: f64) -> f64 {
        table19_tau_c(self.fck.min(40.0), pt)
    }

    /// Design stirrups given Asv/s spacing demand (mm² per meter)
    fn design_stirrups(&self, asv_per_m: f64) -> (f64, f64, usize) {
        let diameters: [f64; 4] = [8.0, 10.0, 12.0, 16.0];

        for &dia in &diameters {
            let a_bar = circle_area(dia);

            for legs in [2, 4] {
                let a_stirrup = legs as f64 * a_bar;
                let spacing = a_stirrup * 1000.0 / asv_per_m;
                let max_spacing = (self.d * 0.75).min(300.0);

                if spacing >= 75.0 && spacing <= max_spacing {
                    let spacing = ((spacing / 25.0).floor() * 25.0).max(75.0);
                    return (dia, spacing, legs);
                }
            }
        }

        (12.0, 100.0, 4)
    }

    /// Design longitudinal bars for torsion
    fn design_longitudinal(&self, asl: f64) -> (usize, f64) {
        let diameters: [f64; 4] = [12.0, 16.0, 20.0, 25.0];

        for &dia in &diameters {
            let a_bar = circle_area(dia);
            let n_bars = (asl / a_bar).ceil() as usize;
            let n_bars = n_bars.max(4);
            if n_bars <= 12 {
                return (n_bars, dia);
            }
        }

        (8, 16.0)
    }
}
