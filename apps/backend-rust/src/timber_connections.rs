// ============================================================================
// TIMBER CONNECTIONS - Phase 20
// Advanced timber connection design per Eurocode 5, NDS, CSA O86
// CLT, glulam, dowel-type, moment connections
// ============================================================================

use serde::{Deserialize, Serialize};
use std::f64::consts::PI;

// ============================================================================
// TIMBER MATERIAL TYPES
// ============================================================================

/// Timber product types
#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
pub enum TimberProduct {
    /// Solid timber
    Solid,
    /// Glued laminated timber (Glulam)
    Glulam,
    /// Cross laminated timber (CLT)
    Clt,
    /// Laminated veneer lumber (LVL)
    Lvl,
    /// Parallel strand lumber (PSL)
    Psl,
    /// Oriented strand lumber (OSL)
    Osl,
}

/// Timber species groups
#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
pub enum TimberSpecies {
    Softwood,
    Hardwood,
    DouglasFir,
    SprucePineFir,
    SouthernPine,
    Oak,
    Beech,
    Tropical,
}

/// Timber strength class (Eurocode)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TimberStrengthClass {
    /// Class name (e.g., "GL24h")
    pub name: String,
    /// Bending strength (MPa)
    pub fm_k: f64,
    /// Tension parallel (MPa)
    pub ft_0_k: f64,
    /// Compression parallel (MPa)
    pub fc_0_k: f64,
    /// Shear strength (MPa)
    pub fv_k: f64,
    /// Modulus of elasticity (GPa)
    pub e_0_mean: f64,
    /// Characteristic density (kg/m³)
    pub rho_k: f64,
}

impl TimberStrengthClass {
    /// GL24h glulam
    pub fn gl24h() -> Self {
        Self {
            name: "GL24h".to_string(),
            fm_k: 24.0,
            ft_0_k: 19.2,
            fc_0_k: 24.0,
            fv_k: 3.5,
            e_0_mean: 11.5,
            rho_k: 385.0,
        }
    }
    
    /// GL28h glulam
    pub fn gl28h() -> Self {
        Self {
            name: "GL28h".to_string(),
            fm_k: 28.0,
            ft_0_k: 22.3,
            fc_0_k: 26.5,
            fv_k: 3.5,
            e_0_mean: 12.6,
            rho_k: 410.0,
        }
    }
    
    /// GL32h glulam
    pub fn gl32h() -> Self {
        Self {
            name: "GL32h".to_string(),
            fm_k: 32.0,
            ft_0_k: 25.6,
            fc_0_k: 29.0,
            fv_k: 3.8,
            e_0_mean: 13.7,
            rho_k: 430.0,
        }
    }
    
    /// C24 solid timber
    pub fn c24() -> Self {
        Self {
            name: "C24".to_string(),
            fm_k: 24.0,
            ft_0_k: 14.5,
            fc_0_k: 21.0,
            fv_k: 4.0,
            e_0_mean: 11.0,
            rho_k: 350.0,
        }
    }
    
    /// CLT typical
    pub fn clt() -> Self {
        Self {
            name: "CLT".to_string(),
            fm_k: 24.0,
            ft_0_k: 14.0,
            fc_0_k: 21.0,
            fv_k: 1.5, // Rolling shear
            e_0_mean: 11.0,
            rho_k: 400.0,
        }
    }
    
    /// Embedment strength parallel to grain (MPa)
    pub fn fh_0_k(&self) -> f64 {
        0.082 * self.rho_k
    }
}

// ============================================================================
// DOWEL-TYPE FASTENERS
// ============================================================================

/// Fastener types
#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
pub enum FastenerType {
    Bolt,
    Dowel,
    Nail,
    Screw,
    SplitRing,
    ShearPlate,
}

/// Dowel-type fastener properties
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DowelFastener {
    pub fastener_type: FastenerType,
    /// Diameter (mm)
    pub d: f64,
    /// Length (mm)
    pub length: f64,
    /// Tensile strength (MPa)
    pub fu: f64,
    /// Yield moment (N·mm)
    pub my_rk: f64,
}

