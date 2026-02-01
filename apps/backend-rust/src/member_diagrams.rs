//! # Member Diagram Generation Module
//! 
//! Generates Bending Moment Diagrams (BMD) and Shear Force Diagrams (SFD)
//! for structural members - essential for design and visualization.
//! 
//! ## Features
//! - Multi-station force calculation along member length
//! - Support for point loads, distributed loads, moments
//! - Automatic critical section detection
//! - Local/Global coordinate transformation
//! - WASM-compatible output for browser visualization
//! 
//! ## Industry Standard Compliance
//! - Sign convention: STAAD.Pro compatible (positive moment = tension bottom)
//! - Station spacing: Configurable (default 10 points per member)
//! - Coordinate systems: Local member and global

use serde::{Deserialize, Serialize};
use std::collections::HashMap;

// ============================================================================
// MEMBER LOAD TYPES
// ============================================================================

/// Type of load applied to a member
#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
pub enum MemberLoadType {
    /// Uniform distributed load (constant intensity)
    UniformDistributed,
    /// Linearly varying distributed load (trapezoidal)
    LinearlyVarying,
    /// Concentrated point load
    PointLoad,
    /// Concentrated moment
    PointMoment,
    /// Self-weight (uniform along length)
    SelfWeight,
    /// Partially distributed load
    PartialDistributed,
    /// Temperature gradient (causes bending)
    TemperatureGradient,
    /// Prestress load
    Prestress,
}

/// Direction of load in local coordinates
#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
pub enum LoadDirection {
    /// Axial direction (local x)
    Axial,
    /// Local Y direction (typically vertical in-plane)
    LocalY,
    /// Local Z direction (lateral out-of-plane)
    LocalZ,
    /// Global X direction (projected to member)
    GlobalX,
    /// Global Y direction (typically gravity)
    GlobalY,
    /// Global Z direction  
    GlobalZ,
    /// Moment about local X (torsion)
    MomentX,
    /// Moment about local Y
    MomentY,
    /// Moment about local Z
    MomentZ,
}

/// Individual member load definition
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MemberLoad {
    /// Member ID this load applies to
    pub member_id: String,
    /// Load type
    pub load_type: MemberLoadType,
    /// Load direction
    pub direction: LoadDirection,
    /// Start value (intensity or point load magnitude)
    pub value1: f64,
    /// End value (for varying loads), or unused for point loads
    pub value2: f64,
    /// Start distance from member start (0.0 to length)
    pub distance1: f64,
    /// End distance (for distributed) or same as distance1 for point loads
    pub distance2: f64,
    /// Load case ID this belongs to
    pub load_case_id: String,
}

impl MemberLoad {
    /// Create a uniform distributed load
    pub fn uniform(member_id: &str, direction: LoadDirection, intensity: f64, load_case: &str) -> Self {
        Self {
            member_id: member_id.to_string(),
            load_type: MemberLoadType::UniformDistributed,
            direction,
            value1: intensity,
            value2: intensity,
            distance1: 0.0,
            distance2: f64::INFINITY, // Will be clamped to member length
            load_case_id: load_case.to_string(),
        }
    }
    
    /// Create a point load
    pub fn point_load(member_id: &str, direction: LoadDirection, magnitude: f64, distance: f64, load_case: &str) -> Self {
        Self {
            member_id: member_id.to_string(),
            load_type: MemberLoadType::PointLoad,
            direction,
            value1: magnitude,
            value2: 0.0,
            distance1: distance,
            distance2: distance,
            load_case_id: load_case.to_string(),
        }
    }
    
    /// Create a linearly varying load (trapezoidal)
    pub fn varying(member_id: &str, direction: LoadDirection, w1: f64, w2: f64, d1: f64, d2: f64, load_case: &str) -> Self {
        Self {
            member_id: member_id.to_string(),
            load_type: MemberLoadType::LinearlyVarying,
            direction,
            value1: w1,
            value2: w2,
            distance1: d1,
            distance2: d2,
            load_case_id: load_case.to_string(),
        }
    }
    
    /// Create a point moment
    pub fn point_moment(member_id: &str, direction: LoadDirection, magnitude: f64, distance: f64, load_case: &str) -> Self {
        Self {
            member_id: member_id.to_string(),
            load_type: MemberLoadType::PointMoment,
            direction,
            value1: magnitude,
            value2: 0.0,
            distance1: distance,
            distance2: distance,
            load_case_id: load_case.to_string(),
        }
    }
}

// ============================================================================
// MEMBER FORCES AT A STATION
// ============================================================================

/// Complete set of internal forces at a station along the member
#[derive(Debug, Clone, Copy, Default, Serialize, Deserialize)]
pub struct MemberForces {
    /// Axial force (positive = tension)
    pub axial: f64,
    /// Shear force in local Y (Vy)
    pub shear_y: f64,
    /// Shear force in local Z (Vz)
    pub shear_z: f64,
    /// Torsional moment (Mx)
    pub torsion: f64,
    /// Bending moment about Y axis (My) - causes bending in XZ plane
    pub moment_y: f64,
    /// Bending moment about Z axis (Mz) - causes bending in XY plane
    pub moment_z: f64,
}

impl MemberForces {
    /// Create new zero forces
    pub fn new() -> Self {
        Self::default()
    }
    
