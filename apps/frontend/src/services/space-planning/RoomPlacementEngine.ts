/**
 * RoomPlacementEngine - Room Zone Placement & Layout Organization
 *
 * Extracted from SpacePlanningEngine.ts
 * Handles architectural placement pipeline:
 * - Circulation spine generation (corridors)
 * - Public zone layout (living areas)
 * - Wet area clustering (plumbing wall)
 * - Private zone layout (bedrooms)
 * - Service room packing
 * - Entrance sequence validation
 */

import type {
  RoomSpec,
  PlacedRoom,
  UserPreferences,
  SiteOrientation,
  RoomType,
  PlotDimensions,
  SetbackRequirements,
} from './types';
import {
  computeCirculationSpine,
  computePublicZoneRect,
  computeWetZoneRect,
  computeWetRoomPlacements,
  computePrivateZoneRect,
} from './placementMath';
import { clampToEnvelope, resolveOverlaps } from './OverlapSolver';
import { NBC_MIN_DIMS, ArchitecturalZone } from './constants';
import { ROOM_COLORS } from './roomPresets';
import { classifyRoomZone, isWetRoom } from './zoning';
import { enforceNBCMinDimensions } from './sizing';

// ============================================
// PLACEMENT CONTEXT
// ============================================

export interface PlacementContext {
  corridorZone: { x: number; y: number; w: number; h: number };
  entranceSide: 'N' | 'S' | 'E' | 'W';
  placedByZone: Map<ArchitecturalZone, PlacedRoom[]>;
  wetWallX: number | null;
  wetWallY: number | null;
}

// ============================================
// HELPER UTILITIES
// ============================================

interface GridHelper {
  snapToGrid(v: number): number;
}

interface FinishHelper {
  getFloorFinish(type: RoomType, preferences: UserPreferences): string;
  getWallFinish(type: RoomType, preferences: UserPreferences): string;
}

// ============================================
// CIRCULATION SPINE
// ============================================

export function buildCirculationSpine(
  ox: number,
  oy: number,
  envW: number,
  envH: number,
  entranceSide: 'N' | 'S' | 'E' | 'W',
  preferences: UserPreferences,
  floor: number = 0,
  isNarrowPlot: boolean = false,
  grid: GridHelper,
  finishes: FinishHelper,
): { corridorZone: { x: number; y: number; w: number; h: number }; corridorRoom: PlacedRoom } {
  const INT_WALL = 0.115;
  const { corridorZone, corridorWidth: CORRIDOR_W } = computeCirculationSpine(
    ox,
    oy,
    envW,
    envH,
    entranceSide,
    isNarrowPlot,
    (v: number) => grid.snapToGrid(v),
  );

  const corridorRoom: PlacedRoom = {
    id: 'arch-corridor-spine',
    spec: {
      id: 'arch-corridor-spine',
      type: 'corridor',
      name: 'Corridor',
      minArea: corridorZone.w * corridorZone.h,
      preferredArea: corridorZone.w * corridorZone.h,
      maxArea: corridorZone.w * corridorZone.h,
      minWidth: CORRIDOR_W,
      minHeight: 3.0,
      requiresWindow: false,
      requiresVentilation: false,
      requiresAttachedBath: false,
      priority: 'essential',
      floor,
      quantity: 1,
    },
    x: corridorZone.x,
    y: corridorZone.y,
    width: corridorZone.w,
    height: corridorZone.h,
    rotation: 0,
    floor,
    wallThickness: INT_WALL,
    doors: [],
    windows: [],
    finishFloor: finishes.getFloorFinish('corridor', preferences),
    finishWall: finishes.getWallFinish('corridor', preferences),
    finishCeiling: 'POP finish with white paint',
    ceilingHeight: 3.0,
    color: ROOM_COLORS.corridor,
  };

  return { corridorZone, corridorRoom };
}

// ============================================
// PUBLIC ZONE PLACEMENT
// ============================================

