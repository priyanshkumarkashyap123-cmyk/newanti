//! # Custom Section Designer
//!
//! Advanced section property calculator for arbitrary 2D polygons.
//! Transferred from Python `analysis/section_designer.py`.
//!
//! Calculates: Area, Centroid, Ixx, Iyy, Ixy, Zxx, Zyy, rxx, ryy,
//! principal moments, plastic modulus, weight per meter.
//!
//! Supports:
//! - Arbitrary polygon cross-sections (user-drawn shapes)
//! - Standard shapes: I-beam, box, channel, angle, tee, circular
//! - Composite sections (transformed section method)
//! - Built-up / plate girder sections
//!
//! ## Mathematical Basis
//! - Shoelace formula for signed area
//! - Green's theorem for centroid coordinates
//! - Second moment of area via polygon vertex integration
//! - Principal axis rotation via Mohr's circle

use serde::{Deserialize, Serialize};
use std::f64::consts::PI;

// ============================================================================
// DATA STRUCTURES
// ============================================================================

/// A 2D point in the section coordinate system (mm)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Point2D {
    pub x: f64,
    pub y: f64,
}

/// Complete set of calculated section properties
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SectionProperties {
    pub designation: String,
    /// Cross-sectional area (mm²)
    pub area: f64,
    /// Centroid X-coordinate (mm)
    pub centroid_x: f64,
    /// Centroid Y-coordinate (mm)
    pub centroid_y: f64,
    /// Second moment of area about X-axis through centroid (mm⁴)
    pub ixx: f64,
    /// Second moment of area about Y-axis through centroid (mm⁴)
    pub iyy: f64,
    /// Product of inertia about centroidal axes (mm⁴)
    pub ixy: f64,
    /// Elastic section modulus about X-axis (mm³)
    pub zxx: f64,
    /// Elastic section modulus about Y-axis (mm³)
    pub zyy: f64,
    /// Plastic section modulus about X-axis (mm³) — approximate
    pub zpxx: f64,
    /// Plastic section modulus about Y-axis (mm³) — approximate
    pub zpyy: f64,
    /// Radius of gyration about X-axis (mm)
    pub rxx: f64,
    /// Radius of gyration about Y-axis (mm)
    pub ryy: f64,
    /// Major principal moment of inertia (mm⁴)
    pub i1: f64,
    /// Minor principal moment of inertia (mm⁴)
    pub i2: f64,
    /// Principal axis angle (degrees)
    pub principal_angle_deg: f64,
    /// Weight per meter length (kg/m)
    pub weight_per_meter: f64,
}

// ============================================================================
// CORE GEOMETRY CALCULATIONS
// ============================================================================

/// Calculate signed area of a closed polygon (positive for CCW)
///
/// Uses the Shoelace formula: A = Σ(xi·yi+1 − xi+1·yi) / 2
fn signed_area(pts: &[Point2D]) -> f64 {
    let n = pts.len();
    if n < 3 { return 0.0; }
    let mut a = 0.0;
    for i in 0..n {
        let j = (i + 1) % n;
        a += pts[i].x * pts[j].y - pts[j].x * pts[i].y;
    }
    a / 2.0
}

/// Calculate centroid of a closed polygon using Green's theorem
///
/// cx = Σ(xi + xi+1)(xi·yi+1 − xi+1·yi) / (6A)
/// cy = Σ(yi + yi+1)(xi·yi+1 − xi+1·yi) / (6A)
fn centroid(pts: &[Point2D]) -> (f64, f64) {
    let a = signed_area(pts).abs();
    if a < 1e-12 { return (0.0, 0.0); }
    let n = pts.len();
    let (mut cx, mut cy) = (0.0, 0.0);
    for i in 0..n {
        let j = (i + 1) % n;
        let cross = pts[i].x * pts[j].y - pts[j].x * pts[i].y;
        cx += (pts[i].x + pts[j].x) * cross;
        cy += (pts[i].y + pts[j].y) * cross;
    }
    cx /= 6.0 * a;
    cy /= 6.0 * a;
    (cx, cy)
}

/// Calculate second moments of area (Ixx, Iyy, Ixy) about centroid
///
/// Uses vertex integration formulas for closed polygons.
fn second_moments(pts: &[Point2D], cx: f64, cy: f64) -> (f64, f64, f64) {
    let n = pts.len();
    let (mut ixx, mut iyy, mut ixy) = (0.0, 0.0, 0.0);

    for i in 0..n {
        let j = (i + 1) % n;
        let x1 = pts[i].x - cx;
        let y1 = pts[i].y - cy;
        let x2 = pts[j].x - cx;
        let y2 = pts[j].y - cy;
        let cross = x1 * y2 - x2 * y1;

        ixx += (y1 * y1 + y1 * y2 + y2 * y2) * cross;
        iyy += (x1 * x1 + x1 * x2 + x2 * x2) * cross;
        ixy += (x1 * y2 + 2.0 * x1 * y1 + 2.0 * x2 * y2 + x2 * y1) * cross;
    }

    (ixx.abs() / 12.0, iyy.abs() / 12.0, ixy.abs() / 24.0)
}

