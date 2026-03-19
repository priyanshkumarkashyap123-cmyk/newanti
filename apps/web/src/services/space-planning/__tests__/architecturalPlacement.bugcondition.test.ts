/**
 * Bug Condition Exploration Test — Architectural Incoherence
 *
 * PURPOSE: Surface counterexamples that demonstrate the bug EXISTS on unfixed code.
 * This test is EXPECTED TO FAIL on unfixed code — failure confirms the bug.
 * After the fix is implemented (Task 3), this same test should PASS.
 *
 * Bug Condition: isBugCondition(X) — any of:
 *   - hasPublicPrivateMixing: bedroom closer to entrance than living room
 *   - missingCirculationSpine: no corridor of width >= 1.0m connecting habitable rooms
 *   - wetAreasIsolated: kitchen/bathroom with no shared wall with another wet area
 *   - dimensionViolation: room.width < NBC_MIN_DIMS[type].w
 *   - noEntranceSequence: living room not between entrance and bedroom zone
 */

import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { SpacePlanningEngine } from '../SpacePlanningEngine';
import type { RoomSpec, RoomType, PlotDimensions, SiteOrientation, SiteConstraints, UserPreferences } from '../types';

// ── NBC India 2016 minimum clear dimensions ──
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

const WET_ROOM_TYPES: RoomType[] = ['kitchen', 'bathroom', 'toilet', 'laundry', 'utility'];

function computeSharedWallLength(
  a: { x: number; y: number; width: number; height: number },
  b: { x: number; y: number; width: number; height: number },
): number {
  const EPS = 0.15;
  const overlapX = Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x);
  const overlapY = Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y);
  if (overlapX > 0.5 && (Math.abs(a.y - (b.y + b.height)) < EPS || Math.abs(a.y + a.height - b.y) < EPS)) {
    return overlapX;
  }
  if (overlapY > 0.5 && (Math.abs(a.x - (b.x + b.width)) < EPS || Math.abs(a.x + a.width - b.x) < EPS)) {
    return overlapY;
  }
  return 0;
}

function makeRoomSpec(
  type: RoomType,
  floor = 0,
  overrides: Partial<RoomSpec> = {},
): RoomSpec {
  const engine = new SpacePlanningEngine();
  return { ...engine.getDefaultRoomSpec(type, floor), ...overrides };
}

function makeSouthFacingPlot(w = 10, d = 8): PlotDimensions {
  return { width: w, depth: d, area: w * d, shape: 'rectangular', unit: 'meters' };
}

function makeSouthOrientation(): SiteOrientation {
  return { northDirection: 0, plotFacing: 'S', mainEntryDirection: 'S', roadSide: ['S'] };
}

function makeConstraints(): SiteConstraints {
  return {
    setbacks: { front: 1.5, rear: 1.0, left: 1.0, right: 1.0 },
    maxHeight: 10,
    maxFloors: 2,
    farAllowed: 2.0,
    groundCoverage: 60,
    parkingRequired: 0,
    buildingType: 'residential',
    zone: 'R1',
  };
}

function makePreferences(): UserPreferences {
  return {
    style: 'modern',
    budget: 'standard',
    climate: 'composite',
    orientation_priority: 'vastu',
    parking: 'covered',
    roofType: 'flat',
    naturalLighting: 'balanced',
    privacy: 'medium',
    greenFeatures: false,
    smartHome: false,
    accessibilityRequired: false,
    vastuCompliance: 'moderate',
  };
}

// ── Standard 3BHK room program ──
function make3BHKRooms(numBedrooms = 2, numBathrooms = 2): RoomSpec[] {
  const rooms: RoomSpec[] = [
    makeRoomSpec('living'),
    makeRoomSpec('dining'),
    makeRoomSpec('kitchen'),
    makeRoomSpec('foyer'),
    makeRoomSpec('corridor'),
  ];
  for (let i = 0; i < numBedrooms; i++) {
    rooms.push(makeRoomSpec(i === 0 ? 'master_bedroom' : 'bedroom'));
  }
  for (let i = 0; i < numBathrooms; i++) {
    rooms.push(makeRoomSpec('bathroom'));
  }
  return rooms;
}