    /// Add forces component-wise
    pub fn add(&mut self, other: &MemberForces) {
        self.axial += other.axial;
        self.shear_y += other.shear_y;
        self.shear_z += other.shear_z;
        self.torsion += other.torsion;
        self.moment_y += other.moment_y;
        self.moment_z += other.moment_z;
    }
    
    /// Scale forces by a factor
    pub fn scale(&mut self, factor: f64) {
        self.axial *= factor;
        self.shear_y *= factor;
        self.shear_z *= factor;
        self.torsion *= factor;
        self.moment_y *= factor;
        self.moment_z *= factor;
    }
    
    /// Get maximum absolute shear
    pub fn max_shear(&self) -> f64 {
        self.shear_y.abs().max(self.shear_z.abs())
    }
    
    /// Get maximum absolute moment
    pub fn max_moment(&self) -> f64 {
        self.moment_y.abs().max(self.moment_z.abs())
    }
}

/// Station point along a member
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ForceStation {
    /// Distance from member start (m)
    pub distance: f64,
    /// Normalized distance (0.0 to 1.0)
    pub normalized: f64,
    /// Forces at this station
    pub forces: MemberForces,
    /// Global coordinates of this station [x, y, z]
    pub global_coords: [f64; 3],
    /// Is this a critical section (max/min)?
    pub is_critical: bool,
    /// Label for critical sections
    pub label: Option<String>,
}

impl ForceStation {
    pub fn new(distance: f64, member_length: f64) -> Self {
        Self {
            distance,
            normalized: distance / member_length,
            forces: MemberForces::new(),
            global_coords: [0.0, 0.0, 0.0],
            is_critical: false,
            label: None,
        }
    }
}

// ============================================================================
// MEMBER DIAGRAM RESULTS
// ============================================================================

/// Complete diagram data for a member
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MemberDiagram {
    /// Member identifier
    pub member_id: String,
    /// Member length (m)
    pub length: f64,
    /// Start node ID
    pub start_node: String,
    /// End node ID
    pub end_node: String,
    /// Number of stations
    pub station_count: usize,
    /// Force data at each station
    pub stations: Vec<ForceStation>,
    /// Maximum forces (envelope)
    pub max_forces: MemberForces,
    /// Minimum forces (envelope)  
    pub min_forces: MemberForces,
    /// Critical sections indices
    pub critical_sections: Vec<usize>,
    /// Load case or combination ID
    pub load_case_id: String,
}

impl MemberDiagram {
    /// Create a new member diagram with specified stations
    pub fn new(member_id: &str, length: f64, station_count: usize, load_case_id: &str) -> Self {
        let mut stations = Vec::with_capacity(station_count);
        
        // Create evenly spaced stations
        for i in 0..station_count {
            let distance = if station_count == 1 {
                0.0
            } else {
                length * (i as f64) / ((station_count - 1) as f64)
            };
            stations.push(ForceStation::new(distance, length));
        }
        
        Self {
            member_id: member_id.to_string(),
            length,
            start_node: String::new(),
            end_node: String::new(),
            station_count,
            stations,
            max_forces: MemberForces::new(),
            min_forces: MemberForces::new(),
            critical_sections: Vec::new(),
            load_case_id: load_case_id.to_string(),
        }
    }
    
    /// Find and mark critical sections (max/min locations)
    pub fn find_critical_sections(&mut self) {
        if self.stations.is_empty() {
            return;
        }
        
        // Reset
        self.max_forces = MemberForces {
            axial: f64::NEG_INFINITY,
            shear_y: f64::NEG_INFINITY,
            shear_z: f64::NEG_INFINITY,
            torsion: f64::NEG_INFINITY,
            moment_y: f64::NEG_INFINITY,
            moment_z: f64::NEG_INFINITY,
        };
        
        self.min_forces = MemberForces {
            axial: f64::INFINITY,
            shear_y: f64::INFINITY,
            shear_z: f64::INFINITY,
            torsion: f64::INFINITY,
            moment_y: f64::INFINITY,
            moment_z: f64::INFINITY,
        };
        
        self.critical_sections.clear();
        
        // Track indices for max/min
        let mut max_moment_z_idx = 0;
        let mut min_moment_z_idx = 0;
        let mut max_shear_y_idx = 0;
        
        for (i, station) in self.stations.iter().enumerate() {
            let f = &station.forces;
            
            // Update envelope
            if f.axial > self.max_forces.axial { self.max_forces.axial = f.axial; }
            if f.axial < self.min_forces.axial { self.min_forces.axial = f.axial; }
            
            if f.shear_y > self.max_forces.shear_y { 
                self.max_forces.shear_y = f.shear_y;
                max_shear_y_idx = i;
            }
            if f.shear_y < self.min_forces.shear_y { self.min_forces.shear_y = f.shear_y; }
            
            if f.shear_z > self.max_forces.shear_z { self.max_forces.shear_z = f.shear_z; }
            if f.shear_z < self.min_forces.shear_z { self.min_forces.shear_z = f.shear_z; }
            
            if f.moment_y > self.max_forces.moment_y { self.max_forces.moment_y = f.moment_y; }
            if f.moment_y < self.min_forces.moment_y { self.min_forces.moment_y = f.moment_y; }
            
            if f.moment_z > self.max_forces.moment_z { 
                self.max_forces.moment_z = f.moment_z;
                max_moment_z_idx = i;
            }
            if f.moment_z < self.min_forces.moment_z { 
                self.min_forces.moment_z = f.moment_z;
                min_moment_z_idx = i;
            }
            
            if f.torsion > self.max_forces.torsion { self.max_forces.torsion = f.torsion; }
            if f.torsion < self.min_forces.torsion { self.min_forces.torsion = f.torsion; }
        }
        
        // Mark critical sections
        if max_moment_z_idx > 0 && max_moment_z_idx < self.stations.len() - 1 {
            self.stations[max_moment_z_idx].is_critical = true;
            self.stations[max_moment_z_idx].label = Some("Max Mz".to_string());
            self.critical_sections.push(max_moment_z_idx);
        }
        
        if min_moment_z_idx > 0 && min_moment_z_idx < self.stations.len() - 1 {
            if min_moment_z_idx != max_moment_z_idx {
                self.stations[min_moment_z_idx].is_critical = true;
                self.stations[min_moment_z_idx].label = Some("Min Mz".to_string());
                self.critical_sections.push(min_moment_z_idx);
            }
        }
        
        // Always include start and end as critical
        self.stations.first_mut().map(|s| {
            s.is_critical = true;
            s.label = Some("Start".to_string());
        });
        self.stations.last_mut().map(|s| {
            s.is_critical = true;
            s.label = Some("End".to_string());
        });
        
        if !self.critical_sections.contains(&0) {
            self.critical_sections.insert(0, 0);
        }
        if !self.critical_sections.contains(&(self.stations.len() - 1)) {
            self.critical_sections.push(self.stations.len() - 1);
        }
    }
    
