/**
 * loadConversion — Validation Tests
 *
 * Verifies equivalent nodal load computation against known analytical
 * solutions for all load types: UDL, UVL, point loads, moments.
 *
 * Sign convention used throughout:
 *   - Positive load = same direction as global axis
 *   - Equivalent nodal loads have the SAME direction as the applied load
 *   - Moments follow the right-hand rule
 *
 * References:
 *   - Przemieniecki, "Theory of Matrix Structural Analysis", Ch. 5
 *   - Hibbeler, "Structural Analysis", Table 12-1
 *   - Roark, "Formulas for Stress and Strain", 8th Ed, Table 8.1
 */

import { describe, test, expect } from 'vitest';
import {
  convertMemberLoadsToNodal,
  mergeNodalLoads,
  verifyEquilibrium,
  type MemberLoad,
  type Member,
  type Node,
  type NodalLoad,
} from '../loadConversion';

// ============================================
// HELPERS
// ============================================

function makeNode(id: string, x: number, y: number, z = 0): Node {
  return { id, x, y, z };
}

function makeMember(id: string, startNodeId: string, endNodeId: string): Member {
  return { id, startNodeId, endNodeId };
}

function makeMemberLoad(
  memberId: string,
  type: MemberLoad['type'],
  w1: number,
  direction = 'global_y',
  overrides?: Partial<MemberLoad>,
): MemberLoad {
  return {
    id: `load-${memberId}`,
    memberId,
    type,
    w1,
    direction,
    ...overrides,
  };
}

/** Sum a specific DOF across all loads targeting a given node */
function sumDof(loads: NodalLoad[], nodeId: string, dof: keyof NodalLoad): number {
  return loads
    .filter((l) => l.nodeId === nodeId)
    .reduce((acc, l) => acc + (typeof l[dof] === 'number' ? (l[dof] as number) : 0), 0);
}

/** Sum a DOF across ALL loads */
function sumAll(loads: NodalLoad[], dof: keyof NodalLoad): number {
  return loads.reduce(
    (acc, l) => acc + (typeof l[dof] === 'number' ? (l[dof] as number) : 0),
    0,
  );
}

// Standard tolerance for analytical comparisons
const TOL = 1e-6;

// ============================================
// TEST DATA (reused across tests)
// ============================================

// Horizontal beam: 10 m span from (0,0,0) to (10,0,0)
const nodes10m: Node[] = [makeNode('A', 0, 0), makeNode('B', 10, 0)];
const member10m: Member[] = [makeMember('m1', 'A', 'B')];

// Horizontal beam: 6 m span
const nodes6m: Node[] = [makeNode('A', 0, 0), makeNode('B', 6, 0)];
const member6m: Member[] = [makeMember('m1', 'A', 'B')];

// Horizontal beam: 12 m span
const nodes12m: Node[] = [makeNode('A', 0, 0), makeNode('B', 12, 0)];
const member12m: Member[] = [makeMember('m1', 'A', 'B')];

// ============================================
// 1. FULL-SPAN UDL TESTS
// ============================================

