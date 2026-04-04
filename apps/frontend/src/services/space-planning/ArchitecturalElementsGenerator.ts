import type {
  PlacedRoom,
  SiteOrientation,
  DoorSpec,
  WindowSpec,
  WallSegment,
  StaircaseSpec,
} from './types';
import { DOOR_RULES, KITCHEN_LAYOUT } from './constants';
import { WINDOW_FLOOR_RATIO } from './roomPresets';
import { getExternalSides, getSharedWallSide, sharesWall } from './roomTopology';
import { isAttachedBath } from './zoning';

interface GridHelper {
  snapToGrid(v: number): number;
}

export function addDoorsAndWindows(
  rooms: PlacedRoom[],
  orientation: SiteOrientation,
  corridorZone: { x: number; y: number; w: number; h: number } | undefined,
  bounds: { x: number; y: number; w: number; h: number } | undefined,
  grid: GridHelper,
): void {
  if (!corridorZone || !bounds) return;

  const doorPositions: { x: number; y: number; w: number }[] = [];

  for (const room of rooms) {
    const rType = room.spec.type;
    const externalSides = getExternalSides(room, bounds);

    let doorWallSide: 'N' | 'S' | 'E' | 'W' = 'S';
    let doorIsAttachedBath = false;

    if (rType === 'entrance_lobby' || rType === 'foyer') {
      const entryDir = orientation.mainEntryDirection;
      if (entryDir === 'S' || entryDir === 'SE' || entryDir === 'SW') doorWallSide = 'S';
      else if (entryDir === 'N' || entryDir === 'NE' || entryDir === 'NW') doorWallSide = 'N';
      else if (entryDir === 'E') doorWallSide = 'E';
      else doorWallSide = 'W';
    } else if (isAttachedBath(rType)) {
      const parent = rooms.find(
        (r) =>
          ['master_bedroom', 'bedroom', 'guest_room', 'childrens_room'].includes(r.spec.type) &&
          sharesWall(room, r),
      );
      if (parent) {
        const sharedSide = getSharedWallSide(room, parent);
        if (sharedSide) {
          doorWallSide = sharedSide;
          doorIsAttachedBath = true;
        }
      }
    }

    if (!doorIsAttachedBath && rType !== 'entrance_lobby' && rType !== 'foyer') {
      const roomCenterY = room.y + room.height / 2;
      const corridorCenterY = corridorZone.y + corridorZone.h / 2;

      if (roomCenterY < corridorCenterY) {
        doorWallSide = 'N';
      } else {
        doorWallSide = 'S';
      }

      const roomBottom = room.y + room.height;
      const corridorTop = corridorZone.y;
      const corridorBottom = corridorZone.y + corridorZone.h;

      const vertOverlap = roomBottom > corridorTop && room.y < corridorBottom;
      if (!vertOverlap) {
        if (room.y >= corridorBottom) doorWallSide = 'S';
        else if (roomBottom <= corridorTop) doorWallSide = 'N';
      }
    }

    const doorWidth =
      rType === 'entrance_lobby' || rType === 'foyer'
        ? DOOR_RULES.MAIN_ENTRY_WIDTH
        : rType === 'bathroom' || rType === 'toilet'
          ? DOOR_RULES.BATHROOM_DOOR_WIDTH
          : rType === 'balcony' || rType === 'terrace'
            ? 1.2
            : DOOR_RULES.BEDROOM_DOOR_WIDTH;

    const wallLength = (doorWallSide === 'N' || doorWallSide === 'S') ? room.width : room.height;
    let doorPos: number = DOOR_RULES.MIN_CORNER_OFFSET;

    const maxDoorPos = wallLength - doorWidth - DOOR_RULES.MIN_CORNER_OFFSET;

    if (wallLength > doorWidth + 0.6) {
      if (['master_bedroom', 'bedroom', 'guest_room', 'childrens_room'].includes(rType)) {
        doorPos = DOOR_RULES.MIN_CORNER_OFFSET + 0.2;
      } else if (rType === 'living' || rType === 'drawing_room') {
        doorPos = (wallLength - doorWidth) / 2;
      } else if (rType === 'kitchen') {
        doorPos = Math.min(0.3, maxDoorPos);
      } else {
        doorPos = (wallLength - doorWidth) / 2;
      }
    }

    if (doorIsAttachedBath) {
      doorPos = Math.max(DOOR_RULES.MIN_CORNER_OFFSET, (wallLength - doorWidth) / 2);
    }

    doorPos = Math.max(DOOR_RULES.MIN_CORNER_OFFSET, Math.min(doorPos, maxDoorPos));
    doorPos = grid.snapToGrid(doorPos);

    const doorAbsX = (doorWallSide === 'N' || doorWallSide === 'S')
      ? room.x + doorPos
      : (doorWallSide === 'E' ? room.x + room.width : room.x);
    const doorAbsY = (doorWallSide === 'E' || doorWallSide === 'W')
      ? room.y + doorPos
      : (doorWallSide === 'N' ? room.y + room.height : room.y);

    let swingBlocked = false;
    for (const prev of doorPositions) {
      const dx = doorAbsX - prev.x;
      const dy = doorAbsY - prev.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < DOOR_RULES.SWING_CLEARANCE) {
        swingBlocked = true;
        break;
      }
    }

    if (swingBlocked && wallLength > doorWidth + DOOR_RULES.MIN_CORNER_OFFSET * 2) {
      if (doorPos < wallLength / 2) {
        doorPos = grid.snapToGrid(maxDoorPos);
      } else {
        doorPos = grid.snapToGrid(DOOR_RULES.MIN_CORNER_OFFSET);
      }
    }

    const isWet = rType === 'bathroom' || rType === 'toilet';
    const swing: 'left' | 'right' = doorPos < wallLength / 2 ? 'left' : 'right';

    const mainDoor: DoorSpec = {
      id: `door-${room.id}`,
      type: rType === 'entrance_lobby' || rType === 'foyer'
        ? 'main_entry'
        : rType === 'balcony' || rType === 'terrace'
          ? 'french'
          : 'internal',
      width: doorWidth,
      height: rType === 'entrance_lobby' ? 2.4 : 2.1,
      material:
        rType === 'entrance_lobby' ? 'wood'
          : isWet ? 'aluminum'
          : rType === 'balcony' || rType === 'terrace' ? 'aluminum'
          : 'wood',
      swing,
      roomId: room.id,
      wallSide: doorWallSide,
      position: doorPos,
    };
    room.doors.push(mainDoor);

    doorPositions.push({ x: room.x, y: room.y, w: doorWidth });

    if (room.spec.requiresWindow) {
      const externalSideList = Array.from(externalSides);
      const availableSides = externalSideList.filter((s) => s !== doorWallSide);
      const windowSides = availableSides.length > 0 ? availableSides : externalSideList;

      if (windowSides.length > 0) {
        const roomArea = room.width * room.height;
        const isHabitable = ['living', 'dining', 'master_bedroom', 'bedroom', 'drawing_room', 'guest_room', 'childrens_room', 'study', 'home_office', 'library'].includes(rType);
        const requiredRatio = isHabitable ? WINDOW_FLOOR_RATIO.habitable
          : rType === 'kitchen' ? WINDOW_FLOOR_RATIO.kitchen
          : rType === 'staircase' ? WINDOW_FLOOR_RATIO.staircase
          : WINDOW_FLOOR_RATIO.habitable;
        const minWindowArea = roomArea * requiredRatio;

        const primarySide = windowSides[0];
        const wallLen = (primarySide === 'N' || primarySide === 'S') ? room.width : room.height;

        const winHeight = 1.2;
        let winWidth = Math.max(
          rType === 'kitchen' ? 1.2 : rType === 'living' || rType === 'master_bedroom' || rType === 'drawing_room' ? 1.5 : 1.0,
          minWindowArea / winHeight,
        );
        winWidth = Math.min(winWidth, wallLen - 0.6);
        winWidth = Math.round(winWidth * 20) / 20;

        const winPos = grid.snapToGrid(Math.max(0.3, (wallLen - winWidth) / 2));

        room.windows.push({
          id: `win-${room.id}-1`,
          type: 'casement',
          width: Math.max(0.6, winWidth),
          height: winHeight,
          sillHeight: rType === 'kitchen' ? KITCHEN_LAYOUT.SILL_HEIGHT : 0.9,
          material: 'aluminum',
          glazing: 'single',
          roomId: room.id,
          wallSide: primarySide,
          position: winPos,
          operationType: 'openable',
        });

        let totalWindowArea = Math.max(0.6, winWidth) * winHeight;

        if (roomArea > 12 && windowSides.length > 1) {
          const oppositeSide = windowSides.find((s) => {
            if (primarySide === 'N') return s === 'S';
            if (primarySide === 'S') return s === 'N';
            if (primarySide === 'E') return s === 'W';
            if (primarySide === 'W') return s === 'E';
            return false;
          }) || windowSides[1];

          const oWallLen = (oppositeSide === 'N' || oppositeSide === 'S') ? room.width : room.height;
          const secWinWidth = Math.min(1.0, oWallLen - 0.6);

          room.windows.push({
            id: `win-${room.id}-2`,
            type: 'casement',
            width: Math.max(0.6, secWinWidth),
            height: 1.2,
            sillHeight: 0.9,
            material: 'aluminum',
            glazing: 'single',
            roomId: room.id,
            wallSide: oppositeSide,
            position: grid.snapToGrid(Math.max(0.3, (oWallLen - secWinWidth) / 2)),
            operationType: 'openable',
          });

          totalWindowArea += Math.max(0.6, secWinWidth) * 1.2;
        }

        if (totalWindowArea < minWindowArea && windowSides.length > 1) {
          const extraSide = windowSides.find((s) => s !== primarySide && !room.windows.some((w) => w.wallSide === s));
          if (extraSide) {
            const eWallLen = (extraSide === 'N' || extraSide === 'S') ? room.width : room.height;
            const extraWidth = Math.min((minWindowArea - totalWindowArea) / 1.2, eWallLen - 0.6);
            if (extraWidth >= 0.6) {
              room.windows.push({
                id: `win-${room.id}-3`,
                type: 'casement',
                width: Math.round(extraWidth * 20) / 20,
                height: 1.2,
                sillHeight: 0.9,
                material: 'aluminum',
                glazing: 'single',
                roomId: room.id,
                wallSide: extraSide,
                position: grid.snapToGrid(Math.max(0.3, (eWallLen - extraWidth) / 2)),
                operationType: 'openable',
              });
            }
          }
        }
      }
    }

    if (isWet) {
      const ventSide = Array.from(externalSides).find((s) => s !== doorWallSide);
      if (ventSide) {
        const vWallLen = (ventSide === 'N' || ventSide === 'S') ? room.width : room.height;
        room.windows.push({
          id: `vent-${room.id}`,
          type: 'louvered',
          width: 0.6,
          height: 0.6,
          sillHeight: 2.0,
          material: 'aluminum',
          glazing: 'single',
          roomId: room.id,
          wallSide: ventSide,
          position: grid.snapToGrid(Math.max(0.15, vWallLen - 0.8)),
          operationType: 'openable',
        });
      }
    }
  }
}

