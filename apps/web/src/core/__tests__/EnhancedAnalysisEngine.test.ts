/**
 * EnhancedAnalysisEngine — Validation Tests
 *
 * Verifies fixed-end force computation and member force recovery against
 * known analytical solutions from structural analysis textbooks.
 *
 * References:
 *   - Przemieniecki, "Theory of Matrix Structural Analysis", Ch. 5
 *   - McGuire, Gallagher & Ziemian, "Matrix Structural Analysis", 2nd Ed
 *   - Hibbeler, "Structural Analysis", Tables 12-1, 12-2
 *   - Roark, "Formulas for Stress and Strain", 8th Ed
 */

import { describe, test, expect } from 'vitest';
import { EnhancedAnalysisEngine } from '../EnhancedAnalysisEngine';
import type { AnalysisConfig } from '../EnhancedAnalysisEngine';
import type { Node, Member, MemberLoad } from '../../store/model';

// ============================================
// HELPERS
// ============================================

function makeNode(id: string, x: number, y: number, z: number, restraints?: Node['restraints']): Node {
  return {
    id,
    x, y, z,
    restraints: restraints ?? undefined,
    loads: [],
  } as Node;
}

function makeMember(
  id: string,
  startNodeId: string,
  endNodeId: string,
  overrides?: Partial<Member>
): Member {
  return {
    id,
    startNodeId,
    endNodeId,
    type: 'beam' as const,
    E: 200e6,          // 200 GPa in kN/m²
    A: 0.01,           // 100 cm²
    I: 8.333e-5,       // Iy (strong axis) in m⁴
    Iz: 8.333e-5,      // Iz = Iy for symmetric section
    G: 77e6,           // 77 GPa in kN/m²
    J: 1e-5,           // torsional constant in m⁴
    betaAngle: 0,
    ...overrides,
  } as Member;
}

/** Shorthand for building AnalysisConfig with member loads */
function makeLinearStaticConfig(
  memberLoads: MemberLoad[] = [],
  nodalLoads: { targetId: string; values: number[]; direction: string; type?: string }[] = []
): AnalysisConfig {
  return {
    type: 'linear-static',
    options: {},
    loadCases: [{
      id: 'lc1',
      name: 'LC1',
      type: 'dead',
      factor: 1.0,
      loads: nodalLoads.map((l, i) => ({
        id: `load_${i}`,
        type: (l.type ?? 'point') as 'point' | 'distributed' | 'moment',
        targetType: 'node' as const,
        targetId: l.targetId,
        values: l.values,
        direction: l.direction as 'X' | 'Y' | 'Z',
      })),
      memberLoads,
    }],
  };
}

function assertClose(actual: number, expected: number, tol: number, label: string) {
  const err = Math.abs(actual - expected);
  const relErr = expected !== 0 ? err / Math.abs(expected) : err;
  expect(
    err <= tol || relErr <= tol,
    `${label}: expected ${expected.toExponential(4)}, got ${actual.toExponential(4)} (abs err: ${err.toExponential(3)}, rel err: ${(relErr * 100).toFixed(4)}%)`
  ).toBe(true);
}

// ============================================
// TEST SUITE
// ============================================

