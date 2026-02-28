// ============================================================================
// CABLE-STAYED & SUSPENSION BRIDGE ANALYSIS MODULE
// Nonlinear cable analysis, form-finding, and staged construction
// ============================================================================

use serde::{Deserialize, Serialize};

// ============================================================================
// CABLE ELEMENT TYPES
// ============================================================================

/// Cable element types for bridge analysis
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum CableType {
    /// Straight cable (elastic catenary)
    Straight,
    /// Catenary cable (geometric nonlinearity)
    Catenary,
    /// Parabolic cable (uniform load approximation)
    Parabolic,
    /// Ernst equivalent modulus cable
    ErnstEquivalent,
}

/// Cable material properties
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CableMaterial {
    /// Modulus of elasticity (MPa)
    pub e: f64,
    /// Unit weight (kN/m³)
    pub gamma: f64,
    /// Ultimate tensile strength (MPa)
    pub fu: f64,
    /// Yield strength (MPa)
    pub fy: f64,
    /// Material type
    pub material_type: CableMaterialType,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum CableMaterialType {
    /// Parallel wire strand
    ParallelWire,
    /// Locked coil strand
    LockedCoil,
    /// Spiral strand
    SpiralStrand,
    /// Seven-wire strand
    SevenWireStrand,
}

impl CableMaterial {
    /// Standard parallel wire strand
    pub fn parallel_wire() -> Self {
        Self {
            e: 200_000.0,
            gamma: 78.5,
            fu: 1770.0,
            fy: 1570.0,
            material_type: CableMaterialType::ParallelWire,
        }
    }
    
    /// Standard locked coil strand
    pub fn locked_coil() -> Self {
        Self {
            e: 160_000.0,
            gamma: 83.0,
            fu: 1570.0,
            fy: 1370.0,
            material_type: CableMaterialType::LockedCoil,
        }
    }
    
    /// Seven-wire prestressing strand
    pub fn seven_wire_strand() -> Self {
        Self {
            e: 195_000.0,
            gamma: 78.5,
            fu: 1860.0,
            fy: 1670.0,
            material_type: CableMaterialType::SevenWireStrand,
        }
    }
}

// ============================================================================
// CABLE ELEMENT
// ============================================================================

/// Single cable element for bridge analysis
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CableElement {
    /// Element ID
    pub id: usize,
    /// Start node coordinates [x, y, z]
    pub start_node: [f64; 3],
    /// End node coordinates [x, y, z]
    pub end_node: [f64; 3],
    /// Cross-sectional area (mm²)
    pub area: f64,
    /// Cable material
    pub material: CableMaterial,
    /// Cable type
    pub cable_type: CableType,
    /// Pretension force (kN)
    pub pretension: f64,
    /// Unstressed length (m) - 0 means auto-calculate
    pub unstressed_length: f64,
}

impl CableElement {
    pub fn new(
        id: usize,
        start: [f64; 3],
        end: [f64; 3],
        area: f64,
        material: CableMaterial,
    ) -> Self {
        Self {
            id,
            start_node: start,
            end_node: end,
            area,
            material,
            cable_type: CableType::Catenary,
            pretension: 0.0,
            unstressed_length: 0.0,
        }
    }
    
    /// Chord length (m)
    pub fn chord_length(&self) -> f64 {
        let dx = self.end_node[0] - self.start_node[0];
        let dy = self.end_node[1] - self.start_node[1];
        let dz = self.end_node[2] - self.start_node[2];
        (dx * dx + dy * dy + dz * dz).sqrt()
    }
    
    /// Horizontal projection (m)
    pub fn horizontal_length(&self) -> f64 {
        let dx = self.end_node[0] - self.start_node[0];
        let dz = self.end_node[2] - self.start_node[2];
        (dx * dx + dz * dz).sqrt()
    }
    
    /// Vertical difference (m)
    pub fn vertical_difference(&self) -> f64 {
        (self.end_node[1] - self.start_node[1]).abs()
    }
    
    /// Cable inclination angle (radians)
    pub fn inclination(&self) -> f64 {
        let h = self.horizontal_length();
        let v = self.vertical_difference();
        v.atan2(h)
    }
    
    /// Self-weight per unit length (kN/m)
    pub fn unit_weight(&self) -> f64 {
        self.material.gamma * self.area / 1e6 // mm² to m²
    }
    
    /// Ernst equivalent modulus considering sag
    pub fn ernst_modulus(&self, tension: f64) -> f64 {
        let e = self.material.e;
        let l = self.horizontal_length();
        let sigma = tension * 1000.0 / self.area; // MPa
        
        // Ernst formula: E_eq = E / (1 + γ²·L²·E / (12·σ³))
        // where γ is specific weight (force/volume), not weight per length.
        // γ[kN/m³] × L[m] gives kN/m² = 10⁻³ MPa
        // So γ·L in MPa = gamma × l / 1000
        let gamma_l = self.material.gamma * l / 1000.0; // MPa units
        let lambda = gamma_l.powi(2) * e / (12.0 * sigma.powi(3));
        e / (1.0 + lambda)
    }
    
    /// Catenary length for given horizontal tension
    pub fn catenary_length(&self, h_tension: f64) -> f64 {
        let w = self.unit_weight();
        let l_h = self.horizontal_length();
        let dv = self.vertical_difference();
        
        if h_tension <= 0.0 || w <= 0.0 {
            return self.chord_length();
        }
        
        // Catenary parameter
        let c = h_tension / w;
        
        // Catenary length formula
        let l1 = c * ((dv / (2.0 * c) + ((l_h / (2.0 * c)).sinh().powi(2) + 1.0).sqrt()).asinh());
        let l2 = c * ((-dv / (2.0 * c) + ((l_h / (2.0 * c)).sinh().powi(2) + 1.0).sqrt()).asinh());
        
        l1 + l2
    }
    
    /// Sag at mid-span for parabolic approximation
    pub fn parabolic_sag(&self, tension: f64) -> f64 {
        let w = self.unit_weight();
        let l = self.horizontal_length();
        w * l.powi(2) / (8.0 * tension)
    }
    
    /// Axial stiffness (kN/m)
    pub fn axial_stiffness(&self) -> f64 {
        let e = self.material.e * 1000.0; // MPa to kPa
        let a = self.area / 1e6; // mm² to m²
        let l = self.chord_length();
        e * a / l
    }
    
    /// Tangent stiffness matrix (6x6 local)
    pub fn tangent_stiffness(&self, tension: f64) -> [[f64; 6]; 6] {
        let l = self.chord_length();
        let e_eq = self.ernst_modulus(tension);
        let a = self.area / 1e6;
        let ea_l = e_eq * 1000.0 * a / l;
        
        // Direction cosines
        let dx = self.end_node[0] - self.start_node[0];
        let dy = self.end_node[1] - self.start_node[1];
        let dz = self.end_node[2] - self.start_node[2];
        let cx = dx / l;
        let cy = dy / l;
        let cz = dz / l;
        
        // Elastic stiffness
        let k_e = ea_l;
        
        // Geometric stiffness (tension)
        let k_g = if l > 0.0 { tension / l } else { 0.0 };
        
        let mut k = [[0.0; 6]; 6];
        
        // Elastic part
        k[0][0] = k_e * cx * cx + k_g;
        k[0][1] = k_e * cx * cy;
        k[0][2] = k_e * cx * cz;
        k[1][1] = k_e * cy * cy + k_g;
        k[1][2] = k_e * cy * cz;
        k[2][2] = k_e * cz * cz + k_g;
        
        // Symmetric
        k[1][0] = k[0][1];
        k[2][0] = k[0][2];
        k[2][1] = k[1][2];
        
        // End 2 (negative)
        k[3][3] = k[0][0];
        k[3][4] = k[0][1];
        k[3][5] = k[0][2];
        k[4][4] = k[1][1];
        k[4][5] = k[1][2];
        k[5][5] = k[2][2];
        
        k[4][3] = k[3][4];
        k[5][3] = k[3][5];
        k[5][4] = k[4][5];
        
        // Coupling (negative)
        for i in 0..3 {
            for j in 0..3 {
                k[i][j + 3] = -k[i][j];
                k[i + 3][j] = -k[i][j];
            }
        }
        
        k
    }
    
    /// Check cable tension against capacity
    pub fn check_tension(&self, tension: f64, safety_factor: f64) -> TensionCheck {
        let capacity = self.material.fu * self.area / 1000.0; // kN
        let allowable = capacity / safety_factor;
        let utilization = tension / allowable;
        
        TensionCheck {
            tension,
            capacity,
            allowable,
            utilization,
            pass: utilization <= 1.0,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TensionCheck {
    pub tension: f64,
    pub capacity: f64,
    pub allowable: f64,
    pub utilization: f64,
    pub pass: bool,
}

// ============================================================================
// CABLE-STAYED BRIDGE MODEL
// ============================================================================

/// Tower configuration
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum TowerType {
    /// A-frame tower
    AFrame,
    /// H-frame tower
    HFrame,
    /// Diamond tower
    Diamond,
    /// Inverted Y tower
    InvertedY,
    /// Single pylon
    SinglePylon,
}

/// Cable arrangement pattern
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum CableArrangement {
    /// Fan arrangement (all cables from single point)
    Fan,
    /// Harp arrangement (parallel cables)
    Harp,
    /// Semi-fan (hybrid)
    SemiFan,
    /// Star arrangement
    Star,
}

/// Cable-stayed bridge model
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CableStayedBridge {
    /// Bridge name
    pub name: String,
    /// Main span length (m)
    pub main_span: f64,
    /// Side span length (m)
    pub side_span: f64,
    /// Deck width (m)
    pub deck_width: f64,
    /// Tower height above deck (m)
    pub tower_height: f64,
    /// Tower type
    pub tower_type: TowerType,
    /// Cable arrangement
    pub cable_arrangement: CableArrangement,
    /// Cable elements
    pub cables: Vec<CableElement>,
    /// Number of cable pairs per side
    pub num_cable_pairs: u32,
}

impl CableStayedBridge {
    pub fn new(name: &str, main_span: f64, side_span: f64) -> Self {
        Self {
            name: name.to_string(),
            main_span,
            side_span,
            deck_width: 20.0,
            tower_height: main_span * 0.2,
            tower_type: TowerType::HFrame,
            cable_arrangement: CableArrangement::SemiFan,
            cables: Vec::new(),
            num_cable_pairs: 10,
        }
    }
    
    /// Total bridge length
    pub fn total_length(&self) -> f64 {
        2.0 * self.side_span + self.main_span
    }
    
    /// Generate cable geometry for semi-fan arrangement
    pub fn generate_semi_fan_cables(&mut self, cable_area: f64, material: CableMaterial) {
        self.cables.clear();
        
        let n = self.num_cable_pairs as usize;
        let tower_x = self.side_span;
        let tower_top = self.tower_height;
        
        // Cable spacing on deck
        let main_spacing = (self.main_span / 2.0) / (n as f64);
        let side_spacing = self.side_span / (n as f64);
        
        // Cable anchor spread at tower (semi-fan)
        let anchor_spread = self.tower_height * 0.3;
        let anchor_start = tower_top - anchor_spread / 2.0;
        let anchor_spacing = anchor_spread / (n as f64);
        
        let mut id = 1;
        
        // Main span cables (right side)
        for i in 1..=n {
            let deck_x = tower_x + (i as f64) * main_spacing;
            let anchor_y = anchor_start + (i as f64) * anchor_spacing;
            
            self.cables.push(CableElement::new(
                id,
                [tower_x, anchor_y, 0.0],
                [deck_x, 0.0, 0.0],
                cable_area,
                material.clone(),
            ));
            id += 1;
        }
        
        // Side span cables (left side)
        for i in 1..=n {
            let deck_x = tower_x - (i as f64) * side_spacing;
            let anchor_y = anchor_start + (i as f64) * anchor_spacing;
            
            self.cables.push(CableElement::new(
                id,
                [tower_x, anchor_y, 0.0],
                [deck_x, 0.0, 0.0],
                cable_area,
                material.clone(),
            ));
            id += 1;
        }
    }
    
    /// Estimate initial cable tensions for dead load
    pub fn estimate_initial_tensions(&self, deck_weight_per_m: f64) -> Vec<f64> {
        let mut tensions = Vec::new();
        
        for cable in &self.cables {
            let l_h = cable.horizontal_length();
            let angle = cable.inclination();
            
            // Tributary load on cable
            let tributary = l_h * deck_weight_per_m;
            
            // Tension = V / sin(angle)
            let tension = if angle.sin().abs() > 0.1 {
                tributary / angle.sin()
            } else {
                tributary * 10.0 // Shallow cable
            };
            
            tensions.push(tension.abs());
        }
        
        tensions
    }
    
    /// Check all cables
    pub fn check_all_cables(&self, tensions: &[f64], safety_factor: f64) -> Vec<TensionCheck> {
        self.cables
            .iter()
            .zip(tensions.iter())
            .map(|(cable, &t)| cable.check_tension(t, safety_factor))
            .collect()
    }
}

// ============================================================================
// SUSPENSION BRIDGE MODEL
// ============================================================================

/// Suspension bridge model
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SuspensionBridge {
    /// Bridge name
    pub name: String,
    /// Main span length (m)
    pub main_span: f64,
    /// Side span length (m)
    pub side_span: f64,
    /// Tower height above deck (m)
    pub tower_height: f64,
    /// Main cable sag (m)
    pub cable_sag: f64,
    /// Main cable area (mm²)
    pub cable_area: f64,
    /// Hanger spacing (m)
    pub hanger_spacing: f64,
    /// Deck weight per unit length (kN/m)
    pub deck_weight: f64,
}

impl SuspensionBridge {
    pub fn new(name: &str, main_span: f64) -> Self {
        let sag = main_span / 10.0; // Typical sag ratio 1:10
        
        Self {
            name: name.to_string(),
            main_span,
            side_span: main_span * 0.4,
            tower_height: sag * 1.5,
            cable_sag: sag,
            cable_area: 50000.0, // Large cable
            hanger_spacing: 10.0,
            deck_weight: 200.0,
        }
    }
    
    /// Horizontal tension in main cable
    pub fn horizontal_tension(&self) -> f64 {
        // H = w * L² / (8 * f)
        self.deck_weight * self.main_span.powi(2) / (8.0 * self.cable_sag)
    }
    
    /// Maximum cable tension (at tower)
    pub fn max_tension(&self) -> f64 {
        let h = self.horizontal_tension();
        let v = self.deck_weight * self.main_span / 2.0;
        (h * h + v * v).sqrt()
    }
    
    /// Cable length (parabolic approximation)
    pub fn cable_length(&self) -> f64 {
        let l = self.main_span;
        let f = self.cable_sag;
        
        // Parabolic arc length approximation
        l * (1.0 + 8.0 * (f / l).powi(2) / 3.0)
    }
    
    /// Cable profile y(x) from left tower
    pub fn cable_profile(&self, x: f64) -> f64 {
        // Parabolic profile: y = 4f * x * (L - x) / L²
        let l = self.main_span;
        let f = self.cable_sag;
        4.0 * f * x * (l - x) / l.powi(2)
    }
    
    /// Number of hangers in main span
    pub fn num_hangers(&self) -> u32 {
        (self.main_span / self.hanger_spacing).floor() as u32 - 1
    }
    
    /// Hanger force at position x
    pub fn hanger_force(&self, _x: f64) -> f64 {
        // For uniform load, all hangers have same force
        self.deck_weight * self.hanger_spacing
    }
    
    /// Cable stress
    pub fn cable_stress(&self) -> f64 {
        self.max_tension() * 1000.0 / self.cable_area // MPa
    }
}

// ============================================================================
// FORM FINDING
// ============================================================================

/// Cable form-finding method
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum FormFindingMethod {
    /// Force density method
    ForceDensity,
    /// Dynamic relaxation
    DynamicRelaxation,
    /// Initial stress method
    InitialStress,
    /// Catenary iteration
    CatenaryIteration,
}

/// Form finding for cable structures
pub struct CableFormFinding {
    pub method: FormFindingMethod,
    pub tolerance: f64,
    pub max_iterations: u32,
}

impl CableFormFinding {
    pub fn new(method: FormFindingMethod) -> Self {
        Self {
            method,
            tolerance: 1e-6,
            max_iterations: 100,
        }
    }
    
    /// Force density form finding
    pub fn force_density_solve(
        &self,
        nodes: &[[f64; 3]],
        cables: &[(usize, usize)],
        force_densities: &[f64],
        fixed_nodes: &[usize],
        loads: &[[f64; 3]],
    ) -> Vec<[f64; 3]> {
        let n = nodes.len();
        let mut coords = nodes.to_vec();
        
        // Iterative solver (simplified)
        for _ in 0..self.max_iterations {
            let mut new_coords = coords.clone();
            
            for (i, _node) in coords.iter().enumerate() {
                if fixed_nodes.contains(&i) {
                    continue;
                }
                
                let mut sum_q = 0.0;
                let mut sum_qx = [0.0; 3];
                
                // Sum contributions from connected cables
                for (j, &(n1, n2)) in cables.iter().enumerate() {
                    let other = if n1 == i {
                        n2
                    } else if n2 == i {
                        n1
                    } else {
                        continue;
                    };
                    
                    let q = force_densities[j];
                    sum_q += q;
                    
                    for k in 0..3 {
                        sum_qx[k] += q * coords[other][k];
                    }
                }
                
                // Update coordinates
                if sum_q.abs() > 1e-10 {
                    for k in 0..3 {
                        new_coords[i][k] = (sum_qx[k] + loads[i][k]) / sum_q;
                    }
                }
            }
            
            // Check convergence
            let mut max_diff = 0.0;
            for i in 0..n {
                for k in 0..3 {
                    let diff = (new_coords[i][k] - coords[i][k]).abs();
                    if diff > max_diff {
                        max_diff = diff;
                    }
                }
            }
            
            coords = new_coords;
            
            if max_diff < self.tolerance {
                break;
            }
        }
        
        coords
    }
}

impl Default for CableFormFinding {
    fn default() -> Self {
        Self::new(FormFindingMethod::ForceDensity)
    }
}

// ============================================================================
// TESTS
// ============================================================================

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_cable_material() {
        let mat = CableMaterial::parallel_wire();
        assert_eq!(mat.e, 200_000.0);
        assert_eq!(mat.fu, 1770.0);
    }

    #[test]
    fn test_cable_element() {
        let mat = CableMaterial::parallel_wire();
        let cable = CableElement::new(
            1,
            [0.0, 100.0, 0.0],
            [50.0, 0.0, 0.0],
            5000.0,
            mat,
        );
        
        let chord = cable.chord_length();
        assert!((chord - 111.8).abs() < 1.0); // sqrt(50² + 100²)
    }

    #[test]
    fn test_cable_inclination() {
        let mat = CableMaterial::parallel_wire();
        let cable = CableElement::new(
            1,
            [0.0, 50.0, 0.0],
            [50.0, 0.0, 0.0],
            5000.0,
            mat,
        );
        
        let angle = cable.inclination().to_degrees();
        assert!((angle - 45.0).abs() < 1.0);
    }

    #[test]
    fn test_ernst_modulus() {
        let mat = CableMaterial::parallel_wire();
        let cable = CableElement::new(
            1,
            [0.0, 100.0, 0.0],
            [200.0, 0.0, 0.0],
            5000.0,
            mat,
        );
        
        let e_eq = cable.ernst_modulus(1000.0);
        // Ernst modulus should be less than original E (sag effect)
        assert!(e_eq < cable.material.e);
        // Should still be a positive, reasonable value
        assert!(e_eq > 0.0);
    }

    #[test]
    fn test_tension_check() {
        let mat = CableMaterial::parallel_wire();
        let cable = CableElement::new(
            1,
            [0.0, 50.0, 0.0],
            [100.0, 0.0, 0.0],
            5000.0,
            mat,
        );
        
        let check = cable.check_tension(3000.0, 2.5);
        assert!(check.capacity > 0.0);
        assert!(check.utilization > 0.0);
    }

    #[test]
    fn test_cable_stayed_bridge() {
        let mut bridge = CableStayedBridge::new("Test Bridge", 400.0, 150.0);
        
        assert_eq!(bridge.total_length(), 700.0);
        assert_eq!(bridge.tower_height, 80.0);
    }

    #[test]
    fn test_generate_cables() {
        let mut bridge = CableStayedBridge::new("Test", 300.0, 100.0);
        bridge.num_cable_pairs = 5;
        bridge.generate_semi_fan_cables(3000.0, CableMaterial::parallel_wire());
        
        assert_eq!(bridge.cables.len(), 10); // 5 main + 5 side
    }

    #[test]
    fn test_initial_tensions() {
        let mut bridge = CableStayedBridge::new("Test", 300.0, 100.0);
        bridge.num_cable_pairs = 5;
        bridge.generate_semi_fan_cables(3000.0, CableMaterial::parallel_wire());
        
        let tensions = bridge.estimate_initial_tensions(100.0);
        assert_eq!(tensions.len(), 10);
        assert!(tensions.iter().all(|&t| t > 0.0));
    }

    #[test]
    fn test_suspension_bridge() {
        let bridge = SuspensionBridge::new("Golden Gate", 1280.0);
        
        assert_eq!(bridge.cable_sag, 128.0);
        assert!(bridge.horizontal_tension() > 0.0);
    }

    #[test]
    fn test_suspension_tension() {
        let bridge = SuspensionBridge::new("Test", 500.0);
        
        let h = bridge.horizontal_tension();
        let t_max = bridge.max_tension();
        
        assert!(t_max > h);
    }

    #[test]
    fn test_cable_profile() {
        let bridge = SuspensionBridge::new("Test", 500.0);
        
        let y_mid = bridge.cable_profile(250.0);
        assert!((y_mid - bridge.cable_sag).abs() < 0.1);
        
        let y_end = bridge.cable_profile(0.0);
        assert!(y_end.abs() < 0.1);
    }

    #[test]
    fn test_cable_length() {
        let bridge = SuspensionBridge::new("Test", 500.0);
        let length = bridge.cable_length();
        
        // Length should be greater than span
        assert!(length > bridge.main_span);
    }

    #[test]
    fn test_form_finding() {
        let ff = CableFormFinding::new(FormFindingMethod::ForceDensity);
        
        let nodes = vec![
            [0.0, 0.0, 0.0],
            [50.0, -10.0, 0.0],
            [100.0, 0.0, 0.0],
        ];
        let cables = vec![(0, 1), (1, 2)];
        let force_densities = vec![1.0, 1.0];
        let fixed_nodes = vec![0, 2];
        let loads = vec![[0.0, 0.0, 0.0], [0.0, -10.0, 0.0], [0.0, 0.0, 0.0]];
        
        let result = ff.force_density_solve(&nodes, &cables, &force_densities, &fixed_nodes, &loads);
        
        assert_eq!(result.len(), 3);
        // Middle node should sag
        assert!(result[1][1] < 0.0);
    }

    #[test]
    fn test_parabolic_sag() {
        let mat = CableMaterial::parallel_wire();
        let cable = CableElement::new(
            1,
            [0.0, 0.0, 0.0],
            [100.0, 0.0, 0.0],
            5000.0,
            mat,
        );
        
        let sag = cable.parabolic_sag(500.0);
        assert!(sag > 0.0);
    }

    #[test]
    fn test_locked_coil_material() {
        let mat = CableMaterial::locked_coil();
        assert_eq!(mat.e, 160_000.0);
        assert!(mat.gamma > 78.0);
    }

    #[test]
    fn test_tangent_stiffness() {
        let mat = CableMaterial::parallel_wire();
        let cable = CableElement::new(
            1,
            [0.0, 50.0, 0.0],
            [50.0, 0.0, 0.0],
            5000.0,
            mat,
        );
        
        let k = cable.tangent_stiffness(1000.0);
        
        // Check diagonal terms are positive
        assert!(k[0][0] > 0.0);
        assert!(k[1][1] > 0.0);
        assert!(k[3][3] > 0.0);
    }
}