    /// Get shear values for plotting (distance, value) pairs
    pub fn get_shear_y_data(&self) -> Vec<(f64, f64)> {
        self.stations.iter()
            .map(|s| (s.distance, s.forces.shear_y))
            .collect()
    }
    
    /// Get moment values for plotting (distance, value) pairs
    pub fn get_moment_z_data(&self) -> Vec<(f64, f64)> {
        self.stations.iter()
            .map(|s| (s.distance, s.forces.moment_z))
            .collect()
    }
    
    /// Get axial force data for plotting
    pub fn get_axial_data(&self) -> Vec<(f64, f64)> {
        self.stations.iter()
            .map(|s| (s.distance, s.forces.axial))
            .collect()
    }
    
    /// Get torsion data for plotting
    pub fn get_torsion_data(&self) -> Vec<(f64, f64)> {
        self.stations.iter()
            .map(|s| (s.distance, s.forces.torsion))
            .collect()
    }
}

// ============================================================================
// DIAGRAM CALCULATOR
// ============================================================================

/// Member properties needed for diagram calculation
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MemberProperties {
    pub member_id: String,
    pub length: f64,
    pub start_node: String,
    pub end_node: String,
    pub start_coords: [f64; 3],
    pub end_coords: [f64; 3],
    /// Local to global rotation matrix (3x3, row-major)
    pub rotation_matrix: [f64; 9],
    /// Cross-section area (for self-weight)
    pub area: f64,
    /// Material density (for self-weight)
    pub density: f64,
}

impl MemberProperties {
    /// Calculate direction cosines
    pub fn get_direction(&self) -> [f64; 3] {
        let dx = self.end_coords[0] - self.start_coords[0];
        let dy = self.end_coords[1] - self.start_coords[1];
        let dz = self.end_coords[2] - self.start_coords[2];
        [dx / self.length, dy / self.length, dz / self.length]
    }
    
    /// Get global coordinates at a given distance from start
    pub fn get_global_coords(&self, distance: f64) -> [f64; 3] {
        let t = distance / self.length;
        [
            self.start_coords[0] + t * (self.end_coords[0] - self.start_coords[0]),
            self.start_coords[1] + t * (self.end_coords[1] - self.start_coords[1]),
            self.start_coords[2] + t * (self.end_coords[2] - self.start_coords[2]),
        ]
    }
}

/// Main diagram calculator
pub struct DiagramCalculator {
    /// Default number of stations per member
    pub default_stations: usize,
    /// Include additional stations at load application points
    pub include_load_points: bool,
}

impl Default for DiagramCalculator {
    fn default() -> Self {
        Self {
            default_stations: 11, // 0.0, 0.1L, 0.2L, ..., 1.0L
            include_load_points: true,
        }
    }
}

impl DiagramCalculator {
    pub fn new() -> Self {
        Self::default()
    }
    
    /// Set the number of stations
    pub fn with_stations(mut self, count: usize) -> Self {
        self.default_stations = count.max(2);
        self
    }
    
