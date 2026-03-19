import { describe, it, expect } from 'vitest';
import { SpacePlanningEngine } from '../SpacePlanningEngine';

describe('SpacePlanningEngine - Advanced Scenarios', () => {
  it('should initialize and process a basic house plot layout', () => {
    const engine = new SpacePlanningEngine();
    const plot = { width: 15, depth: 20, area: 300, shape: 'rectangular' as const };
    const orientation = { northDirection: 0, plotFacing: 'S' as const, mainEntryDirection: 'S' as const, roadSide: ['S'] as const };
    const constraints = {
      setbacks: { front: 2, rear: 2, left: 1.5, right: 1.5 },
      maxHeight: 10, maxFloors: 2, farAllowed: 2.0,
      groundCoverage: 60, parkingRequired: 0,
      buildingType: 'residential' as const, zone: 'R1'
    };
    const preferences: any = { style: 'modern' };

    const rooms = [
      engine.getDefaultRoomSpec('living', 0),
      engine.getDefaultRoomSpec('bedroom', 0),
      engine.getDefaultRoomSpec('bedroom', 0)
    ];
    const layout = engine.generateFloorPlan(plot, orientation, constraints, rooms, preferences, 0);

    expect(layout).toBeDefined();
    expect(layout.rooms.length).toBeGreaterThanOrEqual(3);
  });
});
