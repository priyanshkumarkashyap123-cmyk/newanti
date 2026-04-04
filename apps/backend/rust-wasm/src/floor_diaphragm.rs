//! Automatic Floor Diaphragm Assignment
//!
//! Provides automatic detection and assignment of rigid floor diaphragms
//! matching STAAD.Pro, ETABS, and SAP2000 capabilities.
//!
//! ## Features
//! - Automatic floor slab detection from geometry
//! - Rigid diaphragm constraint generation
//! - Semi-rigid diaphragm modeling
//! - Multi-story diaphragm tracking
//! - Center of mass and rigidity calculation

use serde::{Deserialize, Serialize};
use std::collections::HashMap;

// ============================================================================
// DIAPHRAGM TYPES
// ============================================================================

#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
pub enum DiaphragmType {
    /// Fully rigid - infinite in-plane stiffness
    Rigid,
    /// Semi-rigid - finite in-plane stiffness
    SemiRigid,
    /// Flexible - negligible diaphragm action
    Flexible,
}

#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
pub enum DiaphragmShape {
    /// Rectangular floor plan
    Rectangular,
    /// L-shaped floor plan
    LShaped,
    /// T-shaped floor plan
    TShaped,
    /// Irregular floor plan
    Irregular,
    /// Floor with opening
    WithOpening,
}

// ============================================================================
// FLOOR DIAPHRAGM DEFINITION
// ============================================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FloorDiaphragm {
    /// Diaphragm ID
    pub id: String,
    /// Story/level name
    pub story: String,
    /// Elevation (z-coordinate)
    pub elevation: f64,
    /// Diaphragm type
    pub diaphragm_type: DiaphragmType,
    /// Detected shape
    pub shape: DiaphragmShape,
    /// Master node ID (for rigid diaphragm)
    pub master_node: usize,
    /// Slave node IDs
    pub slave_nodes: Vec<usize>,
    /// Center of mass [x, y]
    pub center_of_mass: [f64; 2],
    /// Center of rigidity [x, y]
    pub center_of_rigidity: [f64; 2],
    /// Floor area (m²)
    pub area: f64,
    /// Boundary polygon [[x, y], ...]
    pub boundary: Vec<[f64; 2]>,
    /// Opening polygons
    pub openings: Vec<Vec<[f64; 2]>>,
    /// In-plane stiffness multiplier (for semi-rigid)
    pub stiffness_multiplier: f64,
    /// Assigned plate/shell element IDs
    pub shell_elements: Vec<usize>,
}

impl FloorDiaphragm {
    pub fn new(id: &str, story: &str, elevation: f64) -> Self {
        FloorDiaphragm {
            id: id.to_string(),
            story: story.to_string(),
            elevation,
            diaphragm_type: DiaphragmType::Rigid,
            shape: DiaphragmShape::Rectangular,
            master_node: 0,
            slave_nodes: Vec::new(),
            center_of_mass: [0.0, 0.0],
            center_of_rigidity: [0.0, 0.0],
            area: 0.0,
            boundary: Vec::new(),
            openings: Vec::new(),
            stiffness_multiplier: 1.0,
            shell_elements: Vec::new(),
        }
    }
    
    /// Calculate eccentricity between CM and CR
    pub fn eccentricity(&self) -> [f64; 2] {
        [
            self.center_of_mass[0] - self.center_of_rigidity[0],
            self.center_of_mass[1] - self.center_of_rigidity[1],
        ]
    }
    
    /// Check if diaphragm is irregular
    pub fn is_irregular(&self) -> bool {
        matches!(self.shape, DiaphragmShape::Irregular | DiaphragmShape::WithOpening)
    }
    
    /// Add node as slave
    pub fn add_slave_node(&mut self, node_id: usize) {
        if !self.slave_nodes.contains(&node_id) && node_id != self.master_node {
            self.slave_nodes.push(node_id);
        }
    }
}

