import { NBC_MIN_DIMS } from './constants';
import type { RoomType } from './types';

/**
 * Enforce NBC minimum room dimensions while preserving target area as much as possible.
 * The provided `snapToGrid` function should snap to the project grid increment.
 */
export function enforceNBCMinDimensions(
  type: RoomType,
  w: number,
  h: number,
  area: number,
  snapToGrid: (v: number) => number,
): { w: number; h: number } {
  const min = NBC_MIN_DIMS[type];
  if (!min) return { w: snapToGrid(w), h: snapToGrid(h) };

  let rW = w;
  let rH = h;

  if (rW < min.w) {
    rW = min.w;
    rH = Math.max(min.h, area / rW);
  }
  if (rH < min.h) {
    rH = min.h;
    rW = Math.max(min.w, area / rH);
  }

  // Always snap upward if a rounded snap would dip below the NBC minimum.
  const snapUp = (v: number, minV: number): number => {
    const snapped = snapToGrid(v);
    return snapped >= minV - 0.001 ? snapped : Math.ceil(v * 4) / 4;
  };

  return { w: snapUp(rW, min.w), h: snapUp(rH, min.h) };
}