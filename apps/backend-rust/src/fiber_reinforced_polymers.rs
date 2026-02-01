// ============================================================================
// FIBER REINFORCED POLYMERS (FRP) - Phase 20
// Advanced composite materials for structural strengthening
// Standards: ACI 440, fib Bulletin 14, TR55, ISIS Canada
// ============================================================================

use serde::{Deserialize, Serialize};
use std::f64::consts::PI;

// ============================================================================
// FRP MATERIAL TYPES
// ============================================================================

/// FRP fiber types
#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
pub enum FiberType {
    /// Carbon fiber (CFRP)
    Carbon,
    /// E-Glass fiber (GFRP)
    EGlass,
    /// S-Glass fiber (high strength)
    SGlass,
    /// Aramid fiber (Kevlar)
    Aramid,
    /// Basalt fiber (BFRP)
    Basalt,
    /// PBO fiber (Zylon)
    PBO,
}

impl FiberType {
    /// Typical tensile strength (MPa)
    pub fn tensile_strength(&self) -> f64 {
        match self {
            FiberType::Carbon => 3500.0,
            FiberType::EGlass => 2000.0,
            FiberType::SGlass => 4500.0,
            FiberType::Aramid => 3000.0,
            FiberType::Basalt => 2800.0,
            FiberType::PBO => 5800.0,
        }
    }
    
    /// Typical elastic modulus (GPa)
    pub fn elastic_modulus(&self) -> f64 {
        match self {
            FiberType::Carbon => 230.0,
            FiberType::EGlass => 72.0,
            FiberType::SGlass => 85.0,
            FiberType::Aramid => 120.0,
            FiberType::Basalt => 89.0,
            FiberType::PBO => 280.0,
        }
    }
    
    /// Ultimate strain (%)
    pub fn ultimate_strain(&self) -> f64 {
        match self {
            FiberType::Carbon => 1.5,
            FiberType::EGlass => 2.8,
            FiberType::SGlass => 5.3,
            FiberType::Aramid => 2.5,
            FiberType::Basalt => 3.1,
            FiberType::PBO => 2.1,
        }
    }
    
    /// Density (kg/m³)
    pub fn density(&self) -> f64 {
        match self {
            FiberType::Carbon => 1800.0,
            FiberType::EGlass => 2550.0,
            FiberType::SGlass => 2500.0,
            FiberType::Aramid => 1440.0,
            FiberType::Basalt => 2700.0,
            FiberType::PBO => 1560.0,
        }
    }
}

/// FRP product forms
#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
pub enum FrpForm {
    /// Wet layup sheet
    WetLayup,
    /// Precured laminate
    Laminate,
    /// Near-surface mounted (NSM) bar
    NsmBar,
    /// Near-surface mounted strip
    NsmStrip,
    /// Externally bonded reinforcement (EBR)
    Ebr,
    /// Fabric reinforced cementitious matrix (FRCM)
    Frcm,
}

// ============================================================================
// FRP MATERIAL PROPERTIES
// ============================================================================

/// FRP composite material
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FrpMaterial {
    pub fiber_type: FiberType,
    pub form: FrpForm,
    /// Fiber volume fraction
    pub vf: f64,
    /// Ply thickness (mm)
    pub ply_thickness: f64,
    /// Design tensile strength (MPa)
    pub ffu: f64,
    /// Design elastic modulus (GPa)
    pub ef: f64,
    /// Design rupture strain
    pub eps_fu: f64,
    /// Environmental reduction factor CE
    pub ce: f64,
}

