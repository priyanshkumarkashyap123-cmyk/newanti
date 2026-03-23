# STAAD Phase 5 — BeamLab Baseline Extraction (Code-Verified)

## Objective

Extract the **actual implemented BeamLab UI/UX baseline** from source code (not mocks), then map parity readiness against STAAD evidence captured in Phases 1–4.

This phase is implementation-first and references runtime surfaces in:

- `apps/web/src/components/ModernModeler.tsx`
- `apps/web/src/components/layout/EngineeringRibbon.tsx`
- `apps/web/src/components/toolbar/ModelingToolbar.tsx`
- `apps/web/src/components/ViewportManager.tsx`
- `apps/web/src/store/uiStore.ts`
- `apps/web/src/components/modeler/StaadProDialogStubs.tsx`
- `apps/web/src/components/modeler/StatusBar.tsx`
- `apps/web/src/components/results/ResultsHub.tsx`

## Extraction method

1. Confirm primary runtime shell composition from `ModernModeler`.
2. Validate category/ribbon behavior and tool routing (`EngineeringRibbon`, `modelingActionRegistry`).
3. Validate workflow guards and modal state machine (`uiStore`).
4. Validate viewport/navigation/context-menu behavior (`ViewportManager` + `ModernModeler` handlers).
5. Validate postprocessing/reporting surfaces (`ResultsHub`, analysis events).
6. Validate parity-dialog registration and file availability (`StaadProDialogStubs` + dialog file existence check).

## Baseline findings (implemented)

### 1) Primary shell is ModernModeler-driven (not legacy layout)

- Active app shell is `WorkflowSidebar` + `EngineeringRibbon` + central `ViewportManager` + right `InspectorPanel` + bottom `StatusBar`.
- Mobile behavior includes collapsible sidebar via `toggle-sidebar` event.
- Right-click context menu pipeline is implemented for node/member/empty-canvas states.

**Impact:** High-confidence parity baseline should use `ModernModeler` path; legacy layout files are secondary.

### 2) Ribbon parity is broad and category-complete

- Top-level categories implemented: `MODELING`, `PROPERTIES`, `SUPPORTS`, `LOADING`, `ANALYSIS`, `DESIGN`, `CIVIL`.
- Geometry tab contains create/edit/generator/array/measure/import clusters.
- Supports/loading/analysis/design contain dedicated clusters and modal/event routing.
- Analysis/export/report actions dispatch global events consumed by `ModernModeler`.

**Impact:** STAAD shell + tab semantics from Phases 2–3 have strong structural alignment in BeamLab.

### 3) Workflow state guards are explicit in store

- `setCategory` in `uiStore` enforces staged warnings and blocks DESIGN without completed analysis.
- Validation checks exist for geometry/support/load prerequisites when switching categories.

**Impact:** BeamLab has stronger guided guardrails than baseline STAAD command-driven freedom in several transitions.

### 4) Viewport parity primitives are implemented

- Single and quad layouts.
- 2D orthographic and 3D perspective view modes.
- Orbit/zoom/pan controls, fit camera controller, and context menu hooks.
- WebGL compatibility handling and fallback notice path.

**Impact:** Core view/navigation parity surface is materially present.

### 5) Status/data feedback surfaces are implemented

- Status bar exposes mode/tool/selection/counts/load-case/units/zoom and backend health dots.
- Load case and units are interactive popovers.
- Inspector panel is context-aware (selected entity count + property panel hosting).

**Impact:** STAAD-like persistent context feedback loop is implemented and richer in some dimensions.

### 6) Results and reporting hub is implemented

- Unified modal hub with Analysis / Design / Detailing / Export tabs.
- Primary report generation path with configurable sections.
- Design and analysis CTA wiring uses event bus from ribbon to modeler.

**Impact:** Postprocessing/report parity exists as a consolidated hub rather than page-strip model.

## Residual risks / partial parity

1. **Fallback-to-null dialog pattern**
   - `StaadProDialogStubs` lazy imports include `catch(() => ({ default: () => null }))`.
   - This avoids crashes but can silently hide missing dialog implementations.

2. **Dual-shell legacy drift risk**
   - `WorkspaceLayout.tsx` + `layout/Ribbon.tsx` remain in repo with older semantics.
   - Primary runtime shell is `ModernModeler`; legacy files can confuse parity audits if treated as authoritative.

3. **Action fallback “guided mode” path**
   - `EngineeringRibbon` action dispatcher can show info notifications when target modal is unavailable.
   - Useful for graceful UX, but marks possible parity gaps for strict STAAD equivalence.

## Phase 4 transition alignment check

- **F4-01 (load lifecycle):** Supported (load case manager + dialogs + loading actions).
- **F4-02 (analysis handoff):** Supported (run analysis events + progress modal + results hub).
- **F4-03 (results interpretation):** Supported (results tabs/diagrams/export).
- **F4-04 (model mutation from results):** Partially represented (design/report flows present; exact STAAD “Update Properties” mutation semantics differ).
- **F4-05 (selection ambiguity):** Supported (cursor modes, selection actions, context menu, modeler tools).
- **F4-06 (view reset/layout):** Supported (layout/view toggles + camera controls).

## Conclusion

BeamLab’s implemented baseline is **feature-dense and runtime-wired** across shell, ribbon, selection, loading, analysis, and reporting. The principal parity caveats are:

- potential silent fallback for missing dialogs,
- coexistence of legacy shell files,
- and semantic differences where BeamLab consolidates STAAD page-strip flows into modal/hub workflows.

Phase 6 can now build a strict parity matrix (`STAAD command -> BeamLab implemented/partial/gap`) on top of this verified baseline.