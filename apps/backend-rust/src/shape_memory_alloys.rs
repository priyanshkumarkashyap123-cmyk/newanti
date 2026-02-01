// ============================================================================
// SHAPE MEMORY ALLOYS - Phase 20
// SMA for seismic applications, self-centering, energy dissipation
// Standards: ACI 374.2R, AISC 341 Appendix, NiTiNOL specifications
// ============================================================================

use serde::{Deserialize, Serialize};
use std::f64::consts::PI;

// ============================================================================
// SMA MATERIAL PROPERTIES
// ============================================================================

/// Shape Memory Alloy types
#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
pub enum SmaType {
    NiTi,           // Nitinol (Ni-Ti)
    NiTiNb,         // Ni-Ti-Nb (wide hysteresis)
    CuAlNi,         // Cu-Al-Ni
    CuZnAl,         // Cu-Zn-Al
    FeMnSi,         // Fe-Mn-Si (iron-based)
    FeMnAlNi,       // Fe-Mn-Al-Ni (superelastic)
}

impl SmaType {
    /// Typical austenite finish temperature (°C)
    pub fn af_temperature(&self) -> f64 {
        match self {
            SmaType::NiTi => 10.0,
            SmaType::NiTiNb => 20.0,
            SmaType::CuAlNi => 80.0,
            SmaType::CuZnAl => 20.0,
            SmaType::FeMnSi => 150.0,
            SmaType::FeMnAlNi => 5.0,
        }
    }
    
    /// Density (kg/m³)
    pub fn density(&self) -> f64 {
        match self {
            SmaType::NiTi => 6450.0,
            SmaType::NiTiNb => 6500.0,
            SmaType::CuAlNi => 7100.0,
            SmaType::CuZnAl => 7500.0,
            SmaType::FeMnSi => 7200.0,
            SmaType::FeMnAlNi => 7100.0,
        }
    }
    
    /// Elastic modulus - austenite (GPa)
    pub fn ea(&self) -> f64 {
        match self {
            SmaType::NiTi => 70.0,
            SmaType::NiTiNb => 65.0,
            SmaType::CuAlNi => 85.0,
            SmaType::CuZnAl => 72.0,
            SmaType::FeMnSi => 140.0,
            SmaType::FeMnAlNi => 98.0,
        }
    }
    
    /// Elastic modulus - martensite (GPa)
    pub fn em(&self) -> f64 {
        match self {
            SmaType::NiTi => 30.0,
            SmaType::NiTiNb => 25.0,
            SmaType::CuAlNi => 45.0,
            SmaType::CuZnAl => 35.0,
            SmaType::FeMnSi => 100.0,
            SmaType::FeMnAlNi => 50.0,
        }
    }
    
    /// Maximum recoverable strain (%)
    pub fn max_strain(&self) -> f64 {
        match self {
            SmaType::NiTi => 8.0,
            SmaType::NiTiNb => 6.0,
            SmaType::CuAlNi => 4.0,
            SmaType::CuZnAl => 4.0,
            SmaType::FeMnSi => 3.0,
            SmaType::FeMnAlNi => 5.0,
        }
    }
}

/// SMA material with full properties
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SmaMaterial {
    /// Alloy type
    pub sma_type: SmaType,
    /// Martensite start stress (MPa)
    pub sigma_ms: f64,
    /// Martensite finish stress (MPa)
    pub sigma_mf: f64,
    /// Austenite start stress (MPa)
    pub sigma_as: f64,
    /// Austenite finish stress (MPa)
    pub sigma_af: f64,
    /// Plateau stress loading (MPa)
    pub sigma_plateau_load: f64,
    /// Plateau stress unloading (MPa)
    pub sigma_plateau_unload: f64,
    /// Transformation strain (%)
    pub epsilon_t: f64,
    /// Operating temperature (°C)
    pub temperature: f64,
}

impl SmaMaterial {
    /// Standard NiTi superelastic material
    pub fn niti_superelastic() -> Self {
        Self {
            sma_type: SmaType::NiTi,
            sigma_ms: 450.0,
            sigma_mf: 550.0,
            sigma_as: 300.0,
            sigma_af: 200.0,
            sigma_plateau_load: 500.0,
            sigma_plateau_unload: 250.0,
            epsilon_t: 6.0,
            temperature: 20.0,
        }
    }
    
    /// Wide hysteresis NiTiNb for damping
    pub fn nitinb_damping() -> Self {
        Self {
            sma_type: SmaType::NiTiNb,
            sigma_ms: 400.0,
            sigma_mf: 550.0,
            sigma_as: 150.0,
            sigma_af: 50.0,
            sigma_plateau_load: 475.0,
            sigma_plateau_unload: 100.0,
            epsilon_t: 5.0,
            temperature: 20.0,
        }
    }
    
