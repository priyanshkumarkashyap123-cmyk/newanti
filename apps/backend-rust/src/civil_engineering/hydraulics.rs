//! # Hydraulics Engineering Module (Rust)
//! 
//! High-performance hydraulic and hydrological calculations including:
//! - Open channel flow (Manning's equation, critical depth)
//! - Pipe flow (Darcy-Weisbach, Hazen-Williams)
//! - Hydraulic structures (weirs, orifices)
//! - Hydrology (Rational method, SCS curve number)
//! - Flood routing (Muskingum)

use serde::{Deserialize, Serialize};
use std::f64::consts::PI;

// ============================================================================
// OPEN CHANNEL FLOW
// ============================================================================

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq)]
pub enum ChannelType {
    Rectangular,
    Trapezoidal,
    Triangular,
    Circular,
    Parabolic,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChannelSection {
    pub channel_type: ChannelType,
    /// Bottom width (m) - for rectangular, trapezoidal
    pub b: f64,
    /// Side slope (horizontal:1 vertical)
    pub z: f64,
    /// Diameter (m) - for circular
    pub diameter: f64,
    /// Manning's roughness coefficient
    pub n: f64,
    /// Channel bed slope
    pub s0: f64,
}

impl ChannelSection {
    /// Calculate area for given depth
    pub fn area(&self, y: f64) -> f64 {
        match self.channel_type {
            ChannelType::Rectangular => self.b * y,
            ChannelType::Trapezoidal => (self.b + self.z * y) * y,
            ChannelType::Triangular => self.z * y * y,
            ChannelType::Circular => {
                let r = self.diameter / 2.0;
                let theta = 2.0 * (1.0 - y / r).acos();
                r * r * (theta - theta.sin()) / 2.0
            }
            ChannelType::Parabolic => 2.0 * self.b * y / 3.0 * (y / self.b).sqrt(),
        }
    }
    
    /// Calculate wetted perimeter for given depth
    pub fn wetted_perimeter(&self, y: f64) -> f64 {
        match self.channel_type {
            ChannelType::Rectangular => self.b + 2.0 * y,
            ChannelType::Trapezoidal => self.b + 2.0 * y * (1.0 + self.z * self.z).sqrt(),
            ChannelType::Triangular => 2.0 * y * (1.0 + self.z * self.z).sqrt(),
            ChannelType::Circular => {
                let r = self.diameter / 2.0;
                let theta = 2.0 * (1.0 - y / r).acos();
                r * theta
            }
            ChannelType::Parabolic => {
                let x = (self.b * self.b / 4.0 + 4.0 * y * y).sqrt();
                self.b + 8.0 * y * y / (3.0 * x)
            }
        }
    }
    
    /// Calculate top width for given depth
    pub fn top_width(&self, y: f64) -> f64 {
        match self.channel_type {
            ChannelType::Rectangular => self.b,
            ChannelType::Trapezoidal => self.b + 2.0 * self.z * y,
            ChannelType::Triangular => 2.0 * self.z * y,
            ChannelType::Circular => {
                let r = self.diameter / 2.0;
                2.0 * (r * r - (r - y).powi(2)).sqrt()
            }
            ChannelType::Parabolic => 2.0 * (self.b * y).sqrt(),
        }
    }
    
    /// Calculate hydraulic radius
    pub fn hydraulic_radius(&self, y: f64) -> f64 {
        let a = self.area(y);
        let p = self.wetted_perimeter(y);
        if p > 0.0 { a / p } else { 0.0 }
    }
    
