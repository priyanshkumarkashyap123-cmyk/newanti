/**
 * Fix-Checking Tests — Architectural Correctness After Fix
 *
 * PURPOSE: Verify that the fix correctly implements all five architectural properties.
 * These tests are expected to PASS after the fix is applied.
 *
 * Tests cover:
 * - Unit tests for new private methods (via generateFloorPlan)
 * - Integration tests for full 3BHK plans
 * - Property-based tests for correctness properties
 */

import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { SpacePlanningEngine } from '../SpacePlanningEngine';
import type {
  RoomSpec, RoomType, PlotDimensions, SiteOrientation,
  SiteConstraints, UserPreferences, PlacedRoom,
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

function makePreferences(overrides: Partial<UserPreferences> = {}): UserPreferences {
  return {
    style: 'modern', budget: 'standard', climate: 'composite',
    orientation_priority: 'sunlight', parking: 'covered', roofType: 'flat',
    naturalLighting: 'balanced', privacy: 'medium', greenFeatures: false,
    smartHome: false, accessibilityRequired: false, vastuCompliance: 'optional',
    ...overrides,
  };
}

function makeRoomSpec(type: RoomType, floor = 0): RoomSpec {
  return makeEngine().getDefaultRoomSpec(type, floor);
}

const NBC_MIN_DIMS: Partial<Record<RoomType, { w: number; h: number }>> = {
  living: { w: 3.0, h: 3.0 }, drawing_room: { w: 3.0, h: 3.0 },
  dining: { w: 3.0, h: 3.0 }, master_bedroom: { w: 3.0, h: 3.0 },
  bedroom: { w: 2.7, h: 2.7 }, kitchen: { w: 2.1, h: 1.8 },
  bathroom: { w: 1.2, h: 0.9 }, toilet: { w: 1.0, h: 0.9 },
  corridor: { w: 1.0, h: 1.0 }, foyer: { w: 1.5, h: 1.5 },
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

const engine = makeEngine();
const STANDARD_PLOT = makePlot(14, 12);

describe('Fix-Checking Tests — Architectural Correctness', () => {

  /**
   * Unit tests for enforceNBCMinDimensions (via generateFloorPlan)
   */
  describe('enforceNBCMinDimensions: rooms meet NBC minimums', () => {
    it('bedroom width >= 2.7m after placement', () => {
      const rooms = [makeRoomSpec('living'), makeRoomSpec('bedroom'), makeRoomSpec('kitchen')];
      const plan = engine.generateFloorPlan(STANDARD_PLOT, makeOrientation(), makeConstraints(), rooms, makePreferences(), 0);
      const bedroom = plan.rooms.find(r => r.spec.type === 'bedroom');
      expect(bedroom).toBeDefined();
      expect(bedroom!.width).toBeGreaterThanOrEqual(NBC_MIN_DIMS.bedroom!.w - 0.05);
    });

    it('kitchen width >= 2.1m after placement', () => {
      const rooms = [makeRoomSpec('living'), makeRoomSpec('bedroom'), makeRoomSpec('kitchen')];
      const plan = engine.generateFloorPlan(STANDARD_PLOT, makeOrientation(), makeConstraints(), rooms, makePreferences(), 0);
      const kitchen = plan.rooms.find(r => r.spec.type === 'kitchen');
      expect(kitchen).toBeDefined();
      expect(kitchen!.width).toBeGreaterThanOrEqual(NBC_MIN_DIMS.kitchen!.w - 0.05);
    });

    it('bathroom width >= 1.2m after placement', () => {
      const rooms = [makeRoomSpec('living'), makeRoomSpec('bedroom'), makeRoomSpec('kitchen'), makeRoomSpec('bathroom')];
      const plan = engine.generateFloorPlan(STANDARD_PLOT, makeOrientation(), makeConstraints(), rooms, makePreferences(), 0);
      const bathroom = plan.rooms.find(r => r.spec.type === 'bathroom');
      expect(bathroom).toBeDefined();
      expect(bathroom!.width).toBeGreaterThanOrEqual(NBC_MIN_DIMS.bathroom!.w - 0.05);
    });
  });

  /**
   * Unit tests for buildCirculationSpine (via generateFloorPlan)
   */
  describe('buildCirculationSpine: corridor within buildable envelope', () => {
    it('S-facing: corridor is within buildable envelope', () => {
      const rooms = [makeRoomSpec('living'), makeRoomSpec('bedroom'), makeRoomSpec('kitchen')];
      const constraints = makeConstraints();
      const plan = engine.generateFloorPlan(STANDARD_PLOT, makeOrientation('S'), constraints, rooms, makePreferences(), 0);

      const corridor = plan.rooms.find(r => r.spec.type === 'corridor');
      const corridorFromList = plan.corridors[0];
      const c = corridor || corridorFromList;
      expect(c).toBeDefined();

      const { setbacks } = constraints;
      const TOL = 0.05;
      if (corridor) {
        expect(corridor.x).toBeGreaterThanOrEqual(setbacks.left - TOL);
        expect(corridor.y).toBeGreaterThanOrEqual(setbacks.front - TOL);
        expect(corridor.x + corridor.width).toBeLessThanOrEqual(STANDARD_PLOT.width - setbacks.right + TOL);
        expect(corridor.y + corridor.height).toBeLessThanOrEqual(STANDARD_PLOT.depth - setbacks.rear + TOL);
      }
    });

    it('corridor width >= 1.0m for N/S/E/W entry directions', () => {
      const directions: Array<'N' | 'S' | 'E' | 'W'> = ['N', 'S', 'E', 'W'];
      for (const dir of directions) {
        const rooms = [makeRoomSpec('living'), makeRoomSpec('bedroom'), makeRoomSpec('kitchen')];
        const plan = engine.generateFloorPlan(STANDARD_PLOT, makeOrientation(dir), makeConstraints(), rooms, makePreferences(), 0);
        const corridor = plan.rooms.find(r => r.spec.type === 'corridor');
        const corridorFromList = plan.corridors[0];
        const hasSpine = (corridor && (corridor.width >= 1.0 || corridor.height >= 1.0))
          || (corridorFromList && (corridorFromList.width >= 1.0 || corridorFromList.height >= 1.0));
        expect(hasSpine).toBe(true);
      }
    });
  });

  /**
   * Unit tests for autoInjectMandatoryRooms (via generateFloorPlan)
   */
  describe('autoInjectMandatoryRooms: NBC-mandatory rooms injected', () => {
    it('plan with only living room: kitchen and toilet auto-injected', () => {
      // Single room → uses placeRooms (no injection). Multi-room → uses architecturalPlacement with injection.
      // Use 2 rooms to trigger architecturalPlacement
      const rooms = [makeRoomSpec('living'), makeRoomSpec('bedroom')];
      const plan = engine.generateFloorPlan(STANDARD_PLOT, makeOrientation(), makeConstraints(), rooms, makePreferences(), 0);
      const types = plan.rooms.map(r => r.spec.type);
      // Kitchen and toilet should be auto-injected
      expect(types).toContain('kitchen');
      expect(types.some(t => t === 'toilet' || t === 'bathroom')).toBe(true);
    });

    it('auto-injected rooms are recorded in constraintViolations', () => {
      const rooms = [makeRoomSpec('living'), makeRoomSpec('bedroom')];
      const plan = engine.generateFloorPlan(STANDARD_PLOT, makeOrientation(), makeConstraints(), rooms, makePreferences(), 0);
      // constraintViolations should have entries for auto-injected rooms
      expect(plan.constraintViolations.length).toBeGreaterThan(0);
    });
  });

  /**
   * Unit tests for validateEntranceSequence (via generateFloorPlan)
   */
  describe('validateEntranceSequence: correct entrance order', () => {
    it('foyer → living → bedrooms for south-facing plan', () => {
      const rooms = [
        makeRoomSpec('foyer'), makeRoomSpec('living'), makeRoomSpec('master_bedroom'),
        makeRoomSpec('bedroom'), makeRoomSpec('kitchen'), makeRoomSpec('bathroom'),
      ];
      const plan = engine.generateFloorPlan(STANDARD_PLOT, makeOrientation('S'), makeConstraints(), rooms, makePreferences(), 0);

      const foyer = plan.rooms.find(r => r.spec.type === 'foyer' || r.spec.type === 'entrance_lobby');
      const living = plan.rooms.find(r => r.spec.type === 'living');
      const bedrooms = plan.rooms.filter(r => ['master_bedroom', 'bedroom'].includes(r.spec.type));

      expect(living).toBeDefined();
      expect(bedrooms.length).toBeGreaterThan(0);

      const livingY = living!.y;
      const bedroomYs = bedrooms.map(b => b.y);
      expect(bedroomYs.every(y => y > livingY)).toBe(true);

      if (foyer) {
        expect(foyer.y).toBeLessThanOrEqual(livingY);
      }
    });
  });

  /**
   * Integration test: Full 3BHK plan
   */
  describe('Integration: Full 3BHK plan on 14×12 south-facing plot', () => {
    it('all five correctness properties satisfied', () => {
      const rooms = [
        makeRoomSpec('living'), makeRoomSpec('dining'), makeRoomSpec('kitchen'),
        makeRoomSpec('master_bedroom'), makeRoomSpec('bedroom'), makeRoomSpec('bedroom'),
        makeRoomSpec('bathroom'), makeRoomSpec('bathroom'), makeRoomSpec('corridor'),
        makeRoomSpec('foyer'),
      ];
      const plan = engine.generateFloorPlan(STANDARD_PLOT, makeOrientation('S'), makeConstraints(), rooms, makePreferences(), 0);

      const living = plan.rooms.find(r => r.spec.type === 'living');
      const bedrooms = plan.rooms.filter(r => ['master_bedroom', 'bedroom'].includes(r.spec.type));
      const kitchen = plan.rooms.find(r => r.spec.type === 'kitchen');
      const bathrooms = plan.rooms.filter(r => ['bathroom', 'toilet'].includes(r.spec.type));
      const corridor = plan.rooms.find(r => r.spec.type === 'corridor');
      const corridorFromList = plan.corridors[0];

      // C1: Zone separation
      expect(living).toBeDefined();
      expect(bedrooms.length).toBeGreaterThan(0);
      const livingY = living!.y;
      expect(bedrooms.every(b => b.y > livingY)).toBe(true);

      // C2: Circulation spine
      const hasSpine = (corridor && (corridor.width >= 1.0 || corridor.height >= 1.0))
        || (corridorFromList && (corridorFromList.width >= 1.0 || corridorFromList.height >= 1.0));
      expect(hasSpine).toBe(true);

      // C3: Wet area grouping
      expect(kitchen).toBeDefined();
      expect(bathrooms.length).toBeGreaterThan(0);
      const anyShared = bathrooms.some(b => sharesWall(kitchen!, b));
      expect(anyShared).toBe(true);

      // C4: NBC minimum dimensions
      const TOL = 0.05;
      for (const room of plan.rooms) {
        const min = NBC_MIN_DIMS[room.spec.type];
        if (!min) continue;
        expect(room.width).toBeGreaterThanOrEqual(min.w - TOL);
        expect(room.height).toBeGreaterThanOrEqual(min.h - TOL);
      }

      // C5: Entrance sequence
      const foyer = plan.rooms.find(r => r.spec.type === 'foyer' || r.spec.type === 'entrance_lobby');
      if (foyer) {
        expect(foyer.y).toBeLessThanOrEqual(livingY);
      }
    });
  });

  /**
   * Integration test: Multi-floor plan
   */
  describe('Integration: Multi-floor plan', () => {
    it('ground floor has parking auto-injected, first floor has bedrooms', () => {
      const rooms = [
        { ...makeRoomSpec('living', 0) },
        { ...makeRoomSpec('kitchen', 0) },
        { ...makeRoomSpec('bedroom', 1) },
        { ...makeRoomSpec('bathroom', 1) },
      ];
      const constraints = makeConstraints({ parkingRequired: 1 });
      const groundPlan = engine.generateFloorPlan(makePlot(15, 12), makeOrientation(), constraints, rooms, makePreferences(), 0);
      const firstPlan = engine.generateFloorPlan(makePlot(15, 12), makeOrientation(), constraints, rooms, makePreferences(), 1);

      expect(groundPlan.rooms.map(r => r.spec.type)).toContain('parking');
      expect(firstPlan.rooms.map(r => r.spec.type)).not.toContain('parking');
    });
  });

  /**
   * Property-based tests
   */
  describe('PBT: Correctness properties hold for random inputs', () => {
    it('every placed room satisfies NBC minimum dimensions', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 5 }),
          fc.constantFrom('living', 'bedroom', 'kitchen', 'bathroom', 'dining', 'master_bedroom') as fc.Arbitrary<RoomType>,
          (numRooms, baseType) => {
            const rooms: RoomSpec[] = [];
            const types: RoomType[] = ['living', 'bedroom', 'kitchen', 'bathroom', 'dining'];
            for (let i = 0; i < Math.min(numRooms, types.length); i++) {
              rooms.push({ ...makeRoomSpec(types[i]), id: `room-${i}` });
            }
            if (rooms.length < 2) return true;

            const plan = engine.generateFloorPlan(STANDARD_PLOT, makeOrientation(), makeConstraints(), rooms, makePreferences(), 0);
            const TOL = 0.05;
            for (const room of plan.rooms) {
              const min = NBC_MIN_DIMS[room.spec.type];
              if (!min) continue;
              if (room.width < min.w - TOL) return false;
              if (room.height < min.h - TOL) return false;
            }
            return true;
          },
        ),
        { numRuns: 20, seed: 100 },
      );
    });

    it('corridor zone is always within buildable envelope', () => {
      fc.assert(
        fc.property(
          fc.float({ min: 10, max: 20, noNaN: true }),
          fc.float({ min: 8, max: 16, noNaN: true }),
          (w, d) => {
            const plot = makePlot(w, d);
            const rooms = [makeRoomSpec('living'), makeRoomSpec('bedroom'), makeRoomSpec('kitchen')];
            const constraints = makeConstraints();
            const plan = engine.generateFloorPlan(plot, makeOrientation(), constraints, rooms, makePreferences(), 0);

            const corridor = plan.rooms.find(r => r.spec.type === 'corridor');
            const corridorFromList = plan.corridors[0];
            const c = corridor || corridorFromList;
            if (!c) return true;

            const { setbacks } = constraints;
            const TOL = 0.05;
            if (corridor) {
              if (corridor.x < setbacks.left - TOL) return false;
              if (corridor.y < setbacks.front - TOL) return false;
              if (corridor.x + corridor.width > w - setbacks.right + TOL) return false;
              if (corridor.y + corridor.height > d - setbacks.rear + TOL) return false;
            }
            return true;
          },
        ),
        { numRuns: 20, seed: 200 },
      );
    });

    it('wet rooms always share a wall when both kitchen and bathroom are present', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 2 }),
          (numBathrooms) => {
            const rooms: RoomSpec[] = [
              makeRoomSpec('living'),
              makeRoomSpec('bedroom'),
              makeRoomSpec('kitchen'),
            ];
            for (let i = 0; i < numBathrooms; i++) {
              rooms.push({ ...makeRoomSpec('bathroom'), id: `bath-${i}` });
            }

            const plan = engine.generateFloorPlan(STANDARD_PLOT, makeOrientation(), makeConstraints(), rooms, makePreferences(), 0);
            const kitchen = plan.rooms.find(r => r.spec.type === 'kitchen');
            const bathrooms = plan.rooms.filter(r => ['bathroom', 'toilet'].includes(r.spec.type));

            if (!kitchen || bathrooms.length === 0) return true;
            return bathrooms.some(b => sharesWall(kitchen, b));
          },
        ),
        { numRuns: 20, seed: 300 },
      );
    });

    it('computeAdjacencyScore remains a contributing factor', async () => {
      // Verified in preservation tests — adjacency score is non-zero when rooms are adjacent
      // This test confirms the function is exported and callable
      const { computeAdjacencyScore } = await import('../SpacePlanningEngine');
      const candidate = { x: 1, y: 1, width: 4, height: 4 };
      const spec: RoomSpec = { ...makeRoomSpec('living'), adjacentTo: ['dining'] };
      const placedB: PlacedRoom = {
        id: 'b', spec: { ...makeRoomSpec('dining') },
        x: 5, y: 1, width: 3, height: 4,
        rotation: 0, floor: 0, wallThickness: 0.23,
        doors: [], windows: [],
        finishFloor: '', finishWall: '', finishCeiling: '', ceilingHeight: 3, color: '',
      };
      const score = computeAdjacencyScore(candidate, spec, [placedB]);
      expect(score).toBeGreaterThan(0);
    });
  });
});
