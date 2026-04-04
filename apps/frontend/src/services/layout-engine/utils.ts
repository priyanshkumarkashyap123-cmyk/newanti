/**
 * Utility functions for the layout engine
 * Validators, helpers, and configuration builders
 */

import type { Rectangle, Room, LayoutConfig, LayoutSolution } from './types';

// ============================================================================
// VALIDATION
// ============================================================================


/**
 * Validates room configuration for feasibility
 */
export function validateRoomConfiguration(
  rooms: Room[],
  siteDimensions: { width: number; length: number },
): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  // Check total area
  const totalRoomArea = rooms.reduce((sum, r) => sum + r.targetArea, 0);
  const siteArea = siteDimensions.width * siteDimensions.length;

  if (totalRoomArea > siteArea * 1.2) {
    errors.push(
      `Total room area (${totalRoomArea.toFixed(1)}m²) exceeds site area (${siteArea.toFixed(1)}m²)`,
    );
  }

  // Check individual room feasibility
  for (const room of rooms) {
    // Min width feasibility
    if (room.minWidth > siteDimensions.width || room.minWidth > siteDimensions.length) {
      errors.push(
        `Room "${room.name}" minWidth (${room.minWidth}m) exceeds site dimensions`,
      );
    }

    // Aspect ratio feasibility
    const theoreticalMinHeight = room.minWidth / room.maxAspectRatio;
    const theoreticalMinArea = room.minWidth * theoreticalMinHeight;

    if (theoreticalMinArea > siteArea) {
      errors.push(
        `Room "${room.name}" minimum area (${theoreticalMinArea.toFixed(1)}m²) exceeds site area`,
      );
    }

    // Target area validation
    if (room.targetArea <= 0) {
      errors.push(`Room "${room.name}" targetArea must be positive`);
    }

    if (room.minWidth <= 0) {
      errors.push(`Room "${room.name}" minWidth must be positive`);
    }

    if (room.maxAspectRatio <= 0) {
      errors.push(`Room "${room.name}" maxAspectRatio must be positive`);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Validates solution for constraint compliance
 */
export function validateSolution(
  solution: LayoutSolution,
  rooms: Room[],
  siteDimensions: { width: number; length: number },
): {
  valid: boolean;
  violations: string[];
} {
  const violations: string[] = [];

  for (const room of rooms) {
    const rect = solution.rooms.get(room.id);
    if (!rect) {
      violations.push(`Room "${room.name}" not found in solution`);
      continue;
    }

    // Boundary check
    if (
      rect.x < 0 ||
      rect.y < 0 ||
      rect.x + rect.width > siteDimensions.width ||
      rect.y + rect.height > siteDimensions.length
    ) {
      violations.push(`Room "${room.name}" exceeds site boundaries`);
    }

    // Min width check
    if (rect.width < room.minWidth * 0.99) {
      // Allow 1% tolerance for floating point
      violations.push(
        `Room "${room.name}" width (${rect.width.toFixed(1)}m) below minimum (${room.minWidth}m)`,
      );
    }

    // Aspect ratio check
    const aspectRatio = rect.width / rect.height;
    const minAspect = room.minAspectRatio ?? 1 / room.maxAspectRatio;

    if (aspectRatio < minAspect * 0.99 || aspectRatio > room.maxAspectRatio * 1.01) {
      violations.push(
        `Room "${room.name}" aspect ratio (${aspectRatio.toFixed(2)}) outside bounds [${minAspect.toFixed(2)}, ${room.maxAspectRatio.toFixed(2)}]`,
      );
    }

    // Exterior wall check
    if (room.requiresExteriorWall) {
      const touchesBoundary =
        rect.x <= 0.1 ||
        rect.y <= 0.1 ||
        Math.abs(rect.x + rect.width - siteDimensions.width) <= 0.1 ||
        Math.abs(rect.y + rect.height - siteDimensions.length) <= 0.1;

      if (!touchesBoundary) {
        violations.push(`Room "${room.name}" requires exterior wall but doesn't touch boundary`);
      }
    }
  }

  return {
    valid: violations.length === 0,
    violations,
  };
}

// ============================================================================
// CONFIGURATION BUILDERS
// ============================================================================

/**
 * Creates a default adjacency matrix (all zeros)
 */
export function createAdjacencyMatrix(roomIds: string[]): Map<string, Map<string, number>> {
  const matrix = new Map<string, Map<string, number>>();

  for (const id1 of roomIds) {
    const row = new Map<string, number>();
    for (const id2 of roomIds) {
      row.set(id2, 0);
    }
    matrix.set(id1, row);
  }

  return matrix;
}

/**
 * Sets adjacency relationship between two rooms
 * positive: should be close
 * negative: should be far apart
 */
export function setAdjacency(
  matrix: Map<string, Map<string, number>>,
  roomId1: string,
  roomId2: string,
  score: number,
): void {
  if (!matrix.has(roomId1)) {
    matrix.set(roomId1, new Map());
  }
  if (!matrix.has(roomId2)) {
    matrix.set(roomId2, new Map());
  }

  matrix.get(roomId1)!.set(roomId2, score);
  matrix.get(roomId2)!.set(roomId1, score); // Symmetric
}

/**
 * Builds a LayoutConfig from components
 */
export function buildLayoutConfig(
  siteDimensions: { width: number; length: number },
  rooms: Room[],
  adjacencyMatrix?: Map<string, Map<string, number>>,
  options?: {
    maxIterations?: number;
    temperature?: number;
    coolingRate?: number;
    areaDeviation?: number;
  },
): LayoutConfig {
  const matrix =
    adjacencyMatrix ||
    createAdjacencyMatrix(rooms.map((r) => r.id));

  return {
    siteDimensions,
    rooms,
    adjacencyMatrix: matrix,
    maxIterations: options?.maxIterations ?? 100,
    temperature: options?.temperature ?? 10,
    coolingRate: options?.coolingRate ?? 0.95,
    tolerance: {
      areaDeviation: options?.areaDeviation ?? 10,
      adjacencyWeight: 1,
      minWidthWeight: 5,
    },
  };
}

// ============================================================================
// ANALYSIS & REPORTING
// ============================================================================

/**
 * Analyzes solution quality and constraint satisfaction
 */
export function analyzeSolution(
  solution: LayoutSolution,
  config: LayoutConfig,
): {
  summary: string;
  details: {
    areaCompliance: { room: string; target: number; actual: number; deviation: string }[];
    aspectRatioCompliance: {
      room: string;
      min: number;
      max: number;
      actual: number;
      compliant: boolean;
    }[];
    exteriorWallCompliance: { room: string; required: boolean; satisfied: boolean }[];
  };
} {
  const details: any = {
    areaCompliance: [],
    aspectRatioCompliance: [],
    exteriorWallCompliance: [],
  };

  for (const room of config.rooms) {
    const rect = solution.rooms.get(room.id);
    if (!rect) continue;

    // Area compliance
    const actual = rect.width * rect.height;
    const deviation = ((actual - room.targetArea) / room.targetArea) * 100;
    details.areaCompliance.push({
      room: room.name,
      target: room.targetArea,
      actual: Math.round(actual * 100) / 100,
      deviation: `${deviation > 0 ? '+' : ''}${deviation.toFixed(1)}%`,
    });

    // Aspect ratio compliance
    const aspectRatio = rect.width / rect.height;
    const minAspect = room.minAspectRatio ?? 1 / room.maxAspectRatio;
    details.aspectRatioCompliance.push({
      room: room.name,
      min: Math.round(minAspect * 100) / 100,
      max: room.maxAspectRatio,
      actual: Math.round(aspectRatio * 100) / 100,
      compliant: aspectRatio >= minAspect && aspectRatio <= room.maxAspectRatio,
    });

    // Exterior wall compliance
    const touchesBoundary =
      rect.x <= 0.1 ||
      rect.y <= 0.1 ||
      Math.abs(rect.x + rect.width - config.siteDimensions.width) <= 0.1 ||
      Math.abs(rect.y + rect.height - config.siteDimensions.length) <= 0.1;

    if (room.requiresExteriorWall) {
      details.exteriorWallCompliance.push({
        room: room.name,
        required: true,
        satisfied: touchesBoundary,
      });
    }
  }

  const summary = `Layout Score: ${(100 - Math.min(solution.totalPenalty, 100)).toFixed(1)}/100
Adjacency Satisfaction: ${solution.metrics.adjacencySatisfaction.toFixed(1)}%
Exterior Wall Satisfaction: ${solution.metrics.exteriorWallSatisfaction.toFixed(1)}%
Average Area Deviation: ${(solution.metrics.averageDeviation * 100).toFixed(1)}%`;

  return {
    summary,
    details,
  };
}

/**
 * Exports solution to JSON for persistence/transmission
 */
export function exportSolution(solution: LayoutSolution): string {
  const serializable = {
    rooms: Array.from(solution.rooms.entries()).map(([id, rect]) => ({
      id,
      ...rect,
    })),
    totalPenalty: solution.totalPenalty,
    penalties: solution.penalties,
    metrics: solution.metrics,
  };

  return JSON.stringify(serializable, null, 2);
}

/**
 * Gets room boundary points for visualization
 */
export function getRoomCorners(
  roomId: string,
  solution: LayoutSolution,
): { x: number; y: number }[] {
  const rect = solution.rooms.get(roomId);
  if (!rect) return [];

  return [
    { x: rect.x, y: rect.y },
    { x: rect.x + rect.width, y: rect.y },
    { x: rect.x + rect.width, y: rect.y + rect.height },
    { x: rect.x, y: rect.y + rect.height },
  ];
}
