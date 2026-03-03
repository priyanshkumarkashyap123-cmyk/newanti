/**
 * structuralValidation — Unit Tests
 *
 * Tests structural model validation: supports, zero-length members,
 * disconnected nodes, mechanism detection, and determinacy analysis.
 */

import { describe, test, expect, vi, beforeEach } from 'vitest';
import {
  validateStructure,
  getSupportType,
  hasMinimumSupports,
  hasZeroLengthMembers,
} from '../structuralValidation';

// Mock determinacyAnalysis to isolate structuralValidation logic
vi.mock('../determinacyAnalysis', () => ({
  analyzeDeterminacy: vi.fn(() => ({
    type: 'determinate',
    degreesOfFreedom: 0,
    degreeOfIndeterminacy: 0,
    numMembers: 1,
    numNodes: 2,
    numReactions: 3,
    isStable: true,
    errors: [],
    warnings: [],
  })),
  getDeterminacyDescription: vi.fn(() => 'Determinate structure'),
}));

// ============================================
// HELPERS
// ============================================

interface TestNode {
  id: string;
  x: number;
  y: number;
  z: number;
  restraints?: {
    fx?: boolean;
    fy?: boolean;
    fz?: boolean;
    mx?: boolean;
    my?: boolean;
    mz?: boolean;
  };
}

interface TestMember {
  id: string;
  startNodeId: string;
  endNodeId: string;
  E?: number;
  I?: number;
  A?: number;
}

function makeNodes(defs: TestNode[]): Map<string, TestNode> {
  const m = new Map<string, TestNode>();
  defs.forEach((n) => m.set(n.id, n));
  return m;
}

function makeMembers(defs: TestMember[]): Map<string, TestMember> {
  const m = new Map<string, TestMember>();
  defs.forEach((mem) => m.set(mem.id, mem));
  return m;
}

/** Simple 2-node, 1-member beam with pin + roller supports */
function simpleBeam() {
  const nodes = makeNodes([
    { id: 'n1', x: 0, y: 0, z: 0, restraints: { fx: true, fy: true } },
    { id: 'n2', x: 5, y: 0, z: 0, restraints: { fy: true } },
  ]);
  const members = makeMembers([
    { id: 'm1', startNodeId: 'n1', endNodeId: 'n2', E: 200e9, I: 1e-4, A: 0.01 },
  ]);
  return { nodes, members };
}

// ============================================
// validateStructure
// ============================================

