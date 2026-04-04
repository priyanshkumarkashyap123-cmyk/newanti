//! # IFC Export Module
//! 
//! Industry Foundation Classes (IFC) export for BIM interoperability.
//! Implements IFC 4x3 schema for structural analysis models.
//! 
//! This is CRITICAL for modern construction workflows.

use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fmt::Write;

// ============================================================================
// IFC ENTITY TYPES
// ============================================================================

/// IFC entity reference (handle)
pub type IfcId = u64;

/// IFC entity type
#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
pub enum IfcEntityType {
    // Geometry
    IfcCartesianPoint,
    IfcDirection,
    IfcAxis2Placement3D,
    IfcLocalPlacement,
    IfcPolyline,
    IfcExtrudedAreaSolid,
    IfcRectangleProfileDef,
    IfcIShapeProfileDef,
    IfcCircleProfileDef,
    
    // Products
    IfcProject,
    IfcSite,
    IfcBuilding,
    IfcBuildingStorey,
    IfcBeam,
    IfcColumn,
    IfcSlab,
    IfcWall,
    IfcPlate,
    IfcMember,
    IfcFooting,
    
    // Structural
    IfcStructuralCurveMember,
    IfcStructuralSurfaceMember,
    IfcStructuralPointConnection,
    IfcStructuralCurveAction,
    IfcStructuralPointAction,
    IfcStructuralLoadGroup,
    IfcStructuralAnalysisModel,
    IfcStructuralResultGroup,
    
    // Materials
    IfcMaterial,
    IfcMaterialProfile,
    IfcMaterialProfileSet,
    IfcRelAssociatesMaterial,
    
    // Properties
    IfcPropertySet,
    IfcPropertySingleValue,
    IfcRelDefinesByProperties,
    
    // Relationships
    IfcRelAggregates,
    IfcRelContainedInSpatialStructure,
    IfcRelConnectsStructuralMember,
}

impl IfcEntityType {
    pub fn as_str(&self) -> &'static str {
        match self {
            Self::IfcCartesianPoint => "IFCCARTESIANPOINT",
            Self::IfcDirection => "IFCDIRECTION",
            Self::IfcAxis2Placement3D => "IFCAXIS2PLACEMENT3D",
            Self::IfcLocalPlacement => "IFCLOCALPLACEMENT",
            Self::IfcPolyline => "IFCPOLYLINE",
            Self::IfcExtrudedAreaSolid => "IFCEXTRUDEDAREASOLID",
            Self::IfcRectangleProfileDef => "IFCRECTANGLEPROFILEDEF",
            Self::IfcIShapeProfileDef => "IFCISHAPEPROFILEDEF",
            Self::IfcCircleProfileDef => "IFCCIRCLEPROFILEDEF",
            Self::IfcProject => "IFCPROJECT",
            Self::IfcSite => "IFCSITE",
            Self::IfcBuilding => "IFCBUILDING",
            Self::IfcBuildingStorey => "IFCBUILDINGSTOREY",
            Self::IfcBeam => "IFCBEAM",
            Self::IfcColumn => "IFCCOLUMN",
            Self::IfcSlab => "IFCSLAB",
            Self::IfcWall => "IFCWALL",
            Self::IfcPlate => "IFCPLATE",
            Self::IfcMember => "IFCMEMBER",
            Self::IfcFooting => "IFCFOOTING",
            Self::IfcStructuralCurveMember => "IFCSTRUCTURALCURVEMEMBER",
            Self::IfcStructuralSurfaceMember => "IFCSTRUCTURALSURFACEMEMBER",
            Self::IfcStructuralPointConnection => "IFCSTRUCTURALPOINTCONNECTION",
            Self::IfcStructuralCurveAction => "IFCSTRUCTURALCURVEACTION",
            Self::IfcStructuralPointAction => "IFCSTRUCTURALPOINTACTION",
            Self::IfcStructuralLoadGroup => "IFCSTRUCTURALLOADGROUP",
            Self::IfcStructuralAnalysisModel => "IFCSTRUCTURALANALYSISMODEL",
            Self::IfcStructuralResultGroup => "IFCSTRUCTURALRESULTGROUP",
            Self::IfcMaterial => "IFCMATERIAL",
            Self::IfcMaterialProfile => "IFCMATERIALPROFILE",
            Self::IfcMaterialProfileSet => "IFCMATERIALPROFILESET",
            Self::IfcRelAssociatesMaterial => "IFCRELASSOCIATESMATERIAL",
            Self::IfcPropertySet => "IFCPROPERTYSET",
            Self::IfcPropertySingleValue => "IFCPROPERTYSINGLEVALUE",
            Self::IfcRelDefinesByProperties => "IFCRELDEFINESBYPROPERTIES",
            Self::IfcRelAggregates => "IFCRELAGGREGATES",
            Self::IfcRelContainedInSpatialStructure => "IFCRELCONTAINEDINSPATIALSTRUCTURE",
            Self::IfcRelConnectsStructuralMember => "IFCRELCONNECTSSTRUCTURALMEMBER",
        }
    }
}

// ============================================================================
// IFC STRUCTURAL MODEL
// ============================================================================

/// Node for IFC export
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct IfcNode {
    pub id: usize,
    pub x: f64,
    pub y: f64,
    pub z: f64,
    pub name: String,
    /// Support conditions [dx, dy, dz, rx, ry, rz]
    pub support: [bool; 6],
}

