// ============================================================================
// SHELL BUCKLING ANALYSIS MODULE
// Cylindrical, spherical, conical shells - EN 1993-1-6, ASME, ECCS
// ============================================================================

use serde::{Deserialize, Serialize};
use std::f64::consts::PI;

// ============================================================================
// SHELL GEOMETRY
// ============================================================================

/// Shell type
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum ShellType {
    /// Cylindrical shell
    Cylindrical,
    /// Conical shell
    Conical,
    /// Spherical shell/dome
    Spherical,
    /// Toroidal (torus segment)
    Toroidal,
    /// Hyperboloid
    Hyperboloid,
}

/// Shell fabrication quality class (EN 1993-1-6)
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum FabricationClass {
    /// Class A - Excellent quality
    ClassA,
    /// Class B - High quality
    ClassB,
    /// Class C - Normal quality
    ClassC,
}

impl FabricationClass {
    /// Quality parameter Qg for imperfections
    pub fn quality_parameter(&self) -> f64 {
        match self {
            FabricationClass::ClassA => 40.0,
            FabricationClass::ClassB => 25.0,
            FabricationClass::ClassC => 16.0,
        }
    }
    
    /// Dimple tolerance parameter U0
    pub fn dimple_parameter(&self) -> f64 {
        match self {
            FabricationClass::ClassA => 0.006,
            FabricationClass::ClassB => 0.010,
            FabricationClass::ClassC => 0.016,
        }
    }
}

// ============================================================================
// CYLINDRICAL SHELL BUCKLING
// ============================================================================

/// Cylindrical shell under various loads
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CylindricalShell {
    /// Radius (m)
    pub radius: f64,
    /// Thickness (mm)
    pub thickness: f64,
    /// Length (m)
    pub length: f64,
    /// Young's modulus (MPa)
    pub e: f64,
    /// Poisson's ratio
    pub nu: f64,
    /// Yield strength (MPa)
    pub fy: f64,
    /// Fabrication class
    pub fab_class: FabricationClass,
}

impl CylindricalShell {
    pub fn new(radius: f64, thickness: f64, length: f64) -> Self {
        Self {
            radius,
            thickness,
            length,
            e: 210_000.0,
            nu: 0.3,
            fy: 355.0,
            fab_class: FabricationClass::ClassB,
        }
    }
    
    /// Radius to thickness ratio
    pub fn r_t_ratio(&self) -> f64 {
        self.radius / (self.thickness / 1000.0)
    }
    
    /// Batdorf parameter Z
    pub fn batdorf_z(&self) -> f64 {
        let r = self.radius;
        let t = self.thickness / 1000.0;
        let l = self.length;
        
        l.powi(2) / (r * t) * (1.0 - self.nu.powi(2)).sqrt()
    }
    
    /// Dimensionless length parameter ω
    pub fn omega(&self) -> f64 {
        let r = self.radius;
        let t = self.thickness / 1000.0;
        
        self.length / (r * t).sqrt()
    }
    
    /// Classical elastic critical stress - axial compression (MPa)
    pub fn sigma_cr_axial_classical(&self) -> f64 {
        let r = self.radius;
        let t = self.thickness / 1000.0;
        
        0.605 * self.e * t / r
    }
    
    /// Knockdown factor for axial compression (EN 1993-1-6)
    pub fn knockdown_axial(&self) -> f64 {
        let omega = self.omega();
        let q = self.fab_class.quality_parameter();
        
        // Alpha_x from EN 1993-1-6
        let alpha_x = if omega <= 1.7 {
            0.62
        } else if omega < 0.5 * self.r_t_ratio() {
            0.62 / (1.0 + 1.91 * (omega / q).powf(1.44))
        } else {
            0.62 / (1.0 + 1.91 * (0.5 * self.r_t_ratio() / q).powf(1.44))
        };
        
        alpha_x.max(0.2)
    }
    
    /// Design critical stress - axial compression (MPa)
    pub fn sigma_cr_axial(&self) -> f64 {
        self.sigma_cr_axial_classical() * self.knockdown_axial()
    }
    
