/**
 * Optimized Numerical Core for Structural Solver
 *
 * Key Performance Optimizations:
 * 1. Flat Float64Array (row-major) instead of number[][] — eliminates 144 heap objects per element
 * 2. Block-diagonal T exploitation for T^T·kL·T — 4× fewer multiply-adds
 * 3. Pre-allocated static buffers to minimize GC pressure
 * 4. Sparse PCG solver with Jacobi preconditioning (replaces O(n³) dense Gauss)
 * 5. COO → CSR conversion for efficient SpMV
 *
 * Mathematical Reference:
 *   McGuire, Gallagher, Ziemian — "Matrix Structural Analysis", 2nd Ed.
 *   Cook, Malkus, Plesha — "Concepts and Applications of FEA", 4th Ed.
 *
 * @module optimized-core
 */

// ============================================
// STATIC BUFFER POOL — reused across elements
// ============================================
const _kL12 = new Float64Array(144);    // 12×12 local stiffness
const _kG12 = new Float64Array(144);    // 12×12 global stiffness
const _R9   = new Float64Array(9);      // 3×3 rotation matrix
const _kL6  = new Float64Array(36);     // 6×6 local stiffness (2D)
const _T6   = new Float64Array(36);     // 6×6 transformation (2D)
const _tmp6 = new Float64Array(36);     // 6×6 temp (2D)

// ============================================
// 3×3 ROTATION MATRIX
// ============================================

/**
 * Build 3×3 rotation matrix R for a 3D space frame element.
 *
 * Convention: rows of R = local axes expressed in global coordinates.
 *   Row 0: lx (member axis)
 *   Row 1: ly (local y — default perpendicular via cross with global Y)
 *   Row 2: lz = lx × ly (right-hand system)
 *
 * R transforms global → local:  u_local = R · u_global
 *
 * For vertical members (along ±global Y), uses SAP2000/STAAD convention:
 *   ly = -sign(cy) · globalX
 *
 * @param cx  Direction cosine x (dx/L)
 * @param cy  Direction cosine y (dy/L)
 * @param cz  Direction cosine z (dz/L)
 * @param betaDeg  Member roll angle (degrees) — rotation about local x-axis
 * @param out  Optional pre-allocated Float64Array(9)
 * @returns Float64Array(9) — row-major 3×3 rotation matrix
 */
export function buildRotation3x3(
  cx: number, cy: number, cz: number,
  betaDeg: number = 0,
  out?: Float64Array,
): Float64Array {
  const R = out ?? new Float64Array(9);

  // Local x-axis = member direction
  R[0] = cx; R[1] = cy; R[2] = cz;

  // Determine local y-axis
  const tol = 1e-6;
  const isVertical = Math.abs(cx) < tol && Math.abs(cz) < tol;

  let ly0: number, ly1: number, ly2: number;

  if (isVertical) {
    const sign = cy > 0 ? 1 : -1;
    ly0 = -sign; ly1 = 0; ly2 = 0;
  } else {
    // lz_temp = lx × globalY = (−cz, 0, cx)
    const lzLen = Math.sqrt(cz * cz + cx * cx);
    const lz0 = -cz / lzLen;
    const lz2 = cx / lzLen;
    // ly = lz × lx
    ly0 = -lz2 * cy;
    ly1 = lz2 * cx - lz0 * cz;
    ly2 = lz0 * cy;
  }

  // Apply beta rotation about member axis (ly_new = cos(β)·ly + sin(β)·lz_before)
  if (betaDeg !== 0) {
    const betaRad = betaDeg * Math.PI / 180;
    const cb = Math.cos(betaRad);
    const sb = Math.sin(betaRad);
    // lz_before = lx × ly
    const lzb0 = cy * ly2 - cz * ly1;
    const lzb1 = cz * ly0 - cx * ly2;
    const lzb2 = cx * ly1 - cy * ly0;
    ly0 = cb * ly0 + sb * lzb0;
    ly1 = cb * ly1 + sb * lzb1;
    ly2 = cb * ly2 + sb * lzb2;
  }

  R[3] = ly0; R[4] = ly1; R[5] = ly2;

  // lz = lx × ly (right-hand system)
  R[6] = cy * ly2 - cz * ly1;
  R[7] = cz * ly0 - cx * ly2;
  R[8] = cx * ly1 - cy * ly0;

  return R;
}

// ============================================
// 12×12 LOCAL STIFFNESS — EULER-BERNOULLI BEAM
// ============================================

