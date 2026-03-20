import { describe, it } from 'vitest';
import { SpacePlanningEngine } from '../SpacePlanningEngine';

describe('debug pbt failures', () => {
  it('NBC dims + wet area counterexample: 15.775x9 plot', () => {
    const engine = new SpacePlanningEngine();
    const plot = { width: 15.775, depth: 9, area: 141.975, shape: 'rectangular' as const, unit: 'meters' as const };
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
      { ...engine.getDefaultRoomSpec('bathroom', 0), id: 'bathroom-0' },
    ];
    const plan = engine.generateFloorPlan(plot, orientation, constraints, rooms, prefs, 0);
    console.log('All rooms:', JSON.stringify(plan.rooms.map(r => ({ type: r.spec.type, x: r.x, y: r.y, w: r.width, h: r.height }))));
    
    const kitchen = plan.rooms.find(r => r.spec.type === 'kitchen');
    const bathrooms = plan.rooms.filter(r => ['bathroom', 'toilet'].includes(r.spec.type));
    console.log('Kitchen:', JSON.stringify(kitchen ? { x: kitchen.x, y: kitchen.y, w: kitchen.width, h: kitchen.height } : null));
    console.log('Bathrooms:', JSON.stringify(bathrooms.map(b => ({ x: b.x, y: b.y, w: b.width, h: b.height }))));
    
    // Check sharesWall
    if (kitchen && bathrooms.length > 0) {
      for (const bath of bathrooms) {
        const EPS = 0.15;
        const overlapX = Math.min(kitchen.x + kitchen.width, bath.x + bath.width) - Math.max(kitchen.x, bath.x);
        const overlapY = Math.min(kitchen.y + kitchen.height, bath.y + bath.height) - Math.max(kitchen.y, bath.y);
        console.log(`Kitchen-Bath overlap: overlapX=${overlapX.toFixed(3)}, overlapY=${overlapY.toFixed(3)}`);
        console.log(`Kitchen right edge: ${(kitchen.x + kitchen.width).toFixed(3)}, Bath left edge: ${bath.x.toFixed(3)}, diff: ${(bath.x - (kitchen.x + kitchen.width)).toFixed(3)}`);
        console.log(`Bath right edge: ${(bath.x + bath.width).toFixed(3)}, Kitchen left edge: ${kitchen.x.toFixed(3)}, diff: ${(kitchen.x - (bath.x + bath.width)).toFixed(3)}`);
      }
    }
    
    const NBC_MIN_DIMS: Record<string, { w: number; h: number }> = {
      living: { w: 3.0, h: 3.0 }, bedroom: { w: 2.7, h: 2.7 }, kitchen: { w: 2.1, h: 1.8 },
      master_bedroom: { w: 3.0, h: 3.0 }, bathroom: { w: 1.2, h: 0.9 }, toilet: { w: 1.0, h: 0.9 }, corridor: { w: 1.0, h: 1.0 },
    };
    for (const room of plan.rooms) {
      const min = NBC_MIN_DIMS[room.spec.type];
      if (!min) continue;
      if (room.width < min.w - 0.05 || room.height < min.h - 0.05) {
        console.log(`NBC VIOLATION: ${room.spec.type} w=${room.width} h=${room.height} min=${JSON.stringify(min)}`);
      }
    }
  });
});