impl FrpMaterial {
    pub fn new(fiber_type: FiberType, form: FrpForm) -> Self {
        let vf = match form {
            FrpForm::WetLayup => 0.35,
            FrpForm::Laminate => 0.60,
            FrpForm::NsmBar => 0.50,
            FrpForm::NsmStrip => 0.60,
            FrpForm::Ebr => 0.50,
            FrpForm::Frcm => 0.30,
        };
        
        let ply_thickness = match form {
            FrpForm::WetLayup => 0.165,
            FrpForm::Laminate => 1.2,
            FrpForm::NsmBar => 8.0,  // diameter
            FrpForm::NsmStrip => 2.0,
            FrpForm::Ebr => 1.0,
            FrpForm::Frcm => 0.047,
        };
        
        // Composite properties (rule of mixtures)
        let ff = fiber_type.tensile_strength();
        let ef_fiber = fiber_type.elastic_modulus();
        
        // Matrix properties (epoxy typical)
        let em = 3.5; // GPa
        let _fm = 80.0; // MPa
        
        let ef = vf * ef_fiber + (1.0 - vf) * em;
        let ffu = vf * ff * 0.85; // Efficiency factor
        let eps_fu = ffu / (ef * 1000.0);
        
        // Environmental factor (interior exposure)
        let ce = match fiber_type {
            FiberType::Carbon => 0.95,
            FiberType::EGlass => 0.75,
            FiberType::Aramid => 0.85,
            _ => 0.80,
        };
        
        Self {
            fiber_type,
            form,
            vf,
            ply_thickness,
            ffu,
            ef,
            eps_fu,
            ce,
        }
    }
    
    /// Design strength with environmental factor
    pub fn design_strength(&self) -> f64 {
        self.ce * self.ffu
    }
    
    /// Design strain
    pub fn design_strain(&self) -> f64 {
        self.ce * self.eps_fu
    }
    
    /// Stiffness per unit width (kN/mm)
    pub fn stiffness_per_width(&self, n_plies: usize) -> f64 {
        self.ef * self.ply_thickness * n_plies as f64 / 1000.0
    }
}

// ============================================================================
// FLEXURAL STRENGTHENING
// ============================================================================

/// Flexural strengthening design per ACI 440.2R
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FlexuralStrengthening {
    /// Beam width (mm)
    pub b: f64,
    /// Beam depth (mm)
    pub h: f64,
    /// Effective depth (mm)
    pub d: f64,
    /// Concrete strength (MPa)
    pub fc: f64,
    /// Steel reinforcement area (mm²)
    pub as_steel: f64,
    /// Steel yield strength (MPa)
    pub fy: f64,
    /// FRP material
    pub frp: FrpMaterial,
    /// Number of FRP plies
    pub n_plies: usize,
    /// FRP width (mm)
    pub bf: f64,
}

impl FlexuralStrengthening {
    pub fn new(
        b: f64, h: f64, d: f64,
        fc: f64, as_steel: f64, fy: f64,
        frp: FrpMaterial, n_plies: usize, bf: f64,
    ) -> Self {
        Self { b, h, d, fc, as_steel, fy, frp, n_plies, bf }
    }
    
    /// FRP area
    pub fn af(&self) -> f64 {
        self.n_plies as f64 * self.frp.ply_thickness * self.bf
    }
    
    /// Effective FRP depth
    pub fn df(&self) -> f64 {
        self.h - self.frp.ply_thickness * self.n_plies as f64 / 2.0
    }
    
    /// Debonding strain limit (ACI 440.2R Eq. 10-2)
    pub fn debonding_strain(&self) -> f64 {
        let fc_psi = self.fc * 145.0; // Convert to psi
        let n = self.n_plies as f64;
        let tf = self.frp.ply_thickness;
        let ef_psi = self.frp.ef * 145000.0; // GPa to psi
        
        let eps_fd = 0.41 * (fc_psi / (n * ef_psi * tf)).sqrt() / 1000.0;
        
        // Limit to 0.9 * design strain
        eps_fd.min(0.9 * self.frp.design_strain())
    }
    
    /// Effective FRP strain at failure
    pub fn effective_frp_strain(&self, c: f64) -> f64 {
        let df = self.df();
        let eps_cu = 0.003; // Concrete crushing strain
        
        // Strain compatibility
        let eps_fe = eps_cu * (df - c) / c;
        
        // Limited by debonding
        eps_fe.min(self.debonding_strain())
    }
    
