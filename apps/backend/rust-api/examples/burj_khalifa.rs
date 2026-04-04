// Burj Khalifa 828m Tall Building - P-Delta Analysis Case Study
//
// Building Specifications:
// - Height: 828m (163 floors)
// - Structural System: Bundled tube with reinforced concrete core
// - Footprint: 27m × 73m Y-shaped plan
// - Floor height: 5.08m typical
// - Material: High-strength concrete (80 MPa core, 60 MPa perimeter)
// - Design loads: Dead + Live + Wind (Dubai conditions)
//
// Analysis Type: Second-order P-Delta
// Wind conditions: 50 m/s (Dubai basic wind speed)

use beamlab_rust_api::solver::pdelta::{MemberGeometry, PDeltaConfig, PDeltaResult, PDeltaSolver};
use nalgebra::{DMatrix, DVector};
use serde::{Deserialize, Serialize};
use std::fs::File;
use std::io::Write;
use std::time::Instant;

/// Burj Khalifa structural configuration
#[derive(Debug, Clone)]
struct BurjKhalifaModel {
    num_floors: usize,
    floor_height: f64,
    total_height: f64,
    footprint_width: f64,
    footprint_depth: f64,
    core_columns: Vec<ColumnSection>,
    perimeter_columns: Vec<ColumnSection>,
    nodes: Vec<Node3D>,
    members: Vec<Member>,
}

#[derive(Debug, Clone, Copy)]
struct Node3D {
    id: usize,
    x: f64,
    y: f64,
    z: f64,           // height
    dof_index: usize, // Starting DOF (ux, uy, uz, rx, ry, rz)
}

#[derive(Debug, Clone)]
struct Member {
    id: usize,
    node_i: usize,
    node_j: usize,
    section: ColumnSection,
    length: f64,
}

#[derive(Debug, Clone, Copy)]
struct ColumnSection {
    name: &'static str,
    area: f64,                // m²
    elastic_modulus: f64,     // Pa
    moment_of_inertia_y: f64, // m⁴ (about Y axis)
    moment_of_inertia_z: f64, // m⁴ (about Z axis)
    height_range: (f64, f64), // (min_height, max_height) in meters
}

/// Load combination struct
#[derive(Debug, Clone)]
struct LoadCombination {
    dead_load: Vec<f64>,
    live_load: Vec<f64>,
    wind_load_x: Vec<f64>,
    wind_load_y: Vec<f64>,
    combined_load: Vec<f64>,
}

/// Analysis results for export
#[derive(Debug, Serialize, Deserialize)]
struct BurjAnalysisResults {
    building_height: f64,
    num_floors: usize,
    first_order_max_displacement: f64,
    second_order_max_displacement: f64,
    amplification_factor: f64,
    stability_index: f64,
    converged: bool,
    iterations: usize,
    displacement_profile: Vec<DisplacementPoint>,
    axial_forces: Vec<f64>,
    analysis_time_ms: f64,
    comparison_to_published: ComparisonData,
}

#[derive(Debug, Serialize, Deserialize)]
struct DisplacementPoint {
    height: f64,
    displacement_x: f64,
    displacement_y: f64,
    story_drift_ratio: f64,
}

#[derive(Debug, Serialize, Deserialize)]
struct ComparisonData {
    published_max_displacement: f64,
    computed_max_displacement: f64,
    difference_percent: f64,
    published_period: f64,
    estimated_period: f64,
}

