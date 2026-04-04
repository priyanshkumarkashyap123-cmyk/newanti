export const ANALYSIS_INTENTS = [
  'modal',
  'time-history',
  'seismic',
  'buckling',
  'cable',
  'pdelta',
  'nonlinear',
  'dynamic',
  'pushover',
  'plate-shell',
] as const;

export const DESIGN_INTENTS = [
  'steel',
  'connections',
  'reinforcement',
  'detailing',
  'concrete',
  'foundation',
  'geotechnical',
  'composite',
  'timber',
  'center',
  'design-hub',
  'advanced-structures',
] as const;

export type AnalysisIntent = (typeof ANALYSIS_INTENTS)[number];
export type DesignIntent = (typeof DESIGN_INTENTS)[number];

export type WorkflowQueryResolution =
  | {
      workflow: 'analysis';
      analysisIntent: AnalysisIntent | null;
      warning?: string;
    }
  | {
      workflow: 'design';
      designIntent: DesignIntent | null;
      warning?: string;
    }
  | {
      workflow: null;
      warning?: string;
    };

export interface WorkflowGuardState {
  hasModelData: boolean;
  hasLoadData: boolean;
  hasCompletedAnalysis: boolean;
}

export type WorkflowGuardOutcome =
  | {
      kind: 'analysis';
      analysisIntent: AnalysisIntent | null;
    }
  | {
      kind: 'design';
      designIntent: DesignIntent | null;
    }
  | {
      kind: 'warning';
      message: string;
    }
  | {
      kind: 'none';
    };

export function isAnalysisIntent(value: string | null): value is AnalysisIntent {
  return typeof value === 'string' && (ANALYSIS_INTENTS as readonly string[]).includes(value);
}

export function isDesignIntent(value: string | null): value is DesignIntent {
  return typeof value === 'string' && (DESIGN_INTENTS as readonly string[]).includes(value);
}

export function resolveWorkflowQuery(
  workflow: string | null,
  analysisIntent: string | null,
  designIntent: string | null,
): WorkflowQueryResolution {
  if (workflow === 'analysis') {
    if (analysisIntent && !isAnalysisIntent(analysisIntent)) {
      return {
        workflow,
        analysisIntent: null,
        warning: `Unknown analysis intent: ${analysisIntent}`,
      };
    }

    return {
      workflow,
      analysisIntent: isAnalysisIntent(analysisIntent) ? analysisIntent : null,
    };
  }

  if (workflow === 'design') {
    if (designIntent && !isDesignIntent(designIntent)) {
      return {
        workflow,
        designIntent: null,
        warning: `Unknown design intent: ${designIntent}`,
      };
    }

    return {
      workflow,
      designIntent: isDesignIntent(designIntent) ? designIntent : null,
    };
  }

  if (workflow) {
    return {
      workflow: null,
      warning: `Unknown workflow: ${workflow}`,
    };
  }

  return {
    workflow: null,
  };
}

export function evaluateWorkflowGuard(
  resolution: WorkflowQueryResolution,
  state: WorkflowGuardState,
): WorkflowGuardOutcome {
  if (resolution.warning) {
    return {
      kind: 'warning',
      message: resolution.warning,
    };
  }

  if (resolution.workflow === 'analysis') {
    if (!state.hasModelData) {
      return {
        kind: 'warning',
        message: 'Create model geometry first (nodes and members).',
      };
    }

    if (!state.hasLoadData) {
      return {
        kind: 'warning',
        message: 'Define loads first before advanced analysis.',
      };
    }

    return {
      kind: 'analysis',
      analysisIntent: resolution.analysisIntent,
    };
  }

  if (resolution.workflow === 'design') {
    if (!state.hasModelData) {
      return {
        kind: 'warning',
        message: 'Create model geometry first (nodes and members).',
      };
    }

    if (!state.hasLoadData) {
      return {
        kind: 'warning',
        message: 'Define loads first before design checks.',
      };
    }

    if (!state.hasCompletedAnalysis) {
      return {
        kind: 'warning',
        message: 'Run analysis first before design checks.',
      };
    }

    return {
      kind: 'design',
      designIntent: resolution.designIntent,
    };
  }

  return {
    kind: 'none',
  };
}

export function buildAnalysisWorkflowTarget(path: string, intent: AnalysisIntent): string {
  return `/app?workflow=analysis&analysis=${encodeURIComponent(intent)}&sourcePath=${encodeURIComponent(path)}`;
}

export function buildDesignWorkflowTarget(path: string, intent: DesignIntent): string {
  return `/app?workflow=design&design=${encodeURIComponent(intent)}&sourcePath=${encodeURIComponent(path)}`;
}
