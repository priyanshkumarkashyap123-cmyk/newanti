/**
 * Geometry Utilities for Room Planner
 * 
 * Functions for:
 * - Door swing arc calculations
 * - Clearance/collision detection
 * - Grid snapping
 * - Bounding box operations
 */

import type { Door, FurnitureItem, Room, WalkPath, CLEARANCE_STANDARDS } from './types';

// ============================================
// POINT & DISTANCE OPERATIONS
// ============================================

export interface Point {
  x: number;
  y: number;
}

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface Circle {
  x: number;
  y: number;
  radius: number;
}

/**
 * Distance between two points (mm)
 */
export function distance(p1: Point, p2: Point): number {
  return Math.sqrt((p2.x - p1.x) ** 2 + (p2.y - p1.y) ** 2);
}

/**
 * Convert degrees to radians
 */
export function toRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

/**
 * Convert radians to degrees
 */
export function toDegrees(radians: number): number {
  return (radians * 180) / Math.PI;
}

// ============================================
// BOUNDING BOX OPERATIONS
// ============================================

/**
 * Get bounding box of a rectangle
 */
export function getBoundingBox(obj: Rect): Rect {
  return { ...obj };
}

/**
 * Get bounding box of rotated furniture
 */
export function getRotatedBoundingBox(furniture: FurnitureItem): Rect {
  const angle = toRadians(furniture.rotation || 0);
  const cos = Math.abs(Math.cos(angle));
  const sin = Math.abs(Math.sin(angle));

  const newWidth = furniture.width * cos + furniture.depth * sin;
  const newHeight = furniture.width * sin + furniture.depth * cos;

  return {
    x: furniture.x - newWidth / 2,
    y: furniture.y - newHeight / 2,
    width: newWidth,
    height: newHeight,
  };
}

/**
 * Check if two rectangles overlap (with optional buffer/clearance)
 */
export function rectsOverlap(rect1: Rect, rect2: Rect, buffer: number = 0): boolean {
  return (
    rect1.x - buffer < rect2.x + rect2.width + buffer &&
    rect1.x + rect1.width + buffer > rect2.x - buffer &&
    rect1.y - buffer < rect2.y + rect2.height + buffer &&
    rect1.y + rect1.height + buffer > rect2.y - buffer
  );
}

/**
 * Check if point is inside rectangle
 */
export function pointInRect(point: Point, rect: Rect): boolean {
  return (
    point.x >= rect.x &&
    point.x <= rect.x + rect.width &&
    point.y >= rect.y &&
    point.y <= rect.y + rect.height
  );
}

/**
 * Check if point is inside circle
 */
export function pointInCircle(point: Point, circle: Circle): boolean {
  return distance(point, { x: circle.x, y: circle.y }) <= circle.radius;
}

// ============================================
// DOOR SWING ARC GEOMETRY
// ============================================

/**
 * Calculate door swing arc geometry
 * Returns the swing zone that should be clear of obstacles
 * 
 * @param door Door object with position, width, wallSide, swingDirection
 * @param swingAngle Angle of door swing in degrees (default 120°)
 * @returns Polygon points representing swing arc
 */
export function getDoorSwingArc(
  door: Door,
  swingAngle: number = 120
): Point[] {
  const DOOR_REACH_MM = 900; // How far the door extends into room

  let startAngle = 0;
  let endAngle = swingAngle;
  let centerX = door.x;
  let centerY = door.y;

  // Adjust based on wall side and swing direction
  if (door.wallSide === 'top') {
    centerY = door.y + door.height / 2;
    if (door.swingDirection === 'left') {
      startAngle = -90;
      endAngle = -90 + swingAngle;
    } else {
      startAngle = -90 - swingAngle;
      endAngle = -90;
    }
  } else if (door.wallSide === 'bottom') {
    centerY = door.y - door.height / 2;
    if (door.swingDirection === 'left') {
      startAngle = 90;
      endAngle = 90 + swingAngle;
    } else {
      startAngle = 90 - swingAngle;
      endAngle = 90;
    }
  } else if (door.wallSide === 'left') {
    centerX = door.x + door.width / 2;
    if (door.swingDirection === 'left') {
      startAngle = 0;
      endAngle = swingAngle;
    } else {
      startAngle = -swingAngle;
      endAngle = 0;
    }
  } else if (door.wallSide === 'right') {
    centerX = door.x - door.width / 2;
    if (door.swingDirection === 'left') {
      startAngle = 180;
      endAngle = 180 + swingAngle;
    } else {
      startAngle = 180 - swingAngle;
      endAngle = 180;
    }
  }

  // Generate arc points (16 segments for smooth arc)
  const arcPoints: Point[] = [];
  const segments = 16;

  for (let i = 0; i <= segments; i++) {
    const angle = toRadians(startAngle + (i / segments) * (endAngle - startAngle));
    arcPoints.push({
      x: centerX + DOOR_REACH_MM * Math.cos(angle),
      y: centerY + DOOR_REACH_MM * Math.sin(angle),
    });
  }

  // Add hinge point
  arcPoints.unshift({ x: centerX, y: centerY });

  return arcPoints;
}

