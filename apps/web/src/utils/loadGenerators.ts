/**
 * loadGenerators.ts — Load Generation Algorithms
 *
 * STAAD.Pro parity: Floor load (yield-line), area load (tributary width),
 * and snow load (ASCE 7-22 / IS 875 Part 4) computation utilities.
 */

// ─── Types ───────────────────────────────────────────────────────────────────

export type FloorDistributionMethod = 'two_way_yield_line' | 'one_way_x' | 'one_way_z';

export interface Point2D {
  x: number;
  z: number;
}

export interface BeamLoadResult {
  memberId: string;
  udl: number; // kN/m
}

export interface FloorLoadResult {
  beamLoads: BeamLoadResult[];
  error?: string;
}

export type SnowCode = 'ASCE7' | 'IS875_4';

export interface ASCE7SnowParams {
  pg: number;   // ground snow load (kN/m²)
  Ce: number;   // exposure factor
  Ct: number;   // thermal factor
  Is: number;   // importance factor
  roofSlope?: number; // degrees (default 0)
}

export interface IS875SnowParams {
  basicSnowLoad: number;    // S0 (kN/m²)
  shapeCoefficient: number; // μ
  exposureReduction: number; // k1
}

export interface SnowLoadResult {
  designLoad: number; // kN/m²
  flatRoofLoad?: number;
  slopeFactor?: number;
}

// ─── Floor Load — Yield-Line Distribution ────────────────────────────────────

/**
 * Checks if a set of boundary member endpoints forms a closed polygon.
 * Each member is represented as [startNodeId, endNodeId].
 * A closed polygon requires every node to appear exactly twice (degree 2).
 */
export function isClosedPolygon(memberEndpoints: [string, string][]): boolean {
  if (memberEndpoints.length < 3) return false;
  const degree = new Map<string, number>();
  for (const [a, b] of memberEndpoints) {
    degree.set(a, (degree.get(a) ?? 0) + 1);
    degree.set(b, (degree.get(b) ?? 0) + 1);
  }
  for (const [, d] of degree) {
    if (d !== 2) return false;
  }
  return true;
}

/**
 * Computes the centroid of a polygon defined by ordered vertices.
 */
function computeCentroid(vertices: Point2D[]): Point2D {
  let cx = 0, cz = 0;
  for (const v of vertices) {
    cx += v.x;
    cz += v.z;
  }
  return { x: cx / vertices.length, z: cz / vertices.length };
}

/**
 * Computes the area of a triangle given three vertices.
 */
function triangleArea(a: Point2D, b: Point2D, c: Point2D): number {
  return Math.abs((b.x - a.x) * (c.z - a.z) - (c.x - a.x) * (b.z - a.z)) / 2;
}

/**
 * Computes floor load distribution using the two-way yield-line method.
 *
 * For each boundary beam, the tributary area is the triangle formed by
 * the beam's two endpoints and the panel centroid. The UDL on the beam
 * is: UDL = pressure × tributary_area / beam_length.
 *
 * @param memberEndpoints - Array of [startNodeId, endNodeId] for boundary beams
 * @param nodePositions - Map from nodeId to {x, z} position
 * @param pressure - Uniform floor pressure (kN/m²)
 * @param method - Distribution method
 * @returns BeamLoadResult[] with UDL for each beam
 */
