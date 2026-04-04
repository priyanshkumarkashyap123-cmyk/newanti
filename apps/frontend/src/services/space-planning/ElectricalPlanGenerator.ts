/**
 * ElectricalPlanGenerator - Electrical system generation for floor plans
 *
 * Handles:
 * - Fixture placement per room (lights, outlets, special equipment)
 * - Distribution board and service points
 * - Circuit grouping and load calculations
 * - IS 732:1989 electrical code compliance
 * - MCB sizing, wire sizing, demand load diversity
 */

import {
  FloorPlan,
  ElectricalPlan,
  ElectricalFixture,
  ElectricalCircuit,
} from './types';

export function generateElectricalPlanUtil(
  floorPlans: FloorPlan[],
  generateFixturesForRoom: (room: FloorPlan['rooms'][0], startId: number) => ElectricalFixture[],
): ElectricalPlan {
  const fixtures: ElectricalFixture[] = [];
  const circuits: ElectricalCircuit[] = [];
  const panels: ElectricalPlan['panels'] = [];
  let fixtureId = 1;

  for (const plan of floorPlans) {
    for (const room of plan.rooms) {
      const roomFixtures = generateFixturesForRoom(room, fixtureId);
      fixtures.push(...roomFixtures);
      fixtureId += roomFixtures.length;

      // Life-safety and low-voltage points
      const roomArea = room.width * room.height;
      const habitable = [
        'living',
        'dining',
        'master_bedroom',
        'bedroom',
        'study',
        'drawing_room',
        'guest_room',
        'childrens_room',
        'home_office',
      ].includes(room.spec.type);

      if (habitable && roomArea > 8) {
        fixtures.push({
          id: `EF-${fixtureId++}`,
          type: 'smoke_detector',
          x: Math.round((room.x + room.width / 2) * 100) / 100,
          y: Math.round((room.y + room.height / 2) * 100) / 100,
          roomId: room.id,
          circuit: 'CKT-LIGHT',
          wattage: 3,
          height: room.ceilingHeight,
        });
      }

      if (room.spec.type === 'entrance_lobby' || room.spec.type === 'foyer') {
        fixtures.push({
          id: `EF-${fixtureId++}`,
          type: 'bell_point',
          x: Math.round((room.x + 0.3) * 100) / 100,
          y: Math.round((room.y + 0.2) * 100) / 100,
          roomId: room.id,
          circuit: 'CKT-LIGHT',
          wattage: 5,
          height: 1.4,
        });
        fixtures.push({
          id: `EF-${fixtureId++}`,
          type: 'cctv',
          x: Math.round((room.x + room.width - 0.2) * 100) / 100,
          y: Math.round((room.y + room.height - 0.2) * 100) / 100,
          roomId: room.id,
          circuit: 'CKT-POWER',
          wattage: 15,
          height: 2.7,
        });
      }

      if (room.spec.type === 'staircase' || room.spec.type === 'corridor') {
        fixtures.push({
          id: `EF-${fixtureId++}`,
          type: 'emergency_light',
          x: Math.round((room.x + room.width / 2) * 100) / 100,
          y: Math.round((room.y + room.height / 2) * 100) / 100,
          roomId: room.id,
          circuit: 'CKT-LIGHT',
          wattage: 10,
          height: 2.2,
        });
        fixtures.push({
          id: `EF-${fixtureId++}`,
          type: 'motion_sensor',
          x: Math.round((room.x + room.width / 2) * 100) / 100,
          y: Math.round((room.y + room.height - 0.2) * 100) / 100,
          roomId: room.id,
          circuit: 'CKT-LIGHT',
          wattage: 3,
          height: 2.4,
        });
      }

      if (room.spec.type === 'living' || room.spec.type === 'home_theater') {
        fixtures.push({
          id: `EF-${fixtureId++}`,
          type: 'tv_point',
          x: Math.round((room.x + room.width - 0.1) * 100) / 100,
          y: Math.round((room.y + room.height / 2) * 100) / 100,
          roomId: room.id,
          circuit: 'CKT-POWER',
          wattage: 150,
          height: 0.6,
        });
        fixtures.push({
          id: `EF-${fixtureId++}`,
          type: 'data_point',
          x: Math.round((room.x + room.width - 0.1) * 100) / 100,
          y: Math.round((room.y + room.height / 2 + 0.2) * 100) / 100,
          roomId: room.id,
          circuit: 'CKT-POWER',
          wattage: 10,
          height: 0.3,
        });
      }
    }

    // Add distribution board
    const electricalRoom =
      plan.rooms.find(
        (r) =>
          r.spec.type === 'electrical_panel' ||
          r.spec.type === 'utility' ||
          r.spec.type === 'entrance_lobby',
      ) || plan.rooms[0];
    if (electricalRoom) {
      panels.push({
        id: `DB-${plan.floor}`,
        name: `Distribution Board - ${plan.label}`,
        x: electricalRoom.x + 0.3,
        y: electricalRoom.y + 0.3,
        roomId: electricalRoom.id,
        circuits: [],
      });
    }
  }

  // Main service points (entry/electrical room)
  const serviceRoom =
    floorPlans
      .flatMap((fp) => fp.rooms)
      .find(
        (r) =>
          r.spec.type === 'electrical_panel' ||
          r.spec.type === 'utility' ||
          r.spec.type === 'entrance_lobby',
      ) || floorPlans[0]?.rooms[0];

  if (serviceRoom) {
    fixtures.push(
      {
        id: `EF-${fixtureId++}`,
        type: 'distribution_board',
        x: Math.round((serviceRoom.x + 0.25) * 100) / 100,
        y: Math.round((serviceRoom.y + 0.25) * 100) / 100,
        roomId: serviceRoom.id,
        circuit: 'CKT-MOTOR',
        wattage: 0,
        height: 1.5,
      },
      {
        id: `EF-${fixtureId++}`,
        type: 'meter_board',
        x: Math.round((serviceRoom.x + 0.15) * 100) / 100,
        y: Math.round((serviceRoom.y + 0.15) * 100) / 100,
        roomId: serviceRoom.id,
        circuit: 'CKT-MOTOR',
        wattage: 0,
        height: 1.5,
      },
      {
        id: `EF-${fixtureId++}`,
        type: 'earth_point',
        x: Math.round((serviceRoom.x + 0.1) * 100) / 100,
        y: Math.round((serviceRoom.y + 0.1) * 100) / 100,
        roomId: serviceRoom.id,
        circuit: 'CKT-MOTOR',
        wattage: 0,
        height: 0,
      },
    );

    if (floorPlans.length <= 2) {
      fixtures.push({
        id: `EF-${fixtureId++}`,
        type: 'inverter_point',
        x: Math.round((serviceRoom.x + 0.4) * 100) / 100,
        y: Math.round((serviceRoom.y + 0.25) * 100) / 100,
        roomId: serviceRoom.id,
        circuit: 'CKT-MOTOR',
        wattage: 1200,
        height: 0.6,
      });
    }
  }

  // EV charging point in parking/garage
  const parkingRoom = floorPlans
    .flatMap((fp) => fp.rooms)
    .find((r) => r.spec.type === 'parking' || r.spec.type === 'garage');
  if (parkingRoom) {
    fixtures.push({
      id: `EF-${fixtureId++}`,
      type: 'ev_charging',
      x: Math.round((parkingRoom.x + 0.5) * 100) / 100,
      y: Math.round((parkingRoom.y + 0.5) * 100) / 100,
      roomId: parkingRoom.id,
      circuit: 'CKT-MOTOR',
      wattage: 7200,
      height: 1.2,
    });
  }

  // Group fixtures into circuits (after all fixtures are generated)
  const circuitSpecs: Array<{
    id: string;
    name: string;
    type: ElectricalCircuit['type'];
    phase: 1 | 3;
    minWireSizeSqmm: number;
  }> = [
    { id: 'CKT-LIGHT', name: 'Lighting Circuit', type: 'lighting', phase: 1, minWireSizeSqmm: 1.5 },
    { id: 'CKT-POWER', name: 'Power Circuit', type: 'power', phase: 1, minWireSizeSqmm: 2.5 },
    { id: 'CKT-AC', name: 'AC Circuit', type: 'ac', phase: 1, minWireSizeSqmm: 4.0 },
    { id: 'CKT-KITCHEN', name: 'Kitchen Circuit', type: 'kitchen', phase: 1, minWireSizeSqmm: 4.0 },
    { id: 'CKT-GEYSER', name: 'Water Heater Circuit', type: 'geyser', phase: 1, minWireSizeSqmm: 4.0 },
    { id: 'CKT-MOTOR', name: 'Motor / Utility Circuit', type: 'motor', phase: 3, minWireSizeSqmm: 6.0 },
  ];

  // IS 732:1989 current sizing baseline with residential design assumptions.
  // I = P / (V × pf) for 1-phase, I = P / (sqrt(3) × V_LL × pf) for 3-phase.
  // Use 25% headroom for breaker selection and next higher standard MCB.
  const computeCurrentAmp = (watt: number, phase: 1 | 3): number => {
    const pf = 0.9;
    if (phase === 3) {
      return watt / (Math.sqrt(3) * 415 * pf);
    }
    return watt / (230 * pf);
  };

  const pickMCBRating = (designCurrentA: number, phase: 1 | 3): number => {
    const stdRatings = phase === 3 ? [16, 20, 25, 32, 40, 63] : [6, 10, 16, 20, 25, 32, 40, 63];
    const required = designCurrentA * 1.25;
    return stdRatings.find((r) => r >= required) ?? stdRatings[stdRatings.length - 1];
  };

  const pickWireSizeSqmm = (mcbA: number, minWireSqmm: number): number => {
    const base =
      mcbA <= 10 ? 1.5
        : mcbA <= 16 ? 2.5
          : mcbA <= 25 ? 4.0
            : mcbA <= 32 ? 6.0
              : mcbA <= 40 ? 10.0
                : 16.0;
    return Math.max(base, minWireSqmm);
  };

  for (const spec of circuitSpecs) {
    const grouped = fixtures.filter((f) => f.circuit === spec.id);
    if (grouped.length === 0) continue;

    const connectedWatt = grouped.reduce((sum, f) => sum + f.wattage, 0);
    const designCurrentA = computeCurrentAmp(connectedWatt, spec.phase);
    const mcbRating = pickMCBRating(designCurrentA, spec.phase);
    const wireSize = pickWireSizeSqmm(mcbRating, spec.minWireSizeSqmm);

    circuits.push({
      id: spec.id,
      name: spec.name,
      type: spec.type,
      mcbRating,
      wireSize,
      fixtures: grouped.map((f) => f.id),
      phase: spec.phase,
    });
  }

  // Recompute connected load including all generated service fixtures
  const connectedLoad = fixtures.reduce((sum, f) => sum + f.wattage, 0) / 1000;

  // Diversity factors (typical residential):
  // lighting 90%, power 60%, AC 80%, kitchen 70%, geyser 90%, motor 100%
  const fixtureWattById = new Map(fixtures.map((f) => [f.id, f.wattage]));
  const categoryLoad: Record<ElectricalCircuit['type'], number> = {
    lighting: 0,
    power: 0,
    ac: 0,
    kitchen: 0,
    geyser: 0,
    motor: 0,
  };

  for (const circuit of circuits) {
    const kw =
      circuit.fixtures.reduce((sum, fixtureId) => sum + (fixtureWattById.get(fixtureId) ?? 0), 0) /
      1000;
    categoryLoad[circuit.type] += kw;
  }

  const demandLoad =
    categoryLoad.lighting * 0.9 +
    categoryLoad.power * 0.6 +
    categoryLoad.ac * 0.8 +
    categoryLoad.kitchen * 0.7 +
    categoryLoad.geyser * 0.9 +
    categoryLoad.motor * 1.0;

  // Attach all circuits to all DB panels for now (single DB logic per floor)
  for (const panel of panels) {
    panel.circuits = circuits.map((c) => c.id);
  }

  return {
    fixtures,
    circuits,
    mainLoad: connectedLoad,
    connectedLoad,
    demandLoad,
    meterType: connectedLoad > 7.5 ? 'three_phase' : 'single_phase',
    earthingType: 'plate',
    lightningProtection: floorPlans.length > 2,
    solarCapacity: connectedLoad > 5 ? Math.round(connectedLoad * 0.6 * 10) / 10 : undefined,
    backupType: connectedLoad > 7 ? 'both' : 'inverter',
    panels,
  };
}
