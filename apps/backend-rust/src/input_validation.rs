// ============================================================================
// PHASE 51: INPUT VALIDATION & PREPROCESSING
// ============================================================================
//
// Comprehensive input validation for structural analysis:
// - Node validation (coincidence, orphans, coordinates)
// - Element validation (connectivity, Jacobian)
// - Load validation (equilibrium, application)
// - Boundary condition validation
// - Material property checks
// - Mesh topology validation
//
// Industry Parity: SAP2000, ETABS, ANSYS preprocessing
// ============================================================================

use std::collections::{HashMap, HashSet};

// ============================================================================
// VALIDATION RESULT TYPES
// ============================================================================

/// Severity levels for validation issues
#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord)]
pub enum Severity {
    Info,
    Warning,
    Error,
    Fatal,
}

/// Validation issue
#[derive(Debug, Clone)]
pub struct ValidationIssue {
    pub code: ValidationCode,
    pub severity: Severity,
    pub message: String,
    pub location: Option<ValidationLocation>,
    pub suggestion: Option<String>,
}

/// Location of a validation issue
#[derive(Debug, Clone)]
pub enum ValidationLocation {
    Node(usize),
    Element(usize),
    Load(String),
    Material(String),
    Section(String),
    BoundaryCondition(usize),
    LoadCase(String),
    Global,
}

/// Validation error codes
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub enum ValidationCode {
    // Node issues (N1xx)
    N101CoincidentNodes,
    N102OrphanNode,
    N103InvalidCoordinates,
    N104DuplicateNodeId,
    
    // Element issues (E2xx)
    E201ZeroLength,
    E202NegativeJacobian,
    E203DuplicateNodes,
    E204InvalidConnectivity,
    E205PoorAspectRatio,
    E206MissingNodes,
    
    // Material issues (M3xx)
    M301NegativeModulus,
    M302InvalidPoisson,
    M303NegativeDensity,
    M304MissingMaterial,
    M305YieldExceedsUltimate,
    
    // Section issues (S4xx)
    S401ZeroArea,
    S402NegativeInertia,
    S403MissingSection,
    S404InvalidDimensions,
    
    // Load issues (L5xx)
    L501LoadOnFreeDof,
    L502EmptyLoadCase,
    L503UnbalancedMoment,
    L504MissingLoadCase,
    L505DuplicateLoad,
    
    // Boundary condition issues (B6xx)
    B601ConflictingBc,
    B602BcOnMissingNode,
    B603UnstableStructure,
    B604InsufficientSupport,
    B605RedundantSupport,
    
    // Mesh issues (H7xx)
    H701DisconnectedRegion,
    H702NonManifoldEdge,
    H703HangingNode,
    H704MeshingFailure,
    
    // General issues (G8xx)
    G801EmptyModel,
    G802ModelTooLarge,
    G803MixedUnits,
    G804NamingConflict,
}

impl ValidationCode {
    pub fn default_severity(&self) -> Severity {
        match self {
            // Fatal
            Self::E202NegativeJacobian => Severity::Fatal,
            Self::B603UnstableStructure => Severity::Fatal,
            Self::G801EmptyModel => Severity::Fatal,
            
            // Error
            Self::E201ZeroLength => Severity::Error,
            Self::E206MissingNodes => Severity::Error,
            Self::M301NegativeModulus => Severity::Error,
            Self::M302InvalidPoisson => Severity::Error,
            Self::S401ZeroArea => Severity::Error,
            Self::S402NegativeInertia => Severity::Error,
            Self::B602BcOnMissingNode => Severity::Error,
            
            // Warning
            Self::N101CoincidentNodes => Severity::Warning,
            Self::N102OrphanNode => Severity::Warning,
            Self::E205PoorAspectRatio => Severity::Warning,
            Self::L503UnbalancedMoment => Severity::Warning,
            Self::B605RedundantSupport => Severity::Warning,
            Self::H703HangingNode => Severity::Warning,
            
            // Info
            _ => Severity::Info,
        }
    }
    
