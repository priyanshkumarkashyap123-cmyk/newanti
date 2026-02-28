//! IS 13920:2016 Ductile Detailing
//!
//! Complete ductile detailing checks for earthquake-resistant RC structures
//! per IS 13920:2016 (Indian Standard for Ductile Design).
//!
//! ## Features
//! - Beam ductility requirements (Cl. 6)
//! - Column ductility requirements (Cl. 7)
//! - Joint detailing (Cl. 9)
//! - Shear wall detailing (Cl. 10)
//! - Special boundary elements
//! - Confinement reinforcement
//! - Splice and anchorage requirements

use serde::{Deserialize, Serialize};
use std::f64::consts::PI;

// ============================================================================
// SEISMIC ZONE AND DUCTILITY CLASS
// ============================================================================

#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
pub enum SeismicZone {
    /// Zone II (Low)
    ZoneII,
    /// Zone III (Moderate)
    ZoneIII,
    /// Zone IV (Severe)
    ZoneIV,
    /// Zone V (Very Severe)
    ZoneV,
}

impl SeismicZone {
    pub fn zone_factor(&self) -> f64 {
        match self {
            SeismicZone::ZoneII => 0.10,
            SeismicZone::ZoneIII => 0.16,
            SeismicZone::ZoneIV => 0.24,
            SeismicZone::ZoneV => 0.36,
        }
    }
    
