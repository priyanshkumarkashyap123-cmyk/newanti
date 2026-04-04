import { NBC_MIN_DIMS } from './constants';
import { enforceNBCMinDimensions } from './sizing';
import type { RoomSpec } from './types';

export type CorridorZone = { x: number; y: number; w: number; h: number };
export type EntranceSide = 'N' | 'S' | 'E' | 'W';
export type ZoneRect = { x: number; y: number; w: number; h: number };
export type WetRoomPlacement = { spec: RoomSpec; x: number; y: number; w: number; h: number };
export type PrivateRoomPlacement = { spec: RoomSpec; x: number; y: number; w: number; h: number };

/**
 * Computes circulation spine geometry inside a buildable envelope.
 * Keeps existing planner behavior for narrow plots and directional entry.
 */
export function computeCirculationSpine(
  ox: number,
  oy: number,
  envW: number,
  envH: number,
  entranceSide: EntranceSide,
  isNarrowPlot: boolean,
  snapToGrid: (v: number) => number,
): { corridorZone: CorridorZone; corridorWidth: number } {
  const corridorWidth = Math.max(NBC_MIN_DIMS.corridor!.w, 1.2);
  let corridorZone: CorridorZone;

  if (entranceSide === 'S' || entranceSide === 'N') {
    const availH = envH - corridorWidth;
    const publicMinH = 2.5;
    const privateMinH = 2.5;
    const frontH = snapToGrid(Math.max(publicMinH, Math.min(availH - privateMinH, availH * 0.5)));
    const rawCorridorY = entranceSide === 'S' ? oy + frontH : oy + (availH - frontH);
    const corridorY = Math.max(oy, Math.min(oy + envH - corridorWidth, rawCorridorY));
    corridorZone = { x: ox, y: corridorY, w: envW, h: corridorWidth };
  } else {
    const availW = envW - corridorWidth;
    const publicMinW = 2.5;
    const privateMinW = 2.5;
    const frontW = snapToGrid(Math.max(publicMinW, Math.min(availW - privateMinW, availW * 0.5)));
    const rawCorridorX = entranceSide === 'E' ? ox + (availW - frontW) : ox + frontW;
    const corridorX = Math.max(ox, Math.min(ox + envW - corridorWidth, rawCorridorX));
    const narrowCorridorX = isNarrowPlot ? (entranceSide === 'E' ? ox + envW - corridorWidth : ox) : corridorX;
    corridorZone = { x: narrowCorridorX, y: oy, w: corridorWidth, h: envH };
  }

  return { corridorZone, corridorWidth };
}

/** Returns public-zone rectangle; null means no public zone (narrow N/S single-loaded mode). */
export function computePublicZoneRect(
  corridorZone: CorridorZone,
  entranceSide: EntranceSide,
  ox: number,
  oy: number,
  envW: number,
  envH: number,
  isNarrowPlot: boolean,
): ZoneRect | null {
  if (isNarrowPlot && (entranceSide === 'S' || entranceSide === 'N')) {
    return null;
  }

  if (entranceSide === 'S') {
    return { x: ox, y: oy, w: envW, h: corridorZone.y - oy };
  }
  if (entranceSide === 'N') {
    return {
      x: ox,
      y: corridorZone.y + corridorZone.h,
      w: envW,
      h: oy + envH - (corridorZone.y + corridorZone.h),
    };
  }
  if (entranceSide === 'E') {
    return {
      x: corridorZone.x + corridorZone.w,
      y: oy,
      w: ox + envW - (corridorZone.x + corridorZone.w),
      h: envH,
    };
  }
  return { x: ox, y: oy, w: corridorZone.x - ox, h: envH };
}

/** Returns private-zone rectangle opposite to entrance side. */
export function computePrivateZoneRect(
  corridorZone: CorridorZone,
  entranceSide: EntranceSide,
  ox: number,
  oy: number,
  envW: number,
  envH: number,
): ZoneRect {
  if (entranceSide === 'S') {
    return {
      x: ox,
      y: corridorZone.y + corridorZone.h,
      w: envW,
      h: oy + envH - (corridorZone.y + corridorZone.h),
    };
  }
  if (entranceSide === 'N') {
    return { x: ox, y: oy, w: envW, h: corridorZone.y - oy };
  }
  if (entranceSide === 'E') {
    return { x: ox, y: oy, w: corridorZone.x - ox, h: envH };
  }
  return {
    x: corridorZone.x + corridorZone.w,
    y: oy,
    w: ox + envW - (corridorZone.x + corridorZone.w),
    h: envH,
  };
}