/**
 * Check if furniture blocks door swing
 */
export function furnitureBlocksDoor(
  furniture: FurnitureItem,
  door: Door,
  swingAngle: number = 120,
  clearanceBuffer: number = 200
): boolean {
  const swingArc = getDoorSwingArc(door, swingAngle);
  const furnBounds = getRotatedBoundingBox(furniture);

  // Check if any swing arc point is inside furniture with buffer
  return swingArc.some((arcPoint) => {
    return rectsOverlap(
      { x: arcPoint.x, y: arcPoint.y, width: 0, height: 0 },
      furnBounds,
      clearanceBuffer
    );
  });
}

// ============================================
// WALKPATH & CIRCULATION
// ============================================

/**
 * Check if walkpath has minimum clearance width
 */
export function validateWalkPathWidth(
  path: WalkPath,
  minWidth: number = 750
): boolean {
  return path.width >= minWidth;
}

/**
 * Calculate if two walkpaths connect
 */
export function walkPathsConnected(path1: WalkPath, path2: WalkPath, tolerance: number = 100): boolean {
  if (path1.points.length === 0 || path2.points.length === 0) return false;

  const path1Start = path1.points[0];
  const path1End = path1.points[path1.points.length - 1];
  const path2Start = path2.points[0];
  const path2End = path2.points[path2.points.length - 1];

  return (
    distance(path1End, path2Start) <= tolerance ||
    distance(path1End, path2End) <= tolerance ||
    distance(path1Start, path2Start) <= tolerance ||
    distance(path1Start, path2End) <= tolerance
  );
}

// ============================================
// SNAPPING LOGIC
// ============================================

/**
 * Snap point to grid
 */
export function snapToGrid(point: Point, gridSpacing: number): Point {
  if (gridSpacing === 0) return point;

  return {
    x: Math.round(point.x / gridSpacing) * gridSpacing,
    y: Math.round(point.y / gridSpacing) * gridSpacing,
  };
}

/**
 * Snap point to nearest wall
 */
export function snapToWall(
  point: Point,
  room: Room,
  snapDistance: number = 100
): Point | null {
  const left = room.x;
  const right = room.x + room.width;
  const top = room.y;
  const bottom = room.y + room.height;

  let snappedPoint: Point | null = null;
  let minDist = snapDistance;

  // Check snap to left wall
  if (Math.abs(point.x - left) < minDist) {
    snappedPoint = { x: left, y: point.y };
    minDist = Math.abs(point.x - left);
  }

  // Check snap to right wall
  if (Math.abs(point.x - right) < minDist) {
    snappedPoint = { x: right, y: point.y };
    minDist = Math.abs(point.x - right);
  }

  // Check snap to top wall
  if (Math.abs(point.y - top) < minDist) {
    snappedPoint = { x: point.x, y: top };
    minDist = Math.abs(point.y - top);
  }

  // Check snap to bottom wall
  if (Math.abs(point.y - bottom) < minDist) {
    snappedPoint = { x: point.x, y: bottom };
  }

  return snappedPoint;
}

/**
 * Snap furniture to room bounds
 */
export function snapFurnitureToRoom(
  furniture: FurnitureItem,
  room: Room,
  wallClearance: number = 100
): FurnitureItem {
  const maxX = room.x + room.width - wallClearance - furniture.width / 2;
  const maxY = room.y + room.height - wallClearance - furniture.depth / 2;
  const minX = room.x + wallClearance + furniture.width / 2;
  const minY = room.y + wallClearance + furniture.depth / 2;

  return {
    ...furniture,
    x: Math.max(minX, Math.min(furniture.x, maxX)),
    y: Math.max(minY, Math.min(furniture.y, maxY)),
  };
}

// ============================================
// CLEARANCE VALIDATION
// ============================================

/**
 * Get clearance zone around an object
 */
export function getClearanceZone(obj: Rect, distance: number): Rect {
  return {
    x: obj.x - distance,
    y: obj.y - distance,
    width: obj.width + 2 * distance,
    height: obj.height + 2 * distance,
  };
}

/**
 * Check minimum furniture clearances
 */
