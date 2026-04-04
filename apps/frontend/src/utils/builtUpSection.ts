/**
 * builtUpSection.ts — Built-Up Section Computation
 *
 * STAAD.Pro parity: Computes combined section properties for built-up
 * cross-sections using the parallel axis theorem.
 */

export interface ComponentProperties {
  area: number;   // mm²
  ixx: number;    // mm⁴ (about component's own centroidal axis)
  iyy: number;    // mm⁴
  ixy?: number;   // mm⁴ (product of inertia, default 0)
  cx: number;     // centroid X from reference origin (mm)
  cy: number;     // centroid Y from reference origin (mm)
}

export interface BuiltUpSectionProperties {
  combinedArea: number;       // mm²
  combinedIxx: number;        // mm⁴
  combinedIyy: number;        // mm⁴
  combinedIxy: number;        // mm⁴
  centroidX: number;          // mm from reference origin
  centroidY: number;          // mm from reference origin
  sectionModulusXX?: number;  // mm³
  sectionModulusYY?: number;  // mm³
}

/**
 * Computes combined section properties using the parallel axis theorem.
 *
 * Step 1: Combined centroid
 *   A_total = Σ A_i
 *   CX = Σ (A_i × cx_i) / A_total
 *   CY = Σ (A_i × cy_i) / A_total
 *
 * Step 2: Combined second moments (parallel axis theorem)
 *   Ixx_total = Σ (Ixx_i + A_i × (cy_i - CY)²)
 *   Iyy_total = Σ (Iyy_i + A_i × (cx_i - CX)²)
 *   Ixy_total = Σ (Ixy_i + A_i × (cx_i - CX) × (cy_i - CY))
 */
export function computeBuiltUpProperties(
  components: ComponentProperties[],
): BuiltUpSectionProperties {
  if (components.length === 0) {
    return { combinedArea: 0, combinedIxx: 0, combinedIyy: 0, combinedIxy: 0, centroidX: 0, centroidY: 0 };
  }

  // Step 1: Combined centroid
  const totalArea = components.reduce((sum, c) => sum + c.area, 0);
  const centroidX = components.reduce((sum, c) => sum + c.area * c.cx, 0) / totalArea;
  const centroidY = components.reduce((sum, c) => sum + c.area * c.cy, 0) / totalArea;

  // Step 2: Parallel axis theorem
  let combinedIxx = 0;
  let combinedIyy = 0;
  let combinedIxy = 0;

  for (const c of components) {
    const dy = c.cy - centroidY;
    const dx = c.cx - centroidX;
    combinedIxx += c.ixx + c.area * dy * dy;
    combinedIyy += c.iyy + c.area * dx * dx;
    combinedIxy += (c.ixy ?? 0) + c.area * dx * dy;
  }

  return {
    combinedArea: totalArea,
    combinedIxx,
    combinedIyy,
    combinedIxy,
    centroidX,
    centroidY,
  };
}

// ─── Overlap Detection (SAT-based) ───────────────────────────────────────────

export interface Polygon2D {
  vertices: { x: number; y: number }[];
}

/**
 * Projects a polygon onto an axis and returns [min, max].
 */
function projectPolygon(poly: Polygon2D, axis: { x: number; y: number }): [number, number] {
  let min = Infinity, max = -Infinity;
  for (const v of poly.vertices) {
    const proj = v.x * axis.x + v.y * axis.y;
    if (proj < min) min = proj;
    if (proj > max) max = proj;
  }
  return [min, max];
}

/**
 * Checks if two intervals overlap.
 */
function intervalsOverlap(a: [number, number], b: [number, number]): boolean {
  return a[0] <= b[1] && b[0] <= a[1];
}

/**
 * Gets the edge normals (axes) for SAT from a polygon.
 */
function getAxes(poly: Polygon2D): { x: number; y: number }[] {
  const axes: { x: number; y: number }[] = [];
  const n = poly.vertices.length;
  for (let i = 0; i < n; i++) {
    const v1 = poly.vertices[i];
    const v2 = poly.vertices[(i + 1) % n];
    const edge = { x: v2.x - v1.x, y: v2.y - v1.y };
    // Normal (perpendicular)
    const len = Math.sqrt(edge.x * edge.x + edge.y * edge.y);
    if (len > 1e-10) {
      axes.push({ x: -edge.y / len, y: edge.x / len });
    }
  }
  return axes;
}

/**
 * Checks if two convex polygons overlap using the Separating Axis Theorem (SAT).
 * Returns true if they overlap, false if a separating axis exists.
 */
export function polygonsOverlap(polyA: Polygon2D, polyB: Polygon2D): boolean {
  const axes = [...getAxes(polyA), ...getAxes(polyB)];
  for (const axis of axes) {
    const projA = projectPolygon(polyA, axis);
    const projB = projectPolygon(polyB, axis);
    if (!intervalsOverlap(projA, projB)) {
      return false; // Separating axis found
    }
  }
  return true; // No separating axis → overlap
}

/**
 * Creates a rectangular polygon for a component at given offset.
 */
export function makeRectPolygon(
  width: number,
  height: number,
  offsetX: number,
  offsetY: number,
): Polygon2D {
  const hw = width / 2;
  const hh = height / 2;
  return {
    vertices: [
      { x: offsetX - hw, y: offsetY - hh },
      { x: offsetX + hw, y: offsetY - hh },
      { x: offsetX + hw, y: offsetY + hh },
      { x: offsetX - hw, y: offsetY + hh },
    ],
  };
}