// ============================================================================
// PUBLIC API
// ============================================================================

/// Calculate all section properties for an arbitrary polygon
///
/// # Arguments
/// * `points` — Vertices defining the section boundary (CCW order)
/// * `name` — Designation string
/// * `material_density` — Material density in kg/m³ (default 7850 for steel)
///
/// # Returns
/// Complete `SectionProperties` struct
pub fn calculate_section_properties(
    points: &[Point2D],
    name: &str,
    material_density: f64,
) -> SectionProperties {
    let area = signed_area(points).abs();
    let (cx, cy) = centroid(points);
    let (ixx, iyy, ixy) = second_moments(points, cx, cy);

    // Extreme fiber distances from centroid
    let y_max = points.iter().map(|p| (p.y - cy).abs()).fold(0.0_f64, f64::max);
    let x_max = points.iter().map(|p| (p.x - cx).abs()).fold(0.0_f64, f64::max);

    let zxx = if y_max > 1e-6 { ixx / y_max } else { 0.0 };
    let zyy = if x_max > 1e-6 { iyy / x_max } else { 0.0 };

    // Plastic modulus approximation (Zp ≈ 1.15 × Ze for I-sections)
    let zpxx = zxx * 1.15;
    let zpyy = zyy * 1.15;

    // Radii of gyration
    let rxx = if area > 1e-6 { (ixx / area).sqrt() } else { 0.0 };
    let ryy = if area > 1e-6 { (iyy / area).sqrt() } else { 0.0 };

    // Principal moments (Mohr's circle)
    let i_avg = (ixx + iyy) / 2.0;
    let i_diff = (ixx - iyy) / 2.0;
    let r = (i_diff * i_diff + ixy * ixy).sqrt();
    let i1 = i_avg + r;
    let i2 = i_avg - r;
    let angle_deg = if (ixx - iyy).abs() < 1e-6 {
        if ixy > 0.0 { 45.0 } else { 0.0 }
    } else {
        0.5 * (2.0 * ixy).atan2(ixx - iyy) * 180.0 / PI
    };

    // Weight per meter (mm² → m² → kg/m)
    let weight = area * 1e-6 * material_density;

    SectionProperties {
        designation: name.to_string(),
        area,
        centroid_x: cx,
        centroid_y: cy,
        ixx,
        iyy,
        ixy,
        zxx,
        zyy,
        zpxx,
        zpyy,
        rxx,
        ryy,
        i1,
        i2,
        principal_angle_deg: angle_deg,
        weight_per_meter: weight,
    }
}

// ============================================================================
// STANDARD SHAPES — Pre-defined section generators
// ============================================================================

/// Create I-beam section vertices
pub fn i_beam_points(depth: f64, width: f64, web_thick: f64, flange_thick: f64) -> Vec<Point2D> {
    let (d, bf, tw, tf) = (depth, width, web_thick, flange_thick);
    vec![
        Point2D { x: -bf / 2.0, y: -d / 2.0 },
        Point2D { x: bf / 2.0, y: -d / 2.0 },
        Point2D { x: bf / 2.0, y: -d / 2.0 + tf },
        Point2D { x: tw / 2.0, y: -d / 2.0 + tf },
        Point2D { x: tw / 2.0, y: d / 2.0 - tf },
        Point2D { x: bf / 2.0, y: d / 2.0 - tf },
        Point2D { x: bf / 2.0, y: d / 2.0 },
        Point2D { x: -bf / 2.0, y: d / 2.0 },
        Point2D { x: -bf / 2.0, y: d / 2.0 - tf },
        Point2D { x: -tw / 2.0, y: d / 2.0 - tf },
        Point2D { x: -tw / 2.0, y: -d / 2.0 + tf },
        Point2D { x: -bf / 2.0, y: -d / 2.0 + tf },
    ]
}

/// Create channel section (C-shape) vertices
pub fn channel_points(depth: f64, width: f64, web_thick: f64, flange_thick: f64) -> Vec<Point2D> {
    let (d, bf, tw, tf) = (depth, width, web_thick, flange_thick);
    vec![
        Point2D { x: 0.0, y: -d / 2.0 },
        Point2D { x: bf, y: -d / 2.0 },
        Point2D { x: bf, y: -d / 2.0 + tf },
        Point2D { x: tw, y: -d / 2.0 + tf },
        Point2D { x: tw, y: d / 2.0 - tf },
        Point2D { x: bf, y: d / 2.0 - tf },
        Point2D { x: bf, y: d / 2.0 },
        Point2D { x: 0.0, y: d / 2.0 },
    ]
}

