/**
 * ConnectionVisualizer.tsx - 3D Connection Rendering Component
 * 
 * Renders structural connections in the 3D viewport:
 * - Bolted connections (with bolt patterns)
 * - Welded connections (with weld indicators)
 * - Base plates
 * - Connection indicators at beam-column joints
 */

import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import * as THREE from 'three';
import type { Connection, ConnectionType } from '../data/ConnectionTypes';
import { getConnectionVisualProperties } from '../data/ConnectionTypes';
import { useModelStore } from '../store/model';
import { useUIStore } from '../store/uiStore';

// ============================================
// CONNECTION BALL COMPONENT
// ============================================

interface ConnectionBallProps {
    position: [number, number, number];
    connection: Connection;
    isSelected?: boolean;
    onClick?: () => void;
}

function ConnectionBall({ position, connection, isSelected, onClick }: ConnectionBallProps) {
    const meshRef = useRef<THREE.Mesh>(null);
    const visual = getConnectionVisualProperties(connection);

    // Subtle hover/selection animation
    useFrame((state) => {
        if (meshRef.current) {
            if (isSelected) {
                meshRef.current.scale.setScalar(1 + Math.sin(state.clock.elapsedTime * 3) * 0.1);
            }
        }
    });

    const geometry = useMemo(() => {
        switch (visual.shape) {
            case 'sphere':
                return new THREE.SphereGeometry(visual.size, 16, 16);
            case 'cylinder':
                return new THREE.CylinderGeometry(visual.size * 0.7, visual.size * 0.7, visual.size * 1.5, 16);
            case 'box':
                return new THREE.BoxGeometry(visual.size * 1.4, visual.size * 1.4, visual.size * 1.4);
            default:
                return new THREE.SphereGeometry(visual.size, 16, 16);
        }
    }, [visual.shape, visual.size]);

    return (
        <group position={position}>
            <mesh
                ref={meshRef}
                geometry={geometry}
                onClick={onClick}
            >
                <meshStandardMaterial
                    color={isSelected ? '#ffffff' : visual.color}
                    emissive={visual.color}
                    emissiveIntensity={isSelected ? 0.5 : 0.2}
                    metalness={0.3}
                    roughness={0.4}
                />
            </mesh>

            {/* Wireframe overlay when selected */}
            {isSelected && (
                <mesh geometry={geometry}>
                    <meshBasicMaterial
                        color="#ffffff"
                        wireframe
                        transparent
                        opacity={0.5}
                    />
                </mesh>
            )}
        </group>
    );
}

// ============================================
// BOLTED CONNECTION DETAIL
// ============================================

interface BoltedConnectionDetailProps {
    position: [number, number, number];
    rotation?: [number, number, number];
    connection: Connection;
}

function BoltedConnectionDetail({ position, rotation = [0, 0, 0], connection }: BoltedConnectionDetailProps) {
    const boltDetails = connection.boltDetails;
    if (!boltDetails) return null;

    const boltPositions: [number, number, number][] = [];
    const boltRadius = (boltDetails.boltDiameter / 2) * 0.001; // Convert mm to m
    const pitch = boltDetails.pitch * 0.001;
    const gauge = boltDetails.gauge * 0.001;

    // Generate bolt positions in grid
    for (let row = 0; row < boltDetails.rows; row++) {
        for (let col = 0; col < boltDetails.columns; col++) {
            const x = (col - (boltDetails.columns - 1) / 2) * gauge;
            const y = (row - (boltDetails.rows - 1) / 2) * pitch;
            boltPositions.push([x, y, 0.01]); // Slight offset for visibility
        }
    }

    const boltColor = boltDetails.boltGrade.startsWith('10') || boltDetails.boltGrade.startsWith('12')
        ? '#1a237e'  // High-strength: dark blue
        : '#37474f'; // Standard: dark gray

    return (
        <group position={position} rotation={rotation}>
            {/* End plate */}
            <mesh>
                <boxGeometry args={[
                    boltDetails.columns * gauge + boltDetails.edgeDistance * 0.002,
                    boltDetails.rows * pitch + boltDetails.endDistance * 0.002,
                    (connection.plateThickness || 12) * 0.001
                ]} />
                <meshStandardMaterial
                    color="#607d8b"
                    metalness={0.7}
                    roughness={0.3}
                />
            </mesh>

            {/* Bolts */}
            {boltPositions.map((pos, idx) => (
                <group key={idx} position={pos}>
                    {/* Bolt head */}
                    <mesh position={[0, 0, boltRadius * 0.5]}>
                        <cylinderGeometry args={[boltRadius * 1.5, boltRadius * 1.5, boltRadius, 6]} />
                        <meshStandardMaterial color={boltColor} metalness={0.8} roughness={0.2} />
                    </mesh>
                    {/* Bolt shank (through plate) */}
                    <mesh>
                        <cylinderGeometry args={[boltRadius, boltRadius, 0.02, 16]} />
                        <meshStandardMaterial color="#424242" metalness={0.6} roughness={0.4} />
                    </mesh>
                </group>
            ))}
        </group>
    );
}

