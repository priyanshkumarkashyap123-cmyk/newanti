// ============================================================================
// BLAST ANALYSIS MODULE
// UFC 3-340-02, ASCE 59-11, GSA blast resistant design
// Pressure-impulse diagrams, SDOF response, structural hardening
// ============================================================================

use serde::{Deserialize, Serialize};
use std::f64::consts::PI;

// ============================================================================
// BLAST THREAT LEVELS
// ============================================================================

/// Blast threat level per GSA/ISC
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum ThreatLevel {
    /// Minimum - Small vehicle bomb (50 lb TNT)
    Minimum,
    /// Low - Sedan bomb (500 lb TNT)
    Low,
    /// Medium - Van bomb (1,000 lb TNT)
    Medium,
    /// High - Truck bomb (4,000 lb TNT)
    High,
    /// Very High - Large truck bomb (10,000 lb TNT)
    VeryHigh,
}

impl ThreatLevel {
    /// TNT equivalent charge weight (kg)
    pub fn charge_weight_kg(&self) -> f64 {
        match self {
            ThreatLevel::Minimum => 23.0,    // 50 lb
            ThreatLevel::Low => 227.0,       // 500 lb
            ThreatLevel::Medium => 454.0,    // 1,000 lb
            ThreatLevel::High => 1814.0,     // 4,000 lb
            ThreatLevel::VeryHigh => 4536.0, // 10,000 lb
        }
    }
    
    /// Minimum standoff distance (m)
    pub fn min_standoff(&self) -> f64 {
        match self {
            ThreatLevel::Minimum => 6.0,
            ThreatLevel::Low => 15.0,
            ThreatLevel::Medium => 25.0,
            ThreatLevel::High => 40.0,
            ThreatLevel::VeryHigh => 60.0,
        }
    }
}

/// Explosion type
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum ExplosionType {
    /// Unconfined surface burst
    SurfaceBurst,
    /// Air burst (spherical)
    AirBurst,
    /// Confined explosion (internal)
    Confined,
    /// Near-ground hemispherical
    Hemispherical,
}

// ============================================================================
// BLAST LOAD PARAMETERS
// ============================================================================

/// Blast load parameters from detonation
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BlastLoad {
    /// TNT equivalent weight (kg)
    pub charge_weight: f64,
    /// Standoff distance (m)
    pub standoff: f64,
    /// Explosion type
    pub explosion_type: ExplosionType,
    /// Angle of incidence (degrees)
    pub angle: f64,
}

impl BlastLoad {
    pub fn new(charge_weight: f64, standoff: f64) -> Self {
        Self {
            charge_weight,
            standoff,
            explosion_type: ExplosionType::SurfaceBurst,
            angle: 0.0,
        }
    }
    
    /// Scaled distance Z (m/kg^1/3)
    pub fn scaled_distance(&self) -> f64 {
        self.standoff / self.charge_weight.powf(1.0 / 3.0)
    }
    
    /// Peak incident overpressure Pso (kPa) - Kingery-Bulmash
    pub fn incident_pressure(&self) -> f64 {
        let z = self.scaled_distance();
        
        // Kingery-Bulmash curve fit for surface burst
        // Valid for 0.5 < Z < 40 m/kg^1/3
        if z < 0.5 {
            // Close-in: very high pressure
            10000.0
        } else if z < 2.0 {
            // Near field
            1772.0 * z.powf(-2.93)
        } else if z < 10.0 {
            // Mid field
            114.0 * z.powf(-1.65)
        } else {
            // Far field
            17.2 * z.powf(-1.13)
        }
    }
    
    /// Peak reflected pressure Pr (kPa)
    pub fn reflected_pressure(&self) -> f64 {
        let pso = self.incident_pressure();
        let angle_rad = self.angle.to_radians();
        
        // Reflection coefficient (normal incidence approximation)
        // Cr = 2 + 0.05 * Pso (simplified)
        let cr = (2.0 + 0.05 * pso / 100.0).min(8.0).max(2.0);
        
        // Angle effect
        let angle_factor = angle_rad.cos().powi(2);
        
        pso * cr * angle_factor
    }
    
