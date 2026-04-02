//! Punching shear design per IS 456:2000 Clause 31
//! Implements critical perimeter, moment transfer, and stud rail design

use serde::{Deserialize, Serialize};

use super::common::{circle_area, max_shear_stress, table19_tau_c};

/// Column position type
#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
pub enum ColumnType {
    Interior,
    Edge,
    Corner,
}

/// Design status for RC checks
#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
pub enum DesignStatus {
    Pass,
    NeedsReinforcement,
    IncreaseDepth,
    Fail,
}

/// Punching shear designer (IS 456:2000 Cl. 31)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PunchingShearDesigner {
    /// Characteristic concrete strength (N/mm²)
    pub fck: f64,
    /// Yield strength of steel (N/mm²)
    pub fy: f64,
    /// Slab effective depth (mm)
    pub d: f64,
    /// Column dimensions (mm)
    pub column_cx: f64,
    pub column_cy: f64,
    /// Column type
    pub column_type: ColumnType,
    /// Clear cover (mm)
    pub cover: f64,
}

/// Punching shear result
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PunchingShearResult {
    pub critical_perimeter: f64,     // mm
    pub critical_area: f64,          // mm²
    pub shear_stress_vu: f64,        // N/mm²
    pub design_strength_vc: f64,     // N/mm²
    pub utilization_ratio: f64,
    pub shear_reinforcement_required: bool,
    pub shear_studs_area: Option<f64>,  // mm² per critical section
    pub stud_spacing: Option<f64>,      // mm
    pub num_stud_rails: Option<usize>,
    pub status: DesignStatus,
}

impl PunchingShearDesigner {
    pub fn new(fck: f64, fy: f64, d: f64, column_cx: f64, column_cy: f64, column_type: ColumnType) -> Self {
        Self {
            fck,
            fy,
            d,
            column_cx,
            column_cy,
            column_type,
            cover: 40.0,
        }
    }

    /// Critical perimeter at d/2 from column face (IS 456 Cl. 31)
    pub fn critical_perimeter(&self) -> f64 {
        let d_half = self.d / 2.0;
        match self.column_type {
            ColumnType::Interior => 2.0 * (self.column_cx + self.column_cy + 4.0 * d_half),
            ColumnType::Edge => self.column_cx + self.column_cy + 2.0 * self.d,
            ColumnType::Corner => self.column_cx / 2.0 + self.d / 2.0 + self.column_cy / 2.0 + self.d / 2.0,
        }
    }

    pub fn critical_area(&self) -> f64 {
        self.critical_perimeter() * self.d
    }

    /// Design shear strength τc (IS 456 Table 19 with SP-16 basis), enhanced for punching (Cl. 31.6.3)
    pub fn design_shear_strength(&self, pt: f64) -> f64 {
        let tau_c = table19_tau_c(self.fck, pt);

        // Enhanced for punching (factor ks per IS 456 Cl. 31.6.3)
        // βc = short_side / long_side ≤ 1.0
        let beta_c = self.column_cx.min(self.column_cy) / self.column_cx.max(self.column_cy).max(1e-10);
        let ks = (0.5 + beta_c).min(1.0);

        ks * tau_c
    }

