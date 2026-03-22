import { describe, expect, it } from 'vitest';
import {
  ANALYSIS_INTENTS,
  DESIGN_INTENTS,
  buildAnalysisWorkflowTarget,
  buildDesignWorkflowTarget,
  evaluateWorkflowGuard,
  isAnalysisIntent,
  isDesignIntent,
  resolveWorkflowQuery,
} from '../workflowIntentRouting';

describe('workflow intent routing contract', () => {
  it('accepts all declared analysis intents and rejects unknown values', () => {
    for (const intent of ANALYSIS_INTENTS) {
      expect(isAnalysisIntent(intent)).toBe(true);
    }

    expect(isAnalysisIntent('')).toBe(false);
    expect(isAnalysisIntent('unknown-analysis')).toBe(false);
    expect(isAnalysisIntent(null)).toBe(false);
  });

  it('accepts all declared design intents and rejects unknown values', () => {
    for (const intent of DESIGN_INTENTS) {
      expect(isDesignIntent(intent)).toBe(true);
    }

    expect(isDesignIntent('')).toBe(false);
    expect(isDesignIntent('unknown-design')).toBe(false);
    expect(isDesignIntent(null)).toBe(false);
  });

  it('builds canonical analysis workflow targets with encoded source path', () => {
    const target = buildAnalysisWorkflowTarget('/analysis/time-history', 'time-history');
    expect(target).toBe('/app?workflow=analysis&analysis=time-history&sourcePath=%2Fanalysis%2Ftime-history');
  });

  it('builds canonical design workflow targets with encoded source path', () => {
    const target = buildDesignWorkflowTarget('/design/advanced-structures', 'advanced-structures');
    expect(target).toBe('/app?workflow=design&design=advanced-structures&sourcePath=%2Fdesign%2Fadvanced-structures');
  });

  it('resolves known analysis workflow and intent', () => {
    const resolution = resolveWorkflowQuery('analysis', 'modal', null);
    expect(resolution).toEqual({
      workflow: 'analysis',
      analysisIntent: 'modal',
    });
  });

  it('returns warning for unknown analysis intent', () => {
    const resolution = resolveWorkflowQuery('analysis', 'not-real', null);
    expect(resolution).toEqual({
      workflow: 'analysis',
      analysisIntent: null,
      warning: 'Unknown analysis intent: not-real',
    });
  });

  it('returns warning for unknown design intent', () => {
    const resolution = resolveWorkflowQuery('design', null, 'not-real');
    expect(resolution).toEqual({
      workflow: 'design',
      designIntent: null,
      warning: 'Unknown design intent: not-real',
    });
  });

  it('returns warning for unknown workflow', () => {
    const resolution = resolveWorkflowQuery('unknown-workflow', null, null);
    expect(resolution).toEqual({
      workflow: null,
      warning: 'Unknown workflow: unknown-workflow',
    });
  });

  it('blocks analysis workflow when model data is missing', () => {
    const resolution = resolveWorkflowQuery('analysis', 'modal', null);
    const outcome = evaluateWorkflowGuard(resolution, {
      hasModelData: false,
      hasLoadData: true,
      hasCompletedAnalysis: false,
    });

    expect(outcome).toEqual({
      kind: 'warning',
      message: 'Create model geometry first (nodes and members).',
    });
  });

  it('blocks analysis workflow when load data is missing', () => {
    const resolution = resolveWorkflowQuery('analysis', 'modal', null);
    const outcome = evaluateWorkflowGuard(resolution, {
      hasModelData: true,
      hasLoadData: false,
      hasCompletedAnalysis: false,
    });

    expect(outcome).toEqual({
      kind: 'warning',
      message: 'Define loads first before advanced analysis.',
    });
  });

  it('resolves analysis workflow when model and loads are present', () => {
    const resolution = resolveWorkflowQuery('analysis', 'modal', null);
    const outcome = evaluateWorkflowGuard(resolution, {
      hasModelData: true,
      hasLoadData: true,
      hasCompletedAnalysis: false,
    });

    expect(outcome).toEqual({
      kind: 'analysis',
      analysisIntent: 'modal',
    });
  });

  it('blocks design workflow before analysis is completed', () => {
    const resolution = resolveWorkflowQuery('design', null, 'steel');
    const outcome = evaluateWorkflowGuard(resolution, {
      hasModelData: true,
      hasLoadData: true,
      hasCompletedAnalysis: false,
    });

    expect(outcome).toEqual({
      kind: 'warning',
      message: 'Run analysis first before design checks.',
    });
  });

  it('resolves design workflow when all design preconditions are satisfied', () => {
    const resolution = resolveWorkflowQuery('design', null, 'steel');
    const outcome = evaluateWorkflowGuard(resolution, {
      hasModelData: true,
      hasLoadData: true,
      hasCompletedAnalysis: true,
    });

    expect(outcome).toEqual({
      kind: 'design',
      designIntent: 'steel',
    });
  });
});