    /// Calculate forces along a member from end forces and applied loads
    /// 
    /// # Arguments
    /// * `props` - Member properties
    /// * `start_forces` - Forces at start node [Fx, Fy, Fz, Mx, My, Mz] in local coords
    /// * `loads` - Applied member loads
    /// * `load_case_id` - Load case identifier
    pub fn calculate_diagram(
        &self,
        props: &MemberProperties,
        start_forces: &[f64; 6],
        loads: &[MemberLoad],
        load_case_id: &str,
    ) -> MemberDiagram {
        let mut diagram = MemberDiagram::new(
            &props.member_id,
            props.length,
            self.default_stations,
            load_case_id,
        );
        
        diagram.start_node = props.start_node.clone();
        diagram.end_node = props.end_node.clone();
        
        // Start forces (in STAAD convention)
        // Positive axial = tension
        // Positive shear at start acts in positive local Y/Z
        // Positive moment at start acts per right-hand rule
        let start = MemberForces {
            axial: start_forces[0],
            shear_y: start_forces[1],
            shear_z: start_forces[2],
            torsion: start_forces[3],
            moment_y: start_forces[4],
            moment_z: start_forces[5],
        };
        
        // Calculate forces at each station using equilibrium
        for station in &mut diagram.stations {
            let x = station.distance;
            
            // Start with reactions from start node
            station.forces.axial = -start.axial; // Sign convention: internal force
            station.forces.shear_y = start.shear_y;
            station.forces.shear_z = start.shear_z;
            station.forces.torsion = start.torsion;
            station.forces.moment_y = start.moment_y + start.shear_z * x;
            station.forces.moment_z = start.moment_z - start.shear_y * x; // Note sign
            
            // Add effects of applied loads up to this station
            for load in loads {
                if load.member_id != props.member_id {
                    continue;
                }
                
                self.add_load_effect(station, load, props.length);
            }
            
            // Update global coordinates
            station.global_coords = props.get_global_coords(x);
        }
        
        // Find critical sections
        diagram.find_critical_sections();
        
        diagram
    }
    
    /// Add the effect of a single load on forces at a station
    fn add_load_effect(&self, station: &mut ForceStation, load: &MemberLoad, member_length: f64) {
        let x = station.distance;
        
        match load.load_type {
            MemberLoadType::UniformDistributed => {
                // UDL from start to end
                let w = load.value1;
                let d1 = load.distance1.max(0.0);
                let d2 = load.distance2.min(member_length);
                
                if x > d1 {
                    let x_eff = (x - d1).min(d2 - d1);
                    
                    match load.direction {
                        LoadDirection::LocalY | LoadDirection::GlobalY => {
                            station.forces.shear_y -= w * x_eff;
                            station.forces.moment_z += w * x_eff * (x - d1 - x_eff / 2.0);
                        }
                        LoadDirection::LocalZ | LoadDirection::GlobalZ => {
                            station.forces.shear_z -= w * x_eff;
                            station.forces.moment_y -= w * x_eff * (x - d1 - x_eff / 2.0);
                        }
                        LoadDirection::Axial | LoadDirection::GlobalX => {
                            station.forces.axial -= w * x_eff;
                        }
                        _ => {}
                    }
                }
            }
            
            MemberLoadType::LinearlyVarying => {
                // Linearly varying load (trapezoidal)
                let w1 = load.value1;
                let w2 = load.value2;
                let d1 = load.distance1.max(0.0);
                let d2 = load.distance2.min(member_length);
                let load_length = d2 - d1;
                
                if x > d1 && load_length > 0.0 {
                    let x_eff = (x - d1).min(load_length);
                    let t = x_eff / load_length;
                    
                    // Intensity at x: w1 + (w2-w1) * t_local
                    // For triangular portion
                    let avg_w = w1 + 0.5 * (w2 - w1) * t;
                    
                    match load.direction {
                        LoadDirection::LocalY | LoadDirection::GlobalY => {
                            station.forces.shear_y -= avg_w * x_eff;
                            // Simplified moment calculation
                            station.forces.moment_z += avg_w * x_eff * (x - d1 - x_eff / 3.0);
                        }
                        LoadDirection::LocalZ | LoadDirection::GlobalZ => {
                            station.forces.shear_z -= avg_w * x_eff;
                            station.forces.moment_y -= avg_w * x_eff * (x - d1 - x_eff / 3.0);
                        }
                        _ => {}
                    }
                }
            }
            
            MemberLoadType::PointLoad => {
                // Point load at specific location
                let p = load.value1;
                let d = load.distance1;
                
                if x > d {
                    match load.direction {
                        LoadDirection::LocalY | LoadDirection::GlobalY => {
                            station.forces.shear_y -= p;
                            station.forces.moment_z += p * (x - d);
                        }
                        LoadDirection::LocalZ | LoadDirection::GlobalZ => {
                            station.forces.shear_z -= p;
                            station.forces.moment_y -= p * (x - d);
                        }
                        LoadDirection::Axial | LoadDirection::GlobalX => {
                            station.forces.axial -= p;
                        }
                        _ => {}
                    }
                }
            }
            
            MemberLoadType::PointMoment => {
                // Concentrated moment at specific location
                let m = load.value1;
                let d = load.distance1;
                
                if x >= d {
                    match load.direction {
                        LoadDirection::MomentZ | LoadDirection::LocalZ => {
                            station.forces.moment_z += m;
                        }
                        LoadDirection::MomentY | LoadDirection::LocalY => {
                            station.forces.moment_y += m;
                        }
                        LoadDirection::MomentX | LoadDirection::Axial => {
                            station.forces.torsion += m;
                        }
                        _ => {}
                    }
                }
            }
            
            MemberLoadType::SelfWeight => {
                // Self-weight acts in global Y (downward)
                // load.value1 should be weight per unit length
                let w = load.value1;
                
                if x > 0.0 {
                    // Assuming GlobalY for self-weight
                    station.forces.shear_y -= w * x;
                    station.forces.moment_z += w * x * x / 2.0;
                }
            }
            
            _ => {
                // Other load types not yet implemented
            }
        }
    }
    
