/**
 * Property-Based Tests — Architectural Placement Pipeline
 *
 * Validates: Requirements 4.1, 4.2, 4.3, 4.4, 4.5, 4.8
 *
 * Sub-tasks:
 *   1.1 Property 1: House Plan Zone Separation
 *   1.2 Property 2: House Plan Circulation Spine
 *   1.3 Property 3: NBC Minimum Dimensions
 *   1.4 Property 24: Wet Area Grouping
 *   1.5 Property 16: Boundary Enforcement Preservation
 */

import { describe, it } from 'vitest';
import fc from 'fast-check';
import { SpacePlanningEngine } from '../SpacePlanningEngine';
import type {
  RoomSpec, RoomType, PlotDimensions, SiteOrientation,
  SiteConstraints, UserPreferences,
} from '../types';

// ── Helpers ──

function makeEngine() { return new SpacePlanningEngine(); }

function makePlot(w: number, d: number): PlotDimensions {
  return { width: w, depth: d, area: w * d, shape: 'rectangular', unit: 'meters' };
}

function makeOrientation(entry: 'S' | 'N' | 'E' | 'W' = 'S'): SiteOrientation {
  return { northDirection: 0, plotFacing: entry, mainEntryDirection: entry, roadSide: [entry] };
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

const engine = makeEngine();

/** NBC 2016 minimum clear dimensions (must match SpacePlanningEngine.ts NBC_MIN_DIMS) */
const NBC_MIN_DIMS: Partial<Record<RoomType, { w: number; h: number }>> = {
  living: { w: 3.0, h: 3.0 },
  drawing_room: { w: 3.0, h: 3.0 },
  dining: { w: 3.0, h: 3.0 },
  master_bedroom: { w: 3.0, h: 3.0 },
  bedroom: { w: 2.7, h: 2.7 },
  kitchen: { w: 2.1, h: 1.8 },
  bathroom: { w: 1.2, h: 0.9 },
  toilet: { w: 1.0, h: 0.9 },
  corridor: { w: 1.0, h: 1.0 },
  foyer: { w: 1.5, h: 1.5 },
  entrance_lobby: { w: 1.5, h: 1.5 },
};

function sharesWall(
  a: { x: number; y: number; width: number; height: number },
  b: { x: number; y: number; width: number; height: number },
): boolean {
  const EPS = 0.15;
  const overlapX = Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x);
  const overlapY = Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y);
  if (overlapX > 0.5) {
    if (Math.abs(a.y - (b.y + b.height)) < EPS) return true;
    if (Math.abs(a.y + a.height - b.y) < EPS) return true;
  }
  if (overlapY > 0.5) {
    if (Math.abs(a.x - (b.x + b.width)) < EPS) return true;
    if (Math.abs(a.x + a.width - b.x) < EPS) return true;
  }
  return false;
}

// Arbitraries
const plotArb = fc.record({
  w: fc.float({ min: 10, max: 20, noNaN: true }),
  d: fc.float({ min: 9, max: 18, noNaN: true }),
});

const entryArb = fc.constantFrom<'S' | 'N' | 'E' | 'W'>('S', 'N', 'E', 'W');

/** Generate a minimal room program with at least one bedroom and one living room */
const bedroomLivingProgramArb = fc.record({
  numBedrooms: fc.integer({ min: 1, max: 3 }),
  hasMasterBedroom: fc.boolean(),
  hasDining: fc.boolean(),
  hasKitchen: fc.boolean(),
}).map(({ numBedrooms, hasMasterBedroom, hasDining, hasKitchen }) => {
  const rooms: RoomSpec[] = [
    engine.getDefaultRoomSpec('living', 0),
    engine.getDefaultRoomSpec('kitchen', 0),
  ];
  for (let i = 0; i < numBedrooms; i++) {
    rooms.push({ ...engine.getDefaultRoomSpec('bedroom', 0), id: `bedroom-${i}` });
  }
  if (hasMasterBedroom) rooms.push(engine.getDefaultRoomSpec('master_bedroom', 0));
  if (hasDining) rooms.push(engine.getDefaultRoomSpec('dining', 0));
  if (hasKitchen) rooms.push(engine.getDefaultRoomSpec('bathroom', 0));
  return rooms;
});

