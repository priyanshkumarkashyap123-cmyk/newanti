//! Composite Materials and Laminate Analysis
//!
//! Classical Laminate Theory (CLT) implementation for fiber-reinforced composites.
//! Supports layup definition, failure analysis, and laminate optimization.
//!
//! ## Capabilities
//! - **Ply Properties** - Orthotropic material characterization
//! - **Laminate Theory** - ABD matrix computation
//! - **Failure Criteria** - Tsai-Hill, Tsai-Wu, Hashin, Puck
//! - **Progressive Failure** - Ply-by-ply damage propagation
//!
//! ## Coordinate Systems
//! - 1-direction: Fiber direction (longitudinal)
//! - 2-direction: Transverse to fibers
//! - 3-direction: Out-of-plane (thickness)

use serde::{Deserialize, Serialize};
use std::f64::consts::PI;

// ============================================================================
// PLY MATERIAL PROPERTIES
// ============================================================================

/// Orthotropic ply material properties
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PlyMaterial {
    pub id: usize,
    pub name: String,

    // Elastic constants
    pub e1: f64,     // Young's modulus in fiber direction [Pa]
    pub e2: f64,     // Young's modulus transverse to fibers [Pa]
    pub g12: f64,    // In-plane shear modulus [Pa]
    pub nu12: f64,   // Major Poisson's ratio

    // Optional 3D properties
    pub e3: Option<f64>,
    pub g13: Option<f64>,
    pub g23: Option<f64>,
    pub nu13: Option<f64>,
    pub nu23: Option<f64>,

    // Strength values (tension positive, compression negative)
    pub xt: f64,     // Longitudinal tensile strength [Pa]
    pub xc: f64,     // Longitudinal compressive strength [Pa]
    pub yt: f64,     // Transverse tensile strength [Pa]
    pub yc: f64,     // Transverse compressive strength [Pa]
    pub s12: f64,    // In-plane shear strength [Pa]

    // Thermal properties
    pub alpha1: f64, // CTE in fiber direction [1/K]
    pub alpha2: f64, // CTE transverse to fibers [1/K]

    // Physical properties
    pub density: f64,    // [kg/m³]
    pub ply_thickness: f64, // Nominal ply thickness [m]
}

impl PlyMaterial {
    /// CFRP (Carbon Fiber Reinforced Polymer) - T300/934
    pub fn cfrp_t300() -> Self {
        PlyMaterial {
            id: 1,
            name: "CFRP T300/934".to_string(),
            e1: 148.0e9,
            e2: 9.65e9,
            g12: 4.55e9,
            nu12: 0.3,
            e3: Some(9.65e9),
            g13: Some(4.55e9),
            g23: Some(3.2e9),
            nu13: Some(0.3),
            nu23: Some(0.5),
            xt: 1500.0e6,
            xc: 1200.0e6,
            yt: 40.0e6,
            yc: 185.0e6,
            s12: 73.0e6,
            alpha1: -0.3e-6,
            alpha2: 28.1e-6,
            density: 1600.0,
            ply_thickness: 0.125e-3,
        }
    }

    /// GFRP (Glass Fiber Reinforced Polymer) - E-glass/Epoxy
    pub fn gfrp_eglass() -> Self {
        PlyMaterial {
            id: 2,
            name: "GFRP E-glass/Epoxy".to_string(),
            e1: 38.6e9,
            e2: 8.27e9,
            g12: 4.14e9,
            nu12: 0.26,
            e3: Some(8.27e9),
            g13: Some(4.14e9),
            g23: Some(3.2e9),
            nu13: Some(0.26),
            nu23: Some(0.42),
            xt: 1062.0e6,
            xc: 610.0e6,
            yt: 31.0e6,
            yc: 118.0e6,
            s12: 72.0e6,
            alpha1: 8.6e-6,
            alpha2: 26.4e-6,
            density: 1800.0,
            ply_thickness: 0.2e-3,
        }
    }

    /// Aramid/Epoxy (Kevlar 49)
    pub fn aramid_kevlar49() -> Self {
        PlyMaterial {
            id: 3,
            name: "Aramid Kevlar 49/Epoxy".to_string(),
            e1: 76.0e9,
            e2: 5.5e9,
            g12: 2.3e9,
            nu12: 0.34,
            e3: None,
            g13: None,
            g23: None,
            nu13: None,
            nu23: None,
            xt: 1400.0e6,
            xc: 235.0e6,
            yt: 12.0e6,
            yc: 53.0e6,
            s12: 34.0e6,
            alpha1: -4.0e-6,
            alpha2: 60.0e-6,
            density: 1380.0,
            ply_thickness: 0.127e-3,
        }
    }