    /// Positive phase duration td (ms)
    pub fn positive_duration(&self) -> f64 {
        let z = self.scaled_distance();
        let w_third = self.charge_weight.powf(1.0 / 3.0);
        
        // Empirical correlation
        if z < 2.0 {
            0.5 * w_third * z.powf(0.5)
        } else {
            0.3 * w_third * z.powf(0.8)
        }
    }
    
    /// Positive impulse is (kPa·ms)
    pub fn incident_impulse(&self) -> f64 {
        let pso = self.incident_pressure();
        let td = self.positive_duration();
        
        // Triangular approximation: is = 0.5 * Pso * td
        0.5 * pso * td
    }
    
    /// Reflected impulse ir (kPa·ms)
    pub fn reflected_impulse(&self) -> f64 {
        let pr = self.reflected_pressure();
        let td = self.positive_duration();
        
        // Triangular approximation
        0.5 * pr * td
    }
    
    /// Dynamic pressure q (kPa) - drag loading
    pub fn dynamic_pressure(&self) -> f64 {
        let pso = self.incident_pressure();
        
        // q = 2.5 * Pso² / (7 * P0 + Pso)
        // P0 = 101.3 kPa (atmospheric)
        let p0 = 101.3;
        2.5 * pso.powi(2) / (7.0 * p0 + pso)
    }
    
    /// Arrival time ta (ms)
    pub fn arrival_time(&self) -> f64 {
        let z = self.scaled_distance();
        let w_third = self.charge_weight.powf(1.0 / 3.0);
        
        // Empirical: ta ≈ 0.4 * W^(1/3) * Z^1.4
        0.4 * w_third * z.powf(1.4)
    }
}

// ============================================================================
// SDOF BLAST RESPONSE
// ============================================================================

/// SDOF system for blast response
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SdofBlastResponse {
    /// Mass (kg)
    pub mass: f64,
    /// Stiffness (kN/m)
    pub stiffness: f64,
    /// Yield resistance (kN)
    pub resistance: f64,
    /// Natural period (ms)
    pub period: f64,
    /// Tributary area (m²)
    pub area: f64,
}

impl SdofBlastResponse {
    pub fn new(mass: f64, stiffness: f64, resistance: f64, area: f64) -> Self {
        let period = 2.0 * PI * (mass / (stiffness * 1000.0)).sqrt() * 1000.0; // ms
        
        Self {
            mass,
            stiffness,
            resistance,
            period,
            area,
        }
    }
    
    /// From beam properties
    pub fn from_beam(
        span: f64,      // m
        width: f64,     // m
        e: f64,         // MPa
        i: f64,         // mm⁴
        mass_per_m: f64, // kg/m
        mp: f64,        // kN·m (plastic moment)
    ) -> Self {
        // Simply supported beam
        let stiffness = 384.0 * e * 1000.0 * i / 1e12 / (5.0 * span.powi(3)); // kN/m
        let resistance = 8.0 * mp / span; // kN (4 plastic hinges)
        let mass = mass_per_m * span;
        let area = span * width;
        
        Self::new(mass, stiffness, resistance, area)
    }
    
    /// Load-mass factor KLM (UFC 3-340-02 Table 3-12)
    pub fn load_mass_factor(&self, support: &str, ductility: f64) -> f64 {
        match support {
            "simply_supported" => {
                if ductility <= 1.0 { 0.78 } else { 0.66 }
            }
            "fixed" => {
                if ductility <= 1.0 { 0.77 } else { 0.66 }
            }
            "cantilever" => {
                if ductility <= 1.0 { 0.45 } else { 0.33 }
            }
            _ => 0.66,
        }
    }
    
