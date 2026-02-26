//! Cable Element Module
//! 
//! Implements tension-only cable elements with geometric nonlinearity,
//! catenary sag effects, and large displacement analysis.
//! 
//! FEATURES:
//! - Tension-only behavior (no compression resistance)
//! - Geometric stiffness matrix (accounts for axial force effects)
//! - Catenary sag calculation for self-weight
//! - Iterative solution for cable shape under loading
//! - Effective modulus for pretensioned cables
//! - Temperature effects on cable tension
//! 
//! APPLICATIONS:
//! - Suspension bridges (main cables, hangers)
//! - Cable-stayed bridges
//! - Cable roofs and tensile structures
//! - Guy wires for towers
//! - Overhead transmission lines

use std::f64::consts::PI;

/// Material properties for cable
#[derive(Debug, Clone, Copy)]
pub struct CableMaterial {
    /// Young's modulus (Pa)
    pub elastic_modulus: f64,
    /// Cross-sectional area (m²)
    pub area: f64,
    /// Unit weight (N/m)
    pub unit_weight: f64,
    /// Coefficient of thermal expansion (1/°C)
    pub thermal_coeff: f64,
    /// Ultimate tensile strength (Pa)
    pub tensile_strength: f64,
}

impl CableMaterial {
    /// Create standard steel cable (Grade 1770 MPa)
    pub fn steel_cable(diameter_mm: f64) -> Self {
        let diameter = diameter_mm / 1000.0; // mm to m
        let area = PI * diameter * diameter / 4.0;
        
        Self {
            elastic_modulus: 165e9,  // 165 GPa for steel cable
            area,
            unit_weight: area * 7850.0 * 9.81, // ρ = 7850 kg/m³
            thermal_coeff: 12e-6,    // 12 × 10⁻⁶ /°C
            tensile_strength: 1770e6, // 1770 MPa
        }
    }
    
    /// Create CFRP (Carbon Fiber) cable
    pub fn cfrp_cable(diameter_mm: f64) -> Self {
        let diameter = diameter_mm / 1000.0;
        let area = PI * diameter * diameter / 4.0;
        
        Self {
            elastic_modulus: 150e9,  // 150 GPa
            area,
            unit_weight: area * 1600.0 * 9.81, // ρ = 1600 kg/m³ (much lighter)
            thermal_coeff: -0.5e-6,  // Negative expansion
            tensile_strength: 2500e6, // 2500 MPa
        }
    }
}

/// Cable element state
#[derive(Debug, Clone)]
pub struct CableElement {
    /// Node A coordinates (x, y, z)
    pub node_a: [f64; 3],
    /// Node B coordinates (x, y, z)
    pub node_b: [f64; 3],
    /// Material properties
    pub material: CableMaterial,
    /// Initial unstressed length (m)
    pub unstressed_length: f64,
    /// Current length (m)
    pub current_length: f64,
    /// Axial tension (N, always ≥ 0)
    pub tension: f64,
    /// Sag at mid-span (m)
    pub sag: f64,
    /// Is cable active (under tension)?
    pub is_active: bool,
}

impl CableElement {
    /// Create new cable element
    pub fn new(node_a: [f64; 3], node_b: [f64; 3], material: CableMaterial) -> Self {
        let current_length = Self::distance(&node_a, &node_b);
        
        Self {
            node_a,
            node_b,
            material,
            unstressed_length: current_length,
            current_length,
            tension: 0.0,
            sag: 0.0,
            is_active: false,
        }
    }
    
    /// Calculate distance between two points
    fn distance(p1: &[f64; 3], p2: &[f64; 3]) -> f64 {
        let dx = p2[0] - p1[0];
        let dy = p2[1] - p1[1];
        let dz = p2[2] - p1[2];
        (dx * dx + dy * dy + dz * dz).sqrt()
    }
    
    /// Update cable state based on current node positions
    pub fn update_state(&mut self, node_a: [f64; 3], node_b: [f64; 3]) {
        self.node_a = node_a;
        self.node_b = node_b;
        self.current_length = Self::distance(&node_a, &node_b);
        
        // Calculate strain
        let strain = (self.current_length - self.unstressed_length) / self.unstressed_length;
        
        // Tension-only: activate only if in tension
        if strain > 0.0 {
            self.is_active = true;
            self.tension = self.material.elastic_modulus * self.material.area * strain;
        } else {
            self.is_active = false;
            self.tension = 0.0;
        }
    }
    
