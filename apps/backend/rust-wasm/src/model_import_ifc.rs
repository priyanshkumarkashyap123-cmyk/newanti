use std::collections::HashMap;
use std::io::{BufRead, BufReader, Read};

use crate::model_import::{
    ImportFormat, ImportedElement, ImportedElementType, ImportedMaterial, ImportedModel,
    ImportedNode, ImportedSection, MaterialType, SectionType, UnitSystem,
};
use crate::model_import_types::{ImportError, ImportWarning};

/// IFC file parser for structural models
pub struct IfcParser {
    nodes: Vec<ImportedNode>,
    elements: Vec<ImportedElement>,
    materials: Vec<ImportedMaterial>,
    sections: Vec<ImportedSection>,
    warnings: Vec<ImportWarning>,
    errors: Vec<ImportError>,
    entity_map: HashMap<u64, IfcEntity>,
}

#[derive(Debug, Clone)]
enum IfcEntity {
    CartesianPoint { x: f64, y: f64, z: f64 },
    StructuralPointConnection { node_id: usize, point_ref: u64 },
    StructuralCurveMember { element_id: usize, start_ref: u64, end_ref: u64 },
    StructuralSurfaceMember { element_id: usize, node_refs: Vec<u64> },
    Material { name: String },
    ProfileDef { name: String, area: f64, ixx: f64, iyy: f64 },
}

impl IfcParser {
    pub fn new() -> Self {
        Self {
            nodes: Vec::new(),
            elements: Vec::new(),
            materials: Vec::new(),
            sections: Vec::new(),
            warnings: Vec::new(),
            errors: Vec::new(),
            entity_map: HashMap::new(),
        }
    }

    /// Parse IFC file content
    pub fn parse<R: Read>(&mut self, reader: R) -> Result<ImportedModel, String> {
        let buf_reader = BufReader::new(reader);
        
        // First pass: parse all entities
        for line in buf_reader.lines() {
            if let Ok(content) = line {
                self.parse_ifc_line(&content);
            }
        }
        
        // Second pass: resolve references
        self.resolve_references();
        
        Ok(self.build_model())
    }

    fn parse_ifc_line(&mut self, line: &str) {
        let line = line.trim();
        
        // Skip non-entity lines
        if !line.starts_with('#') {
            return;
        }
        
        // Parse entity ID
        let eq_pos = match line.find('=') {
            Some(pos) => pos,
            None => return,
        };
        
        let id_str = &line[1..eq_pos].trim();
        let entity_id: u64 = match id_str.parse() {
            Ok(id) => id,
            Err(_) => return,
        };
        
        let entity_part = &line[eq_pos + 1..].trim();
        
        // Parse entity type
        if entity_part.starts_with("IFCCARTESIANPOINT") {
            self.parse_cartesian_point(entity_id, entity_part);
        } else if entity_part.starts_with("IFCSTRUCTURALPOINTCONNECTION") {
            self.parse_structural_point(entity_id, entity_part);
        } else if entity_part.starts_with("IFCSTRUCTURALCURVEMEMBER") {
            self.parse_curve_member(entity_id, entity_part);
        } else if entity_part.starts_with("IFCSTRUCTURALSURFACEMEMBER") {
            self.parse_surface_member(entity_id, entity_part);
        } else if entity_part.starts_with("IFCMATERIAL") {
            self.parse_material(entity_id, entity_part);
        } else if entity_part.starts_with("IFCISHAPEPROFILEDEF") 
               || entity_part.starts_with("IFCRECTANGLEPROFILEDEF")
               || entity_part.starts_with("IFCCIRCLEPROFILEDEF") {
            self.parse_profile_def(entity_id, entity_part);
        }
    }

    fn parse_cartesian_point(&mut self, id: u64, content: &str) {
        // IFCCARTESIANPOINT((0.,0.,0.));
        if let Some(start) = content.find("((") {
            if let Some(end) = content.find("))") {
                let coords_str = &content[start + 2..end];
                let coords: Vec<f64> = coords_str
                    .split(',')
                    .filter_map(|s| s.trim().trim_end_matches('.').parse().ok())
                    .collect();
                
                if coords.len() >= 3 {
                    self.entity_map.insert(id, IfcEntity::CartesianPoint {
                        x: coords[0],
                        y: coords[1],
                        z: coords[2],
                    });
                }
            }
        }
    }

