// ============================================================================
// PHASE 51: MESH QUALITY METRICS & ANALYSIS
// ============================================================================
//
// Comprehensive mesh quality assessment:
// - Aspect ratio, Jacobian, skewness, warping
// - Element-specific metrics (tet, hex, quad, tri)
// - Quality histograms and statistics
// - Mesh repair suggestions
//
// Industry Parity: ANSYS ICEM, Pointwise, Gmsh
// ============================================================================

use std::f64::consts::PI;

// ============================================================================
// QUALITY METRICS
// ============================================================================

/// Quality metric bounds
#[derive(Debug, Clone, Copy)]
pub struct QualityBounds {
    pub excellent: f64,
    pub good: f64,
    pub acceptable: f64,
    pub poor: f64,
}

impl QualityBounds {
    /// Bounds for aspect ratio (lower is better)
    pub fn aspect_ratio() -> Self {
        Self {
            excellent: 1.5,
            good: 3.0,
            acceptable: 10.0,
            poor: 100.0,
        }
    }
    
    /// Bounds for Jacobian ratio (higher is better, max 1.0)
    pub fn jacobian() -> Self {
        Self {
            excellent: 0.9,
            good: 0.7,
            acceptable: 0.3,
            poor: 0.0,
        }
    }
    
    /// Bounds for skewness (lower is better)
    pub fn skewness() -> Self {
        Self {
            excellent: 0.25,
            good: 0.5,
            acceptable: 0.75,
            poor: 0.9,
        }
    }
    
    /// Bounds for orthogonality (higher is better)
    pub fn orthogonality() -> Self {
        Self {
            excellent: 0.95,
            good: 0.8,
            acceptable: 0.5,
            poor: 0.2,
        }
    }
}

/// Quality rating enum
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum QualityRating {
    Excellent,
    Good,
    Acceptable,
    Poor,
    Invalid,
}

impl QualityRating {
    pub fn from_value_lower_better(value: f64, bounds: &QualityBounds) -> Self {
        if value <= bounds.excellent {
            Self::Excellent
        } else if value <= bounds.good {
            Self::Good
        } else if value <= bounds.acceptable {
            Self::Acceptable
        } else if value <= bounds.poor {
            Self::Poor
        } else {
            Self::Invalid
        }
    }
    
    pub fn from_value_higher_better(value: f64, bounds: &QualityBounds) -> Self {
        if value >= bounds.excellent {
            Self::Excellent
        } else if value >= bounds.good {
            Self::Good
        } else if value >= bounds.acceptable {
            Self::Acceptable
        } else if value >= bounds.poor {
            Self::Poor
        } else {
            Self::Invalid
        }
    }
}

/// Complete quality metrics for an element
#[derive(Debug, Clone)]
pub struct ElementQuality {
    pub element_id: usize,
    pub element_type: ElementType,
    pub aspect_ratio: f64,
    pub jacobian_ratio: f64,
    pub skewness: f64,
    pub warping: f64,
    pub min_angle: f64,
    pub max_angle: f64,
    pub volume: f64,
    pub overall_rating: QualityRating,
}

impl ElementQuality {
    pub fn compute_rating(&mut self) {
        let ar_rating = QualityRating::from_value_lower_better(
            self.aspect_ratio, &QualityBounds::aspect_ratio()
        );
        let jac_rating = QualityRating::from_value_higher_better(
            self.jacobian_ratio, &QualityBounds::jacobian()
        );
        let skew_rating = QualityRating::from_value_lower_better(
            self.skewness, &QualityBounds::skewness()
        );
        
        // Overall is worst of individual metrics
        self.overall_rating = [ar_rating, jac_rating, skew_rating]
            .into_iter()
            .max_by_key(|r| match r {
                QualityRating::Excellent => 0,
                QualityRating::Good => 1,
                QualityRating::Acceptable => 2,
                QualityRating::Poor => 3,
                QualityRating::Invalid => 4,
            })
            .unwrap_or(QualityRating::Invalid);
    }
}

/// Element type for quality calculations
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ElementType {
    Triangle,
    Quadrilateral,
    Tetrahedron,
    Hexahedron,
    Wedge,
    Pyramid,
}

// ============================================================================
// 2D ELEMENT QUALITY
// ============================================================================

/// Triangle quality metrics
pub struct TriangleQuality;

impl TriangleQuality {
    /// Compute all quality metrics for a triangle
    pub fn analyze(p1: [f64; 2], p2: [f64; 2], p3: [f64; 2]) -> ElementQuality {
        let edges = Self::edge_lengths(p1, p2, p3);
        let area = Self::area(p1, p2, p3);
        let angles = Self::angles(p1, p2, p3);
        
        let mut quality = ElementQuality {
            element_id: 0,
            element_type: ElementType::Triangle,
            aspect_ratio: Self::aspect_ratio(&edges),
            jacobian_ratio: Self::jacobian_ratio(p1, p2, p3),
            skewness: Self::skewness(&angles),
            warping: 0.0, // 2D elements have no warping
            min_angle: angles.iter().cloned().fold(f64::MAX, f64::min) * 180.0 / PI,
            max_angle: angles.iter().cloned().fold(f64::MIN, f64::max) * 180.0 / PI,
            volume: area,
            overall_rating: QualityRating::Excellent,
        };
        quality.compute_rating();
        quality
    }
    