impl BurjKhalifaModel {
    /// Create Burj Khalifa structural model
    fn new() -> Self {
        let num_floors = 163;
        let floor_height = 5.08; // meters
        let total_height = 828.0; // actual height
        let footprint_width = 27.0;
        let footprint_depth = 73.0;

        // Define column sections based on height zones
        // Burj Khalifa has varying sections:
        // - Levels 1-40: Massive core columns (3.5m × 3.5m)
        // - Levels 41-108: Tapered columns (2.0m × 2.0m)
        // - Levels 109-156: Smaller columns (1.0m × 1.0m)
        // - Levels 157-163: Top spire (0.5m × 0.5m)

        let core_sections = vec![
            // Zone 1: Levels 1-40 (0-200m) - Massive base
            ColumnSection {
                name: "Core-Zone1",
                area: 12.25,               // 3.5m × 3.5m
                elastic_modulus: 40e9,     // 80 MPa concrete → E ≈ 40 GPa
                moment_of_inertia_y: 12.6, // I = bh³/12 ≈ 12.6 m⁴
                moment_of_inertia_z: 12.6,
                height_range: (0.0, 200.0),
            },
            // Zone 2: Levels 41-108 (200-550m) - Mid-rise
            ColumnSection {
                name: "Core-Zone2",
                area: 4.0, // 2.0m × 2.0m
                elastic_modulus: 40e9,
                moment_of_inertia_y: 1.33, // I ≈ 1.33 m⁴
                moment_of_inertia_z: 1.33,
                height_range: (200.0, 550.0),
            },
            // Zone 3: Levels 109-156 (550-792m) - Upper floors
            ColumnSection {
                name: "Core-Zone3",
                area: 1.0, // 1.0m × 1.0m
                elastic_modulus: 40e9,
                moment_of_inertia_y: 0.0833, // I ≈ 0.0833 m⁴
                moment_of_inertia_z: 0.0833,
                height_range: (550.0, 792.0),
            },
            // Zone 4: Levels 157-163 (792-828m) - Spire
            ColumnSection {
                name: "Core-Zone4",
                area: 0.25, // 0.5m × 0.5m
                elastic_modulus: 40e9,
                moment_of_inertia_y: 0.0026, // I ≈ 0.0026 m⁴
                moment_of_inertia_z: 0.0026,
                height_range: (792.0, 828.0),
            },
        ];

        // Perimeter columns (bundled tube)
        let perimeter_sections = vec![
            ColumnSection {
                name: "Perimeter-Zone1",
                area: 1.0,
                elastic_modulus: 35e9, // 60 MPa concrete
                moment_of_inertia_y: 0.0833,
                moment_of_inertia_z: 0.0833,
                height_range: (0.0, 200.0),
            },
            ColumnSection {
                name: "Perimeter-Zone2",
                area: 0.36,
                elastic_modulus: 35e9,
                moment_of_inertia_y: 0.0108,
                moment_of_inertia_z: 0.0108,
                height_range: (200.0, 550.0),
            },
            ColumnSection {
                name: "Perimeter-Zone3",
                area: 0.16,
                elastic_modulus: 35e9,
                moment_of_inertia_y: 0.0021,
                moment_of_inertia_z: 0.0021,
                height_range: (550.0, 792.0),
            },
        ];

        // Generate nodes
        let mut nodes = Vec::new();

        // Create nodes at each floor level (164 levels: ground + 163 floors)
        // Simplified model: 1 core node + 3 perimeter nodes (Y-shape approximation)
        for floor in 0..=num_floors {
            let z = floor as f64 * floor_height;
            let base_dof = floor * 4 * 6; // 4 nodes × 6 DOF each

            // Core node (center)
            nodes.push(Node3D {
                id: floor * 4,
                x: 0.0,
                y: 0.0,
                z,
                dof_index: base_dof,
            });

            // Perimeter nodes (Y-shape approximation as triangle)
            // Node 1: front (along +Y axis)
            nodes.push(Node3D {
                id: floor * 4 + 1,
                x: 0.0,
                y: footprint_depth / 2.0,
                z,
                dof_index: base_dof + 6,
            });

            // Node 2: back-left
            nodes.push(Node3D {
                id: floor * 4 + 2,
                x: -footprint_width / 2.0,
                y: -footprint_depth / 4.0,
                z,
                dof_index: base_dof + 12,
            });

            // Node 3: back-right
            nodes.push(Node3D {
                id: floor * 4 + 3,
                x: footprint_width / 2.0,
                y: -footprint_depth / 4.0,
                z,
                dof_index: base_dof + 18,
            });
        }

        // Generate members (vertical columns)
        let mut members = Vec::new();
        let mut member_id = 0;

        for floor in 0..num_floors {
            let z_bottom = floor as f64 * floor_height;
            let z_top = (floor + 1) as f64 * floor_height;
            let z_mid = (z_bottom + z_top) / 2.0;

            // Select section based on height
            let core_section = core_sections
                .iter()
                .find(|s| z_mid >= s.height_range.0 && z_mid < s.height_range.1)
                .unwrap_or(&core_sections[0]);

            let perimeter_section = perimeter_sections
                .iter()
                .find(|s| z_mid >= s.height_range.0 && z_mid < s.height_range.1)
                .unwrap_or(&perimeter_sections[0]);

            // Core column
            members.push(Member {
                id: member_id,
                node_i: floor * 4,
                node_j: (floor + 1) * 4,
                section: *core_section,
                length: floor_height,
            });
            member_id += 1;

            // Perimeter columns (3)
            for i in 1..=3 {
                members.push(Member {
                    id: member_id,
                    node_i: floor * 4 + i,
                    node_j: (floor + 1) * 4 + i,
                    section: *perimeter_section,
                    length: floor_height,
                });
                member_id += 1;
            }
        }

        BurjKhalifaModel {
            num_floors,
            floor_height,
            total_height,
            footprint_width,
            footprint_depth,
            core_columns: core_sections,
            perimeter_columns: perimeter_sections,
            nodes,
            members,
        }
    }

