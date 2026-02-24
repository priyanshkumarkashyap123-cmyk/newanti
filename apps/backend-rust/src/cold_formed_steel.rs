// ============================================================================
// COLD-FORMED STEEL DESIGN MODULE (AISI S100-16)
// North American Specification for Cold-Formed Steel Structural Members
// ============================================================================

use serde::{Deserialize, Serialize};
use std::f64::consts::PI;

// ============================================================================
// SECTION TYPES & PROPERTIES
// ============================================================================

/// Cold-formed steel section types
#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
pub enum CfsSection {
    /// C-section (channel with lips)
    CeeWithLips,
    /// C-section (channel without lips)
    CeeNoLips,
    /// Z-section with lips
    ZeeWithLips,
    /// Z-section without lips
    ZeeNoLips,
    /// Hat section
    Hat,
    /// Track section (C without lips, different proportions)
    Track,
    /// Sigma section
    Sigma,
    /// Box section (back-to-back C)
    Box,
    /// I-section (back-to-back C)
    ISection,
    /// Angle section
    Angle,
    /// Custom section
    Custom,
}

/// Cold-formed steel grade per ASTM standards
#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
pub enum SteelGrade {
    /// ASTM A653 Grade 33
    A653_33,
    /// ASTM A653 Grade 50
    A653_50,
    /// ASTM A653 Grade 80
    A653_80,
    /// ASTM A1011 Grade 33
    A1011_33,
    /// ASTM A1011 Grade 50
    A1011_50,
    /// ASTM A572 Grade 50
    A572_50,
    /// Custom grade
    Custom(f64, f64), // (Fy, Fu)
}

impl SteelGrade {
    /// Get yield strength Fy (MPa)
    pub fn fy(&self) -> f64 {
        match self {
            SteelGrade::A653_33 | SteelGrade::A1011_33 => 228.0,  // 33 ksi
            SteelGrade::A653_50 | SteelGrade::A1011_50 | SteelGrade::A572_50 => 345.0, // 50 ksi
            SteelGrade::A653_80 => 552.0, // 80 ksi
            SteelGrade::Custom(fy, _) => *fy,
        }
    }
    
    /// Get ultimate strength Fu (MPa)
    pub fn fu(&self) -> f64 {
        match self {
            SteelGrade::A653_33 | SteelGrade::A1011_33 => 310.0,  // 45 ksi
            SteelGrade::A653_50 | SteelGrade::A1011_50 => 450.0,  // 65 ksi
            SteelGrade::A653_80 => 565.0, // 82 ksi
            SteelGrade::A572_50 => 450.0, // 65 ksi
            SteelGrade::Custom(_, fu) => *fu,
        }
    }
}

/// Cold-formed steel section properties
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CfsSectionProps {
    /// Section type
    pub section_type: CfsSection,
    /// Steel grade
    pub grade: SteelGrade,
    /// Overall depth (mm)
    pub depth: f64,
    /// Flange width (mm)
    pub flange_width: f64,
    /// Lip length (mm)
    pub lip_length: f64,
    /// Base metal thickness (mm)
    pub thickness: f64,
    /// Inside bend radius (mm)
    pub bend_radius: f64,
    /// Gross area (mm²)
    pub area_gross: f64,
    /// Net area (mm²)
    pub area_net: f64,
    /// Moment of inertia Ix (mm⁴)
    pub ix: f64,
    /// Moment of inertia Iy (mm⁴)
    pub iy: f64,
    /// Section modulus Sx (mm³)
    pub sx: f64,
    /// Section modulus Sy (mm³)
    pub sy: f64,
    /// Radius of gyration rx (mm)
    pub rx: f64,
    /// Radius of gyration ry (mm)
    pub ry: f64,
    /// Torsional constant J (mm⁴)
    pub j: f64,
    /// Warping constant Cw (mm⁶)
    pub cw: f64,
    /// Distance from centroid to shear center xo (mm)
    pub xo: f64,
    /// Distance from centroid to shear center yo (mm)
    pub yo: f64,
    /// Polar radius of gyration ro (mm)
    pub ro: f64,
}

