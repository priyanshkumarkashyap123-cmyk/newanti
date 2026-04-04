/**
 * CanvasCursorStateMachine.ts — State machine for modeling interactions
 * 
 * Implements finite state machine for cursor modes:
 * - MODE_SELECT: Pick nodes/members for inspection or deletion
 * - MODE_ADD_NODE: Click to place structural nodes
 * - MODE_ADD_BEAM: Click two nodes to create beam element
 * - MODE_ADD_COLUMN: Click two nodes to create column element
 * - MODE_ADD_BRACE: Click two nodes to create diagonal brace
 */

export enum CursorMode {
  SELECT = 'SELECT',
  ADD_NODE = 'ADD_NODE',
  ADD_BEAM = 'ADD_BEAM',
  ADD_COLUMN = 'ADD_COLUMN',
  ADD_BRACE = 'ADD_BRACE',
  PAN = 'PAN',
}

export interface ModeState {
  mode: CursorMode;
  selectedNodeId: string | null; // For two-click operations (ADD_BEAM, etc.)
  hoveredNodeId: string | null;
  hoveredMemberId: string | null;
}

export type ModeTransition = (currentMode: CursorMode) => CursorMode | null;

export type StateTransitions = Record<
  CursorMode,
  Record<string, CursorMode | null>
>;

/**
 * Simple but extensible state machine for modeling interactions
 */
export class CanvasCursorStateMachine {
  private state: ModeState;
  private transitions: StateTransitions;
  private onStateChangeCallbacks: Array<(state: ModeState) => void> = [];

  constructor(initialMode: CursorMode = CursorMode.SELECT) {
    this.state = {
      mode: initialMode,
      selectedNodeId: null,
      hoveredNodeId: null,
      hoveredMemberId: null,
    };

    // Define valid state transitions
    this.transitions = {
      [CursorMode.SELECT]: {
        ADD_NODE: CursorMode.ADD_NODE,
        ADD_BEAM: CursorMode.ADD_BEAM,
        ADD_COLUMN: CursorMode.ADD_COLUMN,
        ADD_BRACE: CursorMode.ADD_BRACE,
        PAN: CursorMode.PAN,
      },
      [CursorMode.ADD_NODE]: {
        SELECT: CursorMode.SELECT,
        CANCEL: CursorMode.SELECT,
      },
      [CursorMode.ADD_BEAM]: {
        SELECT: CursorMode.SELECT,
        CANCEL: CursorMode.SELECT,
      },
      [CursorMode.ADD_COLUMN]: {
        SELECT: CursorMode.SELECT,
        CANCEL: CursorMode.SELECT,
      },
      [CursorMode.ADD_BRACE]: {
        SELECT: CursorMode.SELECT,
        CANCEL: CursorMode.SELECT,
      },
      [CursorMode.PAN]: {
        SELECT: CursorMode.SELECT,
      },
    };
  }

  /**
   * Attempt to transition to a new mode
   * Returns true if successful, false if invalid transition
   */
  transitionTo(nextMode: CursorMode | null): boolean {
    if (nextMode === null) {
      return false;
    }

    const previousMode = this.state.mode;
    const validTransitions = this.transitions[this.state.mode];
    const allowedNextMode = Object.values(validTransitions).includes(nextMode);

    if (!allowedNextMode) {
      console.warn(
        `Invalid state transition: ${this.state.mode} -> ${nextMode}`
      );
      return false;
    }

    this.state.mode = nextMode;
    // Clear selection when changing modes (except for two-click operations)
    if (
      nextMode === CursorMode.SELECT &&
      ![CursorMode.ADD_BEAM, CursorMode.ADD_COLUMN, CursorMode.ADD_BRACE].includes(
        previousMode
      )
    ) {
      this.state.selectedNodeId = null;
    }

    this.notifyStateChange();
    return true;
  }

  /**
   * Set first node in two-click operation (ADD_BEAM, ADD_COLUMN, etc.)
   */
  setSelectedNode(nodeId: string): void {
    this.state.selectedNodeId = nodeId;
    this.notifyStateChange();
  }

  /**
   * Clear first node selection
   */
  clearSelectedNode(): void {
    this.state.selectedNodeId = null;
    this.notifyStateChange();
  }

  /**
   * Set hovered node (for preview/hint UI)
   */
  setHoveredNode(nodeId: string | null): void {
    this.state.hoveredNodeId = nodeId;
    this.notifyStateChange();
  }

  /**
   * Set hovered member
   */
  setHoveredMember(memberId: string | null): void {
    this.state.hoveredMemberId = memberId;
    this.notifyStateChange();
  }

  /**
   * Get current state (immutable)
   */
  getState(): Readonly<ModeState> {
    return { ...this.state };
  }

  /**
   * Get current mode
   */
  getMode(): CursorMode {
    return this.state.mode;
  }

  /**
   * Register callback to fire when state changes
   */
  onStateChange(callback: (state: ModeState) => void): () => void {
    this.onStateChangeCallbacks.push(callback);
    // Return unsubscribe function
    return () => {
      this.onStateChangeCallbacks = this.onStateChangeCallbacks.filter(
        (cb) => cb !== callback
      );
    };
  }

  /**
   * Notify all subscribers of state change
   */
  private notifyStateChange(): void {
    this.onStateChangeCallbacks.forEach((callback) => {
      callback({ ...this.state });
    });
  }

  /**
   * Reset to SELECT mode
   */
  reset(): void {
    this.state.mode = CursorMode.SELECT;
    this.state.selectedNodeId = null;
    this.state.hoveredNodeId = null;
    this.state.hoveredMemberId = null;
    this.notifyStateChange();
  }

  /**
   * Get cursor CSS class based on current mode (for UI feedback)
   */
  getCursorClass(): string {
    const cursorMap: { [key in CursorMode]: string } = {
      [CursorMode.SELECT]: 'cursor-pointer',
      [CursorMode.ADD_NODE]: 'cursor-crosshair',
      [CursorMode.ADD_BEAM]: 'cursor-crosshair',
      [CursorMode.ADD_COLUMN]: 'cursor-crosshair',
      [CursorMode.ADD_BRACE]: 'cursor-crosshair',
      [CursorMode.PAN]: 'cursor-grab',
    };
    return cursorMap[this.state.mode];
  }
}
