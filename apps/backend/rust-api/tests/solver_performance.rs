use std::collections::HashSet;
use std::time::Instant;

use beamlab_rust_api::solver::{AnalysisInput, Load, Member, Node, Solver, Support};

fn node_id(x: usize, y: usize, z: usize) -> String {
    format!("N{}_{}_{}", x, y, z)
}

#[test]
#[ignore]
fn large_sparse_frame_performance() {
    // Grid dimensions
    let bays_x = 15usize;
    let bays_y = 15usize;
    let stories = 10usize;
    let spacing = 5.0_f64;

    // Material / section properties (generic steel frame)
    let e = 200e9_f64;
    let a = 0.05_f64;
    let i = 8e-3_f64;
    let j = 1e-2_f64;

    // Generate nodes
    let mut nodes = Vec::new();
    for z in 0..=stories {
        for y in 0..=bays_y {
            for x in 0..=bays_x {
                nodes.push(Node {
                    id: node_id(x, y, z),
                    x: x as f64 * spacing,
                    y: y as f64 * spacing,
                    z: z as f64 * spacing,
                });
            }
        }
    }

    // Generate members along X, Y, and Z
    let mut members = Vec::new();
    let mut add_member = |id: String, start: String, end: String| {
        members.push(Member {
            id,
            start_node_id: start,
            end_node_id: end,
            e,
            a,
            i,
            j,
            iy: i,
            iz: i,
            g: 0.0,
            rho: 7850.0,
            beta_angle: 0.0,
            property_assignment_id: None,
            releases: None,
            start_offset: None,
            end_offset: None,
        });
    };

    for z in 0..=stories {
        for y in 0..=bays_y {
            for x in 0..bays_x {
                let start = node_id(x, y, z);
                let end = node_id(x + 1, y, z);
                add_member(format!("MX_{}_{}_{}", x, y, z), start, end);
            }
        }
    }

    for z in 0..=stories {
        for x in 0..=bays_x {
            for y in 0..bays_y {
                let start = node_id(x, y, z);
                let end = node_id(x, y + 1, z);
                add_member(format!("MY_{}_{}_{}", x, y, z), start, end);
            }
        }
    }

    for z in 0..stories {
        for y in 0..=bays_y {
            for x in 0..=bays_x {
                let start = node_id(x, y, z);
                let end = node_id(x, y, z + 1);
                add_member(format!("MZ_{}_{}_{}", x, y, z), start, end);
            }
        }
    }

    // Fix all DOFs at the base (z = 0)
    let mut supports = Vec::new();
    for y in 0..=bays_y {
        for x in 0..=bays_x {
            supports.push(Support {
                node_id: node_id(x, y, 0),
                fx: true,
                fy: true,
                fz: true,
                mx: true,
                my: true,
                mz: true,
                ..Default::default()
            });
        }
    }

    // Lateral loads on top story (z = stories)
    let mut loads = Vec::new();
    let p = 10_000.0_f64;
    for y in 0..=bays_y {
        for x in 0..=bays_x {
            loads.push(Load {
                node_id: node_id(x, y, stories),
                fx: p,
                fy: 0.0,
                fz: 0.0,
                mx: 0.0,
                my: 0.0,
                mz: 0.0,
            });
        }
    }

    let input = AnalysisInput {
        nodes,
        members,
        supports,
        loads,
        member_loads: Vec::new(),
        dof_per_node: 6,
        options: None,
    };

    let total_start = Instant::now();
    let solver = Solver::new();
    let result = solver.analyze(&input).expect("sparse solve failed");
    let total_ms = total_start.elapsed().as_secs_f64() * 1000.0;

    let assembly_ms = result.performance.assembly_time_ms;
    let solve_ms = result.performance.solve_time_ms;
    println!(
        "Performance: assembly={:.2} ms, solve={:.2} ms, total={:.2} ms",
        assembly_ms, solve_ms, total_ms
    );

    // Validate that top-story X displacement is finite and non-zero
    let mut top_nodes: HashSet<String> = HashSet::new();
    for y in 0..=bays_y {
        for x in 0..=bays_x {
            top_nodes.insert(node_id(x, y, stories));
        }
    }

    let mut max_dx = 0.0_f64;
    for d in &result.displacements {
        if top_nodes.contains(&d.node_id) {
            max_dx = max_dx.max(d.dx.abs());
        }
    }

    assert!(max_dx.is_finite() && max_dx > 0.0, "max_dx invalid: {}", max_dx);
}