impl CfsSectionProps {
    /// Create a standard C-section with lips
    pub fn cee_with_lips(
        depth: f64,
        flange_width: f64,
        lip_length: f64,
        thickness: f64,
        bend_radius: f64,
        grade: SteelGrade,
    ) -> Self {
        let t = thickness;
        let r = bend_radius;
        let d = depth;
        let b = flange_width;
        let c = lip_length;
        
        // Centerline dimensions
        let d_c = d - t;
        let b_c = b - t / 2.0;
        let c_c = c - t / 2.0;
        
        // Approximate properties (centerline method)
        let area_gross = t * (d_c + 2.0 * b_c + 2.0 * c_c + 4.0 * PI * (r + t / 2.0) / 4.0);
        
        // Moment of inertia about x-axis
        let ix = t * d_c.powi(3) / 12.0 
            + 2.0 * t * b_c * (d_c / 2.0).powi(2)
            + 2.0 * t * c_c * (d_c / 2.0 - c_c / 2.0).powi(2);
        
        // Moment of inertia about y-axis  
        let x_bar = (2.0 * b_c * t * b_c / 2.0 + 2.0 * c_c * t * b_c) / area_gross;
        let iy = 2.0 * t * b_c.powi(3) / 12.0 
            + 2.0 * t * b_c * (b_c / 2.0 - x_bar).powi(2)
            + t * d_c * x_bar.powi(2)
            + 2.0 * t * c_c * (b_c - x_bar).powi(2);
        
        let sx = ix / (d / 2.0);
        let sy = iy / x_bar.max(b - x_bar);
        let rx = (ix / area_gross).sqrt();
        let ry = (iy / area_gross).sqrt();
        
        // Torsional constant (open section)
        let j = (area_gross * t.powi(2)) / 3.0;
        
        // Warping constant (approximate)
        let cw = ix * (b_c - x_bar).powi(2) / 4.0;
        
        // Shear center
        let xo = -(b_c - x_bar + (b_c.powi(2) * d_c.powi(2) * t) / (4.0 * ix));
        let yo: f64 = 0.0;
        
        // Polar radius of gyration
        let ro = (rx.powi(2) + ry.powi(2) + xo.powi(2) + yo.powi(2)).sqrt();
        
        Self {
            section_type: CfsSection::CeeWithLips,
            grade,
            depth,
            flange_width,
            lip_length,
            thickness,
            bend_radius,
            area_gross,
            area_net: area_gross, // Assume no holes
            ix,
            iy,
            sx,
            sy,
            rx,
            ry,
            j,
            cw,
            xo,
            yo,
            ro,
        }
    }
    
    /// Create a Z-section with lips
    pub fn zee_with_lips(
        depth: f64,
        flange_width: f64,
        lip_length: f64,
        thickness: f64,
        bend_radius: f64,
        grade: SteelGrade,
    ) -> Self {
        let t = thickness;
        let d = depth;
        let b = flange_width;
        let c = lip_length;
        
        // Centerline dimensions
        let d_c = d - t;
        let b_c = b - t / 2.0;
        let c_c = c - t / 2.0;
        
        // Z-section is point-symmetric
        let area_gross = t * (d_c + 2.0 * b_c + 2.0 * c_c);
        
        // For Z-section, principal axes are rotated
        let ix = t * d_c.powi(3) / 12.0 
            + 2.0 * t * b_c * (d_c / 2.0).powi(2)
            + 2.0 * t * c_c * (d_c / 2.0 - c_c / 2.0).powi(2);
        
        let iy = 2.0 * t * b_c.powi(3) / 12.0 
            + 2.0 * t * c_c.powi(3) / 12.0;
        
        let sx = ix / (d / 2.0);
        let sy = iy / (b / 2.0);
        let rx = (ix / area_gross).sqrt();
        let ry = (iy / area_gross).sqrt();
        
        let j = (area_gross * t.powi(2)) / 3.0;
        let cw = ix * b_c.powi(2) / 4.0;
        
        // Z-section shear center at centroid
        let xo = 0.0;
        let yo = 0.0;
        let ro = (rx.powi(2) + ry.powi(2)).sqrt();
        
        Self {
            section_type: CfsSection::ZeeWithLips,
            grade,
            depth,
            flange_width,
            lip_length,
            thickness,
            bend_radius,
            area_gross,
            area_net: area_gross,
            ix,
            iy,
            sx,
            sy,
            rx,
            ry,
            j,
            cw,
            xo,
            yo,
            ro,
        }
    }
    