    /// Punching shear check per IS 456:2000 Clause 31
    pub fn check(&self, vu: f64, pt: f64, moment_transfer: Option<(f64, f64)>) -> PunchingShearResult {
        let b0 = self.critical_perimeter();
        let area = self.critical_area();

        // Nominal shear stress
        let mut tau_v = vu * 1000.0 / area; // kN → N

        // Account for moment transfer (unbalanced moment)
        if let Some((mux, muy)) = moment_transfer {
            // γv = 1 − 1/(1 + (2/3)√(b1/b2)) per IS 456/ACI 318
            let b1 = self.column_cx + self.d;
            let b2 = self.column_cy + self.d;
            let gamma_f = 1.0 / (1.0 + (2.0 / 3.0) * (b1 / b2).sqrt());
            let gamma_v = 1.0 - gamma_f;
            // Separate Jc for each direction
            let (jc_x, jc_y) = self.polar_moment_of_inertia_xy();

            let cx = self.column_cx / 2.0 + self.d / 2.0;
            let cy = self.column_cy / 2.0 + self.d / 2.0;

            let tau_mx = gamma_v * mux.abs() * 1e6 * cy / jc_x;
            let tau_my = gamma_v * muy.abs() * 1e6 * cx / jc_y;

            tau_v += tau_mx + tau_my;
        }

        // Design strength
        let tau_c = self.design_shear_strength(pt);

        // Maximum allowed (IS 456 Table 20)
        let tau_c_max = max_shear_stress(self.fck);

        let ratio = tau_v / tau_c;

        // Determine status and reinforcement
        let (status, shear_studs_area, stud_spacing, num_rails) = if tau_v <= tau_c {
            (DesignStatus::Pass, None, None, None)
        } else if tau_v <= 1.5 * tau_c && tau_v <= tau_c_max {
            // Shear reinforcement can be provided
            let asv = (tau_v - tau_c) * area / (0.87 * self.fy);
            let spacing = 0.75 * self.d; // Max spacing
            let n_rails = 8; // Typical number of stud rails

            (DesignStatus::NeedsReinforcement, Some(asv), Some(spacing), Some(n_rails))
        } else if tau_v <= tau_c_max {
            // Heavy reinforcement needed
            let asv = (tau_v - tau_c) * area / (0.87 * self.fy);
            let spacing = 0.5 * self.d;
            let n_rails = 12;

            (DesignStatus::NeedsReinforcement, Some(asv), Some(spacing), Some(n_rails))
        } else {
            // Increase slab depth
            (DesignStatus::IncreaseDepth, None, None, None)
        };

        PunchingShearResult {
            critical_perimeter: b0,
            critical_area: area,
            shear_stress_vu: tau_v,
            design_strength_vc: tau_c,
            utilization_ratio: ratio,
            shear_reinforcement_required: status == DesignStatus::NeedsReinforcement,
            shear_studs_area,
            stud_spacing,
            num_stud_rails: num_rails,
            status,
        }
    }

    /// Polar moment of inertia of critical section (separate per axis)
    fn polar_moment_of_inertia_xy(&self) -> (f64, f64) {
        let cx = self.column_cx + self.d;
        let cy = self.column_cy + self.d;

        match self.column_type {
            ColumnType::Interior => {
                let jc_x = self.d * (cx.powi(3) / 6.0 + cx.powi(2) * cy / 2.0);
                let jc_y = self.d * (cy.powi(3) / 6.0 + cy.powi(2) * cx / 2.0);
                (jc_x, jc_y)
            }
            ColumnType::Edge | ColumnType::Corner => {
                let jc_x = self.d * cx.powi(3) / 6.0;
                let jc_y = self.d * cy.powi(3) / 6.0;
                (jc_x, jc_y)
            }
        }
    }

    /// Design shear studs
    pub fn design_shear_studs(
        &self,
        vu: f64,
        pt: f64,
        stud_diameter: f64,
    ) -> Option<ShearStudDesign> {
        let result = self.check(vu, pt, None);

        if result.status != DesignStatus::NeedsReinforcement {
            return None;
        }

        let asv = result.shear_studs_area?;

        // Stud properties
        let a_stud = circle_area(stud_diameter);
        let n_studs_per_rail = (asv / (8.0 * a_stud)).ceil() as usize;

        // Stud rail length
        let rail_length = 2.0 * self.d + self.column_cx.max(self.column_cy);

        // Spacing
        let spacing = rail_length / (n_studs_per_rail as f64 + 1.0);

        Some(ShearStudDesign {
            stud_diameter,
            studs_per_rail: n_studs_per_rail,
            num_rails: 8,
            rail_length,
            stud_spacing: spacing,
            first_stud_distance: 0.5 * self.d,
            total_studs: n_studs_per_rail * 8,
        })
    }
}

/// Shear stud design result
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ShearStudDesign {
    pub stud_diameter: f64,
    pub studs_per_rail: usize,
    pub num_rails: usize,
    pub rail_length: f64,
    pub stud_spacing: f64,
    pub first_stud_distance: f64,
    pub total_studs: usize,
}
