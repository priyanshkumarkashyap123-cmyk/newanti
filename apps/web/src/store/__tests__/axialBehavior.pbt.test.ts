/**
 * Property-based test for axial behavior mutual exclusion (Property 5)
 * Feature: staad-pro-modeling-tools, Property 5: axial behavior mutual exclusion
 * Validates: Requirements 3.7
 */
import { describe, it, expect, beforeEach } from 'vitest';
import fc from 'fast-check';
import { useModelStore } from '../model';

describe('Axial Behavior Mutual Exclusion — property tests', () => {
  beforeEach(() => {
    useModelStore.setState({
      nodes: new Map([
        ['N1', { id: 'N1', x: 0, y: 0, z: 0 }],
        ['N2', { id: 'N2', x: 1, y: 0, z: 0 }],
      ]),
      members: new Map([
        ['M1', { id: 'M1', startNodeId: 'N1', endNodeId: 'N2' }],
      ]),
    });
  });

  /**
   * Property 5: Axial behavior mutual exclusion
   * Feature: staad-pro-modeling-tools, Property 5: axial behavior mutual exclusion
   */
  it('setting compression-only on a tension-only member replaces the flag', () => {
    fc.assert(
      fc.property(
        fc.constant('M1'),
        (memberId) => {
          const store = useModelStore.getState();
          // First set tension-only
          store.updateMember(memberId, { axialBehavior: 'tension-only' });
          // Then set compression-only
          store.updateMember(memberId, { axialBehavior: 'compression-only' });
          const member = useModelStore.getState().members.get(memberId);
          // Must be compression-only, not tension-only
          return member?.axialBehavior === 'compression-only';
        },
      ),
      { numRuns: 100 },
    );
  });

  it('setting tension-only on a compression-only member replaces the flag', () => {
    fc.assert(
      fc.property(
        fc.constant('M1'),
        (memberId) => {
          const store = useModelStore.getState();
          // First set compression-only
          store.updateMember(memberId, { axialBehavior: 'compression-only' });
          // Then set tension-only
          store.updateMember(memberId, { axialBehavior: 'tension-only' });
          const member = useModelStore.getState().members.get(memberId);
          // Must be tension-only, not compression-only
          return member?.axialBehavior === 'tension-only';
        },
      ),
      { numRuns: 100 },
    );
  });

  it('a member cannot have both tension-only and compression-only simultaneously', () => {
    fc.assert(
      fc.property(
        fc.constantFrom('tension-only', 'compression-only', 'normal') as fc.Arbitrary<'tension-only' | 'compression-only' | 'normal'>,
        (behavior) => {
          const store = useModelStore.getState();
          store.updateMember('M1', { axialBehavior: behavior });
          const member = useModelStore.getState().members.get('M1');
          // axialBehavior is a single value — cannot be both
          return member?.axialBehavior === behavior;
        },
      ),
      { numRuns: 100 },
    );
  });
});