    /// Create a hat section
    pub fn hat_section(
        depth: f64,
        top_width: f64,
        bottom_flange: f64,
        thickness: f64,
        bend_radius: f64,
        grade: SteelGrade,
    ) -> Self {
        let t = thickness;
        let d = depth;
        let w = top_width;
        let b = bottom_flange;
        
        let area_gross = t * (w + 2.0 * d + 2.0 * b);
        
        // Centroid from bottom
        let y_bar = (t * w * d + 2.0 * t * d * d / 2.0) / area_gross;
        
        let ix = t * w * (d - y_bar).powi(2)
            + 2.0 * (t * d.powi(3) / 12.0 + t * d * (d / 2.0 - y_bar).powi(2))
            + 2.0 * t * b * y_bar.powi(2);
        
        let iy = t * w.powi(3) / 12.0
            + 2.0 * t * d * (w / 2.0).powi(2)
            + 2.0 * t * b.powi(3) / 12.0
            + 2.0 * t * b * (w / 2.0 + b / 2.0).powi(2);
        
        let sx = ix / y_bar.max(d - y_bar);
        let sy = iy / (w / 2.0 + b);
        let rx = (ix / area_gross).sqrt();
        let ry = (iy / area_gross).sqrt();
        
        let j = (area_gross * t.powi(2)) / 3.0;
        let cw = 0.0; // Closed section approximation
        
        Self {
            section_type: CfsSection::Hat,
            grade,
            depth,
            flange_width: top_width,
            lip_length: bottom_flange,
            thickness,
            bend_radius,
            area_gross,
            area_net: area_gross,
            ix,
            iy,
            sx,
            sy,
            rx,
            ry,
            j,
            cw,
            xo: 0.0,
            yo: d - y_bar,
            ro: (rx.powi(2) + ry.powi(2)).sqrt(),
        }
    }
}

// ============================================================================
// EFFECTIVE WIDTH METHOD (AISI S100 Section B)
// ============================================================================

/// Effective width calculator for compression elements
#[derive(Debug, Clone)]
pub struct EffectiveWidthCalculator {
    /// Elastic modulus (MPa)
    pub e: f64,
    /// Poisson's ratio
    pub nu: f64,
}

impl Default for EffectiveWidthCalculator {
    fn default() -> Self {
        Self {
            e: 203000.0, // MPa
            nu: 0.3,
        }
    }
}

impl EffectiveWidthCalculator {
    /// Calculate effective width for uniformly compressed stiffened element
    /// AISI S100 Section B2.1
    pub fn stiffened_element(&self, w: f64, t: f64, f: f64, k: f64) -> f64 {
        let lambda = self.slenderness_factor(w, t, f, k);
        
        if lambda <= 0.673 {
            w // Fully effective
        } else {
            let rho = self.reduction_factor(lambda);
            rho * w
        }
    }
    
    /// Calculate effective width for unstiffened element
    /// AISI S100 Section B3.1
    pub fn unstiffened_element(&self, w: f64, t: f64, f: f64) -> f64 {
        let k = 0.43; // Unstiffened element
        let lambda = self.slenderness_factor(w, t, f, k);
        
        if lambda <= 0.673 {
            w
        } else {
            let rho = self.reduction_factor(lambda);
            rho * w
        }
    }
    
    /// Calculate effective width for element with stress gradient
    /// AISI S100 Section B2.3
    pub fn stiffened_with_gradient(&self, w: f64, t: f64, f1: f64, f2: f64) -> (f64, f64) {
        let psi = f2 / f1; // Stress ratio
        
        let k = if psi >= 0.0 {
            4.0 + 2.0 * (1.0 - psi).powi(3) + 2.0 * (1.0 - psi)
        } else {
            5.98 * (1.0 - psi).powi(2)
        };
        
        let lambda = self.slenderness_factor(w, t, f1, k);
        
        if lambda <= 0.673 {
            let b1 = w / (3.0 - psi);
            let b2 = w - b1;
            (b1, b2)
        } else {
            let rho = self.reduction_factor(lambda);
            let be = rho * w;
            let b1 = be / (3.0 - psi);
            let b2 = be - b1;
            (b1, b2)
        }
    }
    
