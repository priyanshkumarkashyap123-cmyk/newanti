// ============================================================================
// TENSILE STRUCTURES - Phase 21
// Cable nets, membrane structures, form-finding
// Standards: ASCE/SEI 55, Eurocode 3 Part 1-11, MSAJ
// ============================================================================

use serde::{Deserialize, Serialize};
use std::f64::consts::PI;

// ============================================================================
// CABLE MATERIALS
// ============================================================================

/// Cable types
#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
pub enum CableType {
    /// Spiral strand
    SpiralStrand,
    /// Locked coil strand
    LockedCoil,
    /// Full locked coil
    FullLockedCoil,
    /// Wire rope
    WireRope,
    /// Parallel wire strand (PWS)
    ParallelWire,
    /// Parallel strand
    ParallelStrand,
    /// Carbon fiber cable
    CarbonFiber,
}

impl CableType {
    /// Fill factor (ratio of metallic area to nominal area)
    pub fn fill_factor(&self) -> f64 {
        match self {
            CableType::SpiralStrand => 0.75,
            CableType::LockedCoil => 0.85,
            CableType::FullLockedCoil => 0.90,
            CableType::WireRope => 0.58,
            CableType::ParallelWire => 0.85,
            CableType::ParallelStrand => 0.80,
            CableType::CarbonFiber => 0.60,
        }
    }
    
    /// Typical ultimate strength (MPa)
    pub fn ultimate_strength(&self) -> f64 {
        match self {
            CableType::SpiralStrand => 1570.0,
            CableType::LockedCoil => 1370.0,
            CableType::FullLockedCoil => 1370.0,
            CableType::WireRope => 1770.0,
            CableType::ParallelWire => 1670.0,
            CableType::ParallelStrand => 1860.0,
            CableType::CarbonFiber => 2400.0,
        }
    }
    
    /// Modulus of elasticity (GPa)
    pub fn modulus(&self) -> f64 {
        match self {
            CableType::SpiralStrand => 160.0,
            CableType::LockedCoil => 165.0,
            CableType::FullLockedCoil => 170.0,
            CableType::WireRope => 100.0,
            CableType::ParallelWire => 195.0,
            CableType::ParallelStrand => 195.0,
            CableType::CarbonFiber => 150.0,
        }
    }
}

/// Cable properties
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Cable {
    pub cable_type: CableType,
    /// Nominal diameter (mm)
    pub diameter: f64,
    /// Metallic area (mm²)
    pub area: f64,
    /// Breaking load (kN)
    pub breaking_load: f64,
    /// Weight (kg/m)
    pub weight: f64,
    /// Prestress (kN)
    pub prestress: f64,
}

impl Cable {
    pub fn new(cable_type: CableType, diameter: f64) -> Self {
        let nominal_area = PI * diameter.powi(2) / 4.0;
        let area = nominal_area * cable_type.fill_factor();
        let breaking_load = area * cable_type.ultimate_strength() / 1000.0;
        let weight = area * 7850.0 / 1e6; // kg/m
        
        Self {
            cable_type,
            diameter,
            area,
            breaking_load,
            weight,
            prestress: 0.0,
        }
    }
    
    /// With prestress
    pub fn with_prestress(mut self, prestress: f64) -> Self {
        self.prestress = prestress;
        self
    }
    
    /// Axial stiffness EA (kN)
    pub fn axial_stiffness(&self) -> f64 {
        self.area * self.cable_type.modulus() / 1000.0
    }
    
    /// Design strength with factor of safety
    pub fn design_capacity(&self, fos: f64) -> f64 {
        self.breaking_load / fos
    }
    
    /// Stress at given tension (MPa)
    pub fn stress(&self, tension: f64) -> f64 {
        tension * 1000.0 / self.area
    }
    
    /// Utilization ratio
    pub fn utilization(&self, tension: f64, fos: f64) -> f64 {
        tension / self.design_capacity(fos)
    }
}

// ============================================================================
// CABLE GEOMETRY
// ============================================================================

/// Catenary cable analysis
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CatenaryCable {
    /// Horizontal span (m)
    pub span: f64,
    /// Sag at midspan (m)
    pub sag: f64,
    /// Elevation difference (m)
    pub elevation_diff: f64,
    /// Distributed load (kN/m)
    pub load: f64,
    /// Cable properties
    pub cable: Cable,
}