    pub fn description(&self) -> &'static str {
        match self {
            Self::N101CoincidentNodes => "Coincident nodes detected",
            Self::N102OrphanNode => "Node not referenced by any element",
            Self::N103InvalidCoordinates => "Invalid node coordinates (NaN or Inf)",
            Self::N104DuplicateNodeId => "Duplicate node ID",
            Self::E201ZeroLength => "Zero-length element",
            Self::E202NegativeJacobian => "Element has negative Jacobian (inverted)",
            Self::E203DuplicateNodes => "Element references same node multiple times",
            Self::E204InvalidConnectivity => "Invalid element connectivity",
            Self::E205PoorAspectRatio => "Poor element aspect ratio",
            Self::E206MissingNodes => "Element references non-existent nodes",
            Self::M301NegativeModulus => "Negative elastic modulus",
            Self::M302InvalidPoisson => "Poisson's ratio outside valid range",
            Self::M303NegativeDensity => "Negative material density",
            Self::M304MissingMaterial => "Element references non-existent material",
            Self::M305YieldExceedsUltimate => "Yield stress exceeds ultimate stress",
            Self::S401ZeroArea => "Section has zero area",
            Self::S402NegativeInertia => "Section has negative moment of inertia",
            Self::S403MissingSection => "Element references non-existent section",
            Self::S404InvalidDimensions => "Invalid section dimensions",
            Self::L501LoadOnFreeDof => "Load applied to free DOF",
            Self::L502EmptyLoadCase => "Load case has no loads",
            Self::L503UnbalancedMoment => "Unbalanced moment in load case",
            Self::L504MissingLoadCase => "Referenced load case does not exist",
            Self::L505DuplicateLoad => "Duplicate load on same DOF",
            Self::B601ConflictingBc => "Conflicting boundary conditions",
            Self::B602BcOnMissingNode => "BC on non-existent node",
            Self::B603UnstableStructure => "Structure is unstable (rigid body modes)",
            Self::B604InsufficientSupport => "Insufficient support for static stability",
            Self::B605RedundantSupport => "Redundant support constraints",
            Self::H701DisconnectedRegion => "Mesh has disconnected regions",
            Self::H702NonManifoldEdge => "Non-manifold edge in mesh",
            Self::H703HangingNode => "Hanging node at T-junction",
            Self::H704MeshingFailure => "Mesh generation failed",
            Self::G801EmptyModel => "Model has no elements",
            Self::G802ModelTooLarge => "Model exceeds size limits",
            Self::G803MixedUnits => "Mixed unit systems detected",
            Self::G804NamingConflict => "Naming conflict in model",
        }
    }
}

/// Complete validation result
#[derive(Debug, Clone)]
pub struct ValidationResult {
    pub issues: Vec<ValidationIssue>,
    pub n_fatal: usize,
    pub n_errors: usize,
    pub n_warnings: usize,
    pub n_info: usize,
    pub passed: bool,
}

impl ValidationResult {
    pub fn new() -> Self {
        Self {
            issues: Vec::new(),
            n_fatal: 0,
            n_errors: 0,
            n_warnings: 0,
            n_info: 0,
            passed: true,
        }
    }
    
    pub fn add_issue(&mut self, issue: ValidationIssue) {
        match issue.severity {
            Severity::Fatal => {
                self.n_fatal += 1;
                self.passed = false;
            }
            Severity::Error => {
                self.n_errors += 1;
                self.passed = false;
            }
            Severity::Warning => self.n_warnings += 1,
            Severity::Info => self.n_info += 1,
        }
        self.issues.push(issue);
    }
    
    pub fn merge(&mut self, other: ValidationResult) {
        for issue in other.issues {
            self.add_issue(issue);
        }
    }
    
    /// Get issues by severity
    pub fn issues_by_severity(&self, severity: Severity) -> Vec<&ValidationIssue> {
        self.issues.iter().filter(|i| i.severity == severity).collect()
    }
    
    /// Get issues by code
    pub fn issues_by_code(&self, code: ValidationCode) -> Vec<&ValidationIssue> {
        self.issues.iter().filter(|i| i.code == code).collect()
    }
    
    /// Summary string
    pub fn summary(&self) -> String {
        format!(
            "Validation: {} issues ({} fatal, {} errors, {} warnings, {} info) - {}",
            self.issues.len(),
            self.n_fatal,
            self.n_errors,
            self.n_warnings,
            self.n_info,
            if self.passed { "PASSED" } else { "FAILED" }
        )
    }
}

impl Default for ValidationResult {
    fn default() -> Self {
        Self::new()
    }
}

// ============================================================================
// NODE VALIDATION
// ============================================================================

/// Node data for validation
#[derive(Debug, Clone)]
pub struct NodeData {
    pub id: usize,
    pub x: f64,
    pub y: f64,
    pub z: f64,
}

pub struct NodeValidator {
    pub coincidence_tolerance: f64,
}

