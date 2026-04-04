import { spacePlanningEngine } from '../../services/space-planning/SpacePlanningEngine';
import {
  solveLayout,
  solveLayoutFromMinimal,
  solveMultipleCandidates,
  generateLayoutVariants,
  placementsToPlacedRooms,
  validateAndClampSolverPlacements,
  checkSolverBackendHealth,
  buildConstraintReportFromVariant,
  type ConstraintReport,
  type PlacementResponse,
  type MultiCandidateResult,
  type LayoutVariantsResponse,
  type VariantResponse,
} from '../../services/space-planning/layoutApiService';
import { recomputeMEPAfterMerge } from '../../services/space-planning/SpacePlanningEngine';
import type { HousePlanProject } from '../../services/space-planning/types';
import type { WizardConfig } from '../../components/space-planning/RoomConfigWizard';

export async function mergeSolverPlacementsIntoProject(
  placements: PlacementResponse[],
  result: HousePlanProject,
  config: WizardConfig,
): Promise<HousePlanProject> {
  if (!placements || placements.length === 0 || result.floorPlans.length === 0) {
    return result;
  }

  const setbacks = config.constraints.setbacks;
  const plot = config.plot;
  const clampedPlacements = validateAndClampSolverPlacements(placements, setbacks, plot);
  const optimizedRooms = placementsToPlacedRooms(clampedPlacements, config.roomSpecs);

  const basePlan = result.floorPlans[0];
  const mergedRooms = basePlan.rooms.map((engineRoom) => {
    const solverRoom = optimizedRooms.find(
      (sr) => sr.id === engineRoom.id || sr.spec.type === engineRoom.spec.type,
    );
    if (!solverRoom) return engineRoom;
    return {
      ...engineRoom,
      x: solverRoom.x,
      y: solverRoom.y,
      width: solverRoom.width,
      height: solverRoom.height,
    };
  });

  const boundaryViolationCount = clampedPlacements.filter((p) => p._wasClamped).length;

  const worker = new Worker(new URL('../../services/space-planning/SpaceLayout.worker', import.meta.url), {
    type: 'module',
  });

  const resolvedPromise = new Promise<{ rooms: any[]; overlapCount: number }>((resolve, reject) => {
    worker.onmessage = (e) => {
      if (e.data.type === 'SUCCESS') {
        resolve({ rooms: e.data.rooms, overlapCount: e.data.overlapCount });
      } else {
        reject(new Error(e.data.message));
      }
      worker.terminate();
    };
    worker.postMessage({ type: 'RESOLVE_OVERLAPS', rooms: mergedRooms, setbacks, plot });
  });

  return resolvedPromise.then(({ rooms: resolvedRooms, overlapCount }) => {
    const mergedFloorPlan = {
      ...basePlan,
      rooms: resolvedRooms,
      boundaryViolationCount,
      overlapCount,
      constraintViolations: [],
    };

    const { electrical, plumbing, hvac } = recomputeMEPAfterMerge(result, mergedFloorPlan);

    return {
      ...result,
      floorPlans: [mergedFloorPlan, ...result.floorPlans.slice(1)],
      electrical,
      plumbing,
      hvac,
    };
  });
}

export {
  spacePlanningEngine,
  solveLayout,
  solveLayoutFromMinimal,
  solveMultipleCandidates,
  generateLayoutVariants,
  checkSolverBackendHealth,
  buildConstraintReportFromVariant,
};

export type {
  ConstraintReport,
  PlacementResponse,
  MultiCandidateResult,
  LayoutVariantsResponse,
  VariantResponse,
};
