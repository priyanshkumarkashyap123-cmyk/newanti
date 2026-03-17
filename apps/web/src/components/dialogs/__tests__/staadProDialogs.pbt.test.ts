/**
 * Property-based tests for STAAD.Pro parity dialog validators
 * Feature: staad-pro-modeling-tools
 */
import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { validatePartialReleaseFactor } from '../PartialReleaseDialog';
import { validateReductionFactor } from '../PropertyReductionDialog';
import { validateFractionalPosition } from '../SectionForcesPanel';

describe('STAAD.Pro dialog validators — property tests', () => {
  /**
   * Property 4: Partial release factor validation
   * Feature: staad-pro-modeling-tools, Property 4: partial release factor validation
   * Validates: Requirements 2.4, 2.5
   */
  it('partial release factor accepts values in [0.001, 0.999]', () => {
    fc.assert(
      fc.property(
        fc.float({ min: Math.fround(0.001), max: Math.fround(0.999), noNaN: true }),
        (v) => validatePartialReleaseFactor(v).valid === true,
      ),
      { numRuns: 100 },
    );
  });

  it('partial release factor rejects values outside [0.001, 0.999]', () => {
    fc.assert(
      fc.property(
        fc.oneof(
          fc.float({ min: Math.fround(-1000), max: Math.fround(0.0009), noNaN: true }),
          fc.float({ min: Math.fround(1.0001), max: Math.fround(1000), noNaN: true }),
        ),
        (v) => validatePartialReleaseFactor(v).valid === false,
      ),
      { numRuns: 100 },
    );
  });

  /**
   * Property 8: Property reduction factor validation
   * Feature: staad-pro-modeling-tools, Property 8: property reduction factor validation
   * Validates: Requirements 7.4, 7.5
   */
  it('property reduction factor accepts values in [0.01, 1.00]', () => {
    fc.assert(
      fc.property(
        fc.float({ min: Math.fround(0.01), max: Math.fround(1.0), noNaN: true }),
        (v) => validateReductionFactor(v).valid === true,
      ),
      { numRuns: 100 },
    );
  });

  it('property reduction factor rejects values outside [0.01, 1.00]', () => {
    fc.assert(
      fc.property(
        fc.oneof(
          // Clearly below 0.01 (not just floating point noise)
          fc.float({ min: Math.fround(0.001), max: Math.fround(0.005), noNaN: true }),
          fc.float({ min: Math.fround(1.001), max: Math.fround(1000), noNaN: true }),
        ),
        (v) => validateReductionFactor(v).valid === false,
      ),
      { numRuns: 100 },
    );
  });

  /**
   * Property 13: Section forces fractional position validation
   * Feature: staad-pro-modeling-tools, Property 13: fractional position validation
   * Validates: Requirements 17.3, 17.6
   */
  it('fractional position accepts values in [0.0, 1.0]', () => {
    fc.assert(
      fc.property(
        fc.float({ min: Math.fround(0.0), max: Math.fround(1.0), noNaN: true }),
        (f) => validateFractionalPosition(f).valid === true,
      ),
      { numRuns: 100 },
    );
  });

  it('fractional position rejects values outside [0.0, 1.0]', () => {
    fc.assert(
      fc.property(
        fc.oneof(
          fc.float({ min: Math.fround(-1000), max: Math.fround(-0.001), noNaN: true }),
          fc.float({ min: Math.fround(1.001), max: Math.fround(1000), noNaN: true }),
        ),
        (f) => validateFractionalPosition(f).valid === false,
      ),
      { numRuns: 100 },
    );
  });
});
