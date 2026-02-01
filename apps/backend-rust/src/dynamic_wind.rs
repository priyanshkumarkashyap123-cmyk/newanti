// ============================================================================
// DYNAMIC WIND EFFECTS MODULE
// Vortex shedding, galloping, flutter, buffeting - EN 1991-1-4, ASCE 7
// ============================================================================

use serde::{Deserialize, Serialize};
use std::f64::consts::PI;

// ============================================================================
// VORTEX SHEDDING
// ============================================================================

/// Cross-section shape for vortex shedding
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum CrossSectionShape {
    /// Circular cylinder
    Circular,
    /// Square section
    Square,
    /// Rectangular (D/B < 2)
    RectangularShort,
    /// Rectangular (D/B >= 2)
    RectangularLong,
    /// H-section (I-beam)
    HSection,
    /// Hexagonal
    Hexagonal,
}

impl CrossSectionShape {
    /// Strouhal number (St)
    pub fn strouhal_number(&self) -> f64 {
        match self {
            CrossSectionShape::Circular => 0.18,
            CrossSectionShape::Square => 0.12,
            CrossSectionShape::RectangularShort => 0.11,
            CrossSectionShape::RectangularLong => 0.08,
            CrossSectionShape::HSection => 0.14,
            CrossSectionShape::Hexagonal => 0.15,
        }
    }
    
    /// Lift coefficient amplitude (CL)
    pub fn lift_coefficient(&self) -> f64 {
        match self {
            CrossSectionShape::Circular => 0.3,
            CrossSectionShape::Square => 1.0,
            CrossSectionShape::RectangularShort => 0.8,
            CrossSectionShape::RectangularLong => 0.5,
            CrossSectionShape::HSection => 0.6,
            CrossSectionShape::Hexagonal => 0.4,
        }
    }
    
    /// Scruton number threshold for lock-in prevention
    pub fn scruton_threshold(&self) -> f64 {
        match self {
            CrossSectionShape::Circular => 4.0,
            CrossSectionShape::Square => 15.0,
            _ => 10.0,
        }
    }
}

/// Vortex shedding analysis
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VortexShedding {
    /// Cross-section shape
    pub shape: CrossSectionShape,
    /// Characteristic dimension D (m) - perpendicular to flow
    pub diameter: f64,
    /// Structure length/height (m)
    pub length: f64,
    /// Natural frequency (Hz)
    pub natural_frequency: f64,
    /// Structural damping ratio
    pub damping_ratio: f64,
    /// Mass per unit length (kg/m)
    pub mass_per_length: f64,
    /// Air density (kg/m³)
    pub air_density: f64,
}

impl VortexShedding {
    pub fn new(shape: CrossSectionShape, diameter: f64, natural_freq: f64) -> Self {
        Self {
            shape,
            diameter,
            length: 50.0,
            natural_frequency: natural_freq,
            damping_ratio: 0.01,
            mass_per_length: 1000.0,
            air_density: 1.25,
        }
    }
    
    /// Critical wind velocity for vortex shedding (m/s)
    pub fn critical_velocity(&self) -> f64 {
        self.natural_frequency * self.diameter / self.shape.strouhal_number()
    }
    
    /// Vortex shedding frequency at given wind speed (Hz)
    pub fn shedding_frequency(&self, wind_speed: f64) -> f64 {
        self.shape.strouhal_number() * wind_speed / self.diameter
    }
    
    /// Scruton number (mass-damping parameter)
    pub fn scruton_number(&self) -> f64 {
        2.0 * self.damping_ratio * self.mass_per_length / 
            (self.air_density * self.diameter.powi(2))
    }
    
    /// Is lock-in likely?
    pub fn lock_in_susceptible(&self) -> bool {
        self.scruton_number() < self.shape.scruton_threshold()
    }
    
    /// Reynolds number at critical velocity
    pub fn reynolds_number(&self) -> f64 {
        let v = self.critical_velocity();
        let nu = 1.5e-5; // Kinematic viscosity of air
        
        v * self.diameter / nu
    }
    
    /// Maximum cross-wind amplitude (m) - EN 1991-1-4 method
    pub fn max_amplitude(&self) -> f64 {
        if !self.lock_in_susceptible() {
            // Above Scruton threshold - limited amplitude
            0.0
        } else {
            // Below threshold - significant amplitude
            let sc = self.scruton_number();
            let ka = 0.5; // Amplitude factor
            let cl = self.shape.lift_coefficient();
            
            // y_max = (CL * D / (4π * St² * Sc)) for circular
            cl * self.diameter / (4.0 * PI * self.shape.strouhal_number().powi(2) * sc.max(0.5))
                * ka
        }
    }
    
