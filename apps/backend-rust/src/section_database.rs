//! # Steel Section Database
//! 
//! Comprehensive database of standard steel sections from major international standards:
//! - **Indian Standard (IS 808)**: ISMB, ISMC, ISLB, ISJB, ISHT, ISA
//! - **American (AISC)**: W, S, HP, C, MC, L, HSS, Pipe
//! - **European (EN 10365)**: IPE, HEA, HEB, HEM, UPN, UPE
//! 
//! ## Features
//! - Static embedded database (no runtime loading)
//! - Section property calculator for custom shapes
//! - Automatic section selection based on capacity requirements
//! - WASM-compatible

use serde::{Deserialize, Serialize};
use std::collections::HashMap;

// ============================================================================
// SECTION TYPES AND STRUCTURES
// ============================================================================

/// Standard organization for sections
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub enum SectionStandard {
    /// Indian Standard (IS 808, IS 1161, IS 4923)
    Indian,
    /// American Institute of Steel Construction
    AISC,
    /// European Standard (EN 10365)
    European,
    /// British Standard
    British,
    /// Custom/User-defined
    Custom,
}

/// Cross-section shape type
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub enum SectionShape {
    /// I-beam / Wide flange (ISMB, W, IPE, HEA)
    IBeam,
    /// Channel section (ISMC, C, UPN)
    Channel,
    /// Angle section (ISA, L)
    Angle,
    /// T-section (ISHT, WT)
    Tee,
    /// Hollow Structural Section - Rectangular
    HSSRect,
    /// Hollow Structural Section - Square
    HSSSquare,
    /// Circular Hollow Section / Pipe
    Pipe,
    /// Solid Rectangle
    SolidRect,
    /// Solid Circle
    SolidCircle,
    /// Built-up section
    BuiltUp,
}

/// Complete steel section with all properties
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SteelSection {
    /// Section designation (e.g., "ISMB 300", "W14x22", "IPE 300")
    pub designation: String,
    
    /// Standard organization
    pub standard: SectionStandard,
    
    /// Cross-section shape
    pub shape: SectionShape,
    
    // ========== DIMENSIONAL PROPERTIES (mm) ==========
    
    /// Overall depth (mm)
    pub d: f64,
    
    /// Flange width (mm) - for I/C/T sections
    pub bf: f64,
    
    /// Web thickness (mm)
    pub tw: f64,
    
    /// Flange thickness (mm)
    pub tf: f64,
    
    /// Root radius / fillet radius (mm)
    pub r: f64,
    
    /// Outer width for HSS (mm)
    pub b: f64,
    
    /// Wall thickness for HSS/Pipe (mm)
    pub t: f64,
    
    // ========== SECTION PROPERTIES ==========
    
    /// Cross-sectional area (mm²)
    pub area: f64,
    
    /// Moment of inertia about major axis X-X (mm⁴) / (cm⁴ in some standards)
    pub ixx: f64,
    
    /// Moment of inertia about minor axis Y-Y (mm⁴)
    pub iyy: f64,
    
    /// Elastic section modulus about X-X (mm³)
    pub zxx: f64,
    
    /// Elastic section modulus about Y-Y (mm³)
    pub zyy: f64,
    
    /// Plastic section modulus about X-X (mm³)
    pub zpxx: f64,
    
    /// Plastic section modulus about Y-Y (mm³)
    pub zpyy: f64,
    
    /// Radius of gyration about X-X (mm)
    pub rxx: f64,
    
    /// Radius of gyration about Y-Y (mm)
    pub ryy: f64,
    
    /// Torsional constant J (mm⁴)
    pub j: f64,
    
    /// Warping constant Cw (mm⁶)
    pub cw: f64,
    
    /// Shear area in Y direction (mm²)
    pub av_y: f64,
    
    /// Shear area in Z direction (mm²)
    pub av_z: f64,
    
    /// Mass per unit length (kg/m)
    pub mass_per_m: f64,
    
    /// Surface area per unit length (m²/m) - for painting
    pub surface_per_m: f64,
}

impl SteelSection {
    /// Create a new section with basic properties (calculates derived)
    pub fn new_i_section(
        designation: &str,
        standard: SectionStandard,
        d: f64,
        bf: f64,
        tw: f64,
        tf: f64,
        r: f64,
    ) -> Self {
        // Calculate section properties
        let area = 2.0 * bf * tf + (d - 2.0 * tf) * tw + 4.0 * (r * r - std::f64::consts::PI * r * r / 4.0);
        
        // Moment of inertia (simplified, ignoring fillets for approximation)
        let ixx = (bf * d.powi(3) - (bf - tw) * (d - 2.0 * tf).powi(3)) / 12.0;
        let iyy = (2.0 * tf * bf.powi(3) + (d - 2.0 * tf) * tw.powi(3)) / 12.0;
        
        let zxx = ixx / (d / 2.0);
        let zyy = iyy / (bf / 2.0);
        
        // Plastic section modulus (approximate)
        let zpxx = bf * tf * (d - tf) + tw * (d - 2.0 * tf).powi(2) / 4.0;
        let zpyy = tf * bf.powi(2) / 2.0 + (d - 2.0 * tf) * tw.powi(2) / 4.0;
        
        let rxx = (ixx / area).sqrt();
        let ryy = (iyy / area).sqrt();
        
        // Torsional constant (approximate for I-section)
        let j = (2.0 * bf * tf.powi(3) + (d - 2.0 * tf) * tw.powi(3)) / 3.0;
        
        // Warping constant
        let cw = iyy * (d - tf).powi(2) / 4.0;
        
        // Shear areas
        let av_y = d * tw;
        let av_z = 2.0 * bf * tf;
        
        // Mass (steel density = 7850 kg/m³)
        let mass_per_m = area * 7850.0 / 1e6;
        
        // Surface area (approximate)
        let surface_per_m = (4.0 * bf + 2.0 * d + 4.0 * (d - 2.0 * tf)) / 1000.0;
        
        Self {
            designation: designation.to_string(),
            standard,
            shape: SectionShape::IBeam,
            d, bf, tw, tf, r,
            b: bf,
            t: tw,
            area, ixx, iyy, zxx, zyy, zpxx, zpyy, rxx, ryy, j, cw,
            av_y, av_z, mass_per_m, surface_per_m,
        }
    }
    
    /// Create channel section
    pub fn new_channel(
        designation: &str,
        standard: SectionStandard,
        d: f64,
        bf: f64,
        tw: f64,
        tf: f64,
    ) -> Self {
        let area = 2.0 * bf * tf + (d - 2.0 * tf) * tw;
        let ixx = (bf * d.powi(3) - (bf - tw) * (d - 2.0 * tf).powi(3)) / 12.0;
        
        // Centroid location from back of web
        let x_bar = (2.0 * bf * tf * bf / 2.0 + (d - 2.0 * tf) * tw * tw / 2.0) / area;
        
        let iyy = 2.0 * (tf * bf.powi(3) / 12.0 + bf * tf * (bf / 2.0 - x_bar).powi(2))
                + (d - 2.0 * tf) * tw.powi(3) / 12.0 + (d - 2.0 * tf) * tw * (x_bar - tw / 2.0).powi(2);
        
        let zxx = ixx / (d / 2.0);
        let zyy = iyy / (bf - x_bar).max(x_bar);
        
        let rxx = (ixx / area).sqrt();
        let ryy = (iyy / area).sqrt();
        
        let j = (2.0 * bf * tf.powi(3) + (d - 2.0 * tf) * tw.powi(3)) / 3.0;
        let mass_per_m = area * 7850.0 / 1e6;
        
        Self {
            designation: designation.to_string(),
            standard,
            shape: SectionShape::Channel,
            d, bf, tw, tf,
            r: 0.0, b: bf, t: tw,
            area, ixx, iyy, zxx, zyy,
            zpxx: zxx * 1.15, zpyy: zyy * 1.1,
            rxx, ryy, j,
            cw: 0.0,
            av_y: d * tw,
            av_z: 2.0 * bf * tf,
            mass_per_m,
            surface_per_m: (2.0 * d + 4.0 * bf) / 1000.0,
        }
    }
    
    /// Create angle section (equal or unequal)
    pub fn new_angle(
        designation: &str,
        standard: SectionStandard,
        a: f64,  // Leg A length
        b: f64,  // Leg B length
        t: f64,  // Thickness
    ) -> Self {
        let area = (a + b - t) * t;
        
        // Centroid from corner
        let x_bar = (a * t * a / 2.0 + (b - t) * t * t / 2.0) / area;
        let y_bar = (b * t * b / 2.0 + (a - t) * t * t / 2.0) / area;
        
        let ixx = t * a.powi(3) / 12.0 + a * t * (a / 2.0 - y_bar).powi(2)
                + (b - t) * t.powi(3) / 12.0 + (b - t) * t * (y_bar - t / 2.0).powi(2);
        let iyy = t * b.powi(3) / 12.0 + b * t * (b / 2.0 - x_bar).powi(2)
                + (a - t) * t.powi(3) / 12.0 + (a - t) * t * (x_bar - t / 2.0).powi(2);
        
        let zxx = ixx / y_bar.max(a - y_bar);
        let zyy = iyy / x_bar.max(b - x_bar);
        
        let rxx = (ixx / area).sqrt();
        let ryy = (iyy / area).sqrt();
        
        let j = (a + b - t) * t.powi(3) / 3.0;
        let mass_per_m = area * 7850.0 / 1e6;
        
        Self {
            designation: designation.to_string(),
            standard,
            shape: SectionShape::Angle,
            d: a, bf: b, tw: t, tf: t,
            r: 0.0, b, t,
            area, ixx, iyy, zxx, zyy,
            zpxx: zxx * 1.5, zpyy: zyy * 1.5,
            rxx, ryy, j,
            cw: 0.0,
            av_y: a * t * 0.6,
            av_z: b * t * 0.6,
            mass_per_m,
            surface_per_m: (2.0 * a + 2.0 * b - 2.0 * t) / 1000.0,
        }
    }
    
