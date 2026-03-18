// Feature: space-planning-accuracy-and-tools, Property 11: Convergence Indicator Correctness
// Validates: Requirements 7.3

import { isConverged, ConvergenceEntry } from '../../../pages/SensitivityOptimizationDashboard';

function makeHistory(values: number[]): ConvergenceEntry[] {
  return values.map((v, i) => ({ iteration: i + 1, objectiveValue: v, timestamp: i * 100 }));
}

describe('isConverged', () => {
  it('returns false when history has fewer than 10 entries', () => {
    const history = makeHistory([100, 99, 98, 97, 96, 95, 94, 93, 92]);
    expect(isConverged(history, 0.01)).toBe(false);
  });

  it('returns false for empty history', () => {
    expect(isConverged([], 0.01)).toBe(false);
  });

  it('returns true when last 10 values are identical (fully converged)', () => {
    const history = makeHistory([200, 150, 120, 110, 105, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100]);
    expect(isConverged(history, 0.01)).toBe(true);
  });

  it('returns true when last 10 values have very small variance', () => {
    const base = 100;
    const history = makeHistory([200, 150, 120, ...Array(10).fill(0).map((_, i) => base + i * 0.0001)]);
    expect(isConverged(history, 0.01)).toBe(true);
  });

  it('returns false when last 10 values have large variance', () => {
    const history = makeHistory([100, 90, 80, 70, 60, 50, 40, 30, 20, 10, 5]);
    expect(isConverged(history, 0.01)).toBe(false);
  });

  it('only considers the last 10 entries regardless of history length', () => {
    // First 20 entries have large variance, last 10 are stable
    const unstable = Array.from({ length: 20 }, (_, i) => 1000 - i * 50);
    const stable = Array(10).fill(100);
    const history = makeHistory([...unstable, ...stable]);
    expect(isConverged(history, 0.01)).toBe(true);
  });

  it('returns false when exactly 10 entries but high variance', () => {
    const history = makeHistory([100, 200, 100, 200, 100, 200, 100, 200, 100, 200]);
    expect(isConverged(history, 0.01)).toBe(false);
  });

  it('respects tolerance parameter', () => {
    // Variance of ~5% — converged at 0.1 tolerance but not at 0.01
    const history = makeHistory([200, 150, 120, 110, 105, 100, 103, 102, 101, 100, 105, 100, 103, 102, 101]);
    expect(isConverged(history, 0.1)).toBe(true);
    expect(isConverged(history, 0.001)).toBe(false);
  });
});
