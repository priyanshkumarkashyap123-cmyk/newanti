/**
 * StructuralModelingCanvas.tsx — High-performance React Three Fiber canvas
 * 
 * Props:
 * - onTopologyExport: Callback when topology JSON is generated
 * - nodes: Map<string, Node> from store
 * - members: Map<string, Member> from store
 * - onNodeAdd: Callback to add node to model store
 * - onMemberAdd: Callback to add member to model store
 * - onSelection: Callback when geometry is selected (node/member IDs)
 */

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, Line, Points } from '@react-three/drei';
import * as THREE from 'three';
import type { Node, Member } from '../store/modelTypes';
import { CanvasManager } from './CanvasManager';
import { CanvasCursorStateMachine, CursorMode, type ModeState } from './CanvasCursorStateMachine';

interface StructuralModelingCanvasProps {
  nodes: Map<string, Node>;
  members: Map<string, Member>;
  onNodeAdd: (node: Node) => void;
  onMemberAdd: (member: Member) => void;
  onSelection: (selectedIds: { nodeIds: string[]; memberIds: string[] }) => void;
  onModeChange?: (mode: CursorMode) => void;
  onTopologyExport?: (topology: string) => void;
  cursorMode?: CursorMode;
  onCursorModeRequest?: (mode: CursorMode) => void;
}

/**
 * Inner component that has access to Three.js context
 */