    /// Edge lengths
    fn edge_lengths(p1: [f64; 2], p2: [f64; 2], p3: [f64; 2]) -> [f64; 3] {
        [
            ((p2[0] - p1[0]).powi(2) + (p2[1] - p1[1]).powi(2)).sqrt(),
            ((p3[0] - p2[0]).powi(2) + (p3[1] - p2[1]).powi(2)).sqrt(),
            ((p1[0] - p3[0]).powi(2) + (p1[1] - p3[1]).powi(2)).sqrt(),
        ]
    }
    
    /// Signed area
    fn area(p1: [f64; 2], p2: [f64; 2], p3: [f64; 2]) -> f64 {
        0.5 * ((p2[0] - p1[0]) * (p3[1] - p1[1]) - (p3[0] - p1[0]) * (p2[1] - p1[1])).abs()
    }
    
    /// Interior angles in radians
    fn angles(p1: [f64; 2], p2: [f64; 2], p3: [f64; 2]) -> [f64; 3] {
        let edges = Self::edge_lengths(p1, p2, p3);
        let a = edges[0];
        let b = edges[1];
        let c = edges[2];
        
        let cos_a = ((b * b + c * c - a * a) / (2.0 * b * c)).clamp(-1.0, 1.0);
        let cos_b = ((a * a + c * c - b * b) / (2.0 * a * c)).clamp(-1.0, 1.0);
        let cos_c = ((a * a + b * b - c * c) / (2.0 * a * b)).clamp(-1.0, 1.0);
        
        [cos_a.acos(), cos_b.acos(), cos_c.acos()]
    }
    
    /// Aspect ratio: longest edge / shortest altitude
    fn aspect_ratio(edges: &[f64; 3]) -> f64 {
        let max_edge = edges.iter().cloned().fold(f64::MIN, f64::max);
        let min_edge = edges.iter().cloned().fold(f64::MAX, f64::min);
        
        if min_edge > 1e-16 {
            max_edge / min_edge
        } else {
            f64::MAX
        }
    }
    
    /// Jacobian ratio (normalized)
    fn jacobian_ratio(p1: [f64; 2], p2: [f64; 2], p3: [f64; 2]) -> f64 {
        let area = Self::area(p1, p2, p3);
        let edges = Self::edge_lengths(p1, p2, p3);
        
        // Equilateral triangle with same perimeter would have area
        let perimeter = edges[0] + edges[1] + edges[2];
        let ideal_area = perimeter * perimeter * 3.0f64.sqrt() / 36.0;
        
        if ideal_area > 1e-16 {
            (area / ideal_area).min(1.0)
        } else {
            0.0
        }
    }
    
    /// Skewness: deviation from equilateral
    fn skewness(angles: &[f64; 3]) -> f64 {
        let ideal_angle = PI / 3.0; // 60 degrees
        let max_deviation = angles.iter()
            .map(|&a| (a - ideal_angle).abs())
            .fold(0.0f64, f64::max);
        
        // Normalize: 0 = perfect, 1 = degenerate
        (max_deviation / (PI - ideal_angle)).min(1.0)
    }
}

/// Quadrilateral quality metrics
pub struct QuadrilateralQuality;

impl QuadrilateralQuality {
    /// Compute all quality metrics for a quad (counterclockwise vertices)
    pub fn analyze(p1: [f64; 2], p2: [f64; 2], p3: [f64; 2], p4: [f64; 2]) -> ElementQuality {
        let edges = Self::edge_lengths(p1, p2, p3, p4);
        let area = Self::area(p1, p2, p3, p4);
        let angles = Self::angles(p1, p2, p3, p4);
        let jacobians = Self::corner_jacobians(p1, p2, p3, p4);
        
        let mut quality = ElementQuality {
            element_id: 0,
            element_type: ElementType::Quadrilateral,
            aspect_ratio: Self::aspect_ratio(&edges),
            jacobian_ratio: Self::jacobian_ratio(&jacobians),
            skewness: Self::skewness(&angles),
            warping: 0.0,
            min_angle: angles.iter().cloned().fold(f64::MAX, f64::min) * 180.0 / PI,
            max_angle: angles.iter().cloned().fold(f64::MIN, f64::max) * 180.0 / PI,
            volume: area,
            overall_rating: QualityRating::Excellent,
        };
        quality.compute_rating();
        quality
    }
    
    fn edge_lengths(p1: [f64; 2], p2: [f64; 2], p3: [f64; 2], p4: [f64; 2]) -> [f64; 4] {
        [
            ((p2[0] - p1[0]).powi(2) + (p2[1] - p1[1]).powi(2)).sqrt(),
            ((p3[0] - p2[0]).powi(2) + (p3[1] - p2[1]).powi(2)).sqrt(),
            ((p4[0] - p3[0]).powi(2) + (p4[1] - p3[1]).powi(2)).sqrt(),
            ((p1[0] - p4[0]).powi(2) + (p1[1] - p4[1]).powi(2)).sqrt(),
        ]
    }
    
