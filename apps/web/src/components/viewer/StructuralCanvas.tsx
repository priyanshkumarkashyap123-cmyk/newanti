/**
 * StructuralCanvas.tsx - Enhanced Three.js Canvas for Engineering
 * 
 * Features:
 * - Infinite-looking grid with fadeDistance
 * - Contact shadows for depth perception
 * - GizmoHelper for orientation
 * - Pre-highlighting on hover (cyan) and selection (blue)
 */

import { FC, useRef, useState, useMemo, useCallback } from 'react';
import { Canvas, useFrame, useThree, ThreeEvent } from '@react-three/fiber';
import {
    OrbitControls,
    Grid,
    GizmoHelper,
    GizmoViewport,
    ContactShadows,
    Environment,
    Line,
    PerspectiveCamera
} from '@react-three/drei';
import * as THREE from 'three';
import { useModelStore } from '../../store/model';

// ============================================
// TYPES
// ============================================

interface StructuralCanvasProps {
    children?: React.ReactNode;
}

interface MemberMeshProps {
    id: string;
    startPos: THREE.Vector3;
    endPos: THREE.Vector3;
    isSelected: boolean;
    isHovered: boolean;
    onHover: (id: string | null) => void;
    onClick: (id: string, event: ThreeEvent<MouseEvent>) => void;
}

interface NodeMeshProps {
    id: string;
    position: THREE.Vector3;
    isSelected: boolean;
    isHovered: boolean;
    hasSupport: boolean;
    onHover: (id: string | null) => void;
    onClick: (id: string, event: ThreeEvent<MouseEvent>) => void;
}

// ============================================
// COLORS
// ============================================

const COLORS = {
    memberDefault: '#6b7280',     // Gray
    memberHover: '#00ffff',       // Cyan (pre-highlight)
    memberSelected: '#3b82f6',    // Blue
    nodeDefault: '#22c55e',       // Green
    nodeHover: '#00ffff',         // Cyan
    nodeSelected: '#3b82f6',      // Blue
    nodeSupport: '#f59e0b',       // Orange
    grid: '#1f2937',              // Dark gray
    gridSection: '#374151',       // Lighter gray
    shadow: '#000000'
};

// ============================================
// MEMBER MESH COMPONENT (with hover/selection)
// ============================================

const MemberMesh: FC<MemberMeshProps> = ({
    id,
    startPos,
    endPos,
    isSelected,
    isHovered,
    onHover,
    onClick
}) => {
    const meshRef = useRef<THREE.Mesh>(null!);

    // Calculate member geometry
    const { position, rotation, length } = useMemo(() => {
        const midPoint = new THREE.Vector3().addVectors(startPos, endPos).multiplyScalar(0.5);
        const direction = new THREE.Vector3().subVectors(endPos, startPos);
        const length = direction.length();

        // Create rotation from direction
        const quaternion = new THREE.Quaternion();
        quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.normalize());
        const euler = new THREE.Euler().setFromQuaternion(quaternion);

        return { position: midPoint, rotation: euler, length };
    }, [startPos, endPos]);

    // Determine color based on state
    const color = useMemo(() => {
        if (isSelected) return COLORS.memberSelected;
        if (isHovered) return COLORS.memberHover;
        return COLORS.memberDefault;
    }, [isSelected, isHovered]);

    // Determine emissive intensity
    const emissiveIntensity = isHovered ? 0.3 : isSelected ? 0.2 : 0;

    return (
        <mesh
            ref={meshRef}
            position={position}
            rotation={rotation}
            onPointerEnter={(e) => {
                e.stopPropagation();
                onHover(id);
                document.body.style.cursor = 'pointer';
            }}
            onPointerLeave={(e) => {
                e.stopPropagation();
                onHover(null);
                document.body.style.cursor = 'default';
            }}
            onClick={(e) => {
                e.stopPropagation();
                onClick(id, e);
            }}
        >
            <cylinderGeometry args={[0.05, 0.05, length, 8]} />
            <meshStandardMaterial
                color={color}
                emissive={color}
                emissiveIntensity={emissiveIntensity}
                metalness={0.3}
                roughness={0.7}
            />
        </mesh>
    );
};

// ============================================
// NODE MESH COMPONENT (with hover/selection)
// ============================================

const NodeMesh: FC<NodeMeshProps> = ({
    id,
    position,
    isSelected,
    isHovered,
    hasSupport,
    onHover,
    onClick
}) => {
    // Determine color
    const color = useMemo(() => {
        if (isSelected) return COLORS.nodeSelected;
        if (isHovered) return COLORS.nodeHover;
        if (hasSupport) return COLORS.nodeSupport;
        return COLORS.nodeDefault;
    }, [isSelected, isHovered, hasSupport]);

    const emissiveIntensity = isHovered ? 0.5 : isSelected ? 0.3 : 0;

    return (
        <mesh
            position={position}
            onPointerEnter={(e) => {
                e.stopPropagation();
                onHover(id);
                document.body.style.cursor = 'pointer';
            }}
            onPointerLeave={(e) => {
                e.stopPropagation();
                onHover(null);
                document.body.style.cursor = 'default';
            }}
            onClick={(e) => {
                e.stopPropagation();
                onClick(id, e);
            }}
        >
            <sphereGeometry args={[0.12, 16, 16]} />
            <meshStandardMaterial
                color={color}
                emissive={color}
                emissiveIntensity={emissiveIntensity}
                metalness={0.4}
                roughness={0.6}
            />
        </mesh>
    );
};

// ============================================
// STRUCTURE RENDERER (inside Canvas)
// ============================================

