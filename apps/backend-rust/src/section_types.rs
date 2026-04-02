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