    /// Neutral axis depth (iterative)
    pub fn neutral_axis(&self) -> f64 {
        let beta1 = if self.fc <= 28.0 {
            0.85
        } else {
            (0.85 - 0.05 * (self.fc - 28.0) / 7.0).max(0.65)
        };
        
        // Initial guess
        let mut c = self.d / 3.0;
        
        for _ in 0..20 {
            let eps_fe = self.effective_frp_strain(c);
            let eps_s = 0.003 * (self.d - c) / c;
            
            let fs = (eps_s * 200000.0).min(self.fy);
            let ff = eps_fe * self.frp.ef * 1000.0;
            
            let af = self.af();
            
            // Force equilibrium
            let _compression = 0.85 * self.fc * beta1 * c * self.b;
            let tension = self.as_steel * fs + af * ff;
            
            let c_new = tension / (0.85 * self.fc * beta1 * self.b);
            
            if (c_new - c).abs() < 0.1 {
                break;
            }
            
            c = 0.5 * (c + c_new);
        }
        
        c
    }
    
    /// Nominal moment capacity (kN·m)
    pub fn nominal_moment(&self) -> f64 {
        let c = self.neutral_axis();
        let beta1 = if self.fc <= 28.0 {
            0.85
        } else {
            (0.85 - 0.05 * (self.fc - 28.0) / 7.0).max(0.65)
        };
        
        let a = beta1 * c;
        
        let eps_fe = self.effective_frp_strain(c);
        let eps_s = 0.003 * (self.d - c) / c;
        
        let fs = (eps_s * 200000.0).min(self.fy);
        let ff = eps_fe * self.frp.ef * 1000.0;
        
        let af = self.af();
        let df = self.df();
        
        // Moment about compression resultant
        let mn = self.as_steel * fs * (self.d - a / 2.0) 
               + af * ff * (df - a / 2.0);
        
        mn / 1e6 // Convert to kN·m
    }
    
    /// Strength reduction factor
    pub fn phi(&self) -> f64 {
        let c = self.neutral_axis();
        let eps_s = 0.003 * (self.d - c) / c;
        
        if eps_s >= 0.005 {
            0.90
        } else if eps_s <= 0.002 {
            0.65
        } else {
            0.65 + 0.25 * (eps_s - 0.002) / 0.003
        }
    }
    
    /// Design moment capacity (kN·m)
    pub fn design_moment(&self) -> f64 {
        let psi_f = 0.85; // FRP strength reduction
        
        // Adjusted phi for FRP contribution
        let c = self.neutral_axis();
        let eps_fe = self.effective_frp_strain(c);
        let ff = eps_fe * self.frp.ef * 1000.0;
        let af = self.af();
        
        let eps_s = 0.003 * (self.d - c) / c;
        let fs = (eps_s * 200000.0).min(self.fy);
        
        let mn_steel = self.as_steel * fs * (self.d - c / 2.0);
        let mn_frp = psi_f * af * ff * (self.df() - c / 2.0);
        
        self.phi() * (mn_steel + mn_frp) / 1e6
    }
}

// ============================================================================
// SHEAR STRENGTHENING
// ============================================================================

/// Shear strengthening configuration
#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
pub enum ShearWrapScheme {
    /// Complete wrap (closed)
    CompleteWrap,
    /// Three-sided U-wrap
    UWrap,
    /// Two-sided bonded
    TwoSided,
}

/// Shear strengthening design per ACI 440.2R
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ShearStrengthening {
    /// Beam width (mm)
    pub bw: f64,
    /// Beam depth (mm)  
    pub h: f64,
    /// Effective depth (mm)
    pub d: f64,
    /// Concrete strength (MPa)
    pub fc: f64,
    /// FRP material
    pub frp: FrpMaterial,
    /// Number of plies
    pub n_plies: usize,
    /// Strip width (mm)
    pub wf: f64,
    /// Strip spacing (mm)
    pub sf: f64,
    /// Fiber orientation angle (degrees)
    pub alpha: f64,
    /// Wrapping scheme
    pub scheme: ShearWrapScheme,
}

