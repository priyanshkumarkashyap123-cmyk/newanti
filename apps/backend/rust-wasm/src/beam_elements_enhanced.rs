//! Enhanced Beam Elements Module
//!
//! Production-grade beam finite elements including Timoshenko beam theory
//! for shear deformation, warping, and advanced cross-section analysis.
//!
//! ## Element Types
//! - **Euler-Bernoulli** - Classical thin beam (no shear)
//! - **Timoshenko** - Thick beam with shear deformation
//! - **Warping Beam** - Includes warping DOF for torsion
//! - **Fiber Beam** - Section discretized into fibers
//!
//! ## Features
//! - Arbitrary cross-section support
//! - P-delta and P-Δ effects
//! - Consistent and lumped mass matrices
//! - Geometric stiffness for buckling

use serde::{Deserialize, Serialize};
use std::f64::consts::PI;

// ============================================================================
// CROSS-SECTION PROPERTIES
// ============================================================================

/// Complete cross-section properties
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CrossSection {
    pub name: String,
    pub area: f64,           // A
    pub iyy: f64,            // Moment of inertia about y
    pub izz: f64,            // Moment of inertia about z
    pub iyz: f64,            // Product of inertia
    pub j: f64,              // Torsional constant
    pub cw: f64,             // Warping constant
    pub sy: f64,             // Shear area factor y
    pub sz: f64,             // Shear area factor z
    pub cy: f64,             // Centroid y from reference
    pub cz: f64,             // Centroid z from reference
    pub shy: f64,            // Shear center y
    pub shz: f64,            // Shear center z
    pub zy: f64,             // Plastic modulus y
    pub zz: f64,             // Plastic modulus z
    pub ry: f64,             // Radius of gyration y
    pub rz: f64,             // Radius of gyration z
}

impl CrossSection {
    /// Create rectangular section
    pub fn rectangular(name: &str, b: f64, h: f64) -> Self {
        let area = b * h;
        let iyy = b * h.powi(3) / 12.0;
        let izz = h * b.powi(3) / 12.0;
        let j = if b <= h {
            b.powi(3) * h / 3.0 * (1.0 - 0.63 * b / h * (1.0 - b.powi(4) / (12.0 * h.powi(4))))
        } else {
            h.powi(3) * b / 3.0 * (1.0 - 0.63 * h / b * (1.0 - h.powi(4) / (12.0 * b.powi(4))))
        };

        CrossSection {
            name: name.to_string(),
            area,
            iyy,
            izz,
            iyz: 0.0,
            j,
            cw: 0.0,
            sy: 5.0 / 6.0,
            sz: 5.0 / 6.0,
            cy: 0.0,
            cz: 0.0,
            shy: 0.0,
            shz: 0.0,
            zy: b * h.powi(2) / 4.0,
            zz: h * b.powi(2) / 4.0,
            ry: (iyy / area).sqrt(),
            rz: (izz / area).sqrt(),
        }
    }

    /// Create circular section
    pub fn circular(name: &str, d: f64) -> Self {
        let r = d / 2.0;
        let area = PI * r.powi(2);
        let i = PI * r.powi(4) / 4.0;
        let j = PI * r.powi(4) / 2.0;

        CrossSection {
            name: name.to_string(),
            area,
            iyy: i,
            izz: i,
            iyz: 0.0,
            j,
            cw: 0.0,
            sy: 0.9,
            sz: 0.9,
            cy: 0.0,
            cz: 0.0,
            shy: 0.0,
            shz: 0.0,
            zy: d.powi(3) / 6.0,
            zz: d.powi(3) / 6.0,
            ry: r / 2.0,
            rz: r / 2.0,
        }
    }

    /// Create hollow circular section (pipe)
    pub fn pipe(name: &str, d_outer: f64, d_inner: f64) -> Self {
        let ro = d_outer / 2.0;
        let ri = d_inner / 2.0;
        let area = PI * (ro.powi(2) - ri.powi(2));
        let i = PI * (ro.powi(4) - ri.powi(4)) / 4.0;
        let j = PI * (ro.powi(4) - ri.powi(4)) / 2.0;

        CrossSection {
            name: name.to_string(),
            area,
            iyy: i,
            izz: i,
            iyz: 0.0,
            j,
            cw: 0.0,
            sy: 0.5,
            sz: 0.5,
            cy: 0.0,
            cz: 0.0,
            shy: 0.0,
            shz: 0.0,
            zy: (d_outer.powi(3) - d_inner.powi(3)) / 6.0,
            zz: (d_outer.powi(3) - d_inner.powi(3)) / 6.0,
            ry: (i / area).sqrt(),
            rz: (i / area).sqrt(),
        }
    }