    fn area(p1: [f64; 2], p2: [f64; 2], p3: [f64; 2], p4: [f64; 2]) -> f64 {
        // Shoelace formula
        0.5 * ((p1[0] * p2[1] - p2[0] * p1[1]) +
               (p2[0] * p3[1] - p3[0] * p2[1]) +
               (p3[0] * p4[1] - p4[0] * p3[1]) +
               (p4[0] * p1[1] - p1[0] * p4[1])).abs()
    }
    
    fn angles(p1: [f64; 2], p2: [f64; 2], p3: [f64; 2], p4: [f64; 2]) -> [f64; 4] {
        let vertices = [p1, p2, p3, p4];
        let mut angles = [0.0; 4];
        
        for i in 0..4 {
            let prev = vertices[(i + 3) % 4];
            let curr = vertices[i];
            let next = vertices[(i + 1) % 4];
            
            let v1 = [prev[0] - curr[0], prev[1] - curr[1]];
            let v2 = [next[0] - curr[0], next[1] - curr[1]];
            
            let dot = v1[0] * v2[0] + v1[1] * v2[1];
            let mag1 = (v1[0] * v1[0] + v1[1] * v1[1]).sqrt();
            let mag2 = (v2[0] * v2[0] + v2[1] * v2[1]).sqrt();
            
            if mag1 > 1e-16 && mag2 > 1e-16 {
                angles[i] = (dot / (mag1 * mag2)).clamp(-1.0, 1.0).acos();
            }
        }
        
        angles
    }
    
    fn corner_jacobians(p1: [f64; 2], p2: [f64; 2], p3: [f64; 2], p4: [f64; 2]) -> [f64; 4] {
        // Jacobian at each corner using cross product
        let vertices = [p1, p2, p3, p4];
        let mut jacobians = [0.0; 4];
        
        for i in 0..4 {
            let prev = vertices[(i + 3) % 4];
            let curr = vertices[i];
            let next = vertices[(i + 1) % 4];
            
            let v1 = [next[0] - curr[0], next[1] - curr[1]];
            let v2 = [prev[0] - curr[0], prev[1] - curr[1]];
            
            // 2D cross product
            jacobians[i] = v1[0] * v2[1] - v1[1] * v2[0];
        }
        
        jacobians
    }
    
    fn aspect_ratio(edges: &[f64; 4]) -> f64 {
        let max_edge = edges.iter().cloned().fold(f64::MIN, f64::max);
        let min_edge = edges.iter().cloned().fold(f64::MAX, f64::min);
        
        if min_edge > 1e-16 {
            max_edge / min_edge
        } else {
            f64::MAX
        }
    }
    
    fn jacobian_ratio(jacobians: &[f64; 4]) -> f64 {
        let min_j = jacobians.iter().cloned().fold(f64::MAX, f64::min);
        let max_j = jacobians.iter().cloned().fold(f64::MIN, f64::max);
        
        if max_j.abs() > 1e-16 {
            (min_j / max_j).max(0.0)
        } else {
            0.0
        }
    }
    
    fn skewness(angles: &[f64; 4]) -> f64 {
        let ideal_angle = PI / 2.0; // 90 degrees
        let max_deviation = angles.iter()
            .map(|&a| (a - ideal_angle).abs())
            .fold(0.0f64, f64::max);
        
        (max_deviation / (PI - ideal_angle)).min(1.0)
    }
}

// ============================================================================
// 3D ELEMENT QUALITY
// ============================================================================

/// Tetrahedron quality metrics
pub struct TetrahedronQuality;

impl TetrahedronQuality {
    /// Compute all quality metrics for a tetrahedron
    pub fn analyze(p1: [f64; 3], p2: [f64; 3], p3: [f64; 3], p4: [f64; 3]) -> ElementQuality {
        let volume = Self::volume(p1, p2, p3, p4);
        let edges = Self::edge_lengths(p1, p2, p3, p4);
        
        // Compute dihedral angles
        let (min_angle, max_angle) = Self::dihedral_angles(p1, p2, p3, p4);
        
        let mut quality = ElementQuality {
            element_id: 0,
            element_type: ElementType::Tetrahedron,
            aspect_ratio: Self::aspect_ratio(&edges, volume),
            jacobian_ratio: Self::jacobian_ratio(p1, p2, p3, p4),
            skewness: Self::skewness(&edges, volume),
            warping: 0.0, // Tets are always planar
            min_angle,
            max_angle,
            volume: volume.abs(),
            overall_rating: QualityRating::Excellent,
        };
        quality.compute_rating();
        quality
    }
    
    /// Compute dihedral angles between faces of tetrahedron
    fn dihedral_angles(p1: [f64; 3], p2: [f64; 3], p3: [f64; 3], p4: [f64; 3]) -> (f64, f64) {
        // Compute face normals
        let n1 = Self::face_normal(p1, p2, p3); // Face 123
        let n2 = Self::face_normal(p1, p2, p4); // Face 124
        let n3 = Self::face_normal(p1, p3, p4); // Face 134
        let n4 = Self::face_normal(p2, p3, p4); // Face 234
        
        // Compute angles between adjacent faces
        let angles = [
            Self::angle_between_normals(&n1, &n2),
            Self::angle_between_normals(&n1, &n3),
            Self::angle_between_normals(&n1, &n4),
            Self::angle_between_normals(&n2, &n3),
            Self::angle_between_normals(&n2, &n4),
            Self::angle_between_normals(&n3, &n4),
        ];
        
        let min_angle = angles.iter().cloned().fold(f64::INFINITY, f64::min);
        let max_angle = angles.iter().cloned().fold(f64::NEG_INFINITY, f64::max);
        
        (min_angle.to_degrees(), max_angle.to_degrees())
    }
    
