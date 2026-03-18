// Feature: space-planning-accuracy-and-tools, Property 9: Pareto Non-Domination
// Validates: Requirements 6.1

import { computeParetoFront, ParetoPoint } from '../../../pages/SensitivityOptimizationDashboard';

function makePoint(id: string, weight: number, displacement: number, cost: number, stiffness: number): ParetoPoint {
  return { id, sectionAssignments: {}, weight, displacement, cost, stiffness, dominated: false };
}

describe('computeParetoFront', () => {
  it('returns empty array for empty input', () => {
    expect(computeParetoFront([], ['weight', 'displacement'])).toEqual([]);
  });

  it('returns single point as non-dominated', () => {
    const points = [makePoint('p1', 100, 5, 200, 50)];
    const front = computeParetoFront(points, ['weight', 'displacement']);
    expect(front).toHaveLength(1);
    expect(front[0].dominated).toBe(false);
  });

  it('identifies dominated point correctly', () => {
    // p1 dominates p2: p1 has lower weight AND lower displacement
    const points = [
      makePoint('p1', 100, 5, 200, 50),
      makePoint('p2', 150, 8, 250, 40), // dominated by p1
    ];
    const front = computeParetoFront(points, ['weight', 'displacement']);
    expect(front).toHaveLength(1);
    expect(front[0].id).toBe('p1');
  });

  it('returns both points when neither dominates the other (trade-off)', () => {
    // p1 has lower weight but higher displacement; p2 has higher weight but lower displacement
    const points = [
      makePoint('p1', 100, 10, 200, 50),
      makePoint('p2', 150, 5, 250, 40),
    ];
    const front = computeParetoFront(points, ['weight', 'displacement']);
    expect(front).toHaveLength(2);
  });

  it('Property 9: no point in the Pareto front is dominated by another', () => {
    const points = [
      makePoint('p1', 100, 5, 200, 50),
      makePoint('p2', 120, 4, 220, 55),
      makePoint('p3', 90, 7, 180, 45),
      makePoint('p4', 200, 10, 300, 30), // dominated
    ];
    const front = computeParetoFront(points, ['weight', 'displacement']);

    // Verify no point in front is dominated by any other point in front
    for (let i = 0; i < front.length; i++) {
      for (let j = 0; j < front.length; j++) {
        if (i === j) continue;
        const p = front[i];
        const q = front[j];
        // p should not dominate q (both are non-dominated)
        const pDominatesQ = p.weight <= q.weight && p.displacement <= q.displacement &&
          (p.weight < q.weight || p.displacement < q.displacement);
        expect(pDominatesQ).toBe(false);
      }
    }
  });

  it('handles stiffness (maximize) objective correctly', () => {
    // p1 has higher stiffness → better for maximize-stiffness
    const points = [
      makePoint('p1', 100, 5, 200, 80), // higher stiffness
      makePoint('p2', 100, 5, 200, 50), // lower stiffness → dominated
    ];
    const front = computeParetoFront(points, ['weight', 'stiffness']);
    expect(front).toHaveLength(1);
    expect(front[0].id).toBe('p1');
  });

  it('returns all points when all are non-dominated', () => {
    const points = [
      makePoint('p1', 100, 10, 200, 50),
      makePoint('p2', 110, 8, 210, 55),
      makePoint('p3', 120, 6, 220, 60),
    ];
    const front = computeParetoFront(points, ['weight', 'displacement']);
    expect(front).toHaveLength(3);
  });
});
