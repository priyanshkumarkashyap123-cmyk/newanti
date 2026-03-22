# BeamLab Spec Template (Kiro-style)

Use this folder as the starting point for every new feature spec.

## Folder convention
Create new feature specs under:

- `.kiro/specs/{feature-slug}/requirements.md`
- `.kiro/specs/{feature-slug}/design.md`
- `.kiro/specs/{feature-slug}/tasks.md`

Recommended slug format:

- `{domain}-{code}-{feature}`
- Example: `rc-beam-is456-shear-redesign`

## How to use with Copilot
1. Copy these 3 files into a new feature folder.
2. Fill `requirements.md` first (clear, testable acceptance criteria).
3. Fill `design.md` with equation + clause mapping and file impact map.
4. Fill `tasks.md` as phased, verifiable work items.
5. Implement phase-by-phase and verify after each phase.

## BeamLab mandatory checks
- SI units only; unit labels in variable names/outputs.
- Sign conventions explicitly documented and preserved.
- Clause/table citation for governing checks.
- `utilization = demand/capacity`, pass if `<= 1.0`.
- At least one hand-calculation or textbook validation case.

## Optional extension
For solver-heavy features, add `validation.md` with:
- Invariants/properties
- Benchmark references (e.g., NAFEMS)
- Numerical tolerances
- Regression matrix