    /// Calculate effective width for edge stiffened element (lip)
    /// AISI S100 Section B4
    pub fn edge_stiffened_element(
        &self,
        w: f64,
        t: f64,
        d: f64, // Lip depth
        f: f64,
    ) -> EffectiveLipResult {
        // Check if lip is adequate stiffener
        let s = 1.28 * (self.e / f).sqrt();
        let w_t = w / t;
        
        let ia = if w_t <= 0.328 * s {
            0.0
        } else {
            let ratio = w_t / s;
            399.0 * t.powi(4) * (ratio - 0.328).powi(3)
        };
        
        // Lip moment of inertia
        let is = d.powi(3) * t / 12.0;
        
        // Lip adequacy ratio
        let ri = (is / ia).min(1.0);
        
        // Effective width of flange
        let k_base = 4.0;
        let k = if ri < 1.0 {
            k_base * ri + 0.43 * (1.0 - ri)
        } else {
            k_base
        };
        
        let lambda = self.slenderness_factor(w, t, f, k);
        let b_eff = if lambda <= 0.673 {
            w
        } else {
            self.reduction_factor(lambda) * w
        };
        
        // Effective lip width
        let d_eff = if is >= ia {
            self.unstiffened_element(d, t, f)
        } else {
            ri * self.unstiffened_element(d, t, f)
        };
        
        EffectiveLipResult {
            b_effective: b_eff,
            d_effective: d_eff,
            lip_adequate: is >= ia,
            ri,
        }
    }
    
    /// Slenderness factor λ
    fn slenderness_factor(&self, w: f64, t: f64, f: f64, k: f64) -> f64 {
        let f_cr = self.elastic_buckling_stress(w, t, k);
        (f / f_cr).sqrt()
    }
    
    /// Elastic buckling stress
    fn elastic_buckling_stress(&self, w: f64, t: f64, k: f64) -> f64 {
        k * PI.powi(2) * self.e / (12.0 * (1.0 - self.nu.powi(2)) * (w / t).powi(2))
    }
    
    /// Reduction factor ρ
    fn reduction_factor(&self, lambda: f64) -> f64 {
        (1.0 - 0.22 / lambda) / lambda
    }
}

/// Result of edge-stiffened element calculation
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EffectiveLipResult {
    pub b_effective: f64,
    pub d_effective: f64,
    pub lip_adequate: bool,
    pub ri: f64,
}

// ============================================================================
// MEMBER DESIGN (AISI S100 Sections C & D)
// ============================================================================

/// Cold-formed steel member designer
#[derive(Debug, Clone)]
pub struct CfsMemberDesigner {
    pub section: CfsSectionProps,
    pub e: f64,    // Elastic modulus (MPa)
    pub g: f64,    // Shear modulus (MPa)
    pub phi_c: f64, // Resistance factor - compression (LRFD)
    pub phi_b: f64, // Resistance factor - bending (LRFD)
    pub phi_t: f64, // Resistance factor - tension (LRFD)
    pub phi_v: f64, // Resistance factor - shear (LRFD)
}

impl CfsMemberDesigner {
    pub fn new(section: CfsSectionProps) -> Self {
        Self {
            section,
            e: 203000.0,
            g: 78000.0,
            phi_c: 0.85,
            phi_b: 0.90,
            phi_t: 0.90,
            phi_v: 0.95,
        }
    }
    
    /// Calculate nominal axial strength (tension)
    /// AISI S100 Section C2
    pub fn tension_capacity(&self) -> TensionResult {
        let fy = self.section.grade.fy();
        let fu = self.section.grade.fu();
        
        // Yielding in gross section
        let pn_yield = self.section.area_gross * fy;
        
        // Rupture in net section
        let pn_rupture = self.section.area_net * fu;
        
        let pn = pn_yield.min(pn_rupture);
        let phi_pn = self.phi_t * pn;
        
        TensionResult {
            pn_yield,
            pn_rupture,
            pn_nominal: pn,
            phi_pn,
            governs: if pn_yield < pn_rupture { "Yielding" } else { "Rupture" }.to_string(),
        }
    }
    
    /// Calculate nominal axial strength (compression)
    /// AISI S100 Section C4
    pub fn compression_capacity(&self, kl_x: f64, kl_y: f64, kl_t: f64) -> CompressionResult {
        let fy = self.section.grade.fy();
        
        // Flexural buckling about x-axis
        let fe_x = PI.powi(2) * self.e / (kl_x / self.section.rx).powi(2);
        
        // Flexural buckling about y-axis  
        let fe_y = PI.powi(2) * self.e / (kl_y / self.section.ry).powi(2);
        
        // Torsional buckling
        let fe_t = self.torsional_buckling_stress(kl_t);
        
        // Flexural-torsional buckling (for singly symmetric sections)
        let fe_ft = self.flexural_torsional_buckling_stress(fe_y, fe_t);
        
        // Governing elastic buckling stress
        let fe = fe_x.min(fe_y).min(fe_ft);
        
        // Nominal stress Fn
        let lambda_c = (fy / fe).sqrt();
        let fn_stress = if lambda_c <= 1.5 {
            (0.658_f64.powf(lambda_c.powi(2))) * fy
        } else {
            0.877 / lambda_c.powi(2) * fy
        };
        
        // Calculate effective area at stress Fn
        let ae = self.effective_area(fn_stress);
        
        let pn = ae * fn_stress;
        let phi_pn = self.phi_c * pn;
        
        CompressionResult {
            fe_x,
            fe_y,
            fe_t,
            fe_ft,
            fe_governing: fe,
            lambda_c,
            fn_stress,
            area_effective: ae,
            pn_nominal: pn,
            phi_pn,
        }
    }
    
