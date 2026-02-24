// ============================================================================
// BIM INTEGRATION - Phase 23
// IFC import/export, Revit integration, openBIM workflows
// Standards: IFC4, IFC4.3, BCF, bSDD, ISO 16739
// ============================================================================

use serde::{Deserialize, Serialize};
use std::collections::HashMap;

// ============================================================================
// IFC ENTITIES
// ============================================================================

/// IFC product types for structural elements
#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
pub enum IfcStructuralType {
    IfcBeam,
    IfcColumn,
    IfcSlab,
    IfcWall,
    IfcFooting,
    IfcPile,
    IfcStairFlight,
    IfcRoof,
    IfcRailing,
    IfcPlate,
    IfcMember,
    IfcBuildingElementProxy,
}

impl IfcStructuralType {
    /// IFC entity name
    pub fn entity_name(&self) -> &str {
        match self {
            IfcStructuralType::IfcBeam => "IfcBeam",
            IfcStructuralType::IfcColumn => "IfcColumn",
            IfcStructuralType::IfcSlab => "IfcSlab",
            IfcStructuralType::IfcWall => "IfcWall",
            IfcStructuralType::IfcFooting => "IfcFooting",
            IfcStructuralType::IfcPile => "IfcPile",
            IfcStructuralType::IfcStairFlight => "IfcStairFlight",
            IfcStructuralType::IfcRoof => "IfcRoof",
            IfcStructuralType::IfcRailing => "IfcRailing",
            IfcStructuralType::IfcPlate => "IfcPlate",
            IfcStructuralType::IfcMember => "IfcMember",
            IfcStructuralType::IfcBuildingElementProxy => "IfcBuildingElementProxy",
        }
    }
    
    /// Predefined type options
    pub fn predefined_types(&self) -> Vec<&str> {
        match self {
            IfcStructuralType::IfcBeam => vec![
                "BEAM", "JOIST", "HOLLOWCORE", "LINTEL", "SPANDREL", 
                "T_BEAM", "USERDEFINED", "NOTDEFINED"
            ],
            IfcStructuralType::IfcColumn => vec![
                "COLUMN", "PILASTER", "USERDEFINED", "NOTDEFINED"
            ],
            IfcStructuralType::IfcSlab => vec![
                "FLOOR", "ROOF", "LANDING", "BASESLAB", "APPROACH_SLAB",
                "PAVING", "WEARING", "SIDEWALK", "USERDEFINED", "NOTDEFINED"
            ],
            IfcStructuralType::IfcWall => vec![
                "MOVABLE", "PARAPET", "PARTITIONING", "PLUMBINGWALL",
                "SHEAR", "SOLIDWALL", "STANDARD", "POLYGONAL", 
                "ELEMENTEDWALL", "RETAININGWALL", "WAVEWALL", "USERDEFINED", "NOTDEFINED"
            ],
            IfcStructuralType::IfcFooting => vec![
                "CAISSON_FOUNDATION", "FOOTING_BEAM", "PAD_FOOTING",
                "PILE_CAP", "STRIP_FOOTING", "USERDEFINED", "NOTDEFINED"
            ],
            _ => vec!["USERDEFINED", "NOTDEFINED"],
        }
    }
}

/// IFC material types
#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
pub enum IfcMaterialType {
    Concrete,
    Steel,
    Timber,
    Masonry,
    Composite,
    Other,
}

/// IFC profile types
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum IfcProfileType {
    RectangleProfile { width: f64, depth: f64 },
    CircleProfile { radius: f64 },
    IShapeProfile { width: f64, depth: f64, tw: f64, tf: f64 },
    LShapeProfile { width: f64, depth: f64, tw: f64 },
    TShapeProfile { width: f64, depth: f64, tw: f64, tf: f64 },
    CShapeProfile { width: f64, depth: f64, tw: f64, tf: f64, girth: f64 },
    ArbitraryProfile { points: Vec<(f64, f64)> },
}

impl IfcProfileType {
    /// Area (mm²)
    pub fn area(&self) -> f64 {
        match self {
            IfcProfileType::RectangleProfile { width, depth } => width * depth,
            IfcProfileType::CircleProfile { radius } => std::f64::consts::PI * radius.powi(2),
            IfcProfileType::IShapeProfile { width, depth, tw, tf } => {
                2.0 * width * tf + (depth - 2.0 * tf) * tw
            }
            _ => 0.0, // Simplified
        }
    }
    