    /// Create HSS rectangular section
    pub fn new_hss_rect(
        designation: &str,
        standard: SectionStandard,
        h: f64,  // Height
        b: f64,  // Width
        t: f64,  // Wall thickness
    ) -> Self {
        // Use outer dimensions minus rounded corners
        let r_outer = 2.0 * t;  // Typical corner radius
        let r_inner = t;
        
        let area = 2.0 * ((h - 2.0 * r_outer) * t + (b - 2.0 * r_outer) * t)
                 + std::f64::consts::PI * (r_outer.powi(2) - r_inner.powi(2));
        
        let ixx = (b * h.powi(3) - (b - 2.0 * t) * (h - 2.0 * t).powi(3)) / 12.0;
        let iyy = (h * b.powi(3) - (h - 2.0 * t) * (b - 2.0 * t).powi(3)) / 12.0;
        
        let zxx = ixx / (h / 2.0);
        let zyy = iyy / (b / 2.0);
        
        // Plastic modulus for hollow rectangle
        let zpxx = b * h.powi(2) / 4.0 - (b - 2.0 * t) * (h - 2.0 * t).powi(2) / 4.0;
        let zpyy = h * b.powi(2) / 4.0 - (h - 2.0 * t) * (b - 2.0 * t).powi(2) / 4.0;
        
        let rxx = (ixx / area).sqrt();
        let ryy = (iyy / area).sqrt();
        
        // Torsional constant for hollow rectangle
        let am = (h - t) * (b - t);  // Mean enclosed area
        let pm = 2.0 * ((h - t) + (b - t));  // Mean perimeter
        let j = 4.0 * am.powi(2) * t / pm;
        
        let mass_per_m = area * 7850.0 / 1e6;
        
        Self {
            designation: designation.to_string(),
            standard,
            shape: if (h - b).abs() < 0.1 { SectionShape::HSSSquare } else { SectionShape::HSSRect },
            d: h, bf: b, tw: t, tf: t,
            r: r_outer, b, t,
            area, ixx, iyy, zxx, zyy, zpxx, zpyy, rxx, ryy, j,
            cw: 0.0,  // Warping is negligible for closed sections
            av_y: 2.0 * h * t,
            av_z: 2.0 * b * t,
            mass_per_m,
            surface_per_m: 2.0 * (h + b) / 1000.0,
        }
    }
    
    /// Create circular hollow section (pipe)
    pub fn new_pipe(
        designation: &str,
        standard: SectionStandard,
        d_outer: f64,
        t: f64,
    ) -> Self {
        let d_inner = d_outer - 2.0 * t;
        let area = std::f64::consts::PI * (d_outer.powi(2) - d_inner.powi(2)) / 4.0;
        
        let ixx = std::f64::consts::PI * (d_outer.powi(4) - d_inner.powi(4)) / 64.0;
        let iyy = ixx;  // Symmetric
        
        let zxx = ixx / (d_outer / 2.0);
        let zyy = zxx;
        
        // Plastic modulus for hollow circle
        let zpxx = (d_outer.powi(3) - d_inner.powi(3)) / 6.0;
        let zpyy = zpxx;
        
        let rxx = (ixx / area).sqrt();
        let ryy = rxx;
        
        // Torsional constant (polar moment of inertia)
        let j = 2.0 * ixx;
        
        let mass_per_m = area * 7850.0 / 1e6;
        
        Self {
            designation: designation.to_string(),
            standard,
            shape: SectionShape::Pipe,
            d: d_outer, bf: d_outer, tw: t, tf: t,
            r: d_outer / 2.0, b: d_outer, t,
            area, ixx, iyy, zxx, zyy, zpxx, zpyy, rxx, ryy, j,
            cw: 0.0,
            av_y: area / 2.0,
            av_z: area / 2.0,
            mass_per_m,
            surface_per_m: std::f64::consts::PI * d_outer / 1000.0,
        }
    }
}

// ============================================================================
// INDIAN STANDARD SECTIONS (IS 808)
// ============================================================================

/// Indian Standard Medium Weight Beams (ISMB)
/// Reference: IS 808:1989
pub fn get_ismb_sections() -> Vec<SteelSection> {
    vec![
        // ISMB 100
        SteelSection {
            designation: "ISMB 100".to_string(),
            standard: SectionStandard::Indian,
            shape: SectionShape::IBeam,
            d: 100.0, bf: 75.0, tw: 4.0, tf: 7.2, r: 7.0,
            b: 75.0, t: 4.0,
            area: 1140.0, ixx: 2.57e6, iyy: 0.409e6,
            zxx: 51.4e3, zyy: 10.9e3,
            zpxx: 58.9e3, zpyy: 16.8e3,
            rxx: 47.5, ryy: 18.9,
            j: 1.10e4, cw: 1.24e9,
            av_y: 400.0, av_z: 1080.0,
            mass_per_m: 8.9, surface_per_m: 0.390,
        },
        // ISMB 150
        SteelSection {
            designation: "ISMB 150".to_string(),
            standard: SectionStandard::Indian,
            shape: SectionShape::IBeam,
            d: 150.0, bf: 80.0, tw: 4.8, tf: 7.6, r: 8.0,
            b: 80.0, t: 4.8,
            area: 1550.0, ixx: 7.18e6, iyy: 0.525e6,
            zxx: 95.7e3, zyy: 13.1e3,
            zpxx: 109.0e3, zpyy: 20.3e3,
            rxx: 68.1, ryy: 18.4,
            j: 1.64e4, cw: 4.93e9,
            av_y: 720.0, av_z: 1216.0,
            mass_per_m: 12.2, surface_per_m: 0.470,
        },
        // ISMB 200
        SteelSection {
            designation: "ISMB 200".to_string(),
            standard: SectionStandard::Indian,
            shape: SectionShape::IBeam,
            d: 200.0, bf: 100.0, tw: 5.7, tf: 10.8, r: 11.0,
            b: 100.0, t: 5.7,
            area: 2850.0, ixx: 22.35e6, iyy: 1.50e6,
            zxx: 223.5e3, zyy: 30.0e3,
            zpxx: 254.0e3, zpyy: 46.2e3,
            rxx: 88.6, ryy: 22.9,
            j: 6.32e4, cw: 24.5e9,
            av_y: 1140.0, av_z: 2160.0,
            mass_per_m: 22.4, surface_per_m: 0.610,
        },
        // ISMB 250
        SteelSection {
            designation: "ISMB 250".to_string(),
            standard: SectionStandard::Indian,
            shape: SectionShape::IBeam,
            d: 250.0, bf: 125.0, tw: 6.9, tf: 12.5, r: 12.0,
            b: 125.0, t: 6.9,
            area: 4295.0, ixx: 51.31e6, iyy: 3.34e6,
            zxx: 410.5e3, zyy: 53.4e3,
            zpxx: 466.0e3, zpyy: 82.0e3,
            rxx: 109.3, ryy: 27.9,
            j: 12.8e4, cw: 85.7e9,
            av_y: 1725.0, av_z: 3125.0,
            mass_per_m: 33.7, surface_per_m: 0.760,
        },
        // ISMB 300
        SteelSection {
            designation: "ISMB 300".to_string(),
            standard: SectionStandard::Indian,
            shape: SectionShape::IBeam,
            d: 300.0, bf: 140.0, tw: 7.5, tf: 13.1, r: 14.0,
            b: 140.0, t: 7.5,
            area: 5626.0, ixx: 86.04e6, iyy: 4.54e6,
            zxx: 573.6e3, zyy: 64.8e3,
            zpxx: 651.0e3, zpyy: 99.8e3,
            rxx: 123.7, ryy: 28.4,
            j: 17.0e4, cw: 159.0e9,
            av_y: 2250.0, av_z: 3668.0,
            mass_per_m: 44.2, surface_per_m: 0.890,
        },
        // ISMB 350
        SteelSection {
            designation: "ISMB 350".to_string(),
            standard: SectionStandard::Indian,
            shape: SectionShape::IBeam,
            d: 350.0, bf: 140.0, tw: 8.1, tf: 14.2, r: 14.0,
            b: 140.0, t: 8.1,
            area: 6671.0, ixx: 136.27e6, iyy: 5.37e6,
            zxx: 778.7e3, zyy: 76.7e3,
            zpxx: 886.0e3, zpyy: 118.0e3,
            rxx: 142.9, ryy: 28.4,
            j: 23.8e4, cw: 267.0e9,
            av_y: 2835.0, av_z: 3976.0,
            mass_per_m: 52.4, surface_per_m: 0.990,
        },
        // ISMB 400
        SteelSection {
            designation: "ISMB 400".to_string(),
            standard: SectionStandard::Indian,
            shape: SectionShape::IBeam,
            d: 400.0, bf: 140.0, tw: 8.9, tf: 16.0, r: 14.0,
            b: 140.0, t: 8.9,
            area: 7846.0, ixx: 204.58e6, iyy: 6.22e6,
            zxx: 1022.9e3, zyy: 88.9e3,
            zpxx: 1176.0e3, zpyy: 137.0e3,
            rxx: 161.5, ryy: 28.2,
            j: 34.4e4, cw: 428.0e9,
            av_y: 3560.0, av_z: 4480.0,
            mass_per_m: 61.6, surface_per_m: 1.090,
        },
        // ISMB 450
        SteelSection {
            designation: "ISMB 450".to_string(),
            standard: SectionStandard::Indian,
            shape: SectionShape::IBeam,
            d: 450.0, bf: 150.0, tw: 9.4, tf: 17.4, r: 15.0,
            b: 150.0, t: 9.4,
            area: 9227.0, ixx: 303.87e6, iyy: 8.34e6,
            zxx: 1350.8e3, zyy: 111.2e3,
            zpxx: 1533.0e3, zpyy: 171.0e3,
            rxx: 181.5, ryy: 30.1,
            j: 47.8e4, cw: 714.0e9,
            av_y: 4230.0, av_z: 5220.0,
            mass_per_m: 72.4, surface_per_m: 1.210,
        },
        // ISMB 500
        SteelSection {
            designation: "ISMB 500".to_string(),
            standard: SectionStandard::Indian,
            shape: SectionShape::IBeam,
            d: 500.0, bf: 180.0, tw: 10.2, tf: 17.2, r: 17.0,
            b: 180.0, t: 10.2,
            area: 11074.0, ixx: 452.18e6, iyy: 13.69e6,
            zxx: 1808.7e3, zyy: 152.1e3,
            zpxx: 2074.0e3, zpyy: 234.0e3,
            rxx: 202.1, ryy: 35.2,
            j: 59.5e4, cw: 1370.0e9,
            av_y: 5100.0, av_z: 6192.0,
            mass_per_m: 86.9, surface_per_m: 1.380,
        },
        // ISMB 550
        SteelSection {
            designation: "ISMB 550".to_string(),
            standard: SectionStandard::Indian,
            shape: SectionShape::IBeam,
            d: 550.0, bf: 190.0, tw: 11.2, tf: 19.3, r: 18.0,
            b: 190.0, t: 11.2,
            area: 13208.0, ixx: 648.94e6, iyy: 18.08e6,
            zxx: 2360.0e3, zyy: 190.3e3,
            zpxx: 2711.0e3, zpyy: 293.0e3,
            rxx: 221.7, ryy: 37.0,
            j: 87.3e4, cw: 2200.0e9,
            av_y: 6160.0, av_z: 7334.0,
            mass_per_m: 103.7, surface_per_m: 1.500,
        },
        // ISMB 600
        SteelSection {
            designation: "ISMB 600".to_string(),
            standard: SectionStandard::Indian,
            shape: SectionShape::IBeam,
            d: 600.0, bf: 210.0, tw: 12.0, tf: 20.8, r: 20.0,
            b: 210.0, t: 12.0,
            area: 15621.0, ixx: 918.06e6, iyy: 26.35e6,
            zxx: 3060.2e3, zyy: 250.9e3,
            zpxx: 3510.0e3, zpyy: 386.0e3,
            rxx: 242.4, ryy: 41.1,
            j: 117.0e4, cw: 3650.0e9,
            av_y: 7200.0, av_z: 8736.0,
            mass_per_m: 122.6, surface_per_m: 1.640,
        },
    ]
}

