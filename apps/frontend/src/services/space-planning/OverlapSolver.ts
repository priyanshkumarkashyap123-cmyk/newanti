import {
  PlacedRoom,
  SetbackRequirements,
  PlotDimensions,
  RoomSpec,
  ColumnSpec,
} from './types';

/**
 * Clamps a single room to the buildable envelope.
 * Returns the clamped room and whether any correction was applied.
 */
export function clampToEnvelope(
  room: PlacedRoom,
  setbacks: SetbackRequirements,
  plot: PlotDimensions
): { room: PlacedRoom; corrected: boolean; deltaX: number; deltaY: number } {
  const minX = setbacks.left;
  const maxX = plot.width - setbacks.right - room.width;
  const minY = setbacks.front;
  const maxY = plot.depth - setbacks.rear - room.height;

  const clampedX = Math.max(minX, Math.min(maxX, room.x));
  const clampedY = Math.max(minY, Math.min(maxY, room.y));

  const deltaX = clampedX - room.x;
  const deltaY = clampedY - room.y;
  const corrected = deltaX !== 0 || deltaY !== 0;

  if (corrected && process.env.NODE_ENV !== 'production') {
    console.warn(`[SpacePlanningEngine] clampToEnvelope: room ${room.id} corrected by (${deltaX.toFixed(3)}, ${deltaY.toFixed(3)})`);
  }

  return {
    room: { ...room, x: clampedX, y: clampedY },
    corrected,
    deltaX,
    deltaY,
  };
}

/**
 * Detects all overlapping room pairs (AABB intersection area > 0.01 m²).
 * Returns pairs sorted by penetration depth descending.
 */
export function detectOverlaps(
  rooms: PlacedRoom[]
): Array<{ a: PlacedRoom; b: PlacedRoom; overlapArea: number; penetrationX: number; penetrationY: number }> {
  const results: Array<{ a: PlacedRoom; b: PlacedRoom; overlapArea: number; penetrationX: number; penetrationY: number }> = [];
  for (let i = 0; i < rooms.length; i++) {
    for (let j = i + 1; j < rooms.length; j++) {
      const a = rooms[i];
      const b = rooms[j];
      const overlapX = Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x);
      const overlapY = Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y);
      if (overlapX > 0 && overlapY > 0) {
        const overlapArea = overlapX * overlapY;
        if (overlapArea > 0.01) {
          results.push({ a, b, overlapArea, penetrationX: overlapX, penetrationY: overlapY });
        }
      }
    }
  }
  // Sort by penetration depth descending (use max of X/Y penetration)
  results.sort((x, y) => Math.max(y.penetrationX, y.penetrationY) - Math.max(x.penetrationX, x.penetrationY));
  return results;
}

const PRIORITY_ORDER: Record<string, number> = {
  essential: 1,
  important: 2,
  desirable: 3,
  optional: 4,
};

/**
 * Resolves overlaps by translating the lower-priority room along the
 * axis of minimum penetration depth. Mutates rooms in place.
 * Priority order: essential > important > desirable > optional.
 * Returns the number of overlaps resolved.
 */
export function resolveOverlaps(
  rooms: PlacedRoom[],
  setbacks: SetbackRequirements,
  plot: PlotDimensions,
  maxPasses: number = 10
): number {
  let totalResolved = 0;
  for (let pass = 0; pass < maxPasses; pass++) {
    const overlaps = detectOverlaps(rooms);
    if (overlaps.length === 0) break;
    let resolvedThisPass = 0;
    for (const overlap of overlaps) {
      const { a, b, penetrationX, penetrationY } = overlap;
      // Determine which room to move (lower priority = higher number = gets moved)
      const priorityA = PRIORITY_ORDER[a.spec.priority] ?? 2;
      const priorityB = PRIORITY_ORDER[b.spec.priority] ?? 2;
      const roomToMove = priorityA >= priorityB ? a : b;
      const roomToStay = priorityA >= priorityB ? b : a;
      // Move along axis of minimum penetration
      const idx = rooms.indexOf(roomToMove);
      if (idx === -1) continue;
      if (penetrationX <= penetrationY) {
        // Move along X
        const moveRight = roomToMove.x < roomToStay.x;
        rooms[idx] = { ...rooms[idx], x: moveRight ? roomToStay.x + roomToStay.width : roomToStay.x - roomToMove.width };
      } else {
        // Move along Y
        const moveDown = roomToMove.y < roomToStay.y;
        rooms[idx] = { ...rooms[idx], y: moveDown ? roomToStay.y + roomToStay.height : roomToStay.y - roomToMove.height };
      }
      // Clamp to envelope after moving
      const clamped = clampToEnvelope(rooms[idx], setbacks, plot);
      rooms[idx] = clamped.room;
      resolvedThisPass++;
    }
    totalResolved += resolvedThisPass;
    if (resolvedThisPass === 0) break;
  }
  return totalResolved;
}

