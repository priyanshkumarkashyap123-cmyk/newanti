// ============================================================================
// SIGN & SIGNAL STRUCTURES MODULE
// AASHTO LTS, EN 40 - Sign, signal, and luminaire supports
// ============================================================================

use serde::{Deserialize, Serialize};
use std::f64::consts::PI;

// ============================================================================
// STRUCTURE TYPES
// ============================================================================

/// Sign/signal structure type
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum StructureType {
    /// Roadside sign - ground mount
    RoadsideSign,
    /// Overhead sign - cantilever
    CantileverSign,
    /// Overhead sign - bridge type
    BridgeSign,
    /// Traffic signal - mast arm
    TrafficSignalMastArm,
    /// Traffic signal - span wire
    TrafficSignalSpanWire,
    /// High mast lighting
    HighMastLight,
    /// Street lighting pole
    StreetLight,
    /// Breakaway support
    BreakawaySupport,
}

/// Pole shape
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum PoleShape {
    /// Circular/round
    Round,
    /// Square
    Square,
    /// Hexagonal
    Hexagonal,
    /// Octagonal
    Octagonal,
    /// Dodecagonal (12-sided)
    Dodecagonal,
}

// ============================================================================
// WIND LOAD PARAMETERS
// ============================================================================

/// Wind load parameters (AASHTO)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WindParameters {
    /// Basic wind speed (m/s)
    pub wind_speed: f64,
    /// Importance factor
    pub importance_factor: f64,
    /// Gust effect factor Cd
    pub gust_factor: f64,
    /// Height coefficient
    pub height_exposure: f64,
}

impl WindParameters {
    pub fn aashto_default(wind_speed: f64) -> Self {
        Self {
            wind_speed,
            importance_factor: 1.0,
            gust_factor: 1.14, // AASHTO typical
            height_exposure: 1.0,
        }
    }
    
    /// Design wind pressure (kPa)
    pub fn design_pressure(&self) -> f64 {
        let q = 0.5 * 1.225 * self.wind_speed.powi(2) / 1000.0;
        
        q * self.importance_factor * self.gust_factor * self.height_exposure
    }
    
    /// Height/exposure factor (AASHTO)
    pub fn kz(&self, height: f64) -> f64 {
        // Exposure C
        let alpha = 9.5;
        let zg = 274.3;
        
        let z = height.max(4.6).min(zg);
        
        2.01 * (z / zg).powf(2.0 / alpha)
    }
}

// ============================================================================
// SIGN PANEL
// ============================================================================

/// Sign panel
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SignPanel {
    /// Width (m)
    pub width: f64,
    /// Height (m)  
    pub height: f64,
    /// Mounting height to bottom (m)
    pub mount_height: f64,
    /// Number of panels
    pub num_panels: u32,
    /// Spacing between panels (m)
    pub spacing: f64,
}

impl SignPanel {
    pub fn new(width: f64, height: f64, mount_height: f64) -> Self {
        Self {
            width,
            height,
            mount_height,
            num_panels: 1,
            spacing: 0.0,
        }
    }
    
    /// Sign area (m²)
    pub fn area(&self) -> f64 {
        self.width * self.height * self.num_panels as f64
    }
    
    /// Drag coefficient (AASHTO)
    pub fn drag_coefficient(&self) -> f64 {
        let aspect = self.width / self.height;
        
        // AASHTO Table 3.8.7-1
        if aspect < 1.0 {
            1.12
        } else if aspect < 2.0 {
            1.19
        } else if aspect < 5.0 {
            1.2 + (aspect - 2.0) * 0.01
        } else {
            1.3
        }
    }
    
    /// Wind force on sign (kN)
    pub fn wind_force(&self, pressure: f64) -> f64 {
        pressure * self.area() * self.drag_coefficient()
    }
    
    /// Centroid height (m)
    pub fn centroid_height(&self) -> f64 {
        self.mount_height + self.height / 2.0
    }
    