export function placePublicZone(
  specs: RoomSpec[],
  corridorZone: { x: number; y: number; w: number; h: number },
  entranceSide: 'N' | 'S' | 'E' | 'W',
  context: PlacementContext,
  preferences: UserPreferences,
  ox: number,
  oy: number,
  envW: number,
  envH: number,
  isNarrowPlot: boolean = false,
  grid: GridHelper,
  finishes: FinishHelper,
): PlacedRoom[] {
  const placed: PlacedRoom[] = [];
  const INT_WALL = 0.115;

  const zone = computePublicZoneRect(
    corridorZone,
    entranceSide,
    ox,
    oy,
    envW,
    envH,
    isNarrowPlot,
  );

  if (!zone) return placed;
  if (zone.w <= 0 || zone.h <= 0) return placed;

  const sorted = [...specs].sort((a, b) => {
    const order = (t: RoomType) =>
      t === 'foyer' || t === 'entrance_lobby' ? 0
      : t === 'living' || t === 'drawing_room' ? 1
      : t === 'dining' ? 2
      : 3;
    return order(a.type) - order(b.type);
  });

  const placeRightToLeft = entranceSide === 'E';
  const placeBottomToTop = entranceSide === 'N';

  let curX = placeRightToLeft ? zone.x + zone.w : zone.x;
  let curY = placeBottomToTop ? zone.y + zone.h : zone.y;
  let rowH = 0;

  for (const spec of sorted) {
    const area = spec.preferredArea || spec.minArea;
    const nbcH = NBC_MIN_DIMS[spec.type]?.h ?? 2.7;
    const nbcW = NBC_MIN_DIMS[spec.type]?.w ?? 2.4;
    let rH = grid.snapToGrid(Math.max(nbcH, Math.min(zone.h, nbcH * 1.5)));
    let rW = grid.snapToGrid(Math.max(nbcW, area / rH));

    const dims = enforceNBCMinDimensions(spec.type, rW, rH, area, (v: number) => grid.snapToGrid(v));
    rW = dims.w;
    rH = dims.h;

    let px: number, py: number;
    if (placeRightToLeft) {
      px = curX - rW;
      py = curY;
      if (px < zone.x) {
        curX = zone.x + zone.w;
        curY += rowH + INT_WALL;
        rowH = 0;
        px = curX - rW;
        py = curY;
      }
    } else if (placeBottomToTop) {
      px = curX;
      py = curY - rH;
      if (py < zone.y) {
        curY = zone.y + zone.h;
        curX += rowH + INT_WALL;
        rowH = 0;
        px = curX;
        py = curY - rH;
      }
    } else {
      px = curX;
      py = curY;
      if (px + rW > zone.x + zone.w) {
        curX = zone.x;
        curY += rowH + INT_WALL;
        rowH = 0;
        px = curX;
        py = curY;
      }
    }

    if (py >= oy + envH || px >= ox + envW) continue;
    if (px < ox || py < oy) continue;
    if (py + rH > zone.y + zone.h + 0.5) {
      rH = grid.snapToGrid(Math.max(nbcH, zone.y + zone.h - py));
      if (rH < nbcH * 0.8) continue;
    }
    if (px + rW > zone.x + zone.w) {
      rW = grid.snapToGrid(zone.x + zone.w - px);
      if (rW < nbcW * 0.8) continue;
    }

    placed.push({
      id: `arch-pub-${spec.id}`,
      spec,
      x: Math.round(px * 100) / 100,
      y: Math.round(py * 100) / 100,
      width: rW,
      height: rH,
      rotation: 0,
      floor: spec.floor,
      wallThickness: INT_WALL,
      doors: [],
      windows: [],
      finishFloor: finishes.getFloorFinish(spec.type, preferences),
      finishWall: finishes.getWallFinish(spec.type, preferences),
      finishCeiling: 'POP finish with white paint',
      ceilingHeight: spec.minHeight || 3.0,
      color: ROOM_COLORS[spec.type] || '#F3F4F6',
    });

    if (placeRightToLeft) {
      curX = px - INT_WALL;
      rowH = Math.max(rowH, rH);
    } else if (placeBottomToTop) {
      curY = py - INT_WALL;
      rowH = Math.max(rowH, rW);
    } else {
      curX += rW + INT_WALL;
      rowH = Math.max(rowH, rH);
    }
  }

  context.placedByZone.set(ArchitecturalZone.PUBLIC, placed);
  return placed;
}