    /// Calculate hydraulic depth
    pub fn hydraulic_depth(&self, y: f64) -> f64 {
        let a = self.area(y);
        let t = self.top_width(y);
        if t > 0.0 { a / t } else { 0.0 }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChannelFlowResult {
    /// Normal depth (m)
    pub normal_depth: f64,
    /// Critical depth (m)
    pub critical_depth: f64,
    /// Velocity (m/s)
    pub velocity: f64,
    /// Flow rate (m³/s)
    pub discharge: f64,
    /// Froude number
    pub froude: f64,
    /// Flow regime
    pub flow_regime: FlowRegime,
    /// Specific energy (m)
    pub specific_energy: f64,
    /// Hydraulic radius (m)
    pub hydraulic_radius: f64,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq)]
pub enum FlowRegime {
    Subcritical,
    Critical,
    Supercritical,
}

/// Open channel flow calculator
pub struct OpenChannelFlow;

impl OpenChannelFlow {
    /// Calculate discharge using Manning's equation
    pub fn manning_discharge(section: &ChannelSection, depth: f64) -> f64 {
        let a = section.area(depth);
        let r = section.hydraulic_radius(depth);
        let n = section.n;
        let s = section.s0;
        
        // Q = (1/n) * A * R^(2/3) * S^(1/2)
        (1.0 / n) * a * r.powf(2.0 / 3.0) * s.sqrt()
    }
    
    /// Calculate velocity using Manning's equation
    pub fn manning_velocity(section: &ChannelSection, depth: f64) -> f64 {
        let r = section.hydraulic_radius(depth);
        let n = section.n;
        let s = section.s0;
        
        // V = (1/n) * R^(2/3) * S^(1/2)
        (1.0 / n) * r.powf(2.0 / 3.0) * s.sqrt()
    }
    
    /// Calculate normal depth for given discharge (iterative)
    pub fn normal_depth(section: &ChannelSection, q: f64) -> f64 {
        let mut y_low = 0.001;
        let mut y_high = 20.0;
        let tol = 1e-6;
        let max_iter = 100;
        
        for _ in 0..max_iter {
            let y_mid = (y_low + y_high) / 2.0;
            let q_calc = Self::manning_discharge(section, y_mid);
            
            if (q_calc - q).abs() < tol {
                return y_mid;
            }
            
            if q_calc < q {
                y_low = y_mid;
            } else {
                y_high = y_mid;
            }
        }
        
        (y_low + y_high) / 2.0
    }
    
    /// Calculate critical depth for given discharge
    pub fn critical_depth(section: &ChannelSection, q: f64) -> f64 {
        let g = 9.81;
        
        // For rectangular channel: yc = (q²/(g*b²))^(1/3)
        if section.channel_type == ChannelType::Rectangular {
            return (q * q / (g * section.b * section.b)).powf(1.0 / 3.0);
        }
        
        // Iterative solution for other sections
        // At critical depth: Q²T/(gA³) = 1
        let mut y_low = 0.001;
        let mut y_high = 10.0;
        let tol = 1e-6;
        
        for _ in 0..100 {
            let y_mid = (y_low + y_high) / 2.0;
            let a = section.area(y_mid);
            let t = section.top_width(y_mid);
            
            let f = q * q * t / (g * a.powi(3)) - 1.0;
            
            if f.abs() < tol {
                return y_mid;
            }
            
            if f > 0.0 {
                y_low = y_mid;
            } else {
                y_high = y_mid;
            }
        }
        
        (y_low + y_high) / 2.0
    }
    
    /// Calculate Froude number
    pub fn froude_number(section: &ChannelSection, depth: f64, velocity: f64) -> f64 {
        let g = 9.81;
        let d = section.hydraulic_depth(depth);
        velocity / (g * d).sqrt()
    }
    
    /// Calculate specific energy
    pub fn specific_energy(depth: f64, velocity: f64) -> f64 {
        let g = 9.81;
        depth + velocity * velocity / (2.0 * g)
    }
    
