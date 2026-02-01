//! # Advanced Loading Module
//! 
//! Critical loading types missing from base implementation:
//! - **Temperature Loads** - Thermal strain with gradient capability
//! - **Support Settlement** - Prescribed displacements at supports
//! - **Pattern Loading** - Automatic live load patterns per code
//! - **Initial Strain** - Fabrication error / lack-of-fit
//! - **Notional Loads** - Frame imperfection per design codes
//!
//! These are BLOCKING features for real-world structural engineering.

use serde::{Deserialize, Serialize};

// ============================================================================
// TEMPERATURE LOADS
// ============================================================================

/// Temperature load type
#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
pub enum TemperatureLoadType {
    /// Uniform temperature change (axial strain only)
    Uniform,
    /// Temperature gradient through depth (bending)
    GradientY,
    /// Temperature gradient through width (bending)
    GradientZ,
    /// Combined uniform + gradient
    Combined,
}

/// Temperature load on a member
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TemperatureLoad {
    /// Member ID
    pub member_id: usize,
    /// Load type
    pub load_type: TemperatureLoadType,
    /// Uniform temperature change (°C) - positive = heating
    pub delta_t_uniform: f64,
    /// Temperature difference top-bottom (°C) - positive = top hotter
    pub delta_t_gradient_y: f64,
    /// Temperature difference left-right (°C)
    pub delta_t_gradient_z: f64,
    /// Coefficient of thermal expansion (1/°C) - steel: 12e-6, concrete: 10e-6
    pub alpha: f64,
}

impl TemperatureLoad {
    /// Create uniform temperature load
    pub fn uniform(member_id: usize, delta_t: f64, alpha: f64) -> Self {
        Self {
            member_id,
            load_type: TemperatureLoadType::Uniform,
            delta_t_uniform: delta_t,
            delta_t_gradient_y: 0.0,
            delta_t_gradient_z: 0.0,
            alpha,
        }
    }
    
    /// Create temperature gradient load (through depth)
    pub fn gradient_y(member_id: usize, delta_t: f64, alpha: f64) -> Self {
        Self {
            member_id,
            load_type: TemperatureLoadType::GradientY,
            delta_t_uniform: 0.0,
            delta_t_gradient_y: delta_t,
            delta_t_gradient_z: 0.0,
            alpha,
        }
    }
    
    /// Create combined temperature load
    pub fn combined(member_id: usize, uniform: f64, gradient_y: f64, gradient_z: f64, alpha: f64) -> Self {
        Self {
            member_id,
            load_type: TemperatureLoadType::Combined,
            delta_t_uniform: uniform,
            delta_t_gradient_y: gradient_y,
            delta_t_gradient_z: gradient_z,
            alpha,
        }
    }
    
    /// Calculate thermal strain (axial)
    pub fn thermal_strain(&self) -> f64 {
        self.alpha * self.delta_t_uniform
    }
    
    /// Calculate thermal curvature about Y axis (causes bending in XZ plane)
    pub fn thermal_curvature_y(&self, depth: f64) -> f64 {
        if depth <= 0.0 { return 0.0; }
        self.alpha * self.delta_t_gradient_y / depth
    }
    
    /// Calculate thermal curvature about Z axis
    pub fn thermal_curvature_z(&self, width: f64) -> f64 {
        if width <= 0.0 { return 0.0; }
        self.alpha * self.delta_t_gradient_z / width
    }
    
