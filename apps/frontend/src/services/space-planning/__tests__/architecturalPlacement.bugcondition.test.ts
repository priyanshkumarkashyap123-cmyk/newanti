/**
 * Bug Condition Exploration Tests — Architectural Incoherence
 *
 * PURPOSE: Verify that the FIXED engine satisfies all five architectural correctness properties.
 * These tests encode the EXPECTED behavior after the fix.
 *
 * Bug Conditions (from bugfix.md):
 *   C1 hasPublicPrivateMixing   — bedrooms placed closer to entrance than living room
 *   C2 missingCirculationSpine  — no corridor of width ≥ 1.0m connecting habitable rooms
 *   C3 wetAreasIsolated         — kitchen/bathroom placed with no shared wall with other wet areas
 *   C4 dimensionViolation       — room.width < NBC_MIN_DIMS[type].w
 *   C5 noEntranceSequence       — living not between entrance and bedroom zone
 *
 * Scoped to: standard 3BHK program on a 14m × 12m south-facing plot (adequate for full 3BHK).
 */

import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { SpacePlanningEngine } from '../SpacePlanningEngine';
import type {
  RoomSpec, RoomType, PlotDimensions, SiteOrientation,
  SiteConstraints, UserPreferences, PlacedRoom,
} from '../types';

// ── Helpers ──

function makeEngine() {
  return new SpacePlanningEngine();
}

function makePlot(w: number, d: number): PlotDimensions {
  return { width: w, depth: d, area: w * d, shape: 'rectangular', unit: 'meters' };
}

function makeOrientation(entry: 'S' | 'N' | 'E' | 'W' = 'S'): SiteOrientation {
  return { northDirection: 0, plotFacing: entry, mainEntryDirection: entry, roadSide: [entry] };
}

function makeConstraints(overrides: Partial<SiteConstraints> = {}): SiteConstraints {
  return {
    setbacks: { front: 1.5, rear: 1.0, left: 1.0, right: 1.0 },
    maxHeight: 10,
    maxFloors: 2,
    farAllowed: 2.0,
    groundCoverage: 60,
    parkingRequired: 0,
    buildingType: 'residential',
    zone: 'R1',
    ...overrides,
  };
}

function makePreferences(): UserPreferences {
  return {
    style: 'modern',
    budget: 'standard',
    climate: 'composite',
    orientation_priority: 'sunlight',
    parking: 'covered',
    roofType: 'flat',
    naturalLighting: 'balanced',
    privacy: 'medium',
    greenFeatures: false,
    smartHome: false,
    accessibilityRequired: false,
    vastuCompliance: 'optional',
  };
}

function makeRoomSpec(type: RoomType, floor = 0): RoomSpec {
  return makeEngine().getDefaultRoomSpec(type, floor);
}

/** NBC minimum clear dimensions (from bugfix.md) */
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

/** Distance from south entrance (smaller y = closer to entrance) */
function distFromSouthEntrance(r: PlacedRoom): number {
  return r.y;
}

/** Check if two rooms share a wall (touching edge, not just corner) */
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

// Standard 3BHK plot — 14×12 gives buildable 12×9.5m, enough for full 3BHK
const STANDARD_PLOT = makePlot(14, 12);