    fn parse_structural_point(&mut self, id: u64, content: &str) {
        // IFCSTRUCTURALPOINTCONNECTION('guid',#owner,$,'name',$,#placement,#representation);
        if let Some(ref_match) = content.find("#") {
            let ref_str: String = content[ref_match + 1..]
                .chars()
                .take_while(|c| c.is_ascii_digit())
                .collect();
            
            if let Ok(point_ref) = ref_str.parse::<u64>() {
                let node_id = self.nodes.len() + 1;
                self.entity_map.insert(id, IfcEntity::StructuralPointConnection {
                    node_id,
                    point_ref,
                });
            }
        }
    }

    fn parse_curve_member(&mut self, id: u64, content: &str) {
        // IFCSTRUCTURALCURVEMEMBER(...,#start_connection,#end_connection,...);
        let refs: Vec<u64> = content
            .split('#')
            .skip(1)
            .filter_map(|s| {
                let num: String = s.chars().take_while(|c| c.is_ascii_digit()).collect();
                num.parse().ok()
            })
            .collect();
        
        if refs.len() >= 2 {
            let element_id = self.elements.len() + 1;
            self.entity_map.insert(id, IfcEntity::StructuralCurveMember {
                element_id,
                start_ref: refs[0],
                end_ref: refs[1],
            });
        }
    }

    fn parse_surface_member(&mut self, id: u64, content: &str) {
        // IFCSTRUCTURALSURFACEMEMBER(...);
        let refs: Vec<u64> = content
            .split('#')
            .skip(1)
            .filter_map(|s| {
                let num: String = s.chars().take_while(|c| c.is_ascii_digit()).collect();
                num.parse().ok()
            })
            .collect();
        
        if refs.len() >= 3 {
            let element_id = self.elements.len() + 1;
            self.entity_map.insert(id, IfcEntity::StructuralSurfaceMember {
                element_id,
                node_refs: refs,
            });
        }
    }

    fn parse_material(&mut self, id: u64, content: &str) {
        // IFCMATERIAL('Steel');
        if let Some(start) = content.find('\'') {
            if let Some(end) = content[start + 1..].find('\'') {
                let name = content[start + 1..start + 1 + end].to_string();
                self.entity_map.insert(id, IfcEntity::Material { name });
            }
        }
    }

    fn parse_profile_def(&mut self, id: u64, content: &str) {
        // IFCISHAPEPROFILEDEF(.AREA.,$,'IPE300',#position,0.15,0.30,0.0071,0.0107,$,$);
        let values: Vec<&str> = content.split(',').collect();
        
        let mut name = "Profile".to_string();
        let mut area = 0.01;
        let mut ixx = 1e-4;
        let mut iyy = 1e-5;
        
        for (i, val) in values.iter().enumerate() {
            if val.contains('\'') {
                let stripped = val.trim().trim_matches('\'');
                if !stripped.is_empty() && stripped != "$" {
                    name = stripped.to_string();
                }
            } else if i >= 4 {
                if let Ok(num) = val.trim().parse::<f64>() {
                    match i {
                        4 => { /* width */ }
                        5 => { /* depth */ }
                        6 => area = num,
                        7 => ixx = num,
                        8 => iyy = num,
                        _ => {}
                    }
                }
            }
        }
        
        self.entity_map.insert(id, IfcEntity::ProfileDef { name, area, ixx, iyy });
    }