    /// Austenite elastic modulus (GPa)
    pub fn ea(&self) -> f64 {
        self.sma_type.ea()
    }
    
    /// Martensite elastic modulus (GPa)
    pub fn em(&self) -> f64 {
        self.sma_type.em()
    }
    
    /// Hysteresis width (MPa)
    pub fn hysteresis(&self) -> f64 {
        self.sigma_plateau_load - self.sigma_plateau_unload
    }
    
    /// Energy dissipation per cycle (MJ/m³)
    pub fn energy_per_cycle(&self, strain: f64) -> f64 {
        // Simplified: area of hysteresis loop
        let strain_ratio = (strain / self.epsilon_t).min(1.0);
        self.hysteresis() * strain_ratio * self.epsilon_t / 100.0
    }
    
    /// Equivalent viscous damping ratio
    pub fn damping_ratio(&self, strain: f64) -> f64 {
        let e_d = self.energy_per_cycle(strain);
        let e_so = 0.5 * self.sigma_plateau_load * strain / 100.0;
        
        if e_so > 0.0 {
            e_d / (4.0 * PI * e_so)
        } else {
            0.0
        }
    }
    
    /// Stress for given strain (loading)
    pub fn stress_loading(&self, strain: f64) -> f64 {
        let strain_pct = strain * 100.0;
        
        if strain_pct < self.sigma_ms / (self.ea() * 10.0) {
            // Elastic austenite
            self.ea() * 1000.0 * strain
        } else if strain_pct < self.epsilon_t {
            // Transformation plateau
            self.sigma_plateau_load
        } else {
            // Martensite phase
            self.sigma_mf + self.em() * 1000.0 * (strain - self.epsilon_t / 100.0)
        }
    }
    
    /// Stress for given strain (unloading)
    pub fn stress_unloading(&self, strain: f64) -> f64 {
        let strain_pct = strain * 100.0;
        
        if strain_pct < self.epsilon_t {
            // Unloading plateau
            self.sigma_plateau_unload.max(self.ea() * 1000.0 * strain)
        } else {
            // Elastic martensite unloading
            self.sigma_mf + self.em() * 1000.0 * (strain - self.epsilon_t / 100.0)
        }
    }
}

// ============================================================================
// SMA ELEMENTS
// ============================================================================

/// SMA bar/wire element
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SmaBar {
    /// Material
    pub material: SmaMaterial,
    /// Diameter (mm)
    pub diameter: f64,
    /// Length (mm)
    pub length: f64,
    /// Number of bars
    pub n_bars: usize,
}

impl SmaBar {
    pub fn new(material: SmaMaterial, diameter: f64, length: f64, n_bars: usize) -> Self {
        Self { material, diameter, length, n_bars }
    }
    
    /// Single bar area (mm²)
    pub fn area_single(&self) -> f64 {
        PI * self.diameter.powi(2) / 4.0
    }
    
    /// Total area (mm²)
    pub fn area_total(&self) -> f64 {
        self.area_single() * self.n_bars as f64
    }
    
    /// Initial stiffness (kN/mm)
    pub fn stiffness_initial(&self) -> f64 {
        self.material.ea() * self.area_total() / self.length
    }
    
    /// Post-yield stiffness (kN/mm)
    pub fn stiffness_postyield(&self) -> f64 {
        // Near zero during transformation
        0.05 * self.stiffness_initial()
    }
    
    /// Yield force (kN)
    pub fn force_yield(&self) -> f64 {
        self.material.sigma_ms * self.area_total() / 1000.0
    }
    
    /// Maximum force (kN)
    pub fn force_max(&self) -> f64 {
        self.material.sigma_mf * self.area_total() / 1000.0
    }
    
    /// Displacement at transformation start (mm)
    pub fn disp_transform_start(&self) -> f64 {
        self.material.sigma_ms / (self.material.ea() * 1000.0) * self.length
    }
    
    /// Displacement at transformation end (mm)
    pub fn disp_transform_end(&self) -> f64 {
        self.material.epsilon_t / 100.0 * self.length
    }
    
    /// Force at given displacement (loading)
    pub fn force_at_disp(&self, disp: f64) -> f64 {
        let strain = disp / self.length;
        let stress = self.material.stress_loading(strain);
        stress * self.area_total() / 1000.0
    }
    