// ============================================
// WET AREA PLACEMENT
// ============================================

export function placeWetAreas(
  specs: RoomSpec[],
  corridorZone: { x: number; y: number; w: number; h: number },
  entranceSide: 'N' | 'S' | 'E' | 'W',
  context: PlacementContext,
  preferences: UserPreferences,
  ox: number,
  oy: number,
  envW: number,
  envH: number,
  grid: GridHelper,
  finishes: FinishHelper,
): PlacedRoom[] {
  const placed: PlacedRoom[] = [];
  const INT_WALL = 0.115;

  const zone = computeWetZoneRect(
    specs,
    corridorZone,
    entranceSide,
    ox,
    oy,
    envW,
    envH,
    (v: number) => grid.snapToGrid(v),
  );

  const { placements: wetPlacements, wetWallX, wetWallY } = computeWetRoomPlacements(
    specs,
    zone,
    ox,
    oy,
    envW,
    envH,
    (v: number) => grid.snapToGrid(v),
  );

  if (wetWallX !== null || wetWallY !== null) {
    context.wetWallX = wetWallX;
    context.wetWallY = wetWallY;
  }

  for (const placement of wetPlacements) {
    placed.push({
      id: `arch-wet-${placement.spec.id}`,
      spec: placement.spec,
      x: placement.x,
      y: placement.y,
      width: placement.w,
      height: placement.h,
      rotation: 0,
      floor: placement.spec.floor,
      wallThickness: INT_WALL,
      doors: [],
      windows: [],
      finishFloor: finishes.getFloorFinish(placement.spec.type, preferences),
      finishWall: finishes.getWallFinish(placement.spec.type, preferences),
      finishCeiling: 'POP finish with white paint',
      ceilingHeight: placement.spec.minHeight || 3.0,
      color: ROOM_COLORS[placement.spec.type as keyof typeof ROOM_COLORS] || '#F3F4F6',
    });
  }

  context.placedByZone.set(ArchitecturalZone.SERVICE, placed);
  return placed;
}

// ============================================
// PRIVATE ZONE PLACEMENT
// ============================================

