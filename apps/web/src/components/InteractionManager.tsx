import React from 'react';
import { FC, useRef, useState, useCallback, useMemo, useEffect } from 'react';
import * as THREE from 'three';
import { useFrame, useThree, ThreeEvent } from '@react-three/fiber';
import { Line } from '@react-three/drei';
import { useModelStore } from '../store/model';

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
export const InteractionManager: FC<InteractionManagerProps> = ({
    active = true,
    gridStep = 1.0,
    workingPlane = 'XZ',
    workingPlaneOffset = 0,
    onPointSelected,
    onNodeSelected
}) => {
    // Access Three.js context
    const { raycaster, pointer, camera, scene } = useThree();

    // Store access
    const activeTool = useModelStore((state) => state.activeTool);
    const nodes = useModelStore((state) => state.nodes);
    const addNode = useModelStore((state) => state.addNode);
    const addMember = useModelStore((state) => state.addMember);
    const selectNode = useModelStore((state) => state.selectNode);

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

    // State for render-time access (refs can't be accessed during render)
    const [showNodeHighlight, setShowNodeHighlight] = useState(false);
    const [highlightPosition, setHighlightPosition] = useState<THREE.Vector3>(new THREE.Vector3());

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

    // 2. Event Loop: useFrame for raycasting
    useFrame(() => {
        if (!active || !planeRef.current || !cursorRef.current) return;

        // Update raycaster from camera and pointer
        raycaster.setFromCamera(pointer, camera);

        // First: Try to find existing nodes near the ray
        hoveredNodeId.current = null;
        const pickRadius = 0.4; // Radius for node picking
        let closestNode: { id: string; distance: number } | null = null;

        for (const { id, position } of nodePositions) {
            // Calculate distance from ray to node position
            const rayOrigin = raycaster.ray.origin;
            const rayDirection = raycaster.ray.direction;

            const toNode = position.clone().sub(rayOrigin);
            const projectionLength = toNode.dot(rayDirection);

            if (projectionLength < 0) continue; // Node is behind camera

            const closestPointOnRay = rayOrigin.clone().add(rayDirection.clone().multiplyScalar(projectionLength));
            const distance = closestPointOnRay.distanceTo(position);

            if (distance < pickRadius) {
                if (!closestNode || projectionLength < closestNode.distance) {
                    closestNode = { id, distance: projectionLength };
                }
            }
        }

        if (closestNode) {
            // Snap cursor to existing node
            const node = nodes.get(closestNode.id);
            if (node) {
                const nodePos = new THREE.Vector3(node.x, node.y, node.z);
                cursorRef.current.position.copy(nodePos);
                if (cursorRingRef.current) {
                    cursorRingRef.current.position.copy(nodePos);
                    cursorRingRef.current.rotation.copy(camera.rotation);
                }
                currentSnapPos.current.copy(nodePos);
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
        const showCursor = (activeTool === 'node' || activeTool === 'member') && isHovering.current;
        cursorRef.current.visible = showCursor;
        if (cursorRingRef.current) cursorRingRef.current.visible = showCursor;

        // Sync state for render (refs can't be accessed during render)
        const shouldShowHighlight = hoveredNodeId.current !== null;
        if (shouldShowHighlight !== showNodeHighlight) {
            setShowNodeHighlight(shouldShowHighlight);
        }
        if (shouldShowHighlight && !highlightPosition.equals(currentSnapPos.current)) {
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
};

// ============================================
// RUBBER BAND HELPER COMPONENT
// ============================================
interface RubberBandProps {
    start: THREE.Vector3;
    endRef: React.MutableRefObject<THREE.Vector3>;
}

const RubberBand: FC<RubberBandProps> = ({ start, endRef }) => {
    const [endPoint, setEndPoint] = useState(start.clone());

    useFrame(() => {
        // Update end point state each frame to trigger re-render with new line
        if (!endRef.current.equals(endPoint)) {
            setEndPoint(endRef.current.clone());
        }
    });

    return (
        <Line
            color="#ffcc00"
            lineWidth={2}
            points={[start, endPoint]}
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
