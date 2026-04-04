// Feature: space-planning-accuracy-and-tools, Property 1: Boundary Invariant After Clamp
// Validates: Requirements 1.1, 1.2

import { describe, it, expect } from 'vitest';
import { clampToEnvelope } from '../SpacePlanningEngine';
import type { PlacedRoom, SetbackRequirements, PlotDimensions } from '../types';

function makeRoom(overrides: Partial<PlacedRoom> = {}): PlacedRoom {
  return {
    id: 'r1',
    x: 2,
    y: 3,
    width: 4,
    height: 5,
    rotation: 0,
    floor: 0,
    wallThickness: 0.23,
    finishFloor: 'tiles',
    finishWall: 'paint',
    finishCeiling: 'paint',
    ceilingHeight: 2.7,
    color: '#cccccc',
    spec: { type: 'living', priority: 'essential', minArea: 10, maxArea: 30, minWidth: 3, minDepth: 3, adjacentTo: [], awayFrom: [] } as any,
    doors: [],
    windows: [],
    ...overrides,
  };
}

const setbacks: SetbackRequirements = { front: 3, rear: 2, left: 1.5, right: 1.5 };
const plot: PlotDimensions = { width: 15, depth: 20, area: 300, shape: 'rectangular', unit: 'meters' };

describe('clampToEnvelope', () => {
  describe('no correction needed', () => {
    it('returns corrected=false when room is exactly at boundary', () => {
      // Room at exactly the left/front setback boundary
      const room = makeRoom({ x: setbacks.left, y: setbacks.front, width: 4, height: 5 });
      const result = clampToEnvelope(room, setbacks, plot);
      expect(result.corrected).toBe(false);
      expect(result.deltaX).toBe(0);
      expect(result.deltaY).toBe(0);
      expect(result.room.x).toBe(setbacks.left);
      expect(result.room.y).toBe(setbacks.front);
    });

    it('returns corrected=false when room fits well within envelope', () => {
      const room = makeRoom({ x: 3, y: 5, width: 4, height: 5 });
      const result = clampToEnvelope(room, setbacks, plot);
      expect(result.corrected).toBe(false);
    });
  });

  describe('clamping to left/front boundary', () => {
    it('clamps room entirely outside plot (negative x) to left setback', () => {
      const room = makeRoom({ x: -10, y: 5, width: 4, height: 5 });
      const result = clampToEnvelope(room, setbacks, plot);
      expect(result.room.x).toBe(setbacks.left);
      expect(result.corrected).toBe(true);
      expect(result.deltaX).toBeCloseTo(setbacks.left - (-10));
    });

    it('clamps room with y < front setback to front setback', () => {
      const room = makeRoom({ x: 3, y: 0, width: 4, height: 5 });
      const result = clampToEnvelope(room, setbacks, plot);
      expect(result.room.y).toBe(setbacks.front);
      expect(result.corrected).toBe(true);
    });
  });

  describe('clamping to right/rear boundary', () => {
    it('clamps room that exceeds right boundary', () => {
      // maxX = 15 - 1.5 - 4 = 9.5
      const room = makeRoom({ x: 12, y: 5, width: 4, height: 5 });
      const result = clampToEnvelope(room, setbacks, plot);
      expect(result.room.x).toBe(9.5);
      expect(result.corrected).toBe(true);
      expect(result.deltaX).toBeCloseTo(9.5 - 12);
    });

    it('clamps room that exceeds rear boundary', () => {
      // maxY = 20 - 2 - 5 = 13
      const room = makeRoom({ x: 3, y: 16, width: 4, height: 5 });
      const result = clampToEnvelope(room, setbacks, plot);
      expect(result.room.y).toBe(13);
      expect(result.corrected).toBe(true);
    });
  });

  describe('Property 1: Boundary Invariant After Clamp', () => {
    it('clamped room always satisfies envelope bounds', () => {
      const testCases = [
        makeRoom({ x: -5, y: -5, width: 4, height: 5 }),
        makeRoom({ x: 100, y: 100, width: 4, height: 5 }),
        makeRoom({ x: 0, y: 0, width: 4, height: 5 }),
        makeRoom({ x: 7, y: 10, width: 4, height: 5 }),
        makeRoom({ x: -1, y: 15, width: 4, height: 5 }),
      ];
      for (const room of testCases) {
        const { room: clamped } = clampToEnvelope(room, setbacks, plot);
        expect(clamped.x).toBeGreaterThanOrEqual(setbacks.left);
        expect(clamped.y).toBeGreaterThanOrEqual(setbacks.front);
        expect(clamped.x + clamped.width).toBeLessThanOrEqual(plot.width - setbacks.right);
        expect(clamped.y + clamped.height).toBeLessThanOrEqual(plot.depth - setbacks.rear);
      }
    });
  });
});