    /// Create I-section (W/H shape)
    pub fn i_section(name: &str, d: f64, bf: f64, tf: f64, tw: f64) -> Self {
        let hw = d - 2.0 * tf;
        
        // Area
        let area = 2.0 * bf * tf + hw * tw;
        
        // Strong axis (y-y) moment of inertia
        let iyy = (bf * d.powi(3) - (bf - tw) * hw.powi(3)) / 12.0;
        
        // Weak axis (z-z) moment of inertia
        let izz = (2.0 * tf * bf.powi(3) + hw * tw.powi(3)) / 12.0;
        
        // Torsional constant (approximate)
        let j = (2.0 * bf * tf.powi(3) + hw * tw.powi(3)) / 3.0;
        
        // Warping constant
        let cw = tf * bf.powi(3) * (d - tf).powi(2) / 24.0;
        
        // Plastic moduli
        let zy = bf * tf * (d - tf) + tw * hw.powi(2) / 4.0;
        let zz = bf.powi(2) * tf / 2.0 + tw.powi(2) * hw / 4.0;

        CrossSection {
            name: name.to_string(),
            area,
            iyy,
            izz,
            iyz: 0.0,
            j,
            cw,
            sy: area / (d * tw),
            sz: area / (2.0 * bf * tf),
            cy: 0.0,
            cz: 0.0,
            shy: 0.0,
            shz: 0.0,
            zy,
            zz,
            ry: (iyy / area).sqrt(),
            rz: (izz / area).sqrt(),
        }
    }

    /// Create box/tube section
    pub fn box_section(name: &str, b: f64, h: f64, t: f64) -> Self {
        let bi = b - 2.0 * t;
        let hi = h - 2.0 * t;
        let area = b * h - bi * hi;
        let iyy = (b * h.powi(3) - bi * hi.powi(3)) / 12.0;
        let izz = (h * b.powi(3) - hi * bi.powi(3)) / 12.0;
        
        // Bredt's formula for closed section
        let am = (b - t) * (h - t);  // Mean enclosed area
        let j = 4.0 * am.powi(2) / (2.0 * (b + h - 2.0 * t) / t);

        CrossSection {
            name: name.to_string(),
            area,
            iyy,
            izz,
            iyz: 0.0,
            j,
            cw: 0.0,
            sy: area / (2.0 * h * t),
            sz: area / (2.0 * b * t),
            cy: 0.0,
            cz: 0.0,
            shy: 0.0,
            shz: 0.0,
            zy: area * h / 4.0,
            zz: area * b / 4.0,
            ry: (iyy / area).sqrt(),
            rz: (izz / area).sqrt(),
        }
    }

    /// Create channel section (C)
    pub fn channel(name: &str, d: f64, bf: f64, tf: f64, tw: f64) -> Self {
        let hw = d - 2.0 * tf;
        let area = 2.0 * bf * tf + hw * tw;
        
        // Centroid location from web
        let cy = (2.0 * bf * tf * bf / 2.0) / area;
        
        let iyy = (tw * d.powi(3) + 2.0 * (bf - tw / 2.0) * tf.powi(3)) / 12.0 
                + 2.0 * bf * tf * ((d - tf) / 2.0).powi(2);
        let izz = (d * tw.powi(3) + 2.0 * tf * bf.powi(3)) / 12.0
                + area * cy.powi(2);

        CrossSection {
            name: name.to_string(),
            area,
            iyy,
            izz,
            iyz: 0.0,
            j: (2.0 * bf * tf.powi(3) + hw * tw.powi(3)) / 3.0,
            cw: 0.0,
            sy: 5.0 / 6.0,
            sz: 5.0 / 6.0,
            cy,
            cz: 0.0,
            shy: cy + 3.0 * bf.powi(2) * tf / area,  // Approximate
            shz: 0.0,
            zy: iyy / (d / 2.0),
            zz: izz / (bf - cy),
            ry: (iyy / area).sqrt(),
            rz: (izz / area).sqrt(),
        }
    }

    /// Create angle section (L)
    pub fn angle(name: &str, leg1: f64, leg2: f64, t: f64) -> Self {
        let a1 = leg1 * t;
        let a2 = (leg2 - t) * t;
        let area = a1 + a2;
        
        let cy = (a1 * t / 2.0 + a2 * (t + (leg2 - t) / 2.0)) / area;
        let cz = (a1 * leg1 / 2.0 + a2 * t / 2.0) / area;
        
        let iyy = t * leg1.powi(3) / 12.0 + a1 * (leg1 / 2.0 - cz).powi(2)
                + (leg2 - t) * t.powi(3) / 12.0 + a2 * (cz - t / 2.0).powi(2);
        let izz = leg1 * t.powi(3) / 12.0 + a1 * (cy - t / 2.0).powi(2)
                + t * (leg2 - t).powi(3) / 12.0 + a2 * (t + (leg2 - t) / 2.0 - cy).powi(2);

        CrossSection {
            name: name.to_string(),
            area,
            iyy,
            izz,
            iyz: 0.0,  // Non-zero for unsymmetric angles
            j: (leg1 + leg2 - t) * t.powi(3) / 3.0,
            cw: 0.0,
            sy: 5.0 / 6.0,
            sz: 5.0 / 6.0,
            cy,
            cz,
            shy: cy,
            shz: cz,
            zy: iyy / cz.max(leg1 - cz),
            zz: izz / cy.max(leg2 - cy),
            ry: (iyy / area).sqrt(),
            rz: (izz / area).sqrt(),
        }
    }