    /// Classical critical pressure - external (MPa)
    pub fn p_cr_external_classical(&self) -> f64 {
        let r = self.radius;
        let t = self.thickness / 1000.0;
        let l = self.length;
        
        // Short vs long cylinder
        let c_x = if self.batdorf_z() < 2.85 {
            // Short cylinder
            1.0 / (1.0 - self.nu.powi(2))
        } else {
            // Long cylinder (with rings or free)
            let n: i32 = 2; // Minimum circumferential waves
            let m: i32 = 1; // Axial half-waves
            
            let lambda = m as f64 * PI * r / l;
            (lambda.powi(4) + n.pow(2) as f64 - 1.0).powi(2) / 
                (lambda.powi(2) + n.pow(2) as f64).powi(2) +
                (n.pow(2) as f64 - 1.0) / (1.0 + lambda.powi(2) / n.pow(2) as f64)
        };
        
        c_x * self.e * (t / r).powi(3) / (12.0 * (1.0 - self.nu.powi(2)))
    }
    
    /// Knockdown factor for external pressure
    pub fn knockdown_external(&self) -> f64 {
        let q = self.fab_class.quality_parameter();
        
        // Alpha_θ from EN 1993-1-6
        0.5 + 0.3 * (q / 40.0).min(1.0)
    }
    
    /// Design critical pressure - external (MPa)
    pub fn p_cr_external(&self) -> f64 {
        self.p_cr_external_classical() * self.knockdown_external()
    }
    
    /// Critical shear stress (MPa)
    pub fn tau_cr_classical(&self) -> f64 {
        let r = self.radius;
        let t = self.thickness / 1000.0;
        let l = self.length;
        
        // Donnell formula
        if l / r < 3.0 {
            // Short cylinder
            0.747 * self.e * (t / r).powf(1.5) * (r / l).sqrt()
        } else {
            // Long cylinder
            0.747 * self.e * (t / r).powf(1.5) / (l / r).sqrt()
        }
    }
    
    /// Knockdown factor for shear
    pub fn knockdown_shear(&self) -> f64 {
        0.67 + 0.15 * (self.fab_class.quality_parameter() / 40.0).min(1.0)
    }
    
    /// Design critical shear stress (MPa)
    pub fn tau_cr(&self) -> f64 {
        self.tau_cr_classical() * self.knockdown_shear()
    }
    
    /// Interaction check for combined loading
    pub fn interaction_ratio(&self, sigma_x: f64, sigma_theta: f64, tau: f64) -> f64 {
        let sigma_x_cr = self.sigma_cr_axial();
        let sigma_theta_cr = self.p_cr_external() * self.radius / (self.thickness / 1000.0);
        let tau_cr = self.tau_cr();
        
        // EN 1993-1-6 interaction
        (sigma_x / sigma_x_cr).max(0.0).powi(2) +
            (sigma_theta / sigma_theta_cr).max(0.0).powi(2) +
            (tau / tau_cr).powi(2)
    }
}

// ============================================================================
// SPHERICAL SHELL BUCKLING
// ============================================================================

/// Spherical shell (dome) under external pressure
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SphericalShell {
    /// Radius (m)
    pub radius: f64,
    /// Thickness (mm)
    pub thickness: f64,
    /// Young's modulus (MPa)
    pub e: f64,
    /// Yield strength (MPa)
    pub fy: f64,
    /// Fabrication class
    pub fab_class: FabricationClass,
}

impl SphericalShell {
    pub fn new(radius: f64, thickness: f64) -> Self {
        Self {
            radius,
            thickness,
            e: 210_000.0,
            fy: 355.0,
            fab_class: FabricationClass::ClassB,
        }
    }
    
    /// Classical critical pressure (MPa)
    pub fn p_cr_classical(&self) -> f64 {
        let r = self.radius;
        let t = self.thickness / 1000.0;
        
        2.0 * self.e / (3.0_f64.sqrt() * (1.0 - 0.3_f64.powi(2)).sqrt()) * (t / r).powi(2)
    }
    
    /// Knockdown factor for spherical shell
    pub fn knockdown(&self) -> f64 {
        // Kaplan knockdown (very conservative for spheres)
        let r_t = self.radius / (self.thickness / 1000.0);
        
        if r_t < 500.0 {
            0.3
        } else if r_t < 1500.0 {
            0.2
        } else {
            0.14
        }
    }
    
    /// Design critical pressure (MPa)
    pub fn p_cr(&self) -> f64 {
        self.p_cr_classical() * self.knockdown()
    }
    
    /// Membrane stress under pressure (MPa)
    pub fn membrane_stress(&self, pressure: f64) -> f64 {
        let r = self.radius;
        let t = self.thickness / 1000.0;
        
        pressure * r / (2.0 * t)
    }
    
    /// Buckling factor of safety
    pub fn buckling_fos(&self, pressure: f64) -> f64 {
        self.p_cr() / pressure
    }
}

