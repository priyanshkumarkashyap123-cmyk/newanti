//! Advanced RC Design Module - Punching Shear, Torsion, Two-Way Slabs
//! 
//! Completes the IS 456:2000 concrete design capabilities
//! Implements missing STAAD.Pro features for RC structures

use serde::{Deserialize, Serialize};
use std::f64::consts::PI;

// ============================================================================
// PUNCHING SHEAR DESIGN (IS 456 Clause 31)
// ============================================================================

/// Punching shear design per IS 456:2000 Clause 31
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

/// Column position type
#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
pub enum ColumnType {
    Interior,
    Edge,
    Corner,
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

/// Design status
#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
pub enum DesignStatus {
    Pass,
    NeedsReinforcement,
    IncreaseDepth,
    Fail,
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

    /// Calculate critical perimeter at d/2 from column face
    pub fn critical_perimeter(&self) -> f64 {
        let d_half = self.d / 2.0;
        
        match self.column_type {
            ColumnType::Interior => {
                // Full perimeter around column
                2.0 * (self.column_cx + self.column_cy + 4.0 * d_half)
            }
            ColumnType::Edge => {
                // Three sides
                2.0 * d_half + self.column_cx + 2.0 * d_half + self.column_cy + 2.0 * d_half
            }
            ColumnType::Corner => {
                // Two sides
                2.0 * d_half + self.column_cx / 2.0 + 2.0 * d_half + self.column_cy / 2.0 + 2.0 * d_half
            }
        }
    }

    /// Calculate critical area
    pub fn critical_area(&self) -> f64 {
        self.critical_perimeter() * self.d
    }

    /// Design strength in shear (IS 456 Table 19)
    pub fn design_shear_strength(&self, pt: f64) -> f64 {
        // IS 456 Table 19 interpolation for M20 concrete, scaled for fck
        let pt = pt.max(0.15).min(3.0);
        
        // Table 19 base values (for M20 concrete)
        let tau_c_base = if pt <= 0.25 {
            0.36
        } else if pt <= 0.50 {
            0.36 + (0.48 - 0.36) * (pt - 0.25) / 0.25
        } else if pt <= 0.75 {
            0.48 + (0.56 - 0.48) * (pt - 0.50) / 0.25
        } else if pt <= 1.00 {
            0.56 + (0.62 - 0.56) * (pt - 0.75) / 0.25
        } else if pt <= 1.50 {
            0.62 + (0.72 - 0.62) * (pt - 1.00) / 0.50
        } else if pt <= 2.00 {
            0.72 + (0.79 - 0.72) * (pt - 1.50) / 0.50
        } else {
            0.79 + (0.82 - 0.79) * (pt - 2.00) / 1.00
        };
        
        let tau_c = tau_c_base * (self.fck / 25.0).sqrt();
        
        // Enhanced for punching (factor ks per IS 456 Cl. 31.6.3)
        // Guard: prevent division by zero if column dimensions are zero
        let min_col = self.column_cx.min(self.column_cy).max(1e-10);
        let beta_c = self.column_cx.max(self.column_cy) / min_col;
        let ks = (0.5 + beta_c).min(1.0);
        
        ks * tau_c
    }