    /// Maximum displacement from P-I diagram (simplified)
    pub fn max_displacement(&self, blast: &BlastLoad) -> f64 {
        let pr = blast.reflected_pressure();
        let ir = blast.reflected_impulse();
        let td = blast.positive_duration();
        
        let f_peak = pr * self.area; // Peak force (kN)
        let impulse = ir * self.area; // Total impulse (kN·ms)
        
        let t_tn = td / self.period;
        let klm = 0.66; // Typical
        
        // Response regime
        if t_tn < 0.1 {
            // Impulsive: xm = I / (KLM * M * ω)
            let omega = 2.0 * PI / self.period;
            impulse / (klm * self.mass * omega)
        } else if t_tn > 3.0 {
            // Quasi-static: xm = 2 * F / K
            2.0 * f_peak / self.stiffness
        } else {
            // Dynamic: use DLF
            let dlf = self.dynamic_load_factor(t_tn);
            dlf * f_peak / self.stiffness
        }
    }
    
    /// Dynamic Load Factor (DLF) for triangular pulse
    pub fn dynamic_load_factor(&self, t_td: f64) -> f64 {
        if t_td < 0.4 {
            // Rise portion dominates
            2.0 * t_td
        } else if t_td < 2.0 {
            // Peak response
            1.8 - 0.4 * (t_td - 0.4)
        } else {
            // Long duration
            1.0 + 0.5 / t_td
        }
    }
    
    /// Ductility demand
    pub fn ductility_demand(&self, blast: &BlastLoad) -> f64 {
        let xm = self.max_displacement(blast);
        let xy = self.resistance / self.stiffness; // Yield displacement
        
        xm / xy
    }
    