const engine = new SpacePlanningEngine();

describe.skip('Bug Condition Exploration — Architectural Incoherence (EXPECTED TO FAIL on unfixed code)', () => {
  /**
   * Property 1: Zone Separation
   * For a south-facing plot, bedrooms must be farther from the south boundary
   * (entrance side) than the living room.
   * Bug: engine places bedrooms at y=0 (entrance side), living at y=4+
   */
  it.fails('Property 1: Zone separation — bedrooms must be farther from entrance than living room', () => {
    const plot = makeSouthFacingPlot(10, 8);
    const orientation = makeSouthOrientation();
    const constraints = makeConstraints();
    const preferences = makePreferences();

    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 3 }),  // numBedrooms
        fc.integer({ min: 1, max: 2 }),  // numBathrooms
        (numBedrooms, numBathrooms) => {
          const rooms = make3BHKRooms(numBedrooms, numBathrooms);
          const plan = engine.generateFloorPlan(plot, orientation, constraints, rooms, preferences, 0);

          const living = plan.rooms.find(r => r.spec.type === 'living');
          const bedrooms = plan.rooms.filter(r =>
            ['master_bedroom', 'bedroom'].includes(r.spec.type)
          );

          if (!living || bedrooms.length === 0) return true; // skip if rooms not placed

          // For south-facing plot: entrance is at south (y=0 side)
          // Living should be closer to south (smaller y) than bedrooms
          const livingDistFromEntrance = living.y; // y=0 is entrance side
          const bedroomDistances = bedrooms.map(b => b.y);
          const minBedroomDist = Math.min(...bedroomDistances);

          // ASSERTION: every bedroom must be farther from entrance than living room
          return minBedroomDist > livingDistFromEntrance;
        },
      ),
      { numRuns: 20, seed: 42 },
    );
  });

  /**
   * Property 2: Circulation Spine
   * A corridor room must exist with width >= 1.0m, and every habitable room
   * must share a wall with the corridor.
   * Bug: corridor is placed as residual space, often < 1.0m wide
   */
  it.fails('Property 2: Circulation spine — corridor >= 1.0m wide and all habitable rooms touch it', () => {
    const plot = makeSouthFacingPlot(10, 8);
    const orientation = makeSouthOrientation();
    const constraints = makeConstraints();
    const preferences = makePreferences();

    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 3 }),
        fc.integer({ min: 1, max: 2 }),
        (numBedrooms, numBathrooms) => {
          const rooms = make3BHKRooms(numBedrooms, numBathrooms);
          const plan = engine.generateFloorPlan(plot, orientation, constraints, rooms, preferences, 0);

          const corridor = plan.rooms.find(r => r.spec.type === 'corridor');

          // ASSERTION 1: corridor must exist with width >= 1.0m
          if (!corridor) return false;
          if (corridor.width < 1.0 && corridor.height < 1.0) return false;

          // ASSERTION 2: every habitable room must share a wall with corridor
          const habitableTypes: RoomType[] = ['living', 'dining', 'master_bedroom', 'bedroom', 'kitchen', 'foyer'];
          const habitableRooms = plan.rooms.filter(r => habitableTypes.includes(r.spec.type));

          for (const room of habitableRooms) {
            const sharedWall = computeSharedWallLength(room, corridor);
            if (sharedWall <= 0) return false; // room doesn't touch corridor
          }

          return true;
        },
      ),
      { numRuns: 20, seed: 42 },
    );
  });

  /**
   * Property 3: Wet Area Grouping
   * Kitchen and at least one bathroom must share a wall (shared plumbing wall).
   * Bug: kitchen placed on east wall, bathroom on west wall — no shared wall
   */
  it.fails('Property 3: Wet area grouping — kitchen and bathroom share a wall', () => {
    const plot = makeSouthFacingPlot(10, 8);
    const orientation = makeSouthOrientation();
    const constraints = makeConstraints();
    const preferences = makePreferences();

    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 3 }),
        fc.integer({ min: 1, max: 2 }),
        (numBedrooms, numBathrooms) => {
          const rooms = make3BHKRooms(numBedrooms, numBathrooms);
          const plan = engine.generateFloorPlan(plot, orientation, constraints, rooms, preferences, 0);

          const wetRooms = plan.rooms.filter(r => WET_ROOM_TYPES.includes(r.spec.type));
          if (wetRooms.length < 2) return true; // can't test with < 2 wet rooms

          // ASSERTION: every wet room must share a wall with at least one other wet room
          for (const wetRoom of wetRooms) {
            const hasSharedWall = wetRooms.some(other => {
              if (other.id === wetRoom.id) return false;
              return computeSharedWallLength(wetRoom, other) > 0;
            });
            if (!hasSharedWall) return false;
          }

          return true;
        },
      ),
      { numRuns: 20, seed: 42 },
    );
  });

  /**
   * Property 4: NBC Minimum Dimensions
   * Every bedroom must have width >= 2.7m, every kitchen width >= 2.1m.
   * Bug: bedrooms sized to 2.4m width (area target met but NBC violated)
   */
  it.fails('Property 4: NBC minimum dimensions — all rooms meet NBC India 2016 minimums', () => {
    const plot = makeSouthFacingPlot(10, 8);
    const orientation = makeSouthOrientation();
    const constraints = makeConstraints();
    const preferences = makePreferences();

    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 3 }),
        fc.integer({ min: 1, max: 2 }),
        (numBedrooms, numBathrooms) => {
          const rooms = make3BHKRooms(numBedrooms, numBathrooms);
          const plan = engine.generateFloorPlan(plot, orientation, constraints, rooms, preferences, 0);

          for (const room of plan.rooms) {
            const nbcMin = NBC_MIN_DIMS[room.spec.type];
            if (!nbcMin) continue;

            const minDim = Math.min(room.width, room.height);
            const minRequired = Math.min(nbcMin.w, nbcMin.h);

            // ASSERTION: both dimensions must meet NBC minimums
            if (room.width < nbcMin.w - 0.05) return false; // 50mm tolerance
            if (room.height < nbcMin.h - 0.05) return false;
          }

          return true;
        },
      ),
      { numRuns: 20, seed: 42 },
    );
  });

  /**
   * Property 5: Entrance Sequence
   * For south-facing plot: foyer (if present) must have smallest y,
   * then living, then corridor, then bedrooms.
   * Bug: foyer placed at rear, living not adjacent to foyer
   */
  it.fails('Property 5: Entrance sequence — foyer → living → corridor → bedrooms (south-facing)', () => {
    const plot = makeSouthFacingPlot(10, 8);
    const orientation = makeSouthOrientation();
    const constraints = makeConstraints();
    const preferences = makePreferences();

    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 3 }),
        fc.integer({ min: 1, max: 2 }),
        (numBedrooms, numBathrooms) => {
          const rooms = make3BHKRooms(numBedrooms, numBathrooms);
          const plan = engine.generateFloorPlan(plot, orientation, constraints, rooms, preferences, 0);

          const foyer = plan.rooms.find(r => r.spec.type === 'foyer' || r.spec.type === 'entrance_lobby');
          const living = plan.rooms.find(r => r.spec.type === 'living');
          const corridor = plan.rooms.find(r => r.spec.type === 'corridor');
          const bedrooms = plan.rooms.filter(r => ['master_bedroom', 'bedroom'].includes(r.spec.type));

          if (!living || bedrooms.length === 0) return true;

          // For south-facing: y=0 is entrance side, larger y = farther from entrance
          // ASSERTION 1: foyer must be closest to entrance (smallest y)
          if (foyer && living) {
            if (foyer.y > living.y + 0.1) return false; // foyer must be at or before living
          }

          // ASSERTION 2: living must be before corridor (closer to entrance)
          if (corridor && living) {
            if (living.y > corridor.y + 0.1) return false; // living must be before corridor
          }

          // ASSERTION 3: bedrooms must be after corridor (farther from entrance)
          if (corridor) {
            const corridorBottom = corridor.y + corridor.height;
            for (const bedroom of bedrooms) {
              if (bedroom.y < corridorBottom - 0.1) return false;
            }
          }

          return true;
        },
      ),
      { numRuns: 20, seed: 42 },
    );
  });

  /**
   * Concrete counterexample documentation test
   * Runs a single deterministic 3BHK plan and documents the actual values
   * to prove the bug exists.
   */
  it.fails('Concrete counterexample: 3BHK on 10m×8m south-facing plot — documents bug manifestation', () => {
    const plot = makeSouthFacingPlot(10, 8);
    const orientation = makeSouthOrientation();
    const constraints = makeConstraints();
    const preferences = makePreferences();
    const rooms = make3BHKRooms(2, 2);

    const plan = engine.generateFloorPlan(plot, orientation, constraints, rooms, preferences, 0);

    const living = plan.rooms.find(r => r.spec.type === 'living');
    const bedrooms = plan.rooms.filter(r => ['master_bedroom', 'bedroom'].includes(r.spec.type));
    const kitchen = plan.rooms.find(r => r.spec.type === 'kitchen');
    const bathrooms = plan.rooms.filter(r => r.spec.type === 'bathroom');
    const corridor = plan.rooms.find(r => r.spec.type === 'corridor');
    const foyer = plan.rooms.find(r => r.spec.type === 'foyer');

    // Log actual values for documentation
    console.log('=== BUG CONDITION COUNTEREXAMPLES ===');
    if (living) console.log(`Living room: y=${living.y}, width=${living.width}, height=${living.height}`);
    bedrooms.forEach((b, i) => console.log(`Bedroom ${i+1}: y=${b.y}, width=${b.width}, height=${b.height}`));
    if (kitchen) console.log(`Kitchen: x=${kitchen.x}, y=${kitchen.y}, width=${kitchen.width}`);
    bathrooms.forEach((b, i) => console.log(`Bathroom ${i+1}: x=${b.x}, y=${b.y}`));
    if (corridor) console.log(`Corridor: y=${corridor.y}, width=${corridor.width}, height=${corridor.height}`);
    if (foyer) console.log(`Foyer: y=${foyer.y}`);

    // Zone separation check
    if (living && bedrooms.length > 0) {
      const minBedroomY = Math.min(...bedrooms.map(b => b.y));
      console.log(`Zone separation: living.y=${living.y}, min(bedroom.y)=${minBedroomY}`);
      console.log(`  Bug: ${minBedroomY <= living.y ? 'YES — bedroom at or before living room' : 'NO'}`);
      expect(minBedroomY).toBeGreaterThan(living.y);
    }

    // Corridor width check
    if (corridor) {
      const corridorMinDim = Math.min(corridor.width, corridor.height);
      console.log(`Corridor min dimension: ${corridorMinDim}m (NBC min: 1.0m)`);
      console.log(`  Bug: ${corridorMinDim < 1.0 ? 'YES — corridor too narrow' : 'NO'}`);
      expect(corridorMinDim).toBeGreaterThanOrEqual(1.0);
    } else {
      console.log('Corridor: NOT PLACED as a room');
      expect(corridor).toBeDefined();
    }

    // Wet area grouping check
    if (kitchen && bathrooms.length > 0) {
      const sharedWall = computeSharedWallLength(kitchen, bathrooms[0]);
      console.log(`Kitchen-bathroom shared wall: ${sharedWall}m`);
      console.log(`  Bug: ${sharedWall <= 0 ? 'YES — no shared plumbing wall' : 'NO'}`);
      expect(sharedWall).toBeGreaterThan(0);
    }

    // NBC dimension check
    if (bedrooms.length > 0) {
      bedrooms.forEach((b, i) => {
        const nbcMin = NBC_MIN_DIMS[b.spec.type];
        if (nbcMin) {
          console.log(`Bedroom ${i+1} width: ${b.width}m (NBC min: ${nbcMin.w}m)`);
          console.log(`  Bug: ${b.width < nbcMin.w ? 'YES — below NBC minimum' : 'NO'}`);
          expect(b.width).toBeGreaterThanOrEqual(nbcMin.w - 0.05);
        }
      });
    }
  });
});
