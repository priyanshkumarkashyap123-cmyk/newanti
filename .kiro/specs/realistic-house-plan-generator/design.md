# Realistic House Plan Generator Bugfix Design

## Overview

The `SpacePlanningEngine.generateFloorPlan()` method produces geometrically valid layouts (no overlaps, within setbacks) but architecturally incoherent ones. Rooms are distributed across the buildable envelope without a public/private zone separation, no circulation spine is established before room placement, wet areas are not grouped on shared plumbing walls, and room dimensions routinely violate NBC India 2016 minimum clear dimension standards.

The fix replaces the current `placeRooms()` internals with an architect-ordered placement pipeline: circulation spine first, then foyer, then public zone, then wet areas on shared walls, then private zone at the rear. NBC minimum dimensions are enforced as hard constraints at sizing time, not as a post-hoc adjustment. Vastu orientation is applied as a tie-breaker during zone placement. All existing geometric correctness behaviour (boundary enforcement, overlap resolution, MEP coordinate derivation, FAR/GSI compliance, serialization round-trip) is preserved unchanged.

---

## Glossary

- **Bug_Condition (C)**: The condition that triggers the bug — any floor plan generation input that causes the engine to produce a layout lacking zone separation, a circulation spine, wet-area grouping, NBC-compliant dimensions, or a valid entrance sequence.
- **Property (P)**: The desired behavior when the bug condition holds — the fixed engine SHALL produce an architecturally coherent layout satisfying all five correctness properties.
- **Preservation**: All geometric correctness behaviors (boundary enforcement, overlap resolution, MEP fixture coordinates, FAR/GSI compliance, serialization round-trip) that must remain unchanged by the fix.
- **`ArchitecturalZone`**: Enum classifying every `RoomType` into PUBLIC | PRIVATE | SERVICE | CIRCULATION for zone-based placement.
- **`NBC_MIN_DIMS`**: Lookup table mapping `RoomType` → `{ w: number; h: number }` — the NBC India 2016 minimum clear internal dimensions used as hard lower bounds during room sizing.
- **`PlacementContext`**: Carries the corridor zone rectangle, entrance side, and lists of already-placed rooms by zone — threaded through each placement phase.
- **`buildCirculationSpine`**: The new function that places the corridor as the first room, establishing the organising axis before any habitable room is placed.
- **`isBugCondition(X)`**: Pseudocode predicate from the requirements — returns true when any of the five defects is present in the generated layout.
- **`generateFloorPlan()`**: The public method on `SpacePlanningEngine` that orchestrates the full placement pipeline.
- **`placeRooms()`**: The private method currently implementing the row-packing algorithm — its internals are replaced by the new architectural pipeline.

---

## Bug Details

### Bug Condition

The bug manifests when `generateFloorPlan()` is called with any input containing three or more habitable rooms, or any wet area, or any bedroom alongside a living room. The current `placeRooms()` method classifies rooms into front/rear zones and packs them left-to-right, but it does not establish a corridor before placing rooms, does not enforce that bedrooms are farther from the entrance than the living room, does not group wet areas on shared walls, and applies NBC minimum dimensions only as a post-hoc clamp rather than a hard sizing constraint.

**Formal Specification:**
```
FUNCTION isBugCondition(X)
  INPUT: X of type FloorPlanGenerationInput
  OUTPUT: boolean

  hasPublicPrivateMixing   ← EXISTS bedroom in X.roomSpecs
                             AND engine places that bedroom
                             closer to entrance than living room

  missingCirculationSpine  ← X.roomSpecs contains ≥ 3 habitable rooms
                             AND engine generates no corridor/passage
                             of width ≥ 1.0 m connecting them

  wetAreasIsolated         ← EXISTS kitchen OR bathroom in X.roomSpecs
                             AND engine places it with no shared wall
                             with any other wet area

  dimensionViolation       ← EXISTS room r in X.roomSpecs
                             WHERE engine places r with
                             r.width < NBC_MIN_DIMS[r.type].w
                             OR r.height < NBC_MIN_DIMS[r.type].h

  noEntranceSequence       ← X.roomSpecs contains living AND bedroom
                             AND engine places living room NOT between
                             entrance and bedroom zone

  RETURN hasPublicPrivateMixing
      OR missingCirculationSpine
      OR wetAreasIsolated
      OR dimensionViolation
      OR noEntranceSequence
END FUNCTION
```

### Examples