describe('Full-span UDL', () => {
  test('10 m beam, w = -10 kN/m (downward): forces and moments match exact formulas', () => {
    const w = -10; // kN/m downward
    const L = 10;
    const loads: MemberLoad[] = [makeMemberLoad('m1', 'UDL', w)];

    const result = convertMemberLoadsToNodal(loads, member10m, nodes10m);
    expect(result.errors).toHaveLength(0);
    expect(result.nodalLoads).toHaveLength(2);

    const fyA = sumDof(result.nodalLoads, 'A', 'fy');
    const fyB = sumDof(result.nodalLoads, 'B', 'fy');
    const mzA = sumDof(result.nodalLoads, 'A', 'mz');
    const mzB = sumDof(result.nodalLoads, 'B', 'mz');

    // Equivalent nodal loads (same direction as applied w = -10):
    //   F1 = wL/2 = -50 kN
    //   F2 = wL/2 = -50 kN
    //   M1 = wL²/12 = -83.333 kN·m
    //   M2 = -wL²/12 = +83.333 kN·m
    expect(fyA).toBeCloseTo(w * L / 2, 4);             // -50
    expect(fyB).toBeCloseTo(w * L / 2, 4);             // -50
    expect(mzA).toBeCloseTo(w * L * L / 12, 4);        // -83.333
    expect(mzB).toBeCloseTo(-w * L * L / 12, 4);       // +83.333
  });

  test('Total vertical force equals total applied load', () => {
    const w = -10;
    const L = 10;
    const loads: MemberLoad[] = [makeMemberLoad('m1', 'UDL', w)];
    const result = convertMemberLoadsToNodal(loads, member10m, nodes10m);

    const totalFy = sumAll(result.nodalLoads, 'fy');
    expect(totalFy).toBeCloseTo(w * L, 4); // -100 kN total
  });

  test('Moment equilibrium about midspan: M_A + M_B + R_A·L/2 + R_B·(-L/2) = 0', () => {
    // Actually for equivalent nodal loads: M1 + M2 should be zero (symmetric UDL)
    const w = -10;
    const L = 10;
    const loads: MemberLoad[] = [makeMemberLoad('m1', 'UDL', w)];
    const result = convertMemberLoadsToNodal(loads, member10m, nodes10m);

    const mzA = sumDof(result.nodalLoads, 'A', 'mz');
    const mzB = sumDof(result.nodalLoads, 'B', 'mz');

    // For symmetric full-span UDL: sum of ENL moments = 0
    expect(mzA + mzB).toBeCloseTo(0, 6);
  });

  test('Global Y upward (positive w) inverts signs correctly', () => {
    const w = 5; // kN/m upward
    const L = 10;
    const loads: MemberLoad[] = [makeMemberLoad('m1', 'UDL', w)];
    const result = convertMemberLoadsToNodal(loads, member10m, nodes10m);

    const fyA = sumDof(result.nodalLoads, 'A', 'fy');
    const fyB = sumDof(result.nodalLoads, 'B', 'fy');

    expect(fyA).toBeCloseTo(w * L / 2, 4);  // +25 kN (upward)
    expect(fyB).toBeCloseTo(w * L / 2, 4);  // +25 kN (upward)
  });

  test('Short beam 6 m, w = -20 kN/m', () => {
    const w = -20;
    const L = 6;
    const loads: MemberLoad[] = [makeMemberLoad('m1', 'UDL', w)];
    const result = convertMemberLoadsToNodal(loads, member6m, nodes6m);

    const fyA = sumDof(result.nodalLoads, 'A', 'fy');
    const fyB = sumDof(result.nodalLoads, 'B', 'fy');
    const mzA = sumDof(result.nodalLoads, 'A', 'mz');
    const mzB = sumDof(result.nodalLoads, 'B', 'mz');

    expect(fyA).toBeCloseTo(-60, 4);           // wL/2 = -60
    expect(fyB).toBeCloseTo(-60, 4);           // wL/2 = -60
    expect(mzA).toBeCloseTo(-60, 4);           // wL²/12 = -60
    expect(mzB).toBeCloseTo(60, 4);            // -wL²/12 = +60
  });
});

// ============================================
// 2. PARTIAL-SPAN UDL TESTS
// ============================================