impl IfcNode {
    pub fn new(id: usize, x: f64, y: f64, z: f64) -> Self {
        Self {
            id,
            x, y, z,
            name: format!("N{}", id),
            support: [false; 6],
        }
    }
    
    pub fn with_support(mut self, support: [bool; 6]) -> Self {
        self.support = support;
        self
    }
    
    pub fn is_supported(&self) -> bool {
        self.support.iter().any(|&s| s)
    }
}

/// Member type for IFC export
#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
pub enum IfcMemberType {
    Beam,
    Column,
    Brace,
    Strut,
    Stud,
    Chord,
}

/// Frame member for IFC export
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct IfcMember {
    pub id: usize,
    pub node_i: usize,
    pub node_j: usize,
    pub member_type: IfcMemberType,
    pub section_name: String,
    pub material_name: String,
    pub rotation: f64,  // Beta angle (degrees)
}

impl IfcMember {
    pub fn beam(id: usize, node_i: usize, node_j: usize, section: &str, material: &str) -> Self {
        Self {
            id, node_i, node_j,
            member_type: IfcMemberType::Beam,
            section_name: section.to_string(),
            material_name: material.to_string(),
            rotation: 0.0,
        }
    }
    
    pub fn column(id: usize, node_i: usize, node_j: usize, section: &str, material: &str) -> Self {
        Self {
            id, node_i, node_j,
            member_type: IfcMemberType::Column,
            section_name: section.to_string(),
            material_name: material.to_string(),
            rotation: 0.0,
        }
    }
}

/// Load case for IFC export
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct IfcLoadCase {
    pub id: usize,
    pub name: String,
    pub load_type: String,  // DEAD, LIVE, WIND, SEISMIC, etc.
    pub description: String,
}

/// Nodal load for IFC export
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct IfcNodalLoad {
    pub load_case_id: usize,
    pub node_id: usize,
    pub fx: f64,
    pub fy: f64,
    pub fz: f64,
    pub mx: f64,
    pub my: f64,
    pub mz: f64,
}

/// Section profile for IFC export
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum IfcProfile {
    Rectangle { width: f64, height: f64 },
    Circle { radius: f64 },
    IShape { 
        depth: f64, 
        width: f64, 
        web_thickness: f64, 
        flange_thickness: f64 
    },
    CShape {
        depth: f64,
        width: f64,
        web_thickness: f64,
        flange_thickness: f64,
    },
    LShape {
        width: f64,
        depth: f64,
        thickness: f64,
    },
}

impl IfcProfile {
    pub fn area(&self) -> f64 {
        match self {
            Self::Rectangle { width, height } => width * height,
            Self::Circle { radius } => std::f64::consts::PI * radius * radius,
            Self::IShape { depth, width, web_thickness, flange_thickness } => {
                2.0 * width * flange_thickness + (depth - 2.0 * flange_thickness) * web_thickness
            }
            Self::CShape { depth, width, web_thickness, flange_thickness } => {
                2.0 * width * flange_thickness + (depth - 2.0 * flange_thickness) * web_thickness
            }
            Self::LShape { width, depth, thickness } => {
                width * thickness + (depth - thickness) * thickness
            }
        }
    }
}

// ============================================================================
// IFC EXPORTER
// ============================================================================

/// Main IFC exporter
#[derive(Debug, Clone)]
pub struct IfcExporter {
    /// Project name
    pub project_name: String,
    /// Project description
    pub description: String,
    /// Author name
    pub author: String,
    /// Organization
    pub organization: String,
    /// Nodes
    pub nodes: Vec<IfcNode>,
    /// Members
    pub members: Vec<IfcMember>,
    /// Profiles
    pub profiles: HashMap<String, IfcProfile>,
    /// Materials
    pub materials: HashMap<String, IfcMaterialDef>,
    /// Load cases
    pub load_cases: Vec<IfcLoadCase>,
    /// Nodal loads
    pub nodal_loads: Vec<IfcNodalLoad>,
    /// Current entity ID counter
    next_id: IfcId,
    /// Entity ID map
    entity_ids: HashMap<String, IfcId>,
}

/// Material definition
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct IfcMaterialDef {
    pub name: String,
    pub grade: String,
    pub density: f64,      // kg/m³
    pub youngs_modulus: f64,  // Pa
    pub poisson_ratio: f64,
    pub yield_strength: f64,  // Pa
}

impl IfcMaterialDef {
    pub fn steel_s275() -> Self {
        Self {
            name: "Steel S275".to_string(),
            grade: "S275".to_string(),
            density: 7850.0,
            youngs_modulus: 210e9,
            poisson_ratio: 0.3,
            yield_strength: 275e6,
        }
    }
    
    pub fn steel_s355() -> Self {
        Self {
            name: "Steel S355".to_string(),
            grade: "S355".to_string(),
            density: 7850.0,
            youngs_modulus: 210e9,
            poisson_ratio: 0.3,
            yield_strength: 355e6,
        }
    }
    
    pub fn concrete_m30() -> Self {
        Self {
            name: "Concrete M30".to_string(),
            grade: "M30".to_string(),
            density: 2500.0,
            youngs_modulus: 27.4e9,
            poisson_ratio: 0.2,
            yield_strength: 30e6,
        }
    }
}

