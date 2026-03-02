/**
 * MatrixUtils — Unit Tests
 *
 * Validates the core linear algebra operations used in structural analysis.
 * All expected values are verifiable against textbook formulas
 * (McGuire, Gallagher & Ziemian — "Matrix Structural Analysis").
 */

import { describe, it, expect } from "vitest";
import { MatrixUtils, Point3D } from "../MatrixUtils";
import * as math from "mathjs";

// ============================================
// Helper: Close-enough comparison for floating point
// ============================================
const TOLERANCE = 1e-6;

function expectClose(actual: number, expected: number, tol = TOLERANCE) {
  expect(Math.abs(actual - expected)).toBeLessThan(tol);
}

// ============================================
// getMemberLength
// ============================================

describe("MatrixUtils.getMemberLength", () => {
  it("computes length of horizontal member", () => {
    const a: Point3D = { x: 0, y: 0, z: 0 };
    const b: Point3D = { x: 6, y: 0, z: 0 };
    expect(MatrixUtils.getMemberLength(a, b)).toBe(6);
  });

  it("computes length of vertical member", () => {
    const a: Point3D = { x: 0, y: 0, z: 0 };
    const b: Point3D = { x: 0, y: 5, z: 0 };
    expect(MatrixUtils.getMemberLength(a, b)).toBe(5);
  });

  it("computes length of 3D diagonal member", () => {
    const a: Point3D = { x: 0, y: 0, z: 0 };
    const b: Point3D = { x: 3, y: 4, z: 0 };
    expect(MatrixUtils.getMemberLength(a, b)).toBe(5); // 3-4-5 triangle
  });

  it("computes length of inclined 3D member", () => {
    const a: Point3D = { x: 1, y: 2, z: 3 };
    const b: Point3D = { x: 4, y: 6, z: 3 };
    expectClose(MatrixUtils.getMemberLength(a, b), 5); // sqrt(9 + 16 + 0)
  });

  it("returns 0 for coincident nodes", () => {
    const a: Point3D = { x: 5, y: 3, z: 2 };
    expect(MatrixUtils.getMemberLength(a, a)).toBe(0);
  });
});

// ============================================
// getRotationMatrix
// ============================================

describe("MatrixUtils.getRotationMatrix", () => {
  it("returns identity for member along +X axis", () => {
    const a: Point3D = { x: 0, y: 0, z: 0 };
    const b: Point3D = { x: 5, y: 0, z: 0 };
    const R = MatrixUtils.getRotationMatrix(a, b);
    const arr = R.toArray() as number[][];

    // For a member along X, local x = global X
    // Direction cosines: cx=1, cy=0, cz=0
    expectClose(arr[0][0], 1);
    expectClose(arr[0][1], 0);
    expectClose(arr[0][2], 0);
  });

  it("returns correct rotation for vertical member (+Y)", () => {
    const a: Point3D = { x: 0, y: 0, z: 0 };
    const b: Point3D = { x: 0, y: 4, z: 0 };
    const R = MatrixUtils.getRotationMatrix(a, b);
    const arr = R.toArray() as number[][];

    // Vertical member: cy = +1 (upward)
    // First row should be [0, 1, 0] for local x along global Y
    expectClose(arr[0][0], 0);
    expectClose(arr[0][1], 1);
    expectClose(arr[0][2], 0);
  });

  it("returns orthogonal matrix (R^T * R = I)", () => {
    const a: Point3D = { x: 0, y: 0, z: 0 };
    const b: Point3D = { x: 3, y: 4, z: 5 };
    const R = MatrixUtils.getRotationMatrix(a, b);

    const RTR = math.multiply(math.transpose(R), R);
    const I = math.identity(3);

    // R^T * R should be identity (orthogonality check)
    const diff = math.subtract(RTR, I) as math.Matrix;
    const maxDiff = math.max(math.abs(diff) as math.Matrix) as number;
    expect(maxDiff).toBeLessThan(TOLERANCE);
  });

  it("has determinant +1 (proper rotation, not reflection)", () => {
    const a: Point3D = { x: 0, y: 0, z: 0 };
    const b: Point3D = { x: 3, y: 4, z: 5 };
    const R = MatrixUtils.getRotationMatrix(a, b);
    const det = math.det(R);
    expectClose(det, 1.0);
  });

  it("throws for zero-length member", () => {
    const a: Point3D = { x: 5, y: 3, z: 2 };
    expect(() => MatrixUtils.getRotationMatrix(a, a)).toThrow(
      "Member length is too small"
    );
  });
});

// ============================================
// getTransformationMatrix
// ============================================

