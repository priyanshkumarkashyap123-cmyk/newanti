import { describe, it } from 'vitest';
import { SpacePlanningEngine } from '../SpacePlanningEngine';

describe('debug corridor', () => {
  it('corridor position after clamp', () => {
    const engine = new SpacePlanningEngine();
    const plot = { width: 14, depth: 12, area: 168, shape: 'rectangular' as const, unit: 'meters' as const };
    const orientation = { northDirection: 0, plotFacing: 'S' as const, mainEntryDirection: 'S' as const, roadSide: ['S' as const] };
    const constraints = {
      setbacks: { front: 1.5, rear: 1.0, left: 1.0, right: 1.0 },
      maxHeight: 10, maxFloors: 2, farAllowed: 2.0, groundCoverage: 60,
      parkingRequired: 0, buildingType: 'residential', zone: 'R1',
    };
    const prefs = {
      style: 'modern' as const, budget: 'standard' as const, climate: 'composite' as const,
      orientation_priority: 'sunlight' as const, parking: 'covered' as const, roofType: 'flat' as const,
      naturalLighting: 'balanced' as const, privacy: 'medium' as const, greenFeatures: false,
      smartHome: false, accessibilityRequired: false, vastuCompliance: 'optional' as const,
    };
    const rooms = [
      engine.getDefaultRoomSpec('living', 0),
      engine.getDefaultRoomSpec('bedroom', 0),
      engine.getDefaultRoomSpec('kitchen', 0),
    ];
    const plan = engine.generateFloorPlan(plot, orientation, constraints, rooms, prefs, 0);
    const corridor = plan.rooms.find(r => r.spec.type === 'corridor');
    console.log('Corridor AFTER clamp:', JSON.stringify({ x: corridor?.x, y: corridor?.y, w: corridor?.width, h: corridor?.height }));
    console.log('setbacks.front:', constraints.setbacks.front);
    console.log('envH:', plot.depth - constraints.setbacks.front - constraints.setbacks.rear);
    console.log('All rooms:', plan.rooms.map(r => ({ type: r.spec.type, x: r.x, y: r.y, w: r.width, h: r.height })));
  });
});
