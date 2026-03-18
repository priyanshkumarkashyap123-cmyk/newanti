# Implementation Plan: Space Planning Accuracy and Tools

## Overview

Implements three interconnected improvements: (1) space planning engine accuracy fixes and elevation upgrades, (2) multi-objective optimization dashboard, and (3) structural detailing center with batch design and report generation. Implementation follows a bottom-up order: types → engine utilities → API service fix → page merge fix → elevation builders → serialization → optimization dashboard → detailing page → new components → tests.

## Tasks

- [x] 1. Extend type definitions in `types.ts`
  - Add `boundaryViolationCount: number`, `overlapCount: number`, and `constraintViolations: ConstraintViolationRecord[]` fields to the `FloorPlan` interface
  - Add `gridAlignmentScore: number` field to the `StructuralPlan` interface
  - Add new `ConstraintViolationRecord` interface with fields: `type`, `roomId`, `message`, `severity`
  - _Requirements: 1.6, 3.5_

- [x] 2. Implement core engine utility functions in `SpacePlanningEngine.ts`
  - [x] 2.1 Implement `clampToEnvelope(room, setbacks, plot)`
    - Returns `{ room: PlacedRoom; corrected: boolean; deltaX: number; deltaY: number }`
    - Clamps `room.x` to `[setbacks.left, plot.width - setbacks.right - room.width]`
    - Clamps `room.y` to `[setbacks.front, plot.depth - setbacks.rear - room.height]`
    - Logs a console warning in dev mode when `corrected === true`
    - _Requirements: 1.1, 1.2_

  - [ ]* 2.2 Write property test for `clampToEnvelope` — Property 1: Boundary Invariant After Clamp
    - **Property 1: Boundary Invariant After Clamp**
    - **Validates: Requirements 1.1, 1.2**
    - File: `apps/web/src/services/space-planning/__tests__/clampToEnvelope.test.ts`
    - Also add unit tests: room exactly at boundary (no correction), room entirely outside plot

  - [x] 2.3 Implement `detectOverlaps(rooms)` and `resolveOverlaps(rooms, setbacks, plot, maxPasses?)`
    - `detectOverlaps`: returns pairs with `overlapArea > 0.01 m²`, sorted by penetration depth descending
    - `resolveOverlaps`: translates lower-priority room along axis of minimum penetration; priority order: essential > important > desirable > optional; mutates in place; returns count of resolved overlaps; default `maxPasses = 10`
    - _Requirements: 1.4, 1.5_

  - [ ]* 2.4 Write property test for `resolveOverlaps` — Property 2: No-Overlap Invariant After Resolution
    - **Property 2: No-Overlap Invariant After Resolution**
    - **Validates: Requirements 1.4, 1.5**
    - File: `apps/web/src/services/space-planning/__tests__/resolveOverlaps.test.ts`
    - Also add unit tests: two rooms touching at edge (area = 0, not an overlap), three-way overlap

  - [x] 2.5 Implement `computeAdjacencyScore(candidate, spec, placedRooms)`
    - Score = Σ shared-wall-length with `adjacentTo` rooms − Σ shared-wall-length with `awayFrom` rooms
    - Returns 0 when `spec.adjacentTo` is missing or empty
    - _Requirements: 2.1, 2.2_

  - [x] 2.6 Implement `snapColumnsToRoomCorners(columns, rooms, tolerance?)` and `computeGridAlignmentScore(columns, rooms, tolerance?)`
    - `snapColumnsToRoomCorners`: snaps each column to nearest room corner within `tolerance` (default 0.15 m); returns updated columns without mutating input
    - `computeGridAlignmentScore`: returns 0–100 as percentage of room corners with a column within tolerance
    - _Requirements: 3.1, 3.5_

  - [ ]* 2.7 Write property tests for column snap — Properties 5 and 6
    - **Property 5: Column Snap Tolerance** — every column within 0.15 m of at least one room corner after snap
    - **Property 6: Grid Alignment Score Bounds** — score in [0, 100]; equals 100 when all corners covered
    - **Validates: Requirements 3.1, 3.5**
    - File: `apps/web/src/services/space-planning/__tests__/snapColumnsToRoomCorners.test.ts`

  - [x] 2.8 Implement `recomputeMEPAfterMerge(project, mergedFloorPlan)`
    - Regenerates electrical, plumbing, and HVAC plans using updated room positions in `mergedFloorPlan`
    - All fixture `x`/`y` coordinates computed as offsets from the corresponding `PlacedRoom`'s origin
    - Validates every fixture satisfies containment bounds; logs warning for any that fail
    - Returns `{ electrical: ElectricalPlan; plumbing: PlumbingPlan; hvac: HVACPlan }`
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5_

  - [ ]* 2.9 Write property test for `recomputeMEPAfterMerge` — Property 3: MEP Containment Invariant
    - **Property 3: MEP Containment Invariant**
    - **Validates: Requirements 4.1, 4.2, 4.3, 4.4, 4.5**
    - File: `apps/web/src/services/space-planning/__tests__/recomputeMEP.test.ts`