    /// Get the reduced stiffness matrix [Q] in material coordinates
    pub fn get_q_matrix(&self) -> [[f64; 3]; 3] {
        let nu21 = self.nu12 * self.e2 / self.e1;
        let d = 1.0 - self.nu12 * nu21;

        [
            [self.e1 / d, self.nu12 * self.e2 / d, 0.0],
            [self.nu12 * self.e2 / d, self.e2 / d, 0.0],
            [0.0, 0.0, self.g12],
        ]
    }

    /// Get compliance matrix [S] in material coordinates
    pub fn get_s_matrix(&self) -> [[f64; 3]; 3] {
        [
            [1.0 / self.e1, -self.nu12 / self.e1, 0.0],
            [-self.nu12 / self.e1, 1.0 / self.e2, 0.0],
            [0.0, 0.0, 1.0 / self.g12],
        ]
    }
}

// ============================================================================
// PLY AND LAYUP DEFINITIONS
// ============================================================================

/// Single ply definition
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Ply {
    pub id: usize,
    pub material_id: usize,
    pub thickness: f64,          // [m]
    pub angle: f64,              // Fiber orientation [degrees]
    pub z_bottom: f64,           // Distance from laminate midplane to ply bottom
    pub z_top: f64,              // Distance from laminate midplane to ply top
}

impl Ply {
    pub fn new(id: usize, material_id: usize, thickness: f64, angle: f64) -> Self {
        Ply {
            id,
            material_id,
            thickness,
            angle,
            z_bottom: 0.0,
            z_top: 0.0,
        }
    }

    /// Transformation matrix for angle theta
    /// [T] transforms strains from laminate to material coordinates
    pub fn get_strain_transformation(&self) -> [[f64; 3]; 3] {
        let theta = self.angle * PI / 180.0;
        let c = theta.cos();
        let s = theta.sin();
        let c2 = c * c;
        let s2 = s * s;
        let cs = c * s;

        [
            [c2, s2, 2.0 * cs],
            [s2, c2, -2.0 * cs],
            [-cs, cs, c2 - s2],
        ]
    }

    /// Get transformed reduced stiffness [Q_bar]
    pub fn get_q_bar(&self, material: &PlyMaterial) -> [[f64; 3]; 3] {
        let q = material.get_q_matrix();
        let theta = self.angle * PI / 180.0;
        let c = theta.cos();
        let s = theta.sin();
        let c2 = c * c;
        let s2 = s * s;
        let c3 = c2 * c;
        let s3 = s2 * s;
        let c4 = c2 * c2;
        let s4 = s2 * s2;

        let q11 = q[0][0];
        let q12 = q[0][1];
        let q22 = q[1][1];
        let q66 = q[2][2];

        // Transformed stiffness components
        let qbar11 = q11 * c4 + 2.0 * (q12 + 2.0 * q66) * s2 * c2 + q22 * s4;
        let qbar12 = (q11 + q22 - 4.0 * q66) * s2 * c2 + q12 * (s4 + c4);
        let qbar22 = q11 * s4 + 2.0 * (q12 + 2.0 * q66) * s2 * c2 + q22 * c4;
        let qbar16 = (q11 - q12 - 2.0 * q66) * s * c3 + (q12 - q22 + 2.0 * q66) * s3 * c;
        let qbar26 = (q11 - q12 - 2.0 * q66) * s3 * c + (q12 - q22 + 2.0 * q66) * s * c3;
        let qbar66 = (q11 + q22 - 2.0 * q12 - 2.0 * q66) * s2 * c2 + q66 * (s4 + c4);

        [
            [qbar11, qbar12, qbar16],
            [qbar12, qbar22, qbar26],
            [qbar16, qbar26, qbar66],
        ]
    }
}

/// Laminate layup definition
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Laminate {
    pub id: usize,
    pub name: String,
    pub plies: Vec<Ply>,
    pub materials: Vec<PlyMaterial>,
    pub symmetric: bool,
}

impl Laminate {
    pub fn new(id: usize, name: String) -> Self {
        Laminate {
            id,
            name,
            plies: Vec::new(),
            materials: Vec::new(),
            symmetric: false,
        }
    }

    /// Create from angle sequence (e.g., [0, 45, -45, 90])
    pub fn from_angles(
        id: usize,
        name: String,
        angles: &[f64],
        material: PlyMaterial,
        symmetric: bool,
    ) -> Self {
        let ply_thickness = material.ply_thickness;
        let mut laminate = Laminate::new(id, name);
        laminate.materials.push(material);
        laminate.symmetric = symmetric;

        // Build ply stack
        let mut plies = Vec::new();
        for (i, &angle) in angles.iter().enumerate() {
            plies.push(Ply::new(i, 0, ply_thickness, angle));
        }

        // Add symmetric part if needed
        if symmetric {
            let n = plies.len();
            for i in (0..n).rev() {
                let mut ply = plies[i].clone();
                ply.id = plies.len() + (n - 1 - i);
                plies.push(ply);
            }
        }

        // Compute z-coordinates
        let total_thickness: f64 = plies.iter().map(|p| p.thickness).sum();
        let mut z = -total_thickness / 2.0;

        for ply in &mut plies {
            ply.z_bottom = z;
            z += ply.thickness;
            ply.z_top = z;
        }

        laminate.plies = plies;
        laminate
    }