// ============================================
// WELDED CONNECTION DETAIL
// ============================================

interface WeldedConnectionDetailProps {
    position: [number, number, number];
    rotation?: [number, number, number];
    connection: Connection;
    length?: number;
}

function WeldedConnectionDetail({ position, rotation = [0, 0, 0], connection, length = 0.2 }: WeldedConnectionDetailProps) {
    const weldDetails = connection.weldDetails;
    if (!weldDetails) return null;

    const weldSize = (weldDetails.weldSize || 6) * 0.001; // Convert mm to m
    const weldLength = length;

    // Fillet weld shape (triangular cross-section)
    const weldShape = useMemo(() => {
        const shape = new THREE.Shape();
        shape.moveTo(0, 0);
        shape.lineTo(weldSize, 0);
        shape.lineTo(0, weldSize);
        shape.closePath();
        return shape;
    }, [weldSize]);

    const extrudeSettings = {
        steps: 1,
        depth: weldLength,
        bevelEnabled: false
    };

    return (
        <group position={position} rotation={rotation}>
            {/* Weld bead */}
            <mesh rotation={[0, Math.PI / 2, 0]} position={[-weldLength / 2, 0, 0]}>
                <extrudeGeometry args={[weldShape, extrudeSettings]} />
                <meshStandardMaterial
                    color="#ff6f00"
                    emissive="#ff6f00"
                    emissiveIntensity={0.1}
                    metalness={0.5}
                    roughness={0.6}
                />
            </mesh>

            {/* Weld symbol indicator (small triangle) */}
            <mesh position={[0, weldSize * 2, 0]}>
                <coneGeometry args={[weldSize, weldSize * 2, 3]} />
                <meshStandardMaterial color="#ffab00" />
            </mesh>
        </group>
    );
}

// ============================================
// BASE PLATE VISUALIZATION
// ============================================

interface BasePlateDetailProps {
    position: [number, number, number];
    connection: Connection;
}

function BasePlateDetail({ position, connection }: BasePlateDetailProps) {
    const basePlate = connection.basePlateDetails;
    if (!basePlate) return null;

    const width = basePlate.width * 0.001;
    const length = basePlate.length * 0.001;
    const thickness = basePlate.thickness * 0.001;
    const anchorRadius = (basePlate.anchorBoltDiameter / 2) * 0.001;

    // Generate anchor bolt positions
    const anchorPositions: [number, number, number][] = [];
    const numAnchors = basePlate.numberOfAnchors;

    if (basePlate.anchorLayout === 'rectangular' && numAnchors >= 4) {
        // 4 corners + additional along edges
        const edgeDist = Math.min(width, length) * 0.15;
        anchorPositions.push(
            [-width / 2 + edgeDist, 0, -length / 2 + edgeDist],
            [width / 2 - edgeDist, 0, -length / 2 + edgeDist],
            [-width / 2 + edgeDist, 0, length / 2 - edgeDist],
            [width / 2 - edgeDist, 0, length / 2 - edgeDist]
        );

        if (numAnchors === 8) {
            // Add middle anchors on each side
            anchorPositions.push(
                [0, 0, -length / 2 + edgeDist],
                [0, 0, length / 2 - edgeDist],
                [-width / 2 + edgeDist, 0, 0],
                [width / 2 - edgeDist, 0, 0]
            );
        }
    }

    return (
        <group position={position}>
            {/* Base plate */}
            <mesh position={[0, thickness / 2, 0]}>
                <boxGeometry args={[width, thickness, length]} />
                <meshStandardMaterial
                    color="#546e7a"
                    metalness={0.7}
                    roughness={0.3}
                />
            </mesh>

            {/* Grout layer */}
            <mesh position={[0, -basePlate.groutThickness * 0.0005, 0]}>
                <boxGeometry args={[width * 1.1, basePlate.groutThickness * 0.001, length * 1.1]} />
                <meshStandardMaterial color="#9e9e9e" roughness={0.8} />
            </mesh>

            {/* Anchor bolts */}
            {anchorPositions.map((pos, idx) => (
                <group key={idx} position={pos}>
                    {/* Nut */}
                    <mesh position={[0, thickness + anchorRadius * 0.8, 0]}>
                        <cylinderGeometry args={[anchorRadius * 1.5, anchorRadius * 1.5, anchorRadius, 6]} />
                        <meshStandardMaterial color="#424242" metalness={0.8} roughness={0.2} />
                    </mesh>
                    {/* Washer */}
                    <mesh position={[0, thickness + 0.002, 0]}>
                        <cylinderGeometry args={[anchorRadius * 2, anchorRadius * 2, 0.004, 16]} />
                        <meshStandardMaterial color="#616161" metalness={0.6} roughness={0.4} />
                    </mesh>
                    {/* Bolt visible portion */}
                    <mesh position={[0, thickness / 2, 0]}>
                        <cylinderGeometry args={[anchorRadius, anchorRadius, thickness + anchorRadius * 2, 16]} />
                        <meshStandardMaterial color="#37474f" metalness={0.7} roughness={0.3} />
                    </mesh>
                </group>
            ))}
        </group>
    );
}

