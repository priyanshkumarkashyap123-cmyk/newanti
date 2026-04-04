import type { ElectricalFixture, PlumbingFixture, PlacedRoom } from './types';
import { BATHROOM_ZONES, KITCHEN_LAYOUT } from './constants';

export function generateElectricalFixturesForRoom(
  room: PlacedRoom,
  startId: number,
): ElectricalFixture[] {
  const fixtures: ElectricalFixture[] = [];
  const type = room.spec.type;
  let id = startId;

  const doorWall = room.doors.length > 0 ? room.doors[0].wallSide : 'S';
  const doorPos = room.doors.length > 0 ? (room.doors[0].position || 0) : 0;
  const doorWidth = room.doors.length > 0 ? room.doors[0].width : 0.9;

  fixtures.push({
    id: `EF-${id++}`,
    type: 'light_point',
    x: room.x + room.width / 2,
    y: room.y + room.height / 2,
    roomId: room.id,
    circuit: 'CKT-LIGHT',
    wattage: type === 'living' || type === 'master_bedroom' ? 100 : 60,
    height: room.ceilingHeight,
  });

  let switchX: number;
  let switchY: number;
  if (doorWall === 'S') {
    switchX = room.x + doorPos + doorWidth + 0.15;
    switchY = room.y + 0.05;
  } else if (doorWall === 'N') {
    switchX = room.x + doorPos + doorWidth + 0.15;
    switchY = room.y + room.height - 0.05;
  } else if (doorWall === 'E') {
    switchX = room.x + room.width - 0.05;
    switchY = room.y + doorPos + doorWidth + 0.15;
  } else {
    switchX = room.x + 0.05;
    switchY = room.y + doorPos + doorWidth + 0.15;
  }
  switchX = Math.max(room.x + 0.05, Math.min(switchX, room.x + room.width - 0.05));
  switchY = Math.max(room.y + 0.05, Math.min(switchY, room.y + room.height - 0.05));

  fixtures.push({
    id: `EF-${id++}`,
    type: 'switch',
    x: Math.round(switchX * 100) / 100,
    y: Math.round(switchY * 100) / 100,
    roomId: room.id,
    circuit: 'CKT-LIGHT',
    wattage: 0,
    height: 1.2,
  });

  const socketHeight = type === 'kitchen' ? 1.1 : 0.3;
  const socketCount =
    type === 'living' || type === 'drawing_room' ? 4
    : type === 'kitchen' ? 5
    : type === 'master_bedroom' ? 4
    : type === 'bedroom' || type === 'guest_room' ? 3
    : type === 'study' || type === 'home_office' ? 4
    : 1;

  const walls = ['N', 'S', 'E', 'W'].filter((w) => w !== doorWall) as ('N' | 'S' | 'E' | 'W')[];

  for (let i = 0; i < socketCount; i++) {
    const wall = walls[i % walls.length];
    const wallLen = (wall === 'N' || wall === 'S') ? room.width : room.height;
    const pos = ((i + 1) / (Math.ceil(socketCount / walls.length) + 1)) * wallLen;

    let sx: number;
    let sy: number;
    if (wall === 'S') { sx = room.x + pos; sy = room.y + 0.05; }
    else if (wall === 'N') { sx = room.x + pos; sy = room.y + room.height - 0.05; }
    else if (wall === 'E') { sx = room.x + room.width - 0.05; sy = room.y + pos; }
    else { sx = room.x + 0.05; sy = room.y + pos; }

    fixtures.push({
      id: `EF-${id++}`,
      type: 'socket',
      x: Math.round(sx * 100) / 100,
      y: Math.round(sy * 100) / 100,
      roomId: room.id,
      circuit: type === 'kitchen' ? 'CKT-KITCHEN' : 'CKT-POWER',
      wattage: 200,
      height: socketHeight,
    });
  }

  if (['living', 'dining', 'master_bedroom', 'bedroom', 'study', 'drawing_room', 'guest_room', 'childrens_room'].includes(type)) {
    fixtures.push({
      id: `EF-${id++}`,
      type: 'fan_point',
      x: room.x + room.width / 2,
      y: room.y + room.height / 2,
      roomId: room.id,
      circuit: 'CKT-LIGHT',
      wattage: 75,
      height: room.ceilingHeight,
    });
  }

  if (['living', 'master_bedroom', 'bedroom', 'study', 'home_office', 'guest_room'].includes(type)) {
    const acWall: 'N' | 'S' | 'E' | 'W' = doorWall === 'N' ? 'S' : doorWall === 'S' ? 'N' : doorWall === 'E' ? 'W' : 'E';
    let acX: number;
    let acY: number;
    if (acWall === 'N') { acX = room.x + room.width / 2; acY = room.y + room.height - 0.15; }
    else if (acWall === 'S') { acX = room.x + room.width / 2; acY = room.y + 0.15; }
    else if (acWall === 'E') { acX = room.x + room.width - 0.15; acY = room.y + room.height / 2; }
    else { acX = room.x + 0.15; acY = room.y + room.height / 2; }

    fixtures.push({
      id: `EF-${id++}`,
      type: 'ac_point',
      x: Math.round(acX * 100) / 100,
      y: Math.round(acY * 100) / 100,
      roomId: room.id,
      circuit: 'CKT-AC',
      wattage: 1500,
      height: 2.4,
    });
  }

  if (type === 'kitchen') {
    fixtures.push({
      id: `EF-${id++}`,
      type: 'exhaust_fan',
      x: room.x + room.width - 0.3,
      y: room.y + 0.3,
      roomId: room.id,
      circuit: 'CKT-KITCHEN',
      wattage: 40,
      height: 2.4,
    });
    fixtures.push({
      id: `EF-${id++}`,
      type: 'geyser_point',
      x: room.x + 0.5,
      y: room.y + room.height - 0.3,
      roomId: room.id,
      circuit: 'CKT-GEYSER',
      wattage: 2000,
      height: 1.8,
    });
  }

  if (type === 'bathroom') {
    fixtures.push({
      id: `EF-${id++}`,
      type: 'geyser_point',
      x: room.x + 0.3,
      y: room.y + 0.3,
      roomId: room.id,
      circuit: 'CKT-GEYSER',
      wattage: 2000,
      height: 1.8,
    });
    fixtures.push({
      id: `EF-${id++}`,
      type: 'exhaust_fan',
      x: room.x + room.width - 0.3,
      y: room.y + room.height - 0.3,
      roomId: room.id,
      circuit: 'CKT-LIGHT',
      wattage: 25,
      height: 2.4,
    });
  }

  return fixtures;
}