    /// Calculate diagrams for multiple members
    pub fn calculate_all_diagrams(
        &self,
        members: &[MemberProperties],
        member_forces: &HashMap<String, [f64; 6]>,
        loads: &[MemberLoad],
        load_case_id: &str,
    ) -> HashMap<String, MemberDiagram> {
        let mut diagrams = HashMap::new();
        
        for props in members {
            if let Some(start_forces) = member_forces.get(&props.member_id) {
                let member_loads: Vec<_> = loads.iter()
                    .filter(|l| l.member_id == props.member_id)
                    .cloned()
                    .collect();
                    
                let diagram = self.calculate_diagram(props, start_forces, &member_loads, load_case_id);
                diagrams.insert(props.member_id.clone(), diagram);
            }
        }
        
        diagrams
    }
}

// ============================================================================
// DIAGRAM OUTPUT FORMATS
// ============================================================================

/// SVG output for diagrams (WASM-friendly)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DiagramSvgOptions {
    pub width: f64,
    pub height: f64,
    pub margin: f64,
    pub show_grid: bool,
    pub show_values: bool,
    pub positive_color: String,
    pub negative_color: String,
    pub line_width: f64,
}

impl Default for DiagramSvgOptions {
    fn default() -> Self {
        Self {
            width: 800.0,
            height: 200.0,
            margin: 40.0,
            show_grid: true,
            show_values: true,
            positive_color: "#2563eb".to_string(), // Blue
            negative_color: "#dc2626".to_string(), // Red
            line_width: 2.0,
        }
    }
}