// ============================================
// CONNECTION LABEL COMPONENT
// ============================================

interface ConnectionLabelProps {
    position: [number, number, number];
    connection: Connection;
    visible?: boolean;
}

function ConnectionLabel({ position, connection, visible = true }: ConnectionLabelProps) {
    if (!visible) return null;

    const visual = getConnectionVisualProperties(connection);

    const getStatusColor = () => {
        if (!connection.designCheck) return '#9e9e9e';
        switch (connection.designCheck) {
            case 'OK': return '#4caf50';
            case 'MARGINAL': return '#ff9800';
            case 'NG': return '#f44336';
            default: return '#9e9e9e';
        }
    };

    return (
        <Html
            position={[position[0], position[1] + 0.15, position[2]]}
            center
            distanceFactor={10}
        >
            <div style={{
                background: 'rgba(0,0,0,0.8)',
                color: 'white',
                padding: '4px 8px',
                borderRadius: '4px',
                fontSize: '11px',
                whiteSpace: 'nowrap',
                border: `2px solid ${getStatusColor()}`
            }}>
                <div style={{ fontWeight: 'bold', color: visual.color }}>
                    {visual.label}
                </div>
                {connection.utilization !== undefined && (
                    <div style={{ fontSize: '10px', color: getStatusColor() }}>
                        {(connection.utilization * 100).toFixed(0)}% utilized
                    </div>
                )}
            </div>
        </Html>
    );
}

// ============================================
// MAIN CONNECTION VISUALIZER COMPONENT
// ============================================

interface ConnectionVisualizerProps {
    connections?: Connection[];
    showLabels?: boolean;
    showDetails?: boolean;
    selectedConnectionId?: string;
    onConnectionClick?: (connection: Connection) => void;
}

export function ConnectionVisualizer({
    connections = [],
    showLabels = false,
    showDetails = false,
    selectedConnectionId,
    onConnectionClick
}: ConnectionVisualizerProps) {
    const nodes = useModelStore((state) => state.nodes);

    // Get node position for a connection
    const getNodePosition = (nodeId: string): [number, number, number] => {
        const node = nodes.get(nodeId);
        if (node) {
            return [node.x, node.y, node.z];
        }
        return [0, 0, 0];
    };

    return (
        <group name="connections">
            {connections.map((connection) => {
                const position = getNodePosition(connection.nodeId);
                const isSelected = connection.id === selectedConnectionId;

                return (
                    <group key={connection.id}>
                        {/* Basic connection indicator */}
                        <ConnectionBall
                            position={position}
                            connection={connection}
                            isSelected={isSelected}
                            onClick={() => onConnectionClick?.(connection)}
                        />

                        {/* Connection label */}
                        {showLabels && (
                            <ConnectionLabel
                                position={position}
                                connection={connection}
                                visible={showLabels}
                            />
                        )}

                        {/* Detailed visualization when selected or showDetails is true */}
                        {(isSelected || showDetails) && (
                            <>
                                {(connection.type === 'BOLTED_SIMPLE' ||
                                    connection.type === 'BOLTED_MOMENT' ||
                                    connection.type === 'BOLTED_SLIP_CRITICAL') &&
                                    connection.boltDetails && (
                                        <BoltedConnectionDetail
                                            position={position}
                                            connection={connection}
                                        />
                                    )}

                                {(connection.type === 'WELDED_FILLET' ||
                                    connection.type === 'WELDED_FULL_PEN' ||
                                    connection.type === 'WELDED_PARTIAL_PEN') &&
                                    connection.weldDetails && (
                                        <WeldedConnectionDetail
                                            position={position}
                                            connection={connection}
                                        />
                                    )}

                                {(connection.type === 'BASE_PLATE_PINNED' ||
                                    connection.type === 'BASE_PLATE_FIXED') &&
                                    connection.basePlateDetails && (
                                        <BasePlateDetail
                                            position={position}
                                            connection={connection}
                                        />
                                    )}
                            </>
                        )}
                    </group>
                );
            })}
        </group>
    );
}

// ============================================
// SIMPLE CONNECTION INDICATOR (for performance)
// ============================================

export interface SimpleConnectionIndicatorProps {
    position: [number, number, number];
    type: ConnectionType;
    size?: number;
}

export function SimpleConnectionIndicator({
    position,
    type,
    size = 0.05
}: SimpleConnectionIndicatorProps) {
    const color = useMemo(() => {
        switch (type) {
            case 'BOLTED_SIMPLE': return '#4CAF50';
            case 'BOLTED_MOMENT': return '#2196F3';
            case 'WELDED_FILLET':
            case 'WELDED_FULL_PEN': return '#FF9800';
            case 'PINNED': return '#9C27B0';
            case 'RIGID': return '#F44336';
            default: return '#9E9E9E';
        }
    }, [type]);

    return (
        <mesh position={position}>
            <sphereGeometry args={[size, 8, 8]} />
            <meshBasicMaterial color={color} />
        </mesh>
    );
}

export default ConnectionVisualizer;