describe('Partial-span UDL', () => {
  test('Half-span UDL (0 to 0.5): Hermite integration gives correct partition', () => {
    const w = -10; // kN/m
    const L = 10;
    const loads: MemberLoad[] = [
      makeMemberLoad('m1', 'UDL', w, 'global_y', { startPos: 0, endPos: 0.5 }),
    ];
    const result = convertMemberLoadsToNodal(loads, member10m, nodes10m);
    expect(result.errors).toHaveLength(0);

    // Total vertical force = w × loadSpan = -10 × 5 = -50 kN
    const totalFy = sumAll(result.nodalLoads, 'fy');
    expect(totalFy).toBeCloseTo(-50, 4);

    // Node A should carry more load since load is on its side
    const fyA = sumDof(result.nodalLoads, 'A', 'fy');
    const fyB = sumDof(result.nodalLoads, 'B', 'fy');
    expect(Math.abs(fyA)).toBeGreaterThan(Math.abs(fyB));
  });

  test('Quarter-span UDL (0.25 to 0.75): symmetric → equal force distribution', () => {
    const w = -12; // kN/m
    const L = 10;
    const loads: MemberLoad[] = [
      makeMemberLoad('m1', 'UDL', w, 'global_y', { startPos: 0.25, endPos: 0.75 }),
    ];
    const result = convertMemberLoadsToNodal(loads, member10m, nodes10m);

    // Total load = -12 × 5 = -60 kN
    const totalFy = sumAll(result.nodalLoads, 'fy');
    expect(totalFy).toBeCloseTo(-60, 4);

    // Symmetric placement → F_A ≈ F_B (but not exactly equal due to Hermite)
    // Actually, for load centered on beam, by symmetry F_A = F_B and M_A = -M_B
    const fyA = sumDof(result.nodalLoads, 'A', 'fy');
    const fyB = sumDof(result.nodalLoads, 'B', 'fy');
    const mzA = sumDof(result.nodalLoads, 'A', 'mz');
    const mzB = sumDof(result.nodalLoads, 'B', 'mz');
    expect(fyA).toBeCloseTo(fyB, 4); // symmetric
    expect(mzA).toBeCloseTo(-mzB, 4); // antisymmetric
  });

  test('Partial-span force equilibrium: ΣF_nodal = w × (b-a)', () => {
    const w = -8;
    const L = 12;
    const loads: MemberLoad[] = [
      makeMemberLoad('m1', 'UDL', w, 'global_y', { startPos: 0.2, endPos: 0.7 }),
    ];
    const result = convertMemberLoadsToNodal(loads, member12m, nodes12m);

    const span = (0.7 - 0.2) * L; // 6 m
    const totalFy = sumAll(result.nodalLoads, 'fy');
    expect(totalFy).toBeCloseTo(w * span, 4); // -48 kN
  });

  test('Full span via startPos=0, endPos=1 matches standard UDL formulas', () => {
    const w = -10;
    const L = 10;

    // Explicit full span via partial parameters
    const loadsPartial: MemberLoad[] = [
      makeMemberLoad('m1', 'UDL', w, 'global_y', { startPos: 0, endPos: 1 }),
    ];
    // Implicit full span (no startPos/endPos)
    const loadsDefault: MemberLoad[] = [makeMemberLoad('m1', 'UDL', w)];

    const resultPartial = convertMemberLoadsToNodal(loadsPartial, member10m, nodes10m);
    const resultDefault = convertMemberLoadsToNodal(loadsDefault, member10m, nodes10m);

    // Both should give identical results
    for (const dof of ['fy', 'mz'] as const) {
      const pA = sumDof(resultPartial.nodalLoads, 'A', dof);
      const dA = sumDof(resultDefault.nodalLoads, 'A', dof);
      expect(pA).toBeCloseTo(dA, 6);
    }
  });
});

// ============================================
// 3. TRIANGULAR / UVL TESTS
// ============================================