- **Zone mixing**: 10m × 8m plot, 2 bedrooms + living + kitchen → engine places master bedroom at y=0 (entrance side), living at y=5. Expected: living at y=0, bedrooms at y≥(living.height + corridor.height).
- **No spine**: 3-bedroom plan → engine places corridor as a residual room after all habitable rooms, resulting in a 0.8m-wide gap rather than a 1.0m+ spine. Expected: 1.2m corridor reserved first along central axis.
- **Wet area isolation**: kitchen placed on east external wall, bathroom on west external wall, no shared plumbing wall. Expected: kitchen and bathroom share at least one internal wall.
- **Dimension violation**: bedroom sized to 2.4m × 4.2m (area = 10.08m² ✓, but width 2.4m < NBC min 2.7m ✗). Expected: width clamped to 2.7m before area adjustment.
- **No entrance sequence**: foyer placed at rear of plot, living room at front but not adjacent to foyer. Expected: foyer at road-facing boundary → living adjacent to foyer → corridor → bedrooms.

---

## Expected Behavior

### Preservation Requirements

**Unchanged Behaviors:**
- Every `PlacedRoom` must satisfy boundary constraints: `room.x >= setback.left`, `room.y >= setback.front`, `room.x + room.width <= plot.width - setback.right`, `room.y + room.height <= plot.depth - setback.rear`.
- Overlap resolution via `resolveOverlaps()` must continue to translate the lower-priority room along the axis of minimum penetration depth, and `overlapCount` / `boundaryViolationCount` must remain on the returned `FloorPlan`.
- `generateStructuralPlan()` must continue to snap columns to room corners within 0.15m and expose `gridAlignmentScore`.
- All MEP fixture coordinates must remain derived as offsets from `PlacedRoom` origins and validated within room bounding boxes.
- FAR/FSI trimming and ground coverage scaling must continue to operate on the room list before placement.
- Serialization round-trip must produce identical `x`, `y`, `width`, `height` on every `PlacedRoom` and identical `x`, `y`, `roomId` on every MEP fixture.
- `computeAdjacencyScore()` must remain a contributing factor in placement decisions (supplemented by zone and vastu logic, not replaced).

**Scope:**
All inputs that do NOT trigger `isBugCondition` (i.e., single-room plans, plans with no wet areas, plans with no bedrooms) should be completely unaffected by this fix.

---

## Hypothesized Root Cause

1. **Corridor placed as residual**: `generateCorridors()` is called after `placeRooms()` and derives the corridor from a stored `_corridorZone` side-channel. The corridor is not placed as a first-class room before habitable rooms, so it cannot act as the organising spine.

2. **Zone separation is advisory, not enforced**: `getRoomZone()` classifies rooms into front/rear, but the row-packing algorithm in `packRoomsIntoZone()` does not verify that no bedroom ends up closer to the entrance than the living room — it only sorts rooms before packing, which can be violated when rooms overflow rows.

3. **NBC minimum dimensions applied post-hoc**: `MIN_CLEAR_DIM` is checked inside `packRoomsIntoZone()` but the clamp is applied after the aspect-ratio calculation, meaning a room can be sized to meet area with a width below the NBC minimum, then only partially corrected by the post-placement `validateFurnitureClearance` pass.

4. **Wet area grouping is not enforced**: `isWetRoom()` exists and wet rooms are sorted together within a zone, but there is no check that the placed wet rooms actually share a wall — they can end up in different rows or different zones.

5. **Vastu applied per-room, not per-zone**: `vastuEngine.getIdealDirection()` is called in `getDefaultRoomSpec()` to set `vastuDirection` on each spec, but `placeRooms()` does not use this to constrain which quadrant of the buildable envelope a room is placed in.

---

## Correctness Properties

Property 1: Bug Condition - Zone Separation and Entrance Sequence

_For any_ input where `isBugCondition` returns true (specifically: a plan with at least one bedroom and one living room), the fixed `generateFloorPlan` SHALL place every bedroom such that `distanceFromEntrance(bedroom) > distanceFromEntrance(living)`, and SHALL place the foyer (if present) as the first room encountered from the road-facing plot boundary, with the living room adjacent to the foyer and the corridor separating the living zone from the bedroom zone.

**Validates: Requirements 2.1, 2.5**

Property 2: Bug Condition - Circulation Spine

_For any_ input where `isBugCondition` returns true (specifically: a plan with ≥ 3 habitable rooms), the fixed `generateFloorPlan` SHALL reserve a contiguous rectangular corridor zone of width ≥ 1.0m along the central axis of the buildable envelope before placing any habitable room, and SHALL place all habitable rooms with at least one wall touching that corridor zone.

