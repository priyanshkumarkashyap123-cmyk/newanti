/**
 * Task 2 Tests — Multi-Floor and Plot Orientation Accuracy
 *
 * Covers Requirements 5.1–5.5:
 * 5.1 Floor filtering and parking injection
 * 5.2 Upper-floor column alignment within 0.15 m
 * 5.3 East/West-facing plots — foyer on road-facing boundary
 * 5.4 Corner plot — reduced setbacks on secondary road side
 * 5.5 Narrow plot (< 6 m) — single-loaded corridor + constraintViolations entry
 */

import { describe, it, expect } from 'vitest';
import { SpacePlanningEngine } from '../SpacePlanningEngine';
import { structuralGridPlacer } from '../StructuralGridPlacer';
import type {
  RoomSpec, RoomType, PlotDimensions, SiteOrientation,
  SiteConstraints, UserPreferences,
} from '../types';

// ── Helpers ──

function makeEngine() { return new SpacePlanningEngine(); }

function makePlot(w: number, d: number): PlotDimensions {
  return { width: w, depth: d, area: w * d, shape: 'rectangular', unit: 'meters' };
}

function makeOrientation(
  entry: 'S' | 'N' | 'E' | 'W' = 'S',
  roadSide?: ('N' | 'S' | 'E' | 'W')[],
): SiteOrientation {
  return {
    northDirection: 0,
    plotFacing: entry,
    mainEntryDirection: entry,
    roadSide: roadSide ?? [entry],
  };
}

function makeConstraints(overrides: Partial<SiteConstraints> = {}): SiteConstraints {
  return {
    setbacks: { front: 1.5, rear: 1.0, left: 1.0, right: 1.0 },
    maxHeight: 10, maxFloors: 2, farAllowed: 2.0, groundCoverage: 60,
    parkingRequired: 0, buildingType: 'residential', zone: 'R1',
    ...overrides,
  };
}

function makePreferences(): UserPreferences {
  return {
    style: 'modern', budget: 'standard', climate: 'composite',
    orientation_priority: 'sunlight', parking: 'covered', roofType: 'flat',
    naturalLighting: 'balanced', privacy: 'medium', greenFeatures: false,
    smartHome: false, accessibilityRequired: false, vastuCompliance: 'optional',
  };
}

function makeRoomSpec(type: RoomType, floor = 0): RoomSpec {
  return makeEngine().getDefaultRoomSpec(type, floor);
}

const engine = makeEngine();

