import type { HousePlanProject } from '../../services/space-planning/types';
import { downloadCSV, toCSV } from '../../components/space-planning/csvExport';

type ExportRow = Array<string | number | boolean>;

export const exportRoomScheduleCsv = (project: HousePlanProject) => {
  const csv = toCSV(
    [
      'Room ID',
      'Room Name',
      'Floor',
      'Width (m)',
      'Height (m)',
      'Area (m²)',
      'Ceiling Height (m)',
      'Floor Finish',
      'Wall Finish',
    ],
    project.floorPlans.flatMap((floorPlan) =>
      floorPlan.rooms.map((room) => [
        room.id,
        room.spec.name,
        room.floor,
        room.width.toFixed(2),
        room.height.toFixed(2),
        (room.width * room.height).toFixed(2),
        room.ceilingHeight,
        room.finishFloor,
        room.finishWall,
      ]),
    ),
  );

  downloadCSV('room_schedule.csv', csv);
};

export const exportMepScheduleCsv = (project: HousePlanProject) => {
  const electricalRows = project.electrical.fixtures.map((fixture) => [
    'Electrical Fixture',
    fixture.id,
    fixture.type,
    fixture.roomId,
    fixture.circuit,
    fixture.wattage,
    fixture.height,
    fixture.x.toFixed(2),
    fixture.y.toFixed(2),
  ]);

  const circuitRows = project.electrical.circuits.map((circuit) => [
    'Electrical Circuit',
    circuit.id,
    circuit.name,
    circuit.type,
    circuit.mcbRating,
    circuit.wireSize,
    circuit.phase,
    circuit.fixtures.length,
    '',
  ]);

  const plumbingFixtureRows = project.plumbing.fixtures.map((fixture) => [
    'Plumbing Fixture',
    fixture.id,
    fixture.type,
    fixture.roomId,
    fixture.pipeSize,
    fixture.waterSupply,
    fixture.drainage,
    fixture.x.toFixed(2),
    fixture.y.toFixed(2),
  ]);

  const pipeRows = project.plumbing.pipes.map((pipe) => [
    'Plumbing Pipe',
    pipe.id,
    pipe.type,
    pipe.material,
    pipe.diameter,
    pipe.floor,
    pipe.startX.toFixed(2),
    pipe.startY.toFixed(2),
    `${pipe.endX.toFixed(2)},${pipe.endY.toFixed(2)}`,
  ]);

  const hvacRows = project.hvac.equipment.map((equipment) => [
    'HVAC Equipment',
    equipment.id,
    equipment.type,
    equipment.roomId,
    typeof equipment.capacity === 'number' ? equipment.capacity : '',
    equipment.powerConsumption,
    '',
    equipment.x.toFixed(2),
    equipment.y.toFixed(2),
  ]);

  const ventilationRows = project.hvac.ventilationPaths.map((path) => [
    'Ventilation Path',
    path.id,
    path.type,
    path.startRoomId,
    path.endRoomId || 'OUTSIDE',
    path.airflow,
    path.direction,
    '',
    '',
  ]);

  const csv = toCSV(
    ['Category', 'ID', 'Type/Name', 'Room/From', 'Circuit/To', 'Load/Size', 'Meta 1', 'X/StartX', 'Y/EndXY'],
    [
      ...electricalRows,
      ...circuitRows,
      ...plumbingFixtureRows,
      ...pipeRows,
      ...hvacRows,
      ...ventilationRows,
    ],
  );

  downloadCSV('mep_schedule.csv', csv);
};

export const exportSimulationScheduleCsv = (project: HousePlanProject) => {
  const sunlightRows = project.sunlight.roomSunlight.map((sunlight) => [
    'Sunlight',
    sunlight.roomId,
    sunlight.hoursOfDirectSun.summer,
    sunlight.hoursOfDirectSun.winter,
    (sunlight.naturalLightFactor * 100).toFixed(1),
    sunlight.glareRisk,
    sunlight.uvExposure,
    '',
    '',
  ]);

  const airflowRows = project.airflow.roomVentilation.map((airflow) => [
    'Airflow',
    airflow.roomId,
    airflow.airChangesPerHour,
    airflow.adequacy,
    airflow.recommendation,
    '',
    '',
    '',
    '',
  ]);

  const csv = toCSV(
    ['Category', 'Room ID', 'Metric 1', 'Metric 2', 'Metric 3', 'Metric 4', 'Metric 5', 'Metric 6', 'Metric 7'],
    [...sunlightRows, ...airflowRows],
  );

  downloadCSV('simulation_schedule.csv', csv);
};