**Validates: Requirements 2.2, 2.9**

Property 3: Bug Condition - Wet Area Grouping

_For any_ input where `isBugCondition` returns true (specifically: a plan containing a kitchen or bathroom), the fixed `generateFloorPlan` SHALL position every wet area (kitchen, bathroom, toilet, utility, laundry) on a shared internal wall with at least one other wet area, unless the plot geometry makes this geometrically impossible (buildable width < sum of minimum wet-area widths).

**Validates: Requirements 2.3**

Property 4: Bug Condition - NBC Minimum Dimensions

_For any_ input where `isBugCondition` returns true (specifically: any plan), the fixed `generateFloorPlan` SHALL size every placed room such that `room.width >= NBC_MIN_DIMS[room.type].w` AND `room.height >= NBC_MIN_DIMS[room.type].h`, enforcing the minimum dimension before computing the complementary dimension from the area target.

**Validates: Requirements 2.4**

Property 5: Preservation - Geometric Correctness

_For any_ input where `isBugCondition` returns false, the fixed `generateFloorPlan` SHALL produce the same boundary-valid, overlap-free layout as the original function, preserving all existing FAR/GSI compliance, MEP coordinate derivation, structural grid snapping, and serialization round-trip behavior.

**Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8, 3.9, 3.10**

---

## Fix Implementation

### Data Structures

**`ArchitecturalZone` enum** (new, in `SpacePlanningEngine.ts`):
```typescript
enum ArchitecturalZone {
  PUBLIC      = 'PUBLIC',      // living, dining, drawing, foyer, study
  PRIVATE     = 'PRIVATE',     // bedroom, bathroom, toilet, dressing
  SERVICE     = 'SERVICE',     // utility, laundry, store, garage, parking
  CIRCULATION = 'CIRCULATION', // corridor, staircase, lift
}
```

**`NBC_MIN_DIMS` lookup table** (replaces / supersedes the existing `MIN_CLEAR_DIM` constant — same name kept for backward compatibility, values corrected to match the requirements spec):
```typescript
const NBC_MIN_DIMS: Partial<Record<RoomType, { w: number; h: number }>> = {
  living:         { w: 3.0, h: 3.0 },
  drawing_room:   { w: 3.0, h: 3.0 },
  dining:         { w: 3.0, h: 3.0 },
  master_bedroom: { w: 3.0, h: 3.0 },
  bedroom:        { w: 2.7, h: 2.7 },
  kitchen:        { w: 2.1, h: 1.8 },
  bathroom:       { w: 1.2, h: 0.9 },
  toilet:         { w: 1.0, h: 0.9 },
  corridor:       { w: 1.0, h: 1.0 },
  staircase:      { w: 1.0, h: 1.0 },
  foyer:          { w: 1.5, h: 1.5 },
  entrance_lobby: { w: 1.5, h: 1.5 },
};
```

**`RoomZoneMap`** (new constant, maps `RoomType` → `ArchitecturalZone`):
```typescript
const ROOM_ZONE_MAP: Partial<Record<RoomType, ArchitecturalZone>> = {
  living: PUBLIC, dining: PUBLIC, drawing_room: PUBLIC,
  foyer: PUBLIC, entrance_lobby: PUBLIC, study: PUBLIC,
  master_bedroom: PRIVATE, bedroom: PRIVATE, bathroom: PRIVATE,
  toilet: PRIVATE, dressing: PRIVATE, walk_in_closet: PRIVATE,
  guest_room: PRIVATE, childrens_room: PRIVATE,
  kitchen: SERVICE, utility: SERVICE, laundry: SERVICE,
  store: SERVICE, garage: SERVICE, parking: SERVICE,
  pantry: SERVICE, servants_quarter: SERVICE,
  corridor: CIRCULATION, staircase: CIRCULATION, lift: CIRCULATION,
};
```

**`PlacementContext`** (new interface):
```typescript
interface PlacementContext {
  corridorZone: { x: number; y: number; w: number; h: number };
  entranceSide: 'N' | 'S' | 'E' | 'W';
  placedByZone: Map<ArchitecturalZone, PlacedRoom[]>;
  wetWallX: number | null;  // X coordinate of shared plumbing wall (set after first wet room placed)
  wetWallY: number | null;  // Y coordinate of shared plumbing wall
}
```

