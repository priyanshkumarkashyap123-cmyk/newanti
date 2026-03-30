# BeamLab — Copilot Workspace Instructions

## Project Context

BeamLab is a professional structural engineering platform. All code changes involving structural calculations must be technically correct — errors propagate into real-world building designs.

## Model Routing Guidance

- Use `o4-mini` for the Rust backend, solver logic, design-code math, and any backend task where numerical correctness, matrix assembly, or structural reasoning is critical.
- Use `gpt-5.4-mini` for Python and Node backend work that is mostly implementation, wiring, refactoring, validation, API shaping, logging, scripts, and instruction-following with lighter reasoning.
- Keep `o4-mini` as the default for code touching structural calculations, stiffness/fixed-end-force workflows, load combinations, or safety-factor logic.
- Prefer `gpt-5.4-mini` when the backend task is about backend service glue, response shapes, route handlers, automation scripts, or maintaining repo conventions without changing engineering math.
- If a backend task spans both categories, use `o4-mini` for the engineering core and `gpt-5.4-mini` for surrounding code cleanup, docs, and consistency.

## Unit System

- **SI units throughout:** Forces in kN, moments in kN·m, stresses in N/mm² (MPa), lengths in mm (steel sections) or m (spans/heights), areas in mm².
- Never mix imperial and SI. If a user provides imperial values, convert to SI before any calculation.
- Always label units in variable names, comments, or output: `vu_kn`, `moment_knm`, `stress_mpa`.

## Sign Conventions

| Convention | Positive | Negative |
|------------|----------|----------|
| Axial force | Tension (+) | Compression (−) |
| Moment (concrete) | Sagging (+), tension at bottom | Hogging (−), tension at top |
| Moment (steel) | Sagging (+), compression at bottom flange | Hogging (−), compression at top flange |
| Shear | Per right-hand rule (beam convention) | Opposite |
| Displacement | Along positive axis direction | Against |

**Rule:** Use absolute values for capacity checks. Preserve signs only when needed for:
- Reinforcement placement (top vs. bottom steel)
- Moment gradient factor Cb (IS 800 / AISC)
- P-M interaction diagram (sign of P matters)

## Design Code References

When writing or modifying design code calculations:
- Always cite the specific clause number (e.g., "IS 456 Cl. 40.1", "AISC 360 Eq. E3-1")
- Include table references where data is interpolated (e.g., "IS 456 Table 19")
- Use partial safety factors exactly as specified — never round or approximate them
- Key files: `apps/rust-api/src/design_codes/` (Rust), `apps/backend-python/analysis/solvers/` (Python)

## Partial Safety Factors (Do Not Modify)

| Code | Factor | Value | Use |
|------|--------|-------|-----|
| IS 456 | γc | 1.50 | Concrete strength |
| IS 456 | γs | 1.15 | Steel reinforcement |
| IS 800 | γm0 | 1.10 | Yielding / instability |
| IS 800 | γm1 | 1.25 | Ultimate stress / fracture |
| IS 800 | γmb | 1.25 | Bolted connections |
| ACI 318 | φ (flexure) | 0.90 | Strength reduction |
| ACI 318 | φ (shear) | 0.75 | Strength reduction |
| EC2 | γc | 1.50 | Concrete |
| EC2 | γs | 1.15 | Reinforcing steel |
| EC3 | γM0 | 1.00 | Cross-section resistance |

## Solver Code Guidelines

- **Stiffness matrix:** Always symmetric. If an edit breaks symmetry, it's a bug.
- **Coordinate transforms:** Apply `K_global = Tᵀ K_local T` per element **before** assembly.
- **Fixed-end forces:** Must be subtracted from member forces after solving: `F_member = K_local × U_local − FEF_local`.
- **Tributary width:** For 2-way slabs, use `bayWidth / 4`, NOT `bayWidth / 2`.
- **Shear modulus:** Use `G = E / (2(1+ν))`, not hardcoded `E/2.6`.
- **Boundary conditions:** Apply by zeroing rows/columns of K and setting diagonal to 1 (penalty method) or by partitioning.

## Rust Code Standards (apps/rust-api/)

- Avoid `.unwrap()` on user-facing code paths — use `?` or `.unwrap_or_default()`.
- All public solver functions should return `Result<T, SolverError>`.
- Use `f64` for all engineering calculations (never `f32`).
- Prefer `nalgebra` for matrix operations.

## Python Code Standards (apps/backend-python/)

- Use `numpy` for matrix operations, `scipy.linalg` for solvers.
- Type hints on all public functions.
- Engineering functions should include a docstring with the equation and code clause.

## Frontend Calculation Engines (apps/web/src/components/structural/)

- 27 TypeScript engines. Each handles one structural design task.
- Result objects must include `passed: boolean`, `utilization: number`, and a human-readable `message`.
- Display engineering notation for large/small numbers.

## Load Combinations (IS 875 Part 5 — LSM)

Standard combinations to support:
| ID | Expression |
|----|------------|
| LC1 | 1.5(DL + LL) |
| LC2 | 1.5(DL + WL) |
| LC3 | 1.2(DL + LL + WL) |
| LC4 | 1.5(DL + EQ) |
| LC5 | 1.2(DL + LL + EQ) |
| LC6 | 0.9DL + 1.5WL |
| LC7 | 0.9DL + 1.5EQ |

Never combine wind (WL) and earthquake (EQ) simultaneously per IS 1893 Cl. 6.3.2.

## Testing Expectations

- Structural calculations: validate against hand calculations or NAFEMS benchmarks.
- New design code functions: include at least one test with a known textbook example.
- Solver changes: run NAFEMS regression suite before merging.
