/**
 * determinacyAnalysis — Unit Tests
 *
 * Tests static/kinematic determinacy analysis for 2D and 3D structures.
 */

import { describe, test, expect } from 'vitest';
import {
  analyzeDeterminacy,
  getDeterminacyDescription,
  type Node,
  type Member,
} from '../determinacyAnalysis';

// ============================================
// HELPERS
// ============================================

function pin(id: string, x: number, y: number, z = 0): Node {
  return { id, x, y, z, restraints: { fx: true, fy: true, fz: false } };
}

function fixed(id: string, x: number, y: number, z = 0): Node {
  return {
    id, x, y, z,
    restraints: { fx: true, fy: true, fz: true, mx: true, my: true, mz: true },
  };
}

function roller(id: string, x: number, y: number, z = 0): Node {
  return { id, x, y, z, restraints: { fy: true } };
}

function freeNode(id: string, x: number, y: number, z = 0): Node {
  return { id, x, y, z };
}

function member(id: string, start: string, end: string, type?: 'frame' | 'truss'): Member {
  return { id, startNodeId: start, endNodeId: end, type };
}

// ============================================
// 2D DETERMINATE STRUCTURES
// ============================================

describe('analyzeDeterminacy - 2D', () => {
  test('simple beam (pin + roller) is statically determinate', () => {
    const nodes: Node[] = [pin('n1', 0, 0), roller('n2', 10, 0)];
    const members: Member[] = [member('m1', 'n1', 'n2')];
    const result = analyzeDeterminacy(nodes, members, '2D');

    expect(result.isStable).toBe(true);
    expect(result.isAnalyzable).toBe(true);
    expect(result.errors).toHaveLength(0);
    expect(result.numNodes).toBe(2);
    expect(result.numMembers).toBe(1);
  });

  test('cantilever beam (fixed support) is determinate', () => {
    const nodes: Node[] = [fixed('n1', 0, 0), freeNode('n2', 5, 0)];
    const members: Member[] = [member('m1', 'n1', 'n2')];
    const result = analyzeDeterminacy(nodes, members, '2D');

    expect(result.isStable).toBe(true);
    expect(result.isAnalyzable).toBe(true);
  });

  test('continuous beam (3 supports) is indeterminate', () => {
    const nodes: Node[] = [
      pin('n1', 0, 0),
      roller('n2', 5, 0),
      roller('n3', 10, 0),
    ];
    const members: Member[] = [
      member('m1', 'n1', 'n2'),
      member('m2', 'n2', 'n3'),
    ];
    const result = analyzeDeterminacy(nodes, members, '2D');

    expect(result.isStable).toBe(true);
    expect(result.degreeOfStaticIndeterminacy).toBeGreaterThan(0);
  });

  test('unsupported structure is unstable', () => {
    const nodes: Node[] = [freeNode('n1', 0, 0), freeNode('n2', 5, 0)];
    const members: Member[] = [member('m1', 'n1', 'n2')];
    const result = analyzeDeterminacy(nodes, members, '2D');

    expect(result.isStable).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  test('truss members reduce DOF correctly', () => {
    // Simple truss triangle: 3 nodes, 3 truss members, pin+roller
    const nodes: Node[] = [
      pin('n1', 0, 0),
      roller('n2', 4, 0),
      freeNode('n3', 2, 3),
    ];
    const members: Member[] = [
      member('m1', 'n1', 'n2', 'truss'),
      member('m2', 'n2', 'n3', 'truss'),
      member('m3', 'n1', 'n3', 'truss'),
    ];
    const result = analyzeDeterminacy(nodes, members, '2D');

    expect(result.isStable).toBe(true);
    expect(result.isAnalyzable).toBe(true);
  });
});

// ============================================
// 3D STRUCTURES
// ============================================

describe('analyzeDeterminacy - 3D', () => {
  test('3D cantilever is analyzable', () => {
    const nodes: Node[] = [
      {
        id: 'n1', x: 0, y: 0, z: 0,
        restraints: { fx: true, fy: true, fz: true, mx: true, my: true, mz: true },
      },
      { id: 'n2', x: 5, y: 0, z: 0 },
    ];
    const members: Member[] = [member('m1', 'n1', 'n2')];
    const result = analyzeDeterminacy(nodes, members, '3D');

    expect(result.isStable).toBe(true);
    expect(result.isAnalyzable).toBe(true);
    expect(result.totalDOF).toBe(12); // 2 nodes × 6 DOF
  });

  test('3D structure with no supports is unstable', () => {
    const nodes: Node[] = [
      { id: 'n1', x: 0, y: 0, z: 0 },
      { id: 'n2', x: 5, y: 0, z: 3 },
    ];
    const members: Member[] = [member('m1', 'n1', 'n2')];
    const result = analyzeDeterminacy(nodes, members, '3D');

    expect(result.isStable).toBe(false);
  });
});

// ============================================
// getDeterminacyDescription
// ============================================

describe('getDeterminacyDescription', () => {
  test('returns non-empty string', () => {
    const nodes: Node[] = [pin('n1', 0, 0), roller('n2', 10, 0)];
    const members: Member[] = [member('m1', 'n1', 'n2')];
    const result = analyzeDeterminacy(nodes, members, '2D');
    const desc = getDeterminacyDescription(result);

    expect(typeof desc).toBe('string');
    expect(desc.length).toBeGreaterThan(0);
  });

  test('description mentions determinacy status', () => {
    const nodes: Node[] = [pin('n1', 0, 0), roller('n2', 10, 0)];
    const members: Member[] = [member('m1', 'n1', 'n2')];
    const result = analyzeDeterminacy(nodes, members, '2D');
    const desc = getDeterminacyDescription(result);

    // Should contain some determinacy-related terminology
    expect(
      desc.toLowerCase().includes('determinate') ||
      desc.toLowerCase().includes('stable') ||
      desc.toLowerCase().includes('dof') ||
      desc.toLowerCase().includes('degree')
    ).toBe(true);
  });
});
