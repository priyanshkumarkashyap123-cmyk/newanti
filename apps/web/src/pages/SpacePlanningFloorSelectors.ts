import type { OverlayMode } from '../components/space-planning/FloorPlanRenderer';
import type { PlanTab } from './SpacePlanningTabs';
import type { HousePlanProject } from '../services/space-planning/types';

export const getOverlayForTab = (tab: PlanTab): OverlayMode => {
  switch (tab) {
    case 'structural':
      return 'structural';
    case 'electrical':
      return 'electrical';
    case 'plumbing':
      return 'plumbing';
    case 'hvac':
      return 'hvac';
    default:
      return 'none';
  }
};

export const selectCurrentFloorPlan = (
  project: HousePlanProject | null,
  selectedFloor: number,
) => project?.floorPlans.find((fp) => fp.floor === selectedFloor) || project?.floorPlans[0];

export const getFloorRoomIdSet = (
  currentFloorPlan: HousePlanProject['floorPlans'][number] | null | undefined,
) => new Set((currentFloorPlan?.rooms || []).map((r) => r.id));

export const computeFloorElectrical = (
  project: HousePlanProject | null,
  currentFloorPlan: HousePlanProject['floorPlans'][number] | null | undefined,
  floorRoomIdSet: Set<string>,
) => {
  if (!project || !currentFloorPlan) return null;
  const fixtures = project.electrical.fixtures.filter((f) => floorRoomIdSet.has(f.roomId));
  const fixtureSet = new Set(fixtures.map((f) => f.id));
  const fixtureWattById = new Map(fixtures.map((f) => [f.id, f.wattage]));
  const circuits = project.electrical.circuits
    .map((c) => ({ ...c, fixtures: c.fixtures.filter((id) => fixtureSet.has(id)) }))
    .filter((c) => c.fixtures.length > 0);
  const panels = project.electrical.panels.filter((p) => floorRoomIdSet.has(p.roomId));
  const connectedLoad = fixtures.reduce((sum, f) => sum + f.wattage, 0) / 1000;

  const diversity: Record<'lighting' | 'power' | 'ac' | 'kitchen' | 'geyser' | 'motor', number> = {
    lighting: 0.9,
    power: 0.6,
    ac: 0.8,
    kitchen: 0.7,
    geyser: 0.9,
    motor: 1.0,
  };

  const demandLoad = circuits.reduce((sum, c) => {
    const circuitKw =
      c.fixtures.reduce((w, fixtureId) => w + (fixtureWattById.get(fixtureId) ?? 0), 0) / 1000;
    return sum + circuitKw * (diversity[c.type] ?? 0.72);
  }, 0);

  return {
    ...project.electrical,
    fixtures,
    circuits,
    panels,
    connectedLoad,
    mainLoad: connectedLoad,
    demandLoad,
  };
};

export const computeFloorPlumbing = (
  project: HousePlanProject | null,
  currentFloorPlan: HousePlanProject['floorPlans'][number] | null | undefined,
  floorRoomIdSet: Set<string>,
) => {
  if (!project || !currentFloorPlan) return null;
  const fixtures = project.plumbing.fixtures.filter((f) => floorRoomIdSet.has(f.roomId));
  const pipes = project.plumbing.pipes.filter((p) => p.floor === currentFloorPlan.floor);
  return {
    ...project.plumbing,
    fixtures,
    pipes,
  };
};

export const computeFloorHVAC = (
  project: HousePlanProject | null,
  currentFloorPlan: HousePlanProject['floorPlans'][number] | null | undefined,
  floorRoomIdSet: Set<string>,
) => {
  if (!project || !currentFloorPlan) return null;
  const equipment = project.hvac.equipment.filter((e) => floorRoomIdSet.has(e.roomId));
  const roomSet = new Set(equipment.map((e) => e.roomId));
  const ventilationPaths = project.hvac.ventilationPaths.filter(
    (v) => roomSet.has(v.startRoomId) || (!!v.endRoomId && roomSet.has(v.endRoomId)),
  );
  const ductRoutes = project.hvac.ductRoutes.filter((d) => d.floor === currentFloorPlan.floor);
  return {
    ...project.hvac,
    equipment,
    ventilationPaths,
    ductRoutes,
    coolingLoad:
      equipment
        .filter((e) => ['split_ac', 'window_ac', 'vrf_unit', 'cassette_ac'].includes(e.type))
        .reduce((sum, e) => sum + (typeof e.capacity === 'number' ? e.capacity : 0), 0),
  };
};