    /// Calculate gravity loads (dead + live)
    fn calculate_gravity_loads(&self) -> Vec<f64> {
        let num_dof = (self.num_floors + 1) * 4 * 6;
        let mut loads = vec![0.0; num_dof];

        // Floor loads
        let floor_area = 3400.0; // m² per floor (approximate)
        let dead_load_intensity = 5.0e3; // 5 kPa (N/m²)
        let live_load_intensity = 2.0e3; // 2 kPa
        let total_floor_load = (dead_load_intensity + live_load_intensity) * floor_area;

        // Apply vertical loads at each floor node
        for floor in 1..=self.num_floors {
            for node_offset in 0..4 {
                let node_id = floor * 4 + node_offset;
                let dof_index = node_id * 6 + 2; // Z-direction (vertical)
                if dof_index < num_dof {
                    loads[dof_index] = -total_floor_load / 4.0; // Distribute among 4 nodes
                }
            }
        }

        loads
    }

    /// Calculate wind loads (Dubai conditions)
    fn calculate_wind_loads(&self) -> (Vec<f64>, Vec<f64>) {
        let num_dof = (self.num_floors + 1) * 4 * 6;
        let mut wind_x = vec![0.0; num_dof];
        let mut wind_y = vec![0.0; num_dof];

        // Dubai wind: 50 m/s basic wind speed
        let v_basic = 50.0; // m/s
        let rho_air = 1.225; // kg/m³

        for floor in 1..=self.num_floors {
            let z = floor as f64 * self.floor_height;

            // Wind speed variation with height (power law)
            let alpha = 0.15; // exposure coefficient
            let z_ref = 10.0; // reference height
            let v_z = v_basic * (z / z_ref).powf(alpha);

            // Wind pressure: q = 0.5 * ρ * V²
            let q_z = 0.5 * rho_air * v_z * v_z;

            // Drag coefficient for tall building
            let c_d = 1.3;

            // Exposed area per floor
            let width = self.footprint_width;
            let depth = self.footprint_depth;
            let height = self.floor_height;

            // Force in X direction (wind perpendicular to width)
            let f_x = c_d * q_z * depth * height;

            // Force in Y direction (wind perpendicular to depth)
            let f_y = c_d * q_z * width * height;

            // Apply to nodes
            for node_offset in 0..4 {
                let node_id = floor * 4 + node_offset;
                let dof_x = node_id * 6 + 0; // X-direction
                let dof_y = node_id * 6 + 1; // Y-direction

                if dof_x < num_dof {
                    wind_x[dof_x] = f_x / 4.0;
                }
                if dof_y < num_dof {
                    wind_y[dof_y] = f_y / 4.0;
                }
            }
        }

        (wind_x, wind_y)
    }