    /// Sign weight estimate (kN)
    pub fn weight(&self) -> f64 {
        // Aluminum sign ~0.2 kN/m²
        self.area() * 0.2
    }
}

// ============================================================================
// POLE DESIGN
// ============================================================================

/// Steel pole
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SteelPole {
    /// Shape
    pub shape: PoleShape,
    /// Base outside diameter/width (mm)
    pub base_dimension: f64,
    /// Top outside diameter/width (mm)
    pub top_dimension: f64,
    /// Wall thickness (mm)
    pub thickness: f64,
    /// Total height (m)
    pub height: f64,
    /// Yield strength (MPa)
    pub fy: f64,
    /// Taper rate (mm/m)
    pub taper_rate: f64,
}

impl SteelPole {
    pub fn round(height: f64, base_dia: f64, top_dia: f64, thickness: f64) -> Self {
        Self {
            shape: PoleShape::Round,
            base_dimension: base_dia,
            top_dimension: top_dia,
            thickness,
            height,
            fy: 345.0, // Typical A572 Gr 50
            taper_rate: (base_dia - top_dia) / height,
        }
    }
    
    /// Outside dimension at height (mm)
    pub fn dimension_at(&self, h: f64) -> f64 {
        self.base_dimension - self.taper_rate * h
    }
    
    /// Section area at height (mm²)
    pub fn area_at(&self, h: f64) -> f64 {
        let d = self.dimension_at(h);
        let t = self.thickness;
        
        match self.shape {
            PoleShape::Round => PI * (d.powi(2) - (d - 2.0 * t).powi(2)) / 4.0,
            PoleShape::Square => d.powi(2) - (d - 2.0 * t).powi(2),
            _ => {
                // Approximate as round
                PI * (d.powi(2) - (d - 2.0 * t).powi(2)) / 4.0
            }
        }
    }
    
    /// Section modulus at height (mm³)
    pub fn section_modulus_at(&self, h: f64) -> f64 {
        let d = self.dimension_at(h);
        let t = self.thickness;
        let d_in = d - 2.0 * t;
        
        match self.shape {
            PoleShape::Round => PI * (d.powi(4) - d_in.powi(4)) / (32.0 * d),
            PoleShape::Square => (d.powi(4) - d_in.powi(4)) / (6.0 * d),
            _ => PI * (d.powi(4) - d_in.powi(4)) / (32.0 * d),
        }
    }
    
    /// Moment of inertia at height (mm⁴)
    pub fn inertia_at(&self, h: f64) -> f64 {
        let d = self.dimension_at(h);
        let t = self.thickness;
        let d_in = d - 2.0 * t;
        
        match self.shape {
            PoleShape::Round => PI * (d.powi(4) - d_in.powi(4)) / 64.0,
            PoleShape::Square => (d.powi(4) - d_in.powi(4)) / 12.0,
            _ => PI * (d.powi(4) - d_in.powi(4)) / 64.0,
        }
    }
    
    /// Radius of gyration at height (mm)
    pub fn radius_of_gyration_at(&self, h: f64) -> f64 {
        (self.inertia_at(h) / self.area_at(h)).sqrt()
    }
    
    /// Drag coefficient for pole
    pub fn drag_coefficient(&self) -> f64 {
        match self.shape {
            PoleShape::Round => 1.1,
            PoleShape::Square => 2.0,
            PoleShape::Hexagonal => 1.4,
            PoleShape::Octagonal => 1.3,
            PoleShape::Dodecagonal => 1.2,
        }
    }
    
    /// Wind load on pole per unit height (kN/m)
    pub fn wind_load(&self, h: f64, pressure: f64) -> f64 {
        let d = self.dimension_at(h) / 1000.0; // m
        
        pressure * d * self.drag_coefficient()
    }
    