    /// Calculate catenary sag under self-weight
    /// Returns (sag, horizontal_tension, cable_length)
    pub fn calculate_catenary_sag(&self, horizontal_span: f64) -> (f64, f64, f64) {
        let w = self.material.unit_weight; // N/m
        let L = horizontal_span; // m
        
        // For small sag (parabolic approximation):
        // sag = w*L²/(8*H) where H is horizontal tension
        // For more accurate catenary:
        // Use iterative solution
        
        // Initial guess: assume sag = L/50 (2% of span)
        let mut sag = L / 50.0;
        let max_iterations = 20;
        
        for _ in 0..max_iterations {
            // Cable length approximation: s = L + 8*sag²/(3*L)
            let cable_length = L + 8.0 * sag * sag / (3.0 * L);
            
            // Horizontal tension from equilibrium
            let h_tension = w * L * L / (8.0 * sag);
            
            // Check if cable can support this tension
            if h_tension * cable_length / self.unstressed_length > self.material.tensile_strength {
                // Tension too high, reduce sag
                sag *= 0.9;
                continue;
            }
            
            // Refined sag from catenary equation
            let lambda = w * L / (2.0 * h_tension);
            let sag_new = h_tension / w * ((lambda).cosh() - 1.0);
            
            // Convergence check
            if (sag_new - sag).abs() / sag < 1e-6 {
                return (sag_new, h_tension, cable_length);
            }
            
            sag = sag_new;
        }
        
        // Return last iteration
        let cable_length = L + 8.0 * sag * sag / (3.0 * L);
        let h_tension = w * L * L / (8.0 * sag);
        (sag, h_tension, cable_length)
    }
    
    /// Calculate effective modulus considering cable sag
    /// Ernst's formula: E_eff = E / (1 + γ²*L²/(12*H²) * EA)
    /// where H is horizontal tension component
    pub fn effective_modulus(&self, horizontal_span: f64, horizontal_tension: f64) -> f64 {
        let e = self.material.elastic_modulus;
        let a = self.material.area;
        let w = self.material.unit_weight;
        let l = horizontal_span;
        
        if horizontal_tension < 1e-6 {
            return e; // No sag effect at zero tension
        }
        
        // Ernst's formula: E_eff = E / (1 + (wL)² EA/(12H²))
        let numerator = (w * l).powi(2) * e * a;
        let denominator = 12.0 * horizontal_tension.powi(2);
        let lambda_sq = numerator / denominator;
        
        e / (1.0 + lambda_sq)
    }
    
    /// Compute 6x6 tangent stiffness matrix (geometric + material)
    /// Returns flattened matrix in row-major order
    pub fn tangent_stiffness_matrix(&self) -> Vec<f64> {
        if !self.is_active {
            // Cable slack: zero stiffness
            return vec![0.0; 36];
        }
        
        let L = self.current_length;
        let dx = self.node_b[0] - self.node_a[0];
        let dy = self.node_b[1] - self.node_a[1];
        let dz = self.node_b[2] - self.node_a[2];
        
        // Direction cosines
        let cx = dx / L;
        let cy = dy / L;
        let cz = dz / L;
        
        // Material stiffness: k_m = EA/L
        let k_m = self.material.elastic_modulus * self.material.area / L;
        
        // Geometric stiffness coefficient: k_g = T/L
        let k_g = self.tension / L;
        
        // Build 6x6 matrix: K = k_m * [c][c]ᵀ + k_g * (I - [c][c]ᵀ)
        // where [c] = [cx, cy, cz]
        
        let mut K = vec![0.0; 36];
        
        for i in 0..3 {
            for j in 0..3 {
                let idx = i * 6 + j;
                let c = [cx, cy, cz];
                
                // K_AB = k_m * c_i * c_j + k_g * (δ_ij - c_i * c_j)
                let delta_ij = if i == j { 1.0 } else { 0.0 };
                let k_ab = k_m * c[i] * c[j] + k_g * (delta_ij - c[i] * c[j]);
                
                // Block AA (top-left 3x3)
                K[idx] = k_ab;
                
                // Block AB (top-right 3x3)
                K[i * 6 + (j + 3)] = -k_ab;
                
                // Block BA (bottom-left 3x3)
                K[(i + 3) * 6 + j] = -k_ab;
                
                // Block BB (bottom-right 3x3)
                K[(i + 3) * 6 + (j + 3)] = k_ab;
            }
        }
        
        K
    }
    
