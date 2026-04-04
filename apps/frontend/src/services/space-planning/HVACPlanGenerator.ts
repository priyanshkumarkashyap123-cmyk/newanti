/**
 * HVACPlanGenerator - HVAC system generation for floor plans
 *
 * Handles:
 * - AC unit sizing per room (ECBC 2017 + NBC 2016 Part 8 compliant)
 * - Fresh air units for ventilation
 * - Exhaust fans for wet rooms
 * - Duct route planning
 * - Cross-ventilation path analysis
 * - Ceiling fans and auxiliary cooling equipment
 */

import {
  FloorPlan,
  HVACPlan,
  HVACEquipment,
  VentilationPath,
  UserPreferences,
  PlumbingPipe,
  PlacedRoom,
} from './types';

export function generateHVACPlanUtil(
  floorPlans: FloorPlan[],
  preferences: UserPreferences,
  areRoomsAdjacent: (a: PlacedRoom, b: PlacedRoom) => boolean,
): HVACPlan {
  const equipment: HVACEquipment[] = [];
  const ventilationPaths: VentilationPath[] = [];
  const ductRoutes: PlumbingPipe[] = [];
  let eqId = 1;
  let totalCooling = 0;
  let ductId = 1;

  const acType: HVACEquipment['type'] =
    preferences.budget === 'luxury' || preferences.budget === 'premium' ? 'vrf_unit' : 'split_ac';

  for (const plan of floorPlans) {
    const serviceRoom =
      plan.rooms.find(
        (r) => r.spec.type === 'mechanical_room' || r.spec.type === 'utility' || r.spec.type === 'staircase',
      ) || plan.rooms[0];

    if (serviceRoom) {
      equipment.push({
        id: `FAU-${eqId++}`,
        type: 'fresh_air_unit',
        x: serviceRoom.x + 0.3,
        y: serviceRoom.y + 0.3,
        roomId: serviceRoom.id,
        capacity: 800,
        powerConsumption: 450,
      });
    }

    for (const room of plan.rooms) {
      const roomArea = room.width * room.height;

      // AC for rooms > 8 sqm (except bathrooms, corridors, etc.)
      const acEligible = [
        'living',
        'master_bedroom',
        'bedroom',
        'study',
        'home_office',
        'drawing_room',
        'guest_room',
        'childrens_room',
        'library',
        'home_theater',
        'gym',
      ].includes(room.spec.type);

      if (acEligible && roomArea > 8) {
        // ECBC 2017 + NBC 2016 Part 8 — residential cooling load per room.
        // Base: 1 TR per 12 sqm (India average for residential), adjusted for:
        //   - Ceiling height factor (higher ceiling = more volume to cool)
        //   - Floor-area × 0.083 TR/sqm base rate (≈ 1 TR/12 sqm at 3 m ceiling)
        // Round UP to nearest standard Indian AC size: 0.75, 1.0, 1.5, 2.0, 2.5, 3.0 TR
        // Reference: ECBC 2017 Appendix B, SP 41(S&T)-1987 Table 5
        const ceilingH = room.ceilingHeight || 3.0;
        const heightFactor = Math.max(0.85, Math.min(1.30, ceilingH / 3.0));
        const rawTR = roomArea * 0.0833 * heightFactor; // 0.0833 ≈ 1/12 TR per sqm
        const STD_SIZES = [0.75, 1.0, 1.5, 2.0, 2.5, 3.0] as const;
        // Round UP to next standard size (conservative — never undersize)
        const tons = STD_SIZES.find((s) => s >= rawTR) ?? 3.0;
        totalCooling += tons;
        equipment.push({
          id: `AC-${eqId++}`,
          type: acType,
          x: room.x + room.width / 2,
          y: room.y + 0.2,
          roomId: room.id,
          capacity: tons,
          powerConsumption: tons * 1200,
        });

        // Thermostat near entry side (not directly below supply)
        equipment.push({
          id: `TH-${eqId++}`,
          type: 'thermostat',
          x: room.x + 0.25,
          y: room.y + room.height / 2,
          roomId: room.id,
          powerConsumption: 5,
        });

        // Supply diffuser and return grille points
        equipment.push(
          {
            id: `DF-${eqId++}`,
            type: 'diffuser',
            x: room.x + room.width * 0.35,
            y: room.y + room.height * 0.5,
            roomId: room.id,
            capacity: Math.round((tons * 400 + Number.EPSILON) * 100) / 100,
            powerConsumption: 0,
          },
          {
            id: `GR-${eqId++}`,
            type: 'grille',
            x: room.x + room.width * 0.7,
            y: room.y + room.height * 0.5,
            roomId: room.id,
            powerConsumption: 0,
          },
        );

        if (serviceRoom) {
          ductRoutes.push({
            id: `DUCT-${ductId++}`,
            type: 'water_supply',
            startX: serviceRoom.x + serviceRoom.width / 2,
            startY: serviceRoom.y + serviceRoom.height / 2,
            endX: room.x + room.width / 2,
            endY: room.y + room.height / 2,
            diameter: Math.max(200, Math.round(tons * 120)),
            material: 'gi',
            floor: room.floor,
          });
        }
      }

      // Ceiling fan for all rooms > 6 sqm
      if (
        roomArea > 6 &&
        !['bathroom', 'toilet', 'store', 'walk_in_closet'].includes(room.spec.type)
      ) {
        equipment.push({
          id: `FAN-${eqId++}`,
          type: 'ceiling_fan',
          x: room.x + room.width / 2,
          y: room.y + room.height / 2,
          roomId: room.id,
          powerConsumption: 75,
        });
      }

      // Exhaust fan for kitchen, bathrooms
      if (['kitchen', 'bathroom', 'toilet', 'laundry'].includes(room.spec.type)) {
        equipment.push({
          id: `EXH-${eqId++}`,
          type: 'exhaust_fan',
          x: room.x + room.width - 0.3,
          y: room.y + room.height - 0.3,
          roomId: room.id,
          powerConsumption: 40,
        });

        ventilationPaths.push({
          id: `VP-MECH-${plan.floor}-${room.id}`,
          startRoomId: room.id,
          type: 'mechanical',
          airflow: room.spec.type === 'kitchen' ? 120 : room.spec.type === 'toilet' ? 70 : 90,
          direction: 'N',
        });
      }

      // Kitchen chimney
      if (room.spec.type === 'kitchen') {
        equipment.push({
          id: `CHM-${eqId++}`,
          type: 'chimney',
          x: room.x + room.width / 2,
          y: room.y + 0.3,
          roomId: room.id,
          powerConsumption: 200,
        });
      }

      // Dedicated ventilator for toilets without windows
      if (room.spec.type === 'toilet' && room.windows.length === 0) {
        equipment.push({
          id: `VNT-${eqId++}`,
          type: 'ventilator',
          x: room.x + room.width - 0.2,
          y: room.y + room.height - 0.2,
          roomId: room.id,
          capacity: 60,
          powerConsumption: 25,
        });
      }
    }

    // Cross ventilation paths
    const mainRooms = plan.rooms.filter((r) => r.spec.requiresVentilation);
    for (let i = 0; i < mainRooms.length; i++) {
      for (let j = i + 1; j < mainRooms.length; j++) {
        if (areRoomsAdjacent(mainRooms[i], mainRooms[j])) {
          ventilationPaths.push({
            id: `VP-${i}-${j}`,
            startRoomId: mainRooms[i].id,
            endRoomId: mainRooms[j].id,
            type:
              mainRooms[i].windows.length > 0 && mainRooms[j].windows.length > 0
                ? 'natural'
                : 'mixed',
            airflow: 50 + Math.round((mainRooms[i].width * mainRooms[i].height) / 3),
            direction: 'N',
          });
        }
      }
    }
  }

  return {
    equipment,
    ventilationPaths,
    coolingLoad: totalCooling,
    ventilationRate: preferences.climate === 'hot_humid' ? 8 : 6,
    freshAirPercentage: preferences.climate === 'hot_humid' ? 30 : 20,
    ductRoutes,
  };
}