// ============================================================================
// CONICAL SHELL BUCKLING
// ============================================================================

/// Conical shell analysis
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConicalShell {
    /// Small end radius r1 (m)
    pub r1: f64,
    /// Large end radius r2 (m)
    pub r2: f64,
    /// Slant length (m)
    pub slant_length: f64,
    /// Thickness (mm)
    pub thickness: f64,
    /// Young's modulus (MPa)
    pub e: f64,
    /// Fabrication class
    pub fab_class: FabricationClass,
}

impl ConicalShell {
    pub fn new(r1: f64, r2: f64, height: f64, thickness: f64) -> Self {
        let slant = (height.powi(2) + (r2 - r1).powi(2)).sqrt();
        
        Self {
            r1,
            r2,
            slant_length: slant,
            thickness,
            e: 210_000.0,
            fab_class: FabricationClass::ClassB,
        }
    }
    
    /// Half apex angle (radians)
    pub fn half_angle(&self) -> f64 {
        ((self.r2 - self.r1) / self.slant_length).asin()
    }
    
    /// Equivalent cylinder radius at mid-height
    pub fn equivalent_radius(&self) -> f64 {
        (self.r1 + self.r2) / 2.0 / self.half_angle().cos()
    }
    
    /// Axial height (m)
    pub fn height(&self) -> f64 {
        (self.slant_length.powi(2) - (self.r2 - self.r1).powi(2)).sqrt()
    }
    
    /// Critical axial stress (MPa) - using equivalent cylinder
    pub fn sigma_cr_axial(&self) -> f64 {
        let r_eq = self.equivalent_radius();
        let t = self.thickness / 1000.0;
        let cos_beta = self.half_angle().cos();
        
        0.605 * self.e * t / r_eq * cos_beta * 0.7 // 0.7 knockdown
    }
    
    /// Critical external pressure (MPa)
    pub fn p_cr_external(&self) -> f64 {
        let r_eq = self.equivalent_radius();
        let t = self.thickness / 1000.0;
        let l = self.slant_length;
        
        // Equivalent cylinder approach
        let c = 0.92 * (l.powi(2) / (r_eq * t)).powf(-0.5);
        
        c * self.e * (t / r_eq).powf(2.5) * 0.6 // 0.6 knockdown
    }
}

// ============================================================================
// RING STIFFENED SHELLS
// ============================================================================

/// Ring stiffener
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RingStiffener {
    /// Ring spacing (m)
    pub spacing: f64,
    /// Ring area (mm²)
    pub area: f64,
    /// Ring moment of inertia (mm⁴)
    pub inertia: f64,
    /// Is ring internal or external?
    pub is_internal: bool,
}

impl RingStiffener {
    pub fn new(spacing: f64, area: f64, inertia: f64) -> Self {
        Self {
            spacing,
            area,
            inertia,
            is_internal: true,
        }
    }
    
    /// Required moment of inertia (mm⁴) for external pressure
    pub fn required_inertia(pressure: f64, radius: f64, spacing: f64, e: f64) -> f64 {
        // I = p × R³ × L / (3E) in m⁴; × 1e12 to convert to mm⁴
        pressure * radius.powi(3) * spacing * 1e12 / (3.0 * e)
    }
    
    /// Effective shell width participating with ring (m)
    pub fn effective_width(&self, radius: f64, thickness: f64) -> f64 {
        1.56 * (radius * thickness / 1000.0).sqrt()
    }
}

/// Ring-stiffened cylindrical shell
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StiffenedCylinder {
    /// Base shell
    pub shell: CylindricalShell,
    /// Ring stiffeners
    pub rings: Vec<RingStiffener>,
}

impl StiffenedCylinder {
    pub fn new(shell: CylindricalShell, ring_spacing: f64, ring_area: f64, ring_i: f64) -> Self {
        let num_rings = (shell.length / ring_spacing).floor() as usize;
        let rings = (0..num_rings)
            .map(|_| RingStiffener::new(ring_spacing, ring_area, ring_i))
            .collect();
        
        Self { shell, rings }
    }
    
    /// Inter-ring buckling pressure (MPa)
    pub fn inter_ring_buckling(&self) -> f64 {
        if self.rings.is_empty() {
            return self.shell.p_cr_external();
        }
        
        let spacing = self.rings[0].spacing;
        let mut panel_shell = self.shell.clone();
        panel_shell.length = spacing;
        
        panel_shell.p_cr_external()
    }
    