    /// Calculate equivalent nodal forces for a frame element
    /// Returns [Fx_i, Fy_i, Fz_i, Mx_i, My_i, Mz_i, Fx_j, Fy_j, Fz_j, Mx_j, My_j, Mz_j]
    pub fn equivalent_nodal_forces(&self, e: f64, a: f64, iz: f64, iy: f64, depth: f64, width: f64) -> [f64; 12] {
        let mut forces = [0.0; 12];
        
        // Axial force from uniform temperature (fixed-fixed)
        // N = -E * A * α * ΔT (compressive for heating in restrained member)
        let axial = -e * a * self.alpha * self.delta_t_uniform;
        forces[0] = axial;      // Fx at i
        forces[6] = -axial;     // Fx at j
        
        // Bending moment from gradient Y (fixed-fixed)
        // M = E * I * κ = E * I * α * ΔT / h
        if depth > 0.0 {
            let kappa_y = self.alpha * self.delta_t_gradient_y / depth;
            let moment_z = e * iz * kappa_y;
            forces[5] = moment_z;   // Mz at i
            forces[11] = -moment_z; // Mz at j
        }
        
        // Bending moment from gradient Z (fixed-fixed)
        if width > 0.0 {
            let kappa_z = self.alpha * self.delta_t_gradient_z / width;
            let moment_y = e * iy * kappa_z;
            forces[4] = moment_y;   // My at i
            forces[10] = -moment_y; // My at j
        }
        
        forces
    }
}

/// Temperature load calculator for structural system
#[derive(Debug, Clone)]
pub struct TemperatureAnalyzer {
    /// Temperature loads
    pub loads: Vec<TemperatureLoad>,
}

impl TemperatureAnalyzer {
    pub fn new() -> Self {
        Self { loads: Vec::new() }
    }
    
    pub fn add_load(&mut self, load: TemperatureLoad) {
        self.loads.push(load);
    }
    
    /// Calculate global load vector contribution from temperature loads
    pub fn assemble_load_vector(
        &self,
        member_properties: &[(f64, f64, f64, f64, f64, f64)], // (E, A, Iz, Iy, depth, width)
        member_connectivity: &[(usize, usize)], // (node_i, node_j)
        dof_per_node: usize,
    ) -> Vec<f64> {
        let n_nodes = member_connectivity.iter()
            .flat_map(|(i, j)| vec![*i, *j])
            .max()
            .unwrap_or(0) + 1;
        let total_dof = n_nodes * dof_per_node;
        let mut load_vector = vec![0.0; total_dof];
        
        for temp_load in &self.loads {
            if temp_load.member_id >= member_properties.len() {
                continue;
            }
            
            let (e, a, iz, iy, depth, width) = member_properties[temp_load.member_id];
            let (node_i, node_j) = member_connectivity[temp_load.member_id];
            
            let nodal_forces = temp_load.equivalent_nodal_forces(e, a, iz, iy, depth, width);
            
            // Assemble into global vector
            for k in 0..6 {
                let dof_i = node_i * dof_per_node + k;
                let dof_j = node_j * dof_per_node + k;
                
                if dof_i < total_dof {
                    load_vector[dof_i] += nodal_forces[k];
                }
                if dof_j < total_dof {
                    load_vector[dof_j] += nodal_forces[k + 6];
                }
            }
        }
        
        load_vector
    }
}

impl Default for TemperatureAnalyzer {
    fn default() -> Self {
        Self::new()
    }
}

// ============================================================================
// SUPPORT SETTLEMENT
// ============================================================================

/// Support settlement/prescribed displacement
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SupportSettlement {
    /// Node ID
    pub node_id: usize,
    /// Settlement in X (m) - positive = in positive X direction
    pub dx: f64,
    /// Settlement in Y (m)
    pub dy: f64,
    /// Settlement in Z (m)
    pub dz: f64,
    /// Rotation about X (rad)
    pub rx: f64,
    /// Rotation about Y (rad)
    pub ry: f64,
    /// Rotation about Z (rad)
    pub rz: f64,
}

impl SupportSettlement {
    /// Create translation-only settlement
    pub fn translation(node_id: usize, dx: f64, dy: f64, dz: f64) -> Self {
        Self {
            node_id,
            dx, dy, dz,
            rx: 0.0, ry: 0.0, rz: 0.0,
        }
    }
    
    /// Create vertical settlement (most common)
    pub fn vertical(node_id: usize, settlement: f64) -> Self {
        Self::translation(node_id, 0.0, -settlement.abs(), 0.0)
    }
    
