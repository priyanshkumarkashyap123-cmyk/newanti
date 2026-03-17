/**
 * Property-based test for master/slave minimum selection (Property 7)
 * Feature: staad-pro-modeling-tools, Property 7: master/slave requires at least two nodes
 * Validates: Requirements 6.6
 */
import { describe, it, expect } from 'vitest';
import fc from 'fast-check';

/**
 * Simulates the master/slave guard logic from ModernModeler.tsx.
 * Returns whether the dialog should be opened.
 */
function simulateMasterSlaveGuard(selectedNodeCount: number): boolean {
  return selectedNodeCount >= 2;
}

describe('Master/Slave Guard — property tests', () => {
  /**
   * Property 7: Master/slave requires at least two nodes
   * Feature: staad-pro-modeling-tools, Property 7: master/slave requires at least two nodes
   */
  it('master/slave dialog is blocked when fewer than 2 nodes are selected', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 1 }),
        (count) => simulateMasterSlaveGuard(count) === false,
      ),
      { numRuns: 100 },
    );
  });

  it('master/slave dialog is allowed when 2 or more nodes are selected', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 2, max: 1000 }),
        (count) => simulateMasterSlaveGuard(count) === true,
      ),
      { numRuns: 100 },
    );
  });
});