    /// Standard layups
    pub fn quasi_isotropic(material: PlyMaterial) -> Self {
        Self::from_angles(
            0,
            "Quasi-Isotropic [0/±45/90]s".to_string(),
            &[0.0, 45.0, -45.0, 90.0],
            material,
            true,
        )
    }

    pub fn cross_ply(material: PlyMaterial) -> Self {
        Self::from_angles(
            0,
            "Cross-Ply [0/90]s".to_string(),
            &[0.0, 90.0],
            material,
            true,
        )
    }

    pub fn unidirectional(material: PlyMaterial, n_plies: usize) -> Self {
        let angles = vec![0.0; n_plies];
        Self::from_angles(
            0,
            format!("[0]_{}", n_plies),
            &angles,
            material,
            false,
        )
    }

    /// Total laminate thickness
    pub fn total_thickness(&self) -> f64 {
        self.plies.iter().map(|p| p.thickness).sum()
    }

    /// Get material for ply
    pub fn get_material(&self, ply: &Ply) -> Option<&PlyMaterial> {
        self.materials.get(ply.material_id)
    }
}

// ============================================================================
// ABD MATRIX (CLASSICAL LAMINATE THEORY)
// ============================================================================

/// ABD matrix computation for CLT
#[derive(Debug, Clone)]
pub struct ABDMatrix {
    pub a: [[f64; 3]; 3],  // Extensional stiffness
    pub b: [[f64; 3]; 3],  // Coupling stiffness
    pub d: [[f64; 3]; 3],  // Bending stiffness
}

impl ABDMatrix {
    /// Compute ABD matrix from laminate
    pub fn compute(laminate: &Laminate) -> Self {
        let mut a = [[0.0; 3]; 3];
        let mut b = [[0.0; 3]; 3];
        let mut d = [[0.0; 3]; 3];

        for ply in &laminate.plies {
            let material = laminate.get_material(ply)
                .expect("Material not found");

            let q_bar = ply.get_q_bar(material);
            let z_k = ply.z_top;
            let z_k1 = ply.z_bottom;

            // A = Σ Q_bar * (z_k - z_{k-1})
            // B = (1/2) * Σ Q_bar * (z_k² - z_{k-1}²)
            // D = (1/3) * Σ Q_bar * (z_k³ - z_{k-1}³)

            let dz = z_k - z_k1;
            let dz2 = z_k.powi(2) - z_k1.powi(2);
            let dz3 = z_k.powi(3) - z_k1.powi(3);

            for i in 0..3 {
                for j in 0..3 {
                    a[i][j] += q_bar[i][j] * dz;
                    b[i][j] += 0.5 * q_bar[i][j] * dz2;
                    d[i][j] += (1.0 / 3.0) * q_bar[i][j] * dz3;
                }
            }
        }

        ABDMatrix { a, b, d }
    }

    /// Get full 6x6 ABD matrix
    pub fn full_matrix(&self) -> [[f64; 6]; 6] {
        let mut abd = [[0.0; 6]; 6];

        for i in 0..3 {
            for j in 0..3 {
                abd[i][j] = self.a[i][j];
                abd[i][j + 3] = self.b[i][j];
                abd[i + 3][j] = self.b[i][j];
                abd[i + 3][j + 3] = self.d[i][j];
            }
        }

        abd
    }

    /// Compute equivalent engineering properties
    pub fn equivalent_properties(&self, thickness: f64) -> LaminateProperties {
        // E_x = (A11 * A22 - A12²) / (A22 * h)
        // E_y = (A11 * A22 - A12²) / (A11 * h)
        // G_xy = A66 / h
        // nu_xy = A12 / A22

        let h = thickness;
        let det_a = self.a[0][0] * self.a[1][1] - self.a[0][1].powi(2);

        LaminateProperties {
            ex: det_a / (self.a[1][1] * h),
            ey: det_a / (self.a[0][0] * h),
            gxy: self.a[2][2] / h,
            nu_xy: self.a[0][1] / self.a[1][1],
            nu_yx: self.a[0][1] / self.a[0][0],
        }
    }

    /// Invert ABD matrix
    pub fn invert(&self) -> Option<ABDMatrixInverse> {
        let abd = self.full_matrix();
        let inv = invert_6x6(&abd)?;

        let mut a_inv = [[0.0; 3]; 3];
        let mut b_inv = [[0.0; 3]; 3];
        let mut d_inv = [[0.0; 3]; 3];

        for i in 0..3 {
            for j in 0..3 {
                a_inv[i][j] = inv[i][j];
                b_inv[i][j] = inv[i][j + 3];
                d_inv[i][j] = inv[i + 3][j + 3];
            }
        }

        Some(ABDMatrixInverse { a: a_inv, b: b_inv, d: d_inv })
    }
}