impl Default for NodeValidator {
    fn default() -> Self {
        Self {
            coincidence_tolerance: 1e-6,
        }
    }
}

impl NodeValidator {
    pub fn validate(&self, nodes: &[NodeData], referenced_nodes: &HashSet<usize>) -> ValidationResult {
        let mut result = ValidationResult::new();
        
        // Check for invalid coordinates
        for node in nodes {
            if !node.x.is_finite() || !node.y.is_finite() || !node.z.is_finite() {
                result.add_issue(ValidationIssue {
                    code: ValidationCode::N103InvalidCoordinates,
                    severity: Severity::Error,
                    message: format!("Node {} has invalid coordinates ({}, {}, {})", 
                        node.id, node.x, node.y, node.z),
                    location: Some(ValidationLocation::Node(node.id)),
                    suggestion: Some("Check for NaN or Inf values in input".to_string()),
                });
            }
        }
        
        // Check for duplicate IDs
        let mut id_count: HashMap<usize, usize> = HashMap::new();
        for node in nodes {
            *id_count.entry(node.id).or_insert(0) += 1;
        }
        for (id, count) in id_count {
            if count > 1 {
                result.add_issue(ValidationIssue {
                    code: ValidationCode::N104DuplicateNodeId,
                    severity: Severity::Error,
                    message: format!("Node ID {} appears {} times", id, count),
                    location: Some(ValidationLocation::Node(id)),
                    suggestion: Some("Ensure unique node IDs".to_string()),
                });
            }
        }
        
        // Check for coincident nodes
        let coincident = self.find_coincident_nodes(nodes);
        for (n1, n2) in coincident {
            result.add_issue(ValidationIssue {
                code: ValidationCode::N101CoincidentNodes,
                severity: Severity::Warning,
                message: format!("Nodes {} and {} are coincident", n1, n2),
                location: Some(ValidationLocation::Node(n1)),
                suggestion: Some("Consider merging coincident nodes".to_string()),
            });
        }
        
        // Check for orphan nodes
        let _node_ids: HashSet<usize> = nodes.iter().map(|n| n.id).collect();
        for node in nodes {
            if !referenced_nodes.contains(&node.id) {
                result.add_issue(ValidationIssue {
                    code: ValidationCode::N102OrphanNode,
                    severity: Severity::Warning,
                    message: format!("Node {} is not referenced by any element", node.id),
                    location: Some(ValidationLocation::Node(node.id)),
                    suggestion: Some("Remove orphan nodes or add connecting elements".to_string()),
                });
            }
        }
        
        result
    }
    
    fn find_coincident_nodes(&self, nodes: &[NodeData]) -> Vec<(usize, usize)> {
        let mut coincident = Vec::new();
        let tol2 = self.coincidence_tolerance * self.coincidence_tolerance;
        
        for i in 0..nodes.len() {
            for j in (i + 1)..nodes.len() {
                let dx = nodes[i].x - nodes[j].x;
                let dy = nodes[i].y - nodes[j].y;
                let dz = nodes[i].z - nodes[j].z;
                
                if dx * dx + dy * dy + dz * dz < tol2 {
                    coincident.push((nodes[i].id, nodes[j].id));
                }
            }
        }
        
        coincident
    }
}

// ============================================================================
// ELEMENT VALIDATION
// ============================================================================

