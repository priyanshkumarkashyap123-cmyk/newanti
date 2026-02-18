# Validation & Regression Plan

Purpose: establish repeatable, code-aligned baselines to prove numerical correctness and guard against drift. All cases to run in CI with tolerances and versioned inputs/outputs.

## Test harness principles
- Deterministic inputs with explicit units.
- Golden outputs stored (JSON) with tolerances (abs/rel) per metric.
- Clause references per check.
- Dual-run if needed (Rust/Python) with cross-compare to reference spreadsheets/textbooks.
- Fail-fast in CI; nightly extended suite for heavy cases.

## Canonical problem sets (initial 10 per domain)

### Structural Analysis
1. Simply supported beam, midspan point load — deflection/shear/moment vs closed form.
2. Propped cantilever — fixed-end forces vs textbook.
3. 2D portal frame, sway and non-sway — stiffness method benchmark.
4. Continuous beam (3-span) — moment distribution vs closed form.
5. Truss (Pratt) with moving load — influence lines.
6. Modal analysis of 5-story shear building — compare natural periods to hand calc.
7. SRSS/CQC modal combination case with close modes — check against reference.
8. P-Δ amplification on tall frame — compare to code approximate method.
9. Temperature load case combination — load factoring check.
10. Unit-switch regression (SI/Imperial) — identical normalized results.

### Seismic (IS 1893 / ASCE 7 / EN 1998)
1. Site coefficient tables Fa/Fv vs published table values (grid tests).
2. Design spectra Sds/Sd1 (ASCE) and Sa/g (IS 1893) for multiple site classes.
3. Base shear for regular building (R/Cd/Ω0 sets) — compare to code examples.
4. Accidental torsion + diaphragm flexibility toggle — envelope match.
5. Vertical EQ factor inclusion vs exclusion — delta check.
6. Irregularity flag detection (plan/vertical) — expected classification.
7. Modal RSA with 90% mass participation check — number of modes required.
8. Dual system (shear wall + frame) base shear distribution — compare to example.
9. Eurocode 8 spectrum corner periods vs table.
10. P-Δ stability coefficient θ per ASCE 7 — limit check.

### Steel (IS 800 / AISC 360)
1. Axial compression column curves (buckling classes) — tabulated examples.
2. LTB of laterally unbraced beam — match AISC F2/IS clauses.
3. Combined bending + axial (H1/H2 / IS interaction) — reference problems.
4. Shear yielding/buckling — web slenderness cases.
5. Serviceability deflection limits — common span/depth ratios.
6. Welded plate girder shear + moment — code check.
7. Bolted shear connection — bearing vs friction type; bolt shear/tear-out.
8. Block shear at gusset — AISC/IS example.
9. Base plate with anchor rods — bearing/uplift check.
10. Composite beam (if/when implemented) — stud count/moment capacity.

### Concrete (IS 456)
1. Flexural design of simply supported beam — compare to SP 34 example.
2. Shear design with/without shear reinforcement — τv vs τc tables.
3. Deflection (short-term + creep) — span/depth check vs annex.
4. Column biaxial interaction — compare to design chart/example.
5. Footing (isolated) — punching + bearing.
6. Slab one-way vs two-way classification — reinforcement areas.
7. Development length/anchorage — bar size vs cover.
8. T-beam flange effectiveness — neutral axis cases.
9. Crack width check — bar spacing vs exposure.
10. Durability/cover requirements per exposure class — lookup test.

### Geotechnical (Piles, Earth Retaining)
1. Axial pile capacity (static) sand/clay — vs Reese/Matlock example.
2. Lateral pile p–y analysis (simplified) — matched displacement profile.
3. Pile group efficiency — block/group action example.
4. Negative skin friction case — downdrag inclusion.
5. Mat/raft bearing + settlement — Schmertmann check.
6. Retaining wall Coulomb/Rankine — active/passive pressures.
7. Seismic earth pressure Mononobe-Okabe — benchmark.
8. Slope stability (if implemented) — Bishop simplified factor of safety.
9. Liquefaction triggering (planned) — Boulanger/Idriss example.
10. Lateral spreading displacement (planned) — Youd/Idriss method.

### Offshore / Wind (DNV-GL/IEC)
1. Monopile ULS under extreme storm — compare to guideline example.
2. Fatigue damage accumulation for monopile — rainflow on sample load history.
3. Natural frequency check (1P/3P separation) — IEC criteria.
4. Jacket global checks — member unity ratios vs reference model.
5. Punch-through / pile drivability placeholder — TBD.
6. Hydrodynamic loading (Morison) — inline/cross-flow forces sample.
7. Soil-structure stiffness sensitivity — frequency shift check.
8. SLS displacement/tilt limits at mudline.
9. Ice loading case (if applicable) — placeholder.
10. Electrical/ancillary load envelopes (planned) — placeholder.

## Execution roadmap
- **Week 1**: curate inputs/expected outputs for 3 cases per domain; build JSON fixtures; wire to test runner (pnpm test:regression or cargo test for Rust); add CI job.
- **Week 2-3**: expand to full 10/domain; add tolerance metadata and clause citations; publish dashboard of pass/fail.
- **Ongoing**: nightly full suite; per-PR smoke (reduced set).

## Ownership & tooling
- Harness: Node (frontend engines) + Rust `cargo test` for backend. Add adapter to compare outputs to goldens with tolerance config.
- Storage: `tests/regression/<domain>/<case>.json` for inputs and expected outputs.
- Reporting: Markdown/HTML summary in CI artifacts; Git status check gate.

