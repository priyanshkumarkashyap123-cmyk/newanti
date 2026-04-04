// Feature: space-planning-accuracy-and-tools, Property 18: Design Report is Self-Contained HTML
// Validates: Requirements 13.2, 13.5

import { generateDesignReportHTML, MemberDesignResult } from '../../../services/detailingUtils';

function makeResult(memberId: string, status: 'pass' | 'fail' | 'skipped' = 'pass'): MemberDesignResult {
  return {
    memberId,
    memberType: 'beam',
    sectionId: 'ISMB200',
    status,
    utilizationRatio: status === 'pass' ? 0.75 : status === 'fail' ? 1.2 : 0,
    governingCheck: 'Bending (IS 456 Cl. 26.5)',
    governingLoadCombo: '1.5(DL+LL)',
    forces: { axial: 0, shearY: 5, shearZ: 0, momentY: 0, momentZ: 20, torsion: 0 },
    sectionProps: { area: 2840, Ixx: 2235, Iyy: 150, Zxx: 223.5, Zyy: 28.5, fy: 250 },
  };
}

describe('generateDesignReportHTML', () => {
  it('returns a string starting with <!DOCTYPE html>', () => {
    const html = generateDesignReportHTML([makeResult('B1')], 'Test Project', 'IS 456:2000');
    expect(typeof html).toBe('string');
    expect(html.trim()).toMatch(/^<!DOCTYPE html>/i);
  });

  it('Property 18: contains no external <link href= references', () => {
    const html = generateDesignReportHTML([makeResult('B1')], 'Test Project', 'IS 456:2000');
    // Should not have external stylesheet links
    expect(html).not.toMatch(/<link[^>]+href=/i);
  });

  it('Property 18: contains no external <script src= references', () => {
    const html = generateDesignReportHTML([makeResult('B1')], 'Test Project', 'IS 456:2000');
    expect(html).not.toMatch(/<script[^>]+src=/i);
  });

  it('Property 18: contains a <table> element', () => {
    const html = generateDesignReportHTML([makeResult('B1')], 'Test Project', 'IS 456:2000');
    expect(html).toContain('<table');
  });

  it('Property 18: contains the project name', () => {
    const html = generateDesignReportHTML([makeResult('B1')], 'Skyline Tower', 'IS 456:2000');
    expect(html).toContain('Skyline Tower');
  });

  it('contains inline CSS in <style> tag', () => {
    const html = generateDesignReportHTML([makeResult('B1')], 'Test Project', 'IS 456:2000');
    expect(html).toContain('<style>');
  });

  it('contains member IDs in the report', () => {
    const results = [makeResult('BEAM-001'), makeResult('BEAM-002')];
    const html = generateDesignReportHTML(results, 'Test Project', 'IS 456:2000');
    expect(html).toContain('BEAM-001');
    expect(html).toContain('BEAM-002');
  });

  it('contains design code in the report', () => {
    const html = generateDesignReportHTML([makeResult('B1')], 'Test Project', 'IS 800:2007');
    expect(html).toContain('IS 800:2007');
  });

  it('handles empty results array gracefully', () => {
    const html = generateDesignReportHTML([], 'Test Project', 'IS 456:2000');
    expect(typeof html).toBe('string');
    expect(html.length).toBeGreaterThan(0);
  });
});
