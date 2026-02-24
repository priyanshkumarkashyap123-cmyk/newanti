/**
 * memberLoadFEF.test.ts
 *
 * Tests for the WASM point-load FEF correction utility (memberLoadFEF.ts).
 * Validates:
 *  - buildRotation3x3 against known orientations (horizontal, vertical, inclined)
 *  - computePointMomentFEF against Hermite closed-form solutions
 *  - Correct projection of global loads onto local axes
 */

import { describe, test, expect } from 'vitest';
import { buildRotation3x3, computePointMomentFEF, PointMomentLoad } from '../memberLoadFEF';

// Helper: check that two numbers are close
const near = (a: number, b: number, tol = 1e-8) => {
  expect(Math.abs(a - b)).toBeLessThan(tol);
};

// ============================================
// buildRotation3x3 tests
// ============================================
describe('buildRotation3x3', () => {
  test('horizontal member along X (β=0): R = I', () => {
    // Member from (0,0,0) to (5,0,0)
    const R = buildRotation3x3(
      { x: 0, y: 0, z: 0 },
      { x: 5, y: 0, z: 0 },
      0,
    );
    // Local X = global X, Local Y = global Y, Local Z = global Z
    near(R[0][0], 1);  near(R[0][1], 0);  near(R[0][2], 0);
    near(R[1][0], 0);  near(R[1][1], 1);  near(R[1][2], 0);
    near(R[2][0], 0);  near(R[2][1], 0);  near(R[2][2], 1);
  });

  test('horizontal member along Z: local X = +Z, local Y = +Y', () => {
    // Member from (0,0,0) to (0,0,5)
    const R = buildRotation3x3(
      { x: 0, y: 0, z: 0 },
      { x: 0, y: 0, z: 5 },
      0,
    );
    // Local X points along member = global Z
    near(R[0][0], 0);  near(R[0][1], 0);  near(R[0][2], 1);
    // Local Y should be global Y (for horizontal member in XZ plane)
    near(R[1][0], 0);  near(R[1][1], 1);  near(R[1][2], 0);
  });

  test('vertical member (upward): local X = +Y, local Y = −X', () => {
    // Member from (0,0,0) to (0,5,0) — vertical special case
    const R = buildRotation3x3(
      { x: 0, y: 0, z: 0 },
      { x: 0, y: 5, z: 0 },
      0,
    );
    // Local X = member axis = +Y: R[0] = [0, 1, 0]
    near(R[0][0], 0);  near(R[0][1], 1);  near(R[0][2], 0);
    // Vertical special case: local Y = -X, local Z = +Z
    near(R[1][0], -1); near(R[1][1], 0);  near(R[1][2], 0);
    near(R[2][0], 0);  near(R[2][1], 0);  near(R[2][2], 1);
  });

  test('45° inclined member in XY plane', () => {
    // Member from (0,0,0) to (1,1,0)
    const R = buildRotation3x3(
      { x: 0, y: 0, z: 0 },
      { x: 1, y: 1, z: 0 },
      0,
    );
    const inv2 = 1 / Math.sqrt(2);
    // Local X along member: [1/√2, 1/√2, 0]
    near(R[0][0], inv2); near(R[0][1], inv2); near(R[0][2], 0);
    // R should be orthogonal
    const dot01 = R[0][0]*R[1][0] + R[0][1]*R[1][1] + R[0][2]*R[1][2];
    near(dot01, 0, 1e-10);
    // Local Z should be [0, 0, ±1] for member in XY plane
    near(Math.abs(R[2][2]), 1, 1e-10);
  });

  test('orthogonality check for arbitrary 3D member', () => {
    const R = buildRotation3x3(
      { x: 1, y: 2, z: 3 },
      { x: 4, y: 6, z: 8 },
      15,
    );
    // Each row should be unit length
    for (let i = 0; i < 3; i++) {
      const len = Math.sqrt(R[i][0] ** 2 + R[i][1] ** 2 + R[i][2] ** 2);
      near(len, 1, 1e-10);
    }
    // Rows should be mutually orthogonal
    for (let i = 0; i < 3; i++) {
      for (let j = i + 1; j < 3; j++) {
        const dot = R[i][0]*R[j][0] + R[i][1]*R[j][1] + R[i][2]*R[j][2];
        near(dot, 0, 1e-10);
      }
    }
  });
});

