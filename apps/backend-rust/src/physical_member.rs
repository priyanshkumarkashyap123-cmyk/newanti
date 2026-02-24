//! Physical Member Modeling
//!
//! Automatic framing from centerline geometry with proper member offsets,
//! end releases, and cardinal points - matching STAAD.Pro/ETABS/SAP2000.
//!
//! ## Features
//! - Centerline to physical member conversion
//! - Auto member offsets at connections
//! - Cardinal point placement (1-9)
//! - Beam-column intersection handling
//! - End release (moment/shear/axial)
//! - Member grouping and labeling

use serde::{Deserialize, Serialize};
use std::collections::HashMap;

// ============================================================================
// CARDINAL POINTS
// ============================================================================

/// Cardinal point positions for beam placement
/// Standard 9-point system matching STAAD.Pro/SAP2000
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum CardinalPoint {
    /// 1 - Bottom Left
    BottomLeft = 1,
    /// 2 - Bottom Center
    BottomCenter = 2,
    /// 3 - Bottom Right
    BottomRight = 3,
    /// 4 - Middle Left
    MiddleLeft = 4,
    /// 5 - Centroid (default)
    Centroid = 5,
    /// 6 - Middle Right
    MiddleRight = 6,
    /// 7 - Top Left
    TopLeft = 7,
    /// 8 - Top Center
    TopCenter = 8,
    /// 9 - Top Right
    TopRight = 9,
    /// 10 - Shear Center
    ShearCenter = 10,
    /// 11 - Top Flange Center (for W shapes)
    TopFlangeCenter = 11,
    /// 12 - Bottom Flange Center (for W shapes)
    BottomFlangeCenter = 12,
}

impl Default for CardinalPoint {
    fn default() -> Self {
        CardinalPoint::Centroid
    }
}

impl CardinalPoint {
    /// Get offset from centroid as (dy, dz) factors of section dimensions
    /// Returns (y_factor, z_factor) where offset = factor * (dimension/2)
    pub fn offset_factors(&self) -> (f64, f64) {
        match self {
            CardinalPoint::BottomLeft => (-1.0, -1.0),
            CardinalPoint::BottomCenter => (0.0, -1.0),
            CardinalPoint::BottomRight => (1.0, -1.0),
            CardinalPoint::MiddleLeft => (-1.0, 0.0),
            CardinalPoint::Centroid => (0.0, 0.0),
            CardinalPoint::MiddleRight => (1.0, 0.0),
            CardinalPoint::TopLeft => (-1.0, 1.0),
            CardinalPoint::TopCenter => (0.0, 1.0),
            CardinalPoint::TopRight => (1.0, 1.0),
            CardinalPoint::ShearCenter => (0.0, 0.0), // Depends on section
            CardinalPoint::TopFlangeCenter => (0.0, 1.0),
            CardinalPoint::BottomFlangeCenter => (0.0, -1.0),
        }
    }
}

// ============================================================================
// END RELEASES
// ============================================================================

/// Member end release conditions
#[derive(Debug, Clone, Copy, Default, Serialize, Deserialize)]
pub struct EndRelease {
    /// Release axial force (Fx)
    pub fx: bool,
    /// Release shear Y (Fy)
    pub fy: bool,
    /// Release shear Z (Fz)
    pub fz: bool,
    /// Release torsion (Mx)
    pub mx: bool,
    /// Release moment Y (My)
    pub my: bool,
    /// Release moment Z (Mz)
    pub mz: bool,
}

impl EndRelease {
    pub fn fixed() -> Self {
        EndRelease::default()
    }
    
    pub fn pinned() -> Self {
        EndRelease {
            fx: false,
            fy: false,
            fz: false,
            mx: true,
            my: true,
            mz: true,
        }
    }
    
    pub fn moment_release_z() -> Self {
        EndRelease {
            mz: true,
            ..Default::default()
        }
    }
    
    pub fn moment_release_y() -> Self {
        EndRelease {
            my: true,
            ..Default::default()
        }
    }
    
