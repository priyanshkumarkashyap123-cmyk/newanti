/**
 * Property-based tests for built-up section computation
 * Feature: staad-pro-modeling-tools
 */
import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import {
  computeBuiltUpProperties,
  polygonsOverlap,
  makeRectPolygon,
  type ComponentProperties,
} from '../builtUpSection';

describe('Built-Up Section — property tests', () => {
  /**
   * Property 15: Built-up section parallel axis theorem
   * Feature: staad-pro-modeling-tools, Property 15: parallel axis theorem
   * Validates: Requirements 21.3
   */
  it('combined Ixx equals sum of (Ixx_i + A_i × dy_i²)', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            area: fc.float({ min: Math.fround(100), max: Math.fround(10000), noNaN: true }),
            ixx: fc.float({ min: Math.fround(1e4), max: Math.fround(1e8), noNaN: true }),
            iyy: fc.float({ min: Math.fround(1e4), max: Math.fround(1e8), noNaN: true }),
            cx: fc.float({ min: Math.fround(-200), max: Math.fround(200), noNaN: true }),
            cy: fc.float({ min: Math.fround(-200), max: Math.fround(200), noNaN: true }),
          }),
          { minLength: 2, maxLength: 5 },
        ),
        (components: ComponentProperties[]) => {
          const result = computeBuiltUpProperties(components);
          const { centroidY } = result;
          const expected = components.reduce(
            (sum, c) => sum + c.ixx + c.area * Math.pow(c.cy - centroidY, 2),
            0,
          );
          const relError = Math.abs(result.combinedIxx - expected) / Math.max(expected, 1);
          return relError < 1e-6;
        },
      ),
      { numRuns: 100 },
    );
  });

  it('combined Iyy equals sum of (Iyy_i + A_i × dx_i²)', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            area: fc.float({ min: Math.fround(100), max: Math.fround(10000), noNaN: true }),
            ixx: fc.float({ min: Math.fround(1e4), max: Math.fround(1e8), noNaN: true }),
            iyy: fc.float({ min: Math.fround(1e4), max: Math.fround(1e8), noNaN: true }),
            cx: fc.float({ min: Math.fround(-200), max: Math.fround(200), noNaN: true }),
            cy: fc.float({ min: Math.fround(-200), max: Math.fround(200), noNaN: true }),
          }),
          { minLength: 2, maxLength: 5 },
        ),
        (components: ComponentProperties[]) => {
          const result = computeBuiltUpProperties(components);
          const { centroidX } = result;
          const expected = components.reduce(
            (sum, c) => sum + c.iyy + c.area * Math.pow(c.cx - centroidX, 2),
            0,
          );
          const relError = Math.abs(result.combinedIyy - expected) / Math.max(expected, 1);
          return relError < 1e-6;
        },
      ),
      { numRuns: 100 },
    );
  });

  it('combined area equals sum of component areas', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            area: fc.float({ min: Math.fround(100), max: Math.fround(10000), noNaN: true }),
            ixx: fc.float({ min: Math.fround(1e4), max: Math.fround(1e8), noNaN: true }),
            iyy: fc.float({ min: Math.fround(1e4), max: Math.fround(1e8), noNaN: true }),
            cx: fc.float({ min: Math.fround(-200), max: Math.fround(200), noNaN: true }),
            cy: fc.float({ min: Math.fround(-200), max: Math.fround(200), noNaN: true }),
          }),
          { minLength: 2, maxLength: 5 },
        ),
        (components: ComponentProperties[]) => {
          const result = computeBuiltUpProperties(components);
          const expected = components.reduce((sum, c) => sum + c.area, 0);
          return Math.abs(result.combinedArea - expected) < 1e-6;
        },
      ),
      { numRuns: 100 },
    );
  });

  /**
   * Property 16: Built-up section overlap detection
   * Feature: staad-pro-modeling-tools, Property 16: overlap detection
   * Validates: Requirements 21.6
   */
  it('overlapping rectangles are detected as overlapping', () => {
    // Two rectangles at the same position always overlap
    const polyA = makeRectPolygon(100, 100, 0, 0);
    const polyB = makeRectPolygon(100, 100, 0, 0);
    expect(polygonsOverlap(polyA, polyB)).toBe(true);
  });

  it('non-overlapping rectangles are detected as non-overlapping', () => {
    // Two rectangles far apart
    const polyA = makeRectPolygon(100, 100, 0, 0);
    const polyB = makeRectPolygon(100, 100, 300, 0);
    expect(polygonsOverlap(polyA, polyB)).toBe(false);
  });

  it('polygonsOverlap is symmetric', () => {
    fc.assert(
      fc.property(
        fc.float({ min: Math.fround(10), max: Math.fround(100), noNaN: true }),
        fc.float({ min: Math.fround(10), max: Math.fround(100), noNaN: true }),
        fc.float({ min: Math.fround(-200), max: Math.fround(200), noNaN: true }),
        fc.float({ min: Math.fround(-200), max: Math.fround(200), noNaN: true }),
        (w, h, offsetX, offsetY) => {
          const polyA = makeRectPolygon(w, h, 0, 0);
          const polyB = makeRectPolygon(w, h, offsetX, offsetY);
          return polygonsOverlap(polyA, polyB) === polygonsOverlap(polyB, polyA);
        },
      ),
      { numRuns: 100 },
    );
  });
});