impl CatenaryCable {
    pub fn new(span: f64, sag: f64, load: f64, cable: Cable) -> Self {
        Self {
            span,
            sag,
            elevation_diff: 0.0,
            load,
            cable,
        }
    }
    
    /// Horizontal tension component (kN)
    pub fn horizontal_tension(&self) -> f64 {
        // For parabolic approximation (uniform load)
        self.load * self.span.powi(2) / (8.0 * self.sag)
    }
    
    /// Maximum tension (at supports) (kN)
    pub fn max_tension(&self) -> f64 {
        let h = self.horizontal_tension();
        let v = self.load * self.span / 2.0;
        
        (h.powi(2) + v.powi(2)).sqrt()
    }
    
    /// Cable length (m)
    pub fn cable_length(&self) -> f64 {
        // Parabolic approximation
        self.span * (1.0 + 8.0 * (self.sag / self.span).powi(2) / 3.0)
    }
    
    /// Catenary parameter (m)
    pub fn catenary_parameter(&self) -> f64 {
        self.horizontal_tension() / self.load
    }
    
    /// Cable profile y(x) from left support
    pub fn profile(&self, x: f64) -> f64 {
        // Parabolic approximation
        4.0 * self.sag * x * (self.span - x) / self.span.powi(2)
    }
    
    /// Slope at position x (radians)
    pub fn slope(&self, x: f64) -> f64 {
        let dy_dx = 4.0 * self.sag * (self.span - 2.0 * x) / self.span.powi(2);
        dy_dx.atan()
    }
    
    /// Tension at position x (kN)
    pub fn tension_at(&self, x: f64) -> f64 {
        let h = self.horizontal_tension();
        let theta = self.slope(x);
        
        h / theta.cos()
    }
    
    /// Support reactions (kN)
    pub fn support_reactions(&self) -> (f64, f64, f64, f64) {
        let h = self.horizontal_tension();
        let v_left = self.load * self.span / 2.0 + self.elevation_diff * h / self.span;
        let v_right = self.load * self.span / 2.0 - self.elevation_diff * h / self.span;
        
        (h, v_left, h, v_right)
    }
    
    /// Elongation under load (m)
    pub fn elongation(&self) -> f64 {
        let t_avg = (self.horizontal_tension() + self.max_tension()) / 2.0;
        let l = self.cable_length();
        let ea = self.cable.axial_stiffness();
        
        t_avg * l / ea
    }
}

// ============================================================================
// CABLE NET
// ============================================================================

/// Cable net configuration
#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
pub enum CableNetType {
    /// Saddle shape (anticlastic)
    Saddle,
    /// Ridge and valley
    RidgeValley,
    /// Radial
    Radial,
    /// Orthogonal grid
    Orthogonal,
}

/// Cable net structure
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CableNet {
    /// Net type
    pub net_type: CableNetType,
    /// Span in X direction (m)
    pub span_x: f64,
    /// Span in Y direction (m)
    pub span_y: f64,
    /// Number of cables in X
    pub nx: usize,
    /// Number of cables in Y
    pub ny: usize,
    /// Sag in X direction (m)
    pub sag_x: f64,
    /// Sag in Y direction (m) - negative for anticlastic
    pub sag_y: f64,
    /// Cable in X direction
    pub cable_x: Cable,
    /// Cable in Y direction
    pub cable_y: Cable,
    /// Surface load (kN/m²)
    pub surface_load: f64,
}

impl CableNet {
    pub fn saddle(
        span_x: f64, span_y: f64,
        nx: usize, ny: usize,
        sag_x: f64, sag_y: f64,
        cable: Cable,
    ) -> Self {
        Self {
            net_type: CableNetType::Saddle,
            span_x, span_y,
            nx, ny,
            sag_x,
            sag_y: -sag_y.abs(), // Negative for anticlastic
            cable_x: cable.clone(),
            cable_y: cable,
            surface_load: 0.5,
        }
    }
    
    /// Cable spacing in X (m)
    pub fn spacing_x(&self) -> f64 {
        self.span_y / (self.nx - 1) as f64
    }
    
    /// Cable spacing in Y (m)
    pub fn spacing_y(&self) -> f64 {
        self.span_x / (self.ny - 1) as f64
    }
    