impl ShearStrengthening {
    pub fn new(
        bw: f64, h: f64, d: f64, fc: f64,
        frp: FrpMaterial, n_plies: usize,
        wf: f64, sf: f64, alpha: f64,
        scheme: ShearWrapScheme,
    ) -> Self {
        Self { bw, h, d, fc, frp, n_plies, wf, sf, alpha, scheme }
    }
    
    /// Effective depth for shear
    pub fn dfv(&self) -> f64 {
        match self.scheme {
            ShearWrapScheme::CompleteWrap => self.d,
            ShearWrapScheme::UWrap => self.d - self.frp.ply_thickness * self.n_plies as f64,
            ShearWrapScheme::TwoSided => self.d - 2.0 * self.frp.ply_thickness * self.n_plies as f64,
        }
    }
    
    /// Bond reduction factor kv
    pub fn bond_reduction_factor(&self) -> f64 {
        match self.scheme {
            ShearWrapScheme::CompleteWrap => {
                // Strain limited by rupture
                let k1 = (self.fc / 27.0).powf(2.0 / 3.0);
                let k2 = (self.dfv() - self.frp.ply_thickness * self.n_plies as f64) / self.dfv();
                
                (k1 * k2 * self.effective_bond_length() / (11900.0 * self.frp.design_strain()))
                    .min(0.75)
            }
            _ => {
                // Debonding controlled
                let le = self.effective_bond_length();
                let k1 = (self.fc / 27.0).powf(2.0 / 3.0);
                let k2 = (self.dfv() - le) / self.dfv();
                
                let n = self.n_plies as f64;
                let tf = self.frp.ply_thickness;
                let ef = self.frp.ef * 1000.0; // GPa to MPa
                
                (k1 * k2 * le / (11900.0 * (n * tf * ef).sqrt() / (n * tf * ef)))
                    .min(0.75)
            }
        }
    }
    
    /// Effective bond length (mm)
    pub fn effective_bond_length(&self) -> f64 {
        let n = self.n_plies as f64;
        let tf = self.frp.ply_thickness;
        let ef = self.frp.ef * 1000.0; // Convert to MPa
        
        23300.0 / (n * tf * ef).powf(0.58)
    }
    
    /// Effective FRP strain for shear
    pub fn effective_shear_strain(&self) -> f64 {
        let kv = self.bond_reduction_factor();
        
        let eps_fe = kv * self.frp.design_strain();
        
        // Limit to 0.004 per ACI 440
        eps_fe.min(0.004)
    }
    
    /// FRP contribution to shear (kN)
    pub fn vf(&self) -> f64 {
        let afv = 2.0 * self.n_plies as f64 * self.frp.ply_thickness * self.wf;
        let eps_fe = self.effective_shear_strain();
        let ffe = eps_fe * self.frp.ef * 1000.0; // Stress in MPa
        
        let alpha_rad = self.alpha * PI / 180.0;
        let dfv = self.dfv();
        
        let vf = afv * ffe * (alpha_rad.sin() + alpha_rad.cos()) * dfv / self.sf;
        
        vf / 1000.0 // Convert to kN
    }
    
    /// Design FRP shear contribution (kN)
    pub fn design_vf(&self) -> f64 {
        let psi_f = 0.85;
        psi_f * self.vf()
    }
}

// ============================================================================
// CONFINEMENT
// ============================================================================

/// FRP confinement for columns
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FrpConfinement {
    /// Column diameter or width (mm)
    pub dimension: f64,
    /// Column depth for rectangular (mm)
    pub depth: Option<f64>,
    /// Corner radius for rectangular (mm)
    pub corner_radius: f64,
    /// Concrete strength (MPa)
    pub fc: f64,
    /// FRP material
    pub frp: FrpMaterial,
    /// Number of plies
    pub n_plies: usize,
}