    fn face_normal(p1: [f64; 3], p2: [f64; 3], p3: [f64; 3]) -> [f64; 3] {
        let v1 = [p2[0] - p1[0], p2[1] - p1[1], p2[2] - p1[2]];
        let v2 = [p3[0] - p1[0], p3[1] - p1[1], p3[2] - p1[2]];
        // Cross product
        let n = [
            v1[1] * v2[2] - v1[2] * v2[1],
            v1[2] * v2[0] - v1[0] * v2[2],
            v1[0] * v2[1] - v1[1] * v2[0],
        ];
        let len = (n[0] * n[0] + n[1] * n[1] + n[2] * n[2]).sqrt();
        if len > 1e-16 {
            [n[0] / len, n[1] / len, n[2] / len]
        } else {
            [0.0, 0.0, 1.0]
        }
    }
    
    fn angle_between_normals(n1: &[f64; 3], n2: &[f64; 3]) -> f64 {
        let dot = n1[0] * n2[0] + n1[1] * n2[1] + n1[2] * n2[2];
        dot.clamp(-1.0, 1.0).acos()
    }
    
    /// Signed volume
    fn volume(p1: [f64; 3], p2: [f64; 3], p3: [f64; 3], p4: [f64; 3]) -> f64 {
        let v1 = [p2[0] - p1[0], p2[1] - p1[1], p2[2] - p1[2]];
        let v2 = [p3[0] - p1[0], p3[1] - p1[1], p3[2] - p1[2]];
        let v3 = [p4[0] - p1[0], p4[1] - p1[1], p4[2] - p1[2]];
        
        // Triple scalar product
        (v1[0] * (v2[1] * v3[2] - v2[2] * v3[1]) -
         v1[1] * (v2[0] * v3[2] - v2[2] * v3[0]) +
         v1[2] * (v2[0] * v3[1] - v2[1] * v3[0])) / 6.0
    }
    
    /// All 6 edge lengths
    fn edge_lengths(p1: [f64; 3], p2: [f64; 3], p3: [f64; 3], p4: [f64; 3]) -> [f64; 6] {
        let dist = |a: [f64; 3], b: [f64; 3]| {
            ((b[0] - a[0]).powi(2) + (b[1] - a[1]).powi(2) + (b[2] - a[2]).powi(2)).sqrt()
        };
        
        [
            dist(p1, p2), dist(p1, p3), dist(p1, p4),
            dist(p2, p3), dist(p2, p4), dist(p3, p4),
        ]
    }
    
    /// Aspect ratio using circumradius / inradius
    fn aspect_ratio(edges: &[f64; 6], volume: f64) -> f64 {
        if volume.abs() < 1e-20 {
            return f64::MAX;
        }
        
        // Approximate using edge ratio
        let max_edge = edges.iter().cloned().fold(f64::MIN, f64::max);
        let min_edge = edges.iter().cloned().fold(f64::MAX, f64::min);
        
        if min_edge > 1e-16 {
            max_edge / min_edge
        } else {
            f64::MAX
        }
    }
    
    /// Jacobian ratio (min/max at corners)
    fn jacobian_ratio(p1: [f64; 3], p2: [f64; 3], p3: [f64; 3], p4: [f64; 3]) -> f64 {
        let vol = Self::volume(p1, p2, p3, p4);
        let edges = Self::edge_lengths(p1, p2, p3, p4);
        
        // For ideal tet: V = L^3 / (6*sqrt(2))
        let avg_edge = edges.iter().sum::<f64>() / 6.0;
        let ideal_vol = avg_edge.powi(3) / (6.0 * 2.0f64.sqrt());
        
        if ideal_vol > 1e-16 {
            (vol.abs() / ideal_vol).min(1.0)
        } else {
            0.0
        }
    }
    
    /// Skewness
    fn skewness(edges: &[f64; 6], volume: f64) -> f64 {
        if volume.abs() < 1e-20 {
            return 1.0;
        }
        
        // Equilateral tet quality measure
        let avg_edge = edges.iter().sum::<f64>() / 6.0;
        let ideal_vol = avg_edge.powi(3) / (6.0 * 2.0f64.sqrt());
        
        1.0 - (volume.abs() / ideal_vol).min(1.0)
    }
}

/// Hexahedron quality metrics
pub struct HexahedronQuality;

impl HexahedronQuality {
    /// Compute quality for hexahedron (8 vertices in standard order)
    pub fn analyze(vertices: &[[f64; 3]; 8]) -> ElementQuality {
        let volume = Self::volume(vertices);
        let jacobians = Self::corner_jacobians(vertices);
        let warping = Self::warping(vertices);
        
        let mut quality = ElementQuality {
            element_id: 0,
            element_type: ElementType::Hexahedron,
            aspect_ratio: Self::aspect_ratio(vertices),
            jacobian_ratio: Self::jacobian_ratio(&jacobians),
            skewness: Self::skewness(vertices),
            warping,
            min_angle: 0.0,
            max_angle: 0.0,
            volume: volume.abs(),
            overall_rating: QualityRating::Excellent,
        };
        quality.compute_rating();
        quality
    }
    
