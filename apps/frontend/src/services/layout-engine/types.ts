/**
 * Layout Engine Type Definitions
 *
 * Types for the architectural space-planning layout solver.
 */

/** Axis-aligned rectangle in 2D */
export interface Rectangle {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Room specification for the layout solver */
export interface Room {
  id: string;
  name: string;
  targetArea: number;       // m²
  minWidth: number;         // m — minimum dimension in any direction
  maxAspectRatio: number;   // width / height upper bound
  minAspectRatio?: number;  // width / height lower bound (default: 1/maxAspectRatio)
  requiresExteriorWall?: boolean;
  priority?: number;        // higher = placed first
}

/** Result of a layout solve run */
export interface LayoutSolution {
  rooms: Map<string, Rectangle>;
  totalPenalty: number;
  penalties: {
    area: number;
    aspectRatio: number;
    adjacency: number;
    exteriorWall: number;
    overlap: number;
  };
  metrics: {
    adjacencySatisfaction: number;      // 0–100 %
    exteriorWallSatisfaction: number;   // 0–100 %
    averageDeviation: number;           // fraction (0–1)
  };
}

/** Configuration fed to the solver */
export interface LayoutConfig {
  siteDimensions: { width: number; length: number };
  rooms: Room[];
  adjacencyMatrix: Map<string, Map<string, number>>;
  maxIterations: number;
  temperature: number;
  coolingRate: number;
  tolerance: {
    areaDeviation: number;   // %
    adjacencyWeight: number;
    minWidthWeight: number;
  };
}

/** Internal BSP tree node used during generation */
export interface PartitionNode {
  rect: Rectangle;
  left?: PartitionNode;
  right?: PartitionNode;
  roomId?: string;
}
