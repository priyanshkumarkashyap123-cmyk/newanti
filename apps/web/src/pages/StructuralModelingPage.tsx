/**
 * StructuralModelingPage.tsx — Integration example showing how to wire up the canvas
 * with the Zustand store for a complete structural modeling workflow
 * 
 * This demonstrates:
 * 1. Using the canvas with store state
 * 2. Wiring up callbacks to persist to store
 * 3. Exporting topology for backend analysis
 */

import React, { useCallback, useEffect } from 'react';
import { useShallow } from 'zustand/react';
import StructuralModelingCanvas from './StructuralModelingCanvas';
import useStructuralModeling from '../hooks/useStructuralModeling';
import { CursorMode } from '../graphics/CanvasCursorStateMachine';
import type { Node, Member } from '../store/modelTypes';

// Assuming you have a store hook like this:
// import { useModelStore } from '../store/model';

interface StructuralModelingPageProps {
  // Inject store if not using context
  modelStore?: any;
}

export const StructuralModelingPage: React.FC<StructuralModelingPageProps> = ({
  modelStore,
}) => {
  // Example: Assuming a Zustand store is available
  // For now, we'll use local state to demonstrate the flow
  const [nodes, setNodes] = React.useState<Map<string, Node>>(new Map());
  const [members, setMembers] = React.useState<Map<string, Member>>(new Map());
  const [cursorMode, setCursorMode] = React.useState<CursorMode>(CursorMode.SELECT);

  const {
    cursorMode: hookMode,
    setCursorMode: setHookMode,
    selectedNodeIds,
    selectedMemberIds,
    handleTopologyExport,
    lastTopology,
  } = useStructuralModeling((topology) => {
    console.log('Topology exported:', topology);
    // Could send to backend here via API
    // fetchAnalysis(topology)
  });

  // Sync external mode changes
  useEffect(() => {
    if (cursorMode !== hookMode) {
      setHookMode(cursorMode);
    }
  }, [cursorMode, hookMode, setHookMode]);

  // Handle node creation
  const handleNodeAdd = useCallback(
    (newNode: Node) => {
      setNodes((prevNodes) => {
        const updated = new Map(prevNodes);
        updated.set(newNode.id, newNode);
        return updated;
      });
    },
    []
  );

  // Handle member creation
  const handleMemberAdd = useCallback(
    (newMember: Member) => {
      setMembers((prevMembers) => {
        const updated = new Map(prevMembers);
        updated.set(newMember.id, newMember);
        return updated;
      });
    },
    []
  );

  return (
    <div style={{ display: 'flex', height: '100vh', flexDirection: 'column' }}>
      {/* Toolbar */}
      <div style={{
        padding: '1rem',
        backgroundColor: '#2a2a3e',
        color: '#fff',
        borderBottom: '1px solid #444',
        display: 'flex',
        gap: '1rem',
        alignItems: 'center',
      }}>
        <h2 style={{ margin: 0 }}>Structural Modeling</h2>

        <div style={{ display: 'flex', gap: '0.5rem', marginLeft: 'auto' }}>
          <button
            onClick={() => setHookMode(CursorMode.SELECT)}
            style={{
              padding: '0.5rem 1rem',
              backgroundColor: hookMode === CursorMode.SELECT ? '#4488ff' : '#444',
              color: '#fff',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
            }}
          >
            Select
          </button>
          <button
            onClick={() => setHookMode(CursorMode.ADD_NODE)}
            style={{
              padding: '0.5rem 1rem',
              backgroundColor: hookMode === CursorMode.ADD_NODE ? '#4488ff' : '#444',
              color: '#fff',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
            }}
          >
            Add Node
          </button>
          <button
            onClick={() => setHookMode(CursorMode.ADD_BEAM)}
            style={{
              padding: '0.5rem 1rem',
              backgroundColor: hookMode === CursorMode.ADD_BEAM ? '#4488ff' : '#444',
              color: '#fff',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
            }}
          >
            Add Beam
          </button>
          <button
            onClick={() => setHookMode(CursorMode.ADD_COLUMN)}
            style={{
              padding: '0.5rem 1rem',
              backgroundColor: hookMode === CursorMode.ADD_COLUMN ? '#4488ff' : '#444',
              color: '#fff',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
            }}
          >
            Add Column
          </button>
          <button
            onClick={() => setHookMode(CursorMode.ADD_BRACE)}
            style={{
              padding: '0.5rem 1rem',
              backgroundColor: hookMode === CursorMode.ADD_BRACE ? '#4488ff' : '#444',
              color: '#fff',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
            }}
          >
            Add Brace
          </button>
        </div>
      </div>

      {/* Canvas */}
      <div style={{ flex: 1, position: 'relative' }}>
        <StructuralModelingCanvas
          nodes={nodes}
          members={members}
          onNodeAdd={handleNodeAdd}
          onMemberAdd={handleMemberAdd}
          onSelection={(selectedIds) => {
            console.log('Selected:', selectedIds);
          }}
          cursorMode={hookMode}
          onModeChange={(mode) => {
            console.log('Mode changed to:', mode);
          }}
          onTopologyExport={handleTopologyExport}
        />
      </div>

      {/* Status Bar */}
      <div style={{
        padding: '1rem',
        backgroundColor: '#2a2a3e',
        color: '#ccc',
        borderTop: '1px solid #444',
        fontSize: '0.9rem',
        display: 'flex',
        gap: '2rem',
        justifyContent: 'space-between',
      }}>
        <div>
          <strong>Mode:</strong> {hookMode}
        </div>
        <div>
          <strong>Nodes:</strong> {nodes.size}
        </div>
        <div>
          <strong>Members:</strong> {members.size}
        </div>
        <div>
          <strong>Selected:</strong> {selectedNodeIds.size} nodes, {selectedMemberIds.size} members
        </div>
        {lastTopology && (
          <button
            onClick={() => {
              const json = JSON.stringify(lastTopology, null, 2);
              console.log('Current Topology JSON:');
              console.log(json);
              // Could download file or send to backend
            }}
            style={{
              padding: '0.25rem 0.75rem',
              backgroundColor: '#44ff44',
              color: '#000',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontWeight: 'bold',
              marginLeft: 'auto',
            }}
          >
            Export Topology
          </button>
        )}
      </div>
    </div>
  );
};

export default StructuralModelingPage;