describe('Triangular (UVL) loads', () => {
  test('Ascending triangle 0→w2: F1=3wL/20, F2=7wL/20, M1=wL²/30, M2=-wL²/20', () => {
    const w2 = -10; // kN/m at end
    const L = 10;
    const loads: MemberLoad[] = [
      makeMemberLoad('m1', 'triangular', 0, 'global_y', { w2 }),
    ];
    const result = convertMemberLoadsToNodal(loads, member10m, nodes10m);
    expect(result.errors).toHaveLength(0);

    const fyA = sumDof(result.nodalLoads, 'A', 'fy');
    const fyB = sumDof(result.nodalLoads, 'B', 'fy');
    const mzA = sumDof(result.nodalLoads, 'A', 'mz');
    const mzB = sumDof(result.nodalLoads, 'B', 'mz');

    // Ascending triangle from 0 to w2:
    // F1 = 3·w2·L/20 = 3×(-10)×10/20 = -15
    // F2 = 7·w2·L/20 = 7×(-10)×10/20 = -35
    // M1 = w2·L²/30  = (-10)×100/30   = -33.333
    // M2 = -w2·L²/20 = 10×100/20      = +50
    expect(fyA).toBeCloseTo(3 * w2 * L / 20, 4);    // -15
    expect(fyB).toBeCloseTo(7 * w2 * L / 20, 4);    // -35
    expect(mzA).toBeCloseTo(w2 * L * L / 30, 4);    // -33.333
    expect(mzB).toBeCloseTo(-w2 * L * L / 20, 4);   // +50
  });

  test('Total force equals area of triangle wL/2', () => {
    const w2 = -10;
    const L = 10;
    const loads: MemberLoad[] = [
      makeMemberLoad('m1', 'triangular', 0, 'global_y', { w2 }),
    ];
    const result = convertMemberLoadsToNodal(loads, member10m, nodes10m);

    const totalFy = sumAll(result.nodalLoads, 'fy');
    expect(totalFy).toBeCloseTo(w2 * L / 2, 4); // -50 kN
  });

  test('Descending triangle w1→0: symmetric to ascending', () => {
    const w1 = -10;
    const L = 10;
    const loads: MemberLoad[] = [
      makeMemberLoad('m1', 'triangular', w1, 'global_y', { w2: 0 }),
    ];
    const result = convertMemberLoadsToNodal(loads, member10m, nodes10m);

    const fyA = sumDof(result.nodalLoads, 'A', 'fy');
    const fyB = sumDof(result.nodalLoads, 'B', 'fy');

    // Descending triangle from w1 to 0:
    // Decompose: w(x) = w1 + (0-w1)·x/L = w1·(1 - x/L)
    // = uniform w1 + triangle (0 → -w1)
    // F1_u = w1·L/2 = -50,  F1_t = 3·(-w1)·L/20 = +15 → F1 = -35
    // F2_u = w1·L/2 = -50,  F2_t = 7·(-w1)·L/20 = +35 → F2 = -15
    expect(fyA).toBeCloseTo(-35, 4);  // heavier side
    expect(fyB).toBeCloseTo(-15, 4);  // lighter side
  });

  test('Trapezoidal load w1≠w2: correct total force', () => {
    const w1 = -5;   // kN/m at start
    const w2 = -15;  // kN/m at end
    const L = 10;
    const loads: MemberLoad[] = [
      makeMemberLoad('m1', 'triangular', w1, 'global_y', { w2 }),
    ];
    const result = convertMemberLoadsToNodal(loads, member10m, nodes10m);

    // Trapezoidal area = (w1 + w2) × L / 2 = (-5 + -15) × 10 / 2 = -100
    const totalFy = sumAll(result.nodalLoads, 'fy');
    expect(totalFy).toBeCloseTo((w1 + w2) * L / 2, 4);
  });

  test('Uniform w1=w2 delegates to UDL and matches', () => {
    const w = -10;
    const L = 10;

    const udlLoads: MemberLoad[] = [makeMemberLoad('m1', 'UDL', w)];
    const triLoads: MemberLoad[] = [makeMemberLoad('m1', 'triangular', w, 'global_y', { w2: w })];

    const udlResult = convertMemberLoadsToNodal(udlLoads, member10m, nodes10m);
    const triResult = convertMemberLoadsToNodal(triLoads, member10m, nodes10m);

    for (const dof of ['fy', 'mz'] as const) {
      const udlA = sumDof(udlResult.nodalLoads, 'A', dof);
      const triA = sumDof(triResult.nodalLoads, 'A', dof);
      expect(triA).toBeCloseTo(udlA, 6);
    }
  });
});

// ============================================
// 4. POINT LOAD TESTS
// ============================================

