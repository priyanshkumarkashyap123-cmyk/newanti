/**
 * diagramUtils.test.ts — Tests for piecewise SFD/BMD diagram generation utilities.
 *
 * Verifies correct shear-force and bending-moment diagrams for:
 *  - No loads (end forces only)
 *  - UDL-only members
 *  - Point loads (step in SFD, kink in BMD)
 *  - Applied moments (jump in BMD, no shear change)
 *  - UVL (linearly varying load)
 *  - Combined load cases
 */
import { describe, it, expect } from "vitest";
import {
  buildLocalAxesForDiagram,
  accumulateLoadEffects,
  buildDiagramStations,
  integrateDeflection,
  type DiagramLoad,
} from "../diagramUtils";

// ─── Helper: assert approximate equality ───
const approx = (a: number, b: number, tol = 1e-6) =>
  expect(a).toBeCloseTo(b, -Math.log10(tol));

describe("buildLocalAxesForDiagram", () => {
  it("horizontal member (along +X) → ly=[0,1,0], lz=[0,0,1]", () => {
    const { ly, lz } = buildLocalAxesForDiagram(5, 0, 0, 5, 0);
    approx(ly[0], 0);
    approx(ly[1], 1);
    approx(ly[2], 0);
    approx(lz[0], 0);
    approx(lz[1], 0);
    approx(lz[2], 1);
  });

  it("vertical member (along +Y) → ly=[-1,0,0], lz=[0,0,1]", () => {
    const { ly, lz } = buildLocalAxesForDiagram(0, 5, 0, 5, 0);
    approx(ly[0], -1);
    approx(ly[1], 0);
    approx(ly[2], 0);
    // lz = lx × ly = [0,1,0] × [-1,0,0] = [0,0,1]
    approx(lz[0], 0);
    approx(lz[1], 0);
    approx(lz[2], 1);
  });

  it("45-degree inclined member in XY plane", () => {
    const s2 = Math.SQRT2;
    const { ly, lz } = buildLocalAxesForDiagram(5, 5, 0, 5 * s2, 0);
    // local X = (1/√2, 1/√2, 0)
    // lz = lx × globalY = (1/√2, 1/√2, 0) × (0,1,0) = (0, 0, 1/√2) → normalize → (0,0,1)
    // ly = lz × lx = (0,0,1) × (1/√2, 1/√2, 0) = (-1/√2, 1/√2, 0)
    approx(ly[0], -1 / s2, 1e-5);
    approx(ly[1], 1 / s2, 1e-5);
    approx(ly[2], 0, 1e-5);
    approx(lz[0], 0);
    approx(lz[1], 0);
    approx(lz[2], 1);
  });

  it("local axes are orthonormal", () => {
    const { ly, lz } = buildLocalAxesForDiagram(3, 4, 5, Math.sqrt(50), 0);
    const dot = ly[0] * lz[0] + ly[1] * lz[1] + ly[2] * lz[2];
    approx(dot, 0, 1e-10);
    const lenY = Math.sqrt(ly[0] ** 2 + ly[1] ** 2 + ly[2] ** 2);
    const lenZ = Math.sqrt(lz[0] ** 2 + lz[1] ** 2 + lz[2] ** 2);
    approx(lenY, 1, 1e-10);
    approx(lenZ, 1, 1e-10);
  });
});

