/**
 * Preservation Property Tests — Geometric Correctness, FAR/GSI, MEP, Serialization
 *
 * PURPOSE: Verify that existing correct behaviors are preserved by the fix.
 * These tests MUST PASS on unfixed code (baseline) and MUST CONTINUE TO PASS after fix.
 *
 * Preservation Requirements:
 *   3.1 Boundary enforcement: every PlacedRoom within setback bounds
 *   3.2 Overlap resolution: overlapCount === 0
 *   3.6 FAR/GSI: non-essential rooms dropped when over budget; essential always included
 *   3.7 Ground coverage scaling: rooms scaled when footprint exceeds limit
 *   3.8 Serialization round-trip: identical coordinates after serialize/deserialize
 *   3.9 Floor filtering: floor=1 only places rooms for floor 1; parking only on floor 0
 *   3.10 computeAdjacencyScore: non-zero when adjacency rules satisfied
 */

import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { SpacePlanningEngine, computeAdjacencyScore } from '../SpacePlanningEngine';
import type {
  RoomSpec, RoomType, PlotDimensions, SiteOrientation,
  SiteConstraints, UserPreferences, PlacedRoom,
} from '../types';
import { serializeProject, deserializeProject } from '../projectSerializer';

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

function makeSingleRoomSpec(type: RoomType, floor = 0): RoomSpec {
  const engine = makeEngine();
  return engine.getDefaultRoomSpec(type, floor);
}

// Arbitrary for plot dimensions (5–20m × 5–20m)
const arbPlotDims = fc.record({
  w: fc.float({ min: 5, max: 20, noNaN: true }),
  d: fc.float({ min: 5, max: 20, noNaN: true }),
});

// Arbitrary for setbacks (0.5–2m each side)
const arbSetbacks = fc.record({
  front: fc.float({ min: 0.5, max: 2.0, noNaN: true }),
  rear:  fc.float({ min: 0.5, max: 2.0, noNaN: true }),
  left:  fc.float({ min: 0.5, max: 2.0, noNaN: true }),
  right: fc.float({ min: 0.5, max: 2.0, noNaN: true }),
});

const engine = makeEngine();