    /// Check response against limits
    pub fn check_response(&self, blast: &BlastLoad, allowable_ductility: f64) -> BlastResponse {
        let pr = blast.reflected_pressure();
        let ir = blast.reflected_impulse();
        let xm = self.max_displacement(blast);
        let ductility = self.ductility_demand(blast);
        let support_rotation = xm / (self.area.sqrt() / 2.0); // Approximate
        
        BlastResponse {
            peak_pressure: pr,
            peak_impulse: ir,
            max_displacement: xm,
            ductility_demand: ductility,
            support_rotation: support_rotation.atan().to_degrees(),
            response_regime: if blast.positive_duration() / self.period < 0.1 {
                "Impulsive".to_string()
            } else if blast.positive_duration() / self.period > 3.0 {
                "Quasi-static".to_string()
            } else {
                "Dynamic".to_string()
            },
            pass: ductility <= allowable_ductility,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BlastResponse {
    pub peak_pressure: f64,
    pub peak_impulse: f64,
    pub max_displacement: f64,
    pub ductility_demand: f64,
    pub support_rotation: f64,
    pub response_regime: String,
    pub pass: bool,
}

// ============================================================================
// P-I DIAGRAM
// ============================================================================

/// Pressure-Impulse diagram for damage assessment
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PiDiagram {
    /// Asymptotic pressure (kPa)
    pub p_asymptote: f64,
    /// Asymptotic impulse (kPa·ms)
    pub i_asymptote: f64,
    /// Curve shape parameter
    pub alpha: f64,
}

impl PiDiagram {
    /// Create P-I curve from SDOF parameters
    pub fn from_sdof(sdof: &SdofBlastResponse, ductility_limit: f64) -> Self {
        let xy = sdof.resistance / sdof.stiffness;
        let xm = ductility_limit * xy;
        
        // Quasi-static asymptote: P = Ru / A
        let p_asy = sdof.resistance / sdof.area;
        
        // Impulsive asymptote: I = sqrt(2 * M * Ru * xm) / A
        let i_asy = (2.0 * sdof.mass * sdof.resistance * 1000.0 * xm).sqrt() / sdof.area;
        
        Self {
            p_asymptote: p_asy,
            i_asymptote: i_asy,
            alpha: 1.5, // Typical hyperbolic shape
        }
    }
    
    /// Check if load point is inside (safe) or outside (damage) curve
    pub fn check_load(&self, pressure: f64, impulse: f64) -> PiResult {
        // Normalized coordinates
        let p_norm = pressure / self.p_asymptote;
        let i_norm = impulse / self.i_asymptote;
        
        // Hyperbolic curve: (P/Pa - 1)^α * (I/Ia - 1)^α = 1
        let lhs = if p_norm > 1.0 && i_norm > 1.0 {
            (p_norm - 1.0).powf(self.alpha) * (i_norm - 1.0).powf(self.alpha)
        } else {
            0.0
        };
        
        let damage_index = if p_norm <= 1.0 || i_norm <= 1.0 {
            // Inside asymptotes
            (p_norm.powi(2) + i_norm.powi(2)).sqrt() / 2.0_f64.sqrt()
        } else {
            // Outside asymptotes
            1.0 + lhs.powf(1.0 / self.alpha)
        };
        
        PiResult {
            p_asymptote: self.p_asymptote,
            i_asymptote: self.i_asymptote,
            applied_pressure: pressure,
            applied_impulse: impulse,
            damage_index,
            safe: damage_index < 1.0,
        }
    }
    
    /// Generate P-I curve points for plotting
    pub fn curve_points(&self, n_points: usize) -> Vec<(f64, f64)> {
        let mut points = Vec::with_capacity(n_points);
        
        // From impulsive to quasi-static
        for i in 0..n_points {
            let t = (i as f64) / ((n_points - 1) as f64);
            let p_ratio = 1.0 + 10.0 * t; // 1 to 11 times asymptote
            let i_ratio = 1.0 + (1.0 / (p_ratio - 1.0)).powf(1.0 / self.alpha);
            
            points.push((self.p_asymptote * p_ratio, self.i_asymptote * i_ratio));
        }
        
        points
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PiResult {
    pub p_asymptote: f64,
    pub i_asymptote: f64,
    pub applied_pressure: f64,
    pub applied_impulse: f64,
    pub damage_index: f64,
    pub safe: bool,
}

// ============================================================================
// GSA/ISC CRITERIA
// ============================================================================

/// GSA/ISC blast design criteria
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum ProtectionLevel {
    /// Below standard - minimal protection
    BelowStandard,
    /// Baseline - standard federal buildings
    Baseline,
    /// Level I - low risk
    LevelI,
    /// Level II - medium risk
    LevelII,
    /// Level III - high risk (courts, FBI)
    LevelIII,
    /// Level IV - very high risk (intelligence)
    LevelIV,
}

impl ProtectionLevel {
    /// Response limits per protection level
    pub fn response_limits(&self) -> ResponseLimits {
        match self {
            ProtectionLevel::BelowStandard => ResponseLimits {
                ductility: 20.0,
                rotation_degrees: 10.0,
                damage_level: "Heavy",
            },
            ProtectionLevel::Baseline => ResponseLimits {
                ductility: 10.0,
                rotation_degrees: 6.0,
                damage_level: "Moderate",
            },
            ProtectionLevel::LevelI | ProtectionLevel::LevelII => ResponseLimits {
                ductility: 5.0,
                rotation_degrees: 4.0,
                damage_level: "Moderate",
            },
            ProtectionLevel::LevelIII => ResponseLimits {
                ductility: 3.0,
                rotation_degrees: 2.0,
                damage_level: "Light",
            },
            ProtectionLevel::LevelIV => ResponseLimits {
                ductility: 1.0,
                rotation_degrees: 1.0,
                damage_level: "Superficial",
            },
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ResponseLimits {
    pub ductility: f64,
    pub rotation_degrees: f64,
    pub damage_level: &'static str,
}

// ============================================================================
// FRAGMENT HAZARD
// ============================================================================

/// Fragment hazard from glazing/cladding
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FragmentHazard {
    /// Fragment mass (kg)
    pub mass: f64,
    /// Initial velocity (m/s)
    pub velocity: f64,
    /// Fragment area (m²)
    pub area: f64,
}

impl FragmentHazard {
    /// Kinetic energy (J)
    pub fn kinetic_energy(&self) -> f64 {
        0.5 * self.mass * self.velocity.powi(2)
    }
    
    /// Hazard level per GSA
    pub fn hazard_level(&self) -> &'static str {
        let ke = self.kinetic_energy();
        
        if ke < 15.0 {
            "None" // Below injury threshold
        } else if ke < 79.0 {
            "Low"
        } else if ke < 500.0 {
            "Medium"
        } else {
            "High"
        }
    }
    
    /// Glass fragment velocity from pressure
    pub fn glass_fragment_velocity(pressure_kpa: f64, thickness_mm: f64) -> f64 {
        // Empirical correlation
        let p_psi = pressure_kpa * 0.145; // Convert to psi
        let t_in = thickness_mm / 25.4;
        
        // V ≈ 10 * sqrt(P / t) ft/s, convert to m/s
        10.0 * (p_psi / t_in).sqrt() * 0.3048
    }
}

// ============================================================================
// STRUCTURAL HARDENING
// ============================================================================

/// Blast mitigation strategies
pub struct BlastMitigation;

impl BlastMitigation {
    /// Required standoff for given pressure limit
    pub fn required_standoff(charge_kg: f64, max_pressure_kpa: f64) -> f64 {
        // Inverse Kingery-Bulmash
        let _w_third = charge_kg.powf(1.0 / 3.0);
        
        // Iterative solution (simplified)
        let mut r = 10.0;
        for _ in 0..20 {
            let blast = BlastLoad::new(charge_kg, r);
            let p = blast.reflected_pressure();
            
            if p < max_pressure_kpa {
                break;
            }
            r *= 1.2;
        }
        
        r
    }
    
    /// Column tie-down force for uplift
    pub fn column_tiedown(uplift_pressure_kpa: f64, tributary_area_m2: f64) -> f64 {
        // Additional hold-down required
        uplift_pressure_kpa * tributary_area_m2 // kN
    }
    
    /// Progressive collapse tie force (GSA)
    pub fn tie_force(floor_load_kpa: f64, span_m: f64) -> f64 {
        // Ti = 1.2 * w * L
        1.2 * floor_load_kpa * span_m // kN/m
    }
    
    /// Laminated glass thickness for pressure
    pub fn laminated_glass_thickness(pressure_kpa: f64, span_m: f64) -> f64 {
        // Simplified sizing
        let p_psf = pressure_kpa * 20.89; // kPa to psf
        let l_ft = span_m * 3.281;
        
        // t ≈ 0.04 * sqrt(P * L²) inches, convert to mm
        0.04 * (p_psf * l_ft.powi(2)).sqrt() * 25.4
    }
}

// ============================================================================
// TESTS
// ============================================================================

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_threat_level() {
        assert!((ThreatLevel::Low.charge_weight_kg() - 227.0).abs() < 1.0);
        assert!(ThreatLevel::High.min_standoff() > 30.0);
    }

    #[test]
    fn test_scaled_distance() {
        let blast = BlastLoad::new(100.0, 20.0);
        let z = blast.scaled_distance();
        // Z = 20 / 100^(1/3) = 20 / 4.64 ≈ 4.3
        assert!(z > 4.0 && z < 5.0);
    }

    #[test]
    fn test_incident_pressure() {
        let blast = BlastLoad::new(100.0, 20.0);
        let pso = blast.incident_pressure();
        // Should be positive and reasonable
        assert!(pso > 10.0 && pso < 500.0);
    }

    #[test]
    fn test_reflected_pressure() {
        let blast = BlastLoad::new(100.0, 20.0);
        let pr = blast.reflected_pressure();
        let pso = blast.incident_pressure();
        // Reflected > incident
        assert!(pr > pso);
    }

    #[test]
    fn test_positive_duration() {
        let blast = BlastLoad::new(100.0, 20.0);
        let td = blast.positive_duration();
        assert!(td > 0.0 && td < 100.0);
    }

    #[test]
    fn test_impulse() {
        let blast = BlastLoad::new(100.0, 20.0);
        let is = blast.incident_impulse();
        let ir = blast.reflected_impulse();
        
        assert!(is > 0.0);
        assert!(ir > is);
    }

    #[test]
    fn test_sdof_creation() {
        let sdof = SdofBlastResponse::new(1000.0, 500.0, 100.0, 10.0);
        assert!(sdof.period > 0.0);
    }

    #[test]
    fn test_sdof_from_beam() {
        let sdof = SdofBlastResponse::from_beam(
            6.0,    // span
            1.0,    // width
            200000.0, // E
            5e8,    // I
            200.0,  // mass/m
            300.0,  // Mp
        );
        
        assert!(sdof.stiffness > 0.0);
        assert!(sdof.resistance > 0.0);
    }

    #[test]
    fn test_dynamic_load_factor() {
        let sdof = SdofBlastResponse::new(1000.0, 500.0, 100.0, 10.0);
        
        let dlf1 = sdof.dynamic_load_factor(0.2);
        let dlf2 = sdof.dynamic_load_factor(1.0);
        
        assert!(dlf1 > 0.0);
        assert!(dlf2 > 0.0);
    }

    #[test]
    fn test_max_displacement() {
        let sdof = SdofBlastResponse::new(1000.0, 500.0, 100.0, 10.0);
        let blast = BlastLoad::new(50.0, 30.0);
        
        let xm = sdof.max_displacement(&blast);
        assert!(xm > 0.0);
    }

    #[test]
    fn test_ductility_demand() {
        let sdof = SdofBlastResponse::new(1000.0, 500.0, 100.0, 10.0);
        let blast = BlastLoad::new(50.0, 30.0);
        
        let mu = sdof.ductility_demand(&blast);
        assert!(mu > 0.0);
    }

    #[test]
    fn test_blast_response() {
        let sdof = SdofBlastResponse::new(1000.0, 500.0, 100.0, 10.0);
        let blast = BlastLoad::new(50.0, 30.0);
        
        let response = sdof.check_response(&blast, 5.0);
        assert!(response.peak_pressure > 0.0);
    }

    #[test]
    fn test_pi_diagram() {
        let sdof = SdofBlastResponse::new(1000.0, 500.0, 100.0, 10.0);
        let pi = PiDiagram::from_sdof(&sdof, 5.0);
        
        assert!(pi.p_asymptote > 0.0);
        assert!(pi.i_asymptote > 0.0);
    }

    #[test]
    fn test_pi_check() {
        let sdof = SdofBlastResponse::new(1000.0, 500.0, 100.0, 10.0);
        let pi = PiDiagram::from_sdof(&sdof, 5.0);
        
        // Load inside curve
        let result = pi.check_load(pi.p_asymptote * 0.5, pi.i_asymptote * 0.5);
        assert!(result.safe);
    }

    #[test]
    fn test_protection_level() {
        let limits = ProtectionLevel::LevelIII.response_limits();
        assert!(limits.ductility < 5.0);
        assert!(limits.rotation_degrees < 3.0);
    }

    #[test]
    fn test_fragment_energy() {
        let frag = FragmentHazard {
            mass: 0.1,
            velocity: 30.0,
            area: 0.01,
        };
        
        let ke = frag.kinetic_energy();
        // KE = 0.5 * 0.1 * 900 = 45 J
        assert!((ke - 45.0).abs() < 1.0);
    }

    #[test]
    fn test_hazard_level() {
        let low = FragmentHazard { mass: 0.01, velocity: 10.0, area: 0.001 };
        let high = FragmentHazard { mass: 1.0, velocity: 50.0, area: 0.01 };
        
        assert_eq!(low.hazard_level(), "None");
        assert_eq!(high.hazard_level(), "High");
    }

    #[test]
    fn test_required_standoff() {
        let r = BlastMitigation::required_standoff(100.0, 50.0);
        assert!(r > 10.0);
    }

    #[test]
    fn test_tie_force() {
        let ti = BlastMitigation::tie_force(5.0, 8.0);
        // 1.2 * 5 * 8 = 48 kN/m
        assert!((ti - 48.0).abs() < 1.0);
    }

    #[test]
    fn test_glass_velocity() {
        let v = FragmentHazard::glass_fragment_velocity(50.0, 6.0);
        assert!(v > 0.0 && v < 100.0);
    }
}