    fn resolve_references(&mut self) {
        // Build node map from cartesian points
        let mut point_to_node: HashMap<u64, usize> = HashMap::new();
        let mut node_id = 1;
        
        for (id, entity) in &self.entity_map {
            if let IfcEntity::CartesianPoint { x, y, z } = entity {
                self.nodes.push(ImportedNode {
                    id: node_id,
                    original_id: format!("#{}", id),
                    x: *x,
                    y: *y,
                    z: *z,
                });
                point_to_node.insert(*id, node_id);
                node_id += 1;
            }
        }
        
        // Resolve structural point connections
        let entities: Vec<(u64, IfcEntity)> = self.entity_map.iter()
            .map(|(k, v)| (*k, v.clone()))
            .collect();
            
        for (id, entity) in entities {
            if let IfcEntity::StructuralPointConnection { point_ref, .. } = entity {
                if let Some(&node_id) = point_to_node.get(&point_ref) {
                    point_to_node.insert(id, node_id);
                }
            }
        }
        
        // Build elements from curve members
        let entities: Vec<(u64, IfcEntity)> = self.entity_map.iter()
            .map(|(k, v)| (*k, v.clone()))
            .collect();
            
        for (_id, entity) in entities {
            if let IfcEntity::StructuralCurveMember { element_id, start_ref, end_ref } = entity {
                let start_node = point_to_node.get(&start_ref).copied().unwrap_or(1);
                let end_node = point_to_node.get(&end_ref).copied().unwrap_or(2);
                
                self.elements.push(ImportedElement {
                    id: element_id,
                    original_id: format!("M{}", element_id),
                    element_type: ImportedElementType::Beam,
                    node_ids: vec![start_node, end_node],
                    material_id: Some(1),
                    section_id: Some(1),
                    releases: None,
                    orientation_angle: 0.0,
                });
            }
        }
        
        // Build materials
        let entities: Vec<(u64, IfcEntity)> = self.entity_map.iter()
            .map(|(k, v)| (*k, v.clone()))
            .collect();
            
        for (_id, entity) in entities {
            if let IfcEntity::Material { name } = entity {
                let (e, fy, fck) = if name.to_uppercase().contains("STEEL") {
                    (210e9, Some(355e6), None)
                } else if name.to_uppercase().contains("CONCRETE") {
                    (30e9, None, Some(30e6))
                } else {
                    (200e9, Some(250e6), None)
                };
                
                self.materials.push(ImportedMaterial {
                    id: self.materials.len() + 1,
                    name,
                    material_type: MaterialType::Steel,
                    e,
                    nu: 0.3,
                    density: 7850.0,
                    fy,
                    fu: fy.map(|f| f * 1.2),
                    fck,
                    alpha: 12e-6,
                });
            }
        }
        
        // Default material if none found
        if self.materials.is_empty() {
            self.materials.push(ImportedMaterial {
                id: 1,
                name: "Steel".to_string(),
                material_type: MaterialType::Steel,
                e: 210e9,
                nu: 0.3,
                density: 7850.0,
                fy: Some(355e6),
                fu: Some(470e6),
                fck: None,
                alpha: 12e-6,
            });
        }
        
        // Build sections
        let entities: Vec<(u64, IfcEntity)> = self.entity_map.iter()
            .map(|(k, v)| (*k, v.clone()))
            .collect();
            
        for (_id, entity) in entities {
            if let IfcEntity::ProfileDef { name, area, ixx, iyy } = entity {
                self.sections.push(ImportedSection {
                    id: self.sections.len() + 1,
                    name,
                    section_type: SectionType::ISection,
                    area,
                    ixx,
                    iyy,
                    izz: iyy,
                    j: ixx + iyy,
                    depth: None,
                    width: None,
                    tw: None,
                    tf: None,
                });
            }
        }
        
        // Default section if none found
        if self.sections.is_empty() {
            self.sections.push(ImportedSection {
                id: 1,
                name: "Default".to_string(),
                section_type: SectionType::ISection,
                area: 0.01,
                ixx: 1e-4,
                iyy: 1e-5,
                izz: 1e-5,
                j: 1.1e-4,
                depth: Some(0.3),
                width: Some(0.15),
                tw: Some(0.007),
                tf: Some(0.011),
            });
        }
    }

    fn build_model(&self) -> ImportedModel {
        ImportedModel {
            name: "IFC Import".to_string(),
            source_format: ImportFormat::Ifc2x3,
            units: UnitSystem::default(),
            nodes: self.nodes.clone(),
            elements: self.elements.clone(),
            materials: self.materials.clone(),
            sections: self.sections.clone(),
            supports: Vec::new(),
            load_cases: Vec::new(),
            load_combinations: Vec::new(),
            warnings: self.warnings.clone(),
            errors: self.errors.clone(),
        }
    }
}

// ============================================================================