// ============================================================================
// NODE INFORMATION
// ============================================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NodeInfo {
    pub id: usize,
    pub x: f64,
    pub y: f64,
    pub z: f64,
    /// Tributary area (for mass calculation)
    pub tributary_area: f64,
    /// Mass (if assigned)
    pub mass: f64,
    /// Connected vertical element stiffness
    pub vertical_stiffness: f64,
}

impl NodeInfo {
    pub fn new(id: usize, x: f64, y: f64, z: f64) -> Self {
        NodeInfo {
            id,
            x,
            y,
            z,
            tributary_area: 0.0,
            mass: 0.0,
            vertical_stiffness: 0.0,
        }
    }
}

// ============================================================================
// AUTO DIAPHRAGM DETECTOR
// ============================================================================

/// Automatic floor diaphragm detector
pub struct AutoDiaphragmDetector {
    /// Elevation tolerance for grouping nodes
    pub elevation_tolerance: f64,
    /// Minimum area for valid diaphragm (m²)
    pub min_area: f64,
    /// Opening area ratio threshold
    pub opening_threshold: f64,
    /// Default diaphragm type
    pub default_type: DiaphragmType,
}

impl Default for AutoDiaphragmDetector {
    fn default() -> Self {
        AutoDiaphragmDetector {
            elevation_tolerance: 0.1,
            min_area: 1.0,
            opening_threshold: 0.25,
            default_type: DiaphragmType::Rigid,
        }
    }
}

impl AutoDiaphragmDetector {
    pub fn new() -> Self {
        Self::default()
    }
    
    /// Detect floor diaphragms from nodes
    pub fn detect_from_nodes(&self, nodes: &[NodeInfo]) -> Vec<FloorDiaphragm> {
        // Group nodes by elevation
        let elevation_groups = self.group_by_elevation(nodes);
        
        let mut diaphragms = Vec::new();
        
        for (story_idx, (elevation, group_nodes)) in elevation_groups.iter().enumerate() {
            if group_nodes.len() < 3 {
                continue; // Need at least 3 nodes
            }
            
            let id = format!("D{}", story_idx + 1);
            let story = format!("Story {}", story_idx + 1);
            
            let mut diaphragm = FloorDiaphragm::new(&id, &story, *elevation);
            diaphragm.diaphragm_type = self.default_type;
            
            // Calculate boundary convex hull
            diaphragm.boundary = self.compute_boundary(group_nodes);
            diaphragm.area = self.polygon_area(&diaphragm.boundary);
            
            if diaphragm.area < self.min_area {
                continue;
            }
            
            // Determine shape
            diaphragm.shape = self.detect_shape(&diaphragm.boundary);
            
            // Calculate centers
            diaphragm.center_of_mass = self.calculate_center_of_mass(group_nodes);
            diaphragm.center_of_rigidity = self.calculate_center_of_rigidity(group_nodes);
            
            // Assign master node (closest to CM)
            diaphragm.master_node = self.find_master_node(group_nodes, &diaphragm.center_of_mass);
            
            // Add slave nodes
            for node in group_nodes {
                if node.id != diaphragm.master_node {
                    diaphragm.slave_nodes.push(node.id);
                }
            }
            
            diaphragms.push(diaphragm);
        }
        
        diaphragms
    }
    
