// ============================================================================
// PRESSURE VESSEL MODULE
// ASME BPVC Section VIII, EN 13445 design
// ============================================================================

use serde::{Deserialize, Serialize};
use std::f64::consts::PI;

// ============================================================================
// MATERIAL PROPERTIES
// ============================================================================

/// Vessel material type
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum VesselMaterial {
    /// Carbon steel SA-516 Gr 70
    SA516Gr70,
    /// Stainless steel SA-240 304
    SA240_304,
    /// Stainless steel SA-240 316
    SA240_316,
    /// Low alloy SA-387 Gr 11
    SA387Gr11,
    /// Duplex stainless
    Duplex,
}

impl VesselMaterial {
    /// Allowable stress at ambient (MPa)
    pub fn allowable_stress(&self, temperature: f64) -> f64 {
        let base = match self {
            VesselMaterial::SA516Gr70 => 138.0,
            VesselMaterial::SA240_304 => 115.0,
            VesselMaterial::SA240_316 => 115.0,
            VesselMaterial::SA387Gr11 => 118.0,
            VesselMaterial::Duplex => 172.0,
        };
        
        // Temperature derating (simplified)
        if temperature <= 150.0 {
            base
        } else if temperature <= 300.0 {
            base * (1.0 - (temperature - 150.0) * 0.001)
        } else if temperature <= 450.0 {
            base * (0.85 - (temperature - 300.0) * 0.0015)
        } else {
            base * 0.6
        }
    }
    
    /// Yield strength (MPa)
    pub fn yield_strength(&self) -> f64 {
        match self {
            VesselMaterial::SA516Gr70 => 260.0,
            VesselMaterial::SA240_304 => 205.0,
            VesselMaterial::SA240_316 => 205.0,
            VesselMaterial::SA387Gr11 => 310.0,
            VesselMaterial::Duplex => 450.0,
        }
    }
    
    /// Tensile strength (MPa)
    pub fn tensile_strength(&self) -> f64 {
        match self {
            VesselMaterial::SA516Gr70 => 485.0,
            VesselMaterial::SA240_304 => 515.0,
            VesselMaterial::SA240_316 => 515.0,
            VesselMaterial::SA387Gr11 => 515.0,
            VesselMaterial::Duplex => 620.0,
        }
    }
    
    /// Elastic modulus (MPa)
    pub fn modulus(&self) -> f64 {
        match self {
            VesselMaterial::SA516Gr70 => 200000.0,
            VesselMaterial::SA240_304 => 193000.0,
            VesselMaterial::SA240_316 => 193000.0,
            VesselMaterial::SA387Gr11 => 200000.0,
            VesselMaterial::Duplex => 200000.0,
        }
    }
}

// ============================================================================
// CYLINDRICAL SHELL
// ============================================================================

/// Cylindrical shell under internal pressure
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CylindricalShell {
    /// Inside diameter (mm)
    pub inside_diameter: f64,
    /// Design pressure (MPa)
    pub design_pressure: f64,
    /// Design temperature (°C)
    pub design_temperature: f64,
    /// Material
    pub material: VesselMaterial,
    /// Corrosion allowance (mm)
    pub corrosion_allowance: f64,
    /// Joint efficiency
    pub joint_efficiency: f64,
}

impl CylindricalShell {
    pub fn new(id: f64, pressure: f64, temperature: f64, material: VesselMaterial) -> Self {
        Self {
            inside_diameter: id,
            design_pressure: pressure,
            design_temperature: temperature,
            material,
            corrosion_allowance: 3.0,
            joint_efficiency: 1.0, // Full radiography
        }
    }
    
    /// Allowable stress (MPa)
    pub fn allowable_stress(&self) -> f64 {
        self.material.allowable_stress(self.design_temperature)
    }
    
    /// Required thickness - circumferential stress (mm)
    pub fn thickness_circumferential(&self) -> f64 {
        let p = self.design_pressure;
        let r = self.inside_diameter / 2.0;
        let s = self.allowable_stress();
        let e = self.joint_efficiency;
        
        // ASME UG-27(c)(1)
        p * r / (s * e - 0.6 * p) + self.corrosion_allowance
    }
    