/// Indian Standard Channel Sections (ISMC)
/// Reference: IS 808:1989
pub fn get_ismc_sections() -> Vec<SteelSection> {
    vec![
        SteelSection {
            designation: "ISMC 75".to_string(),
            standard: SectionStandard::Indian,
            shape: SectionShape::Channel,
            d: 75.0, bf: 40.0, tw: 4.4, tf: 7.3, r: 8.0,
            b: 40.0, t: 4.4,
            area: 873.0, ixx: 0.762e6, iyy: 0.126e6,
            zxx: 20.3e3, zyy: 4.66e3,
            zpxx: 23.3e3, zpyy: 7.6e3,
            rxx: 29.5, ryy: 12.0,
            j: 0.65e4, cw: 0.15e9,
            av_y: 330.0, av_z: 584.0,
            mass_per_m: 6.8, surface_per_m: 0.255,
        },
        SteelSection {
            designation: "ISMC 100".to_string(),
            standard: SectionStandard::Indian,
            shape: SectionShape::Channel,
            d: 100.0, bf: 50.0, tw: 5.0, tf: 7.7, r: 8.0,
            b: 50.0, t: 5.0,
            area: 1170.0, ixx: 1.867e6, iyy: 0.262e6,
            zxx: 37.3e3, zyy: 7.71e3,
            zpxx: 42.9e3, zpyy: 12.5e3,
            rxx: 39.9, ryy: 15.0,
            j: 1.12e4, cw: 0.47e9,
            av_y: 500.0, av_z: 770.0,
            mass_per_m: 9.2, surface_per_m: 0.320,
        },
        SteelSection {
            designation: "ISMC 125".to_string(),
            standard: SectionStandard::Indian,
            shape: SectionShape::Channel,
            d: 125.0, bf: 65.0, tw: 5.3, tf: 8.2, r: 9.0,
            b: 65.0, t: 5.3,
            area: 1620.0, ixx: 4.25e6, iyy: 0.60e6,
            zxx: 68.0e3, zyy: 13.4e3,
            zpxx: 78.2e3, zpyy: 21.5e3,
            rxx: 51.2, ryy: 19.2,
            j: 1.76e4, cw: 1.44e9,
            av_y: 663.0, av_z: 1066.0,
            mass_per_m: 12.7, surface_per_m: 0.405,
        },
        SteelSection {
            designation: "ISMC 150".to_string(),
            standard: SectionStandard::Indian,
            shape: SectionShape::Channel,
            d: 150.0, bf: 75.0, tw: 5.7, tf: 9.0, r: 10.0,
            b: 75.0, t: 5.7,
            area: 2090.0, ixx: 7.79e6, iyy: 1.03e6,
            zxx: 103.9e3, zyy: 19.4e3,
            zpxx: 119.5e3, zpyy: 31.3e3,
            rxx: 61.1, ryy: 22.2,
            j: 2.60e4, cw: 3.15e9,
            av_y: 855.0, av_z: 1350.0,
            mass_per_m: 16.4, surface_per_m: 0.480,
        },
        SteelSection {
            designation: "ISMC 200".to_string(),
            standard: SectionStandard::Indian,
            shape: SectionShape::Channel,
            d: 200.0, bf: 75.0, tw: 6.2, tf: 11.4, r: 11.0,
            b: 75.0, t: 6.2,
            area: 2830.0, ixx: 18.19e6, iyy: 1.41e6,
            zxx: 181.9e3, zyy: 25.3e3,
            zpxx: 209.2e3, zpyy: 40.8e3,
            rxx: 80.2, ryy: 22.3,
            j: 5.34e4, cw: 6.89e9,
            av_y: 1240.0, av_z: 1710.0,
            mass_per_m: 22.2, surface_per_m: 0.585,
        },
        SteelSection {
            designation: "ISMC 250".to_string(),
            standard: SectionStandard::Indian,
            shape: SectionShape::Channel,
            d: 250.0, bf: 80.0, tw: 7.2, tf: 14.1, r: 12.0,
            b: 80.0, t: 7.2,
            area: 3867.0, ixx: 38.35e6, iyy: 2.11e6,
            zxx: 306.8e3, zyy: 34.8e3,
            zpxx: 352.8e3, zpyy: 56.2e3,
            rxx: 99.6, ryy: 23.4,
            j: 10.4e4, cw: 15.2e9,
            av_y: 1800.0, av_z: 2256.0,
            mass_per_m: 30.4, surface_per_m: 0.695,
        },
        SteelSection {
            designation: "ISMC 300".to_string(),
            standard: SectionStandard::Indian,
            shape: SectionShape::Channel,
            d: 300.0, bf: 90.0, tw: 7.8, tf: 13.6, r: 13.0,
            b: 90.0, t: 7.8,
            area: 4564.0, ixx: 63.62e6, iyy: 3.10e6,
            zxx: 424.1e3, zyy: 45.1e3,
            zpxx: 487.7e3, zpyy: 72.7e3,
            rxx: 118.1, ryy: 26.1,
            j: 12.4e4, cw: 28.2e9,
            av_y: 2340.0, av_z: 2448.0,
            mass_per_m: 35.8, surface_per_m: 0.810,
        },
        SteelSection {
            designation: "ISMC 400".to_string(),
            standard: SectionStandard::Indian,
            shape: SectionShape::Channel,
            d: 400.0, bf: 100.0, tw: 8.8, tf: 15.3, r: 15.0,
            b: 100.0, t: 8.8,
            area: 6293.0, ixx: 150.54e6, iyy: 5.04e6,
            zxx: 752.7e3, zyy: 65.3e3,
            zpxx: 865.6e3, zpyy: 105.3e3,
            rxx: 154.7, ryy: 28.3,
            j: 22.7e4, cw: 78.1e9,
            av_y: 3520.0, av_z: 3060.0,
            mass_per_m: 49.4, surface_per_m: 1.035,
        },
    ]
}

