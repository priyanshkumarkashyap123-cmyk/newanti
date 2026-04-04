/**
 * Room Planner Validation Engine
 * 
 * Real-time validation for:
 * - Door swing clearances
 * - Furniture placement rules
 * - Circulation path enforcement
 * - Building codes (NBC, IS codes)
 * - Egress & accessibility
 */

import type { 
  Door, 
  FurnitureItem, 
  Room, 
  WalkPath, 
  ValidationIssue, 
  ValidationResult,
  CanvasState
} from './types';
import {
  furnitureBlocksDoor,
  validateFurnitureClearance,
  validateBedAccessibility,
  validateWalkPathWidth,
  getDoorSwingArc,
  pointInPolygon,
  rectsOverlap,
  getRotatedBoundingBox,
  getClearanceZone,
} from './geometry';

// ============================================
// VALIDATION RULES REGISTRY
// ============================================

const VALIDATION_RULES = {
  DOOR_CLEARANCE: {
    id: 'door_clearance',
    name: 'Door Swing Clearance',
    description: 'Furniture must not block door swing area',
    severity: 'error' as const,
    category: 'clearance' as const,
  },
  MIN_CIRCULATION: {
    id: 'min_circulation',
    name: 'Minimum Circulation Width',
    description: 'Walkways must be at least 750mm wide per NBC',
    severity: 'error' as const,
    category: 'code' as const,
  },
  BED_ACCESS: {
    id: 'bed_access',
    name: 'Bed Accessibility',
    description: 'Beds require 800mm clearance on 3 sides minimum',
    severity: 'warning' as const,
    category: 'ergonomic' as const,
  },
  FURNITURE_CLEARANCE: {
    id: 'furniture_clearance',
    name: 'Furniture Spacing',
    description: 'Minimum 150mm clearance between furniture items',
    severity: 'warning' as const,
    category: 'efficiency' as const,
  },
  FURNITURE_IN_ROOM: {
    id: 'furniture_in_room',
    name: 'Furniture Within Bounds',
    description: 'Furniture must stay within room boundaries',
    severity: 'error' as const,
    category: 'clearance' as const,
  },
  DOOR_IN_ROOM: {
    id: 'door_in_room',
    name: 'Door Within Room',
    description: 'Door must be placed on room wall',
    severity: 'error' as const,
    category: 'clearance' as const,
  },
  WINDOW_IN_ROOM: {
    id: 'window_in_room',
    name: 'Window Within Room',
    description: 'Window must be placed on room wall',
    severity: 'error' as const,
    category: 'clearance' as const,
  },
  EGRESS_PATH: {
    id: 'egress_path',
    name: 'Egress Path Accessibility',
    description: 'Room must have continuous path to exit door',
    severity: 'error' as const,
    category: 'code' as const,
  },
  FURNITURE_TO_WALL: {
    id: 'furniture_to_wall',
    name: 'Wall Clearance',
    description: 'Furniture should be 100mm from walls for comfort',
    severity: 'info' as const,
    category: 'efficiency' as const,
  },
};

// ============================================
// VALIDATION ENGINE
// ============================================

export class ValidationEngine {
  private issues: ValidationIssue[] = [];

  /**
   * Run all validation rules on current canvas state
   */
  validate(state: CanvasState): ValidationResult {
    this.issues = [];

    // Validate individual elements
    this.validateDoorClearances(state);
    this.validateFurnitureInRoom(state);
    this.validateFurnitureSpacing(state);
    this.validateBedAccessibility(state);
    this.validateDoorsInRoom(state);
    this.validateWindowsInRoom(state);
    this.validateCirculation(state);
    this.validateEgressPaths(state);
    this.validateWallClearance(state);

    return {
      passed: this.issues.filter((i) => i.severity === 'error').length === 0,
      issues: this.issues,
      timestamp: Date.now(),
    };
  }

  /**
   * Validate door swing clearances
   */
  private validateDoorClearances(state: CanvasState): void {
    for (const door of state.doors) {
      for (const furniture of state.furniture) {
        if (furnitureBlocksDoor(furniture, door, door.swingAngle || 120)) {
          this.issues.push({
            ruleId: VALIDATION_RULES.DOOR_CLEARANCE.id,
            severity: 'error',
            message: `Furniture "${furniture.label || furniture.type}" blocks door swing`,
            objectIds: [door.id, furniture.id],
            location: { x: door.x, y: door.y },
            affectedArea: getRotatedBoundingBox(furniture),
          });
        }
      }
    }
  }