describe('Bug Condition Exploration Tests — EXPECTED TO PASS after fix', () => {

  /**
   * C1: Zone separation — bedrooms must be farther from entrance than living room.
   * For south-facing plot: bedroom.y > living.y (bedrooms at rear, living at front).
   */
  describe('C1: Zone separation (public/private)', () => {
    it('standard 3BHK: all bedrooms are farther from entrance than living room', () => {
      const rooms = [
        makeRoomSpec('living'),
        makeRoomSpec('dining'),
        makeRoomSpec('kitchen'),
        makeRoomSpec('master_bedroom'),
        makeRoomSpec('bedroom'),
        makeRoomSpec('bathroom'),
        makeRoomSpec('corridor'),
        makeRoomSpec('foyer'),
      ];
      const plan = engine.generateFloorPlan(STANDARD_PLOT, makeOrientation('S'), makeConstraints(), rooms, makePreferences(), 0);

      const living = plan.rooms.find(r => r.spec.type === 'living');
      const bedrooms = plan.rooms.filter(r =>
        ['master_bedroom', 'bedroom'].includes(r.spec.type),
      );

      expect(living).toBeDefined();
      expect(bedrooms.length).toBeGreaterThan(0);

      const livingDist = distFromSouthEntrance(living!);
      for (const bedroom of bedrooms) {
        const bedroomDist = distFromSouthEntrance(bedroom);
        expect(bedroomDist).toBeGreaterThan(livingDist);
      }
    });

    it('PBT: for random 1–3 bedroom programs, bedrooms always at rear of south-facing plot', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 3 }),
          fc.integer({ min: 1, max: 2 }),
          (numBedrooms, numBathrooms) => {
            const rooms: RoomSpec[] = [
              makeRoomSpec('living'),
              makeRoomSpec('kitchen'),
            ];
            for (let i = 0; i < numBedrooms; i++) {
              rooms.push({ ...makeRoomSpec('bedroom'), id: `bedroom-${i}` });
            }
            for (let i = 0; i < numBathrooms; i++) {
              rooms.push({ ...makeRoomSpec('bathroom'), id: `bathroom-${i}` });
            }

            // Use a larger plot to ensure all rooms fit (3 bedrooms need ~12m width)
            const plot = makePlot(14, 12);
            const plan = engine.generateFloorPlan(plot, makeOrientation('S'), makeConstraints(), rooms, makePreferences(), 0);

            const living = plan.rooms.find(r => r.spec.type === 'living');
            const bedrooms = plan.rooms.filter(r =>
              ['master_bedroom', 'bedroom'].includes(r.spec.type),
            );

            if (!living || bedrooms.length === 0) return true;

            const livingDist = distFromSouthEntrance(living);
            // All placed bedrooms must be farther from entrance than living room
            return bedrooms.every(b => distFromSouthEntrance(b) > livingDist);
          },
        ),
        { numRuns: 30, seed: 42 },
      );
    });
  });

  /**
   * C2: Circulation spine — a corridor of width ≥ 1.0m must exist.
   */
  describe('C2: Circulation spine exists', () => {
    it('standard 3BHK: a corridor room with width >= 1.0m exists', () => {
      const rooms = [
        makeRoomSpec('living'),
        makeRoomSpec('dining'),
        makeRoomSpec('kitchen'),
        makeRoomSpec('master_bedroom'),
        makeRoomSpec('bedroom'),
        makeRoomSpec('bathroom'),
        makeRoomSpec('corridor'),
        makeRoomSpec('foyer'),
      ];
      const plan = engine.generateFloorPlan(STANDARD_PLOT, makeOrientation('S'), makeConstraints(), rooms, makePreferences(), 0);

      // Either a corridor room or the generated corridors array must have width >= 1.0
      const corridorRoom = plan.rooms.find(r => r.spec.type === 'corridor');
      const corridorFromList = plan.corridors.find(c => c.width >= 1.0 || c.height >= 1.0);

      const hasSpine = (corridorRoom && (corridorRoom.width >= 1.0 || corridorRoom.height >= 1.0))
        || corridorFromList !== undefined;

      expect(hasSpine).toBe(true);
    });

    it('PBT: corridor spine always present for plans with >= 3 habitable rooms', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 3 }),
          (numBedrooms) => {
            const rooms: RoomSpec[] = [
              makeRoomSpec('living'),
              makeRoomSpec('kitchen'),
            ];
            for (let i = 0; i < numBedrooms; i++) {
              rooms.push({ ...makeRoomSpec('bedroom'), id: `bedroom-${i}` });
            }

            const plot = makePlot(14, 12);
            const plan = engine.generateFloorPlan(plot, makeOrientation('S'), makeConstraints(), rooms, makePreferences(), 0);

            const corridorRoom = plan.rooms.find(r => r.spec.type === 'corridor');
            const corridorFromList = plan.corridors.find(c => c.width >= 1.0 || c.height >= 1.0);

            return (corridorRoom !== undefined && (corridorRoom.width >= 1.0 || corridorRoom.height >= 1.0))
              || corridorFromList !== undefined;
          },
        ),
        { numRuns: 30, seed: 43 },
      );
    });
  });

  /**
   * C3: Wet area grouping — kitchen and at least one bathroom must share a wall.
   */
  describe('C3: Wet area grouping', () => {
    it('standard 3BHK: kitchen and at least one bathroom share a wall', () => {
      const rooms = [
        makeRoomSpec('living'),
        makeRoomSpec('dining'),
        makeRoomSpec('kitchen'),
        makeRoomSpec('master_bedroom'),
        makeRoomSpec('bedroom'),
        makeRoomSpec('bathroom'),
        makeRoomSpec('corridor'),
        makeRoomSpec('foyer'),
      ];
      const plan = engine.generateFloorPlan(STANDARD_PLOT, makeOrientation('S'), makeConstraints(), rooms, makePreferences(), 0);

      const kitchen = plan.rooms.find(r => r.spec.type === 'kitchen');
      const bathrooms = plan.rooms.filter(r => ['bathroom', 'toilet'].includes(r.spec.type));

      expect(kitchen).toBeDefined();
      expect(bathrooms.length).toBeGreaterThan(0);

      const anyShared = bathrooms.some(b => sharesWall(kitchen!, b));
      expect(anyShared).toBe(true);
    });
  });

  /**
   * C4: NBC minimum dimensions — every room must meet NBC minimum width and depth.
   */
  describe('C4: NBC minimum dimensions', () => {
    it('standard 3BHK: all rooms meet NBC minimum dimensions', () => {
      const rooms = [
        makeRoomSpec('living'),
        makeRoomSpec('dining'),
        makeRoomSpec('kitchen'),
        makeRoomSpec('master_bedroom'),
        makeRoomSpec('bedroom'),
        makeRoomSpec('bathroom'),
        makeRoomSpec('corridor'),
        makeRoomSpec('foyer'),
      ];
      const plan = engine.generateFloorPlan(STANDARD_PLOT, makeOrientation('S'), makeConstraints(), rooms, makePreferences(), 0);

      for (const room of plan.rooms) {
        const min = NBC_MIN_DIMS[room.spec.type];
        if (!min) continue;
        const TOL = 0.05; // 50mm tolerance for grid snapping
        expect(room.width).toBeGreaterThanOrEqual(min.w - TOL);
        expect(room.height).toBeGreaterThanOrEqual(min.h - TOL);
      }
    });

    it('PBT: bedroom width always >= 2.7m, kitchen width always >= 2.1m', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 3 }),
          (numBedrooms) => {
            const rooms: RoomSpec[] = [
              makeRoomSpec('living'),
              makeRoomSpec('kitchen'),
            ];
            for (let i = 0; i < numBedrooms; i++) {
              rooms.push({ ...makeRoomSpec('bedroom'), id: `bedroom-${i}` });
            }

            const plot = makePlot(14, 12);
            const plan = engine.generateFloorPlan(plot, makeOrientation('S'), makeConstraints(), rooms, makePreferences(), 0);

            const TOL = 0.05;
            for (const room of plan.rooms) {
              if (room.spec.type === 'bedroom' || room.spec.type === 'master_bedroom') {
                if (room.width < NBC_MIN_DIMS.bedroom!.w - TOL) return false;
              }
              if (room.spec.type === 'kitchen') {
                if (room.width < NBC_MIN_DIMS.kitchen!.w - TOL) return false;
              }
            }
            return true;
          },
        ),
        { numRuns: 30, seed: 44 },
      );
    });
  });

  /**
   * C5: Entrance sequence — foyer (if present) has smallest y, then living, then bedrooms.
   */
  describe('C5: Entrance sequence', () => {
    it('standard 3BHK with foyer: foyer → living → bedrooms (south-facing)', () => {
      const rooms = [
        makeRoomSpec('foyer'),
        makeRoomSpec('living'),
        makeRoomSpec('dining'),
        makeRoomSpec('kitchen'),
        makeRoomSpec('master_bedroom'),
        makeRoomSpec('bedroom'),
        makeRoomSpec('bathroom'),
        makeRoomSpec('corridor'),
      ];
      const plan = engine.generateFloorPlan(STANDARD_PLOT, makeOrientation('S'), makeConstraints(), rooms, makePreferences(), 0);

      const foyer = plan.rooms.find(r => r.spec.type === 'foyer' || r.spec.type === 'entrance_lobby');
      const living = plan.rooms.find(r => r.spec.type === 'living' || r.spec.type === 'drawing_room');
      const bedrooms = plan.rooms.filter(r =>
        ['master_bedroom', 'bedroom'].includes(r.spec.type),
      );

      expect(living).toBeDefined();
      expect(bedrooms.length).toBeGreaterThan(0);

      const livingDist = distFromSouthEntrance(living!);
      const bedroomDists = bedrooms.map(distFromSouthEntrance);

      // All bedrooms farther from entrance than living
      expect(bedroomDists.every(d => d > livingDist)).toBe(true);

      // Foyer (if placed) closer to entrance than living
      if (foyer) {
        expect(distFromSouthEntrance(foyer)).toBeLessThanOrEqual(livingDist);
      }
    });
  });
});