    /// Required thickness - longitudinal stress (mm)
    pub fn thickness_longitudinal(&self) -> f64 {
        let p = self.design_pressure;
        let r = self.inside_diameter / 2.0;
        let s = self.allowable_stress();
        let e = self.joint_efficiency;
        
        // ASME UG-27(c)(2)
        p * r / (2.0 * s * e + 0.4 * p) + self.corrosion_allowance
    }
    
    /// Required thickness - governing (mm)
    pub fn required_thickness(&self) -> f64 {
        self.thickness_circumferential().max(self.thickness_longitudinal())
    }
    
    /// MAWP for given thickness (MPa)
    pub fn mawp(&self, thickness: f64) -> f64 {
        let t = thickness - self.corrosion_allowance;
        let r = self.inside_diameter / 2.0;
        let s = self.allowable_stress();
        let e = self.joint_efficiency;
        
        // From circumferential formula
        s * e * t / (r + 0.6 * t)
    }
    
    /// Hydrotest pressure (MPa)
    pub fn hydrotest_pressure(&self) -> f64 {
        // ASME UG-99
        1.3 * self.design_pressure * self.allowable_stress() / 
            self.material.allowable_stress(21.0) // Ambient test
    }
    
    /// Hoop stress (MPa)
    pub fn hoop_stress(&self, thickness: f64) -> f64 {
        let p = self.design_pressure;
        let r = self.inside_diameter / 2.0;
        let t = thickness - self.corrosion_allowance;
        
        p * r / t
    }
    
    /// Longitudinal stress (MPa)
    pub fn longitudinal_stress(&self, thickness: f64) -> f64 {
        let p = self.design_pressure;
        let r = self.inside_diameter / 2.0;
        let t = thickness - self.corrosion_allowance;
        
        p * r / (2.0 * t)
    }
}

// ============================================================================
// HEADS (END CLOSURES)
// ============================================================================

/// Head type
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum HeadType {
    /// Hemispherical
    Hemispherical,
    /// 2:1 Ellipsoidal
    Ellipsoidal,
    /// Torispherical (ASME F&D)
    Torispherical,
    /// Flat
    Flat,
    /// Conical
    Conical,
}

/// Pressure vessel head
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VesselHead {
    /// Head type
    pub head_type: HeadType,
    /// Inside diameter (mm)
    pub diameter: f64,
    /// Design pressure (MPa)
    pub design_pressure: f64,
    /// Design temperature (°C)
    pub design_temperature: f64,
    /// Material
    pub material: VesselMaterial,
    /// Corrosion allowance (mm)
    pub corrosion_allowance: f64,
    /// Joint efficiency
    pub joint_efficiency: f64,
    /// Cone half angle (degrees) - for conical
    pub cone_angle: f64,
}

impl VesselHead {
    pub fn new(head_type: HeadType, diameter: f64, pressure: f64, 
               temperature: f64, material: VesselMaterial) -> Self {
        Self {
            head_type,
            diameter,
            design_pressure: pressure,
            design_temperature: temperature,
            material,
            corrosion_allowance: 3.0,
            joint_efficiency: 1.0,
            cone_angle: 30.0,
        }
    }
    
    /// Allowable stress (MPa)
    pub fn allowable_stress(&self) -> f64 {
        self.material.allowable_stress(self.design_temperature)
    }
    
