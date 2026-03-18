/**
 * Property-based tests for Structure Wizard generators (Property 14)
 * Feature: staad-pro-modeling-tools, Property 14: wizard generates valid member references
 * Validates: Requirements 20.3, 20.6
 */
import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import {
  generateTemplate,
  generateKingPost,
  generateQueenPost,
  generateCylindricalFrame,
  generateSphericalSurface,
  type TemplateId,
} from '../structureWizardGenerators';

describe('Structure Wizard Generators — property tests', () => {
  /**
   * Property 14: Structure Wizard generates valid member references
   * Feature: staad-pro-modeling-tools, Property 14: wizard generates valid member references
   */
  it('all generated members reference existing node IDs for all templates', () => {
    const templates: TemplateId[] = ['kingPost', 'queenPost', 'scissors', 'cylindrical', 'spherical'];
    fc.assert(
      fc.property(
        fc.constantFrom(...templates),
        fc.integer({ min: 4, max: 10 }),
        (template, divisions) => {
          const structure = generateTemplate(template, {
            span: 12,
            rise: 3,
            panels: divisions,
            nStories: 2,
            nParallel: divisions,
          });
          const nodeIds = new Set(structure.nodes.map((n) => n.id));
          return structure.members.every(
            (m) => nodeIds.has(m.startNodeId) && nodeIds.has(m.endNodeId),
          );
        },
      ),
      { numRuns: 100 },
    );
  });

  it('King Post truss generates exactly 4 nodes and 4 members', () => {
    fc.assert(
      fc.property(
        fc.float({ min: Math.fround(4), max: Math.fround(20), noNaN: true }),
        fc.float({ min: Math.fround(1), max: Math.fround(6), noNaN: true }),
        (span, rise) => {
          const s = generateKingPost({ span, rise });
          return s.nodes.length === 4 && s.members.length === 4;
        },
      ),
      { numRuns: 100 },
    );
  });

  it('Queen Post truss generates exactly 6 nodes and 8 members', () => {
    fc.assert(
      fc.property(
        fc.float({ min: Math.fround(6), max: Math.fround(24), noNaN: true }),
        fc.float({ min: Math.fround(1), max: Math.fround(6), noNaN: true }),
        (span, rise) => {
          const s = generateQueenPost({ span, rise });
          return s.nodes.length === 6 && s.members.length === 8;
        },
      ),
      { numRuns: 100 },
    );
  });

  it('Cylindrical Frame generates correct node count: (nStories+1) × nBays', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 3, max: 8 }),
        fc.integer({ min: 1, max: 4 }),
        (nBays, nStories) => {
          const s = generateCylindricalFrame({ radius: 6, height: 10, nBays, nStories });
          return s.nodes.length === (nStories + 1) * nBays;
        },
      ),
      { numRuns: 100 },
    );
  });

  it('Spherical Surface generates correct node count: (nMeridional+1) × nParallel', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 3, max: 8 }),
        fc.integer({ min: 3, max: 8 }),
        (nMeridional, nParallel) => {
          const s = generateSphericalSurface({ radius: 8, nMeridional, nParallel });
          return s.nodes.length === (nMeridional + 1) * nParallel;
        },
      ),
      { numRuns: 100 },
    );
  });

  it('all member references are valid for Cylindrical Frame', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 3, max: 8 }),
        fc.integer({ min: 1, max: 4 }),
        (nBays, nStories) => {
          const s = generateCylindricalFrame({ radius: 6, height: 10, nBays, nStories });
          const nodeIds = new Set(s.nodes.map((n) => n.id));
          return s.members.every((m) => nodeIds.has(m.startNodeId) && nodeIds.has(m.endNodeId));
        },
      ),
      { numRuns: 100 },
    );
  });

  it('all member references are valid for Spherical Surface', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 3, max: 8 }),
        fc.integer({ min: 3, max: 8 }),
        (nMeridional, nParallel) => {
          const s = generateSphericalSurface({ radius: 8, nMeridional, nParallel });
          const nodeIds = new Set(s.nodes.map((n) => n.id));
          return s.members.every((m) => nodeIds.has(m.startNodeId) && nodeIds.has(m.endNodeId));
        },
      ),
      { numRuns: 100 },
    );
  });
});