### Key Functions

**`classifyRoomZone(type: RoomType): ArchitecturalZone`** (new private method)
- Looks up `ROOM_ZONE_MAP[type]`, defaults to `PRIVATE` for unknown types.
- Replaces the existing `getRoomZone()` private method (which returns string literals).

**`enforceNBCMinDimensions(type: RoomType, w: number, h: number, area: number): { w: number; h: number }`** (new private method)
- Looks up `NBC_MIN_DIMS[type]`.
- If `w < minW`: sets `w = minW`, recomputes `h = max(minH, area / w)`.
- If `h < minH`: sets `h = minH`, recomputes `w = max(minW, area / h)`.
- Applies `snapToGrid()` to both dimensions.
- Returns corrected `{ w, h }`.

**`buildCirculationSpine(ox, oy, envW, envH, entranceSide): { corridorZone, corridorRoom }`** (new private method)
- Computes corridor position along the central axis of the buildable envelope.
- Corridor width = `max(NBC_MIN_DIMS.corridor.w, 1.2)` = 1.2m.
- For N/S entry: corridor runs horizontally at `y = oy + floor(envH * 0.45)`.
- For E/W entry: corridor runs vertically at `x = ox + floor(envW * 0.45)`.
- Returns the corridor zone rectangle and a `PlacedRoom` for the corridor.

**`placePublicZone(specs, corridorZone, entranceSide, context): PlacedRoom[]`** (new private method)
- Receives only PUBLIC-zone specs (living, dining, drawing, foyer, study).
- Places foyer first at the entrance boundary (road-facing side of corridor zone).
- Places living room adjacent to foyer.
- Packs remaining public rooms left-to-right in the entrance-side half of the buildable envelope.
- Each room is sized using `enforceNBCMinDimensions()` before placement.
- Applies vastu quadrant preference as a tie-breaker when multiple positions score equally.

**`placeWetAreas(specs, context): PlacedRoom[]`** (new private method)
- Receives kitchen + bathroom + toilet + utility + laundry specs.
- Determines the shared plumbing wall: the internal wall between the public zone and private zone (i.e., the wall adjacent to the corridor on the service side).
- Places kitchen first on the SE quadrant wall (vastu preference), then bathrooms/toilets adjacent to kitchen on the same wall.
- Sets `context.wetWallX` or `context.wetWallY` after placing the first wet room.
- Each subsequent wet room is placed touching the same wall coordinate.

**`placePrivateZone(specs, corridorZone, context): PlacedRoom[]`** (new private method)
- Receives PRIVATE-zone specs (bedrooms, dressing, walk-in-closet).
- Places all rooms in the rear half of the buildable envelope (opposite the entrance side).
- Each room must have at least one wall touching the corridor zone.
- Master bedroom placed in SW quadrant (vastu preference).
- Each room sized using `enforceNBCMinDimensions()`.

**`autoInjectMandatoryRooms(specs: RoomSpec[], plot: PlotDimensions): RoomSpec[]`** (new private method)
- Checks for NBC Part 4 mandatory elements: at least one habitable room, one kitchen, one toilet/bathroom.
- If missing, injects a minimal spec at `NBC_MIN_DIMS` dimensions.
- Records each injection as a `ConstraintViolationRecord` with `severity: 'info'`.

**`validateEntranceSequence(rooms: PlacedRoom[], entranceSide: CardinalDirection): boolean`** (new private method)
- Computes `distanceFromEntrance(room)` for each room as the coordinate on the entrance axis.
- Returns true iff: all bedrooms have a greater distance from entrance than the living room, and the foyer (if present) has the smallest distance.

