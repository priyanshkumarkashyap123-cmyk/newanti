# STAAD Phase 8 — Implementation Tickets (Execution-Ready)

## Objective

Convert Phase 6 parity findings and Phase 7 roadmap into implementation-ready tickets that engineering can execute without ambiguity.

Inputs:

- `STAAD_PHASE6_COMPARATIVE_PARITY_MATRIX.md`
- `STAAD_PHASE7_EXECUTION_ROADMAP.md`
- `STAAD_RESEARCH_EVIDENCE_LEDGER.csv` (`P6`, `P7` rows)

---

## Ticket template (standard)

Each ticket must include:

- **Ticket ID**
- **Phase linkage** (`P6`, `P7` evidence IDs)
- **Problem statement**
- **Scope (in/out)**
- **Primary file targets**
- **Implementation steps**
- **Acceptance criteria**
- **QA scenarios**
- **Telemetry/instrumentation requirements**
- **Risk notes and rollback strategy**

---

## Wave 1 (P0) tickets

### BL-P0-001 — Replace silent dialog fallback with explicit failure UX

**Phase linkage**

- `STAAD-P6-012`, `STAAD-P7-001`

**Problem statement**

Parity dialogs may fail to import and currently degrade to blank/null rendering, hiding parity loss.

**Scope**

- In: parity dialogs loaded from `StaadProDialogStubs`
- Out: unrelated non-parity dialog framework redesign

**Primary file targets**

- `apps/web/src/components/modeler/StaadProDialogStubs.tsx`
- `apps/web/src/store/uiStore.ts`
- optional: central notification/telemetry utilities

**Implementation steps**

1. Replace lazy import null fallback with explicit error component.
2. Show dialog-level error banner with dialog key and recovery hint.
3. Emit telemetry event on import failure.
4. Ensure close path is always available.

**Acceptance criteria**

- No parity dialog import failure results in blank modal.
- Failure state includes actionable message and close action.
- Telemetry event includes dialog name and route context.

**QA scenarios**

- Force dynamic import failure for one parity dialog.
- Verify error UI and telemetry payload.

**Rollback**

- Feature-flag fallback behavior by dialog group.

---

### BL-P0-002 — Enforce ModernModeler as parity authority

**Phase linkage**

- `STAAD-P6-012`, `STAAD-P7-002`

**Problem statement**

Legacy shell files can create conflicting parity interpretations.

**Scope**

- In: documentation + QA policy + parity review checklists
- Out: deleting legacy shell implementation

**Primary file targets**

- `docs/research/` parity docs
- internal QA checklists/runbooks (repo docs path as applicable)

**Implementation steps**

1. Add explicit authority note in parity docs.
2. Add checklist gate: claims must cite `ModernModeler` code path.
3. Tag legacy shell references as non-authoritative.

**Acceptance criteria**

- Every new parity claim references primary shell path.
- Legacy shell claims are rejected in parity QA.

**QA scenarios**

- Attempt parity claim from `WorkspaceLayout`; verify checklist blocks it.

---

## Wave 2 (P1) tickets

### BL-P1-001 — Selection parity depth upgrade

**Phase linkage**

- `STAAD-P6-004`, `STAAD-P7-003`

**Problem statement**

Advanced selection recovery exists but is less discoverable than STAAD flow expectations.

**Scope**

- In: selection discoverability in modeling shell
- Out: full new selection engine rewrite

**Primary file targets**

- `apps/web/src/components/toolbar/ModelingToolbar.tsx`
- `apps/web/src/components/layout/WorkflowSidebar.tsx`
- `apps/web/src/components/layout/EngineeringRibbon.tsx`

**Implementation steps**

1. Add explicit entry points for relational/filter/QA selection actions.
2. Add contextual hint text for ambiguity recovery workflow.
3. Add shortcut/tooltip parity hints for top selection actions.

**Acceptance criteria**

- User can recover ambiguous selection in <= 3 guided actions.
- Selection QA actions are visible without hidden paths.

**QA scenarios**

- Dense model selection test with mixed nodes/members/plates.

---

