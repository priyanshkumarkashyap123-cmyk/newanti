/**
 * FeedbackService.test.ts — Tests for the FeedbackService class
 *
 * Validates correction/rating/error logging, retrieval,
 * statistics, and training data export.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// Stub localStorage before importing the module (the singleton reads it on init)
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: vi.fn((key: string) => store[key] ?? null),
    setItem: vi.fn((key: string, value: string) => { store[key] = value; }),
    removeItem: vi.fn((key: string) => { delete store[key]; }),
    clear: vi.fn(() => { store = {}; }),
    get length() { return Object.keys(store).length; },
    key: vi.fn((_: number) => null),
  };
})();

Object.defineProperty(globalThis, 'localStorage', { value: localStorageMock, writable: true });

// Dynamic import so the module sees our mock
// We'll import the named exports we need
let feedbackService: typeof import('@/services/FeedbackService')['feedbackService'];

describe('FeedbackService', () => {
  beforeEach(async () => {
    localStorageMock.clear();
    // Re-import to get a fresh module, but the singleton is module-scoped.
    // Instead, we use clearAll to reset state between tests.
    const mod = await import('@/services/FeedbackService');
    feedbackService = mod.feedbackService;
    feedbackService.clearAll();
  });

  // ──────────────────────────────────────────
  // logCorrection
  // ──────────────────────────────────────────

  it('logCorrection() returns a string id', () => {
    const id = feedbackService.logCorrection(
      'model_generation',
      'build a truss',
      { members: 5 },
      { members: 7 },
    );
    expect(typeof id).toBe('string');
    expect(id.length).toBeGreaterThan(0);
  });

  it('logCorrection() entry appears in getRecent', () => {
    feedbackService.logCorrection(
      'analysis',
      'analyze frame',
      { stress: 100 },
      { stress: 120 },
    );
    const recent = feedbackService.getRecent(10);
    expect(recent.length).toBe(1);
    expect(recent[0].type).toBe('correction');
    expect(recent[0].feature).toBe('analysis');
  });

  // ──────────────────────────────────────────
  // logRating
  // ──────────────────────────────────────────

  it('logRating() stores the rating value', () => {
    feedbackService.logRating(
      'design_check',
      'check beam',
      { ratio: 0.85 },
      4,
      'Good result',
    );
    const recent = feedbackService.getRecent(10);
    expect(recent.length).toBe(1);
    expect(recent[0].rating).toBe(4);
    expect(recent[0].comment).toBe('Good result');
  });

  // ──────────────────────────────────────────
  // logError
  // ──────────────────────────────────────────

  it('logError() creates an error_report entry', () => {
    feedbackService.logError(
      'optimization',
      'optimize section',
      new Error('Solver diverged'),
      'Crashed during optimization',
    );
    const recent = feedbackService.getRecent(10);
    expect(recent.length).toBe(1);
    expect(recent[0].type).toBe('error_report');
    expect(recent[0].originalOutput).toHaveProperty('error');
  });

  // ──────────────────────────────────────────
  // getRecent
  // ──────────────────────────────────────────

  it('getRecent() returns entries in reverse chronological order', () => {
    feedbackService.logRating('analysis', 'a', {}, 3);
    feedbackService.logRating('analysis', 'b', {}, 5);

    const recent = feedbackService.getRecent(10);
    expect(recent.length).toBe(2);
    // Most recent first
    expect(recent[0].originalInput).toBe('b');
    expect(recent[1].originalInput).toBe('a');
  });

  // ──────────────────────────────────────────
  // getStats
  // ──────────────────────────────────────────

  it('getStats() computes correct totals and average rating', () => {
    feedbackService.logCorrection('model_generation', 'a', {}, {});
    feedbackService.logRating('analysis', 'b', {}, 4);
    feedbackService.logRating('analysis', 'c', {}, 2);

    const stats = feedbackService.getStats();
    expect(stats.totalFeedback).toBe(3);
    expect(stats.corrections).toBe(1);
    expect(stats.averageRating).toBeCloseTo(3, 1); // (4+2)/2
    expect(stats.byFeature['analysis']).toBe(2);
    expect(stats.byType['correction']).toBe(1);
  });

  // ──────────────────────────────────────────
  // exportTrainingData
  // ──────────────────────────────────────────

  it('exportTrainingData() includes only corrections with correctedOutput', () => {
    feedbackService.logCorrection('model_generation', 'input1', { a: 1 }, { a: 2 });
    feedbackService.logRating('analysis', 'input2', {}, 5);

    const data = feedbackService.exportTrainingData();
    expect(data.version).toBe('1.0');
    expect(data.exportDate).toBeInstanceOf(Date);
    expect(data.entries).toHaveLength(1);
    expect(data.entries[0].featureType).toBe('model_generation');
  });

  // ──────────────────────────────────────────
  // clearAll
  // ──────────────────────────────────────────

  it('clearAll() empties all entries', () => {
    feedbackService.logRating('analysis', 'x', {}, 3);
    feedbackService.clearAll();

    expect(feedbackService.getRecent(100)).toHaveLength(0);
    expect(feedbackService.getStats().totalFeedback).toBe(0);
  });
});