- [x] 3. Update `generateStructuralPlan` in `SpacePlanningEngine.ts`
  - Call `snapColumnsToRoomCorners` after initial column placement
  - Ensure no column is placed inside the clear interior of any `PlacedRoom`
  - Insert intermediate columns at wall midpoints when wall does not align within 0.3 m of any grid line and resulting spans remain within `MAX_SPAN`
  - Set `structural.gridAlignmentScore` using `computeGridAlignmentScore`
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_

- [x] 4. Add `validateAndClampSolverPlacements` to `layoutApiService.ts`
  - Adds `setbacks.left` to `x` and `setbacks.front` to `y` for each placement
  - Clamps to ensure room fits within `plot.width - setbacks.right` and `plot.depth - setbacks.rear`
  - Sets internal `_wasClamped`, `_clampDeltaX`, `_clampDeltaY` markers on each placement
  - Logs a warning for any room that required clamping
  - Export the function; must be called before `placementsToPlacedRooms()`
  - _Requirements: 1.1, 1.2_

  - [ ]* 4.1 Write unit tests for `validateAndClampSolverPlacements`
    - Test: solver room at (0,0) gets offset by setbacks
    - Test: room that exceeds plot boundary gets clamped and `_wasClamped = true`
    - File: `apps/web/src/services/space-planning/__tests__/validateAndClampSolverPlacements.test.ts`

- [x] 5. Fix solver merge sequence in `SpacePlanningPage.tsx`
  - Update `handleGenerate`, `handleGenerateVariants`, `handleSelectVariant`, and `handleSelectCandidate` to follow the correct 5-step merge order:
    1. Call `validateAndClampSolverPlacements(placements, setbacks, plot)` → `clampedPlacements`
    2. Call `placementsToPlacedRooms(clampedPlacements, roomSpecs)` → `optimizedRooms`
    3. Merge `optimizedRooms` into `basePlan.rooms` by matching `id` or `spec.type`
    4. Call `resolveOverlaps(resolvedRooms, setbacks, plot)` → set `overlapCount`
    5. Call `recomputeMEPAfterMerge(result, mergedFloorPlan)` → update `result.electrical/plumbing/hvac`
  - Set `boundaryViolationCount` from `clampedPlacements.filter(p => p._wasClamped).length`
  - _Requirements: 1.1, 1.2, 1.4, 1.5, 1.6, 4.4_

- [x] 6. Implement elevation builder functions in `SpacePlanningEngine.ts`
  - [x] 6.1 Implement `buildFrontElevation(floorPlans, structural, plot, setbacks)`
    - Collects rooms whose front face (`y === setbacks.front`) is visible per floor
    - Draws wall outline polygon, window/door openings (gaps in wall polygon), slab lines at each floor level
    - Adds dimension lines: total width, per-room widths, floor-to-floor height, total building height
    - Adds north arrow (`TextLabel` "N") and scale bar (`DimensionLine` spanning 1 m labelled "1m")
    - Returns `ElevationView`
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.6_

  - [x] 6.2 Implement `buildRearElevation`, `buildLeftElevation`, `buildRightElevation`
    - Rear: mirror of front along plot depth axis
    - Left: X axis = plot depth, Y axis = building height
    - Right: mirror of left
    - Each includes north arrow and scale bar
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.6_

  - [x] 6.3 Implement `buildSectionAA(floorPlans, structural, sectionLine, plot)` and `buildSectionBB`
    - Section A-A: vertical cut along horizontal line at `y = sectionLine.startY`; shows rooms in cross-section with slab thickness, beam depth, floor-to-floor height labelled
    - Section B-B: vertical cut along vertical line at `x = sectionLine.startX`
    - _Requirements: 5.5, 5.6_

  - [x] 6.4 Update `generateCompletePlan` to call new elevation builders
    - Replace existing placeholder `generateElevation()` calls with calls to `buildFrontElevation`, `buildRearElevation`, `buildLeftElevation`, `buildRightElevation`, `buildSectionAA`, `buildSectionBB`
    - Add null-safe guard in `ElevationSectionViewer.tsx` when `allPoints` is empty
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6_

  - [ ]* 6.5 Write unit tests for elevation builders — Properties 7 and 8
    - **Property 7: Elevation Width Matches Plot** — total horizontal span equals buildable width
    - **Property 8: Elevation Contains North Arrow and Scale Bar** — labels contain "N", dimensions contain metre label
    - **Validates: Requirements 5.1, 5.6**
    - File: `apps/web/src/services/space-planning/__tests__/buildElevation.test.ts`
    - Also add unit test: single-floor plan produces correct wall polygon points