    pub fn all_released() -> Self {
        EndRelease {
            fx: true,
            fy: true,
            fz: true,
            mx: true,
            my: true,
            mz: true,
        }
    }
    
    /// Check if this is a moment connection
    pub fn is_moment_connection(&self) -> bool {
        !self.mx && !self.my && !self.mz
    }
    
    /// Check if this is a pin connection
    pub fn is_pin_connection(&self) -> bool {
        self.mx && self.my && self.mz
    }
}

// ============================================================================
// SECTION DIMENSIONS
// ============================================================================

/// Section dimensions for offset calculations
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SectionDimensions {
    /// Section name/designation
    pub name: String,
    /// Total depth (mm)
    pub depth: f64,
    /// Flange width / overall width (mm)
    pub width: f64,
    /// Web thickness (mm)
    pub tw: f64,
    /// Flange thickness (mm)
    pub tf: f64,
    /// Distance from centroid to top fiber (mm)
    pub yt: f64,
    /// Distance from centroid to bottom fiber (mm)
    pub yb: f64,
    /// Distance to shear center from centroid (mm)
    pub ys: f64,
}

impl SectionDimensions {
    /// Create for a symmetric I-section (W shape)
    pub fn w_shape(name: &str, depth: f64, width: f64, tw: f64, tf: f64) -> Self {
        SectionDimensions {
            name: name.to_string(),
            depth,
            width,
            tw,
            tf,
            yt: depth / 2.0,
            yb: depth / 2.0,
            ys: 0.0, // Shear center at centroid for doubly symmetric
        }
    }
    
    /// Create for a rectangular section
    pub fn rectangular(name: &str, depth: f64, width: f64) -> Self {
        SectionDimensions {
            name: name.to_string(),
            depth,
            width,
            tw: width,
            tf: 0.0,
            yt: depth / 2.0,
            yb: depth / 2.0,
            ys: 0.0,
        }
    }
    
    /// Calculate offset from centroid for a cardinal point
    pub fn cardinal_offset(&self, cp: CardinalPoint) -> (f64, f64) {
        let (yf, zf) = cp.offset_factors();
        (yf * self.width / 2.0, zf * self.depth / 2.0)
    }
}

// ============================================================================
// PHYSICAL MEMBER
// ============================================================================

/// Physical member representation with offsets
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PhysicalMember {
    /// Member ID
    pub id: String,
    /// Centerline node I (start)
    pub node_i: usize,
    /// Centerline node J (end)
    pub node_j: usize,
    /// Cardinal point
    pub cardinal_point: CardinalPoint,
    /// Section dimensions
    pub section: SectionDimensions,
    /// Start offset [dx, dy, dz] from centerline (mm)
    pub offset_i: [f64; 3],
    /// End offset [dx, dy, dz] from centerline (mm)
    pub offset_j: [f64; 3],
    /// Rigid end zone at I (mm)
    pub rigid_zone_i: f64,
    /// Rigid end zone at J (mm)
    pub rigid_zone_j: f64,
    /// End release at I
    pub release_i: EndRelease,
    /// End release at J
    pub release_j: EndRelease,
    /// Member rotation about local X (degrees)
    pub rotation: f64,
    /// Is this a column (vertical member)
    pub is_column: bool,
    /// Member group/label
    pub group: Option<String>,
}

impl PhysicalMember {
    pub fn new(
        id: &str,
        node_i: usize,
        node_j: usize,
        section: SectionDimensions,
    ) -> Self {
        PhysicalMember {
            id: id.to_string(),
            node_i,
            node_j,
            cardinal_point: CardinalPoint::Centroid,
            section,
            offset_i: [0.0; 3],
            offset_j: [0.0; 3],
            rigid_zone_i: 0.0,
            rigid_zone_j: 0.0,
            release_i: EndRelease::fixed(),
            release_j: EndRelease::fixed(),
            rotation: 0.0,
            is_column: false,
            group: None,
        }
    }
    