impl IfcExporter {
    /// Create new exporter
    pub fn new(project_name: &str) -> Self {
        Self {
            project_name: project_name.to_string(),
            description: String::new(),
            author: "Structural Engineer".to_string(),
            organization: "Engineering Firm".to_string(),
            nodes: Vec::new(),
            members: Vec::new(),
            profiles: HashMap::new(),
            materials: HashMap::new(),
            load_cases: Vec::new(),
            nodal_loads: Vec::new(),
            next_id: 1,
            entity_ids: HashMap::new(),
        }
    }
    
    /// Set project metadata
    pub fn with_metadata(mut self, description: &str, author: &str, org: &str) -> Self {
        self.description = description.to_string();
        self.author = author.to_string();
        self.organization = org.to_string();
        self
    }
    
    /// Add node
    pub fn add_node(&mut self, node: IfcNode) {
        self.nodes.push(node);
    }
    
    /// Add member
    pub fn add_member(&mut self, member: IfcMember) {
        self.members.push(member);
    }
    
    /// Add profile
    pub fn add_profile(&mut self, name: &str, profile: IfcProfile) {
        self.profiles.insert(name.to_string(), profile);
    }
    
    /// Add material
    pub fn add_material(&mut self, material: IfcMaterialDef) {
        self.materials.insert(material.name.clone(), material);
    }
    
    /// Add load case
    pub fn add_load_case(&mut self, load_case: IfcLoadCase) {
        self.load_cases.push(load_case);
    }
    
    /// Add nodal load
    pub fn add_nodal_load(&mut self, load: IfcNodalLoad) {
        self.nodal_loads.push(load);
    }
    
    /// Get next entity ID
    fn get_id(&mut self) -> IfcId {
        let id = self.next_id;
        self.next_id += 1;
        id
    }
    
    /// Store entity ID for reference
    fn store_id(&mut self, key: &str, id: IfcId) {
        self.entity_ids.insert(key.to_string(), id);
    }
    
    /// Get stored entity ID
    fn get_stored_id(&self, key: &str) -> Option<IfcId> {
        self.entity_ids.get(key).copied()
    }
    
    /// Generate IFC STEP file content
    pub fn export(&mut self) -> String {
        let mut output = String::with_capacity(100_000);
        
        // Write header
        self.write_header(&mut output);
        
        // Write data section
        writeln!(output, "DATA;").unwrap();
        
        // Core entities
        self.write_units(&mut output);
        self.write_project(&mut output);
        self.write_site(&mut output);
        self.write_building(&mut output);
        self.write_storey(&mut output);
        
        // Structural model
        self.write_structural_analysis_model(&mut output);
        self.write_materials(&mut output);
        self.write_profiles(&mut output);
        self.write_nodes(&mut output);
        self.write_members(&mut output);
        self.write_loads(&mut output);
        
        // Relationships
        self.write_relationships(&mut output);
        
        writeln!(output, "ENDSEC;").unwrap();
        writeln!(output, "END-ISO-10303-21;").unwrap();
        
        output
    }
    
    fn write_header(&self, output: &mut String) {
        writeln!(output, "ISO-10303-21;").unwrap();
        writeln!(output, "HEADER;").unwrap();
        writeln!(output, "FILE_DESCRIPTION(('IFC4X3'),'2;1');").unwrap();
        writeln!(output, "FILE_NAME('{}','{}',('{}'),('{}'),'','StructuralEngine','');",
            self.project_name,
            chrono_lite_timestamp(),
            self.author,
            self.organization,
        ).unwrap();
        writeln!(output, "FILE_SCHEMA(('IFC4X3'));").unwrap();
        writeln!(output, "ENDSEC;").unwrap();
    }
    
    fn write_units(&mut self, output: &mut String) {
        // SI units
        let unit_id = self.get_id();
        self.store_id("units", unit_id);
        
        // Length unit (meters)
        let length_id = self.get_id();
        writeln!(output, "#{}=IFCSIUNIT(*,.LENGTHUNIT.,.MILLI.,.METRE.);", length_id).unwrap();
        
        // Area unit
        let area_id = self.get_id();
        writeln!(output, "#{}=IFCSIUNIT(*,.AREAUNIT.,$,.SQUARE_METRE.);", area_id).unwrap();
        
        // Volume unit
        let vol_id = self.get_id();
        writeln!(output, "#{}=IFCSIUNIT(*,.VOLUMEUNIT.,$,.CUBIC_METRE.);", vol_id).unwrap();
        
        // Force unit (Newton)
        let force_id = self.get_id();
        writeln!(output, "#{}=IFCSIUNIT(*,.FORCEUNIT.,$,.NEWTON.);", force_id).unwrap();
        
        // Plane angle (radian)
        let angle_id = self.get_id();
        writeln!(output, "#{}=IFCSIUNIT(*,.PLANEANGLEUNIT.,$,.RADIAN.);", angle_id).unwrap();
        
        // Unit assignment
        writeln!(output, "#{}=IFCUNITASSIGNMENT((#{},#{},#{},#{},#{}));",
            unit_id, length_id, area_id, vol_id, force_id, angle_id).unwrap();
    }
    