    /// Elongation at ultimate (mm)
    pub fn elongation_ultimate(&self) -> f64 {
        self.material.epsilon_t / 100.0 * self.length
    }
}

/// SMA spring element
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SmaSpring {
    /// Material
    pub material: SmaMaterial,
    /// Wire diameter (mm)
    pub wire_dia: f64,
    /// Coil diameter (mm)
    pub coil_dia: f64,
    /// Number of active coils
    pub n_coils: f64,
}

impl SmaSpring {
    pub fn new(material: SmaMaterial, wire_dia: f64, coil_dia: f64, n_coils: f64) -> Self {
        Self { material, wire_dia, coil_dia, n_coils }
    }
    
    /// Spring index
    pub fn spring_index(&self) -> f64 {
        self.coil_dia / self.wire_dia
    }
    
    /// Wahl factor
    pub fn wahl_factor(&self) -> f64 {
        let c = self.spring_index();
        (4.0 * c - 1.0) / (4.0 * c - 4.0) + 0.615 / c
    }
    
    /// Initial stiffness (N/mm)
    pub fn stiffness_initial(&self) -> f64 {
        let g = self.material.ea() / 2.6 * 1000.0; // Shear modulus (MPa)
        g * self.wire_dia.powi(4) / (8.0 * self.coil_dia.powi(3) * self.n_coils)
    }
    
    /// Maximum shear stress at load (MPa)
    pub fn max_stress(&self, force: f64) -> f64 {
        self.wahl_factor() * 8.0 * force * self.coil_dia / (PI * self.wire_dia.powi(3))
    }
    
    /// Allowable force for superelastic range (N)
    pub fn allowable_force(&self) -> f64 {
        let tau_max = self.material.sigma_plateau_load / 1.732; // von Mises
        tau_max * PI * self.wire_dia.powi(3) / (8.0 * self.coil_dia * self.wahl_factor())
    }
    
    /// Free length (mm)
    pub fn free_length(&self) -> f64 {
        (self.n_coils + 2.0) * self.wire_dia
    }
    
    /// Solid length (mm)
    pub fn solid_length(&self) -> f64 {
        (self.n_coils + 2.0) * self.wire_dia * 1.1
    }
}

// ============================================================================
// SMA APPLICATIONS
// ============================================================================

/// Self-centering beam-column connection
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SmaSelfCenteringConnection {
    /// Post-tensioning SMA bars
    pub pt_bars: SmaBar,
    /// Beam depth (mm)
    pub beam_depth: f64,
    /// Beam flange width (mm)
    pub beam_width: f64,
    /// Column face depth (mm)
    pub column_depth: f64,
    /// Initial post-tension force (kN)
    pub initial_pt_force: f64,
    /// Decompression moment (kNm)
    pub decompression_moment: f64,
}

impl SmaSelfCenteringConnection {
    pub fn new(pt_bars: SmaBar, beam_depth: f64, beam_width: f64, column_depth: f64) -> Self {
        // Estimate initial PT force (20% of yield)
        let initial_pt = pt_bars.force_yield() * 0.2;
        
        // Decompression moment
        let lever = beam_depth - 50.0; // Approximate lever arm
        let m_dec = initial_pt * lever / 1000.0;
        
        Self {
            pt_bars,
            beam_depth,
            beam_width,
            column_depth,
            initial_pt_force: initial_pt,
            decompression_moment: m_dec,
        }
    }
    
    /// Gap opening at given rotation
    pub fn gap_opening(&self, rotation: f64) -> f64 {
        rotation * self.beam_depth
    }
    
    /// Moment capacity at rotation
    pub fn moment_at_rotation(&self, rotation: f64) -> f64 {
        let gap = self.gap_opening(rotation);
        let bar_elongation = gap; // Simplified
        
        let pt_force = self.pt_bars.force_at_disp(bar_elongation);
        let lever = self.beam_depth - 50.0;
        
        pt_force * lever / 1000.0
    }
    
    /// Rotational stiffness (kNm/rad)
    pub fn stiffness_initial(&self) -> f64 {
        let lever = self.beam_depth - 50.0;
        self.pt_bars.stiffness_initial() * lever.powi(2) / 1000.0
    }
    
    /// Target drift capacity (rad)
    pub fn drift_capacity(&self) -> f64 {
        self.pt_bars.elongation_ultimate() / self.beam_depth
    }
    
    /// Re-centering ratio
    pub fn recentering_ratio(&self) -> f64 {
        // Ratio of restoring force to maximum force
        let f_restore = self.pt_bars.material.sigma_plateau_unload * 
                       self.pt_bars.area_total() / 1000.0;
        let f_max = self.pt_bars.force_max();
        
        f_restore / f_max
    }
    