**`generateFloorPlan()` — modified orchestration order:**
```
FUNCTION generateFloorPlan(plot, orientation, constraints, roomSpecs, preferences, floor)
  // ... existing FAR/GSI/coverage enforcement unchanged ...

  // NEW: Step 0 — auto-inject mandatory rooms if missing
  adjustedRooms ← autoInjectMandatoryRooms(adjustedRooms, plot)

  // NEW: Replace placeRooms() call with architectural pipeline:
  placedRooms ← architecturalPlacement(
    adjustedRooms, buildableWidth, buildableDepth,
    constraints.setbacks, orientation, preferences
  )

  // ... existing walls, doors/windows, MEP, corridors unchanged ...
END FUNCTION

FUNCTION architecturalPlacement(rooms, envW, envH, setbacks, orientation, preferences)
  entranceSide ← deriveEntranceSide(orientation.mainEntryDirection)

  // Step 1: Circulation spine
  { corridorZone, corridorRoom } ← buildCirculationSpine(ox, oy, envW, envH, entranceSide)
  placed ← [corridorRoom]
  context ← PlacementContext{ corridorZone, entranceSide, ... }

  // Step 2: Foyer at entrance
  publicSpecs ← rooms WHERE classifyRoomZone(type) = PUBLIC
  placed ← placed + placePublicZone(publicSpecs, corridorZone, entranceSide, context)

  // Step 3: Wet areas on shared plumbing wall
  wetSpecs ← rooms WHERE isWetRoom(type)
  placed ← placed + placeWetAreas(wetSpecs, context)

  // Step 4: Private zone at rear
  privateSpecs ← rooms WHERE classifyRoomZone(type) = PRIVATE
                             AND NOT isWetRoom(type)
  placed ← placed + placePrivateZone(privateSpecs, corridorZone, context)

  // Step 5: Service rooms (non-wet)
  serviceSpecs ← rooms WHERE classifyRoomZone(type) = SERVICE
                              AND NOT isWetRoom(type)
  placed ← placed + packServiceRooms(serviceSpecs, context)

  // Step 6: Resolve overlaps (existing resolveOverlaps — unchanged)
  resolveOverlaps(placed, setbacks, plot)

  RETURN placed
END FUNCTION
```

### Vastu Orientation Map

Applied as a tie-breaker in `placePublicZone()`, `placeWetAreas()`, and `placePrivateZone()` when two candidate positions score equally on adjacency:

| Direction | Preferred Room Types |
|-----------|---------------------|
| NE        | pooja, study, living |
| SE        | kitchen |
| SW        | master_bedroom |
| NW        | bathroom, utility |
| N         | living, drawing_room |
| E         | bedroom, study |

The vastu quadrant is computed from the room's `vastuDirection` field (already set by `vastuEngine.getIdealDirection()` in `getDefaultRoomSpec()`). If the candidate position falls in the preferred quadrant, a bonus of `+0.5m` is added to the adjacency score.

### Changes Required

**File**: `apps/web/src/services/space-planning/SpacePlanningEngine.ts`

1. **Add `NBC_MIN_DIMS` constant** (rename/replace existing `MIN_CLEAR_DIM` with corrected values matching the requirements spec — living 3.0×3.0, bedroom 2.7×2.7, kitchen 2.1×1.8, bathroom 1.2×0.9, toilet 1.0×0.9, corridor 1.0×1.0, staircase 1.0×1.0, foyer 1.5×1.5).

2. **Add `ArchitecturalZone` enum and `ROOM_ZONE_MAP` constant** above the class definition.

3. **Add `PlacementContext` interface** above the class definition.

4. **Add private methods** `classifyRoomZone`, `enforceNBCMinDimensions`, `buildCirculationSpine`, `placePublicZone`, `placeWetAreas`, `placePrivateZone`, `autoInjectMandatoryRooms`, `validateEntranceSequence` inside the `SpacePlanningEngine` class.

5. **Add private method `architecturalPlacement`** that calls the above methods in the correct order and returns `PlacedRoom[]`.

6. **Modify `generateFloorPlan()`**: replace the `this.placeRooms(...)` call with `this.architecturalPlacement(...)`, and add the `autoInjectMandatoryRooms` call before placement. All other logic (FAR, coverage, walls, doors/windows, MEP, corridors) remains unchanged.

7. **Keep `placeRooms()` private method** intact (do not delete) — it is still used as a fallback for single-room plans and is referenced by existing tests.

---

## Testing Strategy

### Validation Approach

The testing strategy follows a two-phase approach: first, surface counterexamples that demonstrate the bug on unfixed code, then verify the fix works correctly and preserves existing behavior.

### Exploratory Bug Condition Checking

**Goal**: Surface counterexamples that demonstrate the bug BEFORE implementing the fix. Confirm or refute the root cause analysis.

**Test Plan**: Write tests that call `generateFloorPlan()` with a standard 3-bedroom house program (living + dining + kitchen + 2 bedrooms + 2 bathrooms + corridor) on a 10m × 8m plot facing south. Assert architectural correctness properties. Run on UNFIXED code to observe failures.

