/**
 * InteractionLayer.tsx - Pen Tool for Drawing Structural Members in 3D
 * 
 * Features:
 * - State machine: IDLE → PLACING_START → PLACING_END → (loop)
 * - Ghost member preview (dashed line)
 * - Grid snapping (0.5m)
 * - Node snapping (0.2m radius)
 * - Continuous drawing chain
 * - Visual feedback with snap indicators
 */

import { FC, useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { useThree, useFrame } from '@react-three/fiber';
import { Line, Sphere, Ring } from '@react-three/drei';
import * as THREE from 'three';
import { useModelStore, Node } from '../../store/model';
import { useShallow } from 'zustand/react/shallow';

// ============================================
// TYPES
// ============================================

type DrawingState = 'IDLE' | 'PLACING_START' | 'PLACING_END';

interface TempPoint {
    x: number;
    y: number;
    z: number;
    snappedToNode?: string; // ID of node if snapped
}

// ============================================
// CONSTANTS
// ============================================

const GRID_SNAP = 0.5;        // Grid snap distance (meters)
const NODE_SNAP_RADIUS = 0.2; // Snap to existing nodes within this radius
const GHOST_COLOR = '#00ff88';
const START_NODE_COLOR = '#22cc55';
const SNAP_INDICATOR_COLOR = '#ff4444';

// ============================================
// UTILITY FUNCTIONS
// ============================================

/**
 * Snap a value to the nearest grid increment
 */
const snapToGrid = (value: number, gridSize: number): number => {
    return Math.round(value / gridSize) * gridSize;
};

/**
 * Find the closest node within snap radius
 */
const findClosestNode = (
    point: THREE.Vector3,
    nodes: Map<string, Node>,
    snapRadius: number
): Node | null => {
    let closest: Node | null = null;
    let minDist = snapRadius;

    nodes.forEach((node) => {
        const dist = Math.sqrt(
            Math.pow(point.x - node.x, 2) +
            Math.pow(point.y - node.y, 2) +
            Math.pow(point.z - node.z, 2)
        );
        if (dist < minDist) {
            minDist = dist;
            closest = node;
        }
    });

    return closest;
};

// ============================================
// GHOST MEMBER COMPONENT
// ============================================

interface GhostMemberProps {
    start: TempPoint;
    end: TempPoint;
}

const GhostMember: FC<GhostMemberProps> = ({ start, end }) => {
    const points = useMemo(() => [
        new THREE.Vector3(start.x, start.y, start.z),
        new THREE.Vector3(end.x, end.y, end.z)
    ], [start, end]);

    return (
        <Line
            points={points}
            color={GHOST_COLOR}
            lineWidth={2}
            dashed
            dashSize={0.3}
            gapSize={0.15}
        />
    );
};

// ============================================
// START NODE INDICATOR
// ============================================

interface StartNodeIndicatorProps {
    position: TempPoint;
}

const StartNodeIndicator: FC<StartNodeIndicatorProps> = ({ position }) => {
    return (
        <Sphere
            position={[position.x, position.y, position.z]}
            args={[0.08, 16, 16]}
        >
            <meshStandardMaterial
                color={START_NODE_COLOR}
                emissive={START_NODE_COLOR}
                emissiveIntensity={0.5}
            />
        </Sphere>
    );
};

// ============================================
// SNAP INDICATOR (Red Ring)
// ============================================

interface SnapIndicatorProps {
    position: TempPoint;
}

const SnapIndicator: FC<SnapIndicatorProps> = ({ position }) => {
    const groupRef = useRef<THREE.Group>(null);

    useFrame(() => {
        // Pulsing animation - mutate scale directly, no setState
        if (groupRef.current) {
            const scale = 1 + Math.sin(Date.now() * 0.005) * 0.2;
            groupRef.current.scale.set(scale, scale, scale);
        }
    });

    return (
        <group ref={groupRef} position={[position.x, position.y, position.z]}>
            <Ring
                args={[0.12, 0.18, 32]}
                rotation={[-Math.PI / 2, 0, 0]}
            >
                <meshBasicMaterial
                    color={SNAP_INDICATOR_COLOR}
                    transparent
                    opacity={0.8}
                    side={THREE.DoubleSide}
                />
            </Ring>
        </group>
    );
};

// ============================================
// CURSOR INDICATOR
// ============================================

interface CursorIndicatorProps {
    position: TempPoint;
    isSnapped: boolean;
}

const CursorIndicator: FC<CursorIndicatorProps> = ({ position, isSnapped }) => {
    return (
        <Sphere
            position={[position.x, position.y, position.z]}
            args={[0.05, 12, 12]}
        >
            <meshStandardMaterial
                color={isSnapped ? SNAP_INDICATOR_COLOR : '#ffffff'}
                emissive={isSnapped ? SNAP_INDICATOR_COLOR : '#aaaaaa'}
                emissiveIntensity={0.3}
                transparent
                opacity={0.7}
            />
        </Sphere>
    );
};

// ============================================
// MAIN INTERACTION LAYER COMPONENT
// ============================================

interface InteractionLayerProps {
    enabled?: boolean;
    gridPlaneY?: number; // Y position of the drawing plane (default 0)
}

export const InteractionLayer: FC<InteractionLayerProps> = ({
    enabled = true,
    gridPlaneY = 0
}) => {
    // ---- Store ----
    const { nodes, addNode, addMember, activeTool, getNextNodeId, getNextMemberId } = useModelStore(
        useShallow((s) => ({
            nodes: s.nodes,
            addNode: s.addNode,
            addMember: s.addMember,
            activeTool: s.activeTool,
            getNextNodeId: s.getNextNodeId,
            getNextMemberId: s.getNextMemberId,
        }))
    );

    // ---- State Machine ----
    const [drawingState, setDrawingState] = useState<DrawingState>('IDLE');
    const [startPoint, setStartPoint] = useState<TempPoint | null>(null);
    const [cursorPoint, setCursorPoint] = useState<TempPoint | null>(null);
    const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);

    // ---- Three.js ----
    const { camera, gl, raycaster, pointer } = useThree();
    const groundPlane = useMemo(() => new THREE.Plane(new THREE.Vector3(0, 1, 0), -gridPlaneY), [gridPlaneY]);

    // ---- Check if pen tool is active ----
    const isPenToolActive = enabled && activeTool === 'member';

    // ---- Activate drawing when tool changes ----
    useEffect(() => {
        queueMicrotask(() => {
            if (isPenToolActive) {
                setDrawingState('PLACING_START');
            } else {
                setDrawingState('IDLE');
                setStartPoint(null);
                setCursorPoint(null);
                setHoveredNodeId(null);
            }
        });
    }, [isPenToolActive]);

    // ---- Calculate cursor position with snapping ----
    const calculateCursorPosition = useCallback((): TempPoint | null => {
        if (!isPenToolActive) return null;

        // Cast ray to ground plane
        raycaster.setFromCamera(pointer, camera);
        const intersection = new THREE.Vector3();
        const hit = raycaster.ray.intersectPlane(groundPlane, intersection);

        if (!hit) return null;

        // Snap to grid first
        let snappedX = snapToGrid(intersection.x, GRID_SNAP);
        let snappedY = gridPlaneY;
        let snappedZ = snapToGrid(intersection.z, GRID_SNAP);
        let snappedToNode: string | undefined = undefined;

        // Check for node snapping
        const closestNode = findClosestNode(intersection, nodes, NODE_SNAP_RADIUS);
        if (closestNode) {
            snappedX = closestNode.x;
            snappedY = closestNode.y;
            snappedZ = closestNode.z;
            snappedToNode = closestNode.id;
        }

        return {
            x: snappedX,
            y: snappedY,
            z: snappedZ,
            snappedToNode
        };
    }, [isPenToolActive, raycaster, pointer, camera, groundPlane, nodes, gridPlaneY]);

    // ---- Refs to track previous values and avoid unnecessary setState ----
    const prevCursorRef = useRef<{ x: number; y: number; z: number; snappedToNode?: string } | null>(null);
    
    // ---- Update cursor position on every frame ----
    useFrame(() => {
        if (!isPenToolActive) return;

        const newCursorPoint = calculateCursorPosition();
        if (newCursorPoint) {
            // Only update state if position actually changed (avoid infinite re-renders)
            const prev = prevCursorRef.current;
            const posChanged = !prev || 
                Math.abs(prev.x - newCursorPoint.x) > 0.001 ||
                Math.abs(prev.y - newCursorPoint.y) > 0.001 ||
                Math.abs(prev.z - newCursorPoint.z) > 0.001;
            const nodeChanged = prev?.snappedToNode !== newCursorPoint.snappedToNode;
            
            if (posChanged || nodeChanged) {
                prevCursorRef.current = newCursorPoint;
                setCursorPoint(newCursorPoint);
                setHoveredNodeId(newCursorPoint.snappedToNode || null);
            }
        }
    });

    // ---- Handle Click ----
    const handleClick = useCallback((event: MouseEvent) => {
        if (!isPenToolActive || !cursorPoint) return;

        if (drawingState === 'PLACING_START' || drawingState === 'IDLE') {
            // First click: Set start point
            setStartPoint({ ...cursorPoint });
            setDrawingState('PLACING_END');
        } else if (drawingState === 'PLACING_END' && startPoint) {
            // Second click: Complete the member

            // Handle start node
            let startNodeId = startPoint.snappedToNode;
            if (!startNodeId) {
                startNodeId = getNextNodeId();
                addNode({
                    id: startNodeId,
                    x: startPoint.x,
                    y: startPoint.y,
                    z: startPoint.z
                });
            }

            // Handle end node
            let endNodeId = cursorPoint.snappedToNode;
            if (!endNodeId) {
                endNodeId = getNextNodeId();
                addNode({
                    id: endNodeId,
                    x: cursorPoint.x,
                    y: cursorPoint.y,
                    z: cursorPoint.z
                });
            }

            // Don't create zero-length members
            if (startNodeId !== endNodeId) {
                // Add the member
                addMember({
                    id: getNextMemberId(),
                    startNodeId,
                    endNodeId,
                    sectionId: 'default'
                });
            }

            // Continuous drawing: Start new member from the end point
            setStartPoint({ ...cursorPoint });
            setDrawingState('PLACING_END');
        }
    }, [isPenToolActive, cursorPoint, drawingState, startPoint, addNode, addMember, getNextNodeId, getNextMemberId]);

    // ---- Handle Right Click / Escape (Cancel) ----
    const handleCancel = useCallback((event: MouseEvent | KeyboardEvent) => {
        if (!isPenToolActive) return;

        if (event.type === 'contextmenu') {
            event.preventDefault();
        }

        if (event.type === 'keydown' && (event as KeyboardEvent).key !== 'Escape') {
            return;
        }

        // Reset to start state
        setStartPoint(null);
        setDrawingState('PLACING_START');
    }, [isPenToolActive]);

    // ---- Event Listeners ----
    useEffect(() => {
        const canvas = gl.domElement;

        canvas.addEventListener('click', handleClick);
        canvas.addEventListener('contextmenu', handleCancel);
        window.addEventListener('keydown', handleCancel);

        return () => {
            canvas.removeEventListener('click', handleClick);
            canvas.removeEventListener('contextmenu', handleCancel);
            window.removeEventListener('keydown', handleCancel);
        };
    }, [gl.domElement, handleClick, handleCancel]);

    // ---- Render ----
    if (!isPenToolActive) return null;

    return (
        <group name="interaction-layer">
            {/* Cursor Indicator */}
            {cursorPoint && (
                <CursorIndicator
                    position={cursorPoint}
                    isSnapped={!!cursorPoint.snappedToNode}
                />
            )}

            {/* Snap Indicator (when hovering over existing node) */}
            {cursorPoint?.snappedToNode && (
                <SnapIndicator position={cursorPoint} />
            )}

            {/* Start Node Indicator */}
            {startPoint && drawingState === 'PLACING_END' && (
                <StartNodeIndicator position={startPoint} />
            )}

            {/* Ghost Member Preview */}
            {startPoint && cursorPoint && drawingState === 'PLACING_END' && (
                <GhostMember start={startPoint} end={cursorPoint} />
            )}
        </group>
    );
};

export default InteractionLayer;
