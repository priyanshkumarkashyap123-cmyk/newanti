//! # Transportation Engineering Module (Rust)
//! 
//! High-performance transportation engineering calculations including:
//! - Geometric design (horizontal/vertical curves)
//! - Pavement design (flexible and rigid)
//! - Traffic flow analysis
//! - Sight distance calculations

use serde::{Deserialize, Serialize};
use std::f64::consts::PI;

// ============================================================================
// GEOMETRIC DESIGN - HORIZONTAL CURVES
// ============================================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HorizontalCurveInput {
    /// Deflection angle (degrees)
    pub delta: f64,
    /// Design speed (km/h)
    pub design_speed: f64,
    /// Superelevation rate
    pub e: f64,
    /// Side friction factor
    pub f: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HorizontalCurveResult {
    /// Radius (m)
    pub radius: f64,
    /// Tangent length (m)
    pub tangent: f64,
    /// Curve length (m)
    pub length: f64,
    /// External distance (m)
    pub external: f64,
    /// Middle ordinate (m)
    pub middle_ordinate: f64,
    /// Long chord (m)
    pub long_chord: f64,
    /// Degree of curve
    pub degree_of_curve: f64,
}

/// Horizontal curve calculator
pub struct HorizontalCurve;

impl HorizontalCurve {
    /// Calculate minimum radius
    pub fn minimum_radius(speed_kmh: f64, e: f64, f: f64) -> f64 {
        let v = speed_kmh / 3.6; // m/s
        let g = 9.81;
        
        // R = V² / (g * (e + f))
        v * v / (g * (e + f))
    }
    
    /// Complete horizontal curve design
    pub fn design(input: &HorizontalCurveInput) -> HorizontalCurveResult {
        let r = Self::minimum_radius(input.design_speed, input.e, input.f);
        let delta_rad = input.delta.to_radians();
        
        // Tangent length: T = R * tan(Δ/2)
        let t = r * (delta_rad / 2.0).tan();
        
        // Curve length: L = R * Δ (Δ in radians)
        let l = r * delta_rad;
        
        // External distance: E = R * (sec(Δ/2) - 1)
        let e = r * (1.0 / (delta_rad / 2.0).cos() - 1.0);
        
        // Middle ordinate: M = R * (1 - cos(Δ/2))
        let m = r * (1.0 - (delta_rad / 2.0).cos());
        
        // Long chord: LC = 2R * sin(Δ/2)
        let lc = 2.0 * r * (delta_rad / 2.0).sin();
        
        // Degree of curve (arc definition)
        let d = 5729.578 / r;
        
        HorizontalCurveResult {
            radius: r,
            tangent: t,
            length: l,
            external: e,
            middle_ordinate: m,
            long_chord: lc,
            degree_of_curve: d,
        }
    }
    
    /// Calculate spiral transition curve length
    pub fn spiral_length(speed_kmh: f64, radius: f64) -> f64 {
        let v = speed_kmh / 3.6;
        // Ls = V³ / (C * R), where C ≈ 0.3 m/s³
        let c = 0.3;
        v.powi(3) / (c * radius)
    }
    
    /// Calculate superelevation runoff length
    pub fn superelevation_runoff(e: f64, lane_width: f64, delta_grade: f64) -> f64 {
        // Lr = e * w / Δg
        e * lane_width / delta_grade
    }
}