    /// Is self-centering maintained?
    pub fn is_self_centering(&self, rotation: f64) -> bool {
        self.recentering_ratio() > 0.3 && 
        rotation < self.drift_capacity()
    }
}

/// SMA bracing system
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SmaBracingSystem {
    /// SMA bars
    pub bars: SmaBar,
    /// Brace length (mm)
    pub brace_length: f64,
    /// Brace angle from horizontal (deg)
    pub angle: f64,
    /// Pre-strain (%)
    pub pre_strain: f64,
}

impl SmaBracingSystem {
    pub fn new(bars: SmaBar, brace_length: f64, angle: f64) -> Self {
        Self {
            bars,
            brace_length,
            angle,
            pre_strain: 0.0,
        }
    }
    
    /// With pre-strain
    pub fn with_prestrain(mut self, pre_strain: f64) -> Self {
        self.pre_strain = pre_strain;
        self
    }
    
    /// Horizontal stiffness contribution (kN/mm)
    pub fn horizontal_stiffness(&self) -> f64 {
        let cos_angle = (self.angle * PI / 180.0).cos();
        self.bars.stiffness_initial() * cos_angle.powi(2)
    }
    
    /// Maximum horizontal force (kN)
    pub fn max_horizontal_force(&self) -> f64 {
        let cos_angle = (self.angle * PI / 180.0).cos();
        self.bars.force_max() * cos_angle
    }
    
    /// Drift at yield
    pub fn drift_at_yield(&self, story_height: f64) -> f64 {
        let cos_angle = (self.angle * PI / 180.0).cos();
        let axial_disp = self.bars.disp_transform_start();
        
        axial_disp / cos_angle / story_height
    }
    
    /// Energy dissipation per cycle (kJ)
    pub fn energy_per_cycle(&self, drift: f64, story_height: f64) -> f64 {
        let cos_angle = (self.angle * PI / 180.0).cos();
        let axial_strain = drift * story_height * cos_angle / self.bars.length;
        
        let volume = self.bars.area_total() * self.bars.length / 1e9; // m³
        self.bars.material.energy_per_cycle(axial_strain * 100.0) * volume * 1000.0
    }
    
    /// Equivalent damping
    pub fn equivalent_damping(&self, drift: f64, story_height: f64) -> f64 {
        let cos_angle = (self.angle * PI / 180.0).cos();
        let axial_strain = drift * story_height * cos_angle / self.bars.length;
        
        self.bars.material.damping_ratio(axial_strain * 100.0)
    }
}

/// SMA coupling beam
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SmaCouplingBeam {
    /// SMA diagonal bars
    pub sma_bars: SmaBar,
    /// Beam span (mm)
    pub span: f64,
    /// Beam depth (mm)
    pub depth: f64,
    /// Beam width (mm)
    pub width: f64,
    /// Diagonal angle (deg)
    pub diagonal_angle: f64,
}

impl SmaCouplingBeam {
    pub fn new(sma_bars: SmaBar, span: f64, depth: f64, width: f64) -> Self {
        // Calculate diagonal angle
        let angle = (depth / span).atan() * 180.0 / PI;
        
        Self {
            sma_bars,
            span,
            depth,
            width,
            diagonal_angle: angle,
        }
    }
    
    /// Shear capacity (kN)
    pub fn shear_capacity(&self) -> f64 {
        let sin_angle = (self.diagonal_angle * PI / 180.0).sin();
        2.0 * self.sma_bars.force_max() * sin_angle // Two diagonals
    }
    
    /// Coupling ratio contribution
    pub fn coupling_ratio(&self, wall_moment: f64, wall_spacing: f64) -> f64 {
        let coupling_moment = self.shear_capacity() * wall_spacing / 1000.0;
        coupling_moment / (wall_moment + coupling_moment)
    }
    
    /// Chord rotation at yield
    pub fn rotation_yield(&self) -> f64 {
        let diag_length = (self.span.powi(2) + self.depth.powi(2)).sqrt();
        let diag_elongation = self.sma_bars.disp_transform_start();
        
        diag_elongation / diag_length * 2.0
    }
    
    /// Ultimate rotation capacity
    pub fn rotation_ultimate(&self) -> f64 {
        let diag_length = (self.span.powi(2) + self.depth.powi(2)).sqrt();
        let diag_elongation = self.sma_bars.elongation_ultimate();
        
        diag_elongation / diag_length * 2.0
    }
    