/// Inverse ABD matrix
#[derive(Debug, Clone)]
pub struct ABDMatrixInverse {
    pub a: [[f64; 3]; 3],
    pub b: [[f64; 3]; 3],
    pub d: [[f64; 3]; 3],
}

/// Equivalent laminate properties
#[derive(Debug, Clone)]
pub struct LaminateProperties {
    pub ex: f64,
    pub ey: f64,
    pub gxy: f64,
    pub nu_xy: f64,
    pub nu_yx: f64,
}

// ============================================================================
// FAILURE CRITERIA
// ============================================================================

/// Failure criterion type
#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
pub enum FailureCriterion {
    MaxStress,
    MaxStrain,
    TsaiHill,
    TsaiWu,
    Hashin,
    Puck,
    LaRC,
}

/// Failure result
#[derive(Debug, Clone)]
pub struct FailureResult {
    pub criterion: FailureCriterion,
    pub failure_index: f64,      // >1 means failure
    pub failed: bool,
    pub mode: FailureMode,
    pub margin_of_safety: f64,   // (1/FI) - 1
}

/// Failure mode
#[derive(Debug, Clone, Copy, PartialEq)]
pub enum FailureMode {
    None,
    FiberTension,
    FiberCompression,
    MatrixTension,
    MatrixCompression,
    Shear,
    Delamination,
    Combined,
}

impl FailureResult {
    pub fn no_failure() -> Self {
        FailureResult {
            criterion: FailureCriterion::MaxStress,
            failure_index: 0.0,
            failed: false,
            mode: FailureMode::None,
            margin_of_safety: f64::INFINITY,
        }
    }
}

/// Failure analysis for a ply
pub struct FailureAnalysis;

impl FailureAnalysis {
    /// Maximum stress criterion
    pub fn max_stress(stress: &[f64; 3], material: &PlyMaterial) -> FailureResult {
        // stress = [σ1, σ2, τ12] in material coordinates
        let sigma1 = stress[0];
        let sigma2 = stress[1];
        let tau12 = stress[2].abs();

        let mut fi = 0.0;
        let mut mode = FailureMode::None;

        // Fiber direction
        if sigma1 > 0.0 {
            let fi1 = sigma1 / material.xt;
            if fi1 > fi {
                fi = fi1;
                mode = FailureMode::FiberTension;
            }
        } else {
            let fi1 = sigma1.abs() / material.xc;
            if fi1 > fi {
                fi = fi1;
                mode = FailureMode::FiberCompression;
            }
        }

        // Transverse direction
        if sigma2 > 0.0 {
            let fi2 = sigma2 / material.yt;
            if fi2 > fi {
                fi = fi2;
                mode = FailureMode::MatrixTension;
            }
        } else {
            let fi2 = sigma2.abs() / material.yc;
            if fi2 > fi {
                fi = fi2;
                mode = FailureMode::MatrixCompression;
            }
        }

        // Shear
        let fi12 = tau12 / material.s12;
        if fi12 > fi {
            fi = fi12;
            mode = FailureMode::Shear;
        }

        FailureResult {
            criterion: FailureCriterion::MaxStress,
            failure_index: fi,
            failed: fi >= 1.0,
            mode,
            margin_of_safety: if fi > 0.0 { 1.0 / fi - 1.0 } else { f64::INFINITY },
        }
    }

    /// Tsai-Hill criterion
    pub fn tsai_hill(stress: &[f64; 3], material: &PlyMaterial) -> FailureResult {
        let sigma1 = stress[0];
        let sigma2 = stress[1];
        let tau12 = stress[2];

        // Use appropriate strength based on sign
        let x = if sigma1 >= 0.0 { material.xt } else { material.xc };
        let y = if sigma2 >= 0.0 { material.yt } else { material.yc };

        // FI = (σ1/X)² - (σ1*σ2)/X² + (σ2/Y)² + (τ12/S)²
        let fi = (sigma1 / x).powi(2) - (sigma1 * sigma2) / x.powi(2)
            + (sigma2 / y).powi(2) + (tau12 / material.s12).powi(2);

        let failure_index = fi.sqrt();

        FailureResult {
            criterion: FailureCriterion::TsaiHill,
            failure_index,
            failed: fi >= 1.0,
            mode: FailureMode::Combined,
            margin_of_safety: if failure_index > 0.0 { 1.0 / failure_index - 1.0 } else { f64::INFINITY },
        }
    }