    /// Create full 6-DOF prescribed displacement
    pub fn full(node_id: usize, dx: f64, dy: f64, dz: f64, rx: f64, ry: f64, rz: f64) -> Self {
        Self { node_id, dx, dy, dz, rx, ry, rz }
    }
    
    /// Get as displacement vector [dx, dy, dz, rx, ry, rz]
    pub fn as_vector(&self) -> [f64; 6] {
        [self.dx, self.dy, self.dz, self.rx, self.ry, self.rz]
    }
}

/// Settlement analyzer using penalty method or direct displacement approach
#[derive(Debug, Clone)]
pub struct SettlementAnalyzer {
    pub settlements: Vec<SupportSettlement>,
    /// Penalty factor (for penalty method)
    pub penalty: f64,
}

impl SettlementAnalyzer {
    pub fn new() -> Self {
        Self {
            settlements: Vec::new(),
            penalty: 1e15, // Large penalty factor
        }
    }
    
    pub fn add_settlement(&mut self, settlement: SupportSettlement) {
        self.settlements.push(settlement);
    }
    
    /// Modify stiffness matrix and load vector for settlements (penalty method)
    /// 
    /// For prescribed displacement u_p at DOF i:
    /// K[i,i] += penalty
    /// F[i] += penalty * u_p
    pub fn apply_penalty_method(
        &self,
        stiffness: &mut Vec<f64>,  // Row-major nxn
        load_vector: &mut Vec<f64>,
        n_dof: usize,
        dof_per_node: usize,
        restrained_dof: &[bool],  // Which DOFs have supports
    ) {
        for settlement in &self.settlements {
            let disp = settlement.as_vector();
            
            for (local_dof, &prescribed_disp) in disp.iter().enumerate() {
                if prescribed_disp.abs() < 1e-15 {
                    continue; // No prescribed displacement
                }
                
                let global_dof = settlement.node_id * dof_per_node + local_dof;
                if global_dof >= n_dof {
                    continue;
                }
                
                // Only apply if this DOF is actually restrained
                if global_dof < restrained_dof.len() && restrained_dof[global_dof] {
                    // Add penalty to diagonal
                    stiffness[global_dof * n_dof + global_dof] += self.penalty;
                    // Add penalty * u_prescribed to load
                    load_vector[global_dof] += self.penalty * prescribed_disp;
                }
            }
        }
    }
    
    /// Calculate support reactions due to settlement
    /// F = K * u_settlement (where u_settlement has non-zero at settled DOFs)
    pub fn calculate_settlement_reactions(
        &self,
        stiffness: &[f64],
        n_dof: usize,
        dof_per_node: usize,
    ) -> Vec<f64> {
        // Build settlement displacement vector
        let mut u_settlement = vec![0.0; n_dof];
        
        for settlement in &self.settlements {
            let disp = settlement.as_vector();
            for (local_dof, &d) in disp.iter().enumerate() {
                let global_dof = settlement.node_id * dof_per_node + local_dof;
                if global_dof < n_dof {
                    u_settlement[global_dof] = d;
                }
            }
        }
        
        // F = K * u
        let mut reactions = vec![0.0; n_dof];
        for i in 0..n_dof {
            for j in 0..n_dof {
                reactions[i] += stiffness[i * n_dof + j] * u_settlement[j];
            }
        }
        
        reactions
    }
}

impl Default for SettlementAnalyzer {
    fn default() -> Self {
        Self::new()
    }
}

// ============================================================================
// PATTERN LOADING
// ============================================================================

/// Live load pattern for checkerboard analysis
#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
pub enum PatternType {
    /// Full live load on all spans
    Full,
    /// Checkerboard pattern (alternate spans)
    Checkerboard,
    /// Adjacent spans loaded
    Adjacent,
    /// Maximum positive moment pattern
    MaxPositive,
    /// Maximum negative moment pattern
    MaxNegative,
    /// Maximum shear pattern
    MaxShear,
    /// Skip pattern (every other span)
    Skip,
}