    fn write_project(&mut self, output: &mut String) {
        let project_id = self.get_id();
        self.store_id("project", project_id);
        
        let units_id = self.get_stored_id("units").unwrap_or(1);
        
        writeln!(output, "#{}=IFCPROJECT('{}',#{},'{}','{}',*,*,*,(#{}),#{});",
            project_id,
            generate_guid(),
            1,  // Owner history (simplified)
            self.project_name,
            self.description,
            units_id,
            units_id,
        ).unwrap();
    }
    
    fn write_site(&mut self, output: &mut String) {
        let site_id = self.get_id();
        self.store_id("site", site_id);
        
        writeln!(output, "#{}=IFCSITE('{}',#{},'Site','Main construction site',$,$,$,$,.ELEMENT.,$,$,$,$,$);",
            site_id,
            generate_guid(),
            1,
        ).unwrap();
    }
    
    fn write_building(&mut self, output: &mut String) {
        let bldg_id = self.get_id();
        self.store_id("building", bldg_id);
        
        writeln!(output, "#{}=IFCBUILDING('{}',#{},'Building','Main building',$,$,$,$,.ELEMENT.,$,$,$);",
            bldg_id,
            generate_guid(),
            1,
        ).unwrap();
    }
    
    fn write_storey(&mut self, output: &mut String) {
        let storey_id = self.get_id();
        self.store_id("storey", storey_id);
        
        writeln!(output, "#{}=IFCBUILDINGSTOREY('{}',#{},'Level 1','Ground floor',$,$,$,$,.ELEMENT.,0.0);",
            storey_id,
            generate_guid(),
            1,
        ).unwrap();
    }
    
    fn write_structural_analysis_model(&mut self, output: &mut String) {
        let model_id = self.get_id();
        self.store_id("analysis_model", model_id);
        
        writeln!(output, "#{}=IFCSTRUCTURALANALYSISMODEL('{}',#{},'Structural Model','3D Frame Analysis',$,$,$,.LOADING_3D.,$);",
            model_id,
            generate_guid(),
            1,
        ).unwrap();
    }
    
    fn write_materials(&mut self, output: &mut String) {
        // Clone materials to avoid borrow issues
        let materials: Vec<_> = self.materials.iter().map(|(k, v)| (k.clone(), v.clone())).collect();
        for (name, mat) in &materials {
            let mat_id = self.get_id();
            self.store_id(&format!("material_{}", name), mat_id);
            
            writeln!(output, "#{}=IFCMATERIAL('{}','{}');",
                mat_id,
                mat.name,
                mat.grade,
            ).unwrap();
            
            // Material properties
            let props_id = self.get_id();
            writeln!(output, "#{}=IFCMATERIALPROPERTIES('Mechanical Properties',$,#{},(.IFCPROPERTYSINGLEVALUE.));",
                props_id,
                mat_id,
            ).unwrap();
        }
    }
    
    fn write_profiles(&mut self, output: &mut String) {
        // Clone profiles to avoid borrow issues
        let profiles: Vec<_> = self.profiles.iter().map(|(k, v)| (k.clone(), v.clone())).collect();
        for (name, profile) in &profiles {
            let profile_id = self.get_id();
            self.store_id(&format!("profile_{}", name), profile_id);
            
            match profile {
                IfcProfile::Rectangle { width, height } => {
                    writeln!(output, "#{}=IFCRECTANGLEPROFILEDEF(.AREA.,'{}',#$,{},{});",
                        profile_id,
                        name,
                        width * 1000.0,  // Convert to mm
                        height * 1000.0,
                    ).unwrap();
                }
                IfcProfile::IShape { depth, width, web_thickness, flange_thickness } => {
                    writeln!(output, "#{}=IFCISHAPEPROFILEDEF(.AREA.,'{}',#$,{},{},{},{},{},{},{});",
                        profile_id,
                        name,
                        depth * 1000.0,
                        width * 1000.0,
                        web_thickness * 1000.0,
                        flange_thickness * 1000.0,
                        0.0,  // Fillet radius
                        0.0,  // Flange edge radius
                        0.0,  // Flange slope
                    ).unwrap();
                }
                IfcProfile::Circle { radius } => {
                    writeln!(output, "#{}=IFCCIRCLEPROFILEDEF(.AREA.,'{}',#$,{});",
                        profile_id,
                        name,
                        radius * 1000.0,
                    ).unwrap();
                }
                _ => {
                    // Other profiles: output as rectangle approximation
                    let area = profile.area();
                    let equiv_side = area.sqrt() * 1000.0;
                    writeln!(output, "#{}=IFCRECTANGLEPROFILEDEF(.AREA.,'{}',#$,{},{});",
                        profile_id,
                        name,
                        equiv_side,
                        equiv_side,
                    ).unwrap();
                }
            }
        }
    }
    