    /// Tributary area per node (m²)
    pub fn tributary_area(&self) -> f64 {
        self.spacing_x() * self.spacing_y()
    }
    
    /// Load per cable X (kN/m)
    pub fn load_per_cable_x(&self) -> f64 {
        self.surface_load * self.spacing_x()
    }
    
    /// Load per cable Y (kN/m)
    pub fn load_per_cable_y(&self) -> f64 {
        self.surface_load * self.spacing_y()
    }
    
    /// Horizontal tension in X cables (kN)
    pub fn tension_x(&self) -> f64 {
        let w = self.load_per_cable_x();
        w * self.span_x.powi(2) / (8.0 * self.sag_x.abs())
    }
    
    /// Horizontal tension in Y cables (kN)
    pub fn tension_y(&self) -> f64 {
        let w = self.load_per_cable_y();
        w * self.span_y.powi(2) / (8.0 * self.sag_y.abs())
    }
    
    /// Prestress ratio (T_y/T_x)
    pub fn prestress_ratio(&self) -> f64 {
        self.tension_y() / self.tension_x()
    }
    
    /// Gaussian curvature (negative for anticlastic)
    pub fn gaussian_curvature(&self) -> f64 {
        // K = k1 * k2 where ki = 8*sag/span²
        let k1 = 8.0 * self.sag_x / self.span_x.powi(2);
        let k2 = 8.0 * self.sag_y / self.span_y.powi(2);
        
        k1 * k2
    }
    
    /// Total cable length in X direction (m)
    pub fn total_length_x(&self) -> f64 {
        let l_single = self.span_x * (1.0 + 8.0 * (self.sag_x / self.span_x).powi(2) / 3.0);
        l_single * self.nx as f64
    }
    
    /// Total cable length in Y direction (m)
    pub fn total_length_y(&self) -> f64 {
        let l_single = self.span_y * (1.0 + 8.0 * (self.sag_y / self.span_y).powi(2) / 3.0);
        l_single * self.ny as f64
    }
    
    /// Edge cable tension (kN)
    pub fn edge_tension(&self) -> f64 {
        // Edge cables carry sum of internal tensions
        (self.tension_x().powi(2) + self.tension_y().powi(2)).sqrt() * 1.5
    }
}

// ============================================================================
// MEMBRANE STRUCTURES
// ============================================================================

/// Membrane material types
#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
pub enum MembraneMaterial {
    /// PVC coated polyester
    PvcPolyester,
    /// PTFE coated fiberglass
    PtfeGlass,
    /// Silicone coated fiberglass
    SiliconeGlass,
    /// ETFE foil
    Etfe,
    /// PVC mesh
    PvcMesh,
}

impl MembraneMaterial {
    /// Tensile strength (kN/m)
    pub fn tensile_strength(&self) -> f64 {
        match self {
            MembraneMaterial::PvcPolyester => 80.0,
            MembraneMaterial::PtfeGlass => 120.0,
            MembraneMaterial::SiliconeGlass => 100.0,
            MembraneMaterial::Etfe => 40.0,
            MembraneMaterial::PvcMesh => 50.0,
        }
    }
    
    /// Stiffness (kN/m)
    pub fn stiffness(&self) -> f64 {
        match self {
            MembraneMaterial::PvcPolyester => 600.0,
            MembraneMaterial::PtfeGlass => 1500.0,
            MembraneMaterial::SiliconeGlass => 1200.0,
            MembraneMaterial::Etfe => 200.0,
            MembraneMaterial::PvcMesh => 400.0,
        }
    }
    
    /// Weight (kg/m²)
    pub fn weight(&self) -> f64 {
        match self {
            MembraneMaterial::PvcPolyester => 0.9,
            MembraneMaterial::PtfeGlass => 1.5,
            MembraneMaterial::SiliconeGlass => 1.3,
            MembraneMaterial::Etfe => 0.35,
            MembraneMaterial::PvcMesh => 0.5,
        }
    }
    
    /// Lifespan (years)
    pub fn lifespan(&self) -> f64 {
        match self {
            MembraneMaterial::PvcPolyester => 15.0,
            MembraneMaterial::PtfeGlass => 35.0,
            MembraneMaterial::SiliconeGlass => 30.0,
            MembraneMaterial::Etfe => 30.0,
            MembraneMaterial::PvcMesh => 10.0,
        }
    }
    