**Test Cases**:
1. **Zone separation test**: Assert `min(bedroom.y) > max(living.y)` for south-facing plot (will fail on unfixed code — bedrooms appear at y=0).
2. **Circulation spine test**: Assert a corridor room exists with `width >= 1.0` and all habitable rooms have `sharesWall(room, corridor)` (will fail — corridor is residual).
3. **Wet area grouping test**: Assert kitchen and at least one bathroom share a wall (will fail — they are placed in separate rows).
4. **NBC dimension test**: Assert `bedroom.width >= 2.7` for all bedrooms (will fail — bedrooms sized to 2.4m width).
5. **Entrance sequence test**: Assert `foyer.y <= living.y <= corridor.y <= bedroom.y` for south-facing plot (will fail — foyer not placed first).

**Expected Counterexamples**:
- Bedrooms at y=0 (entrance side), living room at y=4+.
- Corridor width = 0.8m or corridor placed as last room.
- Kitchen at x=0 (west wall), bathroom at x=8 (east wall), no shared wall.
- Bedroom width = 2.4m (below NBC 2.7m minimum).

### Fix Checking

**Goal**: Verify that for all inputs where the bug condition holds, the fixed function produces the expected behavior.

**Pseudocode:**
```
FOR ALL X WHERE isBugCondition(X) DO
  plan ← generateFloorPlan_fixed(X)

  ASSERT ALL bedrooms: distanceFromEntrance(bedroom) > distanceFromEntrance(living)
  ASSERT EXISTS corridor: corridor.width >= 1.0
         AND ALL habitable rooms touch corridor
  ASSERT ALL wet rooms share a wall with at least one other wet room
         OR geometricImpossibility(plan)
  ASSERT ALL rooms r: r.width >= NBC_MIN_DIMS[r.type].w
                  AND r.height >= NBC_MIN_DIMS[r.type].h
  ASSERT validateEntranceSequence(plan.rooms, entranceSide)
END FOR
```

### Preservation Checking

**Goal**: Verify that for all inputs where the bug condition does NOT hold, the fixed function produces the same result as the original function.

**Pseudocode:**
```
FOR ALL X WHERE NOT isBugCondition(X) DO
  ASSERT generateFloorPlan_original(X) ≈ generateFloorPlan_fixed(X)
  // Same boundary constraints, same overlap count, same MEP fixture positions
END FOR
```

**Testing Approach**: Property-based testing is recommended for preservation checking because it generates many random plot sizes, setback combinations, and single-room programs automatically, catching edge cases that manual tests miss.

**Test Cases**:
1. **Boundary preservation**: Generate random plot sizes (5–20m × 5–20m) and verify every placed room satisfies setback constraints after fix.
2. **Overlap preservation**: Verify `overlapCount` is 0 (or same as before fix) for all generated plans.
3. **MEP coordinate preservation**: Verify all electrical/plumbing fixture coordinates fall within their assigned room's bounding box after fix.
4. **Serialization round-trip**: Serialize and deserialize a generated plan, verify all room coordinates are identical.

### Unit Tests

- Test `enforceNBCMinDimensions()` for each room type with dimensions below the NBC minimum.
- Test `buildCirculationSpine()` for N/S/E/W entry directions — verify corridor position and dimensions.
- Test `autoInjectMandatoryRooms()` with a room list missing kitchen, toilet, and habitable room.
- Test `validateEntranceSequence()` with a correctly ordered plan (should return true) and a mixed plan (should return false).
- Test `classifyRoomZone()` for all 35+ room types — verify correct zone assignment.

### Property-Based Tests

- Generate random `RoomSpec[]` arrays (1–10 rooms, random types) and verify every placed room satisfies `width >= NBC_MIN_DIMS[type].w` after fix.
- Generate random plot dimensions and verify the corridor zone is always within the buildable envelope.
- Generate random plans with wet areas and verify wet rooms always share a wall (or the geometric impossibility flag is set).
- Generate random plans and verify `computeAdjacencyScore()` remains a contributing factor (score is non-zero when adjacency rules are satisfied).

### Integration Tests

- Full 3BHK plan (living + dining + kitchen + master bedroom + 2 bedrooms + 2 bathrooms + corridor + foyer) on a 12m × 10m south-facing plot — verify all five correctness properties.
- Full plan with vastu compliance enabled — verify kitchen in SE quadrant, master bedroom in SW quadrant.
- Multi-floor plan (ground + first floor) — verify ground floor has parking auto-injected, first floor has bedrooms, FAR/GSI constraints respected on both floors.
- Plan with missing mandatory rooms — verify auto-injection records `ConstraintViolationRecord` with `severity: 'info'`.