    /// Compute nodal force vector (6x1)
    /// Returns [Fax, Fay, Faz, Fbx, Fby, Fbz]
    pub fn nodal_forces(&self) -> Vec<f64> {
        if !self.is_active {
            return vec![0.0; 6];
        }
        
        let L = self.current_length;
        let dx = self.node_b[0] - self.node_a[0];
        let dy = self.node_b[1] - self.node_a[1];
        let dz = self.node_b[2] - self.node_a[2];
        
        // Direction cosines
        let cx = dx / L;
        let cy = dy / L;
        let cz = dz / L;
        
        // Force components: F_i = T * c_i
        let fx = self.tension * cx;
        let fy = self.tension * cy;
        let fz = self.tension * cz;
        
        vec![
            -fx, -fy, -fz,  // Node A (pulls toward B)
             fx,  fy,  fz,  // Node B (pulls toward A)
        ]
    }
    
    /// Calculate strain energy: U = 0.5 * T * ΔL
    pub fn strain_energy(&self) -> f64 {
        if !self.is_active {
            return 0.0;
        }
        
        let delta_L = self.current_length - self.unstressed_length;
        0.5 * self.tension * delta_L
    }
    
    /// Apply temperature change and update unstressed length
    pub fn apply_temperature_change(&mut self, delta_temp: f64) {
        // Thermal strain: ε_T = α * ΔT
        let thermal_strain = self.material.thermal_coeff * delta_temp;
        
        // Update unstressed length
        self.unstressed_length *= 1.0 + thermal_strain;
    }
    
    /// Check if cable is within safe working load
    pub fn check_safety_factor(&self) -> f64 {
        if !self.is_active || self.tension < 1e-6 {
            return f64::INFINITY;
        }
        
        let max_tension = self.material.tensile_strength * self.material.area;
        max_tension / self.tension
    }
}

/// Cable system analyzer for multiple cables
pub struct CableSystem {
    pub cables: Vec<CableElement>,
}

impl CableSystem {
    pub fn new() -> Self {
        Self { cables: Vec::new() }
    }
    
    pub fn add_cable(&mut self, cable: CableElement) {
        self.cables.push(cable);
    }
    
    /// Update all cables and check for slack
    pub fn update_system(&mut self, node_positions: &[[f64; 3]]) {
        for (i, cable) in self.cables.iter_mut().enumerate() {
            if 2 * i + 1 < node_positions.len() {
                cable.update_state(node_positions[2 * i], node_positions[2 * i + 1]);
            }
        }
    }
    
    /// Get total number of active cables (under tension)
    pub fn active_cable_count(&self) -> usize {
        self.cables.iter().filter(|c| c.is_active).count()
    }
    
    /// Get total tension in system
    pub fn total_tension(&self) -> f64 {
        self.cables.iter().map(|c| c.tension).sum()
    }
    
    /// Get total strain energy
    pub fn total_energy(&self) -> f64 {
        self.cables.iter().map(|c| c.strain_energy()).sum()
    }
    