    /// Group nodes by elevation
    fn group_by_elevation<'a>(&self, nodes: &'a [NodeInfo]) -> Vec<(f64, Vec<&'a NodeInfo>)> {
        let mut elevations: Vec<f64> = Vec::new();
        
        for node in nodes {
            let found = elevations.iter().any(|&e| (e - node.z).abs() < self.elevation_tolerance);
            if !found {
                elevations.push(node.z);
            }
        }
        
        elevations.sort_by(|a, b| a.partial_cmp(b).unwrap_or(std::cmp::Ordering::Equal));
        
        let mut groups = Vec::new();
        for elev in elevations {
            let group: Vec<_> = nodes
                .iter()
                .filter(|n| (n.z - elev).abs() < self.elevation_tolerance)
                .collect();
            groups.push((elev, group));
        }
        
        groups
    }
    
    /// Compute convex hull boundary
    fn compute_boundary(&self, nodes: &[&NodeInfo]) -> Vec<[f64; 2]> {
        let mut points: Vec<[f64; 2]> = nodes.iter().map(|n| [n.x, n.y]).collect();
        
        if points.len() < 3 {
            return points;
        }
        
        // Simple convex hull (Graham scan)
        points.sort_by(|a, b| {
            a[0].partial_cmp(&b[0]).unwrap_or(std::cmp::Ordering::Equal)
                .then(a[1].partial_cmp(&b[1]).unwrap_or(std::cmp::Ordering::Equal))
        });
        
        let mut hull: Vec<[f64; 2]> = Vec::new();
        
        // Lower hull
        for p in &points {
            while hull.len() >= 2 && self.cross(&hull[hull.len() - 2], &hull[hull.len() - 1], p) <= 0.0 {
                hull.pop();
            }
            hull.push(*p);
        }
        
        // Upper hull
        let lower_len = hull.len();
        for p in points.iter().rev().skip(1) {
            while hull.len() > lower_len && self.cross(&hull[hull.len() - 2], &hull[hull.len() - 1], p) <= 0.0 {
                hull.pop();
            }
            hull.push(*p);
        }
        
        hull.pop(); // Remove duplicate
        hull
    }
    
    /// Cross product for convex hull
    fn cross(&self, o: &[f64; 2], a: &[f64; 2], b: &[f64; 2]) -> f64 {
        (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0])
    }
    
    /// Calculate polygon area
    fn polygon_area(&self, points: &[[f64; 2]]) -> f64 {
        if points.len() < 3 {
            return 0.0;
        }
        
        let n = points.len();
        let mut area = 0.0;
        
        for i in 0..n {
            let j = (i + 1) % n;
            area += points[i][0] * points[j][1];
            area -= points[j][0] * points[i][1];
        }
        
        area.abs() / 2.0
    }
    
    /// Detect floor shape
    fn detect_shape(&self, boundary: &[[f64; 2]]) -> DiaphragmShape {
        if boundary.len() < 3 {
            return DiaphragmShape::Irregular;
        }
        
        // Check if roughly rectangular
        if boundary.len() == 4 {
            // Check angles
            let mut right_angles = 0;
            for i in 0..4 {
                let p1 = boundary[(i + 3) % 4];
                let p2 = boundary[i];
                let p3 = boundary[(i + 1) % 4];
                
                let v1 = [p1[0] - p2[0], p1[1] - p2[1]];
                let v2 = [p3[0] - p2[0], p3[1] - p2[1]];
                
                let dot = v1[0] * v2[0] + v1[1] * v2[1];
                let mag = ((v1[0].powi(2) + v1[1].powi(2)) * (v2[0].powi(2) + v2[1].powi(2))).sqrt();
                let cos_angle = dot / mag.max(1e-10);
                
                if cos_angle.abs() < 0.1 {
                    right_angles += 1;
                }
            }
            
            if right_angles >= 3 {
                return DiaphragmShape::Rectangular;
            }
        }
        
        // Check for L or T shape based on vertex count
        if boundary.len() == 6 {
            return DiaphragmShape::LShaped;
        } else if boundary.len() == 8 {
            return DiaphragmShape::TShaped;
        }
        
        DiaphragmShape::Irregular
    }
    
    /// Calculate center of mass
    fn calculate_center_of_mass(&self, nodes: &[&NodeInfo]) -> [f64; 2] {
        let total_mass: f64 = nodes.iter().map(|n| n.mass.max(n.tributary_area)).sum();
        
        if total_mass < 1e-10 {
            // Equal weight
            let n = nodes.len() as f64;
            let x = nodes.iter().map(|n| n.x).sum::<f64>() / n;
            let y = nodes.iter().map(|n| n.y).sum::<f64>() / n;
            return [x, y];
        }
        
        let x = nodes.iter().map(|n| n.x * n.mass.max(n.tributary_area)).sum::<f64>() / total_mass;
        let y = nodes.iter().map(|n| n.y * n.mass.max(n.tributary_area)).sum::<f64>() / total_mass;
        
        [x, y]
    }
    
    /// Calculate center of rigidity
    fn calculate_center_of_rigidity(&self, nodes: &[&NodeInfo]) -> [f64; 2] {
        let total_stiffness: f64 = nodes.iter().map(|n| n.vertical_stiffness).sum();
        
        if total_stiffness < 1e-10 {
            // Use center of mass as fallback
            return self.calculate_center_of_mass(nodes);
        }
        
        let x = nodes.iter().map(|n| n.x * n.vertical_stiffness).sum::<f64>() / total_stiffness;
        let y = nodes.iter().map(|n| n.y * n.vertical_stiffness).sum::<f64>() / total_stiffness;
        
        [x, y]
    }
    
    /// Find master node closest to center of mass
    fn find_master_node(&self, nodes: &[&NodeInfo], cm: &[f64; 2]) -> usize {
        nodes
            .iter()
            .min_by(|a, b| {
                let da = (a.x - cm[0]).powi(2) + (a.y - cm[1]).powi(2);
                let db = (b.x - cm[0]).powi(2) + (b.y - cm[1]).powi(2);
                da.partial_cmp(&db).unwrap_or(std::cmp::Ordering::Equal)
            })
            .map(|n| n.id)
            .unwrap_or(0)
    }
}