export function generatePlumbingFixturesForRoom(room: PlacedRoom, startId: number): PlumbingFixture[] {
  const fixtures: PlumbingFixture[] = [];
  const type = room.spec.type;
  let id = startId;

  const doorWall = room.doors.length > 0 ? room.doors[0].wallSide : 'S';
  const oppositeWall = doorWall === 'N' ? 'S' : doorWall === 'S' ? 'N' : doorWall === 'E' ? 'W' : 'E';

  if (type === 'bathroom') {
    const rW = room.width;
    const rH = room.height;

    let wcX: number;
    let wcY: number;
    if (oppositeWall === 'N') {
      wcX = room.x + BATHROOM_ZONES.WC_CLEARANCE_SIDE + BATHROOM_ZONES.WC_WIDTH / 2;
      wcY = room.y + rH - BATHROOM_ZONES.WC_DEPTH;
    } else if (oppositeWall === 'S') {
      wcX = room.x + BATHROOM_ZONES.WC_CLEARANCE_SIDE + BATHROOM_ZONES.WC_WIDTH / 2;
      wcY = room.y + BATHROOM_ZONES.WC_DEPTH;
    } else if (oppositeWall === 'E') {
      wcX = room.x + rW - BATHROOM_ZONES.WC_DEPTH;
      wcY = room.y + rH - BATHROOM_ZONES.WC_CLEARANCE_SIDE - BATHROOM_ZONES.WC_WIDTH / 2;
    } else {
      wcX = room.x + BATHROOM_ZONES.WC_DEPTH;
      wcY = room.y + rH - BATHROOM_ZONES.WC_CLEARANCE_SIDE - BATHROOM_ZONES.WC_WIDTH / 2;
    }

    fixtures.push({
      id: `PF-${id++}`,
      type: 'wc',
      x: Math.round(wcX * 100) / 100,
      y: Math.round(wcY * 100) / 100,
      roomId: room.id,
      waterSupply: true,
      drainage: true,
      hotWater: false,
      pipeSize: 100,
    });

    let basinX: number;
    let basinY: number;
    if (doorWall === 'N') {
      basinX = room.x + rW - BATHROOM_ZONES.BASIN_WIDTH - 0.1;
      basinY = room.y + rH - BATHROOM_ZONES.BASIN_DEPTH;
    } else if (doorWall === 'S') {
      basinX = room.x + rW - BATHROOM_ZONES.BASIN_WIDTH - 0.1;
      basinY = room.y + BATHROOM_ZONES.BASIN_DEPTH;
    } else if (doorWall === 'E') {
      basinX = room.x + rW - BATHROOM_ZONES.BASIN_DEPTH;
      basinY = room.y + 0.1;
    } else {
      basinX = room.x + BATHROOM_ZONES.BASIN_DEPTH;
      basinY = room.y + 0.1;
    }

    fixtures.push({
      id: `PF-${id++}`,
      type: 'wash_basin',
      x: Math.round(basinX * 100) / 100,
      y: Math.round(basinY * 100) / 100,
      roomId: room.id,
      waterSupply: true,
      drainage: true,
      hotWater: true,
      pipeSize: 15,
    });

    const showerSize = Math.min(BATHROOM_ZONES.SHOWER_PREFERRED, Math.max(BATHROOM_ZONES.SHOWER_MIN_SIZE, Math.min(rW, rH) * 0.4));
    let showerX: number;
    let showerY: number;
    if (oppositeWall === 'N') {
      showerX = room.x + rW - showerSize / 2 - 0.1;
      showerY = room.y + showerSize / 2 + 0.1;
    } else if (oppositeWall === 'S') {
      showerX = room.x + rW - showerSize / 2 - 0.1;
      showerY = room.y + rH - showerSize / 2 - 0.1;
    } else {
      showerX = room.x + rW - showerSize / 2 - 0.1;
      showerY = room.y + rH - showerSize / 2 - 0.1;
    }

    fixtures.push({
      id: `PF-${id++}`,
      type: 'shower',
      x: Math.round(showerX * 100) / 100,
      y: Math.round(showerY * 100) / 100,
      roomId: room.id,
      waterSupply: true,
      drainage: true,
      hotWater: true,
      pipeSize: 20,
    });

    fixtures.push({
      id: `PF-${id++}`,
      type: 'floor_trap',
      x: Math.round((room.x + rW / 2) * 100) / 100,
      y: Math.round((room.y + rH / 2) * 100) / 100,
      roomId: room.id,
      waterSupply: false,
      drainage: true,
      hotWater: false,
      pipeSize: 80,
    });
  }

  if (type === 'toilet') {
    const rW = room.width;
    const rH = room.height;

    let wcX: number;
    let wcY: number;
    if (oppositeWall === 'N') {
      wcX = room.x + rW / 2;
      wcY = room.y + rH - BATHROOM_ZONES.WC_DEPTH;
    } else if (oppositeWall === 'S') {
      wcX = room.x + rW / 2;
      wcY = room.y + BATHROOM_ZONES.WC_DEPTH;
    } else {
      wcX = room.x + rW / 2;
      wcY = room.y + rH / 2;
    }

    fixtures.push({
      id: `PF-${id++}`,
      type: 'wc',
      x: Math.round(wcX * 100) / 100,
      y: Math.round(wcY * 100) / 100,
      roomId: room.id,
      waterSupply: true,
      drainage: true,
      hotWater: false,
      pipeSize: 100,
    });

    if (rW >= 1.2) {
      let basinX: number;
      let basinY: number;
      if (doorWall === 'S') {
        basinX = room.x + rW - 0.4;
        basinY = room.y + 0.3;
      } else {
        basinX = room.x + rW - 0.4;
        basinY = room.y + rH - 0.3;
      }
      fixtures.push({
        id: `PF-${id++}`,
        type: 'wash_basin',
        x: Math.round(basinX * 100) / 100,
        y: Math.round(basinY * 100) / 100,
        roomId: room.id,
        waterSupply: true,
        drainage: true,
        hotWater: false,
        pipeSize: 15,
      });
    }

    fixtures.push({
      id: `PF-${id++}`,
      type: 'floor_trap',
      x: Math.round((room.x + rW * 0.3) * 100) / 100,
      y: Math.round((room.y + rH * 0.5) * 100) / 100,
      roomId: room.id,
      waterSupply: false,
      drainage: true,
      hotWater: false,
      pipeSize: 80,
    });
  }

  if (type === 'kitchen') {
    const rW = room.width;
    const rH = room.height;
    const platformDepth = KITCHEN_LAYOUT.PLATFORM_DEPTH;
    const windowWall = room.windows.length > 0 ? room.windows[0].wallSide : oppositeWall;

    let sinkX: number;
    let sinkY: number;
    if (windowWall === 'N') {
      sinkX = room.x + rW / 2;
      sinkY = room.y + rH - platformDepth / 2;
    } else if (windowWall === 'S') {
      sinkX = room.x + rW / 2;
      sinkY = room.y + platformDepth / 2;
    } else if (windowWall === 'E') {
      sinkX = room.x + rW - platformDepth / 2;
      sinkY = room.y + rH / 2;
    } else {
      sinkX = room.x + platformDepth / 2;
      sinkY = room.y + rH / 2;
    }

    fixtures.push({
      id: `PF-${id++}`,
      type: 'kitchen_sink',
      x: Math.round(sinkX * 100) / 100,
      y: Math.round(sinkY * 100) / 100,
      roomId: room.id,
      waterSupply: true,
      drainage: true,
      hotWater: true,
      pipeSize: 20,
    });

    fixtures.push({
      id: `PF-${id++}`,
      type: 'floor_trap',
      x: Math.round(sinkX * 100) / 100,
      y: Math.round((sinkY + 0.15) * 100) / 100,
      roomId: room.id,
      waterSupply: false,
      drainage: true,
      hotWater: false,
      pipeSize: 80,
    });
  }

  if (type === 'laundry' || type === 'utility') {
    fixtures.push(
      {
        id: `PF-${id++}`,
        type: 'utility_sink',
        x: room.x + 0.5,
        y: room.y + 0.4,
        roomId: room.id,
        waterSupply: true,
        drainage: true,
        hotWater: true,
        pipeSize: 20,
      },
      {
        id: `PF-${id++}`,
        type: 'washing_machine',
        x: room.x + room.width - 0.5,
        y: room.y + 0.5,
        roomId: room.id,
        waterSupply: true,
        drainage: true,
        hotWater: true,
        pipeSize: 20,
      },
      {
        id: `PF-${id++}`,
        type: 'floor_trap',
        x: room.x + room.width / 2,
        y: room.y + room.height / 2,
        roomId: room.id,
        waterSupply: false,
        drainage: true,
        hotWater: false,
        pipeSize: 80,
      },
    );
  }

  return fixtures;
}