    /// Find minimum safety factor across all cables
    pub fn minimum_safety_factor(&self) -> f64 {
        self.cables.iter()
            .map(|c| c.check_safety_factor())
            .min_by(|a, b| a.partial_cmp(b).unwrap_or(std::cmp::Ordering::Equal))
            .unwrap_or(f64::INFINITY)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    
    #[test]
    fn test_cable_material_steel() {
        let mat = CableMaterial::steel_cable(50.0); // 50mm diameter
        
        assert!((mat.elastic_modulus - 165e9).abs() < 1e6);
        assert!(mat.area > 0.0);
        assert!(mat.unit_weight > 0.0);
    }
    
    #[test]
    fn test_cable_tension_only() {
        let mat = CableMaterial::steel_cable(25.0);
        let node_a = [0.0, 0.0, 0.0];
        let node_b = [10.0, 0.0, 0.0];
        
        let mut cable = CableElement::new(node_a, node_b, mat);
        
        // Stretch cable (tension)
        cable.update_state(node_a, [15.0, 0.0, 0.0]);
        assert!(cable.is_active);
        assert!(cable.tension > 0.0);
        
        // Compress cable (should go slack)
        cable.update_state(node_a, [5.0, 0.0, 0.0]);
        assert!(!cable.is_active);
        assert_eq!(cable.tension, 0.0);
    }
    
    #[test]
    fn test_catenary_sag() {
        let mat = CableMaterial::steel_cable(25.0);
        let node_a = [0.0, 0.0, 0.0];
        let node_b = [100.0, 0.0, 0.0];
        
        let cable = CableElement::new(node_a, node_b, mat);
        let (sag, h_tension, cable_length) = cable.calculate_catenary_sag(100.0);
        
        assert!(sag > 0.0);
        assert!(h_tension > 0.0);
        assert!(cable_length > 100.0); // Cable longer than span due to sag
    }
    
    #[test]
    fn test_effective_modulus() {
        let mat = CableMaterial::steel_cable(25.0);
        let node_a = [0.0, 0.0, 0.0];
        let node_b = [100.0, 0.0, 0.0];
        
        let cable = CableElement::new(node_a, node_b, mat);
        
        // Very high tension: effective modulus approaches material modulus
        // Use 100 MN for 100m span to minimize sag
        let e_eff_very_high = cable.effective_modulus(100.0, 100e6);
        println!("E_eff at very high tension (100e6 N): {:.2e} Pa", e_eff_very_high);
        println!("Material E: {:.2e} Pa", mat.elastic_modulus);
        println!("Ratio: {:.4}", e_eff_very_high / mat.elastic_modulus);
        assert!(e_eff_very_high > 0.9 * mat.elastic_modulus); // Should be close to E
        
        // Moderate tension: reduced due to sag
        let e_eff_moderate = cable.effective_modulus(100.0, 10e6);
        println!("E_eff at moderate tension (10e6 N): {:.2e} Pa", e_eff_moderate);
        assert!(e_eff_moderate < 0.9 * mat.elastic_modulus);
        
        // Low tension: significantly reduced
        let e_eff_low = cable.effective_modulus(100.0, 1e6);
        println!("E_eff at low tension (1e6 N): {:.2e} Pa", e_eff_low);
        assert!(e_eff_low < 0.1 * mat.elastic_modulus); // Sag dominates
    }
    
    #[test]
    fn test_stiffness_matrix_dimensions() {
        let mat = CableMaterial::steel_cable(25.0);
        let node_a = [0.0, 0.0, 0.0];
        let node_b = [10.0, 0.0, 0.0];
        
        let mut cable = CableElement::new(node_a, node_b, mat);
        cable.update_state(node_a, [15.0, 0.0, 0.0]); // Put in tension
        
        let K = cable.tangent_stiffness_matrix();
        assert_eq!(K.len(), 36); // 6x6 matrix
    }
    
    #[test]
    fn test_temperature_effects() {
        let mat = CableMaterial::steel_cable(25.0);
        let node_a = [0.0, 0.0, 0.0];
        let node_b = [100.0, 0.0, 0.0];
        
        let mut cable = CableElement::new(node_a, node_b, mat);
        let initial_length = cable.unstressed_length;
        
        // Heating expands cable
        cable.apply_temperature_change(50.0); // +50°C
        println!("Initial length: {:.6} m", initial_length);
        println!("After +50°C: {:.6} m", cable.unstressed_length);
        println!("Expansion: {:.6} m", cable.unstressed_length - initial_length);
        assert!(cable.unstressed_length > initial_length);
        
        // Expected expansion: ΔL = α * L * ΔT
        let expected_change = mat.thermal_coeff * initial_length * 50.0;
        println!("Expected change: {:.6} m", expected_change);
        let actual_change = cable.unstressed_length - initial_length;
        assert!((actual_change - expected_change).abs() < 1e-6);
    }
}