    /// Check punching shear
    pub fn check(&self, vu: f64, pt: f64, moment_transfer: Option<(f64, f64)>) -> PunchingShearResult {
        let b0 = self.critical_perimeter();
        let area = self.critical_area();
        
        // Nominal shear stress
        let mut tau_v = vu * 1000.0 / area; // Convert kN to N
        
        // Account for moment transfer (unbalanced moment)
        if let Some((mux, muy)) = moment_transfer {
            let gamma_v = 0.4; // Fraction transferred by shear
            let jc = self.polar_moment_of_inertia();
            
            let cx = self.column_cx / 2.0 + self.d / 2.0;
            let cy = self.column_cy / 2.0 + self.d / 2.0;
            
            let tau_mx = gamma_v * mux.abs() * 1e6 * cy / jc;
            let tau_my = gamma_v * muy.abs() * 1e6 * cx / jc;
            
            tau_v += tau_mx + tau_my;
        }
        
        // Design strength
        let tau_c = self.design_shear_strength(pt);
        
        // Maximum allowed (IS 456 Table 20)
        let tau_c_max = 0.63 * self.fck.sqrt();
        
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

    /// Polar moment of inertia of critical section
    fn polar_moment_of_inertia(&self) -> f64 {
        let cx = self.column_cx + self.d;
        let cy = self.column_cy + self.d;
        
        match self.column_type {
            ColumnType::Interior => {
                // Jc = d * (cx³/6 + cx*cy²/2 + cy³/6 + cx²*cy/2)
                self.d * (cx.powi(3) / 6.0 + cx * cy.powi(2) / 2.0 + 
                         cy.powi(3) / 6.0 + cx.powi(2) * cy / 2.0)
            }
            ColumnType::Edge | ColumnType::Corner => {
                // Simplified for edge/corner
                self.d * cx.powi(3) / 6.0
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
        let a_stud = PI * stud_diameter.powi(2) / 4.0;
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

// ============================================================================
// TORSION DESIGN (IS 456 Clause 41)
// ============================================================================

/// Torsion design per IS 456:2000 Clause 41
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
        // IS 456: Mt = Tu * (1 + D/b) / 1.7  where D = overall depth
        let mt = tu * (1.0 + d1 / b) / 1.7;
        let me = mu + mt;
        
        // Shear stress
        let tau_ve = ve * 1000.0 / (b * d);
        
        // Design shear strength (Table 19)
        let tau_c = self.calculate_tau_c(pt);
        
        // Maximum shear stress (Table 20)
        let tau_c_max = 0.63 * self.fck.sqrt();
        
        // Check if section is adequate
        let status = if tau_ve > tau_c_max {
            DesignStatus::IncreaseDepth
        } else if tau_ve > tau_c {
            DesignStatus::NeedsReinforcement
        } else {
            DesignStatus::Pass
        };
        
        // Transverse reinforcement (Clause 41.4.3)
        // Asv/sv >= (Tu/b1*d1)/(0.87*fy) + Vu/(2.5*d1)/(0.87*fy)
        let b1 = b - 2.0 * self.cover;
        let d1_eff = d1 - 2.0 * self.cover;
        
        let asv_torsion = tu * 1e6 / (b1 * d1_eff * 0.87 * self.fy);
        let asv_shear = if tau_ve > tau_c {
            (tau_ve - tau_c) * b / (0.87 * self.fy)
        } else {
            0.0
        };
        let asv_total = asv_torsion + asv_shear;
        
        // Minimum reinforcement
        let asv_min = 0.4 * b / (0.87 * self.fy);
        let asv_total = asv_total.max(asv_min);
        
        // Longitudinal reinforcement (Clause 41.4.3)
        let asl = tu * 1e6 * (b1 + d1_eff) / (b1 * d1_eff * 0.87 * self.fy);
        
        // Design stirrups
        let (stirrup_dia, spacing, legs) = self.design_stirrups(asv_total * 1000.0);
        
        // Design longitudinal bars
        let (long_bars, long_dia) = self.design_longitudinal(asl);
        
        TorsionResult {
            equivalent_shear_ve: ve,  // already in kN
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

    /// Calculate τc from Table 19
    fn calculate_tau_c(&self, pt: f64) -> f64 {
        let pt = pt.max(0.15).min(3.0);
        let fck = self.fck.min(40.0);
        
        // Interpolation from Table 19
        let tau_c = if pt <= 0.25 {
            0.36 * (fck / 25.0).powf(0.5)
        } else if pt <= 0.50 {
            0.36 + (0.48 - 0.36) * (pt - 0.25) / 0.25
        } else if pt <= 0.75 {
            0.48 + (0.56 - 0.48) * (pt - 0.50) / 0.25
        } else if pt <= 1.00 {
            0.56 + (0.62 - 0.56) * (pt - 0.75) / 0.25
        } else if pt <= 1.50 {
            0.62 + (0.72 - 0.62) * (pt - 1.00) / 0.50
        } else if pt <= 2.00 {
            0.72 + (0.79 - 0.72) * (pt - 1.50) / 0.50
        } else {
            0.79 + (0.82 - 0.79) * (pt - 2.00) / 1.00
        };
        
        tau_c * (fck / 25.0).sqrt()
    }

    /// Design stirrups
    fn design_stirrups(&self, asv_per_m: f64) -> (f64, f64, usize) {
        // Try standard diameters
        let diameters: [f64; 4] = [8.0, 10.0, 12.0, 16.0];
        
        for &dia in &diameters {
            let a_bar = PI * dia.powi(2) / 4.0;
            
            // Try 2-leg and 4-leg stirrups
            for legs in [2, 4] {
                let a_stirrup = legs as f64 * a_bar;
                let spacing = a_stirrup * 1000.0 / asv_per_m;
                
                // Check spacing limits
                let max_spacing = (self.d * 0.75).min(300.0);
                
                if spacing >= 75.0 && spacing <= max_spacing {
                    // Round down to practical spacing
                    let spacing = ((spacing / 25.0).floor() * 25.0).max(75.0);
                    return (dia, spacing, legs);
                }
            }
        }
        
        // Default to minimum
        (12.0, 100.0, 4)
    }

    /// Design longitudinal bars
    fn design_longitudinal(&self, asl: f64) -> (usize, f64) {
        // Minimum 4 bars (one at each corner)
        let diameters: [f64; 4] = [12.0, 16.0, 20.0, 25.0];
        
        for &dia in &diameters {
            let a_bar = PI * dia.powi(2) / 4.0;
            let n_bars = (asl / a_bar).ceil() as usize;
            
            // Minimum 4 bars
            let n_bars = n_bars.max(4);
            
            // Check if reasonable
            if n_bars <= 12 {
                return (n_bars, dia);
            }
        }
        
        // Default
        (8, 16.0)
    }
}

// ============================================================================
// TWO-WAY SLAB DESIGN (IS 456 Annex D)
// ============================================================================

/// Two-way slab design using coefficient method (IS 456 Annex D)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TwoWaySlabDesigner {
    /// Characteristic concrete strength (N/mm²)
    pub fck: f64,
    /// Yield strength of steel (N/mm²)
    pub fy: f64,
    /// Shorter span (mm)
    pub lx: f64,
    /// Longer span (mm)
    pub ly: f64,
    /// Slab thickness (mm)
    pub thickness: f64,
    /// Clear cover (mm)
    pub cover: f64,
    /// Edge conditions
    pub edge_conditions: SlabEdgeConditions,
}

/// Slab edge conditions (IS 456 Table 26)
#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
pub enum SlabEdgeConditions {
    /// All four edges continuous
    AllContinuous,
    /// One short edge discontinuous
    OneShortDiscontinuous,
    /// One long edge discontinuous
    OneLongDiscontinuous,
    /// Two adjacent edges discontinuous
    TwoAdjacentDiscontinuous,
    /// Two short edges discontinuous
    TwoShortDiscontinuous,
    /// Two long edges discontinuous
    TwoLongDiscontinuous,
    /// Three edges discontinuous (one long continuous)
    ThreeEdgesDiscOneLong,
    /// Three edges discontinuous (one short continuous)
    ThreeEdgesDiscOneShort,
    /// All four edges discontinuous (simply supported)
    AllDiscontinuous,
}

/// Two-way slab design result
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TwoWaySlabResult {
    pub aspect_ratio: f64,
    /// Moments (kNm/m)
    pub mx_neg: f64,
    pub mx_pos: f64,
    pub my_neg: f64,
    pub my_pos: f64,
    /// Reinforcement (mm²/m)
    pub asx_neg: f64,
    pub asx_pos: f64,
    pub asy_neg: f64,
    pub asy_pos: f64,
    /// Detailing
    pub short_span_bar_diameter: f64,
    pub short_span_spacing: f64,
    pub long_span_bar_diameter: f64,
    pub long_span_spacing: f64,
    /// Deflection check
    pub span_depth_ratio: f64,
    pub allowable_span_depth: f64,
    pub deflection_ok: bool,
}

impl TwoWaySlabDesigner {
    pub fn new(
        fck: f64,
        fy: f64,
        lx: f64,
        ly: f64,
        thickness: f64,
        edge_conditions: SlabEdgeConditions,
    ) -> Self {
        Self {
            fck,
            fy,
            lx: lx.min(ly),
            ly: lx.max(ly),
            thickness,
            cover: 20.0,
            edge_conditions,
        }
    }

    /// Get moment coefficients from IS 456 Table 26
    fn get_coefficients(&self) -> (f64, f64, f64, f64) {
        let r = self.ly / self.lx;
        let r = r.min(2.0); // Beyond 2.0, treat as one-way
        
        // Coefficients (αx_neg, αx_pos, αy_neg, αy_pos)
        // These are multiplied by w*lx² to get moments
        match self.edge_conditions {
            SlabEdgeConditions::AllContinuous => {
                self.interpolate_coefficients(r, 
                    (0.032, 0.024, 0.032, 0.024), // r=1.0
                    (0.037, 0.028, 0.028, 0.021), // r=1.5
                    (0.045, 0.035, 0.024, 0.018)) // r=2.0
            }
            SlabEdgeConditions::OneShortDiscontinuous => {
                self.interpolate_coefficients(r,
                    (0.037, 0.028, 0.037, 0.028),
                    (0.043, 0.032, 0.032, 0.024),
                    (0.052, 0.039, 0.028, 0.021))
            }
            SlabEdgeConditions::OneLongDiscontinuous => {
                self.interpolate_coefficients(r,
                    (0.037, 0.028, 0.037, 0.028),
                    (0.044, 0.033, 0.033, 0.025),
                    (0.053, 0.040, 0.028, 0.021))
            }
            SlabEdgeConditions::TwoAdjacentDiscontinuous => {
                self.interpolate_coefficients(r,
                    (0.047, 0.035, 0.047, 0.035),
                    (0.053, 0.040, 0.040, 0.030),
                    (0.063, 0.047, 0.035, 0.026))
            }
            SlabEdgeConditions::TwoShortDiscontinuous => {
                self.interpolate_coefficients(r,
                    (0.045, 0.035, 0.045, 0.035),
                    (0.049, 0.037, 0.037, 0.028),
                    (0.056, 0.042, 0.028, 0.021))
            }
            SlabEdgeConditions::TwoLongDiscontinuous => {
                self.interpolate_coefficients(r,
                    (0.045, 0.035, 0.045, 0.035),
                    (0.056, 0.042, 0.042, 0.031),
                    (0.070, 0.053, 0.035, 0.026))
            }
            SlabEdgeConditions::ThreeEdgesDiscOneLong => {
                self.interpolate_coefficients(r,
                    (0.057, 0.043, 0.057, 0.043),
                    (0.064, 0.048, 0.048, 0.036),
                    (0.074, 0.056, 0.040, 0.030))
            }
            SlabEdgeConditions::ThreeEdgesDiscOneShort => {
                self.interpolate_coefficients(r,
                    (0.057, 0.043, 0.057, 0.043),
                    (0.067, 0.050, 0.050, 0.038),
                    (0.080, 0.060, 0.043, 0.032))
            }
            SlabEdgeConditions::AllDiscontinuous => {
                self.interpolate_coefficients(r,
                    (0.0, 0.056, 0.0, 0.056),
                    (0.0, 0.064, 0.0, 0.048),
                    (0.0, 0.074, 0.0, 0.040))
            }
        }
    }

    /// Interpolate coefficients based on aspect ratio
    fn interpolate_coefficients(
        &self,
        r: f64,
        c1: (f64, f64, f64, f64), // r=1.0
        c15: (f64, f64, f64, f64), // r=1.5
        c2: (f64, f64, f64, f64),  // r=2.0
    ) -> (f64, f64, f64, f64) {
        if r <= 1.0 {
            c1
        } else if r <= 1.5 {
            let t = (r - 1.0) / 0.5;
            (
                c1.0 + t * (c15.0 - c1.0),
                c1.1 + t * (c15.1 - c1.1),
                c1.2 + t * (c15.2 - c1.2),
                c1.3 + t * (c15.3 - c1.3),
            )
        } else {
            let t = (r - 1.5) / 0.5;
            (
                c15.0 + t * (c2.0 - c15.0),
                c15.1 + t * (c2.1 - c15.1),
                c15.2 + t * (c2.2 - c15.2),
                c15.3 + t * (c2.3 - c15.3),
            )
        }
    }

    /// Design the slab
    pub fn design(&self, wu: f64) -> TwoWaySlabResult {
        // wu in kN/m² (factored load)
        let lx = self.lx / 1000.0; // Convert to m
        
        // Get moment coefficients
        let (alpha_x_neg, alpha_x_pos, alpha_y_neg, alpha_y_pos) = self.get_coefficients();
        
        // Calculate moments (kNm/m)
        let mx_neg = alpha_x_neg * wu * lx.powi(2);
        let mx_pos = alpha_x_pos * wu * lx.powi(2);
        let my_neg = alpha_y_neg * wu * lx.powi(2);
        let my_pos = alpha_y_pos * wu * lx.powi(2);
        
        // Effective depths
        let d_short = self.thickness - self.cover - 5.0; // Assuming 10mm bars
        let d_long = d_short - 10.0; // Long span bars below short span
        
        // Calculate reinforcement
        let asx_neg = self.calculate_steel(mx_neg, d_short);
        let asx_pos = self.calculate_steel(mx_pos, d_short);
        let asy_neg = self.calculate_steel(my_neg, d_long);
        let asy_pos = self.calculate_steel(my_pos, d_long);
        
        // Minimum reinforcement (IS 456 Clause 26.5.2.1)
        let as_min = 0.12 * self.thickness * 10.0; // 0.12% for HYSD bars
        
        let asx_neg = asx_neg.max(as_min);
        let asx_pos = asx_pos.max(as_min);
        let asy_neg = asy_neg.max(as_min);
        let asy_pos = asy_pos.max(as_min);
        
        // Design bar spacing
        let (dia_x, spacing_x) = self.design_bars(asx_pos.max(asx_neg));
        let (dia_y, spacing_y) = self.design_bars(asy_pos.max(asy_neg));
        
        // Deflection check (IS 456 Clause 23.2)
        let span_depth = self.lx / self.thickness;
        let basic_ratio = if self.edge_conditions == SlabEdgeConditions::AllDiscontinuous {
            20.0 // Simply supported
        } else if matches!(self.edge_conditions, 
            SlabEdgeConditions::AllContinuous | 
            SlabEdgeConditions::OneShortDiscontinuous |
            SlabEdgeConditions::OneLongDiscontinuous) {
            26.0 // Continuous
        } else {
            23.0 // Partially continuous
        };
        
        // Modification factor for steel
        let pt = (asx_pos / (1000.0 * d_short)) * 100.0;
        let mf = self.modification_factor(pt);
        
        let allowable_ratio = basic_ratio * mf;
        let deflection_ok = span_depth <= allowable_ratio;
        
        TwoWaySlabResult {
            aspect_ratio: self.ly / self.lx,
            mx_neg,
            mx_pos,
            my_neg,
            my_pos,
            asx_neg,
            asx_pos,
            asy_neg,
            asy_pos,
            short_span_bar_diameter: dia_x,
            short_span_spacing: spacing_x,
            long_span_bar_diameter: dia_y,
            long_span_spacing: spacing_y,
            span_depth_ratio: span_depth,
            allowable_span_depth: allowable_ratio,
            deflection_ok,
        }
    }

    /// Calculate steel area for given moment
    fn calculate_steel(&self, m: f64, d: f64) -> f64 {
        // M = 0.87 * fy * Ast * (d - 0.42 * xu)
        // For under-reinforced section: xu/d ≈ 0.5 * xu_max/d
        
        let m = m * 1e6; // Convert to Nmm
        let r = m / (self.fck * 1000.0 * d.powi(2));
        
        // From quadratic formula
        let pt = self.fck / (2.0 * self.fy) * (1.0 - (1.0 - 4.6 * r).sqrt()) * 100.0;
        let ast = pt * 1000.0 * d / 100.0;
        
        ast.max(0.0)
    }

    /// Design bar diameter and spacing
    fn design_bars(&self, ast: f64) -> (f64, f64) {
        let diameters: [f64; 4] = [8.0, 10.0, 12.0, 16.0];
        
        for &dia in &diameters {
            let a_bar = PI * dia.powi(2) / 4.0;
            let spacing = a_bar * 1000.0 / ast;
            
            // Check spacing limits (3d or 300mm)
            let max_spacing = (3.0 * (self.thickness - self.cover)).min(300.0);
            let min_spacing = 75.0;
            
            if spacing >= min_spacing && spacing <= max_spacing {
                // Round to practical spacing
                let spacing = ((spacing / 25.0).floor() * 25.0).max(min_spacing);
                return (dia, spacing);
            }
        }
        
        // Default
        (10.0, 150.0)
    }

    /// Modification factor for tension reinforcement (IS 456 Fig. 4)
    fn modification_factor(&self, pt: f64) -> f64 {
        let fs = 0.58 * self.fy;
        let fs_factor = 290.0 / fs;
        
        let mf = if pt <= 0.25 {
            2.0
        } else if pt <= 0.50 {
            2.0 - (pt - 0.25) * 2.0
        } else if pt <= 1.00 {
            1.5 - (pt - 0.50) * 0.5
        } else if pt <= 2.00 {
            1.0 - (pt - 1.00) * 0.15
        } else {
            0.85
        };
        
        (mf * fs_factor).min(2.0)
    }
}

// ============================================================================
// FLAT SLAB DESIGN (IS 456 Clause 31)
// ============================================================================

/// Flat slab design using direct design method
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FlatSlabDesigner {
    pub fck: f64,
    pub fy: f64,
    pub span_x: f64,
    pub span_y: f64,
    pub slab_thickness: f64,
    pub drop_thickness: Option<f64>,
    pub column_head_diameter: Option<f64>,
    pub column_cx: f64,
    pub column_cy: f64,
    pub cover: f64,
}

/// Flat slab design result
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FlatSlabResult {
    pub total_moment: f64,        // kNm
    pub column_strip_neg: f64,    // kNm
    pub column_strip_pos: f64,    // kNm
    pub middle_strip_neg: f64,    // kNm
    pub middle_strip_pos: f64,    // kNm
    pub as_col_strip_neg: f64,    // mm²
    pub as_col_strip_pos: f64,    // mm²
    pub as_mid_strip_neg: f64,    // mm²
    pub as_mid_strip_pos: f64,    // mm²
    pub punching_shear_ok: bool,
}

impl FlatSlabDesigner {
    pub fn new(
        fck: f64,
        fy: f64,
        span_x: f64,
        span_y: f64,
        slab_thickness: f64,
        column_cx: f64,
        column_cy: f64,
    ) -> Self {
        Self {
            fck,
            fy,
            span_x,
            span_y,
            slab_thickness,
            drop_thickness: None,
            column_head_diameter: None,
            column_cx,
            column_cy,
            cover: 25.0,
        }
    }

    /// Direct design method (IS 456 Clause 31.4)
    pub fn design_direct_method(&self, wu: f64) -> FlatSlabResult {
        let l1 = self.span_x / 1000.0; // m
        let l2 = self.span_y / 1000.0; // m
        let ln = l1 - self.column_cx / 1000.0; // Clear span
        
        // Total static moment (Clause 31.4.2.2)
        let mo = wu * l2 * ln.powi(2) / 8.0;
        
        // Distribution factors (Clause 31.4.3)
        // Interior span
        let neg_moment = 0.65 * mo;
        let pos_moment = 0.35 * mo;
        
        // Column strip (Clause 31.4.3.2)
        let col_strip_width = (l2 / 4.0).min(l1 / 4.0);
        let col_strip_neg = 0.75 * neg_moment;
        let col_strip_pos = 0.60 * pos_moment;
        
        // Middle strip
        let mid_strip_neg = 0.25 * neg_moment;
        let mid_strip_pos = 0.40 * pos_moment;
        
        // Calculate reinforcement
        let d = self.slab_thickness - self.cover - 8.0;
        let width = col_strip_width * 1000.0;
        
        let as_col_neg = self.calculate_steel(col_strip_neg, d, width);
        let as_col_pos = self.calculate_steel(col_strip_pos, d, width);
        let as_mid_neg = self.calculate_steel(mid_strip_neg, d, width);
        let as_mid_pos = self.calculate_steel(mid_strip_pos, d, width);
        
        // Punching shear check
        let punching = PunchingShearDesigner::new(
            self.fck, self.fy, d,
            self.column_cx, self.column_cy,
            ColumnType::Interior,
        );
        
        let vu = wu * l1 * l2 - wu * (self.column_cx / 1000.0 + d / 1000.0) 
                                    * (self.column_cy / 1000.0 + d / 1000.0);
        let pt = (as_col_neg + as_col_pos) / (2.0 * width * d) * 100.0;
        let punch_result = punching.check(vu, pt, None);
        
        FlatSlabResult {
            total_moment: mo,
            column_strip_neg: col_strip_neg,
            column_strip_pos: col_strip_pos,
            middle_strip_neg: mid_strip_neg,
            middle_strip_pos: mid_strip_pos,
            as_col_strip_neg: as_col_neg,
            as_col_strip_pos: as_col_pos,
            as_mid_strip_neg: as_mid_neg,
            as_mid_strip_pos: as_mid_pos,
            punching_shear_ok: punch_result.status == DesignStatus::Pass,
        }
    }

    fn calculate_steel(&self, m: f64, d: f64, b: f64) -> f64 {
        let m = m * 1e6;
        let r = m / (self.fck * b * d.powi(2));
        let pt = self.fck / (2.0 * self.fy) * (1.0 - (1.0 - 4.6 * r).sqrt().max(0.0)) * 100.0;
        let ast = pt * b * d / 100.0;
        
        // Minimum steel
        let ast_min = 0.12 * b * (self.slab_thickness) / 100.0;
        
        ast.max(ast_min)
    }
}

// ============================================================================
// TESTS
// ============================================================================

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_punching_shear_interior() {
        let designer = PunchingShearDesigner::new(
            30.0, 500.0, 200.0,
            400.0, 400.0,
            ColumnType::Interior,
        );
        
        // Critical perimeter
        let b0 = designer.critical_perimeter();
        // 2*(400 + 400 + 4*100) = 2400 mm
        assert!((b0 - 2400.0).abs() < 1.0);
        
        // Check with moderate load
        let result = designer.check(300.0, 0.5, None);
        assert!(result.shear_stress_vu > 0.0);
        assert!(result.design_strength_vc > 0.0);
    }

    #[test]
    fn test_punching_shear_edge() {
        let designer = PunchingShearDesigner::new(
            25.0, 415.0, 175.0,
            300.0, 300.0,
            ColumnType::Edge,
        );
        
        let result = designer.check(200.0, 0.4, None);
        assert!(result.critical_perimeter > 0.0);
    }

    #[test]
    fn test_punching_shear_with_moment() {
        let designer = PunchingShearDesigner::new(
            30.0, 500.0, 200.0,
            400.0, 400.0,
            ColumnType::Interior,
        );
        
        let result_no_moment = designer.check(400.0, 0.5, None);
        let result_with_moment = designer.check(400.0, 0.5, Some((50.0, 30.0)));
        
        // Stress should be higher with unbalanced moment
        assert!(result_with_moment.shear_stress_vu > result_no_moment.shear_stress_vu);
    }

    #[test]
    fn test_torsion_design() {
        let designer = TorsionDesigner::new(30.0, 500.0, 300.0, 600.0, 40.0);
        
        let result = designer.design(30.0, 100.0, 150.0, 0.8);
        
        // Check that equivalent shear is computed (should be > 0)
        assert!(result.equivalent_shear_ve > 0.0, "Equivalent shear should be positive");
        assert!(result.asv_total > 0.0, "Total stirrup area should be positive");
        assert!(result.asl > 0.0, "Longitudinal steel area should be positive");
    }

    #[test]
    fn test_torsion_pure() {
        let designer = TorsionDesigner::new(25.0, 415.0, 250.0, 500.0, 35.0);
        
        // Pure torsion case
        let result = designer.design(50.0, 0.0, 0.0, 0.3);
        
        assert!(result.tau_ve > 0.0);
        assert!(result.asv_torsion > result.asv_shear);
    }

    #[test]
    fn test_two_way_slab_all_continuous() {
        let designer = TwoWaySlabDesigner::new(
            25.0, 415.0,
            4000.0, 5000.0, 150.0,
            SlabEdgeConditions::AllContinuous,
        );
        
        let result = designer.design(12.0);
        
        assert!(result.aspect_ratio > 1.0);
        assert!(result.mx_neg > result.mx_pos); // Negative moment higher at supports
        assert!(result.asx_neg > 0.0);
        assert!(result.short_span_spacing > 0.0);
    }

    #[test]
    fn test_two_way_slab_simply_supported() {
        let designer = TwoWaySlabDesigner::new(
            30.0, 500.0,
            3000.0, 4000.0, 120.0,
            SlabEdgeConditions::AllDiscontinuous,
        );
        
        let result = designer.design(15.0);
        
        // Simply supported has no negative moment
        assert!((result.mx_neg).abs() < 0.1);
        assert!(result.mx_pos > 0.0);
    }

    #[test]
    fn test_two_way_slab_deflection() {
        let designer = TwoWaySlabDesigner::new(
            25.0, 415.0,
            5000.0, 6000.0, 175.0,
            SlabEdgeConditions::AllContinuous,
        );
        
        let result = designer.design(10.0);
        
        assert!(result.span_depth_ratio > 0.0);
        assert!(result.allowable_span_depth > 0.0);
        // For well-designed slab, deflection should be OK
        assert!(result.deflection_ok);
    }

    #[test]
    fn test_flat_slab_design() {
        let designer = FlatSlabDesigner::new(
            30.0, 500.0,
            6000.0, 6000.0, 250.0,
            450.0, 450.0,
        );
        
        let result = designer.design_direct_method(15.0);
        
        assert!(result.total_moment > 0.0);
        assert!(result.column_strip_neg > result.middle_strip_neg);
        assert!(result.as_col_strip_neg > 0.0);
    }

    #[test]
    fn test_shear_stud_design() {
        let designer = PunchingShearDesigner::new(
            30.0, 500.0, 200.0,
            400.0, 400.0,
            ColumnType::Interior,
        );
        
        // High load requiring reinforcement
        let design = designer.design_shear_studs(600.0, 0.5, 12.0);
        
        if let Some(studs) = design {
            assert!(studs.total_studs > 0);
            assert!(studs.stud_spacing > 0.0);
            assert!(studs.num_rails >= 4);
        }
    }

    #[test]
    fn test_aspect_ratio_effect() {
        // Square slab
        let square = TwoWaySlabDesigner::new(
            25.0, 415.0,
            4000.0, 4000.0, 150.0,
            SlabEdgeConditions::AllContinuous,
        );
        let result_sq = square.design(10.0);
        
        // Rectangular slab
        let rect = TwoWaySlabDesigner::new(
            25.0, 415.0,
            4000.0, 6000.0, 150.0,
            SlabEdgeConditions::AllContinuous,
        );
        let result_rect = rect.design(10.0);
        
        // Square slab should have equal moments in both directions
        assert!((result_sq.mx_pos - result_sq.my_pos).abs() < 0.5);
        
        // Rectangular slab - short span moment should be higher
        assert!(result_rect.mx_pos > result_rect.my_pos);
    }
}
