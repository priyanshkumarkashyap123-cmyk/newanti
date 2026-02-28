// ============================================================================
// GLASS & FACADE DESIGN MODULE
// ASTM E1300, prEN 16612, IS 14900 - Architectural glass design
// ============================================================================

use serde::{Deserialize, Serialize};

// ============================================================================
// GLASS TYPES
// ============================================================================

/// Glass type classification
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum GlassType {
    /// Annealed (float) glass
    Annealed,
    /// Heat strengthened glass
    HeatStrengthened,
    /// Fully tempered (toughened) glass
    FullyTempered,
    /// Chemically strengthened glass
    ChemicallyStrengthened,
}

impl GlassType {
    /// Characteristic bending strength (MPa) - prEN 16612
    pub fn characteristic_strength(&self) -> f64 {
        match self {
            GlassType::Annealed => 45.0,
            GlassType::HeatStrengthened => 70.0,
            GlassType::FullyTempered => 120.0,
            GlassType::ChemicallyStrengthened => 150.0,
        }
    }
    
    /// Surface prestress (MPa)
    pub fn prestress(&self) -> f64 {
        match self {
            GlassType::Annealed => 0.0,
            GlassType::HeatStrengthened => 24.0,
            GlassType::FullyTempered => 69.0,
            GlassType::ChemicallyStrengthened => 100.0,
        }
    }
    
    /// Breakage pattern description
    pub fn breakage_pattern(&self) -> &'static str {
        match self {
            GlassType::Annealed => "Large sharp shards",
            GlassType::HeatStrengthened => "Medium fragments",
            GlassType::FullyTempered => "Small cubic fragments (dicing)",
            GlassType::ChemicallyStrengthened => "Fine fragments",
        }
    }
}

/// Glass edge type
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum EdgeType {
    /// As cut (rough)
    AsCut,
    /// Seamed (arrised)
    Seamed,
    /// Ground (smooth)
    Ground,
    /// Polished
    Polished,
}

impl EdgeType {
    /// Edge strength factor
    pub fn strength_factor(&self) -> f64 {
        match self {
            EdgeType::AsCut => 0.8,
            EdgeType::Seamed => 0.9,
            EdgeType::Ground => 1.0,
            EdgeType::Polished => 1.0,
        }
    }
}

// ============================================================================
// LAMINATED GLASS
// ============================================================================

/// Interlayer material
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum InterlayerType {
    /// Polyvinyl butyral
    PVB,
    /// SentryGlas Plus (ionoplast)
    SGP,
    /// Ethylene vinyl acetate
    EVA,
    /// Cast in place resin
    CIP,
}

impl InterlayerType {
    /// Shear modulus at 20°C, short duration (MPa)
    pub fn shear_modulus_short(&self) -> f64 {
        match self {
            InterlayerType::PVB => 0.8,
            InterlayerType::SGP => 140.0,
            InterlayerType::EVA => 0.5,
            InterlayerType::CIP => 0.3,
        }
    }
    
    /// Shear modulus at 20°C, long duration (MPa)
    pub fn shear_modulus_long(&self) -> f64 {
        match self {
            InterlayerType::PVB => 0.05,
            InterlayerType::SGP => 10.0,
            InterlayerType::EVA => 0.03,
            InterlayerType::CIP => 0.02,
        }
    }
    
    /// Temperature reduction factor at 50°C
    pub fn temp_factor_50c(&self) -> f64 {
        match self {
            InterlayerType::PVB => 0.1,
            InterlayerType::SGP => 0.7,
            InterlayerType::EVA => 0.1,
            InterlayerType::CIP => 0.05,
        }
    }
}

/// Laminated glass configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LaminatedGlass {
    /// Glass ply thicknesses (mm)
    pub plies: Vec<f64>,
    /// Interlayer thicknesses (mm)
    pub interlayers: Vec<f64>,
    /// Interlayer material
    pub interlayer_type: InterlayerType,
    /// Glass type for all plies
    pub glass_type: GlassType,
}

