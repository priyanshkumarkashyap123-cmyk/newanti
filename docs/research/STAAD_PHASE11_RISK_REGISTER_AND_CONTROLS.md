# STAAD Phase 11 — Risk Register and Controls

## Objective

Capture execution and governance risks for parity delivery and define preventive + detective controls.

Inputs:

- `STAAD_PHASE6_COMPARATIVE_PARITY_MATRIX.md`
- `STAAD_PHASE9_VALIDATION_AND_CLOSEOUT.md`
- `STAAD_PHASE10_SPRINT_EXECUTION_BOARD.md`

---

## Risk scoring model

- Probability (P): 1–5
- Impact (I): 1–5
- Risk score = $P \times I$
- Levels:
  - 1–6: Low
  - 8–12: Medium
  - 15–25: High

---

## Risk register

| Risk ID | Description | P | I | Score | Level | Early Signal | Preventive Control | Contingency |
|---|---|---:|---:|---:|---|---|---|---|
| R-01 | Silent dialog load failure reappears | 3 | 5 | 15 | High | Blank modal or no user feedback | Enforce explicit error fallback + test in CI | Hotfix fallback component + block release |
| R-02 | Legacy shell used for parity decisions | 3 | 4 | 12 | Medium | Review notes reference `WorkspaceLayout` as primary | Governance checklist requiring `ModernModeler` citation | Reject parity signoff until corrected |
| R-03 | Selection depth changes regress core selection | 2 | 4 | 8 | Medium | Increased selection bug reports | Add focused regression tests on select/move/delete | Rollback selection UX patch behind flag |
| R-04 | Loading depth expansion introduces invalid load data | 3 | 5 | 15 | High | Invalid load cases pass through UI | Parameter validation + active load case binding tests | Disable problematic generator path temporarily |
| R-05 | Mutation safety cues not triggered consistently | 3 | 4 | 12 | Medium | Stale results shown as current | Centralized stale-state update contract | Force stale-state globally on mutation events |
| R-06 | Shortcut discoverability docs diverge from runtime | 2 | 3 | 6 | Low | User-reported shortcut mismatch | Build-time checklist against command map | Update docs in patch release |
| R-07 | Ledger drift (status changed, evidence not updated) | 3 | 4 | 12 | Medium | Matrix and ledger disagree | Mandatory evidence-ID update rule per status change | Freeze parity status updates until reconciled |
| R-08 | Validation suites skipped due schedule pressure | 2 | 5 | 10 | Medium | Missing suite reports at checkpoint | Gate policy requires suite evidence for release | Conditional release only with executive waiver |

---

## Control matrix

### Preventive controls

1. Mandatory P0 completion before P1/P2 signoff.
2. Primary-shell-only parity citation requirement.
3. Input validation hardening for loading and mutation flows.

### Detective controls

1. Validation suite reports (A/B/C).
2. CSV schema check on every ledger update.
3. Weekly matrix-to-ledger consistency audit.

### Corrective controls

1. Feature flags for risky UX depth enhancements.
2. Rapid rollback playbook for parity regressions.
3. Controlled re-score only after corrective action evidence.

---

## Escalation rules

- Any High-level risk with active trigger blocks closeout gates.
- Two or more Medium risks in same lane require mitigation review meeting.
- Governance violations (evidence mismatch) block parity signoff.

---

## Risk review cadence

- Daily quick scan during sprint.
- Formal risk review at Checkpoint C2 and C3.
- Post-sprint archive with resolved/open risk states.

---

## Done definition (Phase 11)

Phase 11 is complete when:

1. Risks are scored and mapped to controls.
2. High risks have explicit contingency actions.
3. Escalation and cadence are operationally defined.
4. Risk controls map to Phase 9 gates.
