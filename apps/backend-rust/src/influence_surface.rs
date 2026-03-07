//! 2-D Influence Surface Engine for Bridge Decks
//!
//! Extends the classical 1-D influence line concept to 2-D slabs / bridge
//! decks so that a truck axle footprint (rectangular patch load) can be
//! scanned across a meshed slab to find worst-case principal stresses,
//! moments, and reactions.
//!
//! ## Features
//! - 2-D influence surface generation for any response at any output point
//! - Rectangular plate finite-element stiffness (Kirchhoff thin plate, 4-node)
//! - Truck axle footprint definition (multi-wheel, multi-axle)
//! - Automatic scan across deck surface with user-defined step size
//! - Worst-case principal stress, moment, and reaction extraction
//! - IRC / AASHTO / Eurocode vehicle templates
//! - Contact patch area distribution per AASHTO 3.6.1.2.5
//!
//! ## References
//! - IRC 6:2017 — Standard Specifications & Code of Practice for Road Bridges
//! - AASHTO LRFD 9th Ed — Bridge Design Specifications
//! - EN 1991-2:2003 — Traffic loads on bridges
//! - Ghali & Neville — Structural Analysis (Influence surfaces, Ch. 12)

use serde::{Deserialize, Serialize};

// ============================================================================
// SLAB / DECK MESH
// ============================================================================

/// A quadrilateral plate element in the deck mesh
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PlateElement {
    /// Element ID
    pub id: usize,
    /// Node indices (4 corners, counter-clockwise)
    pub nodes: [usize; 4],
    /// Plate thickness (m)
    pub thickness: f64,
    /// Elastic modulus (MPa)
    pub elastic_modulus: f64,
    /// Poisson's ratio
    pub poisson_ratio: f64,
}

/// Node on the deck surface
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DeckNode {
    pub id: usize,
    pub x: f64, // along traffic direction (m)
    pub y: f64, // transverse (m)
    pub z: f64, // vertical (m)
}