    fn write_nodes(&mut self, output: &mut String) {
        // Clone nodes to avoid borrow issues
        let nodes = self.nodes.clone();
        for node in &nodes {
            // Cartesian point
            let point_id = self.get_id();
            self.store_id(&format!("point_{}", node.id), point_id);
            
            writeln!(output, "#{}=IFCCARTESIANPOINT(({},{},{}));",
                point_id,
                node.x * 1000.0,  // Convert to mm
                node.y * 1000.0,
                node.z * 1000.0,
            ).unwrap();
            
            // Structural point connection
            let conn_id = self.get_id();
            self.store_id(&format!("node_{}", node.id), conn_id);
            
            let support_str = if node.is_supported() {
                // Create boundary condition
                let bc_id = self.get_id();
                let conditions: Vec<&str> = node.support.iter()
                    .map(|&s| if s { ".RIGID." } else { ".FREE." })
                    .collect();
                writeln!(output, "#{}=IFCBOUNDARYNODECONDITION('BC_{}',{},{},{},{},{},{});",
                    bc_id,
                    node.id,
                    conditions[0], conditions[1], conditions[2],
                    conditions[3], conditions[4], conditions[5],
                ).unwrap();
                format!(",#{}", bc_id)
            } else {
                String::new()
            };
            
            writeln!(output, "#{}=IFCSTRUCTURALPOINTCONNECTION('{}',#{},'{}','Node {}',$,#{},${},$);",
                conn_id,
                generate_guid(),
                1,
                node.name,
                node.id,
                point_id,
                support_str,
            ).unwrap();
        }
    }
    
    fn write_members(&mut self, output: &mut String) {
        // Clone members to avoid borrow issues
        let members = self.members.clone();
        for member in &members {
            // Get node points
            let point_i = self.get_stored_id(&format!("point_{}", member.node_i)).unwrap_or(1);
            let point_j = self.get_stored_id(&format!("point_{}", member.node_j)).unwrap_or(1);
            
            // Create polyline
            let line_id = self.get_id();
            writeln!(output, "#{}=IFCPOLYLINE((#{},#{}));",
                line_id, point_i, point_j).unwrap();
            
            // Structural curve member
            let member_id = self.get_id();
            self.store_id(&format!("member_{}", member.id), member_id);
            
            let member_type = match member.member_type {
                IfcMemberType::Beam => ".RIGID_JOINED_MEMBER.",
                IfcMemberType::Column => ".RIGID_JOINED_MEMBER.",
                IfcMemberType::Brace => ".PIN_JOINED_MEMBER.",
                _ => ".RIGID_JOINED_MEMBER.",
            };
            
            writeln!(output, "#{}=IFCSTRUCTURALCURVEMEMBER('{}',#{},'M{}','Member {}',$,#{},$,{},.TENSION_AND_COMPRESSION.);",
                member_id,
                generate_guid(),
                1,
                member.id,
                member.id,
                line_id,
                member_type,
            ).unwrap();
            
            // Physical representation (beam/column)
            let phys_id = self.get_id();
            let ifc_type = match member.member_type {
                IfcMemberType::Column => "IFCCOLUMN",
                _ => "IFCBEAM",
            };
            
            writeln!(output, "#{}={}('{}',#{},'{}','Physical member {}',$,$,$,$,$);",
                phys_id,
                ifc_type,
                generate_guid(),
                1,
                member.section_name,
                member.id,
            ).unwrap();
        }
    }
    
    fn write_loads(&mut self, output: &mut String) {
        // Load groups - clone to avoid borrow issues
        let load_cases = self.load_cases.clone();
        for lc in &load_cases {
            let group_id = self.get_id();
            self.store_id(&format!("loadcase_{}", lc.id), group_id);
            
            let action_type = match lc.load_type.as_str() {
                "DEAD" => ".PERMANENT_G.",
                "LIVE" => ".VARIABLE_Q.",
                "WIND" => ".VARIABLE_Q.",
                "SEISMIC" => ".EXCEPTIONAL_A.",
                _ => ".VARIABLE_Q.",
            };
            
            writeln!(output, "#{}=IFCSTRUCTURALLOADGROUP('{}',#{},'{}','{}',{},.LOAD_GROUP.,$,$,$,1.0);",
                group_id,
                generate_guid(),
                1,
                lc.name,
                lc.description,
                action_type,
            ).unwrap();
        }
        
        // Point actions (nodal loads) - clone to avoid borrow issues
        let nodal_loads = self.nodal_loads.clone();
        for load in &nodal_loads {
            let _node_id = self.get_stored_id(&format!("node_{}", load.node_id)).unwrap_or(1);
            let _lc_id = self.get_stored_id(&format!("loadcase_{}", load.load_case_id)).unwrap_or(1);
            
            // Load values
            let load_val_id = self.get_id();
            writeln!(output, "#{}=IFCSTRUCTURALLOADSINGLEFORCE('Load',{},{},{},{},{},{});",
                load_val_id,
                load.fx, load.fy, load.fz,
                load.mx, load.my, load.mz,
            ).unwrap();
            
            // Point action
            let action_id = self.get_id();
            writeln!(output, "#{}=IFCSTRUCTURALPOINTACTION('{}',#{},'Load','Applied force',$,$,$,.GLOBAL_COORDS.,$,#{});",
                action_id,
                generate_guid(),
                1,
                load_val_id,
            ).unwrap();
        }
    }
    
