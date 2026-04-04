/**
 * Property-based test for story drift flag correctness (Property 12)
 * Feature: staad-pro-modeling-tools, Property 12: story drift flag correctness
 * Validates: Requirements 15.4
 */
import { describe, it } from 'vitest';
import fc from 'fast-check';
import { isDriftExceeded } from '../StoryDriftPanel';

describe('Story Drift Flag — property tests', () => {
  /**
   * Property 12: Story drift flag correctness
   * Feature: staad-pro-modeling-tools, Property 12: story drift flag correctness
   */
  it('isDriftExceeded returns true if and only if driftRatio > limit', () => {
    fc.assert(
      fc.property(
        fc.float({ min: Math.fround(0), max: Math.fround(0.1), noNaN: true }),
        fc.float({ min: Math.fround(0), max: Math.fround(0.1), noNaN: true }),
        (driftRatio, limit) => {
          const result = isDriftExceeded(driftRatio, limit);
          return result === (driftRatio > limit);
        },
      ),
      { numRuns: 100 },
    );
  });

  it('isDriftExceeded returns false when driftRatio equals limit', () => {
    fc.assert(
      fc.property(
        fc.float({ min: Math.fround(0.001), max: Math.fround(0.1), noNaN: true }),
        (limit) => {
          // Equal values should NOT exceed
          return isDriftExceeded(limit, limit) === false;
        },
      ),
      { numRuns: 100 },
    );
  });
});