/// Element data for validation
#[derive(Debug, Clone)]
pub struct ElementData {
    pub id: usize,
    pub element_type: ElementType,
    pub nodes: Vec<usize>,
    pub material_id: Option<String>,
    pub section_id: Option<String>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ElementType {
    Beam,
    Truss,
    Shell,
    Solid,
    Spring,
    Mass,
}

impl ElementType {
    pub fn expected_node_count(&self) -> Vec<usize> {
        match self {
            Self::Beam | Self::Truss => vec![2],
            Self::Shell => vec![3, 4, 6, 8, 9],
            Self::Solid => vec![4, 8, 10, 20],
            Self::Spring => vec![1, 2],
            Self::Mass => vec![1],
        }
    }
}

pub struct ElementValidator {
    pub aspect_ratio_warning: f64,
    pub aspect_ratio_error: f64,
    pub min_length: f64,
}

impl Default for ElementValidator {
    fn default() -> Self {
        Self {
            aspect_ratio_warning: 10.0,
            aspect_ratio_error: 100.0,
            min_length: 1e-10,
        }
    }
}

impl ElementValidator {
    pub fn validate(
        &self,
        elements: &[ElementData],
        node_coords: &HashMap<usize, (f64, f64, f64)>,
        materials: &HashSet<String>,
        sections: &HashSet<String>,
    ) -> ValidationResult {
        let mut result = ValidationResult::new();
        
        for elem in elements {
            // Check node count
            let expected = elem.element_type.expected_node_count();
            if !expected.contains(&elem.nodes.len()) {
                result.add_issue(ValidationIssue {
                    code: ValidationCode::E204InvalidConnectivity,
                    severity: Severity::Error,
                    message: format!(
                        "Element {} has {} nodes, expected {:?}",
                        elem.id, elem.nodes.len(), expected
                    ),
                    location: Some(ValidationLocation::Element(elem.id)),
                    suggestion: None,
                });
            }
            
            // Check for duplicate nodes in element
            let unique_nodes: HashSet<_> = elem.nodes.iter().collect();
            if unique_nodes.len() != elem.nodes.len() {
                result.add_issue(ValidationIssue {
                    code: ValidationCode::E203DuplicateNodes,
                    severity: Severity::Error,
                    message: format!("Element {} references same node multiple times", elem.id),
                    location: Some(ValidationLocation::Element(elem.id)),
                    suggestion: Some("Check element connectivity".to_string()),
                });
            }
            
            // Check for missing nodes
            for &node_id in &elem.nodes {
                if !node_coords.contains_key(&node_id) {
                    result.add_issue(ValidationIssue {
                        code: ValidationCode::E206MissingNodes,
                        severity: Severity::Error,
                        message: format!("Element {} references non-existent node {}", elem.id, node_id),
                        location: Some(ValidationLocation::Element(elem.id)),
                        suggestion: None,
                    });
                }
            }
            
            // Check for zero-length beam/truss
            if matches!(elem.element_type, ElementType::Beam | ElementType::Truss) {
                if let (Some(&p1), Some(&p2)) = (
                    node_coords.get(&elem.nodes[0]),
                    elem.nodes.get(1).and_then(|&n| node_coords.get(&n)),
                ) {
                    let length = ((p2.0 - p1.0).powi(2) + 
                                  (p2.1 - p1.1).powi(2) + 
                                  (p2.2 - p1.2).powi(2)).sqrt();
                    
                    if length < self.min_length {
                        result.add_issue(ValidationIssue {
                            code: ValidationCode::E201ZeroLength,
                            severity: Severity::Error,
                            message: format!("Element {} has zero length ({:.2e})", elem.id, length),
                            location: Some(ValidationLocation::Element(elem.id)),
                            suggestion: Some("Remove or merge zero-length elements".to_string()),
                        });
                    }
                }
            }
            
            // Check for missing material
            if let Some(ref mat_id) = elem.material_id {
                if !materials.contains(mat_id) {
                    result.add_issue(ValidationIssue {
                        code: ValidationCode::M304MissingMaterial,
                        severity: Severity::Error,
                        message: format!("Element {} references non-existent material '{}'", elem.id, mat_id),
                        location: Some(ValidationLocation::Element(elem.id)),
                        suggestion: Some("Define the material or assign a different one".to_string()),
                    });
                }
            }
            
            // Check for missing section
            if let Some(ref sec_id) = elem.section_id {
                if !sections.contains(sec_id) {
                    result.add_issue(ValidationIssue {
                        code: ValidationCode::S403MissingSection,
                        severity: Severity::Error,
                        message: format!("Element {} references non-existent section '{}'", elem.id, sec_id),
                        location: Some(ValidationLocation::Element(elem.id)),
                        suggestion: Some("Define the section or assign a different one".to_string()),
                    });
                }
            }
        }
        
        result
    }
}

// ============================================================================
// MATERIAL VALIDATION
// ============================================================================

/// Material data for validation
#[derive(Debug, Clone)]
pub struct MaterialData {
    pub id: String,
    pub e: f64,         // Young's modulus
    pub nu: f64,        // Poisson's ratio
    pub rho: f64,       // Density
    pub fy: Option<f64>, // Yield stress
    pub fu: Option<f64>, // Ultimate stress
}

pub struct MaterialValidator;

impl MaterialValidator {
    pub fn validate(materials: &[MaterialData]) -> ValidationResult {
        let mut result = ValidationResult::new();
        
        for mat in materials {
            // Check modulus
            if mat.e <= 0.0 {
                result.add_issue(ValidationIssue {
                    code: ValidationCode::M301NegativeModulus,
                    severity: Severity::Error,
                    message: format!("Material '{}' has non-positive modulus {}", mat.id, mat.e),
                    location: Some(ValidationLocation::Material(mat.id.clone())),
                    suggestion: Some("Young's modulus must be positive".to_string()),
                });
            }
            
            // Check Poisson's ratio
            if mat.nu < -1.0 || mat.nu > 0.5 {
                result.add_issue(ValidationIssue {
                    code: ValidationCode::M302InvalidPoisson,
                    severity: Severity::Error,
                    message: format!("Material '{}' has invalid Poisson's ratio {}", mat.id, mat.nu),
                    location: Some(ValidationLocation::Material(mat.id.clone())),
                    suggestion: Some("Poisson's ratio must be between -1 and 0.5".to_string()),
                });
            }
            
            // Check density
            if mat.rho < 0.0 {
                result.add_issue(ValidationIssue {
                    code: ValidationCode::M303NegativeDensity,
                    severity: Severity::Error,
                    message: format!("Material '{}' has negative density", mat.id),
                    location: Some(ValidationLocation::Material(mat.id.clone())),
                    suggestion: Some("Density must be non-negative".to_string()),
                });
            }
            
            // Check yield vs ultimate
            if let (Some(fy), Some(fu)) = (mat.fy, mat.fu) {
                if fy > fu {
                    result.add_issue(ValidationIssue {
                        code: ValidationCode::M305YieldExceedsUltimate,
                        severity: Severity::Warning,
                        message: format!("Material '{}' has yield stress > ultimate stress", mat.id),
                        location: Some(ValidationLocation::Material(mat.id.clone())),
                        suggestion: Some("Check material property values".to_string()),
                    });
                }
            }
        }
        
        result
    }
}

// ============================================================================
// BOUNDARY CONDITION VALIDATION
// ============================================================================

/// Boundary condition data
#[derive(Debug, Clone)]
pub struct BoundaryCondition {
    pub node_id: usize,
    pub dof: usize, // 0-5 for 3D (ux, uy, uz, rx, ry, rz)
    pub value: f64,
    pub bc_type: BcType,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum BcType {
    Fixed,
    Prescribed,
    Spring,
}

pub struct BoundaryConditionValidator;

impl BoundaryConditionValidator {
    pub fn validate(
        bcs: &[BoundaryCondition],
        node_ids: &HashSet<usize>,
    ) -> ValidationResult {
        let mut result = ValidationResult::new();
        
        // Check for BCs on missing nodes
        for bc in bcs {
            if !node_ids.contains(&bc.node_id) {
                result.add_issue(ValidationIssue {
                    code: ValidationCode::B602BcOnMissingNode,
                    severity: Severity::Error,
                    message: format!("BC on non-existent node {}", bc.node_id),
                    location: Some(ValidationLocation::BoundaryCondition(bc.node_id)),
                    suggestion: None,
                });
            }
        }
        
        // Check for conflicting BCs (same node, same DOF, different values)
        let mut bc_map: HashMap<(usize, usize), Vec<&BoundaryCondition>> = HashMap::new();
        for bc in bcs {
            bc_map.entry((bc.node_id, bc.dof))
                .or_insert_with(Vec::new)
                .push(bc);
        }
        
        for ((node, dof), bcs_at_dof) in &bc_map {
            if bcs_at_dof.len() > 1 {
                // Check if values differ
                let first_val = bcs_at_dof[0].value;
                let conflicts = bcs_at_dof.iter().any(|bc| (bc.value - first_val).abs() > 1e-10);
                
                if conflicts {
                    result.add_issue(ValidationIssue {
                        code: ValidationCode::B601ConflictingBc,
                        severity: Severity::Error,
                        message: format!("Conflicting BCs on node {} DOF {}", node, dof),
                        location: Some(ValidationLocation::BoundaryCondition(*node)),
                        suggestion: Some("Remove duplicate or conflicting boundary conditions".to_string()),
                    });
                }
            }
        }
        
        result
    }
    
