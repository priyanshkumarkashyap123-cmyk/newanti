import { describe, expect, it } from 'vitest';
import { resolveAllMemberProperties } from './propertyResolver';
import type { Member } from '../store/modelTypes';

describe('propertyResolver inline fallback', () => {
  it('keeps E/A/I unresolved when member has no inline properties', () => {
    const members: Member[] = [
      {
        id: 'M1',
        startNodeId: 'N1',
        endNodeId: 'N2',
      },
    ];

    const resolved = resolveAllMemberProperties(members, [], []);
    const m1 = resolved.get('M1');

    expect(m1).toBeDefined();
    expect(m1?.resolution).toBe('inline_fallback');
    expect(Number.isNaN(m1?.E_kN_m2 ?? 0)).toBe(true);
    expect(Number.isNaN(m1?.A_m2 ?? 0)).toBe(true);
    expect(Number.isNaN(m1?.Iy_m4 ?? 0)).toBe(true);
    expect(Number.isNaN(m1?.Iz_m4 ?? 0)).toBe(true);
  });

  it('uses explicit inline properties when provided', () => {
    const members: Member[] = [
      {
        id: 'M1',
        startNodeId: 'N1',
        endNodeId: 'N2',
        E: 210e6,
        A: 0.012,
        I: 2.5e-4,
      },
    ];

    const resolved = resolveAllMemberProperties(members, [], []);
    const m1 = resolved.get('M1');

    expect(m1).toBeDefined();
    expect(m1?.E_kN_m2).toBe(210e6);
    expect(m1?.A_m2).toBe(0.012);
    expect(m1?.Iy_m4).toBe(2.5e-4);
    expect(m1?.Iz_m4).toBe(2.5e-4);
  });
});