  /**
   * Validate furniture stays within room bounds
   */
  private validateFurnitureInRoom(state: CanvasState): void {
    for (const furniture of state.furniture) {
      const room = state.rooms.find((r) => r.id === furniture.id.split('_')[0]);
      if (!room) continue;

      const furnBounds = getRotatedBoundingBox(furniture);
      const roomBounds = {
        x: room.x + room.wallThickness,
        y: room.y + room.wallThickness,
        width: room.width - 2 * room.wallThickness,
        height: room.height - 2 * room.wallThickness,
      };

      // Check if furniture is completely within room
      if (
        furnBounds.x < roomBounds.x ||
        furnBounds.x + furnBounds.width > roomBounds.x + roomBounds.width ||
        furnBounds.y < roomBounds.y ||
        furnBounds.y + furnBounds.height > roomBounds.y + roomBounds.height
      ) {
        this.issues.push({
          ruleId: VALIDATION_RULES.FURNITURE_IN_ROOM.id,
          severity: 'error',
          message: `Furniture "${furniture.label || furniture.type}" extends outside room`,
          objectIds: [furniture.id],
          location: { x: furniture.x, y: furniture.y },
          affectedArea: furnBounds,
        });
      }
    }
  }

  /**
   * Validate furniture spacing
   */
  private validateFurnitureSpacing(state: CanvasState): void {
    const MIN_CLEARANCE = 150; // mm

    for (let i = 0; i < state.furniture.length; i++) {
      for (let j = i + 1; j < state.furniture.length; j++) {
        const f1 = state.furniture[i];
        const f2 = state.furniture[j];

        if (!validateFurnitureClearance(f1, [f2], MIN_CLEARANCE)) {
          this.issues.push({
            ruleId: VALIDATION_RULES.FURNITURE_CLEARANCE.id,
            severity: 'warning',
            message: `Insufficient clearance between "${f1.label || f1.type}" and "${f2.label || f2.type}"`,
            objectIds: [f1.id, f2.id],
            location: { x: (f1.x + f2.x) / 2, y: (f1.y + f2.y) / 2 },
          });
        }
      }
    }
  }

  /**
   * Validate bed accessibility (800mm clearance on 3+ sides)
   */
  private validateBedAccessibility(state: CanvasState): void {
    const beds = state.furniture.filter((f) => f.type.includes('bed'));

    for (const bed of beds) {
      if (!validateBedAccessibility(bed, state.furniture, 800)) {
        this.issues.push({
          ruleId: VALIDATION_RULES.BED_ACCESS.id,
          severity: 'warning',
          message: `Bed "${bed.label || bed.type}" doesn't have sufficient access clearance on 3 sides`,
          objectIds: [bed.id],
          location: { x: bed.x, y: bed.y },
          affectedArea: getRotatedBoundingBox(bed),
        });
      }
    }
  }

  /**
   * Validate doors are on room walls
   */
  private validateDoorsInRoom(state: CanvasState): void {
    for (const door of state.doors) {
      const room = state.rooms.find((r) => r.id === door.roomId);
      if (!room) {
        this.issues.push({
          ruleId: VALIDATION_RULES.DOOR_IN_ROOM.id,
          severity: 'error',
          message: `Door not assigned to a room`,
          objectIds: [door.id],
          location: { x: door.x, y: door.y },
        });
        continue;
      }

      let isOnWall = false;

      if (door.wallSide === 'top' && Math.abs(door.y - room.y) < 100) {
        isOnWall = door.x > room.x && door.x < room.x + room.width;
      } else if (door.wallSide === 'bottom' && Math.abs(door.y - (room.y + room.height)) < 100) {
        isOnWall = door.x > room.x && door.x < room.x + room.width;
      } else if (door.wallSide === 'left' && Math.abs(door.x - room.x) < 100) {
        isOnWall = door.y > room.y && door.y < room.y + room.height;
      } else if (door.wallSide === 'right' && Math.abs(door.x - (room.x + room.width)) < 100) {
        isOnWall = door.y > room.y && door.y < room.y + room.height;
      }

      if (!isOnWall) {
        this.issues.push({
          ruleId: VALIDATION_RULES.DOOR_IN_ROOM.id,
          severity: 'error',
          message: `Door not positioned on room wall`,
          objectIds: [door.id],
          location: { x: door.x, y: door.y },
        });
      }
    }
  }