describe('validateStructure', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('returns critical error when no nodes defined', () => {
    const nodes = new Map();
    const members = new Map();
    const result = validateStructure(nodes, members);

    expect(result.valid).toBe(false);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].type).toBe('critical');
    expect(result.errors[0].message).toContain('No nodes');
  });

  test('returns critical error when no members defined', () => {
    const nodes = makeNodes([
      { id: 'n1', x: 0, y: 0, z: 0 },
      { id: 'n2', x: 5, y: 0, z: 0 },
    ]);
    const members = new Map();
    const result = validateStructure(nodes, members);

    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.message.includes('No members'))).toBe(true);
  });

  test('valid simple beam passes validation', () => {
    const { nodes, members } = simpleBeam();
    const result = validateStructure(nodes, members);

    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  test('detects zero-length members', () => {
    const nodes = makeNodes([
      { id: 'n1', x: 0, y: 0, z: 0, restraints: { fx: true, fy: true } },
      { id: 'n2', x: 0, y: 0, z: 0, restraints: { fy: true } },
    ]);
    const members = makeMembers([
      { id: 'm1', startNodeId: 'n1', endNodeId: 'n2', E: 200e9, I: 1e-4, A: 0.01 },
    ]);
    const result = validateStructure(nodes, members);

    const zeroLenErr = result.errors.find((e) => e.message.includes('Zero-length'));
    expect(zeroLenErr).toBeDefined();
    expect(zeroLenErr!.affectedItems).toContain('m1');
  });

  test('detects disconnected nodes', () => {
    const nodes = makeNodes([
      { id: 'n1', x: 0, y: 0, z: 0, restraints: { fx: true, fy: true } },
      { id: 'n2', x: 5, y: 0, z: 0, restraints: { fy: true } },
      { id: 'n3', x: 10, y: 5, z: 0 }, // disconnected
    ]);
    const members = makeMembers([
      { id: 'm1', startNodeId: 'n1', endNodeId: 'n2', E: 200e9, I: 1e-4, A: 0.01 },
    ]);
    const result = validateStructure(nodes, members);

    const disconnectedWarn = result.warnings.find((w) =>
      w.message.includes('disconnected'),
    );
    expect(disconnectedWarn).toBeDefined();
    expect(disconnectedWarn!.affectedItems).toContain('n3');
  });

  test('detects insufficient supports (unstable)', () => {
    const nodes = makeNodes([
      { id: 'n1', x: 0, y: 0, z: 0 }, // no supports
      { id: 'n2', x: 5, y: 0, z: 0 },
    ]);
    const members = makeMembers([
      { id: 'm1', startNodeId: 'n1', endNodeId: 'n2', E: 200e9, I: 1e-4, A: 0.01 },
    ]);
    const result = validateStructure(nodes, members);

    const unstableErr = result.errors.find((e) =>
      e.message.includes('UNSTABLE'),
    );
    expect(unstableErr).toBeDefined();
  });

  test('detects member referencing non-existent node', () => {
    const nodes = makeNodes([
      { id: 'n1', x: 0, y: 0, z: 0, restraints: { fx: true, fy: true } },
    ]);
    const members = makeMembers([
      { id: 'm1', startNodeId: 'n1', endNodeId: 'n_missing', E: 200e9, I: 1e-4, A: 0.01 },
    ]);
    const result = validateStructure(nodes, members);

    const missingNodeErr = result.errors.find((e) =>
      e.message.includes('non-existent'),
    );
    expect(missingNodeErr).toBeDefined();
  });

  test('warns about missing material properties', () => {
    const nodes = makeNodes([
      { id: 'n1', x: 0, y: 0, z: 0, restraints: { fx: true, fy: true } },
      { id: 'n2', x: 5, y: 0, z: 0, restraints: { fy: true } },
    ]);
    const members = makeMembers([
      { id: 'm1', startNodeId: 'n1', endNodeId: 'n2' }, // no E, I, A
    ]);
    const result = validateStructure(nodes, members);

    const matWarn = result.warnings.find((w) =>
      w.message.includes('material properties'),
    );
    expect(matWarn).toBeDefined();
  });

  test('includes determinacy result in output', () => {
    const { nodes, members } = simpleBeam();
    const result = validateStructure(nodes, members);

    expect(result.determinacy).toBeDefined();
  });

  test('mechanism detected when too few members', () => {
    // 3 nodes, 1 member, 3 reactions → 3*1 + 3 = 6 < 3*3 = 9 → unstable
    const nodes = makeNodes([
      { id: 'n1', x: 0, y: 0, z: 0, restraints: { fx: true, fy: true } },
      { id: 'n2', x: 5, y: 0, z: 0, restraints: { fy: true } },
      { id: 'n3', x: 10, y: 0, z: 0 },
    ]);
    const members = makeMembers([
      { id: 'm1', startNodeId: 'n1', endNodeId: 'n2', E: 200e9, I: 1e-4, A: 0.01 },
    ]);
    const result = validateStructure(nodes, members);

    const mechanismErr = result.errors.find((e) =>
      e.message.includes('Mechanism') || e.message.includes('UNSTABLE'),
    );
    expect(mechanismErr).toBeDefined();
  });
});

// ============================================
// getSupportType
// ============================================

describe('getSupportType', () => {
  test('returns "None" when no restraints', () => {
    expect(getSupportType()).toBe('None');
    expect(getSupportType(undefined)).toBe('None');
  });

  test('returns "None" when all false', () => {
    expect(getSupportType({ fx: false, fy: false, fz: false })).toBe('None');
  });

  test('returns "Fixed (3 DOF)" when all translational restrained', () => {
    expect(getSupportType({ fx: true, fy: true, fz: true })).toBe('Fixed (3 DOF)');
  });

  test('returns "Pin (2 DOF)" when fx and fy restrained', () => {
    expect(getSupportType({ fx: true, fy: true })).toBe('Pin (2 DOF)');
  });

  test('returns "Roller-X (1 DOF)" when only fy restrained', () => {
    expect(getSupportType({ fy: true })).toBe('Roller-X (1 DOF)');
  });

  test('returns "Roller-Y (1 DOF)" when only fx restrained', () => {
    expect(getSupportType({ fx: true })).toBe('Roller-Y (1 DOF)');
  });

  test('returns "Roller-Z (1 DOF)" when only fz restrained', () => {
    expect(getSupportType({ fz: true })).toBe('Roller-Z (1 DOF)');
  });
});