    /// Calculate nominal flexural strength
    /// AISI S100 Section C3
    pub fn flexural_capacity(&self, lb: f64, cb: f64) -> FlexuralResult {
        let fy = self.section.grade.fy();
        
        // Yield moment
        let my = self.section.sx * fy;
        
        // Lateral-torsional buckling moment
        let me = self.lateral_torsional_buckling_moment(lb, cb);
        
        // Critical moment
        let mc = if me >= 2.78 * my {
            my // Yielding governs
        } else if me > 0.56 * my {
            10.0 / 9.0 * my * (1.0 - 10.0 * my / (36.0 * me))
        } else {
            me // Elastic LTB governs
        };
        
        // Local buckling check
        let se = self.effective_section_modulus(fy);
        let mn_local = se * fy;
        
        let mn = mc.min(mn_local);
        let phi_mn = self.phi_b * mn;
        
        FlexuralResult {
            my,
            me,
            mc,
            mn_local,
            mn_nominal: mn,
            phi_mn,
            se,
            governs: if mc < mn_local { "LTB" } else { "Local" }.to_string(),
        }
    }
    
    /// Calculate nominal shear strength
    /// AISI S100 Section C3.2
    pub fn shear_capacity(&self) -> ShearResult {
        let fy = self.section.grade.fy();
        let h = self.section.depth - 2.0 * self.section.thickness; // Web depth
        let t = self.section.thickness;
        let kv = 5.34; // Shear buckling coefficient (no stiffeners)
        
        let ek_fv = self.e * kv / fy;
        let h_t = h / t;
        
        let vn = if h_t <= 1.08 * ek_fv.sqrt() {
            // Yielding
            0.6 * fy * h * t
        } else if h_t <= 1.40 * ek_fv.sqrt() {
            // Inelastic buckling
            0.64 * (ek_fv).sqrt() * t.powi(2) * (self.e * kv * fy).sqrt()
        } else {
            // Elastic buckling
            0.905 * self.e * kv * t.powi(3) / h
        };
        
        let phi_vn = self.phi_v * vn;
        
        ShearResult {
            h_t_ratio: h_t,
            web_area: h * t,
            vn_nominal: vn,
            phi_vn,
        }
    }
    
    /// Calculate web crippling strength
    /// AISI S100 Section C3.4
    pub fn web_crippling(&self, load_case: WebCripplingCase, n: f64, theta: f64) -> f64 {
        let t = self.section.thickness;
        let h = self.section.depth - 2.0 * t;
        let r = self.section.bend_radius;
        let fy = self.section.grade.fy();
        
        // Coefficients depend on load case and section type
        let (c, c_r, c_n, c_h) = match load_case {
            WebCripplingCase::EndOneFlange => (4.0, 0.14, 0.35, 0.02),
            WebCripplingCase::EndTwoFlange => (13.0, 0.23, 0.14, 0.01),
            WebCripplingCase::InteriorOneFlange => (13.0, 0.32, 0.05, 0.04),
            WebCripplingCase::InteriorTwoFlange => (24.0, 0.52, 0.15, 0.001),
        };
        
        let pn = c * t.powi(2) * fy.sqrt() * (1.0 - c_r * (r / t).sqrt())
            * (1.0 + c_n * (n / t).sqrt()) * (1.0 - c_h * (h / t).sqrt())
            * theta.sin();
        
        self.phi_c * pn * 0.75 // Web crippling phi = 0.75
    }
    
    /// Torsional buckling stress
    fn torsional_buckling_stress(&self, kl_t: f64) -> f64 {
        let a = self.section.area_gross;
        let ro = self.section.ro;
        
        (1.0 / (a * ro.powi(2))) * (self.g * self.section.j 
            + PI.powi(2) * self.e * self.section.cw / kl_t.powi(2))
    }
    
