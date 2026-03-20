import { describe, expect, it } from 'vitest';
import {
  generateMemberTraceReport,
  type MemberDesignInput,
  type MaterialInputs,
  type SectionInputs,
} from './CalculationTraceabilityEngine';

const section: SectionInputs = {
  name: 'ISMB300',
  A: 4500,
  depth: 300,
  width: 140,
  tw: 7.5,
  tf: 12.4,
  Zpz: 600000,
  Zez: 520000,
  ry: 25,
  rz: 120,
  Iy: 1.8e7,
  Iz: 8.2e7,
};

const material: MaterialInputs = {
  fy: 250,
  fu: 410,
  E: 200000,
  gammaM0: 1.1,
  gammaM1: 1.25,
};

const input: MemberDesignInput = {
  memberId: 'M1',
  length: 6000,
  axial: 150,
  momentMajor: 80,
  shearMajor: 45,
};

describe('CalculationTraceabilityEngine model-driven filters', () => {
  it('respects selectedParts filter', () => {
    const report = generateMemberTraceReport(input, section, material, 'IS800_2007', {
      selectedParts: ['shear_major'],
      includeEmptyChecks: true,
    });

    expect(report.checks.length).toBe(1);
    expect(report.checks[0]?.title).toContain('Shear');
  });

  it('respects modelType gating for bending-only beam behavior', () => {
    const beamInput: MemberDesignInput = {
      ...input,
      axial: 0,
      momentMajor: 95,
      shearMajor: 0,
      modelType: 'beam',
    };

    const report = generateMemberTraceReport(beamInput, section, material, 'IS800_2007', {
      selectedParts: ['bending_major'],
      modelType: 'beam',
      includeEmptyChecks: true,
    });

    expect(report.checks.length).toBe(1);
    expect(report.checks[0]?.title).toContain('Bending');
  });
});