export function placePrivateZone(
  specs: RoomSpec[],
  corridorZone: { x: number; y: number; w: number; h: number },
  wetPlaced: PlacedRoom[],
  entranceSide: 'N' | 'S' | 'E' | 'W',
  context: PlacementContext,
  preferences: UserPreferences,
  ox: number,
  oy: number,
  envW: number,
  envH: number,
  grid: GridHelper,
  finishes: FinishHelper,
): PlacedRoom[] {
  const placed: PlacedRoom[] = [];
  const INT_WALL = 0.115;

  const zone = computePrivateZoneRect(corridorZone, entranceSide, ox, oy, envW, envH);

  if (zone.w <= 0 || zone.h <= 0) return placed;

  const wetMaxX = wetPlaced.length > 0
    ? Math.max(...wetPlaced.map(r => r.x + r.width))
    : zone.x;
  const availW = Math.max(0, zone.x + zone.w - wetMaxX - INT_WALL);

  const wetMinX = wetPlaced.length > 0
    ? Math.min(...wetPlaced.map(r => r.x))
    : zone.x + zone.w;
  const privateZoneW = Math.max(0, wetMinX - zone.x - INT_WALL);

  const sorted = [...specs].sort((a, b) => {
    const order = (t: RoomType) =>
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
    let rH = grid.snapToGrid(Math.max(nbcH, Math.min(zone.h, nbcH * 1.5)));
    let rW = grid.snapToGrid(Math.max(nbcW, area / rH));

    const dims = enforceNBCMinDimensions(spec.type, rW, rH, area, (v: number) => grid.snapToGrid(v));
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
      rH = grid.snapToGrid(Math.max(nbcH, Math.min(maxAllowedH, zone.y + zone.h - curY)));
      if (rH < nbcH * 0.8) continue;
    }
    if (curX + rW > effectiveZoneX + effectiveZoneW) {
      rW = grid.snapToGrid(Math.min(maxAllowedW, effectiveZoneX + effectiveZoneW - curX));
      if (rW < nbcW * 0.8) continue;
    }

    placed.push({
      id: `arch-priv-${spec.id}`,
      spec,
      x: Math.round(curX * 100) / 100,
      y: Math.round(curY * 100) / 100,
      width: rW,
      height: rH,
      rotation: 0,
      floor: spec.floor,
      wallThickness: INT_WALL,
      doors: [],
      windows: [],
      finishFloor: finishes.getFloorFinish(spec.type, preferences),
      finishWall: finishes.getWallFinish(spec.type, preferences),
      finishCeiling: 'POP finish with white paint',
      ceilingHeight: spec.minHeight || 3.0,
      color: ROOM_COLORS[spec.type] || '#F3F4F6',
    });

    // Place attached bath immediately to the right if needed
    if (spec.requiresAttachedBath) {
      const bathArea = 4.5;
      const bathW = grid.snapToGrid(Math.max(1.5, Math.min(2.5, bathArea / rH)));
      const bathH = rH;
      if (curX + rW + bathW <= zone.x + zone.w) {
        placed.push({
          id: `arch-priv-bath-${spec.id}`,
          spec: {
            id: `arch-priv-bath-${spec.id}`,
            type: 'bathroom',
            name: `${spec.name} Bath`,
            minArea: 3.5, preferredArea: 4.5, maxArea: 6,
            minWidth: 1.5, minHeight: 3.0,
            requiresWindow: true, requiresVentilation: true, requiresAttachedBath: false,
            priority: 'essential', floor: spec.floor, quantity: 1,
          },
          x: Math.round((curX + rW) * 100) / 100,
          y: Math.round(curY * 100) / 100,
          width: bathW,
          height: bathH,
          rotation: 0,
          floor: spec.floor,
          wallThickness: INT_WALL,
          doors: [], windows: [],
          finishFloor: finishes.getFloorFinish('bathroom', preferences),
          finishWall: finishes.getWallFinish('bathroom', preferences),
          finishCeiling: 'POP finish with white paint',
          ceilingHeight: 3.0,
          color: ROOM_COLORS.bathroom,
        });
        curX += bathW;
      }
    }

    curX += rW + INT_WALL;
    rowH = Math.max(rowH, rH);
  }

  context.placedByZone.set(ArchitecturalZone.PRIVATE, placed);
  return placed;
}

// ============================================
// ENTRANCE SEQUENCE VALIDATION
// ============================================

export function validateEntranceSequence(
  rooms: PlacedRoom[],
  entranceSide: 'N' | 'S' | 'E' | 'W',
): boolean {
  const distFromEntrance = (r: PlacedRoom): number => {
    if (entranceSide === 'S') return r.y;
    if (entranceSide === 'N') return -(r.y + r.height);
    if (entranceSide === 'E') return -(r.x + r.width);
    return r.x; // W
  };

  const foyer = rooms.find(r => r.spec.type === 'foyer' || r.spec.type === 'entrance_lobby');
  const living = rooms.find(r => r.spec.type === 'living' || r.spec.type === 'drawing_room');
  const bedrooms = rooms.filter(r => ['master_bedroom', 'bedroom', 'childrens_room', 'guest_room'].includes(r.spec.type));

  if (!living || bedrooms.length === 0) return true;

  const livingDist = distFromEntrance(living);
  const bedroomDists = bedrooms.map(distFromEntrance);

  const bedroomsAtRear = bedroomDists.every(d => d > livingDist);

  if (foyer) {
    const foyerDist = distFromEntrance(foyer);
    return foyerDist <= livingDist && bedroomsAtRear;
  }

  return bedroomsAtRear;
}