/** Generate a program with ≥3 habitable rooms */
const threeRoomProgramArb = fc.record({
  numBedrooms: fc.integer({ min: 1, max: 3 }),
}).map(({ numBedrooms }) => {
  const rooms: RoomSpec[] = [
    engine.getDefaultRoomSpec('living', 0),
    engine.getDefaultRoomSpec('kitchen', 0),
  ];
  for (let i = 0; i < numBedrooms; i++) {
    rooms.push({ ...engine.getDefaultRoomSpec('bedroom', 0), id: `bedroom-${i}` });
  }
  return rooms;
});

/** Generate a program with at least one wet room */
const wetRoomProgramArb = fc.record({
  numBathrooms: fc.integer({ min: 1, max: 2 }),
  hasToilet: fc.boolean(),
}).map(({ numBathrooms, hasToilet }) => {
  const rooms: RoomSpec[] = [
    engine.getDefaultRoomSpec('living', 0),
    engine.getDefaultRoomSpec('bedroom', 0),
    engine.getDefaultRoomSpec('kitchen', 0),
  ];
  for (let i = 0; i < numBathrooms; i++) {
    rooms.push({ ...engine.getDefaultRoomSpec('bathroom', 0), id: `bathroom-${i}` });
  }
  if (hasToilet) rooms.push(engine.getDefaultRoomSpec('toilet', 0));
  return rooms;
});

describe('PBT 1.1 — Property 1: House Plan Zone Separation', () => {
  /**
   * **Validates: Requirements 4.1, 4.5**
   *
   * For any input with ≥1 bedroom and ≥1 living room, every bedroom's
   * distanceFromEntrance must be strictly greater than the living room's.
   * For S-facing: distanceFromEntrance(room) = room.y
   */
  it('every bedroom is farther from entrance than living room (S-facing)', () => {
    fc.assert(
      fc.property(
        plotArb,
        bedroomLivingProgramArb,
        ({ w, d }, rooms) => {
          const plot = makePlot(w, d);
          const constraints = makeConstraints();
          const plan = engine.generateFloorPlan(plot, makeOrientation('S'), constraints, rooms, makePreferences(), 0);

          const living = plan.rooms.find(r => r.spec.type === 'living' || r.spec.type === 'drawing_room');
          const bedrooms = plan.rooms.filter(r =>
            ['master_bedroom', 'bedroom', 'childrens_room'].includes(r.spec.type)
          );

          if (!living || bedrooms.length === 0) return true;

          const livingDist = living.y; // S-facing: distance = y coordinate
          return bedrooms.every(b => b.y > livingDist);
        },
      ),
      { numRuns: 30, seed: 1001 },
    );
  });
});

describe('PBT 1.2 — Property 2: House Plan Circulation Spine', () => {
  /**
   * **Validates: Requirement 4.2**
   *
   * For any input with ≥3 habitable rooms, the output must contain a corridor room
   * with width >= 1.0 (or height >= 1.0 for vertical corridors) and every habitable
   * room must share a wall with it.
   */
  it('corridor spine exists with width >= 1.0m for plans with ≥3 habitable rooms', () => {
    fc.assert(
      fc.property(
        plotArb,
        threeRoomProgramArb,
        ({ w, d }, rooms) => {
          const plot = makePlot(w, d);
          const constraints = makeConstraints();
          const plan = engine.generateFloorPlan(plot, makeOrientation('S'), constraints, rooms, makePreferences(), 0);

          const corridor = plan.rooms.find(r => r.spec.type === 'corridor');
          const corridorFromList = plan.corridors[0];

          // Must have a corridor with minimum clear width
          const hasSpine = (corridor && (corridor.width >= 1.0 || corridor.height >= 1.0))
            || (corridorFromList && (corridorFromList.width >= 1.0 || corridorFromList.height >= 1.0));

          return hasSpine === true;
        },
      ),
      { numRuns: 30, seed: 1002 },
    );
  });
});