    fn write_relationships(&mut self, output: &mut String) {
        let project_id = self.get_stored_id("project").unwrap_or(1);
        let site_id = self.get_stored_id("site").unwrap_or(1);
        let bldg_id = self.get_stored_id("building").unwrap_or(1);
        let storey_id = self.get_stored_id("storey").unwrap_or(1);
        
        // Project contains site
        let rel_id = self.get_id();
        writeln!(output, "#{}=IFCRELAGGREGATES('{}',#{},'ProjectToSite',$,#{},#{});",
            rel_id, generate_guid(), 1, project_id, site_id).unwrap();
        
        // Site contains building
        let rel_id = self.get_id();
        writeln!(output, "#{}=IFCRELAGGREGATES('{}',#{},'SiteToBuilding',$,#{},#{});",
            rel_id, generate_guid(), 1, site_id, bldg_id).unwrap();
        
        // Building contains storey
        let rel_id = self.get_id();
        writeln!(output, "#{}=IFCRELAGGREGATES('{}',#{},'BuildingToStorey',$,#{},#{});",
            rel_id, generate_guid(), 1, bldg_id, storey_id).unwrap();
    }
}

// ============================================================================
// DXF EXPORT (AutoCAD)
// ============================================================================

/// DXF exporter for 2D drawings
#[derive(Debug, Clone)]
pub struct DxfExporter {
    /// Project name
    pub name: String,
    /// Entities
    entities: Vec<DxfEntity>,
    /// Layers
    layers: Vec<DxfLayer>,
}

#[derive(Debug, Clone)]
struct DxfLayer {
    name: String,
    color: u8,
}

#[derive(Debug, Clone)]
enum DxfEntity {
    Line { x1: f64, y1: f64, x2: f64, y2: f64, layer: String },
    Circle { x: f64, y: f64, radius: f64, layer: String },
    Arc { x: f64, y: f64, radius: f64, start_angle: f64, end_angle: f64, layer: String },
    Text { x: f64, y: f64, height: f64, text: String, layer: String },
    Point { x: f64, y: f64, layer: String },
    Polyline { points: Vec<(f64, f64)>, closed: bool, layer: String },
}

impl DxfExporter {
    pub fn new(name: &str) -> Self {
        let default_layers = vec![
            DxfLayer { name: "Nodes".to_string(), color: 1 },      // Red
            DxfLayer { name: "Members".to_string(), color: 7 },    // White
            DxfLayer { name: "Supports".to_string(), color: 3 },   // Green
            DxfLayer { name: "Loads".to_string(), color: 4 },      // Cyan
            DxfLayer { name: "Text".to_string(), color: 2 },       // Yellow
            DxfLayer { name: "Dimensions".to_string(), color: 6 }, // Magenta
        ];
        
        Self {
            name: name.to_string(),
            entities: Vec::new(),
            layers: default_layers,
        }
    }
    
    /// Add line
    pub fn add_line(&mut self, x1: f64, y1: f64, x2: f64, y2: f64, layer: &str) {
        self.entities.push(DxfEntity::Line {
            x1, y1, x2, y2,
            layer: layer.to_string(),
        });
    }
    
    /// Add circle (for nodes)
    pub fn add_circle(&mut self, x: f64, y: f64, radius: f64, layer: &str) {
        self.entities.push(DxfEntity::Circle {
            x, y, radius,
            layer: layer.to_string(),
        });
    }
    
    /// Add text annotation
    pub fn add_text(&mut self, x: f64, y: f64, height: f64, text: &str, layer: &str) {
        self.entities.push(DxfEntity::Text {
            x, y, height,
            text: text.to_string(),
            layer: layer.to_string(),
        });
    }
    
    /// Add point marker
    pub fn add_point(&mut self, x: f64, y: f64, layer: &str) {
        self.entities.push(DxfEntity::Point {
            x, y,
            layer: layer.to_string(),
        });
    }
    
    /// Add polyline
    pub fn add_polyline(&mut self, points: Vec<(f64, f64)>, closed: bool, layer: &str) {
        self.entities.push(DxfEntity::Polyline {
            points, closed,
            layer: layer.to_string(),
        });
    }
    
    /// Add node with label
    pub fn add_node(&mut self, id: usize, x: f64, y: f64, radius: f64) {
        self.add_circle(x, y, radius, "Nodes");
        self.add_text(x + radius * 1.5, y + radius * 1.5, radius, &format!("N{}", id), "Text");
    }
    
    /// Add member with label
    pub fn add_member(&mut self, id: usize, x1: f64, y1: f64, x2: f64, y2: f64) {
        self.add_line(x1, y1, x2, y2, "Members");
        let mid_x = (x1 + x2) / 2.0;
        let mid_y = (y1 + y2) / 2.0;
        self.add_text(mid_x, mid_y + 0.1, 0.1, &format!("M{}", id), "Text");
    }
    
    /// Add support symbol (triangle)
    pub fn add_support_pin(&mut self, x: f64, y: f64, size: f64) {
        let points = vec![
            (x, y),
            (x - size, y - size),
            (x + size, y - size),
            (x, y),
        ];
        self.add_polyline(points, true, "Supports");
    }
    
    /// Add fixed support symbol
    pub fn add_support_fixed(&mut self, x: f64, y: f64, size: f64) {
        // Hatched rectangle
        self.add_line(x - size, y, x + size, y, "Supports");
        self.add_line(x - size, y, x - size, y - size * 0.5, "Supports");
        self.add_line(x + size, y, x + size, y - size * 0.5, "Supports");
        // Hatch lines
        for i in 0..5 {
            let xi = x - size + i as f64 * size * 0.5;
            self.add_line(xi, y, xi - size * 0.3, y - size * 0.5, "Supports");
        }
    }
    