/// Indian Standard Angle Sections (ISA)
/// Reference: IS 808:1989
pub fn get_isa_sections() -> Vec<SteelSection> {
    vec![
        // Equal Angles
        SteelSection::new_angle("ISA 25x25x3", SectionStandard::Indian, 25.0, 25.0, 3.0),
        SteelSection::new_angle("ISA 25x25x4", SectionStandard::Indian, 25.0, 25.0, 4.0),
        SteelSection::new_angle("ISA 30x30x3", SectionStandard::Indian, 30.0, 30.0, 3.0),
        SteelSection::new_angle("ISA 30x30x4", SectionStandard::Indian, 30.0, 30.0, 4.0),
        SteelSection::new_angle("ISA 35x35x4", SectionStandard::Indian, 35.0, 35.0, 4.0),
        SteelSection::new_angle("ISA 40x40x4", SectionStandard::Indian, 40.0, 40.0, 4.0),
        SteelSection::new_angle("ISA 40x40x5", SectionStandard::Indian, 40.0, 40.0, 5.0),
        SteelSection::new_angle("ISA 45x45x4", SectionStandard::Indian, 45.0, 45.0, 4.0),
        SteelSection::new_angle("ISA 45x45x5", SectionStandard::Indian, 45.0, 45.0, 5.0),
        SteelSection::new_angle("ISA 50x50x5", SectionStandard::Indian, 50.0, 50.0, 5.0),
        SteelSection::new_angle("ISA 50x50x6", SectionStandard::Indian, 50.0, 50.0, 6.0),
        SteelSection::new_angle("ISA 55x55x5", SectionStandard::Indian, 55.0, 55.0, 5.0),
        SteelSection::new_angle("ISA 60x60x5", SectionStandard::Indian, 60.0, 60.0, 5.0),
        SteelSection::new_angle("ISA 60x60x6", SectionStandard::Indian, 60.0, 60.0, 6.0),
        SteelSection::new_angle("ISA 65x65x5", SectionStandard::Indian, 65.0, 65.0, 5.0),
        SteelSection::new_angle("ISA 65x65x6", SectionStandard::Indian, 65.0, 65.0, 6.0),
        SteelSection::new_angle("ISA 70x70x6", SectionStandard::Indian, 70.0, 70.0, 6.0),
        SteelSection::new_angle("ISA 75x75x6", SectionStandard::Indian, 75.0, 75.0, 6.0),
        SteelSection::new_angle("ISA 75x75x8", SectionStandard::Indian, 75.0, 75.0, 8.0),
        SteelSection::new_angle("ISA 80x80x6", SectionStandard::Indian, 80.0, 80.0, 6.0),
        SteelSection::new_angle("ISA 80x80x8", SectionStandard::Indian, 80.0, 80.0, 8.0),
        SteelSection::new_angle("ISA 90x90x6", SectionStandard::Indian, 90.0, 90.0, 6.0),
        SteelSection::new_angle("ISA 90x90x8", SectionStandard::Indian, 90.0, 90.0, 8.0),
        SteelSection::new_angle("ISA 100x100x8", SectionStandard::Indian, 100.0, 100.0, 8.0),
        SteelSection::new_angle("ISA 100x100x10", SectionStandard::Indian, 100.0, 100.0, 10.0),
        SteelSection::new_angle("ISA 110x110x8", SectionStandard::Indian, 110.0, 110.0, 8.0),
        SteelSection::new_angle("ISA 110x110x10", SectionStandard::Indian, 110.0, 110.0, 10.0),
        SteelSection::new_angle("ISA 130x130x10", SectionStandard::Indian, 130.0, 130.0, 10.0),
        SteelSection::new_angle("ISA 150x150x12", SectionStandard::Indian, 150.0, 150.0, 12.0),
        SteelSection::new_angle("ISA 150x150x15", SectionStandard::Indian, 150.0, 150.0, 15.0),
        SteelSection::new_angle("ISA 200x200x16", SectionStandard::Indian, 200.0, 200.0, 16.0),
        
        // Unequal Angles
        SteelSection::new_angle("ISA 30x20x3", SectionStandard::Indian, 30.0, 20.0, 3.0),
        SteelSection::new_angle("ISA 40x25x4", SectionStandard::Indian, 40.0, 25.0, 4.0),
        SteelSection::new_angle("ISA 50x30x4", SectionStandard::Indian, 50.0, 30.0, 4.0),
        SteelSection::new_angle("ISA 60x40x5", SectionStandard::Indian, 60.0, 40.0, 5.0),
        SteelSection::new_angle("ISA 65x45x5", SectionStandard::Indian, 65.0, 45.0, 5.0),
        SteelSection::new_angle("ISA 75x50x6", SectionStandard::Indian, 75.0, 50.0, 6.0),
        SteelSection::new_angle("ISA 80x50x6", SectionStandard::Indian, 80.0, 50.0, 6.0),
        SteelSection::new_angle("ISA 100x65x8", SectionStandard::Indian, 100.0, 65.0, 8.0),
        SteelSection::new_angle("ISA 100x75x8", SectionStandard::Indian, 100.0, 75.0, 8.0),
        SteelSection::new_angle("ISA 125x75x8", SectionStandard::Indian, 125.0, 75.0, 8.0),
        SteelSection::new_angle("ISA 150x75x10", SectionStandard::Indian, 150.0, 75.0, 10.0),
        SteelSection::new_angle("ISA 150x115x10", SectionStandard::Indian, 150.0, 115.0, 10.0),
        SteelSection::new_angle("ISA 200x100x12", SectionStandard::Indian, 200.0, 100.0, 12.0),
        SteelSection::new_angle("ISA 200x150x12", SectionStandard::Indian, 200.0, 150.0, 12.0),
    ]
}

// ============================================================================
// AISC SECTIONS (AMERICAN)
// ============================================================================

/// AISC W-Shapes (Wide Flange Beams)
/// Reference: AISC Shapes Database v15.0
pub fn get_aisc_w_sections() -> Vec<SteelSection> {
    vec![
        // W4 Series
        SteelSection {
            designation: "W4X13".to_string(),
            standard: SectionStandard::AISC,
            shape: SectionShape::IBeam,
            d: 106.2, bf: 104.1, tw: 7.1, tf: 8.8, r: 7.1,
            b: 104.1, t: 7.1,
            area: 2470.0, ixx: 4.71e6, iyy: 1.54e6,
            zxx: 88.8e3, zyy: 29.6e3,
            zpxx: 101.0e3, zpyy: 45.1e3,
            rxx: 43.7, ryy: 25.0,
            j: 2.39e4, cw: 2.84e9,
            av_y: 754.0, av_z: 1832.0,
            mass_per_m: 19.4, surface_per_m: 0.423,
        },
        // W6 Series
        SteelSection {
            designation: "W6X9".to_string(),
            standard: SectionStandard::AISC,
            shape: SectionShape::IBeam,
            d: 149.9, bf: 99.1, tw: 3.8, tf: 5.1, r: 5.1,
            b: 99.1, t: 3.8,
            area: 1160.0, ixx: 3.89e6, iyy: 0.43e6,
            zxx: 51.9e3, zyy: 8.7e3,
            zpxx: 59.3e3, zpyy: 13.4e3,
            rxx: 57.9, ryy: 19.3,
            j: 0.39e4, cw: 1.33e9,
            av_y: 570.0, av_z: 1011.0,
            mass_per_m: 13.4, surface_per_m: 0.498,
        },
        SteelSection {
            designation: "W6X15".to_string(),
            standard: SectionStandard::AISC,
            shape: SectionShape::IBeam,
            d: 152.4, bf: 152.4, tw: 5.8, tf: 6.6, r: 6.6,
            b: 152.4, t: 5.8,
            area: 1940.0, ixx: 6.83e6, iyy: 2.35e6,
            zxx: 89.7e3, zyy: 30.8e3,
            zpxx: 101.0e3, zpyy: 47.2e3,
            rxx: 59.4, ryy: 34.8,
            j: 1.48e4, cw: 7.61e9,
            av_y: 884.0, av_z: 2012.0,
            mass_per_m: 22.3, surface_per_m: 0.612,
        },
        // W8 Series
        SteelSection {
            designation: "W8X18".to_string(),
            standard: SectionStandard::AISC,
            shape: SectionShape::IBeam,
            d: 206.8, bf: 133.4, tw: 5.8, tf: 8.0, r: 8.0,
            b: 133.4, t: 5.8,
            area: 2310.0, ixx: 15.31e6, iyy: 2.03e6,
            zxx: 148.0e3, zyy: 30.4e3,
            zpxx: 166.0e3, zpyy: 46.5e3,
            rxx: 81.4, ryy: 29.6,
            j: 2.47e4, cw: 17.5e9,
            av_y: 1199.0, av_z: 2134.0,
            mass_per_m: 26.8, surface_per_m: 0.683,
        },
        SteelSection {
            designation: "W8X31".to_string(),
            standard: SectionStandard::AISC,
            shape: SectionShape::IBeam,
            d: 203.2, bf: 203.2, tw: 7.2, tf: 11.0, r: 11.0,
            b: 203.2, t: 7.2,
            area: 4000.0, ixx: 27.91e6, iyy: 9.03e6,
            zxx: 274.0e3, zyy: 88.9e3,
            zpxx: 305.0e3, zpyy: 136.0e3,
            rxx: 83.6, ryy: 47.5,
            j: 9.16e4, cw: 75.5e9,
            av_y: 1463.0, av_z: 4470.0,
            mass_per_m: 46.1, surface_per_m: 0.818,
        },
        // W10 Series
        SteelSection {
            designation: "W10X22".to_string(),
            standard: SectionStandard::AISC,
            shape: SectionShape::IBeam,
            d: 256.8, bf: 146.1, tw: 6.1, tf: 9.1, r: 9.1,
            b: 146.1, t: 6.1,
            area: 2850.0, ixx: 31.36e6, iyy: 3.14e6,
            zxx: 244.0e3, zyy: 43.0e3,
            zpxx: 272.0e3, zpyy: 65.9e3,
            rxx: 104.9, ryy: 33.2,
            j: 4.09e4, cw: 52.4e9,
            av_y: 1567.0, av_z: 2659.0,
            mass_per_m: 32.7, surface_per_m: 0.808,
        },
        SteelSection {
            designation: "W10X49".to_string(),
            standard: SectionStandard::AISC,
            shape: SectionShape::IBeam,
            d: 253.5, bf: 254.0, tw: 8.6, tf: 14.2, r: 14.2,
            b: 254.0, t: 8.6,
            area: 6320.0, ixx: 71.02e6, iyy: 24.18e6,
            zxx: 560.0e3, zyy: 190.0e3,
            zpxx: 624.0e3, zpyy: 290.0e3,
            rxx: 106.0, ryy: 61.9,
            j: 27.0e4, cw: 349.0e9,
            av_y: 2180.0, av_z: 7214.0,
            mass_per_m: 72.9, surface_per_m: 1.021,
        },
        // W12 Series
        SteelSection {
            designation: "W12X26".to_string(),
            standard: SectionStandard::AISC,
            shape: SectionShape::IBeam,
            d: 307.8, bf: 165.1, tw: 5.8, tf: 9.7, r: 9.7,
            b: 165.1, t: 5.8,
            area: 3290.0, ixx: 55.62e6, iyy: 4.85e6,
            zxx: 361.0e3, zyy: 58.8e3,
            zpxx: 400.0e3, zpyy: 90.0e3,
            rxx: 130.0, ryy: 38.4,
            j: 5.71e4, cw: 118.0e9,
            av_y: 1785.0, av_z: 3203.0,
            mass_per_m: 38.7, surface_per_m: 0.949,
        },
        SteelSection {
            designation: "W12X53".to_string(),
            standard: SectionStandard::AISC,
            shape: SectionShape::IBeam,
            d: 307.8, bf: 254.0, tw: 8.8, tf: 14.6, r: 14.6,
            b: 254.0, t: 8.8,
            area: 6840.0, ixx: 116.13e6, iyy: 26.11e6,
            zxx: 755.0e3, zyy: 206.0e3,
            zpxx: 841.0e3, zpyy: 314.0e3,
            rxx: 130.3, ryy: 61.8,
            j: 33.3e4, cw: 559.0e9,
            av_y: 2709.0, av_z: 7417.0,
            mass_per_m: 78.9, surface_per_m: 1.128,
        },
        // W14 Series
        SteelSection {
            designation: "W14X22".to_string(),
            standard: SectionStandard::AISC,
            shape: SectionShape::IBeam,
            d: 349.3, bf: 127.0, tw: 5.8, tf: 8.5, r: 8.5,
            b: 127.0, t: 5.8,
            area: 2840.0, ixx: 56.52e6, iyy: 2.29e6,
            zxx: 324.0e3, zyy: 36.0e3,
            zpxx: 366.0e3, zpyy: 55.4e3,
            rxx: 141.0, ryy: 28.4,
            j: 2.94e4, cw: 77.9e9,
            av_y: 2026.0, av_z: 2159.0,
            mass_per_m: 32.7, surface_per_m: 0.954,
        },
        SteelSection {
            designation: "W14X38".to_string(),
            standard: SectionStandard::AISC,
            shape: SectionShape::IBeam,
            d: 358.1, bf: 171.5, tw: 7.9, tf: 13.1, r: 13.1,
            b: 171.5, t: 13.1,
            area: 4900.0, ixx: 115.82e6, iyy: 6.69e6,
            zxx: 647.0e3, zyy: 78.0e3,
            zpxx: 721.0e3, zpyy: 119.0e3,
            rxx: 153.7, ryy: 36.9,
            j: 14.5e4, cw: 251.0e9,
            av_y: 2829.0, av_z: 4493.0,
            mass_per_m: 56.5, surface_per_m: 1.063,
        },
        SteelSection {
            designation: "W14X61".to_string(),
            standard: SectionStandard::AISC,
            shape: SectionShape::IBeam,
            d: 353.1, bf: 254.0, tw: 9.5, tf: 16.4, r: 16.4,
            b: 254.0, t: 9.5,
            area: 7870.0, ixx: 198.03e6, iyy: 28.01e6,
            zxx: 1122.0e3, zyy: 221.0e3,
            zpxx: 1254.0e3, zpyy: 337.0e3,
            rxx: 158.6, ryy: 59.6,
            j: 53.3e4, cw: 834.0e9,
            av_y: 3355.0, av_z: 8331.0,
            mass_per_m: 90.7, surface_per_m: 1.222,
        },
        // W16 Series
        SteelSection {
            designation: "W16X31".to_string(),
            standard: SectionStandard::AISC,
            shape: SectionShape::IBeam,
            d: 403.4, bf: 140.5, tw: 7.0, tf: 11.2, r: 11.2,
            b: 140.5, t: 7.0,
            area: 4000.0, ixx: 109.44e6, iyy: 3.89e6,
            zxx: 543.0e3, zyy: 55.4e3,
            zpxx: 612.0e3, zpyy: 84.9e3,
            rxx: 165.4, ryy: 31.2,
            j: 8.87e4, cw: 239.0e9,
            av_y: 2824.0, av_z: 3147.0,
            mass_per_m: 46.1, surface_per_m: 1.091,
        },
        // W18 Series
        SteelSection {
            designation: "W18X35".to_string(),
            standard: SectionStandard::AISC,
            shape: SectionShape::IBeam,
            d: 450.1, bf: 152.4, tw: 7.6, tf: 10.8, r: 10.8,
            b: 152.4, t: 7.6,
            area: 4520.0, ixx: 158.95e6, iyy: 4.70e6,
            zxx: 706.0e3, zyy: 61.6e3,
            zpxx: 795.0e3, zpyy: 94.5e3,
            rxx: 187.5, ryy: 32.3,
            j: 9.66e4, cw: 384.0e9,
            av_y: 3421.0, av_z: 3292.0,
            mass_per_m: 52.1, surface_per_m: 1.209,
        },
        SteelSection {
            designation: "W18X60".to_string(),
            standard: SectionStandard::AISC,
            shape: SectionShape::IBeam,
            d: 460.2, bf: 190.5, tw: 10.0, tf: 16.1, r: 16.1,
            b: 190.5, t: 10.0,
            area: 7740.0, ixx: 290.67e6, iyy: 14.05e6,
            zxx: 1263.0e3, zyy: 148.0e3,
            zpxx: 1416.0e3, zpyy: 226.0e3,
            rxx: 193.8, ryy: 42.6,
            j: 40.0e4, cw: 1080.0e9,
            av_y: 4602.0, av_z: 6134.0,
            mass_per_m: 89.3, surface_per_m: 1.306,
        },
        // W21 Series
        SteelSection {
            designation: "W21X44".to_string(),
            standard: SectionStandard::AISC,
            shape: SectionShape::IBeam,
            d: 525.0, bf: 165.1, tw: 8.9, tf: 11.4, r: 11.4,
            b: 165.1, t: 8.9,
            area: 5680.0, ixx: 261.59e6, iyy: 6.78e6,
            zxx: 996.0e3, zyy: 82.1e3,
            zpxx: 1118.0e3, zpyy: 126.0e3,
            rxx: 214.6, ryy: 34.5,
            j: 14.6e4, cw: 737.0e9,
            av_y: 4673.0, av_z: 3764.0,
            mass_per_m: 65.5, surface_per_m: 1.384,
        },
        // W24 Series
        SteelSection {
            designation: "W24X55".to_string(),
            standard: SectionStandard::AISC,
            shape: SectionShape::IBeam,
            d: 599.4, bf: 177.8, tw: 10.0, tf: 12.8, r: 12.8,
            b: 177.8, t: 10.0,
            area: 7100.0, ixx: 426.54e6, iyy: 9.20e6,
            zxx: 1423.0e3, zyy: 104.0e3,
            zpxx: 1599.0e3, zpyy: 159.0e3,
            rxx: 245.1, ryy: 36.0,
            j: 20.8e4, cw: 1320.0e9,
            av_y: 5994.0, av_z: 4552.0,
            mass_per_m: 81.9, surface_per_m: 1.559,
        },
        SteelSection {
            designation: "W24X84".to_string(),
            standard: SectionStandard::AISC,
            shape: SectionShape::IBeam,
            d: 612.1, bf: 228.6, tw: 11.9, tf: 19.6, r: 19.6,
            b: 228.6, t: 11.9,
            area: 10900.0, ixx: 707.05e6, iyy: 27.03e6,
            zxx: 2309.0e3, zyy: 237.0e3,
            zpxx: 2587.0e3, zpyy: 362.0e3,
            rxx: 254.8, ryy: 49.8,
            j: 74.1e4, cw: 3290.0e9,
            av_y: 7284.0, av_z: 8961.0,
            mass_per_m: 125.0, surface_per_m: 1.686,
        },
    ]
}