    /// Set cardinal point and compute offsets
    pub fn with_cardinal_point(mut self, cp: CardinalPoint) -> Self {
        self.cardinal_point = cp;
        let (dy, dz) = self.section.cardinal_offset(cp);
        // Apply to both ends
        self.offset_i[1] = dy;
        self.offset_i[2] = dz;
        self.offset_j[1] = dy;
        self.offset_j[2] = dz;
        self
    }
    
    /// Set end releases
    pub fn with_releases(mut self, release_i: EndRelease, release_j: EndRelease) -> Self {
        self.release_i = release_i;
        self.release_j = release_j;
        self
    }
    
    /// Set as column
    pub fn as_column(mut self) -> Self {
        self.is_column = true;
        self
    }
}

// ============================================================================
// NODE STRUCTURE
// ============================================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FrameNode {
    pub id: usize,
    pub x: f64,
    pub y: f64,
    pub z: f64,
    /// Member IDs connected at this node
    pub connected_members: Vec<String>,
    /// Is this a support node
    pub is_support: bool,
    /// Restraint conditions [Rx, Ry, Rz, Mx, My, Mz]
    pub restraints: [bool; 6],
}

impl FrameNode {
    pub fn new(id: usize, x: f64, y: f64, z: f64) -> Self {
        FrameNode {
            id,
            x, y, z,
            connected_members: Vec::new(),
            is_support: false,
            restraints: [false; 6],
        }
    }
    
    pub fn coords(&self) -> [f64; 3] {
        [self.x, self.y, self.z]
    }
}

// ============================================================================
// PHYSICAL FRAME MODEL
// ============================================================================

/// Complete physical frame model
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PhysicalFrameModel {
    /// Nodes (centerline joints)
    pub nodes: HashMap<usize, FrameNode>,
    /// Physical members
    pub members: HashMap<String, PhysicalMember>,
    /// Section library
    pub sections: HashMap<String, SectionDimensions>,
    /// Default cardinal point for beams
    pub default_beam_cardinal: CardinalPoint,
    /// Default cardinal point for columns
    pub default_column_cardinal: CardinalPoint,
}

impl PhysicalFrameModel {
    pub fn new() -> Self {
        PhysicalFrameModel {
            nodes: HashMap::new(),
            members: HashMap::new(),
            sections: HashMap::new(),
            default_beam_cardinal: CardinalPoint::TopCenter,
            default_column_cardinal: CardinalPoint::Centroid,
        }
    }
    
    pub fn add_node(&mut self, node: FrameNode) {
        self.nodes.insert(node.id, node);
    }
    
    pub fn add_member(&mut self, member: PhysicalMember) {
        // Update node connections
        if let Some(node_i) = self.nodes.get_mut(&member.node_i) {
            node_i.connected_members.push(member.id.clone());
        }
        if let Some(node_j) = self.nodes.get_mut(&member.node_j) {
            node_j.connected_members.push(member.id.clone());
        }
        self.members.insert(member.id.clone(), member);
    }
    
    pub fn add_section(&mut self, section: SectionDimensions) {
        self.sections.insert(section.name.clone(), section);
    }
}

// ============================================================================
// AUTO OFFSET CALCULATOR
// ============================================================================

/// Automatic offset calculation for beam-column connections
pub struct AutoOffsetCalculator {
    /// Offset type
    pub offset_type: OffsetType,
    /// Consider member depth in offset
    pub include_depth: bool,
    /// Use rigid end zones
    pub use_rigid_zones: bool,
}

#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
pub enum OffsetType {
    /// No automatic offsets
    None,
    /// Offset to face of supporting member
    ToFace,
    /// Offset to clear of supporting member
    ToClear,
    /// Use rigid end zones instead of physical offsets
    RigidZone,
}

impl Default for AutoOffsetCalculator {
    fn default() -> Self {
        AutoOffsetCalculator {
            offset_type: OffsetType::ToFace,
            include_depth: true,
            use_rigid_zones: false,
        }
    }
}