    /// Light transmission (%)
    pub fn light_transmission(&self) -> f64 {
        match self {
            MembraneMaterial::PvcPolyester => 15.0,
            MembraneMaterial::PtfeGlass => 15.0,
            MembraneMaterial::SiliconeGlass => 20.0,
            MembraneMaterial::Etfe => 95.0,
            MembraneMaterial::PvcMesh => 30.0,
        }
    }
}

/// Membrane structure
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MembraneStructure {
    /// Material
    pub material: MembraneMaterial,
    /// Span in warp direction (m)
    pub span_warp: f64,
    /// Span in weft direction (m)
    pub span_weft: f64,
    /// Prestress in warp (kN/m)
    pub prestress_warp: f64,
    /// Prestress in weft (kN/m)
    pub prestress_weft: f64,
    /// Curvature radius warp (m)
    pub radius_warp: f64,
    /// Curvature radius weft (m)
    pub radius_weft: f64,
}

impl MembraneStructure {
    pub fn new(
        material: MembraneMaterial,
        span_warp: f64, span_weft: f64,
        prestress: f64,
    ) -> Self {
        // Assume hyperbolic paraboloid with equal prestress
        let radius_warp = span_warp.powi(2) / (8.0 * span_warp * 0.1);
        let radius_weft = span_weft.powi(2) / (8.0 * span_weft * 0.1);
        
        Self {
            material,
            span_warp, span_weft,
            prestress_warp: prestress,
            prestress_weft: prestress,
            radius_warp,
            radius_weft: -radius_weft, // Anticlastic
        }
    }
    
    /// Surface area (m²)
    pub fn surface_area(&self) -> f64 {
        // Approximate for curved surface
        self.span_warp * self.span_weft * 1.1
    }
    
    /// Total membrane weight (kN)
    pub fn total_weight(&self) -> f64 {
        self.surface_area() * self.material.weight() * 9.81 / 1000.0
    }
    
    /// Stress under pressure (kN/m)
    pub fn stress_under_pressure(&self, pressure: f64) -> (f64, f64) {
        // Membrane equation: σ1/R1 + σ2/R2 = p
        // For anticlastic: σ1/R1 - σ2/|R2| = p
        
        // Simplified for similar curvatures
        let sigma_warp = self.prestress_warp + pressure * self.radius_warp.abs() / 2.0;
        let sigma_weft = self.prestress_weft + pressure * self.radius_weft.abs() / 2.0;
        
        (sigma_warp, sigma_weft)
    }
    
    /// Wind load on membrane (kN/m²)
    pub fn wind_pressure(&self, wind_speed: f64, cp: f64) -> f64 {
        0.5 * 1.225 * wind_speed.powi(2) * cp / 1000.0
    }
    
    /// Check membrane stress
    pub fn check_stress(&self, pressure: f64, fos: f64) -> bool {
        let (sigma_w, sigma_f) = self.stress_under_pressure(pressure);
        let allowable = self.material.tensile_strength() / fos;
        
        sigma_w <= allowable && sigma_f <= allowable
    }
    
    /// Ponding check (minimum slope)
    pub fn check_ponding(&self) -> bool {
        // Minimum curvature to prevent ponding
        let min_curvature = 0.02; // 2% slope minimum
        let actual_warp = self.span_warp / self.radius_warp.abs();
        let actual_weft = self.span_weft / self.radius_weft.abs();
        
        actual_warp >= min_curvature || actual_weft >= min_curvature
    }
    
    /// Flutter check (minimum prestress)
    pub fn check_flutter(&self, wind_speed: f64) -> bool {
        // Empirical flutter criterion
        let q = 0.5 * 1.225 * wind_speed.powi(2) / 1000.0; // kN/m²
        let min_prestress = 1.5 * q * self.span_warp.max(self.span_weft);
        
        self.prestress_warp >= min_prestress && self.prestress_weft >= min_prestress
    }
}

// ============================================================================
// FORM FINDING
// ============================================================================

/// Form finding method
#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
pub enum FormFindingMethod {
    /// Force density method
    ForceDensity,
    /// Dynamic relaxation
    DynamicRelaxation,
    /// Updated reference strategy
    UpdatedReference,
    /// Natural shapes
    NaturalShapes,
}