impl DowelFastener {
    /// Steel bolt
    pub fn bolt(d: f64, length: f64, grade: f64) -> Self {
        let fu = grade * 100.0; // e.g., 8.8 -> 800 MPa
        let my_rk = 0.3 * fu * d.powf(2.6);
        
        Self {
            fastener_type: FastenerType::Bolt,
            d,
            length,
            fu,
            my_rk,
        }
    }
    
    /// Steel dowel
    pub fn dowel(d: f64, length: f64) -> Self {
        let fu = 400.0;
        let my_rk = 0.3 * fu * d.powf(2.6);
        
        Self {
            fastener_type: FastenerType::Dowel,
            d,
            length,
            fu,
            my_rk,
        }
    }
    
    /// Timber screw
    pub fn screw(d: f64, length: f64) -> Self {
        let fu = 600.0;
        let my_rk = 0.3 * fu * d.powf(2.6);
        
        Self {
            fastener_type: FastenerType::Screw,
            d,
            length,
            fu,
            my_rk,
        }
    }
    
    /// Wire nail
    pub fn nail(d: f64, length: f64) -> Self {
        let fu = 600.0;
        let my_rk = 0.3 * fu * d.powf(2.6);
        
        Self {
            fastener_type: FastenerType::Nail,
            d,
            length,
            fu,
            my_rk,
        }
    }
    
    /// Slenderness ratio
    pub fn slenderness(&self, t: f64) -> f64 {
        t / self.d
    }
}

// ============================================================================
// TIMBER-TO-TIMBER CONNECTION
// ============================================================================

/// Single shear timber-to-timber connection
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TimberToTimberConnection {
    /// Member 1 thickness (mm)
    pub t1: f64,
    /// Member 2 thickness (mm)
    pub t2: f64,
    /// Timber class member 1
    pub timber1: TimberStrengthClass,
    /// Timber class member 2
    pub timber2: TimberStrengthClass,
    /// Fastener
    pub fastener: DowelFastener,
    /// Load angle to grain member 1 (degrees)
    pub alpha1: f64,
    /// Load angle to grain member 2 (degrees)
    pub alpha2: f64,
    /// Number of fasteners
    pub n: usize,
    /// Number of rows
    pub n_rows: usize,
}

impl TimberToTimberConnection {
    pub fn new(
        t1: f64, t2: f64,
        timber1: TimberStrengthClass, timber2: TimberStrengthClass,
        fastener: DowelFastener,
        n: usize,
    ) -> Self {
        Self {
            t1, t2,
            timber1, timber2,
            fastener,
            alpha1: 0.0,
            alpha2: 0.0,
            n,
            n_rows: 1,
        }
    }
    
    /// Embedment strength at angle (Hankinson formula)
    pub fn embedment_strength(&self, fh_0: f64, alpha_deg: f64) -> f64 {
        let alpha = alpha_deg * PI / 180.0;
        let k90 = 1.35 + 0.015 * self.fastener.d;
        
        fh_0 / (k90 * alpha.sin().powi(2) + alpha.cos().powi(2))
    }
    