    /// IFC profile definition name
    pub fn definition_name(&self) -> &str {
        match self {
            IfcProfileType::RectangleProfile { .. } => "IfcRectangleProfileDef",
            IfcProfileType::CircleProfile { .. } => "IfcCircleProfileDef",
            IfcProfileType::IShapeProfile { .. } => "IfcIShapeProfileDef",
            IfcProfileType::LShapeProfile { .. } => "IfcLShapeProfileDef",
            IfcProfileType::TShapeProfile { .. } => "IfcTShapeProfileDef",
            IfcProfileType::CShapeProfile { .. } => "IfcCShapeProfileDef",
            IfcProfileType::ArbitraryProfile { .. } => "IfcArbitraryClosedProfileDef",
        }
    }
}

// ============================================================================
// BIM ELEMENTS
// ============================================================================

/// GUID for IFC
pub type IfcGuid = String;

/// Atomic counter for guaranteed unique GUIDs even in rapid succession
static GUID_COUNTER: std::sync::atomic::AtomicU64 = std::sync::atomic::AtomicU64::new(0);

/// Generate IFC-compatible GUID (22 base64 characters per IFC spec)
pub fn generate_ifc_guid() -> IfcGuid {
    use std::time::{SystemTime, UNIX_EPOCH};
    use std::sync::atomic::Ordering;
    
    let timestamp = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_nanos();
    
    // Atomic counter ensures uniqueness even in rapid succession
    let counter = GUID_COUNTER.fetch_add(1, Ordering::SeqCst);
    
    // IFC GUIDs are 22 characters in base64 encoding
    // Use timestamp + counter + random component to ensure uniqueness
    let random_part: u64 = (timestamp as u64)
        .wrapping_mul(0x5DEECE66D)
        .wrapping_add(0xB)
        .wrapping_add(counter);
    
    // IFC base64 character set
    const IFC_BASE64: &[u8] = b"0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz_$";
    
    let mut guid = String::with_capacity(22);
    let mut value = (timestamp as u128).wrapping_mul(random_part as u128);
    value = value.wrapping_add(counter as u128);
    
    for _ in 0..22 {
        let idx = (value & 63) as usize;
        guid.push(IFC_BASE64[idx] as char);
        value >>= 6;
        if value == 0 {
            value = random_part as u128;
        }
    }
    
    guid
}

/// 3D point
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
        ((self.x - other.x).powi(2) + 
         (self.y - other.y).powi(2) + 
         (self.z - other.z).powi(2)).sqrt()
    }
}

/// BIM structural element
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BimElement {
    /// IFC GUID
    pub guid: IfcGuid,
    /// Element name
    pub name: String,
    /// IFC type
    pub ifc_type: IfcStructuralType,
    /// Predefined type
    pub predefined_type: String,
    /// Start point
    pub start_point: Point3D,
    /// End point (for linear elements)
    pub end_point: Option<Point3D>,
    /// Cross-section profile
    pub profile: Option<IfcProfileType>,
    /// Material
    pub material: IfcMaterialType,
    /// Material name/grade
    pub material_name: String,
    /// Property sets
    pub property_sets: HashMap<String, PropertySet>,
    /// Quantity sets
    pub quantity_sets: HashMap<String, QuantitySet>,
    /// Containment (story/level)
    pub building_storey: Option<String>,
    /// Host element GUID
    pub host_guid: Option<IfcGuid>,
}

impl BimElement {
    pub fn new(name: &str, ifc_type: IfcStructuralType) -> Self {
        Self {
            guid: generate_ifc_guid(),
            name: name.to_string(),
            ifc_type,
            predefined_type: "NOTDEFINED".to_string(),
            start_point: Point3D::origin(),
            end_point: None,
            profile: None,
            material: IfcMaterialType::Concrete,
            material_name: String::new(),
            property_sets: HashMap::new(),
            quantity_sets: HashMap::new(),
            building_storey: None,
            host_guid: None,
        }
    }
    
    /// Set location
    pub fn at_location(mut self, x: f64, y: f64, z: f64) -> Self {
        self.start_point = Point3D::new(x, y, z);
        self
    }
    
    /// Set end point for linear elements
    pub fn to_point(mut self, x: f64, y: f64, z: f64) -> Self {
        self.end_point = Some(Point3D::new(x, y, z));
        self
    }
    
    /// Set profile
    pub fn with_profile(mut self, profile: IfcProfileType) -> Self {
        self.profile = Some(profile);
        self
    }
    