describe('Point loads', () => {
  test('Midspan point load P: F1=F2=P/2 (by symmetry), M1=-M2', () => {
    const P = -100; // kN downward
    const L = 10;
    const loads: MemberLoad[] = [
      makeMemberLoad('m1', 'point', P, 'global_y', { startPos: 0.5 }),
    ];
    const result = convertMemberLoadsToNodal(loads, member10m, nodes10m);
    expect(result.errors).toHaveLength(0);

    const fyA = sumDof(result.nodalLoads, 'A', 'fy');
    const fyB = sumDof(result.nodalLoads, 'B', 'fy');
    const mzA = sumDof(result.nodalLoads, 'A', 'mz');
    const mzB = sumDof(result.nodalLoads, 'B', 'mz');

    // a = b = L/2
    // F1 = P·b²·(3a+b)/L³ = P·(L/2)²·(3L/2+L/2)/(L³) = P·L²/4·2L/L³ = P/2
    // M1 = P·a·b²/L² = P·(L/2)·(L/2)²/L² = PL/8
    expect(fyA).toBeCloseTo(P / 2, 4);       // -50
    expect(fyB).toBeCloseTo(P / 2, 4);       // -50
    expect(mzA).toBeCloseTo(P * L / 8, 4);   // -125
    expect(mzB).toBeCloseTo(-P * L / 8, 4);  // +125 (antisymmetric)
  });

  test('Quarter-span point load: known Hermite values', () => {
    const P = -100;
    const L = 10;
    const a = 2.5;  // 0.25L from start
    const b = 7.5;  // 0.75L from start
    const loads: MemberLoad[] = [
      makeMemberLoad('m1', 'point', P, 'global_y', { startPos: 0.25 }),
    ];
    const result = convertMemberLoadsToNodal(loads, member10m, nodes10m);

    const fyA = sumDof(result.nodalLoads, 'A', 'fy');
    const fyB = sumDof(result.nodalLoads, 'B', 'fy');

    // F1 = P·b²·(3a+b)/L³ = -100·56.25·(7.5+7.5)/1000 = -100·56.25·15/1000 = -84.375
    const F1_exact = P * b * b * (3 * a + b) / (L * L * L);
    const F2_exact = P * a * a * (a + 3 * b) / (L * L * L);
    expect(fyA).toBeCloseTo(F1_exact, 4);
    expect(fyB).toBeCloseTo(F2_exact, 4);

    // Total force = P
    expect(fyA + fyB).toBeCloseTo(P, 6);
  });

  test('Point load at start (pos=0): all load goes to node A', () => {
    const P = -50;
    const L = 10;
    const loads: MemberLoad[] = [
      makeMemberLoad('m1', 'point', P, 'global_y', { startPos: 0 }),
    ];
    const result = convertMemberLoadsToNodal(loads, member10m, nodes10m);

    const fyA = sumDof(result.nodalLoads, 'A', 'fy');
    const fyB = sumDof(result.nodalLoads, 'B', 'fy');

    // a=0, b=L → F1 = P·L²·L/L³ = P, F2 = 0
    expect(fyA).toBeCloseTo(P, 4);
    expect(Math.abs(fyB)).toBeLessThan(TOL);
  });

  test('Point load force equilibrium: F1 + F2 = P', () => {
    const P = -75;
    const L = 10;
    for (const pos of [0.1, 0.25, 0.5, 0.75, 0.9]) {
      const loads: MemberLoad[] = [
        makeMemberLoad('m1', 'point', P, 'global_y', { startPos: pos }),
      ];
      const result = convertMemberLoadsToNodal(loads, member10m, nodes10m);
      const totalFy = sumAll(result.nodalLoads, 'fy');
      expect(totalFy).toBeCloseTo(P, 4);
    }
  });
});

// ============================================
// 5. CONCENTRATED MOMENT TESTS
// ============================================