export function validateFurnitureClearance(
  furniture: FurnitureItem,
  allFurniture: FurnitureItem[],
  minClearance: number = 150
): boolean {
  const furnBounds = getRotatedBoundingBox(furniture);

  // Check distance from other furniture
  for (const other of allFurniture) {
    if (other.id === furniture.id) continue;
    const otherBounds = getRotatedBoundingBox(other);
    if (rectsOverlap(furnBounds, otherBounds, minClearance)) {
      return false;
    }
  }

  return true;
}

/**
 * Check if furniture is properly accessible (e.g., bed access on 3 sides)
 */
export function validateBedAccessibility(
  furniture: FurnitureItem,
  allFurniture: FurnitureItem[],
  minAccessClearance: number = 800
): boolean {
  if (furniture.type !== 'single_bed' && furniture.type !== 'double_bed') {
    return true; // Not a bed
  }

  const furnBounds = getRotatedBoundingBox(furniture);
  const accessZone = getClearanceZone(furnBounds, minAccessClearance);

  // Check if at least 3 sides have clearance
  let clearSides = 0;

  // Check each side
  const sides = [
    { x: furnBounds.x - minAccessClearance, y: furnBounds.y, width: minAccessClearance, height: furnBounds.height },
    { x: furnBounds.x + furnBounds.width, y: furnBounds.y, width: minAccessClearance, height: furnBounds.height },
    { x: furnBounds.x, y: furnBounds.y - minAccessClearance, width: furnBounds.width, height: minAccessClearance },
    { x: furnBounds.x, y: furnBounds.y + furnBounds.height, width: furnBounds.width, height: minAccessClearance },
  ];

  for (const side of sides) {
    let blocked = false;
    for (const other of allFurniture) {
      if (other.id === furniture.id) continue;
      const otherBounds = getRotatedBoundingBox(other);
      if (rectsOverlap(side, otherBounds)) {
        blocked = true;
        break;
      }
    }
    if (!blocked) clearSides++;
  }

  return clearSides >= 3;
}

// ============================================
// CANVAS COORDINATE TRANSFORMS
// ============================================

/**
 * Convert world coordinates (mm) to canvas coordinates (pixels)
 */
export function worldToCanvas(
  worldPoint: Point,
  canvasScale: number = 1, // pixels per mm
  panX: number = 0,
  panY: number = 0
): Point {
  return {
    x: worldPoint.x * canvasScale + panX,
    y: worldPoint.y * canvasScale + panY,
  };
}

/**
 * Convert canvas coordinates (pixels) to world coordinates (mm)
 */
export function canvasToWorld(
  canvasPoint: Point,
  canvasScale: number = 1,
  panX: number = 0,
  panY: number = 0
): Point {
  return {
    x: (canvasPoint.x - panX) / canvasScale,
    y: (canvasPoint.y - panY) / canvasScale,
  };
}

/**
 * Format dimensions for display (mm → m or cm as appropriate)
 */
export function formatDimension(mm: number): string {
  if (mm >= 1000) {
    return `${(mm / 1000).toFixed(2)} m`;
  } else if (mm >= 100) {
    return `${(mm / 100).toFixed(1)} cm`;
  } else {
    return `${mm} mm`;
  }
}

// ============================================
// POLYGON OPERATIONS
// ============================================

/**
 * Check if point is inside polygon (ray casting algorithm)
 */
export function pointInPolygon(point: Point, polygon: Point[]): boolean {
  let inside = false;

  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const pi = polygon[i];
    const pj = polygon[j];

    if (
      (pi.y > point.y) !== (pj.y > point.y) &&
      point.x < ((pj.x - pi.x) * (point.y - pi.y)) / (pj.y - pi.y) + pi.x
    ) {
      inside = !inside;
    }
  }

  return inside;
}

/**
 * Deflate/expand polygon by distance (used for clearance zones)
 */
export function deflatePolygon(polygon: Point[], distance: number): Point[] {
  if (polygon.length < 3) return polygon;

  const result: Point[] = [];
  const len = polygon.length;

  for (let i = 0; i < len; i++) {
    const a = polygon[i];
    const b = polygon[(i + 1) % len];
    const c = polygon[(i + 2) % len];

    const ab = { x: b.x - a.x, y: b.y - a.y };
    const bc = { x: c.x - b.x, y: c.y - b.y };

    const abLen = Math.sqrt(ab.x ** 2 + ab.y ** 2);
    const bcLen = Math.sqrt(bc.x ** 2 + bc.y ** 2);

    const abNorm = { x: -ab.y / abLen, y: ab.x / abLen };
    const bcNorm = { x: -bc.y / bcLen, y: bc.x / bcLen };

    const avgNorm = {
      x: (abNorm.x + bcNorm.x) / 2,
      y: (abNorm.y + bcNorm.y) / 2,
    };

    result.push({
      x: b.x + avgNorm.x * distance,
      y: b.y + avgNorm.y * distance,
    });
  }

  return result;
}
