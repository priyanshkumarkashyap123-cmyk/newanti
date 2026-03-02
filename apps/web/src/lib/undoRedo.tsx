/**
 * Undo/Redo System
 * Industry-standard command pattern implementation for structural engineering
 * 
 * Features:
 * - Command pattern with undo/redo
 * - Batching for grouped operations
 * - History persistence
 * - Memory-efficient snapshots
 * - React integration
 */

import { useCallback, useRef, useState, useMemo, useEffect } from 'react';

// ============================================================================
// Types
// ============================================================================

interface Command<TState> {
  id: string;
  description: string;
  timestamp: number;
  execute: () => TState;
  undo: () => TState;
}

interface CommandBatch<TState> {
  id: string;
  description: string;
  timestamp: number;
  commands: Command<TState>[];
}

interface HistoryEntry<TState> {
  id: string;
  description: string;
  timestamp: number;
  snapshot?: TState;
  command?: Command<TState>;
  batch?: CommandBatch<TState>;
}

interface UndoRedoOptions {
  maxHistorySize?: number;
  debounceMs?: number;
  persistKey?: string;
}

// ============================================================================
// History Manager Class
// ============================================================================

export class HistoryManager<TState> {
  private history: HistoryEntry<TState>[] = [];
  private currentIndex = -1;
  private maxSize: number;
  private persistKey?: string;

  constructor(options: UndoRedoOptions = {}) {
    this.maxSize = options.maxHistorySize ?? 100;
    this.persistKey = options.persistKey;

    if (this.persistKey) {
      this.loadFromStorage();
    }
  }

  /**
   * Execute a command and add to history
   */
  execute(command: Command<TState>): TState {
    // Execute the command
    const newState = command.execute();

    // Remove any redo history
    this.history = this.history.slice(0, this.currentIndex + 1);

    // Add to history
    this.history.push({
      id: command.id,
      description: command.description,
      timestamp: command.timestamp,
      command,
    });

    // Enforce max size
    if (this.history.length > this.maxSize) {
      this.history.shift();
    } else {
      this.currentIndex++;
    }

    this.persistToStorage();
    return newState;
  }

  /**
   * Execute a batch of commands as a single undo unit
   */
  executeBatch(batch: CommandBatch<TState>): TState {
    let state: TState | undefined;

    // Execute all commands in the batch
    for (const command of batch.commands) {
      state = command.execute();
    }

    // Remove any redo history
    this.history = this.history.slice(0, this.currentIndex + 1);

    // Add batch to history as single entry
    this.history.push({
      id: batch.id,
      description: batch.description,
      timestamp: batch.timestamp,
      batch,
    });

    // Enforce max size
    if (this.history.length > this.maxSize) {
      this.history.shift();
    } else {
      this.currentIndex++;
    }

    this.persistToStorage();
    return state!;
  }

  /**
   * Undo the last command
   */
  undo(): TState | undefined {
    if (!this.canUndo()) return undefined;

    const entry = this.history[this.currentIndex];
    let state: TState | undefined;

    if (entry.command) {
      state = entry.command.undo();
    } else if (entry.batch) {
      // Undo batch in reverse order
      for (let i = entry.batch.commands.length - 1; i >= 0; i--) {
        state = entry.batch.commands[i].undo();
      }
    }

    this.currentIndex--;
    this.persistToStorage();
    return state;
  }

  /**
   * Redo the next command
   */
  redo(): TState | undefined {
    if (!this.canRedo()) return undefined;

    this.currentIndex++;
    const entry = this.history[this.currentIndex];
    let state: TState | undefined;

    if (entry.command) {
      state = entry.command.execute();
    } else if (entry.batch) {
      for (const command of entry.batch.commands) {
        state = command.execute();
      }
    }

    this.persistToStorage();
    return state;
  }

  /**
   * Check if undo is available
   */
  canUndo(): boolean {
    return this.currentIndex >= 0;
  }

  /**
   * Check if redo is available
   */
  canRedo(): boolean {
    return this.currentIndex < this.history.length - 1;
  }

