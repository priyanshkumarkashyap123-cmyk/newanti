// Feature: space-planning-accuracy-and-tools, Property 19: Round-Trip Serialization Preserves Coordinates
// Validates: Requirements 14.1, 14.2, 14.3, 14.4

import { serializeProject, deserializeProject } from '../projectSerializer';
import type { HousePlanProject } from '../types';

function makeProject(overrides: Partial<HousePlanProject> = {}): HousePlanProject {
  return {
    id: 'proj-1',
    name: 'Test Project',
    description: 'A test project',
    createdAt: new Date('2024-01-15T10:00:00.000Z'),
    updatedAt: new Date('2024-06-01T12:00:00.000Z'),
    plot: { width: 15, depth: 20, area: 300, shape: 'rectangular', unit: 'meters' },
    orientation: { northDirection: 0, plotFacing: 'N', mainEntryDirection: 'N', roadSide: ['N'] },
    constraints: {
      setbacks: { front: 3, rear: 2, left: 1.5, right: 1.5 },
      maxHeight: 15,
      maxFloors: 3,
      farAllowed: 1.5,
      groundCoverage: 60,
      parkingRequired: 1,
      buildingType: 'residential',
      zone: 'R1',
    },
    location: { latitude: 28.6, longitude: 77.2, city: 'Delhi', state: 'Delhi', country: 'India' },
    floorPlans: [
      {
        floor: 0,
        label: 'Ground Floor',
        rooms: [
          {
            id: 'r1',
            x: 2.5,
            y: 3.0,
            width: 4.0,
            height: 5.0,
            rotation: 0,
            floor: 0,
            wallThickness: 0.23,
            finishFloor: 'tiles',
            finishWall: 'paint',
            finishCeiling: 'paint',
            ceilingHeight: 3,
            color: '#fff',
            spec: { type: 'living', priority: 'essential', minArea: 10, maxArea: 30, minWidth: 3, minDepth: 3, adjacentTo: [], awayFrom: [] } as any,
            doors: [],
            windows: [],
          },
        ],
        staircases: [],
        corridors: [],
        floorHeight: 3,
        slabThickness: 0.15,
        walls: [],
        boundaryViolationCount: 0,
        overlapCount: 0,
        constraintViolations: [],
      },
    ],
    roomSpecs: [],
    colorSchemes: [],
    structural: { columns: [], beams: [], foundations: [], slabs: [], gridAlignmentScore: 85 } as any,
    electrical: { fixtures: [], circuits: [], panels: [], loadSchedule: [] } as any,
    plumbing: { fixtures: [], pipes: [], risers: [] } as any,
    hvac: { equipment: [], ducts: [], zones: [] } as any,
    vastu: {} as any,
    sunlight: {} as any,
    airflow: {} as any,
    elevations: [],
    sections: [],
    sectionLines: [],
    designCode: 'IS 456:2000',
    buildingCode: 'NBC 2016',
    status: 'draft',
    ...overrides,
  };
}

describe('projectSerializer', () => {
  describe('serializeProject', () => {
    it('returns a valid JSON string', () => {
      const project = makeProject();
      const json = serializeProject(project);
      expect(typeof json).toBe('string');
      expect(() => JSON.parse(json)).not.toThrow();
    });
  });

  describe('deserializeProject', () => {
    it('returns error for malformed JSON', () => {
      const result = deserializeProject('{ not valid json }');
      expect(result).toHaveProperty('error');
    });

    it('returns error for missing floorPlans field', () => {
      const json = JSON.stringify({ id: 'x', plot: {}, structural: {} });
      const result = deserializeProject(json);
      expect(result).toHaveProperty('error');
    });

    it('returns error for missing id field', () => {
      const json = JSON.stringify({ floorPlans: [], plot: {}, structural: {} });
      const result = deserializeProject(json);
      expect(result).toHaveProperty('error');
    });

    it('returns error for missing plot field', () => {
      const json = JSON.stringify({ id: 'x', floorPlans: [], structural: {} });
      const result = deserializeProject(json);
      expect(result).toHaveProperty('error');
    });

    it('returns error for missing structural field', () => {
      const json = JSON.stringify({ id: 'x', floorPlans: [], plot: {} });
      const result = deserializeProject(json);
      expect(result).toHaveProperty('error');
    });
  });

  describe('Property 19: Round-Trip Serialization Preserves Coordinates', () => {
    it('round-trip preserves PlacedRoom x, y, width, height', () => {
      const project = makeProject();
      const json = serializeProject(project);
      const restored = deserializeProject(json);

      expect('error' in restored).toBe(false);
      const restoredProject = restored as HousePlanProject;

      const originalRoom = project.floorPlans[0].rooms[0];
      const restoredRoom = restoredProject.floorPlans[0].rooms[0];

      expect(restoredRoom.x).toBe(originalRoom.x);
      expect(restoredRoom.y).toBe(originalRoom.y);
      expect(restoredRoom.width).toBe(originalRoom.width);
      expect(restoredRoom.height).toBe(originalRoom.height);
    });

    it('round-trip preserves project id and name', () => {
      const project = makeProject();
      const json = serializeProject(project);
      const restored = deserializeProject(json) as HousePlanProject;

      expect(restored.id).toBe(project.id);
      expect(restored.name).toBe(project.name);
    });

    it('round-trip revives date strings back to Date objects', () => {
      const project = makeProject();
      const json = serializeProject(project);
      const restored = deserializeProject(json) as HousePlanProject;

      expect(restored.createdAt).toBeInstanceOf(Date);
      expect(restored.updatedAt).toBeInstanceOf(Date);
      expect(restored.createdAt.getTime()).toBe(project.createdAt.getTime());
    });

    it('round-trip preserves multiple rooms with different coordinates', () => {
      const project = makeProject();
      project.floorPlans[0].rooms.push({
        id: 'r2',
        x: 7.5,
        y: 3.0,
        width: 3.0,
        height: 3.0,
        rotation: 0,
        floor: 0,
        wallThickness: 0.23,
        finishFloor: 'tiles',
        finishWall: 'paint',
        finishCeiling: 'paint',
        ceilingHeight: 3,
        color: '#fff',
        spec: { type: 'bedroom', priority: 'important', minArea: 9, maxArea: 20, minWidth: 3, minDepth: 3, adjacentTo: [], awayFrom: [] } as any,
        doors: [],
        windows: [],
      });

      const json = serializeProject(project);
      const restored = deserializeProject(json) as HousePlanProject;

      expect(restored.floorPlans[0].rooms).toHaveLength(2);
      expect(restored.floorPlans[0].rooms[1].x).toBe(7.5);
      expect(restored.floorPlans[0].rooms[1].y).toBe(3.0);
    });
  });
});