    /// Self-centering capability
    pub fn has_self_centering(&self) -> bool {
        self.sma_bars.material.sigma_plateau_unload > 0.2 * self.sma_bars.material.sigma_plateau_load
    }
}

// ============================================================================
// TESTS
// ============================================================================

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_sma_type_properties() {
        let niti = SmaType::NiTi;
        assert!((niti.ea() - 70.0).abs() < 1.0);
        assert!((niti.max_strain() - 8.0).abs() < 0.5);
    }

    #[test]
    fn test_sma_material() {
        let mat = SmaMaterial::niti_superelastic();
        
        assert!(mat.hysteresis() > 200.0);
        assert!(mat.ea() > mat.em());
    }

    #[test]
    fn test_sma_damping() {
        let mat = SmaMaterial::nitinb_damping();
        let damping = mat.damping_ratio(4.0);
        
        assert!(damping > 0.1); // Significant damping
    }

    #[test]
    fn test_sma_bar() {
        let mat = SmaMaterial::niti_superelastic();
        let bar = SmaBar::new(mat, 25.0, 1000.0, 4);
        
        let area = bar.area_total();
        assert!((area - 1963.5).abs() < 1.0);
        
        let k = bar.stiffness_initial();
        assert!(k > 100.0);
    }

    #[test]
    fn test_sma_bar_force() {
        let mat = SmaMaterial::niti_superelastic();
        let bar = SmaBar::new(mat, 20.0, 1000.0, 2);
        
        let f_yield = bar.force_yield();
        let f_max = bar.force_max();
        
        assert!(f_max > f_yield);
    }

    #[test]
    fn test_sma_spring() {
        let mat = SmaMaterial::niti_superelastic();
        let spring = SmaSpring::new(mat, 5.0, 30.0, 10.0);
        
        let k = spring.stiffness_initial();
        assert!(k > 0.0); // Stiffness must be positive
        
        let f_allow = spring.allowable_force();
        assert!(f_allow > 0.0); // Allowable force must be positive
    }

    #[test]
    fn test_self_centering_connection() {
        let mat = SmaMaterial::niti_superelastic();
        let bars = SmaBar::new(mat, 20.0, 2000.0, 4);
        
        let conn = SmaSelfCenteringConnection::new(bars, 600.0, 200.0, 400.0);
        
        assert!(conn.decompression_moment > 10.0);
        assert!(conn.recentering_ratio() > 0.3);
        assert!(conn.is_self_centering(0.03));
    }

    #[test]
    fn test_sma_bracing() {
        let mat = SmaMaterial::niti_superelastic();
        let bars = SmaBar::new(mat, 25.0, 4000.0, 2);
        
        let brace = SmaBracingSystem::new(bars, 5000.0, 45.0);
        
        let k_horiz = brace.horizontal_stiffness();
        assert!(k_horiz > 0.0); // Horizontal stiffness must be positive
        
        let damping = brace.equivalent_damping(0.02, 3500.0);
        assert!(damping > 0.0); // Damping ratio must be positive
    }

    #[test]
    fn test_sma_coupling_beam() {
        let mat = SmaMaterial::niti_superelastic();
        let bars = SmaBar::new(mat, 20.0, 1500.0, 4);
        
        let beam = SmaCouplingBeam::new(bars, 1200.0, 600.0, 300.0);
        
        let v_cap = beam.shear_capacity();
        assert!(v_cap > 500.0);
        
        assert!(beam.has_self_centering());
    }

    #[test]
    fn test_stress_strain() {
        let mat = SmaMaterial::niti_superelastic();
        
        let stress_elastic = mat.stress_loading(0.005);
        let stress_plateau = mat.stress_loading(0.03);
        
        assert!(stress_elastic < mat.sigma_ms);
        assert!((stress_plateau - mat.sigma_plateau_load).abs() < 50.0);
    }

    #[test]
    fn test_energy_dissipation() {
        let mat = SmaMaterial::nitinb_damping();
        let energy = mat.energy_per_cycle(4.0);
        
        assert!(energy > 5.0); // MJ/m³
    }

    #[test]
    fn test_coupling_rotation() {
        let mat = SmaMaterial::niti_superelastic();
        let bars = SmaBar::new(mat, 25.0, 2000.0, 4);
        
        let beam = SmaCouplingBeam::new(bars, 1500.0, 800.0, 300.0);
        
        let rot_yield = beam.rotation_yield();
        let rot_ult = beam.rotation_ultimate();
        
        assert!(rot_ult > rot_yield);
        assert!(rot_ult > 0.03); // At least 3% rotation capacity
    }
}