export function computeFloorLoadYieldLine(
  memberIds: string[],
  memberEndpoints: [string, string][],
  nodePositions: Map<string, Point2D>,
  pressure: number,
  method: FloorDistributionMethod = 'two_way_yield_line',
): FloorLoadResult {
  if (!isClosedPolygon(memberEndpoints)) {
    return {
      beamLoads: [],
      error: 'Selected members do not form a closed polygon. Please ensure all boundary beams are connected end-to-end.',
    };
  }

  // Build ordered polygon vertices
  const vertices: Point2D[] = [];
  const orderedNodeIds: string[] = [];

  // Start from first member
  const [firstStart, firstEnd] = memberEndpoints[0];
  orderedNodeIds.push(firstStart, firstEnd);

  // Walk the polygon
  const remaining = memberEndpoints.slice(1);
  while (remaining.length > 0) {
    const last = orderedNodeIds[orderedNodeIds.length - 1];
    const idx = remaining.findIndex(([a, b]) => a === last || b === last);
    if (idx === -1) break;
    const [a, b] = remaining.splice(idx, 1)[0];
    const next = a === last ? b : a;
    if (next !== orderedNodeIds[0]) {
      orderedNodeIds.push(next);
    }
  }

  for (const id of orderedNodeIds) {
    const pos = nodePositions.get(id);
    if (pos) vertices.push(pos);
  }

  const centroid = computeCentroid(vertices);
  const beamLoads: BeamLoadResult[] = [];

  for (let i = 0; i < memberIds.length; i++) {
    const [startId, endId] = memberEndpoints[i];
    const startPos = nodePositions.get(startId);
    const endPos = nodePositions.get(endId);
    if (!startPos || !endPos) continue;

    const dx = endPos.x - startPos.x;
    const dz = endPos.z - startPos.z;
    const beamLength = Math.sqrt(dx * dx + dz * dz);
    if (beamLength < 1e-6) continue;

    let udl: number;

    if (method === 'two_way_yield_line') {
      // Tributary area = triangle formed by beam endpoints and centroid
      const area = triangleArea(startPos, endPos, centroid);
      udl = (pressure * area) / beamLength;
    } else if (method === 'one_way_x') {
      // One-way in X: only beams parallel to Z carry load
      // Tributary width = half the panel dimension in X
      const panelWidth = Math.max(...vertices.map((v) => v.x)) - Math.min(...vertices.map((v) => v.x));
      const isParallelToZ = Math.abs(dx) < 1e-6;
      udl = isParallelToZ ? pressure * (panelWidth / 2) : 0;
    } else {
      // one_way_z: only beams parallel to X carry load
      const panelDepth = Math.max(...vertices.map((v) => v.z)) - Math.min(...vertices.map((v) => v.z));
      const isParallelToX = Math.abs(dz) < 1e-6;
      udl = isParallelToX ? pressure * (panelDepth / 2) : 0;
    }

    beamLoads.push({ memberId: memberIds[i], udl });
  }

  return { beamLoads };
}

// ─── Area Load — Tributary Width ─────────────────────────────────────────────

/**
 * Computes the UDL for a single beam given pressure and tributary width.
 * UDL = pressure × tributary_width (kN/m)
 */
export function computeAreaLoadUDL(pressure: number, tributaryWidth: number): number {
  return pressure * tributaryWidth;
}

// ─── Snow Load Formulas ───────────────────────────────────────────────────────

/**
 * Computes the ASCE 7-22 flat roof snow load.
 * pf = 0.7 × Ce × Ct × Is × pg
 */
export function computeASCE7FlatRoofSnow(params: ASCE7SnowParams): number {
  const { pg, Ce, Ct, Is } = params;
  return 0.7 * Ce * Ct * Is * pg;
}

/**
 * Computes the ASCE 7-22 slope factor Cs.
 * Cs = 1.0 for slope ≤ 5°
 * Cs = (70 - slope) / 65 for 5° < slope ≤ 70°
 * Cs = 0 for slope > 70°
 */
export function computeASCE7SlopeFactor(slopeDeg: number): number {
  if (slopeDeg <= 5) return 1.0;
  if (slopeDeg <= 70) return (70 - slopeDeg) / 65;
  return 0;
}

/**
 * Computes the full ASCE 7-22 design snow load (sloped roof).
 */
export function computeASCE7SnowLoad(params: ASCE7SnowParams): SnowLoadResult {
  const pf = computeASCE7FlatRoofSnow(params);
  const slope = params.roofSlope ?? 0;
  const Cs = computeASCE7SlopeFactor(slope);
  const ps = Cs * pf;
  return { designLoad: ps, flatRoofLoad: pf, slopeFactor: Cs };
}

/**
 * Computes the IS 875 Part 4 design snow load.
 * S = μ × S0 × k1
 */
export function computeIS875SnowLoad(params: IS875SnowParams): SnowLoadResult {
  const { basicSnowLoad, shapeCoefficient, exposureReduction } = params;
  const designLoad = shapeCoefficient * basicSnowLoad * exposureReduction;
  return { designLoad };
}

/**
 * Unified snow load computation dispatcher.
 */
export function computeSnowLoad(
  code: SnowCode,
  params: ASCE7SnowParams | IS875SnowParams,
): SnowLoadResult {
  if (code === 'ASCE7') {
    return computeASCE7SnowLoad(params as ASCE7SnowParams);
  }
  return computeIS875SnowLoad(params as IS875SnowParams);
}