/**
 * Build 12×12 local stiffness matrix for 3D Euler-Bernoulli beam.
 * Stored as flat Float64Array(144), row-major: kL[i*12+j].
 *
 * DOF order: [u1, v1, w1, θx1, θy1, θz1, u2, v2, w2, θx2, θy2, θz2]
 *
 * @param EA_L  E·A / L  (axial stiffness / length)
 * @param GJ_L  G·J / L  (torsional stiffness / length)
 * @param EIz   E·Iz     (bending rigidity about z — strong axis, xy-plane bending)
 * @param EIy   E·Iy     (bending rigidity about y — weak axis, xz-plane bending)
 * @param L     Element length
 * @param out   Optional pre-allocated Float64Array(144)
 */
export function buildLocalStiffness12(
  EA_L: number, GJ_L: number,
  EIz: number, EIy: number,
  L: number,
  out?: Float64Array,
): Float64Array {
  const k = out ?? new Float64Array(144);
  k.fill(0);

  const L2 = L * L;
  const L3 = L2 * L;

  // Axial: DOF 0 ↔ 6
  k[0] = EA_L;         k[6] = -EA_L;
  k[6 * 12] = -EA_L;   k[6 * 12 + 6] = EA_L;

  // Torsion: DOF 3 ↔ 9
  k[3 * 12 + 3] = GJ_L;   k[3 * 12 + 9] = -GJ_L;
  k[9 * 12 + 3] = -GJ_L;  k[9 * 12 + 9] = GJ_L;

  // Bending in xy-plane (Iz → Mz): DOF 1, 5, 7, 11
  const a1 = 12 * EIz / L3;
  const a2 = 6 * EIz / L2;
  const a3 = 4 * EIz / L;
  const a4 = 2 * EIz / L;

  k[1 * 12 + 1] = a1;   k[1 * 12 + 5] = a2;   k[1 * 12 + 7] = -a1;  k[1 * 12 + 11] = a2;
  k[5 * 12 + 1] = a2;   k[5 * 12 + 5] = a3;   k[5 * 12 + 7] = -a2;  k[5 * 12 + 11] = a4;
  k[7 * 12 + 1] = -a1;  k[7 * 12 + 5] = -a2;  k[7 * 12 + 7] = a1;   k[7 * 12 + 11] = -a2;
  k[11 * 12 + 1] = a2;  k[11 * 12 + 5] = a4;  k[11 * 12 + 7] = -a2; k[11 * 12 + 11] = a3;

  // Bending in xz-plane (Iy → My): DOF 2, 4, 8, 10
  const b1 = 12 * EIy / L3;
  const b2 = 6 * EIy / L2;
  const b3 = 4 * EIy / L;
  const b4 = 2 * EIy / L;

  k[2 * 12 + 2] = b1;   k[2 * 12 + 4] = -b2;  k[2 * 12 + 8] = -b1;  k[2 * 12 + 10] = -b2;
  k[4 * 12 + 2] = -b2;  k[4 * 12 + 4] = b3;   k[4 * 12 + 8] = b2;   k[4 * 12 + 10] = b4;
  k[8 * 12 + 2] = -b1;  k[8 * 12 + 4] = b2;   k[8 * 12 + 8] = b1;   k[8 * 12 + 10] = b2;
  k[10 * 12 + 2] = -b2; k[10 * 12 + 4] = b4;  k[10 * 12 + 8] = b2;  k[10 * 12 + 10] = b3;

  return k;
}

// ============================================
// COORDINATE TRANSFORMATION — BLOCK-DIAGONAL
// ============================================

/**
 * Transform 12×12 local stiffness to global: kG = T^T · kL · T
 *
 * Exploits block-diagonal structure of T = diag(R, R, R, R).
 *
 * Standard approach:  2 × 12³ = 3456 multiply-adds
 * Block approach:     4×4 blocks × 2 × 3³ = 16 × 54 = 864 multiply-adds (4× faster)
 *
 * Formula per 3×3 sub-block [bi, bj]:
 *   kG_sub[a][b] = Σ_p Σ_q R[p][a] · kL_sub[p][q] · R[q][b]
 *
 * where kL_sub is the (bi, bj)-th 3×3 sub-block of kL.
 *
 * @param kL   12×12 local stiffness (flat Float64Array(144), row-major)
 * @param R    3×3 rotation matrix (flat Float64Array(9), row-major)
 * @param out  Optional pre-allocated Float64Array(144)
 * @returns Float64Array(144) — 12×12 global stiffness matrix
 */