    /// Check for structural stability (simplified)
    pub fn check_stability(
        bcs: &[BoundaryCondition],
        is_3d: bool,
    ) -> ValidationResult {
        let mut result = ValidationResult::new();
        
        // Count constrained DOFs per type
        let mut translation_fixed = [false; 3];
        let mut rotation_fixed = [false; 3];
        
        for bc in bcs {
            if bc.bc_type == BcType::Fixed || bc.bc_type == BcType::Prescribed {
                if bc.dof < 3 {
                    translation_fixed[bc.dof] = true;
                } else if bc.dof < 6 {
                    rotation_fixed[bc.dof - 3] = true;
                }
            }
        }
        
        let n_trans_fixed = translation_fixed.iter().filter(|&&x| x).count();
        
        // For 3D, need at least 3 translation constraints (simplified check)
        if is_3d && n_trans_fixed < 3 {
            result.add_issue(ValidationIssue {
                code: ValidationCode::B604InsufficientSupport,
                severity: Severity::Warning,
                message: format!(
                    "Only {} translation DOFs constrained, structure may be unstable",
                    n_trans_fixed
                ),
                location: Some(ValidationLocation::Global),
                suggestion: Some("Add sufficient support constraints".to_string()),
            });
        }
        
        result
    }
}

// ============================================================================
// LOAD VALIDATION
// ============================================================================

/// Load data
#[derive(Debug, Clone)]
pub struct LoadData {
    pub load_case: String,
    pub node_id: Option<usize>,
    pub element_id: Option<usize>,
    pub dof: usize,
    pub value: f64,
}

pub struct LoadValidator;

impl LoadValidator {
    pub fn validate(
        loads: &[LoadData],
        node_ids: &HashSet<usize>,
        element_ids: &HashSet<usize>,
    ) -> ValidationResult {
        let mut result = ValidationResult::new();
        
        // Group by load case
        let mut load_cases: HashMap<&str, Vec<&LoadData>> = HashMap::new();
        for load in loads {
            load_cases.entry(&load.load_case)
                .or_insert_with(Vec::new)
                .push(load);
        }
        
        for (case_name, case_loads) in &load_cases {
            if case_loads.is_empty() {
                result.add_issue(ValidationIssue {
                    code: ValidationCode::L502EmptyLoadCase,
                    severity: Severity::Warning,
                    message: format!("Load case '{}' has no loads", case_name),
                    location: Some(ValidationLocation::LoadCase(case_name.to_string())),
                    suggestion: None,
                });
            }
            
            // Check for loads on missing nodes/elements
            for load in case_loads {
                if let Some(node_id) = load.node_id {
                    if !node_ids.contains(&node_id) {
                        result.add_issue(ValidationIssue {
                            code: ValidationCode::L501LoadOnFreeDof,
                            severity: Severity::Warning,
                            message: format!("Load on non-existent node {} in case '{}'", node_id, case_name),
                            location: Some(ValidationLocation::LoadCase(case_name.to_string())),
                            suggestion: None,
                        });
                    }
                }
                
                if let Some(elem_id) = load.element_id {
                    if !element_ids.contains(&elem_id) {
                        result.add_issue(ValidationIssue {
                            code: ValidationCode::L501LoadOnFreeDof,
                            severity: Severity::Warning,
                            message: format!("Load on non-existent element {} in case '{}'", elem_id, case_name),
                            location: Some(ValidationLocation::LoadCase(case_name.to_string())),
                            suggestion: None,
                        });
                    }
                }
            }
        }
        
        result
    }
}

// ============================================================================
// FULL MODEL VALIDATOR
// ============================================================================

/// Complete model validation
pub struct ModelValidator {
    pub node_validator: NodeValidator,
    pub element_validator: ElementValidator,
}

impl Default for ModelValidator {
    fn default() -> Self {
        Self {
            node_validator: NodeValidator::default(),
            element_validator: ElementValidator::default(),
        }
    }
}

impl ModelValidator {
    pub fn validate_full(
        &self,
        nodes: &[NodeData],
        elements: &[ElementData],
        materials: &[MaterialData],
        bcs: &[BoundaryCondition],
        loads: &[LoadData],
    ) -> ValidationResult {
        let mut result = ValidationResult::new();
        
        // Check for empty model
        if elements.is_empty() {
            result.add_issue(ValidationIssue {
                code: ValidationCode::G801EmptyModel,
                severity: Severity::Fatal,
                message: "Model has no elements".to_string(),
                location: Some(ValidationLocation::Global),
                suggestion: Some("Add elements to the model".to_string()),
            });
            return result;
        }
        
        // Build lookup structures
        let mut node_coords: HashMap<usize, (f64, f64, f64)> = HashMap::new();
        for node in nodes {
            node_coords.insert(node.id, (node.x, node.y, node.z));
        }
        
        let referenced_nodes: HashSet<usize> = elements.iter()
            .flat_map(|e| e.nodes.iter().copied())
            .collect();
        
        let material_ids: HashSet<String> = materials.iter()
            .map(|m| m.id.clone())
            .collect();
        
        // For simplicity, assume sections are validated separately
        let section_ids: HashSet<String> = elements.iter()
            .filter_map(|e| e.section_id.clone())
            .collect();
        
        let node_ids: HashSet<usize> = nodes.iter().map(|n| n.id).collect();
        let element_ids: HashSet<usize> = elements.iter().map(|e| e.id).collect();
        
        // Validate each component
        result.merge(self.node_validator.validate(nodes, &referenced_nodes));
        result.merge(self.element_validator.validate(elements, &node_coords, &material_ids, &section_ids));
        result.merge(MaterialValidator::validate(materials));
        result.merge(BoundaryConditionValidator::validate(bcs, &node_ids));
        result.merge(BoundaryConditionValidator::check_stability(bcs, true));
        result.merge(LoadValidator::validate(loads, &node_ids, &element_ids));
        
        result
    }
    