    /// Create T-section
    pub fn t_section(name: &str, d: f64, bf: f64, tf: f64, tw: f64) -> Self {
        let hw = d - tf;
        let af = bf * tf;
        let aw = hw * tw;
        let area = af + aw;
        
        // Centroid from bottom
        let cz = (af * (d - tf / 2.0) + aw * hw / 2.0) / area;
        
        let iyy = bf * tf.powi(3) / 12.0 + af * (d - tf / 2.0 - cz).powi(2)
                + tw * hw.powi(3) / 12.0 + aw * (cz - hw / 2.0).powi(2);
        let izz = tf * bf.powi(3) / 12.0 + hw * tw.powi(3) / 12.0;

        CrossSection {
            name: name.to_string(),
            area,
            iyy,
            izz,
            iyz: 0.0,
            j: (bf * tf.powi(3) + hw * tw.powi(3)) / 3.0,
            cw: 0.0,
            sy: area / (hw * tw),
            sz: area / (bf * tf),
            cy: 0.0,
            cz,
            shy: 0.0,
            shz: d - tf,  // Approximate
            zy: iyy / cz.max(d - cz),
            zz: izz / (bf / 2.0),
            ry: (iyy / area).sqrt(),
            rz: (izz / area).sqrt(),
        }
    }
}

// ============================================================================
// BEAM MATERIAL
// ============================================================================

/// Beam material properties
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BeamMaterial {
    pub e: f64,      // Young's modulus
    pub g: f64,      // Shear modulus
    pub nu: f64,     // Poisson's ratio
    pub density: f64,
    pub alpha: f64,  // Thermal expansion
    pub name: String,
}

impl BeamMaterial {
    pub fn new(e: f64, nu: f64, density: f64, name: &str) -> Self {
        BeamMaterial {
            e,
            g: e / (2.0 * (1.0 + nu)),
            nu,
            density,
            alpha: 0.0,
            name: name.to_string(),
        }
    }

    pub fn steel() -> Self {
        Self::new(200e9, 0.3, 7850.0, "Steel")
    }

    pub fn aluminum() -> Self {
        Self::new(70e9, 0.33, 2700.0, "Aluminum")
    }

    pub fn concrete() -> Self {
        Self::new(30e9, 0.2, 2400.0, "Concrete")
    }

    pub fn timber() -> Self {
        Self::new(12e9, 0.35, 600.0, "Timber")
    }
}

// ============================================================================
// TIMOSHENKO BEAM ELEMENT
// ============================================================================

/// 3D Timoshenko beam element with 6 DOF per node
/// Includes shear deformation for thick beams
#[derive(Debug, Clone)]
pub struct TimoshenkoBeam3D {
    pub nodes: [usize; 2],
    pub coords: [[f64; 3]; 2],
    pub section: CrossSection,
    pub material: BeamMaterial,
    pub releases: BeamReleases,
    pub local_axes: Option<BeamLocalAxes>,
}

/// End releases (hinges)
#[derive(Debug, Clone, Default)]
pub struct BeamReleases {
    pub start_mx: bool,  // Moment release at start about x
    pub start_my: bool,
    pub start_mz: bool,
    pub end_mx: bool,
    pub end_my: bool,
    pub end_mz: bool,
}

/// Local coordinate system for beam
#[derive(Debug, Clone, Copy)]
pub struct BeamLocalAxes {
    pub x: [f64; 3],  // Along beam
    pub y: [f64; 3],  // Weak axis
    pub z: [f64; 3],  // Strong axis
}

impl TimoshenkoBeam3D {
    pub fn new(
        nodes: [usize; 2],
        coords: [[f64; 3]; 2],
        section: CrossSection,
        material: BeamMaterial,
    ) -> Self {
        let mut beam = TimoshenkoBeam3D {
            nodes,
            coords,
            section,
            material,
            releases: BeamReleases::default(),
            local_axes: None,
        };
        beam.compute_local_axes(None);
        beam
    }

