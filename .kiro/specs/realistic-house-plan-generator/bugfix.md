# Bugfix Requirements Document

## Introduction

The space planning engine (`SpacePlanningEngine.ts`) generates house floor plans that are geometrically valid (rooms fit within the plot, no overlaps) but architecturally incoherent. The engine places rooms using adjacency scoring and priority ordering, yet the resulting layouts do not follow the spatial logic an architect applies: there is no entrance sequence, no separation of public and private zones, no circulation spine, wet areas are not grouped on shared plumbing walls, and rooms routinely violate NBC India 2016 minimum dimension standards. The fix must make the engine think like an architect — establishing zones, a circulation hierarchy, and hard dimensional constraints — while preserving all existing geometric correctness behaviour.

---

## Bug Analysis

### Current Behavior (Defect)

1.1 WHEN the engine places rooms on a plot, THEN the system distributes rooms across the buildable envelope without establishing a public-zone / private-zone separation, resulting in bedrooms placed at the front of the plot and living areas at the rear.

1.2 WHEN the engine places rooms on a plot, THEN the system does not generate a circulation spine (corridor or internal passage) connecting the entrance to all habitable rooms, leaving rooms accessible only by passing through other rooms.

1.3 WHEN the engine places a kitchen or bathroom, THEN the system positions it without regard to shared plumbing-wall grouping, placing wet areas on exterior walls or isolated from other wet areas, making MEP routing impractical.

1.4 WHEN the engine sizes a room from its `preferredArea`, THEN the system produces room dimensions that violate NBC 2016 minimum clear dimensions (e.g. a bedroom narrower than 2.7 m, a kitchen narrower than 2.1 m) because the area target is met by an aspect ratio that breaches the minimum-width constraint.

1.5 WHEN the engine places rooms on a plot, THEN the system does not enforce an entrance sequence — the main entry door does not lead to a foyer or entrance lobby before reaching the living area, and the living area is not positioned between the entrance and the private bedroom zone.

1.6 WHEN the engine generates a floor plan, THEN the system places the structural grid independently of room layout, producing column lines that bisect room interiors rather than aligning with room-boundary walls.

1.7 WHEN the engine places rooms on a plot with a defined front-road orientation, THEN the system does not apply vastu / solar-orientation preferences to zone placement (e.g. kitchen in the south-east, master bedroom in the south-west, pooja room in the north-east), even though `VastuEngine.getIdealDirection()` is called per room.

1.8 WHEN the engine generates a floor plan for a dwelling unit, THEN the system omits mandatory rooms required for a complete dwelling under NBC Part 4 (at minimum: one habitable room, a kitchen, and a toilet/bathroom), producing plans that lack sanitary facilities or a kitchen when the user's room list is incomplete.

1.9 WHEN the engine places rooms on a multi-room plan, THEN the system does not reserve a contiguous area for a circulation corridor connecting all rooms on the floor, so the corridor room (when present) is placed as a residual space rather than as the organising spine of the layout.

---

### Expected Behavior (Correct)

2.1 WHEN the engine places rooms on a plot, THEN the system SHALL partition the buildable envelope into a public zone (living, dining, drawing room, foyer — near the entrance side) and a private zone (bedrooms, bathrooms — at the rear or upper floor), with no bedroom placed closer to the entrance than the living room.

2.2 WHEN the engine places rooms on a plot, THEN the system SHALL generate a circulation spine — a corridor or internal passage of minimum 1.0 m clear width — that connects the entrance lobby to every habitable room on the floor before placing any other room.

2.3 WHEN the engine places a kitchen, bathroom, or toilet, THEN the system SHALL position it on a shared internal wall with at least one other wet area (kitchen, bathroom, toilet, utility, laundry) so that all wet areas share a common plumbing wall, unless the plot geometry makes this geometrically impossible.

2.4 WHEN the engine sizes a room from its area target, THEN the system SHALL enforce that the resulting width is ≥ `MIN_CLEAR_DIM[type].w` and the resulting depth is ≥ `MIN_CLEAR_DIM[type].h` as defined in the NBC constants, and SHALL increase the smaller dimension to the minimum before adjusting the other dimension to meet the area target.

2.5 WHEN the engine places rooms on a plot, THEN the system SHALL enforce the entrance sequence: main entry → foyer/entrance lobby → living area → circulation spine → private zone, such that the foyer is the first room encountered from the plot boundary on the road-facing side.

2.6 WHEN the engine generates a structural grid, THEN the system SHALL derive column lines from room-boundary walls first, snapping grid lines to wall intersections within 0.15 m, so that no column falls more than `STRUCTURAL_GRID.COLUMN_SIZE / 2` inside the clear interior of any habitable room.

2.7 WHEN the engine places rooms on a plot with a defined front-road orientation, THEN the system SHALL apply vastu zone placement as a hard preference: kitchen in the south-east quadrant, master bedroom in the south-west quadrant, pooja room in the north-east quadrant, and living room in the north or north-east quadrant, overriding adjacency-score tie-breaking when the vastu direction is available.

