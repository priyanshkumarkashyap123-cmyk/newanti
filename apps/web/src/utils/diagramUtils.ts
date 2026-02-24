/**
 * diagramUtils.ts — Piecewise SFD/BMD generation utilities.
 *
 * Provides helpers for computing correct shear-force and bending-moment
 * diagrams from actual member loads, replacing the "back-calculated
 * equivalent UDL" approach that was only correct for uniformly loaded beams.
 *
 * Used by both StructuralSolverWorker.ts and ModernModeler.tsx.
 */

// ────────────────────────────────────────────────────────────────
//  Minimal interface — compatible with both MemberLoadItem (Worker)
//  and MemberLoad (store).
// ────────────────────────────────────────────────────────────────
export interface DiagramLoad {
  type?: string;       // 'UDL' | 'UVL' | 'point' | 'moment'
  w1?: number;         // Distributed load intensity start (kN/m)
  w2?: number;         // Distributed load intensity end (kN/m)
  P?: number;          // Point load magnitude (kN)
  M?: number;          // Applied moment magnitude (kN·m)
  a?: number;          // Position of point load / moment (m or 0-1 ratio)
  startPos?: number;   // Partial UDL start (0-1 ratio), default 0
  endPos?: number;     // Partial UDL end (0-1 ratio), default 1
  direction?: string;  // 'local_y' | 'local_z' | 'global_x/y/z' | 'axial'
}

// ────────────────────────────────────────────────────────────────
//  Build local Y / Z axis unit vectors from member geometry.
//  Matches the rotation matrix convention in stiffness assembly.
// ────────────────────────────────────────────────────────────────
export function buildLocalAxesForDiagram(
  dx: number,
  dy: number,
  dz: number,
  L: number,
  betaAngle: number,
): { ly: number[]; lz: number[] } {
  const cx = dx / L,
    cy = dy / L,
    cz = dz / L;
  const tol = 1e-6;
  const isVertical = Math.abs(cx) < tol && Math.abs(cz) < tol;

  let ly: number[];
  if (isVertical) {
    // Member along global Y — use global Z as reference
    ly = [0, 0, 1];
  } else {
    // lz_temp = lx × globalY = (-cz, 0, cx)
    const lzLen = Math.sqrt(cz * cz + cx * cx);
    const lz_t = [-cz / lzLen, 0, cx / lzLen];
    // ly = lz × lx
    ly = [
      lz_t[1] * cz - lz_t[2] * cy,
      lz_t[2] * cx - lz_t[0] * cz,
      lz_t[0] * cy - lz_t[1] * cx,
    ];
  }

  // Apply beta rotation about member axis
  if (Math.abs(betaAngle) > 1e-12) {
    const br = (betaAngle * Math.PI) / 180;
    const cb = Math.cos(br),
      sb = Math.sin(br);
    // lz_before = lx × ly
    const lz_b = [
      cy * ly[2] - cz * ly[1],
      cz * ly[0] - cx * ly[2],
      cx * ly[1] - cy * ly[0],
    ];
    ly = [
      cb * ly[0] + sb * lz_b[0],
      cb * ly[1] + sb * lz_b[1],
      cb * ly[2] + sb * lz_b[2],
    ];
  }

  // lz = lx × ly (right-hand rule)
  const lz = [
    cy * ly[2] - cz * ly[1],
    cz * ly[0] - cx * ly[2],
    cx * ly[1] - cy * ly[0],
  ];

  return { ly, lz };
}