/// AISC HSS Rectangular Sections
pub fn get_aisc_hss_sections() -> Vec<SteelSection> {
    vec![
        SteelSection::new_hss_rect("HSS4X4X1/4", SectionStandard::AISC, 101.6, 101.6, 6.35),
        SteelSection::new_hss_rect("HSS4X4X3/8", SectionStandard::AISC, 101.6, 101.6, 9.53),
        SteelSection::new_hss_rect("HSS4X4X1/2", SectionStandard::AISC, 101.6, 101.6, 12.7),
        SteelSection::new_hss_rect("HSS5X5X1/4", SectionStandard::AISC, 127.0, 127.0, 6.35),
        SteelSection::new_hss_rect("HSS5X5X3/8", SectionStandard::AISC, 127.0, 127.0, 9.53),
        SteelSection::new_hss_rect("HSS6X6X1/4", SectionStandard::AISC, 152.4, 152.4, 6.35),
        SteelSection::new_hss_rect("HSS6X6X3/8", SectionStandard::AISC, 152.4, 152.4, 9.53),
        SteelSection::new_hss_rect("HSS6X6X1/2", SectionStandard::AISC, 152.4, 152.4, 12.7),
        SteelSection::new_hss_rect("HSS8X8X1/4", SectionStandard::AISC, 203.2, 203.2, 6.35),
        SteelSection::new_hss_rect("HSS8X8X3/8", SectionStandard::AISC, 203.2, 203.2, 9.53),
        SteelSection::new_hss_rect("HSS8X8X1/2", SectionStandard::AISC, 203.2, 203.2, 12.7),
        SteelSection::new_hss_rect("HSS10X10X3/8", SectionStandard::AISC, 254.0, 254.0, 9.53),
        SteelSection::new_hss_rect("HSS10X10X1/2", SectionStandard::AISC, 254.0, 254.0, 12.7),
        SteelSection::new_hss_rect("HSS12X12X3/8", SectionStandard::AISC, 304.8, 304.8, 9.53),
        SteelSection::new_hss_rect("HSS12X12X1/2", SectionStandard::AISC, 304.8, 304.8, 12.7),
        // Rectangular (non-square)
        SteelSection::new_hss_rect("HSS6X4X1/4", SectionStandard::AISC, 152.4, 101.6, 6.35),
        SteelSection::new_hss_rect("HSS6X4X3/8", SectionStandard::AISC, 152.4, 101.6, 9.53),
        SteelSection::new_hss_rect("HSS8X4X1/4", SectionStandard::AISC, 203.2, 101.6, 6.35),
        SteelSection::new_hss_rect("HSS8X4X3/8", SectionStandard::AISC, 203.2, 101.6, 9.53),
        SteelSection::new_hss_rect("HSS8X6X1/4", SectionStandard::AISC, 203.2, 152.4, 6.35),
        SteelSection::new_hss_rect("HSS8X6X3/8", SectionStandard::AISC, 203.2, 152.4, 9.53),
        SteelSection::new_hss_rect("HSS10X6X3/8", SectionStandard::AISC, 254.0, 152.4, 9.53),
        SteelSection::new_hss_rect("HSS12X6X3/8", SectionStandard::AISC, 304.8, 152.4, 9.53),
        SteelSection::new_hss_rect("HSS12X8X3/8", SectionStandard::AISC, 304.8, 203.2, 9.53),
    ]
}

