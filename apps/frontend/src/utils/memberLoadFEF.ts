/**
 * memberLoadFEF.ts — Fixed-End Force computation for point loads and moments
 *
 * When members have concentrated (point) loads or applied moments, the WASM
 * Rust solver can't compute FEF for them because they were pre-converted to
 * equivalent nodal loads.  This module provides a post-processing step that
 * computes the missing FEF so it can be subtracted from the WASM member
 * forces, correcting the force recovery.
 *
 * Convention (matching Rust solver_3d.rs):
 *   f_total = k_local * u_local − FEF_local          (Eq. 1)
 *
 * WASM returns f_wrong = k_local * u_local − FEF_distributed.
 * The correction is:
 *   f_correct = f_wrong − FEF_pointAndMoment          (Eq. 2)
 *
 * Local DOF order: [Fx, Fy, Fz, Mx, My, Mz] per node (12-DOF total).
 *
 * @version 1.0.0
 */

// ============================================
// TYPES
// ============================================

export interface MemberFEFCorrection {
  /** FEF at node i in LOCAL coords — [Fx, Fy, Fz, Mx, My, Mz] (Newtons / N·m) */
  forces_i: number[];
  /** FEF at node j in LOCAL coords — [Fx, Fy, Fz, Mx, My, Mz] (Newtons / N·m) */
  forces_j: number[];
}

export interface PointMomentLoad {
  type: 'point' | 'moment';
  /** Force or moment value in WASM units (N or N·m) — sign included */
  value: number;
  /** Absolute distance from start node (m) */
  a: number;
  /** Direction: 'global_y', 'global_x', 'global_z', 'local_y', 'local_z', 'axial' */
  direction: string;
}

interface Vec3 { x: number; y: number; z: number }

// ============================================
// ROTATION MATRIX (matches Rust solver_3d.rs)
// ============================================

/**
 * Build the 3×3 rotation matrix T that transforms global → local:
 *   v_local = T · v_global
 *
 * Rows of T are local axes expressed in global coordinates.
 * Matches `transformation_matrix_3d` in Rust solver_3d.rs exactly.
 */
export function buildRotation3x3(
  startNode: Vec3,
  endNode: Vec3,
  beta = 0,
): number[][] {
  const dx = endNode.x - startNode.x;
  const dy = endNode.y - startNode.y;
  const dz = (endNode.z ?? 0) - (startNode.z ?? 0);
  const L = Math.sqrt(dx * dx + dy * dy + dz * dz);
  if (L < 1e-10) return [[1, 0, 0], [0, 1, 0], [0, 0, 1]];

  const cx = dx / L;
  const cy = dy / L;
  const cz = dz / L;
  const cxz = Math.sqrt(cx * cx + cz * cz);

  const cb = Math.cos(beta);
  const sb = Math.sin(beta);

  if (1.0 - Math.abs(cy) < 1e-10 || cxz < 1e-10) {
    // Vertical member
    const sign = cy > 0 ? 1 : -1;
    return [
      [0,           sign, 0    ],
      [-sign * cb,  0,    sb   ],
      [sign * sb,   0,    cb   ],
    ];
  }

  // General case
  return [
    [cx,                              cy,        cz                             ],
    [(-cx * cy * cb - cz * sb) / cxz, cxz * cb,  (-cy * cz * cb + cx * sb) / cxz],
    [(cx * cy * sb - cz * cb) / cxz,  -cxz * sb, (cy * cz * sb + cx * cb) / cxz ],
  ];
}

// ============================================
// HERMITE FEF FOR POINT LOADS (local)
// ============================================

/**
 * Hermite-cubic FEF for a transverse point load P at distance a from start.
 *
 * Returns (r1, r2, m1, m2) — all same sign convention as Rust:
 *   For load in local Y → bending about Z: r→Fy, m→Mz
 *   For load in local Z → bending about Y: r→Fz, m→−My (note sign!)
 *
 *   r1 = P·b²·(3a+b)/L³,  m1 = P·a·b²/L²
 *   r2 = P·a²·(a+3b)/L³,  m2 = −P·a²·b/L²
 */
function fefPointTransverse(P: number, a: number, L: number): [number, number, number, number] {
  const b = L - a;
  const L2 = L * L;
  const L3 = L2 * L;
  const r1 = P * b * b * (3 * a + b) / L3;
  const r2 = P * a * a * (a + 3 * b) / L3;
  const m1 = P * a * b * b / L2;
  const m2 = -P * a * a * b / L2;
  return [r1, r2, m1, m2];
}

/**
 * FEF for an axial point load P at distance a from start.
 *   r1 = P·(L−a)/L,  r2 = P·a/L
 */
function fefPointAxial(P: number, a: number, L: number): [number, number] {
  return [P * (L - a) / L, P * a / L];
}

// ============================================
// HERMITE FEF FOR CONCENTRATED MOMENTS (local)
// ============================================

/**
 * Hermite-derivative FEF for a concentrated moment M₀ at distance a from start.
 *
 * Matches Rust solver_3d.rs `compute_point_load_fef` (moment case):
 *   r1 =  6·M₀·a·b/L³,  m1 = M₀·b·(2a−b)/L²
 *   r2 = −6·M₀·a·b/L³,  m2 = M₀·a·(2b−a)/L²
 */
