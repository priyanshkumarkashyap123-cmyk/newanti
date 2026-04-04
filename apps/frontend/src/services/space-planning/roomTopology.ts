export type RoomRect = { x: number; y: number; width: number; height: number };
export type BoundsRect = { x: number; y: number; w: number; h: number };

/** Finds which room sides touch the outer buildable boundary. */
export function getExternalSides(room: RoomRect, bounds: BoundsRect): Set<'N' | 'S' | 'E' | 'W'> {
  const sides = new Set<'N' | 'S' | 'E' | 'W'>();
  const EPS = 0.15;
  if (Math.abs(room.y - bounds.y) < EPS) sides.add('S');
  if (Math.abs(room.y + room.height - (bounds.y + bounds.h)) < EPS) sides.add('N');
  if (Math.abs(room.x - bounds.x) < EPS) sides.add('W');
  if (Math.abs(room.x + room.width - (bounds.x + bounds.w)) < EPS) sides.add('E');
  return sides;
}

/** Returns the wall side of room that is shared with neighbor, if any. */
export function getSharedWallSide(
  room: RoomRect,
  neighbor: RoomRect,
): 'N' | 'S' | 'E' | 'W' | null {
  const EPS = 0.15;
  const overlapX =
    Math.min(room.x + room.width, neighbor.x + neighbor.width) - Math.max(room.x, neighbor.x);
  const overlapY =
    Math.min(room.y + room.height, neighbor.y + neighbor.height) - Math.max(room.y, neighbor.y);

  if (overlapX > 0.5) {
    if (Math.abs(room.y - (neighbor.y + neighbor.height)) < EPS) return 'S';
    if (Math.abs(room.y + room.height - neighbor.y) < EPS) return 'N';
  }
  if (overlapY > 0.5) {
    if (Math.abs(room.x - (neighbor.x + neighbor.width)) < EPS) return 'W';
    if (Math.abs(room.x + room.width - neighbor.x) < EPS) return 'E';
  }
  return null;
}

/** True when two rooms share a wall edge (not just a corner). */
export function sharesWall(a: RoomRect, b: RoomRect): boolean {
  return getSharedWallSide(a, b) !== null;
}