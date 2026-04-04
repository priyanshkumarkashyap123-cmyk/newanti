// Feature: space-planning-accuracy-and-tools, Property 14: Apply-Then-Revert Round Trip
// Validates: Requirements 9.2, 9.4

import { applyOptimizedSections } from '../../../pages/SensitivityOptimizationDashboard';

function makeMembers(entries: Array<{ id: string; sectionId: string }>) {
  const map = new Map<string, any>();
  entries.forEach(({ id, sectionId }) => {
    map.set(id, { id, sectionId, startNodeId: 'n1', endNodeId: 'n2' });
  });
  return map;
}

describe('applyOptimizedSections', () => {
  it('updates sectionId for each affected member', () => {
    const members = makeMembers([
      { id: 'm1', sectionId: 'ISMB200' },
      { id: 'm2', sectionId: 'ISMB250' },
    ]);
    const updates: Record<string, Partial<any>> = {};
    const updateMember = (id: string, patch: Partial<any>) => {
      updates[id] = patch;
      const m = members.get(id);
      if (m) members.set(id, { ...m, ...patch });
    };

    applyOptimizedSections({ m1: 'ISMB300', m2: 'ISMB350' }, updateMember, members);

    expect(updates['m1']).toEqual({ sectionId: 'ISMB300' });
    expect(updates['m2']).toEqual({ sectionId: 'ISMB350' });
  });

  it('returns previous assignments for undo support', () => {
    const members = makeMembers([
      { id: 'm1', sectionId: 'ISMB200' },
      { id: 'm2', sectionId: 'ISMB250' },
    ]);
    const updateMember = (_id: string, _patch: any) => {};

    const previous = applyOptimizedSections({ m1: 'ISMB300', m2: 'ISMB350' }, updateMember, members);

    expect(previous['m1']).toBe('ISMB200');
    expect(previous['m2']).toBe('ISMB250');
  });

  it('skips members not in the map', () => {
    const members = makeMembers([{ id: 'm1', sectionId: 'ISMB200' }]);
    const updates: Record<string, any> = {};
    const updateMember = (id: string, patch: any) => { updates[id] = patch; };

    applyOptimizedSections({ m1: 'ISMB300', nonexistent: 'ISMB400' }, updateMember, members);

    expect(updates['nonexistent']).toBeUndefined();
    expect(updates['m1']).toBeDefined();
  });

  it('does not call updateMember when sectionId is unchanged', () => {
    const members = makeMembers([{ id: 'm1', sectionId: 'ISMB200' }]);
    const callCount = { count: 0 };
    const updateMember = (_id: string, _patch: any) => { callCount.count++; };

    applyOptimizedSections({ m1: 'ISMB200' }, updateMember, members); // same section

    expect(callCount.count).toBe(0);
  });

  it('Property 14: Apply-Then-Revert Round Trip restores original sections', () => {
    const originalSections = { m1: 'ISMB200', m2: 'ISMB250', m3: 'ISMB300' };
    const members = makeMembers(
      Object.entries(originalSections).map(([id, sectionId]) => ({ id, sectionId }))
    );

    const updateMember = (id: string, patch: Partial<any>) => {
      const m = members.get(id);
      if (m) members.set(id, { ...m, ...patch });
    };

    const optimized = { m1: 'ISMB350', m2: 'ISMB400', m3: 'ISMB450' };

    // Apply optimized sections
    const previous = applyOptimizedSections(optimized, updateMember, members);

    // Verify applied
    expect(members.get('m1')!.sectionId).toBe('ISMB350');
    expect(members.get('m2')!.sectionId).toBe('ISMB400');

    // Revert using previous assignments
    applyOptimizedSections(previous, updateMember, members);

    // Verify reverted to original
    expect(members.get('m1')!.sectionId).toBe(originalSections.m1);
    expect(members.get('m2')!.sectionId).toBe(originalSections.m2);
    expect(members.get('m3')!.sectionId).toBe(originalSections.m3);
  });
});
