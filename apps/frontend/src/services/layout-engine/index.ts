/**
 * Architectural Layout Engine - Main Export
 */

export type { Rectangle, Room, LayoutSolution, LayoutConfig, PartitionNode } from './types';

export {
  calculateLayoutPenalty,
  generateInitialLayoutBSP,
  solveArchitecturalLayout,
} from './solver';

export {
  validateRoomConfiguration,
  validateSolution,
  createAdjacencyMatrix,
  setAdjacency,
  buildLayoutConfig,
  analyzeSolution,
  exportSolution,
  getRoomCorners,
} from './utils';