/// AISC Pipe Sections
pub fn get_aisc_pipe_sections() -> Vec<SteelSection> {
    vec![
        // Standard (STD)
        SteelSection::new_pipe("PIPE2STD", SectionStandard::AISC, 60.3, 3.91),
        SteelSection::new_pipe("PIPE2-1/2STD", SectionStandard::AISC, 73.0, 5.16),
        SteelSection::new_pipe("PIPE3STD", SectionStandard::AISC, 88.9, 5.49),
        SteelSection::new_pipe("PIPE4STD", SectionStandard::AISC, 114.3, 6.02),
        SteelSection::new_pipe("PIPE5STD", SectionStandard::AISC, 141.3, 6.55),
        SteelSection::new_pipe("PIPE6STD", SectionStandard::AISC, 168.3, 7.11),
        SteelSection::new_pipe("PIPE8STD", SectionStandard::AISC, 219.1, 8.18),
        SteelSection::new_pipe("PIPE10STD", SectionStandard::AISC, 273.1, 9.27),
        SteelSection::new_pipe("PIPE12STD", SectionStandard::AISC, 323.9, 10.31),
        // Extra Strong (XS)
        SteelSection::new_pipe("PIPE2XS", SectionStandard::AISC, 60.3, 5.54),
        SteelSection::new_pipe("PIPE3XS", SectionStandard::AISC, 88.9, 7.62),
        SteelSection::new_pipe("PIPE4XS", SectionStandard::AISC, 114.3, 8.56),
        SteelSection::new_pipe("PIPE6XS", SectionStandard::AISC, 168.3, 10.97),
        SteelSection::new_pipe("PIPE8XS", SectionStandard::AISC, 219.1, 12.70),
        SteelSection::new_pipe("PIPE10XS", SectionStandard::AISC, 273.1, 12.70),
        SteelSection::new_pipe("PIPE12XS", SectionStandard::AISC, 323.9, 12.70),
    ]
}

// ============================================================================
// EUROPEAN SECTIONS (EN 10365)
// ============================================================================

/// European IPE Sections
/// Reference: EN 10365
pub fn get_european_ipe_sections() -> Vec<SteelSection> {
    vec![
        SteelSection {
            designation: "IPE 80".to_string(),
            standard: SectionStandard::European,
            shape: SectionShape::IBeam,
            d: 80.0, bf: 46.0, tw: 3.8, tf: 5.2, r: 5.0,
            b: 46.0, t: 3.8,
            area: 764.0, ixx: 0.801e6, iyy: 0.0849e6,
            zxx: 20.0e3, zyy: 3.69e3,
            zpxx: 23.2e3, zpyy: 5.82e3,
            rxx: 32.4, ryy: 10.5,
            j: 0.70e4, cw: 0.118e9,
            av_y: 304.0, av_z: 478.0,
            mass_per_m: 6.0, surface_per_m: 0.254,
        },
        SteelSection {
            designation: "IPE 100".to_string(),
            standard: SectionStandard::European,
            shape: SectionShape::IBeam,
            d: 100.0, bf: 55.0, tw: 4.1, tf: 5.7, r: 7.0,
            b: 55.0, t: 4.1,
            area: 1030.0, ixx: 1.71e6, iyy: 0.159e6,
            zxx: 34.2e3, zyy: 5.79e3,
            zpxx: 39.4e3, zpyy: 9.15e3,
            rxx: 40.7, ryy: 12.4,
            j: 1.2e4, cw: 0.35e9,
            av_y: 410.0, av_z: 627.0,
            mass_per_m: 8.1, surface_per_m: 0.314,
        },
        SteelSection {
            designation: "IPE 120".to_string(),
            standard: SectionStandard::European,
            shape: SectionShape::IBeam,
            d: 120.0, bf: 64.0, tw: 4.4, tf: 6.3, r: 7.0,
            b: 64.0, t: 4.4,
            area: 1320.0, ixx: 3.18e6, iyy: 0.277e6,
            zxx: 52.9e3, zyy: 8.65e3,
            zpxx: 60.7e3, zpyy: 13.6e3,
            rxx: 49.0, ryy: 14.5,
            j: 1.74e4, cw: 0.89e9,
            av_y: 528.0, av_z: 806.0,
            mass_per_m: 10.4, surface_per_m: 0.374,
        },
        SteelSection {
            designation: "IPE 140".to_string(),
            standard: SectionStandard::European,
            shape: SectionShape::IBeam,
            d: 140.0, bf: 73.0, tw: 4.7, tf: 6.9, r: 7.0,
            b: 73.0, t: 4.7,
            area: 1640.0, ixx: 5.41e6, iyy: 0.449e6,
            zxx: 77.3e3, zyy: 12.3e3,
            zpxx: 88.3e3, zpyy: 19.3e3,
            rxx: 57.4, ryy: 16.5,
            j: 2.45e4, cw: 1.98e9,
            av_y: 658.0, av_z: 1007.0,
            mass_per_m: 12.9, surface_per_m: 0.434,
        },
        SteelSection {
            designation: "IPE 160".to_string(),
            standard: SectionStandard::European,
            shape: SectionShape::IBeam,
            d: 160.0, bf: 82.0, tw: 5.0, tf: 7.4, r: 9.0,
            b: 82.0, t: 5.0,
            area: 2010.0, ixx: 8.69e6, iyy: 0.683e6,
            zxx: 109.0e3, zyy: 16.7e3,
            zpxx: 124.0e3, zpyy: 26.1e3,
            rxx: 65.8, ryy: 18.4,
            j: 3.6e4, cw: 3.96e9,
            av_y: 800.0, av_z: 1213.0,
            mass_per_m: 15.8, surface_per_m: 0.494,
        },
        SteelSection {
            designation: "IPE 180".to_string(),
            standard: SectionStandard::European,
            shape: SectionShape::IBeam,
            d: 180.0, bf: 91.0, tw: 5.3, tf: 8.0, r: 9.0,
            b: 91.0, t: 5.3,
            area: 2390.0, ixx: 13.17e6, iyy: 1.01e6,
            zxx: 146.0e3, zyy: 22.2e3,
            zpxx: 166.0e3, zpyy: 34.6e3,
            rxx: 74.2, ryy: 20.5,
            j: 4.79e4, cw: 7.43e9,
            av_y: 954.0, av_z: 1456.0,
            mass_per_m: 18.8, surface_per_m: 0.554,
        },
        SteelSection {
            designation: "IPE 200".to_string(),
            standard: SectionStandard::European,
            shape: SectionShape::IBeam,
            d: 200.0, bf: 100.0, tw: 5.6, tf: 8.5, r: 12.0,
            b: 100.0, t: 5.6,
            area: 2850.0, ixx: 19.43e6, iyy: 1.42e6,
            zxx: 194.0e3, zyy: 28.5e3,
            zpxx: 221.0e3, zpyy: 44.6e3,
            rxx: 82.6, ryy: 22.4,
            j: 6.98e4, cw: 13.0e9,
            av_y: 1120.0, av_z: 1700.0,
            mass_per_m: 22.4, surface_per_m: 0.614,
        },
        SteelSection {
            designation: "IPE 220".to_string(),
            standard: SectionStandard::European,
            shape: SectionShape::IBeam,
            d: 220.0, bf: 110.0, tw: 5.9, tf: 9.2, r: 12.0,
            b: 110.0, t: 5.9,
            area: 3340.0, ixx: 27.72e6, iyy: 2.05e6,
            zxx: 252.0e3, zyy: 37.3e3,
            zpxx: 285.0e3, zpyy: 58.1e3,
            rxx: 91.1, ryy: 24.8,
            j: 9.07e4, cw: 22.7e9,
            av_y: 1298.0, av_z: 2024.0,
            mass_per_m: 26.2, surface_per_m: 0.674,
        },
        SteelSection {
            designation: "IPE 240".to_string(),
            standard: SectionStandard::European,
            shape: SectionShape::IBeam,
            d: 240.0, bf: 120.0, tw: 6.2, tf: 9.8, r: 15.0,
            b: 120.0, t: 6.2,
            area: 3910.0, ixx: 38.92e6, iyy: 2.84e6,
            zxx: 324.0e3, zyy: 47.3e3,
            zpxx: 367.0e3, zpyy: 73.9e3,
            rxx: 99.7, ryy: 26.9,
            j: 12.9e4, cw: 37.4e9,
            av_y: 1488.0, av_z: 2352.0,
            mass_per_m: 30.7, surface_per_m: 0.734,
        },
        SteelSection {
            designation: "IPE 270".to_string(),
            standard: SectionStandard::European,
            shape: SectionShape::IBeam,
            d: 270.0, bf: 135.0, tw: 6.6, tf: 10.2, r: 15.0,
            b: 135.0, t: 6.6,
            area: 4590.0, ixx: 57.9e6, iyy: 4.20e6,
            zxx: 429.0e3, zyy: 62.2e3,
            zpxx: 484.0e3, zpyy: 97.0e3,
            rxx: 112.3, ryy: 30.2,
            j: 15.9e4, cw: 70.6e9,
            av_y: 1782.0, av_z: 2754.0,
            mass_per_m: 36.1, surface_per_m: 0.825,
        },
        SteelSection {
            designation: "IPE 300".to_string(),
            standard: SectionStandard::European,
            shape: SectionShape::IBeam,
            d: 300.0, bf: 150.0, tw: 7.1, tf: 10.7, r: 15.0,
            b: 150.0, t: 7.1,
            area: 5380.0, ixx: 83.56e6, iyy: 6.04e6,
            zxx: 557.0e3, zyy: 80.5e3,
            zpxx: 628.0e3, zpyy: 125.0e3,
            rxx: 124.6, ryy: 33.5,
            j: 20.1e4, cw: 126.0e9,
            av_y: 2130.0, av_z: 3210.0,
            mass_per_m: 42.2, surface_per_m: 0.915,
        },
        SteelSection {
            designation: "IPE 330".to_string(),
            standard: SectionStandard::European,
            shape: SectionShape::IBeam,
            d: 330.0, bf: 160.0, tw: 7.5, tf: 11.5, r: 18.0,
            b: 160.0, t: 7.5,
            area: 6260.0, ixx: 117.7e6, iyy: 7.88e6,
            zxx: 713.0e3, zyy: 98.5e3,
            zpxx: 804.0e3, zpyy: 154.0e3,
            rxx: 137.1, ryy: 35.5,
            j: 28.2e4, cw: 199.0e9,
            av_y: 2475.0, av_z: 3680.0,
            mass_per_m: 49.1, surface_per_m: 0.996,
        },
        SteelSection {
            designation: "IPE 360".to_string(),
            standard: SectionStandard::European,
            shape: SectionShape::IBeam,
            d: 360.0, bf: 170.0, tw: 8.0, tf: 12.7, r: 18.0,
            b: 170.0, t: 8.0,
            area: 7270.0, ixx: 162.7e6, iyy: 10.43e6,
            zxx: 904.0e3, zyy: 123.0e3,
            zpxx: 1019.0e3, zpyy: 191.0e3,
            rxx: 149.5, ryy: 37.9,
            j: 37.3e4, cw: 314.0e9,
            av_y: 2880.0, av_z: 4318.0,
            mass_per_m: 57.1, surface_per_m: 1.076,
        },
        SteelSection {
            designation: "IPE 400".to_string(),
            standard: SectionStandard::European,
            shape: SectionShape::IBeam,
            d: 400.0, bf: 180.0, tw: 8.6, tf: 13.5, r: 21.0,
            b: 180.0, t: 8.6,
            area: 8450.0, ixx: 231.3e6, iyy: 13.18e6,
            zxx: 1156.0e3, zyy: 146.0e3,
            zpxx: 1307.0e3, zpyy: 229.0e3,
            rxx: 165.5, ryy: 39.5,
            j: 51.1e4, cw: 490.0e9,
            av_y: 3440.0, av_z: 4860.0,
            mass_per_m: 66.3, surface_per_m: 1.176,
        },
        SteelSection {
            designation: "IPE 450".to_string(),
            standard: SectionStandard::European,
            shape: SectionShape::IBeam,
            d: 450.0, bf: 190.0, tw: 9.4, tf: 14.6, r: 21.0,
            b: 190.0, t: 9.4,
            area: 9880.0, ixx: 337.4e6, iyy: 16.76e6,
            zxx: 1500.0e3, zyy: 176.0e3,
            zpxx: 1702.0e3, zpyy: 276.0e3,
            rxx: 184.8, ryy: 41.2,
            j: 66.9e4, cw: 791.0e9,
            av_y: 4230.0, av_z: 5548.0,
            mass_per_m: 77.6, surface_per_m: 1.296,
        },
        SteelSection {
            designation: "IPE 500".to_string(),
            standard: SectionStandard::European,
            shape: SectionShape::IBeam,
            d: 500.0, bf: 200.0, tw: 10.2, tf: 16.0, r: 21.0,
            b: 200.0, t: 10.2,
            area: 11600.0, ixx: 482.0e6, iyy: 21.42e6,
            zxx: 1928.0e3, zyy: 214.0e3,
            zpxx: 2194.0e3, zpyy: 336.0e3,
            rxx: 204.3, ryy: 43.0,
            j: 89.3e4, cw: 1249.0e9,
            av_y: 5100.0, av_z: 6400.0,
            mass_per_m: 90.7, surface_per_m: 1.416,
        },
        SteelSection {
            designation: "IPE 550".to_string(),
            standard: SectionStandard::European,
            shape: SectionShape::IBeam,
            d: 550.0, bf: 210.0, tw: 11.1, tf: 17.2, r: 24.0,
            b: 210.0, t: 11.1,
            area: 13400.0, ixx: 671.2e6, iyy: 26.67e6,
            zxx: 2441.0e3, zyy: 254.0e3,
            zpxx: 2787.0e3, zpyy: 400.0e3,
            rxx: 223.8, ryy: 44.6,
            j: 123.0e4, cw: 1884.0e9,
            av_y: 6105.0, av_z: 7224.0,
            mass_per_m: 105.5, surface_per_m: 1.536,
        },
        SteelSection {
            designation: "IPE 600".to_string(),
            standard: SectionStandard::European,
            shape: SectionShape::IBeam,
            d: 600.0, bf: 220.0, tw: 12.0, tf: 19.0, r: 24.0,
            b: 220.0, t: 12.0,
            area: 15600.0, ixx: 920.8e6, iyy: 33.87e6,
            zxx: 3069.0e3, zyy: 308.0e3,
            zpxx: 3512.0e3, zpyy: 485.0e3,
            rxx: 243.0, ryy: 46.6,
            j: 165.0e4, cw: 2846.0e9,
            av_y: 7200.0, av_z: 8360.0,
            mass_per_m: 122.4, surface_per_m: 1.656,
        },
    ]
}