const StructureRenderer: FC = () => {
    const nodes = useModelStore((state) => state.nodes);
    const members = useModelStore((state) => state.members);
    const selectedIds = useModelStore((state) => state.selectedIds);
    const selectNode = useModelStore((state) => state.selectNode);
    const selectMember = useModelStore((state) => state.selectMember);

    const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
    const [hoveredMemberId, setHoveredMemberId] = useState<string | null>(null);

    // Handle node click with multi-select support
    const handleNodeClick = useCallback((id: string, event?: ThreeEvent<MouseEvent>) => {
        const multi = event?.shiftKey || event?.ctrlKey || event?.metaKey || false;
        selectNode(id, multi);
    }, [selectNode]);

    // Handle member click with multi-select support
    const handleMemberClick = useCallback((id: string, event?: ThreeEvent<MouseEvent>) => {
        const multi = event?.shiftKey || event?.ctrlKey || event?.metaKey || false;
        selectMember(id, multi);
    }, [selectMember]);

    // Build node positions map
    const nodePositions = useMemo(() => {
        const map = new Map<string, THREE.Vector3>();
        nodes.forEach((node, id) => {
            map.set(id, new THREE.Vector3(node.x, node.y, node.z));
        });
        return map;
    }, [nodes]);

    return (
        <group>
            {/* Render Members */}
            {Array.from(members.entries()).map(([id, member]) => {
                const startPos = nodePositions.get(member.startNodeId);
                const endPos = nodePositions.get(member.endNodeId);

                if (!startPos || !endPos) return null;

                return (
                    <MemberMesh
                        key={id}
                        id={id}
                        startPos={startPos}
                        endPos={endPos}
                        isSelected={selectedIds.has(id)}
                        isHovered={hoveredMemberId === id}
                        onHover={setHoveredMemberId}
                        onClick={handleMemberClick}
                    />
                );
            })}

            {/* Render Nodes */}
            {Array.from(nodes.entries()).map(([id, node]) => {
                const hasSupport = node.restraints && (
                    node.restraints.fx || node.restraints.fy || node.restraints.fz
                );

                return (
                    <NodeMesh
                        key={id}
                        id={id}
                        position={new THREE.Vector3(node.x, node.y, node.z)}
                        isSelected={selectedIds.has(id)}
                        isHovered={hoveredNodeId === id}
                        hasSupport={!!hasSupport}
                        onHover={setHoveredNodeId}
                        onClick={handleNodeClick}
                    />
                );
            })}
        </group>
    );
};

// ============================================
// INFINITE GRID COMPONENT
// ============================================

const InfiniteGrid: FC = () => {
    return (
        <Grid
            position={[0, 0, 0]}
            args={[100, 100]}
            cellSize={1}
            cellThickness={0.5}
            cellColor={COLORS.grid}
            sectionSize={5}
            sectionThickness={1}
            sectionColor={COLORS.gridSection}
            fadeDistance={50}
            fadeStrength={1}
            infiniteGrid
        />
    );
};

// ============================================
// AXIS LABELS
// ============================================

const AxisLabels: FC = () => {
    return (
        <group>
            {/* X Axis - Red */}
            <Line
                points={[[0, 0, 0], [3, 0, 0]]}
                color="#ef4444"
                lineWidth={2}
            />
            {/* Y Axis - Green */}
            <Line
                points={[[0, 0, 0], [0, 3, 0]]}
                color="#22c55e"
                lineWidth={2}
            />
            {/* Z Axis - Blue */}
            <Line
                points={[[0, 0, 0], [0, 0, 3]]}
                color="#3b82f6"
                lineWidth={2}
            />
        </group>
    );
};

// ============================================
// MAIN STRUCTURAL CANVAS COMPONENT
// ============================================

export const StructuralCanvas: FC<StructuralCanvasProps> = ({ children }) => {
    return (
        <Canvas
            shadows
            gl={{ antialias: true, alpha: false }}
            style={{ background: '#0a0a0f' }}
        >
            {/* Camera */}
            <PerspectiveCamera
                makeDefault
                position={[15, 12, 15]}
                fov={45}
                near={0.1}
                far={1000}
            />

            {/* Lighting */}
            <ambientLight intensity={0.4} />
            <directionalLight
                position={[10, 20, 10]}
                intensity={0.8}
                castShadow
                shadow-mapSize={[2048, 2048]}
                shadow-camera-far={50}
                shadow-camera-left={-20}
                shadow-camera-right={20}
                shadow-camera-top={20}
                shadow-camera-bottom={-20}
            />
            <pointLight position={[-10, 10, -10]} intensity={0.3} />

            {/* Orbit Controls */}
            <OrbitControls
                makeDefault
                enableDamping
                dampingFactor={0.05}
                minDistance={2}
                maxDistance={100}
                maxPolarAngle={Math.PI / 2 + 0.3}
            />

            {/* Infinite Grid */}
            <InfiniteGrid />

            {/* Contact Shadows for depth perception */}
            <ContactShadows
                position={[0, -0.01, 0]}
                opacity={0.4}
                scale={50}
                blur={2}
                far={10}
                color={COLORS.shadow}
            />

            {/* Axis Helper */}
            <AxisLabels />

            {/* Structural Elements */}
            <StructureRenderer />

            {/* GizmoHelper for orientation */}
            <GizmoHelper
                alignment="bottom-right"
                margin={[80, 80]}
            >
                <GizmoViewport
                    axisColors={['#ef4444', '#22c55e', '#3b82f6']}
                    labelColor="white"
                />
            </GizmoHelper>

            {/* Additional children (InteractionManager, etc.) */}
            {children}
        </Canvas>
    );
};

export default StructuralCanvas;