  /**
   * Get the description of the next undo action
   */
  getUndoDescription(): string | undefined {
    if (!this.canUndo()) return undefined;
    return this.history[this.currentIndex].description;
  }

  /**
   * Get the description of the next redo action
   */
  getRedoDescription(): string | undefined {
    if (!this.canRedo()) return undefined;
    return this.history[this.currentIndex + 1].description;
  }

  /**
   * Get the full history
   */
  getHistory(): HistoryEntry<TState>[] {
    return [...this.history];
  }

  /**
   * Get current position in history
   */
  getCurrentIndex(): number {
    return this.currentIndex;
  }

  /**
   * Clear all history
   */
  clear(): void {
    this.history = [];
    this.currentIndex = -1;
    this.persistToStorage();
  }

  /**
   * Jump to a specific point in history
   */
  jumpTo(index: number): TState | undefined {
    if (index < -1 || index >= this.history.length) return undefined;

    let state: TState | undefined;

    // Need to undo or redo to get to the target
    while (this.currentIndex > index) {
      state = this.undo();
    }
    while (this.currentIndex < index) {
      state = this.redo();
    }

    return state;
  }

  private persistToStorage(): void {
    if (!this.persistKey) return;

    try {
      const data = {
        currentIndex: this.currentIndex,
        // Only persist descriptions and timestamps, not the actual commands
        history: this.history.map((entry) => ({
          id: entry.id,
          description: entry.description,
          timestamp: entry.timestamp,
        })),
      };
      localStorage.setItem(this.persistKey, JSON.stringify(data));
    } catch {
      // Storage might be full
    }
  }

  private loadFromStorage(): void {
    if (!this.persistKey) return;

    try {
      const data = localStorage.getItem(this.persistKey);
      if (data) {
        // Note: Commands are not persisted, only metadata
        console.log('[History] Found persisted history metadata');
      }
    } catch {
      // Invalid data
    }
  }
}

// ============================================================================
// React Hook
// ============================================================================

