// Feature: space-planning-accuracy-and-tools, Properties 7 and 8
// Property 7: Elevation Width Matches Plot
// Property 8: Elevation Contains North Arrow and Scale Bar
// Validates: Requirements 5.1, 5.6

import { buildFrontElevation, buildRearElevation, buildLeftElevation, buildRightElevation } from '../SpacePlanningEngine';
import type { FloorPlan, PlacedRoom, PlotDimensions, SetbackRequirements, StructuralPlan } from '../types';

function makeRoom(id: string, x: number, y: number, width: number, height: number): PlacedRoom {
  return {
    id,
    x,
    y,
    width,
    height,
    rotation: 0,
    floor: 0,
    wallThickness: 0.23,
    spec: { type: 'living', priority: 'essential', minArea: 10, maxArea: 50, minWidth: 3, minDepth: 3, adjacentTo: [], awayFrom: [] } as any,
    doors: [],
    windows: [],
    finishFloor: 'tile',
    finishWall: 'paint',
    finishCeiling: 'paint',
    ceilingHeight: 3,
    color: '#cbd5e1',
  };
}

function makeFloorPlan(rooms: PlacedRoom[], floor = 0): FloorPlan {
  return {
    floor,
    label: floor === 0 ? 'Ground Floor' : 'First Floor',
    rooms,
    staircases: [],
    corridors: [],
    floorHeight: 3,
    slabThickness: 0.15,
    walls: [],
    boundaryViolationCount: 0,
    overlapCount: 0,
    constraintViolations: [],
  };
}

const plot: PlotDimensions = { width: 15, depth: 20, area: 300, shape: 'rectangular', unit: 'meters' };
const setbacks: SetbackRequirements = { front: 3, rear: 2, left: 1.5, right: 1.5 };
const structural: StructuralPlan = { columns: [], beams: [], foundations: [], slabs: [], gridAlignmentScore: 0 } as any;

const rooms = [makeRoom('r1', 1.5, 3, 5, 4), makeRoom('r2', 7, 3, 4, 4)];
const floorPlans = [makeFloorPlan(rooms)];

describe('buildFrontElevation', () => {
  it('returns an ElevationView with type front_elevation', () => {
    const view = buildFrontElevation(floorPlans, structural, plot, setbacks);
    expect(view.type).toBe('front_elevation');
  });

  it('contains elements, dimensions, and labels', () => {
    const view = buildFrontElevation(floorPlans, structural, plot, setbacks);
    expect(Array.isArray(view.elements)).toBe(true);
    expect(Array.isArray(view.dimensions)).toBe(true);
    expect(Array.isArray(view.labels)).toBe(true);
  });

  it('Property 7: total horizontal span equals buildable width', () => {
    const buildableWidth = plot.width - setbacks.left - setbacks.right; // 12
    const view = buildFrontElevation(floorPlans, structural, plot, setbacks);
    // The total width dimension should reference buildableWidth
    const widthDim = view.dimensions.find(d => d.value === `${buildableWidth.toFixed(2)}m`);
    expect(widthDim).toBeDefined();
    expect(widthDim!.endX - widthDim!.startX).toBeCloseTo(buildableWidth);
  });

  it('Property 8: contains north arrow label "N"', () => {
    const view = buildFrontElevation(floorPlans, structural, plot, setbacks);
    const northLabel = view.labels.find(l => l.text === 'N');
    expect(northLabel).toBeDefined();
  });

  it('Property 8: contains scale bar dimension labelled "1m"', () => {
    const view = buildFrontElevation(floorPlans, structural, plot, setbacks);
    const scaleBar = view.dimensions.find(d => d.value === '1m');
    expect(scaleBar).toBeDefined();
  });

  it('single-floor plan produces wall polygon points', () => {
    const view = buildFrontElevation(floorPlans, structural, plot, setbacks);
    const wallElement = view.elements.find(e => e.type === 'wall');
    expect(wallElement).toBeDefined();
    expect(wallElement!.points.length).toBeGreaterThanOrEqual(4);
  });

  it('contains at least two dimension lines (width + height)', () => {
    const view = buildFrontElevation(floorPlans, structural, plot, setbacks);
    expect(view.dimensions.length).toBeGreaterThanOrEqual(2);
  });
});

describe('buildRearElevation', () => {
  it('returns type rear_elevation', () => {
    const view = buildRearElevation(floorPlans, structural, plot, setbacks);
    expect(view.type).toBe('rear_elevation');
  });

  it('Property 8: contains north arrow and scale bar', () => {
    const view = buildRearElevation(floorPlans, structural, plot, setbacks);
    const northLabel = view.labels.find(l => l.text === 'N');
    const scaleBar = view.dimensions.find(d => d.value === '1m');
    expect(northLabel).toBeDefined();
    expect(scaleBar).toBeDefined();
  });
});

describe('buildLeftElevation', () => {
  it('returns type left_elevation', () => {
    const view = buildLeftElevation(floorPlans, structural, plot, setbacks);
    expect(view.type).toBe('left_elevation');
  });
});

describe('buildRightElevation', () => {
  it('returns type right_elevation', () => {
    const view = buildRightElevation(floorPlans, structural, plot, setbacks);
    expect(view.type).toBe('right_elevation');
  });
});