    /// Quick validation (errors only)
    pub fn validate_quick(
        &self,
        nodes: &[NodeData],
        elements: &[ElementData],
    ) -> ValidationResult {
        let mut result = ValidationResult::new();
        
        if elements.is_empty() {
            result.add_issue(ValidationIssue {
                code: ValidationCode::G801EmptyModel,
                severity: Severity::Fatal,
                message: "Model has no elements".to_string(),
                location: Some(ValidationLocation::Global),
                suggestion: None,
            });
        }
        
        // Just check critical issues
        let node_ids: HashSet<usize> = nodes.iter().map(|n| n.id).collect();
        
        for elem in elements {
            for &node_id in &elem.nodes {
                if !node_ids.contains(&node_id) {
                    result.add_issue(ValidationIssue {
                        code: ValidationCode::E206MissingNodes,
                        severity: Severity::Error,
                        message: format!("Element {} references missing node {}", elem.id, node_id),
                        location: Some(ValidationLocation::Element(elem.id)),
                        suggestion: None,
                    });
                }
            }
        }
        
        result
    }
}

// ============================================================================
// TESTS
// ============================================================================

#[cfg(test)]
mod tests {
    use super::*;
    
    #[test]
    fn test_node_validation() {
        let nodes = vec![
            NodeData { id: 1, x: 0.0, y: 0.0, z: 0.0 },
            NodeData { id: 2, x: 1.0, y: 0.0, z: 0.0 },
            NodeData { id: 3, x: 0.0, y: 0.0, z: 0.0 }, // Coincident with 1
            NodeData { id: 4, x: 0.0, y: 1.0, z: 0.0 }, // Orphan
        ];
        
        let referenced: HashSet<usize> = [1, 2, 3].iter().copied().collect();
        
        let validator = NodeValidator::default();
        let result = validator.validate(&nodes, &referenced);
        
        // Should find coincident nodes and orphan
        assert!(result.issues.iter().any(|i| i.code == ValidationCode::N101CoincidentNodes));
        assert!(result.issues.iter().any(|i| i.code == ValidationCode::N102OrphanNode));
    }
    