/**
 * Computes the shared wall length between two axis-aligned rectangles.
 */
export function computeSharedWallLength(
  a: { x: number; y: number; width: number; height: number },
  b: { x: number; y: number; width: number; height: number }
): number {
  // Check horizontal shared wall (top of a = bottom of b, or vice versa)
  if (Math.abs((a.y + a.height) - b.y) < 0.01 || Math.abs((b.y + b.height) - a.y) < 0.01) {
    const overlapX = Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x);
    if (overlapX > 0) return overlapX;
  }
  // Check vertical shared wall (right of a = left of b, or vice versa)
  if (Math.abs((a.x + a.width) - b.x) < 0.01 || Math.abs((b.x + b.width) - a.x) < 0.01) {
    const overlapY = Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y);
    if (overlapY > 0) return overlapY;
  }
  return 0;
}

/**
 * Computes the adjacency score for a candidate position.
 * Score = Σ shared-wall-length with adjacentTo rooms
 *       - Σ shared-wall-length with awayFrom rooms
 */
export function computeAdjacencyScore(
  candidate: { x: number; y: number; width: number; height: number },
  spec: RoomSpec,
  placedRooms: PlacedRoom[]
): number {
  const hasAdjacency = spec.adjacentTo && spec.adjacentTo.length > 0;
  const hasAvoidance = spec.awayFrom && spec.awayFrom.length > 0;
  if (!hasAdjacency && !hasAvoidance) return 0;

  let score = 0;

  for (const placed of placedRooms) {
    const sharedWall = computeSharedWallLength(candidate, placed);

    // Positive contribution for adjacency requirements
    if (hasAdjacency && spec.adjacentTo!.includes(placed.spec.type)) {
      score += sharedWall;
    }

    // Negative contribution for avoidance requirements
    if (hasAvoidance && spec.awayFrom!.includes(placed.spec.type)) {
      // Penalize more aggressively if overlap exists (shared wall > 0)
      score -= sharedWall > 0 ? sharedWall * 2 : sharedWall;
    }
  }

  return score;
}

/**
 * Snaps each column to the nearest room corner within tolerance.
 * Returns updated columns (does not mutate input).
 */
export function snapColumnsToRoomCorners(
  columns: ColumnSpec[],
  rooms: PlacedRoom[],
  tolerance: number = 0.15
): ColumnSpec[] {
  // Collect all room corners
  const corners: { x: number; y: number }[] = [];
  for (const room of rooms) {
    corners.push(
      { x: room.x, y: room.y },
      { x: room.x + room.width, y: room.y },
      { x: room.x, y: room.y + room.height },
      { x: room.x + room.width, y: room.y + room.height }
    );
  }
  return columns.map((col) => {
    let bestDist = Infinity;
    let bestCorner = { x: col.x, y: col.y };
    for (const corner of corners) {
      const dist = Math.sqrt((col.x - corner.x) ** 2 + (col.y - corner.y) ** 2);
      if (dist < bestDist) {
        bestDist = dist;
        bestCorner = corner;
      }
    }
    if (bestDist <= tolerance) {
      return { ...col, x: bestCorner.x, y: bestCorner.y };
    }
    return col;
  });
}

/**
 * Returns 0–100: percentage of room corners that have a column within tolerance.
 */
export function computeGridAlignmentScore(
  columns: ColumnSpec[],
  rooms: PlacedRoom[],
  tolerance: number = 0.15
): number {
  if (rooms.length === 0) return 100;
  const corners: { x: number; y: number }[] = [];
  for (const room of rooms) {
    corners.push(
      { x: room.x, y: room.y },
      { x: room.x + room.width, y: room.y },
      { x: room.x, y: room.y + room.height },
      { x: room.x + room.width, y: room.y + room.height }
    );
  }
  if (corners.length === 0) return 100;
  let covered = 0;
  for (const corner of corners) {
    for (const col of columns) {
      const dist = Math.sqrt((col.x - corner.x) ** 2 + (col.y - corner.y) ** 2);
      if (dist <= tolerance) {
        covered++;
        break;
      }
    }
  }
  return (covered / corners.length) * 100;
}
