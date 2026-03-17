/**
 * Property-based tests for diaphragm assignment (Property 6)
 * Feature: staad-pro-modeling-tools, Property 6: diaphragm assignment covers all selected nodes
 * Validates: Requirements 5.5
 */
import { describe, it, expect, beforeEach } from 'vitest';
import fc from 'fast-check';
import { useModelStore } from '../model';

describe('Diaphragm Assignment — property tests', () => {
  beforeEach(() => {
    // Reset store to clean state
    useModelStore.setState({
      nodes: new Map(),
      members: new Map(),
      diaphragms: [],
      centerOfRigidity: new Map(),
      selectedIds: new Set(),
    });
  });

  /**
   * Property 6: Diaphragm assignment covers all selected nodes
   * Feature: staad-pro-modeling-tools, Property 6: diaphragm assignment covers all selected nodes
   */
  it('addDiaphragm stores the diaphragm with all specified node IDs', () => {
    fc.assert(
      fc.property(
        fc.array(fc.string({ minLength: 1, maxLength: 10 }), { minLength: 2, maxLength: 10 }),
        fc.string({ minLength: 1, maxLength: 20 }),
        (nodeIds, diaphragmId) => {
          const store = useModelStore.getState();
          // Reset diaphragms
          useModelStore.setState({ diaphragms: [] });

          const spec = {
            id: diaphragmId,
            type: 'rigid' as const,
            plane: 'XY' as const,
            storyLabel: 'Test',
            nodeIds,
          };
          store.addDiaphragm(spec);

          const diaphragms = useModelStore.getState().diaphragms;
          const added = diaphragms.find((d) => d.id === diaphragmId);
          if (!added) return false;

          // All node IDs must be present in the diaphragm
          return nodeIds.every((id) => added.nodeIds.includes(id));
        },
      ),
      { numRuns: 100 },
    );
  });

  it('removeDiaphragm removes the diaphragm by ID', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 20 }),
        (diaphragmId) => {
          useModelStore.setState({ diaphragms: [] });
          const store = useModelStore.getState();
          store.addDiaphragm({
            id: diaphragmId,
            type: 'rigid',
            plane: 'XY',
            storyLabel: 'Test',
            nodeIds: ['N1', 'N2'],
          });
          store.removeDiaphragm(diaphragmId);
          const diaphragms = useModelStore.getState().diaphragms;
          return !diaphragms.some((d) => d.id === diaphragmId);
        },
      ),
      { numRuns: 100 },
    );
  });
});
