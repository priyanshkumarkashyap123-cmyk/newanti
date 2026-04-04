/**
 * GridAndLayoutUtils - Grid snapping and budget computation utilities
 *
 * Extracted from SpacePlanningEngine.ts
 */

import type { SiteConstraints, PlotDimensions } from './types';

const GRID_SIZE = 0.15; // 150mm grid snapping (standard modular construction)

/**
 * Snap a dimension to the nearest grid unit (150mm)
 */
export function snapToGrid(v: number): number {
  return Math.round(v / GRID_SIZE) * GRID_SIZE;
}

/**
 * Compute per-floor area budget based on plot area and constraints
 */
// Internal helpers retained for reference; intentionally not exported to avoid unused-export noise
function computePerFloorBudget(
  plotArea: number,
  constraints: SiteConstraints,
): number {
  const farLimit = plotArea * constraints.farAllowed;
  const coverageLimit = plotArea * (constraints.groundCoverage / 100);
  const implicFloors = Math.floor(farLimit / coverageLimit);
  const _effectiveFloors = Math.min(constraints.maxFloors, implicFloors);
  return coverageLimit;
}

function isGridAligned(v: number): boolean {
  const diff = Math.abs(v - snapToGrid(v));
  return diff < 0.001; // Allow 1mm tolerance
}

function getGridDelta(v: number): number {
  const snapped = snapToGrid(v);
  return Math.abs(v - snapped);
}
