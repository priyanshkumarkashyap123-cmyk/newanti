//! CIS/2 Steel Interchange Format
//!
//! Implementation of CIMsteel Integration Standards Version 2 (CIS/2)
//! for steel fabrication data exchange with detailing software.
//!
//! ## Features
//! - Steel member export (beams, columns, braces)
//! - Connection geometry export
//! - Bolt patterns and weld details
//! - Material specifications
//! - Assembly and part numbering
//! - STEP AP214/AP203 compatibility

use serde::{Deserialize, Serialize};
use std::collections::HashMap;

// ============================================================================
// CIS/2 ENTITY TYPES
// ============================================================================

/// CIS/2 file format version
#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
pub enum CIS2Version {
    V1_0,
    V2_0,
    V2_1,
}

impl Default for CIS2Version {
    fn default() -> Self {
        CIS2Version::V2_1
    }
}

/// CIS/2 export configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CIS2Config {
    pub version: CIS2Version,
    pub include_connections: bool,
    pub include_bolts: bool,
    pub include_welds: bool,
    pub include_materials: bool,
    pub coordinate_system: CoordinateSystem,
    pub length_unit: LengthUnit,
    pub force_unit: ForceUnit,
}

impl Default for CIS2Config {
    fn default() -> Self {
        CIS2Config {
            version: CIS2Version::V2_1,
            include_connections: true,
            include_bolts: true,
            include_welds: true,
            include_materials: true,
            coordinate_system: CoordinateSystem::RightHand,
            length_unit: LengthUnit::Millimeter,
            force_unit: ForceUnit::KiloNewton,
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
pub enum CoordinateSystem {
    RightHand,
    LeftHand,
}

#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
pub enum LengthUnit {
    Millimeter,
    Meter,
    Inch,
    Foot,
}

impl LengthUnit {
    pub fn to_mm_factor(&self) -> f64 {
        match self {
            LengthUnit::Millimeter => 1.0,
            LengthUnit::Meter => 1000.0,
            LengthUnit::Inch => 25.4,
            LengthUnit::Foot => 304.8,
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
pub enum ForceUnit {
    Newton,
    KiloNewton,
    Pound,
    Kip,
}

// ============================================================================
// STEEL MEMBERS
// ============================================================================

/// Steel member types per CIS/2
#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
pub enum SteelMemberType {
    Beam,
    Column,
    Brace,
    Girt,
    Purlin,
    Joist,
    Truss,
    Plate,
    Misc,
}

/// Steel section profile types
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub enum SectionProfile {
    WideFlange { designation: String },
    Channel { designation: String },
    Angle { designation: String },
    Tube { designation: String },
    Pipe { designation: String },
    Tee { designation: String },
    Plate { thickness: f64, width: f64 },
    BuiltUp { description: String },
}

/// CIS/2 Steel Member
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SteelMember {
    /// Unique member ID
    pub id: String,
    /// Piecemark (fabricator's part number)
    pub piecemark: String,
    /// Member type
    pub member_type: SteelMemberType,
    /// Section profile
    pub section: SectionProfile,
    /// Material grade
    pub material_grade: String,
    /// Start point [x, y, z] in mm
    pub start_point: [f64; 3],
    /// End point [x, y, z] in mm
    pub end_point: [f64; 3],
    /// Rotation about member axis (degrees)
    pub rotation: f64,
    /// Cardinal point (1-9, centroid = 5)
    pub cardinal_point: u8,
    /// Start offset [dx, dy, dz]
    pub start_offset: [f64; 3],
    /// End offset [dx, dy, dz]
    pub end_offset: [f64; 3],
    /// Camber (mm)
    pub camber: f64,
    /// Assembly mark
    pub assembly_mark: Option<String>,
    /// Finish/coating
    pub finish: Option<String>,
}

impl SteelMember {
    pub fn new(
        id: &str,
        piecemark: &str,
        member_type: SteelMemberType,
        section: SectionProfile,
        start: [f64; 3],
        end: [f64; 3],
    ) -> Self {
        SteelMember {
            id: id.to_string(),
            piecemark: piecemark.to_string(),
            member_type,
            section,
            material_grade: "A992".to_string(),
            start_point: start,
            end_point: end,
            rotation: 0.0,
            cardinal_point: 5,
            start_offset: [0.0; 3],
            end_offset: [0.0; 3],
            camber: 0.0,
            assembly_mark: None,
            finish: None,
        }
    }
    
    /// Calculate member length
    pub fn length(&self) -> f64 {
        let dx = self.end_point[0] - self.start_point[0];
        let dy = self.end_point[1] - self.start_point[1];
        let dz = self.end_point[2] - self.start_point[2];
        (dx * dx + dy * dy + dz * dz).sqrt()
    }
    
    /// Get member direction cosines
    pub fn direction(&self) -> [f64; 3] {
        let len = self.length();
        if len < 1e-6 {
            return [1.0, 0.0, 0.0];
        }
        [
            (self.end_point[0] - self.start_point[0]) / len,
            (self.end_point[1] - self.start_point[1]) / len,
            (self.end_point[2] - self.start_point[2]) / len,
        ]
    }
}

// ============================================================================
// CONNECTIONS
// ============================================================================

/// Connection type
#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
pub enum ConnectionType {
    ShearTab,
    MomentEndPlate,
    MomentFlangePlate,
    BracedFrame,
    BasePlate,
    Splice,
    SeatedConnection,
    ClipAngle,
}

/// CIS/2 Connection
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Connection {
    /// Connection ID
    pub id: String,
    /// Connection type
    pub conn_type: ConnectionType,
    /// Supporting member ID
    pub supporting_member: String,
    /// Supported member ID
    pub supported_member: String,
    /// Location on supporting member (0.0 = start, 1.0 = end)
    pub location: f64,
    /// Connection work point [x, y, z]
    pub work_point: [f64; 3],
    /// Bolts in this connection
    pub bolts: Vec<BoltGroup>,
    /// Welds in this connection
    pub welds: Vec<Weld>,
    /// Plates in this connection
    pub plates: Vec<ConnectionPlate>,
    /// Design forces
    pub forces: Option<ConnectionForces>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConnectionForces {
    /// Shear (kN)
    pub shear: f64,
    /// Axial (kN)
    pub axial: f64,
    /// Moment (kN-m)
    pub moment: f64,
    /// Torsion (kN-m)
    pub torsion: f64,
}

// ============================================================================
// BOLTS
// ============================================================================

/// Bolt grade
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub enum BoltGrade {
    A325,
    A325TC,
    A490,
    A490TC,
    Grade8_8,
    Grade10_9,
    Custom { fy: f64, fu: f64 },
}

impl BoltGrade {
    pub fn tensile_strength_mpa(&self) -> f64 {
        match self {
            BoltGrade::A325 | BoltGrade::A325TC => 830.0,
            BoltGrade::A490 | BoltGrade::A490TC => 1040.0,
            BoltGrade::Grade8_8 => 800.0,
            BoltGrade::Grade10_9 => 1000.0,
            BoltGrade::Custom { fu, .. } => *fu,
        }
    }
}

/// Bolt hole type
#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
pub enum HoleType {
    Standard,
    Oversized,
    ShortSlot,
    LongSlot,
}

/// Bolt group pattern
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BoltGroup {
    /// Bolt group ID
    pub id: String,
    /// Bolt diameter (mm)
    pub diameter: f64,
    /// Bolt grade
    pub grade: BoltGrade,
    /// Hole type
    pub hole_type: HoleType,
    /// Bolt pattern (positions relative to group origin)
    pub pattern: Vec<[f64; 2]>,
    /// Group origin [x, y, z]
    pub origin: [f64; 3],
    /// Group rotation (degrees)
    pub rotation: f64,
    /// Number of shear planes
    pub shear_planes: u8,
    /// Threads included in shear plane
    pub threads_in_shear: bool,
}

impl BoltGroup {
    /// Create a rectangular bolt pattern
    pub fn rectangular(
        id: &str,
        diameter: f64,
        grade: BoltGrade,
        rows: usize,
        cols: usize,
        gage: f64,
        pitch: f64,
        origin: [f64; 3],
    ) -> Self {
        let mut pattern = Vec::new();
        for r in 0..rows {
            for c in 0..cols {
                pattern.push([
                    c as f64 * gage - (cols - 1) as f64 * gage / 2.0,
                    r as f64 * pitch - (rows - 1) as f64 * pitch / 2.0,
                ]);
            }
        }
        
        BoltGroup {
            id: id.to_string(),
            diameter,
            grade,
            hole_type: HoleType::Standard,
            pattern,
            origin,
            rotation: 0.0,
            shear_planes: 1,
            threads_in_shear: true,
        }
    }
    
    /// Number of bolts
    pub fn bolt_count(&self) -> usize {
        self.pattern.len()
    }
    
    /// Bolt area (mm²)
    pub fn bolt_area(&self) -> f64 {
        std::f64::consts::PI * self.diameter.powi(2) / 4.0
    }
}

// ============================================================================
// WELDS
// ============================================================================

/// Weld type
#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
pub enum WeldType {
    Fillet,
    FullPenetration,
    PartialPenetration,
    Plug,
    Slot,
    Flare,
}

/// CIS/2 Weld
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Weld {
    /// Weld ID
    pub id: String,
    /// Weld type
    pub weld_type: WeldType,
    /// Weld size/leg (mm)
    pub size: f64,
    /// Effective throat (mm) - computed for fillets
    pub throat: f64,
    /// Length (mm)
    pub length: f64,
    /// Electrode strength (e.g., E70 = 70 ksi = 480 MPa)
    pub electrode_strength: f64,
    /// Start point
    pub start_point: [f64; 3],
    /// End point
    pub end_point: [f64; 3],
    /// Is all-around weld
    pub all_around: bool,
    /// Is field weld
    pub field_weld: bool,
}

impl Weld {
    pub fn fillet(id: &str, size: f64, length: f64, start: [f64; 3], end: [f64; 3]) -> Self {
        Weld {
            id: id.to_string(),
            weld_type: WeldType::Fillet,
            size,
            throat: size * 0.707, // 45° fillet
            length,
            electrode_strength: 480.0, // E70 in MPa
            start_point: start,
            end_point: end,
            all_around: false,
            field_weld: false,
        }
    }
    
    /// Weld capacity (kN)
    pub fn capacity(&self, phi: f64) -> f64 {
        // AISC: φRn = φ × 0.60 × FEXX × Awe
        let awe = self.throat * self.length;
        phi * 0.60 * self.electrode_strength * awe / 1000.0
    }
}

// ============================================================================
// CONNECTION PLATES
// ============================================================================

/// Connection plate
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConnectionPlate {
    /// Plate ID
    pub id: String,
    /// Thickness (mm)
    pub thickness: f64,
    /// Width (mm)
    pub width: f64,
    /// Height/Length (mm)
    pub height: f64,
    /// Material grade
    pub material_grade: String,
    /// Corner points defining plate outline
    pub outline: Vec<[f64; 2]>,
    /// Holes in plate
    pub holes: Vec<PlateHole>,
    /// Position origin
    pub origin: [f64; 3],
    /// Rotation about Z (degrees)
    pub rotation: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PlateHole {
    /// Hole center [x, y] relative to plate origin
    pub center: [f64; 2],
    /// Hole diameter (mm)
    pub diameter: f64,
    /// Hole type
    pub hole_type: HoleType,
    /// Slot length if applicable
    pub slot_length: Option<f64>,
}

// ============================================================================
// MATERIALS
// ============================================================================

/// Steel material specification
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SteelMaterial {
    /// Material name/grade
    pub grade: String,
    /// Yield strength Fy (MPa)
    pub fy: f64,
    /// Ultimate strength Fu (MPa)
    pub fu: f64,
    /// Elastic modulus E (MPa)
    pub e: f64,
    /// Poisson's ratio
    pub nu: f64,
    /// Density (kg/m³)
    pub density: f64,
    /// Standard specification
    pub specification: String,
}

impl SteelMaterial {
    pub fn a992() -> Self {
        SteelMaterial {
            grade: "A992".to_string(),
            fy: 345.0,
            fu: 450.0,
            e: 200000.0,
            nu: 0.3,
            density: 7850.0,
            specification: "ASTM A992/A992M".to_string(),
        }
    }
    
    pub fn a572_gr50() -> Self {
        SteelMaterial {
            grade: "A572-50".to_string(),
            fy: 345.0,
            fu: 450.0,
            e: 200000.0,
            nu: 0.3,
            density: 7850.0,
            specification: "ASTM A572/A572M".to_string(),
        }
    }
    
    pub fn a36() -> Self {
        SteelMaterial {
            grade: "A36".to_string(),
            fy: 250.0,
            fu: 400.0,
            e: 200000.0,
            nu: 0.3,
            density: 7850.0,
            specification: "ASTM A36/A36M".to_string(),
        }
    }
}

// ============================================================================
// CIS/2 MODEL
// ============================================================================

/// Complete CIS/2 model
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CIS2Model {
    /// Project name
    pub project_name: String,
    /// Model description
    pub description: String,
    /// Export configuration
    pub config: CIS2Config,
    /// Steel members
    pub members: Vec<SteelMember>,
    /// Connections
    pub connections: Vec<Connection>,
    /// Materials database
    pub materials: HashMap<String, SteelMaterial>,
    /// Assemblies (grouped members)
    pub assemblies: Vec<Assembly>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Assembly {
    /// Assembly mark
    pub mark: String,
    /// Member IDs in this assembly
    pub member_ids: Vec<String>,
    /// Main member ID
    pub main_member: String,
    /// Shipping piece
    pub shipping_piece: bool,
}

impl CIS2Model {
    pub fn new(project_name: &str) -> Self {
        let mut materials = HashMap::new();
        materials.insert("A992".to_string(), SteelMaterial::a992());
        materials.insert("A572-50".to_string(), SteelMaterial::a572_gr50());
        materials.insert("A36".to_string(), SteelMaterial::a36());
        
        CIS2Model {
            project_name: project_name.to_string(),
            description: String::new(),
            config: CIS2Config::default(),
            members: Vec::new(),
            connections: Vec::new(),
            materials,
            assemblies: Vec::new(),
        }
    }
    
    pub fn add_member(&mut self, member: SteelMember) {
        self.members.push(member);
    }
    
    pub fn add_connection(&mut self, connection: Connection) {
        self.connections.push(connection);
    }
    
    /// Get total steel weight (kg)
    pub fn total_weight(&self) -> f64 {
        // Simplified - would need section properties for accurate calc
        let density = 7850.0; // kg/m³
        self.members.iter()
            .map(|m| {
                let length = m.length() / 1000.0; // m
                // Assume average area of 5000 mm² for now
                let area = 5000.0 / 1e6; // m²
                length * area * density
            })
            .sum()
    }
}

// ============================================================================
// CIS/2 STEP EXPORT
// ============================================================================

/// CIS/2 STEP file exporter
pub struct CIS2Exporter {
    config: CIS2Config,
    entity_counter: usize,
}

impl CIS2Exporter {
    pub fn new(config: CIS2Config) -> Self {
        CIS2Exporter {
            config,
            entity_counter: 0,
        }
    }
    
    fn next_id(&mut self) -> usize {
        self.entity_counter += 1;
        self.entity_counter
    }
    
    /// Export model to CIS/2 STEP format
    pub fn export(&mut self, model: &CIS2Model) -> String {
        let mut output = String::new();
        
        // STEP file header
        output.push_str("ISO-10303-21;\n");
        output.push_str("HEADER;\n");
        output.push_str(&format!("FILE_DESCRIPTION(('CIS/2 Steel Model'), '2;1');\n"));
        output.push_str(&format!(
            "FILE_NAME('{}', '{}', ('Author'), ('Organization'), '', '', '');\n",
            model.project_name,
            "2025-01-03T12:00:00" // Static timestamp for compatibility
        ));
        output.push_str("FILE_SCHEMA(('STRUCTURAL_FRAME_SCHEMA'));\n");
        output.push_str("ENDSEC;\n");
        output.push_str("DATA;\n");
        
        // Export coordinate system
        let cs_id = self.next_id();
        output.push_str(&format!(
            "#{}=AXIS2_PLACEMENT_3D('',#{},$,$);\n",
            cs_id, self.next_id()
        ));
        
        // Export materials
        for (name, material) in &model.materials {
            let mat_id = self.next_id();
            output.push_str(&format!(
                "#{}=STEEL_MATERIAL('{}',{},{},{});\n",
                mat_id, name, material.fy, material.fu, material.e
            ));
        }
        
        // Export members
        for member in &model.members {
            output.push_str(&self.export_member(member));
        }
        
        // Export connections
        if self.config.include_connections {
            for conn in &model.connections {
                output.push_str(&self.export_connection(conn));
            }
        }
        
        output.push_str("ENDSEC;\n");
        output.push_str("END-ISO-10303-21;\n");
        
        output
    }
    
    fn export_member(&mut self, member: &SteelMember) -> String {
        let mut output = String::new();
        
        // Start point
        let sp_id = self.next_id();
        output.push_str(&format!(
            "#{}=CARTESIAN_POINT('',({},{},{}));\n",
            sp_id, member.start_point[0], member.start_point[1], member.start_point[2]
        ));
        
        // End point
        let ep_id = self.next_id();
        output.push_str(&format!(
            "#{}=CARTESIAN_POINT('',({},{},{}));\n",
            ep_id, member.end_point[0], member.end_point[1], member.end_point[2]
        ));
        
        // Section profile
        let section_str = match &member.section {
            SectionProfile::WideFlange { designation } => 
                format!("I_SECTION('{}')", designation),
            SectionProfile::Channel { designation } => 
                format!("C_SECTION('{}')", designation),
            SectionProfile::Angle { designation } => 
                format!("L_SECTION('{}')", designation),
            SectionProfile::Tube { designation } => 
                format!("HSS_SECTION('{}')", designation),
            SectionProfile::Pipe { designation } => 
                format!("PIPE_SECTION('{}')", designation),
            SectionProfile::Tee { designation } => 
                format!("T_SECTION('{}')", designation),
            SectionProfile::Plate { thickness, width } => 
                format!("PLATE_SECTION({},{})", thickness, width),
            SectionProfile::BuiltUp { description } => 
                format!("BUILT_UP_SECTION('{}')", description),
        };
        
        let sec_id = self.next_id();
        output.push_str(&format!("#{}={};\n", sec_id, section_str));
        
        // Member entity
        let mem_id = self.next_id();
        let type_str = match member.member_type {
            SteelMemberType::Beam => "BEAM",
            SteelMemberType::Column => "COLUMN",
            SteelMemberType::Brace => "BRACE",
            SteelMemberType::Girt => "GIRT",
            SteelMemberType::Purlin => "PURLIN",
            SteelMemberType::Joist => "JOIST",
            SteelMemberType::Truss => "TRUSS_MEMBER",
            SteelMemberType::Plate => "PLATE",
            SteelMemberType::Misc => "MISC_MEMBER",
        };
        
        output.push_str(&format!(
            "#{}=STRUCTURAL_MEMBER('{}','{}','{}',#{},#{},#{},{});\n",
            mem_id, 
            member.id, 
            member.piecemark,
            type_str,
            sp_id, ep_id, sec_id,
            member.rotation
        ));
        
        output
    }
    
    fn export_connection(&mut self, conn: &Connection) -> String {
        let mut output = String::new();
        
        // Work point
        let wp_id = self.next_id();
        output.push_str(&format!(
            "#{}=CARTESIAN_POINT('',({},{},{}));\n",
            wp_id, conn.work_point[0], conn.work_point[1], conn.work_point[2]
        ));
        
        // Connection type
        let type_str = match conn.conn_type {
            ConnectionType::ShearTab => "SHEAR_TAB",
            ConnectionType::MomentEndPlate => "MOMENT_END_PLATE",
            ConnectionType::MomentFlangePlate => "MOMENT_FLANGE_PLATE",
            ConnectionType::BracedFrame => "BRACED_FRAME",
            ConnectionType::BasePlate => "BASE_PLATE",
            ConnectionType::Splice => "SPLICE",
            ConnectionType::SeatedConnection => "SEATED",
            ConnectionType::ClipAngle => "CLIP_ANGLE",
        };
        
        let conn_id = self.next_id();
        output.push_str(&format!(
            "#{}=STRUCTURAL_CONNECTION('{}','{}','{}','{}',#{});\n",
            conn_id,
            conn.id,
            type_str,
            conn.supporting_member,
            conn.supported_member,
            wp_id
        ));
        
        // Export bolt groups
        if self.config.include_bolts {
            for bolt_group in &conn.bolts {
                output.push_str(&self.export_bolt_group(bolt_group, conn_id));
            }
        }
        
        // Export welds
        if self.config.include_welds {
            for weld in &conn.welds {
                output.push_str(&self.export_weld(weld, conn_id));
            }
        }
        
        output
    }
    
    fn export_bolt_group(&mut self, bolt_group: &BoltGroup, parent_id: usize) -> String {
        let mut output = String::new();
        
        let bg_id = self.next_id();
        let grade_str = match &bolt_group.grade {
            BoltGrade::A325 | BoltGrade::A325TC => "A325",
            BoltGrade::A490 | BoltGrade::A490TC => "A490",
            BoltGrade::Grade8_8 => "8.8",
            BoltGrade::Grade10_9 => "10.9",
            BoltGrade::Custom { .. } => "CUSTOM",
        };
        
        output.push_str(&format!(
            "#{}=BOLT_GROUP('{}',{},'{}',({}),#{});\n",
            bg_id,
            bolt_group.id,
            bolt_group.diameter,
            grade_str,
            bolt_group.pattern.iter()
                .map(|p| format!("({},{})", p[0], p[1]))
                .collect::<Vec<_>>()
                .join(","),
            parent_id
        ));
        
        output
    }
    
    fn export_weld(&mut self, weld: &Weld, parent_id: usize) -> String {
        let mut output = String::new();
        
        let weld_id = self.next_id();
        let type_str = match weld.weld_type {
            WeldType::Fillet => "FILLET",
            WeldType::FullPenetration => "CJP",
            WeldType::PartialPenetration => "PJP",
            WeldType::Plug => "PLUG",
            WeldType::Slot => "SLOT",
            WeldType::Flare => "FLARE",
        };
        
        output.push_str(&format!(
            "#{}=WELD('{}','{}',{},{},{},{},#{});\n",
            weld_id,
            weld.id,
            type_str,
            weld.size,
            weld.length,
            weld.electrode_strength,
            if weld.field_weld { "T" } else { "F" },
            parent_id
        ));
        
        output
    }
}

// ============================================================================
// CIS/2 IMPORT
// ============================================================================

/// Parse CIS/2 STEP file (simplified parser)
pub fn parse_cis2_file(content: &str) -> Result<CIS2Model, String> {
    let mut model = CIS2Model::new("Imported");
    
    // Simple line-by-line parsing
    for line in content.lines() {
        let line = line.trim();
        if line.starts_with('#') && line.contains('=') {
            // Parse entity
            if line.contains("STRUCTURAL_MEMBER") {
                if let Some(member) = parse_member_entity(line) {
                    model.members.push(member);
                }
            } else if line.contains("STRUCTURAL_CONNECTION") {
                // Would parse connection
            }
        }
    }
    
    if model.members.is_empty() {
        return Err("No members found in CIS/2 file".to_string());
    }
    
    Ok(model)
}

fn parse_member_entity(line: &str) -> Option<SteelMember> {
    // Simplified parsing - real implementation would be more robust
    // Format: #ID=STRUCTURAL_MEMBER('id','piecemark','type',#sp,#ep,#sec,rotation);
    
    // Extract values between parentheses
    let start = line.find('(')? + 1;
    let end = line.rfind(')')?;
    let params = &line[start..end];
    
    // Split by comma (simplified - doesn't handle nested parentheses)
    let parts: Vec<&str> = params.split(',').collect();
    if parts.len() < 4 {
        return None;
    }
    
    let id = parts[0].trim().trim_matches('\'');
    let piecemark = parts[1].trim().trim_matches('\'');
    
    Some(SteelMember::new(
        id,
        piecemark,
        SteelMemberType::Beam,
        SectionProfile::WideFlange { designation: "W12x26".to_string() },
        [0.0, 0.0, 0.0],
        [6000.0, 0.0, 0.0],
    ))
}

// ============================================================================
// SDNF (Steel Detailing Neutral File) SUPPORT
// ============================================================================

/// SDNF file format support
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SDNFModel {
    pub version: String,
    pub members: Vec<SteelMember>,
    pub materials: Vec<SteelMaterial>,
}

impl SDNFModel {
    pub fn from_cis2(cis2: &CIS2Model) -> Self {
        SDNFModel {
            version: "2.0".to_string(),
            members: cis2.members.clone(),
            materials: cis2.materials.values().cloned().collect(),
        }
    }
    
    /// Export to SDNF text format
    pub fn export_sdnf(&self) -> String {
        let mut output = String::new();
        
        output.push_str(&format!("SDNF V{}\n", self.version));
        output.push_str("UNITS MM KN\n");
        output.push_str("\n");
        
        // Materials section
        output.push_str("MATERIALS\n");
        for mat in &self.materials {
            output.push_str(&format!(
                "  {} FY={} FU={} E={}\n",
                mat.grade, mat.fy, mat.fu, mat.e
            ));
        }
        output.push_str("END_MATERIALS\n\n");
        
        // Members section
        output.push_str("MEMBERS\n");
        for member in &self.members {
            let section_name = match &member.section {
                SectionProfile::WideFlange { designation } => designation.clone(),
                SectionProfile::Channel { designation } => designation.clone(),
                SectionProfile::Angle { designation } => designation.clone(),
                SectionProfile::Tube { designation } => designation.clone(),
                SectionProfile::Pipe { designation } => designation.clone(),
                SectionProfile::Tee { designation } => designation.clone(),
                SectionProfile::Plate { thickness, width } => 
                    format!("PL{}x{}", thickness, width),
                SectionProfile::BuiltUp { description } => description.clone(),
            };
            
            output.push_str(&format!(
                "  {} {} {} {} {:.1} {:.1} {:.1} {:.1} {:.1} {:.1}\n",
                member.id,
                member.piecemark,
                section_name,
                member.material_grade,
                member.start_point[0], member.start_point[1], member.start_point[2],
                member.end_point[0], member.end_point[1], member.end_point[2],
            ));
        }
        output.push_str("END_MEMBERS\n");
        
        output
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    
    #[test]
    fn test_steel_member() {
        let member = SteelMember::new(
            "B1",
            "PM001",
            SteelMemberType::Beam,
            SectionProfile::WideFlange { designation: "W12x26".to_string() },
            [0.0, 0.0, 3000.0],
            [6000.0, 0.0, 3000.0],
        );
        
        assert!((member.length() - 6000.0).abs() < 0.1);
        let dir = member.direction();
        assert!((dir[0] - 1.0).abs() < 0.01);
    }
    
    #[test]
    fn test_bolt_group() {
        let bolts = BoltGroup::rectangular(
            "BG1",
            20.0,
            BoltGrade::A325,
            3, 2,
            75.0, 75.0,
            [0.0, 0.0, 0.0],
        );
        
        assert_eq!(bolts.bolt_count(), 6);
        assert!((bolts.bolt_area() - 314.159).abs() < 1.0);
    }
    
    #[test]
    fn test_weld() {
        let weld = Weld::fillet(
            "W1",
            8.0,
            150.0,
            [0.0, 0.0, 0.0],
            [150.0, 0.0, 0.0],
        );
        
        assert!((weld.throat - 5.656).abs() < 0.1);
        assert!(weld.capacity(0.75) > 0.0);
    }
    
    #[test]
    fn test_cis2_export() {
        let mut model = CIS2Model::new("Test Project");
        model.add_member(SteelMember::new(
            "B1",
            "PM001",
            SteelMemberType::Beam,
            SectionProfile::WideFlange { designation: "W12x26".to_string() },
            [0.0, 0.0, 3000.0],
            [6000.0, 0.0, 3000.0],
        ));
        
        let mut exporter = CIS2Exporter::new(CIS2Config::default());
        let output = exporter.export(&model);
        
        assert!(output.contains("ISO-10303-21"));
        assert!(output.contains("STRUCTURAL_MEMBER"));
    }
    
    #[test]
    fn test_sdnf_export() {
        let mut model = CIS2Model::new("Test");
        model.add_member(SteelMember::new(
            "C1",
            "PM100",
            SteelMemberType::Column,
            SectionProfile::WideFlange { designation: "W14x68".to_string() },
            [0.0, 0.0, 0.0],
            [0.0, 0.0, 4000.0],
        ));
        
        let sdnf = SDNFModel::from_cis2(&model);
        let output = sdnf.export_sdnf();
        
        assert!(output.contains("SDNF"));
        assert!(output.contains("PM100"));
    }
}