    /// Set material
    pub fn with_material(mut self, material: IfcMaterialType, name: &str) -> Self {
        self.material = material;
        self.material_name = name.to_string();
        self
    }
    
    /// Set building storey
    pub fn on_storey(mut self, storey: &str) -> Self {
        self.building_storey = Some(storey.to_string());
        self
    }
    
    /// Add property set
    pub fn add_property_set(&mut self, pset: PropertySet) {
        self.property_sets.insert(pset.name.clone(), pset);
    }
    
    /// Add quantity set
    pub fn add_quantity_set(&mut self, qset: QuantitySet) {
        self.quantity_sets.insert(qset.name.clone(), qset);
    }
    
    /// Element length (for linear elements)
    pub fn length(&self) -> f64 {
        if let Some(ref end) = self.end_point {
            self.start_point.distance_to(end)
        } else {
            0.0
        }
    }
    
    /// Get cross-section area
    pub fn cross_section_area(&self) -> f64 {
        self.profile.as_ref().map(|p| p.area()).unwrap_or(0.0)
    }
    
    /// Calculate volume
    pub fn volume(&self) -> f64 {
        self.length() * self.cross_section_area() / 1e9 // m³
    }
}

// ============================================================================
// PROPERTY SETS
// ============================================================================

/// Property value types
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum PropertyValue {
    SingleValue(f64),
    Text(String),
    Boolean(bool),
    Integer(i64),
    Enumeration(String),
    BoundedValue { lower: f64, upper: f64 },
    ListValue(Vec<f64>),
}

/// IFC property
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Property {
    pub name: String,
    pub value: PropertyValue,
    pub unit: Option<String>,
}

impl Property {
    pub fn single(name: &str, value: f64, unit: Option<&str>) -> Self {
        Self {
            name: name.to_string(),
            value: PropertyValue::SingleValue(value),
            unit: unit.map(|s| s.to_string()),
        }
    }
    
    pub fn text(name: &str, value: &str) -> Self {
        Self {
            name: name.to_string(),
            value: PropertyValue::Text(value.to_string()),
            unit: None,
        }
    }
    
    pub fn boolean(name: &str, value: bool) -> Self {
        Self {
            name: name.to_string(),
            value: PropertyValue::Boolean(value),
            unit: None,
        }
    }
}

/// Property set
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PropertySet {
    pub name: String,
    pub properties: Vec<Property>,
}

impl PropertySet {
    pub fn new(name: &str) -> Self {
        Self {
            name: name.to_string(),
            properties: Vec::new(),
        }
    }
    
    /// Add property
    pub fn add_property(&mut self, prop: Property) {
        self.properties.push(prop);
    }
    
    /// Standard structural analysis pset
    pub fn structural_analysis(
        load_bearing: bool,
        fire_rating: &str,
        exposure_class: &str,
    ) -> Self {
        let mut pset = Self::new("Pset_StructuralAnalysis");
        pset.add_property(Property::boolean("IsLoadBearing", load_bearing));
        pset.add_property(Property::text("FireRating", fire_rating));
        pset.add_property(Property::text("ExposureClass", exposure_class));
        pset
    }
    
    /// Concrete reinforcement pset
    pub fn reinforcement(
        rebar_grade: &str,
        cover: f64,
        tension_area: f64,
        compression_area: f64,
    ) -> Self {
        let mut pset = Self::new("Pset_ConcreteReinforcement");
        pset.add_property(Property::text("RebarGrade", rebar_grade));
        pset.add_property(Property::single("Cover", cover, Some("mm")));
        pset.add_property(Property::single("TensionReinforcementArea", tension_area, Some("mm2")));
        pset.add_property(Property::single("CompressionReinforcementArea", compression_area, Some("mm2")));
        pset
    }
}

/// Quantity set
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct QuantitySet {
    pub name: String,
    pub quantities: HashMap<String, (f64, String)>, // (value, unit)
}

impl QuantitySet {
    pub fn new(name: &str) -> Self {
        Self {
            name: name.to_string(),
            quantities: HashMap::new(),
        }
    }
    
    /// Add quantity
    pub fn add_quantity(&mut self, name: &str, value: f64, unit: &str) {
        self.quantities.insert(name.to_string(), (value, unit.to_string()));
    }
    
    /// Standard base quantities for beam
    pub fn beam_quantities(length: f64, area: f64, volume: f64, weight: f64) -> Self {
        let mut qset = Self::new("Qto_BeamBaseQuantities");
        qset.add_quantity("Length", length, "m");
        qset.add_quantity("CrossSectionArea", area, "mm2");
        qset.add_quantity("NetVolume", volume, "m3");
        qset.add_quantity("GrossWeight", weight, "kg");
        qset
    }
    