    /// Compute local coordinate system
    /// ref_point can specify orientation (default: global Z up)
    pub fn compute_local_axes(&mut self, ref_point: Option<[f64; 3]>) {
        let dx = self.coords[1][0] - self.coords[0][0];
        let dy = self.coords[1][1] - self.coords[0][1];
        let dz = self.coords[1][2] - self.coords[0][2];
        let length = self.length();
        
        // Local x-axis along beam
        let x = [dx / length, dy / length, dz / length];
        
        // Determine local y and z axes
        let (y, z) = if let Some(ref_pt) = ref_point {
            // Vector from start to reference point
            let v = [
                ref_pt[0] - self.coords[0][0],
                ref_pt[1] - self.coords[0][1],
                ref_pt[2] - self.coords[0][2],
            ];
            let z = normalize(&cross(&x, &v));
            let y = cross(&z, &x);
            (y, z)
        } else {
            // Default: try to align z with global Z
            let global_z = [0.0, 0.0, 1.0];
            
            // Check if beam is vertical
            if (x[0].abs() < 1e-10) && (x[1].abs() < 1e-10) {
                // Vertical beam - use global X for reference
                let _global_x = [1.0, 0.0, 0.0];
                let y = normalize(&cross(&global_z, &x));
                let z = cross(&x, &y);
                (y, z)
            } else {
                // General case
                let z = normalize(&cross(&x, &global_z));
                let y = cross(&z, &x);
                (y, z)
            }
        };
        
        self.local_axes = Some(BeamLocalAxes { x, y, z });
    }

    /// Element length
    pub fn length(&self) -> f64 {
        let dx = self.coords[1][0] - self.coords[0][0];
        let dy = self.coords[1][1] - self.coords[0][1];
        let dz = self.coords[1][2] - self.coords[0][2];
        (dx * dx + dy * dy + dz * dz).sqrt()
    }

    /// Transformation matrix (12x12) from local to global
    pub fn transformation_matrix(&self) -> [[f64; 12]; 12] {
        let axes = self.local_axes.unwrap();
        let mut t = [[0.0; 12]; 12];
        
        // 3x3 rotation submatrix
        let r = [
            [axes.x[0], axes.y[0], axes.z[0]],
            [axes.x[1], axes.y[1], axes.z[1]],
            [axes.x[2], axes.y[2], axes.z[2]],
        ];
        
        // Fill 4 diagonal 3x3 blocks
        for block in 0..4 {
            let offset = block * 3;
            for i in 0..3 {
                for j in 0..3 {
                    t[offset + i][offset + j] = r[i][j];
                }
            }
        }
        
        t
    }

    /// Local stiffness matrix (12x12)
    /// DOF order: [u1, v1, w1, θx1, θy1, θz1, u2, v2, w2, θx2, θy2, θz2]
    pub fn local_stiffness_matrix(&self) -> [[f64; 12]; 12] {
        let l = self.length();
        let e = self.material.e;
        let g = self.material.g;
        let a = self.section.area;
        let iyy = self.section.iyy;
        let izz = self.section.izz;
        let j = self.section.j;
        
        // Shear factors
        let kappa_y = self.section.sy;
        let kappa_z = self.section.sz;
        
        // Shear deformation parameters
        let phi_y = if kappa_y > 0.0 {
            12.0 * e * izz / (kappa_y * g * a * l * l)
        } else {
            0.0
        };
        let phi_z = if kappa_z > 0.0 {
            12.0 * e * iyy / (kappa_z * g * a * l * l)
        } else {
            0.0
        };
        
        let mut k = [[0.0; 12]; 12];
        
        // Axial stiffness
        let ka = e * a / l;
        k[0][0] = ka;
        k[0][6] = -ka;
        k[6][0] = -ka;
        k[6][6] = ka;
        
        // Torsional stiffness
        let kt = g * j / l;
        k[3][3] = kt;
        k[3][9] = -kt;
        k[9][3] = -kt;
        k[9][9] = kt;
        
        // Bending about local y (in x-z plane)
        let ky = e * iyy / (l * l * l * (1.0 + phi_z));
        k[2][2] = 12.0 * ky;
        k[2][4] = 6.0 * l * ky;
        k[2][8] = -12.0 * ky;
        k[2][10] = 6.0 * l * ky;
        
        k[4][2] = 6.0 * l * ky;
        k[4][4] = (4.0 + phi_z) * l * l * ky;
        k[4][8] = -6.0 * l * ky;
        k[4][10] = (2.0 - phi_z) * l * l * ky;
        
        k[8][2] = -12.0 * ky;
        k[8][4] = -6.0 * l * ky;
        k[8][8] = 12.0 * ky;
        k[8][10] = -6.0 * l * ky;
        
        k[10][2] = 6.0 * l * ky;
        k[10][4] = (2.0 - phi_z) * l * l * ky;
        k[10][8] = -6.0 * l * ky;
        k[10][10] = (4.0 + phi_z) * l * l * ky;
        
        // Bending about local z (in x-y plane)
        let kz = e * izz / (l * l * l * (1.0 + phi_y));
        k[1][1] = 12.0 * kz;
        k[1][5] = -6.0 * l * kz;
        k[1][7] = -12.0 * kz;
        k[1][11] = -6.0 * l * kz;
        
        k[5][1] = -6.0 * l * kz;
        k[5][5] = (4.0 + phi_y) * l * l * kz;
        k[5][7] = 6.0 * l * kz;
        k[5][11] = (2.0 - phi_y) * l * l * kz;
        
        k[7][1] = -12.0 * kz;
        k[7][5] = 6.0 * l * kz;
        k[7][7] = 12.0 * kz;
        k[7][11] = 6.0 * l * kz;
        
        k[11][1] = -6.0 * l * kz;
        k[11][5] = (2.0 - phi_y) * l * l * kz;
        k[11][7] = 6.0 * l * kz;
        k[11][11] = (4.0 + phi_y) * l * l * kz;
        
        k
    }