impl FrpConfinement {
    pub fn circular(diameter: f64, fc: f64, frp: FrpMaterial, n_plies: usize) -> Self {
        Self {
            dimension: diameter,
            depth: None,
            corner_radius: diameter / 2.0,
            fc,
            frp,
            n_plies,
        }
    }
    
    pub fn rectangular(width: f64, depth: f64, corner_radius: f64, fc: f64, frp: FrpMaterial, n_plies: usize) -> Self {
        Self {
            dimension: width,
            depth: Some(depth),
            corner_radius,
            fc,
            frp,
            n_plies,
        }
    }
    
    /// Is circular section?
    pub fn is_circular(&self) -> bool {
        self.depth.is_none()
    }
    
    /// Equivalent diameter for rectangular
    pub fn equivalent_diameter(&self) -> f64 {
        if self.is_circular() {
            self.dimension
        } else {
            let b = self.dimension;
            let h = self.depth.unwrap();
            (b * b + h * h).sqrt()
        }
    }
    
    /// Confinement pressure (MPa)
    pub fn confinement_pressure(&self) -> f64 {
        let tf = self.n_plies as f64 * self.frp.ply_thickness;
        let eps_fe = self.frp.design_strain().min(0.004);
        let ffe = eps_fe * self.frp.ef * 1000.0;
        
        let d = self.equivalent_diameter();
        
        // fl = 2 * Ef * tf * εfe / D
        let fl = 2.0 * ffe * tf / d;
        
        // Shape factor for rectangular
        if self.is_circular() {
            fl
        } else {
            let b = self.dimension;
            let h = self.depth.unwrap();
            let rc = self.corner_radius;
            
            // Effective confinement area ratio
            let ae_ac = 1.0 - ((b - 2.0 * rc).powi(2) + (h - 2.0 * rc).powi(2)) 
                / (3.0 * b * h);
            
            fl * ae_ac
        }
    }
    
    /// Confined concrete strength (MPa) - Lam & Teng model
    pub fn confined_strength(&self) -> f64 {
        let fl = self.confinement_pressure();
        
        if fl / self.fc >= 0.08 {
            self.fc * (1.0 + 3.3 * fl / self.fc)
        } else {
            self.fc
        }
    }
    
    /// Ultimate axial strain
    pub fn ultimate_strain(&self) -> f64 {
        let fl = self.confinement_pressure();
        let eps_co = 0.002; // Unconfined strain
        
        let eps_fe = self.frp.design_strain().min(0.004);
        
        eps_co * (1.75 + 12.0 * (fl / self.fc) * (eps_fe / eps_co).powf(0.45))
    }
    
    /// Axial capacity increase ratio
    pub fn strength_ratio(&self) -> f64 {
        self.confined_strength() / self.fc
    }
    
    /// Ductility increase ratio  
    pub fn ductility_ratio(&self) -> f64 {
        self.ultimate_strain() / 0.002
    }
}

// ============================================================================
// BOND AND ANCHORAGE
// ============================================================================

/// FRP-concrete bond model
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FrpBond {
    /// Concrete strength (MPa)
    pub fc: f64,
    /// Concrete tensile strength (MPa)
    pub fct: f64,
    /// FRP material
    pub frp: FrpMaterial,
    /// Number of plies
    pub n_plies: usize,
    /// Bond width (mm)
    pub bf: f64,
    /// Concrete width (mm)
    pub bc: f64,
}

impl FrpBond {
    pub fn new(fc: f64, frp: FrpMaterial, n_plies: usize, bf: f64, bc: f64) -> Self {
        let fct = 0.3 * fc.powf(2.0 / 3.0);
        Self { fc, fct, frp, n_plies, bf, bc }
    }
    
    /// Width factor kb
    pub fn width_factor(&self) -> f64 {
        let ratio = self.bf / self.bc;
        
        ((2.0 - ratio) / (1.0 + ratio)).sqrt()
    }
    
    /// Effective bond length (mm)
    pub fn effective_bond_length(&self) -> f64 {
        let tf = self.n_plies as f64 * self.frp.ply_thickness;
        let ef = self.frp.ef * 1000.0; // MPa
        
        (ef * tf / (2.0 * self.fct)).sqrt()
    }
    