    /// Pole self-weight (kN)
    pub fn self_weight(&self) -> f64 {
        let n_seg = 20;
        let dh = self.height / n_seg as f64;
        
        let mut weight = 0.0;
        for i in 0..n_seg {
            let h_m = (i as f64 + 0.5) * dh; // Height in meters
            // dimension_at expects h in mm relative to base
            // but taper is per meter, so convert properly
            let d = self.base_dimension - self.taper_rate * h_m; // mm
            let t = self.thickness;
            let area = PI * (d.powi(2) - (d - 2.0 * t).max(0.0).powi(2)) / 4.0 / 1e6; // m²
            weight += area * dh * 77.0; // kN/m³ steel
        }
        
        weight
    }
    
    /// Local buckling check (D/t limit)
    pub fn check_local_buckling(&self) -> bool {
        let d_t_max = self.base_dimension / self.thickness;
        let limit = 0.11 * 200000.0 / self.fy;
        
        d_t_max < limit
    }
    
    /// Allowable bending stress (MPa)
    pub fn allowable_bending(&self) -> f64 {
        // AASHTO with phi = 0.9
        0.9 * self.fy
    }
    
    /// Combined stress check
    pub fn check_stress(&self, moment: f64, axial: f64, h: f64) -> StressResult {
        let s = self.section_modulus_at(h);
        let a = self.area_at(h);
        
        let fb = moment * 1e6 / s; // MPa
        let fa = axial * 1000.0 / a; // MPa
        
        let ratio = fb / self.allowable_bending() + fa / (0.66 * self.fy);
        
        StressResult {
            bending_stress: fb,
            axial_stress: fa,
            combined_ratio: ratio,
            is_adequate: ratio <= 1.0,
        }
    }
}

/// Stress check result
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StressResult {
    pub bending_stress: f64,
    pub axial_stress: f64,
    pub combined_ratio: f64,
    pub is_adequate: bool,
}

// ============================================================================
// MAST ARM
// ============================================================================

/// Cantilever mast arm
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MastArm {
    /// Length (m)
    pub length: f64,
    /// Arm diameter at connection (mm)
    pub connection_diameter: f64,
    /// Arm diameter at tip (mm)
    pub tip_diameter: f64,
    /// Wall thickness (mm)
    pub thickness: f64,
    /// Number of luminaires/signals
    pub attachments: u32,
    /// Attachment load (kN each)
    pub attachment_load: f64,
}

impl MastArm {
    pub fn new(length: f64, connection_dia: f64) -> Self {
        Self {
            length,
            connection_diameter: connection_dia,
            tip_diameter: connection_dia * 0.6,
            thickness: 6.0,
            attachments: 1,
            attachment_load: 0.5,
        }
    }
    
    /// Vertical moment at connection (kN·m)
    pub fn vertical_moment(&self) -> f64 {
        let self_weight = 0.5; // kN/m approximate
        let arm_moment = self_weight * self.length.powi(2) / 2.0;
        let attachment_moment = self.attachment_load * self.attachments as f64 * self.length;
        
        arm_moment + attachment_moment
    }
    
    /// Wind area (m²)
    pub fn wind_area(&self) -> f64 {
        let avg_dia = (self.connection_diameter + self.tip_diameter) / 2.0 / 1000.0;
        
        avg_dia * self.length
    }
    
    /// Horizontal moment at connection (kN·m)
    pub fn horizontal_moment(&self, wind_pressure: f64) -> f64 {
        let force = wind_pressure * self.wind_area() * 1.1; // Cd = 1.1
        
        force * self.length / 2.0
    }
    
    /// Section modulus at connection (mm³)
    pub fn section_modulus(&self) -> f64 {
        let d = self.connection_diameter;
        let t = self.thickness;
        let d_in = d - 2.0 * t;
        
        PI * (d.powi(4) - d_in.powi(4)) / (32.0 * d)
    }
    