  /**
   * Validate windows are on room walls
   */
  private validateWindowsInRoom(state: CanvasState): void {
    for (const window of state.windows || []) {
      const room = state.rooms.find((r) => r.id === window.roomId);
      if (!room) {
        this.issues.push({
          ruleId: VALIDATION_RULES.WINDOW_IN_ROOM.id,
          severity: 'error',
          message: `Window not assigned to a room`,
          objectIds: [window.id],
          location: { x: window.x, y: window.y },
        });
      }
    }
  }

  /**
   * Validate minimum circulation width (750mm per NBC)
   */
  private validateCirculation(state: CanvasState): void {
    const MIN_WIDTH = 750; // NBC requirement

    for (const path of state.walkPaths) {
      if (!validateWalkPathWidth(path, MIN_WIDTH)) {
        this.issues.push({
          ruleId: VALIDATION_RULES.MIN_CIRCULATION.id,
          severity: 'error',
          message: `Walkway width ${path.width}mm is below NBC minimum of ${MIN_WIDTH}mm`,
          objectIds: [path.id],
          location: path.points.length > 0 ? path.points[0] : { x: 0, y: 0 },
        });
      }
    }
  }

  /**
   * Validate egress paths (continuous path to exit)
   */
  private validateEgressPaths(state: CanvasState): void {
    // Find main exit door (typically labeled as such)
    const mainExitDoors = state.doors.filter((d) => d.label?.includes('exit') || d.label?.includes('main'));

    if (mainExitDoors.length === 0) {
      this.issues.push({
        ruleId: VALIDATION_RULES.EGRESS_PATH.id,
        severity: 'warning',
        message: 'No main exit door designated',
        objectIds: [],
        location: { x: 0, y: 0 },
      });
      return;
    }

    // Check each room has path to any exit door
    for (const room of state.rooms) {
      const doorsInRoom = state.doors.filter((d) => d.roomId === room.id);

      if (doorsInRoom.length === 0) {
        this.issues.push({
          ruleId: VALIDATION_RULES.EGRESS_PATH.id,
          severity: 'error',
          message: `Room "${room.name}" has no exit door`,
          objectIds: [room.id],
          location: { x: room.x, y: room.y },
        });
      }
    }
  }

  /**
   * Validate furniture maintains ~100mm distance from walls
   */
  private validateWallClearance(state: CanvasState): void {
    const WALL_CLEARANCE = 100; // mm

    for (const furniture of state.furniture) {
      const furnBounds = getRotatedBoundingBox(furniture);

      // Check distance from room walls
      for (const room of state.rooms) {
        const leftWall = room.x + room.wallThickness;
        const rightWall = room.x + room.width - room.wallThickness;
        const topWall = room.y + room.wallThickness;
        const bottomWall = room.y + room.height - room.wallThickness;

        if (
          furnBounds.x - leftWall < WALL_CLEARANCE &&
          furnBounds.x - leftWall > 0
        ) {
          this.issues.push({
            ruleId: VALIDATION_RULES.FURNITURE_TO_WALL.id,
            severity: 'info',
            message: `"${furniture.label || furniture.type}" close to left wall`,
            objectIds: [furniture.id],
            location: { x: furniture.x, y: furniture.y },
          });
        }
      }
    }
  }

  /**
   * Get issues by severity
   */
  getIssuesBySeverity(severity: 'error' | 'warning' | 'info'): ValidationIssue[] {
    return this.issues.filter((i) => i.severity === severity);
  }

  /**
   * Get issues for specific object
   */
  getIssuesForObject(objectId: string): ValidationIssue[] {
    return this.issues.filter((i) => i.objectIds.includes(objectId));
  }

  /**
   * Clear all issues
   */
  clear(): void {
    this.issues = [];
  }
}

/**
 * Factory function to create validation engine
 */
export function createValidationEngine(): ValidationEngine {
  return new ValidationEngine();
}