/// Form finding for cable net
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FormFinder {
    /// Method
    pub method: FormFindingMethod,
    /// Number of nodes
    pub n_nodes: usize,
    /// Node coordinates [x, y, z]
    pub nodes: Vec<[f64; 3]>,
    /// Element connectivity
    pub elements: Vec<[usize; 2]>,
    /// Force densities
    pub force_densities: Vec<f64>,
    /// Fixed node indices
    pub fixed_nodes: Vec<usize>,
    /// Tolerance
    pub tolerance: f64,
    /// Max iterations
    pub max_iterations: usize,
}

impl FormFinder {
    pub fn new(method: FormFindingMethod) -> Self {
        Self {
            method,
            n_nodes: 0,
            nodes: Vec::new(),
            elements: Vec::new(),
            force_densities: Vec::new(),
            fixed_nodes: Vec::new(),
            tolerance: 1e-6,
            max_iterations: 1000,
        }
    }
    
    /// Add node
    pub fn add_node(&mut self, x: f64, y: f64, z: f64) -> usize {
        self.nodes.push([x, y, z]);
        self.n_nodes += 1;
        self.n_nodes - 1
    }
    
    /// Add element with force density
    pub fn add_element(&mut self, n1: usize, n2: usize, force_density: f64) {
        self.elements.push([n1, n2]);
        self.force_densities.push(force_density);
    }
    
    /// Fix node
    pub fn fix_node(&mut self, idx: usize) {
        if !self.fixed_nodes.contains(&idx) {
            self.fixed_nodes.push(idx);
        }
    }
    
    /// Element length
    pub fn element_length(&self, elem_idx: usize) -> f64 {
        let [n1, n2] = self.elements[elem_idx];
        let p1 = self.nodes[n1];
        let p2 = self.nodes[n2];
        
        ((p2[0] - p1[0]).powi(2) + (p2[1] - p1[1]).powi(2) + (p2[2] - p1[2]).powi(2)).sqrt()
    }
    
    /// Solve using force density method
    pub fn solve_force_density(&mut self) -> bool {
        // Force density method for minimal surface
        // Equilibrium: [D_f * C^T * C] * z = [D_f * C^T * C_f] * z_f
        
        // Simplified iterative approach
        let n_free = self.n_nodes - self.fixed_nodes.len();
        
        if n_free == 0 {
            return true;
        }
        
        for _iter in 0..self.max_iterations {
            let mut max_change: f64 = 0.0;
            
            for node_idx in 0..self.n_nodes {
                if self.fixed_nodes.contains(&node_idx) {
                    continue;
                }
                
                let mut sum_q: f64 = 0.0;
                let mut sum_qx: f64 = 0.0;
                let mut sum_qy: f64 = 0.0;
                let mut sum_qz: f64 = 0.0;
                
                // Find connected elements
                for (elem_idx, elem) in self.elements.iter().enumerate() {
                    if elem[0] != node_idx && elem[1] != node_idx {
                        continue;
                    }
                    
                    let q = self.force_densities[elem_idx];
                    let other_idx = if elem[0] == node_idx { elem[1] } else { elem[0] };
                    let other = self.nodes[other_idx];
                    
                    sum_q += q;
                    sum_qx += q * other[0];
                    sum_qy += q * other[1];
                    sum_qz += q * other[2];
                }
                
                if sum_q > 1e-10 {
                    let new_x = sum_qx / sum_q;
                    let new_y = sum_qy / sum_q;
                    let new_z = sum_qz / sum_q;
                    
                    let change = ((new_x - self.nodes[node_idx][0]).powi(2)
                        + (new_y - self.nodes[node_idx][1]).powi(2)
                        + (new_z - self.nodes[node_idx][2]).powi(2)).sqrt();
                    
                    max_change = max_change.max(change);
                    
                    self.nodes[node_idx] = [new_x, new_y, new_z];
                }
            }
            
            if max_change < self.tolerance {
                return true;
            }
        }
        
        false
    }
    
    /// Get resulting element tensions
    pub fn get_tensions(&self) -> Vec<f64> {
        self.elements.iter()
            .enumerate()
            .map(|(i, _)| self.force_densities[i] * self.element_length(i))
            .collect()
    }
}

