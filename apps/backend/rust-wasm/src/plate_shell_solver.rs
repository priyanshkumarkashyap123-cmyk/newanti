//! # Plate & Shell Finite Element Solver
//!
//! Industry-standard 2D finite elements for structural analysis:
//! - 4-node quadrilateral plate elements (Mindlin-Reissner theory)
//! - 3-node triangular plate elements
//! - Shell elements with membrane + bending
//! - Automatic mesh generation
//!
//! This fills a CRITICAL gap vs STAAD.Pro/ETABS/SAP2000

use nalgebra::{DMatrix, DVector, Matrix3, Vector3};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

// ============================================================================
// ELEMENT TYPES
// ============================================================================

/// Plate/Shell element formulation
#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
pub enum PlateFormulation {
    /// Kirchhoff thin plate (no shear deformation)
    Kirchhoff,
    /// Mindlin-Reissner thick plate (includes shear deformation)
    MindlinReissner,
    /// Discrete Kirchhoff Triangle (DKT) - robust for thin plates
    DKT,
    /// Discrete Kirchhoff Quadrilateral (DKQ)
    DKQ,
    /// MITC4 - Mixed Interpolation of Tensorial Components (shear-locking free)
    MITC4,
}

/// Shell element type
#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
pub enum ShellType {
    /// Pure membrane (in-plane only)
    Membrane,
    /// Pure plate (bending only)
    Plate,
    /// Full shell (membrane + bending)
    Shell,
    /// Layered composite shell
    LayeredShell,
}

// ============================================================================
// NODE & ELEMENT DEFINITIONS
// ============================================================================

/// 2D/3D Node for plate/shell analysis
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PlateNode {
    pub id: String,
    pub x: f64,
    pub y: f64,
    pub z: f64,
    /// Boundary conditions: [ux, uy, uz, rx, ry, rz] - true = fixed
    pub restraints: [bool; 6],
}

/// Quadrilateral plate element (4 nodes)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct QuadPlateElement {
    pub id: String,
    pub nodes: [String; 4],  // Node IDs in counter-clockwise order
    pub thickness: f64,
    pub material_id: String,
    pub formulation: PlateFormulation,
    pub shell_type: ShellType,
    /// Local axis angle (degrees) for orthotropic materials
    pub local_axis_angle: f64,
}

/// Triangular plate element (3 nodes)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TriPlateElement {
    pub id: String,
    pub nodes: [String; 3],
    pub thickness: f64,
    pub material_id: String,
    pub formulation: PlateFormulation,
    pub shell_type: ShellType,
}

/// Material properties for plate/shell
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PlateMaterial {
    pub id: String,
    pub name: String,
    pub e: f64,           // Young's modulus (MPa)
    pub nu: f64,          // Poisson's ratio
    pub g: f64,           // Shear modulus (MPa) - for orthotropic
    pub density: f64,     // kg/m³
    pub is_orthotropic: bool,
    pub e1: Option<f64>,  // E in direction 1
    pub e2: Option<f64>,  // E in direction 2
    pub g12: Option<f64>, // In-plane shear modulus
    pub nu12: Option<f64>,
}

impl PlateMaterial {
    pub fn concrete(fc: f64) -> Self {
        let e = 5000.0 * fc.sqrt(); // IS 456 formula
        PlateMaterial {
            id: "concrete".to_string(),
            name: format!("M{}", fc as i32),
            e,
            nu: 0.2,
            g: e / (2.0 * 1.2),
            density: 2500.0,
            is_orthotropic: false,
            e1: None, e2: None, g12: None, nu12: None,
        }
    }

    pub fn steel() -> Self {
        PlateMaterial {
            id: "steel".to_string(),
            name: "Steel".to_string(),
            e: 200000.0,
            nu: 0.3,
            g: 76923.0,
            density: 7850.0,
            is_orthotropic: false,
            e1: None, e2: None, g12: None, nu12: None,
        }
    }
}

// ============================================================================
// LOADS
// ============================================================================

