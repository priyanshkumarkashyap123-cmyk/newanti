# Implementation Plan: STAAD.Pro Modeling Tools Parity

## Overview

Implement 23 requirements across eight work areas following the existing
ToolGroups → ModernModeler → uiStore → dialog pattern. Tasks are ordered:
foundation types first, then tool registration, then dialogs, then algorithms,
then wizard templates, then design codes, with property-based tests co-located
with each implementation task.

## Tasks

- [x] 1. Extend TypeScript interfaces in modelTypes.ts and model.ts
  - Add optional `axialBehavior`, `inactive`, `partialReleases`, `propertyReductionFactors`, and `diaphragmId` fields to the `Member` interface
  - Add optional `masterSlaveConstraint` field to the `Node` interface
  - Add `BuiltUpComponent` and `BuiltUpSectionDef` interfaces
  - Add `DiaphragmSpec` interface (matching the design's `DiaphragmSpec` shape)
  - Add `diaphragms: DiaphragmSpec[]`, `addDiaphragm`, `removeDiaphragm`, and `centerOfRigidity` to `ModelState` in `model.ts`
  - _Requirements: 2.6, 3.3, 3.4, 4.4, 5.5, 6.5, 7.6, 21.3_

- [x] 2. Register all new tool IDs in ToolGroups.ts and uiStore.ts
  - [x] 2.1 Add 23 new tool definitions to `TOOL_DEFINITIONS` in `ToolGroups.ts` with correct icons, labels, tooltips, and categories (ANALYSIS / PROPERTIES / LOADING)
    - Analysis tools: `PDELTA_ANALYSIS`, `BUCKLING_ANALYSIS`, `TIME_HISTORY_ANALYSIS`, `NONLINEAR_ANALYSIS`, `DYNAMICS_PANEL`, `PLATE_STRESS_CONTOUR`, `RESPONSE_SPECTRUM_ANALYSIS`, `PUSHOVER_ANALYSIS`, `STEADY_STATE_ANALYSIS`, `IMPERFECTION_ANALYSIS`, `VIEW_STORY_DRIFT`, `VIEW_FORCE_ENVELOPE`, `VIEW_SECTION_FORCES`, `ANIMATE_MODE_SHAPE`
    - Properties tools: `ASSIGN_PARTIAL_RELEASE`, `ASSIGN_TENSION_ONLY`, `ASSIGN_COMPRESSION_ONLY`, `ASSIGN_INACTIVE`, `ASSIGN_DIAPHRAGM`, `ASSIGN_MASTER_SLAVE`, `ASSIGN_PROPERTY_REDUCTION`
    - Loading tools: `ADD_FLOOR_LOAD`, `ADD_AREA_LOAD`, `ADD_SNOW_LOAD` (update existing entry if present)
    - _Requirements: 1.8, 2.1, 3.1, 3.2, 4.1, 5.1, 6.1, 7.1, 8.1, 9.1, 10.1, 11.1, 12.1, 13.1, 14.1, 15.1, 16.1, 17.1, 18.1, 23.1–23.3_

  - [x] 2.2 Add all new tool IDs to the appropriate group arrays in `MODELING_TOOL_GROUPS` (or create new groups as needed) and to `CATEGORY_TOOLS` in `uiStore.ts`
    - _Requirements: 23.1–23.4_

  - [x]* 2.3 Write property test for tool registration (Property 1 and Property 2)
    - **Property 1: All new tool IDs are registered with correct category**
    - **Validates: Requirements 1.8, 2.1, 3.1, 3.2, 4.1, 5.1, 6.1, 7.1, 8.1, 9.1, 10.1, 11.1, 12.1, 13.1, 14.1, 15.1, 16.1, 17.1, 18.1, 23.1–23.3**
    - **Property 2: No duplicate tool IDs across all groups**
    - **Validates: Requirements 23.4**

  - [x] 2.4 Add all new modal keys to the `modals` object in `uiStore.ts` (type definition and initial state)
    - Keys: `pDeltaAnalysisPanel`, `bucklingAnalysisPanel`, `timeHistoryPanel`, `nonLinearAnalysisPanel`, `dynamicsPanel`, `plateResultsVisualization`, `responseSpectrumDialog`, `pushoverAnalysisDialog`, `imperfectionAnalysisDialog`, `storyDriftPanel`, `forceEnvelopePanel`, `sectionForcesPanel`, `modeShapeAnimationPanel`, `partialReleaseDialog`, `inactiveMemberDialog`, `diaphragmAssignmentDialog`, `masterSlaveDialog`, `propertyReductionDialog`, `floorLoadDialog`, `areaLoadDialog`
    - Note: `steadyStateDialog` and `snowLoadDialog` already exist — verify and skip if present
    - _Requirements: 1.1–1.6, 2.2, 4.2, 5.2, 6.2, 7.2, 8.2, 9.2, 10.2, 11.2, 12.2, 13.2, 14.2, 15.2, 16.2, 17.2, 18.2_

- [x] 3. Wire tool activations in ModernModeler.tsx
  - Add the analysis guard `requiresAnalysis` array and guard logic to the `useEffect([activeTool])` block
  - Map each new tool ID to its corresponding `openModal(modalKey)` call
  - Add selection-count guards for `ASSIGN_MASTER_SLAVE` (< 2 nodes → error, no dialog) and `ASSIGN_DIAPHRAGM` (< 2 nodes → error)
  - Add lazy-loaded dialog JSX stubs for each new modal key (render `null` until the dialog component exists)
  - _Requirements: 1.1–1.7, 2.2, 4.2, 5.2, 6.2, 6.6, 7.2, 8.2, 9.2, 10.2, 11.2, 12.2, 13.2, 14.2, 15.2, 15.5, 16.2, 17.2, 18.2, 18.6_

  - [x]* 3.1 Write property test for analysis guard (Property 3)
    - **Property 3: Analysis guard prevents panel opening without results**
    - **Validates: Requirements 1.7, 15.5, 16.2, 17.2, 18.6**

- [x] 4. Implement property-assignment dialog components
  - [x] 4.1 Create `PartialReleaseDialog.tsx`
    - 6-DOF grid (start/end × FX/FY/FZ/MX/MY/MZ) with Fixed / Released / Partial radio buttons
    - Numeric input for factor (0.001–0.999) shown only when Partial is selected; inline validation error when out of range; confirm button disabled while invalid
    - On confirm: call `onConfirm(spec)` which stores `partialReleases` on each selected member
    - _Requirements: 2.2–2.6_

  - [x]* 4.2 Write property test for partial release factor validation (Property 4)
    - **Property 4: Partial release factor validation**
    - **Validates: Requirements 2.4, 2.5**

  - [x] 4.3 Create `InactiveMemberDialog.tsx`
    - Radio: "All load cases" vs "Selected load cases"; multi-select list of available load cases when the latter is chosen
    - On confirm: store `inactive` spec on each selected member
    - _Requirements: 4.2–4.4_

  - [x] 4.4 Create `DiaphragmAssignmentDialog.tsx`
    - Dropdowns for type (Rigid / Semi-Rigid / Flexible) and plane (XY / XZ / YZ); text input for story label
    - On confirm: call `addDiaphragm(spec)` and set `diaphragmId` on each selected node
    - _Requirements: 5.2–5.5_

  - [x]* 4.5 Write property test for diaphragm node coverage (Property 6)
    - **Property 6: Diaphragm assignment covers all selected nodes**
    - **Validates: Requirements 5.5**

  - [x] 4.6 Create `MasterSlaveDialog.tsx`
    - Node selector to designate master from the selected set; DOF checkboxes (FX/FY/FZ/MX/MY/MZ)
    - On confirm: store `masterSlaveConstraint` on master and slave nodes
    - _Requirements: 6.2–6.5_

  - [x]* 4.7 Write property test for master/slave minimum selection (Property 7)
    - **Property 7: Master/slave requires at least two nodes**
    - **Validates: Requirements 6.6**

  - [x] 4.8 Create `PropertyReductionDialog.tsx`
    - Four numeric inputs: RAX, RIX, RIY, RIZ (0.01–1.00); inline validation; confirm disabled while invalid
    - On confirm: store `propertyReductionFactors` on each selected member
    - _Requirements: 7.2–7.6_

  - [x]* 4.9 Write property test for property reduction factor validation (Property 8)
    - **Property 8: Property reduction factor validation**
    - **Validates: Requirements 7.4, 7.5**

- [x] 5. Implement tension-only / compression-only member assignment
  - Handle `ASSIGN_TENSION_ONLY` and `ASSIGN_COMPRESSION_ONLY` tool activations directly in `ModernModeler.tsx` (no dialog needed — immediate store update + notification)
  - Set `axialBehavior` on selected members; if switching from tension-only to compression-only (or vice versa), replace the flag and notify the user
  - Add distinct visual indicators in the analytical rendering (dashed line style or colour token) for tension-only and compression-only members
  - _Requirements: 3.3–3.7_

  - [x]* 5.1 Write property test for axial behavior mutual exclusion (Property 5)
    - **Property 5: Axial behavior mutual exclusion**
    - **Validates: Requirements 3.7**

- [x] 6. Checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [-] 7. Implement load generator dialogs and algorithms
  - [ ] 7.1 Create `FloorLoadDialog.tsx`
    - Member multi-select for boundary beams; pressure input (kN/m²); distribution method selector (two-way yield-line / one-way X / one-way Z); polygon closure validation before confirm
    - _Requirements: 8.2–8.8_

  - [-] 7.2 Implement `computeFloorLoadYieldLine` utility function
    - Two-way yield-line algorithm: compute centroid, draw yield lines to corners, assign tributary area to each boundary beam, convert to UDL
    - One-way fallback: distribute full pressure × half-span to parallel beams
    - Polygon closure check: return validation error if boundary members do not form a closed loop
    - _Requirements: 8.5, 8.6, 8.8_

  - [ ]* 7.3 Write property test for floor load polygon closure (Property 9)
    - **Property 9: Floor load polygon closure validation**
    - **Validates: Requirements 8.8**

  - [ ] 7.4 Create `AreaLoadDialog.tsx`
    - Pressure input; span direction selector (X / Z); beam multi-select
    - On confirm: call `computeAreaLoadUDL` for each beam and add `MemberLoad` records to the active load case
    - _Requirements: 9.2–9.5_

  - [ ] 7.5 Implement `computeAreaLoadUDL` utility function
    - For each selected beam, compute tributary width as average of gaps to adjacent parallel beams (or panel edge); UDL = pressure × tributary_width
    - _Requirements: 9.4_

  - [ ]* 7.6 Write property test for area load UDL computation (Property 10)
    - **Property 10: Area load UDL equals pressure times tributary width**
    - **Validates: Requirements 9.4**

  - [ ] 7.7 Create `SnowLoadDialog.tsx` (or extend existing `snowLoadDialog` modal)
    - Code selector (ASCE 7-22 / IS 875 Part 4); conditional input fields per code; on confirm: compute design snow load and apply as UDL to selected roof members
    - _Requirements: 10.2–10.7_

  - [ ] 7.8 Implement `computeSnowLoad` utility function
    - ASCE 7-22: `pf = 0.7 × Ce × Ct × Is × pg`; `Cs` slope factor; `ps = Cs × pf`
    - IS 875 Part 4: `S = μ × S0 × k1`
    - _Requirements: 10.4, 10.5_

  - [ ]* 7.9 Write property test for ASCE 7 snow load formula (Property 11)
    - **Property 11: ASCE 7 snow load formula correctness**
    - **Validates: Requirements 10.4**

- [ ] 8. Implement new analysis type dialogs and routing
  - [ ] 8.1 Create `ResponseSpectrumDialog.tsx`
    - Spectrum code selector (IS 1893, ASCE 7, EN 1998); modal combination (SRSS / CQC); number of modes; X/Y/Z scale factors
    - On run: dispatch `handleAdvancedAnalysis('response_spectrum', params)`; auto-trigger modal analysis if `modalResults` is null
    - _Requirements: 11.2–11.8_

  - [ ] 8.2 Create `PushoverAnalysisDialog.tsx`
    - Load pattern selector (uniform / triangular / modal); target displacement input; plastic hinge properties
    - On run: dispatch `handleAdvancedAnalysis('pushover', params)`
    - _Requirements: 12.2–12.6_

  - [ ] 8.3 Create `SteadyStateDialog.tsx` (or extend existing `steadyStateDialog` modal)
    - Frequency range (min/max Hz) and step; damping ratio; node + DOF selector for excitation point
    - On run: dispatch `handleAdvancedAnalysis('steady_state', params)`
    - _Requirements: 13.2–13.5_

  - [ ] 8.4 Create `ImperfectionAnalysisDialog.tsx`
    - Notional load coefficient (default 0.002); stiffness reduction factor (default 0.8); load case multi-select
    - On confirm: add notional lateral loads to selected load cases and flag analysis as DAM
    - _Requirements: 14.2–14.5_

  - [ ] 8.5 Extend `useAnalysisExecution` hook with `handleAdvancedAnalysis` method
    - Add `AdvancedAnalysisType` discriminant union; implement `POST /api/analysis/advanced` fetch; store results in `analysisResults.advancedResults`
    - _Requirements: 11.6, 12.4, 13.4_

- [ ] 9. Implement post-processing panel components
  - [ ] 9.1 Create `StoryDriftPanel.tsx`
    - Table of story label / height / lateral displacement / drift ratio per load case; highlight rows exceeding user-specified limit (default H/400); CSV export button
    - _Requirements: 15.2–15.6_

  - [ ]* 9.2 Write property test for story drift flag correctness (Property 12)
    - **Property 12: Story drift flag correctness**
    - **Validates: Requirements 15.4**

  - [ ] 9.3 Create `ForceEnvelopePanel.tsx`
    - Per-member table of max/min axial, Vy, Vz, torsion, My, Mz across all load combinations; governing combination column; CSV export; fallback to individual load cases when no combinations defined
    - _Requirements: 16.2–16.6_

  - [ ] 9.4 Create `SectionForcesPanel.tsx`
    - Up to 20 fractional position inputs (0.0–1.0); inline validation for out-of-range values; results table (N, Vy, Vz, T, My, Mz) + viewport markers overlay
    - _Requirements: 17.2–17.6_

  - [ ]* 9.5 Write property test for fractional position validation (Property 13)
    - **Property 13: Section forces fractional position validation**
    - **Validates: Requirements 17.3, 17.6**

  - [ ] 9.6 Create `ModeShapeAnimationPanel.tsx`
    - Mode list with frequency and mass participation; amplitude scale slider; speed control; play / pause / step controls; drives viewport animation loop
    - _Requirements: 18.2–18.5_

  - [ ] 9.7 Implement center of rigidity computation and display
    - After analysis, compute CR for each rigid diaphragm and store in `centerOfRigidity` map; render labelled CR marker in viewport; display CM–CR eccentricity in results panel
    - _Requirements: 19.1–19.4_

- [ ] 10. Checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 11. Add Structure Wizard templates
  - [ ] 11.1 Implement King Post and Queen Post truss generators in `StructureWizard.tsx`
    - King Post: 4 nodes, 4 members (parametric: span, rise)
    - Queen Post: 6 nodes, 8 members (parametric: span, rise)
    - _Requirements: 20.1–20.3_

  - [ ] 11.2 Implement Fink and Scissors truss generators in `StructureWizard.tsx`
    - Fink: bottom chord + apex + quarter-point nodes; sub-diagonals (parametric: span, rise, panels — even ≥ 4)
    - Scissors: crossing rafters with internal scissors tie (parametric: span, rise, vaultHeight)
    - _Requirements: 20.1–20.3_

  - [ ] 11.3 Implement North Light truss generator in `StructureWizard.tsx`
    - Asymmetric steep north / shallow south slopes (parametric: span, northRise, southRise, panels)
    - _Requirements: 20.1–20.3_

  - [ ] 11.4 Implement Cylindrical Frame generator in `StructureWizard.tsx`
    - Nodes at `(R·cos(2π·bay/nBays), floor·H/nStories, R·sin(2π·bay/nBays))`; columns + circumferential beams (parametric: radius, height, nBays ≥ 3, nStories ≥ 1)
    - _Requirements: 20.4, 20.6_

  - [ ] 11.5 Implement Spherical Surface generator in `StructureWizard.tsx`
    - Nodes at spherical coordinates; meridional + parallel members (parametric: radius, nMeridional ≥ 3, nParallel ≥ 3)
    - _Requirements: 20.5, 20.6_

  - [ ]* 11.6 Write property test for wizard member reference validity (Property 14)
    - **Property 14: Structure Wizard generates valid member references**
    - **Validates: Requirements 20.3, 20.6**

- [ ] 12. Implement Built-Up Section tool in SectionDesignerDialog.tsx
  - [ ] 12.1 Add "Built-Up Section" mode tab/toggle to `SectionDesignerDialog.tsx`
    - Component list with add/remove; shape type selector + dimension inputs per component; centroid offset (X, Y) inputs; 2D outline preview canvas
    - _Requirements: 21.1, 21.2, 21.4_

  - [ ] 12.2 Implement `computeBuiltUpProperties` utility function
    - Parallel axis theorem: combined centroid, Ixx_total, Iyy_total, Ixy_total, section moduli
    - _Requirements: 21.3_

  - [ ]* 12.3 Write property test for parallel axis theorem (Property 15)
    - **Property 15: Built-up section parallel axis theorem**
    - **Validates: Requirements 21.3**

  - [ ] 12.4 Implement `shapesOverlap` SAT-based overlap detection
    - Compute outline polygon for each component; run Separating Axis Theorem on convex hulls; highlight overlapping shapes in red in preview; show warning message
    - _Requirements: 21.6_

  - [ ]* 12.5 Write property test for overlap detection (Property 16)
    - **Property 16: Built-up section overlap detection**
    - **Validates: Requirements 21.6**

  - [ ] 12.6 Wire save action: add completed `BuiltUpSectionDef` to project section library and make available via `ASSIGN_SECTION`
    - _Requirements: 21.5_

- [ ] 13. Add additional design codes to structural-ui.config.ts
  - Add steel codes: `GB50017`, `BS5950`, `AIJ`, `SNIP`, `AASHTO_LRFD`, `AA_ADM1`
  - Add concrete codes: `CSA_A23`, `SP52101`, `IS13920`
  - Add new `timber` category with `EC5`
  - Add optional `beta?: boolean` flag to the code entry type; render "Beta" badge in Design Codes dialog for entries with `beta: true`
  - _Requirements: 22.1–22.3_

  - [ ]* 13.1 Write property test for design codes presence (Property 17)
    - **Property 17: All required design codes are present in DESIGN_CODES**
    - **Validates: Requirements 22.1, 22.2, 22.3**

- [ ] 14. Final checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for a faster MVP
- Each task references specific requirements for traceability
- Property tests use `fast-check` with a minimum of 100 iterations per property
- Tag format for property tests: `Feature: staad-pro-modeling-tools, Property {N}: {property_text}`
- The analysis guard (task 3) must be in place before any result-dependent panel is wired
- `steadyStateDialog` and `snowLoadDialog` already exist in `uiStore.ts` — verify before adding duplicates