    /// Tsai-Wu criterion
    pub fn tsai_wu(stress: &[f64; 3], material: &PlyMaterial) -> FailureResult {
        let sigma1 = stress[0];
        let sigma2 = stress[1];
        let tau12 = stress[2];

        // Strength parameters
        let f1 = 1.0 / material.xt - 1.0 / material.xc;
        let f2 = 1.0 / material.yt - 1.0 / material.yc;
        let f11 = 1.0 / (material.xt * material.xc);
        let f22 = 1.0 / (material.yt * material.yc);
        let f66 = 1.0 / material.s12.powi(2);

        // Interaction coefficient (typically -0.5 to 0)
        let f12 = -0.5 * (f11 * f22).sqrt();

        // FI = f1*σ1 + f2*σ2 + f11*σ1² + f22*σ2² + f66*τ12² + 2*f12*σ1*σ2
        let fi = f1 * sigma1 + f2 * sigma2
            + f11 * sigma1.powi(2) + f22 * sigma2.powi(2)
            + f66 * tau12.powi(2) + 2.0 * f12 * sigma1 * sigma2;

        FailureResult {
            criterion: FailureCriterion::TsaiWu,
            failure_index: fi,
            failed: fi >= 1.0,
            mode: FailureMode::Combined,
            margin_of_safety: if fi > 0.0 { 1.0 / fi - 1.0 } else { f64::INFINITY },
        }
    }

    /// Hashin criterion (distinguishes fiber/matrix failure)
    pub fn hashin(stress: &[f64; 3], material: &PlyMaterial) -> FailureResult {
        let sigma1 = stress[0];
        let sigma2 = stress[1];
        let tau12 = stress[2];

        let mut fi = 0.0;
        let mut mode = FailureMode::None;

        // Fiber tension
        if sigma1 > 0.0 {
            let fi_ft = (sigma1 / material.xt).powi(2) + (tau12 / material.s12).powi(2);
            if fi_ft > fi {
                fi = fi_ft;
                mode = FailureMode::FiberTension;
            }
        }

        // Fiber compression
        if sigma1 < 0.0 {
            let fi_fc = (sigma1 / material.xc).powi(2);
            if fi_fc > fi {
                fi = fi_fc;
                mode = FailureMode::FiberCompression;
            }
        }

        // Matrix tension
        if sigma2 > 0.0 {
            let fi_mt = (sigma2 / material.yt).powi(2) + (tau12 / material.s12).powi(2);
            if fi_mt > fi {
                fi = fi_mt;
                mode = FailureMode::MatrixTension;
            }
        }

        // Matrix compression
        if sigma2 < 0.0 {
            let fi_mc = (sigma2 / (2.0 * material.s12)).powi(2)
                + ((material.yc / (2.0 * material.s12)).powi(2) - 1.0) * sigma2 / material.yc
                + (tau12 / material.s12).powi(2);
            if fi_mc > fi {
                fi = fi_mc;
                mode = FailureMode::MatrixCompression;
            }
        }

        let failure_index = fi.sqrt();

        FailureResult {
            criterion: FailureCriterion::Hashin,
            failure_index,
            failed: fi >= 1.0,
            mode,
            margin_of_safety: if failure_index > 0.0 { 1.0 / failure_index - 1.0 } else { f64::INFINITY },
        }
    }

    /// Analyze all criteria
    pub fn analyze_all(stress: &[f64; 3], material: &PlyMaterial) -> Vec<FailureResult> {
        vec![
            Self::max_stress(stress, material),
            Self::tsai_hill(stress, material),
            Self::tsai_wu(stress, material),
            Self::hashin(stress, material),
        ]
    }
}

// ============================================================================
// STRESS/STRAIN ANALYSIS
// ============================================================================

/// Laminate stress analysis
pub struct LaminateAnalysis {
    pub laminate: Laminate,
    pub abd: ABDMatrix,
}

impl LaminateAnalysis {
    pub fn new(laminate: Laminate) -> Self {
        let abd = ABDMatrix::compute(&laminate);
        LaminateAnalysis { laminate, abd }
    }