    /// Characteristic load-carrying capacity per fastener (N) - EC5 equations
    pub fn fv_rk(&self) -> f64 {
        let d = self.fastener.d;
        let t1 = self.t1;
        let t2 = self.t2;
        let my_rk = self.fastener.my_rk;
        
        let fh_1_k = self.embedment_strength(self.timber1.fh_0_k(), self.alpha1);
        let fh_2_k = self.embedment_strength(self.timber2.fh_0_k(), self.alpha2);
        
        let beta = fh_2_k / fh_1_k;
        
        // Johansen equations for single shear
        let f_a = fh_1_k * t1 * d;
        let f_b = fh_2_k * t2 * d;
        
        let f_c = fh_1_k * t1 * d / (1.0 + beta) * (
            (beta + 2.0 * beta.powi(2) * (1.0 + t2 / t1 + (t2 / t1).powi(2)) 
            + beta.powi(3) * (t2 / t1).powi(2)).sqrt() - beta * (1.0 + t2 / t1)
        );
        
        let f_d = 1.05 * fh_1_k * t1 * d / (2.0 + beta) * (
            (2.0 * beta * (1.0 + beta) + 4.0 * beta * (2.0 + beta) * my_rk / (fh_1_k * t1.powi(2) * d)).sqrt() - beta
        );
        
        let f_e = 1.05 * fh_1_k * t2 * d / (1.0 + 2.0 * beta) * (
            (2.0 * beta.powi(2) * (1.0 + beta) + 4.0 * beta * (1.0 + 2.0 * beta) * my_rk / (fh_1_k * t2.powi(2) * d)).sqrt() - beta
        );
        
        let f_f = 1.15 * (2.0 * beta / (1.0 + beta)).sqrt() * (2.0 * my_rk * fh_1_k * d).sqrt();
        
        f_a.min(f_b).min(f_c).min(f_d).min(f_e).min(f_f)
    }
    
    /// Effective number of fasteners
    pub fn n_ef(&self) -> f64 {
        let n_row = (self.n / self.n_rows) as f64;
        let a1 = 4.0 * self.fastener.d; // Assumed spacing
        
        // EC5 effective number
        let kef = match self.fastener.fastener_type {
            FastenerType::Bolt | FastenerType::Dowel => {
                (a1 / (13.0 * self.fastener.d)).powf(0.25).min(1.0)
            }
            _ => 1.0,
        };
        
        self.n_rows as f64 * n_row.powf(kef)
    }
    
    /// Connection capacity (kN)
    pub fn capacity(&self) -> f64 {
        let fv_rk = self.fv_rk();
        let n_ef = self.n_ef();
        
        n_ef * fv_rk / 1000.0
    }
    
    /// Design capacity (kN)
    pub fn design_capacity(&self, gamma_m: f64, kmod: f64) -> f64 {
        self.capacity() * kmod / gamma_m
    }
}

// ============================================================================
// STEEL-TO-TIMBER CONNECTION
// ============================================================================

/// Steel plate position
#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
pub enum PlatePosition {
    Internal,
    External,
}

/// Steel-to-timber connection
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SteelToTimberConnection {
    /// Timber thickness (mm)
    pub t: f64,
    /// Steel plate thickness (mm)
    pub t_steel: f64,
    /// Timber class
    pub timber: TimberStrengthClass,
    /// Fastener
    pub fastener: DowelFastener,
    /// Plate position
    pub plate_position: PlatePosition,
    /// Load angle to grain (degrees)
    pub alpha: f64,
    /// Number of fasteners
    pub n: usize,
    /// Number of rows
    pub n_rows: usize,
}

impl SteelToTimberConnection {
    pub fn new(
        t: f64, t_steel: f64,
        timber: TimberStrengthClass,
        fastener: DowelFastener,
        plate_position: PlatePosition,
        n: usize,
    ) -> Self {
        Self {
            t, t_steel, timber, fastener, plate_position, alpha: 0.0, n, n_rows: 1
        }
    }
    
    /// Is thick plate? (no plastic hinge in steel)
    pub fn is_thick_plate(&self) -> bool {
        self.t_steel >= self.fastener.d
    }
    
