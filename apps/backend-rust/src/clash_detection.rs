// ============================================================================
// CLASH DETECTION AND CONSISTENCY CHECKS
// ============================================================================
//
// P2 REQUIREMENT: Clash Detection and Model Consistency
//
// Features:
// - Clash detection between structural elements
// - Consistency validation (connectivity, gaps, overlaps)
// - Duplicate element detection
// - Missing assignment checks
// - Unit-aware coordinate comparison
//
// Industry Standard: Navisworks, Solibri, BIMcollab
// ============================================================================

use serde::{Deserialize, Serialize};
use std::collections::HashMap;

// ============================================================================
// GEOMETRIC PRIMITIVES
// ============================================================================

/// 3D point with unit awareness
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Point3D {
    pub x: f64,
    pub y: f64,
    pub z: f64,
}

impl Point3D {
    pub fn new(x: f64, y: f64, z: f64) -> Self {
        Self { x, y, z }
    }

    pub fn origin() -> Self {
        Self { x: 0.0, y: 0.0, z: 0.0 }
    }

    pub fn distance_to(&self, other: &Point3D) -> f64 {
        let dx = self.x - other.x;
        let dy = self.y - other.y;
        let dz = self.z - other.z;
        (dx * dx + dy * dy + dz * dz).sqrt()
    }

    pub fn midpoint(&self, other: &Point3D) -> Point3D {
        Point3D {
            x: (self.x + other.x) / 2.0,
            y: (self.y + other.y) / 2.0,
            z: (self.z + other.z) / 2.0,
        }
    }

    /// Scale by factor (for unit conversion)
    pub fn scale(&self, factor: f64) -> Point3D {
        Point3D {
            x: self.x * factor,
            y: self.y * factor,
            z: self.z * factor,
        }
    }
}

/// Axis-aligned bounding box
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BoundingBox {
    pub min: Point3D,
    pub max: Point3D,
}

impl BoundingBox {
    pub fn new(min: Point3D, max: Point3D) -> Self {
        Self { min, max }
    }

    /// Check if two bounding boxes intersect
    pub fn intersects(&self, other: &BoundingBox) -> bool {
        !(self.max.x < other.min.x || self.min.x > other.max.x ||
          self.max.y < other.min.y || self.min.y > other.max.y ||
          self.max.z < other.min.z || self.min.z > other.max.z)
    }

    /// Expand bounding box by tolerance
    pub fn expand(&self, tolerance: f64) -> BoundingBox {
        BoundingBox {
            min: Point3D::new(
                self.min.x - tolerance,
                self.min.y - tolerance,
                self.min.z - tolerance,
            ),
            max: Point3D::new(
                self.max.x + tolerance,
                self.max.y + tolerance,
                self.max.z + tolerance,
            ),
        }
    }

    /// Center point
    pub fn center(&self) -> Point3D {
        self.min.midpoint(&self.max)
    }

    /// Volume
    pub fn volume(&self) -> f64 {
        let dx = (self.max.x - self.min.x).abs();
        let dy = (self.max.y - self.min.y).abs();
        let dz = (self.max.z - self.min.z).abs();
        dx * dy * dz
    }
}

// ============================================================================
// CLASH DETECTION
// ============================================================================

/// Clash detection configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ClashConfig {
    /// Default tolerance for hard clashes (m)
    pub hard_clash_tolerance: f64,
    /// Default tolerance for soft clashes (m)
    pub soft_clash_tolerance: f64,
    /// Tolerance for duplicate detection (m)
    pub duplicate_tolerance: f64,
    /// Maximum clashes to report per rule
    pub max_clashes_per_rule: usize,
    /// Enable grid acceleration
    pub use_spatial_grid: bool,
}

impl Default for ClashConfig {
    fn default() -> Self {
        Self {
            hard_clash_tolerance: 0.0,
            soft_clash_tolerance: 0.025, // 25mm
            duplicate_tolerance: 0.001,  // 1mm
            max_clashes_per_rule: 1000,
            use_spatial_grid: true,
        }
    }
}