describe("MatrixUtils.getTransformationMatrix", () => {
  it("returns 12x12 matrix", () => {
    const R = math.identity(3) as math.Matrix;
    const T = MatrixUtils.getTransformationMatrix(R);
    const size = T.size();
    expect(size).toEqual([12, 12]);
  });

  it("has 4 diagonal blocks = R", () => {
    const a: Point3D = { x: 0, y: 0, z: 0 };
    const b: Point3D = { x: 3, y: 4, z: 0 };
    const R = MatrixUtils.getRotationMatrix(a, b);
    const T = MatrixUtils.getTransformationMatrix(R);
    const Tarr = T.toArray() as number[][];
    const Rarr = R.toArray() as number[][];

    // Check each of the 4 diagonal blocks
    for (let block = 0; block < 4; block++) {
      const off = block * 3;
      for (let i = 0; i < 3; i++) {
        for (let j = 0; j < 3; j++) {
          expectClose(Tarr[off + i][off + j], Rarr[i][j]);
        }
      }
    }
  });

  it("has zeros in off-diagonal blocks", () => {
    const R = MatrixUtils.getRotationMatrix(
      { x: 0, y: 0, z: 0 },
      { x: 1, y: 1, z: 1 }
    );
    const T = MatrixUtils.getTransformationMatrix(R);
    const Tarr = T.toArray() as number[][];

    // Check off-diagonal block (0,3) - (0,5) x (3,5)
    for (let i = 0; i < 3; i++) {
      for (let j = 3; j < 6; j++) {
        expectClose(Tarr[i][j], 0);
      }
    }
  });

  it("T^T * T = I for orthogonal R", () => {
    const R = MatrixUtils.getRotationMatrix(
      { x: 0, y: 0, z: 0 },
      { x: 3, y: 4, z: 5 }
    );
    const T = MatrixUtils.getTransformationMatrix(R);
    const TTT = math.multiply(math.transpose(T), T);
    const I12 = math.identity(12);
    const diff = math.subtract(TTT, I12) as math.Matrix;
    const maxDiff = math.max(math.abs(diff) as math.Matrix) as number;
    expect(maxDiff).toBeLessThan(TOLERANCE);
  });
});

// ============================================
// getLocalStiffnessMatrix
// ============================================

describe("MatrixUtils.getLocalStiffnessMatrix", () => {
  // Standard steel beam: E = 200 GPa, ISMB 300
  const E = 200e6; // kN/m²
  const A = 5.87e-3; // m²
  const Iy = 4.86e-6; // m⁴ (about weak axis)
  const Iz = 86.0e-6; // m⁴ (about strong axis)
  const L = 6; // m

  it("returns 12x12 matrix", () => {
    const k = MatrixUtils.getLocalStiffnessMatrix(E, Iy, Iz, A, L);
    expect(k.size()).toEqual([12, 12]);
  });

  it("is symmetric", () => {
    const k = MatrixUtils.getLocalStiffnessMatrix(E, Iy, Iz, A, L);
    const kArr = k.toArray() as number[][];
    for (let i = 0; i < 12; i++) {
      for (let j = 0; j < 12; j++) {
        expectClose(kArr[i][j], kArr[j][i], 1e-2); // symmetry
      }
    }
  });

  it("has correct axial stiffness EA/L at (0,0)", () => {
    const k = MatrixUtils.getLocalStiffnessMatrix(E, Iy, Iz, A, L);
    const expected = (E * A) / L;
    const actual = k.get([0, 0]) as number;
    expectClose(actual, expected, 1);
  });

  it("has correct bending stiffness 12EIz/L³ at (1,1)", () => {
    const k = MatrixUtils.getLocalStiffnessMatrix(E, Iy, Iz, A, L);
    const expected = (12 * E * Iz) / (L * L * L);
    const actual = k.get([1, 1]) as number;
    expectClose(actual, expected, 1);
  });

  it("has correct coupling term 6EIz/L² at (1,5)", () => {
    const k = MatrixUtils.getLocalStiffnessMatrix(E, Iy, Iz, A, L);
    const expected = (6 * E * Iz) / (L * L);
    const actual = k.get([1, 5]) as number;
    expectClose(actual, expected, 1);
  });

  it("has correct rotational stiffness 4EIz/L at (5,5)", () => {
    const k = MatrixUtils.getLocalStiffnessMatrix(E, Iy, Iz, A, L);
    const expected = (4 * E * Iz) / L;
    const actual = k.get([5, 5]) as number;
    expectClose(actual, expected, 1);
  });

  it("has positive diagonal entries (positive definite property)", () => {
    const k = MatrixUtils.getLocalStiffnessMatrix(E, Iy, Iz, A, L);
    for (let i = 0; i < 12; i++) {
      expect(k.get([i, i]) as number).toBeGreaterThan(0);
    }
  });
});

// ============================================
// transformToGlobal
// ============================================

describe("MatrixUtils.transformToGlobal", () => {
  it("preserves stiffness for member along X (T=I)", () => {
    const E = 200e6;
    const A = 0.01;
    const Iy = 1e-4;
    const Iz = 1e-4;
    const L = 5;
    const k = MatrixUtils.getLocalStiffnessMatrix(E, Iy, Iz, A, L);
    const T = math.identity(12) as math.Matrix;
    const K = MatrixUtils.transformToGlobal(k, T);

    // With identity T, global K should equal local k
    const diff = math.subtract(K, k) as math.Matrix;
    const maxDiff = math.max(math.abs(diff) as math.Matrix) as number;
    expect(maxDiff).toBeLessThan(1e-6);
  });

  it("global K is symmetric", () => {
    const a: Point3D = { x: 0, y: 0, z: 0 };
    const b: Point3D = { x: 3, y: 4, z: 0 };
    const R = MatrixUtils.getRotationMatrix(a, b);
    const T = MatrixUtils.getTransformationMatrix(R);
    const k = MatrixUtils.getLocalStiffnessMatrix(200e6, 1e-4, 1e-4, 0.01, 5);
    const K = MatrixUtils.transformToGlobal(k, T);
    const KArr = K.toArray() as number[][];

    for (let i = 0; i < 12; i++) {
      for (let j = 0; j < 12; j++) {
        expectClose(KArr[i][j], KArr[j][i], 1);
      }
    }
  });
});