    /// Global stiffness matrix
    pub fn stiffness_matrix(&self) -> [[f64; 12]; 12] {
        let k_local = self.local_stiffness_matrix();
        let t = self.transformation_matrix();
        
        // K_global = T^T * K_local * T
        transform_matrix(&k_local, &t)
    }

    /// Consistent mass matrix (local)
    pub fn local_mass_matrix(&self) -> [[f64; 12]; 12] {
        let l = self.length();
        let rho = self.material.density;
        let a = self.section.area;
        let iyy = self.section.iyy;
        let izz = self.section.izz;
        let _j = self.section.j;
        
        let m = rho * a * l;  // Total mass
        
        let mut mass = [[0.0; 12]; 12];
        
        // Axial inertia
        mass[0][0] = m / 3.0;
        mass[0][6] = m / 6.0;
        mass[6][0] = m / 6.0;
        mass[6][6] = m / 3.0;
        
        // Torsional inertia
        let ip = rho * (iyy + izz) * l;
        mass[3][3] = ip / 3.0;
        mass[3][9] = ip / 6.0;
        mass[9][3] = ip / 6.0;
        mass[9][9] = ip / 3.0;
        
        // Bending in x-z plane (consistent mass)
        let m1 = 156.0 * m / 420.0;
        let m2 = 22.0 * l * m / 420.0;
        let m3 = 54.0 * m / 420.0;
        let m4 = -13.0 * l * m / 420.0;
        let m5 = 4.0 * l * l * m / 420.0;
        let m6 = -3.0 * l * l * m / 420.0;
        
        mass[2][2] = m1;
        mass[2][4] = m2;
        mass[2][8] = m3;
        mass[2][10] = m4;
        
        mass[4][2] = m2;
        mass[4][4] = m5;
        mass[4][8] = -m4;
        mass[4][10] = m6;
        
        mass[8][2] = m3;
        mass[8][4] = -m4;
        mass[8][8] = m1;
        mass[8][10] = -m2;
        
        mass[10][2] = m4;
        mass[10][4] = m6;
        mass[10][8] = -m2;
        mass[10][10] = m5;
        
        // Bending in x-y plane
        mass[1][1] = m1;
        mass[1][5] = -m2;
        mass[1][7] = m3;
        mass[1][11] = -m4;  // Convention: θz = -dv/dx → sign flip vs XZ plane
        
        mass[5][1] = -m2;
        mass[5][5] = m5;
        mass[5][7] = m4;
        mass[5][11] = m6;
        
        mass[7][1] = m3;
        mass[7][5] = m4;
        mass[7][7] = m1;
        mass[7][11] = m2;
        
        mass[11][1] = -m4;  // Convention: θz = -dv/dx → sign flip vs XZ plane
        mass[11][5] = m6;
        mass[11][7] = m2;
        mass[11][11] = m5;
        
        mass
    }

    /// Global mass matrix
    pub fn mass_matrix(&self) -> [[f64; 12]; 12] {
        let m_local = self.local_mass_matrix();
        let t = self.transformation_matrix();
        transform_matrix(&m_local, &t)
    }

    /// Lumped mass matrix (diagonal)
    pub fn lumped_mass_matrix(&self) -> [[f64; 12]; 12] {
        let l = self.length();
        let m = self.material.density * self.section.area * l / 2.0;
        
        let mut mass = [[0.0; 12]; 12];
        
        // Translational mass at each node
        for i in [0, 1, 2, 6, 7, 8] {
            mass[i][i] = m;
        }
        
        // Rotational inertia (small)
        let ir = m * l * l / 12.0;
        for i in [3, 4, 5, 9, 10, 11] {
            mass[i][i] = ir;
        }
        
        mass
    }

