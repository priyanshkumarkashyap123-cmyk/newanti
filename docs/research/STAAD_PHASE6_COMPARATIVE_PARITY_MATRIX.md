# STAAD Phase 6 — Comparative Parity Matrix (Detailed)

## Purpose

This phase converts discovery evidence into a decision-ready parity baseline between:

- STAAD.Pro interaction model (Phases 2–4 evidence), and
- BeamLab implemented model (Phase 5 code-verified baseline).

The output is a **traceable parity matrix** that can directly feed implementation priorities.

---

## Inputs and traceability anchors

### STAAD-side evidence

- Shell behavior and navigation: `STAAD-SHELL-*`
- Atomic tab/tool inventory: `STAAD-P3-*`
- Transition friction model: `STAAD-P4-*`

### BeamLab-side evidence

- Runtime shell and control surfaces: `STAAD-P5-*`
- Primary code-path references:
  - `apps/web/src/components/ModernModeler.tsx`
  - `apps/web/src/components/layout/EngineeringRibbon.tsx`
  - `apps/web/src/components/toolbar/ModelingToolbar.tsx`
  - `apps/web/src/components/ViewportManager.tsx`
  - `apps/web/src/store/uiStore.ts`
  - `apps/web/src/components/modeler/StatusBar.tsx`
  - `apps/web/src/components/results/ResultsHub.tsx`

### Cross-phase dependency

Phase 6 decisions must stay consistent with F4 transition IDs:

- `F4-01` Load lifecycle
- `F4-02` Analysis handoff
- `F4-03` Results interpretation
- `F4-04` Result-to-model mutation loop
- `F4-05` Selection ambiguity recovery
- `F4-06` View reset and layout management

---

## Evaluation rubric (explicit)

### Status classes

1. **Implemented (I)**
   - feature exists in primary shell (`ModernModeler` path)
   - action path is wired and executable (event/store/modal/execution)
   - matches core intent of STAAD behavior for the domain

2. **Partial (P)**
   - feature exists but one or more of:
     - reduced semantic depth,
     - weaker discoverability,
     - non-equivalent transition semantics,
     - fallback behavior that masks missing internals

3. **Gap (G)**
   - no reliable equivalent in primary shell
   - or governance ambiguity makes parity result non-reproducible

### Confidence levels

- **High**: direct runtime code path observed and mapped
- **Medium**: inferred from mappings or indirect behavior

### Weighting model

For indexing only:

- Implemented = 1.0
- Partial = 0.5
- Gap = 0.0

---

## Domain matrix with rationale

| # | Domain | STAAD Evidence | BeamLab Evidence | Status | Confidence | Rationale |
|---|---|---|---|---|---|---|
| 1 | Application shell and workflow navigation | `STAAD-SHELL-001..035` | `P5-001..003` | **Implemented** | High | Primary runtime shell includes workflow sidebar and guarded category transitions. |
| 2 | Ribbon category architecture | `P3` tab families | `P5-004..006` | **Implemented** | High | Seven-category ribbon and routed action model are present in production path. |
| 3 | Viewport layout and camera control | `P3-003..008`, `P3-060`, `SHELL-018` | `P5-007..010` | **Implemented** | High | Single/quad, 2D/3D, context menu, and camera behaviors are runtime-wired. |
| 4 | Selection ambiguity recovery | `P3-009..015`, `P3-059`, `F4-05` | `P5-006`, `P5-010`, `P5-015` | **Partial** | Medium | Core selection exists; advanced relational/QA selection discoverability not as explicit as STAAD workflow. |
| 5 | Specification/property depth | `P3-016..023` | `P5-004`, `P5-016` | **Partial** | Medium | Broad dialog surface exists; full STAAD-level parameter depth is uneven by dialog family. |
| 6 | Loading lifecycle and generators | `P3-024..032`, `P3-058`, `F4-01` | `P5-004`, `P5-012`, `P5-015`, `P5-016` | **Partial** | High | Case and assignment lifecycle is strong; code-generator detail parity is mixed. |
| 7 | Analysis execution and advanced commands | `P3-033..037`, `P3-057`, `F4-02` | `P5-003`, `P5-014`, `P5-015`, `P5-016` | **Implemented** | High | Run-analysis and advanced analysis pathways are guarded and connected to result flows. |
| 8 | Results interpretation and postprocessing | `P3-040..056`, `F4-03` | `P5-014`, `P5-015` | **Implemented** | High | Unified Results Hub supports analysis/design/detailing/export interpretation loop. |
| 9 | Result-to-model mutation semantics | `P3-050`, `F4-04` | `P5-014`, `P5-015` | **Partial** | Medium | Iterative design loop exists; STAAD-specific “Update Properties + forced re-entry semantics” not 1:1. |
| 10 | Quick commands and keyboard layer | `SHELL-019`, `SHELL-023..029` | `P5-011`, `P5-015` | **Partial** | Medium | Quick command systems exist; STAAD keytip behavior and shortcut parity are incomplete. |
| 11 | Persistent status/data context | `SHELL-021..022` | `P5-012`, `P5-013` | **Implemented** | High | Status/inspector surfaces continuously expose mode/tool/load-case/units/selection context. |
| 12 | Shell governance consistency | Internal governance risk | `P5-019`, `P5-020` | **Gap** | High | Legacy shell artifacts can cause audit drift if mistakenly treated as authoritative. |

---

## Transition-level conformance check (F4)

| Flow ID | STAAD Intent | BeamLab Conformance | Status |
|---|---|---|---|
| `F4-01` | define case -> assign -> verify | implemented lifecycle with partial generator-depth parity | Partial |
| `F4-02` | run -> progress -> results handoff | full execution and handoff in primary shell | Implemented |
| `F4-03` | interpret results by context/layout | implemented via Results Hub views and export paths | Implemented |
| `F4-04` | result-side model mutation + re-analysis loop | iterative loop exists but semantics differ | Partial |
| `F4-05` | recover from selection ambiguity quickly | mostly implemented; advanced discoverability weaker | Partial |
| `F4-06` | reset and compare views/layouts | implemented with layout and camera controls | Implemented |

---

## Quantitative results

- Domains evaluated: **12**
- Implemented: **6**
- Partial: **5**
- Gap: **1**

### Parity index

$$
	ext{Parity Index} = \frac{6(1.0) + 5(0.5) + 1(0.0)}{12} = \frac{8.5}{12} = 0.708\;\text{(70.8\%)}
$$

### Risk-adjusted interpretation

- Foundational architecture parity is strong (shell, ribbon, viewport, analysis, results).
- Remaining parity work is mainly **depth**, **discoverability**, and **governance consistency**.

---

## Detailed remediation mapping (feeds Phase 7)

### P0 — Reliability and audit integrity

1. Eliminate silent null-fallback masking for parity dialogs.
2. Formalize `ModernModeler` as the only authoritative parity shell.

### P1 — Depth parity

3. Strengthen advanced selection QA and relational selection visibility.
4. Increase loading generator parameter parity where STAAD command depth is richer.
5. Clarify mutation-to-reanalysis UX semantics in results/design flows.

### P2 — Productivity parity

6. Expand keyboard/command discoverability alignment for high-frequency actions.

---

## Exit criteria for Phase 6

Phase 6 is complete only when:

1. Every domain row includes STAAD evidence + BeamLab evidence + rationale.
2. F4 transition flows are explicitly conformance-scored.
3. Quantitative index is reproducible from matrix statuses.
4. Priorities are mapped to executable Phase 7 work items.