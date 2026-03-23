# STAAD Phase 4 — UX Behavior and Transition Mapping

## Objective

Map STAAD.Pro interaction flows with explicit transition semantics:

- entry point
- preconditions
- modal/non-modal behavior
- feedback surfaces
- output destination
- reversal/recovery paths

This phase is evidence-linked to `STAAD-SHELL-*` and `STAAD-P3-*` rows.

## Transition taxonomy

### Transition types

1. **Context Transition**
   - workflow or page changes (e.g., Analytical Modeling -> Postprocessing)
2. **Dialog Transition**
   - command opens modal/non-modal dialog and returns on Apply/OK/Cancel
3. **Canvas Transition**
   - command changes view/selection/render state in View Window
4. **Execution Transition**
   - run analysis/design/cloud operations with progress status and completion targets
5. **Data/Model Mutation Transition**
   - modifies model data, properties, load definitions, or command-file intent

### Feedback classes

- **Visual:** overlays, diagrams, color states, selection highlight
- **Panel:** table/dialog updates in Data Area
- **Status:** Status Bar hints/current units/load case updates
- **Execution:** progress windows / completion outputs

## High-friction flow maps

### F4-01: Load definition and assignment lifecycle

- **Entry points:** Loading tab -> Primary Load Cases / Load Items / Definitions
- **Preconditions:** model entities exist; active load case context selected
- **Transitions:**
  1. Open case-definition dialog (dialog transition)
  2. Save case -> case list mutation (data transition)
  3. Open load items dialog and assign to entities (dialog + data transition)
  4. Toggle View Loading Diagram for verification (canvas transition)
- **Feedback:** load diagram overlay + active load case state
- **Output destination:** load-case definitions, load assignments, command-file directives
- **Recovery paths:** edit load items, inverse/filtered select for correction, remove or redefine case
- **Evidence links:** `STAAD-P3-024`..`032`, `STAAD-SHELL-022`

### F4-02: Analysis run to postprocessing handoff

- **Entry points:** Analysis & Design tab -> Run Analysis (`Ctrl+F5`)
- **Preconditions:** analysis commands present; valid model topology/inputs
- **Transitions:**
  1. Run Analysis invoked (execution transition)
  2. Progress window shown (execution feedback)
  3. Completion enables results surfaces and page sets (context transition)
  4. User shifts to Results/Postprocessing pages (context + canvas transition)
- **Feedback:** progress window, results diagrams, tables
- **Output destination:** analysis output data + postprocessing pages/tables
- **Recovery paths:** adjust analysis commands (Set/Eigen/Cutoff/etc.), rerun analysis
- **Evidence links:** `STAAD-P3-033`..`037`, `STAAD-P3-054`..`056`, `STAAD-SHELL-023`

### F4-03: Results interpretation and layout switching

- **Entry points:** Results tab -> primary diagram buttons / Layouts menu
- **Preconditions:** analysis results available for selected load/mode/step
- **Transitions:**
  1. Choose load/mode/time-step context (state selection)
  2. Trigger diagram or layout command (canvas + panel transition)
  3. Optional annotation/scale tuning (dialog transition)
- **Feedback:** overlays, contours, graphs, tables
- **Output destination:** active result visualization and tabular context
- **Recovery paths:** switch layouts, adjust scale/annotation, change load/mode/time-step
- **Evidence links:** `STAAD-P3-040`..`049`, `STAAD-P3-055`

### F4-04: Design result to model synchronization (critical mutation)

- **Entry points:** Results tab -> Update Properties
- **Preconditions:** design member selection or grouping outcomes present
- **Transitions:**
  1. Invoke Update Properties (data mutation transition)
  2. Warning/confirmation acknowledged
  3. Input file properties rewritten
  4. Workflow auto-switches back to Analytical Modeling (context transition)
- **Feedback:** warning dialog + workflow shift
- **Output destination:** modified model/input properties
- **Recovery paths:** re-run analysis on modified model; replace SELECT/GROUP with CHECK CODE when needed
- **Evidence links:** `STAAD-P3-050`

### F4-05: Selection ambiguity resolution in dense models

- **Entry points:** Select tab -> cursor mode, filter, missing property, drag mode
- **Preconditions:** dense or mixed-entity model where direct click is ambiguous
- **Transitions:**
  1. Switch cursor type (contextual selection mode transition)
  2. Apply relational selectors (parallel/connected/list)
  3. Use filter/group/property-name constraints
  4. Run highlight sequence for visual QA
- **Feedback:** selection set updates and highlight sequencing
- **Output destination:** corrected target selection for downstream commands
- **Recovery paths:** inverse selection, previous selection restore, alternate drag mode
- **Evidence links:** `STAAD-P3-009`..`015`, `STAAD-P3-059`

### F4-06: View/navigation reset and multi-view management

- **Entry points:** View tab -> orientation/navigation/window commands
- **Preconditions:** user changed zoom/rotation/window arrangement
- **Transitions:**
  1. Use orientation/whole-structure/zoom tools (canvas transition)
  2. Use structure-only or tiling/cascade (window transition)
  3. Save/open view snapshots (view-state transition)
- **Feedback:** immediate camera/layout changes
- **Output destination:** active view state + saved view entries
- **Recovery paths:** zoom previous, open saved view, structure only reset
- **Evidence links:** `STAAD-P3-003`..`008`, `STAAD-P3-060`, `STAAD-SHELL-018`

## Hidden complexity nodes

1. **Workflow-dependent availability**
   - tools and pages are not globally static; they change by workflow and context
2. **Dialog-driven command-file mutation**
   - many operations mutate command intent rather than immediate solver output
3. **Result-context coupling**
   - load/mode/time-step choices gate visibility of diagrams/tables
4. **Model mutation from results stage**
   - Update Properties introduces analysis invalidation risk and re-entry requirement
5. **Selection mode mismatch risk**
   - wrong cursor/filter mode creates false-negative/false-positive target sets

## Interaction-state mini diagrams (text form)

### S1 — Loading definition

`Loading Page -> Create Case -> Add Items -> Assign Entities -> View Loading Diagram -> Iterate`

### S2 — Analysis to results

`Analysis Commands -> Run Analysis -> Progress Window -> Results Context Enabled -> Layout/Diagram Selection`

### S3 — Design sync loop

`Design Results -> Update Properties -> Confirm Mutation -> Auto-switch Analytical Modeling -> Re-analysis`

## Acceptance checks for this phase

- Every high-friction flow has entry/precondition/feedback/output/recovery fields.
- Every flow is linked to existing evidence IDs from Phases 2 and 3.
- No numeric solver correctness claims added (UX-only scope preserved).

## Next-phase dependency handoff

Phase 5 (BeamLab extraction) will consume:

- the transition taxonomy above
- friction flow IDs (`F4-01`..`F4-06`)
- evidence linkage strategy for parity comparison