    /// Peak cross-wind force per unit length (kN/m)
    pub fn peak_force_per_length(&self) -> f64 {
        let v_cr = self.critical_velocity();
        let q = 0.5 * self.air_density * v_cr.powi(2);
        let cl = self.shape.lift_coefficient();
        
        cl * q * self.diameter / 1000.0
    }
    
    /// Lateral bending stress amplitude (MPa)
    pub fn stress_amplitude(&self, section_modulus: f64) -> f64 {
        let y = self.max_amplitude();
        let omega = 2.0 * PI * self.natural_frequency;
        
        // Inertia force = m * y * ω²
        let f = self.mass_per_length * y * omega.powi(2);
        
        // Cantilever moment at base
        let m = f * self.length.powi(2) / 2.0;
        
        m / section_modulus
    }
}

// ============================================================================
// GALLOPING
// ============================================================================

/// Galloping susceptibility
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Galloping {
    /// Cross-section shape
    pub shape: CrossSectionShape,
    /// Width (m) - dimension parallel to wind
    pub width: f64,
    /// Depth (m) - dimension perpendicular to wind
    pub depth: f64,
    /// Natural frequency (Hz)
    pub natural_frequency: f64,
    /// Structural damping ratio
    pub damping_ratio: f64,
    /// Mass per unit length (kg/m)
    pub mass_per_length: f64,
}

impl Galloping {
    pub fn new(width: f64, depth: f64, natural_freq: f64) -> Self {
        Self {
            shape: CrossSectionShape::Square,
            width,
            depth,
            natural_frequency: natural_freq,
            damping_ratio: 0.01,
            mass_per_length: 500.0,
        }
    }
    
    /// Aspect ratio D/B
    pub fn aspect_ratio(&self) -> f64 {
        self.depth / self.width
    }
    
    /// Den Hartog galloping criterion coefficient
    pub fn galloping_coefficient(&self) -> f64 {
        // Approximate dCL/dα + CD for rectangular sections
        let ar = self.aspect_ratio();
        
        if ar < 0.5 {
            2.0 // Stable
        } else if ar < 1.0 {
            0.0 // Neutral
        } else if ar < 2.0 {
            -1.5 // Unstable
        } else if ar < 3.0 {
            -2.5 // Very unstable
        } else {
            -1.0 // Moderately unstable
        }
    }
    
    /// Is galloping possible?
    pub fn is_galloping_prone(&self) -> bool {
        self.galloping_coefficient() < 0.0
    }
    
    /// Onset wind velocity for galloping (m/s)
    pub fn onset_velocity(&self) -> f64 {
        if !self.is_galloping_prone() {
            return f64::INFINITY;
        }
        
        let rho = 1.25; // Air density
        let ag = self.galloping_coefficient().abs();
        
        2.0 * self.mass_per_length * self.damping_ratio * 2.0 * PI * self.natural_frequency /
            (rho * self.depth * ag)
    }
    
    /// Scruton number for galloping
    pub fn scruton_galloping(&self) -> f64 {
        let rho = 1.25;
        
        2.0 * self.damping_ratio * self.mass_per_length / (rho * self.depth.powi(2))
    }
    
    /// Minimum Scruton number to prevent galloping
    pub fn min_scruton_required(&self) -> f64 {
        if !self.is_galloping_prone() {
            return 0.0;
        }
        
        // Sc_min = |a_g| / 4 approximately
        self.galloping_coefficient().abs() / 4.0
    }
    
    /// Required damping to prevent galloping
    pub fn required_damping(&self, design_velocity: f64) -> f64 {
        if !self.is_galloping_prone() {
            return 0.0;
        }
        
        let rho = 1.25;
        let ag = self.galloping_coefficient().abs();
        
        rho * self.depth * ag * design_velocity / 
            (4.0 * PI * self.natural_frequency * self.mass_per_length)
    }
}

// ============================================================================
// FLUTTER
// ============================================================================

/// Flutter type
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum FlutterType {
    /// Classical flutter (torsion-heave coupling)
    Classical,
    /// Stall flutter (single degree of freedom)
    Stall,
    /// Torsional flutter
    Torsional,
}