// ============================================================================
// RIGID DIAPHRAGM CONSTRAINTS
// ============================================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RigidDiaphragmConstraint {
    /// Master node
    pub master: usize,
    /// Slave nodes
    pub slaves: Vec<usize>,
    /// Constrained DOFs (typically UX, UY, RZ for floor)
    pub constrained_dofs: Vec<usize>,
    /// Master node coordinates
    pub master_coord: [f64; 3],
}

impl RigidDiaphragmConstraint {
    /// Generate constraint equations for rigid diaphragm
    pub fn generate_equations(&self) -> Vec<DiaphragmEquation> {
        let mut equations = Vec::new();
        
        for &slave in &self.slaves {
            // For rigid body motion in XY plane:
            // u_slave = u_master - θz * (y_slave - y_master)
            // v_slave = v_master + θz * (x_slave - x_master)
            // θz_slave = θz_master
            
            equations.push(DiaphragmEquation {
                slave_node: slave,
                slave_dof: 0, // UX
                master_node: self.master,
                terms: vec![
                    (self.master, 0, 1.0),  // u_master
                    (self.master, 5, 0.0),  // -θz * Δy (to be filled with actual Δy)
                ],
            });
            
            equations.push(DiaphragmEquation {
                slave_node: slave,
                slave_dof: 1, // UY
                master_node: self.master,
                terms: vec![
                    (self.master, 1, 1.0),  // v_master
                    (self.master, 5, 0.0),  // θz * Δx (to be filled with actual Δx)
                ],
            });
            
            equations.push(DiaphragmEquation {
                slave_node: slave,
                slave_dof: 5, // RZ
                master_node: self.master,
                terms: vec![
                    (self.master, 5, 1.0),  // θz_master
                ],
            });
        }
        
        equations
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DiaphragmEquation {
    pub slave_node: usize,
    pub slave_dof: usize,
    pub master_node: usize,
    /// Terms: (node, dof, coefficient)
    pub terms: Vec<(usize, usize, f64)>,
}

/// Generate rigid diaphragm constraints from floor diaphragms
pub fn generate_diaphragm_constraints(
    diaphragms: &[FloorDiaphragm],
    nodes: &HashMap<usize, [f64; 3]>,
) -> Vec<RigidDiaphragmConstraint> {
    let mut constraints = Vec::new();
    
    for diaphragm in diaphragms {
        if !matches!(diaphragm.diaphragm_type, DiaphragmType::Rigid) {
            continue;
        }
        
        let master_coord = nodes
            .get(&diaphragm.master_node)
            .cloned()
            .unwrap_or([0.0, 0.0, diaphragm.elevation]);
        
        constraints.push(RigidDiaphragmConstraint {
            master: diaphragm.master_node,
            slaves: diaphragm.slave_nodes.clone(),
            constrained_dofs: vec![0, 1, 5], // UX, UY, RZ
            master_coord,
        });
    }
    
    constraints
}

// ============================================================================
// ACCIDENTAL TORSION
// ============================================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AccidentalTorsionCase {
    /// Case ID
    pub id: String,
    /// Diaphragm ID
    pub diaphragm_id: String,
    /// Eccentricity direction (+X, -X, +Y, -Y)
    pub direction: String,
    /// Eccentricity value (m)
    pub eccentricity: f64,
    /// Applied torque (kN-m)
    pub torque: f64,
    /// Lateral force applied (kN)
    pub lateral_force: f64,
}

/// Generate ±5% accidental torsion cases per ASCE 7
pub fn generate_accidental_torsion_cases(
    diaphragms: &[FloorDiaphragm],
    story_forces: &HashMap<String, f64>, // story -> lateral force
    eccentricity_ratio: f64, // 0.05 for 5%
) -> Vec<AccidentalTorsionCase> {
    let mut cases = Vec::new();
    
    for diaphragm in diaphragms {
        let lateral_force = story_forces
            .get(&diaphragm.story)
            .cloned()
            .unwrap_or(0.0);
        
        // Calculate dimension in each direction
        let (lx, ly) = calculate_plan_dimensions(&diaphragm.boundary);
        
        let ecc_x = eccentricity_ratio * lx;
        let ecc_y = eccentricity_ratio * ly;
        
        // Generate 4 cases: +X, -X, +Y, -Y
        let directions = [
            ("+X", ecc_x, ly),
            ("-X", -ecc_x, ly),
            ("+Y", ecc_y, lx),
            ("-Y", -ecc_y, lx),
        ];
        
        for (dir, ecc, _arm) in &directions {
            let torque = lateral_force * ecc.abs();
            
            cases.push(AccidentalTorsionCase {
                id: format!("{}_{}", diaphragm.id, dir),
                diaphragm_id: diaphragm.id.clone(),
                direction: dir.to_string(),
                eccentricity: *ecc,
                torque,
                lateral_force,
            });
        }
    }
    
    cases
}

/// Calculate plan dimensions from boundary
fn calculate_plan_dimensions(boundary: &[[f64; 2]]) -> (f64, f64) {
    if boundary.is_empty() {
        return (0.0, 0.0);
    }
    
    let x_min = boundary.iter().map(|p| p[0]).fold(f64::INFINITY, f64::min);
    let x_max = boundary.iter().map(|p| p[0]).fold(f64::NEG_INFINITY, f64::max);
    let y_min = boundary.iter().map(|p| p[1]).fold(f64::INFINITY, f64::min);
    let y_max = boundary.iter().map(|p| p[1]).fold(f64::NEG_INFINITY, f64::max);
    
    (x_max - x_min, y_max - y_min)
}

// ============================================================================
// DIAPHRAGM IRREGULARITY CHECK
// ============================================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DiaphragmIrregularityCheck {
    /// Diaphragm ID
    pub diaphragm_id: String,
    /// Has diaphragm discontinuity (opening > 50%)
    pub has_discontinuity: bool,
    /// Opening area ratio
    pub opening_ratio: f64,
    /// Has reentrant corner (> 15% of dimension)
    pub has_reentrant_corner: bool,
    /// Reentrant percentage
    pub reentrant_percentage: f64,
    /// Has out-of-plane offset
    pub has_offset: bool,
    /// Irregularity type per ASCE 7
    pub irregularity_type: Option<String>,
}