    /// Compute ply stresses from mid-plane strains and curvatures
    pub fn ply_stresses(
        &self,
        mid_strain: &[f64; 3],    // ε0 = [ε_x, ε_y, γ_xy]
        curvature: &[f64; 3],     // κ = [κ_x, κ_y, κ_xy]
    ) -> Vec<PlyStressResult> {
        let mut results = Vec::new();

        for ply in &self.laminate.plies {
            let material = self.laminate.get_material(ply)
                .expect("Material not found");

            // Strain at ply mid-plane: ε = ε0 + z * κ
            let z_mid = (ply.z_top + ply.z_bottom) / 2.0;

            let strain_laminate = [
                mid_strain[0] + z_mid * curvature[0],
                mid_strain[1] + z_mid * curvature[1],
                mid_strain[2] + z_mid * curvature[2],
            ];

            // Transform strain to material coordinates
            let t = ply.get_strain_transformation();
            let strain_material = [
                t[0][0] * strain_laminate[0] + t[0][1] * strain_laminate[1] + t[0][2] * strain_laminate[2],
                t[1][0] * strain_laminate[0] + t[1][1] * strain_laminate[1] + t[1][2] * strain_laminate[2],
                t[2][0] * strain_laminate[0] + t[2][1] * strain_laminate[1] + t[2][2] * strain_laminate[2],
            ];

            // Compute stress in material coordinates: σ = Q * ε
            let q = material.get_q_matrix();
            let stress_material = [
                q[0][0] * strain_material[0] + q[0][1] * strain_material[1],
                q[0][1] * strain_material[0] + q[1][1] * strain_material[1],
                q[2][2] * strain_material[2],
            ];

            // Failure analysis
            let failure = FailureAnalysis::hashin(&stress_material, material);

            results.push(PlyStressResult {
                ply_id: ply.id,
                angle: ply.angle,
                z_position: z_mid,
                stress_laminate: transform_stress_to_laminate(&stress_material, ply.angle),
                stress_material,
                strain_laminate,
                strain_material,
                failure,
            });
        }

        results
    }

    /// First Ply Failure (FPF) load factor
    pub fn first_ply_failure(
        &self,
        mid_strain: &[f64; 3],
        curvature: &[f64; 3],
    ) -> (f64, usize, FailureMode) {
        let stresses = self.ply_stresses(mid_strain, curvature);

        let mut min_factor = f64::INFINITY;
        let mut failed_ply = 0;
        let mut failure_mode = FailureMode::None;

        for result in &stresses {
            if result.failure.failure_index > 0.0 {
                let factor = 1.0 / result.failure.failure_index;
                if factor < min_factor {
                    min_factor = factor;
                    failed_ply = result.ply_id;
                    failure_mode = result.failure.mode;
                }
            }
        }

        (min_factor, failed_ply, failure_mode)
    }
}

/// Stress result for a single ply
#[derive(Debug, Clone)]
pub struct PlyStressResult {
    pub ply_id: usize,
    pub angle: f64,
    pub z_position: f64,
    pub stress_laminate: [f64; 3],  // [σ_x, σ_y, τ_xy]
    pub stress_material: [f64; 3],  // [σ_1, σ_2, τ_12]
    pub strain_laminate: [f64; 3],
    pub strain_material: [f64; 3],
    pub failure: FailureResult,
}

// ============================================================================
// PROGRESSIVE FAILURE
// ============================================================================

/// Progressive damage model
#[derive(Debug, Clone)]
pub struct ProgressiveDamage {
    pub ply_damage: Vec<PlyDamageState>,
    pub degradation_model: DegradationModel,
}

/// Damage state for a single ply
#[derive(Debug, Clone)]
pub struct PlyDamageState {
    pub ply_id: usize,
    pub fiber_damage: f64,      // 0 = undamaged, 1 = fully damaged
    pub matrix_damage: f64,
    pub shear_damage: f64,
    pub failed: bool,
}

/// Stiffness degradation model
#[derive(Debug, Clone, Copy)]
pub enum DegradationModel {
    /// Sudden degradation (ply discount)
    PlyDiscount,
    /// Gradual degradation
    Gradual { fiber: f64, matrix: f64 },
    /// Continuum damage mechanics
    CDM,
}

impl ProgressiveDamage {
    pub fn new(n_plies: usize, model: DegradationModel) -> Self {
        let ply_damage = (0..n_plies)
            .map(|i| PlyDamageState {
                ply_id: i,
                fiber_damage: 0.0,
                matrix_damage: 0.0,
                shear_damage: 0.0,
                failed: false,
            })
            .collect();

        ProgressiveDamage {
            ply_damage,
            degradation_model: model,
        }
    }

    /// Get degraded material properties
    pub fn degraded_properties(&self, ply_id: usize, base: &PlyMaterial) -> PlyMaterial {
        let damage = &self.ply_damage[ply_id];
        let mut degraded = base.clone();

        match self.degradation_model {
            DegradationModel::PlyDiscount => {
                if damage.failed {
                    // Zero out stiffness
                    degraded.e1 = 1.0; // Small value to avoid singularity
                    degraded.e2 = 1.0;
                    degraded.g12 = 1.0;
                }
            }
            DegradationModel::Gradual { fiber, matrix } => {
                degraded.e1 *= 1.0 - damage.fiber_damage * (1.0 - fiber);
                degraded.e2 *= 1.0 - damage.matrix_damage * (1.0 - matrix);
                degraded.g12 *= 1.0 - damage.shear_damage * (1.0 - matrix);
            }
            DegradationModel::CDM => {
                // Continuum damage mechanics degradation
                let d1 = damage.fiber_damage;
                let d2 = damage.matrix_damage;
                let d6 = damage.shear_damage;

                degraded.e1 *= 1.0 - d1;
                degraded.e2 *= 1.0 - d2;
                degraded.g12 *= 1.0 - d6;
            }
        }

        degraded
    }