    /// Assemble elastic stiffness matrix (simplified)
    fn assemble_stiffness_matrix(&self) -> DMatrix<f64> {
        let num_dof = (self.num_floors + 1) * 4 * 6;
        let mut k = DMatrix::zeros(num_dof, num_dof);

        // Simplified stiffness assembly
        // For each member, add 12×12 element stiffness
        for member in &self.members {
            let node_i = &self.nodes[member.node_i];
            let node_j = &self.nodes[member.node_j];

            let l = member.length;
            let e = member.section.elastic_modulus;
            let a = member.section.area;
            let i_y = member.section.moment_of_inertia_y;

            // Axial stiffness
            let k_axial = e * a / l;

            // Bending stiffness (simplified)
            let k_bend = 12.0 * e * i_y / l.powi(3);

            // Add to global matrix (only vertical stiffness for simplicity)
            let dof_i_z = node_i.dof_index + 2;
            let dof_j_z = node_j.dof_index + 2;

            if dof_i_z < num_dof && dof_j_z < num_dof {
                k[(dof_i_z, dof_i_z)] += k_axial + k_bend;
                k[(dof_j_z, dof_j_z)] += k_axial + k_bend;
                k[(dof_i_z, dof_j_z)] -= k_axial;
                k[(dof_j_z, dof_i_z)] -= k_axial;
            }

            // Lateral stiffness
            let dof_i_x = node_i.dof_index + 0;
            let dof_j_x = node_j.dof_index + 0;

            if dof_i_x < num_dof && dof_j_x < num_dof {
                k[(dof_i_x, dof_i_x)] += k_bend;
                k[(dof_j_x, dof_j_x)] += k_bend;
                k[(dof_i_x, dof_j_x)] -= k_bend / 2.0;
                k[(dof_j_x, dof_i_x)] -= k_bend / 2.0;
            }
        }

        // Apply boundary conditions: fix base nodes (floor 0)
        // Fix all DOFs for ground level nodes
        for node_offset in 0..4 {
            let base_dof = node_offset * 6;
            for dof in 0..6 {
                let global_dof = base_dof + dof;
                if global_dof < num_dof {
                    // Apply very large stiffness (penalty method)
                    k[(global_dof, global_dof)] += 1e20;
                }
            }
        }

        k
    }

    /// Convert members to MemberGeometry for P-Delta analysis
    fn to_member_geometry(&self) -> Vec<MemberGeometry> {
        self.members
            .iter()
            .map(|member| {
                let node_i = &self.nodes[member.node_i];
                let node_j = &self.nodes[member.node_j];

                MemberGeometry {
                    node_i: [node_i.x, node_i.y, node_i.z],
                    node_j: [node_j.x, node_j.y, node_j.z],
                    node_i_dof: node_i.dof_index,
                    node_j_dof: node_j.dof_index,
                    area: member.section.area,
                    elastic_modulus: member.section.elastic_modulus,
                    moment_of_inertia: member.section.moment_of_inertia_y,
                }
            })
            .collect()
    }
}