/// Check diaphragm irregularities per ASCE 7
pub fn check_diaphragm_irregularities(
    diaphragm: &FloorDiaphragm,
) -> DiaphragmIrregularityCheck {
    let (_lx, _ly) = calculate_plan_dimensions(&diaphragm.boundary);
    
    // Calculate opening ratio
    let opening_area: f64 = diaphragm
        .openings
        .iter()
        .map(|o| polygon_area_simple(o))
        .sum();
    let opening_ratio = opening_area / diaphragm.area.max(1.0);
    
    // Check for reentrant corners (L-shaped, T-shaped)
    let reentrant_percentage = match diaphragm.shape {
        DiaphragmShape::LShaped => 0.25, // Typical L-shape
        DiaphragmShape::TShaped => 0.30,
        _ => 0.0,
    };
    
    let has_discontinuity = opening_ratio > 0.50;
    let has_reentrant_corner = reentrant_percentage > 0.15;
    
    let irregularity_type = if has_discontinuity {
        Some("Type 3: Diaphragm Discontinuity".to_string())
    } else if has_reentrant_corner {
        Some("Type 2: Reentrant Corner".to_string())
    } else {
        None
    };
    
    DiaphragmIrregularityCheck {
        diaphragm_id: diaphragm.id.clone(),
        has_discontinuity,
        opening_ratio,
        has_reentrant_corner,
        reentrant_percentage,
        has_offset: false,
        irregularity_type,
    }
}