describe('Concentrated moments', () => {
  test('Midspan moment M₀: R1=-R2, M1=M2=M₀/4', () => {
    const M0 = 100; // kN·m
    const L = 10;
    const loads: MemberLoad[] = [
      makeMemberLoad('m1', 'moment', M0, 'global_y', { startPos: 0.5 }),
    ];
    const result = convertMemberLoadsToNodal(loads, member10m, nodes10m);

    const fyA = sumDof(result.nodalLoads, 'A', 'fy');
    const fyB = sumDof(result.nodalLoads, 'B', 'fy');
    const mzA = sumDof(result.nodalLoads, 'A', 'mz');
    const mzB = sumDof(result.nodalLoads, 'B', 'mz');

    const a = L / 2;
    const b = L / 2;
    const L2 = L * L;
    const L3 = L2 * L;

    // F1 = -6·M0·a·b/L³ = -6·100·25/1000 = -15
    // F2 = +6·M0·a·b/L³ = +15
    expect(fyA).toBeCloseTo(-6 * M0 * a * b / L3, 4);   // -15
    expect(fyB).toBeCloseTo(6 * M0 * a * b / L3, 4);    // +15
    expect(fyA + fyB).toBeCloseTo(0, 6);                  // zero net force

    // M1 = M0·b·(b-2a)/L² = 100·5·(5-10)/100 = -25
    // M2 = M0·a·(a-2b)/L² = 100·5·(5-10)/100 = -25
    expect(mzA).toBeCloseTo(M0 * b * (b - 2 * a) / L2, 4);
    expect(mzB).toBeCloseTo(M0 * a * (a - 2 * b) / L2, 4);
  });

  test('Moment force equilibrium: net vertical force = 0', () => {
    const M0 = 50;
    const L = 10;
    for (const pos of [0.1, 0.25, 0.5, 0.75, 0.9]) {
      const loads: MemberLoad[] = [
        makeMemberLoad('m1', 'moment', M0, 'global_y', { startPos: pos }),
      ];
      const result = convertMemberLoadsToNodal(loads, member10m, nodes10m);
      const totalFy = sumAll(result.nodalLoads, 'fy');
      expect(totalFy).toBeCloseTo(0, 6);
    }
  });

  test('Moment equilibrium: M1 + M2 + F2·L = M₀', () => {
    const M0 = 80;
    const L = 10;
    for (const pos of [0.1, 0.3, 0.5, 0.7, 0.9]) {
      const loads: MemberLoad[] = [
        makeMemberLoad('m1', 'moment', M0, 'global_y', { startPos: pos }),
      ];
      const result = convertMemberLoadsToNodal(loads, member10m, nodes10m);
      const mzA = sumDof(result.nodalLoads, 'A', 'mz');
      const mzB = sumDof(result.nodalLoads, 'B', 'mz');
      const fyB = sumDof(result.nodalLoads, 'B', 'fy');

      // For a concentrated moment, the correct equilibrium about node A is:
      // M1 + M2 + F2·L = M₀  (from Hermite shape function derivation)
      expect(mzA + mzB + fyB * L).toBeCloseTo(M0, 4);
    }
  });
});

// ============================================
// 6. GLOBAL DIRECTION TESTS
// ============================================

describe('Global direction mapping', () => {
  test('global_x UDL: force goes to fx, moment to mz', () => {
    const w = -10;
    const loads: MemberLoad[] = [makeMemberLoad('m1', 'UDL', w, 'global_x')];
    const result = convertMemberLoadsToNodal(loads, member10m, nodes10m);

    const fxA = sumDof(result.nodalLoads, 'A', 'fx');
    const fyA = sumDof(result.nodalLoads, 'A', 'fy');
    expect(Math.abs(fxA)).toBeGreaterThan(1); // force in X
    expect(Math.abs(fyA)).toBeLessThan(TOL);  // no force in Y
  });

  test('global_z UDL: force goes to fz, moment to my', () => {
    const w = -10;
    const loads: MemberLoad[] = [makeMemberLoad('m1', 'UDL', w, 'global_z')];
    const result = convertMemberLoadsToNodal(loads, member10m, nodes10m);

    const fzA = sumDof(result.nodalLoads, 'A', 'fz');
    const myA = sumDof(result.nodalLoads, 'A', 'my');
    expect(Math.abs(fzA)).toBeGreaterThan(1); // force in Z
    expect(Math.abs(myA)).toBeGreaterThan(1); // moment about Y (not X)
  });
});

// ============================================
// 7. MERGE NODAL LOADS TESTS
// ============================================

describe('mergeNodalLoads', () => {
  test('Merges loads on same node by summation', () => {
    const loads: NodalLoad[] = [
      { nodeId: 'A', fy: -50, mz: -83 },
      { nodeId: 'A', fy: -30, mz: 20 },
      { nodeId: 'B', fy: -50, mz: 83 },
    ];
    const merged = mergeNodalLoads(loads);

    const loadA = merged.find((l) => l.nodeId === 'A');
    const loadB = merged.find((l) => l.nodeId === 'B');
    expect(loadA?.fy).toBeCloseTo(-80, 4);
    expect(loadA?.mz).toBeCloseTo(-63, 4);
    expect(loadB?.fy).toBeCloseTo(-50, 4);
  });

  test('Preserves separate nodes', () => {
    const loads: NodalLoad[] = [
      { nodeId: 'A', fy: -10 },
      { nodeId: 'B', fy: -20 },
      { nodeId: 'C', fy: -30 },
    ];
    const merged = mergeNodalLoads(loads);
    expect(merged).toHaveLength(3);
  });
});