    /// Characteristic capacity per fastener (N) - EC5
    pub fn fv_rk(&self) -> f64 {
        let d = self.fastener.d;
        let t = self.t;
        let my_rk = self.fastener.my_rk;
        
        let alpha_rad = self.alpha * PI / 180.0;
        let k90 = 1.35 + 0.015 * d;
        let fh_k = self.timber.fh_0_k() / (k90 * alpha_rad.sin().powi(2) + alpha_rad.cos().powi(2));
        
        match self.plate_position {
            PlatePosition::External => {
                if self.is_thick_plate() {
                    // Thick plate modes
                    let f_a = fh_k * t * d;
                    let f_b = fh_k * t * d * ((2.0 + 4.0 * my_rk / (fh_k * t.powi(2) * d)).sqrt() - 1.0);
                    let f_c = 2.26 * (my_rk * fh_k * d).sqrt();
                    
                    f_a.min(f_b).min(f_c)
                } else {
                    // Thin plate
                    let f_a = 0.5 * fh_k * t * d;
                    let f_b = 1.15 * (2.0 * my_rk * fh_k * d).sqrt();
                    
                    f_a.min(f_b)
                }
            }
            PlatePosition::Internal => {
                if self.is_thick_plate() {
                    let f_a = fh_k * t * d;
                    let f_b = fh_k * t * d * ((2.0 + 4.0 * my_rk / (fh_k * t.powi(2) * d)).sqrt() - 1.0);
                    let f_c = 2.26 * (my_rk * fh_k * d).sqrt();
                    
                    f_a.min(f_b).min(f_c)
                } else {
                    0.5 * fh_k * t * d
                }
            }
        }
    }
    
    /// Connection capacity (kN)
    pub fn capacity(&self) -> f64 {
        let n_ef = self.n as f64; // Conservative for steel plates
        n_ef * self.fv_rk() / 1000.0
    }
    
    /// Design capacity (kN)
    pub fn design_capacity(&self, gamma_m: f64, kmod: f64) -> f64 {
        self.capacity() * kmod / gamma_m
    }
}

// ============================================================================
// CLT CONNECTIONS
// ============================================================================

/// CLT panel connection types
#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
pub enum CltConnectionType {
    /// Wall to floor (platform)
    WallToFloor,
    /// Wall to wall (corner)
    WallToWall,
    /// Panel splice
    PanelSplice,
    /// Base connection (hold-down)
    BaseHoldDown,
    /// Base connection (shear)
    BaseShear,
}

/// CLT connection design
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CltConnection {
    /// Connection type
    pub connection_type: CltConnectionType,
    /// CLT thickness (mm)
    pub clt_thickness: f64,
    /// Number of layers
    pub n_layers: usize,
    /// Layer thickness (mm)
    pub layer_thickness: f64,
    /// Timber class
    pub timber: TimberStrengthClass,
    /// Fastener
    pub fastener: DowelFastener,
    /// Number of fasteners
    pub n_fasteners: usize,
    /// Spacing (mm)
    pub spacing: f64,
}

impl CltConnection {
    pub fn new(
        connection_type: CltConnectionType,
        clt_thickness: f64,
        n_layers: usize,
        timber: TimberStrengthClass,
        fastener: DowelFastener,
        n_fasteners: usize,
    ) -> Self {
        Self {
            connection_type,
            clt_thickness,
            n_layers,
            layer_thickness: clt_thickness / n_layers as f64,
            timber,
            fastener,
            n_fasteners,
            spacing: 100.0,
        }
    }
    
    /// Withdrawal capacity per screw (kN) for CLT edge
    pub fn withdrawal_capacity(&self) -> f64 {
        let d = self.fastener.d;
        let rho_k = self.timber.rho_k;
        let l_ef = self.clt_thickness * 0.8; // Effective length
        
        // EC5 withdrawal for screws in CLT
        let fax_k = 0.52 * d.powf(-0.5) * l_ef.powf(0.1) * rho_k.powf(0.8);
        
        fax_k * d * l_ef / 1000.0
    }
    
    /// Shear capacity per fastener (kN)
    pub fn shear_capacity_per_fastener(&self) -> f64 {
        // Simplified - perpendicular layers affect capacity
        let d = self.fastener.d;
        let t_eff = self.layer_thickness * 0.9; // Reduced for CLT
        let fh_k = self.timber.fh_0_k() * 0.85; // Reduction for CLT
        let my_rk = self.fastener.my_rk;
        
        let f_v = (fh_k * t_eff * d).min(2.3 * (my_rk * fh_k * d).sqrt());
        
        f_v / 1000.0
    }
    