    /// Export to DXF format
    pub fn export(&self) -> String {
        let mut output = String::with_capacity(50_000);
        
        // Header section
        self.write_header(&mut output);
        
        // Tables section
        self.write_tables(&mut output);
        
        // Entities section
        self.write_entities(&mut output);
        
        // EOF
        writeln!(output, "  0\nEOF").unwrap();
        
        output
    }
    
    fn write_header(&self, output: &mut String) {
        writeln!(output, "  0\nSECTION").unwrap();
        writeln!(output, "  2\nHEADER").unwrap();
        writeln!(output, "  9\n$ACADVER\n  1\nAC1027").unwrap();  // AutoCAD 2013
        writeln!(output, "  9\n$INSUNITS\n 70\n     6").unwrap();  // Meters
        writeln!(output, "  0\nENDSEC").unwrap();
    }
    
    fn write_tables(&self, output: &mut String) {
        writeln!(output, "  0\nSECTION").unwrap();
        writeln!(output, "  2\nTABLES").unwrap();
        
        // Layer table
        writeln!(output, "  0\nTABLE").unwrap();
        writeln!(output, "  2\nLAYER").unwrap();
        writeln!(output, " 70\n{}", self.layers.len()).unwrap();
        
        for layer in &self.layers {
            writeln!(output, "  0\nLAYER").unwrap();
            writeln!(output, "  2\n{}", layer.name).unwrap();
            writeln!(output, " 70\n     0").unwrap();
            writeln!(output, " 62\n{}", layer.color).unwrap();
            writeln!(output, "  6\nCONTINUOUS").unwrap();
        }
        
        writeln!(output, "  0\nENDTAB").unwrap();
        writeln!(output, "  0\nENDSEC").unwrap();
    }
    
    fn write_entities(&self, output: &mut String) {
        writeln!(output, "  0\nSECTION").unwrap();
        writeln!(output, "  2\nENTITIES").unwrap();
        
        for entity in &self.entities {
            match entity {
                DxfEntity::Line { x1, y1, x2, y2, layer } => {
                    writeln!(output, "  0\nLINE").unwrap();
                    writeln!(output, "  8\n{}", layer).unwrap();
                    writeln!(output, " 10\n{}", x1).unwrap();
                    writeln!(output, " 20\n{}", y1).unwrap();
                    writeln!(output, " 30\n0.0").unwrap();
                    writeln!(output, " 11\n{}", x2).unwrap();
                    writeln!(output, " 21\n{}", y2).unwrap();
                    writeln!(output, " 31\n0.0").unwrap();
                }
                DxfEntity::Circle { x, y, radius, layer } => {
                    writeln!(output, "  0\nCIRCLE").unwrap();
                    writeln!(output, "  8\n{}", layer).unwrap();
                    writeln!(output, " 10\n{}", x).unwrap();
                    writeln!(output, " 20\n{}", y).unwrap();
                    writeln!(output, " 30\n0.0").unwrap();
                    writeln!(output, " 40\n{}", radius).unwrap();
                }
                DxfEntity::Text { x, y, height, text, layer } => {
                    writeln!(output, "  0\nTEXT").unwrap();
                    writeln!(output, "  8\n{}", layer).unwrap();
                    writeln!(output, " 10\n{}", x).unwrap();
                    writeln!(output, " 20\n{}", y).unwrap();
                    writeln!(output, " 30\n0.0").unwrap();
                    writeln!(output, " 40\n{}", height).unwrap();
                    writeln!(output, "  1\n{}", text).unwrap();
                }
                DxfEntity::Point { x, y, layer } => {
                    writeln!(output, "  0\nPOINT").unwrap();
                    writeln!(output, "  8\n{}", layer).unwrap();
                    writeln!(output, " 10\n{}", x).unwrap();
                    writeln!(output, " 20\n{}", y).unwrap();
                    writeln!(output, " 30\n0.0").unwrap();
                }
                DxfEntity::Polyline { points, closed, layer } => {
                    writeln!(output, "  0\nLWPOLYLINE").unwrap();
                    writeln!(output, "  8\n{}", layer).unwrap();
                    writeln!(output, " 90\n{}", points.len()).unwrap();
                    writeln!(output, " 70\n{}", if *closed { 1 } else { 0 }).unwrap();
                    for (x, y) in points {
                        writeln!(output, " 10\n{}", x).unwrap();
                        writeln!(output, " 20\n{}", y).unwrap();
                    }
                }
                _ => {}
            }
        }
        
        writeln!(output, "  0\nENDSEC").unwrap();
    }
}

// ============================================================================
// HELPERS
// ============================================================================

/// Generate a simple GUID (not cryptographically secure, but sufficient for IFC)
fn generate_guid() -> String {
    use std::time::{SystemTime, UNIX_EPOCH};
    let duration = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default();
    let nanos = duration.as_nanos();
    
    // IFC uses base64-like 22-char GUIDs
    let chars = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz_$";
    let mut guid = String::with_capacity(22);
    let mut val = nanos;
    
    for _ in 0..22 {
        let idx = (val % 64) as usize;
        guid.push(chars.chars().nth(idx).unwrap_or('0'));
        val /= 64;
    }
    
    guid
}

/// Simple timestamp without chrono dependency
fn chrono_lite_timestamp() -> String {
    use std::time::{SystemTime, UNIX_EPOCH};
    let secs = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs();
    
    // Approximate: seconds since 1970 to ISO date
    let days = secs / 86400;
    let years = 1970 + days / 365;
    let day_of_year = days % 365;
    let month = day_of_year / 30 + 1;
    let day = day_of_year % 30 + 1;
    
    format!("{}-{:02}-{:02}T00:00:00", years, month, day)
}

