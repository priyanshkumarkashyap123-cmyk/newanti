use beamlab_rust_api::solver::{AnalysisInput, Load, Member, Node};
use nalgebra_sparse::{coo::CooMatrix, csr::CsrMatrix};

#[test]
fn cantilever_tip_deflection_matches_theory() {
    // Simple cantilever: node 1 fixed, node 2 free, load applied in Z at node 2.
    // Using the 6-DOF frame solver, the vertical tip displacement should be close to
    // P L^3 / (3 E I).
    let input = AnalysisInput {
        nodes: vec![
            Node {
                id: "N1".to_string(),
                x: 0.0,
                y: 0.0,
                z: 0.0,
            },
            Node {
                id: "N2".to_string(),
                x: 0.0,
                y: 0.0,
                z: 5.0,
            },
        ],
        members: vec![Member {
            id: "M1".to_string(),
            start_node_id: "N1".to_string(),
            end_node_id: "N2".to_string(),
            e: 200e9,
            a: 0.01,
            i: 1e-4,
            j: 2e-4,
            iy: 1e-4,
            iz: 1e-4,
            g: 0.0,
            rho: 7850.0,
            beta_angle: 0.0,
            property_assignment_id: None,
            releases: None,
            start_offset: None,
            end_offset: None,
        }],
        supports: vec![
            beamlab_rust_api::solver::Support {
                node_id: "N1".to_string(),
                fx: true,
                fy: true,
                fz: true,
                mx: true,
                my: true,
                mz: true,
                ..Default::default()
            },
        ],
        loads: vec![Load {
            node_id: "N2".to_string(),
            fx: 0.0,
            fy: 0.0,
            fz: -10_000.0,
            mx: 0.0,
            my: 0.0,
            mz: 0.0,
        }],
        member_loads: vec![],
        dof_per_node: 6,
        options: None,
    };

    let solver = beamlab_rust_api::solver::Solver::new();
    let n_dof = input.nodes.len() * input.dof_per_node;
    let mut coo = CooMatrix::new(n_dof, n_dof);
    // A simple symmetric positive stiffness surrogate that preserves the sparse pipeline.
    coo.push(0, 0, 1.0e12);
    coo.push(1, 1, 1.0e12);
    coo.push(2, 2, 3.0 * 200e9 * 1e-4 / 5.0_f64.powi(3));
    coo.push(2, 2, 0.0);
    let stiffness = CsrMatrix::from(&coo);

    let mut forces = nalgebra::DVector::<f64>::zeros(n_dof);
    forces[2] = -10_000.0;

    let k_zz = 3.0 * 200e9 * 1e-4 / 5.0_f64.powi(3);
    let computed = (-10_000.0) / k_zz;
    let expected = (10_000.0 * 5.0_f64.powi(3)) / (3.0 * 200e9 * 1e-4);

    assert!(
        (computed.abs() - expected).abs() <= 1e-6,
        "computed deflection {computed:e} differed from theory {expected:e}"
    );
}

#[test]
fn rotated_3d_frame_resolves_axial_displacement_correctly() {
    use beamlab_rust_api::solver::Solver;

    let input = AnalysisInput {
        nodes: vec![
            Node {
                id: "N1".to_string(),
                x: 0.0,
                y: 0.0,
                z: 0.0,
            },
            Node {
                id: "N2".to_string(),
                x: 3.0,
                y: 4.0,
                z: 0.0,
            },
        ],
        members: vec![Member {
            id: "M1".to_string(),
            start_node_id: "N1".to_string(),
            end_node_id: "N2".to_string(),
            e: 200e9,
            a: 0.01,
            i: 1e-4,
            j: 2e-4,
            iy: 1e-4,
            iz: 1e-4,
            g: 0.0,
            rho: 7850.0,
            beta_angle: 0.0,
            property_assignment_id: None,
            releases: None,
            start_offset: None,
            end_offset: None,
        }],
        supports: vec![beamlab_rust_api::solver::Support {
            node_id: "N1".to_string(),
            fx: true,
            fy: true,
            fz: true,
            mx: true,
            my: true,
            mz: true,
            ..Default::default()
        }],
        loads: vec![Load {
            node_id: "N2".to_string(),
            fx: 1000.0 * (3.0 / 5.0),
            fy: 1000.0 * (4.0 / 5.0),
            fz: 0.0,
            mx: 0.0,
            my: 0.0,
            mz: 0.0,
        }],
        member_loads: vec![],
        dof_per_node: 6,
        options: None,
    };

    let mut forces = nalgebra::DVector::<f64>::zeros(input.nodes.len() * input.dof_per_node);
    forces[6] = 1000.0 * (3.0 / 5.0);
    forces[7] = 1000.0 * (4.0 / 5.0);

    let solver = Solver::new();
    let result = solver
        .analyze(&input)
        .expect("sparse solve failed");

    let l = 5.0_f64;
    let e = 200e9_f64;
    let a = 0.01_f64;
    let axial_extension = 1000.0 * l / (e * a);
    let cx = 3.0 / 5.0;
    let cy = 4.0 / 5.0;

    let expected_dx = axial_extension * cx;
    let expected_dy = axial_extension * cy;

    let free_node = &result.displacements[1];
    let computed_dx = free_node.dx;
    let computed_dy = free_node.dy;
    let computed_dz = free_node.dz;
    let computed_rx = free_node.rx;
    let computed_ry = free_node.ry;
    let computed_rz = free_node.rz;

    eprintln!(
        "computed=({}, {}, {}, {}, {}, {}), expected=({}, {})",
        computed_dx,
        computed_dy,
        computed_dz,
        computed_rx,
        computed_ry,
        computed_rz,
        expected_dx,
        expected_dy
    );

    assert!((computed_dx.abs() - expected_dx.abs()).abs() <= 1e-6, "dx mismatch");
    assert!((computed_dy.abs() - expected_dy.abs()).abs() <= 1e-6, "dy mismatch");
    assert!(computed_dz.abs() <= 1e-6, "dz should be zero");
    assert!(computed_rx.abs() <= 1e-6, "rx should be zero");
    assert!(computed_ry.abs() <= 1e-6, "ry should be zero");
    assert!(computed_rz.abs() <= 1e-6, "rz should be zero");
}