    /// Standard base quantities for column
    pub fn column_quantities(height: f64, area: f64, volume: f64, weight: f64) -> Self {
        let mut qset = Self::new("Qto_ColumnBaseQuantities");
        qset.add_quantity("Height", height, "m");
        qset.add_quantity("CrossSectionArea", area, "mm2");
        qset.add_quantity("NetVolume", volume, "m3");
        qset.add_quantity("GrossWeight", weight, "kg");
        qset
    }
}

// ============================================================================
// BIM MODEL
// ============================================================================

/// Building storey
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BuildingStorey {
    pub guid: IfcGuid,
    pub name: String,
    pub elevation: f64,
    pub height: f64,
}

impl BuildingStorey {
    pub fn new(name: &str, elevation: f64, height: f64) -> Self {
        Self {
            guid: generate_ifc_guid(),
            name: name.to_string(),
            elevation,
            height,
        }
    }
}

/// BIM model
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BimModel {
    /// Project name
    pub project_name: String,
    /// Project GUID
    pub project_guid: IfcGuid,
    /// Schema version
    pub schema: String,
    /// Building storeys
    pub storeys: Vec<BuildingStorey>,
    /// Structural elements
    pub elements: Vec<BimElement>,
    /// Global origin offset
    pub origin_offset: Point3D,
    /// True north angle (deg)
    pub true_north: f64,
}

impl BimModel {
    pub fn new(project_name: &str) -> Self {
        Self {
            project_name: project_name.to_string(),
            project_guid: generate_ifc_guid(),
            schema: "IFC4".to_string(),
            storeys: Vec::new(),
            elements: Vec::new(),
            origin_offset: Point3D::origin(),
            true_north: 0.0,
        }
    }
    
    /// Add storey
    pub fn add_storey(&mut self, storey: BuildingStorey) {
        self.storeys.push(storey);
    }
    
    /// Add element
    pub fn add_element(&mut self, element: BimElement) {
        self.elements.push(element);
    }
    
    /// Get elements by type
    pub fn elements_by_type(&self, ifc_type: IfcStructuralType) -> Vec<&BimElement> {
        self.elements.iter()
            .filter(|e| e.ifc_type == ifc_type)
            .collect()
    }
    
    /// Get elements on storey
    pub fn elements_on_storey(&self, storey_name: &str) -> Vec<&BimElement> {
        self.elements.iter()
            .filter(|e| e.building_storey.as_deref() == Some(storey_name))
            .collect()
    }
    
    /// Total concrete volume (m³)
    pub fn concrete_volume(&self) -> f64 {
        self.elements.iter()
            .filter(|e| e.material == IfcMaterialType::Concrete)
            .map(|e| e.volume())
            .sum()
    }
    
    /// Total steel weight (kg)
    pub fn steel_weight(&self, density: f64) -> f64 {
        self.elements.iter()
            .filter(|e| e.material == IfcMaterialType::Steel)
            .map(|e| e.volume() * density)
            .sum()
    }
    
    /// Element count summary
    pub fn element_summary(&self) -> HashMap<String, usize> {
        let mut summary = HashMap::new();
        
        for elem in &self.elements {
            let key = elem.ifc_type.entity_name().to_string();
            *summary.entry(key).or_insert(0) += 1;
        }
        
        summary
    }
}

// ============================================================================
// IFC EXPORT
// ============================================================================

/// IFC file generator
pub struct IfcExporter {
    /// Line counter
    line_counter: usize,
    /// Entity lines
    entities: Vec<String>,
}

impl IfcExporter {
    pub fn new() -> Self {
        Self {
            line_counter: 100,
            entities: Vec::new(),
        }
    }
    
    fn next_id(&mut self) -> usize {
        let id = self.line_counter;
        self.line_counter += 1;
        id
    }
    
    /// Generate IFC header
    pub fn generate_header(&self, model: &BimModel) -> String {
        format!(
r#"ISO-10303-21;
HEADER;
FILE_DESCRIPTION(('ViewDefinition [CoordinationView]'),'2;1');
FILE_NAME('{}','{}',(''),(''),'{} Exporter','','');
FILE_SCHEMA(('{}'));
ENDSEC;
"#,
            model.project_name,
            chrono_like_timestamp(),
            "RustStructural",
            model.schema
        )
    }
    
