# Implementation Plan

- [x] 1. Write bug condition exploration test
  - **Property 1: Bug Condition** - Architectural Incoherence (Zone Mixing, No Spine, Wet Isolation, NBC Violations, No Entrance Sequence)
  - **CRITICAL**: This test MUST FAIL on unfixed code — failure confirms the bug exists
  - **DO NOT attempt to fix the test or the code when it fails**
  - **NOTE**: This test encodes the expected behavior — it will validate the fix when it passes after implementation
  - **GOAL**: Surface counterexamples that demonstrate the bug exists
  - **Scoped PBT Approach**: Scope the property to the concrete failing case — a standard 3BHK program (living + dining + kitchen + 2 bedrooms + 2 bathrooms + corridor + foyer) on a 10m × 8m south-facing plot
  - Create test file at `apps/web/src/services/space-planning/__tests__/architecturalPlacement.bugcondition.test.ts`
  - Use `fast-check` to generate variations of the 3BHK program (randomise room counts 1–3 bedrooms, 1–2 bathrooms, always include living + kitchen)
  - For each generated plan, call `generateFloorPlan()` on the UNFIXED engine and assert ALL of the following (each assertion is expected to fail):
    - Zone separation: `min(bedroom.y) > max(living.y + living.height)` for south-facing plot (bedrooms must be farther from entrance than living room) — from `isBugCondition.hasPublicPrivateMixing`
    - Circulation spine: a corridor room exists with `width >= 1.0` AND every habitable room shares a wall with the corridor — from `isBugCondition.missingCirculationSpine`
    - Wet area grouping: kitchen and at least one bathroom share a wall (computed via `computeSharedWallLength`) — from `isBugCondition.wetAreasIsolated`
    - NBC dimensions: every bedroom has `width >= 2.7` and every kitchen has `width >= 2.1` — from `isBugCondition.dimensionViolation`
    - Entrance sequence: foyer (if present) has smallest y, then living, then corridor, then bedrooms — from `isBugCondition.noEntranceSequence`
  - Run test on UNFIXED code
  - **EXPECTED OUTCOME**: Test FAILS (this is correct — it proves the bug exists)
  - Document counterexamples found (e.g., "bedroom at y=0, living at y=5", "corridor width=0.8m", "kitchen at x=0, bathroom at x=8 — no shared wall", "bedroom.width=2.4m < 2.7m NBC min")
  - Mark task complete when test is written, run, and failure is documented
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5_

- [x] 2. Write preservation property tests (BEFORE implementing fix)
  - **Property 2: Preservation** - Geometric Correctness, FAR/GSI Compliance, MEP Coordinates, Serialization Round-Trip
  - **IMPORTANT**: Follow observation-first methodology
  - Create test file at `apps/web/src/services/space-planning/__tests__/architecturalPlacement.preservation.test.ts`
  - Observe behavior on UNFIXED code for non-buggy inputs (single-room plans, plans with no wet areas, plans with no bedrooms)
  - Use `fast-check` to generate random plot sizes (5–20m × 5–20m), random setback combinations (0.5–2m), and single-room programs
  - Write property-based tests capturing observed behavior patterns from Preservation Requirements:
    - Boundary preservation: for all generated plans, every `PlacedRoom` satisfies `room.x >= setback.left`, `room.y >= setback.front`, `room.x + room.width <= plot.width - setback.right`, `room.y + room.height <= plot.depth - setback.rear` — from Requirement 3.1
    - Overlap preservation: `overlapCount === 0` (or same as before fix) for all generated plans — from Requirement 3.2
    - FAR/GSI compliance: non-essential rooms are dropped when total area exceeds per-floor budget; essential rooms always included — from Requirements 3.6, 3.7
    - Serialization round-trip: serialize and deserialize a generated plan, verify all `PlacedRoom` coordinates are identical — from Requirement 3.8
    - Floor filtering: `generateFloorPlan(floor=1)` only places rooms assigned to floor 1; parking auto-injected only on floor 0 — from Requirement 3.9
    - `computeAdjacencyScore()` remains non-zero when adjacency rules are satisfied — from Requirement 3.10
  - Verify all tests PASS on UNFIXED code before implementing the fix
  - **EXPECTED OUTCOME**: Tests PASS (this confirms baseline behavior to preserve)
  - Mark task complete when tests are written, run, and passing on unfixed code
  - _Requirements: 3.1, 3.2, 3.6, 3.7, 3.8, 3.9, 3.10_