impl LaminatedGlass {
    pub fn new_symmetric(ply_thickness: f64, interlayer: f64, num_plies: usize) -> Self {
        Self {
            plies: vec![ply_thickness; num_plies],
            interlayers: vec![interlayer; num_plies - 1],
            interlayer_type: InterlayerType::PVB,
            glass_type: GlassType::FullyTempered,
        }
    }
    
    /// Total thickness (mm)
    pub fn total_thickness(&self) -> f64 {
        let glass: f64 = self.plies.iter().sum();
        let interlayer: f64 = self.interlayers.iter().sum();
        glass + interlayer
    }
    
    /// Effective thickness for deflection (mm) - prEN 16612
    pub fn effective_thickness_deflection(&self, omega: f64) -> f64 {
        // omega = shear transfer coefficient (0 = no transfer, 1 = full transfer)
        let sum_t3: f64 = self.plies.iter().map(|t| t.powi(3)).sum();
        let _t_total: f64 = self.plies.iter().sum();
        
        // Simplified for 2-ply
        if self.plies.len() == 2 {
            let t1 = self.plies[0];
            let t2 = self.plies[1];
            let tm = self.interlayers[0];
            let hm = (t1 + t2) / 2.0 + tm;
            
            let is = t1 * t2 * hm.powi(2) / (t1 + t2);
            
            (sum_t3 + 12.0 * omega * is).powf(1.0 / 3.0)
        } else {
            // Layered approach for multi-ply
            (sum_t3 * (1.0 + omega * 2.0)).powf(1.0 / 3.0)
        }
    }
    
    /// Effective thickness for stress (mm)
    pub fn effective_thickness_stress(&self, omega: f64, ply_index: usize) -> f64 {
        let hef_w = self.effective_thickness_deflection(omega);
        let ti = self.plies[ply_index];
        
        // Distance from neutral axis to outer surface of ply i
        let mut z = 0.0;
        for (j, t) in self.plies.iter().enumerate() {
            if j < ply_index {
                z += t + self.interlayers.get(j).unwrap_or(&0.0);
            }
        }
        z += ti / 2.0;
        
        // Centroid of laminate
        let total: f64 = self.plies.iter().sum::<f64>() + self.interlayers.iter().sum::<f64>();
        let centroid = total / 2.0;
        
        let e = (z - centroid).abs();
        
        (hef_w.powi(2) / (ti + 2.0 * omega * e)).sqrt()
    }
    
    /// Shear transfer coefficient
    pub fn shear_transfer_coefficient(&self, span: f64, duration_hours: f64) -> f64 {
        let g = if duration_hours < 1.0 {
            self.interlayer_type.shear_modulus_short()
        } else {
            self.interlayer_type.shear_modulus_long()
        };
        
        let e_glass = 70_000.0; // MPa
        let tm: f64 = self.interlayers.iter().sum::<f64>() / self.interlayers.len() as f64;
        
        // Simplified coefficient
        let lambda = (g * span.powi(2)) / (e_glass * tm);
        
        1.0 / (1.0 + 9.6 / lambda)
    }
}

// ============================================================================
// INSULATING GLASS UNIT (IGU)
// ============================================================================