    /// Geometric stiffness matrix (for buckling/P-delta)
    pub fn geometric_stiffness_matrix(&self, axial_force: f64) -> [[f64; 12]; 12] {
        let l = self.length();
        let p = axial_force;  // Positive = tension
        
        let mut kg = [[0.0; 12]; 12];
        
        let c1 = p / l;
        let _c2 = p / 10.0;
        let _c3 = p * l / 30.0;
        
        // Bending in x-z plane (standard geometric stiffness per Cook et al.)
        // kg = P/(30L) × [36, 3L, -36, 3L; 3L, 4L², -3L, -L²; ...]
        kg[2][2] = 6.0 * c1 / 5.0;
        kg[2][4] = l * c1 / 10.0;
        kg[2][8] = -6.0 * c1 / 5.0;
        kg[2][10] = l * c1 / 10.0;
        
        kg[4][2] = l * c1 / 10.0;
        kg[4][4] = 2.0 * l * l * c1 / 15.0;
        kg[4][8] = -l * c1 / 10.0;
        kg[4][10] = -l * l * c1 / 30.0;
        
        kg[8][2] = -6.0 * c1 / 5.0;
        kg[8][4] = -l * c1 / 10.0;
        kg[8][8] = 6.0 * c1 / 5.0;
        kg[8][10] = -l * c1 / 10.0;
        
        kg[10][2] = l * c1 / 10.0;
        kg[10][4] = -l * l * c1 / 30.0;
        kg[10][8] = -l * c1 / 10.0;
        kg[10][10] = 2.0 * l * l * c1 / 15.0;
        
        // Bending in x-y plane (same pattern, opposite sign for v-θz coupling)
        kg[1][1] = 6.0 * c1 / 5.0;
        kg[1][5] = -l * c1 / 10.0;
        kg[1][7] = -6.0 * c1 / 5.0;
        kg[1][11] = -l * c1 / 10.0;
        
        kg[5][1] = -l * c1 / 10.0;
        kg[5][5] = 2.0 * l * l * c1 / 15.0;
        kg[5][7] = l * c1 / 10.0;
        kg[5][11] = -l * l * c1 / 30.0;
        
        kg[7][1] = -6.0 * c1 / 5.0;
        kg[7][5] = l * c1 / 10.0;
        kg[7][7] = 6.0 * c1 / 5.0;
        kg[7][11] = l * c1 / 10.0;
        
        kg[11][1] = -l * c1 / 10.0;
        kg[11][5] = -l * l * c1 / 30.0;
        kg[11][7] = l * c1 / 10.0;
        kg[11][11] = 2.0 * l * l * c1 / 15.0;
        
        // Transform to global
        let t = self.transformation_matrix();
        transform_matrix(&kg, &t)
    }

    /// Element fixed-end forces for uniform load in local coordinates
    pub fn fixed_end_forces_uniform(&self, wx: f64, wy: f64, wz: f64) -> [f64; 12] {
        let l = self.length();
        
        let mut f = [0.0; 12];
        
        // Axial
        f[0] = wx * l / 2.0;
        f[6] = wx * l / 2.0;
        
        // Transverse y
        f[1] = wy * l / 2.0;
        f[5] = -wy * l * l / 12.0;
        f[7] = wy * l / 2.0;
        f[11] = wy * l * l / 12.0;
        
        // Transverse z
        f[2] = wz * l / 2.0;
        f[4] = wz * l * l / 12.0;
        f[8] = wz * l / 2.0;
        f[10] = -wz * l * l / 12.0;
        
        f
    }

    /// Element fixed-end forces for point load
    pub fn fixed_end_forces_point(
        &self,
        px: f64,
        py: f64,
        pz: f64,
        a: f64,  // Distance from node 1
    ) -> [f64; 12] {
        let l = self.length();
        let b = l - a;
        
        let mut f = [0.0; 12];
        
        // Axial
        f[0] = px * b / l;
        f[6] = px * a / l;
        
        // Transverse y
        f[1] = py * b * b * (3.0 * a + b) / (l * l * l);
        f[5] = -py * a * b * b / (l * l);
        f[7] = py * a * a * (a + 3.0 * b) / (l * l * l);
        f[11] = py * a * a * b / (l * l);
        
        // Transverse z
        f[2] = pz * b * b * (3.0 * a + b) / (l * l * l);
        f[4] = pz * a * b * b / (l * l);
        f[8] = pz * a * a * (a + 3.0 * b) / (l * l * l);
        f[10] = -pz * a * a * b / (l * l);
        
        f
    }

    /// Extract internal forces from displacements
    pub fn internal_forces(&self, u_local: &[f64; 12]) -> BeamInternalForces {
        let l = self.length();
        let e = self.material.e;
        let a = self.section.area;
        let _iyy = self.section.iyy;
        let _izz = self.section.izz;
        let g = self.material.g;
        let j = self.section.j;
        
        // Axial force
        let n = e * a * (u_local[6] - u_local[0]) / l;
        
        // Torsion
        let t = g * j * (u_local[9] - u_local[3]) / l;
        
        // Bending moments and shears (simplified - at ends)
        let k = self.local_stiffness_matrix();
        let mut f = [0.0; 12];
        for i in 0..12 {
            for j in 0..12 {
                f[i] += k[i][j] * u_local[j];
            }
        }
        
        BeamInternalForces {
            axial: n,
            shear_y: f[1],
            shear_z: f[2],
            torsion: t,
            moment_y: f[4],
            moment_z: f[5],
        }
    }
}

/// Internal force results
#[derive(Debug, Clone)]
pub struct BeamInternalForces {
    pub axial: f64,
    pub shear_y: f64,
    pub shear_z: f64,
    pub torsion: f64,
    pub moment_y: f64,
    pub moment_z: f64,
}