// ============================================
// computePointMomentFEF tests
// ============================================
describe('computePointMomentFEF', () => {
  const horizStart = { x: 0, y: 0, z: 0 };
  const horizEnd = { x: 10, y: 0, z: 0 };

  test('midspan point load on horizontal member (local_y)', () => {
    const loads: PointMomentLoad[] = [{
      type: 'point', value: 100, a: 5, direction: 'local_y',
    }];
    const fef = computePointMomentFEF(loads, horizStart, horizEnd, 0);
    // L=10, a=5, b=5, P=100
    // R1 = P*b²*(3a+b)/L³ = 100*25*20/1000 = 50
    near(fef.forces_i[1], 50);       // Vy start
    // M1 = P*a*b²/L² = 100*5*25/100 = 125
    near(fef.forces_i[5], 125);      // Mz start
    // R2 = P*a²*(a+3b)/L³ = 100*25*20/1000 = 50
    near(fef.forces_j[1], 50);       // Vy end
    // M2 = -P*a²*b/L² = -100*25*5/100 = -125
    near(fef.forces_j[5], -125);     // Mz end
  });

  test('quarter-point point load on horizontal member (local_y)', () => {
    const loads: PointMomentLoad[] = [{
      type: 'point', value: 80, a: 2.5, direction: 'local_y',
    }];
    const fef = computePointMomentFEF(loads, horizStart, horizEnd, 0);
    const P = 80, a = 2.5, b = 7.5, L = 10;
    const R1 = P * b * b * (3 * a + b) / (L * L * L);
    const M1 = P * a * b * b / (L * L);
    const R2 = P * a * a * (a + 3 * b) / (L * L * L);
    const M2 = -P * a * a * b / (L * L);
    near(fef.forces_i[1], R1);
    near(fef.forces_i[5], M1);
    near(fef.forces_j[1], R2);
    near(fef.forces_j[5], M2);
  });

  test('global_y point load on 45° inclined member', () => {
    // Member at 45°: (0,0,0) → (5*√2, 5*√2, 0)
    const s2 = 5 * Math.sqrt(2);
    const start = { x: 0, y: 0, z: 0 };
    const end = { x: s2, y: s2, z: 0 };
    // L = 10
    const loads: PointMomentLoad[] = [{
      type: 'point', value: 100, a: 5, direction: 'global_y',
    }];
    const fef = computePointMomentFEF(loads, start, end, 0);
    // Global Y = [0, 1, 0]
    // For 45° member: R = [[c,s,0],[-s,c,0],[0,0,1]] where c=s=1/√2
    // P_local = R * [0, P, 0] = [P*s, P*c, 0] = [P/√2, P/√2, 0]
    // So P_axial = P/√2, P_transverse_y = P/√2
    const inv2 = 1 / Math.sqrt(2);
    const pAx = 100 * inv2;
    const pTr = 100 * inv2;
    const L = 10, a = 5, b = 5;
    // Axial FEF: fef[0] = pAx*(L-a)/L
    near(fef.forces_i[0], pAx * b / L);
    near(fef.forces_j[0], pAx * a / L);
    // Transverse FEF (local Y → Mz):
    near(fef.forces_i[1], pTr * b * b * (3 * a + b) / (L * L * L));
  });

  test('concentrated moment on horizontal member (local_y)', () => {
    const loads: PointMomentLoad[] = [{
      type: 'moment', value: 50, a: 5, direction: 'local_y',
    }];
    const fef = computePointMomentFEF(loads, horizStart, horizEnd, 0);
    const M0 = 50, a = 5, b = 5, L = 10;
    // Moment FEF about Mz:
    // R1 = -6*M0*a*b/L³
    near(fef.forces_i[1], -6 * M0 * a * b / (L * L * L));
    // M1 = M0*b*(2a-b)/L²
    near(fef.forces_i[5], M0 * b * (2 * a - b) / (L * L));
    // R2 = +6*M0*a*b/L³
    near(fef.forces_j[1], 6 * M0 * a * b / (L * L * L));
    // M2 = M0*a*(2b-a)/L²
    near(fef.forces_j[5], M0 * a * (2 * b - a) / (L * L));
  });

  test('multiple loads accumulate correctly', () => {
    const loads: PointMomentLoad[] = [
      { type: 'point', value: 100, a: 5, direction: 'local_y' },
      { type: 'point', value: 50, a: 2.5, direction: 'local_y' },
    ];
    const fef = computePointMomentFEF(loads, horizStart, horizEnd, 0);
    // Should be sum of individual FEFs
    const L = 10;
    const r1_1 = 100 * 25 * 20 / 1000;   // P=100, a=5, b=5
    const r1_2 = 50 * 56.25 * 15 / 1000;  // P=50, a=2.5, b=7.5
    near(fef.forces_i[1], r1_1 + r1_2);
  });

  test('axial point load', () => {
    const loads: PointMomentLoad[] = [{
      type: 'point', value: 200, a: 4, direction: 'axial',
    }];
    const fef = computePointMomentFEF(loads, horizStart, horizEnd, 0);
    // P_axial = 200 at a=4: fef[0] = 200*(10-4)/10 = 120
    near(fef.forces_i[0], 120);
    near(fef.forces_j[0], 80);
    // No transverse effects
    near(fef.forces_i[1], 0);
    near(fef.forces_j[1], 0);
  });

  test('empty loads → zero FEF', () => {
    const fef = computePointMomentFEF([], horizStart, horizEnd, 0);
    for (let i = 0; i < 6; i++) {
      near(fef.forces_i[i], 0);
      near(fef.forces_j[i], 0);
    }
  });
});