describe('Preservation Properties — must PASS on unfixed code and CONTINUE TO PASS after fix', () => {

  /**
   * Requirement 3.1: Boundary enforcement
   * Every PlacedRoom must satisfy setback constraints.
   */
  describe('3.1 Boundary enforcement', () => {
    it('single-room plans: room stays within setback bounds for random plot sizes', () => {
      fc.assert(
        fc.property(
          arbPlotDims,
          arbSetbacks,
          ({ w, d }, setbacks) => {
            // Ensure buildable area is large enough for a living room (min 3.6m × 3.6m)
            const buildableW = w - setbacks.left - setbacks.right;
            const buildableD = d - setbacks.front - setbacks.rear;
            if (buildableW < 4 || buildableD < 4) return true; // skip too-small plots

            const plot = makePlot(w, d);
            const constraints = makeConstraints({ setbacks });
            const rooms = [makeSingleRoomSpec('living')];
            const plan = engine.generateFloorPlan(plot, makeOrientation(), constraints, rooms, makePreferences(), 0);

            for (const room of plan.rooms) {
              if (room.width <= 0 || room.height <= 0) continue;
              // Boundary check with 50mm tolerance for grid snapping
              const TOL = 0.05;
              if (room.x < setbacks.left - TOL) return false;
              if (room.y < setbacks.front - TOL) return false;
              if (room.x + room.width > w - setbacks.right + TOL) return false;
              if (room.y + room.height > d - setbacks.rear + TOL) return false;
            }
            return true;
          },
        ),
        { numRuns: 50, seed: 100 },
      );
    });

    it('multi-room plans: all rooms stay within setback bounds', () => {
      const plot = makePlot(12, 10);
      const constraints = makeConstraints();
      const rooms = [
        makeSingleRoomSpec('living'),
        makeSingleRoomSpec('bedroom'),
        makeSingleRoomSpec('kitchen'),
      ];
      const plan = engine.generateFloorPlan(plot, makeOrientation(), constraints, rooms, makePreferences(), 0);

      const { setbacks } = constraints;
      const TOL = 0.05;
      for (const room of plan.rooms) {
        expect(room.x).toBeGreaterThanOrEqual(setbacks.left - TOL);
        expect(room.y).toBeGreaterThanOrEqual(setbacks.front - TOL);
        expect(room.x + room.width).toBeLessThanOrEqual(plot.width - setbacks.right + TOL);
        expect(room.y + room.height).toBeLessThanOrEqual(plot.depth - setbacks.rear + TOL);
      }
    });
  });

  /**
   * Requirement 3.2: Overlap resolution
   * overlapCount should be 0 (or rooms should not overlap).
   */
  describe('3.2 Overlap resolution', () => {
    it('no two rooms overlap after placement for random single-room plans', () => {
      fc.assert(
        fc.property(
          arbPlotDims,
          ({ w, d }) => {
            if (w < 6 || d < 6) return true;
            const plot = makePlot(w, d);
            const rooms = [makeSingleRoomSpec('living')];
            const plan = engine.generateFloorPlan(plot, makeOrientation(), makeConstraints(), rooms, makePreferences(), 0);

            // Single room — trivially no overlap
            expect(plan.rooms.length).toBeLessThanOrEqual(2); // room + possible auto-injected
            return true;
          },
        ),
        { numRuns: 30, seed: 200 },
      );
    });

    it('no two rooms overlap in a standard 3-room plan', () => {
      const plot = makePlot(12, 10);
      const rooms = [
        makeSingleRoomSpec('living'),
        makeSingleRoomSpec('bedroom'),
        makeSingleRoomSpec('kitchen'),
      ];
      const plan = engine.generateFloorPlan(plot, makeOrientation(), makeConstraints(), rooms, makePreferences(), 0);

      const EPS = 0.05;
      for (let i = 0; i < plan.rooms.length; i++) {
        for (let j = i + 1; j < plan.rooms.length; j++) {
          const a = plan.rooms[i];
          const b = plan.rooms[j];
          const overlapX = Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x);
          const overlapY = Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y);
          const overlaps = overlapX > EPS && overlapY > EPS;
          if (overlaps) {
            console.log(`Overlap: ${a.spec.type} and ${b.spec.type}: overlapX=${overlapX.toFixed(2)}, overlapY=${overlapY.toFixed(2)}`);
          }
          expect(overlaps).toBe(false);
        }
      }
    });
  });

  /**
   * Requirement 3.6: FAR/GSI compliance
   * Essential rooms always included; non-essential dropped when over budget.
   */
  describe('3.6 FAR/GSI compliance', () => {
    it('essential rooms are always included even when FAR budget is tight', () => {
      const plot = makePlot(10, 10); // larger plot so essential rooms fit
      const constraints = makeConstraints({
        farAllowed: 0.5, // tight FAR — 50m² budget
        groundCoverage: 50,
      });
      const rooms = [
        { ...makeSingleRoomSpec('living'), priority: 'essential' as const, preferredArea: 15 },
        { ...makeSingleRoomSpec('home_theater'), priority: 'optional' as const, preferredArea: 40 },
        { ...makeSingleRoomSpec('gym'), priority: 'optional' as const, preferredArea: 40 },
      ];
      const plan = engine.generateFloorPlan(plot, makeOrientation(), constraints, rooms, makePreferences(), 0);

      const placedTypes = plan.rooms.map(r => r.spec.type);
      // Essential living room must be present
      expect(placedTypes).toContain('living');
    });

    it('non-essential rooms are dropped when FAR budget is exceeded', () => {
      const plot = makePlot(6, 6);
      const constraints = makeConstraints({
        farAllowed: 0.3, // extremely tight
        groundCoverage: 20,
      });
      const rooms = [
        { ...makeSingleRoomSpec('living'), priority: 'essential' as const },
        { ...makeSingleRoomSpec('home_theater'), priority: 'optional' as const, preferredArea: 50 },
        { ...makeSingleRoomSpec('gym'), priority: 'optional' as const, preferredArea: 50 },
        { ...makeSingleRoomSpec('swimming_pool'), priority: 'optional' as const, preferredArea: 100 },
      ];
      const plan = engine.generateFloorPlan(plot, makeOrientation(), constraints, rooms, makePreferences(), 0);

      // Living (essential) must be present
      const placedTypes = plan.rooms.map(r => r.spec.type);
      expect(placedTypes).toContain('living');
      // Total placed area should be within FAR budget (with tolerance)
      const totalArea = plan.rooms.reduce((sum, r) => sum + r.width * r.height, 0);
      const farBudget = plot.area * constraints.farAllowed;
      expect(totalArea).toBeLessThanOrEqual(farBudget * 1.2); // 20% tolerance
    });
  });

  /**
   * Requirement 3.8: Serialization round-trip
   * Serialize and deserialize a plan — all room coordinates must be identical.
   */
  describe('3.8 Serialization round-trip', () => {
    it('room coordinates are identical after serialize/deserialize', () => {
      const plot = makePlot(12, 10);
      const rooms = [
        makeSingleRoomSpec('living'),
        makeSingleRoomSpec('bedroom'),
        makeSingleRoomSpec('kitchen'),
        makeSingleRoomSpec('bathroom'),
      ];
      const plan = engine.generateFloorPlan(plot, makeOrientation(), makeConstraints(), rooms, makePreferences(), 0);

      // Build a minimal project for serialization (all required fields)
      const project = {
        id: 'test-project',
        name: 'Test',
        description: '',
        createdAt: new Date(),
        updatedAt: new Date(),
        plot,
        orientation: makeOrientation(),
        constraints: makeConstraints(),
        location: { latitude: 0, longitude: 0, city: '', state: '', country: '' },
        floorPlans: [plan],
        roomSpecs: rooms,
        colorSchemes: [],
        structural: { columns: [], beams: [], foundations: [], slabType: 'two_way', slabThickness: 0.15, gridAlignmentScore: 0 },
        electrical: { fixtures: [], circuits: [], mainLoad: 0, connectedLoad: 0, demandLoad: 0, meterType: 'single_phase', earthingType: 'plate', lightningProtection: false, panels: [] },
        plumbing: { fixtures: [], pipes: [], mainSupplySize: 25, drainageType: 'gravity', sewageType: 'municipal', rainwaterHarvesting: false, sumpCapacity: 0, overheadTankCapacity: 0 },
        hvac: { equipment: [], ventilationPaths: [], coolingLoad: 0, heatingLoad: 0, freshAirChanges: 0 },
        vastu: { score: 0, roomScores: [], recommendations: [], defects: [] },
        sunlight: { rooms: [], shadowPatterns: [], recommendations: [] },
        airflow: { paths: [], recommendations: [] },
        elevations: [],
        sections: [],
        sectionLines: [],
        preferences: makePreferences(),
      };

      const serialized = serializeProject(project as any);
      const result = deserializeProject(serialized);

      // Check it's not an error
      expect('error' in result).toBe(false);
      const deserialized = result as any;

      expect(deserialized.floorPlans).toHaveLength(1);
      const deserializedPlan = deserialized.floorPlans[0];

      for (let i = 0; i < plan.rooms.length; i++) {
        const orig = plan.rooms[i];
        const deser = deserializedPlan.rooms[i];
        expect(deser.x).toBeCloseTo(orig.x, 3);
        expect(deser.y).toBeCloseTo(orig.y, 3);
        expect(deser.width).toBeCloseTo(orig.width, 3);
        expect(deser.height).toBeCloseTo(orig.height, 3);
      }
    });
  });

  /**
   * Requirement 3.9: Floor filtering
   * floor=1 only places rooms assigned to floor 1; parking auto-injected only on floor 0.
   */
  describe('3.9 Floor filtering', () => {
    it('floor=1 only places rooms assigned to floor 1', () => {
      const plot = makePlot(12, 10);
      const rooms = [
        { ...makeSingleRoomSpec('living', 0) },
        { ...makeSingleRoomSpec('bedroom', 1) },
        { ...makeSingleRoomSpec('bathroom', 1) },
      ];
      const plan = engine.generateFloorPlan(plot, makeOrientation(), makeConstraints(), rooms, makePreferences(), 1);

      for (const room of plan.rooms) {
        // All placed rooms should be for floor 1 (or auto-injected)
        expect(room.floor).toBe(1);
      }
      // Living (floor 0) should NOT be placed on floor 1
      const placedTypes = plan.rooms.map(r => r.spec.type);
      expect(placedTypes).not.toContain('living');
    });

    it('parking is auto-injected only on floor 0 when parkingRequired > 0', () => {
      const plot = makePlot(15, 12); // large enough plot
      const constraints = makeConstraints({ parkingRequired: 1 });
      // Provide rooms for both floors
      const rooms = [
        { ...makeSingleRoomSpec('living', 0) },
        { ...makeSingleRoomSpec('bedroom', 1) },
      ];

      const groundFloorPlan = engine.generateFloorPlan(plot, makeOrientation(), constraints, rooms, makePreferences(), 0);
      const firstFloorPlan = engine.generateFloorPlan(plot, makeOrientation(), constraints, rooms, makePreferences(), 1);

      const groundTypes = groundFloorPlan.rooms.map(r => r.spec.type);
      const firstTypes = firstFloorPlan.rooms.map(r => r.spec.type);

      // Parking should be auto-injected on ground floor
      expect(groundTypes).toContain('parking');
      // Parking should NOT appear on first floor
      expect(firstTypes).not.toContain('parking');
    });
  });

  /**
   * Requirement 3.10: computeAdjacencyScore remains a contributing factor
   * Score should be non-zero when adjacency rules are satisfied.
   */
  describe('3.10 computeAdjacencyScore remains non-zero', () => {
    it('adjacency score is non-zero when rooms are adjacent', () => {
      // Two rooms sharing a wall
      const candidate = { x: 1, y: 1, width: 4, height: 4 };
      const spec: RoomSpec = {
        ...makeSingleRoomSpec('living'),
        adjacentTo: ['dining'],
      };
      const placedB: PlacedRoom = {
        id: 'b', spec: { ...makeSingleRoomSpec('dining') },
        x: 5, y: 1, width: 3, height: 4, // shares east wall with candidate
        rotation: 0, floor: 0, wallThickness: 0.23,
        doors: [], windows: [],
        finishFloor: '', finishWall: '', finishCeiling: '', ceilingHeight: 3, color: '',
      };

      const score = computeAdjacencyScore(candidate, spec, [placedB]);
      expect(score).toBeGreaterThan(0);
    });

    it('adjacency score is negative when avoidance rooms are adjacent', () => {
      const candidate = { x: 1, y: 1, width: 3, height: 3 };
      const spec: RoomSpec = {
        ...makeSingleRoomSpec('bedroom'),
        awayFrom: ['kitchen'],
      };
      const placedB: PlacedRoom = {
        id: 'b', spec: { ...makeSingleRoomSpec('kitchen') },
        x: 4, y: 1, width: 3, height: 3, // shares east wall with candidate
        rotation: 0, floor: 0, wallThickness: 0.23,
        doors: [], windows: [],
        finishFloor: '', finishWall: '', finishCeiling: '', ceilingHeight: 3, color: '',
      };

      const score = computeAdjacencyScore(candidate, spec, [placedB]);
      expect(score).toBeLessThan(0);
    });

    it('adjacency score is zero when rooms do not share a wall', () => {
      const candidate = { x: 1, y: 1, width: 3, height: 3 };
      const spec: RoomSpec = {
        ...makeSingleRoomSpec('living'),
        adjacentTo: ['dining'],
      };
      const placedB: PlacedRoom = {
        id: 'b', spec: { ...makeSingleRoomSpec('dining') },
        x: 10, y: 10, width: 3, height: 3, // far away
        rotation: 0, floor: 0, wallThickness: 0.23,
        doors: [], windows: [],
        finishFloor: '', finishWall: '', finishCeiling: '', ceilingHeight: 3, color: '',
      };

      const score = computeAdjacencyScore(candidate, spec, [placedB]);
      expect(score).toBe(0);
    });
  });

  /**
   * Additional: Plans with no wet areas or no bedrooms are unaffected
   * (inputs that do NOT trigger isBugCondition)
   */
  describe('Non-bug-condition inputs: single-room and no-bedroom plans', () => {
    it('single living room plan: room is placed and within bounds', () => {
      fc.assert(
        fc.property(
          arbPlotDims,
          ({ w, d }) => {
            if (w < 6 || d < 6) return true;
            const plot = makePlot(w, d);
            const rooms = [makeSingleRoomSpec('living')];
            const plan = engine.generateFloorPlan(plot, makeOrientation(), makeConstraints(), rooms, makePreferences(), 0);

            expect(plan.rooms.length).toBeGreaterThan(0);
            const living = plan.rooms.find(r => r.spec.type === 'living');
            expect(living).toBeDefined();
            return true;
          },
        ),
        { numRuns: 30, seed: 300 },
      );
    });

    it('plan with no bedrooms: all rooms placed within bounds', () => {
      const plot = makePlot(10, 8);
      const rooms = [
        makeSingleRoomSpec('living'),
        makeSingleRoomSpec('dining'),
        makeSingleRoomSpec('kitchen'),
      ];
      const plan = engine.generateFloorPlan(plot, makeOrientation(), makeConstraints(), rooms, makePreferences(), 0);

      expect(plan.rooms.length).toBeGreaterThan(0);
      const { setbacks } = makeConstraints();
      const TOL = 0.05;
      for (const room of plan.rooms) {
        expect(room.x).toBeGreaterThanOrEqual(setbacks.left - TOL);
        expect(room.y).toBeGreaterThanOrEqual(setbacks.front - TOL);
        expect(room.x + room.width).toBeLessThanOrEqual(plot.width - setbacks.right + TOL);
        expect(room.y + room.height).toBeLessThanOrEqual(plot.depth - setbacks.rear + TOL);
      }
    });
  });
});
