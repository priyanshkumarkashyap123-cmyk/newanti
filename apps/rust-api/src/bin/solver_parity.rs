//! CLI to run solver parity fixtures against the Rust solver directly.
//! Usage:
//!   cargo run --bin solver-parity -- --fixture ../../tests/solver-parity/fixtures/basic_frame.json
//!
//! This bypasses HTTP and exercises the Rust solver in-process.

use std::{fs, path::PathBuf};

use beamlab_rust_api::solver::{AnalysisInput, Solver};
use clap::Parser;
use serde_json::Value;

#[derive(Parser, Debug)]
#[command(
    name = "solver-parity",
    about = "Run solver parity fixtures against the Rust solver"
)]
struct Args {
    /// Path to a JSON fixture (AnalysisInput shape)
    #[arg(short, long, value_name = "FILE", required = true)]
    fixture: PathBuf,
}

fn main() -> anyhow::Result<()> {
    let args = Args::parse();
    let txt = fs::read_to_string(&args.fixture)?;
    let value: Value = serde_json::from_str(&txt)?;

    // The fixture can either be exactly AnalysisInput or have a top-level payload
    let payload = value
        .get("payload")
        .cloned()
        .unwrap_or_else(|| value.clone());

    let input: AnalysisInput = serde_json::from_value(payload)?;

    let solver = Solver::new();
    let start = std::time::Instant::now();
    let result = solver.analyze(&input).map_err(|e| anyhow::anyhow!(e))?;
    let elapsed = start.elapsed().as_secs_f64() * 1000.0;

    println!(
        "Fixture: {:?}\nNodes: {} Members: {}\nMax displacement: {:.6} m\nTotal time: {:.2} ms",
        args.fixture,
        input.nodes.len(),
        input.members.len(),
        result.max_displacement,
        elapsed
    );

    // Print a compact JSON of displacements for quick diffing
    let mut disp = serde_json::Map::new();
    for d in &result.displacements {
        let mut m = serde_json::Map::new();
        m.insert("dx".into(), d.dx.into());
        m.insert("dy".into(), d.dy.into());
        m.insert("dz".into(), d.dz.into());
        disp.insert(d.node_id.clone(), m.into());
    }
    let summary = serde_json::json!({
        "success": result.success,
        "max_displacement_m": result.max_displacement,
        "performance_ms": result.performance.total_time_ms,
        "displacements": disp,
    });
    println!("{}", serde_json::to_string_pretty(&summary)?);

    Ok(())
}
