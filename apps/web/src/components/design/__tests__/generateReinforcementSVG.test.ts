// Feature: space-planning-accuracy-and-tools, Property 17: Reinforcement SVG Contains Required Elements
// Validates: Requirements 12.2, 12.3

import { generateReinforcementSVG, MemberDesignResult } from '../../../services/detailingUtils';

function makeResult(overrides: Partial<MemberDesignResult> = {}): MemberDesignResult {
  return {
    memberId: 'B1',
    memberType: 'beam',
    sectionId: 'ISMB200',
    status: 'pass',
    utilizationRatio: 0.75,
    governingCheck: 'Bending (IS 456 Cl. 26.5)',
    governingLoadCombo: '1.5(DL+LL)',
    forces: { axial: 0, shearY: 5, shearZ: 0, momentY: 0, momentZ: 20, torsion: 0 },
    sectionProps: { area: 2840, Ixx: 2235, Iyy: 150, Zxx: 223.5, Zyy: 28.5, fy: 250 },
    ...overrides,
  };
}

describe('generateReinforcementSVG', () => {
  it('returns a string starting with <svg', () => {
    const svg = generateReinforcementSVG(makeResult(), 'Test Project');
    expect(typeof svg).toBe('string');
    expect(svg.trim()).toMatch(/^<svg/);
  });

  it('Property 17: contains at least one <circle> element (reinforcement bars)', () => {
    const svg = generateReinforcementSVG(makeResult(), 'Test Project');
    expect(svg).toContain('<circle');
  });

  it('Property 17: contains at least one <rect> element (section outline)', () => {
    const svg = generateReinforcementSVG(makeResult(), 'Test Project');
    expect(svg).toContain('<rect');
  });

  it('Property 17: title block contains memberId', () => {
    const result = makeResult({ memberId: 'BEAM-42' });
    const svg = generateReinforcementSVG(result, 'My Project');
    expect(svg).toContain('BEAM-42');
  });

  it('title block contains project name', () => {
    const svg = generateReinforcementSVG(makeResult(), 'Skyline Tower');
    expect(svg).toContain('Skyline Tower');
  });

  it('title block contains design code reference', () => {
    const svg = generateReinforcementSVG(makeResult(), 'Test Project');
    expect(svg).toContain('IS 456');
  });

  it('beam with 3 bars produces 3 <circle> elements', () => {
    const svg = generateReinforcementSVG(makeResult(), 'Test Project');
    const circleMatches = svg.match(/<circle/g);
    expect(circleMatches).not.toBeNull();
    expect(circleMatches!.length).toBe(3);
  });

  it('is a valid SVG with xmlns attribute', () => {
    const svg = generateReinforcementSVG(makeResult(), 'Test Project');
    expect(svg).toContain('xmlns="http://www.w3.org/2000/svg"');
  });
});
