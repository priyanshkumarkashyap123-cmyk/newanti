# Implementation Plan

## Phase 1 — Foundations
- [ ] Add/update types and result contracts with unit-labeled fields
- [ ] Add/confirm safety-factor constants (reuse existing; no duplicate constants)
- [ ] Add input validation and precondition checks

## Phase 2 — Core Logic
- [ ] Implement calculations/logic per mapped clauses
- [ ] Preserve sign conventions where required (reinforcement placement, interaction checks)
- [ ] Add interpolation/table lookup logic with source citation

## Phase 3 — Integration
- [ ] Wire feature into API/UI/engine pipeline
- [ ] Ensure consistent output with `passed`, `utilization`, `message`
- [ ] Add fallback behavior for unavailable backends (if applicable)

## Phase 4 — Verification
- [ ] Add at least one textbook/hand-calculation benchmark test
- [ ] Add regression tests for unchanged behaviors
- [ ] Add edge-case tests (invalid, boundary, extreme values)
- [ ] Run relevant test suites and capture outcomes

## Phase 5 — Documentation & Handover
- [ ] Update docs/changelog and assumptions/limitations
- [ ] Verify clause/table references are present in code and outputs
- [ ] Final QA review against acceptance criteria

## Definition of Done (Gate)
- [ ] All acceptance criteria pass
- [ ] SI units are explicit and consistent
- [ ] Clause citations are present where required
- [ ] Safety factors and sign conventions validated
- [ ] No regression in preserved behaviors
