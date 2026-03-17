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
    const endPos = nodePositions.get