/// Pattern loading generator per design code
#[derive(Debug, Clone)]
pub struct PatternLoadGenerator {
    /// Number of spans
    pub n_spans: usize,
    /// Design code
    pub code: DesignCode,
}

#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
pub enum DesignCode {
    IS456,
    IS800,
    ACI318,
    Eurocode2,
    Eurocode3,
    ASCE7,
}

impl PatternLoadGenerator {
    pub fn new(n_spans: usize, code: DesignCode) -> Self {
        Self { n_spans, code }
    }
    
    /// Generate all required patterns per code
    pub fn generate_patterns(&self) -> Vec<(String, Vec<bool>)> {
        match self.code {
            DesignCode::IS456 | DesignCode::IS800 => self.generate_is456_patterns(),
            DesignCode::ACI318 => self.generate_aci318_patterns(),
            DesignCode::Eurocode2 | DesignCode::Eurocode3 => self.generate_ec2_patterns(),
            DesignCode::ASCE7 => self.generate_asce7_patterns(),
        }
    }
    
    /// IS 456:2000 Clause 22.4.1 pattern loading
    fn generate_is456_patterns(&self) -> Vec<(String, Vec<bool>)> {
        let mut patterns = Vec::new();
        let n = self.n_spans;
        
        // 1. Full dead + full live
        patterns.push(("DL+LL_Full".to_string(), vec![true; n]));
        
        // 2. For maximum positive moment: alternate spans
        // Odd spans loaded
        let mut odd = vec![false; n];
        for i in (0..n).step_by(2) {
            odd[i] = true;
        }
        patterns.push(("LL_Odd_Spans".to_string(), odd));
        
        // Even spans loaded
        let mut even = vec![false; n];
        for i in (1..n).step_by(2) {
            even[i] = true;
        }
        patterns.push(("LL_Even_Spans".to_string(), even));
        
        // 3. For maximum negative moment at each support: adjacent spans
        for support in 1..n {
            let mut adjacent = vec![false; n];
            if support > 0 {
                adjacent[support - 1] = true;
            }
            if support < n {
                adjacent[support] = true;
            }
            patterns.push((format!("LL_MaxNeg_Support{}", support), adjacent));
        }
        
        patterns
    }
    
    /// ACI 318-19 Section 6.4.3 pattern loading
    fn generate_aci318_patterns(&self) -> Vec<(String, Vec<bool>)> {
        let mut patterns = Vec::new();
        let n = self.n_spans;
        
        // ACI requires:
        // (a) Factored dead load on all spans with full factored live load on two adjacent spans
        // (b) Factored dead load on all spans with full factored live load on alternate spans
        
        // Full live
        patterns.push(("LL_All".to_string(), vec![true; n]));
        
        // Alternate patterns
        let mut odd = vec![false; n];
        for i in (0..n).step_by(2) {
            odd[i] = true;
        }
        patterns.push(("LL_Alternate_1".to_string(), odd));
        
        let mut even = vec![false; n];
        for i in (1..n).step_by(2) {
            even[i] = true;
        }
        patterns.push(("LL_Alternate_2".to_string(), even));
        
        // Adjacent spans (for negative moments)
        for i in 0..n.saturating_sub(1) {
            let mut adj = vec![false; n];
            adj[i] = true;
            adj[i + 1] = true;
            patterns.push((format!("LL_Adjacent_{}-{}", i + 1, i + 2), adj));
        }
        
        patterns
    }
    
