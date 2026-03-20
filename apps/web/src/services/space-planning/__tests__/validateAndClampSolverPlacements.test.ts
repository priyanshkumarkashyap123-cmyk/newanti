// Feature: space-planning-accuracy-and-tools
// Tests for validateAndClampSolverPlacements

import { describe, it, expect } from 'vitest';
import { validateAndClampSolverPlacements, PlacementResponse } from '../layoutApiService';

function makePlacement(overrides: Partial<PlacementResponse> = {}): PlacementResponse {
  return {
    room_id: 'room_1',
    name: 'Living Room',
    type: 'living',
    acoustic_zone: null,
    target_area_sqm: 20,
    actual_area_sqm: 20,
    area_deviation_pct: 0,
    position: { x: 0, y: 0 },
    dimensions: { width: 4, height: 5 },
    aspect_ratio: 0.8,
    min_dimension_m: 4,
    width_valid: true,
    aspect_ratio_valid: true,
    plumbing_required: false,
    requires_exterior_wall: false,
    ...overrides,
  };
}

const defaultSetbacks = { front: 3, rear: 2, left: 1.5, right: 1.5 };
const defaultPlot = { width: 15, depth: 20 };

describe('validateAndClampSolverPlacements', () => {
  describe('setback offset application', () => {
    it('adds setback.left to x and setback.front to y for a room at solver origin (0,0)', () => {
      const placement = makePlacement({ position: { x: 0, y: 0 } });
      const result = validateAndClampSolverPlacements([placement], defaultSetbacks, defaultPlot);

      expect(result[0].position.x).toBe(defaultSetbacks.left);   // 0 + 1.5 = 1.5
      expect(result[0].position.y).toBe(defaultSetbacks.front);  // 0 + 3 = 3
    });

    it('does not clamp a room that fits within the plot after offset', () => {
      const placement = makePlacement({ position: { x: 2, y: 2 }, dimensions: { width: 4, height: 5 } });
      // rawX = 2 + 1.5 = 3.5, maxX = 15 - 1.5 - 4 = 9.5 → no clamp
      // rawY = 2 + 3 = 5, maxY = 20 - 2 - 5 = 13 → no clamp
      const result = validateAndClampSolverPlacements([placement], defaultSetbacks, defaultPlot);

      expect(result[0].position.x).toBe(3.5);
      expect(result[0].position.y).toBe(5);
      expect(result[0]._wasClamped).toBe(false);
      expect(result[0]._clampDeltaX).toBe(0);
      expect(result[0]._clampDeltaY).toBe(0);
    });
  });

  describe('clamping behaviour', () => {
    it('clamps a room that exceeds the right boundary and sets _wasClamped = true', () => {
      // Room at solver x=10, width=4: rawX = 10 + 1.5 = 11.5, maxX = 15 - 1.5 - 4 = 9.5 → clamp to 9.5
      const placement = makePlacement({ position: { x: 10, y: 0 }, dimensions: { width: 4, height: 5 } });
      const result = validateAndClampSolverPlacements([placement], defaultSetbacks, defaultPlot);

      expect(result[0].position.x).toBe(9.5);
      expect(result[0]._wasClamped).toBe(true);
      expect(result[0]._clampDeltaX).toBeCloseTo(9.5 - 11.5); // -2
    });

    it('clamps a room that exceeds the rear boundary and sets _wasClamped = true', () => {
      // Room at solver y=15, height=5: rawY = 15 + 3 = 18, maxY = 20 - 2 - 5 = 13 → clamp to 13
      const placement = makePlacement({ position: { x: 0, y: 15 }, dimensions: { width: 4, height: 5 } });
      const result = validateAndClampSolverPlacements([placement], defaultSetbacks, defaultPlot);

      expect(result[0].position.y).toBe(13);
      expect(result[0]._wasClamped).toBe(true);
      expect(result[0]._clampDeltaY).toBeCloseTo(13 - 18); // -5
    });

    it('clamps a room with negative solver position to the left/front setback boundary', () => {
      // Room at solver x=-5: rawX = -5 + 1.5 = -3.5, clamped to setbacks.left = 1.5
      const placement = makePlacement({ position: { x: -5, y: -5 }, dimensions: { width: 4, height: 5 } });
      const result = validateAndClampSolverPlacements([placement], defaultSetbacks, defaultPlot);

      expect(result[0].position.x).toBe(defaultSetbacks.left);
      expect(result[0].position.y).toBe(defaultSetbacks.front);
      expect(result[0]._wasClamped).toBe(true);
    });
  });

  describe('delta markers', () => {
    it('sets _clampDeltaX and _clampDeltaY to 0 when no clamping occurs', () => {
      const placement = makePlacement({ position: { x: 0, y: 0 } });
      const result = validateAndClampSolverPlacements([placement], defaultSetbacks, defaultPlot);

      expect(result[0]._clampDeltaX).toBe(0);
      expect(result[0]._clampDeltaY).toBe(0);
    });

    it('preserves all other PlacementResponse fields unchanged', () => {
      const placement = makePlacement({ position: { x: 0, y: 0 } });
      const result = validateAndClampSolverPlacements([placement], defaultSetbacks, defaultPlot);

      expect(result[0].room_id).toBe(placement.room_id);
      expect(result[0].name).toBe(placement.name);
      expect(result[0].dimensions).toEqual(placement.dimensions);
      expect(result[0].target_area_sqm).toBe(placement.target_area_sqm);
    });
  });

  describe('multiple placements', () => {
    it('processes each placement independently', () => {
      const p1 = makePlacement({ room_id: 'r1', position: { x: 0, y: 0 }, dimensions: { width: 4, height: 5 } });
      const p2 = makePlacement({ room_id: 'r2', position: { x: 20, y: 20 }, dimensions: { width: 4, height: 5 } });
      const result = validateAndClampSolverPlacements([p1, p2], defaultSetbacks, defaultPlot);

      expect(result).toHaveLength(2);
      expect(result[0]._wasClamped).toBe(false);
      expect(result[1]._wasClamped).toBe(true);
    });

    it('returns empty array for empty input', () => {
      const result = validateAndClampSolverPlacements([], defaultSetbacks, defaultPlot);
      expect(result).toEqual([]);
    });
  });
});