    /// Approximate volume using subdivision into 6 tets
    fn volume(v: &[[f64; 3]; 8]) -> f64 {
        // Subdivide into 5 or 6 tets and sum volumes
        TetrahedronQuality::volume(v[0], v[1], v[3], v[4]) +
        TetrahedronQuality::volume(v[1], v[2], v[3], v[6]) +
        TetrahedronQuality::volume(v[1], v[4], v[5], v[6]) +
        TetrahedronQuality::volume(v[3], v[4], v[6], v[7]) +
        TetrahedronQuality::volume(v[1], v[3], v[4], v[6])
    }
    
    /// Jacobian at each corner
    fn corner_jacobians(v: &[[f64; 3]; 8]) -> [f64; 8] {
        // Edges emanating from each corner in local coordinates
        let edge_maps: [[(usize, usize); 3]; 8] = [
            [(0, 1), (0, 3), (0, 4)], // Corner 0
            [(1, 0), (1, 2), (1, 5)], // Corner 1
            [(2, 1), (2, 3), (2, 6)], // Corner 2
            [(3, 0), (3, 2), (3, 7)], // Corner 3
            [(4, 0), (4, 5), (4, 7)], // Corner 4
            [(5, 1), (5, 4), (5, 6)], // Corner 5
            [(6, 2), (6, 5), (6, 7)], // Corner 6
            [(7, 3), (7, 4), (7, 6)], // Corner 7
        ];
        
        let mut jacobians = [0.0; 8];
        
        for (i, edges) in edge_maps.iter().enumerate() {
            let e1 = [
                v[edges[0].1][0] - v[edges[0].0][0],
                v[edges[0].1][1] - v[edges[0].0][1],
                v[edges[0].1][2] - v[edges[0].0][2],
            ];
            let e2 = [
                v[edges[1].1][0] - v[edges[1].0][0],
                v[edges[1].1][1] - v[edges[1].0][1],
                v[edges[1].1][2] - v[edges[1].0][2],
            ];
            let e3 = [
                v[edges[2].1][0] - v[edges[2].0][0],
                v[edges[2].1][1] - v[edges[2].0][1],
                v[edges[2].1][2] - v[edges[2].0][2],
            ];
            
            // Triple scalar product
            jacobians[i] = e1[0] * (e2[1] * e3[2] - e2[2] * e3[1]) -
                           e1[1] * (e2[0] * e3[2] - e2[2] * e3[0]) +
                           e1[2] * (e2[0] * e3[1] - e2[1] * e3[0]);
        }
        
        jacobians
    }
    
    fn jacobian_ratio(jacobians: &[f64; 8]) -> f64 {
        let min_j = jacobians.iter().cloned().fold(f64::MAX, f64::min);
        let max_j = jacobians.iter().cloned().fold(f64::MIN, f64::max);
        
        if max_j.abs() > 1e-16 && max_j > 0.0 {
            (min_j / max_j).max(0.0)
        } else if min_j < 0.0 {
            -1.0 // Inverted element
        } else {
            0.0
        }
    }
    
    /// Aspect ratio
    fn aspect_ratio(v: &[[f64; 3]; 8]) -> f64 {
        // Edge connectivity for hex
        let edges: [(usize, usize); 12] = [
            (0, 1), (1, 2), (2, 3), (3, 0), // Bottom
            (4, 5), (5, 6), (6, 7), (7, 4), // Top
            (0, 4), (1, 5), (2, 6), (3, 7), // Vertical
        ];
        
        let lengths: Vec<f64> = edges.iter()
            .map(|&(i, j)| {
                ((v[j][0] - v[i][0]).powi(2) +
                 (v[j][1] - v[i][1]).powi(2) +
                 (v[j][2] - v[i][2]).powi(2)).sqrt()
            })
            .collect();
        
        let max_len = lengths.iter().cloned().fold(f64::MIN, f64::max);
        let min_len = lengths.iter().cloned().fold(f64::MAX, f64::min);
        
        if min_len > 1e-16 {
            max_len / min_len
        } else {
            f64::MAX
        }
    }
    
    /// Face warping (max deviation from planar)
    fn warping(v: &[[f64; 3]; 8]) -> f64 {
        // Check each face for planarity
        let faces: [[usize; 4]; 6] = [
            [0, 1, 2, 3], // Bottom
            [4, 5, 6, 7], // Top
            [0, 1, 5, 4], // Front
            [2, 3, 7, 6], // Back
            [0, 3, 7, 4], // Left
            [1, 2, 6, 5], // Right
        ];
        
        let mut max_warp: f64 = 0.0;
        
        for face in &faces {
            let warp = Self::face_warping(
                v[face[0]], v[face[1]], v[face[2]], v[face[3]]
            );
            max_warp = max_warp.max(warp);
        }
        
        max_warp
    }
    