/// Insulating glass unit
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct InsulatingGlassUnit {
    /// Outer pane (may be laminated)
    pub outer_pane: GlassPane,
    /// Inner pane (may be laminated)
    pub inner_pane: GlassPane,
    /// Cavity width (mm)
    pub cavity_width: f64,
    /// Gas fill type
    pub gas_fill: GasFill,
    /// Altitude difference from manufacturing (m)
    pub altitude_diff: f64,
    /// Temperature difference from manufacturing (°C)
    pub temp_diff: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GlassPane {
    pub thickness: f64,
    pub glass_type: GlassType,
    pub is_laminated: bool,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum GasFill {
    Air,
    Argon,
    Krypton,
    Xenon,
}

impl InsulatingGlassUnit {
    pub fn new(outer_t: f64, inner_t: f64, cavity: f64) -> Self {
        Self {
            outer_pane: GlassPane {
                thickness: outer_t,
                glass_type: GlassType::Annealed,
                is_laminated: false,
            },
            inner_pane: GlassPane {
                thickness: inner_t,
                glass_type: GlassType::Annealed,
                is_laminated: false,
            },
            cavity_width: cavity,
            gas_fill: GasFill::Argon,
            altitude_diff: 0.0,
            temp_diff: 0.0,
        }
    }
    
    /// Climate load (isochoric pressure) in kPa
    pub fn climate_load(&self) -> f64 {
        // Altitude effect: ~12 Pa/m
        let p_altitude = 0.012 * self.altitude_diff;
        
        // Temperature effect: ~34 Pa/°C
        let p_temp = 0.034 * self.temp_diff;
        
        p_altitude + p_temp
    }
    
    /// Load sharing factor (outer pane)
    pub fn load_share_outer(&self) -> f64 {
        let t1 = self.outer_pane.thickness;
        let t2 = self.inner_pane.thickness;
        
        t1.powi(3) / (t1.powi(3) + t2.powi(3))
    }
    
    /// Load sharing factor (inner pane)
    pub fn load_share_inner(&self) -> f64 {
        1.0 - self.load_share_outer()
    }
    
    /// U-value (W/m²K) - simplified
    pub fn u_value(&self) -> f64 {
        let r_outer = 0.04; // External surface resistance
        let r_inner = 0.13; // Internal surface resistance
        let r_glass = (self.outer_pane.thickness + self.inner_pane.thickness) / 1000.0 / 1.0;
        
        let r_cavity = match self.gas_fill {
            GasFill::Air => 0.16,
            GasFill::Argon => 0.18,
            GasFill::Krypton => 0.20,
            GasFill::Xenon => 0.22,
        };
        
        1.0 / (r_outer + r_inner + r_glass + r_cavity)
    }
}

// ============================================================================
// ASTM E1300 GLASS DESIGN
// ============================================================================

/// ASTM E1300 load duration
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum LoadDuration {
    /// 3 seconds (wind gust)
    ThreeSeconds,
    /// 1 minute (sustained wind)
    OneMinute,
    /// 10 minutes
    TenMinutes,
    /// 1 hour
    OneHour,
    /// 1 month (snow)
    OneMonth,
    /// Permanent
    Permanent,
}

impl LoadDuration {
    /// Load duration factor per ASTM E1300
    pub fn factor(&self) -> f64 {
        match self {
            LoadDuration::ThreeSeconds => 1.00,
            LoadDuration::OneMinute => 0.93,
            LoadDuration::TenMinutes => 0.83,
            LoadDuration::OneHour => 0.72,
            LoadDuration::OneMonth => 0.47,
            LoadDuration::Permanent => 0.27,
        }
    }
}

/// ASTM E1300 glass panel designer
pub struct AstmE1300Designer {
    /// Panel width (mm)
    pub width: f64,
    /// Panel height (mm)
    pub height: f64,
    /// Glass type
    pub glass_type: GlassType,
    /// Nominal thickness (mm)
    pub thickness: f64,
    /// Edge support conditions
    pub four_side_support: bool,
}

impl AstmE1300Designer {
    pub fn new(width: f64, height: f64, thickness: f64) -> Self {
        Self {
            width,
            height,
            glass_type: GlassType::Annealed,
            thickness,
            four_side_support: true,
        }
    }
    
    /// Aspect ratio (long/short)
    pub fn aspect_ratio(&self) -> f64 {
        let a = self.width.max(self.height);
        let b = self.width.min(self.height);
        a / b
    }
    
    /// Short dimension (mm)
    pub fn short_dimension(&self) -> f64 {
        self.width.min(self.height)
    }
    
    /// Load resistance (kPa) for probability of breakage 8/1000
    pub fn load_resistance(&self, duration: LoadDuration) -> f64 {
        let _b = self.short_dimension();
        let t = self.thickness;
        let ar = self.aspect_ratio();
        
        // Non-factored load (NFL) approximation
        // Based on ASTM E1300 charts - simplified polynomial fit
        let area = self.width * self.height / 1e6; // m²
        
        // Base capacity for annealed glass
        let nfl_base = match self.thickness as u32 {
            3 => 0.8 + 0.5 / area.sqrt(),
            4 => 1.1 + 0.7 / area.sqrt(),
            5 => 1.5 + 0.9 / area.sqrt(),
            6 => 2.0 + 1.2 / area.sqrt(),
            8 => 3.0 + 1.8 / area.sqrt(),
            10 => 4.5 + 2.5 / area.sqrt(),
            12 => 6.0 + 3.2 / area.sqrt(),
            _ => {
                // Interpolate
                let base = 0.02 * t.powi(2) + 0.1 * t;
                base + base * 0.5 / area.sqrt()
            }
        };
        
        // Aspect ratio adjustment
        let ar_factor = if ar < 1.5 {
            1.0
        } else if ar < 3.0 {
            1.0 + 0.1 * (ar - 1.5)
        } else {
            1.15
        };
        
        // Glass type factor (GTF)
        let gtf = match self.glass_type {
            GlassType::Annealed => 1.0,
            GlassType::HeatStrengthened => 2.0,
            GlassType::FullyTempered => 4.0,
            GlassType::ChemicallyStrengthened => 5.0,
        };
        
        // Load duration factor
        let ldf = duration.factor();
        
        nfl_base * ar_factor * gtf * ldf
    }
    
    /// Center deflection under uniform load (mm)
    pub fn center_deflection(&self, load_kpa: f64) -> f64 {
        let a = self.width.max(self.height);
        let b = self.width.min(self.height);
        let t = self.thickness;
        let e = 70_000.0; // MPa
        let _nu = 0.22;
        
        let ar = a / b;
        
        // Plate coefficient (Roark's)
        let alpha = if ar < 1.2 {
            0.0138
        } else if ar < 1.5 {
            0.0188
        } else if ar < 2.0 {
            0.0226
        } else {
            0.0284
        };
        
        // q in N/mm², b in mm, t in mm
        let q = load_kpa / 1000.0; // N/mm²
        
        alpha * q * b.powi(4) / (e * t.powi(3))
    }
    
    /// Maximum stress under uniform load (MPa)
    pub fn max_stress(&self, load_kpa: f64) -> f64 {
        let a = self.width.max(self.height);
        let b = self.width.min(self.height);
        let t = self.thickness;
        let ar = a / b;
        
        // Stress coefficient (Roark's)
        let beta = if ar < 1.2 {
            0.287
        } else if ar < 1.5 {
            0.348
        } else if ar < 2.0 {
            0.400
        } else {
            0.455
        };
        
        let q = load_kpa / 1000.0; // N/mm²
        
        beta * q * b.powi(2) / t.powi(2)
    }
    
    /// Design check
    pub fn check(&self, load_kpa: f64, duration: LoadDuration) -> GlassCheckResult {
        let capacity = self.load_resistance(duration);
        let stress = self.max_stress(load_kpa);
        let deflection = self.center_deflection(load_kpa);
        
        // Allowable deflection: L/60 or 19mm for IGU
        let b = self.short_dimension();
        let defl_limit = (b / 60.0).min(19.0);
        
        let utilization = load_kpa / capacity;
        
        GlassCheckResult {
            load_applied: load_kpa,
            load_resistance: capacity,
            utilization,
            max_stress: stress,
            center_deflection: deflection,
            deflection_limit: defl_limit,
            strength_ok: utilization <= 1.0,
            deflection_ok: deflection <= defl_limit,
            overall_pass: utilization <= 1.0 && deflection <= defl_limit,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GlassCheckResult {
    pub load_applied: f64,
    pub load_resistance: f64,
    pub utilization: f64,
    pub max_stress: f64,
    pub center_deflection: f64,
    pub deflection_limit: f64,
    pub strength_ok: bool,
    pub deflection_ok: bool,
    pub overall_pass: bool,
}

// ============================================================================
// POINT-SUPPORTED GLASS
// ============================================================================

/// Point support type
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum PointSupportType {
    /// Countersunk bolt through hole
    Countersunk,
    /// Button/patch fitting (surface mounted)
    ButtonFitting,
    /// Spider fitting with articulated arm
    SpiderArticulated,
    /// Spider fitting with rigid arm
    SpiderRigid,
}

/// Point-supported glass panel
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PointSupportedGlass {
    pub width: f64,
    pub height: f64,
    pub thickness: f64,
    pub glass_type: GlassType,
    pub support_type: PointSupportType,
    /// Hole diameter (mm) if applicable
    pub hole_diameter: f64,
    /// Edge distance from hole center (mm)
    pub edge_distance: f64,
    /// Number of support points
    pub num_supports: u32,
}

impl PointSupportedGlass {
    pub fn new_four_point(width: f64, height: f64, thickness: f64) -> Self {
        Self {
            width,
            height,
            thickness,
            glass_type: GlassType::FullyTempered,
            support_type: PointSupportType::Countersunk,
            hole_diameter: 30.0,
            edge_distance: 100.0,
            num_supports: 4,
        }
    }
    
    /// Minimum edge distance requirement (mm)
    pub fn min_edge_distance(&self) -> f64 {
        // Typically 2.5 × hole diameter
        2.5 * self.hole_diameter
    }
    
    /// Hole stress concentration factor
    pub fn hole_scf(&self) -> f64 {
        // Typical SCF for countersunk holes
        match self.support_type {
            PointSupportType::Countersunk => 2.5,
            PointSupportType::ButtonFitting => 1.0,
            PointSupportType::SpiderArticulated => 1.5,
            PointSupportType::SpiderRigid => 2.0,
        }
    }
    
    /// Allowable stress at hole (MPa)
    pub fn allowable_hole_stress(&self) -> f64 {
        let base = self.glass_type.characteristic_strength();
        let scf = self.hole_scf();
        
        // Safety factor of 2.5, reduced by SCF
        base / (2.5 * scf)
    }
    
    /// Approximate stress at support under uniform load (MPa)
    pub fn support_stress(&self, load_kpa: f64) -> f64 {
        let area = self.width * self.height / 1e6;
        let total_load = load_kpa * area * 1000.0; // N
        let load_per_support = total_load / (self.num_supports as f64);
        
        let t = self.thickness;
        let d = self.hole_diameter;
        
        // Simplified stress at hole edge
        let scf = self.hole_scf();
        
        // Moment arm approximation
        let m = load_per_support * (self.width.min(self.height) / 4.0 / (self.num_supports as f64).sqrt());
        
        // Bending stress
        let sigma = 6.0 * m / (d * t.powi(2)) * scf;
        
        sigma / 1000.0 // MPa
    }
}

// ============================================================================
// FACADE FRAMING
// ============================================================================

/// Facade system type
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum FacadeSystem {
    /// Stick-built curtain wall
    StickCurtainWall,
    /// Unitized curtain wall
    UnitizedCurtainWall,
    /// Point-fixed glazing
    PointFixed,
    /// Structural silicone glazing
    StructuralSilicone,
    /// Cable-net facade
    CableNet,
}

/// Mullion design
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Mullion {
    pub depth: f64,          // mm
    pub width: f64,          // mm
    pub wall_thickness: f64, // mm
    pub span: f64,           // mm
    pub moment_of_inertia: f64, // mm⁴
    pub section_modulus: f64,   // mm³
    pub material_fy: f64,       // MPa
}

impl Mullion {
    /// Create rectangular hollow section mullion
    pub fn new_rhs(depth: f64, width: f64, wall: f64, span: f64) -> Self {
        let d = depth;
        let b = width;
        let t = wall;
        
        // RHS properties
        let i = (b * d.powi(3) - (b - 2.0 * t) * (d - 2.0 * t).powi(3)) / 12.0;
        let z = 2.0 * i / d;
        
        Self {
            depth,
            width,
            wall_thickness: wall,
            span,
            moment_of_inertia: i,
            section_modulus: z,
            material_fy: 160.0, // Aluminum 6063-T6
        }
    }
    
    /// Wind load per meter on mullion (N/m)
    pub fn wind_load(&self, pressure_kpa: f64, tributary_width: f64) -> f64 {
        pressure_kpa * 1000.0 * tributary_width / 1000.0
    }
    
    /// Maximum moment under uniform load (N·mm)
    pub fn max_moment(&self, w_per_m: f64) -> f64 {
        // Simply supported beam - convert N/m to N/mm for consistency with span in mm
        let w = w_per_m / 1000.0; // N/m → N/mm
        w * self.span.powi(2) / 8.0
    }
    
    /// Maximum stress (MPa)
    pub fn max_stress(&self, w_per_m: f64) -> f64 {
        let m = self.max_moment(w_per_m);
        m / self.section_modulus
    }
    
    /// Maximum deflection (mm)
    pub fn max_deflection(&self, w_per_m: f64) -> f64 {
        let e = 70_000.0; // MPa for aluminum
        let w = w_per_m / 1000.0; // N/m → N/mm for consistency with span in mm
        5.0 * w * self.span.powi(4) / (384.0 * e * self.moment_of_inertia)
    }
    
    /// Design check
    pub fn check(&self, pressure_kpa: f64, tributary_width: f64) -> MullionCheckResult {
        let w = self.wind_load(pressure_kpa, tributary_width);
        let stress = self.max_stress(w);
        let deflection = self.max_deflection(w);
        
        let allowable_stress = self.material_fy / 1.65;
        let deflection_limit = self.span / 175.0;
        
        MullionCheckResult {
            wind_load_per_m: w,
            max_moment: self.max_moment(w),
            max_stress: stress,
            allowable_stress,
            max_deflection: deflection,
            deflection_limit,
            stress_ratio: stress / allowable_stress,
            deflection_ratio: deflection / deflection_limit,
            pass: stress <= allowable_stress && deflection <= deflection_limit,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MullionCheckResult {
    pub wind_load_per_m: f64,
    pub max_moment: f64,
    pub max_stress: f64,
    pub allowable_stress: f64,
    pub max_deflection: f64,
    pub deflection_limit: f64,
    pub stress_ratio: f64,
    pub deflection_ratio: f64,
    pub pass: bool,
}

// ============================================================================
// STRUCTURAL SILICONE SEALANT
// ============================================================================

/// Structural silicone design
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StructuralSilicone {
    /// Bite width (mm)
    pub bite: f64,
    /// Joint width (mm)
    pub joint_width: f64,
    /// Glass perimeter (mm)
    pub perimeter: f64,
    /// Design strength (kPa)
    pub design_strength: f64,
}

impl StructuralSilicone {
    pub fn new(bite: f64, joint_width: f64) -> Self {
        Self {
            bite,
            joint_width,
            perimeter: 0.0,
            design_strength: 140.0, // Typical structural silicone
        }
    }
    
    /// Required bite for wind load (mm)
    pub fn required_bite(&self, pressure_kpa: f64, glass_width: f64, glass_height: f64) -> f64 {
        let area = glass_width * glass_height / 1e6; // m²
        let short_dim = glass_width.min(glass_height);
        
        // Stress on short edge governs
        let bite_required = pressure_kpa * area * 1e6 / (2.0 * short_dim * self.design_strength);
        
        bite_required.max(6.0) // Minimum 6mm bite
    }
    
    /// Wind load capacity (kPa)
    pub fn wind_capacity(&self, glass_width: f64, glass_height: f64) -> f64 {
        let area = glass_width * glass_height / 1e6;
        let short_dim = glass_width.min(glass_height);
        
        2.0 * short_dim * self.bite * self.design_strength / (area * 1e6)
    }
    
    /// Movement capacity (mm)
    pub fn movement_capacity(&self) -> f64 {
        // Typically 12.5% to 25% of joint width
        self.joint_width * 0.125
    }
}

// ============================================================================
// TESTS
// ============================================================================

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_glass_strength() {
        assert_eq!(GlassType::Annealed.characteristic_strength(), 45.0);
        assert!(GlassType::FullyTempered.characteristic_strength() > 
                GlassType::HeatStrengthened.characteristic_strength());
    }

    #[test]
    fn test_laminated_thickness() {
        let lam = LaminatedGlass::new_symmetric(6.0, 1.52, 2);
        
        let total = lam.total_thickness();
        assert!((total - 13.52).abs() < 0.01);
    }

    #[test]
    fn test_effective_thickness() {
        let lam = LaminatedGlass::new_symmetric(6.0, 1.52, 2);
        
        let hef_0 = lam.effective_thickness_deflection(0.0);
        let hef_1 = lam.effective_thickness_deflection(1.0);
        
        assert!(hef_1 > hef_0); // Full transfer gives more effective thickness
    }

    #[test]
    fn test_igu_climate_load() {
        let mut igu = InsulatingGlassUnit::new(6.0, 6.0, 16.0);
        igu.altitude_diff = 500.0;
        igu.temp_diff = 20.0;
        
        let p = igu.climate_load();
        assert!(p > 0.0);
    }

    #[test]
    fn test_igu_load_share() {
        let igu = InsulatingGlassUnit::new(6.0, 6.0, 16.0);
        
        let outer = igu.load_share_outer();
        let inner = igu.load_share_inner();
        
        assert!((outer + inner - 1.0).abs() < 0.001);
        assert!((outer - 0.5).abs() < 0.001); // Equal panes
    }

    #[test]
    fn test_astm_e1300_capacity() {
        let designer = AstmE1300Designer::new(1500.0, 2000.0, 6.0);
        
        let capacity = designer.load_resistance(LoadDuration::ThreeSeconds);
        assert!(capacity > 0.0 && capacity < 10.0);
    }

    #[test]
    fn test_tempered_stronger() {
        let mut designer = AstmE1300Designer::new(1500.0, 2000.0, 6.0);
        designer.glass_type = GlassType::Annealed;
        let cap_ann = designer.load_resistance(LoadDuration::ThreeSeconds);
        
        designer.glass_type = GlassType::FullyTempered;
        let cap_temp = designer.load_resistance(LoadDuration::ThreeSeconds);
        
        assert!(cap_temp > cap_ann * 3.0);
    }

    #[test]
    fn test_glass_deflection() {
        let designer = AstmE1300Designer::new(1500.0, 2000.0, 6.0);
        let defl = designer.center_deflection(1.0);
        
        assert!(defl > 0.0 && defl < 50.0);
    }

    #[test]
    fn test_glass_check() {
        let mut designer = AstmE1300Designer::new(1500.0, 2000.0, 6.0);
        designer.glass_type = GlassType::FullyTempered;
        
        let result = designer.check(2.0, LoadDuration::ThreeSeconds);
        
        assert!(result.overall_pass);
    }

    #[test]
    fn test_point_supported() {
        let glass = PointSupportedGlass::new_four_point(1500.0, 1500.0, 12.0);
        
        assert!(glass.edge_distance >= glass.min_edge_distance());
    }

    #[test]
    fn test_mullion_design() {
        let mullion = Mullion::new_rhs(150.0, 60.0, 3.0, 4000.0);
        
        assert!(mullion.moment_of_inertia > 0.0);
        assert!(mullion.section_modulus > 0.0);
    }

    #[test]
    fn test_mullion_check() {
        let mullion = Mullion::new_rhs(150.0, 60.0, 3.0, 4000.0);
        let result = mullion.check(2.0, 1500.0);
        
        assert!(result.max_stress > 0.0);
    }

    #[test]
    fn test_structural_silicone() {
        let ssc = StructuralSilicone::new(10.0, 12.0);
        
        let required = ssc.required_bite(3.0, 1500.0, 2000.0);
        assert!(required > 0.0);
        
        let capacity = ssc.wind_capacity(1500.0, 2000.0);
        assert!(capacity > 0.0);
    }

    #[test]
    fn test_interlayer_shear() {
        assert!(InterlayerType::SGP.shear_modulus_short() > 
                InterlayerType::PVB.shear_modulus_short());
    }

    #[test]
    fn test_load_duration() {
        assert!(LoadDuration::ThreeSeconds.factor() > LoadDuration::Permanent.factor());
    }

    #[test]
    fn test_igu_u_value() {
        let igu = InsulatingGlassUnit::new(6.0, 6.0, 16.0);
        let u = igu.u_value();
        
        assert!(u > 1.0 && u < 4.0);
    }
}