/// Create angle section (L-shape) vertices
pub fn angle_points(leg1: f64, leg2: f64, thickness: f64) -> Vec<Point2D> {
    vec![
        Point2D { x: 0.0, y: 0.0 },
        Point2D { x: leg1, y: 0.0 },
        Point2D { x: leg1, y: thickness },
        Point2D { x: thickness, y: thickness },
        Point2D { x: thickness, y: leg2 },
        Point2D { x: 0.0, y: leg2 },
    ]
}

/// Create rectangular section vertices
pub fn rectangular_points(width: f64, depth: f64) -> Vec<Point2D> {
    vec![
        Point2D { x: -width / 2.0, y: -depth / 2.0 },
        Point2D { x: width / 2.0, y: -depth / 2.0 },
        Point2D { x: width / 2.0, y: depth / 2.0 },
        Point2D { x: -width / 2.0, y: depth / 2.0 },
    ]
}

/// Create circular section vertices (approximated by polygon)
pub fn circular_points(diameter: f64, segments: usize) -> Vec<Point2D> {
    let r = diameter / 2.0;
    let n = segments.max(16);
    (0..n)
        .map(|i| {
            let angle = 2.0 * PI * (i as f64) / (n as f64);
            Point2D {
                x: r * angle.cos(),
                y: r * angle.sin(),
            }
        })
        .collect()
}

/// Create T-section vertices
pub fn tee_points(width: f64, depth: f64, web_thick: f64, flange_thick: f64) -> Vec<Point2D> {
    let (bf, d, tw, tf) = (width, depth, web_thick, flange_thick);
    vec![
        Point2D { x: -bf / 2.0, y: 0.0 },
        Point2D { x: bf / 2.0, y: 0.0 },
        Point2D { x: bf / 2.0, y: tf },
        Point2D { x: tw / 2.0, y: tf },
        Point2D { x: tw / 2.0, y: d },
        Point2D { x: -tw / 2.0, y: d },
        Point2D { x: -tw / 2.0, y: tf },
        Point2D { x: -bf / 2.0, y: tf },
    ]
}

/// Create built-up I-section (plate girder) vertices
pub fn built_up_i_points(
    depth: f64,
    top_width: f64,
    bot_width: f64,
    web_thick: f64,
    top_thick: f64,
    bot_thick: f64,
) -> Vec<Point2D> {
    let (d, bft, bfb, tw, tft, tfb) = (depth, top_width, bot_width, web_thick, top_thick, bot_thick);
    let y_bot = -d / 2.0;
    let y_top = d / 2.0;
    vec![
        Point2D { x: -bfb / 2.0, y: y_bot },
        Point2D { x: bfb / 2.0, y: y_bot },
        Point2D { x: bfb / 2.0, y: y_bot + tfb },
        Point2D { x: tw / 2.0, y: y_bot + tfb },
        Point2D { x: tw / 2.0, y: y_top - tft },
        Point2D { x: bft / 2.0, y: y_top - tft },
        Point2D { x: bft / 2.0, y: y_top },
        Point2D { x: -bft / 2.0, y: y_top },
        Point2D { x: -bft / 2.0, y: y_top - tft },
        Point2D { x: -tw / 2.0, y: y_top - tft },
        Point2D { x: -tw / 2.0, y: y_bot + tfb },
        Point2D { x: -bfb / 2.0, y: y_bot + tfb },
    ]
}

/// Create composite beam vertices (I-beam + concrete slab, transformed section)
///
/// Slab width is reduced by modular ratio n to transform concrete to equivalent steel area.
pub fn composite_beam_points(
    depth: f64,
    width: f64,
    web_thick: f64,
    flange_thick: f64,
    slab_width: f64,
    slab_thick: f64,
    modular_ratio: f64,
) -> Vec<Point2D> {
    let (d, bf, tw, tf) = (depth, width, web_thick, flange_thick);
    let be = slab_width / modular_ratio;
    let ts = slab_thick;
    vec![
        Point2D { x: -bf / 2.0, y: 0.0 },
        Point2D { x: bf / 2.0, y: 0.0 },
        Point2D { x: bf / 2.0, y: tf },
        Point2D { x: tw / 2.0, y: tf },
        Point2D { x: tw / 2.0, y: d - tf },
        Point2D { x: bf / 2.0, y: d - tf },
        Point2D { x: bf / 2.0, y: d },
        Point2D { x: be / 2.0, y: d },
        Point2D { x: be / 2.0, y: d + ts },
        Point2D { x: -be / 2.0, y: d + ts },
        Point2D { x: -be / 2.0, y: d },
        Point2D { x: -bf / 2.0, y: d },
        Point2D { x: -bf / 2.0, y: d - tf },
        Point2D { x: -tw / 2.0, y: d - tf },
        Point2D { x: -tw / 2.0, y: tf },
        Point2D { x: -bf / 2.0, y: tf },
    ]
}