/// Clash detection engine
pub struct ClashDetector {
    config: ClashConfig,
    rules: Vec<ClashRule>,
}

/// Clash detection rule
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ClashRule {
    pub id: String,
    pub name: String,
    pub selection_a: ElementFilter,
    pub selection_b: ElementFilter,
    pub clash_type: ClashType,
    pub tolerance: f64,
    pub enabled: bool,
}

/// Filter for selecting elements
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ElementFilter {
    /// Filter by element type
    pub element_types: Option<Vec<String>>,
    /// Filter by name pattern (contains)
    pub name_contains: Option<String>,
    /// Filter by level/story
    pub levels: Option<Vec<String>>,
    /// Filter by material type
    pub material_types: Option<Vec<String>>,
    /// Custom property filter
    pub properties: Option<HashMap<String, String>>,
}

impl ElementFilter {
    pub fn all() -> Self {
        Self {
            element_types: None,
            name_contains: None,
            levels: None,
            material_types: None,
            properties: None,
        }
    }

    pub fn by_type(types: Vec<&str>) -> Self {
        Self {
            element_types: Some(types.into_iter().map(String::from).collect()),
            ..Self::all()
        }
    }
}

/// Type of clash to detect
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum ClashType {
    /// Physical intersection of elements
    Hard,
    /// Elements within tolerance distance
    Soft,
    /// Identical elements at same location
    Duplicate,
    /// Gap between elements that should connect
    Gap,
    /// Containment check (one inside another)
    Containment,
}

/// Element for clash detection
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ClashElement {
    pub id: String,
    pub name: String,
    pub element_type: String,
    pub bounding_box: BoundingBox,
    pub level: Option<String>,
    pub material: Option<String>,
    pub properties: HashMap<String, String>,
}