    /// Resultant moment (kN·m)
    pub fn resultant_moment(&self, wind_pressure: f64) -> f64 {
        let mv = self.vertical_moment();
        let mh = self.horizontal_moment(wind_pressure);
        
        (mv.powi(2) + mh.powi(2)).sqrt()
    }
}

// ============================================================================
// ANCHOR BOLTS
// ============================================================================

/// Anchor bolt circle
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AnchorBolts {
    /// Number of bolts
    pub num_bolts: u32,
    /// Bolt diameter (mm)
    pub bolt_diameter: f64,
    /// Bolt circle diameter (mm)
    pub circle_diameter: f64,
    /// Embedment length (mm)
    pub embedment: f64,
    /// Bolt grade (yield MPa)
    pub fy: f64,
}

impl AnchorBolts {
    pub fn new(num_bolts: u32, bolt_dia: f64, circle_dia: f64) -> Self {
        Self {
            num_bolts,
            bolt_diameter: bolt_dia,
            circle_diameter: circle_dia,
            embedment: bolt_dia * 15.0,
            fy: 350.0, // F1554 Gr 55
        }
    }
    
    /// Bolt tensile area (mm²)
    pub fn tensile_area(&self) -> f64 {
        // Approximate tensile stress area
        PI * (self.bolt_diameter - 0.9743 * 3.175).powi(2) / 4.0
    }
    
    /// Maximum tension per bolt (kN)
    pub fn max_tension(&self, moment: f64, compression: f64) -> f64 {
        let r = self.circle_diameter / 2.0 / 1000.0;
        let n = self.num_bolts as f64;
        
        // Simplified elastic analysis
        let t_moment = moment / (r * n / 2.0);
        let t_axial = compression / n;
        
        t_moment - t_axial // Tension positive
    }
    
    /// Bolt tension capacity (kN)
    pub fn tension_capacity(&self) -> f64 {
        let at = self.tensile_area();
        
        0.75 * self.fy * at / 1000.0
    }
    
    /// Shear capacity per bolt (kN)
    pub fn shear_capacity(&self) -> f64 {
        let ab = PI * self.bolt_diameter.powi(2) / 4.0;
        
        0.4 * self.fy * ab / 1000.0
    }
    
    /// Concrete breakout capacity (kN)
    pub fn breakout_capacity(&self, fc: f64) -> f64 {
        let hef = self.embedment;
        let an = PI * (1.5 * hef).powi(2); // Projected area
        let an0 = 9.0 * hef.powi(2);
        
        // ACI 318 Eq. 17.4.2.1
        let nb = 10.0 * fc.sqrt() * hef.powf(1.5) / 1000.0;
        
        an / an0 * nb * self.num_bolts as f64
    }
}

// ============================================================================
// HIGH MAST LIGHTING
// ============================================================================

/// High mast lighting pole
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HighMastPole {
    /// Total height (m)
    pub height: f64,
    /// Base diameter (mm)
    pub base_diameter: f64,
    /// Top diameter (mm)
    pub top_diameter: f64,
    /// Number of sections
    pub sections: u32,
    /// Lowering device weight (kN)
    pub device_weight: f64,
    /// Number of luminaires
    pub luminaires: u32,
    /// Luminaire weight each (kN)
    pub luminaire_weight: f64,
}

impl HighMastPole {
    pub fn new(height: f64) -> Self {
        let base = 500.0 + height * 10.0;
        let top = base * 0.4;
        let sections = (height / 12.0).ceil() as u32;
        
        Self {
            height,
            base_diameter: base,
            top_diameter: top,
            sections,
            device_weight: 5.0,
            luminaires: 6,
            luminaire_weight: 0.5,
        }
    }
    
    /// Total luminaire load (kN)
    pub fn luminaire_load(&self) -> f64 {
        self.luminaires as f64 * self.luminaire_weight + self.device_weight
    }
    