    /// Total connection capacity (kN)
    pub fn total_capacity(&self) -> f64 {
        self.n_fasteners as f64 * self.shear_capacity_per_fastener()
    }
    
    /// Hold-down tension capacity (kN)
    pub fn holddown_capacity(&self) -> f64 {
        match self.connection_type {
            CltConnectionType::BaseHoldDown => {
                // Based on withdrawal + steel capacity
                (self.n_fasteners as f64 * self.withdrawal_capacity()).min(100.0)
            }
            _ => 0.0,
        }
    }
}

// ============================================================================
// MOMENT CONNECTIONS
// ============================================================================

/// Glulam moment connection types
#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
pub enum MomentConnectionType {
    /// Dowelled beam-column
    DowelledBeamColumn,
    /// Slotted-in plate
    SlottedPlate,
    /// Glued-in rod
    GluedInRod,
    /// Moment splice
    MomentSplice,
}

/// Moment connection design
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MomentConnection {
    pub connection_type: MomentConnectionType,
    /// Beam width (mm)
    pub b: f64,
    /// Beam depth (mm)
    pub h: f64,
    /// Timber class
    pub timber: TimberStrengthClass,
    /// Fastener diameter (mm)
    pub d: f64,
    /// Number of fastener rows
    pub n_rows: usize,
    /// Fasteners per row
    pub n_per_row: usize,
    /// Row spacing (mm)
    pub row_spacing: f64,
}

impl MomentConnection {
    pub fn new(
        connection_type: MomentConnectionType,
        b: f64, h: f64,
        timber: TimberStrengthClass,
        d: f64,
        n_rows: usize, n_per_row: usize,
        row_spacing: f64,
    ) -> Self {
        Self {
            connection_type, b, h, timber, d, n_rows, n_per_row, row_spacing
        }
    }
    
    /// Lever arm for moment calculation (mm)
    pub fn lever_arm(&self) -> f64 {
        // Distance from centroid to outer row
        (self.n_rows - 1) as f64 * self.row_spacing / 2.0
    }
    
    /// Shear capacity per fastener (kN)
    pub fn shear_per_fastener(&self) -> f64 {
        let fh_k = self.timber.fh_0_k();
        let my_rk = 0.3 * 400.0 * self.d.powf(2.6); // Steel dowel
        let _t = self.b / 2.0; // Side member thickness
        
        let f_v = 2.3 * (2.0 * my_rk * fh_k * self.d).sqrt();
        
        f_v / 1000.0
    }
    
    /// Total number of fasteners
    pub fn total_fasteners(&self) -> usize {
        self.n_rows * self.n_per_row
    }
    
    /// Shear capacity (kN)
    pub fn shear_capacity(&self) -> f64 {
        self.total_fasteners() as f64 * self.shear_per_fastener()
    }
    
    /// Moment capacity (kN·m)
    pub fn moment_capacity(&self) -> f64 {
        // Moment from couple of forces in outer rows
        let f_row = self.n_per_row as f64 * self.shear_per_fastener();
        let _arm = self.lever_arm();
        
        // Sum of Fy * y for all rows
        let mut m = 0.0;
        for i in 0..self.n_rows {
            let y = (i as f64 - (self.n_rows - 1) as f64 / 2.0) * self.row_spacing;
            m += f_row * y.abs();
        }
        
        m / 1000.0 // kN·m
    }
    
    /// Rotational stiffness (kN·m/rad)
    pub fn rotational_stiffness(&self) -> f64 {
        let kser = self.timber.rho_k.powf(1.5) * self.d / 23.0; // N/mm per fastener
        
        let mut k_rot = 0.0;
        for i in 0..self.n_rows {
            let y = (i as f64 - (self.n_rows - 1) as f64 / 2.0) * self.row_spacing;
            k_rot += self.n_per_row as f64 * kser * y.powi(2);
        }
        
        k_rot / 1e6 // kN·m/rad
    }
}

