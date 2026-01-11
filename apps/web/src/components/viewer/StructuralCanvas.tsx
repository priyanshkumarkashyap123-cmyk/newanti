/**
 * StructuralCanvas.tsx - Enhanced Three.js Canvas for Engineering
 * 
 * Features:
 * - Infinite-looking grid with fadeDistance
 * - Contact shadows for depth perception
 * - GizmoHelper for orientation
 * - Pre-highlighting on hover (cyan) and selection (blue)
 */

import { FC, useRef, useState, useMemo, useCallback, Suspense, useEffect } from 'react';
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
import { InstancedMembersRenderer } from './InstancedMembersRenderer';
import { InstancedNodesRenderer } from './InstancedNodesRenderer';
import { UltraLightMembersRenderer } from './UltraLightMembersRenderer';
import { UltraLightNodesRenderer } from './UltraLightNodesRenderer';
import { PlateRenderer } from './PlateRenderer';
import { announce, prefersReducedMotion } from '../../utils/accessibility';

// ============================================
// PERFORMANCE THRESHOLDS
// ============================================

const ULTRA_LIGHT_THRESHOLD = 10000; // Switch to ultra-light mode above this

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
// STRUCTURE RENDERER (GPU Instanced for high performance)
// ============================================

const StructureRenderer: FC = () => {
    const members = useModelStore((state) => state.members);
    const nodes = useModelStore((state) => state.nodes);

    const memberCount = members.size;
    const nodeCount = nodes.size;
    const totalElements = memberCount + nodeCount;

    // Use ultra-light renderers for large models
    const useUltraLight = totalElements > ULTRA_LIGHT_THRESHOLD;

    if (useUltraLight) {
        console.log(`[StructuralCanvas] Using UltraLight mode for ${memberCount} members, ${nodeCount} nodes`);
    }

    return (
        <group>
            {/* GPU-accelerated instanced rendering for members */}
            {useUltraLight ? (
                <UltraLightMembersRenderer />
            ) : (
                <InstancedMembersRenderer />
            )}

            {/* GPU-accelerated instanced rendering for nodes */}
            {useUltraLight ? (
                <UltraLightNodesRenderer />
            ) : (
                <InstancedNodesRenderer />
            )}

            {/* Plate/Shell elements */}
            <PlateRenderer />
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
    const members = useModelStore((state) => state.members);
    const nodes = useModelStore((state) => state.nodes);

    const memberCount = members.size;
    const nodeCount = nodes.size;
    const totalElements = memberCount + nodeCount;
    const isLargeModel = totalElements > ULTRA_LIGHT_THRESHOLD;
    const reducedMotion = prefersReducedMotion();

    // Announce model size changes for screen readers
    useEffect(() => {
        if (totalElements > 0) {
            announce(`Model loaded: ${nodeCount} nodes, ${memberCount} members`);
        }
    }, [totalElements, nodeCount, memberCount]);

    // Adaptive settings based on model size
    const glSettings = useMemo(() => ({
        antialias: !isLargeModel, // Disable AA for large models
        alpha: false,
        powerPreference: 'high-performance' as const,
        failIfMajorPerformanceCaveat: false,
        preserveDrawingBuffer: false,
        stencil: false, // Disable stencil for performance
        depth: true,
    }), [isLargeModel]);

    // Keyboard shortcuts for 3D navigation
    const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
        switch (e.key) {
            case 'r':
            case 'R':
                announce('Reset camera view');
                break;
            case 'Escape':
                announce('Deselected all elements');
                break;
            case 'Delete':
            case 'Backspace':
                announce('Delete selected elements');
                break;
        }
    }, []);

    return (
        <div
            className="relative w-full h-full"
            role="application"
            aria-label={`3D structural model viewer. ${nodeCount} nodes, ${memberCount} members. Use mouse to orbit, scroll to zoom.`}
            aria-roledescription="interactive 3D canvas"
            tabIndex={0}
            onKeyDown={handleKeyDown}
            id="main-content"
        >
            <Canvas
                shadows={!isLargeModel && !reducedMotion}
                gl={glSettings}
                style={{ background: '#0a0a0f' }}
                frameloop={isLargeModel ? 'demand' : 'always'}
                performance={{ min: 0.5 }}
            >
                {/* Camera */}
                <PerspectiveCamera
                    makeDefault
                    position={[15, 12, 15]}
                    fov={45}
                    near={0.1}
                    far={isLargeModel ? 2000 : 1000}
                />

                {/* Lighting - simplified for large models */}
                <ambientLight intensity={isLargeModel ? 0.6 : 0.4} />
                {!isLargeModel && (
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
                )}
                {isLargeModel && (
                    <directionalLight
                        position={[10, 20, 10]}
                        intensity={0.6}
                    />
                )}
                <pointLight position={[-10, 10, -10]} intensity={isLargeModel ? 0.2 : 0.3} />

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

                {/* Contact Shadows for depth perception - disabled for large models */}
                {!isLargeModel && (
                    <ContactShadows
                        position={[0, -0.01, 0]}
                        opacity={0.4}
                        scale={50}
                        blur={2}
                        far={10}
                        color={COLORS.shadow}
                    />
                )}

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

            {/* Keyboard shortcuts help (screen reader only) */}
            <div className="sr-only" aria-live="polite">
                Keyboard shortcuts: R to reset view, Escape to deselect, Delete to remove selected
            </div>
        </div>
    );
};

export default StructuralCanvas;