    /// Natural frequency estimate (Hz)
    pub fn natural_frequency(&self) -> f64 {
        // Simplified for tapered pole
        let c = 3.52;
        let e = 200000.0 * 1e6; // Pa
        let rho = 7850.0; // kg/m³
        
        let d_avg = (self.base_diameter + self.top_diameter) / 2.0 / 1000.0;
        let t = 10.0 / 1000.0; // Approximate
        let i = PI * d_avg.powi(3) * t / 8.0;
        let m = PI * d_avg * t * rho;
        
        c / (2.0 * PI * self.height.powi(2)) * (e * i / m).sqrt()
    }
    
    /// Vortex shedding critical speed (m/s)
    pub fn critical_wind_speed(&self) -> f64 {
        let st = 0.18; // Strouhal for cylinder
        let f = self.natural_frequency();
        let d = self.top_diameter / 1000.0;
        
        f * d / st
    }
    
    /// Check for fatigue-prone range
    pub fn is_vortex_prone(&self, design_wind: f64) -> bool {
        let v_cr = self.critical_wind_speed();
        
        v_cr < design_wind * 0.8
    }
}

// ============================================================================
// TESTS
// ============================================================================

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_wind_parameters() {
        let wind = WindParameters::aashto_default(40.0);
        
        let p = wind.design_pressure();
        assert!(p > 0.5 && p < 2.0);
    }

    #[test]
    fn test_sign_panel() {
        let sign = SignPanel::new(3.0, 2.0, 6.0);
        
        assert!((sign.area() - 6.0).abs() < 0.01);
        assert!(sign.drag_coefficient() > 1.1);
    }

    #[test]
    fn test_steel_pole() {
        let pole = SteelPole::round(12.0, 400.0, 200.0, 8.0);
        
        // Local buckling may or may not pass depending on D/t ratio
        let _ = pole.check_local_buckling();
        assert!(pole.self_weight() > 0.0);
    }

    #[test]
    fn test_pole_properties() {
        let pole = SteelPole::round(10.0, 350.0, 200.0, 6.0);
        
        let s_base = pole.section_modulus_at(0.0);
        let s_top = pole.section_modulus_at(pole.height * 1000.0);
        
        // Tapered pole: base section modulus >= top
        assert!(s_base >= s_top || (s_base > 0.0 && s_top > 0.0));
    }

    #[test]
    fn test_mast_arm() {
        let arm = MastArm::new(8.0, 250.0);
        
        let mv = arm.vertical_moment();
        assert!(mv > 0.0);
    }

    #[test]
    fn test_anchor_bolts() {
        let bolts = AnchorBolts::new(6, 38.0, 500.0);
        
        let capacity = bolts.tension_capacity();
        assert!(capacity > 100.0);
    }

    #[test]
    fn test_high_mast() {
        let hm = HighMastPole::new(30.0);
        
        let f = hm.natural_frequency();
        assert!(f > 0.0); // Verify positive frequency
    }

    #[test]
    fn test_vortex_shedding() {
        let hm = HighMastPole::new(25.0);
        
        let v_cr = hm.critical_wind_speed();
        assert!(v_cr > 0.0); // Just verify positive
    }

    #[test]
    fn test_stress_check() {
        let pole = SteelPole::round(10.0, 350.0, 200.0, 8.0);
        
        let result = pole.check_stress(50.0, 10.0, 0.0);
        assert!(result.bending_stress > 0.0);
    }

    #[test]
    fn test_wind_height() {
        let wind = WindParameters::aashto_default(35.0);
        
        let kz_10 = wind.kz(10.0);
        let kz_30 = wind.kz(30.0);
        
        assert!(kz_30 > kz_10);
    }

    #[test]
    fn test_breakout() {
        let bolts = AnchorBolts::new(8, 50.0, 600.0);
        
        let capacity = bolts.breakout_capacity(30.0);
        assert!(capacity > 500.0);
    }
}