- [x] 7. Checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 8. Create `projectSerializer.ts`
  - Create `apps/web/src/services/space-planning/projectSerializer.ts`
  - Implement `serializeProject(project: HousePlanProject): string` using `JSON.stringify`
  - Implement `deserializeProject(json: string): HousePlanProject | { error: string }` with `dateReviver` and `validateProjectShape`
  - `dateReviver`: revives ISO date strings matching `/^\d{4}-\d{2}-\d{2}T/` back to `Date` objects
  - `validateProjectShape`: checks for `id` (string), `floorPlans` (array), `plot` (object), `structural` (object)
  - Returns `{ error: '...' }` for malformed JSON or missing required fields
  - _Requirements: 14.1, 14.2, 14.3, 14.4, 14.5_

  - [ ]* 8.1 Write property test for `projectSerializer` — Property 19: Round-Trip Serialization Preserves Coordinates
    - **Property 19: Round-Trip Serialization Preserves Coordinates**
    - **Validates: Requirements 14.1, 14.2, 14.3, 14.4**
    - File: `apps/web/src/services/space-planning/__tests__/projectSerializer.test.ts`
    - Also add unit tests: malformed JSON returns `{ error: ... }`, missing `floorPlans` returns `{ error: ... }`

- [x] 9. Implement optimization dashboard pure functions
  - [x] 9.1 Implement `computeParetoFront(candidates, objectives)` in `SensitivityOptimizationDashboard.tsx`
    - Non-dominated sorting: point `p` dominates `q` if at least as good on all objectives and strictly better on one
    - Objectives: `weight` (minimize), `displacement` (minimize), `cost` (minimize), `stiffness` (maximize)
    - Sets `dominated: true` on dominated points; returns only non-dominated points
    - Returns empty array when no feasible solutions exist
    - _Requirements: 6.1, 6.4_

  - [ ]* 9.2 Write property test for `computeParetoFront` — Property 9: Pareto Non-Domination
    - **Property 9: Pareto Non-Domination**
    - **Validates: Requirements 6.1**
    - File: `apps/web/src/components/design/__tests__/computeParetoFront.test.ts`

  - [x] 9.3 Implement `evaluateObjective(sectionAssignments, objective, members, analysisResults, nodes)`
    - Returns `Infinity` when `analysisResults` is null (point excluded from Pareto front)
    - Supports objective types: weight, displacement, cost, stiffness
    - _Requirements: 6.1, 6.4_

  - [x] 9.4 Implement `runParameterStudy(config, variables, members, analysisResults, nodes)`
    - 1D: evaluates at each step value of `variable1`; returns results sorted by `v1Value`
    - 2D: evaluates at each combination of `variable1 × variable2`; returns sorted by `v1Value` then `v2Value`
    - Throws `RangeError('steps must be >= 2')` when steps < 2
    - Marks entry with lowest `objectiveValue` as `isMinimum = true`
    - _Requirements: 8.1, 8.2, 8.3, 8.5_

  - [ ]* 9.5 Write property tests for `runParameterStudy` — Properties 12 and 13
    - **Property 12: Parameter Study Completeness** — returns exactly `n1 × n2` results
    - **Property 13: Parameter Study Minimum Correctness** — `isMinimum` entry has lowest `objectiveValue`
    - **Validates: Requirements 8.2, 8.3, 8.5**
    - File: `apps/web/src/components/design/__tests__/runParameterStudy.test.ts`

  - [x] 9.6 Implement `applyOptimizedSections(optimizedAssignments, updateMember, members)`
    - Updates `sectionId` of each affected member via `updateMember`
    - Returns `previousAssignments` map for undo support
    - _Requirements: 9.2, 9.4_

  - [ ]* 9.7 Write property test for `applyOptimizedSections` — Property 14: Apply-Then-Revert Round Trip
    - **Property 14: Apply-Then-Revert Round Trip**
    - **Validates: Requirements 9.2, 9.4**
    - File: `apps/web/src/components/design/__tests__/applyOptimizedSections.test.ts`

  - [x] 9.8 Implement `isConverged(history, tolerance)` convergence detection
    - Returns `false` when `history.length < 10`
    - Returns `true` when `(max(last10) - min(last10)) / max(|min(last10)|, 1e-10) < tolerance`
    - _Requirements: 7.3_

  - [ ]* 9.9 Write unit tests for convergence detection — Property 11
    - **Property 11: Convergence Indicator Correctness**
    - **Validates: Requirements 7.3**
    - File: `apps/web/src/components/design/__tests__/convergenceDetection.test.ts`
    - Unit tests: 10 identical values → converged; large variance → not converged; length < 10 → not converged