    /// Eurocode 2 pattern loading (EN 1992-1-1)
    fn generate_ec2_patterns(&self) -> Vec<(String, Vec<bool>)> {
        let mut patterns = Vec::new();
        let n = self.n_spans;
        
        // EC2 5.1.3: 
        // - Alternate spans loaded
        // - Adjacent spans loaded
        
        // Full
        patterns.push(("Q_Full".to_string(), vec![true; n]));
        
        // Checkerboard 1
        let mut check1 = vec![false; n];
        for i in (0..n).step_by(2) {
            check1[i] = true;
        }
        patterns.push(("Q_Checker_1".to_string(), check1));
        
        // Checkerboard 2
        let mut check2 = vec![false; n];
        for i in (1..n).step_by(2) {
            check2[i] = true;
        }
        patterns.push(("Q_Checker_2".to_string(), check2));
        
        // All 2-span combinations for supports
        for i in 0..n {
            for j in (i + 1)..n {
                if j - i <= 2 {  // Adjacent or near-adjacent
                    let mut pat = vec![false; n];
                    pat[i] = true;
                    pat[j] = true;
                    patterns.push((format!("Q_Span_{}_{}", i + 1, j + 1), pat));
                }
            }
        }
        
        patterns
    }
    
    /// ASCE 7-22 pattern loading for floors
    fn generate_asce7_patterns(&self) -> Vec<(String, Vec<bool>)> {
        // ASCE 7 similar to ACI but with different factors
        self.generate_aci318_patterns()
    }
    
    /// Generate load combinations with patterns
    /// Returns (combo_name, dead_factor, live_factor, pattern)
    pub fn generate_pattern_combinations(&self) -> Vec<(String, f64, f64, Vec<bool>)> {
        let patterns = self.generate_patterns();
        let mut combinations = Vec::new();
        
        let (dead_factor, live_factor) = match self.code {
            DesignCode::IS456 | DesignCode::IS800 => (1.5, 1.5),
            DesignCode::ACI318 => (1.2, 1.6),
            DesignCode::Eurocode2 | DesignCode::Eurocode3 => (1.35, 1.5),
            DesignCode::ASCE7 => (1.2, 1.6),
        };
        
        for (name, pattern) in patterns {
            combinations.push((
                format!("ULS_{}", name),
                dead_factor,
                live_factor,
                pattern,
            ));
        }
        
        combinations
    }
}

// ============================================================================
// INITIAL STRAIN / LACK OF FIT
// ============================================================================

/// Initial strain/lack-of-fit load
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct InitialStrainLoad {
    /// Member ID
    pub member_id: usize,
    /// Initial axial strain (positive = shortening/gap)
    pub axial_strain: f64,
    /// Initial curvature about Y
    pub curvature_y: f64,
    /// Initial curvature about Z
    pub curvature_z: f64,
}

impl InitialStrainLoad {
    /// Create axial lack-of-fit (e.g., member too short)
    pub fn axial(member_id: usize, delta_l: f64, length: f64) -> Self {
        Self {
            member_id,
            axial_strain: delta_l / length,
            curvature_y: 0.0,
            curvature_z: 0.0,
        }
    }
    
    /// Calculate equivalent nodal forces
    pub fn equivalent_nodal_forces(&self, e: f64, a: f64, iz: f64, iy: f64, _length: f64) -> [f64; 12] {
        let mut forces = [0.0; 12];
        
        // Axial force (fixed-fixed): N = -E * A * ε0
        let axial = -e * a * self.axial_strain;
        forces[0] = axial;
        forces[6] = -axial;
        
        // Moment from curvature: M = E * I * κ
        let moment_z = e * iz * self.curvature_z;
        let moment_y = e * iy * self.curvature_y;
        
        forces[4] = moment_y;
        forces[5] = moment_z;
        forces[10] = -moment_y;
        forces[11] = -moment_z;
        
        forces
    }
}

// ============================================================================
// NOTIONAL LOADS (Frame Imperfection)
// ============================================================================

/// Notional load generator per design code
#[derive(Debug, Clone)]
pub struct NotionalLoadGenerator {
    pub code: DesignCode,
}

impl NotionalLoadGenerator {
    pub fn new(code: DesignCode) -> Self {
        Self { code }
    }
    