- [x] 3. Implement architectural placement pipeline in SpacePlanningEngine.ts

  - [x] 3.1 Add `NBC_MIN_DIMS` constant and `ArchitecturalZone` enum
    - Add `NBC_MIN_DIMS` constant above the class definition in `SpacePlanningEngine.ts` (rename/replace `MIN_CLEAR_DIM` with corrected values): `living: { w: 3.0, h: 3.0 }`, `drawing_room: { w: 3.0, h: 3.0 }`, `dining: { w: 3.0, h: 3.0 }`, `master_bedroom: { w: 3.0, h: 3.0 }`, `bedroom: { w: 2.7, h: 2.7 }`, `kitchen: { w: 2.1, h: 1.8 }`, `bathroom: { w: 1.2, h: 0.9 }`, `toilet: { w: 1.0, h: 0.9 }`, `corridor: { w: 1.0, h: 1.0 }`, `staircase: { w: 1.0, h: 1.0 }`, `foyer: { w: 1.5, h: 1.5 }`, `entrance_lobby: { w: 1.5, h: 1.5 }`
    - Add `ArchitecturalZone` enum: `PUBLIC | PRIVATE | SERVICE | CIRCULATION`
    - _Bug_Condition: isBugCondition.dimensionViolation — room.width < NBC_MIN_DIMS[type].w_
    - _Requirements: 2.4_

  - [x] 3.2 Add `ROOM_ZONE_MAP` constant and `PlacementContext` interface
    - Add `ROOM_ZONE_MAP: Partial<Record<RoomType, ArchitecturalZone>>` mapping all 35+ room types to their zone (living/dining/drawing_room/foyer/entrance_lobby/study → PUBLIC; master_bedroom/bedroom/bathroom/toilet/dressing/walk_in_closet/guest_room/childrens_room → PRIVATE; kitchen/utility/laundry/store/garage/parking/pantry/servants_quarter → SERVICE; corridor/staircase/lift → CIRCULATION)
    - Add `PlacementContext` interface: `{ corridorZone: { x, y, w, h }; entranceSide: 'N'|'S'|'E'|'W'; placedByZone: Map<ArchitecturalZone, PlacedRoom[]>; wetWallX: number | null; wetWallY: number | null }`
    - _Requirements: 2.1, 2.2_

  - [x] 3.3 Implement `classifyRoomZone()` and `enforceNBCMinDimensions()` private methods
    - `classifyRoomZone(type: RoomType): ArchitecturalZone` — looks up `ROOM_ZONE_MAP[type]`, defaults to `PRIVATE` for unknown types; replaces existing `getRoomZone()` private method
    - `enforceNBCMinDimensions(type: RoomType, w: number, h: number, area: number): { w: number; h: number }` — looks up `NBC_MIN_DIMS[type]`; if `w < minW` sets `w = minW` and recomputes `h = max(minH, area / w)`; if `h < minH` sets `h = minH` and recomputes `w = max(minW, area / h)`; applies `snapToGrid()` to both dimensions
    - _Bug_Condition: isBugCondition.dimensionViolation — enforces NBC_MIN_DIMS before aspect-ratio calculation_
    - _Expected_Behavior: room.width >= NBC_MIN_DIMS[type].w AND room.height >= NBC_MIN_DIMS[type].h_
    - _Requirements: 2.4_

  - [x] 3.4 Implement `buildCirculationSpine()` private method
    - `buildCirculationSpine(ox, oy, envW, envH, entranceSide): { corridorZone, corridorRoom }` — computes corridor position along central axis of buildable envelope; corridor width = `max(NBC_MIN_DIMS.corridor.w, 1.2)` = 1.2m; for N/S entry: corridor runs horizontally at `y = oy + floor(envH * 0.45)`; for E/W entry: corridor runs vertically at `x = ox + floor(envW * 0.45)`; returns corridor zone rectangle and a `PlacedRoom` for the corridor
    - _Bug_Condition: isBugCondition.missingCirculationSpine — corridor placed as first room, not residual_
    - _Expected_Behavior: corridor.width >= 1.0 AND all habitable rooms touch corridor_
    - _Requirements: 2.2, 2.9_

  - [x] 3.5 Implement `placePublicZone()` private method
    - `placePublicZone(specs, corridorZone, entranceSide, context): PlacedRoom[]` — receives only PUBLIC-zone specs (living, dining, drawing, foyer, study); places foyer first at entrance boundary (road-facing side of corridor zone); places living room adjacent to foyer; packs remaining public rooms left-to-right in entrance-side half of buildable envelope; each room sized using `enforceNBCMinDimensions()` before placement; applies vastu quadrant preference as tie-breaker (NE for living/study, N for drawing_room)
    - _Bug_Condition: isBugCondition.hasPublicPrivateMixing AND isBugCondition.noEntranceSequence_
    - _Expected_Behavior: foyer at entrance boundary → living adjacent to foyer → corridor separates public from private_
    - _Requirements: 2.1, 2.5_

  - [x] 3.6 Implement `placeWetAreas()` private method
    - `placeWetAreas(specs, context): PlacedRoom[]` — receives kitchen + bathroom + toilet + utility + laundry specs; determines shared plumbing wall (internal wall adjacent to corridor on service side); places kitchen first on SE quadrant wall (vastu preference), then bathrooms/toilets adjacent to kitchen on same wall; sets `context.wetWallX` or `context.wetWallY` after placing first wet room; each subsequent wet room placed touching same wall coordinate
    - _Bug_Condition: isBugCondition.wetAreasIsolated — wet rooms placed on shared plumbing wall_
    - _Expected_Behavior: all wet rooms share a wall with at least one other wet room_
    - _Requirements: 2.3_

  - [x] 3.7 Implement `placePrivateZone()` private method
    - `placePrivateZone(specs, corridorZone, context): PlacedRoom[]` — receives PRIVATE-zone specs (bedrooms, dressing, walk-in-closet); places all rooms in rear half of buildable envelope (opposite entrance side); each room must have at least one wall touching corridor zone; master bedroom placed in SW quadrant (vastu preference); each room sized using `enforceNBCMinDimensions()`
    - _Bug_Condition: isBugCondition.hasPublicPrivateMixing — bedrooms placed at rear, not entrance side_
    - _Expected_Behavior: distanceFromEntrance(bedroom) > distanceFromEntrance(living) for all bedrooms_
    - _Requirements: 2.1_

  - [x] 3.8 Implement `autoInjectMandatoryRooms()` private method
    - `autoInjectMandatoryRooms(specs: RoomSpec[], plot: PlotDimensions): RoomSpec[]` — checks for NBC Part 4 mandatory elements: at least one habitable room, one kitchen, one toilet/bathroom; if missing, injects a minimal spec at `NBC_MIN_DIMS` dimensions; records each injection as a `ConstraintViolationRecord` with `severity: 'info'` in `FloorPlan.constraintViolations`
    - _Requirements: 2.8_

  - [x] 3.9 Implement `validateEntranceSequence()` private method
    - `validateEntranceSequence(rooms: PlacedRoom[], entranceSide: CardinalDirection): boolean` — computes `distanceFromEntrance(room)` for each room as the coordinate on the entrance axis; returns true iff all bedrooms have greater distance from entrance than the living room, and the foyer (if present) has the smallest distance
    - _Requirements: 2.5_

  - [x] 3.10 Implement `architecturalPlacement()` orchestrator method
    - `architecturalPlacement(rooms, envW, envH, setbacks, orientation, preferences): PlacedRoom[]` — orchestrates the full pipeline in order: (1) `buildCirculationSpine()`, (2) `placePublicZone()`, (3) `placeWetAreas()`, (4) `placePrivateZone()`, (5) pack remaining SERVICE rooms, (6) `resolveOverlaps()` (existing, unchanged)
    - _Bug_Condition: isBugCondition(X) — all five defects addressed by this pipeline_
    - _Expected_Behavior: zone separation + circulation spine + wet grouping + NBC dims + entrance sequence_
    - _Preservation: resolveOverlaps() called unchanged; boundary enforcement preserved_
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.9_

  - [x] 3.11 Modify `generateFloorPlan()` to call `architecturalPlacement()` instead of `placeRooms()`
    - Add `autoInjectMandatoryRooms()` call before placement (after FAR/coverage enforcement)
    - Replace `this.placeRooms(...)` call with `this.architecturalPlacement(...)`
    - Keep `placeRooms()` private method intact (do not delete) — used as fallback for single-room plans and referenced by existing tests
    - All other logic (FAR, coverage, walls, doors/windows, MEP, corridors) remains unchanged
    - _Preservation: FAR/GSI trimming, ground coverage scaling, MEP coordinate derivation, wall generation all unchanged_
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.8, 2.9, 3.1, 3.2, 3.6, 3.7_

  - [x] 3.12 Verify bug condition exploration test now passes
    - **Property 1: Expected Behavior** - Architectural Coherence (Zone Separation, Circulation Spine, Wet Grouping, NBC Dims, Entrance Sequence)
    - **IMPORTANT**: Re-run the SAME test from task 1 — do NOT write a new test
    - The test from task 1 encodes the expected behavior
    - When this test passes, it confirms the expected behavior is satisfied
    - Run bug condition exploration test from step 1 (`architecturalPlacement.bugcondition.test.ts`)
    - **EXPECTED OUTCOME**: Test PASSES (confirms bug is fixed)
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5_

  - [x] 3.13 Verify preservation tests still pass
    - **Property 2: Preservation** - Geometric Correctness, FAR/GSI, MEP, Serialization
    - **IMPORTANT**: Re-run the SAME tests from task 2 — do NOT write new tests
    - Run preservation property tests from step 2 (`architecturalPlacement.preservation.test.ts`)
    - **EXPECTED OUTCOME**: Tests PASS (confirms no regressions)
    - Confirm all tests still pass after fix (no regressions)