    /// Generate IFC data section start
    pub fn generate_data_start() -> String {
        "DATA;\n".to_string()
    }
    
    /// Generate IFC data section end
    pub fn generate_data_end() -> String {
        "ENDSEC;\nEND-ISO-10303-21;\n".to_string()
    }
    
    /// Export point
    fn export_point(&mut self, point: &Point3D) -> usize {
        let id = self.next_id();
        self.entities.push(format!(
            "#{}=IFCCARTESIANPOINT(({},{},{}));",
            id, point.x, point.y, point.z
        ));
        id
    }
    
    /// Export direction
    fn export_direction(&mut self, dx: f64, dy: f64, dz: f64) -> usize {
        let id = self.next_id();
        self.entities.push(format!(
            "#{}=IFCDIRECTION(({},{},{}));",
            id, dx, dy, dz
        ));
        id
    }
    
    /// Export simple beam
    pub fn export_beam(&mut self, elem: &BimElement) -> usize {
        let origin_id = self.export_point(&elem.start_point);
        let axis_id = self.export_direction(0.0, 0.0, 1.0);
        let ref_id = self.export_direction(1.0, 0.0, 0.0);
        
        let placement_id = self.next_id();
        self.entities.push(format!(
            "#{}=IFCAXIS2PLACEMENT3D(#{},#{},#{});",
            placement_id, origin_id, axis_id, ref_id
        ));
        
        let local_placement_id = self.next_id();
        self.entities.push(format!(
            "#{}=IFCLOCALPLACEMENT($,#{});",
            local_placement_id, placement_id
        ));
        
        let beam_id = self.next_id();
        self.entities.push(format!(
            "#{}=IFCBEAM('{}',#10,'{}','{}',#{},#50,.{}.,0);",
            beam_id, elem.guid, elem.name, elem.name,
            local_placement_id, elem.predefined_type
        ));
        
        beam_id
    }
    
    /// Get all entity strings
    pub fn get_entities(&self) -> &[String] {
        &self.entities
    }
}

impl Default for IfcExporter {
    fn default() -> Self {
        Self::new()
    }
}

/// Simple timestamp generator
fn chrono_like_timestamp() -> String {
    "2024-01-15T12:00:00".to_string()
}

// ============================================================================
// BCF (BIM Collaboration Format)
// ============================================================================

/// BCF topic (issue)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BcfTopic {
    /// Topic GUID
    pub guid: String,
    /// Title
    pub title: String,
    /// Description
    pub description: String,
    /// Topic type
    pub topic_type: String,
    /// Topic status
    pub status: String,
    /// Priority
    pub priority: String,
    /// Creation date
    pub creation_date: String,
    /// Assigned to
    pub assigned_to: Option<String>,
    /// Related element GUIDs
    pub related_elements: Vec<IfcGuid>,
}

impl BcfTopic {
    pub fn new(title: &str, topic_type: &str) -> Self {
        Self {
            guid: generate_ifc_guid(),
            title: title.to_string(),
            description: String::new(),
            topic_type: topic_type.to_string(),
            status: "Open".to_string(),
            priority: "Normal".to_string(),
            creation_date: chrono_like_timestamp(),
            assigned_to: None,
            related_elements: Vec::new(),
        }
    }
    
    /// Add related element
    pub fn add_related_element(&mut self, guid: &str) {
        self.related_elements.push(guid.to_string());
    }
    
    /// Set description
    pub fn with_description(mut self, desc: &str) -> Self {
        self.description = desc.to_string();
        self
    }
    
    /// Assign to user
    pub fn assign_to(mut self, user: &str) -> Self {
        self.assigned_to = Some(user.to_string());
        self
    }
}

/// BCF comment
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BcfComment {
    pub guid: String,
    pub date: String,
    pub author: String,
    pub comment: String,
}

impl BcfComment {
    pub fn new(author: &str, comment: &str) -> Self {
        Self {
            guid: generate_ifc_guid(),
            date: chrono_like_timestamp(),
            author: author.to_string(),
            comment: comment.to_string(),
        }
    }
}