describe("accumulateLoadEffects", () => {
  const L = 10;
  const ly = [0, 1, 0]; // horizontal member: local Y = global Y
  const lz = [0, 0, 1]; // local Z = global Z

  it("UDL: full span w=20 kN/m → dVy = w·x, dMz = w·x²/2", () => {
    const loads: DiagramLoad[] = [
      { type: "UDL", w1: 20, direction: "local_y", startPos: 0, endPos: 1 },
    ];

    // At x = 5 (midspan):
    const mid = accumulateLoadEffects(5, loads, L, ly, lz);
    approx(mid.dVy, 20 * 5); // 100
    approx(mid.dMz, (20 * 25) / 2); // 250

    // At x = L:
    const end = accumulateLoadEffects(L, loads, L, ly, lz);
    approx(end.dVy, 20 * 10); // 200
    approx(end.dMz, (20 * 100) / 2); // 1000
  });

  it("point load P=50 at a=4m → step in shear, kink in moment", () => {
    const loads: DiagramLoad[] = [
      { type: "point", P: 50, a: 4, direction: "local_y" },
    ];

    // Before load (x = 3):
    const before = accumulateLoadEffects(3, loads, L, ly, lz);
    approx(before.dVy, 0);
    approx(before.dMz, 0);

    // After load (x = 6):
    const after = accumulateLoadEffects(6, loads, L, ly, lz);
    approx(after.dVy, 50);
    approx(after.dMz, 50 * (6 - 4)); // 100
  });

  it("applied moment M=30 at a=5m → jump in moment, no shear change", () => {
    const loads: DiagramLoad[] = [
      { type: "moment", M: 30, a: 5, direction: "local_z" },
    ];

    // Before (x = 4):
    const before = accumulateLoadEffects(4, loads, L, ly, lz);
    approx(before.dVy, 0);
    approx(before.dMz, 0);

    // After (x = 6):
    const after = accumulateLoadEffects(6, loads, L, ly, lz);
    approx(after.dVy, 0); // moments don't change shear
    approx(after.dMz, 30); // applied CCW moment adds positively to dMz
  });

  it("UVL: triangular load w1=0, w2=30 over full span", () => {
    const loads: DiagramLoad[] = [
      {
        type: "UVL",
        w1: 0,
        w2: 30,
        direction: "local_y",
        startPos: 0,
        endPos: 1,
      },
    ];

    // At x = L: full load applied
    // Total force = (0 + 30)/2 * 10 = 150
    const end = accumulateLoadEffects(L, loads, L, ly, lz);
    approx(end.dVy, 150);

    // At x = L/2: only half the load range applied
    // w(5) = 0 + 30 * 5/10 = 15
    // dVy = (0 + 15)/2 * 5 = 37.5
    const mid = accumulateLoadEffects(5, loads, L, ly, lz);
    approx(mid.dVy, 37.5);
    // dMz = w1*dx²/2 + slope*dx³/6 = 0*25/2 + 3*125/6 = 62.5
    approx(mid.dMz, 62.5);
  });

  it("global_y load on inclined member → projects onto local Y", () => {
    // 45-degree member: local Y · global Y = cos(45°) = 1/√2
    const s2 = Math.SQRT2;
    const lyIncl = [-1 / s2, 1 / s2, 0];
    const lzIncl = [0, 0, 1];

    const loads: DiagramLoad[] = [
      { type: "UDL", w1: 20, direction: "global_y", startPos: 0, endPos: 1 },
    ];

    const mid = accumulateLoadEffects(5, loads, L, lyIncl, lzIncl);
    // Projected load = 20 * (1/√2) ≈ 14.142
    approx(mid.dVy, (20 / s2) * 5, 1e-4);
  });

  it("partial UDL from 0.2 to 0.8 of span → correct integration", () => {
    const loads: DiagramLoad[] = [
      { type: "UDL", w1: 10, direction: "local_y", startPos: 0.2, endPos: 0.8 },
    ];

    // At x = 1 (before load starts at 2): no effect
    const before = accumulateLoadEffects(1, loads, L, ly, lz);
    approx(before.dVy, 0);

    // At x = 5 (midspan, within load): load from 2 to 5 = 3m
    const mid = accumulateLoadEffects(5, loads, L, ly, lz);
    approx(mid.dVy, 10 * 3); // 30
    approx(mid.dMz, (10 * 9) / 2); // w*dx²/2 = 10*9/2 = 45

    // At x = 9 (past load end at 8): full load applied
    const past = accumulateLoadEffects(9, loads, L, ly, lz);
    approx(past.dVy, 10 * 6); // 60
    // moment = load * (x - centroid) = 60 * (9 - 5) = 240
    approx(past.dMz, 60 * (9 - 5)); // 240
  });
});