2.8 WHEN the engine generates a floor plan and the user's room list is missing any NBC-mandatory element (habitable room, kitchen, toilet), THEN the system SHALL auto-inject the missing room(s) at minimum NBC dimensions and record each injection in `FloorPlan.constraintViolations` with severity `"info"`.

2.9 WHEN the engine places rooms on a floor, THEN the system SHALL reserve a contiguous rectangular corridor zone along the central axis of the buildable envelope before placing any habitable room, and SHALL place all habitable rooms with at least one wall touching the corridor zone.

---

### Unchanged Behavior (Regression Prevention)

3.1 WHEN the engine places rooms on a plot, THEN the system SHALL CONTINUE TO ensure every PlacedRoom satisfies `room.x >= setback.left`, `room.y >= setback.front`, `room.x + room.width <= plot.width - setback.right`, and `room.y + room.height <= plot.depth - setback.rear` (boundary enforcement from Requirement 1 of the existing spec).

3.2 WHEN two PlacedRooms overlap after placement, THEN the system SHALL CONTINUE TO resolve the overlap by translating the lower-priority room along the axis of minimum penetration depth, and SHALL expose `overlapCount` and `boundaryViolationCount` on the returned `FloorPlan` object.

3.3 WHEN `generateStructuralPlan()` is called, THEN the system SHALL CONTINUE TO snap each column to the nearest room corner within 0.15 m and expose a `gridAlignmentScore` (0–100) on the `StructuralPlan` object.

3.4 WHEN `generateElectricalPlan()`, `generatePlumbingPlan()`, or `generateHVACPlan()` is called, THEN the system SHALL CONTINUE TO compute all fixture coordinates as offsets from the corresponding PlacedRoom's origin and validate that every fixture falls within its assigned room's bounding box.

3.5 WHEN solver placements from the CSP backend override engine room positions, THEN the system SHALL CONTINUE TO recompute all MEP fixture coordinates using the updated PlacedRoom positions before returning the final project.

3.6 WHEN the engine applies FAR / FSI constraints, THEN the system SHALL CONTINUE TO drop non-essential rooms that would exceed the per-floor area budget and SHALL always include rooms with `priority === "essential"` regardless of budget.

3.7 WHEN the engine applies ground coverage constraints, THEN the system SHALL CONTINUE TO scale room areas proportionally when the total footprint exceeds `maxGroundCoverage`, and SHALL log a warning with the scaling factor applied.

3.8 WHEN a `HousePlanProject` is serialized to JSON and deserialized, THEN the system SHALL CONTINUE TO produce an object where every PlacedRoom has identical `x`, `y`, `width`, and `height` values and every MEP fixture has identical `x`, `y`, and `roomId` values to the original.

3.9 WHEN the engine is called with `floor > 0`, THEN the system SHALL CONTINUE TO filter room specs to only those assigned to that floor and SHALL CONTINUE TO auto-inject parking rooms only on floor 0.

3.10 WHEN `computeAdjacencyScore()` is called for a candidate position, THEN the system SHALL CONTINUE TO return the sum of shared-wall length with `adjacentTo` rooms minus the sum of shared-wall length with `awayFrom` rooms, and this score SHALL remain a contributing factor in placement decisions (not replaced, only supplemented by zone and vastu logic).

---

## Bug Condition Pseudocode

```pascal
FUNCTION isBugCondition(X)
  INPUT: X of type FloorPlanGenerationInput
         (plot: PlotDimensions, orientation: SiteOrientation,
          constraints: SiteConstraints, roomSpecs: RoomSpec[],
          preferences: UserPreferences)
  OUTPUT: boolean

  // Bug fires when ANY of the following is true:
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
                             r.width < MIN_CLEAR_DIM[r.type].w
                             OR r.height < MIN_CLEAR_DIM[r.type].h

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

```pascal
// Property: Fix Checking — Architectural Correctness
FOR ALL X WHERE isBugCondition(X) DO
  plan ← generateFloorPlan'(X)

  // 2.1 Zone separation
  ASSERT ALL bedrooms in plan.rooms have
    distanceFromEntrance(bedroom) > distanceFromEntrance(living)

  // 2.2 Circulation spine exists
  ASSERT EXISTS corridor in plan.rooms WHERE
    corridor.width >= 1.0
    AND corridor touches all habitable rooms

  // 2.3 Wet area grouping
  ASSERT ALL wet rooms in plan.rooms share a wall
    with at least one other wet room
    OR geometricImpossibility(plan.plot)

  // 2.4 NBC minimum dimensions
  ASSERT ALL rooms r in plan.rooms satisfy
    r.width >= MIN_CLEAR_DIM[r.type].w
    AND r.height >= MIN_CLEAR_DIM[r.type].h

  // 2.5 Entrance sequence
  ASSERT entranceSequenceValid(plan)
    // foyer → living → corridor → bedrooms
END FOR

// Property: Preservation Checking
FOR ALL X WHERE NOT isBugCondition(X) DO
  ASSERT generateFloorPlan(X) = generateFloorPlan'(X)
  // Boundary enforcement, overlap resolution, MEP alignment,
  // FAR/GSI compliance, serialization round-trip all unchanged
END FOR
```
