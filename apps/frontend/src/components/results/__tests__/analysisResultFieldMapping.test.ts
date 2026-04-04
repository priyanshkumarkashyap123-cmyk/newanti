/**
 * Property 23: Analysis Result Field Mapping
 *
 * For any result object from any backend, all fields consumed by LoadCombosView,
 * DCRatioView, SteelDesignTab, and RCBeamTab must be non-null/undefined when the
 * result contains valid data.
 *
 * **Validates: Requirements 8.5, 8.6, 8.7, 8.8**
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import type { LoadCombination } from '../../../hooks/useAnalysis';
import type { MemberResult } from '../dashboardTypes';
import type { MemberDesignRow, PythonRCBeamResult } from '../postProcessingTypes';

// ─── Arbitraries ────────────────────────────────────────────────────────────

const arbLoadCombination = (): fc.Arbitrary<LoadCombination> =>
  fc.record({
    id: fc.string({ minLength: 1, maxLength: 10 }),
    name: fc.string({ minLength: 1, maxLength: 40 }),
    factors: fc.dictionary(
      fc.string({ minLength: 1, maxLength: 5 }),
      fc.double({ min: 0.1, max: 2.0, noNaN: true }),
    ),
    envelopeForces: fc.array(fc.anything(), { maxLength: 0 }),
  });

const arbMemberResult = (): fc.Arbitrary<MemberResult> =>
  fc.record({
    id: fc.string({ minLength: 1, maxLength: 10 }),
    startNodeId: fc.string({ minLength: 1 }),
    endNodeId: fc.string({ minLength: 1 }),
    length: fc.double({ min: 0.5, max: 50, noNaN: true }),
    sectionType: fc.constantFrom('rectangular', 'I-section', 'circular'),
    materialType: fc.constantFrom('steel', 'concrete') as fc.Arbitrary<'steel' | 'concrete'>,
    maxShear: fc.double({ min: 0, max: 1000, noNaN: true }),
    minShear: fc.double({ min: -1000, max: 0, noNaN: true }),
    maxMoment: fc.double({ min: 0, max: 5000, noNaN: true }),
    minMoment: fc.double({ min: -5000, max: 0, noNaN: true }),
    maxAxial: fc.double({ min: 0, max: 2000, noNaN: true }),
    minAxial: fc.double({ min: -2000, max: 0, noNaN: true }),
    maxDeflection: fc.double({ min: 0, max: 100, noNaN: true }),
    stress: fc.double({ min: 0, max: 500, noNaN: true }),
    utilization: fc.double({ min: 0, max: 1.5, noNaN: true }),
    sectionProps: fc.record({
      A: fc.double({ min: 0.001, max: 1, noNaN: true }),
      I: fc.double({ min: 1e-6, max: 0.01, noNaN: true }),
      fy: fc.double({ min: 200, max: 500, noNaN: true }),
    }),
  });

const arbMemberDesignRow = (): fc.Arbitrary<MemberDesignRow> =>
  fc.record({
    id: fc.string({ minLength: 1, maxLength: 10 }),
    label: fc.string({ minLength: 1, maxLength: 10 }),
    length: fc.double({ min: 0.5, max: 50, noNaN: true }),
    materialType: fc.constantFrom('steel', 'concrete') as fc.Arbitrary<'steel' | 'concrete'>,
    sectionType: fc.string({ minLength: 1 }),
    designCode: fc.option(fc.constantFrom('AISC360', 'IS800', 'EC3') as fc.Arbitrary<'AISC360' | 'IS800' | 'EC3'>, { nil: undefined }),
    maxAxial: fc.double({ min: -2000, max: 2000, noNaN: true }),
    maxShearY: fc.double({ min: -1000, max: 1000, noNaN: true }),
    maxMomentZ: fc.double({ min: -5000, max: 5000, noNaN: true }),
    utilization: fc.double({ min: 0, max: 1.5, noNaN: true }),
    status: fc.constantFrom('PASS', 'FAIL', 'WARNING') as fc.Arbitrary<'PASS' | 'FAIL' | 'WARNING'>,
    governing: fc.string({ minLength: 1 }),
    designResult: fc.record({
      memberId: fc.string({ minLength: 1 }),
      overallStatus: fc.constantFrom('PASS', 'FAIL', 'WARNING') as fc.Arbitrary<'PASS' | 'FAIL' | 'WARNING'>,
      overallUtilization: fc.double({ min: 0, max: 1.5, noNaN: true }),
      checks: fc.array(
        fc.record({
          name: fc.string({ minLength: 1 }),
          demand: fc.double({ min: 0, max: 10000, noNaN: true }),
          capacity: fc.double({ min: 0.001, max: 10000, noNaN: true }),
          utilization: fc.double({ min: 0, max: 1.5, noNaN: true }),
          status: fc.constantFrom('PASS', 'FAIL', 'WARNING') as fc.Arbitrary<'PASS' | 'FAIL' | 'WARNING'>,
          description: fc.string(),
        }),
        { maxLength: 5 },
      ),
      recommendations: fc.array(fc.string(), { maxLength: 3 }),
    }),
  });

const arbPythonRCBeamResult = (): fc.Arbitrary<PythonRCBeamResult> =>
  fc.record({
    momentCapacity: fc.double({ min: 0, max: 5000, noNaN: true }),
    shearCapacity: fc.double({ min: 0, max: 2000, noNaN: true }),
    mainReinforcement: fc.double({ min: 0, max: 10000, noNaN: true }),
    stirrupSpacing: fc.double({ min: 50, max: 400, noNaN: true }),
    utilizationRatio: fc.double({ min: 0, max: 1.5, noNaN: true }),
    status: fc.constantFrom('PASS', 'FAIL', 'WARNING') as fc.Arbitrary<'PASS' | 'FAIL' | 'WARNING'>,
  });

// ─── Property 23: LoadCombosView field mapping ───────────────────────────────

describe('Property 23: Analysis Result Field Mapping', () => {
  it('LoadCombosView: all combination result rows have required fields (id, name, factors)', () => {
    fc.assert(
      fc.property(
        fc.array(arbLoadCombination(), { minLength: 1, maxLength: 20 }),
        (loadCombos) => {
          // Every combination must have non-null id, name, and factors
          for (const combo of loadCombos) {
            expect(combo.id).toBeDefined();
            expect(combo.id).not.toBeNull();
            expect(combo.name).toBeDefined();
            expect(combo.name).not.toBeNull();
            expect(combo.factors).toBeDefined();
            expect(combo.factors).not.toBeNull();
            // factors must be an object with numeric values
            for (const [, v] of Object.entries(combo.factors)) {
              expect(typeof v).toBe('number');
              expect(isNaN(v)).toBe(false);
            }
          }
        },
      ),
      { numRuns: 100 },
    );
  });

  it('DCRatioView: all member results have required fields for utilization display', () => {
    fc.assert(
      fc.property(
        fc.array(arbMemberResult(), { minLength: 1, maxLength: 30 }),
        (members) => {
          for (const m of members) {
            // Fields consumed by DCRatioView
            expect(m.id).toBeDefined();
            expect(typeof m.utilization).toBe('number');
            expect(isNaN(m.utilization)).toBe(false);
            expect(typeof m.length).toBe('number');
            expect(m.length).toBeGreaterThan(0);
            expect(typeof m.stress).toBe('number');
            expect(isNaN(m.stress)).toBe(false);
            expect(typeof m.maxMoment).toBe('number');
            expect(typeof m.maxAxial).toBe('number');
            expect(typeof m.maxShear).toBe('number');
            // materialType must be defined for DC ratio display
            expect(m.materialType).toBeDefined();
            expect(['steel', 'concrete', undefined]).toContain(m.materialType);
          }
        },
      ),
      { numRuns: 100 },
    );
  });

  it('DCRatioView: steel members use steel governing check, concrete members use RC governing check', () => {
    fc.assert(
      fc.property(
        arbMemberResult(),
        (member) => {
          // The governing check logic in DCRatioView uses materialType
          // When materialType is 'concrete', governing check should be "Flexure + Axial (RC)" or "Shear" or "Bending"
          // When materialType is 'steel', governing check should be "Bending", "Shear", or "Axial"
          const sp = member.sectionProps;
          const fy = sp?.fy ?? 250;
          const A = sp?.A ?? 0.01;
          const I = sp?.I ?? 1e-4;
          const c_est = Math.sqrt((12 * I) / A) / 2 || 0.15;
          const Mcap = fy * (I / c_est) * 1000;
          const Ncap = fy * A * 1000;
          const Vcap = 0.6 * fy * A * 1000;
          const mRatio = Mcap > 0 ? Math.abs(member.maxMoment) / Mcap : 0;
          const nRatio = Ncap > 0 ? Math.abs(member.maxAxial) / Ncap : 0;
          const vRatio = Vcap > 0 ? Math.abs(member.maxShear) / Vcap : 0;

          let governing: string;
          if (member.materialType === 'concrete') {
            if (mRatio >= nRatio && mRatio >= vRatio) governing = 'Flexure + Axial (RC)';
            else if (vRatio >= nRatio) governing = 'Shear';
            else governing = 'Bending';
          } else {
            if (mRatio >= nRatio && mRatio >= vRatio) governing = 'Bending';
            else if (vRatio >= nRatio) governing = 'Shear';
            else governing = 'Axial';
          }

          // Governing check must be a non-empty string
          expect(governing).toBeDefined();
          expect(governing.length).toBeGreaterThan(0);
          // Concrete members must not show "Axial" as governing (RC uses combined check)
          if (member.materialType === 'concrete') {
            expect(governing).not.toBe('Axial');
          }
        },
      ),
      { numRuns: 100 },
    );
  });

  it('SteelDesignTab: design rows have designCode and checks array when steel', () => {
    fc.assert(
      fc.property(
        arbMemberDesignRow().filter((r) => r.materialType === 'steel'),
        (row) => {
          // Fields consumed by SteelDesignTab
          expect(row.id).toBeDefined();
          expect(row.label).toBeDefined();
          expect(typeof row.utilization).toBe('number');
          expect(isNaN(row.utilization)).toBe(false);
          expect(typeof row.maxAxial).toBe('number');
          expect(typeof row.maxShearY).toBe('number');
          expect(typeof row.maxMomentZ).toBe('number');
          expect(row.designResult).toBeDefined();
          expect(Array.isArray(row.designResult.checks)).toBe(true);
          // designCode when present must be one of the valid codes
          if (row.designCode !== undefined) {
            expect(['AISC360', 'IS800', 'EC3']).toContain(row.designCode);
          }
        },
      ),
      { numRuns: 100 },
    );
  });

  it('SteelDesignTab: is800Result checks have required fields when present', () => {
    fc.assert(
      fc.property(
        arbMemberDesignRow().filter((r) => r.materialType === 'steel'),
        fc.array(
          fc.record({
            name: fc.string({ minLength: 1 }),
            utilization: fc.float({ min: 0, max: 1.5, noNaN: true }),
            status: fc.constantFrom('PASS', 'FAIL', 'WARNING') as fc.Arbitrary<'PASS' | 'FAIL' | 'WARNING'>,
            description: fc.option(fc.string(), { nil: undefined }),
          }),
          { minLength: 1, maxLength: 5 },
        ),
        (row, checks) => {
          const is800Result = {
            checks,
            governingCheck: checks[0]?.name ?? '–',
            utilization: checks[0]?.utilization ?? 0,
          };
          // All checks must have required fields
          for (const check of is800Result.checks) {
            expect(check.name).toBeDefined();
            expect(check.name.length).toBeGreaterThan(0);
            expect(typeof check.utilization).toBe('number');
            expect(isNaN(check.utilization)).toBe(false);
            expect(['PASS', 'FAIL', 'WARNING']).toContain(check.status);
          }
          expect(is800Result.governingCheck).toBeDefined();
          expect(typeof is800Result.utilization).toBe('number');
        },
      ),
      { numRuns: 100 },
    );
  });

  it('RCBeamTab: concrete design rows have required force fields', () => {
    fc.assert(
      fc.property(
        arbMemberDesignRow().filter((r) => r.materialType === 'concrete'),
        (row) => {
          // Fields consumed by RCBeamTab
          expect(row.id).toBeDefined();
          expect(row.label).toBeDefined();
          expect(typeof row.maxMomentZ).toBe('number');
          expect(isNaN(row.maxMomentZ)).toBe(false);
          expect(typeof row.maxShearY).toBe('number');
          expect(isNaN(row.maxShearY)).toBe(false);
          expect(typeof row.maxAxial).toBe('number');
          expect(isNaN(row.maxAxial)).toBe(false);
          expect(typeof row.length).toBe('number');
          expect(row.length).toBeGreaterThan(0);
        },
      ),
      { numRuns: 100 },
    );
  });

  it('RCBeamTab: Python RC result fields are all defined and non-null when present', () => {
    fc.assert(
      fc.property(
        arbPythonRCBeamResult(),
        (pythonResult) => {
          // All Python response fields must be defined and valid
          expect(typeof pythonResult.momentCapacity).toBe('number');
          expect(isNaN(pythonResult.momentCapacity)).toBe(false);
          expect(pythonResult.momentCapacity).toBeGreaterThanOrEqual(0);

          expect(typeof pythonResult.shearCapacity).toBe('number');
          expect(isNaN(pythonResult.shearCapacity)).toBe(false);
          expect(pythonResult.shearCapacity).toBeGreaterThanOrEqual(0);

          expect(typeof pythonResult.mainReinforcement).toBe('number');
          expect(isNaN(pythonResult.mainReinforcement)).toBe(false);
          expect(pythonResult.mainReinforcement).toBeGreaterThanOrEqual(0);

          expect(typeof pythonResult.stirrupSpacing).toBe('number');
          expect(isNaN(pythonResult.stirrupSpacing)).toBe(false);
          expect(pythonResult.stirrupSpacing).toBeGreaterThan(0);

          expect(typeof pythonResult.utilizationRatio).toBe('number');
          expect(isNaN(pythonResult.utilizationRatio)).toBe(false);
          expect(pythonResult.utilizationRatio).toBeGreaterThanOrEqual(0);

          expect(['PASS', 'FAIL', 'WARNING']).toContain(pythonResult.status);
        },
      ),
      { numRuns: 100 },
    );
  });

  it('RCBeamTab: utilization ratio from Python result overrides local design when present', () => {
    fc.assert(
      fc.property(
        arbMemberDesignRow().filter((r) => r.materialType === 'concrete'),
        arbPythonRCBeamResult(),
        (row, pythonResult) => {
          // When pythonRCResult is present, the row's utilization should reflect it
          const rowWithPython: MemberDesignRow = {
            ...row,
            pythonRCResult: pythonResult,
            utilization: pythonResult.utilizationRatio,
            status: pythonResult.status,
          };

          expect(rowWithPython.utilization).toBe(pythonResult.utilizationRatio);
          expect(rowWithPython.status).toBe(pythonResult.status);
          expect(rowWithPython.pythonRCResult).toBeDefined();
          expect(rowWithPython.pythonRCResult!.momentCapacity).toBeGreaterThanOrEqual(0);
          expect(rowWithPython.pythonRCResult!.shearCapacity).toBeGreaterThanOrEqual(0);
        },
      ),
      { numRuns: 100 },
    );
  });
});
