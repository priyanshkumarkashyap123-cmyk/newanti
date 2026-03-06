import React from 'react';
import { FC, useRef, useState, useCallback, useMemo, useEffect, memo } from 'react';
import * as THREE from 'three';
import { useFrame, useThree, ThreeEvent } from '@react-three/fiber';
import { Line } from '@react-three/drei';
import { useModelStore } from '../store/model';
import { useUIStore } from '../store/uiStore';
import { useShallow } from 'zustand/react/shallow';

// ============================================
// UTILITY: Snap to Grid Function
// ============================================
const snapToGrid = (point: THREE.Vector3, step: number = 1.0): THREE.Vector3 => {
    return new THREE.Vector3(
        Math.round(point.x / step) * step,
        Math.round(point.y / step) * step,
        Math.round(point.z / step) * step
    );
};

// ============================================
// TYPES
// ============================================
type WorkingPlane = 'XZ' | 'XY' | 'YZ';

interface InteractionManagerProps {
    active?: boolean;
    gridStep?: number;
    workingPlane?: WorkingPlane;
    workingPlaneOffset?: number;
    onPointSelected?: (point: THREE.Vector3) => void;
    onNodeSelected?: (nodeId: string) => void;
}

// ============================================
// INTERACTION MANAGER COMPONENT
// ============================================
export const InteractionManager: FC<InteractionManagerProps> = memo(({
    active = true,
    gridStep = 1.0,
    workingPlane = 'XZ',
    workingPlaneOffset = 0,
    onPointSelected,
    onNodeSelected
}) => {
    // Access Three.js context
    const { raycaster, pointer, camera, scene } = useThree();

    // Store access — batched with useShallow to prevent cascading re-renders
    const {
        activeTool, nodes, members, addNode, addMember, selectNode,
    } = useModelStore(
        useShallow((state) => ({
            activeTool: state.activeTool,
            nodes: state.nodes,
            members: state.members,
            addNode: state.addNode,
            addMember: state.addMember,
            selectNode: state.selectNode,
        }))
    );
    const openModal = useUIStore((s) => s.openModal);

    // Refs
    const planeRef = useRef<THREE.Mesh>(null!);
    const cursorRef = useRef<THREE.Mesh>(null!);
    const cursorRingRef = useRef<THREE.Mesh>(null!);
    const currentSnapPos = useRef(new THREE.Vector3());
    const isHovering = useRef(false);
    const hoveredNodeId = useRef<string | null>(null);

    // Drawing State for Member tool
    const [startPoint, setStartPoint] = useState<THREE.Vector3 | null>(null);
    const [startNodeId, setStartNodeId] = useState<string | null>(null);

    // State for render-time access — use refs to avoid setState in useFrame
    const showNodeHighlightRef = useRef(false);
    const highlightPositionRef = useRef(new THREE.Vector3());
    const [showNodeHighlight, setShowNodeHighlight] = useState(false);
    const [highlightPosition, setHighlightPosition] = useState<THREE.Vector3>(new THREE.Vector3());

    // Pre-allocated scratch vector for node position in useFrame
    const _nodePos = useRef(new THREE.Vector3());

    // Calculate plane rotation and position based on working plane
    const planeTransform = useMemo(() => {
        switch (workingPlane) {
            case 'XZ': // Ground plane (default)
                return {
                    rotation: new THREE.Euler(-Math.PI / 2, 0, 0),
                    position: new THREE.Vector3(0, workingPlaneOffset, 0),
                    constrainAxis: 'y' as const
                };
            case 'XY': // Front/back plane
                return {
                    rotation: new THREE.Euler(0, 0, 0),
                    position: new THREE.Vector3(0, 0, workingPlaneOffset),
                    constrainAxis: 'z' as const
                };
            case 'YZ': // Side plane
                return {
                    rotation: new THREE.Euler(0, Math.PI / 2, 0),
                    position: new THREE.Vector3(workingPlaneOffset, 0, 0),
                    constrainAxis: 'x' as const
                };
        }
    }, [workingPlane, workingPlaneOffset]);

    // Build node positions for raycasting
    const nodePositions = useMemo(() => {
        const positions: { id: string; position: THREE.Vector3 }[] = [];
        nodes.forEach((node, id) => {
            positions.push({ id, position: new THREE.Vector3(node.x, node.y, node.z) });
        });
        return positions;
    }, [nodes]);

    // Pre-allocate reusable vectors for raycasting — avoids GC pressure at 60fps
    const _toNode = useMemo(() => new THREE.Vector3(), []);
    const _closestPoint = useMemo(() => new THREE.Vector3(), []);
    const _rayDir = useMemo(() => new THREE.Vector3(), []);

    // 2. Event Loop: useFrame for raycasting
    useFrame(() => {
        if (!active || !planeRef.current || !cursorRef.current) return;

        // Update raycaster from camera and pointer
        raycaster.setFromCamera(pointer, camera);

        // First: Try to find existing nodes near the ray
        hoveredNodeId.current = null;
        const pickRadius = 0.4; // Radius for node picking
        const pickRadiusSq = pickRadius * pickRadius; // Avoid sqrt in distance check
        let closestNode: { id: string; distance: number } | null = null;

        const rayOrigin = raycaster.ray.origin;
        const rayDirection = raycaster.ray.direction;

        for (const { id, position } of nodePositions) {
            // Reuse pre-allocated vectors instead of .clone()
            _toNode.subVectors(position, rayOrigin);
            const projectionLength = _toNode.dot(rayDirection);

            if (projectionLength < 0) continue; // Node is behind camera

            _closestPoint.copy(rayDirection).multiplyScalar(projectionLength).add(rayOrigin);
            const distSq = _closestPoint.distanceToSquared(position);

            if (distSq < pickRadiusSq) {
                if (!closestNode || projectionLength < closestNode.distance) {
                    closestNode = { id, distance: projectionLength };
                }
            }
        }

        if (closestNode) {
            // Snap cursor to existing node
            const node = nodes.get(closestNode.id);
            if (node) {
                _nodePos.current.set(node.x, node.y, node.z);
                cursorRef.current.position.copy(_nodePos.current);
                if (cursorRingRef.current) {
                    cursorRingRef.current.position.copy(_nodePos.current);
                    cursorRingRef.current.rotation.copy(camera.rotation);
                }
                currentSnapPos.current.copy(_nodePos.current);
                hoveredNodeId.current = closestNode.id;
                isHovering.current = true;

                // Change cursor color to indicate node hover
                const material = cursorRef.current.material as THREE.MeshBasicMaterial;
                material.color.set('#ffcc00'); // Yellow for existing node
            }
        } else {
            // Fallback: Raycast against working plane
            const intersects = raycaster.intersectObject(planeRef.current);

            if (intersects.length > 0 && intersects[0]) {
                const hitPoint = intersects[0].point;
                const snapped = snapToGrid(hitPoint, gridStep);

                // Constrain to working plane
                switch (planeTransform.constrainAxis) {
                    case 'y':
                        snapped.y = workingPlaneOffset;
                        break;
                    case 'z':
                        snapped.z = workingPlaneOffset;
                        break;
                    case 'x':
                        snapped.x = workingPlaneOffset;
                        break;
                }

                cursorRef.current.position.copy(snapped);
                if (cursorRingRef.current) {
                    cursorRingRef.current.position.copy(snapped);
                    cursorRingRef.current.rotation.copy(planeTransform.rotation);
                }
                currentSnapPos.current.copy(snapped);
                isHovering.current = true;

                // Reset cursor color to green for new point
                const material = cursorRef.current.material as THREE.MeshBasicMaterial;
                material.color.set('#00ff88');
            } else {
                isHovering.current = false;
            }
        }

        // Show/hide cursor based on active tool
        const cursorTools = ['node', 'member', 'support', 'load', 'memberLoad'];
        const showCursor = cursorTools.includes(activeTool || '') && isHovering.current;
        cursorRef.current.visible = showCursor;
        if (cursorRingRef.current) cursorRingRef.current.visible = showCursor;

        // Sync state for render — only trigger React re-render when value actually changes
        const shouldShowHighlight = hoveredNodeId.current !== null;
        if (shouldShowHighlight !== showNodeHighlightRef.current) {
            showNodeHighlightRef.current = shouldShowHighlight;
            setShowNodeHighlight(shouldShowHighlight);
        }
        if (shouldShowHighlight && !highlightPositionRef.current.equals(currentSnapPos.current)) {
            highlightPositionRef.current.copy(currentSnapPos.current);
            setHighlightPosition(currentSnapPos.current.clone());
        }
    });

    // Handle pointer down
    const handlePointerDown = useCallback((e: ThreeEvent<PointerEvent>) => {
        if (!active || !isHovering.current) return;
        e.stopPropagation();

        const point = currentSnapPos.current.clone();
        const nodeId = hoveredNodeId.current;

        // Dispatch to external handlers
        if (onPointSelected) onPointSelected(point);
        if (nodeId && onNodeSelected) onNodeSelected(nodeId);

        // Internal tool handling
        switch (activeTool) {
            case 'node':
                if (!nodeId) {
                    // Only create new node if not clicking existing node
                    addNode({
                        id: crypto.randomUUID(),
                        x: point.x,
                        y: point.y,
                        z: point.z
                    });
                } else {
                    // Select existing node
                    selectNode(nodeId);
                }
                break;

            case 'member':
                if (!startPoint) {
                    // First click: Set start point/node
                    setStartPoint(point);
                    setStartNodeId(nodeId);
                } else {
                    // Second click: Create member
                    let startId = startNodeId;
                    let endId = nodeId;

                    // Create start node if clicking on empty space
                    if (!startId) {
                        startId = crypto.randomUUID();
                        addNode({ id: startId, x: startPoint.x, y: startPoint.y, z: startPoint.z });
                    }

                    // Create end node if clicking on empty space
                    if (!endId) {
                        endId = crypto.randomUUID();
                        addNode({ id: endId, x: point.x, y: point.y, z: point.z });
                    }

                    // Prevent self-connecting member
                    if (startId !== endId) {
                        addMember({
                            id: crypto.randomUUID(),
                            startNodeId: startId,
                            endNodeId: endId,
                            sectionId: 'ISMB300'
                        });
                    }

                    // Reset for next member
                    setStartPoint(null);
                    setStartNodeId(null);
                }
                break;

            case 'select':
                if (nodeId) {
                    selectNode(nodeId);
                }
                break;

            case 'support':
                // Click on a node to assign support/restraint
                if (nodeId) {
                    selectNode(nodeId);
                    openModal('boundaryConditionsDialog' as any);
                }
                break;

            case 'load':
                // Click on a node to apply nodal force/moment
                if (nodeId) {
                    selectNode(nodeId);
                    openModal('loadDialog' as any);
                }
                break;

            case 'memberLoad': {
                // Find the closest member to the click point and apply load
                let closestMember: { id: string; distance: number } | null = null;
                for (const [mId, m] of members) {
                    const n1 = nodes.get(m.startNodeId);
                    const n2 = nodes.get(m.endNodeId);
                    if (!n1 || !n2) continue;
                    // Point-to-line-segment distance
                    const a = new THREE.Vector3(n1.x, n1.y, n1.z ?? 0);
                    const b = new THREE.Vector3(n2.x, n2.y, n2.z ?? 0);
                    const ab = new THREE.Vector3().subVectors(b, a);
                    const ap = new THREE.Vector3().subVectors(point, a);
                    const t = Math.max(0, Math.min(1, ap.dot(ab) / ab.dot(ab)));
                    const closest = new THREE.Vector3().copy(a).addScaledVector(ab, t);
                    const dist = closest.distanceTo(point);
                    if (dist < 0.8 && (!closestMember || dist < closestMember.distance)) {
                        closestMember = { id: mId, distance: dist };
                    }
                }
                if (closestMember) {
                    // Select the member and open UDL dialog
                    const store = useModelStore.getState();
                    store.selectNode(closestMember.id); // Select the member in the store
                    openModal('memberLoadDialog' as any);
                }
                break;
            }

            case 'select_range':
                // For box select, use single-click as fallback to select node
                if (nodeId) {
                    selectNode(nodeId);
                }
                break;

            default:
                break;
        }
    }, [active, activeTool, addNode, addMember, selectNode, startPoint, startNodeId, onPointSelected, onNodeSelected]);

    // Cancel member drawing on Escape
    const handleKeyDown = useCallback((e: KeyboardEvent) => {
        if (e.key === 'Escape' && startPoint) {
            setStartPoint(null);
            setStartNodeId(null);
        }
    }, [startPoint]);

    // Add keyboard listener
    useEffect(() => {
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [handleKeyDown]);

    return (
        <>
            {/* Invisible Working Plane */}
            <mesh
                ref={planeRef}
                rotation={planeTransform.rotation}
                position={planeTransform.position}
                visible={false}
                onPointerDown={handlePointerDown}
            >
                <planeGeometry args={[500, 500]} />
                <meshBasicMaterial transparent opacity={0} />
            </mesh>

            {/* Ghost Cursor - Semi-transparent sphere */}
            <mesh ref={cursorRef} visible={false}>
                <sphereGeometry args={[0.15, 24, 24]} />
                <meshBasicMaterial
                    color="#00ff88"
                    transparent
                    opacity={0.7}
                    depthTest={false}
                />
            </mesh>

            {/* Ghost Cursor Ring */}
            <mesh ref={cursorRingRef} visible={false}>
                <ringGeometry args={[0.3, 0.35, 32]} />
                <meshBasicMaterial
                    color="#00ff88"
                    transparent
                    opacity={0.5}
                    side={THREE.DoubleSide}
                    depthTest={false}
                />
            </mesh>

            {/* Rubber Band Line for Member drawing */}
            {startPoint && activeTool === 'member' && (
                <RubberBand start={startPoint} endRef={currentSnapPos} />
            )}

            {/* Node Highlight Indicator */}
            {showNodeHighlight && (
                <NodeHighlight position={highlightPosition} />
            )}
        </>
    );
});

// ============================================
// RUBBER BAND HELPER COMPONENT
// ============================================
interface RubberBandProps {
    start: THREE.Vector3;
    endRef: React.MutableRefObject<THREE.Vector3>;
}

const RubberBand: FC<RubberBandProps> = ({ start, endRef }) => {
    const lineRef = useRef<any>(null);

    useFrame(() => {
        // Directly update geometry via ref — avoids setState → re-render at 60fps
        if (lineRef.current) {
            const positions = lineRef.current.geometry?.attributes?.instanceStart;
            if (positions) {
                // For drei <Line>, update points via the exposed API
                lineRef.current.geometry.setPositions([
                    start.x, start.y, start.z,
                    endRef.current.x, endRef.current.y, endRef.current.z,
                ]);
            }
        }
    });

    return (
        <Line
            ref={lineRef}
            color="#ffcc00"
            lineWidth={2}
            points={[start, endRef.current.clone()]}
            dashed
            dashScale={2}
        />
    );
};

// ============================================
// NODE HIGHLIGHT COMPONENT
// ============================================
interface NodeHighlightProps {
    position: THREE.Vector3;
}

const NodeHighlight: FC<NodeHighlightProps> = ({ position }) => {
    return (
        <mesh position={position}>
            <ringGeometry args={[0.4, 0.45, 32]} />
            <meshBasicMaterial
                color="#ffcc00"
                transparent
                opacity={0.8}
                side={THREE.DoubleSide}
                depthTest={false}
            />
        </mesh>
    );
};

export default InteractionManager;