    /// Update damage based on failure
    pub fn update_damage(&mut self, ply_id: usize, failure: &FailureResult) {
        if failure.failed {
            let damage = &mut self.ply_damage[ply_id];

            match failure.mode {
                FailureMode::FiberTension | FailureMode::FiberCompression => {
                    damage.fiber_damage = 1.0;
                    damage.failed = true;
                }
                FailureMode::MatrixTension | FailureMode::MatrixCompression => {
                    damage.matrix_damage = 1.0;
                }
                FailureMode::Shear => {
                    damage.shear_damage = 1.0;
                }
                _ => {
                    damage.matrix_damage = 1.0;
                    damage.shear_damage = 1.0;
                }
            }
        }
    }
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/// Transform stress from material to laminate coordinates
fn transform_stress_to_laminate(stress_mat: &[f64; 3], angle_deg: f64) -> [f64; 3] {
    let theta = -angle_deg * PI / 180.0; // Negative for inverse transform
    let c = theta.cos();
    let s = theta.sin();
    let c2 = c * c;
    let s2 = s * s;
    let cs = c * s;

    [
        c2 * stress_mat[0] + s2 * stress_mat[1] - 2.0 * cs * stress_mat[2],
        s2 * stress_mat[0] + c2 * stress_mat[1] + 2.0 * cs * stress_mat[2],
        cs * stress_mat[0] - cs * stress_mat[1] + (c2 - s2) * stress_mat[2],
    ]
}

/// Invert 6x6 matrix
fn invert_6x6(a: &[[f64; 6]; 6]) -> Option<[[f64; 6]; 6]> {
    // Gaussian elimination with partial pivoting
    let mut aug = [[0.0; 12]; 6];

    // Augment with identity
    for i in 0..6 {
        for j in 0..6 {
            aug[i][j] = a[i][j];
            aug[i][j + 6] = if i == j { 1.0 } else { 0.0 };
        }
    }

    // Forward elimination
    for i in 0..6 {
        // Find pivot
        let mut max_val = aug[i][i].abs();
        let mut max_row = i;
        for k in (i + 1)..6 {
            if aug[k][i].abs() > max_val {
                max_val = aug[k][i].abs();
                max_row = k;
            }
        }

        if max_val < 1e-14 {
            return None; // Singular
        }

        aug.swap(i, max_row);

        // Scale pivot row
        let pivot = aug[i][i];
        for j in 0..12 {
            aug[i][j] /= pivot;
        }

        // Eliminate
        for k in 0..6 {
            if k != i {
                let factor = aug[k][i];
                for j in 0..12 {
                    aug[k][j] -= factor * aug[i][j];
                }
            }
        }
    }

    // Extract inverse
    let mut inv = [[0.0; 6]; 6];
    for i in 0..6 {
        for j in 0..6 {
            inv[i][j] = aug[i][j + 6];
        }
    }

    Some(inv)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_ply_material_cfrp() {
        let cfrp = PlyMaterial::cfrp_t300();
        assert!(cfrp.e1 > cfrp.e2 * 10.0); // Highly orthotropic
        assert!(cfrp.xt > cfrp.yt * 10.0); // Much stronger in fiber direction
    }

    #[test]
    fn test_q_matrix_symmetry() {
        let mat = PlyMaterial::cfrp_t300();
        let q = mat.get_q_matrix();

        // Q should be symmetric
        assert!((q[0][1] - q[1][0]).abs() < 1e-10);
        assert_eq!(q[0][2], 0.0);
        assert_eq!(q[1][2], 0.0);
    }

    #[test]
    fn test_transformation_angle_0() {
        let ply = Ply::new(0, 0, 0.125e-3, 0.0);
        let t = ply.get_strain_transformation();

        // Identity for 0 degrees
        assert!((t[0][0] - 1.0).abs() < 1e-10);
        assert!((t[1][1] - 1.0).abs() < 1e-10);
        assert!((t[2][2] - 1.0).abs() < 1e-10);
    }

    #[test]
    fn test_transformation_angle_90() {
        let ply = Ply::new(0, 0, 0.125e-3, 90.0);
        let t = ply.get_strain_transformation();

        // 90 degree rotation swaps 1-2
        assert!(t[0][0].abs() < 1e-10);
        assert!((t[0][1] - 1.0).abs() < 1e-10);
    }

    #[test]
    fn test_laminate_quasi_isotropic() {
        let mat = PlyMaterial::cfrp_t300();
        let lam = Laminate::quasi_isotropic(mat);

        assert_eq!(lam.plies.len(), 8); // [0/45/-45/90]s
        assert!(lam.symmetric);
    }

    #[test]
    fn test_abd_symmetric_laminate() {
        let mat = PlyMaterial::cfrp_t300();
        let lam = Laminate::quasi_isotropic(mat);
        let abd = ABDMatrix::compute(&lam);

        // B matrix should be near zero for symmetric laminate
        for i in 0..3 {
            for j in 0..3 {
                assert!(abd.b[i][j].abs() < 1e-6);
            }
        }
    }

    #[test]
    fn test_equivalent_properties() {
        let mat = PlyMaterial::cfrp_t300();
        let lam = Laminate::quasi_isotropic(mat);
        let abd = ABDMatrix::compute(&lam);
        let props = abd.equivalent_properties(lam.total_thickness());

        // Quasi-isotropic should have Ex ≈ Ey
        assert!((props.ex - props.ey).abs() / props.ex < 0.1);
    }

    #[test]
    fn test_max_stress_criterion() {
        let mat = PlyMaterial::cfrp_t300();
        let stress = [500.0e6, 0.0, 0.0]; // 500 MPa in fiber direction

        let result = FailureAnalysis::max_stress(&stress, &mat);
        assert!(!result.failed); // Below Xt = 1500 MPa
        assert_eq!(result.mode, FailureMode::FiberTension);
    }

    #[test]
    fn test_tsai_hill_failure() {
        let mat = PlyMaterial::cfrp_t300();
        let stress = [1600.0e6, 0.0, 0.0]; // Above Xt

        let result = FailureAnalysis::tsai_hill(&stress, &mat);
        assert!(result.failed);
    }

    #[test]
    fn test_tsai_wu() {
        let mat = PlyMaterial::cfrp_t300();
        let stress = [0.0, 30.0e6, 0.0]; // Transverse tension

        let result = FailureAnalysis::tsai_wu(&stress, &mat);
        assert!(!result.failed); // Below Yt = 40 MPa
    }

    #[test]
    fn test_hashin_modes() {
        let mat = PlyMaterial::cfrp_t300();

        // Fiber tension
        let result = FailureAnalysis::hashin(&[1000.0e6, 0.0, 0.0], &mat);
        assert_eq!(result.mode, FailureMode::FiberTension);

        // Matrix tension
        let result = FailureAnalysis::hashin(&[0.0, 30.0e6, 0.0], &mat);
        assert_eq!(result.mode, FailureMode::MatrixTension);
    }

    #[test]
    fn test_progressive_damage() {
        let mut damage = ProgressiveDamage::new(4, DegradationModel::PlyDiscount);
        let failure = FailureResult {
            criterion: FailureCriterion::Hashin,
            failure_index: 1.5,
            failed: true,
            mode: FailureMode::FiberTension,
            margin_of_safety: -0.33,
        };

        damage.update_damage(0, &failure);
        assert!(damage.ply_damage[0].failed);
        assert_eq!(damage.ply_damage[0].fiber_damage, 1.0);
    }

    #[test]
    fn test_degraded_properties() {
        let mat = PlyMaterial::cfrp_t300();
        let mut damage = ProgressiveDamage::new(1, DegradationModel::Gradual {
            fiber: 0.1,
            matrix: 0.2,
        });

        damage.ply_damage[0].matrix_damage = 1.0;
        let degraded = damage.degraded_properties(0, &mat);

        // E2 should be degraded
        assert!(degraded.e2 < mat.e2);
    }

    #[test]
    fn test_laminate_analysis() {
        let mat = PlyMaterial::cfrp_t300();
        let lam = Laminate::quasi_isotropic(mat);
        let analysis = LaminateAnalysis::new(lam);

        let mid_strain = [0.001, 0.0, 0.0]; // 0.1% axial strain
        let curvature = [0.0, 0.0, 0.0];

        let results = analysis.ply_stresses(&mid_strain, &curvature);
        assert_eq!(results.len(), 8);

        // 0° ply should have highest σ1
        let ply_0 = results.iter().find(|r| r.angle == 0.0).unwrap();
        let ply_90 = results.iter().find(|r| r.angle == 90.0).unwrap();
        assert!(ply_0.stress_material[0] > ply_90.stress_material[0]);
    }

    #[test]
    fn test_matrix_inversion() {
        let a = [
            [2.0, 0.0, 0.0, 0.0, 0.0, 0.0],
            [0.0, 3.0, 0.0, 0.0, 0.0, 0.0],
            [0.0, 0.0, 4.0, 0.0, 0.0, 0.0],
            [0.0, 0.0, 0.0, 5.0, 0.0, 0.0],
            [0.0, 0.0, 0.0, 0.0, 6.0, 0.0],
            [0.0, 0.0, 0.0, 0.0, 0.0, 7.0],
        ];

        let inv = invert_6x6(&a).unwrap();
        assert!((inv[0][0] - 0.5).abs() < 1e-10);
        assert!((inv[1][1] - 1.0 / 3.0).abs() < 1e-10);
    }
}