    /// Maximum bond force (kN)
    pub fn max_bond_force(&self) -> f64 {
        let _kb = self.width_factor();
        let _le = self.effective_bond_length();
        let tf = self.n_plies as f64 * self.frp.ply_thickness;
        let ef = self.frp.ef * 1000.0;
        
        // Chen & Teng model
        let beta_l = 1.0; // Assuming long bond
        let beta_w = ((2.0 - self.bf / self.bc) / (1.0 + self.bf / self.bc)).sqrt();
        
        let f_max = 0.427 * beta_w * beta_l * (self.fc * ef * tf).sqrt() * self.bf;
        
        f_max / 1000.0 // kN
    }
    
    /// Bond-slip relationship (MPa at slip s in mm)
    pub fn bond_stress(&self, slip: f64) -> f64 {
        let tau_max = (1.5 * self.fc * self.fct).sqrt();
        let s0 = 0.0195 * self.width_factor() * self.fct;
        
        if slip <= s0 {
            tau_max * (slip / s0).sqrt()
        } else {
            tau_max * (-1.5 * (slip - s0) / s0).exp()
        }
    }
    
    /// Intermediate crack debonding strain
    pub fn ic_debonding_strain(&self) -> f64 {
        let _le = self.effective_bond_length();
        let kb = self.width_factor();
        let tf = self.n_plies as f64 * self.frp.ply_thickness;
        let ef = self.frp.ef * 1000.0;
        
        0.48 * kb * (self.fc / (ef * tf)).sqrt()
    }
}

// ============================================================================
// NSM STRENGTHENING
// ============================================================================

/// Near-surface mounted FRP bar
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NsmBar {
    /// Bar diameter (mm)
    pub db: f64,
    /// Groove depth (mm)
    pub dg: f64,
    /// Groove width (mm)
    pub bg: f64,
    /// FRP material
    pub frp: FrpMaterial,
    /// Epoxy properties
    pub adhesive_strength: f64, // MPa
}

impl NsmBar {
    pub fn new(db: f64, frp: FrpMaterial) -> Self {
        // Groove dimensions per ACI 440.2R
        let dg = 1.5 * db;
        let bg = 1.5 * db;
        
        Self {
            db,
            dg,
            bg,
            frp,
            adhesive_strength: 30.0, // Typical epoxy
        }
    }
    
    /// Bar cross-sectional area (mm²)
    pub fn area(&self) -> f64 {
        PI * self.db.powi(2) / 4.0
    }
    
    /// Perimeter for bond (mm)
    pub fn perimeter(&self) -> f64 {
        PI * self.db
    }
    
    /// Development length (mm)
    pub fn development_length(&self, fc: f64) -> f64 {
        let ffu = self.frp.design_strength();
        let db = self.db;
        
        // Simplified formula
        let tau_b = 0.3 * fc.sqrt() + 2.0 * self.adhesive_strength.min(fc);
        
        ffu * db / (4.0 * tau_b)
    }
    
    /// Maximum tensile force (kN)
    pub fn max_force(&self) -> f64 {
        self.area() * self.frp.design_strength() / 1000.0
    }
}