const ModelingCanvasInner: React.FC<StructuralModelingCanvasProps> = ({
  nodes,
  members,
  onNodeAdd,
  onMemberAdd,
  onSelection,
  onModeChange,
  onTopologyExport,
  cursorMode,
  onCursorModeRequest,
}) => {
  const { camera, gl } = useThree();
  const canvasManagerRef = useRef<CanvasManager | null>(null);
  const stateMachineRef = useRef<CanvasCursorStateMachine>(
    new CanvasCursorStateMachine(cursorMode || CursorMode.SELECT)
  );
  const nodesPointsRef = useRef<THREE.Points>(null);
  const membersLineRef = useRef<THREE.LineSegments>(null);
  const previewLineRef = useRef<THREE.Line>(null);
  const [selectedNodeIds, setSelectedNodeIds] = useState<Set<string>>(new Set());
  const [selectedMemberIds, setSelectedMemberIds] = useState<Set<string>>(new Set());
  const frameCountRef = useRef(0);
  const lastExportRef = useRef<string>('');

  // Initialize CanvasManager on mount
  useEffect(() => {
    const canvas = gl.domElement;
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;

    const manager = new CanvasManager(canvas, width, height);
    canvasManagerRef.current = manager;

    // Initialize nodes in spatial grid
    nodes.forEach((node) => {
      manager.addNodeToGrid(node);
    });

    return () => {
      manager.dispose();
    };
  }, [gl]);

  // Update state machine when external mode changes
  useEffect(() => {
    if (cursorMode && stateMachineRef.current.getMode() !== cursorMode) {
      stateMachineRef.current.transitionTo(cursorMode);
    }
  }, [cursorMode]);

  // Handle state machine changes
  useEffect(() => {
    const unsubscribe = stateMachineRef.current.onStateChange((state) => {
      onModeChange?.(state.mode);
    });
    return unsubscribe;
  }, [onModeChange]);

  // Rebuild geometry when nodes/members change
  useEffect(() => {
    if (!membersLineRef.current || !nodesPointsRef.current) return;

    // Update node positions
    const positions = new Float32Array(nodes.size * 3);
    let nodeIndex = 0;
    const nodeIndexMap = new Map<string, number>();

    nodes.forEach((node) => {
      nodeIndexMap.set(node.id, nodeIndex);
      positions[nodeIndex * 3] = node.x;
      positions[nodeIndex * 3 + 1] = node.y;
      positions[nodeIndex * 3 + 2] = node.z;
      nodeIndex++;
    });

    const nodeGeometry = nodesPointsRef.current.geometry as THREE.BufferGeometry;
    const posAttr = nodeGeometry.getAttribute('position') as THREE.BufferAttribute;
    if (posAttr) {
      posAttr.array.set(positions);
      posAttr.needsUpdate = true;
    } else {
      nodeGeometry.setAttribute(
        'position',
        new THREE.BufferAttribute(positions, 3)
      );
    }

    // Update member line segments
    const memberPositions: number[] = [];
    members.forEach((member) => {
      const nodeI = nodes.get(member.nodeI);
      const nodeJ = nodes.get(member.nodeJ);
      if (nodeI && nodeJ) {
        memberPositions.push(nodeI.x, nodeI.y, nodeI.z);
        memberPositions.push(nodeJ.x, nodeJ.y, nodeJ.z);
      }
    });

    const memberGeometry = membersLineRef.current.geometry as THREE.BufferGeometry;
    const memberPosAttr = memberGeometry.getAttribute('position') as THREE.BufferAttribute;
    if (memberPosAttr) {
      memberPosAttr.array.set(new Float32Array(memberPositions));
      memberPosAttr.needsUpdate = true;
    } else {
      memberGeometry.setAttribute(
        'position',
        new THREE.BufferAttribute(new Float32Array(memberPositions), 3)
      );
    }
  }, [nodes, members]);

  // Mouse click handler for node/member selection and creation
  const handleCanvasClick = useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      if (!canvasManagerRef.current || !nodesPointsRef.current || !membersLineRef.current) {
        return;
      }

      const mode = stateMachineRef.current.getMode();
      const rect = gl.domElement.getBoundingClientRect();
      const x = event.clientX - rect.left;
      const y = event.clientY - rect.top;

      const intersections = canvasManagerRef.current.rayCastAt(
        x,
        y,
        nodesPointsRef.current,
        membersLineRef.current
      );

      switch (mode) {
        case CursorMode.SELECT: {
          // Select first non-empty result
          if (intersections.nodes.length > 0) {
            console.log('Node clicked');
            setSelectedNodeIds(new Set());
            setSelectedMemberIds(new Set());
          } else if (intersections.members.length > 0) {
            console.log('Member clicked');
            setSelectedNodeIds(new Set());
            setSelectedMemberIds(new Set());
          } else {
            setSelectedNodeIds(new Set());
            setSelectedMemberIds(new Set());
          }
          break;
        }

        case CursorMode.ADD_NODE: {
          // Snap to grid and create node
          const [snappedX, snappedY, snappedZ] = canvasManagerRef.current.snapToGrid(
            event.clientX - rect.left,
            0, // Ground plane
            event.clientY - rect.top
          );

          // For 3D positioning, use actual click position with snap
          const raycaster = new THREE.Raycaster();
          const normalizedX = ((x / rect.width) * 2 - 1);
          const normalizedY = (-(y / rect.height) * 2 + 1);
          raycaster.setFromCamera({ x: normalizedX, y: normalizedY }, camera);

          // Intersect with a ground plane at y=0
          const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
          const groundPoint = new THREE.Vector3();
          raycaster.ray.intersectPlane(plane, groundPoint);

          const [snapX, snapY, snapZ] = canvasManagerRef.current.snapToGrid(
            groundPoint.x,
            groundPoint.y,
            groundPoint.z
          );

          const newNode: Node = {
            id: `N${Date.now()}`,
            x: snapX,
            y: snapY,
            z: snapZ,
          };

          onNodeAdd(newNode);
          canvasManagerRef.current.addNodeToGrid(newNode);
          break;
        }

        case CursorMode.ADD_BEAM:
        case CursorMode.ADD_COLUMN:
        case CursorMode.ADD_BRACE: {
          // Two-click operation: select first node, then second
          if (intersections.nodes.length === 0) {
            break;
          }

          const state = stateMachineRef.current.getState();
          if (!state.selectedNodeId) {
            console.log('First node selected');
            // Store first node ID from intersection
            // For now, we'd need to track node IDs in the geometry
            stateMachineRef.current.setSelectedNode('temp');
          } else {
            // Create member between two nodes
            const memberType = mode === CursorMode.ADD_BEAM ? 'beam'
              : mode === CursorMode.ADD_COLUMN ? 'column' : 'brace';

            const newMember: Member = {
              id: `M${Date.now()}`,
              startNodeId: 'node1',
              endNodeId: 'node2',
              // Set default material properties for steel
              E: 200e6, // 200 GPa for steel
              A: 0.015, // Default cross-sectional area (m²)
              I: 0.0001, // Default moment of inertia (m⁴)
              Iy: 0.00008,
              Iz: 0.00012,
              G: 77e6, // Shear modulus for steel
              rho: 7850, // Steel density
            };

            onMemberAdd(newMember);
            stateMachineRef.current.clearSelectedNode();
          }
          break;
        }

        case CursorMode.PAN:
          // Handled by OrbitControls
          break;
      }
    },
    [gl, camera, onNodeAdd, onMemberAdd]
  );

  // Render loop
  useFrame(() => {
    if (canvasManagerRef.current) {
      canvasManagerRef.current.render();
    }

    // Periodic topology export (every 60 frames = 1 sec at 60 FPS)
    frameCountRef.current++;
    if (frameCountRef.current % 60 === 0) {
      if (canvasManagerRef.current) {
        const topology = canvasManagerRef.current.exportTopologyJSON(nodes, members);
        if (topology !== lastExportRef.current) {
          lastExportRef.current = topology;
          onTopologyExport?.(topology);
        }
      }
    }
  });

  return (
    <group onClick={handleCanvasClick} style={{ width: '100%', height: '100%' }}>
      <OrbitControls makeDefault />

      {/* Nodes as Points */}
      <points ref={nodesPointsRef}>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            count={nodes.size}
            array={new Float32Array(nodes.size * 3)}
            itemSize={3}
          />
        </bufferGeometry>
        <pointsMaterial size={0.2} color={0x4488ff} sizeAttenuation />
      </points>

      {/* Members as Lines */}
      <lineSegments ref={membersLineRef}>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            count={Math.max(1, members.size * 2)}
            array={new Float32Array(Math.max(1, members.size * 2) * 3)}
            itemSize={3}
          />
        </bufferGeometry>
        <lineBasicMaterial color={0xff8844} linewidth={2} />
      </lineSegments>

      {/* Preview line for two-click operations */}
      <line ref={previewLineRef}>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            count={2}
            array={new Float32Array(6)}
            itemSize={3}
          />
        </bufferGeometry>
        <lineBasicMaterial color={0xffff00} linewidth={1} transparent opacity={0.5} />
      </line>
    </group>
  );
};

/**
 * Main component that wraps Canvas
 */
export const StructuralModelingCanvas: React.FC<StructuralModelingCanvasProps> = (props) => {
  return (
    <Canvas
      style={{ width: '100%', height: '100%' }}
      camera={{ fov: 50, position: [30, 25, 30] }}
      gl={{ antialias: true, precision: 'highp' }}
    >
      <ModelingCanvasInner {...props} />
    </Canvas>
  );
};

export default StructuralModelingCanvas;