export function generateWalls(
  rooms: PlacedRoom[],
  buildableWidth: number,
  buildableDepth: number,
  setbacks: { front: number; rear: number; left: number; right: number },
): WallSegment[] {
  const walls: WallSegment[] = [];
  let wallId = 1;
  const EXT_T = 0.23;
  const INT_T = 0.115;

  const ox = setbacks.left;
  const oy = setbacks.front;
  walls.push(
    { id: `W${wallId++}`, startX: ox, startY: oy, endX: ox + buildableWidth, endY: oy, thickness: EXT_T, type: 'external', material: 'brick' },
    { id: `W${wallId++}`, startX: ox + buildableWidth, startY: oy, endX: ox + buildableWidth, endY: oy + buildableDepth, thickness: EXT_T, type: 'external', material: 'brick' },
    { id: `W${wallId++}`, startX: ox + buildableWidth, startY: oy + buildableDepth, endX: ox, endY: oy + buildableDepth, thickness: EXT_T, type: 'external', material: 'brick' },
    { id: `W${wallId++}`, startX: ox, startY: oy + buildableDepth, endX: ox, endY: oy, thickness: EXT_T, type: 'external', material: 'brick' },
  );

  const EPS = 0.15;
  const wallSet = new Map<string, WallSegment>();

  const addWall = (sx: number, sy: number, ex: number, ey: number) => {
    const [nsx, nsy, nex, ney] =
      sx < ex || (sx === ex && sy < ey)
        ? [sx, sy, ex, ey]
        : [ex, ey, sx, sy];

    const key = `${nsx.toFixed(2)}_${nsy.toFixed(2)}_${nex.toFixed(2)}_${ney.toFixed(2)}`;
    if (!wallSet.has(key)) {
      const onBoundary =
        (Math.abs(nsy - oy) < EPS && Math.abs(ney - oy) < EPS) ||
        (Math.abs(nsy - (oy + buildableDepth)) < EPS && Math.abs(ney - (oy + buildableDepth)) < EPS) ||
        (Math.abs(nsx - ox) < EPS && Math.abs(nex - ox) < EPS) ||
        (Math.abs(nsx - (ox + buildableWidth)) < EPS && Math.abs(nex - (ox + buildableWidth)) < EPS);

      wallSet.set(key, {
        id: `W${wallId++}`,
        startX: nsx, startY: nsy, endX: nex, endY: ney,
        thickness: onBoundary ? EXT_T : INT_T,
        type: onBoundary ? 'external' : 'internal',
        material: 'brick',
      });
    }
  };

  for (const room of rooms) {
    const rx = room.x;
    const ry = room.y;
    const rr = rx + room.width;
    const rb = ry + room.height;
    addWall(rx, ry, rr, ry);
    addWall(rr, ry, rr, rb);
    addWall(rr, rb, rx, rb);
    addWall(rx, rb, rx, ry);
  }

  walls.push(...wallSet.values());
  return walls;
}