// ============================================
// hasMinimumSupports
// ============================================

describe('hasMinimumSupports', () => {
  test('returns false when no restraints at all', () => {
    const nodes = makeNodes([
      { id: 'n1', x: 0, y: 0, z: 0 },
      { id: 'n2', x: 5, y: 0, z: 0 },
    ]);
    expect(hasMinimumSupports(nodes)).toBe(false);
  });

  test('returns false when only 2 restraints', () => {
    const nodes = makeNodes([
      { id: 'n1', x: 0, y: 0, z: 0, restraints: { fx: true, fy: true } },
      { id: 'n2', x: 5, y: 0, z: 0 },
    ]);
    expect(hasMinimumSupports(nodes)).toBe(false);
  });

  test('returns true when 3+ restraints (pin + roller)', () => {
    const nodes = makeNodes([
      { id: 'n1', x: 0, y: 0, z: 0, restraints: { fx: true, fy: true } },
      { id: 'n2', x: 5, y: 0, z: 0, restraints: { fy: true } },
    ]);
    expect(hasMinimumSupports(nodes)).toBe(true);
  });

  test('returns true when fixed support (6 DOF)', () => {
    const nodes = makeNodes([
      {
        id: 'n1', x: 0, y: 0, z: 0,
        restraints: { fx: true, fy: true, fz: true, mx: true, my: true, mz: true },
      },
      { id: 'n2', x: 5, y: 0, z: 0 },
    ]);
    expect(hasMinimumSupports(nodes)).toBe(true);
  });
});

// ============================================
// hasZeroLengthMembers
// ============================================

describe('hasZeroLengthMembers', () => {
  test('returns false for normal-length members', () => {
    const nodes = makeNodes([
      { id: 'n1', x: 0, y: 0, z: 0 },
      { id: 'n2', x: 5, y: 0, z: 0 },
    ]);
    const members = makeMembers([
      { id: 'm1', startNodeId: 'n1', endNodeId: 'n2' },
    ]);
    expect(hasZeroLengthMembers(nodes, members)).toBe(false);
  });

  test('returns true when start and end node coincide', () => {
    const nodes = makeNodes([
      { id: 'n1', x: 3, y: 4, z: 0 },
      { id: 'n2', x: 3, y: 4, z: 0 },
    ]);
    const members = makeMembers([
      { id: 'm1', startNodeId: 'n1', endNodeId: 'n2' },
    ]);
    expect(hasZeroLengthMembers(nodes, members)).toBe(true);
  });

  test('returns true for very small length (< 1e-6)', () => {
    const nodes = makeNodes([
      { id: 'n1', x: 0, y: 0, z: 0 },
      { id: 'n2', x: 1e-8, y: 0, z: 0 },
    ]);
    const members = makeMembers([
      { id: 'm1', startNodeId: 'n1', endNodeId: 'n2' },
    ]);
    expect(hasZeroLengthMembers(nodes, members)).toBe(true);
  });

  test('skips members with missing nodes', () => {
    const nodes = makeNodes([
      { id: 'n1', x: 0, y: 0, z: 0 },
    ]);
    const members = makeMembers([
      { id: 'm1', startNodeId: 'n1', endNodeId: 'n_missing' },
    ]);
    // Should not throw, returns false since it skips
    expect(hasZeroLengthMembers(nodes, members)).toBe(false);
  });

  test('detects zero-length in 3D', () => {
    const nodes = makeNodes([
      { id: 'n1', x: 1, y: 2, z: 3 },
      { id: 'n2', x: 1, y: 2, z: 3 },
    ]);
    const members = makeMembers([
      { id: 'm1', startNodeId: 'n1', endNodeId: 'n2' },
    ]);
    expect(hasZeroLengthMembers(nodes, members)).toBe(true);
  });

  test('returns false for empty members', () => {
    const nodes = makeNodes([{ id: 'n1', x: 0, y: 0, z: 0 }]);
    const members = new Map();
    expect(hasZeroLengthMembers(nodes, members)).toBe(false);
  });
});