impl AutoOffsetCalculator {
    /// Calculate offset for beam end connected to column
    pub fn beam_to_column_offset(
        &self,
        _beam: &PhysicalMember,
        column: &PhysicalMember,
        at_start: bool,
    ) -> [f64; 3] {
        if self.offset_type == OffsetType::None {
            return [0.0; 3];
        }
        
        let col_depth = column.section.depth;
        let _col_width = column.section.width;
        
        // Beam connects to column face
        let offset_x = col_depth / 2.0;
        
        // Sign depends on which end and direction
        let sign = if at_start { 1.0 } else { -1.0 };
        
        [sign * offset_x, 0.0, 0.0]
    }
    
    /// Calculate offset for beam end connected to another beam
    pub fn beam_to_beam_offset(
        &self,
        _supported: &PhysicalMember,
        supporting: &PhysicalMember,
        at_start: bool,
    ) -> [f64; 3] {
        if self.offset_type == OffsetType::None {
            return [0.0; 3];
        }
        
        let _support_depth = supporting.section.depth;
        let support_width = supporting.section.width;
        
        // Typically offset in X direction (along beam span)
        let offset = support_width / 2.0;
        let sign = if at_start { 1.0 } else { -1.0 };
        
        [sign * offset, 0.0, 0.0]
    }
    
    /// Calculate rigid end zone length
    pub fn rigid_zone_length(
        &self,
        connected_member: &PhysicalMember,
    ) -> f64 {
        if !self.use_rigid_zones {
            return 0.0;
        }
        
        // Rigid zone = half depth of connected member
        connected_member.section.depth / 2.0
    }
}

// ============================================================================
// CENTERLINE TO PHYSICAL CONVERTER
// ============================================================================

/// Converts centerline frame model to physical model with offsets
pub struct CenterlineToPhysicalConverter {
    /// Auto offset calculator
    pub offset_calc: AutoOffsetCalculator,
    /// Tolerance for member direction detection (radians)
    pub angle_tolerance: f64,
}

impl Default for CenterlineToPhysicalConverter {
    fn default() -> Self {
        CenterlineToPhysicalConverter {
            offset_calc: AutoOffsetCalculator::default(),
            angle_tolerance: 0.1, // ~6 degrees
        }
    }
}

impl CenterlineToPhysicalConverter {
    /// Determine if member is vertical (column)
    pub fn is_vertical(&self, node_i: &FrameNode, node_j: &FrameNode) -> bool {
        let dx = node_j.x - node_i.x;
        let dy = node_j.y - node_i.y;
        let dz = node_j.z - node_i.z;
        let length = (dx * dx + dy * dy + dz * dz).sqrt();
        
        if length < 1e-6 {
            return false;
        }
        
        // Vertical if Z component dominates
        let cos_angle = dz.abs() / length;
        cos_angle > (std::f64::consts::FRAC_PI_4).cos() // > 45° from horizontal
    }
    
    /// Apply automatic offsets to a model
    pub fn apply_auto_offsets(&self, model: &mut PhysicalFrameModel) {
        // Collect member pairs at each node
        let mut node_members: HashMap<usize, Vec<String>> = HashMap::new();
        
        for (id, member) in &model.members {
            node_members.entry(member.node_i)
                .or_default()
                .push(id.clone());
            node_members.entry(member.node_j)
                .or_default()
                .push(id.clone());
        }
        
        // Process each node
        for (node_id, member_ids) in &node_members {
            if member_ids.len() < 2 {
                continue;
            }
            
            // Find columns at this node
            let columns: Vec<_> = member_ids.iter()
                .filter(|id| model.members.get(*id).map(|m| m.is_column).unwrap_or(false))
                .cloned()
                .collect();
            
            // Find beams at this node
            let beams: Vec<_> = member_ids.iter()
                .filter(|id| model.members.get(*id).map(|m| !m.is_column).unwrap_or(false))
                .cloned()
                .collect();
            
            // Apply beam-to-column offsets
            if let Some(col_id) = columns.first() {
                let col_section = model.members.get(col_id)
                    .map(|m| m.section.clone());
                
                if let Some(col_sec) = col_section {
                    for beam_id in &beams {
                        if let Some(beam) = model.members.get_mut(beam_id) {
                            let at_start = beam.node_i == *node_id;
                            
                            let col_member = PhysicalMember::new(
                                "temp",
                                0, 0,
                                col_sec.clone(),
                            );
                            
                            let offset = self.offset_calc.beam_to_column_offset(
                                beam,
                                &col_member,
                                at_start,
                            );
                            
                            if at_start {
                                beam.offset_i = offset;
                                beam.rigid_zone_i = self.offset_calc.rigid_zone_length(&col_member);
                            } else {
                                beam.offset_j = offset;
                                beam.rigid_zone_j = self.offset_calc.rigid_zone_length(&col_member);
                            }
                        }
                    }
                }
            }
        }
    }
    