### BL-P1-002 — Loading generator parameter parity pass

**Phase linkage**

- `STAAD-P6-006`, `STAAD-P7-004`

**Problem statement**

Load lifecycle is implemented, but some code-generator depth is uneven.

**Scope**

- In: high-impact loading generator dialogs and case workflow continuity
- Out: low-usage niche generator families in first pass

**Primary file targets**

- `apps/web/src/components/dialogs/*Load*.tsx`
- `apps/web/src/components/layout/EngineeringRibbon.tsx`
- `apps/web/src/store/model.ts` (load case integration as needed)

**Implementation steps**

1. Build generator parity checklist per dialog.
2. Fill missing high-impact fields and validations.
3. Ensure generated loads bind to active load case consistently.
4. Verify diagram/visual feedback loop after apply.

**Acceptance criteria**

- Case -> definition -> assignment -> verification flow passes for target generators.
- Parameter validation prevents silent bad input.

**QA scenarios**

- End-to-end scripted load workflow matching `F4-01`.

---

### BL-P1-003 — Mutation safety: enforce re-analysis semantics

**Phase linkage**

- `STAAD-P6-009`, `STAAD-P7-005`

**Problem statement**

Result/design mutations can leave stale-analysis interpretation risk.

**Scope**

- In: mutation-triggered stale-result state + re-analysis guidance
- Out: full redesign of analysis engine status model

**Primary file targets**

- `apps/web/src/components/results/ResultsHub.tsx`
- `apps/web/src/store/uiStore.ts`
- `apps/web/src/components/modeler/StatusBar.tsx`

**Implementation steps**

1. Mark analysis context stale on model mutations post-analysis.
2. Surface explicit re-analysis CTA and warning state.
3. Prevent misleading “results current” indicators.

**Acceptance criteria**

- Any qualifying mutation flips state to stale.
- Re-analysis prompt appears and routes correctly.

**QA scenarios**

- Run analysis, mutate properties, verify stale-state handling and rerun path.

---

## Wave 3 (P2) tickets

### BL-P2-001 — Keyboard and command discoverability unification

**Phase linkage**

- `STAAD-P6-010`, `STAAD-P7-006`

**Problem statement**

Keyboard layer is present but unevenly discoverable vs STAAD expectations.

**Scope**

- In: top 10 high-frequency actions
- Out: exhaustive remap of all legacy shortcuts

**Primary file targets**

- `apps/web/src/components/ui/KeyboardShortcutsOverlay.tsx`
- `apps/web/src/components/CommandPalette.tsx`
- `apps/web/src/components/layout/EngineeringRibbon.tsx`

**Acceptance criteria**

- Top 10 frequent actions have visible shortcut or command route.

---

### BL-P2-002 — Living parity documentation contract

**Phase linkage**

- `STAAD-P7-007`, `STAAD-P7-008`

**Problem statement**

Parity status can drift without disciplined documentation updates.

**Scope**

- In: phase docs + ledger consistency process
- Out: external reporting automation

**Primary file targets**

- `docs/research/STAAD_PHASE6_COMPARATIVE_PARITY_MATRIX.md`
- `docs/research/STAAD_RESEARCH_EVIDENCE_LEDGER.csv`

**Acceptance criteria**

- Status changes require evidence-row updates and confidence notes.
- CSV schema check passes on every parity update.

---

## Delivery order and dependency graph

1. `BL-P0-001` -> 2) `BL-P0-002` -> 3) `BL-P1-001` -> 4) `BL-P1-002` -> 5) `BL-P1-003` -> 6) `BL-P2-001` -> 7) `BL-P2-002`

Critical dependencies:

- Wave 2 should not begin before Wave 1 reliability controls are in place.
- Phase 6 parity score should be recomputed after Wave 2 completion.

---

## Done definition for Phase 8

Phase 8 is complete when:

1. All roadmap work is represented as executable tickets.
2. Every ticket has acceptance and QA scenarios.
3. File-level ownership and dependency order are explicit.
4. Ticket set maps back to Phase 6 parity statuses and Phase 7 gates.