/** Returns placements for private-zone rooms, preserving original packing heuristic. */
export function computePrivateZonePlacements(
  specs: RoomSpec[],
  corridorZone: CorridorZone,
  wetPlaced: WetRoomPlacement[],
  entranceSide: EntranceSide,
  ox: number,
  oy: number,
  envW: number,
  envH: number,
  snapToGrid: (v: number) => number,
): { placements: PrivateRoomPlacement[]; zone: ZoneRect; effectiveZoneX: number; effectiveZoneW: number } {
  const placements: PrivateRoomPlacement[] = [];
  const INT_WALL = 0.115;

  const zone = computePrivateZoneRect(corridorZone, entranceSide, ox, oy, envW, envH);
  if (zone.w <= 0 || zone.h <= 0) {
    return { placements, zone, effectiveZoneX: zone.x, effectiveZoneW: 0 };
  }

  const wetMaxX = wetPlaced.length > 0 ? Math.max(...wetPlaced.map((r) => r.x + r.w)) : zone.x;
  const wetMinX = wetPlaced.length > 0 ? Math.min(...wetPlaced.map((r) => r.x)) : zone.x + zone.w;
  const privateZoneW = Math.max(0, wetMinX - zone.x - INT_WALL);

  const sorted = [...specs].sort((a, b) => {
    const order = (t: RoomSpec['type']) =>
      t === 'master_bedroom' ? 0 : t === 'bedroom' ? 1 : t === 'childrens_room' ? 2 : 3;
    return order(a.type) - order(b.type);
  });

  let curX = wetPlaced.length > 0 ? wetMaxX + INT_WALL : zone.x;
  let curY = zone.y;
  let rowH = 0;

  const effectiveZoneW = privateZoneW > 0 ? privateZoneW : zone.w;
  const effectiveZoneX = zone.x;

  if (curX >= effectiveZoneX + effectiveZoneW) {
    curX = effectiveZoneX;
  }

  for (const spec of sorted) {
    const area = spec.preferredArea || spec.minArea;
    const nbcH = NBC_MIN_DIMS[spec.type]?.h ?? 2.7;
    const nbcW = NBC_MIN_DIMS[spec.type]?.w ?? 2.7;
    let rH = snapToGrid(Math.max(nbcH, Math.min(zone.h, nbcH * 1.5)));
    let rW = snapToGrid(Math.max(nbcW, area / rH));

    const dims = enforceNBCMinDimensions(spec.type, rW, rH, area, snapToGrid);
    rW = dims.w;
    rH = dims.h;

    if (curX + rW > effectiveZoneX + effectiveZoneW) {
      curX = effectiveZoneX;
      curY += rowH + INT_WALL;
      rowH = 0;
    }

    if (curY >= oy + envH || curX >= ox + envW) continue;

    const maxAllowedH = oy + envH - curY;
    const maxAllowedW = Math.min(ox + envW - curX, effectiveZoneX + effectiveZoneW - curX);
    if (maxAllowedH < nbcH * 0.8 || maxAllowedW < nbcW * 0.8) continue;
    if (curY + rH > zone.y + zone.h + 0.5) {
      rH = snapToGrid(Math.max(nbcH, Math.min(maxAllowedH, zone.y + zone.h - curY)));
      if (rH < nbcH * 0.8) continue;
    }
    if (curX + rW > effectiveZoneX + effectiveZoneW) {
      rW = snapToGrid(Math.min(maxAllowedW, effectiveZoneX + effectiveZoneW - curX));
      if (rW < nbcW * 0.8) continue;
    }

    placements.push({
      spec,
      x: Math.round(curX * 100) / 100,
      y: Math.round(curY * 100) / 100,
      w: rW,
      h: rH,
    });

    curX += rW + INT_WALL;
    rowH = Math.max(rowH, rH);
  }

  return { placements, zone, effectiveZoneX, effectiveZoneW };
}

/** Returns wet-zone rectangle used for service/wet room clustering. */
export function computeWetZoneRect(
  specs: RoomSpec[],
  corridorZone: CorridorZone,
  entranceSide: EntranceSide,
  ox: number,
  oy: number,
  envW: number,
  envH: number,
  snapToGrid: (v: number) => number,
): ZoneRect {
  if (entranceSide === 'S' || entranceSide === 'N') {
    const rearY = entranceSide === 'S' ? corridorZone.y + corridorZone.h : oy;
    const rearH = oy + envH - rearY;
    const totalWetW = specs.reduce((sum, s) => {
      const nbcW = NBC_MIN_DIMS[s.type]?.w ?? 1.2;
      return sum + nbcW + 0.115;
    }, 0);
    const wetW = snapToGrid(Math.max(totalWetW, envW * 0.35));
    const zoneW = Math.min(wetW, envW * 0.7);
    const zoneX = ox + envW - zoneW;
    return {
      x: zoneX,
      y: rearY,
      w: zoneW,
      h: rearH,
    };
  }

  const rearX = entranceSide === 'E' ? ox : corridorZone.x + corridorZone.w;
  return {
    x: rearX,
    y: oy + envH * 0.6,
    w: ox + envW - rearX,
    h: envH * 0.4,
  };
}