export function transformStiffness12(
  kL: Float64Array,
  R: Float64Array,
  out?: Float64Array,
): Float64Array {
  const kG = out ?? new Float64Array(144);

  // Process 4×4 = 16 blocks of 3×3
  for (let bi = 0; bi < 4; bi++) {
    const ri = bi * 3;
    for (let bj = 0; bj < 4; bj++) {
      const cj = bj * 3;

      for (let a = 0; a < 3; a++) {
        for (let b = 0; b < 3; b++) {
          let sum = 0;
          for (let p = 0; p < 3; p++) {
            const Rpa = R[p * 3 + a]; // R^T[a,p]
            // Inner: Σ_q kL[(ri+p)*12 + (cj+q)] · R[q*3+b]
            const rowBase = (ri + p) * 12 + cj;
            sum += Rpa * (
              kL[rowBase]     * R[b] +
              kL[rowBase + 1] * R[3 + b] +
              kL[rowBase + 2] * R[6 + b]
            );
          }
          kG[(ri + a) * 12 + (cj + b)] = sum;
        }
      }
    }
  }

  return kG;
}

// ============================================
// COMBINED OPTIMIZED ELEMENT STIFFNESS
// ============================================

/**
 * Compute 12×12 global stiffness matrix for a 3D space frame element.
 *
 * Combines local stiffness computation + block-diagonal transformation.
 * Returns a NEW Float64Array(144) (safe to store; internal buffers are reused).
 *
 * @param E      Young's modulus
 * @param A      Cross-section area
 * @param Iy     Second moment about local y (weak-axis bending)
 * @param Iz     Second moment about local z (strong-axis bending)
 * @param J      Torsion constant (Saint-Venant)
 * @param G      Shear modulus
 * @param L      Element length
 * @param cx     Direction cosine x
 * @param cy     Direction cosine y
 * @param cz     Direction cosine z
 * @param betaAngle  Roll angle (degrees)
 * @returns Float64Array(144) — 12×12 global stiffness (row-major)
 */
export function computeFrame3DStiffnessOpt(
  E: number, A: number,
  Iy: number, Iz: number,
  J: number, G: number,
  L: number,
  cx: number, cy: number, cz: number,
  betaAngle: number = 0,
): Float64Array {
  // Fallbacks
  if (!J || J === 0) J = Math.max(Math.min(Iy, Iz) / 500, (Iy + Iz) * 1e-4);
  if (!G || G === 0) {
    const poissonRatio = 0.3; // Steel
    G = E / (2 * (1 + poissonRatio)); // G = E/(2(1+ν))
  }

  // Build local stiffness into static buffer
  const kL = buildLocalStiffness12(
    E * A / L, G * J / L, E * Iz, E * Iy, L, _kL12,
  );

  // Build rotation matrix into static buffer
  const R = buildRotation3x3(cx, cy, cz, betaAngle, _R9);

  // Transform to global into static buffer
  const kGBuf = transformStiffness12(kL, R, _kG12);

  // Return a copy (buffers will be reused for next element)
  return Float64Array.from(kGBuf);
}

/**
 * Compute 6×6 global stiffness matrix for a 2D frame element.
 * DOF order: [u1, v1, θz1, u2, v2, θz2]
 *
 * Uses flat Float64Array with pre-allocated buffers.
 *
 * @returns Float64Array(36) — 6×6 global stiffness (row-major)
 */