describe("buildDiagramStations", () => {
  it("returns 51 stations for no loads", () => {
    const stations = buildDiagramStations(10, [], 51);
    expect(stations.length).toBe(51);
    approx(stations[0], 0);
    approx(stations[50], 10);
  });

  it("adds discontinuity stations for point loads", () => {
    const loads: DiagramLoad[] = [{ type: "point", P: 50, a: 0.5 }];
    const stations = buildDiagramStations(10, loads, 51);
    // Should have 51 base + 2 extra (a-ε, a+ε) = 53
    expect(stations.length).toBe(53);
    // The 5m position should have stations: base at 5.0, plus a-ε and a+ε
    const near5 = stations.filter((s) => Math.abs(s - 5) < 0.001);
    expect(near5.length).toBe(3); // a-ε, 5.0 (base), a+ε
  });

  it("adds discontinuity stations for applied moments", () => {
    const loads: DiagramLoad[] = [{ type: "moment", M: 30, a: 3 }];
    const stations = buildDiagramStations(10, loads, 51);
    // 3m = a*L = 3 (ratio 0.3), base grid at 3.0 exists, plus a-ε and a+ε
    expect(stations.length).toBeGreaterThan(51);
  });

  it("stations are sorted", () => {
    const loads: DiagramLoad[] = [
      { type: "point", P: 50, a: 0.7 },
      { type: "moment", M: 20, a: 0.3 },
    ];
    const stations = buildDiagramStations(10, loads, 51);
    for (let i = 1; i < stations.length; i++) {
      expect(stations[i]).toBeGreaterThan(stations[i - 1]);
    }
  });
});

describe("integrateDeflection", () => {
  it("zero moment → linear interpolation between end displacements", () => {
    const stations = Array.from({ length: 11 }, (_, i) => i);
    const M = new Array(11).fill(0);
    const result = integrateDeflection(stations, M, 1e6, 0, 0.01, 10, 1);
    // With M=0, deflection should be linear: v(x) = 0 + 0.01*(x/10) = 0.001*x
    for (let i = 0; i <= 10; i++) {
      approx(result[i], 0.001 * i, 1e-8);
    }
  });

  it("constant moment → parabolic deflection", () => {
    const stations = Array.from({ length: 51 }, (_, i) => (i / 50) * 10);
    const M0 = 100; // constant moment
    const M = new Array(51).fill(M0);
    const EI = 1e6;
    // With pinned-pinned BCs (v(0) = v(L) = 0):
    // EI*v'' = M → v(x) = (M/(2EI))*x² + C1*x
    // v(L) = 0 → C1 = -ML/(2EI)
    // v(x) = (M/(2EI))*x*(x - L)
    const result = integrateDeflection(stations, M, EI, 0, 0, 10, 1);
    for (let i = 0; i <= 50; i++) {
      const x = (i / 50) * 10;
      const expected = (M0 / (2 * EI)) * x * (x - 10);
      approx(result[i], expected, 1e-4);
    }
  });
});

