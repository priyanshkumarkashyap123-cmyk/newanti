/**
 * Property-based tests for load generator algorithms
 * Feature: staad-pro-modeling-tools
 */
import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import {
  isClosedPolygon,
  computeFloorLoadYieldLine,
  computeAreaLoadUDL,
  computeASCE7FlatRoofSnow,
  computeASCE7SlopeFactor,
  computeASCE7SnowLoad,
} from '../loadGenerators';

describe('Load Generator Algorithms — property tests', () => {
  /**
   * Property 9: Floor load polygon closure validation
   * Feature: staad-pro-modeling-tools, Property 9: floor load polygon closure validation
   * Validates: Requirements 8.8
   */
  it('isClosedPolygon returns false for open chains', () => {
    // A chain of members where one node has degree 1 (open end)
    const openChain: [string, string][] = [
      ['N1', 'N2'],
      ['N2', 'N3'],
      ['N3', 'N4'],
      // N4 is not connected back to N1 → open
    ];
    expect(isClosedPolygon(openChain)).toBe(false);
  });

  it('isClosedPolygon returns true for a closed triangle', () => {
    const triangle: [string, string][] = [
      ['N1', 'N2'],
      ['N2', 'N3'],
      ['N3', 'N1'],
    ];
    expect(isClosedPolygon(triangle)).toBe(true);
  });

  it('isClosedPolygon returns true for a closed rectangle', () => {
    const rect: [string, string][] = [
      ['N1', 'N2'],
      ['N2', 'N3'],
      ['N3', 'N4'],
      ['N4', 'N1'],
    ];
    expect(isClosedPolygon(rect)).toBe(true);
  });

  it('computeFloorLoadYieldLine returns error for open polygon', () => {
    const openChain: [string, string][] = [
      ['N1', 'N2'],
      ['N2', 'N3'],
    ];
    const nodePositions = new Map([
      ['N1', { x: 0, z: 0 }],
      ['N2', { x: 1, z: 0 }],
      ['N3', { x: 1, z: 1 }],
    ]);
    const result = computeFloorLoadYieldLine(
      ['M1', 'M2'],
      openChain,
      nodePositions,
      5.0,
    );
    expect(result.error).toBeDefined();
    expect(result.beamLoads).toHaveLength(0);
  });

  it('computeFloorLoadYieldLine produces non-negative UDLs for valid polygon', () => {
    // Square panel 4m × 4m
    const endpoints: [string, string][] = [
      ['N1', 'N2'],
      ['N2', 'N3'],
      ['N3', 'N4'],
      ['N4', 'N1'],
    ];
    const nodePositions = new Map([
      ['N1', { x: 0, z: 0 }],
      ['N2', { x: 4, z: 0 }],
      ['N3', { x: 4, z: 4 }],
      ['N4', { x: 0, z: 4 }],
    ]);
    const result = computeFloorLoadYieldLine(
      ['M1', 'M2', 'M3', 'M4'],
      endpoints,
      nodePositions,
      5.0,
    );
    expect(result.error).toBeUndefined();
    expect(result.beamLoads).toHaveLength(4);
    result.beamLoads.forEach(({ udl }) => {
      expect(udl).toBeGreaterThanOrEqual(0);
    });
  });

  /**
   * Property 10: Area load UDL equals pressure times tributary width
   * Feature: staad-pro-modeling-tools, Property 10: area load UDL computation
   * Validates: Requirements 9.4
   */
  it('area load UDL equals pressure times tributary width', () => {
    fc.assert(
      fc.property(
        fc.float({ min: Math.fround(0.1), max: Math.fround(100), noNaN: true }),
        fc.float({ min: Math.fround(0.5), max: Math.fround(20), noNaN: true }),
        (pressure, width) => {
          const udl = computeAreaLoadUDL(pressure, width);
          return Math.abs(udl - pressure * width) < 1e-6;
        },
      ),
      { numRuns: 100 },
    );
  });

  /**
   * Property 11: ASCE 7 snow load formula correctness
   * Feature: staad-pro-modeling-tools, Property 11: ASCE 7 snow load formula
   * Validates: Requirements 10.4
   */
  it('ASCE 7 flat roof snow load equals 0.7 × Ce × Ct × Is × pg', () => {
    fc.assert(
      fc.property(
        fc.float({ min: Math.fround(0.1), max: Math.fround(5.0), noNaN: true }),
        fc.float({ min: Math.fround(0.7), max: Math.fround(1.3), noNaN: true }),
        fc.float({ min: Math.fround(0.85), max: Math.fround(1.3), noNaN: true }),
        fc.float({ min: Math.fround(0.8), max: Math.fround(1.2), noNaN: true }),
        (pg, Ce, Ct, Is) => {
          const pf = computeASCE7FlatRoofSnow({ pg, Ce, Ct, Is });
          const expected = 0.7 * Ce * Ct * Is * pg;
          return Math.abs(pf - expected) < 1e-6;
        },
      ),
      { numRuns: 100 },
    );
  });

  it('ASCE 7 slope factor is 1.0 for slope ≤ 5°', () => {
    fc.assert(
      fc.property(
        fc.float({ min: Math.fround(0), max: Math.fround(5), noNaN: true }),
        (slope) => computeASCE7SlopeFactor(slope) === 1.0,
      ),
      { numRuns: 100 },
    );
  });

  it('ASCE 7 slope factor is 0 for slope > 70°', () => {
    fc.assert(
      fc.property(
        fc.float({ min: Math.fround(70.01), max: Math.fround(90), noNaN: true }),
        (slope) => computeASCE7SlopeFactor(slope) === 0,
      ),
      { numRuns: 100 },
    );
  });

  it('ASCE 7 sloped roof load equals Cs × pf', () => {
    fc.assert(
      fc.property(
        fc.float({ min: Math.fround(0.1), max: Math.fround(5.0), noNaN: true }),
        fc.float({ min: Math.fround(0.7), max: Math.fround(1.3), noNaN: true }),
        fc.float({ min: Math.fround(0.85), max: Math.fround(1.3), noNaN: true }),
        fc.float({ min: Math.fround(0.8), max: Math.fround(1.2), noNaN: true }),
        fc.float({ min: Math.fround(0), max: Math.fround(70), noNaN: true }),
        (pg, Ce, Ct, Is, slope) => {
          const result = computeASCE7SnowLoad({ pg, Ce, Ct, Is, roofSlope: slope });
          const pf = 0.7 * Ce * Ct * Is * pg;
          const Cs = computeASCE7SlopeFactor(slope);
          const expected = Cs * pf;
          return Math.abs(result.designLoad - expected) < 1e-6;
        },
      ),
      { numRuns: 100 },
    );
  });
});