// ============================================
// AUTO-INJECT MANDATORY ROOMS
// ============================================

export function autoInjectMandatoryRooms(
  specs: RoomSpec[],
  violations: any[],
): RoomSpec[] {
  const result = [...specs];
  const types = new Set(specs.map(s => s.type));

  const hasHabitable = ['living', 'bedroom', 'master_bedroom', 'drawing_room', 'dining'].some(t => types.has(t as RoomType));
  const hasKitchen = types.has('kitchen');
  const hasToilet = types.has('toilet') || types.has('bathroom');

  if (!hasHabitable) {
    result.push({
      id: 'auto-inject-living',
      type: 'living', name: 'Living Room',
      minArea: 9, preferredArea: 12, maxArea: 20,
      minWidth: NBC_MIN_DIMS.living!.w, minHeight: 3.0,
      requiresWindow: true, requiresVentilation: true, requiresAttachedBath: false,
      priority: 'essential', floor: 0, quantity: 1,
    });
    violations.push({ rule: 'NBC Part 4: Habitable room auto-injected', severity: 'info', roomId: 'auto-inject-living' } as any);
  }
  if (!hasKitchen) {
    result.push({
      id: 'auto-inject-kitchen',
      type: 'kitchen', name: 'Kitchen',
      minArea: 5, preferredArea: 7, maxArea: 12,
      minWidth: NBC_MIN_DIMS.kitchen!.w, minHeight: 3.0,
      requiresWindow: true, requiresVentilation: true, requiresAttachedBath: false,
      priority: 'essential', floor: 0, quantity: 1,
    });
    violations.push({ rule: 'NBC Part 4: Kitchen auto-injected', severity: 'info', roomId: 'auto-inject-kitchen' } as any);
  }
  if (!hasToilet) {
    result.push({
      id: 'auto-inject-toilet',
      type: 'toilet', name: 'Toilet',
      minArea: 1.5, preferredArea: 2.5, maxArea: 4,
      minWidth: NBC_MIN_DIMS.toilet!.w, minHeight: 3.0,
      requiresWindow: false, requiresVentilation: true, requiresAttachedBath: false,
      priority: 'essential', floor: 0, quantity: 1,
    });
    violations.push({ rule: 'NBC Part 4: Toilet auto-injected', severity: 'info', roomId: 'auto-inject-toilet' } as any);
  }

  return result;
}

// ============================================
// ARCHITECTURAL ORCHESTRATION
// ============================================

