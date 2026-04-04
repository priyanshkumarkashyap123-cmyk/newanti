/**
 * PlumbingPlanGenerator - Plumbing system generation for floor plans
 *
 * Handles:
 * - Fixture placement per room (sinks, WCs, showers, etc.)
 * - Water supply and drainage pipe routing
 * - Rainwater harvesting integration
 * - IS 1172:1993 fixture unit method for pipe sizing
 * - Hot water circulation
 * - Wastewater treatment fixtures (inspection chambers, sumps, tanks)
 */

import {
  FloorPlan,
  PlumbingPlan,
  PlumbingFixture,
  PlumbingPipe,
} from './types';

export function generatePlumbingPlanUtil(
  floorPlans: FloorPlan[],
  generateFixturesForRoom: (room: FloorPlan['rooms'][0], startId: number) => PlumbingFixture[],
): PlumbingPlan {
  const fixtures: PlumbingFixture[] = [];
  const pipes: PlumbingPipe[] = [];
  let fixtureId = 1;

  for (const plan of floorPlans) {
    for (const room of plan.rooms) {
      const roomFixtures = generateFixturesForRoom(room, fixtureId);
      fixtures.push(...roomFixtures);
      fixtureId += roomFixtures.length;
    }
  }

  // Generate pipe runs connecting fixtures to risers
  const wetRooms = floorPlans.flatMap((fp) =>
    fp.rooms.filter((r) =>
      ['bathroom', 'toilet', 'kitchen', 'laundry', 'utility'].includes(r.spec.type),
    ),
  );

  if (wetRooms.length > 0) {
    // Prefer centralized wet-core room as main stack anchor
    const mainStack = [...wetRooms].sort((a, b) => {
      const aScore = a.spec.type === 'bathroom' || a.spec.type === 'toilet' ? 0 : 1;
      const bScore = b.spec.type === 'bathroom' || b.spec.type === 'toilet' ? 0 : 1;
      return aScore - bScore;
    })[0];

    let pipeId = 1;
    for (const room of wetRooms) {
      const roomCx = room.x + room.width / 2;
      const roomCy = room.y + room.height / 2;
      const stackX = mainStack.x + mainStack.width / 2;
      const stackY = mainStack.y + mainStack.height / 2;

      // IS 1172:1993 fixture unit method — Table 6-1 for branch pipe sizing.
      // Fixture units per room type:
      //   bathroom (WC+washbasin+shower): 6+1+2 = 9 FU → 25 mm branch
      //   toilet (WC only): 6 FU → 25 mm branch
      //   kitchen (sink+dishwasher): 3+2 = 5 FU → 20 mm branch
      //   laundry/utility (washing machine): 4 FU → 20 mm branch
      //   pantry (sink): 1 FU → 15 mm (use 20 mm for practical minimum)
      const FIXTURE_UNITS: Record<string, number> = {
        bathroom: 9, toilet: 6, kitchen: 5, laundry: 4, utility: 4, pantry: 2,
      };
      const fu = FIXTURE_UNITS[room.spec.type] ?? 3;
      // IS 1172 Table 6-1: 1-5 FU → 20mm, 6-12 FU → 25mm, 13-25 FU → 32mm
      const wsDiam = fu >= 13 ? 32 : fu >= 6 ? 25 : 20;
      // Drainage: IS 1172 cl. 9.4 — branch drain min 50mm for WC, 32mm others
      const drDiam = ['bathroom', 'toilet'].includes(room.spec.type) ? 100 : 75;

      pipes.push({
        id: `WS-${pipeId}`,
        type: 'water_supply',
        startX: stackX,
        startY: stackY,
        endX: roomCx,
        endY: roomCy,
        diameter: wsDiam,
        material: 'cpvc',
        floor: room.floor,
      });
      pipes.push({
        id: `DR-${pipeId}`,
        type: 'drainage',
        startX: roomCx,
        startY: roomCy,
        endX: stackX,
        endY: stackY,
        diameter: drDiam,
        material: 'upvc',
        slope: 0.02,
        floor: room.floor,
      });

      // Vent stack for every wet room branch
      pipes.push({
        id: `VT-${pipeId}`,
        type: 'vent',
        startX: roomCx + 0.1,
        startY: roomCy,
        endX: roomCx + 0.1,
        endY: roomCy + 1.5,
        diameter: 75,
        material: 'upvc',
        floor: room.floor,
      });

      // Hot water line for bath/kitchen fixtures
      if (['bathroom', 'kitchen', 'utility', 'laundry'].includes(room.spec.type)) {
        pipes.push({
          id: `HW-${pipeId}`,
          type: 'hot_water',
          startX: stackX - 0.15,
          startY: stackY,
          endX: roomCx - 0.15,
          endY: roomCy,
          diameter: 20,
          material: 'cpvc',
          floor: room.floor,
        });
      }

      pipeId++;
    }

    // Site-level wastewater disposal fixture nodes
    const firstGroundRoom = floorPlans
      .flatMap((fp) => fp.rooms)
      .find((r) => r.floor === 0);

    if (firstGroundRoom) {
      fixtures.push(
        {
          id: `PF-${fixtureId++}`,
          type: 'inspection_chamber',
          x: Math.round((firstGroundRoom.x - 0.6) * 100) / 100,
          y: Math.round((firstGroundRoom.y - 0.6) * 100) / 100,
          roomId: firstGroundRoom.id,
          waterSupply: false,
          drainage: true,
          hotWater: false,
          pipeSize: 150,
        },
        {
          id: `PF-${fixtureId++}`,
          type: 'rain_water_harvest',
          x: Math.round((firstGroundRoom.x - 1.0) * 100) / 100,
          y: Math.round((firstGroundRoom.y - 1.0) * 100) / 100,
          roomId: firstGroundRoom.id,
          waterSupply: false,
          drainage: true,
          hotWater: false,
          pipeSize: 160,
        },
        {
          id: `PF-${fixtureId++}`,
          type: 'sump',
          x: Math.round((firstGroundRoom.x - 0.8) * 100) / 100,
          y: Math.round((firstGroundRoom.y + 0.2) * 100) / 100,
          roomId: firstGroundRoom.id,
          waterSupply: true,
          drainage: false,
          hotWater: false,
          pipeSize: 50,
        },
        {
          id: `PF-${fixtureId++}`,
          type: 'overhead_tank',
          x: Math.round((firstGroundRoom.x + 0.2) * 100) / 100,
          y: Math.round((firstGroundRoom.y + 0.2) * 100) / 100,
          roomId: firstGroundRoom.id,
          waterSupply: true,
          drainage: false,
          hotWater: false,
          pipeSize: 50,
        },
        {
          id: `PF-${fixtureId++}`,
          type: 'pressure_pump',
          x: Math.round((firstGroundRoom.x - 0.4) * 100) / 100,
          y: Math.round((firstGroundRoom.y + 0.1) * 100) / 100,
          roomId: firstGroundRoom.id,
          waterSupply: true,
          drainage: false,
          hotWater: false,
          pipeSize: 40,
        },
      );

      // Rainwater downpipe abstraction (roof -> harvest pit)
      pipes.push({
        id: 'RW-1',
        type: 'rain_water',
        startX: firstGroundRoom.x,
        startY: firstGroundRoom.y + 3.0,
        endX: firstGroundRoom.x - 1.0,
        endY: firstGroundRoom.y - 1.0,
        diameter: 110,
        material: 'upvc',
        slope: 0.01,
        floor: 0,
      });
    }
  }

  return {
    fixtures,
    pipes,
    waterSupplySource: 'both',
    storageCapacity: 5000,
    overheadTankCapacity: 2000,
    sumpCapacity: 3000,
    pumpHP: 1.0,
    sewageDisposal: 'municipal',
    rainwaterHarvesting: true,
    hotWaterSystem: 'solar',
    recyclingSystem: false,
  };
}