// ============================================================================
// CONVENIENCE — Full property calculation for standard shapes
// ============================================================================

/// Calculate properties for an I-beam section
pub fn i_beam_properties(
    depth: f64, width: f64, web_thick: f64, flange_thick: f64, name: &str,
) -> SectionProperties {
    let pts = i_beam_points(depth, width, web_thick, flange_thick);
    calculate_section_properties(&pts, name, 7850.0)
}

/// Calculate properties for a rectangular section
pub fn rectangular_properties(width: f64, depth: f64, name: &str) -> SectionProperties {
    let pts = rectangular_points(width, depth);
    calculate_section_properties(&pts, name, 7850.0)
}

/// Calculate properties for a circular section
pub fn circular_properties(diameter: f64, name: &str) -> SectionProperties {
    let pts = circular_points(diameter, 64);
    calculate_section_properties(&pts, name, 7850.0)
}

// ============================================================================
// TESTS
// ============================================================================

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_rectangle_100x200() {
        let pts = rectangular_points(100.0, 200.0);
        let props = calculate_section_properties(&pts, "Rect 100x200", 7850.0);

        let expected_area = 100.0 * 200.0;
        assert!((props.area - expected_area).abs() < 1.0, "Area: {}", props.area);
        assert!(props.centroid_x.abs() < 0.1, "cx: {}", props.centroid_x);
        assert!(props.centroid_y.abs() < 0.1, "cy: {}", props.centroid_y);

        // Ixx = b*d³/12 = 100*200³/12 = 66_666_667
        let ixx_expected = 100.0 * 200.0_f64.powi(3) / 12.0;
        assert!((props.ixx - ixx_expected).abs() / ixx_expected < 0.01, "Ixx: {}", props.ixx);

        // Iyy = d*b³/12 = 200*100³/12 = 16_666_667
        let iyy_expected = 200.0 * 100.0_f64.powi(3) / 12.0;
        assert!((props.iyy - iyy_expected).abs() / iyy_expected < 0.01, "Iyy: {}", props.iyy);
    }

    #[test]
    fn test_i_beam_area() {
        // ISMB 300: D=300, bf=150, tw=7.5, tf=10.8
        let pts = i_beam_points(300.0, 150.0, 7.5, 10.8);
        let props = calculate_section_properties(&pts, "ISMB 300", 7850.0);

        // Expected area ≈ 2 × 150 × 10.8 + (300 - 2×10.8) × 7.5
        // = 3240 + 2088 = 5328 mm² (approximate)
        let expected_area = 2.0 * 150.0 * 10.8 + (300.0 - 2.0 * 10.8) * 7.5;
        assert!((props.area - expected_area).abs() / expected_area < 0.02, "Area: {}", props.area);
        assert!(props.ixx > props.iyy, "Ixx should be > Iyy for I-beam");
        assert!(props.weight_per_meter > 30.0 && props.weight_per_meter < 60.0);
    }

    #[test]
    fn test_circle_area() {
        let d = 200.0;
        let props = circular_properties(d, "Circle D200");
        let expected = PI / 4.0 * d * d;
        assert!(
            (props.area - expected).abs() / expected < 0.01,
            "Circle area: {} vs expected {}",
            props.area,
            expected
        );
        // Ixx ≈ Iyy for circle
        assert!(
            (props.ixx - props.iyy).abs() / props.ixx < 0.02,
            "Circle Ixx {} ≈ Iyy {}",
            props.ixx,
            props.iyy
        );
    }

    #[test]
    fn test_channel_properties() {
        let pts = channel_points(300.0, 100.0, 7.5, 10.8);
        let props = calculate_section_properties(&pts, "Channel", 7850.0);
        assert!(props.area > 0.0);
        // Channel centroid should be off-center in x
        assert!(props.centroid_x > 0.0, "Channel cx should be > 0: {}", props.centroid_x);
    }

    #[test]
    fn test_angle_properties() {
        let pts = angle_points(100.0, 75.0, 8.0);
        let props = calculate_section_properties(&pts, "Angle", 7850.0);
        assert!(props.area > 0.0);
        // Angle has non-zero product of inertia
        assert!(props.principal_angle_deg != 0.0);
    }
}