// ============================================================================
// TESTS
// ============================================================================

#[cfg(test)]
mod tests {
    use super::*;
    
    #[test]
    fn test_ifc_exporter_basic() {
        let mut exporter = IfcExporter::new("Test Project")
            .with_metadata("Test description", "Engineer", "Company");
        
        // Add nodes
        exporter.add_node(IfcNode::new(0, 0.0, 0.0, 0.0).with_support([true, true, true, true, true, true]));
        exporter.add_node(IfcNode::new(1, 6.0, 0.0, 0.0));
        exporter.add_node(IfcNode::new(2, 6.0, 4.0, 0.0));
        
        // Add material
        exporter.add_material(IfcMaterialDef::steel_s275());
        
        // Add profile
        exporter.add_profile("IPE300", IfcProfile::IShape {
            depth: 0.300,
            width: 0.150,
            web_thickness: 0.0071,
            flange_thickness: 0.0107,
        });
        
        // Add members
        exporter.add_member(IfcMember::beam(0, 0, 1, "IPE300", "Steel S275"));
        exporter.add_member(IfcMember::column(1, 1, 2, "IPE300", "Steel S275"));
        
        // Export
        let ifc = exporter.export();
        
        // Verify content
        assert!(ifc.contains("ISO-10303-21;"));
        assert!(ifc.contains("IFC4X3"));
        assert!(ifc.contains("IFCPROJECT"));
        assert!(ifc.contains("IFCSTRUCTURALCURVEMEMBER"));
        assert!(ifc.contains("IFCMATERIAL"));
    }
    
    #[test]
    fn test_dxf_exporter_basic() {
        let mut dxf = DxfExporter::new("Test Drawing");
        
        // Add elements
        dxf.add_node(1, 0.0, 0.0, 0.05);
        dxf.add_node(2, 5.0, 0.0, 0.05);
        dxf.add_member(1, 0.0, 0.0, 5.0, 0.0);
        dxf.add_support_fixed(0.0, 0.0, 0.2);
        dxf.add_support_pin(5.0, 0.0, 0.2);
        
        let output = dxf.export();
        
        // Verify content
        assert!(output.contains("SECTION"));
        assert!(output.contains("HEADER"));
        assert!(output.contains("ENTITIES"));
        assert!(output.contains("LINE"));
        assert!(output.contains("CIRCLE"));
        assert!(output.contains("EOF"));
    }
    
    #[test]
    fn test_ifc_profile_area() {
        let rect = IfcProfile::Rectangle { width: 0.2, height: 0.3 };
        assert!((rect.area() - 0.06).abs() < 1e-6);
        
        let circle = IfcProfile::Circle { radius: 0.1 };
        assert!((circle.area() - 0.0314159).abs() < 1e-4);
        
        let i_shape = IfcProfile::IShape {
            depth: 0.3,
            width: 0.15,
            web_thickness: 0.007,
            flange_thickness: 0.01,
        };
        // A = 2*150*10 + (300-20)*7 = 3000 + 1960 = 4960 mm² = 0.00496 m²
        assert!((i_shape.area() - 0.00496).abs() < 1e-5);
    }
    
    #[test]
    fn test_guid_generation() {
        let guid1 = generate_guid();
        let guid2 = generate_guid();
        
        // Should be 22 characters
        assert_eq!(guid1.len(), 22);
        assert_eq!(guid2.len(), 22);
        
        // Not necessarily unique in quick succession, but format should be valid
        assert!(guid1.chars().all(|c| c.is_alphanumeric() || c == '_' || c == '$'));
    }
    
    #[test]
    fn test_ifc_load_case() {
        let mut exporter = IfcExporter::new("Load Test");
        
        exporter.add_load_case(IfcLoadCase {
            id: 1,
            name: "Dead Load".to_string(),
            load_type: "DEAD".to_string(),
            description: "Self weight".to_string(),
        });
        
        exporter.add_load_case(IfcLoadCase {
            id: 2,
            name: "Live Load".to_string(),
            load_type: "LIVE".to_string(),
            description: "Imposed load".to_string(),
        });
        
        exporter.add_nodal_load(IfcNodalLoad {
            load_case_id: 1,
            node_id: 0,
            fx: 0.0,
            fy: -10000.0,
            fz: 0.0,
            mx: 0.0,
            my: 0.0,
            mz: 0.0,
        });
        
        let ifc = exporter.export();
        assert!(ifc.contains("IFCSTRUCTURALLOADGROUP"));
        assert!(ifc.contains("Dead Load"));
    }
    
    #[test]
    fn test_dxf_polyline() {
        let mut dxf = DxfExporter::new("Polyline Test");
        
        let points = vec![
            (0.0, 0.0),
            (1.0, 0.0),
            (1.0, 1.0),
            (0.0, 1.0),
        ];
        dxf.add_polyline(points, true, "Members");
        
        let output = dxf.export();
        assert!(output.contains("LWPOLYLINE"));
        assert!(output.contains(" 90\n4"));  // 4 vertices
        assert!(output.contains(" 70\n1"));  // Closed
    }
}
