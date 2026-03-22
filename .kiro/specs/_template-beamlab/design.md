# Design Document

## Overview
- Proposed approach:
- Why this approach:
- Tradeoffs:
- Risks and mitigations:

## Architecture & Data Flow
- Inputs:
- Processing pipeline:
- Outputs:
- Error/fallback paths:
- Integration points (frontend / rust-api / python / wasm):

## Equations & Code-Clause Mapping (Mandatory)
For each major check/calculation:
- Equation:
- Variables and units:
- Governing code clause/table:
- Implementation anchor (file + symbol):
- Notes on interpolation/limits/sign handling:

## Solver & Numerical Rules (If Applicable)
- Stiffness matrix symmetry preserved
- Coordinate transform rule: `K_global = Tᵀ K_local T`
- Fixed-end force handling
- Boundary condition method
- Tributary width logic
- Shear modulus formula: `G = E / (2(1+ν))`

## Data Model Changes
- New/updated interfaces/structs
- Field-level unit annotations
- Result contract (mandatory where applicable):
  - `passed: boolean`
  - `utilization: number`
  - `message: string` (with clause reference)

## Error Handling
- Input validation and guard clauses
- Error propagation strategy
- User-facing error messages

## Test Strategy (Mandatory)
- Unit tests
- Integration tests
- Property/invariant tests (for solver and geometry logic)
- Known reference validation (hand calc / textbook / NAFEMS where relevant)
- Numeric tolerance policy

## File Change Map
- `path/to/file`: purpose of change
- `path/to/file`: purpose of change

## Rollout & Risk Control
- Feature flag strategy (if needed)
- Backward compatibility notes
- Observability/logging updates