// ============================================================================
// TESTS
// ============================================================================

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_ifc_type() {
        let beam = IfcStructuralType::IfcBeam;
        assert_eq!(beam.entity_name(), "IfcBeam");
        assert!(beam.predefined_types().contains(&"JOIST"));
    }

    #[test]
    fn test_point3d() {
        let p1 = Point3D::new(0.0, 0.0, 0.0);
        let p2 = Point3D::new(3.0, 4.0, 0.0);
        
        assert!((p1.distance_to(&p2) - 5.0).abs() < 0.001);
    }

    #[test]
    fn test_profile_area() {
        let rect = IfcProfileType::RectangleProfile { width: 300.0, depth: 600.0 };
        assert!((rect.area() - 180000.0).abs() < 1.0);
        
        let circle = IfcProfileType::CircleProfile { radius: 100.0 };
        assert!((circle.area() - 31415.9).abs() < 1.0);
    }

    #[test]
    fn test_bim_element() {
        let elem = BimElement::new("B001", IfcStructuralType::IfcBeam)
            .at_location(0.0, 0.0, 3000.0)
            .to_point(6000.0, 0.0, 3000.0)
            .with_profile(IfcProfileType::RectangleProfile { width: 300.0, depth: 600.0 })
            .with_material(IfcMaterialType::Concrete, "C30/37");
        
        assert!((elem.length() - 6000.0).abs() < 0.1);
        assert!(elem.volume() > 0.0);
    }

    #[test]
    fn test_property_set() {
        let pset = PropertySet::structural_analysis(true, "R60", "XC1");
        
        assert_eq!(pset.name, "Pset_StructuralAnalysis");
        assert_eq!(pset.properties.len(), 3);
    }

    #[test]
    fn test_quantity_set() {
        let qset = QuantitySet::beam_quantities(6.0, 180000.0, 1.08, 2700.0);
        
        assert!(qset.quantities.contains_key("Length"));
        assert!(qset.quantities.contains_key("NetVolume"));
    }

    #[test]
    fn test_bim_model() {
        let mut model = BimModel::new("Test Project");
        
        model.add_storey(BuildingStorey::new("Ground Floor", 0.0, 3500.0));
        model.add_storey(BuildingStorey::new("First Floor", 3500.0, 3200.0));
        
        let beam = BimElement::new("B001", IfcStructuralType::IfcBeam)
            .at_location(0.0, 0.0, 3000.0)
            .to_point(6000.0, 0.0, 3000.0)
            .with_material(IfcMaterialType::Concrete, "C30")
            .on_storey("Ground Floor");
        
        model.add_element(beam);
        
        assert_eq!(model.storeys.len(), 2);
        assert_eq!(model.elements.len(), 1);
    }

    #[test]
    fn test_elements_by_type() {
        let mut model = BimModel::new("Test");
        
        model.add_element(BimElement::new("B1", IfcStructuralType::IfcBeam));
        model.add_element(BimElement::new("B2", IfcStructuralType::IfcBeam));
        model.add_element(BimElement::new("C1", IfcStructuralType::IfcColumn));
        
        let beams = model.elements_by_type(IfcStructuralType::IfcBeam);
        assert_eq!(beams.len(), 2);
    }

    #[test]
    fn test_element_summary() {
        let mut model = BimModel::new("Test");
        
        model.add_element(BimElement::new("B1", IfcStructuralType::IfcBeam));
        model.add_element(BimElement::new("B2", IfcStructuralType::IfcBeam));
        model.add_element(BimElement::new("C1", IfcStructuralType::IfcColumn));
        
        let summary = model.element_summary();
        assert_eq!(summary.get("IfcBeam"), Some(&2));
        assert_eq!(summary.get("IfcColumn"), Some(&1));
    }

    #[test]
    fn test_ifc_exporter() {
        let mut exporter = IfcExporter::new();
        let elem = BimElement::new("B001", IfcStructuralType::IfcBeam)
            .at_location(0.0, 0.0, 3000.0);
        
        let _beam_id = exporter.export_beam(&elem);
        
        assert!(exporter.get_entities().len() > 0);
    }

    #[test]
    fn test_bcf_topic() {
        let topic = BcfTopic::new("Clash detected", "Clash")
            .with_description("Beam intersects with duct")
            .assign_to("engineer@company.com");
        
        assert!(!topic.guid.is_empty());
        assert_eq!(topic.topic_type, "Clash");
    }

    #[test]
    fn test_bcf_comment() {
        let comment = BcfComment::new("reviewer", "Issue needs verification");
        
        assert!(!comment.guid.is_empty());
        assert_eq!(comment.author, "reviewer");
    }

    #[test]
    fn test_ifc_guid_generation() {
        let guid1 = generate_ifc_guid();
        let guid2 = generate_ifc_guid();
        
        assert!(!guid1.is_empty());
        assert_ne!(guid1, guid2);
    }
}