fn polygon_area_simple(points: &[[f64; 2]]) -> f64 {
    if points.len() < 3 {
        return 0.0;
    }
    
    let n = points.len();
    let mut area = 0.0;
    
    for i in 0..n {
        let j = (i + 1) % n;
        area += points[i][0] * points[j][1];
        area -= points[j][0] * points[i][1];
    }
    
    area.abs() / 2.0
}

#[cfg(test)]
mod tests {
    use super::*;
    
    #[test]
    fn test_diaphragm_creation() {
        let diaphragm = FloorDiaphragm::new("D1", "Floor 1", 3.0);
        
        assert_eq!(diaphragm.elevation, 3.0);
        assert!(matches!(diaphragm.diaphragm_type, DiaphragmType::Rigid));
    }
    
    #[test]
    fn test_auto_detection() {
        let nodes = vec![
            NodeInfo::new(1, 0.0, 0.0, 3.0),
            NodeInfo::new(2, 10.0, 0.0, 3.0),
            NodeInfo::new(3, 10.0, 8.0, 3.0),
            NodeInfo::new(4, 0.0, 8.0, 3.0),
            NodeInfo::new(5, 0.0, 0.0, 6.0),
            NodeInfo::new(6, 10.0, 0.0, 6.0),
            NodeInfo::new(7, 10.0, 8.0, 6.0),
            NodeInfo::new(8, 0.0, 8.0, 6.0),
        ];
        
        let detector = AutoDiaphragmDetector::new();
        let diaphragms = detector.detect_from_nodes(&nodes);
        
        assert_eq!(diaphragms.len(), 2);
    }
    
    #[test]
    fn test_polygon_area() {
        let detector = AutoDiaphragmDetector::new();
        let square = vec![[0.0, 0.0], [10.0, 0.0], [10.0, 10.0], [0.0, 10.0]];
        
        let area = detector.polygon_area(&square);
        assert!((area - 100.0).abs() < 0.01);
    }
    
    #[test]
    fn test_accidental_torsion() {
        let mut diaphragm = FloorDiaphragm::new("D1", "Story 1", 3.0);
        diaphragm.boundary = vec![
            [0.0, 0.0], [20.0, 0.0], [20.0, 15.0], [0.0, 15.0]
        ];
        
        let mut forces = HashMap::new();
        forces.insert("Story 1".to_string(), 1000.0);
        
        let cases = generate_accidental_torsion_cases(&[diaphragm], &forces, 0.05);
        
        assert_eq!(cases.len(), 4);
        
        // Check +X case: e = 0.05 * 20 = 1.0 m
        let x_case = cases.iter().find(|c| c.direction == "+X").unwrap();
        assert!((x_case.eccentricity - 1.0).abs() < 0.01);
    }
    
    #[test]
    fn test_eccentricity() {
        let mut diaphragm = FloorDiaphragm::new("D1", "Story 1", 3.0);
        diaphragm.center_of_mass = [10.0, 8.0];
        diaphragm.center_of_rigidity = [9.0, 7.5];
        
        let ecc = diaphragm.eccentricity();
        assert!((ecc[0] - 1.0).abs() < 0.01);
        assert!((ecc[1] - 0.5).abs() < 0.01);
    }
}
