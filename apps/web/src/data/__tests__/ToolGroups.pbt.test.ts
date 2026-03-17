/**
 * Property-based tests for ToolGroups.ts
 * Feature: staad-pro-modeling-tools
 */
import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { TOOL_DEFINITIONS, MODELING_TOOL_GROUPS } from '../ToolGroups';

// All new tool IDs from the STAAD.Pro parity spec
const ANALYSIS_TOOLS = [
  'PDELTA_ANALYSIS',
  'BUCKLING_ANALYSIS',
  'TIME_HISTORY_ANALYSIS',
  'NONLINEAR_ANALYSIS',
  'DYNAMICS_PANEL',
  'PLATE_STRESS_CONTOUR',
  'RESPONSE_SPECTRUM_ANALYSIS',
  'PUSHOVER_ANALYSIS',
  'STEADY_STATE_ANALYSIS',
  'IMPERFECTION_ANALYSIS',
  'VIEW_STORY_DRIFT',
  'VIEW_FORCE_ENVELOPE',
  'VIEW_SECTION_FORCES',
  'ANIMATE_MODE_SHAPE',
];

const PROPERTY_TOOLS = [
  'ASSIGN_PARTIAL_RELEASE',
  'ASSIGN_TENSION_ONLY',
  'ASSIGN_COMPRESSION_ONLY',
  'ASSIGN_INACTIVE',
  'ASSIGN_DIAPHRAGM',
  'ASSIGN_MASTER_SLAVE',
  'ASSIGN_PROPERTY_REDUCTION',
];

const LOADING_TOOLS = ['ADD_FLOOR_LOAD', 'ADD_AREA_LOAD', 'ADD_SNOW_LOAD'];

describe('ToolGroups — STAAD.Pro parity property tests', () => {
  /**
   * Property 1: All new tool IDs are registered with correct category
   * Feature: staad-pro-modeling-tools, Property 1: tool IDs registered with correct category
   * Validates: Requirements 1.8, 2.1, 3.1, 3.2, 4.1, 5.1, 6.1, 7.1, 8.1, 9.1, 10.1,
   *            11.1, 12.1, 13.1, 14.1, 15.1, 16.1, 17.1, 18.1, 23.1–23.3
   */
  it('all new ANALYSIS tool IDs exist in TOOL_DEFINITIONS with category ANALYSIS', () => {
    fc.assert(
      fc.property(fc.constantFrom(...ANALYSIS_TOOLS), (toolId) => {
        const def = TOOL_DEFINITIONS[toolId];
        return def !== undefined && def.category === 'ANALYSIS';
      }),
      { numRuns: 100 },
    );
  });

  it('all new PROPERTIES tool IDs exist in TOOL_DEFINITIONS with category PROPERTIES', () => {
    fc.assert(
      fc.property(fc.constantFrom(...PROPERTY_TOOLS), (toolId) => {
        const def = TOOL_DEFINITIONS[toolId];
        return def !== undefined && def.category === 'PROPERTIES';
      }),
      { numRuns: 100 },
    );
  });

  it('all new LOADING tool IDs exist in TOOL_DEFINITIONS with category LOADING', () => {
    fc.assert(
      fc.property(fc.constantFrom(...LOADING_TOOLS), (toolId) => {
        const def = TOOL_DEFINITIONS[toolId];
        return def !== undefined && def.category === 'LOADING';
      }),
      { numRuns: 100 },
    );
  });

  /**
   * Property 2: No duplicate tool IDs across all groups
   * Feature: staad-pro-modeling-tools, Property 2: no duplicate tool IDs
   * Validates: Requirements 23.4
   */
  it('MODELING_TOOL_GROUPS has no duplicate tool IDs', () => {
    const allIds = MODELING_TOOL_GROUPS.flatMap((g) => g.tools);
    expect(allIds.length).toBe(new Set(allIds).size);
  });

  it('each new tool definition has non-empty label, tooltip, and icon', () => {
    const allNewTools = [...ANALYSIS_TOOLS, ...PROPERTY_TOOLS, ...LOADING_TOOLS];
    fc.assert(
      fc.property(fc.constantFrom(...allNewTools), (toolId) => {
        const def = TOOL_DEFINITIONS[toolId];
        return (
          def !== undefined &&
          def.label.length > 0 &&
          def.tooltip.length > 0 &&
          def.icon !== undefined
        );
      }),
      { numRuns: 100 },
    );
  });
});