    /// Apply cardinal points to all members
    pub fn apply_cardinal_points(&self, model: &mut PhysicalFrameModel) {
        let beam_cp = model.default_beam_cardinal;
        let col_cp = model.default_column_cardinal;
        
        for member in model.members.values_mut() {
            let cp = if member.is_column { col_cp } else { beam_cp };
            let (dy, dz) = member.section.cardinal_offset(cp);
            
            member.cardinal_point = cp;
            member.offset_i[1] += dy;
            member.offset_i[2] += dz;
            member.offset_j[1] += dy;
            member.offset_j[2] += dz;
        }
    }
    
    /// Identify and label columns automatically
    pub fn identify_columns(&self, model: &mut PhysicalFrameModel) {
        let node_coords: HashMap<usize, [f64; 3]> = model.nodes.iter()
            .map(|(id, n)| (*id, n.coords()))
            .collect();
        
        for member in model.members.values_mut() {
            if let (Some(ni), Some(nj)) = (
                node_coords.get(&member.node_i),
                node_coords.get(&member.node_j),
            ) {
                let dx = nj[0] - ni[0];
                let dy = nj[1] - ni[1];
                let dz = nj[2] - ni[2];
                let length = (dx * dx + dy * dy + dz * dz).sqrt();
                
                if length > 1e-6 {
                    let cos_z = dz.abs() / length;
                    member.is_column = cos_z > 0.7; // > ~45° from horizontal
                }
            }
        }
    }
}

// ============================================================================
// MEMBER GROUPING
// ============================================================================

/// Group members by properties for design
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MemberGroup {
    pub name: String,
    pub member_ids: Vec<String>,
    pub section_name: String,
    pub is_column_group: bool,
}

/// Auto-group members by section and type
pub fn auto_group_members(model: &PhysicalFrameModel) -> Vec<MemberGroup> {
    let mut groups: HashMap<String, MemberGroup> = HashMap::new();
    
    for (id, member) in &model.members {
        let key = format!(
            "{}_{}", 
            member.section.name,
            if member.is_column { "COL" } else { "BEAM" }
        );
        
        let group = groups.entry(key.clone()).or_insert(MemberGroup {
            name: key,
            member_ids: Vec::new(),
            section_name: member.section.name.clone(),
            is_column_group: member.is_column,
        });
        
        group.member_ids.push(id.clone());
    }
    
    groups.into_values().collect()
}

// ============================================================================
// TRANSFORMATION MATRIX
// ============================================================================