- [x] 4. Write fix-checking tests (expected to PASS after fix)
  - Create test file at `apps/web/src/services/space-planning/__tests__/architecturalPlacement.fixcheck.test.ts`
  - Unit tests for new private methods (exposed via a test-only accessor or tested through `generateFloorPlan()`):
    - `enforceNBCMinDimensions()`: for each room type with dimensions below NBC minimum, verify output satisfies `w >= NBC_MIN_DIMS[type].w` and `h >= NBC_MIN_DIMS[type].h`
    - `buildCirculationSpine()`: for N/S/E/W entry directions, verify corridor position is within buildable envelope and `corridorRoom.width >= 1.0`
    - `autoInjectMandatoryRooms()`: with room list missing kitchen, toilet, and habitable room — verify all three are injected and `constraintViolations` contains three entries with `severity: 'info'`
    - `validateEntranceSequence()`: correctly ordered plan returns `true`; mixed plan (bedroom closer to entrance than living) returns `false`
    - `classifyRoomZone()`: spot-check all 35+ room types for correct zone assignment
  - Integration tests:
    - Full 3BHK plan (living + dining + kitchen + master bedroom + 2 bedrooms + 2 bathrooms + corridor + foyer) on 12m × 10m south-facing plot — verify all five correctness properties (zone separation, spine, wet grouping, NBC dims, entrance sequence)
    - Full plan with vastu compliance enabled — verify kitchen placed in SE quadrant, master bedroom in SW quadrant
    - Multi-floor plan (ground + first floor) — verify ground floor has parking auto-injected, first floor has bedrooms, FAR/GSI constraints respected on both floors
    - Plan with missing mandatory rooms — verify auto-injection records `ConstraintViolationRecord` with `severity: 'info'`
  - Property-based tests using `fast-check`:
    - Generate random `RoomSpec[]` (1–10 rooms, random types) — verify every placed room satisfies `width >= NBC_MIN_DIMS[type].w` after fix
    - Generate random plot dimensions (5–20m × 5–20m) — verify corridor zone is always within buildable envelope
    - Generate random plans with wet areas — verify wet rooms always share a wall (or geometric impossibility flag is set)
    - Generate random plans — verify `computeAdjacencyScore()` remains a contributing factor (score non-zero when adjacency rules satisfied)
  - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.8, 2.9_

- [x] 5. Checkpoint — Ensure all tests pass
  - Run the full test suite for the space-planning module: `npx vitest --run apps/web/src/services/space-planning`
  - Confirm `architecturalPlacement.bugcondition.test.ts` PASSES (bug is fixed)
  - Confirm `architecturalPlacement.preservation.test.ts` PASSES (no regressions)
  - Confirm `architecturalPlacement.fixcheck.test.ts` PASSES (fix-checking tests pass)
  - Confirm all pre-existing tests still pass: `clampToEnvelope.test.ts`, `snapColumnsToRoomCorners.test.ts`, `projectSerializer.test.ts`
  - Ensure all tests pass; ask the user if questions arise