    /// Calculate notional horizontal load as fraction of vertical load
    pub fn notional_factor(&self, height: f64, n_stories: usize) -> f64 {
        match self.code {
            DesignCode::IS800 => {
                // IS 800:2007 Clause 4.3.6
                // φ = 1/200 for single story
                // φ = 1/(200 * √(0.5 + 1/n)) for multi-story
                if n_stories <= 1 {
                    1.0 / 200.0
                } else {
                    let factor = (0.5 + 1.0 / n_stories as f64).sqrt();
                    1.0 / (200.0 * factor)
                }
            }
            DesignCode::ASCE7 => {
                // AISC 360-22 Appendix 7
                // Notional load = 0.002 * Yi (gravity load at level i)
                0.002
            }
            DesignCode::Eurocode2 | DesignCode::Eurocode3 => {
                // EN 1993-1-1 Clause 5.3.2
                // φ = φ0 * αh * αm
                // φ0 = 1/200
                let phi_0 = 1.0 / 200.0;
                let alpha_h = (2.0 / height.sqrt()).min(1.0).max(2.0 / 3.0);
                let alpha_m = (0.5 * (1.0 + 1.0 / n_stories as f64)).sqrt();
                phi_0 * alpha_h * alpha_m
            }
            _ => 0.005,  // Conservative default
        }
    }
    
    /// Generate notional loads for a frame
    /// Returns (node_id, fx, fy) for each level
    pub fn generate_notional_loads(
        &self,
        story_heights: &[f64],
        story_gravity_loads: &[f64],
    ) -> Vec<(usize, f64, f64)> {
        let n_stories = story_heights.len();
        let total_height: f64 = story_heights.iter().sum();
        
        let factor = self.notional_factor(total_height, n_stories);
        
        story_gravity_loads.iter().enumerate().map(|(i, &gravity)| {
            let horizontal = factor * gravity;
            (i, horizontal, 0.0)  // Horizontal in X, zero in Y
        }).collect()
    }
}

// ============================================================================
// TESTS
// ============================================================================

#[cfg(test)]
mod tests {
    use super::*;
    
    #[test]
    fn test_temperature_uniform() {
        // Steel member, 20°C rise
        let temp = TemperatureLoad::uniform(0, 20.0, 12e-6);
        
        let strain = temp.thermal_strain();
        assert!((strain - 240e-6).abs() < 1e-9);
        
        // For a 10m member: ΔL = ε * L = 240e-6 * 10 = 2.4mm
    }
    
    #[test]
    fn test_temperature_gradient() {
        // Beam depth 500mm, 10°C gradient
        let temp = TemperatureLoad::gradient_y(0, 10.0, 12e-6);
        
        let curvature = temp.thermal_curvature_y(0.5);
        // κ = α * ΔT / h = 12e-6 * 10 / 0.5 = 240e-6 /m
        assert!((curvature - 240e-6).abs() < 1e-9);
    }
    
    #[test]
    fn test_temperature_nodal_forces() {
        // W360x45 steel beam, E=200GPa, A=5730mm², I=160e6mm⁴, depth=352mm
        let temp = TemperatureLoad::combined(0, 30.0, 15.0, 0.0, 12e-6);
        
        let e = 200e9;  // Pa
        let a = 5730e-6;  // m²
        let iz = 160e-6;  // m⁴
        let iy = 8.16e-6;  // m⁴
        let depth = 0.352;
        let width = 0.171;
        
        let forces = temp.equivalent_nodal_forces(e, a, iz, iy, depth, width);
        
        // Axial: N = -E*A*α*ΔT = -200e9 * 5730e-6 * 12e-6 * 30 = -412.6 kN
        assert!((forces[0] / 1000.0 + 412.6).abs() < 1.0);  // Within 1 kN
        
        // Moment from gradient: M = E*I*α*ΔT/h
        let expected_moment = e * iz * 12e-6 * 15.0 / depth;
        assert!((forces[5] - expected_moment).abs() / expected_moment < 0.01);
    }
    
    #[test]
    fn test_support_settlement() {
        let settlement = SupportSettlement::vertical(2, 0.010);  // 10mm settlement
        
        assert_eq!(settlement.node_id, 2);
        assert!((settlement.dy + 0.010).abs() < 1e-10);
    }
    