    /// Flexural-torsional buckling stress (singly symmetric)
    fn flexural_torsional_buckling_stress(&self, fe_y: f64, fe_t: f64) -> f64 {
        let beta = 1.0 - (self.section.xo / self.section.ro).powi(2);
        
        (1.0 / (2.0 * beta)) * ((fe_y + fe_t) 
            - ((fe_y + fe_t).powi(2) - 4.0 * beta * fe_y * fe_t).sqrt())
    }
    
    /// Lateral-torsional buckling moment
    fn lateral_torsional_buckling_moment(&self, lb: f64, cb: f64) -> f64 {
        let sf = self.section.sx;
        let iy = self.section.iy;
        let j = self.section.j;
        let cw = self.section.cw;
        
        let ro = self.section.ro;
        let _a = self.section.area_gross;
        
        // Elastic LTB moment
        let fe = (cb * PI.powi(2) * self.e * iy / lb.powi(2))
            * (self.g * j + PI.powi(2) * self.e * cw / lb.powi(2)).sqrt()
            / (sf * ro);
        
        sf * fe
    }
    
    /// Calculate effective area at given stress
    fn effective_area(&self, f: f64) -> f64 {
        let calc = EffectiveWidthCalculator::default();
        let t = self.section.thickness;
        
        match self.section.section_type {
            CfsSection::CeeWithLips => {
                let web_eff = calc.stiffened_element(
                    self.section.depth - 2.0 * t, t, f, 4.0);
                let lip_result = calc.edge_stiffened_element(
                    self.section.flange_width - t, t, self.section.lip_length - t / 2.0, f);
                
                // Effective area
                t * (web_eff + 2.0 * lip_result.b_effective + 2.0 * lip_result.d_effective)
            }
            _ => {
                // Simplified for other sections
                self.section.area_gross * 0.9
            }
        }
    }
    
    /// Calculate effective section modulus
    fn effective_section_modulus(&self, f: f64) -> f64 {
        let ae = self.effective_area(f);
        let a = self.section.area_gross;
        
        // Approximate based on area reduction
        self.section.sx * (ae / a).powf(1.5)
    }
}

/// Web crippling load case
#[derive(Debug, Clone, Copy)]
pub enum WebCripplingCase {
    EndOneFlange,
    EndTwoFlange,
    InteriorOneFlange,
    InteriorTwoFlange,
}

/// Tension design result
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TensionResult {
    pub pn_yield: f64,
    pub pn_rupture: f64,
    pub pn_nominal: f64,
    pub phi_pn: f64,
    pub governs: String,
}

/// Compression design result
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CompressionResult {
    pub fe_x: f64,
    pub fe_y: f64,
    pub fe_t: f64,
    pub fe_ft: f64,
    pub fe_governing: f64,
    pub lambda_c: f64,
    pub fn_stress: f64,
    pub area_effective: f64,
    pub pn_nominal: f64,
    pub phi_pn: f64,
}

/// Flexural design result
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FlexuralResult {
    pub my: f64,
    pub me: f64,
    pub mc: f64,
    pub mn_local: f64,
    pub mn_nominal: f64,
    pub phi_mn: f64,
    pub se: f64,
    pub governs: String,
}

/// Shear design result
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ShearResult {
    pub h_t_ratio: f64,
    pub web_area: f64,
    pub vn_nominal: f64,
    pub phi_vn: f64,
}

// ============================================================================
// COMBINED ACTIONS (AISI S100 Section C5)
// ============================================================================

/// Check combined axial and bending
pub fn combined_axial_bending(
    pu: f64,           // Required axial strength (compression positive)
    mux: f64,          // Required moment about x-axis
    muy: f64,          // Required moment about y-axis
    phi_pn: f64,       // Design compression strength
    phi_mnx: f64,      // Design moment strength about x
    phi_mny: f64,      // Design moment strength about y
    cm_x: f64,         // Moment modification factor x
    cm_y: f64,         // Moment modification factor y
    pe_x: f64,         // Euler load x
    pe_y: f64,         // Euler load y
) -> CombinedResult {
    // Amplification factors
    let alpha_x = 1.0 / (1.0 - pu / pe_x);
    let alpha_y = 1.0 / (1.0 - pu / pe_y);
    
    // Amplified moments
    let mux_amp = cm_x * mux * alpha_x;
    let muy_amp = cm_y * muy * alpha_y;
    
    // Interaction ratio
    let ratio = if pu / phi_pn >= 0.15 {
        // AISI Eq. C5.2.2-1
        pu / phi_pn + mux_amp / phi_mnx + muy_amp / phi_mny
    } else {
        // AISI Eq. C5.2.2-2
        pu / (2.0 * phi_pn) + mux_amp / phi_mnx + muy_amp / phi_mny
    };
    
    CombinedResult {
        axial_ratio: pu / phi_pn,
        moment_x_ratio: mux_amp / phi_mnx,
        moment_y_ratio: muy_amp / phi_mny,
        alpha_x,
        alpha_y,
        interaction_ratio: ratio,
        pass: ratio <= 1.0,
    }
}