export function computeFrame2DStiffnessOpt(
  E: number, A: number, I: number, L: number,
  cx: number, cy: number,
): Float64Array {
  const EA_L = E * A / L;
  const EI = E * I;
  const L2 = L * L;
  const L3 = L2 * L;

  // Build local stiffness
  const kL = _kL6;
  kL.fill(0);
  kL[0] = EA_L;      kL[3] = -EA_L;
  kL[3 * 6] = -EA_L; kL[3 * 6 + 3] = EA_L;

  const v1 = 12 * EI / L3;
  const v2 = 6 * EI / L2;
  const v3 = 4 * EI / L;
  const v4 = 2 * EI / L;

  kL[1 * 6 + 1] = v1;  kL[1 * 6 + 2] = v2;  kL[1 * 6 + 4] = -v1; kL[1 * 6 + 5] = v2;
  kL[2 * 6 + 1] = v2;  kL[2 * 6 + 2] = v3;  kL[2 * 6 + 4] = -v2; kL[2 * 6 + 5] = v4;
  kL[4 * 6 + 1] = -v1; kL[4 * 6 + 2] = -v2; kL[4 * 6 + 4] = v1;  kL[4 * 6 + 5] = -v2;
  kL[5 * 6 + 1] = v2;  kL[5 * 6 + 2] = v4;  kL[5 * 6 + 4] = -v2; kL[5 * 6 + 5] = v3;

  // 2D rotation
  const Lproj = Math.sqrt(cx * cx + cy * cy);
  const c = cx / Lproj;
  const s = cy / Lproj;

  // Build T (block-diagonal: 2×2 rotation + identity for θ, repeated)
  const T = _T6;
  T.fill(0);
  T[0] = c;      T[1] = s;
  T[1 * 6] = -s; T[1 * 6 + 1] = c;
  T[2 * 6 + 2] = 1;
  T[3 * 6 + 3] = c;  T[3 * 6 + 4] = s;
  T[4 * 6 + 3] = -s; T[4 * 6 + 4] = c;
  T[5 * 6 + 5] = 1;

  // temp = kL × T
  const tmp = _tmp6;
  for (let i = 0; i < 6; i++) {
    const ib = i * 6;
    for (let j = 0; j < 6; j++) {
      let sum = 0;
      for (let k = 0; k < 6; k++) {
        sum += kL[ib + k] * T[k * 6 + j];
      }
      tmp[ib + j] = sum;
    }
  }

  // kG = T^T × temp
  const kG = new Float64Array(36);
  for (let i = 0; i < 6; i++) {
    for (let j = 0; j < 6; j++) {
      let sum = 0;
      for (let k = 0; k < 6; k++) {
        sum += T[k * 6 + i] * tmp[k * 6 + j];
      }
      kG[i * 6 + j] = sum;
    }
  }

  return kG;
}

// ============================================
// FLAT MATRIX STATIC CONDENSATION
// ============================================

/**
 * Apply static condensation for member releases on a flat Float64Array matrix.
 * Modifies in-place.
 *
 * For each released DOF r:
 *   k[i][j] -= k[i][r] * k[r][j] / k[r][r]
 * Then zeros row r and column r.
 *
 * @param ke   Flat stiffness matrix (n×n row-major)
 * @param n    Matrix dimension (6 or 12)
 * @param releasedDofs  Array of released local DOF indices
 */
export function applyReleasesFlat(
  ke: Float64Array, n: number,
  releasedDofs: number[],
): void {
  for (const r of releasedDofs) {
    if (r < 0 || r >= n) continue;
    const pivot = ke[r * n + r];
    if (Math.abs(pivot) < 1e-20) continue;
    const invPivot = 1 / pivot;

    for (let i = 0; i < n; i++) {
      if (i === r) continue;
      const kir = ke[i * n + r];
      if (Math.abs(kir) < 1e-30) continue;
      for (let j = 0; j < n; j++) {
        if (j === r) continue;
        ke[i * n + j] -= kir * ke[r * n + j] * invPivot;
      }
    }
    // Zero released row and column
    for (let i = 0; i < n; i++) {
      ke[r * n + i] = 0;
      ke[i * n + r] = 0;
    }
  }
}

/**
 * Map a small flat matrix into a larger one at specified DOF indices.
 * e.g., 6×6 truss into 12×12 frame DOF space.
 *
 * @param small     Source flat matrix (smallSize × smallSize)
 * @param smallSize Source matrix dimension
 * @param indices   DOF mapping: small DOF i → large DOF indices[i]
 * @param largeSize Target matrix dimension
 * @returns Float64Array(largeSize²)
 */
export function mapMatrixFlat(
  small: Float64Array, smallSize: number,
  indices: number[], largeSize: number,
): Float64Array {
  const large = new Float64Array(largeSize * largeSize);
  for (let i = 0; i < smallSize; i++) {
    const li = indices[i];
    if (li === undefined) continue;
    for (let j = 0; j < smallSize; j++) {
      const lj = indices[j];
      if (lj === undefined) continue;
      large[li * largeSize + lj] = small[i * smallSize + j];
    }
  }
  return large;
}

// ============================================
// COO → CSR CONVERSION
// ============================================

export interface CSRMatrix {
  rowPtr: Uint32Array;
  colIdx: Uint32Array;
  values: Float64Array;
  n: number;
  nnz: number;
}