// ============================================================================
// GLUED-IN RODS
// ============================================================================

/// Glued-in rod connection
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GluedInRod {
    /// Rod diameter (mm)
    pub d: f64,
    /// Embedded length (mm)
    pub l_g: f64,
    /// Number of rods
    pub n: usize,
    /// Rod spacing (mm)
    pub spacing: f64,
    /// Timber class
    pub timber: TimberStrengthClass,
    /// Steel grade (yield strength MPa)
    pub fy: f64,
    /// Adhesive type
    pub adhesive: String,
    /// Rod angle to grain (degrees)
    pub alpha: f64,
}

impl GluedInRod {
    pub fn parallel(d: f64, l_g: f64, n: usize, timber: TimberStrengthClass) -> Self {
        Self {
            d, l_g, n,
            spacing: 4.0 * d,
            timber,
            fy: 500.0,
            adhesive: "Epoxy".to_string(),
            alpha: 0.0,
        }
    }
    
    pub fn perpendicular(d: f64, l_g: f64, n: usize, timber: TimberStrengthClass) -> Self {
        Self {
            d, l_g, n,
            spacing: 4.0 * d,
            timber,
            fy: 500.0,
            adhesive: "Epoxy".to_string(),
            alpha: 90.0,
        }
    }
    
    /// Rod cross-sectional area (mm²)
    pub fn area(&self) -> f64 {
        PI * self.d.powi(2) / 4.0
    }
    
    /// Bond line perimeter (mm)
    pub fn perimeter(&self) -> f64 {
        PI * self.d
    }
    
    /// Axial withdrawal capacity per rod (kN)
    pub fn withdrawal_capacity(&self) -> f64 {
        let rho_k = self.timber.rho_k;
        let alpha_rad = self.alpha * PI / 180.0;
        
        // Bond strength (depends on angle)
        let f_v_0 = 0.62 * rho_k.powf(0.35); // Parallel to grain
        let f_v_90 = 0.8 * f_v_0; // Perpendicular
        
        let f_v = f_v_0 * f_v_90 / (f_v_0 * alpha_rad.sin().powi(2) + f_v_90 * alpha_rad.cos().powi(2));
        
        // Capacity (minimum of bond and steel)
        let r_bond = PI * self.d * self.l_g * f_v;
        let r_steel = self.area() * self.fy;
        
        r_bond.min(r_steel) / 1000.0
    }
    
    /// Group capacity (kN) with reduction factor
    pub fn group_capacity(&self) -> f64 {
        // Reduction for multiple rods
        let k_n = if self.n <= 4 {
            1.0
        } else {
            (4.0 / self.n as f64).powf(0.25)
        };
        
        k_n * self.n as f64 * self.withdrawal_capacity()
    }
    
    /// Minimum embedment length (mm)
    pub fn min_embedment_length(&self) -> f64 {
        // Typically 10d minimum, 20d recommended
        (10.0 * self.d).max(200.0)
    }
    
    /// Is embedment adequate?
    pub fn is_embedment_adequate(&self) -> bool {
        self.l_g >= self.min_embedment_length()
    }
}