    /// Required thickness (mm)
    pub fn required_thickness(&self) -> f64 {
        let p = self.design_pressure;
        let d = self.diameter;
        let s = self.allowable_stress();
        let e = self.joint_efficiency;
        let ca = self.corrosion_allowance;
        
        match self.head_type {
            HeadType::Hemispherical => {
                // ASME UG-32(f)
                p * d / (4.0 * s * e - 0.4 * p) + ca
            },
            HeadType::Ellipsoidal => {
                // ASME UG-32(d) - 2:1 ellipsoidal, K = 1.0
                p * d / (2.0 * s * e - 0.2 * p) + ca
            },
            HeadType::Torispherical => {
                // ASME UG-32(e) - F&D with L = D, r = 0.06D
                let l = d; // Crown radius
                let m = 0.25 * (3.0 + (l / (0.06 * d)).sqrt());
                p * l * m / (2.0 * s * e - 0.2 * p) + ca
            },
            HeadType::Flat => {
                // ASME UG-34
                let c = 0.33; // Typical for bolted
                d * (c * p / (s * e)).sqrt() + ca
            },
            HeadType::Conical => {
                // ASME UG-32(g)
                let alpha = self.cone_angle.to_radians();
                p * d / (2.0 * alpha.cos() * (s * e - 0.6 * p)) + ca
            },
        }
    }
    
    /// Dish depth (mm)
    pub fn dish_depth(&self) -> f64 {
        let d = self.diameter;
        
        match self.head_type {
            HeadType::Hemispherical => d / 2.0,
            HeadType::Ellipsoidal => d / 4.0, // 2:1
            HeadType::Torispherical => {
                // Approximate
                let l = d;
                let r = 0.06 * d;
                l - (l.powi(2) - (d / 2.0 - r).powi(2)).sqrt()
            },
            HeadType::Flat => 0.0,
            HeadType::Conical => {
                let alpha = self.cone_angle.to_radians();
                (d / 2.0) * alpha.tan()
            },
        }
    }
    
    /// Surface area (m²)
    pub fn surface_area(&self) -> f64 {
        let d = self.diameter / 1000.0;
        
        match self.head_type {
            HeadType::Hemispherical => PI * d.powi(2) / 2.0,
            HeadType::Ellipsoidal => 1.084 * d.powi(2),
            HeadType::Torispherical => 0.9 * d.powi(2),
            HeadType::Flat => PI * d.powi(2) / 4.0,
            HeadType::Conical => {
                let alpha = self.cone_angle.to_radians();
                PI * (d / 2.0).powi(2) / alpha.cos()
            },
        }
    }
    
    /// Volume (m³)
    pub fn volume(&self) -> f64 {
        let d = self.diameter / 1000.0;
        
        match self.head_type {
            HeadType::Hemispherical => PI * d.powi(3) / 12.0,
            HeadType::Ellipsoidal => PI * d.powi(3) / 24.0,
            HeadType::Torispherical => 0.0847 * d.powi(3),
            HeadType::Flat => 0.0,
            HeadType::Conical => {
                let h = self.dish_depth() / 1000.0;
                PI * (d / 2.0).powi(2) * h / 3.0
            },
        }
    }
}

// ============================================================================
// NOZZLE REINFORCEMENT
// ============================================================================

/// Nozzle in pressure vessel
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Nozzle {
    /// Nozzle inside diameter (mm)
    pub diameter: f64,
    /// Nozzle thickness (mm)
    pub thickness: f64,
    /// Shell thickness (mm)
    pub shell_thickness: f64,
    /// Shell inside diameter (mm)
    pub shell_diameter: f64,
    /// Design pressure (MPa)
    pub design_pressure: f64,
    /// Material
    pub material: VesselMaterial,
    /// Corrosion allowance (mm)
    pub corrosion_allowance: f64,
    /// Is set-in type
    pub is_set_in: bool,
}

impl Nozzle {
    pub fn new(nozzle_dia: f64, shell_dia: f64, shell_thick: f64, 
               pressure: f64, material: VesselMaterial) -> Self {
        Self {
            diameter: nozzle_dia,
            thickness: 0.0, // To be calculated
            shell_thickness: shell_thick,
            shell_diameter: shell_dia,
            design_pressure: pressure,
            material,
            corrosion_allowance: 3.0,
            is_set_in: false,
        }
    }
    
    /// Required nozzle wall thickness (mm)
    pub fn required_nozzle_thickness(&self) -> f64 {
        let p = self.design_pressure;
        let r = self.diameter / 2.0;
        let s = self.material.allowable_stress(200.0);
        
        p * r / (s - 0.6 * p) + self.corrosion_allowance
    }
    
