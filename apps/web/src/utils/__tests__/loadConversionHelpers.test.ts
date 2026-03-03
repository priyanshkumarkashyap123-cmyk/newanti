/**
 * loadConversionHelpers.test.ts — Supplementary tests for loadConversion.ts
 *
 * Covers exported helpers that are NOT exhaustively tested in the main
 * loadConversion.test.ts: formatNodalLoad, verifyEquilibrium (edge cases),
 * setLoadConversionDebug, mergeNodalLoads (additional scenarios), and
 * convertMemberLoadsToNodalLegacy wrapper.
 */

import { describe, it, expect } from 'vitest';
import {
  formatNodalLoad,
  verifyEquilibrium,
  setLoadConversionDebug,
  mergeNodalLoads,
  convertMemberLoadsToNodal,
  convertMemberLoadsToNodalLegacy,
  type NodalLoad,
  type MemberLoad,
  type Member,
  type Node,
} from '@/utils/loadConversion';

// ─── Helpers ────────────────────────────────────────────────

function makeNode(id: string, x: number, y: number, z = 0): Node {
  return { id, x, y, z };
}

function makeMember(id: string, start: string, end: string): Member {
  return { id, startNodeId: start, endNodeId: end };
}

// ============================================
// 1. formatNodalLoad
// ============================================

describe('formatNodalLoad', () => {
  it('formats a load with all force components', () => {
    const result = formatNodalLoad({
      nodeId: 'A',
      fx: 10,
      fy: -50,
      fz: 5,
      mx: 0,
      my: 0,
      mz: -83.333,
    });
    expect(result).toContain('Node A:');
    expect(result).toContain('Fx=10.000 kN');
    expect(result).toContain('Fy=-50.000 kN');
    expect(result).toContain('Mz=-83.333');
  });

  it('omits zero-valued DOFs', () => {
    const result = formatNodalLoad({ nodeId: 'B', fy: -25 });
    expect(result).toContain('Node B:');
    expect(result).toContain('Fy=-25.000');
    expect(result).not.toContain('Fx');
    expect(result).not.toContain('Mz');
  });

  it('formats a load with only moments', () => {
    const result = formatNodalLoad({
      nodeId: 'C',
      mx: 12.5,
      my: -7.2,
      mz: 100,
    });
    expect(result).toContain('Mx=12.500');
    expect(result).toContain('My=-7.200');
    expect(result).toContain('Mz=100.000');
  });

  it('returns only the node prefix when all values are zero/undefined', () => {
    const result = formatNodalLoad({ nodeId: 'D' });
    expect(result).toBe('Node D:');
  });
});

// ============================================
// 2. verifyEquilibrium
// ============================================

describe('verifyEquilibrium', () => {
  it('reports balanced when sum of loads is zero', () => {
    const loads: NodalLoad[] = [
      { nodeId: 'A', fy: -50 },
      { nodeId: 'B', fy: 50 },
    ];
    const result = verifyEquilibrium(loads);
    expect(result.sumFy).toBeCloseTo(0, 4);
    expect(result.isBalanced).toBe(true);
  });

  it('reports unbalanced when provided member loads disagree', () => {
    const nodes: Node[] = [makeNode('A', 0, 0), makeNode('B', 10, 0)];
    const members: Member[] = [makeMember('m1', 'A', 'B')];
    const memberLoads: MemberLoad[] = [
      { id: 'ml1', memberId: 'm1', type: 'UDL', w1: -10, direction: 'global_y' },
    ];

    // Intentionally wrong nodal loads (only half the expected reaction)
    const wrongLoads: NodalLoad[] = [
      { nodeId: 'A', fy: -25 },
      { nodeId: 'B', fy: -25 },
    ];
    const result = verifyEquilibrium(wrongLoads, memberLoads, members, nodes);
    // Expected total = -100, actual sum = -50, |error| = 50
    expect(result.isBalanced).toBe(false);
    expect(result.forceError).toBeGreaterThan(1);
  });

  it('sums all DOF components', () => {
    const loads: NodalLoad[] = [
      { nodeId: 'A', fx: 3, fy: 4, fz: 5, mx: 1, my: 2, mz: 3 },
      { nodeId: 'B', fx: -3, fy: -4, fz: -5, mx: -1, my: -2, mz: -3 },
    ];
    const result = verifyEquilibrium(loads);
    expect(result.sumFx).toBeCloseTo(0, 4);
    expect(result.sumFy).toBeCloseTo(0, 4);
    expect(result.sumFz).toBeCloseTo(0, 4);
    expect(result.sumMx).toBeCloseTo(0, 4);
    expect(result.sumMy).toBeCloseTo(0, 4);
    expect(result.sumMz).toBeCloseTo(0, 4);
  });
});

// ============================================
// 3. setLoadConversionDebug
// ============================================

describe('setLoadConversionDebug', () => {
  it('does not throw when called with valid options', () => {
    expect(() => setLoadConversionDebug({ enabled: false })).not.toThrow();
  });

  it('accepts partial debug options', () => {
    expect(() =>
      setLoadConversionDebug({ logConversions: true, logMoments: true }),
    ).not.toThrow();
  });
});

// ============================================
// 4. mergeNodalLoads — additional edge cases
// ============================================

describe('mergeNodalLoads (extras)', () => {
  it('returns empty array for empty input', () => {
    expect(mergeNodalLoads([])).toEqual([]);
  });

  it('merges six-DOF loads on the same node', () => {
    const loads: NodalLoad[] = [
      { nodeId: 'X', fx: 1, fy: 2, fz: 3, mx: 4, my: 5, mz: 6 },
      { nodeId: 'X', fx: 10, fy: 20, fz: 30, mx: 40, my: 50, mz: 60 },
    ];
    const merged = mergeNodalLoads(loads);
    expect(merged).toHaveLength(1);
    expect(merged[0].fx).toBeCloseTo(11, 4);
    expect(merged[0].fy).toBeCloseTo(22, 4);
    expect(merged[0].mz).toBeCloseTo(66, 4);
  });

  it('preserves loadCase when present', () => {
    const loads: NodalLoad[] = [
      { nodeId: 'A', fy: -10, loadCase: 'DL' },
    ];
    const merged = mergeNodalLoads(loads);
    expect(merged[0].loadCase).toBe('DL');
  });
});

// ============================================
// 5. convertMemberLoadsToNodalLegacy
// ============================================

describe('convertMemberLoadsToNodalLegacy', () => {
  it('returns an array of NodalLoads (no wrapper object)', () => {
    const nodes: Node[] = [makeNode('A', 0, 0), makeNode('B', 6, 0)];
    const members: Member[] = [makeMember('m1', 'A', 'B')];
    const loads: MemberLoad[] = [
      { id: 'ml1', memberId: 'm1', type: 'UDL', w1: -12, direction: 'global_y' },
    ];

    const result = convertMemberLoadsToNodalLegacy(loads, members, nodes);
    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBeGreaterThan(0);
    expect(result[0]).toHaveProperty('nodeId');
  });

  it('produces the same nodal loads as the main function', () => {
    const nodes: Node[] = [makeNode('A', 0, 0), makeNode('B', 10, 0)];
    const members: Member[] = [makeMember('m1', 'A', 'B')];
    const loads: MemberLoad[] = [
      { id: 'ml1', memberId: 'm1', type: 'UDL', w1: -10, direction: 'global_y' },
    ];

    const legacy = convertMemberLoadsToNodalLegacy(loads, members, nodes);
    const modern = convertMemberLoadsToNodal(loads, members, nodes);

    expect(legacy.length).toBe(modern.nodalLoads.length);
  });
});