/**
 * Convert COO triplets to CSR format.
 * Sums duplicate entries and sorts columns within each row.
 *
 * Step 1: Count entries per row.
 * Step 2: Prefix-sum for row pointers.
 * Step 3: Fill column indices and values.
 * Step 4: Sort columns within each row via insertion sort.
 * Step 5: Sum duplicates in-place and compact.
 *
 * @param cooRows COO row indices
 * @param cooCols COO column indices
 * @param cooVals COO values
 * @param nnz     Number of COO entries
 * @param n       Matrix dimension
 */
export function cooToCSR(
  cooRows: Uint32Array, cooCols: Uint32Array, cooVals: Float64Array,
  nnz: number, n: number,
): CSRMatrix {
  // Step 1: Count entries per row
  const rowCount = new Uint32Array(n + 1);
  for (let k = 0; k < nnz; k++) {
    const r = cooRows[k];
    if (r < n) rowCount[r + 1]++;
  }

  // Step 2: Prefix sum
  for (let i = 1; i <= n; i++) rowCount[i] += rowCount[i - 1];

  const totalEntries = rowCount[n];
  const colIdx = new Uint32Array(totalEntries);
  const values = new Float64Array(totalEntries);

  // Step 3: Fill
  const insertPos = Uint32Array.from(rowCount.subarray(0, n));
  for (let k = 0; k < nnz; k++) {
    const r = cooRows[k];
    if (r >= n) continue;
    const pos = insertPos[r]++;
    colIdx[pos] = cooCols[k];
    values[pos] = cooVals[k];
  }

  // Step 4 & 5: Sort columns within each row, sum duplicates, compact
  let compactedNnz = 0;
  const newRowPtr = new Uint32Array(n + 1);

  for (let i = 0; i < n; i++) {
    const start = rowCount[i];
    const end = rowCount[i + 1];
    newRowPtr[i] = compactedNnz;

    // Insertion sort by column index
    for (let j = start + 1; j < end; j++) {
      const keyCol = colIdx[j];
      const keyVal = values[j];
      let k = j - 1;
      while (k >= start && colIdx[k] > keyCol) {
        colIdx[k + 1] = colIdx[k];
        values[k + 1] = values[k];
        k--;
      }
      colIdx[k + 1] = keyCol;
      values[k + 1] = keyVal;
    }

    // Sum duplicates and compact
    for (let j = start; j < end; j++) {
      if (compactedNnz > newRowPtr[i] && colIdx[j] === colIdx[compactedNnz - 1]) {
        values[compactedNnz - 1] += values[j];
      } else {
        colIdx[compactedNnz] = colIdx[j];
        values[compactedNnz] = values[j];
        compactedNnz++;
      }
    }
  }
  newRowPtr[n] = compactedNnz;

  return {
    rowPtr: newRowPtr,
    colIdx: colIdx.subarray(0, compactedNnz),
    values: values.subarray(0, compactedNnz),
    n,
    nnz: compactedNnz,
  };
}

// ============================================
// CSR MATRIX-VECTOR MULTIPLY
// ============================================

/**
 * y = A · x  (CSR matrix × dense vector)
 */
export function csrMulVec(
  csr: CSRMatrix,
  x: Float64Array,
  y: Float64Array,
): void {
  const { rowPtr, colIdx, values, n } = csr;
  for (let i = 0; i < n; i++) {
    let sum = 0;
    const end = rowPtr[i + 1];
    for (let k = rowPtr[i]; k < end; k++) {
      sum += values[k] * x[colIdx[k]];
    }
    y[i] = sum;
  }
}

// ============================================
// PRECONDITIONED CONJUGATE GRADIENT SOLVER
// ============================================

/**
 * Solve A·x = b using Preconditioned Conjugate Gradient (Jacobi preconditioner).
 *
 * For symmetric positive-definite matrices arising from FEM structural analysis.
 * Works on COO input — first converts to CSR internally.
 *
 * Complexity: O(n · nnz_per_row · iterations) vs O(n³) for dense Gauss.
 * Typically converges in O(√κ) iterations where κ is the condition number.
 *
 * With Jacobi preconditioning, handles systems up to ~100k DOF in JS.
 * The dense Gauss fallback is limited to 3k DOF — this is 30× better.
 *
 * @param cooRows  COO row indices
 * @param cooCols  COO column indices
 * @param cooVals  COO values
 * @param b        Right-hand side vector
 * @param n        System dimension
 * @param nnzCount Number of COO entries
 * @param maxIter  Maximum iterations (default min(2n, 20000))
 * @param tol      Relative tolerance (default 1e-10)
 * @param onProgress  Optional callback: (iter, relResidual) => void
 * @returns Float64Array — solution vector x
 */