/// Combined action result
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CombinedResult {
    pub axial_ratio: f64,
    pub moment_x_ratio: f64,
    pub moment_y_ratio: f64,
    pub alpha_x: f64,
    pub alpha_y: f64,
    pub interaction_ratio: f64,
    pub pass: bool,
}

// ============================================================================
// STANDARD SECTION DATABASE
// ============================================================================

/// Get standard CFS section by designation
pub fn get_standard_section(designation: &str) -> Option<CfsSectionProps> {
    // Common SSMA designations: 600S162-54 means 6" depth, 1.625" flange, 0.054" thick
    let parts: Vec<&str> = designation.split(|c| c == 'S' || c == '-').collect();
    
    if parts.len() >= 3 {
        let depth_in: f64 = parts[0].parse::<f64>().ok()? / 100.0;
        let flange_in: f64 = parts[1].parse::<f64>().ok()? / 1000.0;
        let thick_mil: f64 = parts[2].parse::<f64>().ok()?;
        
        // Convert to mm
        let depth = depth_in * 25.4;
        let flange = flange_in * 25.4 * 10.0; // flange code is in 1/16"
        let thickness = thick_mil * 0.0254; // mils to mm
        let lip = 0.5 * 25.4; // Standard 1/2" lip
        let radius = 1.5 * thickness; // Standard inside radius
        
        return Some(CfsSectionProps::cee_with_lips(
            depth, flange, lip, thickness, radius, SteelGrade::A653_50));
    }
    
    // Try common designations
    match designation.to_uppercase().as_str() {
        "362S162-33" => Some(CfsSectionProps::cee_with_lips(
            92.1, 41.3, 12.7, 0.84, 1.26, SteelGrade::A653_33)),
        "362S162-54" => Some(CfsSectionProps::cee_with_lips(
            92.1, 41.3, 12.7, 1.37, 2.06, SteelGrade::A653_50)),
        "600S162-54" => Some(CfsSectionProps::cee_with_lips(
            152.4, 41.3, 12.7, 1.37, 2.06, SteelGrade::A653_50)),
        "600S162-97" => Some(CfsSectionProps::cee_with_lips(
            152.4, 41.3, 12.7, 2.46, 3.69, SteelGrade::A653_50)),
        "800S162-54" => Some(CfsSectionProps::cee_with_lips(
            203.2, 41.3, 12.7, 1.37, 2.06, SteelGrade::A653_50)),
        "800S162-97" => Some(CfsSectionProps::cee_with_lips(
            203.2, 41.3, 12.7, 2.46, 3.69, SteelGrade::A653_50)),
        "1000S162-97" => Some(CfsSectionProps::cee_with_lips(
            254.0, 41.3, 12.7, 2.46, 3.69, SteelGrade::A653_50)),
        "1200S162-97" => Some(CfsSectionProps::cee_with_lips(
            304.8, 41.3, 12.7, 2.46, 3.69, SteelGrade::A653_50)),
        _ => None,
    }
}