/// Flutter analysis for bridges/long-span structures
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Flutter {
    /// Deck width (m)
    pub deck_width: f64,
    /// Deck depth (m)
    pub deck_depth: f64,
    /// Vertical natural frequency (Hz)
    pub vertical_frequency: f64,
    /// Torsional natural frequency (Hz)
    pub torsional_frequency: f64,
    /// Mass per unit length (kg/m)
    pub mass: f64,
    /// Mass moment of inertia per unit length (kg·m²/m)
    pub inertia: f64,
    /// Structural damping ratio (vertical)
    pub damping_vertical: f64,
    /// Structural damping ratio (torsional)
    pub damping_torsional: f64,
}

impl Flutter {
    pub fn new(width: f64, depth: f64, f_v: f64, f_t: f64) -> Self {
        Self {
            deck_width: width,
            deck_depth: depth,
            vertical_frequency: f_v,
            torsional_frequency: f_t,
            mass: 15000.0,
            inertia: 500000.0,
            damping_vertical: 0.005,
            damping_torsional: 0.005,
        }
    }
    
    /// Frequency ratio (torsional/vertical)
    pub fn frequency_ratio(&self) -> f64 {
        self.torsional_frequency / self.vertical_frequency
    }
    
    /// Reduced velocity for flutter
    pub fn reduced_velocity_flutter(&self) -> f64 {
        // Selberg formula approximation
        let gamma = self.frequency_ratio();
        let mu = self.mass / (PI * 1.25 * self.deck_width.powi(2) / 4.0);
        
        if gamma > 1.0 {
            // Typically safe if ft/fv > 1
            3.5 * gamma.sqrt() * mu.sqrt() / PI
        } else {
            // May be flutter prone
            2.5 * mu.sqrt() / PI
        }
    }
    
    /// Critical flutter velocity (m/s) - Selberg formula
    pub fn critical_flutter_velocity(&self) -> f64 {
        let u_red = self.reduced_velocity_flutter();
        
        u_red * self.deck_width * self.torsional_frequency
    }
    
    /// Flutter index (Ucr / design wind)
    pub fn flutter_index(&self, design_wind: f64) -> f64 {
        self.critical_flutter_velocity() / design_wind
    }
    
    /// Is flutter safe? (typically need index > 1.2-1.5)
    pub fn is_flutter_safe(&self, design_wind: f64) -> bool {
        self.flutter_index(design_wind) > 1.5
    }
    
    /// Torsional divergence velocity (m/s)
    pub fn divergence_velocity(&self) -> f64 {
        let rho = 1.25;
        let cm_alpha = 1.0; // Moment coefficient slope
        
        (2.0 * self.inertia * (2.0 * PI * self.torsional_frequency).powi(2) /
            (rho * self.deck_width.powi(2) * cm_alpha)).sqrt()
    }
}

// ============================================================================
// BUFFETING
// ============================================================================

/// Buffeting response analysis
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Buffeting {
    /// Structure height (m)
    pub height: f64,
    /// Reference width (m)
    pub width: f64,
    /// Natural frequency (Hz)
    pub natural_frequency: f64,
    /// Damping ratio
    pub damping_ratio: f64,
    /// Turbulence intensity at structure height
    pub turbulence_intensity: f64,
    /// Integral length scale (m)
    pub length_scale: f64,
}

impl Buffeting {
    pub fn new(height: f64, width: f64, natural_freq: f64) -> Self {
        Self {
            height,
            width,
            natural_frequency: natural_freq,
            damping_ratio: 0.01,
            turbulence_intensity: 0.15,
            length_scale: height * 1.5,
        }
    }
    
    /// Reduced frequency
    pub fn reduced_frequency(&self, wind_speed: f64) -> f64 {
        self.natural_frequency * self.width / wind_speed
    }
    
    /// Aerodynamic admittance (approximate)
    pub fn aerodynamic_admittance(&self, wind_speed: f64) -> f64 {
        let n_red = self.reduced_frequency(wind_speed);
        
        // Empirical formula
        1.0 / (1.0 + (2.0 * n_red).powi(2)).sqrt()
    }
    
    /// Background response factor B²
    pub fn background_factor(&self, _wind_speed: f64) -> f64 {
        let lx = self.length_scale;
        let h = self.height;
        let b = self.width;
        
        1.0 / (1.0 + 0.9 * ((b + h) / lx).powf(0.63))
    }
    
    /// Resonance response factor R² (EN 1991-1-4)
    pub fn resonance_factor(&self, wind_speed: f64) -> f64 {
        let n = self.natural_frequency;
        let lx = self.length_scale;
        let zeta = self.damping_ratio;
        let chi = self.aerodynamic_admittance(wind_speed);
        
        // Spectral value at natural frequency
        let sl = 6.8 * n * lx / wind_speed / 
            (1.0 + 10.2 * n * lx / wind_speed).powf(5.0 / 3.0);
        
        PI.powi(2) / (2.0 * zeta) * sl * chi.powi(2)
    }
    