export function solvePCG(
  cooRows: Uint32Array, cooCols: Uint32Array, cooVals: Float64Array,
  b: Float64Array,
  n: number,
  nnzCount: number,
  maxIter?: number,
  tol: number = 1e-10,
  onProgress?: (iter: number, relResidual: number) => void,
): Float64Array {
  const maxIt = maxIter ?? Math.min(2 * n, 20000);

  // Convert to CSR
  const csr = cooToCSR(cooRows, cooCols, cooVals, nnzCount, n);

  // Extract diagonal for Jacobi preconditioner: M = diag(A)
  const diagInv = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    const end = csr.rowPtr[i + 1];
    let diag = 0;
    for (let k = csr.rowPtr[i]; k < end; k++) {
      if (csr.colIdx[k] === i) { diag = csr.values[k]; break; }
    }
    diagInv[i] = Math.abs(diag) > 1e-30 ? 1 / diag : 0;
  }

  // Allocate work vectors
  const x  = new Float64Array(n);
  const r  = new Float64Array(n);
  const z  = new Float64Array(n);
  const p  = new Float64Array(n);
  const Ap = new Float64Array(n);

  // r = b  (since x₀ = 0)
  r.set(b);

  // Compute ‖b‖ for relative tolerance
  let bNorm2 = 0;
  for (let i = 0; i < n; i++) bNorm2 += b[i] * b[i];
  const bNorm = Math.sqrt(bNorm2);
  if (bNorm < 1e-30) return x; // trivial solution

  const absTol2 = (tol * bNorm) * (tol * bNorm);

  // z = M⁻¹ · r; p = z; rz = r·z
  let rz = 0;
  for (let i = 0; i < n; i++) {
    z[i] = diagInv[i] * r[i];
    p[i] = z[i];
    rz += r[i] * z[i];
  }

  for (let iter = 0; iter < maxIt; iter++) {
    // Ap = A · p
    csrMulVec(csr, p, Ap);

    // α = rz / (p · Ap)
    let pAp = 0;
    for (let i = 0; i < n; i++) pAp += p[i] * Ap[i];
    if (Math.abs(pAp) < 1e-30) break; // breakdown

    const alpha = rz / pAp;

    // x += α·p;  r -= α·Ap;  check convergence
    let rNorm2 = 0;
    for (let i = 0; i < n; i++) {
      x[i] += alpha * p[i];
      r[i] -= alpha * Ap[i];
      rNorm2 += r[i] * r[i];
    }

    if (onProgress && (iter & 127) === 0) {
      onProgress(iter, Math.sqrt(rNorm2) / bNorm);
    }

    if (rNorm2 < absTol2) break;

    // z = M⁻¹ · r;  newRz = r · z
    let newRz = 0;
    for (let i = 0; i < n; i++) {
      z[i] = diagInv[i] * r[i];
      newRz += r[i] * z[i];
    }

    const beta = newRz / rz;
    rz = newRz;

    // p = z + β·p
    for (let i = 0; i < n; i++) {
      p[i] = z[i] + beta * p[i];
    }
  }

  return x;
}

// ============================================
// HELPER: FLAT MATRIX MULTIPLY FOR FORCE RECOVERY
// ============================================

/**
 * Multiply flat N×N matrix by flat N-vector: y = A · x
 */
export function flatMatVec(
  A: Float64Array, x: Float64Array, n: number,
  y: Float64Array,
): void {
  for (let i = 0; i < n; i++) {
    let sum = 0;
    const base = i * n;
    for (let j = 0; j < n; j++) {
      sum += A[base + j] * x[j];
    }
    y[i] = sum;
  }
}

/**
 * Transform global displacement vector to local: u_local = T · u_global
 * Uses block-diagonal T = diag(R, R, R, R) for 12-DOF.
 *
 * @param R        3×3 rotation matrix (flat Float64Array(9))
 * @param uGlobal  12-element global displacement vector
 * @param uLocal   12-element output local displacement vector
 */
export function transformToLocal12(
  R: Float64Array,
  uGlobal: Float64Array,
  uLocal: Float64Array,
): void {
  for (let blk = 0; blk < 4; blk++) {
    const off = blk * 3;
    for (let i = 0; i < 3; i++) {
      uLocal[off + i] =
        R[i * 3]     * uGlobal[off] +
        R[i * 3 + 1] * uGlobal[off + 1] +
        R[i * 3 + 2] * uGlobal[off + 2];
    }
  }
}
