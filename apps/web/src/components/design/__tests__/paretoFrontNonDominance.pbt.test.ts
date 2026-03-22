/**
 * Property-Based Test — Pareto Front Non-Dominance
 *
 * **Validates: Requirements 14.3**
 *
 * Property 17: For any set of optimization solutions S, no solution in the
 * computed Pareto front must be strictly dominated by another solution in
 * the same front.
 *
 * Formally: ∀ a, b ∈ ParetoFront: ¬(a dominates b) ∧ ¬(b dominates a)
 */

import { describe, it } from 'vitest';
import fc from 'fast-check';
import { computeParetoFront, type ParetoPoint } from '../../../pages/SensitivityOptimizationDashboard';

// ── Helpers ──────────────────────────────────────────────────────────────────

function makePoint(
  id: string,
  weight: number,
  displacement: number,
  cost: number,
  stiffness: number,
): ParetoPoint {
  return { id, sectionAssignments: {}, weight, displacement, cost, stiffness, dominated: false };
}

/**
 * Returns true if point `p` strictly dominates point `q` on the given objectives.
 * Dominance: p is at least as good on all objectives AND strictly better on at least one.
 */
function dominates(
  p: ParetoPoint,
  q: ParetoPoint,
  objectives: Array<'weight' | 'displacement' | 'cost' | 'stiffness'>,
): boolean {
  let atLeastAsGoodOnAll = true;
  let strictlyBetterOnOne = false;

  for (const obj of objectives) {
    const pVal = p[obj];
    const qVal = q[obj];
    const isMinimize = obj !== 'stiffness';

    if (isMinimize) {
      if (pVal > qVal) { atLeastAsGoodOnAll = false; break; }
      if (pVal < qVal) strictlyBetterOnOne = true;
    } else {
      // maximize: higher is better
      if (pVal < qVal) { atLeastAsGoodOnAll = false; break; }
      if (pVal > qVal) strictlyBetterOnOne = true;
    }
  }

  return atLeastAsGoodOnAll && strictlyBetterOnOne;
}

// ── Arbitraries ───────────────────────────────────────────────────────────────

/** Generates a random ParetoPoint with positive objective values */
const arbPoint = (id: string) =>
  fc.record({
    weight: fc.float({ min: Math.fround(10), max: Math.fround(10000), noNaN: true }),
    displacement: fc.float({ min: Math.fround(0.1), max: Math.fround(100), noNaN: true }),
    cost: fc.float({ min: Math.fround(100), max: Math.fround(100000), noNaN: true }),
    stiffness: fc.float({ min: Math.fround(1), max: Math.fround(1000), noNaN: true }),
  }).map(({ weight, displacement, cost, stiffness }) =>
    makePoint(id, weight, displacement, cost, stiffness),
  );

/** Generates a list of 2–20 random ParetoPoints */
const arbPoints = fc.array(
  fc.nat({ max: 19 }).chain(i => arbPoint(`p${i}`)),
  { minLength: 2, maxLength: 20 },
);

/** Generates a non-empty subset of objectives */
const arbObjectives = fc.shuffledSubarray(
  ['weight', 'displacement', 'cost', 'stiffness'] as const,
  { minLength: 2, maxLength: 4 },
);

// ── Property Tests ────────────────────────────────────────────────────────────

describe('Property 17: Pareto Front Non-Dominance', () => {
  it('no point in the Pareto front is dominated by another point in the same front', () => {
    fc.assert(
      fc.property(arbPoints, arbObjectives, (rawPoints, objectives) => {
        // Deduplicate by id to avoid trivial same-point comparisons
        const seen = new Set<string>();
        const points = rawPoints.filter(p => {
          if (seen.has(p.id)) return false;
          seen.add(p.id);
          return true;
        });

        if (points.length < 2) return; // skip degenerate cases

        const front = computeParetoFront(points, objectives);

        // Property: ∀ a, b ∈ front: ¬(a dominates b)
        for (let i = 0; i < front.length; i++) {
          for (let j = 0; j < front.length; j++) {
            if (i === j) continue;
            const a = front[i];
            const b = front[j];
            const aDominatesB = dominates(a, b, objectives);
            if (aDominatesB) {
              throw new Error(
                `Non-dominance violated: point ${a.id} dominates ${b.id} in the Pareto front. ` +
                `Objectives: ${objectives.join(', ')}. ` +
                `a=(w:${a.weight.toFixed(2)}, d:${a.displacement.toFixed(2)}), ` +
                `b=(w:${b.weight.toFixed(2)}, d:${b.displacement.toFixed(2)})`,
              );
            }
          }
        }
      }),
      { numRuns: 200, seed: 42 },
    );
  });

  it('all points in the front have dominated=false', () => {
    fc.assert(
      fc.property(arbPoints, arbObjectives, (rawPoints, objectives) => {
        const seen = new Set<string>();
        const points = rawPoints.filter(p => {
          if (seen.has(p.id)) return false;
          seen.add(p.id);
          return true;
        });

        const front = computeParetoFront(points, objectives);
        for (const p of front) {
          if (p.dominated) {
            throw new Error(`Point ${p.id} in Pareto front has dominated=true`);
          }
        }
      }),
      { numRuns: 200, seed: 43 },
    );
  });

  it('Pareto front is a subset of the input candidates', () => {
    fc.assert(
      fc.property(arbPoints, arbObjectives, (rawPoints, objectives) => {
        const seen = new Set<string>();
        const points = rawPoints.filter(p => {
          if (seen.has(p.id)) return false;
          seen.add(p.id);
          return true;
        });

        const front = computeParetoFront(points, objectives);
        const inputIds = new Set(points.map(p => p.id));
        for (const p of front) {
          if (!inputIds.has(p.id)) {
            throw new Error(`Pareto front contains point ${p.id} not in input`);
          }
        }
      }),
      { numRuns: 200, seed: 44 },
    );
  });
});