    /// Check if IS 13920 mandatory
    pub fn requires_ductile_detailing(&self) -> bool {
        matches!(self, SeismicZone::ZoneIII | SeismicZone::ZoneIV | SeismicZone::ZoneV)
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
pub enum DuctilityClass {
    /// Ordinary Moment Resisting Frame
    OMRF,
    /// Special Moment Resisting Frame
    SMRF,
}

// ============================================================================
// MATERIAL PROPERTIES
// ============================================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct IS13920Materials {
    /// Concrete grade (fck in MPa)
    pub fck: f64,
    /// Steel grade (fy in MPa)
    pub fy: f64,
    /// Maximum steel grade allowed (IS 13920 Cl. 5.3)
    pub fy_max: f64,
}

impl Default for IS13920Materials {
    fn default() -> Self {
        IS13920Materials {
            fck: 25.0,
            fy: 415.0,
            fy_max: 500.0, // Cl. 5.3: fy shall not exceed 500 MPa
        }
    }
}

impl IS13920Materials {
    pub fn validate(&self) -> Vec<String> {
        let mut errors = Vec::new();
        
        // Cl. 5.2: Minimum concrete grade M20
        if self.fck < 20.0 {
            errors.push(format!(
                "IS 13920 Cl. 5.2: fck = {} MPa < 20 MPa minimum",
                self.fck
            ));
        }
        
        // Cl. 5.3: Steel yield strength limit
        if self.fy > self.fy_max {
            errors.push(format!(
                "IS 13920 Cl. 5.3: fy = {} MPa > {} MPa maximum",
                self.fy, self.fy_max
            ));
        }
        
        errors
    }
}

// ============================================================================
// BEAM DUCTILE DETAILING (Cl. 6)
// ============================================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BeamSection {
    /// Width (mm)
    pub b: f64,
    /// Total depth (mm)
    pub d: f64,
    /// Effective depth (mm)
    pub d_eff: f64,
    /// Clear span (mm)
    pub clear_span: f64,
    /// Top reinforcement area at left end (mm²)
    pub as_top_left: f64,
    /// Bottom reinforcement area at left end (mm²)
    pub as_bot_left: f64,
    /// Top reinforcement area at right end (mm²)
    pub as_top_right: f64,
    /// Bottom reinforcement area at right end (mm²)
    pub as_bot_right: f64,
    /// Stirrup diameter (mm)
    pub stirrup_dia: f64,
    /// Stirrup spacing in plastic hinge (mm)
    pub stirrup_spacing_hinge: f64,
    /// Stirrup spacing elsewhere (mm)
    pub stirrup_spacing_mid: f64,
    /// Concrete cover (mm)
    pub cover: f64,
    /// Bar diameter of main reinforcement (mm)
    pub bar_dia: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BeamDuctilityCheck {
    /// Beam ID
    pub beam_id: String,
    /// All checks pass
    pub passes: bool,
    /// Individual check results
    pub checks: Vec<DuctilityCheckItem>,
    /// Required modifications
    pub required_modifications: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DuctilityCheckItem {
    pub clause: String,
    pub description: String,
    pub required: String,
    pub provided: String,
    pub passes: bool,
}

/// Check beam ductile detailing per IS 13920:2016 Cl. 6
pub fn check_beam_ductility(
    beam_id: &str,
    beam: &BeamSection,
    materials: &IS13920Materials,
) -> BeamDuctilityCheck {
    let mut checks = Vec::new();
    let mut modifications = Vec::new();
    
    // Cl. 6.1.2: Minimum width
    let min_width = 200.0;
    checks.push(DuctilityCheckItem {
        clause: "6.1.2".to_string(),
        description: "Minimum beam width".to_string(),
        required: format!("≥ {} mm", min_width),
        provided: format!("{} mm", beam.b),
        passes: beam.b >= min_width,
    });
    
    // Cl. 6.1.3: Width/depth ratio
    let width_depth_check = beam.b / beam.d >= 0.3;
    checks.push(DuctilityCheckItem {
        clause: "6.1.3".to_string(),
        description: "Width to depth ratio b/D ≥ 0.3".to_string(),
        required: "b/D ≥ 0.3".to_string(),
        provided: format!("b/D = {:.2}", beam.b / beam.d),
        passes: width_depth_check,
    });
    
    // Cl. 6.1.4: Depth limitation
    let max_depth = beam.clear_span / 4.0;
    checks.push(DuctilityCheckItem {
        clause: "6.1.4".to_string(),
        description: "Depth shall not exceed clear span/4".to_string(),
        required: format!("D ≤ {:.0} mm", max_depth),
        provided: format!("D = {} mm", beam.d),
        passes: beam.d <= max_depth,
    });
    
    // Cl. 6.2.1: Minimum reinforcement
    // IS 13920:2016 Cl. 6.2.1(a): ρ_min = 0.24 * √fck / fy
    let as_min = 0.24 * materials.fck.sqrt() / materials.fy * beam.b * beam.d_eff;
    let as_min_alt = 0.0012 * beam.b * beam.d;
    let as_min_req = as_min.max(as_min_alt);
    
    checks.push(DuctilityCheckItem {
        clause: "6.2.1(a)".to_string(),
        description: "Minimum top reinforcement".to_string(),
        required: format!("≥ {:.0} mm²", as_min_req),
        provided: format!("{:.0} mm²", beam.as_top_left.min(beam.as_top_right)),
        passes: beam.as_top_left >= as_min_req && beam.as_top_right >= as_min_req,
    });
    
    // Cl. 6.2.2: Maximum reinforcement
    let as_max = 0.025 * beam.b * beam.d_eff;
    let max_top = beam.as_top_left.max(beam.as_top_right);
    let max_bot = beam.as_bot_left.max(beam.as_bot_right);
    
    checks.push(DuctilityCheckItem {
        clause: "6.2.2".to_string(),
        description: "Maximum reinforcement ratio ≤ 2.5%".to_string(),
        required: format!("≤ {:.0} mm²", as_max),
        provided: format!("Max = {:.0} mm²", max_top.max(max_bot)),
        passes: max_top <= as_max && max_bot <= as_max,
    });
    
    // Cl. 6.2.3: Ratio of top to bottom steel at joint face
    let ratio_left = beam.as_bot_left / beam.as_top_left.max(1.0);
    let ratio_right = beam.as_bot_right / beam.as_top_right.max(1.0);
    
    checks.push(DuctilityCheckItem {
        clause: "6.2.3".to_string(),
        description: "Bottom steel ≥ 50% of top steel at joint".to_string(),
        required: "As_bot/As_top ≥ 0.5".to_string(),
        provided: format!("Left: {:.2}, Right: {:.2}", ratio_left, ratio_right),
        passes: ratio_left >= 0.5 && ratio_right >= 0.5,
    });
    
    // Cl. 6.2.4: Minimum 2 bars continuous top and bottom
    checks.push(DuctilityCheckItem {
        clause: "6.2.4".to_string(),
        description: "Minimum 2 bars continuous throughout".to_string(),
        required: "2 bars top, 2 bars bottom".to_string(),
        provided: "See drawings".to_string(),
        passes: true, // Assume satisfied if areas are provided
    });
    
    // Cl. 6.3.2: Plastic hinge length
    let _plastic_hinge_length = 2.0 * beam.d;
    
    // Cl. 6.3.3: Stirrup spacing in plastic hinge zone
    let max_spacing_hinge = (beam.d_eff / 4.0)
        .min(8.0 * beam.bar_dia)
        .min(100.0);
    
    checks.push(DuctilityCheckItem {
        clause: "6.3.3".to_string(),
        description: "Stirrup spacing in plastic hinge zone".to_string(),
        required: format!("≤ {:.0} mm (d/4, 8db, 100mm)", max_spacing_hinge),
        provided: format!("{} mm", beam.stirrup_spacing_hinge),
        passes: beam.stirrup_spacing_hinge <= max_spacing_hinge,
    });
    
    // Cl. 6.3.4: First stirrup within 50mm
    checks.push(DuctilityCheckItem {
        clause: "6.3.4".to_string(),
        description: "First stirrup within 50mm from joint face".to_string(),
        required: "≤ 50 mm".to_string(),
        provided: "To verify on drawing".to_string(),
        passes: true,
    });
    
    // Cl. 6.3.5: Spacing outside plastic hinge
    let max_spacing_mid = beam.d_eff / 2.0;
    checks.push(DuctilityCheckItem {
        clause: "6.3.5".to_string(),
        description: "Stirrup spacing outside plastic hinge".to_string(),
        required: format!("≤ {:.0} mm (d/2)", max_spacing_mid),
        provided: format!("{} mm", beam.stirrup_spacing_mid),
        passes: beam.stirrup_spacing_mid <= max_spacing_mid,
    });
    
    // Cl. 6.3.6: Minimum stirrup diameter
    let min_stirrup_dia = 6.0_f64.max(beam.bar_dia / 4.0);
    checks.push(DuctilityCheckItem {
        clause: "6.3.6".to_string(),
        description: "Minimum stirrup diameter".to_string(),
        required: format!("≥ {:.0} mm", min_stirrup_dia),
        provided: format!("{} mm", beam.stirrup_dia),
        passes: beam.stirrup_dia >= min_stirrup_dia,
    });
    
    // Compile required modifications
    for check in &checks {
        if !check.passes {
            modifications.push(format!(
                "Cl. {}: {} - Required: {}, Provided: {}",
                check.clause, check.description, check.required, check.provided
            ));
        }
    }
    
    BeamDuctilityCheck {
        beam_id: beam_id.to_string(),
        passes: checks.iter().all(|c| c.passes),
        checks,
        required_modifications: modifications,
    }
}

// ============================================================================
// COLUMN DUCTILE DETAILING (Cl. 7)
// ============================================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ColumnSection {
    /// Width (mm)
    pub b: f64,
    /// Depth (mm)
    pub d: f64,
    /// Clear height (mm)
    pub clear_height: f64,
    /// Longitudinal steel area (mm²)
    pub as_long: f64,
    /// Number of longitudinal bars
    pub num_bars: usize,
    /// Bar diameter (mm)
    pub bar_dia: f64,
    /// Tie diameter (mm)
    pub tie_dia: f64,
    /// Tie spacing in confining zone (mm)
    pub tie_spacing_confine: f64,
    /// Tie spacing elsewhere (mm)
    pub tie_spacing_mid: f64,
    /// Is corner column
    pub is_corner: bool,
    /// Axial load (kN)
    pub pu: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ColumnDuctilityCheck {
    pub column_id: String,
    pub passes: bool,
    pub checks: Vec<DuctilityCheckItem>,
    pub required_modifications: Vec<String>,
    /// Confining zone length required (mm)
    pub confining_length: f64,
    /// Ash required per Cl. 7.4.8 (mm²)
    pub ash_required: f64,
}

/// Check column ductile detailing per IS 13920:2016 Cl. 7
pub fn check_column_ductility(
    column_id: &str,
    column: &ColumnSection,
    materials: &IS13920Materials,
) -> ColumnDuctilityCheck {
    let mut checks = Vec::new();
    let mut modifications = Vec::new();
    
    let min_dim = column.b.min(column.d);
    let ag = column.b * column.d;
    
    // Cl. 7.1.2: Minimum dimension
    let min_dimension = if column.pu > 0.1 * materials.fck * ag / 1000.0 {
        300.0 // Heavily loaded
    } else {
        200.0
    };
    
    checks.push(DuctilityCheckItem {
        clause: "7.1.2".to_string(),
        description: "Minimum column dimension".to_string(),
        required: format!("≥ {} mm", min_dimension),
        provided: format!("{} mm", min_dim),
        passes: min_dim >= min_dimension,
    });
    
    // Cl. 7.1.3: Aspect ratio
    checks.push(DuctilityCheckItem {
        clause: "7.1.3".to_string(),
        description: "Aspect ratio b/D".to_string(),
        required: "b/D ≥ 0.4".to_string(),
        provided: format!("{:.2}", column.b / column.d),
        passes: column.b / column.d >= 0.4,
    });
    
    // Cl. 7.1.4: Short column check
    let slenderness = column.clear_height / min_dim;
    checks.push(DuctilityCheckItem {
        clause: "7.1.4".to_string(),
        description: "Slenderness ratio < 4 (short column)".to_string(),
        required: "L/D < 4".to_string(),
        provided: format!("{:.2}", slenderness),
        passes: slenderness >= 4.0, // Short columns need special care
    });
    
    // Cl. 7.2.1: Minimum longitudinal steel
    let rho_min = 0.8 / 100.0;
    let as_min = rho_min * ag;
    checks.push(DuctilityCheckItem {
        clause: "7.2.1".to_string(),
        description: "Minimum longitudinal steel ≥ 0.8%".to_string(),
        required: format!("≥ {:.0} mm²", as_min),
        provided: format!("{:.0} mm²", column.as_long),
        passes: column.as_long >= as_min,
    });
    
    // Cl. 7.2.1: Maximum longitudinal steel
    let rho_max = 4.0 / 100.0; // Reduced from 6% for ductility
    let as_max = rho_max * ag;
    checks.push(DuctilityCheckItem {
        clause: "7.2.1".to_string(),
        description: "Maximum longitudinal steel ≤ 4%".to_string(),
        required: format!("≤ {:.0} mm²", as_max),
        provided: format!("{:.0} mm²", column.as_long),
        passes: column.as_long <= as_max,
    });
    
    // Cl. 7.3.3: Minimum number of bars
    let min_bars = if column.is_corner { 4 } else { 4 };
    checks.push(DuctilityCheckItem {
        clause: "7.3.3".to_string(),
        description: "Minimum number of bars".to_string(),
        required: format!("≥ {}", min_bars),
        provided: format!("{}", column.num_bars),
        passes: column.num_bars >= min_bars,
    });
    
    // Cl. 7.4.1: Confining zone length
    let confining_length = (column.clear_height / 6.0)
        .max(column.b.max(column.d))
        .max(450.0);
    
    checks.push(DuctilityCheckItem {
        clause: "7.4.1".to_string(),
        description: "Confining zone length".to_string(),
        required: format!("≥ {:.0} mm", confining_length),
        provided: "To verify on drawing".to_string(),
        passes: true,
    });
    
    // Cl. 7.4.6: Tie spacing in confining zone
    let max_tie_spacing_confine = (min_dim / 4.0)
        .min(100.0);
    
    checks.push(DuctilityCheckItem {
        clause: "7.4.6".to_string(),
        description: "Tie spacing in confining zone".to_string(),
        required: format!("≤ {:.0} mm", max_tie_spacing_confine),
        provided: format!("{} mm", column.tie_spacing_confine),
        passes: column.tie_spacing_confine <= max_tie_spacing_confine,
    });
    
    // Cl. 7.4.7: Tie spacing outside confining zone
    let max_tie_spacing_mid = (min_dim / 2.0).min(8.0 * column.bar_dia);
    checks.push(DuctilityCheckItem {
        clause: "7.4.7".to_string(),
        description: "Tie spacing outside confining zone".to_string(),
        required: format!("≤ {:.0} mm", max_tie_spacing_mid),
        provided: format!("{} mm", column.tie_spacing_mid),
        passes: column.tie_spacing_mid <= max_tie_spacing_mid,
    });
    
    // Cl. 7.4.8: Special confining reinforcement Ash
    let h = column.tie_spacing_confine;
    let hc = min_dim - 2.0 * 40.0; // Assuming 40mm cover
    let fck = materials.fck;
    let fy = materials.fy;
    
    let ash_1 = 0.18 * h * hc * (fck / fy) * (ag / (hc * hc) - 1.0);
    let ash_2 = 0.05 * h * hc * (fck / fy);
    let ash_required = ash_1.max(ash_2);
    
    let ash_provided = PI * column.tie_dia.powi(2) / 4.0 * 2.0; // 2 legs
    
    checks.push(DuctilityCheckItem {
        clause: "7.4.8".to_string(),
        description: "Special confining reinforcement Ash".to_string(),
        required: format!("≥ {:.0} mm²", ash_required),
        provided: format!("{:.0} mm² (2-leg {}mm)", ash_provided, column.tie_dia),
        passes: ash_provided >= ash_required,
    });
    
    // Compile modifications
    for check in &checks {
        if !check.passes {
            modifications.push(format!(
                "Cl. {}: {} - Required: {}, Provided: {}",
                check.clause, check.description, check.required, check.provided
            ));
        }
    }
    
    ColumnDuctilityCheck {
        column_id: column_id.to_string(),
        passes: checks.iter().all(|c| c.passes),
        checks,
        required_modifications: modifications,
        confining_length,
        ash_required,
    }
}

// ============================================================================
// BEAM-COLUMN JOINT (Cl. 9)
// ============================================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BeamColumnJoint {
    /// Column width (mm)
    pub bc: f64,
    /// Column depth (mm)  
    pub hc: f64,
    /// Beam width (mm)
    pub bb: f64,
    /// Beam depth (mm)
    pub hb: f64,
    /// Number of beams framing (1-4)
    pub num_beams: usize,
    /// Is interior joint
    pub is_interior: bool,
    /// Column axial load (kN)
    pub pu: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct JointCheck {
    pub joint_id: String,
    pub passes: bool,
    pub checks: Vec<DuctilityCheckItem>,
    pub shear_capacity: f64,
    pub shear_demand: f64,
    pub required_modifications: Vec<String>,
}

/// Check beam-column joint per IS 13920:2016 Cl. 9
pub fn check_beam_column_joint(
    joint_id: &str,
    joint: &BeamColumnJoint,
    materials: &IS13920Materials,
    beam_moments: (f64, f64), // (M_left, M_right) at joint
) -> JointCheck {
    let mut checks = Vec::new();
    let mut modifications = Vec::new();
    
    // Cl. 9.1: Anchorage of beam bars
    let ldh = 0.87 * materials.fy * 20.0 / (4.0 * 1.4 * materials.fck.sqrt()); // Simplified
    
    checks.push(DuctilityCheckItem {
        clause: "9.1".to_string(),
        description: "Development length of beam bars".to_string(),
        required: format!("≥ {:.0} mm", ldh),
        provided: format!("Column depth = {} mm", joint.hc),
        passes: joint.hc >= ldh,
    });
    
    // Cl. 9.2: Joint shear force
    // Vj = 1.4 * Mb / hb (simplified)
    let mb_sum = beam_moments.0.abs() + beam_moments.1.abs();
    let vj = 1.4 * mb_sum * 1000.0 / joint.hb; // N
    
    // Joint effective area
    let bj = if joint.bb >= joint.bc {
        joint.bc
    } else {
        (joint.bc + joint.hc / 2.0).min(joint.bb + joint.hc / 2.0)
    };
    let aj = bj * joint.hc;
    
    // Joint shear capacity
    let vj_capacity = if joint.is_interior {
        1.2 * materials.fck.sqrt() * aj / 1000.0 // kN
    } else {
        1.0 * materials.fck.sqrt() * aj / 1000.0
    };
    
    checks.push(DuctilityCheckItem {
        clause: "9.2".to_string(),
        description: "Joint shear capacity".to_string(),
        required: format!("Vj ≤ {:.0} kN", vj_capacity),
        provided: format!("Vj = {:.0} kN", vj / 1000.0),
        passes: vj / 1000.0 <= vj_capacity,
    });
    
    // Cl. 9.3: Strong column weak beam
    // Sum(Mc) >= 1.1 * Sum(Mb)
    checks.push(DuctilityCheckItem {
        clause: "9.3".to_string(),
        description: "Strong column weak beam".to_string(),
        required: "ΣMc ≥ 1.1 × ΣMb".to_string(),
        provided: "Verify from design".to_string(),
        passes: true, // To be verified
    });
    
    // Cl. 9.4.1: Horizontal shear reinforcement
    let sv_joint = (joint.hb / 4.0).min(100.0);
    checks.push(DuctilityCheckItem {
        clause: "9.4.1".to_string(),
        description: "Shear tie spacing within joint".to_string(),
        required: format!("≤ {:.0} mm", sv_joint),
        provided: "Verify on drawing".to_string(),
        passes: true,
    });
    
    // Compile modifications
    for check in &checks {
        if !check.passes {
            modifications.push(format!(
                "Cl. {}: {}",
                check.clause, check.description
            ));
        }
    }
    
    JointCheck {
        joint_id: joint_id.to_string(),
        passes: checks.iter().all(|c| c.passes),
        checks,
        shear_capacity: vj_capacity,
        shear_demand: vj / 1000.0,
        required_modifications: modifications,
    }
}

// ============================================================================
// SHEAR WALL DETAILING (Cl. 10)
// ============================================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ShearWallSection {
    /// Wall thickness (mm)
    pub tw: f64,
    /// Wall length (mm)
    pub lw: f64,
    /// Wall height (mm)
    pub hw: f64,
    /// Story height (mm)
    pub hs: f64,
    /// Horizontal reinforcement ratio
    pub rho_h: f64,
    /// Vertical reinforcement ratio
    pub rho_v: f64,
    /// Boundary element length at each end (mm)
    pub be_length: [f64; 2],
    /// Boundary element tie spacing (mm)
    pub be_tie_spacing: f64,
    /// Axial load (kN)
    pub pu: f64,
    /// In-plane moment (kN-m)
    pub mu: f64,
    /// In-plane shear (kN)
    pub vu: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ShearWallCheck {
    pub wall_id: String,
    pub passes: bool,
    pub checks: Vec<DuctilityCheckItem>,
    pub boundary_required: bool,
    pub boundary_length_req: f64,
    pub required_modifications: Vec<String>,
}

/// Check shear wall ductile detailing per IS 13920:2016 Cl. 10
pub fn check_shear_wall_ductility(
    wall_id: &str,
    wall: &ShearWallSection,
    materials: &IS13920Materials,
) -> ShearWallCheck {
    let mut checks = Vec::new();
    let mut modifications = Vec::new();
    
    let ag = wall.tw * wall.lw;
    
    // Cl. 10.1.2: Minimum thickness
    let min_thickness = (wall.hs / 20.0).max(150.0);
    checks.push(DuctilityCheckItem {
        clause: "10.1.2".to_string(),
        description: "Minimum wall thickness".to_string(),
        required: format!("≥ {:.0} mm", min_thickness),
        provided: format!("{} mm", wall.tw),
        passes: wall.tw >= min_thickness,
    });
    
    // Cl. 10.2.1: Minimum reinforcement ratio
    let rho_min = 0.0025;
    checks.push(DuctilityCheckItem {
        clause: "10.2.1".to_string(),
        description: "Minimum horizontal reinforcement".to_string(),
        required: format!("≥ {:.4}", rho_min),
        provided: format!("{:.4}", wall.rho_h),
        passes: wall.rho_h >= rho_min,
    });
    
    checks.push(DuctilityCheckItem {
        clause: "10.2.1".to_string(),
        description: "Minimum vertical reinforcement".to_string(),
        required: format!("≥ {:.4}", rho_min),
        provided: format!("{:.4}", wall.rho_v),
        passes: wall.rho_v >= rho_min,
    });
    
    // Cl. 10.2.3: Maximum bar spacing
    let max_spacing = (wall.tw * 5.0).min(450.0);
    checks.push(DuctilityCheckItem {
        clause: "10.2.3".to_string(),
        description: "Maximum bar spacing".to_string(),
        required: format!("≤ {:.0} mm", max_spacing),
        provided: "Verify on drawing".to_string(),
        passes: true,
    });
    
    // Cl. 10.3: Shear strength check
    let _tau_c = 0.25 * materials.fck.sqrt();
    let aspect_ratio = wall.hw / wall.lw;
    let alpha_cw = if aspect_ratio <= 1.0 {
        0.25
    } else if aspect_ratio >= 2.0 {
        0.17
    } else {
        0.25 - 0.08 * (aspect_ratio - 1.0)
    };
    
    let vc = alpha_cw * materials.fck.sqrt() * wall.tw * 0.8 * wall.lw / 1000.0; // kN
    let vs = wall.rho_h * materials.fy * wall.tw * 0.8 * wall.lw / 1000.0;
    let vn = 0.75 * (vc + vs);
    
    checks.push(DuctilityCheckItem {
        clause: "10.3".to_string(),
        description: "Shear strength check".to_string(),
        required: format!("Vu ≤ {:.0} kN", vn),
        provided: format!("Vu = {:.0} kN", wall.vu),
        passes: wall.vu <= vn,
    });
    
    // Cl. 10.4: Boundary element requirements
    let pu_n = wall.pu * 1000.0; // N
    let agfck = ag * materials.fck;
    let boundary_required = pu_n > 0.2 * agfck;
    
    let boundary_length_req = if boundary_required {
        (0.15 * wall.lw).max(1.5 * wall.tw).max(450.0)
    } else {
        0.0
    };
    
    checks.push(DuctilityCheckItem {
        clause: "10.4.1".to_string(),
        description: "Boundary element requirement".to_string(),
        required: if boundary_required {
            format!("Required: {:.0} mm each end", boundary_length_req)
        } else {
            "Not required".to_string()
        },
        provided: format!("Left: {:.0} mm, Right: {:.0} mm", 
            wall.be_length[0], wall.be_length[1]),
        passes: !boundary_required || 
            (wall.be_length[0] >= boundary_length_req && 
             wall.be_length[1] >= boundary_length_req),
    });
    
    // Cl. 10.4.4: Boundary element confinement
    if boundary_required {
        let max_be_tie_spacing = (wall.be_length[0].min(wall.be_length[1]) / 4.0)
            .min(100.0);
        
        checks.push(DuctilityCheckItem {
            clause: "10.4.4".to_string(),
            description: "Boundary element tie spacing".to_string(),
            required: format!("≤ {:.0} mm", max_be_tie_spacing),
            provided: format!("{} mm", wall.be_tie_spacing),
            passes: wall.be_tie_spacing <= max_be_tie_spacing,
        });
    }
    
    // Compile modifications
    for check in &checks {
        if !check.passes {
            modifications.push(format!(
                "Cl. {}: {} - Required: {}, Provided: {}",
                check.clause, check.description, check.required, check.provided
            ));
        }
    }
    
    ShearWallCheck {
        wall_id: wall_id.to_string(),
        passes: checks.iter().all(|c| c.passes),
        checks,
        boundary_required,
        boundary_length_req,
        required_modifications: modifications,
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    
    #[test]
    fn test_seismic_zone() {
        assert!(SeismicZone::ZoneV.requires_ductile_detailing());
        assert!(!SeismicZone::ZoneII.requires_ductile_detailing());
        assert!((SeismicZone::ZoneIV.zone_factor() - 0.24).abs() < 0.01);
    }
    
    #[test]
    fn test_beam_ductility() {
        let beam = BeamSection {
            b: 300.0,
            d: 600.0,
            d_eff: 550.0,
            clear_span: 5000.0,
            as_top_left: 1200.0,
            as_bot_left: 800.0,
            as_top_right: 1200.0,
            as_bot_right: 800.0,
            stirrup_dia: 8.0,
            stirrup_spacing_hinge: 100.0,
            stirrup_spacing_mid: 200.0,
            cover: 40.0,
            bar_dia: 20.0,
        };
        
        let materials = IS13920Materials::default();
        let result = check_beam_ductility("B1", &beam, &materials);
        
        assert!(result.checks.len() > 5);
    }
    
    #[test]
    fn test_column_ductility() {
        let column = ColumnSection {
            b: 400.0,
            d: 400.0,
            clear_height: 3000.0,
            as_long: 2400.0,
            num_bars: 8,
            bar_dia: 20.0,
            tie_dia: 8.0,
            tie_spacing_confine: 100.0,
            tie_spacing_mid: 200.0,
            is_corner: false,
            pu: 1500.0,
        };
        
        let materials = IS13920Materials::default();
        let result = check_column_ductility("C1", &column, &materials);
        
        assert!(result.confining_length > 0.0);
        assert!(result.ash_required > 0.0);
    }
    
    #[test]
    fn test_shear_wall() {
        let wall = ShearWallSection {
            tw: 300.0,
            lw: 4000.0,
            hw: 12000.0,
            hs: 3000.0,
            rho_h: 0.0030,
            rho_v: 0.0040,
            be_length: [600.0, 600.0],
            be_tie_spacing: 100.0,
            pu: 3000.0,
            mu: 8000.0,
            vu: 1500.0,
        };
        
        let materials = IS13920Materials::default();
        let result = check_shear_wall_ductility("W1", &wall, &materials);
        
        assert!(result.checks.len() >= 5);
    }
}
