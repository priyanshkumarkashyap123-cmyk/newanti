/**
 * Property-based tests for design codes (Property 17)
 * Feature: staad-pro-modeling-tools, Property 17: all required design codes are present
 * Validates: Requirements 22.1, 22.2, 22.3
 */
import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { DESIGN_CODES } from '../structural-ui.config';

// Required steel codes per spec
const REQUIRED_STEEL_CODES = ['GB50017', 'BS5950', 'AIJ', 'SNIP', 'AASHTO_LRFD', 'AA_ADM1'];
// Required concrete codes per spec
const REQUIRED_CONCRETE_CODES = ['CSA_A23', 'SP52101', 'IS13920'];
// Required timber codes per spec
const REQUIRED_TIMBER_CODES = ['EC5'];

describe('Design Codes — property tests', () => {
  /**
   * Property 17: All required design codes are present in DESIGN_CODES
   * Feature: staad-pro-modeling-tools, Property 17: all required design codes are present
   */
  it('all required steel codes are present with non-empty name, country, description', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...REQUIRED_STEEL_CODES),
        (code) => {
          const entry = (DESIGN_CODES.steel as Record<string, { name: string; country: string; description: string }>)[code];
          return (
            entry !== undefined &&
            entry.name.length > 0 &&
            entry.country.length > 0 &&
            entry.description.length > 0
          );
        },
      ),
      { numRuns: 100 },
    );
  });

  it('all required concrete codes are present with non-empty name, country, description', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...REQUIRED_CONCRETE_CODES),
        (code) => {
          const entry = (DESIGN_CODES.concrete as Record<string, { name: string; country: string; description: string }>)[code];
          return (
            entry !== undefined &&
            entry.name.length > 0 &&
            entry.country.length > 0 &&
            entry.description.length > 0
          );
        },
      ),
      { numRuns: 100 },
    );
  });

  it('EC5 timber code is present with non-empty name, country, description', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...REQUIRED_TIMBER_CODES),
        (code) => {
          const entry = (DESIGN_CODES.timber as Record<string, { name: string; country: string; description: string }>)[code];
          return (
            entry !== undefined &&
            entry.name.length > 0 &&
            entry.country.length > 0 &&
            entry.description.length > 0
          );
        },
      ),
      { numRuns: 100 },
    );
  });

  it('GB50017 has beta: false', () => {
    const entry = (DESIGN_CODES.steel as any)['GB50017'];
    expect(entry).toBeDefined();
    expect(entry.beta).toBe(false);
  });

  it('EC5 timber code has beta: false', () => {
    const entry = (DESIGN_CODES.timber as any)['EC5'];
    expect(entry).toBeDefined();
    expect(entry.beta).toBe(false);
  });
});
