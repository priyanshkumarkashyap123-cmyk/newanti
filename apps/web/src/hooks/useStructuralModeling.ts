/**
 * useStructuralModeling.ts — Custom hook for structural modeling state and interactions
 * 
 * Manages:
 * - Cursor mode transitions
 * - Topology export pipeline
 * - Node/member creation workflow
 * - Selection state
 */

import { useCallback, useRef, useState, useEffect } from 'react';
import { CursorMode, CanvasCursorStateMachine } from '../graphics/CanvasCursorStateMachine';
import type { StructuralTopology } from '../graphics/CanvasManager';
import type { Node, Member } from '../store/modelTypes';

export interface UseStructuralModelingReturn {
  cursorMode: CursorMode;
  setCursorMode: (mode: CursorMode) => void;
  selectedNodeIds: Set<string>;
  selectedMemberIds: Set<string>;
  handleNodeAdd: (node: Node) => void;
  handleMemberAdd: (member: Member) => void;
  handleSelection: (selectedIds: { nodeIds: string[]; memberIds: string[] }) => void;
  handleTopologyExport: (topologyJSON: string) => void;
  exportJSON: () => string | null;
  lastTopology: StructuralTopology | null;
}

export function useStructuralModeling(
  onTopologyExport?: (topology: StructuralTopology) => void
): UseStructuralModelingReturn {
  const stateMachineRef = useRef<CanvasCursorStateMachine>(
    new CanvasCursorStateMachine(CursorMode.SELECT)
  );
  const [currentMode, setCurrentMode] = useState<CursorMode>(CursorMode.SELECT);
  const [selectedNodeIds, setSelectedNodeIds] = useState<Set<string>>(new Set());
  const [selectedMemberIds, setSelectedMemberIds] = useState<Set<string>>(new Set());
  const [lastTopology, setLastTopology] = useState<StructuralTopology | null>(null);
  const topologyBufferRef = useRef<string>('');

  // Monitor state machine changes
  useEffect(() => {
    const unsubscribe = stateMachineRef.current.onStateChange((state) => {
      setCurrentMode(state.mode);
    });
    return unsubscribe;
  }, []);

  // Transition to new cursor mode
  const setCursorMode = useCallback((mode: CursorMode) => {
    stateMachineRef.current.transitionTo(mode);
  }, []);

  // Handle node addition
  const handleNodeAdd = useCallback((node: Node) => {
    console.log('Node added:', node.id);
    // State should be updated via zustand store
    // This is just a callback wrapper
  }, []);

  // Handle member addition
  const handleMemberAdd = useCallback((member: Member) => {
    console.log('Member added:', member.id);
    // State should be updated via zustand store
    // This is just a callback wrapper
  }, []);

  // Handle selection
  const handleSelection = useCallback(
    (selectedIds: { nodeIds: string[]; memberIds: string[] }) => {
      setSelectedNodeIds(new Set(selectedIds.nodeIds));
      setSelectedMemberIds(new Set(selectedIds.memberIds));
    },
    []
  );

  // Handle topology export from canvas
  const handleTopologyExport = useCallback(
    (topologyJSON: string) => {
      topologyBufferRef.current = topologyJSON;
      try {
        const topology = JSON.parse(topologyJSON) as StructuralTopology;
        setLastTopology(topology);
        onTopologyExport?.(topology);
      } catch (error) {
        console.error('Failed to parse topology JSON:', error);
      }
    },
    [onTopologyExport]
  );

  // Export current topology as JSON string
  const exportJSON = useCallback(() => {
    return topologyBufferRef.current || null;
  }, []);

  return {
    cursorMode: currentMode,
    setCursorMode,
    selectedNodeIds,
    selectedMemberIds,
    handleNodeAdd,
    handleMemberAdd,
    handleSelection,
    handleTopologyExport,
    exportJSON,
    lastTopology,
  };
}

export default useStructuralModeling;