// ============================================================================
// TESTS
// ============================================================================

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_cee_section_properties() {
        let section = CfsSectionProps::cee_with_lips(
            152.4,  // 6" depth
            41.3,   // 1-5/8" flange
            12.7,   // 1/2" lip
            1.37,   // 54 mil thickness
            2.06,   // Bend radius
            SteelGrade::A653_50,
        );
        
        assert!(section.area_gross > 300.0); // ~400 mm²
        assert!(section.ix > 1.0e6); // mm⁴
        assert!(section.rx > 50.0); // mm
    }

    #[test]
    fn test_zee_section_properties() {
        let section = CfsSectionProps::zee_with_lips(
            203.2,  // 8" depth
            63.5,   // 2.5" flange
            19.1,   // 3/4" lip
            1.81,   // 71 mil thickness
            2.72,
            SteelGrade::A653_50,
        );
        
        assert!(section.area_gross > 500.0);
        assert!(section.section_type == CfsSection::ZeeWithLips);
    }

    #[test]
    fn test_effective_width_stiffened() {
        let calc = EffectiveWidthCalculator::default();
        
        // Stocky element - should be fully effective
        let w_eff = calc.stiffened_element(50.0, 2.0, 200.0, 4.0);
        assert!((w_eff - 50.0).abs() < 0.1);
        
        // Slender element - reduced
        let w_eff2 = calc.stiffened_element(150.0, 1.0, 345.0, 4.0);
        assert!(w_eff2 < 150.0);
    }

    #[test]
    fn test_effective_width_unstiffened() {
        let calc = EffectiveWidthCalculator::default();
        
        // Slender unstiffened lip
        let w_eff = calc.unstiffened_element(20.0, 1.0, 345.0);
        assert!(w_eff <= 20.0);
    }

    #[test]
    fn test_tension_capacity() {
        let section = CfsSectionProps::cee_with_lips(
            152.4, 41.3, 12.7, 1.37, 2.06, SteelGrade::A653_50);
        let designer = CfsMemberDesigner::new(section);
        
        let result = designer.tension_capacity();
        
        assert!(result.pn_nominal > 100000.0); // > 100 kN
        assert!(result.phi_pn < result.pn_nominal);
        assert!(!result.governs.is_empty());
    }

    #[test]
    fn test_compression_capacity() {
        let section = CfsSectionProps::cee_with_lips(
            152.4, 41.3, 12.7, 1.37, 2.06, SteelGrade::A653_50);
        let designer = CfsMemberDesigner::new(section);
        
        // 3m effective length
        let result = designer.compression_capacity(3000.0, 3000.0, 3000.0);
        
        assert!(result.pn_nominal > 0.0);
        assert!(result.phi_pn > 0.0);
        assert!(result.lambda_c > 0.0);
    }

    #[test]
    fn test_flexural_capacity() {
        let section = CfsSectionProps::cee_with_lips(
            152.4, 41.3, 12.7, 1.37, 2.06, SteelGrade::A653_50);
        let designer = CfsMemberDesigner::new(section);
        
        let result = designer.flexural_capacity(2000.0, 1.0);
        
        assert!(result.mn_nominal > 0.0);
        assert!(result.my > 0.0);
        assert!(!result.governs.is_empty());
    }

    #[test]
    fn test_shear_capacity() {
        let section = CfsSectionProps::cee_with_lips(
            152.4, 41.3, 12.7, 1.37, 2.06, SteelGrade::A653_50);
        let designer = CfsMemberDesigner::new(section);
        
        let result = designer.shear_capacity();
        
        assert!(result.vn_nominal > 0.0);
        assert!(result.phi_vn > 0.0);
    }

    #[test]
    fn test_combined_axial_bending() {
        let result = combined_axial_bending(
            50000.0,    // 50 kN axial
            5.0e6,      // 5 kNm moment x
            1.0e6,      // 1 kNm moment y
            150000.0,   // 150 kN compression capacity
            15.0e6,     // 15 kNm moment capacity x
            5.0e6,      // 5 kNm moment capacity y
            0.85,       // Cm_x
            0.85,       // Cm_y
            500000.0,   // Pe_x
            200000.0,   // Pe_y
        );
        
        assert!(result.interaction_ratio > 0.0);
    }

    #[test]
    fn test_web_crippling() {
        let section = CfsSectionProps::cee_with_lips(
            152.4, 41.3, 12.7, 1.37, 2.06, SteelGrade::A653_50);
        let designer = CfsMemberDesigner::new(section);
        
        let pn = designer.web_crippling(
            WebCripplingCase::EndOneFlange,
            50.0,  // Bearing length
            PI / 2.0, // 90 degrees
        );
        
        assert!(pn > 0.0);
    }

    #[test]
    fn test_standard_section_database() {
        let section = get_standard_section("600S162-54");
        assert!(section.is_some());
        
        let s = section.unwrap();
        assert!((s.depth - 152.4).abs() < 1.0);
    }

    #[test]
    fn test_steel_grades() {
        assert_eq!(SteelGrade::A653_33.fy(), 228.0);
        assert_eq!(SteelGrade::A653_50.fy(), 345.0);
        assert_eq!(SteelGrade::A653_80.fy(), 552.0);
        
        let custom = SteelGrade::Custom(300.0, 400.0);
        assert_eq!(custom.fy(), 300.0);
        assert_eq!(custom.fu(), 400.0);
    }
}