describe("SFD/BMD end-to-end scenarios", () => {
  const L = 10;
  const ly = [0, 1, 0];
  const lz = [0, 0, 1];

  it("simply supported beam with midspan point load: correct SFD and BMD", () => {
    // SS beam with DOWNWARD point load P = −100 kN at midspan (a = 5m)
    // DSM reactions: V1 = +50 kN (upward), V2 = +50 kN
    // M1 = 0, M2 = 0 (simple supports)
    const P = -100; // downward (store convention: negative = downward)
    const a = 5;
    const V1 = 50; // upward reaction from DSM solver
    const M1 = 0;
    const loads: DiagramLoad[] = [
      { type: "point", P, a, direction: "local_y" },
    ];

    // Shear just before load (x = 4.9): V = V1 + dVy = 50 + 0 = 50
    const { dVy: dV_before } = accumulateLoadEffects(4.9, loads, L, ly, lz);
    const V_before = V1 + dV_before;
    approx(V_before, 50); // no loads applied yet

    // Shear just after load (x = 5.1): V = V1 + dVy = 50 + (-100) = -50
    const { dVy: dV_after } = accumulateLoadEffects(5.1, loads, L, ly, lz);
    const V_after = V1 + dV_after;
    approx(V_after, -50); // step down by |P|=100

    // BMD at midspan (x = 5.1): M = -M1 + V1*x + dMz
    const { dMz: dM_at_mid } = accumulateLoadEffects(5.1, loads, L, ly, lz);
    const M_at_mid = -M1 + V1 * 5.1 + dM_at_mid;
    // Expected: M(5.1) = 50*5.1 + (-100)*0.1 = 255 - 10 = 245
    approx(M_at_mid, 245, 0.1);

    // BMD approaching from left (x = 4.99): M = V1*4.99 = 249.5
    const { dMz: dM_left } = accumulateLoadEffects(4.99, loads, L, ly, lz);
    const M_left = -M1 + V1 * 4.99 + dM_left;
    approx(M_left, 249.5, 0.1); // 50 * 4.99 = 249.5
  });

  it("cantilever with applied moment: jump in BMD", () => {
    // Fixed at x=0, free at x=L
    // Applied CCW moment M_app = 60 kN·m about local Z at x = 6m
    // DSM reaction at fixed end: V1 = 0, M1 = +60 (CCW reaction to balance)
    // Internal moment: M(x<6) = −M1 = −60, M(x>6) = −60+60 = 0 (free end)
    const V1 = 0;
    const M1 = 60; // DSM convention: CCW+ reaction moment at fixed end
    const loads: DiagramLoad[] = [
      { type: "moment", M: 60, a: 6, direction: "local_z" },
    ];

    // Before moment (x = 5): M = −M1 + 0 + 0 = −60
    const { dMz: dM_before } = accumulateLoadEffects(5, loads, L, ly, lz);
    const M_before = -M1 + V1 * 5 + dM_before;
    approx(M_before, -60);

    // After moment (x = 7): M = −M1 + 0 + 60 = 0 (free end)
    const { dMz: dM_after } = accumulateLoadEffects(7, loads, L, ly, lz);
    const M_after = -M1 + V1 * 7 + dM_after;
    approx(M_after, 0);

    // Jump at x=6 is +60 kN·m:
    const jump = M_after - M_before;
    approx(jump, 60);
  });

  it("UDL-only member: matches classical formula", () => {
    // SS beam, DOWNWARD UDL w = −12 kN/m (store convention)
    // DSM reactions: V1 = +60 kN (upward), M1 = 0
    const w = -12; // downward
    const V1 = 60; // upward reaction from DSM
    const M1 = 0;
    const loads: DiagramLoad[] = [
      { type: "UDL", w1: w, direction: "local_y", startPos: 0, endPos: 1 },
    ];

    // At midspan (x = 5): V = V1 + dVy, M = -M1 + V1*x + dMz
    const { dVy, dMz } = accumulateLoadEffects(5, loads, L, ly, lz);
    const V_mid = V1 + dVy;
    const M_mid = -M1 + V1 * 5 + dMz;

    // Classical: V(5) = wL/2−|w|*5 = 60−60 = 0
    approx(V_mid, 0);
    // Classical: M(5) = wL²/8 = 12*100/8 = 150
    approx(M_mid, 150);

    // At quarter span (x = 2.5):
    const q = accumulateLoadEffects(2.5, loads, L, ly, lz);
    const V_q = V1 + q.dVy;
    const M_q = -M1 + V1 * 2.5 + q.dMz;
    approx(V_q, 60 + (-12) * 2.5); // 60 - 30 = 30
    approx(M_q, 60 * 2.5 + ((-12) * 6.25) / 2); // 150 - 37.5 = 112.5
  });
});