- [x] 10. Create new visualization components
  - [x] 10.1 Create `apps/web/src/components/design/ParetoScatterPlot.tsx`
    - Props: `points`, `xAxis`, `yAxis`, `selectedPointId`, `onPointClick`, `width?`, `height?`
    - SVG scatter plot: Pareto-optimal points as filled circles, dominated as hollow
    - Axes labelled with units; clicking a point calls `onPointClick`
    - Labels each point with weight (kg) and displacement (mm) per Requirement 6.5
    - _Requirements: 6.2, 6.3, 6.5_

  - [x] 10.2 Create `apps/web/src/components/design/ConvergenceChart.tsx`
    - Props: `history`, `convergenceTolerance`, `isRunning`, `width?`, `height?`
    - SVG line chart; updates via `requestAnimationFrame` when `isRunning` is true
    - Horizontal dashed line at best value; annotates final value when `isRunning` is false
    - _Requirements: 7.1, 7.2_

  - [x] 10.3 Create `apps/web/src/components/design/ParameterStudyPanel.tsx`
    - Props: `variables`, `members`, `analysisResults`, `nodes`, `onResultsReady`
    - Variable selector dropdowns, lower/upper bound inputs, step count input, "Run Study" button
    - Renders 1D SVG line chart or 2D SVG heat map depending on variable count
    - Highlights minimum point on chart; displays corresponding variable values
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5_

- [x] 11. Wire optimization dashboard state and UI in `SensitivityOptimizationDashboard.tsx`
  - Add state: `paretoFront`, `allCandidates`, `selectedParetoPointId`, `convergenceHistory`, `paramStudyResults`, `paramStudyConfig`, `optimizedAssignments`, `previousAssignments`, `sectionsApplied`, `paretoObjectiveX`, `paretoObjectiveY`
  - Update `runOptimization` to populate `convergenceHistory` (update every 5 iterations) and `allCandidates`; call `computeParetoFront` on completion
  - Integrate `ParetoScatterPlot` in optimization tab; wire `onPointClick` to highlight section assignments in design variables panel
  - Integrate `ConvergenceChart` showing real-time updates; display function evaluation count and elapsed time on completion
  - Integrate `ParameterStudyPanel` in parameter study tab; wire `onResultsReady` to `setParamStudyResults`
  - Add "Apply to Model" button (enabled only when assignments differ from current model); call `applyOptimizedSections` and emit model-change event
  - Add "Revert" button that calls `applyOptimizedSections` with `previousAssignments`; display member update count and weight change summary
  - Show "No feasible solutions — try relaxing constraints" when `paretoFront` is empty
  - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 7.1, 7.2, 7.3, 7.4, 8.1, 8.2, 8.3, 8.4, 8.5, 9.1, 9.2, 9.3, 9.4, 9.5_

