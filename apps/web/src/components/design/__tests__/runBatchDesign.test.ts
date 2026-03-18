// Feature: space-planning-accuracy-and-tools, Property 15: Batch Design Completeness
// Validates: Requirements 10.1, 11.1

import { runBatchDesign, MemberDesignResult } from '../../../services/detailingUtils';

function makeMembers(ids: string[], sectionId = 'ISMB 200') {
  const map = new Map<string, any>();
  ids.forEach(id => {
    map.set(id, { id, startNodeId: `${id}_s`, endNodeId: `${id}_e`, sectionId });
  });
  return map;
}

function makeNodes(memberIds: string[]) {
  const map = new Map<string, any>();
  memberIds.forEach(id => {
    map.set(`${id}_s`, { x: 0, y: 0, z: 0 });
    map.set(`${id}_e`, { x: 5, y: 0, z: 0 }); // horizontal beam
  });
  return map;
}

function makeAnalysisResults(memberIds: string[]) {
  const memberForces = new Map<string, any>();
  memberIds.forEach(id => {
    memberForces.set(id, { axial: 10, shearY: 5, shearZ: 0, momentY: 0, momentZ: 20, torsion: 0 });
  });
  return { memberForces, displacements: new Map() } as any;
}

describe('runBatchDesign', () => {
  it('Property 15: returns results with length equal to members.size', () => {
    const ids = ['m1', 'm2', 'm3', 'm4', 'm5'];
    const members = makeMembers(ids);
    const nodes = makeNodes(ids);
    const analysisResults = makeAnalysisResults(ids);

    const results = runBatchDesign(members, analysisResults, nodes);
    expect(results).toHaveLength(members.size);
  });

  it('returns empty array for empty members map', () => {
    const results = runBatchDesign(new Map(), null, new Map());
    expect(results).toHaveLength(0);
  });

  it('marks member as skipped when section data is missing', () => {
    const members = makeMembers(['m1'], 'NONEXISTENT_SECTION_XYZ');
    const nodes = makeNodes(['m1']);
    const analysisResults = makeAnalysisResults(['m1']);

    const results = runBatchDesign(members, analysisResults, nodes);
    expect(results[0].status).toBe('skipped');
    expect(results[0].skipReason).toBeDefined();
  });

  it('marks member as skipped when analysis forces are missing', () => {
    const members = makeMembers(['m1'], 'ISMB 200');
    const nodes = makeNodes(['m1']);
    // No forces for m1
    const analysisResults = { memberForces: new Map(), displacements: new Map() } as any;

    const results = runBatchDesign(members, analysisResults, nodes);
    expect(results[0].status).toBe('skipped');
    expect(results[0].skipReason).toBe('No analysis forces');
  });

  it('marks member as skipped when analysisResults is null', () => {
    const members = makeMembers(['m1'], 'ISMB200');
    const nodes = makeNodes(['m1']);

    const results = runBatchDesign(members, null, nodes);
    expect(results[0].status).toBe('skipped');
  });

  it('returns pass/fail status for members with valid data', () => {
    const ids = ['m1', 'm2'];
    const members = makeMembers(ids, 'ISMB200');
    const nodes = makeNodes(ids);
    const analysisResults = makeAnalysisResults(ids);

    const results = runBatchDesign(members, analysisResults, nodes);
    for (const r of results) {
      expect(['pass', 'fail', 'skipped']).toContain(r.status);
    }
  });

  it('each result has required fields', () => {
    const ids = ['m1'];
    const members = makeMembers(ids, 'ISMB200');
    const nodes = makeNodes(ids);
    const analysisResults = makeAnalysisResults(ids);

    const results = runBatchDesign(members, analysisResults, nodes);
    const r = results[0];
    expect(r).toHaveProperty('memberId');
    expect(r).toHaveProperty('memberType');
    expect(r).toHaveProperty('sectionId');
    expect(r).toHaveProperty('status');
    expect(r).toHaveProperty('utilizationRatio');
    expect(r).toHaveProperty('governingCheck');
    expect(r).toHaveProperty('forces');
    expect(r).toHaveProperty('sectionProps');
  });

  it('processes 200 members within 5 seconds', () => {
    const ids = Array.from({ length: 200 }, (_, i) => `m${i}`);
    const members = makeMembers(ids, 'ISMB200');
    const nodes = makeNodes(ids);
    const analysisResults = makeAnalysisResults(ids);

    const start = Date.now();
    const results = runBatchDesign(members, analysisResults, nodes);
    const elapsed = Date.now() - start;

    expect(results).toHaveLength(200);
    expect(elapsed).toBeLessThan(5000);
  });
});