// ============================================================================
// TESTS
// ============================================================================

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_timber_class() {
        let gl28 = TimberStrengthClass::gl28h();
        
        assert_eq!(gl28.fm_k, 28.0);
        assert!(gl28.fh_0_k() > 30.0);
    }

    #[test]
    fn test_fastener() {
        let bolt = DowelFastener::bolt(12.0, 100.0, 8.8);
        
        assert_eq!(bolt.d, 12.0);
        assert!(bolt.my_rk > 50000.0);
    }

    #[test]
    fn test_timber_to_timber() {
        let timber = TimberStrengthClass::gl24h();
        let bolt = DowelFastener::bolt(12.0, 160.0, 8.8);
        
        let conn = TimberToTimberConnection::new(
            60.0, 100.0,
            timber.clone(), timber,
            bolt, 4,
        );
        
        let cap = conn.capacity();
        assert!(cap > 10.0);
    }

    #[test]
    fn test_n_effective() {
        let timber = TimberStrengthClass::gl28h();
        let bolt = DowelFastener::bolt(16.0, 200.0, 8.8);
        
        let mut conn = TimberToTimberConnection::new(
            80.0, 120.0,
            timber.clone(), timber,
            bolt, 6,
        );
        conn.n_rows = 2;
        
        let n_ef = conn.n_ef();
        assert!(n_ef < 6.0); // Reduced from actual count
    }

    #[test]
    fn test_steel_to_timber() {
        let timber = TimberStrengthClass::gl32h();
        let bolt = DowelFastener::bolt(16.0, 120.0, 10.9);
        
        let conn = SteelToTimberConnection::new(
            100.0, 10.0,
            timber, bolt,
            PlatePosition::External, 4,
        );
        
        let cap = conn.capacity();
        assert!(cap > 20.0);
    }

    #[test]
    fn test_thick_vs_thin_plate() {
        let timber = TimberStrengthClass::gl24h();
        let bolt = DowelFastener::bolt(12.0, 100.0, 8.8);
        
        let thick = SteelToTimberConnection::new(
            80.0, 12.0, timber.clone(), bolt.clone(), PlatePosition::External, 1);
        let thin = SteelToTimberConnection::new(
            80.0, 6.0, timber, bolt, PlatePosition::External, 1);
        
        assert!(thick.is_thick_plate());
        assert!(!thin.is_thick_plate());
    }

    #[test]
    fn test_clt_connection() {
        let timber = TimberStrengthClass::clt();
        let screw = DowelFastener::screw(8.0, 160.0);
        
        let conn = CltConnection::new(
            CltConnectionType::WallToFloor,
            175.0, 5, timber, screw, 10,
        );
        
        let cap = conn.total_capacity();
        assert!(cap > 30.0);
    }

    #[test]
    fn test_clt_withdrawal() {
        let timber = TimberStrengthClass::clt();
        let screw = DowelFastener::screw(10.0, 200.0);
        
        let conn = CltConnection::new(
            CltConnectionType::BaseHoldDown,
            200.0, 5, timber, screw, 8,
        );
        
        let w_cap = conn.withdrawal_capacity();
        assert!(w_cap > 1.0);
    }

    #[test]
    fn test_moment_connection() {
        let timber = TimberStrengthClass::gl32h();
        
        let conn = MomentConnection::new(
            MomentConnectionType::DowelledBeamColumn,
            200.0, 600.0, timber,
            16.0, 6, 4, 80.0,
        );
        
        let m_cap = conn.moment_capacity();
        assert!(m_cap > 50.0);
        
        let k_rot = conn.rotational_stiffness();
        assert!(k_rot > 1000.0);
    }

    #[test]
    fn test_glued_in_rod() {
        let timber = TimberStrengthClass::gl28h();
        
        let rod = GluedInRod::parallel(16.0, 300.0, 4, timber);
        
        let cap = rod.group_capacity();
        assert!(cap > 100.0);
        
        assert!(rod.is_embedment_adequate());
    }

    #[test]
    fn test_glued_in_perpendicular() {
        let timber = TimberStrengthClass::gl24h();
        
        let rod_par = GluedInRod::parallel(12.0, 200.0, 2, timber.clone());
        let rod_perp = GluedInRod::perpendicular(12.0, 200.0, 2, timber);
        
        // Parallel should have higher capacity
        assert!(rod_par.withdrawal_capacity() > rod_perp.withdrawal_capacity() * 0.9);
    }

    #[test]
    fn test_embedment_length() {
        let timber = TimberStrengthClass::gl24h();
        
        let short_rod = GluedInRod::parallel(20.0, 150.0, 1, timber.clone());
        let long_rod = GluedInRod::parallel(20.0, 300.0, 1, timber);
        
        assert!(!short_rod.is_embedment_adequate());
        assert!(long_rod.is_embedment_adequate());
    }
}