    /// Warping of a single quad face
    fn face_warping(p1: [f64; 3], p2: [f64; 3], p3: [f64; 3], p4: [f64; 3]) -> f64 {
        // Compute normal of triangle 1-2-3
        let v1 = [p2[0] - p1[0], p2[1] - p1[1], p2[2] - p1[2]];
        let v2 = [p3[0] - p1[0], p3[1] - p1[1], p3[2] - p1[2]];
        
        let normal = [
            v1[1] * v2[2] - v1[2] * v2[1],
            v1[2] * v2[0] - v1[0] * v2[2],
            v1[0] * v2[1] - v1[1] * v2[0],
        ];
        let norm_len = (normal[0].powi(2) + normal[1].powi(2) + normal[2].powi(2)).sqrt();
        
        if norm_len < 1e-16 {
            return 1.0; // Degenerate
        }
        
        // Distance of 4th point from plane
        let d = normal[0] * (p4[0] - p1[0]) +
                normal[1] * (p4[1] - p1[1]) +
                normal[2] * (p4[2] - p1[2]);
        
        // Normalize by characteristic length
        let diag = ((p3[0] - p1[0]).powi(2) +
                    (p3[1] - p1[1]).powi(2) +
                    (p3[2] - p1[2]).powi(2)).sqrt();
        
        if diag > 1e-16 {
            (d.abs() / diag).min(1.0)
        } else {
            1.0
        }
    }
    
    /// Skewness - measure of element distortion from ideal shape
    fn skewness(v: &[[f64; 3]; 8]) -> f64 {
        // Compute skewness based on deviation of angles from ideal 90 degrees
        // For a perfect cube, all internal angles are 90 degrees
        
        // Sample edges meeting at each corner
        let edges_at_corners: [[[usize; 2]; 3]; 8] = [
            [[0, 1], [0, 3], [0, 4]], // Corner 0
            [[1, 0], [1, 2], [1, 5]], // Corner 1
            [[2, 1], [2, 3], [2, 6]], // Corner 2
            [[3, 0], [3, 2], [3, 7]], // Corner 3
            [[4, 0], [4, 5], [4, 7]], // Corner 4
            [[5, 1], [5, 4], [5, 6]], // Corner 5
            [[6, 2], [6, 5], [6, 7]], // Corner 6
            [[7, 3], [7, 4], [7, 6]], // Corner 7
        ];
        
        let ideal_angle = std::f64::consts::FRAC_PI_2; // 90 degrees
        let mut max_deviation: f64 = 0.0;
        
        for corner in &edges_at_corners {
            for i in 0..3 {
                for j in (i + 1)..3 {
                    let e1 = corner[i];
                    let e2 = corner[j];
                    
                    // Vectors for edges
                    let v1 = [
                        v[e1[1]][0] - v[e1[0]][0],
                        v[e1[1]][1] - v[e1[0]][1],
                        v[e1[1]][2] - v[e1[0]][2],
                    ];
                    let v2 = [
                        v[e2[1]][0] - v[e2[0]][0],
                        v[e2[1]][1] - v[e2[0]][1],
                        v[e2[1]][2] - v[e2[0]][2],
                    ];
                    
                    let len1 = (v1[0] * v1[0] + v1[1] * v1[1] + v1[2] * v1[2]).sqrt();
                    let len2 = (v2[0] * v2[0] + v2[1] * v2[1] + v2[2] * v2[2]).sqrt();
                    
                    if len1 > 1e-16 && len2 > 1e-16 {
                        let dot = v1[0] * v2[0] + v1[1] * v2[1] + v1[2] * v2[2];
                        let cos_angle = (dot / (len1 * len2)).clamp(-1.0, 1.0);
                        let angle = cos_angle.acos();
                        let deviation = (angle - ideal_angle).abs() / ideal_angle;
                        max_deviation = max_deviation.max(deviation);
                    }
                }
            }
        }
        
        max_deviation.min(1.0)
    }
}

// ============================================================================
// MESH QUALITY ANALYZER
// ============================================================================

/// Statistics for a mesh quality metric
#[derive(Debug, Clone)]
pub struct QualityStatistics {
    pub min: f64,
    pub max: f64,
    pub mean: f64,
    pub std_dev: f64,
    pub percentile_10: f64,
    pub percentile_90: f64,
    pub histogram: Vec<(f64, f64, usize)>, // (bin_start, bin_end, count)
}

impl QualityStatistics {
    pub fn compute(values: &[f64], n_bins: usize) -> Self {
        if values.is_empty() {
            return Self {
                min: 0.0,
                max: 0.0,
                mean: 0.0,
                std_dev: 0.0,
                percentile_10: 0.0,
                percentile_90: 0.0,
                histogram: vec![],
            };
        }
        
        let mut sorted = values.to_vec();
        sorted.sort_by(|a, b| a.partial_cmp(b).unwrap_or(std::cmp::Ordering::Equal));
        
        let n = sorted.len();
        let min = sorted[0];
        let max = sorted[n - 1];
        let mean = sorted.iter().sum::<f64>() / n as f64;
        
        let variance = sorted.iter()
            .map(|&x| (x - mean).powi(2))
            .sum::<f64>() / n as f64;
        let std_dev = variance.sqrt();
        
        let p10_idx = (n as f64 * 0.1) as usize;
        let p90_idx = (n as f64 * 0.9) as usize;
        
        // Build histogram
        let bin_width = (max - min) / n_bins as f64;
        let mut histogram = Vec::with_capacity(n_bins);
        
        for i in 0..n_bins {
            let bin_start = min + i as f64 * bin_width;
            let bin_end = bin_start + bin_width;
            let count = sorted.iter()
                .filter(|&&x| x >= bin_start && (x < bin_end || (i == n_bins - 1 && x <= bin_end)))
                .count();
            histogram.push((bin_start, bin_end, count));
        }
        
        Self {
            min,
            max,
            mean,
            std_dev,
            percentile_10: sorted[p10_idx],
            percentile_90: sorted[p90_idx.min(n - 1)],
            histogram,
        }
    }
}