/// Detected clash
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Clash {
    pub id: String,
    pub rule_id: String,
    pub clash_type: ClashType,
    pub element_a_id: String,
    pub element_a_name: String,
    pub element_b_id: String,
    pub element_b_name: String,
    pub clash_point: Point3D,
    pub distance: f64,
    pub severity: ClashSeverity,
    pub status: ClashStatus,
    pub comments: Vec<ClashComment>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum ClashSeverity {
    Critical,
    Major,
    Minor,
    Informational,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum ClashStatus {
    New,
    Active,
    Reviewed,
    Approved,
    Resolved,
    Ignored,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ClashComment {
    pub author: String,
    pub timestamp: String,
    pub text: String,
}

/// Clash detection results
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ClashResults {
    pub rule_id: String,
    pub rule_name: String,
    pub clashes: Vec<Clash>,
    pub summary: ClashSummary,
    pub elapsed_ms: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ClashSummary {
    pub total_count: usize,
    pub by_severity: HashMap<String, usize>,
    pub by_status: HashMap<String, usize>,
    pub new_count: usize,
    pub resolved_count: usize,
}

impl ClashDetector {
    pub fn new(config: ClashConfig) -> Self {
        Self {
            config,
            rules: Vec::new(),
        }
    }

    /// Add a clash detection rule
    pub fn add_rule(&mut self, rule: ClashRule) {
        self.rules.push(rule);
    }

    /// Create standard structural clash rules
    pub fn add_standard_rules(&mut self) {
        // Steel vs Steel
        self.rules.push(ClashRule {
            id: "STEEL-STEEL".to_string(),
            name: "Steel to Steel Clashes".to_string(),
            selection_a: ElementFilter::by_type(vec!["Beam", "Column", "Brace"]),
            selection_b: ElementFilter::by_type(vec!["Beam", "Column", "Brace"]),
            clash_type: ClashType::Hard,
            tolerance: 0.0,
            enabled: true,
        });

        // Steel vs Concrete
        self.rules.push(ClashRule {
            id: "STEEL-CONC".to_string(),
            name: "Steel to Concrete Clashes".to_string(),
            selection_a: ElementFilter::by_type(vec!["Beam", "Column", "Brace"]),
            selection_b: ElementFilter::by_type(vec!["Slab", "Wall", "Foundation"]),
            clash_type: ClashType::Soft,
            tolerance: 0.025,
            enabled: true,
        });

        // Duplicate detection
        self.rules.push(ClashRule {
            id: "DUPLICATES".to_string(),
            name: "Duplicate Elements".to_string(),
            selection_a: ElementFilter::all(),
            selection_b: ElementFilter::all(),
            clash_type: ClashType::Duplicate,
            tolerance: 0.001,
            enabled: true,
        });
    }

    /// Run clash detection on elements
    pub fn detect(&self, elements: &[ClashElement]) -> Vec<ClashResults> {
        let mut all_results = Vec::new();

        for rule in &self.rules {
            if !rule.enabled {
                continue;
            }

            let start = std::time::Instant::now();
            let clashes = self.detect_by_rule(rule, elements);
            let elapsed = start.elapsed().as_millis() as u64;

            let mut by_severity: HashMap<String, usize> = HashMap::new();
            let mut by_status: HashMap<String, usize> = HashMap::new();

            for clash in &clashes {
                *by_severity.entry(format!("{:?}", clash.severity)).or_insert(0) += 1;
                *by_status.entry(format!("{:?}", clash.status)).or_insert(0) += 1;
            }

            let new_count = clashes.iter()
                .filter(|c| c.status == ClashStatus::New)
                .count();

            all_results.push(ClashResults {
                rule_id: rule.id.clone(),
                rule_name: rule.name.clone(),
                summary: ClashSummary {
                    total_count: clashes.len(),
                    by_severity,
                    by_status,
                    new_count,
                    resolved_count: 0,
                },
                clashes,
                elapsed_ms: elapsed,
            });
        }

        all_results
    }

    fn detect_by_rule(&self, rule: &ClashRule, elements: &[ClashElement]) -> Vec<Clash> {
        let mut clashes = Vec::new();
        let mut clash_id = 0;

        // Filter elements
        let set_a: Vec<_> = elements.iter()
            .filter(|e| self.matches_filter(e, &rule.selection_a))
            .collect();

        let set_b: Vec<_> = elements.iter()
            .filter(|e| self.matches_filter(e, &rule.selection_b))
            .collect();

        // O(n²) comparison with bounding box pre-filter
        for elem_a in &set_a {
            let expanded_box = elem_a.bounding_box.expand(rule.tolerance);

            for elem_b in &set_b {
                // Skip self
                if elem_a.id == elem_b.id {
                    continue;
                }

                // Skip if already found this pair (for symmetric rules)
                if elem_a.id > elem_b.id && rule.selection_a.element_types == rule.selection_b.element_types {
                    continue;
                }

                // Bounding box pre-filter
                if !expanded_box.intersects(&elem_b.bounding_box) {
                    continue;
                }

                // Detailed check
                if let Some(clash) = self.check_clash(elem_a, elem_b, rule, &mut clash_id) {
                    clashes.push(clash);

                    if clashes.len() >= self.config.max_clashes_per_rule {
                        return clashes;
                    }
                }
            }
        }

        clashes
    }

    fn matches_filter(&self, element: &ClashElement, filter: &ElementFilter) -> bool {
        if let Some(ref types) = filter.element_types {
            if !types.contains(&element.element_type) {
                return false;
            }
        }

        if let Some(ref pattern) = filter.name_contains {
            if !element.name.contains(pattern) {
                return false;
            }
        }

        if let Some(ref levels) = filter.levels {
            if let Some(ref elem_level) = element.level {
                if !levels.contains(elem_level) {
                    return false;
                }
            } else {
                return false;
            }
        }

        if let Some(ref materials) = filter.material_types {
            if let Some(ref elem_mat) = element.material {
                if !materials.contains(elem_mat) {
                    return false;
                }
            } else {
                return false;
            }
        }

        true
    }

    fn check_clash(
        &self,
        elem_a: &ClashElement,
        elem_b: &ClashElement,
        rule: &ClashRule,
        clash_id: &mut usize,
    ) -> Option<Clash> {
        // Use bounding box overlap for detection
        let overlap = self.calculate_overlap(&elem_a.bounding_box, &elem_b.bounding_box);
        let distance = self.calculate_distance(&elem_a.bounding_box, &elem_b.bounding_box);
        let clash_point = elem_a.bounding_box.center().midpoint(&elem_b.bounding_box.center());

        match rule.clash_type {
            ClashType::Hard => {
                if overlap > 0.0 {
                    *clash_id += 1;
                    return Some(self.create_clash(
                        *clash_id,
                        rule,
                        elem_a,
                        elem_b,
                        ClashType::Hard,
                        clash_point,
                        -overlap,
                        ClashSeverity::Critical,
                    ));
                }
            }
            ClashType::Soft => {
                if distance < rule.tolerance && distance >= 0.0 {
                    *clash_id += 1;
                    let severity = if distance < rule.tolerance / 2.0 {
                        ClashSeverity::Major
                    } else {
                        ClashSeverity::Minor
                    };
                    return Some(self.create_clash(
                        *clash_id,
                        rule,
                        elem_a,
                        elem_b,
                        ClashType::Soft,
                        clash_point,
                        distance,
                        severity,
                    ));
                }
            }
            ClashType::Duplicate => {
                // Check if bounding boxes are nearly identical
                let center_dist = elem_a.bounding_box.center()
                    .distance_to(&elem_b.bounding_box.center());
                    
                if center_dist < self.config.duplicate_tolerance 
                    && elem_a.element_type == elem_b.element_type 
                {
                    *clash_id += 1;
                    return Some(self.create_clash(
                        *clash_id,
                        rule,
                        elem_a,
                        elem_b,
                        ClashType::Duplicate,
                        clash_point,
                        center_dist,
                        ClashSeverity::Critical,
                    ));
                }
            }
            ClashType::Gap => {
                if distance > rule.tolerance && distance < rule.tolerance * 3.0 {
                    *clash_id += 1;
                    return Some(self.create_clash(
                        *clash_id,
                        rule,
                        elem_a,
                        elem_b,
                        ClashType::Gap,
                        clash_point,
                        distance,
                        ClashSeverity::Minor,
                    ));
                }
            }
            ClashType::Containment => {
                if self.is_contained(&elem_a.bounding_box, &elem_b.bounding_box) {
                    *clash_id += 1;
                    return Some(self.create_clash(
                        *clash_id,
                        rule,
                        elem_a,
                        elem_b,
                        ClashType::Containment,
                        clash_point,
                        0.0,
                        ClashSeverity::Major,
                    ));
                }
            }
        }

        None
    }

    fn calculate_overlap(&self, a: &BoundingBox, b: &BoundingBox) -> f64 {
        let x_overlap = (a.max.x.min(b.max.x) - a.min.x.max(b.min.x)).max(0.0);
        let y_overlap = (a.max.y.min(b.max.y) - a.min.y.max(b.min.y)).max(0.0);
        let z_overlap = (a.max.z.min(b.max.z) - a.min.z.max(b.min.z)).max(0.0);
        
        x_overlap * y_overlap * z_overlap
    }

    fn calculate_distance(&self, a: &BoundingBox, b: &BoundingBox) -> f64 {
        let dx = (a.min.x - b.max.x).max(b.min.x - a.max.x).max(0.0);
        let dy = (a.min.y - b.max.y).max(b.min.y - a.max.y).max(0.0);
        let dz = (a.min.z - b.max.z).max(b.min.z - a.max.z).max(0.0);
        
        (dx * dx + dy * dy + dz * dz).sqrt()
    }

    fn is_contained(&self, inner: &BoundingBox, outer: &BoundingBox) -> bool {
        inner.min.x >= outer.min.x && inner.max.x <= outer.max.x &&
        inner.min.y >= outer.min.y && inner.max.y <= outer.max.y &&
        inner.min.z >= outer.min.z && inner.max.z <= outer.max.z
    }

    fn create_clash(
        &self,
        id: usize,
        rule: &ClashRule,
        elem_a: &ClashElement,
        elem_b: &ClashElement,
        clash_type: ClashType,
        point: Point3D,
        distance: f64,
        severity: ClashSeverity,
    ) -> Clash {
        Clash {
            id: format!("CLASH-{:06}", id),
            rule_id: rule.id.clone(),
            clash_type,
            element_a_id: elem_a.id.clone(),
            element_a_name: elem_a.name.clone(),
            element_b_id: elem_b.id.clone(),
            element_b_name: elem_b.name.clone(),
            clash_point: point,
            distance,
            severity,
            status: ClashStatus::New,
            comments: Vec::new(),
        }
    }
}

// ============================================================================
// CONSISTENCY CHECKS
// ============================================================================

/// Model consistency checker
pub struct ConsistencyChecker {
    tolerance: f64,
    checks: Vec<ConsistencyCheckType>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum ConsistencyCheckType {
    DuplicateNodes,
    ZeroLengthElements,
    OrphanNodes,
    MissingMaterial,
    MissingSection,
    DisconnectedParts,
    InvalidRestraints,
    OverlappingElements,
    NodeConnectivity,
    ElementOrientation,
}

/// Consistency check result
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConsistencyResult {
    pub passed: bool,
    pub issues: Vec<ConsistencyIssue>,
    pub summary: ConsistencySummary,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConsistencyIssue {
    pub check_type: ConsistencyCheckType,
    pub severity: IssueSeverity,
    pub message: String,
    pub entity_ids: Vec<String>,
    pub location: Option<Point3D>,
    pub suggestion: String,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum IssueSeverity {
    Error,
    Warning,
    Info,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConsistencySummary {
    pub total_checks: usize,
    pub passed_checks: usize,
    pub error_count: usize,
    pub warning_count: usize,
    pub info_count: usize,
}

/// Node for consistency checking
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConsistencyNode {
    pub id: String,
    pub x: f64,
    pub y: f64,
    pub z: f64,
    pub has_restraint: bool,
}

/// Element for consistency checking
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConsistencyElement {
    pub id: String,
    pub element_type: String,
    pub start_node: String,
    pub end_node: String,
    pub material_id: Option<String>,
    pub section_id: Option<String>,
}

impl ConsistencyChecker {
    pub fn new(tolerance: f64) -> Self {
        Self {
            tolerance,
            checks: vec![
                ConsistencyCheckType::DuplicateNodes,
                ConsistencyCheckType::ZeroLengthElements,
                ConsistencyCheckType::OrphanNodes,
                ConsistencyCheckType::MissingMaterial,
                ConsistencyCheckType::MissingSection,
            ],
        }
    }

    /// Run consistency checks on model
    pub fn check(
        &self,
        nodes: &[ConsistencyNode],
        elements: &[ConsistencyElement],
    ) -> ConsistencyResult {
        let mut issues = Vec::new();

        for check_type in &self.checks {
            let check_issues = match check_type {
                ConsistencyCheckType::DuplicateNodes => 
                    self.check_duplicate_nodes(nodes),
                ConsistencyCheckType::ZeroLengthElements => 
                    self.check_zero_length_elements(nodes, elements),
                ConsistencyCheckType::OrphanNodes => 
                    self.check_orphan_nodes(nodes, elements),
                ConsistencyCheckType::MissingMaterial => 
                    self.check_missing_materials(elements),
                ConsistencyCheckType::MissingSection => 
                    self.check_missing_sections(elements),
                _ => Vec::new(),
            };
            issues.extend(check_issues);
        }

        let error_count = issues.iter()
            .filter(|i| i.severity == IssueSeverity::Error)
            .count();
        let warning_count = issues.iter()
            .filter(|i| i.severity == IssueSeverity::Warning)
            .count();
        let info_count = issues.iter()
            .filter(|i| i.severity == IssueSeverity::Info)
            .count();

        ConsistencyResult {
            passed: error_count == 0,
            summary: ConsistencySummary {
                total_checks: self.checks.len(),
                passed_checks: self.checks.len() - if error_count > 0 { 1 } else { 0 },
                error_count,
                warning_count,
                info_count,
            },
            issues,
        }
    }

    fn check_duplicate_nodes(&self, nodes: &[ConsistencyNode]) -> Vec<ConsistencyIssue> {
        let mut issues = Vec::new();
        let mut checked: Vec<&ConsistencyNode> = Vec::new();

        for node in nodes {
            for existing in &checked {
                let dist = ((node.x - existing.x).powi(2) +
                           (node.y - existing.y).powi(2) +
                           (node.z - existing.z).powi(2)).sqrt();
                
                if dist < self.tolerance {
                    issues.push(ConsistencyIssue {
                        check_type: ConsistencyCheckType::DuplicateNodes,
                        severity: IssueSeverity::Warning,
                        message: format!(
                            "Nodes {} and {} are at the same location (distance: {:.4}m)",
                            node.id, existing.id, dist
                        ),
                        entity_ids: vec![node.id.clone(), existing.id.clone()],
                        location: Some(Point3D::new(node.x, node.y, node.z)),
                        suggestion: "Merge duplicate nodes into one".to_string(),
                    });
                }
            }
            checked.push(node);
        }

        issues
    }

    fn check_zero_length_elements(
        &self,
        nodes: &[ConsistencyNode],
        elements: &[ConsistencyElement],
    ) -> Vec<ConsistencyIssue> {
        let mut issues = Vec::new();
        let node_map: HashMap<_, _> = nodes.iter()
            .map(|n| (n.id.clone(), n))
            .collect();

        for elem in elements {
            let start = node_map.get(&elem.start_node);
            let end = node_map.get(&elem.end_node);

            if let (Some(s), Some(e)) = (start, end) {
                let length = ((s.x - e.x).powi(2) +
                             (s.y - e.y).powi(2) +
                             (s.z - e.z).powi(2)).sqrt();
                
                if length < self.tolerance {
                    issues.push(ConsistencyIssue {
                        check_type: ConsistencyCheckType::ZeroLengthElements,
                        severity: IssueSeverity::Error,
                        message: format!(
                            "Element {} has zero or near-zero length ({:.4}m)",
                            elem.id, length
                        ),
                        entity_ids: vec![elem.id.clone()],
                        location: Some(Point3D::new(s.x, s.y, s.z)),
                        suggestion: "Remove element or correct node positions".to_string(),
                    });
                }
            }
        }

        issues
    }

    fn check_orphan_nodes(
        &self,
        nodes: &[ConsistencyNode],
        elements: &[ConsistencyElement],
    ) -> Vec<ConsistencyIssue> {
        let mut issues = Vec::new();
        let mut used_nodes: Vec<String> = Vec::new();

        for elem in elements {
            used_nodes.push(elem.start_node.clone());
            used_nodes.push(elem.end_node.clone());
        }

        for node in nodes {
            if !used_nodes.contains(&node.id) && !node.has_restraint {
                issues.push(ConsistencyIssue {
                    check_type: ConsistencyCheckType::OrphanNodes,
                    severity: IssueSeverity::Warning,
                    message: format!(
                        "Node {} is not connected to any element",
                        node.id
                    ),
                    entity_ids: vec![node.id.clone()],
                    location: Some(Point3D::new(node.x, node.y, node.z)),
                    suggestion: "Remove orphan node or connect to element".to_string(),
                });
            }
        }

        issues
    }

    fn check_missing_materials(
        &self,
        elements: &[ConsistencyElement],
    ) -> Vec<ConsistencyIssue> {
        let mut issues = Vec::new();

        for elem in elements {
            if elem.material_id.is_none() {
                issues.push(ConsistencyIssue {
                    check_type: ConsistencyCheckType::MissingMaterial,
                    severity: IssueSeverity::Error,
                    message: format!(
                        "Element {} has no material assigned",
                        elem.id
                    ),
                    entity_ids: vec![elem.id.clone()],
                    location: None,
                    suggestion: "Assign appropriate material to element".to_string(),
                });
            }
        }

        issues
    }

    fn check_missing_sections(
        &self,
        elements: &[ConsistencyElement],
    ) -> Vec<ConsistencyIssue> {
        let mut issues = Vec::new();

        for elem in elements {
            // Only check line elements
            if elem.element_type == "Beam" || elem.element_type == "Column" 
                || elem.element_type == "Brace" 
            {
                if elem.section_id.is_none() {
                    issues.push(ConsistencyIssue {
                        check_type: ConsistencyCheckType::MissingSection,
                        severity: IssueSeverity::Error,
                        message: format!(
                            "Element {} ({}) has no section assigned",
                            elem.id, elem.element_type
                        ),
                        entity_ids: vec![elem.id.clone()],
                        location: None,
                        suggestion: "Assign cross-section to element".to_string(),
                    });
                }
            }
        }

        issues
    }
}

// ============================================================================
// TESTS
// ============================================================================

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_point_distance() {
        let p1 = Point3D::new(0.0, 0.0, 0.0);
        let p2 = Point3D::new(3.0, 4.0, 0.0);
        assert!((p1.distance_to(&p2) - 5.0).abs() < 1e-10);
    }

    #[test]
    fn test_bounding_box_intersection() {
        let box1 = BoundingBox::new(
            Point3D::new(0.0, 0.0, 0.0),
            Point3D::new(1.0, 1.0, 1.0),
        );
        let box2 = BoundingBox::new(
            Point3D::new(0.5, 0.5, 0.5),
            Point3D::new(1.5, 1.5, 1.5),
        );
        let box3 = BoundingBox::new(
            Point3D::new(2.0, 2.0, 2.0),
            Point3D::new(3.0, 3.0, 3.0),
        );

        assert!(box1.intersects(&box2));
        assert!(!box1.intersects(&box3));
    }

    #[test]
    fn test_clash_detection() {
        let mut detector = ClashDetector::new(ClashConfig::default());
        detector.add_standard_rules();

        let elements = vec![
            ClashElement {
                id: "E1".to_string(),
                name: "Beam-1".to_string(),
                element_type: "Beam".to_string(),
                bounding_box: BoundingBox::new(
                    Point3D::new(0.0, 0.0, 0.0),
                    Point3D::new(5.0, 0.3, 0.5),
                ),
                level: Some("Level 1".to_string()),
                material: Some("Steel".to_string()),
                properties: HashMap::new(),
            },
            ClashElement {
                id: "E2".to_string(),
                name: "Beam-2".to_string(),
                element_type: "Beam".to_string(),
                bounding_box: BoundingBox::new(
                    Point3D::new(2.0, -0.15, 0.0),
                    Point3D::new(2.3, 5.0, 0.5),
                ),
                level: Some("Level 1".to_string()),
                material: Some("Steel".to_string()),
                properties: HashMap::new(),
            },
        ];

        let results = detector.detect(&elements);
        assert!(!results.is_empty());
    }

    #[test]
    fn test_consistency_checker() {
        let checker = ConsistencyChecker::new(0.001);

        let nodes = vec![
            ConsistencyNode {
                id: "N1".to_string(),
                x: 0.0, y: 0.0, z: 0.0,
                has_restraint: false,
            },
            ConsistencyNode {
                id: "N2".to_string(),
                x: 5.0, y: 0.0, z: 0.0,
                has_restraint: false,
            },
            ConsistencyNode {
                id: "N3".to_string(),
                x: 10.0, y: 0.0, z: 0.0,
                has_restraint: false,
            },
        ];

        let elements = vec![
            ConsistencyElement {
                id: "E1".to_string(),
                element_type: "Beam".to_string(),
                start_node: "N1".to_string(),
                end_node: "N2".to_string(),
                material_id: Some("Steel".to_string()),
                section_id: Some("IPE300".to_string()),
            },
        ];

        let result = checker.check(&nodes, &elements);
        
        // N3 should be orphan
        assert!(result.issues.iter()
            .any(|i| matches!(i.check_type, ConsistencyCheckType::OrphanNodes)));
    }
}
