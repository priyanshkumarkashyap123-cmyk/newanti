import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
PACKAGE_SRC = ROOT / "packages" / "design-codes" / "src" / "data" / "designCodes.json"
PY_OUT = ROOT / "apps" / "backend-python" / "design" / "design_codes_shared.py"
RUST_OUT = ROOT / "apps" / "rust-api" / "src" / "design_codes" / "shared.rs"

def load_json(path: Path) -> dict:
    return json.loads(path.read_text(encoding="utf-8"))


def write_python(data: dict):
    PY_OUT.parent.mkdir(parents=True, exist_ok=True)
    PY_OUT.write_text(
        (
            '"""Shared design code constants (generated). Do not edit manually."""\n'
            "DESIGN_CODES = {data}\n"
        ).replace("{data}", json.dumps(data, indent=2)),
        encoding="utf-8",
    )


def write_rust(data: dict):
    RUST_OUT.parent.mkdir(parents=True, exist_ok=True)
    RUST_OUT.write_text(
        """//! Shared design code constants (generated). Do not edit manually.\nuse once_cell::sync::Lazy;\nuse serde::Deserialize;\n\n#[derive(Debug, Deserialize)]\npub struct DesignCodeRecord {\n    pub meta: Meta,\n    pub partialSafety: Option<PartialSafety>,\n    pub windSeismic: Option<WindSeismic>,\n}\n\n#[derive(Debug, Deserialize)]\npub struct Meta {\n    pub id: String,\n    pub name: String,\n    pub edition: String,\n    pub units: String,\n    pub source: String,\n    pub clauses: Option<std::collections::HashMap<String, String>>,\n}\n\n#[derive(Debug, Deserialize)]\npub struct PartialSafety {\n    pub concrete: Option<f64>,\n    pub steel: Option<f64>,\n    pub gamma_m0: Option<f64>,\n    pub gamma_m1: Option<f64>,\n    pub gamma_mb: Option<f64>,\n    pub phi_flexure: Option<f64>,\n    pub phi_shear: Option<f64>,\n    pub phi_axial: Option<f64>,\n}\n\n#[derive(Debug, Deserialize)]\npub struct WindSeismic {\n    pub zone_factors: Option<std::collections::HashMap<String, f64>>,\n    pub importance_factors: Option<std::collections::HashMap<String, f64>>,\n}\n\npub static DESIGN_CODES: Lazy<std::collections::HashMap<String, DesignCodeRecord>> = Lazy::new(|| {\n    let raw = include_str!("./designCodes.json");\n    serde_json::from_str(raw).expect("Failed to parse designCodes.json")\n});\n"""
        + "\n",
        encoding="utf-8",
    )
    # Also emit the JSON for include_str!
    json_path = RUST_OUT.parent / "designCodes.json"
    json_path.write_text(json.dumps(data, indent=2), encoding="utf-8")


def main():
    data = load_json(PACKAGE_SRC)
    write_python(data)
    write_rust(data)
    print("Synced design codes to Python and Rust.")


if __name__ == "__main__":
    main()