describe('EnhancedAnalysisEngine — Analytical Validation', () => {
  const engine = new EnhancedAnalysisEngine();

  // -----------------------------------------------------------------
  // Test 1: Simply supported beam with nodal point load at midspan
  //
  //   A ----P/2----B----P/2---- C
  //   ^(pin)       P↓         ^(roller)
  //
  //   L = 6m, P = 120 kN at node B (midspan)
  //   δ_max = PL³/(48EI)
  //   M_max = PL/4
  //   V = P/2
  // -----------------------------------------------------------------
  test('Simply supported beam — midspan point load (nodal)', async () => {
    const L = 6;
    const P = 120; // kN, downward
    const E = 200e6; // kN/m²
    const I = 8.333e-5; // m⁴

    const nodes = new Map<string, Node>();
    nodes.set('A', makeNode('A', 0, 0, 0, { fx: true, fy: true, fz: true, mx: true, my: true, mz: false }));
    nodes.set('B', makeNode('B', L / 2, 0, 0));
    nodes.set('C', makeNode('C', L, 0, 0, { fx: false, fy: true, fz: true, mx: true, my: true, mz: false }));

    const members = new Map<string, Member>();
    members.set('m1', makeMember('m1', 'A', 'B', { E, I, Iz: I }));
    members.set('m2', makeMember('m2', 'B', 'C', { E, I, Iz: I }));

    const config = makeLinearStaticConfig([], [
      { targetId: 'B', values: [-P], direction: 'Y' }, // downward
    ]);

    const results = await engine.runAnalysis(nodes, members, config);
    expect(results.status).toBe('completed');

    // Expected deflection at midspan
    const delta_exact = P * L * L * L / (48 * E * I);

    const dispB = results.displacements.find(d => d.nodeId === 'B');
    expect(dispB).toBeDefined();
    assertClose(Math.abs(dispB!.dy), delta_exact, 1e-6, 'Midspan deflection');

    // Expected reactions: R_A = R_C = P/2 = 60 kN upward
    const rA = results.reactions.find(r => r.nodeId === 'A');
    const rC = results.reactions.find(r => r.nodeId === 'C');
    expect(rA).toBeDefined();
    expect(rC).toBeDefined();
    assertClose(Math.abs(rA!.fy), P / 2, 0.1, 'Reaction at A');
    assertClose(Math.abs(rC!.fy), P / 2, 0.1, 'Reaction at C');
  });

  // -----------------------------------------------------------------
  // Test 2: Fixed-fixed beam with full-span UDL (member load)
  //
  //   ===A================B===
  //     ↓↓↓↓↓ w ↓↓↓↓↓↓↓
  //
  //   L = 6m, w = -20 kN/m (downward)
  //   δ_max = wL⁴/(384EI)  (at midspan)
  //   M_end = wL²/12
  //   M_mid = -wL²/24  (using M=EI*y'' convention)
  //   R = wL/2 at each end
  // -----------------------------------------------------------------
  test('Fixed-fixed beam — full UDL (member load)', async () => {
    const L = 6;
    const w = -20; // kN/m, downward (negative local-y)
    const E = 200e6;
    const I = 8.333e-5;

    const nodes = new Map<string, Node>();
    nodes.set('A', makeNode('A', 0, 0, 0, { fx: true, fy: true, fz: true, mx: true, my: true, mz: true }));
    nodes.set('B', makeNode('B', L, 0, 0, { fx: true, fy: true, fz: true, mx: true, my: true, mz: true }));

    const members = new Map<string, Member>();
    members.set('m1', makeMember('m1', 'A', 'B', { E, I, Iz: I }));

    const memberLoads: MemberLoad[] = [{
      id: 'ml1',
      memberId: 'm1',
      type: 'UDL',
      w1: w,
      direction: 'local_y',
      startPos: 0,
      endPos: 1,
    }];

    const config = makeLinearStaticConfig(memberLoads);
    const results = await engine.runAnalysis(nodes, members, config);
    expect(results.status).toBe('completed');

    // For fully fixed beam, displacements should be ~0
    const dispA = results.displacements.find(d => d.nodeId === 'A');
    const dispB = results.displacements.find(d => d.nodeId === 'B');
    assertClose(dispA!.dy, 0, 1e-10, 'Fixed end A displacement');
    assertClose(dispB!.dy, 0, 1e-10, 'Fixed end B displacement');

    // Reactions: R = |w|L/2 = 60 kN upward at each end
    const rA = results.reactions.find(r => r.nodeId === 'A');
    const rB = results.reactions.find(r => r.nodeId === 'B');
    assertClose(Math.abs(rA!.fy), Math.abs(w) * L / 2, 0.1, 'Reaction at A');
    assertClose(Math.abs(rB!.fy), Math.abs(w) * L / 2, 0.1, 'Reaction at B');

    // Member forces at midspan (position = 0.5)
    const midForce = results.memberForces.find(f => f.memberId === 'm1' && f.position === 0.5);
    expect(midForce).toBeDefined();

    // Shear at midspan = 0 (by symmetry)
    assertClose(midForce!.shearY, 0, 0.5, 'Midspan shear (should be ~0)');

    // Moment at supports: |M_end| = |w|L²/12 = 60 kN·m
    const endForce = results.memberForces.find(f => f.memberId === 'm1' && f.position === 0);
    expect(endForce).toBeDefined();
    assertClose(Math.abs(endForce!.momentZ), Math.abs(w) * L * L / 12, 1.0, 'End moment');

    // Moment at midspan: |M_mid| = |w|L²/24 = 30 kN·m
    assertClose(Math.abs(midForce!.momentZ), Math.abs(w) * L * L / 24, 1.0, 'Midspan moment');
  });

  // -----------------------------------------------------------------
  // Test 3: Simply supported beam with full-span UDL (member load)
  //
  //   A ------w------- B
  //   △               △
  //
  //   L = 8m, w = -15 kN/m
  //   δ_max = 5wL⁴/(384EI)
  //   M_max = wL²/8  at midspan
  //   V(0) = wL/2, V(L) = -wL/2
  // -----------------------------------------------------------------
  test('Simply supported beam — full UDL (member load)', async () => {
    const L = 8;
    const w = -15; // kN/m, downward
    const E = 200e6;
    const I = 8.333e-5;

    const nodes = new Map<string, Node>();
    // Pin: restrain translation, free rotation about z
    nodes.set('A', makeNode('A', 0, 0, 0, { fx: true, fy: true, fz: true, mx: true, my: true, mz: false }));
    // Roller: restrain y-translation only (and z translations for 3D stability)
    nodes.set('B', makeNode('B', L, 0, 0, { fx: false, fy: true, fz: true, mx: true, my: true, mz: false }));

    const members = new Map<string, Member>();
    members.set('m1', makeMember('m1', 'A', 'B', { E, I, Iz: I }));

    const memberLoads: MemberLoad[] = [{
      id: 'ml1',
      memberId: 'm1',
      type: 'UDL',
      w1: w,
      direction: 'local_y',
    }];

    const config = makeLinearStaticConfig(memberLoads);
    const results = await engine.runAnalysis(nodes, members, config);
    expect(results.status).toBe('completed');

    // Expected midspan deflection: δ = 5|w|L⁴/(384EI)
    const delta_exact = 5 * Math.abs(w) * L ** 4 / (384 * E * I);

    // Find the midspan displacement — since we only have nodes at ends,
    // the deflection is encoded in the rotation DOFs. For a simply supported
    // beam there are no interior nodes, so we check reactions instead.

    // Reactions: R = |w|L/2 = 60 kN
    const rA = results.reactions.find(r => r.nodeId === 'A');
    const rB = results.reactions.find(r => r.nodeId === 'B');
    assertClose(Math.abs(rA!.fy), Math.abs(w) * L / 2, 0.5, 'Reaction at A');
    assertClose(Math.abs(rB!.fy), Math.abs(w) * L / 2, 0.5, 'Reaction at B');

    // Member forces:
    // Shear at start = |w|L/2, shear at end = -|w|L/2 (sign depends on convention)
    const startForce = results.memberForces.find(f => f.memberId === 'm1' && f.position === 0);
    const midForce = results.memberForces.find(f => f.memberId === 'm1' && f.position === 0.5);
    const endForce = results.memberForces.find(f => f.memberId === 'm1' && f.position === 1);

    expect(startForce).toBeDefined();
    expect(midForce).toBeDefined();
    expect(endForce).toBeDefined();

    // Shear at start ≈ |w|L/2
    assertClose(Math.abs(startForce!.shearY), Math.abs(w) * L / 2, 1.0, 'Shear at start');
    // Shear at midspan ≈ 0
    assertClose(Math.abs(midForce!.shearY), 0, 1.0, 'Shear at midspan');
    // Shear at end ≈ |w|L/2
    assertClose(Math.abs(endForce!.shearY), Math.abs(w) * L / 2, 1.0, 'Shear at end');

    // Moment at ends = 0 (simply supported)
    assertClose(Math.abs(startForce!.momentZ), 0, 2.0, 'Moment at start (should be ~0)');
    assertClose(Math.abs(endForce!.momentZ), 0, 2.0, 'Moment at end (should be ~0)');

    // Moment at midspan = |w|L²/8 = 120 kN·m
    assertClose(Math.abs(midForce!.momentZ), Math.abs(w) * L * L / 8, 2.0, 'Midspan moment');
  });

  // -----------------------------------------------------------------
  // Test 4: Cantilever beam with tip point load (nodal)
  //
  //   ===A=============B
  //                    ↓P
  //
  //   L = 4m, P = 50 kN
  //   δ_tip = PL³/(3EI)
  //   θ_tip = PL²/(2EI)
  //   M(x=0) = PL, V = P (constant)
  // -----------------------------------------------------------------
  test('Cantilever — tip point load', async () => {
    const L = 4;
    const P = 50;
    const E = 200e6;
    const I = 8.333e-5;

    const nodes = new Map<string, Node>();
    nodes.set('A', makeNode('A', 0, 0, 0, { fx: true, fy: true, fz: true, mx: true, my: true, mz: true }));
    nodes.set('B', makeNode('B', L, 0, 0));

    const members = new Map<string, Member>();
    members.set('m1', makeMember('m1', 'A', 'B', { E, I, Iz: I }));

    const config = makeLinearStaticConfig([], [
      { targetId: 'B', values: [-P], direction: 'Y' },
    ]);

    const results = await engine.runAnalysis(nodes, members, config);
    expect(results.status).toBe('completed');

    // Tip deflection
    const delta_exact = P * L ** 3 / (3 * E * I);
    const dispB = results.displacements.find(d => d.nodeId === 'B');
    assertClose(Math.abs(dispB!.dy), delta_exact, 1e-6, 'Tip deflection');

    // Reaction at fixed end
    const rA = results.reactions.find(r => r.nodeId === 'A');
    assertClose(Math.abs(rA!.fy), P, 0.01, 'Vertical reaction at A');

    // Member forces: shear should be constant ≈ P
    const startForce = results.memberForces.find(f => f.memberId === 'm1' && f.position === 0);
    const endForce = results.memberForces.find(f => f.memberId === 'm1' && f.position === 1);
    assertClose(Math.abs(startForce!.shearY), P, 0.5, 'Shear at root');
    assertClose(Math.abs(endForce!.shearY), P, 0.5, 'Shear at tip');

    // Moment at root = PL = 200 kN·m, at tip = 0
    assertClose(Math.abs(startForce!.momentZ), P * L, 1.0, 'Root moment');
    assertClose(Math.abs(endForce!.momentZ), 0, 1.0, 'Tip moment');
  });

  // -----------------------------------------------------------------
  // Test 5: Cantilever with full-span UDL (member load)
  //
  //   ===A=============B
  //     ↓↓↓↓↓ w ↓↓↓↓↓
  //
  //   L = 5m, w = -10 kN/m
  //   δ_tip = wL⁴/(8EI)
  //   M(0) = wL²/2 = 125 kN·m, V(0) = wL = 50 kN
  //   M(L) = 0, V(L) = 0
  // -----------------------------------------------------------------
  test('Cantilever — full UDL (member load)', async () => {
    const L = 5;
    const w = -10; // downward
    const E = 200e6;
    const I = 8.333e-5;

    const nodes = new Map<string, Node>();
    nodes.set('A', makeNode('A', 0, 0, 0, { fx: true, fy: true, fz: true, mx: true, my: true, mz: true }));
    nodes.set('B', makeNode('B', L, 0, 0));

    const members = new Map<string, Member>();
    members.set('m1', makeMember('m1', 'A', 'B', { E, I, Iz: I }));

    const memberLoads: MemberLoad[] = [{
      id: 'ml1',
      memberId: 'm1',
      type: 'UDL',
      w1: w,
      direction: 'local_y',
    }];

    const config = makeLinearStaticConfig(memberLoads);
    const results = await engine.runAnalysis(nodes, members, config);

    // Tip deflection: δ = |w|L⁴/(8EI)
    const delta_exact = Math.abs(w) * L ** 4 / (8 * E * I);
    const dispB = results.displacements.find(d => d.nodeId === 'B');
    assertClose(Math.abs(dispB!.dy), delta_exact, delta_exact * 0.01, 'Tip deflection');

    // Reaction: |w|L = 50 kN
    const rA = results.reactions.find(r => r.nodeId === 'A');
    assertClose(Math.abs(rA!.fy), Math.abs(w) * L, 0.5, 'Vertical reaction');

    // Member forces at root (position=0)
    const rootForce = results.memberForces.find(f => f.memberId === 'm1' && f.position === 0);
    // V(0) = |w|L = 50 kN
    assertClose(Math.abs(rootForce!.shearY), Math.abs(w) * L, 1.0, 'Root shear');
    // M(0) = |w|L²/2 = 125 kN·m
    assertClose(Math.abs(rootForce!.momentZ), Math.abs(w) * L * L / 2, 2.0, 'Root moment');

    // Member forces at tip (position=1)
    const tipForce = results.memberForces.find(f => f.memberId === 'm1' && f.position === 1);
    assertClose(Math.abs(tipForce!.shearY), 0, 1.0, 'Tip shear');
    assertClose(Math.abs(tipForce!.momentZ), 0, 2.0, 'Tip moment');
  });

  // -----------------------------------------------------------------
  // Test 6: Fixed-fixed beam with concentrated load at midspan (member load)
  //
  //   ===A=========P=========B===
  //                ↓
  //   L = 8m, P = 100 kN at x = L/2
  //   δ_mid = PL³/(192EI)
  //   M_end = PL/8 = 100 kN·m, M_mid = PL/8 = 100 kN·m
  //   V = P/2 = 50 kN (each side)
  // -----------------------------------------------------------------
  test('Fixed-fixed beam — midspan point load (member load)', async () => {
    const L = 8;
    const P = -100; // downward
    const E = 200e6;
    const I = 8.333e-5;

    const nodes = new Map<string, Node>();
    nodes.set('A', makeNode('A', 0, 0, 0, { fx: true, fy: true, fz: true, mx: true, my: true, mz: true }));
    nodes.set('B', makeNode('B', L, 0, 0, { fx: true, fy: true, fz: true, mx: true, my: true, mz: true }));

    const members = new Map<string, Member>();
    members.set('m1', makeMember('m1', 'A', 'B', { E, I, Iz: I }));

    const memberLoads: MemberLoad[] = [{
      id: 'ml1',
      memberId: 'm1',
      type: 'point',
      P: P,
      a: 0.5, // midspan ratio
      direction: 'local_y',
    }];

    const config = makeLinearStaticConfig(memberLoads);
    const results = await engine.runAnalysis(nodes, members, config);

    // Displacements should be 0 at fixed ends
    assertClose(results.displacements[0].dy, 0, 1e-10, 'Fixed end A dy');
    assertClose(results.displacements[1].dy, 0, 1e-10, 'Fixed end B dy');

    // Reactions: |P|/2 at each end
    const rA = results.reactions.find(r => r.nodeId === 'A');
    const rB = results.reactions.find(r => r.nodeId === 'B');
    assertClose(Math.abs(rA!.fy), Math.abs(P) / 2, 0.5, 'Reaction at A');
    assertClose(Math.abs(rB!.fy), Math.abs(P) / 2, 0.5, 'Reaction at B');

    // End moment: |PL/8| = 100 kN·m
    const endForce = results.memberForces.find(f => f.memberId === 'm1' && f.position === 0);
    assertClose(Math.abs(endForce!.momentZ), Math.abs(P) * L / 8, 2.0, 'End moment');

    // Shear at start: |P|/2 = 50 kN
    assertClose(Math.abs(endForce!.shearY), Math.abs(P) / 2, 1.0, 'Start shear');
  });

  // -----------------------------------------------------------------
  // Test 7: Propped cantilever with UDL  (member load)
  //
  //   ===A=============B
  //     ↓↓↓↓↓ w ↓↓↓↓↓  △
  //
  //   Fixed at A, pin at B (fy restrained, mz free)
  //   L = 6m, w = -20 kN/m
  //   R_B = 3|w|L/8, R_A = 5|w|L/8
  //   M_A = |w|L²/8
  // -----------------------------------------------------------------
  test('Propped cantilever — full UDL (member load)', async () => {
    const L = 6;
    const w = -20;
    const E = 200e6;
    const I = 8.333e-5;

    const nodes = new Map<string, Node>();
    nodes.set('A', makeNode('A', 0, 0, 0, { fx: true, fy: true, fz: true, mx: true, my: true, mz: true }));
    nodes.set('B', makeNode('B', L, 0, 0, { fx: true, fy: true, fz: true, mx: true, my: true, mz: false }));

    const members = new Map<string, Member>();
    members.set('m1', makeMember('m1', 'A', 'B', { E, I, Iz: I }));

    const memberLoads: MemberLoad[] = [{
      id: 'ml1',
      memberId: 'm1',
      type: 'UDL',
      w1: w,
      direction: 'local_y',
    }];

    const config = makeLinearStaticConfig(memberLoads);
    const results = await engine.runAnalysis(nodes, members, config);

    const rA = results.reactions.find(r => r.nodeId === 'A');
    const rB = results.reactions.find(r => r.nodeId === 'B');

    // R_A = 5|w|L/8 = 75 kN, R_B = 3|w|L/8 = 45 kN
    assertClose(Math.abs(rA!.fy), 5 * Math.abs(w) * L / 8, 1.0, 'Reaction at A');
    assertClose(Math.abs(rB!.fy), 3 * Math.abs(w) * L / 8, 1.0, 'Reaction at B');

    // Fixed-end moment at A: |w|L²/8 = 90 kN·m
    assertClose(Math.abs(rA!.mz), Math.abs(w) * L * L / 8, 2.0, 'Fixed-end moment at A');
  });

  // -----------------------------------------------------------------
  // Test 8: Triangular load (ascending) on fixed-fixed beam
  //
  //   ===A================B===
  //     0↗↗↗↗↗↗↗↗↗↗↗w₂
  //
  //   w(x) = w₂·x/L  (0 at A, w₂ at B)
  //   L = 6m, w₂ = -30 kN/m

  //   Total load = w₂·L/2 = 90 kN
  //   Fixed-end reactions (ascending triangle, w₁=0, w₂=w):
  //     R_A = 3wL/20 = 27 kN,  R_B = 7wL/20 = 63 kN
  //     M_A = wL²/30 = 36 kN·m, M_B = -wL²/20 = -54 kN·m
  // -----------------------------------------------------------------
  test('Fixed-fixed beam — ascending triangular load (UVL)', async () => {
    const L = 6;
    const w2 = -30; // peak at end, downward
    const E = 200e6;
    const I = 8.333e-5;

    const nodes = new Map<string, Node>();
    nodes.set('A', makeNode('A', 0, 0, 0, { fx: true, fy: true, fz: true, mx: true, my: true, mz: true }));
    nodes.set('B', makeNode('B', L, 0, 0, { fx: true, fy: true, fz: true, mx: true, my: true, mz: true }));

    const members = new Map<string, Member>();
    members.set('m1', makeMember('m1', 'A', 'B', { E, I, Iz: I }));

    const memberLoads: MemberLoad[] = [{
      id: 'ml1',
      memberId: 'm1',
      type: 'UVL',
      w1: 0,
      w2: w2,
      direction: 'local_y',
      startPos: 0,
      endPos: 1,
    }];

    const config = makeLinearStaticConfig(memberLoads);
    const results = await engine.runAnalysis(nodes, members, config);

    // Displacements at fixed ends should be 0
    assertClose(results.displacements[0].dy, 0, 1e-10, 'Fixed end A dy');

    // Reactions:
    // Decomposition: uniform part w₁=0, triangle part = w₂
    // R_A = 3|w₂|L/20 = 27 kN, R_B = 7|w₂|L/20 = 63 kN
    const rA = results.reactions.find(r => r.nodeId === 'A');
    const rB = results.reactions.find(r => r.nodeId === 'B');
    assertClose(Math.abs(rA!.fy), 3 * Math.abs(w2) * L / 20, 1.5, 'Reaction at A');
    assertClose(Math.abs(rB!.fy), 7 * Math.abs(w2) * L / 20, 1.5, 'Reaction at B');
  });

  // -----------------------------------------------------------------
  // Test 9: Pure axial load (truss element behavior)
  //
  //   ===A=============B→P
  //
  //   L = 3m, P = 500 kN (tension)
  //   δ = PL/(EA), N = P
  // -----------------------------------------------------------------
  test('Axial bar — tension', async () => {
    const L = 3;
    const P = 500; // kN, in +X direction (tension)
    const E = 200e6;
    const A = 0.01;

    const nodes = new Map<string, Node>();
    nodes.set('A', makeNode('A', 0, 0, 0, { fx: true, fy: true, fz: true, mx: true, my: true, mz: true }));
    nodes.set('B', makeNode('B', L, 0, 0, { fx: false, fy: true, fz: true, mx: true, my: true, mz: true }));

    const members = new Map<string, Member>();
    members.set('m1', makeMember('m1', 'A', 'B', { E, A }));

    const config = makeLinearStaticConfig([], [
      { targetId: 'B', values: [P], direction: 'X' },
    ]);

    const results = await engine.runAnalysis(nodes, members, config);

    // Axial deformation: δ = PL/(EA)
    const delta_exact = P * L / (E * A);
    const dispB = results.displacements.find(d => d.nodeId === 'B');
    assertClose(dispB!.dx, delta_exact, 1e-8, 'Axial extension');

    // Member axial force: should be P (tension, positive)
    const force = results.memberForces.find(f => f.memberId === 'm1' && f.position === 0);
    assertClose(Math.abs(force!.axial), P, 0.1, 'Axial force');
  });

  // -----------------------------------------------------------------
  // Test 10: Two-member frame — verify equilibrium
  //
  //   B (free corner)
  //   |    \
  //   |     \  member 2
  //   A(fixed)   C(pinned)
  //
  //   A at (0,0,0) fixed, B at (0,4,0) free, C at (3,0,0) pinned
  //   Load: 30 kN in +X at B
  //   Verify global equilibrium: ∑Fx = 0, ∑Fy = 0, ∑M = 0
  // -----------------------------------------------------------------
  test('Two-member frame — global equilibrium check', async () => {
    const E = 200e6;
    const I = 8.333e-5;

    const nodes = new Map<string, Node>();
    nodes.set('A', makeNode('A', 0, 0, 0, { fx: true, fy: true, fz: true, mx: true, my: true, mz: true }));
    nodes.set('B', makeNode('B', 0, 4, 0));
    nodes.set('C', makeNode('C', 3, 0, 0, { fx: true, fy: true, fz: true, mx: true, my: true, mz: false }));

    const members = new Map<string, Member>();
    members.set('m1', makeMember('m1', 'A', 'B', { E, I, Iz: I }));
    members.set('m2', makeMember('m2', 'B', 'C', { E, I, Iz: I }));

    const config = makeLinearStaticConfig([], [
      { targetId: 'B', values: [30], direction: 'X' },
    ]);

    const results = await engine.runAnalysis(nodes, members, config);

    // Global equilibrium: sum of all reactions + applied load = 0
    const rA = results.reactions.find(r => r.nodeId === 'A')!;
    const rC = results.reactions.find(r => r.nodeId === 'C')!;

    const sumFx = rA.fx + rC.fx + 30; // applied load +30 at B
    const sumFy = rA.fy + rC.fy;

    assertClose(sumFx, 0, 0.1, 'Global ∑Fx = 0');
    assertClose(sumFy, 0, 0.1, 'Global ∑Fy = 0');
  });
});
