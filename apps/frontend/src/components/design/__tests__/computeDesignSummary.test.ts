// Feature: space-planning-accuracy-and-tools, Property 16: Design Summary Correctness
// Validates: Requirements 10.4

import { computeDesignSummary, MemberDesignResult } from '../../../services/detailingUtils';

function makeResult(status: 'pass' | 'fail' | 'skipped'): MemberDesignResult {
  return {
    memberId: `m_${Math.random()}`,
    memberType: 'beam',
    sectionId: 'ISMB200',
    status,
    utilizationRatio: status === 'pass' ? 0.7 : status === 'fail' ? 1.2 : 0,
    governingCheck: 'Bending',
    governingLoadCombo: '1.5(DL+LL)',
    forces: { axial: 0, shearY: 5, shearZ: 0, momentY: 0, momentZ: 20, torsion: 0 },
    sectionProps: { area: 2840, Ixx: 2235, Iyy: 150, Zxx: 223.5, Zyy: 28.5, fy: 250 },
  };
}

describe('computeDesignSummary', () => {
  it('returns zeros for empty results', () => {
    const summary = computeDesignSummary([]);
    expect(summary.total).toBe(0);
    expect(summary.pass).toBe(0);
    expect(summary.fail).toBe(0);
    expect(summary.skipped).toBe(0);
    expect(summary.passRate).toBe(0);
  });

  it('all-pass results', () => {
    const results = [makeResult('pass'), makeResult('pass'), makeResult('pass')];
    const summary = computeDesignSummary(results);
    expect(summary.total).toBe(3);
    expect(summary.pass).toBe(3);
    expect(summary.fail).toBe(0);
    expect(summary.skipped).toBe(0);
    expect(summary.passRate).toBe(100);
  });

  it('all-fail results', () => {
    const results = [makeResult('fail'), makeResult('fail')];
    const summary = computeDesignSummary(results);
    expect(summary.total).toBe(2);
    expect(summary.pass).toBe(0);
    expect(summary.fail).toBe(2);
    expect(summary.skipped).toBe(0);
    expect(summary.passRate).toBe(0);
  });

  it('mixed results', () => {
    const results = [
      makeResult('pass'),
      makeResult('pass'),
      makeResult('fail'),
      makeResult('skipped'),
    ];
    const summary = computeDesignSummary(results);
    expect(summary.total).toBe(4);
    expect(summary.pass).toBe(2);
    expect(summary.fail).toBe(1);
    expect(summary.skipped).toBe(1);
    expect(summary.passRate).toBeCloseTo(50);
  });

  it('Property 16: pass + fail + skipped === total', () => {
    const testCases = [
      [makeResult('pass'), makeResult('fail'), makeResult('skipped')],
      [makeResult('pass'), makeResult('pass')],
      [makeResult('fail')],
      [],
    ];
    for (const results of testCases) {
      const summary = computeDesignSummary(results);
      expect(summary.pass + summary.fail + summary.skipped).toBe(summary.total);
    }
  });

  it('Property 16: passRate = (pass / total) * 100', () => {
    const results = [makeResult('pass'), makeResult('pass'), makeResult('fail'), makeResult('skipped')];
    const summary = computeDesignSummary(results);
    expect(summary.passRate).toBeCloseTo((summary.pass / summary.total) * 100);
  });
});