export function generateCorridors(
  buildableWidth: number,
  buildableDepth: number,
  corridorZone: { x: number; y: number; w: number; h: number } | undefined,
): Array<{ x: number; y: number; width: number; height: number }> {
  if (corridorZone) {
    return [{
      x: corridorZone.x,
      y: corridorZone.y,
      width: corridorZone.w,
      height: corridorZone.h,
    }];
  }
  return [{ x: 0, y: buildableDepth * 0.4, width: buildableWidth, height: 1.2 }];
}

export function generateStaircases(rooms: PlacedRoom[]): StaircaseSpec[] {
  const staircaseRoom = rooms.find((r) => r.spec.type === 'staircase');
  if (!staircaseRoom) return [];

  const floorHeight = staircaseRoom.ceilingHeight || 3.0;
  const slabThickness = 0.15;
  const totalRise = floorHeight + slabThickness;

  const idealRiser = 0.15;
  let numRisers = Math.round(totalRise / idealRiser);
  let riserHeight = totalRise / numRisers;

  if (riserHeight > 0.19) {
    numRisers = Math.ceil(totalRise / 0.19);
    riserHeight = totalRise / numRisers;
  }
  if (riserHeight < 0.13) {
    numRisers = Math.floor(totalRise / 0.13);
    riserHeight = totalRise / numRisers;
  }

  const treadDepth = Math.max(0.25, 0.62 - 2 * riserHeight);
  const treadRounded = Math.round(treadDepth * 100) / 100;
  const stairWidth = Math.max(1.2, Math.min(staircaseRoom.width, 1.5));
  const landingWidth = stairWidth;

  return [{
    id: 'staircase-1',
    type: 'dog_leg',
    width: Math.round(stairWidth * 100) / 100,
    riserHeight: Math.round(riserHeight * 1000) / 1000,
    treadDepth: treadRounded,
    numRisers,
    landingWidth: Math.round(landingWidth * 100) / 100,
    handrailHeight: 0.9,
    x: staircaseRoom.x,
    y: staircaseRoom.y,
    rotation: 0,
  }];
}