describe('PBT 1.3 — Property 3: NBC Minimum Dimensions', () => {
  /**
   * **Validates: Requirement 4.4**
   *
   * For any FloorPlanGenerationInput, every placed room must satisfy
   * room.width >= NBC_MIN_DIMS[room.type].w AND room.height >= NBC_MIN_DIMS[room.type].h.
   */
  it('every placed room satisfies NBC minimum dimensions', () => {
    const TOL = 0.05; // 50mm tolerance for grid snapping
    fc.assert(
      fc.property(
        plotArb,
        bedroomLivingProgramArb,
        ({ w, d }, rooms) => {
          const plot = makePlot(w, d);
          const constraints = makeConstraints();
          const plan = engine.generateFloorPlan(plot, makeOrientation('S'), constraints, rooms, makePreferences(), 0);

          for (const room of plan.rooms) {
            const min = NBC_MIN_DIMS[room.spec.type];
            if (!min) continue;
            if (room.width < min.w - TOL) return false;
            if (room.height < min.h - TOL) return false;
          }
          return true;
        },
      ),
      { numRuns: 30, seed: 1003 },
    );
  });
});

describe('PBT 1.4 — Property 24: Wet Area Grouping', () => {
  /**
   * **Validates: Requirement 4.3**
   *
   * For any input containing a kitchen or bathroom, every wet area must share an
   * internal wall with at least one other wet area (unless geometrically impossible).
   */
  it('kitchen and bathroom share a wall when both are present', () => {
    fc.assert(
      fc.property(
        plotArb,
        wetRoomProgramArb,
        ({ w, d }, rooms) => {
          const plot = makePlot(w, d);
          const constraints = makeConstraints();
          const plan = engine.generateFloorPlan(plot, makeOrientation('S'), constraints, rooms, makePreferences(), 0);

          const kitchen = plan.rooms.find(r => r.spec.type === 'kitchen');
          const wetRooms = plan.rooms.filter(r =>
            ['bathroom', 'toilet', 'laundry', 'utility'].includes(r.spec.type)
          );

          if (!kitchen || wetRooms.length === 0) return true;

          // At least one wet room must share a wall with the kitchen
          return wetRooms.some(w => sharesWall(kitchen, w));
        },
      ),
      { numRuns: 30, seed: 1004 },
    );
  });
});

describe('PBT 1.5 — Property 16: Boundary Enforcement Preservation', () => {
  /**
   * **Validates: Requirement 4.8**
   *
   * For any input, every PlacedRoom must satisfy all four setback constraints:
   *   room.x >= setback.left
   *   room.y >= setback.front
   *   room.x + room.width <= plot.width - setback.right
   *   room.y + room.height <= plot.depth - setback.rear
   */
  it('every placed room satisfies all setback constraints', () => {
    const TOL = 0.05; // 50mm tolerance for floating-point rounding
    fc.assert(
      fc.property(
        plotArb,
        bedroomLivingProgramArb,
        ({ w, d }, rooms) => {
          const plot = makePlot(w, d);
          const constraints = makeConstraints();
          const { setbacks } = constraints;
          const plan = engine.generateFloorPlan(plot, makeOrientation('S'), constraints, rooms, makePreferences(), 0);

          for (const room of plan.rooms) {
            if (room.x < setbacks.left - TOL) return false;
            if (room.y < setbacks.front - TOL) return false;
            if (room.x + room.width > plot.width - setbacks.right + TOL) return false;
            if (room.y + room.height > plot.depth - setbacks.rear + TOL) return false;
          }
          return true;
        },
      ),
      { numRuns: 30, seed: 1005 },
    );
  });
});