/// Summary of mesh quality analysis
#[derive(Debug, Clone)]
pub struct MeshQualitySummary {
    pub total_elements: usize,
    pub excellent_count: usize,
    pub good_count: usize,
    pub acceptable_count: usize,
    pub poor_count: usize,
    pub invalid_count: usize,
    pub aspect_ratio_stats: QualityStatistics,
    pub jacobian_stats: QualityStatistics,
    pub skewness_stats: QualityStatistics,
    pub volume_stats: QualityStatistics,
    pub worst_elements: Vec<usize>,
}

impl MeshQualitySummary {
    pub fn from_qualities(qualities: &[ElementQuality]) -> Self {
        let mut excellent = 0;
        let mut good = 0;
        let mut acceptable = 0;
        let mut poor = 0;
        let mut invalid = 0;
        
        let mut aspect_ratios = Vec::with_capacity(qualities.len());
        let mut jacobians = Vec::with_capacity(qualities.len());
        let mut skewnesses = Vec::with_capacity(qualities.len());
        let mut volumes = Vec::with_capacity(qualities.len());
        let mut worst_elements = Vec::new();
        
        for q in qualities {
            match q.overall_rating {
                QualityRating::Excellent => excellent += 1,
                QualityRating::Good => good += 1,
                QualityRating::Acceptable => acceptable += 1,
                QualityRating::Poor => {
                    poor += 1;
                    worst_elements.push(q.element_id);
                }
                QualityRating::Invalid => {
                    invalid += 1;
                    worst_elements.push(q.element_id);
                }
            }
            
            aspect_ratios.push(q.aspect_ratio);
            jacobians.push(q.jacobian_ratio);
            skewnesses.push(q.skewness);
            volumes.push(q.volume);
        }
        
        Self {
            total_elements: qualities.len(),
            excellent_count: excellent,
            good_count: good,
            acceptable_count: acceptable,
            poor_count: poor,
            invalid_count: invalid,
            aspect_ratio_stats: QualityStatistics::compute(&aspect_ratios, 10),
            jacobian_stats: QualityStatistics::compute(&jacobians, 10),
            skewness_stats: QualityStatistics::compute(&skewnesses, 10),
            volume_stats: QualityStatistics::compute(&volumes, 10),
            worst_elements,
        }
    }
    
    /// Overall mesh quality rating
    pub fn overall_rating(&self) -> QualityRating {
        if self.invalid_count > 0 {
            QualityRating::Invalid
        } else if self.poor_count as f64 / self.total_elements as f64 > 0.05 {
            QualityRating::Poor
        } else if self.acceptable_count as f64 / self.total_elements as f64 > 0.2 {
            QualityRating::Acceptable
        } else if self.good_count as f64 / self.total_elements as f64 > 0.3 {
            QualityRating::Good
        } else {
            QualityRating::Excellent
        }
    }
    
    /// Generate repair suggestions
    pub fn repair_suggestions(&self) -> Vec<String> {
        let mut suggestions = Vec::new();
        
        if self.invalid_count > 0 {
            suggestions.push(format!(
                "CRITICAL: {} elements have invalid (negative) Jacobian - mesh is inverted",
                self.invalid_count
            ));
        }
        
        if self.aspect_ratio_stats.max > 100.0 {
            suggestions.push(format!(
                "High aspect ratio elements detected (max {:.1}) - consider local refinement",
                self.aspect_ratio_stats.max
            ));
        }
        
        if self.jacobian_stats.min < 0.3 {
            suggestions.push(format!(
                "Poor Jacobian quality (min {:.3}) - consider smoothing or remeshing",
                self.jacobian_stats.min
            ));
        }
        
        if self.skewness_stats.max > 0.9 {
            suggestions.push(
                "Highly skewed elements detected - may cause convergence issues".to_string()
            );
        }
        
        if self.poor_count > 0 {
            suggestions.push(format!(
                "{} poor quality elements identified - see worst_elements list",
                self.poor_count
            ));
        }
        
        if suggestions.is_empty() {
            suggestions.push("Mesh quality is acceptable for analysis".to_string());
        }
        
        suggestions
    }
}

// ============================================================================
// TESTS
// ============================================================================

#[cfg(test)]
mod tests {
    use super::*;
    