// ────────────────────────────────────────────────────────────────
//  Accumulate load effects: shear decrements & moment contributions
//  at position x from all member loads, projected into local coords.
//
//  Usage:
//    V_y(x) = V1  - dVy
//    M_z(x) = -M1 + V1·x - dMz     (Y-plane: primary BMD)
//    V_z(x) = Vz1  - dVz
//    M_y(x) = My1 + Vz1·x - dMy    (Z-plane: weak-axis BMD)
// ────────────────────────────────────────────────────────────────
export function accumulateLoadEffects(
  x: number,
  loads: DiagramLoad[],
  L: number,
  ly: number[],
  lz: number[],
): { dVy: number; dMz: number; dVz: number; dMy: number } {
  let dVy = 0,
    dMz = 0,
    dVz = 0,
    dMy = 0;

  for (const ml of loads) {
    const dir = ml.direction ?? "local_y";

    // ─── Force projection onto local Y and Z ───
    let projY = 0,
      projZ = 0;
    switch (dir) {
      case "local_y":
        projY = 1;
        break;
      case "local_z":
        projZ = 1;
        break;
      case "global_x":
        projY = ly[0];
        projZ = lz[0];
        break;
      case "global_y":
        projY = ly[1];
        projZ = lz[1];
        break;
      case "global_z":
        projY = ly[2];
        projZ = lz[2];
        break;
      // 'axial': no transverse effect
    }

    const type = ml.type ?? "";

    if (type === "UDL" || type === "UVL") {
      const w1Raw = ml.w1 ?? 0;
      const w2Raw = type === "UDL" ? w1Raw : (ml.w2 ?? w1Raw);
      const a = (ml.startPos ?? 0) * L;
      const b = (ml.endPos ?? 1) * L;
      const span = b - a;
      if (span < 1e-12 || x <= a) continue;

      const xEff = Math.min(x, b);
      const dxl = xEff - a;
      const wA = w1Raw;
      const wX = w1Raw + (w2Raw - w1Raw) * (dxl / span);

      // Shear increment: trapezoidal integral of w(t) from a to xEff
      const shear = ((wA + wX) / 2) * dxl;

      // Moment increment: ∫ w(t)·(x−t) dt from a to min(x,b)
      let moment: number;
      const slope = (w2Raw - w1Raw) / span;
      if (x >= b) {
        // Full load applied — moment about position x
        const intWt =
          wA * (b * b - a * a) / 2 +
          slope * ((b * b * b - a * a * a) / 3 - (a * (b * b - a * a)) / 2);
        moment = x * shear - intWt;
      } else {
        // Partial integration from a to x
        moment = (wA * dxl * dxl) / 2 + (slope * dxl * dxl * dxl) / 6;
      }

      dVy += shear * projY;
      dMz += moment * projY;
      dVz += shear * projZ;
      dMy += moment * projZ;
    } else if (type === "point") {
      const P = ml.P ?? 0;
      if (Math.abs(P) < 1e-15) continue;
      const aRaw = ml.a ?? 0.5;
      const a = aRaw <= 1.0 ? aRaw * L : aRaw;

      if (x > a + L * 1e-9) {
        dVy += P * projY;
        dMz += P * projY * (x - a);
        dVz += P * projZ;
        dMy += P * projZ * (x - a);
      }
    } else if (type === "moment") {
      const M_val = ml.M ?? 0;
      if (Math.abs(M_val) < 1e-15) continue;
      const aRaw = ml.a ?? 0.5;
      const a = aRaw <= 1.0 ? aRaw * L : aRaw;

      if (x > a + L * 1e-9) {
        // Applied moments ADD to internal moment → subtract from dMz/dMy
        // (since M_internal = … − dMz, negative dMz means positive M contribution).
        // Moment projection: moment axis projects onto local axes.
        switch (dir) {
          case "local_y":
            dMy -= M_val;
            break;
          case "local_z":
            dMz -= M_val;
            break;
          case "global_x":
            dMz -= M_val * lz[0];
            dMy -= M_val * ly[0];
            break;
          case "global_y":
            dMz -= M_val * lz[1];
            dMy -= M_val * ly[1];
            break;
          case "global_z":
            dMz -= M_val * lz[2];
            dMy -= M_val * ly[2];
            break;
        }
        // Moments do not affect shear
      }
    }
  }

  return { dVy, dMz, dVz, dMy };
}

// ────────────────────────────────────────────────────────────────
//  Build sorted station positions including discontinuity points
//  for point loads and applied moments. This ensures the SFD shows
//  a clean step and the BMD shows a clean jump at those locations.
// ────────────────────────────────────────────────────────────────
export function buildDiagramStations(
  L: number,
  loads: DiagramLoad[],
  numBase: number,
): number[] {
  const eps = L * 1e-7;
  const stSet = new Set<number>();

  // Uniform base grid
  for (let s = 0; s < numBase; s++) {
    const raw = (s / (numBase - 1)) * L;
    stSet.add(Math.round(raw * 1e10) / 1e10);
  }

  // Add critical positions for step / jump discontinuities
  for (const ml of loads) {
    const type = ml.type ?? "";
    if (type === "point" || type === "moment") {
      const aRaw = ml.a ?? 0.5;
      const a = aRaw <= 1.0 ? aRaw * L : aRaw;
      if (a > eps && a < L - eps) {
        stSet.add(Math.round((a - eps) * 1e10) / 1e10);
        stSet.add(Math.round((a + eps) * 1e10) / 1e10);
      }
    }
    if (type === "UVL") {
      const a = (ml.startPos ?? 0) * L;
      const b = (ml.endPos ?? 1) * L;
      if (a > eps) stSet.add(Math.round(a * 1e10) / 1e10);
      if (b < L - eps) stSet.add(Math.round(b * 1e10) / 1e10);
    }
  }

  return Array.from(stSet).sort((a, b) => a - b);
}

// ────────────────────────────────────────────────────────────────
//  Numerical double integration of M(x) for deflection.
//  Uses trapezoidal rule with boundary correction to match end
//  displacements from the solver.
//
//  Returns deflection array (same units as v_start / v_end, ×1000
//  conversion to mm is done in the caller).
//
//  sign: +1 for Y-deflection (EI·v″ = M_z)
//       −1 for Z-deflection (EI·v″ = −M_y)
// ────────────────────────────────────────────────────────────────
export function integrateDeflection(
  stations: number[],
  M_arr: number[],
  EI: number,
  v_start: number,
  v_end: number,
  L: number,
  sign: 1 | -1,
): number[] {
  const n = stations.length;
  if (n < 2 || EI <= 0) {
    return new Array(n).fill(0);
  }

  // First integration: slope_raw = ∫ sign·M(t) dt
  const slope: number[] = [0];
  for (let s = 1; s < n; s++) {
    const dx = stations[s] - stations[s - 1];
    slope.push(slope[s - 1] + ((sign * M_arr[s - 1] + sign * M_arr[s]) / 2) * dx);
  }

  // Second integration: defl_raw = ∫∫ sign·M(t) dt²
  const defl: number[] = [0];
  for (let s = 1; s < n; s++) {
    const dx = stations[s] - stations[s - 1];
    defl.push(defl[s - 1] + ((slope[s - 1] + slope[s]) / 2) * dx);
  }

  // Boundary correction: v(x) = v_start + (v_end−v_start)·x/L + (defl(x)−defl(L)·x/L)/EI
  const defl_L = defl[n - 1];
  const result: number[] = [];
  for (let s = 0; s < n; s++) {
    const x = stations[s];
    const v =
      v_start +
      (v_end - v_start) * (x / L) +
      (defl[s] - (defl_L * x) / L) / EI;
    result.push(v);
  }

  return result;
}