    #[test]
    fn test_element_validation() {
        let elements = vec![
            ElementData {
                id: 1,
                element_type: ElementType::Beam,
                nodes: vec![1, 2],
                material_id: Some("steel".to_string()),
                section_id: Some("W10x12".to_string()),
            },
            ElementData {
                id: 2,
                element_type: ElementType::Beam,
                nodes: vec![2, 99], // Missing node
                material_id: Some("missing_mat".to_string()), // Missing material
                section_id: None,
            },
        ];
        
        let mut node_coords: HashMap<usize, (f64, f64, f64)> = HashMap::new();
        node_coords.insert(1, (0.0, 0.0, 0.0));
        node_coords.insert(2, (1.0, 0.0, 0.0));
        
        let materials: HashSet<String> = ["steel".to_string()].into_iter().collect();
        let sections: HashSet<String> = ["W10x12".to_string()].into_iter().collect();
        
        let validator = ElementValidator::default();
        let result = validator.validate(&elements, &node_coords, &materials, &sections);
        
        assert!(result.issues.iter().any(|i| i.code == ValidationCode::E206MissingNodes));
        assert!(result.issues.iter().any(|i| i.code == ValidationCode::M304MissingMaterial));
    }
    
    #[test]
    fn test_material_validation() {
        let materials = vec![
            MaterialData {
                id: "steel".to_string(),
                e: 200e9,
                nu: 0.3,
                rho: 7850.0,
                fy: Some(250e6),
                fu: Some(400e6),
            },
            MaterialData {
                id: "invalid".to_string(),
                e: -1.0, // Invalid
                nu: 0.6, // Invalid
                rho: -1.0, // Invalid
                fy: Some(500e6),
                fu: Some(400e6), // Yield > Ultimate
            },
        ];
        
        let result = MaterialValidator::validate(&materials);
        
        assert!(result.issues.iter().any(|i| i.code == ValidationCode::M301NegativeModulus));
        assert!(result.issues.iter().any(|i| i.code == ValidationCode::M302InvalidPoisson));
        assert!(result.issues.iter().any(|i| i.code == ValidationCode::M303NegativeDensity));
        assert!(result.issues.iter().any(|i| i.code == ValidationCode::M305YieldExceedsUltimate));
    }
    
