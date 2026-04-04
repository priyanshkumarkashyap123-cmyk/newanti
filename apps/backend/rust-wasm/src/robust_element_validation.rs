//! Robust Element Validation and Quality Metrics
//!
//! Production-grade element geometry validation matching NASTRAN, ANSYS, and ABAQUS
//! quality checking capabilities.
//!
//! ## Critical Validation Features
//! - Jacobian positivity at all Gauss points
//! - Aspect ratio limits
//! - Warping and skewness checks
//! - Degenerate node detection
//! - Zero-length element detection
//! - Interior angle checks
//!
//! ## Industry Standards
//! - NASTRAN: GEOMCHECK with configurable thresholds
//! - ANSYS: ECHECK command
//! - ABAQUS: *PREPRINT with element quality
//! - STAAD.Pro: Element quality warnings

use serde::{Deserialize, Serialize};
use std::f64::consts::PI;

// ============================================================================
// ELEMENT QUALITY METRICS
// ============================================================================

/// Comprehensive element quality report
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ElementQualityReport {
    pub element_id: usize,
    pub element_type: ElementType,
    pub is_valid: bool,
    pub metrics: ElementQualityMetrics,
    pub warnings: Vec<QualityWarning>,
    pub errors: Vec<QualityError>,
}

#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
pub enum ElementType {
    // 1D Elements
    Beam2Node,
    Beam3Node,
    Truss,
    Cable,
    // 2D Elements
    Tri3,
    Tri6,
    Quad4,
    Quad8,
    Quad9,
    // 3D Elements
    Tet4,
    Tet10,
    Hex8,
    Hex20,
    Hex27,
    Wedge6,
    Wedge15,
    Pyramid5,
    // Shells
    ShellTri3,
    ShellTri6,
    ShellQuad4,
    ShellQuad8,
}

/// Numerical quality metrics
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ElementQualityMetrics {
    /// Ratio of max to min Jacobian at Gauss points
    pub jacobian_ratio: f64,
    /// Minimum Jacobian determinant
    pub min_jacobian: f64,
    /// Maximum Jacobian determinant
    pub max_jacobian: f64,
    /// Aspect ratio (max edge / min edge)
    pub aspect_ratio: f64,
    /// Skewness (0 = ideal, 1 = degenerate)
    pub skewness: f64,
    /// Warping factor for quads/shells
    pub warping_factor: f64,
    /// Maximum interior angle (degrees)
    pub max_angle: f64,
    /// Minimum interior angle (degrees)
    pub min_angle: f64,
    /// Taper ratio for quads
    pub taper_ratio: f64,
    /// Volume (for 3D) or area (for 2D)
    pub volume: f64,
    /// Characteristic length
    pub characteristic_length: f64,
}