// ============================================
// zeros / identity / solve / multiply / transpose
// ============================================

describe("MatrixUtils utility methods", () => {
  it("creates zero matrix of correct size", () => {
    const z = MatrixUtils.zeros(4, 6);
    expect(z.size()).toEqual([4, 6]);
    expect(z.get([0, 0])).toBe(0);
    expect(z.get([3, 5])).toBe(0);
  });

  it("creates identity matrix of correct size", () => {
    const I = MatrixUtils.identity(5);
    expect(I.size()).toEqual([5, 5]);
    expect(I.get([0, 0])).toBe(1);
    expect(I.get([1, 1])).toBe(1);
    expect(I.get([0, 1])).toBe(0);
  });

  it("solves simple 2x2 system", () => {
    // 2x + y = 5
    // x + 3y = 10
    // Solution: x = 1, y = 3
    const A = math.matrix([[2, 1], [1, 3]]);
    const b = math.matrix([[5], [10]]);
    const x = MatrixUtils.solve(A, b);
    expectClose((x.toArray() as number[][])[0][0], 1);
    expectClose((x.toArray() as number[][])[1][0], 3);
  });

  it("multiplies matrices correctly", () => {
    const A = math.matrix([[1, 2], [3, 4]]);
    const B = math.matrix([[5, 6], [7, 8]]);
    const C = MatrixUtils.multiply(A, B);
    const arr = C.toArray() as number[][];
    expect(arr[0][0]).toBe(19); // 1*5 + 2*7
    expect(arr[0][1]).toBe(22); // 1*6 + 2*8
    expect(arr[1][0]).toBe(43); // 3*5 + 4*7
    expect(arr[1][1]).toBe(50); // 3*6 + 4*8
  });

  it("transposes matrix correctly", () => {
    const A = math.matrix([[1, 2, 3], [4, 5, 6]]);
    const AT = MatrixUtils.transpose(A);
    expect(AT.size()).toEqual([3, 2]);
    expect(AT.get([0, 1])).toBe(4);
    expect(AT.get([2, 0])).toBe(3);
  });
});

// ============================================
// assembleToGlobal
// ============================================

describe("MatrixUtils.assembleToGlobal", () => {
  it("assembles 12x12 member matrix into global matrix at correct DOF locations", () => {
    // 2-node problem: 12 total DOFs (6 per node)
    const globalK = MatrixUtils.zeros(12, 12);
    // Simple diagonal member K for testing
    const memberK = MatrixUtils.zeros(12, 12);
    memberK.set([0, 0], 100); // axial at start
    memberK.set([6, 6], 100); // axial at end
    memberK.set([0, 6], -100); // coupling
    memberK.set([6, 0], -100); // symmetric coupling

    const startDOFs = [0, 1, 2, 3, 4, 5];
    const endDOFs = [6, 7, 8, 9, 10, 11];

    MatrixUtils.assembleToGlobal(globalK, memberK, startDOFs, endDOFs);

    expect(globalK.get([0, 0])).toBe(100);
    expect(globalK.get([6, 6])).toBe(100);
    expect(globalK.get([0, 6])).toBe(-100);
    expect(globalK.get([1, 1])).toBe(0); // Unaffected DOF
  });

  it("accumulates contributions from multiple members sharing a node", () => {
    // 3-node problem: 18 total DOFs
    const globalK = MatrixUtils.zeros(18, 18);

    // Member 1: nodes 0-1 (DOFs 0-5 to 6-11)
    const k1 = MatrixUtils.zeros(12, 12);
    k1.set([0, 0], 50); // start axial
    k1.set([6, 6], 50); // end axial

    // Member 2: nodes 1-2 (DOFs 6-11 to 12-17)
    const k2 = MatrixUtils.zeros(12, 12);
    k2.set([0, 0], 80); // start axial
    k2.set([6, 6], 80); // end axial

    MatrixUtils.assembleToGlobal(globalK, k1, [0,1,2,3,4,5], [6,7,8,9,10,11]);
    MatrixUtils.assembleToGlobal(globalK, k2, [6,7,8,9,10,11], [12,13,14,15,16,17]);

    // At shared node 1 (DOF 6), both members contribute: 50 + 80 = 130
    expect(globalK.get([6, 6])).toBe(130);
    // Non-shared DOFs retain single-member values
    expect(globalK.get([0, 0])).toBe(50);
    expect(globalK.get([12, 12])).toBe(80);
  });
});