// ============================================================================
// TESTS
// ============================================================================

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_fiber_properties() {
        let carbon = FiberType::Carbon;
        assert!(carbon.tensile_strength() > 3000.0);
        assert!(carbon.elastic_modulus() > 200.0);
        
        let glass = FiberType::EGlass;
        assert!(glass.tensile_strength() < carbon.tensile_strength());
    }

    #[test]
    fn test_frp_material() {
        let frp = FrpMaterial::new(FiberType::Carbon, FrpForm::WetLayup);
        
        assert!(frp.ffu > 1000.0);
        assert!(frp.ef > 50.0);
        assert!(frp.ce > 0.0 && frp.ce <= 1.0);
    }

    #[test]
    fn test_design_strength() {
        let frp = FrpMaterial::new(FiberType::Carbon, FrpForm::Laminate);
        
        let design = frp.design_strength();
        assert!(design < frp.ffu);
        assert!(design > 0.0);
    }

    #[test]
    fn test_flexural_strengthening() {
        let frp = FrpMaterial::new(FiberType::Carbon, FrpForm::WetLayup);
        let flex = FlexuralStrengthening::new(
            300.0, 500.0, 450.0,  // b, h, d
            30.0, 1500.0, 420.0,  // fc, As, fy
            frp, 2, 250.0,       // FRP, plies, width
        );
        
        let mn = flex.nominal_moment();
        assert!(mn > 0.0);
        
        let phi = flex.phi();
        assert!(phi >= 0.65 && phi <= 0.90);
    }

    #[test]
    fn test_debonding_strain() {
        let frp = FrpMaterial::new(FiberType::Carbon, FrpForm::WetLayup);
        let flex = FlexuralStrengthening::new(
            300.0, 500.0, 450.0,
            30.0, 1500.0, 420.0,
            frp, 2, 250.0,
        );
        
        let eps_fd = flex.debonding_strain();
        assert!(eps_fd > 0.0);
        assert!(eps_fd < 0.01);
    }

    #[test]
    fn test_shear_strengthening() {
        let frp = FrpMaterial::new(FiberType::Carbon, FrpForm::WetLayup);
        let shear = ShearStrengthening::new(
            300.0, 600.0, 540.0, 30.0,
            frp, 1, 100.0, 200.0, 90.0,
            ShearWrapScheme::UWrap,
        );
        
        let vf = shear.vf();
        assert!(vf > 0.0);
        
        let design_vf = shear.design_vf();
        assert!(design_vf < vf);
    }

    #[test]
    fn test_confinement_circular() {
        let frp = FrpMaterial::new(FiberType::Carbon, FrpForm::WetLayup);
        let conf = FrpConfinement::circular(400.0, 30.0, frp, 3);
        
        let fcc = conf.confined_strength();
        assert!(fcc >= conf.fc); // May be equal or greater
        
        let ratio = conf.strength_ratio();
        assert!(ratio >= 1.0);
    }

    #[test]
    fn test_confinement_rectangular() {
        let frp = FrpMaterial::new(FiberType::Carbon, FrpForm::WetLayup);
        let conf = FrpConfinement::rectangular(400.0, 600.0, 30.0, 30.0, frp, 3);
        
        let fl = conf.confinement_pressure();
        assert!(fl >= 0.0);
        
        // Rectangular provides some confinement
        assert!(conf.strength_ratio() >= 0.0);
    }

    #[test]
    fn test_bond_length() {
        let frp = FrpMaterial::new(FiberType::Carbon, FrpForm::WetLayup);
        let bond = FrpBond::new(30.0, frp, 2, 100.0, 300.0);
        
        let le = bond.effective_bond_length();
        assert!(le > 50.0 && le < 300.0);
    }

    #[test]
    fn test_bond_force() {
        let frp = FrpMaterial::new(FiberType::Carbon, FrpForm::Laminate);
        let bond = FrpBond::new(40.0, frp, 1, 50.0, 200.0);
        
        let f_max = bond.max_bond_force();
        assert!(f_max > 0.0);
    }

    #[test]
    fn test_nsm_bar() {
        let frp = FrpMaterial::new(FiberType::Carbon, FrpForm::NsmBar);
        let nsm = NsmBar::new(10.0, frp);
        
        let area = nsm.area();
        assert!((area - PI * 25.0).abs() < 0.1);
        
        let ld = nsm.development_length(30.0);
        assert!(ld > 0.0);
    }

    #[test]
    fn test_ductility_ratio() {
        let frp = FrpMaterial::new(FiberType::Carbon, FrpForm::WetLayup);
        let conf = FrpConfinement::circular(300.0, 25.0, frp, 4);
        
        let ductility = conf.ductility_ratio();
        assert!(ductility > 1.0);
    }
}