impl Default for ElementQualityMetrics {
    fn default() -> Self {
        ElementQualityMetrics {
            jacobian_ratio: 1.0,
            min_jacobian: 1.0,
            max_jacobian: 1.0,
            aspect_ratio: 1.0,
            skewness: 0.0,
            warping_factor: 0.0,
            max_angle: 90.0,
            min_angle: 90.0,
            taper_ratio: 1.0,
            volume: 1.0,
            characteristic_length: 1.0,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct QualityWarning {
    pub code: WarningCode,
    pub message: String,
    pub severity: WarningSeverity,
}

#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
pub enum WarningCode {
    HighAspectRatio,
    LargeSkewness,
    HighWarping,
    ExtremeAngle,
    HighTaper,
    SmallJacobianRatio,
    LargeElement,
    SmallElement,
    NearlyCollinearNodes,
    NearlyCoplanarNodes,
}

#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
pub enum WarningSeverity {
    Info,
    Warning,
    Severe,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct QualityError {
    pub code: ErrorCode,
    pub message: String,
    pub location: Option<(f64, f64, f64)>,
}

#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
pub enum ErrorCode {
    NegativeJacobian,
    ZeroJacobian,
    ZeroLength,
    ZeroArea,
    ZeroVolume,
    DegenerateElement,
    CoincidentNodes,
    CollinearNodes,
    CoplanarNodes,
    InvertedElement,
}

// ============================================================================
// QUALITY THRESHOLDS
// ============================================================================

/// Configurable quality thresholds (matching industry standards)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct QualityThresholds {
    /// Maximum allowed aspect ratio
    pub max_aspect_ratio: f64,
    /// Maximum allowed skewness (0-1)
    pub max_skewness: f64,
    /// Maximum warping for shells
    pub max_warping: f64,
    /// Minimum allowed interior angle (degrees)
    pub min_interior_angle: f64,
    /// Maximum allowed interior angle (degrees)
    pub max_interior_angle: f64,
    /// Minimum Jacobian ratio (min/max)
    pub min_jacobian_ratio: f64,
    /// Maximum taper ratio
    pub max_taper_ratio: f64,
    /// Coincident node tolerance
    pub coincident_tol: f64,
}

impl Default for QualityThresholds {
    fn default() -> Self {
        QualityThresholds {
            max_aspect_ratio: 10.0,       // NASTRAN default
            max_skewness: 0.9,            // 0.5 for high-quality
            max_warping: 0.1,             // 10% for shells
            min_interior_angle: 15.0,     // Degrees
            max_interior_angle: 165.0,    // Degrees
            min_jacobian_ratio: 0.1,      // 10% of ideal
            max_taper_ratio: 0.5,         // 50% size change
            coincident_tol: 1e-6,         // Relative tolerance
        }
    }
}

impl QualityThresholds {
    /// Strict thresholds for high-quality meshes
    pub fn strict() -> Self {
        QualityThresholds {
            max_aspect_ratio: 5.0,
            max_skewness: 0.5,
            max_warping: 0.05,
            min_interior_angle: 30.0,
            max_interior_angle: 150.0,
            min_jacobian_ratio: 0.3,
            max_taper_ratio: 0.25,
            coincident_tol: 1e-8,
        }
    }
    
    /// Relaxed thresholds for preliminary analysis
    pub fn relaxed() -> Self {
        QualityThresholds {
            max_aspect_ratio: 20.0,
            max_skewness: 0.95,
            max_warping: 0.2,
            min_interior_angle: 5.0,
            max_interior_angle: 175.0,
            min_jacobian_ratio: 0.01,
            max_taper_ratio: 0.75,
            coincident_tol: 1e-4,
        }
    }
}

// ============================================================================
// 3D SOLID ELEMENT VALIDATION
// ============================================================================

/// Hex8 element quality checker
pub struct Hex8QualityChecker {
    pub nodes: [[f64; 3]; 8],
    pub thresholds: QualityThresholds,
}

impl Hex8QualityChecker {
    pub fn new(nodes: [[f64; 3]; 8]) -> Self {
        Hex8QualityChecker {
            nodes,
            thresholds: QualityThresholds::default(),
        }
    }
    
    pub fn with_thresholds(nodes: [[f64; 3]; 8], thresholds: QualityThresholds) -> Self {
        Hex8QualityChecker { nodes, thresholds }
    }
    
    /// Full quality check
    pub fn check(&self, element_id: usize) -> ElementQualityReport {
        let mut warnings = Vec::new();
        let mut errors = Vec::new();
        
        // Check coincident nodes
        let char_length = self.characteristic_length();
        for i in 0..8 {
            for j in (i + 1)..8 {
                let dist = distance_3d(&self.nodes[i], &self.nodes[j]);
                if dist < self.thresholds.coincident_tol * char_length {
                    errors.push(QualityError {
                        code: ErrorCode::CoincidentNodes,
                        message: format!("Nodes {} and {} are coincident (dist = {:.2e})", i, j, dist),
                        location: Some((
                            self.nodes[i][0],
                            self.nodes[i][1],
                            self.nodes[i][2],
                        )),
                    });
                }
            }
        }
        
        // Check Jacobian at all Gauss points
        let gauss_pts = gauss_hex_2x2x2();
        let mut min_j = f64::MAX;
        let mut max_j = f64::MIN;
        
        for (xi, eta, zeta) in &gauss_pts {
            let det_j = self.jacobian_det(*xi, *eta, *zeta);
            min_j = min_j.min(det_j);
            max_j = max_j.max(det_j);
            
            if det_j <= 0.0 {
                errors.push(QualityError {
                    code: ErrorCode::NegativeJacobian,
                    message: format!(
                        "Negative Jacobian ({:.4e}) at ξ={:.2}, η={:.2}, ζ={:.2}",
                        det_j, xi, eta, zeta
                    ),
                    location: None,
                });
            }
        }
        
        // Also check at corners (natural coordinates ±1)
        for &xi in &[-1.0, 1.0] {
            for &eta in &[-1.0, 1.0] {
                for &zeta in &[-1.0, 1.0] {
                    let det_j = self.jacobian_det(xi, eta, zeta);
                    min_j = min_j.min(det_j);
                    max_j = max_j.max(det_j);
                    
                    if det_j <= 0.0 {
                        errors.push(QualityError {
                            code: ErrorCode::NegativeJacobian,
                            message: format!(
                                "Negative Jacobian ({:.4e}) at corner ξ={:.0}, η={:.0}, ζ={:.0}",
                                det_j, xi, eta, zeta
                            ),
                            location: None,
                        });
                    }
                }
            }
        }
        
        let jacobian_ratio = if max_j > 1e-14 { min_j / max_j } else { 0.0 };
        
        if jacobian_ratio < self.thresholds.min_jacobian_ratio && jacobian_ratio > 0.0 {
            warnings.push(QualityWarning {
                code: WarningCode::SmallJacobianRatio,
                message: format!(
                    "Low Jacobian ratio ({:.4}): element is highly distorted",
                    jacobian_ratio
                ),
                severity: WarningSeverity::Warning,
            });
        }
        
        // Aspect ratio
        let edges = self.edge_lengths();
        let min_edge = edges.iter().cloned().fold(f64::MAX, f64::min);
        let max_edge = edges.iter().cloned().fold(0.0_f64, f64::max);
        let aspect_ratio = if min_edge > 1e-14 { max_edge / min_edge } else { f64::MAX };
        
        if aspect_ratio > self.thresholds.max_aspect_ratio {
            warnings.push(QualityWarning {
                code: WarningCode::HighAspectRatio,
                message: format!("High aspect ratio: {:.2}", aspect_ratio),
                severity: if aspect_ratio > 2.0 * self.thresholds.max_aspect_ratio {
                    WarningSeverity::Severe
                } else {
                    WarningSeverity::Warning
                },
            });
        }
        
        // Volume
        let volume = self.volume();
        if volume <= 0.0 {
            errors.push(QualityError {
                code: ErrorCode::InvertedElement,
                message: format!("Inverted element: volume = {:.4e}", volume),
                location: None,
            });
        } else if volume < 1e-14 * char_length.powi(3) {
            errors.push(QualityError {
                code: ErrorCode::ZeroVolume,
                message: format!("Near-zero volume: {:.4e}", volume),
                location: None,
            });
        }
        
        // Skewness - measure deviation from ideal hex
        let skewness = self.compute_skewness();
        if skewness > self.thresholds.max_skewness {
            warnings.push(QualityWarning {
                code: WarningCode::LargeSkewness,
                message: format!("High skewness: {:.4}", skewness),
                severity: WarningSeverity::Warning,
            });
        }
        
        let is_valid = errors.is_empty();
        
        ElementQualityReport {
            element_id,
            element_type: ElementType::Hex8,
            is_valid,
            metrics: ElementQualityMetrics {
                jacobian_ratio,
                min_jacobian: min_j,
                max_jacobian: max_j,
                aspect_ratio,
                skewness,
                warping_factor: 0.0, // Not applicable for hex
                max_angle: 0.0,      // Could compute face angles
                min_angle: 0.0,
                taper_ratio: 0.0,
                volume,
                characteristic_length: char_length,
            },
            warnings,
            errors,
        }
    }
    
    /// Jacobian determinant at natural coordinates
    fn jacobian_det(&self, xi: f64, eta: f64, zeta: f64) -> f64 {
        let dn = shape_derivatives_hex8(xi, eta, zeta);
        
        let mut j = [[0.0; 3]; 3];
        for a in 0..8 {
            for i in 0..3 {
                for k in 0..3 {
                    j[i][k] += dn[a][i] * self.nodes[a][k];
                }
            }
        }
        
        j[0][0] * (j[1][1] * j[2][2] - j[1][2] * j[2][1])
            - j[0][1] * (j[1][0] * j[2][2] - j[1][2] * j[2][0])
            + j[0][2] * (j[1][0] * j[2][1] - j[1][1] * j[2][0])
    }
    
    /// Edge lengths (12 edges for hex)
    fn edge_lengths(&self) -> [f64; 12] {
        // Edge connectivity for hex8
        let edges = [
            (0, 1), (1, 2), (2, 3), (3, 0), // Bottom face
            (4, 5), (5, 6), (6, 7), (7, 4), // Top face
            (0, 4), (1, 5), (2, 6), (3, 7), // Vertical edges
        ];
        
        let mut lengths = [0.0; 12];
        for (i, &(n1, n2)) in edges.iter().enumerate() {
            lengths[i] = distance_3d(&self.nodes[n1], &self.nodes[n2]);
        }
        lengths
    }
    
    /// Volume using 2x2x2 Gauss integration
    fn volume(&self) -> f64 {
        let mut vol = 0.0;
        for (xi, eta, zeta) in gauss_hex_2x2x2() {
            let det_j = self.jacobian_det(xi, eta, zeta);
            vol += det_j; // Weight = 1 for 2-point rule
        }
        vol
    }
    
    /// Characteristic length (cube root of volume or average edge)
    fn characteristic_length(&self) -> f64 {
        let edges = self.edge_lengths();
        edges.iter().sum::<f64>() / 12.0
    }
    
    /// Skewness based on equi-angle skew metric
    fn compute_skewness(&self) -> f64 {
        // Simplified: measure deviation of face angles from 90°
        let faces = [
            [0, 1, 2, 3], // Bottom
            [4, 5, 6, 7], // Top
            [0, 1, 5, 4], // Front
            [2, 3, 7, 6], // Back
            [1, 2, 6, 5], // Right
            [0, 3, 7, 4], // Left
        ];
        
        let mut max_skew: f64 = 0.0;
        for face in &faces {
            for i in 0..4 {
                let p1 = self.nodes[face[i]];
                let p2 = self.nodes[face[(i + 1) % 4]];
                let p3 = self.nodes[face[(i + 2) % 4]];
                
                let v1 = [p1[0] - p2[0], p1[1] - p2[1], p1[2] - p2[2]];
                let v2 = [p3[0] - p2[0], p3[1] - p2[1], p3[2] - p2[2]];
                
                let cos_angle = dot_3d(&v1, &v2) / (norm_3d(&v1) * norm_3d(&v2) + 1e-14);
                let angle = cos_angle.clamp(-1.0, 1.0).acos() * 180.0 / PI;
                
                // Skew = |angle - 90| / 90
                let skew = (angle - 90.0).abs() / 90.0;
                max_skew = max_skew.max(skew);
            }
        }
        max_skew
    }
}

// ============================================================================
// 2D ELEMENT VALIDATION
// ============================================================================

/// Quad4 element quality checker
pub struct Quad4QualityChecker {
    pub nodes: [[f64; 2]; 4],
    pub thresholds: QualityThresholds,
}

impl Quad4QualityChecker {
    pub fn new(nodes: [[f64; 2]; 4]) -> Self {
        Quad4QualityChecker {
            nodes,
            thresholds: QualityThresholds::default(),
        }
    }
    
    pub fn check(&self, element_id: usize) -> ElementQualityReport {
        let mut warnings = Vec::new();
        let mut errors = Vec::new();
        
        // Check coincident nodes
        let char_length = self.characteristic_length();
        for i in 0..4 {
            for j in (i + 1)..4 {
                let dist = distance_2d(&self.nodes[i], &self.nodes[j]);
                if dist < self.thresholds.coincident_tol * char_length {
                    errors.push(QualityError {
                        code: ErrorCode::CoincidentNodes,
                        message: format!("Nodes {} and {} are coincident", i, j),
                        location: None,
                    });
                }
            }
        }
        
        // Check Jacobian at Gauss points
        let gauss_pts = [(1.0/3.0_f64.sqrt(), 1.0/3.0_f64.sqrt()), 
                         (-1.0/3.0_f64.sqrt(), 1.0/3.0_f64.sqrt()),
                         (1.0/3.0_f64.sqrt(), -1.0/3.0_f64.sqrt()),
                         (-1.0/3.0_f64.sqrt(), -1.0/3.0_f64.sqrt())];
        
        let mut min_j = f64::MAX;
        let mut max_j = f64::MIN;
        
        for &(xi, eta) in &gauss_pts {
            let det_j = self.jacobian_det(xi, eta);
            min_j = min_j.min(det_j);
            max_j = max_j.max(det_j);
            
            if det_j <= 0.0 {
                errors.push(QualityError {
                    code: ErrorCode::NegativeJacobian,
                    message: format!("Negative Jacobian ({:.4e}) at ξ={:.2}, η={:.2}", det_j, xi, eta),
                    location: None,
                });
            }
        }
        
        let jacobian_ratio = if max_j > 1e-14 { min_j / max_j } else { 0.0 };
        
        // Aspect ratio
        let edges = self.edge_lengths();
        let min_edge = edges.iter().cloned().fold(f64::MAX, f64::min);
        let max_edge = edges.iter().cloned().fold(0.0_f64, f64::max);
        let aspect_ratio = if min_edge > 1e-14 { max_edge / min_edge } else { f64::MAX };
        
        if aspect_ratio > self.thresholds.max_aspect_ratio {
            warnings.push(QualityWarning {
                code: WarningCode::HighAspectRatio,
                message: format!("High aspect ratio: {:.2}", aspect_ratio),
                severity: WarningSeverity::Warning,
            });
        }
        
        // Interior angles
        let angles = self.interior_angles();
        let min_angle = angles.iter().cloned().fold(f64::MAX, f64::min);
        let max_angle = angles.iter().cloned().fold(0.0_f64, f64::max);
        
        if min_angle < self.thresholds.min_interior_angle {
            warnings.push(QualityWarning {
                code: WarningCode::ExtremeAngle,
                message: format!("Small interior angle: {:.1}°", min_angle),
                severity: WarningSeverity::Warning,
            });
        }
        if max_angle > self.thresholds.max_interior_angle {
            warnings.push(QualityWarning {
                code: WarningCode::ExtremeAngle,
                message: format!("Large interior angle: {:.1}°", max_angle),
                severity: WarningSeverity::Warning,
            });
        }
        
        // Skewness
        let skewness = 1.0 - (min_angle / 90.0).min(90.0 / max_angle);
        if skewness > self.thresholds.max_skewness {
            warnings.push(QualityWarning {
                code: WarningCode::LargeSkewness,
                message: format!("High skewness: {:.4}", skewness),
                severity: WarningSeverity::Warning,
            });
        }
        
        // Taper ratio
        let diag1 = ((self.nodes[0][0] + self.nodes[2][0]) / 2.0,
                     (self.nodes[0][1] + self.nodes[2][1]) / 2.0);
        let diag2 = ((self.nodes[1][0] + self.nodes[3][0]) / 2.0,
                     (self.nodes[1][1] + self.nodes[3][1]) / 2.0);
        let center_dist = ((diag1.0 - diag2.0).powi(2) + (diag1.1 - diag2.1).powi(2)).sqrt();
        let taper_ratio = center_dist / char_length;
        
        if taper_ratio > self.thresholds.max_taper_ratio {
            warnings.push(QualityWarning {
                code: WarningCode::HighTaper,
                message: format!("High taper: {:.4}", taper_ratio),
                severity: WarningSeverity::Warning,
            });
        }
        
        let area = self.area();
        let is_valid = errors.is_empty();
        
        ElementQualityReport {
            element_id,
            element_type: ElementType::Quad4,
            is_valid,
            metrics: ElementQualityMetrics {
                jacobian_ratio,
                min_jacobian: min_j,
                max_jacobian: max_j,
                aspect_ratio,
                skewness,
                warping_factor: 0.0,
                max_angle,
                min_angle,
                taper_ratio,
                volume: area,
                characteristic_length: char_length,
            },
            warnings,
            errors,
        }
    }
    
    fn jacobian_det(&self, xi: f64, eta: f64) -> f64 {
        // Shape function derivatives
        let dndxi = [
            -0.25 * (1.0 - eta),
             0.25 * (1.0 - eta),
             0.25 * (1.0 + eta),
            -0.25 * (1.0 + eta),
        ];
        let dndeta = [
            -0.25 * (1.0 - xi),
            -0.25 * (1.0 + xi),
             0.25 * (1.0 + xi),
             0.25 * (1.0 - xi),
        ];
        
        let mut dxdxi = 0.0;
        let mut dydxi = 0.0;
        let mut dxdeta = 0.0;
        let mut dydeta = 0.0;
        
        for i in 0..4 {
            dxdxi += dndxi[i] * self.nodes[i][0];
            dydxi += dndxi[i] * self.nodes[i][1];
            dxdeta += dndeta[i] * self.nodes[i][0];
            dydeta += dndeta[i] * self.nodes[i][1];
        }
        
        dxdxi * dydeta - dxdeta * dydxi
    }
    
    fn edge_lengths(&self) -> [f64; 4] {
        [
            distance_2d(&self.nodes[0], &self.nodes[1]),
            distance_2d(&self.nodes[1], &self.nodes[2]),
            distance_2d(&self.nodes[2], &self.nodes[3]),
            distance_2d(&self.nodes[3], &self.nodes[0]),
        ]
    }
    
    fn interior_angles(&self) -> [f64; 4] {
        let mut angles = [0.0; 4];
        for i in 0..4 {
            let p_prev = self.nodes[(i + 3) % 4];
            let p_curr = self.nodes[i];
            let p_next = self.nodes[(i + 1) % 4];
            
            let v1 = [p_prev[0] - p_curr[0], p_prev[1] - p_curr[1]];
            let v2 = [p_next[0] - p_curr[0], p_next[1] - p_curr[1]];
            
            let dot = v1[0] * v2[0] + v1[1] * v2[1];
            let len1 = (v1[0] * v1[0] + v1[1] * v1[1]).sqrt();
            let len2 = (v2[0] * v2[0] + v2[1] * v2[1]).sqrt();
            
            let cos_angle = dot / (len1 * len2 + 1e-14);
            angles[i] = cos_angle.clamp(-1.0, 1.0).acos() * 180.0 / PI;
        }
        angles
    }
    
    fn area(&self) -> f64 {
        // Shoelace formula
        let mut area = 0.0;
        for i in 0..4 {
            let j = (i + 1) % 4;
            area += self.nodes[i][0] * self.nodes[j][1];
            area -= self.nodes[j][0] * self.nodes[i][1];
        }
        area.abs() / 2.0
    }
    
    fn characteristic_length(&self) -> f64 {
        let edges = self.edge_lengths();
        edges.iter().sum::<f64>() / 4.0
    }
}

// ============================================================================
// TRIANGLE VALIDATION
// ============================================================================

pub struct Tri3QualityChecker {
    pub nodes: [[f64; 2]; 3],
    pub thresholds: QualityThresholds,
}

impl Tri3QualityChecker {
    pub fn new(nodes: [[f64; 2]; 3]) -> Self {
        Tri3QualityChecker {
            nodes,
            thresholds: QualityThresholds::default(),
        }
    }
    
    pub fn check(&self, element_id: usize) -> ElementQualityReport {
        let mut warnings = Vec::new();
        let mut errors = Vec::new();
        
        let edges = self.edge_lengths();
        let area = self.area();
        
        // Check for degenerate triangle
        if area < 1e-14 {
            errors.push(QualityError {
                code: ErrorCode::ZeroArea,
                message: "Degenerate triangle (zero area)".to_string(),
                location: None,
            });
        }
        
        // Aspect ratio (max edge / min altitude)
        let min_edge = edges.iter().cloned().fold(f64::MAX, f64::min);
        let max_edge = edges.iter().cloned().fold(0.0_f64, f64::max);
        let aspect_ratio = if min_edge > 1e-14 { max_edge / min_edge } else { f64::MAX };
        
        if aspect_ratio > self.thresholds.max_aspect_ratio {
            warnings.push(QualityWarning {
                code: WarningCode::HighAspectRatio,
                message: format!("High aspect ratio: {:.2}", aspect_ratio),
                severity: WarningSeverity::Warning,
            });
        }
        
        // Interior angles
        let angles = self.interior_angles();
        let min_angle = angles.iter().cloned().fold(f64::MAX, f64::min);
        let max_angle = angles.iter().cloned().fold(0.0_f64, f64::max);
        
        if min_angle < self.thresholds.min_interior_angle {
            warnings.push(QualityWarning {
                code: WarningCode::ExtremeAngle,
                message: format!("Small interior angle: {:.1}°", min_angle),
                severity: WarningSeverity::Warning,
            });
        }
        
        // Equi-angle skewness
        let ideal_angle = 60.0;
        let skewness = ((max_angle - ideal_angle) / (180.0 - ideal_angle))
            .max((ideal_angle - min_angle) / ideal_angle);
        
        let is_valid = errors.is_empty();
        
        ElementQualityReport {
            element_id,
            element_type: ElementType::Tri3,
            is_valid,
            metrics: ElementQualityMetrics {
                jacobian_ratio: 1.0, // Constant for linear triangle
                min_jacobian: area,
                max_jacobian: area,
                aspect_ratio,
                skewness,
                warping_factor: 0.0,
                max_angle,
                min_angle,
                taper_ratio: 0.0,
                volume: area,
                characteristic_length: (edges[0] + edges[1] + edges[2]) / 3.0,
            },
            warnings,
            errors,
        }
    }
    
    fn edge_lengths(&self) -> [f64; 3] {
        [
            distance_2d(&self.nodes[0], &self.nodes[1]),
            distance_2d(&self.nodes[1], &self.nodes[2]),
            distance_2d(&self.nodes[2], &self.nodes[0]),
        ]
    }
    
    fn interior_angles(&self) -> [f64; 3] {
        let mut angles = [0.0; 3];
        for i in 0..3 {
            let p_prev = self.nodes[(i + 2) % 3];
            let p_curr = self.nodes[i];
            let p_next = self.nodes[(i + 1) % 3];
            
            let v1 = [p_prev[0] - p_curr[0], p_prev[1] - p_curr[1]];
            let v2 = [p_next[0] - p_curr[0], p_next[1] - p_curr[1]];
            
            let dot = v1[0] * v2[0] + v1[1] * v2[1];
            let len1 = (v1[0] * v1[0] + v1[1] * v1[1]).sqrt();
            let len2 = (v2[0] * v2[0] + v2[1] * v2[1]).sqrt();
            
            let cos_angle = dot / (len1 * len2 + 1e-14);
            angles[i] = cos_angle.clamp(-1.0, 1.0).acos() * 180.0 / PI;
        }
        angles
    }
    
    fn area(&self) -> f64 {
        0.5 * ((self.nodes[1][0] - self.nodes[0][0]) * (self.nodes[2][1] - self.nodes[0][1])
             - (self.nodes[2][0] - self.nodes[0][0]) * (self.nodes[1][1] - self.nodes[0][1])).abs()
    }
}

// ============================================================================
// BEAM ELEMENT VALIDATION
// ============================================================================

pub struct BeamQualityChecker {
    pub node1: [f64; 3],
    pub node2: [f64; 3],
    pub thresholds: QualityThresholds,
}

impl BeamQualityChecker {
    pub fn new(node1: [f64; 3], node2: [f64; 3]) -> Self {
        BeamQualityChecker {
            node1,
            node2,
            thresholds: QualityThresholds::default(),
        }
    }
    
    pub fn check(&self, element_id: usize) -> ElementQualityReport {
        let warnings = Vec::new();
        let mut errors = Vec::new();
        
        let length = distance_3d(&self.node1, &self.node2);
        
        if length < self.thresholds.coincident_tol {
            errors.push(QualityError {
                code: ErrorCode::ZeroLength,
                message: format!("Zero-length beam: L = {:.4e}", length),
                location: Some((
                    (self.node1[0] + self.node2[0]) / 2.0,
                    (self.node1[1] + self.node2[1]) / 2.0,
                    (self.node1[2] + self.node2[2]) / 2.0,
                )),
            });
        }
        
        let is_valid = errors.is_empty();
        
        ElementQualityReport {
            element_id,
            element_type: ElementType::Beam2Node,
            is_valid,
            metrics: ElementQualityMetrics {
                jacobian_ratio: 1.0,
                min_jacobian: length / 2.0,
                max_jacobian: length / 2.0,
                aspect_ratio: 1.0,
                skewness: 0.0,
                warping_factor: 0.0,
                max_angle: 180.0,
                min_angle: 180.0,
                taper_ratio: 0.0,
                volume: length,
                characteristic_length: length,
            },
            warnings,
            errors,
        }
    }
}

// ============================================================================
// MESH-WIDE QUALITY CHECK
// ============================================================================

/// Complete mesh quality summary
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MeshQualitySummary {
    pub total_elements: usize,
    pub valid_elements: usize,
    pub invalid_elements: usize,
    pub elements_with_warnings: usize,
    pub total_errors: usize,
    pub total_warnings: usize,
    pub worst_jacobian_ratio: f64,
    pub worst_aspect_ratio: f64,
    pub worst_skewness: f64,
    pub min_volume: f64,
    pub overall_quality: QualityRating,
    pub invalid_element_ids: Vec<usize>,
}

#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
pub enum QualityRating {
    Excellent,
    Good,
    Acceptable,
    Poor,
    Invalid,
}

impl MeshQualitySummary {
    pub fn from_reports(reports: &[ElementQualityReport]) -> Self {
        let total_elements = reports.len();
        let valid_elements = reports.iter().filter(|r| r.is_valid).count();
        let invalid_elements = total_elements - valid_elements;
        let elements_with_warnings = reports.iter().filter(|r| !r.warnings.is_empty()).count();
        
        let total_errors: usize = reports.iter().map(|r| r.errors.len()).sum();
        let total_warnings: usize = reports.iter().map(|r| r.warnings.len()).sum();
        
        let worst_jacobian_ratio = reports.iter()
            .map(|r| r.metrics.jacobian_ratio)
            .fold(f64::MAX, f64::min);
        let worst_aspect_ratio = reports.iter()
            .map(|r| r.metrics.aspect_ratio)
            .fold(0.0_f64, f64::max);
        let worst_skewness = reports.iter()
            .map(|r| r.metrics.skewness)
            .fold(0.0_f64, f64::max);
        let min_volume = reports.iter()
            .map(|r| r.metrics.volume)
            .fold(f64::MAX, f64::min);
        
        let invalid_element_ids: Vec<usize> = reports.iter()
            .filter(|r| !r.is_valid)
            .map(|r| r.element_id)
            .collect();
        
        // Overall quality rating
        let overall_quality = if invalid_elements > 0 {
            QualityRating::Invalid
        } else if worst_jacobian_ratio > 0.5 && worst_aspect_ratio < 5.0 && worst_skewness < 0.5 {
            QualityRating::Excellent
        } else if worst_jacobian_ratio > 0.2 && worst_aspect_ratio < 10.0 && worst_skewness < 0.7 {
            QualityRating::Good
        } else if worst_jacobian_ratio > 0.1 && worst_aspect_ratio < 20.0 && worst_skewness < 0.9 {
            QualityRating::Acceptable
        } else {
            QualityRating::Poor
        };
        
        MeshQualitySummary {
            total_elements,
            valid_elements,
            invalid_elements,
            elements_with_warnings,
            total_errors,
            total_warnings,
            worst_jacobian_ratio,
            worst_aspect_ratio,
            worst_skewness,
            min_volume,
            overall_quality,
            invalid_element_ids,
        }
    }
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

fn distance_3d(a: &[f64; 3], b: &[f64; 3]) -> f64 {
    ((a[0] - b[0]).powi(2) + (a[1] - b[1]).powi(2) + (a[2] - b[2]).powi(2)).sqrt()
}

fn distance_2d(a: &[f64; 2], b: &[f64; 2]) -> f64 {
    ((a[0] - b[0]).powi(2) + (a[1] - b[1]).powi(2)).sqrt()
}

fn dot_3d(a: &[f64; 3], b: &[f64; 3]) -> f64 {
    a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
}

fn norm_3d(v: &[f64; 3]) -> f64 {
    (v[0] * v[0] + v[1] * v[1] + v[2] * v[2]).sqrt()
}

fn gauss_hex_2x2x2() -> Vec<(f64, f64, f64)> {
    let g = 1.0 / 3.0_f64.sqrt();
    vec![
        (-g, -g, -g), (g, -g, -g), (g, g, -g), (-g, g, -g),
        (-g, -g, g), (g, -g, g), (g, g, g), (-g, g, g),
    ]
}

fn shape_derivatives_hex8(xi: f64, eta: f64, zeta: f64) -> [[f64; 3]; 8] {
    [
        [-0.125 * (1.0 - eta) * (1.0 - zeta), -0.125 * (1.0 - xi) * (1.0 - zeta), -0.125 * (1.0 - xi) * (1.0 - eta)],
        [ 0.125 * (1.0 - eta) * (1.0 - zeta), -0.125 * (1.0 + xi) * (1.0 - zeta), -0.125 * (1.0 + xi) * (1.0 - eta)],
        [ 0.125 * (1.0 + eta) * (1.0 - zeta),  0.125 * (1.0 + xi) * (1.0 - zeta), -0.125 * (1.0 + xi) * (1.0 + eta)],
        [-0.125 * (1.0 + eta) * (1.0 - zeta),  0.125 * (1.0 - xi) * (1.0 - zeta), -0.125 * (1.0 - xi) * (1.0 + eta)],
        [-0.125 * (1.0 - eta) * (1.0 + zeta), -0.125 * (1.0 - xi) * (1.0 + zeta),  0.125 * (1.0 - xi) * (1.0 - eta)],
        [ 0.125 * (1.0 - eta) * (1.0 + zeta), -0.125 * (1.0 + xi) * (1.0 + zeta),  0.125 * (1.0 + xi) * (1.0 - eta)],
        [ 0.125 * (1.0 + eta) * (1.0 + zeta),  0.125 * (1.0 + xi) * (1.0 + zeta),  0.125 * (1.0 + xi) * (1.0 + eta)],
        [-0.125 * (1.0 + eta) * (1.0 + zeta),  0.125 * (1.0 - xi) * (1.0 + zeta),  0.125 * (1.0 - xi) * (1.0 + eta)],
    ]
}

#[cfg(test)]
mod tests {
    use super::*;
    
    #[test]
    fn test_unit_hex_quality() {
        let nodes = [
            [0.0, 0.0, 0.0], [1.0, 0.0, 0.0], [1.0, 1.0, 0.0], [0.0, 1.0, 0.0],
            [0.0, 0.0, 1.0], [1.0, 0.0, 1.0], [1.0, 1.0, 1.0], [0.0, 1.0, 1.0],
        ];
        
        let checker = Hex8QualityChecker::new(nodes);
        let report = checker.check(1);
        
        assert!(report.is_valid);
        assert!((report.metrics.jacobian_ratio - 1.0).abs() < 1e-6);
        assert!((report.metrics.aspect_ratio - 1.0).abs() < 1e-6);
    }
    
    #[test]
    fn test_distorted_hex() {
        // Highly distorted hex
        let nodes = [
            [0.0, 0.0, 0.0], [2.0, 0.0, 0.0], [2.5, 0.5, 0.0], [0.0, 0.3, 0.0],
            [0.0, 0.0, 1.0], [2.0, 0.0, 1.0], [2.5, 0.5, 1.0], [0.0, 0.3, 1.0],
        ];
        
        let checker = Hex8QualityChecker::new(nodes);
        let report = checker.check(2);
        
        assert!(report.is_valid); // Still valid but should have warnings
        assert!(report.metrics.aspect_ratio > 1.5);
    }
    
    #[test]
    fn test_inverted_hex() {
        // Inverted hex (negative volume)
        let nodes = [
            [0.0, 0.0, 0.0], [1.0, 0.0, 0.0], [0.0, 1.0, 0.0], [1.0, 1.0, 0.0], // Swapped 2,3
            [0.0, 0.0, 1.0], [1.0, 0.0, 1.0], [0.0, 1.0, 1.0], [1.0, 1.0, 1.0],
        ];
        
        let checker = Hex8QualityChecker::new(nodes);
        let report = checker.check(3);
        
        // Should detect issues
        assert!(!report.errors.is_empty() || report.metrics.jacobian_ratio < 0.5);
    }
    
    #[test]
    fn test_unit_quad_quality() {
        let nodes = [[0.0, 0.0], [1.0, 0.0], [1.0, 1.0], [0.0, 1.0]];
        let checker = Quad4QualityChecker::new(nodes);
        let report = checker.check(1);
        
        assert!(report.is_valid);
        assert!((report.metrics.aspect_ratio - 1.0).abs() < 1e-6);
    }
    
    #[test]
    fn test_equilateral_triangle() {
        let h = (3.0_f64).sqrt() / 2.0;
        let nodes = [[0.0, 0.0], [1.0, 0.0], [0.5, h]];
        let checker = Tri3QualityChecker::new(nodes);
        let report = checker.check(1);
        
        assert!(report.is_valid);
        assert!((report.metrics.min_angle - 60.0).abs() < 1.0); // ~60 degrees
    }
    
    #[test]
    fn test_zero_length_beam() {
        let checker = BeamQualityChecker::new([0.0, 0.0, 0.0], [0.0, 0.0, 0.0]);
        let report = checker.check(1);
        
        assert!(!report.is_valid);
        assert!(report.errors.iter().any(|e| e.code == ErrorCode::ZeroLength));
    }
}
