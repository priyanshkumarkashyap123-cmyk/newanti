import type { HousePlanProject } from '../../services/space-planning/types';
import { BOQ_RATE_PRESETS, BoqPreset } from './boqPresets';

export type MasterBoqRow = {
  section: string;
  code: string;
  desc: string;
  unit: string;
  qty: number;
  remarks: string;
  rate: number;
  amount: number;
};

export type MasterBoqTotals = {
  rows: MasterBoqRow[];
  subtotal: number;
  contingency: number;
  gst: number;
  total: number;
};

export const buildMasterBoq = (project: HousePlanProject, preset: BoqPreset): MasterBoqTotals => {
  const allRooms = project.floorPlans.flatMap((fp) => fp.rooms);
  const allDoors = allRooms.flatMap((r) => r.doors.map((d) => ({ ...d, roomName: r.spec.name })));
  const allWindows = allRooms.flatMap((r) => r.windows.map((w) => ({ ...w, roomName: r.spec.name })));
  const floorPlans = project.floorPlans;

  const avgFloorHeight = floorPlans.length > 0
    ? floorPlans.reduce((s, f) => s + f.floorHeight, 0) / floorPlans.length
    : 3;

  const roomArea = allRooms.reduce((s, r) => s + r.width * r.height, 0);
  const wallLengthExt = floorPlans
    .flatMap((fp) => fp.walls)
    .filter((w) => w.type === 'external')
    .reduce((s, w) => s + Math.hypot(w.endX - w.startX, w.endY - w.startY), 0);
  const wallLengthInt = floorPlans
    .flatMap((fp) => fp.walls)
    .filter((w) => w.type === 'internal')
    .reduce((s, w) => s + Math.hypot(w.endX - w.startX, w.endY - w.startY), 0);

  const plasterArea = (wallLengthExt + wallLengthInt * 2) * avgFloorHeight * 2;
  const tileArea = allRooms
    .filter((r) => ['kitchen', 'bathroom', 'toilet', 'utility', 'laundry'].includes(r.spec.type))
    .reduce((s, r) => s + r.width * r.height, 0);

  const slabVolume = floorPlans.reduce((s, fp) =>
    s
    + (project.plot.width - project.constraints.setbacks.left - project.constraints.setbacks.right)
    * (project.plot.depth - project.constraints.setbacks.front - project.constraints.setbacks.rear)
    * fp.slabThickness,
  0);

  const beamVolume = project.structural.beams.reduce((s, b) => s + Math.hypot(b.endX - b.startX, b.endY - b.startY) * b.width * b.depth, 0);
  const columnVolume = project.structural.columns.reduce((s, c) => s + c.width * c.depth * avgFloorHeight, 0);
  const foundationVolume = project.structural.foundations.reduce((s, f) => s + f.width * f.depth * f.thickness, 0);
  const doorArea = allDoors.reduce((s, d) => s + d.width * d.height, 0);
  const windowArea = allWindows.reduce((s, w) => s + w.width * w.height, 0);
  const acUnits = project.hvac.equipment.filter((e) => ['split_ac', 'window_ac', 'vrf_unit', 'cassette_ac'].includes(e.type)).length;
  const exhaustFans = project.hvac.equipment.filter((e) => e.type === 'exhaust_fan').length;
  const rates = BOQ_RATE_PRESETS[preset];

  const rawRows = [
    { section: 'ARCH', code: 'A-001', desc: 'Built-up floor area', unit: 'm²', qty: roomArea, remarks: 'Sum of room floor areas' },
    { section: 'ARCH', code: 'A-002', desc: 'Floor finish area', unit: 'm²', qty: roomArea, remarks: 'General floor finish' },
    { section: 'ARCH', code: 'A-003', desc: 'Wet-area anti-skid tiling', unit: 'm²', qty: tileArea, remarks: 'Kitchen + toilets + utility + laundry' },
    { section: 'ARCH', code: 'A-004', desc: 'Wall plaster + putty + paint (both sides)', unit: 'm²', qty: plasterArea, remarks: 'Approximate' },
    { section: 'ARCH', code: 'A-005', desc: 'Door shutters and frames', unit: 'm²', qty: doorArea, remarks: `${allDoors.length} doors` },
    { section: 'ARCH', code: 'A-006', desc: 'Window units + glazing', unit: 'm²', qty: windowArea, remarks: `${allWindows.length} windows` },
    { section: 'STR', code: 'S-001', desc: 'RCC slab concrete', unit: 'm³', qty: slabVolume, remarks: 'Based on slab thickness and buildable footprint' },
    { section: 'STR', code: 'S-002', desc: 'RCC beam concrete', unit: 'm³', qty: beamVolume, remarks: `${project.structural.beams.length} beams` },
    { section: 'STR', code: 'S-003', desc: 'RCC columns concrete', unit: 'm³', qty: columnVolume, remarks: `${project.structural.columns.length} columns` },
    { section: 'STR', code: 'S-004', desc: 'Foundation concrete', unit: 'm³', qty: foundationVolume, remarks: `${project.structural.foundations.length} foundations` },
    { section: 'ELE', code: 'E-001', desc: 'Electrical points (all fixtures)', unit: 'nos', qty: project.electrical.fixtures.length, remarks: 'Includes LV + safety points' },
    { section: 'ELE', code: 'E-002', desc: 'Circuiting with DB/MCB', unit: 'nos', qty: project.electrical.circuits.length, remarks: 'Distribution circuits' },
    { section: 'ELE', code: 'E-003', desc: 'Panel boards', unit: 'nos', qty: project.electrical.panels.length, remarks: 'DB panels' },
    { section: 'ELE', code: 'E-004', desc: 'Connected electrical load', unit: 'kW', qty: project.electrical.connectedLoad, remarks: 'For service sizing' },
    { section: 'PLB', code: 'P-001', desc: 'Plumbing fixtures', unit: 'nos', qty: project.plumbing.fixtures.length, remarks: 'All sanitary and utility fixtures' },
    { section: 'PLB', code: 'P-002', desc: 'Plumbing pipelines', unit: 'rm', qty: project.plumbing.pipes.reduce((s, p) => s + Math.hypot(p.endX - p.startX, p.endY - p.startY), 0), remarks: 'Supply + drainage + vent + rain' },
    { section: 'PLB', code: 'P-003', desc: 'Overhead tank capacity', unit: 'L', qty: project.plumbing.overheadTankCapacity, remarks: 'Storage' },
    { section: 'PLB', code: 'P-004', desc: 'Sump capacity', unit: 'L', qty: project.plumbing.sumpCapacity, remarks: 'Underground storage' },
    { section: 'MECH', code: 'M-001', desc: 'HVAC equipment points', unit: 'nos', qty: project.hvac.equipment.length, remarks: 'AC + fans + FAU + accessories' },
    { section: 'MECH', code: 'M-002', desc: 'Air-conditioning units', unit: 'nos', qty: acUnits, remarks: 'Split/VRF/Window/Cassette' },
    { section: 'MECH', code: 'M-003', desc: 'Exhaust fan points', unit: 'nos', qty: exhaustFans, remarks: 'Kitchen/wet areas' },
    { section: 'MECH', code: 'M-004', desc: 'Cooling load', unit: 'TR', qty: project.hvac.coolingLoad, remarks: 'Total cooling tonnage' },
    { section: 'MECH', code: 'M-005', desc: 'Duct routing length', unit: 'rm', qty: project.hvac.ductRoutes.reduce((s, d) => s + Math.hypot(d.endX - d.startX, d.endY - d.startY), 0), remarks: 'Indicative' },
    { section: 'SIM', code: 'X-001', desc: 'Average daylight factor', unit: '%', qty: (project.sunlight.roomSunlight.reduce((s, r) => s + r.naturalLightFactor, 0) / Math.max(1, project.sunlight.roomSunlight.length)) * 100, remarks: 'Simulation KPI' },
    { section: 'SIM', code: 'X-002', desc: 'Average room ACH', unit: 'ACH', qty: project.airflow.roomVentilation.reduce((s, r) => s + r.airChangesPerHour, 0) / Math.max(1, project.airflow.roomVentilation.length), remarks: 'Ventilation KPI' },
    { section: 'SIM', code: 'X-003', desc: 'Cross-vent paths', unit: 'nos', qty: project.airflow.crossVentilationPaths.length, remarks: 'Natural airflow connectivity' },
  ];

  const rows = rawRows.map((r) => {
    const rate = rates[r.code] ?? 0;
    return { ...r, rate, amount: rate > 0 ? r.qty * rate : 0 };
  });

  const subtotal = rows.reduce((s, r) => s + r.amount, 0);
  const contingency = subtotal * 0.05;
  const gst = (subtotal + contingency) * 0.18;
  const total = subtotal + contingency + gst;

  return { rows, subtotal, contingency, gst, total };
};