/// European HEA Sections (Wide Flange, Light)
pub fn get_european_hea_sections() -> Vec<SteelSection> {
    vec![
        SteelSection {
            designation: "HEA 100".to_string(),
            standard: SectionStandard::European,
            shape: SectionShape::IBeam,
            d: 96.0, bf: 100.0, tw: 5.0, tf: 8.0, r: 12.0,
            b: 100.0, t: 5.0,
            area: 2120.0, ixx: 3.49e6, iyy: 1.34e6,
            zxx: 72.8e3, zyy: 26.8e3,
            zpxx: 83.0e3, zpyy: 41.1e3,
            rxx: 40.6, ryy: 25.1,
            j: 5.24e4, cw: 4.07e9,
            av_y: 480.0, av_z: 1600.0,
            mass_per_m: 16.7, surface_per_m: 0.402,
        },
        SteelSection {
            designation: "HEA 120".to_string(),
            standard: SectionStandard::European,
            shape: SectionShape::IBeam,
            d: 114.0, bf: 120.0, tw: 5.0, tf: 8.0, r: 12.0,
            b: 120.0, t: 5.0,
            area: 2530.0, ixx: 6.06e6, iyy: 2.31e6,
            zxx: 106.0e3, zyy: 38.5e3,
            zpxx: 119.0e3, zpyy: 58.9e3,
            rxx: 48.9, ryy: 30.2,
            j: 5.99e4, cw: 8.91e9,
            av_y: 570.0, av_z: 1920.0,
            mass_per_m: 19.9, surface_per_m: 0.482,
        },
        SteelSection {
            designation: "HEA 140".to_string(),
            standard: SectionStandard::European,
            shape: SectionShape::IBeam,
            d: 133.0, bf: 140.0, tw: 5.5, tf: 8.5, r: 12.0,
            b: 140.0, t: 5.5,
            area: 3140.0, ixx: 10.33e6, iyy: 3.89e6,
            zxx: 155.0e3, zyy: 55.6e3,
            zpxx: 173.0e3, zpyy: 84.9e3,
            rxx: 57.3, ryy: 35.2,
            j: 8.13e4, cw: 18.5e9,
            av_y: 732.0, av_z: 2380.0,
            mass_per_m: 24.7, surface_per_m: 0.562,
        },
        SteelSection {
            designation: "HEA 160".to_string(),
            standard: SectionStandard::European,
            shape: SectionShape::IBeam,
            d: 152.0, bf: 160.0, tw: 6.0, tf: 9.0, r: 15.0,
            b: 160.0, t: 6.0,
            area: 3880.0, ixx: 16.73e6, iyy: 6.16e6,
            zxx: 220.0e3, zyy: 76.9e3,
            zpxx: 245.0e3, zpyy: 117.0e3,
            rxx: 65.7, ryy: 39.8,
            j: 12.2e4, cw: 33.0e9,
            av_y: 912.0, av_z: 2880.0,
            mass_per_m: 30.4, surface_per_m: 0.642,
        },
        SteelSection {
            designation: "HEA 180".to_string(),
            standard: SectionStandard::European,
            shape: SectionShape::IBeam,
            d: 171.0, bf: 180.0, tw: 6.0, tf: 9.5, r: 15.0,
            b: 180.0, t: 6.0,
            area: 4530.0, ixx: 25.1e6, iyy: 9.25e6,
            zxx: 294.0e3, zyy: 103.0e3,
            zpxx: 325.0e3, zpyy: 157.0e3,
            rxx: 74.5, ryy: 45.2,
            j: 14.8e4, cw: 60.2e9,
            av_y: 1026.0, av_z: 3420.0,
            mass_per_m: 35.5, surface_per_m: 0.722,
        },
        SteelSection {
            designation: "HEA 200".to_string(),
            standard: SectionStandard::European,
            shape: SectionShape::IBeam,
            d: 190.0, bf: 200.0, tw: 6.5, tf: 10.0, r: 18.0,
            b: 200.0, t: 6.5,
            area: 5380.0, ixx: 36.92e6, iyy: 13.36e6,
            zxx: 389.0e3, zyy: 134.0e3,
            zpxx: 430.0e3, zpyy: 204.0e3,
            rxx: 82.8, ryy: 49.8,
            j: 21.0e4, cw: 108.0e9,
            av_y: 1235.0, av_z: 4000.0,
            mass_per_m: 42.3, surface_per_m: 0.802,
        },
        SteelSection {
            designation: "HEA 220".to_string(),
            standard: SectionStandard::European,
            shape: SectionShape::IBeam,
            d: 210.0, bf: 220.0, tw: 7.0, tf: 11.0, r: 18.0,
            b: 220.0, t: 7.0,
            area: 6430.0, ixx: 54.1e6, iyy: 19.54e6,
            zxx: 515.0e3, zyy: 178.0e3,
            zpxx: 568.0e3, zpyy: 271.0e3,
            rxx: 91.7, ryy: 55.1,
            j: 28.5e4, cw: 193.0e9,
            av_y: 1470.0, av_z: 4840.0,
            mass_per_m: 50.5, surface_per_m: 0.882,
        },
        SteelSection {
            designation: "HEA 240".to_string(),
            standard: SectionStandard::European,
            shape: SectionShape::IBeam,
            d: 230.0, bf: 240.0, tw: 7.5, tf: 12.0, r: 21.0,
            b: 240.0, t: 7.5,
            area: 7680.0, ixx: 77.63e6, iyy: 27.69e6,
            zxx: 675.0e3, zyy: 231.0e3,
            zpxx: 745.0e3, zpyy: 352.0e3,
            rxx: 100.5, ryy: 60.0,
            j: 41.6e4, cw: 328.0e9,
            av_y: 1725.0, av_z: 5760.0,
            mass_per_m: 60.3, surface_per_m: 0.962,
        },
        SteelSection {
            designation: "HEA 260".to_string(),
            standard: SectionStandard::European,
            shape: SectionShape::IBeam,
            d: 250.0, bf: 260.0, tw: 7.5, tf: 12.5, r: 24.0,
            b: 260.0, t: 7.5,
            area: 8680.0, ixx: 104.5e6, iyy: 36.73e6,
            zxx: 836.0e3, zyy: 282.0e3,
            zpxx: 920.0e3, zpyy: 430.0e3,
            rxx: 109.7, ryy: 65.1,
            j: 52.4e4, cw: 527.0e9,
            av_y: 1875.0, av_z: 6500.0,
            mass_per_m: 68.2, surface_per_m: 1.042,
        },
        SteelSection {
            designation: "HEA 280".to_string(),
            standard: SectionStandard::European,
            shape: SectionShape::IBeam,
            d: 270.0, bf: 280.0, tw: 8.0, tf: 13.0, r: 24.0,
            b: 280.0, t: 8.0,
            area: 9730.0, ixx: 136.7e6, iyy: 47.59e6,
            zxx: 1013.0e3, zyy: 340.0e3,
            zpxx: 1112.0e3, zpyy: 518.0e3,
            rxx: 118.5, ryy: 69.9,
            j: 62.1e4, cw: 805.0e9,
            av_y: 2160.0, av_z: 7280.0,
            mass_per_m: 76.4, surface_per_m: 1.122,
        },
        SteelSection {
            designation: "HEA 300".to_string(),
            standard: SectionStandard::European,
            shape: SectionShape::IBeam,
            d: 290.0, bf: 300.0, tw: 8.5, tf: 14.0, r: 27.0,
            b: 300.0, t: 8.5,
            area: 11300.0, ixx: 182.6e6, iyy: 63.12e6,
            zxx: 1260.0e3, zyy: 421.0e3,
            zpxx: 1383.0e3, zpyy: 641.0e3,
            rxx: 127.2, ryy: 74.7,
            j: 85.0e4, cw: 1308.0e9,
            av_y: 2465.0, av_z: 8400.0,
            mass_per_m: 88.3, surface_per_m: 1.202,
        },
    ]
}