    /// Peak factor
    pub fn peak_factor(&self, averaging_time: f64) -> f64 {
        let nu = self.natural_frequency * averaging_time;
        
        (2.0 * nu.ln()).sqrt() + 0.577 / (2.0 * nu.ln()).sqrt()
    }
    
    /// Dynamic amplification factor
    pub fn dynamic_factor(&self, wind_speed: f64) -> f64 {
        let b2 = self.background_factor(wind_speed);
        let r2 = self.resonance_factor(wind_speed);
        let kp = self.peak_factor(600.0); // 10-minute averaging
        let iv = self.turbulence_intensity;
        
        1.0 + 2.0 * kp * iv * (b2 + r2).sqrt()
    }
    
    /// RMS acceleration (m/s²)
    pub fn rms_acceleration(&self, wind_speed: f64, drag_force: f64, modal_mass: f64) -> f64 {
        let r2 = self.resonance_factor(wind_speed);
        let iv = self.turbulence_intensity;
        
        2.0 * drag_force * iv * r2.sqrt() / modal_mass
    }
}

// ============================================================================
// TESTS
// ============================================================================

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_strouhal_number() {
        assert!((CrossSectionShape::Circular.strouhal_number() - 0.18).abs() < 0.01);
    }

    #[test]
    fn test_vortex_shedding() {
        let vs = VortexShedding::new(CrossSectionShape::Circular, 0.5, 5.0);
        let v_cr = vs.critical_velocity();
        
        assert!(v_cr > 10.0 && v_cr < 20.0);
    }

    #[test]
    fn test_scruton_number() {
        let mut vs = VortexShedding::new(CrossSectionShape::Circular, 0.5, 5.0);
        vs.damping_ratio = 0.05;
        vs.mass_per_length = 500.0;
        
        let sc = vs.scruton_number();
        assert!(sc > 50.0);
    }

    #[test]
    fn test_lock_in() {
        let mut vs = VortexShedding::new(CrossSectionShape::Circular, 0.5, 5.0);
        vs.damping_ratio = 0.001;
        vs.mass_per_length = 100.0;
        
        assert!(vs.lock_in_susceptible());
    }

    #[test]
    fn test_galloping() {
        let gal = Galloping::new(1.0, 2.0, 2.0);
        
        assert!(gal.is_galloping_prone());
    }

    #[test]
    fn test_galloping_onset() {
        let mut gal = Galloping::new(1.0, 2.0, 2.0);
        gal.damping_ratio = 0.01;
        gal.mass_per_length = 1000.0;
        
        let v_onset = gal.onset_velocity();
        assert!(v_onset > 10.0);
    }

    #[test]
    fn test_flutter() {
        let fl = Flutter::new(30.0, 4.0, 0.3, 0.5);
        let v_cr = fl.critical_flutter_velocity();
        
        assert!(v_cr > 30.0);
    }

    #[test]
    fn test_flutter_safety() {
        let fl = Flutter::new(30.0, 4.0, 0.3, 0.5);
        
        // Should be safe at moderate wind
        assert!(fl.is_flutter_safe(40.0));
    }

    #[test]
    fn test_frequency_ratio() {
        let fl = Flutter::new(30.0, 4.0, 0.3, 0.5);
        
        assert!(fl.frequency_ratio() > 1.5);
    }

    #[test]
    fn test_buffeting() {
        let buf = Buffeting::new(200.0, 50.0, 0.2);
        let dyn_factor = buf.dynamic_factor(30.0);
        
        // Dynamic factor typically 1-5 range for tall structures
        assert!(dyn_factor > 0.5 && dyn_factor < 10.0);
    }

    #[test]
    fn test_background_factor() {
        let buf = Buffeting::new(200.0, 50.0, 0.2);
        let b2 = buf.background_factor(30.0);
        
        assert!(b2 > 0.0 && b2 < 1.0);
    }

    #[test]
    fn test_peak_factor() {
        let buf = Buffeting::new(200.0, 50.0, 0.2);
        let kp = buf.peak_factor(600.0);
        
        assert!(kp > 3.0 && kp < 4.5);
    }

    #[test]
    fn test_cross_section_lift() {
        assert!(CrossSectionShape::Square.lift_coefficient() > 
                CrossSectionShape::Circular.lift_coefficient());
    }
}