export function architecturalPlacement(
  rooms: RoomSpec[],
  buildableWidth: number,
  buildableDepth: number,
  setbacks: SetbackRequirements,
  orientation: SiteOrientation,
  preferences: UserPreferences,
  plot: PlotDimensions,
  floor: number = 0,
  isNarrowPlot: boolean = false,
  grid: GridHelper,
  finishes: FinishHelper,
): { rooms: PlacedRoom[]; context: PlacementContext; entranceSequenceValid: boolean } {
  const ox = setbacks.left;
  const oy = setbacks.front;
  const envW = buildableWidth;
  const envH = buildableDepth;

  const entranceSide = (['N', 'S', 'E', 'W'].includes(orientation.mainEntryDirection)
    ? orientation.mainEntryDirection
    : 'S') as 'N' | 'S' | 'E' | 'W';

  // Step 1: Build circulation spine
  const { corridorZone, corridorRoom } = buildCirculationSpine(
    ox, oy, envW, envH, entranceSide, preferences, floor, isNarrowPlot, grid, finishes,
  );

  const context: PlacementContext = {
    corridorZone,
    entranceSide,
    placedByZone: new Map(),
    wetWallX: null,
    wetWallY: null,
  };

  // Classify rooms by zone
  const publicSpecs: RoomSpec[] = [];
  const privateSpecs: RoomSpec[] = [];
  const wetSpecs: RoomSpec[] = [];
  const serviceSpecs: RoomSpec[] = [];

  for (const spec of rooms) {
    const zone = classifyRoomZone(spec.type);
    if (zone === ArchitecturalZone.CIRCULATION) {
      // skip circulation specs
    } else if (isWetRoom(spec.type)) {
      wetSpecs.push(spec);
    } else if (zone === ArchitecturalZone.PUBLIC) {
      publicSpecs.push(spec);
    } else if (zone === ArchitecturalZone.PRIVATE) {
      privateSpecs.push(spec);
    } else {
      serviceSpecs.push(spec);
    }
  }

  // For narrow plots with N/S entry: single-loaded layout
  if (isNarrowPlot && (entranceSide === 'S' || entranceSide === 'N')) {
    privateSpecs.unshift(...publicSpecs);
    publicSpecs.length = 0;
  }

  // Step 2: Place public zone
  const publicPlaced = placePublicZone(
    publicSpecs, corridorZone, entranceSide, context, preferences, ox, oy, envW, envH, isNarrowPlot, grid, finishes,
  );

  // Step 3: Place wet areas
  const wetPlaced = placeWetAreas(
    wetSpecs, corridorZone, entranceSide, context, preferences, ox, oy, envW, envH, grid, finishes,
  );

  // Step 4: Place private zone
  const placedWetIds = new Set(wetPlaced.map(r => r.spec.id));
  const unplacedWetSpecs = wetSpecs.filter(s => !placedWetIds.has(s.id));
  privateSpecs.push(...unplacedWetSpecs);
  const privatePlaced = placePrivateZone(
    privateSpecs, corridorZone, wetPlaced, entranceSide, context, preferences, ox, oy, envW, envH, grid, finishes,
  );

  // Step 5: Pack remaining service rooms
  const INT_WALL = 0.115;
  const servicePlaced: PlacedRoom[] = [];
  const allPlacedSoFar = [...publicPlaced, ...wetPlaced, ...privatePlaced];

  for (const spec of serviceSpecs) {
    const area = spec.preferredArea || spec.minArea;
    const rW = grid.snapToGrid(Math.max(spec.minWidth || 1.5, Math.sqrt(area)));
    const rH = grid.snapToGrid(Math.max(1.5, area / rW));

    const candidates: Array<{ px: number; py: number }> = [];

    const lastWet = wetPlaced[wetPlaced.length - 1];
    const lastPublic = publicPlaced[publicPlaced.length - 1];

    if (lastWet) {
      candidates.push({ px: lastWet.x + lastWet.width + INT_WALL, py: lastWet.y });
      candidates.push({ px: lastWet.x, py: lastWet.y + lastWet.height + INT_WALL });
    }
    if (lastPublic) {
      candidates.push({ px: lastPublic.x + lastPublic.width + INT_WALL, py: lastPublic.y });
    }
    const rearY = entranceSide === 'S'
      ? corridorZone.y + corridorZone.h
      : oy;
    candidates.push({ px: ox, py: rearY });
    candidates.push({ px: ox, py: oy });

    for (const { px, py } of candidates) {
      if (px + rW <= ox + envW && py + rH <= oy + envH && px >= ox && py >= oy) {
        servicePlaced.push({
          id: `arch-svc-${spec.id}`,
          spec,
          x: Math.round(px * 100) / 100,
          y: Math.round(py * 100) / 100,
          width: rW,
          height: rH,
          rotation: 0,
          floor: spec.floor,
          wallThickness: INT_WALL,
          doors: [], windows: [],
          finishFloor: finishes.getFloorFinish(spec.type, preferences),
          finishWall: finishes.getWallFinish(spec.type, preferences),
          finishCeiling: 'POP finish with white paint',
          ceilingHeight: spec.minHeight || 3.0,
          color: ROOM_COLORS[spec.type] || '#F3F4F6',
        });
        break;
      }
    }
  }

  // Step 6: Combine and resolve overlaps
  const allPlaced: PlacedRoom[] = [
    corridorRoom,
    ...publicPlaced,
    ...wetPlaced,
    ...privatePlaced,
    ...servicePlaced,
  ];

  const bounds = { x: ox, y: oy, w: envW, h: envH };
  const plotForOverlap = {
    width: ox + envW + setbacks.right,
    depth: oy + envH + setbacks.rear,
    area: (ox + envW + setbacks.right) * (oy + envH + setbacks.rear),
    shape: 'rectangular' as const,
    unit: plot.unit,
  };

  // Clamp to envelope
  for (let i = 0; i < allPlaced.length; i++) {
    const { room } = clampToEnvelope(allPlaced[i], setbacks, plotForOverlap);
    allPlaced[i] = room;
  }

  // Resolve overlaps (non-corridor rooms only)
  const corridorIdx = allPlaced.findIndex(r => r.id === 'arch-corridor-spine');
  const corridorFixed = corridorIdx >= 0 ? allPlaced[corridorIdx] : null;
  const nonCorridorRooms = allPlaced.filter(r => r.id !== 'arch-corridor-spine');
  resolveOverlaps(nonCorridorRooms, setbacks, plotForOverlap);

  allPlaced.length = 0;
  if (corridorFixed) allPlaced.push(corridorFixed);
  allPlaced.push(...nonCorridorRooms);

  // Step 6b: Re-enforce zone separation after overlap resolution
  if (corridorFixed) {
    const corridorBoundaryY = entranceSide === 'S' || entranceSide === 'N'
      ? corridorFixed.y
      : null;
    const corridorBoundaryX = entranceSide === 'E' || entranceSide === 'W'
      ? corridorFixed.x
      : null;

    for (let i = 0; i < allPlaced.length; i++) {
      const room = allPlaced[i];
      if (room.id === 'arch-corridor-spine') continue;
      const zone = classifyRoomZone(room.spec.type);

      if (corridorBoundaryY !== null) {
        const isPublicZone = zone === ArchitecturalZone.PUBLIC;
        const isPrivateZone = zone === ArchitecturalZone.PRIVATE || isWetRoom(room.spec.type);

        if (entranceSide === 'S') {
          if (isPublicZone && room.y >= corridorFixed.y) {
            allPlaced[i] = { ...room, y: Math.max(oy, Math.min(corridorFixed.y - room.height, oy)) };
          } else if (isPrivateZone && room.y + room.height <= corridorFixed.y + corridorFixed.height) {
            allPlaced[i] = { ...room, y: Math.min(oy + envH - room.height, corridorFixed.y + corridorFixed.height) };
          }
        } else if (entranceSide === 'N') {
          if (isPublicZone && room.y + room.height <= corridorFixed.y + corridorFixed.height) {
            allPlaced[i] = { ...room, y: Math.min(oy + envH - room.height, corridorFixed.y + corridorFixed.height) };
          } else if (isPrivateZone && room.y >= corridorFixed.y) {
            allPlaced[i] = { ...room, y: Math.max(oy, corridorFixed.y - room.height) };
          }
        }
      }
    }

    // Re-clamp after zone re-enforcement
    for (let i = 0; i < allPlaced.length; i++) {
      const { room } = clampToEnvelope(allPlaced[i], setbacks, plotForOverlap);
      allPlaced[i] = room;
    }
  }

  // Step 7: Validate entrance sequence
  const entranceSequenceValid = validateEntranceSequence(allPlaced, entranceSide);
  if (!entranceSequenceValid) {
    console.warn('[RoomPlacementEngine] Entrance sequence validation failed — bedrooms not behind living room');
  }

  return { rooms: allPlaced, context, entranceSequenceValid };
}