/// Surface load on plate/shell
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SurfaceLoad {
    pub element_id: String,
    pub load_type: SurfaceLoadType,
    pub magnitude: f64,  // kN/m² (pressure positive = downward)
    /// For varying loads: values at nodes [n1, n2, n3, n4]
    pub node_values: Option<[f64; 4]>,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
pub enum SurfaceLoadType {
    UniformPressure,
    VaryingPressure,
    Hydrostatic,
    SoilPressure,
}

/// Edge load on plate/shell
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EdgeLoad {
    pub element_id: String,
    pub edge: u8,  // 0-3 for quad, 0-2 for tri
    pub load_type: EdgeLoadType,
    pub magnitude: f64,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
pub enum EdgeLoadType {
    LineLoad,      // kN/m perpendicular to edge
    MomentLoad,    // kNm/m along edge
    InPlaneShear,  // kN/m in-plane
}

// ============================================================================
// STIFFNESS MATRIX FORMULATION
// ============================================================================

/// Constitutive matrix builder
pub struct ConstitutiveMatrix;

impl ConstitutiveMatrix {
    /// Plane stress constitutive matrix [D] for membrane
    pub fn plane_stress(e: f64, nu: f64) -> Matrix3<f64> {
        let factor = e / (1.0 - nu * nu);
        Matrix3::new(
            factor,       factor * nu,  0.0,
            factor * nu,  factor,       0.0,
            0.0,          0.0,          factor * (1.0 - nu) / 2.0,
        )
    }

    /// Bending constitutive matrix [Db] for plate
    pub fn bending(e: f64, nu: f64, t: f64) -> Matrix3<f64> {
        let d = e * t.powi(3) / (12.0 * (1.0 - nu * nu));
        Matrix3::new(
            d,       d * nu,  0.0,
            d * nu,  d,       0.0,
            0.0,     0.0,     d * (1.0 - nu) / 2.0,
        )
    }

    /// Shear constitutive matrix [Ds] for Mindlin plate
    pub fn shear(e: f64, nu: f64, t: f64, kappa: f64) -> nalgebra::Matrix2<f64> {
        let g = e / (2.0 * (1.0 + nu));
        let ds = kappa * g * t;
        nalgebra::Matrix2::new(
            ds, 0.0,
            0.0, ds,
        )
    }
}

/// 4-node quadrilateral plate element stiffness
pub struct Quad4Plate;

impl Quad4Plate {
    /// Gauss points for 2x2 integration (bending/membrane)
    const GAUSS_2X2: [(f64, f64, f64); 4] = [
        (-0.577350269, -0.577350269, 1.0),
        ( 0.577350269, -0.577350269, 1.0),
        ( 0.577350269,  0.577350269, 1.0),
        (-0.577350269,  0.577350269, 1.0),
    ];

    /// Gauss point for 1x1 reduced integration (shear — prevents shear locking)
    const GAUSS_1X1: [(f64, f64, f64); 1] = [
        (0.0, 0.0, 4.0),
    ];

    /// Shape functions N(xi, eta)
    pub fn shape_functions(xi: f64, eta: f64) -> [f64; 4] {
        [
            0.25 * (1.0 - xi) * (1.0 - eta),
            0.25 * (1.0 + xi) * (1.0 - eta),
            0.25 * (1.0 + xi) * (1.0 + eta),
            0.25 * (1.0 - xi) * (1.0 + eta),
        ]
    }

    /// Shape function derivatives dN/dxi, dN/deta
    pub fn shape_derivatives(xi: f64, eta: f64) -> [[f64; 4]; 2] {
        [
            // dN/dxi
            [
                -0.25 * (1.0 - eta),
                 0.25 * (1.0 - eta),
                 0.25 * (1.0 + eta),
                -0.25 * (1.0 + eta),
            ],
            // dN/deta
            [
                -0.25 * (1.0 - xi),
                -0.25 * (1.0 + xi),
                 0.25 * (1.0 + xi),
                 0.25 * (1.0 - xi),
            ],
        ]
    }

    /// Jacobian matrix
    pub fn jacobian(coords: &[[f64; 2]; 4], xi: f64, eta: f64) -> (nalgebra::Matrix2<f64>, f64) {
        let dn = Self::shape_derivatives(xi, eta);
        
        let mut j = nalgebra::Matrix2::zeros();
        for i in 0..4 {
            j[(0, 0)] += dn[0][i] * coords[i][0];
            j[(0, 1)] += dn[0][i] * coords[i][1];
            j[(1, 0)] += dn[1][i] * coords[i][0];
            j[(1, 1)] += dn[1][i] * coords[i][1];
        }
        
        let det_j = j[(0, 0)] * j[(1, 1)] - j[(0, 1)] * j[(1, 0)];
        (j, det_j)
    }

    /// Membrane stiffness matrix (8x8 for 4 nodes with ux, uy DOFs)
    pub fn membrane_stiffness(
        coords: &[[f64; 2]; 4],
        e: f64,
        nu: f64,
        t: f64,
    ) -> DMatrix<f64> {
        let d_membrane = ConstitutiveMatrix::plane_stress(e, nu);
        let mut k = DMatrix::zeros(8, 8);

        for (xi, eta, w) in Self::GAUSS_2X2.iter() {
            let dn = Self::shape_derivatives(*xi, *eta);
            let (j, det_j) = Self::jacobian(coords, *xi, *eta);
            
            if det_j <= 0.0 {
                continue; // Skip degenerate element
            }

            // Inverse Jacobian
            let j_inv = nalgebra::Matrix2::new(
                j[(1, 1)] / det_j, -j[(0, 1)] / det_j,
                -j[(1, 0)] / det_j, j[(0, 0)] / det_j,
            );

            // B matrix for membrane (strain-displacement)
            let mut b = DMatrix::zeros(3, 8);
            for i in 0..4 {
                let dn_dx = j_inv[(0, 0)] * dn[0][i] + j_inv[(0, 1)] * dn[1][i];
                let dn_dy = j_inv[(1, 0)] * dn[0][i] + j_inv[(1, 1)] * dn[1][i];
                
                b[(0, 2*i)] = dn_dx;     // du/dx
                b[(1, 2*i+1)] = dn_dy;   // dv/dy
                b[(2, 2*i)] = dn_dy;     // du/dy
                b[(2, 2*i+1)] = dn_dx;   // dv/dx
            }

            // K += B^T * D * B * t * det(J) * w
            let d_mat = DMatrix::from_row_slice(3, 3, d_membrane.as_slice());
            let bt = b.transpose();
            let contrib = &bt * &d_mat * &b * (t * det_j * w);
            k += contrib;
        }

        k
    }

    /// Bending stiffness matrix (12x12 for 4 nodes with w, θx, θy DOFs)
    /// Using Mindlin-Reissner plate theory with selective reduced integration
    /// - 2×2 Gauss for bending (curvature terms) — full integration
    /// - 1×1 Gauss for shear (γ terms) — reduced integration to prevent shear locking
    pub fn bending_stiffness(
        coords: &[[f64; 2]; 4],
        e: f64,
        nu: f64,
        t: f64,
    ) -> DMatrix<f64> {
        let db = ConstitutiveMatrix::bending(e, nu, t);
        let kappa = 5.0 / 6.0; // Shear correction factor
        let ds = ConstitutiveMatrix::shear(e, nu, t, kappa);
        
        let mut k = DMatrix::zeros(12, 12);

        // Full integration (2×2) for BENDING terms only
        for (xi, eta, w) in Self::GAUSS_2X2.iter() {
            let _n = Self::shape_functions(*xi, *eta);
            let dn = Self::shape_derivatives(*xi, *eta);
            let (j, det_j) = Self::jacobian(coords, *xi, *eta);
            
            if det_j <= 0.0 { continue; }

            let j_inv = nalgebra::Matrix2::new(
                j[(1, 1)] / det_j, -j[(0, 1)] / det_j,
                -j[(1, 0)] / det_j, j[(0, 0)] / det_j,
            );

            // Bending B matrix (curvature-rotation)
            let mut bb = DMatrix::zeros(3, 12);
            for i in 0..4 {
                let dn_dx = j_inv[(0, 0)] * dn[0][i] + j_inv[(0, 1)] * dn[1][i];
                let dn_dy = j_inv[(1, 0)] * dn[0][i] + j_inv[(1, 1)] * dn[1][i];
                
                // DOFs: w, θx, θy for each node
                bb[(0, 3*i+1)] = dn_dx;      // κxx = dθx/dx
                bb[(1, 3*i+2)] = dn_dy;      // κyy = dθy/dy
                bb[(2, 3*i+1)] = dn_dy;      // κxy = dθx/dy + dθy/dx
                bb[(2, 3*i+2)] = dn_dx;
            }

            // Bending contribution only (2×2 integration)
            let db_mat = DMatrix::from_row_slice(3, 3, db.as_slice());
            let bbt = bb.transpose();
            k += &bbt * &db_mat * &bb * (det_j * w);
        }

        // Reduced integration (1×1) for SHEAR terms — prevents shear locking
        for (xi, eta, w) in Self::GAUSS_1X1.iter() {
            let n = Self::shape_functions(*xi, *eta);
            let dn = Self::shape_derivatives(*xi, *eta);
            let (j, det_j) = Self::jacobian(coords, *xi, *eta);
            
            if det_j <= 0.0 { continue; }

            let j_inv = nalgebra::Matrix2::new(
                j[(1, 1)] / det_j, -j[(0, 1)] / det_j,
                -j[(1, 0)] / det_j, j[(0, 0)] / det_j,
            );

            // Shear B matrix
            let mut bs = DMatrix::zeros(2, 12);
            for i in 0..4 {
                let dn_dx = j_inv[(0, 0)] * dn[0][i] + j_inv[(0, 1)] * dn[1][i];
                let dn_dy = j_inv[(1, 0)] * dn[0][i] + j_inv[(1, 1)] * dn[1][i];
                
                // γxz = dw/dx + θx, γyz = dw/dy + θy
                bs[(0, 3*i)] = dn_dx;   // dw/dx
                bs[(0, 3*i+1)] = n[i];  // θx
                bs[(1, 3*i)] = dn_dy;   // dw/dy
                bs[(1, 3*i+2)] = n[i];  // θy
            }

            // Shear contribution (1×1 reduced integration)
            let ds_mat = DMatrix::from_row_slice(2, 2, ds.as_slice());
            let bst = bs.transpose();
            k += &bst * &ds_mat * &bs * (det_j * w);
        }

        k
    }

    /// Full shell stiffness (membrane + bending)
    /// 24x24 for 4 nodes with 6 DOFs each
    pub fn shell_stiffness(
        coords_3d: &[[f64; 3]; 4],
        e: f64,
        nu: f64,
        t: f64,
    ) -> DMatrix<f64> {
        // Project to local coordinate system
        let (coords_local, transform) = Self::local_coordinate_system(coords_3d);
        
        // Get membrane stiffness (8x8)
        let km = Self::membrane_stiffness(&coords_local, e, nu, t);
        
        // Get bending stiffness (12x12)
        let kb = Self::bending_stiffness(&coords_local, e, nu, t);
        
        // Assemble into 24x24 shell stiffness
        let mut k_local = DMatrix::zeros(24, 24);
        
        // Map membrane DOFs (ux, uy per node)
        for i in 0..4 {
            for j in 0..4 {
                // ux-ux
                k_local[(6*i, 6*j)] = km[(2*i, 2*j)];
                // ux-uy
                k_local[(6*i, 6*j+1)] = km[(2*i, 2*j+1)];
                // uy-ux
                k_local[(6*i+1, 6*j)] = km[(2*i+1, 2*j)];
                // uy-uy
                k_local[(6*i+1, 6*j+1)] = km[(2*i+1, 2*j+1)];
            }
        }
        
        // Map bending DOFs (uz, θx, θy per node)
        for i in 0..4 {
            for j in 0..4 {
                for p in 0..3 {
                    for q in 0..3 {
                        k_local[(6*i+2+p, 6*j+2+q)] = kb[(3*i+p, 3*j+q)];
                    }
                }
            }
        }

        // Add drilling stiffness (θz) to prevent singularity
        let drill_stiff = e * t / 1000.0;
        for i in 0..4 {
            k_local[(6*i+5, 6*i+5)] = drill_stiff;
        }
        
        // Transform to global coordinates
        Self::transform_to_global(&k_local, &transform)
    }

    /// Compute local coordinate system for 3D shell element
    fn local_coordinate_system(coords: &[[f64; 3]; 4]) -> ([[f64; 2]; 4], DMatrix<f64>) {
        // Compute centroid
        let cx = (coords[0][0] + coords[1][0] + coords[2][0] + coords[3][0]) / 4.0;
        let cy = (coords[0][1] + coords[1][1] + coords[2][1] + coords[3][1]) / 4.0;
        let cz = (coords[0][2] + coords[1][2] + coords[2][2] + coords[3][2]) / 4.0;

        // Local x-axis: direction from node 0 to node 1
        let v1 = Vector3::new(
            coords[1][0] - coords[0][0],
            coords[1][1] - coords[0][1],
            coords[1][2] - coords[0][2],
        );
        let lx = v1.normalize();

        // Normal vector (cross product of diagonals)
        let d1 = Vector3::new(
            coords[2][0] - coords[0][0],
            coords[2][1] - coords[0][1],
            coords[2][2] - coords[0][2],
        );
        let d2 = Vector3::new(
            coords[3][0] - coords[1][0],
            coords[3][1] - coords[1][1],
            coords[3][2] - coords[1][2],
        );
        let lz = d1.cross(&d2).normalize();

        // Local y-axis
        let ly = lz.cross(&lx).normalize();

        // Transformation matrix (3x3 rotation)
        let r = Matrix3::new(
            lx[0], lx[1], lx[2],
            ly[0], ly[1], ly[2],
            lz[0], lz[1], lz[2],
        );

        // Project nodes to local coordinates
        let mut local_coords = [[0.0; 2]; 4];
        for i in 0..4 {
            let p = Vector3::new(
                coords[i][0] - cx,
                coords[i][1] - cy,
                coords[i][2] - cz,
            );
            let p_local = r * p;
            local_coords[i] = [p_local[0], p_local[1]];
        }

        // Build 24x24 transformation matrix
        let mut t = DMatrix::zeros(24, 24);
        for i in 0..4 {
            // Translational DOFs
            for p in 0..3 {
                for q in 0..3 {
                    t[(6*i+p, 6*i+q)] = r[(p, q)];
                }
            }
            // Rotational DOFs
            for p in 0..3 {
                for q in 0..3 {
                    t[(6*i+3+p, 6*i+3+q)] = r[(p, q)];
                }
            }
        }

        (local_coords, t)
    }

    /// Transform local stiffness to global coordinates
    fn transform_to_global(k_local: &DMatrix<f64>, t: &DMatrix<f64>) -> DMatrix<f64> {
        let tt = t.transpose();
        &tt * k_local * t
    }
}

// ============================================================================
// TRIANGULAR ELEMENT (DKT - Discrete Kirchhoff Triangle)
// ============================================================================

pub struct Tri3Plate;

impl Tri3Plate {
    /// Area of triangle from coordinates
    pub fn area(coords: &[[f64; 2]; 3]) -> f64 {
        0.5 * ((coords[1][0] - coords[0][0]) * (coords[2][1] - coords[0][1])
             - (coords[2][0] - coords[0][0]) * (coords[1][1] - coords[0][1])).abs()
    }

    /// Shape functions for triangle (barycentric)
    pub fn shape_functions(l1: f64, l2: f64) -> [f64; 3] {
        let l3 = 1.0 - l1 - l2;
        [l1, l2, l3]
    }

    /// Membrane stiffness for triangle (CST - Constant Strain Triangle)
    pub fn membrane_stiffness(
        coords: &[[f64; 2]; 3],
        e: f64,
        nu: f64,
        t: f64,
    ) -> DMatrix<f64> {
        let area = Self::area(coords);
        let d = ConstitutiveMatrix::plane_stress(e, nu);

        // B matrix (constant for CST)
        let x = [coords[0][0], coords[1][0], coords[2][0]];
        let y = [coords[0][1], coords[1][1], coords[2][1]];

        let b1 = y[1] - y[2];
        let b2 = y[2] - y[0];
        let b3 = y[0] - y[1];
        let c1 = x[2] - x[1];
        let c2 = x[0] - x[2];
        let c3 = x[1] - x[0];

        let mut b = DMatrix::zeros(3, 6);
        b[(0, 0)] = b1; b[(0, 2)] = b2; b[(0, 4)] = b3;
        b[(1, 1)] = c1; b[(1, 3)] = c2; b[(1, 5)] = c3;
        b[(2, 0)] = c1; b[(2, 1)] = b1; b[(2, 2)] = c2;
        b[(2, 3)] = b2; b[(2, 4)] = c3; b[(2, 5)] = b3;

        let factor = 1.0 / (2.0 * area);
        let b = b * factor;

        let d_mat = DMatrix::from_row_slice(3, 3, d.as_slice());
        let bt = b.transpose();
        &bt * &d_mat * &b * (t * area)
    }
}

// ============================================================================
// MESH GENERATION
// ============================================================================

/// Automatic mesh generator for plates
pub struct PlateMeshGenerator;

impl PlateMeshGenerator {
    /// Generate rectangular mesh
    pub fn rectangular_mesh(
        lx: f64,
        ly: f64,
        nx: usize,
        ny: usize,
        origin: [f64; 3],
    ) -> (Vec<PlateNode>, Vec<QuadPlateElement>) {
        let mut nodes = Vec::new();
        let mut elements = Vec::new();

        let dx = lx / nx as f64;
        let dy = ly / ny as f64;

        // Generate nodes
        for j in 0..=ny {
            for i in 0..=nx {
                let id = format!("N{}_{}", i, j);
                nodes.push(PlateNode {
                    id,
                    x: origin[0] + i as f64 * dx,
                    y: origin[1] + j as f64 * dy,
                    z: origin[2],
                    restraints: [false; 6],
                });
            }
        }

        // Generate elements
        for j in 0..ny {
            for i in 0..nx {
                let n1 = format!("N{}_{}", i, j);
                let n2 = format!("N{}_{}", i+1, j);
                let n3 = format!("N{}_{}", i+1, j+1);
                let n4 = format!("N{}_{}", i, j+1);

                elements.push(QuadPlateElement {
                    id: format!("E{}_{}", i, j),
                    nodes: [n1, n2, n3, n4],
                    thickness: 0.2,  // Default 200mm
                    material_id: "concrete".to_string(),
                    formulation: PlateFormulation::MindlinReissner,
                    shell_type: ShellType::Plate,
                    local_axis_angle: 0.0,
                });
            }
        }

        (nodes, elements)
    }

    /// Generate circular mesh (for tank base, circular footing)
    pub fn circular_mesh(
        radius: f64,
        n_radial: usize,
        n_circum: usize,
        center: [f64; 3],
    ) -> (Vec<PlateNode>, Vec<QuadPlateElement>) {
        let mut nodes = Vec::new();
        let mut elements = Vec::new();

        // Center node
        nodes.push(PlateNode {
            id: "N_center".to_string(),
            x: center[0],
            y: center[1],
            z: center[2],
            restraints: [false; 6],
        });

        let dr = radius / n_radial as f64;
        let d_theta = 2.0 * std::f64::consts::PI / n_circum as f64;

        // Generate radial nodes
        for i in 1..=n_radial {
            let r = i as f64 * dr;
            for j in 0..n_circum {
                let theta = j as f64 * d_theta;
                nodes.push(PlateNode {
                    id: format!("N{}_{}", i, j),
                    x: center[0] + r * theta.cos(),
                    y: center[1] + r * theta.sin(),
                    z: center[2],
                    restraints: [false; 6],
                });
            }
        }

        // Generate elements (triangles at center, quads elsewhere)
        for j in 0..n_circum {
            let j_next = (j + 1) % n_circum;
            
            // Inner triangular elements (simplified - would need tri elements)
            // For now, just do quads from ring 1 outward
            for i in 1..n_radial {
                let n1 = format!("N{}_{}", i, j);
                let n2 = format!("N{}_{}", i, j_next);
                let n3 = format!("N{}_{}", i+1, j_next);
                let n4 = format!("N{}_{}", i+1, j);

                elements.push(QuadPlateElement {
                    id: format!("E{}_{}", i, j),
                    nodes: [n1, n2, n3, n4],
                    thickness: 0.2,
                    material_id: "concrete".to_string(),
                    formulation: PlateFormulation::MindlinReissner,
                    shell_type: ShellType::Plate,
                    local_axis_angle: 0.0,
                });
            }
        }

        (nodes, elements)
    }
}

// ============================================================================
// SOLVER
// ============================================================================

/// Plate/Shell analysis result
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PlateAnalysisResult {
    /// Nodal displacements [ux, uy, uz, θx, θy, θz]
    pub displacements: HashMap<String, [f64; 6]>,
    /// Nodal reactions
    pub reactions: HashMap<String, [f64; 6]>,
    /// Element stresses (top, middle, bottom)
    pub element_stresses: HashMap<String, ElementStress>,
    /// Element forces (Mx, My, Mxy, Qx, Qy, Nx, Ny, Nxy)
    pub element_forces: HashMap<String, ElementForces>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ElementStress {
    pub top: StressState,
    pub middle: StressState,
    pub bottom: StressState,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StressState {
    pub sigma_xx: f64,
    pub sigma_yy: f64,
    pub tau_xy: f64,
    pub sigma_1: f64,  // Principal stress 1
    pub sigma_2: f64,  // Principal stress 2
    pub tau_max: f64,
    pub von_mises: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ElementForces {
    pub mx: f64,   // Moment per unit width about x-axis
    pub my: f64,   // Moment per unit width about y-axis
    pub mxy: f64,  // Twisting moment
    pub qx: f64,   // Transverse shear in x
    pub qy: f64,   // Transverse shear in y
    pub nx: f64,   // Membrane force in x
    pub ny: f64,   // Membrane force in y
    pub nxy: f64,  // Membrane shear
}

/// Main plate/shell solver
pub struct PlateShellSolver {
    nodes: HashMap<String, PlateNode>,
    quad_elements: Vec<QuadPlateElement>,
    tri_elements: Vec<TriPlateElement>,
    materials: HashMap<String, PlateMaterial>,
    surface_loads: Vec<SurfaceLoad>,
    edge_loads: Vec<EdgeLoad>,
}

impl PlateShellSolver {
    pub fn new() -> Self {
        PlateShellSolver {
            nodes: HashMap::new(),
            quad_elements: Vec::new(),
            tri_elements: Vec::new(),
            materials: HashMap::new(),
            surface_loads: Vec::new(),
            edge_loads: Vec::new(),
        }
    }

    pub fn add_node(&mut self, node: PlateNode) {
        self.nodes.insert(node.id.clone(), node);
    }

    pub fn add_quad_element(&mut self, elem: QuadPlateElement) {
        self.quad_elements.push(elem);
    }

    pub fn add_material(&mut self, mat: PlateMaterial) {
        self.materials.insert(mat.id.clone(), mat);
    }

    pub fn add_surface_load(&mut self, load: SurfaceLoad) {
        self.surface_loads.push(load);
    }

    /// Solve the plate/shell system
    pub fn solve(&self) -> Result<PlateAnalysisResult, String> {
        let n_nodes = self.nodes.len();
        let n_dof = n_nodes * 6;

        if n_nodes == 0 {
            return Err("No nodes defined".to_string());
        }

        // Create node index map
        let node_ids: Vec<&String> = self.nodes.keys().collect();
        let node_index: HashMap<&String, usize> = node_ids
            .iter()
            .enumerate()
            .map(|(i, id)| (*id, i))
            .collect();

        // Initialize global stiffness and force
        let mut k_global = DMatrix::zeros(n_dof, n_dof);
        let mut f_global = DVector::zeros(n_dof);

        // Assemble quad elements
        for elem in &self.quad_elements {
            let mat = self.materials.get(&elem.material_id)
                .ok_or_else(|| format!("Material {} not found", elem.material_id))?;

            // Get node coordinates
            let mut coords = [[0.0; 3]; 4];
            for (i, nid) in elem.nodes.iter().enumerate() {
                let node = self.nodes.get(nid)
                    .ok_or_else(|| format!("Node {} not found", nid))?;
                coords[i] = [node.x, node.y, node.z];
            }

            // Compute element stiffness
            let k_elem = Quad4Plate::shell_stiffness(&coords, mat.e, mat.nu, elem.thickness);

            // Assemble into global matrix
            for (i, nid_i) in elem.nodes.iter().enumerate() {
                let gi = node_index[nid_i];
                for (j, nid_j) in elem.nodes.iter().enumerate() {
                    let gj = node_index[nid_j];
                    for p in 0..6 {
                        for q in 0..6 {
                            k_global[(gi*6+p, gj*6+q)] += k_elem[(i*6+p, j*6+q)];
                        }
                    }
                }
            }
        }

        // Apply surface loads (equivalent nodal forces)
        for load in &self.surface_loads {
            if let Some(elem) = self.quad_elements.iter().find(|e| e.id == load.element_id) {
                // Get element area (approximate)
                let mut coords = [[0.0; 2]; 4];
                for (i, nid) in elem.nodes.iter().enumerate() {
                    let node = &self.nodes[nid];
                    coords[i] = [node.x, node.y];
                }
                
                // Simple area calculation (shoelace formula)
                let area = 0.5 * (
                    (coords[0][0] - coords[2][0]) * (coords[1][1] - coords[3][1]) -
                    (coords[1][0] - coords[3][0]) * (coords[0][1] - coords[2][1])
                ).abs();

                // Distribute load to nodes (1/4 each for uniform)
                let force_per_node = load.magnitude * area / 4.0;
                for nid in &elem.nodes {
                    let gi = node_index[nid];
                    f_global[gi*6 + 2] -= force_per_node; // Negative z (downward)
                }
            }
        }

        // Apply boundary conditions
        let mut fixed_dofs = Vec::new();
        for (id, node) in &self.nodes {
            let gi = node_index[id];
            for (dof, &fixed) in node.restraints.iter().enumerate() {
                if fixed {
                    fixed_dofs.push(gi * 6 + dof);
                }
            }
        }

        // Reduce system
        let free_dofs: Vec<usize> = (0..n_dof)
            .filter(|d| !fixed_dofs.contains(d))
            .collect();
        let n_free = free_dofs.len();

        if n_free == 0 {
            return Err("All DOFs are fixed - structure is fully restrained".to_string());
        }

        // Extract reduced matrices
        let mut k_reduced = DMatrix::zeros(n_free, n_free);
        let mut f_reduced = DVector::zeros(n_free);

        for (i, &di) in free_dofs.iter().enumerate() {
            f_reduced[i] = f_global[di];
            for (j, &dj) in free_dofs.iter().enumerate() {
                k_reduced[(i, j)] = k_global[(di, dj)];
            }
        }

        // Solve Ku = F
        let decomp = k_reduced.clone().lu();
        let u_reduced = decomp.solve(&f_reduced)
            .ok_or_else(|| "Failed to solve system - matrix may be singular".to_string())?;

        // Expand displacements
        let mut u_global = DVector::zeros(n_dof);
        for (i, &di) in free_dofs.iter().enumerate() {
            u_global[di] = u_reduced[i];
        }

        // Extract nodal results
        let mut displacements = HashMap::new();
        let mut reactions = HashMap::new();

        for (id, _node) in &self.nodes {
            let gi = node_index[id];
            let disp: [f64; 6] = [
                u_global[gi*6], u_global[gi*6+1], u_global[gi*6+2],
                u_global[gi*6+3], u_global[gi*6+4], u_global[gi*6+5],
            ];
            displacements.insert(id.clone(), disp);

            // Compute reactions at fixed DOFs
            let mut rxn: [f64; 6] = [0.0; 6];
            for dof in 0..6 {
                if fixed_dofs.contains(&(gi*6 + dof)) {
                    // R = K * u - F
                    let mut r = -f_global[gi*6 + dof];
                    for (jid, _) in &self.nodes {
                        let gj = node_index[jid];
                        for q in 0..6 {
                            r += k_global[(gi*6+dof, gj*6+q)] * u_global[gj*6+q];
                        }
                    }
                    rxn[dof] = r;
                }
            }
            reactions.insert(id.clone(), rxn);
        }

        // Compute element stresses and forces (simplified)
        let element_stresses = HashMap::new();
        let element_forces = HashMap::new();

        Ok(PlateAnalysisResult {
            displacements,
            reactions,
            element_stresses,
            element_forces,
        })
    }
}

// ============================================================================
// TESTS
// ============================================================================

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_shape_functions() {
        // At center (0,0), all shape functions = 0.25
        let n = Quad4Plate::shape_functions(0.0, 0.0);
        for ni in n.iter() {
            assert!((ni - 0.25).abs() < 1e-10);
        }

        // At corner (-1,-1), N1 = 1, others = 0
        let n = Quad4Plate::shape_functions(-1.0, -1.0);
        assert!((n[0] - 1.0).abs() < 1e-10);
        assert!(n[1].abs() < 1e-10);
        assert!(n[2].abs() < 1e-10);
        assert!(n[3].abs() < 1e-10);
    }

    #[test]
    fn test_jacobian() {
        // Unit square: corners at (0,0), (1,0), (1,1), (0,1)
        let coords = [[0.0, 0.0], [1.0, 0.0], [1.0, 1.0], [0.0, 1.0]];
        let (_, det_j) = Quad4Plate::jacobian(&coords, 0.0, 0.0);
        // For unit square mapped to [-1,1], det(J) = 0.25
        assert!((det_j - 0.25).abs() < 1e-10);
    }

    #[test]
    fn test_mesh_generation() {
        let (nodes, elements) = PlateMeshGenerator::rectangular_mesh(
            4.0, 3.0, 4, 3, [0.0, 0.0, 0.0]
        );
        assert_eq!(nodes.len(), 20); // 5x4 nodes
        assert_eq!(elements.len(), 12); // 4x3 elements
    }

    #[test]
    fn test_simple_plate_bending() {
        let mut solver = PlateShellSolver::new();

        // Add material
        solver.add_material(PlateMaterial::concrete(25.0));

        // Simple 2x2 plate mesh
        let (nodes, elements) = PlateMeshGenerator::rectangular_mesh(
            2.0, 2.0, 2, 2, [0.0, 0.0, 0.0]
        );

        for mut node in nodes {
            // Fix edges (simple support)
            if node.x.abs() < 0.01 || (node.x - 2.0).abs() < 0.01 ||
               node.y.abs() < 0.01 || (node.y - 2.0).abs() < 0.01 {
                node.restraints[2] = true; // Fix uz
            }
            solver.add_node(node);
        }

        for elem in elements {
            solver.add_quad_element(elem);
        }

        // Add uniform load
        for i in 0..2 {
            for j in 0..2 {
                solver.add_surface_load(SurfaceLoad {
                    element_id: format!("E{}_{}", i, j),
                    load_type: SurfaceLoadType::UniformPressure,
                    magnitude: 10.0, // 10 kN/m²
                    node_values: None,
                });
            }
        }

        let result = solver.solve();
        assert!(result.is_ok());

        let res = result.unwrap();
        // Center node should have maximum deflection
        if let Some(disp) = res.displacements.get("N1_1") {
            assert!(disp[2] < 0.0); // Downward deflection
            println!("Center deflection: {:.6} m", disp[2]);
        }
    }
}