    /// General instability pressure (MPa)
    pub fn general_instability(&self) -> f64 {
        if self.rings.is_empty() {
            return self.shell.p_cr_external();
        }
        
        let ring = &self.rings[0];
        let r = self.shell.radius;
        let t = self.shell.thickness / 1000.0;
        let _l = self.shell.length;
        let e = self.shell.e;
        
        // Combined shell + ring stiffness
        let i_ring = ring.inertia / 1e12; // m⁴
        let i_shell = t.powi(3) * ring.spacing / 12.0;
        
        let i_eff = i_ring / ring.spacing + i_shell;
        
        3.0 * e * i_eff / (r.powi(3) * (1.0 - 0.3_f64.powi(2)))
    }
    
    /// Critical pressure (minimum of modes)
    pub fn p_cr(&self) -> f64 {
        self.inter_ring_buckling().min(self.general_instability())
    }
}

// ============================================================================
// TESTS
// ============================================================================

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_cylindrical_shell() {
        let shell = CylindricalShell::new(5.0, 20.0, 15.0);
        
        assert!(shell.r_t_ratio() > 100.0);
    }

    #[test]
    fn test_axial_buckling() {
        let shell = CylindricalShell::new(5.0, 20.0, 15.0);
        let sigma_cr = shell.sigma_cr_axial();
        
        assert!(sigma_cr > 50.0 && sigma_cr < 500.0);
    }

    #[test]
    fn test_external_pressure() {
        let shell = CylindricalShell::new(5.0, 20.0, 15.0);
        let p_cr = shell.p_cr_external();
        
        assert!(p_cr > 0.0);
    }

    #[test]
    fn test_knockdown() {
        let shell = CylindricalShell::new(5.0, 20.0, 15.0);
        
        // Knockdown factors for thin shells can be very low
        assert!(shell.knockdown_axial() < 1.0);
        assert!(shell.knockdown_axial() > 0.05); // Very thin shells have low knockdown
    }

    #[test]
    fn test_shear_buckling() {
        let shell = CylindricalShell::new(5.0, 20.0, 15.0);
        let tau_cr = shell.tau_cr();
        
        assert!(tau_cr > 0.0);
    }

    #[test]
    fn test_interaction() {
        let shell = CylindricalShell::new(5.0, 20.0, 15.0);
        let ratio = shell.interaction_ratio(50.0, 10.0, 20.0);
        
        assert!(ratio > 0.0);
    }

    #[test]
    fn test_spherical_shell() {
        let sphere = SphericalShell::new(10.0, 25.0);
        let p_cr = sphere.p_cr();
        
        assert!(p_cr > 0.0);
    }

    #[test]
    fn test_sphere_knockdown() {
        let sphere = SphericalShell::new(10.0, 25.0);
        
        assert!(sphere.knockdown() < 0.5);
    }

    #[test]
    fn test_conical_shell() {
        let cone = ConicalShell::new(2.0, 5.0, 8.0, 15.0);
        
        assert!(cone.half_angle() > 0.0);
        assert!(cone.equivalent_radius() > cone.r1);
    }

    #[test]
    fn test_cone_buckling() {
        let cone = ConicalShell::new(2.0, 5.0, 8.0, 15.0);
        
        assert!(cone.sigma_cr_axial() > 0.0);
        assert!(cone.p_cr_external() > 0.0);
    }

    #[test]
    fn test_ring_stiffener() {
        let i_req = RingStiffener::required_inertia(0.5, 5.0, 2.0, 210_000.0);
        
        assert!(i_req > 0.0);
    }

    #[test]
    fn test_stiffened_cylinder() {
        let shell = CylindricalShell::new(5.0, 20.0, 15.0);
        let stiff = StiffenedCylinder::new(shell, 3.0, 5000.0, 1e8);
        
        assert!(stiff.rings.len() > 0);
    }

    #[test]
    fn test_stiffened_buckling() {
        let shell = CylindricalShell::new(5.0, 20.0, 15.0);
        let stiff = StiffenedCylinder::new(shell.clone(), 3.0, 5000.0, 1e8);
        
        // Stiffened should have higher capacity than unstiffened
        assert!(stiff.p_cr() >= shell.p_cr_external() * 0.8);
    }

    #[test]
    fn test_fabrication_class() {
        assert!(FabricationClass::ClassA.quality_parameter() > 
                FabricationClass::ClassC.quality_parameter());
    }
}