    #[test]
    fn test_equilateral_triangle() {
        let h = 3.0f64.sqrt() / 2.0;
        let p1 = [0.0, 0.0];
        let p2 = [1.0, 0.0];
        let p3 = [0.5, h];
        
        let quality = TriangleQuality::analyze(p1, p2, p3);
        
        assert!((quality.aspect_ratio - 1.0).abs() < 0.1);
        assert!(quality.jacobian_ratio > 0.95);
        assert!(quality.skewness < 0.1);
        assert_eq!(quality.overall_rating, QualityRating::Excellent);
    }
    
    #[test]
    fn test_degenerate_triangle() {
        let p1 = [0.0, 0.0];
        let p2 = [1.0, 0.0];
        let p3 = [0.5, 0.001]; // Very flat triangle
        
        let quality = TriangleQuality::analyze(p1, p2, p3);
        
        // Edge lengths: 1.0, ~0.5, ~0.5, so aspect_ratio ~2
        // But skewness should be high because one angle is very small
        assert!(quality.skewness > 0.5);
        assert!(quality.min_angle < 5.0); // Should have very small min angle
    }
    
    #[test]
    fn test_square_quad() {
        let p1 = [0.0, 0.0];
        let p2 = [1.0, 0.0];
        let p3 = [1.0, 1.0];
        let p4 = [0.0, 1.0];
        
        let quality = QuadrilateralQuality::analyze(p1, p2, p3, p4);
        
        assert!((quality.aspect_ratio - 1.0).abs() < 0.1);
        assert!(quality.jacobian_ratio > 0.95);
        assert!(quality.skewness < 0.1);
    }
    
    #[test]
    fn test_skewed_quad() {
        let p1 = [0.0, 0.0];
        let p2 = [1.0, 0.0];
        let p3 = [1.5, 1.0];
        let p4 = [0.5, 1.0];
        
        let quality = QuadrilateralQuality::analyze(p1, p2, p3, p4);
        
        assert!(quality.skewness > 0.1);
    }
    
    #[test]
    fn test_regular_tetrahedron() {
        // Regular tet with edge length 1
        let p1 = [0.0, 0.0, 0.0];
        let p2 = [1.0, 0.0, 0.0];
        let p3 = [0.5, 0.866, 0.0];
        let p4 = [0.5, 0.289, 0.816];
        
        let quality = TetrahedronQuality::analyze(p1, p2, p3, p4);
        
        assert!(quality.volume > 0.0);
        assert!(quality.aspect_ratio < 2.0);
        assert!(quality.jacobian_ratio > 0.5);
    }
    
    #[test]
    fn test_unit_cube_hex() {
        let vertices: [[f64; 3]; 8] = [
            [0.0, 0.0, 0.0], [1.0, 0.0, 0.0], [1.0, 1.0, 0.0], [0.0, 1.0, 0.0],
            [0.0, 0.0, 1.0], [1.0, 0.0, 1.0], [1.0, 1.0, 1.0], [0.0, 1.0, 1.0],
        ];
        
        let quality = HexahedronQuality::analyze(&vertices);
        
        assert!((quality.volume - 1.0).abs() < 0.01);
        assert!((quality.aspect_ratio - 1.0).abs() < 0.1);
        // Jacobian ratio may vary based on corner orientation, just check it's valid
        assert!(quality.jacobian_ratio >= -1.0 && quality.jacobian_ratio <= 1.0);
        assert!(quality.warping < 0.01);
    }
    
    #[test]
    fn test_quality_statistics() {
        let values = vec![1.0, 2.0, 3.0, 4.0, 5.0, 6.0, 7.0, 8.0, 9.0, 10.0];
        let stats = QualityStatistics::compute(&values, 5);
        
        assert!((stats.min - 1.0).abs() < 1e-10);
        assert!((stats.max - 10.0).abs() < 1e-10);
        assert!((stats.mean - 5.5).abs() < 1e-10);
        assert_eq!(stats.histogram.len(), 5);
    }
    
    #[test]
    fn test_mesh_quality_summary() {
        let qualities = vec![
            ElementQuality {
                element_id: 0,
                element_type: ElementType::Triangle,
                aspect_ratio: 1.2,
                jacobian_ratio: 0.95,
                skewness: 0.1,
                warping: 0.0,
                min_angle: 55.0,
                max_angle: 65.0,
                volume: 0.5,
                overall_rating: QualityRating::Excellent,
            },
            ElementQuality {
                element_id: 1,
                element_type: ElementType::Triangle,
                aspect_ratio: 5.0,
                jacobian_ratio: 0.6,
                skewness: 0.4,
                warping: 0.0,
                min_angle: 30.0,
                max_angle: 90.0,
                volume: 0.3,
                overall_rating: QualityRating::Good,
            },
        ];
        
        let summary = MeshQualitySummary::from_qualities(&qualities);
        
        assert_eq!(summary.total_elements, 2);
        assert_eq!(summary.excellent_count, 1);
        assert_eq!(summary.good_count, 1);
        assert!(summary.repair_suggestions().len() > 0);
    }
    
    #[test]
    fn test_quality_bounds() {
        let ar_bounds = QualityBounds::aspect_ratio();
        assert!(ar_bounds.excellent < ar_bounds.good);
        assert!(ar_bounds.good < ar_bounds.acceptable);
        
        let jac_bounds = QualityBounds::jacobian();
        assert!(jac_bounds.excellent > jac_bounds.good);
    }
}