- [x] 12. Checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 13. Implement detailing page functions
  - [x] 13.1 Implement `runBatchDesign(members, analysisResults, nodes, sections)`
    - Runs IS 456 / IS 800 code checks on all members using maximum force envelope
    - Members with missing section data marked as `'skipped'` with `skipReason`
    - Members with missing analysis forces marked as `'skipped'` with `skipReason: 'No analysis forces'`
    - Returns `MemberDesignResult[]` with length equal to `members.size`
    - Performance target: ≤ 5 seconds for 200 members
    - _Requirements: 11.1, 11.2, 11.5_

  - [ ]* 13.2 Write property test for `runBatchDesign` — Property 15: Batch Design Completeness
    - **Property 15: Batch Design Completeness**
    - **Validates: Requirements 10.1, 11.1**
    - File: `apps/web/src/components/design/__tests__/runBatchDesign.test.ts`

  - [x] 13.3 Implement `computeDesignSummary(results)`
    - Returns `{ total, pass, fail, skipped, passRate }`
    - `passRate = (pass / total) * 100`
    - _Requirements: 10.4_

  - [ ]* 13.4 Write unit tests for `computeDesignSummary` — Property 16: Design Summary Correctness
    - **Property 16: Design Summary Correctness** — `pass + fail + skipped === total`, `passRate` formula
    - **Validates: Requirements 10.4**
    - File: `apps/web/src/components/design/__tests__/computeDesignSummary.test.ts`
    - Unit tests: all-pass, all-fail, mixed results

  - [x] 13.5 Implement `generateReinforcementSVG(result, projectName)`
    - Returns complete SVG string (not a React element)
    - SVG contents: rectangular cross-section outline, cover dimension lines (dashed), bar circles at correct positions, stirrup rectangle, bar diameter and spacing labels, title block (member ID, section, code, date)
    - Returns minimal error SVG with error message in `<text>` element on failure
    - _Requirements: 12.2, 12.3_

  - [ ]* 13.6 Write property test for `generateReinforcementSVG` — Property 17
    - **Property 17: Reinforcement SVG Contains Required Elements** — at least one `<circle>`, one `<rect>`, title block with `memberId`
    - **Validates: Requirements 12.2, 12.3**
    - File: `apps/web/src/components/design/__tests__/generateReinforcementSVG.test.ts`
    - Also add unit test: beam with 3 bars produces 3 `<circle>` elements

  - [x] 13.7 Implement `generateDesignReportHTML(results, projectName, designCode)`
    - Self-contained HTML with inline CSS only — no `<link href=` to external URLs, no `<script src=`
    - Structure: cover (project name, date, design code), summary table (all members with utilization ratio and status), per-member calculation sheets (forces, section properties, code checks, governing load combination)
    - Returns minimal HTML error page on failure
    - _Requirements: 13.2, 13.3, 13.5_

  - [ ]* 13.8 Write property test for `generateDesignReportHTML` — Property 18
    - **Property 18: Design Report is Self-Contained HTML** — no external `<link>` or `<script src=`, contains `<table>`, contains project name
    - **Validates: Requirements 13.2, 13.5**
    - File: `apps/web/src/components/design/__tests__/generateDesignReportHTML.test.ts`

- [x] 14. Create new detailing components
  - [x] 14.1 Create `apps/web/src/components/design/MemberStatusTable.tsx`
    - Props: `results`, `selectedMemberId`, `onMemberClick`, `sortBy?`, `sortDir?`
    - Sortable table with columns: member ID, type, section, utilization ratio, pass/fail status
    - Row colour coding: green (≤ 0.85), amber (0.85–1.0), red (> 1.0), grey (skipped)
    - _Requirements: 10.1, 10.2, 10.3_

  - [x] 14.2 Create `apps/web/src/components/design/DesignSummaryBar.tsx`
    - Props: `summary`, `onBatchDesign`, `onGenerateReport`, `isBatchRunning`, `hasResults`
    - Displays total, pass, fail, skipped counts and pass rate percentage
    - "Auto-Design All Members" button (disabled when `isBatchRunning`)
    - "Generate Report" button (disabled when `!hasResults`)
    - _Requirements: 10.4, 11.1, 13.1_

- [x] 15. Wire detailing page state and UI in `DetailingDesignPage.tsx`
  - Add state: `batchResults`, `selectedMemberId`, `isBatchRunning`, `sortBy`, `sortDir`
  - Add `handleBatchDesign`: sets `isBatchRunning`, calls `runBatchDesign`, updates `batchResults`, shows toast with pass/fail counts
  - Add `handleMemberClick`: navigates to appropriate design tab (beam/column/steel) and pre-populates design inputs
  - Add `handleExportDrawing`: calls `generateReinforcementSVG`, triggers SVG file download; offers PDF via `window.print()` where File System Access API is supported
  - Add `handleGenerateReport`: calls `generateDesignReportHTML`, opens in new window, triggers `window.print()`
  - Replace static overview card grid with `DesignSummaryBar` + `MemberStatusTable` (or `NoAnalysisPrompt` when no analysis results)
  - Show "Export Drawing" button when RC design is complete; show "Generate Report" button when at least one member has been designed
  - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.5, 11.1, 11.2, 11.3, 11.4, 11.5, 12.1, 12.2, 12.3, 12.4, 12.5, 13.1, 13.2, 13.3, 13.4, 13.5_

- [x] 16. Final checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation at logical boundaries
- Property tests use **fast-check** (run `npm install --save-dev fast-check` if not already installed)
- Each property test must run a minimum of 100 iterations
- Tag format for each test: `// Feature: space-planning-accuracy-and-tools, Property N: <property text>`
- The `_wasClamped` marker on `PlacementResponse` is internal and must not be exported