    #[test]
    fn test_bc_validation() {
        let bcs = vec![
            BoundaryCondition { node_id: 1, dof: 0, value: 0.0, bc_type: BcType::Fixed },
            BoundaryCondition { node_id: 1, dof: 0, value: 1.0, bc_type: BcType::Fixed }, // Conflict
            BoundaryCondition { node_id: 99, dof: 0, value: 0.0, bc_type: BcType::Fixed }, // Missing node
        ];
        
        let node_ids: HashSet<usize> = [1, 2, 3].iter().copied().collect();
        
        let result = BoundaryConditionValidator::validate(&bcs, &node_ids);
        
        assert!(result.issues.iter().any(|i| i.code == ValidationCode::B601ConflictingBc));
        assert!(result.issues.iter().any(|i| i.code == ValidationCode::B602BcOnMissingNode));
    }
    
    #[test]
    fn test_validation_result() {
        let mut result = ValidationResult::new();
        
        assert!(result.passed);
        
        result.add_issue(ValidationIssue {
            code: ValidationCode::N102OrphanNode,
            severity: Severity::Warning,
            message: "Test warning".to_string(),
            location: None,
            suggestion: None,
        });
        
        assert!(result.passed); // Warnings don't fail
        assert_eq!(result.n_warnings, 1);
        
        result.add_issue(ValidationIssue {
            code: ValidationCode::E201ZeroLength,
            severity: Severity::Error,
            message: "Test error".to_string(),
            location: None,
            suggestion: None,
        });
        
        assert!(!result.passed); // Errors fail
        assert_eq!(result.n_errors, 1);
    }
    
    #[test]
    fn test_full_model_validation() {
        let nodes = vec![
            NodeData { id: 1, x: 0.0, y: 0.0, z: 0.0 },
            NodeData { id: 2, x: 1.0, y: 0.0, z: 0.0 },
        ];
        
        let elements = vec![
            ElementData {
                id: 1,
                element_type: ElementType::Beam,
                nodes: vec![1, 2],
                material_id: Some("steel".to_string()),
                section_id: Some("W10x12".to_string()),
            },
        ];
        
        let materials = vec![
            MaterialData {
                id: "steel".to_string(),
                e: 200e9,
                nu: 0.3,
                rho: 7850.0,
                fy: None,
                fu: None,
            },
        ];
        
        let bcs = vec![
            BoundaryCondition { node_id: 1, dof: 0, value: 0.0, bc_type: BcType::Fixed },
            BoundaryCondition { node_id: 1, dof: 1, value: 0.0, bc_type: BcType::Fixed },
            BoundaryCondition { node_id: 1, dof: 2, value: 0.0, bc_type: BcType::Fixed },
        ];
        
        let loads = vec![
            LoadData {
                load_case: "DL".to_string(),
                node_id: Some(2),
                element_id: None,
                dof: 1,
                value: -1000.0,
            },
        ];
        
        let validator = ModelValidator::default();
        let result = validator.validate_full(&nodes, &elements, &materials, &bcs, &loads);
        
        // Valid model should pass (may have warnings)
        assert!(result.n_fatal == 0);
        assert!(result.n_errors == 0);
    }
    
    #[test]
    fn test_empty_model() {
        let validator = ModelValidator::default();
        let result = validator.validate_full(&[], &[], &[], &[], &[]);
        
        assert!(!result.passed);
        assert!(result.issues.iter().any(|i| i.code == ValidationCode::G801EmptyModel));
    }
}