/** Computes individual wet-room placements within a wet zone, preserving adjacency heuristics. */
export function computeWetRoomPlacements(
  specs: RoomSpec[],
  zone: ZoneRect,
  ox: number,
  oy: number,
  envW: number,
  envH: number,
  snapToGrid: (v: number) => number,
): { placements: WetRoomPlacement[]; wetWallX: number | null; wetWallY: number | null } {
  const placements: WetRoomPlacement[] = [];
  if (zone.w <= 0 || zone.h <= 0) {
    return { placements, wetWallX: null, wetWallY: null };
  }

  const INT_WALL = 0.115;

  // Sort: kitchen first (vastu SE), then bathrooms, then others
  const sorted = [...specs].sort((a, b) => {
    const order = (t: RoomSpec['type']) =>
      t === 'kitchen' ? 0 : t === 'bathroom' ? 1 : t === 'toilet' ? 2 : 3;
    return order(a.type) - order(b.type);
  });

  let curX = zone.x;
  let curY = zone.y;
  let wetWallX: number | null = null;
  let wetWallY: number | null = null;
  let lastPlacedWet: { x: number; y: number; w: number; h: number } | null = null;

  for (const spec of sorted) {
    const area = spec.preferredArea || spec.minArea;
    const nbcH = NBC_MIN_DIMS[spec.type]?.h ?? 1.8;
    const nbcW = NBC_MIN_DIMS[spec.type]?.w ?? 1.2;
    // Use NBC minimum height for wet rooms to ensure multiple rooms can stack
    // Cap at 1.5x NBC minimum to avoid taking too much vertical space
    let rH = snapToGrid(Math.max(nbcH, Math.min(nbcH * 1.5, zone.h * 0.5)));
    // Cap room width to 60% of zone width to ensure multiple rooms can fit side by side
    let rW = snapToGrid(Math.max(nbcW, Math.min(area / rH, zone.w * 0.6)));

    const dims = enforceNBCMinDimensions(spec.type, rW, rH, area, snapToGrid);
    rW = dims.w;
    rH = dims.h;

    // After enforceNBCMinDimensions, re-cap height to leave room for other wet rooms.
    // If rH exceeds 60% of zone height, reduce it and widen rW to compensate.
    const maxRH = Math.max(nbcH, zone.h * 0.6);
    if (rH > maxRH) {
      rH = snapToGrid(maxRH);
      rW = snapToGrid(Math.max(nbcW, area / rH));
    }

    // Cap rW to zone width to prevent overflow beyond the wet zone.
    // If the room is wider than the zone, use the zone width and adjust height.
    if (rW > zone.w) {
      rW = snapToGrid(Math.max(nbcW, zone.w));
      rH = snapToGrid(Math.max(nbcH, area / rW));
    }

    // For the first wet room (kitchen), reserve space for subsequent wet rooms.
    // Cap kitchen width to leave at least NBC minimum width for the next wet room.
    // This cap is applied LAST to override any previous width expansion.
    if (!lastPlacedWet && sorted.length > 1) {
      const nextSpec = sorted[1];
      const nextNbcW = NBC_MIN_DIMS[nextSpec.type]?.w ?? 1.2;
      const maxFirstRoomW = Math.max(nbcW, zone.w - nextNbcW - INT_WALL);
      if (rW > maxFirstRoomW) {
        rW = snapToGrid(maxFirstRoomW);
        // Adjust height to maintain area, but cap at maxRH
        const newRH = Math.max(nbcH, area / rW);
        rH = snapToGrid(Math.min(newRH, maxRH));
        // If height is capped, accept the area loss (NBC minimums are still met)
      }
    }

    // Try to place adjacent to last wet room (sharing a wall)
    // If no previous wet room, start at zone origin
    let px = curX;
    let py = curY;

    if (lastPlacedWet) {
      // Try right of last wet room
      const tryRight = { px: lastPlacedWet.x + lastPlacedWet.w + INT_WALL, py: lastPlacedWet.y };
      // Try below last wet room
      const tryBelow = { px: lastPlacedWet.x, py: lastPlacedWet.y + lastPlacedWet.h + INT_WALL };
      // Try left of last wet room (sharing left wall)
      const tryLeft = { px: lastPlacedWet.x - rW - INT_WALL, py: lastPlacedWet.y };

      if (tryRight.px + rW <= ox + envW && tryRight.py + rH <= oy + envH) {
        px = tryRight.px;
        py = tryRight.py;
      } else if (tryBelow.px + rW <= ox + envW && tryBelow.py + rH <= oy + envH) {
        px = tryBelow.px;
        py = tryBelow.py;
      } else if (tryLeft.px >= ox && tryLeft.py + rH <= oy + envH) {
        px = tryLeft.px;
        py = tryLeft.py;
      } else {
        // Can't place adjacent — skip
        continue;
      }
    } else {
      // First wet room — place at zone origin
      if (px + rW > ox + envW) rW = snapToGrid(ox + envW - px);
      if (py + rH > oy + envH) rH = snapToGrid(oy + envH - py);
      if (rW < nbcW * 0.8 || rH < nbcH * 0.8) continue;
    }

    if (wetWallY === null) {
      wetWallX = null;
      wetWallY = py;
    }

    lastPlacedWet = { x: px, y: py, w: rW, h: rH };

    placements.push({
      spec,
      x: Math.round(px * 100) / 100,
      y: Math.round(py * 100) / 100,
      w: rW,
      h: rH,
    });
  }

  return { placements, wetWallX, wetWallY };
}