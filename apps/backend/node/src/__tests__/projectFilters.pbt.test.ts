/**
 * Property-Based Tests for project filtering logic
 *
 * Property 8: Favorites tab shows only favorited projects
 * Property 9: Default view excludes soft-deleted projects
 * Property 12: Project Filter Invariants (Trash tab)
 *
 * Validates: Requirements 7.1, 7.2, 7.6, 12.4, 12.5, 12.6
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';

interface ProjectLike {
  isFavorited: boolean;
  deletedAt: Date | null;
}

/**
 * filterFavorites — returns only favorited, non-deleted projects.
 * Mirrors the server-side query: { isFavorited: true, deletedAt: null }
 */
function filterFavorites(projects: ProjectLike[]): ProjectLike[] {
  return projects.filter((p) => p.isFavorited === true && p.deletedAt === null);
}

/**
 * filterActiveProjects — returns only non-deleted projects.
 * Mirrors the server-side query: { deletedAt: null }
 */
function filterActiveProjects(projects: ProjectLike[]): ProjectLike[] {
  return projects.filter((p) => p.deletedAt === null);
}

describe('Property 8: Favorites tab shows only favorited projects', () => {
  it('filterFavorites returns only isFavorited=true && deletedAt=null projects', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            isFavorited: fc.boolean(),
            deletedAt: fc.option(fc.date(), { nil: null }),
          }),
        ),
        (projects) => {
          const result = filterFavorites(projects);
          return result.every((p) => p.isFavorited === true && p.deletedAt === null);
        },
      ),
      { numRuns: 100 },
    );
  });

  it('filterFavorites does not include non-favorited projects', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            isFavorited: fc.boolean(),
            deletedAt: fc.option(fc.date(), { nil: null }),
          }),
        ),
        (projects) => {
          const result = filterFavorites(projects);
          return result.every((p) => p.isFavorited === true);
        },
      ),
      { numRuns: 100 },
    );
  });

  it('filterFavorites does not include soft-deleted projects', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            isFavorited: fc.constant(true),
            deletedAt: fc.option(fc.date(), { nil: null }),
          }),
        ),
        (projects) => {
          const result = filterFavorites(projects);
          return result.every((p) => p.deletedAt === null);
        },
      ),
      { numRuns: 100 },
    );
  });
});

describe('Property 9: Default view excludes soft-deleted projects', () => {
  it('filterActiveProjects returns only deletedAt=null projects', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            deletedAt: fc.option(fc.date(), { nil: null }),
          }),
        ),
        (projects) => {
          const result = filterActiveProjects(projects);
          return result.every((p) => p.deletedAt === null);
        },
      ),
      { numRuns: 100 },
    );
  });

  it('filterActiveProjects includes all non-deleted projects', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            deletedAt: fc.constant(null),
          }),
        ),
        (projects) => {
          const result = filterActiveProjects(projects);
          return result.length === projects.length;
        },
      ),
      { numRuns: 100 },
    );
  });
});

/**
 * filterTrashProjects — returns only soft-deleted projects.
 * Mirrors the server-side query: { deletedAt: { $ne: null } }
 */
function filterTrashProjects(projects: ProjectLike[]): ProjectLike[] {
  return projects.filter((p) => p.deletedAt !== null);
}

/**
 * Property 12: Project Filter Invariants
 * Validates: Requirements 12.4, 12.5, 12.6
 */
describe('Property 12: Project Filter Invariants', () => {
  it('Favorites tab returns only isFavorited=true AND deletedAt=null', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            isFavorited: fc.boolean(),
            deletedAt: fc.option(fc.date(), { nil: null }),
          }),
        ),
        (projects) => {
          const result = filterFavorites(projects);
          return result.every((p) => p.isFavorited === true && p.deletedAt === null);
        },
      ),
      { numRuns: 200 },
    );
  });

  it('Trash tab returns only projects where deletedAt !== null', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            isFavorited: fc.boolean(),
            deletedAt: fc.option(fc.date(), { nil: null }),
          }),
        ),
        (projects) => {
          const result = filterTrashProjects(projects);
          return result.every((p) => p.deletedAt !== null);
        },
      ),
      { numRuns: 200 },
    );
  });

  it('Trash tab includes all soft-deleted projects', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            isFavorited: fc.boolean(),
            deletedAt: fc.date(), // always a date (always deleted)
          }),
        ),
        (projects) => {
          const result = filterTrashProjects(projects);
          return result.length === projects.length;
        },
      ),
      { numRuns: 200 },
    );
  });

  it('My Projects (default) excludes all soft-deleted projects', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            isFavorited: fc.boolean(),
            deletedAt: fc.option(fc.date(), { nil: null }),
          }),
        ),
        (projects) => {
          const result = filterActiveProjects(projects);
          return result.every((p) => p.deletedAt === null);
        },
      ),
      { numRuns: 200 },
    );
  });

  it('Favorites and Trash are disjoint sets', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            isFavorited: fc.boolean(),
            deletedAt: fc.option(fc.date(), { nil: null }),
          }),
        ),
        (projects) => {
          const favorites = filterFavorites(projects);
          const trash = filterTrashProjects(projects);
          // A project cannot appear in both favorites and trash
          const favoriteSet = new Set(favorites);
          return trash.every((p) => !favoriteSet.has(p));
        },
      ),
      { numRuns: 200 },
    );
  });
});