function fefMomentTransverse(M0: number, a: number, L: number): [number, number, number, number] {
  const b = L - a;
  const L2 = L * L;
  const L3 = L2 * L;
  const r1 = 6 * M0 * a * b / L3;
  const r2 = -6 * M0 * a * b / L3;
  const m1 = M0 * b * (2 * a - b) / L2;
  const m2 = M0 * a * (2 * b - a) / L2;
  return [r1, r2, m1, m2];
}

// ============================================
// ORCHESTRATOR
// ============================================

/**
 * Compute total local-coordinate FEF for a set of point/moment loads on one member.
 *
 * The returned values should be SUBTRACTED from the WASM member forces
 * to correct for pre-converted loads:
 *
 *   forces_i_corrected[k] = forces_i_wasm[k] − result.forces_i[k]
 *   forces_j_corrected[k] = forces_j_wasm[k] − result.forces_j[k]
 */
export function computePointMomentFEF(
  loads: PointMomentLoad[],
  startNode: Vec3,
  endNode: Vec3,
  beta = 0,
): MemberFEFCorrection {
  const dx = endNode.x - startNode.x;
  const dy = endNode.y - startNode.y;
  const dz = (endNode.z ?? 0) - (startNode.z ?? 0);
  const L = Math.sqrt(dx * dx + dy * dy + dz * dz);

  const fi = [0, 0, 0, 0, 0, 0]; // [Fx, Fy, Fz, Mx, My, Mz]
  const fj = [0, 0, 0, 0, 0, 0];

  if (L < 1e-10) return { forces_i: fi, forces_j: fj };

  const T = buildRotation3x3(startNode, endNode, beta);

  for (const ld of loads) {
    const a = Math.max(0, Math.min(L, ld.a));

    if (ld.type === 'point') {
      // Determine global force vector for load value in the given direction
      const dir = ld.direction.toLowerCase();
      let gx = 0, gy = 0, gz = 0;
      if (dir.includes('y'))      { gy = ld.value; }
      else if (dir.includes('z')) { gz = ld.value; }
      else if (dir.includes('x') || dir === 'axial') { gx = ld.value; }
      else                        { gy = ld.value; } // default: global Y

      if (dir.includes('local')) {
        // Load is already in local coordinates
        // Axial: local X
        if (dir.includes('x') || dir === 'axial') {
          const [rx1, rx2] = fefPointAxial(ld.value, a, L);
          fi[0] += rx1;
          fj[0] += rx2;
        }
        // Transverse local Y → bending about Z
        if (dir.includes('y')) {
          const [r1, r2, m1, m2] = fefPointTransverse(ld.value, a, L);
          fi[1] += r1; fi[5] += m1;
          fj[1] += r2; fj[5] += m2;
        }
        // Transverse local Z → bending about Y (moment sign negated per Rust convention)
        if (dir.includes('z')) {
          const [r1, r2, m1, m2] = fefPointTransverse(ld.value, a, L);
          fi[2] += r1; fi[4] += -m1;
          fj[2] += r2; fj[4] += -m2;
        }
      } else {
        // Global direction → project onto local axes using T
        //   P_local_axis[row] = T[row][0]*gx + T[row][1]*gy + T[row][2]*gz
        const pLx = T[0][0] * gx + T[0][1] * gy + T[0][2] * gz;
        const pLy = T[1][0] * gx + T[1][1] * gy + T[1][2] * gz;
        const pLz = T[2][0] * gx + T[2][1] * gy + T[2][2] * gz;

        // Axial (local X)
        if (Math.abs(pLx) > 1e-12) {
          const [rx1, rx2] = fefPointAxial(pLx, a, L);
          fi[0] += rx1;
          fj[0] += rx2;
        }

        // Transverse local Y → bending about Z
        if (Math.abs(pLy) > 1e-12) {
          const [r1, r2, m1, m2] = fefPointTransverse(pLy, a, L);
          fi[1] += r1; fi[5] += m1;
          fj[1] += r2; fj[5] += m2;
        }

        // Transverse local Z → bending about Y (moment sign negated per Rust)
        if (Math.abs(pLz) > 1e-12) {
          const [r1, r2, m1, m2] = fefPointTransverse(pLz, a, L);
          fi[2] += r1; fi[4] += -m1;
          fj[2] += r2; fj[4] += -m2;
        }
      }
    } else if (ld.type === 'moment') {
      // Concentrated moment — typically about Z axis (bending)
      // For simplicity, treat as a moment about local Z (primary bending)
      // This matches the existing ModernModeler.tsx conversion which maps to mz.
      const dir = ld.direction.toLowerCase();

      if (dir.includes('local')) {
        // Moment about local Z (primary bending)
        const [r1, r2, m1, m2] = fefMomentTransverse(ld.value, a, L);
        fi[1] += r1; fi[5] += m1;
        fj[1] += r2; fj[5] += m2;
      } else {
        // Global direction moments:
        // For "global_y" moments, the existing code maps shear to fy and moment to mz,
        // which means bending in the XY plane → moment about local Z.
        // We project the shear forces through T, but the moment itself is about Z.
        // The simplest correct approach: apply as bending about local Z.
        const [r1, r2, m1, m2] = fefMomentTransverse(ld.value, a, L);
        fi[1] += r1; fi[5] += m1;
        fj[1] += r2; fj[5] += m2;
      }
    }
  }

  return { forces_i: fi, forces_j: fj };
}