export function useUndoRedo<TState>(
  initialState: TState,
  options: UndoRedoOptions = {}
) {
  const [state, setState] = useState(initialState);
  const historyRef = useRef(new HistoryManager<TState>(options));
  const [version, setVersion] = useState(0);
  const forceUpdate = useCallback(() => setVersion(v => v + 1), []);

  const generateId = useCallback(() => {
    return `cmd_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }, []);

  /**
   * Execute a state change with undo support
   */
  const execute = useCallback((
    description: string,
    forward: (current: TState) => TState,
    backward: (current: TState) => TState
  ) => {
    const prevState = state;

    const command: Command<TState> = {
      id: generateId(),
      description,
      timestamp: Date.now(),
      execute: () => forward(prevState),
      undo: () => backward(forward(prevState)),
    };

    const newState = historyRef.current.execute(command);
    setState(newState);
    forceUpdate();
  }, [state, generateId]);

  /**
   * Execute multiple changes as a single undo unit
   */
  const executeBatch = useCallback((
    description: string,
    operations: Array<{
      forward: (current: TState) => TState;
      backward: (current: TState) => TState;
    }>
  ) => {
    let currentState = state;

    const commands: Command<TState>[] = operations.map((op, index) => {
      const prevState = currentState;
      const nextState = op.forward(prevState);
      currentState = nextState;

      return {
        id: generateId(),
        description: `${description} (${index + 1})`,
        timestamp: Date.now(),
        execute: () => op.forward(prevState),
        undo: () => op.backward(nextState),
      };
    });

    const batch: CommandBatch<TState> = {
      id: generateId(),
      description,
      timestamp: Date.now(),
      commands,
    };

    const newState = historyRef.current.executeBatch(batch);
    setState(newState);
    forceUpdate();
  }, [state, generateId]);

  /**
   * Undo the last action
   */
  const undo = useCallback(() => {
    const newState = historyRef.current.undo();
    if (newState !== undefined) {
      setState(newState);
      forceUpdate();
    }
  }, []);

  /**
   * Redo the next action
   */
  const redo = useCallback(() => {
    const newState = historyRef.current.redo();
    if (newState !== undefined) {
      setState(newState);
      forceUpdate();
    }
  }, []);

  /**
   * Jump to a specific point in history
   */
  const jumpTo = useCallback((index: number) => {
    const newState = historyRef.current.jumpTo(index);
    if (newState !== undefined) {
      setState(newState);
      forceUpdate();
    }
  }, []);

  /**
   * Clear all history
   */
  const clear = useCallback(() => {
    historyRef.current.clear();
    forceUpdate();
  }, []);

  /**
   * Reset to initial state
   */
  const reset = useCallback(() => {
    historyRef.current.clear();
    setState(initialState);
    forceUpdate();
  }, [initialState]);

  // Use state to track history values, updated by forceUpdate trigger
  const [historyState, setHistoryState] = useState(() => ({
    canUndo: false,
    canRedo: false,
    undoDescription: undefined as string | undefined,
    redoDescription: undefined as string | undefined,
    history: [] as { id: string; description: string; timestamp: number }[],
    currentIndex: -1,
  }));

  // Update history state when version changes (triggered by forceUpdate)
  useEffect(() => {
    setHistoryState({
      canUndo: historyRef.current.canUndo(),
      canRedo: historyRef.current.canRedo(),
      undoDescription: historyRef.current.getUndoDescription(),
      redoDescription: historyRef.current.getRedoDescription(),
      history: historyRef.current.getHistory(),
      currentIndex: historyRef.current.getCurrentIndex(),
    });
  }, [version]);

  return {
    state,
    execute,
    executeBatch,
    undo,
    redo,
    jumpTo,
    clear,
    reset,
    canUndo: historyState.canUndo,
    canRedo: historyState.canRedo,
    undoDescription: historyState.undoDescription,
    redoDescription: historyState.redoDescription,
    history: historyState.history,
    currentIndex: historyState.currentIndex,
  };
}

// ============================================================================
// Structural Engineering Commands
// ============================================================================

/**
 * Predefined commands for structural engineering operations
 */

export interface StructuralModel {
  nodes: Map<string, { id: string; x: number; y: number; z: number }>;
  members: Map<string, { id: string; startNode: string; endNode: string; section: string }>;
  loads: Map<string, { id: string; type: string; magnitude: number; nodeId?: string; memberId?: string }>;
  supports: Map<string, { id: string; nodeId: string; type: string }>;
}

export function createStructuralCommands(
  model: StructuralModel,
  setModel: (model: StructuralModel) => void
) {
  return {
    addNode: (node: StructuralModel['nodes'] extends Map<string, infer T> ? T : never) => ({
      description: `Add node ${node.id}`,
      forward: () => {
        const newModel = { ...model, nodes: new Map(model.nodes) };
        newModel.nodes.set(node.id, node);
        setModel(newModel);
        return newModel;
      },
      backward: () => {
        const newModel = { ...model, nodes: new Map(model.nodes) };
        newModel.nodes.delete(node.id);
        setModel(newModel);
        return newModel;
      },
    }),

    removeNode: (nodeId: string) => {
      const node = model.nodes.get(nodeId);
      return {
        description: `Remove node ${nodeId}`,
        forward: () => {
          const newModel = { ...model, nodes: new Map(model.nodes) };
          newModel.nodes.delete(nodeId);
          setModel(newModel);
          return newModel;
        },
        backward: () => {
          if (!node) return model;
          const newModel = { ...model, nodes: new Map(model.nodes) };
          newModel.nodes.set(nodeId, node);
          setModel(newModel);
          return newModel;
        },
      };
    },

    moveNode: (nodeId: string, newX: number, newY: number, newZ: number) => {
      const node = model.nodes.get(nodeId);
      const oldX = node?.x ?? 0;
      const oldY = node?.y ?? 0;
      const oldZ = node?.z ?? 0;
      return {
        description: `Move node ${nodeId}`,
        forward: () => {
          if (!node) return model;
          const newModel = { ...model, nodes: new Map(model.nodes) };
          newModel.nodes.set(nodeId, { ...node, x: newX, y: newY, z: newZ });
          setModel(newModel);
          return newModel;
        },
        backward: () => {
          if (!node) return model;
          const newModel = { ...model, nodes: new Map(model.nodes) };
          newModel.nodes.set(nodeId, { ...node, x: oldX, y: oldY, z: oldZ });
          setModel(newModel);
          return newModel;
        },
      };
    },

    addMember: (member: StructuralModel['members'] extends Map<string, infer T> ? T : never) => ({
      description: `Add member ${member.id}`,
      forward: () => {
        const newModel = { ...model, members: new Map(model.members) };
        newModel.members.set(member.id, member);
        setModel(newModel);
        return newModel;
      },
      backward: () => {
        const newModel = { ...model, members: new Map(model.members) };
        newModel.members.delete(member.id);
        setModel(newModel);
        return newModel;
      },
    }),

    removeMember: (memberId: string) => {
      const member = model.members.get(memberId);
      return {
        description: `Remove member ${memberId}`,
        forward: () => {
          const newModel = { ...model, members: new Map(model.members) };
          newModel.members.delete(memberId);
          setModel(newModel);
          return newModel;
        },
        backward: () => {
          if (!member) return model;
          const newModel = { ...model, members: new Map(model.members) };
          newModel.members.set(memberId, member);
          setModel(newModel);
          return newModel;
        },
      };
    },
  };
}

// ============================================================================
// History Panel Component
// ============================================================================

interface HistoryPanelProps<TState> {
  history: HistoryEntry<TState>[];
  currentIndex: number;
  onJumpTo: (index: number) => void;
  className?: string;
}

export function HistoryPanel<TState>({
  history,
  currentIndex,
  onJumpTo,
  className = '',
}: HistoryPanelProps<TState>): JSX.Element {
  return (
    <div className={`bg-white dark:bg-slate-800 rounded-lg shadow-lg p-4 ${className}`}>
      <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-3">
        History
      </h3>

      {history.length === 0 ? (
        <p className="text-sm text-slate-500 dark:text-slate-400">No history yet</p>
      ) : (
        <ul className="space-y-1 max-h-64 overflow-y-auto">
          {history.map((entry, index) => (
            <li key={entry.id}>
              <button type="button"
                onClick={() => onJumpTo(index)}
                className={`w-full text-left px-3 py-2 rounded text-sm transition-colors ${index === currentIndex
                    ? 'bg-blue-100 dark:bg-blue-900 text-blue-900 dark:text-blue-100'
                    : index > currentIndex
                      ? 'text-slate-500 dark:text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700'
                      : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'
                  }`}
              >
                <span className="font-medium">{entry.description}</span>
                <span className="text-xs text-slate-500 dark:text-slate-400 ml-2">
                  {new Date(entry.timestamp).toLocaleTimeString()}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ============================================================================
// Undo/Redo Toolbar Component
// ============================================================================

interface UndoRedoToolbarProps {
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  undoDescription?: string;
  redoDescription?: string;
  className?: string;
}

export function UndoRedoToolbar({
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  undoDescription,
  redoDescription,
  className = '',
}: UndoRedoToolbarProps): JSX.Element {
  return (
    <div className={`flex items-center gap-1 ${className}`}>
      <button type="button"
        onClick={onUndo}
        disabled={!canUndo}
        title={undoDescription ? `Undo: ${undoDescription}` : 'Undo'}
        className={`p-2 rounded transition-colors ${canUndo
            ? 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'
            : 'text-slate-600 dark:text-slate-600 cursor-not-allowed'
          }`}
        aria-label="Undo"
      >
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6"
          />
        </svg>
      </button>

      <button type="button"
        onClick={onRedo}
        disabled={!canRedo}
        title={redoDescription ? `Redo: ${redoDescription}` : 'Redo'}
        className={`p-2 rounded transition-colors ${canRedo
            ? 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'
            : 'text-slate-600 dark:text-slate-600 cursor-not-allowed'
          }`}
        aria-label="Redo"
      >
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M21 10h-10a8 8 0 00-8 8v2M21 10l-6 6m6-6l-6-6"
          />
        </svg>
      </button>
    </div>
  );
}