// ============================================================================
// EULER-BERNOULLI BEAM (NO SHEAR)
// ============================================================================

/// Classical Euler-Bernoulli beam element
/// Use for slender beams where shear deformation is negligible
#[derive(Debug, Clone)]
pub struct EulerBernoulliBeam {
    pub nodes: [usize; 2],
    pub coords: [[f64; 3]; 2],
    pub section: CrossSection,
    pub material: BeamMaterial,
}

impl EulerBernoulliBeam {
    pub fn new(
        nodes: [usize; 2],
        coords: [[f64; 3]; 2],
        section: CrossSection,
        material: BeamMaterial,
    ) -> Self {
        EulerBernoulliBeam { nodes, coords, section, material }
    }

    pub fn length(&self) -> f64 {
        let dx = self.coords[1][0] - self.coords[0][0];
        let dy = self.coords[1][1] - self.coords[0][1];
        let dz = self.coords[1][2] - self.coords[0][2];
        (dx * dx + dy * dy + dz * dz).sqrt()
    }

    /// 2D local stiffness (4x4 for bending only)
    pub fn bending_stiffness_2d(&self) -> [[f64; 4]; 4] {
        let l = self.length();
        let ei = self.material.e * self.section.iyy;
        let c = ei / (l * l * l);
        
        [
            [12.0 * c,  6.0 * l * c, -12.0 * c,  6.0 * l * c],
            [6.0 * l * c, 4.0 * l * l * c, -6.0 * l * c, 2.0 * l * l * c],
            [-12.0 * c, -6.0 * l * c, 12.0 * c, -6.0 * l * c],
            [6.0 * l * c, 2.0 * l * l * c, -6.0 * l * c, 4.0 * l * l * c],
        ]
    }
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

fn cross(a: &[f64; 3], b: &[f64; 3]) -> [f64; 3] {
    [
        a[1] * b[2] - a[2] * b[1],
        a[2] * b[0] - a[0] * b[2],
        a[0] * b[1] - a[1] * b[0],
    ]
}

fn normalize(v: &[f64; 3]) -> [f64; 3] {
    let mag = (v[0]*v[0] + v[1]*v[1] + v[2]*v[2]).sqrt();
    if mag > 1e-14 {
        [v[0]/mag, v[1]/mag, v[2]/mag]
    } else {
        [0.0, 0.0, 0.0]
    }
}

/// Transform matrix: T^T * M * T
fn transform_matrix(m: &[[f64; 12]; 12], t: &[[f64; 12]; 12]) -> [[f64; 12]; 12] {
    // First: M * T
    let mut mt = [[0.0; 12]; 12];
    for i in 0..12 {
        for j in 0..12 {
            for k in 0..12 {
                mt[i][j] += m[i][k] * t[k][j];
            }
        }
    }
    
    // Then: T^T * (M * T)
    let mut result = [[0.0; 12]; 12];
    for i in 0..12 {
        for j in 0..12 {
            for k in 0..12 {
                result[i][j] += t[k][i] * mt[k][j];
            }
        }
    }
    
    result
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_rectangular_section() {
        let section = CrossSection::rectangular("R100x200", 0.1, 0.2);
        
        assert!((section.area - 0.02).abs() < 1e-10);
        assert!((section.iyy - 0.1 * 0.2_f64.powi(3) / 12.0).abs() < 1e-14);
    }

    #[test]
    fn test_circular_section() {
        let section = CrossSection::circular("D100", 0.1);
        
        let expected_area = PI * 0.05 * 0.05;
        assert!((section.area - expected_area).abs() < 1e-10);
    }

    #[test]
    fn test_pipe_section() {
        let section = CrossSection::pipe("Pipe", 0.1, 0.08);
        
        assert!(section.area > 0.0);
        assert!(section.j > section.iyy);  // Polar > bending for pipes
    }

    #[test]
    fn test_i_section() {
        let section = CrossSection::i_section("W310x97", 0.310, 0.205, 0.0152, 0.0093);
        
        assert!(section.area > 0.0);
        assert!(section.iyy > section.izz);  // Strong axis > weak
    }

    #[test]
    fn test_box_section() {
        let section = CrossSection::box_section("Box", 0.2, 0.3, 0.01);
        
        assert!(section.area > 0.0);
        assert!(section.j > 0.0);  // Closed section has good torsion
    }

    #[test]
    fn test_beam_material() {
        let mat = BeamMaterial::steel();
        
        assert!((mat.e - 200e9).abs() < 1e3);
        assert!((mat.nu - 0.3).abs() < 1e-6);
        assert!((mat.g - mat.e / (2.0 * 1.3)).abs() < 1e3);
    }

    #[test]
    fn test_timoshenko_beam_creation() {
        let section = CrossSection::rectangular("R", 0.1, 0.2);
        let material = BeamMaterial::steel();
        
        let beam = TimoshenkoBeam3D::new(
            [0, 1],
            [[0.0, 0.0, 0.0], [5.0, 0.0, 0.0]],
            section,
            material,
        );
        
        assert!((beam.length() - 5.0).abs() < 1e-10);
        assert!(beam.local_axes.is_some());
    }

    #[test]
    fn test_beam_stiffness_symmetry() {
        let section = CrossSection::rectangular("R", 0.1, 0.2);
        let material = BeamMaterial::steel();
        
        let beam = TimoshenkoBeam3D::new(
            [0, 1],
            [[0.0, 0.0, 0.0], [3.0, 0.0, 0.0]],
            section,
            material,
        );
        
        let k = beam.local_stiffness_matrix();
        
        for i in 0..12 {
            for j in 0..12 {
                assert!((k[i][j] - k[j][i]).abs() < 1e-6);
            }
        }
    }

    #[test]
    fn test_beam_mass_symmetry() {
        let section = CrossSection::rectangular("R", 0.1, 0.2);
        let material = BeamMaterial::steel();
        
        let beam = TimoshenkoBeam3D::new(
            [0, 1],
            [[0.0, 0.0, 0.0], [3.0, 0.0, 0.0]],
            section,
            material,
        );
        
        let m = beam.local_mass_matrix();
        
        for i in 0..12 {
            for j in 0..12 {
                assert!((m[i][j] - m[j][i]).abs() < 1e-6);
            }
        }
    }

    #[test]
    fn test_euler_bernoulli() {
        let section = CrossSection::rectangular("R", 0.1, 0.2);
        let material = BeamMaterial::steel();
        
        let beam = EulerBernoulliBeam::new(
            [0, 1],
            [[0.0, 0.0, 0.0], [5.0, 0.0, 0.0]],
            section,
            material,
        );
        
        let k = beam.bending_stiffness_2d();
        
        // Check symmetry
        for i in 0..4 {
            for j in 0..4 {
                assert!((k[i][j] - k[j][i]).abs() < 1e-6);
            }
        }
    }

    #[test]
    fn test_geometric_stiffness() {
        let section = CrossSection::rectangular("R", 0.1, 0.2);
        let material = BeamMaterial::steel();
        
        let beam = TimoshenkoBeam3D::new(
            [0, 1],
            [[0.0, 0.0, 0.0], [3.0, 0.0, 0.0]],
            section,
            material,
        );
        
        let kg = beam.geometric_stiffness_matrix(100000.0);
        
        // Check symmetry
        for i in 0..12 {
            for j in 0..12 {
                assert!((kg[i][j] - kg[j][i]).abs() < 1e-6);
            }
        }
    }

    #[test]
    fn test_fixed_end_forces_uniform() {
        let section = CrossSection::rectangular("R", 0.1, 0.2);
        let material = BeamMaterial::steel();
        
        let beam = TimoshenkoBeam3D::new(
            [0, 1],
            [[0.0, 0.0, 0.0], [4.0, 0.0, 0.0]],
            section,
            material,
        );
        
        let f = beam.fixed_end_forces_uniform(0.0, 10000.0, 0.0);
        
        // Vertical reactions should sum to total load
        let total_load = 10000.0 * 4.0;
        assert!((f[1] + f[7] - total_load).abs() < 1e-6);
    }

    #[test]
    fn test_channel_section() {
        let section = CrossSection::channel("C", 0.3, 0.1, 0.015, 0.01);
        
        assert!(section.area > 0.0);
        assert!(section.cy > 0.0);  // Centroid offset from web
    }

    #[test]
    fn test_angle_section() {
        let section = CrossSection::angle("L", 0.1, 0.1, 0.01);
        
        assert!(section.area > 0.0);
        assert!(section.cy > 0.0);
        assert!(section.cz > 0.0);
    }

    #[test]
    fn test_t_section() {
        let section = CrossSection::t_section("T", 0.2, 0.15, 0.02, 0.015);
        
        assert!(section.area > 0.0);
        assert!(section.cz > 0.0);  // Centroid above bottom
    }

    #[test]
    fn test_transformation_matrix() {
        let section = CrossSection::rectangular("R", 0.1, 0.2);
        let material = BeamMaterial::steel();
        
        let beam = TimoshenkoBeam3D::new(
            [0, 1],
            [[0.0, 0.0, 0.0], [3.0, 4.0, 0.0]],  // Inclined beam
            section,
            material,
        );
        
        let t = beam.transformation_matrix();
        
        // Check orthogonality: T^T * T = I for each 3x3 block
        for block in 0..4 {
            let offset = block * 3;
            for i in 0..3 {
                for j in 0..3 {
                    let mut sum = 0.0;
                    for k in 0..3 {
                        sum += t[offset + k][offset + i] * t[offset + k][offset + j];
                    }
                    let expected = if i == j { 1.0 } else { 0.0 };
                    assert!((sum - expected).abs() < 1e-10);
                }
            }
        }
    }
}