    /// Area removed by opening (mm²)
    pub fn area_removed(&self) -> f64 {
        let d = self.diameter + 2.0 * self.corrosion_allowance;
        let tr = self.shell_required_thickness();
        
        d * tr
    }
    
    /// Shell required thickness (mm)
    fn shell_required_thickness(&self) -> f64 {
        let p = self.design_pressure;
        let r = self.shell_diameter / 2.0;
        let s = self.material.allowable_stress(200.0);
        
        p * r / (s - 0.6 * p)
    }
    
    /// Area available in shell (mm²)
    pub fn area_in_shell(&self) -> f64 {
        let d = self.diameter + 2.0 * self.corrosion_allowance;
        let t = self.shell_thickness - self.corrosion_allowance;
        let tr = self.shell_required_thickness();
        
        // Limit of reinforcement
        let limit = d.min(2.0 * (t * self.shell_diameter).sqrt());
        
        (t - tr) * limit
    }
    
    /// Area available in nozzle wall (mm²)
    pub fn area_in_nozzle(&self) -> f64 {
        let t_nozzle = self.thickness - self.corrosion_allowance;
        let t_req = self.required_nozzle_thickness() - self.corrosion_allowance;
        let _d = self.diameter;
        let _t_shell = self.shell_thickness;
        
        // Height of nozzle for reinforcement
        let h = 2.5 * t_nozzle;
        
        2.0 * h * (t_nozzle - t_req)
    }
    
    /// Total available area (mm²)
    pub fn total_available(&self) -> f64 {
        self.area_in_shell() + self.area_in_nozzle()
    }
    
    /// Required reinforcement pad (mm²)
    pub fn required_pad(&self) -> f64 {
        let removed = self.area_removed();
        let available = self.total_available();
        
        (removed - available).max(0.0)
    }
    
    /// Pad thickness for given width (mm)
    pub fn pad_thickness(&self, pad_width: f64) -> f64 {
        let area = self.required_pad();
        
        if area > 0.0 {
            area / (2.0 * pad_width)
        } else {
            0.0
        }
    }
}

// ============================================================================
// EXTERNAL PRESSURE
// ============================================================================

/// Vessel under external pressure
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExternalPressure {
    /// Outside diameter (mm)
    pub outside_diameter: f64,
    /// Thickness (mm)
    pub thickness: f64,
    /// Length between stiffeners (mm)
    pub length: f64,
    /// External pressure (MPa)
    pub pressure: f64,
    /// Material
    pub material: VesselMaterial,
}

impl ExternalPressure {
    pub fn new(od: f64, thickness: f64, length: f64, 
               pressure: f64, material: VesselMaterial) -> Self {
        Self {
            outside_diameter: od,
            thickness,
            length,
            pressure,
            material,
        }
    }
    
    /// D/t ratio
    pub fn d_over_t(&self) -> f64 {
        self.outside_diameter / self.thickness
    }
    
    /// L/D ratio
    pub fn l_over_d(&self) -> f64 {
        self.length / self.outside_diameter
    }
    
    /// Factor A from ASME (simplified)
    pub fn factor_a(&self) -> f64 {
        let l_d = self.l_over_d();
        let d_t = self.d_over_t();
        
        // Simplified approximation
        0.125 / ((l_d / 0.5).powi(2) + d_t / 100.0)
    }
    
    /// Factor B from material chart (simplified)
    pub fn factor_b(&self) -> f64 {
        let a = self.factor_a();
        let e = self.material.modulus();
        
        // Elastic region approximation
        a * e / 2.0
    }
    
    /// Maximum allowable external pressure (MPa)
    pub fn maep(&self) -> f64 {
        let b = self.factor_b();
        let d_t = self.d_over_t();
        
        4.0 * b / (3.0 * d_t)
    }
    
    /// Check adequacy
    pub fn is_adequate(&self) -> bool {
        self.pressure <= self.maep()
    }
    