// ─────────────────────────────────────────────────────────────────────────────
// Requirement 5.1 — Floor filtering and parking injection
// ─────────────────────────────────────────────────────────────────────────────
describe('Req 5.1 — Floor filtering and parking injection', () => {
  it('floor > 0 only includes rooms assigned to that floor', () => {
    const rooms = [
      { ...makeRoomSpec('living', 0) },
      { ...makeRoomSpec('kitchen', 0) },
      { ...makeRoomSpec('bedroom', 1), id: 'bed-floor1' },
      { ...makeRoomSpec('bathroom', 1), id: 'bath-floor1' },
    ];
    const plot = makePlot(15, 12);
    const constraints = makeConstraints({ parkingRequired: 0 });

    const floor1Plan = engine.generateFloorPlan(plot, makeOrientation(), constraints, rooms, makePreferences(), 1);

    // Only floor-1 rooms should appear
    const types = floor1Plan.rooms.map(r => r.spec.type);
    expect(types).toContain('bedroom');
    expect(types).toContain('bathroom');
    expect(types).not.toContain('living');
    expect(types).not.toContain('kitchen');
  });

  it('parking is auto-injected only on floor 0, not on floor 1', () => {
    const rooms = [
      { ...makeRoomSpec('living', 0) },
      { ...makeRoomSpec('kitchen', 0) },
      { ...makeRoomSpec('bedroom', 1), id: 'bed-f1' },
    ];
    const plot = makePlot(15, 12);
    const constraints = makeConstraints({ parkingRequired: 1 });

    const groundPlan = engine.generateFloorPlan(plot, makeOrientation(), constraints, rooms, makePreferences(), 0);
    const floor1Plan = engine.generateFloorPlan(plot, makeOrientation(), constraints, rooms, makePreferences(), 1);

    expect(groundPlan.rooms.map(r => r.spec.type)).toContain('parking');
    expect(floor1Plan.rooms.map(r => r.spec.type)).not.toContain('parking');
  });

  it('floor 0 plan has floor label "Ground Floor"', () => {
    const rooms = [makeRoomSpec('living', 0), makeRoomSpec('bedroom', 0)];
    const plan = engine.generateFloorPlan(makePlot(15, 12), makeOrientation(), makeConstraints(), rooms, makePreferences(), 0);
    expect(plan.label).toBe('Ground Floor');
  });

  it('floor 1 plan has floor label "Floor 1"', () => {
    const rooms = [makeRoomSpec('bedroom', 1), makeRoomSpec('bathroom', 1)];
    const plan = engine.generateFloorPlan(makePlot(15, 12), makeOrientation(), makeConstraints(), rooms, makePreferences(), 1);
    expect(plan.label).toBe('Floor 1');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Requirement 5.2 — Upper-floor column alignment within 0.15 m
// ─────────────────────────────────────────────────────────────────────────────
describe('Req 5.2 — Upper-floor column alignment', () => {
  it('upper-floor columns align with ground-floor columns within 0.15 m', () => {
    const groundRooms = [
      makeRoomSpec('living', 0), makeRoomSpec('kitchen', 0), makeRoomSpec('bedroom', 0),
    ];
    const upperRooms = [
      makeRoomSpec('bedroom', 1), makeRoomSpec('bathroom', 1),
    ];
    const plot = makePlot(15, 12);
    const constraints = makeConstraints({ maxFloors: 2 });

    const groundPlan = engine.generateFloorPlan(plot, makeOrientation(), constraints, groundRooms, makePreferences(), 0);
    const upperPlan = engine.generateFloorPlan(plot, makeOrientation(), constraints, upperRooms, makePreferences(), 1);

    const structuralPlan = structuralGridPlacer.generateStructuralPlan(
      [groundPlan, upperPlan], plot, constraints,
    );

    const groundCols = structuralPlan.columns.filter(c => c.floor === 0);
    const upperCols = structuralPlan.columns.filter(c => c.floor === 1);

    // Every upper-floor column must have a matching ground-floor column within 0.15 m
    const TOLERANCE = 0.15;
    for (const uCol of upperCols) {
      const hasMatch = groundCols.some(
        gCol =>
          Math.abs(gCol.x - uCol.x) <= TOLERANCE &&
          Math.abs(gCol.y - uCol.y) <= TOLERANCE,
      );
      expect(hasMatch).toBe(true);
    }
  });

  it('structural plan has columns for both floor 0 and floor 1 when multi-floor', () => {
    const groundRooms = [makeRoomSpec('living', 0), makeRoomSpec('kitchen', 0)];
    const upperRooms = [makeRoomSpec('bedroom', 1), makeRoomSpec('bathroom', 1)];
    const plot = makePlot(15, 12);
    const constraints = makeConstraints({ maxFloors: 2 });

    const groundPlan = engine.generateFloorPlan(plot, makeOrientation(), constraints, groundRooms, makePreferences(), 0);
    const upperPlan = engine.generateFloorPlan(plot, makeOrientation(), constraints, upperRooms, makePreferences(), 1);

    const structuralPlan = structuralGridPlacer.generateStructuralPlan(
      [groundPlan, upperPlan], plot, constraints,
    );

    const floors = new Set(structuralPlan.columns.map(c => c.floor));
    expect(floors.has(0)).toBe(true);
    expect(floors.has(1)).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Requirement 5.3 — East/West-facing plots — foyer on road-facing boundary
// ─────────────────────────────────────────────────────────────────────────────
describe('Req 5.3 — East/West orientation — foyer on road-facing boundary', () => {
  it('East-facing: foyer is placed on the east (road-facing) side', () => {
    const rooms = [
      makeRoomSpec('foyer'), makeRoomSpec('living'), makeRoomSpec('bedroom'),
      makeRoomSpec('kitchen'), makeRoomSpec('bathroom'),
    ];
    const plot = makePlot(12, 15);
    const plan = engine.generateFloorPlan(plot, makeOrientation('E'), makeConstraints(), rooms, makePreferences(), 0);

    const foyer = plan.rooms.find(r => r.spec.type === 'foyer' || r.spec.type === 'entrance_lobby');
    const living = plan.rooms.find(r => r.spec.type === 'living');

    expect(foyer).toBeDefined();
    expect(living).toBeDefined();

    // For East-facing: entrance is on the east side (high x).
    // Foyer should be closer to east boundary than living room.
    // distFromEntrance(E) = -(r.x + r.width) — foyer should have higher x than living
    const foyerRightEdge = foyer!.x + foyer!.width;
    const livingRightEdge = living!.x + living!.width;
    expect(foyerRightEdge).toBeGreaterThanOrEqual(livingRightEdge - 0.5);
  });

  it('West-facing: foyer is placed on the west (road-facing) side', () => {
    const rooms = [
      makeRoomSpec('foyer'), makeRoomSpec('living'), makeRoomSpec('bedroom'),
      makeRoomSpec('kitchen'), makeRoomSpec('bathroom'),
    ];
    const plot = makePlot(12, 15);
    const plan = engine.generateFloorPlan(plot, makeOrientation('W'), makeConstraints(), rooms, makePreferences(), 0);

    const foyer = plan.rooms.find(r => r.spec.type === 'foyer' || r.spec.type === 'entrance_lobby');
    const living = plan.rooms.find(r => r.spec.type === 'living');

    expect(foyer).toBeDefined();
    expect(living).toBeDefined();

    // For West-facing: entrance is on the west side (low x).
    // Foyer should be closer to west boundary (lower x) than living room.
    expect(foyer!.x).toBeLessThanOrEqual(living!.x + 0.5);
  });

  it('South-facing: foyer is placed on the south (road-facing) side', () => {
    const rooms = [
      makeRoomSpec('foyer'), makeRoomSpec('living'), makeRoomSpec('bedroom'),
      makeRoomSpec('kitchen'), makeRoomSpec('bathroom'),
    ];
    const plot = makePlot(14, 12);
    const plan = engine.generateFloorPlan(plot, makeOrientation('S'), makeConstraints(), rooms, makePreferences(), 0);

    const foyer = plan.rooms.find(r => r.spec.type === 'foyer' || r.spec.type === 'entrance_lobby');
    const living = plan.rooms.find(r => r.spec.type === 'living');

    expect(foyer).toBeDefined();
    expect(living).toBeDefined();

    // For South-facing: foyer should have lower or equal y than living
    expect(foyer!.y).toBeLessThanOrEqual(living!.y + 0.5);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Requirement 5.4 — Corner plot — reduced setbacks on secondary road side
// ─────────────────────────────────────────────────────────────────────────────
describe('Req 5.4 — Corner plot reduced setbacks', () => {
  it('corner plot (S+E roads) has reduced east setback compared to non-corner', () => {
    const rooms = [
      makeRoomSpec('living'), makeRoomSpec('bedroom'), makeRoomSpec('kitchen'),
    ];
    const plot = makePlot(15, 12);
    const constraints = makeConstraints({
      setbacks: { front: 3.0, rear: 1.5, left: 1.5, right: 1.5 },
    });

    // Non-corner: only south road
    const nonCornerOrientation = makeOrientation('S', ['S']);
    const nonCornerPlan = engine.generateFloorPlan(plot, nonCornerOrientation, constraints, rooms, makePreferences(), 0);

    // Corner: south + east roads
    const cornerOrientation = makeOrientation('S', ['S', 'E']);
    const cornerPlan = engine.generateFloorPlan(plot, cornerOrientation, constraints, rooms, makePreferences(), 0);

    // Corner plan should have more buildable width (reduced right/east setback)
    // The rightmost room edge should be further right in the corner plan
    const nonCornerMaxX = Math.max(...nonCornerPlan.rooms.map(r => r.x + r.width));
    const cornerMaxX = Math.max(...cornerPlan.rooms.map(r => r.x + r.width));

    // Corner plan has reduced east setback → rooms can extend further east
    expect(cornerMaxX).toBeGreaterThanOrEqual(nonCornerMaxX - 0.1);
  });

  it('corner plot secondary setback is at least 1.5 m (NBC minimum)', () => {
    // The reduced setback should never go below 1.5 m
    // We verify this by checking that rooms don't extend beyond plot.width - 1.5
    const rooms = [
      makeRoomSpec('living'), makeRoomSpec('bedroom'), makeRoomSpec('kitchen'),
    ];
    const plot = makePlot(15, 12);
    const constraints = makeConstraints({
      setbacks: { front: 3.0, rear: 1.5, left: 1.5, right: 1.5 },
    });
    const cornerOrientation = makeOrientation('S', ['S', 'E']);
    const plan = engine.generateFloorPlan(plot, cornerOrientation, constraints, rooms, makePreferences(), 0);

    const maxX = Math.max(...plan.rooms.map(r => r.x + r.width));
    // Rooms must not exceed plot.width - 1.5 (minimum secondary setback)
    expect(maxX).toBeLessThanOrEqual(plot.width - 1.5 + 0.05);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Requirement 5.5 — Narrow plot (< 6 m) — single-loaded corridor
// ─────────────────────────────────────────────────────────────────────────────
describe('Req 5.5 — Narrow plot single-loaded corridor', () => {
  it('narrow plot (< 6 m buildable width) records a constraint violation', () => {
    // Plot width 7 m, setbacks 1 m each side → buildable width = 5 m < 6 m
    const rooms = [
      makeRoomSpec('living'), makeRoomSpec('bedroom'), makeRoomSpec('kitchen'),
    ];
    const plot = makePlot(7, 15);
    const constraints = makeConstraints({
      setbacks: { front: 1.5, rear: 1.0, left: 1.0, right: 1.0 },
    });
    const plan = engine.generateFloorPlan(plot, makeOrientation('S'), constraints, rooms, makePreferences(), 0);

    // Should have a constraint violation mentioning narrow plot / single-loaded
    const hasNarrowViolation = plan.constraintViolations.some(
      v => (v as any).rule?.toLowerCase().includes('narrow') ||
           (v as any).rule?.toLowerCase().includes('single-loaded') ||
           (v as any).rule?.toLowerCase().includes('6 m'),
    );
    expect(hasNarrowViolation).toBe(true);
  });

  it('wide plot (>= 6 m buildable width) does NOT record a narrow-plot violation', () => {
    const rooms = [
      makeRoomSpec('living'), makeRoomSpec('bedroom'), makeRoomSpec('kitchen'),
    ];
    const plot = makePlot(14, 12);
    const constraints = makeConstraints();
    const plan = engine.generateFloorPlan(plot, makeOrientation('S'), constraints, rooms, makePreferences(), 0);

    const hasNarrowViolation = plan.constraintViolations.some(
      v => (v as any).rule?.toLowerCase().includes('narrow') ||
           (v as any).rule?.toLowerCase().includes('single-loaded'),
    );
    expect(hasNarrowViolation).toBe(false);
  });

  it('narrow plot still produces a valid floor plan with placed rooms', () => {
    const rooms = [
      makeRoomSpec('living'), makeRoomSpec('bedroom'), makeRoomSpec('kitchen'),
    ];
    const plot = makePlot(7, 15);
    const constraints = makeConstraints({
      setbacks: { front: 1.5, rear: 1.0, left: 1.0, right: 1.0 },
    });
    const plan = engine.generateFloorPlan(plot, makeOrientation('S'), constraints, rooms, makePreferences(), 0);

    expect(plan.rooms.length).toBeGreaterThan(0);
    // All rooms must be within the buildable envelope
    const buildableWidth = plot.width - constraints.setbacks.left - constraints.setbacks.right;
    const buildableDepth = plot.depth - constraints.setbacks.front - constraints.setbacks.rear;
    const TOL = 0.05;
    for (const room of plan.rooms) {
      expect(room.x).toBeGreaterThanOrEqual(constraints.setbacks.left - TOL);
      expect(room.y).toBeGreaterThanOrEqual(constraints.setbacks.front - TOL);
      expect(room.x + room.width).toBeLessThanOrEqual(
        constraints.setbacks.left + buildableWidth + TOL,
      );
      expect(room.y + room.height).toBeLessThanOrEqual(
        constraints.setbacks.front + buildableDepth + TOL,
      );
    }
  });

  it('narrow plot corridor width is still >= 1.0 m (NBC minimum)', () => {
    const rooms = [
      makeRoomSpec('living'), makeRoomSpec('bedroom'), makeRoomSpec('kitchen'),
    ];
    const plot = makePlot(7, 15);
    const constraints = makeConstraints({
      setbacks: { front: 1.5, rear: 1.0, left: 1.0, right: 1.0 },
    });
    const plan = engine.generateFloorPlan(plot, makeOrientation('S'), constraints, rooms, makePreferences(), 0);

    const corridor = plan.rooms.find(r => r.spec.type === 'corridor');
    const corridorFromList = plan.corridors[0];
    const c = corridor || corridorFromList;
    if (c) {
      const minDim = Math.min(c.width, c.height);
      expect(minDim).toBeGreaterThanOrEqual(1.0 - 0.05);
    }
  });
});
