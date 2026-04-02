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
export function computePerFloorBudget(
  plotArea: number,
  constraints: SiteConstraints,
): number {
  // FAR limit: floor area allowed = plot area × FAR ratio
  const farLimit = plotArea * constraints.farAllowed;

  // Ground coverage limit: base floor area = plot area × coverage %
  const coverageLimit = plotArea * (constraints.groundCoverage / 100);

  // Total floors allowed:
  // - Max floors from constraint
  // - Implied by FAR / coverage
  const implicFloors = Math.floor(farLimit / coverageLimit);
  const effectiveFloors = Math.min(constraints.maxFloors, implicFloors);

  // Per-floor budget
  const perFloor = coverageLimit;

  return perFloor;
}

/**
 * Validate grid alignment for a dimension
 */
export function isGridAligned(v: number): boolean {
  const diff = Math.abs(v - snapToGrid(v));
  return diff < 0.001; // Allow 1mm tolerance
}

/**
 * Get the grid delta (distance to nearest grid point)
 */
export function getGridDelta(v: number): number {
  const snapped = snapToGrid(v);
  return Math.abs(v - snapped);
}