// ============================================================================
// SECTION DATABASE MANAGER
// ============================================================================

/// Unified section database with query capabilities
pub struct SectionDatabase {
    sections: HashMap<String, SteelSection>,
    by_standard: HashMap<SectionStandard, Vec<String>>,
    by_shape: HashMap<SectionShape, Vec<String>>,
}

impl SectionDatabase {
    /// Create a new section database with all standard sections
    pub fn new() -> Self {
        let mut db = SectionDatabase {
            sections: HashMap::new(),
            by_standard: HashMap::new(),
            by_shape: HashMap::new(),
        };
        
        // Load all sections
        for section in get_ismb_sections() {
            db.add_section(section);
        }
        for section in get_ismc_sections() {
            db.add_section(section);
        }
        for section in get_isa_sections() {
            db.add_section(section);
        }
        for section in get_aisc_w_sections() {
            db.add_section(section);
        }
        for section in get_aisc_hss_sections() {
            db.add_section(section);
        }
        for section in get_aisc_pipe_sections() {
            db.add_section(section);
        }
        for section in get_european_ipe_sections() {
            db.add_section(section);
        }
        for section in get_european_hea_sections() {
            db.add_section(section);
        }
        
        db
    }
    
    /// Add a section to the database
    pub fn add_section(&mut self, section: SteelSection) {
        let name = section.designation.clone();
        let standard = section.standard;
        let shape = section.shape;
        
        self.sections.insert(name.clone(), section);
        
        self.by_standard
            .entry(standard)
            .or_insert_with(Vec::new)
            .push(name.clone());
        
        self.by_shape
            .entry(shape)
            .or_insert_with(Vec::new)
            .push(name);
    }
    
    /// Get a section by designation
    pub fn get(&self, designation: &str) -> Option<&SteelSection> {
        self.sections.get(designation)
    }
    
    /// Get all sections by standard
    pub fn get_by_standard(&self, standard: SectionStandard) -> Vec<&SteelSection> {
        self.by_standard
            .get(&standard)
            .map(|names| {
                names.iter()
                    .filter_map(|n| self.sections.get(n))
                    .collect()
            })
            .unwrap_or_default()
    }
    
    /// Get all sections by shape
    pub fn get_by_shape(&self, shape: SectionShape) -> Vec<&SteelSection> {
        self.by_shape
            .get(&shape)
            .map(|names| {
                names.iter()
                    .filter_map(|n| self.sections.get(n))
                    .collect()
            })
            .unwrap_or_default()
    }
    
    /// Find sections with sufficient moment capacity
    pub fn find_by_moment_capacity(&self, required_zxx: f64, standard: Option<SectionStandard>) -> Vec<&SteelSection> {
        self.sections.values()
            .filter(|s| {
                s.zxx >= required_zxx && 
                standard.map_or(true, |std| s.standard == std)
            })
            .collect()
    }
    
    /// Find the most economical section for given requirements
    pub fn select_optimal(
        &self,
        required_zxx: f64,
        max_depth: Option<f64>,
        standard: Option<SectionStandard>,
        shape: Option<SectionShape>,
    ) -> Option<&SteelSection> {
        self.sections.values()
            .filter(|s| {
                s.zxx >= required_zxx &&
                max_depth.map_or(true, |d| s.d <= d) &&
                standard.map_or(true, |std| s.standard == std) &&
                shape.map_or(true, |sh| s.shape == sh)
            })
            .min_by(|a, b| {
                a.mass_per_m.partial_cmp(&b.mass_per_m).unwrap_or(std::cmp::Ordering::Equal)
            })
    }
    
    /// Get total section count
    pub fn count(&self) -> usize {
        self.sections.len()
    }
    
    /// List all section designations
    pub fn list_all(&self) -> Vec<&str> {
        self.sections.keys().map(|s| s.as_str()).collect()
    }
}

impl Default for SectionDatabase {
    fn default() -> Self {
        Self::new()
    }
}

// ============================================================================
// TESTS
// ============================================================================

#[cfg(test)]
mod tests {
    use super::*;
    
    #[test]
    fn test_section_database_creation() {
        let db = SectionDatabase::new();
        assert!(db.count() > 100, "Should have 100+ sections");
        println!("Total sections in database: {}", db.count());
    }
    
    #[test]
    fn test_get_ismb_section() {
        let db = SectionDatabase::new();
        let ismb300 = db.get("ISMB 300").expect("ISMB 300 should exist");
        assert_eq!(ismb300.d, 300.0);
        assert_eq!(ismb300.standard, SectionStandard::Indian);
        println!("ISMB 300: Area={} mm², Ixx={:.2e} mm⁴", ismb300.area, ismb300.ixx);
    }
    
    #[test]
    fn test_get_aisc_section() {
        let db = SectionDatabase::new();
        let w14 = db.get("W14X22").expect("W14X22 should exist");
        assert_eq!(w14.standard, SectionStandard::AISC);
        println!("W14X22: Area={} mm², Zxx={:.2e} mm³", w14.area, w14.zxx);
    }
    
    #[test]
    fn test_get_ipe_section() {
        let db = SectionDatabase::new();
        let ipe300 = db.get("IPE 300").expect("IPE 300 should exist");
        assert_eq!(ipe300.d, 300.0);
        assert_eq!(ipe300.standard, SectionStandard::European);
        println!("IPE 300: Area={} mm², Ixx={:.2e} mm⁴", ipe300.area, ipe300.ixx);
    }
    
    #[test]
    fn test_sections_by_standard() {
        let db = SectionDatabase::new();
        
        let indian = db.get_by_standard(SectionStandard::Indian);
        let aisc = db.get_by_standard(SectionStandard::AISC);
        let european = db.get_by_standard(SectionStandard::European);
        
        println!("Indian sections: {}", indian.len());
        println!("AISC sections: {}", aisc.len());
        println!("European sections: {}", european.len());
        
        assert!(indian.len() > 50, "Should have 50+ Indian sections");
        assert!(aisc.len() > 30, "Should have 30+ AISC sections");
        assert!(european.len() > 20, "Should have 20+ European sections");
    }
    
    #[test]
    fn test_optimal_section_selection() {
        let db = SectionDatabase::new();
        
        // Need Zxx >= 500e3 mm³ for a beam
        let required_zxx = 500e3;
        
        let optimal = db.select_optimal(
            required_zxx,
            Some(400.0),  // Max depth 400mm
            Some(SectionStandard::Indian),
            Some(SectionShape::IBeam),
        );
        
        if let Some(section) = optimal {
            println!("Optimal section: {} (Zxx={:.0e}, mass={:.1} kg/m)", 
                     section.designation, section.zxx, section.mass_per_m);
            assert!(section.zxx >= required_zxx);
            assert!(section.d <= 400.0);
        }
    }
    
    #[test]
    fn test_hss_section() {
        let db = SectionDatabase::new();
        let hss = db.get("HSS6X6X3/8").expect("HSS6X6X3/8 should exist");
        assert_eq!(hss.shape, SectionShape::HSSSquare);
        println!("HSS6X6X3/8: Area={:.0} mm², J={:.2e} mm⁴", hss.area, hss.j);
    }
    
    #[test]
    fn test_pipe_section() {
        let db = SectionDatabase::new();
        let pipe = db.get("PIPE6STD").expect("PIPE6STD should exist");
        assert_eq!(pipe.shape, SectionShape::Pipe);
        println!("PIPE6STD: OD={:.1} mm, t={:.2} mm", pipe.d, pipe.t);
    }
    
    #[test]
    fn test_angle_section() {
        let db = SectionDatabase::new();
        let angle = db.get("ISA 100x100x10").expect("ISA 100x100x10 should exist");
        assert_eq!(angle.shape, SectionShape::Angle);
        println!("ISA 100x100x10: Area={:.0} mm², rxx={:.1} mm", angle.area, angle.rxx);
    }
}