// ============================================================================
// TESTS
// ============================================================================

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_cable() {
        let cable = Cable::new(CableType::SpiralStrand, 50.0);
        
        assert!(cable.area > 1000.0);
        assert!(cable.breaking_load > 1000.0);
        assert!(cable.weight > 5.0);
    }

    #[test]
    fn test_cable_stiffness() {
        let cable = Cable::new(CableType::ParallelStrand, 60.0);
        
        let ea = cable.axial_stiffness();
        assert!(ea > 400.0); // EA should be > 400 kN for 60mm parallel strand
    }

    #[test]
    fn test_catenary() {
        let cable = Cable::new(CableType::SpiralStrand, 40.0);
        let catenary = CatenaryCable::new(100.0, 10.0, 5.0, cable);
        
        let h = catenary.horizontal_tension();
        assert!(h > 500.0);
        
        let t_max = catenary.max_tension();
        assert!(t_max > h);
    }

    #[test]
    fn test_catenary_length() {
        let cable = Cable::new(CableType::LockedCoil, 30.0);
        let catenary = CatenaryCable::new(80.0, 8.0, 3.0, cable);
        
        let length = catenary.cable_length();
        assert!(length > 80.0);
        assert!(length < 90.0);
    }

    #[test]
    fn test_catenary_profile() {
        let cable = Cable::new(CableType::WireRope, 25.0);
        let catenary = CatenaryCable::new(50.0, 5.0, 2.0, cable);
        
        let y_mid = catenary.profile(25.0);
        assert!((y_mid - 5.0).abs() < 0.1);
        
        let y_support = catenary.profile(0.0);
        assert!(y_support.abs() < 0.01);
    }

    #[test]
    fn test_cable_net() {
        let cable = Cable::new(CableType::SpiralStrand, 30.0);
        let net = CableNet::saddle(40.0, 30.0, 10, 8, 4.0, 3.0, cable);
        
        let tx = net.tension_x();
        let ty = net.tension_y();
        
        assert!(tx > 0.0);
        assert!(ty > 0.0);
    }

    #[test]
    fn test_cable_net_curvature() {
        let cable = Cable::new(CableType::LockedCoil, 25.0);
        let net = CableNet::saddle(50.0, 40.0, 12, 10, 5.0, 4.0, cable);
        
        let k = net.gaussian_curvature();
        assert!(k < 0.0); // Anticlastic = negative Gaussian curvature
    }

    #[test]
    fn test_membrane_material() {
        let ptfe = MembraneMaterial::PtfeGlass;
        let pvc = MembraneMaterial::PvcPolyester;
        
        assert!(ptfe.tensile_strength() > pvc.tensile_strength());
        assert!(ptfe.lifespan() > pvc.lifespan());
    }

    #[test]
    fn test_membrane_structure() {
        let membrane = MembraneStructure::new(
            MembraneMaterial::PtfeGlass,
            30.0, 25.0, 3.0,
        );
        
        let area = membrane.surface_area();
        assert!(area > 750.0);
        
        let (sw, sf) = membrane.stress_under_pressure(1.0);
        assert!(sw > membrane.prestress_warp);
        assert!(sf > membrane.prestress_weft);
    }

    #[test]
    fn test_membrane_check() {
        let membrane = MembraneStructure::new(
            MembraneMaterial::PvcPolyester,
            20.0, 15.0, 2.0,
        );
        
        let passes = membrane.check_stress(0.5, 3.0);
        assert!(passes);
    }

    #[test]
    fn test_form_finder() {
        let mut finder = FormFinder::new(FormFindingMethod::ForceDensity);
        
        // Simple 4-node net
        finder.add_node(0.0, 0.0, 0.0);
        finder.add_node(10.0, 0.0, 0.0);
        finder.add_node(10.0, 10.0, 0.0);
        finder.add_node(0.0, 10.0, 0.0);
        finder.add_node(5.0, 5.0, -2.0); // Center free
        
        finder.fix_node(0);
        finder.fix_node(1);
        finder.fix_node(2);
        finder.fix_node(3);
        
        finder.add_element(0, 4, 1.0);
        finder.add_element(1, 4, 1.0);
        finder.add_element(2, 4, 1.0);
        finder.add_element(3, 4, 1.0);
        
        let converged = finder.solve_force_density();
        assert!(converged);
    }

    #[test]
    fn test_etfe() {
        let etfe = MembraneMaterial::Etfe;
        
        assert!(etfe.light_transmission() > 90.0);
        assert!(etfe.weight() < 0.5);
    }
}
