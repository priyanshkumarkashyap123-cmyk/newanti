# Regression Harness (Scaffold)

Purpose: house deterministic inputs and golden outputs for code-aligned validation. Wire this to CI once domain adapters are ready.

## Directory layout
- `tests/regression/<domain>/<case>.json` — fixtures with input, expected, tolerances, and clause references.
- Domains to cover: structural, seismic, steel, concrete, geotech, offshore (expand as implemented).

## Fixture schema (proposed)
```jsonc
{
  "meta": {
    "domain": "structural",
    "name": "beam_point_load_midspan",
    "code": "closed_form",
    "clause": "Elastic beam theory",
    "units": "SI"
  },
  "input": { /* domain-specific */ },
  "expected": { /* key outputs */ },
  "tolerance": {
    "abs": { "deflection_mm": 0.01 },
    "rel": { "moment_kNm": 0.005 }
  }
}
```

## Current seed fixtures
- Structural: `structural/beam_point_load_midspan.json`
- Seismic: `seismic/base_shear_asce7_regular.json`
- Concrete: `concrete/rc_beam_flexure_is456.json`
- Steel: `steel/beam_ltb_aisc360.json`
- Geotech: `geotech/pile_axial_static.json`
- Offshore: `offshore/monopile_uls_dnv.json`

## Execution (to be wired)
- Frontend engines: add a `pnpm test:regression` script that reads fixtures and runs engine functions.
- Rust backend: add focused `cargo test regression` (or tagged) for Rust solvers.
- CI: PR smoke runs reduced set; nightly full suite.

## Contribution rules
- Every change to analysis/design logic should add/adjust a fixture with updated goldens and clause references.
- Keep units explicit and normalized to SI inside tests; convert only at boundaries.