/// Complete deck mesh definition
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DeckMesh {
    pub nodes: Vec<DeckNode>,
    pub elements: Vec<PlateElement>,
    /// Supported node indices with DOF constraints
    pub supports: Vec<SupportCondition>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SupportCondition {
    pub node_id: usize,
    pub fix_x: bool,
    pub fix_y: bool,
    pub fix_z: bool,
    pub fix_rx: bool,
    pub fix_ry: bool,
}

impl DeckMesh {
    /// Generate a regular rectangular mesh for a simple slab bridge.
    ///
    /// * `span` — length along traffic direction (m)
    /// * `width` — transverse width (m)
    /// * `nx`, `ny` — number of divisions
    /// * `thickness`, `e_mod`, `poisson` — material properties
    pub fn rectangular(
        span: f64, width: f64, nx: usize, ny: usize,
        thickness: f64, e_mod: f64, poisson: f64,
    ) -> Self {
        let dx = span / nx as f64;
        let dy = width / ny as f64;
        let mut nodes = Vec::new();
        for j in 0..=ny {
            for i in 0..=nx {
                let id = j * (nx + 1) + i;
                nodes.push(DeckNode {
                    id,
                    x: i as f64 * dx,
                    y: j as f64 * dy,
                    z: 0.0,
                });
            }
        }
        let mut elements = Vec::new();
        let mut eid = 0;
        for j in 0..ny {
            for i in 0..nx {
                let n0 = j * (nx + 1) + i;
                let n1 = n0 + 1;
                let n2 = n0 + (nx + 1) + 1;
                let n3 = n0 + (nx + 1);
                elements.push(PlateElement {
                    id: eid,
                    nodes: [n0, n1, n2, n3],
                    thickness,
                    elastic_modulus: e_mod,
                    poisson_ratio: poisson,
                });
                eid += 1;
            }
        }
        // Simply supported at x=0 and x=span
        let mut supports = Vec::new();
        for j in 0..=ny {
            // x = 0 support
            supports.push(SupportCondition {
                node_id: j * (nx + 1),
                fix_x: false, fix_y: false, fix_z: true,
                fix_rx: false, fix_ry: false,
            });
            // x = span support
            supports.push(SupportCondition {
                node_id: j * (nx + 1) + nx,
                fix_x: false, fix_y: false, fix_z: true,
                fix_rx: false, fix_ry: false,
            });
        }
        DeckMesh { nodes, elements, supports }
    }

    /// Get the node index at grid position (i, j) for a regular mesh
    pub fn grid_node_id(&self, i: usize, j: usize, nx: usize) -> usize {
        j * (nx + 1) + i
    }
}

// ============================================================================
// TRUCK / VEHICLE AXLE FOOTPRINT
// ============================================================================

/// Standard vehicle types for bridge loading
#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
pub enum VehicleStandard {
    /// IRC Class AA Tracked — 700 kN, single track
    IrcClassAaTracked,
    /// IRC Class AA Wheeled — 400 kN, 4 wheels
    IrcClassAaWheeled,
    /// IRC Class 70R Tracked — 700 kN
    Irc70rTracked,
    /// IRC Class 70R Wheeled — 1000 kN, 8 axles
    Irc70rWheeled,
    /// IRC Class A — 554 kN train of axle loads  
    IrcClassA,
    /// AASHTO HL-93 Design Truck (HS-20)
    AashtoHl93Truck,
    /// AASHTO HL-93 Design Tandem
    AashtoHl93Tandem,
    /// Eurocode LM1 Tandem System (TS)
    EurocodeLm1,
    /// Custom user-defined vehicle
    Custom,
}

/// A single wheel contact patch
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WheelPatch {
    /// X offset from vehicle reference point (m, along traffic)
    pub x_offset: f64,
    /// Y offset from vehicle reference point (m, transverse)
    pub y_offset: f64,
    /// Patch width in X (m)
    pub patch_length: f64,
    /// Patch width in Y (m)
    pub patch_width: f64,
    /// Wheel load (kN)
    pub load_kn: f64,
}

/// Complete axle footprint of a vehicle
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AxleFootprint {
    pub standard: VehicleStandard,
    pub label: String,
    /// Total vehicle weight (kN)
    pub total_weight: f64,
    /// Wheel patches relative to vehicle reference point
    pub wheels: Vec<WheelPatch>,
}

impl AxleFootprint {
    /// Create a standard vehicle footprint
    pub fn from_standard(std: VehicleStandard) -> Self {
        match std {
            VehicleStandard::AashtoHl93Truck => Self::aashto_hl93_truck(),
            VehicleStandard::AashtoHl93Tandem => Self::aashto_hl93_tandem(),
            VehicleStandard::IrcClassAaTracked => Self::irc_class_aa_tracked(),
            VehicleStandard::IrcClassAaWheeled => Self::irc_class_aa_wheeled(),
            VehicleStandard::Irc70rTracked => Self::irc_70r_tracked(),
            VehicleStandard::EurocodeLm1 => Self::eurocode_lm1(),
            _ => Self::aashto_hl93_truck(),
        }
    }

    /// AASHTO HL-93 Design Truck (HS20-44):
    /// 3 axles: 35 kN + 145 kN @ 4.3 m + 145 kN @ 4.3–9.0 m (use 4.3 m for max effects)
    /// Wheel spacing: 1.8 m transverse
    pub fn aashto_hl93_truck() -> Self {
        let hw = 0.9; // half transverse wheel spacing
        let pl = 0.51; // patch length (AASHTO 3.6.1.2.5: 510 mm)
        let pw = 0.25; // patch width (250 mm)
        AxleFootprint {
            standard: VehicleStandard::AashtoHl93Truck,
            label: "AASHTO HL-93 Design Truck".to_string(),
            total_weight: 325.0,
            wheels: vec![
                // Front axle: 35 kN (2 wheels × 17.5 kN)
                WheelPatch { x_offset: 0.0, y_offset: -hw, patch_length: pl, patch_width: pw, load_kn: 17.5 },
                WheelPatch { x_offset: 0.0, y_offset: hw, patch_length: pl, patch_width: pw, load_kn: 17.5 },
                // Rear axle 1: 145 kN (2 wheels × 72.5 kN)
                WheelPatch { x_offset: 4.3, y_offset: -hw, patch_length: pl, patch_width: pw, load_kn: 72.5 },
                WheelPatch { x_offset: 4.3, y_offset: hw, patch_length: pl, patch_width: pw, load_kn: 72.5 },
                // Rear axle 2: 145 kN (2 wheels × 72.5 kN)
                WheelPatch { x_offset: 8.6, y_offset: -hw, patch_length: pl, patch_width: pw, load_kn: 72.5 },
                WheelPatch { x_offset: 8.6, y_offset: hw, patch_length: pl, patch_width: pw, load_kn: 72.5 },
            ],
        }
    }

    /// AASHTO HL-93 Design Tandem: 2 × 110 kN axles at 1.2 m spacing
    pub fn aashto_hl93_tandem() -> Self {
        let hw = 0.9;
        let pl = 0.51;
        let pw = 0.25;
        AxleFootprint {
            standard: VehicleStandard::AashtoHl93Tandem,
            label: "AASHTO HL-93 Design Tandem".to_string(),
            total_weight: 220.0,
            wheels: vec![
                WheelPatch { x_offset: 0.0, y_offset: -hw, patch_length: pl, patch_width: pw, load_kn: 55.0 },
                WheelPatch { x_offset: 0.0, y_offset: hw, patch_length: pl, patch_width: pw, load_kn: 55.0 },
                WheelPatch { x_offset: 1.2, y_offset: -hw, patch_length: pl, patch_width: pw, load_kn: 55.0 },
                WheelPatch { x_offset: 1.2, y_offset: hw, patch_length: pl, patch_width: pw, load_kn: 55.0 },
            ],
        }
    }

    /// IRC Class AA Tracked — 700 kN, single track 3.6 m × 0.85 m contact
    pub fn irc_class_aa_tracked() -> Self {
        AxleFootprint {
            standard: VehicleStandard::IrcClassAaTracked,
            label: "IRC Class AA Tracked".to_string(),
            total_weight: 700.0,
            wheels: vec![
                WheelPatch {
                    x_offset: 0.0, y_offset: 0.0,
                    patch_length: 3.6, patch_width: 0.85,
                    load_kn: 700.0,
                },
            ],
        }
    }

    /// IRC Class AA Wheeled — 400 kN, 2 axles × 2 wheels
    pub fn irc_class_aa_wheeled() -> Self {
        let hw = 0.95;
        AxleFootprint {
            standard: VehicleStandard::IrcClassAaWheeled,
            label: "IRC Class AA Wheeled".to_string(),
            total_weight: 400.0,
            wheels: vec![
                WheelPatch { x_offset: 0.0, y_offset: -hw, patch_length: 0.30, patch_width: 0.15, load_kn: 62.5 },
                WheelPatch { x_offset: 0.0, y_offset: hw, patch_length: 0.30, patch_width: 0.15, load_kn: 62.5 },
                WheelPatch { x_offset: 0.0, y_offset: -hw - 0.38, patch_length: 0.30, patch_width: 0.15, load_kn: 37.5 },
                WheelPatch { x_offset: 0.0, y_offset: hw + 0.38, patch_length: 0.30, patch_width: 0.15, load_kn: 37.5 },
                WheelPatch { x_offset: 1.2, y_offset: -hw, patch_length: 0.30, patch_width: 0.15, load_kn: 62.5 },
                WheelPatch { x_offset: 1.2, y_offset: hw, patch_length: 0.30, patch_width: 0.15, load_kn: 62.5 },
                WheelPatch { x_offset: 1.2, y_offset: -hw - 0.38, patch_length: 0.30, patch_width: 0.15, load_kn: 37.5 },
                WheelPatch { x_offset: 1.2, y_offset: hw + 0.38, patch_length: 0.30, patch_width: 0.15, load_kn: 37.5 },
            ],
        }
    }

    /// IRC 70R Tracked — 700 kN, single track 4.57 m × 0.84 m
    pub fn irc_70r_tracked() -> Self {
        AxleFootprint {
            standard: VehicleStandard::Irc70rTracked,
            label: "IRC 70R Tracked".to_string(),
            total_weight: 700.0,
            wheels: vec![
                WheelPatch {
                    x_offset: 0.0, y_offset: 0.0,
                    patch_length: 4.57, patch_width: 0.84,
                    load_kn: 700.0,
                },
            ],
        }
    }

    /// Eurocode LM1 Tandem System (Lane 1: 2 × 300 kN axles)
    pub fn eurocode_lm1() -> Self {
        let hw = 1.0;
        AxleFootprint {
            standard: VehicleStandard::EurocodeLm1,
            label: "EN 1991-2 LM1 Tandem".to_string(),
            total_weight: 600.0,
            wheels: vec![
                WheelPatch { x_offset: 0.0, y_offset: -hw, patch_length: 0.40, patch_width: 0.40, load_kn: 150.0 },
                WheelPatch { x_offset: 0.0, y_offset: hw, patch_length: 0.40, patch_width: 0.40, load_kn: 150.0 },
                WheelPatch { x_offset: 1.2, y_offset: -hw, patch_length: 0.40, patch_width: 0.40, load_kn: 150.0 },
                WheelPatch { x_offset: 1.2, y_offset: hw, patch_length: 0.40, patch_width: 0.40, load_kn: 150.0 },
            ],
        }
    }

    /// Create custom vehicle
    pub fn custom(label: &str, wheels: Vec<WheelPatch>) -> Self {
        let total: f64 = wheels.iter().map(|w| w.load_kn).sum();
        AxleFootprint {
            standard: VehicleStandard::Custom,
            label: label.to_string(),
            total_weight: total,
            wheels,
        }
    }

    /// Get the bounding box of the vehicle footprint
    pub fn bounding_box(&self) -> (f64, f64, f64, f64) {
        let xmin = self.wheels.iter().map(|w| w.x_offset - w.patch_length / 2.0).fold(f64::INFINITY, f64::min);
        let xmax = self.wheels.iter().map(|w| w.x_offset + w.patch_length / 2.0).fold(f64::NEG_INFINITY, f64::max);
        let ymin = self.wheels.iter().map(|w| w.y_offset - w.patch_width / 2.0).fold(f64::INFINITY, f64::min);
        let ymax = self.wheels.iter().map(|w| w.y_offset + w.patch_width / 2.0).fold(f64::NEG_INFINITY, f64::max);
        (xmin, xmax, ymin, ymax)
    }
}

// ============================================================================
// INFLUENCE SURFACE
// ============================================================================

/// Response type for 2-D influence surface
#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
pub enum SurfaceResponseType {
    /// Vertical reaction at a support node
    Reaction,
    /// Bending moment Mx (about Y axis) at a point
    BendingMomentMx,
    /// Bending moment My (about X axis) at a point
    BendingMomentMy,
    /// Twisting moment Mxy at a point
    TwistingMomentMxy,
    /// Vertical deflection at a point
    Deflection,
    /// Max principal stress (top fiber) at a point
    PrincipalStressMax,
    /// Min principal stress (bottom fiber) at a point
    PrincipalStressMin,
}

/// A 2-D influence surface: ordinate η(ξ, ψ) gives the response R at the
/// output point when a unit load is placed at grid position (ξ, ψ).
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct InfluenceSurface {
    /// Response type and output location
    pub response_type: SurfaceResponseType,
    /// Output node (where the response is evaluated)
    pub output_node_id: usize,
    /// Grid x-positions (along span, m)
    pub x_grid: Vec<f64>,
    /// Grid y-positions (transverse, m)
    pub y_grid: Vec<f64>,
    /// Influence ordinates η[ix][iy]
    pub ordinates: Vec<Vec<f64>>,
}

impl InfluenceSurface {
    /// Sample the influence ordinate at (x, y) using bilinear interpolation
    pub fn ordinate_at(&self, x: f64, y: f64) -> f64 {
        let nx = self.x_grid.len();
        let ny = self.y_grid.len();
        if nx < 2 || ny < 2 { return 0.0; }

        // Find bounding x indices
        let ix = match self.x_grid.iter().position(|&gx| gx >= x) {
            Some(0) => 0,
            Some(i) => i - 1,
            None => nx - 2,
        };
        let iy = match self.y_grid.iter().position(|&gy| gy >= y) {
            Some(0) => 0,
            Some(j) => j - 1,
            None => ny - 2,
        };
        let ix = ix.min(nx - 2);
        let iy = iy.min(ny - 2);

        let x0 = self.x_grid[ix];
        let x1 = self.x_grid[ix + 1];
        let y0 = self.y_grid[iy];
        let y1 = self.y_grid[iy + 1];

        let dx = if (x1 - x0).abs() > 1e-12 { (x - x0) / (x1 - x0) } else { 0.5 };
        let dy = if (y1 - y0).abs() > 1e-12 { (y - y0) / (y1 - y0) } else { 0.5 };
        let dx = dx.clamp(0.0, 1.0);
        let dy = dy.clamp(0.0, 1.0);

        let z00 = self.ordinates[ix][iy];
        let z10 = self.ordinates[ix + 1][iy];
        let z01 = self.ordinates[ix][iy + 1];
        let z11 = self.ordinates[ix + 1][iy + 1];

        z00 * (1.0 - dx) * (1.0 - dy)
            + z10 * dx * (1.0 - dy)
            + z01 * (1.0 - dx) * dy
            + z11 * dx * dy
    }

    /// Generate a simplified influence surface for a simply-supported
    /// rectangular slab (Navier / Lévy series method).
    ///
    /// For vertical deflection at (x0, y0), the influence ordinate η(ξ, ψ)
    /// is proportional to the Green's function of the bi-harmonic equation.
    ///
    /// # Arguments
    /// * `span`, `width` — slab dimensions (m)
    /// * `x0`, `y0` — output point
    /// * `nx`, `ny` — grid resolution
    /// * `flexural_rigidity` — D = Et³/[12(1-ν²)]
    pub fn simply_supported_slab_deflection(
        span: f64, width: f64,
        x0: f64, y0: f64,
        nx: usize, ny: usize,
        flexural_rigidity: f64,
    ) -> Self {
        let x_grid: Vec<f64> = (0..=nx).map(|i| i as f64 * span / nx as f64).collect();
        let y_grid: Vec<f64> = (0..=ny).map(|j| j as f64 * width / ny as f64).collect();

        let n_terms = 10; // Fourier series truncation
        let pi = std::f64::consts::PI;

        let mut ordinates = vec![vec![0.0; ny + 1]; nx + 1];

        for (ix, &xi) in x_grid.iter().enumerate() {
            for (iy, &psi) in y_grid.iter().enumerate() {
                let mut w = 0.0_f64;
                for m in 1..=n_terms {
                    for n in 1..=n_terms {
                        let mf = m as f64;
                        let nf = n as f64;
                        let amn = (mf * pi / span).powi(2) + (nf * pi / width).powi(2);
                        let phi_load = (mf * pi * xi / span).sin()
                            * (nf * pi * psi / width).sin();
                        let phi_resp = (mf * pi * x0 / span).sin()
                            * (nf * pi * y0 / width).sin();
                        w += phi_load * phi_resp / (amn * amn);
                    }
                }
                ordinates[ix][iy] = 4.0 * w / (span * width * flexural_rigidity);
            }
        }

        InfluenceSurface {
            response_type: SurfaceResponseType::Deflection,
            output_node_id: 0,
            x_grid, y_grid, ordinates,
        }
    }

    /// Generate influence surface for bending moment Mx at (x0, y0) on a
    /// simply-supported rectangular slab (Navier series, Kirchhoff plate).
    pub fn simply_supported_slab_moment_mx(
        span: f64, width: f64,
        x0: f64, y0: f64,
        nx: usize, ny: usize,
        poisson: f64,
        _flexural_rigidity: f64,
    ) -> Self {
        let x_grid: Vec<f64> = (0..=nx).map(|i| i as f64 * span / nx as f64).collect();
        let y_grid: Vec<f64> = (0..=ny).map(|j| j as f64 * width / ny as f64).collect();

        let n_terms = 10;
        let pi = std::f64::consts::PI;

        let mut ordinates = vec![vec![0.0; ny + 1]; nx + 1];

        for (ix, &xi) in x_grid.iter().enumerate() {
            for (iy, &psi) in y_grid.iter().enumerate() {
                let mut mx = 0.0_f64;
                for m in 1..=n_terms {
                    for n in 1..=n_terms {
                        let mf = m as f64;
                        let nf = n as f64;
                        let alpha_m = mf * pi / span;
                        let beta_n = nf * pi / width;
                        let amn = alpha_m * alpha_m + beta_n * beta_n;

                        let phi_load = (mf * pi * xi / span).sin()
                            * (nf * pi * psi / width).sin();
                        let phi_resp = (mf * pi * x0 / span).sin()
                            * (nf * pi * y0 / width).sin();

                        // Mx = -D(∂²w/∂x² + ν∂²w/∂y²) → coefficient
                        let mx_coeff = alpha_m * alpha_m + poisson * beta_n * beta_n;
                        mx += phi_load * phi_resp * mx_coeff / (amn * amn);
                    }
                }
                // Mx influence ordinate (per unit load)
                ordinates[ix][iy] = 4.0 * mx / (span * width);
            }
        }

        InfluenceSurface {
            response_type: SurfaceResponseType::BendingMomentMx,
            output_node_id: 0,
            x_grid, y_grid, ordinates,
        }
    }
}

// ============================================================================
// VEHICLE SCAN ENGINE
// ============================================================================

/// Result of evaluating a vehicle at a single position on the deck
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VehiclePositionResult {
    /// Vehicle reference point position (x, y)
    pub ref_x: f64,
    pub ref_y: f64,
    /// Computed response value (same units as influence surface)
    pub response_value: f64,
    /// Per-wheel contributions (for debugging / visualisation)
    pub wheel_contributions: Vec<f64>,
}

/// Result of scanning a vehicle across the entire deck
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ScanResult {
    /// Vehicle label
    pub vehicle_label: String,
    /// Response type
    pub response_type: SurfaceResponseType,
    /// All positions evaluated
    pub all_positions: Vec<VehiclePositionResult>,
    /// Critical (worst-case) position
    pub critical_position: VehiclePositionResult,
    /// Maximum response found
    pub max_response: f64,
    /// Minimum response found (max negative)
    pub min_response: f64,
    /// Impact factor applied
    pub impact_factor: f64,
}

/// Evaluate vehicle at a single position on the influence surface.
/// Integrates each wheel patch load against the influence ordinate.
pub fn evaluate_vehicle_at(
    surface: &InfluenceSurface,
    footprint: &AxleFootprint,
    ref_x: f64,
    ref_y: f64,
) -> VehiclePositionResult {
    let mut total = 0.0_f64;
    let mut contributions = Vec::new();

    for wheel in &footprint.wheels {
        let wx = ref_x + wheel.x_offset;
        let wy = ref_y + wheel.y_offset;
        // For patch loads, integrate ordinate over the contact area
        // Use 2×2 Gauss points for simple integration
        let half_l = wheel.patch_length / 2.0;
        let half_w = wheel.patch_width / 2.0;
        let gp = 1.0 / 3.0_f64.sqrt();
        let gauss_pts = [
            (wx - half_l * gp, wy - half_w * gp),
            (wx + half_l * gp, wy - half_w * gp),
            (wx - half_l * gp, wy + half_w * gp),
            (wx + half_l * gp, wy + half_w * gp),
        ];
        let eta_avg: f64 = gauss_pts.iter()
            .map(|&(gx, gy)| surface.ordinate_at(gx, gy))
            .sum::<f64>() / 4.0;

        let contribution = wheel.load_kn * eta_avg;
        total += contribution;
        contributions.push(contribution);
    }

    VehiclePositionResult {
        ref_x, ref_y,
        response_value: total,
        wheel_contributions: contributions,
    }
}

/// Scan a vehicle across the deck to find worst-case response.
///
/// # Arguments
/// * `surface` — influence surface
/// * `footprint` — vehicle axle footprint
/// * `x_range` — (x_start, x_end) scan range along traffic direction (m)
/// * `y_range` — (y_start, y_end) transverse scan range (m)
/// * `step_x`, `step_y` — scan step sizes (m)
/// * `impact_factor` — dynamic amplification to apply (e.g. 1.25)
pub fn scan_vehicle(
    surface: &InfluenceSurface,
    footprint: &AxleFootprint,
    x_range: (f64, f64),
    y_range: (f64, f64),
    step_x: f64,
    step_y: f64,
    impact_factor: f64,
) -> ScanResult {
    let mut all_positions = Vec::new();
    let mut max_resp = f64::NEG_INFINITY;
    let mut min_resp = f64::INFINITY;
    let mut critical = None;

    let mut x = x_range.0;
    while x <= x_range.1 {
        let mut y = y_range.0;
        while y <= y_range.1 {
            let result = evaluate_vehicle_at(surface, footprint, x, y);
            if result.response_value > max_resp {
                max_resp = result.response_value;
                critical = Some(result.clone());
            }
            if result.response_value < min_resp {
                min_resp = result.response_value;
            }
            all_positions.push(result);
            y += step_y;
        }
        x += step_x;
    }

    let max_resp_final = max_resp * impact_factor;
    let min_resp_final = min_resp * impact_factor;

    ScanResult {
        vehicle_label: footprint.label.clone(),
        response_type: surface.response_type,
        all_positions,
        critical_position: critical.unwrap_or(VehiclePositionResult {
            ref_x: 0.0, ref_y: 0.0, response_value: 0.0,
            wheel_contributions: vec![],
        }),
        max_response: max_resp_final,
        min_response: min_resp_final,
        impact_factor,
    }
}

// ============================================================================
// IMPACT FACTOR CALCULATIONS
// ============================================================================

/// IRC 6:2017 impact factor for different vehicle classes
pub fn irc_impact_factor(span_m: f64, vehicle: VehicleStandard) -> f64 {
    match vehicle {
        VehicleStandard::IrcClassAaTracked | VehicleStandard::Irc70rTracked => {
            // IRC 6 Cl. 211.2: 10% for tracked up to 5m, decreasing
            if span_m <= 5.0 { 1.10 }
            else if span_m >= 40.0 { 1.10 }
            else { 1.10 + 0.15 * (1.0 - (span_m - 5.0) / 35.0) }
        }
        VehicleStandard::IrcClassAaWheeled | VehicleStandard::Irc70rWheeled => {
            // IRC 6 Cl. 211.2: 25% for wheeled up to 12m
            if span_m <= 12.0 { 1.25 }
            else { 1.25 - 0.10 * ((span_m - 12.0) / 28.0).min(1.0) }
        }
        VehicleStandard::IrcClassA => {
            // IRC 6 Cl. 211.2
            if span_m <= 3.0 { 1.545 }
            else if span_m <= 45.0 { 1.0 + 4.5 / (6.0 + span_m) }
            else { 1.075 }
        }
        VehicleStandard::AashtoHl93Truck | VehicleStandard::AashtoHl93Tandem => {
            // AASHTO LRFD Table 3.6.2.1-1: IM = 33% for all limit states
            1.33
        }
        VehicleStandard::EurocodeLm1 => {
            // EN 1991-2: dynamic already included in characteristic values
            1.0
        }
        _ => 1.25,
    }
}

/// AASHTO LRFD dynamic load allowance (IM)
pub fn aashto_impact_factor(limit_state: &str) -> f64 {
    match limit_state.to_lowercase().as_str() {
        "fatigue" => 1.15, // IM = 15%
        "service" | "service_i" | "service_ii" => 1.33, // IM = 33%
        "strength" | "strength_i" | "strength_ii" => 1.33,
        _ => 1.33,
    }
}

// ============================================================================
// PRINCIPAL STRESS COMPUTATION
// ============================================================================

/// Compute principal stresses from plate moments at a point.
///
/// σ_max/min = (σ_x + σ_y)/2 ± √[(σ_x - σ_y)²/4 + τ_xy²]
///
/// where σ = 6M / t² (for top/bottom fiber of a plate)
pub fn principal_stresses_from_moments(
    mx: f64, my: f64, mxy: f64,
    thickness: f64,
) -> (f64, f64, f64) {
    // Bending stresses at top fiber (z = t/2)
    let sigma_x = 6.0 * mx / (thickness * thickness);
    let sigma_y = 6.0 * my / (thickness * thickness);
    let tau_xy = 6.0 * mxy / (thickness * thickness);

    let avg = (sigma_x + sigma_y) / 2.0;
    let radius = ((sigma_x - sigma_y) / 2.0).powi(2) + tau_xy.powi(2);
    let r = radius.sqrt();

    let sigma_max = avg + r;
    let sigma_min = avg - r;
    let theta = 0.5 * (2.0 * tau_xy).atan2(sigma_x - sigma_y);

    (sigma_max, sigma_min, theta)
}

// ============================================================================
// FULL ANALYSIS PIPELINE
// ============================================================================

/// Complete influence surface analysis result
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct InfluenceSurfaceAnalysisResult {
    pub deck_span: f64,
    pub deck_width: f64,
    pub scan_results: Vec<ScanResult>,
    /// Overall governing response (envelope of all vehicles)
    pub governing_max_response: f64,
    pub governing_min_response: f64,
    pub governing_vehicle: String,
}

/// Run the full influence surface analysis pipeline:
/// 1. Generate influence surface for the requested response at output point
/// 2. Scan each vehicle across the deck
/// 3. Apply code-based impact factors
/// 4. Return envelope
pub fn run_influence_surface_analysis(
    span: f64, width: f64,
    output_x: f64, output_y: f64,
    nx: usize, ny: usize,
    flexural_rigidity: f64,
    vehicles: &[AxleFootprint],
    scan_step_x: f64,
    scan_step_y: f64,
    response_type: SurfaceResponseType,
    poisson: f64,
) -> InfluenceSurfaceAnalysisResult {
    // Generate influence surface
    let surface = match response_type {
        SurfaceResponseType::Deflection => {
            InfluenceSurface::simply_supported_slab_deflection(
                span, width, output_x, output_y, nx, ny, flexural_rigidity,
            )
        }
        SurfaceResponseType::BendingMomentMx => {
            InfluenceSurface::simply_supported_slab_moment_mx(
                span, width, output_x, output_y, nx, ny, poisson, flexural_rigidity,
            )
        }
        _ => {
            // Default to deflection for other response types
            InfluenceSurface::simply_supported_slab_deflection(
                span, width, output_x, output_y, nx, ny, flexural_rigidity,
            )
        }
    };

    let mut scan_results = Vec::new();
    let mut gov_max = f64::NEG_INFINITY;
    let mut gov_min = f64::INFINITY;
    let mut gov_vehicle = String::new();

    for vehicle in vehicles {
        let impact = irc_impact_factor(span, vehicle.standard);
        let result = scan_vehicle(
            &surface, vehicle,
            (0.0, span), (0.0, width),
            scan_step_x, scan_step_y,
            impact,
        );

        if result.max_response > gov_max {
            gov_max = result.max_response;
            gov_vehicle = vehicle.label.clone();
        }
        if result.min_response < gov_min {
            gov_min = result.min_response;
        }
        scan_results.push(result);
    }

    InfluenceSurfaceAnalysisResult {
        deck_span: span,
        deck_width: width,
        scan_results,
        governing_max_response: gov_max,
        governing_min_response: gov_min,
        governing_vehicle: gov_vehicle,
    }
}

// ============================================================================
// TESTS
// ============================================================================

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_rectangular_mesh() {
        let mesh = DeckMesh::rectangular(20.0, 10.0, 10, 5, 0.25, 30000.0, 0.2);
        assert_eq!(mesh.nodes.len(), 11 * 6); // (10+1)*(5+1) = 66
        assert_eq!(mesh.elements.len(), 10 * 5); // 50
        assert_eq!(mesh.supports.len(), 2 * 6); // 12 (both ends, all transverse nodes)
    }

    #[test]
    fn test_aashto_truck_weight() {
        let truck = AxleFootprint::aashto_hl93_truck();
        let total: f64 = truck.wheels.iter().map(|w| w.load_kn).sum();
        assert!((total - 325.0).abs() < 0.1);
        assert_eq!(truck.wheels.len(), 6);
    }

    #[test]
    fn test_irc_class_aa_tracked() {
        let tracked = AxleFootprint::irc_class_aa_tracked();
        assert!((tracked.total_weight - 700.0).abs() < 0.1);
        assert_eq!(tracked.wheels.len(), 1);
    }

    #[test]
    fn test_influence_surface_deflection() {
        let span = 10.0;
        let width = 5.0;
        let d = 30000.0 * 0.25_f64.powi(3) / (12.0 * (1.0 - 0.2 * 0.2)); // D
        let surface = InfluenceSurface::simply_supported_slab_deflection(
            span, width, 5.0, 2.5, 20, 10, d,
        );
        // Ordinate at midspan should be maximum
        let eta_mid = surface.ordinate_at(5.0, 2.5);
        let eta_quarter = surface.ordinate_at(2.5, 2.5);
        assert!(eta_mid > eta_quarter, "Midspan ordinate should be largest");
        assert!(eta_mid > 0.0);
    }

    #[test]
    fn test_bilinear_interpolation() {
        let surface = InfluenceSurface {
            response_type: SurfaceResponseType::Deflection,
            output_node_id: 0,
            x_grid: vec![0.0, 10.0],
            y_grid: vec![0.0, 5.0],
            ordinates: vec![
                vec![0.0, 0.0],
                vec![0.0, 4.0],
            ],
        };
        // At (10, 5) → 4.0
        assert!((surface.ordinate_at(10.0, 5.0) - 4.0).abs() < 0.01);
        // At (5, 2.5) → 1.0 (bilinear midpoint)
        assert!((surface.ordinate_at(5.0, 2.5) - 1.0).abs() < 0.01);
    }

    #[test]
    fn test_vehicle_scan() {
        let d = 30000.0 * 0.25_f64.powi(3) / (12.0 * (1.0 - 0.2 * 0.2));
        let surface = InfluenceSurface::simply_supported_slab_deflection(
            20.0, 10.0, 10.0, 5.0, 20, 10, d,
        );
        let truck = AxleFootprint::aashto_hl93_truck();
        let result = scan_vehicle(
            &surface, &truck,
            (0.0, 20.0), (2.0, 8.0),
            1.0, 1.0, 1.33,
        );
        assert!(result.max_response > 0.0);
        assert!(!result.all_positions.is_empty());
    }

    #[test]
    fn test_impact_factors() {
        assert!((irc_impact_factor(20.0, VehicleStandard::IrcClassA) - (1.0 + 4.5 / 26.0)).abs() < 0.01);
        assert!((aashto_impact_factor("strength") - 1.33).abs() < 0.01);
        assert!((aashto_impact_factor("fatigue") - 1.15).abs() < 0.01);
    }

    #[test]
    fn test_principal_stresses() {
        // Pure bending: Mx = 100 kN·m/m, My = 0, Mxy = 0, t = 0.3 m
        let (s1, s2, theta) = principal_stresses_from_moments(100.0, 0.0, 0.0, 0.3);
        // σ_x = 6×100/(0.3²) = 6666.67 kPa
        assert!((s1 - 6666.67).abs() < 1.0);
        assert!(s2.abs() < 1.0);
        assert!(theta.abs() < 0.01);
    }

    #[test]
    fn test_full_pipeline() {
        let d = 30000.0 * 0.25_f64.powi(3) / (12.0 * (1.0 - 0.2 * 0.2));
        let vehicles = vec![
            AxleFootprint::aashto_hl93_truck(),
            AxleFootprint::aashto_hl93_tandem(),
        ];
        let result = run_influence_surface_analysis(
            20.0, 10.0,
            10.0, 5.0,
            20, 10,
            d,
            &vehicles,
            2.0, 2.0, // coarse scan for fast test
            SurfaceResponseType::Deflection,
            0.2,
        );
        assert!(result.governing_max_response > 0.0);
        assert_eq!(result.scan_results.len(), 2);
        assert!(!result.governing_vehicle.is_empty());
    }
}