    #[test]
    fn test_pattern_generator_is456() {
        let gen = PatternLoadGenerator::new(3, DesignCode::IS456);
        let patterns = gen.generate_patterns();
        
        // Should have at least: full, odd, even, and support patterns
        assert!(patterns.len() >= 4);
        
        // Full pattern
        let (name, pat) = &patterns[0];
        assert!(name.contains("Full"));
        assert!(pat.iter().all(|&x| x));
        
        // Odd spans
        let (_, odd_pat) = &patterns[1];
        assert!(odd_pat[0]);  // Span 1 loaded
        if odd_pat.len() > 2 {
            assert!(odd_pat[2]);  // Span 3 loaded
        }
    }
    
    #[test]
    fn test_pattern_combinations() {
        let gen = PatternLoadGenerator::new(4, DesignCode::ACI318);
        let combos = gen.generate_pattern_combinations();
        
        // Check load factors
        for (name, df, lf, _) in &combos {
            assert!(name.starts_with("ULS_"));
            assert!((*df - 1.2).abs() < 0.01);  // ACI dead factor
            assert!((*lf - 1.6).abs() < 0.01);  // ACI live factor
        }
    }
    
    #[test]
    fn test_notional_load_is800() {
        let gen = NotionalLoadGenerator::new(DesignCode::IS800);
        
        // Single story
        let factor_1 = gen.notional_factor(4.0, 1);
        assert!((factor_1 - 0.005).abs() < 1e-6);  // 1/200
        
        // Multi-story (10 stories)
        let factor_10 = gen.notional_factor(35.0, 10);
        // φ = 1/(200 * √(0.5 + 0.1)) = 1/(200 * 0.775) = 0.00645
        assert!(factor_10 > 0.004 && factor_10 < 0.008);
    }
    
    #[test]
    fn test_initial_strain() {
        // Member 5mm too short in 10m length
        let strain = InitialStrainLoad::axial(0, 0.005, 10.0);
        assert!((strain.axial_strain - 0.0005).abs() < 1e-9);
        
        // Equivalent force: N = -E*A*ε = -200e9 * 0.01 * 0.0005 = -1000 kN
        let forces = strain.equivalent_nodal_forces(200e9, 0.01, 1e-4, 1e-4, 10.0);
        assert!((forces[0] / 1e6 + 1.0).abs() < 0.01);  // ~ -1000 kN
    }
    
    #[test]
    fn test_settlement_penalty_method() {
        let mut analyzer = SettlementAnalyzer::new();
        analyzer.add_settlement(SupportSettlement::vertical(0, 0.010));
        
        // Simple 2x2 stiffness
        let mut k = vec![1e6, 0.0, 0.0, 1e6];
        let mut f = vec![0.0, 0.0];
        let restrained = vec![false, true];  // Only vertical restrained
        
        analyzer.apply_penalty_method(&mut k, &mut f, 2, 1, &restrained);
        
        // Check that penalty was applied to DOF 1 (vertical)
        assert!(k[3] > 1e14);  // Diagonal should be large
        assert!(f[1] < 0.0);   // Force should be negative (settlement down)
    }
    
    #[test]
    fn test_temperature_analyzer_assembly() {
        let mut analyzer = TemperatureAnalyzer::new();
        analyzer.add_load(TemperatureLoad::uniform(0, 25.0, 12e-6));
        
        // Single member between nodes 0 and 1
        let props = vec![(200e9, 0.01, 1e-4, 1e-5, 0.3, 0.15)];
        let conn = vec![(0, 1)];
        
        let load_vec = analyzer.assemble_load_vector(&props, &conn, 6);
        
        // Should have 12 DOFs (2 nodes x 6 DOF each)
        assert_eq!(load_vec.len(), 12);
        
        // Axial force at node 0 should be non-zero
        assert!(load_vec[0].abs() > 1e3);
    }
}
