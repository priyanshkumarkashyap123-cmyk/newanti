/**
 * State Machine Implementation
 * Industry-standard state management for complex workflows
 * 
 * Features:
 * - Finite state machine with typed states and events
 * - Transition guards and actions
 * - Entry/exit handlers
 * - History state support
 * - React integration hooks
 */

import { useCallback, useReducer, useMemo, useRef } from 'react';

// ============================================================================
// Types
// ============================================================================

type StateValue = string;
type EventType = string;

interface StateNode<TContext, TEvent extends { type: EventType }> {
  on?: {
    [K in TEvent['type']]?: Transition<TContext, TEvent> | StateValue;
  };
  entry?: Action<TContext, TEvent>[];
  exit?: Action<TContext, TEvent>[];
  always?: Transition<TContext, TEvent>[];
}

interface Transition<TContext, TEvent> {
  target: StateValue;
  guard?: (context: TContext, event: TEvent) => boolean;
  actions?: Action<TContext, TEvent>[];
}

type Action<TContext, TEvent> = 
  | ((context: TContext, event: TEvent) => Partial<TContext> | void)
  | { type: string; exec?: (context: TContext, event: TEvent) => void };

interface MachineConfig<
  TContext,
  TState extends StateValue,
  TEvent extends { type: EventType }
> {
  id: string;
  initial: TState;
  context: TContext;
  states: {
    [K in TState]: StateNode<TContext, TEvent>;
  };
}

interface MachineState<TContext, TState extends StateValue> {
  value: TState;
  context: TContext;
  history: TState[];
}

// ============================================================================
// State Machine Factory
// ============================================================================

export function createMachine<
  TContext,
  TState extends StateValue,
  TEvent extends { type: EventType }
>(config: MachineConfig<TContext, TState, TEvent>) {
  type State = MachineState<TContext, TState>;

  const initialState: State = {
    value: config.initial,
    context: config.context,
    history: [],
  };

  function executeActions(
    actions: Action<TContext, TEvent>[] | undefined,
    context: TContext,
    event: TEvent
  ): TContext {
    if (!actions) return context;

    return actions.reduce((ctx, action) => {
      if (typeof action === 'function') {
        const result = action(ctx, event);
        return result ? { ...ctx, ...result } : ctx;
      }
      if (action.exec) {
        action.exec(ctx, event);
      }
      return ctx;
    }, context);
  }

  function resolveTransition(
    transition: Transition<TContext, TEvent> | StateValue | undefined,
    context: TContext,
    event: TEvent
  ): { target: TState; actions: Action<TContext, TEvent>[] } | null {
    if (!transition) return null;

    if (typeof transition === 'string') {
      return { target: transition as TState, actions: [] };
    }

    // Check guard
    if (transition.guard && !transition.guard(context, event)) {
      return null;
    }

    return {
      target: transition.target as TState,
      actions: transition.actions ?? [],
    };
  }

  function transition(state: State, event: TEvent): State {
    const stateConfig = config.states[state.value];
    if (!stateConfig) return state;

    // Check event-based transitions
    const eventTransition = stateConfig.on?.[event.type as TEvent['type']];
    const resolved = resolveTransition(eventTransition, state.context, event);

    if (!resolved) {
      // Check always transitions
      const alwaysTransition = stateConfig.always?.find(
        (t) => !t.guard || t.guard(state.context, event)
      );
      if (!alwaysTransition) return state;
      
      const alwaysResolved = resolveTransition(alwaysTransition, state.context, event);
      if (!alwaysResolved) return state;
      
      return performTransition(state, alwaysResolved, event);
    }

    return performTransition(state, resolved, event);
  }

  function performTransition(
    state: State,
    resolved: { target: TState; actions: Action<TContext, TEvent>[] },
    event: TEvent
  ): State {
    const currentStateConfig = config.states[state.value];
    const nextStateConfig = config.states[resolved.target];

    // Execute exit actions
    let newContext = executeActions(currentStateConfig?.exit, state.context, event);

    // Execute transition actions
    newContext = executeActions(resolved.actions, newContext, event);

    // Execute entry actions
    newContext = executeActions(nextStateConfig?.entry, newContext, event);

    return {
      value: resolved.target,
      context: newContext,
      history: [...state.history, state.value].slice(-10), // Keep last 10 states
    };
  }

  function matches(state: State, value: TState): boolean {
    return state.value === value;
  }

  function can(state: State, eventType: TEvent['type']): boolean {
    const stateConfig = config.states[state.value];
    return stateConfig?.on?.[eventType] !== undefined;
  }

  return {
    id: config.id,
    initialState,
    transition,
    matches,
    can,
    config,
  };
}

// ============================================================================
// React Hook
// ============================================================================

export function useMachine<
  TContext,
  TState extends StateValue,
  TEvent extends { type: EventType }
>(machine: ReturnType<typeof createMachine<TContext, TState, TEvent>>) {
  type State = MachineState<TContext, TState>;

  const reducer = useCallback(
    (state: State, event: TEvent): State => {
      return machine.transition(state, event);
    },
    [machine]
  );

  const [state, dispatch] = useReducer(reducer, machine.initialState);

  const send = useCallback(
    (event: TEvent) => {
      dispatch(event);
    },
    []
  );

  const matches = useCallback(
    (value: TState) => machine.matches(state, value),
    [machine, state]
  );

  const can = useCallback(
    (eventType: TEvent['type']) => machine.can(state, eventType),
    [machine, state]
  );

  return {
    state,
    send,
    matches,
    can,
    context: state.context,
    value: state.value,
    history: state.history,
  };
}