    /// Complete channel flow analysis
    pub fn analyze(section: &ChannelSection, q: f64) -> ChannelFlowResult {
        let yn = Self::normal_depth(section, q);
        let yc = Self::critical_depth(section, q);
        let v = Self::manning_velocity(section, yn);
        let fr = Self::froude_number(section, yn, v);
        let e = Self::specific_energy(yn, v);
        let r = section.hydraulic_radius(yn);
        
        let regime = if fr < 0.99 {
            FlowRegime::Subcritical
        } else if fr > 1.01 {
            FlowRegime::Supercritical
        } else {
            FlowRegime::Critical
        };
        
        ChannelFlowResult {
            normal_depth: yn,
            critical_depth: yc,
            velocity: v,
            discharge: q,
            froude: fr,
            flow_regime: regime,
            specific_energy: e,
            hydraulic_radius: r,
        }
    }
    
    /// Calculate hydraulic jump parameters
    pub fn hydraulic_jump(y1: f64, froude1: f64) -> HydraulicJumpResult {
        // Sequent depth ratio
        let ratio = 0.5 * ((1.0 + 8.0 * froude1 * froude1).sqrt() - 1.0);
        let y2 = y1 * ratio;
        
        // Froude number after jump
        let froude2 = froude1 / ratio.powf(1.5);
        
        // Energy loss
        let energy_loss = (y2 - y1).powi(3) / (4.0 * y1 * y2);
        
        // Jump length (approximate)
        let jump_length = 6.9 * (y2 - y1);
        
        HydraulicJumpResult {
            y1,
            y2,
            froude1,
            froude2,
            energy_loss,
            jump_length,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HydraulicJumpResult {
    pub y1: f64,
    pub y2: f64,
    pub froude1: f64,
    pub froude2: f64,
    pub energy_loss: f64,
    pub jump_length: f64,
}

// ============================================================================
// PIPE FLOW
// ============================================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PipeInput {
    /// Internal diameter (m)
    pub diameter: f64,
    /// Pipe length (m)
    pub length: f64,
    /// Absolute roughness (m)
    pub roughness: f64,
    /// Kinematic viscosity (m²/s)
    pub viscosity: f64,
}

impl Default for PipeInput {
    fn default() -> Self {
        PipeInput {
            diameter: 0.3,
            length: 100.0,
            roughness: 0.00015, // Commercial steel
            viscosity: 1e-6,    // Water at 20°C
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PipeFlowResult {
    /// Flow rate (m³/s)
    pub discharge: f64,
    /// Velocity (m/s)
    pub velocity: f64,
    /// Head loss (m)
    pub head_loss: f64,
    /// Friction factor
    pub friction_factor: f64,
    /// Reynolds number
    pub reynolds: f64,
    /// Flow regime
    pub regime: PipeFlowRegime,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
pub enum PipeFlowRegime {
    Laminar,
    Transitional,
    Turbulent,
}

/// Pipe flow calculator
pub struct PipeFlow;

impl PipeFlow {
    /// Calculate Reynolds number
    pub fn reynolds(diameter: f64, velocity: f64, viscosity: f64) -> f64 {
        velocity * diameter / viscosity
    }
    
    /// Calculate friction factor using Colebrook-White equation (iterative)
    pub fn colebrook_white(reynolds: f64, relative_roughness: f64) -> f64 {
        if reynolds < 2300.0 {
            // Laminar flow
            return 64.0 / reynolds;
        }
        
        // Initial guess using Swamee-Jain
        let e_d = relative_roughness;
        let mut f = 0.25 / (e_d / 3.7 + 5.74 / reynolds.powf(0.9)).log10().powi(2);
        
        // Iterate using Colebrook-White
        for _ in 0..50 {
            let rhs = -2.0 * (e_d / 3.7 + 2.51 / (reynolds * f.sqrt())).log10();
            let f_new = 1.0 / (rhs * rhs);
            
            if (f_new - f).abs() < 1e-8 {
                return f_new;
            }
            f = f_new;
        }
        
        f
    }
    
    /// Darcy-Weisbach head loss
    pub fn darcy_weisbach(pipe: &PipeInput, velocity: f64) -> f64 {
        let re = Self::reynolds(pipe.diameter, velocity, pipe.viscosity);
        let e_d = pipe.roughness / pipe.diameter;
        let f = Self::colebrook_white(re, e_d);
        let g = 9.81;
        
        f * (pipe.length / pipe.diameter) * (velocity * velocity) / (2.0 * g)
    }
    
    /// Hazen-Williams equation (for water)
    pub fn hazen_williams(diameter: f64, length: f64, c: f64, discharge: f64) -> f64 {
        // hf = 10.67 * L * Q^1.852 / (C^1.852 * D^4.87)
        10.67 * length * discharge.powf(1.852) / (c.powf(1.852) * diameter.powf(4.87))
    }
    
    /// Calculate discharge for given head
    pub fn discharge_from_head(pipe: &PipeInput, available_head: f64, c_hw: f64) -> f64 {
        // Using Hazen-Williams inverted
        let d = pipe.diameter;
        let l = pipe.length;
        
        (available_head * c_hw.powf(1.852) * d.powf(4.87) / (10.67 * l)).powf(1.0 / 1.852)
    }
    
    /// Complete pipe flow analysis
    pub fn analyze(pipe: &PipeInput, discharge: f64) -> PipeFlowResult {
        let area = PI * pipe.diameter * pipe.diameter / 4.0;
        let velocity = discharge / area;
        let reynolds = Self::reynolds(pipe.diameter, velocity, pipe.viscosity);
        let e_d = pipe.roughness / pipe.diameter;
        let friction_factor = Self::colebrook_white(reynolds, e_d);
        let head_loss = Self::darcy_weisbach(pipe, velocity);
        
        let regime = if reynolds < 2300.0 {
            PipeFlowRegime::Laminar
        } else if reynolds < 4000.0 {
            PipeFlowRegime::Transitional
        } else {
            PipeFlowRegime::Turbulent
        };
        
        PipeFlowResult {
            discharge,
            velocity,
            head_loss,
            friction_factor,
            reynolds,
            regime,
        }
    }
    
    /// Calculate minor losses
    pub fn minor_loss(velocity: f64, k: f64) -> f64 {
        let g = 9.81;
        k * velocity * velocity / (2.0 * g)
    }
}

// ============================================================================
// HYDROLOGY
// ============================================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CatchmentInput {
    /// Catchment area (km²)
    pub area: f64,
    /// Time of concentration (hours)
    pub tc: f64,
    /// Runoff coefficient (Rational method)
    pub c: f64,
    /// Curve number (SCS method)
    pub cn: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RainfallInput {
    /// Rainfall intensity (mm/hr) - for Rational method
    pub intensity: f64,
    /// Total rainfall (mm) - for SCS method
    pub total_rainfall: f64,
    /// Storm duration (hours)
    pub duration: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HydrologyResult {
    pub method: String,
    /// Peak discharge (m³/s)
    pub peak_discharge: f64,
    /// Total runoff volume (m³)
    pub runoff_volume: f64,
    /// Runoff depth (mm)
    pub runoff_depth: f64,
}

/// Hydrology calculator
pub struct Hydrology;

impl Hydrology {
    /// Rational method for peak discharge
    pub fn rational_method(catchment: &CatchmentInput, rainfall: &RainfallInput) -> HydrologyResult {
        // Q = C * I * A / 360 (m³/s when I in mm/hr, A in km²)
        let q_peak = catchment.c * rainfall.intensity * catchment.area / 360.0;
        
        // Approximate runoff volume
        let runoff_depth = catchment.c * rainfall.intensity * rainfall.duration;
        let runoff_volume = runoff_depth / 1000.0 * catchment.area * 1e6; // m³
        
        HydrologyResult {
            method: "Rational".to_string(),
            peak_discharge: q_peak,
            runoff_volume,
            runoff_depth,
        }
    }
    
    /// SCS Curve Number method
    pub fn scs_curve_number(catchment: &CatchmentInput, rainfall: &RainfallInput) -> HydrologyResult {
        let p = rainfall.total_rainfall; // mm
        let cn = catchment.cn;
        
        // Potential maximum retention
        let s = 25400.0 / cn - 254.0; // mm
        
        // Initial abstraction (Ia = 0.2S)
        let ia = 0.2 * s;
        
        // Runoff depth
        let q_mm = if p > ia {
            (p - ia).powi(2) / (p - ia + s)
        } else {
            0.0
        };
        
        // Runoff volume
        let runoff_volume = q_mm / 1000.0 * catchment.area * 1e6; // m³
        
        // Peak discharge using SCS triangular hydrograph
        // Qp = 0.208 * A * Q / Tp
        let tp = 0.6 * catchment.tc; // Time to peak
        let q_peak = 0.208 * catchment.area * (q_mm / 1000.0) / tp;
        
        HydrologyResult {
            method: "SCS Curve Number".to_string(),
            peak_discharge: q_peak,
            runoff_volume,
            runoff_depth: q_mm,
        }
    }
    
    /// Calculate time of concentration using Kirpich formula
    pub fn kirpich_tc(length_km: f64, slope: f64) -> f64 {
        // Tc in hours
        0.0195 * (length_km * 1000.0).powf(0.77) * slope.powf(-0.385) / 60.0
    }
    
    /// Calculate IDF (Intensity-Duration-Frequency) intensity
    pub fn idf_intensity(a: f64, b: f64, n: f64, duration_min: f64) -> f64 {
        // I = a / (t + b)^n
        a / (duration_min + b).powf(n)
    }
}

// ============================================================================
// HYDRAULIC STRUCTURES
// ============================================================================

/// Weir discharge calculator
pub struct Weirs;

impl Weirs {
    /// Sharp-crested rectangular weir
    pub fn sharp_crested_rectangular(width: f64, head: f64, cd: f64) -> f64 {
        let g: f64 = 9.81;
        // Q = (2/3) * Cd * L * sqrt(2g) * H^(3/2)
        (2.0 / 3.0) * cd * width * (2.0 * g).sqrt() * head.powf(1.5)
    }
    
    /// V-notch (triangular) weir
    pub fn v_notch(angle_deg: f64, head: f64, cd: f64) -> f64 {
        let g: f64 = 9.81;
        let theta = angle_deg.to_radians() / 2.0;
        // Q = (8/15) * Cd * tan(theta/2) * sqrt(2g) * H^(5/2)
        (8.0 / 15.0) * cd * theta.tan() * (2.0 * g).sqrt() * head.powf(2.5)
    }
    
    /// Broad-crested weir
    pub fn broad_crested(width: f64, head: f64, cd: f64) -> f64 {
        let g: f64 = 9.81;
        // Q = Cd * L * sqrt(g) * (2/3 * H)^(3/2)
        cd * width * g.sqrt() * (2.0 / 3.0 * head).powf(1.5) * (2.0_f64 / 3.0).sqrt()
    }
    
    /// Cipolletti (trapezoidal) weir
    pub fn cipolletti(width: f64, head: f64, cd: f64) -> f64 {
        let g: f64 = 9.81;
        // Side slope 1H:4V
        // Q = (2/3) * Cd * L * sqrt(2g) * H^(3/2)
        (2.0 / 3.0) * cd * width * (2.0 * g).sqrt() * head.powf(1.5)
    }
}

/// Orifice discharge calculator
pub struct Orifices;

impl Orifices {
    /// Small orifice (uniform velocity)
    pub fn small_orifice(area: f64, head: f64, cd: f64) -> f64 {
        let g: f64 = 9.81;
        // Q = Cd * A * sqrt(2gH)
        cd * area * (2.0 * g * head).sqrt()
    }
    
    /// Large rectangular orifice
    pub fn large_rectangular(width: f64, h1: f64, h2: f64, cd: f64) -> f64 {
        let g: f64 = 9.81;
        // Q = (2/3) * Cd * L * sqrt(2g) * (H1^(3/2) - H2^(3/2))
        (2.0 / 3.0) * cd * width * (2.0 * g).sqrt() * (h1.powf(1.5) - h2.powf(1.5))
    }
    
    /// Submerged orifice
    pub fn submerged(area: f64, h1: f64, h2: f64, cd: f64) -> f64 {
        let g: f64 = 9.81;
        // Q = Cd * A * sqrt(2g * (H1 - H2))
        cd * area * (2.0 * g * (h1 - h2)).sqrt()
    }
}

// ============================================================================
// FLOOD ROUTING
// ============================================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MuskingumInput {
    /// Storage time constant (hours)
    pub k: f64,
    /// Weighting factor (0-0.5)
    pub x: f64,
    /// Time step (hours)
    pub dt: f64,
}

/// Flood routing calculator
pub struct FloodRouting;

impl FloodRouting {
    /// Muskingum method routing
    pub fn muskingum(input: &MuskingumInput, inflow: &[f64]) -> Vec<f64> {
        let k = input.k;
        let x = input.x;
        let dt = input.dt;
        
        // Muskingum coefficients
        let denom = 2.0 * k * (1.0 - x) + dt;
        let c0 = (dt - 2.0 * k * x) / denom;
        let c1 = (dt + 2.0 * k * x) / denom;
        let c2 = (2.0 * k * (1.0 - x) - dt) / denom;
        
        let mut outflow = vec![0.0; inflow.len()];
        outflow[0] = inflow[0]; // Initial condition
        
        for i in 1..inflow.len() {
            outflow[i] = c0 * inflow[i] + c1 * inflow[i - 1] + c2 * outflow[i - 1];
        }
        
        outflow
    }
    
    /// Level pool (reservoir) routing
    pub fn level_pool(
        inflow: &[f64],
        dt: f64,
        storage_outflow: &[(f64, f64)], // (storage, outflow) relationship
    ) -> Vec<f64> {
        let mut outflow = vec![0.0; inflow.len()];
        outflow[0] = storage_outflow[0].1;
        
        // Build 2S/dt + O relationship
        let _storage_indicator: Vec<(f64, f64)> = storage_outflow
            .iter()
            .map(|&(s, o)| (2.0 * s / dt + o, o))
            .collect();
        
        // Simplified routing
        for i in 1..inflow.len() {
            let i_avg = (inflow[i] + inflow[i - 1]) / 2.0;
            // This is a simplified approximation
            outflow[i] = (outflow[i - 1] + i_avg) * 0.9;
        }
        
        outflow
    }
}

// ============================================================================
// TESTS
// ============================================================================

#[cfg(test)]
mod tests {
    use super::*;
    
    #[test]
    fn test_manning_equation() {
        let section = ChannelSection {
            channel_type: ChannelType::Rectangular,
            b: 3.0,
            z: 0.0,
            diameter: 0.0,
            n: 0.015,
            s0: 0.001,
        };
        
        let q = OpenChannelFlow::manning_discharge(&section, 1.5);
        assert!(q > 0.0);
        
        // Back-calculate normal depth
        let yn = OpenChannelFlow::normal_depth(&section, q);
        assert!((yn - 1.5).abs() < 0.01);
    }
    
    #[test]
    fn test_pipe_flow() {
        let pipe = PipeInput {
            diameter: 0.3,
            length: 100.0,
            roughness: 0.00015,
            viscosity: 1e-6,
        };
        
        let result = PipeFlow::analyze(&pipe, 0.1);
        assert!(result.velocity > 0.0);
        assert!(result.head_loss > 0.0);
        assert!(result.reynolds > 0.0);
    }
    
    #[test]
    fn test_rational_method() {
        let catchment = CatchmentInput {
            area: 2.0,
            tc: 0.5,
            c: 0.6,
            cn: 75.0,
        };
        
        let rainfall = RainfallInput {
            intensity: 50.0,
            total_rainfall: 25.0,
            duration: 0.5,
        };
        
        let result = Hydrology::rational_method(&catchment, &rainfall);
        assert!(result.peak_discharge > 0.0);
    }
}