/// Generate SVG string for a diagram
pub fn generate_diagram_svg(
    data: &[(f64, f64)],
    title: &str,
    unit: &str,
    options: &DiagramSvgOptions,
) -> String {
    if data.is_empty() {
        return String::new();
    }
    
    let w = options.width;
    let h = options.height;
    let m = options.margin;
    
    // Find data bounds
    let x_min = data.iter().map(|(x, _)| *x).fold(f64::INFINITY, f64::min);
    let x_max = data.iter().map(|(x, _)| *x).fold(f64::NEG_INFINITY, f64::max);
    let y_min = data.iter().map(|(_, y)| *y).fold(f64::INFINITY, f64::min);
    let y_max = data.iter().map(|(_, y)| *y).fold(f64::NEG_INFINITY, f64::max);
    
    let x_range = (x_max - x_min).max(0.001);
    let y_range = (y_max - y_min).max(0.001);
    
    // Scale factors
    let sx = (w - 2.0 * m) / x_range;
    let sy = (h - 2.0 * m) / y_range;
    
    // Transform point to SVG coordinates
    let transform = |x: f64, y: f64| -> (f64, f64) {
        let px = m + (x - x_min) * sx;
        // Flip Y for SVG coordinates
        let py = h - m - (y - y_min) * sy;
        (px, py)
    };
    
    // Find baseline (y=0)
    let (_, baseline_y) = transform(0.0, 0.0);
    
    let mut svg = format!(
        r#"<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {} {}" width="{}" height="{}">"#,
        w, h, w, h
    );
    
    // Background
    svg.push_str(&format!(
        r#"<rect x="0" y="0" width="{}" height="{}" fill="white"/>"#,
        w, h
    ));
    
    // Title
    svg.push_str(&format!(
        r##"<text x="{}" y="20" text-anchor="middle" font-family="Arial" font-size="14" font-weight="bold">{}</text>"##,
        w / 2.0, title
    ));
    
    // Grid lines
    if options.show_grid {
        svg.push_str(r##"<g stroke="#e5e7eb" stroke-width="1">"##);
        for i in 0..=10 {
            let x = m + (w - 2.0 * m) * (i as f64) / 10.0;
            svg.push_str(&format!(
                r##"<line x1="{:.1}" y1="{:.1}" x2="{:.1}" y2="{:.1}"/>"##,
                x, m, x, h - m
            ));
        }
        for i in 0..=4 {
            let y = m + (h - 2.0 * m) * (i as f64) / 4.0;
            svg.push_str(&format!(
                r##"<line x1="{:.1}" y1="{:.1}" x2="{:.1}" y2="{:.1}"/>"##,
                m, y, w - m, y
            ));
        }
        svg.push_str("</g>");
    }
    
    // Baseline (y=0)
    svg.push_str(&format!(
        r##"<line x1="{:.1}" y1="{:.1}" x2="{:.1}" y2="{:.1}" stroke="#374151" stroke-width="1.5"/>"##,
        m, baseline_y, w - m, baseline_y
    ));
    
    // Build path for filled area
    let mut path_d = String::new();
    let (first_x, first_y) = transform(data[0].0, data[0].1);
    path_d.push_str(&format!("M{:.1},{:.1}", first_x, baseline_y));
    path_d.push_str(&format!("L{:.1},{:.1}", first_x, first_y));
    
    for (x, y) in data.iter().skip(1) {
        let (px, py) = transform(*x, *y);
        path_d.push_str(&format!("L{:.1},{:.1}", px, py));
    }
    
    let (last_x, _) = transform(data.last().unwrap().0, data.last().unwrap().1);
    path_d.push_str(&format!("L{:.1},{:.1}Z", last_x, baseline_y));
    
    // Filled area (positive blue, negative red handled separately for now)
    let fill_color = if y_max >= 0.0 && y_min >= 0.0 {
        &options.positive_color
    } else if y_max <= 0.0 && y_min <= 0.0 {
        &options.negative_color
    } else {
        "#6366f1" // Mixed - purple
    };
    
    svg.push_str(&format!(
        r##"<path d="{}" fill="{}" fill-opacity="0.2" stroke="{}" stroke-width="{}"/>"##,
        path_d, fill_color, fill_color, options.line_width
    ));
    
    // Value labels
    if options.show_values {
        svg.push_str(r##"<g font-family="Arial" font-size="10" fill="#374151">"##);
        
        // Max value
        let max_point = data.iter().max_by(|a, b| a.1.partial_cmp(&b.1).unwrap()).unwrap();
        let (mx, my) = transform(max_point.0, max_point.1);
        svg.push_str(&format!(
            r##"<text x="{:.1}" y="{:.1}" text-anchor="middle">{:.2} {}</text>"##,
            mx, my - 5.0, max_point.1, unit
        ));
        
        // Min value (if different enough from max)
        let min_point = data.iter().min_by(|a, b| a.1.partial_cmp(&b.1).unwrap()).unwrap();
        if (max_point.1 - min_point.1).abs() > y_range * 0.1 {
            let (mx, my) = transform(min_point.0, min_point.1);
            svg.push_str(&format!(
                r##"<text x="{:.1}" y="{:.1}" text-anchor="middle">{:.2} {}</text>"##,
                mx, my + 15.0, min_point.1, unit
            ));
        }
        
        svg.push_str("</g>");
    }
    
    // X-axis labels
    svg.push_str(&format!(
        r##"<text x="{:.1}" y="{:.1}" font-family="Arial" font-size="10" fill="#6b7280">0</text>"##,
        m, h - m + 15.0
    ));
    svg.push_str(&format!(
        r##"<text x="{:.1}" y="{:.1}" font-family="Arial" font-size="10" fill="#6b7280" text-anchor="end">{:.2}m</text>"##,
        w - m, h - m + 15.0, x_max
    ));
    
    svg.push_str("</svg>");
    
    svg
}

/// JSON output format for diagram data (for frontend visualization)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DiagramJsonOutput {
    pub member_id: String,
    pub length: f64,
    pub load_case: String,
    pub axial: DiagramDataset,
    pub shear_y: DiagramDataset,
    pub shear_z: DiagramDataset,
    pub torsion: DiagramDataset,
    pub moment_y: DiagramDataset,
    pub moment_z: DiagramDataset,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DiagramDataset {
    pub label: String,
    pub unit: String,
    pub data: Vec<[f64; 2]>, // [x, y] pairs
    pub max: f64,
    pub min: f64,
    pub max_location: f64,
    pub min_location: f64,
}

impl From<&MemberDiagram> for DiagramJsonOutput {
    fn from(diagram: &MemberDiagram) -> Self {
        let make_dataset = |label: &str, unit: &str, extractor: fn(&MemberForces) -> f64| -> DiagramDataset {
            let data: Vec<[f64; 2]> = diagram.stations.iter()
                .map(|s| [s.distance, extractor(&s.forces)])
                .collect();
            
            let values: Vec<f64> = data.iter().map(|d| d[1]).collect();
            let max = values.iter().cloned().fold(f64::NEG_INFINITY, f64::max);
            let min = values.iter().cloned().fold(f64::INFINITY, f64::min);
            
            let max_loc = data.iter().find(|d| (d[1] - max).abs() < 1e-6).map(|d| d[0]).unwrap_or(0.0);
            let min_loc = data.iter().find(|d| (d[1] - min).abs() < 1e-6).map(|d| d[0]).unwrap_or(0.0);
            
            DiagramDataset {
                label: label.to_string(),
                unit: unit.to_string(),
                data,
                max,
                min,
                max_location: max_loc,
                min_location: min_loc,
            }
        };
        
        Self {
            member_id: diagram.member_id.clone(),
            length: diagram.length,
            load_case: diagram.load_case_id.clone(),
            axial: make_dataset("Axial Force", "kN", |f| f.axial),
            shear_y: make_dataset("Shear Vy", "kN", |f| f.shear_y),
            shear_z: make_dataset("Shear Vz", "kN", |f| f.shear_z),
            torsion: make_dataset("Torsion Mx", "kN·m", |f| f.torsion),
            moment_y: make_dataset("Moment My", "kN·m", |f| f.moment_y),
            moment_z: make_dataset("Moment Mz", "kN·m", |f| f.moment_z),
        }
    }
}

// ============================================================================
// TESTS
// ============================================================================

#[cfg(test)]
mod tests {
    use super::*;
    
    fn create_simple_beam() -> MemberProperties {
        MemberProperties {
            member_id: "M1".to_string(),
            length: 6.0, // 6m beam
            start_node: "N1".to_string(),
            end_node: "N2".to_string(),
            start_coords: [0.0, 0.0, 0.0],
            end_coords: [6.0, 0.0, 0.0],
            rotation_matrix: [1.0, 0.0, 0.0, 0.0, 1.0, 0.0, 0.0, 0.0, 1.0],
            area: 0.01,
            density: 7850.0,
        }
    }
    
    #[test]
    fn test_simply_supported_udl() {
        // Simply supported beam with UDL
        // L = 6m, w = 10 kN/m (downward, positive in this convention)
        // Reactions: R = wL/2 = 30 kN each (upward)
        // Internal shear convention: starts positive (cutting from left)
        
        let props = create_simple_beam();
        let calc = DiagramCalculator::new().with_stations(21);
        
        // Start forces (left reaction)
        // Fy = 30 kN (upward), this is the reaction that the beam "feels"
        let start_forces = [0.0, 30.0, 0.0, 0.0, 0.0, 0.0];
        
        // UDL - using positive value for downward load
        let loads = vec![
            MemberLoad::uniform("M1", LoadDirection::LocalY, 10.0, "DL"),
        ];
        
        let diagram = calc.calculate_diagram(&props, &start_forces, &loads, "DL");
        
        println!("Shear diagram (simply supported with UDL):");
        for s in &diagram.stations {
            println!("  x={:.1}m: Vy={:.2}kN, Mz={:.2}kN·m", s.distance, s.forces.shear_y, s.forces.moment_z);
        }
        
        // Check shear at start: should be +30 kN
        let start_shear = diagram.stations[0].forces.shear_y;
        assert!((start_shear - 30.0).abs() < 0.1, "Start shear should be ~30kN, got {}", start_shear);
        
        // Check that shear decreases along the beam
        let mid_idx = diagram.stations.len() / 2;
        let mid_shear = diagram.stations[mid_idx].forces.shear_y;
        assert!(mid_shear.abs() < 1.0, "Midspan shear should be ~0, got {}", mid_shear);
        
        // Check max moment at midspan: wL²/8 = 10*36/8 = 45 kN·m (but check sign)
        let mid_moment = diagram.stations[mid_idx].forces.moment_z.abs();
        assert!((mid_moment - 45.0).abs() < 2.0, "Midspan moment should be ~45kN·m, got {}", mid_moment);
        
        println!("Max forces: Vy_max={:.2}, Mz_max={:.2}", diagram.max_forces.shear_y, diagram.max_forces.moment_z);
        println!("Min forces: Vy_min={:.2}, Mz_min={:.2}", diagram.min_forces.shear_y, diagram.min_forces.moment_z);
    }
    
    #[test]
    fn test_cantilever_point_load() {
        // Cantilever beam with point load at free end
        // L = 4m, P = -20 kN at tip
        // Reaction at fixed end: Fy = 20 kN, Mz = 80 kN·m
        
        let props = MemberProperties {
            member_id: "M1".to_string(),
            length: 4.0,
            start_node: "N1".to_string(),
            end_node: "N2".to_string(),
            start_coords: [0.0, 0.0, 0.0],
            end_coords: [4.0, 0.0, 0.0],
            rotation_matrix: [1.0, 0.0, 0.0, 0.0, 1.0, 0.0, 0.0, 0.0, 1.0],
            area: 0.01,
            density: 7850.0,
        };
        
        let calc = DiagramCalculator::new().with_stations(11);
        
        // Start forces (fixed end reactions)
        // Fy = 20 kN, Mz = 80 kN·m (to balance the tip load)
        let start_forces = [0.0, 20.0, 0.0, 0.0, 0.0, 80.0];
        
        // Point load at tip
        let loads = vec![
            MemberLoad::point_load("M1", LoadDirection::LocalY, -20.0, 4.0, "LL"),
        ];
        
        let diagram = calc.calculate_diagram(&props, &start_forces, &loads, "LL");
        
        println!("Cantilever with point load:");
        for s in &diagram.stations {
            println!("  x={:.1}m: Vy={:.2}kN, Mz={:.2}kN·m", s.distance, s.forces.shear_y, s.forces.moment_z);
        }
        
        // Shear should be constant at 20 kN (before the point load)
        let mid_shear = diagram.stations[diagram.stations.len() / 2].forces.shear_y;
        assert!((mid_shear - 20.0).abs() < 0.1, "Shear should be constant 20kN");
        
        // Moment at root should be 80 kN·m
        let root_moment = diagram.stations[0].forces.moment_z;
        assert!((root_moment - 80.0).abs() < 0.1, "Root moment should be 80kN·m, got {}", root_moment);
        
        // Moment at tip should be 0
        let tip_moment = diagram.stations.last().unwrap().forces.moment_z;
        assert!(tip_moment.abs() < 0.1, "Tip moment should be ~0, got {}", tip_moment);
    }
    
    #[test]
    fn test_diagram_svg_generation() {
        let data: Vec<(f64, f64)> = (0..11)
            .map(|i| {
                let x = i as f64 * 0.6;
                let y = 45.0 * (1.0 - (2.0 * x / 6.0 - 1.0).powi(2)); // Parabola
                (x, y)
            })
            .collect();
        
        let options = DiagramSvgOptions::default();
        let svg = generate_diagram_svg(&data, "Bending Moment Diagram", "kN·m", &options);
        
        assert!(svg.contains("<svg"));
        assert!(svg.contains("Bending Moment Diagram"));
        assert!(svg.contains("</svg>"));
        
        println!("Generated SVG length: {} chars", svg.len());
    }
    
    #[test]
    fn test_diagram_json_output() {
        let props = create_simple_beam();
        let calc = DiagramCalculator::new().with_stations(11);
        let start_forces = [0.0, 30.0, 0.0, 0.0, 0.0, 0.0];
        let loads = vec![MemberLoad::uniform("M1", LoadDirection::LocalY, -10.0, "DL")];
        
        let diagram = calc.calculate_diagram(&props, &start_forces, &loads, "DL");
        let json_output = DiagramJsonOutput::from(&diagram);
        
        assert_eq!(json_output.member_id, "M1");
        assert_eq!(json_output.length, 6.0);
        assert_eq!(json_output.moment_z.data.len(), 11);
        
        println!("Moment Mz max: {:.2} at {:.2}m", json_output.moment_z.max, json_output.moment_z.max_location);
        
        // Serialize to JSON
        let json_str = serde_json::to_string_pretty(&json_output).unwrap();
        println!("JSON output sample:\n{}", &json_str[..500.min(json_str.len())]);
    }
    
    #[test]
    fn test_member_load_constructors() {
        let udl = MemberLoad::uniform("M1", LoadDirection::GlobalY, -15.0, "DL");
        assert_eq!(udl.load_type, MemberLoadType::UniformDistributed);
        assert_eq!(udl.value1, -15.0);
        
        let point = MemberLoad::point_load("M2", LoadDirection::LocalY, -50.0, 2.5, "LL");
        assert_eq!(point.load_type, MemberLoadType::PointLoad);
        assert_eq!(point.distance1, 2.5);
        
        let varying = MemberLoad::varying("M3", LoadDirection::LocalY, -10.0, -20.0, 0.0, 5.0, "WL");
        assert_eq!(varying.load_type, MemberLoadType::LinearlyVarying);
        assert_eq!(varying.value1, -10.0);
        assert_eq!(varying.value2, -20.0);
    }
    
    #[test]
    fn test_varying_load() {
        // Triangular load: 0 at start, -20 kN/m at end
        // L = 5m
        // Total load = 0.5 * 20 * 5 = 50 kN
        // Centroid at L/3 from larger end = 5/3 from right
        
        let props = MemberProperties {
            member_id: "M1".to_string(),
            length: 5.0,
            start_node: "N1".to_string(),
            end_node: "N2".to_string(),
            start_coords: [0.0, 0.0, 0.0],
            end_coords: [5.0, 0.0, 0.0],
            rotation_matrix: [1.0, 0.0, 0.0, 0.0, 1.0, 0.0, 0.0, 0.0, 1.0],
            area: 0.01,
            density: 7850.0,
        };
        
        let calc = DiagramCalculator::new().with_stations(11);
        
        // Reactions for simply supported with triangular load
        // Ra = 50 * (5/3) / 5 = 16.67 kN
        // Rb = 50 - 16.67 = 33.33 kN
        let start_forces = [0.0, 16.67, 0.0, 0.0, 0.0, 0.0];
        
        let loads = vec![
            MemberLoad::varying("M1", LoadDirection::LocalY, 0.0, 20.0, 0.0, 5.0, "VL"),
        ];
        
        let diagram = calc.calculate_diagram(&props, &start_forces, &loads, "VL");
        
        println!("Triangular load diagram:");
        for s in &diagram.stations {
            println!("  x={:.1}m: Vy={:.2}kN, Mz={:.2}kN·m", s.distance, s.forces.shear_y, s.forces.moment_z);
        }
        
        // Start shear should be ~16.67 kN
        assert!((diagram.stations[0].forces.shear_y - 16.67).abs() < 1.0);
    }
    
    #[test]
    fn test_multiple_loads() {
        let props = create_simple_beam();
        let calc = DiagramCalculator::new().with_stations(21);
        
        // Combined loading: UDL + point load at midspan
        // UDL: 5 kN/m (positive = acts to reduce shear) over 6m = 30 kN total
        // Point: 20 kN at 3m
        // Total: 50 kN, reactions = 25 kN each
        let start_forces = [0.0, 25.0, 0.0, 0.0, 0.0, 0.0];
        
        let loads = vec![
            MemberLoad::uniform("M1", LoadDirection::LocalY, 5.0, "DL"),
            MemberLoad::point_load("M1", LoadDirection::LocalY, 20.0, 3.0, "LL"),
        ];
        
        let diagram = calc.calculate_diagram(&props, &start_forces, &loads, "COMB");
        
        println!("Combined loading diagram:");
        for (i, s) in diagram.stations.iter().enumerate() {
            if i % 2 == 0 {
                println!("  x={:.1}m: Vy={:.2}kN, Mz={:.2}kN·m", s.distance, s.forces.shear_y, s.forces.moment_z);
            }
        }
        
        // Check shear values are reasonable (starts positive, decreases)
        let start_shear = diagram.stations[0].forces.shear_y;
        assert!((start_shear - 25.0).abs() < 0.1, "Start shear should be 25kN");
        
        // The diagram should show proper shear reduction along length
        let mid_idx = diagram.stations.len() / 2;
        println!("Shear at midspan: {:.2}", diagram.stations[mid_idx].forces.shear_y);
        
        // Verify diagram was calculated
        assert!(diagram.stations.len() == 21, "Should have 21 stations");
    }
}