    /// Required stiffener moment of inertia (mm⁴)
    pub fn stiffener_inertia(&self) -> f64 {
        let d = self.outside_diameter;
        let t = self.thickness;
        let l = self.length;
        let p = self.pressure;
        let e = self.material.modulus();
        
        // ASME UG-29
        let a_s = l * t; // Contributing shell area
        
        p * d.powi(2) * l * (t + a_s / l) / (10.9 * e)
    }
}

// ============================================================================
// TESTS
// ============================================================================

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_material_allowable() {
        let sa516 = VesselMaterial::SA516Gr70;
        
        let s_20 = sa516.allowable_stress(20.0);
        let s_300 = sa516.allowable_stress(300.0);
        
        assert!(s_20 > s_300);
        assert!(s_20 > 130.0);
    }

    #[test]
    fn test_cylindrical_shell() {
        let shell = CylindricalShell::new(
            2000.0, 2.0, 200.0, VesselMaterial::SA516Gr70
        );
        
        let t = shell.required_thickness();
        assert!(t > 10.0 && t < 50.0);
    }

    #[test]
    fn test_shell_mawp() {
        let shell = CylindricalShell::new(
            1500.0, 1.5, 150.0, VesselMaterial::SA240_304
        );
        
        let t_req = shell.required_thickness();
        let t_actual = t_req + 5.0;
        
        let mawp = shell.mawp(t_actual);
        assert!(mawp > shell.design_pressure);
    }

    #[test]
    fn test_hemispherical_head() {
        let head = VesselHead::new(
            HeadType::Hemispherical, 2000.0, 2.0, 200.0, 
            VesselMaterial::SA516Gr70
        );
        
        let t = head.required_thickness();
        assert!(t > 5.0);
    }

    #[test]
    fn test_head_comparison() {
        let hemi = VesselHead::new(
            HeadType::Hemispherical, 2000.0, 3.0, 200.0,
            VesselMaterial::SA516Gr70
        );
        let ellip = VesselHead::new(
            HeadType::Ellipsoidal, 2000.0, 3.0, 200.0,
            VesselMaterial::SA516Gr70
        );
        let tori = VesselHead::new(
            HeadType::Torispherical, 2000.0, 3.0, 200.0,
            VesselMaterial::SA516Gr70
        );
        
        // Hemispherical thinnest, torispherical thickest
        assert!(hemi.required_thickness() < ellip.required_thickness());
        assert!(ellip.required_thickness() < tori.required_thickness());
    }

    #[test]
    fn test_head_volume() {
        let hemi = VesselHead::new(
            HeadType::Hemispherical, 2000.0, 2.0, 200.0,
            VesselMaterial::SA516Gr70
        );
        let ellip = VesselHead::new(
            HeadType::Ellipsoidal, 2000.0, 2.0, 200.0,
            VesselMaterial::SA516Gr70
        );
        
        assert!(hemi.volume() > ellip.volume());
    }

    #[test]
    fn test_nozzle_reinforcement() {
        let nozzle = Nozzle::new(
            200.0, 2000.0, 25.0, 2.0, VesselMaterial::SA516Gr70
        );
        
        let removed = nozzle.area_removed();
        assert!(removed > 0.0);
    }

    #[test]
    fn test_external_pressure() {
        let ext = ExternalPressure::new(
            2000.0, 20.0, 3000.0, 0.1, VesselMaterial::SA516Gr70
        );
        
        let maep = ext.maep();
        assert!(maep > 0.0);
    }

    #[test]
    fn test_hydrotest() {
        let shell = CylindricalShell::new(
            1000.0, 1.0, 100.0, VesselMaterial::SA240_316
        );
        
        let hydro = shell.hydrotest_pressure();
        assert!(hydro > shell.design_pressure);
    }

    #[test]
    fn test_stresses() {
        let shell = CylindricalShell::new(
            2000.0, 2.0, 200.0, VesselMaterial::SA516Gr70
        );
        let t = 25.0;
        
        let hoop = shell.hoop_stress(t);
        let long = shell.longitudinal_stress(t);
        
        // Hoop should be ~2x longitudinal
        assert!((hoop / long - 2.0).abs() < 0.5);
    }
}