// ============================================
// 8. EDGE CASES
// ============================================

describe('Edge cases', () => {
  test('Zero-intensity load produces no nodal loads', () => {
    const loads: MemberLoad[] = [makeMemberLoad('m1', 'UDL', 0)];
    const result = convertMemberLoadsToNodal(loads, member10m, nodes10m);
    expect(result.nodalLoads).toHaveLength(0);
  });

  test('Near-zero load below tolerance is skipped', () => {
    const loads: MemberLoad[] = [makeMemberLoad('m1', 'UDL', 1e-12)];
    const result = convertMemberLoadsToNodal(loads, member10m, nodes10m);
    expect(result.nodalLoads).toHaveLength(0);
  });

  test('Multiple loads on same member superpose correctly', () => {
    const w = -10;
    const L = 10;
    const loads: MemberLoad[] = [
      makeMemberLoad('m1', 'UDL', w, 'global_y'),
      makeMemberLoad('m1', 'UDL', w, 'global_y'),
    ];
    // Make the IDs unique
    loads[0].id = 'load-1';
    loads[1].id = 'load-2';

    const result = convertMemberLoadsToNodal(loads, member10m, nodes10m);
    const totalFy = sumAll(result.nodalLoads, 'fy');

    // Two identical UDLs → double the total
    expect(totalFy).toBeCloseTo(2 * w * L, 4);
  });

  test('Invalid member reference produces warning, not crash', () => {
    const loads: MemberLoad[] = [makeMemberLoad('nonexistent', 'UDL', -10)];
    const result = convertMemberLoadsToNodal(loads, member10m, nodes10m);
    // Should not crash; missing member is skipped with a warning
    expect(result.warnings.length + result.errors.length).toBeGreaterThan(0);
    expect(result.nodalLoads).toHaveLength(0);
  });
});

// ============================================
// 9. CONSISTENCY: PARTIAL → FULL SPAN LIMIT
// ============================================

describe('Partial-to-full span consistency', () => {
  test('Partial UDL 0→1 matches full-span UDL exactly', () => {
    const w = -10;
    const partial: MemberLoad[] = [
      makeMemberLoad('m1', 'UDL', w, 'global_y', { startPos: 0, endPos: 1 }),
    ];
    const full: MemberLoad[] = [makeMemberLoad('m1', 'UDL', w)];

    const rP = convertMemberLoadsToNodal(partial, member10m, nodes10m);
    const rF = convertMemberLoadsToNodal(full, member10m, nodes10m);

    for (const dof of ['fy', 'mz'] as const) {
      expect(sumDof(rP.nodalLoads, 'A', dof)).toBeCloseTo(
        sumDof(rF.nodalLoads, 'A', dof),
        6,
      );
      expect(sumDof(rP.nodalLoads, 'B', dof)).toBeCloseTo(
        sumDof(rF.nodalLoads, 'B', dof),
        6,
      );
    }
  });

  test('Two adjacent half-span UDLs equal one full-span UDL', () => {
    const w = -10;
    const L = 10;

    const twoHalves: MemberLoad[] = [
      { ...makeMemberLoad('m1', 'UDL', w, 'global_y', { startPos: 0, endPos: 0.5 }), id: 'h1' },
      { ...makeMemberLoad('m1', 'UDL', w, 'global_y', { startPos: 0.5, endPos: 1 }), id: 'h2' },
    ];
    const oneFull: MemberLoad[] = [makeMemberLoad('m1', 'UDL', w)];

    const rHalf = convertMemberLoadsToNodal(twoHalves, member10m, nodes10m);
    const rFull = convertMemberLoadsToNodal(oneFull, member10m, nodes10m);

    // The two half-span loads should sum to the same result as one full-span load
    const mergedHalf = mergeNodalLoads(rHalf.nodalLoads);
    const mergedFull = mergeNodalLoads(rFull.nodalLoads);

    for (const dof of ['fy', 'mz'] as const) {
      expect(sumDof(mergedHalf, 'A', dof)).toBeCloseTo(
        sumDof(mergedFull, 'A', dof),
        4,
      );
      expect(sumDof(mergedHalf, 'B', dof)).toBeCloseTo(
        sumDof(mergedFull, 'B', dof),
        4,
      );
    }
  });
});