// ============================================================================
// GEOMETRIC DESIGN - VERTICAL CURVES
// ============================================================================

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq)]
pub enum VerticalCurveType {
    Crest,
    Sag,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VerticalCurveInput {
    /// Grade 1 (%)
    pub g1: f64,
    /// Grade 2 (%)
    pub g2: f64,
    /// Design speed (km/h)
    pub design_speed: f64,
    /// Station of PVI
    pub pvi_station: f64,
    /// Elevation of PVI
    pub pvi_elevation: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VerticalCurveResult {
    pub curve_type: VerticalCurveType,
    /// Curve length (m)
    pub length: f64,
    /// K value (length per % change)
    pub k_value: f64,
    /// Algebraic difference of grades
    pub a: f64,
    /// Station of BVC
    pub bvc_station: f64,
    /// Elevation of BVC
    pub bvc_elevation: f64,
    /// Station of EVC
    pub evc_station: f64,
    /// Elevation of EVC
    pub evc_elevation: f64,
    /// High/low point station
    pub turning_point_station: Option<f64>,
    /// High/low point elevation
    pub turning_point_elevation: Option<f64>,
}

/// Vertical curve calculator
pub struct VerticalCurve;

impl VerticalCurve {
    /// Get minimum K value based on design speed and curve type
    pub fn min_k_value(speed_kmh: f64, curve_type: VerticalCurveType) -> f64 {
        // Based on AASHTO standards (approximate)
        match curve_type {
            VerticalCurveType::Crest => {
                // K = L/A, based on stopping sight distance
                match speed_kmh as i32 {
                    0..=30 => 3.0,
                    31..=50 => 7.0,
                    51..=70 => 17.0,
                    71..=90 => 35.0,
                    91..=110 => 60.0,
                    _ => 85.0,
                }
            }
            VerticalCurveType::Sag => {
                // Based on headlight sight distance
                match speed_kmh as i32 {
                    0..=30 => 5.0,
                    31..=50 => 10.0,
                    51..=70 => 20.0,
                    71..=90 => 35.0,
                    91..=110 => 50.0,
                    _ => 65.0,
                }
            }
        }
    }
    
    /// Design vertical curve
    pub fn design(input: &VerticalCurveInput) -> VerticalCurveResult {
        let g1 = input.g1 / 100.0;
        let g2 = input.g2 / 100.0;
        let a = (input.g2 - input.g1).abs();
        
        let curve_type = if input.g1 > input.g2 {
            VerticalCurveType::Crest
        } else {
            VerticalCurveType::Sag
        };
        
        let k = Self::min_k_value(input.design_speed, curve_type);
        let l = k * a;
        
        // BVC and EVC
        let bvc_station = input.pvi_station - l / 2.0;
        let evc_station = input.pvi_station + l / 2.0;
        let bvc_elevation = input.pvi_elevation - g1 * l / 2.0;
        let evc_elevation = input.pvi_elevation + g2 * l / 2.0;
        
        // Turning point (high/low point)
        let (turning_station, turning_elevation) = if g1.abs() > 0.0001 && g1 * g2 < 0.0 {
            let x = -g1 * l / (g2 - g1);
            if x > 0.0 && x < l {
                let station = bvc_station + x;
                let y = bvc_elevation + g1 * x + (g2 - g1) * x * x / (2.0 * l);
                (Some(station), Some(y))
            } else {
                (None, None)
            }
        } else {
            (None, None)
        };
        
        VerticalCurveResult {
            curve_type,
            length: l,
            k_value: k,
            a,
            bvc_station,
            bvc_elevation,
            evc_station,
            evc_elevation,
            turning_point_station: turning_station,
            turning_point_elevation: turning_elevation,
        }
    }
    
    /// Calculate elevation at any point on curve
    pub fn elevation_at(
        bvc_station: f64,
        bvc_elevation: f64,
        g1: f64,
        g2: f64,
        l: f64,
        station: f64,
    ) -> f64 {
        let x = station - bvc_station;
        if x < 0.0 || x > l {
            // Outside curve
            if x < 0.0 {
                bvc_elevation + g1 * x
            } else {
                bvc_elevation + g1 * l + (g2 - g1) * l / 2.0 + g2 * (x - l)
            }
        } else {
            // On curve
            bvc_elevation + g1 * x + (g2 - g1) * x * x / (2.0 * l)
        }
    }
}

// ============================================================================
// SIGHT DISTANCE
// ============================================================================

/// Sight distance calculator
pub struct SightDistance;

impl SightDistance {
    /// Stopping sight distance (SSD)
    pub fn stopping(speed_kmh: f64, grade_percent: f64, reaction_time: f64) -> f64 {
        let v = speed_kmh / 3.6; // m/s
        let g = grade_percent / 100.0;
        let f = 0.35; // friction coefficient (wet pavement)
        let gr = 9.81;
        
        // SSD = v*t + v²/(2g(f ± G))
        let perception_reaction = v * reaction_time;
        let braking = v * v / (2.0 * gr * (f + g));
        
        perception_reaction + braking
    }
    
    /// Passing sight distance (PSD)
    pub fn passing(speed_kmh: f64) -> f64 {
        // Approximate PSD based on AASHTO
        let v = speed_kmh / 3.6;
        
        // d1 = initial maneuver distance
        // d2 = distance traveled during passing
        // d3 = clearance distance
        // d4 = distance traveled by oncoming vehicle
        
        // Simplified: PSD ≈ 6 * V (in meters when V in m/s)
        6.0 * v * 3.6 // Convert back to use km/h relationship
    }
    
    /// Decision sight distance
    pub fn decision(speed_kmh: f64, avoidance_type: &str) -> f64 {
        let v = speed_kmh;
        
        // Based on AASHTO Table 3-3
        match avoidance_type {
            "stop" => 2.5 * v + 0.006 * v * v + 30.0,
            "lane_change" => 3.0 * v + 0.007 * v * v + 40.0,
            "path_change" => 4.0 * v + 0.008 * v * v + 50.0,
            _ => Self::stopping(speed_kmh, 0.0, 2.5),
        }
    }
}

// ============================================================================
// PAVEMENT DESIGN
// ============================================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FlexiblePavementInput {
    /// Design ESALs (Equivalent Single Axle Loads)
    pub design_esal: f64,
    /// Reliability (%)
    pub reliability: f64,
    /// Standard deviation
    pub s0: f64,
    /// Terminal serviceability
    pub pt: f64,
    /// Initial serviceability
    pub p0: f64,
    /// Subgrade resilient modulus (psi)
    pub mr: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FlexiblePavementResult {
    /// Required structural number
    pub sn: f64,
    /// Suggested layer thicknesses (inches)
    pub surface_thickness: f64,
    pub base_thickness: f64,
    pub subbase_thickness: f64,
    /// Total pavement thickness (inches)
    pub total_thickness: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RigidPavementInput {
    /// Design ESALs
    pub design_esal: f64,
    /// Reliability (%)
    pub reliability: f64,
    /// Standard deviation
    pub s0: f64,
    /// Terminal serviceability
    pub pt: f64,
    /// Concrete modulus of rupture (psi)
    pub sc: f64,
    /// Modulus of subgrade reaction (pci)
    pub k: f64,
    /// Concrete elastic modulus (psi)
    pub ec: f64,
    /// Load transfer coefficient
    pub j: f64,
    /// Drainage coefficient
    pub cd: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RigidPavementResult {
    /// Slab thickness (inches)
    pub slab_thickness: f64,
    /// Joint spacing (feet)
    pub joint_spacing: f64,
}

/// Pavement design calculator
pub struct PavementDesign;

impl PavementDesign {
    /// Get Z-value for reliability
    fn z_reliability(reliability: f64) -> f64 {
        match reliability as i32 {
            0..=50 => 0.0,
            51..=60 => -0.253,
            61..=70 => -0.524,
            71..=75 => -0.674,
            76..=80 => -0.841,
            81..=85 => -1.037,
            86..=90 => -1.282,
            91..=95 => -1.645,
            _ => -2.327, // 99%
        }
    }
    
    /// AASHTO flexible pavement design (1993)
    pub fn flexible(input: &FlexiblePavementInput) -> FlexiblePavementResult {
        let zr = Self::z_reliability(input.reliability);
        let delta_psi = input.p0 - input.pt;
        
        // Solve for SN using AASHTO equation (iterative)
        let log_w18 = input.design_esal.log10();
        
        // Simplified SN calculation
        // log(W18) = ZR*S0 + 9.36*log(SN+1) - 0.20 + log(ΔPSI/(4.2-1.5))/... + 2.32*log(MR) - 8.07
        
        // Iterative solution
        let mut sn: f64 = 3.0;
        for _ in 0..50 {
            let log_sn = (sn + 1.0).log10();
            let psi_term = (delta_psi / (4.2 - 1.5)).log10() / 
                (0.4 + 1094.0 / (sn + 1.0).powf(5.19));
            
            let calc_log_w18 = zr * input.s0 + 9.36 * log_sn - 0.20 
                + psi_term + 2.32 * input.mr.log10() - 8.07;
            
            if (calc_log_w18 - log_w18).abs() < 0.01 {
                break;
            }
            
            sn += (log_w18 - calc_log_w18) * 0.5;
        }
        
        // Layer thicknesses (typical layer coefficients)
        // a1 = 0.44 (surface), a2 = 0.14 (base), a3 = 0.11 (subbase)
        let a1 = 0.44;
        let a2 = 0.14;
        let a3 = 0.11;
        
        // Minimum surface thickness
        let d1 = (sn * 0.3 / a1).max(3.0);
        let remaining_sn = sn - a1 * d1;
        
        let d2 = (remaining_sn * 0.4 / a2).max(6.0);
        let remaining_sn2 = remaining_sn - a2 * d2;
        
        let d3 = (remaining_sn2 / a3).max(4.0);
        
        FlexiblePavementResult {
            sn,
            surface_thickness: d1,
            base_thickness: d2,
            subbase_thickness: d3,
            total_thickness: d1 + d2 + d3,
        }
    }
    
    /// AASHTO rigid pavement design (1993)
    pub fn rigid(input: &RigidPavementInput) -> RigidPavementResult {
        let zr = Self::z_reliability(input.reliability);
        let delta_psi = 4.5 - input.pt;
        let log_w18 = input.design_esal.log10();
        
        // Iterative solution for D
        let mut d: f64 = 8.0; // Initial guess
        
        for _ in 0..50 {
            let d7 = d.powf(0.75);
            let log_d = d.log10();
            
            let psi_term = (delta_psi / (4.5 - 1.5)).log10() /
                (1.0 + 1.624e7 / (d + 1.0).powf(8.46));
            
            let stress_term = 4.22 - 0.32 * input.pt + 
                ((input.sc * input.cd * (d7 - 1.132)) / 
                (215.63 * input.j * (d7 - 18.42 * (input.ec / input.k).powf(0.25)))).log10();
            
            let calc_log_w18 = zr * input.s0 + 7.35 * log_d - 0.06 + psi_term + stress_term;
            
            if (calc_log_w18 - log_w18).abs() < 0.01 {
                break;
            }
            
            d += (log_w18 - calc_log_w18) * 0.3;
            d = d.max(6.0).min(15.0);
        }
        
        // Joint spacing (typically 15-20 times slab thickness)
        let joint_spacing = 15.0 * d / 12.0; // feet
        
        RigidPavementResult {
            slab_thickness: d,
            joint_spacing,
        }
    }
    
    /// Calculate ESAL from traffic data
    pub fn calculate_esal(
        aadt: f64,
        growth_rate: f64,
        design_years: f64,
        truck_percentage: f64,
        lane_factor: f64,
        truck_factor: f64,
    ) -> f64 {
        let r = growth_rate / 100.0;
        let n = design_years;
        
        // Growth factor
        let growth_factor = if r.abs() < 0.0001 {
            n
        } else {
            ((1.0 + r).powf(n) - 1.0) / r
        };
        
        // ESAL = AADT × %trucks × LDF × TF × 365 × GF
        aadt * (truck_percentage / 100.0) * lane_factor * truck_factor * 365.0 * growth_factor
    }
}

// ============================================================================
// TRAFFIC FLOW
// ============================================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TrafficStreamResult {
    /// Flow rate (veh/hr)
    pub flow: f64,
    /// Density (veh/km)
    pub density: f64,
    /// Speed (km/h)
    pub speed: f64,
    /// Capacity (veh/hr)
    pub capacity: f64,
    /// Volume/Capacity ratio
    pub vc_ratio: f64,
    /// Level of Service
    pub los: String,
}

/// Traffic flow calculator
pub struct TrafficFlow;

impl TrafficFlow {
    /// Greenshields model: v = vf(1 - k/kj)
    pub fn greenshields(free_flow_speed: f64, jam_density: f64, density: f64) -> (f64, f64) {
        let speed = free_flow_speed * (1.0 - density / jam_density);
        let flow = speed * density;
        (speed, flow)
    }
    
    /// Calculate maximum flow (capacity)
    pub fn capacity(free_flow_speed: f64, jam_density: f64) -> f64 {
        // Qmax = vf * kj / 4
        free_flow_speed * jam_density / 4.0
    }
    
    /// Level of Service for basic freeway
    pub fn freeway_los(density: f64) -> String {
        match density as i32 {
            0..=11 => "A".to_string(),
            12..=18 => "B".to_string(),
            19..=26 => "C".to_string(),
            27..=35 => "D".to_string(),
            36..=45 => "E".to_string(),
            _ => "F".to_string(),
        }
    }
    
    /// PCE (Passenger Car Equivalent) for trucks
    pub fn pce_trucks(grade_percent: f64, grade_length_km: f64) -> f64 {
        // Simplified PCE calculation
        if grade_percent.abs() < 2.0 {
            1.5
        } else if grade_percent.abs() < 4.0 {
            2.0 + grade_length_km * 0.5
        } else {
            3.0 + grade_length_km * 0.8
        }
    }
    
    /// Calculate traffic stream
    pub fn analyze(flow_vph: f64, free_flow_speed: f64, jam_density: f64) -> TrafficStreamResult {
        let capacity = Self::capacity(free_flow_speed, jam_density);
        let vc_ratio = flow_vph / capacity;
        
        // Calculate density from flow
        let density = if vc_ratio < 1.0 {
            jam_density * (1.0 - (1.0 - 4.0 * flow_vph / (free_flow_speed * jam_density)).sqrt()) / 2.0
        } else {
            jam_density * 0.5
        };
        
        let speed = if density > 0.0 { flow_vph / density } else { free_flow_speed };
        let los = Self::freeway_los(density);
        
        TrafficStreamResult {
            flow: flow_vph,
            density,
            speed,
            capacity,
            vc_ratio,
            los,
        }
    }
    
    /// Gap acceptance (critical gap)
    pub fn critical_gap(follow_up_time: f64, minor_flow: f64, major_flow: f64) -> f64 {
        // tc = tf + ln(qminor/qmajor) / qmajor
        follow_up_time + (minor_flow / major_flow).ln() / major_flow * 3600.0
    }
    
    /// Signal timing - Webster's formula for optimal cycle
    pub fn webster_cycle(total_lost_time: f64, critical_flow_ratio: f64) -> f64 {
        // C0 = (1.5L + 5) / (1 - Y)
        (1.5 * total_lost_time + 5.0) / (1.0 - critical_flow_ratio)
    }
}

// ============================================================================
// EARTHWORK
// ============================================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CrossSection {
    pub station: f64,
    pub cut_area: f64,    // m²
    pub fill_area: f64,   // m²
}

/// Earthwork volume calculator
pub struct Earthwork;

impl Earthwork {
    /// Average end area method
    pub fn average_end_area(section1: &CrossSection, section2: &CrossSection) -> (f64, f64) {
        let distance = (section2.station - section1.station).abs();
        
        let cut_volume = distance * (section1.cut_area + section2.cut_area) / 2.0;
        let fill_volume = distance * (section1.fill_area + section2.fill_area) / 2.0;
        
        (cut_volume, fill_volume)
    }
    
    /// Prismoidal formula (more accurate)
    pub fn prismoidal(
        section1: &CrossSection,
        section_mid: &CrossSection,
        section2: &CrossSection,
    ) -> (f64, f64) {
        let l = (section2.station - section1.station).abs();
        
        let cut_volume = l / 6.0 * 
            (section1.cut_area + 4.0 * section_mid.cut_area + section2.cut_area);
        let fill_volume = l / 6.0 * 
            (section1.fill_area + 4.0 * section_mid.fill_area + section2.fill_area);
        
        (cut_volume, fill_volume)
    }
    
    /// Mass haul diagram calculation
    pub fn mass_haul(sections: &[CrossSection], shrinkage_factor: f64) -> Vec<f64> {
        let mut mass_ordinate = vec![0.0];
        let mut cumulative = 0.0;
        
        for i in 1..sections.len() {
            let (cut, fill) = Self::average_end_area(&sections[i - 1], &sections[i]);
            // Adjusted cut for shrinkage
            let adjusted_cut = cut * shrinkage_factor;
            cumulative += adjusted_cut - fill;
            mass_ordinate.push(cumulative);
        }
        
        mass_ordinate
    }
}

// ============================================================================
// TESTS
// ============================================================================

#[cfg(test)]
mod tests {
    use super::*;
    
    #[test]
    fn test_horizontal_curve() {
        let input = HorizontalCurveInput {
            delta: 30.0,
            design_speed: 80.0,
            e: 0.06,
            f: 0.14,
        };
        
        let result = HorizontalCurve::design(&input);
        assert!(result.radius > 0.0);
        assert!(result.length > 0.0);
        assert!(result.tangent > 0.0);
    }
    
    #[test]
    fn test_vertical_curve() {
        let input = VerticalCurveInput {
            g1: 3.0,
            g2: -2.0,
            design_speed: 80.0,
            pvi_station: 1000.0,
            pvi_elevation: 100.0,
        };
        
        let result = VerticalCurve::design(&input);
        assert_eq!(result.curve_type, VerticalCurveType::Crest);
        assert!(result.length > 0.0);
    }
    
    #[test]
    fn test_stopping_sight_distance() {
        let ssd = SightDistance::stopping(80.0, 0.0, 2.5);
        assert!(ssd > 100.0); // Should be around 130m for 80 km/h
    }
    
    #[test]
    fn test_traffic_flow() {
        let result = TrafficFlow::analyze(1500.0, 100.0, 150.0);
        assert!(result.capacity > 0.0);
        assert!(result.vc_ratio > 0.0);
    }
}