/// Run Burj Khalifa P-Delta analysis
fn main() {
    println!("╔══════════════════════════════════════════════════════════════╗");
    println!("║   BURJ KHALIFA 828m - P-DELTA ANALYSIS CASE STUDY          ║");
    println!("║   Second-Order Geometric Nonlinearity Analysis              ║");
    println!("╚══════════════════════════════════════════════════════════════╝\n");

    let start_time = Instant::now();

    // Create structural model
    println!("Creating Burj Khalifa structural model...");
    let model = BurjKhalifaModel::new();

    println!("  Building height: {} m", model.total_height);
    println!("  Number of floors: {}", model.num_floors);
    println!("  Nodes: {}", model.nodes.len());
    println!("  Members: {}", model.members.len());
    println!(
        "  Footprint: {} m × {} m\n",
        model.footprint_width, model.footprint_depth
    );

    // Calculate loads
    println!("Calculating loads...");
    let gravity_loads = model.calculate_gravity_loads();
    let (wind_x, wind_y) = model.calculate_wind_loads();

    // Load combination: 1.2D + 1.0W
    let num_dof = gravity_loads.len();
    let mut combined_loads = vec![0.0; num_dof];
    for i in 0..num_dof {
        combined_loads[i] = 1.2 * gravity_loads[i] + 1.0 * wind_x[i];
    }

    let total_gravity = gravity_loads.iter().map(|f| f.abs()).sum::<f64>() / 1e6;
    let total_wind = wind_x.iter().map(|f| f.abs()).sum::<f64>() / 1e3;
    println!("  Total gravity load: {:.1} MN", total_gravity);
    println!("  Total wind load (X): {:.1} kN\n", total_wind);

    // Assemble stiffness matrix
    println!("Assembling stiffness matrix...");
    let k_elastic = model.assemble_stiffness_matrix();
    println!("  DOFs: {}\n", k_elastic.nrows());

    // Configure P-Delta solver
    println!("Configuring P-Delta solver...");
    let config = PDeltaConfig {
        max_iterations: 100,
        displacement_tolerance: 1e-6,
        force_tolerance: 1e-3,
        energy_tolerance: 1e-6,
        include_small_delta: true,
        include_large_delta: true,
        ..Default::default()
    };

    let solver = PDeltaSolver::new(config);

    // Convert to member geometry
    let member_geometry = model.to_member_geometry();

    // Perform P-Delta analysis
    println!("Running P-Delta analysis...\n");
    let forces = DVector::from_vec(combined_loads.clone());

    let result = match solver.analyze(&k_elastic, &forces, &member_geometry) {
        Ok(res) => res,
        Err(e) => {
            eprintln!("❌ Analysis failed: {}", e);
            return;
        }
    };

    let analysis_time = start_time.elapsed().as_millis() as f64;

    // Extract results
    println!("╔══════════════════════════════════════════════════════════════╗");
    println!("║                     ANALYSIS RESULTS                         ║");
    println!("╚══════════════════════════════════════════════════════════════╝\n");

    println!("Convergence:");
    println!(
        "  Status: {}",
        if result.converged {
            "✅ CONVERGED"
        } else {
            "❌ NOT CONVERGED"
        }
    );
    println!("  Iterations: {}", result.iterations);
    println!("  Analysis time: {:.2} ms\n", analysis_time);

    println!("Displacements:");
    println!("  Maximum displacement: {:.3} m", result.max_displacement);
    println!("  Amplification factor: {:.3}", result.amplification_factor);
    println!("  Stability index: {:.4}\n", result.stability_index);

    // Compare to published data
    // Published: Burj Khalifa sways approximately 1.5m at top under design wind
    let published_displacement = 1.5; // meters
    let difference =
        ((result.max_displacement - published_displacement) / published_displacement * 100.0).abs();

    println!("Validation:");
    println!(
        "  Published max displacement: {:.3} m",
        published_displacement
    );
    println!(
        "  Computed max displacement: {:.3} m",
        result.max_displacement
    );
    println!("  Difference: {:.1}%", difference);

    if difference < 20.0 {
        println!("  Status: ✅ VALIDATED (within 20%)\n");
    } else {
        println!("  Status: ⚠️  REVIEW NEEDED (difference > 20%)\n");
    }

    // Design checks
    println!("Design Checks:");
    if result.stability_index < 0.1 {
        println!("  ✅ Stability index < 0.1: PASS");
    } else if result.stability_index < 0.2 {
        println!("  ⚠️  Stability index 0.1-0.2: MARGINAL");
    } else {
        println!("  ❌ Stability index > 0.2: FAIL");
    }

    if result.amplification_factor < 1.4 {
        println!("  ✅ Amplification factor < 1.4: PASS");
    } else {
        println!("  ⚠️  Amplification factor ≥ 1.4: HIGH P-DELTA");
    }

    // Export results to JSON
    println!("\nExporting results...");

    let export_results = BurjAnalysisResults {
        building_height: model.total_height,
        num_floors: model.num_floors,
        first_order_max_displacement: result.max_displacement / result.amplification_factor,
        second_order_max_displacement: result.max_displacement,
        amplification_factor: result.amplification_factor,
        stability_index: result.stability_index,
        converged: result.converged,
        iterations: result.iterations,
        displacement_profile: vec![], // Simplified for now
        axial_forces: result.axial_forces.clone(),
        analysis_time_ms: analysis_time,
        comparison_to_published: ComparisonData {
            published_max_displacement: published_displacement,
            computed_max_displacement: result.max_displacement,
            difference_percent: difference,
            published_period: 11.0, // seconds (approximate)
            estimated_period: 0.0,  // Not computed in this example
        },
    };

    let json_output = serde_json::to_string_pretty(&export_results).unwrap();
    let mut file = File::create("burj_khalifa_results.json").unwrap();
    file.write_all(json_output.as_bytes()).unwrap();

    println!("  Results exported to: burj_khalifa_results.json");

    println!("\n╔══════════════════════════════════════════════════════════════╗");
    println!("║            BURJ KHALIFA ANALYSIS COMPLETE ✅                ║");
    println!("╚══════════════════════════════════════════════════════════════╝");
}
