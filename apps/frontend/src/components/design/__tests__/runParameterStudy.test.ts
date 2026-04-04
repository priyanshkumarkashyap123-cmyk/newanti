// Feature: space-planning-accuracy-and-tools, Properties 12 and 13
// Property 12: Parameter Study Completeness
// Property 13: Parameter Study Minimum Correctness
// Validates: Requirements 8.2, 8.3, 8.5

import { runParameterStudy, ParameterStudyConfig } from '../../../pages/SensitivityOptimizationDashboard';

// Minimal mock data — analysisResults is null so evaluateObjective returns Infinity
// We need analysisResults to be non-null for meaningful results
// Use a minimal mock that returns finite values

function makeMembers(ids: string[]) {
  const map = new Map<string, any>();
  ids.forEach(id => {
    map.set(id, {
      id,
      startNodeId: `n${id}_s`,
      endNodeId: `n${id}_e`,
      sectionId: 'ISMB200',
    });
  });
  return map;
}

function makeNodes(memberIds: string[]) {
  const map = new Map<string, any>();
  memberIds.forEach(id => {
    map.set(`n${id}_s`, { x: 0, y: 0, z: 0 });
    map.set(`n${id}_e`, { x: 3, y: 0, z: 0 });
  });
  return map;
}

function makeAnalysisResults(memberIds: string[]) {
  const memberForces = new Map<string, any>();
  memberIds.forEach(id => {
    memberForces.set(id, { axial: 10, shearY: 5, shearZ: 0, momentY: 0, momentZ: 20, torsion: 0 });
  });
  return {
    memberForces,
    displacements: new Map([['n1', { dx: 0.001, dy: 0.002, dz: 0 }]]),
  } as any;
}

const memberIds = ['m1', 'm2'];
const members = makeMembers(memberIds);
const nodes = makeNodes(memberIds);
const analysisResults = makeAnalysisResults(memberIds);

const variables = [
  {
    id: 'v1',
    name: 'Beam Depth',
    type: 'section_depth' as any,
    members: memberIds,
    lowerBound: 200,
    upperBound: 400,
    currentValue: 300,
    step: 50,
    unit: 'mm',
  },
  {
    id: 'v2',
    name: 'Column Depth',
    type: 'section_depth' as any,
    members: memberIds,
    lowerBound: 150,
    upperBound: 300,
    currentValue: 200,
    step: 50,
    unit: 'mm',
  },
];

describe('runParameterStudy', () => {
  it('throws RangeError when steps < 2', () => {
    const config: ParameterStudyConfig = {
      variable1: { variableId: 'v1', lowerBound: 200, upperBound: 400, steps: 1 },
      objective: 'minimize-weight',
    };
    expect(() => runParameterStudy(config, variables, members, analysisResults, nodes)).toThrow(RangeError);
    expect(() => runParameterStudy(config, variables, members, analysisResults, nodes)).toThrow('steps must be >= 2');
  });

  it('throws RangeError when variable2 steps < 2', () => {
    const config: ParameterStudyConfig = {
      variable1: { variableId: 'v1', lowerBound: 200, upperBound: 400, steps: 3 },
      variable2: { variableId: 'v2', lowerBound: 150, upperBound: 300, steps: 1 },
      objective: 'minimize-weight',
    };
    expect(() => runParameterStudy(config, variables, members, analysisResults, nodes)).toThrow(RangeError);
  });

  it('returns empty array when variable not found', () => {
    const config: ParameterStudyConfig = {
      variable1: { variableId: 'nonexistent', lowerBound: 200, upperBound: 400, steps: 3 },
      objective: 'minimize-weight',
    };
    const results = runParameterStudy(config, variables, members, analysisResults, nodes);
    expect(results).toEqual([]);
  });

  describe('1D parameter study', () => {
    it('Property 12: returns exactly n1 results for 1D study', () => {
      const steps = 5;
      const config: ParameterStudyConfig = {
        variable1: { variableId: 'v1', lowerBound: 200, upperBound: 400, steps },
        objective: 'minimize-weight',
      };
      const results = runParameterStudy(config, variables, members, analysisResults, nodes);
      expect(results).toHaveLength(steps);
    });

    it('results are sorted by v1Value ascending', () => {
      const config: ParameterStudyConfig = {
        variable1: { variableId: 'v1', lowerBound: 200, upperBound: 400, steps: 4 },
        objective: 'minimize-weight',
      };
      const results = runParameterStudy(config, variables, members, analysisResults, nodes);
      for (let i = 1; i < results.length; i++) {
        expect(results[i].v1Value).toBeGreaterThanOrEqual(results[i - 1].v1Value);
      }
    });

    it('Property 13: exactly one result has isMinimum = true', () => {
      const config: ParameterStudyConfig = {
        variable1: { variableId: 'v1', lowerBound: 200, upperBound: 400, steps: 4 },
        objective: 'minimize-weight',
      };
      const results = runParameterStudy(config, variables, members, analysisResults, nodes);
      const minimums = results.filter(r => r.isMinimum);
      expect(minimums).toHaveLength(1);
    });

    it('Property 13: isMinimum entry has the lowest objectiveValue', () => {
      const config: ParameterStudyConfig = {
        variable1: { variableId: 'v1', lowerBound: 200, upperBound: 400, steps: 5 },
        objective: 'minimize-weight',
      };
      const results = runParameterStudy(config, variables, members, analysisResults, nodes);
      const minEntry = results.find(r => r.isMinimum)!;
      const minValue = Math.min(...results.map(r => r.objectiveValue));
      expect(minEntry.objectiveValue).toBe(minValue);
    });
  });

  describe('2D parameter study', () => {
    it('Property 12: returns exactly n1 × n2 results for 2D study', () => {
      const n1 = 3, n2 = 4;
      const config: ParameterStudyConfig = {
        variable1: { variableId: 'v1', lowerBound: 200, upperBound: 400, steps: n1 },
        variable2: { variableId: 'v2', lowerBound: 150, upperBound: 300, steps: n2 },
        objective: 'minimize-weight',
      };
      const results = runParameterStudy(config, variables, members, analysisResults, nodes);
      expect(results).toHaveLength(n1 * n2);
    });

    it('results are sorted by v1Value then v2Value', () => {
      const config: ParameterStudyConfig = {
        variable1: { variableId: 'v1', lowerBound: 200, upperBound: 400, steps: 3 },
        variable2: { variableId: 'v2', lowerBound: 150, upperBound: 300, steps: 3 },
        objective: 'minimize-weight',
      };
      const results = runParameterStudy(config, variables, members, analysisResults, nodes);
      for (let i = 1; i < results.length; i++) {
        const prev = results[i - 1];
        const curr = results[i];
        if (curr.v1Value === prev.v1Value) {
          expect(curr.v2Value!).toBeGreaterThanOrEqual(prev.v2Value!);
        } else {
          expect(curr.v1Value).toBeGreaterThan(prev.v1Value);
        }
      }
    });
  });
});