// ============================================================================
// Structural Engineering Workflow Example
// ============================================================================

/**
 * Example: Analysis Workflow State Machine
 * 
 * States:
 * - idle: Initial state, waiting for project
 * - modeling: Building the structural model
 * - validating: Validating model for analysis
 * - analyzing: Running structural analysis
 * - reviewing: Reviewing results
 * - reporting: Generating reports
 * - error: Error state
 */

interface AnalysisContext {
  projectId: string | null;
  modelValid: boolean;
  analysisResults: unknown | null;
  errors: string[];
  progress: number;
}

type AnalysisState = 
  | 'idle'
  | 'modeling'
  | 'validating'
  | 'analyzing'
  | 'reviewing'
  | 'reporting'
  | 'error';

type AnalysisEvent =
  | { type: 'START_PROJECT'; projectId: string }
  | { type: 'SAVE_MODEL' }
  | { type: 'VALIDATE' }
  | { type: 'VALIDATION_SUCCESS' }
  | { type: 'VALIDATION_FAILURE'; errors: string[] }
  | { type: 'START_ANALYSIS' }
  | { type: 'ANALYSIS_PROGRESS'; progress: number }
  | { type: 'ANALYSIS_COMPLETE'; results: unknown }
  | { type: 'ANALYSIS_ERROR'; error: string }
  | { type: 'GENERATE_REPORT' }
  | { type: 'REPORT_COMPLETE' }
  | { type: 'RESET' }
  | { type: 'RETRY' };

export const analysisMachine = createMachine<AnalysisContext, AnalysisState, AnalysisEvent>({
  id: 'analysis-workflow',
  initial: 'idle',
  context: {
    projectId: null,
    modelValid: false,
    analysisResults: null,
    errors: [],
    progress: 0,
  },
  states: {
    idle: {
      on: {
        START_PROJECT: {
          target: 'modeling',
          actions: [(_ctx, event) => ({ projectId: (event as { type: 'START_PROJECT'; projectId: string }).projectId })],
        },
      },
    },
    modeling: {
      entry: [() => ({ modelValid: false, errors: [] })],
      on: {
        SAVE_MODEL: 'validating',
        VALIDATE: 'validating',
      },
    },
    validating: {
      on: {
        VALIDATION_SUCCESS: {
          target: 'modeling',
          actions: [() => ({ modelValid: true })],
        },
        VALIDATION_FAILURE: {
          target: 'modeling',
          actions: [(_ctx, event) => ({ modelValid: false, errors: (event as { type: 'VALIDATION_FAILURE'; errors: string[] }).errors })],
        },
        START_ANALYSIS: {
          target: 'analyzing',
          guard: (ctx) => ctx.modelValid,
        },
      },
    },
    analyzing: {
      entry: [() => ({ progress: 0 })],
      on: {
        ANALYSIS_PROGRESS: {
          target: 'analyzing',
          actions: [(_ctx, event) => ({ progress: (event as { type: 'ANALYSIS_PROGRESS'; progress: number }).progress })],
        },
        ANALYSIS_COMPLETE: {
          target: 'reviewing',
          actions: [(_ctx, event) => ({ analysisResults: (event as { type: 'ANALYSIS_COMPLETE'; results: unknown }).results, progress: 100 })],
        },
        ANALYSIS_ERROR: {
          target: 'error',
          actions: [(_ctx, event) => ({ errors: [(event as { type: 'ANALYSIS_ERROR'; error: string }).error] })],
        },
      },
    },
    reviewing: {
      on: {
        GENERATE_REPORT: 'reporting',
        RESET: 'modeling',
      },
    },
    reporting: {
      on: {
        REPORT_COMPLETE: 'reviewing',
      },
    },
    error: {
      on: {
        RETRY: 'modeling',
        RESET: 'idle',
      },
      exit: [() => ({ errors: [] })],
    },
  },
});

// ============================================================================
// Hook for Analysis Workflow
// ============================================================================

export function useAnalysisWorkflow() {
  const machine = useMachine(analysisMachine);

  const actions = useMemo(() => ({
    startProject: (projectId: string) => machine.send({ type: 'START_PROJECT', projectId }),
    saveModel: () => machine.send({ type: 'SAVE_MODEL' }),
    validate: () => machine.send({ type: 'VALIDATE' }),
    validationSuccess: () => machine.send({ type: 'VALIDATION_SUCCESS' }),
    validationFailure: (errors: string[]) => machine.send({ type: 'VALIDATION_FAILURE', errors }),
    startAnalysis: () => machine.send({ type: 'START_ANALYSIS' }),
    updateProgress: (progress: number) => machine.send({ type: 'ANALYSIS_PROGRESS', progress }),
    completeAnalysis: (results: unknown) => machine.send({ type: 'ANALYSIS_COMPLETE', results }),
    analysisError: (error: string) => machine.send({ type: 'ANALYSIS_ERROR', error }),
    generateReport: () => machine.send({ type: 'GENERATE_REPORT' }),
    completeReport: () => machine.send({ type: 'REPORT_COMPLETE' }),
    reset: () => machine.send({ type: 'RESET' }),
    retry: () => machine.send({ type: 'RETRY' }),
  }), [machine]);

  return {
    ...machine,
    ...actions,
    isIdle: machine.matches('idle'),
    isModeling: machine.matches('modeling'),
    isValidating: machine.matches('validating'),
    isAnalyzing: machine.matches('analyzing'),
    isReviewing: machine.matches('reviewing'),
    isReporting: machine.matches('reporting'),
    isError: machine.matches('error'),
    canStartAnalysis: machine.can('START_ANALYSIS') && machine.context.modelValid,
  };
}