/// Calculate member transformation matrix including offsets
pub fn member_transformation_matrix(
    member: &PhysicalMember,
    node_i: &FrameNode,
    node_j: &FrameNode,
) -> [[f64; 3]; 3] {
    // Local X axis (along member)
    let dx = node_j.x - node_i.x;
    let dy = node_j.y - node_i.y;
    let dz = node_j.z - node_i.z;
    let length = (dx * dx + dy * dy + dz * dz).sqrt();
    
    let lx = [dx / length, dy / length, dz / length];
    
    // Local Z axis (typically vertical for horizontal members)
    let mut lz = if lx[2].abs() < 0.9 {
        // Member not vertical, Z up
        [0.0, 0.0, 1.0]
    } else {
        // Member vertical, use global Y as reference
        [0.0, 1.0, 0.0]
    };
    
    // Apply member rotation
    let theta = member.rotation.to_radians();
    if theta.abs() > 1e-6 {
        // Rotate LZ about LX
        let cos_t = theta.cos();
        let sin_t = theta.sin();
        // Simplified rotation (would need full Rodrigues formula)
        lz = [
            lz[0] * cos_t,
            lz[1] * cos_t - lz[2] * sin_t,
            lz[1] * sin_t + lz[2] * cos_t,
        ];
    }
    
    // Local Y = Z × X
    let ly = [
        lz[1] * lx[2] - lz[2] * lx[1],
        lz[2] * lx[0] - lz[0] * lx[2],
        lz[0] * lx[1] - lz[1] * lx[0],
    ];
    
    // Normalize
    let ly_len = (ly[0] * ly[0] + ly[1] * ly[1] + ly[2] * ly[2]).sqrt();
    let ly = [ly[0] / ly_len, ly[1] / ly_len, ly[2] / ly_len];
    
    // Recalculate LZ = X × Y
    let lz = [
        lx[1] * ly[2] - lx[2] * ly[1],
        lx[2] * ly[0] - lx[0] * ly[2],
        lx[0] * ly[1] - lx[1] * ly[0],
    ];
    
    [lx, ly, lz]
}

#[cfg(test)]
mod tests {
    use super::*;
    
    #[test]
    fn test_cardinal_point() {
        let section = SectionDimensions::w_shape("W12x26", 310.0, 165.0, 6.4, 9.7);
        
        let (dy, dz) = section.cardinal_offset(CardinalPoint::TopCenter);
        assert!((dy - 0.0).abs() < 0.1);
        assert!((dz - 155.0).abs() < 0.1);
        
        let (dy, dz) = section.cardinal_offset(CardinalPoint::BottomLeft);
        assert!((dy - (-82.5)).abs() < 0.1);
        assert!((dz - (-155.0)).abs() < 0.1);
    }
    
    #[test]
    fn test_end_release() {
        let pinned = EndRelease::pinned();
        assert!(pinned.is_pin_connection());
        assert!(!pinned.is_moment_connection());
        
        let fixed = EndRelease::fixed();
        assert!(fixed.is_moment_connection());
        assert!(!fixed.is_pin_connection());
    }
    
    #[test]
    fn test_physical_member() {
        let section = SectionDimensions::w_shape("W12x26", 310.0, 165.0, 6.4, 9.7);
        let member = PhysicalMember::new("B1", 1, 2, section)
            .with_cardinal_point(CardinalPoint::TopCenter);
        
        assert!((member.offset_i[2] - 155.0).abs() < 0.1);
    }
    
    #[test]
    fn test_auto_offset() {
        let calc = AutoOffsetCalculator::default();
        
        let beam_section = SectionDimensions::w_shape("W12x26", 310.0, 165.0, 6.4, 9.7);
        let col_section = SectionDimensions::w_shape("W14x68", 355.0, 255.0, 11.0, 18.0);
        
        let beam = PhysicalMember::new("B1", 1, 2, beam_section);
        let column = PhysicalMember::new("C1", 1, 3, col_section);
        
        let offset = calc.beam_to_column_offset(&beam, &column, true);
        assert!((offset[0] - 177.5).abs() < 0.1); // Half column depth
    }
    
    #[test]
    fn test_member_grouping() {
        let mut model = PhysicalFrameModel::new();
        
        let section = SectionDimensions::w_shape("W12x26", 310.0, 165.0, 6.4, 9.7);
        model.add_section(section.clone());
        
        model.add_node(FrameNode::new(1, 0.0, 0.0, 0.0));
        model.add_node(FrameNode::new(2, 6000.0, 0.0, 0.0));
        model.add_node(FrameNode::new(3, 12000.0, 0.0, 0.0));
        
        model.add_member(PhysicalMember::new("B1", 1, 2, section.clone()));
        model.add_member(PhysicalMember::new("B2", 2, 3, section.clone()));
        
        let groups = auto_group_members(&model);
        assert_eq!(groups.len(), 1);
        assert_eq!(groups[0].member_ids.len(), 2);
    }
}
